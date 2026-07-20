const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const mammoth = require('mammoth');
const axios = require('axios');
const { cloudinary } = require('../config/cloudinary');
// Import the centralized Groq client for AI-assisted categorization
const groqClient = require('./groqClient');
const { coerceToGrid } = require('./spreadsheetGrading');

const execAsync = promisify(exec);

// A stray '(' or ')' character occasionally leaks into an otherwise-valid, otherwise-complete
// JSON response from the AI when it generates longer structured output (observed live: an extra
// ')' sitting between a table's closing brace and the tables array's closing bracket, corrupting
// an otherwise fully correct multi-table financial-spreadsheet answer). JSON syntax never
// legitimately contains a bare parenthesis outside of a quoted string, so stripping any '(' / ')'
// found OUTSIDE string literals is a safe, targeted repair - it can only remove characters that
// could never have been part of valid JSON to begin with (mirrored in routes/exam.js).
const stripStrayParensOutsideStrings = (str) => {
  let result = '';
  let inString = false;
  let escaped = false;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (inString) {
      result += ch;
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; result += ch; continue; }
    if (ch === '(' || ch === ')') continue; // drop stray parens outside strings
    result += ch;
  }
  return result;
};

// Normalize a spreadsheetTemplate/spreadsheetModelAnswer field returned by the AI into the
// canonical { tables: [{ title, headers, data }, ...] } JSON-string shape expected by the
// financial-spreadsheet question renderer/grader (mirrors normalizeSpreadsheetField in routes/exam.js).
const normalizeSpreadsheetField = (value) => {
  if (!value) return value;
  const tryParse = (s) => { try { return JSON.parse(s); } catch { return null; } };
  const parsed = typeof value === 'string'
    ? (tryParse(value) || tryParse(stripStrayParensOutsideStrings(value)))
    : value;
  const grid = coerceToGrid(parsed);
  return grid ? JSON.stringify(grid) : (typeof value === 'string' ? value : JSON.stringify(value));
};

/**
 * Resolve a PDF reference (local path or Cloudinary URL) to a local file path, downloading it
 * to a temp file first if needed. Returns { localFilePath, isTemp } — caller is responsible for
 * deleting the temp file when isTemp is true.
 */
const resolveLocalPdfPath = async (filePath) => {
  if (!(filePath.startsWith('http://') || filePath.startsWith('https://'))) {
    return { localFilePath: filePath, isTemp: false };
  }
  console.log('Downloading PDF from URL:', filePath);
  let downloadUrl = filePath;
  if (filePath.includes('cloudinary.com')) {
    const urlParts = filePath.split('/');
    const versionIndex = urlParts.findIndex(part => /^\d+$/.test(part));
    if (versionIndex !== -1 && versionIndex < urlParts.length - 1) {
      const publicIdWithExt = urlParts.slice(versionIndex + 1).join('/');
      const publicId = publicIdWithExt.replace(/\.[^/.]+$/, '');
      downloadUrl = cloudinary.url(publicId, { resource_type: 'raw', sign_url: true, type: 'upload' });
      console.log('Extracted public_id:', publicId);
      console.log('Generated signed URL:', downloadUrl);
    }
  }
  const response = await axios.get(downloadUrl, { responseType: 'arraybuffer' });
  const tempDir = path.join(__dirname, '../temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  const localFilePath = path.join(tempDir, `temp-${Date.now()}.pdf`);
  fs.writeFileSync(localFilePath, response.data);
  console.log('Downloaded PDF to:', localFilePath);
  return { localFilePath, isTemp: true };
};

// One page per vision call, not several. Batching multiple page-images into a single call was
// tried first (Groq allows up to 5 per request) but proved unreliable live: given a 5-page batch,
// the model transcribed the first few pages in full and then silently stopped, dropping the rest
// (two entire exam questions vanished from a real transcription this way, confirmed by their text
// being completely absent from the output with no truncation warning). A single page is a small
// enough task that the model has no reason to give up partway through, and pages are still
// transcribed with real concurrency (see runWithConcurrencyLimit below), so this isn't slower in
// wall-clock terms - just more, smaller, more reliable calls instead of few, large, riskier ones.
const VISION_PAGE_CONCURRENCY = 4;
const VISION_MAX_PAGES = 15;

/**
 * First-choice PDF extraction: render every page to an image and have the Groq vision model
 * (the account's only vision-capable model — see GROQ_MODELS.vision in groqClient.js) transcribe
 * it verbatim. Unlike pdfplumber (which only reads a PDF's embedded text layer) or Tesseract OCR
 * (dumb character recognition with no structural understanding), a vision LLM can read scanned
 * pages, handwriting, and reconstruct tables/columns the way a person would. This only produces
 * plain transcribed text (mirroring the same "vision transcribes, text model reasons" split used
 * elsewhere in this codebase) — it deliberately does NOT try to build the final exam JSON itself,
 * so the existing, already-robust pasted-exam-parsing prompt in /exam/ai-generate still does that
 * part unchanged.
 */
const extractPdfViaVision = async (filePath) => {
  const { localFilePath, isTemp } = await resolveLocalPdfPath(filePath);
  try {
    const scriptPath = path.join(__dirname, '../pdf_extractor.py');
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    const { stdout, stderr } = await execAsync(`${pythonCmd} "${scriptPath}" "${localFilePath}" --render-pages`, { maxBuffer: 1024 * 1024 * 200 });
    if (stderr) {
      console.error('Python page-render stderr:', stderr);
    }
    const result = JSON.parse(stdout);
    if (result.error || !Array.isArray(result.pages) || result.pages.length === 0) {
      throw new Error(result.error || 'No pages rendered');
    }

    const pages = result.pages.slice(0, VISION_MAX_PAGES);
    console.log(`Vision PDF extraction: rendered ${pages.length} page(s), transcribing one page per call (up to ${VISION_PAGE_CONCURRENCY} in parallel)`);

    const transcribePrompt = `Transcribe this exam document page completely and exactly as it appears, in reading order. Include every question, instruction, passage, word bank, diagram description (describe what the diagram/figure shows in words), and — if present — any teacher's marking guide/answer key. Preserve tables as rows of text with cells separated by " | ". Do not summarize, correct, or omit anything; this is a verbatim transcription, not an interpretation.
Return ONLY JSON: {"extractedText": "..."}`;

    const pageTexts = await runWithConcurrencyLimit(pages, VISION_PAGE_CONCURRENCY, async (page) => {
      // A single page is usually a small transcription task, but the vision model (a reasoning
      // model) occasionally still spends its token budget on internal chain-of-thought before
      // writing any output, hitting "max completion tokens reached before generating a valid
      // document" at maxTokens=4096 (the same failure mode fixed elsewhere in this codebase by
      // retrying once with a higher cap) - a dense, table-heavy page seems most likely to trigger
      // it. One retry at a much higher ceiling recovers most of these; only give up after that.
      for (const maxTokens of [4096, 12000]) {
        try {
          const pageResult = await groqClient.generateContent(transcribePrompt, {
            images: [page.dataUrl],
            jsonMode: true,
            temperature: 0.1,
            maxTokens,
            skipCache: maxTokens !== 4096
          });
          return (pageResult.parsedContent?.extractedText || '').trim();
        } catch (err) {
          console.warn(`Vision transcription failed for page ${page.page} at maxTokens=${maxTokens}:`, err.message);
        }
      }
      console.error(`Vision transcription failed for page ${page.page} after retry, leaving it blank`);
      return '';
    });

    let combinedText = '';
    pages.forEach((page, i) => {
      if (pageTexts[i]) {
        combinedText += `\n--- PAGE ${page.page} ---\n${pageTexts[i]}\n`;
      }
    });

    if (!combinedText.trim()) {
      throw new Error('Vision model returned no transcribed text');
    }
    console.log(`Vision PDF extraction succeeded: ${combinedText.length} characters from ${pages.length} page(s)`);
    return { text: combinedText, images: [], method: 'vision' };
  } finally {
    if (isTemp && fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
      console.log('Cleaned up temp file:', localFilePath);
    }
  }
};

/**
 * Parse a PDF file — tries the vision-model extraction first (handles scanned/handwritten pages,
 * tables, and diagrams far better than a text-layer parser), falling back to the existing
 * pdfplumber/OCR Python pipeline if vision extraction fails or is unavailable for any reason.
 * @param {string} filePath - Path to the PDF file (local path or Cloudinary URL)
 * @returns {Promise<{text: string, images: Array}>}
 */
const parsePdf = async (filePath) => {
  try {
    return await extractPdfViaVision(filePath);
  } catch (visionError) {
    console.warn('Vision-based PDF extraction failed, falling back to pdfplumber/OCR:', visionError.message);
  }

  try {
    console.log(`Parsing PDF file using Python: ${filePath}`);
    const { localFilePath, isTemp } = await resolveLocalPdfPath(filePath);

    // Path to the Python script
    const scriptPath = path.join(__dirname, '../pdf_extractor.py');

    // Execute Python script (use 'python' for Windows, 'python3' for Unix)
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    const { stdout, stderr } = await execAsync(`${pythonCmd} "${scriptPath}" "${localFilePath}"`);

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
    if (result.images && result.images.length > 0) {
      console.log(`Extracted ${result.images.length} diagram image(s) from pages: ${result.images.map(i => i.page).join(', ')}`);
    }

    // Clean up temp file if it was downloaded
    if (isTemp && fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
      console.log('Cleaned up temp file:', localFilePath);
    }

    return { text: result.text, images: result.images || [] };
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
  return new Promise(async (resolve, reject) => {
    try {
      console.log(`Parsing Word document: ${filePath}`);
      
      let dataBuffer;
      
      // Check if filePath is a URL (Cloudinary)
      if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
        console.log('Downloading file from URL:', filePath);
        
        // Generate signed URL for Cloudinary
        let downloadUrl = filePath;
        if (filePath.includes('cloudinary.com')) {
          // Extract public_id from Cloudinary URL
          const urlParts = filePath.split('/');
          const fileName = urlParts[urlParts.length - 1];
          const publicId = `eexams/exam-files/${fileName.replace(/\.[^/.]+$/, '')}`;
          downloadUrl = cloudinary.url(publicId, { 
            resource_type: 'raw',
            sign_url: true,
            type: 'upload'
          });
          console.log('Generated signed URL:', downloadUrl);
        }
        
        const response = await axios.get(downloadUrl, { responseType: 'arraybuffer' });
        dataBuffer = Buffer.from(response.data);
        console.log('Downloaded file size:', dataBuffer.length);
      } else {
        // Local file
        dataBuffer = fs.readFileSync(filePath);
      }

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
const extractQuestionsWithEnhancedAI = async (text, answerData = { answers: {} }, images = []) => {
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
7. Extract all question types: multiple-choice, true-false, fill-in-blank, short answer, essay, matching, ordering, financial-spreadsheet (income statements, balance sheets, bank reconciliations, cash books, trial balances, ledgers the student must prepare)
8. EXTRACT ANSWER KEYS: If the document contains an answer key at the end (often labeled "ANSWER KEY", "MARKING SCHEME", "SOLUTIONS", or similar), extract all answers and match them to their question numbers
9. EXTRACT PASSAGES AND TEXTS: Extract ALL reading passages, comprehension texts, diagrams, tables (trial balances, ledgers, lists of account balances shown inside [TABLE]...[/TABLE] markers or as aligned text), and any text blocks that serve as supporting context for questions. Store ALL of this in the question's "passage" field (there is no separate "context" field - "passage" is the only field that is saved and shown to the student), preserving every row/figure exactly.
10. EXTRACT INSTRUCTIONS: Extract any instructions, directions, or guidelines that accompany questions or sections

CRITICAL - MODEL ANSWER GENERATION FOR OPEN-ENDED QUESTIONS:
- For ALL open-ended questions (short answer, essay, open-ended), if a model answer is NOT provided in the document, you MUST generate a comprehensive model answer
- This is ESPECIALLY important for Section B (Short Answer) and Section C (Essay/Long Answer) questions
- Generated model answers should be accurate, detailed, and appropriate for the academic level
- For mathematical questions, show the working/steps and the final answer
- For conceptual questions, provide clear explanations with key points
- For calculation questions, include the numerical answer with units where applicable
- For questions with subquestions (a, b, c), generate answers for EACH subquestion
- DO NOT leave correctAnswer as "Not provided" or empty - always provide a meaningful answer
- NEVER skip generating an answer for an open-ended question

SPECIAL HANDLING FOR FILL-IN-THE-BLANK QUESTIONS:
- When you see patterns like "with ______ ______ sides", the blanks represent missing numbers or words
- Infer the missing information from context (e.g., "shape with ______ sides" → likely needs a number like "8" for octagon)
- Preserve the blank markers (_____) in the question text
- Include the inferred answer in the correctAnswer field
- Example: If question is "Name the shape with ______ sides" and answer is "Octagon", the correctAnswer should be "8" or "Octagon (8 sides)"
- Use context clues to determine what number or word belongs in the blank
- For geometric shapes: triangle (3), square (4), pentagon (5), hexagon (6), heptagon (7), octagon (8), nonagon (9), decagon (10)
- For other contexts, use the surrounding text to infer the missing information

CRITICAL - DETECT MATCHING QUESTIONS:
- Look for questions where the answer contains pairs of items separated by "-" or similar separators (e.g., "Item A - Match 1, Item B - Match 2, Item C - Match 3")
- When you detect such patterns in the answer key, mark the question type as "matching"
- Preserve the FULL answer string in the correctAnswer field exactly as it appears (e.g., "White blood cells - Defend the body against pathogens, Red blood cells - transport of respiratory gases, platelets - Clotting of blood")
- DO NOT split the answer into separate fields - keep it as a single string in correctAnswer
- The parser will extract the left-right pairs from this string
- Examples of matching question indicators:
  * Answer contains multiple pairs with separators like " - ", " - ", " | ", " : "
  * Question text mentions "Match the following", "Match column A with column B", "Pair the items"
  * Answer format: "Term1 - Definition1, Term2 - Definition2, Term3 - Definition3"

CRITICAL - DETECT SUBQUESTIONS (INCLUDING TRUE/FALSE STATEMENTS):
- Look for questions where the answer contains multiple labeled parts (e.g., "a) False, b) True, c) True, d) True, e) False, f) True")
- When you detect such patterns, mark the question as having subQuestions
- Preserve the FULL answer string in the correctAnswer field exactly as it appears
- The parser will extract the individual subquestions from this string
- Examples of subquestion indicators:
  * Answer format: "a) False, b) True, c) True" or "a. Answer, b. Answer, c. Answer"
  * Answer format with MCQ options: "a) i) No matter, b) v) consequently, c) ii) whether, d) i) why"
  * Question text mentions "State whether each of the following statements is true or false"
  * Question text mentions "Answer the following parts" or has labeled statements a), b), c)
  * For true/false subquestions: each subquestion should have type "true-false" with correctAnswer "True" or "False"
  * For multiple-choice subquestions: each subquestion should have type "multiple-choice" with options array and correctAnswer as the option letter
  * For open-ended subquestions: each subquestion should have type "open-ended" with the full answer text
  * For numeric subquestions: each subquestion should have type "open-ended" with the numeric answer
  * Subquestions can have MIXED types within the same question (e.g., some true-false, some open-ended)
  * Each subquestion MUST have: label, text, type, correctAnswer, and points

CRITICAL - MULTI-PART QUESTIONS MUST BE SINGLE QUESTIONS:
- Questions with parts labeled a), b), c) or i), ii), iii) MUST be extracted as ONE SINGLE question
- DO NOT create separate questions for each part - they belong together
- Use the "subQuestions" array to store each part
- Example: "Question 15: The diagram shows a brick... a) i) The brick does not move sideways... ii) The weight of the brick... b) i) Does linear momentum... ii) State ONE thing..." is ONE question with 4 subquestions
- ALWAYS include the subQuestions array with ALL parts (a, b, c, d, etc.) for multi-part questions
- Each subquestion MUST have: label, text, type, correctAnswer, and points

CORRECT STRUCTURE FOR MULTI-PART QUESTIONS:
{
  "questionNumber": 15,
  "text": "The diagram (Figure 4) shows a brick being pushed by a force F on an unsmooth horizontal table.",
  "type": "open-ended",
  "subQuestions": [
    {
      "label": "a) i)",
      "text": "The pushing force does not make the brick move. Explain why: The brick does not move sideways:",
      "type": "open-ended",
      "correctAnswer": "The pushing force is equal to or less than the friction force",
      "points": 1
    },
    {
      "label": "a) ii)",
      "text": "The weight of the brick does not make it move downwards:",
      "type": "open-ended",
      "correctAnswer": "The weight is balanced by the normal reaction force from the table",
      "points": 1
    },
    {
      "label": "b) i)",
      "text": "Does the linear momentum P of the brick increase, decrease, or remain constant? Explain.",
      "type": "open-ended",
      "correctAnswer": "Linear momentum increases because the constant resultant force causes constant acceleration",
      "points": 1
    },
    {
      "label": "b) ii)",
      "text": "State ONE thing that the sliding brick does to the unsmooth table surface.",
      "type": "open-ended",
      "correctAnswer": "Generates heat / produces sound / causes friction",
      "points": 1
    }
  ],
  "points": 4
}

EXAMPLE - MULTI-PART WITH MULTIPLE-CHOICE SUBQUESTIONS:
{
  "questionNumber": 12,
  "text": "Choose the best option from the given alternatives to fill the blank space.",
  "type": "open-ended",
  "points": 4,
  "subQuestions": [
    {
      "label": "a)",
      "text": "_____ how hard she tried, her boss always complained about her work.",
      "type": "multiple-choice",
      "options": [
        {"letter": "i", "text": "No matter", "isCorrect": true},
        {"letter": "ii", "text": "As much as", "isCorrect": false},
        {"letter": "iii", "text": "Nonetheless", "isCorrect": false},
        {"letter": "iv", "text": "Although", "isCorrect": false},
        {"letter": "v", "text": "As though", "isCorrect": false}
      ],
      "correctAnswer": "i",
      "points": 1
    },
    {
      "label": "b)",
      "text": "He consistently refused to take his medicine and _____ his illness has gotten worse.",
      "type": "multiple-choice",
      "options": [
        {"letter": "i", "text": "otherwise", "isCorrect": false},
        {"letter": "ii", "text": "on the other hand", "isCorrect": false},
        {"letter": "iii", "text": "unless", "isCorrect": false},
        {"letter": "iv", "text": "as long as", "isCorrect": false},
        {"letter": "v", "text": "consequently", "isCorrect": true}
      ],
      "correctAnswer": "v",
      "points": 1
    },
    {
      "label": "c)",
      "text": "When Sir Richard Burton set out on his pilgrimage to Mecca in 1854, no one knew _____ he would return alive.",
      "type": "multiple-choice",
      "options": [
        {"letter": "i", "text": "unless", "isCorrect": false},
        {"letter": "ii", "text": "whether", "isCorrect": true},
        {"letter": "iii", "text": "in case", "isCorrect": false},
        {"letter": "iv", "text": "however", "isCorrect": false},
        {"letter": "v", "text": "until", "isCorrect": false}
      ],
      "correctAnswer": "ii",
      "points": 1
    },
    {
      "label": "d)",
      "text": "On the other hand, I have never understood _____ people have to rely on the leisure industry, instead of using their imaginations.",
      "type": "multiple-choice",
      "options": [
        {"letter": "i", "text": "why", "isCorrect": true},
        {"letter": "ii", "text": "how", "isCorrect": false},
        {"letter": "iii", "text": "when", "isCorrect": false},
        {"letter": "iv", "text": "where", "isCorrect": false}
      ],
      "correctAnswer": "i",
      "points": 1
    }
  ],
  "correctAnswer": "a) i) No matter; b) v) consequently; c) ii) whether; d) i) why"
}

CRITICAL - EXTRACT MARKS ALLOCATIONS EXACTLY:
- Exam papers show marks in parentheses after each question or part, e.g. "(2 marks)", "(17 marks)", "(Total: 40 marks)"
- Extract the marks shown for EACH part/sub-part into that part's "points" field exactly as printed - do not invent or round numbers
- When a question has sub-parts with their own marks (e.g. "(i) Income statement (17 marks)", "(ii) Balance sheet (13 marks)"), set each subQuestion's "points" to its own printed value, and set the parent question's "points" to the "(Total: X marks)" value if printed, otherwise to the sum of the sub-parts
- Do NOT split a single required output (e.g. "Income statement" worth 17 marks) into multiple sub-questions unless the document itself labels separate lettered/numbered parts
- Preserve "Section A", "Section B" headers and any instructions like "This section has one compulsory question" or "Attempt three of the four questions in this section" - put this instruction text VERBATIM into that section's "description" field.

CRITICAL - SELECTIVE ANSWERING (a section lets the student choose N of its M whole questions):
- Many national exams have a section (almost always named/lettered "B") where the student answers only SOME of the whole questions offered - e.g. "Attempt THREE of the FOUR questions in this section", "Answer any THREE questions", "Answer THREE questions from this section". This is DIFFERENT from a single question's own subQuestionConfig (which selects among PARTS of one question) - this selects among several WHOLE separate questions.
- When you detect this pattern for the section named/lettered "B" (or whichever section plays that role - REB/exam boards almost always use B for this), set the TOP-LEVEL "allowSelectiveAnswering" to true and "sectionBRequiredQuestions" to N (the required count, e.g. 3 for "attempt three of the four").
- If a DIFFERENT section (typically named/lettered "C") ALSO offers a choice among several whole questions (e.g. "Answer ONE of the following TWO questions"), set "sectionCRequiredQuestions" to that N. If section C is instead a SINGLE compulsory question (only one question offered, e.g. "SECTION C: THIS SECTION IS COMPULSORY" with just one question), leave "sectionCRequiredQuestions" at the default 1 - it is a no-op when there is only one question anyway.
- If NO section offers a choice among whole questions (every section is "answer all"), leave "allowSelectiveAnswering" as false and do not set the required-count fields.
- Still ALSO put the instruction text verbatim into that section's "description" field per the rule above - "allowSelectiveAnswering"/"sectionBRequiredQuestions"/"sectionCRequiredQuestions" are in ADDITION to, not instead of, preserving the instruction text.

CRITICAL - HANDLING TABLES AND FINANCIAL DATA (e.g. trial balances, ledger balances, account lists):
- The document text may contain blocks wrapped as [TABLE] ... [/TABLE] where each line is a row with cells separated by " | ". These represent tables (such as a trial balance, list of account balances, or ledger) detected in the original PDF. Tabular data may also appear as plain aligned text (two columns of account names and Frw/amount figures) without explicit [TABLE] markers - treat that the same way.
- Reproduce this GIVEN data (data the student is handed, not data the student must produce) faithfully as a readable table in the question's "passage" field (NOT "context" - "passage" is the field that actually gets saved and shown to the student; there is no separate "context" field), using Markdown table syntax (with "|" column separators and a header separator row) so every account name and figure survives exactly as printed - including both the debit/credit columns and the total row. NEVER drop, merge, or paraphrase rows of a trial balance or ledger.
- Do not put this given data into "options" or "correctAnswer" - it is reference data for the student, not an answer.
- NEVER copy the literal characters "[TABLE]", "[/TABLE]", or an ellipsis ("...") into your output as a stand-in for a table - those markers only exist in the SOURCE text to show you where a table starts/ends; you must read every row between them and reproduce the real row data. The document may contain SEVERAL separate [TABLE]...[/TABLE] blocks (one per question) - expand EVERY one of them in full, not just the first. A question whose "passage" still contains the literal text "[TABLE]" is an incomplete, incorrect extraction.
- Numbered adjustment notes that follow a trial balance (e.g. "1. The closing inventory...", "2. Bank interest income accrued...") belong in that same question's "passage" field, listed in full and in order, immediately after the table - these are essential to solving the question and must never be summarized or omitted.

CRITICAL - NEVER DROP A LETTERED OR NUMBERED SUB-PART:
- If a printed question has parts a), b), c)... and any of those parts has its own i), ii), iii)... sub-parts, EVERY single one of those sub-parts MUST appear in the output - even if one sub-part is a different kind of task than its siblings (e.g. part b) is mostly short definitions but b)v) asks for a journal entry, or a diagram-reading question). Do not silently skip a sub-part just because it looks different or harder to classify.
- Before finalizing your answer, re-count the lettered/numbered sub-parts you found for each question against how many appear in the source text (look for the highest letter/numeral used, e.g. if you see "a), b), c), d), e)" there must be 5 sub-parts) and add back any that are missing.

CRITICAL - QUESTIONS THAT MIX THEORY PARTS WITH A REQUIRED FINANCIAL STATEMENT PART:
- A single printed question (e.g. "QUESTION ONE") sometimes has several lettered parts a), b), c) where most parts are ordinary theory/short-answer/journal-entry sub-parts, but one part (often the last, largest part) requires preparing a full financial statement (a financial-spreadsheet). Because a sub-question CANNOT itself contain a spreadsheet grid, split this into: (1) ONE question combining all the ordinary parts into a single flat subQuestions array using compound labels ("a) i)", "a) ii)", "b) i)"..."b) v)", etc, as shown above) and (2) a SEPARATE financial-spreadsheet question for the part requiring the financial statement, with its trial balance/given data in "passage" per the rules below.
- When you must split ONE printed question this way, give each resulting system question a UNIQUE, sequential questionNumber within the section (do not reuse the same printed number for more than one question object) and start the financial-spreadsheet question's "text" by naming which printed question/part it continues, e.g. "(Question One, part (c)) Prepare: (i) Income statement... (ii) Balance sheet..." so a reader can see they belong together.
- NEVER set a subQuestion's "type" to "financial-spreadsheet" - a subQuestion object has no spreadsheetTemplate/spreadsheetModelAnswer fields, so any spreadsheet data placed there is silently lost. "financial-spreadsheet" is ONLY a valid value for a top-level question's "type".

CRITICAL - FINANCIAL-SPREADSHEET QUESTIONS (accounting/finance exams: income statements, balance sheets/statements of financial position, cash flow statements, statements of changes in equity, ledgers, trial balances the student must draft, bank reconciliation statements, cash books, ratio analysis, budgets):
- When a question instructs the student to PREPARE, DRAFT, or PRODUCE one of these financial statements/schedules, set "type": "financial-spreadsheet" (this applies even if the question is phrased as one of several lettered required outputs, e.g. "(i) Income statement ... (ii) Balance sheet ...")
- Include "spreadsheetTemplate" and "spreadsheetModelAnswer" as JSON strings of shape {"tables":[{"title":"...","headers":[...],"data":[[...]]}]} - one entry in "tables" per statement/schedule the question asks the student to prepare. If ONE question asks for multiple statements (e.g. "(i) Income statement (17 marks) (ii) Balance sheet (13 marks)"), put ONE table per statement in the SAME tables array rather than creating separate questions - the combined points equal the sum of both parts' marks
- "spreadsheetTemplate": pre-fill row labels (account/line-item names) with blank ("") value cells for the student to complete; formulas like "=SUM(B2:B5)" are allowed for subtotal rows
- "spreadsheetModelAnswer": the same table structure with every cell computed and filled in - work through the trial balance, the adjustments/notes, and standard accounting rules (accruals, prepayments, depreciation, allowance for doubtful debts, closing inventory at lower of cost and net realizable value, etc.) to compute the correct figures, exactly as a real marking scheme would. Show the final figures only (not the workings) in the model answer table.
- Example - trial balance style question:
{
  "questionNumber": 1,
  "text": "Prepare: (i) Income statement for the year ended 30 September 2012 (17 marks); (ii) Balance sheet as at 30 September 2012 (13 marks)",
  "type": "financial-spreadsheet",
  "passage": "Trial balance as at 30 September 2012:\\n| Account | Frw (Dr) | Frw (Cr) |\\n|---|---|---|\\n| Sales | | 5,400,000 |\\n| Purchases | 2,826,000 | |\\n| Capital | | 3,060,000 |\\n\\nAdditional notes:\\n1. The closing inventory cost and net realizable amount was Frw 910,000 and Frw 890,000 respectively.\\n2. Bank interest income accrued Frw 80,000 was only shown in the bank statement.",
  "points": 30,
  "spreadsheetTemplate": "{\\"tables\\":[{\\"title\\":\\"Income Statement\\",\\"headers\\":[\\"Item\\",\\"Frw\\"],\\"data\\":[[\\"Sales\\",\\"\\"],[\\"Cost of Sales\\",\\"\\"],[\\"Gross Profit\\",\\"\\"],[\\"Net Profit\\",\\"\\"]]},{\\"title\\":\\"Balance Sheet\\",\\"headers\\":[\\"Item\\",\\"Frw\\"],\\"data\\":[[\\"Total Assets\\",\\"\\"],[\\"Total Liabilities and Capital\\",\\"\\"]]}]}",
  "spreadsheetModelAnswer": "{\\"tables\\":[{\\"title\\":\\"Income Statement\\",\\"headers\\":[\\"Item\\",\\"Frw\\"],\\"data\\":[[\\"Sales\\",\\"5,400,000\\"],[\\"Cost of Sales\\",\\"2,762,000\\"],[\\"Gross Profit\\",\\"2,638,000\\"],[\\"Net Profit\\",\\"1,222,000\\"]]},{\\"title\\":\\"Balance Sheet\\",\\"headers\\":[\\"Item\\",\\"Frw\\"],\\"data\\":[[\\"Total Assets\\",\\"3,480,000\\"],[\\"Total Liabilities and Capital\\",\\"3,480,000\\"]]}]}",
  "correctAnswer": "See spreadsheetModelAnswer for the completed Income Statement and Balance Sheet."
}
- Give every table a clear "title" naming the statement (e.g. "Income Statement", "Statement of Financial Position", "Bank Reconciliation Statement", "Adjusted Cash Book")
- Only add more than one entry to "tables" when the question text explicitly asks for more than one statement in that same question

SUBQUESTION EXTRACTION RULES:
1. ALWAYS extract multi-part questions as ONE question with subQuestions array
2. Include the "label" field for each subquestion (a, b, c, i, ii, iii)
3. The main question text should be the common stem/scenario
4. Each subquestion has its own text, correctAnswer, and points
5. Total points = sum of all subquestion points
6. NEVER split a multi-part question into separate question entries
7. DISTINGUISH REGULAR MCQ vs SUB-QUESTION MCQ:
   - REGULAR MCQ: Single question with options A, B, C, D → type: "multiple-choice", NO subQuestions array
   - SUB-QUESTION MCQ: Part of a multi-part question with options labeled i, ii, iii, iv, v or a, b, c, d INSIDE a subQuestions array
   - CRITICAL: Do NOT put regular MCQ options in a subQuestions array
   - Example regular MCQ: "What is 2+2? A) 3 B) 4 C) 5 D) 6" → type: "multiple-choice", options: [{letter:"A", text:"3"}...]
   - Example sub-question MCQ: "Question 12: Choose the best option... a) ... i) No matter ii) As much as..." → This has subQuestions with MCQ type

8. For MULTIPLE-CHOICE subquestions:
   - ONLY when the question is already a multi-part question with labeled sections a), b), c)
   - Extract sub-question options with letters (i, ii, iii, iv, v for sub-options)
   - Mark the correct option with isCorrect: true
   - Include options array with {letter, text, isCorrect} structure INSIDE the subQuestion object
   - Each subquestion can be different types: open-ended, multiple-choice, true-false, fill-in-blank
   - Each subquestion is independent - students answer each one separately
10. DETECT "CHOOSE N" QUESTIONS:
   - Look for phrases like: "Choose ONE", "Select ONE", "Answer ONE", "Answer any ONE", "Pick ONE"
   - Also detect: "Choose TWO", "Select any 3", "Answer any TWO of the following"
   - Extract the number from phrases like "Choose [NUMBER]" or "Select any [NUMBER]"
   - Set "subQuestionConfig": { "mode": "choose-n", "requiredCount": N, "scoringType": "partial" } on the main question
   - The student will select N sub-questions to answer, each graded independently
   - Example: "Question 15: Choose ONE of the following (10 marks) a)... b)... c)" → requiredCount: 1
   - Example: "Question 16: Answer any TWO questions (5 marks each) a)... b)... c)... d)" → requiredCount: 2
   - Each sub-question earns its own marks - no requirement to get all correct
11. SUBQUESTION CONFIGURATION:
   - Always include "subQuestionConfig" for multi-part questions
   - "mode": "all" (answer all, default) or "choose-n" (select N to answer)
   - "requiredCount": number to select when mode is "choose-n"
   - "scoringType": "partial" (independent grading, default) or "all-or-nothing" (strict)

Return valid JSON with this exact structure:
{
  "instructions": "Extract general instructions if present",
  "answerKey": {
    "1": "Answer for question 1",
    "2": "Answer for question 2"
  },
  "allowSelectiveAnswering": false,
  "sectionBRequiredQuestions": 3,
  "sectionCRequiredQuestions": 1,
  "sections": [
    {
      "name": "A",
      "description": "Multiple Choice, True/False, and Fill-in-the-Blank Questions",
      "questions": [
        {
          "questionNumber": 1,
          "text": "Exact question text from document",
          "type": "multiple-choice",
          "passage": "Extract reading passage, comprehension text, diagram description, given data table, or any other supporting context this question is based on - this is the ONLY field for such content, there is no separate 'context' field",
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
          "passage": "Extract reading passage, comprehension text, diagram description, given data table, or any other supporting context this question is based on - this is the ONLY field for such content, there is no separate 'context' field",
          "correctAnswer": "Extract from document OR generate comprehensive model answer if not provided",
          "points": 5
        },
        {
          "questionNumber": 2,
          "text": "Choose any TWO of the following questions:",
          "type": "open-ended",
          "points": 10,
          "subQuestionConfig": { "mode": "choose-n", "requiredCount": 2, "scoringType": "partial" },
          "subQuestions": [
            {
              "label": "a)",
              "text": "First sub-question text",
              "type": "short-answer",
              "points": 5,
              "correctAnswer": "Answer for a)"
            },
            {
              "label": "b)",
              "text": "Second sub-question text",
              "type": "short-answer",
              "points": 5,
              "correctAnswer": "Answer for b)"
            },
            {
              "label": "c)",
              "text": "Third sub-question text",
              "type": "short-answer",
              "points": 5,
              "correctAnswer": "Answer for c)"
            }
          ],
          "correctAnswer": "Student answers any 2 of the 3 sub-questions"
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
          "passage": "Extract reading passage, comprehension text, diagram description, given data table, or any other supporting context this question is based on - this is the ONLY field for such content, there is no separate 'context' field",
          "correctAnswer": "Extract from document OR generate comprehensive model answer if not provided",
          "points": 15
        }
      ]
    }
  ]
}

Question types: multiple-choice, true-false, fill-in-blank, open-ended, matching, ordering, financial-spreadsheet.

IMPORTANT INSTRUCTIONS:
- For fill-in-blank questions: Look for word banks in the document (usually shown as a box of words at the top of the question or section). Extract ALL words from the word bank into the "wordBank" array.
- Word banks are typically displayed as: [word1, word2, word3, ...] or as a box with multiple words separated by spaces or commas.
- If a section has a word bank that applies to multiple questions, include it in the section-level wordBank and also in each individual fill-in-blank question.
- For sub-questions: If a question has multiple parts (a, b, c, etc.), structure them as subQuestions with individual correct answers.

Document text:
${fullText}`;

    console.log('Sending enhanced extraction prompt to Groq AI...');

    // Generate content with Groq AI using JSON mode
    // Use larger maxTokens to handle documents with many questions
    const result = await groqClient.generateContent(prompt, {
      model: 'smart',
      jsonMode: true,
      temperature: 0.1, // Lower temperature for more accurate extraction
      maxTokens: 16384, // NOTE: pushing this to 32768 was tested and caused Groq to truncate EARLIER (likely exceeding the model's real per-request completion cap on this account/tier) - 16384 is the empirically safe ceiling. groqClient logs a "TRUNCATED" warning if a response still hits this limit.
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

    // Attach any diagram images pdf_extractor.py rendered (e.g. "the diagram below shows...")
    // to whichever question actually references that diagram, uploading to Cloudinary.
    if (images && images.length > 0) {
      await attachDiagramImages(enhancedData.sections, images);
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

    // Extract and store metadata if present
    if (extractedData.metadata) {
      console.log('Document metadata extracted:', extractedData.metadata);
    }

    // Extract and store answer key if present
    if (extractedData.answerKey) {
      console.log(`Answer key extracted with ${Object.keys(extractedData.answerKey).length} answers`);
      // Merge with pre-loaded answer data
      if (answerData && answerData.answers) {
        Object.assign(answerData.answers, extractedData.answerKey);
      }
    }

    // Sanitize selective-answering fields (student chooses N of M whole questions in a section)
    extractedData.allowSelectiveAnswering = extractedData.allowSelectiveAnswering === true;
    if (extractedData.allowSelectiveAnswering) {
      const sectionBCount = parseInt(extractedData.sectionBRequiredQuestions, 10);
      const sectionCCount = parseInt(extractedData.sectionCRequiredQuestions, 10);
      extractedData.sectionBRequiredQuestions = Number.isFinite(sectionBCount) && sectionBCount > 0 ? sectionBCount : 3;
      extractedData.sectionCRequiredQuestions = Number.isFinite(sectionCCount) && sectionCCount > 0 ? sectionCCount : 1;
      console.log(`Selective answering detected: Section B requires ${extractedData.sectionBRequiredQuestions}, Section C requires ${extractedData.sectionCRequiredQuestions}`);
    } else {
      delete extractedData.sectionBRequiredQuestions;
      delete extractedData.sectionCRequiredQuestions;
    }

    // Ensure sections exist
    if (!extractedData.sections || !Array.isArray(extractedData.sections)) {
      extractedData.sections = [
        { name: 'A', description: 'Multiple Choice, True/False, and Fill-in-the-Blank Questions', questions: [] },
        { name: 'B', description: 'Short Answer Questions', questions: [] },
        { name: 'C', description: 'Essay Questions', questions: [] }
      ];
    }

    // Validate and fix section names
    const validSectionNames = ['A', 'B', 'C', 'D', 'E', 'F'];
    let sectionIndex = 0;
    for (const section of extractedData.sections) {
      // If section name is empty or invalid, assign a default name
      if (!section.name || section.name.trim() === '') {
        console.warn(`Section has empty name, assigning default name: ${validSectionNames[sectionIndex] || 'A'}`);
        section.name = validSectionNames[sectionIndex] || 'A';
      }
      // Ensure description exists
      if (!section.description) {
        section.description = `Section ${section.name}`;
      }
      sectionIndex++;
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

    // SAFEGUARD: the Question schema only supports spreadsheetTemplate/spreadsheetModelAnswer
    // at the top-level question, not inside a subQuestion - so if the AI (despite the prompt
    // instructions) nested a "financial-spreadsheet" typed part inside a multi-part question's
    // subQuestions array, that data would be structurally unrenderable and silently lost. Hoist
    // any such subQuestion out into its own proper top-level financial-spreadsheet question.
    for (const section of extractedData.sections) {
      if (!Array.isArray(section.questions)) continue;
      const hoisted = [];
      // If the AI ALSO produced a clean standalone financial-spreadsheet question for the same
      // original question number (a common alternate way it satisfies the "never nest a
      // spreadsheet in a subQuestion" rule), hoisting the subQuestion too would create a
      // duplicate covering the same statement twice - skip hoisting in that case.
      const questionNumbersWithOwnSpreadsheet = new Set(
        section.questions.filter(q => q.type === 'financial-spreadsheet').map(q => q.questionNumber)
      );
      for (const question of section.questions) {
        if (!Array.isArray(question.subQuestions) || question.subQuestions.length === 0) continue;
        const spreadsheetSubs = question.subQuestions.filter(sq => sq && sq.type === 'financial-spreadsheet');
        if (spreadsheetSubs.length === 0) continue;

        question.subQuestions = question.subQuestions.filter(sq => !(sq && sq.type === 'financial-spreadsheet'));

        if (questionNumbersWithOwnSpreadsheet.has(question.questionNumber)) {
          console.log(`Dropped ${spreadsheetSubs.length} redundant financial-spreadsheet subquestion(s) from question ${question.questionNumber} - a standalone financial-spreadsheet question for the same question number already covers it`);
        } else {
          for (const sq of spreadsheetSubs) {
            hoisted.push({
              questionNumber: question.questionNumber,
              text: `(continued from Question ${question.questionNumber}${sq.label ? ', part ' + sq.label : ''}) ${sq.text || question.text}`,
              type: 'financial-spreadsheet',
              passage: question.passage || question.context || '',
              points: sq.points || 10,
              spreadsheetTemplate: sq.spreadsheetTemplate || null,
              spreadsheetModelAnswer: sq.spreadsheetModelAnswer || null,
              correctAnswer: sq.correctAnswer || 'See spreadsheetModelAnswer for the completed statement.'
            });
          }
          console.log(`Hoisted ${spreadsheetSubs.length} financial-spreadsheet subquestion(s) out of question ${question.questionNumber} into standalone questions`);
        }

        // Recompute the parent question's points from its remaining subQuestions so the
        // original per-part marks (e.g. the theory parts) are preserved without the hoisted/
        // dropped financial-spreadsheet marks double-counted.
        if (question.subQuestions.length > 0) {
          question.points = question.subQuestions.reduce((sum, sq) => sum + (sq.points || 1), 0);
        }
      }
      if (hoisted.length > 0) {
        section.questions.push(...hoisted);
      }
    }

    // Any hoisted (or AI-produced) financial-spreadsheet question missing its grid needs one
    // generated so it doesn't render as an empty/blank spreadsheet for the student.
    for (const section of extractedData.sections) {
      if (!Array.isArray(section.questions)) continue;
      for (const question of section.questions) {
        if (question.type === 'financial-spreadsheet' && (!question.spreadsheetTemplate || !question.spreadsheetModelAnswer)) {
          await ensureSpreadsheetGrid(question);
        }
      }
    }

    // Despite the prompt instructing otherwise, the AI sometimes leaves the literal source
    // "[TABLE]"/"[/TABLE]" marker text in place around an otherwise fully and correctly
    // reproduced table (the row data itself is intact - only the marker tags leak through).
    // Strip them deterministically rather than relying purely on prompt-following.
    for (const section of extractedData.sections) {
      if (!Array.isArray(section.questions)) continue;
      for (const question of section.questions) {
        for (const field of ['passage', 'text']) {
          if (typeof question[field] === 'string' && question[field].includes('[TABLE]')) {
            question[field] = question[field].replace(/\[\/?TABLE\]\s*/g, '').trim();
          }
        }
      }
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
        // Coerce to a string here: the AI's JSON occasionally returns correctAnswer as an object
        // or array instead of text, and every downstream check below assumes a string (.trim()).
        question.correctAnswer = question.correctAnswer && typeof question.correctAnswer !== 'string'
          ? JSON.stringify(question.correctAnswer)
          : (question.correctAnswer || 'Not provided');

        // Ensure question number is set
        if (!question.questionNumber) {
          question.questionNumber = i + 1;
        }

        // Enhance based on question type
        await enhanceQuestionByType(question, answerData);

        // Use pre-loaded answers if available
        const questionNumber = question.questionNumber || (i + 1).toString();
        if (answerData.answers && answerData.answers[questionNumber]) {
          const preloadedAnswer = answerData.answers[questionNumber];
          question.correctAnswer = typeof preloadedAnswer === 'string' ? preloadedAnswer : JSON.stringify(preloadedAnswer);
          console.log(`Using pre-loaded answer for question ${questionNumber}: ${question.correctAnswer}`);
          
          // Log if subQuestions already exist from AI
          if (question.subQuestions && question.subQuestions.length > 0) {
            console.log(`Question ${questionNumber}: AI already provided ${question.subQuestions.length} subquestions, skipping parsing`);
          }
          
          // For matching questions, parse matching pairs from the correctAnswer string
          if (question.type === 'matching' && !question.matchingPairs && !question.leftItems && !question.rightItems) {
            const parsedPairs = parseMatchingPairsFromAnswer(question.correctAnswer);
            if (parsedPairs) {
              question.matchingPairs = parsedPairs;
              console.log(`Parsed matching pairs from correctAnswer for question ${questionNumber}`);
            }
          }
          
          // For questions without subQuestions, try to parse from correctAnswer string format
          if (!question.subQuestions || question.subQuestions.length === 0) {
            console.log(`Question ${questionNumber}: Attempting to parse subquestions from correctAnswer:`, question.correctAnswer);
            const parsedSubQuestions = parseSubquestionsFromString(question.correctAnswer, question.text);
            if (parsedSubQuestions && parsedSubQuestions.length >= 2) {
              question.subQuestions = parsedSubQuestions;
              // Update main question points to match sum of subquestion points
              const totalSubPoints = parsedSubQuestions.reduce((sum, sq) => sum + (sq.points || 1), 0);
              question.points = totalSubPoints;
              
              // Determine main question type based on subquestion types
              const typeCounts = {};
              parsedSubQuestions.forEach(sq => {
                typeCounts[sq.type] = (typeCounts[sq.type] || 0) + 1;
              });
              
              // If all subquestions are the same type, set main question to that type
              const uniqueTypes = Object.keys(typeCounts);
              if (uniqueTypes.length === 1) {
                question.type = uniqueTypes[0];
              }
              
              console.log(`Parsed ${parsedSubQuestions.length} subquestions from correctAnswer for question ${questionNumber}`);
            } else {
              console.log(`Question ${questionNumber}: Failed to parse subquestions, parsedSubQuestions:`, parsedSubQuestions);
            }
          }
        }

        // Handle subQuestions - generate model answers for each subquestion if missing
        if (question.subQuestions && Array.isArray(question.subQuestions) && question.subQuestions.length > 0) {
          console.log(`Processing ${question.subQuestions.length} subquestions for question ${questionNumber}`);

          let totalSubPoints = 0;
          for (let j = 0; j < question.subQuestions.length; j++) {
            const subQ = question.subQuestions[j];

            // Ensure subquestion has required fields
            subQ.type = subQ.type || 'open-ended';
            subQ.points = subQ.points || Math.ceil(question.points / question.subQuestions.length);
            subQ.label = subQ.label || String.fromCharCode(97 + j); // a, b, c, etc.
            if (subQ.correctAnswer && typeof subQ.correctAnswer !== 'string') {
              subQ.correctAnswer = JSON.stringify(subQ.correctAnswer);
            }

            // Generate model answer for subquestion if not provided
            if (!subQ.correctAnswer || subQ.correctAnswer === 'Not provided' || subQ.correctAnswer.trim() === '') {
              console.log(`Generating model answer for subquestion ${questionNumber}.${subQ.label}`);
              // For individual subquestion generation, we'll use the main generateModelAnswer
              // but we should enhance this to handle subquestions better
              subQ.correctAnswer = await generateModelAnswer(
                `${question.text}\n${subQ.text}`,
                subQ.type,
                section.name
              );
            }

            totalSubPoints += subQ.points;
          }

          // Update main question points to match sum of subquestion points
          question.points = totalSubPoints;
          console.log(`Updated question ${questionNumber} points to ${totalSubPoints} (sum of subquestions)`);

          // Generate combined model answer for the whole question if main correctAnswer is empty
          if (!question.correctAnswer || question.correctAnswer === 'Not provided' || question.correctAnswer.trim() === '') {
            console.log(`Generating combined model answer for question ${questionNumber} with ${question.subQuestions.length} subquestions`);
            question.correctAnswer = await generateModelAnswer(question.text, question.type, section.name, question.subQuestions);
          }
        }

        // Generate model answer using AI if not provided (for open-ended questions without subQuestions)
        if ((question.correctAnswer === 'Not provided' || !question.correctAnswer || question.correctAnswer.trim() === '') &&
            (question.type === 'open-ended' || question.type === 'short-answer' || question.type === 'essay') &&
            (!question.subQuestions || question.subQuestions.length === 0)) {
          console.log(`Generating AI model answer for question ${questionNumber} in section ${section.name}`);
          question.correctAnswer = await generateModelAnswer(question.text, question.type, section.name);
        }

        // Post-processing for fill-in-blank questions to infer missing numbers
        if (question.type === 'fill-in-blank' || (question.text && question.text.includes('_____'))) {
          question.correctAnswer = enhanceFillInBlankAnswer(question.text, question.correctAnswer);
        }

        // Auto-detect matching questions from answer format
        // If the correctAnswer contains multiple pairs with separators, convert to matching type.
        // Skip entirely once the question already has real subQuestions: a proper multi-part
        // question's AI-generated "combined" summary answer (see generateModelAnswer above)
        // naturally contains patterns like "a) ... b) ... c) ..." that this pair-detector
        // mistakes for "Term - Definition" matching pairs, incorrectly relabeling an already-
        // correctly-structured open-ended question as "matching" (confirmed live: every
        // multi-part question in a real exam got flipped to matching this way).
        if (question.correctAnswer && typeof question.correctAnswer === 'string' &&
            !question.matchingPairs && !question.leftItems && !question.rightItems &&
            question.type !== 'matching' &&
            (!question.subQuestions || question.subQuestions.length === 0)) {
          const parsedPairs = parseMatchingPairsFromAnswer(question.correctAnswer);
          if (parsedPairs && parsedPairs.leftColumn.length >= 2) {
            console.log(`Auto-detected matching question from answer format for question ${questionNumber}`);
            question.type = 'matching';
            question.matchingPairs = parsedPairs;
          }
        }

        // Auto-detect subquestions from answer format
        // If the correctAnswer contains multiple labeled answers (a) Answer, b) Answer, etc.), parse as subquestions
        if (question.correctAnswer && typeof question.correctAnswer === 'string' && 
            (!question.subQuestions || question.subQuestions.length === 0)) {
          const parsedSubQuestions = parseSubquestionsFromString(question.correctAnswer, question.text);
          if (parsedSubQuestions && parsedSubQuestions.length >= 2) {
            console.log(`Auto-detected subquestions from answer format for question ${questionNumber}`);
            question.subQuestions = parsedSubQuestions;
            // Update main question points to match sum of subquestion points
            const totalSubPoints = parsedSubQuestions.reduce((sum, sq) => sum + (sq.points || 1), 0);
            question.points = totalSubPoints;
            
            // Determine main question type based on subquestion types
            const typeCounts = {};
            parsedSubQuestions.forEach(sq => {
              typeCounts[sq.type] = (typeCounts[sq.type] || 0) + 1;
            });
            
            // If all subquestions are the same type, set main question to that type
            // Otherwise, keep as open-ended (mixed types)
            const uniqueTypes = Object.keys(typeCounts);
            if (uniqueTypes.length === 1) {
              question.type = uniqueTypes[0];
              console.log(`Set main question type to ${question.type} (all subquestions are same type)`);
            } else {
              question.type = 'open-ended';
              console.log(`Set main question type to open-ended (mixed subquestion types: ${uniqueTypes.join(', ')})`);
            }
          }
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

        // FINAL SAFEGUARD: Ensure correctAnswer is ALWAYS a string
        if (typeof question.correctAnswer !== 'string') {
          console.warn(`correctAnswer is not a string for question ${questionNumber}, converting...`);

          if (question.correctAnswer && typeof question.correctAnswer === 'object') {
            // If it has subQuestions, format them nicely
            if (question.subQuestions && Array.isArray(question.subQuestions) && question.subQuestions.length > 0) {
              question.correctAnswer = question.subQuestions.map(sq => {
                const label = sq.label || '';
                const text = sq.correctAnswer || sq.text || '';
                return label ? `${label}) ${text}` : text;
              }).join('\n');
            } else {
              // Check if keys are letters (a, b, c)
              const keys = Object.keys(question.correctAnswer);
              const hasLetterKeys = keys.some(k => /^[a-z]$/i.test(k));

              if (hasLetterKeys) {
                question.correctAnswer = keys.map(key => {
                  const val = question.correctAnswer[key];
                  if (typeof val === 'string') {
                    return `${key}) ${val}`;
                  }
                  return `${key}) ${JSON.stringify(val)}`;
                }).join('\n');
              } else {
                try {
                  question.correctAnswer = JSON.stringify(question.correctAnswer);
                } catch (e) {
                  question.correctAnswer = 'See question details';
                }
              }
            }
          } else if (question.correctAnswer === null || question.correctAnswer === undefined) {
            question.correctAnswer = 'Not provided';
          } else {
            question.correctAnswer = String(question.correctAnswer);
          }

          console.log(`Converted correctAnswer to string for question ${questionNumber}: ${question.correctAnswer.substring(0, 100)}...`);
        }
      }
    }

    // Safety correction: structural restructuring earlier in this pipeline (e.g. splitting one
    // printed question into two top-level questions because it contained two separate diagrams,
    // or because it mixed theory parts with a financial-spreadgsheet part) can change how many
    // top-level questions end up in section B/C versus how many the original document printed.
    // If that section's own instructions say it is COMPULSORY (not a genuine choice), the
    // required-count must never end up less than however many questions actually landed there -
    // otherwise a student could be wrongly allowed to skip one of them via selective answering.
    if (extractedData.allowSelectiveAnswering) {
      const sectionB = extractedData.sections.find(s => s.name === 'B');
      const sectionC = extractedData.sections.find(s => s.name === 'C');
      if (sectionB && /compulsory/i.test(sectionB.description || '')) {
        extractedData.sectionBRequiredQuestions = sectionB.questions.length;
      } else if (sectionB && sectionB.questions.length > 0) {
        // Can't require answering more questions than actually exist in the section
        extractedData.sectionBRequiredQuestions = Math.min(extractedData.sectionBRequiredQuestions, sectionB.questions.length);
      }
      if (sectionC && /compulsory/i.test(sectionC.description || '')) {
        extractedData.sectionCRequiredQuestions = sectionC.questions.length;
      } else if (sectionC && sectionC.questions.length > 0) {
        extractedData.sectionCRequiredQuestions = Math.min(extractedData.sectionCRequiredQuestions, sectionC.questions.length);
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
 * Generate a model answer for an open-ended question using AI
 * @param {string} questionText - The question text
 * @param {string} questionType - The type of question
 * @param {string} section - The section (A, B, C)
 * @returns {Promise<string>} - Generated model answer
 */
const generateModelAnswer = async (questionText, questionType, section, subQuestions = null) => {
  try {
    // If subQuestions are provided, generate answers for each subquestion
    if (subQuestions && Array.isArray(subQuestions) && subQuestions.length > 0) {
      const prompt = `You are an expert educator. Generate comprehensive and accurate model answers for these subquestions:

Main Question Context: "${questionText}"
Section: ${section}

Subquestions:
${subQuestions.map((sq, idx) => `${sq.label || String.fromCharCode(97 + idx)}) ${sq.text}`).join('\n')}

CRITICAL REQUIREMENTS:
- Provide detailed, accurate answers for EACH subquestion separately
- For mathematical questions: Show ALL working/steps clearly
- For conceptual questions: Provide clear explanations with key points
- Label each answer with the corresponding letter (a), b), c), etc.)
- Keep answers comprehensive but well-structured
- Do not include any meta-commentary

Format your answer as:
${subQuestions.map((sq, idx) => `${sq.label || String.fromCharCode(97 + idx) + ')'} [answer for this part]`).join('\n')}

Return only the model answers, no additional text.`;

      const result = await groqClient.generateContent(prompt, {
        model: 'smart',
        jsonMode: false,
        temperature: 0.2,
        maxTokens: 3072,
        systemPrompt: 'You are an expert educator who generates accurate, comprehensive model answers for exam questions.'
      });

      const answer = result.text.trim();
      console.log(`Generated model answers for ${subQuestions.length} subquestions: ${answer.substring(0, 100)}...`);
      return answer;
    }

    // Detect if question has subquestions
    const hasSubquestions = /[a-c]\)[.\s]/.test(questionText) || /[a-c]\.[.\s]/.test(questionText);

    const prompt = `You are an expert educator. Generate a comprehensive and accurate model answer for this OPEN-ENDED question:

Question: "${questionText}"
Type: ${questionType}
Section: ${section}
${hasSubquestions ? 'NOTE: This question has subquestions (a, b, c). Provide answers for each subquestion clearly labeled.' : ''}

CRITICAL REQUIREMENTS FOR OPEN-ENDED QUESTIONS:
- Provide a detailed, accurate answer appropriate for the academic level
- For mathematical questions: Show ALL working/steps clearly, then provide the final answer
- For conceptual questions: Provide clear explanations with key points and examples
- For calculation questions: Include the numerical answer with units where applicable
- For questions with subquestions: Answer each part (a, b, c) separately and clearly
- Keep the answer comprehensive but well-structured
- Do not include any meta-commentary about the answer - just provide the answer itself

${hasSubquestions ? 'Format your answer as:\na) [answer for part a]\nb) [answer for part b]\nc) [answer for part c]' : ''}

Return only the model answer, no additional text.`;

    const result = await groqClient.generateContent(prompt, {
      model: 'smart', // Use smart model for better quality on open questions
      jsonMode: false,
      temperature: 0.2, // Lower temperature for more accurate answers
      maxTokens: 3072, // More tokens for comprehensive open-ended answers
      systemPrompt: 'You are an expert educator who generates accurate, comprehensive model answers for open-ended exam questions. You excel at providing detailed explanations and showing work for mathematical problems.'
    });

    const answer = result.text.trim();
    console.log(`Generated model answer for open question: ${answer.substring(0, 100)}...`);
    return answer;
  } catch (error) {
    console.error('Error generating model answer for open question:', error);
    return 'Model answer generation failed - please provide manually';
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
        await ensureMCQCorrectOption(question);
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
        // Structure matching questions properly - only if not already structured
        // Preserve original structure if matchingPairs or leftItems/rightItems already exist
        if (!question.matchingPairs && !question.leftItems && !question.rightItems) {
          // First try to extract from question text
          question.matchingPairs = await extractMatchingPairs(question.text);
          
          // If no pairs found in question text, try parsing from correctAnswer
          if (!question.matchingPairs && question.correctAnswer && typeof question.correctAnswer === 'string') {
            question.matchingPairs = parseMatchingPairsFromAnswer(question.correctAnswer);
            if (question.matchingPairs) {
              console.log('Extracted matching pairs from correctAnswer string');
            }
          }
        }
        await ensureMatchingPairs(question);
        break;

      case 'ordering':
        // Structure ordering questions properly
        if (!question.itemsToOrder) {
          question.itemsToOrder = await extractOrderingItems(question.text);
        }
        break;

      case 'financial-spreadsheet':
        // The AI often returns spreadsheetTemplate/spreadsheetModelAnswer as nested objects,
        // a bare {headers,data} grid, or a flat label:value object instead of the canonical
        // {tables:[{title,headers,data}]} JSON string - normalize both fields so the grid
        // renders correctly and grading can compare cell-by-cell.
        if (question.spreadsheetTemplate) {
          question.spreadsheetTemplate = normalizeSpreadsheetField(question.spreadsheetTemplate);
        }
        if (question.spreadsheetModelAnswer) {
          question.spreadsheetModelAnswer = normalizeSpreadsheetField(question.spreadsheetModelAnswer);
        }
        break;
    }
  } catch (error) {
    console.error(`Error enhancing question type ${question.type}:`, error);
  }
};

/**
 * Generate a spreadsheetTemplate/spreadsheetModelAnswer for a financial-spreadsheet question
 * that doesn't already have one (e.g. hoisted out of a subQuestion where the AI didn't produce
 * the grid fields). Uses the question's own text/context (trial balance, adjustment notes) so
 * the generated table reflects the actual data the student was given.
 * @param {Object} question - financial-spreadsheet question, mutated in place
 */
const ensureSpreadsheetGrid = async (question) => {
  try {
    const prompt = `You are an accounting exam assistant. Build the spreadsheet grid for this exam question.

Question: "${question.text}"
Given data (trial balance, adjustments, etc.): "${(question.passage || question.context || '').substring(0, 6000)}"

Return ONLY JSON of this shape:
{
  "spreadsheetTemplate": {"tables":[{"title":"...","headers":["Item","Frw"],"data":[["Row label",""], ...]}]},
  "spreadsheetModelAnswer": {"tables":[{"title":"...","headers":["Item","Frw"],"data":[["Row label","computed value"], ...]}]}
}
- One table per financial statement/schedule the question asks for.
- spreadsheetTemplate: row labels filled in, value cells left as "".
- spreadsheetModelAnswer: same structure with every value cell computed from the given data using standard accounting rules.`;

    const result = await groqClient.generateContent(prompt, {
      model: 'smart',
      jsonMode: true,
      temperature: 0.1,
      maxTokens: 4096
    });

    const parsed = result.parsedContent || (result.text ? JSON.parse(result.text.match(/\{[\s\S]*\}/)?.[0] || '{}') : {});
    if (parsed.spreadsheetTemplate) {
      question.spreadsheetTemplate = normalizeSpreadsheetField(parsed.spreadsheetTemplate);
    }
    if (parsed.spreadsheetModelAnswer) {
      question.spreadsheetModelAnswer = normalizeSpreadsheetField(parsed.spreadsheetModelAnswer);
    }
  } catch (error) {
    console.error('Error generating spreadsheet grid for question:', error);
  }

  // Guarantee both fields are at least a valid, non-empty grid so the UI never renders blank
  if (!question.spreadsheetTemplate) {
    question.spreadsheetTemplate = JSON.stringify({ tables: [{ title: question.text?.substring(0, 60) || 'Statement', headers: ['Item', 'Frw'], data: [['', '']] }] });
  }
  if (!question.spreadsheetModelAnswer) {
    question.spreadsheetModelAnswer = question.spreadsheetTemplate;
  }
};

/**
 * Guarantee a multiple-choice question has exactly one option marked isCorrect, so grading
 * never has to guess at grade time. Tries matching question.correctAnswer (a letter, or the
 * option's own text) against the options first; only calls the AI if that fails outright.
 * @param {Object} question - multiple-choice question, mutated in place
 */
const ensureMCQCorrectOption = async (question) => {
  if (!Array.isArray(question.options) || question.options.length === 0) return;
  if (question.options.some(opt => opt.isCorrect)) return; // already has one

  const answer = (question.correctAnswer || '').toString().trim();
  const byLetter = question.options.find(opt => opt.letter && opt.letter.toUpperCase() === answer.toUpperCase());
  const byText = !byLetter && question.options.find(opt => opt.text && opt.text.toLowerCase() === answer.toLowerCase());
  const match = byLetter || byText;
  if (match) {
    match.isCorrect = true;
    return;
  }

  // No usable correctAnswer to match against - ask the AI to pick the correct option so the
  // question isn't silently left with no correct answer at all.
  try {
    const prompt = `For this multiple-choice question, identify the single correct option.
Question: "${question.text}"
Options: ${question.options.map(o => `${o.letter}) ${o.text}`).join(', ')}
Return ONLY JSON: {"correctLetter": "A"}`;
    const result = await groqClient.generateContent(prompt, { model: 'smart', jsonMode: true, temperature: 0.1, maxTokens: 256 });
    const letter = (result.parsedContent?.correctLetter || '').toString().trim().toUpperCase();
    const picked = question.options.find(opt => opt.letter && opt.letter.toUpperCase() === letter);
    if (picked) {
      picked.isCorrect = true;
      question.correctAnswer = picked.letter;
      return;
    }
  } catch (error) {
    console.error('Error determining correct MCQ option:', error);
  }

  // Last resort: mark the first option so the field is never left completely empty.
  question.options[0].isCorrect = true;
  question.correctAnswer = question.correctAnswer || question.options[0].letter;
};

/**
 * Guarantee a matching question has real matchingPairs to grade against. Only called after
 * the regex-based extractMatchingPairs/parseMatchingPairsFromAnswer attempts have both failed.
 * @param {Object} question - matching question, mutated in place
 */
const ensureMatchingPairs = async (question) => {
  if (question.matchingPairs || question.leftItems || question.rightItems) return;
  try {
    const prompt = `Extract the left/right matching pairs for this matching question.
Question: "${question.text}"
Answer/key (if present): "${question.correctAnswer || ''}"
Return ONLY JSON: {"leftColumn": ["...", "..."], "rightColumn": ["...", "..."], "correctPairs": [{"left": "...", "right": "..."}]}`;
    const result = await groqClient.generateContent(prompt, { model: 'smart', jsonMode: true, temperature: 0.1, maxTokens: 1024 });
    const parsed = result.parsedContent;
    if (parsed && Array.isArray(parsed.leftColumn) && Array.isArray(parsed.rightColumn) && parsed.leftColumn.length > 0) {
      question.matchingPairs = {
        leftColumn: parsed.leftColumn,
        rightColumn: parsed.rightColumn,
        correctPairs: Array.isArray(parsed.correctPairs) ? parsed.correctPairs : []
      };
    }
  } catch (error) {
    console.error('Error generating matching pairs:', error);
  }
};

// Same phrase set pdf_extractor.py uses to flag a page as diagram-bearing - reused here so a
// question whose OWN wording explicitly introduces the diagram is always preferred over one
// that merely happens to share vocabulary with the page (e.g. a short sub-question fully
// contained in that page's text, which would otherwise score a misleadingly "perfect" match).
const DIAGRAM_REFERENCE_PATTERN = /(diagram|figure\s*\d*|graph|chart|illustration)\s+(below|above|shown)|(shown|represented)\s+(below|above|in\s+the\s+diagram)|label\s+the\s+(parts?|structures?)|study\s+the\s+(diagram|figure)|the\s+following\s+(diagram|figure)/i;

/**
 * Score how much two texts overlap, using shared significant (4+ letter) words as a proxy
 * for "this diagram image came from the same page as this question". Normalized by the
 * LONGER side (not the shorter) so a short snippet fully contained in a long page of text
 * can't claim a misleading 1.0 "perfect" match against unrelated short questions.
 */
const scoreTextOverlap = (a, b) => {
  const tokenize = (s) => new Set((s || '').toLowerCase().match(/[a-z]{4,}/g) || []);
  const setA = tokenize(a);
  const setB = tokenize(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let shared = 0;
  for (const tok of setA) if (setB.has(tok)) shared++;
  return shared / Math.max(setA.size, setB.size);
};

/**
 * Attach diagram images extracted by pdf_extractor.py (one rendered page image per page that
 * referenced "the diagram below"/"figure N"/etc) to whichever question actually needs it.
 * Matching is by text overlap between the question's own wording and the source page's text
 * (the image's "snippet"), since the correct question's text is always a near-verbatim
 * substring of the page it came from. Scored as a bipartite matching (best pairs assigned
 * first) so two questions on the same page competing for one image don't starve each other.
 * Runs in two passes: top-level questions first (diagrams are introduced by the main question
 * stem, not a sub-part), falling back to subQuestions only for any image still unassigned.
 * @param {Array} sections - extractedData.sections, mutated in place
 * @param {Array} images - [{ page, snippet, dataUrl }] from pdf_extractor.py
 */
const attachDiagramImages = async (sections, images) => {
  try {
    const topLevel = [];
    const subLevel = [];
    for (const section of sections || []) {
      for (const question of section.questions || []) {
        if (!question.imageUrl) topLevel.push(question);
        if (Array.isArray(question.subQuestions)) {
          for (const sq of question.subQuestions) {
            if (!sq.imageUrl) subLevel.push(sq);
          }
        }
      }
    }

    const assignedImages = new Set();

    const runPass = async (candidates) => {
      if (candidates.length === 0) return;
      const pairs = [];
      candidates.forEach((question, qIdx) => {
        const questionText = `${question.text || ''} ${question.passage || ''}`;
        const referencesDigram = DIAGRAM_REFERENCE_PATTERN.test(questionText);
        images.forEach((img, iIdx) => {
          if (assignedImages.has(iIdx)) return;
          let score = scoreTextOverlap(questionText, img.snippet);
          if (referencesDigram) score += 0.5; // strong preference for the question that actually names the diagram
          if (score > 0.2) pairs.push({ qIdx, iIdx, score });
        });
      });
      pairs.sort((a, b) => b.score - a.score);

      const assignedQuestions = new Set();
      for (const pair of pairs) {
        if (assignedQuestions.has(pair.qIdx) || assignedImages.has(pair.iIdx)) continue;
        const question = candidates[pair.qIdx];
        const image = images[pair.iIdx];
        try {
          const uploadResult = await cloudinary.uploader.upload(image.dataUrl, {
            folder: 'eexams/question-diagrams',
            resource_type: 'image'
          });
          question.imageUrl = uploadResult.secure_url;
          assignedQuestions.add(pair.qIdx);
          assignedImages.add(pair.iIdx);
          console.log(`Attached diagram image (page ${image.page}, match score ${pair.score.toFixed(2)}) to question: "${(question.text || '').substring(0, 60)}..."`);
        } catch (uploadError) {
          console.error(`Failed to upload diagram image (page ${image.page}) to Cloudinary:`, uploadError.message || uploadError);
        }
      }
    };

    await runPass(topLevel);
    if (assignedImages.size < images.length) {
      await runPass(subLevel);
    }
  } catch (error) {
    console.error('Error attaching diagram images:', error);
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
      model: 'smart',
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
      model: 'smart',
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
      model: 'smart',
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
    if (!questionText || typeof questionText !== 'string') {
      return null;
    }
    
    // Try different separators: -, –, —, |, :, ->
    const separators = ['-', '–', '—', '|', ':', '->'];
    let bestMatch = null;
    let maxPairs = 0;

    for (const separator of separators) {
      const pattern = new RegExp(`([^\\n${separator}]+)\\s*${separator}\\s*([^\\n]+)`, 'g');
      const matches = [];
      let match;

      while ((match = pattern.exec(questionText)) !== null) {
        const left = match[1] ? match[1].trim() : '';
        const right = match[2] ? match[2].trim() : '';
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
 * Parse subquestions from correctAnswer string format (e.g., "a) False, b) True, c) True")
 * @param {string} correctAnswer - The correct answer string containing subquestion answers
 * @param {string} questionText - The main question text to extract subquestion text from
 * @returns {Array|null} - Array of subquestions or null
 */
const parseSubquestionsFromString = (correctAnswer, questionText = '') => {
  try {
    if (!correctAnswer || typeof correctAnswer !== 'string') {
      console.log('parseSubquestionsFromString: Invalid input', { correctAnswer, type: typeof correctAnswer });
      return null;
    }

    const text = correctAnswer.trim();
    console.log('parseSubquestionsFromString: Input text:', text);
    const subQuestions = [];

    // Split by common delimiters first, then parse each part
    // This handles: "a) False b) True c) True" and "a) False, b) True, c) True"
    // Only split on space when followed by a letter AND ) or . (to avoid splitting on words)
    const parts = text.split(/,\s*|\s+(?=[a-z][\)\.]\s)/);
    const matches = [];

    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;

      // Match pattern: a) Answer or a. Answer
      // The delimiter after the label is REQUIRED (not optional) - without this, plain prose
      // beginning with any letter (e.g. "The four causes..." or "and 4) Errors...") would
      // falsely match as a labeled subquestion ("t) he four causes...", "a) nd 4) Errors...").
      const match = trimmed.match(/^([a-z])[\)\.]\s*(.*)$/i);
      if (match) {
        const label = match[1].toLowerCase();
        const answer = match[2] ? match[2].trim() : '';
        
        console.log('parseSubquestionsFromString: Match found', { label, answer });
        
        if (answer.length > 0) {
          matches.push({
            label,
            subLabel: null,
            answer
          });
        }
      }
    }

    console.log('parseSubquestionsFromString: Total matches:', matches.length);
    if (matches.length < 2) {
      console.log('parseSubquestionsFromString: Not enough matches, returning null');
      return null; // Need at least 2 subquestions
    }

    // Try to extract subquestion text from the main question text
    const subquestionPatterns = questionText.match(/(?:^|\n)[\s]*[a-z][\)\.]?\s*([^.!?]*[.!?]?)/gi) || [];

    for (let i = 0; i < matches.length; i++) {
      const { label, subLabel, answer } = matches[i];
      
      // Try to get the corresponding subquestion text from the patterns
      let subText = '';
      if (subquestionPatterns[i]) {
        subText = subquestionPatterns[i].trim();
        // Remove the label prefix if present
        subText = subText.replace(/^[a-z][\)\.]?\s*/i, '');
      } else {
        // Fallback: use a generic label
        subText = `Subquestion ${label.toUpperCase()}`;
      }

      // Determine the type based on the answer format
      let subType = 'open-ended';
      let options = [];
      
      // Check for true/false
      if (answer.toLowerCase() === 'true' || answer.toLowerCase() === 'false') {
        subType = 'true-false';
      }
      // Check for multiple-choice (has roman numeral or letter option)
      else if (subLabel && /^[ivx]+$/.test(subLabel)) {
        subType = 'multiple-choice';
        // The answer is the option letter (i, ii, iii, iv, v)
        // We'll need to extract options from the question text or use a placeholder
        options = [
          { letter: 'i', text: 'Option i', isCorrect: subLabel === 'i' },
          { letter: 'ii', text: 'Option ii', isCorrect: subLabel === 'ii' },
          { letter: 'iii', text: 'Option iii', isCorrect: subLabel === 'iii' },
          { letter: 'iv', text: 'Option iv', isCorrect: subLabel === 'iv' },
          { letter: 'v', text: 'Option v', isCorrect: subLabel === 'v' }
        ];
      }
      // Check for single letter answers (A, B, C, D)
      else if (/^[a-d]$/i.test(answer)) {
        subType = 'multiple-choice';
        options = [
          { letter: 'A', text: 'Option A', isCorrect: answer.toUpperCase() === 'A' },
          { letter: 'B', text: 'Option B', isCorrect: answer.toUpperCase() === 'B' },
          { letter: 'C', text: 'Option C', isCorrect: answer.toUpperCase() === 'C' },
          { letter: 'D', text: 'Option D', isCorrect: answer.toUpperCase() === 'D' }
        ];
      }
      // Check for numeric answers
      else if (/^\d+$/.test(answer)) {
        subType = 'open-ended'; // Could be fill-in-blank or numeric
      }
      // Otherwise, treat as open-ended/short-answer
      else {
        subType = 'open-ended';
      }

      const subQuestion = {
        label: `${label})`,
        text: subText,
        type: subType,
        correctAnswer: answer,
        points: 1 // Default points per subquestion
      };

      // Add options if it's multiple-choice
      if (options.length > 0) {
        subQuestion.options = options;
      }

      subQuestions.push(subQuestion);
    }

    console.log(`Parsed ${subQuestions.length} subquestions from string format`);
    return subQuestions;
  } catch (error) {
    console.error('Error parsing subquestions from string:', error);
    return null;
  }
};

/**
 * Parse matching pairs from correctAnswer string format
 * @param {string} correctAnswer - The correct answer string containing matching pairs
 * @returns {Object|null} - Matching pairs structure or null
 */
const parseMatchingPairsFromAnswer = (correctAnswer) => {
  try {
    if (!correctAnswer || typeof correctAnswer !== 'string') {
      return null;
    }

    const text = correctAnswer.trim();
    const pairs = [];

    // Split by comma to get individual pairs
    const pairStrings = text.split(',').map(s => s.trim()).filter(s => s.length > 0);

    for (const pairStr of pairStrings) {
      // Try different separators: -, –, —, |, :, ->
      const separators = [' - ', ' – ', ' — ', ' | ', ' : ', ' -> ', '-', '–', '—', '|', ':', '->'];
      
      for (const separator of separators) {
        if (pairStr.includes(separator)) {
          const parts = pairStr.split(separator);
          if (parts.length === 2) {
            const left = parts[0].trim();
            const right = parts[1].trim();
            if (left.length > 1 && right.length > 1) {
              pairs.push({ left, right });
              break; // Use the first matching separator
            }
          }
        }
      }
    }

    if (pairs.length >= 2) {
      console.log(`Parsed ${pairs.length} matching pairs from correctAnswer`);
      return {
        leftColumn: pairs.map(p => p.left),
        rightColumn: pairs.map(p => p.right),
        correctPairs: pairs.map((_, index) => ({ left: index, right: index }))
      };
    }

    return null;
  } catch (error) {
    console.error('Error parsing matching pairs from answer:', error);
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
      model: 'smart',
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
      model: 'smart',
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

// ============================================================================
// CHUNKED EXAM EXTRACTION: asking one AI call to enumerate every question in a whole exam
// (extractQuestionsWithEnhancedAI above) has been observed to silently drop entire top-level
// questions from moderately long real exams (confirmed live: a 5-question, ~16k-character
// combined exam+marking-guide document came back with only 3 questions, two entire ones
// missing, well under the token cap - so it's the model losing track across a long/dense
// document, not truncation). The fix: mechanically split the source documents into one chunk
// per question FIRST (deterministic regex on "QUESTION ONE"/"QUESTION 2"-style headers, which
// can't itself "drop" anything the way a generative call can), pair each exam question chunk
// with its own matching marking-guide chunk, and run one small, focused extraction call per
// question IN PARALLEL. Each call only has to get ONE question right, which is a far easier and
// more reliable task than enumerating all of them in one shot.
// ============================================================================

const QUESTION_WORD_TO_NUM = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20
};

const questionLabelToNumber = (label) => {
  if (!label) return null;
  const trimmed = label.trim().toLowerCase();
  if (/^\d+$/.test(trimmed)) return parseInt(trimmed, 10);
  return QUESTION_WORD_TO_NUM[trimmed] || null;
};

// Finds "SECTION X" and "QUESTION <word-or-number>" header lines - each must be the ONLY thing
// on its line (anchored start-to-end) so an inline reference like "as shown in Question One
// above" mid-sentence is never mistaken for a real section/question boundary.
const findDocumentBoundaries = (text) => {
  const sectionRe = /^[ \t]*SECTION\s+([A-Z])[ \t]*:?[ \t]*$/gim;
  const questionRe = /^[ \t]*(?:QUESTION\s+([A-Za-z]+)|Q(?:UESTION)?\.?\s*(\d+))[ \t]*:?[ \t]*$/gim;
  const sections = [];
  let m;
  while ((m = sectionRe.exec(text)) !== null) {
    sections.push({ name: m[1].toUpperCase(), index: m.index });
  }
  const questions = [];
  while ((m = questionRe.exec(text)) !== null) {
    const num = m[2] ? parseInt(m[2], 10) : questionLabelToNumber(m[1]);
    if (num) questions.push({ number: num, index: m.index });
  }
  return { sections, questions };
};

// Splits a document into { headerText, chunks: [{number, section, text}] }, one chunk per
// detected question, each running from its own header to the next question's header (or end of
// document). Returns null if no question headers were found at all, so the caller can fall back
// to the existing whole-document extraction instead (e.g. an exam that doesn't use the
// "QUESTION ONE" convention this splitter looks for).
const splitIntoQuestionChunks = (text) => {
  const { sections, questions } = findDocumentBoundaries(text);
  if (questions.length === 0) return null;
  questions.sort((a, b) => a.index - b.index);
  sections.sort((a, b) => a.index - b.index);
  const chunksByNumber = new Map();
  const order = [];
  for (let i = 0; i < questions.length; i++) {
    const start = questions[i].index;
    const end = i + 1 < questions.length ? questions[i + 1].index : text.length;
    let sectionName = 'A';
    for (const s of sections) {
      if (s.index <= start) sectionName = s.name;
      else break;
    }
    const chunkText = text.slice(start, end).trim();
    if (chunksByNumber.has(questions[i].number)) {
      // Same question number seen twice (e.g. a continuation page) - append rather than drop.
      const existing = chunksByNumber.get(questions[i].number);
      existing.text += '\n\n' + chunkText;
    } else {
      const chunk = { number: questions[i].number, section: sectionName, text: chunkText };
      chunksByNumber.set(questions[i].number, chunk);
      order.push(questions[i].number);
    }
  }
  return {
    headerText: text.slice(0, questions[0].index).trim(),
    chunks: order.map(n => chunksByNumber.get(n))
  };
};

// Everything after this line, up to (but not including) the closing schema/"Document text:"
// portion of the whole-document prompt in extractQuestionsWithEnhancedAI above, applies just as
// well to extracting a single question - so the wording is intentionally kept identical to what
// has already been tested there (deliberately duplicated rather than shared, so nothing about
// the already-working whole-document path above is touched by adding this new path).
const SINGLE_QUESTION_EXTRACTION_RULES = `CRITICAL INSTRUCTIONS:
1. Preserve the exact wording of the question and its answer(s) as they appear
2. Include all options for multiple choice questions with their correct letter labels (A, B, C, D, etc.)
3. Identify and mark the correct answer for each multiple choice question
4. Extract the question number if present
5. Extract this question's type: multiple-choice, true-false, fill-in-blank, short answer, essay, matching, ordering, financial-spreadsheet (income statements, balance sheets, bank reconciliations, cash books, trial balances, ledgers the student must prepare)
6. EXTRACT THE MARKING GUIDE / MODEL ANSWER: this question's text may be followed by its own marking guide/model answer block (often headed "Marking guide" or "Model answers", or just appearing as worked calculations). Use it as the authoritative source for correctAnswer - do not invent an answer that contradicts it.
7. EXTRACT PASSAGES AND TABLES: Extract ALL reading passages, comprehension texts, diagrams, tables (trial balances, ledgers, lists of account balances shown inside [TABLE]...[/TABLE] markers or as aligned text), and any text blocks that serve as supporting context for this question. Store ALL of this in the question's "passage" field (there is no separate "context" field - "passage" is the only field that is saved and shown to the student), preserving every row/figure exactly.
8. EXTRACT INSTRUCTIONS: Extract any instructions or directions that accompany this specific question

CRITICAL - MODEL ANSWER GENERATION FOR OPEN-ENDED QUESTIONS:
- If this is an open-ended question (short answer, essay, open-ended) and a model answer is NOT provided in the marking guide portion, you MUST generate a comprehensive model answer
- Generated model answers should be accurate, detailed, and appropriate for the academic level
- For mathematical questions, show the working/steps and the final answer
- For conceptual questions, provide clear explanations with key points
- For calculation questions, include the numerical answer with units where applicable
- For questions with subquestions (a, b, c), generate answers for EACH subquestion
- DO NOT leave correctAnswer as "Not provided" or empty - always provide a meaningful answer
- NEVER skip generating an answer for an open-ended question

SPECIAL HANDLING FOR FILL-IN-THE-BLANK QUESTIONS:
- When you see patterns like "with ______ ______ sides", the blanks represent missing numbers or words
- Infer the missing information from context (e.g., "shape with ______ sides" → likely needs a number like "8" for octagon)
- Preserve the blank markers (_____) in the question text
- Include the inferred answer in the correctAnswer field
- For geometric shapes: triangle (3), square (4), pentagon (5), hexagon (6), heptagon (7), octagon (8), nonagon (9), decagon (10)
- For other contexts, use the surrounding text to infer the missing information

CRITICAL - DETECT MATCHING QUESTIONS:
- Look for questions where the answer contains pairs of items separated by "-" or similar separators (e.g., "Item A - Match 1, Item B - Match 2, Item C - Match 3")
- When you detect such patterns in the answer key, mark the question type as "matching"
- Preserve the FULL answer string in the correctAnswer field exactly as it appears
- DO NOT split the answer into separate fields - keep it as a single string in correctAnswer

CRITICAL - DETECT SUBQUESTIONS (INCLUDING TRUE/FALSE STATEMENTS):
- Look for this question having multiple labeled parts (e.g. a), b), c) or i), ii), iii))
- When you detect such patterns, use the "subQuestions" array to store each part
- Each subquestion MUST have: label, text, type, correctAnswer, and points
- Subquestions can have MIXED types within the same question (e.g., some true-false, some open-ended, some multiple-choice)
- For true/false subquestions: type "true-false" with correctAnswer "True" or "False"
- For multiple-choice subquestions: type "multiple-choice" with options array (letter/text/isCorrect) and correctAnswer as the option letter
- For open-ended or numeric subquestions: type "open-ended" with the answer text/number

CRITICAL - MULTI-PART QUESTIONS MUST BE A SINGLE QUESTION OBJECT:
- If this question has parts labeled a), b), c) or i), ii), iii), return ONE question object with a "subQuestions" array containing every part - never return multiple separate question objects for the same printed question
- ALWAYS include ALL parts (a, b, c, d, etc.) - before finalizing, re-count the lettered/numbered sub-parts you found against how many appear in the source text (e.g. if you see "a), b), c), d), e)" there must be 5 sub-parts) and add back any missing

CRITICAL - EXTRACT MARKS ALLOCATIONS EXACTLY:
- Exam papers show marks in parentheses after each question or part, e.g. "(2 marks)", "(17 marks)", "(Total: 40 marks)"
- Extract the marks shown for EACH part/sub-part into that part's "points" field exactly as printed - do not invent or round numbers
- When this question has sub-parts with their own marks, set each subQuestion's "points" to its own printed value, and set this question's own top-level "points" to the "(Total: X marks)" value if printed, otherwise to the sum of the sub-parts
- Do NOT split a single required output (e.g. "Income statement" worth 17 marks) into multiple sub-questions unless the source itself labels separate lettered/numbered parts

CRITICAL - DETECT "CHOOSE N" AMONG THIS QUESTION'S OWN SUB-PARTS (not among separate whole questions - that is handled elsewhere):
- Look for phrases like "Choose ONE", "Select ONE", "Answer any TWO of the following" applying to this question's own lettered parts
- Set "subQuestionConfig": { "mode": "choose-n", "requiredCount": N, "scoringType": "partial" } on this question if so; otherwise omit subQuestionConfig or use { "mode": "all" }

CRITICAL - HANDLING TABLES AND FINANCIAL DATA (e.g. trial balances, ledger balances, account lists):
- The text may contain blocks wrapped as [TABLE] ... [/TABLE] where each line is a row with cells separated by " | ". These represent tables detected in the original PDF. Tabular data may also appear as plain aligned text (columns of account names and figures) without explicit [TABLE] markers - treat that the same way.
- Reproduce this GIVEN data (data the student is handed, not data the student must produce) faithfully as a readable table in the question's "passage" field, using Markdown table syntax so every account name and figure survives exactly as printed.
- NEVER copy the literal characters "[TABLE]", "[/TABLE]", or an ellipsis ("...") into your output as a stand-in for a table - read every row between the markers and reproduce the real row data.
- Numbered adjustment notes that follow a trial balance belong in the same question's "passage" field, listed in full and in order, immediately after the table.

CRITICAL - QUESTIONS THAT MIX THEORY PARTS WITH A REQUIRED FINANCIAL STATEMENT PART:
- If this printed question has several lettered parts a), b), c) where most are ordinary theory/short-answer/journal-entry sub-parts but one part requires preparing a full financial statement, you cannot put a financial-spreadsheet inside a subQuestion (a subQuestion object has no spreadsheetTemplate/spreadsheetModelAnswer fields - any spreadsheet data placed there is silently lost). Instead return TWO question objects in your JSON array: one with type reflecting the ordinary theory sub-parts as a flat subQuestions array, and a SEPARATE object with "type": "financial-spreadsheet" for the part requiring the financial statement, with its own "text" naming which part it continues (e.g. "(continued from Question One, part (b)) Prepare: ...") and its own "questionNumber" (reuse the same number; the caller re-sequences).
- NEVER set a subQuestion's "type" to "financial-spreadsheet".

CRITICAL - FINANCIAL-SPREADSHEET QUESTIONS (accounting/finance exams: income statements, balance sheets/statements of financial position, cash flow statements, statements of changes in equity, ledgers, trial balances the student must draft, bank reconciliation statements, cash books, ratio analysis, budgets):
- When this question instructs the student to PREPARE, DRAFT, or PRODUCE one of these, set "type": "financial-spreadsheet"
- Include "spreadsheetTemplate" and "spreadsheetModelAnswer" as JSON strings of shape {"tables":[{"title":"...","headers":["Item","...","..."],"data":[["Row label","",""], ...]}]} (column count varies by statement type - see FORMAT BY DOCUMENT TYPE below - do not always use the same 2 columns) - one entry in "tables" per statement/schedule this question asks for
- Always return the FULL, complete table - EVERY line item the statement needs, in the correct order, never a partial/abbreviated version. A Statement of Financial Position with only 2-3 rows is almost certainly wrong - a real SOFP has one row per asset/liability/equity line item plus subtotals (typically 8-15+ rows). Never collapse multiple line items into one row, and never turn a section name (e.g. "Current Assets") into a column header - sections are ROW labels, not columns.
- "spreadsheetTemplate": row labels (and section headings) filled in, value cells left as ""
- "spreadsheetModelAnswer": same structure with every value cell correctly computed, using the marking guide's own figures if present (fall back to computing them yourself from the trial balance/adjustments using standard accounting rules if the marking guide doesn't spell out a needed intermediate figure)
- EVERY VALUE CELL MUST BE A PLAIN FINAL NUMBER, NEVER AN ARITHMETIC EXPRESSION: do the addition/subtraction yourself and write only the result (e.g. 225000, not "20000 + 280000 - 25000")
- ONE ROW PER LINE ITEM - never write the same line item twice
- COMPLETE EVERYTHING GIVEN: every account/line item present in the source must appear as its own row, using the same label/wording given (do not rename, merge, skip, or invent line items). Only add extra rows when the statement itself needs derived/computed lines (subtotals, totals).

ACCOUNTING KNOWLEDGE TO APPLY - get the classification, ordering and arithmetic right, not just the layout:

1) STATEMENT OF FINANCIAL POSITION (Balance Sheet) - line-item order matters, follow it exactly:
   ASSETS: Non-Current Assets first, in order of permanence -> "Total Non-Current Assets" -> Current Assets (Inventories, Receivables, Prepayments, Cash and Cash Equivalents - least liquid to most liquid) -> "Total Current Assets" -> "Total Assets".
   EQUITY & LIABILITIES: Equity first (Share Capital, Retained Earnings) -> "Total Equity" -> Non-Current Liabilities (long-term loans, debentures) -> "Total Non-Current Liabilities" -> Current Liabilities (Trade Payables, Accrued expenses, Tax payable) -> "Total Current Liabilities" -> "Total Equity and Liabilities". This final figure MUST equal Total Assets - if it doesn't, find and fix the error before returning.
   Only add a subtotal row when the section has more than one line item, or the source itself explicitly shows that subtotal row.

2) INCOME STATEMENT - top-to-bottom order, and exactly which column each figure belongs in (column 2 = workings/components being added up, column 3 = the running total - see FORMAT BY DOCUMENT TYPE below): Revenue -> Cost of Sales (components in column 2 if computed, final figure in column 3) -> "Gross Profit" -> Other Income -> Operating Expenses (every individual expense in column 2, one combined "Total Operating Expenses" in column 3) -> "Operating Profit" -> Finance costs -> "Profit Before Tax" -> Tax expense -> "Profit for the Year" (final total). Dividends are NOT an expense here.

3) STATEMENT OF CHANGES IN EQUITY - columns per equity component (Share Capital, Retained Earnings, Total), rows: Balance b/f -> Profit for the year (add) -> Dividends paid (deduct) -> other movements -> Balance c/f.

4) STATEMENT OF CASH FLOWS - three sections in order: Operating Activities (start from Profit Before Tax, add back non-cash items like Depreciation/Interest, adjust for working-capital movements) -> Investing Activities -> Financing Activities -> "Net Increase/(Decrease) in Cash" -> Cash at start -> "Cash at End" (must reconcile to Cash and Cash Equivalents in the SOFP).

5) COMMON ADJUSTMENTS - apply correctly and reflect the effect in BOTH statements they touch (P&L and SOFP): Depreciation (expense in P&L, reduces asset in SOFP); Accrued expense (full expense in P&L, Current Liability in SOFP); Prepaid expense (only this period's portion is an expense, rest is Current Asset); Irrecoverable debts (reduce Receivables, expense in P&L); Closing inventory (deduction in Cost of Sales AND Current Asset in SOFP); Tax expense (deducted in P&L, unpaid amount is Tax Payable in SOFP).

6) DOUBLE-ENTRY / DEBIT & CREDIT (Trial Balance, Ledgers, Journals only - NOT the four statements above): Assets and Expenses normally carry Debit balances; Liabilities, Equity and Income normally carry Credit balances. Preserve whichever side the source shows; never move a figure to the wrong side.

FORMAT BY DOCUMENT TYPE:
  * Statement of Financial Position, Income Statement, Statement of Changes in Equity, Statement of Cash Flows: headers like ["Item","FRW '000'","FRW '000'"] - column 1 is the item/section heading (section headers like "Non-Current Assets" get their own row with no figures), column 2 holds sub-amounts/workings for a line needing several components added together (leave "" when not needed), column 3 holds the figure that carries into the statement's running total. Do NOT use "Debit"/"Credit" headers for these, and do NOT turn section names into column headers.
  * Trial Balance: exactly headers ["Item","Debit","Credit"], one figure per row on the correct side only, Debit total must equal Credit total.
  * Ledger accounts / T-accounts: one table per account, headers ["Date","Particulars","Debit","Credit"], preserving exactly which side each entry is on as the source shows it; whichever side isn't used must be "" not 0.
  * Journal entries: headers ["Date","Particulars","Debit","Credit"], one row per account touched by each entry.
  * Anything else (schedule, workings, ratio computation): whichever layout is standard for that output; only use Debit/Credit columns when double-entry actually applies.

Before finalizing, recompute every subtotal independently and sanity-check: does the Statement of Financial Position balance (Total Assets = Total Equity and Liabilities)? Does the Trial Balance balance? Fix any mismatch rather than returning inconsistent numbers.

Return ONLY a JSON array containing one or more question objects for this single printed question (more than one only in the theory+financial-spreadsheet split case above), each with this shape:
{
  "questionNumber": <number>,
  "text": "...",
  "type": "multiple-choice|true-false|fill-in-blank|open-ended|matching|ordering|financial-spreadsheet",
  "passage": "... (only if there is supporting context/data)",
  "options": [{"letter":"A","text":"...","isCorrect":false}],
  "subQuestions": [{"label":"a)","text":"...","type":"open-ended","correctAnswer":"...","points":1}],
  "subQuestionConfig": {"mode":"all"},
  "correctAnswer": "...",
  "points": <number>,
  "spreadsheetTemplate": "...",
  "spreadsheetModelAnswer": "..."
}
Omit any field that doesn't apply (e.g. no "options" for a non-MCQ question, no subQuestions for a single-part question).`;

const buildSingleQuestionPrompt = (chunkText) =>
  `You are an expert exam document parser extracting ONE question (with its own marking guide/model answer, if present in the text below) from a larger exam.

${SINGLE_QUESTION_EXTRACTION_RULES}

Text for this one question (plus its own marking guide portion, if available):
${chunkText}`;

// Small, low-risk call over just the exam's cover/instructions text (everything before the
// first question) - short enough that the "AI drops content from a long document" problem this
// whole chunked path exists to avoid doesn't apply here.
const extractDocumentMetadata = async (headerText) => {
  const fallback = { instructions: '', allowSelectiveAnswering: false, sectionBRequiredQuestions: 3, sectionCRequiredQuestions: 1, sectionDescriptions: {} };
  if (!headerText || !headerText.trim()) return fallback;
  try {
    const prompt = `Extract exam-level metadata from this exam's cover page / instructions text.

CRITICAL - SELECTIVE ANSWERING (a section lets the student choose N of its M whole questions):
- Many exams have a section (almost always named/lettered "B") where the student answers only SOME of the whole questions offered - e.g. "Attempt THREE of the FOUR questions in this section", "Answer any THREE questions". This is about choosing among several WHOLE separate questions, not parts of one question.
- If detected for section B (or whichever section plays that role), set "allowSelectiveAnswering": true and "sectionBRequiredQuestions" to N.
- If a DIFFERENT section also offers a choice among whole questions, set "sectionCRequiredQuestions" to that N.
- If no section offers such a choice, set "allowSelectiveAnswering": false.

Also extract, for each section letter you can identify (A, B, C...), its instruction/description text verbatim (e.g. "Section A has one compulsory question", "Section B has four questions, three questions to be attempted") into "sectionDescriptions".

Return ONLY JSON:
{"instructions": "general exam instructions verbatim", "allowSelectiveAnswering": false, "sectionBRequiredQuestions": 3, "sectionCRequiredQuestions": 1, "sectionDescriptions": {"A": "...", "B": "..."}}

Text:
${headerText.slice(0, 3000)}`;
    const result = await groqClient.generateContent(prompt, { model: 'smart', jsonMode: true, temperature: 0.1, maxTokens: 1024 });
    const parsed = result.parsedContent || {};
    return { ...fallback, ...parsed };
  } catch (err) {
    console.warn('Document metadata extraction failed, using defaults:', err.message);
    return fallback;
  }
};

// Runs async worker(item) over items with at most `limit` in flight at once - keeps the parallel
// per-question calls from all firing at the exact same instant and tripping a rate limit, while
// still getting most of the parallelism benefit for a typical 4-8 question exam.
const runWithConcurrencyLimit = async (items, limit, worker) => {
  const results = new Array(items.length);
  let nextIndex = 0;
  const runners = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (nextIndex < items.length) {
      const i = nextIndex++;
      results[i] = await worker(items[i], i);
    }
  });
  await Promise.all(runners);
  return results;
};

/**
 * Chunked exam extraction: splits examText and answerText into one chunk per detected question,
 * pairs them up by question number, and extracts each question with its own parallel AI call
 * instead of one call trying to enumerate the whole exam. Returns null (so the caller can fall
 * back to extractQuestionsWithEnhancedAI's whole-document approach) if the source doesn't use a
 * "QUESTION ONE"/"QUESTION 2"-style header this splitter can detect.
 */
const extractQuestionsChunked = async (examText, answerText = '', images = []) => {
  const examSplit = splitIntoQuestionChunks(examText);
  if (!examSplit || examSplit.chunks.length === 0) {
    console.log('Chunked extraction: no "QUESTION N" headers detected in exam text, skipping chunked path');
    return null;
  }
  const answerSplit = answerText ? splitIntoQuestionChunks(answerText) : null;
  const answerChunksByNumber = new Map();
  if (answerSplit) {
    answerSplit.chunks.forEach(c => answerChunksByNumber.set(c.number, c.text));
  }

  console.log(`Chunked extraction: found ${examSplit.chunks.length} question chunk(s) in exam text` +
    (answerSplit ? `, ${answerSplit.chunks.length} in marking guide` : ', no marking guide provided'));

  const [metadata, perQuestionResults] = await Promise.all([
    extractDocumentMetadata(examSplit.headerText),
    runWithConcurrencyLimit(examSplit.chunks, 4, async (chunk) => {
      const matchedAnswerText = answerChunksByNumber.get(chunk.number) || '';
      const combined = matchedAnswerText ? combineExamAndAnswerText(chunk.text, matchedAnswerText) : chunk.text;
      try {
        const result = await groqClient.generateContent(buildSingleQuestionPrompt(combined), {
          model: 'smart', jsonMode: true, temperature: 0.1, maxTokens: 4096
        });
        const parsed = result.parsedContent;
        let questionObjs = null;
        if (Array.isArray(parsed)) questionObjs = parsed;
        else if (parsed && Array.isArray(parsed.questions)) questionObjs = parsed.questions;
        else if (parsed && typeof parsed === 'object') questionObjs = [parsed];
        if (!questionObjs || questionObjs.length === 0) {
          console.warn(`Chunked extraction: question ${chunk.number} returned no usable content, skipping`);
          return { section: chunk.section, questions: [] };
        }
        return { section: chunk.section, questions: questionObjs.map(q => ({ ...q, questionNumber: chunk.number })) };
      } catch (err) {
        console.error(`Chunked extraction: question ${chunk.number} failed, dropping just this one question:`, err.message);
        return { section: chunk.section, questions: [] };
      }
    })
  ]);

  const sectionMap = new Map();
  perQuestionResults.forEach(({ section, questions }) => {
    if (!sectionMap.has(section)) sectionMap.set(section, []);
    sectionMap.get(section).push(...questions);
  });

  const sections = Array.from(sectionMap.entries()).map(([name, questions]) => ({
    name,
    description: (metadata.sectionDescriptions && metadata.sectionDescriptions[name]) || `Section ${name}`,
    questions
  }));

  const totalExtracted = sections.reduce((sum, s) => sum + s.questions.length, 0);
  console.log(`Chunked extraction: ${totalExtracted} question(s) extracted across ${sections.length} section(s) (${examSplit.chunks.length} chunks attempted)`);
  if (totalExtracted === 0) return null; // every chunk failed - let the caller fall back

  return {
    instructions: metadata.instructions,
    allowSelectiveAnswering: metadata.allowSelectiveAnswering,
    sectionBRequiredQuestions: metadata.sectionBRequiredQuestions,
    sectionCRequiredQuestions: metadata.sectionCRequiredQuestions,
    sections
  };
};

/**
 * Top-level entry point for turning an uploaded exam (+ optional answer/marking-guide file) into
 * structured questions. Tries the chunked, per-question-parallel path first (most reliable for
 * exams using a "QUESTION ONE"/"QUESTION 2" convention); falls back to the existing
 * whole-document single-call extraction (extractQuestionsWithEnhancedAI, itself already backed
 * by a regex-only fallback) for anything the chunker can't split, or if chunking comes back
 * empty for some other reason.
 */
const extractExamQuestions = async (examText, answerText = '', images = []) => {
  try {
    const chunked = await extractQuestionsChunked(examText, answerText, images);
    if (chunked) {
      const validated = await validateAndEnhanceExtraction(chunked, { answers: {} });
      if (images && images.length > 0) {
        await attachDiagramImages(validated.sections, images);
      }
      return validated;
    }
  } catch (err) {
    console.error('Chunked extraction failed outright, falling back to whole-document extraction:', err);
  }
  const combinedText = combineExamAndAnswerText(examText, answerText);
  return extractQuestionsDirectly(combinedText, { answers: {} }, images);
};

const extractQuestionsDirectly = async (text, answerData = { answers: {} }, images = []) => {
  console.log('Extracting questions directly from text...');
  console.log(`Pre-loaded answer data has ${Object.keys(answerData.answers).length} answers`);

  // Log each answer for debugging
  Object.entries(answerData.answers || {}).forEach(([questionNumber, answer]) => {
    console.log(`Pre-loaded answer for question ${questionNumber}: ${answer}`);
  });

  // Try enhanced AI extraction first
  try {
    console.log('Attempting enhanced AI extraction...');
    const enhancedResult = await extractQuestionsWithEnhancedAI(text, answerData, images);
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

    // Define section header patterns - now supports any letter
    const sectionHeaderPatterns = [
      /^SECTION\s+[A-Z]/i,                                  // SECTION A, B, C, D, etc.
      /^PART\s+[A-Z]/i,                                     // PART A, B, C, D, etc.
      /^[A-Z]\.\s+/,                                        // A., B., C., D., etc.
      /^SECTION\s+[A-Z]:/i,                                 // SECTION A:, B:, C:, D:, etc.
      /^PART\s+[A-Z]:/i,                                    // PART A:, B:, C:, D:, etc.
      /^[A-Z]\s*[-:]/i,                                     // A- or A:, B- or B:, etc.
      /^MULTIPLE\s+CHOICE/i,                                // MULTIPLE CHOICE
      /^SHORT\s+ANSWER/i,                                   // SHORT ANSWER
      /^ESSAY/i,                                            // ESSAY
      /^LONG\s+ANSWER/i                                     // LONG ANSWER
    ];

    // Check if the line is a section header
    if (sectionHeaderPatterns.some(pattern => line.match(pattern))) {
      // Extract section letter (any letter A-Z)
      let sectionLetter = null;

      // Try to extract section letter from the line dynamically
      const sectionMatch = line.match(/(?:SECTION|PART)\s+([A-Z])/i) ||
                           line.match(/^([A-Z])\./) ||
                           line.match(/^([A-Z])\s*[-:]/i);

      if (sectionMatch) {
        sectionLetter = sectionMatch[1].toUpperCase();
      } else {
        // Fallback for descriptive section headers
        if (line.match(/MULTIPLE\s+CHOICE/i)) {
          sectionLetter = 'A';
        } else if (line.match(/SHORT\s+ANSWER/i)) {
          sectionLetter = 'B';
        } else if (line.match(/ESSAY|LONG\s+ANSWER|STRUCTURED/i)) {
          sectionLetter = 'C';
        }
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
        points: questionSection === 'B' ? 5 : (questionSection === 'A' ? 1 : 10),
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
          console.log('Sending request to Groq AI for question categorization...');

          // Add timeout to avoid hanging if API is unresponsive
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Groq API request timed out')), 10000);
          });

          // Race the API call against the timeout
          const result = await Promise.race([
            groqClient.generateContent(prompt, {
              model: 'fast',
              jsonMode: true,
              temperature: generationConfig.temperature,
              maxTokens: generationConfig.maxOutputTokens
            }),
            timeoutPromise
          ]);

          console.log(`Received response from Groq AI for batch ${batchIndex + 1}`);

          // Get the text directly from the result
          const text = result.parsedContent ? JSON.stringify(result.parsedContent) : (result.text || '');

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
const parseFile = async (filePath, answerData = { answers: {} }, originalFilename = null) => {
  try {
    console.log(`Parsing file: ${filePath}`);
    // Use original filename for extension if provided, otherwise extract from path
    const fileExtension = originalFilename 
      ? path.extname(originalFilename).toLowerCase()
      : path.extname(filePath).toLowerCase();
    console.log(`Detected file extension: ${fileExtension}`);
    let text = '';
    let images = [];

    // Parse the file based on its extension
    if (fileExtension === '.pdf') {
      const pdfResult = await parsePdf(filePath);
      text = pdfResult.text;
      images = pdfResult.images;
    } else if (fileExtension === '.docx' || fileExtension === '.doc') {
      text = await parseWord(filePath);
    } else if (fileExtension === '.txt') {
      text = fs.readFileSync(filePath, 'utf8');
    } else {
      throw new Error(`Unsupported file type: ${fileExtension}`);
    }

    // Extract questions directly from the text
    const questions = await extractQuestionsDirectly(text, answerData, images);
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
      const pdfResult = await parsePdf(filePath);
      text = pdfResult.text;
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
        model: 'smart',
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
 * Read a document (pdf/docx/txt) and return its plain text (+ any diagram images for PDFs).
 * Shared by every exam-upload entry point so question and answer files are both read the
 * same way, instead of each call site re-implementing its own extension-dispatch.
 * @param {string} filePath - Local path or (for PDFs) a Cloudinary URL
 * @param {string} [originalFilename] - Original upload filename, used for extension detection
 *   when filePath itself doesn't carry a useful extension (e.g. a Cloudinary storage key)
 */
const readDocumentText = async (filePath, originalFilename = null) => {
  const fileExtension = originalFilename
    ? path.extname(originalFilename).toLowerCase()
    : path.extname(filePath).toLowerCase();
  if (fileExtension === '.pdf') {
    const pdfResult = await parsePdf(filePath);
    return { text: pdfResult.text, images: pdfResult.images || [] };
  }
  if (fileExtension === '.docx' || fileExtension === '.doc') {
    return { text: await parseWord(filePath), images: [] };
  }
  if (fileExtension === '.txt') {
    return { text: fs.readFileSync(filePath, 'utf8'), images: [] };
  }
  throw new Error(`Unsupported file type: ${fileExtension}`);
};

/**
 * Combine a question paper's text with its marking guide/answer file's text into one document,
 * so a SINGLE AI extraction call can reason about both together (matching sub-question answers
 * to the right part of the right question) instead of separately parsing the answer file into a
 * flat {questionNumber: answerString} map and bolting it on afterward. That older two-step
 * approach (still available as parseAnswerFile, for any other caller that still wants it) proved
 * unreliable for real multi-part accounting-style exams: it can only hold one flat string per
 * question number (no per-sub-question granularity for a), b), i), ii)... parts), and its own
 * extraction prompt truncated the source document to 4000 characters - meaning anything past
 * roughly the first page of a real multi-page marking guide was silently never seen at all.
 */
const combineExamAndAnswerText = (examText, answerText) => {
  if (!answerText || !answerText.trim()) return examText;
  return `${examText}\n\n=== TEACHER'S MARKING GUIDE / MODEL ANSWERS (authoritative - use this to fill in the real correctAnswer for every question and sub-question above; match by question/part number) ===\n\n${answerText}`;
};

/**
 * Parse an exam file to extract questions
 * @param {string} filePath - Path to the exam file
 * @param {string} answerFilePath - Optional path to the answer file
 * @returns {Promise<Object>} - Structured exam with questions
 */
const parseExamFile = async (filePath, answerFilePath = null) => {
  try {
    const { text: examText, images } = await readDocumentText(filePath);
    let answerText = '';

    if (answerFilePath && fs.existsSync(answerFilePath)) {
      try {
        console.log(`Reading marking guide/answer file: ${answerFilePath}`);
        answerText = (await readDocumentText(answerFilePath)).text;
        console.log(`Exam text (${examText.length} chars), marking guide (${answerText.length} chars)`);
      } catch (answerError) {
        console.error('Error reading answer file, continuing with exam text only:', answerError);
      }
    } else {
      console.log(`No answer file provided or file does not exist: ${answerFilePath}`);
    }

    return await extractExamQuestions(examText, answerText, images);
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
  readDocumentText,
  combineExamAndAnswerText,
  extractQuestionsDirectly,
  extractQuestionsWithEnhancedAI,
  extractQuestionsChunked,
  extractExamQuestions,
  categorizeQuestionsWithAI,
  parseAnswerFile,
  parseExamFile
};