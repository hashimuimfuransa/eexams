const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware to verify JWT token
const auth = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ message: 'No authentication token, access denied' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find user by id
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({ message: 'Token is not valid' });
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

      // Find user by id
      const user = await User.findById(decoded.id).select('-password');

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

module.exports = auth;
module.exports.optionalAuth = optionalAuth;
