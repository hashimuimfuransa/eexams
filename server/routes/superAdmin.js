const express = require('express');
const router = express.Router();
const {
  createSuperAdmin,
  getAllOrganizations,
  getOrganizationById,
  updateOrganizationSubscription,
  toggleOrganizationBlock,
  getSuperAdminDashboardStats,
  deleteOrganization,
  getAllUsers,
  getAllExams,
  getAllResults,
  getSystemOverview,
  getUserById,
  updateUser,
  deleteUser,
  toggleUserBlock,
  deleteExam,
  getExamById,
  getSubscriptionRequests,
  approveSubscriptionRequest,
  rejectSubscriptionRequest,
  getAllSubscriptions,
  getMarketplaceExamsWithStats,
  getExamUsageDetails,
  updateExamMarketplaceSettings,
  updateExamDetails,
  getStudentPerformanceAnalytics,
  getTeacherPerformanceAnalytics,
  getOrganizationPerformanceAnalytics,
  getTimeSeriesAnalytics,
  getExamAnalytics,
  getMarketplaceAnalytics,
  getAllExamRequests,
  superAdminApproveExamRequest,
  superAdminRejectExamRequest,
  getExamRequestStats
} = require('../controllers/superAdminController');
const auth = require('../middleware/auth');

// Middleware to check if user is a super admin
const isSuperAdmin = (req, res, next) => {
  // Check if user has superadmin role or is in the super admin emails list
  const superAdminEmails = process.env.SUPER_ADMIN_EMAILS ? process.env.SUPER_ADMIN_EMAILS.split(',') : [];

  if (req.user && (req.user.role === 'superadmin' || superAdminEmails.includes(req.user.email))) {
    return next();
  }

  return res.status(403).json({ message: 'Access denied. Super admin privileges required.' });
};

// Apply auth and super admin middleware to all routes
router.use(auth, isSuperAdmin);

// Debug middleware to log all requests
router.use((req, res, next) => {
  if (req.path.startsWith('/users')) {
    console.log(`[SuperAdmin] ${req.method} ${req.path}`);
  }
  next();
});

// Dashboard stats
router.get('/dashboard-stats', getSuperAdminDashboardStats);

// Super admin management routes
router.post('/create-superadmin', createSuperAdmin);

// Organization management routes
router.get('/organizations', getAllOrganizations);
router.get('/organizations/:id', getOrganizationById);
router.put('/organizations/:id/subscription', updateOrganizationSubscription);
router.put('/organizations/:id/toggle-block', toggleOrganizationBlock);
router.delete('/organizations/:id', deleteOrganization);

// System-wide data routes - all users, exams, results
router.get('/users', getAllUsers);
router.get('/users/:id', getUserById);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);
router.put('/users/:id/toggle-block', toggleUserBlock);

router.get('/exams', getAllExams);
router.get('/exams/:id', getExamById);
router.delete('/exams/:id', deleteExam);

router.get('/results', getAllResults);
router.get('/overview', getSystemOverview);

// Exam marketplace management routes
router.get('/marketplace-exams', getMarketplaceExamsWithStats);
router.get('/marketplace-exams/:id/usage', getExamUsageDetails);
router.put('/marketplace-exams/:id/settings', updateExamMarketplaceSettings);
router.put('/marketplace-exams/:id', updateExamDetails);

// Subscription management routes
router.get('/subscription-requests', getSubscriptionRequests);
router.put('/subscription-requests/:id/approve', approveSubscriptionRequest);
router.put('/subscription-requests/:id/reject', rejectSubscriptionRequest);
router.get('/subscriptions', getAllSubscriptions);

// Advanced analytics routes
router.get('/analytics/students', getStudentPerformanceAnalytics);
router.get('/analytics/teachers', getTeacherPerformanceAnalytics);
router.get('/analytics/organizations', getOrganizationPerformanceAnalytics);
router.get('/analytics/trends', getTimeSeriesAnalytics);
router.get('/analytics/exams', getExamAnalytics);
router.get('/analytics/marketplace', getMarketplaceAnalytics);

// Exam request management routes (super admin can approve any pending exam from any organization)
router.get('/exam-requests', getAllExamRequests);
router.get('/exam-requests/stats', getExamRequestStats);
router.put('/exam-requests/:requestId/approve', superAdminApproveExamRequest);
router.put('/exam-requests/:requestId/reject', superAdminRejectExamRequest);

// 404 handler for unmatched superadmin routes
router.use((req, res) => {
  console.log(`[SuperAdmin 404] ${req.method} ${req.path} - No route matched`);
  res.status(404).json({ message: `SuperAdmin route not found: ${req.method} ${req.path}` });
});

module.exports = router;
