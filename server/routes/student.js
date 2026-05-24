const express = require('express');
const router = express.Router();
const {
  getAvailableExams,
  getExamById,
  getStudentResults,
  getDetailedResult,
  getCurrentExamSession,
  getClassLeaderboard,
  debugStudentResults,
  checkSpecificResult,
  getScheduledExams,
  getInProgressExams
} = require('../controllers/studentController');
const auth = require('../middleware/auth');
const { isStudent } = require('../middleware/role');
const { apiLimiter } = require('../middleware/rateLimiter');

// Apply auth and student middleware to all routes
router.use(auth, isStudent);

// Exam routes
router.get('/exams', apiLimiter, getAvailableExams);
router.get('/exams/in-progress', apiLimiter, getInProgressExams);
router.get('/exams/:examId', apiLimiter, getExamById); // Get specific exam by ID
router.get('/exams/:examId/session', apiLimiter, getCurrentExamSession);

// Results routes
router.get('/results', apiLimiter, getStudentResults);
router.get('/results/:resultId', apiLimiter, getDetailedResult);
router.get('/debug-results', apiLimiter, debugStudentResults);
router.get('/check-result/:resultId', apiLimiter, checkSpecificResult);

// Scheduled exams route
router.get('/scheduled-exams', apiLimiter, getScheduledExams);

// Leaderboard route
router.get('/leaderboard', apiLimiter, getClassLeaderboard);

module.exports = router;
