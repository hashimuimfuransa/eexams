const { body, validationResult } = require('express-validator');

// Fast validation middleware for login requests
const validateLogin = [
  body('email')
    .optional({ nullable: true, checkFalsy: true })
    .if((value) => value)
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('phone')
    .optional({ nullable: true, checkFalsy: true })
    .if((value) => value)
    .trim()
    .isLength({ min: 10 })
    .withMessage('Phone number must be at least 10 characters'),
  body('password')
    .isLength({ min: 1 })
    .withMessage('Password is required'),

  // Custom validation: at least one of email or phone must be provided
  (req, res, next) => {
    const { email, phone } = req.body;
    if ((!email || !email.trim()) && (!phone || !phone.trim())) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: [{ msg: 'Either email or phone number is required' }]
      });
    }
    next();
  },

  // Fast validation result handler
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // Return immediately for validation errors - don't hit the database
      const errorMessages = errors.array().map(err => err.msg);
      return res.status(400).json({
        message: errorMessages.join(', '),
        errors: errors.array()
      });
    }
    next();
  }
];

// Fast validation middleware for registration requests
const validateRegister = [
  body('email')
    .optional({ nullable: true, checkFalsy: true })
    .if((value) => value)
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('phone')
    .optional({ nullable: true, checkFalsy: true })
    .if((value) => value)
    .trim()
    .isLength({ min: 10 })
    .withMessage('Phone number must be at least 10 characters'),
  body('password')
    .if((value, { req }) => !req.body.googleId && !req.body.googleCredential)
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

  // Custom validation: at least one of email or phone must be provided
  (req, res, next) => {
    const { email, phone } = req.body;
    if ((!email || !email.trim()) && (!phone || !phone.trim())) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: [{ msg: 'Either email or phone number is required' }]
      });
    }
    next();
  },

  // Fast validation result handler
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // Return immediately for validation errors - don't hit the database
      const errorMessages = errors.array().map(err => err.msg);
      return res.status(400).json({
        message: errorMessages.join(', '),
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
