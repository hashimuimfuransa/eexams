// Plan configuration - defines features and limits for each subscription tier.
// The objects below (PLANS/ORG_PLANS) are the hardcoded DEFAULTS for each
// tier. Basic/Premium/Enterprise limits are now super-admin-editable via the
// OrganizationPlan/IndividualPlan DB catalogs (Organization/Individual Plan
// Management in Super Admin) — resolvePlanConfig() below merges any DB
// overrides on top of these defaults at request time. Free stays purely
// hardcoded since it's never a purchasable catalog entry.
const { LIMIT_FIELDS, FEATURE_FLAGS, UNLIMITED_SENTINEL } = require('../utils/planLimits');

// Individual teacher plans
const PLANS = {
  free: {
    name: 'Free',
    price: 0,
    priceRWF: 0,
    maxExams: 1,
    maxStudents: 1,
    maxTeachers: 1,
    aiFeatures: false,
    advancedAI: false,
    analytics: false,
    prioritySupport: false,
    customBranding: false,
    apiAccess: false,
    marketplaceAccess: false,
    templates: false,
    examPerMonth: 1,
    storageLimit: 100, // MB
    features: [
      'Create up to 1 exam',
      '1 student',
      '1 teacher account',
      'Basic question types',
      'Manual grading',
      'Email support'
    ]
  },
  basic: {
    name: 'Basic',
    price: 100,
    priceRWF: 100000, // 100,000 RWF
    maxExams: 30,
    maxStudents: 200,
    maxTeachers: 3,
    aiFeatures: true,
    advancedAI: false,
    analytics: true,
    prioritySupport: false,
    customBranding: false,
    apiAccess: false,
    marketplaceAccess: false,
    templates: true,
    examPerMonth: 30,
    storageLimit: 500, // MB
    features: [
      'Create up to 30 exams',
      'Up to 200 students',
      'Basic AI question generation',
      'Full analytics dashboard',
      'Priority email support'
    ]
  },
  premium: {
    name: 'Premium',
    price: 200,
    priceRWF: 200000, // 200,000 RWF
    maxExams: Infinity,
    maxStudents: Infinity,
    maxTeachers: 10,
    aiFeatures: true,
    advancedAI: true,
    analytics: true,
    prioritySupport: true,
    customBranding: false,
    apiAccess: false,
    marketplaceAccess: false,
    templates: true,
    examPerMonth: Infinity,
    storageLimit: 2000, // MB
    features: [
      'Unlimited exams',
      'Unlimited students',
      'Advanced AI features',
      'Full analytics',
      'Priority support',
      'Auto-grading',
      'Question bank'
    ]
  },
  enterprise: {
    name: 'Enterprise',
    price: 'custom',
    priceRWF: 'custom',
    maxExams: Infinity,
    maxStudents: Infinity,
    maxTeachers: Infinity,
    aiFeatures: true,
    advancedAI: true,
    analytics: true,
    prioritySupport: true,
    customBranding: true,
    apiAccess: true,
    marketplaceAccess: true,
    templates: true,
    examPerMonth: Infinity,
    storageLimit: 10000, // MB
    features: [
      'Everything in Premium',
      'Unlimited teachers',
      'White-label & custom branding',
      'Full API access',
      'Dedicated account manager',
      'Custom integrations',
      'SLA guarantee',
      'On-premise deployment option',
      'Bulk student import',
      'Multi-school management',
      'Marketplace access - list and sell exams'
    ]
  }
};

// Helper function to get plan config (hardcoded defaults only, individual
// plans, no DB lookup — kept for any sync-context caller that just needs the
// baseline; getPlanConfigForUser below is the authoritative, DB-aware one).
const getPlanConfig = (planName) => {
  return PLANS[planName?.toLowerCase()] || PLANS.free;
};

// Check if a *resolved* plan config (from getPlanConfigForUser) has a feature.
// Takes the config object itself, not a plan name — callers must resolve the
// plan first so org vs individual and DB overrides are already applied.
const hasFeature = (planConfig, feature) => {
  return planConfig[feature] === true;
};

// Check if a *resolved* plan config (from getPlanConfigForUser) permits
// currentCount more of limitType. Takes the config object itself, not a plan
// name — see hasFeature.
const checkLimit = (planConfig, limitType, currentCount) => {
  const limit = planConfig[limitType];

  if (limit === Infinity) return { allowed: true };

  return {
    allowed: currentCount < limit,
    limit,
    current: currentCount,
    remaining: limit - currentCount
  };
};

// Organisation plans — higher price, teacher limits enforced
const ORG_PLANS = {
  free: {
    name: 'Free Trial',
    price: 0,
    priceRWF: 0,
    maxExams: 1,
    maxStudents: 5,
    maxTeachers: 1,
    aiFeatures: false,
    advancedAI: false,
    analytics: false,
    prioritySupport: false,
    customBranding: false,
    apiAccess: false,
    marketplaceAccess: false,
    templates: false,
    storageLimit: 100,
    features: [
      '1 teacher account',
      'Up to 5 students',
      '1 exam',
      'Basic support',
      'No credit card required'
    ]
  },
  basic: {
    name: 'Basic (Org)',
    price: 100,
    priceRWF: 100000,
    maxExams: 50,
    maxStudents: 300,
    maxTeachers: 5,
    aiFeatures: true,
    advancedAI: false,
    analytics: true,
    prioritySupport: false,
    customBranding: false,
    apiAccess: false,
    marketplaceAccess: false,
    templates: true,
    storageLimit: 1000,
    features: [
      'Up to 5 teacher accounts',
      'Up to 300 students',
      '50 exams/month',
      'AI features',
      'Full analytics',
      'Priority email support'
    ]
  },
  premium: {
    name: 'Premium (Org)',
    price: 300,
    priceRWF: 300000,
    maxExams: Infinity,
    maxStudents: Infinity,
    maxTeachers: 20,
    aiFeatures: true,
    advancedAI: true,
    analytics: true,
    prioritySupport: true,
    customBranding: false,
    apiAccess: false,
    marketplaceAccess: false,
    templates: true,
    storageLimit: 5000,
    features: [
      'Up to 20 teacher accounts',
      'Unlimited students',
      'Unlimited exams',
      'Advanced AI',
      'Full analytics',
      '24/7 priority support',
      'Auto-grading'
    ]
  },
  enterprise: {
    name: 'Enterprise (Org)',
    price: 'custom',
    priceRWF: 'custom',
    maxExams: Infinity,
    maxStudents: Infinity,
    maxTeachers: Infinity,
    aiFeatures: true,
    advancedAI: true,
    analytics: true,
    prioritySupport: true,
    customBranding: true,
    apiAccess: true,
    marketplaceAccess: true,
    templates: true,
    storageLimit: 20000,
    features: [
      'Unlimited teacher accounts',
      'Unlimited students & exams',
      'Everything in Premium',
      'White-label & custom branding',
      'Full API access',
      'Dedicated account manager',
      'SLA guarantee',
      'On-premise option',
      'Bulk import',
      'Multi-school management',
      'Marketplace access - list and sell exams'
    ]
  }
};

// Hardcoded default for a tier/userType, with no DB lookup — the fallback
// base that DB overrides are merged onto.
const getHardcodedPlanConfig = (planName, userType) => {
  const map = userType === 'organization' ? ORG_PLANS : PLANS;
  return map[planName?.toLowerCase()] || map.free;
};

// Get the right plan config based on userType, merging in any super-admin
// edited limits/features from the DB catalog (OrganizationPlan/IndividualPlan)
// on top of the hardcoded defaults. Async because it may hit the DB — every
// caller must await it. Free tier is never in the DB catalog, so it always
// returns the hardcoded config untouched.
const getPlanConfigForUser = async (planName, userType) => {
  const key = planName?.toLowerCase() || 'free';
  const base = getHardcodedPlanConfig(key, userType);
  if (key === 'free') return base;

  // Lazy require avoids any load-order issues if a model file ever ends up
  // requiring config/plans.js transitively.
  const Model = userType === 'organization'
    ? require('../models/OrganizationPlan')
    : require('../models/IndividualPlan');

  let dbPlan = null;
  try {
    dbPlan = await Model.findOne({ tierKey: key, status: 'active' }).sort({ updatedAt: -1 }).lean();
  } catch (error) {
    console.error('getPlanConfigForUser: failed to load DB plan overrides, falling back to defaults', error);
  }

  if (!dbPlan) return base;

  const merged = { ...base, name: dbPlan.name || base.name };
  [...LIMIT_FIELDS, ...FEATURE_FLAGS].forEach((field) => {
    const value = dbPlan[field];
    if (value === undefined || value === null) return;
    merged[field] = value === UNLIMITED_SENTINEL ? Infinity : value;
  });

  return merged;
};

module.exports = {
  PLANS,
  ORG_PLANS,
  getPlanConfig,
  getPlanConfigForUser,
  hasFeature,
  checkLimit
};
