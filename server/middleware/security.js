const User = require('../models/User');

/**
 * Middleware to prevent subscription manipulation
 * Ensures users cannot modify subscription data they don't own
 */
const validateSubscriptionOwnership = async (req, res, next) => {
  try {
    const subscriptionId = req.params.id;
    const userId = req.user._id;

    if (!subscriptionId) {
      return next();
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Super admins can access all subscriptions
    if (user.role === 'superadmin') {
      return next();
    }

    const Subscription = require('../models/Subscription');
    const subscription = await Subscription.findById(subscriptionId);

    if (!subscription) {
      return res.status(404).json({ message: 'Subscription not found' });
    }

    // Check if subscription belongs to the user
    if (subscription.user.toString() !== userId.toString()) {
      console.warn(`Security violation: User ${userId} attempted to access subscription ${subscriptionId} owned by ${subscription.user}`);

      return res.status(403).json({
        message: 'You do not have permission to access this subscription'
      });
    }

    next();
  } catch (error) {
    console.error('Subscription ownership validation error:', error);
    res.status(500).json({ message: 'Server error during ownership validation' });
  }
};

module.exports = {
  validateSubscriptionOwnership
};
