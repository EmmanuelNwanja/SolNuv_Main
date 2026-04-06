// loadProfileRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const loadProfileController = require('../controllers/loadProfileController');
const { requireAuth } = require('../middlewares/authMiddleware');
const { requirePlan } = require('../middlewares/subscriptionMiddleware');

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

// Upload CSV/Excel
router.post('/upload', requirePlan('pro'), upload.single('file'), loadProfileController.uploadProfile);

// Manual monthly entry
router.post('/manual', requirePlan('pro'), loadProfileController.manualEntry);

// AI synthetic generation + confirm
router.post('/synthetic', requirePlan('pro'), loadProfileController.generateSynthetic);
router.post('/synthetic/confirm', requirePlan('pro'), loadProfileController.confirmSynthetic);

// Get profile & hourly data
router.get('/:projectId', loadProfileController.getProfile);
router.get('/:projectId/hourly', loadProfileController.getHourlyData);

module.exports = router;
