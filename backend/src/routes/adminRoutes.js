const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { requireAuth, requireProfile } = require('../middlewares/authMiddleware');
const { requireAdmin, requireAdminRole } = require('../middlewares/adminMiddleware');

router.use(requireAuth, requireProfile, requireAdmin);

router.get('/overview', adminController.getOverview);
router.get('/users', adminController.listUsers);
router.patch('/users/verification', adminController.updateUserVerification);

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

module.exports = router;
