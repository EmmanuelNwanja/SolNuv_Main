/**
 * SolNuv Environment Middleware
 * Reads platform_settings.environment_mode and attaches the current mode
 * ('test' | 'live') to every request.  Admin endpoints use this to filter
 * queries so test data and live data are fully separated.
 */

const supabase = require('../config/database');

// In-memory cache (refreshed every 30 s or on explicit admin toggle)
let _cached = { mode: 'test', fetchedAt: 0 };
const CACHE_TTL_MS = 30_000;

async function fetchEnvironmentMode() {
  const { data } = await supabase
    .from('platform_settings')
    .select('value')
    .eq('key', 'environment_mode')
    .maybeSingle();
  return data?.value?.mode || 'test';
}

/**
 * Express middleware — sets req.env = 'test' | 'live'
 */
async function attachEnvironment(req, _res, next) {
  try {
    const now = Date.now();
    if (now - _cached.fetchedAt > CACHE_TTL_MS) {
      _cached.mode = await fetchEnvironmentMode();
      _cached.fetchedAt = now;
    }
    req.env = _cached.mode;
  } catch {
    req.env = 'test'; // safe default
  }
  next();
}

/** Force-refresh the cache (called after admin toggles mode) */
function invalidateEnvironmentCache() {
  _cached.fetchedAt = 0;
}

module.exports = { attachEnvironment, invalidateEnvironmentCache, fetchEnvironmentMode };
