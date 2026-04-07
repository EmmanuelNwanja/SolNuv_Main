/**
 * SolNuv AI Agent Middleware
 * Validates agent instance access and enforces AI-specific rate limits.
 */

'use strict';

const supabase = require('../config/database');
const { sendError } = require('../utils/responseHelper');

const PLAN_HIERARCHY = { free: 0, pro: 1, elite: 2, enterprise: 3 };

// Simple in-memory rate limiter (per-user, per-minute)
const _rateMap = new Map();
const RATE_WINDOW_MS = 60_000;
const RATE_LIMITS = { free: 5, pro: 10, elite: 20, enterprise: 30 };

function cleanUpRateEntries() {
  const cutoff = Date.now() - RATE_WINDOW_MS;
  for (const [key, entries] of _rateMap) {
    const valid = entries.filter(t => t > cutoff);
    if (valid.length === 0) _rateMap.delete(key);
    else _rateMap.set(key, valid);
  }
}

// Periodic cleanup every 2 minutes
setInterval(cleanUpRateEntries, 120_000).unref();

/**
 * Validate that the user has access to the requested agent instance.
 * Checks: agentInstanceId in body/query → must be active, and either
 * shared (company_id IS NULL) or belongs to user's company.
 */
async function validateAgentAccess(req, res, next) {
  const agentInstanceId = req.body?.agentInstanceId || req.query?.agentInstanceId;
  if (!agentInstanceId) return next(); // Will be caught by controller validation

  const userId = req.user?.id;
  const companyId = req.user?.company_id;

  const { data: instance, error } = await supabase
    .from('ai_agent_instances')
    .select('id, company_id, is_active, ai_agent_definitions(tier, plan_minimum)')
    .eq('id', agentInstanceId)
    .single();

  if (error || !instance) {
    return sendError(res, 'Agent not found', 404);
  }

  if (!instance.is_active) {
    return sendError(res, 'Agent is currently inactive', 403);
  }

  // Access check: shared agents (null company) or matching company
  if (instance.company_id && instance.company_id !== companyId) {
    return sendError(res, 'You do not have access to this agent', 403);
  }

  // Internal agents are never user-accessible
  if (instance.ai_agent_definitions?.tier === 'internal') {
    return sendError(res, 'This agent is not available for direct interaction', 403);
  }

  // Plan check
  const userPlan = req.user?.companies?.subscription_plan || 'free';
  const agentExpiresAt = req.user?.companies?.subscription_expires_at;
  if (agentExpiresAt && new Date(agentExpiresAt) < new Date() && userPlan !== 'free') {
    return sendError(res, 'Your subscription has expired. Please renew to access AI agents.', 402, {
      code: 'SUBSCRIPTION_EXPIRED',
      upgrade_url: 'https://solnuv.com/plans',
    });
  }
  const requiredPlan = instance.ai_agent_definitions?.plan_minimum || 'free';
  if ((PLAN_HIERARCHY[userPlan] ?? 0) < (PLAN_HIERARCHY[requiredPlan] ?? 0)) {
    return sendError(res, `This agent requires the ${requiredPlan} plan or higher`, 403, {
      code: 'PLAN_UPGRADE_REQUIRED',
      current_plan: userPlan,
      required_plan: requiredPlan,
    });
  }

  req.agentInstance = instance;
  return next();
}

/**
 * AI-specific rate limiter. Limits chat messages per minute per user.
 */
function agentRateLimiter(req, res, next) {
  const userId = req.user?.id;
  if (!userId) return next();

  const plan = req.user?.companies?.subscription_plan || 'free';
  const limit = RATE_LIMITS[plan] || RATE_LIMITS.free;
  const key = `ai:${userId}`;

  const now = Date.now();
  const cutoff = now - RATE_WINDOW_MS;
  const entries = (_rateMap.get(key) || []).filter(t => t > cutoff);

  if (entries.length >= limit) {
    return sendError(res, 'AI rate limit exceeded. Please wait a moment before sending another message.', 429, {
      code: 'AI_RATE_LIMIT',
      retry_after_seconds: Math.ceil((entries[0] + RATE_WINDOW_MS - now) / 1000),
    });
  }

  entries.push(now);
  _rateMap.set(key, entries);
  return next();
}

module.exports = { validateAgentAccess, agentRateLimiter };
