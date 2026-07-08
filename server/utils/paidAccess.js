const Subscription = require('../models/Subscription');
const User = require('../models/User');
const { getEffectiveSubscriptionStatus } = require('./subscriptionStatus');

// Whether a user currently has paid access worth protecting from account
// sharing (single-active-session enforcement only applies when this is true).
const hasActivePaidAccess = async (user) => {
  if (user.role === 'teacher' && user.parentAdmin) {
    const admin = await User.findById(user.parentAdmin).select('subscriptionPlan subscriptionStatus subscriptionExpiresAt subscriptionEndDate').lean();
    return !!admin && admin.subscriptionPlan !== 'free' && getEffectiveSubscriptionStatus(admin) === 'active';
  }

  if (user.role === 'admin' || user.role === 'teacher') {
    return user.subscriptionPlan !== 'free' && getEffectiveSubscriptionStatus(user) === 'active';
  }

  if (user.role === 'student') {
    const activeSubscription = await Subscription.getActiveSubscription(user._id);
    return !!activeSubscription;
  }

  return false;
};

module.exports = { hasActivePaidAccess };
