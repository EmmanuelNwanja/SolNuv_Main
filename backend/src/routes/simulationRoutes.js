// simulationRoutes.js
const express = require('express');
const router = express.Router();
const simulationController = require('../controllers/simulationController');
const { requireAuth } = require('../middlewares/authMiddleware');
const { requirePlan } = require('../middlewares/subscriptionMiddleware');

router.use(requireAuth);

// Run full simulation — Pro+
router.post('/run', requirePlan('pro'), simulationController.runSimulation);

// Get simulation results
router.get('/:projectId/results', simulationController.getResults);
router.get('/:projectId/results/hourly', simulationController.getHourlyFlows);

// Solar resource preview (no plan gate — useful for sales)
router.get('/solar-resource', simulationController.getSolarResource);

// Auto-size PV + BESS recommendation
router.post('/auto-size', requirePlan('pro'), simulationController.autoSize);

module.exports = router;
