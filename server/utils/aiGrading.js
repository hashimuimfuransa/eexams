// Import the centralized Groq client
const groqClient = require('./groqClient');

/**
 * Enhanced AI grading system with improved accuracy and reliability
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

    // Enhanced input validation
    if (!studentAnswer || typeof studentAnswer !== 'string' || studentAnswer.trim().length === 0) {
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
    const cleanStudentAnswer = String(studentAnswer).trim().replace(/\s+/g, ' ');
    const cleanModelAnswer = String(modelAnswer || '').trim().replace(/\s+/g, ' ');
    const cleanQuestionText = String(questionText || '').trim().replace(/\s+/g, ' ');

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
      // For other question types, check for minimum answer length
      if (cleanStudentAnswer.length < 5) {
        return {
          score: Math.round(maxPoints * 0.1), // Give minimal credit for very short answers
          feedback: 'Your answer is too brief. Please provide more detailed explanation.',
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
    return generateFallbackScore(studentAnswer, modelAnswer, maxPoints, error.message);
  }
};

/**
 * Generate enhanced fallback score when AI grading fails
 * @param {string} studentAnswer - The student's answer
 * @param {string} modelAnswer - The model answer
 * @param {number} maxPoints - Maximum points
 * @param {string} errorReason - Reason for fallback
 * @returns {Object} - Fallback grading result
 */
const generateFallbackScore = (studentAnswer, modelAnswer, maxPoints, errorReason) => {
  console.log('Generating enhanced fallback score...');

  // Enhanced fallback grading mechanism
  const studentAns = String(studentAnswer || '').toLowerCase().trim();
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

  // Handle empty model answer
  if (!modelAns) {
    // Give partial credit for any answer when no model answer is available
    const score = Math.round(maxPoints * 0.5);
    return {
      score: score,
      feedback: 'Answer provided but cannot be fully evaluated due to missing model answer',
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

  // Check if student answer is contained in model answer (abbreviation case)
  // e.g., "WAN" is contained in "WAN (Wide Area Network)"
  if (cleanModelAns.includes(cleanStudentAns) && cleanStudentAns.length >= 2) {
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
  if (cleanStudentAns.includes(cleanModelAns) && cleanModelAns.length >= 2) {
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

  // Check if student answer contains key phrases from model answer
  // Use a more lenient approach - include words of 3 or more characters
  const modelKeywords = modelAns.split(/\s+/).filter(word => word.length >= 3);

  // Count matches, giving partial credit for partial matches
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

  // Calculate match percentage with a minimum score to avoid zero scores
  const matchPercentage = modelKeywords.length > 0
    ? Math.max(0.2, matchCount / modelKeywords.length) // Minimum 20% score
    : 0.2;

  // Assign score based on keyword match percentage
  const score = Math.round(matchPercentage * maxPoints);

  // Generate appropriate feedback based on score
  let feedback;
  if (score >= maxPoints * 0.8) {
    feedback = 'Your answer covers most of the key concepts from the model answer.';
  } else if (score >= maxPoints * 0.5) {
    feedback = 'Your answer includes some important concepts, but is missing others.';
  } else if (score >= maxPoints * 0.3) {
    feedback = 'Your answer touches on a few key points, but needs more development.';
  } else {
    feedback = 'Your answer is missing most of the key concepts expected in the model answer.';
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

    // Truncate long inputs to prevent timeout
    const MAX_LENGTH = 1500;
    const truncatedQuestion = questionText.length > MAX_LENGTH ? questionText.substring(0, MAX_LENGTH) + '...' : questionText;
    const truncatedAnswer = studentAnswer.length > MAX_LENGTH ? studentAnswer.substring(0, MAX_LENGTH) + '...' : studentAnswer;

    // Create a focused, fast AI prompt for grading without model answer
    const prompt = `Grade answer (0-${maxPoints}). Q: ${truncatedQuestion}. A: ${truncatedAnswer}.
Return JSON: {score,feedback,correctedAnswer,keyConceptsPresent[],keyConceptsMissing[],confidenceLevel,technicalAccuracy,improvementSuggestions[]}`;

    // Use Groq client for grading without model answer
    const response = await groqClient.generateContent(prompt, {
      model: 'balanced',
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

      return {
        score: Math.round(grading.score * 100) / 100,
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
          aiGraded: true
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

    // Final fallback
    const score = Math.min(Math.round(maxPoints * 0.5), maxPoints);
    return {
      score: score,
      feedback: 'Answer provided but detailed analysis unavailable. Please review with instructor.',
      correctedAnswer: 'Model answer not available',
      details: {
        questionType: questionType,
        gradingMethod: 'fallback_no_model',
        error: error.message
      }
    };
  }
};

module.exports = {
  gradeOpenEndedAnswer,
  gradeWithoutModelAnswer
};
