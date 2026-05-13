const express = require('express');
const router = express.Router();
const {
  getAvailableExams,
  getStudentResults,
  getDetailedResult,
  getCurrentExamSession,
  getClassLeaderboard,
  debugStudentResults,
  checkSpecificResult
} = require('../controllers/studentController');
const auth = require('../middleware/auth');
const { isStudent } = require('../middleware/role');

// Apply auth and student middleware to all routes
router.use(auth, isStudent);

// Exam routes
router.get('/exams', getAvailableExams);
router.get('/exams/:examId/session', getCurrentExamSession);

// Results routes
router.get('/results', getStudentResults);
router.get('/results/:resultId', getDetailedResult);
router.get('/debug-results', debugStudentResults);
router.get('/check-result/:resultId', checkSpecificResult);

// Leaderboard route
router.get('/leaderboard', getClassLeaderboard);

module.exports = router;
