const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { requireAuth, requireProfile, optionalAuth } = require('../middlewares/authMiddleware');

router.get('/leaderboard', optionalAuth, dashboardController.getLeaderboard);
router.get('/refresh-leaderboard', dashboardController.refreshLeaderboard);

router.use(requireAuth, requireProfile);
router.get('/', dashboardController.getDashboard);
router.get('/impact', dashboardController.getImpact);

module.exports = router;