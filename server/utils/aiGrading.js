// Import the centralized Gemini client and response handler
const geminiClient = require('./geminiClient');
const { processAIResponse, validateForJSON } = require('./responseHandler');

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

    // Use the enhanced generateContent function from geminiClient

    // Create an enhanced prompt for semantic understanding and grading with section optimization
    const sectionContext = section === 'C' ? 'essay/long-answer requiring comprehensive analysis' : 'short-answer requiring technical accuracy';
    const gradingFocus = section === 'C'
      ? 'depth of understanding, comprehensive explanations, examples, and detailed analysis'
      : 'technical accuracy, key concepts, and precise terminology';

    const prompt = `
You are an expert AI exam grader specializing in academic assessment with deep knowledge of computer systems, technology, and educational standards. Your task is to provide accurate, fair, and constructive grading that recognizes semantic equivalence.

GRADING CONTEXT:
Question Type: ${questionType} (Section ${section} - ${sectionContext})
Question Text: ${cleanQuestionText || 'Not provided'}
Maximum Points: ${maxPoints}
Model Answer: ${cleanModelAnswer}
Student Answer: ${cleanStudentAnswer}
Section Focus: ${gradingFocus}

SEMANTIC GRADING GUIDELINES:
1. RECOGNIZE EQUIVALENT MEANINGS: If the student answer means the same as the model answer, award full points
2. HANDLE ABBREVIATIONS: "WAN" = "WAN (Wide Area Network)" = "Wide Area Network" (all should get full points)
3. ACCEPT SYNONYMS: "CPU" = "Central Processing Unit" = "Processor" = "Central Processor"
4. TECHNICAL TERMS: "RAM" = "Random Access Memory" = "Memory" (in appropriate context)
5. CASE INSENSITIVE: "cpu" = "CPU" = "Cpu" (all equivalent)
6. PARTIAL EXPANSIONS: "Hard disk" = "Hard disk drive" = "HDD" (all correct)
7. COMMON VARIATIONS: "Operating System" = "OS" = "System Software" (context dependent)

SECTION-SPECIFIC GRADING CRITERIA:
${section === 'C' ? `
SECTION C (Essay/Long Answer) CRITERIA:
1. DEPTH OF ANALYSIS (35%): Comprehensive understanding and detailed explanations
2. TECHNICAL ACCURACY (25%): Correct use of technical terms and concepts
3. EXAMPLES & EVIDENCE (20%): Relevant examples and supporting details
4. ORGANIZATION & CLARITY (20%): Well-structured, logical flow, clear expression
` : `
SECTION B (Short Answer) CRITERIA:
1. TECHNICAL ACCURACY (45%): Correct technical terms and precise answers
2. COMPLETENESS (30%): All key points addressed concisely
3. UNDERSTANDING (15%): Clear demonstration of concept knowledge
4. CLARITY (10%): Clear and direct expression
`}

SEMANTIC EQUIVALENCE RULES (MOST IMPORTANT - FOLLOW THESE EXACTLY):
- If student answer is an abbreviation of model answer → AWARD FULL POINTS (${maxPoints})
- If student answer is an expansion of model answer → AWARD FULL POINTS (${maxPoints})
- If student answer means exactly the same thing → AWARD FULL POINTS (${maxPoints})
- Case differences don't matter: "wan" = "WAN" = "Wan" → AWARD FULL POINTS (${maxPoints})
- Technical terms: "CPU" = "Central Processing Unit" → AWARD FULL POINTS (${maxPoints})
- Network terms: "WAN" = "Wide Area Network" → AWARD FULL POINTS (${maxPoints})
- Storage terms: "RAM" = "Random Access Memory" → AWARD FULL POINTS (${maxPoints})
- System terms: "OS" = "Operating System" → AWARD FULL POINTS (${maxPoints})

SPECIFIC EXAMPLES FOR FULL POINTS:
- Model: "WAN (Wide Area Network)" | Student: "WAN" → ${maxPoints}/${maxPoints} points
- Model: "CPU (Central Processing Unit)" | Student: "CPU" → ${maxPoints}/${maxPoints} points
- Model: "Random Access Memory" | Student: "RAM" → ${maxPoints}/${maxPoints} points
- Model: "Operating System" | Student: "OS" → ${maxPoints}/${maxPoints} points
- Model: "Hard Disk Drive" | Student: "Hard disk" → ${maxPoints}/${maxPoints} points
- Model: "Motherboard" | Student: "motherboard" → ${maxPoints}/${maxPoints} points

SECTION-SPECIFIC GRADING GUIDELINES:
${section === 'C' ? `
SECTION C GRADING SCALE:
- Award full points (${maxPoints}) for comprehensive, well-analyzed answers with examples
- Award 75-90% for good understanding with minor gaps in analysis or examples
- Award 50-74% for basic understanding but lacking depth or missing key elements
- Award 25-49% for minimal understanding with significant gaps in analysis
- Award 0-24% for incorrect or irrelevant responses
` : `
SECTION B GRADING SCALE:
- Award full points (${maxPoints}) for technically accurate and complete answers
- Award 75-90% for mostly correct with minor technical inaccuracies
- Award 50-74% for partially correct but missing key technical elements
- Award 25-49% for minimal technical accuracy with major gaps
- Award 0-24% for incorrect or irrelevant technical responses
`}

CRITICAL RULE: DO NOT reduce points for abbreviations, expansions, or case differences if the meaning is correct!

RESPONSE FORMAT:
Return your response as valid JSON with this exact structure:
{
  "score": [number between 0 and ${maxPoints}],
  "feedback": "[Detailed constructive feedback explaining the score, what was done well, and areas for improvement. Be specific about technical concepts and provide guidance for improvement.]",
  "correctedAnswer": "[Provide a comprehensive model answer that demonstrates the expected response. Include technical details, examples, and explanations that a student should know.]",
  "keyConceptsPresent": ["[concept1]", "[concept2]"],
  "keyConceptsMissing": ["[concept3]", "[concept4]"],
  "confidenceLevel": "[high|medium|low]",
  "partialCreditBreakdown": {
${section === 'C' ? `
    "depthOfAnalysis": [score out of ${Math.round(maxPoints * 0.35)}],
    "technicalAccuracy": [score out of ${Math.round(maxPoints * 0.25)}],
    "examplesEvidence": [score out of ${Math.round(maxPoints * 0.20)}],
    "organizationClarity": [score out of ${Math.round(maxPoints * 0.20)}]
` : `
    "technicalAccuracy": [score out of ${Math.round(maxPoints * 0.45)}],
    "completeness": [score out of ${Math.round(maxPoints * 0.30)}],
    "understanding": [score out of ${Math.round(maxPoints * 0.15)}],
    "clarity": [score out of ${Math.round(maxPoints * 0.10)}]
`}  },
  "improvementSuggestions": ["[specific suggestion 1]", "[specific suggestion 2]"],
  "technicalAccuracy": "[assessment of technical correctness]"
}

IMPORTANT:
- Provide specific, actionable feedback
- Be encouraging while being honest about areas needing improvement
- Ensure the total score matches the sum of partial credit components
- Only return valid JSON, no additional text
`;

    // Generate content with proper error handling and timeout
    try {
      console.log('Sending grading request to Gemini API...');

      // Add timeout to prevent hanging - reduced for faster submissions
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('AI grading timeout after 5 seconds')), 5000);
      });

      // Use the enhanced generateContent function with timeout
      const response = await Promise.race([
        geminiClient.generateContent(prompt),
        timeoutPromise
      ]);

      console.log('Received grading response from Gemini API');

      // Process the AI response with enhanced error handling
      let rawText = '';
      try {
        rawText = processAIResponse(response);
        console.log(`Processed AI response (${rawText.length} chars)`);
      } catch (responseError) {
        console.error('Error processing AI response:', responseError);
        // Try direct text extraction as fallback
        if (response && response.text) {
          rawText = response.text;
        } else if (typeof response === 'string') {
          rawText = response;
        } else {
          throw new Error('Unable to extract text from AI response');
        }
      }

      // Enhanced JSON extraction and validation
      let jsonText = rawText;

      // Remove markdown formatting
      jsonText = jsonText.replace(/```json\s*/g, '').replace(/```\s*/g, '');

      // Find JSON object boundaries
      const jsonStart = jsonText.indexOf('{');
      const jsonEnd = jsonText.lastIndexOf('}');

      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        jsonText = jsonText.substring(jsonStart, jsonEnd + 1);
      } else {
        console.error('No valid JSON object found in AI response');
        console.log('Raw response sample:', rawText.substring(0, 300) + '...');
        throw new Error('No valid JSON object found in AI response');
      }
      console.log('Successfully extracted and validated JSON from AI grading response');

      // Parse the JSON response
      try {
        const grading = JSON.parse(jsonText);

        // Validate the response structure
        if (typeof grading.score !== 'number' || grading.score < 0 || grading.score > maxPoints) {
          console.warn('Invalid score in AI response, using fallback');
          throw new Error('Invalid score in AI response');
        }

        return {
          score: Math.round(grading.score * 100) / 100, // Round to 2 decimal places
          feedback: grading.feedback || 'No feedback provided',
          correctedAnswer: grading.correctedAnswer || modelAnswer || 'Model answer not available',
          details: {
            keyConceptsPresent: grading.keyConceptsPresent || [],
            keyConceptsMissing: grading.keyConceptsMissing || [],
            confidenceLevel: grading.confidenceLevel || 'medium',
            partialCreditBreakdown: grading.partialCreditBreakdown || {},
            improvementSuggestions: grading.improvementSuggestions || [],
            technicalAccuracy: grading.technicalAccuracy || 'Not assessed',
            questionType: questionType,
            gradingMethod: 'enhanced_ai',
            aiGraded: true
          }
        };
      } catch (parseError) {
        console.error('Error parsing AI response:', parseError);
        console.log('Raw AI response:', jsonText.substring(0, 200) + '...');

        // Enhanced fallback scoring
        return generateFallbackScore(studentAnswer, modelAnswer, maxPoints, 'AI parsing failed');
      }
    } catch (aiError) {
      console.error('Error generating AI content:', aiError);
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

    // Create a focused, fast AI prompt for grading without model answer
    const prompt = `
You are an expert grader for ${questionType} questions. Grade this student answer based on technical accuracy, completeness, and understanding.

QUESTION: ${questionText}

STUDENT ANSWER: ${studentAnswer}

GRADING CRITERIA:
- Technical accuracy (40% of score)
- Completeness of explanation (30% of score)
- Understanding demonstrated (20% of score)
- Clarity and organization (10% of score)

RESPONSE FORMAT (JSON only):
{
  "score": [number between 0 and ${maxPoints}],
  "feedback": "[Detailed feedback explaining the score and areas for improvement]",
  "correctedAnswer": "[Provide a comprehensive model answer showing what a complete response should include]",
  "keyConceptsPresent": ["[concept1]", "[concept2]"],
  "keyConceptsMissing": ["[concept3]", "[concept4]"],
  "confidenceLevel": "[high|medium|low]",
  "technicalAccuracy": "[assessment of technical correctness]",
  "improvementSuggestions": ["[suggestion1]", "[suggestion2]"]
}`;

    // Use faster AI processing with timeout and better response handling
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('AI grading timeout after 3 seconds')), 3000);
    });

    const response = await Promise.race([
      geminiClient.generateContent(prompt),
      timeoutPromise
    ]);

    // Process the AI response properly
    let responseText = '';
    if (response && response.text) {
      responseText = response.text.trim();
    } else if (response && typeof response === 'string') {
      responseText = response.trim();
    } else {
      throw new Error('Invalid AI response format');
    }

    // Clean up the response text to extract JSON
    let jsonText = responseText;

    // Remove any markdown formatting
    jsonText = jsonText.replace(/```json\s*/g, '').replace(/```\s*/g, '');

    // Find JSON object in the response
    const jsonStart = jsonText.indexOf('{');
    const jsonEnd = jsonText.lastIndexOf('}');

    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      jsonText = jsonText.substring(jsonStart, jsonEnd + 1);
    }

    console.log('Processed AI response for JSON parsing:', jsonText.substring(0, 200) + '...');

    try {
      const grading = JSON.parse(jsonText);

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
