const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { isAdminOrTeacher } = require('../middleware/role');
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
  getStudentExamRequests
} = require('../controllers/marketplaceController');

// Public routes (no authentication required)
router.get('/exams', getMarketplaceExams);
router.get('/exams/:id', getMarketplaceExamById);
router.post('/exams/:id/request', auth.optionalAuth, requestMarketplaceExam);
router.get('/access/:accessCode', getExamByAccessCode);

// Protected routes (require authentication)
router.use(auth);

// Student routes for viewing their exam requests
router.get('/student/requests', getStudentExamRequests);

// Teacher routes for managing exam requests
router.get('/exam-requests', isAdminOrTeacher, getTeacherExamRequests);
router.get('/exams/:examId/requests', isAdminOrTeacher, getExamRequests);
router.put('/exam-requests/:requestId/approve', isAdminOrTeacher, approveExamRequest);
router.put('/exam-requests/:requestId/reject', isAdminOrTeacher, rejectExamRequest);
router.put('/exam-requests/:requestId/payment', isAdminOrTeacher, markPaymentReceived);
router.put('/exam-requests/:requestId/reset', isAdminOrTeacher, resetAccessLink);
router.delete('/exam-requests/:requestId', isAdminOrTeacher, deleteExamRequest);

// Teacher routes for managing marketplace exam settings
router.put('/exams/:id/settings', isAdminOrTeacher, updateMarketplaceExamSettings);

module.exports = router;
