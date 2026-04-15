/**
 * SolNuv AI Tool Registry
 * Secure tool execution layer for AI agents.
 * Every tool: validates input → checks capability → scopes to company → executes → audits.
 * Tools reuse existing service/controller logic — zero duplicate business logic.
 */

'use strict';

const supabase = require('../config/database');
const logger   = require('../utils/logger');

// ─── TOOL DEFINITIONS ────────────────────────────────────────────────────────
// Each tool has:
//   name, description (for LLM), capability (checked against agent definition),
//   inputSchema (for validation), handler (the actual function)

const TOOL_DEFINITIONS = {};

function defineTool(name, capability, description, inputSchema, handler) {
  TOOL_DEFINITIONS[name] = { name, capability, description, inputSchema, handler };
}

// ─── INPUT VALIDATION ────────────────────────────────────────────────────────

function validateInput(input, schema) {
  if (!schema || !schema.required) return { valid: true };
  for (const field of schema.required) {
    if (input[field] === undefined || input[field] === null) {
      return { valid: false, error: `Missing required field: ${field}` };
    }
  }
  return { valid: true };
}

function fireAndForget(operation, label) {
  Promise.resolve(operation).catch((err) => {
    logger.warn(`AI tool background operation failed: ${label}`, { message: err?.message });
  });
}

// ─── PROJECT TOOLS ───────────────────────────────────────────────────────────

defineTool('list_projects', 'projects.read',
  'List solar projects for the company. Supports filtering by status.',
  { required: [], optional: ['status', 'limit'] },
  async (input, context) => {
    let query = supabase
      .from('projects')
      .select('id, name, status, state, city, installation_date, capacity_kw, capacity_category, created_at')
      .eq('company_id', context.companyId)
      .order('created_at', { ascending: false })
      .limit(input.limit || 20);

    if (input.status) query = query.eq('status', input.status);

    const { data, error } = await query;
    if (error) throw error;
    return { projects: data || [], count: (data || []).length };
  }
);

defineTool('get_project_detail', 'projects.read',
  'Get full details of a specific project including equipment.',
  { required: ['project_id'] },
  async (input, context) => {
    const { data, error } = await supabase
      .from('projects')
      .select('*, equipment(*)')
      .eq('id', input.project_id)
      .eq('company_id', context.companyId)
      .single();

    if (error || !data) return { error: 'Project not found or access denied' };
    return data;
  }
);

defineTool('create_project', 'projects.write',
  'Create a new solar project with basic details. Equipment can be added separately.',
  { required: ['name', 'state'], optional: ['city', 'address', 'installation_date', 'latitude', 'longitude', 'notes'] },
  async (input, context) => {
    const { v4: uuidv4 } = require('uuid');
    const qrCode = `SNV-${uuidv4().split('-')[0].toUpperCase()}`;

    const payload = {
      name: String(input.name).slice(0, 200),
      state: String(input.state).slice(0, 100),
      city: input.city ? String(input.city).slice(0, 100) : null,
      address: input.address ? String(input.address).slice(0, 500) : null,
      installation_date: input.installation_date || null,
      latitude: input.latitude || null,
      longitude: input.longitude || null,
      notes: input.notes ? String(input.notes).slice(0, 2000) : null,
      user_id: context.userId,
      company_id: context.companyId,
      status: 'draft',
      qr_code: qrCode,
    };

    const { data, error } = await supabase
      .from('projects')
      .insert(payload)
      .select('id, name, status, qr_code')
      .single();

    if (error) throw error;
    return { created: true, project: data };
  }
);

defineTool('update_project', 'projects.write',
  'Update an existing project (only draft/maintenance projects can be edited).',
  { required: ['project_id'], optional: ['name', 'city', 'address', 'notes', 'installation_date'] },
  async (input, context) => {
    const EDITABLE_STAGES = ['draft', 'maintenance'];
    const { data: existing } = await supabase
      .from('projects')
      .select('id, status')
      .eq('id', input.project_id)
      .eq('company_id', context.companyId)
      .single();

    if (!existing) return { error: 'Project not found or access denied' };
    if (!EDITABLE_STAGES.includes(existing.status)) {
      return { error: `Project in "${existing.status}" stage cannot be edited. Only draft/maintenance projects are editable.` };
    }

    const updates: Record<string, any> = {};
    if (input.name) updates.name = String(input.name).slice(0, 200);
    if (input.city) updates.city = String(input.city).slice(0, 100);
    if (input.address) updates.address = String(input.address).slice(0, 500);
    if (input.notes) updates.notes = String(input.notes).slice(0, 2000);
    if (input.installation_date) updates.installation_date = input.installation_date;

    if (Object.keys(updates).length === 0) return { error: 'No fields to update' };

    const { data, error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', input.project_id)
      .select('id, name, status')
      .single();

    if (error) throw error;
    return { updated: true, project: data };
  }
);

defineTool('update_project_status', 'projects.write',
  'Update a project\'s status (e.g. draft→active, active→maintenance).',
  { required: ['project_id', 'new_status'] },
  async (input, context) => {
    const VALID_TRANSITIONS = {
      draft: ['active'],
      active: ['maintenance', 'pending_recovery'],
      maintenance: ['active', 'pending_recovery'],
    };
    const { data: project } = await supabase
      .from('projects')
      .select('id, status')
      .eq('id', input.project_id)
      .eq('company_id', context.companyId)
      .single();

    if (!project) return { error: 'Project not found or access denied' };
    const allowed = VALID_TRANSITIONS[project.status] || [];
    if (!allowed.includes(input.new_status)) {
      return { error: `Cannot transition from "${project.status}" to "${input.new_status}". Allowed: ${allowed.join(', ') || 'none'}` };
    }

    const { data, error } = await supabase
      .from('projects')
      .update({ status: input.new_status })
      .eq('id', input.project_id)
      .select('id, name, status')
      .single();

    if (error) throw error;
    return { updated: true, project: data };
  }
);

// ─── FINANCIAL TOOLS ─────────────────────────────────────────────────────────

defineTool('get_silver_price', 'financial.read',
  'Get the current silver price per gram in NGN and USD.',
  { required: [] },
  async () => {
    const { getSilverPrice } = require('./silverService');
    return getSilverPrice();
  }
);

defineTool('calculate_portfolio_value', 'financial.read',
  'Calculate total silver recovery and recycling value for all company projects.',
  { required: [] },
  async (_input, context) => {
    const { data: projects } = await supabase
      .from('projects')
      .select('id, name, status, equipment(equipment_type, quantity, estimated_silver_grams)')
      .eq('company_id', context.companyId);

    let totalSilverGrams = 0;
    let totalPanels = 0;
    let totalBatteries = 0;

    for (const proj of projects || []) {
      for (const eq of proj.equipment || []) {
        if (eq.equipment_type === 'panel') {
          totalPanels += eq.quantity || 0;
          totalSilverGrams += eq.estimated_silver_grams || 0;
        } else {
          totalBatteries += eq.quantity || 0;
        }
      }
    }

    const { getSilverPrice } = require('./silverService');
    const price = await getSilverPrice();
    const valueNgn = totalSilverGrams * (price.price_per_gram_ngn || 0);

    return {
      total_projects: (projects || []).length,
      total_panels: totalPanels,
      total_batteries: totalBatteries,
      total_silver_grams: Math.round(totalSilverGrams * 100) / 100,
      estimated_value_ngn: Math.round(valueNgn),
      silver_price_ngn_per_gram: price.price_per_gram_ngn,
    };
  }
);

// ─── REPORT TOOLS ────────────────────────────────────────────────────────────

defineTool('get_report_history', 'reports.read',
  'Get history of NESREA reports generated by the company.',
  { required: [] },
  async (_input, context) => {
    const { data, error } = await supabase
      .from('nesrea_reports')
      .select('id, report_period_start, report_period_end, total_panels, total_batteries, total_silver_grams, sent_to_nesrea, created_at')
      .eq('company_id', context.companyId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) throw error;
    return { reports: data || [] };
  }
);

defineTool('generate_nesrea_data', 'reports.write',
  'Compile data for a NESREA EPR compliance report for a given date range.',
  { required: [], optional: ['period_start', 'period_end'] },
  async (input, context) => {
    const startDate = input.period_start || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
    const endDate = input.period_end || new Date().toISOString().split('T')[0];

    const { data: projects } = await supabase
      .from('projects')
      .select('*, equipment(*)')
      .eq('company_id', context.companyId)
      .gte('installation_date', startDate)
      .lte('installation_date', endDate);

    if (!projects || projects.length === 0) {
      return { error: 'No projects found in the selected period.' };
    }

    let totalPanels = 0, totalBatteries = 0, totalSilverGrams = 0;
    for (const proj of projects) {
      for (const eq of proj.equipment || []) {
        if (eq.equipment_type === 'panel') {
          totalPanels += eq.quantity;
          totalSilverGrams += eq.estimated_silver_grams || 0;
        } else {
          totalBatteries += eq.quantity;
        }
      }
    }

    return {
      period_start: startDate,
      period_end: endDate,
      project_count: projects.length,
      total_panels: totalPanels,
      total_batteries: totalBatteries,
      total_silver_grams: Math.round(totalSilverGrams * 100) / 100,
      projects_summary: projects.map(p => ({
        name: p.name, status: p.status, state: p.state, city: p.city,
        panels: (p.equipment || []).filter(e => e.equipment_type === 'panel').reduce((s, e) => s + e.quantity, 0),
        batteries: (p.equipment || []).filter(e => e.equipment_type !== 'panel').reduce((s, e) => s + e.quantity, 0),
      })),
    };
  }
);

// ─── NOTIFICATION / ESCALATION TOOLS ─────────────────────────────────────────

defineTool('escalate_to_admin', 'notify.escalate',
  'Escalate a user issue or challenge to the admin team for human attention.',
  { required: ['reason'], optional: ['severity'] },
  async (input, context) => {
    const severity = ['low', 'medium', 'high', 'critical'].includes(input.severity) ? input.severity : 'medium';

    const { data, error } = await supabase
      .from('ai_escalations')
      .insert({
        conversation_id: context.conversationId || null,
        task_id: context.taskId || null,
        agent_instance_id: context.agentInstanceId,
        user_id: context.userId || null,
        reason: String(input.reason).slice(0, 2000),
        severity,
        environment: context.environment || 'test',
      })
      .select('id, severity, status')
      .single();

    if (error) throw error;

    // Also insert an admin notification
    fireAndForget(
      supabase.from('notifications').insert({
        user_id: context.userId,
        type: 'system',
        title: `AI Escalation (${severity})`,
        message: String(input.reason).slice(0, 500),
        data: { escalation_id: data.id, agent_instance_id: context.agentInstanceId },
      }),
      'escalation_notification'
    );

    return { escalated: true, escalation_id: data.id, severity };
  }
);

// ─── BLOG TOOLS (Internal agents only) ──────────────────────────────────────

defineTool('create_blog_draft', 'blog.write',
  'Create a new blog post draft for admin review.',
  { required: ['title', 'content', 'excerpt'], optional: ['category', 'tags', 'read_time_mins'] },
  async (input, context) => {
    const slug = String(input.title)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 100)
      + '-' + Date.now().toString(36);

    const { data, error } = await supabase
      .from('blog_posts')
      .insert({
        title: String(input.title).slice(0, 300),
        slug,
        content: String(input.content).slice(0, 50000),
        excerpt: String(input.excerpt).slice(0, 500),
        category: input.category || 'solar-industry',
        tags: Array.isArray(input.tags) ? input.tags.slice(0, 10) : [],
        read_time_mins: input.read_time_mins || 5,
        status: 'draft',
        author_id: context.userId || null,
      })
      .select('id, slug, title, status')
      .single();

    if (error) throw error;
    return { created: true, post: data };
  }
);

defineTool('list_blog_posts', 'blog.read',
  'List existing blog posts for context (to avoid duplicate topics).',
  { required: [], optional: ['limit', 'status'] },
  async (input) => {
    let query = supabase
      .from('blog_posts')
      .select('id, slug, title, category, tags, published_at, status')
      .order('created_at', { ascending: false })
      .limit(input.limit || 20);

    if (input.status) query = query.eq('status', input.status);

    const { data, error } = await query;
    if (error) throw error;
    return { posts: data || [] };
  }
);

defineTool('publish_blog_post', 'blog.write',
  'Publish a blog post draft (sets status to published). Only call after confirming the draft is ready.',
  { required: ['post_id'], optional: [] },
  async (input) => {
    const { data, error } = await supabase
      .from('blog_posts')
      .update({ status: 'published', published_at: new Date().toISOString() })
      .eq('id', String(input.post_id))
      .eq('status', 'draft') // safety: only allow publishing drafts
      .select('id, slug, title, status, published_at')
      .single();

    if (error) throw error;
    if (!data) return { published: false, reason: 'Post not found or not in draft status' };
    return { published: true, post: data };
  }
);

defineTool('update_blog_post', 'blog.write',
  'Update the content or metadata of an existing blog post (draft or published).',
  { required: ['post_id'], optional: ['title', 'content', 'excerpt', 'category', 'tags', 'read_time_mins'] },
  async (input) => {
    const updates: Record<string, any> = {};
    if (input.title)         updates.title         = String(input.title).slice(0, 300);
    if (input.content)       updates.content       = String(input.content).slice(0, 50000);
    if (input.excerpt)       updates.excerpt       = String(input.excerpt).slice(0, 500);
    if (input.category)      updates.category      = String(input.category);
    if (Array.isArray(input.tags)) updates.tags    = input.tags.slice(0, 10);
    if (input.read_time_mins) updates.read_time_mins = input.read_time_mins;

    if (Object.keys(updates).length === 0) return { updated: false, reason: 'No fields provided to update' };
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('blog_posts')
      .update(updates)
      .eq('id', String(input.post_id))
      .select('id, slug, title, status')
      .single();

    if (error) throw error;
    if (!data) return { updated: false, reason: 'Post not found' };
    return { updated: true, post: data };
  }
);

// ─── ANALYTICS TOOLS (Internal agents only) ──────────────────────────────────

defineTool('query_user_behaviour', 'analytics.read',
  'Aggregate user behaviour data: calculator usage, page views, feature adoption.',
  { required: [], optional: ['days'] },
  async (input) => {
    const days = Math.min(input.days || 30, 90);
    const since = new Date(Date.now() - days * 86400000).toISOString();

    const [calcUsage, pageViews, userCount] = await Promise.all([
      supabase.from('calculator_usage').select('calc_type, use_count').gte('last_used_at', since),
      supabase.from('page_views').select('path, session_id').gte('viewed_at', since).limit(5000),
      supabase.from('users').select('*', { count: 'exact', head: true }).gte('created_at', since),
    ]);

    // Aggregate calculator usage by type
    const calcByType = {};
    for (const row of calcUsage.data || []) {
      calcByType[row.calc_type] = (calcByType[row.calc_type] || 0) + row.use_count;
    }

    // Aggregate top pages
    const pageCount = {};
    for (const pv of pageViews.data || []) {
      pageCount[pv.path] = (pageCount[pv.path] || 0) + 1;
    }
    const topPages = Object.entries(pageCount)
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .slice(0, 15)
      .map(([path, count]) => ({ path, views: count }));

    return {
      period_days: days,
      new_users: userCount.count || 0,
      calculator_usage_by_type: calcByType,
      top_pages: topPages,
      unique_sessions: new Set((pageViews.data || []).map(p => p.session_id)).size,
    };
  }
);

defineTool('query_platform_metrics', 'analytics.read',
  'Get high-level platform metrics: users, revenue, subscriptions, projects.',
  { required: [] },
  async () => {
    const nowIso = new Date().toISOString();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

    const [users, companies, projects, activeSubs, revenue] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('companies').select('*', { count: 'exact', head: true }),
      supabase.from('projects').select('*', { count: 'exact', head: true }),
      supabase.from('companies').select('*', { count: 'exact', head: true }).gte('subscription_expires_at', nowIso),
      supabase.from('subscription_transactions').select('amount_ngn').gte('paid_at', thirtyDaysAgo),
    ]);

    const revenue30d = (revenue.data || []).reduce((sum, tx) => sum + Number(tx.amount_ngn || 0), 0);

    return {
      total_users: users.count || 0,
      total_companies: companies.count || 0,
      total_projects: projects.count || 0,
      active_subscriptions: activeSubs.count || 0,
      revenue_30d_ngn: revenue30d,
    };
  }
);

defineTool('query_audit_logs', 'analytics.security',
  'Read recent platform activity logs for security anomaly detection.',
  { required: [], optional: ['hours', 'action_filter'] },
  async (input) => {
    const hours = Math.min(input.hours || 24, 168); // max 7 days
    const since = new Date(Date.now() - hours * 3600000).toISOString();

    let query = supabase
      .from('platform_activity_logs')
      .select('action, actor_email, resource_type, details, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(200);

    if (input.action_filter) {
      query = query.ilike('action', `%${input.action_filter}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return { logs: data || [], period_hours: hours };
  }
);

// ─── DATA TOOLS (Internal agents only) ──────────────────────────────────────

defineTool('read_technology_constants', 'data.read',
  'Read current panel technology and battery chemistry reference data.',
  { required: [] },
  async () => {
    const { PANEL_TECHNOLOGIES, BATTERY_CHEMISTRIES } = require('../constants/technologyConstants');
    return {
      panel_technologies: Object.keys(PANEL_TECHNOLOGIES).map(key => ({
        key,
        name: PANEL_TECHNOLOGIES[key].label,
        degradation_rate: PANEL_TECHNOLOGIES[key].annual_degradation_pct,
        silver_mg_per_wp: PANEL_TECHNOLOGIES[key].silver_mg_per_wp,
      })),
      battery_chemistries: Object.keys(BATTERY_CHEMISTRIES).map(key => ({
        key,
        name: BATTERY_CHEMISTRIES[key].label,
        cycle_life: BATTERY_CHEMISTRIES[key].nominal_cycles,
        efficiency: BATTERY_CHEMISTRIES[key].round_trip_efficiency,
      })),
    };
  }
);

// ─── TARIFF TOOLS (Internal — Tariff Rate Monitor agent) ─────────────────────

defineTool('list_tariff_templates', 'tariff.read',
  'List all tariff structures and their rates stored in the platform. Returns template tariffs and company tariffs.',
  { required: [], optional: ['country', 'templates_only'] },
  async (input) => {
    let query = supabase
      .from('tariff_structures')
      .select('id, tariff_name, country, utility_name, tariff_type, currency, is_template, seasons, created_at, tariff_rates(id, season_key, period_name, rate_per_kwh, weekday_hours)')
      .order('created_at', { ascending: false })
      .limit(50);

    if (input.country) query = query.eq('country', input.country);
    if (input.templates_only) query = query.eq('is_template', true);

    const { data, error } = await query;
    if (error) throw error;
    return { tariffs: data || [], count: (data || []).length };
  }
);

defineTool('update_tariff_rates', 'tariff.write',
  'Update tariff rates for a specific tariff structure. Provide the tariff_structure_id and an array of rate updates.',
  { required: ['tariff_structure_id', 'rate_updates'] },
  async (input) => {
    const { tariff_structure_id, rate_updates } = input;

    // Verify tariff exists
    const { data: tariff } = await supabase
      .from('tariff_structures')
      .select('id, tariff_name')
      .eq('id', tariff_structure_id)
      .single();

    if (!tariff) throw new Error('Tariff structure not found');

    const results = [];
    for (const update of rate_updates) {
      if (!update.rate_id || update.new_rate_per_kwh === undefined) {
        results.push({ rate_id: update.rate_id, success: false, error: 'Missing rate_id or new_rate_per_kwh' });
        continue;
      }
      const { error } = await supabase
        .from('tariff_rates')
        .update({ rate_per_kwh: update.new_rate_per_kwh })
        .eq('id', update.rate_id)
        .eq('tariff_structure_id', tariff_structure_id);

      results.push({
        rate_id: update.rate_id,
        success: !error,
        new_rate: update.new_rate_per_kwh,
        error: error?.message || null,
      });
    }

    // Log the update in audit
    fireAndForget(
      supabase.from('audit_logs').insert({
        user_id: null,
        action: 'ai_tariff_rate_update',
        details: {
          tariff_id: tariff_structure_id,
          tariff_name: tariff.tariff_name,
          updates: results.filter(r => r.success).length,
          failures: results.filter(r => !r.success).length,
        },
      }),
      'tariff_rate_audit_log'
    );

    return {
      tariff_name: tariff.tariff_name,
      updates_applied: results.filter(r => r.success).length,
      failures: results.filter(r => !r.success).length,
      details: results,
    };
  }
);

defineTool('update_calculator_bands', 'tariff.write',
  'Update the hardcoded MYTO tariff band rates (A-E) used in the ROI calculator. These are stored in the tariff_band_overrides config table.',
  { required: ['bands'] },
  async (input) => {
    const { bands } = input;
    // bands should be { A: number, B: number, C: number, D: number, E: number }
    const validBands = ['A', 'B', 'C', 'D', 'E'];
    const updates = [];

    for (const [band, rate] of Object.entries(bands)) {
      if (!validBands.includes(band)) continue;
      if (typeof rate !== 'number' || rate <= 0 || rate > 1000) continue;
      updates.push({ band, rate });
    }

    if (!updates.length) throw new Error('No valid band updates provided');

    // Store in platform_config as tariff band overrides
    const { error } = await supabase
      .from('platform_config')
      .upsert({
        key: 'myto_tariff_bands',
        value: JSON.stringify(bands),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' });

    if (error) throw error;

    // Log the update
    fireAndForget(
      supabase.from('audit_logs').insert({
        user_id: null,
        action: 'ai_calculator_band_update',
        details: { bands, updated_count: updates.length },
      }),
      'calculator_band_audit_log'
    );

    return {
      updated_bands: updates,
      note: 'Calculator will pick up new rates on next request. Old hardcoded defaults are now overridden.',
    };
  }
);

// ─── TOOL EXECUTION ENGINE ───────────────────────────────────────────────────

/**
 * List tools available to an agent based on its capabilities.
 * Returns tool definitions formatted for LLM function calling.
 *
 * @param {string[]} capabilities - e.g. ['projects.*', 'financial.read']
 * @returns {Array<{name, description}>}
 */
function getToolsForCapabilities(capabilities) {
  if (!Array.isArray(capabilities) || capabilities.length === 0) return [];

  return Object.values(TOOL_DEFINITIONS).filter((tool: any) => {
    return capabilities.some((cap: any) => {
      // Wildcard match: 'projects.*' matches 'projects.read', 'projects.write'
      if (cap.endsWith('.*')) {
        const prefix = cap.slice(0, -2);
        return tool.capability.startsWith(prefix);
      }
      return tool.capability === cap;
    });
  }).map((tool: any) => ({
    name: tool.name,
    description: tool.description,
  }));
}

/**
 * Execute a tool with full security checks and audit logging.
 *
 * @param {string} toolName - Tool to execute
 * @param {Object} input    - Tool input parameters
 * @param {Object} context  - Execution context (userId, companyId, agentInstanceId, etc.)
 * @param {string[]} agentCapabilities - The agent's allowed capabilities
 * @returns {Object} Tool execution result
 */
async function executeTool(toolName, input, context, agentCapabilities) {
  const tool = TOOL_DEFINITIONS[toolName];
  if (!tool) {
    return { error: `Unknown tool: ${toolName}` };
  }

  // Capability check
  const hasCapability = (agentCapabilities || []).some(cap => {
    if (cap.endsWith('.*')) {
      return tool.capability.startsWith(cap.slice(0, -2));
    }
    return tool.capability === cap;
  });

  if (!hasCapability) {
    logger.warn('AI tool capability denied', { toolName, agentInstanceId: context.agentInstanceId });
    return { error: `Agent does not have permission to use tool: ${toolName}` };
  }

  // Input validation
  const validation = validateInput(input || {}, tool.inputSchema);
  if (!validation.valid) {
    return { error: validation.error };
  }

  // Execute with timing
  const start = Date.now();
  let result;
  let success = true;
  try {
    result = await tool.handler(input || {}, context);
  } catch (err) {
    success = false;
    result = { error: err.message };
    logger.error('AI tool execution failed', { toolName, message: err.message });
  }
  const executionMs = Date.now() - start;

  // Audit log (fire-and-forget)
  fireAndForget(
    supabase.from('ai_tool_executions').insert({
      message_id: context.messageId || null,
      task_id: context.taskId || null,
      tool_name: toolName,
      input_params: input || {},
      output_summary: success
        ? (typeof result === 'string' ? result.slice(0, 500) : JSON.stringify(result).slice(0, 500))
        : result.error,
      success,
      execution_ms: executionMs,
    }),
    'tool_execution_audit'
  );

  return result;
}

/**
 * Get all registered tool names (for admin dashboard).
 */
function getAllToolNames() {
  return Object.keys(TOOL_DEFINITIONS);
}

module.exports = {
  getToolsForCapabilities,
  executeTool,
  getAllToolNames,
  TOOL_DEFINITIONS,
};
