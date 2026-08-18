/**
 * Strips the marking key out of an exam before it is sent to a student.
 *
 * The exam interface fetches the whole exam document to render it, and a Mongoose document
 * carries every field it has — including `correctAnswer`, the `isCorrect` flag on each option,
 * the model answer for a spreadsheet, and the correct pairings for matching/ordering/drag-drop
 * questions. Those all arrived in the browser, where a student could read them straight out of
 * the network tab, which made the fullscreen lock and the screenshot/tab-switch warnings in the
 * exam interface beside the point.
 *
 * Everything needed to *render* a question is kept; everything needed to *mark* one is removed.
 * Grading happens server-side, so nothing here is needed by the client.
 */
const { toPlainDoc } = require('./toPlainDoc');

// Top-level question fields that exist only to mark the answer.
const ANSWER_ONLY_FIELDS = [
  'correctAnswer',
  'correctMatches',
  'explanation',
  'answerKey',
  'gradingCriteria',
  'keyPoints',
  'acceptableAnswers',
  'spreadsheetModelAnswer',
  'writtenAnswerModelAnswer'
];

/** An option the student can see: its text and label, never whether it is the right one. */
const sanitizeOption = (option, index) => {
  if (option === null || option === undefined) return option;
  if (typeof option === 'string') return option;
  const plain = toPlainDoc(option);
  return {
    _id: plain._id,
    text: plain.text,
    letter: plain.letter || String.fromCharCode(65 + index),
    value: plain.value || plain.letter?.toLowerCase() || String.fromCharCode(97 + index)
  };
};

/** How many options are flagged correct — computed before the flags are removed. */
const countCorrectOptions = (options) =>
  (options || []).filter(o => o && typeof o === 'object' && (o.isCorrect || o.correct)).length;

const sanitizeSubQuestion = (subQuestion) => {
  const sub = toPlainDoc(subQuestion);
  if (!sub || typeof sub !== 'object') return sub;

  const correctOptionCount = countCorrectOptions(sub.options);
  const clean = { ...sub };
  ANSWER_ONLY_FIELDS.forEach(field => { delete clean[field]; });

  if (Array.isArray(sub.options)) {
    clean.options = sub.options.map(sanitizeOption);
  }

  // "Select all that apply" is detected client-side by counting correct options, which is no
  // longer possible once the flags are gone — so the conclusion is sent instead of the evidence.
  if (sub.allowMultipleAnswers === true || correctOptionCount > 1) {
    clean.allowMultipleAnswers = true;
    clean.correctOptionCount = correctOptionCount;
  }

  return clean;
};

/** One question, with everything that gives the answer away removed. */
const sanitizeQuestionForStudent = (question) => {
  const q = toPlainDoc(question);
  if (!q || typeof q !== 'object') return q;

  const correctOptionCount = countCorrectOptions(q.options);
  const clean = { ...q };
  ANSWER_ONLY_FIELDS.forEach(field => { delete clean[field]; });

  if (Array.isArray(q.options)) {
    clean.options = q.options.map(sanitizeOption);
  }

  if (q.allowMultipleAnswers === true || correctOptionCount > 1) {
    clean.allowMultipleAnswers = true;
    clean.correctOptionCount = correctOptionCount;
  }

  // Matching: the two columns are the question, correctPairs is the answer.
  if (q.matchingPairs) {
    const pairs = toPlainDoc(q.matchingPairs);
    clean.matchingPairs = {
      leftColumn: pairs.leftColumn || [],
      rightColumn: pairs.rightColumn || []
    };
  }

  // Ordering: the items are the question, correctOrder is the answer.
  if (q.itemsToOrder) {
    const ordering = toPlainDoc(q.itemsToOrder);
    clean.itemsToOrder = { items: ordering.items || [] };
  }

  // Drag-and-drop: the zones and the draggable items are the question, the placements are not.
  if (q.dragDropData) {
    const dragDrop = toPlainDoc(q.dragDropData);
    clean.dragDropData = {
      dropZones: dragDrop.dropZones || [],
      draggableItems: dragDrop.draggableItems || []
    };
  }

  if (Array.isArray(q.subQuestions)) {
    clean.subQuestions = q.subQuestions.map(sanitizeSubQuestion);
  }

  return clean;
};

/**
 * A whole exam, safe to hand to a student. Returns a plain object; the caller can keep adding
 * its own display fields (status, availability, ...) to it afterwards.
 */
const sanitizeExamForStudent = (exam) => {
  const examObj = toPlainDoc(exam);
  if (!examObj || !Array.isArray(examObj.sections)) return examObj;

  examObj.sections = examObj.sections.map(section => {
    const plainSection = toPlainDoc(section);
    return {
      ...plainSection,
      questions: Array.isArray(plainSection.questions)
        ? plainSection.questions.map(sanitizeQuestionForStudent)
        : plainSection.questions
    };
  });

  return examObj;
};

// Per-answer fields written by the grader. Multiple-choice answers are marked the moment they
// are saved, so an in-progress result already knows which of them were right.
const GRADED_ANSWER_FIELDS = [
  'isCorrect',
  'score',
  'feedback',
  'correctedAnswer',
  'correctOptionLetters',
  'writtenAnswerScore',
  'writtenAnswerFeedback',
  'subQuestionResults'
];

/**
 * An in-progress exam session, safe to hand back to the student who is sitting it.
 *
 * Reloading the page mid-exam returns the saved session. That response carried each answer's
 * `isCorrect` and `score` — so a student could answer, refresh, see which ones were marked
 * wrong and go back and change them. It also populated each question with its options, which
 * still carried their `isCorrect` flags.
 */
const sanitizeSessionForStudent = (session) => {
  const sessionObj = toPlainDoc(session);
  if (!sessionObj || typeof sessionObj !== 'object') return sessionObj;

  // The running score is the sum of the marks above; sending it gives the same answers away.
  delete sessionObj.totalScore;

  if (Array.isArray(sessionObj.answers)) {
    sessionObj.answers = sessionObj.answers.map(answer => {
      const clean = { ...toPlainDoc(answer) };
      GRADED_ANSWER_FIELDS.forEach(field => { delete clean[field]; });

      if (Array.isArray(clean.subAnswers)) {
        clean.subAnswers = clean.subAnswers.map(sub => {
          const cleanSub = { ...toPlainDoc(sub) };
          delete cleanSub.isCorrect;
          delete cleanSub.score;
          return cleanSub;
        });
      }

      if (clean.question && typeof clean.question === 'object') {
        clean.question = sanitizeQuestionForStudent(clean.question);
      }

      return clean;
    });
  }

  return sessionObj;
};

module.exports = {
  sanitizeExamForStudent,
  sanitizeQuestionForStudent,
  sanitizeSessionForStudent,
  ANSWER_ONLY_FIELDS,
  GRADED_ANSWER_FIELDS
};
