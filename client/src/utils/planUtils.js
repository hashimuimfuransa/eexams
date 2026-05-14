// Plan configuration matching backend
export const PLANS = {
  free: {
    name: 'Free',
    price: 0,
    priceRWF: 0,
    maxExams: 5,
    maxStudents: 30,
    maxTeachers: 1,
    aiFeatures: false,
    advancedAI: false,
    analytics: false,
    prioritySupport: false,
    customBranding: false,
    apiAccess: false,
    examPerMonth: 5,
    storageLimit: 100,
    color: '#94A3B8',
    features: [
      'Create up to 5 exams',
      'Up to 30 students',
      'Basic question types',
      'Manual grading',
      'Email support'
    ]
  },
  basic: {
    name: 'Basic',
    price: 9,
    priceRWF: 9000,
    maxExams: 30,
    maxStudents: 200,
    maxTeachers: 3,
    aiFeatures: true,
    advancedAI: false,
    analytics: true,
    prioritySupport: false,
    customBranding: false,
    apiAccess: false,
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
    price: 29,
    priceRWF: 29000,
    maxExams: Infinity,
    maxStudents: Infinity,
    maxTeachers: 10,
    aiFeatures: true,
    advancedAI: true,
    analytics: true,
    prioritySupport: true,
    customBranding: false,
    apiAccess: false,
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
      'Multi-school management'
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
