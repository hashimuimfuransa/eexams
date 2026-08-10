const express = require('express');
const router = express.Router();
const {
  getSubscriptionPlans,
  getPublicSubscriptionPlans,
  getSubscriptionPlanById,
  getActivePlansForLevel,
  getActivePlansForExam,
  createSubscriptionPlan,
  updateSubscriptionPlan,
  deleteSubscriptionPlan,
  updatePlanStatus
} = require('../controllers/subscriptionPlanController');
const auth = require('../middleware/auth');
const { isSuperAdmin } = require('../middleware/role');

// Public — the pricing page has to show level plans to visitors who have no
// account yet, mirroring the /active endpoints on organization-plans and
// individual-plans. Registered before router.use(auth) so it stays anonymous,
// and before '/:id' so "public" isn't parsed as a plan id.
router.get('/public', getPublicSubscriptionPlans);

// Apply auth middleware to all routes
router.use(auth);

// Authenticated routes (for viewing plans)
router.get('/', getSubscriptionPlans);
router.get('/:id', getSubscriptionPlanById);
router.get('/level/:levelId/active', getActivePlansForLevel);
router.get('/exam/:examId/active', getActivePlansForExam);

// Super Admin only routes
router.post('/', isSuperAdmin, createSubscriptionPlan);
router.put('/:id', isSuperAdmin, updateSubscriptionPlan);
router.delete('/:id', isSuperAdmin, deleteSubscriptionPlan);
router.patch('/:id/status', isSuperAdmin, updatePlanStatus);

module.exports = router;
