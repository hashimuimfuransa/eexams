const mongoose = require('mongoose');
const Exam = require('../models/Exam');
const { streamExamPdf, summarise, resolveAnswer, pointsOf } = require('../utils/examPdf');

// The exam bank is every exam a teacher has published publicly. A school admin
// browses it here, previews a paper in full, and downloads it as two separate
// documents: the question paper, and the marking guide.

/** The one filter that defines "in the exam bank" — kept in one place. */
const EXAM_BANK_FILTER = {
  isPubliclyListed: true,
  isLocked: false,
  status: { $ne: 'template' }
};

/** Everything the preview and the PDFs need off a Question. */
const QUESTION_FIELDS = [
  'text', 'type', 'points', 'marks', 'section', 'options', 'correctAnswer', 'answerKey',
  'allowMultipleAnswers', 'multipleAnswerScoring', 'explanation', 'keyPoints',
  'gradingCriteria', 'acceptableAnswers', 'difficulty', 'passage', 'instructions',
  'wordBank', 'imageUrl', 'imageUrls', 'matchingPairs', 'leftItems', 'rightItems',
  'correctMatches', 'itemsToOrder', 'dragDropData', 'subQuestions', 'subQuestionConfig',
  'spreadsheetTemplate', 'spreadsheetModelAnswer', 'subsectionTitle', 'sectionTitle'
].join(' ');

/** Load one bank exam with every question populated, or null. */
const loadBankExam = async (examId) => {
  if (!mongoose.Types.ObjectId.isValid(examId)) return null;
  return Exam.findOne({ _id: examId, ...EXAM_BANK_FILTER })
    .populate({ path: 'sections.questions', select: QUESTION_FIELDS })
    .populate('level', 'name description')
    .populate('createdBy', 'firstName lastName organization')
    .lean();
};

/**
 * Strip every answer field out of a populated exam, for the preview a school
 * admin sees before they choose to reveal the guide.
 */
const withoutAnswers = (exam) => ({
  ...exam,
  sections: (exam.sections || []).map(section => ({
    ...section,
    questions: (section.questions || []).map(q => {
      const {
        correctAnswer, answerKey, explanation, keyPoints, gradingCriteria,
        acceptableAnswers, correctMatches, spreadsheetModelAnswer, ...rest
      } = q;
      return {
        ...rest,
        options: (q.options || []).map(({ isCorrect, ...o }) => o),
        matchingPairs: q.matchingPairs
          ? { leftColumn: q.matchingPairs.leftColumn, rightColumn: q.matchingPairs.rightColumn }
          : undefined,
        itemsToOrder: q.itemsToOrder ? { items: q.itemsToOrder.items } : undefined,
        dragDropData: q.dragDropData
          ? { dropZones: q.dragDropData.dropZones, draggableItems: q.dragDropData.draggableItems }
          : undefined,
        subQuestions: (q.subQuestions || []).map(sub => {
          const { correctAnswer: sa, writtenAnswerModelAnswer, spreadsheetModelAnswer: ss, ...subRest } = sub;
          return { ...subRest, options: (sub.options || []).map(({ isCorrect, ...o }) => o) };
        })
      };
    })
  }))
});

// @desc    Browse the exam bank with filters
// @route   GET /api/question-bank/browse
// @access  Private/Admin or Teacher
const browseExamBank = async (req, res) => {
  try {
    const { search, level, subLevel, audience, accessType } = req.query;

    const query = { ...EXAM_BANK_FILTER };
    if (level && mongoose.Types.ObjectId.isValid(level)) query.level = level;
    if (subLevel) query.subLevel = subLevel;
    if (audience) query.targetAudience = audience;
    if (accessType) query.accessType = accessType;

    if (search) {
      // Escape the user's text so a stray "(" can't throw a regex error.
      const safe = String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rx = new RegExp(safe, 'i');
      query.$or = [{ title: rx }, { description: rx }, { publicDescription: rx }, { targetAudience: rx }];
    }

    const exams = await Exam.find(query)
      .select('title description publicDescription targetAudience accessType timeLimit passingScore ' +
              'totalPoints sections createdAt createdBy level subLevel allowSelectiveAnswering calculatorEnabled')
      .populate('createdBy', 'firstName lastName organization')
      .populate('level', 'name')
      .populate({ path: 'sections.questions', select: 'type points marks' })
      .sort({ createdAt: -1 })
      .limit(300)
      .lean();

    // Filter options come from the whole bank, so narrowing one never empties
    // the choices offered for the others.
    const facetSource = await Exam.find(EXAM_BANK_FILTER)
      .select('targetAudience subLevel level accessType')
      .populate('level', 'name')
      .lean();

    const summaries = exams.map(exam => {
      const questions = (exam.sections || []).flatMap(s => s.questions || []);
      const typeCounts = questions.reduce((acc, q) => {
        const key = q.type || 'open-ended';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
      return {
        _id: exam._id,
        title: exam.title,
        description: exam.publicDescription || exam.description,
        targetAudience: exam.targetAudience || '',
        accessType: exam.accessType || 'subscription',
        level: exam.level?.name || '',
        subLevel: exam.subLevel || '',
        timeLimit: exam.timeLimit,
        passingScore: exam.passingScore,
        sectionsCount: (exam.sections || []).length,
        questionsCount: questions.length,
        totalPoints: questions.reduce((sum, q) => sum + pointsOf(q), 0) || exam.totalPoints || 0,
        questionTypes: typeCounts,
        author: exam.createdBy
          ? {
              name: `${exam.createdBy.firstName || ''} ${exam.createdBy.lastName || ''}`.trim(),
              organization: exam.createdBy.organization || ''
            }
          : null,
        createdAt: exam.createdAt
      };
    });

    res.json({
      exams: summaries,
      filters: {
        levels: [...new Map(
          facetSource.filter(e => e.level).map(e => [String(e.level._id), { _id: e.level._id, name: e.level.name }])
        ).values()].sort((a, b) => a.name.localeCompare(b.name)),
        subLevels: [...new Set(facetSource.map(e => e.subLevel).filter(Boolean))].sort(),
        audiences: [...new Set(facetSource.map(e => e.targetAudience).filter(Boolean))].sort(),
        accessTypes: [...new Set(facetSource.map(e => e.accessType).filter(Boolean))].sort()
      }
    });
  } catch (error) {
    console.error('Browse exam bank error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Full preview of one exam bank paper
// @route   GET /api/question-bank/:examId/preview?withAnswers=true
// @access  Private/Admin or Teacher
const previewExamBankExam = async (req, res) => {
  try {
    const exam = await loadBankExam(req.params.examId);
    if (!exam) {
      return res.status(404).json({ message: 'Exam not found in the exam bank' });
    }

    // Answers are opt-in: the default preview is the paper as a candidate sees it.
    const withAnswers = req.query.withAnswers === 'true';
    const totals = summarise(exam);

    const payload = withAnswers ? exam : withoutAnswers(exam);

    res.json({
      exam: {
        ...payload,
        author: exam.createdBy
          ? {
              name: `${exam.createdBy.firstName || ''} ${exam.createdBy.lastName || ''}`.trim(),
              organization: exam.createdBy.organization || ''
            }
          : null,
        createdBy: undefined
      },
      totals,
      withAnswers
    });
  } catch (error) {
    console.error('Preview exam bank exam error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Download an exam bank paper as a PDF
// @route   GET /api/question-bank/:examId/pdf?variant=questions|marking-guide
// @access  Private/Admin or Teacher
const downloadExamBankPdf = async (req, res) => {
  try {
    const variant = req.query.variant === 'marking-guide' ? 'marking-guide' : 'questions';
    const exam = await loadBankExam(req.params.examId);

    if (!exam) {
      return res.status(404).json({ message: 'Exam not found in the exam bank' });
    }

    streamExamPdf(res, exam, variant);
  } catch (error) {
    console.error('Download exam bank PDF error:', error);
    // Nothing has been piped at this point, so JSON is still a valid response.
    if (!res.headersSent) res.status(500).json({ message: 'Failed to build the exam PDF' });
  }
};

module.exports = {
  EXAM_BANK_FILTER,
  browseExamBank,
  previewExamBankExam,
  downloadExamBankPdf,
  withoutAnswers,
  resolveAnswer
};
