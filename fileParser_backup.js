const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
// Import the centralized Gemini client for AI-assisted categorization
const geminiClient = require('./geminiClient');

/**
 * Parse a PDF file
 * @param {string} filePath - Path to the PDF file
 * @returns {string} - Extracted text
 */
const parsePdf = async (filePath) => {
  return new Promise((resolve, reject) => {
    try {
      console.log(`Parsing PDF file: ${filePath}`);
      const dataBuffer = fs.readFileSync(filePath);

      pdfParse(dataBuffer)
        .then(data => {
          // Check if we got any text
          if (!data.text || data.text.trim().length === 0) {
            console.error('PDF parsing returned empty text');
            reject(new Error('PDF parsing returned empty text'));
            return;
          }

          console.log(`Successfully parsed PDF, extracted ${data.text.length} characters`);
          console.log(`PDF content preview: ${data.text.substring(0, 200)}...`);

          resolve(data.text);
        })
        .catch(error => {
          console.error('Error parsing PDF:', error);
          reject(new Error(`Failed to parse PDF file: ${error.message}`));
        });
    } catch (error) {
      console.error('Error reading PDF file:', error);
      reject(new Error(`Failed to read PDF file: ${error.message}`));
    }
  });
};

/**
 * Parse a Word document
 * @param {string} filePath - Path to the Word document
 * @returns {string} - Extracted text
 */
const parseWord = async (filePath) => {
  return new Promise((resolve, reject) => {
    try {
      console.log(`Parsing Word document: ${filePath}`);
      const dataBuffer = fs.readFileSync(filePath);

      mammoth.extractRawText({ buffer: dataBuffer })
        .then(result => {
          // Check if we got any text
          if (!result.value || result.value.trim().length === 0) {
            console.error('Word document parsing returned empty text');
            reject(new Error('Word document parsing returned empty text'));
            return;
          }

          console.log(`Successfully parsed Word document, extracted ${result.value.length} characters`);
          console.log(`Word document content preview: ${result.value.substring(0, 200)}...`);

          // Log any warnings
          if (result.messages && result.messages.length > 0) {
            console.log('Word document parsing warnings:', result.messages);
          }

          resolve(result.value);
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
 * Extract questions from text using AI
 * @param {string} text - Text extracted from document
 * @returns {Array} - Array of structured questions
 */
const extractQuestionsWithAI = async (text) => {
  try {
    // Get the generative model from our centralized client
    // Our geminiClient will try multiple model name variations
    const model = geminiClient.getModel('gemini-pro');

    // Create the prompt for extracting questions
    const prompt = `
    You are an AI assistant that helps extract exam questions from text.
    The exam follows Rwanda's NESA exam structure with sections A, B, and C.

    Section A: Multiple choice questions (1-2 points each)
    Section B: Short answer questions (5-10 points each)
    Section C: Long answer/essay questions (10-20 points each)

    Please analyze the following text and extract all questions, organizing them into the appropriate sections.

    IMPORTANT GUIDELINES:
    1. Identify ALL questions in the text, even if they're not explicitly labeled by section
    2. Look for question marks, numbered items, or text that appears to be asking for information
    3. Categorize questions based on their type:
       - Multiple choice questions go in Section A
       - Short answer questions go in Section B
       - Essay/long answer questions go in Section C
    4. For multiple-choice questions:
       - Identify all options (usually labeled A, B, C, D)
       - Mark the correct answer (if provided in the text)
       - Assign 1-2 points per question
    5. For open-ended questions:
       - Provide a model answer based on the text
       - Assign 5-10 points for short answers (Section B)
       - Assign 10-20 points for essays (Section C)
    6. If the text doesn't have enough questions for all sections, create additional questions based on the content to ensure each section has at least 1-2 questions
    7. If the text appears to be a hardware or computer science exam, create appropriate questions related to hardware components, computer systems, networking, etc.
    8. IMPORTANT: If the text is difficult to parse or appears to be formatted strangely, do your best to extract meaningful content and create appropriate questions

    Format your response as a JSON object with the following structure:
    {
      "sections": [
        {
          "name": "A",
          "description": "Multiple Choice Questions",
          "questions": [
            {
              "text": "question text",
              "type": "multiple-choice",
              "options": [
                {"text": "option 1", "isCorrect": false},
                {"text": "option 2", "isCorrect": true},
                ...
              ],
              "correctAnswer": "correct answer text",
              "points": 1
            },
            ...
          ]
        },
        {
          "name": "B",
          "description": "Short Answer Questions",
          "questions": [
            {
              "text": "question text",
              "type": "open-ended",
              "options": [],
              "correctAnswer": "model answer text",
              "points": 5
            },
            ...
          ]
        },
        {
          "name": "C",
          "description": "Long Answer Questions",
          "questions": [
            {
              "text": "question text",
              "type": "open-ended",
              "options": [],
              "correctAnswer": "detailed model answer",
              "points": 10
            },
            ...
          ]
        }
      ]
    }

    Here's the text to analyze:

    ${text}

    Only return the JSON object, nothing else. Make sure the JSON is valid and properly formatted.
    `;

    // Generate content with retry logic
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        console.log(`AI extraction attempt ${attempts + 1} of ${maxAttempts}`);

        // Set generation config for better JSON output
        const generationConfig = {
          temperature: 0.2,  // Lower temperature for more deterministic output
          topP: 0.8,
          topK: 40,
          maxOutputTokens: 4096, // Reduced token count to avoid quota issues
        };

        console.log('Sending request to Gemini API...');

        // Add timeout to avoid hanging if API is unresponsive
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Gemini API request timed out')), 15000);
        });

        // Race the API call against the timeout
        const result = await Promise.race([
          model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig,
          }),
          timeoutPromise
        ]);

        console.log('Received response from Gemini API');

        // Get the response text directly from the result
        const responseText = result.response.text();

        // Clean up the response to ensure it's valid JSON
        const jsonStart = responseText.indexOf('{');
        const jsonEnd = responseText.lastIndexOf('}') + 1;

        if (jsonStart === -1 || jsonEnd === 0) {
          console.warn('No JSON object found in AI response');
          throw new Error('No JSON object found in AI response');
        }

        const jsonText = responseText.substring(jsonStart, jsonEnd);
        console.log('Successfully extracted JSON from AI response');

        // Parse and validate the JSON
        const parsedJson = JSON.parse(jsonText);

        // Validate the structure
        if (!parsedJson.sections || !Array.isArray(parsedJson.sections)) {
          throw new Error('Invalid JSON structure: missing sections array');
        }

        // Ensure each section has the required fields
        for (const section of parsedJson.sections) {
          if (!section.name || !section.questions || !Array.isArray(section.questions)) {
            throw new Error(`Invalid section structure in section ${section.name || 'unknown'}`);
          }

          // Add description if missing
          if (!section.description) {
            if (section.name === 'A') section.description = 'Multiple Choice Questions';
            else if (section.name === 'B') section.description = 'Short Answer Questions';
            else if (section.name === 'C') section.description = 'Long Answer Questions';
            else section.description = `Section ${section.name}`;
          }
        }

        console.log(`Successfully extracted ${parsedJson.sections.length} sections with questions`);
        return parsedJson;
      } catch (error) {
        console.error(`Attempt ${attempts + 1} failed:`, error);
        attempts++;

        if (attempts >= maxAttempts) {
          console.error('All AI extraction attempts failed');
          throw new Error('Failed to extract questions with AI after multiple attempts');
        }

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  } catch (error) {
    console.error('Error extracting questions with AI:', error);
    throw new Error('Failed to extract questions with AI');
  }
};

/**
 * Extract questions directly from text without using AI
 * @param {string} text - Text extracted from document
 * @returns {Object} - Structured questions
 */
const extractQuestionsDirectly = async (text) => {
  console.log('Extracting questions directly from text...');

  // Initialize the exam structure
  const examStructure = {
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

  // Split the text into lines for processing
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

  console.log(`Processing ${lines.length} lines of text`);

  // Variables to track current section and question being processed
  let currentSection = null;
  let currentQuestion = null;
  let inOptions = false;
  let multiLineQuestion = false;
  let multiLineQuestionText = '';
  let pendingOptions = [];

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

    // Check for section headers - even more comprehensive patterns
    // Enhanced to detect more section header formats
    const sectionHeaderPatterns = [
      // Basic section patterns
      /^SECTION\s+[A-C]/i,                                  // SECTION A
      /^PART\s+[A-C]/i,                                     // PART A
      /^[A-C]\.\s+/,                                        // A.
      /^SECTION\s+[A-C]:/i,                                 // SECTION A:
      /^PART\s+[A-C]:/i,                                    // PART A:
      /^[A-C]\s*[-:]/i,                                     // A- or A:

      // Question type indicators
      /^MULTIPLE\s+CHOICE/i,                                // MULTIPLE CHOICE
      /^SHORT\s+ANSWER/i,                                   // SHORT ANSWER
      /^ESSAY/i,                                            // ESSAY
      /^LONG\s+ANSWER/i,                                    // LONG ANSWER

      // Section headers with descriptions
      /^SECTION\s*[A-C]?\s*[-:–—]\s*(.+)/i,                 // Section A - Description
      /^PART\s*[A-C]?\s*[-:–—]\s*(.+)/i,                    // Part A - Description
      /^[A-C]\s*[-:–—]\s*(.+)/i,                            // A - Description

      // Standalone section indicators
      /^SECTION\s*[A-C]?$/i,                                // Just "SECTION A" on its own line
      /^PART\s*[A-C]?$/i,                                   // Just "PART A" on its own line
      /^[A-C]$/i,                                           // Just "A" on its own line

      // Headers with numbers instead of letters
      /^SECTION\s*[1-3]/i,                                  // Section 1, 2, 3
      /^PART\s*[1-3]/i,                                     // Part 1, 2, 3
      /^[1-3]\.\s+(.+)/i,                                   // 1. Description

      // NESA exam format patterns
      /^SECTION\s*[A-C]?\s*\(\d+\s*(?:MARKS|POINTS|M|PTS?)\)/i,  // SECTION A (10 MARKS) or SECTION A (10M)
      /^PART\s*[A-C]?\s*\(\d+\s*(?:MARKS|POINTS|M|PTS?)\)/i,     // PART A (10 MARKS) or PART A (10M)
      /^[A-C]\s*\(\d+\s*(?:MARKS|POINTS|M|PTS?)\)/i,             // A (10 MARKS) or A (10M)

      // Patterns with square brackets
      /^SECTION\s*[A-C]?\s*\[\d+\s*(?:MARKS|POINTS|M|PTS?)\]/i,  // SECTION A [10 MARKS] or SECTION A [10M]
      /^PART\s*[A-C]?\s*\[\d+\s*(?:MARKS|POINTS|M|PTS?)\]/i,     // PART A [10 MARKS] or PART A [10M]
      /^[A-C]\s*\[\d+\s*(?:MARKS|POINTS|M|PTS?)\]/i,             // A [10 MARKS] or A [10M]

      // Patterns with underlines or decorations
      /^_{3,}\s*SECTION\s*[A-C]/i,                          // _____ SECTION A
      /^={3,}\s*SECTION\s*[A-C]/i,                          // ===== SECTION A
      /^\*{3,}\s*SECTION\s*[A-C]/i,                         // ***** SECTION A
      /^-{3,}\s*SECTION\s*[A-C]/i,                          // ----- SECTION A

      // Patterns with question types
      /^OBJECTIVE\s+(?:QUESTIONS|SECTION)/i,                // OBJECTIVE QUESTIONS (typically Section A)
      /^THEORY\s+(?:QUESTIONS|SECTION)/i,                   // THEORY QUESTIONS (typically Section B)
      /^PRACTICAL\s+(?:QUESTIONS|SECTION)/i,                // PRACTICAL QUESTIONS (typically Section C)

      // Patterns with specific keywords
      /^ANSWER\s+ALL\s+QUESTIONS\s+IN\s+(?:THIS|SECTION)/i, // ANSWER ALL QUESTIONS IN THIS SECTION
      /^CHOOSE\s+(?:ONE|TWO|THREE|FOUR|FIVE)\s+QUESTIONS/i, // CHOOSE ONE QUESTION

      // NESA specific patterns
      /^INSTRUCTIONS\s+TO\s+CANDIDATES/i,                   // INSTRUCTIONS TO CANDIDATES (often precedes sections)
      /^SECTION\s*[A-C]?\s*[-–—:]\s*(?:MULTIPLE\s+CHOICE|SHORT\s+ANSWER|ESSAY|LONG\s+ANSWER)/i, // SECTION A - MULTIPLE CHOICE
      /^SECTION\s*[A-C]?\s*:\s*(?:MULTIPLE\s+CHOICE|SHORT\s+ANSWER|ESSAY|LONG\s+ANSWER)/i,      // SECTION A: MULTIPLE CHOICE

      // Headings that might indicate sections
      /^(?:SECTION|PART)\s*[A-C]?\s*[-–—:]\s*(.+)/i,        // SECTION/PART with description
      /^(?:SECTION|PART)\s*[A-C]?\s*\((\d+)\s*(?:marks|points|m|pts?)\)/i, // SECTION A (20 marks)

      // Standalone section indicators
      /^(?:SECTION|PART)\s+[A-C](?:\s+|$)/i,                // SECTION A or PART A

      // Headings with specific section-related content
      /^(?:COMPUTER|HARDWARE|SOFTWARE|NETWORK|SYSTEM|DATABASE|PROGRAMMING)\s+(?:BASICS|FUNDAMENTALS|CONCEPTS|PRINCIPLES)/i, // Subject headings

      // Additional NESA format patterns
      /^SECTION\s*[A-C]?\s*[-–—:]\s*\(\d+\s*(?:MARKS|POINTS|M|PTS?)\)/i, // SECTION A - (10 MARKS)
      /^SECTION\s*[A-C]?\s*\(\d+\s*(?:MARKS|POINTS|M|PTS?)\)\s*[-–—:]/i, // SECTION A (10 MARKS) -

      // Patterns with total marks
      /^TOTAL\s*:\s*\d+\s*(?:MARKS|POINTS|M|PTS?)/i,        // TOTAL: 100 MARKS (often follows a section)

      // Patterns with time allocation
      /^TIME\s*(?:ALLOWED|ALLOCATION)\s*:\s*\d+\s*(?:MINUTES|HOURS|MIN|HR)/i, // TIME ALLOWED: 60 MINUTES

      // Patterns with both marks and time
      /^SECTION\s*[A-C]?\s*\(\s*\d+\s*(?:MARKS|POINTS|M|PTS?)\s*,\s*\d+\s*(?:MINUTES|HOURS|MIN|HR)\s*\)/i, // SECTION A (20 MARKS, 30 MINUTES)

      // Patterns with question counts
      /^SECTION\s*[A-C]?\s*\(\s*\d+\s*QUESTIONS\s*\)/i,     // SECTION A (10 QUESTIONS)

      // Patterns with both question counts and marks
      /^SECTION\s*[A-C]?\s*\(\s*\d+\s*QUESTIONS\s*,\s*\d+\s*(?:MARKS|POINTS|M|PTS?)\s*\)/i, // SECTION A (10 QUESTIONS, 20 MARKS)

      // Patterns with mandatory/optional indicators
      /^(?:COMPULSORY|MANDATORY|OPTIONAL)\s+(?:SECTION|QUESTIONS)/i, // COMPULSORY SECTION or OPTIONAL QUESTIONS

      // Patterns with section numbering
      /^(?:SECTION|PART)\s+(?:ONE|TWO|THREE|I|II|III)/i,    // SECTION ONE or PART I

      // Patterns with specific NESA keywords
      /^READING\s+TIME/i,                                   // READING TIME
      /^WORKING\s+TIME/i,                                   // WORKING TIME
      /^EXAMINATION\s+MATERIALS/i                           // EXAMINATION MATERIALS
    ];

    // Check if the line matches any of the section header patterns
    if (sectionHeaderPatterns.some(pattern => line.match(pattern))) {
      // Extract section letter (A, B, or C) or number (1, 2, 3)
      let sectionLetter = null;
      let sectionDescription = null;

      // First try to extract section letter A, B, C with more specific patterns
      // Look for patterns like "SECTION A", "PART B", "SECTION C:", etc.
      const sectionPatterns = [
        /SECTION\s+([A-C])/i,                    // SECTION A
        /PART\s+([A-C])/i,                       // PART B
        /^([A-C])\s*[-:–—]/i,                    // A - or A:
        /^([A-C])\s*\(/i,                        // A (
        /^([A-C])\.?\s+/i,                       // A. or A
        /SECTION\s*([A-C])?\s*[-:–—]/i,          // SECTION - or SECTION A -
        /SECTION\s*([A-C])?\s*:/i,               // SECTION: or SECTION A:
        /SECTION\s*([A-C])?\s*\(/i               // SECTION ( or SECTION A (
      ];

      // Try each pattern to find a section letter
      for (const pattern of sectionPatterns) {
        const match = line.match(pattern);
        if (match && match[1]) {
          sectionLetter = match[1].toUpperCase();
          console.log(`Found section letter ${sectionLetter} using pattern: ${pattern}`);
          break;
        }
      }

      // If no letter found, try to extract section number 1, 2, 3 and map to A, B, C
      if (!sectionLetter) {
        const numberPatterns = [
          /SECTION\s+([1-3])/i,                  // SECTION 1
          /PART\s+([1-3])/i,                     // PART 2
          /^([1-3])\s*[-:–—]/i,                  // 1 - or 1:
          /^([1-3])\.?\s+/i                      // 1. or 1
        ];

        for (const pattern of numberPatterns) {
          const match = line.match(pattern);
          if (match && match[1]) {
            const sectionNumber = parseInt(match[1]);
            sectionLetter = String.fromCharCode(64 + sectionNumber); // 1->A, 2->B, 3->C
            console.log(`Mapped section number ${sectionNumber} to letter ${sectionLetter}`);
            break;
          }
        }
      }

      // Try to extract section description
      const descriptionPatterns = [
        /[-:–—]\s*(.+)/i,                        // - Description
        /:\s*(.+)/i,                             // : Description
        /\(\d+\s*(?:MARKS|POINTS)\)\s*(.+)/i     // (10 MARKS) Description
      ];

      for (const pattern of descriptionPatterns) {
        const match = line.match(pattern);
        if (match && match[1] && match[1].trim().length > 0) {
          sectionDescription = match[1].trim();
          console.log(`Found section description: "${sectionDescription}"`);
          break;
        }
      }

      // If still no section letter, assign based on keywords in the line
      if (!sectionLetter) {
        // Check for multiple choice indicators (Section A)
        if (line.match(/MULTIPLE\s+CHOICE|OBJECTIVE|MCQ|CHOOSE\s+(?:THE\s+)?(?:CORRECT|RIGHT|BEST)\s+(?:ANSWER|OPTION)|TRUE\s+(?:OR|AND)\s+FALSE/i)) {
          sectionLetter = 'A';
          console.log(`Assigned section A based on multiple choice keywords in: "${line}"`);
        }
        // Check for short answer indicators (Section B)
        else if (line.match(/SHORT\s+ANSWER|BRIEF\s+ANSWER|THEORY\s+QUESTIONS|ANSWER\s+BRIEFLY|FILL\s+IN|COMPLETE\s+THE\s+FOLLOWING|DEFINE|EXPLAIN\s+BRIEFLY|LIST|IDENTIFY/i)) {
          sectionLetter = 'B';
          console.log(`Assigned section B based on short answer keywords in: "${line}"`);
        }
        // Check for essay/long answer indicators (Section C)
        else if (line.match(/ESSAY|LONG\s+ANSWER|STRUCTURED|PRACTICAL|DETAILED|COMPREHENSIVE|EXPLAIN\s+IN\s+DETAIL|WRITE\s+(?:AN|A)\s+ESSAY|DISCUSS|ANALYZE|EVALUATE|COMPARE\s+AND\s+CONTRAST/i)) {
          sectionLetter = 'C';
          console.log(`Assigned section C based on essay keywords in: "${line}"`);
        }
      }

      // If we found a section header but couldn't determine the letter, use context clues
      if (!sectionLetter) {
        // If the line contains "SECTION" or "PART", try to determine the section based on context
        if (line.match(/SECTION|PART/i)) {
          // Look at the next few lines for clues about the section type
          const nextLines = lines.slice(i + 1, i + 5).join(' ').toLowerCase();

          if (nextLines.includes('multiple choice') || nextLines.includes('choose') ||
              nextLines.match(/\([a-d]\)/) || nextLines.match(/[a-d]\)/)) {
            sectionLetter = 'A';
            console.log(`Assigned section A based on context in next few lines`);
          } else if (nextLines.includes('short answer') || nextLines.includes('briefly') ||
                    nextLines.match(/\(\d+\s*marks?\)/i) && !nextLines.includes('essay')) {
            sectionLetter = 'B';
            console.log(`Assigned section B based on context in next few lines`);
          } else if (nextLines.includes('essay') || nextLines.includes('discuss') ||
                    nextLines.includes('explain in detail') || nextLines.includes('analyze')) {
            sectionLetter = 'C';
            console.log(`Assigned section C based on context in next few lines`);
          } else {
            // Default progression if we can't determine from context
            if (!currentSection || currentSection === 'C') {
              sectionLetter = 'A'; // Start with A or cycle back to A
            } else if (currentSection === 'A') {
              sectionLetter = 'B'; // Move from A to B
            } else if (currentSection === 'B') {
              sectionLetter = 'C'; // Move from B to C
            }
            console.log(`Assigned section ${sectionLetter} based on default progression from ${currentSection || 'none'}`);
          }
        }
      }

      if (sectionLetter) {
        currentSection = sectionLetter;
        console.log(`Found Section ${sectionLetter} from line: "${line}"`);

        // Store the section description if available
        if (sectionDescription) {
          // Update the section description in the exam structure
          const sectionIndex = examStructure.sections.findIndex(s => s.name === sectionLetter);
          if (sectionIndex !== -1) {
            examStructure.sections[sectionIndex].description = sectionDescription;
            console.log(`Updated description for Section ${sectionLetter}: "${sectionDescription}"`);
          }
        }
        // If no description was found in the patterns, try to extract it from the line
        else {
          // Try different patterns to extract description
          const descPatterns = [
            /[-:–—]\s*(.+)/i,                        // - Description
            /:\s*(.+)/i,                             // : Description
            /\(\d+\s*(?:MARKS|POINTS)\)\s*(.+)/i,    // (10 MARKS) Description
            /^(?:SECTION|PART)\s+[A-C]\s+(.+)/i,     // SECTION A Description
            /^[A-C]\.\s+(.+)/i                       // A. Description
          ];

          for (const pattern of descPatterns) {
            const descMatch = line.match(pattern);
            if (descMatch && descMatch[1] && descMatch[1].trim().length > 0) {
              const description = descMatch[1].trim();
              // Update the section description in the exam structure
              const sectionIndex = examStructure.sections.findIndex(s => s.name === sectionLetter);
              if (sectionIndex !== -1) {
                examStructure.sections[sectionIndex].description = description;
                console.log(`Extracted description for Section ${sectionLetter}: "${description}"`);
                break;
              }
            }
          }
        }

        // If we found a section header, reset the current question
        // This ensures questions don't carry over between sections
        currentQuestion = null;
        inOptions = false;

        continue;
      }
    }

    // Check for question patterns
    // Look for numbered questions like "1.", "Question 1:", etc.
    const questionPatterns = [
      /^(\d+)\.?\s+(.+)/,                      // 1. Question text
      /^Question\s+(\d+)[:.]?\s+(.+)/i,        // Question 1: Question text
      /^Q\.?\s*(\d+)[:.]?\s+(.+)/i,            // Q1: Question text
      /^(\d+)\s*\)\s+(.+)/,                    // 1) Question text
      /^\((\d+)\)\s+(.+)/                      // (1) Question text
    ];

    // Special pattern for multiple choice questions that might span multiple lines
    const multipleChoicePattern = /^(\d+)\.?\s+(.+?)(?:\s+a\)|\s+\(a\)|\s+a\.)/i;

    let questionMatch = null;
    for (const pattern of questionPatterns) {
      questionMatch = line.match(pattern);
      if (questionMatch) {
        const questionNumber = parseInt(questionMatch[1]);
        const questionText = questionMatch[2].trim();

        // If we have a question number and text, create a new question
        if (questionNumber && questionText) {
          // Determine the question type and section based on context
          let questionType = 'open-ended'; // Default type
          let questionSection = currentSection || 'C'; // Default to section C if no current section

          // Check if this is a multiple choice question
          // Look ahead a few lines to see if there are options
          const nextLines = lines.slice(i + 1, i + 6).join('\n').toLowerCase();
          const hasOptions = nextLines.match(/\([a-d]\)|\s+[a-d]\)|\s+[a-d]\.\s+/);

          if (hasOptions) {
            questionType = 'multiple-choice';
            questionSection = 'A'; // Multiple choice questions go in section A
          } else if (questionText.length < 100 ||
                    questionText.match(/define|list|name|identify|state|what is|explain briefly/i)) {
            // Short questions typically go in section B
            questionSection = 'B';
          } else if (questionText.match(/discuss|analyze|evaluate|explain in detail|compare|contrast|essay|elaborate/i) ||
                    questionText.length > 200) {
            // Long questions typically go in section C
            questionSection = 'C';
          }

          // Create the question object
          currentQuestion = {
            id: examStructure.sections.reduce((total, section) => total + section.questions.length, 0),
            text: questionText,
            type: questionType,
            options: [],
            correctAnswer: '',
            points: questionSection === 'A' ? 1 : questionSection === 'B' ? 5 : 10,
            section: questionSection,
            currentSection: questionSection // Track the current section for AI categorization
          };

          // Add the question to the appropriate section
          const sectionIndex = examStructure.sections.findIndex(s => s.name === questionSection);
          if (sectionIndex !== -1) {
            examStructure.sections[sectionIndex].questions.push(currentQuestion);
            console.log(`Added question ${questionNumber} to Section ${questionSection}: "${questionText.substring(0, 50)}..."`);
          }

          // If this is a multiple choice question, prepare to collect options
          if (questionType === 'multiple-choice') {
            inOptions = true;
            pendingOptions = [];
          }

          continue;
        }
      }
    }

    // Check for multiple choice options if we're in a multiple choice question
    if (currentQuestion && currentQuestion.type === 'multiple-choice' && inOptions) {
      // Look for option patterns like "(a)", "a)", "a.", etc.
      const optionPatterns = [
        /^\(([a-d])\)\s+(.+)/i,                // (a) Option text
        /^([a-d])\)\s+(.+)/i,                  // a) Option text
        /^([a-d])\.?\s+(.+)/i,                 // a. Option text
        /^Option\s+([a-d])[:.]?\s+(.+)/i       // Option a: Option text
      ];

      let optionMatch = null;
      for (const pattern of optionPatterns) {
        optionMatch = line.match(pattern);
        if (optionMatch) {
          const optionLetter = optionMatch[1].toLowerCase();
          const optionText = optionMatch[2].trim();

          // Add the option to the current question
          currentQuestion.options.push({
            text: optionText,
            isCorrect: false // Default to false, we'll set the correct answer later if available
          });

          console.log(`Added option ${optionLetter} to question ${currentQuestion.id}: "${optionText}"`);
          break;
        }
      }
    }
  }

  // Check if we need to use AI to help categorize questions
  const totalQuestions = examStructure.sections.reduce((total, section) => total + section.questions.length, 0);

  // Count questions in each section
  const sectionAQuestions = examStructure.sections.find(s => s.name === 'A')?.questions.length || 0;
  const sectionBQuestions = examStructure.sections.find(s => s.name === 'B')?.questions.length || 0;
  const sectionCQuestions = examStructure.sections.find(s => s.name === 'C')?.questions.length || 0;

  console.log(`Question distribution: Section A: ${sectionAQuestions}, Section B: ${sectionBQuestions}, Section C: ${sectionCQuestions}`);

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
 * @returns {Object} - Updated exam structure with categorized questions
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

    console.log('Using AI to help categorize questions into appropriate sections...');

    // Try to use a less resource-intensive model first to avoid quota limits
    let modelName = 'gemini-1.0-pro'; // Start with a smaller model

    console.log(`Using ${modelName} to categorize questions to avoid quota limits`);
    const model = geminiClient.getModel(modelName);

    // Process questions in smaller batches to avoid hitting quota limits
    const BATCH_SIZE = 3; // Process just a few questions at a time
    const batches = [];

    // Split questions into smaller batches
    for (let i = 0; i < allQuestions.length; i += BATCH_SIZE) {
        batches.push(allQuestions.slice(i, i + BATCH_SIZE));
    }

    console.log(`Split ${allQuestions.length} questions into ${batches.length} batches of max ${BATCH_SIZE} questions each`);

    // Process each batch and collect results
    const categorization = {};

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
 * @returns {Object} - Structured questions
 */
const parseFile = async (filePath) => {
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
    const questions = await extractQuestionsDirectly(text);
    return questions;
  } catch (error) {
    console.error('Error parsing file:', error);
    throw error;
  }
};

module.exports = {
  parseFile,
  parsePdf,
  parseWord,
  extractQuestionsDirectly,
  categorizeQuestionsWithAI
};