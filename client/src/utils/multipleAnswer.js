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
