const express = require('express');
const router = express.Router();
const {
  getSubscriptions,
  getSubscriptionById,
  getMyActiveSubscription,
  getMyPendingPayment,
  initiateSubscriptionPayment,
  initiateOrganizationSubscriptionPayment,
  initiateIndividualSubscriptionPayment,
  processPaymentCallback,
  checkPaymentStatus,
  getPendingPayments,
  approvePendingPayment,
  rejectPendingPayment,
  createSubscription,
  cancelSubscription,
  renewSubscription,
  getSubscriptionStats,
  getAccountPlanSubscribers,
  cancelAccountPlanSubscription
} = require('../controllers/subscriptionController');
const auth = require('../middleware/auth');
const { isSuperAdmin, isAdmin, isTeacher } = require('../middleware/role');
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
router.post('/organization/initiate', isAdmin, initiateOrganizationSubscriptionPayment);
router.post('/individual/initiate', isTeacher, initiateIndividualSubscriptionPayment);
router.post('/callback', processPaymentCallback);
router.get('/payment-status/:reference', checkPaymentStatus);
router.patch('/:id/cancel', validateSubscriptionOwnership, cancelSubscription);

// Super Admin only routes (self-service renewal goes through /initiate + /callback,
// which is payment-verified; this manual route is for admin overrides only)
// NOTE: /pending* and /stats/overview must stay above the generic /:id route,
// otherwise Express would match them as { id: 'pending' } / { id: 'stats' }.
router.get('/pending', isSuperAdmin, getPendingPayments);
router.post('/pending/:id/approve', isSuperAdmin, approvePendingPayment);
router.patch('/pending/:id/reject', isSuperAdmin, rejectPendingPayment);
router.get('/stats/overview', isSuperAdmin, getSubscriptionStats);
// Organisation/individual account-plan subscribers (User.subscriptionPlan) —
// separate from the level-based Subscription records above.
router.get('/account-plans/subscribers', isSuperAdmin, getAccountPlanSubscribers);
router.post('/account-plans/:userId/cancel', isSuperAdmin, cancelAccountPlanSubscription);
router.post('/', isSuperAdmin, createSubscription);
router.patch('/:id/renew', isSuperAdmin, renewSubscription);
router.get('/', isSuperAdmin, getSubscriptions);
router.get('/:id', isSuperAdmin, getSubscriptionById);

module.exports = router;
