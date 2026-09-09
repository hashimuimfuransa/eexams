// Lesson Planner resources: slide decks, exercise sheets and schemes of work.
//
// Every route is generic over `:kind` (see KINDS in utils/plannerResourceBuilder.js)
// because the three share one lifecycle — AI draft, teacher edits, save, export
// as PDF or DOCX — and differ only in prompt, body shape and which monthly
// quota they spend. Splitting them into three routers would triple the same
// code and let their behaviour drift.
//
// Reference-file extraction is deliberately NOT duplicated here: the teacher
// uploads the textbook once through POST /api/lesson-plans/extract and the
// returned text is posted to whichever generator they use next.
const express = require('express');
const router = express.Router();

const PlannerResource = require('../models/PlannerResource');
const auth = require('../middleware/auth');
const { isAdminOrTeacher, attachOrgAdminId } = require('../middleware/role');
const { requireLessonPlanner, resolveEffectivePlan } = require('../middleware/planRestrictions');
const { getPlanConfigForUser } = require('../config/plans');
const { checkQuota, getAllQuotaStatus } = require('../utils/plannerQuotas');
const { aiGradingLimiter } = require('../middleware/rateLimiter');
const groqClient = require('../utils/groqClient');
const { str } = require('../utils/lessonPlanBuilder');
const { KINDS, clampCount, extractRelevantExcerpt } = require('../utils/plannerResourceBuilder');
const { streamPlannerResourcePdf } = require('../utils/plannerResourcePdf');
const { sendPptx } = require('../utils/slidesPptx');
const { THEME_KEYS, THEMES, DEFAULT_THEME } = require('../utils/slideThemes');
const { sendDocx } = require('../utils/docxExport');

router.use(auth);

const resolvePlannerPlan = async (user) => {
  const { plan, userType, planRef } = await resolveEffectivePlan(user);
  return getPlanConfigForUser(plan, userType, planRef);
};

// Turns :kind into its registry entry, 404-ing anything unknown before a
// handler can act on it.
const withKind = (req, res, next) => {
  const config = KINDS[req.params.kind];
  if (!config) {
    return res.status(404).json({ message: `Unknown resource type: ${req.params.kind}` });
  }
  req.kindConfig = config;
  next();
};

// Whitelist what a client may write, so an edited resource can be posted back
// wholesale without letting it set createdBy, timestamps or a different kind.
const pickFields = (kindConfig, body = {}) => {
  const normalized = kindConfig.normalize(body, {});
  return {
    ...normalized,
    kind: kindConfig.kind,
    theme: THEME_KEYS.includes(body.theme) ? body.theme : (normalized.theme || DEFAULT_THEME),
    schoolName: str(body.schoolName),
    teacherName: str(body.teacherName),
    term: str(body.term) || normalized.term || '',
    academicYear: str(body.academicYear) || normalized.academicYear || '',
    duration: str(body.duration),
    sourcePrompt: str(body.sourcePrompt),
    sourceFileName: str(body.sourceFileName),
    generatedByAI: body.generatedByAI !== false
  };
};

// ── Quota ────────────────────────────────────────────────────────────────────

// @desc    This month's allowance across every planner output
// @route   GET /api/planner-resources/quota
// @access  Private (teacher/admin)
router.get('/quota', isAdminOrTeacher, async (req, res) => {
  try {
    const planConfig = await resolvePlannerPlan(req.user);
    const quotas = await getAllQuotaStatus(req.user._id, planConfig);
    res.json({
      planName: planConfig.name,
      scope: planConfig.scope || 'both',
      periodStart: quotas[0]?.periodStart,
      periodEnd: quotas[0]?.periodEnd,
      quotas
    });
  } catch (err) {
    console.error('planner-resource quota error:', err);
    res.status(500).json({ message: 'Failed to check your monthly allowance' });
  }
});

// @desc    Slide deck design themes offered in the studio
// @route   GET /api/planner-resources/themes
// @access  Private (teacher/admin)
router.get('/themes', isAdminOrTeacher, (req, res) => {
  res.json({
    defaultTheme: DEFAULT_THEME,
    themes: THEME_KEYS.map((key) => ({
      key,
      name: THEMES[key].name,
      description: THEMES[key].description,
      // Enough colour for the picker to render a true swatch of each theme.
      swatch: {
        deep: `#${THEMES[key].deep}`,
        accent: `#${THEMES[key].accent}`,
        accentSoft: `#${THEMES[key].accentSoft}`
      }
    }))
  });
});

// ── Generate ─────────────────────────────────────────────────────────────────

// @desc    Draft a resource with AI (not saved — the teacher reviews first)
// @route   POST /api/planner-resources/:kind/generate
// @access  Private (teacher/admin, within this month's allowance)
router.post('/:kind/generate', aiGradingLimiter, isAdminOrTeacher, requireLessonPlanner, withKind, async (req, res) => {
  const kindConfig = req.kindConfig;
  try {
    const { brief: rawBrief, referenceContent: rawReference, count, questionType, ...rest } = req.body || {};
    const brief = typeof rawBrief === 'string' ? rawBrief : '';
    const referenceContent = typeof rawReference === 'string' ? rawReference : '';

    // Checked before the model call: drafting something the teacher has no
    // allowance left to save would burn an AI call for nothing.
    const planConfig = await resolvePlannerPlan(req.user);
    const quota = await checkQuota(req.user._id, planConfig, kindConfig.quotaKey);
    if (!quota.ok) {
      return res.status(403).json(quota.body);
    }

    if (!brief.trim() && !referenceContent.trim()) {
      return res.status(400).json({
        message: `Tell us what to prepare, or attach the book first.`
      });
    }

    const details = {
      title: str(rest.title),
      subject: str(rest.subject),
      className: str(rest.className),
      term: str(rest.term),
      unitTitle: str(rest.unitTitle),
      academicYear: str(rest.academicYear),
      language: str(rest.language, 'auto'),
      theme: THEME_KEYS.includes(rest.theme) ? rest.theme : DEFAULT_THEME
    };

    const reference = referenceContent ? extractRelevantExcerpt(referenceContent, brief) : '';
    const prompt = kindConfig.buildPrompt({
      brief: brief.trim(),
      details,
      reference,
      count: clampCount(count, kindConfig.defaultCount, kindConfig.maxCount),
      questionType
    });

    const result = await groqClient.generateContent(prompt, {
      model: 'smart',
      jsonMode: true,
      temperature: 0.4,
      maxTokens: 6000
    });

    let parsed = result.parsedContent;
    if (!parsed && result.text) {
      const match = result.text.match(/\{[\s\S]*\}/);
      if (match) {
        try { parsed = JSON.parse(match[0]); } catch { parsed = null; }
      }
    }

    if (!parsed || typeof parsed !== 'object') {
      return res.status(422).json({
        message: `The AI could not build a ${kindConfig.label.toLowerCase()} from that. Add a bit more detail and try again.`
      });
    }

    const resource = kindConfig.normalize(parsed, details);
    if (!resource[kindConfig.bodyKey]?.length) {
      return res.status(422).json({ message: kindConfig.emptyMessage });
    }

    res.json({
      ...resource,
      kind: kindConfig.kind,
      sourcePrompt: brief.trim(),
      sourceFileName: str(rest.sourceFileName),
      generatedByAI: true
    });
  } catch (err) {
    console.error(`planner-resource generate (${kindConfig.kind}) error:`, err);
    res.status(500).json({ message: `Failed to generate the ${kindConfig.label.toLowerCase()}` });
  }
});

// ── Library ──────────────────────────────────────────────────────────────────

// @desc    List the current teacher's saved resources of one kind
// @route   GET /api/planner-resources/:kind
// @access  Private (teacher/admin)
router.get('/:kind', isAdminOrTeacher, withKind, async (req, res) => {
  try {
    const list = await PlannerResource.find({ createdBy: req.user._id, kind: req.kindConfig.kind })
      .sort({ updatedAt: -1 })
      .limit(100);
    res.json(list);
  } catch (err) {
    console.error('planner-resource list error:', err);
    res.status(500).json({ message: 'Failed to load your saved resources' });
  }
});

// @desc    Save a (reviewed) resource — spends one of this month's allowance
// @route   POST /api/planner-resources/:kind
// @access  Private (teacher/admin)
router.post('/:kind', isAdminOrTeacher, requireLessonPlanner, withKind, attachOrgAdminId, async (req, res) => {
  const kindConfig = req.kindConfig;
  try {
    const fields = pickFields(kindConfig, req.body || {});
    if (!fields[kindConfig.bodyKey]?.length) {
      return res.status(400).json({ message: `Add at least one ${kindConfig.countLabel.replace(/s$/, '')} before saving.` });
    }

    const planConfig = await resolvePlannerPlan(req.user);
    const quota = await checkQuota(req.user._id, planConfig, kindConfig.quotaKey);
    if (!quota.ok) {
      return res.status(403).json(quota.body);
    }

    const resource = await PlannerResource.create({
      ...fields,
      createdBy: req.user._id,
      orgAdminId: req.orgAdminId || req.user._id
    });

    res.status(201).json(resource);
  } catch (err) {
    console.error('planner-resource save error:', err);
    res.status(500).json({ message: 'Failed to save' });
  }
});

// @desc    Read one saved resource
// @route   GET /api/planner-resources/:kind/:id
// @access  Private (owner)
router.get('/:kind/:id', isAdminOrTeacher, withKind, async (req, res) => {
  try {
    const resource = await PlannerResource.findOne({
      _id: req.params.id, kind: req.kindConfig.kind, createdBy: req.user._id
    });
    if (!resource) return res.status(404).json({ message: 'Not found' });
    res.json(resource);
  } catch (err) {
    console.error('planner-resource read error:', err);
    res.status(500).json({ message: 'Failed to load' });
  }
});

// @desc    Update a saved resource — edits are free, only new ones cost quota
// @route   PUT /api/planner-resources/:kind/:id
// @access  Private (owner)
router.put('/:kind/:id', isAdminOrTeacher, requireLessonPlanner, withKind, async (req, res) => {
  try {
    const resource = await PlannerResource.findOneAndUpdate(
      { _id: req.params.id, kind: req.kindConfig.kind, createdBy: req.user._id },
      { $set: pickFields(req.kindConfig, req.body || {}) },
      { new: true, runValidators: true }
    );
    if (!resource) return res.status(404).json({ message: 'Not found' });
    res.json(resource);
  } catch (err) {
    console.error('planner-resource update error:', err);
    res.status(500).json({ message: 'Failed to update' });
  }
});

// @desc    Delete a saved resource
// @route   DELETE /api/planner-resources/:kind/:id
// @access  Private (owner)
router.delete('/:kind/:id', isAdminOrTeacher, withKind, async (req, res) => {
  try {
    const resource = await PlannerResource.findOneAndDelete({
      _id: req.params.id, kind: req.kindConfig.kind, createdBy: req.user._id
    });
    if (!resource) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('planner-resource delete error:', err);
    res.status(500).json({ message: 'Failed to delete' });
  }
});

// ── Export ───────────────────────────────────────────────────────────────────
//
// Exporting costs no quota — the teacher already paid for the output when it
// was created, and re-downloading a document they own must not be rationed.
// The unsaved variants let a draft be downloaded before it is committed.

// @desc    Download an unsaved draft
// @route   POST /api/planner-resources/:kind/export/:format(pdf|docx|pptx)
// @access  Private (teacher/admin)
router.post('/:kind/export/:format', isAdminOrTeacher, requireLessonPlanner, withKind, async (req, res) => {
  try {
    const resource = pickFields(req.kindConfig, req.body || {});
    // PowerPoint only makes sense for a deck — the other kinds are documents.
    if (req.params.format === 'pptx') {
      if (req.kindConfig.kind !== 'slides') {
        return res.status(400).json({ message: 'PowerPoint export is only available for slide decks' });
      }
      return await sendPptx(res, resource);
    }
    if (req.params.format === 'docx') return await sendDocx(res, resource, req.kindConfig.kind);
    if (req.params.format === 'pdf') return streamPlannerResourcePdf(res, resource);
    return res.status(400).json({ message: 'Format must be pdf, docx or pptx' });
  } catch (err) {
    console.error('planner-resource export error:', err);
    if (!res.headersSent) res.status(500).json({ message: 'Failed to generate the file' });
  }
});

// @desc    Download a saved resource
// @route   GET /api/planner-resources/:kind/:id/export/:format(pdf|docx|pptx)
// @access  Private (owner)
router.get('/:kind/:id/export/:format', isAdminOrTeacher, withKind, async (req, res) => {
  try {
    const resource = await PlannerResource.findOne({
      _id: req.params.id, kind: req.kindConfig.kind, createdBy: req.user._id
    }).lean();
    if (!resource) return res.status(404).json({ message: 'Not found' });

    if (req.params.format === 'pptx') {
      if (req.kindConfig.kind !== 'slides') {
        return res.status(400).json({ message: 'PowerPoint export is only available for slide decks' });
      }
      return await sendPptx(res, resource);
    }
    if (req.params.format === 'docx') return await sendDocx(res, resource, req.kindConfig.kind);
    if (req.params.format === 'pdf') return streamPlannerResourcePdf(res, resource);
    return res.status(400).json({ message: 'Format must be pdf, docx or pptx' });
  } catch (err) {
    console.error('planner-resource export error:', err);
    if (!res.headersSent) res.status(500).json({ message: 'Failed to generate the file' });
  }
});

module.exports = router;
