const express = require('express');
const router = express.Router();
const {
  registerStudent,
  getStudents,
  getStudentById,
  updateStudent,
  deleteStudent,
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
} = require('../controllers/adminController');
const { shareExam, getExamPreview, createStudentAccounts, updateExam, deleteExam } = require('../controllers/adminController');
const auth = require('../middleware/auth');
const { isAdminOrTeacher, attachOrgAdminId } = require('../middleware/role');

// Apply auth and admin/teacher middleware to all routes
// This allows both organization admins and their teachers to manage students and exams
router.use(auth, isAdminOrTeacher, attachOrgAdminId);

// Dashboard routes
router.get('/dashboard-stats', getDashboardStats);

// Student management routes
router.post('/students', registerStudent);
router.get('/students', getStudents);
router.get('/recent-students', getRecentStudents);
router.get('/students/:id', getStudentById);
router.put('/students/:id', updateStudent);
router.delete('/students/:id', deleteStudent);

// Teacher management routes (admin only)
router.post('/teachers', registerTeacher);
router.get('/teachers', getTeachers);
router.get('/teachers/:id', getTeacherById);
router.put('/teachers/:id', updateTeacher);
router.delete('/teachers/:id', deleteTeacher);

// Organization routes (admin only)
router.get('/organization', getOrganizationDetails);

// System lock routes
router.put('/system-lock', toggleSystemLock);
router.get('/system-lock', getSystemLockStatus);

// Configure multer for file uploads
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');

    // Create the directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
      console.log('Created uploads directory:', uploadDir);
    }

    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const filetypes = /pdf|doc|docx/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only PDF and Word documents are allowed'));
    }
  }
});

// Exam management routes
router.post(
  '/exams',
  upload.fields([
    { name: 'examFile', maxCount: 1 },
    { name: 'answerFile', maxCount: 1 }
  ]),
  createExam
);
router.get('/exams', getAllExams);
router.get('/exams/scheduled', getScheduledExams);
router.get('/exams/:id', getExamById);
router.get('/scheduled-exams', getScheduledExams); // Keep for backward compatibility
router.get('/recent-exams', getRecentExams);
router.put('/exams/:id/toggle-lock', toggleExamLock);
router.post('/schedule-exam', scheduleExam);
router.put('/exams/:id/schedule', updateScheduledExam);

// Exam results routes
router.get('/exams/:examId/results', getExamResults);
router.get('/exams/:examId/leaderboard', getExamLeaderboard);
router.get('/leaderboard', getOverallLeaderboard);
router.get('/results/:resultId', getDetailedResult);
router.get('/exams/:examId/results/export', exportExamResults);
router.get('/results', getAllResults);

// Analytics routes
router.get('/analytics/student-performance', getStudentPerformanceAnalytics);

// Student results management for regrading
router.get('/student-results', getStudentResultsForRegrade);
router.post('/regrade-result/:resultId', regradeStudentResult);

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

// Template routes
router.get('/templates', getTemplates);
router.post('/templates', createTemplate);
router.post('/templates/:id/use', useTemplate);
router.delete('/templates/:id', deleteTemplate);

// Reports routes
router.get('/reports/summary', getReportsSummary);

// Exam publish/share routes
router.get('/exams/:examId/preview', getExamPreview);
router.post('/exams/:examId/share', shareExam);
router.post('/exams/:examId/students', createStudentAccounts);

// Exam edit/delete routes
router.put('/exams/:id', updateExam);
router.delete('/exams/:id', deleteExam);

module.exports = router;
