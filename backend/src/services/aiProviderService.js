/**
 * SolNuv AI Provider Service
 * Abstraction layer over free-tier LLM providers (Gemini Flash, Groq).
 * Zero new npm dependencies — uses existing axios for HTTP calls.
 * Handles: provider selection, budget enforcement, rate limiting, fallback chains.
 */

'use strict';

const supabase = require('../config/database');
const logger   = require('../utils/logger');
const {
  createResilientHttpClient,
  requestWithRetry,
  isTransientNetworkError,
  extractNetworkErrorMeta,
} = require('../utils/httpClient');

// ─── DAILY BUDGET LIMITS PER TIER ────────────────────────────────────────────
// Adjustable via platform_settings table (key: 'ai_token_budgets')
const DEFAULT_TIER_BUDGETS = {
  internal: 300_000,
  customer: 500_000,
  general:  200_000,
};

// In-memory cache of provider configs (refreshed every 5 min)
let _providerCache = null;
let _providerCacheTs = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;
const llmHttp = createResilientHttpClient({ timeout: 30_000 });

// ─── PROVIDER CONFIG LOADER ──────────────────────────────────────────────────

async function loadProviders() {
  if (_providerCache && Date.now() - _providerCacheTs < CACHE_TTL_MS) {
    return _providerCache;
  }
  const { data, error } = await supabase
    .from('ai_providers')
    .select('*')
    .eq('is_active', true)
    .order('priority_order', { ascending: true });

  if (error) {
    logger.error('Failed to load AI providers', { message: error.message });
    return _providerCache || [];
  }
  _providerCache = data || [];
  _providerCacheTs = Date.now();
  return _providerCache;
}

// ─── BUDGET ENFORCEMENT ──────────────────────────────────────────────────────

async function getTierBudgets() {
  try {
    const { data } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', 'ai_token_budgets')
      .maybeSingle();
    if (data?.value) return { ...DEFAULT_TIER_BUDGETS, ...data.value };
  } catch (_) { /* use defaults */ }
  return DEFAULT_TIER_BUDGETS;
}

async function getDailyUsage(tier, providerSlug) {
  const today = new Date().toISOString().split('T')[0];
  const { data } = await supabase
    .from('ai_token_usage')
    .select('tokens_used, requests_made')
    .eq('date', today)
    .eq('tier', tier)
    .eq('provider_slug', providerSlug)
    .maybeSingle();
  return { tokens: data?.tokens_used || 0, requests: data?.requests_made || 0 };
}

async function incrementUsage(tier, providerSlug, tokensUsed) {
  const today = new Date().toISOString().split('T')[0];
  const { data: existing } = await supabase
    .from('ai_token_usage')
    .select('id, tokens_used, requests_made')
    .eq('date', today)
    .eq('tier', tier)
    .eq('provider_slug', providerSlug)
    .maybeSingle();

  if (existing) {
    await supabase.from('ai_token_usage').update({
      tokens_used: existing.tokens_used + tokensUsed,
      requests_made: existing.requests_made + 1,
    }).eq('id', existing.id);
  } else {
    await supabase.from('ai_token_usage').insert({
      date: today,
      tier,
      provider_slug: providerSlug,
      tokens_used: tokensUsed,
      requests_made: 1,
    });
  }
}

async function isBudgetExhausted(tier, providerSlug, providerConfig) {
  const [budgets, usage] = await Promise.all([
    getTierBudgets(),
    getDailyUsage(tier, providerSlug),
  ]);
  const tierLimit = budgets[tier] || 200_000;
  const providerLimit = providerConfig?.max_tokens_day || 1_000_000;
  return usage.tokens >= tierLimit || usage.tokens >= providerLimit;
}

// ─── GEMINI FLASH ADAPTER ────────────────────────────────────────────────────

async function callGemini(provider, messages, options = {}) {
  const apiKey = process.env[provider.api_key_env_var];
  if (!apiKey) throw new Error(`Missing env var: ${provider.api_key_env_var}`);

  // Convert standard messages to Gemini format
  const systemInstruction = messages.find(m => m.role === 'system')?.content || '';
  const contents = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content || '' }],
    }));

  const body = {
    contents,
    generationConfig: {
      temperature: options.temperature ?? 0.3,
      maxOutputTokens: options.maxTokens ?? 4000,
      topP: 0.95,
    },
  };

  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] };
  }

  if (options.responseFormat === 'json') {
    body.generationConfig.responseMimeType = 'application/json';
  }

  const url = `${provider.base_url}/models/${provider.model_id}:generateContent?key=${apiKey}`;
  const start = Date.now();
  const response = await requestWithRetry(
    () => llmHttp.post(url, body, {
      headers: { 'Content-Type': 'application/json' },
    }),
    { retries: 2, shouldRetry: isTransientNetworkError }
  );
  const latency = Date.now() - start;

  const candidate = response.data.candidates?.[0];
  const content = candidate?.content?.parts?.[0]?.text || '';
  const usage = response.data.usageMetadata || {};

  return {
    content,
    tokensInput: usage.promptTokenCount || 0,
    tokensOutput: usage.candidatesTokenCount || 0,
    latencyMs: latency,
    provider: provider.slug,
    model: provider.model_id,
  };
}

// ─── GROQ ADAPTER (OpenAI-compatible) ────────────────────────────────────────

async function callGroq(provider, messages, options = {}) {
  const apiKey = process.env[provider.api_key_env_var];
  if (!apiKey) throw new Error(`Missing env var: ${provider.api_key_env_var}`);

  const body = {
    model: provider.model_id,
    messages: messages.map(m => ({ role: m.role, content: m.content || '' })),
    temperature: options.temperature ?? 0.3,
    max_tokens: options.maxTokens ?? 4000,
    top_p: 0.95,
  };

  if (options.responseFormat === 'json') {
    body.response_format = { type: 'json_object' };
  }

  const url = `${provider.base_url}/chat/completions`;
  const start = Date.now();
  const response = await requestWithRetry(
    () => llmHttp.post(url, body, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
    }),
    { retries: 2, shouldRetry: isTransientNetworkError }
  );
  const latency = Date.now() - start;

  const choice = response.data.choices?.[0];
  const usage = response.data.usage || {};

  return {
    content: choice?.message?.content || '',
    tokensInput: usage.prompt_tokens || 0,
    tokensOutput: usage.completion_tokens || 0,
    latencyMs: latency,
    provider: provider.slug,
    model: provider.model_id,
  };
}

// ─── UNIFIED DISPATCHER ─────────────────────────────────────────────────────

const ADAPTERS = {
  gemini: callGemini,
  groq: callGroq,
};

async function callProvider(provider, messages, options) {
  const adapter = ADAPTERS[provider.slug];
  if (!adapter) throw new Error(`No adapter for provider: ${provider.slug}`);
  return adapter(provider, messages, options);
}

// ─── MAIN PUBLIC API ─────────────────────────────────────────────────────────

/**
 * Complete a chat with the best available provider.
 *
 * @param {Object} params
 * @param {Array}  params.messages        - [{role, content}]
 * @param {string} params.tier            - 'internal' | 'customer' | 'general'
 * @param {string} [params.preferredSlug] - preferred provider slug
 * @param {string} [params.fallbackSlug]  - fallback provider slug
 * @param {number} [params.temperature]
 * @param {number} [params.maxTokens]
 * @param {string} [params.responseFormat] - 'text' | 'json'
 * @returns {{ content, tokensInput, tokensOutput, latencyMs, provider, model }}
 */
async function complete({
  messages,
  tier,
  preferredSlug,
  fallbackSlug,
  temperature,
  maxTokens,
  responseFormat,
}) {
  const providers = await loadProviders();
  if (providers.length === 0) {
    throw new Error('No active AI providers configured');
  }

  // Build ordered candidates: preferred → fallback → remaining by priority
  const seen = new Set();
  const ordered = [];
  for (const slug of [preferredSlug, fallbackSlug]) {
    if (!slug || seen.has(slug)) continue;
    const p = providers.find(x => x.slug === slug);
    if (p) { ordered.push(p); seen.add(slug); }
  }
  for (const p of providers) {
    if (!seen.has(p.slug)) { ordered.push(p); seen.add(p.slug); }
  }

  const options = { temperature, maxTokens, responseFormat };
  let lastError = null;

  for (const provider of ordered) {
    try {
      // Check API key is configured
      if (!process.env[provider.api_key_env_var]) {
        logger.warn(`AI provider ${provider.slug} skipped: missing ${provider.api_key_env_var}`);
        continue;
      }

      // Check budget
      const exhausted = await isBudgetExhausted(tier, provider.slug, provider);
      if (exhausted) {
        logger.info(`AI budget exhausted for ${tier}/${provider.slug}, trying next`);
        continue;
      }

      // Call the provider
      const result = await callProvider(provider, messages, options);

      // Track usage (fire-and-forget)
      incrementUsage(tier, provider.slug, result.tokensInput + result.tokensOutput)
        .catch(err => logger.warn('Failed to track AI token usage', { message: err.message }));

      return result;
    } catch (err) {
      lastError = err;
      const status = err.response?.status;
      if (status === 429) {
        logger.warn(`AI provider ${provider.slug} rate-limited, trying fallback`);
        continue;
      }
      logger.error(`AI provider ${provider.slug} error`, {
        status,
        message: err.message,
        ...extractNetworkErrorMeta(err),
      });
      continue;
    }
  }

  throw new Error(
    lastError?.message || 'All AI providers exhausted or unavailable. Tasks will resume in the next cycle.'
  );
}

/**
 * Check if any provider is available for a given tier.
 * Used by health checks and graceful degradation.
 */
async function isAvailable(tier) {
  const providers = await loadProviders();
  for (const p of providers) {
    if (!process.env[p.api_key_env_var]) continue;
    const exhausted = await isBudgetExhausted(tier, p.slug, p);
    if (!exhausted) return true;
  }
  return false;
}

/**
 * Get usage summary for admin dashboard.
 */
async function getUsageSummary(dateFrom, dateTo) {
  const { data, error } = await supabase
    .from('ai_token_usage')
    .select('*')
    .gte('date', dateFrom)
    .lte('date', dateTo)
    .order('date', { ascending: false });

  if (error) throw error;
  return data || [];
}

module.exports = {
  complete,
  isAvailable,
  getUsageSummary,
  incrementUsage,
  loadProviders,
};
