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
const { isAdmin, isStudent, isAdminOrTeacher } = require('../middleware/role');
const geminiClient = require('../utils/geminiClient');

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
router.put('/:id/toggle-lock', isAdmin, toggleExamLock);
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






// AI exam generation route
router.post('/ai-generate', auth, isAdminOrTeacher, async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt || !prompt.trim()) return res.status(400).json({ message: 'Prompt is required' });

    const systemPrompt = `You are an expert exam creator. Based on the teacher's description, generate a well-structured exam in valid JSON.

Return ONLY a raw JSON object with this exact structure (no markdown, no code fences):
{
  "title": "Exam title",
  "description": "Brief description",
  "timeLimit": 60,
  "passingScore": 70,
  "sections": [
    {
      "name": "A",
      "description": "Multiple choice questions",
      "questions": [
        {
          "text": "Question text here?",
          "type": "multiple-choice",
          "points": 2,
          "difficulty": "medium",
          "options": [
            { "text": "Option A", "isCorrect": false, "letter": "A" },
            { "text": "Option B", "isCorrect": true, "letter": "B" },
            { "text": "Option C", "isCorrect": false, "letter": "C" },
            { "text": "Option D", "isCorrect": false, "letter": "D" }
          ],
          "correctAnswer": "B"
        }
      ]
    },
    {
      "name": "B",
      "description": "Short answer questions",
      "questions": [
        {
          "text": "Open-ended question text?",
          "type": "open-ended",
          "points": 5,
          "difficulty": "medium",
          "correctAnswer": "Model answer here"
        }
      ]
    }
  ]
}

Teacher description: ${prompt.trim()}

Generate a complete exam with at least 5 multiple-choice questions in Section A and 2 open-ended questions in Section B. Make questions relevant, clear, and educationally appropriate.`;

    const aiResponse = await geminiClient.generateContent(systemPrompt);
    let text = (typeof aiResponse === 'string' ? aiResponse : aiResponse.text || '').trim();

    // Strip markdown code fences if present
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

    let examData;
    try {
      examData = JSON.parse(text);
    } catch {
      // Try to extract JSON from the response
      const match = text.match(/\{[\s\S]*\}/);
      if (match) examData = JSON.parse(match[0]);
      else return res.status(500).json({ message: 'AI returned invalid JSON. Please try rephrasing your prompt.' });
    }

    // Ensure required fields
    if (!examData.title) examData.title = 'Generated Exam';
    if (!examData.timeLimit) examData.timeLimit = 60;
    if (!examData.passingScore) examData.passingScore = 70;
    if (!examData.description) examData.description = prompt.trim();

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
