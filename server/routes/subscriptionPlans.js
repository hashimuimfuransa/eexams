const express = require('express');
const router = express.Router();
const {
  getSubscriptionPlans,
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

// Apply auth middleware to all routes
router.use(auth);

// Public routes (for viewing plans)
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
