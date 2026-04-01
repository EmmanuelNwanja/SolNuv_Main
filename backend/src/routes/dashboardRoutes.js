const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { requireAuth, requireProfile, optionalAuth } = require('../middlewares/authMiddleware');

// Every handler wrapped in arrow function — nothing read at load time
router.get('/leaderboard',         optionalAuth, (req, res) => dashboardController.getLeaderboard(req, res));
router.get('/refresh-leaderboard', (req, res) => {
  // Protect against anonymous abuse: accept a valid CRON_SECRET header (for scheduled jobs)
  // or an authenticated platform admin (handled inside the controller via req.user).
  const secret = req.headers['x-cron-secret'];
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    // If CRON_SECRET is configured, reject requests without the correct secret
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  return dashboardController.refreshLeaderboard(req, res);
});
router.post('/public/feedback/:token',          (req, res) => dashboardController.submitPublicFeedback(req, res));
router.get('/public/profile/:slug',             (req, res) => dashboardController.getPublicProfile(req, res));

router.use(requireAuth, requireProfile);
router.get('/',       (req, res) => dashboardController.getDashboard(req, res));
router.get('/impact', (req, res) => dashboardController.getImpact(req, res));
router.get('/feedback', (req, res) => dashboardController.getFeedbackOverview(req, res));
router.post('/feedback/link/:projectId', (req, res) => dashboardController.generateFeedbackLink(req, res));

module.exports = router;