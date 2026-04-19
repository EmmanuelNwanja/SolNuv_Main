const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middlewares/authMiddleware');
const partnerController = require('../controllers/partnerController');

router.get('/recycler/pickups', requireAuth, partnerController.listRecyclerPickups);
router.get('/recycler/sla-summary', requireAuth, partnerController.recyclerSlaSummary);
router.post('/portal-events', requireAuth, partnerController.logPartnerEvent);
router.get('/portal-events', requireAuth, partnerController.listPartnerEvents);
router.get('/financier/funding-requests', requireAuth, partnerController.listFinancierFundingRequests);
router.post('/financier/funding-requests', requireAuth, partnerController.createFinancierFundingRequest);
router.get('/financier/financials-summary', requireAuth, partnerController.financierFinancialsSummary);
router.get('/financier/escrow-decisions', requireAuth, partnerController.listFinancierEscrowDecisions);

module.exports = router;
