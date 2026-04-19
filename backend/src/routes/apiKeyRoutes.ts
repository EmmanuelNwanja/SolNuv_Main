// apiKeyRoutes.js — management UI for API keys (requires user session).
const express = require('express');
const router = express.Router();
const apiKeyController = require('../controllers/apiKeyController');
const { requireAuth, requireProfile } = require('../middlewares/authMiddleware');
const { requirePlan } = require('../middlewares/subscriptionMiddleware');

router.use(requireAuth, requireProfile);

router.get('/', apiKeyController.listKeys);
router.post('/', requirePlan('pro'), apiKeyController.createKey);
router.delete('/:id', apiKeyController.revokeKey);

module.exports = router;
