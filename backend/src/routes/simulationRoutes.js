// simulationRoutes.js
const express = require('express');
const router = express.Router();
const simulationController = require('../controllers/simulationController');
const { requireAuth } = require('../middlewares/authMiddleware');
const { trackSimulationUsage } = require('../middlewares/usageMiddleware');

router.use(requireAuth);

// Run full simulation — Basic: 3/month, Pro+: unlimited
router.post('/run', trackSimulationUsage('simulation'), simulationController.runProjectSimulation);

// Get simulation results
router.get('/:projectId/results', simulationController.getSimulationResults);
router.get('/:projectId/results/hourly', simulationController.getHourlyFlows);

// Solar resource preview (no gate — useful for sales)
router.get('/solar-resource', simulationController.getSolarResource);

// Auto-size PV + BESS recommendation — Basic: 3/month, Pro+: unlimited
router.post('/auto-size', trackSimulationUsage('auto_size'), simulationController.autoSizeSystem);

module.exports = router;
