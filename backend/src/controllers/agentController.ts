/**
 * SolNuv AI Agent Controller
 * Handles chat, tasks, agent instances, admin management, and training export.
 */

'use strict';

const supabase = require('../config/database');
const { sendSuccess, sendError, sendPaginated } = require('../utils/responseHelper');
const logger = require('../utils/logger');
const agentService = require('../services/aiAgentService');
const aiProvider = require('../services/aiProviderService');
const { AGENT_PLAN_HIERARCHY } = require('../constants/planConstants');

// ─── USER ENDPOINTS ──────────────────────────────────────────────────────────

/**
 * POST /api/agent/chat
 * Send a message to an agent.
 * Body: { agentInstanceId, conversationId?, message, contextType?, contextResourceId? }
 */
exports.chat = async (req, res) => {
  try {
    const userId = req.user.id;
    const { agentInstanceId, conversationId, message, contextType, contextResourceId } = req.body;

    if (!agentInstanceId || !message || typeof message !== 'string') {
      return sendError(res, 'agentInstanceId and message are required', 400);
    }

    const environment = req.environment || 'test';

    const result = await agentService.executeChat({
      agentInstanceId,
      userId,
      conversationId: conversationId || null,
      message,
      contextType,
      contextResourceId,
      environment,
    });

    return sendSuccess(res, result, 'Message processed');
  } catch (err) {
    logger.error('Agent chat error', { userId: req.user?.id, message: err.message });
    if (err.message === 'Agent not found or inactive') return sendError(res, err.message, 404);
    if (err.message.includes('budget')) return sendError(res, 'AI daily token budget exhausted. Try again tomorrow.', 429);
    return sendError(res, 'Failed to process message');
  }
};

/**
 * GET /api/agent/instances
 * List all agent instances available to the current user's company.
 * Only returns company-specific instances (not shared null-company ones).
 * Filters by the user's subscription plan as a defense-in-depth layer.
 * Auto-provisions the free-tier agent for the company if no instances exist yet.
 */
exports.getInstances = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const userPlan = req.user?.companies?.subscription_plan || req.user.subscription_plan || 'free';
    const userPlanLevel = AGENT_PLAN_HIERARCHY[userPlan] ?? 0;

    let instances = [];
    let error = null;

    if (companyId) {
      const { data, error: fetchError } = await supabase
        .from('ai_agent_instances')
        .select('id, is_active, created_at, config_overrides, ai_agent_definitions(id, slug, name, description, tier, plan_minimum)')
        .eq('company_id', companyId)
        .eq('is_active', true);
      instances = data || [];
      error = fetchError;
    }

    if (error) throw error;

    // If no company-scoped instances found, auto-provision based on company plan.
    if (companyId && instances.length === 0) {
      await agentService.assignAgentsOnSubscription(companyId, userPlan);
      const { data: provisioned } = await supabase
        .from('ai_agent_instances')
        .select('id, is_active, created_at, config_overrides, ai_agent_definitions(id, slug, name, description, tier, plan_minimum)')
        .eq('company_id', companyId)
        .eq('is_active', true);
      instances = provisioned || [];
    }

    // Fallback for users without company linkage: expose the shared general assistant only.
    if (!companyId || instances.length === 0) {
      const { data: shared, error: sharedError } = await supabase
        .from('ai_agent_instances')
        .select('id, is_active, created_at, config_overrides, ai_agent_definitions(id, slug, name, description, tier, plan_minimum)')
        .is('company_id', null)
        .eq('is_active', true);
      if (sharedError) throw sharedError;
      if (!companyId) {
        instances = shared || [];
      } else {
        instances = [...instances, ...(shared || [])];
      }
    }

    return sendSuccess(res, filterUserFacingAgents(instances, userPlanLevel));
  } catch (err) {
    logger.error('Get agent instances error', { message: err.message });
    return sendError(res, 'Failed to fetch agents');
  }
};

function filterUserFacingAgents(instances, userPlanLevel) {
  const seen = new Set();
  return instances.filter(i => {
    const def = i.ai_agent_definitions;
    if (!def) return false;
    // Exclude internal agents
    if (def.tier === 'internal') return false;
    // Exclude agents above the user's plan
    const required = AGENT_PLAN_HIERARCHY[def.plan_minimum || 'free'] ?? 0;
    if (userPlanLevel < required) return false;
    // Deduplicate by definition_id (keep first occurrence)
    if (seen.has(def.id)) return false;
    seen.add(def.id);
    return true;
  });
}

/**
 * GET /api/agent/conversations
 * List conversations for the current user.
 * Query: ?agentInstanceId=&status=active&page=1&limit=20
 */
exports.getConversations = async (req, res) => {
  try {
    const userId = req.user.id;
    const { agentInstanceId, status, page = 1, limit = 20 } = req.query;
    const pg = Math.max(1, parseInt(page, 10) || 1);
    const lim = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pg - 1) * lim;

    let query = supabase
      .from('ai_conversations')
      .select('id, title, status, context_type, context_resource_id, created_at, updated_at, agent_instance_id, ai_agent_instances(ai_agent_definitions(slug, name, tier))', { count: 'exact' })
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .range(offset, offset + lim - 1);

    if (agentInstanceId) query = query.eq('agent_instance_id', agentInstanceId);
    if (status) query = query.eq('status', status);

    const { data, count, error } = await query;
    if (error) throw error;

    return sendPaginated(res, data || [], count || 0, pg, lim);
  } catch (err) {
    logger.error('Get conversations error', { message: err.message });
    return sendError(res, 'Failed to fetch conversations');
  }
};

/**
 * GET /api/agent/conversations/:id/messages
 * Get messages for a specific conversation (owned by user).
 * Query: ?page=1&limit=50
 */
exports.getMessages = async (req, res) => {
  try {
    const userId = req.user.id;
    const conversationId = req.params.id;
    const { page = 1, limit = 50 } = req.query;
    const pg = Math.max(1, parseInt(page, 10) || 1);
    const lim = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const offset = (pg - 1) * lim;

    // Verify ownership
    const { data: conv } = await supabase
      .from('ai_conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('user_id', userId)
      .single();

    if (!conv) return sendError(res, 'Conversation not found', 404);

    const { data, count, error } = await supabase
      .from('ai_messages')
      .select('id, role, content, tool_name, tool_input, tool_output, tokens_used, latency_ms, created_at', { count: 'exact' })
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .range(offset, offset + lim - 1);

    if (error) throw error;
    return sendPaginated(res, data || [], count || 0, pg, lim);
  } catch (err) {
    logger.error('Get messages error', { message: err.message });
    return sendError(res, 'Failed to fetch messages');
  }
};

/**
 * PATCH /api/agent/conversations/:id/close
 * Close a conversation.
 */
exports.closeConversation = async (req, res) => {
  try {
    const userId = req.user.id;
    const conversationId = req.params.id;

    const { data, error } = await supabase
      .from('ai_conversations')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('id', conversationId)
      .eq('user_id', userId)
      .select('id, status')
      .single();

    if (error || !data) return sendError(res, 'Conversation not found', 404);
    return sendSuccess(res, data, 'Conversation closed');
  } catch (err) {
    logger.error('Close conversation error', { message: err.message });
    return sendError(res, 'Failed to close conversation');
  }
};

/**
 * POST /api/agent/tasks
 * Create an async agent task.
 * Body: { agentInstanceId, taskType, inputPayload }
 */
exports.createTask = async (req, res) => {
  try {
    const userId = req.user.id;
    const { agentInstanceId, taskType, inputPayload } = req.body;

    if (!agentInstanceId || !taskType) {
      return sendError(res, 'agentInstanceId and taskType are required', 400);
    }

    const environment = req.environment || 'test';
    const task = await agentService.createTask({
      agentInstanceId,
      taskType,
      inputPayload: inputPayload || {},
      createdBy: userId,
      environment,
      processNow: true,
    });

    return sendSuccess(res, task, 'Task created', 201);
  } catch (err) {
    logger.error('Create agent task error', { message: err.message });
    return sendError(res, 'Failed to create task');
  }
};

/**
 * GET /api/agent/tasks
 * List tasks for the current user.
 * Query: ?status=&page=1&limit=20
 */
exports.getTasks = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, page = 1, limit = 20 } = req.query;
    const pg = Math.max(1, parseInt(page, 10) || 1);
    const lim = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pg - 1) * lim;

    let query = supabase
      .from('ai_tasks')
      .select('id, task_type, status, priority, retries, tokens_used, created_at, started_at, completed_at, agent_instance_id, ai_agent_instances(ai_agent_definitions(slug, name))', { count: 'exact' })
      .eq('created_by', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + lim - 1);

    if (status) query = query.eq('status', status);

    const { data, count, error } = await query;
    if (error) throw error;

    return sendPaginated(res, data || [], count || 0, pg, lim);
  } catch (err) {
    logger.error('Get tasks error', { message: err.message });
    return sendError(res, 'Failed to fetch tasks');
  }
};

/**
 * GET /api/agent/tasks/:id
 * Get a single task with its output (owned by user).
 */
exports.getTaskDetail = async (req, res) => {
  try {
    const userId = req.user.id;
    const taskId = req.params.id;

    const { data, error } = await supabase
      .from('ai_tasks')
      .select('*, ai_agent_instances(ai_agent_definitions(slug, name, tier))')
      .eq('id', taskId)
      .eq('created_by', userId)
      .single();

    if (error || !data) return sendError(res, 'Task not found', 404);
    return sendSuccess(res, data);
  } catch (err) {
    logger.error('Get task detail error', { message: err.message });
    return sendError(res, 'Failed to fetch task');
  }
};


// ─── ADMIN ENDPOINTS ─────────────────────────────────────────────────────────

/**
 * GET /api/agent/admin/definitions
 * List all agent definitions (super_admin only).
 */
exports.adminGetDefinitions = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('ai_agent_definitions')
      .select('*')
      .order('tier', { ascending: true })
      .order('name', { ascending: true });

    if (error) throw error;
    return sendSuccess(res, data || []);
  } catch (err) {
    logger.error('Admin get definitions error', { message: err.message });
    return sendError(res, 'Failed to fetch agent definitions');
  }
};

/**
 * GET /api/agent/admin/definitions/:id
 * Get a single agent definition with full details (super_admin only).
 */
exports.adminGetDefinition = async (req, res) => {
  try {
    const defId = req.params.id;
    const { data, error } = await supabase
      .from('ai_agent_definitions')
      .select('*')
      .eq('id', defId)
      .single();

    if (error || !data) return sendError(res, 'Definition not found', 404);
    return sendSuccess(res, data);
  } catch (err) {
    logger.error('Admin get definition error', { message: err.message });
    return sendError(res, 'Failed to fetch agent definition');
  }
};

/**
 * PATCH /api/agent/admin/definitions/:id
 * Update an agent definition (super_admin only).
 * Body: { name?, description?, system_prompt?, custom_instructions?, capabilities?, temperature?, is_active?, ... }
 */
exports.adminUpdateDefinition = async (req, res) => {
  try {
    const defId = req.params.id;
    const allowed = [
      'name', 'description', 'system_prompt', 'custom_instructions',
      'capabilities', 'provider_slug', 'fallback_provider_slug', 'plan_minimum',
      'max_instances_per_company', 'max_tokens_per_task', 'temperature',
      'response_format', 'is_active',
    ];
    const updates: Record<string, any> = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (Object.keys(updates).length === 0) return sendError(res, 'No valid fields to update', 400);

    // Bump version on prompt/instruction/knowledge changes
    const versionBumpFields = ['system_prompt', 'custom_instructions', 'capabilities'];
    const needsBump = versionBumpFields.some(f => updates[f] !== undefined);

    if (needsBump) {
      const { data: current } = await supabase.from('ai_agent_definitions').select('version').eq('id', defId).single();
      updates.version = (current?.version || 0) + 1;
    }
    updates.updated_by = req.user?.id || null;

    const { data, error } = await supabase
      .from('ai_agent_definitions')
      .update(updates)
      .eq('id', defId)
      .select('id, slug, name, tier, is_active, version')
      .single();

    if (error || !data) return sendError(res, 'Definition not found', 404);

    // Invalidate agent definition cache
    agentService.invalidateDefinitionCache(defId);

    return sendSuccess(res, data, 'Definition updated');
  } catch (err) {
    logger.error('Admin update definition error', { message: err.message });
    return sendError(res, 'Failed to update definition');
  }
};

/**
 * POST /api/agent/admin/definitions/:id/knowledge
 * Add a knowledge document to an agent definition.
 * Body: { title, content }
 */
exports.adminAddKnowledge = async (req, res) => {
  try {
    const defId = req.params.id;
    const { title, content } = req.body;

    if (!title || !content) return sendError(res, 'title and content are required', 400);
    if (content.length > 50000) return sendError(res, 'Knowledge document too large (max 50,000 chars)', 400);

    // Load current definition
    const { data: def, error: defErr } = await supabase
      .from('ai_agent_definitions')
      .select('knowledge_base, version')
      .eq('id', defId)
      .single();

    if (defErr || !def) return sendError(res, 'Definition not found', 404);

    const knowledge = Array.isArray(def.knowledge_base) ? [...def.knowledge_base] : [];

    // Check for duplicates by title
    if (knowledge.some(k => k.title === title)) {
      return sendError(res, 'A knowledge document with this title already exists', 409);
    }

    const doc = {
      id: require('crypto').randomUUID(),
      title: title.slice(0, 200),
      content: content,
      added_at: new Date().toISOString(),
      added_by: req.user?.email || 'admin',
    };

    knowledge.push(doc);

    const { error } = await supabase
      .from('ai_agent_definitions')
      .update({
        knowledge_base: knowledge,
        version: (def.version || 0) + 1,
        updated_by: req.user?.id || null,
      })
      .eq('id', defId);

    if (error) throw error;

    agentService.invalidateDefinitionCache(defId);

    return sendSuccess(res, doc, 'Knowledge document added', 201);
  } catch (err) {
    logger.error('Admin add knowledge error', { message: err.message });
    return sendError(res, 'Failed to add knowledge');
  }
};

/**
 * DELETE /api/agent/admin/definitions/:id/knowledge/:docId
 * Remove a knowledge document from an agent definition.
 */
exports.adminRemoveKnowledge = async (req, res) => {
  try {
    const defId = req.params.id;
    const docId = req.params.docId;

    const { data: def, error: defErr } = await supabase
      .from('ai_agent_definitions')
      .select('knowledge_base, version')
      .eq('id', defId)
      .single();

    if (defErr || !def) return sendError(res, 'Definition not found', 404);

    const knowledge = Array.isArray(def.knowledge_base) ? def.knowledge_base : [];
    const filtered = knowledge.filter(k => k.id !== docId);

    if (filtered.length === knowledge.length) {
      return sendError(res, 'Knowledge document not found', 404);
    }

    const { error } = await supabase
      .from('ai_agent_definitions')
      .update({
        knowledge_base: filtered,
        version: (def.version || 0) + 1,
        updated_by: req.user?.id || null,
      })
      .eq('id', defId);

    if (error) throw error;

    agentService.invalidateDefinitionCache(defId);

    return sendSuccess(res, null, 'Knowledge document removed');
  } catch (err) {
    logger.error('Admin remove knowledge error', { message: err.message });
    return sendError(res, 'Failed to remove knowledge');
  }
};

/**
 * PUT /api/agent/admin/definitions/:id/knowledge/:docId
 * Update a knowledge document.
 * Body: { title?, content? }
 */
exports.adminUpdateKnowledge = async (req, res) => {
  try {
    const defId = req.params.id;
    const docId = req.params.docId;
    const { title, content } = req.body;

    if (!title && !content) return sendError(res, 'title or content required', 400);
    if (content && content.length > 50000) return sendError(res, 'Knowledge document too large (max 50,000 chars)', 400);

    const { data: def, error: defErr } = await supabase
      .from('ai_agent_definitions')
      .select('knowledge_base, version')
      .eq('id', defId)
      .single();

    if (defErr || !def) return sendError(res, 'Definition not found', 404);

    const knowledge = Array.isArray(def.knowledge_base) ? [...def.knowledge_base] : [];
    const idx = knowledge.findIndex(k => k.id === docId);
    if (idx === -1) return sendError(res, 'Knowledge document not found', 404);

    if (title) knowledge[idx].title = title.slice(0, 200);
    if (content) knowledge[idx].content = content;
    knowledge[idx].updated_at = new Date().toISOString();

    const { error } = await supabase
      .from('ai_agent_definitions')
      .update({
        knowledge_base: knowledge,
        version: (def.version || 0) + 1,
        updated_by: req.user?.id || null,
      })
      .eq('id', defId);

    if (error) throw error;

    agentService.invalidateDefinitionCache(defId);

    return sendSuccess(res, knowledge[idx], 'Knowledge document updated');
  } catch (err) {
    logger.error('Admin update knowledge error', { message: err.message });
    return sendError(res, 'Failed to update knowledge');
  }
};

/**
 * POST /api/agent/admin/assign
 * Manually assign agents to a company.
 * Body: { companyId, plan }
 */
exports.adminAssignAgents = async (req, res) => {
  try {
    const { companyId, plan } = req.body;
    if (!companyId || !plan) return sendError(res, 'companyId and plan are required', 400);

    await agentService.assignAgentsOnSubscription(companyId, plan);
    return sendSuccess(res, null, `Agents assigned for plan "${plan}"`);
  } catch (err) {
    logger.error('Admin assign agents error', { message: err.message });
    return sendError(res, 'Failed to assign agents');
  }
};

/**
 * POST /api/agent/admin/revoke
 * Manually revoke agents from a company.
 * Body: { companyId, newPlan }
 */
exports.adminRevokeAgents = async (req, res) => {
  try {
    const { companyId, newPlan } = req.body;
    if (!companyId) return sendError(res, 'companyId is required', 400);

    await agentService.revokeAgentsOnDowngrade(companyId, newPlan || 'free');
    return sendSuccess(res, null, 'Agents revoked');
  } catch (err) {
    logger.error('Admin revoke agents error', { message: err.message });
    return sendError(res, 'Failed to revoke agents');
  }
};

/**
 * GET /api/agent/admin/instances
 * List all agent instances across companies (super_admin).
 * Query: ?companyId=&tier=&page=1&limit=50
 */
exports.adminGetInstances = async (req, res) => {
  try {
    const { companyId, tier, page = 1, limit = 50 } = req.query;
    const pg = Math.max(1, parseInt(page, 10) || 1);
    const lim = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const offset = (pg - 1) * lim;

    let query = supabase
      .from('ai_agent_instances')
      .select('id, company_id, is_active, created_at, companies(name, subscription_plan), ai_agent_definitions(id, slug, name, tier, plan_minimum)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + lim - 1);

    if (companyId) query = query.eq('company_id', companyId);

    const { data, count, error } = await query;
    if (error) throw error;

    let filtered = data || [];
    if (tier) {
      filtered = filtered.filter(i => i.ai_agent_definitions?.tier === tier);
    }

    return sendPaginated(res, filtered, count || 0, pg, lim);
  } catch (err) {
    logger.error('Admin get instances error', { message: err.message });
    return sendError(res, 'Failed to fetch instances');
  }
};

/**
 * GET /api/agent/admin/tasks
 * Admin task queue view.
 * Query: ?status=&agentSlug=&page=1&limit=50
 */
exports.adminGetTasks = async (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const pg = Math.max(1, parseInt(page, 10) || 1);
    const lim = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const offset = (pg - 1) * lim;

    let query = supabase
      .from('ai_tasks')
      .select('id, task_type, status, priority, retries, tokens_used, error_message, created_at, completed_at, agent_instance_id, ai_agent_instances(ai_agent_definitions(slug, name, tier))', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + lim - 1);

    if (status) query = query.eq('status', status);

    const { data, count, error } = await query;
    if (error) throw error;

    return sendPaginated(res, data || [], count || 0, pg, lim);
  } catch (err) {
    logger.error('Admin get tasks error', { message: err.message });
    return sendError(res, 'Failed to fetch tasks');
  }
};

/**
 * GET /api/agent/admin/escalations
 * List escalations.
 * Query: ?status=open&severity=&page=1&limit=50
 */
exports.adminGetEscalations = async (req, res) => {
  try {
    const { status, severity, page = 1, limit = 50 } = req.query;
    const pg = Math.max(1, parseInt(page, 10) || 1);
    const lim = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const offset = (pg - 1) * lim;

    let query = supabase
      .from('ai_escalations')
      .select('*, ai_agent_instances(ai_agent_definitions(slug, name))', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + lim - 1);

    if (status) query = query.eq('status', status);
    if (severity) query = query.eq('severity', severity);

    const { data, count, error } = await query;
    if (error) throw error;

    return sendPaginated(res, data || [], count || 0, pg, lim);
  } catch (err) {
    logger.error('Admin get escalations error', { message: err.message });
    return sendError(res, 'Failed to fetch escalations');
  }
};

/**
 * PATCH /api/agent/admin/escalations/:id
 * Resolve an escalation.
 * Body: { status, resolution_notes }
 */
exports.adminResolveEscalation = async (req, res) => {
  try {
    const escId = req.params.id;
    const { status, resolution_notes } = req.body;

    if (!status) return sendError(res, 'status is required', 400);

    const { data, error } = await supabase
      .from('ai_escalations')
      .update({
        status,
        resolution_notes: resolution_notes || null,
        resolved_by: req.adminUser?.id || null,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', escId)
      .select('id, status, resolved_at')
      .single();

    if (error || !data) return sendError(res, 'Escalation not found', 404);
    return sendSuccess(res, data, 'Escalation updated');
  } catch (err) {
    logger.error('Admin resolve escalation error', { message: err.message });
    return sendError(res, 'Failed to resolve escalation');
  }
};

/**
 * GET /api/agent/admin/usage
 * Token usage dashboard.
 * Query: ?dateFrom=&dateTo=
 */
exports.adminGetUsage = async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;
    const summary = await aiProvider.getUsageSummary(dateFrom || null, dateTo || null);
    return sendSuccess(res, summary);
  } catch (err) {
    logger.error('Admin get usage error', { message: err.message });
    return sendError(res, 'Failed to fetch usage data');
  }
};

/**
 * GET /api/agent/admin/training-export
 * Export conversation data as JSONL for model training.
 * Query: ?dateFrom=&dateTo=&tier=&status=completed
 */
exports.adminExportTraining = async (req, res) => {
  try {
    const { dateFrom, dateTo, tier, status } = req.query;

    const jsonl = await agentService.exportTrainingData({
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      tier: tier || undefined,
      status: status || 'completed',
    });

    res.setHeader('Content-Type', 'application/jsonl');
    res.setHeader('Content-Disposition', `attachment; filename="solnuv-training-${Date.now()}.jsonl"`);
    return res.send(jsonl);
  } catch (err) {
    logger.error('Admin export training error', { message: err.message });
    return sendError(res, 'Failed to export training data');
  }
};

/**
 * GET /api/agent/admin/health
 * Quick AI health diagnostics for definitions, shared instance duplicates,
 * and per-company provisioning gaps.
 */
exports.adminHealth = async (req, res) => {
  try {
    const snapshot = await agentService.getAdminHealthSnapshot();
    return sendSuccess(res, snapshot);
  } catch (err) {
    logger.error('Admin AI health error', { message: err.message });
    return sendError(res, 'Failed to fetch AI diagnostics');
  }
};

/**
 * POST /api/agent/admin/seed
 * Re-seed agent definitions (idempotent).
 */
exports.adminSeedDefinitions = async (req, res) => {
  try {
    const result = await agentService.seedAgentDefinitions();
    return sendSuccess(res, result, 'Agent definitions seeded');
  } catch (err) {
    logger.error('Admin seed error', { message: err.message });
    return sendError(res, 'Failed to seed definitions');
  }
};

/**
 * POST /api/agent/admin/run-blog-writer
 * Run the SEO Blog Writer agent from the admin blog page.
 * Body: { prompt, mode: 'create'|'edit', postId? }
 * Returns the generated blog post payload from the agent.
 */
exports.adminRunBlogWriter = async (req, res) => {
  try {
    const userId = req.user.id;
    const { prompt, mode = 'create', postId } = req.body;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 3) {
      return sendError(res, 'A prompt is required (minimum 3 characters)', 400);
    }

    // Resolve definition first, then fetch the canonical shared instance.
    let agentInstanceId;
    const { data: def } = await supabase
      .from('ai_agent_definitions')
      .select('id, slug')
      .eq('slug', 'seo-blog-writer')
      .eq('is_active', true)
      .single();

    if (!def) {
      return sendError(res, 'SEO Blog Writer agent not found. Run agent seed first.', 404);
    }

    const { data: inst } = await supabase
      .from('ai_agent_instances')
      .select('id')
      .eq('definition_id', def.id)
      .eq('is_active', true)
      .is('company_id', null)
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (!inst) {
      return sendError(res, 'SEO Blog Writer agent instance not found. Run agent seed first.', 404);
    }
    agentInstanceId = inst.id;

    // Build user message based on mode
    let message;
    if (mode === 'edit' && postId) {
      const { data: existingPost } = await supabase
        .from('blog_posts')
        .select('title, content, excerpt, category, tags')
        .eq('id', postId)
        .single();

      message = existingPost
        ? `Update this existing blog post based on the following instructions:\n\nEXISTING POST:\nTitle: ${existingPost.title}\nExcerpt: ${existingPost.excerpt}\nCategory: ${existingPost.category}\nTags: ${(existingPost.tags || []).join(', ')}\nContent (first 2000 chars): ${String(existingPost.content).slice(0, 2000)}\n\nINSTRUCTIONS: ${prompt.trim()}`
        : `Create a new blog post about: ${prompt.trim()}`;
    } else {
      message = `Create a new blog post about: ${prompt.trim()}`;
    }

    // Execute via the chat system (synchronous — admin waits for result)
    const result = await agentService.executeChat({
      agentInstanceId,
      userId,
      conversationId: null,
      message,
      contextType: 'blog',
      environment: req.environment || 'live',
    });

    // Try to parse the AI response as JSON
    let parsed = null;
    try {
      // Strip markdown code fences if present
      let raw = result.response || '';
      raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      parsed = JSON.parse(raw);
    } catch {
      // If not valid JSON, return raw text so admin can still use it
      parsed = { content: result.response || '' };
    }

    return sendSuccess(res, {
      generated: parsed,
      tokensUsed: result.tokensUsed,
      conversationId: result.conversationId,
    }, 'Blog content generated');
  } catch (err) {
    logger.error('Admin run blog writer error', { message: err.message });
    return sendError(res, err.message || 'Failed to generate blog content');
  }
};
