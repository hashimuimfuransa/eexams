const rateLimit = require('express-rate-limit');
const cacheService = require('../utils/cacheService');

// Different rate limits for different endpoint types
const createRateLimiter = (options) => {
  return rateLimit({
    windowMs: options.windowMs || 15 * 60 * 1000, // 15 minutes default
    max: options.max || 100, // 100 requests default
    message: options.message || 'Too many requests, please try again later.',
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    skip: (req) => {
      // Skip rate limiting for trusted IPs or admin users
      if (req.user && (req.user.role === 'admin' || req.user.role === 'superadmin')) {
        return true;
      }
      return false;
    },
    keyGenerator: (req) => {
      // Use user ID if authenticated, otherwise IP
      if (req.user && req.user._id) {
        return `user:${req.user._id}`;
      }
      return req.ip;
    }
  });
};

// Strict rate limiter for authentication endpoints
const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'Too many authentication attempts, please try again later.'
});

// Moderate rate limiter for exam submissions
const submissionLimiter = createRateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 submissions per minute
  message: 'Too many submission attempts, please slow down.'
});

// Lenient rate limiter for general API calls
const apiLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // 200 requests per window
  message: 'Too many API requests, please try again later.'
});

// Strict rate limiter for AI grading endpoints
const aiGradingLimiter = createRateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // 10 AI grading requests per minute
  message: 'Too many AI grading requests, please wait before trying again.'
});

// Rate limiter for file uploads
const uploadLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 uploads per hour
  message: 'Too many file uploads, please try again later.'
});

// Rate limiter for exam creation
const examCreationLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 exams per hour
  message: 'Too many exam creation attempts, please try again later.'
});

module.exports = {
  authLimiter,
  submissionLimiter,
  apiLimiter,
  aiGradingLimiter,
  uploadLimiter,
  examCreationLimiter
};
