import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box, Typography, Paper, Grid, TextField, Button, IconButton, Chip, Select, MenuItem,
  CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, Snackbar, Alert,
  Tooltip, Divider, InputAdornment, FormControlLabel, Switch
} from '@mui/material';
import {
  Search, Close, PictureAsPdf, MenuBook, Visibility, Refresh, AccessTime,
  HelpOutline, Person, FactCheck
} from '@mui/icons-material';
import api from '../../../services/api';
import downloadFile from '../../../utils/downloadFile';
import { tokens, gradients } from '../../../pages/dashboardTokens';
import { SectionTitle } from '../../../pages/DashboardShell';

// Browse every exam teachers have published to the public exam bank, read a
// paper in full, and take it away as two separate PDFs: the question paper and
// the marking guide.

const TYPE_LABELS = {
  'multiple-choice': 'Multiple choice',
  'true-false': 'True / false',
  'open-ended': 'Open ended',
  'short-answer': 'Short answer',
  essay: 'Essay',
  'extended-response': 'Extended response',
  'fill-blank': 'Fill in the blank',
  'fill-in-blank': 'Fill in the blank',
  matching: 'Matching',
  ordering: 'Ordering',
  'drag-drop': 'Drag and drop',
  structured: 'Structured',
  numerical: 'Numerical',
  'image-based': 'Image based',
  image: 'Image based',
  'financial-spreadsheet': 'Spreadsheet',
  'table-completion': 'Table completion'
};

const typeLabel = (t) => TYPE_LABELS[t] || t;

const optionLetter = (option, i) => option.letter || String.fromCharCode(65 + i);

// Matching and ordering items are stored as either plain strings or objects.
const itemText = (item) => {
  if (item === null || item === undefined) return '';
  if (typeof item === 'string') return item;
  return item.text || item.value || item.label || String(item);
};

/** One question in the preview, mirroring what the PDF renders. */
function PreviewQuestion({ question, number, showAnswers }) {
  const points = Number(question.points ?? question.marks ?? 0) || 0;
  const options = question.options || [];
  const left = question.leftItems?.length ? question.leftItems : (question.matchingPairs?.leftColumn || []);
  const right = question.rightItems?.length ? question.rightItems : (question.matchingPairs?.rightColumn || []);
  const orderItems = question.itemsToOrder?.items || [];
  const subs = question.subQuestions || [];

  return (
    <Box sx={{ mb: 2.5 }}>
      <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-start' }}>
        <Typography sx={{ fontWeight: 800, color: tokens.primary, fontSize: 13.5, minWidth: 24 }}>
          {number}.
        </Typography>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 13.5, color: tokens.textPrimary, whiteSpace: 'pre-wrap' }}>
            {question.text || (question.imageUrl ? '[Image-based question]' : '[No question text]')}
          </Typography>

          {(question.imageUrl || (question.imageUrls || []).length > 0) && (
            <Typography sx={{ fontSize: 11.5, color: tokens.textMuted, fontStyle: 'italic', mt: 0.4 }}>
              Refers to {(question.imageUrls || []).length || 1} image
              {((question.imageUrls || []).length || 1) === 1 ? '' : 's'} in the online paper
            </Typography>
          )}

          {question.passage && (
            <Paper elevation={0} sx={{ p: 1.25, mt: 0.75, bgcolor: '#F8FAFC', borderRadius: 1.5, border: `1px solid ${tokens.surfaceBorder}` }}>
              <Typography sx={{ fontSize: 12, color: tokens.textSecondary, whiteSpace: 'pre-wrap' }}>{question.passage}</Typography>
            </Paper>
          )}

          {question.allowMultipleAnswers && (
            <Typography sx={{ fontSize: 11.5, color: tokens.textMuted, fontStyle: 'italic', mt: 0.4 }}>
              Select all that apply
            </Typography>
          )}

          {options.map((option, i) => {
            const isKey = showAnswers && option.isCorrect;
            return (
              <Box key={i} sx={{ display: 'flex', gap: 0.75, mt: 0.5, alignItems: 'flex-start' }}>
                <Typography sx={{ fontSize: 12.5, fontWeight: isKey ? 800 : 600, color: isKey ? tokens.accentDark : tokens.textSecondary, minWidth: 18 }}>
                  {optionLetter(option, i)}.
                </Typography>
                <Typography sx={{ fontSize: 12.5, color: isKey ? tokens.accentDark : tokens.textPrimary, fontWeight: isKey ? 700 : 400 }}>
                  {itemText(option)}{isKey ? '  ✓' : ''}
                </Typography>
              </Box>
            );
          })}

          {(left.length > 0 || right.length > 0) && (
            <Grid container spacing={1} sx={{ mt: 0.5 }}>
              <Grid item xs={6}>
                <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: tokens.textMuted }}>COLUMN A</Typography>
                {left.map((item, i) => (
                  <Typography key={i} sx={{ fontSize: 12.5 }}>{i + 1}. {itemText(item)}</Typography>
                ))}
              </Grid>
              <Grid item xs={6}>
                <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: tokens.textMuted }}>COLUMN B</Typography>
                {right.map((item, i) => (
                  <Typography key={i} sx={{ fontSize: 12.5 }}>{String.fromCharCode(65 + i)}. {itemText(item)}</Typography>
                ))}
              </Grid>
            </Grid>
          )}

          {orderItems.length > 0 && (
            <Box sx={{ mt: 0.5 }}>
              <Typography sx={{ fontSize: 11.5, color: tokens.textMuted, fontStyle: 'italic' }}>Arrange in the correct order:</Typography>
              {orderItems.map((item, i) => (
                <Typography key={i} sx={{ fontSize: 12.5 }}>• {itemText(item)}</Typography>
              ))}
            </Box>
          )}

          {(question.wordBank || []).length > 0 && (
            <Typography sx={{ fontSize: 12, color: tokens.textSecondary, mt: 0.5 }}>
              <strong>Word bank:</strong> {question.wordBank.map(itemText).join(' · ')}
            </Typography>
          )}

          {subs.map((sub, i) => (
            <Box key={i} sx={{ mt: 1, pl: 1.5, borderLeft: `2px solid ${tokens.surfaceBorder}` }}>
              <Typography sx={{ fontSize: 12.5 }}>
                <strong>{sub.label || `${String.fromCharCode(97 + i)})`}</strong> {sub.text}
                {sub.points ? <span style={{ color: tokens.textMuted }}> ({sub.points})</span> : null}
              </Typography>
              {(sub.options || []).map((option, oi) => {
                const isKey = showAnswers && option.isCorrect;
                return (
                  <Typography key={oi} sx={{ fontSize: 12, ml: 1.5, color: isKey ? tokens.accentDark : tokens.textPrimary, fontWeight: isKey ? 700 : 400 }}>
                    {optionLetter(option, oi)}. {itemText(option)}{isKey ? '  ✓' : ''}
                  </Typography>
                );
              })}
              {showAnswers && sub.correctAnswer && sub.correctAnswer !== 'Not provided' && (
                <Typography sx={{ fontSize: 12, ml: 1.5, mt: 0.35, color: tokens.accentDark }}>
                  <strong>Answer:</strong> {sub.correctAnswer}
                </Typography>
              )}
            </Box>
          ))}

          {showAnswers && question.correctAnswer && question.correctAnswer !== 'Not provided' && !options.some(o => o.isCorrect) && (
            <Paper elevation={0} sx={{ p: 1.25, mt: 0.75, bgcolor: 'rgba(12,189,115,0.07)', borderRadius: 1.5, borderLeft: `3px solid ${tokens.accent}` }}>
              <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: tokens.accentDark, mb: 0.25 }}>ANSWER</Typography>
              <Typography sx={{ fontSize: 12.5, whiteSpace: 'pre-wrap' }}>{question.correctAnswer}</Typography>
            </Paper>
          )}

          {showAnswers && question.explanation && (
            <Typography sx={{ fontSize: 12, color: tokens.textSecondary, mt: 0.5, fontStyle: 'italic' }}>
              {question.explanation}
            </Typography>
          )}

          {showAnswers && (question.gradingCriteria || []).length > 0 && (
            <Box sx={{ mt: 0.5 }}>
              <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: tokens.textMuted }}>MARK ALLOCATION</Typography>
              {question.gradingCriteria.map((c, i) => (
                <Typography key={i} sx={{ fontSize: 12, color: tokens.textSecondary }}>
                  • {c.criteria} ({c.points ?? 1})
                </Typography>
              ))}
            </Box>
          )}
        </Box>
        {points > 0 && (
          <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: tokens.textMuted, whiteSpace: 'nowrap' }}>
            ({points} mark{points === 1 ? '' : 's'})
          </Typography>
        )}
      </Box>
    </Box>
  );
}

export default function ExamBankSection() {
  const [exams, setExams] = useState([]);
  const [filters, setFilters] = useState({ levels: [], subLevels: [], audiences: [], accessTypes: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [snack, setSnack] = useState('');

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [level, setLevel] = useState('');
  const [subLevel, setSubLevel] = useState('');
  const [audience, setAudience] = useState('');

  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showAnswers, setShowAnswers] = useState(false);
  const [downloading, setDownloading] = useState('');

  // Debounce so typing in the search box doesn't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/question-bank/browse', {
      params: {
        search: debouncedSearch || undefined,
        level: level || undefined,
        subLevel: subLevel || undefined,
        audience: audience || undefined
      }
    })
      .then(r => {
        setExams(r.data?.exams || []);
        setFilters(r.data?.filters || { levels: [], subLevels: [], audiences: [], accessTypes: [] });
        setError('');
      })
      .catch(err => setError(err.response?.data?.message || 'Failed to load the exam bank.'))
      .finally(() => setLoading(false));
  }, [debouncedSearch, level, subLevel, audience]);

  useEffect(() => { load(); }, [load]);

  // Answers are fetched only when asked for, so a casual preview never pulls
  // the key down to the browser at all.
  const openPreview = useCallback(async (exam, withAnswers = false) => {
    setPreviewLoading(true);
    if (!preview || preview.summary._id !== exam._id) {
      setPreview({ summary: exam, exam: null, totals: null });
    }
    try {
      const r = await api.get(`/question-bank/${exam._id}/preview`, {
        params: withAnswers ? { withAnswers: 'true' } : {}
      });
      setPreview({ summary: exam, exam: r.data.exam, totals: r.data.totals });
      setShowAnswers(withAnswers);
    } catch (err) {
      setSnack(err.response?.data?.message || 'Could not open this exam.');
      setPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  }, [preview]);

  const toggleAnswers = (checked) => {
    if (!preview) return;
    openPreview(preview.summary, checked);
  };

  const download = async (exam, variant) => {
    const key = `${exam._id}:${variant}`;
    setDownloading(key);
    try {
      const name = await downloadFile(
        `/question-bank/${exam._id}/pdf`,
        { variant },
        variant === 'marking-guide' ? 'marking-guide.pdf' : 'question-paper.pdf'
      );
      setSnack(`✓ Downloaded ${name}`);
    } catch (err) {
      setSnack(err.message || 'Download failed');
    } finally {
      setDownloading('');
    }
  };

  const activeFilters = !!(debouncedSearch || level || subLevel || audience);

  const filterRow = (
    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', mb: 2.5 }}>
      <TextField
        size="small" placeholder="Search papers…" value={search} onChange={e => setSearch(e.target.value)}
        sx={{ width: 230, bgcolor: 'white', '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
        InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 18, color: tokens.textMuted }} /></InputAdornment> }}
      />
      <Select size="small" value={level} onChange={e => setLevel(e.target.value)} displayEmpty
        sx={{ borderRadius: 2, minWidth: 140, fontSize: 13, bgcolor: 'white' }}>
        <MenuItem value="">All levels</MenuItem>
        {filters.levels.map(l => <MenuItem key={l._id} value={l._id}>{l.name}</MenuItem>)}
      </Select>
      <Select size="small" value={subLevel} onChange={e => setSubLevel(e.target.value)} displayEmpty
        sx={{ borderRadius: 2, minWidth: 130, fontSize: 13, bgcolor: 'white' }}>
        <MenuItem value="">All classes</MenuItem>
        {filters.subLevels.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
      </Select>
      <Select size="small" value={audience} onChange={e => setAudience(e.target.value)} displayEmpty
        sx={{ borderRadius: 2, minWidth: 140, fontSize: 13, bgcolor: 'white' }}>
        <MenuItem value="">All audiences</MenuItem>
        {filters.audiences.map(a => <MenuItem key={a} value={a}>{a}</MenuItem>)}
      </Select>
      {activeFilters && (
        <Button size="small" onClick={() => { setSearch(''); setLevel(''); setSubLevel(''); setAudience(''); }}
          sx={{ textTransform: 'none', fontWeight: 600, color: tokens.textSecondary }}>
          Clear
        </Button>
      )}
      <Box sx={{ flex: 1 }} />
      <Button size="small" startIcon={<Refresh sx={{ fontSize: 16 }} />} onClick={load}
        sx={{ textTransform: 'none', fontWeight: 600, color: tokens.textSecondary }}>
        Refresh
      </Button>
    </Box>
  );

  return (
    <Box>
      <SectionTitle>Exam Bank</SectionTitle>

      <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'rgba(13,64,108,0.04)', mb: 2.5 }}>
        <Typography variant="body2" sx={{ color: tokens.textSecondary, fontFamily: "'DM Sans',sans-serif" }}>
          Every exam teachers have published publicly. Preview a paper in full, then download it as two separate
          documents — the <strong>question paper</strong> for candidates, and the <strong>marking guide</strong> with the answer key.
        </Typography>
      </Paper>

      {filterRow}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}><CircularProgress sx={{ color: tokens.accent }} /></Box>
      ) : error ? (
        <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>
      ) : exams.length === 0 ? (
        <Paper elevation={0} sx={{ p: 5, borderRadius: 3, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white', textAlign: 'center' }}>
          <MenuBook sx={{ fontSize: 36, color: tokens.textMuted, mb: 1 }} />
          <Typography variant="body2" sx={{ color: tokens.textMuted }}>
            {activeFilters ? 'No papers match these filters.' : 'No exams have been published to the bank yet.'}
          </Typography>
        </Paper>
      ) : (
        <>
          <Typography sx={{ fontSize: 12.5, color: tokens.textMuted, mb: 1.5 }}>
            {exams.length} paper{exams.length === 1 ? '' : 's'} available
          </Typography>
          <Grid container spacing={2}>
            {exams.map(exam => (
              <Grid item xs={12} md={6} lg={4} key={exam._id}>
                <Paper elevation={0} sx={{
                  p: 2, borderRadius: 3, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white',
                  height: '100%', display: 'flex', flexDirection: 'column'
                }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 14, color: tokens.textPrimary, lineHeight: 1.3, mb: 0.5 }}>
                    {exam.title}
                  </Typography>

                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1 }}>
                    {exam.level && <Chip size="small" label={exam.level} sx={{ height: 19, fontSize: 10, bgcolor: 'rgba(13,64,108,0.08)', color: tokens.primary, fontWeight: 600 }} />}
                    {exam.subLevel && <Chip size="small" label={exam.subLevel} sx={{ height: 19, fontSize: 10, bgcolor: 'rgba(12,189,115,0.12)', color: tokens.accentDark, fontWeight: 600 }} />}
                    {exam.accessType === 'free' && <Chip size="small" label="Free" sx={{ height: 19, fontSize: 10, bgcolor: '#F1F5F9', color: tokens.textSecondary, fontWeight: 600 }} />}
                  </Box>

                  {exam.description && (
                    <Typography sx={{
                      fontSize: 12, color: tokens.textMuted, mb: 1.25, lineHeight: 1.45,
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
                    }}>
                      {exam.description}
                    </Typography>
                  )}

                  <Box sx={{ display: 'flex', gap: 1.75, flexWrap: 'wrap', mb: 1.25 }}>
                    {[
                      { icon: <HelpOutline sx={{ fontSize: 14 }} />, text: `${exam.questionsCount} question${exam.questionsCount === 1 ? '' : 's'}` },
                      { icon: <FactCheck sx={{ fontSize: 14 }} />, text: `${exam.totalPoints} mark${exam.totalPoints === 1 ? '' : 's'}` },
                      { icon: <AccessTime sx={{ fontSize: 14 }} />, text: `${exam.timeLimit || '—'} min` },
                    ].map((m, i) => (
                      <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.4, color: tokens.textSecondary }}>
                        {m.icon}
                        <Typography sx={{ fontSize: 11.5, fontWeight: 600 }}>{m.text}</Typography>
                      </Box>
                    ))}
                  </Box>

                  <Box sx={{ display: 'flex', gap: 0.4, flexWrap: 'wrap', mb: 1.5 }}>
                    {Object.entries(exam.questionTypes || {}).slice(0, 4).map(([type, count]) => (
                      <Chip key={type} size="small" label={`${typeLabel(type)} ×${count}`}
                        sx={{ height: 18, fontSize: 9.5, bgcolor: '#F8FAFC', color: tokens.textMuted }} />
                    ))}
                  </Box>

                  {exam.author && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1.5, color: tokens.textMuted }}>
                      <Person sx={{ fontSize: 13 }} />
                      <Typography sx={{ fontSize: 11 }}>
                        {exam.author.name}{exam.author.organization ? ` · ${exam.author.organization}` : ''}
                      </Typography>
                    </Box>
                  )}

                  <Box sx={{ flex: 1 }} />
                  <Divider sx={{ mb: 1.25 }} />

                  <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center' }}>
                    <Button
                      size="small" variant="contained" startIcon={<Visibility sx={{ fontSize: 16 }} />}
                      onClick={() => openPreview(exam, false)}
                      sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none', fontSize: 12,
                            background: gradients.brand, boxShadow: 'none', flex: 1 }}
                    >
                      Preview
                    </Button>
                    <Tooltip title="Download the question paper (no answers)">
                      <span>
                        <IconButton size="small" onClick={() => download(exam, 'questions')}
                          disabled={downloading === `${exam._id}:questions`}
                          sx={{ border: `1px solid ${tokens.surfaceBorder}`, borderRadius: 2 }}>
                          {downloading === `${exam._id}:questions`
                            ? <CircularProgress size={15} />
                            : <PictureAsPdf sx={{ fontSize: 17, color: tokens.primary }} />}
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Download the marking guide (with the answer key)">
                      <span>
                        <IconButton size="small" onClick={() => download(exam, 'marking-guide')}
                          disabled={downloading === `${exam._id}:marking-guide`}
                          sx={{ border: `1px solid ${tokens.surfaceBorder}`, borderRadius: 2 }}>
                          {downloading === `${exam._id}:marking-guide`
                            ? <CircularProgress size={15} />
                            : <FactCheck sx={{ fontSize: 17, color: tokens.accentDark }} />}
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Box>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </>
      )}

      {/* ── Full paper preview ── */}
      <Dialog open={!!preview} onClose={() => setPreview(null)} maxWidth="md" fullWidth
        PaperProps={{ sx: { borderRadius: 3, maxHeight: '92vh' } }}>
        {preview && (
          <>
            <DialogTitle sx={{ pb: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
                <Box>
                  <Typography sx={{ fontWeight: 700, fontFamily: "'DM Sans',sans-serif", lineHeight: 1.25 }}>
                    {preview.summary.title}
                  </Typography>
                  <Typography variant="caption" sx={{ color: tokens.textMuted }}>
                    {[preview.summary.level, preview.summary.subLevel, preview.summary.targetAudience]
                      .filter(Boolean)
                      .filter((v, i, a) => a.findIndex(x => x.toLowerCase() === v.toLowerCase()) === i)
                      .join(' · ')}
                  </Typography>
                </Box>
                <IconButton size="small" onClick={() => setPreview(null)}><Close fontSize="small" /></IconButton>
              </Box>

              {preview.totals && (
                <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mt: 1.25 }}>
                  <Chip size="small" label={`${preview.totals.questions} questions`} sx={{ height: 21, fontSize: 11, bgcolor: '#F1F5F9', color: tokens.textSecondary, fontWeight: 600 }} />
                  <Chip size="small" label={`${preview.totals.points} marks`} sx={{ height: 21, fontSize: 11, bgcolor: '#F1F5F9', color: tokens.textSecondary, fontWeight: 600 }} />
                  {preview.summary.timeLimit && <Chip size="small" label={`${preview.summary.timeLimit} minutes`} sx={{ height: 21, fontSize: 11, bgcolor: '#F1F5F9', color: tokens.textSecondary, fontWeight: 600 }} />}
                  {preview.summary.passingScore && <Chip size="small" label={`Pass ${preview.summary.passingScore}%`} sx={{ height: 21, fontSize: 11, bgcolor: '#F1F5F9', color: tokens.textSecondary, fontWeight: 600 }} />}
                  <Box sx={{ flex: 1 }} />
                  <FormControlLabel
                    control={<Switch size="small" checked={showAnswers} onChange={e => toggleAnswers(e.target.checked)} disabled={previewLoading} />}
                    label={<Typography sx={{ fontSize: 12, fontWeight: 600 }}>Show answers</Typography>}
                    sx={{ mr: 0 }}
                  />
                </Box>
              )}
            </DialogTitle>

            <DialogContent dividers sx={{ bgcolor: '#FCFCFD' }}>
              {previewLoading && !preview.exam ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress size={28} sx={{ color: tokens.accent }} /></Box>
              ) : preview.exam ? (
                <Box sx={{ opacity: previewLoading ? 0.5 : 1, transition: 'opacity 150ms' }}>
                  {(preview.exam.sections || []).map((section, si) => {
                    // Numbering runs continuously across sections, exactly as the PDF numbers it.
                    const before = (preview.exam.sections || [])
                      .slice(0, si)
                      .reduce((sum, s) => sum + (s.questions || []).length, 0);
                    return (
                      <Box key={si} sx={{ mb: 3 }}>
                        <Box sx={{ bgcolor: tokens.primary, borderRadius: 1.5, px: 1.5, py: 0.85, mb: 1.5,
                                   display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                          <Typography sx={{ color: 'white', fontWeight: 700, fontSize: 12.5 }}>
                            {section.title || section.name}
                          </Typography>
                          <Typography sx={{ color: 'rgba(255,255,255,0.85)', fontSize: 11 }}>
                            {(section.questions || []).length} question{(section.questions || []).length === 1 ? '' : 's'}
                          </Typography>
                        </Box>
                        {section.instructions && (
                          <Typography sx={{ fontSize: 12, color: tokens.textMuted, fontStyle: 'italic', mb: 1.25 }}>
                            {section.instructions}
                          </Typography>
                        )}
                        {section.passage && (
                          <Paper elevation={0} sx={{ p: 1.5, mb: 1.5, bgcolor: '#F8FAFC', borderRadius: 1.5, border: `1px solid ${tokens.surfaceBorder}` }}>
                            <Typography sx={{ fontSize: 12.5, whiteSpace: 'pre-wrap' }}>{section.passage}</Typography>
                          </Paper>
                        )}
                        {(section.wordBank || []).length > 0 && (
                          <Typography sx={{ fontSize: 12, color: tokens.textSecondary, mb: 1.25 }}>
                            <strong>Word bank:</strong> {section.wordBank.map(itemText).join(' · ')}
                          </Typography>
                        )}
                        {(section.questions || []).map((q, qi) => (
                          <PreviewQuestion key={q._id || qi} question={q} number={before + qi + 1} showAnswers={showAnswers} />
                        ))}
                      </Box>
                    );
                  })}
                </Box>
              ) : null}
            </DialogContent>

            <DialogActions sx={{ px: 3, py: 2, gap: 1, flexWrap: 'wrap' }}>
              <Button onClick={() => setPreview(null)} sx={{ textTransform: 'none', color: tokens.textSecondary }}>Close</Button>
              <Box sx={{ flex: 1 }} />
              <Button
                variant="outlined" startIcon={downloading === `${preview.summary._id}:questions` ? <CircularProgress size={15} /> : <PictureAsPdf />}
                onClick={() => download(preview.summary, 'questions')}
                disabled={!!downloading}
                sx={{ borderRadius: 2.5, fontWeight: 700, textTransform: 'none', borderColor: tokens.primary, color: tokens.primary }}
              >
                Question paper
              </Button>
              <Button
                variant="contained" startIcon={downloading === `${preview.summary._id}:marking-guide` ? <CircularProgress size={15} color="inherit" /> : <FactCheck />}
                onClick={() => download(preview.summary, 'marking-guide')}
                disabled={!!downloading}
                sx={{ borderRadius: 2.5, fontWeight: 700, textTransform: 'none', background: gradients.brand, boxShadow: 'none' }}
              >
                Marking guide
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      <Snackbar open={!!snack} autoHideDuration={5000} onClose={() => setSnack('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={() => setSnack('')} severity={snack.startsWith('✓') ? 'success' : 'error'} sx={{ borderRadius: 2 }}>
          {snack}
        </Alert>
      </Snackbar>
    </Box>
  );
}
