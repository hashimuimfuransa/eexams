const Result = require('../models/Result');
const Question = require('../models/Question');

/**
 * Batch update answers in a result document
 * Optimized for high-volume answer submissions during exams
 */
const batchUpdateAnswers = async (resultId, answerUpdates) => {
  try {
    const result = await Result.findById(resultId);
    if (!result) {
      throw new Error('Result not found');
    }

    // Create a map of question IDs to answer indices for O(1) lookups
    const questionToIndexMap = {};
    result.answers.forEach((answer, index) => {
      questionToIndexMap[answer.question.toString()] = index;
    });

    // Batch update answers
    let updatedCount = 0;
    answerUpdates.forEach(update => {
      const answerIndex = questionToIndexMap[update.questionId];
      if (answerIndex !== undefined) {
        // Update the answer fields
        if (update.selectedOption !== undefined) {
          result.answers[answerIndex].selectedOption = update.selectedOption;
        }
        if (update.selectedOptionLetter !== undefined) {
          result.answers[answerIndex].selectedOptionLetter = update.selectedOptionLetter;
        }
        if (update.textAnswer !== undefined) {
          result.answers[answerIndex].textAnswer = update.textAnswer;
        }
        if (update.matchingAnswers !== undefined) {
          result.answers[answerIndex].matchingAnswers = update.matchingAnswers;
        }
        if (update.orderingAnswer !== undefined) {
          result.answers[answerIndex].orderingAnswer = update.orderingAnswer;
        }
        if (update.dragDropAnswer !== undefined) {
          result.answers[answerIndex].dragDropAnswer = update.dragDropAnswer;
        }
        if (update.isCorrect !== undefined) {
          result.answers[answerIndex].isCorrect = update.isCorrect;
        }
        if (update.score !== undefined) {
          result.answers[answerIndex].score = update.score;
        }
        if (update.feedback !== undefined) {
          result.answers[answerIndex].feedback = update.feedback;
        }
        updatedCount++;
      }
    });

    // Mark the answers array as modified
    result.markModified('answers');

    // Save the result
    await result.save();

    return { success: true, updatedCount };
  } catch (error) {
    console.error('Batch update answers error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Batch grade answers using bulk operations
 * Optimized for grading multiple answers at once
 */
const batchGradeAnswers = async (resultId, gradingData) => {
  try {
    const result = await Result.findById(resultId);
    if (!result) {
      throw new Error('Result not found');
    }

    // Create a map of question IDs to answer indices
    const questionToIndexMap = {};
    result.answers.forEach((answer, index) => {
      questionToIndexMap[answer.question.toString()] = index;
    });

    let totalScore = 0;
    let gradedCount = 0;

    // Batch grade answers
    gradingData.forEach(grade => {
      const answerIndex = questionToIndexMap[grade.questionId];
      if (answerIndex !== undefined) {
        result.answers[answerIndex].isCorrect = grade.isCorrect;
        result.answers[answerIndex].score = grade.score;
        result.answers[answerIndex].feedback = grade.feedback;
        result.answers[answerIndex].gradingMethod = grade.gradingMethod || 'enhanced_grading';
        
        // Add enhanced AI grading fields if provided
        if (grade.conceptsPresent) {
          result.answers[answerIndex].conceptsPresent = grade.conceptsPresent;
        }
        if (grade.conceptsMissing) {
          result.answers[answerIndex].conceptsMissing = grade.conceptsMissing;
        }
        if (grade.improvementSuggestions) {
          result.answers[answerIndex].improvementSuggestions = grade.improvementSuggestions;
        }
        if (grade.technicalAccuracy) {
          result.answers[answerIndex].technicalAccuracy = grade.technicalAccuracy;
        }
        if (grade.partialCreditBreakdown) {
          result.answers[answerIndex].partialCreditBreakdown = grade.partialCreditBreakdown;
        }

        totalScore += grade.score;
        gradedCount++;
      }
    });

    // Update total score
    result.totalScore = totalScore;
    result.markModified('answers');

    // Save the result
    await result.save();

    return { success: true, gradedCount, totalScore };
  } catch (error) {
    console.error('Batch grade answers error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Bulk fetch questions by IDs
 * Optimized for fetching multiple questions at once
 */
const bulkFetchQuestions = async (questionIds) => {
  try {
    const questions = await Question.find({
      _id: { $in: questionIds }
    }).select('text type options points section correctAnswer explanation keyPoints');
    
    // Create a map for O(1) lookups
    const questionMap = {};
    questions.forEach(q => {
      questionMap[q._id.toString()] = q;
    });

    return { success: true, questions, questionMap };
  } catch (error) {
    console.error('Bulk fetch questions error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Batch update question selection status
 * Optimized for selective answering feature
 */
const batchUpdateSelection = async (resultId, selections) => {
  try {
    const result = await Result.findById(resultId);
    if (!result) {
      throw new Error('Result not found');
    }

    // Create a map of question IDs to answer indices
    const questionToIndexMap = {};
    result.answers.forEach((answer, index) => {
      questionToIndexMap[answer.question.toString()] = index;
    });

    let updatedCount = 0;
    selections.forEach(selection => {
      const answerIndex = questionToIndexMap[selection.questionId];
      if (answerIndex !== undefined) {
        result.answers[answerIndex].isSelected = selection.isSelected;
        updatedCount++;
      }
    });

    result.markModified('answers');
    await result.save();

    return { success: true, updatedCount };
  } catch (error) {
    console.error('Batch update selection error:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  batchUpdateAnswers,
  batchGradeAnswers,
  bulkFetchQuestions,
  batchUpdateSelection
};
