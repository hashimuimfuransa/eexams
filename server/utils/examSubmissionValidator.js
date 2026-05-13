/**
 * Enhanced exam submission validation utilities
 * Provides comprehensive validation for exam submissions and answers
 */

/**
 * Validate exam submission data
 * @param {Object} result - The exam result object
 * @param {Object} exam - The exam object
 * @returns {Object} - Validation result with success flag and errors
 */
const validateExamSubmission = (result, exam) => {
  const errors = [];
  const warnings = [];

  // Basic validation with enhanced error messages
  if (!result) {
    errors.push('Result object is required - exam session not found');
    return { success: false, errors, warnings };
  }

  if (!exam) {
    errors.push('Exam object is required - exam data not found');
    return { success: false, errors, warnings };
  }

  // Check if result has answers
  if (!result.answers || !Array.isArray(result.answers) || result.answers.length === 0) {
    errors.push('No answers found in the result. Please answer at least one question before submitting.');
    return { success: false, errors, warnings };
  }

  // Validate that the result is not already completed
  if (result.isCompleted) {
    errors.push('Exam has already been completed and cannot be submitted again');
    return { success: false, errors, warnings };
  }

  // Enhanced answer completeness validation
  const answeredQuestions = result.answers.filter(answer => {
    // Check for any type of answer content
    const hasTextAnswer = answer.textAnswer && answer.textAnswer.trim().length > 0;
    const hasSelectedOption = answer.selectedOption && answer.selectedOption.trim().length > 0;
    const hasMatchingAnswers = answer.matchingAnswers &&
      (Array.isArray(answer.matchingAnswers) ? answer.matchingAnswers.length > 0 :
       typeof answer.matchingAnswers === 'object' && Object.keys(answer.matchingAnswers).length > 0);
    const hasOrderingAnswer = answer.orderingAnswer &&
      (Array.isArray(answer.orderingAnswer) ? answer.orderingAnswer.length > 0 :
       typeof answer.orderingAnswer === 'object' && Object.keys(answer.orderingAnswer).length > 0);
    const hasDragDropAnswer = answer.dragDropAnswer &&
      (Array.isArray(answer.dragDropAnswer) ? answer.dragDropAnswer.length > 0 :
       typeof answer.dragDropAnswer === 'object' && Object.keys(answer.dragDropAnswer).length > 0);

    return hasTextAnswer || hasSelectedOption || hasMatchingAnswers || hasOrderingAnswer || hasDragDropAnswer;
  });

  console.log(`📊 Submission validation: ${answeredQuestions.length}/${result.answers.length} questions have valid answers`);

  if (answeredQuestions.length === 0) {
    errors.push('No valid answers found. Please answer at least one question.');
    return { success: false, errors, warnings };
  }

  // Check for selective answering requirements
  if (exam.allowSelectiveAnswering) {
    const sectionBAnswers = result.answers.filter(answer =>
      answer.question && answer.question.section === 'B'
    );
    const sectionCAnswers = result.answers.filter(answer =>
      answer.question && answer.question.section === 'C'
    );

    const selectedBAnswers = sectionBAnswers.filter(answer => answer.isSelected);
    const selectedCAnswers = sectionCAnswers.filter(answer => answer.isSelected);

    const requiredBQuestions = exam.sectionBRequiredQuestions || 3;
    const requiredCQuestions = exam.sectionCRequiredQuestions || 1;

    if (selectedBAnswers.length < requiredBQuestions) {
      errors.push(`Section B requires at least ${requiredBQuestions} questions to be selected. Currently selected: ${selectedBAnswers.length}`);
    }

    if (selectedCAnswers.length < requiredCQuestions) {
      errors.push(`Section C requires at least ${requiredCQuestions} questions to be selected. Currently selected: ${selectedCAnswers.length}`);
    }
  }

  // Add warnings for incomplete answers
  const incompleteAnswers = result.answers.filter(answer =>
    !answer.textAnswer?.trim() &&
    !answer.selectedOption &&
    !answer.matchingAnswers &&
    !answer.orderingAnswer &&
    !answer.dragDropAnswer
  );

  if (incompleteAnswers.length > 0) {
    warnings.push(`${incompleteAnswers.length} questions have no answers`);
  }

  return {
    success: errors.length === 0,
    errors,
    warnings,
    stats: {
      totalQuestions: result.answers.length,
      answeredQuestions: answeredQuestions.length,
      incompleteQuestions: incompleteAnswers.length
    }
  };
};

/**
 * Validate individual answer submission
 * @param {Object} answerData - The answer data to validate
 * @param {Object} question - The question object
 * @returns {Object} - Validation result
 */
const validateAnswerSubmission = (answerData, question) => {
  const errors = [];
  const warnings = [];

  if (!answerData) {
    errors.push('Answer data is required');
    return { success: false, errors, warnings };
  }

  if (!question) {
    errors.push('Question object is required');
    return { success: false, errors, warnings };
  }

  const { questionId, selectedOption, textAnswer, questionType, matchingAnswers, orderingAnswer, dragDropAnswer } = answerData;

  // Validate question ID
  if (!questionId) {
    errors.push('Question ID is required');
  }

  // Validate based on question type
  const actualQuestionType = questionType || question.type;

  switch (actualQuestionType) {
    case 'multiple-choice':
    case 'true-false':
      if (!selectedOption && selectedOption !== 0 && selectedOption !== false) {
        errors.push(`Selected option is required for ${actualQuestionType} questions`);
      }
      break;

    case 'matching':
      if (!matchingAnswers || typeof matchingAnswers !== 'object') {
        errors.push('Matching answers object is required for matching questions');
      } else if (Object.keys(matchingAnswers).length === 0) {
        errors.push('Matching answers cannot be empty');
      }
      break;

    case 'ordering':
      if (!orderingAnswer || typeof orderingAnswer !== 'object') {
        errors.push('Ordering answer object is required for ordering questions');
      } else if (!Array.isArray(orderingAnswer) && typeof orderingAnswer !== 'object') {
        errors.push('Invalid ordering answer format');
      }
      break;

    case 'drag-drop':
      if (!dragDropAnswer || typeof dragDropAnswer !== 'object') {
        errors.push('Drag-drop answer object is required for drag-drop questions');
      }
      break;

    case 'fill-in-blank':
    case 'open-ended':
    case 'essay':
    case 'short-answer':
    default:
      if (!textAnswer || textAnswer.trim().length === 0) {
        errors.push(`Text answer is required for ${actualQuestionType} questions`);
      } else if (textAnswer.trim().length < 2) {
        warnings.push('Answer seems very short for this question type');
      }
      break;
  }

  // Additional validation for text answers
  if (textAnswer && typeof textAnswer === 'string') {
    if (textAnswer.length > 10000) {
      warnings.push('Answer is very long. Consider being more concise.');
    }
  }

  return {
    success: errors.length === 0,
    errors,
    warnings,
    questionType: actualQuestionType
  };
};

/**
 * Sanitize answer data to prevent injection attacks
 * @param {Object} answerData - The answer data to sanitize
 * @returns {Object} - Sanitized answer data
 */
const sanitizeAnswerData = (answerData) => {
  if (!answerData || typeof answerData !== 'object') {
    return {};
  }

  const sanitized = {};

  // Sanitize string fields
  if (answerData.questionId) {
    sanitized.questionId = String(answerData.questionId).trim();
  }

  if (answerData.selectedOption !== undefined) {
    sanitized.selectedOption = String(answerData.selectedOption).trim();
  }

  if (answerData.textAnswer) {
    // Remove potentially dangerous characters but preserve formatting
    sanitized.textAnswer = String(answerData.textAnswer)
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .trim();
  }

  if (answerData.questionType) {
    sanitized.questionType = String(answerData.questionType).trim();
  }

  // Handle complex answer types
  if (answerData.matchingAnswers && typeof answerData.matchingAnswers === 'object') {
    sanitized.matchingAnswers = answerData.matchingAnswers;
  }

  if (answerData.orderingAnswer) {
    sanitized.orderingAnswer = answerData.orderingAnswer;
  }

  if (answerData.dragDropAnswer) {
    sanitized.dragDropAnswer = answerData.dragDropAnswer;
  }

  return sanitized;
};

/**
 * Check if exam submission is within time limits
 * @param {Object} result - The exam result object
 * @param {Object} exam - The exam object
 * @returns {Object} - Time validation result
 */
const validateSubmissionTime = (result, exam) => {
  const errors = [];
  const warnings = [];

  if (!result.startTime) {
    errors.push('Exam start time not found');
    return { success: false, errors, warnings };
  }

  const startTime = new Date(result.startTime);
  const currentTime = new Date();
  const elapsedMinutes = (currentTime - startTime) / (1000 * 60);

  if (exam.duration && elapsedMinutes > exam.duration + 5) { // 5 minute grace period
    errors.push(`Exam time limit exceeded. Duration: ${exam.duration} minutes, Elapsed: ${Math.round(elapsedMinutes)} minutes`);
  } else if (exam.duration && elapsedMinutes > exam.duration) {
    warnings.push(`Exam submitted after time limit with grace period`);
  }

  return {
    success: errors.length === 0,
    errors,
    warnings,
    elapsedMinutes: Math.round(elapsedMinutes),
    timeLimit: exam.duration
  };
};

module.exports = {
  validateExamSubmission,
  validateAnswerSubmission,
  sanitizeAnswerData,
  validateSubmissionTime
};
