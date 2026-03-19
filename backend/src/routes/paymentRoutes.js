// paymentRoutes.js
const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { requireAuth, requireProfile } = require('../middlewares/authMiddleware');

// Public
router.get('/plans', paymentController.getPlans);
router.post('/webhook', express.raw({ type: 'application/json' }), paymentController.handleWebhook);

// Authenticated
router.use(requireAuth, requireProfile);
router.post('/initialize', paymentController.initializePayment);
router.get('/verify/:reference', paymentController.verifyPayment);

module.exports = router;
