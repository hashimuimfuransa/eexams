const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mammoth = require('mammoth');
const pdf = require('pdf-parse');
const {
  createExam,
  getExams,
  getExamById,
  updateExam,
  deleteExam,
  toggleExamLock,
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
  checkExamLimit,
  requireAIFeatures,
  requireAdvancedAI
} = require('../middleware/planRestrictions');
const { authLimiter, submissionLimiter, aiGradingLimiter, examCreationLimiter } = require('../middleware/rateLimiter');
const { cacheExam, cacheExamList, invalidateExamCache } = require('../middleware/cacheMiddleware');
const groqClient = require('../utils/groqClient');

// Configure multer for reference file uploads (memory storage)
const memoryStorage = multer.memoryStorage();
const memoryUpload = multer({
  storage: memoryStorage,
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

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');

    // Create the directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
      console.log('Created uploads directory:', uploadDir);
    }

    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const filetypes = /pdf|doc|docx/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only PDF and Word documents are allowed'));
    }
  }
});

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
  invalidateExamCache,
  createExam
);
router.get('/', cacheExamList, getExams);
router.get(
  '/:id',
  cacheExam,
  getExamById
);
router.put(
  '/:id',
  authLimiter,
  isAdmin,
  upload.fields([
    { name: 'examFile', maxCount: 1 },
    { name: 'answerFile', maxCount: 1 }
  ]),
  invalidateExamCache,
  updateExam
);
router.delete('/:id', authLimiter, isAdmin, invalidateExamCache, deleteExam);
router.put('/:id/toggle-lock', authLimiter, isAdminOrTeacher, invalidateExamCache, toggleExamLock);
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
router.post('/:id/start', submissionLimiter, isStudent, startExam);
router.post('/:id/answer', submissionLimiter, isStudent, submitAnswer);
router.post('/:id/complete', submissionLimiter, isStudent, completeExam);
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
    'image': 'Image with imageUrl, correctAnswer(string), explanation'
  };

  return questionTypes.map((qt, idx) => {
    const sectionName = String.fromCharCode(65 + idx);
    const schema = typeSchemas[qt.type] || typeSchemas['open-ended'];
    return `{
  "name": "${sectionName}",
  "description": "${qt.label || qt.type}",
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
  
  return 'multiple-choice'; // default
}

// Save draft exam route - must come before parameterized routes
router.post('/save-draft', auth, isAdminOrTeacher, attachOrgAdminId, async (req, res) => {
  try {
    console.log('Save draft - req.user._id:', req.user._id);
    console.log('Save draft - req.orgAdminId:', req.orgAdminId);
    console.log('Save draft - req.user.role:', req.user.role);
    const { title, description, timeLimit, passingScore, questions, totalMarks, examId, sections } = req.body;

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

    // Create sections array based on grouped questions
    const sectionsArray = Object.keys(questionsBySection).map(sectionName => ({
      name: sectionName,
      description: `Section ${sectionName}`,
      questions: []
    }));

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
        exam.sections = sectionsArray;
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
        exam.sections = sectionsArray;
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
          totalPoints: totalMarks || questions.reduce((sum, q) => sum + (q.marks || q.points || 1), 0)
        });
        console.log(`Created new draft exam: ${exam._id}`);
      }
    }

    // Create questions with exam ID and section
    const createdQuestions = {};
    
    for (const q of questions) {
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

      const questionData = {
        text: q.text,
        type: q.type || 'multiple-choice',
        marks: q.marks || q.points || 1,
        points: q.marks || q.points || 1,
        difficulty: q.difficulty || 'medium',
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
        // Preserve new structure fields from pasted exams
        leftItems: q.leftItems || [],
        rightItems: q.rightItems || [],
        correctMatches: q.correctMatches || {},
        wordBank: q.wordBank || [],
        passage: q.passage || '',
        subsectionTitle: q.subsectionTitle || '',
        subsection: q.subsection || '',
        instructions: q.instructions || '',
        sectionTitle: q.sectionTitle || ''
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
        // Handle different formats for correctAnswer
        let correctPairs = [];
        if (typeof q.correctAnswer === 'string') {
          // Try to parse as JSON first
          try {
            const parsed = JSON.parse(q.correctAnswer);
            if (Array.isArray(parsed)) {
              correctPairs = parsed;
            }
          } catch {
            // If string, assume it's a fallback and generate default pairs
            const leftCount = (q.leftItems || q.matchingPairs?.leftColumn || []).length;
            const rightCount = (q.rightItems || q.matchingPairs?.rightColumn || []).length;
            const count = Math.min(leftCount, rightCount);
            correctPairs = Array.from({ length: count }, (_, i) => ({ left: i, right: i }));
          }
        } else if (Array.isArray(q.correctAnswer)) {
          correctPairs = q.correctAnswer;
        } else if (typeof q.correctAnswer === 'object') {
          // Convert object format to array format
          correctPairs = Object.entries(q.correctAnswer).map(([left, right]) => ({
            left: parseInt(left),
            right: parseInt(right)
          }));
        }

        // Fallback to existing correctPairs if available
        if (correctPairs.length === 0 && q.matchingPairs?.correctPairs) {
          correctPairs = q.matchingPairs.correctPairs;
        }

        questionData.matchingPairs = {
          leftColumn: q.leftItems || q.matchingPairs?.leftColumn || [],
          rightColumn: q.rightItems || q.matchingPairs?.rightColumn || [],
          correctPairs
        };

        // Set correctAnswer to default string for matching questions
        questionData.correctAnswer = 'Not provided';
      }

      // Add ordering-specific fields
      if (q.type === 'ordering') {
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
              const itemCount = (q.items || q.itemsToOrder?.items || []).length;
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
          items: q.items || q.itemsToOrder?.items || [],
          correctOrder
        };

        // Set correctAnswer to default string for ordering questions
        questionData.correctAnswer = 'Not provided';
      }

      // Add drag-drop-specific fields
      if (q.type === 'drag-drop') {
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
            const dropZoneCount = (q.dropZones || q.dragDropData?.dropZones || []).length;
            const itemCount = (q.draggableItems || q.dragDropData?.draggableItems || []).length;
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
          dropZones: q.dropZones || q.dragDropData?.dropZones || [],
          draggableItems: q.draggableItems || q.dragDropData?.draggableItems || [],
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
router.post('/upload-reference', auth, isAdminOrTeacher, memoryUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const { buffer, originalname, mimetype, size } = req.file;
    const ext = path.extname(originalname).toLowerCase();
    let content = '';

    console.log(`Processing file: ${originalname}, size: ${(size / 1024 / 1024).toFixed(2)}MB, type: ${mimetype}`);

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

    // Clean up the content more efficiently
    content = content.replace(/\s+/g, ' ').trim();

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
      contentLength: content.length
    });
  } catch (error) {
    console.error('Error uploading reference file:', error);
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ message: 'File too large. Maximum size is 50MB.' });
    }
    res.status(500).json({ message: 'Failed to process file: ' + error.message });
  }
});

// AI exam generation route - requires Basic plan or higher
router.post('/ai-generate', auth, isAdminOrTeacher, requireAIFeatures, async (req, res) => {
  try {
    const { prompt, pastedExam, referenceContent } = req.body;
    if (!prompt || !prompt.trim()) return res.status(400).json({ message: 'Prompt is required' });

    // Resolve the user's effective plan
    const { plan } = await resolveEffectivePlan(req.user);
    const limits = AI_PLAN_LIMITS[plan] || AI_PLAN_LIMITS.basic;

    let qtConfig;
    let examContext = '';

    // If pasted exam is provided, parse it to extract the actual questions
    if (pastedExam && pastedExam.trim()) {
      const parseExamPrompt = `You are extracting the FULL structure of a pasted exam including passages, instructions, word banks, examples, and ALL questions. Preserve the hierarchical structure exactly as it appears.

PASTED EXAM:
"${pastedExam.trim()}"

TEACHER INSTRUCTIONS: "${prompt.trim()}"

IMPORTANT: The pasted exam includes a TEACHER'S MARKING GUIDE at the end. You MUST extract ALL answers from this marking guide and include them in the correctAnswer field for each question.

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
        }
      ]
    }
  ]
}

CRITICAL RULES:
- PRESERVE the full exam structure including passages, instructions, word banks, examples
- Extract passages (like comprehension passages) into the "passage" field
- Extract section titles with marks (e.g., "COMPREHENSION (20 Marks)")
- Extract subsections (A, B, C within a section) with their own titles and instructions
- Extract word banks/boxes into the "wordBank" array
- Extract examples into the "examples" array if present
- Extract ALL questions as individual items
- For matching exercises: Create ONE question with type "matching" that contains ALL matching pairs. Use this structure:
  {
    "text": "Match the words with their meanings",
    "type": "matching",
    "points": 5,
    "leftItems": ["Doctor", "School", "Market", "Library", "Farmer"],
    "rightItems": ["A person who treats sick people", "A place where children learn", "A place where people buy and sell things", "A place with books", "A person who grows crops"],
    "correctMatches": {"Doctor": 1, "School": 0, "Market": 2, "Library": 3, "Farmer": 4},
    "correctAnswer": "1-b, 2-a, 3-c, 4-d, 5-e"
  }
- For fill-in-blank: each blank is a separate question with type "fill-in-blank". Extract the exact word from the marking guide as correctAnswer.
- For grammar exercises: each sentence/item is a separate question. Extract the model answer from the marking guide as correctAnswer.
- For multiple-choice: each MCQ is a separate question. Mark the correct option with isCorrect: true and set correctAnswer to the letter (e.g., "b").
- Extract the exact text from the pasted exam
- CRITICAL: Use the TEACHER'S MARKING GUIDE to find ALL correct answers. The marking guide is at the end of the pasted exam.
- For short-answer questions: extract the exact answer from the marking guide
- For open-ended questions: extract the model answer or key points from the marking guide
- Supported types: multiple-choice, true-false, short-answer, open-ended, fill-in-blank, matching, ordering
- If a section has subsections (A, B, C), use the "subsections" array
- If a section has no subsections, put questions directly in "questions" array
- Keep the hierarchical structure intact - this is a professional exam format
- EVERY question MUST have a correctAnswer field populated from the marking guide`;

      try {
        const parseResponse = await groqClient.generateContent(parseExamPrompt, {
          model: 'balanced',
          jsonMode: true,
          temperature: 0.1,
          maxTokens: 16384
        });
        
        let parseText = parseResponse.text || '';
        parseText = parseText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
        
        console.log('Parsed exam text length:', parseText.length);
        
        const parsed = JSON.parse(parseText);
        console.log('Parsed exam structure:', JSON.stringify(parsed, null, 2).substring(0, 500));
        
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
        
        // Flatten questions from sections and subsections into top-level questions array for frontend compatibility
        const flattenedQuestions = [];
        if (parsed.sections) {
          parsed.sections.forEach(section => {
            // Add questions directly in the section
            if (section.questions) {
              section.questions.forEach(q => {
                flattenedQuestions.push({
                  ...q,
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
                      ...q,
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
- Supported types: multiple-choice, true-false, short-answer, open-ended, fill-in-blank, matching, ordering
- IMPORTANT: Use "open-ended" for open/essay questions, NOT "open"
- Be accurate - only extract what is explicitly stated in the prompt
- NEVER modify the user's specified counts`;

      try {
        const parseResponse = await groqClient.generateContent(parsePrompt, {
          model: 'fast',
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

IMPORTANT: Arrays must be JSON arrays, not string representations. correctAnswer must ALWAYS be a string for all question types.`;

    const aiResponse = await groqClient.generateContent(systemPrompt, {
      model: 'balanced',
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

            flattenedQuestions.push(baseQuestion);
          });
        }
      });
    }

    // If no questions found in sections, try direct questions array
    if (flattenedQuestions.length === 0 && examData.questions && Array.isArray(examData.questions)) {
      flattenedQuestions = examData.questions.map((q, idx) => ({
        text: q.text || q.question || 'Untitled Question',
        type: mapQuestionType(q.type),
        marks: q.points || q.marks || 1,
        difficulty: q.difficulty || 'medium',
        correctAnswer: q.correctAnswer || q.answer || '',
        options: q.options || q.choices || [],
        explanation: q.explanation || ''
      }));
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

// Routes for both admin and students
router.get('/', getExams);

// Student routes (specific routes before parameterized ones)
router.get('/result/:id', auth, getExamResult); // Both students and admins can view results

// Parameterized routes (must come last to avoid conflicts)
router.get('/:id', getExamById);
router.post('/:id/start', isStudent, startExam);
router.post('/:id/answer', isStudent, submitAnswer);
router.post('/:id/complete', isStudent, completeExam); // New fast submission system
router.post('/:id/select-question', auth, isStudent, selectQuestion); // Ensure auth middleware is applied
router.post('/:id/enable-selective-answering', isAdmin, enableSelectiveAnswering);

module.exports = router;
