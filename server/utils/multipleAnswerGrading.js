/**
 * "Select all that apply" multiple-choice grading.
 *
 * A single-answer MCQ is graded by comparing one letter to one letter. A multi-answer question
 * needs set comparison, partial credit and a penalty for over-ticking - otherwise a student who
 * selects every option scores full marks. Every grading path in the app (the immediate mark on
 * save, fast chunked grading on submit, the enhanced grader and the regrade paths) delegates here
 * so one question is marked identically no matter which route reached it.
 *
 * Scoring, with C = the correct options and S = what the student ticked:
 *   all-or-nothing : full marks only when S === C, otherwise 0
 *   partial        : points × max(0, (|S∩C| − |S\C|) / |C|)
 *                    i.e. each correct tick earns 1/|C| of the marks and each wrong tick loses
 *                    the same, floored at zero. The penalty is what stops "tick everything" from
 *                    being a winning strategy: with as many wrong options as right ones, ticking
 *                    them all scores zero. Where the correct options outnumber the wrong ones,
 *                    ticking everything still loses marks but cannot reach zero - use
 *                    all-or-nothing scoring if that matters for a particular question.
 */

/** Letter for an option, falling back to its position (A, B, C...) when unlabelled. */
function optionLetter(option, index) {
  if (option && typeof option === 'object' && option.letter) {
    return String(option.letter).trim().toUpperCase();
  }
  return String.fromCharCode(65 + index);
}

/** Display text of an option, tolerating the string/object shapes stored across the app. */
function optionText(option) {
  if (option === null || option === undefined) return '';
  if (typeof option === 'string') return option;
  if (typeof option === 'object') return String(option.text || option.value || option.label || '');
  return String(option);
}

/** Normalized options as `{ letter, text, isCorrect }`, in their stored order. */
function normalizeOptions(question) {
  const options = Array.isArray(question?.options) ? question.options : [];
  return options.map((opt, index) => ({
    letter: optionLetter(opt, index),
    text: optionText(opt),
    isCorrect: !!(opt && typeof opt === 'object' && (opt.isCorrect || opt.correct))
  }));
}

/** Case/space-insensitive comparison key for matching an answer string to an option. */
function normalizeText(value) {
  return String(value === null || value === undefined ? '' : value)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The options that make up the marking key. Falls back to parsing `correctAnswer` (e.g. "A, C" or
 * "A and C") when no option carries an isCorrect flag, which is common for imported papers.
 */
function getCorrectOptions(question) {
  const options = normalizeOptions(question);
  const flagged = options.filter(opt => opt.isCorrect);
  if (flagged.length > 0) return flagged;

  const key = question?.correctAnswer;
  if (!key || typeof key !== 'string') return [];

  // Letters listed in the key ("A, C", "A and C", "A & C") - only trusted when every token is a
  // single letter naming a real option, so prose like "Oxygen and Nitrogen" or a full sentence is
  // never mistaken for a letter list.
  const letterTokens = key
    .toUpperCase()
    .replace(/\bAND\b|\bOR\b/g, ' ')
    .split(/[^A-Z]+/)
    .filter(Boolean);
  if (letterTokens.length > 1 && letterTokens.every(t => t.length === 1)) {
    const matched = options.filter(opt => letterTokens.includes(opt.letter));
    if (matched.length === letterTokens.length) return matched;
  }

  // Otherwise try to match the key against option text.
  const keyNorm = normalizeText(key);
  const textMatch = options.filter(opt => opt.text && normalizeText(opt.text) === keyNorm);
  if (textMatch.length > 0) return textMatch;

  return [];
}

/**
 * Whether this question should be marked as "select all that apply": either the teacher enabled
 * it, or the marking key simply has more than one correct option.
 */
function isMultipleAnswerQuestion(question) {
  if (!question) return false;
  if (question.allowMultipleAnswers === true) return true;
  return getCorrectOptions(question).length > 1;
}

/**
 * Resolve whatever the student's answer holds into the options they actually ticked.
 *
 * Accepts (in order of preference) the `selectedOptions` / `selectedOptionLetters` arrays written
 * by the multi-select UI, and falls back to the legacy singular `selectedOption` /
 * `selectedOptionLetter` / `textAnswer` string - which may itself be a joined list ("A, C" or
 * "First option | Third option") for answers saved before this field existed.
 */
function resolveSelectedOptions(question, answer) {
  const options = normalizeOptions(question);
  const raw = [];

  const pushAll = (value) => {
    if (Array.isArray(value)) {
      value.forEach(v => { if (v !== null && v !== undefined && String(v).trim()) raw.push(String(v)); });
    } else if (value !== null && value !== undefined && String(value).trim()) {
      raw.push(String(value));
    }
  };

  if (Array.isArray(answer?.selectedOptions) && answer.selectedOptions.length > 0) {
    pushAll(answer.selectedOptions);
  }
  if (Array.isArray(answer?.selectedOptionLetters) && answer.selectedOptionLetters.length > 0) {
    pushAll(answer.selectedOptionLetters);
  }

  if (raw.length === 0) {
    // Legacy single-string storage. Split on the separators the app uses for joined selections;
    // a lone option text containing a comma still resolves because an exact whole-string match
    // is attempted first below.
    const single = answer?.selectedOption || answer?.selectedOptionLetter || answer?.textAnswer || '';
    const singleStr = String(single);
    if (singleStr.trim()) {
      const wholeMatch = options.find(opt =>
        (opt.text && normalizeText(opt.text) === normalizeText(singleStr)) ||
        opt.letter === singleStr.trim().toUpperCase()
      );
      if (wholeMatch) {
        raw.push(singleStr);
      } else {
        singleStr.split(/\s*(?:\||;|,|\band\b|\n)\s*/i).forEach(part => {
          if (part && part.trim()) raw.push(part.trim());
        });
      }
    }
  }

  // Map each token onto an option, de-duplicating by letter.
  const selected = [];
  const seen = new Set();
  for (const token of raw) {
    const tokenStr = String(token).trim();
    if (!tokenStr) continue;
    const tokenNorm = normalizeText(tokenStr);
    // "A", "A." or "A) Some text" all identify option A.
    const letterMatch = tokenStr.match(/^\(?([A-Za-z])\)?[.):\s]?$/) ||
                        tokenStr.match(/^\(?([A-Za-z])\)?[.):]\s+/);

    let match = options.find(opt => opt.text && normalizeText(opt.text) === tokenNorm);
    if (!match && letterMatch) {
      const letter = letterMatch[1].toUpperCase();
      match = options.find(opt => opt.letter === letter);
    }
    if (!match) {
      match = options.find(opt => opt.text && tokenNorm && normalizeText(opt.text).includes(tokenNorm));
    }
    if (!match) continue;
    if (seen.has(match.letter)) continue;
    seen.add(match.letter);
    selected.push(match);
  }

  return selected;
}

/** Human-readable "A. First option, C. Third option" for feedback and legacy display fields. */
function formatOptions(options) {
  return options.map(opt => (opt.letter ? `${opt.letter}. ${opt.text}` : opt.text)).join(', ');
}

/**
 * Mark a "select all that apply" answer.
 *
 * @param {Object} question - Question document (or sub-question) with `options`
 * @param {Object} answer   - Student answer holding selectedOptions/selectedOptionLetters/selectedOption
 * @param {Object} [opts]   - `{ points }` to override the question's own mark allocation
 * @returns {Object} grading result plus the resolved selection, for storing on the answer
 */
function gradeMultipleAnswer(question, answer, opts = {}) {
  const maxPoints = opts.points !== undefined && opts.points !== null
    ? Number(opts.points)
    : Number(question?.points ?? question?.marks ?? 1);
  const points = Number.isFinite(maxPoints) && maxPoints > 0 ? maxPoints : 1;

  const correctOptions = getCorrectOptions(question);
  const selectedOptions = resolveSelectedOptions(question, answer);

  const correctLetters = correctOptions.map(o => o.letter);
  const selectedLetters = selectedOptions.map(o => o.letter);

  if (selectedOptions.length === 0) {
    return {
      score: 0,
      isCorrect: false,
      feedback: correctOptions.length
        ? `No options selected. The correct answer${correctOptions.length > 1 ? 's are' : ' is'}: ${formatOptions(correctOptions)}`
        : 'No options selected.',
      correctedAnswer: formatOptions(correctOptions) || question?.correctAnswer || 'Not available',
      gradingMethod: 'no_answer',
      maxPoints: points,
      selectedOptions: [],
      selectedOptionLetters: [],
      correctOptionLetters: correctLetters,
      breakdown: { correctSelected: 0, missed: correctLetters, wronglySelected: [], totalCorrect: correctOptions.length }
    };
  }

  // Without a marking key there is nothing to compare against - let the caller fall through to
  // its own AI/heuristic path rather than scoring this as wrong.
  if (correctOptions.length === 0) {
    return {
      score: 0,
      isCorrect: false,
      feedback: 'No correct options are marked on this question, so it could not be graded automatically.',
      correctedAnswer: question?.correctAnswer || 'Not available',
      gradingMethod: 'no_marking_key',
      needsMarkingKey: true,
      maxPoints: points,
      selectedOptions: selectedOptions.map(o => o.text),
      selectedOptionLetters: selectedLetters,
      correctOptionLetters: [],
      breakdown: { correctSelected: 0, missed: [], wronglySelected: [], totalCorrect: 0 }
    };
  }

  const correctSet = new Set(correctLetters);
  const selectedSet = new Set(selectedLetters);

  const hits = selectedLetters.filter(l => correctSet.has(l));
  const wronglySelected = selectedLetters.filter(l => !correctSet.has(l));
  const missed = correctLetters.filter(l => !selectedSet.has(l));

  const isExact = missed.length === 0 && wronglySelected.length === 0;
  const scoringMode = question?.multipleAnswerScoring === 'all-or-nothing' ? 'all-or-nothing' : 'partial';

  let score;
  if (scoringMode === 'all-or-nothing') {
    score = isExact ? points : 0;
  } else {
    const ratio = (hits.length - wronglySelected.length) / correctOptions.length;
    score = Math.max(0, points * ratio);
  }
  score = Math.round(score * 100) / 100;

  const letterList = (letters) => letters.join(', ');
  let feedback;
  if (isExact) {
    feedback = `✅ Correct! You selected all ${correctOptions.length} correct option${correctOptions.length > 1 ? 's' : ''}: ${formatOptions(correctOptions)}`;
  } else {
    const parts = [];
    if (hits.length > 0) parts.push(`${hits.length} of ${correctOptions.length} correct option${correctOptions.length > 1 ? 's' : ''} selected (${letterList(hits)})`);
    if (missed.length > 0) parts.push(`missed ${letterList(missed)}`);
    if (wronglySelected.length > 0) parts.push(`incorrectly selected ${letterList(wronglySelected)}`);
    const prefix = score > 0 ? '⚠️ Partially correct' : '❌ Incorrect';
    feedback = `${prefix}. ${parts.join('; ')}. The correct answer${correctOptions.length > 1 ? 's are' : ' is'}: ${formatOptions(correctOptions)}`;
    if (scoringMode === 'all-or-nothing') {
      feedback += ' (this question requires every correct option to be selected for any marks)';
    }
  }

  return {
    score,
    isCorrect: isExact,
    feedback,
    correctedAnswer: formatOptions(correctOptions),
    gradingMethod: 'multiple_answer_grading',
    selectedOptions: selectedOptions.map(o => o.text),
    selectedOptionLetters: selectedLetters,
    correctOptionLetters: correctLetters,
    scoringMode,
    maxPoints: points,
    breakdown: {
      correctSelected: hits.length,
      totalCorrect: correctOptions.length,
      missed,
      wronglySelected
    }
  };
}

module.exports = {
  optionLetter,
  optionText,
  normalizeOptions,
  getCorrectOptions,
  isMultipleAnswerQuestion,
  resolveSelectedOptions,
  formatOptions,
  gradeMultipleAnswer
};
