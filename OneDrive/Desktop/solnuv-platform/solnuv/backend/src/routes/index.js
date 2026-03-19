// backend/src/routes/index.js
const express = require('express');
const router = express.Router();

router.use('/auth', require('./authRoutes'));
router.use('/projects', require('./projectRoutes'));
router.use('/dashboard', require('./dashboardRoutes'));
router.use('/reports', require('./reportRoutes'));
router.use('/calculator', require('./calculatorRoutes'));
router.use('/payments', require('./paymentRoutes'));

router.get('/health', (req, res) => res.json({
  status: 'ok',
  platform: 'SolNuv',
  version: '1.0.0',
  timestamp: new Date().toISOString(),
}));

module.exports = router;
