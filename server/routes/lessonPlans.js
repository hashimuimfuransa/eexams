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
const { requireLessonPlanner, resolveEffectivePlan } = require('../middleware/planRestrictions');
const { getPlanConfigForUser } = require('../config/plans');
const { getAllQuotaStatus, checkQuota } = require('../utils/plannerQuotas');
const { aiGradingLimiter, uploadLimiter } = require('../middleware/rateLimiter');
const groqClient = require('../utils/groqClient');
const { streamLessonPlanPdf } = require('../utils/lessonPlanPdf');
const { sendDocx } = require('../utils/docxExport');
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
//
// requireLessonPlanner guards the authoring routes only. A teacher whose plan
// no longer covers the planner (or who moved to an exams-only plan) can still
// list, open and download the plans they already wrote — their own work is not
// held hostage by the scope gate, they simply can't author new ones.

// @desc    Read a book/curriculum file and return its text (nothing is stored)
// @route   POST /api/lesson-plans/extract
// @access  Private (teacher/admin)
router.post('/extract', uploadLimiter, isAdminOrTeacher, requireLessonPlanner, (req, res) => {
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
// @access  Private (teacher/admin, within this month's Lesson Planner allowance)
// Deliberately NOT behind requireAIFeatures. The Lesson Planner is now sold by
// monthly output volume, and the Free tier's headline is "4 lesson plans/mo" —
// gating generation on the aiFeatures flag (false on Free) would make that
// number unusable. The allowance below is what limits free usage instead;
// requireAIFeatures still guards the exam-side AI routes, which are a
// different product.
router.post('/generate', aiGradingLimiter, isAdminOrTeacher, requireLessonPlanner, async (req, res) => {
  try {
    const { brief: rawBrief, referenceContent: rawReference, sourceFileName = '', ...rest } = req.body || {};
    // Coerce rather than trust: a non-string here would throw on .trim().
    const brief = typeof rawBrief === 'string' ? rawBrief : '';
    const referenceContent = typeof rawReference === 'string' ? rawReference : '';

    // Checked before the model call, not after: generating a plan the teacher
    // has no allowance left to save would burn an AI call for nothing.
    const planConfig = await resolvePlannerPlan(req.user);
    const quota = await checkQuota(req.user._id, planConfig, 'lessonPlansPerMonth');
    if (!quota.ok) {
      return res.status(403).json(quota.body);
    }

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

// @desc    Download a DOCX of a plan that has not been saved yet
// @route   POST /api/lesson-plans/docx
// @access  Private (teacher/admin)
router.post('/docx', isAdminOrTeacher, requireLessonPlanner, async (req, res) => {
  try {
    await sendDocx(res, pickPlanFields(req.body || {}), 'lessonPlan');
  } catch (err) {
    console.error('lesson-plan docx error:', err);
    if (!res.headersSent) res.status(500).json({ message: 'Failed to generate the Word document' });
  }
});

// @desc    Download a PDF of a plan that has not been saved yet
// @route   POST /api/lesson-plans/pdf
// @access  Private (teacher/admin)
router.post('/pdf', isAdminOrTeacher, requireLessonPlanner, (req, res) => {
  try {
    const plan = pickPlanFields(req.body || {});
    streamLessonPlanPdf(res, plan);
  } catch (err) {
    console.error('lesson-plan pdf error:', err);
    if (!res.headersSent) res.status(500).json({ message: 'Failed to generate PDF' });
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────

// Has the teacher already created a lesson plan today (UTC)?
// Resolve the caller's plan, then its Lesson Planner allowance. The old rule
// here was a flat "one lesson plan per teacher per day" for everyone; output
// volume is now what the plans actually sell, so the number comes from the
// plan the teacher is on (see utils/plannerQuotas.js).
const resolvePlannerPlan = async (user) => {
  const { plan, userType, planRef } = await resolveEffectivePlan(user);
  return getPlanConfigForUser(plan, userType, planRef);
};

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

// @desc    This month's Lesson Planner allowance and how much of it is used
// @route   GET /api/lesson-plans/quota
// @access  Private (teacher/admin)
const respondWithQuota = async (req, res) => {
  try {
    const planConfig = await resolvePlannerPlan(req.user);
    const quotas = await getAllQuotaStatus(req.user._id, planConfig);
    const lessonPlans = quotas.find((q) => q.key === 'lessonPlansPerMonth');

    res.json({
      planName: planConfig.name,
      scope: planConfig.scope || 'both',
      periodStart: lessonPlans.periodStart,
      periodEnd: lessonPlans.periodEnd,
      quotas,
      // canCreate/used/limit are the flat fields the planner UI reads.
      canCreate: lessonPlans.allowed,
      used: lessonPlans.used,
      limit: lessonPlans.limit,
      remaining: lessonPlans.remaining
    });
  } catch (err) {
    console.error('lesson-plan quota error:', err);
    res.status(500).json({ message: 'Failed to check plan limit' });
  }
};

router.get('/quota', isAdminOrTeacher, respondWithQuota);

// Kept so a browser still running the previous build doesn't break — same
// payload, which already carries canCreate.
router.get('/today-status', isAdminOrTeacher, respondWithQuota);

// @desc    Save a (reviewed) lesson plan
// @route   POST /api/lesson-plans
// @access  Private (teacher/admin)
router.post('/', isAdminOrTeacher, requireLessonPlanner, attachOrgAdminId, async (req, res) => {
  try {
    const fields = pickPlanFields(req.body || {});
    if (!fields.lessonTitle && !fields.subject) {
      return res.status(400).json({ message: 'A lesson title or subject is required before saving.' });
    }

    // Monthly allowance from the teacher's plan, not a flat per-day rule.
    const planConfig = await resolvePlannerPlan(req.user);
    const quota = await checkQuota(req.user._id, planConfig, 'lessonPlansPerMonth');
    if (!quota.ok) {
      return res.status(403).json(quota.body);
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
router.put('/:id', isAdminOrTeacher, requireLessonPlanner, async (req, res) => {
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

// @desc    Download a saved lesson plan as DOCX
// @route   GET /api/lesson-plans/:id/docx
// @access  Private (owner)
router.get('/:id/docx', isAdminOrTeacher, async (req, res) => {
  try {
    const plan = await LessonPlan.findOne({ _id: req.params.id, createdBy: req.user._id }).lean();
    if (!plan) return res.status(404).json({ message: 'Lesson plan not found' });
    await sendDocx(res, plan, 'lessonPlan');
  } catch (err) {
    console.error('lesson-plan docx error:', err);
    if (!res.headersSent) res.status(500).json({ message: 'Failed to generate the Word document' });
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
