// Plan configuration matching backend
export const PLANS = {
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
    storageLimit: 100,
    color: '#94A3B8',
    features: [
      'Create up to 1 exam',
      '1 student',
      'Basic question types',
      'Manual grading',
      'Email support'
    ]
  },
  basic: {
    name: 'Basic',
    price: 100,
    priceRWF: 100000,
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
    storageLimit: 500,
    color: '#3B82F6',
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
    priceRWF: 200000,
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
    examPerMonth: Infinity,
    storageLimit: 2000,
    color: '#8B5CF6',
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
    storageLimit: 10000,
    color: '#F59E0B',
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

export const getPlanConfig = (planName) => {
  return PLANS[planName?.toLowerCase()] || PLANS.free;
};

export const hasFeature = (userPlan, feature) => {
  const plan = getPlanConfig(userPlan);
  return plan[feature] === true;
};

export const checkLimit = (userPlan, limitType, currentCount) => {
  const plan = getPlanConfig(userPlan);
  const limit = plan[limitType];
  
  if (limit === Infinity) return { allowed: true, limit, current: currentCount, remaining: Infinity };
  
  return {
    allowed: currentCount < limit,
    limit,
    current: currentCount,
    remaining: Math.max(0, limit - currentCount)
  };
};

export const formatLimit = (value) => {
  if (value === Infinity) return 'Unlimited';
  return value.toLocaleString();
};

// Get upgrade message for a feature
export const getUpgradeMessage = (feature) => {
  const messages = {
    aiFeatures: 'AI features require Basic plan or higher',
    advancedAI: 'Advanced AI requires Premium plan or higher',
    analytics: 'Analytics dashboard requires Basic plan or higher',
    customBranding: 'Custom branding requires Enterprise plan',
    apiAccess: 'API access requires Enterprise plan',
    marketplaceAccess: 'Marketplace access requires Enterprise plan. Upgrade to list and sell exams on the marketplace.',
    maxExams: 'You\'ve reached your exam limit. Upgrade to create more exams.',
    maxStudents: 'You\'ve reached your student limit. Upgrade to add more students.',
    maxTeachers: 'You\'ve reached your teacher limit. Upgrade to add more teachers.'
  };
  return messages[feature] || 'This feature requires a higher plan';
};

// Get next plan recommendation
export const getRecommendedPlan = (currentPlan, neededFeature) => {
  const plans = ['free', 'basic', 'premium', 'enterprise'];
  const currentIdx = plans.indexOf(currentPlan?.toLowerCase());
  
  for (let i = currentIdx + 1; i < plans.length; i++) {
    if (PLANS[plans[i]][neededFeature]) {
      return plans[i];
    }
  }
  return null;
};

// Format price in RWF
export const formatPriceRWF = (priceRWF) => {
  if (priceRWF === 'custom') return 'Contact Us';
  if (priceRWF === 0 || priceRWF === '0') return 'Free';
  return `${priceRWF.toLocaleString()} RWF`;
};

// Format a DB-editable plan's duration (SubscriptionPlan/OrganizationPlan/
// IndividualPlan) for display, honoring durationUnit when present. Older
// plans only have durationDays (no unit picker yet) — fall back to days.
const UNIT_LABELS = { hours: 'hour', days: 'day', weeks: 'week', months: 'month' };

export const formatPlanDuration = (plan) => {
  if (!plan) return '';
  const unit = plan.durationUnit && UNIT_LABELS[plan.durationUnit] ? plan.durationUnit : 'days';
  const value = plan.durationValue ?? (unit === 'hours' ? Math.round(plan.durationDays * 24) : plan.durationDays);
  const label = UNIT_LABELS[unit];
  return `${value} ${label}${value === 1 ? '' : 's'}`;
};
