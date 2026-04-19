const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const simulationController = require('../controllers/simulationController');
const { requireAuth } = require('../middlewares/authMiddleware');
const { requirePlan } = require('../middlewares/subscriptionMiddleware');
const { trackSimulationUsage } = require('../middlewares/usageMiddleware');

router.use(requireAuth);

// Run full simulation — Basic: 3/month, Pro+: unlimited (free tier blocked)
router.post('/run', requirePlan('basic'), trackSimulationUsage('simulation'), simulationController.runProjectSimulation);

// Lightweight preview — no DB writes, no quota hit against the full-run counter.
// Rate-limited to protect compute (debounce on the client keeps this friendly).
const previewLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many preview requests — please slow down.' },
});
router.post('/preview', requirePlan('basic'), previewLimiter, simulationController.runSimulationPreview);

// Get simulation results
router.get('/:projectId/design-config', simulationController.getDesignConfig);
router.get('/:projectId/design-versions', simulationController.getDesignVersions);
router.post('/:projectId/design-versions/:resultId/restore', simulationController.restoreDesignVersion);
router.get('/:projectId/results', simulationController.getSimulationResults);
router.get('/:projectId/results/hourly', simulationController.getHourlyFlows);

// Solar resource preview (no gate — useful for sales)
router.get('/solar-resource', simulationController.getSolarResource);

// Auto-size PV + BESS recommendation — Basic: 3/month, Pro+: unlimited
router.post('/auto-size', requirePlan('basic'), trackSimulationUsage('auto_size'), simulationController.autoSizeSystem);

// AI expert feedback
router.post('/:projectId/ai-feedback', requirePlan('basic'), simulationController.generateAIFeedback);
router.put('/:projectId/ai-feedback', simulationController.saveAIFeedback);

module.exports = router;
