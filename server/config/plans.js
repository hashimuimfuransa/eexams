// Plan configuration - defines features and limits for each subscription tier.
// The objects below (PLANS/ORG_PLANS) are the hardcoded DEFAULTS for each
// tier. Basic/Premium/Enterprise limits are now super-admin-editable via the
// OrganizationPlan/IndividualPlan DB catalogs (Organization/Individual Plan
// Management in Super Admin) — resolvePlanConfig() below merges any DB
// overrides on top of these defaults at request time. Free stays purely
// hardcoded since it's never a purchasable catalog entry.
const {
  LIMIT_FIELDS,
  FEATURE_FLAGS,
  UNLIMITED_SENTINEL,
  DEFAULT_PLAN_SCOPE,
  PLANNER_QUOTA_KEYS,
  normalizeScope,
  scopeAllowsExams,
  scopeAllowsLessonPlanner
} = require('../utils/planLimits');

// Individual teacher plans
const PLANS = {
  free: {
    name: 'Free',
    scope: DEFAULT_PLAN_SCOPE,
    // Lesson Planner monthly output quotas
    lessonPlansPerMonth: 4,
    slidesPerMonth: 3,
    exercisesPerMonth: 3,
    schemesPerMonth: 1,
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
    docxExport: true,
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
    scope: DEFAULT_PLAN_SCOPE,
    // Lesson Planner monthly output quotas
    lessonPlansPerMonth: 40,
    slidesPerMonth: 4,
    exercisesPerMonth: 15,
    schemesPerMonth: 3,
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
    docxExport: true,
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
  // Lesson Planner tiers from the published pricing grid. Prices here are the
  // fallback only — the live figures are the DB catalog entries a super admin
  // edits in Individual Plan Management.
  pro: {
    name: 'Pro',
    scope: DEFAULT_PLAN_SCOPE,
    // Lesson Planner monthly output quotas
    lessonPlansPerMonth: 100,
    slidesPerMonth: 10,
    exercisesPerMonth: 25,
    schemesPerMonth: 10,
    price: 2,
    priceRWF: 2000,
    maxExams: 60,
    maxStudents: 400,
    maxTeachers: 5,
    aiFeatures: true,
    advancedAI: false,
    analytics: true,
    prioritySupport: true,
    customBranding: false,
    apiAccess: false,
    marketplaceAccess: false,
    templates: true,
    docxExport: true,
    examPerMonth: 60,
    storageLimit: 1000, // MB
    features: [
      'More room for busy teachers handling multiple classes and subjects',
      '100 lesson plans/mo',
      'PDF & DOCX export',
      'Priority email support'
    ]
  },
  premium: {
    name: 'Premium',
    scope: DEFAULT_PLAN_SCOPE,
    // Lesson Planner monthly output quotas
    lessonPlansPerMonth: 200,
    slidesPerMonth: 20,
    exercisesPerMonth: 40,
    schemesPerMonth: 20,
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
    docxExport: true,
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
  term_pro: {
    name: 'Term Pro',
    scope: DEFAULT_PLAN_SCOPE,
    // Lesson Planner monthly output quotas
    lessonPlansPerMonth: 300,
    slidesPerMonth: 30,
    exercisesPerMonth: 40,
    schemesPerMonth: 20,
    price: 5,
    priceRWF: 4999,
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
    docxExport: true,
    examPerMonth: Infinity,
    storageLimit: 3000, // MB
    features: [
      'Best for schools or teachers planning across a full term',
      '300 lesson plans/mo',
      'PDF & DOCX export',
      'Priority email support'
    ]
  },
  enterprise: {
    name: 'Enterprise',
    scope: DEFAULT_PLAN_SCOPE,
    // Lesson Planner monthly output quotas
    lessonPlansPerMonth: Infinity,
    slidesPerMonth: Infinity,
    exercisesPerMonth: Infinity,
    schemesPerMonth: Infinity,
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
    docxExport: true,
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
    scope: DEFAULT_PLAN_SCOPE,
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
    docxExport: true,
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
    scope: DEFAULT_PLAN_SCOPE,
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
    docxExport: true,
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
    scope: DEFAULT_PLAN_SCOPE,
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
    docxExport: true,
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
    scope: DEFAULT_PLAN_SCOPE,
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
    docxExport: true,
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
//
// planRef is the exact catalog document the account bought (User
// .subscriptionPlanRef). Prefer it whenever it's known: since individual plans
// carry a `scope`, several *active* plans can share one tier and differ in what
// they sell, so resolving by tier alone would pick an arbitrary one of them.
// Resolution by tier stays as the fallback for free accounts, organisation
// teachers inheriting a tier, and subscriptions that predate subscriptionPlanRef.
// A plan found by id is honoured even when it's since been set inactive —
// retiring a catalog entry must not revoke what an existing customer paid for.
const getPlanConfigForUser = async (planName, userType, planRef = null) => {
  const key = planName?.toLowerCase() || 'free';
  const base = getHardcodedPlanConfig(key, userType);

  // Organisations have no free catalog entry — their free tier stays purely
  // hardcoded, as before. Individuals do: the Free card on the Lesson Planner
  // pricing grid is an editable catalog entry so its monthly quotas can be
  // tuned, even though it is granted at signup and never purchased.
  if (key === 'free' && userType === 'organization') return base;

  // Lazy require avoids any load-order issues if a model file ever ends up
  // requiring config/plans.js transitively.
  const Model = userType === 'organization'
    ? require('../models/OrganizationPlan')
    : require('../models/IndividualPlan');

  let dbPlan = null;
  try {
    if (planRef) {
      dbPlan = await Model.findById(planRef).lean();
    }
    if (!dbPlan) {
      dbPlan = await Model.findOne({ tierKey: key, status: 'active' }).sort({ updatedAt: -1 }).lean();
    }
  } catch (error) {
    console.error('getPlanConfigForUser: failed to load DB plan overrides, falling back to defaults', error);
  }

  if (!dbPlan) return base;

  const merged = { ...base, name: dbPlan.name || base.name, description: dbPlan.description || '' };
  [...LIMIT_FIELDS, ...PLANNER_QUOTA_KEYS, ...FEATURE_FLAGS].forEach((field) => {
    const value = dbPlan[field];
    if (value === undefined || value === null) return;
    merged[field] = value === UNLIMITED_SENTINEL ? Infinity : value;
  });
  merged.scope = normalizeScope(dbPlan.scope);

  // A plan sold for the Lesson Planner alone must not also hand over the exam
  // product through limits inherited from its tier default.
  if (!scopeAllowsExams(merged.scope)) {
    merged.maxExams = 0;
    merged.examPerMonth = 0;
  }

  // Mirror image: an exams-only plan grants no Lesson Planner output.
  if (!scopeAllowsLessonPlanner(merged.scope)) {
    PLANNER_QUOTA_KEYS.forEach((key) => { merged[key] = 0; });
  }

  return merged;
};

// Does a *resolved* plan config (from getPlanConfigForUser) include the exam
// product / the Lesson Planner? Mirrors hasFeature's contract — takes the
// config object, never a plan name.
const allowsExams = (planConfig) => scopeAllowsExams(planConfig?.scope);
const allowsLessonPlanner = (planConfig) => scopeAllowsLessonPlanner(planConfig?.scope);

module.exports = {
  PLANS,
  ORG_PLANS,
  getPlanConfig,
  getPlanConfigForUser,
  hasFeature,
  allowsExams,
  allowsLessonPlanner,
  checkLimit
};
