const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { requireAuth, requireProfile } = require('../middlewares/authMiddleware');
const { checkTeamLimit } = require('../middlewares/subscriptionMiddleware');

router.post('/profile', requireAuth, authController.createOrUpdateProfile);
router.get('/me', requireAuth, authController.getMe);
router.post('/invite', requireAuth, requireProfile, checkTeamLimit, authController.inviteTeamMember);
router.post('/accept-invite/:token', requireAuth, authController.acceptInvite);
router.get('/accept-invite/:token', authController.acceptInvite); // public check
router.get('/team', requireAuth, requireProfile, authController.getTeamMembers);
router.get('/notifications', requireAuth, requireProfile, authController.getNotifications);

module.exports = router;
