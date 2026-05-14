const { body, validationResult } = require('express-validator');

// Fast validation middleware for login requests
const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('password')
    .isLength({ min: 1 })
    .withMessage('Password is required'),
  
  // Fast validation result handler
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // Return immediately for validation errors - don't hit the database
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    next();
  }
];

// Fast validation middleware for registration requests
const validateRegister = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('firstName')
    .trim()
    .isLength({ min: 1 })
    .withMessage('First name is required'),
  body('lastName')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Last name is required'),
  body('organization')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ min: 2 })
    .withMessage('Organization/school name must be at least 2 characters'),
  body('subscriptionPlan')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isIn(['free', 'basic', 'premium', 'enterprise'])
    .withMessage('Subscription plan must be one of: free, basic, premium, enterprise'),

  // Fast validation result handler
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // Return immediately for validation errors - don't hit the database
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    next();
  }
];

module.exports = {
  validateLogin,
  validateRegister
};
