const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const mammoth = require('mammoth');
// Import the centralized Groq client for AI-assisted categorization
const groqClient = require('./groqClient');

const execAsync = promisify(exec);

/**
 * Parse a PDF file using Python script
 * @param {string} filePath - Path to the PDF file
 * @returns {Promise<string>} - Extracted text
 */
const parsePdf = async (filePath) => {
  try {
    console.log(`Parsing PDF file using Python: ${filePath}`);
    
    // Path to the Python script
    const scriptPath = path.join(__dirname, '../pdf_extractor.py');
    
    // Execute Python script
    const { stdout, stderr } = await execAsync(`python3 "${scriptPath}" "${filePath}"`);
    
    if (stderr) {
      console.error('Python script stderr:', stderr);
    }
    
    // Parse the JSON output
    const result = JSON.parse(stdout);
    
    if (result.error) {
      throw new Error(result.error);
    }
    
    if (!result.text || result.text.trim().length === 0) {
      console.error('PDF parsing returned empty text');
      throw new Error('PDF parsing returned empty text. The PDF may be image-based or corrupted.');
    }

    console.log(`Successfully parsed PDF, extracted ${result.text.length} characters`);
    console.log(`PDF content preview: ${result.text.substring(0, 200)}...`);

    return result.text;
  } catch (error) {
    console.error('Error parsing PDF:', error);
    
    // Check if Python is not available
    if (error.message.includes('python') || error.message.includes('Python')) {
      throw new Error('Python is not installed or not in PATH. Please install Python and pdfplumber (pip install pdfplumber).');
    }
    
    throw new Error(`Failed to parse PDF file: ${error.message}. The PDF may be image-based, corrupted, or password-protected.`);
  }
};

/**
 * Parse a Word document with enhanced formatting preservation
 * @param {string} filePath - Path to the Word document
 * @returns {Promise<string>} - Extracted text with structure preserved
 */
const parseWord = async (filePath) => {
  return new Promise((resolve, reject) => {
    try {
      console.log(`Parsing Word document: ${filePath}`);
      const dataBuffer = fs.readFileSync(filePath);

      // Use mammoth to extract raw text with better structure preservation
      mammoth.extractRawText({ 
        buffer: dataBuffer,
        styleMap: [
          "p[style-name='Heading 1'] => h1:fresh",
          "p[style-name='Heading 2'] => h2:fresh",
          "p[style-name='Heading 3'] => h3:fresh",
          "p[style-name='Title'] => h1:title:fresh"
        ]
      })
        .then(result => {
          // Check if we got any text
          if (!result.value || result.value.trim().length === 0) {
            console.error('Word document parsing returned empty text');
            reject(new Error('Word document parsing returned empty text'));
            return;
          }

          // Enhance the extracted text with structure markers
          let enhancedText = result.value;
          
          // Add section markers for better AI parsing
          enhancedText = enhancedText
            .replace(/SECTION\s+[A-C]/gi, (match) => `\n--- ${match.toUpperCase()} ---\n`)
            .replace(/PART\s+[A-C]/gi, (match) => `\n--- ${match.toUpperCase()} ---\n`)
            .replace(/^[A-C]\.\s+/gm, (match) => `\n--- SECTION ${match[0]} ---\n${match}`);

          console.log(`Successfully parsed Word document, extracted ${enhancedText.length} characters`);
          console.log(`Word document content preview: ${enhancedText.substring(0, 200)}...`);

          // Log any warnings
          if (result.messages && result.messages.length > 0) {
            console.log('Word document parsing warnings:', result.messages);
          }

          resolve(enhancedText);
        })
        .catch(error => {
          console.error('Error parsing Word document:', error);
          reject(new Error(`Failed to parse Word document: ${error.message}`));
        });
    } catch (error) {
      console.error('Error reading Word document:', error);
      reject(new Error(`Failed to read Word document: ${error.message}`));
    }
  });
};

/**
 * Extract questions directly from text without using AI
 * @param {string} text - Text extracted from document
 * @returns {Promise<Object>} - Structured questions
 */
/**
 * Helper function to add an option to a multiple choice question
 * @param {Object} question - The question object
 * @param {string} letter - The option letter (A, B, C, D)
 * @param {string} text - The option text
 */
const addOptionToQuestion = (question, letter, text) => {
  // Check if this option already exists to avoid duplicates
  const optionExists = question.options.some(opt =>
    opt.text.toLowerCase() === text.toLowerCase() ||
    opt.letter === letter
  );

  if (!optionExists) {
    // Add the option to the question with both letter and value properties
    question.options.push({
      letter: letter.toUpperCase(),
      text: text,
      value: letter.toLowerCase(), // Add value property for frontend compatibility
      isCorrect: false
    });

    console.log(`Added option ${letter.toUpperCase()} to question ${question.id}: "${text.substring(0, 30)}..."`);
  } else {
    console.log(`Skipped duplicate option ${letter} for question ${question.id}: "${text.substring(0, 30)}..."`);
  }
};

/**
 * Enhanced AI-powered question extraction engine
 * @param {string} text - Text extracted from document
 * @param {Object} answerData - Pre-loaded answer data
 * @returns {Promise<Object>} - Structured exam with questions
 */
const extractQuestionsWithEnhancedAI = async (text, answerData = { answers: {} }) => {
  try {
    console.log('Starting enhanced AI question extraction...');

    // Use full text to ensure all questions are captured
    // No truncation - we want to extract ALL questions from the document
    const fullText = text;

    // Create a comprehensive prompt for question extraction
    const prompt = `You are an expert exam document parser. Extract ALL questions and their answers from the provided text exactly as they appear in the document.

CRITICAL INSTRUCTIONS:
1. Extract EVERY question from the document - do not skip any
2. Preserve the exact wording of questions and answers as they appear
3. Include all options for multiple choice questions with their correct letter labels (A, B, C, D, etc.)
4. Identify and mark the correct answer for each multiple choice question
5. Extract question numbers if they exist
6. Preserve the section structure (Section A, B, C, etc.)
7. Extract all question types: multiple-choice, true-false, fill-in-blank, short answer, essay, matching, ordering

SPECIAL HANDLING FOR FILL-IN-THE-BLANK QUESTIONS:
- When you see patterns like "with ______ ______ sides", the blanks represent missing numbers or words
- Infer the missing information from context (e.g., "shape with ______ sides" → likely needs a number like "8" for octagon)
- Preserve the blank markers (_____) in the question text
- Include the inferred answer in the correctAnswer field
- Example: If question is "Name the shape with ______ sides" and answer is "Octagon", the correctAnswer should be "8" or "Octagon (8 sides)"
- Use context clues to determine what number or word belongs in the blank
- For geometric shapes: triangle (3), square (4), pentagon (5), hexagon (6), heptagon (7), octagon (8), nonagon (9), decagon (10)
- For other contexts, use the surrounding text to infer the missing information

SPECIAL HANDLING FOR QUESTIONS WITH SUBQUESTIONS (a, b, c, etc.):
- Many questions in Section C have subquestions labeled a), b), c) or a., b., c.
- When you detect subquestions, structure them in the "subQuestions" array
- Example structure for a question with subquestions:
{
  "questionNumber": 1,
  "text": "A farmer harvested 245 bags of maize. He sold 123 bags and kept the rest.",
  "type": "open-ended",
  "subQuestions": [
    {
      "text": "How many bags did he keep?",
      "type": "open-ended",
      "correctAnswer": "122 bags",
      "points": 5
    },
    {
      "text": "If each bag weighs 50kg, what was the total weight of the harvested maize?",
      "type": "open-ended",
      "correctAnswer": "12,250 kg",
      "points": 5
    }
  ],
  "points": 10
}
- Extract the main question text separately from subquestions
- Each subquestion should have its own text, type, correctAnswer, and points
- The main question's points should be the sum of all subquestion points
- If subquestions have letter answers (a, b, c), include them in the correctAnswer field

Return valid JSON with this exact structure:
{
  "sections": [
    {
      "name": "A",
      "description": "Multiple Choice, True/False, and Fill-in-the-Blank Questions",
      "questions": [
        {
          "questionNumber": 1,
          "text": "Exact question text from document",
          "type": "multiple-choice",
          "options": [
            {"letter": "A", "text": "Option text as in document", "isCorrect": false},
            {"letter": "B", "text": "Option text as in document", "isCorrect": true},
            {"letter": "C", "text": "Option text as in document", "isCorrect": false},
            {"letter": "D", "text": "Option text as in document", "isCorrect": false}
          ],
          "correctAnswer": "B",
          "points": 1
        }
      ]
    },
    {
      "name": "B",
      "description": "Short Answer Questions",
      "questions": [
        {
          "questionNumber": 1,
          "text": "Exact question text from document",
          "type": "open-ended",
          "correctAnswer": "Model answer if provided in document",
          "points": 5
        }
      ]
    },
    {
      "name": "C",
      "description": "Essay/Long Answer Questions",
      "questions": [
        {
          "questionNumber": 1,
          "text": "Exact question text from document",
          "type": "open-ended",
          "correctAnswer": "Model answer if provided in document",
          "points": 15
        }
      ]
    }
  ]
}

Question types: multiple-choice, true-false, fill-in-blank, open-ended, matching, ordering.

Document text:
${fullText}`;

    console.log('Sending enhanced extraction prompt to Groq AI...');

    // Generate content with Groq AI using JSON mode
    // Use larger maxTokens to handle documents with many questions
    const result = await groqClient.generateContent(prompt, {
      model: 'smart',
      jsonMode: true,
      temperature: 0.1, // Lower temperature for more accurate extraction
      maxTokens: 16384, // Increased to handle larger documents with many questions
      systemPrompt: 'You are an expert AI system specialized in extracting exam questions from academic documents. Extract ALL questions exactly as they appear. Always return valid JSON.'
    });

    console.log('Received response from enhanced AI extraction');

    // Parse the JSON response
    let extractedData;
    try {
      if (result.parsedContent) {
        extractedData = result.parsedContent;
        console.log('Successfully used parsedContent from AI response');
      } else if (result.text) {
        // Clean the response to extract JSON
        const jsonMatch = result.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          extractedData = JSON.parse(jsonMatch[0]);
          console.log('Successfully extracted JSON from AI response text');
        } else {
          throw new Error('No JSON found in AI response');
        }
      } else {
        throw new Error('No response content received');
      }
    } catch (parseError) {
      console.error('Error parsing AI extraction response:', parseError);
      console.error('Response text length:', result.text?.length);
      // Fallback to basic extraction
      return await extractQuestionsDirectly(text, answerData);
    }

    // Validate and enhance the extracted data
    const enhancedData = await validateAndEnhanceExtraction(extractedData, answerData);

    const totalQuestions = enhancedData.sections.reduce((total, section) => total + section.questions.length, 0);
    console.log(`Enhanced AI extraction completed. Found ${totalQuestions} questions`);

    // Log a summary instead of the full object to avoid truncation issues
    if (enhancedData.sections) {
      enhancedData.sections.forEach(section => {
        console.log(`Section ${section.name}: ${section.questions?.length || 0} questions`);
      });
    }

    return enhancedData;

  } catch (error) {
    console.error('Error in enhanced AI extraction:', error);
    // Fallback to existing extraction method
    console.log('Falling back to basic extraction method...');
    return await extractQuestionsDirectly(text, answerData);
  }
};

/**
 * Validate and enhance extracted question data
 * @param {Object} extractedData - Raw extracted data from AI
 * @param {Object} answerData - Pre-loaded answer data
 * @returns {Promise<Object>} - Validated and enhanced data
 */
const validateAndEnhanceExtraction = async (extractedData, answerData) => {
  try {
    console.log('Validating and enhancing extracted data...');

    // Ensure sections exist
    if (!extractedData.sections || !Array.isArray(extractedData.sections)) {
      extractedData.sections = [
        { name: 'A', description: 'Multiple Choice, True/False, and Fill-in-the-Blank Questions', questions: [] },
        { name: 'B', description: 'Short Answer Questions', questions: [] },
        { name: 'C', description: 'Essay Questions', questions: [] }
      ];
    }

    // Count total questions extracted
    let totalQuestions = 0;
    for (const section of extractedData.sections) {
      if (!section.questions) section.questions = [];
      totalQuestions += section.questions.length;
    }

    console.log(`Total questions extracted: ${totalQuestions}`);

    // If no questions were extracted, this is likely an error
    if (totalQuestions === 0) {
      console.warn('No questions extracted - this may indicate an extraction failure');
    }

    // Process each section
    for (const section of extractedData.sections) {
      if (!section.questions) section.questions = [];

      // Process each question in the section
      for (let i = 0; i < section.questions.length; i++) {
        const question = section.questions[i];

        // Validate question structure
        if (!question.text) {
          console.warn(`Question ${i + 1} in section ${section.name} has no text, skipping`);
          section.questions.splice(i, 1);
          i--;
          continue;
        }

        // Set default values
        question.type = question.type || 'open-ended';
        question.points = question.points || (section.name === 'A' ? 1 : section.name === 'B' ? 5 : 15);
        question.options = question.options || [];
        question.correctAnswer = question.correctAnswer || 'Not provided';

        // Ensure question number is set
        if (!question.questionNumber) {
          question.questionNumber = i + 1;
        }

        // Enhance based on question type
        await enhanceQuestionByType(question, answerData);

        // Use pre-loaded answers if available
        const questionNumber = question.questionNumber || (i + 1).toString();
        if (answerData.answers && answerData.answers[questionNumber]) {
          question.correctAnswer = answerData.answers[questionNumber];
          console.log(`Using pre-loaded answer for question ${questionNumber}: ${question.correctAnswer}`);
        }

        // Post-processing for fill-in-blank questions to infer missing numbers
        if (question.type === 'fill-in-blank' || (question.text && question.text.includes('_____'))) {
          question.correctAnswer = enhanceFillInBlankAnswer(question.text, question.correctAnswer);
        }

        // Convert correctAnswer to string if it's an object - do this BEFORE any other processing
        if (question.correctAnswer && typeof question.correctAnswer === 'object') {
          // Check if this is a subquestion structure (keys like a, b, c)
          const keys = Object.keys(question.correctAnswer);
          const hasLetterKeys = keys.some(k => /^[a-z]$/i.test(k));
          
          if (hasLetterKeys && !question.subQuestions) {
            // Parse as subquestions
            question.subQuestions = parseSubquestionsFromObject(question.correctAnswer, question.text);
            question.correctAnswer = 'See subquestions';
            console.log(`Parsed object correctAnswer as subquestions for question ${questionNumber}`);
          } else if (question.type === 'matching' && !question.matchingPairs) {
            // For matching questions, move to matchingPairs field
            question.matchingPairs = question.correctAnswer;
            question.correctAnswer = 'See matching pairs';
            console.log(`Moved object correctAnswer to matchingPairs for question ${questionNumber}`);
          } else {
            // For other types, stringify to prevent database errors
            question.correctAnswer = JSON.stringify(question.correctAnswer);
            console.log(`Converted object correctAnswer to string for question ${questionNumber}`);
          }
        }

        // Ensure subQuestions is always an array if it exists
        if (question.subQuestions && !Array.isArray(question.subQuestions)) {
          console.warn(`subQuestions is not an array for question ${questionNumber}, converting to array`);
          question.subQuestions = [];
        }
      }
    }

    // Log final question count
    const finalTotal = extractedData.sections.reduce((total, section) => total + section.questions.length, 0);
    console.log(`Final validated question count: ${finalTotal}`);

    return extractedData;

  } catch (error) {
    console.error('Error validating extracted data:', error);
    return extractedData; // Return as-is if validation fails
  }
};

/**
 * Enhance fill-in-blank answers by inferring missing numbers from context
 * @param {string} questionText - The question text
 * @param {string} currentAnswer - The current answer
 * @returns {string} - Enhanced answer
 */
const enhanceFillInBlankAnswer = (questionText, currentAnswer) => {
  try {
    // Common shape patterns and their side counts
    const shapePatterns = {
      'triangle': 3,
      'square': 4,
      'rectangle': 4,
      'pentagon': 5,
      'hexagon': 6,
      'heptagon': 7,
      'octagon': 8,
      'nonagon': 9,
      'decagon': 10,
      'dodecagon': 12
    };

    const lowerText = questionText.toLowerCase();
    const lowerAnswer = currentAnswer.toLowerCase();

    // Check if answer is a shape name but missing the number
    for (const [shape, sides] of Object.entries(shapePatterns)) {
      if (lowerAnswer.includes(shape) && !lowerAnswer.includes(sides.toString())) {
        console.log(`Inferring number ${sides} for shape ${shape} in fill-in-blank question`);
        return `${currentAnswer} (${sides} sides)`;
      }
    }

    // Check if question asks for number of sides and answer is just the shape
    if (lowerText.includes('sides') && lowerText.includes('shape')) {
      for (const [shape, sides] of Object.entries(shapePatterns)) {
        if (lowerAnswer.includes(shape)) {
          console.log(`Inferring number ${sides} sides for shape ${shape}`);
          return `${currentAnswer} (${sides} sides)`;
        }
      }
    }

    return currentAnswer;
  } catch (error) {
    console.error('Error enhancing fill-in-blank answer:', error);
    return currentAnswer;
  }
};

/**
 * Parse subquestions from an object with letter keys (a, b, c, etc.)
 * @param {Object} answerObject - Object with letter keys containing answers
 * @param {string} questionText - The main question text to extract subquestion text from
 * @returns {Array} - Array of subquestion objects
 */
const parseSubquestionsFromObject = (answerObject, questionText = '') => {
  try {
    const subQuestions = [];
    const letterOrder = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    
    // Try to extract subquestion text from the main question text
    const subquestionPatterns = questionText.match(/(?:^|\n)[\s]*[a-z][\)\.]?\s*([^.!?]*[.!?]?)/gi) || [];
    
    for (let i = 0; i < letterOrder.length; i++) {
      const letter = letterOrder[i];
      if (answerObject[letter] !== undefined) {
        // Try to get the corresponding subquestion text from the patterns
        let subText = '';
        if (subquestionPatterns[i]) {
          subText = subquestionPatterns[i].trim();
        } else {
          // Fallback: use a generic label
          subText = `Subquestion ${letter.toUpperCase()}`;
        }
        
        subQuestions.push({
          text: subText,
          type: 'open-ended',
          correctAnswer: answerObject[letter],
          points: 5 // Default points per subquestion
        });
      }
    }
    
    console.log(`Parsed ${subQuestions.length} subquestions from object`);
    return subQuestions;
  } catch (error) {
    console.error('Error parsing subquestions from object:', error);
    return [];
  }
};

/**
 * Enhance question based on its type
 * @param {Object} question - Question object to enhance
 * @param {Object} answerData - Answer data for reference
 */
const enhanceQuestionByType = async (question, answerData) => {
  try {
    switch (question.type) {
      case 'multiple-choice':
        // Ensure we have 4 options for MCQs
        if (!question.options || question.options.length < 2) {
          question.options = await generateMCQOptions(question.text);
        }
        // Ensure options have proper structure
        question.options = question.options.map((opt, index) => ({
          text: opt.text || opt,
          letter: opt.letter || String.fromCharCode(65 + index),
          isCorrect: opt.isCorrect || false
        }));
        break;

      case 'true-false':
        // Ensure True/False options exist
        question.options = [
          { text: 'True', letter: 'A', isCorrect: false },
          { text: 'False', letter: 'B', isCorrect: false }
        ];
        break;

      case 'fill-in-blank':
        // Ensure the question has blank markers
        if (!question.text.includes('_____') && !question.text.includes('____')) {
          // Try to identify where blanks should be
          question.text = await identifyBlanksInText(question.text);
        }
        break;

      case 'matching':
        // Structure matching questions properly
        if (!question.matchingPairs) {
          question.matchingPairs = await extractMatchingPairs(question.text);
        }
        break;

      case 'ordering':
        // Structure ordering questions properly
        if (!question.itemsToOrder) {
          question.itemsToOrder = await extractOrderingItems(question.text);
        }
        break;
    }
  } catch (error) {
    console.error(`Error enhancing question type ${question.type}:`, error);
  }
};

/**
 * Generate MCQ options using AI when not found in text
 * @param {string} questionText - The question text
 * @returns {Promise<Array>} - Array of options
 */
const generateMCQOptions = async (questionText) => {
  try {
    const prompt = `
Generate 4 plausible multiple choice options for this question:
"${questionText}"

Return only a JSON array of options in this format:
[
  {"text": "Option A text", "letter": "A", "isCorrect": false},
  {"text": "Option B text", "letter": "B", "isCorrect": false},
  {"text": "Option C text", "letter": "C", "isCorrect": false},
  {"text": "Option D text", "letter": "D", "isCorrect": false}
]

Make the options realistic and academically appropriate. Do not indicate which is correct.
`;

    const result = await groqClient.generateContent(prompt, {
      model: 'fast',
      jsonMode: true,
      temperature: 0.3,
      maxTokens: 1024
    });

    // Extract JSON from response
    let options = result.parsedContent;
    if (!options && result.text) {
      const jsonMatch = result.text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        options = JSON.parse(jsonMatch[0]);
      }
    }
    if (options && Array.isArray(options)) {
      return options;
    }

    // Fallback options
    return [
      { text: 'Option A', letter: 'A', isCorrect: false },
      { text: 'Option B', letter: 'B', isCorrect: false },
      { text: 'Option C', letter: 'C', isCorrect: false },
      { text: 'Option D', letter: 'D', isCorrect: false }
    ];
  } catch (error) {
    console.error('Error generating MCQ options:', error);
    return [
      { text: 'Option A', letter: 'A', isCorrect: false },
      { text: 'Option B', letter: 'B', isCorrect: false },
      { text: 'Option C', letter: 'C', isCorrect: false },
      { text: 'Option D', letter: 'D', isCorrect: false }
    ];
  }
};

/**
 * Identify where blanks should be in fill-in-blank questions
 * @param {string} questionText - The question text
 * @returns {Promise<string>} - Question text with blanks marked
 */
const identifyBlanksInText = async (questionText) => {
  try {
    const prompt = `
Identify where blanks should be placed in this fill-in-the-blank question:
"${questionText}"

Return the question text with blanks marked as _____ (5 underscores).
Only return the modified question text, no explanations.
`;

    const result = await groqClient.generateContent(prompt, {
      model: 'fast',
      jsonMode: false,
      temperature: 0.2,
      maxTokens: 512
    });

    const response = result.text.trim();

    // If AI response looks valid, use it, otherwise return original
    if (response.includes('_____')) {
      return response;
    }

    return questionText + ' _____'; // Add blank at end as fallback
  } catch (error) {
    console.error('Error identifying blanks:', error);
    return questionText + ' _____'; // Add blank at end as fallback
  }
};

/**
 * Extract matching pairs from matching questions
 * @param {string} questionText - The question text
 * @returns {Promise<Object>} - Matching pairs structure
 */
const extractMatchingPairs = async (questionText) => {
  try {
    // First try regex-based extraction for common formats
    const regexResult = extractMatchingPairsRegex(questionText);
    if (regexResult) {
      console.log('Extracted matching pairs using regex:', regexResult);
      return regexResult;
    }

    // Fallback to AI extraction
    const prompt = `
Extract matching pairs from this matching question:
"${questionText}"

Return a JSON object with this structure:
{
  "leftColumn": ["Item 1", "Item 2", "Item 3"],
  "rightColumn": ["Match A", "Match B", "Match C"],
  "correctPairs": [
    {"left": 0, "right": 0},
    {"left": 1, "right": 1},
    {"left": 2, "right": 2}
  ]
}

If you cannot identify clear matching pairs, return null.
`;

    const result = await groqClient.generateContent(prompt, {
      model: 'balanced',
      jsonMode: true,
      temperature: 0.2,
      maxTokens: 1024
    });

    // Use parsed content or extract JSON from response
    if (result.parsedContent) {
      return result.parsedContent;
    } else if (result.text) {
      const jsonMatch = result.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    }

    return null;
  } catch (error) {
    console.error('Error extracting matching pairs:', error);
    return null;
  }
};

/**
 * Extract matching pairs using regex for common formats
 * @param {string} questionText - The question text
 * @returns {Object|null} - Matching pairs structure or null
 */
const extractMatchingPairsRegex = (questionText) => {
  try {
    // Try different separators: -, –, —, |, :, ->
    const separators = ['-', '–', '—', '|', ':', '->'];
    let bestMatch = null;
    let maxPairs = 0;

    for (const separator of separators) {
      const pattern = new RegExp(`([^\\n${separator}]+)\\s*${separator}\\s*([^\\n]+)`, 'g');
      const matches = [];
      let match;

      while ((match = pattern.exec(questionText)) !== null) {
        const left = match[1].trim();
        const right = match[2].trim();
        // Skip if either side is empty or too short
        if (left.length > 1 && right.length > 1) {
          matches.push({ left, right });
        }
      }

      if (matches.length > maxPairs && matches.length >= 2) {
        maxPairs = matches.length;
        bestMatch = {
          leftColumn: matches.map(m => m.left),
          rightColumn: matches.map(m => m.right),
          correctPairs: matches.map((_, index) => ({ left: index, right: index }))
        };
      }
    }

    return bestMatch;
  } catch (error) {
    console.error('Error in regex matching pairs extraction:', error);
    return null;
  }
};

/**
 * Extract items to order from ordering questions
 * @param {string} questionText - The question text
 * @returns {Promise<Object>} - Ordering items structure
 */
const extractOrderingItems = async (questionText) => {
  try {
    const prompt = `
Extract items to be ordered from this ordering/sequencing question:
"${questionText}"

Return a JSON object with this structure:
{
  "items": ["Item 1", "Item 2", "Item 3", "Item 4"],
  "correctOrder": [0, 1, 2, 3]
}

If you cannot identify clear items to order, return null.
`;

    const result = await groqClient.generateContent(prompt, {
      model: 'balanced',
      jsonMode: true,
      temperature: 0.2,
      maxTokens: 1024
    });

    // Use parsed content or extract JSON from response
    if (result.parsedContent) {
      return result.parsedContent;
    } else if (result.text) {
      const jsonMatch = result.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    }

    return null;
  } catch (error) {
    console.error('Error extracting ordering items:', error);
    return null;
  }
};

/**
 * Use AI to extract options for multiple choice questions
 * @param {Array} questions - Array of multiple choice questions
 * @param {string} fullText - The full text of the exam
 * @returns {Promise<void>}
 */
const extractOptionsWithAI = async (questions, fullText) => {
  if (!questions || questions.length === 0) {
    console.log('No multiple choice questions to extract options for');
    return;
  }

  try {
    // Create a prompt for the AI to extract options
    const prompt = `
You are an expert at extracting multiple choice options from exam documents in NESA format.

I have a NESA format exam with the following multiple choice questions in Section A. For each question, identify the options (A, B, C, D) that go with it.

The full exam text is:
${fullText}

This is a Computer Systems exam in NESA format. Section A contains multiple choice questions, each with 4 options labeled A, B, C, and D.

For each question below, extract the options in this JSON format:
[
  {
    "questionNumber": 1,
    "options": [
      {"letter": "A", "text": "Option text here"},
      {"letter": "B", "text": "Option text here"},
      {"letter": "C", "text": "Option text here"},
      {"letter": "D", "text": "Option text here"}
    ]
  },
  {
    "questionNumber": 2,
    "options": [
      {"letter": "A", "text": "Option text here"},
      {"letter": "B", "text": "Option text here"},
      {"letter": "C", "text": "Option text here"},
      {"letter": "D", "text": "Option text here"}
    ]
  }
]

Questions:
${questions.map((q, i) => `${i + 1}. ${q.text}`).join('\n')}

If you can't find the exact options in the text, make educated guesses based on the context of the Computer Systems exam. For example, for a question about computer components, options might include CPU, GPU, RAM, and motherboard.

Only respond with valid JSON containing the options for each question. Do not include any explanations or other text.
`;

    console.log('Sending prompt to Groq AI to extract options...');

    // Generate content with the Groq AI
    const result = await groqClient.generateContent(prompt, {
      model: 'balanced',
      jsonMode: true,
      temperature: 0.2,
      maxTokens: 2048
    });

    let extractedOptions = result.parsedContent;
    let text = result.text;

    console.log('Received response from Groq AI');

    // Try to parse the JSON response
    try {
      // If we don't have parsed content from JSON mode, extract it manually
      if (!extractedOptions && text) {
        // Extract JSON from the response (it might be wrapped in markdown code blocks)
        const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/```\n([\s\S]*?)\n```/) || text.match(/\{[\s\S]*\}/) || text.match(/\[[\s\S]*\]/);

        let jsonText = '';
        if (jsonMatch) {
          jsonText = jsonMatch[1] || jsonMatch[0];
        } else {
          jsonText = text;
        }

        // Parse the JSON
        extractedOptions = JSON.parse(jsonText);
      }

      // Process the extracted options
      if (Array.isArray(extractedOptions)) {
        // If the response is an array of question objects
        extractedOptions.forEach(item => {
          const questionIndex = item.questionNumber - 1;
          if (questionIndex >= 0 && questionIndex < questions.length && item.options) {
            // Clear existing options
            questions[questionIndex].options = [];

            // Add the extracted options
            item.options.forEach(opt => {
              addOptionToQuestion(
                questions[questionIndex],
                opt.letter,
                opt.text
              );
            });

            console.log(`Added ${item.options.length} AI-extracted options to question ${questionIndex + 1}`);
          }
        });
      } else if (extractedOptions.questions) {
        // If the response has a questions property
        extractedOptions.questions.forEach(item => {
          const questionIndex = item.questionNumber - 1;
          if (questionIndex >= 0 && questionIndex < questions.length && item.options) {
            // Clear existing options
            questions[questionIndex].options = [];

            // Add the extracted options
            item.options.forEach(opt => {
              addOptionToQuestion(
                questions[questionIndex],
                opt.letter,
                opt.text
              );
            });

            console.log(`Added ${item.options.length} AI-extracted options to question ${questionIndex + 1}`);
          }
        });
      } else {
        // If the response is a single object with question numbers as keys
        Object.keys(extractedOptions).forEach(key => {
          // Try to extract question number from the key
          const questionMatch = key.match(/\d+/);
          if (questionMatch) {
            const questionIndex = parseInt(questionMatch[0]) - 1;
            if (questionIndex >= 0 && questionIndex < questions.length && extractedOptions[key].options) {
              // Clear existing options
              questions[questionIndex].options = [];

              // Add the extracted options
              extractedOptions[key].options.forEach(opt => {
                addOptionToQuestion(
                  questions[questionIndex],
                  opt.letter,
                  opt.text
                );
              });

              console.log(`Added ${extractedOptions[key].options.length} AI-extracted options to question ${questionIndex + 1}`);
            }
          }
        });
      }

      console.log('Successfully processed AI-extracted options');
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      console.log('AI response:', text);
      throw new Error('Failed to parse AI response');
    }
  } catch (error) {
    console.error('Error extracting options with AI:', error);
    throw error;
  }
};

const extractQuestionsDirectly = async (text, answerData = { answers: {} }) => {
  console.log('Extracting questions directly from text...');
  console.log(`Pre-loaded answer data has ${Object.keys(answerData.answers).length} answers`);

  // Log each answer for debugging
  Object.entries(answerData.answers || {}).forEach(([questionNumber, answer]) => {
    console.log(`Pre-loaded answer for question ${questionNumber}: ${answer}`);
  });

  // Try enhanced AI extraction first
  try {
    console.log('Attempting enhanced AI extraction...');
    const enhancedResult = await extractQuestionsWithEnhancedAI(text, answerData);
    if (enhancedResult && enhancedResult.sections && enhancedResult.sections.length > 0) {
      const totalQuestions = enhancedResult.sections.reduce((total, section) => total + section.questions.length, 0);
      if (totalQuestions > 0) {
        console.log(`Enhanced AI extraction successful! Found ${totalQuestions} questions`);
        return enhancedResult;
      }
    }
  } catch (error) {
    console.error('Enhanced AI extraction failed:', error);
    console.log('Falling back to basic extraction...');
  }

  // Initialize the exam structure for fallback
  const examStructure = {
    sections: [
      {
        name: 'A',
        description: 'Multiple Choice, True/False, and Fill-in-the-Blank Questions',
        questions: []
      },
      {
        name: 'B',
        description: 'Short Answer Questions',
        questions: []
      },
      {
        name: 'C',
        description: 'Long Answer Questions',
        questions: []
      }
    ]
  };

  // Split the text into lines for processing
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

  console.log(`Processing ${lines.length} lines of text`);

  // Variables to track current section and question being processed
  let currentSection = null;
  let currentQuestion = null;
  let inOptions = false;

  // Option letters for multiple choice questions
  const optionLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

  // Pre-process the text to look for NESA format section headers with more comprehensive patterns
  // Enhanced patterns for NESA format section headers
  const nesaSectionAPatterns = [
    /SECTION\s+A\s*:?\s*MULTIPLE\s+CHOICE/i,
    /SECTION\s+A\s*[-–—:]\s*MULTIPLE\s+CHOICE/i,
    /SECTION\s+A\s*\(\s*\d+\s*(?:MARKS|POINTS)\s*\)/i,
    /MULTIPLE\s+CHOICE\s+(?:QUESTIONS|SECTION)/i,
    /SECTION\s+A\s*:?\s*OBJECTIVE/i,
    /PART\s+A\s*:?\s*MULTIPLE\s+CHOICE/i,
    /^A\s*[-–—:]\s*MULTIPLE\s+CHOICE/im,
    /^A\.\s*MULTIPLE\s+CHOICE/im
  ];

  const nesaSectionBPatterns = [
    /SECTION\s+B\s*:?\s*SHORT\s+ANSWER/i,
    /SECTION\s+B\s*[-–—:]\s*SHORT\s+ANSWER/i,
    /SECTION\s+B\s*\(\s*\d+\s*(?:MARKS|POINTS)\s*\)/i,
    /SHORT\s+ANSWER\s+(?:QUESTIONS|SECTION)/i,
    /SECTION\s+B\s*:?\s*THEORY/i,
    /PART\s+B\s*:?\s*SHORT\s+ANSWER/i,
    /^B\s*[-–—:]\s*SHORT\s+ANSWER/im,
    /^B\.\s*SHORT\s+ANSWER/im
  ];

  const nesaSectionCPatterns = [
    /SECTION\s+C\s*:?\s*(?:STRUCTURED|ESSAY)/i,
    /SECTION\s+C\s*[-–—:]\s*(?:STRUCTURED|ESSAY)/i,
    /SECTION\s+C\s*\(\s*\d+\s*(?:MARKS|POINTS)\s*\)/i,
    /(?:STRUCTURED|ESSAY)\s+(?:QUESTIONS|SECTION)/i,
    /SECTION\s+C\s*:?\s*LONG\s+ANSWER/i,
    /PART\s+C\s*:?\s*(?:STRUCTURED|ESSAY)/i,
    /^C\s*[-–—:]\s*(?:STRUCTURED|ESSAY)/im,
    /^C\.\s*(?:STRUCTURED|ESSAY)/im,
    /LONG\s+ANSWER\s+(?:QUESTIONS|SECTION)/i
  ];

  // Check for matches using the enhanced patterns
  const nesaSectionAMatch = nesaSectionAPatterns.some(pattern => text.match(pattern));
  const nesaSectionBMatch = nesaSectionBPatterns.some(pattern => text.match(pattern));
  const nesaSectionCMatch = nesaSectionCPatterns.some(pattern => text.match(pattern));

  // Check if this is a NESA format exam
  const isNesaFormat = nesaSectionAMatch || nesaSectionBMatch || nesaSectionCMatch;

  console.log(`NESA format detection: A=${nesaSectionAMatch}, B=${nesaSectionBMatch}, C=${nesaSectionCMatch}`);

  if (isNesaFormat) {
    console.log('Detected NESA format exam with standard sections');

    // If we have NESA format, ensure we have all three sections in our structure
    if (nesaSectionAMatch) {
      console.log('Pre-detected Section A: Multiple Choice Questions');
      // Section A is already in the structure by default
    }

    if (nesaSectionBMatch) {
      console.log('Pre-detected Section B: Short Answer Questions');
      // Section B is already in the structure by default
    }

    if (nesaSectionCMatch) {
      console.log('Pre-detected Section C: Structured/Essay Questions');
      // Section C is already in the structure by default
    }
  }

  console.log('Starting to extract questions from text with length:', text.length);

  // If text is too short, it's probably not a valid exam file
  if (text.length < 100) {
    console.error('Text is too short to be a valid exam file');
    throw new Error('The uploaded file does not contain enough text to be a valid exam file. Please check the file and try again.');
  }

  // Process each line
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Define section header patterns
    const sectionHeaderPatterns = [
      /^SECTION\s+[A-C]/i,                                  // SECTION A
      /^PART\s+[A-C]/i,                                     // PART A
      /^[A-C]\.\s+/,                                        // A.
      /^SECTION\s+[A-C]:/i,                                 // SECTION A:
      /^PART\s+[A-C]:/i,                                    // PART A:
      /^[A-C]\s*[-:]/i,                                     // A- or A:
      /^MULTIPLE\s+CHOICE/i,                                // MULTIPLE CHOICE
      /^SHORT\s+ANSWER/i,                                   // SHORT ANSWER
      /^ESSAY/i,                                            // ESSAY
      /^LONG\s+ANSWER/i                                     // LONG ANSWER
    ];

    // Check if the line is a section header
    if (sectionHeaderPatterns.some(pattern => line.match(pattern))) {
      // Extract section letter (A, B, or C)
      let sectionLetter = null;

      // Try to extract section letter from the line
      if (line.match(/SECTION\s+A|PART\s+A|^A\.|^A\s*[-:]/i)) {
        sectionLetter = 'A';
      } else if (line.match(/SECTION\s+B|PART\s+B|^B\.|^B\s*[-:]/i)) {
        sectionLetter = 'B';
      } else if (line.match(/SECTION\s+C|PART\s+C|^C\.|^C\s*[-:]/i)) {
        sectionLetter = 'C';
      } else if (line.match(/MULTIPLE\s+CHOICE/i)) {
        sectionLetter = 'A';
      } else if (line.match(/SHORT\s+ANSWER/i)) {
        sectionLetter = 'B';
      } else if (line.match(/ESSAY|LONG\s+ANSWER|STRUCTURED/i)) {
        sectionLetter = 'C';
      }

      if (sectionLetter) {
        currentSection = sectionLetter;
        console.log(`Found Section ${sectionLetter} from line: "${line}"`);

        // Reset the current question when we find a new section
        // This ensures questions don't carry over between sections
        currentQuestion = null;
        inOptions = false;

        // Log the section change to help with debugging
        console.log(`Switched current section context to: ${sectionLetter}`);
        continue;
      }
    }

    // Check for true/false questions
    const trueFalseMatch = line.match(/^(\d+)\.?\s+(.+?)\s*\(True\/False\)/i) ||
                          line.match(/^(\d+)\.?\s+(.+?)\s*\(T\/F\)/i) ||
                          line.match(/^(\d+)\.?\s+(.+?)\s+(?:is|are)\s+(?:true|false)/i);

    // Check for fill-in-the-blank questions
    const fillInBlankMatch = line.match(/^(\d+)\.?\s+(.+?)\s*\[.*\](.*)/) ||
                            line.match(/^(\d+)\.?\s+(.+?)\s*\_\_\_+(.*)/) ||
                            line.match(/^(\d+)\.?\s+(.+?)\s*\(fill in(?: the blank)?\)(.*)/) ||
                            line.match(/^(\d+)\.?\s+(.+?)\s*\(complete\)(.*)/) ||
                            line.match(/^(\d+)\.?\s+(.+?)\s+with\s+the\s+(?:correct|appropriate|missing)\s+(?:word|term|phrase)/i);

    // Check for multiple choice questions (Section A)
    // First, try to match questions that have options on the same line
    const mcQuestionMatch = line.match(/^(\d+)\.?\s+(.+?)(?:\s+a\)|\s+\(a\)|\s+a\.|\s+A\.|\s+A\))/i);

    // Also look for numbered questions that might be multiple choice based on context
    const numberedQuestionMatch = line.match(/^(\d+)\.?\s+(.+)/);

    // If we have a true/false question
    if (trueFalseMatch && trueFalseMatch[2]) {
      const questionNumber = parseInt(trueFalseMatch[1]);
      const questionText = trueFalseMatch[2].trim();

      // Create a new true/false question
      currentQuestion = {
        id: examStructure.sections.reduce((total, section) => total + section.questions.length, 0),
        text: questionText,
        type: 'true-false',
        options: [
          { text: 'True', letter: 'A', isCorrect: false },
          { text: 'False', letter: 'B', isCorrect: false }
        ],
        correctAnswer: '',
        points: 1,
        section: 'A',
        currentSection: 'A'
      };

      // Add the question to Section A
      examStructure.sections[0].questions.push(currentQuestion);
      console.log(`Added true/false question ${questionNumber}: "${questionText.substring(0, 50)}..."`);

      // Reset state
      currentQuestion = null;
      inOptions = false;
      continue;
    }

    // If we have a fill-in-the-blank question
    else if (fillInBlankMatch && fillInBlankMatch[2]) {
      const questionNumber = parseInt(fillInBlankMatch[1]);
      let questionText = fillInBlankMatch[2].trim();

      // If there's content after the blank, add it to the question text
      if (fillInBlankMatch[3]) {
        questionText += ' _____ ' + fillInBlankMatch[3].trim();
      } else {
        questionText += ' _____';
      }

      // Create a new fill-in-the-blank question
      currentQuestion = {
        id: examStructure.sections.reduce((total, section) => total + section.questions.length, 0),
        text: questionText,
        type: 'fill-in-blank',
        options: [],
        correctAnswer: '',
        points: 1,
        section: 'A',
        currentSection: 'A'
      };

      // Add the question to Section A
      examStructure.sections[0].questions.push(currentQuestion);
      console.log(`Added fill-in-the-blank question ${questionNumber}: "${questionText.substring(0, 50)}..."`);

      // Reset state
      currentQuestion = null;
      inOptions = false;
      continue;
    }

    // If we have a direct multiple choice match
    else if (mcQuestionMatch && mcQuestionMatch[2]) {
      const questionNumber = parseInt(mcQuestionMatch[1]);
      const questionText = mcQuestionMatch[2].trim();

      // Create a new multiple choice question
      currentQuestion = {
        id: examStructure.sections.reduce((total, section) => total + section.questions.length, 0),
        text: questionText,
        type: 'multiple-choice',
        options: [],
        correctAnswer: '',
        points: 1,
        section: 'A',
        currentSection: 'A'
      };

      // Add the question to Section A
      const sectionIndex = examStructure.sections.findIndex(s => s.name === 'A');
      if (sectionIndex !== -1) {
        examStructure.sections[sectionIndex].questions.push(currentQuestion);
        console.log(`Added multiple choice question ${questionNumber} to Section A: "${questionText.substring(0, 50)}..."`);
      }

      inOptions = true;
      continue;
    }
    // If we have a numbered question, check if the next few lines contain options
    else if (numberedQuestionMatch && numberedQuestionMatch[2] &&
            (currentSection === 'A' || !currentSection)) { // Allow detection even if section not explicitly set
      // Look ahead to see if the next few lines contain options
      const questionNumber = parseInt(numberedQuestionMatch[1]);
      const questionText = numberedQuestionMatch[2].trim();

      // Enhanced option pattern detection - check the next 15 lines for option patterns
      let hasOptions = false;
      let optionLines = [];

      // Look ahead for option patterns in the next 15 lines
      for (let j = i + 1; j < Math.min(i + 16, lines.length); j++) {
        const nextLine = lines[j].trim();

        // More comprehensive pattern matching for multiple choice options
        if (nextLine.match(/^\s*(?:[a-dA-D][\.\)]\s*|\([a-dA-D]\)\s*|option\s+[a-dA-D][:.]?\s*|^[a-dA-D]\s+|^[1-4][\.)\s]|^(i|ii|iii|iv)[\.)\s])/i) ||
            nextLine.match(/^\s*[-•*]\s+/) || // Bullet points
            (j === i + 1 && nextLine.match(/^(A|a|1|i)\b/)) || // First option right after question
            nextLine.match(/^[A-D][\.:\)]\s+/i) || // A. or A: or A) followed by text
            nextLine.match(/^\([A-D]\)\s+/i) || // (A) followed by text
            nextLine.match(/^[A-D]\s+/i)) { // A followed by text

          hasOptions = true;
          optionLines.push(nextLine);

          // If we find an option, collect all subsequent options
          // This helps with NESA format where options are listed consecutively
          continue;
        }

        // If we've already found options and this line doesn't match an option pattern,
        // check if it might be the next question or section header
        if (hasOptions) {
          if (nextLine.match(/^(\d+)\.?\s+/) || // Numbered question
              nextLine.match(/^SECTION\s+[A-C]/i) || // Section header
              nextLine.match(/^PART\s+[A-C]/i)) { // Part header
            break; // Stop collecting options if we hit the next question or section
          }

          // If it's not a new question or section, it might be continuation of the last option
          // or a blank line between options, so we'll include it
          if (nextLine.length > 0) {
            optionLines.push(nextLine);
          }
        }
      }

      // Log the options we found for debugging
      if (hasOptions && optionLines.length > 0) {
        console.log(`Found ${optionLines.length} potential option lines for question ${questionNumber}:`);
        optionLines.forEach((line, idx) => {
          console.log(`  Option line ${idx + 1}: "${line.substring(0, 50)}..."`);
        });
      }

      // Additional checks for multiple choice questions
      const isMultipleChoice =
        hasOptions ||
        questionText.toLowerCase().includes('choose') ||
        questionText.toLowerCase().includes('select') ||
        questionText.toLowerCase().includes('pick') ||
        questionText.toLowerCase().includes('which of the following') ||
        questionText.toLowerCase().includes('multiple choice') ||
        questionText.match(/\boption/i) ||
        questionText.match(/\bchoice/i) ||
        // NESA format often has questions ending with a question mark in Section A
        (currentSection === 'A' && questionText.endsWith('?'));

      if (isMultipleChoice) {
        // This is likely a multiple choice question
        currentQuestion = {
          id: examStructure.sections.reduce((total, section) => total + section.questions.length, 0),
          text: questionText,
          type: 'multiple-choice',
          options: [],
          correctAnswer: '',
          points: 1,
          section: 'A',
          currentSection: 'A'
        };

        // Process collected option lines if we have any
        if (optionLines.length > 0) {
          console.log(`Processing ${optionLines.length} option lines for question ${questionNumber}`);

          // Process each option line to extract options
          let currentOptionLetter = '';
          let currentOptionText = '';

          for (let j = 0; j < optionLines.length; j++) {
            const line = optionLines[j];

            // Try to match option patterns
            const optionPatterns = [
              /^\s*([A-D])[\.:\)]\s+(.+)/i,  // A. Option text or A: Option text or A) Option text
              /^\s*\(([A-D])\)\s+(.+)/i,     // (A) Option text
              /^\s*([A-D])\s+(.+)/i,         // A Option text
              /^\s*([1-4])[\.:\)]\s+(.+)/i,  // 1. Option text or 1: Option text or 1) Option text
              /^\s*\(([1-4])\)\s+(.+)/i,     // (1) Option text
              /^\s*([1-4])\s+(.+)/i,         // 1 Option text
              /^\s*(i|ii|iii|iv)[\.:\)]\s+(.+)/i, // i. Option text or i: Option text or i) Option text
              /^\s*\((i|ii|iii|iv)\)\s+(.+)/i,    // (i) Option text
              /^\s*(i|ii|iii|iv)\s+(.+)/i,        // i Option text
              /^\s*[-•*]\s+(.+)/i            // - Option text or • Option text or * Option text
            ];

            let optionMatch = null;

            // Try each pattern
            for (const pattern of optionPatterns) {
              const match = line.match(pattern);
              if (match) {
                optionMatch = match;
                break;
              }
            }

            if (optionMatch) {
              // If we were processing a previous option, add it to the question
              if (currentOptionLetter && currentOptionText) {
                addOptionToQuestion(currentQuestion, currentOptionLetter, currentOptionText);
                currentOptionText = '';
              }

              // Extract option letter and text
              if (optionMatch.length === 2) {
                // Pattern with just the option text (like bullet points)
                currentOptionText = optionMatch[1].trim();
                // Use the next available letter
                currentOptionLetter = String.fromCharCode(65 + currentQuestion.options.length);
              } else if (optionMatch.length === 3) {
                // Pattern with option letter/number and text
                let matchedOption = optionMatch[1].toLowerCase();

                // Convert numeric options to letters (1->A, 2->B, etc.)
                if (/^[1-4]$/.test(matchedOption)) {
                  const index = parseInt(matchedOption) - 1;
                  currentOptionLetter = String.fromCharCode(65 + index);
                }
                // Convert roman numerals to letters (i->A, ii->B, etc.)
                else if (/^(i|ii|iii|iv)$/.test(matchedOption)) {
                  const romanToIndex = { 'i': 0, 'ii': 1, 'iii': 2, 'iv': 3 };
                  currentOptionLetter = String.fromCharCode(65 + romanToIndex[matchedOption]);
                }
                // Use the matched letter directly
                else {
                  currentOptionLetter = matchedOption.toUpperCase();
                }

                currentOptionText = optionMatch[2].trim();
              }
            } else {
              // If this line doesn't match an option pattern, it might be a continuation
              // of the previous option
              if (currentOptionText) {
                currentOptionText += ' ' + line.trim();
              }
            }
          }

          // Add the last option if we have one
          if (currentOptionLetter && currentOptionText) {
            addOptionToQuestion(currentQuestion, currentOptionLetter, currentOptionText);
          }

          console.log(`Added ${currentQuestion.options.length} options to question ${questionNumber}`);
        }

        // Add the question to Section A
        const sectionIndex = examStructure.sections.findIndex(s => s.name === 'A');
        if (sectionIndex !== -1) {
          examStructure.sections[sectionIndex].questions.push(currentQuestion);
          console.log(`Added multiple choice question ${questionNumber} to Section A (based on context): "${questionText.substring(0, 50)}..."`);
        }

        inOptions = true;
        continue;
      }
    }

    // Check for option patterns if we're in a multiple choice question
    if (currentQuestion && currentQuestion.type === 'multiple-choice' && inOptions) {
      // Enhanced comprehensive pattern matching for multiple choice options
      const optionPatterns = [
        // Standard formats
        /^\s*(?:[a-d][\.\)]\s*|\([a-d]\)\s*)(.+)/i,  // a) Option text or (a) Option text
        /^\s*([a-d])[\.\)]\s+(.+)/i,                 // a. Option text or a) Option text
        /^\s*\(([a-d])\)\s+(.+)/i,                   // (a) Option text
        /^\s*option\s+([a-d])[:.]?\s+(.+)/i,         // Option a: Option text
        /^\s*([a-d])[\.:]?\s+(.+)/i,                 // a. Option text or a: Option text

        // NESA specific formats
        /^\s*([a-d])\.\s+(.+)/i,                     // a. Option text (NESA format)
        /^\s*([a-d])\)\s+(.+)/i,                     // a) Option text (NESA format)
        /^\s*([a-d])\s+(.+)/i,                       // a Option text (no punctuation)
        /^\s*([A-D])\.\s+(.+)/i,                     // A. Option text (uppercase)
        /^\s*([A-D])\)\s+(.+)/i,                     // A) Option text (uppercase)
        /^\s*([A-D])\s+(.+)/i,                       // A Option text (uppercase, no punctuation)

        // Numbered options
        /^\s*([1-4])\.\s+(.+)/i,                     // 1. Option text
        /^\s*([1-4])\)\s+(.+)/i,                     // 1) Option text
        /^\s*([1-4])\s+(.+)/i,                       // 1 Option text

        // Roman numerals
        /^\s*(i|ii|iii|iv)\.\s+(.+)/i,               // i. Option text
        /^\s*(i|ii|iii|iv)\)\s+(.+)/i,               // i) Option text
        /^\s*(i|ii|iii|iv)\s+(.+)/i,                 // i Option text

        // Indented options with various markers
        /^\s+[-•*]\s+(.+)/i,                         // - Option text or • Option text or * Option text
        /^\s+[→➢➤▶]\s+(.+)/i                         // → Option text or similar arrow markers
      ];

      let optionMatch = null;
      let optionLetter = '';
      let optionText = '';

      // Try each pattern until we find a match
      for (const pattern of optionPatterns) {
        const match = line.match(pattern);
        if (match) {
          if (match.length === 2) {
            // Pattern with just the option text (like bullet points)
            optionText = match[1].trim();

            // For patterns without explicit option letters, use the current count
            optionLetter = optionLetters[currentQuestion.options.length % optionLetters.length];
          } else if (match.length === 3) {
            // Pattern with option letter/number and text
            let matchedOption = match[1].toLowerCase();

            // Convert numeric options to letters (1->a, 2->b, etc.)
            if (/^[1-4]$/.test(matchedOption)) {
              const index = parseInt(matchedOption) - 1;
              optionLetter = optionLetters[index];
            }
            // Convert roman numerals to letters (i->a, ii->b, etc.)
            else if (/^(i|ii|iii|iv)$/.test(matchedOption)) {
              const romanToIndex = { 'i': 0, 'ii': 1, 'iii': 2, 'iv': 3 };
              optionLetter = optionLetters[romanToIndex[matchedOption]];
            }
            // Use the matched letter directly
            else {
              optionLetter = matchedOption;
            }

            optionText = match[2].trim();
          }

          optionMatch = match;
          break;
        }
      }

      // If we found an option
      if (optionMatch && optionText) {
        // Check if this option already exists to avoid duplicates
        const optionExists = currentQuestion.options.some(opt =>
          opt.text.toLowerCase() === optionText.toLowerCase()
        );

        if (!optionExists) {
          // Add the option to the current question with both letter and value properties
          currentQuestion.options.push({
            letter: optionLetter.toUpperCase(),
            text: optionText,
            value: optionLetter.toLowerCase(), // Add value property for frontend compatibility
            isCorrect: false
          });

          console.log(`Added option ${optionLetter.toUpperCase() || '?'} to question ${currentQuestion.id}: "${optionText}"`);
        } else {
          console.log(`Skipped duplicate option for question ${currentQuestion.id}: "${optionText}"`);
        }
        continue;
      }

      // Check for continuation of previous option (indented text)
      if (!optionMatch && currentQuestion.options.length > 0 && line.trim().length > 0 && line.match(/^\s+/)) {
        // This might be a continuation of the previous option
        const lastOption = currentQuestion.options[currentQuestion.options.length - 1];
        lastOption.text += ' ' + line.trim();
        console.log(`Appended text to option ${lastOption.letter || '?'}: "${line.trim()}"`);
        continue;
      }

      // If we didn't find an option but we're still in options mode,
      // check if this line might be the start of the next question
      if (!optionMatch) {
        const nextQuestionMatch = line.match(/^(\d+)\.?\s+(.+)/);
        if (nextQuestionMatch) {
          // This looks like the start of a new question, so we're no longer in options mode
          inOptions = false;
          // Don't continue here, let the next iteration handle this line as a new question
        }
      }
    }

    // Check for essay/structured questions (Section C)
    // These often have specific formats or keywords
    const essayQuestionMatch = line.match(/^(\d+)\.?\s+(.+(?:discuss|analyze|evaluate|explain\s+in\s+detail|compare|contrast|essay|elaborate|write\s+an\s+essay|in\s+detail).+)/i);
    if (essayQuestionMatch && essayQuestionMatch[2] && (currentSection === 'C' || !currentSection)) {
      const questionNumber = parseInt(essayQuestionMatch[1]);
      const questionText = essayQuestionMatch[2].trim();

      // Create a new essay question for Section C
      currentQuestion = {
        id: examStructure.sections.reduce((total, section) => total + section.questions.length, 0),
        text: questionText,
        type: 'open-ended',
        options: [],
        correctAnswer: '',
        points: 10, // Essay questions typically have more points
        section: 'C',
        currentSection: 'C'
      };

      // Add the question to Section C
      const sectionIndex = examStructure.sections.findIndex(s => s.name === 'C');
      if (sectionIndex !== -1) {
        examStructure.sections[sectionIndex].questions.push(currentQuestion);
        console.log(`Added essay question ${questionNumber} to Section C: "${questionText.substring(0, 50)}..."`);
      }

      inOptions = false;
      continue;
    }

    // Check for regular questions (Section B or C)
    const questionMatch = line.match(/^(\d+)\.?\s+(.+)/);
    if (questionMatch && questionMatch[2] && !essayQuestionMatch) {
      const questionNumber = parseInt(questionMatch[1]);
      const questionText = questionMatch[2].trim();

      // Determine the section based on the current section context and question text
      let questionSection = currentSection || 'B'; // Use the current section context if available

      // If we're already in a specific section context, respect it
      if (currentSection) {
        questionSection = currentSection;
        console.log(`Using current section context: ${currentSection} for question: "${questionText.substring(0, 50)}..."`);
      }
      // Otherwise, try to determine the section based on the question text
      else if (questionText.match(/discuss|analyze|evaluate|explain in detail|compare|contrast|essay|elaborate/i) ||
          questionText.length > 200) {
        questionSection = 'C';
        console.log(`Assigned to Section C based on question content: "${questionText.substring(0, 50)}..."`);
      } else {
        questionSection = 'B';
        console.log(`Assigned to Section B based on question content: "${questionText.substring(0, 50)}..."`);
      }

      // Create a new question
      currentQuestion = {
        id: examStructure.sections.reduce((total, section) => total + section.questions.length, 0),
        text: questionText,
        type: 'open-ended',
        options: [],
        correctAnswer: '',
        points: questionSection === 'B' ? 5 : 10,
        section: questionSection,
        currentSection: questionSection
      };

      // Add the question to the appropriate section
      const sectionIndex = examStructure.sections.findIndex(s => s.name === questionSection);
      if (sectionIndex !== -1) {
        examStructure.sections[sectionIndex].questions.push(currentQuestion);
        console.log(`Added question ${questionNumber} to Section ${questionSection}: "${questionText.substring(0, 50)}..."`);
      }

      inOptions = false;
      continue;
    }
  }

  // Check if we need to use AI to help categorize questions
  const totalQuestions = examStructure.sections.reduce((total, section) => total + section.questions.length, 0);

  // Count questions in each section
  const sectionAQuestions = examStructure.sections.find(s => s.name === 'A')?.questions.length || 0;
  const sectionBQuestions = examStructure.sections.find(s => s.name === 'B')?.questions.length || 0;
  const sectionCQuestions = examStructure.sections.find(s => s.name === 'C')?.questions.length || 0;

  console.log(`Question distribution: Section A: ${sectionAQuestions}, Section B: ${sectionBQuestions}, Section C: ${sectionCQuestions}`);

  // Use AI to extract options for multiple choice questions
  const sectionA = examStructure.sections.find(s => s.name === 'A');
  if (sectionA && sectionA.questions.length > 0) {
    console.log(`Section A has ${sectionA.questions.length} multiple choice questions:`);

    // Try to use AI to extract options for all multiple choice questions
    try {
      // Only attempt AI extraction if we have the Groq client available
      if (groqClient) {
        console.log('Using AI to extract options for multiple choice questions...');
        await extractOptionsWithAI(sectionA.questions, text);
      }
    } catch (error) {
      console.error('Error using AI to extract options:', error);
      console.log('Falling back to default option extraction...');
    }

    // Process each question after AI extraction attempt
    sectionA.questions.forEach((q, index) => {
      console.log(`Question ${index + 1}: "${q.text.substring(0, 50)}..." has ${q.options.length} options`);

      // Ensure each multiple choice question has at least 4 options
      if (q.options.length < 4) {
        console.log(`  WARNING: Question ${index + 1} has fewer than 4 options. Adding default options.`);

        // Check if we have any real options (not default options)
        const hasRealOptions = q.options.some(opt =>
          !opt.text.startsWith('Option ') &&
          opt.text !== 'Option A' &&
          opt.text !== 'Option B' &&
          opt.text !== 'Option C' &&
          opt.text !== 'Option D'
        );

        // Clear existing options to avoid duplicates
        const existingOptions = [...q.options];
        q.options = [];

        // Add default options if none were detected
        const defaultOptions = [
          { letter: 'A', text: hasRealOptions ? 'Option A' : 'CPU (Central Processing Unit)', value: 'a', isCorrect: false },
          { letter: 'B', text: hasRealOptions ? 'Option B' : 'GPU (Graphics Processing Unit)', value: 'b', isCorrect: false },
          { letter: 'C', text: hasRealOptions ? 'Option C' : 'RAM (Random Access Memory)', value: 'c', isCorrect: false },
          { letter: 'D', text: hasRealOptions ? 'Option D' : 'Motherboard', value: 'd', isCorrect: false }
        ];

        // Add existing options first
        existingOptions.forEach(opt => {
          // Ensure each option has the required properties
          if (!opt.value) {
            opt.value = opt.letter ? opt.letter.toLowerCase() : '';
          }
          if (!opt.letter && opt.value) {
            opt.letter = opt.value.toUpperCase();
          }
          q.options.push(opt);
        });

        // Add default options to fill in the gaps
        for (let i = q.options.length; i < 4; i++) {
          q.options.push(defaultOptions[i]);
        }

        console.log(`  Added default options. Question now has ${q.options.length} options.`);
      }

      // Ensure all options have the required properties for the database and frontend
      q.options.forEach((opt, optIndex) => {
        // Make sure each option has letter, value, text, and isCorrect properties
        if (!opt.letter) {
          opt.letter = String.fromCharCode(65 + optIndex); // A, B, C, D...
        }
        if (!opt.value) {
          opt.value = opt.letter.toLowerCase();
        }
        if (!('isCorrect' in opt)) {
          opt.isCorrect = false;
        }

        // Ensure the text property exists
        if (!opt.text || opt.text.trim() === '') {
          opt.text = `Option ${opt.letter}`;
        }
      });

      // Check if we have an answer for this question in the pre-loaded answer data
      const questionNumber = index + 1;
      if (answerData && answerData.answers && answerData.answers[questionNumber]) {
        const answer = answerData.answers[questionNumber];
        console.log(`  Found answer in pre-loaded answer data for question ${questionNumber}: ${answer}`);

        // Handle different question types
        if (q.type === 'multiple-choice') {
          const correctLetter = answer.toUpperCase();

          // Find the option with this letter
          const correctOption = q.options.find(opt =>
            opt.letter && opt.letter.toUpperCase() === correctLetter
          );

          if (correctOption) {
            // Mark this option as correct
            q.options.forEach(opt => {
              opt.isCorrect = (opt.letter && opt.letter.toUpperCase() === correctLetter);
            });

            // Set the correct answer text
            q.correctAnswer = correctOption.text;

            console.log(`  Set correct answer for question ${questionNumber} to option ${correctLetter}: "${correctOption.text.substring(0, 30)}..."`);
          } else {
            console.log(`  Could not find option with letter ${correctLetter} for question ${questionNumber}`);

            // Reset all options to not correct
            q.options.forEach(opt => {
              opt.isCorrect = false;
            });

            // Clear any existing correctAnswer
            q.correctAnswer = '';
          }
        }
        else if (q.type === 'true-false') {
          // Handle true/false questions
          const isTrue = answer.toLowerCase() === 'true' || answer.toLowerCase() === 't' || answer.toUpperCase() === 'A';
          const isFalse = answer.toLowerCase() === 'false' || answer.toLowerCase() === 'f' || answer.toUpperCase() === 'B';

          // Mark the correct option
          if (isTrue || isFalse) {
            q.options.forEach(opt => {
              opt.isCorrect = (isTrue && opt.text === 'True') || (isFalse && opt.text === 'False');
            });

            // Set the correct answer text
            q.correctAnswer = isTrue ? 'True' : 'False';

            console.log(`  Set correct answer for true/false question ${questionNumber} to: ${q.correctAnswer}`);
          } else {
            console.log(`  Invalid answer format for true/false question ${questionNumber}: ${answer}`);
          }
        }
        else if (q.type === 'fill-in-blank') {
          // For fill-in-the-blank, just store the correct answer
          q.correctAnswer = answer.trim();
          console.log(`  Set correct answer for fill-in-blank question ${questionNumber} to: "${answer.trim()}"`);
        }
        else {
          // For other question types, just store the answer
          q.correctAnswer = answer.trim();
          console.log(`  Set correct answer for question ${questionNumber} to: "${answer.trim().substring(0, 30)}..."`);
        }
      } else {
        // No answer in pre-loaded data
        if (q.type === 'multiple-choice' || q.type === 'true-false') {
          // Reset all options to not correct
          q.options.forEach(opt => {
            opt.isCorrect = false;
          });
        }

        // Clear any existing correctAnswer
        q.correctAnswer = '';

        console.log(`  No default correct answer set for question: "${q.text.substring(0, 30)}...". Will be determined during grading.`);
      }

      // Log all options
      q.options.forEach(opt => {
        console.log(`  - Option ${opt.letter || '?'}: "${opt.text.substring(0, 30)}..." (value: ${opt.value}, isCorrect: ${opt.isCorrect})`);
      });
    });
  }

  // Determine if we need AI categorization based on several conditions
  const needsAICategorization =
    // If all questions ended up in one section (especially Section C)
    (totalQuestions > 0 && (
      (sectionCQuestions === totalQuestions) ||
      (sectionBQuestions === totalQuestions) ||
      (sectionAQuestions === totalQuestions && totalQuestions > 10) // If all are in A but there are many questions
    )) ||
    // If there's a significant imbalance in question distribution
    (totalQuestions >= 10 && (
      (sectionAQuestions === 0 && sectionBQuestions === 0) || // No questions in A and B
      (sectionAQuestions === 0 && sectionCQuestions === 0) || // No questions in A and C
      (sectionBQuestions === 0 && sectionCQuestions === 0)    // No questions in B and C
    ));

  if (needsAICategorization) {
    console.log('Question distribution is unbalanced. Using AI to help categorize...');
    try {
      const categorizedExam = await categorizeQuestionsWithAI(examStructure);

      // Log the new distribution after AI categorization
      const newSectionAQuestions = categorizedExam.sections.find(s => s.name === 'A')?.questions.length || 0;
      const newSectionBQuestions = categorizedExam.sections.find(s => s.name === 'B')?.questions.length || 0;
      const newSectionCQuestions = categorizedExam.sections.find(s => s.name === 'C')?.questions.length || 0;

      console.log(`New question distribution after AI categorization: Section A: ${newSectionAQuestions}, Section B: ${newSectionBQuestions}, Section C: ${newSectionCQuestions}`);

      return categorizedExam;
    } catch (aiError) {
      console.error('Error categorizing questions with AI:', aiError);
      // Continue with the original categorization if AI fails
      console.log('Continuing with original question categorization');
    }
  }

  return examStructure;
};

/**
 * Categorize questions into appropriate sections using AI
 * @param {Object} examStructure - Exam structure with questions
 * @returns {Promise<Object>} - Updated exam structure with categorized questions
 */
const categorizeQuestionsWithAI = async (examStructure) => {
  try {
    // Flatten all questions from all sections for AI processing
    const allQuestions = [];
    examStructure.sections.forEach(section => {
      section.questions.forEach(question => {
        allQuestions.push({
          ...question,
          currentSection: section.name // Track the current section
        });
      });
    });

    if (allQuestions.length === 0) {
      console.log('No questions to categorize');
      return examStructure;
    }

    // Try to use a less resource-intensive model first to avoid quota limits
    console.log('Using Groq AI to categorize questions...');

    // Process questions in smaller batches to avoid hitting quota limits
    const BATCH_SIZE = 3; // Process just a few questions at a time
    const batches = [];

    // Split questions into smaller batches
    for (let i = 0; i < allQuestions.length; i += BATCH_SIZE) {
        batches.push(allQuestions.slice(i, i + BATCH_SIZE));
    }

    console.log(`Split ${allQuestions.length} questions into ${batches.length} batches of max ${BATCH_SIZE} questions each`);

    // Set generation config for better JSON output
    const generationConfig = {
      temperature: 0.1,  // Lower temperature for more deterministic output
      maxOutputTokens: 512, // Smaller token limit to avoid quota issues
    };

    // Create a new exam structure with the categorized questions
    const newExamStructure = {
      sections: [
        {
          name: 'A',
          description: 'Multiple Choice Questions',
          questions: []
        },
        {
          name: 'B',
          description: 'Short Answer Questions',
          questions: []
        },
        {
          name: 'C',
          description: 'Long Answer Questions',
          questions: []
        }
      ]
    };

    // Process each batch and collect results
    const batchResults = {};

    try {
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batchQuestions = batches[batchIndex];
        console.log(`Processing batch ${batchIndex + 1}/${batches.length} with ${batchQuestions.length} questions`);

        // Create a simplified prompt for this batch only
        const prompt = `
        Categorize these exam questions into sections A, B, or C:

        Section A: Multiple choice questions with options (a, b, c, d)
        Section B: Short answer questions (brief explanations)
        Section C: Long answer/essay questions (detailed explanations)

        Questions:
        ${batchQuestions.map(q => `ID: ${q.id}
        Question: ${q.text}
        Type: ${q.type}
        ${q.options && q.options.length > 0 ? `Options: ${q.options.map(o => o.text).join(' | ')}` : ''}
        Current Section: ${q.currentSection}
        `).join('\n')}

        Rules:
        - If a question has multiple choice options, it's Section A
        - If a question requires a short explanation (1-3 sentences), it's Section B
        - If a question requires a detailed essay or analysis, it's Section C
        - Questions with "explain briefly", "list", "define" are usually Section B
        - Questions with "discuss", "analyze", "evaluate" are usually Section C

        Return only a JSON object like: {"0":"A","1":"B",...}
        `;

        try {
          console.log('Sending request to Gemini API for question categorization...');

          // Add timeout to avoid hanging if API is unresponsive
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Gemini API request timed out')), 10000);
          });

          // Race the API call against the timeout
          const result = await Promise.race([
            model.generateContent({
              contents: [{ role: "user", parts: [{ text: prompt }] }],
              generationConfig,
            }),
            timeoutPromise
          ]);

          console.log(`Received response from Gemini API for batch ${batchIndex + 1}`);

          // Get the text directly from the result
          const text = result.response.text();

          // Extract JSON object from response
          const jsonStart = text.indexOf('{');
          const jsonEnd = text.lastIndexOf('}') + 1;

          if (jsonStart === -1 || jsonEnd === 0) {
            console.warn(`No JSON object found in AI response for batch ${batchIndex + 1}`);

            // If we can't parse the response, use heuristics to categorize this batch
            batchQuestions.forEach(question => {
              // Default categorization based on question properties
              let sectionLetter = question.currentSection || 'B'; // Default to B

              // If it has options, it's likely Section A
              if (question.options && question.options.length > 0) {
                sectionLetter = 'A';
              }
              // If it contains keywords for essay questions, it's likely Section C
              else if (question.text.match(/discuss|analyze|evaluate|explain in detail|compare|contrast|essay|elaborate/i) ||
                      question.text.length > 200) {
                sectionLetter = 'C';
              }
              // Otherwise it's likely Section B
              else {
                sectionLetter = 'B';
              }

              batchResults[question.id] = sectionLetter;
            });

            console.log(`Used heuristics to categorize batch ${batchIndex + 1}`);
          } else {
            // Parse the JSON response
            const jsonText = text.substring(jsonStart, jsonEnd);
            const batchCategorization = JSON.parse(jsonText);

            // Add the batch results to the overall results
            Object.assign(batchResults, batchCategorization);
            console.log(`Successfully categorized batch ${batchIndex + 1}`);
          }
        } catch (batchError) {
          console.error(`Error processing batch ${batchIndex + 1}:`, batchError);

          // If the API call fails, use heuristics to categorize this batch
          batchQuestions.forEach(question => {
            // Default categorization based on question properties
            let sectionLetter = question.currentSection || 'B'; // Default to B

            // If it has options, it's likely Section A
            if (question.options && question.options.length > 0) {
              sectionLetter = 'A';
            }
            // If it contains keywords for essay questions, it's likely Section C
            else if (question.text.match(/discuss|analyze|evaluate|explain in detail|compare|contrast|essay|elaborate/i) ||
                    question.text.length > 200) {
              sectionLetter = 'C';
            }
            // Otherwise it's likely Section B
            else {
              sectionLetter = 'B';
            }

            batchResults[question.id] = sectionLetter;
          });

          console.log(`Used fallback heuristics for batch ${batchIndex + 1} due to error`);
        }

        // Add a small delay between batches to avoid rate limiting
        if (batchIndex < batches.length - 1) {
          console.log('Waiting before processing next batch...');
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.log('All batches processed. Combining results...');

      // Assign questions to sections based on the combined batch results
      allQuestions.forEach(question => {
        const sectionLetter = batchResults[question.id];
        if (sectionLetter && ['A', 'B', 'C'].includes(sectionLetter)) {
          // Update the question's section
          question.section = sectionLetter;

          // Add the question to the appropriate section
          const sectionIndex = newExamStructure.sections.findIndex(s => s.name === sectionLetter);
          if (sectionIndex !== -1) {
            newExamStructure.sections[sectionIndex].questions.push(question);
          }
        } else {
          // If we couldn't categorize this question, keep it in its original section
          const sectionIndex = newExamStructure.sections.findIndex(s => s.name === question.currentSection);
          if (sectionIndex !== -1) {
            newExamStructure.sections[sectionIndex].questions.push(question);
          }
        }
      });

      // Log the results
      newExamStructure.sections.forEach(section => {
        console.log(`Section ${section.name} now has ${section.questions.length} questions`);
      });

      // Perform a final validation to ensure we have a reasonable distribution
      // If any section is completely empty, try to redistribute some questions
      const sectionA = newExamStructure.sections.find(s => s.name === 'A');
      const sectionB = newExamStructure.sections.find(s => s.name === 'B');
      const sectionC = newExamStructure.sections.find(s => s.name === 'C');

      if (sectionA && sectionB && sectionC) {
        // If Section A is empty but we have multiple choice questions in other sections, move them to A
        if (sectionA.questions.length === 0) {
          console.log('Section A is empty. Looking for multiple choice questions in other sections...');

          // Check sections B and C for multiple choice questions
          const sectionsToCheck = [sectionB, sectionC];
          sectionsToCheck.forEach(sourceSection => {
            const multipleChoiceQuestions = sourceSection.questions.filter(q =>
              q.type === 'multiple-choice' || (q.options && q.options.length > 0)
            );

            if (multipleChoiceQuestions.length > 0) {
              console.log(`Found ${multipleChoiceQuestions.length} multiple choice questions in Section ${sourceSection.name}. Moving to Section A.`);

              // Move questions to Section A
              multipleChoiceQuestions.forEach(q => {
                q.section = 'A';
                sectionA.questions.push(q);
              });

              // Remove from original section
              sourceSection.questions = sourceSection.questions.filter(q =>
                q.type !== 'multiple-choice' && (!q.options || q.options.length === 0)
              );
            }
          });
        }

        // If we still have an empty section, try to redistribute based on question length
        if (sectionB.questions.length === 0 && sectionC.questions.length > 0) {
          console.log('Section B is empty but Section C has questions. Redistributing based on question length...');

          // Find shorter questions in Section C that might be better suited for Section B
          const shortAnswerQuestions = sectionC.questions.filter(q =>
            q.text.length < 200 && q.type === 'open-ended'
          );

          if (shortAnswerQuestions.length > 0) {
            console.log(`Moving ${shortAnswerQuestions.length} shorter questions from Section C to Section B`);

            // Move questions to Section B
            shortAnswerQuestions.forEach(q => {
              q.section = 'B';
              sectionB.questions.push(q);
            });

            // Remove from Section C
            sectionC.questions = sectionC.questions.filter(q =>
              !(q.text.length < 200 && q.type === 'open-ended')
            );
          }
        }

        // Log the final distribution after adjustments
        console.log('Final question distribution after adjustments:');
        newExamStructure.sections.forEach(section => {
          console.log(`Section ${section.name} now has ${section.questions.length} questions`);
        });
      }

      return newExamStructure;
    } catch (error) {
      console.error('Error categorizing questions with AI:', error);
      return examStructure;
    }
  } catch (error) {
    console.error('Error in categorizeQuestionsWithAI:', error);
    return examStructure;
  }
};

/**
 * Parse a file and extract questions
 * @param {string} filePath - Path to the file
 * @param {Object} answerData - Optional pre-loaded answer data
 * @returns {Promise<Object>} - Structured questions
 */
const parseFile = async (filePath, answerData = { answers: {} }) => {
  try {
    console.log(`Parsing file: ${filePath}`);
    const fileExtension = path.extname(filePath).toLowerCase();
    let text = '';

    // Parse the file based on its extension
    if (fileExtension === '.pdf') {
      text = await parsePdf(filePath);
    } else if (fileExtension === '.docx' || fileExtension === '.doc') {
      text = await parseWord(filePath);
    } else if (fileExtension === '.txt') {
      text = fs.readFileSync(filePath, 'utf8');
    } else {
      throw new Error(`Unsupported file type: ${fileExtension}`);
    }

    // Extract questions directly from the text
    const questions = await extractQuestionsDirectly(text, answerData);
    return questions;
  } catch (error) {
    console.error('Error parsing file:', error);
    throw error;
  }
};

/**
 * Parse an answer file using AI to intelligently extract answers
 * @param {string} filePath - Path to the answer file
 * @returns {Promise<Object>} - Structured answers
 */
const parseAnswerFile = async (filePath) => {
  try {
    console.log(`Parsing answer file: ${filePath}`);
    if (!filePath || !fs.existsSync(filePath)) {
      console.error('Answer file does not exist:', filePath);
      return { answers: {} };
    }

    const fileExtension = path.extname(filePath).toLowerCase();
    let text = '';

    // Parse the file based on its extension
    if (fileExtension === '.pdf') {
      text = await parsePdf(filePath);
    } else if (fileExtension === '.docx' || fileExtension === '.doc') {
      text = await parseWord(filePath);
    } else if (fileExtension === '.txt') {
      text = fs.readFileSync(filePath, 'utf8');
    } else {
      throw new Error(`Unsupported file type: ${fileExtension}`);
    }

    console.log(`Answer file extracted, length: ${text.length}`);

    // Use AI to extract answers intelligently
    try {
      const prompt = `Extract answers from this answer key document. Return JSON:
{
  "answers": {
    "1": "answer for question 1",
    "2": "answer for question 2",
    ...
  }
}

Handle these answer types:
- Multiple choice: single letter (A, B, C, D)
- True/False: True or False
- Short answer: text answer
- Fill-in-blank: word or phrase
- Essay: model answer text

Document text:
${text.substring(0, 4000)}`;

      console.log('Using AI to extract answers from answer file...');
      const result = await groqClient.generateContent(prompt, {
        model: 'balanced',
        jsonMode: true,
        temperature: 0.2,
        maxTokens: 4096,
        systemPrompt: 'You are an expert at extracting answers from answer key documents. Always return valid JSON with question numbers as keys and answers as values.'
      });

      let extractedData;
      if (result.parsedContent) {
        extractedData = result.parsedContent;
      } else if (result.text) {
        const jsonMatch = result.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          extractedData = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found in AI response');
        }
      } else {
        throw new Error('No response content received');
      }

      if (extractedData && extractedData.answers) {
        console.log(`AI extracted ${Object.keys(extractedData.answers).length} answers`);
        Object.entries(extractedData.answers).forEach(([qNum, ans]) => {
          console.log(`  Question ${qNum}: ${ans}`);
        });
        return { answers: extractedData.answers };
      } else {
        throw new Error('AI did not return answers in expected format');
      }
    } catch (aiError) {
      console.error('AI answer extraction failed, falling back to regex patterns:', aiError);
      
      // Fallback to regex patterns
      return await parseAnswerFileWithRegex(text);
    }
  } catch (error) {
    console.error('Error parsing answer file:', error);
    return { answers: {} };
  }
};

/**
 * Parse answer file using regex patterns (fallback method)
 * @param {string} text - Extracted text from answer file
 * @returns {Promise<Object>} - Structured answers
 */
const parseAnswerFileWithRegex = async (text) => {
  const answerMap = {};

  // Log the full text for debugging
  console.log(`Answer file full text (first 500 chars): ${text.substring(0, 500)}`);
  console.log(`Answer file full text (last 500 chars): ${text.substring(text.length - 500)}`);

  // First try to find an answer key section
  const answerKeySection = text.match(/ANSWER KEY|MARKING SCHEME|ANSWERS:|SOLUTIONS:|MODEL ANSWERS|SECTION A ANSWERS|MULTIPLE CHOICE ANSWERS/i);

  // If we found an answer key section, focus on that part of the text
  let processText = text;
  if (answerKeySection && answerKeySection.index) {
    processText = text.substring(answerKeySection.index);
    console.log('Found answer key section, focusing on that part');
  }

  // Pattern 1: Multiple choice answers - "1. A" or "1) A" or "1. A)" or "1) A"
  const mcAnswerPattern = /(\d+)[\.\s\)\-:]+([A-Da-d])[\.\s\)\-:]*/gi;
  let match;
  while ((match = mcAnswerPattern.exec(processText)) !== null) {
    const questionNumber = parseInt(match[1]);
    const answer = match[2].toUpperCase();

    if (!isNaN(questionNumber) && answer) {
      answerMap[questionNumber] = answer;
      console.log(`Found MC answer for question ${questionNumber}: ${answer}`);
    }
  }

  // Pattern 2: True/False answers - "1. True" or "1) False"
  const tfAnswerPattern = /(\d+)[\.\s\)\-:]+(True|False|T|F)(?:[\.\s\)\-:]|$)/gi;
  while ((match = tfAnswerPattern.exec(processText)) !== null) {
    const questionNumber = parseInt(match[1]);
    const answer = match[2].toUpperCase();

    if (!isNaN(questionNumber) && answer) {
      // Normalize T/F to True/False
      const normalizedAnswer = answer === 'T' ? 'True' : (answer === 'F' ? 'False' : answer);
      answerMap[questionNumber] = normalizedAnswer;
      console.log(`Found TF answer for question ${questionNumber}: ${normalizedAnswer}`);
    }
  }

  // Pattern 3: Short answer/essay answers - "1. [answer text]" or "1) [answer text]"
  const shortAnswerPattern = /(\d+)[\.\s\)\-:]+(.+?)(?=\n\d+[\.\s\)\-:]|$)/gis;
  while ((match = shortAnswerPattern.exec(processText)) !== null) {
    const questionNumber = parseInt(match[1]);
    const answer = match[2].trim();

    if (!isNaN(questionNumber) && answer && answer.length > 2) {
      // Only use if it's not just a single letter (those are MC answers)
      if (!/^[A-D]$/.test(answer)) {
        answerMap[questionNumber] = answer;
        console.log(`Found short answer for question ${questionNumber}: ${answer.substring(0, 50)}...`);
      }
    }
  }

  // Pattern 4: Enhanced short answer pattern
  const enhancedShortAnswerPattern = /(?:Question\s*)?(\d+)[\.\s\:]+(.+?)(?=\n\s*(?:Question\s*)?\d+[\.\s\:]|$)/gis;
  while ((match = enhancedShortAnswerPattern.exec(processText)) !== null) {
    const questionNumber = parseInt(match[1]);
    const answer = match[2].trim();

    if (!isNaN(questionNumber) && answer && answer.length > 5) {
      if (!/^[A-D]$/.test(answer)) {
        answerMap[questionNumber] = answer;
        console.log(`Found enhanced short answer for question ${questionNumber}: ${answer.substring(0, 50)}...`);
      }
    }
  }

  // Pattern 5: Model answers / marking scheme patterns
  const modelAnswerPattern = /(?:Model\s+Answer|Answer|Solution|Expected\s+Answer)[\s\:]+(.+?)(?=\n\s*(?:Model\s+Answer|Answer|Solution|Expected\s+Answer|\d+[\.\s\)\-:]|$))/gis;
  while ((match = modelAnswerPattern.exec(processText)) !== null) {
    const answer = match[1].trim();
    if (answer && answer.length > 5) {
      const nextQuestionNum = Object.keys(answerMap).length + 1;
      answerMap[nextQuestionNum] = answer;
      console.log(`Found model answer for question ${nextQuestionNum}: ${answer.substring(0, 50)}...`);
    }
  }

  console.log(`Regex extracted ${Object.keys(answerMap).length} answers`);
  return { answers: answerMap };
};

/**
 * Parse an exam file to extract questions
 * @param {string} filePath - Path to the exam file
 * @param {string} answerFilePath - Optional path to the answer file
 * @returns {Promise<Object>} - Structured exam with questions
 */
const parseExamFile = async (filePath, answerFilePath = null) => {
  try {
    // First parse the answer file if available
    let answerData = { answers: {} };
    if (answerFilePath && fs.existsSync(answerFilePath)) {
      try {
        console.log(`Parsing answer file first: ${answerFilePath}`);
        answerData = await parseAnswerFile(answerFilePath);
        console.log(`Pre-loaded ${Object.keys(answerData.answers).length} answers from answer file`);

        // Log each answer for debugging
        Object.entries(answerData.answers).forEach(([questionNumber, answer]) => {
          console.log(`Pre-loaded answer for question ${questionNumber}: ${answer}`);
        });
      } catch (answerError) {
        console.error('Error parsing answer file:', answerError);
        console.error(answerError.stack); // Log the full stack trace
      }
    } else {
      console.log(`No answer file provided or file does not exist: ${answerFilePath}`);
    }

    // Now parse the exam file with the answer data
    return await parseFile(filePath, answerData);
  } catch (error) {
    console.error('Error parsing exam file:', error);
    console.error(error.stack); // Log the full stack trace
    throw error;
  }
};

module.exports = {
  parseFile,
  parsePdf,
  parseWord,
  extractQuestionsDirectly,
  extractQuestionsWithEnhancedAI,
  categorizeQuestionsWithAI,
  parseAnswerFile,
  parseExamFile
};