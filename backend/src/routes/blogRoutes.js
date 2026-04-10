// backend/src/routes/blogRoutes.js
const express = require('express');
const router = express.Router();
const blogController = require('../controllers/blogController');
const { requireAuth } = require('../middlewares/authMiddleware');
const { requireAdmin, requireAdminRole } = require('../middlewares/adminMiddleware');
const { cachePolicies } = require('../middlewares/cacheControlMiddleware');

// Public
router.get('/posts', cachePolicies.short, blogController.listPosts);
router.get('/posts/:slug', cachePolicies.short, blogController.getPost);
router.post('/posts/:slug/click', blogController.trackLinkClick);

// Public ads
router.get('/ads', cachePolicies.short, blogController.listAds);
router.get('/ads/popup', cachePolicies.short, blogController.getPopupAd);
router.post('/ads/:id/impression', blogController.trackAdImpression);
router.post('/ads/:id/click', blogController.trackAdClick);

// Admin
router.get('/admin/posts', requireAuth, requireAdmin, requireAdminRole('super_admin', 'operations', 'analytics'), blogController.adminListPosts);
router.post('/admin/posts', requireAuth, requireAdmin, requireAdminRole('super_admin', 'operations'), blogController.adminCreatePost);
router.patch('/admin/posts/:id', requireAuth, requireAdmin, requireAdminRole('super_admin', 'operations'), blogController.adminUpdatePost);
router.delete('/admin/posts/:id', requireAuth, requireAdmin, requireAdminRole('super_admin', 'operations'), blogController.adminDeletePost);
router.get('/admin/posts/:id/analytics', requireAuth, requireAdmin, requireAdminRole('super_admin', 'operations', 'analytics'), blogController.adminGetPostAnalytics);

router.get('/admin/ads', requireAuth, requireAdmin, requireAdminRole('super_admin', 'operations', 'analytics'), blogController.adminListAds);
router.post('/admin/ads', requireAuth, requireAdmin, requireAdminRole('super_admin', 'operations'), blogController.adminCreateAd);
router.patch('/admin/ads/:id', requireAuth, requireAdmin, requireAdminRole('super_admin', 'operations'), blogController.adminUpdateAd);
router.delete('/admin/ads/:id', requireAuth, requireAdmin, requireAdminRole('super_admin', 'operations'), blogController.adminDeleteAd);
router.get('/admin/ads/:id/analytics', requireAuth, requireAdmin, requireAdminRole('super_admin', 'operations', 'analytics'), blogController.adminGetAdAnalytics);

// Popup campaigns (public fetch + admin CRUD)
router.get('/campaigns/popup', cachePolicies.short, blogController.getCampaignPopups);
router.get('/admin/campaigns', requireAuth, requireAdmin, requireAdminRole('super_admin', 'operations', 'analytics'), blogController.adminListCampaigns);
router.post('/admin/campaigns', requireAuth, requireAdmin, requireAdminRole('super_admin', 'operations'), blogController.adminCreateCampaign);
router.patch('/admin/campaigns/:id', requireAuth, requireAdmin, requireAdminRole('super_admin', 'operations'), blogController.adminUpdateCampaign);
router.delete('/admin/campaigns/:id', requireAuth, requireAdmin, requireAdminRole('super_admin', 'operations'), blogController.adminDeleteCampaign);

module.exports = router;
