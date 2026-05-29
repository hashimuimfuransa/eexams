// Enhanced grading functions for different question types
const { gradeOpenEndedAnswer } = require('./aiGrading');
const groqClient = require('./groqClient');

/**
 * Fast AI verification of grading results
 * Quickly checks if the grading decision appears correct
 * @param {Object} question - The question object
 * @param {string} studentAnswer - The student's answer
 * @param {string} correctAnswer - The correct answer
 * @param {boolean} currentIsCorrect - Current grading decision
 * @param {number} timeoutMs - Timeout in milliseconds (default 3000ms for speed)
 * @returns {Promise<Object>} - Verification result with confidence and recommendation
 */
const verifyGradingWithAI = async (question, studentAnswer, correctAnswer, currentIsCorrect, timeoutMs = 3000) => {
  try {
    // Skip verification if answers are empty or too short for meaningful comparison
    if (!studentAnswer || !correctAnswer || studentAnswer.trim().length === 0) {
      return { verified: true, confidence: 1.0, recommendation: 'accept', reason: 'Empty answer handling' };
    }

    // Normalize answers for quick comparison
    const normalize = (text) => String(text).toLowerCase().trim().replace(/[.\s]*$/, '');
    const studentNorm = normalize(studentAnswer);
    const correctNorm = normalize(correctAnswer);

    // Quick exact match - no need for AI
    if (studentNorm === correctNorm) {
      return { verified: true, confidence: 1.0, recommendation: 'accept', reason: 'Exact match' };
    }

    // For true/false questions, use semantic equivalence check (fast, no AI needed)
    if (question.type === 'true-false') {
      const trueValues = ['true', 'yes', 'correct', 'right', '1', 't', 'y'];
      const falseValues = ['false', 'no', 'incorrect', 'wrong', '0', 'f', 'n'];

      const studentIsTrue = trueValues.includes(studentNorm);
      const studentIsFalse = falseValues.includes(studentNorm);
      const correctIsTrue = trueValues.includes(correctNorm);
      const correctIsFalse = falseValues.includes(correctNorm);

      const semanticMatch = (studentIsTrue && correctIsTrue) || (studentIsFalse && correctIsFalse);

      if (semanticMatch && !currentIsCorrect) {
        return { verified: false, confidence: 0.95, recommendation: 'change_to_correct', reason: 'Semantic equivalence not detected by original grader' };
      }
      if (!semanticMatch && currentIsCorrect) {
        return { verified: false, confidence: 0.8, recommendation: 'review', reason: 'Answers appear different but marked correct' };
      }
      return { verified: true, confidence: 0.95, recommendation: 'accept', reason: 'Semantic match verified' };
    }

    // For multiple choice, check letter/text match (fast, no AI needed)
    if (question.type === 'multiple-choice') {
      // If we have options, try to match by letter or text
      if (question.options && Array.isArray(question.options)) {
        const selectedOption = question.options.find(opt =>
          normalize(opt.text) === studentNorm ||
          normalize(opt.letter) === studentNorm ||
          studentNorm.includes(normalize(opt.letter))
        );
        const correctOption = question.options.find(opt => opt.isCorrect);

        if (selectedOption && correctOption) {
          const letterMatch = selectedOption.letter === correctOption.letter;
          const textMatch = normalize(selectedOption.text) === normalize(correctOption.text);

          if ((letterMatch || textMatch) && !currentIsCorrect) {
            return { verified: false, confidence: 0.95, recommendation: 'change_to_correct', reason: 'Option match not detected by original grader' };
          }
          if (!(letterMatch || textMatch) && currentIsCorrect) {
            return { verified: false, confidence: 0.85, recommendation: 'review', reason: 'Selected option differs from correct option' };
          }
        }
      }
      return { verified: true, confidence: 0.9, recommendation: 'accept', reason: 'MC check passed' };
    }

    // For other types, use fast AI verification with short timeout
    const prompt = `Quick grading verification (respond with JSON only):

Question: ${question.text?.substring(0, 200)}
Student Answer: ${studentNorm.substring(0, 100)}
Correct Answer: ${correctNorm.substring(0, 100)}
Currently Marked: ${currentIsCorrect ? 'CORRECT' : 'INCORRECT'}

Task: Verify if the grading decision is correct.

Rules:
1. If answers are semantically equivalent (same meaning), mark as correct
2. If student answer is essentially correct but worded differently, mark as correct
3. If student answer is wrong or incomplete, mark as incorrect
4. For numerical answers, allow small rounding differences

Respond ONLY with JSON: {"isCorrect": boolean, "confidence": 0.0-1.0, "reason": "brief explanation"}`;

    // Race between AI call and timeout
    const aiPromise = groqClient.generateContent(prompt, {
      model: 'smart',
      jsonMode: true,
      temperature: 0.1,
      maxTokens: 256
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Verification timeout')), timeoutMs)
    );

    const response = await Promise.race([aiPromise, timeoutPromise]);
    const result = response.parsedContent || JSON.parse(response.text.replace(/```json\n?|\n?```/g, '').trim());

    const aiIsCorrect = result.isCorrect;
    const confidence = result.confidence || 0.8;

    // If AI disagrees with current grading
    if (aiIsCorrect !== currentIsCorrect) {
      return {
        verified: false,
        confidence: confidence,
        recommendation: aiIsCorrect ? 'change_to_correct' : 'change_to_incorrect',
        reason: result.reason || 'AI verification disagrees with grading'
      };
    }

    return {
      verified: true,
      confidence: confidence,
      recommendation: 'accept',
      reason: result.reason || 'AI verification confirms grading'
    };

  } catch (error) {
    console.log(`AI verification skipped for question ${question._id}: ${error.message}`);
    // On error, accept the current grading to avoid blocking
    return { verified: true, confidence: 0.5, recommendation: 'accept', reason: 'Verification skipped due to error' };
  }
};

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

  if (typeof correctAnswer === 'string') {
    return correctAnswer;
  }

  if (typeof correctAnswer === 'object') {
    // If it has subQuestions array, format them
    if (correctAnswer.subQuestions && Array.isArray(correctAnswer.subQuestions)) {
      return correctAnswer.subQuestions.map(sq => {
        const label = sq.label || sq.questionNumber || '';
        const text = sq.correctAnswer || sq.text || '';
        return label ? `${label}) ${text}` : text;
      }).join('\n');
    }

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

    try {
      return JSON.stringify(correctAnswer);
    } catch (e) {
      return fallback;
    }
  }

  return String(correctAnswer);
}

/**
 * Detect if question has multiple parts (a, b, c or i, ii, iii)
 * @param {string} questionText - The question text
 * @returns {Object} - Detection result
 */
const detectMultiPartQuestion = (questionText) => {
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
 * Parse answer to extract actual content from special formats
 * Handles [MATH: ...], [DRAWING: ...], and other formats
 * @param {string} answer - The raw answer string
 * @returns {string} - The cleaned answer content
 */
const parseAnswerContent = (answer) => {
  if (!answer || typeof answer !== 'string') return '';

  let content = answer;

  // Extract content from [MATH: ...] format
  const mathMatch = answer.match(/\[MATH:\s*(.*?)\]/);
  if (mathMatch) {
    content = mathMatch[1].trim();
  }

  // Extract content from [DRAWING: ...] format (base64 data, ignore for grading)
  const drawingMatch = answer.match(/\[DRAWING:\s*([^\]]*)\]/);
  if (drawingMatch) {
    // Remove drawing data from content for text grading
    content = content.replace(/\[DRAWING:\s*[^\]]*\]/, '').trim();
  }

  // Extract content from [IMAGE_UPLOADED: ...] format (remove the tag, keep the text)
  const imageMatch = answer.match(/\[IMAGE_UPLOADED:\s*[^\]]*\]/);
  if (imageMatch) {
    // Remove image upload tag from content for text grading
    content = content.replace(/\[IMAGE_UPLOADED:\s*[^\]]*\]/, '').trim();
  }

  // Extract final result from calculation patterns like "X + Y = Z" or "X * Y = Z"
  // This handles cases like "Depreciation:$54000+$25000 =$79000"
  const calcPattern = content.match(/(?:=|:)\s*([-\d,]+(?:\.\d+)?)\s*$/);
  if (calcPattern) {
    content = calcPattern[1].trim();
  }

  // If answer still has brackets, try to extract content between them
  if (content.includes('[') && content.includes(']')) {
    content = content.replace(/\[.*?\]/g, '').trim();
  }

  return content;
};

/**
 * Validate that answer is relevant to the question
 * Checks for obviously irrelevant or placeholder answers
 * @param {string} answer - The student's answer
 * @param {string} questionText - The question text
 * @returns {Object} - Validation result with isValid and reason
 */
const validateAnswerRelevance = (answer, questionText) => {
  if (!answer || answer.trim().length === 0) {
    return { isValid: false, reason: 'No answer provided.' };
  }

  const cleanAnswer = answer.trim().toLowerCase();

  // Check for meaningless answers like "I don't know", "no idea", etc.
  const meaninglessPatterns = [
    /^(i\s+don'?t\s+know|dont\s+know|no\s+idea|i\s+have\s+no\s+idea|not\s+sure|unsure|i\s+don'?t\s+understand|dont\s+understand)$/i,
    /^(i\s+do\s+not\s+know|i\s+do\s+not\s+understand|i\s+have\s+no\s+clue|no\s+clue)$/i,
    /^(skip|pass|n\/a|none|nothing|answer|question)$/i,
    /^(please\s+help|help\s+me|idk)$/i
  ];

  for (const pattern of meaninglessPatterns) {
    if (pattern.test(cleanAnswer)) {
      return { isValid: false, reason: 'Your answer indicates you do not know the answer. Please review the material and provide a proper response.' };
    }
  }

  // Check for obvious placeholder answers
  const placeholderPatterns = [
    /^[a-j],?\s*$/,  // Single letter like "a," or "a"
    /^question\s*\d*$/i,  // "question 1" etc
    /^[.\s]+$/,  // Just dots or spaces
  ];

  for (const pattern of placeholderPatterns) {
    if (pattern.test(cleanAnswer)) {
      return { isValid: false, reason: 'Answer appears to be a placeholder or label' };
    }
  }

  // For very short answers or math expressions, mark for lenient grading but don't reject
  if (cleanAnswer.length < 10 || /^[\d\+\-\*\/\=\(\)\s\\a-zA-Z]+$/.test(cleanAnswer)) {
    return { isValid: true, needsLenientGrading: true, reason: 'Answer is brief or mathematical - use lenient grading' };
  }

  return { isValid: true };
};

/**
 * Enhanced semantic equivalence mappings for technical terms
 */
const SEMANTIC_MAPPINGS = {
  // Network terms
  'wan': ['wide area network', 'wide-area network', 'wide area networks', 'wide-area networks'],
  'lan': ['local area network', 'local-area network', 'local area networks', 'local-area networks'],
  'man': ['metropolitan area network', 'metropolitan-area network', 'metropolitan area networks'],
  'pan': ['personal area network', 'personal-area network', 'personal area networks'],
  'vpn': ['virtual private network', 'virtual-private network', 'virtual private networks'],
  'dns': ['domain name system', 'domain name service', 'domain name systems'],
  'dhcp': ['dynamic host configuration protocol', 'dynamic host config protocol'],
  'tcp': ['transmission control protocol', 'transmission control protocols'],
  'udp': ['user datagram protocol', 'user datagram protocols'],
  'ip': ['internet protocol', 'internet protocols'],
  'http': ['hypertext transfer protocol', 'hyper text transfer protocol', 'hypertext transfer protocols'],
  'https': ['hypertext transfer protocol secure', 'hyper text transfer protocol secure'],
  'ftp': ['file transfer protocol', 'file transfer protocols'],
  'smtp': ['simple mail transfer protocol', 'simple mail transfer protocols'],
  'pop3': ['post office protocol 3', 'post office protocol version 3'],
  'imap': ['internet message access protocol', 'internet mail access protocol'],

  // Computer hardware terms
  'cpu': ['central processing unit', 'central processor unit', 'processor'],
  'gpu': ['graphics processing unit', 'graphics processor unit', 'graphics card'],
  'ram': ['random access memory', 'random-access memory', 'memory'],
  'rom': ['read only memory', 'read-only memory'],
  'hdd': ['hard disk drive', 'hard drive', 'hard disk'],
  'ssd': ['solid state drive', 'solid-state drive'],
  'usb': ['universal serial bus', 'universal-serial bus'],
  'pci': ['peripheral component interconnect', 'peripheral-component interconnect'],
  'bios': ['basic input output system', 'basic input/output system'],
  'uefi': ['unified extensible firmware interface', 'unified-extensible firmware interface'],

  // Software terms
  'os': ['operating system', 'operating systems'],
  'gui': ['graphical user interface', 'graphical-user interface'],
  'cli': ['command line interface', 'command-line interface'],
  'api': ['application programming interface', 'application-programming interface'],
  'sql': ['structured query language', 'structured-query language'],
  'html': ['hypertext markup language', 'hyper text markup language'],
  'css': ['cascading style sheets', 'cascading-style sheets'],
  'xml': ['extensible markup language', 'extensible-markup language'],
  'json': ['javascript object notation', 'javascript-object notation'],

  // Security terms
  'ssl': ['secure sockets layer', 'secure-sockets layer'],
  'tls': ['transport layer security', 'transport-layer security'],
  'vpn': ['virtual private network', 'virtual-private network'],
  'firewall': ['network firewall', 'security firewall'],
  'antivirus': ['anti virus', 'anti-virus', 'virus protection'],
  'malware': ['malicious software', 'malicious-software'],

  // Database terms
  'dbms': ['database management system', 'database-management system'],
  'rdbms': ['relational database management system', 'relational-database management system'],
  'nosql': ['not only sql', 'not-only sql', 'non sql', 'non-sql'],

  // Programming terms
  'oop': ['object oriented programming', 'object-oriented programming'],
  'ide': ['integrated development environment', 'integrated-development environment'],
  'sdk': ['software development kit', 'software-development kit'],

  // Common abbreviations and their expansions
  'www': ['world wide web', 'world-wide web'],
  'url': ['uniform resource locator', 'uniform-resource locator'],
  'uri': ['uniform resource identifier', 'uniform-resource identifier'],
  'isp': ['internet service provider', 'internet-service provider'],
  'wifi': ['wireless fidelity', 'wireless-fidelity', 'wi-fi'],
  'bluetooth': ['blue tooth', 'blue-tooth'],

  // True/False equivalents
  'true': ['yes', 'correct', 'right', 'valid', 'accurate'],
  'false': ['no', 'incorrect', 'wrong', 'invalid', 'inaccurate'],
  'yes': ['true', 'correct', 'right', 'valid'],
  'no': ['false', 'incorrect', 'wrong', 'invalid']
};

/**
 * Check if two answers are semantically equivalent
 */
const areSemanticallySimilar = (answer1, answer2) => {
  if (!answer1 || !answer2) return false;

  // Normalize both answers
  const normalize = (text) => {
    return String(text)
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  };

  const norm1 = normalize(answer1);
  const norm2 = normalize(answer2);

  // Direct match
  if (norm1 === norm2) return true;

  // Check if one contains the other
  if (norm1.includes(norm2) || norm2.includes(norm1)) return true;

  // Check semantic mappings
  for (const [abbrev, expansions] of Object.entries(SEMANTIC_MAPPINGS)) {
    // Check if one is abbreviation and other is expansion
    if ((norm1 === abbrev && expansions.some(exp => norm2.includes(exp))) ||
        (norm2 === abbrev && expansions.some(exp => norm1.includes(exp)))) {
      return true;
    }

    // Check if both are expansions of the same abbreviation
    if (expansions.some(exp => norm1.includes(exp)) &&
        expansions.some(exp => norm2.includes(exp))) {
      return true;
    }
  }

  return false;
};

/**
 * Grade different question types with enhanced accuracy
 * @param {Object} question - The question object
 * @param {Object} answer - The student's answer
 * @param {string} modelAnswer - The correct answer
 * @returns {Promise<Object>} - Grading result
 */
const gradeQuestionByType = async (question, answer, modelAnswer = '') => {
  try {
    console.log(`Grading ${question.type} question: ${question._id}`);

    switch (question.type) {
      case 'multiple-choice':
        return gradeMultipleChoice(question, answer, modelAnswer);

      case 'true-false':
        return gradeTrueFalse(question, answer, modelAnswer);

      case 'fill-in-blank':
      case 'fill-blank':
        return gradeFillInBlank(question, answer, modelAnswer);

      case 'matching':
        return gradeMatching(question, answer);

      case 'ordering':
        return gradeOrdering(question, answer);

      case 'drag-drop':
        return gradeDragDrop(question, answer);

      case 'open-ended':
      case 'short-answer':
        console.log(`🤖 AI grading open-ended question ${question._id} in section ${question.section}`);

        // Parse answer content to extract actual text from [MATH: ...] and [DRAWING: ...] formats
        const parsedAnswer = parseAnswerContent(answer.textAnswer || '');

        // Check for multi-part questions
        const multiPartInfo = detectMultiPartQuestion(question.text);
        const multiPartValidation = validateMultiPartAnswer(parsedAnswer, multiPartInfo);

        // Only reject severely incomplete answers (< 25%) for actual multi-part questions
        // Skip this check for calculation questions or short answers
        if (multiPartInfo.isMultiPart && multiPartValidation.completeness < 0.25) {
          console.log(`❌ Multi-part question severely incomplete: ${multiPartValidation.partsFound}/${multiPartInfo.expectedParts} parts found`);
          console.log(`⚠️ Question text: ${question.text.substring(0, 150)}...`);
          console.log(`⚠️ Student answer: ${parsedAnswer.substring(0, 150)}...`);
          
          // For severely incomplete answers, still attempt basic grading rather than giving 0
          // This allows partial credit for calculation questions that might be misdetected
          console.log(`⚠️ Attempting fallback grading for potentially misdetected multi-part question`);
        }

        // Validate answer relevance before grading
        const relevanceCheck = validateAnswerRelevance(parsedAnswer, question.text);
        if (!relevanceCheck.isValid) {
          console.log(`❌ Answer validation failed: ${relevanceCheck.reason}`);
          return {
            score: 0,
            feedback: `Your answer appears to be invalid: ${relevanceCheck.reason}. Please provide a proper answer to the question.`,
            correctedAnswer: modelAnswer || formatCorrectAnswer(question.correctAnswer, 'Model answer not available'),
            details: {
              section: question.section,
              questionType: 'open-ended',
              gradingMethod: 'answer_validation_failed',
              validationReason: relevanceCheck.reason,
              multiPartInfo,
              multiPartValidation
            }
          };
        }

        // If answer needs lenient grading (brief or mathematical), log it
        if (relevanceCheck.needsLenientGrading) {
          console.log(`⚠️ Answer marked for lenient grading: ${relevanceCheck.reason}`);
        }

        // Enhanced AI grading for sections B and beyond with optimized processing
        // Section A is typically multiple choice, B is short answer, C and beyond are essay/long-answer
        const sectionType = (question.section === 'C' || !['A', 'B'].includes(question.section)) ? 'essay/long-answer' : 'short-answer';
        console.log(`📝 Processing ${sectionType} question in section ${question.section}`);

        const openEndedResult = await gradeOpenEndedAnswer(
          parsedAnswer,
          modelAnswer || formatCorrectAnswer(question.correctAnswer, ''),
          question.points,
          question.text,
          question.type,
          question.section // Pass section for optimized grading
        );

        // Apply multi-part scaling for proportional marks
        // If student answers 1 of 4 parts correctly, max they can get is 25% of total
        let finalScore = openEndedResult.score;
        if (multiPartInfo.isMultiPart && multiPartValidation.completeness < 1.0 && multiPartValidation.completeness >= 0.25) {
          const proportionalScore = Math.round(question.points * multiPartValidation.completeness);
          finalScore = Math.min(finalScore, proportionalScore);
          console.log(`Multi-part scaling applied: ${openEndedResult.score} -> ${finalScore} (max ${Math.round(multiPartValidation.completeness * 100)}% for ${multiPartValidation.partsFound}/${multiPartInfo.expectedParts} parts)`);
        }

        // Enhance the result with section information and better feedback
        return {
          ...openEndedResult,
          score: finalScore,
          details: {
            ...openEndedResult.details,
            section: question.section,
            sectionType: sectionType,
            questionType: 'open-ended',
            aiGraded: true,
            gradingMethod: 'enhanced_ai_grading_section',
            processingOptimized: true,
            multiPartInfo,
            multiPartValidation
          },
          // Ensure we have a proper corrected answer
          correctedAnswer: openEndedResult.correctedAnswer || modelAnswer || formatCorrectAnswer(question.correctAnswer, 'Model answer not available')
        };

      default:
        console.warn(`Unknown question type: ${question.type}`);
        return {
          score: 0,
          feedback: 'Unknown question type',
          details: { error: 'Unsupported question type' }
        };
    }
  } catch (error) {
    console.error('Error grading question:', error);
    return {
      score: 0,
      feedback: 'Error occurred during grading',
      details: { error: error.message }
    };
  }
};

/**
 * Grade multiple choice questions with enhanced AI detection
 */
const gradeMultipleChoice = async (question, answer, modelAnswer) => {
  try {
    console.log(`Grading multiple-choice question: ${question._id}`);

    // Extract the selected option, handling various formats
    let selectedOption = answer.selectedOption || answer.selectedOptionLetter || answer.textAnswer || '';
    let selectedOptionLetter = answer.selectedOptionLetter || '';

    // Handle case where answer might be in object format
    if (typeof selectedOption === 'object') {
      selectedOption = String(selectedOption).trim();
    } else {
      selectedOption = String(selectedOption || '').trim();
    }

    console.log(`Selected option: "${selectedOption}"`);
    console.log(`Selected option letter: "${selectedOptionLetter}"`);

    if (!selectedOption) {
      return {
        score: 0,
        feedback: 'No answer provided',
        details: { answerType: 'unanswered' },
        correctedAnswer: modelAnswer || 'No correct answer available'
      };
    }

    // Ensure question has options
    if (!question.options || !Array.isArray(question.options) || question.options.length === 0) {
      console.log('Question has no valid options, using direct answer comparison for multiple-choice');

      // For multiple choice without options, compare directly with model answer
      if (!modelAnswer) {
        return {
          score: 0,
          feedback: 'No correct answer available for comparison',
          details: { answerType: 'no_model_answer' }
        };
      }

      // Enhanced AI-based comparison for direct comparison
      let isCorrect = false;

      try {
        // Use AI to compare the student answer with the model answer
        isCorrect = await checkAnswerWithAI(
          question.text,
          selectedOption,
          modelAnswer,
          'multiple-choice'
        );
        console.log(`AI direct comparison result: ${isCorrect}`);
      } catch (aiError) {
        console.error('AI comparison failed, falling back to semantic matching:', aiError);

        // Fallback to semantic matching
        isCorrect = selectedOption.toLowerCase().trim() === modelAnswer.toLowerCase().trim();

        // If not exact match, check semantic equivalence
        if (!isCorrect) {
          isCorrect = areSemanticallySimilar(selectedOption, modelAnswer);
        }
      }

      const score = isCorrect ? (question.points || 1) : 0;

      return {
        score,
        feedback: isCorrect
          ? 'Correct! Well done.'
          : `Incorrect. The correct answer is: ${modelAnswer}`,
        correctedAnswer: modelAnswer,
        details: {
          selectedOption: selectedOption,
          correctAnswer: modelAnswer,
          isCorrect,
          answerType: 'multiple_choice_direct',
          gradingMethod: isCorrect && selectedOption.toLowerCase().trim() !== modelAnswer.toLowerCase().trim()
            ? 'semantic_match' : 'direct_comparison'
        }
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
    let isCorrect = false;
    let gradingMethod = 'letter_based';

    // Find the selected option in the question with enhanced matching
    let option = null;

    console.log(`Grading multiple choice - selectedOption: "${selectedOption}", selectedOptionLetter: "${selectedOptionLetter}"`);

    // First try to match by letter if we have selectedOptionLetter
    if (selectedOptionLetter) {
      option = question.options.find(opt =>
        opt.letter && opt.letter.toUpperCase() === selectedOptionLetter.toUpperCase()
      );
      console.log(`Matched by letter "${selectedOptionLetter}":`, option ? `${option.letter}. ${option.text}` : 'Not found');
    }

    // If not found by letter, try other matching methods
    if (!option) {
      option = question.options.find(opt => {
        const optLetter = String(opt.letter || '').trim().toLowerCase();
        const optText = String(opt.text || '').trim().toLowerCase();
        const optId = String(opt._id || '').trim();
        const selected = selectedOption.toLowerCase();

        return optLetter === selected ||
               optText === selected ||
               optId === selected ||
               optLetter === selected.charAt(0) || // Handle single letter selection
               selected.includes(optLetter) ||
               selected.includes(optText);
      });
      console.log(`Matched by text/content:`, option ? `${option.letter}. ${option.text}` : 'Not found');
    }

    // First, try to find the correct option from the question's options
    correctOption = question.options.find(opt => opt.isCorrect);

    // If no option is marked as correct, try to determine from modelAnswer
    if (!correctOption && modelAnswer) {
      // Check if modelAnswer is a letter (A, B, C, D, E, etc.)
      const modelAnswerLetter = modelAnswer.trim().toUpperCase();
      if (/^[A-Z]$/.test(modelAnswerLetter)) {
        correctOption = question.options.find(opt =>
          opt.letter && opt.letter.toUpperCase() === modelAnswerLetter
        );
        console.log(`Correct option found by modelAnswer letter "${modelAnswerLetter}":`, correctOption ? `${correctOption.letter}. ${correctOption.text}` : 'Not found');
      } else {
        // modelAnswer is text, find matching option
        correctOption = question.options.find(opt =>
          opt.text && opt.text.toLowerCase().trim() === modelAnswer.toLowerCase().trim()
        );
        console.log(`Correct option found by modelAnswer text:`, correctOption ? `${correctOption.letter}. ${correctOption.text}` : 'Not found');
      }
    }

    // Primary: Letter-based comparison (fastest and most accurate when letters are available)
    if (option && correctOption) {
      // Compare letters directly - this is the most reliable method
      const selectedLetter = option.letter ? option.letter.toUpperCase() : '';
      const correctLetter = correctOption.letter ? correctOption.letter.toUpperCase() : '';

      if (selectedLetter && correctLetter) {
        isCorrect = selectedLetter === correctLetter;
        gradingMethod = 'letter_comparison';
        console.log(`Letter-based comparison: selected="${selectedLetter}", correct="${correctLetter}", result=${isCorrect}`);
      }
    }

    // Fallback 1: Check if selected option is marked as correct
    if (!isCorrect && option && option.isCorrect) {
      isCorrect = true;
      gradingMethod = 'isCorrect_flag';
      console.log(`Selected option is marked as correct`);
    }

    // Fallback 2: Direct comparison with modelAnswer if letter comparison failed
    if (!isCorrect && option && modelAnswer) {
      const modelLower = modelAnswer.toLowerCase().trim();
      const optTextLower = option.text.toLowerCase().trim();
      const optLetterLower = option.letter?.toLowerCase() || '';

      isCorrect = optLetterLower === modelLower ||
                 optTextLower === modelLower ||
                 modelLower === `${optLetterLower}. ${optTextLower}` ||
                 modelLower === `${optLetterLower}) ${optTextLower}`;
      gradingMethod = 'modelAnswer_comparison';
      console.log(`Model answer comparison result: ${isCorrect}`);
    }

    // Fallback 3: Skip AI fallback for multiple-choice when letters are clearly different
    // If we have both option and correctOption with letters, and they don't match, it's incorrect
    // Only use AI in edge cases where comparison is ambiguous
    if (!isCorrect && option && correctOption) {
      // If we have clear letter mismatch, skip AI - it's definitively wrong
      if (option.letter && correctOption.letter && option.letter !== correctOption.letter) {
        console.log(`Clear letter mismatch (${option.letter} vs ${correctOption.letter}), skipping AI fallback`);
        gradingMethod = 'letter_comparison_failed';
        isCorrect = false;
      } else if (!option.letter || !correctOption.letter) {
        // Only use AI if letters are missing (ambiguous case)
        console.log(`Letters missing, using AI as fallback`);
        gradingMethod = 'ai_fallback';

        try {
          // Prepare detailed information for AI grading
          const studentAnswerForAI = `${option.letter || ''}. ${option.text}`;
          const correctAnswerForAI = `${correctOption.letter || ''}. ${correctOption.text}`;

          console.log(`AI Grading Input:`);
          console.log(`- Question: ${question.text}`);
          console.log(`- Student selected: ${studentAnswerForAI}`);
          console.log(`- Correct answer: ${correctAnswerForAI}`);

          // Use AI to compare the answers with full context
          isCorrect = await checkAnswerWithAI(
            question.text,
            studentAnswerForAI,
            correctAnswerForAI,
            'multiple-choice'
          );
          console.log(`AI determined correctness: ${isCorrect}`);
        } catch (aiError) {
          console.error('AI grading failed, falling back to direct comparison:', aiError);
          // Final fallback to direct comparison
          isCorrect = option.letter === correctOption.letter ||
                     option.text === correctOption.text ||
                     option._id === correctOption._id;
          gradingMethod = 'direct_comparison_fallback';
        }
      }
    } else if (!isCorrect && option && !correctOption) {
      // No correct option found, try direct text comparison first before AI
      if (modelAnswer) {
        const modelLower = modelAnswer.toLowerCase().trim();
        const optTextLower = option.text.toLowerCase().trim();
        const optLetterLower = option.letter?.toLowerCase() || '';
        
        isCorrect = optLetterLower === modelLower ||
                   optTextLower === modelLower ||
                   modelLower === `${optLetterLower}. ${optTextLower}` ||
                   modelLower === `${optLetterLower}) ${optTextLower}`;
        
        if (isCorrect) {
          gradingMethod = 'modelAnswer_comparison';
          console.log(`Model answer comparison result: ${isCorrect}`);
        } else {
          // Only use AI if direct comparison fails
          gradingMethod = 'ai_no_correct_option';
          try {
            const studentAnswerForAI = option ? `${option.letter || ''}. ${option.text}` : selectedOption;
            isCorrect = await checkAnswerWithAI(
              question.text,
              studentAnswerForAI,
              modelAnswer || 'No model answer available',
              'multiple-choice'
            );
            console.log(`AI fallback grading result: ${isCorrect}`);
          } catch (aiError) {
            console.error('AI fallback grading failed:', aiError);
            isCorrect = false;
          }
        }
      }
    }

    const score = isCorrect ? (question.points || 1) : 0;

    // Create proper feedback showing both letter and text
    let correctAnswerDisplay = '';
    if (correctOption) {
      correctAnswerDisplay = correctOption.letter
        ? `${correctOption.letter}. ${correctOption.text}`
        : correctOption.text;
    } else {
      correctAnswerDisplay = modelAnswer || 'Not available';
    }

    let selectedAnswerDisplay = '';
    if (option) {
      selectedAnswerDisplay = option.letter
        ? `${option.letter}. ${option.text}`
        : option.text;
    } else {
      selectedAnswerDisplay = selectedOption;
    }

    // Enhanced feedback with AI reasoning
    let feedback = '';
    if (isCorrect) {
      feedback = `✅ Correct! You selected: ${selectedAnswerDisplay}`;
      if (option && correctOption && option.letter === correctOption.letter) {
        feedback += ` - This is the right answer.`;
      }
    } else {
      feedback = `❌ Incorrect. You selected: ${selectedAnswerDisplay}. The correct answer is: ${correctAnswerDisplay}`;
      if (option && correctOption) {
        feedback += ` - You chose option ${option.letter} but the correct option is ${correctOption.letter}.`;
      }
    }

    console.log(`Multiple choice grading result:`);
    console.log(`- Selected: ${selectedAnswerDisplay}`);
    console.log(`- Correct: ${correctAnswerDisplay}`);
    console.log(`- Score: ${score}/${question.points || 1}`);
    console.log(`- AI graded: ${isCorrect}`);

    // Run AI verification to catch any grading errors
    try {
      const verification = await verifyGradingWithAI(
        question,
        selectedAnswerDisplay || selectedOption,
        correctAnswerDisplay || modelAnswer,
        isCorrect,
        2000 // 2 second timeout for multiple choice (fast)
      );

      console.log(`AI verification for multiple choice question ${question._id}:`, verification);

      // If AI verification disagrees and has high confidence, adjust the grading
      if (!verification.verified && verification.confidence > 0.85) {
        if (verification.recommendation === 'change_to_correct' && !isCorrect) {
          console.log(`🔄 AI verification corrected grading: INCORRECT -> CORRECT`);
          isCorrect = true;
          score = question.points || 1;
          feedback = `✅ Correct! You selected: ${selectedAnswerDisplay} (verified by AI)`;
        } else if (verification.recommendation === 'change_to_incorrect' && isCorrect) {
          console.log(`🔄 AI verification corrected grading: CORRECT -> INCORRECT`);
          isCorrect = false;
          score = 0;
          feedback = `❌ Incorrect. You selected: ${selectedAnswerDisplay}. The correct answer is: ${correctAnswerDisplay}`;
        }
      }

      return {
        score,
        feedback,
        correctedAnswer: correctAnswerDisplay,
        details: {
          selectedOption: option ? option.letter : selectedOptionLetter || selectedOption,
          selectedText: option ? option.text : selectedOption,
          selectedFull: selectedAnswerDisplay,
          correctOption: correctOption ? correctOption.letter : 'Unknown',
          correctText: correctOption ? correctOption.text : modelAnswer,
          correctFull: correctAnswerDisplay,
          isCorrect,
          answerType: 'multiple_choice',
          gradingMethod,
          aiVerification: verification
        }
      };
    } catch (verifyError) {
      console.log(`AI verification failed for multiple choice, using original grading: ${verifyError.message}`);
      // Return original grading if verification fails
      return {
        score,
        feedback,
        correctedAnswer: correctAnswerDisplay,
        details: {
          selectedOption: option ? option.letter : selectedOptionLetter || selectedOption,
          selectedText: option ? option.text : selectedOption,
          selectedFull: selectedAnswerDisplay,
          correctOption: correctOption ? correctOption.letter : 'Unknown',
          correctText: correctOption ? correctOption.text : modelAnswer,
          correctFull: correctAnswerDisplay,
          isCorrect,
          answerType: 'multiple_choice',
          gradingMethod,
          aiVerification: { verified: false, error: verifyError.message }
        }
      };
    }
  } catch (error) {
    console.error('Error grading multiple choice:', error);
    return {
      score: 0,
      feedback: 'Error grading multiple choice question',
      details: {
        error: error.message,
        gradingMethod: 'error_fallback'
      }
    };
  }
};

/**
 * Grade true/false questions
 */
const gradeTrueFalse = async (question, answer, modelAnswer) => {
  try {
    // DEBUG: Log the full answer object to diagnose issues
    console.log(`🔍 DEBUG gradeTrueFalse - Question ${question._id}:`, {
      answerFields: Object.keys(answer),
      selectedOption: answer.selectedOption,
      textAnswer: answer.textAnswer,
      selectedOptionLetter: answer.selectedOptionLetter,
      answerType: typeof answer.selectedOption,
      modelAnswer: modelAnswer,
      questionCorrectAnswer: question.correctAnswer
    });

    // Extract the selected option, handling various formats (similar to multiple choice)
    let selectedOption = answer.selectedOption || answer.textAnswer || '';

    // Handle case where answer might be in object format
    if (typeof selectedOption === 'object') {
      selectedOption = String(selectedOption).trim();
    } else {
      selectedOption = String(selectedOption || '').trim();
    }

    console.log(`Grading true/false question: ${question._id}, selected: "${selectedOption}"`);

    if (!selectedOption) {
      console.log(`⚠️ True/False question ${question._id}: No answer provided`);
      return {
        score: 0,
        feedback: 'No answer provided',
        details: { answerType: 'unanswered' },
        correctedAnswer: modelAnswer || 'No correct answer available'
      };
    }

    let isCorrect = false;
    let correctAnswer = modelAnswer;

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

    // Normalize the selected answer for comparison
    const normalizeAnswer = (ans) => {
      return String(ans).toLowerCase().trim().replace(/[.\s]*$/, ''); // Remove trailing periods and spaces
    };

    const selectedNormalized = normalizeAnswer(selectedOption);

    // Try direct comparison first (more reliable for true/false)
    if (correctAnswer) {
      const correctNormalized = normalizeAnswer(correctAnswer);
      isCorrect = selectedNormalized === correctNormalized;

      console.log(`True/False comparison: selected="${selectedNormalized}" vs correct="${correctNormalized}" -> ${isCorrect}`);

      // If direct comparison fails, check semantic equivalence (handles yes/no/true/false variations)
      if (!isCorrect) {
        const trueValues = ['true', 'yes', 'correct', 'right', '1', 't', 'y'];
        const falseValues = ['false', 'no', 'incorrect', 'wrong', '0', 'f', 'n'];

        const selectedIsTrue = trueValues.includes(selectedNormalized);
        const selectedIsFalse = falseValues.includes(selectedNormalized);
        const correctIsTrue = trueValues.includes(correctNormalized);
        const correctIsFalse = falseValues.includes(correctNormalized);

        if ((selectedIsTrue && correctIsTrue) || (selectedIsFalse && correctIsFalse)) {
          isCorrect = true;
          console.log(`True/False semantic match: selected="${selectedNormalized}" matches correct="${correctNormalized}"`);
        }
      }
    } else if (question.options && Array.isArray(question.options)) {
      // Use the question's options to determine correct answer
      const correctOption = question.options.find(opt => opt.isCorrect);
      if (correctOption) {
        correctAnswer = correctOption.text;
        const correctNormalized = normalizeAnswer(correctAnswer);
        isCorrect = selectedNormalized === correctNormalized;
        console.log(`True/False option comparison: selected="${selectedNormalized}" vs correct="${correctNormalized}" -> ${isCorrect}`);
      } else {
        // If no option marked correct, try to infer from correctAnswer field
        const questionCorrectAnswer = question.correctAnswer;
        if (questionCorrectAnswer) {
          correctAnswer = questionCorrectAnswer;
          const correctNormalized = normalizeAnswer(correctAnswer);
          isCorrect = selectedNormalized === correctNormalized;
          console.log(`True/False question.correctAnswer comparison: selected="${selectedNormalized}" vs correct="${correctNormalized}" -> ${isCorrect}`);
        }
      }
    } else {
      // Fallback: try to use question.correctAnswer
      const questionCorrectAnswer = question.correctAnswer;
      if (questionCorrectAnswer) {
        correctAnswer = questionCorrectAnswer;
        const correctNormalized = normalizeAnswer(correctAnswer);
        isCorrect = selectedNormalized === correctNormalized;
        console.log(`True/False fallback comparison: selected="${selectedNormalized}" vs correct="${correctNormalized}" -> ${isCorrect}`);
      }
    }

    let score = isCorrect ? (question.points || 1) : 0;
    let feedback = isCorrect
      ? 'Correct!'
      : `Incorrect. The correct answer is: ${correctAnswer}`;

    // Run AI verification to catch any grading errors
    try {
      const verification = await verifyGradingWithAI(
        question,
        selectedOption,
        correctAnswer,
        isCorrect,
        2000 // 2 second timeout for true/false (fast)
      );

      console.log(`AI verification for true/false question ${question._id}:`, verification);

      // If AI verification disagrees and has high confidence, adjust the grading
      if (!verification.verified && verification.confidence > 0.85) {
        if (verification.recommendation === 'change_to_correct' && !isCorrect) {
          console.log(`🔄 AI verification corrected grading: INCORRECT -> CORRECT`);
          isCorrect = true;
          score = question.points || 1;
          feedback = 'Correct! (verified by AI)';
        } else if (verification.recommendation === 'change_to_incorrect' && isCorrect) {
          console.log(`🔄 AI verification corrected grading: CORRECT -> INCORRECT`);
          isCorrect = false;
          score = 0;
          feedback = `Incorrect. The correct answer is: ${correctAnswer}`;
        }
      }

      return {
        score,
        feedback,
        correctedAnswer: correctAnswer,
        details: {
          selectedOption,
          correctAnswer,
          isCorrect,
          answerType: 'true_false',
          gradingMethod: isCorrect ? 'ai_determined_correct' : 'ai_determined_incorrect',
          aiVerification: verification
        }
      };
    } catch (verifyError) {
      console.log(`AI verification failed for true/false, using original grading: ${verifyError.message}`);
      // Return original grading if verification fails
      return {
        score,
        feedback,
        correctedAnswer: correctAnswer,
        details: {
          selectedOption,
          correctAnswer,
          isCorrect,
          answerType: 'true_false',
          gradingMethod: isCorrect ? 'direct_comparison' : 'incorrect',
          aiVerification: { verified: false, error: verifyError.message }
        }
      };
    }
  } catch (error) {
    console.error('Error grading true/false:', error);
    return {
      score: 0,
      feedback: 'Error grading true/false question',
      details: { error: error.message }
    };
  }
};

/**
 * Grade fill-in-blank questions with enhanced AI detection
 */
const gradeFillInBlank = async (question, answer, modelAnswer) => {
  try {
    console.log(`Grading fill-in-blank question: ${question._id}`);

    // Extract and clean the student answer
    let studentAnswer = answer.textAnswer || answer.selectedOption || '';

    // Handle case where answer might be in object format
    if (typeof studentAnswer === 'object') {
      studentAnswer = String(studentAnswer).trim();
    } else {
      studentAnswer = String(studentAnswer || '').trim();
    }

    console.log(`Student answer: "${studentAnswer}"`);

    if (!studentAnswer || studentAnswer === '') {
      return {
        score: 0,
        feedback: 'No answer provided',
        details: { answerType: 'unanswered' },
        correctedAnswer: modelAnswer || formatCorrectAnswer(question.correctAnswer, 'No correct answer available')
      };
    }

    // Get the model answer
    let correctAnswer = formatCorrectAnswer(modelAnswer || question.correctAnswer, '');

    console.log(`Model answer: "${correctAnswer}"`);

    // If no model answer is available, try to extract from question text or word bank
    if (!correctAnswer) {
      // Check if there's a word bank - use it as context for AI grading
      if (question.wordBank && question.wordBank.length > 0) {
        console.log(`Word bank available: ${question.wordBank.join(', ')}`);
        // The word bank will be passed to AI grading as context
      }

      // Look for common patterns in fill-in-blank questions
      const questionText = question.text || '';
      const answerPatterns = [
        /answer:\s*([^.\n]+)/i,
        /correct:\s*([^.\n]+)/i,
        /solution:\s*([^.\n]+)/i
      ];

      for (const pattern of answerPatterns) {
        const match = questionText.match(pattern);
        if (match) {
          correctAnswer = match[1].trim();
          break;
        }
      }
    }

    // Prepare context for AI grading (include word bank if available)
    let gradingContext = question.text || '';
    if (question.wordBank && question.wordBank.length > 0) {
      gradingContext += `\n\nWord Bank: ${question.wordBank.join(', ')}`;
    }
    if (question.passage) {
      gradingContext += `\n\nPassage: ${question.passage}`;
    }

    // Use AI grading for fill-in-blank questions
    const gradingResult = await gradeOpenEndedAnswer(
      studentAnswer,
      correctAnswer,
      question.points || 1,
      gradingContext,
      'fill-in-blank'
    );

    console.log(`Fill-in-blank grading result:`, gradingResult);

    return {
      ...gradingResult,
      details: {
        ...gradingResult.details,
        questionType: 'fill-in-blank',
        studentAnswer: studentAnswer,
        modelAnswer: correctAnswer
      }
    };

  } catch (error) {
    console.error('Error grading fill-in-blank:', error);

    // Fallback grading with enhanced numerical and partial credit support
    const studentAnswer = String(answer.textAnswer || answer.selectedOption || '').trim();
    const correctAnswer = formatCorrectAnswer(modelAnswer || question.correctAnswer, '');

    let score = 0;
    let feedback = 'Error occurred during grading';

    if (studentAnswer && correctAnswer) {
      // Enhanced numerical extraction for calculation questions
      const extractNumericalValue = (text) => {
        const cleaned = text.replace(/[$€£¥₹]/g, '').replace(/,/g, '');
        const patterns = [
          /(?:=|:|is)\s*([\d,]+(?:\.\d+)?)/i,
          /([\d,]+(?:\.\d+)?)\s*(?:$|answer|result)/i,
          /[\d,]+(?:\.\d+)?\s*[\*×]\s*[\d,]+(?:\.\d+)?\s*[=]\s*([\d,]+(?:\.\d+)?)/i,
        ];
        for (const pattern of patterns) {
          const match = cleaned.match(pattern);
          if (match) return parseFloat(match[1].replace(/,/g, ''));
        }
        const numbers = cleaned.match(/[\d,]+(?:\.\d+)?/g);
        if (numbers && numbers.length > 0) return parseFloat(numbers[numbers.length - 1].replace(/,/g, ''));
        return null;
      };

      const studentNumerical = extractNumericalValue(studentAnswer);
      const correctNumerical = extractNumericalValue(correctAnswer);

      // Check for numerical match (with tolerance)
      const isNumericalMatch = studentNumerical !== null && correctNumerical !== null && 
                               Math.abs(studentNumerical - correctNumerical) < 0.01;

      // Enhanced comparison fallback with semantic matching
      let isCorrect = studentAnswer.toLowerCase() === correctAnswer.toLowerCase() ||
                     correctAnswer.toLowerCase().includes(studentAnswer.toLowerCase()) ||
                     studentAnswer.toLowerCase().includes(correctAnswer.toLowerCase());

      // If not exact match, check semantic equivalence
      if (!isCorrect) {
        isCorrect = areSemanticallySimilar(studentAnswer, correctAnswer);
      }

      // Calculate score with partial credit support
      const maxPoints = question.points || 1;
      
      if (isNumericalMatch) {
        // Full points for correct numerical answer even if format differs
        score = maxPoints;
        feedback = `Correct! Your numerical answer (${studentNumerical}) matches the expected result (${correctNumerical}).`;
      } else if (isCorrect) {
        score = maxPoints;
        feedback = 'Correct answer!';
      } else {
        // Check for partial credit based on keyword matching
        const modelKeywords = correctAnswer.toLowerCase().split(/\s+/).filter(w => w.length >= 3);
        const studentLower = studentAnswer.toLowerCase();
        const matchedKeywords = modelKeywords.filter(kw => studentLower.includes(kw));
        const matchRatio = modelKeywords.length > 0 ? matchedKeywords.length / modelKeywords.length : 0;
        
        if (matchRatio >= 0.5) {
          // Partial credit for having at least 50% of key concepts
          score = Math.round(maxPoints * matchRatio);
          feedback = `Partially correct. You included ${matchedKeywords.length} of ${modelKeywords.length} key concepts. The correct answer is: ${correctAnswer}`;
        } else {
          score = 0;
          feedback = `Incorrect. The correct answer is: ${correctAnswer}`;
        }
      }
    }

    return {
      score: score,
      feedback: feedback,
      details: {
        error: error.message,
        gradingMethod: 'fallback',
        questionType: 'fill-in-blank'
      }
    };
  }
};

/**
 * Grade matching questions
 */
const gradeMatching = async (question, answer) => {
  try {
    // Handle both object format { "0": 2, "1": 0 } and array format [{ left: 0, right: 2 }]
    let studentMatches = answer.matchingAnswers || {};
    let normalizedMatches = [];

    if (Array.isArray(studentMatches)) {
      // Already in array format
      normalizedMatches = studentMatches;
    } else if (typeof studentMatches === 'object' && studentMatches !== null) {
      // Convert object format to array format
      normalizedMatches = Object.entries(studentMatches)
        .filter(([key, value]) => value !== null && value !== undefined)
        .map(([key, value]) => ({
          left: parseInt(key),
          right: parseInt(value)
        }));
    }

    // Support both old structure (matchingPairs) and new structure (leftItems/rightItems/correctMatches)
    let correctPairs = question.matchingPairs?.correctPairs || [];
    
    // If using new structure with leftItems/rightItems/correctMatches
    if (correctPairs.length === 0 && question.leftItems && question.rightItems && question.correctMatches) {
      // Convert correctMatches Map to array format
      correctPairs = Array.from(question.correctMatches.entries()).map(([left, right]) => ({
        left: parseInt(left),
        right: right
      }));
    }

    if (normalizedMatches.length === 0) {
      return {
        score: 0,
        feedback: 'No matches provided',
        details: { answerType: 'unanswered' },
        correctedAnswer: 'See correct matching pairs in the answer key'
      };
    }

    let correctCount = 0;
    const totalPairs = correctPairs.length;

    // Check each student match against correct pairs
    for (const studentMatch of normalizedMatches) {
      const isCorrect = correctPairs.some(correctPair =>
        correctPair.left === studentMatch.left && correctPair.right === studentMatch.right
      );
      if (isCorrect) correctCount++;
    }

    const score = Math.round((correctCount / totalPairs) * question.points);
    const feedback = `You got ${correctCount} out of ${totalPairs} matches correct.`;

    return {
      score,
      feedback,
      details: {
        correctMatches: correctCount,
        totalMatches: totalPairs,
        accuracy: correctCount / totalPairs,
        answerType: 'matching'
      }
    };
  } catch (error) {
    console.error('Error grading matching:', error);
    return {
      score: 0,
      feedback: 'Error grading matching question',
      details: { error: error.message }
    };
  }
};

/**
 * Grade ordering questions
 */
const gradeOrdering = async (question, answer) => {
  try {
    const studentOrder = answer.orderingAnswer || [];
    const correctOrder = question.itemsToOrder?.correctOrder || [];

    if (studentOrder.length === 0) {
      return {
        score: 0,
        feedback: 'No order provided',
        details: { answerType: 'unanswered' },
        correctedAnswer: 'See correct order in the answer key'
      };
    }

    // Calculate partial credit for ordering
    let score = 0;
    const totalItems = correctOrder.length;

    // Award points for items in correct positions
    for (let i = 0; i < Math.min(studentOrder.length, correctOrder.length); i++) {
      if (studentOrder[i] === correctOrder[i]) {
        score += question.points / totalItems;
      }
    }

    score = Math.round(score);
    const feedback = `Your ordering is ${Math.round((score / question.points) * 100)}% correct.`;

    return {
      score,
      feedback,
      details: {
        studentOrder,
        correctOrder,
        accuracy: score / question.points,
        answerType: 'ordering'
      }
    };
  } catch (error) {
    console.error('Error grading ordering:', error);
    return {
      score: 0,
      feedback: 'Error grading ordering question',
      details: { error: error.message }
    };
  }
};

/**
 * Grade drag-drop questions
 */
const gradeDragDrop = async (question, answer) => {
  try {
    const studentPlacements = answer.dragDropAnswer || [];
    const correctPlacements = question.dragDropData?.correctPlacements || [];

    if (studentPlacements.length === 0) {
      return {
        score: 0,
        feedback: 'No items placed',
        details: { answerType: 'unanswered' },
        correctedAnswer: 'See correct placements in the answer key'
      };
    }

    let correctCount = 0;
    const totalPlacements = correctPlacements.length;

    // Check each placement
    for (const studentPlacement of studentPlacements) {
      const isCorrect = correctPlacements.some(correctPlacement =>
        correctPlacement.item === studentPlacement.item &&
        correctPlacement.zone === studentPlacement.zone
      );
      if (isCorrect) correctCount++;
    }

    const score = Math.round((correctCount / totalPlacements) * question.points);
    const feedback = `You placed ${correctCount} out of ${totalPlacements} items correctly.`;

    return {
      score,
      feedback,
      details: {
        correctPlacements: correctCount,
        totalPlacements,
        accuracy: correctCount / totalPlacements,
        answerType: 'drag_drop'
      }
    };
  } catch (error) {
    console.error('Error grading drag-drop:', error);
    return {
      score: 0,
      feedback: 'Error grading drag-drop question',
      details: { error: error.message }
    };
  }
};

/**
 * Use AI to check if an answer is correct
 */
const checkAnswerWithAI = async (questionText, studentAnswer, modelAnswer, questionType) => {
  try {
    // Ensure all inputs are proper strings
    const cleanQuestionText = String(questionText || '').trim();
    const cleanStudentAnswer = String(studentAnswer || '').trim();
    const cleanModelAnswer = String(modelAnswer || '').trim();

    if (!cleanStudentAnswer) {
      return false;
    }

    let prompt = '';

    if (questionType === 'multiple-choice') {
      // Truncate long inputs to prevent timeout - reduced length for faster processing
      const MAX_LENGTH = 200;
      const truncatedQuestion = cleanQuestionText.length > MAX_LENGTH ? cleanQuestionText.substring(0, MAX_LENGTH) + '...' : cleanQuestionText;
      const truncatedModel = cleanModelAnswer.length > MAX_LENGTH ? cleanModelAnswer.substring(0, MAX_LENGTH) + '...' : cleanModelAnswer;
      const truncatedStudent = cleanStudentAnswer.length > MAX_LENGTH ? cleanStudentAnswer.substring(0, MAX_LENGTH) + '...' : cleanStudentAnswer;

      prompt = `Is this MCQ answer correct? Q: "${truncatedQuestion}". Correct: "${truncatedModel}". Student: "${truncatedStudent}". Match letter OR text, case-insensitive. Respond "true" or "false".`;
    } else {
      // Truncate long inputs to prevent timeout
      const MAX_LENGTH = 800;
      const truncatedQuestion = cleanQuestionText.length > MAX_LENGTH ? cleanQuestionText.substring(0, MAX_LENGTH) + '...' : cleanQuestionText;
      const truncatedModel = cleanModelAnswer.length > MAX_LENGTH ? cleanModelAnswer.substring(0, MAX_LENGTH) + '...' : cleanModelAnswer;
      const truncatedStudent = cleanStudentAnswer.length > MAX_LENGTH ? cleanStudentAnswer.substring(0, MAX_LENGTH) + '...' : cleanStudentAnswer;

      prompt = `Are these semantically equivalent? Q: "${truncatedQuestion}". Model: "${truncatedModel}". Student: "${truncatedStudent}". Abbreviations and synonyms are equivalent. Respond "true" or "false".`;
    }

    // Use the Groq generateContent function
    const response = await groqClient.generateContent(prompt, {
      model: 'smart',
      jsonMode: false,
      temperature: 0.1,
      maxTokens: 256
    });

    // The generateContent function already returns processed text
    const responseText = response.text.trim().toLowerCase();

    return responseText === 'true';
  } catch (error) {
    console.error('Error checking answer with AI:', error);
    // Enhanced semantic fallback comparison
    const cleanStudent = String(studentAnswer || '').toLowerCase().trim();
    const cleanModel = String(modelAnswer || '').toLowerCase().trim();

    // Remove punctuation for better comparison
    const cleanStudentNoPunct = cleanStudent.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").replace(/\s+/g, " ").trim();
    const cleanModelNoPunct = cleanModel.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").replace(/\s+/g, " ").trim();

    // Check for exact match
    if (cleanStudentNoPunct === cleanModelNoPunct) {
      return true;
    }

    // Check for abbreviation/expansion matches
    if (cleanModelNoPunct.includes(cleanStudentNoPunct) && cleanStudentNoPunct.length >= 2) {
      return true; // Student provided abbreviation
    }

    if (cleanStudentNoPunct.includes(cleanModelNoPunct) && cleanModelNoPunct.length >= 2) {
      return true; // Student provided expansion
    }

    // Use the enhanced semantic mappings
    return areSemanticallySimilar(cleanStudent, cleanModel);
  }
};

module.exports = {
  gradeQuestionByType,
  gradeMultipleChoice,
  gradeTrueFalse,
  gradeFillInBlank,
  gradeMatching,
  gradeOrdering,
  gradeDragDrop,
  checkAnswerWithAI,
  areSemanticallySimilar,
  SEMANTIC_MAPPINGS,
  parseAnswerContent,
  validateAnswerRelevance,
  verifyGradingWithAI
};
