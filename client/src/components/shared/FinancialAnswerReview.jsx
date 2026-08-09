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

import { Box, Typography, Chip, Stack } from '@mui/material';
import FinancialSpreadsheet from '../FinancialSpreadsheet';

/**
 * @param {Object}  question   the question document (needs spreadsheetModelAnswer / correctAnswer,
 *                             and spreadsheetTemplate for the no-answer fallback)
 * @param {Object}  answer     the result's answer entry ({ textAnswer, writtenAnswer, … })
 * @param {number}  height     grid height in px
 */
const fmt = (n) => (Number.isFinite(Number(n)) ? Math.round(Number(n) * 100) / 100 : 0);

/**
 * How the two halves were marked. A financial-spreadsheet question can carry both a grid and a
 * written explanation, each worth its own share of the marks — without this, a student saw one
 * combined number and had no way to tell whether they lost marks on the figures, on the
 * explanation, or on both.
 */
function MarkingBreakdown({ result, fallbackFeedback }) {
  const hasSplit = result && (result.writtenPoints > 0 || result.spreadsheetPoints > 0);

  // Results marked before the split was recorded have only the combined feedback. Show it under
  // the same heading rather than nothing, so there is always an answer to "how was this marked?".
  if (!hasSplit) {
    if (!fallbackFeedback) return null;
    return (
      <Box sx={{ mt: 1.25, border: '1px solid #E2E8F0', borderRadius: 1.5, overflow: 'hidden' }}>
        <Box sx={{ px: 1.5, py: 0.75, bgcolor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
          <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: '#334155' }}>How this was marked</Typography>
        </Box>
        <Box sx={{ px: 1.5, py: 1 }}>
          <Typography sx={{ fontSize: 11.5, color: '#334155', whiteSpace: 'pre-wrap' }}>
            {fallbackFeedback}
          </Typography>
          <Typography sx={{ mt: 0.5, fontSize: 10.5, color: '#94A3B8', fontStyle: 'italic' }}>
            Regrade this result to see the spreadsheet and written answer marked separately.
          </Typography>
        </Box>
      </Box>
    );
  }

  const rows = [
    {
      label: 'Spreadsheet',
      hint: 'The figures you entered in the grid',
      score: fmt(result.spreadsheetScore),
      points: fmt(result.spreadsheetPoints),
      detail: result.spreadsheetFeedback,
      color: '#0369A1',
      bg: '#F0F9FF',
    },
    {
      label: 'Written answer',
      hint: 'Your explanation, marked against the marking guide',
      score: fmt(result.writtenScore),
      points: fmt(result.writtenPoints),
      detail: result.writtenFeedback,
      color: '#7C3AED',
      bg: '#F5F3FF',
    },
  ].filter(r => r.points > 0);

  if (!rows.length) return null;

  const total = rows.reduce((s, r) => s + r.score, 0);
  const outOf = rows.reduce((s, r) => s + r.points, 0);

  return (
    <Box sx={{ mt: 1.25, border: '1px solid #E2E8F0', borderRadius: 1.5, overflow: 'hidden' }}>
      <Box sx={{ px: 1.5, py: 0.75, bgcolor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
        <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: '#334155' }}>
          How this was marked
        </Typography>
      </Box>

      {rows.map(r => (
        <Box key={r.label} sx={{ px: 1.5, py: 1, borderBottom: '1px solid #F1F5F9', bgcolor: r.bg }}>
          <Stack direction="row" alignItems="baseline" gap={1} flexWrap="wrap">
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: r.color, minWidth: 108 }}>
              {r.label}
            </Typography>
            <Chip
              label={`${r.score} / ${r.points}`}
              size="small"
              sx={{ height: 20, fontSize: 11, fontWeight: 700, bgcolor: '#FFFFFF', color: r.color, border: `1px solid ${r.color}33` }}
            />
            <Typography sx={{ fontSize: 11, color: '#64748B' }}>{r.hint}</Typography>
          </Stack>
          {r.detail && (
            <Typography sx={{ mt: 0.4, fontSize: 11.5, color: '#334155', whiteSpace: 'pre-wrap' }}>
              {r.detail}
            </Typography>
          )}
        </Box>
      ))}

      <Box sx={{ px: 1.5, py: 0.75, bgcolor: '#F8FAFC', display: 'flex', justifyContent: 'space-between' }}>
        <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>Total for this part</Typography>
        <Typography sx={{ fontSize: 12, fontWeight: 800, color: '#0F172A' }}>
          {fmt(total)} / {fmt(outOf)}
        </Typography>
      </Box>
    </Box>
  );
}

export default function FinancialAnswerReview({ question, answer, height = 320, result }) {
  if (!question) return null;

  const questionData = {
    ...question,
    // spreadsheetModelAnswer can be missing on older or hand-edited questions; correctAnswer is
    // kept as a mirror of it at save time, so it is the reliable fallback.
    spreadsheetModelAnswer: question.spreadsheetModelAnswer || question.correctAnswer,
  };

  const studentAnswerRaw = answer?.textAnswer ?? null;
  // `result` is the per-part result for a sub-question; for a top-level question the split is
  // stored on the answer itself.
  const breakdown = result || answer;

  return (
    <Box sx={{ my: 1 }}>
      <FinancialSpreadsheet
        mode="grading"
        questionData={questionData}
        studentAnswerRaw={studentAnswerRaw}
        writtenAnswer={answer?.writtenAnswer || ''}
        writtenAnswerScore={breakdown?.writtenScore ?? answer?.writtenAnswerScore}
        writtenAnswerPoints={breakdown?.writtenPoints}
        writtenAnswerFeedback={breakdown?.writtenFeedback ?? answer?.writtenAnswerFeedback}
        height={height}
      />

      <MarkingBreakdown result={breakdown} fallbackFeedback={result?.feedback || answer?.feedback} />

      {/* Only shown when the breakdown above hasn't already carried it. */}
      {answer?.feedback && !result?.feedback && (breakdown?.writtenPoints > 0 || breakdown?.spreadsheetPoints > 0) && (
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
