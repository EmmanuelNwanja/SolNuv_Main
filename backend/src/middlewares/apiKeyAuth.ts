/**
 * SolNuv API Key Middleware
 *
 * Authenticates public API (`/api/v1/public/*`) requests with an API key
 * passed as `Authorization: Bearer sk_live_…` or `X-API-Key: sk_live_…`.
 *
 * On success it attaches `req.apiKey` (the DB row), `req.apiScopes`, and a
 * synthetic `req.user` carrying the owning user id so downstream controllers
 * behave as if the human owner had made the call.
 *
 * Responses from public API endpoints MUST use the standard envelope from
 * responseHelper so SDKs see a consistent shape.
 */

const { verifySecret, logUsage } = require('../services/apiKeyService');
const { sendError } = require('../utils/responseHelper');
const supabase = require('../config/database');

function extractKey(req) {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    const token = auth.slice('Bearer '.length).trim();
    if (token) return token;
  }
  const header = req.headers['x-api-key'];
  if (typeof header === 'string' && header.trim()) return header.trim();
  return null;
}

function requireApiKey(requiredScope: string | null = null) {
  return async function apiKeyMiddleware(req, res, next) {
    const start = Date.now();
    const plaintext = extractKey(req);
    if (!plaintext) {
      return sendError(res, 'Missing API key. Pass it as Authorization: Bearer sk_live_… or X-API-Key.', 401);
    }

    const keyRow = await verifySecret(plaintext);
    if (!keyRow) {
      return sendError(res, 'Invalid, expired, or revoked API key.', 401);
    }

    if (requiredScope && !keyRow.scopes?.includes(requiredScope)) {
      return sendError(
        res,
        `This API key does not have the required scope '${requiredScope}'.`,
        403,
      );
    }

    const { data: user } = await supabase
      .from('users')
      .select('id, email, plan, company_id, subscription_status, subscription_tier')
      .eq('id', keyRow.user_id)
      .maybeSingle();
    if (!user) {
      return sendError(res, 'API key is no longer associated with an active account.', 401);
    }

    req.apiKey = keyRow;
    req.apiScopes = keyRow.scopes || [];
    req.user = user;

    res.on('finish', () => {
      logUsage({
        apiKeyId: keyRow.id,
        path: req.originalUrl,
        method: req.method,
        statusCode: res.statusCode,
        latencyMs: Date.now() - start,
      });
    });

    next();
  };
}

module.exports = { requireApiKey };
