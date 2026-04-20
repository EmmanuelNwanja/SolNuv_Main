const express = require('express');
const router = express.Router();
const cmsController = require('../controllers/cmsController');
const { requireAuth, requireProfile } = require('../middlewares/authMiddleware');
const { requireAdmin, requireAdminRole } = require('../middlewares/adminMiddleware');

router.get('/resolve', cmsController.resolveRuntimePage);

router.use(requireAuth, requireProfile, requireAdmin);

router.get('/admin/pages', requireAdminRole('super_admin', 'operations'), cmsController.adminListPages);
router.post('/admin/bootstrap-seeds', requireAdminRole('super_admin', 'operations'), cmsController.adminBootstrapSeeds);
router.get('/admin/pages/:id', requireAdminRole('super_admin', 'operations'), cmsController.adminGetPage);
router.post('/admin/pages', requireAdminRole('super_admin', 'operations'), cmsController.adminUpsertPage);
router.put('/admin/pages/:id', requireAdminRole('super_admin', 'operations'), cmsController.adminUpsertPage);
router.delete('/admin/pages/:id', requireAdminRole('super_admin'), cmsController.adminDeletePage);

router.post('/admin/sections', requireAdminRole('super_admin', 'operations'), cmsController.adminUpsertSection);
router.put('/admin/sections/:id', requireAdminRole('super_admin', 'operations'), cmsController.adminUpsertSection);
router.delete('/admin/sections/:id', requireAdminRole('super_admin', 'operations'), cmsController.adminDeleteSection);

router.post('/admin/cards', requireAdminRole('super_admin', 'operations'), cmsController.adminUpsertCard);
router.put('/admin/cards/:id', requireAdminRole('super_admin', 'operations'), cmsController.adminUpsertCard);
router.delete('/admin/cards/:id', requireAdminRole('super_admin', 'operations'), cmsController.adminDeleteCard);

router.post('/admin/links', requireAdminRole('super_admin', 'operations'), cmsController.adminUpsertLink);
router.put('/admin/links/:id', requireAdminRole('super_admin', 'operations'), cmsController.adminUpsertLink);
router.delete('/admin/links/:id', requireAdminRole('super_admin', 'operations'), cmsController.adminDeleteLink);
router.post('/admin/reorder', requireAdminRole('super_admin', 'operations'), cmsController.adminReorder);

router.post('/admin/pages/:id/publish', requireAdminRole('super_admin'), cmsController.adminPublishPage);
router.post('/admin/pages/:id/unpublish', requireAdminRole('super_admin'), cmsController.adminUnpublishPage);
router.post('/admin/pages/:id/rollback', requireAdminRole('super_admin'), cmsController.adminRollbackPage);

module.exports = router;
