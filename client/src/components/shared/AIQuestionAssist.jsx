import { useState } from 'react';
import { Box, Typography, Button, TextField, Alert, CircularProgress, Collapse } from '@mui/material';
import { AutoAwesome, ExpandMore, ExpandLess } from '@mui/icons-material';
import api from '../../services/api';

// Matching/ordering editors are duplicated across the app with two different field shapes:
// QuestionEditor.jsx / ManualExamBuilder read leftItems/rightItems/items, while the Edit- and
// Add-Question dialogs in TeacherDashboard.jsx read matchingPairs.{leftColumn,rightColumn,
// correctPairs} and itemsToOrder.items. Rather than special-case every call site, expand the
// server's patch to populate both shapes so onApply works no matter which UI reads it.
const textOf = (item) => (typeof item === 'string' ? item : item?.text || '');

function withLegacyShapes(patch) {
  const expanded = { ...patch };
  if (Array.isArray(patch.leftItems) && Array.isArray(patch.rightItems)) {
    const leftColumn = patch.leftItems.map(textOf);
    const rightColumn = patch.rightItems.map(textOf);
    expanded.matchingPairs = {
      leftColumn,
      rightColumn,
      correctPairs: leftColumn.map((_, i) => ({ left: i, right: i })),
    };
  }
  if (Array.isArray(patch.items)) {
    expanded.itemsToOrder = { items: patch.items.map(textOf) };
  }
  return expanded;
}

// Fields relevant to each question type, sent back to the server as "existing" so a second
// (or third...) AI Assist call edits/refines what's already there instead of blindly
// regenerating it — same idea as the spreadsheet box's currentSpreadsheet.
const EXISTING_FIELDS_BY_TYPE = {
  'multiple-choice': ['options', 'correctAnswer'],
  'true-false': ['correctAnswer', 'explanation'],
  'fill-blank': ['correctAnswer', 'acceptableAnswers'],
  'fill-in-blank': ['correctAnswer', 'acceptableAnswers'],
  'short-answer': ['correctAnswer', 'gradingCriteria', 'keyPoints', 'explanation'],
  'essay': ['correctAnswer', 'gradingCriteria', 'keyPoints', 'explanation'],
  'open-ended': ['correctAnswer', 'gradingCriteria', 'keyPoints', 'explanation'],
  'extended-response': ['correctAnswer', 'gradingCriteria', 'keyPoints', 'explanation'],
  'matching': ['leftItems', 'rightItems'],
  'ordering': ['items'],
};

function buildExisting(question) {
  const fields = EXISTING_FIELDS_BY_TYPE[question?.type] || ['correctAnswer', 'explanation'];
  const existing = {};
  fields.forEach((f) => {
    const v = question?.[f];
    if (Array.isArray(v) ? v.length > 0 : !!v) existing[f] = v;
  });
  return existing;
}

// "AI Assist" box for any question type except financial-spreadsheet (which gets its own
// paste-and-fill box built into FinancialSpreadsheet.jsx, since it needs direct access to the
// spreadsheet grid's internal state). Lets a teacher optionally paste material (an answer key,
// a list of options/pairs copied from Word, ...) and have AI fill in whichever fields are
// tedious to author by hand for the current question type (MCQ options, matching pairs,
// ordering items, grading criteria, acceptable answers, etc). Falls back to reasoning from the
// question's own text/passage alone when nothing is pasted. Stays visible/usable after a fill so
// the teacher can ask for further changes to the same question (sends what's already filled in
// as "existing" context so the AI edits/refines rather than starting over).
export default function AIQuestionAssist({ question, onApply, disabled }) {
  const [open, setOpen] = useState(false);
  const [pasted, setPasted] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filledCount, setFilledCount] = useState(0);

  if (question?.type === 'financial-spreadsheet') return null;

  const existing = buildExisting(question);
  const hasExisting = Object.keys(existing).length > 0;

  const handleFill = async () => {
    if (loading) return;
    if (!pasted.trim() && !(question?.text || '').trim()) {
      setError('Enter a question or paste some material first.');
      return;
    }
    setLoading(true);
    setError('');
    setFilledCount(0);
    try {
      const { data } = await api.post('/exam/ai-assist-question', {
        type: question?.type || 'open-ended',
        text: question?.text || '',
        passage: question?.passage || question?.context || '',
        pasted,
        existing,
      });
      const patch = withLegacyShapes(data.patch || {});
      onApply(patch);
      setFilledCount(Object.keys(patch).length);
      setPasted('');
    } catch (err) {
      setError(err.response?.data?.message || 'AI assist failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ border: '1px dashed #7C3AED', borderRadius: 1.5, bgcolor: '#F5F3FF' }}>
      <Box
        onClick={() => setOpen(o => !o)}
        sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1.5, py: 0.75, cursor: 'pointer' }}
      >
        <AutoAwesome sx={{ fontSize: 15, color: '#7C3AED' }} />
        <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: '#5B21B6', flexGrow: 1 }}>
          {hasExisting ? 'AI Assist — request a change to this question' : 'AI Assist — fill in the hard parts for me'}
        </Typography>
        {open ? <ExpandLess sx={{ fontSize: 16, color: '#7C3AED' }} /> : <ExpandMore sx={{ fontSize: 16, color: '#7C3AED' }} />}
      </Box>
      <Collapse in={open}>
        <Box sx={{ px: 1.5, pb: 1.5 }}>
          <Typography sx={{ fontSize: 11, color: '#6D28D9', mb: 1 }}>
            {hasExisting
              ? 'Already filled in? Ask AI to change it — e.g. "make option C correct instead", "add a stricter grading criterion" — or paste new material to redo it. Anything you don\'t mention stays as-is.'
              : 'Optionally paste an answer key, options, or notes (from Word/Excel/anywhere), or just leave this blank and AI will work from the question text alone.'}
          </Typography>
          <TextField
            fullWidth
            multiline
            minRows={2}
            maxRows={8}
            placeholder={hasExisting ? 'Describe a change, or paste new material (optional)…' : 'Paste material here (optional)…'}
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            disabled={loading || disabled}
            sx={{ bgcolor: 'white', mb: 1, '& .MuiOutlinedInput-root': { fontSize: 12 } }}
          />
          {error && <Alert severity="error" sx={{ mb: 1, py: 0, fontSize: 11 }}>{error}</Alert>}
          {!error && filledCount > 0 && (
            <Alert severity="success" sx={{ mb: 1, py: 0, fontSize: 11 }}>
              AI updated {filledCount} field{filledCount === 1 ? '' : 's'} — review before saving. You can ask for another change any time.
            </Alert>
          )}
          <Button
            size="small"
            variant="contained"
            disabled={loading || disabled}
            onClick={handleFill}
            startIcon={loading ? <CircularProgress size={14} color="inherit" /> : <AutoAwesome sx={{ fontSize: 14 }} />}
            sx={{ textTransform: 'none', fontSize: 11.5, bgcolor: '#7C3AED', '&:hover': { bgcolor: '#6D28D9' } }}
          >
            {loading ? (hasExisting ? 'Updating…' : 'Filling…') : (hasExisting ? 'AI Update This Question' : 'AI Fill This Question')}
          </Button>
        </Box>
      </Collapse>
    </Box>
  );
}
