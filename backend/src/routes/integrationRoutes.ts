const express = require("express");
const integrationController = require("../controllers/integrationController");
const { requireAuth, requireProfile } = require("../middlewares/authMiddleware");

const router = express.Router();

router.use(requireAuth, requireProfile);

router.get("/", integrationController.listIntegrations);
router.post("/", integrationController.createIntegration);
router.patch("/:id", integrationController.updateIntegration);
router.delete("/:id", integrationController.deleteIntegration);
router.post("/:id/test", integrationController.testIntegration);
router.post("/:id/dispatch/preview", integrationController.previewDispatch);
router.post("/:id/dispatch", integrationController.dispatchIntegration);
router.get("/logs/list", integrationController.listIntegrationLogs);

module.exports = router;
