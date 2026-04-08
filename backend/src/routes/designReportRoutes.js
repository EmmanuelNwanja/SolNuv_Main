// designReportRoutes.js
const express = require('express');
const router = express.Router();
const designReportController = require('../controllers/designReportController');
const { requireAuth } = require('../middlewares/authMiddleware');
const { requirePlan } = require('../middlewares/subscriptionMiddleware');

// Public share endpoints — no auth
router.get('/shared/:token', designReportController.getSharedReport);
router.get('/shared/:token/pdf', designReportController.downloadSharedReportPdf);

// All other endpoints require auth
router.use(requireAuth);

// HTML data — available to all plans (Basic+)
router.get('/:projectId/html', designReportController.getHtmlData);

// PDF — Pro+
router.get('/:projectId/pdf', requirePlan('pro'), designReportController.downloadPdf);

// Excel — Elite+
router.get('/:projectId/excel', requirePlan('elite'), designReportController.downloadExcel);

// Share link creation — Pro+
router.post('/:projectId/share', requirePlan('pro'), designReportController.createShareLink);

module.exports = router;
