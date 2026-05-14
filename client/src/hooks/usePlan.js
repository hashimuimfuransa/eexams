import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { getPlanConfig, hasFeature, checkLimit } from '../utils/planUtils';

export default function usePlan() {
  const { user } = useAuth();
  const plan = user?.subscriptionPlan || 'free';
  const planConfig = useMemo(() => getPlanConfig(plan), [plan]);

  return {
    // Plan info
    plan,
    planName: planConfig.name,
    planConfig,
    
    // Feature checks
    canUseAI: hasFeature(plan, 'aiFeatures'),
    canUseAdvancedAI: hasFeature(plan, 'advancedAI'),
    canUseAnalytics: hasFeature(plan, 'analytics'),
    hasPrioritySupport: hasFeature(plan, 'prioritySupport'),
    hasCustomBranding: hasFeature(plan, 'customBranding'),
    hasAPIAccess: hasFeature(plan, 'apiAccess'),
    
    // Limit checks (need to pass current count)
    checkExamLimit: (count) => checkLimit(plan, 'maxExams', count),
    checkStudentLimit: (count) => checkLimit(plan, 'maxStudents', count),
    checkTeacherLimit: (count) => checkLimit(plan, 'maxTeachers', count),
    
    // Check specific feature
    hasFeature: (feature) => hasFeature(plan, feature),
    
    // Is free plan
    isFree: plan === 'free',
    isPaid: plan !== 'free',
    
    // Plan level check
    isBasicOrHigher: ['basic', 'premium', 'enterprise'].includes(plan),
    isPremiumOrHigher: ['premium', 'enterprise'].includes(plan),
    isEnterprise: plan === 'enterprise'
  };
}
