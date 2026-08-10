/**
 * The question fields every "detailed result" view needs, in one place.
 *
 * Result screens populate `answers.question` with an explicit select list, and each endpoint had
 * grown its own. A financial-spreadsheet answer is only readable when the question's template and
 * model answer come with it — without them the client has nothing but the serialised grid in
 * `answer.textAnswer` and can neither lay it out nor show the correct sheet beside it. Keeping the
 * list here means adding a field to the Question model is a one-line change for every results
 * surface (student results, exam result, teacher grading, org-admin and super-admin drill-downs)
 * rather than a hunt through five call sites.
 */

// Fields needed to render and mark a financial-spreadsheet answer.
const SPREADSHEET_QUESTION_FIELDS = [
  'spreadsheetTemplate',
  'spreadsheetModelAnswer',
  'requiresWrittenAnswer',
  'writtenAnswerPrompt',
  'writtenAnswerModelAnswer',
  'writtenAnswerPoints'
];

// Fields needed to render any answer type in a results view.
const RESULT_QUESTION_FIELDS = [
  'text',
  'type',
  'points',
  'marks',
  'section',
  'correctAnswer',
  'options',
  // Without these a "select all that apply" answer renders as a single-answer question in the
  // results views, so a partially correct selection looks simply wrong.
  'allowMultipleAnswers',
  'multipleAnswerScoring',
  'passage',
  'explanation',
  'imageUrl',
  'matchingPairs',
  'leftItems',
  'rightItems',
  'correctMatches',
  'itemsToOrder',
  'dragDropData',
  'wordBank',
  'subQuestions',
  'subQuestionConfig',
  ...SPREADSHEET_QUESTION_FIELDS
];

/** Space-separated select string for Mongoose `.populate('answers.question', <select>)`. */
const RESULT_QUESTION_SELECT = RESULT_QUESTION_FIELDS.join(' ');

module.exports = {
  SPREADSHEET_QUESTION_FIELDS,
  RESULT_QUESTION_FIELDS,
  RESULT_QUESTION_SELECT
};
