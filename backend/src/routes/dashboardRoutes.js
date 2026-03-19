const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { requireAuth, requireProfile, optionalAuth } = require('../middlewares/authMiddleware');

// Public
router.get('/leaderboard', optionalAuth, dashboardController.getLeaderboard);

// Use arrow function so the property is looked up at call time, not at load time
router.get('/refresh-leaderboard', (req, res) => dashboardController.refreshLeaderboard(req, res));

// Protected
router.use(requireAuth, requireProfile);
router.get('/', dashboardController.getDashboard);
router.get('/impact', dashboardController.getImpact);

module.exports = router;