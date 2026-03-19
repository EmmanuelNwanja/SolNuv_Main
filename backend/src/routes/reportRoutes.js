// reportRoutes.js
const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { requireAuth, requireProfile } = require('../middlewares/authMiddleware');
const { requirePlan } = require('../middlewares/subscriptionMiddleware');

router.use(requireAuth, requireProfile);
router.post('/nesrea', requirePlan('pro'), reportController.generateNesrea);
router.get('/certificate/:projectId', requirePlan('pro'), reportController.generateCertificate);
router.get('/history', reportController.getHistory);
router.get('/excel', requirePlan('pro'), reportController.generateExcel);

module.exports = router;
