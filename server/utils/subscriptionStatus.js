// Single source of truth for "is this subscription actually still active
// right now". Both User.subscriptionStatus and Subscription.status are
// persisted fields that are only ever flipped to 'expired' lazily (by
// middleware/jobs that don't run on every route, or don't exist at all), so
// they can sit stale at 'active' long after the real expiry timestamp has
// passed — including plans purchased in hours (e.g. a 4-hour plan), where a
// date-only check would still call it "active" until midnight. Every read
// path that reports subscription status to a user or admin should compute
// it through here instead of trusting the raw DB field.

// Core comparison, independent of which model/field names are involved:
// full timestamp compare (not calendar-date), so an hours-long plan expires
// the instant its time is up, not at the end of the day.
const computeEffectiveStatus = (storedStatus, expiresAt, { terminalStatuses = ['cancelled'] } = {}) => {
  if (terminalStatuses.includes(storedStatus)) return storedStatus;
  if (!expiresAt) return storedStatus;
  if (new Date(expiresAt).getTime() <= Date.now()) {
    return 'expired';
  }
  return storedStatus;
};

const getSubscriptionExpiryDate = (user) => {
  return user?.subscriptionExpiresAt || user?.subscriptionEndDate || null;
};

const getEffectiveSubscriptionStatus = (user) => {
  if (!user) return null;

  // Enterprise plans don't expire.
  if (user.subscriptionPlan === 'enterprise') return user.subscriptionStatus;

  return computeEffectiveStatus(user.subscriptionStatus, getSubscriptionExpiryDate(user));
};

// Same computation for Subscription (per-level/exam purchase) docs, which
// use `status`/`expiresAt` instead of User's `subscriptionStatus`/
// `subscriptionExpiresAt` field names.
const getEffectiveLevelSubscriptionStatus = (sub) => {
  if (!sub) return null;
  return computeEffectiveStatus(sub.status, sub.expiresAt);
};

// Applies the effective status to a Mongoose user doc and persists it if it
// changed, so subsequent reads (and anything still trusting the raw field)
// self-heal instead of staying stuck on stale data.
const syncSubscriptionStatus = async (user) => {
  if (!user) return user;
  const effective = getEffectiveSubscriptionStatus(user);
  if (effective && effective !== user.subscriptionStatus) {
    user.subscriptionStatus = effective;
    if (typeof user.save === 'function') {
      await user.save();
    }
  }
  return user;
};

// Same self-heal for a Subscription (per-level/exam purchase) doc.
const syncLevelSubscriptionStatus = async (sub) => {
  if (!sub) return sub;
  const effective = getEffectiveLevelSubscriptionStatus(sub);
  if (effective && effective !== sub.status) {
    sub.status = effective;
    if (typeof sub.save === 'function') {
      await sub.save();
    }
  }
  return sub;
};

module.exports = {
  getEffectiveSubscriptionStatus,
  getEffectiveLevelSubscriptionStatus,
  getSubscriptionExpiryDate,
  syncSubscriptionStatus,
  syncLevelSubscriptionStatus
};
