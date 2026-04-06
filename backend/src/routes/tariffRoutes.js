// tariffRoutes.js
const express = require('express');
const router = express.Router();
const tariffController = require('../controllers/tariffController');
const { requireAuth } = require('../middlewares/authMiddleware');
const { requirePlan } = require('../middlewares/subscriptionMiddleware');

// All tariff routes require authentication + Pro plan minimum
router.use(requireAuth);

// Templates are available to all authenticated users
router.get('/templates', tariffController.getTemplates);

// User tariffs
router.get('/', tariffController.getUserTariffs);
router.post('/', requirePlan('pro'), tariffController.createTariff);
router.get('/:id', tariffController.getTariffDetail);
router.put('/:id', requirePlan('pro'), tariffController.updateTariff);
router.delete('/:id', requirePlan('pro'), tariffController.deleteTariff);

module.exports = router;
