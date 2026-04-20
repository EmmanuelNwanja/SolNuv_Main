const express = require('express');
const router = express.Router();
const pitchDeckController = require('../controllers/pitchDeckController');
const { requireAuth, requireProfile } = require('../middlewares/authMiddleware');
const { requireAdmin, requireAdminRole } = require('../middlewares/adminMiddleware');

router.get('/public/:slug?', pitchDeckController.getPublicDeck);

router.use(requireAuth, requireProfile, requireAdmin);
router.get('/admin/decks', requireAdminRole('super_admin', 'operations'), pitchDeckController.adminListDecks);
router.get('/admin/decks/:id', requireAdminRole('super_admin', 'operations'), pitchDeckController.adminGetDeck);
router.post('/admin/decks', requireAdminRole('super_admin'), pitchDeckController.adminUpsertDeck);
router.put('/admin/decks/:id', requireAdminRole('super_admin'), pitchDeckController.adminUpsertDeck);

router.post('/admin/slides', requireAdminRole('super_admin', 'operations'), pitchDeckController.adminUpsertSlide);
router.put('/admin/slides/:id', requireAdminRole('super_admin', 'operations'), pitchDeckController.adminUpsertSlide);
router.delete('/admin/slides/:id', requireAdminRole('super_admin'), pitchDeckController.adminDeleteSlide);

router.post('/admin/cards', requireAdminRole('super_admin', 'operations'), pitchDeckController.adminUpsertCard);
router.put('/admin/cards/:id', requireAdminRole('super_admin', 'operations'), pitchDeckController.adminUpsertCard);
router.delete('/admin/cards/:id', requireAdminRole('super_admin'), pitchDeckController.adminDeleteCard);

router.post('/admin/metrics', requireAdminRole('super_admin', 'operations'), pitchDeckController.adminUpsertMetric);
router.put('/admin/metrics/:id', requireAdminRole('super_admin', 'operations'), pitchDeckController.adminUpsertMetric);

module.exports = router;
