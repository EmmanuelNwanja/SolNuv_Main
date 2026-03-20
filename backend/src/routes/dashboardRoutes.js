const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { requireAuth, requireProfile, optionalAuth } = require('../middlewares/authMiddleware');

// Every handler wrapped in arrow function — nothing read at load time
router.get('/leaderboard',         optionalAuth, (req, res) => dashboardController.getLeaderboard(req, res));
router.get('/refresh-leaderboard',              (req, res) => dashboardController.refreshLeaderboard(req, res));

router.use(requireAuth, requireProfile);
router.get('/',       (req, res) => dashboardController.getDashboard(req, res));
router.get('/impact', (req, res) => dashboardController.getImpact(req, res));

module.exports = router;