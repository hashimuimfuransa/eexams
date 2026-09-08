// Shared between OrganizationPlan and IndividualPlan controllers/config —
// the set of enforcement fields a super admin can override per DB plan doc.
// -1 is the JSON-safe sentinel for "unlimited" (Infinity doesn't survive
// JSON.stringify), translated back to Infinity only when a plan is resolved
// for enforcement (see config/plans.js resolvePlanConfig).
const LIMIT_FIELDS = ['maxExams', 'maxStudents', 'maxTeachers', 'examPerMonth', 'storageLimit'];
const FEATURE_FLAGS = ['aiFeatures', 'advancedAI', 'analytics', 'prioritySupport', 'customBranding', 'apiAccess', 'marketplaceAccess', 'templates', 'docxExport'];
const UNLIMITED_SENTINEL = -1;

// Lesson Planner output quotas, all counted per calendar month. Overridable
// per DB plan exactly like LIMIT_FIELDS, and -1 means unlimited here too.
//
// `enforced` says whether a producer for that output exists and its usage is
// actually counted. All four are live: lesson plans come from LessonPlan, the
// other three from PlannerResource keyed by `kind`. Every counter is
// registered in utils/plannerQuotas.js — a quota added here without one there
// would be advertised on the price card but never consumed, so add both.
const PLANNER_QUOTA_FIELDS = [
  { key: 'lessonPlansPerMonth', label: 'Lesson plans', noun: 'lesson plans', enforced: true },
  { key: 'slidesPerMonth', label: 'Slides', noun: 'slides', enforced: true },
  { key: 'exercisesPerMonth', label: 'Exercises', noun: 'exercises', enforced: true },
  { key: 'schemesPerMonth', label: 'Schemes of work', noun: 'schemes', enforced: true }
];

const PLANNER_QUOTA_KEYS = PLANNER_QUOTA_FIELDS.map((q) => q.key);

// Canonical cheapest-to-richest tier order. Everything that asks "is this tier
// at least X" must rank through this rather than hand-writing an array, so
// adding a tier can't silently miss a comparison site.
const TIER_ORDER = ['free', 'basic', 'pro', 'premium', 'term_pro', 'enterprise'];

// Purchasable tiers — TIER_ORDER minus 'free', which is granted at signup.
const PURCHASABLE_TIERS = TIER_ORDER.filter((t) => t !== 'free');

const tierRank = (tier) => {
  const index = TIER_ORDER.indexOf(String(tier || '').toLowerCase());
  return index === -1 ? 0 : index;
};

const isTierAtLeast = (tier, minimum) => tierRank(tier) >= tierRank(minimum);

// What a plan actually sells. Individual (teacher) plans can be priced for the
// Lesson Planner alone, for the exam product alone, or for both — see
// server/models/IndividualPlan.js `scope`. Organisation plans and the free
// tier are always 'both', and plans created before this field existed have no
// stored value, so DEFAULT_PLAN_SCOPE is 'both' and nothing regresses.
const PLAN_SCOPES = ['exams', 'lesson_planner', 'both'];
const DEFAULT_PLAN_SCOPE = 'both';

const PLAN_SCOPE_LABELS = {
  exams: 'Exams only',
  lesson_planner: 'Lesson Planner only',
  both: 'Exams + Lesson Planner'
};

const normalizeScope = (scope) => (PLAN_SCOPES.includes(scope) ? scope : DEFAULT_PLAN_SCOPE);

// The two products a scope can grant. Kept as functions rather than raw
// comparisons so every gate (middleware, plan-usage payload, UI) agrees on
// what 'both' means.
const scopeAllowsExams = (scope) => normalizeScope(scope) !== 'lesson_planner';
const scopeAllowsLessonPlanner = (scope) => normalizeScope(scope) !== 'exams';

// Pulls only the overrides actually present in the request body, so partial
// updates don't clobber fields the admin didn't touch.
const extractLimitOverrides = (body) => {
  const overrides = {};

  [...LIMIT_FIELDS, ...PLANNER_QUOTA_KEYS].forEach((field) => {
    if (body[field] === undefined) return;
    if (body[field] === null || body[field] === '') {
      overrides[field] = null;
      return;
    }
    const num = Number(body[field]);
    overrides[field] = Number.isFinite(num) ? num : null;
  });

  FEATURE_FLAGS.forEach((field) => {
    if (body[field] === undefined) return;
    overrides[field] = body[field] === null ? null : Boolean(body[field]);
  });

  return overrides;
};

module.exports = {
  LIMIT_FIELDS,
  FEATURE_FLAGS,
  PLANNER_QUOTA_FIELDS,
  PLANNER_QUOTA_KEYS,
  TIER_ORDER,
  PURCHASABLE_TIERS,
  tierRank,
  isTierAtLeast,
  UNLIMITED_SENTINEL,
  PLAN_SCOPES,
  DEFAULT_PLAN_SCOPE,
  PLAN_SCOPE_LABELS,
  normalizeScope,
  scopeAllowsExams,
  scopeAllowsLessonPlanner,
  extractLimitOverrides
};
