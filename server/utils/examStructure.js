/**
 * Structural clean-up for AI-generated / AI-extracted exams.
 *
 * Getting valid JSON back from the model (see utils/jsonRepair.js) is only half the job - the
 * JSON also has to be a *gradeable* exam. The recurring defects, all of which the grading code
 * then has to paper over at submission time:
 *
 *  - An MCQ where `correctAnswer: "C"` is set but no option carries `isCorrect: true` (or the
 *    other way round, or the two disagree). gradeExam.js falls back to asking the AI to work out
 *    the answer for every such question - one extra API call each, and a guess rather than the
 *    teacher's key.
 *  - `correctAnswer` written as "C.", "(c)", "Option C" or the option's full text instead of a
 *    bare letter, which the `^[A-D]$` check in gradeExam.js does not recognise.
 *  - true-false questions whose correctAnswer is a letter or a real boolean. fastGrading.js
 *    compares the student's "True"/"False" against that string, so anything else marks every
 *    student wrong.
 *  - Duplicate/blank/mis-lettered options, blank question text, points of 0 or "5 marks".
 *  - Written questions (short-answer, open-ended) shipped with no model answer at all.
 *
 * Everything here is deterministic. Anything that cannot be resolved from the data is reported
 * as a warning for the teacher to fix in the editor rather than silently guessed at.
 */

// Option letters the Question schema will accept (models/Question.js). Anything outside this set
// fails Mongoose validation on save, so we re-letter rather than pass it through.
const ALLOWED_LETTERS = new Set([
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H',
  'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h',
  'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII',
  'i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii'
]);

const SEQUENTIAL_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

// Types that are answered by picking an option rather than by writing.
const CHOICE_TYPES = new Set(['multiple-choice', 'true-false']);

// Types whose correctAnswer is the model answer the grader marks against.
const WRITTEN_TYPES = new Set([
  'open-ended', 'essay', 'extended-response', 'short-answer', 'fill-blank', 'fill-in-blank', 'numerical'
]);

const asText = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
};

/**
 * Pull a bare option letter out of whatever the model wrote: "C", "c)", "(C)", "C.", "Option C",
 * "Answer: C", "iii)".
 * @param {*} value
 * @returns {string|null}
 */
const extractLetter = (value) => {
  const raw = asText(value).trim();
  if (!raw) return null;

  const cleaned = raw
    .replace(/^(the\s+)?(correct\s+)?(answer|option|choice)\s*(is)?\s*[:\-.]?\s*/i, '')
    .replace(/^[('"\[]+/, '')
    .replace(/[)'"\].:,]+$/, '')
    .trim();

  if (!cleaned) return null;
  if (/^[A-Ha-h]$/.test(cleaned)) return cleaned;
  if (/^(i{1,3}|iv|v|vi{1,3}|viii)$/i.test(cleaned)) return cleaned;
  return null;
};

/**
 * Normalize anything the model might write for a true/false answer into exactly "True"/"False".
 * fastGrading.js string-compares the student's answer against this, so the casing and the word
 * itself both matter.
 * @param {*} value
 * @returns {'True'|'False'|null}
 */
const extractTrueFalse = (value) => {
  if (value === true) return 'True';
  if (value === false) return 'False';
  const raw = asText(value).trim().toLowerCase().replace(/[.()]/g, '');
  if (!raw) return null;
  if (['true', 't', 'yes', 'y', 'correct'].includes(raw)) return 'True';
  if (['false', 'f', 'no', 'n', 'incorrect'].includes(raw)) return 'False';
  return null;
};

/**
 * Coerce a marks value that arrived as "5", "5 marks", 0 or undefined into a usable number.
 * @param {*} value
 * @returns {number|null} null when there is nothing sensible to read
 */
const toPoints = (value) => {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  const match = asText(value).match(/-?\d+(\.\d+)?/);
  if (!match) return null;
  const parsed = parseFloat(match[0]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const normalizeText = (value) => asText(value).replace(/\s+/g, ' ').trim();

/**
 * Clean up an option list and decide which option is the key.
 *
 * Letters the model supplied are kept as-is when they form a valid, unique set - language papers
 * legitimately use i/ii/iii for sub-question options and re-lettering them to A/B/C would change
 * what the paper looks like. They are only replaced when they are missing, duplicated or outside
 * what the schema accepts.
 *
 * @returns {{ options: Array, correctLetters: string[] }}
 */
const normalizeOptions = (rawOptions, warn) => {
  const list = Array.isArray(rawOptions) ? rawOptions : [];

  const options = list
    .map((opt, idx) => {
      if (typeof opt === 'string') return { text: normalizeText(opt), isCorrect: false, letter: null, index: idx };
      if (!opt || typeof opt !== 'object') return null;
      return {
        text: normalizeText(opt.text ?? opt.label ?? opt.value ?? opt.option),
        isCorrect: opt.isCorrect === true || opt.correct === true,
        letter: asText(opt.letter ?? opt.key ?? opt.id).trim() || null,
        index: idx
      };
    })
    .filter(opt => opt && opt.text);

  if (options.length !== list.length) {
    warn('blank-option', `${list.length - options.length} empty option(s) removed`);
  }

  // Two options with identical text make the question unanswerable - the student cannot pick the
  // "right" one and the grader cannot tell them apart.
  const seen = new Map();
  const deduped = [];
  for (const opt of options) {
    const key = opt.text.toLowerCase();
    if (seen.has(key)) {
      warn('duplicate-option', `duplicate option text "${opt.text}" removed`);
      // Keep the correct flag if the duplicate was the one marked correct.
      if (opt.isCorrect) seen.get(key).isCorrect = true;
      continue;
    }
    seen.set(key, opt);
    deduped.push(opt);
  }

  const lettersUsable = deduped.length > 0 &&
    deduped.every(opt => opt.letter && ALLOWED_LETTERS.has(opt.letter)) &&
    new Set(deduped.map(opt => opt.letter.toUpperCase())).size === deduped.length;

  if (!lettersUsable) {
    deduped.forEach((opt, idx) => {
      opt.letter = SEQUENTIAL_LETTERS[idx] || null;
    });
    if (deduped.length > SEQUENTIAL_LETTERS.length) {
      warn('too-many-options', `${deduped.length} options - only the first ${SEQUENTIAL_LETTERS.length} could be lettered`);
    }
  }

  return {
    options: deduped.map(({ text, isCorrect, letter }) => ({ text, isCorrect, letter })),
    correctLetters: deduped.filter(o => o.isCorrect && o.letter).map(o => o.letter)
  };
};

/**
 * Make an option-based question self-consistent: exactly one option flagged isCorrect (unless it
 * is genuinely a select-all-that-apply), and correctAnswer holding the matching bare letter.
 */
const reconcileChoiceQuestion = (question, warn) => {
  const { options } = normalizeOptions(question.options, warn);

  if (options.length === 0) {
    // true-false is still gradeable from correctAnswer alone (fastGrading compares the text), so
    // only a multiple-choice question with no options is actually broken.
    if (question.type === 'multiple-choice') {
      warn('no-options', 'multiple-choice question has no options', 'review');
    }
    question.options = [];
    return;
  }

  if (options.length === 1 && question.type === 'multiple-choice') {
    warn('single-option', 'multiple-choice question has only one option', 'review');
  }

  const flagged = options.filter(o => o.isCorrect);
  const answerLetter = extractLetter(question.correctAnswer);

  // Resolve the key, in order of how trustworthy the signal is.
  let keyed = null;
  if (answerLetter) {
    keyed = options.find(o => (o.letter || '').toUpperCase() === answerLetter.toUpperCase()) || null;
  }
  if (!keyed) {
    const answerText = normalizeText(question.correctAnswer).toLowerCase();
    if (answerText) keyed = options.find(o => o.text.toLowerCase() === answerText) || null;
  }
  if (!keyed && flagged.length === 1) {
    keyed = flagged[0];
  }

  if (keyed) {
    if (flagged.length > 1 && !flagged.includes(keyed)) {
      warn('answer-conflict', `correctAnswer "${asText(question.correctAnswer)}" did not match any flagged option`, 'review');
    }
    options.forEach(o => { o.isCorrect = o === keyed; });
    question.correctAnswer = keyed.letter || keyed.text;
  } else if (flagged.length > 1) {
    // Several options flagged and no single answer to arbitrate: treat it as select-all-that-
    // apply, which the grader already supports, rather than throwing away the model's flags.
    question.allowMultipleAnswers = true;
    question.correctAnswer = flagged.map(o => o.letter || o.text).join(', ');
    warn('multi-answer', `${flagged.length} options marked correct - treated as select-all-that-apply`);
  } else {
    warn('no-correct-answer', 'no correct option could be determined', 'review');
  }

  // true-false is graded by comparing answer TEXT, not the option letter, so the letter form we
  // set above would mark every student wrong.
  if (question.type === 'true-false') {
    const correct = options.find(o => o.isCorrect);
    const tf = extractTrueFalse(correct ? correct.text : question.correctAnswer);
    if (tf) {
      question.correctAnswer = tf;
      options.forEach(o => {
        const optTf = extractTrueFalse(o.text);
        if (optTf) o.text = optTf;
        o.isCorrect = optTf === tf;
      });
    }
  }

  question.options = options;
};

/**
 * true-false questions that arrived without any options at all - still normalize the answer to
 * the exact "True"/"False" the grader compares against.
 */
const reconcileBareTrueFalse = (question, warn) => {
  const tf = extractTrueFalse(question.correctAnswer);
  if (tf) {
    question.correctAnswer = tf;
  } else {
    warn('no-correct-answer', 'true-false question has no usable True/False answer', 'review');
  }
};

/**
 * Matching questions: the grader reads matchingPairs.correctPairs, but the model often only fills
 * in correctMatches ({"Doctor": 0}) or leaves the pairs empty while listing both columns.
 */
const reconcileMatching = (question, warn) => {
  const left = Array.isArray(question.leftItems) ? question.leftItems.filter(v => asText(v).trim()) : [];
  const right = Array.isArray(question.rightItems) ? question.rightItems.filter(v => asText(v).trim()) : [];

  if (left.length === 0 || right.length === 0) {
    warn('matching-incomplete', 'matching question is missing one of its two columns', 'review');
    return;
  }

  question.leftItems = left;
  question.rightItems = right;

  const pairs = question.matchingPairs || {};
  let correctPairs = Array.isArray(pairs.correctPairs) ? pairs.correctPairs.filter(Boolean) : [];

  if (correctPairs.length === 0 && question.correctMatches && typeof question.correctMatches === 'object') {
    correctPairs = Object.entries(question.correctMatches)
      .map(([leftValue, rightIndex]) => {
        const rightValue = typeof rightIndex === 'number' ? right[rightIndex] : rightIndex;
        return rightValue === undefined ? null : { left: leftValue, right: rightValue };
      })
      .filter(Boolean);
  }

  question.matchingPairs = {
    leftColumn: pairs.leftColumn?.length ? pairs.leftColumn : left,
    rightColumn: pairs.rightColumn?.length ? pairs.rightColumn : right,
    correctPairs
  };

  if (correctPairs.length === 0) {
    warn('matching-unkeyed', 'matching question has no correct pairs', 'review');
  }
};

/**
 * Ordering questions: the grader reads itemsToOrder.correctOrder as an array of indices.
 */
const reconcileOrdering = (question, warn) => {
  const items = Array.isArray(question.items) && question.items.length
    ? question.items
    : (question.itemsToOrder?.items || []);

  if (!items.length) {
    warn('ordering-incomplete', 'ordering question has no items', 'review');
    return;
  }

  let order = question.itemsToOrder?.correctOrder;
  if (!Array.isArray(order) || order.length !== items.length) {
    order = Array.isArray(question.correctAnswer) ? question.correctAnswer : null;
  }
  if (!Array.isArray(order) || order.length !== items.length || order.some(n => typeof n !== 'number')) {
    order = items.map((_, idx) => idx);
    warn('ordering-unkeyed', 'ordering question had no valid correct order - defaulted to the listed order', 'review');
  }

  question.items = items;
  question.itemsToOrder = { items, correctOrder: order };
};

/**
 * Normalize one question (or one sub-question) in place.
 * @param {Object} question
 * @param {Object} ctx - { mapType, warn, isSubQuestion }
 */
const normalizeQuestion = (question, ctx) => {
  const { mapType, warn } = ctx;

  question.type = mapType(question.type);
  question.text = normalizeText(question.text ?? question.question ?? question.prompt);

  if (!question.text && !question.imageUrl) {
    warn('blank-text', 'question has no text', 'review');
  }

  // Sub-questions first, so the parent's marks can fall back to their total.
  const subQuestions = Array.isArray(question.subQuestions) ? question.subQuestions.filter(Boolean) : [];
  if (subQuestions.length > 0) {
    subQuestions.forEach((sub, idx) => {
      normalizeQuestion(sub, {
        ...ctx,
        warn: (code, detail, severity) => warn(code, `part ${sub.label || idx + 1}: ${detail}`, severity),
        isSubQuestion: true
      });
    });
    question.subQuestions = subQuestions;
  }

  const points = toPoints(question.points ?? question.marks);
  if (points === null) {
    const subTotal = subQuestions.reduce((sum, sub) => sum + (toPoints(sub.points) || 0), 0);
    question.points = subTotal > 0 ? subTotal : 1;
    if (!ctx.isSubQuestion) warn('missing-marks', `no marks given - defaulted to ${question.points}`);
  } else {
    question.points = points;
  }

  // Arrays/objects where the schema wants a string would fail validation on save.
  if (question.correctAnswer !== null && question.correctAnswer !== undefined && typeof question.correctAnswer !== 'string') {
    if (Array.isArray(question.correctAnswer) && !['ordering', 'matching'].includes(question.type)) {
      question.correctAnswer = question.correctAnswer.map(v => asText(v)).filter(Boolean).join(', ');
    } else if (typeof question.correctAnswer === 'boolean' || typeof question.correctAnswer === 'number') {
      question.correctAnswer = String(question.correctAnswer);
    }
  }

  if (CHOICE_TYPES.has(question.type)) {
    if (Array.isArray(question.options) && question.options.length > 0) {
      reconcileChoiceQuestion(question, warn);
    } else if (question.type === 'true-false') {
      reconcileBareTrueFalse(question, warn);
    } else {
      reconcileChoiceQuestion(question, warn);
    }
  } else if (question.type === 'matching') {
    reconcileMatching(question, warn);
  } else if (question.type === 'ordering') {
    reconcileOrdering(question, warn);
  } else if (WRITTEN_TYPES.has(question.type)) {
    // A written question with no model answer forces the grader to invent a rubric per student.
    const answer = normalizeText(question.correctAnswer);
    if (!answer && subQuestions.length === 0) {
      warn('no-model-answer', 'no model answer provided', 'review');
    } else if (answer) {
      question.correctAnswer = asText(question.correctAnswer).trim();
    }
  }

  // gradingCriteria must be [{criteria, points}] - the model sometimes returns plain strings.
  if (question.gradingCriteria !== undefined) {
    const criteria = Array.isArray(question.gradingCriteria)
      ? question.gradingCriteria
      : (question.gradingCriteria ? [question.gradingCriteria] : []);
    question.gradingCriteria = criteria
      .map(item => {
        if (typeof item === 'string') return { criteria: item, points: 1 };
        if (!item || typeof item !== 'object') return null;
        return {
          criteria: asText(item.criteria ?? item.criterion ?? item.description).trim(),
          points: toPoints(item.points ?? item.mark) || 1
        };
      })
      .filter(item => item && item.criteria);
  }
};

/**
 * Validate and repair a whole generated exam, in place.
 *
 * @param {Object} exam - the parsed exam ({ title, sections: [{ name, questions: [...] }] })
 * @param {Object} [options]
 * @param {(type: string) => string} [options.mapType] - canonical question-type mapper
 * @returns {{ warnings: Array, stats: Object }} warnings are per-question notes for the teacher
 */
const normalizeExamStructure = (exam, options = {}) => {
  const mapType = typeof options.mapType === 'function' ? options.mapType : (t) => t;
  const warnings = [];
  const stats = { questions: 0, fixed: 0, needsReview: 0, sections: 0 };

  if (!exam || typeof exam !== 'object') return { warnings, stats };

  const makeWarn = (sectionName, questionNumber, questionText) => (code, detail, severity = 'fixed') => {
    warnings.push({
      section: sectionName,
      question: questionNumber,
      preview: questionText.slice(0, 80),
      code,
      detail,
      severity
    });
    if (severity === 'review') stats.needsReview++;
    else stats.fixed++;
  };

  const processQuestionList = (questions, sectionName) => {
    if (!Array.isArray(questions)) return [];
    const kept = questions.filter(q => q && typeof q === 'object');
    kept.forEach((question, idx) => {
      stats.questions++;
      const preview = normalizeText(question.text ?? question.question ?? '');
      normalizeQuestion(question, { mapType, warn: makeWarn(sectionName, idx + 1, preview) });
    });
    return kept;
  };

  if (Array.isArray(exam.sections)) {
    exam.sections.forEach((section, idx) => {
      if (!section || typeof section !== 'object') return;
      stats.sections++;
      if (!section.name) section.name = String.fromCharCode(65 + idx);
      section.questions = processQuestionList(section.questions, section.name);
      if (Array.isArray(section.subsections)) {
        section.subsections.forEach(subsection => {
          if (!subsection || typeof subsection !== 'object') return;
          subsection.questions = processQuestionList(subsection.questions, `${section.name}${subsection.name ? '.' + subsection.name : ''}`);
        });
      }
    });
  }

  if (Array.isArray(exam.questions)) {
    exam.questions = processQuestionList(exam.questions, 'main');
  }

  // Exam-level defaults, so a missing header field never blocks saving a draft.
  if (!normalizeText(exam.title)) exam.title = 'Generated Exam';
  if (!toPoints(exam.timeLimit)) exam.timeLimit = 60;
  if (exam.passingScore === undefined || exam.passingScore === null || !Number.isFinite(Number(exam.passingScore))) {
    exam.passingScore = 70;
  }

  return { warnings, stats };
};

module.exports = {
  normalizeExamStructure,
  extractLetter,
  extractTrueFalse,
  toPoints
};
