/**
 * Shared sub-level matching rules for exam access control.
 * Used by both middleware/examAccess.js (live access checks) and
 * studentController.getAvailableExams (exam bank listing) so the two never
 * drift apart.
 */

// A free exam tagged with a sub-level can only be taken by a student whose
// own selected sub-level matches. An untagged (level-wide) free exam is
// open to anyone at that level regardless of sub-level.
const freeExamMatchesUserSubLevel = (exam, user) => {
  if (!exam.subLevel) return true;
  return !!user.subLevel && user.subLevel === exam.subLevel;
};

// A subscription unlocks a subscription-only exam if:
//  - the exam has no sub-level (general level content), OR
//  - the subscription itself has no sub-level (full-level plan covers everything), OR
//  - the subscription's sub-level matches the exam's sub-level exactly.
const subscriptionCoversExam = (subscription, exam) => {
  if (!exam.subLevel) return true;
  if (!subscription.subLevel) return true;
  return subscription.subLevel === exam.subLevel;
};

// Every active, level-scoped subscription the student holds. A student can
// hold more than one — and, more commonly, can hold one for a level other
// than the level they currently have selected. Each of those subscriptions
// unlocks its own level's exams no matter what is selected, so access checks
// and the exam bank listing both work off this whole list rather than a
// single lookup keyed on the selected level. Exam-scoped subscriptions are
// excluded: they unlock one exam, not a level.
const getActiveLevelSubscriptions = async (userId) => {
  // Required here (not at module top) to avoid a require cycle: models may
  // pull in utils that pull in models during app bootstrap.
  const Subscription = require('../models/Subscription');

  return Subscription.find({
    user: userId,
    exam: null,
    status: 'active',
    expiresAt: { $gt: new Date() }
  }).populate('level').populate('plan');
};

const levelIdOf = (doc) => {
  const level = doc?.level;
  if (!level) return null;
  return (level._id || level).toString();
};

// The subscription (out of getActiveLevelSubscriptions) that unlocks `exam`,
// or null. An exam is covered when it sits in the subscription's level and
// the sub-level scopes line up.
const findSubscriptionCoveringExam = (subscriptions, exam) => {
  const examLevelId = levelIdOf({ level: exam?.level });
  if (!examLevelId) return null;

  return (subscriptions || []).find(sub =>
    levelIdOf(sub) === examLevelId &&
    sub.status === 'active' &&
    new Date(sub.expiresAt) > new Date() &&
    subscriptionCoversExam(sub, exam)
  ) || null;
};

// Mongo filter selecting the exams a level subscription unlocks: everything
// in its level, narrowed to its sub-level when the plan is sub-level scoped
// (untagged, level-wide exams stay included). Mirrors
// findSubscriptionCoveringExam so the listing query and the per-exam access
// decision can never disagree.
const subscriptionExamQuery = (subscription) => {
  const levelId = levelIdOf(subscription);
  if (!levelId) return null;
  if (!subscription.subLevel) return { level: levelId };

  return {
    level: levelId,
    $or: [
      { subLevel: null },
      { subLevel: { $exists: false } },
      { subLevel: subscription.subLevel }
    ]
  };
};

// Fills in a student's level/sub-level from their active subscription when
// they have none selected yet. Payment activation (activatePendingPayment)
// and the admin manual-grant flow (createSubscription) already set these at
// grant time, but legacy grants predating that — or a student who never
// completed level selection — can leave the level empty, which blocks
// checkLevelSelection and empties the exam bank.
//
// It deliberately does NOT overwrite a level the student has already chosen:
// a subscription on a different level (or sub-level) than the selected one is
// a legitimate state, and its exams are surfaced by
// getActiveLevelSubscriptions everywhere access is decided rather than by
// dragging the student's selection over to the subscription's level.
//
// Returns the corrected { level, subLevel } to use for the current request,
// or null if nothing needed fixing.
const syncUserLevelFromSubscription = async (userId, currentLevelId, currentSubLevel) => {
  const Subscription = require('../models/Subscription');
  const User = require('../models/User');

  if (currentLevelId) return null;

  const subscription = await Subscription.getActiveSubscription(userId);
  if (!subscription || subscription.planType === 'exam' || !subscription.level) return null;

  const subLevel = subscription.subLevel || null;
  await User.findByIdAndUpdate(userId, { level: subscription.level._id, subLevel });
  return { level: subscription.level, subLevel };
};

module.exports = {
  freeExamMatchesUserSubLevel,
  subscriptionCoversExam,
  syncUserLevelFromSubscription,
  getActiveLevelSubscriptions,
  findSubscriptionCoveringExam,
  subscriptionExamQuery
};
