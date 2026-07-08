import { usePlanContext } from '../context/PlanContext';

// Converts a wire limit (-1 = unlimited, see server/utils/planLimits.js) into
// the same { allowed, limit, current, remaining } shape the old hardcoded
// checkLimit() returned, so existing callers don't need to change.
const resolveLimitCheck = (limitInfo, currentCount) => {
  const limit = limitInfo?.limit;
  if (limit === undefined || limit === null || limit === -1) {
    return { allowed: true, limit: Infinity, current: currentCount, remaining: Infinity };
  }
  return {
    allowed: currentCount < limit,
    limit,
    current: currentCount,
    remaining: Math.max(0, limit - currentCount)
  };
};

// Live, DB-aware view of the current user's plan — sourced from
// GET /profile/plan-usage (server/middleware/planRestrictions.js
// getPlanUsage), which resolves any super-admin overrides from the
// OrganizationPlan/IndividualPlan catalog on top of the hardcoded defaults.
// Replaces the old hardcoded client/src/utils/planUtils.js computation,
// which never reflected DB edits and always read the individual-teacher
// table even for organizations.
export default function usePlan() {
  const { usage, loading, refresh } = usePlanContext();

  const plan = usage?.plan || 'free';
  const planName = usage?.planName || 'Free';
  const features = usage?.features || {};
  const limits = usage?.limits || {};

  return {
    // Plan info
    plan,
    planName,
    loading,
    refresh,

    // Feature checks
    canUseAI: !!features.aiFeatures,
    canUseAdvancedAI: !!features.advancedAI,
    canUseAnalytics: !!features.analytics,
    hasPrioritySupport: !!features.prioritySupport,
    hasCustomBranding: !!features.customBranding,
    hasAPIAccess: !!features.apiAccess,
    hasMarketplaceAccess: !!features.marketplaceAccess,
    hasTemplatesAccess: !!features.templates,

    // Limit checks (need to pass current count)
    checkExamLimit: (count) => resolveLimitCheck(limits.exams, count),
    checkStudentLimit: (count) => resolveLimitCheck(limits.students, count),
    checkTeacherLimit: (count) => resolveLimitCheck(limits.teachers, count),

    // Check specific feature
    hasFeature: (feature) => !!features[feature],

    // Is free plan
    isFree: plan === 'free',
    isPaid: plan !== 'free',

    // Plan level check
    isBasicOrHigher: ['basic', 'premium', 'enterprise'].includes(plan),
    isPremiumOrHigher: ['premium', 'enterprise'].includes(plan),
    isEnterprise: plan === 'enterprise'
  };
}
