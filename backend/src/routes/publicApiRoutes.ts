// publicApiRoutes.js
//
// Versioned public REST API authenticated via API keys. These endpoints are
// the productized surface area of SolNuv's simulation engine — external
// systems (ERPs, partner dashboards, in-house tooling) call them to request
// lightweight simulation previews and tariff lookups without going through
// the user-facing web app.
//
// Contract notes:
// - Everything lives under /api/v1/public/* — we never break a v1 response
//   shape. Breaking changes ship as /api/v2/public/*.
// - All endpoints return the standard { success, data, message } envelope.
// - Requests are rate-limited per API key to protect the simulation engine.

const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();

const { requireApiKey } = require('../middlewares/apiKeyAuth');
const simulationController = require('../controllers/simulationController');
const { sendSuccess, sendError } = require('../utils/responseHelper');
const supabase = require('../config/database');
const logger = require('../utils/logger');

const publicRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: (req: any) => req.apiKey?.id || req.ip,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Rate limit exceeded — the public API allows 60 requests per minute per key.',
  },
});

router.get('/health', (_req, res) => {
  return sendSuccess(res, { status: 'ok', api_version: 'v1', time: new Date().toISOString() });
});

// Everything below here requires a valid API key.
router.use(requireApiKey());
router.use(publicRateLimit);

/**
 * POST /api/v1/public/simulate/preview
 * Lightweight, in-memory PV + BESS + financial preview.
 * Requires scope: simulate:preview.
 */
router.post(
  '/simulate/preview',
  requireApiKey('simulate:preview'),
  simulationController.runSimulationPreview,
);

/**
 * GET /api/v1/public/tariffs?country=NG
 * Returns the catalogue of tariff structures available for the given
 * country code. No PII is exposed.
 */
router.get('/tariffs', async (req, res) => {
  try {
    const country = String(req.query.country || '').toUpperCase().slice(0, 2);
    let query = supabase
      .from('tariff_structures')
      .select('id, tariff_name, utility_name, country_code, currency, tariff_type, effective_from, effective_to')
      .order('utility_name');
    if (country) query = query.eq('country_code', country);
    const { data, error } = await query.limit(200);
    if (error) throw error;
    return sendSuccess(res, data || []);
  } catch (err: any) {
    logger.error('public /tariffs error', { message: err.message });
    return sendError(res, 'Failed to load tariffs');
  }
});

/**
 * GET /api/v1/public/me
 * Metadata about the authenticated API key (for developers debugging
 * their integration).
 */
router.get('/me', (req: any, res) => {
  const k = req.apiKey || {};
  return sendSuccess(res, {
    id: k.id,
    name: k.name,
    scopes: k.scopes || [],
    prefix: k.prefix,
    last_used_at: k.last_used_at,
    user: {
      id: req.user?.id,
      plan: req.user?.plan,
    },
  });
});

module.exports = router;
