// loadProfileRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const loadProfileController = require('../controllers/loadProfileController');
const { requireAuth } = require('../middlewares/authMiddleware');
const { requirePlan } = require('../middlewares/subscriptionMiddleware');
const { trackSimulationUsage } = require('../middlewares/usageMiddleware');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.csv', '.txt', '.xlsx', '.xls'];
    const ext = file.originalname?.toLowerCase().slice(file.originalname.lastIndexOf('.'));
    cb(null, allowed.includes(ext));
  },
});

router.use(requireAuth);

// Upload CSV/Excel — Basic: 3/month, Pro+: unlimited (free tier blocked)
router.post('/upload', requirePlan('basic'), trackSimulationUsage('load_profile'), upload.single('file'), loadProfileController.uploadProfile);

// Manual monthly entry — Basic: 3/month, Pro+: unlimited
router.post('/manual', requirePlan('basic'), trackSimulationUsage('load_profile'), loadProfileController.manualEntry);

// AI synthetic generation + confirm — Basic: 3/month, Pro+: unlimited
router.post('/synthetic', requirePlan('basic'), trackSimulationUsage('load_profile'), loadProfileController.generateSynthetic);
router.post('/synthetic/confirm', requirePlan('basic'), loadProfileController.confirmSynthetic);

// Get profile & hourly data
router.get('/:projectId', loadProfileController.getProfile);
router.get('/:projectId/hourly', loadProfileController.getHourlyData);

module.exports = router;
