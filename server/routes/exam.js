const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
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
const groqClient = require('../utils/groqClient');

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

// Admin routes
router.post(
  '/',
  isAdmin,
  checkExamLimit,
  upload.fields([
    { name: 'examFile', maxCount: 1 },
    { name: 'answerFile', maxCount: 1 }
  ]),
  createExam
);
router.put(
  '/:id',
  isAdmin,
  upload.fields([
    { name: 'examFile', maxCount: 1 },
    { name: 'answerFile', maxCount: 1 }
  ]),
  updateExam
);
router.delete('/:id', isAdmin, deleteExam);
router.put('/:id/toggle-lock', isAdminOrTeacher, toggleExamLock);
router.post('/grade/:resultId', isAdmin, gradeManually);
router.post('/ai-grade/:resultId', isAdmin, triggerAIGrading);
router.get('/:id/debug', isAdmin, debugExamContent);
router.post('/:id/reset-questions', isAdmin, resetExamQuestions);

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
    'open-ended': 'Essay with correctAnswer(comprehensive), marks, gradingCriteria[{criteria,points}]',
    'fill-in-blank': 'Fill blank with correctAnswer, acceptableAnswers[], explanation',
    'short-answer': 'Short answer with correctAnswer, keyPoints[], marks',
    'matching': 'Match with leftItems[], rightItems[], correctAnswer[{left,right}], explanation, marks',
    'ordering': 'Order with items[], correctAnswer[indices], explanation, marks'
  };

  return questionTypes.map((qt, idx) => {
    const sectionName = String.fromCharCode(65 + idx);
    const schema = typeSchemas[qt.type] || typeSchemas['open-ended'];
    return `{
  "name": "${sectionName}",
  "description": "${qt.label || qt.type}",
  "questions": [ /* EXACTLY ${qt.count} questions of type "${qt.type}" with format: ${schema} */ ]
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
    return 'fill-blank';
  }
  // Open ended variations
  if (t.includes('open') || t.includes('essay') || t.includes('long') || t.includes('descriptive')) {
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
        await exam.save();

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
        await exam.save();

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
        gradingCriteria: q.gradingCriteria || [],
        keyPoints: q.keyPoints || [],
        acceptableAnswers: q.acceptableAnswers || [],
        exam: exam._id,
        section: section,
        createdBy: req.user._id
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

    // Update exam with question IDs organized by section
    exam.sections.forEach(section => {
      section.questions = createdQuestions[section.name] || [];
    });
    await exam.save();

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

// AI exam generation route - requires Basic plan or higher
router.post('/ai-generate', auth, isAdminOrTeacher, requireAIFeatures, async (req, res) => {
  try {
    const { prompt, questionTypes } = req.body;
    if (!prompt || !prompt.trim()) return res.status(400).json({ message: 'Prompt is required' });

    // Resolve the user's effective plan
    const { plan } = await resolveEffectivePlan(req.user);
    const limits = AI_PLAN_LIMITS[plan] || AI_PLAN_LIMITS.basic;

    // Validate and normalise questionTypes coming from the client
    let qtConfig = Array.isArray(questionTypes) && questionTypes.length > 0
      ? questionTypes
      : [{ type: 'multiple-choice', count: 5, label: 'Multiple Choice' }, { type: 'open-ended', count: 2, label: 'Open-Ended' }];

    // Enforce per-type and total caps based on plan
    qtConfig = qtConfig.map(qt => ({
      ...qt,
      count: Math.min(qt.count || 1, limits.maxPerType),
    }));
    const totalRequested = qtConfig.reduce((s, qt) => s + qt.count, 0);
    if (totalRequested > limits.maxQuestions) {
      const scale = limits.maxQuestions / totalRequested;
      qtConfig = qtConfig.map(qt => ({ ...qt, count: Math.max(1, Math.round(qt.count * scale)) }));
    }

    const sectionsTemplate = buildSectionsInstruction(qtConfig);

    // Build detailed count instructions
    const countInstructions = qtConfig.map(qt =>
      `- Section ${String.fromCharCode(65 + qtConfig.indexOf(qt))}: EXACTLY ${qt.count} questions of type "${qt.type}" (${qt.label})`
    ).join('\n  ');

    const systemPrompt = `Generate exam JSON based on: "${prompt.trim()}"

CRITICAL REQUIREMENTS:
1. Generate EXACTLY the following number of questions per section:
  ${countInstructions}
2. Return ONLY valid JSON, no markdown, no explanations outside JSON
3. Follow the exact format specified below

Return raw JSON:
{
  "title": "Exam title",
  "description": "Brief description",
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
- correctAnswer for matching: array of objects [{left: string, right: string}] NOT a string
- correctAnswer for ordering: array of numbers [0, 1, 2, 3] NOT a string
- options for multiple-choice/true-false: array of objects [{text, isCorrect, letter}]
- gradingCriteria for open-ended: array of objects [{criteria: string, points: number}]
- leftItems/rightItems for matching: array of strings
- items for ordering: array of strings

IMPORTANT: Arrays must be JSON arrays, not string representations like "[0, 1, 2]".`;

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
      if (qType === 'matching' && Array.isArray(question.correctAnswer)) {
        question.matchingPairs = question.matchingPairs || {};
        question.matchingPairs.correctPairs = question.correctAnswer;
        question.matchingPairs.leftColumn = question.leftItems || question.matchingPairs?.leftColumn || [];
        question.matchingPairs.rightColumn = question.rightItems || question.matchingPairs?.rightColumn || [];
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
    let allQuestions = [];
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

              // Set correctAnswer to a string for matching questions (not the array of objects)
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
              baseQuestion.correctAnswer = 'Not provided';
            }

            allQuestions.push(baseQuestion);
          });
        }
      });
    }

    // If no questions found in sections, try direct questions array
    if (allQuestions.length === 0 && examData.questions && Array.isArray(examData.questions)) {
      allQuestions = examData.questions.map((q, idx) => ({
        text: q.text || q.question || 'Untitled Question',
        type: mapQuestionType(q.type),
        marks: q.points || q.marks || 1,
        difficulty: q.difficulty || 'medium',
        correctAnswer: q.correctAnswer || q.answer || '',
        options: q.options || q.choices || [],
        explanation: q.explanation || ''
      }));
    }

    examData.questions = allQuestions;
    examData.totalMarks = allQuestions.reduce((sum, q) => sum + (q.marks || 1), 0);

    // Attach plan metadata so the client can display it
    examData._planLimits = limits;
    examData._qtConfig = qtConfig;

    console.log(`AI Exam Generated: ${examData.title} with ${allQuestions.length} questions`);

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
