const express = require('express');
const router = express.Router();
const nercController = require('../controllers/nercController');
const { requireAuth, requireProfile } = require('../middlewares/authMiddleware');
const { requireVerified } = require('../middlewares/verificationMiddleware');
const { requireAdmin, requireAdminRole } = require('../middlewares/adminMiddleware');

router.use(requireAuth, requireProfile);

// Project regulatory profile
router.get('/projects/:projectId/profile', nercController.getProjectRegulatoryProfile);
router.put('/projects/:projectId/profile', requireVerified, nercController.upsertProjectRegulatoryProfile);

// Permit / registration lifecycle
router.get('/projects/:projectId/applications', nercController.listProjectApplications);
router.post('/projects/:projectId/applications', requireVerified, nercController.createApplication);
router.patch('/applications/:applicationId', requireVerified, nercController.updateApplicationDraft);
router.post('/applications/:applicationId/submit', requireVerified, nercController.submitApplication);

// Reporting cycles and submission events
router.get('/reporting-cycles', nercController.listMyReportingCycles);
router.get('/projects/:projectId/reporting-cycles', nercController.listProjectReportingCycles);
router.post('/projects/:projectId/reporting-cycles', requireVerified, nercController.createReportingCycle);
router.post('/reporting-cycles/:cycleId/submissions', requireVerified, nercController.recordSubmissionEvent);

// Admin queue + SLA
router.get('/admin/applications', requireAdmin, requireAdminRole('super_admin', 'operations', 'analytics'), nercController.adminListApplications);
router.patch('/admin/applications/:applicationId/decision', requireAdmin, requireAdminRole('super_admin', 'operations'), nercController.adminDecisionApplication);
router.get('/admin/sla-overview', requireAdmin, requireAdminRole('super_admin', 'operations', 'analytics'), nercController.adminSlaOverview);
router.get('/admin/reporting-cycles', requireAdmin, requireAdminRole('super_admin', 'operations', 'analytics'), nercController.adminListReportingCycles);

module.exports = router;
