/**
 * SolNuv AI Agent Service — Orchestration Engine
 * Manages: chat conversations, async tasks, agent provisioning/revocation,
 * internal cron agents. All conversations stored for future model training.
 */

'use strict';

const supabase      = require('../config/database');
const logger        = require('../utils/logger');
const aiProvider    = require('./aiProviderService');
const toolRegistry  = require('./aiToolRegistry');
const { SECURITY_PREAMBLE, USER_INPUT_PREFIX, USER_INPUT_SUFFIX, AGENT_SEEDS } = require('../constants/agentPrompts');
const { logPlatformActivity } = require('./auditService');
const { AGENT_PLAN_HIERARCHY } = require('../constants/planConstants');
const { isSubscriptionHardExpired } = require('./gracePeriodService');

const PLAN_HIERARCHY = AGENT_PLAN_HIERARCHY;
const MAX_TOOL_ROUNDS = 3;
const MAX_HISTORY_MESSAGES = 20;
const MAX_USER_MESSAGE_LENGTH = 4000;

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function sanitiseUserInput(text) {
  if (!text) return '';
  return String(text)
    .slice(0, MAX_USER_MESSAGE_LENGTH)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ''); // strip control chars
}

function buildSystemPrompt(definition, company) {
  let prompt = `${SECURITY_PREAMBLE}\n\n${definition.system_prompt}`;

  // Append admin-authored custom instructions (non-core, editable via dashboard)
  if (definition.custom_instructions && definition.custom_instructions.trim()) {
    prompt += `\n\nADDITIONAL INSTRUCTIONS:\n${definition.custom_instructions.trim()}`;
  }

  // Append knowledge base documents as context
  const knowledge = Array.isArray(definition.knowledge_base) ? definition.knowledge_base : [];
  if (knowledge.length > 0) {
    prompt += '\n\nKNOWLEDGE BASE (reference these when relevant):';
    for (const doc of knowledge) {
      prompt += `\n\n--- ${doc.title} ---\n${doc.content}`;
    }
  }

  if (company?.name) {
    prompt = prompt.replace(/\{company_name\}/g, company.name);
  }
  return prompt;
}

function extractToolCalls(content) {
  // Try to parse structured tool calls from LLM response.
  // Expected format: {"tool_calls": [{"name": "...", "arguments": {...}}]}
  // Or inline: <tool_call>{"name": "...", "arguments": {...}}</tool_call>
  try {
    const parsed = JSON.parse(content);
    if (parsed.tool_calls && Array.isArray(parsed.tool_calls)) {
      return parsed.tool_calls;
    }
    if (parsed.name && parsed.arguments !== undefined) {
      return [parsed];
    }
  } catch (_) { /* not JSON */ }

  // Try regex extraction for inline tool calls
  const matches = content.match(/<tool_call>([\s\S]*?)<\/tool_call>/g);
  if (matches) {
    return matches.map(m => {
      try {
        return JSON.parse(m.replace(/<\/?tool_call>/g, ''));
      } catch (_) { return null; }
    }).filter(Boolean);
  }

  return [];
}

// ─── AGENT DEFINITION CACHE + SEEDING ────────────────────────────────────────

let _defCache = {};
let _defCacheTs = 0;
const DEF_CACHE_TTL = 2 * 60 * 1000;

async function ensureSingletonNullCompanyInstance(definitionId) {
  const { data: existing, error } = await supabase
    .from('ai_agent_instances')
    .select('id, is_active, created_at')
    .eq('definition_id', definitionId)
    .is('company_id', null)
    .order('created_at', { ascending: true });

  if (error) {
    logger.warn('Failed to inspect shared agent instances', { definitionId, message: error.message });
    return null;
  }

  if (!existing || existing.length === 0) {
    const { data: created, error: createErr } = await supabase
      .from('ai_agent_instances')
      .insert({
        definition_id: definitionId,
        company_id: null,
        is_active: true,
      })
      .select('id')
      .single();

    if (createErr) {
      logger.warn('Failed to create shared agent instance', { definitionId, message: createErr.message });
      return null;
    }
    return created?.id || null;
  }

  const keep = existing[0];
  const duplicates = existing.slice(1).map((r) => r.id);

  if (!keep.is_active) {
    await supabase
      .from('ai_agent_instances')
      .update({ is_active: true })
      .eq('id', keep.id);
  }

  if (duplicates.length > 0) {
    await supabase
      .from('ai_agent_instances')
      .update({ is_active: false })
      .in('id', duplicates);
    logger.warn('Deactivated duplicate shared agent instances', { definitionId, deactivated: duplicates.length });
  }

  return keep.id;
}

function invalidateDefinitionCache(definitionId) {
  if (definitionId) {
    delete _defCache[definitionId];
  } else {
    _defCache = {};
    _defCacheTs = 0;
  }
}

async function getAgentDefinition(definitionId) {
  if (_defCache[definitionId] && Date.now() - _defCacheTs < DEF_CACHE_TTL) {
    return _defCache[definitionId];
  }
  const { data, error } = await supabase
    .from('ai_agent_definitions')
    .select('*')
    .eq('id', definitionId)
    .single();
  if (error || !data) return null;
  _defCache[definitionId] = data;
  _defCacheTs = Date.now();
  return data;
}

async function getAgentInstance(instanceId) {
  const { data, error } = await supabase
    .from('ai_agent_instances')
    .select('*, ai_agent_definitions(*)')
    .eq('id', instanceId)
    .eq('is_active', true)
    .single();
  if (error || !data) return null;
  return data;
}

/**
 * Seed default agent definitions and internal instances on first startup.
 * Idempotent — skips agents that already exist by slug.
 */
async function seedAgentDefinitions() {
  const summary = {
    createdDefinitions: 0,
    updatedDefinitions: 0,
    createdSharedInstances: 0,
    recoveredSharedInstances: 0,
    failedDefinitions: 0,
  };

  try {
    for (const seed of AGENT_SEEDS) {
      const { data: existing } = await supabase
        .from('ai_agent_definitions')
        .select('id, is_active')
        .eq('slug', seed.slug)
        .maybeSingle();

      let definitionId = existing?.id || null;
      if (!existing) {
        const { data: created, error } = await supabase
          .from('ai_agent_definitions')
          .insert({
            slug: seed.slug,
            tier: seed.tier,
            name: seed.name,
            description: seed.description,
            system_prompt: seed.system_prompt,
            capabilities: seed.capabilities,
            provider_slug: seed.provider_slug,
            fallback_provider_slug: seed.fallback_provider_slug,
            plan_minimum: seed.plan_minimum,
            max_instances_per_company: seed.max_instances_per_company,
            max_tokens_per_task: seed.max_tokens_per_task,
            temperature: seed.temperature,
            response_format: seed.response_format,
          })
          .select('id, slug, tier')
          .single();

        if (error) {
          summary.failedDefinitions += 1;
          logger.warn(`Failed to seed agent definition: ${seed.slug}`, { message: error.message });
          continue;
        }
        definitionId = created.id;
        summary.createdDefinitions += 1;
      } else {
        const { error: updateErr } = await supabase
          .from('ai_agent_definitions')
          .update({
            tier: seed.tier,
            name: seed.name,
            description: seed.description,
            system_prompt: seed.system_prompt,
            capabilities: seed.capabilities,
            provider_slug: seed.provider_slug,
            fallback_provider_slug: seed.fallback_provider_slug,
            plan_minimum: seed.plan_minimum,
            max_instances_per_company: seed.max_instances_per_company,
            max_tokens_per_task: seed.max_tokens_per_task,
            temperature: seed.temperature,
            response_format: seed.response_format,
            is_active: true,
          })
          .eq('id', existing.id);

        if (updateErr) {
          logger.warn(`Failed to refresh seeded definition: ${seed.slug}`, { message: updateErr.message });
        } else {
          summary.updatedDefinitions += 1;
        }
      }

      if (definitionId && seed.tier === 'internal') {
        const before = await supabase
          .from('ai_agent_instances')
          .select('id', { count: 'exact', head: true })
          .eq('definition_id', definitionId)
          .is('company_id', null);
        const instanceId = await ensureSingletonNullCompanyInstance(definitionId);
        if (instanceId) {
          if ((before.count || 0) === 0) summary.createdSharedInstances += 1;
          else summary.recoveredSharedInstances += 1;
        }
      }
    }

    // Ensure a single shared general assistant exists (used by admin/system paths)
    const { data: generalDef } = await supabase
      .from('ai_agent_definitions')
      .select('id')
      .eq('slug', 'solnuv-assistant')
      .maybeSingle();

    if (generalDef?.id) {
      const before = await supabase
        .from('ai_agent_instances')
        .select('id', { count: 'exact', head: true })
        .eq('definition_id', generalDef.id)
        .is('company_id', null);
      const instanceId = await ensureSingletonNullCompanyInstance(generalDef.id);
      if (instanceId) {
        if ((before.count || 0) === 0) summary.createdSharedInstances += 1;
        else summary.recoveredSharedInstances += 1;
      }
    }
  } catch (err) {
    logger.error('Agent seeding error', { message: err.message });
  }
  return summary;
}

// ─── CHAT EXECUTION ──────────────────────────────────────────────────────────

/**
 * Execute a chat message within a conversation.
 *
 * @param {Object} params
 * @param {string} params.agentInstanceId
 * @param {string} params.userId
 * @param {string} [params.conversationId] - null to create new conversation
 * @param {string} params.message
 * @param {string} [params.contextType]
 * @param {string} [params.contextResourceId]
 * @param {string} [params.environment]
 * @returns {{ conversationId, response, toolResults, tokensUsed }}
 */
async function executeChat({
  agentInstanceId,
  userId,
  conversationId,
  message,
  contextType,
  contextResourceId,
  environment = 'test',
}) {
  // 1. Load agent
  const instance = await getAgentInstance(agentInstanceId);
  if (!instance) throw new Error('Agent not found or inactive');
  const definition = instance.ai_agent_definitions;
  if (!definition) throw new Error('Agent definition not found');

  // 2. Load company context
  const { data: user } = await supabase
    .from('users')
    .select('id, first_name, company_id, companies:companies!users_company_id_fkey(id, name, subscription_plan)')
    .eq('id', userId)
    .single();

  const company = user?.companies || null;
  const companyId = instance.company_id || user?.company_id || null;
  const allowedContextTypes = new Set(['project', 'report', 'financial', 'support', 'internal', 'general']);
  const defaultContextType = definition.tier === 'general' ? 'general' : 'support';
  const safeContextType = allowedContextTypes.has(contextType) ? contextType : defaultContextType;

  // 3. Get or create conversation
  let convId = conversationId;
  if (!convId) {
    const { data: conv, error } = await supabase
      .from('ai_conversations')
      .insert({
        agent_instance_id: agentInstanceId,
        user_id: userId,
        company_id: companyId,
        title: sanitiseUserInput(message).slice(0, 100),
        context_type: safeContextType,
        context_resource_id: contextResourceId || null,
        environment,
      })
      .select('id')
      .single();
    if (error) throw error;
    convId = conv.id;
  }

  // 4. Load conversation history
  const { data: history } = await supabase
    .from('ai_messages')
    .select('role, content, tool_name, tool_input, tool_output')
    .eq('conversation_id', convId)
    .order('created_at', { ascending: true })
    .limit(MAX_HISTORY_MESSAGES);

  // 5. Build messages array for LLM
  const systemPrompt = buildSystemPrompt(definition, company);
  const availableTools = toolRegistry.getToolsForCapabilities(definition.capabilities || []);

  let toolInstructions = '';
  if (availableTools.length > 0) {
    toolInstructions = `\n\nAVAILABLE TOOLS (call by responding with JSON {"tool_calls":[{"name":"tool_name","arguments":{...}}]}):\n`;
    toolInstructions += availableTools.map(t => `- ${t.name}: ${t.description}`).join('\n');
    toolInstructions += '\n\nAfter tool results, provide your final answer to the user. Only call tools when needed.';
  }

  const messages = [
    { role: 'system', content: systemPrompt + toolInstructions },
  ];

  // Add history
  for (const msg of history || []) {
    if (msg.role === 'tool_call' || msg.role === 'tool_result') {
      messages.push({
        role: msg.role === 'tool_call' ? 'assistant' : 'user',
        content: msg.role === 'tool_call'
          ? `[Tool Call: ${msg.tool_name}] ${JSON.stringify(msg.tool_input)}`
          : `[Tool Result: ${msg.tool_name}] ${JSON.stringify(msg.tool_output)}`,
      });
    } else {
      messages.push({ role: msg.role === 'assistant' ? 'assistant' : 'user', content: msg.content || '' });
    }
  }

  // Add current user message (with security delimiters)
  const sanitised = sanitiseUserInput(message);
  messages.push({ role: 'user', content: `${USER_INPUT_PREFIX}\n${sanitised}\n${USER_INPUT_SUFFIX}` });

  // Save user message
  await supabase.from('ai_messages').insert({
    conversation_id: convId,
    role: 'user',
    content: sanitised,
  }).catch(err => logger.error('Failed to save AI message', { conversationId: convId, error: err.message }));

  // 6. LLM call with tool-calling loop
  const toolContext = {
    userId,
    companyId,
    agentInstanceId,
    conversationId: convId,
    environment,
  };

  let totalTokens = 0;
  const allToolResults = [];
  let finalContent = '';

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const result = await aiProvider.complete({
      messages,
      tier: definition.tier,
      preferredSlug: definition.provider_slug,
      fallbackSlug: definition.fallback_provider_slug,
      temperature: definition.temperature,
      maxTokens: definition.max_tokens_per_task,
      responseFormat: availableTools.length > 0 ? undefined : definition.response_format,
    });

    totalTokens += result.tokensInput + result.tokensOutput;
    finalContent = result.content;

    // Check for tool calls
    const toolCalls = extractToolCalls(result.content);
    if (toolCalls.length === 0 || round === MAX_TOOL_ROUNDS) {
      // No tool calls or max rounds — save final response
      await supabase.from('ai_messages').insert({
        conversation_id: convId,
        role: 'assistant',
        content: result.content,
        tokens_used: result.tokensInput + result.tokensOutput,
        latency_ms: result.latencyMs,
        provider_slug: result.provider,
        model_id: result.model,
      });
      break;
    }

    // Execute tool calls
    for (const tc of toolCalls) {
      // Save tool call message
      await supabase.from('ai_messages').insert({
        conversation_id: convId,
        role: 'tool_call',
        tool_name: tc.name,
        tool_input: tc.arguments || {},
        provider_slug: result.provider,
        model_id: result.model,
      });

      // Execute
      const toolResult = await toolRegistry.executeTool(
        tc.name,
        tc.arguments || {},
        { ...toolContext, messageId: null },
        definition.capabilities || [],
      );

      allToolResults.push({ tool: tc.name, result: toolResult });

      // Save tool result message
      await supabase.from('ai_messages').insert({
        conversation_id: convId,
        role: 'tool_result',
        tool_name: tc.name,
        tool_output: toolResult,
      });

      // Add to messages for next round
      messages.push({
        role: 'assistant',
        content: `[Tool Call: ${tc.name}] ${JSON.stringify(tc.arguments || {})}`,
      });
      messages.push({
        role: 'user',
        content: `[Tool Result: ${tc.name}] ${JSON.stringify(toolResult)}`,
      });
    }
  }

  // 7. Update conversation timestamp
  await supabase.from('ai_conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', convId);

  return {
    conversationId: convId,
    response: finalContent,
    toolResults: allToolResults,
    tokensUsed: totalTokens,
  };
}

// ─── ASYNC TASK EXECUTION ────────────────────────────────────────────────────

/**
 * Process an async agent task (document digestion, report gen, cron jobs).
 */
async function executeTask(taskId) {
  // Mark processing
  await supabase.from('ai_tasks')
    .update({ status: 'processing', started_at: new Date().toISOString() })
    .eq('id', taskId);

  const { data: task, error: taskError } = await supabase
    .from('ai_tasks')
    .select('*, ai_agent_instances(*, ai_agent_definitions(*))')
    .eq('id', taskId)
    .single();

  if (taskError || !task) {
    logger.error('Task not found', { taskId });
    return;
  }

  const instance = task.ai_agent_instances;
  const definition = instance?.ai_agent_definitions;
  if (!definition) {
    await supabase.from('ai_tasks').update({
      status: 'failed',
      error_message: 'Agent definition not found',
      completed_at: new Date().toISOString(),
    }).eq('id', taskId);
    return;
  }

  try {
    // Load company context if applicable
    let company = null;
    if (instance.company_id) {
      const { data } = await supabase.from('companies').select('id, name').eq('id', instance.company_id).single();
      company = data;
    }

    // Build task-specific prompt
    const systemPrompt = buildSystemPrompt(definition, company);
    const taskPrompt = `Task type: ${task.task_type}\nInput: ${JSON.stringify(task.input_payload)}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: taskPrompt },
    ];

    // Call LLM
    const result = await aiProvider.complete({
      messages,
      tier: definition.tier,
      preferredSlug: definition.provider_slug,
      fallbackSlug: definition.fallback_provider_slug,
      temperature: definition.temperature,
      maxTokens: definition.max_tokens_per_task,
      responseFormat: definition.response_format,
    });

    // Execute any tool calls from the response
    const toolCalls = extractToolCalls(result.content);
    const toolResults = [];
    for (const tc of toolCalls) {
      const toolResult = await toolRegistry.executeTool(
        tc.name,
        tc.arguments || {},
        {
          userId: task.created_by,
          companyId: instance.company_id,
          agentInstanceId: instance.id,
          taskId,
          environment: task.environment || 'test',
        },
        definition.capabilities || [],
      );
      toolResults.push({ tool: tc.name, result: toolResult });
    }

    // Parse output
    let output;
    try {
      output = JSON.parse(result.content);
    } catch (_) {
      output = { content: result.content, tool_results: toolResults };
    }
    if (toolResults.length > 0 && !output.tool_results) {
      output.tool_results = toolResults;
    }

    await supabase.from('ai_tasks').update({
      status: 'completed',
      output_payload: output,
      tokens_used: result.tokensInput + result.tokensOutput,
      completed_at: new Date().toISOString(),
    }).eq('id', taskId);

  } catch (err) {
    const newRetries = (task.retries || 0) + 1;
    if (newRetries >= 3) {
      // Max retries — fail and escalate
      await supabase.from('ai_tasks').update({
        status: 'failed',
        error_message: err.message,
        retries: newRetries,
        completed_at: new Date().toISOString(),
      }).eq('id', taskId);

      // Create escalation
      const { error: escErr } = await supabase.from('ai_escalations').insert({
        task_id: taskId,
        agent_instance_id: instance.id,
        user_id: task.created_by,
        reason: `Task failed after ${newRetries} attempts: ${err.message}`,
        severity: 'high',
        environment: task.environment || 'test',
      });
      if (escErr) logger.warn('Escalation insert failed', { message: escErr.message });
    } else {
      // Retry
      await supabase.from('ai_tasks').update({
        status: 'queued',
        retries: newRetries,
        error_message: err.message,
      }).eq('id', taskId);
    }
    logger.error('Agent task execution failed', { taskId, attempt: newRetries, message: err.message });
  }
}

/**
 * Create and optionally process an async task.
 */
async function createTask({ agentInstanceId, taskType, inputPayload, createdBy, environment = 'test', processNow = false }) {
  const { data: task, error } = await supabase
    .from('ai_tasks')
    .insert({
      agent_instance_id: agentInstanceId,
      task_type: taskType,
      input_payload: inputPayload || {},
      created_by: createdBy || null,
      environment,
      priority: 5,
    })
    .select('id, status')
    .single();

  if (error) throw error;

  if (processNow) {
    // Fire and forget — don't block the caller
    // Use setImmediate for non-blocking execution (Node.js specific)
    setImmediate(() => executeTask(task.id).catch(e => logger.error('Task execution error', { message: e.message })));
  }

  return task;
}


// ─── AGENT PROVISIONING ──────────────────────────────────────────────────────

/**
 * Auto-assign agents when a company subscribes to a plan.
 * Called from payment webhook and admin manual upgrade.
 */
async function assignAgentsOnSubscription(companyId, plan) {
  if (!companyId || !plan) return;
  const planLevel = PLAN_HIERARCHY[plan] ?? 0;

  try {
    // Look up company name for branded agent display name
    const { data: company } = await supabase
      .from('companies')
      .select('name')
      .eq('id', companyId)
      .single();
    const companyName = company?.name?.trim() || null;

    // Get all active definitions that this plan can access
    const { data: definitionsData } = await supabase
      .from('ai_agent_definitions')
      .select('id, slug, tier, plan_minimum, max_instances_per_company')
      .eq('is_active', true)
      .in('tier', ['customer', 'general']);
    let definitions = definitionsData || [];

    if (definitions.length === 0) {
      await seedAgentDefinitions();
      const { data: reseededDefinitions } = await supabase
        .from('ai_agent_definitions')
        .select('id, slug, tier, plan_minimum, max_instances_per_company')
        .eq('is_active', true)
        .in('tier', ['customer', 'general']);
      if (!reseededDefinitions || reseededDefinitions.length === 0) return;
      definitions = reseededDefinitions;
    }

    let assigned = 0;
    for (const def of definitions) {
      const requiredLevel = PLAN_HIERARCHY[def.plan_minimum] ?? 0;
      if (planLevel < requiredLevel) continue;
      if (def.max_instances_per_company <= 0) continue; // internal agents

      // Brand the general assistant with the company name
      const configOverrides = (def.slug === 'solnuv-assistant' && companyName)
        ? { display_name: `${companyName} Assistant` }
        : {};

      // Upsert instance (skip if already exists)
      const { error } = await supabase
        .from('ai_agent_instances')
        .upsert({
          definition_id: def.id,
          company_id: companyId,
          is_active: true,
          config_overrides: Object.keys(configOverrides).length > 0 ? configOverrides : null,
        }, { onConflict: 'definition_id,company_id' });

      if (!error) assigned++;
    }

    if (assigned > 0) {
      logger.info(`Assigned ${assigned} AI agents to company ${companyId} (plan: ${plan})`);
      await logPlatformActivity({
        actorUserId: null,
        actorEmail: 'system',
        action: 'ai.agents.assigned',
        resourceType: 'company',
        resourceId: companyId,
        details: { plan, agents_assigned: assigned },
      });
    }
  } catch (err) {
    logger.error('Failed to assign agents on subscription', { companyId, plan, message: err.message });
  }
}

/**
 * Revoke agents when subscription expires or downgrades.
 */
async function revokeAgentsOnDowngrade(companyId, newPlan) {
  if (!companyId) return;
  const newLevel = PLAN_HIERARCHY[newPlan] ?? 0;

  try {
    // Get all active instances for this company
    const { data: instances } = await supabase
      .from('ai_agent_instances')
      .select('id, definition_id, ai_agent_definitions(plan_minimum)')
      .eq('company_id', companyId)
      .eq('is_active', true);

    if (!instances || instances.length === 0) return;

    let revoked = 0;
    for (const inst of instances) {
      const requiredLevel = PLAN_HIERARCHY[inst.ai_agent_definitions?.plan_minimum] ?? 0;
      if (newLevel >= requiredLevel) continue; // still qualified

      // Deactivate
      await supabase.from('ai_agent_instances')
        .update({ is_active: false })
        .eq('id', inst.id);

      // Mark active conversations as completed
      await supabase.from('ai_conversations')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('agent_instance_id', inst.id)
        .eq('status', 'active');

      revoked++;
    }

    if (revoked > 0) {
      logger.info(`Revoked ${revoked} AI agents from company ${companyId} (new plan: ${newPlan})`);
      await logPlatformActivity({
        actorUserId: null,
        actorEmail: 'system',
        action: 'ai.agents.revoked',
        resourceType: 'company',
        resourceId: companyId,
        details: { new_plan: newPlan, agents_revoked: revoked },
      });
    }
  } catch (err) {
    logger.error('Failed to revoke agents on downgrade', { companyId, newPlan, message: err.message });
  }
}

// ─── INTERNAL AGENT RUNNER ───────────────────────────────────────────────────

/**
 * Run an internal agent by slug (triggered by cron).
 */
async function runInternalAgent(agentSlug) {
  try {
    // Find internal instance for this slug
    const { data: definition } = await supabase
      .from('ai_agent_definitions')
      .select('id, slug')
      .eq('slug', agentSlug)
      .eq('tier', 'internal')
      .eq('is_active', true)
      .single();

    if (!definition) {
      logger.warn(`Internal agent not found or inactive: ${agentSlug}`);
      return;
    }

    const { data: instance } = await supabase
      .from('ai_agent_instances')
      .select('id')
      .eq('definition_id', definition.id)
      .is('company_id', null)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (!instance) {
      logger.warn(`No active instance for internal agent: ${agentSlug}`);
      return;
    }

    // Build task-specific context based on agent type
    const taskInput: Record<string, any> = {};
    const today = new Date().toISOString().split('T')[0];

    switch (agentSlug) {
      case 'seo-blog-writer':
        taskInput.instruction = `Generate one high-quality blog post about a relevant topic for the Nigerian solar industry. Date: ${today}. Check existing posts to avoid duplicate topics.`;
        break;
      case 'holiday-notifier':
        taskInput.instruction = `Check for Nigerian holidays or notable dates in the next 7 days from ${today}. Also check for any platform events to notify about. Generate appropriate messages.`;
        break;
      case 'security-specialist':
        taskInput.instruction = `Analyse the last 6 hours of audit logs for any security anomalies or suspicious patterns. Report findings with severity levels.`;
        break;
      case 'user-behaviour-analyst':
        taskInput.instruction = `Analyse user behaviour over the last 30 days. Identify engagement trends, churn risks, and potential upgrade candidates. Provide actionable recommendations.`;
        break;
      case 'market-analyst':
        taskInput.instruction = `Review current silver prices and technology constants. Provide analysis of market trends relevant to solar waste management in Nigeria. Date: ${today}.`;
        break;
      case 'tariff-rate-monitor':
        taskInput.instruction = `Review all stored tariff templates and calculator MYTO band rates. Compare against current published electricity tariff rates for Nigeria (NERC MYTO), South Africa (Eskom), Kenya (KPLC), and Ghana (ECG). Update any stale or incorrect rates. Date: ${today}.`;
        break;
      default:
        taskInput.instruction = `Perform your assigned task for ${today}.`;
    }

    const task = await createTask({
      agentInstanceId: instance.id,
      taskType: `cron_${agentSlug.replace(/-/g, '_')}`,
      inputPayload: taskInput,
      createdBy: null,
      environment: 'live',
      processNow: true,
    });

    logger.info(`Internal agent task created: ${agentSlug} → task ${task.id}`);
  } catch (err) {
    logger.error(`Failed to run internal agent: ${agentSlug}`, { message: err.message });
  }
}

// ─── SUBSCRIPTION EXPIRY CHECKER ─────────────────────────────────────────────

/**
 * Check for expired subscriptions and revoke agents. Called by daily cron.
 */
async function checkExpiredSubscriptions() {
  try {
    const { data: companies } = await supabase
      .from('companies')
      .select('id, subscription_plan, subscription_expires_at, subscription_grace_until')
      .neq('subscription_plan', 'free');

    if (!companies || companies.length === 0) return;

    const expiredCompanies = companies.filter((company) => isSubscriptionHardExpired(company));
    if (expiredCompanies.length === 0) return;

    for (const company of expiredCompanies) {
      await revokeAgentsOnDowngrade(company.id, 'free');
    }

    logger.info(`Checked ${expiredCompanies.length} expired subscriptions for agent revocation`);
  } catch (err) {
    logger.error('Failed to check expired subscriptions', { message: err.message });
  }
}


// ─── TRAINING DATA EXPORT ────────────────────────────────────────────────────

/**
 * Export conversations as JSONL for model fine-tuning.
 *
 * @param {Object} [filters]
 * @param {string} [filters.dateFrom]
 * @param {string} [filters.dateTo]
 * @param {string} [filters.tier]
 * @param {string} [filters.status] - 'completed' recommended for training
 * @returns {string} JSONL string
 */
async function exportTrainingData(filters: Record<string, any> = {}) {
  let query = supabase
    .from('ai_conversations')
    .select('id, agent_instance_id, context_type, status, created_at, ai_agent_instances(ai_agent_definitions(slug, tier, name))')
    .order('created_at', { ascending: true })
    .limit(1000);

  if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom);
  if (filters.dateTo) query = query.lte('created_at', filters.dateTo);
  if (filters.status) query = query.eq('status', filters.status);

  const { data: conversations, error } = await query;
  if (error) throw error;

  const lines = [];
  for (const conv of conversations || []) {
    const agentDef = conv.ai_agent_instances?.ai_agent_definitions;
    if (filters.tier && agentDef?.tier !== filters.tier) continue;

    const { data: messages } = await supabase
      .from('ai_messages')
      .select('role, content, tool_name, tool_input, tool_output')
      .eq('conversation_id', conv.id)
      .order('created_at', { ascending: true });

    if (!messages || messages.length < 2) continue; // need at least user + assistant

    const formattedMessages = messages.map(m => {
      if (m.role === 'tool_call') {
        return { role: 'assistant', content: JSON.stringify({ tool_calls: [{ name: m.tool_name, arguments: m.tool_input }] }) };
      }
      if (m.role === 'tool_result') {
        return { role: 'user', content: `[Tool Result: ${m.tool_name}] ${JSON.stringify(m.tool_output)}` };
      }
      return { role: m.role === 'system' ? 'system' : m.role === 'assistant' ? 'assistant' : 'user', content: m.content || '' };
    });

    lines.push(JSON.stringify({
      messages: formattedMessages,
      metadata: {
        conversation_id: conv.id,
        agent_slug: agentDef?.slug,
        agent_tier: agentDef?.tier,
        context_type: conv.context_type,
        status: conv.status,
        created_at: conv.created_at,
      },
    }));
  }

  return lines.join('\n');
}

async function getAdminHealthSnapshot() {
  const diagnostics = {
    definition_count: 0,
    provider_readiness: {
      total_active_providers: 0,
      missing_api_keys: [],
      ready_provider_slugs: [],
    },
    capability_coverage: {
      agents_with_no_tools: [],
      missing_capabilities: [],
    },
    shared_instance_duplicates: {
      total_groups: 0,
      total_extra_instances: 0,
      groups: [],
    },
    per_company_provisioning_gaps: {
      companies_with_gaps: 0,
      rows: [],
    },
  };

  const { data: definitions, error: defErr } = await supabase
    .from('ai_agent_definitions')
    .select('id, slug, tier, plan_minimum, max_instances_per_company, is_active');
  if (defErr) throw defErr;
  const activeDefinitions = (definitions || []).filter((d) => d.is_active);
  diagnostics.definition_count = activeDefinitions.length;

  const { data: activeProviders, error: providerErr } = await supabase
    .from('ai_providers')
    .select('slug, api_key_env_var')
    .eq('is_active', true);
  if (providerErr) throw providerErr;

  diagnostics.provider_readiness.total_active_providers = (activeProviders || []).length;
  for (const provider of activeProviders || []) {
    if (!provider?.api_key_env_var || !process.env[provider.api_key_env_var]) {
      diagnostics.provider_readiness.missing_api_keys.push({
        provider_slug: provider?.slug || null,
        api_key_env_var: provider?.api_key_env_var || null,
      });
    } else if (provider?.slug) {
      diagnostics.provider_readiness.ready_provider_slugs.push(provider.slug);
    }
  }

  const allTools = Object.values(toolRegistry.TOOL_DEFINITIONS || {});
  const hasCapabilityMatch = (agentCapability, toolCapability) => {
    if (!agentCapability || !toolCapability) return false;
    if (agentCapability.endsWith('.*')) {
      return toolCapability.startsWith(agentCapability.slice(0, -2));
    }
    return toolCapability === agentCapability;
  };

  for (const def of activeDefinitions) {
    const capabilities = Array.isArray(def.capabilities) ? def.capabilities : [];
    const matchedTools = allTools.filter((tool) =>
      capabilities.some((cap) => hasCapabilityMatch(cap, tool.capability))
    );

    if (capabilities.length > 0 && matchedTools.length === 0) {
      diagnostics.capability_coverage.agents_with_no_tools.push({
        definition_slug: def.slug,
        tier: def.tier,
        capabilities,
      });
    }

    for (const cap of capabilities) {
      const hasMatch = allTools.some((tool) => hasCapabilityMatch(cap, tool.capability));
      if (!hasMatch) {
        diagnostics.capability_coverage.missing_capabilities.push({
          definition_slug: def.slug,
          capability: cap,
        });
      }
    }
  }

  const { data: sharedInstances, error: sharedErr } = await supabase
    .from('ai_agent_instances')
    .select('id, definition_id, is_active')
    .is('company_id', null);
  if (sharedErr) throw sharedErr;

  const sharedByDef = new Map();
  for (const row of sharedInstances || []) {
    const arr = sharedByDef.get(row.definition_id) || [];
    arr.push(row);
    sharedByDef.set(row.definition_id, arr);
  }
  for (const [definitionId, rows] of sharedByDef.entries()) {
    if (rows.length <= 1) continue;
    const def = activeDefinitions.find((d) => d.id === definitionId) || (definitions || []).find((d) => d.id === definitionId);
    const extras = rows.length - 1;
    diagnostics.shared_instance_duplicates.total_groups += 1;
    diagnostics.shared_instance_duplicates.total_extra_instances += extras;
    diagnostics.shared_instance_duplicates.groups.push({
      definition_id: definitionId,
      definition_slug: def?.slug || null,
      total_instances: rows.length,
      active_instances: rows.filter((r) => r.is_active).length,
      extra_instances: extras,
    });
  }

  const { data: companies, error: companyErr } = await supabase
    .from('companies')
    .select('id, name, subscription_plan');
  if (companyErr) throw companyErr;

  const { data: scopedInstances, error: instErr } = await supabase
    .from('ai_agent_instances')
    .select('company_id, definition_id, is_active')
    .not('company_id', 'is', null);
  if (instErr) throw instErr;

  const companyInstanceMap = new Map();
  for (const row of scopedInstances || []) {
    if (!row.company_id) continue;
    const key = row.company_id;
    const arr = companyInstanceMap.get(key) || [];
    arr.push(row);
    companyInstanceMap.set(key, arr);
  }

  for (const company of companies || []) {
    const plan = company.subscription_plan || 'free';
    const planLevel = PLAN_HIERARCHY[plan] ?? 0;
    const expected = activeDefinitions
      .filter((d) => ['general', 'customer'].includes(d.tier))
      .filter((d) => (PLAN_HIERARCHY[d.plan_minimum] ?? 0) <= planLevel)
      .filter((d) => (d.max_instances_per_company || 0) > 0);

    const companyRows = companyInstanceMap.get(company.id) || [];
    const activeIds = new Set(
      companyRows
        .filter((r) => r.is_active)
        .map((r) => r.definition_id)
    );
    const missing = expected
      .filter((d) => !activeIds.has(d.id))
      .map((d) => d.slug);

    if (missing.length > 0) {
      diagnostics.per_company_provisioning_gaps.rows.push({
        company_id: company.id,
        company_name: company.name || null,
        subscription_plan: plan,
        expected_definition_count: expected.length,
        active_instance_count: activeIds.size,
        missing_definition_slugs: missing,
      });
    }
  }

  diagnostics.per_company_provisioning_gaps.companies_with_gaps =
    diagnostics.per_company_provisioning_gaps.rows.length;

  return diagnostics;
}


module.exports = {
  executeChat,
  executeTask,
  createTask,
  assignAgentsOnSubscription,
  revokeAgentsOnDowngrade,
  runInternalAgent,
  checkExpiredSubscriptions,
  seedAgentDefinitions,
  exportTrainingData,
  getAdminHealthSnapshot,
  invalidateDefinitionCache,
};
