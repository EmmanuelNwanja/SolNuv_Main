const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { requireAuth, requireProfile, optionalAuth } = require('../middlewares/authMiddleware');
const { refreshLeaderboard } = require('../services/schedulerService');

router.get('/leaderboard', optionalAuth, dashboardController.getLeaderboard);

// Manual leaderboard refresh — call this any time from browser or Postman
// GET https://api.solnuv.com/api/dashboard/refresh-leaderboard
router.get('/refresh-leaderboard', async (req, res) => {
  const result = await refreshLeaderboard();
  res.json({ success: true, ...result });
});

router.use(requireAuth, requireProfile);
router.get('/', dashboardController.getDashboard);
router.get('/impact', dashboardController.getImpact);

module.exports = router;
```

---

## Immediate Fix

```
