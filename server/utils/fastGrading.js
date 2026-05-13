const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini AI
const geminiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Fast chunked AI grading system that processes questions in small batches
 * for faster performance and better reliability
 */

/**
 * Grade a single question with fast AI processing
 * @param {Object} question - The question object
 * @param {Object} answer - The student's answer
 * @param {string} modelAnswer - The correct answer
 * @returns {Promise<Object>} - Grading result
 */
async function gradeQuestionFast(question, answer, modelAnswer) {
  const startTime = Date.now();

  try {
    console.log(`🚀 Fast grading ${question.type} question ${question._id}`);

    // Handle different question types
    switch (question.type) {
      case 'multiple-choice':
        return await gradeMultipleChoiceFast(question, answer, modelAnswer);

      case 'open-ended':
        return await gradeOpenEndedFast(question, answer, modelAnswer);

      case 'true-false':
      case 'fill-in-blank':
        return await gradeShortAnswerFast(question, answer, modelAnswer);

      default:
        return {
          score: 0,
          feedback: 'Question type not supported for fast grading',
          correctedAnswer: modelAnswer || 'Not available',
          gradingMethod: 'error_fallback' // Use existing enum value
        };
    }
  } catch (error) {
    console.error(`❌ Fast grading failed for question ${question._id}:`, error.message);

    // Fallback to simple scoring
    return {
      score: Math.round(question.points * 0.5), // Give 50% as fallback
      feedback: 'Unable to grade automatically. Manual review may be needed.',
      correctedAnswer: modelAnswer || 'Not available',
      gradingMethod: 'fallback_error'
    };
  } finally {
    const duration = Date.now() - startTime;
    console.log(`⚡ Question graded in ${duration}ms`);
  }
}

/**
 * Fast multiple choice grading
 */
async function gradeMultipleChoiceFast(question, answer, modelAnswer) {
  const selectedOption = answer.selectedOption || answer.selectedOptionLetter;

  if (!selectedOption) {
    return {
      score: 0,
      feedback: 'No option selected',
      correctedAnswer: modelAnswer,
      gradingMethod: 'no_answer' // Use existing enum value
    };
  }

  // Find the correct option
  let correctOption = null;
  let selectedAnswerOption = null;

  if (question.options && question.options.length > 0) {
    // Find correct option
    correctOption = question.options.find(opt => opt.isCorrect);

    // Find selected option
    selectedAnswerOption = question.options.find(opt =>
      opt.letter === selectedOption ||
      opt.text === selectedOption ||
      opt._id?.toString() === selectedOption
    );
  }

  // Determine if correct
  let isCorrect = false;

  if (correctOption && selectedAnswerOption) {
    isCorrect = correctOption._id?.toString() === selectedAnswerOption._id?.toString() ||
                correctOption.letter === selectedAnswerOption.letter;
  } else {
    // Fallback to string comparison
    isCorrect = selectedOption === modelAnswer ||
                selectedOption.toLowerCase() === modelAnswer.toLowerCase();
  }

  const score = isCorrect ? question.points : 0;
  const feedback = isCorrect
    ? 'Correct answer!'
    : `Incorrect. The correct answer is: ${correctOption?.text || modelAnswer}`;

  return {
    score,
    feedback,
    correctedAnswer: correctOption?.text || modelAnswer,
    gradingMethod: 'enhanced_grading', // Use existing enum value
    isCorrect
  };
}

/**
 * Fast open-ended grading using AI
 */
async function gradeOpenEndedFast(question, answer, modelAnswer) {
  const studentAnswer = answer.textAnswer?.trim();

  if (!studentAnswer) {
    return {
      score: 0,
      feedback: 'No answer provided',
      correctedAnswer: modelAnswer,
      gradingMethod: 'no_answer'
    };
  }

  // For very short answers (less than 10 characters), use keyword matching for speed
  if (studentAnswer.length < 10) {
    console.log(`Using fast keyword matching for short answer: "${studentAnswer}"`);
    return gradeWithKeywordsFast(studentAnswer, modelAnswer, question.points);
  }

  // Use AI for grading with enhanced processing for sections B and C
  try {
    const model = geminiClient.getGenerativeModel({ model: 'gemini-1.5-flash' }); // Use flash for speed

    // Simplified, faster prompt for all question types
    const isEssayQuestion = question.section === 'B' || question.section === 'C';
    const prompt = `Grade this answer quickly and provide feedback:

QUESTION: ${question.text}
STUDENT ANSWER: ${studentAnswer}
MODEL ANSWER: ${modelAnswer || 'Evaluate based on question content'}
MAX POINTS: ${question.points}
SECTION: ${question.section}

${isEssayQuestion ? 'Provide detailed feedback for this essay/open-ended question.' : 'Provide brief feedback.'}

Return ONLY valid JSON:
{
  "score": [0-${question.points}],
  "feedback": "${isEssayQuestion ? '[Detailed feedback explaining score, strengths, and areas for improvement]' : '[Brief feedback]'}",
  "correctedAnswer": "[Model answer or key points expected]"
}`;

    // Fast AI processing with timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('AI timeout')), 3000); // 3 second timeout
    });

    const aiPromise = model.generateContent(prompt);
    const response = await Promise.race([aiPromise, timeoutPromise]);
    const text = response.response.text();
    const cleanText = text.replace(/```json\n?|\n?```/g, '').trim();

    const result = JSON.parse(cleanText);

    const finalScore = Math.min(Math.max(0, result.score || 0), question.points);
    // isEssayQuestion already declared above

    return {
      score: finalScore,
      feedback: result.feedback || (isEssayQuestion ? 'AI graded your essay answer' : 'AI graded answer'),
      correctedAnswer: result.correctedAnswer || modelAnswer,
      gradingMethod: 'enhanced_ai_grading',
      isCorrect: finalScore >= question.points,
      // Store enhanced data for sections B & C display
      aiAnalysis: isEssayQuestion ? {
        detailedFeedback: result.feedback || 'AI provided detailed analysis',
        modelAnswer: result.correctedAnswer || modelAnswer,
        score: finalScore,
        maxPoints: question.points
      } : null
    };

  } catch (error) {
    console.error(`AI grading failed for question ${question._id}:`, error.message);

    // Fast keyword fallback
    const fallbackResult = gradeWithKeywordsFast(studentAnswer, modelAnswer, question.points);
    console.log(`Using keyword fallback for question ${question._id}, score: ${fallbackResult.score}`);
    return fallbackResult;
  }
}

/**
 * Fast short answer grading
 */
async function gradeShortAnswerFast(question, answer, modelAnswer) {
  const studentAnswer = (answer.textAnswer || '').trim().toLowerCase();
  const correctAnswer = (modelAnswer || '').toLowerCase();

  if (!studentAnswer) {
    return {
      score: 0,
      feedback: 'No answer provided',
      correctedAnswer: modelAnswer,
      gradingMethod: 'no_answer'
    };
  }

  // Quick exact match
  if (studentAnswer === correctAnswer) {
    return {
      score: question.points,
      feedback: 'Correct!',
      correctedAnswer: modelAnswer,
      gradingMethod: 'enhanced_grading', // Use existing enum value
      isCorrect: true
    };
  }

  // Quick similarity check
  const similarity = calculateSimilarity(studentAnswer, correctAnswer);
  const score = similarity > 0.8 ? question.points :
                similarity > 0.6 ? Math.round(question.points * 0.8) :
                similarity > 0.4 ? Math.round(question.points * 0.5) : 0;

  const feedback = score === question.points ? 'Correct!' :
                   score > 0 ? 'Partially correct' :
                   'Incorrect';

  return {
    score,
    feedback,
    correctedAnswer: modelAnswer,
    gradingMethod: 'enhanced_grading', // Use existing enum value
    isCorrect: score >= question.points
  };
}

/**
 * Fast keyword-based grading fallback with enhanced feedback
 */
function gradeWithKeywordsFast(studentAnswer, modelAnswer, maxPoints) {
  const student = studentAnswer.toLowerCase();
  const model = (modelAnswer || '').toLowerCase();

  if (!model) {
    return {
      score: Math.round(maxPoints * 0.7), // Default 70%
      feedback: 'Answer recorded. Your response shows understanding. Manual review may provide additional feedback.',
      correctedAnswer: 'Model answer not available',
      gradingMethod: 'default_fallback'
    };
  }

  // Extract keywords (3+ characters)
  const keywords = model.split(/\s+/).filter(word => word.length >= 3);
  const matches = keywords.filter(keyword => student.includes(keyword)).length;

  const matchRatio = keywords.length > 0 ? matches / keywords.length : 0;
  const score = Math.round(matchRatio * maxPoints);

  // Enhanced feedback based on score
  let feedback;
  if (score >= maxPoints * 0.8) {
    feedback = `Excellent! Your answer includes ${matches}/${keywords.length} key concepts. Well done!`;
  } else if (score >= maxPoints * 0.6) {
    feedback = `Good work! Your answer covers ${matches}/${keywords.length} key concepts. Consider expanding on missing points.`;
  } else if (score >= maxPoints * 0.4) {
    feedback = `Your answer touches on ${matches}/${keywords.length} key concepts. Review the model answer to see what you might have missed.`;
  } else {
    feedback = `Your answer includes ${matches}/${keywords.length} key concepts. Compare with the model answer to understand the expected response better.`;
  }

  return {
    score,
    feedback,
    correctedAnswer: modelAnswer,
    gradingMethod: 'keyword_matching' // Use existing enum value
  };
}

/**
 * Calculate text similarity quickly
 */
function calculateSimilarity(text1, text2) {
  const words1 = text1.split(/\s+/);
  const words2 = text2.split(/\s+/);

  const commonWords = words1.filter(word => words2.includes(word)).length;
  const totalWords = Math.max(words1.length, words2.length);

  return totalWords > 0 ? commonWords / totalWords : 0;
}

/**
 * Main fast chunked grading function
 * @param {Object} result - The exam result object
 * @param {Object} exam - The exam object
 * @returns {Promise<Object>} - Grading results
 */
async function fastChunkedGrading(result, exam) {
  const startTime = Date.now();
  console.log(`🚀 Starting fast chunked grading for ${result.answers.length} questions`);

  let processedCount = 0;
  let aiGradedCount = 0;
  const chunkSize = 2; // Process 2 questions at a time for faster processing

  // Process questions in chunks
  for (let i = 0; i < result.answers.length; i += chunkSize) {
    const chunk = result.answers.slice(i, i + chunkSize);

    // Process chunk in parallel
    const chunkPromises = chunk.map(async (answer, index) => {
      const actualIndex = i + index;
      const question = answer.question;

      // Skip if not selected (for selective answering)
      if (answer.isSelected === false) {
        return {
          index: actualIndex,
          grading: {
            score: 0,
            feedback: 'Question not selected',
            correctedAnswer: question.correctAnswer || 'Not available',
            gradingMethod: 'not_selected' // This is already in the enum
          },
          skipped: false
        };
      }

      const hasAnswer = answer.textAnswer || answer.selectedOption ||
                       answer.matchingAnswers || answer.orderingAnswer;

      if (!hasAnswer) {
        return {
          index: actualIndex,
          grading: {
            score: 0,
            feedback: 'No answer provided',
            correctedAnswer: question.correctAnswer || 'Not available',
            gradingMethod: 'no_answer' // This is already in the enum
          },
          skipped: false
        };
      }

      try {
        const grading = await gradeQuestionFast(question, answer, question.correctAnswer);

        if (grading.gradingMethod?.includes('ai')) {
          aiGradedCount++;
        }

        return {
          index: actualIndex,
          grading,
          skipped: false
        };
      } catch (error) {
        console.error(`Error grading question ${question._id}:`, error);
        return {
          index: actualIndex,
          grading: {
            score: 0,
            feedback: 'Grading error occurred',
            correctedAnswer: question.correctAnswer,
            gradingMethod: 'error'
          },
          skipped: false
        };
      }
    });

    // Wait for chunk to complete
    const chunkResults = await Promise.all(chunkPromises);

    // Apply results
    chunkResults.forEach(({ index, grading, skipped }) => {
      if (grading) {
        result.answers[index].score = grading.score || 0;
        result.answers[index].feedback = grading.feedback || 'No feedback';
        result.answers[index].isCorrect = grading.isCorrect !== undefined ? grading.isCorrect : (grading.score >= result.answers[index].question.points);
        result.answers[index].correctedAnswer = grading.correctedAnswer || result.answers[index].question.correctAnswer;
        result.answers[index].gradingMethod = grading.gradingMethod || 'enhanced_grading';

        // Store AI analysis data for sections B & C
        if (grading.aiAnalysis) {
          result.answers[index].aiAnalysis = grading.aiAnalysis;
          result.answers[index].detailedFeedback = grading.aiAnalysis.detailedFeedback;
          result.answers[index].aiModelAnswer = grading.aiAnalysis.modelAnswer;
        }

        if (!skipped) {
          processedCount++;
        }
      }
    });

    // Minimal delay between chunks
    if (i + chunkSize < result.answers.length) {
      await new Promise(resolve => setTimeout(resolve, 50)); // Reduced delay
    }
  }

  // Calculate scores
  const totalScore = result.answers.reduce((sum, answer) => sum + (answer.score || 0), 0);
  const maxPossibleScore = result.answers.reduce((sum, answer) =>
    sum + (answer.question?.points || 1), 0) || 1;

  const totalTime = Date.now() - startTime;

  console.log(`✅ Fast grading completed in ${totalTime}ms`);
  console.log(`- Processed: ${processedCount} questions`);
  console.log(`- AI graded: ${aiGradedCount} questions`);
  console.log(`- Score: ${totalScore}/${maxPossibleScore}`);

  return {
    answers: result.answers,
    totalScore,
    maxPossibleScore,
    processedCount,
    aiGradedCount,
    totalTime
  };
}

module.exports = {
  fastChunkedGrading,
  gradeQuestionFast
};
