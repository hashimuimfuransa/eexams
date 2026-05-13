const express = require('express');
const router = express.Router();
const Result = require('../models/Result');

// Get result by ID (public - for exam result display)
router.get('/:resultId', async (req, res) => {
  try {
    const { resultId } = req.params;

    const result = await Result.findById(resultId)
      .populate('student', 'firstName lastName email')
      .populate('exam', 'title description timeLimit passingScore')
      .populate('answers.question', 'text type points correctAnswer options');

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
