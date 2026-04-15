// backend/src/routes/contactRoutes.js
const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contactController');
const { requireAuth } = require('../middlewares/authMiddleware');
const { requireAdmin, requireAdminRole } = require('../middlewares/adminMiddleware');

// Public
router.post('/', contactController.submitContact);

// Admin
router.get('/admin', requireAuth, requireAdmin, requireAdminRole('super_admin', 'operations', 'analytics'), contactController.adminListSubmissions);
router.patch('/admin/:id', requireAuth, requireAdmin, requireAdminRole('super_admin', 'operations'), contactController.adminUpdateSubmission);
router.delete('/admin/:id', requireAuth, requireAdmin, requireAdminRole('super_admin'), contactController.adminDeleteSubmission);

module.exports = router;
