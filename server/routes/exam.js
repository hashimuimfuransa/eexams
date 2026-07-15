const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const mammoth = require('mammoth');
const { examFileStorage, referenceFileStorage } = require('../config/cloudinary');
const pdf = require('pdf-parse');
const {
  createExam,
  getExams,
  getExamById,
  toggleExamLock,
  allowStudentRetake,
  startExam,
  submitAnswer,
  completeExam,
  gradeManually,
  triggerAIGrading,
  resetExamQuestions,
  debugExamContent,
  getExamResult,
  regradeExamResult,
  regradeAllExams,
  enableSelectiveAnswering,
  selectQuestion,
  fixExistingResults,
  debugResult,
  comprehensiveAIGrading
} = require('../controllers/examController');
const auth = require('../middleware/auth');
const { isAdmin, isStudent, isAdminOrTeacher, attachOrgAdminId } = require('../middleware/role');
const {
  resolveEffectivePlan,
  resolveExamAccessType,
  checkExamLimit,
  requireAIFeatures,
  requireAdvancedAI
} = require('../middleware/planRestrictions');
const { authLimiter, submissionLimiter, aiGradingLimiter, examCreationLimiter } = require('../middleware/rateLimiter');
const { cacheExam, cacheExamList, invalidateExamCache } = require('../middleware/cacheMiddleware');
const { validateExamAccess, markFreeExamUsed } = require('../middleware/examAccess');
const groqClient = require('../utils/groqClient');
const { coerceToGrid } = require('../utils/spreadsheetGrading');

// Normalize a single spreadsheetTemplate/spreadsheetModelAnswer field returned by the AI.
// Two independent problems to fix:
// 1) The AI (in JSON mode) frequently returns these fields as nested JSON objects rather than
//    the JSON *strings* the Question schema (and FinancialSpreadsheet.jsx) expect. Left as
//    objects, Mongoose silently casts them to an empty string when saving, wiping the table.
// 2) Even once stringified, the AI often ignores the { tables: [{title,headers,data}] } contract
//    and ignores multi-table questions entirely, or returns a flat "label: value" object instead
//    (e.g. {"Revenue":800000,"COGS":300000}) - the more natural JSON shape for a set of line
//    items. That doesn't match what the Handsontable grid (and the grading comparison) expect,
//    so it renders as a blank generic spreadsheet. coerceToGrid() converts any of: a bare
//    { headers, data } grid (legacy single-table), a bare array of tables, or a flat label/value
//    object into the canonical { tables: [{ title, headers, data }, ...] } shape before storing.
const normalizeSpreadsheetField = (value) => {
  if (!value) return value;
  const parsed = typeof value === 'string' ? (() => { try { return JSON.parse(value); } catch { return null; } })() : value;
  const grid = coerceToGrid(parsed);
  return grid ? JSON.stringify(grid) : (typeof value === 'string' ? value : JSON.stringify(value));
};

// Configure multer for reference file uploads using Cloudinary
const referenceUpload = multer({
  storage: referenceFileStorage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit for larger files
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.doc', '.docx', '.txt'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOC, DOCX, and TXT files are allowed.'));
    }
  }
});

// In-memory lock map for handling concurrent requests
const examLocks = new Map();

// Acquire a lock for an exam ID
const acquireLock = (examId) => {
  const lock = examLocks.get(examId);
  if (lock) {
    return false; // Lock already held
  }
  examLocks.set(examId, Date.now());
  return true;
};

// Release a lock for an exam ID
const releaseLock = (examId) => {
  examLocks.delete(examId);
};

// Helper function to save with retry logic for VersionError
const saveWithRetry = async (exam, maxRetries = 3) => {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      await exam.save();
      return { success: true };
    } catch (error) {
      if (error.name === 'VersionError' && attempt < maxRetries - 1) {
        console.log(`VersionError on attempt ${attempt + 1}, reloading and retrying...`);
        // Reload the document to get the latest version
        const freshExam = await exam.constructor.findById(exam._id);
        if (freshExam) {
          // Copy the fields we want to save
          freshExam.title = exam.title;
          freshExam.description = exam.description;
          freshExam.timeLimit = exam.timeLimit;
          freshExam.passingScore = exam.passingScore;
          freshExam.totalPoints = exam.totalPoints;
          freshExam.sections = exam.sections;
          exam = freshExam;
          // Wait a bit before retrying
          await new Promise(resolve => setTimeout(resolve, 100 * (attempt + 1)));
          continue;
        }
      }
      throw error;
    }
  }
  return { success: false };
};

// Configure multer with Cloudinary storage for exam/answer file uploads
const upload = multer({
  storage: examFileStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    if (/pdf|msword|officedocument/.test(file.mimetype) ||
        /pdf|doc|docx/.test(path.extname(file.originalname).toLowerCase())) {
      return cb(null, true);
    }
    cb(new Error('Only PDF and Word documents are allowed'));
  }
});

// Multer error handling middleware
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    // A Multer error occurred when uploading
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ message: 'Unexpected file field. Only examFile and answerFile are allowed.' });
    }
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ message: 'File too large. Maximum size is 50MB.' });
    }
    return res.status(400).json({ message: `Upload error: ${err.message}` });
  } else if (err) {
    // An unknown error occurred
    if (err.message && err.message.includes('Unexpected end of form')) {
      console.error('Form parsing error - client may have disconnected:', err.message);
      return res.status(400).json({ message: 'Upload was interrupted. Please try again with a stable connection.' });
    }
    // Pass other errors to default error handler
    return res.status(500).json({ message: err.message || 'Server error during upload' });
  }
  next();
};

// Apply auth middleware to all routes
router.use(auth);

// Admin routes with rate limiting and caching
router.post(
  '/',
  authLimiter,
  examCreationLimiter,
  isAdmin,
  checkExamLimit,
  upload.fields([
    { name: 'examFile', maxCount: 1 },
    { name: 'answerFile', maxCount: 1 }
  ]),
  handleMulterError,
  invalidateExamCache,
  createExam
);
router.get('/', cacheExamList, getExams);
router.get(
  '/:id',
  cacheExam,
  getExamById
);
router.put('/:id/toggle-lock', authLimiter, isAdminOrTeacher, invalidateExamCache, toggleExamLock);
router.post('/:examId/allow-retake/:studentId', authLimiter, isAdminOrTeacher, allowStudentRetake);
router.post('/grade/:resultId', authLimiter, isAdmin, gradeManually);
router.post('/ai-grade/:resultId', authLimiter, aiGradingLimiter, isAdmin, triggerAIGrading);
router.get('/:id/debug', isAdmin, debugExamContent);
router.post('/:id/reset-questions', authLimiter, isAdmin, invalidateExamCache, resetExamQuestions);

// Debug routes (must come before parameterized routes)
router.get('/test-routes', (req, res) => {
  res.json({
    message: 'Exam routes are working!',
    timestamp: new Date().toISOString(),
    availableRoutes: [
      'POST /:id/start',
      'POST /:id/answer',
      'POST /:id/complete',
      'POST /:id/select-question',
      'GET /result/:id'
    ]
  });
});

// Student routes with rate limiting
router.post('/:id/start', submissionLimiter, isStudent, validateExamAccess, startExam);
router.post('/:id/answer', submissionLimiter, isStudent, validateExamAccess, submitAnswer);
router.post('/:id/complete', submissionLimiter, isStudent, markFreeExamUsed, completeExam);
router.post('/:id/select-question', submissionLimiter, isStudent, selectQuestion);






// ── Plan limits for AI exam generation ──
const AI_PLAN_LIMITS = {
  free:       { maxQuestions: 0,  maxPerType: 0  },
  basic:      { maxQuestions: 20, maxPerType: 10 },
  premium:    { maxQuestions: 50, maxPerType: 20 },
  enterprise: { maxQuestions: 100, maxPerType: 50 },
};

// Build section blocks for the AI prompt from question type config
// Enhanced with detailed model answers for accurate AI grading
function buildSectionsInstruction(questionTypes) {
  const typeSchemas = {
    'multiple-choice': 'MCQ with options[{text,isCorrect,letter}], correctAnswer(letter), explanation',
    'true-false': 'True/False with options[{text,isCorrect,letter}], correctAnswer("True"/"False"), explanation',
    'open-ended': 'Essay with correctAnswer(comprehensive string), marks, gradingCriteria[{criteria,points}]',
    'fill-blank': 'Fill blank with correctAnswer(string), acceptableAnswers[], explanation',
    'fill-in-blank': 'Fill blank with correctAnswer(string), acceptableAnswers[], explanation',
    'short-answer': 'Short answer with correctAnswer(string), keyPoints[], marks',
    'matching': 'Match with leftItems[], rightItems[], matchingPairs{leftColumn[], rightColumn[], correctPairs[{left,right}]}, correctAnswer(explanation string), marks',
    'ordering': 'Order with items[], itemsToOrder{items[], correctOrder[indices]}, correctAnswer(explanation string), marks',
    'drag-drop': 'Drag-drop with dragDropData{dropZones[], draggableItems[], correctPlacements[{item,zone}]}, correctAnswer(explanation string), marks',
    'image-based': 'Image-based with imageUrl, correctAnswer(string), explanation',
    'image': 'Image with imageUrl, correctAnswer(string), explanation',
    'structured': 'Structured with subQuestions[{label,text,type,points,correctAnswer,options}], subQuestionConfig{mode,requiredCount,scoringType}, correctAnswer(explanation string), marks'
  };

  return questionTypes.map((qt, idx) => {
    const sectionName = String.fromCharCode(65 + idx);
    const schema = typeSchemas[qt.type] || typeSchemas['open-ended'];
    
    // Add contextual fields based on question type
    let additionalFields = '';
    if (qt.type === 'fill-in-blank' || qt.type === 'fill-blank') {
      additionalFields = `,
  "wordBank": ["word1", "word2", "word3"],
  "instructions": "Fill in the blanks using the words from the box above."`;
    } else if (qt.type === 'open-ended' || qt.type === 'essay') {
      additionalFields = `,
  "instructions": "Write a comprehensive answer to the question below."`;
    } else if (qt.type === 'short-answer') {
      additionalFields = `,
  "instructions": "Provide a brief answer to each question."`;
    }
    
    return `{
  "name": "${sectionName}",
  "title": "${qt.label || qt.type} Questions",
  "description": "${qt.label || qt.type}",
  "instructions": "Read each question carefully and provide your answer."${additionalFields},
  "questions": [
    /* CRITICAL: Generate EXACTLY ${qt.count} questions */
    /* EVERY question in this section MUST have "type": "${qt.type}" */
    /* Question format: ${schema} */
  ]
}`;
  }).join(',\n  ');
}

// Helper to map various question type strings to standardized types
function mapQuestionType(type) {
  if (!type) return 'multiple-choice';
  const t = String(type).toLowerCase();
  
  // Multiple choice variations
  if (t.includes('multiple') || t.includes('choice') || t.includes('mcq') || t.includes('a/b/c/d')) {
    return 'multiple-choice';
  }
  // True/False variations
  if (t.includes('true') || t.includes('false') || t.includes('true/false') || t.includes('boolean')) {
    return 'true-false';
  }
  // Fill in blank variations
  if (t.includes('fill') || t.includes('blank') || t.includes('gap') || t.includes('completion')) {
    return 'fill-in-blank';
  }
  // Open ended variations
  if (t.includes('open') || t.includes('essay') || t.includes('long') || t.includes('descriptive')) {
    return 'open-ended';
  }
  // Handle "open" type specifically
  if (t === 'open') {
    return 'open-ended';
  }
  // Matching variations
  if (t.includes('match') || t.includes('pair') || t.includes('column')) {
    return 'matching';
  }
  // Ordering variations
  if (t.includes('order') || t.includes('sequence') || t.includes('rank') || t.includes('arrange')) {
    return 'ordering';
  }
  // Drag and drop variations
  if (t.includes('drag') || t.includes('drop') || t.includes('drag-drop')) {
    return 'drag-drop';
  }
  // Image variations
  if (t.includes('image') || t.includes('picture') || t.includes('photo')) {
    return 'image-based';
  }
  // Short answer variations
  if (t.includes('short') || t.includes('brief') || t.includes('one-word')) {
    return 'short-answer';
  }
  // Structured variations
  if (t.includes('structured') || t.includes('multi-part') || t.includes('composite')) {
    return 'structured';
  }
  // Financial spreadsheet variations
  if (t.includes('financial') || t.includes('spreadsheet') || t.includes('finance') || t.includes('accounting') || t.includes('statement')) {
    return 'financial-spreadsheet';
  }

  return 'multiple-choice'; // default
}

// Save draft exam route - must come before parameterized routes
router.post('/save-draft', auth, isAdminOrTeacher, attachOrgAdminId, async (req, res) => {
  try {
    console.log('Save draft - req.user._id:', req.user._id);
    console.log('Save draft - req.orgAdminId:', req.orgAdminId);
    console.log('Save draft - req.user.role:', req.user.role);
    const { title, description, timeLimit, passingScore, questions, totalMarks, examId, sections, accessType, level, subLevel } = req.body;
    const resolvedAccessType = accessType !== undefined
      ? await resolveExamAccessType(req.user, accessType)
      : undefined;

    // Log incoming sections data to check if passage is present
    console.log('Incoming sections data:', sections?.map(s => ({
      name: s.name,
      hasPassage: !!s.passage,
      passageLength: s.passage?.length || 0,
      hasInstructions: !!s.instructions,
      hasWordBank: s.wordBank?.length > 0
    })));

    // Log incoming questions data to check if passage is present
    console.log('Questions with passage in request:', questions?.filter(q => q.passage).map(q => ({
      id: q._id,
      section: q.section,
      hasPassage: !!q.passage,
      passageLength: q.passage?.length || 0
    })));

    if (!title || !questions || questions.length === 0) {
      return res.status(400).json({ message: 'Title and at least one question are required' });
    }

    const Question = require('../models/Question');
    const Exam = require('../models/Exam');

    // Teachers save with their own ID, admins use orgAdminId
    const creatorId = req.user.role === 'teacher' ? req.user._id : (req.orgAdminId || req.user._id);
    console.log('Save draft - using creatorId:', creatorId);

    // Group questions by section
    const questionsBySection = {};
    questions.forEach((q, idx) => {
      const section = q.section || 'A';
      console.log(`Question ${idx}: section="${section}", text="${q.text?.substring(0, 30)}..."`);
      if (!questionsBySection[section]) {
        questionsBySection[section] = [];
      }
      questionsBySection[section].push(q);
    });
    console.log('Questions grouped by section:', Object.keys(questionsBySection).map(k => `${k}: ${questionsBySection[k].length} questions`));

    // Create sections array based on grouped questions and provided sections data
    const sectionsArray = Object.keys(questionsBySection).map(sectionName => {
      // Find the provided section data if available
      const providedSection = sections?.find(s => s.name === sectionName);
      
      // Extract passage/instructions/wordBank from questions if not provided in sections
      const sectionQuestions = questionsBySection[sectionName] || [];
      const firstQuestionWithPassage = sectionQuestions.find(q => q.passage);
      const firstQuestionWithInstructions = sectionQuestions.find(q => q.instructions);
      const firstQuestionWithWordBank = sectionQuestions.find(q => q.wordBank && q.wordBank.length > 0);
      
      const sectionData = {
        name: sectionName,
        title: providedSection?.title || `Section ${sectionName}`,
        description: providedSection?.description || `Section ${sectionName}`,
        passage: providedSection?.passage || firstQuestionWithPassage?.passage || '',
        instructions: providedSection?.instructions || firstQuestionWithInstructions?.instructions || '',
        wordBank: providedSection?.wordBank || firstQuestionWithWordBank?.wordBank || [],
        subsections: providedSection?.subsections || [],
        questions: []
      };

      console.log(`Section ${sectionName} data:`, {
        hasProvidedSection: !!providedSection,
        providedHasPassage: !!providedSection?.passage,
        questionHasPassage: !!firstQuestionWithPassage,
        finalHasPassage: !!sectionData.passage,
        passageLength: sectionData.passage?.length || 0
      });

      return sectionData;
    });

    let exam;

    // Check if examId is provided to update existing draft
    if (examId) {
      exam = await Exam.findById(examId);
      if (exam && exam.createdBy.toString() === creatorId.toString() && exam.status === 'draft') {
        console.log(`Updating existing draft exam: ${examId}`);
        // Update existing exam
        exam.title = title;
        exam.description = description || title;
        exam.timeLimit = timeLimit || 60;
        exam.passingScore = passingScore || 70;
        exam.totalPoints = totalMarks || questions.reduce((sum, q) => sum + (q.marks || q.points || 1), 0);
        if (resolvedAccessType !== undefined) exam.accessType = resolvedAccessType;
        if (level !== undefined) exam.level = level;
        if (subLevel !== undefined) exam.subLevel = subLevel || null;

        // Merge existing section data with new sections to preserve passage/instructions/wordBank
        exam.sections = sectionsArray.map(newSection => {
          const existingSection = exam.sections?.find(s => s.name === newSection.name);
          return {
            ...newSection,
            // Preserve existing passage/instructions/wordBank if not provided in new data
            passage: newSection.passage || existingSection?.passage || '',
            instructions: newSection.instructions || existingSection?.instructions || '',
            wordBank: newSection.wordBank?.length > 0 ? newSection.wordBank : (existingSection?.wordBank || []),
            subsections: newSection.subsections?.length > 0 ? newSection.subsections : (existingSection?.subsections || [])
          };
        });
        
        console.log('Merged sections data:', exam.sections?.map(s => ({
          name: s.name,
          hasPassage: !!s.passage,
          passageLength: s.passage?.length || 0,
          hasInstructions: !!s.instructions,
          hasWordBank: s.wordBank?.length > 0
        })));
        
        // Don't save here - will save after creating questions

        // Delete existing questions for this exam
        await Question.deleteMany({ exam: exam._id });
      } else {
        // If exam doesn't exist or doesn't belong to user, create new one
        console.log('Creating new draft exam (invalid examId or not a draft)');
        exam = null;
      }
    }

    // If no existing exam found, create new one
    if (!exam) {
      // Check if there's an existing draft with the same title for this creator
      const existingDraft = await Exam.findOne({
        title,
        createdBy: creatorId,
        status: 'draft'
      });

      if (existingDraft) {
        console.log(`Found existing draft with same title: ${existingDraft._id}, updating it`);
        exam = existingDraft;
        exam.description = description || title;
        exam.timeLimit = timeLimit || 60;
        exam.passingScore = passingScore || 70;
        exam.totalPoints = totalMarks || questions.reduce((sum, q) => sum + (q.marks || q.points || 1), 0);
        if (resolvedAccessType !== undefined) exam.accessType = resolvedAccessType;
        if (level !== undefined) exam.level = level;
        if (subLevel !== undefined) exam.subLevel = subLevel || null;

        // Merge existing section data with new sections to preserve passage/instructions/wordBank
        exam.sections = sectionsArray.map(newSection => {
          const existingSection = exam.sections?.find(s => s.name === newSection.name);
          return {
            ...newSection,
            // Preserve existing passage/instructions/wordBank if not provided in new data
            passage: newSection.passage || existingSection?.passage || '',
            instructions: newSection.instructions || existingSection?.instructions || '',
            wordBank: newSection.wordBank?.length > 0 ? newSection.wordBank : (existingSection?.wordBank || []),
            subsections: newSection.subsections?.length > 0 ? newSection.subsections : (existingSection?.subsections || [])
          };
        });
        
        console.log('Merged sections data (existing draft):', exam.sections?.map(s => ({
          name: s.name,
          hasPassage: !!s.passage,
          passageLength: s.passage?.length || 0,
          hasInstructions: !!s.instructions,
          hasWordBank: s.wordBank?.length > 0
        })));
        
        // Don't save here - will save after creating questions

        // Delete existing questions for this exam
        await Question.deleteMany({ exam: exam._id });
      } else {
        // Create new exam
        exam = await Exam.create({
          title,
          description: description || title,
          timeLimit: timeLimit || 60,
          passingScore: passingScore || 70,
          sections: sectionsArray,
          createdBy: creatorId,
          status: 'draft',
          isLocked: false,
          totalPoints: totalMarks || questions.reduce((sum, q) => sum + (q.marks || q.points || 1), 0),
          accessType: resolvedAccessType !== undefined ? resolvedAccessType : 'subscription',
          level: level || null,
          subLevel: subLevel || null
        });
        console.log(`Created new draft exam: ${exam._id}`);
      }
    }

    // Sanitize all array fields in questions to handle stringified arrays from AI
    const sanitizeQuestions = (questionsArray) => {
      if (!Array.isArray(questionsArray)) return questionsArray;
      
      return questionsArray.map((q, idx) => {
        const sanitizeField = (value, fieldName) => {
          if (Array.isArray(value)) {
            // Check if array contains a single string that is actually a stringified array
            if (value.length === 1 && typeof value[0] === 'string' && value[0].startsWith('[')) {
              try {
                const parsed = JSON.parse(value[0]);
                if (Array.isArray(parsed)) {
                  console.log(`Sanitized ${fieldName} for question ${idx}: parsed stringified array`);
                  return parsed;
                }
              } catch (e) {
                console.log(`Failed to parse ${fieldName} for question ${idx}: ${e.message}`);
              }
            }
            return value;
          }
          if (typeof value === 'string' && value.startsWith('[')) {
            // Parse stringified arrays
            try {
              const parsed = JSON.parse(value);
              if (Array.isArray(parsed)) {
                console.log(`Sanitized ${fieldName} for question ${idx}: parsed stringified array from string`);
                return parsed;
              }
            } catch (e) {
              console.log(`Failed to parse ${fieldName} string for question ${idx}: ${e.message}`);
            }
          }
          return value;
        };
        
        // Sanitize all array fields
        if (q.leftItems) {
          q.leftItems = sanitizeField(q.leftItems, 'leftItems');
          console.log(`Question ${idx} leftItems after sanitization:`, JSON.stringify(q.leftItems).substring(0, 200));
        }
        if (q.rightItems) {
          q.rightItems = sanitizeField(q.rightItems, 'rightItems');
          console.log(`Question ${idx} rightItems after sanitization:`, JSON.stringify(q.rightItems).substring(0, 200));
        }
        if (q.wordBank) q.wordBank = sanitizeField(q.wordBank, 'wordBank');
        if (q.items) q.items = sanitizeField(q.items, 'items');
        if (q.options) q.options = sanitizeField(q.options, 'options');
        if (q.matchingPairs?.leftColumn) q.matchingPairs.leftColumn = sanitizeField(q.matchingPairs.leftColumn, 'matchingPairs.leftColumn');
        if (q.matchingPairs?.rightColumn) q.matchingPairs.rightColumn = sanitizeField(q.matchingPairs.rightColumn, 'matchingPairs.rightColumn');
        if (q.itemsToOrder?.items) q.itemsToOrder.items = sanitizeField(q.itemsToOrder.items, 'itemsToOrder.items');
        if (q.dragDropData?.dropZones) q.dragDropData.dropZones = sanitizeField(q.dragDropData.dropZones, 'dragDropData.dropZones');
        if (q.dragDropData?.draggableItems) q.dragDropData.draggableItems = sanitizeField(q.dragDropData.draggableItems, 'dragDropData.draggableItems');
        
        return q;
      });
    };
    
    const sanitizedQuestions = sanitizeQuestions(questions);
    console.log('Sanitized questions array');
    
    // Create questions with exam ID and section
    const createdQuestions = {};
    
    for (const q of sanitizedQuestions) {
      // Skip questions with empty text
      if (!q.text || !q.text.trim()) {
        console.warn('Skipping question with empty text');
        continue;
      }

      const section = q.section || 'A';
      if (!createdQuestions[section]) {
        createdQuestions[section] = [];
      }

      // Handle gradingCriteria - ensure it's always an array of objects
      let normalizedGradingCriteria = [];
      if (q.gradingCriteria) {
        if (Array.isArray(q.gradingCriteria)) {
          normalizedGradingCriteria = q.gradingCriteria.map(gc => {
            if (typeof gc === 'string') {
              return { criteria: gc, points: 1 };
            }
            if (typeof gc === 'object' && gc !== null) {
              return {
                criteria: gc.criteria || gc.description || '',
                points: gc.points || 1
              };
            }
            return { criteria: String(gc), points: 1 };
          });
        } else if (typeof q.gradingCriteria === 'string') {
          if (q.gradingCriteria.startsWith('[')) {
            try {
              const parsed = JSON.parse(q.gradingCriteria);
              if (Array.isArray(parsed)) {
                normalizedGradingCriteria = parsed.map(gc => {
                  if (typeof gc === 'string') {
                    return { criteria: gc, points: 1 };
                  }
                  if (typeof gc === 'object' && gc !== null) {
                    return {
                      criteria: gc.criteria || gc.description || '',
                      points: gc.points || 1
                    };
                  }
                  return { criteria: String(gc), points: 1 };
                });
              }
            } catch (e) {
              normalizedGradingCriteria = [{ criteria: q.gradingCriteria, points: 1 }];
            }
          } else {
            normalizedGradingCriteria = [{ criteria: q.gradingCriteria, points: 1 }];
          }
        }
      }

      // Helper function to parse stringified arrays from AI
      const parseArrayField = (value) => {
        if (Array.isArray(value)) {
          // Check if the array contains a single string that is actually a stringified array
          if (value.length === 1 && typeof value[0] === 'string' && value[0].startsWith('[')) {
            try {
              const parsed = JSON.parse(value[0]);
              if (Array.isArray(parsed)) return parsed;
            } catch {
              // If parsing fails, return the original array
            }
          }
          return value;
        }
        if (typeof value === 'string') {
          try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) return parsed;
          } catch {
            // If parsing fails, return empty array
          }
        }
        return [];
      };

        const normalizeDifficulty = (d) => {
          if (!d || typeof d !== 'string') return 'medium';
          const s = d.trim().toLowerCase();
          return ['easy', 'medium', 'hard'].includes(s) ? s : 'medium';
        };

      const questionData = {
        text: q.text,
        type: q.type || 'multiple-choice',
        marks: q.marks || q.points || 1,
        points: q.marks || q.points || 1,
        difficulty: normalizeDifficulty(q.difficulty),
        correctAnswer: q.correctAnswer || '',
        options: [],
        explanation: q.explanation || '',
        answerKey: q.answerKey || q.explanation || '',
        gradingCriteria: normalizedGradingCriteria,
        keyPoints: Array.isArray(q.keyPoints)
          ? q.keyPoints.map(kp => typeof kp === 'string' ? kp : JSON.stringify(kp))
          : (typeof q.keyPoints === 'string'
              ? (q.keyPoints.startsWith('[') ? JSON.parse(q.keyPoints).map(kp => typeof kp === 'string' ? kp : JSON.stringify(kp)) : [q.keyPoints])
              : []),
        acceptableAnswers: q.acceptableAnswers || [],
        exam: exam._id,
        section: section,
        createdBy: req.user._id,
        imageUrl: q.imageUrl || '',
        // Preserve new structure fields from pasted exams - will be set in type-specific sections
        correctMatches: q.correctMatches || {},
        wordBank: parseArrayField(q.wordBank),
        passage: q.passage || '',
        subsectionTitle: q.subsectionTitle || '',
        subsection: q.subsection || '',
        instructions: q.instructions || '',
        sectionTitle: q.sectionTitle || '',
        // Handle multi-part questions with subQuestions
        subQuestions: q.subQuestions && Array.isArray(q.subQuestions) ? q.subQuestions.map(sq => ({
          label: sq.label || '',
          text: sq.text || '',
          type: sq.type || 'open-ended',
          points: sq.points || 1,
          correctAnswer: sq.correctAnswer || '',
          options: sq.options || []
        })) : [],
        // Sub-question configuration: mode ('all' or 'choose-n'), requiredCount, scoringType
        subQuestionConfig: q.subQuestionConfig || {
          mode: q.subQuestionMode || 'all', // Backward compatibility
          requiredCount: 1,
          scoringType: 'partial'
        }
      };

      // Handle options - preserve user's options but ensure correct structure
      if (q.type === 'multiple-choice' || q.type === 'true-false') {
        if (q.options && q.options.length > 0) {
          questionData.options = q.options.map((opt, idx) => {
            if (typeof opt === 'string') {
              return {
                text: opt || `Option ${String.fromCharCode(65 + idx)}`,
                isCorrect: false,
                letter: String.fromCharCode(65 + idx)
              };
            } else {
              return {
                text: opt.text || opt.value || `Option ${String.fromCharCode(65 + idx)}`,
                isCorrect: opt.isCorrect || false,
                letter: opt.letter || String.fromCharCode(65 + idx)
              };
            }
          });
        } else {
          // Only provide defaults if no options at all
          const defaultOptions = q.type === 'true-false'
            ? [{ text: 'True', isCorrect: false, letter: 'A' }, { text: 'False', isCorrect: false, letter: 'B' }]
            : [
                { text: 'Option A', isCorrect: false, letter: 'A' },
                { text: 'Option B', isCorrect: false, letter: 'B' },
                { text: 'Option C', isCorrect: false, letter: 'C' },
                { text: 'Option D', isCorrect: false, letter: 'D' }
              ];
          questionData.options = defaultOptions;
        }
      }

      // Add matching-specific fields
      if (q.type === 'matching') {
        // Sanitize leftItems and rightItems - they might be stringified by AI
        const leftItems = parseArrayField(q.leftItems || q.matchingPairs?.leftColumn);
        const rightItems = parseArrayField(q.rightItems || q.matchingPairs?.rightColumn);

        console.log('Matching question leftItems:', JSON.stringify(leftItems).substring(0, 200));
        console.log('Matching question rightItems:', JSON.stringify(rightItems).substring(0, 200));

        // Handle different formats for correctAnswer - prioritize teacher's edits
        let correctPairs = [];

        // First priority: matchingPairs.correctPairs (teacher's edited format)
        if (q.matchingPairs?.correctPairs && Array.isArray(q.matchingPairs.correctPairs)) {
          correctPairs = q.matchingPairs.correctPairs;
          console.log('Using teacher-edited correctPairs from matchingPairs');
        }
        // Second priority: correctAnswer as array
        else if (Array.isArray(q.correctAnswer)) {
          correctPairs = q.correctAnswer;
          console.log('Using correctAnswer as array');
        }
        // Third priority: correctAnswer as object
        else if (typeof q.correctAnswer === 'object' && q.correctAnswer !== null) {
          // Convert object format to array format
          correctPairs = Object.entries(q.correctAnswer).map(([left, right]) => ({
            left: parseInt(left),
            right: parseInt(right)
          }));
          console.log('Converted correctAnswer object to array');
        }
        // Fourth priority: correctAnswer as string (try to parse JSON)
        else if (typeof q.correctAnswer === 'string') {
          try {
            const parsed = JSON.parse(q.correctAnswer);
            if (Array.isArray(parsed)) {
              correctPairs = parsed;
              console.log('Parsed correctAnswer string as JSON array');
            }
          } catch {
            console.log('Could not parse correctAnswer as JSON, will use fallback');
          }
        }

        // Only generate default pairs as last resort if no pairs found
        if (correctPairs.length === 0) {
          const leftCount = leftItems.length;
          const rightCount = rightItems.length;
          const count = Math.min(leftCount, rightCount);
          correctPairs = Array.from({ length: count }, (_, i) => ({ left: i, right: i }));
          console.log('Generated default correct pairs (teacher edits not found)');
        }

        questionData.matchingPairs = {
          leftColumn: leftItems,
          rightColumn: rightItems,
          correctPairs
        };

        // Also set leftItems and rightItems for new structure
        questionData.leftItems = leftItems;
        questionData.rightItems = rightItems;

        // Set correctAnswer to default string for matching questions
        questionData.correctAnswer = 'Not provided';
      }

      // Add ordering-specific fields
      if (q.type === 'ordering') {
        // Sanitize items array - might be stringified by AI
        const items = parseArrayField(q.items || q.itemsToOrder?.items);

        // Handle different formats for correctAnswer
        let correctOrder = [];
        if (typeof q.correctAnswer === 'string') {
          // Try to parse as JSON first
          try {
            const parsed = JSON.parse(q.correctAnswer);
            if (Array.isArray(parsed)) {
              correctOrder = parsed.map(Number);
            }
          } catch {
            // If string, try to parse as comma-separated numbers
            const parsed = q.correctAnswer.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
            if (parsed.length > 0) {
              correctOrder = parsed;
            } else {
              // Fallback: generate default order based on items count
              const itemCount = items.length;
              correctOrder = Array.from({ length: itemCount }, (_, i) => i);
            }
          }
        } else if (Array.isArray(q.correctAnswer)) {
          correctOrder = q.correctAnswer.map(Number);
        }

        // Fallback to existing correctOrder if available
        if (correctOrder.length === 0 && q.itemsToOrder?.correctOrder) {
          correctOrder = q.itemsToOrder.correctOrder.map(Number);
        }

        questionData.itemsToOrder = {
          items: items,
          correctOrder
        };

        // Set correctAnswer to default string for ordering questions
        questionData.correctAnswer = 'Not provided';
      }

      // Add drag-drop-specific fields
      if (q.type === 'drag-drop') {
        // Sanitize arrays - might be stringified by AI
        const dropZones = parseArrayField(q.dropZones || q.dragDropData?.dropZones);
        const draggableItems = parseArrayField(q.draggableItems || q.dragDropData?.draggableItems);

        // Handle different formats for correctAnswer
        let correctPlacements = [];
        if (typeof q.correctAnswer === 'string') {
          // Try to parse as JSON first
          try {
            const parsed = JSON.parse(q.correctAnswer);
            if (Array.isArray(parsed)) {
              correctPlacements = parsed;
            }
          } catch {
            // If string, assume it's a fallback and generate default placements
            const dropZoneCount = dropZones.length;
            const itemCount = draggableItems.length;
            const count = Math.min(dropZoneCount, itemCount);
            correctPlacements = Array.from({ length: count }, (_, i) => ({ item: i, zone: i }));
          }
        } else if (Array.isArray(q.correctAnswer)) {
          correctPlacements = q.correctAnswer;
        }

        // Fallback to existing correctPlacements if available
        if (correctPlacements.length === 0 && q.dragDropData?.correctPlacements) {
          correctPlacements = q.dragDropData.correctPlacements;
        }

        questionData.dragDropData = {
          dropZones: dropZones,
          draggableItems: draggableItems,
          correctPlacements
        };

        // Set correctAnswer to default string for drag-drop questions
        questionData.correctAnswer = 'Not provided';
      }

      // Normalize gradingCriteria for open-ended questions
      if (q.type === 'open-ended' || q.type === 'essay') {
        if (Array.isArray(questionData.gradingCriteria)) {
          questionData.gradingCriteria = questionData.gradingCriteria.map(criterion => {
            if (typeof criterion === 'string') {
              return { criteria: criterion, points: 1 };
            }
            return {
              criteria: criterion.criteria || criterion.criterion || criterion.description || '',
              points: criterion.points || criterion.mark || 1
            };
          });
        } else if (typeof questionData.gradingCriteria === 'object' && questionData.gradingCriteria !== null) {
          questionData.gradingCriteria = [{
            criteria: questionData.gradingCriteria.criteria || questionData.gradingCriteria.description || '',
            points: questionData.gradingCriteria.points || 1
          }];
        } else {
          questionData.gradingCriteria = [];
        }
      }

      const question = await Question.create(questionData);
      createdQuestions[section].push(question._id);
    }

    // Use lock mechanism to prevent concurrent saves on the same exam
    const lockKey = exam._id.toString();
    let lockAcquired = false;
    
    try {
      // Try to acquire lock with exponential backoff
      for (let i = 0; i < 5; i++) {
        if (acquireLock(lockKey)) {
          lockAcquired = true;
          console.log(`Lock acquired for exam ${lockKey}`);
          break;
        }
        // Wait with exponential backoff: 50ms, 100ms, 200ms, 400ms, 800ms
        await new Promise(resolve => setTimeout(resolve, 50 * Math.pow(2, i)));
      }
      
      if (!lockAcquired) {
        console.log(`Failed to acquire lock for exam ${lockKey} after 5 attempts`);
        return res.status(429).json({ message: 'Another save operation is in progress. Please try again.' });
      }
      
      // Reload exam to get latest version
      exam = await Exam.findById(exam._id);
      
      // Re-apply exam fields in case they were lost during reload
      exam.title = title;
      exam.description = description || title;
      exam.timeLimit = timeLimit || 60;
      exam.passingScore = passingScore || 70;
      exam.totalPoints = totalMarks || questions.reduce((sum, q) => sum + (q.marks || q.points || 1), 0);
      
      // Update exam with question IDs organized by section
      exam.sections.forEach(section => {
        section.questions = createdQuestions[section.name] || [];
      });
      
      // Save with retry logic
      const saveResult = await saveWithRetry(exam, 3);
      if (!saveResult.success) {
        throw new Error('Failed to save exam after multiple retries');
      }
      
    } finally {
      // Always release the lock
      if (lockAcquired) {
        releaseLock(lockKey);
        console.log(`Lock released for exam ${lockKey}`);
      }
    }

    res.status(201).json({
      message: 'Draft saved successfully',
      examId: exam._id,
      exam: await Exam.findById(exam._id)
    });
  } catch (error) {
    console.error('Save draft error:', error);
    res.status(500).json({ message: error.message || 'Failed to save draft' });
  }
});

// Get user's draft exams
router.get('/drafts', auth, isAdminOrTeacher, async (req, res) => {
  try {
    const Exam = require('../models/Exam');
    const drafts = await Exam.find({ 
      createdBy: req.user._id, 
      status: 'draft' 
    }).sort({ createdAt: -1 });
    
    res.json(drafts);
  } catch (error) {
    console.error('Get drafts error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Upload reference material (exam, textbook, study guide) for AI to reference
router.post('/upload-reference', auth, isAdminOrTeacher, referenceUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const { path: cloudinaryUrl, originalname, mimetype, size } = req.file;
    const ext = path.extname(originalname).toLowerCase();
    
    console.log(`File uploaded to Cloudinary: ${cloudinaryUrl}`);
    console.log(`Processing file: ${originalname}, size: ${(size / 1024 / 1024).toFixed(2)}MB, type: ${mimetype}`);

    // Download file from Cloudinary for text extraction
    const axios = require('axios');
    let content = '';
    
    try {
      const response = await axios.get(cloudinaryUrl, { 
        responseType: 'arraybuffer',
        timeout: 30000 // 30 second timeout
      });
      const buffer = Buffer.from(response.data);
      
      // Parse file based on type
      if (ext === '.pdf') {
        const data = await pdf(buffer);
        content = data.text;
        console.log(`PDF extracted: ${content.length} characters`);
      } else if (ext === '.doc' || ext === '.docx') {
        const result = await mammoth.extractRawText({ buffer });
        content = result.value;
        console.log(`DOCX extracted: ${content.length} characters`);
      } else if (ext === '.txt') {
        content = buffer.toString('utf-8');
        console.log(`TXT extracted: ${content.length} characters`);
      } else {
        return res.status(400).json({ message: 'Unsupported file type' });
      }
    } catch (downloadError) {
      console.error('Error downloading/processing file from Cloudinary:', downloadError);
      return res.status(500).json({ message: 'Failed to process uploaded file from storage' });
    }

    // Clean up the content, but preserve line breaks - collapsing everything (including
    // newlines) to single spaces destroys the row/column layout of tables such as trial
    // balances, ledgers, and financial statements, making them impossible for the AI (or a
    // human) to reconstruct from the flattened text.
    content = content
      .replace(/[ \t]+/g, ' ')       // collapse runs of spaces/tabs within a line
      .replace(/\r\n/g, '\n')         // normalize line endings
      .replace(/[ \t]+\n/g, '\n')     // trim trailing spaces before newlines
      .replace(/\n{3,}/g, '\n\n')     // collapse excessive blank lines
      .trim();

    // Limit content size to avoid overwhelming the AI (increased to 100k for larger files)
    const maxContentLength = 100000; // 100k characters
    if (content.length > maxContentLength) {
      const originalLength = content.length;
      content = content.substring(0, maxContentLength) + '... (content truncated)';
      console.log(`Content truncated from ${originalLength} to ${maxContentLength} characters`);
    }

    res.json({
      success: true,
      content: content,
      filename: originalname,
      type: mimetype,
      size: size,
      contentLength: content.length,
      cloudinaryUrl: cloudinaryUrl // Return the Cloudinary URL for reference
    });
  } catch (error) {
    console.error('Error uploading reference file:', error);
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ message: 'File too large. Maximum size is 50MB.' });
    }
    if (error.message && error.message.includes('Unexpected end of form')) {
      return res.status(400).json({ message: 'Upload was interrupted. Please check your connection and try again.' });
    }
    res.status(500).json({ message: 'Failed to process file: ' + error.message });
  }
});

// AI exam generation route - requires Basic plan or higher
router.post('/ai-generate', auth, isAdminOrTeacher, requireAIFeatures, async (req, res) => {
  try {
    const { prompt = '', pastedExam, referenceContent } = req.body;
    const hasPastedExam = pastedExam && pastedExam.trim();
    const hasReferenceContent = referenceContent && referenceContent.trim();
    if (!prompt.trim() && !hasPastedExam && !hasReferenceContent) {
      return res.status(400).json({ message: 'Prompt is required' });
    }

    // Resolve the user's effective plan
    const { plan } = await resolveEffectivePlan(req.user);
    const limits = AI_PLAN_LIMITS[plan] || AI_PLAN_LIMITS.basic;

    let qtConfig;
    let examContext = '';

    // If pasted exam is provided, parse it to extract the actual questions
    if (pastedExam && pastedExam.trim()) {
      const parseExamPrompt = `You are extracting the FULL structure of a pasted exam including passages, instructions, word banks, examples, and ALL questions. PRESERVE EVERYTHING EXACTLY AS IT APPEARS - DO NOT CORRECT, RESTRUCTURE, OR MODIFY ANYTHING.

PASTED EXAM:
"${pastedExam.trim()}"

TEACHER INSTRUCTIONS: "${prompt.trim()}"

IMPORTANT: The pasted exam includes a TEACHER'S MARKING GUIDE at the end. You MUST extract ALL answers from this marking guide and include them in the correctAnswer field for each question.

CRITICAL - WORD BANK DETECTION:
- Look for word banks in the document (usually shown as a box of words at the top of the question or section)
- Word banks are typically displayed as: [word1, word2, word3, ...] or as a box with multiple words separated by spaces or commas
- Extract ALL words from the word bank into the "wordBank" array
- If a section has a word bank that applies to multiple questions, include it in the section-level wordBank and also in each individual fill-in-blank question
- Example format: "wordBank": ["sunny", "library", "singing", "playground", "rainy"]

CRITICAL - MULTI-PART QUESTIONS MUST BE SINGLE QUESTIONS:
- Questions with parts labeled a), b), c), i), ii), iii) MUST be extracted as ONE SINGLE question with subQuestions array
- DO NOT create separate questions for each part - they belong together as one question
- Example: "Question 7: The diagram shows... a) Why is... b) Explain why... c) Identify... d) State ONE..." is ONE question with 4 subquestions

Return ONLY a JSON object with this structure:
{
  "title": "exam title from pasted exam or based on instructions",
  "description": "exam description",
  "timeLimit": 60,
  "passingScore": 70,
  "sections": [
    {
      "name": "A",
      "title": "COMPREHENSION (20 Marks)",
      "description": "Read the passage carefully and answer the questions.",
      "passage": "The full passage text if present (e.g., My name is Keza...)",
      "subsections": [
        {
          "name": "A",
          "title": "Match the words with their meanings. (5 marks)",
          "wordBank": ["sunny", "library", "singing", "playground", "rainy"],
          "instructions": "Fill in the blanks using the correct words from the box.",
          "questions": [
            {
              "text": "We read books in the ____________.",
              "type": "fill-in-blank",
              "points": 2,
              "correctAnswer": "library"
            }
          ]
        }
      ],
      "questions": [
        {
          "text": "What is the name of the school?",
          "type": "short-answer",
          "points": 2,
          "correctAnswer": "Sunrise Primary School"
        },
        {
          "text": "There ____ many books in the library.",
          "type": "multiple-choice",
          "points": 1,
          "options": [
            {"text": "is", "isCorrect": false, "letter": "a"},
            {"text": "are", "isCorrect": true, "letter": "b"},
            {"text": "am", "isCorrect": false, "letter": "c"}
          ],
          "correctAnswer": "b"
        },
        {
          "text": "Match the words with their meanings",
          "type": "matching",
          "points": 5,
          "leftItems": ["Doctor", "School", "Market", "Library", "Farmer"],
          "rightItems": ["A person who treats sick people", "A place where children learn", "A place where people buy and sell things", "A place with books", "A person who grows crops"],
          "correctMatches": {"Doctor": 0, "School": 1, "Market": 2, "Library": 3, "Farmer": 4},
          "correctAnswer": "0-0, 1-1, 2-2, 3-3, 4-4"
        },
        {
          "questionNumber": 7,
          "text": "The diagram (Figure 3) represents electricity generation, transmission, and distribution.",
          "type": "open-ended",
          "points": 4,
          "subQuestions": [
            {
              "label": "a)",
              "text": "Why is the efficiency of a real transformer less than 100%?",
              "type": "open-ended",
              "points": 1,
              "correctAnswer": "Due to energy losses (heat, eddy currents, hysteresis)"
            },
            {
              "label": "b)",
              "text": "Explain why thicker electric wires are preferable for long-distance electricity transmission.",
              "type": "open-ended",
              "points": 1,
              "correctAnswer": "Thicker wires have lower resistance, reducing power loss"
            },
            {
              "label": "c)",
              "text": "Identify the type of transformers on the poles shown in Figure 3.",
              "type": "open-ended",
              "points": 1,
              "correctAnswer": "Step-down transformer"
            },
            {
              "label": "d)",
              "text": "State ONE reason why electricity is very important at home.",
              "type": "open-ended",
              "points": 1,
              "correctAnswer": "For lighting, cooking, powering appliances, etc."
            }
          ],
          "correctAnswer": "a) Due to energy losses b) Thicker wires reduce resistance c) Step-down transformer d) For lighting/cooking"
        },
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
              "points": 1,
              "options": [
                {"letter": "i", "text": "No matter", "isCorrect": true},
                {"letter": "ii", "text": "As much as", "isCorrect": false},
                {"letter": "iii", "text": "Nonetheless", "isCorrect": false},
                {"letter": "iv", "text": "Although", "isCorrect": false},
                {"letter": "v", "text": "As though", "isCorrect": false}
              ],
              "correctAnswer": "i"
            },
            {
              "label": "b)",
              "text": "He consistently refused to take his medicine and _____ his illness has gotten worse.",
              "type": "multiple-choice",
              "points": 1,
              "options": [
                {"letter": "i", "text": "otherwise", "isCorrect": false},
                {"letter": "ii", "text": "on the other hand", "isCorrect": false},
                {"letter": "iii", "text": "unless", "isCorrect": false},
                {"letter": "iv", "text": "as long as", "isCorrect": false},
                {"letter": "v", "text": "consequently", "isCorrect": true}
              ],
              "correctAnswer": "v"
            },
            {
              "label": "c)",
              "text": "When Sir Richard Burton set out on his pilgrimage to Mecca in 1854, no one knew _____ he would return alive.",
              "type": "multiple-choice",
              "points": 1,
              "options": [
                {"letter": "i", "text": "unless", "isCorrect": false},
                {"letter": "ii", "text": "whether", "isCorrect": true},
                {"letter": "iii", "text": "in case", "isCorrect": false},
                {"letter": "iv", "text": "however", "isCorrect": false},
                {"letter": "v", "text": "until", "isCorrect": false}
              ],
              "correctAnswer": "ii"
            },
            {
              "label": "d)",
              "text": "On the other hand, I have never understood _____ people have to rely on the leisure industry, instead of using their imaginations.",
              "type": "multiple-choice",
              "points": 1,
              "options": [
                {"letter": "i", "text": "why", "isCorrect": true},
                {"letter": "ii", "text": "how", "isCorrect": false},
                {"letter": "iii", "text": "when", "isCorrect": false},
                {"letter": "iv", "text": "where", "isCorrect": false}
              ],
              "correctAnswer": "i"
            }
          ],
          "correctAnswer": "a) i) No matter; b) v) consequently; c) ii) whether; d) i) why"
        },
        {
          "questionNumber": 15,
          "text": "Choose ONE of the following questions and write a detailed essay. (20 marks)",
          "type": "open-ended",
          "points": 20,
          "subQuestionConfig": { "mode": "choose-n", "requiredCount": 1, "scoringType": "partial" },
          "subQuestions": [
            {
              "label": "a)",
              "text": "Discuss the causes and consequences of World War I in detail.",
              "type": "essay",
              "points": 20,
              "correctAnswer": "A comprehensive essay covering: militarism, alliances, imperialism, nationalism as causes; and political, economic, social consequences including Treaty of Versailles and League of Nations."
            },
            {
              "label": "b)",
              "text": "Analyze the effects of the Industrial Revolution on European society.",
              "type": "essay",
              "points": 20,
              "correctAnswer": "Detailed analysis of: urbanization, working class conditions, technological innovations, economic changes, social reforms, environmental impacts, and long-term societal transformations."
            },
            {
              "label": "c)",
              "text": "Evaluate the impact of colonialism on African nations.",
              "type": "essay",
              "points": 20,
              "correctAnswer": "Critical evaluation of: resource extraction, cultural disruption, political boundaries drawn by Europeans, economic dependency, resistance movements, and post-colonial challenges."
            }
          ],
          "correctAnswer": "Student chooses ONE of a), b), or c) and receives marks for their chosen essay"
        },
        {
          "questionNumber": 16,
          "text": "Answer any TWO of the following questions. Each question carries 5 marks.",
          "type": "short-answer",
          "points": 10,
          "subQuestionConfig": { "mode": "choose-n", "requiredCount": 2, "scoringType": "partial" },
          "subQuestions": [
            {
              "label": "a)",
              "text": "Define photosynthesis and state its importance.",
              "type": "short-answer",
              "points": 5,
              "correctAnswer": "Photosynthesis is the process by which plants convert light energy into chemical energy (glucose). Importance: produces oxygen, forms base of food chain, removes CO2 from atmosphere."
            },
            {
              "label": "b)",
              "text": "Explain the water cycle in brief.",
              "type": "short-answer",
              "points": 5,
              "correctAnswer": "Water cycle involves evaporation (water turns to vapor), condensation (forms clouds), precipitation (rain/snow), and collection (in oceans, lakes, groundwater)."
            },
            {
              "label": "c)",
              "text": "What are the states of matter? Give examples.",
              "type": "short-answer",
              "points": 5,
              "correctAnswer": "Solid (ice, rock), Liquid (water, oil), Gas (oxygen, CO2), Plasma (lightning, stars)."
            },
            {
              "label": "d)",
              "text": "Describe the human digestive system.",
              "type": "short-answer",
              "points": 5,
              "correctAnswer": "Mouth (chewing), esophagus (swallowing), stomach (acid digestion), small intestine (nutrient absorption), large intestine (water absorption), rectum (waste elimination)."
            }
          ],
          "correctAnswer": "Student answers any 2 of the 4 questions, earns 5 marks for each correct answer"
        },
        {
          "questionNumber": 1,
          "text": "Prepare: (i) Income statement for the year ended 30 September 2012 (17 marks); (ii) Balance sheet as at 30 September 2012 (13 marks)",
          "type": "financial-spreadsheet",
          "passage": "Trial balance as at 30 September 2012:\\n| Account | Frw (Dr) | Frw (Cr) |\\n|---|---|---|\\n| Sales | | 5,400,000 |\\n| Purchases | 2,826,000 | |\\n| Capital | | 3,060,000 |\\n\\nAdditional notes:\\n1. The closing inventory cost and net realizable amount was Frw 910,000 and Frw 890,000 respectively.\\n2. Bank interest income accrued Frw 80,000 was only shown in the bank statement.",
          "points": 30,
          "spreadsheetTemplate": "{\"tables\":[{\"title\":\"Income Statement\",\"headers\":[\"Item\",\"Frw\"],\"data\":[[\"Sales\",\"\"],[\"Cost of Sales\",\"\"],[\"Gross Profit\",\"\"],[\"Net Profit\",\"\"]]},{\"title\":\"Balance Sheet\",\"headers\":[\"Item\",\"Frw\"],\"data\":[[\"Total Assets\",\"\"],[\"Total Liabilities and Capital\",\"\"]]}]}",
          "spreadsheetModelAnswer": "{\"tables\":[{\"title\":\"Income Statement\",\"headers\":[\"Item\",\"Frw\"],\"data\":[[\"Sales\",\"5,400,000\"],[\"Cost of Sales\",\"2,762,000\"],[\"Gross Profit\",\"2,638,000\"],[\"Net Profit\",\"1,222,000\"]]},{\"title\":\"Balance Sheet\",\"headers\":[\"Item\",\"Frw\"],\"data\":[[\"Total Assets\",\"3,480,000\"],[\"Total Liabilities and Capital\",\"3,480,000\"]]}]}",
          "correctAnswer": "See spreadsheetModelAnswer for the completed Income Statement and Balance Sheet."
        }
      ]
    }
  ]
}

CRITICAL - TABLES AND FINANCIAL DATA IN PASTED EXAMS (trial balances, ledgers, account balance lists):
- The pasted text may include a trial balance or list of account balances, often laid out as two right-aligned columns of Dr/Cr figures. Reproduce this GIVEN data faithfully as a Markdown table in the question's "passage" field (with "|" column separators and a header separator row) - there is no separate "context" field, "passage" is what is actually saved and shown to the student - preserving every account name and figure exactly, including the totals row - never drop, merge, paraphrase, or reorder rows.
- Numbered adjustment/additional-information notes that follow a trial balance (e.g. "1. The closing inventory...", "2. Bank interest income accrued...") belong in that same question's "passage" field, in full and in order, immediately after the table.
- When a question instructs the student to PREPARE, DRAFT, or PRODUCE a financial statement or schedule (income statement, balance sheet/statement of financial position, cash flow statement, statement of changes in equity, ledger, bank reconciliation statement, adjusted cash book, trial balance, ratio analysis, budget), set "type": "financial-spreadsheet" per the CRITICAL FOR FINANCIAL-SPREADSHEET QUESTIONS rules below - this applies even when it is phrased as multiple lettered/numbered required outputs each with their own mark allocation (e.g. "(i) Income statement (17 marks) (ii) Balance sheet (13 marks)"); put ONE table per required statement in the SAME tables array of the SAME question rather than splitting into separate questions, and set the question's total points to the sum (or the printed "Total" marks if shown).
- Compute spreadsheetModelAnswer by actually working through the trial balance and adjustment notes using standard accounting rules (accruals, prepayments, depreciation, allowance for doubtful debts, closing inventory at the lower of cost and net realizable value, etc.) - do not leave it blank or copy the template.

CRITICAL RULES - PRESERVE EXACT STRUCTURE:
- PRESERVE the full exam structure EXACTLY as it appears - DO NOT CORRECT OR MODIFY ANYTHING
- Extract passages (like comprehension passages) into the "passage" field EXACTLY as written
- Extract section titles with marks (e.g., "COMPREHENSION (20 Marks)") EXACTLY as written
- Extract subsections (A, B, C within a section) with their own titles and instructions EXACTLY as written
- Extract word banks/boxes into the "wordBank" array EXACTLY as listed
- Extract examples into the "examples" array if present EXACTLY as written
- Extract ALL questions as individual items EXACTLY as they appear
- QUESTION TYPE DETECTION RULES:
  - **Matching questions**: Identify by keywords like "Match", "match the", "match each", "pair the", "connect", "link", or when there are two columns of items to be paired. Set type to "matching" and include leftItems and rightItems arrays. CRITICAL: leftItems and rightItems MUST be actual JSON arrays, NOT stringified arrays.
  - **Multiple-choice**: Identify by options (a, b, c, d) or lettered choices. Set type to "multiple-choice".
  - **True-false**: Identify by True/False options. Set type to "true-false".
  - **Fill-in-blank**: Identify by blanks (_____, ....) or "fill in". Set type to "fill-in-blank".
  - **Short-answer**: Brief factual questions requiring 1-2 sentence answers. Set type to "short-answer".
  - **Open-ended/Essay**: Questions requiring detailed explanations or longer answers. Set type to "open-ended".
  - **Financial-spreadsheet**: Questions where students must complete an income statement, balance sheet, cash flow statement, statement of changes in equity, or other financial spreadsheet. Set type to "financial-spreadsheet". Include spreadsheetTemplate and spreadsheetModelAnswer as JSON strings of shape {"tables":[{"title":"Income Statement","headers":[...],"data":[[...]]}]} - one entry in "tables" per statement the question asks the student to prepare. If a single question asks for MULTIPLE statements (e.g. "Prepare Both an Income Statement and a Balance Sheet"), put ONE table per statement in the same tables array rather than splitting into separate questions.
- **MULTI-PART QUESTIONS (CRITICAL)**:
  - Questions with parts a), b), c), i), ii), iii) MUST be ONE question with subQuestions array
  - Each subquestion gets: label (e.g., "a)", "b)", "i)"), text, type, points, correctAnswer
  - The main question's points = sum of all subquestion points
  - The main question's correctAnswer = combined answers of all subquestions
  - Example: A 4-part question with (1 mark) each becomes ONE question with points:4 and 4 subQuestions
  - **DISTINGUISH REGULAR MCQ FROM SUB-QUESTION MCQ**:
    - REGULAR MCQ: Single question with options labeled A, B, C, D → type: "multiple-choice", options array at question level, NO subQuestions
    - SUB-QUESTION MCQ: Only when question has parts labeled a), b), c) and EACH part has options i, ii, iii, iv → subQuestions array with MCQ type inside
    - CRITICAL: Regular MCQs like "1. What is 2+2? A) 3 B) 4 C) 5 D) 6" are NOT sub-questions - they are standalone multiple-choice
    - Example standalone MCQ: { text: "What is 2+2?", type: "multiple-choice", options: [{letter:"A", text:"3"}, {letter:"B", text:"4", isCorrect:true}] }
    - Example sub-question MCQ: { text: "Choose the best option...", subQuestions: [{label:"a)", text:"_____ how hard...", type:"multiple-choice", options:[{letter:"i", text:"No matter"}]}] }
  - **MCQ SUBQUESTIONS**: ONLY when the question has multi-part structure (a, b, c). Subquestions can be multiple-choice with their own options array (i, ii, iii, iv, v). Mark correct option with isCorrect: true.
  - **MIXED TYPES**: A question can have subquestions of different types (e.g., a) MCQ, b) open-ended, c) MCQ)
  - **CHOOSE N DETECTION**: Look for phrases like "Choose ONE", "Select ONE", "Answer ONE", "Answer any ONE", "Choose TWO", "Answer any 3"
    - Extract the number N from the phrase
    - Set "subQuestionConfig": { "mode": "choose-n", "requiredCount": N, "scoringType": "partial" }
    - Student picks N sub-questions to answer and each is graded independently
    - Example: "Answer any TWO" → requiredCount: 2, "Choose ONE" → requiredCount: 1
    - scoringType "partial" means each correct answer earns its marks (default)
    - scoringType "all-or-nothing" means all selected must be correct for any marks (use sparingly)
- **subQuestionConfig FIELD**: Always include this for multi-part questions:
    - "all" mode: student answers ALL sub-questions (default)
    - "choose-n" mode: student selects N sub-questions to answer
    - requiredCount: number of questions to select (1, 2, 3, etc.)
    - scoringType: "partial" (independent grading) or "all-or-nothing" (strict)
- For matching exercises: 
  - CRITICAL: PRESERVE THE EXACT leftItems AND rightItems ARRAYS EXACTLY AS THEY APPEAR
  - If the pasted exam has a matching question with leftItems and rightItems, copy them EXACTLY without modification
  - DO NOT restructure, reorganize, or interpret matching items differently
  - If matching items are listed as separate questions (1a, 1b, 1c, etc.), keep them as separate questions with their exact text
  - DO NOT consolidate separate matching items into one question unless they are already structured that way in the pasted exam
  - The leftItems array should contain the left column items EXACTLY as listed
  - The rightItems array should contain the right column items EXACTLY as listed
  - Extract correctMatches from the marking guide if available
- For fill-in-blank: each blank is a separate question with type "fill-in-blank". Extract the exact word from the marking guide as correctAnswer.
- For grammar exercises: each sentence/item is a separate question. Extract the model answer from the marking guide as correctAnswer.
- For multiple-choice: each MCQ is a separate question. Mark the correct option with isCorrect: true and set correctAnswer to the letter (e.g., "b").
- Extract the exact text from the pasted exam - DO NOT CORRECT GRAMMAR OR SPELLING
- CRITICAL: Use the TEACHER'S MARKING GUIDE to find ALL correct answers. The marking guide is at the end of the pasted exam.
- For short-answer questions: extract the exact answer from the marking guide
- For open-ended questions: extract the model answer or key points from the marking guide
- Supported types: multiple-choice, true-false, short-answer, open-ended, fill-in-blank, matching, ordering, financial-spreadsheet
- If a question requires students to complete a financial table (income statement, balance sheet, cash flow, statement of changes in equity, ledger), set type to "financial-spreadsheet" and include spreadsheetTemplate and spreadsheetModelAnswer fields as JSON strings of shape {"tables":[{"title":"Income Statement","headers":["Item","Amount (RWF)"],"data":[["Sales Revenue","25000000"],["Net Profit","5800000"]]}]} - one table per statement required. If one question asks for MULTIPLE statements (e.g. "Prepare both the Income Statement and the Statement of Financial Position"), add one entry per statement to the SAME tables array instead of creating separate questions
- If a section has subsections (A, B, C), use the "subsections" array
- If a section has no subsections, put questions directly in "questions" array
- Keep the hierarchical structure intact - this is a professional exam format
- EVERY question MUST have a correctAnswer field populated from the marking guide
- DO NOT RESTRUCTURE OR CONSOLIDATE QUESTIONS - EXCEPT for multi-part questions which MUST be consolidated into ONE question with subQuestions
- DO NOT CONFUSE REGULAR MCQ WITH SUB-QUESTION MCQ:
  - Standalone MCQs with options A, B, C, D stay as regular "multiple-choice" questions
  - Only questions with parts a), b), c) that each have sub-options (i, ii, iii) become sub-questions
  - When in doubt: If it has "Question X" followed by a single stem and A/B/C/D options, it's a REGULAR MCQ
  - If it has "Question X" followed by a)..., b)..., c)... where each has multiple options, it's SUB-QUESTIONS
- ABSOLUTELY DO NOT INTERPRET OR REORGANIZE MATCHING QUESTIONS - COPY leftItems AND rightItems EXACTLY AS PROVIDED`;

      try {
        const parseResponse = await groqClient.generateContent(parseExamPrompt, {
          model: 'smart',
          jsonMode: true,
          temperature: 0.1,
          maxTokens: 16384
        });
        
        let parseText = parseResponse.text || '';
        parseText = parseText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
        
        console.log('Parsed exam text length:', parseText.length);
        
        const parsed = JSON.parse(parseText);
        console.log('Parsed exam structure:', JSON.stringify(parsed, null, 2).substring(0, 500));
        
        // Sanitize all array fields in the parsed exam to handle stringified arrays from AI
        const sanitizeParsedExam = (obj) => {
          if (!obj || typeof obj !== 'object') return obj;
          
          for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
              const value = obj[key];
              
              if (Array.isArray(value)) {
                // Check if array contains a single string that is actually a stringified array
                if (value.length === 1 && typeof value[0] === 'string' && value[0].startsWith('[')) {
                  try {
                    const parsed = JSON.parse(value[0]);
                    if (Array.isArray(parsed)) {
                      obj[key] = parsed;
                    }
                  } catch {
                    // If parsing fails, keep original
                  }
                }
              } else if (typeof value === 'string' && value.startsWith('[')) {
                // Parse stringified arrays
                try {
                  const parsed = JSON.parse(value);
                  if (Array.isArray(parsed)) {
                    obj[key] = parsed;
                  }
                } catch {
                  // If parsing fails, keep original
                }
              } else if (typeof value === 'object' && value !== null) {
                // Recursively sanitize nested objects
                sanitizeParsedExam(value);
              }
            }
          }
          return obj;
        };
        
        sanitizeParsedExam(parsed);
        console.log('Sanitized parsed exam structure');
        
        // Extract question types from the parsed exam for plan limits
        const extractedTypes = {};
        if (parsed.sections) {
          parsed.sections.forEach(section => {
            if (section.questions) {
              section.questions.forEach(q => {
                const type = q.type || 'multiple-choice';
                extractedTypes[type] = (extractedTypes[type] || 0) + 1;
              });
            }
          });
        }
        
        qtConfig = Object.entries(extractedTypes).map(([type, count]) => ({
          type,
          count,
          label: type.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())
        }));
        
        if (qtConfig.length === 0) {
          qtConfig = [{ type: 'multiple-choice', count: 10, label: 'Multiple Choice' }];
        }
        
        console.log('Extracted question types:', qtConfig);

        // Keep correctAnswer in sync with the model answer, matching the convention used by the
        // manual question editor and the "describe" AI flow. normalizeSpreadsheetField (module
        // scope, above) handles the object->string and shape coercion.
        const normalizeSpreadsheetQuestion = (q) => {
          if (!q || q.type !== 'financial-spreadsheet') return q;
          if (q.spreadsheetTemplate) {
            q.spreadsheetTemplate = normalizeSpreadsheetField(q.spreadsheetTemplate);
          }
          if (q.spreadsheetModelAnswer) {
            q.spreadsheetModelAnswer = normalizeSpreadsheetField(q.spreadsheetModelAnswer);
            q.correctAnswer = q.spreadsheetModelAnswer;
          }
          return q;
        };

        // Flatten questions from sections and subsections into top-level questions array for frontend compatibility
        const flattenedQuestions = [];
        if (parsed.sections) {
          parsed.sections.forEach(section => {
            // Add questions directly in the section
            if (section.questions) {
              section.questions.forEach(q => {
                flattenedQuestions.push({
                  ...normalizeSpreadsheetQuestion(q),
                  section: section.name || 'A',
                  sectionTitle: section.title || '',
                  passage: section.passage || null
                });
              });
            }
            // Add questions from subsections
            if (section.subsections) {
              section.subsections.forEach(subsection => {
                if (subsection.questions) {
                  subsection.questions.forEach(q => {
                    flattenedQuestions.push({
                      ...normalizeSpreadsheetQuestion(q),
                      section: section.name || 'A',
                      subsection: subsection.name || '',
                      subsectionTitle: subsection.title || '',
                      instructions: subsection.instructions || '',
                      wordBank: subsection.wordBank || null,
                      passage: section.passage || null
                    });
                  });
                }
              });
            }
          });
        }

        console.log('Flattened questions count:', flattenedQuestions.length);
        
        // Return the parsed exam with flattened questions and full structure preserved
        return res.json({
          ...parsed,
          questions: flattenedQuestions
        });
      } catch (parseError) {
        console.error('Failed to parse pasted exam:', parseError);
        console.error('Parse error details:', parseError.message);
        return res.status(500).json({ message: 'Failed to parse the pasted exam. Please check the format and try again.' });
      }
    } else {
      // If reference content is provided, include it in the prompt context
      if (referenceContent && referenceContent.trim()) {
        examContext = `\n\nREFERENCE MATERIAL:\n${referenceContent.trim()}`;
      }

      // Parse question types and counts from the prompt using AI
      const parsePrompt = `Analyze this exam request and extract the question types and counts: "${prompt.trim()}"

${referenceContent && referenceContent.trim() ? `The user has provided reference material. IMPORTANT: If they specify question counts in the prompt, use EXACTLY those counts - do not change them based on the reference material. Only create a comprehensive structure if they DON'T specify counts.` : ''}

Return ONLY a JSON object with this structure:
{
  "questionTypes": [
    {"type": "multiple-choice", "count": 10, "label": "Multiple Choice"},
    {"type": "short-answer", "count": 5, "label": "Short Answer"}
  ],
  "totalQuestions": 15,
  "subject": "extracted subject",
  "gradeLevel": "extracted grade level"
}

CRITICAL RULES:
- If the user specifies question types and counts (e.g., "20 multiple-choice, 10 short-answer"), use EXACTLY those numbers - do not change them
- If the user specifies a total (e.g., "50 questions"), distribute appropriately but ensure total equals that number
- If only total questions is given without types, default to multiple-choice
- If no count is specified and no reference material, default to 10 multiple-choice questions
- If no count is specified but reference material is provided, create a comprehensive structure (30-50 questions total)
- Supported types: multiple-choice, true-false, short-answer, open-ended, fill-in-blank, matching, ordering, financial-spreadsheet
- IMPORTANT: Use "open-ended" for open/essay questions, NOT "open"
- Use "financial-spreadsheet" ONLY when the teacher explicitly asks for a financial statement or spreadsheet question
- Be accurate - only extract what is explicitly stated in the prompt
- NEVER modify the user's specified counts`;

      try {
        const parseResponse = await groqClient.generateContent(parsePrompt, {
          model: 'smart',
          jsonMode: true,
          temperature: 0.1,
          maxTokens: 1024
        });

        let parseText = parseResponse.text || '';
        parseText = parseText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

        const parsed = JSON.parse(parseText);
        qtConfig = parsed.questionTypes || [{ type: 'multiple-choice', count: 10, label: 'Multiple Choice' }];

        // Normalize question types (e.g., "open" -> "open-ended")
        qtConfig = qtConfig.map(qt => ({
          ...qt,
          type: mapQuestionType(qt.type)
        }));
      } catch (parseError) {
        console.error('Failed to parse question types from prompt, using defaults:', parseError);
        qtConfig = [{ type: 'multiple-choice', count: 10, label: 'Multiple Choice' }];
      }
    }

    // Enforce per-type and total caps based on plan (only if user didn't specify exact counts)
    // If user specified exact counts in prompt, respect them completely
    const userSpecifiedCounts = prompt.match(/\d+\s*(questions|items|qs)/gi) ||
                                 prompt.match(/(\d+)\s*(multiple-choice|true-false|short-answer|open-ended|fill-in-blank|matching|ordering)/gi) ||
                                 prompt.match(/(\d+)\s*(mcq|mc|tf|sa|oe|fib)/gi) ||
                                 prompt.match(/(\d+)\s*of/gi);

    console.log('User prompt:', prompt);
    console.log('User specified counts pattern match:', userSpecifiedCounts);
    console.log('Parsed qtConfig before limits:', JSON.stringify(qtConfig, null, 2));

    // Skip plan limits entirely if user specified counts
    if (!userSpecifiedCounts) {
      // Only apply limits if user didn't specify exact counts
      console.log('No user-specified counts, applying plan limits');
      qtConfig = qtConfig.map(qt => ({
        ...qt,
        count: Math.min(qt.count || 1, limits.maxPerType),
      }));
      const totalRequested = qtConfig.reduce((s, qt) => s + qt.count, 0);
      if (totalRequested > limits.maxQuestions) {
        const scale = limits.maxQuestions / totalRequested;
        qtConfig = qtConfig.map(qt => ({ ...qt, count: Math.max(1, Math.round(qt.count * scale)) }));
      }
    } else {
      console.log('User specified exact counts, SKIPPING plan limits completely');
      // Don't apply any limits - use exactly what the AI parsed
    }

    console.log('Final qtConfig after limits:', JSON.stringify(qtConfig, null, 2));

    const sectionsTemplate = buildSectionsInstruction(qtConfig);

    // Build detailed count instructions
    const countInstructions = qtConfig.map(qt =>
      `- Section ${String.fromCharCode(65 + qtConfig.indexOf(qt))}: EXACTLY ${qt.count} questions of type "${qt.type}" (${qt.label})`
    ).join('\n  ');

    const systemPrompt = `You are an expert exam creator for students in Rwanda with deep knowledge of the Rwandan curriculum and educational standards. Generate exam JSON based on the teacher's request: "${examContext}${prompt.trim()}"

${pastedExam && pastedExam.trim() ? `REFERENCE EXAM STRUCTURE: The teacher has provided a pasted exam. Create a NEW exam with the SAME structure (question types, counts, sections) but with DIFFERENT questions on the same or related topic. Do not copy the exact questions from the pasted exam - create fresh, original questions following the same format and difficulty level.` : ''}

${referenceContent && referenceContent.trim() ? `REFERENCE MATERIAL: The teacher has provided reference material (exam, textbook, or study guide). 
IMPORTANT: 
1. ANALYZE the reference material to detect the subject (e.g., English, Mathematics, Science, Social Studies, Kinyarwanda, etc.)
2. Create a PROFESSIONAL exam structure appropriate for that subject
3. Generate a COMPREHENSIVE exam with multiple sections covering different topics from the reference
4. Include a variety of question types appropriate for the subject
5. Create NEW questions based on this material - do not copy exact text from the reference
6. Ensure the exam covers the main concepts, topics, and learning objectives from the reference material
7. The exam should be thorough and comprehensive, testing understanding of the entire reference material` : ''}

PROFESSIONAL EXAM STRUCTURE GUIDELINES:
- A professional exam should have 3-5 sections covering different topics or question types
- Each section should have 8-15 questions (total 30-50 questions for a comprehensive exam)
- Include a mix of question types: multiple-choice, true-false, short-answer, fill-in-blank, matching, and open-ended
- Sections should be organized by topic or skill being tested
- Include clear instructions for each section
- Questions should progress from basic recall to higher-order thinking (analysis, application)
- Include appropriate difficulty distribution: 30% easy, 50% medium, 20% challenging
- For language subjects (English, Kinyarwanda): Include grammar, vocabulary, reading comprehension, and writing sections
- For mathematics: Include computational, conceptual, and problem-solving questions
- For science: Include knowledge recall, application, and analysis questions
- For social studies: Include factual recall, interpretation, and critical thinking questions

CRITICAL REQUIREMENTS:
1. Generate EXACTLY the following number of questions per section:
  ${countInstructions}
2. DO NOT change the question counts - the user has specified these exact numbers
3. DO NOT change the question types - each section MUST use the specified question type
4. Return ONLY valid JSON, no markdown, no explanations outside JSON
5. Follow the exact format specified below
6. Create a comprehensive exam that thoroughly tests the reference material
7. Ensure all major topics from the reference are covered in the exam
8. If the total questions generated don't match the specified counts, the exam is INVALID
9. If any question type doesn't match the section specification, the exam is INVALID
10. You MUST generate ALL sections specified in the sections array - do not skip any sections
11. DO NOT repeat the same question across different sections - each question must be unique
12. DO NOT use the same question text with different question types - create genuinely different questions

QUESTION TYPE ENFORCEMENT:
- Section A MUST contain ONLY multiple-choice questions
- Section B MUST contain ONLY short-answer questions
- Section C MUST contain ONLY open-ended questions
- Each question MUST have a "type" field that matches its section's type
- Do NOT mix question types within a section
- ALL sections must be present in the response
- Each question must be unique - no duplicates across sections

ANTI-HALLUCINATION AND ACCURACY RULES:
6. NEVER HALLUCINATE - Only use facts, dates, names, and information you are certain about
7. If you are uncertain about any fact, date, statistic, or name, either:
   - Omit that specific detail and use a general formulation instead
   - Use a well-known, universally accepted example
   - Explicitly state it as a hypothetical scenario
8. Verify all factual information before including it in questions
9. For Rwanda-specific content, use accurate information about:
   - Rwanda's geography (provinces, districts, landmarks)
   - Rwanda's history (key dates, events, figures)
   - Rwanda's culture and traditions
   - The Rwandan education system and curriculum
10. For science and mathematics, use accurate formulas, constants, and principles
11. For literature and arts, use well-known, established works and authors
12. Ensure questions are age-appropriate for the specified grade level
13. Avoid obscure, controversial, or ambiguous facts that could confuse students
14. Use clear, unambiguous language in all questions
15. Ensure all answer options (for multiple-choice) are plausible but only one is clearly correct
16. For open-ended questions, provide comprehensive model answers that cover key concepts

QUALITY STANDARDS:
17. Each question must test a specific learning objective or skill
18. Questions should progress from easier to more difficult within each section
19. Include a mix of recall, understanding, application, and analysis questions where appropriate
20. Ensure questions are free from cultural bias and are inclusive
21. The exam should be comprehensive and cover the reference material thoroughly

Return raw JSON:
{
  "title": "Exam title based on the prompt",
  "description": "Brief description based on the prompt",
  "timeLimit": 60,
  "passingScore": 70,
  "sections": [
  ${sectionsTemplate}
  ]
}

QUESTION FORMAT RULES:
- correctAnswer for multiple-choice: string letter (e.g., "A")
- correctAnswer for true-false: string "True" or "False"
- correctAnswer for fill-in-blank: string answer
- correctAnswer for short-answer: string answer
- correctAnswer for open-ended/essay: comprehensive string answer
- correctAnswer for matching: MUST be a string (use explanation). Put the actual pairs in matchingPairs.correctPairs as array of objects [{left: string, right: string}]
- correctAnswer for ordering: MUST be a string (use explanation). Put the actual order in itemsToOrder.correctOrder as array of numbers [0, 1, 2, 3]
- options for multiple-choice/true-false: array of objects [{text, isCorrect, letter}]
- gradingCriteria for open-ended: array of objects [{criteria: string, points: number}]
- leftItems/rightItems for matching: array of strings
- items for ordering: array of strings

CRITICAL FOR MATCHING QUESTIONS:
{
  "type": "matching",
  "text": "Match the items",
  "leftItems": ["Item 1", "Item 2"],
  "rightItems": ["Match 1", "Match 2"],
  "matchingPairs": {
    "leftColumn": ["Item 1", "Item 2"],
    "rightColumn": ["Match 1", "Match 2"],
    "correctPairs": [{"left": "Item 1", "right": "Match 1"}, {"left": "Item 2", "right": "Match 2"}]
  },
  "correctAnswer": "Explanation of the matches",
  "explanation": "Detailed explanation"
}

CRITICAL FOR ORDERING QUESTIONS:
{
  "type": "ordering",
  "text": "Order these items",
  "items": ["Item 1", "Item 2", "Item 3"],
  "itemsToOrder": {
    "items": ["Item 1", "Item 2", "Item 3"],
    "correctOrder": [0, 1, 2]
  },
  "correctAnswer": "Explanation of the correct order",
  "explanation": "Detailed explanation"
}

CRITICAL FOR FINANCIAL-SPREADSHEET QUESTIONS:
Every spreadsheetTemplate / spreadsheetModelAnswer is a JSON string of shape
{"tables":[{"title":string,"headers":[...],"data":[[...]]}, ...]} — a list of ONE OR MORE
named statement tables. Use exactly one entry in "tables" per financial statement the question
asks the student to prepare. Most questions need only one table.

Single-statement example (question asks for ONE statement):
{
  "type": "financial-spreadsheet",
  "text": "Prepare the Income Statement for ABC Traders for the year ended 31 December 2025.",
  "marks": 20,
  "spreadsheetTemplate": "{\"tables\":[{\"title\":\"Income Statement\",\"headers\":[\"Item\",\"Amount (RWF)\"],\"data\":[[\"Sales Revenue\",\"\"],[\"Less: Cost of Goods Sold\",\"\"],[\"Gross Profit\",\"=B2-B3\"],[\"Salaries Expense\",\"\"],[\"Rent Expense\",\"\"],[\"Net Profit\",\"\"]]}]}",
  "spreadsheetModelAnswer": "{\"tables\":[{\"title\":\"Income Statement\",\"headers\":[\"Item\",\"Amount (RWF)\"],\"data\":[[\"Sales Revenue\",\"25000000\"],[\"Less: Cost of Goods Sold\",\"(15000000)\"],[\"Gross Profit\",\"10000000\"],[\"Salaries Expense\",\"(2500000)\"],[\"Rent Expense\",\"(1200000)\"],[\"Net Profit\",\"5800000\"]]}]}",
  "correctAnswer": "See spreadsheetModelAnswer for completed financial statement.",
  "gradingCriteria": [
    {"criteria": "Correct Sales Revenue figure", "points": 2},
    {"criteria": "Correct Gross Profit calculation", "points": 4},
    {"criteria": "Correct Net Profit calculation", "points": 4}
  ]
}

Multi-statement example (question explicitly asks for MORE THAN ONE statement in the SAME
question, e.g. "Prepare Both an Income Statement and a Balance Sheet" — put one table per
statement in the SAME tables array, do NOT split this into separate questions):
{
  "type": "financial-spreadsheet",
  "text": "Prepare the Income Statement and the Statement of Financial Position for Delta Enterprises for the year ended 31 December 2025.",
  "marks": 20,
  "spreadsheetTemplate": "{\"tables\":[{\"title\":\"Income Statement\",\"headers\":[\"Item\",\"Amount (RWF)\"],\"data\":[[\"Sales Revenue\",\"\"],[\"Less: Cost of Goods Sold\",\"\"],[\"Gross Profit\",\"\"],[\"Net Profit\",\"\"]]},{\"title\":\"Statement of Financial Position\",\"headers\":[\"Item\",\"Amount (RWF)\"],\"data\":[[\"Cash\",\"\"],[\"Inventory\",\"\"],[\"Equipment\",\"\"],[\"Total Assets\",\"\"],[\"Accounts Payable\",\"\"],[\"Owner's Capital\",\"\"],[\"Total Liabilities & Equity\",\"\"]]}]}",
  "spreadsheetModelAnswer": "{\"tables\":[{\"title\":\"Income Statement\",\"headers\":[\"Item\",\"Amount (RWF)\"],\"data\":[[\"Sales Revenue\",\"40000000\"],[\"Less: Cost of Goods Sold\",\"(24000000)\"],[\"Gross Profit\",\"16000000\"],[\"Net Profit\",\"9000000\"]]},{\"title\":\"Statement of Financial Position\",\"headers\":[\"Item\",\"Amount (RWF)\"],\"data\":[[\"Cash\",\"3500000\"],[\"Inventory\",\"5000000\"],[\"Equipment\",\"10000000\"],[\"Total Assets\",\"18500000\"],[\"Accounts Payable\",\"4000000\"],[\"Owner's Capital\",\"14500000\"],[\"Total Liabilities & Equity\",\"18500000\"]]}]}",
  "correctAnswer": "See spreadsheetModelAnswer for completed financial statements.",
  "gradingCriteria": [
    {"criteria": "Correct Income Statement figures", "points": 10},
    {"criteria": "Correct Statement of Financial Position figures", "points": 10}
  ]
}

- spreadsheetTemplate: JSON string with {"tables":[{title, headers:[], data:[][]}, ...]} — pre-fill row labels and any given figures; leave cells blank ("") for students to complete; formulas like =SUM(B2:B5) are allowed
- spreadsheetModelAnswer: JSON string with the same tables structure but ALL cells filled in with correct values
- Give every table a clear "title" naming the statement (e.g. "Income Statement", "Statement of Financial Position", "Cash Flow Statement", "Statement of Changes in Equity") so it renders as a separate labeled table
- Only add more than one entry to "tables" when the question text explicitly asks for more than one statement — do not split a single-statement question into extra empty tables
- Use financial-spreadsheet for: income statements, balance sheets / statements of financial position, cash flow statements, statements of changes in equity, ledgers, trial balances, ratio analysis tables, budgets

IMPORTANT: Arrays must be JSON arrays, not string representations. correctAnswer must ALWAYS be a string for all question types.`;

    const aiResponse = await groqClient.generateContent(systemPrompt, {
      model: 'smart',
      jsonMode: true,
      temperature: 0.2, // Lower temperature for more deterministic output
      maxTokens: 8192, // Increased to give AI more space for all questions
      skipCache: true // Skip cache to ensure new prompt is used
    });
    let text = aiResponse.text || '';

    // Strip markdown code fences if present
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

    let examData;
    try {
      examData = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) examData = JSON.parse(match[0]);
      else return res.status(500).json({ message: 'AI returned invalid JSON. Please try rephrasing your prompt.' });
    }

    // Post-process to fix stringified arrays and handle special fields
    function fixStringifiedArrays(obj) {
      if (Array.isArray(obj)) {
        return obj.map(fixStringifiedArrays);
      }
      if (obj && typeof obj === 'object') {
        const fixed = {};
        for (const key in obj) {
          const value = obj[key];
          // Check if value is a string that looks like an array
          if (typeof value === 'string' && value.trim().startsWith('[') && value.trim().endsWith(']')) {
            try {
              fixed[key] = JSON.parse(value.trim());
            } catch {
              fixed[key] = value;
            }
          } else {
            fixed[key] = fixStringifiedArrays(value);
          }
        }
        return fixed;
      }
      return obj;
    }

    examData = fixStringifiedArrays(examData);

    // Validate that question types match the specification
    console.log('Validating question types against specification...');
    console.log(`Expected ${qtConfig.length} sections, got ${examData.sections?.length || 0} sections`);
    let validatedQuestions = [];
    let countMismatches = [];
    if (examData.sections) {
      examData.sections.forEach((section, idx) => {
        const expectedType = qtConfig[idx]?.type;
        const expectedCount = qtConfig[idx]?.count;
        const actualCount = section.questions?.length || 0;

        console.log(`Section ${section.name}: Expected type "${expectedType}", count ${expectedCount}, Description: "${section.description}"`);
        console.log(`  Actual count: ${actualCount} questions`);

        if (actualCount !== expectedCount) {
          countMismatches.push({
            section: section.name,
            expected: expectedCount,
            actual: actualCount
          });
          console.warn(`  WARNING: Count mismatch! Expected ${expectedCount}, got ${actualCount}`);
        }

        if (section.questions) {
          section.questions.forEach((q, qIdx) => {
            const actualType = q.type;
            console.log(`  Question ${qIdx + 1}: type="${actualType}" (expected: "${expectedType}")`);
            if (actualType !== expectedType) {
              console.warn(`  WARNING: Question type mismatch! Expected "${expectedType}" but got "${actualType}"`);
              // Force the correct type
              q.type = expectedType;
              console.log(`  FIXED: Changed type to "${expectedType}"`);
            }
          });
          validatedQuestions = validatedQuestions.concat(section.questions);
        }
      });
    }

    // Check if all expected sections were generated
    if (examData.sections && examData.sections.length < qtConfig.length) {
      console.error(`ERROR: Only ${examData.sections.length} sections generated, expected ${qtConfig.length}`);
      console.error('Missing sections:', qtConfig.slice(examData.sections.length).map(qt => qt.type));
      // This is a critical error - the AI didn't generate all sections
      // We should return an error to the user
      return res.status(500).json({
        message: `AI generation incomplete: Only ${examData.sections.length} of ${qtConfig.length} sections were generated. Please try again.`
      });
    }

    // Check if question counts match and trim excess questions
    if (countMismatches.length > 0) {
      console.log('Question count mismatches detected - trimming to match specifications:');
      countMismatches.forEach(m => {
        console.log(`  Section ${m.section}: expected ${m.expected}, got ${m.actual}`);
      });

      // Trim or add questions to match exact counts
      examData.sections.forEach((section, idx) => {
        const expectedCount = qtConfig[idx]?.count;
        const actualCount = section.questions?.length || 0;

        if (actualCount > expectedCount) {
          // Trim excess questions
          console.log(`  Trimming Section ${section.name} from ${actualCount} to ${expectedCount} questions`);
          section.questions = section.questions.slice(0, expectedCount);
        } else if (actualCount < expectedCount) {
          // Not enough questions - log warning but continue
          console.warn(`  Section ${section.name} has only ${actualCount} questions (expected ${expectedCount})`);
        }
      });

      // Recalculate total after trimming
      validatedQuestions = [];
      examData.sections.forEach(section => {
        if (section.questions) {
          validatedQuestions = validatedQuestions.concat(section.questions);
        }
      });
      console.log(`Total questions after trimming: ${validatedQuestions.length}`);
    }

    // Deduplicate questions across sections
    console.log('Checking for duplicate questions across sections...');
    const seenQuestions = new Set();
    let duplicatesRemoved = 0;

    examData.sections.forEach((section, sectionIdx) => {
      if (section.questions) {
        const originalCount = section.questions.length;
        section.questions = section.questions.filter(q => {
          // Create a normalized version of the question text for comparison
          const normalizedText = q.text?.toLowerCase().trim().replace(/\s+/g, ' ') || '';
          const questionKey = `${normalizedText.substring(0, 100)}_${q.type}`;

          if (seenQuestions.has(questionKey)) {
            console.warn(`  Removing duplicate question in Section ${section.name}: "${normalizedText.substring(0, 50)}..."`);
            duplicatesRemoved++;
            return false;
          }
          seenQuestions.add(questionKey);
          return true;
        });
        console.log(`  Section ${section.name}: ${originalCount} -> ${section.questions.length} questions (removed ${originalCount - section.questions.length} duplicates)`);
      }
    });

    if (duplicatesRemoved > 0) {
      console.log(`Total duplicates removed: ${duplicatesRemoved}`);
      // Recalculate total after deduplication
      validatedQuestions = [];
      examData.sections.forEach(section => {
        if (section.questions) {
          validatedQuestions = validatedQuestions.concat(section.questions);
        }
      });
    }

    console.log(`Total questions after validation: ${validatedQuestions.length}`);

    // Post-process questions to fix field mappings based on question type
    function normalizeQuestionFields(question) {
      if (!question) return question;

      const qType = mapQuestionType(question.type);

      // Handle ordering questions: move array correctAnswer to itemsToOrder.correctOrder
      if (qType === 'ordering' && Array.isArray(question.correctAnswer)) {
        question.itemsToOrder = question.itemsToOrder || {};
        question.itemsToOrder.correctOrder = question.correctAnswer;
        question.itemsToOrder.items = question.items || question.itemsToOrder?.items || [];
        question.correctAnswer = 'Not provided'; // Set to string for schema
      }

      // Handle matching questions: ensure matchingPairs is properly set
      if (qType === 'matching') {
        // If correctAnswer is an array, move it to matchingPairs.correctPairs
        if (Array.isArray(question.correctAnswer)) {
          question.matchingPairs = question.matchingPairs || {};
          question.matchingPairs.correctPairs = question.correctAnswer;
          question.matchingPairs.leftColumn = question.leftItems || question.matchingPairs?.leftColumn || [];
          question.matchingPairs.rightColumn = question.rightItems || question.matchingPairs?.rightColumn || [];
          question.correctAnswer = question.explanation || 'Not provided'; // Set to string for schema
        }
        // If correctAnswer is a string but looks like JSON, try to parse it
        else if (typeof question.correctAnswer === 'string' && question.correctAnswer.trim().startsWith('[')) {
          try {
            const parsed = JSON.parse(question.correctAnswer);
            if (Array.isArray(parsed)) {
              question.matchingPairs = question.matchingPairs || {};
              question.matchingPairs.correctPairs = parsed;
              question.matchingPairs.leftColumn = question.leftItems || question.matchingPairs?.leftColumn || [];
              question.matchingPairs.rightColumn = question.rightItems || question.matchingPairs?.rightColumn || [];
              question.correctAnswer = question.explanation || 'Not provided'; // Set to string for schema
            }
          } catch (e) {
            // If parsing fails, leave as-is
          }
        }
        // Ensure matchingPairs structure exists even if correctAnswer is already a string
        if (!question.matchingPairs) {
          question.matchingPairs = {
            leftColumn: question.leftItems || [],
            rightColumn: question.rightItems || [],
            correctPairs: []
          };
        }
      }

      // Handle drag-drop questions: ensure dragDropData is properly set
      if (qType === 'drag-drop' && Array.isArray(question.correctAnswer)) {
        question.dragDropData = question.dragDropData || {};
        question.dragDropData.correctPlacements = question.correctAnswer;
        question.dragDropData.dropZones = question.dropZones || question.dragDropData?.dropZones || [];
        question.dragDropData.draggableItems = question.draggableItems || question.dragDropData?.draggableItems || [];
        question.correctAnswer = question.explanation || 'Not provided'; // Set to string for schema
      }

      // Handle open-ended/essay questions: ensure gradingCriteria is array of objects
      if ((qType === 'open-ended' || qType === 'essay') && question.gradingCriteria) {
        if (Array.isArray(question.gradingCriteria)) {
          // Ensure each criterion has required fields
          question.gradingCriteria = question.gradingCriteria.map(criterion => {
            if (typeof criterion === 'string') {
              return { criteria: criterion, points: 1 };
            }
            return {
              criteria: criterion.criteria || criterion.criterion || criterion.description || '',
              points: criterion.points || criterion.mark || 1
            };
          });
        } else if (typeof question.gradingCriteria === 'object' && question.gradingCriteria !== null) {
          // Convert single object to array
          question.gradingCriteria = [{
            criteria: question.gradingCriteria.criteria || question.gradingCriteria.description || '',
            points: question.gradingCriteria.points || 1
          }];
        } else {
          question.gradingCriteria = [];
        }
      }

      return question;
    }

    // Apply normalization to all questions in sections
    if (examData.sections && Array.isArray(examData.sections)) {
      examData.sections.forEach(section => {
        if (section.questions && Array.isArray(section.questions)) {
          section.questions = section.questions.map(normalizeQuestionFields);
        }
      });
    }

    // Also apply to direct questions array if present
    if (examData.questions && Array.isArray(examData.questions)) {
      examData.questions = examData.questions.map(normalizeQuestionFields);
    }

    // Ensure required fields
    if (!examData.title) examData.title = 'Generated Exam';
    if (!examData.timeLimit) examData.timeLimit = 60;
    if (!examData.passingScore) examData.passingScore = 70;
    if (!examData.description) examData.description = prompt.trim();

    // Flatten sections into questions array for frontend compatibility
    let flattenedQuestions = [];
    if (examData.sections && Array.isArray(examData.sections)) {
      examData.sections.forEach((section, sIdx) => {
        if (section.questions && Array.isArray(section.questions)) {
          section.questions.forEach((q, qIdx) => {
            // Normalize options format - handle both string arrays and object arrays
            let normalizedOptions = [];
            const rawOptions = q.options || q.choices || q.alternatives || [];
            if (Array.isArray(rawOptions)) {
              normalizedOptions = rawOptions.map((opt, idx) => {
                if (typeof opt === 'string') {
                  return { text: opt, isCorrect: (q.correctAnswer === String.fromCharCode(65 + idx) || q.correctAnswer === opt), letter: String.fromCharCode(65 + idx) };
                }
                return { 
                  text: opt.text || opt.label || opt.value || '', 
                  isCorrect: opt.isCorrect || opt.correct || false, 
                  letter: opt.letter || String.fromCharCode(65 + idx) 
                };
              });
            }

            // Map AI fields to frontend expected fields
            const questionType = mapQuestionType(q.type || section.sectionTitle);

            // Normalize correctAnswer based on question type
            let normalizedCorrectAnswer = q.correctAnswer || q.answer || '';
            if (questionType === 'ordering' && Array.isArray(normalizedCorrectAnswer)) {
              // For ordering, move array to itemsToOrder later, set string here
              normalizedCorrectAnswer = 'Not provided';
            } else if (questionType === 'matching' && Array.isArray(normalizedCorrectAnswer)) {
              // For matching, set to explanation, array goes to matchingPairs
              normalizedCorrectAnswer = q.explanation || 'Not provided';
            }

            const baseQuestion = {
              text: q.text || q.question || q.prompt || 'Untitled Question',
              type: questionType,
              marks: q.points || q.marks || 1,
              difficulty: q.difficulty || 'medium',
              correctAnswer: normalizedCorrectAnswer,
              options: normalizedOptions,
              explanation: q.explanation || q.answerKey || q.rationale || '',
              gradingCriteria: q.gradingCriteria || q.keyPoints || q.markingScheme || [],
              keyPoints: q.keyPoints || q.gradingCriteria || [],
              acceptableAnswers: q.acceptableAnswers || q.alternativeAnswers || [],
              sectionIndex: sIdx,
              questionIndex: qIdx
            };

            // Add matching-specific fields
            if (questionType === 'matching') {
              baseQuestion.leftItems = q.leftItems || [];
              baseQuestion.rightItems = q.rightItems || [];

              // Convert correctAnswer to matchingPairs format
              if (q.correctAnswer) {
                if (Array.isArray(q.correctAnswer)) {
                  // Already an array of pairs
                  baseQuestion.matchingPairs = {
                    correctPairs: q.correctAnswer,
                    leftColumn: q.leftItems || [],
                    rightColumn: q.rightItems || []
                  };
                } else if (typeof q.correctAnswer === 'object') {
                  // Convert object format to array format
                  const correctPairs = Object.entries(q.correctAnswer).map(([left, right]) => ({
                    left: parseInt(left),
                    right: parseInt(right)
                  }));
                  baseQuestion.matchingPairs = {
                    correctPairs,
                    leftColumn: q.leftItems || [],
                    rightColumn: q.rightItems || []
                  };
                }
              }

              // Fallback to matchingPairs if provided directly
              if (q.matchingPairs) {
                baseQuestion.matchingPairs = q.matchingPairs;
              }

              // Ensure matchingPairs structure exists
              if (!baseQuestion.matchingPairs) {
                baseQuestion.matchingPairs = {
                  leftColumn: q.leftItems || [],
                  rightColumn: q.rightItems || [],
                  correctPairs: []
                };
              }

              // CRITICAL: Set correctAnswer to a string for matching questions (not the array of objects)
              // This is required by the Question schema
              baseQuestion.correctAnswer = q.explanation || 'Not provided';
            }

            // Fix gradingCriteria for essay questions - ensure it's an array of objects
            if (questionType === 'open-ended' || questionType === 'essay') {
              if (Array.isArray(baseQuestion.gradingCriteria)) {
                // Ensure each criterion has required fields
                baseQuestion.gradingCriteria = baseQuestion.gradingCriteria.map(criterion => {
                  if (typeof criterion === 'string') {
                    return { criteria: criterion, points: 1 };
                  }
                  return {
                    criteria: criterion.criteria || criterion.criterion || criterion.description || '',
                    points: criterion.points || criterion.mark || 1
                  };
                });
              } else if (typeof baseQuestion.gradingCriteria === 'object' && baseQuestion.gradingCriteria !== null) {
                // Convert single object to array
                baseQuestion.gradingCriteria = [{
                  criteria: baseQuestion.gradingCriteria.criteria || baseQuestion.gradingCriteria.description || '',
                  points: baseQuestion.gradingCriteria.points || 1
                }];
              } else {
                // Fallback to empty array
                baseQuestion.gradingCriteria = [];
              }
            }

            // Add ordering-specific fields
            if (questionType === 'ordering') {
              baseQuestion.items = q.items || [];
              // Handle correctAnswer array for ordering questions
              let correctOrder = [];
              if (Array.isArray(q.correctAnswer)) {
                correctOrder = q.correctAnswer;
              } else if (q.itemsToOrder?.correctOrder) {
                correctOrder = q.itemsToOrder.correctOrder;
              }
              baseQuestion.itemsToOrder = {
                items: q.items || q.itemsToOrder?.items || [],
                correctOrder
              };
              // Ensure correctAnswer is a string
              baseQuestion.correctAnswer = q.explanation || 'Not provided';
            }

            // Add drag-drop-specific fields
            if (questionType === 'drag-drop') {
              baseQuestion.dropZones = q.dropZones || [];
              baseQuestion.draggableItems = q.draggableItems || [];
              // Handle correctAnswer array for drag-drop questions
              let correctPlacements = [];
              if (Array.isArray(q.correctAnswer)) {
                correctPlacements = q.correctAnswer;
              } else if (q.dragDropData?.correctPlacements) {
                correctPlacements = q.dragDropData.correctPlacements;
              }
              baseQuestion.dragDropData = {
                dropZones: q.dropZones || q.dragDropData?.dropZones || [],
                draggableItems: q.draggableItems || q.dragDropData?.draggableItems || [],
                correctPlacements
              };
              // Ensure correctAnswer is a string
              baseQuestion.correctAnswer = q.explanation || 'Not provided';
            }

            // Add financial-spreadsheet-specific fields
            if (questionType === 'financial-spreadsheet') {
              // spreadsheetTemplate: partial data the student sees
              if (q.spreadsheetTemplate) {
                baseQuestion.spreadsheetTemplate = normalizeSpreadsheetField(q.spreadsheetTemplate);
              }
              // spreadsheetModelAnswer: completed answer sheet
              if (q.spreadsheetModelAnswer) {
                baseQuestion.spreadsheetModelAnswer = normalizeSpreadsheetField(q.spreadsheetModelAnswer);
                baseQuestion.correctAnswer = baseQuestion.spreadsheetModelAnswer;
              }
            }

            flattenedQuestions.push(baseQuestion);
          });
        }
      });
    }

    // If no questions found in sections, try direct questions array
    if (flattenedQuestions.length === 0 && examData.questions && Array.isArray(examData.questions)) {
      flattenedQuestions = examData.questions.map((q, idx) => {
        const mappedType = mapQuestionType(q.type);
        const fallbackQuestion = {
          text: q.text || q.question || 'Untitled Question',
          type: mappedType,
          marks: q.points || q.marks || 1,
          difficulty: q.difficulty || 'medium',
          correctAnswer: q.correctAnswer || q.answer || '',
          options: q.options || q.choices || [],
          explanation: q.explanation || ''
        };
        if (mappedType === 'financial-spreadsheet') {
          if (q.spreadsheetTemplate) {
            fallbackQuestion.spreadsheetTemplate = normalizeSpreadsheetField(q.spreadsheetTemplate);
          }
          if (q.spreadsheetModelAnswer) {
            fallbackQuestion.spreadsheetModelAnswer = normalizeSpreadsheetField(q.spreadsheetModelAnswer);
            fallbackQuestion.correctAnswer = fallbackQuestion.spreadsheetModelAnswer;
          }
        }
        return fallbackQuestion;
      });
    }

    examData.questions = flattenedQuestions;
    examData.totalMarks = flattenedQuestions.reduce((sum, q) => sum + (q.marks || 1), 0);

    // Attach plan metadata so the client can display it
    examData._planLimits = limits;
    examData._qtConfig = qtConfig;

    console.log(`AI Exam Generated: ${examData.title} with ${flattenedQuestions.length} questions`);

    res.json(examData);
  } catch (err) {
    console.error('ai-generate error:', err);
    const is429 = err.status === 429 || err.message?.includes('429') || err.message?.includes('quota');
    res.status(is429 ? 429 : 500).json({
      message: is429
        ? 'AI quota exceeded. Please wait 60 seconds and try again.'
        : err.message || 'AI generation failed. Please try again.',
    });
  }
});

// Per-user chat cooldown: max 1 request per 8 seconds
const chatCooldowns = new Map();
const CHAT_COOLDOWN_MS = 8000;

// Generic AI chat/assistant endpoint — no exam generation, just helpful responses
router.post('/ai-chat', auth, isAdminOrTeacher, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) return res.status(400).json({ message: 'Message is required' });

    const userId = String(req.user._id);
    const now = Date.now();
    const lastCall = chatCooldowns.get(userId) || 0;
    if (now - lastCall < CHAT_COOLDOWN_MS) {
      return res.status(429).json({ message: 'Please wait a moment before sending another message.' });
    }
    chatCooldowns.set(userId, now);

    // Compact prompt — keep token count low
    const prompt = `You are a concise AI assistant for teachers. Answer helpfully in 2-4 sentences or a short list. Topic: education, exams, pedagogy, curriculum.\n\nQ: ${message.trim().slice(0, 500)}`;

    const aiResponse = await groqClient.generateContent(prompt, {
      model: 'fast',
      jsonMode: false,
      temperature: 0.4,
      maxTokens: 1024
    });
    const reply = aiResponse.text || '';

    res.json({ reply });
  } catch (err) {
    console.error('ai-chat error:', err);
    const is429 = err.status === 429 || err.message?.includes('429') || err.message?.includes('quota');
    res.status(is429 ? 429 : 500).json({
      message: is429
        ? 'AI quota exceeded. Please wait a moment and try again.'
        : err.message || 'AI assistant failed. Please try again.',
    });
  }
});

// Regrading routes (specific routes before parameterized ones)
router.post('/regrade/:resultId', auth, regradeExamResult); // Allow both students and admins to request regrading
router.post('/regrade-all', isAdmin, regradeAllExams);
router.post('/fix-results', isAdmin, fixExistingResults); // Fix existing results with incorrect scores
router.get('/debug-result/:resultId', isAdmin, debugResult); // Debug specific result
router.post('/comprehensive-ai-grading', isAdmin, comprehensiveAIGrading); // Comprehensive AI grading

// Student routes (specific routes before parameterized ones)
router.get('/result/:id', auth, getExamResult); // Both students and admins can view results

router.post('/:id/enable-selective-answering', isAdmin, enableSelectiveAnswering);

module.exports = router;
