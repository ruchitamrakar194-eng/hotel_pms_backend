const express = require('express');
const router = express.Router();
const billingController = require('../controllers/billingController');

// Hotel Subscription routes
router.get('/hotel/:id/subscription', billingController.getHotelSubscription);
router.put('/hotel/:id/subscription', billingController.updateHotelSubscription);
router.put('/hotel/:id/subscription/plan', billingController.changePlan);
router.post('/hotel/:id/subscription/pause', billingController.pauseSubscription);
router.get('/hotel/:id/invoices', billingController.getHotelInvoices);

// Admin billing routes
router.get('/admin/revenue', billingController.getAdminRevenue);
router.get('/admin/subscriptions', billingController.getAdminSubscriptions);
router.get('/admin/failed-payments', billingController.getAdminFailedPayments);
router.get('/admin/invoices', billingController.getAdminInvoices);

module.exports = router;
