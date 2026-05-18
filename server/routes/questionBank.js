const express = require('express');
const router = express.Router();
const { getQuestionBank, reuseQuestionBankExam, addToQuestionBank } = require('../controllers/adminController');
const auth = require('../middleware/auth');

// Apply auth middleware to all routes - any authenticated user can access
router.use(auth);

// @desc    Get all publicly listed exams from question bank
// @route   GET /api/question-bank
// @access  Private (Any authenticated user - teachers from any org)
router.get('/', getQuestionBank);

// @desc    Add exam to question bank (set as publicly listed)
// @route   POST /api/question-bank/:examId/add
// @access  Private (Premium users only)
router.post('/:examId/add', addToQuestionBank);

// @desc    Duplicate an exam from question bank as teacher's own exam
// @route   POST /api/question-bank/:examId/reuse
// @access  Private (Any authenticated user - teachers from any org)
router.post('/:examId/reuse', reuseQuestionBankExam);

module.exports = router;
