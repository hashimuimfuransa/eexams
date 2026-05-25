const express = require('express');
const router = express.Router();
const {
  registerStudent,
  getStudents,
  getStudentById,
  updateStudent,
  deleteStudent,
  resetStudentPassword,
  toggleSystemLock,
  getSystemLockStatus,
  getExamResults,
  getExamLeaderboard,
  getOverallLeaderboard,
  getDetailedResult,
  exportExamResults,
  getDashboardStats,
  getAllExams,
  getExamById,
  getScheduledExams,
  getRecentExams,
  getRecentStudents,
  toggleExamLock,
  getSecurityAlerts,
  resolveSecurityAlert,
  ignoreSecurityAlert,
  getActivityLogs,
  createExam,
  scheduleExam,
  updateScheduledExam,
  getAllResults,
  getStudentPerformanceAnalytics,
  getStudentManagementData,
  debugAdminData,
  getStudentResultsForRegrade,
  regradeStudentResult,
  registerTeacher,
  getTeachers,
  getTeacherById,
  updateTeacher,
  deleteTeacher,
  getOrganizationDetails,
  getQuestions,
  updateQuestion,
  deleteQuestion,
  getTemplates,
  createTemplate,
  useTemplate,
  deleteTemplate,
  getReportsSummary,
  getQuestionBank,
  reuseQuestionBankExam,
} = require('../controllers/adminController');
const { shareExam, getExamPreview, createStudentAccounts, removeStudentFromExam, updateStudentInExam, updateExam, deleteExam } = require('../controllers/adminController');
const auth = require('../middleware/auth');
const { isAdminOrTeacher, attachOrgAdminId, isAdmin } = require('../middleware/role');
const {
  checkStudentLimit,
  checkTeacherLimit,
  checkExamLimit,
  requireAnalytics,
  requireTemplatesAccess
} = require('../middleware/planRestrictions');
const { authLimiter, apiLimiter, aiGradingLimiter, uploadLimiter } = require('../middleware/rateLimiter');

// Apply auth and admin/teacher middleware to all routes
// This allows both organization admins and their teachers to manage students and exams
router.use(auth, isAdminOrTeacher, attachOrgAdminId);

// Dashboard routes
router.get('/dashboard-stats', getDashboardStats);

// Student management routes
router.post('/students', authLimiter, checkStudentLimit, registerStudent);
router.get('/students', apiLimiter, getStudents);
router.get('/recent-students', apiLimiter, getRecentStudents);
router.get('/students/:id', apiLimiter, getStudentById);
router.put('/students/:id', authLimiter, updateStudent);
router.delete('/students/:id', authLimiter, deleteStudent);
router.post('/students/:id/reset-password', authLimiter, resetStudentPassword);

// Teacher management routes (admin only)
router.post('/teachers', authLimiter, isAdmin, checkTeacherLimit, registerTeacher);
router.get('/teachers', apiLimiter, getTeachers);
router.get('/teachers/:id', apiLimiter, getTeacherById);
router.put('/teachers/:id', authLimiter, updateTeacher);
router.delete('/teachers/:id', authLimiter, deleteTeacher);

// Organization routes (admin only)
router.get('/organization', getOrganizationDetails);

// System lock routes
router.put('/system-lock', toggleSystemLock);
router.get('/system-lock', getSystemLockStatus);

// Configure multer with Cloudinary storage
const multer = require('multer');
const { questionImageStorage, examFileStorage } = require('../config/cloudinary');

const uploadImages = multer({
  storage: questionImageStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    if (allowed.test(file.mimetype)) return cb(null, true);
    cb(new Error('Only image files are allowed for question images'));
  }
});

const uploadDocs = multer({
  storage: examFileStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    const allowed = /pdf|doc|docx/;
    if (allowed.test(file.mimetype) || /pdf|msword|officedocument/.test(file.mimetype)) return cb(null, true);
    cb(new Error('Only PDF and Word documents are allowed'));
  }
});

// Combined upload: exam/answer files go to Cloudinary raw, question images go to Cloudinary images
const upload = {
  fields: (fields) => (req, res, next) => {
    const imageFields = fields.filter(f => f.name === 'questionImages');
    const docFields = fields.filter(f => f.name !== 'questionImages');
    uploadDocs.fields(docFields)(req, res, (err) => {
      if (err) return next(err);
      if (imageFields.length === 0) return next();
      uploadImages.fields(imageFields)(req, res, next);
    });
  }
};

// Exam management routes
router.post(
  '/exams',
  authLimiter,
  checkExamLimit,
  upload.fields([
    { name: 'examFile', maxCount: 1 },
    { name: 'answerFile', maxCount: 1 },
    { name: 'questionImages', maxCount: 10 }
  ]),
  createExam
);
router.get('/exams', apiLimiter, getAllExams);
router.get('/exams/scheduled', apiLimiter, getScheduledExams);
router.get('/exams/:id', apiLimiter, getExamById);
router.get('/scheduled-exams', apiLimiter, getScheduledExams); // Keep for backward compatibility
router.get('/recent-exams', apiLimiter, getRecentExams);
router.put('/exams/:id/toggle-lock', authLimiter, toggleExamLock);
router.post('/schedule-exam', authLimiter, scheduleExam);
router.put('/exams/:id/schedule', authLimiter, updateScheduledExam);

// Exam results routes
router.get('/exams/:examId/results', getExamResults);
router.get('/exams/:examId/leaderboard', getExamLeaderboard);
router.get('/leaderboard', getOverallLeaderboard);
router.get('/results/:resultId', getDetailedResult);
router.get('/exams/:examId/results/export', exportExamResults);
router.get('/results', getAllResults);

// Student management data (grades + performance, no plan restriction)
router.get('/student-management', getStudentManagementData);

// Analytics routes - requires Basic plan or higher
router.get('/analytics/student-performance', requireAnalytics, getStudentPerformanceAnalytics);

// Student results management for regrading
router.get('/student-results', apiLimiter, getStudentResultsForRegrade);
router.post('/regrade-result/:resultId', authLimiter, aiGradingLimiter, regradeStudentResult);

// Debug route
router.get('/debug', debugAdminData);

// Security routes
router.get('/security-alerts', getSecurityAlerts);
router.put('/security-alerts/:id/resolve', resolveSecurityAlert);
router.put('/security-alerts/:id/ignore', ignoreSecurityAlert);

// Activity logs
router.get('/activity-logs', getActivityLogs);

// Question bank routes
router.get('/questions', getQuestions);
router.put('/questions/:id', updateQuestion);
router.delete('/questions/:id', deleteQuestion);

// Template routes - requires Basic plan or higher
router.get('/templates', requireTemplatesAccess, getTemplates);
router.post('/templates', requireTemplatesAccess, createTemplate);
router.post('/templates/:id/use', requireTemplatesAccess, useTemplate);
router.delete('/templates/:id', requireTemplatesAccess, deleteTemplate);

// Note: Question Bank routes are moved to a separate router to allow access from any organization
// See questionBank.js routes

// Reports routes
router.get('/reports/summary', getReportsSummary);

// Single question image upload → returns Cloudinary URL
router.post(
  '/upload-image',
  uploadLimiter,
  uploadImages.single('image'),
  (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No image file provided' });
    res.json({ url: req.file.path }); // Cloudinary returns full https URL in file.path
  }
);

// Exam publish/share routes
router.get('/exams/:examId/preview', getExamPreview);
router.post('/exams/:examId/share', shareExam);
router.post('/exams/:examId/students', createStudentAccounts);
router.delete('/exams/:examId/students/:studentId', removeStudentFromExam);
router.put('/exams/:examId/students/:studentId', updateStudentInExam);

// Exam edit/delete routes
router.put('/exams/:id', updateExam);
router.delete('/exams/:id', deleteExam);

module.exports = router;
