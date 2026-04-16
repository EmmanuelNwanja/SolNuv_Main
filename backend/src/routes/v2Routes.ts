const express = require('express');
const router = express.Router();
const { requireAuth, requireProfile } = require('../middlewares/authMiddleware');
const { requireV2Membership, requireV2Role } = require('../middlewares/v2AuthzMiddleware');
const onboardingController = require('../controllers/v2/onboardingController');
const assetRegistryController = require('../controllers/v2/assetRegistryController');
const oracleController = require('../controllers/v2/oracleController');
const escrowPolicyController = require('../controllers/v2/escrowPolicyController');
const lifecycleController = require('../controllers/v2/lifecycleController');
const custodianWebhookController = require('../controllers/v2/custodianWebhookController');

router.get('/health', oracleController.getHealth);
router.post('/custodian/callbacks/execution-status', custodianWebhookController.receiveExecutionStatus);

router.use(requireAuth, requireProfile);
router.post('/onboarding/register-actor', onboardingController.registerActorProfile);
router.post('/assets/serial-registrations', requireV2Membership, requireV2Role('owner', 'admin', 'manager', 'epc_lead'), assetRegistryController.registerProjectSerials);
router.get('/escrow/policies', requireV2Membership, escrowPolicyController.listPolicyTemplates);
router.post('/escrow/policies', requireV2Membership, requireV2Role('owner', 'admin', 'financier_lead'), escrowPolicyController.createPolicyTemplate);
router.post('/escrow/decisions/evaluate', requireV2Membership, requireV2Role('owner', 'admin', 'financier_lead', 'epc_lead'), oracleController.evaluateEscrow);
router.post('/escrow/executions/submit', requireV2Membership, requireV2Role('owner', 'admin', 'financier_lead'), oracleController.executeCustodianRelease);
router.get('/lifecycle/events', requireV2Membership, lifecycleController.listAssetEvents);
router.post('/lifecycle/events', requireV2Membership, requireV2Role('owner', 'admin', 'manager', 'epc_lead', 'installer_lead', 'recycler_operator'), lifecycleController.recordAssetEvent);

module.exports = router;

