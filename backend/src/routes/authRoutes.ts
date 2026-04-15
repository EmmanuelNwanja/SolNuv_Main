const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { requireAuth, requireProfile } = require('../middlewares/authMiddleware');
const { checkTeamLimit } = require('../middlewares/subscriptionMiddleware');

router.post('/signup', authController.signup);
router.post('/password-reset/request', authController.requestPasswordResetOtp);
router.post('/password-reset/verify', authController.verifyPasswordResetOtp);
router.post('/password-reset/complete', authController.completePasswordReset);
router.post('/phone-verification/request', requireAuth, authController.requestPhoneVerificationOtp);
router.post('/phone-verification/verify', requireAuth, authController.verifyPhoneVerificationOtp);

router.post('/profile', requireAuth, authController.createOrUpdateProfile);
router.get('/me', requireAuth, authController.getMe);
router.get('/profile-status', requireAuth, authController.getProfileStatus);

// User verification
router.get('/verification-status', requireAuth, authController.getVerificationStatus);
router.post('/verification-request', requireAuth, authController.requestVerification);
router.delete('/verification-request', requireAuth, authController.cancelVerificationRequest);
router.post('/invite', requireAuth, requireProfile, checkTeamLimit, authController.inviteTeamMember);
router.post('/accept-invite/:token', requireAuth, authController.acceptInvite);
router.get('/accept-invite/:token', authController.acceptInvite); // public check
router.get('/team', requireAuth, requireProfile, authController.getTeamMembers);
router.get('/notifications', requireAuth, requireProfile, authController.getNotifications);

module.exports = router;
