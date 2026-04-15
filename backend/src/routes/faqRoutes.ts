const express = require('express');
const faqController = require('../controllers/faqController');
const { requireAuth } = require('../middlewares/authMiddleware');
const { requireAdmin, requireAdminRole } = require('../middlewares/adminMiddleware');
const { cachePolicies } = require('../middlewares/cacheControlMiddleware');

const router = express.Router();

router.get('/', cachePolicies.medium, faqController.listFaqs);

router.get(
  '/admin',
  requireAuth,
  requireAdmin,
  requireAdminRole('super_admin', 'operations', 'analytics'),
  faqController.adminListFaqs
);
router.post(
  '/admin',
  requireAuth,
  requireAdmin,
  requireAdminRole('super_admin', 'operations'),
  faqController.adminCreateFaq
);
router.patch(
  '/admin/:id',
  requireAuth,
  requireAdmin,
  requireAdminRole('super_admin', 'operations'),
  faqController.adminUpdateFaq
);
router.delete(
  '/admin/:id',
  requireAuth,
  requireAdmin,
  requireAdminRole('super_admin', 'operations'),
  faqController.adminDeleteFaq
);

module.exports = router;
