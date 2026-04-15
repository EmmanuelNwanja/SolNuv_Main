// projectRoutes.js
const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const projectController = require('../controllers/projectController');
const { requireAuth, requireProfile, optionalAuth } = require('../middlewares/authMiddleware');
const { requireVerified } = require('../middlewares/verificationMiddleware');

const batteryLedgerLogLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many battery log submissions. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.get('/verify/:qrCode', projectController.verifyByQR); // public
router.get('/battery-ledger/:qrCode', projectController.getBatteryLedgerByQr); // public QR ledger
router.post('/battery-ledger/:qrCode/log', batteryLedgerLogLimiter, optionalAuth, projectController.addBatteryHealthLogByQr); // token-authorized write submit
router.use(requireAuth, requireProfile);

router.use('/saved', requireVerified); // Require verification for saved calculations
router.post('/', requireVerified); // Require verification to create projects
router.put('/:id', requireVerified);
router.delete('/:id', requireVerified);
router.post('/:id/geo-verify', requireVerified);
router.post('/:id/recovery', requireVerified);
router.post('/:id/proposal-scenario', requireVerified);
router.post('/:id/battery-assets', requireVerified);
router.post('/:id/battery-assets/:assetId/logs', requireVerified);
router.post('/:id/cable-compliance', requireVerified);
router.post('/:id/equipment', requireVerified);
router.put('/:id/equipment/:equipmentId', requireVerified);
router.delete('/:id/equipment/:equipmentId', requireVerified);

router.get('/', projectController.getProjects);
router.post('/', projectController.createProject);
router.get('/export/csv', projectController.exportCSV);
router.get('/:id', projectController.getProject);
router.put('/:id', projectController.updateProject);
router.delete('/:id', projectController.deleteProject);
router.post('/:id/geo-verify', projectController.geoVerify);
router.post('/:id/recovery', projectController.requestRecovery);
router.post('/:id/proposal-scenario', projectController.saveProposalScenario);
router.get('/:id/battery-assets', projectController.getBatteryAssets);
router.post('/:id/battery-assets', projectController.createBatteryAsset);
router.post('/:id/battery-assets/:assetId/logs', projectController.addBatteryHealthLog);
router.get('/:id/battery-assets/:assetId/logs', projectController.getBatteryHealthLogs);
router.post('/:id/cable-compliance', projectController.saveCableCompliance);
// Equipment CRUD (draft / maintenance only)
router.post('/:id/equipment', projectController.addEquipment);
router.put('/:id/equipment/:equipmentId', projectController.updateEquipment);
router.delete('/:id/equipment/:equipmentId', projectController.deleteEquipment);
// Project history
router.get('/:id/history', projectController.getProjectHistory);

module.exports = router;
