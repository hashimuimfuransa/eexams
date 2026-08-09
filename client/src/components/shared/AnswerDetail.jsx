/**
 * AnswerDetail.jsx
 *
 * The full per-answer breakdown shown after an exam: the question in full, the student's answer
 * rendered in the right shape for its type, the correct answer, sub-questions, feedback and AI
 * analysis.
 *
 * Lifted out of the student Results page so every audience sees the same thing. The super-admin
 * and org-admin result dialogs each carried their own thinner copy, which handled a few question
 * types and printed everything else as text — a financial-spreadsheet answer came out as raw JSON,
 * and sub-questions showed no correct answer at all. Staff reviewing a paper need at least what
 * the student sees.
 */

import { Box, Typography, Chip, Grid, Paper, LinearProgress } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import {
  CheckCircle, Cancel, TaskAlt, ErrorOutline, Feedback, Psychology,
  Lightbulb, BarChart, FormatListNumbered
} from '@mui/icons-material';
import FinancialAnswerReview, { isFinancialSpreadsheetQuestion } from './FinancialAnswerReview';

export default function AnswerDetail({ answer }) {
  const theme = useTheme();

  const getMatchLabel = (item) => {
    if (item === null || item === undefined) return 'Unknown';
    if (typeof item === 'string') return item;
    if (typeof item === 'number') return String(item);
    if (typeof item === 'object') {
      if (item.text) return String(item.text);
      if (item.label) return String(item.label);
      if (item.value) return String(item.value);
      try { return JSON.stringify(item); } catch { return 'Object'; }
    }
    return String(item);
  };

  // ─── Helper: colour-coded score badge ─────────────────────────────────────
  const scoreBadgeColor = (pct) => {
    if (pct >= 80) return 'success';
    if (pct >= 60) return 'warning';
    return 'error';
  };

  // ─── Per-answer detail renderer ───────────────────────────────────────────
  const qType = answer.question?.type || 'open-ended';
    const notAnswered = !answer.selectedOption && !answer.textAnswer &&
      (!answer.matchingAnswers || answer.matchingAnswers.length === 0) &&
      (!answer.subQuestionAnswers || answer.subQuestionAnswers.length === 0);

    const labelStyle = {
      fontWeight: 700, fontSize: 10, textTransform: 'uppercase',
      letterSpacing: 0.8, mb: 0.5, display: 'block', color: 'text.secondary'
    };

    return (
      <Box sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>

        {/* ── Full question text ── */}
        <Box sx={{ mb: 2, p: { xs: 1.5, sm: 2 }, bgcolor: 'grey.50', borderRadius: 2,
          borderLeft: '4px solid', borderColor: 'primary.main' }}>
          <Typography sx={{ ...labelStyle, mb: 0.75 }}>Full Question</Typography>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, fontSize: { xs: '0.875rem', sm: '1rem' } }}>
            {String(answer.question?.text || '')}
          </Typography>
          {answer.question?.points && (
            <Chip label={`${answer.question.points} point${answer.question.points !== 1 ? 's' : ''}`}
              size="small" variant="outlined" sx={{ mt: 1, fontSize: 10, height: 20 }} />
          )}
        </Box>

        {/* ── Not answered banner ── */}
        {notAnswered && (
          <Box sx={{ mb: 2, p: 1.5, bgcolor: alpha(theme.palette.error.main, 0.08), borderRadius: 2,
            border: '1px solid', borderColor: 'error.light',
            display: 'flex', alignItems: 'center', gap: 1 }}>
            <Cancel fontSize="small" sx={{ color: 'error.main', flexShrink: 0 }} />
            <Typography variant="body2" color="error.main" fontWeight={700}>
              This question was not answered — 0 points awarded
            </Typography>
          </Box>
        )}

        {/* ── Multiple Choice ── */}
        {qType === 'multiple-choice' && (
          <Box sx={{ mb: 2 }}>
            {answer.question?.options && answer.question.options.length > 0 ? (
              <>
                <Typography sx={labelStyle}>Answer Options</Typography>
                {answer.question.options.map((opt, oi) => {
                  const optText = typeof opt === 'object' ? opt.text : String(opt);
                  const letter = String.fromCharCode(65 + oi);
                  const isStudentAnswer = answer.selectedOptionLetter === letter ||
                    answer.selectedOption === optText ||
                    (!answer.selectedOptionLetter && !answer.selectedOption && false);
                  const isCorrectOpt = answer.correctOptionLetter === letter ||
                    answer.question?.correctAnswer === optText ||
                    answer.correctedAnswer === optText;
                  const highlight = isCorrectOpt || isStudentAnswer;
                  return (
                    <Box key={oi} sx={{
                      display: 'flex', alignItems: 'flex-start', gap: 1,
                      p: { xs: 1, sm: 1.25 }, mb: 0.75, borderRadius: 2,
                      bgcolor: isCorrectOpt
                        ? alpha(theme.palette.success.main, 0.1)
                        : isStudentAnswer
                          ? alpha(theme.palette.error.main, 0.09)
                          : 'grey.50',
                      border: '1.5px solid',
                      borderColor: isCorrectOpt ? 'success.light' : isStudentAnswer ? 'error.light' : 'transparent'
                    }}>
                      <Box sx={{
                        width: 26, height: 26, minWidth: 26, borderRadius: '50%', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12,
                        bgcolor: isCorrectOpt ? 'success.main' : isStudentAnswer ? 'error.main' : 'grey.300',
                        color: highlight ? 'white' : 'text.primary', mt: 0.1
                      }}>
                        {letter}
                      </Box>
                      <Typography variant="body2" sx={{ flex: 1, fontWeight: highlight ? 600 : 400, mt: 0.25 }}>
                        {optText}
                      </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.4, flexShrink: 0 }}>
                        {isCorrectOpt && (
                          <Chip label="✓ Correct" size="small" color="success"
                            sx={{ fontSize: 10, height: 20, fontWeight: 700 }} />
                        )}
                        {isStudentAnswer && !isCorrectOpt && (
                          <Chip label="✗ Your answer" size="small" color="error"
                            sx={{ fontSize: 10, height: 20, fontWeight: 700 }} />
                        )}
                        {isStudentAnswer && isCorrectOpt && (
                          <Chip label="✓ Your answer" size="small" color="success"
                            sx={{ fontSize: 10, height: 20, fontWeight: 700 }} />
                        )}
                      </Box>
                    </Box>
                  );
                })}

                {/* Always show the correct answer clearly at bottom */}
                {!answer.isCorrect && (
                  <Box sx={{ mt: 1.5, p: 1.25, bgcolor: alpha(theme.palette.success.main, 0.08), borderRadius: 2,
                    border: '1px solid', borderColor: 'success.light',
                    display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TaskAlt fontSize="small" sx={{ color: 'success.main', flexShrink: 0 }} />
                    <Typography variant="body2" fontWeight={700} color="success.dark">
                      Correct answer: {answer.correctOptionLetter ? `${answer.correctOptionLetter}. ` : ''}
                      {String(answer.question?.correctAnswer || answer.correctedAnswer || 'See highlighted option above')}
                    </Typography>
                  </Box>
                )}
              </>
            ) : (
              /* No options stored — show plain text fields */
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Box>
                  <Typography sx={labelStyle}>Your Answer</Typography>
                  <Box sx={{ p: 1.5, bgcolor: notAnswered ? alpha(theme.palette.error.main, 0.07) : answer.isCorrect ? alpha(theme.palette.success.main, 0.07) : alpha(theme.palette.error.main, 0.07),
                    borderRadius: 1.5, border: '1px solid', borderColor: notAnswered ? 'error.light' : answer.isCorrect ? 'success.light' : 'error.light' }}>
                    <Typography variant="body2" sx={{ color: notAnswered ? 'text.secondary' : answer.isCorrect ? 'success.dark' : 'error.dark', fontStyle: notAnswered ? 'italic' : 'normal' }}>
                      {notAnswered ? 'Not answered' : (answer.selectedOptionLetter ? `${answer.selectedOptionLetter}. ` : '') + String(answer.selectedOption || '')}
                    </Typography>
                  </Box>
                </Box>
                <Box>
                  <Typography sx={labelStyle}>Correct Answer</Typography>
                  <Box sx={{ p: 1.5, bgcolor: alpha(theme.palette.success.main, 0.07), borderRadius: 1.5, border: '1px solid', borderColor: 'success.light' }}>
                    <Typography variant="body2" color="success.dark" fontWeight={600}>
                      {answer.correctOptionLetter ? `${answer.correctOptionLetter}. ` : ''}{String(answer.question?.correctAnswer || answer.correctedAnswer || 'N/A')}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            )}
          </Box>
        )}

        {/* ── True / False ── */}
        {qType === 'true-false' && (
          <Box sx={{ mb: 2 }}>
            <Typography sx={labelStyle}>Answer Options</Typography>
            {['True', 'False'].map((optText, oi) => {
              const letter = oi === 0 ? 'A' : 'B';
              const isStudentAnswer =
                answer.selectedOptionLetter === letter ||
                answer.selectedOption?.toLowerCase() === optText.toLowerCase() ||
                answer.textAnswer?.toLowerCase() === optText.toLowerCase();
              const isCorrectOpt =
                answer.correctOptionLetter === letter ||
                answer.question?.correctAnswer?.toLowerCase() === optText.toLowerCase() ||
                answer.correctedAnswer?.toLowerCase() === optText.toLowerCase();
              const highlight = isCorrectOpt || isStudentAnswer;
              return (
                <Box key={oi} sx={{
                  display: 'flex', alignItems: 'center', gap: 1,
                  p: { xs: 1, sm: 1.25 }, mb: 0.75, borderRadius: 2,
                  bgcolor: isCorrectOpt
                    ? alpha(theme.palette.success.main, 0.1)
                    : isStudentAnswer
                      ? alpha(theme.palette.error.main, 0.09)
                      : 'grey.50',
                  border: '1.5px solid',
                  borderColor: isCorrectOpt ? 'success.light' : isStudentAnswer ? 'error.light' : 'transparent'
                }}>
                  <Box sx={{
                    width: 26, height: 26, minWidth: 26, borderRadius: '50%', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12,
                    bgcolor: isCorrectOpt ? 'success.main' : isStudentAnswer ? 'error.main' : 'grey.300',
                    color: highlight ? 'white' : 'text.primary'
                  }}>
                    {letter}
                  </Box>
                  <Typography variant="body2" sx={{ flex: 1, fontWeight: highlight ? 600 : 400 }}>
                    {optText}
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.4, flexShrink: 0 }}>
                    {isCorrectOpt && isStudentAnswer && (
                      <Chip label="✓ Your answer" size="small" color="success" sx={{ fontSize: 10, height: 20, fontWeight: 700 }} />
                    )}
                    {isCorrectOpt && !isStudentAnswer && (
                      <Chip label="✓ Correct" size="small" color="success" sx={{ fontSize: 10, height: 20, fontWeight: 700 }} />
                    )}
                    {isStudentAnswer && !isCorrectOpt && (
                      <Chip label="✗ Your answer" size="small" color="error" sx={{ fontSize: 10, height: 20, fontWeight: 700 }} />
                    )}
                  </Box>
                </Box>
              );
            })}

            {/* Always show correct answer clearly when wrong */}
            {!answer.isCorrect && (
              <Box sx={{ mt: 1.5, p: 1.25, bgcolor: alpha(theme.palette.success.main, 0.08), borderRadius: 2,
                border: '1px solid', borderColor: 'success.light',
                display: 'flex', alignItems: 'center', gap: 1 }}>
                <TaskAlt fontSize="small" sx={{ color: 'success.main', flexShrink: 0 }} />
                <Typography variant="body2" fontWeight={700} color="success.dark">
                  Correct answer:{' '}
                  {answer.correctOptionLetter ? `${answer.correctOptionLetter}. ` : ''}
                  {String(answer.question?.correctAnswer || answer.correctedAnswer || 'See highlighted option above')}
                </Typography>
              </Box>
            )}
          </Box>
        )}

        {/* ── Matching ── */}
        {qType === 'matching' && (() => {
          const leftItems = answer.question?.leftItems || answer.question?.matchingPairs?.leftColumn || [];
          const rightItems = answer.question?.rightItems || answer.question?.matchingPairs?.rightColumn || [];
          const correctPairs = answer.question?.matchingPairs?.correctPairs || [];
          const studentPairs = answer.matchingAnswers || [];
          return (
            <Box sx={{ mb: 2 }}>
              <Box sx={{ mb: 2 }}>
                <Typography sx={labelStyle}>Your Matches</Typography>
                {studentPairs.length > 0 ? studentPairs.map((pair, pi) => {
                  const ll = getMatchLabel(leftItems[pair.left]);
                  const rl = getMatchLabel(rightItems[pair.right]);
                  const correct = correctPairs.some(cp => cp.left === pair.left && cp.right === pair.right);
                  return (
                    <Box key={pi} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75, p: 1, borderRadius: 1.5,
                      bgcolor: correct ? alpha(theme.palette.success.main, 0.08) : alpha(theme.palette.error.main, 0.08),
                      border: '1px solid', borderColor: correct ? 'success.light' : 'error.light' }}>
                      {correct
                        ? <TaskAlt fontSize="small" sx={{ color: 'success.main', flexShrink: 0 }} />
                        : <Cancel fontSize="small" sx={{ color: 'error.main', flexShrink: 0 }} />}
                      <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
                        <strong>{ll}</strong> <span style={{ opacity: 0.6 }}>→</span> {rl}
                      </Typography>
                    </Box>
                  );
                }) : (
                  <Box sx={{ p: 1.5, bgcolor: alpha(theme.palette.error.main, 0.07), borderRadius: 1.5, border: '1px solid', borderColor: 'error.light' }}>
                    <Typography variant="body2" color="error.main" fontStyle="italic">Not answered</Typography>
                  </Box>
                )}
              </Box>
              <Box>
                <Typography sx={labelStyle}>Correct Matches</Typography>
                {correctPairs.map((pair, pi) => (
                  <Box key={pi} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75, p: 1, borderRadius: 1.5,
                    bgcolor: alpha(theme.palette.success.main, 0.08), border: '1px solid', borderColor: 'success.light' }}>
                    <TaskAlt fontSize="small" sx={{ color: 'success.main', flexShrink: 0 }} />
                    <Typography variant="body2" color="success.dark" sx={{ wordBreak: 'break-word' }}>
                      <strong>{getMatchLabel(leftItems[pair.left])}</strong> <span style={{ opacity: 0.6 }}>→</span> {getMatchLabel(rightItems[pair.right])}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          );
        })()}

        {/* ── Financial Spreadsheet ── */}
        {qType === 'financial-spreadsheet' && (
          <Box sx={{ mb: 2 }}>
            <FinancialAnswerReview question={answer.question} answer={answer} height={320} />
          </Box>
        )}

        {/* ── Open-ended / Essay / Fill-in / Short answer ──
            Skipped when the question is answered entirely through its sub-questions: the parent
            holds no answer of its own, so this rendered an empty box and a "Not provided" model
            answer directly above the sub-question section that has the real content. */}
        {(qType === 'open-ended' || qType === 'essay' || qType === 'fill-in-blank' || qType === 'short-answer')
          && !(answer.question?.subQuestions?.length > 0) && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 2 }}>
            <Box>
              <Typography sx={labelStyle}>Your Answer</Typography>
              <Box sx={{ p: 1.5, borderRadius: 1.5, border: '1px solid',
                bgcolor: notAnswered ? alpha(theme.palette.error.main, 0.05) : answer.isCorrect ? alpha(theme.palette.success.main, 0.07) : alpha(theme.palette.error.main, 0.07),
                borderColor: notAnswered ? 'error.light' : answer.isCorrect ? 'success.light' : 'error.light' }}>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap',
                  color: notAnswered ? 'text.secondary' : answer.isCorrect ? 'success.dark' : 'error.dark',
                  fontStyle: notAnswered ? 'italic' : 'normal' }}>
                  {notAnswered ? 'Not answered' : String(answer.textAnswer || '')}
                </Typography>
              </Box>
            </Box>
            <Box>
              <Typography sx={labelStyle}>Correct / Model Answer</Typography>
              <Box sx={{ p: 1.5, bgcolor: alpha(theme.palette.success.main, 0.07), borderRadius: 1.5, border: '1px solid', borderColor: 'success.light' }}>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: 'success.dark' }}>
                  {String(answer.correctedAnswer || answer.question?.correctAnswer || 'Not provided')}
                </Typography>
              </Box>
            </Box>
          </Box>
        )}

        {/* ── Sub-questions ── */}
        {answer.question?.subQuestions && answer.question.subQuestions.length > 0 && (
          <Box sx={{ mt: 2, p: { xs: 1.5, sm: 2 }, bgcolor: 'grey.50', borderRadius: 2 }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 0.5, fontSize: { xs: '0.85rem', sm: '0.9rem' } }}>
              <FormatListNumbered fontSize="small" /> Sub-Questions
              {answer.question.subQuestionConfig?.mode === 'choose-n' && (
                <Chip label={`Choose ${answer.question.subQuestionConfig.requiredCount || 1}`} size="small" color="warning" sx={{ ml: 1 }} />
              )}
            </Typography>
            {answer.question.subQuestions.map((subQ, subIdx) => {
              const isSelected = answer.question.subQuestionConfig?.mode === 'choose-n'
                ? (answer.selectedSubQuestionIndices || []).includes(subIdx)
                : true;
              if (!isSelected) return null;
              const subAnswer = answer.subQuestionAnswers?.[subIdx];
              const subResult = answer.subQuestionResults?.[subIdx];
              const subNotAnswered = !subAnswer?.answered;
              return (
                <Paper key={subIdx} elevation={0} sx={{ p: { xs: 1.25, sm: 1.5 }, mb: 1, bgcolor: 'white', borderLeft: '3px solid',
                  borderColor: subResult?.isCorrect ? 'success.main' : subNotAnswered ? 'error.light' : subResult ? 'error.main' : 'grey.300' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.75, gap: 1, flexWrap: 'wrap' }}>
                    <Typography variant="body2" fontWeight={600} sx={{ flex: 1, fontSize: { xs: '0.82rem', sm: '0.875rem' } }}>
                      {subQ.label || `Part ${String.fromCharCode(65 + subIdx)}`}: {subQ.text}
                    </Typography>
                    {subResult && (
                      <Chip icon={subResult.isCorrect ? <CheckCircle fontSize="small" /> : <Cancel fontSize="small" />}
                        label={`${subResult.score ?? 0}/${subResult.maxPoints || subQ.points || 1} pts`}
                        color={subResult.isCorrect ? 'success' : 'error'} size="small" sx={{ flexShrink: 0 }} />
                    )}
                  </Box>
                  {isFinancialSpreadsheetQuestion(subQ) ? (
                    /* Both grids in one place. Printing subAnswer.textAnswer and
                       subQ.correctAnswer as strings dumped the serialised sheets as JSON — the
                       most common shape for these questions is a multi-part one, so this is the
                       path a student actually lands on. */
                    <FinancialAnswerReview question={subQ} answer={subAnswer} result={subResult} height={300} />
                  ) : subNotAnswered ? (
                    <Box>
                      <Typography variant="body2" color="error.main" fontStyle="italic" sx={{ mb: 0.5 }}>Not answered</Typography>
                      {(subQ.correctAnswer || subResult?.correctedAnswer) && (
                        <Typography variant="body2" color="success.dark" sx={{ mt: 0.25 }}>
                          <strong>Correct answer:</strong> {String(subResult?.correctedAnswer || subQ.correctAnswer)}
                        </Typography>
                      )}
                    </Box>
                  ) : (
                    <Box>
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
                        <strong>Your answer:</strong> {subAnswer.selectedOption || subAnswer.textAnswer || '—'}
                      </Typography>
                      {(subQ.correctAnswer || subResult?.correctedAnswer) && (
                        <Typography variant="body2" color="success.dark" sx={{ mt: 0.5, fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
                          <strong>Correct answer:</strong> {String(subResult?.correctedAnswer || subQ.correctAnswer)}
                        </Typography>
                      )}
                    </Box>
                  )}

                  {/* Outside the branches above so the mark breakdown ("32/126 filled cells are
                      correct") reaches spreadsheet and unanswered sub-questions too. */}
                  {subResult?.feedback && (
                    <Box sx={{ mt: 0.75, p: 1, bgcolor: alpha(theme.palette.primary.main, 0.06), borderRadius: 1, borderLeft: '3px solid', borderColor: 'primary.light' }}>
                      <Typography variant="body2" sx={{ fontStyle: 'italic', color: 'primary.dark', fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
                        {subResult.feedback}
                      </Typography>
                    </Box>
                  )}
                </Paper>
              );
            })}
          </Box>
        )}

        {/* ── Feedback — always shown when present (including MC and unanswered) ── */}
        {answer.feedback && (
          <Box sx={{ mt: 2, p: { xs: 1.5, sm: 2 }, bgcolor: alpha(theme.palette.primary.main, 0.06), borderRadius: 2,
            borderLeft: '4px solid', borderColor: 'primary.main' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75 }}>
              <Feedback fontSize="small" color="primary" />
              <Typography variant="body2" fontWeight={700} color="primary.main">Feedback</Typography>
            </Box>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{String(answer.feedback)}</Typography>
          </Box>
        )}

        {/* Feedback placeholder when not answered and no feedback — show generic tip */}
        {notAnswered && !answer.feedback && (
          <Box sx={{ mt: 2, p: 1.5, bgcolor: alpha('#e65100', 0.07), borderRadius: 2, borderLeft: '4px solid', borderColor: 'warning.main' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
              <Lightbulb fontSize="small" sx={{ color: 'warning.main' }} />
              <Typography variant="body2" fontWeight={700} color="warning.dark">Tip</Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              Always attempt every question — even a partial answer can earn partial credit.
            </Typography>
          </Box>
        )}

        {/* ── AI Detailed Insights ── */}
        {(answer.conceptsPresent?.length > 0 || answer.conceptsMissing?.length > 0 ||
          answer.improvementSuggestions?.length > 0 || answer.technicalAccuracy) && (
          <Box sx={{ mt: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
              <Psychology fontSize="small" color="secondary" />
              <Typography variant="body2" fontWeight={700} color="secondary.main">AI Analysis</Typography>
            </Box>
            <Grid container spacing={1.25}>
              {answer.conceptsPresent?.length > 0 && (
                <Grid item xs={12} sm={6}>
                  <Box sx={{ p: 1.5, bgcolor: alpha(theme.palette.success.main, 0.07), borderRadius: 1.5, height: '100%' }}>
                    <Typography variant="caption" fontWeight={700} color="success.dark"
                      sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                      <TaskAlt fontSize="small" /> Concepts Identified
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {answer.conceptsPresent.map((c, i) => (
                        <Chip key={i} label={c} size="small" color="success" variant="outlined"
                          sx={{ fontSize: 10, height: 20 }} />
                      ))}
                    </Box>
                  </Box>
                </Grid>
              )}
              {answer.conceptsMissing?.length > 0 && (
                <Grid item xs={12} sm={6}>
                  <Box sx={{ p: 1.5, bgcolor: alpha(theme.palette.error.main, 0.07), borderRadius: 1.5, height: '100%' }}>
                    <Typography variant="caption" fontWeight={700} color="error.dark"
                      sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                      <ErrorOutline fontSize="small" /> Missing Concepts
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {answer.conceptsMissing.map((c, i) => (
                        <Chip key={i} label={c} size="small" color="error" variant="outlined"
                          sx={{ fontSize: 10, height: 20 }} />
                      ))}
                    </Box>
                  </Box>
                </Grid>
              )}
              {answer.improvementSuggestions?.length > 0 && (
                <Grid item xs={12}>
                  <Box sx={{ p: 1.5, bgcolor: alpha('#e65100', 0.07), borderRadius: 1.5 }}>
                    <Typography variant="caption" fontWeight={700} color="warning.dark"
                      sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                      <Lightbulb fontSize="small" /> Improvement Tips
                    </Typography>
                    {answer.improvementSuggestions.map((s, i) => (
                      <Box key={i} sx={{ display: 'flex', gap: 0.75, mb: 0.75, alignItems: 'flex-start' }}>
                        <Typography variant="body2" sx={{ color: '#e65100', fontWeight: 800, flexShrink: 0, lineHeight: 1.6 }}>{i + 1}.</Typography>
                        <Typography variant="body2" sx={{ lineHeight: 1.6 }}>{s}</Typography>
                      </Box>
                    ))}
                  </Box>
                </Grid>
              )}
              {answer.technicalAccuracy && (
                <Grid item xs={12}>
                  <Box sx={{ p: 1.5, bgcolor: alpha(theme.palette.primary.main, 0.06), borderRadius: 1.5 }}>
                    <Typography variant="caption" fontWeight={700} color="primary.dark"
                      sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                      <BarChart fontSize="small" /> Technical Accuracy
                    </Typography>
                    <Typography variant="body2">{answer.technicalAccuracy}</Typography>
                  </Box>
                </Grid>
              )}
              {answer.partialCreditBreakdown && Object.values(answer.partialCreditBreakdown).some(v => v > 0) && (
                <Grid item xs={12}>
                  <Box sx={{ p: 1.5, bgcolor: 'grey.50', borderRadius: 1.5 }}>
                    <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                      Partial Credit Breakdown
                    </Typography>
                    <Grid container spacing={1}>
                      {Object.entries(answer.partialCreditBreakdown).map(([k, v]) => (
                        <Grid item xs={6} sm={3} key={k}>
                          <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize', display: 'block' }}>{k}</Typography>
                          <LinearProgress variant="determinate" value={Math.min(100, v * 10)} sx={{ height: 6, borderRadius: 3, mb: 0.5 }} />
                          <Typography variant="caption" fontWeight={700}>{v}/10</Typography>
                        </Grid>
                      ))}
                    </Grid>
                  </Box>
                </Grid>
              )}
            </Grid>
          </Box>
        )}
      </Box>
  );
}
