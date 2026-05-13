// Enhanced grading functions for different question types
const { gradeOpenEndedAnswer } = require('./aiGrading');
const geminiClient = require('./geminiClient');

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
        return gradeFillInBlank(question, answer, modelAnswer);

      case 'matching':
        return gradeMatching(question, answer);

      case 'ordering':
        return gradeOrdering(question, answer);

      case 'drag-drop':
        return gradeDragDrop(question, answer);

      case 'open-ended':
        console.log(`🤖 AI grading open-ended question ${question._id} in section ${question.section}`);

        // Enhanced AI grading for sections B and C with optimized processing
        const sectionType = question.section === 'C' ? 'essay/long-answer' : 'short-answer';
        console.log(`📝 Processing ${sectionType} question in section ${question.section}`);

        const openEndedResult = await gradeOpenEndedAnswer(
          answer.textAnswer || '',
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
            gradingMethod: `enhanced_ai_grading_section_${question.section}`,
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

    // Find the selected option in the question with enhanced matching
    let option = null;

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
      // Check if modelAnswer is a letter (A, B, C, D)
      const modelAnswerLetter = modelAnswer.trim().toUpperCase();
      if (['A', 'B', 'C', 'D'].includes(modelAnswerLetter)) {
        correctOption = question.options.find(opt =>
          opt.letter && opt.letter.toUpperCase() === modelAnswerLetter
        );
      } else {
        // modelAnswer is text, find matching option
        correctOption = question.options.find(opt =>
          opt.text && opt.text.toLowerCase().trim() === modelAnswer.toLowerCase().trim()
        );
      }
    }

    // Use AI to determine correctness with complete information
    if (option && correctOption) {
      // Prepare detailed information for AI grading
      const studentAnswerForAI = `${option.letter}. ${option.text}`;
      const correctAnswerForAI = `${correctOption.letter}. ${correctOption.text}`;

      console.log(`AI Grading Input:`);
      console.log(`- Question: ${question.text}`);
      console.log(`- Student selected: ${studentAnswerForAI}`);
      console.log(`- Correct answer: ${correctAnswerForAI}`);

      try {
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
        // Fallback to direct comparison
        isCorrect = option.letter === correctOption.letter ||
                   option.text === correctOption.text ||
                   option._id === correctOption._id;
      }
    } else if (option) {
      // Check if the selected option is marked as correct
      isCorrect = option.isCorrect === true;
    } else if (correctOption) {
      // No option found for selection, but we have a correct option
      // Check if selectedOption matches the correct option text or letter
      const selectedLower = selectedOption.toLowerCase().trim();
      const correctText = correctOption.text.toLowerCase().trim();
      const correctLetter = correctOption.letter ? correctOption.letter.toLowerCase() : '';

      isCorrect = selectedLower === correctText ||
                 selectedLower === correctLetter ||
                 selectedLower === correctLetter.toUpperCase();
    } else {
      // Last resort: use AI with available information
      try {
        const studentAnswerForAI = option ? `${option.letter}. ${option.text}` : selectedOption;
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
        gradingMethod: 'ai_assisted'
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

    if (modelAnswer) {
      // Use AI to determine correctness
      isCorrect = await checkAnswerWithAI(question.text, selectedOption, modelAnswer, 'true-false');
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

    // If no model answer is available, try to extract from question text
    if (!correctAnswer) {
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

    // Use AI grading for fill-in-blank questions
    const gradingResult = await gradeOpenEndedAnswer(
      studentAnswer,
      correctAnswer,
      question.points || 1,
      question.text || '',
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
    const studentMatches = answer.matchingAnswers || [];
    const correctPairs = question.matchingPairs?.correctPairs || [];

    if (studentMatches.length === 0) {
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
    for (const studentMatch of studentMatches) {
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
      prompt = `
Determine if the student's answer is correct for this multiple-choice question.

Question: ${cleanQuestionText}
Correct Answer: ${cleanModelAnswer}
Student Answer: ${cleanStudentAnswer}

MULTIPLE CHOICE GRADING RULES:
1. If the student answer contains the same letter (A, B, C, D) as the correct answer, it's CORRECT
2. If the student answer contains the same text content as the correct answer, it's CORRECT
3. If the student selected "A. Option Text" and the correct answer is "A. Option Text", it's CORRECT
4. If the student selected "Option Text" and the correct answer is "A. Option Text", it's CORRECT
5. Case doesn't matter: "a" = "A", "option text" = "Option Text"
6. Consider semantic equivalence: "WAN" = "Wide Area Network", "CPU" = "Central Processing Unit"

EXAMPLES:
- Student: "A. Proteus", Correct: "A. Proteus" → CORRECT
- Student: "Proteus", Correct: "A. Proteus" → CORRECT
- Student: "A", Correct: "A. Proteus" → CORRECT
- Student: "B. AutoCAD", Correct: "A. Proteus" → INCORRECT

Respond with only "true" if the student answer is correct, or "false" if incorrect.
`;
    } else {
      prompt = `
Determine if the student's answer is semantically equivalent to the model answer for this ${questionType} question.

Question: ${cleanQuestionText}
Model Answer: ${cleanModelAnswer}
Student Answer: ${cleanStudentAnswer}

SEMANTIC EQUIVALENCE RULES:
- "WAN" = "WAN (Wide Area Network)" = "Wide Area Network" (ALL CORRECT)
- "CPU" = "CPU (Central Processing Unit)" = "Central Processing Unit" (ALL CORRECT)
- "RAM" = "RAM (Random Access Memory)" = "Random Access Memory" (ALL CORRECT)
- "OS" = "OS (Operating System)" = "Operating System" (ALL CORRECT)
- Case doesn't matter: "wan" = "WAN" = "Wan" (ALL CORRECT)

IMPORTANT: If the student answer is an abbreviation, expansion, or synonym of the model answer, it should be considered CORRECT.

Respond with only "true" if the answers are semantically equivalent, or "false" if they are different concepts.
`;
    }

    // Use the enhanced generateContent function
    const response = await geminiClient.generateContent(prompt);

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
  SEMANTIC_MAPPINGS
};
