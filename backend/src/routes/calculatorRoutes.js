// calculatorRoutes.js
const express = require('express');
const router = express.Router();
const calculatorController = require('../controllers/calculatorController');
const { optionalAuth, requireAuth } = require('../middlewares/authMiddleware');
const { trackCalculatorUsage, getCalculatorUsage } = require('../middlewares/usageMiddleware');

// Usage summary endpoint (requires auth)
router.get('/usage', optionalAuth, getCalculatorUsage);

// Calculator endpoints: optionalAuth attaches user if token present;
// trackCalculatorUsage enforces Basic plan limits (7 per type/month) when authenticated.
// Anonymous requests (homepage demo) pass through unrestricted.
router.post('/panel',         optionalAuth, trackCalculatorUsage('panel'),       calculatorController.calculatePanel);
router.post('/silver',        optionalAuth,                                       calculatorController.calculateSilver);
router.post('/battery',       optionalAuth, trackCalculatorUsage('battery'),     calculatorController.calculateBattery);
router.post('/degradation',   optionalAuth, trackCalculatorUsage('degradation'), calculatorController.calculateDegradation);
router.post('/roi',           optionalAuth, trackCalculatorUsage('roi'),         calculatorController.calculateROI);
router.post('/battery-soh',   optionalAuth, trackCalculatorUsage('battery-soh'), calculatorController.estimateBatterySoH);
router.post('/cable-size',    optionalAuth, trackCalculatorUsage('cable-size'),  calculatorController.calculateCableSize);

// PDF exports — require Pro plan (enforced by subscriptionMiddleware in app.js or here)
router.post('/roi/pdf',           optionalAuth, calculatorController.exportRoiPdf);
router.post('/cable-size/pdf',    optionalAuth, calculatorController.exportCableCertificatePdf);

// Reference data (always public)
router.get('/silver-price',  calculatorController.getSilverPrice);
router.get('/brands',        calculatorController.getBrands);
router.get('/states',        calculatorController.getStates);
router.get('/technologies',  calculatorController.getTechnologies);

// Custom brand submission — requires authentication
router.post('/brands/submit', requireAuth, calculatorController.submitBrand);

// Saved calculations — requires authentication
router.post('/saved',              requireAuth, calculatorController.saveCalculation);
router.get('/saved',               requireAuth, calculatorController.getSavedCalculations);
router.get('/saved/project/:projectId', requireAuth, calculatorController.getProjectCalculations);
router.get('/saved/:id',          requireAuth, calculatorController.getSavedCalculation);
router.delete('/saved/:id',        requireAuth, calculatorController.deleteSavedCalculation);
router.post('/saved/:id/export-pdf', requireAuth, calculatorController.exportCalculationPdf);

module.exports = router;
