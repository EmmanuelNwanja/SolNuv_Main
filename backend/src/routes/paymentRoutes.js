// paymentRoutes.js
const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { requireAuth, requireProfile } = require('../middlewares/authMiddleware');

// Public
router.get('/plans', paymentController.getPlans);
router.post('/webhook', paymentController.handleWebhook);

// Authenticated
router.use(requireAuth, requireProfile);
router.post('/initialize', paymentController.initializePayment);
router.get('/verify/:reference', paymentController.verifyPayment);
router.post('/promo/validate', paymentController.validatePromo);
router.get('/history', paymentController.getSubscriptionHistory);
router.get('/bank-transfer/settings', paymentController.getBankTransferSettings);
router.post('/bank-transfer/submit', paymentController.submitBankTransfer);
router.get('/bank-transfer/my-submissions', paymentController.getMyBankTransferSubmissions);

module.exports = router;
