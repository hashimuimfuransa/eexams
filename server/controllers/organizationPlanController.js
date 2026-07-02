const OrganizationPlan = require('../models/OrganizationPlan');
const { resolvePlanDuration } = require('../utils/planDuration');

// @desc    Get all organization plans
// @route   GET /api/organization-plans
// @access  Private
const getOrganizationPlans = async (req, res) => {
  try {
    const { status, tierKey } = req.query;

    const query = {};
    if (status) query.status = status;
    if (tierKey) query.tierKey = tierKey;

    const plans = await OrganizationPlan.find(query)
      .populate('createdBy', 'fullName')
      .sort({ price: 1 });

    res.json(plans);
  } catch (error) {
    console.error('Get organization plans error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get active organization plans (purchase catalog)
// @route   GET /api/organization-plans/active
// @access  Private
const getActiveOrganizationPlans = async (req, res) => {
  try {
    const plans = await OrganizationPlan.getActivePlans();
    res.json(plans);
  } catch (error) {
    console.error('Get active organization plans error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get organization plan by ID
// @route   GET /api/organization-plans/:id
// @access  Private
const getOrganizationPlanById = async (req, res) => {
  try {
    const plan = await OrganizationPlan.findById(req.params.id).populate('createdBy', 'fullName');
    if (!plan) {
      return res.status(404).json({ message: 'Organization plan not found' });
    }
    res.json(plan);
  } catch (error) {
    console.error('Get organization plan error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Create new organization plan
// @route   POST /api/organization-plans
// @access  Private/SuperAdmin
const createOrganizationPlan = async (req, res) => {
  try {
    const { tierKey, name, price, currency, durationDays, durationValue, durationUnit, status, features, discountPercentage } = req.body;

    if (!tierKey || !['basic', 'premium', 'enterprise'].includes(tierKey)) {
      return res.status(400).json({ message: 'Invalid tier. Must be "basic", "premium", or "enterprise"' });
    }
    if (!name || price === undefined) {
      return res.status(400).json({ message: 'name and price are required' });
    }
    const resolvedDuration = resolvePlanDuration({ durationValue, durationUnit, durationDays });
    if (!resolvedDuration) {
      return res.status(400).json({ message: 'A valid duration (value and unit, in hours or days) is required' });
    }

    const plan = await OrganizationPlan.create({
      tierKey,
      name,
      price,
      currency: currency || 'RWF',
      durationDays: resolvedDuration.durationDays,
      durationValue: resolvedDuration.durationValue,
      durationUnit: resolvedDuration.durationUnit,
      status: status || 'active',
      features: features || [],
      discountPercentage: discountPercentage || 0,
      createdBy: req.user._id
    });

    res.status(201).json(plan);
  } catch (error) {
    console.error('Create organization plan error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update organization plan
// @route   PUT /api/organization-plans/:id
// @access  Private/SuperAdmin
const updateOrganizationPlan = async (req, res) => {
  try {
    const { tierKey, name, price, currency, durationDays, durationValue, durationUnit, status, features, discountPercentage } = req.body;

    const plan = await OrganizationPlan.findById(req.params.id);
    if (!plan) {
      return res.status(404).json({ message: 'Organization plan not found' });
    }

    if (tierKey && !['basic', 'premium', 'enterprise'].includes(tierKey)) {
      return res.status(400).json({ message: 'Invalid tier. Must be "basic", "premium", or "enterprise"' });
    }

    if (tierKey !== undefined) plan.tierKey = tierKey;
    if (name !== undefined) plan.name = name;
    if (price !== undefined) plan.price = price;
    if (currency !== undefined) plan.currency = currency;
    if (durationValue !== undefined || durationUnit !== undefined || durationDays !== undefined) {
      const resolvedDuration = resolvePlanDuration({ durationValue, durationUnit, durationDays });
      if (!resolvedDuration) {
        return res.status(400).json({ message: 'A valid duration (value and unit, in hours or days) is required' });
      }
      plan.durationDays = resolvedDuration.durationDays;
      plan.durationValue = resolvedDuration.durationValue;
      plan.durationUnit = resolvedDuration.durationUnit;
    }
    if (status !== undefined) plan.status = status;
    if (features !== undefined) plan.features = features;
    if (discountPercentage !== undefined) plan.discountPercentage = discountPercentage;

    await plan.save();

    res.json(plan);
  } catch (error) {
    console.error('Update organization plan error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Delete organization plan
// @route   DELETE /api/organization-plans/:id
// @access  Private/SuperAdmin
const deleteOrganizationPlan = async (req, res) => {
  try {
    const plan = await OrganizationPlan.findById(req.params.id);
    if (!plan) {
      return res.status(404).json({ message: 'Organization plan not found' });
    }

    await OrganizationPlan.findByIdAndDelete(req.params.id);

    res.json({ message: 'Organization plan deleted successfully' });
  } catch (error) {
    console.error('Delete organization plan error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Activate/Deactivate organization plan
// @route   PATCH /api/organization-plans/:id/status
// @access  Private/SuperAdmin
const updateOrganizationPlanStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const plan = await OrganizationPlan.findById(req.params.id);
    if (!plan) {
      return res.status(404).json({ message: 'Organization plan not found' });
    }

    plan.status = status;
    await plan.save();

    res.json(plan);
  } catch (error) {
    console.error('Update organization plan status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getOrganizationPlans,
  getActiveOrganizationPlans,
  getOrganizationPlanById,
  createOrganizationPlan,
  updateOrganizationPlan,
  deleteOrganizationPlan,
  updateOrganizationPlanStatus
};
