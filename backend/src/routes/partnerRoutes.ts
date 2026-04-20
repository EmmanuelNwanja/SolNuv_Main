const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middlewares/authMiddleware');
const partnerController = require('../controllers/partnerController');
const verificationDirectoryController = require('../controllers/verificationDirectoryController');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.get('/recycler/pickups', requireAuth, partnerController.listRecyclerPickups);
router.get('/recycler/sla-summary', requireAuth, partnerController.recyclerSlaSummary);
router.post('/portal-events', requireAuth, partnerController.logPartnerEvent);
router.get('/portal-events', requireAuth, partnerController.listPartnerEvents);
router.get('/financier/funding-requests', requireAuth, partnerController.listFinancierFundingRequests);
router.post('/financier/funding-requests', requireAuth, partnerController.createFinancierFundingRequest);
router.get('/financier/financials-summary', requireAuth, partnerController.financierFinancialsSummary);
router.get('/financier/escrow-decisions', requireAuth, partnerController.listFinancierEscrowDecisions);
router.post('/training/import-graduates', requireAuth, upload.single('file'), verificationDirectoryController.importGraduates);
router.get('/training/verification-requests', requireAuth, verificationDirectoryController.listTrainingVerificationRequests);
router.patch('/training/verification-requests/:id/decision', requireAuth, verificationDirectoryController.decideTrainingVerificationRequest);
router.get('/training/impact-summary', requireAuth, verificationDirectoryController.trainingImpactSummary);
router.get('/training/institutes', verificationDirectoryController.listTrainingInstitutes);

module.exports = router;
