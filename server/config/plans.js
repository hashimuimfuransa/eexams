// Plan configuration - defines features and limits for each subscription tier

// Individual teacher plans
const PLANS = {
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
    storageLimit: 100, // MB
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
    priceRWF: 9000, // 9,000 RWF
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
    price: 29,
    priceRWF: 29000, // 29,000 RWF
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
      'Multi-school management'
    ]
  }
};

// Helper function to get plan config
const getPlanConfig = (planName) => {
  return PLANS[planName?.toLowerCase()] || PLANS.free;
};

// Check if user has access to a feature
const hasFeature = (userPlan, feature) => {
  const plan = getPlanConfig(userPlan);
  return plan[feature] === true;
};

// Check if user is within limits
const checkLimit = (userPlan, limitType, currentCount) => {
  const plan = getPlanConfig(userPlan);
  const limit = plan[limitType];
  
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
    maxExams: 5,
    maxStudents: 30,
    maxTeachers: 1,
    aiFeatures: false,
    advancedAI: false,
    analytics: false,
    prioritySupport: false,
    customBranding: false,
    apiAccess: false,
    storageLimit: 100,
    features: [
      '1 teacher account',
      'Up to 30 students',
      '5 exams',
      'Basic support',
      'No credit card required'
    ]
  },
  basic: {
    name: 'Basic (Org)',
    price: 15,
    priceRWF: 15000,
    maxExams: 50,
    maxStudents: 300,
    maxTeachers: 5,
    aiFeatures: true,
    advancedAI: false,
    analytics: true,
    prioritySupport: false,
    customBranding: false,
    apiAccess: false,
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
    price: 49,
    priceRWF: 49000,
    maxExams: Infinity,
    maxStudents: Infinity,
    maxTeachers: 20,
    aiFeatures: true,
    advancedAI: true,
    analytics: true,
    prioritySupport: true,
    customBranding: false,
    apiAccess: false,
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
      'Multi-school management'
    ]
  }
};

// Get the right plan config based on userType
const getPlanConfigForUser = (planName, userType) => {
  const map = userType === 'organization' ? ORG_PLANS : PLANS;
  return map[planName?.toLowerCase()] || map.free;
};

module.exports = {
  PLANS,
  ORG_PLANS,
  getPlanConfig,
  getPlanConfigForUser,
  hasFeature,
  checkLimit
};
