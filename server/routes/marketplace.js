const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { isAdminOrTeacher } = require('../middleware/role');
const { requireMarketplaceAccess } = require('../middleware/planRestrictions');
const {
  getMarketplaceExams,
  getMarketplaceExamById,
  requestMarketplaceExam,
  getTeacherExamRequests,
  getExamRequests,
  approveExamRequest,
  rejectExamRequest,
  updateMarketplaceExamSettings,
  markPaymentReceived,
  resetAccessLink,
  deleteExamRequest,
  getExamByAccessCode,
  getStudentExamRequests,
  getAllLevels,
  createLevel,
  updateLevel,
  deleteLevel,
  addSubLevel,
  updateSubLevel,
  deleteSubLevel,
  getPersonalizedRecommendations,
  getExamCompletionStatus,
  getTeacherMarketplaceResults
} = require('../controllers/marketplaceController');

// Public routes (no authentication required)
router.get('/exams', getMarketplaceExams);
router.get('/exams/:id', getMarketplaceExamById);
router.get('/levels', getAllLevels);
router.post('/exams/:id/request', auth.optionalAuth, requestMarketplaceExam);
router.get('/access/:accessCode', getExamByAccessCode);

// Protected routes (require authentication)
router.use(auth);

// Student routes for viewing their exam requests and completion status
router.get('/student/requests', getStudentExamRequests);
router.get('/exam-completion-status', getExamCompletionStatus);
router.get('/recommendations', getPersonalizedRecommendations);

// Teacher routes for managing exam requests
router.get('/exam-requests', isAdminOrTeacher, getTeacherExamRequests);
router.get('/exams/:examId/requests', isAdminOrTeacher, getExamRequests);
router.put('/exam-requests/:requestId/approve', isAdminOrTeacher, approveExamRequest);
router.put('/exam-requests/:requestId/reject', isAdminOrTeacher, rejectExamRequest);
router.put('/exam-requests/:requestId/payment', isAdminOrTeacher, markPaymentReceived);
router.put('/exam-requests/:requestId/reset', isAdminOrTeacher, resetAccessLink);
router.delete('/exam-requests/:requestId', isAdminOrTeacher, deleteExamRequest);

// Teacher routes for viewing marketplace exam results
router.get('/teacher/results', isAdminOrTeacher, getTeacherMarketplaceResults);

// Teacher routes for managing marketplace exam settings
router.put('/exams/:id/settings', isAdminOrTeacher, requireMarketplaceAccess, updateMarketplaceExamSettings);

// Level management routes (Teacher only - requires marketplace access)
router.post('/levels', isAdminOrTeacher, requireMarketplaceAccess, createLevel);
router.put('/levels/:id', isAdminOrTeacher, requireMarketplaceAccess, updateLevel);
router.delete('/levels/:id', isAdminOrTeacher, requireMarketplaceAccess, deleteLevel);

// Sub-level management routes (Teacher only - requires marketplace access)
router.post('/levels/:id/sublevels', isAdminOrTeacher, requireMarketplaceAccess, addSubLevel);
router.put('/levels/:id/sublevels/:subLevelId', isAdminOrTeacher, requireMarketplaceAccess, updateSubLevel);
router.delete('/levels/:id/sublevels/:subLevelId', isAdminOrTeacher, requireMarketplaceAccess, deleteSubLevel);

module.exports = router;
