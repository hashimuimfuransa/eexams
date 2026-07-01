// Import the centralized Groq client
const groqClient = require('./groqClient');

// Helper functions to avoid circular dependency
const parseAnswerContent = (answer) => {
  if (!answer || typeof answer !== 'string') {
    return { textContent: '', mathContent: '', codeContent: '' };
  }

  let textContent = answer;
  let mathContent = '';
  let codeContent = '';

  // Extract content from [MATH: ...] format
  const mathMatch = answer.match(/\[MATH:\s*(.*?)\]/);
  if (mathMatch) {
    mathContent = mathMatch[1].trim();
    textContent = textContent.replace(/\[MATH:\s*.*?\]/, '').trim();
  }

  // Extract content from [CODE: language\ncode] format
  const codeMatch = answer.match(/\[CODE:\s*(\w+)\s*\n([\s\S]*?)\]/);
  if (codeMatch) {
    codeContent = codeMatch[2].trim();
    textContent = textContent.replace(/\[CODE:\s*\w+\s*\n[\s\S]*?\]/, '').trim();
  }

  // Extract content from [DRAWING: ...] format (base64 data, ignore for grading)
  const drawingMatch = answer.match(/\[DRAWING:\s*([^\]]*)\]/);
  if (drawingMatch) {
    // Remove drawing data from content for text grading
    textContent = textContent.replace(/\[DRAWING:\s*[^\]]*\]/, '').trim();
  }

  // Extract content from [IMAGE_UPLOADED: ...] format (remove the tag, keep the text)
  const imageMatch = answer.match(/\[IMAGE_UPLOADED:\s*[^\]]*\]/);
  if (imageMatch) {
    textContent = textContent.replace(/\[IMAGE_UPLOADED:\s*[^\]]*\]/, '').trim();
  }

  // Extract final result from calculation patterns like "X + Y = Z" or "X * Y = Z"
  // This handles cases like "Depreciation:$54000+$25000 =$79000"
  const calcPattern = textContent.match(/(?:=|:)\s*([-\d,]+(?:\.\d+)?)\s*$/);
  if (calcPattern) {
    textContent = calcPattern[1].trim();
  }

  return { textContent, mathContent, codeContent };
};

const validateAnswerRelevance = (answer, questionText) => {
  if (!answer || answer.trim().length === 0) {
    return { isValid: false, reason: 'No answer provided.' };
  }

  const cleanAnswer = answer.trim().toLowerCase();

  // Check for meaningless answers like "I don't know", "no idea", etc.
  const meaninglessPatterns = [
    /^(i\s+don'?t\s+know|dont\s+know|don'?t\s+know\s+it|dont\s+know\s+it|no\s+idea|i\s+have\s+no\s+idea|not\s+sure|unsure|i\s+don'?t\s+understand|dont\s+understand)$/i,
    /^(i\s+do\s+not\s+know|i\s+do\s+not\s+understand|i\s+have\s+no\s+clue|no\s+clue)$/i,
    /^(skip|pass|n\/a|none|nothing|answer|question)$/i,
    /^(please\s+help|help\s+me|idk)$/i
  ];

  for (const pattern of meaninglessPatterns) {
    if (pattern.test(cleanAnswer)) {
      return { isValid: false, reason: 'Your answer indicates you do not know the answer. Please review the material and provide a proper response.' };
    }
  }

  // Check for placeholder answers
  const placeholderPatterns = [
    /^(answer|answer:|the answer is|the answer is:)$/i,
    /^(solution|solution:|the solution is|the solution is:)$/i,
    /^(response|response:|my response|my response:)$/i
  ];

  for (const pattern of placeholderPatterns) {
    if (pattern.test(cleanAnswer)) {
      return { isValid: false, reason: 'Your answer is just a placeholder. Please provide a complete answer.' };
    }
  }

  // Allow short answers for calculation/math questions or numerical answers
  // Only reject if it's extremely short (< 2 chars) and not a number
  if (cleanAnswer.length < 2 && !/^\d+$/.test(cleanAnswer)) {
    return { isValid: false, reason: 'Answer too brief.' };
  }

  // For very short answers (less than 10 chars) that are not numerical, 
  // mark as potentially needing AI evaluation but don't reject completely
  if (cleanAnswer.length < 10 && !/^\d+$/.test(cleanAnswer)) {
    return { isValid: true, needsLenientGrading: true, reason: 'Answer is brief - use lenient grading' };
  }

  return { isValid: true };
};

/**
 * Enhanced AI grading system with improved accuracy and reliability
 * OPTIMIZED: Reduced work and faster processing
 * @param {string} studentAnswer - The student's answer
 * @param {string} modelAnswer - The model answer to compare against
 * @param {number} maxPoints - Maximum points for the question
 * @param {string} questionText - The original question text for context
 * @param {string} questionType - Type of question (multiple-choice, open-ended, etc.)
 * @returns {Object} - Score, feedback, and detailed analysis
 */
const gradeOpenEndedAnswer = async (studentAnswer, modelAnswer, maxPoints, questionText = '', questionType = 'open-ended', section = 'B') => {
  try {
    console.log(`Starting enhanced AI grading for ${questionType} question in section ${section}...`);

    // Parse answer content to extract actual text from [MATH: ...], [CODE: ...], and [DRAWING: ...] formats
    const { textContent, mathContent, codeContent } = parseAnswerContent(studentAnswer || '');

    // Combine all content for grading (text + math + code)
    const combinedAnswer = [textContent, mathContent, codeContent].filter(Boolean).join('\n\n');

    // Validate answer relevance before grading
    const relevanceCheck = validateAnswerRelevance(combinedAnswer, questionText);
    if (!relevanceCheck.isValid) {
      console.log(`❌ Answer validation failed: ${relevanceCheck.reason}`);
      return {
        score: 0,
        feedback: `Your answer appears to be invalid: ${relevanceCheck.reason}. Please provide a proper answer to the question.`,
        correctedAnswer: modelAnswer || 'No model answer available',
        details: {
          questionType: questionType,
          gradingMethod: 'answer_validation_failed',
          validationReason: relevanceCheck.reason
        }
      };
    }

    // If answer needs lenient grading (brief or mathematical), add note to prompt
    let lenientGradingNote = '';
    if (relevanceCheck.needsLenientGrading) {
      console.log(`⚠️ Answer marked for lenient grading: ${relevanceCheck.reason}`);
      lenientGradingNote = '\n\nNOTE: This answer is brief or mathematical. Be lenient and award partial credit if the approach is correct, even if the answer is incomplete.';
    }

    // Enhanced input validation
    if (!combinedAnswer || typeof combinedAnswer !== 'string' || combinedAnswer.trim().length === 0) {
      return {
        score: 0,
        feedback: 'No answer provided',
        correctedAnswer: modelAnswer || 'No model answer available',
        details: {
          questionType: questionType,
          gradingMethod: 'no_answer',
          error: 'Empty or invalid student answer'
        }
      };
    }

    // Validate maxPoints
    if (!maxPoints || maxPoints <= 0) {
      console.warn('Invalid maxPoints provided, defaulting to 1');
      maxPoints = 1;
    }

    // Clean and prepare inputs with better sanitization
    const cleanStudentAnswer = String(combinedAnswer).trim().replace(/\s+/g, ' ');
    const cleanModelAnswer = String(modelAnswer || '').trim().replace(/\s+/g, ' ');
    const cleanQuestionText = String(questionText || '').trim().replace(/\s+/g, ' ');

    // OPTIMIZED: Fast path for exact matches - skip AI entirely
    if (cleanStudentAnswer.toLowerCase() === cleanModelAnswer.toLowerCase()) {
      console.log('✅ Exact match detected, skipping AI grading');
      return {
        score: maxPoints,
        feedback: 'Your answer is exactly correct!',
        correctedAnswer: modelAnswer,
        details: {
          questionType: questionType,
          gradingMethod: 'exact_match',
          aiGraded: false
        }
      };
    }

    // Enhanced model answer validation - be more lenient for sections B & C
    if (!cleanModelAnswer ||
        cleanModelAnswer === 'Not provided' ||
        cleanModelAnswer === 'Sample answer') {
      console.log('No valid model answer provided, using AI-based grading approach');

      // For sections B & C, use AI to generate a comprehensive evaluation even without model answer
      return await gradeWithoutModelAnswer(cleanStudentAnswer, cleanQuestionText, maxPoints, questionType);
    }

    // For fill-in-blank questions, be more lenient with short answers
    if (questionType === 'fill-in-blank') {
      // For fill-in-blank, short answers are often correct (like "CPU", "RAM", etc.)
      // Only check if answer is extremely short (1 character) or empty
      if (cleanStudentAnswer.length < 2) {
        return {
          score: 0,
          feedback: 'Your answer is too brief. Please provide a complete answer.',
          correctedAnswer: cleanModelAnswer,
          details: {
            questionType: questionType,
            gradingMethod: 'too_brief',
            answerLength: cleanStudentAnswer.length
          }
        };
      }
    } else {
      // For other question types (open-ended, etc.), reject very short answers with 0 points
      if (cleanStudentAnswer.length < 10) {
        return {
          score: 0,
          feedback: 'Your answer is too brief. Open-ended questions require detailed explanations showing your work and reasoning. Please provide a complete answer.',
          correctedAnswer: cleanModelAnswer,
          details: {
            questionType: questionType,
            gradingMethod: 'too_brief',
            answerLength: cleanStudentAnswer.length
          }
        };
      }
    }

    // Use Groq client for grading with JSON mode
    try {
      console.log('Sending grading request to Groq API...');

      const result = await groqClient.gradeAnswer(
        cleanQuestionText || 'Question not provided',
        cleanStudentAnswer,
        cleanModelAnswer,
        maxPoints,
        { questionType, section }
      );

      console.log('Received grading response from Groq API');

      return {
        score: Math.round(result.score * 100) / 100,
        feedback: result.feedback,
        correctedAnswer: result.correctedAnswer || modelAnswer || 'Model answer not available',
        details: {
          keyConceptsPresent: result.keyConceptsPresent || [],
          keyConceptsMissing: result.keyConceptsMissing || [],
          confidenceLevel: result.confidenceLevel || 'medium',
          questionType: questionType,
          gradingMethod: 'groq_ai',
          aiGraded: true
        }
      };
    } catch (aiError) {
      console.error('Error generating AI content with Groq:', aiError);
      throw aiError; // Rethrow to be caught by the outer try/catch
    }
  } catch (error) {
    console.error('Error using AI grading:', error);
    return generateFallbackScore(studentAnswer, modelAnswer, maxPoints, error.message, questionText);
  }
};

/**
 * Detect if question has multiple parts
 * @param {string} questionText - The question text
 * @returns {Object} - Detection result
 */
const detectMultiPartQuestion = (questionText) => {
  if (!questionText) return { isMultiPart: false, expectedParts: 1 };

  const letterParts = questionText.match(/\b[\(\[]?[a-z][\)\]]?[\s\.:]/gi);
  const romanParts = questionText.match(/\b[\(\[]?i{1,3}[\)\]]?[\s\.:]/gi);

  const allParts = [...(letterParts || []), ...(romanParts || [])];
  const uniqueParts = new Set(allParts.map(p => p.toLowerCase().replace(/[\(\)\[\]\s\.:]/g, '')));

  const marksPattern = questionText.match(/\(\s*\d+\s*(?:mark|marks)\s*\)/gi);
  const totalMarks = marksPattern ? marksPattern.reduce((sum, m) => {
    const num = parseInt(m.match(/\d+/)[0]);
    return sum + num;
  }, 0) : 0;

  return {
    isMultiPart: uniqueParts.size > 1 || totalMarks > 1,
    expectedParts: Math.max(uniqueParts.size, 1),
    totalMarks: totalMarks,
    detectedParts: Array.from(uniqueParts)
  };
};

/**
 * Validate multi-part answer completeness
 * @param {string} studentAnswer - Student's answer
 * @param {Object} multiPartInfo - Multi-part question info
 * @returns {Object} - Validation result
 */
const validateMultiPartAnswer = (studentAnswer, multiPartInfo) => {
  if (!multiPartInfo.isMultiPart || !studentAnswer) {
    return { isValid: true, partsFound: 1, partsMissing: 0, completeness: 1 };
  }

  const answer = studentAnswer.toLowerCase();
  const partsFound = multiPartInfo.detectedParts.filter(part => {
    const partPatterns = [
      new RegExp(`\\b${part}\\s*[\.\),:=-]`, 'i'),
      new RegExp(`\\(${part}\\)`, 'i'),
      new RegExp(`\\[${part}\\]`, 'i')
    ];
    return partPatterns.some(pattern => pattern.test(answer));
  }).length;

  const completeness = partsFound / multiPartInfo.expectedParts;

  return {
    isValid: completeness >= 0.5,
    partsFound,
    partsMissing: multiPartInfo.expectedParts - partsFound,
    completeness
  };
};

/**
 * Generate enhanced fallback score when AI grading fails
 * @param {string} studentAnswer - The student's answer
 * @param {string} modelAnswer - The model answer
 * @param {number} maxPoints - Maximum points
 * @param {string} errorReason - Reason for fallback
 * @param {string} questionText - The question text
 * @returns {Object} - Fallback grading result
 */
const generateFallbackScore = (studentAnswer, modelAnswer, maxPoints, errorReason, questionText = '') => {
  console.log('Generating enhanced fallback score...');

  // Check for multi-part questions
  const multiPartInfo = detectMultiPartQuestion(questionText);
  const multiPartValidation = validateMultiPartAnswer(studentAnswer, multiPartInfo);

  // Only reject severely incomplete answers (< 25%)
  if (multiPartInfo.isMultiPart && multiPartValidation.completeness < 0.25) {
    return {
      score: 0,
      feedback: `Incomplete answer. You addressed only ${multiPartValidation.partsFound} of ${multiPartInfo.expectedParts} required parts. Please answer all parts of the question.`,
      correctedAnswer: modelAnswer || '',
      details: {
        gradingMethod: 'incomplete_multipart',
        partsFound: multiPartValidation.partsFound,
        partsExpected: multiPartInfo.expectedParts,
        errorReason: errorReason
      }
    };
  }

  // Parse answer content to extract actual text from special formats
  const { textContent, mathContent, codeContent } = parseAnswerContent(studentAnswer || '');

  // Combine all content for grading (text + math + code)
  const combinedAnswer = [textContent, mathContent, codeContent].filter(Boolean).join('\n\n');

  // Validate answer relevance before fallback grading
  const relevanceCheck = validateAnswerRelevance(combinedAnswer, '');
  if (!relevanceCheck.isValid) {
    console.log(`❌ Fallback grading validation failed: ${relevanceCheck.reason}`);
    return {
      score: 0,
      feedback: `Your answer appears to be invalid: ${relevanceCheck.reason}. Please provide a proper answer to the question.`,
      correctedAnswer: modelAnswer || '',
      details: {
        gradingMethod: 'fallback_validation_failed',
        validationReason: relevanceCheck.reason,
        errorReason: errorReason
      }
    };
  }

  // Enhanced fallback grading mechanism
  const studentAns = String(combinedAnswer || '').toLowerCase().trim();
  const modelAns = String(modelAnswer || '').toLowerCase().trim();

  // Handle empty student answer
  if (!studentAns) {
    return {
      score: 0,
      feedback: 'No answer provided',
      correctedAnswer: modelAnswer || '',
      details: {
        gradingMethod: 'fallback_no_answer',
        errorReason: errorReason
      }
    };
  }

  // Handle empty model answer - evaluate based on demonstrated understanding
  if (!modelAns) {
    // When no model answer is available, only give credit if the answer shows substantial effort
    const answerLength = cleanStudentAns.length;

    // For very short answers (less than 20 chars), give 0 marks
    if (answerLength < 20) {
      return {
        score: 0,
        feedback: 'Your answer is too brief. Please provide a complete answer with working shown.',
        correctedAnswer: '',
        details: {
          gradingMethod: 'fallback_no_model_too_short',
          errorReason: 'No model answer provided and answer too brief'
        }
      };
    }

    // For answers that are mostly just numbers/labels without explanation
    const hasExplanatoryText = /[a-zA-Z]{3,}/.test(cleanStudentAns) &&
                               (cleanStudentAns.includes(' ') || cleanStudentAns.includes(','));
    const isJustNumbers = /^\d+[\s,]*\d*[\s,]*\d*$/.test(cleanStudentAns.replace(/[a-j]\s*/g, ''));

    if (isJustNumbers || !hasExplanatoryText) {
      return {
        score: 0,
        feedback: 'Your answer appears to be incomplete. Please show your working and provide explanations for each part of the question.',
        correctedAnswer: '',
        details: {
          gradingMethod: 'fallback_no_model_no_working',
          errorReason: 'No model answer provided and no working shown'
        }
      };
    }

    // For substantial answers without model answer, give minimal credit (10% max for effort)
    // But cap it very low since we can't verify correctness
    const score = Math.min(Math.round(maxPoints * 0.1), 1);
    return {
      score: score,
      feedback: 'Answer provided but cannot be fully evaluated due to missing model answer. Minimal credit given for effort only.',
      correctedAnswer: '',
      details: {
        gradingMethod: 'fallback_no_model',
        errorReason: 'No model answer provided'
      }
    };
  }

  // First check for exact match (case-insensitive and ignoring extra whitespace)
  if (studentAns === modelAns) {
    console.log('Exact match found between student answer and model answer!');
    return {
      score: maxPoints,
      feedback: 'Your answer is exactly correct! It matches the expected answer perfectly.',
      correctedAnswer: modelAnswer,
      details: {
        matchPercentage: 1.0,
        exactMatch: true,
        gradingMethod: 'fallback_exact_match',
        errorReason: errorReason
      }
    };
  }

  // Enhanced semantic matching for abbreviations and expansions
  const cleanStudentAns = studentAns.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").replace(/\s+/g, " ").trim();
  const cleanModelAns = modelAns.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").replace(/\s+/g, " ").trim();

  // Check for exact match after cleaning
  if (cleanStudentAns === cleanModelAns) {
    console.log('Exact match found after cleaning punctuation!');
    return {
      score: maxPoints,
      feedback: 'Your answer is correct! It matches the expected answer.',
      correctedAnswer: modelAnswer,
      details: {
        matchPercentage: 1.0,
        exactMatch: true,
        gradingMethod: 'fallback_exact_match_cleaned',
        errorReason: errorReason
      }
    };
  }

  // Bare numeric answers (e.g. "39") must be checked against the model's actual numeric
  // result rather than treated as text abbreviations/phrases below - otherwise a wrong
  // number that happens to appear elsewhere in the model answer's working (e.g. a given
  // value used mid-calculation) gets falsely matched and awarded full points.
  const isBareNumericAnswer = /^[$€£¥₹]?\s*-?[\d,]+(\.\d+)?\s*[a-z%°]{0,4}\.?$/i.test(cleanStudentAns);

  // Check if student answer is contained in model answer (abbreviation case)
  // e.g., "WAN" is contained in "WAN (Wide Area Network)"
  if (!isBareNumericAnswer && cleanModelAns.includes(cleanStudentAns) && cleanStudentAns.length >= 2) {
    console.log('Student answer is an abbreviation of the model answer!');
    return {
      score: maxPoints,
      feedback: 'Your answer is correct! You provided the correct abbreviation.',
      correctedAnswer: modelAnswer,
      details: {
        matchPercentage: 1.0,
        abbreviationMatch: true,
        gradingMethod: 'fallback_abbreviation_match',
        errorReason: errorReason
      }
    };
  }

  // Check if model answer is contained in student answer (expansion case)
  // e.g., "Wide Area Network" contains "WAN"
  if (!isBareNumericAnswer && cleanStudentAns.includes(cleanModelAns) && cleanModelAns.length >= 2) {
    console.log('Student answer is an expansion of the model answer!');
    return {
      score: maxPoints,
      feedback: 'Your answer is correct! You provided the expanded form.',
      correctedAnswer: modelAnswer,
      details: {
        matchPercentage: 1.0,
        expansionMatch: true,
        gradingMethod: 'fallback_expansion_match',
        errorReason: errorReason
      }
    };
  }

  // Check for common technical abbreviations and their expansions
  const technicalMappings = {
    'wan': ['wide area network', 'wan (wide area network)'],
    'lan': ['local area network', 'lan (local area network)'],
    'cpu': ['central processing unit', 'cpu (central processing unit)', 'processor'],
    'ram': ['random access memory', 'ram (random access memory)', 'memory'],
    'rom': ['read only memory', 'rom (read only memory)'],
    'os': ['operating system', 'os (operating system)'],
    'hdd': ['hard disk drive', 'hdd (hard disk drive)', 'hard disk'],
    'ssd': ['solid state drive', 'ssd (solid state drive)'],
    'usb': ['universal serial bus', 'usb (universal serial bus)'],
    'url': ['uniform resource locator', 'url (uniform resource locator)'],
    'html': ['hypertext markup language', 'html (hypertext markup language)'],
    'http': ['hypertext transfer protocol', 'http (hypertext transfer protocol)'],
    'ftp': ['file transfer protocol', 'ftp (file transfer protocol)']
  };

  // Check if there's a semantic match using technical mappings
  for (const [abbrev, expansions] of Object.entries(technicalMappings)) {
    if (cleanStudentAns === abbrev && expansions.some(exp => cleanModelAns.includes(exp))) {
      console.log(`Found semantic match: ${cleanStudentAns} matches ${cleanModelAns}`);
      return {
        score: maxPoints,
        feedback: 'Your answer is correct! You used the correct technical abbreviation.',
        correctedAnswer: modelAnswer,
        details: {
          matchPercentage: 1.0,
          semanticMatch: true,
          gradingMethod: 'fallback_semantic_match',
          errorReason: errorReason
        }
      };
    }

    if (expansions.includes(cleanStudentAns) && cleanModelAns === abbrev) {
      console.log(`Found semantic match: ${cleanStudentAns} matches ${cleanModelAns}`);
      return {
        score: maxPoints,
        feedback: 'Your answer is correct! You provided the full technical term.',
        correctedAnswer: modelAnswer,
        details: {
          matchPercentage: 1.0,
          semanticMatch: true,
          gradingMethod: 'fallback_semantic_match',
          errorReason: errorReason
        }
      };
    }
  }

  // For bare numeric answers that didn't match above, don't fall through to phrase/word
  // overlap matching - a lone number can spuriously overlap with unrelated digits inside
  // the model answer's working and get credited as if it covered the model's concepts.
  if (isBareNumericAnswer) {
    return {
      score: 0,
      feedback: `Your answer (${studentAnswer}) does not match the expected result (${modelAnswer}).`,
      correctedAnswer: modelAnswer,
      details: {
        matchPercentage: 0,
        gradingMethod: 'numerical_mismatch',
        errorReason: errorReason
      }
    };
  }

  // Check if student answer contains key phrases from model answer
  // Use semantic matching instead of strict keyword counting
  // Extract meaningful phrases (3+ words) instead of individual words
  const modelPhrases = modelAns.match(/\b[\w\s]{10,}\b/g) || [modelAns];
  const modelKeywords = modelAns.split(/\s+/).filter(word => word.length >= 4);

  // First, check for semantic equivalence of the entire answer
  // If student answer meaning is equivalent, award full points
  const studentPhrases = studentAns.match(/\b[\w\s]{8,}\b/g) || [studentAns];

  // Check if student covers the main concepts semantically
  let semanticMatchScore = 0;
  let conceptCount = 0;

  // For each phrase in model answer, check if student has semantically equivalent content
  for (const phrase of modelPhrases) {
    conceptCount++;
    const phraseLower = phrase.toLowerCase().trim();
    let conceptMatched = false;

    // Direct phrase match
    if (studentAns.includes(phraseLower) || phraseLower.includes(studentAns)) {
      conceptMatched = true;
    }

    // Check for semantic equivalence using common patterns
    // e.g., "help body to grow" ≈ "helps growth and body building"
    // e.g., "prevent disease" ≈ "protects the body from diseases"
    if (!conceptMatched) {
      const studentWords = studentAns.split(/\s+/);
      const phraseWords = phraseLower.split(/\s+/);
      const wordOverlap = studentWords.filter(w => phraseWords.some(pw => pw.includes(w) || w.includes(pw))).length;
      if (wordOverlap >= Math.min(2, phraseWords.length)) {
        conceptMatched = true;
      }
    }

    if (conceptMatched) {
      semanticMatchScore++;
    }
  }

  // If semantic match is high, use that instead of keyword counting
  if (conceptCount > 0 && semanticMatchScore / conceptCount >= 0.6) {
    const semanticPercentage = semanticMatchScore / conceptCount;
    console.log(`Semantic matching: ${semanticMatchScore}/${conceptCount} concepts matched (${Math.round(semanticPercentage * 100)}%)`);

    // Award points based on semantic coverage
    let score = Math.round(semanticPercentage * maxPoints);

    // Ensure minimum of 50% if at least 60% of concepts are covered semantically
    if (semanticPercentage >= 0.6 && score < maxPoints * 0.5) {
      score = Math.round(maxPoints * 0.5);
    }

    return {
      score: score,
      feedback: semanticPercentage >= 0.9
        ? 'Your answer covers all the main concepts correctly!'
        : semanticPercentage >= 0.6
        ? `Your answer covers ${semanticMatchScore} of ${conceptCount} main concepts. Good understanding shown.`
        : `Your answer touches on some concepts but needs more completeness.`,
      correctedAnswer: modelAnswer,
      details: {
        matchPercentage: semanticPercentage,
        conceptsMatched: semanticMatchScore,
        totalConcepts: conceptCount,
        gradingMethod: 'fallback_semantic_matching',
        errorReason: errorReason
      }
    };
  }

  // Fallback to keyword matching if semantic matching doesn't work well
  // Use a more lenient approach - include words of 3 or more characters
  let matchCount = 0;
  for (const keyword of modelKeywords) {
    if (studentAns.includes(keyword)) {
      matchCount += 1; // Full match
    } else if (keyword.length > 4) {
      // For longer words, check if at least 70% of the word is present
      const partialMatches = studentAns.split(/\s+/).filter(word =>
        word.length >= 3 &&
        (keyword.includes(word) || word.includes(keyword.substring(0, Math.floor(keyword.length * 0.7))))
      );
      if (partialMatches.length > 0) {
        matchCount += 0.5; // Partial match
      }
    }
  }

  // Calculate match percentage with flexible scoring - award partial credit for demonstrated understanding
  const matchPercentage = modelKeywords.length > 0
    ? matchCount / modelKeywords.length
    : 0;

  // Assign base score
  let score = Math.round(matchPercentage * maxPoints);

  // Apply multi-part scaling - cap at proportional limit for answered parts
  if (multiPartInfo.isMultiPart && multiPartValidation.completeness < 1.0 && multiPartValidation.completeness >= 0.25) {
    const proportionalScore = Math.round(maxPoints * multiPartValidation.completeness);
    const cappedScore = Math.min(score, proportionalScore);
    console.log(`Fallback multi-part scaling: ${score} -> ${cappedScore} (max ${Math.round(multiPartValidation.completeness * 100)}% for ${multiPartValidation.partsFound}/${multiPartInfo.expectedParts} parts)`);
    score = cappedScore;
  }

  // For very poor matches (less than 20%), give 0 marks
  if (score === 0 && matchPercentage < 0.2) {
    return {
      score: 0,
      feedback: 'Your answer does not contain the key concepts expected for this question. Please review the question and provide a more complete answer.',
      correctedAnswer: modelAnswer,
      details: {
        matchPercentage: matchPercentage,
        keywordsFound: matchCount,
        totalKeywords: modelKeywords.length,
        gradingMethod: 'fallback_keyword_matching_poor',
        errorReason: errorReason,
        multiPartInfo,
        multiPartValidation
      }
    };
  }

  // Generate appropriate feedback based on score
  let feedback;
  if (score >= maxPoints * 0.8) {
    feedback = 'Your answer covers most of the key concepts from the model answer.';
  } else if (score >= maxPoints * 0.5) {
    feedback = 'Your answer includes some important concepts, but is missing others.';
  } else if (score >= maxPoints * 0.3) {
    feedback = 'Your answer touches on a few key points, but needs more development.';
  } else {
    feedback = 'Your answer is missing most of the key concepts expected in the model answer. Please provide a more complete answer with working shown.';
  }

  console.log(`Applied fallback grading with score: ${score}/${maxPoints} (${Math.round(matchPercentage * 100)}% match)`);

  return {
    score: score,
    feedback: `${feedback} (Note: This was graded using keyword matching due to AI grading unavailability)`,
    correctedAnswer: modelAnswer,
    details: {
      matchPercentage: matchPercentage,
      keywordsFound: matchCount,
      totalKeywords: modelKeywords.length,
      gradingMethod: 'fallback_keyword_matching',
      errorReason: errorReason
    }
  };
};

/**
 * Extract technical terms from student answer
 */
const extractTechnicalTerms = (text) => {
  const technicalTerms = [
    'cpu', 'ram', 'rom', 'gpu', 'motherboard', 'processor', 'memory',
    'wan', 'lan', 'network', 'router', 'switch', 'protocol', 'tcp', 'ip',
    'html', 'css', 'javascript', 'database', 'sql', 'server', 'client',
    'operating system', 'os', 'windows', 'linux', 'software', 'hardware',
    'algorithm', 'data structure', 'programming', 'coding', 'debugging',
    'compiler', 'interpreter', 'variable', 'function', 'loop', 'array',
    'object', 'class', 'inheritance', 'polymorphism', 'encapsulation',
    'binary', 'decimal', 'hexadecimal', 'bit', 'byte', 'kilobyte', 'megabyte',
    'input', 'output', 'storage', 'cache', 'buffer', 'register',
    'transistor', 'capacitor', 'resistor', 'diode', 'circuit', 'voltage',
    'current', 'power', 'frequency', 'bandwidth', 'latency', 'throughput'
  ];

  const lowerText = text.toLowerCase();
  return technicalTerms.filter(term => lowerText.includes(term));
};

/**
 * Grade answers without model answer using AI analysis
 */
const gradeWithoutModelAnswer = async (studentAnswer, questionText, maxPoints, questionType) => {
  try {
    console.log('🤖 Grading without model answer using AI analysis');

    // Don't reject answers based on length or format - let AI evaluate them
    // Only reject truly empty answers
    if (!studentAnswer || studentAnswer.trim().length === 0) {
      console.log(`Answer is empty, rejecting without AI grading`);
      return {
        score: 0,
        feedback: 'No answer provided.',
        correctedAnswer: 'Model answer not available',
        details: {
          questionType: questionType,
          gradingMethod: 'empty_answer',
          answerLength: studentAnswer?.length || 0
        }
      };
    }

    // Truncate long inputs to prevent timeout
    const MAX_LENGTH = 1500;
    const truncatedQuestion = questionText.length > MAX_LENGTH ? questionText.substring(0, MAX_LENGTH) + '...' : questionText;
    const truncatedAnswer = studentAnswer.length > MAX_LENGTH ? studentAnswer.substring(0, MAX_LENGTH) + '...' : studentAnswer;

    // Create a focused, fast AI prompt for grading without model answer with proper guidelines
    const prompt = `You are an expert exam grader. Grade the following student answer to a question.

Question: ${truncatedQuestion}
Question Type: ${questionType}

Student Answer: ${truncatedAnswer}

Please grade this answer on a scale of 0 to ${maxPoints} points.

FLEXIBLE GRADING GUIDELINES (No Model Answer Available):
1. Evaluate the answer based on correctness, completeness, and understanding of the question
2. Award full points for semantically correct answers, even with minor wording, capitalization, or pluralization differences
3. Award partial credit (30-70%) for answers that show partial understanding or are mostly correct but missing details
4. For calculation questions: Extract the final numerical result and verify it's correct. Correct method with wrong result = 30-50% partial credit
5. For brief answers: Be lenient - award partial credit if the approach is correct, even if incomplete
6. Mathematical expressions are acceptable for calculation questions - evaluate the numerical result
7. For explanation questions: Look for key concepts, logical reasoning, and completeness
8. NO MINIMUM CREDIT - do not give automatic points for effort alone, but award partial credit for correct approach
${lenientGradingNote}

Return JSON with this exact structure:
{
  "score": [number between 0 and ${maxPoints}],
  "feedback": "[detailed feedback explaining the score, what was good and what could be improved]",
  "correctedAnswer": "[provide the correct answer based on your knowledge]",
  "keyConceptsPresent": ["concept1", "concept2"],
  "keyConceptsMissing": ["concept3", "concept4"],
  "confidenceLevel": "[high|medium|low]",
  "technicalAccuracy": "[assessment of technical correctness]"
}

IMPORTANT: Only return valid JSON, no additional text outside the JSON.`;

    // Use Groq client for grading without model answer
    const response = await groqClient.generateContent(prompt, {
      model: 'smart',
      jsonMode: true,
      temperature: 0.2,
      maxTokens: 2048
    });

    // Process the AI response
    let grading = response.parsedContent;
    if (!grading && response.text) {
      try {
        const jsonMatch = response.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          grading = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        console.error('Failed to parse grading JSON:', e);
      }
    }

    if (!grading) {
      throw new Error('Invalid AI response format');
    }

    try {
      // Apply multi-part validation for gradeWithoutModelAnswer
      const multiPartInfo = detectMultiPartQuestion(questionText);
      const multiPartValidation = validateMultiPartAnswer(studentAnswer, multiPartInfo);

      let finalScore = Math.round(grading.score * 100) / 100;

      // Apply multi-part scaling - cap at proportional limit
      if (multiPartInfo.isMultiPart && multiPartValidation.completeness < 1.0 && multiPartValidation.completeness >= 0.25) {
        const proportionalScore = Math.round(maxPoints * multiPartValidation.completeness);
        finalScore = Math.min(finalScore, proportionalScore);
        console.log(`gradeWithoutModelAnswer multi-part scaling: ${grading.score} -> ${finalScore} (max ${Math.round(multiPartValidation.completeness * 100)}% for ${multiPartValidation.partsFound}/${multiPartInfo.expectedParts} parts)`);
      }

      return {
        score: finalScore,
        feedback: grading.feedback || 'AI analysis completed',
        correctedAnswer: grading.correctedAnswer || 'Model answer generated by AI analysis',
        details: {
          keyConceptsPresent: grading.keyConceptsPresent || [],
          keyConceptsMissing: grading.keyConceptsMissing || [],
          confidenceLevel: grading.confidenceLevel || 'medium',
          technicalAccuracy: grading.technicalAccuracy || 'Assessed by AI',
          improvementSuggestions: grading.improvementSuggestions || [],
          questionType: questionType,
          gradingMethod: 'ai_without_model_answer',
          aiGraded: true,
          multiPartInfo,
          multiPartValidation
        }
      };
    } catch (parseError) {
      console.error('Error parsing AI response for no-model grading:', parseError);
      console.log('Failed to parse JSON, raw response:', responseText.substring(0, 200) + '...');

      // Enhanced fallback: Analyze the student answer for technical content
      const technicalTerms = extractTechnicalTerms(studentAnswer);
      const answerLength = studentAnswer.length;

      // Calculate score based on answer quality indicators
      let score = Math.round(maxPoints * 0.4); // Base score

      // Bonus for technical terms
      if (technicalTerms.length > 0) {
        score += Math.min(Math.round(maxPoints * 0.2), maxPoints - score);
      }

      // Bonus for substantial answer length
      if (answerLength > 50) {
        score += Math.min(Math.round(maxPoints * 0.1), maxPoints - score);
      }

      return {
        score: Math.min(score, maxPoints),
        feedback: `Your answer demonstrates understanding of the topic. Technical terms identified: ${technicalTerms.join(', ') || 'none'}. AI detailed analysis was unavailable.`,
        correctedAnswer: 'Please refer to course materials for complete answer guidance',
        details: {
          questionType: questionType,
          gradingMethod: 'enhanced_fallback_no_model',
          technicalTermsFound: technicalTerms,
          answerLength: answerLength,
          aiGraded: false
        }
      };
    }
  } catch (error) {
    console.error('Error in AI grading without model answer:', error);

    // Final fallback - minimal score since we can't verify
    const score = 0;
    return {
      score: score,
      feedback: 'Unable to grade answer automatically. Please ensure you provide complete answers with all required parts addressed.',
      correctedAnswer: 'Model answer not available',
      details: {
        questionType: questionType,
        gradingMethod: 'fallback_no_model',
        error: error.message
      }
    };
  }
};

/**
 * Generate model answers for questions using AI
 * @param {Array} questions - Array of question objects with text, type, options
 * @returns {Promise<Object>} - Object mapping question IDs to model answers and guidelines
 */
const generateModelAnswers = async (questions) => {
  try {
    console.log(`🤖 Generating AI model answers for ${questions.length} questions...`);

    const modelAnswers = {};

    // Process questions in batches to avoid overwhelming the API
    const batchSize = 5;
    for (let i = 0; i < questions.length; i += batchSize) {
      const batch = questions.slice(i, i + batchSize);
      
      for (const question of batch) {
        try {
          const questionId = question._id || question.id || `q_${i}`;
          const questionText = question.text || '';
          const questionType = question.type || 'open-ended';
          const options = question.options || [];

          console.log(`Generating model answer for question: ${questionText.substring(0, 50)}...`);

          // Build prompt based on question type
          let prompt = '';
          
          if (questionType === 'multiple-choice' && options.length > 0) {
            prompt = `You are an expert educator. Analyze the following multiple-choice question and provide the correct answer with explanation.

Question: ${questionText}

Options:
${options.map((opt, idx) => `${String.fromCharCode(65 + idx)}. ${opt.text || opt}`).join('\n')}

Please provide:
1. The correct answer letter (A, B, C, D, etc.)
2. A detailed explanation of why this is the correct answer
3. Common misconceptions students might have
4. Grading guidelines for partial credit (if applicable)

Return your response as valid JSON with this structure:
{
  "correctAnswer": "[letter of correct answer]",
  "answerText": "[the full text of the correct answer]",
  "explanation": "[detailed explanation]",
  "misconceptions": ["misconception1", "misconception2"],
  "gradingGuidelines": "[guidelines for grading]"
}`;
          } else if (questionType === 'open-ended' || questionType === 'short-answer' || questionType === 'essay') {
            prompt = `You are an expert educator. Provide a model answer and grading guidelines for the following question.

Question: ${questionText}
Question Type: ${questionType}

Please provide:
1. A comprehensive model answer that demonstrates full understanding
2. Key concepts that should be included in a good answer
3. Grading rubric with point allocation
4. Common mistakes students make
5. Minimum requirements for partial credit

Return your response as valid JSON with this structure:
{
  "modelAnswer": "[comprehensive model answer]",
  "keyConcepts": ["concept1", "concept2", "concept3"],
  "gradingRubric": "[detailed rubric with point allocation]",
  "commonMistakes": ["mistake1", "mistake2"],
  "minimumRequirements": "[requirements for partial credit]"
}`;
          } else if (questionType === 'true-false') {
            prompt = `You are an expert educator. Analyze the following true/false question and provide the correct answer with explanation.

Question: ${questionText}

Please provide:
1. The correct answer (True or False)
2. A detailed explanation of why this is correct
3. Common misconceptions

Return your response as valid JSON with this structure:
{
  "correctAnswer": "True or False",
  "explanation": "[detailed explanation]",
  "misconceptions": ["misconception1", "misconception2"]
}`;
          } else {
            // Generic fallback for other question types
            prompt = `You are an expert educator. Provide a model answer and grading guidelines for the following question.

Question: ${questionText}
Question Type: ${questionType}

Please provide:
1. A comprehensive model answer
2. Key concepts that should be included
3. Grading guidelines

Return your response as valid JSON with this structure:
{
  "modelAnswer": "[comprehensive model answer]",
  "keyConcepts": ["concept1", "concept2"],
  "gradingGuidelines": "[grading guidelines]"
}`;
          }

          // Call Groq API to generate model answer
          const response = await groqClient.generateContent(prompt, {
            systemPrompt: 'You are an expert educator with deep knowledge across all academic subjects. Provide accurate, comprehensive model answers and clear grading guidelines.',
            model: 'smart',
            jsonMode: true,
            temperature: 0.3,
            maxTokens: 2048
          });

          // Parse the response
          let generatedAnswer = response.parsedContent;
          if (!generatedAnswer && response.text) {
            try {
              const jsonMatch = response.text.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                generatedAnswer = JSON.parse(jsonMatch[0]);
              }
            } catch (e) {
              console.error('Failed to parse model answer JSON:', e);
            }
          }

          if (generatedAnswer) {
            // Extract the appropriate answer text based on question type
            let answerText = '';
            if (questionType === 'multiple-choice') {
              answerText = generatedAnswer.answerText || generatedAnswer.correctAnswer || '';
            } else if (questionType === 'true-false') {
              answerText = generatedAnswer.correctAnswer || '';
            } else {
              answerText = generatedAnswer.modelAnswer || '';
            }

            modelAnswers[questionId] = {
              answerText: answerText,
              explanation: generatedAnswer.explanation || '',
              keyConcepts: generatedAnswer.keyConcepts || [],
              gradingGuidelines: generatedAnswer.gradingGuidelines || generatedAnswer.gradingRubric || '',
              commonMistakes: generatedAnswer.commonMistakes || generatedAnswer.misconceptions || [],
              minimumRequirements: generatedAnswer.minimumRequirements || '',
              aiGenerated: true,
              generatedAt: new Date().toISOString()
            };

            console.log(`✅ Generated model answer for question ${questionId}`);
          } else {
            console.warn(`⚠️ Failed to generate model answer for question ${questionId}`);
            modelAnswers[questionId] = {
              answerText: 'AI generation failed',
              explanation: '',
              keyConcepts: [],
              gradingGuidelines: '',
              commonMistakes: [],
              minimumRequirements: '',
              aiGenerated: false,
              error: 'Failed to parse AI response'
            };
          }

          // Small delay between questions to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));

        } catch (error) {
          console.error(`Error generating model answer for question:`, error);
          const questionId = question._id || question.id || `q_${i}`;
          modelAnswers[questionId] = {
            answerText: '',
            explanation: '',
            keyConcepts: [],
            gradingGuidelines: '',
            commonMistakes: [],
            minimumRequirements: '',
            aiGenerated: false,
            error: error.message
          };
        }
      }
    }

    console.log(`🎉 Generated model answers for ${Object.keys(modelAnswers).length} questions`);
    return modelAnswers;

  } catch (error) {
    console.error('Error in generateModelAnswers:', error);
    throw error;
  }
};

module.exports = {
  gradeOpenEndedAnswer,
  gradeWithoutModelAnswer,
  generateModelAnswers
};
