const express = require('express');
const multer = require('multer');
const router = express.Router();
const verificationController = require('../controllers/verificationDirectoryController');
const { requireAuth, requireProfile } = require('../middlewares/authMiddleware');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.get('/professionals/search', verificationController.searchProfessionals);
router.get('/companies/search', verificationController.searchCompanies);
router.get('/training-institutes', verificationController.listTrainingInstitutes);

router.post('/requests', requireAuth, requireProfile, verificationController.submitCompetencyVerificationRequest);
router.get('/training/requests', requireAuth, requireProfile, verificationController.listTrainingVerificationRequests);
router.patch('/training/requests/:id/decision', requireAuth, requireProfile, verificationController.decideTrainingVerificationRequest);
router.post(
  '/training/import-graduates',
  requireAuth,
  requireProfile,
  upload.single('file'),
  verificationController.importGraduates,
);

module.exports = router;
