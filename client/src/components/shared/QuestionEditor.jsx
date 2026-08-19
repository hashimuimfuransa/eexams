import { useState, useRef } from 'react';
import { toImageEntries } from '../../utils/getImageUrl';
import MultiImageUploader from './MultiImageUploader';
import {
  Box, Typography, Chip, Button, Paper, Grid, TextField,
  IconButton, Tooltip, Select, MenuItem, FormControl, InputLabel,
  Alert, Radio, FormControlLabel, RadioGroup, Checkbox, Switch
} from '@mui/material';
import {
  Add, Delete, CheckCircleOutline, Close, ExpandMore, ExpandLess,
  RadioButtonChecked, CheckBox, DragIndicator, SwapVert, Visibility,
  Article, ShortText, FormatListNumbered, DoneAll
} from '@mui/icons-material';
import {
  isMultiAnswerQuestion, correctAnswerFromOptions, isOptionCorrect,
  normalizeOptions, toggleCorrectOption
} from '../../utils/multipleAnswer';
import MultipleAnswerSettings from './MultipleAnswerSettings';
import { tokens } from '../../pages/dashboardTokens';
import { FinancialSpreadsheetQuestion } from '../FinancialSpreadsheet';
import AIQuestionAssist from './AIQuestionAssist';

// --- Matching question helpers -------------------------------------------------
// Matching data is stored in two different shapes depending on how the question was
// created: the pasted-exam path writes `leftItems`/`rightItems`, while the file parser
// and AI generation write `matchingPairs.leftColumn`/`rightColumn`. The answer key
// always lives in `matchingPairs.correctPairs` (leftIndex -> rightIndex) - that is the
// only field the graders read. So read from every shape, and always write back both
// shapes plus the key, otherwise an exam edited here loses its matching answers.
const matchItemText = (item) => {
  if (typeof item === 'string') return item;
  if (item && typeof item === 'object') return item.text || item.label || item.value || '';
  return item === 0 ? '0' : '';
};

const readMatchingColumns = (q) => {
  const pick = (explicit, column, fromOptions) => (
    explicit?.length ? explicit : column?.length ? column : fromOptions || []
  );
  const left = pick(q.leftItems, q.matchingPairs?.leftColumn, q.options?.filter((_, i) => i % 2 === 0));
  const right = pick(q.rightItems, q.matchingPairs?.rightColumn, q.options?.filter((_, i) => i % 2 === 1));
  return { left: left.map(matchItemText), right: right.map(matchItemText) };
};

// correctPairs is Mixed in the schema, so an index can arrive as a number, a numeric
// string, the item's own text, or a letter label. Resolve all of them to an index so a
// stored answer key is still shown (and stays gradeable) instead of silently reading as unset.
const resolveMatchIndex = (value, list) => {
  if (value === null || value === undefined || value === '') return -1;
  if (typeof value === 'number') return Number.isInteger(value) ? value : -1;
  const raw = matchItemText(value) || String(value);
  const trimmed = raw.trim();
  // Text match is tried before the numeric reading: the server's reconcileMatching writes the
  // items' own text into correctPairs, and a column of numbers ("1", "2") would otherwise be
  // misread as indices.
  const byText = list.findIndex(item => item.trim().toLowerCase() === trimmed.toLowerCase());
  if (byText !== -1) return byText;
  if (/^\d+$/.test(trimmed)) return parseInt(trimmed, 10);
  if (/^[A-Za-z]$/.test(trimmed)) return trimmed.toUpperCase().charCodeAt(0) - 65;
  return -1;
};

// Answer key as { leftIndex: rightIndex }. A question with no stored correctPairs falls
// back to the same-order convention used by the rest of the app (left i matches right i).
const readMatchingKey = (q, left, right) => {
  const key = {};
  left.forEach((_, i) => { key[i] = i; });
  (q.matchingPairs?.correctPairs || []).forEach(pair => {
    const l = resolveMatchIndex(pair?.left, left);
    if (l < 0 || l >= left.length) return;
    // A pair whose right side cannot be resolved (deleted item, unrecognisable value) is
    // reported as -1 rather than falling back to row order, so the editor shows it as unset
    // instead of quietly displaying a different item as if it were the stored answer.
    const r = resolveMatchIndex(pair?.right, right);
    key[l] = r >= 0 && r < right.length ? r : -1;
  });
  return key;
};

const writeMatching = (q, left, right, key) => ({
  ...q,
  leftItems: left.map(text => ({ text })),
  rightItems: right.map(text => ({ text })),
  matchingPairs: {
    ...q.matchingPairs,
    leftColumn: [...left],
    rightColumn: [...right],
    correctPairs: left.map((_, i) => ({ left: i, right: key[i] ?? i }))
  }
});

// Keeps the answer key pointing at the same items after a row is removed: every index above
// the removed row shifts down, and a left item whose answer was the removed right item is
// marked unset (-1) instead of being silently re-pointed at whatever slid into that slot.
const removeMatchingRow = (row, left, right, key) => {
  const nextLeft = left.filter((_, i) => i !== row);
  const nextRight = right.filter((_, i) => i !== row);
  const nextKey = {};
  nextLeft.forEach((_, i) => {
    const oldLeft = i < row ? i : i + 1;
    const oldRight = key[oldLeft];
    if (oldRight === undefined) { nextKey[i] = i; return; }
    if (oldRight === row || oldRight < 0) { nextKey[i] = -1; return; }
    nextKey[i] = oldRight > row ? oldRight - 1 : oldRight;
  });
  return { left: nextLeft, right: nextRight, key: nextKey };
};

// Full-featured question editor supporting every question type (multiple-choice,
// true-false, fill-blank, open-ended/short-answer/essay, matching, ordering,
// drag-drop, structured, financial-spreadsheet, sub-questions). Shared between
// the teacher exam builder and the super admin exam bank editor so both get
// identical editing capability.
export const QuestionEditor = ({ question, index, onUpdate, onDelete, isMobile, sections, onSectionChange }) => {
  const [expanded, setExpanded] = useState(false);
  // Blank rows the matching editor is showing beyond the stored columns. Kept out of the
  // question itself so "Add Pair" doesn't write empty items (which would show up as empty
  // slots for students) until something is actually typed into the new row.
  const [minMatchRows, setMinMatchRows] = useState(0);
  const [edited, setEdited] = useState(false);
  const [localQ, setLocalQ] = useState(question);
  // Tracks the latest localQ synchronously so back-to-back commits in the same tick
  // (e.g. a spreadsheet's onModelChange immediately followed by onTemplateChange)
  // each build on top of the other instead of both reading the same pre-update value.
  const localQRef = useRef(question);
  localQRef.current = localQ;

  const qType = localQ.type || 'multiple-choice';
  const typeColors = {
    'multiple-choice': '#3B82F6',
    'true-false': '#8B5CF6',
    'fill-blank': '#F59E0B',
    'fill-in-blank': '#F59E0B',
    'open-ended': '#EC4899',
    'short-answer': '#8B5CF6',
    'essay': '#F59E0B',
    'matching': '#10B981',
    'ordering': '#6366F1',
    'drag-drop': '#14B8A6',
    'image-based': '#F97316',
    'structured': '#8B5CF6',
    'financial-spreadsheet': '#0EA5E9'
  };
  const typeIcons = {
    'multiple-choice': <RadioButtonChecked sx={{ fontSize: 14 }} />,
    'true-false': <CheckBox sx={{ fontSize: 14 }} />,
    'fill-blank': <ShortText sx={{ fontSize: 14 }} />,
    'fill-in-blank': <ShortText sx={{ fontSize: 14 }} />,
    'open-ended': <FormatListNumbered sx={{ fontSize: 14 }} />,
    'short-answer': <ShortText sx={{ fontSize: 14 }} />,
    'essay': <Article sx={{ fontSize: 14 }} />,
    'matching': <FormatListNumbered sx={{ fontSize: 14 }} />,
    'ordering': <FormatListNumbered sx={{ fontSize: 14 }} />,
    'drag-drop': <DragIndicator sx={{ fontSize: 14 }} />,
    'image-based': <Visibility sx={{ fontSize: 14 }} />,
    'structured': <FormatListNumbered sx={{ fontSize: 14 }} />,
    'financial-spreadsheet': <FormatListNumbered sx={{ fontSize: 14 }} />
  };

  const handleSave = () => {
    const cleanedWordBank = localQ.wordBank ? localQ.wordBank.map(w => w.trim()).filter(Boolean) : localQ.wordBank;
    onUpdate({ ...localQ, wordBank: cleanedWordBank });
    setEdited(false);
  };

  const handleCancel = () => {
    setLocalQ(question);
    setEdited(false);
  };

  // AI-fill/AI-assist results and image uploads are one-shot actions the teacher has already
  // explicitly confirmed (clicking "AI Fill", picking a file) — commit them to the parent
  // immediately instead of leaving them stuck in this card's local draft until the teacher
  // separately remembers to click the Save checkmark before Save Draft/Publish. Typed fields
  // (text, options, correctAnswer, ...) keep the normal buffered Save/Cancel behavior.
  const commit = (updater) => {
    const next = updater(localQRef.current);
    localQRef.current = next;
    setLocalQ(next);
    setEdited(false);
    onUpdate(next);
  };

  const commitSubQ = (idx, patch) => {
    const base = localQRef.current;
    const updated = [...base.subQuestions];
    updated[idx] = { ...updated[idx], ...patch };
    const next = { ...base, subQuestions: updated };
    localQRef.current = next;
    setLocalQ(next);
    setEdited(false);
    onUpdate(next);
  };

  // Helper to get option display text (handles both string and object formats)
  const getOptionText = (opt) => {
    if (typeof opt === 'string') return opt;
    if (opt && typeof opt === 'object') return opt.text || opt.label || opt.value || '';
    return '';
  };

  // Options are stored as plain strings by some import paths; marking one correct needs the object
  // shape, so upgrade the whole list whenever options are edited.
  const normalizeOptionObjects = (options) => normalizeOptions(options || []);

  const updateOption = (idx, value) => {
    // Normalized rather than written back as a bare string so editing an option's text never drops
    // the isCorrect flag that marks it as (part of) the answer.
    const newOptions = normalizeOptionObjects(localQ.options);
    newOptions[idx] = { ...newOptions[idx], text: value };
    setLocalQ({ ...localQ, options: newOptions });
    setEdited(true);
  };

  const addOption = () => {
    const currentOptions = normalizeOptionObjects(localQ.options);
    const newOption = {
      text: `Option ${String.fromCharCode(65 + currentOptions.length)}`,
      isCorrect: false,
      letter: String.fromCharCode(65 + currentOptions.length)
    };
    setLocalQ({ ...localQ, options: [...currentOptions, newOption] });
    setEdited(true);
  };

  const removeOption = (idx) => {
    const newOptions = normalizeOptionObjects(localQ.options).filter((_, i) => i !== idx);
    setLocalQ({ ...localQ, options: newOptions, correctAnswer: correctAnswerFromOptions(newOptions) });
    setEdited(true);
  };

  const allowMultiple = isMultiAnswerQuestion(localQ);
  const correctCount = (localQ.options || []).filter(isOptionCorrect).length;

  // Tick/untick an option as part of the marking key. In single-answer mode picking one clears the
  // others (radio behaviour); in multi-answer mode each option toggles independently.
  // `correctAnswer` is kept in step because the graders fall back to it when no option is flagged.
  const toggleOptionCorrect = (idx) => {
    setLocalQ({ ...localQ, ...toggleCorrectOption(localQ.options, idx, allowMultiple) });
    setEdited(true);
  };

  return (
    <Paper elevation={0} sx={{ border: `1px solid ${edited ? '#F59E0B' : tokens.surfaceBorder}`, borderRadius: 2, transition: 'all 0.2s' }}>
      {/* Header - Always visible */}
      <Box
        sx={{
          p: 1.5,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          cursor: 'pointer',
          bgcolor: expanded ? '#F8FAFC' : 'white',
          '&:hover': { bgcolor: '#F8FAFC' }
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <Chip
          label={`Q${index + 1}`}
          size="small"
          sx={{
            bgcolor: `${typeColors[qType]}15`,
            color: typeColors[qType],
            fontWeight: 700,
            minWidth: 45
          }}
        />
        {sections && sections.length > 0 && (
          <FormControl size="small" sx={{ minWidth: 100 }}>
            <InputLabel>Section</InputLabel>
            <Select
              value={localQ.section || 'A'}
              label="Section"
              onChange={(e) => {
                const newSection = e.target.value;
                setLocalQ({ ...localQ, section: newSection });
                setEdited(true);
                if (onSectionChange) {
                  onSectionChange(index, newSection);
                }
              }}
              onClick={(e) => e.stopPropagation()}
              sx={{ borderRadius: 2, '& .MuiSelect-select': { fontSize: 11, py: 0.5 } }}
            >
              {sections.map((s, idx) => (
                <MenuItem key={idx} value={s.name} sx={{ fontSize: 11 }}>
                  Section {s.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
        <Box sx={{ flexGrow: 1, minWidth: 0, maxWidth: isMobile ? 'calc(100% - 80px)' : 'auto' }}>
          <Typography variant="body2" sx={{ fontFamily: "DM Sans,sans-serif", fontWeight: 500, fontSize: isMobile ? 12 : 14 }} noWrap={!expanded}>
            {localQ.text || 'Untitled Question'}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: isMobile ? 0.5 : 1, mt: 0.25, flexWrap: 'wrap' }}>
            {localQ.subsectionTitle && (
              <Chip label={localQ.subsectionTitle} size="small" sx={{ height: 16, fontSize: 9, bgcolor: '#E0E7FF', color: '#3730A3', fontWeight: 600 }} />
            )}
            {localQ.wordBank && localQ.wordBank.length > 0 && (
              <Chip label="Word Bank" size="small" sx={{ height: 16, fontSize: 9, bgcolor: '#DCFCE7', color: '#166534', fontWeight: 600 }} />
            )}
            {localQ.passage && (
              <Chip label="Passage" size="small" sx={{ height: 16, fontSize: 9, bgcolor: '#DBEAFE', color: '#1E40AF', fontWeight: 600 }} />
            )}
            {localQ.subQuestions && Array.isArray(localQ.subQuestions) && localQ.subQuestions.length > 0 && (
              <Chip label={`${localQ.subQuestions.length} Sub-Q${localQ.subQuestions.length > 1 ? 's' : ''}`} size="small" sx={{ height: 16, fontSize: 9, bgcolor: '#DCFCE7', color: '#166534', fontWeight: 600 }} />
            )}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: tokens.textMuted, fontSize: isMobile ? 10 : 11 }}>
              {typeIcons[qType]}
              <span style={{ textTransform: 'capitalize', fontSize: isMobile ? 9 : 11 }}>{qType.replace('-', ' ')}</span>
            </Box>
            <Typography sx={{ fontSize: isMobile ? 10 : 11, color: tokens.textMuted }}>• {localQ.marks || 1}m</Typography>
            {/* Show MCQ options preview in collapsed view */}
            {qType === 'multiple-choice' && (localQ.options || []).length > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 0.5 }}>
                {!isMobile && <Typography sx={{ fontSize: 10, color: tokens.textMuted }}>• Options:</Typography>}
                {(localQ.options || []).slice(0, 4).map((opt, idx) => (
                  isMobile ? (
                    <Chip
                      key={idx}
                      label={String.fromCharCode(65 + idx)}
                      size="small"
                      sx={{
                        height: 16,
                        minWidth: 18,
                        fontSize: 8,
                        fontWeight: 800,
                        bgcolor: opt.isCorrect || opt.correct ? `${typeColors[qType]}50` : `${typeColors[qType]}20`,
                        color: typeColors[qType],
                        border: opt.isCorrect || opt.correct ? `1.5px solid ${typeColors[qType]}` : `1px solid ${typeColors[qType]}40`,
                      }}
                    />
                  ) : (
                    <Tooltip key={idx} title={getOptionText(opt) || `Option ${String.fromCharCode(65 + idx)}`} arrow>
                      <Chip
                        label={String.fromCharCode(65 + idx)}
                        size="small"
                        sx={{
                          height: 18,
                          minWidth: 22,
                          fontSize: 9,
                          fontWeight: 700,
                          bgcolor: opt.isCorrect || opt.correct ? `${typeColors[qType]}40` : `${typeColors[qType]}15`,
                          color: typeColors[qType],
                          border: opt.isCorrect || opt.correct ? `2px solid ${typeColors[qType]}` : `1px solid ${typeColors[qType]}30`,
                          cursor: 'pointer'
                        }}
                      />
                    </Tooltip>
                  )
                ))}
              </Box>
            )}
            {/* Matching questions keep their answer in matchingPairs.correctPairs, not in
                correctAnswer, so summarise the key here - otherwise a matching question looks
                like it has no answer set until the card is expanded. */}
            {qType === 'matching' && (() => {
              const { left, right } = readMatchingColumns(localQ);
              if (left.length === 0) return null;
              const key = readMatchingKey(localQ, left, right);
              const set = left.filter((_, i) => key[i] >= 0 && key[i] < right.length).length;
              const summary = left.map((_, i) => `${i + 1}→${key[i] >= 0 && key[i] < right.length ? key[i] + 1 : '?'}`).join(' ');
              return (
                <Tooltip title={`Answer key (left→right): ${summary}`} arrow>
                  <Chip
                    label={`Key: ${set}/${left.length} matched`}
                    size="small"
                    sx={{
                      height: 16,
                      fontSize: 9,
                      fontWeight: 600,
                      bgcolor: set === left.length ? '#D1FAE5' : '#FEF3C7',
                      color: set === left.length ? '#065F46' : '#B45309',
                      cursor: 'pointer'
                    }}
                  />
                </Tooltip>
              );
            })()}
            {/* Show correct answer indicator */}
            {localQ.correctAnswer && (
              <Chip
                label={`Answer: ${String(localQ.correctAnswer).slice(0, 15)}${String(localQ.correctAnswer).length > 15 ? '...' : ''}`}
                size="small"
                sx={{ height: 16, fontSize: 9, bgcolor: '#DBEAFE', color: '#1E40AF', fontWeight: 600 }}
              />
            )}
            {edited && <Chip label="Modified" size="small" sx={{ height: 16, fontSize: 9, bgcolor: '#FEF3C7', color: '#D97706', fontWeight: 600 }} />}
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {edited ? (
            <>
              <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleSave(); }} sx={{ color: tokens.accent }}>
                <CheckCircleOutline sx={{ fontSize: 18 }} />
              </IconButton>
              <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleCancel(); }} sx={{ color: '#EF4444' }}>
                <Close sx={{ fontSize: 18 }} />
              </IconButton>
            </>
          ) : (
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }} sx={{ color: tokens.textMuted }}>
              {expanded ? <ExpandLess sx={{ fontSize: 18 }} /> : <ExpandMore sx={{ fontSize: 18 }} />}
            </IconButton>
          )}
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); onDelete(); }} sx={{ color: '#EF4444', ml: 0.5 }}>
            <Delete sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>
      </Box>

      {/* Expanded Editor - Improved Layout */}
      {expanded && (
        <Box sx={{ p: isMobile ? 2 : 2.5, pt: 2, bgcolor: '#F8FAFC', borderTop: `2px solid ${typeColors[qType]}40` }}>
          {/* Section Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, pb: 1.5, borderBottom: `1px dashed ${tokens.surfaceBorder}` }}>
            <Box sx={{ color: typeColors[qType], display: 'flex', alignItems: 'center' }}>
              {typeIcons[qType]}
            </Box>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: tokens.textPrimary, textTransform: 'capitalize' }}>
              {qType.replace('-', ' ')} Question Editor
            </Typography>
          </Box>

          {/* Editable Context Information (Passage, Word Bank, Instructions) */}
          <Box sx={{ mb: 2, p: 1.5, bgcolor: '#EFF6FF', borderRadius: 2, border: '1px solid #BFDBFE' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#1E40AF', textTransform: 'uppercase' }}>
                📖 Passage (Optional)
              </Typography>
              {localQ.passage && (
                <IconButton size="small" onClick={() => { setLocalQ({ ...localQ, passage: '' }); setEdited(true); }} sx={{ color: '#EF4444', p: 0.5 }}>
                  <Delete sx={{ fontSize: 14 }} />
                </IconButton>
              )}
            </Box>
            <TextField
              fullWidth
              size="small"
              placeholder="Add a reading passage for this question..."
              multiline
              minRows={2}
              maxRows={6}
              value={localQ.passage || ''}
              onChange={(e) => { setLocalQ({ ...localQ, passage: e.target.value }); setEdited(true); }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5, bgcolor: 'white', fontSize: 12, lineHeight: 1.5 } }}
            />
          </Box>

          <Box sx={{ mb: 2, p: 1.5, bgcolor: '#F0FDF4', borderRadius: 2, border: '1px solid #BBF7D0' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>
                📝 Word Bank (Optional)
              </Typography>
              {localQ.wordBank && localQ.wordBank.some(w => w.trim()) && (
                <IconButton size="small" onClick={() => { setLocalQ({ ...localQ, wordBank: [] }); setEdited(true); }} sx={{ color: '#EF4444', p: 0.5 }}>
                  <Delete sx={{ fontSize: 14 }} />
                </IconButton>
              )}
            </Box>
            <TextField
              fullWidth
              size="small"
              placeholder="Enter words separated by commas (e.g., apple, banana, orange)"
              value={localQ.wordBank ? localQ.wordBank.join(',') : ''}
              onChange={(e) => {
                // Keep the raw split (no trim/filter) so the field echoes back
                // exactly what was typed — trimming/filtering on every keystroke
                // eats trailing spaces and commas as you type them. Cleaned up
                // on save (see handleSave) and for the chip preview below.
                setLocalQ({ ...localQ, wordBank: e.target.value.split(',') });
                setEdited(true);
              }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5, bgcolor: 'white', fontSize: 12 } }}
              helperText="Separate words with commas"
            />
            {localQ.wordBank && localQ.wordBank.some(w => w.trim()) && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                {localQ.wordBank.map(w => w.trim()).filter(Boolean).map((word, idx) => (
                  <Chip key={idx} label={word} size="small" sx={{ bgcolor: '#DCFCE7', color: '#166534', fontSize: 11, fontWeight: 600 }} />
                ))}
              </Box>
            )}
          </Box>

          <Box sx={{ mb: 2, p: 1.5, bgcolor: '#FEF3C7', borderRadius: 2, border: '1px solid #FDE68A' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#92400E', textTransform: 'uppercase' }}>
                ℹ️ Instructions (Optional)
              </Typography>
              {localQ.instructions && (
                <IconButton size="small" onClick={() => { setLocalQ({ ...localQ, instructions: '' }); setEdited(true); }} sx={{ color: '#EF4444', p: 0.5 }}>
                  <Delete sx={{ fontSize: 14 }} />
                </IconButton>
              )}
            </Box>
            <TextField
              fullWidth
              size="small"
              placeholder="Add special instructions for this question..."
              multiline
              minRows={1}
              maxRows={4}
              value={localQ.instructions || ''}
              onChange={(e) => { setLocalQ({ ...localQ, instructions: e.target.value }); setEdited(true); }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5, bgcolor: 'white', fontSize: 12, lineHeight: 1.5 } }}
            />
          </Box>

          {localQ.subsectionTitle && (
            <Box sx={{ mb: 2 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: tokens.textSecondary, textTransform: 'uppercase' }}>
                Subsection
              </Typography>
              <Typography sx={{ fontSize: 13, color: tokens.textPrimary, fontWeight: 600 }}>
                {localQ.subsectionTitle}
              </Typography>
            </Box>
          )}

          <Grid container spacing={2.5}>
            {/* Question Text - Full Width */}
            <Grid item xs={12}>
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: tokens.textSecondary, mb: 0.75, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Question Text *
              </Typography>
              <TextField
                fullWidth
                size="small"
                placeholder="Enter the question here..."
                multiline
                minRows={3}
                maxRows={6}
                value={localQ.text || ''}
                onChange={(e) => { setLocalQ({ ...localQ, text: e.target.value }); setEdited(true); }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: 'white', fontSize: 14, lineHeight: 1.6 } }}
              />
            </Grid>

            {/* Image Upload - Available for all question types */}
            <Grid item xs={12}>
              <MultiImageUploader
                images={localQ.images || toImageEntries(localQ)}
                onChange={(images) => commit(q => ({ ...q, images, image: null, imageUrl: '' }))}
              />
            </Grid>

            {/* Settings Row - Responsive: 2 cols on mobile, 4 cols on desktop */}
            <Grid item xs={12} sm={6} md={3}>
              <Typography sx={{ fontSize: isMobile ? 10 : 11, fontWeight: 700, color: tokens.textSecondary, mb: 0.75, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Question Type *
              </Typography>
              <FormControl fullWidth size="small">
                <Select
                  value={qType}
                  onChange={(e) => { setLocalQ({ ...localQ, type: e.target.value }); setEdited(true); }}
                  sx={{ borderRadius: 2, bgcolor: 'white', fontSize: isMobile ? 12 : 13 }}
                  displayEmpty
                >
                  <MenuItem value="multiple-choice" sx={{ fontSize: isMobile ? 12 : 14 }}>Multiple Choice</MenuItem>
                  <MenuItem value="true-false" sx={{ fontSize: isMobile ? 12 : 14 }}>True / False</MenuItem>
                  <MenuItem value="fill-blank" sx={{ fontSize: isMobile ? 12 : 14 }}>Fill in Blank</MenuItem>
                  <MenuItem value="short-answer" sx={{ fontSize: isMobile ? 12 : 14 }}>Short Answer</MenuItem>
                  <MenuItem value="essay" sx={{ fontSize: isMobile ? 12 : 14 }}>Essay</MenuItem>
                  <MenuItem value="open-ended" sx={{ fontSize: isMobile ? 12 : 14 }}>Open Ended</MenuItem>
                  <MenuItem value="matching" sx={{ fontSize: isMobile ? 12 : 14 }}>Matching</MenuItem>
                  <MenuItem value="ordering" sx={{ fontSize: isMobile ? 12 : 14 }}>Ordering</MenuItem>
                  <MenuItem value="drag-drop" sx={{ fontSize: isMobile ? 12 : 14 }}>Drag & Drop</MenuItem>
                  <MenuItem value="image-based" sx={{ fontSize: isMobile ? 12 : 14 }}>Image Based</MenuItem>
                  <MenuItem value="structured" sx={{ fontSize: isMobile ? 12 : 14 }}>Structured</MenuItem>
                  <MenuItem value="financial-spreadsheet" sx={{ fontSize: isMobile ? 12 : 14 }}>💹 Financial Spreadsheet</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} sm={3} md={2}>
              <Typography sx={{ fontSize: isMobile ? 10 : 11, fontWeight: 700, color: tokens.textSecondary, mb: 0.75, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Marks *
              </Typography>
              <TextField
                fullWidth
                size="small"
                type="number"
                inputProps={{ min: 1, max: 100 }}
                value={localQ.marks || 1}
                onChange={(e) => { setLocalQ({ ...localQ, marks: +e.target.value }); setEdited(true); }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: 'white', fontSize: isMobile ? 12 : 13 } }}
              />
            </Grid>
            <Grid item xs={6} sm={3} md={2}>
              <Typography sx={{ fontSize: isMobile ? 10 : 11, fontWeight: 700, color: tokens.textSecondary, mb: 0.75, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Difficulty
              </Typography>
              <FormControl fullWidth size="small">
                <Select
                  value={localQ.difficulty || 'medium'}
                  onChange={(e) => { setLocalQ({ ...localQ, difficulty: e.target.value }); setEdited(true); }}
                  sx={{ borderRadius: 2, bgcolor: 'white', fontSize: isMobile ? 12 : 13 }}
                >
                  <MenuItem value="easy" sx={{ fontSize: isMobile ? 12 : 14 }}>Easy</MenuItem>
                  <MenuItem value="medium" sx={{ fontSize: isMobile ? 12 : 14 }}>Medium</MenuItem>
                  <MenuItem value="hard" sx={{ fontSize: isMobile ? 12 : 14 }}>Hard</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={5}>
              <Typography sx={{ fontSize: isMobile ? 10 : 11, fontWeight: 700, color: tokens.textSecondary, mb: 0.75, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Correct Answer *
              </Typography>
              <TextField
                fullWidth
                size="small"
                placeholder={qType === 'multiple-choice' ? (allowMultiple ? 'e.g., A, C' : 'e.g., A or the correct option text') : qType === 'true-false' ? 'True or False' : 'Enter the correct answer'}
                value={localQ.correctAnswer || ''}
                onChange={(e) => { setLocalQ({ ...localQ, correctAnswer: e.target.value }); setEdited(true); }}
                helperText={qType === 'multiple-choice'
                  ? (allowMultiple
                      ? 'Filled in automatically from the ticked options below'
                      : 'Filled in automatically from the option you mark correct below')
                  : undefined}
                FormHelperTextProps={{ sx: { fontSize: 10, mx: 0.25 } }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: 'white', fontSize: isMobile ? 12 : 13 } }}
              />
            </Grid>

            {/* AI Assist - available for every question type except financial-spreadsheet */}
            <Grid item xs={12}>
              <AIQuestionAssist
                question={localQ}
                onApply={(patch) => commit(q => ({ ...q, ...patch }))}
              />
            </Grid>

            {/* Options for Multiple Choice - Full Width Section */}
            {qType === 'multiple-choice' && (
              <Grid item xs={12}>
                <Box sx={{ mt: 1, p: isMobile ? 1.5 : 2, bgcolor: 'white', borderRadius: 2, border: `1px solid ${tokens.surfaceBorder}` }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: isMobile ? 1.5 : 2 }}>
                    <Typography sx={{ fontSize: isMobile ? 11 : 12, fontWeight: 700, color: tokens.textPrimary, display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      {allowMultiple
                        ? <DoneAll sx={{ fontSize: isMobile ? 14 : 16, color: typeColors[qType] }} />
                        : <RadioButtonChecked sx={{ fontSize: isMobile ? 14 : 16, color: typeColors[qType] }} />}
                      Answer Options
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      {allowMultiple && (
                        <Chip
                          label={`${correctCount} correct`}
                          size="small"
                          sx={{ height: isMobile ? 20 : 22, fontSize: isMobile ? 10 : 11, bgcolor: `${tokens.accent}20`, color: '#166534', fontWeight: 700 }}
                        />
                      )}
                      <Chip
                        label={`${(localQ.options || []).length} options`}
                        size="small"
                        sx={{ height: isMobile ? 20 : 22, fontSize: isMobile ? 10 : 11, bgcolor: `${typeColors[qType]}15`, color: typeColors[qType], fontWeight: 600 }}
                      />
                    </Box>
                  </Box>

                  {/* Single vs multiple correct answers — shared with the teacher dashboard's
                      manual builder and its Add/Edit Question dialogs so the same question is
                      configured the same way wherever it is opened. */}
                  <MultipleAnswerSettings
                    question={localQ}
                    marks={localQ.marks || localQ.points || 1}
                    onChange={(patch) => { setLocalQ({ ...localQ, ...patch }); setEdited(true); }}
                  />
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 1 : 1.25 }}>
                    {(localQ.options || ['Option A', 'Option B', 'Option C', 'Option D']).map((opt, idx) => {
                      const isCorrect = isOptionCorrect(opt);
                      return (
                        <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: isMobile ? 0.75 : 1.25, p: isMobile ? 0.75 : 1, bgcolor: isCorrect ? '#DCFCE7' : '#FAFBFC', borderRadius: 1.5, border: isCorrect ? `2px solid ${tokens.accent}` : `1px solid ${tokens.surfaceBorder}` }}>
                          {/* Marking key toggle - a checkbox when several options can be correct,
                              a radio when only one can. */}
                          <Tooltip title={allowMultiple ? 'Tick if this option is one of the correct answers' : 'Mark as the correct answer'} arrow>
                            {allowMultiple ? (
                              <Checkbox
                                size="small"
                                checked={isCorrect}
                                onChange={() => toggleOptionCorrect(idx)}
                                sx={{ p: 0.5, color: tokens.textMuted, '&.Mui-checked': { color: tokens.accent } }}
                              />
                            ) : (
                              <Radio
                                size="small"
                                checked={isCorrect}
                                onChange={() => toggleOptionCorrect(idx)}
                                sx={{ p: 0.5, color: tokens.textMuted, '&.Mui-checked': { color: tokens.accent } }}
                              />
                            )}
                          </Tooltip>
                          <Chip
                            label={String.fromCharCode(65 + idx)}
                            size="small"
                            sx={{ minWidth: isMobile ? 26 : 32, height: isMobile ? 24 : 28, fontSize: isMobile ? 10 : 12, fontWeight: 800, bgcolor: isCorrect ? `${tokens.accent}30` : `${typeColors[qType]}20`, color: isCorrect ? '#166534' : typeColors[qType], border: isCorrect ? `2px solid ${tokens.accent}` : `1.5px solid ${typeColors[qType]}40` }}
                          />
                          <TextField
                            fullWidth
                            size="small"
                            placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                            value={getOptionText(opt)}
                            onChange={(e) => updateOption(idx, e.target.value)}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5, bgcolor: 'white', fontSize: isMobile ? 12 : 13 } }}
                          />
                          <IconButton size="small" onClick={() => removeOption(idx)} sx={{ color: '#EF4444', p: isMobile ? 0.5 : 0.75 }}>
                            <Delete sx={{ fontSize: isMobile ? 16 : 18 }} />
                          </IconButton>
                        </Box>
                      );
                    })}
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={addOption}
                      startIcon={<Add sx={{ fontSize: isMobile ? 16 : 18 }} />}
                      sx={{ mt: 1, py: isMobile ? 0.75 : 1, borderRadius: 2, textTransform: 'none', fontSize: isMobile ? 12 : 13, fontWeight: 600, borderStyle: 'dashed', borderColor: tokens.primary, color: tokens.primary, '&:hover': { bgcolor: `${tokens.primary}10`, borderStyle: 'solid' } }}
                    >
                      {isMobile ? 'Add Option' : 'Add Another Option'}
                    </Button>
                  </Box>
                </Box>
              </Grid>
            )}

            {/* Grading Criteria - for Open Ended questions */}
            {(qType === 'open-ended' || qType === 'short-answer') && (
              <Grid item xs={12}>
                <Box sx={{ p: isMobile ? 1.5 : 2, bgcolor: '#FEF3C7', borderRadius: 2, border: '1px solid #FCD34D' }}>
                  <Typography sx={{ fontSize: isMobile ? 10 : 11, fontWeight: 700, color: '#92400E', mb: 1, textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <CheckCircleOutline sx={{ fontSize: isMobile ? 12 : 14 }} />
                    Grading Criteria / Key Points
                  </Typography>
                  <Typography sx={{ fontSize: isMobile ? 11 : 12, color: '#92400E', mb: 1.5, fontStyle: 'italic' }}>
                    List specific criteria that must be present for full marks. The AI will use these to grade accurately.
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder={isMobile ? "1. Key point (2 marks)" : "e.g., 1. Defines photosynthesis (2 marks)&#10;2. Mentions chlorophyll (1 mark)&#10;3. Explains energy conversion (2 marks)&#10;4. Provides chemical equation (1 mark)"}
                    multiline
                    minRows={isMobile ? 3 : 4}
                    maxRows={8}
                    value={localQ.gradingCriteria ? (Array.isArray(localQ.gradingCriteria) ? localQ.gradingCriteria.join('\n') : localQ.gradingCriteria) : (localQ.keyPoints ? localQ.keyPoints.join('\n') : '')}
                    onChange={(e) => {
                      const lines = e.target.value.split('\n').filter(l => l.trim());
                      setLocalQ({ ...localQ, gradingCriteria: lines, keyPoints: lines });
                      setEdited(true);
                    }}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: 'white', fontSize: isMobile ? 12 : 13, lineHeight: 1.6 } }}
                  />
                </Box>
              </Grid>
            )}

            {/* Matching Question Editor - the pairs plus the answer key the graders read */}
            {qType === 'matching' && (() => {
              const { left, right } = readMatchingColumns(localQ);
              const key = readMatchingKey(localQ, left, right);
              const rowCount = Math.max(left.length, right.length, minMatchRows);
              const padTo = (list, len) => {
                const out = [...list];
                while (out.length < len) out.push('');
                return out;
              };
              const apply = (nextLeft, nextRight, nextKey) => {
                setLocalQ(writeMatching(localQ, nextLeft, nextRight, nextKey));
                setEdited(true);
              };
              const setLeftItem = (i, value) => {
                const next = padTo(left, i + 1);
                next[i] = value;
                apply(next, right, key);
              };
              const setRightItem = (i, value) => {
                const next = padTo(right, i + 1);
                next[i] = value;
                apply(left, next, key);
              };
              const matchedRight = left.map((_, i) => key[i]);
              const duplicateKey = new Set(matchedRight.filter((r, i) => matchedRight.indexOf(r) !== i));
              const unusedRight = right.map((_, i) => i).filter(i => !matchedRight.includes(i));
              return (
              <Grid item xs={12}>
                <Box sx={{ p: isMobile ? 1.5 : 2, bgcolor: '#ECFDF5', borderRadius: 2, border: `1px solid ${typeColors[qType]}` }}>
                  <Typography sx={{ fontSize: isMobile ? 10 : 11, fontWeight: 700, color: '#065F46', mb: 1, textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <DragIndicator sx={{ fontSize: isMobile ? 12 : 14 }} />
                    Matching Items (Left Column / Right Column)
                  </Typography>
                  <Typography sx={{ fontSize: isMobile ? 11 : 12, color: '#047857', mb: 1.5, fontStyle: 'italic' }}>
                    Students see the right column as a shuffled pool and drag items onto the left ones. The answer key below is what grading uses - it does not have to follow the row order.
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {Array.from({ length: rowCount }, (_, i) => (
                      <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip label={i + 1} size="small" sx={{ height: 20, minWidth: 24, fontSize: 10, fontWeight: 700, bgcolor: `${typeColors[qType]}25`, color: '#065F46' }} />
                        <TextField
                          fullWidth
                          size="small"
                          placeholder={`Left item ${i + 1}`}
                          value={left[i] || ''}
                          onChange={e => setLeftItem(i, e.target.value)}
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: 'white', fontSize: isMobile ? 12 : 13 } }}
                        />
                        <DragIndicator sx={{ color: 'text.secondary', flexShrink: 0 }} />
                        <TextField
                          fullWidth
                          size="small"
                          placeholder={`Right item ${i + 1}`}
                          value={right[i] || ''}
                          onChange={e => setRightItem(i, e.target.value)}
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: 'white', fontSize: isMobile ? 12 : 13 } }}
                        />
                        <IconButton
                          size="small"
                          onClick={() => {
                            setMinMatchRows(Math.max(0, rowCount - 1));
                            const next = removeMatchingRow(i, left, right, key);
                            if (i < left.length || i < right.length) apply(next.left, next.right, next.key);
                          }}
                          sx={{ color: '#EF4444' }}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </Box>
                    ))}
                  </Box>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<Add />}
                    onClick={() => setMinMatchRows(rowCount + 1)}
                    sx={{ mt: 2, textTransform: 'none', borderStyle: 'dashed', fontSize: isMobile ? 12 : 13 }}
                  >
                    Add Pair
                  </Button>

                  {/* Answer key: which right item is the correct match for each left item */}
                  <Box sx={{ mt: 2.5, pt: 2, borderTop: `1px dashed ${typeColors[qType]}` }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                      <Typography sx={{ fontSize: isMobile ? 10 : 11, fontWeight: 700, color: '#065F46', textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <DoneAll sx={{ fontSize: isMobile ? 12 : 14 }} />
                        Correct Answer Key
                      </Typography>
                      <Button
                        size="small"
                        startIcon={<SwapVert sx={{ fontSize: 14 }} />}
                        onClick={() => apply(left, right, Object.fromEntries(left.map((_, i) => [i, i])))}
                        sx={{ textTransform: 'none', fontSize: isMobile ? 10 : 11, color: '#047857' }}
                      >
                        Reset to row order
                      </Button>
                    </Box>
                    {left.length === 0 ? (
                      <Typography sx={{ fontSize: isMobile ? 11 : 12, color: '#065F46', fontStyle: 'italic' }}>
                        Add at least one pair above to set the answer key.
                      </Typography>
                    ) : (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {left.map((leftText, i) => {
                          const rightIdx = key[i];
                          const inRange = rightIdx >= 0 && rightIdx < right.length;
                          const missing = !inRange || !(right[rightIdx] || '').trim();
                          return (
                            <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography sx={{ flex: 1, fontSize: isMobile ? 11 : 12, fontWeight: 600, color: '#065F46', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {i + 1}. {leftText?.trim() || '(empty left item)'}
                              </Typography>
                              <Typography sx={{ color: '#047857', fontWeight: 700 }}>&rarr;</Typography>
                              <FormControl size="small" sx={{ flex: 1, minWidth: isMobile ? 110 : 180 }}>
                                <Select
                                  displayEmpty
                                  value={inRange ? rightIdx : ''}
                                  onChange={e => apply(left, right, { ...key, [i]: Number(e.target.value) })}
                                  error={missing}
                                  sx={{ bgcolor: 'white', borderRadius: 2, fontSize: isMobile ? 12 : 13 }}
                                >
                                  {/* Display-only: shown when the stored key points at an item that no
                                      longer exists. Not selectable, so the key can never be saved unset -
                                      an unset pair would mark every student wrong on that item. */}
                                  <MenuItem value="" disabled sx={{ fontSize: isMobile ? 12 : 13, fontStyle: 'italic' }}>Not set - pick the correct match</MenuItem>
                                  {right.map((rightText, ri) => (
                                    <MenuItem key={ri} value={ri} sx={{ fontSize: isMobile ? 12 : 13 }}>
                                      {ri + 1}. {rightText?.trim() || '(empty right item)'}
                                    </MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                              {inRange && duplicateKey.has(rightIdx) && (
                                <Tooltip title="This right item is the answer for more than one left item" arrow>
                                  <Chip label="dup" size="small" sx={{ height: 18, fontSize: 9, bgcolor: '#FEF3C7', color: '#B45309', fontWeight: 700 }} />
                                </Tooltip>
                              )}
                            </Box>
                          );
                        })}
                      </Box>
                    )}
                    {unusedRight.length > 0 && (
                      <Alert severity="info" sx={{ mt: 1.5, py: 0, fontSize: isMobile ? 10 : 11, borderRadius: 2 }}>
                        Right items not used by the key (students see them as distractors): {unusedRight.map(i => `${i + 1}. ${right[i]?.trim() || '(empty)'}`).join(', ')}
                      </Alert>
                    )}
                  </Box>
                </Box>
              </Grid>
              );
            })()}

            {/* Ordering Question Editor */}
            {qType === 'ordering' && (
              <Grid item xs={12}>
                <Box sx={{ p: isMobile ? 1.5 : 2, bgcolor: '#EEF2FF', borderRadius: 2, border: `1px solid ${typeColors[qType]}` }}>
                  <Typography sx={{ fontSize: isMobile ? 10 : 11, fontWeight: 700, color: '#3730A3', mb: 1, textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <SwapVert sx={{ fontSize: isMobile ? 12 : 14 }} />
                    Items to Order (Correct Order)
                  </Typography>
                  <Typography sx={{ fontSize: isMobile ? 11 : 12, color: '#4338CA', mb: 1.5, fontStyle: 'italic' }}>
                    Items will be shuffled for students. They drag to arrange in this order.
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {(localQ.items || localQ.options || []).map((item, i) => (
                      <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box
                          sx={{
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            bgcolor: typeColors[qType],
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 'bold',
                            fontSize: 12,
                            flexShrink: 0
                          }}
                        >
                          {i + 1}
                        </Box>
                        <DragIndicator sx={{ color: 'text.secondary', flexShrink: 0 }} />
                        <TextField
                          fullWidth
                          size="small"
                          placeholder={`Item ${i + 1}`}
                          value={typeof item === 'string' ? item : item.text}
                          onChange={e => {
                            const newItems = [...(localQ.items || localQ.options || [])];
                            newItems[i] = { text: e.target.value };
                            setLocalQ({ ...localQ, items: newItems });
                            setEdited(true);
                          }}
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: 'white', fontSize: isMobile ? 12 : 13 } }}
                        />
                        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                          <IconButton
                            size="small"
                            onClick={() => {
                              const items = [...(localQ.items || localQ.options || [])];
                              if (i > 0) {
                                [items[i - 1], items[i]] = [items[i], items[i - 1]];
                                setLocalQ({ ...localQ, items });
                                setEdited(true);
                              }
                            }}
                            disabled={i === 0}
                            sx={{ p: 0.3 }}
                          >
                            ▲
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => {
                              const items = [...(localQ.items || localQ.options || [])];
                              if (i < items.length - 1) {
                                [items[i], items[i + 1]] = [items[i + 1], items[i]];
                                setLocalQ({ ...localQ, items });
                                setEdited(true);
                              }
                            }}
                            disabled={i === (localQ.items || localQ.options || []).length - 1}
                            sx={{ p: 0.3 }}
                          >
                            ▼
                          </IconButton>
                        </Box>
                        <IconButton
                          size="small"
                          onClick={() => {
                            const items = [...(localQ.items || localQ.options || [])];
                            items.splice(i, 1);
                            setLocalQ({ ...localQ, items });
                            setEdited(true);
                          }}
                          sx={{ color: '#EF4444' }}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </Box>
                    ))}
                  </Box>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<Add />}
                    onClick={() => {
                      const items = [...(localQ.items || localQ.options || [])];
                      items.push({ text: '' });
                      setLocalQ({ ...localQ, items });
                      setEdited(true);
                    }}
                    sx={{ mt: 2, textTransform: 'none', borderStyle: 'dashed', fontSize: isMobile ? 12 : 13 }}
                  >
                    Add Item
                  </Button>
                </Box>
              </Grid>
            )}

            {/* Financial Spreadsheet Editor */}
            {qType === 'financial-spreadsheet' && (
              <Grid item xs={12}>
                <Box sx={{ p: isMobile ? 1.5 : 2, bgcolor: '#F0F9FF', borderRadius: 2, border: '1px solid #0EA5E9' }}>
                  <Typography sx={{ fontSize: isMobile ? 10 : 11, fontWeight: 700, color: '#0369A1', mb: 1, textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    💹 Financial Spreadsheet Setup
                  </Typography>
                  <Typography sx={{ fontSize: isMobile ? 11 : 12, color: '#0369A1', mb: 1.5, fontStyle: 'italic' }}>
                    Fill in the <strong>Model Answer</strong> below. Students automatically get a blank
                    version of the same grid to fill in themselves — no separate template needed.
                  </Typography>
                  <FinancialSpreadsheetQuestion
                    key={`gen-${localQ._id || localQ.text?.slice(0,20) || index}`}
                    question={localQ}
                    mode="teacher-setup"
                    onTemplateChange={(json) => commit(q => ({ ...q, spreadsheetTemplate: json }))}
                    onModelChange={(json) => commit(q => ({ ...q, spreadsheetModelAnswer: json, correctAnswer: json }))}
                    onConfigChange={(patch) => commit(q => ({ ...q, ...patch }))}
                  />
                </Box>
              </Grid>
            )}

            {/* Model Answer / Explanation */}
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75, flexWrap: 'wrap' }}>
                <Typography sx={{ fontSize: isMobile ? 10 : 11, fontWeight: 700, color: tokens.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {qType === 'open-ended' || qType === 'short-answer' ? (isMobile ? 'Model Answer *' : 'Comprehensive Model Answer *') : qType === 'financial-spreadsheet' ? 'Grading Notes (Optional)' : 'Explanation / Answer Key *'}
                </Typography>
                <Chip
                  label="For AI Grading"
                  size="small"
                  sx={{ height: isMobile ? 16 : 18, fontSize: isMobile ? 8 : 9, bgcolor: '#DBEAFE', color: '#1E40AF', fontWeight: 700 }}
                />
              </Box>
              <Typography sx={{ fontSize: isMobile ? 11 : 12, color: tokens.textMuted, mb: 1.5 }}>
                {qType === 'open-ended'
                  ? (isMobile ? 'Provide a detailed model answer for AI grading comparison.' : 'Provide a detailed model answer (150-300 words) with key points, examples, and expected structure. The AI will compare student answers against this.')
                  : qType === 'multiple-choice'
                    ? (isMobile ? 'Explain correct answer and why others are wrong.' : 'Explain why the correct answer is right and why each distractor is wrong. This helps the AI provide feedback on wrong answers.')
                    : (isMobile ? 'Provide correct answer and variations.' : 'Provide the correct answer and any acceptable variations.')}
              </Typography>

              {/* Add Sub-Questions Button (for questions without sub-questions) */}
              {(!localQ.subQuestions || !Array.isArray(localQ.subQuestions) || localQ.subQuestions.length === 0) && (
                <Box sx={{ mb: 2 }}>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<Add />}
                    onClick={() => {
                      setLocalQ({
                        ...localQ,
                        subQuestions: [
                          {
                            label: 'a)',
                            text: '',
                            type: 'open-ended',
                            points: 1,
                            correctAnswer: '',
                            options: []
                          }
                        ],
                        subQuestionConfig: {
                          mode: 'all',
                          requiredCount: 1,
                          scoringType: 'partial'
                        }
                      });
                      setEdited(true);
                    }}
                    sx={{
                      borderRadius: 2,
                      textTransform: 'none',
                      fontSize: 12,
                      borderStyle: 'dashed',
                      borderColor: tokens.accent,
                      color: tokens.accent,
                      '&:hover': { bgcolor: 'rgba(12,189,115,0.05)', borderStyle: 'solid' }
                    }}
                  >
                    + Add Sub-Questions
                  </Button>
                  <Typography sx={{ fontSize: 11, color: tokens.textMuted, mt: 0.5 }}>
                    Break this question into multiple sub-questions for students to answer
                  </Typography>
                </Box>
              )}

              {/* Display and edit subquestions if they exist */}
              {localQ.subQuestions && Array.isArray(localQ.subQuestions) && localQ.subQuestions.length > 0 ? (
                <Box sx={{ mb: 1.5 }}>
                  {/* Sub-question Configuration */}
                  <Paper elevation={0} sx={{ p: 1.5, mb: 2, bgcolor: '#FFF8E1', border: '1px solid #FFE082', borderRadius: 2 }}>
                    <Typography sx={{ fontSize: 11, fontWeight: 600, color: '#F57C00', mb: 1 }}>
                      Sub-Question Configuration
                    </Typography>

                    {/* Mode Selection */}
                    <FormControl component="fieldset" fullWidth sx={{ mb: 2 }}>
                      <RadioGroup
                        row
                        value={localQ.subQuestionConfig?.mode || localQ.subQuestionMode || 'all'}
                        onChange={(e) => {
                          const newMode = e.target.value;
                          setLocalQ({
                            ...localQ,
                            subQuestionConfig: {
                              ...(localQ.subQuestionConfig || {}),
                              mode: newMode,
                              requiredCount: localQ.subQuestionConfig?.requiredCount || 1
                            },
                            subQuestionMode: undefined // Clear old field
                          });
                          setEdited(true);
                        }}
                      >
                        <FormControlLabel
                          value="all"
                          control={<Radio size="small" />}
                          label={
                            <Box>
                              <Typography sx={{ fontSize: 11, fontWeight: 500 }}>Answer ALL</Typography>
                              <Typography sx={{ fontSize: 10, color: '#666' }}>Student must answer every sub-question</Typography>
                            </Box>
                          }
                        />
                        <FormControlLabel
                          value="choose-n"
                          control={<Radio size="small" />}
                          label={
                            <Box>
                              <Typography sx={{ fontSize: 11, fontWeight: 500 }}>Choose N</Typography>
                              <Typography sx={{ fontSize: 10, color: '#666' }}>Student picks N sub-questions to answer</Typography>
                            </Box>
                          }
                        />
                      </RadioGroup>
                    </FormControl>

                    {/* Choose-N Configuration */}
                    {(localQ.subQuestionConfig?.mode === 'choose-n' || localQ.subQuestionMode === 'choose-one') && (
                      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                        <TextField
                          size="small"
                          type="number"
                          label="Required Count"
                          value={localQ.subQuestionConfig?.requiredCount || 1}
                          onChange={(e) => {
                            const count = Math.max(1, Math.min(localQ.subQuestions.length, parseInt(e.target.value) || 1));
                            setLocalQ({
                              ...localQ,
                              subQuestionConfig: {
                                ...(localQ.subQuestionConfig || {}),
                                mode: 'choose-n',
                                requiredCount: count
                              }
                            });
                            setEdited(true);
                          }}
                          inputProps={{ min: 1, max: localQ.subQuestions.length }}
                          sx={{ width: 100, '& .MuiInputBase-root': { fontSize: 12 } }}
                        />
                        <FormControl size="small" sx={{ minWidth: 150 }}>
                          <InputLabel sx={{ fontSize: 11 }}>Scoring Type</InputLabel>
                          <Select
                            value={localQ.subQuestionConfig?.scoringType || 'partial'}
                            onChange={(e) => {
                              setLocalQ({
                                ...localQ,
                                subQuestionConfig: {
                                  ...(localQ.subQuestionConfig || {}),
                                  mode: 'choose-n',
                                  scoringType: e.target.value
                                }
                              });
                              setEdited(true);
                            }}
                            sx={{ fontSize: 12 }}
                          >
                            <MenuItem value="partial" sx={{ fontSize: 12 }}>Independent (Each question graded separately)</MenuItem>
                            <MenuItem value="all-or-nothing" sx={{ fontSize: 12 }}>All-or-Nothing (All must be correct)</MenuItem>
                          </Select>
                        </FormControl>
                      </Box>
                    )}

                    {(localQ.subQuestionConfig?.mode === 'choose-n' || localQ.subQuestionMode === 'choose-one') && (
                      <Alert severity="warning" sx={{ mt: 2, py: 0.5, '& .MuiAlert-message': { fontSize: 10 } }}>
                        Student selects <strong>{localQ.subQuestionConfig?.requiredCount || 1}</strong> from {localQ.subQuestions.length} options.
                        {localQ.subQuestionConfig?.scoringType === 'all-or-nothing'
                          ? 'All-or-Nothing: Must get ALL selected questions correct for full marks.'
                          : 'Independent Grading: Each selected question earns its own marks (not required to get all correct).'
                        }
                      </Alert>
                    )}
                  </Paper>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography sx={{ fontSize: 12, fontWeight: 600, color: tokens.textPrimary }}>
                      Subquestions ({localQ.subQuestions.length})
                    </Typography>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => {
                        const newSubQ = {
                          label: `${String.fromCharCode(97 + localQ.subQuestions.length)})`,
                          text: '',
                          type: 'open-ended',
                          points: localQ.subQuestionMode === 'choose-one' ? (localQ.points || 1) : 1,
                          correctAnswer: '',
                          options: []
                        };
                        setLocalQ({ ...localQ, subQuestions: [...localQ.subQuestions, newSubQ] });
                        setEdited(true);
                      }}
                      sx={{ fontSize: 10, minWidth: 'auto', py: 0.3, px: 1 }}
                    >
                      + Add Subquestion
                    </Button>
                  </Box>
                  {localQ.subQuestions.map((subQ, idx) => {
                    const updateSubQ = (patch) => {
                      const updated = [...localQ.subQuestions];
                      updated[idx] = { ...updated[idx], ...patch };
                      setLocalQ({ ...localQ, subQuestions: updated });
                      setEdited(true);
                    };
                    return (
                    <Paper key={idx} elevation={0} sx={{ p: 1.5, mb: 1.5, bgcolor: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: 2 }}>
                      {/* Subquestion header with label and type */}
                      <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                        <TextField
                          size="small"
                          placeholder="Label (e.g., a), b), i))"
                          value={subQ.label || ''}
                          onChange={(e) => {
                            const updated = [...localQ.subQuestions];
                            updated[idx] = { ...subQ, label: e.target.value };
                            setLocalQ({ ...localQ, subQuestions: updated });
                            setEdited(true);
                          }}
                          sx={{ width: 70, '& .MuiInputBase-root': { fontSize: 11, height: 28 } }}
                        />
                        <FormControl size="small" sx={{ minWidth: 120 }}>
                          <Select
                            value={subQ.type || 'open-ended'}
                            onChange={(e) => updateSubQ({ type: e.target.value, options: e.target.value === 'multiple-choice' ? [{ letter: 'i', text: '', isCorrect: false }] : [] })}
                            sx={{ fontSize: 11, height: 28 }}
                          >
                            <MenuItem value="open-ended">Open-ended</MenuItem>
                            <MenuItem value="short-answer">Short Answer</MenuItem>
                            <MenuItem value="essay">Essay</MenuItem>
                            <MenuItem value="multiple-choice">Multiple Choice</MenuItem>
                            <MenuItem value="true-false">True/False</MenuItem>
                            <MenuItem value="fill-in-blank">Fill in blank</MenuItem>
                            <MenuItem value="matching">Matching</MenuItem>
                            <MenuItem value="ordering">Ordering</MenuItem>
                            <MenuItem value="drag-drop">Drag & Drop</MenuItem>
                            <MenuItem value="image-based">Image Based</MenuItem>
                            <MenuItem value="structured">Structured</MenuItem>
                            <MenuItem value="financial-spreadsheet">💹 Financial Spreadsheet</MenuItem>
                          </Select>
                        </FormControl>
                        <TextField
                          size="small"
                          type="number"
                          placeholder="Points"
                          value={subQ.points || 1}
                          onChange={(e) => {
                            const updated = [...localQ.subQuestions];
                            updated[idx] = { ...subQ, points: parseInt(e.target.value) || 1 };
                            setLocalQ({ ...localQ, subQuestions: updated });
                            setEdited(true);
                          }}
                          sx={{ width: 70, '& .MuiInputBase-root': { fontSize: 11, height: 28 } }}
                        />
                        <IconButton
                          size="small"
                          onClick={() => {
                            const updated = localQ.subQuestions.filter((_, i) => i !== idx);
                            setLocalQ({ ...localQ, subQuestions: updated });
                            setEdited(true);
                          }}
                          sx={{ color: '#DC2626', p: 0.3 }}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </Box>

                      {/* Subquestion text */}
                      <TextField
                        fullWidth
                        size="small"
                        placeholder="Subquestion text..."
                        value={subQ.text || ''}
                        onChange={(e) => {
                          const updated = [...localQ.subQuestions];
                          updated[idx] = { ...subQ, text: e.target.value };
                          setLocalQ({ ...localQ, subQuestions: updated });
                          setEdited(true);
                        }}
                        sx={{ mb: 1, '& .MuiInputBase-root': { fontSize: 11, minHeight: 32 } }}
                      />

                      {/* MCQ Options for subquestion */}
                      {subQ.type === 'multiple-choice' && (() => {
                      const subAllowMultiple = isMultiAnswerQuestion(subQ);
                      // Keeps subQ.correctAnswer in step with the ticked options, the same way the
                      // parent question does - the graders read it when no option carries a flag.
                      const applySubOptions = (updatedOptions) => {
                        updateSubQ({
                          options: updatedOptions,
                          correctAnswer: correctAnswerFromOptions(updatedOptions)
                        });
                      };
                      return (
                        <Box sx={{ mb: 1, pl: 1, borderLeft: '2px solid #BAE6FD' }}>
                          <Typography sx={{ fontSize: 10, color: '#0369A1', mb: 0.5 }}>Options:</Typography>
                          <MultipleAnswerSettings
                            question={subQ}
                            compact
                            marks={subQ.points || 1}
                            onChange={(patch) => updateSubQ(patch)}
                          />
                          {(subQ.options || []).map((opt, optIdx) => (
                            <Box key={optIdx} sx={{ display: 'flex', gap: 0.5, alignItems: 'center', mb: 0.5 }}>
                              <TextField
                                size="small"
                                placeholder={`${optIdx + 1}`}
                                value={opt.letter || ''}
                                onChange={(e) => {
                                  const updated = [...localQ.subQuestions];
                                  const updatedOptions = [...(subQ.options || [])];
                                  updatedOptions[optIdx] = { ...opt, letter: e.target.value };
                                  updated[idx] = { ...subQ, options: updatedOptions };
                                  setLocalQ({ ...localQ, subQuestions: updated });
                                  setEdited(true);
                                }}
                                sx={{ width: 40, '& .MuiInputBase-root': { fontSize: 10, height: 24 } }}
                              />
                              <TextField
                                fullWidth
                                size="small"
                                placeholder={`Option ${optIdx + 1} text`}
                                value={opt.text || ''}
                                onChange={(e) => {
                                  const updated = [...localQ.subQuestions];
                                  const updatedOptions = [...(subQ.options || [])];
                                  updatedOptions[optIdx] = { ...opt, text: e.target.value };
                                  updated[idx] = { ...subQ, options: updatedOptions };
                                  setLocalQ({ ...localQ, subQuestions: updated });
                                  setEdited(true);
                                }}
                                sx={{ '& .MuiInputBase-root': { fontSize: 11, height: 24 } }}
                              />
                              <FormControlLabel
                                control={
                                  subAllowMultiple ? (
                                    <Checkbox
                                      size="small"
                                      checked={isOptionCorrect(opt)}
                                      onChange={() => {
                                        const updatedOptions = (subQ.options || []).map((o, i) => (
                                          i === optIdx ? { ...o, isCorrect: !isOptionCorrect(o) } : o
                                        ));
                                        applySubOptions(updatedOptions);
                                      }}
                                    />
                                  ) : (
                                    <Radio
                                      size="small"
                                      checked={isOptionCorrect(opt)}
                                      onChange={() => {
                                        const updatedOptions = (subQ.options || []).map((o, i) => ({ ...o, isCorrect: i === optIdx }));
                                        applySubOptions(updatedOptions);
                                      }}
                                    />
                                  )
                                }
                                label={<Typography sx={{ fontSize: 9 }}>Correct</Typography>}
                              />
                              <IconButton
                                size="small"
                                onClick={() => {
                                  const updatedOptions = (subQ.options || []).filter((_, i) => i !== optIdx);
                                  applySubOptions(updatedOptions);
                                }}
                                sx={{ p: 0.2 }}
                              >
                                <Delete fontSize="small" sx={{ fontSize: 14 }} />
                              </IconButton>
                            </Box>
                          ))}
                          <Button
                            size="small"
                            variant="text"
                            onClick={() => {
                              const updated = [...localQ.subQuestions];
                              const newLetter = String.fromCharCode(105 + (subQ.options || []).length);
                              updated[idx] = { ...subQ, options: [...(subQ.options || []), { letter: newLetter, text: '', isCorrect: false }] };
                              setLocalQ({ ...localQ, subQuestions: updated });
                              setEdited(true);
                            }}
                            sx={{ fontSize: 9, mt: 0.5 }}
                          >
                            + Add Option
                          </Button>
                        </Box>
                      );
                      })()}

                      {/* Correct Answer */}
                      {subQ.type !== 'multiple-choice' && subQ.type !== 'financial-spreadsheet' && (
                        <TextField
                          fullWidth
                          size="small"
                          placeholder="Correct answer..."
                          value={subQ.correctAnswer || ''}
                          onChange={(e) => updateSubQ({ correctAnswer: e.target.value })}
                          sx={{ '& .MuiInputBase-root': { fontSize: 11, minHeight: 32 } }}
                        />
                      )}
                      {subQ.type === 'multiple-choice' && (
                        <Typography sx={{ fontSize: 10, color: '#075985', mt: 0.5 }}>
                          Correct Answer Letter: <strong>{subQ.correctAnswer || 'Not set'}</strong>
                        </Typography>
                      )}

                      {/* Financial Spreadsheet - sub-question */}
                      {subQ.type === 'financial-spreadsheet' && (
                        <Box sx={{ mt: 1 }}>
                          <FinancialSpreadsheetQuestion
                            key={`subq-${idx}-${subQ.label || idx}`}
                            question={subQ}
                            mode="teacher-setup"
                            onTemplateChange={(json) => commitSubQ(idx, { spreadsheetTemplate: json })}
                            onModelChange={(json) => commitSubQ(idx, { spreadsheetModelAnswer: json, correctAnswer: json })}
                            onConfigChange={(patch) => commitSubQ(idx, patch)}
                            height={320}
                          />
                        </Box>
                      )}

                      {/* Sub-question images */}
                      <Box sx={{ mt: 1 }}>
                        <MultiImageUploader
                          images={subQ.images || toImageEntries(subQ)}
                          onChange={(images) => commitSubQ(idx, { images, imageUrl: '' })}
                          label="Sub-Question Images (Optional)"
                        />
                      </Box>

                      {/* AI Assist for this sub-question */}
                      <Box sx={{ mt: 1 }}>
                        <AIQuestionAssist question={subQ} onApply={(patch) => commitSubQ(idx, patch)} />
                      </Box>
                    </Paper>
                    );
                  })}
                </Box>
              ) : (
                <TextField
                  fullWidth
                  size="small"
                  placeholder={qType === 'open-ended'
                    ? (isMobile ? "Enter model answer..." : "Enter a comprehensive model answer here... Include all key points, examples, and structure expected in a complete answer.")
                    : "Explanation for correct answer..."}
                  multiline
                  minRows={qType === 'open-ended' ? (isMobile ? 4 : 6) : (isMobile ? 3 : 4)}
                  maxRows={10}
                  value={localQ.explanation || localQ.answerKey || localQ.correctAnswer || ''}
                  onChange={(e) => { setLocalQ({ ...localQ, explanation: e.target.value, answerKey: e.target.value }); setEdited(true); }}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: 'white', fontSize: isMobile ? 12 : 13, lineHeight: 1.7 } }}
                />
              )}
            </Grid>
          </Grid>
        </Box>
      )}
    </Paper>
  );
};

export default QuestionEditor;
