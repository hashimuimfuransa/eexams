const { checkLimit, hasFeature, getPlanConfig, getPlanConfigForUser } = require('../config/plans');
const Exam = require('../models/Exam');
const User = require('../models/User');

// Resolve the effective plan for a user:
// - Org teachers inherit their parentAdmin's plan
// - Everyone else uses their own plan
const resolveEffectivePlan = async (user) => {
  if (user.role === 'teacher' && user.parentAdmin) {
    const admin = await User.findById(user.parentAdmin).select('subscriptionPlan userType');
    if (admin) return { plan: admin.subscriptionPlan || 'free', userType: 'organization' };
  }
  return { plan: user.subscriptionPlan || 'free', userType: user.userType || 'individual' };
};

// Middleware to check if user can create more exams
const checkExamLimit = async (req, res, next) => {
  try {
    const user = req.user;
    const { plan, userType } = await resolveEffectivePlan(user);
    const planConfig = getPlanConfigForUser(plan, userType);
    
    // Count current exams created by this user
    const examCount = await Exam.countDocuments({ createdBy: user._id });
    
    const check = checkLimit(plan, 'maxExams', examCount);
    
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
    const { plan, userType } = await resolveEffectivePlan(user);
    const planConfig = getPlanConfigForUser(plan, userType);
    
    const studentQuery = { role: 'student', createdBy: user._id };
    const studentCount = await User.countDocuments(studentQuery);
    
    const check = checkLimit(plan, 'maxStudents', studentCount);
    
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
    
    const { plan, userType } = await resolveEffectivePlan(user);
    const planConfig = getPlanConfigForUser(plan, userType);
    
    // Count teachers in this organization
    const teacherCount = await User.countDocuments({ 
      role: 'teacher',
      parentAdmin: user._id 
    });
    
    const check = checkLimit(plan, 'maxTeachers', teacherCount);
    
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
  const { plan } = await resolveEffectivePlan(user);
  
  if (!hasFeature(plan, 'aiFeatures')) {
    return res.status(403).json({
      message: 'AI features require Basic plan or higher. Please upgrade your subscription.',
      code: 'FEATURE_NOT_AVAILABLE',
      upgradeRequired: true,
      requiredPlan: 'basic'
    });
  }
  
  next();
};

// Middleware to check if user has access to advanced AI features
const requireAdvancedAI = async (req, res, next) => {
  const user = req.user;
  const { plan } = await resolveEffectivePlan(user);
  
  if (!hasFeature(plan, 'advancedAI')) {
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
  const { plan } = await resolveEffectivePlan(user);
  
  if (!hasFeature(plan, 'analytics')) {
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
  const { plan } = await resolveEffectivePlan(user);
  
  if (!hasFeature(plan, 'apiAccess')) {
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
  const { plan } = await resolveEffectivePlan(user);
  
  if (!hasFeature(plan, 'customBranding')) {
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
  const { plan } = await resolveEffectivePlan(user);
  
  if (!hasFeature(plan, 'marketplaceAccess')) {
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
  const { plan } = await resolveEffectivePlan(user);
  
  if (!hasFeature(plan, 'templates')) {
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
    
    const { plan, userType } = await resolveEffectivePlan(user);
    const planConfig = getPlanConfigForUser(plan, userType);
    
    // Get counts
    const examCount = await Exam.countDocuments({ createdBy: userId });
    const studentCount = await User.countDocuments({ 
      role: 'student',
      createdBy: userId 
    });
    
    let teacherCount = 0;
    if (user.userType === 'organization') {
      teacherCount = await User.countDocuments({ 
        role: 'teacher',
        parentAdmin: userId 
      });
    }
    
    // Calculate days left
    let daysLeft = null;
    let subscriptionExpiresAt = null;
    if (user.subscriptionExpiresAt) {
      subscriptionExpiresAt = user.subscriptionExpiresAt;
      const now = new Date();
      const diffTime = subscriptionExpiresAt - now;
      daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (daysLeft < 0) daysLeft = 0;
    }
    
    return {
      plan,
      planName: planConfig.name,
      subscriptionStatus: user.subscriptionStatus,
      subscriptionExpiresAt,
      daysLeft,
      limits: {
        exams: { limit: planConfig.maxExams, used: examCount },
        students: { limit: planConfig.maxStudents, used: studentCount },
        teachers: { limit: planConfig.maxTeachers, used: teacherCount }
      },
      features: {
        aiFeatures: planConfig.aiFeatures,
        advancedAI: planConfig.advancedAI,
        analytics: planConfig.analytics,
        prioritySupport: planConfig.prioritySupport,
        customBranding: planConfig.customBranding,
        apiAccess: planConfig.apiAccess,
        marketplaceAccess: planConfig.marketplaceAccess
      }
    };
  } catch (error) {
    console.error('Get plan usage error:', error);
    return null;
  }
};

module.exports = {
  resolveEffectivePlan,
  checkExamLimit,
  checkStudentLimit,
  checkTeacherLimit,
  requireAIFeatures,
  requireAdvancedAI,
  requireAnalytics,
  requireAPIAccess,
  requireCustomBranding,
  requireMarketplaceAccess,
  requireTemplatesAccess,
  getPlanUsage
};
