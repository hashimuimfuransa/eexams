import { usePlanContext } from '../context/PlanContext';
import { isTierAtLeast } from '../utils/planUtils';

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
  // What the plan sells (server/utils/planLimits.js PLAN_SCOPES). Until the
  // usage payload has loaded, assume the permissive 'both' so a page doesn't
  // flash a section away and back on every refresh.
  const scope = usage?.scope || 'both';

  return {
    // Plan info
    plan,
    planName,
    scope,
    loading,
    refresh,

    // Scope checks — which of the two products this plan covers. Distinct from
    // the feature flags below: a plan can include AI and still not sell exams.
    hasExamAccess: usage ? features.exams !== false : true,
    hasLessonPlannerAccess: usage ? features.lessonPlanner !== false : true,

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
    // limits.exams is null when the plan doesn't sell exams at all, which
    // resolveLimitCheck would otherwise read as "no cap". Report it as a hard
    // stop instead, matching the server's PLAN_SCOPE_EXCLUDED response.
    checkExamLimit: (count) => (
      usage && features.exams === false
        ? { allowed: false, limit: 0, current: count, remaining: 0 }
        : resolveLimitCheck(limits.exams, count)
    ),
    checkStudentLimit: (count) => resolveLimitCheck(limits.students, count),
    checkTeacherLimit: (count) => resolveLimitCheck(limits.teachers, count),

    // Check specific feature
    hasFeature: (feature) => !!features[feature],

    // This month's Lesson Planner output allowance (server/utils/plannerQuotas.js)
    plannerQuotas: usage?.plannerQuotas || [],
    lessonPlanQuota: (usage?.plannerQuotas || []).find(q => q.key === 'lessonPlansPerMonth') || null,
    hasDocxExport: features.docxExport !== false,

    // Is free plan
    isFree: plan === 'free',
    isPaid: plan !== 'free',

    // Plan level check — ranked through TIER_ORDER so the Lesson Planner tiers
    // (pro, term_pro) sort correctly instead of falling through as unknown.
    isBasicOrHigher: isTierAtLeast(plan, 'basic'),
    isPremiumOrHigher: isTierAtLeast(plan, 'premium'),
    isEnterprise: plan === 'enterprise'
  };
}
