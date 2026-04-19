const express = require("express");
const opportunityController = require("../controllers/opportunityController");
const { requireAuth, optionalAuth } = require("../middlewares/authMiddleware");
const { requireAdmin, requireAdminRole } = require("../middlewares/adminMiddleware");
const { cachePolicies } = require("../middlewares/cacheControlMiddleware");

const router = express.Router();

// Public
router.get("/", cachePolicies.short, opportunityController.listPublicOpportunities);
router.post("/:id/apply", optionalAuth, opportunityController.submitOpportunityApplication);

// Admin opportunities
router.get(
  "/admin/list",
  requireAuth,
  requireAdmin,
  requireAdminRole("super_admin", "operations", "analytics"),
  opportunityController.adminListOpportunities
);
router.post(
  "/admin",
  requireAuth,
  requireAdmin,
  requireAdminRole("super_admin", "operations"),
  opportunityController.adminCreateOpportunity
);
router.patch(
  "/admin/:id",
  requireAuth,
  requireAdmin,
  requireAdminRole("super_admin", "operations"),
  opportunityController.adminUpdateOpportunity
);
router.delete(
  "/admin/:id",
  requireAuth,
  requireAdmin,
  requireAdminRole("super_admin", "operations"),
  opportunityController.adminDeleteOpportunity
);

// Admin applications
router.get(
  "/admin/applications/list",
  requireAuth,
  requireAdmin,
  requireAdminRole("super_admin", "operations", "analytics"),
  opportunityController.adminListApplications
);
router.patch(
  "/admin/applications/:id",
  requireAuth,
  requireAdmin,
  requireAdminRole("super_admin", "operations"),
  opportunityController.adminUpdateApplication
);

module.exports = router;
