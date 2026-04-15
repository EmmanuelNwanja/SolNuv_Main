// paymentRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const paymentController = require('../controllers/paymentController');
const { requireAuth, requireProfile } = require('../middlewares/authMiddleware');
const { cachePolicies } = require('../middlewares/cacheControlMiddleware');

const receiptUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    cb(null, allowed.includes(file.mimetype));
  },
});

// Public
router.get('/plans', cachePolicies.short, paymentController.getPlans);
router.post('/webhook', paymentController.handleWebhook);

// Authenticated
router.use(requireAuth, requireProfile);
router.post('/initialize', paymentController.initializePayment);
router.get('/verify/:reference', paymentController.verifyPayment);
router.post('/promo/validate', paymentController.validatePromo);
router.get('/history', paymentController.getSubscriptionHistory);
router.get('/bank-transfer/settings', paymentController.getBankTransferSettings);
router.post('/bank-transfer/submit', receiptUpload.single('receipt'), paymentController.submitBankTransfer);
router.get('/bank-transfer/my-submissions', paymentController.getMyBankTransferSubmissions);

module.exports = router;
