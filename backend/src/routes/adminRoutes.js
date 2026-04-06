const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { requireAuth, requireProfile } = require('../middlewares/authMiddleware');
const { requireAdmin, requireAdminRole } = require('../middlewares/adminMiddleware');
const { attachEnvironment } = require('../middlewares/environmentMiddleware');

router.use(requireAuth, requireProfile, requireAdmin, attachEnvironment);

router.get('/overview', adminController.getOverview);
router.get('/users', adminController.listUsers);
router.patch('/users/verification', adminController.updateUserVerification);
router.patch('/users/:id/suspend', requireAdminRole('super_admin', 'operations'), adminController.suspendUser);
router.delete('/users/:id', requireAdminRole('super_admin'), adminController.adminDeleteUser);

router.get('/paystack-plans', requireAdminRole('super_admin', 'finance'), adminController.listPaystackPlans);
router.post('/paystack-plans', requireAdminRole('super_admin', 'finance'), adminController.upsertPaystackPlan);

router.get('/promo-codes', requireAdminRole('super_admin', 'finance', 'operations'), adminController.listPromoCodes);
router.post('/promo-codes', requireAdminRole('super_admin', 'finance'), adminController.createPromoCode);
router.patch('/promo-codes/:id/toggle', requireAdminRole('super_admin', 'finance'), adminController.togglePromoCode);

router.get('/finance', requireAdminRole('super_admin', 'finance'), adminController.getFinance);
router.post('/push-notifications', requireAdminRole('super_admin', 'operations'), adminController.sendPushNotification);
router.get('/activity-logs', requireAdminRole('super_admin', 'analytics', 'finance', 'operations'), adminController.getActivityLogs);

router.get('/admins', requireAdminRole('super_admin'), adminController.listAdmins);
router.post('/admins', requireAdminRole('super_admin'), adminController.upsertAdmin);

router.get('/otps', requireAdminRole('super_admin', 'operations'), adminController.getOtps);
router.post('/otps', requireAdminRole('super_admin', 'operations'), adminController.generateOtp);

router.get('/projects', requireAdminRole('super_admin', 'operations', 'analytics'), adminController.listAllProjects);
router.patch('/projects/bulk', requireAdminRole('super_admin', 'operations'), adminController.adminBulkUpdateProjects);
router.patch('/projects/:id', requireAdminRole('super_admin', 'operations'), adminController.adminUpdateProject);

router.get('/recovery-requests', requireAdminRole('super_admin', 'operations'), adminController.listRecoveryRequests);
router.patch('/recovery-requests/:id/approve', requireAdminRole('super_admin', 'operations'), adminController.approveDecommission);

// Platform settings (test/live mode)
router.get('/settings/environment', requireAdminRole('super_admin'), adminController.getEnvironmentMode);
router.patch('/settings/environment', requireAdminRole('super_admin'), adminController.toggleEnvironmentMode);

// SEO & Platform Branding
router.get('/seo', requireAdminRole('super_admin', 'operations'), adminController.getSeoSettings);
router.put('/seo', requireAdminRole('super_admin'), adminController.updateSeoSettings);

// Design & Modelling admin
router.get('/design/overview', requireAdminRole('super_admin', 'analytics', 'operations'), adminController.getDesignOverview);
router.get('/design/simulations', requireAdminRole('super_admin', 'analytics', 'operations'), adminController.listSimulations);
router.get('/design/tariffs', requireAdminRole('super_admin', 'analytics', 'operations'), adminController.listTariffStructures);
router.get('/design/tariffs/:id', requireAdminRole('super_admin', 'analytics', 'operations'), adminController.getTariffDetail);
router.post('/design/tariffs', requireAdminRole('super_admin', 'operations'), adminController.createTariffTemplate);
router.patch('/design/tariffs/:id', requireAdminRole('super_admin', 'operations'), adminController.updateTariffTemplate);
router.delete('/design/tariffs/:id', requireAdminRole('super_admin'), adminController.deleteTariffTemplate);
router.get('/design/report-shares', requireAdminRole('super_admin', 'analytics', 'operations'), adminController.listReportShares);
router.patch('/design/report-shares/:id/revoke', requireAdminRole('super_admin', 'operations'), adminController.revokeReportShare);
router.get('/design/adoption', requireAdminRole('super_admin', 'analytics'), adminController.getDesignAdoption);

module.exports = router;
