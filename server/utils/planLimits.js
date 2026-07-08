// Shared between OrganizationPlan and IndividualPlan controllers/config —
// the set of enforcement fields a super admin can override per DB plan doc.
// -1 is the JSON-safe sentinel for "unlimited" (Infinity doesn't survive
// JSON.stringify), translated back to Infinity only when a plan is resolved
// for enforcement (see config/plans.js resolvePlanConfig).
const LIMIT_FIELDS = ['maxExams', 'maxStudents', 'maxTeachers', 'examPerMonth', 'storageLimit'];
const FEATURE_FLAGS = ['aiFeatures', 'advancedAI', 'analytics', 'prioritySupport', 'customBranding', 'apiAccess', 'marketplaceAccess', 'templates'];
const UNLIMITED_SENTINEL = -1;

// Pulls only the overrides actually present in the request body, so partial
// updates don't clobber fields the admin didn't touch.
const extractLimitOverrides = (body) => {
  const overrides = {};

  LIMIT_FIELDS.forEach((field) => {
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

module.exports = { LIMIT_FIELDS, FEATURE_FLAGS, UNLIMITED_SENTINEL, extractLimitOverrides };
