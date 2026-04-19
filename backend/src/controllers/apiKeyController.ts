/**
 * SolNuv API Key Controller — user-facing management endpoints.
 * All endpoints require the user's main session (JWT); the keys minted
 * here are then used separately to authenticate public API calls.
 */

const apiKeyService = require('../services/apiKeyService');
const { sendSuccess, sendError } = require('../utils/responseHelper');
const logger = require('../utils/logger');

function sanitize(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    prefix: row.prefix,
    scopes: row.scopes || [],
    last_used_at: row.last_used_at || null,
    expires_at: row.expires_at || null,
    revoked_at: row.revoked_at || null,
    created_at: row.created_at,
  };
}

/**
 * GET /api/api-keys
 * List this user's API keys (never returns the plaintext secret).
 */
exports.listKeys = async (req, res) => {
  try {
    const rows = await apiKeyService.listApiKeys(req.user.id);
    return sendSuccess(res, rows.map(sanitize));
  } catch (err) {
    logger.error('listKeys error', { message: err.message, userId: req.user?.id });
    return sendError(res, 'Failed to load API keys');
  }
};

/**
 * POST /api/api-keys
 * Create a new key. Returns the plaintext secret *once* — clients must
 * store it immediately and never ask us for it again.
 */
exports.createKey = async (req, res) => {
  try {
    const { name, scopes, expires_at } = req.body || {};
    if (!name || String(name).trim().length < 3) {
      return sendError(res, 'Please give the key a descriptive name (at least 3 characters).', 400);
    }
    if (scopes && (!Array.isArray(scopes) || scopes.some((s) => typeof s !== 'string'))) {
      return sendError(res, 'Scopes must be an array of strings.', 400);
    }
    const { row, secret } = await apiKeyService.createApiKey({
      userId: req.user.id,
      companyId: req.user.company_id || null,
      name: String(name).trim(),
      scopes,
      expiresAt: expires_at || null,
    });
    return sendSuccess(
      res,
      {
        key: sanitize(row),
        secret,
        warning: 'Store this secret now — it will not be shown again.',
      },
      'API key created',
    );
  } catch (err) {
    logger.error('createKey error', { message: err.message, userId: req.user?.id });
    return sendError(res, 'Failed to create API key');
  }
};

/**
 * DELETE /api/api-keys/:id
 * Revoke a key (soft delete). Idempotent.
 */
exports.revokeKey = async (req, res) => {
  try {
    const row = await apiKeyService.revokeApiKey(req.user.id, req.params.id);
    if (!row) return sendError(res, 'API key not found', 404);
    return sendSuccess(res, sanitize(row), 'API key revoked');
  } catch (err) {
    logger.error('revokeKey error', { message: err.message, userId: req.user?.id });
    return sendError(res, 'Failed to revoke API key');
  }
};
