const IndividualPlan = require('../models/IndividualPlan');
const { resolvePlanDuration } = require('../utils/planDuration');
const { extractLimitOverrides, PLAN_SCOPES, DEFAULT_PLAN_SCOPE, TIER_ORDER } = require('../utils/planLimits');

// @desc    Get all individual (teacher) plans
// @route   GET /api/individual-plans
// @access  Private
const getIndividualPlans = async (req, res) => {
  try {
    const { status, tierKey, scope } = req.query;

    const query = {};
    if (status) query.status = status;
    if (tierKey) query.tierKey = tierKey;
    if (scope) query.scope = scope;

    const plans = await IndividualPlan.find(query)
      .populate('createdBy', 'fullName')
      .sort({ price: 1 });

    res.json(plans);
  } catch (error) {
    console.error('Get individual plans error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get active individual plans (purchase catalog)
// @route   GET /api/individual-plans/active
// @access  Private
const getActiveIndividualPlans = async (req, res) => {
  try {
    const plans = await IndividualPlan.getActivePlans();
    res.json(plans);
  } catch (error) {
    console.error('Get active individual plans error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get individual plan by ID
// @route   GET /api/individual-plans/:id
// @access  Private
const getIndividualPlanById = async (req, res) => {
  try {
    const plan = await IndividualPlan.findById(req.params.id).populate('createdBy', 'fullName');
    if (!plan) {
      return res.status(404).json({ message: 'Individual plan not found' });
    }
    res.json(plan);
  } catch (error) {
    console.error('Get individual plan error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Create new individual plan
// @route   POST /api/individual-plans
// @access  Private/SuperAdmin
const createIndividualPlan = async (req, res) => {
  try {
    const { tierKey, name, scope, description, isPopular, badgeText, price, currency, durationDays, durationValue, durationUnit, status, features, discountPercentage } = req.body;

    if (!tierKey || !TIER_ORDER.includes(tierKey)) {
      return res.status(400).json({ message: `Invalid tier. Must be one of: ${TIER_ORDER.join(', ')}` });
    }
    if (scope !== undefined && !PLAN_SCOPES.includes(scope)) {
      return res.status(400).json({ message: `Invalid scope. Must be one of: ${PLAN_SCOPES.join(', ')}` });
    }
    if (!name || price === undefined) {
      return res.status(400).json({ message: 'name and price are required' });
    }
    const resolvedDuration = resolvePlanDuration({ durationValue, durationUnit, durationDays });
    if (!resolvedDuration) {
      return res.status(400).json({ message: 'A valid duration (value and unit, in hours or days) is required' });
    }

    const plan = await IndividualPlan.create({
      tierKey,
      name,
      scope: scope || DEFAULT_PLAN_SCOPE,
      description: description || '',
      isPopular: Boolean(isPopular),
      ...(badgeText === undefined ? {} : { badgeText }),
      price,
      currency: currency || 'RWF',
      durationDays: resolvedDuration.durationDays,
      durationValue: resolvedDuration.durationValue,
      durationUnit: resolvedDuration.durationUnit,
      status: status || 'active',
      features: features || [],
      discountPercentage: discountPercentage || 0,
      createdBy: req.user._id,
      ...extractLimitOverrides(req.body)
    });

    res.status(201).json(plan);
  } catch (error) {
    console.error('Create individual plan error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update individual plan
// @route   PUT /api/individual-plans/:id
// @access  Private/SuperAdmin
const updateIndividualPlan = async (req, res) => {
  try {
    const { tierKey, name, scope, description, isPopular, badgeText, price, currency, durationDays, durationValue, durationUnit, status, features, discountPercentage } = req.body;

    const plan = await IndividualPlan.findById(req.params.id);
    if (!plan) {
      return res.status(404).json({ message: 'Individual plan not found' });
    }

    if (tierKey && !TIER_ORDER.includes(tierKey)) {
      return res.status(400).json({ message: `Invalid tier. Must be one of: ${TIER_ORDER.join(', ')}` });
    }
    if (scope !== undefined && !PLAN_SCOPES.includes(scope)) {
      return res.status(400).json({ message: `Invalid scope. Must be one of: ${PLAN_SCOPES.join(', ')}` });
    }

    if (tierKey !== undefined) plan.tierKey = tierKey;
    if (name !== undefined) plan.name = name;
    if (scope !== undefined) plan.scope = scope;
    if (description !== undefined) plan.description = description;
    if (isPopular !== undefined) plan.isPopular = Boolean(isPopular);
    if (badgeText !== undefined) plan.badgeText = badgeText;
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
    Object.assign(plan, extractLimitOverrides(req.body));

    await plan.save();

    res.json(plan);
  } catch (error) {
    console.error('Update individual plan error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Delete individual plan
// @route   DELETE /api/individual-plans/:id
// @access  Private/SuperAdmin
const deleteIndividualPlan = async (req, res) => {
  try {
    const plan = await IndividualPlan.findById(req.params.id);
    if (!plan) {
      return res.status(404).json({ message: 'Individual plan not found' });
    }

    await IndividualPlan.findByIdAndDelete(req.params.id);

    res.json({ message: 'Individual plan deleted successfully' });
  } catch (error) {
    console.error('Delete individual plan error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Activate/Deactivate individual plan
// @route   PATCH /api/individual-plans/:id/status
// @access  Private/SuperAdmin
const updateIndividualPlanStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const plan = await IndividualPlan.findById(req.params.id);
    if (!plan) {
      return res.status(404).json({ message: 'Individual plan not found' });
    }

    plan.status = status;
    await plan.save();

    res.json(plan);
  } catch (error) {
    console.error('Update individual plan status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getIndividualPlans,
  getActiveIndividualPlans,
  getIndividualPlanById,
  createIndividualPlan,
  updateIndividualPlan,
  deleteIndividualPlan,
  updateIndividualPlanStatus
};
