// Import both grading methods - standard and chunked
const { gradeOpenEndedAnswer: standardGradeEssay } = require('./aiGrading');
const { gradeOpenEndedAnswer: chunkedGradeEssay } = require('./chunkedAiGrading');
const { gradeQuestionByType } = require('./enhancedGrading');
const { parseAnswerFile } = require('./fileParser');
const fs = require('fs');
const path = require('path');

/**
 * Normalize answer for flexible comparison
 * Handles spacing, capitalization, special characters, and pluralization
 * @param {string} answer - The answer to normalize
 * @returns {string} - Normalized answer
 */
function normalizeAnswer(answer) {
  if (!answer) return '';
  
  return String(answer)
    .toLowerCase()
    .trim()
    // Remove extra spaces between words
    .replace(/\s+/g, ' ')
    // Remove common separators like +, -, /, etc. (for keyboard shortcuts)
    .replace(/[+\-\/\\]/g, '')
    // Remove spaces around operators (e.g., "ctrl + z" -> "ctrlz")
    .replace(/\s*([+\-\/\\])\s*/g, '$1')
    // Remove trailing 's' for pluralization (e.g., "decolonizations" -> "decolonization")
    // Only remove if the word is longer than 3 characters to avoid removing 's' from short words
    .replace(/([a-z]{3,})s\b/g, '$1')
    .trim();
}

/**
 * Calculate the Levenshtein distance between two strings
 * Used for fuzzy matching in fill-in-the-blank questions
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {number} - The edit distance between the strings
 */
function levenshteinDistance(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = [];

  // Initialize the matrix
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Fill in the matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

// Use the chunked grading method by default to avoid rate limits
const gradeEssay = chunkedGradeEssay;
const Result = require('../models/Result');

/**
 * Helper function to convert correctAnswer to a string
 * Handles multi-part questions where correctAnswer might be an object
 * @param {any} correctAnswer - The correct answer (string or object)
 * @param {string} fallback - Fallback text if answer is empty
 * @returns {string} - String representation of the answer
 */
function formatCorrectAnswer(correctAnswer, fallback = 'Not provided') {
  if (!correctAnswer) {
    return fallback;
  }

  // If it's already a string, return it
  if (typeof correctAnswer === 'string') {
    return correctAnswer;
  }

  // If it's an object, check if it has subQuestions
  if (typeof correctAnswer === 'object') {
    // If it has subQuestions array, format them
    if (correctAnswer.subQuestions && Array.isArray(correctAnswer.subQuestions)) {
      return correctAnswer.subQuestions.map(sq => {
        const label = sq.label || sq.questionNumber || '';
        const text = sq.correctAnswer || sq.text || '';
        return label ? `${label}) ${text}` : text;
      }).join('\n');
    }

    // If the object has text property (matching pairs, etc.)
    if (correctAnswer.text) {
      return correctAnswer.text;
    }

    // For other objects, try to convert to a readable format
    // Check if keys are letters (a, b, c) - subquestion format
    const keys = Object.keys(correctAnswer);
    const hasLetterKeys = keys.some(k => /^[a-z]$/i.test(k));

    if (hasLetterKeys) {
      return keys.map(key => {
        const val = correctAnswer[key];
        if (typeof val === 'string') {
          return `${key}) ${val}`;
        }
        return `${key}) ${JSON.stringify(val)}`;
      }).join('\n');
    }

    // Last resort: stringify
    try {
      return JSON.stringify(correctAnswer);
    } catch (e) {
      return fallback;
    }
  }

  // For any other type, convert to string
  return String(correctAnswer);
}
const Question = require('../models/Question');
const Exam = require('../models/Exam');
const mongoose = require('mongoose');

/**
 * Helper function to ensure all options have letter properties (A, B, C, D)
 * @param {Array} options - Array of option objects
 * @returns {Array} - Array of options with letter properties
 */
const ensureOptionLetters = (options) => {
  if (!options || !Array.isArray(options)) return [];

  // First check if all options already have letters
  const allHaveLetters = options.every(opt => opt.letter && /^[A-D]$/i.test(opt.letter));
  if (allHaveLetters) return options;

  // If not, assign letters based on position
  return options.map((opt, index) => {
    if (!opt.letter || !/^[A-D]$/i.test(opt.letter)) {
      // Assign A, B, C, D based on index
      opt.letter = String.fromCharCode(65 + index); // 65 is ASCII for 'A'
    } else {
      // Ensure letter is uppercase
      opt.letter = opt.letter.toUpperCase();
    }
    return opt;
  });
};

/**
 * Grade sub-questions for a question
 * @param {Object} question - The parent question with subQuestions
 * @param {Object} answer - The student's answer object
 * @returns {Object} - Grading result with score and feedback
 */
const gradeSubQuestions = (question, answer) => {
  const subQuestions = question.subQuestions || [];
  const subQuestionAnswers = answer.subQuestionAnswers || [];
  const config = question.subQuestionConfig || { mode: 'all', requiredCount: 1, scoringType: 'partial' };
  const mode = config.mode || 'all';
  const requiredCount = config.requiredCount || 1;
  const scoringType = config.scoringType || 'partial';
  
  if (subQuestions.length === 0) {
    return { score: 0, feedback: 'No sub-questions found', isCorrect: false };
  }
  
  // Handle "choose-n" mode - student selects N sub-questions to answer
  if (mode === 'choose-n') {
    // Get selected sub-question indices
    const selectedIndices = answer.selectedSubQuestionIndices || 
                           (answer.selectedSubQuestionIndex !== undefined ? [answer.selectedSubQuestionIndex] : []);
    
    // Validate selection count
    if (selectedIndices.length === 0) {
      return { 
        score: 0, 
        feedback: `⚠️ No sub-questions were selected. You must choose ${requiredCount} question${requiredCount > 1 ? 's' : ''} to answer.`, 
        isCorrect: false,
        selectedCount: 0,
        requiredCount
      };
    }
    
    if (selectedIndices.length < requiredCount) {
      return { 
        score: 0, 
        feedback: `⚠️ You selected ${selectedIndices.length} question${selectedIndices.length > 1 ? 's' : ''} but must select ${requiredCount}.`, 
        isCorrect: false,
        selectedCount: selectedIndices.length,
        requiredCount
      };
    }
    
    if (selectedIndices.length > requiredCount) {
      return { 
        score: 0, 
        feedback: `⚠️ You selected ${selectedIndices.length} questions but can only answer ${requiredCount}. Please deselect ${selectedIndices.length - requiredCount}.`, 
        isCorrect: false,
        selectedCount: selectedIndices.length,
        requiredCount
      };
    }
    
    // Grade each selected sub-question independently
    let totalScore = 0;
    let maxPossibleScore = 0;
    let correctCount = 0;
    let feedbackParts = [];
    
    for (const idx of selectedIndices) {
      const subQ = subQuestions[idx];
      const subQAnswer = subQuestionAnswers[idx];
      const subQPoints = subQ.points || Math.round((question.points || 1) / requiredCount);
      maxPossibleScore += subQPoints;
      
      if (!subQ) {
        feedbackParts.push(`⚠️ Invalid selection at index ${idx}`);
        continue;
      }
      
      if (!subQAnswer || !subQAnswer.answered) {
        feedbackParts.push(`${subQ.label || 'Option ' + String.fromCharCode(65 + idx)}: Not answered (0/${subQPoints})`);
        continue;
      }
      
      const subQType = subQ.type || 'open-ended';
      let isSubCorrect = false;
      let subQScore = 0;
      
      if (subQType === 'multiple-choice' || subQType === 'true-false') {
        // Check both selectedOption and textAnswer as answer may be stored in either field
        const studentAnswer = subQAnswer.selectedOption || subQAnswer.textAnswer || '';
        const correctAnswer = subQ.correctAnswer;
        const selectedOptionObj = subQ.options?.find(opt =>
          opt.text === studentAnswer || opt.letter === studentAnswer
        );

        isSubCorrect = selectedOptionObj?.isCorrect ||
                      studentAnswer === correctAnswer ||
                      selectedOptionObj?.letter === correctAnswer;

        // Award points for this sub-question if correct
        subQScore = isSubCorrect ? subQPoints : 0;
      } else {
        // For open-ended, check if there's an answer (AI will grade later)
        const hasAnswer = subQAnswer.textAnswer && subQAnswer.textAnswer.trim().length > 0;
        if (hasAnswer) {
          // For open-ended, give full points for now (AI will adjust later)
          isSubCorrect = true;
          subQScore = subQPoints;
        }
      }
      
      totalScore += subQScore;
      
      if (isSubCorrect) {
        correctCount++;
        feedbackParts.push(`${subQ.label || 'Option ' + String.fromCharCode(65 + idx)}: ✅ Correct (+${subQScore} marks)`);
      } else {
        feedbackParts.push(`${subQ.label || 'Option ' + String.fromCharCode(65 + idx)}: ❌ Incorrect (0/${subQPoints})`);
      }
    }
    
    // Calculate final score based on scoring type
    const questionPoints = question.points || maxPossibleScore;
    let score = 0;
    let isCorrect = false;
    
    if (scoringType === 'all-or-nothing') {
      // Must get all selected questions correct for any points
      score = (correctCount === requiredCount) ? questionPoints : 0;
      isCorrect = correctCount === requiredCount;
    } else {
      // Award the sum of correct sub-question points (default behavior)
      score = totalScore;
      isCorrect = correctCount > 0;
    }
    
    let feedback = `Selected ${requiredCount} question${requiredCount > 1 ? 's' : ''}:\n${feedbackParts.join('\n')}\n\nTotal: ${score}/${maxPossibleScore} marks`;
    if (scoringType === 'all-or-nothing' && correctCount < requiredCount) {
      feedback = `Selected ${requiredCount} question${requiredCount > 1 ? 's' : ''}:\n${feedbackParts.join('\n')}\n\n⚠️ All-or-nothing scoring: You needed all ${requiredCount} correct for ${questionPoints} marks. Score: 0/${questionPoints}`;
    }
    
    return {
      score,
      feedback,
      isCorrect,
      mode: 'choose-n',
      requiredCount,
      selectedCount: selectedIndices.length,
      correctCount,
      scoringType
    };
  }
  
  // Handle "all" mode - student must answer all sub-questions
  let totalScore = 0;
  let maxPossibleScore = 0;
  let feedbackParts = [];
  let allAnswered = true;
  
  for (let i = 0; i < subQuestions.length; i++) {
    const subQ = subQuestions[i];
    const subQAnswer = subQuestionAnswers[i];
    const subQPoints = subQ.points || 1;
    maxPossibleScore += subQPoints;
    
    if (!subQAnswer || !subQAnswer.answered) {
      allAnswered = false;
      feedbackParts.push(`${subQ.label || 'Part ' + (i + 1)}: Not answered`);
      continue;
    }
    
    const subQType = subQ.type || 'open-ended';
    let subQScore = 0;
    
    if (subQType === 'multiple-choice' || subQType === 'true-false') {
      // Check both selectedOption and textAnswer as answer may be stored in either field
      const studentAnswer = subQAnswer.selectedOption || subQAnswer.textAnswer || '';
      const correctAnswer = subQ.correctAnswer;
      const selectedOptionObj = subQ.options?.find(opt =>
        opt.text === studentAnswer || opt.letter === studentAnswer
      );

      const isSubCorrect = selectedOptionObj?.isCorrect ||
                          studentAnswer === correctAnswer ||
                          selectedOptionObj?.letter === correctAnswer;

      subQScore = isSubCorrect ? subQPoints : 0;
      feedbackParts.push(`${subQ.label || 'Part ' + (i + 1)}: ${isSubCorrect ? '✅' : '❌'} (${subQScore}/${subQPoints})`);
    } else {
      // Open-ended - check if answered, AI will grade later
      const hasAnswer = subQAnswer.textAnswer && subQAnswer.textAnswer.trim().length > 0;
      subQScore = hasAnswer ? subQPoints : 0;
      feedbackParts.push(`${subQ.label || 'Part ' + (i + 1)}: ${hasAnswer ? '✅ Answered' : '❌ Not answered'} (${subQScore}/${subQPoints})`);
    }
    
    totalScore += subQScore;
  }
  
  const questionPoints = question.points || maxPossibleScore;
  const score = totalScore;
  const isCorrect = score >= questionPoints * 0.7; // 70% threshold
  
  let feedback = `Sub-question scores:\n${feedbackParts.join('\n')}`;
  if (!allAnswered) {
    feedback += '\n\n⚠️ Some sub-questions were not answered.';
  }
  
  return {
    score,
    feedback,
    isCorrect,
    mode: 'all',
    totalSubQuestions: subQuestions.length,
    answeredSubQuestions: feedbackParts.filter(f => f.includes('✅')).length
  };
};

/**
 * Extract question number from question text
 * @param {string} questionText - The text of the question
 * @param {number} index - The index of the question in the array (fallback)
 * @returns {number} - The extracted question number
 */
const extractQuestionNumber = (questionText, index) => {
  if (!questionText) return index + 1;

  // Try different patterns to extract the question number

  // Pattern 1: Question starts with a number followed by a period or parenthesis
  const startPattern = questionText.match(/^(\d+)[\.\)]/);
  if (startPattern) {
    return parseInt(startPattern[1]);
  }

  // Pattern 2: Question contains "Question X" or "Q X" pattern
  const questionPattern = questionText.match(/Question\s*(\d+)|Q\.?\s*(\d+)/i);
  if (questionPattern) {
    return parseInt(questionPattern[1] || questionPattern[2]);
  }

  // Pattern 3: First number in the question
  const firstNumberPattern = questionText.match(/\b(\d+)\b/);
  if (firstNumberPattern) {
    return parseInt(firstNumberPattern[1]);
  }

  // Fallback: Use the index + 1
  return index + 1;
};

/**
 * Grade an exam result using AI
 * @param {string} resultId - The ID of the result to grade
 * @returns {Promise<object>} - Grading result
 */
const gradeExamWithAI = async (resultId) => {
  try {
    console.log(`Starting AI grading for exam result ${resultId}`);

    // Find the result and populate necessary data
    const result = await Result.findById(resultId)
      .populate({
        path: 'exam',
        select: 'title description timeLimit sections originalFile answerFile'
      })
      .populate({
        path: 'answers.question',
        model: 'Question',
        select: 'text type options points correctAnswer'
      });

    if (!result) {
      throw new Error(`Result ${resultId} not found`);
    }

    console.log(`Found result with ${result.answers.length} answers to grade`);

    // We're not using answer files anymore - using AI to determine correct answers
    console.log(`Using AI to determine correct answers for exam: ${result.exam?._id || 'unknown'}`);

    // Track total score
    let totalScore = 0;

    // Helper function to add delay between API calls (OPTIMIZED: Reduced delays)
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // Cache for AI-determined correct answers to avoid redundant API calls
    const aiAnswerCache = new Map();

    // OPTIMIZED: Pre-determine correct answers for all MC/TF questions using AI in batch
    // This runs AI checks FIRST, reducing redundant calls during grading
    const determineCorrectAnswersWithAI = async (questions) => {
      const { generateContent } = require('./aiService');
      const answersMap = new Map();

      for (const q of questions) {
        if (!q || !q.text || !q.options || q.options.length < 2) continue;

        const cacheKey = q._id.toString();
        if (aiAnswerCache.has(cacheKey)) {
          continue; // Already determined
        }

        try {
          const options = q.options.map(opt => ({
            letter: opt.letter || '',
            text: opt.text || ''
          }));

          const prompt = `
You are an expert grader. Determine the correct answer for this multiple choice question:
Question: ${q.text}
Options:
${options.map(opt => `${opt.letter}. ${opt.text}`).join('\n')}

Only respond with the letter (A, B, C, or D). No explanation.`;

          const response = await generateContent(prompt);
          if (response && response.text) {
            const letterMatch = response.text.match(/\b([A-D])\b/i);
            if (letterMatch) {
              const correctLetter = letterMatch[1].toUpperCase();
              aiAnswerCache.set(cacheKey, correctLetter);
              console.log(`✅ AI determined correct answer for question ${cacheKey}: ${correctLetter}`);
            }
          }
        } catch (error) {
          console.log(`⚠️ Could not determine answer for question ${cacheKey}, will use fallback`);
        }
      }
      return aiAnswerCache;
    };

    // Group answers by question type for batch processing
    const multipleChoiceAnswers = [];
    const trueFalseAnswers = [];
    const fillInBlankAnswers = [];
    const openEndedAnswers = [];

    // Organize answers by type
    for (let i = 0; i < result.answers.length; i++) {
      const answer = result.answers[i];
      const question = answer.question;

      if (!question) {
        console.log(`Warning: Answer at index ${i} has no associated question. Skipping.`);
        continue;
      }

      // Store the index for later reference
      const answerWithIndex = { answer, question, index: i };

      // Check if question has subQuestions that need special handling
      if (question.subQuestions && question.subQuestions.length > 0) {
        // Questions with subQuestions are handled separately
        console.log(`Question ${i} has ${question.subQuestions.length} subQuestions - will be processed separately`);
        // Still categorize by type for batch processing, but mark as having subQuestions
        answerWithIndex.hasSubQuestions = true;
      }

      if (question.type === 'multiple-choice') {
        multipleChoiceAnswers.push(answerWithIndex);
      } else if (question.type === 'true-false') {
        trueFalseAnswers.push(answerWithIndex);
      } else if (question.type === 'fill-in-blank') {
        fillInBlankAnswers.push(answerWithIndex);
      } else if (question.type === 'open-ended' || question.type === 'image' || question.type === 'image-based' || question.type === 'structured') {
        openEndedAnswers.push(answerWithIndex);
      }
    }

    console.log(`Grouped answers by type: ${multipleChoiceAnswers.length} multiple choice, ${trueFalseAnswers.length} true/false, ${fillInBlankAnswers.length} fill-in-blank, ${openEndedAnswers.length} open-ended`);

    // OPTIMIZED: Pre-determine correct answers for MC/TF questions FIRST
    // This reduces redundant AI calls during grading
    const mcQuestions = multipleChoiceAnswers.map(a => a.question);
    const tfQuestions = trueFalseAnswers.map(a => a.question);
    console.log(`🚀 Pre-determining correct answers for ${mcQuestions.length + tfQuestions.length} questions using AI...`);
    await determineCorrectAnswersWithAI([...mcQuestions, ...tfQuestions]);
    console.log(`✅ AI answer cache populated with ${aiAnswerCache.size} answers`);

    // Process answers in batches by type for better performance
    // Process multiple choice and true/false first (faster to grade)
    const allAnswersToProcess = [
      ...multipleChoiceAnswers,
      ...trueFalseAnswers,
      ...fillInBlankAnswers,
      ...openEndedAnswers
    ];

    // Process each answer
    for (let j = 0; j < allAnswersToProcess.length; j++) {
      const { answer, question, index: i } = allAnswersToProcess[j];

      // Check if this question has subQuestions that need special grading
      if (question.subQuestions && question.subQuestions.length > 0) {
        console.log(`Question ${i} has ${question.subQuestions.length} subQuestions - using sub-question grading`);

        const subQGrading = gradeSubQuestions(question, answer);

        // Update the answer with sub-question grading results
        result.answers[i].score = subQGrading.score;
        result.answers[i].feedback = subQGrading.feedback;
        result.answers[i].isCorrect = subQGrading.isCorrect;
        result.answers[i].correctedAnswer = formatCorrectAnswer(question.correctAnswer);
        result.answers[i].gradingMethod = `subquestion_${subQGrading.mode}`;

        if (subQGrading.mode === 'choose-n') {
          result.answers[i].selectedSubQuestionIndices = subQGrading.selectedSubQuestionIndices;
          result.answers[i].requiredCount = subQGrading.requiredCount;
          result.answers[i].correctCount = subQGrading.correctCount;
          result.answers[i].scoringType = subQGrading.scoringType;
        }

        // Add to total score
        totalScore += subQGrading.score;

        console.log(`Sub-question grading completed for question ${i}: score=${subQGrading.score}/${question.points}, mode=${subQGrading.mode}`);
        continue; // Skip regular grading for this question
      }

      // OPTIMIZED: Reduced delays - only add minimal delay for open-ended questions which need AI grading
      if (j > 0 && (question.type === 'open-ended' || question.type === 'image' || question.type === 'image-based' || question.type === 'structured')) {
        // Only delay for AI-intensive questions, and reduce the delay significantly
        const isNewQuestionType = j > 0 &&
          allAnswersToProcess[j].question.type !== allAnswersToProcess[j-1].question.type;

        if (isNewQuestionType) {
          console.log(`Switching to new question type. Adding minimal delay...`);
          await delay(200); // Reduced from 1000ms to 200ms
        } else {
          console.log(`Adding minimal delay before grading next question...`);
          await delay(100); // Reduced from 500ms to 100ms
        }
      }

      // Handle multiple-choice, true-false, and fill-in-blank questions
      if (question.type === 'multiple-choice' || question.type === 'true-false') {
        // Verify that multiple choice and true/false questions are graded correctly
        // Check both selectedOption and textAnswer as answer may be stored in either field
        const hasAnswer = answer.selectedOption || answer.textAnswer;
        if (hasAnswer) {
          // Get the question number from the question text or use the index
          const questionNumber = extractQuestionNumber(question.text, i);

          console.log(`Processing ${question.type} question ${questionNumber}: "${question.text.substring(0, 50)}..."`);

          // Ensure all options have letter properties
          if (question.options && Array.isArray(question.options)) {
            question.options = ensureOptionLetters(question.options);
          }

          // Variables to track correctness
          let isCorrect = false;
          let correctOptionText = '';
          let correctOptionLetter = '';
          let selectedOptionText = ''; // Will store student's answer for logging

          // OPTIMIZED: Use cached AI-determined answer instead of calling AI again
          console.log(`Using cached AI-determined answer for question ${questionNumber}`);

          // Get the question text and options
          const questionText = question.text;
          const options = question.options.map(opt => ({
            letter: opt.letter || '',
            text: opt.text || ''
          }));

          // Prepare to use AI to determine the correct answer
          let correctLetter = '';

          // OPTIMIZED: Check cache first to avoid redundant AI calls
          const cacheKey = question._id.toString();
          if (aiAnswerCache.has(cacheKey)) {
            correctLetter = aiAnswerCache.get(cacheKey);
            console.log(`✅ Using cached AI answer for question ${questionNumber}: ${correctLetter}`);
          } else {
            // Fallback: Use AI if not in cache (shouldn't happen with pre-determination)
            console.log(`⚠️ Cache miss for question ${questionNumber}, using AI fallback`);

            try {
              // Use the Gemini AI to determine the correct answer
              const { generateContent } = require('./aiService');

              // Create a prompt for the AI
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

              // Generate content with the AI
              const response = await generateContent(prompt);

              // Extract the letter from the response
              if (response && response.text) {
                // Look for a single letter A, B, C, or D in the response
                const letterMatch = response.text.match(/\b([A-D])\b/i);
                if (letterMatch) {
                  correctLetter = letterMatch[1].toUpperCase();
                  console.log(`AI determined correct answer for question ${questionNumber}: ${correctLetter}`);
                  // Cache the result
                  aiAnswerCache.set(cacheKey, correctLetter);
                } else {
                  // If no clear letter, try to find any A, B, C, or D in the response
                  const anyLetterMatch = response.text.match(/([A-D])/i);
                  if (anyLetterMatch) {
                    correctLetter = anyLetterMatch[1].toUpperCase();
                    console.log(`AI determined correct answer (fallback) for question ${questionNumber}: ${correctLetter}`);
                    aiAnswerCache.set(cacheKey, correctLetter);
                  } else {
                    console.log(`AI could not determine a clear answer. Response: ${response.text}`);
                    // Default to option A if AI fails
                    correctLetter = 'A';
                  }
                }
              } else {
                console.log(`No response from AI for question ${questionNumber}`);
                // Default to option A if AI fails
                correctLetter = 'A';
              }
            } catch (aiError) {
              console.error(`Error using AI to determine correct answer: ${aiError.message}`);
              // Default to option A if AI fails
              correctLetter = 'A';
            }
          }

          console.log(`Final determined correct answer for question ${questionNumber}: ${correctLetter}`);

          // Process the AI-determined answer
          if (correctLetter) {
            // Find the option with this letter
            const correctOption = question.options.find(opt =>
              opt.letter && opt.letter.toUpperCase() === correctLetter
            );

            if (correctOption) {
              // Mark this option as correct in memory
              question.options.forEach(opt => {
                opt.isCorrect = (opt.letter && opt.letter.toUpperCase() === correctLetter);
              });

              // Set the correct answer text
              correctOptionText = correctOption.text;
              correctOptionLetter = correctLetter;

              // Update the question's correct answer in the database
              try {
                // First update all options to ensure they have letter and value fields
                const updatedOptions = question.options.map((opt, index) => {
                  // If the option doesn't have a letter, assign one based on index
                  if (!opt.letter) {
                    opt.letter = String.fromCharCode(65 + index); // A, B, C, D...
                  }
                  // If the option doesn't have a value, assign one based on letter
                  if (!opt.value) {
                    opt.value = opt.letter.toLowerCase();
                  }
                  // Set isCorrect based on the letter
                  opt.isCorrect = (opt.letter && opt.letter.toUpperCase() === correctLetter);
                  return opt;
                });

                // Update the question with the correct options
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

                console.log(`Updated question ${question._id} with correct answer: ${correctOption.text} (${correctLetter})`);
              } catch (updateError) {
                console.error(`Error updating question in database: ${updateError.message}`);
              }

              // Find the selected option letter
              let selectedLetter = '';
              let selectedOptionText = answer.selectedOption || answer.textAnswer || '';

              // Log the selected option for debugging
              console.log(`Student selected option: "${selectedOptionText}"`);

              if (selectedOptionText) {
                // First check if the selectedOption is already just a letter
                if (selectedOptionText.match(/^[A-D]$/i)) {
                  selectedLetter = selectedOptionText.toUpperCase();
                  console.log(`Detected letter format: ${selectedLetter}`);
                }
                // If the selected option starts with a letter followed by a period or parenthesis
                else if (selectedOptionText.match(/^([A-D])[\.\)]/i)) {
                  const letterMatch = selectedOptionText.match(/^([A-D])[\.\)]/i);
                  selectedLetter = letterMatch[1].toUpperCase();
                  console.log(`Detected letter with punctuation: ${selectedLetter}`);
                }
                // Check if the option contains a letter in parentheses or with a period
                else if (selectedOptionText.match(/\(([A-D])\)|\s([A-D])\./i)) {
                  const letterMatch = selectedOptionText.match(/\(([A-D])\)|\s([A-D])\./i);
                  selectedLetter = (letterMatch[1] || letterMatch[2]).toUpperCase();
                  console.log(`Detected embedded letter: ${selectedLetter}`);
                }
                // Try to find the matching option in the question options
                else {
                  console.log(`Trying to match selected text with options`);

                  // First try to find an exact match
                  let selectedOption = question.options.find(opt =>
                    opt.text === selectedOptionText
                  );

                  // If no exact match, try case-insensitive match
                  if (!selectedOption) {
                    selectedOption = question.options.find(opt =>
                      opt.text.toLowerCase() === selectedOptionText.toLowerCase()
                    );
                  }

                  // If still no match, try partial matches
                  if (!selectedOption) {
                    // Try to find the option that best matches the selected text
                    let bestMatch = null;
                    let bestMatchScore = 0;

                    for (const opt of question.options) {
                      // Check if the option text contains the selected text or vice versa
                      if (opt.text.includes(selectedOptionText) || selectedOptionText.includes(opt.text)) {
                        // Calculate a simple match score based on the length of the common substring
                        const matchScore = Math.min(opt.text.length, selectedOptionText.length);
                        if (matchScore > bestMatchScore) {
                          bestMatchScore = matchScore;
                          bestMatch = opt;
                        }
                      }
                    }

                    selectedOption = bestMatch;
                  }

                  if (selectedOption && selectedOption.letter) {
                    selectedLetter = selectedOption.letter.toUpperCase();
                    console.log(`Matched with option ${selectedLetter}: "${selectedOption.text}"`);
                  } else {
                    console.log(`Could not match selected text with any option`);

                    // As a last resort, try to match the selected text directly with the correct option
                    if (correctOption &&
                        (selectedOptionText.includes(correctOption.text) ||
                         correctOption.text.includes(selectedOptionText))) {
                      console.log(`Direct match with correct option text`);
                      selectedLetter = correctLetter;
                    }
                  }
                }
              }

              // If we have the selectedOptionLetter from the database, use that
              if (answer.selectedOptionLetter) {
                selectedLetter = answer.selectedOptionLetter.toUpperCase();
                console.log(`Using stored selectedOptionLetter: ${selectedLetter}`);
              }

              // Check if the selected letter matches the correct letter
              isCorrect = selectedLetter && selectedLetter === correctLetter;

              // Store the selected letter for future reference
              result.answers[i].selectedOptionLetter = selectedLetter;
            } else {
              console.log(`Could not find option with letter ${correctLetter} for question ${questionNumber}`);
              console.log(`Available options: ${question.options.map(o => o.letter).join(', ')}`);
              console.log(`AI determined correct answer: ${correctLetter}`);
              
              // Try to match by text content as fallback
              if (correctOption && selectedOptionText) {
                const isTextMatch = selectedOptionText.includes(correctOption.text) || 
                                   correctOption.text.includes(selectedOptionText);
                if (isTextMatch) {
                  console.log(`Fallback: Text content match found`);
                  isCorrect = true;
                  correctOptionText = correctOption.text;
                  correctOptionLetter = correctLetter;
                } else {
                  isCorrect = false;
                  correctOptionText = `Option ${correctLetter}`;
                  correctOptionLetter = correctLetter;
                }
              } else {
                isCorrect = false;
                correctOptionText = `Option ${correctLetter}`;
                correctOptionLetter = correctLetter;
              }
            }
          }

          // Update the answer with correct grading
          result.answers[i].isCorrect = isCorrect;
          result.answers[i].score = isCorrect ? question.points : 0;

          // Store the correct answer for display in results
          result.answers[i].correctedAnswer = correctOptionText;
          if (correctOptionLetter) {
            result.answers[i].correctOptionLetter = correctOptionLetter;
          }

          // Add to total score if correct
          if (isCorrect) {
            totalScore += question.points;
          }

          console.log(`Verified multiple choice answer for question ${question._id}:`);
          console.log(`- Selected option: ${answer.selectedOption}`);
          console.log(`- Correct option: ${correctOptionText}`);
          console.log(`- Is correct: ${isCorrect}`);
        }
        continue;
      }

      // Handle fill-in-the-blank questions
      else if (question.type === 'fill-in-blank') {
        // Get the question number from the question text or use the index
        const questionNumber = extractQuestionNumber(question.text, i);

        console.log(`Processing fill-in-blank question ${questionNumber}: "${question.text.substring(0, 50)}..."`);

        if (answer.textAnswer && answer.textAnswer.trim()) {
          const studentAnswer = answer.textAnswer.trim();
          const correctAnswer = question.correctAnswer ? question.correctAnswer.trim() : '';

          console.log(`  Student answer: "${studentAnswer}"`);
          console.log(`  Correct answer: "${correctAnswer}"`);

          // Enhanced numerical extraction function for calculation questions
          const extractNumericalValue = (text) => {
            // Remove currency symbols and extract numbers
            const cleaned = text.replace(/[$€£¥₹]/g, '').replace(/,/g, '');
            
            // Look for patterns like "= 600", "answer: 600", "result is 600", etc.
            const patterns = [
              /(?:=|:|is)\s*([\d,]+(?:\.\d+)?)/i,
              /([\d,]+(?:\.\d+)?)\s*(?:$|answer|result)/i,
              /[\d,]+(?:\.\d+)?\s*[\*×]\s*[\d,]+(?:\.\d+)?\s*[=]\s*([\d,]+(?:\.\d+)?)/i, // Extract result from calculation
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

          // Extract numerical values for comparison
          const studentNumerical = extractNumericalValue(studentAnswer);
          const correctNumerical = extractNumericalValue(correctAnswer);

          console.log(`  Student numerical: ${studentNumerical}`);
          console.log(`  Correct numerical: ${correctNumerical}`);

          // Check if the student's answer matches the correct answer
          // Use flexible normalization for spacing, capitalization, and special characters
          const studentNormalized = normalizeAnswer(studentAnswer);
          const correctNormalized = normalizeAnswer(correctAnswer);
          
          console.log(`  Student normalized: "${studentNormalized}"`);
          console.log(`  Correct normalized: "${correctNormalized}"`);
          
          const isExactMatch = studentNormalized === correctNormalized;
          const isCloseMatch = correctAnswer && (
            studentNormalized.includes(correctNormalized) ||
            correctNormalized.includes(studentNormalized) ||
            levenshteinDistance(studentNormalized, correctNormalized) <= 2 // Allow for small typos
          );

          // Check for numerical match (with tolerance for floating point)
          const isNumericalMatch = studentNumerical !== null && correctNumerical !== null && 
                                   Math.abs(studentNumerical - correctNumerical) < 0.01;

          if (isExactMatch) {
            // Exact match - full points
            answer.score = question.points || 1;
            answer.feedback = "Correct! Your answer matches exactly.";
            answer.isCorrect = true;
            console.log(`  Answer is CORRECT (exact match)`);
          } else if (isNumericalMatch) {
            // Numerical match - full points (student got the right number even if format differs)
            answer.score = question.points || 1;
            answer.feedback = `Correct! Your numerical answer (${studentNumerical}) matches the expected result (${correctNumerical}).`;
            answer.isCorrect = true;
            console.log(`  Answer is CORRECT (numerical match)`);
          } else if (isCloseMatch) {
            // Close match - partial points
            answer.score = (question.points || 1) * 0.8; // 80% of points
            answer.feedback = "Mostly correct. Your answer is very close to the expected answer.";
            answer.isCorrect = true;
            console.log(`  Answer is PARTIALLY CORRECT (close match)`);
          } else if (correctAnswer) {
            // Incorrect answer
            answer.score = 0;
            answer.feedback = `Incorrect. The correct answer is: "${question.correctAnswer}"`;
            answer.isCorrect = false;
            console.log(`  Answer is INCORRECT`);
          } else {
            // No correct answer provided in the question, use AI to grade
            try {
              console.log(`  No predefined correct answer. Using AI to grade...`);

              // Prepare prompt for AI grading
              const prompt = `
                Grade this fill-in-the-blank question answer:

                Question: ${question.text}
                Student's Answer: ${studentAnswer}

                Evaluate if the student's answer is correct or partially correct.
                Consider synonyms and alternative phrasings.

                Respond with:
                1. A score from 0 to ${question.points || 1} (can be decimal)
                2. Brief feedback explaining the score
                3. Whether the answer is correct (true/false)

                Format your response as JSON:
                {
                  "score": number,
                  "feedback": "string",
                  "isCorrect": boolean
                }
              `;

              // Use the chunked grading method to avoid rate limits
              const aiResult = await chunkedGradeEssay(prompt);

              try {
                const parsedResult = JSON.parse(aiResult);
                answer.score = Math.min(Math.max(0, parsedResult.score || 0), question.points);
                answer.feedback = parsedResult.feedback;
                answer.isCorrect = answer.score >= question.points;

                console.log(`  AI graded with score: ${answer.score}, isCorrect: ${answer.isCorrect}`);
              } catch (parseError) {
                console.error(`Error parsing AI result: ${parseError.message}`);
                // Fallback to a default score
                answer.score = 0;
                answer.feedback = "Unable to grade answer automatically. Please contact your instructor.";
                answer.isCorrect = false;
              }
            } catch (aiError) {
              console.error(`Error using AI to grade: ${aiError.message}`);
              // Fallback to a default score
              answer.score = 0;
              answer.feedback = "Unable to grade answer automatically. Please contact your instructor.";
              answer.isCorrect = false;
            }
          }

          // Store the correct answer for reference
          answer.correctedAnswer = formatCorrectAnswer(question.correctAnswer, "Graded by AI");

          // Add to total score
          totalScore += answer.score;

          console.log(`Graded fill-in-blank answer for question ${question._id}, score: ${answer.score}/${question.points || 1}`);
        } else {
          // If the student didn't provide an answer, they get 0 points
          console.log(`  Student did not provide an answer for question ${questionNumber}`);
          answer.score = 0;
          answer.feedback = "No answer provided.";
          answer.correctedAnswer = formatCorrectAnswer(question.correctAnswer, "");
          answer.isCorrect = false;
        }

        continue;
      }

      // Skip already graded open-ended answers or empty answers
      if (answer.score > 0 || !answer.textAnswer || answer.textAnswer.trim() === '') {
        console.log(`Skipping answer for question ${question._id} (already graded or empty)`);
        continue;
      }

      console.log(`Grading open-ended answer for question ${question._id}`);

      try {
        // Try the chunked grading approach first
        console.log(`Using chunked AI grading for question ${question._id}`);
        let grading;

        try {
          // Use the model answer from the question
          let modelAnswer = question.correctAnswer;

          // If the model answer is missing or just says "Not provided" or "Sample answer", pass null to let AI grade based on its own logic
          if (!modelAnswer ||
              modelAnswer === "Not provided" ||
              modelAnswer === "Sample answer" ||
              modelAnswer.trim() === "") {
            // Log that we're letting AI grade without model answer
            console.log(`No model answer found for question ${question._id}. Using AI grading without model answer.`);
            modelAnswer = null; // Pass null to trigger AI grading without model answer
          }

          // Use enhanced grading system for all question types
          grading = await gradeQuestionByType(question, answer, modelAnswer);
        } catch (enhancedError) {
          // If enhanced grading fails, try chunked grading
          console.log(`Enhanced grading failed, falling back to chunked grading for question ${question._id}`);
          console.error('Enhanced grading error:', enhancedError);

          try {
            grading = await chunkedGradeEssay(
              answer.textAnswer,
              modelAnswer,
              question.points,
              question.text // Pass the question text to provide context
            );
          } catch (chunkedError) {
            // If chunked grading fails, try standard grading
            console.log(`Chunked grading failed, falling back to standard grading for question ${question._id}`);
            console.error('Chunked grading error:', chunkedError);

            grading = await standardGradeEssay(
              answer.textAnswer,
              question.correctAnswer,
              question.points,
              question.text // Pass the question text to provide context
            );
          }
        }

        console.log(`AI grading result for question ${question._id}:`, {
          score: grading.score,
          feedbackPreview: grading.feedback.substring(0, 50) + '...'
        });

        // Update the answer with AI grading results - ensure database consistency like regrading
        const cappedScore = Math.min(Math.max(0, grading.score || 0), question.points);
        result.answers[i].score = cappedScore;
        result.answers[i].feedback = grading.feedback;
        result.answers[i].isCorrect = cappedScore >= question.points; // Full points required for "correct"
        result.answers[i].correctedAnswer = grading.correctedAnswer || formatCorrectAnswer(question.correctAnswer);
        result.answers[i].gradingMethod = grading.details?.gradingMethod || 'ai_grading'; // Track grading method

        // Add to total score
        totalScore += cappedScore;

        console.log(`Graded answer for question ${question._id}, score: ${grading.score}/${question.points}`);

        // Log semantic matches for debugging
        if (grading.details && grading.details.gradingMethod === 'semantic_match') {
          console.log(`Semantic match detected for question ${question._id}: "${answer.textAnswer || answer.selectedOption}" ≈ "${question.correctAnswer}"`);
        }

        // Note: We'll save all progress at the end to avoid validation conflicts
      } catch (error) {
        console.error(`Error grading answer for question ${question._id}:`, error);

        // Fall back to keyword matching
        console.log(`Falling back to keyword matching for question ${question._id}`);

        const studentAnswer = answer.textAnswer.toLowerCase();

        // Use the model answer from the question
        let modelAnswerText = question.correctAnswer;

        // If the model answer is missing or just says "Not provided" or "Sample answer"
        if (!modelAnswerText ||
            modelAnswerText === "Not provided" ||
            modelAnswerText === "Sample answer" ||
            modelAnswerText.trim() === "") {
          // Log that we're using a default model answer
          console.log(`Warning: No model answer found for question ${question._id}. Using default for keyword matching.`);
          modelAnswerText = "The answer should demonstrate understanding of the core concepts, provide relevant examples, and explain the relationships between key components.";
        }

        const modelAnswer = modelAnswerText.toLowerCase();

        // Use a more lenient approach - include words of 3 or more characters
        const modelKeywords = modelAnswer.split(/\s+/).filter(word => word.length >= 3);

        // Count matches, giving partial credit for partial matches
        let matchCount = 0;
        for (const keyword of modelKeywords) {
          if (studentAnswer.includes(keyword)) {
            matchCount += 1; // Full match
          } else if (keyword.length > 4) {
            // For longer words, check if at least 70% of the word is present
            const partialMatches = studentAnswer.split(/\s+/).filter(word =>
              word.length >= 3 &&
              (keyword.includes(word) || word.includes(keyword.substring(0, Math.floor(keyword.length * 0.7))))
            );
            if (partialMatches.length > 0) {
              matchCount += 0.5; // Partial match
            }
          }
        }

        // Calculate match percentage - NO minimum score guarantee
        const matchPercentage = modelKeywords.length > 0
          ? matchCount / modelKeywords.length
          : 0;

        // Assign score based on keyword match percentage
        const score = Math.round(matchPercentage * question.points);

        console.log(`Keyword matching details for question ${question._id}:`);
        console.log(`- Keywords found: ${matchCount} out of ${modelKeywords.length}`);
        console.log(`- Match percentage: ${Math.round(matchPercentage * 100)}%`);
        console.log(`- Score: ${score}/${question.points}`);

        // Generate appropriate feedback
        let feedback;
        if (score >= question.points * 0.8) {
          feedback = 'Excellent answer! Your response covers most of the key concepts expected by the AI grading system.';
        } else if (score >= question.points * 0.5) {
          feedback = 'Good answer! The AI has identified several important concepts in your response, but noted some gaps.';
        } else if (score >= question.points * 0.3) {
          feedback = 'Your answer touches on a few key points, but the AI grading system found that it needs more development.';
        } else if (score >= question.points * 0.1) {
          feedback = 'The AI identified minimal overlap with the expected answer. Review the model answer to see what you missed.';
        } else {
          feedback = 'Your answer differs significantly from what was expected. Compare with the model answer to understand the key concepts.';
        }

        // Add information about the model answer for transparency
        feedback += ` Compare your answer with the model answer to see what you might have missed.`;

        // Update the answer with fallback grading results
        const cappedScore = Math.min(Math.max(0, score || 0), question.points);
        result.answers[i].score = cappedScore;
        result.answers[i].feedback = `${feedback} (Note: This was graded using keyword matching due to AI unavailability)`;
        result.answers[i].isCorrect = cappedScore >= question.points * 0.7; // 70% threshold
        result.answers[i].correctedAnswer = formatCorrectAnswer(question.correctAnswer);

        // Add to total score
        totalScore += cappedScore;
      }
    }

    // Calculate total score based on selective answering settings
    const exam = await Exam.findById(result.exam);

    if (exam && exam.allowSelectiveAnswering) {
      // Get all questions by section dynamically
      const questionsBySection = {};
      result.answers.forEach(answer => {
        if (answer.question && answer.question.section) {
          const section = answer.question.section;
          if (!questionsBySection[section]) {
            questionsBySection[section] = [];
          }
          questionsBySection[section].push(answer);
        }
      });

      // Log section counts for debugging
      Object.keys(questionsBySection).sort().forEach(section => {
        console.log(`Section ${section}: ${questionsBySection[section].length} questions`);
      });

      // Get selected questions for sections B and C (selective answering sections)
      const sectionBQuestions = questionsBySection['B'] || [];
      const sectionCQuestions = questionsBySection['C'] || [];
      const selectedSectionBQuestions = sectionBQuestions.filter(answer => answer.isSelected);
      const selectedSectionCQuestions = sectionCQuestions.filter(answer => answer.isSelected);

      // Log selected questions for debugging
      console.log(`Selected in Section B: ${selectedSectionBQuestions.length} questions`);
      console.log(`Selected in Section C: ${selectedSectionCQuestions.length} questions`);

      // Log the selection status of each question in sections B and C
      sectionBQuestions.forEach((answer, index) => {
        console.log(`Section B Question ${index + 1} (${answer.question._id}): isSelected=${answer.isSelected}`);
      });

      sectionCQuestions.forEach((answer, index) => {
        console.log(`Section C Question ${index + 1} (${answer.question._id}): isSelected=${answer.isSelected}`);
      });

      // Check if student has answered the required number of questions in each section
      const requiredSectionB = exam.sectionBRequiredQuestions || 3;
      const requiredSectionC = exam.sectionCRequiredQuestions || 1;

      // If there are no questions in a section, consider it as having enough selected
      const hasEnoughSectionB = sectionBQuestions.length === 0 ||
                               selectedSectionBQuestions.length >= requiredSectionB;
      const hasEnoughSectionC = sectionCQuestions.length === 0 ||
                               selectedSectionCQuestions.length >= requiredSectionC;

      console.log(`Student selected ${selectedSectionBQuestions.length}/${requiredSectionB} questions in Section B (has enough: ${hasEnoughSectionB})`);
      console.log(`Student selected ${selectedSectionCQuestions.length}/${requiredSectionC} questions in Section C (has enough: ${hasEnoughSectionC})`);

      // Calculate scores for each section
      let totalScore = 0;
      let maxPossibleScore = 0;

      // Process all sections dynamically
      Object.keys(questionsBySection).sort().forEach(section => {
        const sectionQuestions = questionsBySection[section];
        
        if (section === 'A' || (section !== 'B' && section !== 'C')) {
          // Section A and any other sections (D, E, etc.) - all questions are required
          const sectionScore = sectionQuestions.reduce((total, answer) => total + (answer.score || 0), 0);
          const sectionMaxScore = sectionQuestions.reduce((total, answer) =>
            total + (answer.question.points || 1), 0);

          totalScore += sectionScore;
          maxPossibleScore += sectionMaxScore || 1;

          console.log(`Section ${section} score: ${sectionScore}/${sectionMaxScore} (all questions required)`);
        } else if (section === 'B') {
          // Section B - only count selected questions if enough are selected
          if (sectionBQuestions.length > 0) {
            if (hasEnoughSectionB && selectedSectionBQuestions.length > 0) {
              // Calculate score from selected questions only
              const sectionBScore = selectedSectionBQuestions.reduce((total, answer) =>
                total + (answer.score || 0), 0);

              // For max possible score, use the required number of questions with highest points
              // Sort questions by points in descending order
              const sortedQuestions = [...selectedSectionBQuestions].sort((a, b) =>
                (b.question.points || 1) - (a.question.points || 1));

              // Take the top requiredSectionB questions or all if fewer
              const topQuestions = sortedQuestions.slice(0, requiredSectionB);
              const sectionBMaxScore = topQuestions.reduce((total, answer) =>
                total + (answer.question.points || 1), 0);

              totalScore += sectionBScore;
              maxPossibleScore += sectionBMaxScore;

              console.log(`Section B score: ${sectionBScore}/${sectionBMaxScore} (from ${selectedSectionBQuestions.length} selected questions)`);
            } else {
              // Not enough questions selected - count all questions in the section
              console.log('Not enough questions selected in Section B - counting all questions');
              const sectionBScore = sectionBQuestions.reduce((total, answer) => total + (answer.score || 0), 0);

              // For max possible score, use the required number of questions with highest points
              // Sort questions by points in descending order
              const sortedQuestions = [...sectionBQuestions].sort((a, b) =>
                (b.question.points || 1) - (a.question.points || 1));

              // Take the top requiredSectionB questions or all if fewer
              const topQuestions = sortedQuestions.slice(0, Math.min(requiredSectionB, sortedQuestions.length));
              const sectionBMaxScore = topQuestions.reduce((total, answer) =>
                total + (answer.question.points || 1), 0);

              totalScore += sectionBScore;
              maxPossibleScore += sectionBMaxScore;

              console.log(`Section B score: ${sectionBScore}/${sectionBMaxScore} (from all ${sectionBQuestions.length} questions, counting top ${topQuestions.length})`);
            }
          } else {
            console.log('No questions in Section B');
          }
        } else if (section === 'C') {
          // Section C - only count selected questions if enough are selected
          if (sectionCQuestions.length > 0) {
            if (hasEnoughSectionC && selectedSectionCQuestions.length > 0) {
              // Calculate score from selected questions only
              const sectionCScore = selectedSectionCQuestions.reduce((total, answer) =>
                total + (answer.score || 0), 0);

              // For max possible score, use the required number of questions with highest points
              // Sort questions by points in descending order
              const sortedQuestions = [...selectedSectionCQuestions].sort((a, b) =>
                (b.question.points || 1) - (a.question.points || 1));

              // Take the top requiredSectionC questions or all if fewer
              const topQuestions = sortedQuestions.slice(0, requiredSectionC);
              const sectionCMaxScore = topQuestions.reduce((total, answer) =>
                total + (answer.question.points || 1), 0);

              totalScore += sectionCScore;
              maxPossibleScore += sectionCMaxScore;

              console.log(`Section C score: ${sectionCScore}/${sectionCMaxScore} (from ${selectedSectionCQuestions.length} selected questions)`);
            } else {
              // Not enough questions selected - count all questions in the section
              console.log('Not enough questions selected in Section C - counting all questions');
              const sectionCScore = sectionCQuestions.reduce((total, answer) => total + (answer.score || 0), 0);

              // For max possible score, use the required number of questions with highest points
              // Sort questions by points in descending order
              const sortedQuestions = [...sectionCQuestions].sort((a, b) =>
                (b.question.points || 1) - (a.question.points || 1));

              // Take the top requiredSectionC questions or all if fewer
              const topQuestions = sortedQuestions.slice(0, Math.min(requiredSectionC, sortedQuestions.length));
              const sectionCMaxScore = topQuestions.reduce((total, answer) =>
                total + (answer.question.points || 1), 0);

              totalScore += sectionCScore;
              maxPossibleScore += sectionCMaxScore;

              console.log(`Section C score: ${sectionCScore}/${sectionCMaxScore} (from all ${sectionCQuestions.length} questions, counting top ${topQuestions.length})`);
            }
          } else {
            console.log('No questions in Section C');
          }
        }
      });

      // Ensure we have valid scores (not NaN or 0/0)
      if (isNaN(totalScore) || totalScore === undefined) totalScore = 0;
      if (isNaN(maxPossibleScore) || maxPossibleScore === undefined || maxPossibleScore === 0) maxPossibleScore = 1;

      // Update result with calculated scores
      result.totalScore = totalScore;
      result.maxPossibleScore = maxPossibleScore;

      console.log(`Final score: ${totalScore}/${maxPossibleScore}`);
    } else {
      // Standard scoring - count all questions
      result.totalScore = totalScore;

      // Calculate max possible score
      const maxPossibleScore = result.answers.reduce((total, answer) =>
        total + (answer.question.points || 1), 0) || 1; // Ensure we don't have a zero denominator

      result.maxPossibleScore = maxPossibleScore;

      console.log(`Standard scoring - Final score: ${totalScore}/${maxPossibleScore}`);
    }

    // Save the updated result
    await result.save();

    console.log(`Completed grading for exam result ${resultId}, total score: ${totalScore}/${result.maxPossibleScore}`);

    return {
      resultId,
      totalScore,
      maxPossibleScore: result.maxPossibleScore,
      percentage: (totalScore / result.maxPossibleScore) * 100
    };
  } catch (error) {
    console.error(`Error grading exam result ${resultId}:`, error);
    throw error;
  }
}

/**
 * Find and grade all completed exams that have ungraded open-ended answers
 * @returns {Promise<{processed: number, updated: number, errors: number}>}
 */
const findAndGradeUngradedResults = async () => {
  try {
    console.log('Starting batch grading of ungraded exam results');

    // Find all completed results
    const results = await Result.find({
      isCompleted: true
    }).populate({
      path: 'answers.question',
      model: 'Question',
      select: 'text type options points correctAnswer'
    });

    console.log(`Found ${results.length} completed exam results to check`);

    let processed = 0;
    let updated = 0;
    let errors = 0;

    // Process each result
    for (const result of results) {
      try {
        processed++;

        // Check if this result has any ungraded open-ended or image-based answers
        const hasUngradedAnswers = result.answers.some(answer =>
          (answer.question.type === 'open-ended' || answer.question.type === 'image' || answer.question.type === 'image-based' || answer.question.type === 'structured') &&
          answer.textAnswer &&
          answer.textAnswer.trim() !== '' &&
          (answer.score === 0 || !answer.feedback || !answer.correctedAnswer)
        );

        if (hasUngradedAnswers) {
          console.log(`Result ${result._id} has ungraded answers, applying AI grading`);

          // Grade the result
          await gradeExamWithAI(result._id);
          updated++;

          console.log(`Successfully updated result ${result._id}`);
        } else {
          console.log(`Result ${result._id} has no ungraded answers, skipping`);
        }
      } catch (error) {
        console.error(`Error processing result ${result._id}:`, error);
        errors++;
      }
    }

    console.log(`Batch grading completed: ${processed} processed, ${updated} updated, ${errors} errors`);

    return {
      processed,
      updated,
      errors
    };
  } catch (error) {
    console.error('Error in batch grading:', error);
    throw error;
  }
};

/**
 * Grade a specific exam result, even if it's already been graded
 * OPTIMIZED: Uses caching and pre-determination for faster regrading
 * @param {string} resultId - The ID of the result to grade
 * @param {boolean} forceRegrade - Whether to regrade already graded answers
 * @returns {Promise<object>} - The updated result
 */
const regradeExamResult = async (resultId, forceRegrade = false) => {
  try {
    console.log(`Starting regrading for exam result ${resultId} (force: ${forceRegrade})`);

    // Find the result and populate necessary data
    const result = await Result.findById(resultId)
      .populate({
        path: 'exam',
        select: 'title description timeLimit sections originalFile answerFile'
      })
      .populate({
        path: 'answers.question',
        model: 'Question',
        select: 'text type options points correctAnswer'
      });

    if (!result) {
      throw new Error(`Result ${resultId} not found`);
    }

    console.log(`Found result with ${result.answers.length} answers to check`);

    // We're not using answer files anymore - using AI to determine correct answers
    console.log(`Using AI to determine correct answers for exam: ${result.exam?._id || 'unknown'}`);

    // Track the old score for comparison
    const oldScore = result.totalScore || 0;
    const oldPercentage = result.maxPossibleScore > 0 ? Math.round((oldScore / result.maxPossibleScore) * 100) : 0;

    // Reset total score if we're force regrading
    let totalScore = forceRegrade ? 0 : result.totalScore || 0;

    // Helper function to add delay between API calls (OPTIMIZED: Reduced delays)
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // OPTIMIZED: Cache for AI-determined answers to avoid redundant API calls
    const aiAnswerCache = new Map();

    // OPTIMIZED: Pre-determine correct answers for all MC/TF questions using AI in batch
    const determineCorrectAnswersWithAI = async (questions) => {
      const groqClient = require('./groqClient');
      const answersMap = new Map();

      for (const q of questions) {
        if (!q || !q.text || !q.options || q.options.length < 2) continue;

        const cacheKey = q._id.toString();
        if (aiAnswerCache.has(cacheKey)) {
          continue; // Already determined
        }

        try {
          const options = q.options.map(opt => ({
            letter: opt.letter || '',
            text: opt.text || ''
          }));

          const prompt = `You are an expert grader. Determine the correct answer for this multiple choice question:
Question: ${q.text}
Options:
${options.map(opt => `${opt.letter}. ${opt.text}`).join('\n')}

Only respond with the letter (A, B, C, or D). No explanation.`;

          // Use Groq client directly for better caching
          const response = await groqClient.generateContent(prompt, {
            model: 'fast',
            jsonMode: false,
            temperature: 0.1,
            maxTokens: 50
          });

          if (response && response.text) {
            const letterMatch = response.text.match(/\b([A-D])\b/i);
            if (letterMatch) {
              const correctLetter = letterMatch[1].toUpperCase();
              aiAnswerCache.set(cacheKey, correctLetter);
              console.log(`✅ AI determined correct answer for question ${cacheKey}: ${correctLetter}`);
            }
          }
        } catch (error) {
          console.log(`⚠️ Could not determine answer for question ${cacheKey}, will use fallback`);
        }
      }
      return aiAnswerCache;
    };

    // Helper function to grade a single multiple choice or true/false question
    const gradeSingleMCQuestion = async (answer, question, index) => {
      const i = index;
      // Get the question number from the question text or use the index
      const questionNumber = extractQuestionNumber(question.text, i);

      // Log whether we're grading for the first time or regrading
      const questionTypeLabel = question.type === 'true-false' ? 'true/false' : 'multiple choice';
      if (forceRegrade && answer.score > 0) {
        console.log(`Regrading ${questionTypeLabel} question ${questionNumber}: "${question.text.substring(0, 50)}..." (previous score: ${answer.score}/${question.points})`);
      } else {
        console.log(`Processing ${questionTypeLabel} question ${questionNumber}: "${question.text.substring(0, 50)}..."`);
      }

      // Ensure all options have letter properties
      if (question.options && Array.isArray(question.options)) {
        question.options = ensureOptionLetters(question.options);
      }

      // Variables to track correctness
      let isCorrect = false;
      let correctOptionText = '';
      let correctOptionLetter = '';
      let selectedOptionText = ''; // Will store student's answer for logging

      // OPTIMIZED: Use cached AI-determined answer instead of calling AI again
      console.log(`Using cached AI-determined answer for question ${questionNumber}`);

      // Get the question text and options
      const questionText = question.text;
      const options = question.options.map(opt => ({
        letter: opt.letter || '',
        text: opt.text || ''
      }));

      // Prepare to use AI to determine the correct answer
      let correctLetter = '';

      // OPTIMIZED: Check cache first to avoid redundant AI calls
      const cacheKey = question._id.toString();
      if (aiAnswerCache.has(cacheKey)) {
        correctLetter = aiAnswerCache.get(cacheKey);
        console.log(`✅ Using cached AI answer for question ${questionNumber}: ${correctLetter}`);
      } else {
        // Fallback: Use AI if not in cache (shouldn't happen with pre-determination)
        console.log(`⚠️ Cache miss for question ${questionNumber}, using AI fallback`);

        try {
          // Use Groq client directly for better caching
          const groqClient = require('./groqClient');

          // Create a prompt for the AI
          const prompt = `You are an expert in computer systems and exam grading with up-to-date knowledge of modern technology.

I have a multiple choice question from a computer systems exam:
Question: ${questionText}

Options:
${options.map(opt => `${opt.letter}. ${opt.text}`).join('\n')}

Please determine the correct answer based on current, modern technology standards and practices. Consider that there may be multiple valid answers depending on the context, but select the most appropriate one.

Important: Do not rely on outdated information. For example, while PS/2 ports were once common for keyboards, USB is now the standard connection method for most modern keyboards.

Only respond with the letter of the correct option (A, B, C, or D).`;

          // Generate content with the AI
          const response = await groqClient.generateContent(prompt, {
            model: 'fast',
            jsonMode: false,
            temperature: 0.1,
            maxTokens: 50
          });

          // Extract the letter from the response
          if (response && response.text) {
            // Look for a single letter A, B, C, or D in the response
            const letterMatch = response.text.match(/\b([A-D])\b/i);
            if (letterMatch) {
              correctLetter = letterMatch[1].toUpperCase();
              console.log(`AI determined correct answer for question ${questionNumber}: ${correctLetter}`);
              // Cache the result
              aiAnswerCache.set(cacheKey, correctLetter);
            } else {
              // If no clear letter, try to find any A, B, C, or D in the response
              const anyLetterMatch = response.text.match(/([A-D])/i);
              if (anyLetterMatch) {
                correctLetter = anyLetterMatch[1].toUpperCase();
                console.log(`AI determined correct answer (fallback) for question ${questionNumber}: ${correctLetter}`);
                aiAnswerCache.set(cacheKey, correctLetter);
              } else {
                console.log(`AI could not determine a clear answer. Response: ${response.text}`);
                // Default to option A if AI fails
                correctLetter = 'A';
              }
            }
          } else {
            console.log(`No response from AI for question ${questionNumber}`);
            // Default to option A if AI fails
            correctLetter = 'A';
          }
        } catch (aiError) {
          console.error(`Error using AI to determine correct answer: ${aiError.message}`);
          // Default to option A if AI fails
          correctLetter = 'A';
        }
      }

      console.log(`Final determined correct answer for question ${questionNumber}: ${correctLetter}`);

      // Find the option with this letter
      const correctOption = question.options.find(opt =>
        opt.letter && opt.letter.toUpperCase() === correctLetter
      );

      if (correctOption) {
        // Mark this option as correct in memory
        question.options.forEach(opt => {
          opt.isCorrect = (opt.letter && opt.letter.toUpperCase() === correctLetter);
        });

        // Set the correct answer text
        correctOptionText = correctOption.text;
        correctOptionLetter = correctLetter;

        // Update the question's correct answer in the database
        try {
          // First update all options to ensure they have letter and value fields
          const updatedOptions = question.options.map((opt, index) => {
            // If the option doesn't have a letter, assign one based on index
            if (!opt.letter) {
              opt.letter = String.fromCharCode(65 + index); // A, B, C, D...
            }
            // If the option doesn't have a value, assign one based on letter
            if (!opt.value) {
              opt.value = opt.letter.toLowerCase();
            }
            // Set isCorrect based on the letter
            opt.isCorrect = (opt.letter && opt.letter.toUpperCase() === correctLetter);
            return opt;
          });

          // Update the question with the correct options
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

          console.log(`Updated question ${question._id} with correct answer: ${correctOption.text} (${correctLetter})`);
        } catch (updateError) {
          console.error(`Error updating question in database: ${updateError.message}`);
        }

        // Find the selected option letter
        let selectedLetter = '';
        // Check both selectedOption and textAnswer as answer may be stored in either field
        selectedOptionText = answer.selectedOption || answer.textAnswer || '';

        // Log the selected option for debugging
        console.log(`Student selected option: "${selectedOptionText}"`);

        if (selectedOptionText) {
          // First check if the selectedOption is already just a letter
          if (selectedOptionText.match(/^[A-D]$/i)) {
            selectedLetter = selectedOptionText.toUpperCase();
            console.log(`Detected letter format: ${selectedLetter}`);
          }
          // If the selected option starts with a letter followed by a period or parenthesis
          else if (selectedOptionText.match(/^([A-D])[\.\)]/i)) {
            const letterMatch = selectedOptionText.match(/^([A-D])[\.\)]/i);
            selectedLetter = letterMatch[1].toUpperCase();
            console.log(`Detected letter with punctuation: ${selectedLetter}`);
          }
          // Check if the option contains a letter in parentheses or with a period
          else if (selectedOptionText.match(/\(([A-D])\)|\s([A-D])\./i)) {
            const letterMatch = selectedOptionText.match(/\(([A-D])\)|\s([A-D])\./i);
            selectedLetter = (letterMatch[1] || letterMatch[2]).toUpperCase();
            console.log(`Detected embedded letter: ${selectedLetter}`);
          }
          // Try to find the matching option in the question options
          else {
            console.log(`Trying to match selected text with options`);

            // First try to find an exact match
            let selectedOption = question.options.find(opt =>
              opt.text === selectedOptionText
            );

            // If no exact match, try case-insensitive match
            if (!selectedOption) {
              selectedOption = question.options.find(opt =>
                opt.text.toLowerCase() === selectedOptionText.toLowerCase()
              );
            }

            // If still no match, try partial matches
            if (!selectedOption) {
              // Try to find the option that best matches the selected text
              let bestMatch = null;
              let bestMatchScore = 0;

              for (const opt of question.options) {
                // Check if the option text contains the selected text or vice versa
                if (opt.text.includes(selectedOptionText) || selectedOptionText.includes(opt.text)) {
                  // Calculate a simple match score based on the length of the common substring
                  const matchScore = Math.min(opt.text.length, selectedOptionText.length);
                  if (matchScore > bestMatchScore) {
                    bestMatchScore = matchScore;
                    bestMatch = opt;
                  }
                }
              }

              selectedOption = bestMatch;
            }

            if (selectedOption && selectedOption.letter) {
              selectedLetter = selectedOption.letter.toUpperCase();
              console.log(`Matched with option ${selectedLetter}: "${selectedOption.text}"`);
            } else {
              console.log(`Could not match selected text with any option`);

              // As a last resort, try to match the selected text directly with the correct option
              if (correctOption &&
                  (selectedOptionText.includes(correctOption.text) ||
                   correctOption.text.includes(selectedOptionText))) {
                console.log(`Direct match with correct option text`);
                selectedLetter = correctLetter;
              }
            }
          }
        }

        // If we have the selectedOptionLetter from the database, use that
        if (answer.selectedOptionLetter) {
          selectedLetter = answer.selectedOptionLetter.toUpperCase();
          console.log(`Using stored selectedOptionLetter: ${selectedLetter}`);
        }

        // Check if the selected letter matches the correct letter
        isCorrect = !!(selectedLetter && selectedLetter === correctLetter);

        // Store the selected letter for future reference
        result.answers[i].selectedOptionLetter = selectedLetter;
      } else {
        console.log(`Could not find option with letter ${correctLetter} for question ${questionNumber}`);
        isCorrect = false;
        correctOptionText = `Option ${correctLetter}`;
        correctOptionLetter = correctLetter;
      }

      // Update the answer with correct grading
      result.answers[i].isCorrect = isCorrect;
      result.answers[i].score = isCorrect ? question.points : 0;

      // Store the correct answer for display in results
      result.answers[i].correctedAnswer = correctOptionText;
      if (correctOptionLetter) {
        result.answers[i].correctOptionLetter = correctOptionLetter;
      }

      // Add to total score if correct
      if (isCorrect) {
        totalScore += question.points;
      }

      console.log(`Verified ${questionTypeLabel} answer for question ${question._id}:`);
      console.log(`- Selected option: ${selectedOptionText}`);
      console.log(`- Correct option: ${correctOptionText}`);
      console.log(`- Is correct: ${isCorrect}`);

      return { score: isCorrect ? question.points : 0, isCorrect };
    };

    // Separate MC/TF questions from open-ended questions for parallel processing
    const mcQuestions = [];
    const openEndedQuestions = [];

    for (let i = 0; i < result.answers.length; i++) {
      const answer = result.answers[i];
      const question = answer.question;

      if (question.type === 'multiple-choice' || question.type === 'true-false') {
        const hasAnswer = answer.selectedOption || answer.textAnswer;
        if (hasAnswer) {
          mcQuestions.push({ answer, question, index: i });
        } else if (forceRegrade && answer.score > 0) {
          totalScore += answer.score;
        }
      } else {
        openEndedQuestions.push({ answer, question, index: i });
      }
    }

    console.log(`\n🚀 PARALLEL GRADING: Processing ${mcQuestions.length} MC/TF questions in parallel, ${openEndedQuestions.length} open-ended sequentially`);

    // OPTIMIZED: Pre-determine correct answers for MC/TF questions FIRST
    const mcQuestionsList = mcQuestions.map(a => a.question);
    console.log(`🚀 Pre-determining correct answers for ${mcQuestionsList.length} MC/TF questions using AI...`);
    await determineCorrectAnswersWithAI(mcQuestionsList);
    console.log(`✅ AI answer cache populated with ${aiAnswerCache.size} answers for regrading`);

    // Process all MC/TF questions in parallel with concurrency limit
    const CONCURRENCY_LIMIT = 5; // Process 5 at a time to avoid overwhelming AI
    console.log(`Processing ${mcQuestions.length} MC/TF questions with concurrency limit of ${CONCURRENCY_LIMIT}...`);

    // Process in batches
    for (let i = 0; i < mcQuestions.length; i += CONCURRENCY_LIMIT) {
      const batch = mcQuestions.slice(i, i + CONCURRENCY_LIMIT);
      console.log(`Processing batch ${Math.floor(i / CONCURRENCY_LIMIT) + 1}/${Math.ceil(mcQuestions.length / CONCURRENCY_LIMIT)} (${batch.length} questions)`);

      await Promise.all(batch.map(({ answer, question, index }) =>
        gradeSingleMCQuestion(answer, question, index)
      ));

      // OPTIMIZED: Reduced delay between batches
      if (i + CONCURRENCY_LIMIT < mcQuestions.length) {
        await delay(200); // Reduced from 500ms to 200ms
      }
    }

    console.log(`✅ Completed parallel grading of ${mcQuestions.length} MC/TF questions`);

    // Process open-ended questions sequentially (they need more time per question)
    for (let idx = 0; idx < openEndedQuestions.length; idx++) {
      const { answer, question, index: i } = openEndedQuestions[idx];

      // OPTIMIZED: Reduced delay between grading attempts
      if (idx > 0) {
        console.log(`Adding minimal delay before grading next question...`);
        await delay(1000); // Reduced from 3000ms to 1000ms
      }

      // Skip empty answers
      if (!answer.textAnswer || answer.textAnswer.trim() === '') {
        console.log(`Skipping empty answer for question ${question._id}`);
        continue;
      }

      // Skip already graded answers unless force regrading
      if (!forceRegrade && answer.score > 0 && answer.feedback && answer.correctedAnswer) {
        console.log(`Skipping already graded answer for question ${question._id} (score: ${answer.score}/${question.points})`);
        totalScore += answer.score; // Make sure to count existing scores
        continue;
      }

      // Log whether we're grading for the first time or regrading
      if (forceRegrade && answer.score > 0 && answer.feedback && answer.correctedAnswer) {
        console.log(`Regrading previously graded answer for question ${question._id} (previous score: ${answer.score}/${question.points})`);
      } else {
        console.log(`Grading open-ended answer for question ${question._id}`);
      }

      try {
        // Try the chunked grading approach first
        console.log(`Using chunked AI grading for question ${question._id}`);
        let grading;

        try {
          // Use the model answer from the question
          let modelAnswer = question.correctAnswer;

          // If the model answer is missing or just says "Not provided" or "Sample answer", pass null to let AI grade based on its own logic
          if (!modelAnswer ||
              modelAnswer === "Not provided" ||
              modelAnswer === "Sample answer" ||
              modelAnswer.trim() === "") {
            // Log that we're letting AI grade without model answer
            console.log(`No model answer found for question ${question._id}. Using AI grading without model answer.`);
            modelAnswer = null; // Pass null to trigger AI grading without model answer
          }

          // Use enhanced grading system for all question types
          grading = await gradeQuestionByType(question, answer, modelAnswer);
        } catch (enhancedError) {
          // If enhanced grading fails, try chunked grading
          console.log(`Enhanced grading failed, falling back to chunked grading for question ${question._id}`);
          console.error('Enhanced grading error:', enhancedError);

          try {
            grading = await chunkedGradeEssay(
              answer.textAnswer,
              modelAnswer,
              question.points,
              question.text // Pass the question text to provide context
            );
          } catch (chunkedError) {
            // If chunked grading fails, try standard grading
            console.log(`Chunked grading failed, falling back to standard grading for question ${question._id}`);
            console.error('Chunked grading error:', chunkedError);

            grading = await standardGradeEssay(
              answer.textAnswer,
              question.correctAnswer,
              question.points,
              question.text // Pass the question text to provide context
            );
          }
        }

        console.log(`AI grading result for question ${question._id}:`, {
          score: grading.score,
          feedbackPreview: grading.feedback.substring(0, 50) + '...'
        });

        // Update the answer with AI grading results - ensure database consistency like regrading
        const cappedScore = Math.min(Math.max(0, grading.score || 0), question.points);
        result.answers[i].score = cappedScore;
        result.answers[i].feedback = grading.feedback;
        result.answers[i].isCorrect = cappedScore >= question.points; // Full points required for "correct"
        result.answers[i].correctedAnswer = grading.correctedAnswer || formatCorrectAnswer(question.correctAnswer);
        result.answers[i].gradingMethod = grading.details?.gradingMethod || 'regrade_ai_grading'; // Track grading method

        // Add to total score
        totalScore += cappedScore;

        console.log(`Graded answer for question ${question._id}, score: ${grading.score}/${question.points}`);

        // Log semantic matches for debugging
        if (grading.details && grading.details.gradingMethod === 'semantic_match') {
          console.log(`Semantic match detected for question ${question._id}: "${answer.textAnswer || answer.selectedOption}" ≈ "${question.correctAnswer}"`);
        }

        // Note: We'll save all progress at the end to avoid validation conflicts
      } catch (error) {
        console.error(`Error grading answer for question ${question._id}:`, error);

        // Fall back to keyword matching
        console.log(`Falling back to keyword matching for question ${question._id}`);

        const studentAnswer = answer.textAnswer.toLowerCase();

        // Use the model answer from the question
        let modelAnswerText = question.correctAnswer;

        // If the model answer is missing or just says "Not provided" or "Sample answer"
        if (!modelAnswerText ||
            modelAnswerText === "Not provided" ||
            modelAnswerText === "Sample answer" ||
            modelAnswerText.trim() === "") {
          // Log that we're using a default model answer
          console.log(`Warning: No model answer found for question ${question._id}. Using default for keyword matching.`);
          modelAnswerText = "The answer should demonstrate understanding of the core concepts, provide relevant examples, and explain the relationships between key components.";
        }

        const modelAnswer = modelAnswerText.toLowerCase();

        // Use a more lenient approach - include words of 3 or more characters
        const modelKeywords = modelAnswer.split(/\s+/).filter(word => word.length >= 3);

        // Count matches, giving partial credit for partial matches
        let matchCount = 0;
        for (const keyword of modelKeywords) {
          if (studentAnswer.includes(keyword)) {
            matchCount += 1; // Full match
          } else if (keyword.length > 4) {
            // For longer words, check if at least 70% of the word is present
            const partialMatches = studentAnswer.split(/\s+/).filter(word =>
              word.length >= 3 &&
              (keyword.includes(word) || word.includes(keyword.substring(0, Math.floor(keyword.length * 0.7))))
            );
            if (partialMatches.length > 0) {
              matchCount += 0.5; // Partial match
            }
          }
        }

        // Calculate match percentage - NO minimum score guarantee
        const matchPercentage = modelKeywords.length > 0
          ? matchCount / modelKeywords.length
          : 0;

        // Assign score based on keyword match percentage
        const score = Math.round(matchPercentage * question.points);

        console.log(`Keyword matching details for question ${question._id}:`);
        console.log(`- Keywords found: ${matchCount} out of ${modelKeywords.length}`);
        console.log(`- Match percentage: ${Math.round(matchPercentage * 100)}%`);
        console.log(`- Score: ${score}/${question.points}`);

        // Generate appropriate feedback
        let feedback;
        if (score >= question.points * 0.8) {
          feedback = 'Excellent answer! Your response covers most of the key concepts expected by the AI grading system.';
        } else if (score >= question.points * 0.5) {
          feedback = 'Good answer! The AI has identified several important concepts in your response, but noted some gaps.';
        } else if (score >= question.points * 0.3) {
          feedback = 'Your answer touches on a few key points, but the AI grading system found that it needs more development.';
        } else if (score >= question.points * 0.1) {
          feedback = 'The AI identified minimal overlap with the expected answer. Review the model answer to see what you missed.';
        } else {
          feedback = 'Your answer differs significantly from what was expected. Compare with the model answer to understand the key concepts.';
        }

        // Add information about the model answer for transparency
        feedback += ` Compare your answer with the model answer to see what you might have missed.`;

        // Update the answer with fallback grading results
        const cappedScore = Math.min(Math.max(0, score || 0), question.points);
        result.answers[i].score = cappedScore;
        result.answers[i].feedback = `${feedback} (Note: This was graded using keyword matching due to AI unavailability)`;
        result.answers[i].isCorrect = cappedScore >= question.points * 0.7; // 70% threshold
        result.answers[i].correctedAnswer = formatCorrectAnswer(question.correctAnswer);

        // Add to total score
        totalScore += cappedScore;
      }
    }

    // Update the total score
    result.totalScore = totalScore;

    // Save the updated result
    await result.save();

    console.log(`Completed regrading for exam result ${resultId}, total score: ${totalScore}/${result.maxPossibleScore}`);

    return {
      resultId,
      oldScore,
      oldPercentage,
      totalScore,
      maxPossibleScore: result.maxPossibleScore,
      percentage: (totalScore / result.maxPossibleScore) * 100
    };
  } catch (error) {
    console.error(`Error regrading exam result ${resultId}:`, error);
    throw error;
  }
}

module.exports = {
  gradeExamWithAI,
  findAndGradeUngradedResults,
  regradeExamResult
};