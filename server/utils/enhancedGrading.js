// Enhanced grading functions for different question types
const { gradeOpenEndedAnswer } = require('./aiGrading');
const groqClient = require('./groqClient');

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
  if (!answer || answer.trim().length < 10) {
    return { isValid: false, reason: 'Answer too short. Open-ended questions require detailed explanations showing your work and reasoning.' };
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

  // Check for answers that are just mathematical expressions without explanation
  const isJustMathExpression = /^[\d\+\-\*\/\=\(\)\s\\a-zA-Z]+$/.test(cleanAnswer) && cleanAnswer.length < 20;
  if (isJustMathExpression) {
    return { isValid: false, reason: 'Your answer appears to be just a mathematical expression without explanation. Please show your working and explain your reasoning.' };
  }

  // Check for obvious placeholder answers
  const placeholderPatterns = [
    /^[a-j],?\s*$/,  // Single letter like "a," or "a"
    /^[a-j],?\s*[x+=\d]*$/,  // Like "a,x+2=8" or similar
    /^question\s*\d*$/i,  // "question 1" etc
    /^[.\s]+$/,  // Just dots or spaces
  ];

  for (const pattern of placeholderPatterns) {
    if (pattern.test(cleanAnswer)) {
      return { isValid: false, reason: 'Answer appears to be a placeholder or label' };
    }
  }

  // Check if answer is just repeating the question label (a, b, c, etc)
  if (/^[a-j][,\s]*$/.test(cleanAnswer) && cleanAnswer.length <= 3) {
    return { isValid: false, reason: 'Answer appears to be just a question label' };
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
        
        // Validate answer relevance before grading
        const relevanceCheck = validateAnswerRelevance(parsedAnswer, question.text);
        if (!relevanceCheck.isValid) {
          console.log(`❌ Answer validation failed: ${relevanceCheck.reason}`);
          return {
            score: 0,
            feedback: `Your answer appears to be invalid: ${relevanceCheck.reason}. Please provide a proper answer to the question.`,
            correctedAnswer: modelAnswer || question.correctAnswer || 'Model answer not available',
            details: {
              section: question.section,
              questionType: 'open-ended',
              gradingMethod: 'answer_validation_failed',
              validationReason: relevanceCheck.reason
            }
          };
        }

        // Enhanced AI grading for sections B and C with optimized processing
        const sectionType = question.section === 'C' ? 'essay/long-answer' : 'short-answer';
        console.log(`📝 Processing ${sectionType} question in section ${question.section}`);

        const openEndedResult = await gradeOpenEndedAnswer(
          parsedAnswer,
          modelAnswer || question.correctAnswer,
          question.points,
          question.text,
          question.type,
          question.section // Pass section for optimized grading
        );

        // Enhance the result with section information and better feedback
        return {
          ...openEndedResult,
          details: {
            ...openEndedResult.details,
            section: question.section,
            sectionType: sectionType,
            questionType: 'open-ended',
            aiGraded: true,
            gradingMethod: 'enhanced_ai_grading_section',
            processingOptimized: true
          },
          // Ensure we have a proper corrected answer
          correctedAnswer: openEndedResult.correctedAnswer || modelAnswer || question.correctAnswer || 'Model answer not available'
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
        gradingMethod
      }
    };
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
    const selectedOption = answer.selectedOption;

    if (!selectedOption) {
      return {
        score: 0,
        feedback: 'No answer provided',
        details: { answerType: 'unanswered' },
        correctedAnswer: modelAnswer || 'No correct answer available'
      };
    }

    let isCorrect = false;
    let correctAnswer = modelAnswer;

    // Try direct comparison first (more reliable for true/false)
    if (modelAnswer) {
      const selectedLower = selectedOption.toLowerCase().trim();
      const correctLower = modelAnswer.toLowerCase().trim();
      isCorrect = selectedLower === correctLower;
      
      // If direct comparison fails, try AI as fallback
      if (!isCorrect) {
        isCorrect = await checkAnswerWithAI(question.text, selectedOption, modelAnswer, 'true-false');
      }
    } else {
      // Use the question's options
      const correctOption = question.options.find(opt => opt.isCorrect);
      correctAnswer = correctOption?.text || 'True';
      isCorrect = selectedOption.toLowerCase() === correctAnswer.toLowerCase();
    }

    const score = isCorrect ? question.points : 0;
    const feedback = isCorrect
      ? 'Correct!'
      : `Incorrect. The correct answer is: ${correctAnswer}`;

    return {
      score,
      feedback,
      correctedAnswer: correctAnswer,
      details: {
        selectedOption,
        correctAnswer,
        isCorrect,
        answerType: 'true_false'
      }
    };
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
        correctedAnswer: modelAnswer || question.correctAnswer || 'No correct answer available'
      };
    }

    // Get the model answer
    let correctAnswer = modelAnswer || question.correctAnswer || '';
    if (typeof correctAnswer === 'object') {
      correctAnswer = String(correctAnswer).trim();
    } else {
      correctAnswer = String(correctAnswer || '').trim();
    }

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

    // Fallback grading
    const studentAnswer = String(answer.textAnswer || answer.selectedOption || '').trim();
    const correctAnswer = String(modelAnswer || question.correctAnswer || '').trim();

    let score = 0;
    let feedback = 'Error occurred during grading';

    if (studentAnswer && correctAnswer) {
      // Enhanced comparison fallback with semantic matching
      let isCorrect = studentAnswer.toLowerCase() === correctAnswer.toLowerCase() ||
                     correctAnswer.toLowerCase().includes(studentAnswer.toLowerCase()) ||
                     studentAnswer.toLowerCase().includes(correctAnswer.toLowerCase());

      // If not exact match, check semantic equivalence
      if (!isCorrect) {
        isCorrect = areSemanticallySimilar(studentAnswer, correctAnswer);
      }

      score = isCorrect ? (question.points || 1) : 0;
      feedback = isCorrect ? 'Correct answer!' : `Incorrect. The correct answer is: ${correctAnswer}`;
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
  validateAnswerRelevance
};
