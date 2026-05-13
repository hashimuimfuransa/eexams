const express = require('express');
const router = express.Router();
const {
  getAllOrganizations,
  getOrganizationById,
  updateOrganizationSubscription,
  toggleOrganizationBlock,
  getSuperAdminDashboardStats,
  deleteOrganization
} = require('../controllers/superAdminController');
const auth = require('../middleware/auth');

// Middleware to check if user is a super admin
// For now, we'll use a simple check - in production, you'd have a separate super admin role
const isSuperAdmin = (req, res, next) => {
  // Check if user has a special super admin flag or email
  // For demo purposes, you can set specific emails as super admins
  const superAdminEmails = process.env.SUPER_ADMIN_EMAILS ? process.env.SUPER_ADMIN_EMAILS.split(',') : [];

  if (req.user && (req.user.isSuperAdmin || superAdminEmails.includes(req.user.email))) {
    return next();
  }

  // Alternatively, you can check for a specific role if you add it to the User model
  // if (req.user && req.user.role === 'superadmin') {
  //   return next();
  // }

  return res.status(403).json({ message: 'Access denied. Super admin privileges required.' });
};

// Apply auth and super admin middleware to all routes
router.use(auth, isSuperAdmin);

// Dashboard stats
router.get('/dashboard-stats', getSuperAdminDashboardStats);

// Organization management routes
router.get('/organizations', getAllOrganizations);
router.get('/organizations/:id', getOrganizationById);
router.put('/organizations/:id/subscription', updateOrganizationSubscription);
router.put('/organizations/:id/toggle-block', toggleOrganizationBlock);
router.delete('/organizations/:id', deleteOrganization);

module.exports = router;
