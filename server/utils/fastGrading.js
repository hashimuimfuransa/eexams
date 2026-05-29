const groqClient = require('./groqClient');
const { verifyGradingWithAI } = require('./enhancedGrading');

/**
 * Fast chunked AI grading system that processes questions in small batches
 * for faster performance and better reliability
 */

/**
 * Grade sub-questions
 * @param {Object} question - The parent question object
 * @param {Object} answer - The student's answer with subQuestionAnswers
 * @param {string} modelAnswer - The correct answer (for parent)
 * @returns {Promise<Object>} - Grading result for all sub-questions
 */
async function gradeSubQuestionsFast(question, answer, modelAnswer) {
  console.log(`📝 Grading ${answer.subQuestionAnswers.length} sub-questions for question ${question._id}`);

  const subQuestions = question.subQuestions || [];
  const subAnswers = answer.subQuestionAnswers || [];

  let totalScore = 0;
  let totalMaxPoints = 0;
  const subQuestionResults = [];

  // Iterate over sub-answers (if question.subQuestions is empty, use subAnswers length)
  const iterationCount = subQuestions.length > 0 ? subQuestions.length : subAnswers.length;

  for (let i = 0; i < iterationCount; i++) {
    const subQ = subQuestions[i] || question; // Fall back to parent question if no sub-questions defined
    const subAnswer = subAnswers[i];

    if (!subAnswer || !subAnswer.answered) {
      subQuestionResults.push({
        subIndex: i,
        score: 0,
        maxPoints: subQ.points || 1,
        feedback: 'No answer provided',
        isCorrect: false
      });
      totalMaxPoints += (subQ.points || 1);
      continue;
    }

    let subScore = 0;
    let isCorrect = false;
    let feedback = '';
    let correctedAnswer = '';

    // If question has subQuestions defined, use normal grading
    if (subQuestions.length > 0) {
      const tempAnswer = {
        selectedOption: subAnswer.selectedOption,
        textAnswer: subAnswer.textAnswer,
        matchingAnswers: subAnswer.matchingAnswers,
        orderingAnswer: subAnswer.orderingAnswer
      };
      const subModelAnswer = subQ.correctAnswer || modelAnswer || '';
      const subGrading = await gradeQuestionFast(subQ, tempAnswer, subModelAnswer);
      subScore = subGrading.score;
      isCorrect = subGrading.isCorrect;
      feedback = subGrading.feedback;
      correctedAnswer = subGrading.correctedAnswer;
    } else {
      // Otherwise, grade based on parent question's options/wordBank
      if (subAnswer.questionType === 'multiple-choice' || subAnswer.questionType === 'true-false') {
        // Check if selected option matches any correct option in parent question
        const correctOptions = question.options ? question.options.filter(opt => opt.isCorrect).map(opt => opt.text) : [];
        // Check both selectedOption and textAnswer as answer may be stored in either field
        const studentSelectedOption = subAnswer.selectedOption || subAnswer.textAnswer || '';
        console.log(`🔍 Sub-question ${i} MC grading:`, {
          selectedOption: studentSelectedOption,
          correctOptions,
          questionOptions: question.options?.map(o => ({ text: o.text, isCorrect: o.isCorrect }))
        });
        if (correctOptions.length > 0 && correctOptions.includes(studentSelectedOption)) {
          subScore = subQ.points || 1;
          isCorrect = true;
          feedback = 'Correct';
          correctedAnswer = correctOptions.join(', ');
        } else if (correctOptions.length === 0) {
          // No correct options defined - fall back to AI grading
          console.log(`⚠️ No correct options defined for sub-question ${i}, falling back to AI grading`);
          const tempAnswer = {
            selectedOption: subAnswer.selectedOption,
            textAnswer: subAnswer.textAnswer
          };
          const subGrading = await gradeQuestionFast(question, tempAnswer, modelAnswer || '');
          subScore = subGrading.score;
          isCorrect = subGrading.isCorrect;
          feedback = subGrading.feedback;
          correctedAnswer = subGrading.correctedAnswer;
        } else {
          subScore = 0;
          isCorrect = false;
          feedback = `Incorrect. Correct answer: ${correctOptions.join(', ')}`;
          correctedAnswer = correctOptions.join(', ');
        }
      } else if (subAnswer.questionType === 'fill-in-blank') {
        // Check if answer matches any word in wordBank
        const wordBank = question.wordBank || [];
        const studentAnswer = subAnswer.textAnswer?.trim().toLowerCase();
        console.log(`🔍 Sub-question ${i} fill-in-blank grading:`, {
          studentAnswer,
          wordBank
        });
        if (wordBank.length > 0 && studentAnswer && wordBank.some(word => word.toLowerCase() === studentAnswer)) {
          subScore = subQ.points || 1;
          isCorrect = true;
          feedback = 'Correct';
          correctedAnswer = studentAnswer;
        } else if (wordBank.length === 0) {
          // No wordBank defined - fall back to AI grading
          console.log(`⚠️ No wordBank defined for sub-question ${i}, falling back to AI grading`);
          const tempAnswer = {
            selectedOption: subAnswer.selectedOption,
            textAnswer: subAnswer.textAnswer
          };
          const subGrading = await gradeQuestionFast(question, tempAnswer, modelAnswer || '');
          subScore = subGrading.score;
          isCorrect = subGrading.isCorrect;
          feedback = subGrading.feedback;
          correctedAnswer = subGrading.correctedAnswer;
        } else {
          subScore = 0;
          isCorrect = false;
          feedback = `Incorrect. Valid answers: ${wordBank.join(', ')}`;
          correctedAnswer = wordBank.join(', ');
        }
      } else {
        // For other types, use the parent question's correctAnswer
        const subModelAnswer = modelAnswer || '';
        const tempAnswer = {
          selectedOption: subAnswer.selectedOption,
          textAnswer: subAnswer.textAnswer
        };
        const subGrading = await gradeQuestionFast(question, tempAnswer, subModelAnswer);
        subScore = subGrading.score;
        isCorrect = subGrading.isCorrect;
        feedback = subGrading.feedback;
        correctedAnswer = subGrading.correctedAnswer;
      }
    }

    subQuestionResults.push({
      subIndex: i,
      score: subScore,
      maxPoints: subQ.points || 1,
      feedback,
      isCorrect,
      correctedAnswer
    });

    totalScore += subScore;
    totalMaxPoints += (subQ.points || 1);
  }

  const overallFeedback = subQuestionResults.map(r =>
    `Sub-question ${r.subIndex + 1}: ${r.score}/${r.maxPoints} - ${r.feedback}`
  ).join('\n');

  return {
    score: totalScore,
    feedback: overallFeedback,
    correctedAnswer: modelAnswer,
    gradingMethod: 'fast_grading',
    subQuestionResults,
    totalMaxPoints
  };
}

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
      case 'image':
      case 'image-based':
      case 'essay':
      case 'short-answer':
        return await gradeOpenEndedFast(question, answer, modelAnswer);

      case 'true-false':
      case 'fill-in-blank':
        return await gradeShortAnswerFast(question, answer, modelAnswer);

      case 'matching':
        return await gradeMatchingFast(question, answer, modelAnswer);

      case 'ordering':
        return await gradeOrderingFast(question, answer, modelAnswer);

      case 'drag-drop':
        return await gradeDragDropFast(question, answer, modelAnswer);

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
  // Check selectedOption, selectedOptionLetter, and textAnswer as answer may be stored in any field
  const selectedOption = answer.selectedOption || answer.selectedOptionLetter || answer.textAnswer;

  if (!selectedOption) {
    return {
      score: 0,
      feedback: 'No option selected',
      correctedAnswer: modelAnswer,
      gradingMethod: 'no_answer' // Use existing enum value
    };
  }

  // Use AI to determine the correct answer (like regrading does)
  // This ensures consistency between initial grading and regrading
  if (question.options && Array.isArray(question.options) && question.options.length >= 2) {
    try {
      const { generateContent } = require('./aiService');
      const questionText = question.text;
      const options = question.options.map(opt => ({
        letter: opt.letter || '',
        text: opt.text || ''
      }));

      const prompt = `
You are an expert in computer systems and exam grading with up-to-date knowledge of modern technology.

I have a multiple choice question from a computer systems exam:
Question: ${questionText}

Options:
${options.map(opt => `${opt.letter}. ${opt.text}`).join('\n')}

Please determine the correct answer based on current, modern technology standards and practices. Consider that there may be multiple valid answers depending on the context, but select the most appropriate one.

Important: Do not rely on outdated information. For example, while PS/2 ports were once common for keyboards, USB is now the standard connection method for most modern keyboards.

Only respond with the letter of the correct option (A, B, C, or D).
`;

      const response = await generateContent(prompt);

      if (response && response.text) {
        const letterMatch = response.text.match(/\b([A-D])\b/i);
        if (letterMatch) {
          const correctLetter = letterMatch[1].toUpperCase();
          const correctOption = question.options.find(opt =>
            opt.letter && opt.letter.toUpperCase() === correctLetter
          );
          if (correctOption) {
            // Mark this option as correct in memory
            question.options.forEach(opt => {
              opt.isCorrect = (opt.letter && opt.letter.toUpperCase() === correctLetter);
            });

            // Update the question's correct answer in the database
            const Question = require('../models/Question');
            try {
              const updatedOptions = question.options.map((opt, index) => {
                if (!opt.letter) {
                  opt.letter = String.fromCharCode(65 + index);
                }
                if (!opt.value) {
                  opt.value = opt.letter.toLowerCase();
                }
                opt.isCorrect = (opt.letter && opt.letter.toUpperCase() === correctLetter);
                return opt;
              });

              await Question.findByIdAndUpdate(
                question._id,
                {
                  $set: {
                    options: updatedOptions,
                    correctAnswer: correctOption.text
                  }
                },
                { new: true }
              );
              console.log(`Updated multiple choice question ${question._id} with AI-determined correct answer: ${correctLetter} (${correctOption.text})`);
            } catch (updateError) {
              console.error(`Error updating multiple choice question in database: ${updateError.message}`);
            }
          }
        }
      }
    } catch (aiError) {
      console.error(`Error using AI to determine correct answer for multiple choice: ${aiError.message}`);
      // Fall back to existing logic if AI fails
    }
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

  let score = isCorrect ? question.points : 0;
  let feedback = isCorrect
    ? 'Correct answer!'
    : `Incorrect. The correct answer is: ${correctOption?.text || modelAnswer}`;

  // Run fast AI verification to catch grading errors
  try {
    const verification = await verifyGradingWithAI(
      question,
      selectedOption,
      correctOption?.text || modelAnswer,
      isCorrect,
      1500 // 1.5 second timeout for fast grading (quicker)
    );

    // If AI verification disagrees with high confidence, adjust grading
    if (!verification.verified && verification.confidence > 0.85) {
      if (verification.recommendation === 'change_to_correct' && !isCorrect) {
        console.log(`🔄 Fast AI verification corrected MC grading: INCORRECT -> CORRECT`);
        isCorrect = true;
        score = question.points;
        feedback = 'Correct answer! (verified by AI)';
      } else if (verification.recommendation === 'change_to_incorrect' && isCorrect) {
        console.log(`🔄 Fast AI verification corrected MC grading: CORRECT -> INCORRECT`);
        isCorrect = false;
        score = 0;
        feedback = `Incorrect. The correct answer is: ${correctOption?.text || modelAnswer}`;
      }
    }

    return {
      score,
      feedback,
      correctedAnswer: correctOption?.text || modelAnswer,
      gradingMethod: 'ai_determined_correct',
      isCorrect,
      aiVerification: verification
    };
  } catch (verifyError) {
    // Return original grading if verification fails
    return {
      score,
      feedback,
      correctedAnswer: correctOption?.text || modelAnswer,
      gradingMethod: 'ai_determined_correct',
      isCorrect,
      aiVerification: { verified: false, error: verifyError.message }
    };
  }
}

/**
 * Detect if question has multiple parts
 * @param {string} questionText - The question text
 * @returns {Object} - Detection result
 */
function detectMultiPartQuestionFast(questionText) {
  if (!questionText) return { isMultiPart: false, expectedParts: 1 };

  // More conservative multi-part detection
  // Only detect as multi-part if there are clear structural indicators
  const letterParts = questionText.match(/\b[a-z]\)[\s]|\([a-z]\)[\s]|\\b[a-z]\.[\s]/gi);
  const romanParts = questionText.match(/\b[i]{1,3}\)[\s]|\([i]{1,3}\)[\s]/gi);

  const allParts = [...(letterParts || []), ...(romanParts || [])];
  const uniqueParts = new Set(allParts.map(p => p.toLowerCase().replace(/[\(\)\[\]\s\.:]/g, '')));

  // Check for explicit "part" language or numbered list format
  const hasExplicitParts = /(?:part|section|step)\s*\d+/i.test(questionText);
  const hasNumberedList = /\d+\)[\s]|\d+\.[\s]/.test(questionText) && (questionText.match(/\d+\)[\s]|\d+\.[\s]/g) || []).length > 1;

  const marksPattern = questionText.match(/\(\s*\d+\s*(?:mark|marks)\s*\)/gi);
  const totalMarks = marksPattern ? marksPattern.reduce((sum, m) => {
    const num = parseInt(m.match(/\d+/)[0]);
    return sum + num;
  }, 0) : 0;

  // Only consider it multi-part if there are at least 2 clearly labeled parts
  // AND it's not a simple math/calculation question
  const isCalculationQuestion = /calculate|compute|find|solve|determine|what is|how much|how many/i.test(questionText);
  
  return {
    isMultiPart: (uniqueParts.size >= 2 || hasExplicitParts || hasNumberedList) && !isCalculationQuestion,
    expectedParts: Math.max(uniqueParts.size, 1),
    totalMarks: totalMarks,
    detectedParts: Array.from(uniqueParts)
  };
}

/**
 * Validate multi-part answer completeness
 * @param {string} studentAnswer - Student's answer
 * @param {Object} multiPartInfo - Multi-part question info
 * @returns {Object} - Validation result
 */
function validateMultiPartAnswerFast(studentAnswer, multiPartInfo) {
  if (!multiPartInfo.isMultiPart || !studentAnswer) {
    return { isValid: true, partsFound: 1, partsMissing: 0, completeness: 1 };
  }

  const answer = studentAnswer.toLowerCase();
  const partsFound = multiPartInfo.detectedParts.filter(part => {
    const partPatterns = [
      new RegExp(`\\b${part}\\s*[\.\),:=-]`, 'i'),
      new RegExp(`\\(${part}\\)`, 'i'),
      new RegExp(`\\[${part}\]`, 'i')
    ];
    return partPatterns.some(pattern => pattern.test(answer));
  }).length;

  const completeness = partsFound / multiPartInfo.expectedParts;

  return {
    isValid: completeness >= 0.25,
    partsFound,
    partsMissing: multiPartInfo.expectedParts - partsFound,
    completeness
  };
}

/**
 * Apply multi-part scaling to score
 * @param {number} score - The calculated score
 * @param {number} maxPoints - Maximum points
 * @param {Object} multiPartInfo - Multi-part info
 * @param {Object} multiPartValidation - Validation result
 * @returns {number} - Scaled score
 */
function applyMultiPartScaling(score, maxPoints, multiPartInfo, multiPartValidation) {
  if (!multiPartInfo.isMultiPart || multiPartValidation.completeness >= 1.0) {
    return score;
  }

  // Severely incomplete (< 25%) - already rejected before this function
  if (multiPartValidation.completeness < 0.25) {
    return 0;
  }

  // Proportional scoring: cap at the percentage of parts answered
  const proportionalMax = Math.round(maxPoints * multiPartValidation.completeness);
  const scaledScore = Math.min(score, proportionalMax);

  console.log(`Fast grading multi-part scaling: ${score} -> ${scaledScore} (max ${Math.round(multiPartValidation.completeness * 100)}% for ${multiPartValidation.partsFound}/${multiPartInfo.expectedParts} parts)`);

  return scaledScore;
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

  // Check for meaningless answers like "I don't know", "no idea", etc.
  const meaninglessPatterns = [
    /^(i\s+don'?t\s+know|dont\s+know|no\s+idea|i\s+have\s+no\s+idea|not\s+sure|unsure|i\s+don'?t\s+understand|dont\s+understand)$/i,
    /^(i\s+do\s+not\s+know|i\s+do\s+not\s+understand|i\s+have\s+no\s+clue|no\s+clue)$/i,
    /^(skip|pass|n\/a|none|nothing|answer|question)$/i,
    /^(please\s+help|help\s+me|idk)$/i
  ];

  const cleanAnswer = studentAnswer.toLowerCase().trim();
  for (const pattern of meaninglessPatterns) {
    if (pattern.test(cleanAnswer)) {
      console.log(`Detected meaningless answer: "${studentAnswer}"`);
      return {
        score: 0,
        feedback: 'Your answer indicates you do not know the answer. Please review the material and provide a proper response.',
        correctedAnswer: modelAnswer,
        gradingMethod: 'meaningless_answer'
      };
    }
  }

  // Check for multi-part questions
  const multiPartInfo = detectMultiPartQuestionFast(question.text);
  const multiPartValidation = validateMultiPartAnswerFast(studentAnswer, multiPartInfo);

  // For severely incomplete multi-part answers (< 25%), log but still attempt grading
  // This allows partial credit for calculation questions that might be misdetected
  if (multiPartInfo.isMultiPart && multiPartValidation.completeness < 0.25) {
    console.log(`Fast grading: Multi-part question severely incomplete - ${multiPartValidation.partsFound}/${multiPartInfo.expectedParts} parts`);
    console.log(`⚠️ Attempting fallback grading for potentially misdetected multi-part question`);
    // Don't return 0, continue to attempt grading
  }

  // For very short answers (less than 10 characters), use keyword matching for speed
  if (studentAnswer.length < 10) {
    console.log(`Using fast keyword matching for short answer: "${studentAnswer}"`);
    const keywordResult = await gradeWithKeywordsFast(studentAnswer, modelAnswer, question.points, question.text);
    // Apply multi-part scaling to keyword result
    if (multiPartInfo.isMultiPart && multiPartValidation.completeness < 1.0) {
      keywordResult.score = applyMultiPartScaling(keywordResult.score, question.points, multiPartInfo, multiPartValidation);
      keywordResult.multiPartInfo = multiPartInfo;
      keywordResult.multiPartValidation = multiPartValidation;
    }
    return keywordResult;
  }

  // Use AI for grading with enhanced processing for sections B and C
  try {
    // Truncate long inputs to prevent timeout
    const MAX_LENGTH = 1000;
    const truncatedQuestion = question.text.length > MAX_LENGTH ? question.text.substring(0, MAX_LENGTH) + '...' : question.text;
    const truncatedAnswer = studentAnswer.length > MAX_LENGTH ? studentAnswer.substring(0, MAX_LENGTH) + '...' : studentAnswer;
    const truncatedModelAnswer = (modelAnswer && modelAnswer.length > MAX_LENGTH) ? modelAnswer.substring(0, MAX_LENGTH) + '...' : modelAnswer || 'Evaluate based on question';

    // Simplified, faster prompt for all question types
    // Section A is typically multiple choice, sections B and beyond are typically essay/open-ended
    const isEssayQuestion = question.section !== 'A';
    const prompt = `Grade (0-${question.points}). Q: ${truncatedQuestion}. A: ${truncatedAnswer}. Model: ${truncatedModelAnswer}. ${isEssayQuestion ? 'Detailed feedback.' : 'Brief feedback.'}

STRICT GRADING RULES:
- Award 0 points for meaningless answers like "I don't know", "no idea", "skip", "pass", etc.
- Award 0 points for answers that show no understanding of the question
- Only award points for substantive, relevant answers
- NO MINIMUM CREDIT - do not give points for effort alone

Return JSON: {score,feedback,correctedAnswer}`;

    // Fast AI processing with timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('AI timeout')), 15000); // Increased from 3 to 15 seconds for better reliability
    });

    const aiPromise = groqClient.generateContent(prompt, {
      model: 'smart',
      jsonMode: true,
      temperature: 0.2,
      maxTokens: 1024
    });
    const response = await Promise.race([aiPromise, timeoutPromise]);
    const text = response.text;
    const cleanText = text.replace(/```json\n?|\n?```/g, '').trim();

    const result = response.parsedContent || JSON.parse(cleanText);

    let finalScore = Math.min(Math.max(0, result.score || 0), question.points);

    // Apply multi-part scaling for proportional marks
    if (multiPartInfo.isMultiPart && multiPartValidation.completeness < 1.0) {
      finalScore = applyMultiPartScaling(finalScore, question.points, multiPartInfo, multiPartValidation);
    }

    // Run quick verification to ensure AI grading is consistent
    let verification = null;
    try {
      verification = await verifyGradingWithAI(
        question,
        truncatedAnswer,
        result.correctedAnswer || truncatedModelAnswer,
        finalScore >= question.points,
        2000 // 2 second timeout for verification
      );
    } catch (verifyError) {
      console.log(`AI verification skipped for open-ended: ${verifyError.message}`);
    }

    return {
      score: finalScore,
      feedback: result.feedback || (isEssayQuestion ? 'AI graded your essay answer' : 'AI graded answer'),
      correctedAnswer: result.correctedAnswer || modelAnswer,
      gradingMethod: 'enhanced_ai_grading',
      isCorrect: finalScore >= question.points,
      aiVerification: verification,
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
    let fallbackResult = await gradeWithKeywordsFast(studentAnswer, modelAnswer, question.points, question.text);
    console.log(`Using keyword fallback for question ${question._id}, score: ${fallbackResult.score}`);

    // Apply multi-part scaling to fallback result
    if (multiPartInfo.isMultiPart && multiPartValidation.completeness < 1.0) {
      fallbackResult.score = applyMultiPartScaling(fallbackResult.score, question.points, multiPartInfo, multiPartValidation);
      fallbackResult.multiPartInfo = multiPartInfo;
      fallbackResult.multiPartValidation = multiPartValidation;
    }

    // Run verification on keyword fallback
    try {
      const verification = await verifyGradingWithAI(
        question,
        studentAnswer,
        modelAnswer,
        fallbackResult.score >= question.points,
        2000
      );
      fallbackResult.aiVerification = verification;

      // If verification strongly disagrees with keyword result, flag it
      if (!verification.verified && verification.confidence > 0.9) {
        console.log(`⚠️ AI verification flagged keyword fallback for question ${question._id}: ${verification.reason}`);
      }
    } catch (verifyError) {
      fallbackResult.aiVerification = { verified: false, error: verifyError.message };
    }

    return fallbackResult;
  }
}

/**
 * Fast short answer grading
 */
async function gradeShortAnswerFast(question, answer, modelAnswer) {
  const studentAnswer = (answer.textAnswer || '').trim().toLowerCase();
  let correctAnswer = (modelAnswer || '').toLowerCase();

  // Use AI to determine the correct answer for true/false questions (like regrading does)
  // This ensures consistency between initial grading and regrading
  if (question.type === 'true-false' && question.options && Array.isArray(question.options) && question.options.length >= 2) {
    try {
      const { generateContent } = require('./aiService');
      const questionText = question.text;
      const options = question.options.map(opt => ({
        letter: opt.letter || '',
        text: opt.text || ''
      }));

      const prompt = `
You are an expert in computer systems and exam grading with up-to-date knowledge of modern technology.

I have a true/false question from a computer systems exam:
Question: ${questionText}

Options:
${options.map(opt => `${opt.letter}. ${opt.text}`).join('\n')}

Please determine the correct answer based on current, modern technology standards and practices.

Only respond with the letter of the correct option (A or B).
`;

      const response = await generateContent(prompt);

      if (response && response.text) {
        const letterMatch = response.text.match(/\b([A-B])\b/i);
        if (letterMatch) {
          const correctLetter = letterMatch[1].toUpperCase();
          const correctOption = question.options.find(opt =>
            opt.letter && opt.letter.toUpperCase() === correctLetter
          );
          if (correctOption) {
            correctAnswer = correctOption.text;
            console.log(`AI determined correct answer for true/false question ${question._id}: ${correctLetter} (${correctAnswer})`);
            
            // Update the question's correct answer in the database
            const Question = require('../models/Question');
            try {
              const updatedOptions = question.options.map((opt, index) => {
                if (!opt.letter) {
                  opt.letter = String.fromCharCode(65 + index);
                }
                if (!opt.value) {
                  opt.value = opt.letter.toLowerCase();
                }
                opt.isCorrect = (opt.letter && opt.letter.toUpperCase() === correctLetter);
                return opt;
              });

              await Question.findByIdAndUpdate(
                question._id,
                {
                  $set: {
                    options: updatedOptions,
                    correctAnswer: correctOption.text
                  }
                },
                { new: true }
              );
              console.log(`Updated true/false question ${question._id} with AI-determined correct answer`);
            } catch (updateError) {
              console.error(`Error updating true/false question in database: ${updateError.message}`);
            }
          }
        }
      }
    } catch (aiError) {
      console.error(`Error using AI to determine correct answer for true/false: ${aiError.message}`);
      // Fall back to modelAnswer if AI fails
    }
  }

  if (!studentAnswer) {
    return {
      score: 0,
      feedback: 'No answer provided',
      correctedAnswer: modelAnswer,
      gradingMethod: 'no_answer'
    };
  }

  // Check for meaningless answers like "I don't know", "no idea", etc.
  const meaninglessPatterns = [
    /^(i\s+don'?t\s+know|dont\s+know|no\s+idea|i\s+have\s+no\s+idea|not\s+sure|unsure|i\s+don'?t\s+understand|dont\s+understand)$/i,
    /^(i\s+do\s+not\s+know|i\s+do\s+not\s+understand|i\s+have\s+no\s+clue|no\s+clue)$/i,
    /^(skip|pass|n\/a|none|nothing|answer|question)$/i,
    /^(please\s+help|help\s+me|idk)$/i
  ];

  for (const pattern of meaninglessPatterns) {
    if (pattern.test(studentAnswer)) {
      console.log(`Detected meaningless answer in short answer grading: "${studentAnswer}"`);
      return {
        score: 0,
        feedback: 'Your answer indicates you do not know the answer. Please review the material and provide a proper response.',
        correctedAnswer: modelAnswer,
        gradingMethod: 'meaningless_answer_short'
      };
    }
  }

  // Quick exact match
  if (studentAnswer === correctAnswer) {
    return {
      score: question.points,
      feedback: 'Correct!',
      correctedAnswer: modelAnswer,
      gradingMethod: 'ai_determined_correct',
      isCorrect: true
    };
  }

  // Quick similarity check
  const similarity = calculateSimilarity(studentAnswer, correctAnswer);
  let score = similarity > 0.8 ? question.points :
                similarity > 0.6 ? Math.round(question.points * 0.8) :
                similarity > 0.4 ? Math.round(question.points * 0.5) : 0;

  let isCorrect = score >= question.points;
  let feedback = score === question.points ? 'Correct!' :
                   score > 0 ? 'Partially correct' :
                   'Incorrect';

  // Run AI verification for true/false questions (fast path)
  if (question.type === 'true-false') {
    try {
      const verification = await verifyGradingWithAI(
        question,
        answer.textAnswer || answer.selectedOption,
        modelAnswer,
        isCorrect,
        1500 // 1.5 second timeout
      );

      // If AI verification disagrees with high confidence, adjust grading
      if (!verification.verified && verification.confidence > 0.85) {
        if (verification.recommendation === 'change_to_correct' && !isCorrect) {
          console.log(`🔄 Fast AI verification corrected TF grading: INCORRECT -> CORRECT`);
          score = question.points;
          isCorrect = true;
          feedback = 'Correct! (verified by AI)';
        } else if (verification.recommendation === 'change_to_incorrect' && isCorrect) {
          console.log(`🔄 Fast AI verification corrected TF grading: CORRECT -> INCORRECT`);
          score = 0;
          isCorrect = false;
          feedback = `Incorrect. The correct answer is: ${modelAnswer}`;
        }
      }

      return {
        score,
        feedback,
        correctedAnswer: modelAnswer,
        gradingMethod: 'ai_determined_correct',
        isCorrect,
        aiVerification: verification
      };
    } catch (verifyError) {
      // Return original grading if verification fails
      return {
        score,
        feedback,
        correctedAnswer: modelAnswer,
        gradingMethod: 'ai_determined_correct',
        isCorrect,
        aiVerification: { verified: false, error: verifyError.message }
      };
    }
  }

  return {
    score,
    feedback,
    correctedAnswer: modelAnswer,
    gradingMethod: 'ai_determined_correct',
    isCorrect
  };
}

/**
 * Fast keyword-based grading fallback with enhanced feedback
 */
async function gradeWithKeywordsFast(studentAnswer, modelAnswer, maxPoints, questionText = '') {
  const student = studentAnswer.toLowerCase();
  const model = (modelAnswer || '').toLowerCase();

  // Check for multi-part questions if question text provided
  let multiPartInfo, multiPartValidation;
  if (questionText) {
    multiPartInfo = detectMultiPartQuestionFast(questionText);
    multiPartValidation = validateMultiPartAnswerFast(studentAnswer, multiPartInfo);

    if (multiPartInfo.isMultiPart && multiPartValidation.completeness < 0.25) {
      return {
        score: 0,
        feedback: `Incomplete answer. You only addressed ${multiPartValidation.partsFound} of ${multiPartInfo.expectedParts} required parts.`,
        correctedAnswer: modelAnswer,
        gradingMethod: 'incomplete_multipart_fallback'
      };
    }
  }

  // Check for meaningless answers like "I don't know", "no idea", etc.
  const meaninglessPatterns = [
    /^(i\s+don'?t\s+know|dont\s+know|no\s+idea|i\s+have\s+no\s+idea|not\s+sure|unsure|i\s+don'?t\s+understand|dont\s+understand)$/i,
    /^(i\s+do\s+not\s+know|i\s+do\s+not\s+understand|i\s+have\s+no\s+clue|no\s+clue)$/i,
    /^(skip|pass|n\/a|none|nothing|answer|question)$/i,
    /^(please\s+help|help\s+me|idk)$/i
  ];

  for (const pattern of meaninglessPatterns) {
    if (pattern.test(student)) {
      console.log(`Detected meaningless answer in keyword fallback: "${studentAnswer}"`);
      return {
        score: 0,
        feedback: 'Your answer indicates you do not know the answer. Please review the material and provide a proper response.',
        correctedAnswer: modelAnswer || 'Model answer not available',
        gradingMethod: 'meaningless_answer_fallback'
      };
    }
  }

  if (!model) {
    // When no model answer is available, use AI to grade based on its own assessment
    try {
      const prompt = `You are an expert exam grader. Grade the following student answer to a question.

Question: [Question text not available in fast grading context]
Student Answer: ${studentAnswer}

Please grade this answer on a scale of 0 to ${maxPoints} points.

STRICT GRADING GUIDELINES (No Model Answer Available):
1. Evaluate the answer based on completeness, relevance, and demonstration of understanding
2. Award full points only if the answer is comprehensive and well-explained
3. Award partial credit (30-70%) only if the answer shows partial understanding
4. Award 0 points for answers that are incorrect, irrelevant, too brief, or show no understanding
5. Very short answers (under 10 characters) or irrelevant answers should receive 0 points
6. Mathematical expressions without explanation should receive 0 points
7. Answers like "I don't know", "no idea", "skip", etc. should receive 0 points
8. NO MINIMUM CREDIT - do not give automatic points for effort alone

Return JSON: {score,feedback,correctedAnswer}`;

      const response = await groqClient.generateContent(prompt, {
        model: 'smart',
        jsonMode: true,
        temperature: 0.2,
        maxTokens: 1024
      });

      const result = response.parsedContent || JSON.parse(response.text.replace(/```json\n?|\n?```/g, '').trim());
      const finalScore = Math.min(Math.max(0, result.score || 0), maxPoints);

      return {
        score: finalScore,
        feedback: result.feedback || 'AI graded answer without model answer',
        correctedAnswer: result.correctedAnswer || 'Model answer not available',
        gradingMethod: 'ai_no_model_answer'
      };
    } catch (error) {
      console.error('AI grading without model answer failed, using fallback:', error.message);
      // Fallback to conservative scoring
      const answerLength = studentAnswer.length;
      const hasExplanatoryText = /[a-zA-Z]{3,}/.test(studentAnswer) &&
                                 (studentAnswer.includes(' ') || studentAnswer.includes(','));
      const isJustMathOrNumbers = /^[\d\+\-\*\/\=\(\)\s\[\]MATH:]+$/.test(studentAnswer);

      if (answerLength < 10 || !hasExplanatoryText || isJustMathOrNumbers) {
        return {
          score: 0,
          feedback: 'Your answer is too brief or incomplete. Please provide a complete answer with proper explanation.',
          correctedAnswer: 'Model answer not available',
          gradingMethod: 'default_fallback_insufficient'
        };
      }

      return {
        score: Math.round(maxPoints * 0.3),
        feedback: 'Answer provided but cannot be fully evaluated due to missing model answer. Partial credit given for effort.',
        correctedAnswer: 'Model answer not available',
        gradingMethod: 'default_fallback'
      };
    }
  }

  // Enhanced numerical extraction for calculation questions
  const extractNumericalAnswer = (text) => {
    // Remove currency symbols and commas for better matching
    const cleaned = text.replace(/[$€£¥₹]/g, '').replace(/,/g, '');
    
    // Look for patterns including calculations
    const patterns = [
      /(?:=|:|is)\s*([\d,]+(?:\.\d+)?)/i,  // "= 600" or ": 600" or "is 600"
      /([\d,]+(?:\.\d+)?)\s*(?:$|answer|result)/i,  // "600" followed by end or answer/result
      /[\d,]+(?:\.\d+)?\s*[\*×]\s*[\d,]+(?:\.\d+)?\s*[=]\s*([\d,]+(?:\.\d+)?)/i, // Extract result from calculation: "400 * 1.5 = 600"
      /h\s*=\s*([\d,]+(?:\.\d+)?)/i,  // "h = 13"
    ];

    for (const pattern of patterns) {
      const match = cleaned.match(pattern);
      if (match) {
        return parseFloat(match[1].replace(/,/g, ''));
      }
    }

    // If no pattern matches, try to find the last number in the text
    const numbers = cleaned.match(/[\d,]+(?:\.\d+)?/g);
    if (numbers && numbers.length > 0) {
      return parseFloat(numbers[numbers.length - 1].replace(/,/g, ''));
    }

    return null;
  };

  const studentNumerical = extractNumericalAnswer(studentAnswer);
  const modelNumerical = extractNumericalAnswer(modelAnswer);

  // If both have numerical answers and they match, give full credit
  if (studentNumerical !== null && modelNumerical !== null && Math.abs(studentNumerical - modelNumerical) < 0.01) {
    return {
      score: maxPoints,
      feedback: `Correct! Your numerical answer (${studentNumerical}) matches the expected result (${modelNumerical}).`,
      correctedAnswer: modelAnswer,
      gradingMethod: 'numerical_match',
      isCorrect: true
    };
  }

  // Check for partial credit in numerical answers (correct method, wrong result)
  // If student shows calculation steps with numbers that are close to the model
  if (studentNumerical !== null && modelNumerical !== null) {
    const ratio = studentNumerical / modelNumerical;
    // If the ratio is between 0.5 and 2, they might have used correct method but made calculation error
    if (ratio >= 0.5 && ratio <= 2 && Math.abs(studentNumerical - modelNumerical) > 0.01) {
      const partialScore = Math.round(maxPoints * 0.5); // 50% for correct method
      return {
        score: partialScore,
        feedback: `You used the correct approach but got a different result. Your answer: ${studentNumerical}, Expected: ${modelNumerical}. Partial credit awarded for correct method.`,
        correctedAnswer: modelAnswer,
        gradingMethod: 'numerical_partial',
        isCorrect: false
      };
    }
  }

  // Extract keywords (3+ characters)
  const keywords = model.split(/\s+/).filter(word => word.length >= 3);
  const matches = keywords.filter(keyword => student.includes(keyword)).length;

  const matchRatio = keywords.length > 0 ? matches / keywords.length : 0;

  // Give 0 marks for very poor matches (less than 30%)
  if (matchRatio < 0.3) {
    return {
      score: 0,
      feedback: `Your answer includes only ${matches}/${keywords.length} key concepts. Please review the question and provide a more complete answer.`,
      correctedAnswer: modelAnswer,
      gradingMethod: 'keyword_matching_poor'
    };
  }

  let score = Math.round(matchRatio * maxPoints);

  // Apply multi-part scaling if applicable
  if (multiPartInfo && multiPartValidation && multiPartInfo.isMultiPart && multiPartValidation.completeness < 1.0) {
    score = applyMultiPartScaling(score, maxPoints, multiPartInfo, multiPartValidation);
  }

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
 * Fast matching question grading
 */
async function gradeMatchingFast(question, answer, modelAnswer) {
  const matchingAnswers = answer.matchingAnswers || [];

  console.log(`🔍 Matching grading debug:`);
  console.log(`- Student answers:`, JSON.stringify(matchingAnswers));
  console.log(`- Question matchingPairs:`, JSON.stringify(question.matchingPairs));
  console.log(`- Question leftItems:`, JSON.stringify(question.leftItems));
  console.log(`- Question rightItems:`, JSON.stringify(question.rightItems));

  // Handle both array format [{left, right}] and object format {0: 1, 1: 0}
  let studentPairs = [];
  if (Array.isArray(matchingAnswers)) {
    studentPairs = matchingAnswers;
  } else if (typeof matchingAnswers === 'object' && Object.keys(matchingAnswers).length > 0) {
    // Convert object format to array
    studentPairs = Object.entries(matchingAnswers).map(([left, right]) => ({
      left: parseInt(left),
      right: parseInt(right)
    }));
  }

  if (!studentPairs || studentPairs.length === 0) {
    return {
      score: 0,
      feedback: 'No matching answers provided',
      correctedAnswer: modelAnswer,
      gradingMethod: 'no_answer'
    };
  }

  // Get correct pairs from question
  const correctPairs = question.matchingPairs?.correctPairs || [];
  const leftItems = question.leftItems || question.matchingPairs?.leftColumn || [];
  const rightItems = question.rightItems || question.matchingPairs?.rightColumn || [];

  console.log(`- Correct pairs:`, JSON.stringify(correctPairs));
  console.log(`- Left items count:`, leftItems.length);
  console.log(`- Right items count:`, rightItems.length);
  console.log(`- Student pairs:`, JSON.stringify(studentPairs));

  let correctCount = 0;
  let totalPairs = Math.max(studentPairs.length, leftItems.length, rightItems.length);

  // Check each student match
  for (const studentPair of studentPairs) {
    if (!studentPair || studentPair.left === undefined || studentPair.right === undefined) continue;

    // Find if this match is correct (ignore _id field if present)
    const isCorrect = correctPairs.some(pair => 
      pair.left === studentPair.left && pair.right === studentPair.right
    );
    console.log(`- Pair left=${studentPair.left}, right=${studentPair.right} correct: ${isCorrect}`);

    if (isCorrect) correctCount++;
  }

  console.log(`- Total correct: ${correctCount}/${totalPairs}`);

  let score = Math.round((correctCount / totalPairs) * question.points);
  let isCorrect = score >= question.points;
  let feedback = score === question.points
    ? `All ${totalPairs} matches correct!`
    : `${correctCount}/${totalPairs} matches correct`;

  // Run AI verification for edge cases
  try {
    // Build a summary of the matching for verification
    const studentSummary = studentPairs.map(p => `${leftItems[p.left]}->${rightItems[p.right]}`).join(', ');
    const correctSummary = correctPairs.map(p => `${leftItems[p.left]}->${rightItems[p.right]}`).join(', ');

    const verification = await verifyGradingWithAI(
      question,
      `Student: ${studentSummary}`,
      `Correct: ${correctSummary}`,
      isCorrect,
      2000 // 2 second timeout
    );

    // If AI verification strongly disagrees, flag for review (but don't auto-change complex matching)
    if (!verification.verified && verification.confidence > 0.9) {
      console.log(`⚠️ AI verification flagged matching question ${question._id}: ${verification.reason}`);
      feedback += ` (AI verification: ${verification.reason})`;
    }

    return {
      score,
      feedback,
      correctedAnswer: modelAnswer,
      gradingMethod: 'matching_grading',
      isCorrect,
      aiVerification: verification
    };
  } catch (verifyError) {
    return {
      score,
      feedback,
      correctedAnswer: modelAnswer,
      gradingMethod: 'matching_grading',
      isCorrect,
      aiVerification: { verified: false, error: verifyError.message }
    };
  }
}

/**
 * Fast ordering question grading
 */
async function gradeOrderingFast(question, answer, modelAnswer) {
  const orderingAnswer = answer.orderingAnswer || [];

  if (!orderingAnswer || orderingAnswer.length === 0) {
    return {
      score: 0,
      feedback: 'No ordering answer provided',
      correctedAnswer: modelAnswer,
      gradingMethod: 'no_answer'
    };
  }

  const correctOrder = question.itemsToOrder?.correctOrder || [];
  const items = question.items || question.itemsToOrder?.items || [];

  let correctCount = 0;
  for (let i = 0; i < orderingAnswer.length; i++) {
    if (orderingAnswer[i] === correctOrder[i]) {
      correctCount++;
    }
  }

  let score = Math.round((correctCount / orderingAnswer.length) * question.points);
  let isCorrect = score >= question.points;
  let feedback = score === question.points
    ? 'All items in correct order!'
    : `${correctCount}/${orderingAnswer.length} items in correct order`;

  // Run AI verification for edge cases
  try {
    const studentSummary = orderingAnswer.map((idx, i) => `${i+1}:${items[idx]}`).join(', ');
    const correctSummary = correctOrder.map((idx, i) => `${i+1}:${items[idx]}`).join(', ');

    const verification = await verifyGradingWithAI(
      question,
      `Student order: ${studentSummary}`,
      `Correct order: ${correctSummary}`,
      isCorrect,
      2000
    );

    if (!verification.verified && verification.confidence > 0.9) {
      console.log(`⚠️ AI verification flagged ordering question ${question._id}: ${verification.reason}`);
      feedback += ` (AI verification: ${verification.reason})`;
    }

    return {
      score,
      feedback,
      correctedAnswer: modelAnswer,
      gradingMethod: 'ordering_grading',
      isCorrect,
      aiVerification: verification
    };
  } catch (verifyError) {
    return {
      score,
      feedback,
      correctedAnswer: modelAnswer,
      gradingMethod: 'ordering_grading',
      isCorrect,
      aiVerification: { verified: false, error: verifyError.message }
    };
  }
}

/**
 * Fast drag-drop question grading
 */
async function gradeDragDropFast(question, answer, modelAnswer) {
  const dragDropAnswers = answer.dragDropAnswers || {};

  if (!dragDropAnswers || Object.keys(dragDropAnswers).length === 0) {
    return {
      score: 0,
      feedback: 'No drag-drop answers provided',
      correctedAnswer: modelAnswer,
      gradingMethod: 'no_answer'
    };
  }

  const correctPlacements = question.dragDropData?.correctPlacements || [];
  let correctCount = 0;
  let totalPlacements = correctPlacements.length;

  // Check each placement
  for (const placement of correctPlacements) {
    const studentPlacement = dragDropAnswers[placement.item];
    if (studentPlacement === placement.zone) {
      correctCount++;
    }
  }

  let score = totalPlacements > 0 ? Math.round((correctCount / totalPlacements) * question.points) : 0;
  let isCorrect = score >= question.points;
  let feedback = score === question.points
    ? 'All items placed correctly!'
    : `${correctCount}/${totalPlacements} items placed correctly`;

  // Run AI verification for edge cases
  try {
    const studentSummary = Object.entries(dragDropAnswers).map(([item, zone]) => `${item}:${zone}`).join(', ');
    const correctSummary = correctPlacements.map(p => `${p.item}:${p.zone}`).join(', ');

    const verification = await verifyGradingWithAI(
      question,
      `Student placements: ${studentSummary}`,
      `Correct placements: ${correctSummary}`,
      isCorrect,
      2000
    );

    if (!verification.verified && verification.confidence > 0.9) {
      console.log(`⚠️ AI verification flagged drag-drop question ${question._id}: ${verification.reason}`);
      feedback += ` (AI verification: ${verification.reason})`;
    }

    return {
      score,
      feedback,
      correctedAnswer: modelAnswer,
      gradingMethod: 'drag_drop_grading',
      isCorrect,
      aiVerification: verification
    };
  } catch (verifyError) {
    return {
      score,
      feedback,
      correctedAnswer: modelAnswer,
      gradingMethod: 'drag_drop_grading',
      isCorrect,
      aiVerification: { verified: false, error: verifyError.message }
    };
  }
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
  const chunkSize = 5; // Increased from 2 to 5 for faster parallel processing

  // Process questions in chunks
  for (let i = 0; i < result.answers.length; i += chunkSize) {
    const chunk = result.answers.slice(i, i + chunkSize);

    // Process chunk in parallel
    const chunkPromises = chunk.map(async (answer, index) => {
      const actualIndex = i + index;
      const question = answer.question;

      console.log(`🔍 Checking answer ${actualIndex}:`, {
        questionId: question._id,
        hasTextAnswer: !!answer.textAnswer,
        hasSelectedOption: !!answer.selectedOption,
        hasMatchingAnswers: !!answer.matchingAnswers,
        hasOrderingAnswer: !!answer.orderingAnswer,
        hasSubQuestionAnswers: !!(answer.subQuestionAnswers && answer.subQuestionAnswers.length > 0),
        subQuestionAnswersCount: answer.subQuestionAnswers?.length || 0,
        isSelected: answer.isSelected
      });

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
                       answer.matchingAnswers || answer.orderingAnswer ||
                       (answer.subQuestionAnswers && answer.subQuestionAnswers.length > 0);

      if (!hasAnswer) {
        console.log(`⚠️ No answer detected for question ${actualIndex}`);
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
        let grading;

        // Handle sub-questions if present
        if (answer.subQuestionAnswers && answer.subQuestionAnswers.length > 0) {
          console.log(`📝 Grading question with ${answer.subQuestionAnswers.length} sub-questions`);
          // Grade sub-questions even if question.subQuestions doesn't exist
          grading = await gradeSubQuestionsFast(question, answer, question.correctAnswer);
        } else {
          grading = await gradeQuestionFast(question, answer, question.correctAnswer);
        }

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
        const maxPoints = grading.totalMaxPoints || result.answers[index].question.points || 1;
        const cappedScore = Math.min(Math.max(0, grading.score || 0), maxPoints);
        result.answers[index].score = cappedScore;
        result.answers[index].feedback = grading.feedback || 'No feedback';
        result.answers[index].isCorrect = grading.isCorrect !== undefined ? grading.isCorrect : (cappedScore >= maxPoints);
        result.answers[index].correctedAnswer = grading.correctedAnswer || result.answers[index].question.correctAnswer;
        result.answers[index].gradingMethod = grading.gradingMethod || 'enhanced_grading';

        // Store sub-question results if present
        if (grading.subQuestionResults) {
          result.answers[index].subQuestionResults = grading.subQuestionResults;
        }

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
      await new Promise(resolve => setTimeout(resolve, 100)); // Increased from 50 to 100ms for better stability
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
