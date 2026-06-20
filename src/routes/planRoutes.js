const express = require('express');
const router = express.Router();
const planController = require('../controllers/planController');

// Plan routes
router.get('/', planController.getPlans);
router.post('/', planController.createPlan);
router.put('/:id', planController.updatePlan);
router.delete('/:id', planController.deletePlan);

// Billing history route
router.get('/history', planController.getBillingHistory);

module.exports = router;
