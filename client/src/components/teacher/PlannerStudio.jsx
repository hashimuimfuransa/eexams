import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Typography, Button, Paper, Grid, TextField, Chip, IconButton, Tooltip,
  CircularProgress, Alert, Snackbar, MenuItem, Divider, Dialog, DialogTitle,
  DialogContent, DialogContentText, DialogActions, useMediaQuery, Select,
  FormControl, InputLabel, LinearProgress
} from '@mui/material';
import {
  AutoAwesome, Download, Save, Add, Delete, Description, AttachFile, Close, Refresh
} from '@mui/icons-material';
import api from '../../services/api';
import { tokens } from '../../pages/dashboardTokens';

// One studio for all three non-lesson-plan Lesson Planner outputs — slide
// decks, exercise sheets and schemes of work. They share the whole flow
// (describe → AI draft → edit → save → export) and differ only in the shape of
// the thing being edited, so KIND_CONFIG holds the differences and the rest of
// this file is common. Three bespoke editors would have been the same code
// three times, drifting apart on every change.
//
// The lesson plan itself keeps its own component: its printed form is a fixed
// REB layout with its own rules, not a list of repeatable rows.

const cardSx = {
  p: { xs: 2, sm: 2.5 },
  borderRadius: 3,
  border: `1px solid ${tokens.surfaceBorder}`,
  bgcolor: 'white',
  mb: 2
};

const LANGUAGES = ['auto', 'English', 'French', 'Kinyarwanda', 'Kiswahili'];

// Blank row factories, matching the sub-schemas in server/models/PlannerResource.js.
const blankSlide = () => ({ heading: '', bullets: [''], notes: '' });
const blankItem = (n) => ({ number: String(n), question: '', options: [], answer: '', marks: '' });
const blankWeek = (n) => ({
  week: String(n), lessonNo: '', unitTitle: '', lessonTitle: '',
  objectives: '', activities: '', materials: '', assessment: ''
});

const KIND_CONFIG = {
  slides: {
    kind: 'slides',
    title: 'Slides',
    heading: 'Slide deck builder',
    blurb: 'Describe the lesson and get a ready-to-teach deck you can edit, print or hand out.',
    bodyKey: 'slides',
    rowLabel: 'slide',
    countLabel: 'How many slides',
    defaultCount: 10,
    maxCount: 25,
    quotaKey: 'slidesPerMonth',
    newRow: blankSlide,
    briefPlaceholder: 'e.g. Unit 6 "Les habits" — vocabulary deck for P3, 10 slides'
  },
  exercises: {
    kind: 'exercises',
    title: 'Exercises',
    heading: 'Exercise sheet builder',
    blurb: 'Turn a lesson into a printable question sheet with a marking key.',
    bodyKey: 'items',
    rowLabel: 'question',
    countLabel: 'How many questions',
    defaultCount: 10,
    maxCount: 40,
    quotaKey: 'exercisesPerMonth',
    newRow: blankItem,
    briefPlaceholder: 'e.g. 10 questions on "Les habits" for P3 — mixed multiple choice and short answer'
  },
  scheme: {
    kind: 'scheme',
    title: 'Scheme of work',
    heading: 'Scheme of work builder',
    blurb: 'Lay out a whole term week by week, then export it for your head teacher.',
    bodyKey: 'weeks',
    rowLabel: 'week',
    countLabel: 'How many weeks',
    defaultCount: 12,
    maxCount: 20,
    quotaKey: 'schemesPerMonth',
    newRow: blankWeek,
    briefPlaceholder: 'e.g. French P3, Term 3 — 12 weeks covering units 5 to 8'
  }
};

const emptyResource = (config, user) => ({
  kind: config.kind,
  title: '',
  subject: '',
  className: '',
  term: '',
  unitTitle: '',
  academicYear: String(new Date().getFullYear()),
  schoolName: user?.organization || '',
  teacherName: `${user?.firstName || ''} ${user?.lastName || ''}`.trim(),
  language: '',
  instructions: '',
  [config.bodyKey]: []
});

/* Editable list of short lines (slide bullets, MCQ options). */
function LineListEditor({ label, items = [], onChange, placeholder }) {
  const update = (i, value) => onChange(items.map((line, idx) => (idx === i ? value : line)));
  const remove = (i) => onChange(items.filter((_, idx) => idx !== i));

  return (
    <Box>
      <Typography sx={{ fontSize: 12, fontWeight: 700, color: tokens.textMuted, mb: 0.5 }}>{label}</Typography>
      {items.map((line, i) => (
        <Box key={i} sx={{ display: 'flex', gap: 0.5, mb: 0.5 }}>
          <TextField
            fullWidth size="small" value={line} placeholder={placeholder}
            onChange={(e) => update(i, e.target.value)}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5, fontSize: 13 } }}
          />
          <IconButton size="small" onClick={() => remove(i)} sx={{ color: tokens.danger }}>
            <Delete fontSize="small" />
          </IconButton>
        </Box>
      ))}
      <Button size="small" startIcon={<Add />} onClick={() => onChange([...items, ''])}
        sx={{ textTransform: 'none', fontWeight: 600, fontSize: 12 }}>
        Add line
      </Button>
    </Box>
  );
}

export default function PlannerStudio({ user, kind }) {
  const config = KIND_CONFIG[kind];
  const isXs = useMediaQuery('(max-width:600px)');
  const editorRef = useRef(null);

  const [brief, setBrief] = useState('');
  const [count, setCount] = useState(config.defaultCount);
  const [questionType, setQuestionType] = useState('mixed');
  const [details, setDetails] = useState({
    subject: '', className: '', term: '', unitTitle: '',
    academicYear: String(new Date().getFullYear()), language: 'auto'
  });

  const [referenceContent, setReferenceContent] = useState('');
  const [referenceInfo, setReferenceInfo] = useState(null);
  const [uploading, setUploading] = useState(false);

  const [resource, setResource] = useState(null);
  const [resourceId, setResourceId] = useState(null);
  const [saved, setSaved] = useState([]);
  const [savedLoading, setSavedLoading] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [quota, setQuota] = useState(null);

  // Reset everything when the dashboard switches between studio kinds — the
  // component instance is reused, and a deck must not leak into a scheme.
  useEffect(() => {
    setBrief('');
    setCount(config.defaultCount);
    setResource(null);
    setResourceId(null);
    setError('');
  }, [config.kind, config.defaultCount]);

  const loadSaved = useCallback(async () => {
    setSavedLoading(true);
    try {
      const res = await api.get(`/planner-resources/${config.kind}`);
      setSaved(res.data || []);
    } catch (err) {
      console.error('Failed to load saved resources:', err);
    } finally {
      setSavedLoading(false);
    }
  }, [config.kind]);

  const loadQuota = useCallback(async () => {
    try {
      const res = await api.get('/planner-resources/quota');
      setQuota((res.data.quotas || []).find((q) => q.key === config.quotaKey) || null);
    } catch (err) {
      console.error('Failed to load allowance:', err);
    }
  }, [config.quotaKey]);

  useEffect(() => { loadSaved(); loadQuota(); }, [loadSaved, loadQuota]);

  const exhausted = quota ? quota.allowed === false : false;
  const unlimited = quota?.limit === -1;
  const quotaText = quota && !unlimited
    ? `${quota.used} of ${quota.limit} used this month`
    : unlimited ? 'Unlimited this month' : '';
  const resetsOn = quota?.periodEnd
    ? new Date(quota.periodEnd).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })
    : '';

  const body = resource?.[config.bodyKey] || [];
  const setBody = (rows) => setResource({ ...resource, [config.bodyKey]: rows });
  const updateRow = (i, patch) => setBody(body.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  const removeRow = (i) => setBody(body.filter((_, idx) => idx !== i));
  const addRow = () => setBody([...body, config.newRow(body.length + 1)]);

  // Reuses the lesson planner's extractor rather than duplicating it — the
  // teacher's textbook is the same file whichever output they want from it.
  const handleReference = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await api.post('/lesson-plans/extract', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setReferenceContent(res.data.text || '');
      setReferenceInfo({ name: file.name, pages: res.data.pages });
    } catch (err) {
      setError(err.response?.data?.message || 'Could not read that file.');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const handleGenerate = async () => {
    if (exhausted) {
      setError(`${quotaText}. Upgrade your plan, or wait until the allowance resets on ${resetsOn}.`);
      return;
    }
    if (!brief.trim() && !referenceContent) {
      setError('Tell us what to prepare, or attach the book first.');
      return;
    }
    setGenerating(true);
    setError('');
    try {
      const res = await api.post(`/planner-resources/${config.kind}/generate`, {
        brief, referenceContent, count, questionType,
        ...details,
        sourceFileName: referenceInfo?.name || ''
      });
      setResource({ ...emptyResource(config, user), ...res.data });
      setResourceId(null);
      setTimeout(() => editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
    } catch (err) {
      setError(err.response?.data?.message || `Could not generate the ${config.rowLabel} set.`);
    } finally {
      setGenerating(false);
    }
  };

  const startBlank = () => {
    if (exhausted) {
      setError(`${quotaText}. Upgrade your plan, or wait until the allowance resets on ${resetsOn}.`);
      return;
    }
    setResource({
      ...emptyResource(config, user),
      ...details,
      language: details.language === 'auto' ? '' : details.language,
      sourcePrompt: brief.trim(),
      [config.bodyKey]: [config.newRow(1)]
    });
    setResourceId(null);
    setTimeout(() => editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
  };

  const save = async () => {
    if (!resource) return;
    setSaving(true);
    setError('');
    try {
      const res = resourceId
        ? await api.put(`/planner-resources/${config.kind}/${resourceId}`, resource)
        : await api.post(`/planner-resources/${config.kind}`, resource);
      setResourceId(res.data._id);
      setToast(resourceId ? 'Saved changes.' : 'Saved to your library.');
      // Only a new resource spends the allowance; re-read it rather than
      // decrementing locally so the counter can't drift.
      if (!resourceId) loadQuota();
      loadSaved();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  const download = async (format, target = resource, id = resourceId) => {
    setDownloading(format);
    setError('');
    try {
      const res = id
        ? await api.get(`/planner-resources/${config.kind}/${id}/export/${format}`, { responseType: 'blob' })
        : await api.post(`/planner-resources/${config.kind}/export/${format}`, target, { responseType: 'blob' });

      const mime = format === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      const url = window.URL.createObjectURL(new Blob([res.data], { type: mime }));
      const link = document.createElement('a');
      link.href = url;
      const name = [target?.subject, target?.className, target?.title]
        .filter(Boolean).join(' - ') || config.kind;
      link.download = `${name}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.response?.data?.message || `Could not build the ${format.toUpperCase()}.`);
    } finally {
      setDownloading('');
    }
  };

  const openSaved = async (item) => {
    setResource(item);
    setResourceId(item._id);
    setTimeout(() => editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const remove = async (id) => {
    try {
      await api.delete(`/planner-resources/${config.kind}/${id}`);
      if (id === resourceId) { setResource(null); setResourceId(null); }
      setToast('Deleted.');
      loadSaved();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not delete.');
    } finally {
      setConfirmDelete(null);
    }
  };

  const detailField = (name, label, extra = {}) => (
    <Grid item xs={12} sm={6} md={3}>
      <TextField
        fullWidth size="small" label={label} value={details[name]}
        onChange={(e) => setDetails({ ...details, [name]: e.target.value })}
        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, fontSize: 13 } }}
        {...extra}
      />
    </Grid>
  );

  return (
    <Box sx={{ p: { xs: 1.5, sm: 3 }, maxWidth: 1200, mx: 'auto' }}>
      <Box sx={{ mb: 2 }}>
        <Typography sx={{ fontSize: { xs: 20, sm: 24 }, fontWeight: 800, color: tokens.textPrimary, fontFamily: 'DM Sans,sans-serif' }}>
          {config.heading}
        </Typography>
        <Typography sx={{ fontSize: 13, color: tokens.textMuted }}>{config.blurb}</Typography>
      </Box>

      {quota && (
        <Paper elevation={0} sx={{ ...cardSx, py: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
            <Box>
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: tokens.textPrimary }}>
                {quotaText}{!unlimited && resetsOn ? ` — resets ${resetsOn}` : ''}
              </Typography>
              {exhausted && (
                <Typography sx={{ fontSize: 12, color: tokens.danger }}>
                  Upgrade your plan to create more this month.
                </Typography>
              )}
            </Box>
            {!unlimited && quota.limit > 0 && (
              <Box sx={{ flex: '1 1 180px', minWidth: 140 }}>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(100, (quota.used / quota.limit) * 100)}
                  color={exhausted ? 'error' : 'primary'}
                  sx={{ height: 8, borderRadius: 4 }}
                />
              </Box>
            )}
          </Box>
        </Paper>
      )}

      {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

      {/* Step 1 — the brief */}
      <Paper elevation={0} sx={cardSx}>
        <Typography sx={{ fontSize: 14, fontWeight: 800, color: tokens.textPrimary, mb: 1.5 }}>
          1. What do you want to prepare?
        </Typography>
        <TextField
          fullWidth multiline minRows={2} value={brief}
          onChange={(e) => setBrief(e.target.value)}
          placeholder={config.briefPlaceholder}
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, fontSize: 14 }, mb: 2 }}
        />

        <Grid container spacing={1.5} sx={{ mb: 2 }}>
          {detailField('subject', 'Subject')}
          {detailField('className', 'Class')}
          {config.kind === 'scheme' ? detailField('term', 'Term') : detailField('unitTitle', 'Unit')}
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Language</InputLabel>
              <Select
                label="Language" value={details.language}
                onChange={(e) => setDetails({ ...details, language: e.target.value })}
                sx={{ borderRadius: 2, fontSize: 13 }}
              >
                {LANGUAGES.map((l) => (
                  <MenuItem key={l} value={l}>{l === 'auto' ? 'Match the subject' : l}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth size="small" type="number" label={config.countLabel} value={count}
              onChange={(e) => setCount(Math.max(1, Math.min(config.maxCount, parseInt(e.target.value, 10) || 1)))}
              inputProps={{ min: 1, max: config.maxCount }}
              helperText={`Up to ${config.maxCount}`}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, fontSize: 13 } }}
            />
          </Grid>
          {config.kind === 'exercises' && (
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Question type</InputLabel>
                <Select
                  label="Question type" value={questionType}
                  onChange={(e) => setQuestionType(e.target.value)}
                  sx={{ borderRadius: 2, fontSize: 13 }}
                >
                  <MenuItem value="mixed">Mixed</MenuItem>
                  <MenuItem value="multiple_choice">Multiple choice</MenuItem>
                  <MenuItem value="open">Open response</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          )}
        </Grid>

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          <Button
            component="label" variant="outlined" size="small"
            startIcon={uploading ? <CircularProgress size={14} /> : <AttachFile />}
            disabled={uploading}
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, fontSize: 13 }}
          >
            {uploading ? 'Reading…' : 'Attach book / curriculum'}
            <input hidden type="file" accept=".pdf,.doc,.docx,.txt" onChange={handleReference} />
          </Button>
          {referenceInfo && (
            <Chip
              size="small" label={`${referenceInfo.name}${referenceInfo.pages ? ` · ${referenceInfo.pages}p` : ''}`}
              onDelete={() => { setReferenceContent(''); setReferenceInfo(null); }}
              deleteIcon={<Close />}
            />
          )}
        </Box>

        <Divider sx={{ my: 2 }} />

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button
            variant="contained" onClick={handleGenerate}
            disabled={generating || uploading || exhausted}
            startIcon={generating ? <CircularProgress size={16} sx={{ color: 'white' }} /> : <AutoAwesome />}
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, fontSize: 13, bgcolor: tokens.primary, '&:hover': { bgcolor: tokens.primaryDark } }}
          >
            {generating ? 'Working…' : exhausted ? 'Monthly limit reached' : `Generate ${config.title.toLowerCase()}`}
          </Button>
          <Button
            variant="outlined" onClick={startBlank} disabled={exhausted}
            startIcon={<Description />}
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, fontSize: 13 }}
          >
            Start from blank
          </Button>
        </Box>
      </Paper>

      {/* Step 2 — review and edit */}
      {resource && (
        <Paper elevation={0} sx={cardSx} ref={editorRef}>
          <Typography sx={{ fontSize: 14, fontWeight: 800, color: tokens.textPrimary, mb: 1.5 }}>
            2. Review and edit
          </Typography>

          <Grid container spacing={1.5} sx={{ mb: 2 }}>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Title" value={resource.title || ''}
                onChange={(e) => setResource({ ...resource, title: e.target.value })}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, fontSize: 13 } }} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField fullWidth size="small" label="Subject" value={resource.subject || ''}
                onChange={(e) => setResource({ ...resource, subject: e.target.value })}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, fontSize: 13 } }} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField fullWidth size="small" label="Class" value={resource.className || ''}
                onChange={(e) => setResource({ ...resource, className: e.target.value })}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, fontSize: 13 } }} />
            </Grid>
            {config.kind === 'exercises' && (
              <Grid item xs={12}>
                <TextField fullWidth size="small" label="Instructions printed at the top"
                  value={resource.instructions || ''}
                  onChange={(e) => setResource({ ...resource, instructions: e.target.value })}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, fontSize: 13 } }} />
              </Grid>
            )}
          </Grid>

          {body.map((row, i) => (
            <Paper key={i} elevation={0} sx={{ p: 1.5, mb: 1.5, borderRadius: 2, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: '#FAFBFC' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 800, color: tokens.textPrimary, textTransform: 'capitalize' }}>
                  {config.rowLabel} {i + 1}
                </Typography>
                <IconButton size="small" onClick={() => removeRow(i)} sx={{ color: tokens.danger }}>
                  <Delete fontSize="small" />
                </IconButton>
              </Box>

              {config.kind === 'slides' && (
                <Grid container spacing={1.5}>
                  <Grid item xs={12}>
                    <TextField fullWidth size="small" label="Heading" value={row.heading || ''}
                      onChange={(e) => updateRow(i, { heading: e.target.value })}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5, fontSize: 13 } }} />
                  </Grid>
                  <Grid item xs={12} md={7}>
                    <LineListEditor label="Bullets" items={row.bullets || []}
                      onChange={(bullets) => updateRow(i, { bullets })}
                      placeholder="One short line learners can read" />
                  </Grid>
                  <Grid item xs={12} md={5}>
                    <TextField fullWidth size="small" multiline minRows={3} label="Speaker notes"
                      value={row.notes || ''} onChange={(e) => updateRow(i, { notes: e.target.value })}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5, fontSize: 13 } }} />
                  </Grid>
                </Grid>
              )}

              {config.kind === 'exercises' && (
                <Grid container spacing={1.5}>
                  <Grid item xs={4} sm={2}>
                    <TextField fullWidth size="small" label="No." value={row.number || ''}
                      onChange={(e) => updateRow(i, { number: e.target.value })}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5, fontSize: 13 } }} />
                  </Grid>
                  <Grid item xs={8} sm={2}>
                    <TextField fullWidth size="small" label="Marks" value={row.marks || ''}
                      onChange={(e) => updateRow(i, { marks: e.target.value })}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5, fontSize: 13 } }} />
                  </Grid>
                  <Grid item xs={12} sm={8}>
                    <TextField fullWidth size="small" multiline label="Question" value={row.question || ''}
                      onChange={(e) => updateRow(i, { question: e.target.value })}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5, fontSize: 13 } }} />
                  </Grid>
                  <Grid item xs={12} md={7}>
                    <LineListEditor label="Options (leave empty for open response)" items={row.options || []}
                      onChange={(options) => updateRow(i, { options })} placeholder="One option" />
                  </Grid>
                  <Grid item xs={12} md={5}>
                    <TextField fullWidth size="small" multiline minRows={2} label="Answer (marking key)"
                      value={row.answer || ''} onChange={(e) => updateRow(i, { answer: e.target.value })}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5, fontSize: 13 } }} />
                  </Grid>
                </Grid>
              )}

              {config.kind === 'scheme' && (
                <Grid container spacing={1.5}>
                  <Grid item xs={4} sm={2}>
                    <TextField fullWidth size="small" label="Week" value={row.week || ''}
                      onChange={(e) => updateRow(i, { week: e.target.value })}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5, fontSize: 13 } }} />
                  </Grid>
                  <Grid item xs={4} sm={2}>
                    <TextField fullWidth size="small" label="Lesson #" value={row.lessonNo || ''}
                      onChange={(e) => updateRow(i, { lessonNo: e.target.value })}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5, fontSize: 13 } }} />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField fullWidth size="small" label="Unit" value={row.unitTitle || ''}
                      onChange={(e) => updateRow(i, { unitTitle: e.target.value })}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5, fontSize: 13 } }} />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField fullWidth size="small" label="Lesson title" value={row.lessonTitle || ''}
                      onChange={(e) => updateRow(i, { lessonTitle: e.target.value })}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5, fontSize: 13 } }} />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField fullWidth size="small" multiline label="Objectives" value={row.objectives || ''}
                      onChange={(e) => updateRow(i, { objectives: e.target.value })}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5, fontSize: 13 } }} />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField fullWidth size="small" multiline label="Activities" value={row.activities || ''}
                      onChange={(e) => updateRow(i, { activities: e.target.value })}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5, fontSize: 13 } }} />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField fullWidth size="small" multiline label="Materials" value={row.materials || ''}
                      onChange={(e) => updateRow(i, { materials: e.target.value })}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5, fontSize: 13 } }} />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField fullWidth size="small" multiline label="Assessment" value={row.assessment || ''}
                      onChange={(e) => updateRow(i, { assessment: e.target.value })}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5, fontSize: 13 } }} />
                  </Grid>
                </Grid>
              )}
            </Paper>
          ))}

          <Button size="small" startIcon={<Add />} onClick={addRow}
            sx={{ textTransform: 'none', fontWeight: 700, fontSize: 13, mb: 2 }}>
            Add {config.rowLabel}
          </Button>

          <Divider sx={{ my: 2 }} />

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button
              variant="contained" onClick={() => download('pdf')} disabled={!!downloading}
              startIcon={downloading === 'pdf' ? <CircularProgress size={16} sx={{ color: 'white' }} /> : <Download />}
              sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, fontSize: 13, bgcolor: tokens.primary, '&:hover': { bgcolor: tokens.primaryDark } }}
            >
              Download PDF
            </Button>
            <Button
              variant="outlined" onClick={() => download('docx')} disabled={!!downloading}
              startIcon={downloading === 'docx' ? <CircularProgress size={16} /> : <Description />}
              sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, fontSize: 13 }}
            >
              Download Word
            </Button>
            <Button
              variant="outlined" onClick={save} disabled={saving}
              startIcon={saving ? <CircularProgress size={16} /> : <Save />}
              sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, fontSize: 13 }}
            >
              {resourceId ? 'Update' : 'Save'}
            </Button>
            {!exhausted && (
              <Tooltip title="Generate a fresh version from the same brief">
                <span>
                  <Button
                    variant="outlined" onClick={handleGenerate} disabled={generating}
                    startIcon={<Refresh />}
                    sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, fontSize: 13 }}
                  >
                    Regenerate
                  </Button>
                </span>
              </Tooltip>
            )}
          </Box>
        </Paper>
      )}

      {/* Library */}
      <Paper elevation={0} sx={cardSx}>
        <Typography sx={{ fontSize: 14, fontWeight: 800, color: tokens.textPrimary, mb: 1.5 }}>
          Your saved {config.title.toLowerCase()}
        </Typography>
        {savedLoading ? (
          <CircularProgress size={22} />
        ) : saved.length === 0 ? (
          <Typography sx={{ fontSize: 13, color: tokens.textMuted }}>
            Nothing saved yet. Generate something above and press Save.
          </Typography>
        ) : (
          saved.map((item) => (
            <Box key={item._id} sx={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 1, py: 1, borderBottom: `1px solid ${tokens.surfaceBorder}`, flexWrap: 'wrap'
            }}>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: tokens.textPrimary }} noWrap>
                  {item.title || `Untitled ${config.rowLabel} set`}
                </Typography>
                <Typography sx={{ fontSize: 11, color: tokens.textMuted }} noWrap>
                  {[item.subject, item.className, `${(item[config.bodyKey] || []).length} ${config.rowLabel}s`]
                    .filter(Boolean).join(' · ')}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <Button size="small" onClick={() => openSaved(item)}
                  sx={{ textTransform: 'none', fontWeight: 700, fontSize: 12 }}>
                  Open
                </Button>
                <Tooltip title="Download PDF">
                  <IconButton size="small" onClick={() => download('pdf', item, item._id)}><Download fontSize="small" /></IconButton>
                </Tooltip>
                <Tooltip title="Download Word">
                  <IconButton size="small" onClick={() => download('docx', item, item._id)}><Description fontSize="small" /></IconButton>
                </Tooltip>
                <IconButton size="small" onClick={() => setConfirmDelete(item)} sx={{ color: tokens.danger }}>
                  <Delete fontSize="small" />
                </IconButton>
              </Box>
            </Box>
          ))
        )}
      </Paper>

      <Dialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)}>
        <DialogTitle>Delete this {config.rowLabel} set?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            &quot;{confirmDelete?.title || 'Untitled'}&quot; will be removed permanently. This does not give back the
            monthly allowance it used.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(null)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button onClick={() => remove(confirmDelete._id)} color="error" sx={{ textTransform: 'none', fontWeight: 700 }}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!toast} autoHideDuration={3000} onClose={() => setToast('')}
        message={toast} anchorOrigin={{ vertical: 'bottom', horizontal: isXs ? 'center' : 'right' }}
      />
    </Box>
  );
}
