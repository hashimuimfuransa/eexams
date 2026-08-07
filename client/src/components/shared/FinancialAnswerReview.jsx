/**
 * FinancialAnswerReview.jsx
 *
 * The one way a financial-spreadsheet answer is shown after an exam — used by every results
 * surface (student results, student exam result, teacher grading, org-admin and super-admin
 * result drill-downs) so a student, their teacher and an admin all look at the same thing.
 *
 * Without it these views fell back to rendering `answer.textAnswer` as text, which for this
 * question type is the raw serialised grid — a wall of JSON like
 *   {"tables":[{"title":"Income Statement","headers":["Item","Frw"],"data":[["Sales","5400000"]…
 * that tells nobody anything, and no model answer was shown at all.
 *
 * Renders the student's filled sheet and the correct sheet as two tabs, in the same Excel-styled
 * grid used to sit the exam, so the layout a student worked in is the layout they review.
 */

import { Box, Typography } from '@mui/material';
import FinancialSpreadsheet from '../FinancialSpreadsheet';

/**
 * @param {Object}  question   the question document (needs spreadsheetModelAnswer / correctAnswer,
 *                             and spreadsheetTemplate for the no-answer fallback)
 * @param {Object}  answer     the result's answer entry ({ textAnswer, writtenAnswer, … })
 * @param {number}  height     grid height in px
 */
export default function FinancialAnswerReview({ question, answer, height = 320 }) {
  if (!question) return null;

  const questionData = {
    ...question,
    // spreadsheetModelAnswer can be missing on older or hand-edited questions; correctAnswer is
    // kept as a mirror of it at save time, so it is the reliable fallback.
    spreadsheetModelAnswer: question.spreadsheetModelAnswer || question.correctAnswer,
  };

  const studentAnswerRaw = answer?.textAnswer ?? null;

  return (
    <Box sx={{ my: 1 }}>
      <FinancialSpreadsheet
        mode="grading"
        questionData={questionData}
        studentAnswerRaw={studentAnswerRaw}
        writtenAnswer={answer?.writtenAnswer || ''}
        height={height}
      />
      {answer?.feedback && (
        <Typography sx={{ mt: 0.75, fontSize: 11.5, color: '#4F46E5', fontStyle: 'italic' }}>
          💬 {answer.feedback}
        </Typography>
      )}
    </Box>
  );
}

export { FinancialAnswerReview };

/** True when this answer should be rendered by the component above rather than as plain text. */
export function isFinancialSpreadsheetQuestion(question) {
  return (question?.type || '').toLowerCase() === 'financial-spreadsheet';
}
