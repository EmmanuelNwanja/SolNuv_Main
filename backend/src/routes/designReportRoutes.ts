// designReportRoutes.js
const express = require('express');
const router = express.Router();
const designReportController = require('../controllers/designReportController');
const { requireAuth } = require('../middlewares/authMiddleware');
const { requirePlan } = require('../middlewares/subscriptionMiddleware');
const { requireVerified } = require('../middlewares/verificationMiddleware');

// Public share endpoints — no auth
router.get('/shared/:token', designReportController.getSharedReport);
router.get('/shared/:token/pdf', designReportController.downloadSharedReportPdf);

// All other endpoints require auth + verification
router.use(requireAuth);

// HTML data — available to all plans (Basic+) + verified users
router.get('/:projectId/html', requireVerified, designReportController.getHtmlData);

// PDF — Pro+ + verified
router.get('/:projectId/pdf', requirePlan('pro'), requireVerified, designReportController.downloadPdf);

// Excel — Elite+ + verified
router.get('/:projectId/excel', requirePlan('elite'), requireVerified, designReportController.downloadExcel);

// Share link creation — Pro+ + verified
router.post('/:projectId/share', requirePlan('pro'), requireVerified, designReportController.createShareLink);

module.exports = router;
