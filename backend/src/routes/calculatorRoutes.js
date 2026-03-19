// calculatorRoutes.js
const express = require('express');
const router = express.Router();
const calculatorController = require('../controllers/calculatorController');

// All public - no auth required for demo
router.post('/panel', calculatorController.calculatePanel);       // full: silver + second-life
router.post('/silver', calculatorController.calculateSilver);
router.post('/battery', calculatorController.calculateBattery);
router.post('/degradation', calculatorController.calculateDegradation);
router.get('/silver-price', calculatorController.getSilverPrice);
router.get('/brands', calculatorController.getBrands);
router.get('/states', calculatorController.getStates);

module.exports = router;

// ================================================
// paymentRoutes.js (inline for brevity)
// ================================================
