const express = require('express');
const router = express.Router();
const {
  getSubscriptions,
  getSubscriptionById,
  getMyActiveSubscription,
  getMyPendingPayment,
  initiateSubscriptionPayment,
  processPaymentCallback,
  checkPaymentStatus,
  createSubscription,
  cancelSubscription,
  renewSubscription,
  getSubscriptionStats
} = require('../controllers/subscriptionController');
const auth = require('../middleware/auth');
const { isSuperAdmin } = require('../middleware/role');
const { validateSubscriptionOwnership } = require('../middleware/security');

// Apply auth middleware to all routes except callback
router.use((req, res, next) => {
  if (req.path === '/callback') {
    return next();
  }
  auth(req, res, next);
});

// User routes
router.get('/my/active', getMyActiveSubscription);
router.get('/my/pending-payment', getMyPendingPayment);
router.post('/initiate', initiateSubscriptionPayment);
router.post('/callback', processPaymentCallback);
router.get('/payment-status/:reference', checkPaymentStatus);
router.patch('/:id/cancel', validateSubscriptionOwnership, cancelSubscription);

// Super Admin only routes (self-service renewal goes through /initiate + /callback,
// which is payment-verified; this manual route is for admin overrides only)
router.post('/', isSuperAdmin, createSubscription);
router.patch('/:id/renew', isSuperAdmin, renewSubscription);
router.get('/', isSuperAdmin, getSubscriptions);
router.get('/:id', isSuperAdmin, getSubscriptionById);
router.get('/stats/overview', isSuperAdmin, getSubscriptionStats);

module.exports = router;
