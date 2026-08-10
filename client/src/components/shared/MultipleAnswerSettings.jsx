/**
 * MultipleAnswerSettings.jsx
 *
 * The "Allow multiple correct answers" switch and its marking-mode selector, for multiple-choice
 * questions where more than one option is correct ("select all that apply").
 *
 * Shared because the app has five separate multiple-choice editors — the exam-bank/AI-generated
 * editor (QuestionEditor), the teacher's manual exam builder, the Add Question and Edit Question
 * dialogs, and the sub-question editor. Each had its own hand-rolled correct-answer control, so a
 * teacher configuring the same thing in two places would otherwise get two different behaviours.
 *
 * Applying the returned patch is the caller's job (they all store questions differently), but the
 * option-key bookkeeping is not: use applyAllowMultiple/toggleCorrectOption from
 * utils/multipleAnswer so `options[].isCorrect` and `correctAnswer` can never drift apart.
 */

import { Box, Typography, Switch, FormControlLabel, FormControl, InputLabel, Select, MenuItem, Chip, Alert } from '@mui/material';
import { isMultiAnswerQuestion, countCorrectOptions, applyAllowMultiple } from '../../utils/multipleAnswer';

export default function MultipleAnswerSettings({
  question,
  onChange,
  compact = false,
  marks,
  showHints = true
}) {
  const allowMultiple = isMultiAnswerQuestion(question);
  const correctCount = countCorrectOptions(question);
  const scoring = question?.multipleAnswerScoring || 'partial';
  const totalMarks = marks ?? question?.marks ?? question?.points ?? 1;

  return (
    <Box
      sx={{
        mb: compact ? 1 : 1.5,
        p: compact ? 1 : 1.5,
        bgcolor: allowMultiple ? '#EFF6FF' : '#FAFBFC',
        borderRadius: 1.5,
        border: `1px solid ${allowMultiple ? '#BFDBFE' : '#E2E8F0'}`
      }}
    >
      <FormControlLabel
        sx={{ m: 0 }}
        control={
          <Switch
            size="small"
            checked={allowMultiple}
            onChange={(e) => onChange(applyAllowMultiple(question, e.target.checked))}
          />
        }
        label={
          <Box>
            <Typography sx={{ fontSize: compact ? 11 : 12, fontWeight: 700 }}>
              Allow multiple correct answers
            </Typography>
            {!compact && (
              <Typography sx={{ fontSize: 11, color: '#64748B' }}>
                Students tick every option that applies instead of picking just one.
              </Typography>
            )}
          </Box>
        }
      />

      {allowMultiple && (
        <Box sx={{ mt: 1, display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          <FormControl size="small" sx={{ minWidth: compact ? 170 : 240 }}>
            <InputLabel sx={{ fontSize: 11 }}>Marking</InputLabel>
            <Select
              label="Marking"
              value={scoring}
              onChange={(e) => onChange({ multipleAnswerScoring: e.target.value })}
              sx={{ fontSize: compact ? 11 : 12, bgcolor: 'white' }}
            >
              <MenuItem value="partial" sx={{ fontSize: 12 }}>Partial credit (per correct option)</MenuItem>
              <MenuItem value="all-or-nothing" sx={{ fontSize: 12 }}>All-or-nothing (exact match only)</MenuItem>
            </Select>
          </FormControl>
          <Chip
            size="small"
            label={`${correctCount} correct`}
            sx={{ height: 22, fontSize: 11, fontWeight: 700, bgcolor: 'rgba(12,189,115,0.15)', color: '#166534' }}
          />
          {showHints && !compact && (
            <Typography sx={{ fontSize: 11, color: '#64748B', flex: 1, minWidth: 200 }}>
              {scoring === 'all-or-nothing'
                ? `Full ${totalMarks} mark${totalMarks !== 1 ? 's' : ''} only if exactly the ${correctCount} correct option${correctCount !== 1 ? 's' : ''} are ticked.`
                : 'Each correct tick earns a share of the marks and each wrong tick loses the same share, never below 0.'}
            </Typography>
          )}
        </Box>
      )}

      {showHints && allowMultiple && correctCount < 2 && (
        <Alert severity="warning" sx={{ mt: 1, py: 0.25, '& .MuiAlert-message': { fontSize: 11 } }}>
          Mark at least two options correct using the checkboxes.
        </Alert>
      )}
      {showHints && !allowMultiple && correctCount === 0 && (question?.options || []).length > 0 && (
        <Alert severity="info" sx={{ mt: 1, py: 0.25, '& .MuiAlert-message': { fontSize: 11 } }}>
          No correct option marked yet — select one so this question can be graded.
        </Alert>
      )}
    </Box>
  );
}
