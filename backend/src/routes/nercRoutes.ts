const express = require('express');
const router = express.Router();
const nercController = require('../controllers/nercController');
const { requireAuth, requireProfile } = require('../middlewares/authMiddleware');
const { requireVerified } = require('../middlewares/verificationMiddleware');
const { requireAdmin, requireAdminRole } = require('../middlewares/adminMiddleware');
const { requirePlan } = require('../middlewares/subscriptionMiddleware');

router.use(requireAuth, requireProfile);

// Project regulatory profile
router.get('/projects/:projectId/profile', nercController.getProjectRegulatoryProfile);
router.get('/projects/:projectId/triage', nercController.getProjectTriage);
router.put('/projects/:projectId/profile', requireVerified, nercController.upsertProjectRegulatoryProfile);

// Permit / registration lifecycle
router.get('/projects/:projectId/applications', nercController.listProjectApplications);
router.post('/projects/:projectId/applications', requireVerified, nercController.createApplication);
router.post('/projects/:projectId/assisted-request', requirePlan('pro'), requireVerified, nercController.createAssistedApplicationRequest);
router.post('/projects/:projectId/confirm-portal-submission', requireVerified, nercController.confirmPortalSubmission);
router.patch('/applications/:applicationId', requireVerified, nercController.updateApplicationDraft);
router.post('/applications/:applicationId/submit', requireVerified, nercController.submitApplication);

// NERC submission exports
router.get('/projects/:projectId/export', nercController.exportProjectForNerc);
router.get('/export', nercController.exportProjectsForNerc);

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
router.get('/admin/reporting-cycles/:cycleId/submissions', requireAdmin, requireAdminRole('super_admin', 'operations', 'analytics'), nercController.adminListCycleSubmissions);
router.patch('/admin/submissions/:submissionId/decision', requireAdmin, requireAdminRole('super_admin', 'operations'), nercController.adminDecisionSubmission);
router.patch('/admin/reporting-cycles/:cycleId/status', requireAdmin, requireAdminRole('super_admin', 'operations'), nercController.adminOverrideReportingCycleStatus);

module.exports = router;
