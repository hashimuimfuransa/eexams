const express = require('express');
const router = express.Router();
const {
  getIndividualPlans,
  getActiveIndividualPlans,
  getIndividualPlanById,
  createIndividualPlan,
  updateIndividualPlan,
  deleteIndividualPlan,
  updateIndividualPlanStatus
} = require('../controllers/individualPlanController');
const auth = require('../middleware/auth');
const { isSuperAdmin } = require('../middleware/role');

router.use(auth);

// Viewable by any authenticated user (teachers need to browse the catalog to purchase)
router.get('/', getIndividualPlans);
router.get('/active', getActiveIndividualPlans);
router.get('/:id', getIndividualPlanById);

// Super Admin only routes
router.post('/', isSuperAdmin, createIndividualPlan);
router.put('/:id', isSuperAdmin, updateIndividualPlan);
router.delete('/:id', isSuperAdmin, deleteIndividualPlan);
router.patch('/:id/status', isSuperAdmin, updateIndividualPlanStatus);

module.exports = router;
