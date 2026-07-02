const SubscriptionPlan = require('../models/SubscriptionPlan');
const Level = require('../models/Level');
const Exam = require('../models/Exam');
const { resolvePlanDuration } = require('../utils/planDuration');

// @desc    Get all subscription plans
// @route   GET /api/subscription-plans
// @access  Private
const getSubscriptionPlans = async (req, res) => {
  try {
    const { level, exam, status, planType } = req.query;
    
    let query = {};
    if (level) {
      query.level = level;
    }
    if (exam) {
      query.exam = exam;
    }
    if (status) {
      query.status = status;
    }
    if (planType) {
      query.planType = planType;
    }

    const plans = await SubscriptionPlan.find(query)
      .populate('level', 'name description')
      .populate('exam', 'title description')
      .populate('createdBy', 'fullName')
      .sort({ planType: 1, level: 1, durationDays: 1 });

    res.json(plans);
  } catch (error) {
    console.error('Get subscription plans error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get subscription plan by ID
// @route   GET /api/subscription-plans/:id
// @access  Private
const getSubscriptionPlanById = async (req, res) => {
  try {
    const plan = await SubscriptionPlan.findById(req.params.id)
      .populate('level', 'name description')
      .populate('exam', 'title description')
      .populate('createdBy', 'fullName');

    if (!plan) {
      return res.status(404).json({ message: 'Subscription plan not found' });
    }

    res.json(plan);
  } catch (error) {
    console.error('Get subscription plan error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get active plans for a specific level
// @route   GET /api/subscription-plans/level/:levelId/active
// @access  Private
const getActivePlansForLevel = async (req, res) => {
  try {
    const plans = await SubscriptionPlan.getActivePlansForLevel(req.params.levelId, req.query.subLevel || null);

    res.json(plans);
  } catch (error) {
    console.error('Get active plans for level error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get active plans for a specific exam
// @route   GET /api/subscription-plans/exam/:examId/active
// @access  Private
const getActivePlansForExam = async (req, res) => {
  try {
    const plans = await SubscriptionPlan.getActivePlansForExam(req.params.examId);

    res.json(plans);
  } catch (error) {
    console.error('Get active plans for exam error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Create new subscription plan
// @route   POST /api/subscription-plans
// @access  Private/SuperAdmin
const createSubscriptionPlan = async (req, res) => {
  try {
    const { level, exam, subLevel, planType, name, price, currency, durationDays, durationValue, durationUnit, status, features, discountPercentage } = req.body;

    // Validate planType
    if (!planType || !['level', 'exam'].includes(planType)) {
      return res.status(400).json({ message: 'Invalid plan type. Must be "level" or "exam"' });
    }

    const resolvedDuration = resolvePlanDuration({ durationValue, durationUnit, durationDays });
    if (!resolvedDuration) {
      return res.status(400).json({ message: 'A valid duration (value and unit, in hours or days) is required' });
    }

    let resolvedSubLevel = null;

    // Validate based on planType
    if (planType === 'level') {
      if (!level) {
        return res.status(400).json({ message: 'Level is required for level-based plans' });
      }
      const levelExists = await Level.findById(level);
      if (!levelExists) {
        return res.status(400).json({ message: 'Level not found' });
      }
      if (subLevel) {
        const match = levelExists.getActiveSubLevels().find(s => s.name === subLevel);
        if (!match) {
          return res.status(400).json({ message: 'Invalid sub-level for this level' });
        }
        resolvedSubLevel = match.name;
      }
    } else if (planType === 'exam') {
      if (!exam) {
        return res.status(400).json({ message: 'Exam is required for exam-based plans' });
      }
      const examExists = await Exam.findById(exam);
      if (!examExists) {
        return res.status(400).json({ message: 'Exam not found' });
      }
    }

    // Check if plan with same name already exists for the same level/subLevel/exam
    const existingQuery = { name, planType };
    if (planType === 'level') {
      existingQuery.level = level;
      existingQuery.subLevel = resolvedSubLevel;
    } else {
      existingQuery.exam = exam;
    }

    const existingPlan = await SubscriptionPlan.findOne(existingQuery);
    if (existingPlan) {
      return res.status(400).json({ message: 'Plan with this name already exists for this ' + planType });
    }

    const plan = await SubscriptionPlan.create({
      level: planType === 'level' ? level : null,
      subLevel: planType === 'level' ? resolvedSubLevel : null,
      exam: planType === 'exam' ? exam : null,
      planType,
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

    const populatedPlan = await SubscriptionPlan.findById(plan._id)
      .populate('level', 'name description')
      .populate('exam', 'title description')
      .populate('createdBy', 'fullName');

    res.status(201).json(populatedPlan);
  } catch (error) {
    console.error('Create subscription plan error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update subscription plan
// @route   PUT /api/subscription-plans/:id
// @access  Private/SuperAdmin
const updateSubscriptionPlan = async (req, res) => {
  try {
    const { level, exam, subLevel, planType, name, price, currency, durationDays, durationValue, durationUnit, status, features, discountPercentage } = req.body;

    const plan = await SubscriptionPlan.findById(req.params.id);

    if (!plan) {
      return res.status(404).json({ message: 'Subscription plan not found' });
    }

    // Validate planType if being changed
    if (planType && !['level', 'exam'].includes(planType)) {
      return res.status(400).json({ message: 'Invalid plan type. Must be "level" or "exam"' });
    }

    const newPlanType = planType || plan.planType;
    let resolvedSubLevel = plan.subLevel;

    // Validate based on planType
    if (newPlanType === 'level') {
      const effectiveLevelId = level || plan.level?.toString();
      let levelDoc = null;
      if (level && level !== plan.level?.toString()) {
        levelDoc = await Level.findById(level);
        if (!levelDoc) {
          return res.status(400).json({ message: 'Level not found' });
        }
      }
      if (subLevel !== undefined) {
        if (!subLevel) {
          resolvedSubLevel = null;
        } else {
          levelDoc = levelDoc || await Level.findById(effectiveLevelId);
          const match = levelDoc?.getActiveSubLevels().find(s => s.name === subLevel);
          if (!match) {
            return res.status(400).json({ message: 'Invalid sub-level for this level' });
          }
          resolvedSubLevel = match.name;
        }
      }
    } else if (newPlanType === 'exam') {
      if (exam && exam !== plan.exam?.toString()) {
        const examExists = await Exam.findById(exam);
        if (!examExists) {
          return res.status(400).json({ message: 'Exam not found' });
        }
      }
      resolvedSubLevel = null;
    }

    // Check if plan with same name already exists
    if (name || level || exam || planType || subLevel !== undefined) {
      const existingQuery = {
        name: name || plan.name,
        planType: newPlanType,
        _id: { $ne: req.params.id }
      };
      if (newPlanType === 'level') {
        existingQuery.level = level || plan.level;
        existingQuery.subLevel = resolvedSubLevel;
      } else {
        existingQuery.exam = exam || plan.exam;
      }

      const existingPlan = await SubscriptionPlan.findOne(existingQuery);
      if (existingPlan) {
        return res.status(400).json({ message: 'Plan with this name already exists for this ' + newPlanType });
      }
    }

    if (level !== undefined) plan.level = level;
    if (newPlanType === 'level') plan.subLevel = resolvedSubLevel;
    if (exam !== undefined) plan.exam = exam;
    if (planType !== undefined) plan.planType = planType;
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

    const populatedPlan = await SubscriptionPlan.findById(plan._id)
      .populate('level', 'name description')
      .populate('exam', 'title description')
      .populate('createdBy', 'fullName');

    res.json(populatedPlan);
  } catch (error) {
    console.error('Update subscription plan error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Delete subscription plan
// @route   DELETE /api/subscription-plans/:id
// @access  Private/SuperAdmin
const deleteSubscriptionPlan = async (req, res) => {
  try {
    const plan = await SubscriptionPlan.findById(req.params.id);

    if (!plan) {
      return res.status(404).json({ message: 'Subscription plan not found' });
    }

    // Check if plan has active subscriptions
    const Subscription = require('../models/Subscription');
    const activeSubscriptions = await Subscription.countDocuments({ 
      plan: req.params.id,
      status: 'active'
    });

    if (activeSubscriptions > 0) {
      return res.status(400).json({ 
        message: `Cannot delete plan. It has ${activeSubscriptions} active subscription(s).` 
      });
    }

    await SubscriptionPlan.findByIdAndDelete(req.params.id);

    res.json({ message: 'Subscription plan deleted successfully' });
  } catch (error) {
    console.error('Delete subscription plan error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Activate/Deactivate subscription plan
// @route   PATCH /api/subscription-plans/:id/status
// @access  Private/SuperAdmin
const updatePlanStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const plan = await SubscriptionPlan.findById(req.params.id);

    if (!plan) {
      return res.status(404).json({ message: 'Subscription plan not found' });
    }

    plan.status = status;
    await plan.save();

    const populatedPlan = await SubscriptionPlan.findById(plan._id)
      .populate('level', 'name description')
      .populate('exam', 'title description')
      .populate('createdBy', 'fullName');

    res.json(populatedPlan);
  } catch (error) {
    console.error('Update plan status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getSubscriptionPlans,
  getSubscriptionPlanById,
  getActivePlansForLevel,
  getActivePlansForExam,
  createSubscriptionPlan,
  updateSubscriptionPlan,
  deleteSubscriptionPlan,
  updatePlanStatus
};
