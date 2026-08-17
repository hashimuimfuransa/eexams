// Lesson Planner — AI-assisted lesson plan authoring for teachers.
//
// The teacher describes what to teach in plain language ("Unit 6, lesson 7 of 7,
// évaluation de l'unité") and optionally attaches the textbook/curriculum
// (uploaded through the existing POST /exam/upload-reference endpoint, which
// returns extracted text). This route turns that into the structured REB/CBC
// lesson plan shape, which can then be edited, saved and downloaded as a PDF.
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const mammoth = require('mammoth');
const pdfParse = require('pdf-parse');

const LessonPlan = require('../models/LessonPlan');
const auth = require('../middleware/auth');
const { isAdminOrTeacher, attachOrgAdminId } = require('../middleware/role');
const { requireAIFeatures } = require('../middleware/planRestrictions');
const { aiGradingLimiter, uploadLimiter } = require('../middleware/rateLimiter');
const groqClient = require('../utils/groqClient');
const { streamLessonPlanPdf } = require('../utils/lessonPlanPdf');
const {
  str,
  extractRelevantExcerpt,
  buildLessonPlanPrompt,
  normalizePlan
} = require('../utils/lessonPlanBuilder');

router.use(auth);

// Whitelist what a client may write, so an edited plan can be posted back wholesale.
const pickPlanFields = (body = {}) => {
  const plan = normalizePlan(body, {});
  return {
    ...plan,
    schoolName: str(body.schoolName),
    teacherName: str(body.teacherName),
    selfEvaluation: str(body.selfEvaluation),
    sourcePrompt: str(body.sourcePrompt),
    sourceFileName: str(body.sourceFileName),
    generatedByAI: body.generatedByAI !== false
  };
};

// ── Reference material extraction ────────────────────────────────────────────
//
// Deliberately does NOT reuse /exam/upload-reference. That route streams the file
// into Cloudinary as a "raw" asset (which caps well below 50MB on most Cloudinary
// plans), downloads it back, and then reads a PDF through the vision pipeline,
// which stops after the first 15 pages — useless for "here is the textbook, prepare
// unit 6" when unit 6 starts on page 120. Here the file stays in memory, the whole
// text layer is read, and nothing is stored: the teacher's book is not an asset we
// need to keep, only its text for the length of one request.

const MAX_REFERENCE_CHARS = 400000; // ~200 pages of prose — plenty for chapter lookup
const REFERENCE_MAX_BYTES = 50 * 1024 * 1024;
const ALLOWED_REFERENCE_EXT = ['.pdf', '.doc', '.docx', '.txt'];

const referenceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: REFERENCE_MAX_BYTES },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_REFERENCE_EXT.includes(ext)) return cb(null, true);
    cb(new Error('Only PDF, DOC, DOCX and TXT files are supported.'));
  }
});

// Collapse runs of spaces but keep line breaks — chapter headings and exercise
// layouts are what make a chapter findable in the text.
const tidyText = (raw) => String(raw || '')
  .replace(/\r\n/g, '\n')
  .replace(/[ \t]+/g, ' ')
  .replace(/[ \t]+\n/g, '\n')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

const extractPdfText = async (buffer, originalname) => {
  let text = '';
  let pages = null;

  try {
    const parsed = await pdfParse(buffer);
    text = parsed.text || '';
    pages = parsed.numpages || null;
  } catch (err) {
    console.warn('pdf-parse failed on reference file:', err.message);
  }

  // A scanned/photographed book has no text layer. Fall back to the existing
  // vision/OCR pipeline, which needs a file on disk.
  if (text.replace(/\s/g, '').length < 200) {
    const tmpPath = path.join(os.tmpdir(), `lesson-ref-${Date.now()}-${Math.round(Math.random() * 1e9)}.pdf`);
    try {
      fs.writeFileSync(tmpPath, buffer);
      const { parsePdf } = require('../utils/fileParser');
      const result = await parsePdf(tmpPath);
      if (result?.text) return { text: result.text, pages, method: 'ocr' };
    } catch (err) {
      console.warn('OCR fallback failed on reference file:', err.message);
    } finally {
      try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch { /* best effort */ }
    }

    if (text.replace(/\s/g, '').length < 200) {
      throw new Error(`No readable text could be found in ${originalname}. If it is a scan or photo, try a clearer copy, or paste the chapter text into the box instead.`);
    }
  }

  return { text, pages, method: 'text-layer' };
};

// ── Routes ───────────────────────────────────────────────────────────────────

// @desc    Read a book/curriculum file and return its text (nothing is stored)
// @route   POST /api/lesson-plans/extract
// @access  Private (teacher/admin)
router.post('/extract', uploadLimiter, isAdminOrTeacher, (req, res) => {
  referenceUpload.single('file')(req, res, async (uploadErr) => {
    if (uploadErr) {
      if (uploadErr.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ message: 'That file is over 50MB. Please split it or attach just the chapter you need.' });
      }
      return res.status(400).json({ message: uploadErr.message || 'Could not read that file.' });
    }

    if (!req.file) return res.status(400).json({ message: 'No file was received.' });

    const { originalname, buffer, size } = req.file;
    const ext = path.extname(originalname).toLowerCase();
    console.log(`Lesson planner reference: ${originalname} (${(size / 1024 / 1024).toFixed(2)}MB)`);

    try {
      let text = '';
      let pages = null;
      let method = 'text';

      if (ext === '.pdf') {
        const result = await extractPdfText(buffer, originalname);
        text = result.text;
        pages = result.pages;
        method = result.method;
      } else if (ext === '.doc' || ext === '.docx') {
        const result = await mammoth.extractRawText({ buffer });
        text = result.value || '';
      } else {
        text = buffer.toString('utf-8');
      }

      let content = tidyText(text);
      if (!content) {
        return res.status(422).json({ message: `No readable text could be found in ${originalname}.` });
      }

      const truncated = content.length > MAX_REFERENCE_CHARS;
      if (truncated) content = content.slice(0, MAX_REFERENCE_CHARS);

      console.log(`Lesson planner reference read: ${content.length} chars, ${pages || '?'} page(s), via ${method}`);

      res.json({
        success: true,
        content,
        filename: originalname,
        contentLength: content.length,
        pages,
        truncated,
        method
      });
    } catch (err) {
      console.error('lesson-plan extract error:', err);
      res.status(422).json({ message: err.message || 'Could not read that file.' });
    }
  });
});

// @desc    Generate a lesson plan with AI (not saved — the teacher reviews first)
// @route   POST /api/lesson-plans/generate
// @access  Private (teacher/admin, Basic plan or higher)
router.post('/generate', aiGradingLimiter, isAdminOrTeacher, requireAIFeatures, async (req, res) => {
  try {
    const { brief: rawBrief, referenceContent: rawReference, sourceFileName = '', ...rest } = req.body || {};
    // Coerce rather than trust: a non-string here would throw on .trim().
    const brief = typeof rawBrief === 'string' ? rawBrief : '';
    const referenceContent = typeof rawReference === 'string' ? rawReference : '';

    if (!brief.trim() && !referenceContent.trim()) {
      return res.status(400).json({
        message: 'Tell us what to prepare (e.g. "Unit 6, lesson 7 of 7 — unit evaluation") or attach the book.'
      });
    }

    const details = {
      subject: str(rest.subject),
      className: str(rest.className),
      term: str(rest.term),
      date: str(rest.date),
      duration: str(rest.duration),
      classSize: str(rest.classSize),
      unitNo: str(rest.unitNo),
      lessonNo: str(rest.lessonNo),
      specialNeeds: str(rest.specialNeeds),
      language: str(rest.language, 'auto')
    };

    const reference = referenceContent ? extractRelevantExcerpt(referenceContent, brief) : '';
    const prompt = buildLessonPlanPrompt({ brief: brief.trim(), details, reference });

    const result = await groqClient.generateContent(prompt, {
      model: 'smart',
      jsonMode: true,
      temperature: 0.4,
      maxTokens: 4096
    });

    let parsed = result.parsedContent;
    if (!parsed && result.text) {
      const match = result.text.match(/\{[\s\S]*\}/);
      if (match) {
        try { parsed = JSON.parse(match[0]); } catch { parsed = null; }
      }
    }

    if (!parsed || typeof parsed !== 'object') {
      return res.status(422).json({ message: 'The AI could not build a lesson plan from that. Add a bit more detail and try again.' });
    }

    const plan = normalizePlan(parsed, details);
    if (!plan.steps.length) {
      return res.status(422).json({ message: 'The generated plan had no teaching steps. Please try again.' });
    }

    res.json({
      ...plan,
      schoolName: str(rest.schoolName) || str(req.user.organization),
      teacherName: str(rest.teacherName) || `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim(),
      sourcePrompt: brief.trim(),
      sourceFileName: str(sourceFileName),
      generatedByAI: true
    });
  } catch (err) {
    console.error('lesson-plan generate error:', err);
    const is429 = err.status === 429 || err.message?.includes('429') || err.message?.includes('quota') || err.message?.includes('rate limit');
    res.status(is429 ? 429 : 500).json({
      message: is429
        ? 'The AI is busy right now. Please wait a moment and try again.'
        : err.message || 'Lesson plan generation failed. Please try again.'
    });
  }
});

// @desc    Download a PDF of a plan that has not been saved yet
// @route   POST /api/lesson-plans/pdf
// @access  Private (teacher/admin)
router.post('/pdf', isAdminOrTeacher, (req, res) => {
  try {
    const plan = pickPlanFields(req.body || {});
    streamLessonPlanPdf(res, plan);
  } catch (err) {
    console.error('lesson-plan pdf error:', err);
    if (!res.headersSent) res.status(500).json({ message: 'Failed to generate PDF' });
  }
});

// @desc    List the current teacher's saved lesson plans
// @route   GET /api/lesson-plans
// @access  Private (teacher/admin)
router.get('/', isAdminOrTeacher, async (req, res) => {
  try {
    const plans = await LessonPlan.find({ createdBy: req.user._id })
      .sort({ updatedAt: -1 })
      .limit(200);
    res.json(plans);
  } catch (err) {
    console.error('lesson-plan list error:', err);
    res.status(500).json({ message: 'Failed to load lesson plans' });
  }
});

// @desc    Save a (reviewed) lesson plan
// @route   POST /api/lesson-plans
// @access  Private (teacher/admin)
router.post('/', isAdminOrTeacher, attachOrgAdminId, async (req, res) => {
  try {
    const fields = pickPlanFields(req.body || {});
    if (!fields.lessonTitle && !fields.subject) {
      return res.status(400).json({ message: 'A lesson title or subject is required before saving.' });
    }

    const plan = await LessonPlan.create({
      ...fields,
      createdBy: req.user._id,
      orgAdminId: req.orgAdminId || req.user._id
    });

    res.status(201).json(plan);
  } catch (err) {
    console.error('lesson-plan save error:', err);
    res.status(500).json({ message: 'Failed to save lesson plan' });
  }
});

// @desc    Get one saved lesson plan
// @route   GET /api/lesson-plans/:id
// @access  Private (owner)
router.get('/:id', isAdminOrTeacher, async (req, res) => {
  try {
    const plan = await LessonPlan.findOne({ _id: req.params.id, createdBy: req.user._id });
    if (!plan) return res.status(404).json({ message: 'Lesson plan not found' });
    res.json(plan);
  } catch (err) {
    console.error('lesson-plan get error:', err);
    res.status(500).json({ message: 'Failed to load lesson plan' });
  }
});

// @desc    Update a saved lesson plan
// @route   PUT /api/lesson-plans/:id
// @access  Private (owner)
router.put('/:id', isAdminOrTeacher, async (req, res) => {
  try {
    const plan = await LessonPlan.findOneAndUpdate(
      { _id: req.params.id, createdBy: req.user._id },
      { $set: pickPlanFields(req.body || {}) },
      { new: true, runValidators: true }
    );
    if (!plan) return res.status(404).json({ message: 'Lesson plan not found' });
    res.json(plan);
  } catch (err) {
    console.error('lesson-plan update error:', err);
    res.status(500).json({ message: 'Failed to update lesson plan' });
  }
});

// @desc    Delete a saved lesson plan
// @route   DELETE /api/lesson-plans/:id
// @access  Private (owner)
router.delete('/:id', isAdminOrTeacher, async (req, res) => {
  try {
    const plan = await LessonPlan.findOneAndDelete({ _id: req.params.id, createdBy: req.user._id });
    if (!plan) return res.status(404).json({ message: 'Lesson plan not found' });
    res.json({ message: 'Lesson plan deleted' });
  } catch (err) {
    console.error('lesson-plan delete error:', err);
    res.status(500).json({ message: 'Failed to delete lesson plan' });
  }
});

// @desc    Download a saved lesson plan as PDF
// @route   GET /api/lesson-plans/:id/pdf
// @access  Private (owner)
router.get('/:id/pdf', isAdminOrTeacher, async (req, res) => {
  try {
    const plan = await LessonPlan.findOne({ _id: req.params.id, createdBy: req.user._id }).lean();
    if (!plan) return res.status(404).json({ message: 'Lesson plan not found' });
    streamLessonPlanPdf(res, plan);
  } catch (err) {
    console.error('lesson-plan pdf error:', err);
    if (!res.headersSent) res.status(500).json({ message: 'Failed to generate PDF' });
  }
});

module.exports = router;
