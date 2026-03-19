// projectRoutes.js
const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const { requireAuth, requireProfile, optionalAuth } = require('../middlewares/authMiddleware');

router.get('/verify/:qrCode', projectController.verifyByQR); // public
router.use(requireAuth, requireProfile);

router.get('/', projectController.getProjects);
router.post('/', projectController.createProject);
router.get('/export/csv', projectController.exportCSV);
router.get('/:id', projectController.getProject);
router.put('/:id', projectController.updateProject);
router.delete('/:id', projectController.deleteProject);
router.post('/:id/recovery', projectController.requestRecovery);

module.exports = router;
