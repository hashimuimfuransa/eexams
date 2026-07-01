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

module.exports = { freeExamMatchesUserSubLevel, subscriptionCoversExam };
