// Lesson Planner monthly output quotas.
//
// The Lesson Planner is sold by how much a teacher can produce per month
// (see PLANNER_QUOTA_FIELDS in utils/planLimits.js), so every quota here is
// counted over the current calendar month in UTC. Calendar month, not a
// rolling window anchored to the subscription start, because the price card
// says "/mo" next to a plan that may itself run for three months (Term Pro) —
// the allowance has to reset on a boundary a teacher can predict.
//
// COUNTERS is the registry that makes a quota real: a quota with no counter
// here is advertised on the price card but can never be consumed. All four
// quotas are backed — lesson plans by LessonPlan, slides/exercises/schemes by
// PlannerResource keyed on `kind`. Adding a fifth output type means adding its
// counter here AND flipping `enforced` in planLimits.js; a quota missing a
// counter still resolves (reporting the allowance with a null usage) rather
// than blocking on a number it cannot measure.
const LessonPlan = require('../models/LessonPlan');
const PlannerResource = require('../models/PlannerResource');
const { PLANNER_QUOTA_FIELDS, UNLIMITED_SENTINEL } = require('./planLimits');

// Slides, exercises and schemes all live in PlannerResource under a `kind`, so
// each counter is the same query with a different discriminator.
const countResources = (kind) => (userId, since) => PlannerResource.countDocuments({
  createdBy: userId,
  kind,
  createdAt: { $gte: since }
});

const COUNTERS = {
  lessonPlansPerMonth: (userId, since) => LessonPlan.countDocuments({
    createdBy: userId,
    createdAt: { $gte: since }
  }),
  slidesPerMonth: countResources('slides'),
  exercisesPerMonth: countResources('exercises'),
  schemesPerMonth: countResources('scheme')
};

// First instant of the current UTC calendar month, and the first instant of
// the next one — the window every quota is measured over.
const currentPeriod = (now = new Date()) => {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, end };
};

// Infinity (hardcoded default) and -1 (the DB catalog's JSON-safe sentinel)
// both mean "no cap"; null/undefined means the tier default never resolved,
// which is also treated as uncapped rather than as zero.
const isUnlimited = (limit) =>
  limit === Infinity || limit === UNLIMITED_SENTINEL || limit === null || limit === undefined;

// Usage for one quota against an already-resolved plan config
// (from getPlanConfigForUser — never a plan name).
const getQuotaStatus = async (userId, planConfig, quotaKey) => {
  const field = PLANNER_QUOTA_FIELDS.find((q) => q.key === quotaKey);
  if (!field) throw new Error(`Unknown planner quota: ${quotaKey}`);

  const limit = planConfig?.[quotaKey];
  const { start, end } = currentPeriod();
  const counter = COUNTERS[quotaKey];

  // No producer for this output yet — report the allowance, but never a usage
  // figure we'd be inventing.
  if (!counter) {
    return {
      key: quotaKey,
      label: field.label,
      enforced: false,
      limit: isUnlimited(limit) ? -1 : limit,
      used: null,
      remaining: null,
      allowed: true,
      periodStart: start,
      periodEnd: end
    };
  }

  const used = await counter(userId, start);
  const unlimited = isUnlimited(limit);

  return {
    key: quotaKey,
    label: field.label,
    enforced: true,
    limit: unlimited ? -1 : limit,
    used,
    remaining: unlimited ? -1 : Math.max(0, limit - used),
    allowed: unlimited || used < limit,
    periodStart: start,
    periodEnd: end
  };
};

// Every quota at once, for the "what's left this month" panel.
const getAllQuotaStatus = async (userId, planConfig) =>
  Promise.all(PLANNER_QUOTA_FIELDS.map((q) => getQuotaStatus(userId, planConfig, q.key)));

// Throwing form used by the routes: returns the status when there is room,
// or an object describing the refusal the caller turns into a 403.
const checkQuota = async (userId, planConfig, quotaKey) => {
  const status = await getQuotaStatus(userId, planConfig, quotaKey);
  if (status.allowed) return { ok: true, status };

  return {
    ok: false,
    status,
    body: {
      message: `You have used all ${status.limit} ${PLANNER_QUOTA_FIELDS.find((q) => q.key === quotaKey).noun} included in the ${planConfig?.name || 'current'} plan this month. Your allowance resets on ${status.periodEnd.toISOString().slice(0, 10)}.`,
      code: 'PLANNER_QUOTA_EXCEEDED',
      quota: quotaKey,
      limit: status.limit,
      used: status.used,
      periodEnd: status.periodEnd,
      upgradeRequired: true
    }
  };
};

module.exports = {
  COUNTERS,
  currentPeriod,
  isUnlimited,
  getQuotaStatus,
  getAllQuotaStatus,
  checkQuota
};
