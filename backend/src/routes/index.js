// backend/src/routes/index.js
const express = require('express');
const router = express.Router();

router.use('/auth', require('./authRoutes'));
router.use('/projects', require('./projectRoutes'));
router.use('/dashboard', require('./dashboardRoutes'));
router.use('/reports', require('./reportRoutes'));
router.use('/calculator', require('./calculatorRoutes'));
router.use('/payments', require('./paymentRoutes'));
router.use('/admin', require('./adminRoutes'));
router.use('/blog', require('./blogRoutes'));
router.use('/contact', require('./contactRoutes'));
router.use('/faq', require('./faqRoutes'));
router.use('/analytics', require('./analyticsRoutes'));
router.use('/agent', require('./agentRoutes'));
router.use('/tariffs', require('./tariffRoutes'));
router.use('/load-profiles', require('./loadProfileRoutes'));
router.use('/simulation', require('./simulationRoutes'));
router.use('/design-reports', require('./designReportRoutes'));

router.get('/health', (req, res) => res.json({
  status: 'ok',
  platform: 'SolNuv',
  version: '1.0.0',
  timestamp: new Date().toISOString(),
}));

module.exports = router;
