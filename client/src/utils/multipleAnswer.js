/**
 * Shared helpers for "select all that apply" multiple-choice questions.
 *
 * Mirrors server/utils/multipleAnswerGrading.js so the question editor, the student exam interface
 * and the results views all agree on which questions take more than one answer. Detection matches
 * the grader's: the teacher's explicit flag, or simply a marking key with more than one correct
 * option (which is how imported/AI-extracted papers arrive).
 */

/** Letter for an option, falling back to its position (A, B, C...) when unlabelled. */
export const getOptionLetter = (option, index) => {
  if (option && typeof option === 'object' && option.letter) {
    return String(option.letter).trim().toUpperCase();
  }
  return String.fromCharCode(65 + index);
};

/** Display text of an option, tolerating the string/object shapes stored across the app. */
export const getOptionText = (option) => {
  if (option === null || option === undefined) return '';
  if (typeof option === 'string') return option;
  if (typeof option === 'object') return String(option.text || option.value || option.label || '');
  return String(option);
};

/** Whether an option is flagged as part of the marking key. */
export const isOptionCorrect = (option) =>
  !!(option && typeof option === 'object' && (option.isCorrect || option.correct));

/** How many of a question's options are flagged correct. */
export const countCorrectOptions = (question) =>
  (question?.options || []).filter(isOptionCorrect).length;

/**
 * Whether this question should accept more than one selection. Kept in step with the server's
 * isMultipleAnswerQuestion so a student never sees radio buttons on a question the grader marks
 * as multi-answer.
 */
export const isMultiAnswerQuestion = (question) => {
  if (!question) return false;
  if (question.allowMultipleAnswers === true) return true;
  return countCorrectOptions(question) > 1;
};

/**
 * The letters of every correct option, in order — used to keep the editor's `correctAnswer`
 * text field in step with the ticked options.
 */
export const correctAnswerFromOptions = (options = []) => {
  const letters = options
    .map((opt, idx) => (isOptionCorrect(opt) ? getOptionLetter(opt, idx) : null))
    .filter(Boolean);
  return letters.join(', ');
};

/** Options normalized to objects with a letter, so correctness can be toggled on any of them. */
export const normalizeOptions = (options = []) =>
  options.map((opt, idx) => (
    typeof opt === 'object' && opt !== null
      ? { ...opt, letter: opt.letter || getOptionLetter(opt, idx) }
      : { text: String(opt ?? ''), isCorrect: false, letter: getOptionLetter(null, idx) }
  ));

/**
 * Tick/untick option `idx` as part of the marking key.
 *
 * In multi-answer mode each option toggles independently; in single-answer mode selecting one
 * clears the rest (radio behaviour). Returns `{ options, correctAnswer }` so callers can patch
 * both at once — the graders fall back to `correctAnswer` when no option carries a flag, so the
 * two must never drift apart.
 */
export const toggleCorrectOption = (options, idx, allowMultiple) => {
  const normalized = normalizeOptions(options);
  const next = normalized.map((opt, i) => {
    if (allowMultiple) return i === idx ? { ...opt, isCorrect: !isOptionCorrect(opt) } : opt;
    return { ...opt, isCorrect: i === idx };
  });
  return { options: next, correctAnswer: correctAnswerFromOptions(next) };
};

/**
 * Turn multi-answer mode on or off for a question.
 *
 * Switching off collapses the key to the first ticked option — several options left flagged would
 * still be read as a multi-answer key by the grader, so the question would not actually revert to
 * single-answer. Returns the full patch to apply to the question.
 */
export const applyAllowMultiple = (question, enabled) => {
  const normalized = normalizeOptions(question?.options || []);
  let options = normalized;
  if (!enabled) {
    const firstCorrect = normalized.findIndex(isOptionCorrect);
    options = normalized.map((opt, i) => ({ ...opt, isCorrect: i === firstCorrect }));
  }
  return {
    allowMultipleAnswers: enabled,
    multipleAnswerScoring: question?.multipleAnswerScoring || 'partial',
    options,
    correctAnswer: correctAnswerFromOptions(options)
  };
};
