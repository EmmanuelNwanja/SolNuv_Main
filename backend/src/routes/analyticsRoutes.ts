// backend/src/routes/analyticsRoutes.js
const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { requireAuth } = require('../middlewares/authMiddleware');
const { requireAdmin, requireAdminRole } = require('../middlewares/adminMiddleware');

// Beacon endpoint — optionally authenticated
router.post('/pageview', analyticsController.trackPageView);

// Admin analytics dashboard
router.get('/', requireAuth, requireAdmin, requireAdminRole('super_admin', 'analytics', 'finance', 'operations'), analyticsController.getFullAnalytics);

module.exports = router;
