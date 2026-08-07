const express = require('express');
const router = express.Router();
const Result = require('../models/Result');
const { apiLimiter } = require('../middleware/rateLimiter');
const { RESULT_QUESTION_SELECT } = require('../utils/resultQuestionFields');

// Get result by ID (public - for exam result display)
router.get('/:resultId', apiLimiter, async (req, res) => {
  try {
    const { resultId } = req.params;

    const result = await Result.findById(resultId)
      .populate('student', 'firstName lastName email')
      .populate('exam', 'title description timeLimit passingScore')
      // Selected only text/type/points/correctAnswer/options before, which left a
      // financial-spreadsheet answer with no template or model answer to render against.
      .populate('answers.question', RESULT_QUESTION_SELECT);

    if (!result) {
      return res.status(404).json({ message: 'Result not found' });
    }

    res.json(result);
  } catch (error) {
    console.error('Get result error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
