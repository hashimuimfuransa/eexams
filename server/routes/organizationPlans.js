const express = require('express');
const router = express.Router();
const {
  getOrganizationPlans,
  getActiveOrganizationPlans,
  getOrganizationPlanById,
  createOrganizationPlan,
  updateOrganizationPlan,
  deleteOrganizationPlan,
  updateOrganizationPlanStatus
} = require('../controllers/organizationPlanController');
const auth = require('../middleware/auth');
const { isSuperAdmin } = require('../middleware/role');

router.use(auth);

// Viewable by any authenticated user (org admins need to browse the catalog to purchase)
router.get('/', getOrganizationPlans);
router.get('/active', getActiveOrganizationPlans);
router.get('/:id', getOrganizationPlanById);

// Super Admin only routes
router.post('/', isSuperAdmin, createOrganizationPlan);
router.put('/:id', isSuperAdmin, updateOrganizationPlan);
router.delete('/:id', isSuperAdmin, deleteOrganizationPlan);
router.patch('/:id/status', isSuperAdmin, updateOrganizationPlanStatus);

module.exports = router;
