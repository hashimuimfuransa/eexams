const User = require('../models/User');

// Middleware to check subscription expiration
const checkSubscriptionExpiration = async (req, res, next) => {
  try {
    // Skip check for superadmin
    if (req.user && req.user.role === 'superadmin') {
      return next();
    }

    // Skip check if no user (not authenticated)
    if (!req.user) {
      return next();
    }

    // Get fresh user data
    const user = await User.findById(req.user._id);
    if (!user) {
      return next();
    }

    // Enterprise subscribers don't expire
    if (user.subscriptionPlan === 'enterprise') {
      return next();
    }

    // Check if subscription is expired
    if (user.subscriptionExpiresAt && new Date() > user.subscriptionExpiresAt) {
      // Update status to expired if not already
      if (user.subscriptionStatus !== 'expired') {
        user.subscriptionStatus = 'expired';
        await user.save();
      }
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Subscription expiration check error:', error);
    next();
  }
};

// Middleware to block access for expired users
const blockExpiredUsers = async (req, res, next) => {
  try {
    // Skip check for superadmin
    if (req.user && req.user.role === 'superadmin') {
      return next();
    }

    // Skip check if no user (not authenticated)
    if (!req.user) {
      return next();
    }

    // Get fresh user data
    const user = await User.findById(req.user._id);
    if (!user) {
      return next();
    }

    // Enterprise subscribers don't expire
    if (user.subscriptionPlan === 'enterprise') {
      return next();
    }

    // Check if subscription is expired
    if (user.subscriptionStatus === 'expired') {
      return res.status(403).json({
        message: 'Your subscription has expired. Please renew your subscription to continue.',
        subscriptionExpired: true
      });
    }

    // Check if subscription is about to expire (within 7 days)
    if (user.subscriptionExpiresAt) {
      const daysUntilExpiry = Math.ceil((user.subscriptionExpiresAt - new Date()) / (1000 * 60 * 60 * 24));
      if (daysUntilExpiry <= 7 && daysUntilExpiry > 0) {
        // Add warning to response headers
        res.setHeader('X-Subscription-Expiring-In', daysUntilExpiry);
      }
    }

    next();
  } catch (error) {
    console.error('Block expired users error:', error);
    next();
  }
};

module.exports = {
  checkSubscriptionExpiration,
  blockExpiredUsers
};
