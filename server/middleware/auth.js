const jwt = require('jsonwebtoken');
const User = require('../models/User');
const cacheService = require('../utils/cacheService');
const { hasActivePaidAccess } = require('../utils/paidAccess');

// Middleware to verify JWT token with caching
const auth = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ message: 'No authentication token, access denied' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Try to get user from cache first
    const cacheKey = cacheService.generateKey('user', decoded.id);
    let user = await cacheService.get(cacheKey);
    let paidAccess = user?._paidAccess;

    if (!user) {
      // Cache miss - fetch from database
      user = await User.findById(decoded.id).select('-password');

      if (user) {
        // Resolve once per cache window (5 min) - re-checked on every login anyway
        paidAccess = await hasActivePaidAccess(user);
        const toCache = user.toObject();
        toCache._paidAccess = paidAccess;
        await cacheService.set(cacheKey, toCache, 300);
      }
    }

    if (!user) {
      return res.status(401).json({ message: 'Token is not valid' });
    }

    // Single-active-session guard for paid accounts: reject any token whose
    // sessionId doesn't match the most recently issued login, so sharing
    // credentials logs the previous device out instead of both staying in.
    if (decoded.sessionId && paidAccess && user.activeSessionId && user.activeSessionId !== decoded.sessionId) {
      return res.status(401).json({
        message: 'This account was signed in on another device. Please log in again.',
        code: 'SESSION_REVOKED'
      });
    }

    // Add user to request object
    req.user = user;
    req.orgAdminId = user.parentAdmin;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};

// Optional auth middleware - populates req.user if token is provided, but doesn't require it
const optionalAuth = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (token) {
      // Verify token if provided
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Try to get user from cache first
      const cacheKey = cacheService.generateKey('user', decoded.id);
      let user = await cacheService.get(cacheKey);

      if (!user) {
        // Cache miss - fetch from database
        user = await User.findById(decoded.id).select('-password');
        
        if (user) {
          // Cache user for 5 minutes
          await cacheService.set(cacheKey, user, 300);
        }
      }

      if (user) {
        // Add user to request object
        req.user = user;
        req.orgAdminId = user.parentAdmin;
      }
    }

    // Always continue, whether authenticated or not
    next();
  } catch (error) {
    // If token is invalid, just continue without user
    next();
  }
};

// Helper function to invalidate user cache (call after user updates)
const invalidateUserCache = async (userId) => {
  const cacheKey = cacheService.generateKey('user', userId);
  await cacheService.del(cacheKey);
};

module.exports = auth;
module.exports.optionalAuth = optionalAuth;
module.exports.invalidateUserCache = invalidateUserCache;
