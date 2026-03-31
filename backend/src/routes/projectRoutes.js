// projectRoutes.js
const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const { requireAuth, requireProfile, optionalAuth } = require('../middlewares/authMiddleware');

router.get('/verify/:qrCode', projectController.verifyByQR); // public
router.get('/battery-ledger/:qrCode', projectController.getBatteryLedgerByQr); // public QR ledger
router.post('/battery-ledger/:qrCode/log', optionalAuth, projectController.addBatteryHealthLogByQr); // public-friendly log submit
router.use(requireAuth, requireProfile);

router.get('/', projectController.getProjects);
router.post('/', projectController.createProject);
router.get('/export/csv', projectController.exportCSV);
router.get('/:id', projectController.getProject);
router.put('/:id', projectController.updateProject);
router.delete('/:id', projectController.deleteProject);
router.post('/:id/recovery', projectController.requestRecovery);
router.post('/:id/proposal-scenario', projectController.saveProposalScenario);
router.get('/:id/battery-assets', projectController.getBatteryAssets);
router.post('/:id/battery-assets', projectController.createBatteryAsset);
router.post('/:id/battery-assets/:assetId/logs', projectController.addBatteryHealthLog);
router.get('/:id/battery-assets/:assetId/logs', projectController.getBatteryHealthLogs);
router.post('/:id/cable-compliance', projectController.saveCableCompliance);

module.exports = router;
