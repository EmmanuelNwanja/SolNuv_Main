// agentRoutes.js
const express = require('express');
const router = express.Router();
const agentController = require('../controllers/agentController');
const { requireAuth } = require('../middlewares/authMiddleware');
const { requireAdmin, requireAdminRole } = require('../middlewares/adminMiddleware');
const { validateAgentAccess, agentRateLimiter } = require('../middlewares/agentMiddleware');
const { requirePlan } = require('../middlewares/subscriptionMiddleware');
const { requireVerified } = require('../middlewares/verificationMiddleware');
const { attachEnvironment } = require('../middlewares/environmentMiddleware');

// ── User endpoints (all require auth) ────────────────────────────────────────

router.get('/instances',       requireAuth, attachEnvironment,                                   agentController.getInstances);
router.post('/chat',           requireAuth, attachEnvironment, requirePlan('basic'), requireVerified, validateAgentAccess, agentRateLimiter, agentController.chat);
router.get('/conversations',   requireAuth, attachEnvironment,                                   agentController.getConversations);
router.get('/conversations/:id/messages', requireAuth, attachEnvironment,                        agentController.getMessages);
router.patch('/conversations/:id/close',  requireAuth, attachEnvironment,                        agentController.closeConversation);
router.post('/tasks',          requireAuth, attachEnvironment, requirePlan('elite'), requireVerified, validateAgentAccess, agentController.createTask);
router.get('/tasks',           requireAuth, attachEnvironment,                                   agentController.getTasks);
router.get('/tasks/:id',       requireAuth, attachEnvironment,                                   agentController.getTaskDetail);

// ── Admin endpoints ──────────────────────────────────────────────────────────

router.get('/admin/definitions',      requireAuth, requireAdmin, requireAdminRole('super_admin'),               agentController.adminGetDefinitions);
router.get('/admin/definitions/:id',  requireAuth, requireAdmin, requireAdminRole('super_admin'),               agentController.adminGetDefinition);
router.patch('/admin/definitions/:id', requireAuth, requireAdmin, requireAdminRole('super_admin'),              agentController.adminUpdateDefinition);
router.post('/admin/definitions/:id/knowledge',           requireAuth, requireAdmin, requireAdminRole('super_admin'), agentController.adminAddKnowledge);
router.put('/admin/definitions/:id/knowledge/:docId',     requireAuth, requireAdmin, requireAdminRole('super_admin'), agentController.adminUpdateKnowledge);
router.delete('/admin/definitions/:id/knowledge/:docId',  requireAuth, requireAdmin, requireAdminRole('super_admin'), agentController.adminRemoveKnowledge);
router.post('/admin/assign',          requireAuth, requireAdmin, requireAdminRole('super_admin'),               agentController.adminAssignAgents);
router.post('/admin/revoke',          requireAuth, requireAdmin, requireAdminRole('super_admin'),               agentController.adminRevokeAgents);
router.get('/admin/instances',        requireAuth, requireAdmin, requireAdminRole('super_admin'),               agentController.adminGetInstances);
router.get('/admin/tasks',            requireAuth, requireAdmin, requireAdminRole('super_admin', 'operations'), agentController.adminGetTasks);
router.get('/admin/escalations',      requireAuth, requireAdmin, requireAdminRole('super_admin', 'operations'), agentController.adminGetEscalations);
router.patch('/admin/escalations/:id', requireAuth, requireAdmin, requireAdminRole('super_admin', 'operations'), agentController.adminResolveEscalation);
router.get('/admin/usage',            requireAuth, requireAdmin, requireAdminRole('super_admin', 'finance'),    agentController.adminGetUsage);
router.get('/admin/training-export',  requireAuth, requireAdmin, requireAdminRole('super_admin'),               agentController.adminExportTraining);
router.post('/admin/seed',            requireAuth, requireAdmin, requireAdminRole('super_admin'),               agentController.adminSeedDefinitions);
router.post('/admin/run-blog-writer', requireAuth, requireAdmin, requireAdminRole('super_admin', 'operations'), agentController.adminRunBlogWriter);

module.exports = router;
