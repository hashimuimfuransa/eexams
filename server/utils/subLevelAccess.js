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

// Self-heals a student's selected level/sub-level against their active
// level subscription. Payment activation (activatePendingPayment) and the
// admin manual-grant flow (createSubscription) already sync these onto the
// user at grant time, but legacy grants predating that sync — or any other
// drift — can leave a student stuck on a stale level with an empty exam
// bank despite holding a valid, paid-for (or admin-granted) subscription.
// Call this wherever a student's level or exam access is read; it corrects
// the drift in the database and returns the corrected { level, subLevel }
// to use for the current request, or null if nothing needed fixing.
const syncUserLevelFromSubscription = async (userId, currentLevelId, currentSubLevel) => {
  // Required here (not at module top) to avoid a require cycle: models may
  // pull in utils that pull in models during app bootstrap.
  const Subscription = require('../models/Subscription');
  const User = require('../models/User');

  const subscription = await Subscription.getActiveSubscription(userId);
  if (!subscription || subscription.planType === 'exam' || !subscription.level) return null;

  const levelMismatch = subscription.level._id.toString() !== currentLevelId?.toString();
  const subLevelMismatch = !!subscription.subLevel && subscription.subLevel !== currentSubLevel;
  if (!levelMismatch && !subLevelMismatch) return null;

  const subLevel = subscription.subLevel || null;
  await User.findByIdAndUpdate(userId, { level: subscription.level._id, subLevel });
  return { level: subscription.level, subLevel };
};

module.exports = { freeExamMatchesUserSubLevel, subscriptionCoversExam, syncUserLevelFromSubscription };
