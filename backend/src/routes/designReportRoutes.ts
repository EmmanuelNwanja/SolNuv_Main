// designReportRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const designReportController = require('../controllers/designReportController');
const { requireAuth } = require('../middlewares/authMiddleware');
const { requirePlan } = require('../middlewares/subscriptionMiddleware');
const { requireVerified } = require('../middlewares/verificationMiddleware');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// Public share endpoints — no auth
router.get('/shared/:token', designReportController.getSharedReport);
router.get('/shared/:token/pdf', designReportController.downloadSharedReportPdf);

// All other endpoints require auth + verification
router.use(requireAuth);

// HTML data — available to all plans (Basic+) + verified users
router.get('/:projectId/html', requireVerified, designReportController.getHtmlData);
router.get('/:projectId/v2/json', requireVerified, designReportController.getV2Json);

// PDF — Pro+ + verified
router.get('/:projectId/pdf', requirePlan('pro'), requireVerified, designReportController.downloadPdf);
router.get('/:projectId/v2/pdf', requirePlan('pro'), requireVerified, designReportController.downloadV2Pdf);

// Excel — Elite+ + verified
router.get('/:projectId/excel', requirePlan('elite'), requireVerified, designReportController.downloadExcel);
router.get('/:projectId/v2/excel', requirePlan('elite'), requireVerified, designReportController.downloadV2Excel);

// Reproducibility export pack (ZIP) — Pro+ + verified
router.get('/:projectId/pack', requirePlan('pro'), requireVerified, designReportController.downloadPack);

// Share link creation — Pro+ + verified
router.post('/:projectId/share', requirePlan('pro'), requireVerified, designReportController.createShareLink);
router.get('/:projectId/imported-reports', requireVerified, designReportController.listImportedDesignReports);
router.post(
  '/:projectId/imported-reports',
  requireVerified,
  upload.single('file'),
  designReportController.uploadImportedDesignReport,
);

module.exports = router;
