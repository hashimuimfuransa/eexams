const { checkLimit, hasFeature, allowsExams, allowsLessonPlanner, getPlanConfig, getPlanConfigForUser } = require('../config/plans');
const Exam = require('../models/Exam');
const User = require('../models/User');
const { getEffectiveSubscriptionStatus, getSubscriptionExpiryDate, syncSubscriptionStatus } = require('../utils/subscriptionStatus');
const { getAllQuotaStatus } = require('../utils/plannerQuotas');

// Resolve the effective plan for a user:
// - Org teachers inherit their parentAdmin's plan
// - Everyone else uses their own plan
// statusSource is whichever account (self, or parentAdmin for org teachers)
// actually owns the subscriptionStatus/subscriptionExpiresAt that should be
// shown/enforced — an org teacher's own subscription fields are unused
// boilerplate, the org's plan is what governs their access.
// planRef is the exact catalog document the subscription came from, passed on
// to getPlanConfigForUser so a tier that exists at several scopes/prices
// resolves to the one actually bought rather than an arbitrary sibling.
const resolveEffectivePlan = async (user) => {
  if (user.role === 'teacher' && user.parentAdmin) {
    const admin = await User.findById(user.parentAdmin)
      .select('subscriptionPlan subscriptionPlanRef userType subscriptionStatus subscriptionExpiresAt subscriptionEndDate');
    if (admin) {
      return {
        plan: admin.subscriptionPlan || 'free',
        userType: 'organization',
        planRef: admin.subscriptionPlanRef || null,
        statusSource: admin
      };
    }
  }
  return {
    plan: user.subscriptionPlan || 'free',
    userType: user.userType || 'individual',
    planRef: user.subscriptionPlanRef || null,
    statusSource: user
  };
};

// Middleware to check if user can create more exams
const checkExamLimit = async (req, res, next) => {
  try {
    const user = req.user;
    const { plan, userType, planRef } = await resolveEffectivePlan(user);
    const planConfig = await getPlanConfigForUser(plan, userType, planRef);

    // A Lesson-Planner-only plan has no exam product at all — say so, rather
    // than reporting it as a numeric limit of 0 exams.
    if (!allowsExams(planConfig)) {
      return res.status(403).json({
        message: `The ${planConfig.name} plan covers the Lesson Planner only. Upgrade to a plan that includes exams to create one.`,
        code: 'PLAN_SCOPE_EXCLUDED',
        scope: planConfig.scope,
        requiredScope: 'exams',
        upgradeRequired: true
      });
    }

    // Count current exams created by this user
    const examCount = await Exam.countDocuments({ createdBy: user._id });

    const check = checkLimit(planConfig, 'maxExams', examCount);
    
    if (!check.allowed) {
      return res.status(403).json({
        message: `Plan limit reached. The ${planConfig.name} plan allows ${check.limit} exams.`,
        code: 'PLAN_LIMIT_EXCEEDED',
        limit: check.limit,
        current: check.current,
        upgradeRequired: true
      });
    }
    
    // Attach limit info to request for potential use
    req.planLimits = {
      examLimit: check.limit,
      currentExams: check.current,
      remaining: check.remaining
    };
    
    next();
  } catch (error) {
    console.error('Check exam limit error:', error);
    res.status(500).json({ message: 'Server error checking plan limits' });
  }
};

// Middleware to check if user can add more students
const checkStudentLimit = async (req, res, next) => {
  try {
    const user = req.user;
    const { plan, userType, planRef } = await resolveEffectivePlan(user);
    const planConfig = await getPlanConfigForUser(plan, userType, planRef);

    const studentQuery = { role: 'student', createdBy: user._id };
    const studentCount = await User.countDocuments(studentQuery);

    const check = checkLimit(planConfig, 'maxStudents', studentCount);
    
    if (!check.allowed) {
      return res.status(403).json({
        message: `Plan limit reached. The ${planConfig.name} plan allows ${check.limit} students.`,
        code: 'PLAN_LIMIT_EXCEEDED',
        limit: check.limit,
        current: check.current,
        upgradeRequired: true
      });
    }
    
    req.planLimits = {
      ...req.planLimits,
      studentLimit: check.limit,
      currentStudents: check.current,
      remainingStudents: check.remaining
    };
    
    next();
  } catch (error) {
    console.error('Check student limit error:', error);
    res.status(500).json({ message: 'Server error checking plan limits' });
  }
};

// Middleware to check if user can add more teachers (for organizations)
const checkTeacherLimit = async (req, res, next) => {
  try {
    const user = req.user;
    
    // Only check for organization admins
    if (user.userType !== 'organization') {
      return next();
    }
    
    const { plan, userType, planRef } = await resolveEffectivePlan(user);
    const planConfig = await getPlanConfigForUser(plan, userType, planRef);

    // Count teachers in this organization
    const teacherCount = await User.countDocuments({
      role: 'teacher',
      parentAdmin: user._id
    });

    const check = checkLimit(planConfig, 'maxTeachers', teacherCount);
    
    if (!check.allowed) {
      return res.status(403).json({
        message: `Plan limit reached. The ${planConfig.name} plan allows ${check.limit} teachers.`,
        code: 'PLAN_LIMIT_EXCEEDED',
        limit: check.limit,
        current: check.current,
        upgradeRequired: true
      });
    }
    
    next();
  } catch (error) {
    console.error('Check teacher limit error:', error);
    res.status(500).json({ message: 'Server error checking plan limits' });
  }
};

// Middleware to check if user has access to AI features
const requireAIFeatures = async (req, res, next) => {
  const user = req.user;
  const { plan, userType, planRef } = await resolveEffectivePlan(user);
  const planConfig = await getPlanConfigForUser(plan, userType, planRef);

  if (!hasFeature(planConfig, 'aiFeatures')) {
    return res.status(403).json({
      message: 'AI features require Basic plan or higher. Please upgrade your subscription.',
      code: 'FEATURE_NOT_AVAILABLE',
      upgradeRequired: true,
      requiredPlan: 'basic'
    });
  }
  
  next();
};

// Middleware for routes that belong to the exam product — blocked for accounts
// on a plan sold for the Lesson Planner alone. Separate from checkExamLimit,
// which additionally counts existing exams and only guards creation.
const requireExamAccess = async (req, res, next) => {
  const user = req.user;
  const { plan, userType, planRef } = await resolveEffectivePlan(user);
  const planConfig = await getPlanConfigForUser(plan, userType, planRef);

  if (!allowsExams(planConfig)) {
    return res.status(403).json({
      message: `The ${planConfig.name} plan covers the Lesson Planner only. Upgrade to a plan that includes exams to use this.`,
      code: 'PLAN_SCOPE_EXCLUDED',
      scope: planConfig.scope,
      requiredScope: 'exams',
      upgradeRequired: true
    });
  }

  next();
};

// Middleware for the Lesson Planner — blocked for accounts on a plan sold for
// exams alone. Note this is a *scope* gate, not an AI gate: AI generation
// inside the planner is still separately guarded by requireAIFeatures, so a
// free account keeps the planner's manual authoring exactly as before.
const requireLessonPlanner = async (req, res, next) => {
  const user = req.user;
  const { plan, userType, planRef } = await resolveEffectivePlan(user);
  const planConfig = await getPlanConfigForUser(plan, userType, planRef);

  if (!allowsLessonPlanner(planConfig)) {
    return res.status(403).json({
      message: `The ${planConfig.name} plan covers exams only. Upgrade to a plan that includes the Lesson Planner to use it.`,
      code: 'PLAN_SCOPE_EXCLUDED',
      scope: planConfig.scope,
      requiredScope: 'lesson_planner',
      upgradeRequired: true
    });
  }

  next();
};

// Middleware to check if user has access to advanced AI features
const requireAdvancedAI = async (req, res, next) => {
  const user = req.user;
  const { plan, userType, planRef } = await resolveEffectivePlan(user);
  const planConfig = await getPlanConfigForUser(plan, userType, planRef);

  if (!hasFeature(planConfig, 'advancedAI')) {
    return res.status(403).json({
      message: 'Advanced AI features require Premium plan or higher. Please upgrade your subscription.',
      code: 'FEATURE_NOT_AVAILABLE',
      upgradeRequired: true,
      requiredPlan: 'premium'
    });
  }
  
  next();
};

// Middleware to check if user has access to analytics
const requireAnalytics = async (req, res, next) => {
  const user = req.user;
  const { plan, userType, planRef } = await resolveEffectivePlan(user);
  const planConfig = await getPlanConfigForUser(plan, userType, planRef);

  if (!hasFeature(planConfig, 'analytics')) {
    return res.status(403).json({
      message: 'Analytics dashboard requires Basic plan or higher. Please upgrade your subscription.',
      code: 'FEATURE_NOT_AVAILABLE',
      upgradeRequired: true,
      requiredPlan: 'basic'
    });
  }
  
  next();
};

// Middleware to check if user has API access
const requireAPIAccess = async (req, res, next) => {
  const user = req.user;
  const { plan, userType, planRef } = await resolveEffectivePlan(user);
  const planConfig = await getPlanConfigForUser(plan, userType, planRef);

  if (!hasFeature(planConfig, 'apiAccess')) {
    return res.status(403).json({
      message: 'API access requires Enterprise plan. Please upgrade your subscription.',
      code: 'FEATURE_NOT_AVAILABLE',
      upgradeRequired: true,
      requiredPlan: 'enterprise'
    });
  }
  
  next();
};

// Middleware to check if user has custom branding
const requireCustomBranding = async (req, res, next) => {
  const user = req.user;
  const { plan, userType, planRef } = await resolveEffectivePlan(user);
  const planConfig = await getPlanConfigForUser(plan, userType, planRef);

  if (!hasFeature(planConfig, 'customBranding')) {
    return res.status(403).json({
      message: 'Custom branding requires Enterprise plan. Please upgrade your subscription.',
      code: 'FEATURE_NOT_AVAILABLE',
      upgradeRequired: true,
      requiredPlan: 'enterprise'
    });
  }
  
  next();
};

// Middleware to check if user has marketplace access
const requireMarketplaceAccess = async (req, res, next) => {
  const user = req.user;
  const { plan, userType, planRef } = await resolveEffectivePlan(user);
  const planConfig = await getPlanConfigForUser(plan, userType, planRef);

  if (!hasFeature(planConfig, 'marketplaceAccess')) {
    return res.status(403).json({
      message: 'Marketplace access requires Enterprise plan. Please upgrade your subscription to list and sell exams on the marketplace.',
      code: 'FEATURE_NOT_AVAILABLE',
      upgradeRequired: true,
      requiredPlan: 'enterprise'
    });
  }
  
  next();
};

// Middleware to check if user has templates access
const requireTemplatesAccess = async (req, res, next) => {
  const user = req.user;
  const { plan, userType, planRef } = await resolveEffectivePlan(user);
  const planConfig = await getPlanConfigForUser(plan, userType, planRef);

  if (!hasFeature(planConfig, 'templates')) {
    return res.status(403).json({
      message: 'Templates feature requires Basic plan or higher. Please upgrade your subscription to save and use exam templates.',
      code: 'FEATURE_NOT_AVAILABLE',
      upgradeRequired: true,
      requiredPlan: 'basic'
    });
  }
  
  next();
};

// Get current plan usage stats
const getPlanUsage = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) return null;

    const { plan, userType, planRef, statusSource } = await resolveEffectivePlan(user);
    const planConfig = await getPlanConfigForUser(plan, userType, planRef);

    // Get counts
    const examCount = await Exam.countDocuments({ createdBy: userId });
    const studentCount = await User.countDocuments({
      role: 'student',
      createdBy: userId
    });

    // Only organisations manage a team of teachers — an individual teacher
    // account has no "teachers" concept of its own, so omit the limit
    // entirely instead of showing a meaningless "1 teacher account" bar.
    const isOrg = user.userType === 'organization';
    let teacherCount = 0;
    if (isOrg) {
      teacherCount = await User.countDocuments({
        role: 'teacher',
        parentAdmin: userId
      });
    }

    // Effective status: subscriptionStatus on statusSource is only flipped to
    // 'expired' lazily, so compare the actual expiry timestamp (hour-precise,
    // not just the calendar date) rather than trusting that stored field —
    // otherwise a plan that expired a few hours ago still reads as "active".
    const effectiveExpiresAt = getSubscriptionExpiryDate(statusSource);
    const subscriptionStatus = getEffectiveSubscriptionStatus(statusSource);
    await syncSubscriptionStatus(statusSource);

    // Calculate time left (enterprise plans don't expire)
    let daysLeft = null;
    let hoursLeft = null;
    let subscriptionExpiresAt = null;
    if (effectiveExpiresAt && plan !== 'enterprise') {
      subscriptionExpiresAt = effectiveExpiresAt;
      const diffTime = new Date(effectiveExpiresAt).getTime() - Date.now();
      if (diffTime <= 0) {
        daysLeft = 0;
        hoursLeft = 0;
      } else {
        daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        // Under a day left: report hours instead, so a plan measured in
        // hours (e.g. a 4-hour plan) doesn't misleadingly show "1 day".
        if (diffTime < 24 * 60 * 60 * 1000) {
          hoursLeft = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60)));
        }
      }
    }

    const plannerQuotas = allowsLessonPlanner(planConfig)
      ? await getAllQuotaStatus(userId, planConfig)
      : [];

    // JSON has no Infinity — it silently serializes to null over the wire,
    // which the frontend can't distinguish from "no limit set". Send the
    // same -1 sentinel used by the DB catalog (server/utils/planLimits.js)
    // instead, which PlanUsageCard.jsx already expects.
    const toWireLimit = (limit) => (limit === Infinity ? -1 : limit);

    return {
      plan,
      userType,
      planName: planConfig.name,
      scope: planConfig.scope || 'both',
      subscriptionStatus,
      subscriptionExpiresAt,
      daysLeft,
      hoursLeft,
      // This month's Lesson Planner output allowance and usage, so the planner
      // UI can show "3 of 40 used" without a second round trip.
      plannerQuotas,
      limits: {
        // A Lesson-Planner-only plan has no exam allowance to report — send
        // null (the same "not applicable" signal already used for an
        // individual's teacher limit) so PlanUsageCard omits the bar entirely
        // rather than showing a permanently-full 0/0 one.
        exams: allowsExams(planConfig) ? { limit: toWireLimit(planConfig.maxExams), used: examCount } : null,
        students: { limit: toWireLimit(planConfig.maxStudents), used: studentCount },
        teachers: isOrg ? { limit: toWireLimit(planConfig.maxTeachers), used: teacherCount } : null
      },
      features: {
        // Scope-derived, not stored flags — they say which of the two products
        // this plan sells, so the UI can hide a section the account can't reach
        // instead of only failing at the API.
        exams: allowsExams(planConfig),
        lessonPlanner: allowsLessonPlanner(planConfig),
        aiFeatures: planConfig.aiFeatures,
        docxExport: planConfig.docxExport,
        advancedAI: planConfig.advancedAI,
        analytics: planConfig.analytics,
        prioritySupport: planConfig.prioritySupport,
        customBranding: planConfig.customBranding,
        apiAccess: planConfig.apiAccess,
        marketplaceAccess: planConfig.marketplaceAccess,
        templates: planConfig.templates
      }
    };
  } catch (error) {
    console.error('Get plan usage error:', error);
    return null;
  }
};

// Resolve the accessType a teacher is allowed to save on an exam.
// Only Enterprise-plan accounts may mark an exam "free" (usable without a
// level subscription) — everyone else's exams are always subscription-gated,
// no matter what the client submits. Org teachers inherit their admin's plan
// via resolveEffectivePlan.
const resolveExamAccessType = async (user, requestedAccessType) => {
  const { plan } = await resolveEffectivePlan(user);
  if (plan !== 'enterprise') return 'subscription';
  return requestedAccessType === 'free' ? 'free' : 'subscription';
};

module.exports = {
  resolveEffectivePlan,
  resolveExamAccessType,
  checkExamLimit,
  checkStudentLimit,
  checkTeacherLimit,
  requireAIFeatures,
  requireExamAccess,
  requireLessonPlanner,
  requireAdvancedAI,
  requireAnalytics,
  requireAPIAccess,
  requireCustomBranding,
  requireMarketplaceAccess,
  requireTemplatesAccess,
  getPlanUsage
};
