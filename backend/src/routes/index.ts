// backend/src/routes/index.js
const express = require('express');
const router = express.Router();
const { cachePolicies } = require('../middlewares/cacheControlMiddleware');

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
router.use('/nerc', require('./nercRoutes'));
router.use('/v2', require('./v2Routes'));

// Public (unauthenticated) endpoints
const adminController = require('../controllers/adminController');
router.get('/public/seo', cachePolicies.medium, adminController.getPublicSeoSettings);

router.get('/health', cachePolicies.noStore, (req, res) => res.json({
  status: 'ok',
  platform: 'SolNuv',
  version: '1.0.0',
  timestamp: new Date().toISOString(),
}));

module.exports = router;
