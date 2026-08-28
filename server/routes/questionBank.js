const express = require('express');
const router = express.Router();
const { getQuestionBank, reuseQuestionBankExam, addToQuestionBank } = require('../controllers/adminController');
const { browseExamBank, previewExamBankExam, downloadExamBankPdf } = require('../controllers/examBankController');
const auth = require('../middleware/auth');
const { isAdminOrTeacher } = require('../middleware/role');
const { apiLimiter } = require('../middleware/rateLimiter');

// Apply auth middleware to all routes - any authenticated user can access
router.use(auth);

// @desc    Get all publicly listed exams from question bank
// @route   GET /api/question-bank
// @access  Private (Any authenticated user - teachers from any org)
router.get('/', getQuestionBank);

// @desc    Browse the exam bank with search and level/audience filters
// @route   GET /api/question-bank/browse
// @access  Private/Admin or Teacher
router.get('/browse', apiLimiter, isAdminOrTeacher, browseExamBank);

// @desc    Add exam to question bank (set as publicly listed)
// @route   POST /api/question-bank/:examId/add
// @access  Private (Premium users only)
router.post('/:examId/add', addToQuestionBank);

// Full paper preview and the two PDF downloads.
//
// These are deliberately gated behind isAdminOrTeacher, unlike the routes above:
// they expose the answer key, and every role — students included — reaches this
// router through the shared auth middleware.
router.get('/:examId/preview', apiLimiter, isAdminOrTeacher, previewExamBankExam);
router.get('/:examId/pdf', apiLimiter, isAdminOrTeacher, downloadExamBankPdf);

// @desc    Duplicate an exam from question bank as teacher's own exam
// @route   POST /api/question-bank/:examId/reuse
// @access  Private (Any authenticated user - teachers from any org)
router.post('/:examId/reuse', reuseQuestionBankExam);

module.exports = router;
