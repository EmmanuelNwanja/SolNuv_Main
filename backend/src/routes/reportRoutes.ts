// reportRoutes.js
const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { requireAuth, requireProfile } = require('../middlewares/authMiddleware');
const { requirePlan } = require('../middlewares/subscriptionMiddleware');
const { requireVerified } = require('../middlewares/verificationMiddleware');

router.use(requireAuth, requireProfile);
router.post('/nesrea', requirePlan('pro'), requireVerified, reportController.generateNesrea);
router.get('/certificate/:projectId', requirePlan('pro'), requireVerified, reportController.generateCertificate);
router.get('/history', reportController.getHistory);
router.get('/excel', requirePlan('pro'), requireVerified, reportController.generateExcel);

module.exports = router;
