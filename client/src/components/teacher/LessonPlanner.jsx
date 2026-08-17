import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Typography, Button, Paper, Grid, TextField, Chip, IconButton, Tooltip,
  CircularProgress, Alert, Snackbar, Accordion, AccordionSummary, AccordionDetails,
  Tabs, Tab, MenuItem, Divider, Dialog, DialogTitle, DialogContent, DialogContentText,
  DialogActions, useMediaQuery
} from '@mui/material';
import {
  AutoAwesome, Download, Save, Add, Delete, ExpandMore, MenuBook, Refresh,
  Edit, Description, CheckCircle, AttachFile, Close
} from '@mui/icons-material';
import api from '../../services/api';
import useUpload from '../../hooks/useUpload';
import usePlan from '../../hooks/usePlan';
import UploadProgress from '../UploadProgress';
import { tokens, gradients } from '../../pages/dashboardTokens';

// Mirrors server/models/LessonPlan.js — every field the printed form has.
const emptyPlan = (user) => ({
  schoolName: user?.organization || '',
  teacherName: `${user?.firstName || ''} ${user?.lastName || ''}`.trim(),
  term: '',
  date: new Date().toISOString().slice(0, 10),
  subject: '',
  className: '',
  unitNo: '',
  lessonNo: '',
  duration: '40 min',
  classSize: '',
  specialNeeds: 'None',
  unitTitle: '',
  keyUnitCompetence: '',
  lessonTitle: '',
  instructionalObjectives: '',
  location: 'Classroom',
  learningMaterials: '',
  references: '',
  lessonOverview: '',
  steps: [],
  selfEvaluation: '',
  language: '',
  sourcePrompt: '',
  sourceFileName: ''
});

const BRIEF_EXAMPLES = [
  "Unit 6 - Les habits, lesson 7 of 7: évaluation de l'unité",
  'Chapter 3 of the book: photosynthesis, S2 Biology',
  'Introduce fractions to P4 learners, first lesson of the unit',
  'Revision lesson on the past simple tense, P5 English'
];

const LANGUAGES = [
  { value: 'auto', label: 'Match the subject / book' },
  { value: 'English', label: 'English' },
  { value: 'French', label: 'French' },
  { value: 'Kinyarwanda', label: 'Kinyarwanda' },
  { value: 'Kiswahili', label: 'Kiswahili' }
];

const fieldSx = {
  '& .MuiOutlinedInput-root': { borderRadius: 2, fontFamily: "DM Sans,sans-serif", fontSize: 13.5, bgcolor: 'white' },
  '& .MuiInputLabel-root': { fontFamily: "DM Sans,sans-serif", fontSize: 13.5 }
};

const cardSx = {
  p: { xs: 2, sm: 2.5 },
  borderRadius: 3,
  border: `1px solid ${tokens.surfaceBorder}`,
  bgcolor: 'white',
  mb: 2
};

/* Editable list of activity lines for one cell of the plan's activity table. */
function LineListEditor({ label, items = [], onChange, placeholder, disabled }) {
  const update = (i, value) => onChange(items.map((line, idx) => (idx === i ? value : line)));
  const remove = (i) => onChange(items.filter((_, idx) => idx !== i));

  return (
    <Box>
      <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: tokens.textSecondary, mb: 0.75, textTransform: 'uppercase', letterSpacing: 0.3 }}>
        {label}
      </Typography>
      {items.map((line, i) => (
        <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5, mb: 0.75 }}>
          <TextField
            fullWidth size="small" multiline value={line} disabled={disabled}
            onChange={(e) => update(i, e.target.value)}
            placeholder={placeholder}
            sx={fieldSx}
          />
          <IconButton size="small" onClick={() => remove(i)} disabled={disabled} sx={{ color: tokens.danger, mt: 0.25 }}>
            <Delete sx={{ fontSize: 17 }} />
          </IconButton>
        </Box>
      ))}
      <Button
        size="small" startIcon={<Add sx={{ fontSize: 16 }} />} disabled={disabled}
        onClick={() => onChange([...items, ''])}
        sx={{ textTransform: 'none', fontSize: 12, fontWeight: 600, color: tokens.primary }}
      >
        Add line
      </Button>
    </Box>
  );
}

/* The generated plan, laid out the way it prints, with every cell editable. */
function PlanEditor({ plan, setField, setStep, addStep, removeStep }) {
  const isXs = useMediaQuery('(max-width:600px)');

  const infoFields = [
    { key: 'term', label: 'Term' },
    { key: 'date', label: 'Date' },
    { key: 'subject', label: 'Subject' },
    { key: 'className', label: 'Class' },
    { key: 'unitNo', label: 'Unit No' },
    { key: 'lessonNo', label: 'Lesson No' },
    { key: 'duration', label: 'Duration' },
    { key: 'classSize', label: 'Class size' }
  ];

  const bodyFields = [
    { key: 'unitTitle', label: 'Unit title' },
    { key: 'keyUnitCompetence', label: 'Key unit competence', multiline: true },
    { key: 'lessonTitle', label: 'Title of the lesson' },
    { key: 'instructionalObjectives', label: 'Instructional objectives', multiline: true },
    { key: 'location', label: 'Plan of this class (Location)' },
    { key: 'learningMaterials', label: 'Learning materials', multiline: true },
    { key: 'references', label: 'References', multiline: true }
  ];

  return (
    <Box>
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} sm={6}>
          <TextField fullWidth size="small" label="School name" value={plan.schoolName}
            onChange={(e) => setField('schoolName', e.target.value)} sx={fieldSx} />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField fullWidth size="small" label="Teacher's name" value={plan.teacherName}
            onChange={(e) => setField('teacherName', e.target.value)} sx={fieldSx} />
        </Grid>
      </Grid>

      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        {infoFields.map((f) => (
          <Grid item xs={6} sm={4} md={3} key={f.key}>
            <TextField
              fullWidth size="small" label={f.label} value={plan[f.key] || ''}
              type={f.key === 'date' ? 'date' : 'text'}
              InputLabelProps={f.key === 'date' ? { shrink: true } : undefined}
              onChange={(e) => setField(f.key, e.target.value)} sx={fieldSx}
            />
          </Grid>
        ))}
      </Grid>

      <TextField
        fullWidth size="small" multiline sx={{ ...fieldSx, mb: 2 }}
        label="Special educational needs catered for (and number of learners)"
        value={plan.specialNeeds || ''}
        onChange={(e) => setField('specialNeeds', e.target.value)}
      />

      {bodyFields.map((f) => (
        <TextField
          key={f.key} fullWidth size="small" label={f.label} value={plan[f.key] || ''}
          multiline={!!f.multiline} minRows={f.multiline ? 2 : 1}
          onChange={(e) => setField(f.key, e.target.value)}
          sx={{ ...fieldSx, mb: 1.5 }}
        />
      ))}

      <TextField
        fullWidth size="small" multiline label="Lesson overview (printed in italics above the activities)"
        value={plan.lessonOverview || ''}
        onChange={(e) => setField('lessonOverview', e.target.value)}
        sx={{ ...fieldSx, mb: 2.5 }}
      />

      <Divider sx={{ mb: 2 }} />
      <Typography sx={{ fontSize: 14, fontWeight: 800, color: tokens.textPrimary, mb: 1.5, fontFamily: "DM Sans,sans-serif" }}>
        Teaching and learning activities
      </Typography>

      {(plan.steps || []).map((step, i) => (
        <Paper key={i} elevation={0} sx={{ p: { xs: 1.5, sm: 2 }, mb: 2, borderRadius: 2.5, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: '#FBFDFC' }}>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1.75, flexWrap: 'wrap' }}>
            <TextField
              size="small" label="Step" value={step.name || ''}
              onChange={(e) => setStep(i, 'name', e.target.value)}
              sx={{ ...fieldSx, flex: 1, minWidth: 160 }}
            />
            <TextField
              size="small" label="Timing" value={step.duration || ''} placeholder="7 min"
              onChange={(e) => setStep(i, 'duration', e.target.value)}
              sx={{ ...fieldSx, width: 120 }}
            />
            <Tooltip title="Remove this step">
              <IconButton size="small" onClick={() => removeStep(i)} sx={{ color: tokens.danger }}>
                <Delete sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          </Box>

          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <LineListEditor
                label="Teacher's activity" items={step.teacherActivities || []}
                placeholder="Greets learners."
                onChange={(v) => setStep(i, 'teacherActivities', v)}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <LineListEditor
                label="Learner's activity" items={step.learnerActivities || []}
                placeholder="Respond to greetings."
                onChange={(v) => setStep(i, 'learnerActivities', v)}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <LineListEditor
                label="Competences & cross-cutting issues" items={step.competences || []}
                placeholder="Communication: ..."
                onChange={(v) => setStep(i, 'competences', v)}
              />
            </Grid>
          </Grid>
        </Paper>
      ))}

      <Button
        startIcon={<Add />} onClick={addStep} size={isXs ? 'small' : 'medium'}
        sx={{ textTransform: 'none', fontWeight: 700, color: tokens.primary, mb: 1 }}
      >
        Add a step
      </Button>
    </Box>
  );
}

export default function LessonPlanner({ user }) {
  const isXs = useMediaQuery('(max-width:600px)');
  const { canUseAI } = usePlan();

  const [tab, setTab] = useState(0);
  const [brief, setBrief] = useState('');
  const [details, setDetails] = useState({
    subject: '', className: '', term: '', date: new Date().toISOString().slice(0, 10),
    duration: '40 min', classSize: '', unitNo: '', lessonNo: '', specialNeeds: 'None', language: 'auto'
  });

  const [referenceContent, setReferenceContent] = useState('');
  const [referenceFile, setReferenceFile] = useState(null);
  const [referenceInfo, setReferenceInfo] = useState(null);

  const [plan, setPlan] = useState(null);
  const [planId, setPlanId] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const [saved, setSaved] = useState([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const editorRef = useRef(null);

  const setDetail = (key, value) => setDetails((d) => ({ ...d, [key]: value }));
  const setField = (key, value) => setPlan((p) => ({ ...p, [key]: value }));
  const setStep = (i, key, value) =>
    setPlan((p) => ({ ...p, steps: p.steps.map((s, idx) => (idx === i ? { ...s, [key]: value } : s)) }));
  const addStep = () =>
    setPlan((p) => ({ ...p, steps: [...(p.steps || []), { name: '', duration: '', teacherActivities: [], learnerActivities: [], competences: [] }] }));
  const removeStep = (i) => setPlan((p) => ({ ...p, steps: p.steps.filter((_, idx) => idx !== i) }));

  const {
    upload, progress: uploadProgress, uploading: isUploading,
    error: uploadError, retryCount: uploadRetryCount,
    connectionStatus: uploadConnectionStatus, reset: resetUpload
  } = useUpload({
    maxRetries: 3,
    onSuccess: (data) => {
      setReferenceContent(data.content || '');
      setReferenceInfo({ pages: data.pages, truncated: data.truncated, chars: data.contentLength });
      setError('');
    },
    onError: (err) => {
      setError(err.response?.data?.message || err.message || 'Failed to read that file.');
      setReferenceFile(null);
      setReferenceInfo(null);
    }
  });

  const loadSaved = useCallback(async () => {
    setSavedLoading(true);
    try {
      const res = await api.get('/lesson-plans');
      setSaved(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to load lesson plans:', err);
    } finally {
      setSavedLoading(false);
    }
  }, []);

  useEffect(() => { loadSaved(); }, [loadSaved]);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      setError(`That file is ${(file.size / 1024 / 1024).toFixed(1)}MB. The limit is 50MB.`);
      return;
    }
    setReferenceFile(file);
    setError('');
    try {
      // Reads the whole document server-side and returns just its text — nothing is
      // stored, and a scanned book falls back to OCR.
      await upload('/lesson-plans/extract', file);
    } catch (err) {
      console.error('Reference upload failed:', err);
    }
  };

  const clearFile = () => {
    resetUpload();
    setReferenceFile(null);
    setReferenceContent('');
    setReferenceInfo(null);
  };

  const handleGenerate = async () => {
    if (!brief.trim() && !referenceContent) {
      setError('Tell us what to prepare, or attach the book first.');
      return;
    }
    if (!canUseAI) {
      setError('AI lesson planning requires the Basic plan or higher. You can still write a plan by hand below and download it.');
      return;
    }
    setGenerating(true);
    setError('');
    try {
      const res = await api.post('/lesson-plans/generate', {
        brief: brief.trim(),
        referenceContent,
        sourceFileName: referenceFile?.name || '',
        schoolName: user?.organization || '',
        teacherName: `${user?.firstName || ''} ${user?.lastName || ''}`.trim(),
        ...details
      }, { timeout: 120000 });

      setPlan({ ...emptyPlan(user), ...res.data });
      setPlanId(null);
      setToast('Lesson plan ready — review it and download.');
      setTimeout(() => editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not generate the lesson plan. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const startBlank = () => {
    setPlan({ ...emptyPlan(user), ...details, sourcePrompt: brief.trim() });
    setPlanId(null);
    setTimeout(() => editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
  };

  const downloadPdf = async (target = plan, id = planId) => {
    setDownloading(true);
    setError('');
    try {
      const res = id
        ? await api.get(`/lesson-plans/${id}/pdf`, { responseType: 'blob' })
        : await api.post('/lesson-plans/pdf', target, { responseType: 'blob' });

      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      const name = [target?.subject, target?.className, target?.lessonTitle]
        .filter(Boolean).join(' - ') || 'lesson-plan';
      link.download = `${name}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF download failed:', err);
      setError('Could not build the PDF. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const savePlan = async () => {
    if (!plan) return;
    setSaving(true);
    setError('');
    try {
      const payload = { ...plan, sourcePrompt: plan.sourcePrompt || brief.trim(), sourceFileName: referenceFile?.name || plan.sourceFileName || '' };
      const res = planId
        ? await api.put(`/lesson-plans/${planId}`, payload)
        : await api.post('/lesson-plans', payload);
      setPlanId(res.data._id);
      setToast(planId ? 'Lesson plan updated.' : 'Lesson plan saved.');
      loadSaved();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save the lesson plan.');
    } finally {
      setSaving(false);
    }
  };

  const openSaved = (item) => {
    setPlan({ ...emptyPlan(user), ...item });
    setPlanId(item._id);
    setBrief(item.sourcePrompt || '');
    setTab(0);
    setTimeout(() => editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/lesson-plans/${deleteTarget._id}`);
      if (planId === deleteTarget._id) { setPlanId(null); setPlan(null); }
      setToast('Lesson plan deleted.');
      loadSaved();
    } catch (err) {
      setError('Could not delete that lesson plan.');
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <Box>
      {/* Header */}
      <Paper elevation={0} sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3, mb: 2, background: gradients.brand, color: 'white' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.75 }}>
          <MenuBook sx={{ fontSize: 26 }} />
          <Typography sx={{ fontSize: { xs: 18, sm: 22 }, fontWeight: 800, fontFamily: "DM Sans,sans-serif" }}>
            Lesson Planner
          </Typography>
        </Box>
        <Typography sx={{ fontSize: 13.5, opacity: 0.9, fontFamily: "DM Sans,sans-serif", maxWidth: 720 }}>
          Say what you want to teach — or attach the book and name the chapter — and the AI writes the full
          lesson plan: competences, objectives, timed activities and cross-cutting issues. Edit anything, then
          download a clean PDF ready to hand in.
        </Typography>
      </Paper>

      <Tabs
        value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2, minHeight: 40 }}
        TabIndicatorProps={{ sx: { bgcolor: tokens.accent, height: 3, borderRadius: 2 } }}
      >
        <Tab label="Create a plan" sx={{ textTransform: 'none', fontWeight: 700, fontSize: 13.5, fontFamily: "DM Sans,sans-serif", minHeight: 40 }} />
        <Tab label={`My plans${saved.length ? ` (${saved.length})` : ''}`} sx={{ textTransform: 'none', fontWeight: 700, fontSize: 13.5, fontFamily: "DM Sans,sans-serif", minHeight: 40 }} />
      </Tabs>

      {error && (
        <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2, borderRadius: 2, fontFamily: "DM Sans,sans-serif" }}>
          {error}
        </Alert>
      )}

      {tab === 0 && (
        <>
          {!canUseAI && (
            <Alert severity="info" sx={{ mb: 2, borderRadius: 2, fontFamily: "DM Sans,sans-serif" }}>
              AI generation is part of the Basic plan and above. You can still build a plan by hand and download the PDF.
            </Alert>
          )}

          {/* Step 1 — the brief */}
          <Paper elevation={0} sx={cardSx}>
            <Typography sx={{ fontSize: 14.5, fontWeight: 800, color: tokens.textPrimary, mb: 0.5, fontFamily: "DM Sans,sans-serif" }}>
              1. What are you teaching?
            </Typography>
            <Typography sx={{ fontSize: 12.5, color: tokens.textMuted, mb: 1.5, fontFamily: "DM Sans,sans-serif" }}>
              Write it however you'd say it out loud. No special wording needed.
            </Typography>

            <TextField
              fullWidth multiline minRows={isXs ? 3 : 3} value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder={"e.g. Unit 6 - Les habits, lesson 7 of 7: évaluation de l'unité, P3 French, 40 minutes"}
              sx={{ ...fieldSx, mb: 1.5 }}
            />

            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 2 }}>
              {BRIEF_EXAMPLES.map((ex) => (
                <Chip
                  key={ex} label={ex} size="small" onClick={() => setBrief(ex)}
                  sx={{ fontSize: 11.5, fontFamily: "DM Sans,sans-serif", bgcolor: '#F1F5F9', cursor: 'pointer', '&:hover': { bgcolor: '#E2E8F0' } }}
                />
              ))}
            </Box>

            {/* Optional book / curriculum */}
            <Box sx={{ p: 2, bgcolor: '#F8FAFC', borderRadius: 2, border: '2px dashed #CBD5E1' }}>
              <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: tokens.textSecondary, mb: 0.5, fontFamily: "DM Sans,sans-serif" }}>
                Attach the book or curriculum (optional)
              </Typography>
              <Typography sx={{ fontSize: 11.5, color: tokens.textMuted, mb: 1.5, fontFamily: "DM Sans,sans-serif" }}>
                PDF, DOC, DOCX or TXT up to 50MB. The AI finds the chapter you named and plans from it.
              </Typography>

              <input type="file" accept=".pdf,.doc,.docx,.txt" id="lesson-plan-reference" style={{ display: 'none' }} onChange={handleFile} />
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                <label htmlFor="lesson-plan-reference">
                  <Button component="span" variant="outlined" size="small" startIcon={<AttachFile />}
                    disabled={isUploading}
                    sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600, fontSize: 12.5 }}>
                    Choose file
                  </Button>
                </label>
                {referenceContent && (
                  <Chip
                    icon={<CheckCircle sx={{ fontSize: 16 }} />}
                    label={[
                      referenceFile?.name || 'Material',
                      referenceInfo?.pages ? `${referenceInfo.pages} pages` : null,
                      `${Math.round(referenceContent.length / 1000)}k characters read`
                    ].filter(Boolean).join(' · ')}
                    onDelete={clearFile} deleteIcon={<Close sx={{ fontSize: 15 }} />}
                    sx={{ fontSize: 11.5, bgcolor: '#DCFCE7', color: '#166534', fontWeight: 600 }}
                  />
                )}
              </Box>

              {referenceInfo?.truncated && (
                <Typography sx={{ fontSize: 11.5, color: tokens.warning, mt: 1, fontFamily: "DM Sans,sans-serif" }}>
                  This book is very long, so only the first part was read. Name the unit or chapter in the box above so the right section is used.
                </Typography>
              )}

              {(isUploading || uploadError) && (
                <Box sx={{ mt: 1.5 }}>
                  <UploadProgress
                    progress={uploadProgress} uploading={isUploading} error={uploadError}
                    retryCount={uploadRetryCount} maxRetries={3} connectionStatus={uploadConnectionStatus}
                    fileName={referenceFile?.name} fileSize={referenceFile?.size}
                    onCancel={clearFile}
                    onRetry={() => referenceFile && upload('/lesson-plans/extract', referenceFile)}
                    success={!!referenceContent}
                  />
                </Box>
              )}
            </Box>
          </Paper>

          {/* Step 2 — optional details */}
          <Accordion elevation={0} sx={{ ...cardSx, p: 0, '&:before': { display: 'none' } }}>
            <AccordionSummary expandIcon={<ExpandMore />} sx={{ px: { xs: 2, sm: 2.5 } }}>
              <Box>
                <Typography sx={{ fontSize: 14.5, fontWeight: 800, color: tokens.textPrimary, fontFamily: "DM Sans,sans-serif" }}>
                  2. Lesson details <Typography component="span" sx={{ fontSize: 12, fontWeight: 600, color: tokens.textMuted }}>— optional</Typography>
                </Typography>
                <Typography sx={{ fontSize: 12.5, color: tokens.textMuted, fontFamily: "DM Sans,sans-serif" }}>
                  Anything you leave blank, the AI fills in for you.
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ px: { xs: 2, sm: 2.5 }, pb: 2.5 }}>
              <Grid container spacing={1.5}>
                {[
                  { key: 'subject', label: 'Subject', placeholder: 'French' },
                  { key: 'className', label: 'Class', placeholder: 'Primary 3 (P3)' },
                  { key: 'term', label: 'Term', placeholder: 'Term 3' },
                  { key: 'date', label: 'Date', type: 'date' },
                  { key: 'duration', label: 'Duration', placeholder: '40 min' },
                  { key: 'classSize', label: 'Class size', placeholder: '43' },
                  { key: 'unitNo', label: 'Unit No', placeholder: '6' },
                  { key: 'lessonNo', label: 'Lesson No', placeholder: '7 Out of 7' }
                ].map((f) => (
                  <Grid item xs={6} sm={4} md={3} key={f.key}>
                    <TextField
                      fullWidth size="small" label={f.label} placeholder={f.placeholder}
                      type={f.type || 'text'} InputLabelProps={f.type === 'date' ? { shrink: true } : undefined}
                      value={details[f.key]} onChange={(e) => setDetail(f.key, e.target.value)} sx={fieldSx}
                    />
                  </Grid>
                ))}
                <Grid item xs={12} sm={8} md={6}>
                  <TextField
                    fullWidth size="small" label="Special educational needs in this class"
                    placeholder="None" value={details.specialNeeds}
                    onChange={(e) => setDetail('specialNeeds', e.target.value)} sx={fieldSx}
                  />
                </Grid>
                <Grid item xs={12} sm={4} md={3}>
                  <TextField
                    select fullWidth size="small" label="Written in" value={details.language}
                    onChange={(e) => setDetail('language', e.target.value)} sx={fieldSx}
                  >
                    {LANGUAGES.map((l) => (
                      <MenuItem key={l.value} value={l.value} sx={{ fontSize: 13.5 }}>{l.label}</MenuItem>
                    ))}
                  </TextField>
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>

          {/* Generate */}
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 3 }}>
            <Button
              variant="contained" size="large" onClick={handleGenerate}
              disabled={generating || isUploading}
              startIcon={generating ? <CircularProgress size={18} sx={{ color: 'white' }} /> : <AutoAwesome />}
              sx={{
                borderRadius: 2.5, textTransform: 'none', fontWeight: 700, fontSize: 14,
                fontFamily: "DM Sans,sans-serif", px: 3, py: 1.25, bgcolor: tokens.accent,
                '&:hover': { bgcolor: tokens.accentDark }
              }}
            >
              {generating ? 'Writing your lesson plan…' : 'Generate lesson plan'}
            </Button>
            {!plan && (
              <Button
                variant="outlined" size="large" onClick={startBlank} startIcon={<Edit />}
                sx={{ borderRadius: 2.5, textTransform: 'none', fontWeight: 700, fontSize: 14, fontFamily: "DM Sans,sans-serif", px: 3 }}
              >
                Write it myself
              </Button>
            )}
          </Box>

          {generating && (
            <Paper elevation={0} sx={{ ...cardSx, textAlign: 'center', py: 4 }}>
              <CircularProgress sx={{ color: tokens.accent, mb: 1.5 }} />
              <Typography sx={{ fontSize: 13.5, color: tokens.textSecondary, fontFamily: "DM Sans,sans-serif" }}>
                Reading your material and building the plan — this takes about 20 seconds.
              </Typography>
            </Paper>
          )}

          {/* Editor */}
          {plan && !generating && (
            <Paper elevation={0} sx={cardSx} ref={editorRef}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, flexWrap: 'wrap', mb: 2 }}>
                <Box>
                  <Typography sx={{ fontSize: 14.5, fontWeight: 800, color: tokens.textPrimary, fontFamily: "DM Sans,sans-serif" }}>
                    3. Review and download
                  </Typography>
                  <Typography sx={{ fontSize: 12.5, color: tokens.textMuted, fontFamily: "DM Sans,sans-serif" }}>
                    Every field prints exactly as you leave it here.
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Button
                    variant="contained" onClick={() => downloadPdf(plan, null)} disabled={downloading}
                    startIcon={downloading ? <CircularProgress size={16} sx={{ color: 'white' }} /> : <Download />}
                    sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, fontSize: 13, bgcolor: tokens.primary, '&:hover': { bgcolor: tokens.primaryDark } }}
                  >
                    Download PDF
                  </Button>
                  <Button
                    variant="outlined" onClick={savePlan} disabled={saving}
                    startIcon={saving ? <CircularProgress size={16} /> : <Save />}
                    sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, fontSize: 13 }}
                  >
                    {planId ? 'Update' : 'Save'}
                  </Button>
                  {canUseAI && (
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
              </Box>

              <PlanEditor plan={plan} setField={setField} setStep={setStep} addStep={addStep} removeStep={removeStep} />
            </Paper>
          )}
        </>
      )}

      {tab === 1 && (
        <Paper elevation={0} sx={cardSx}>
          {savedLoading ? (
            <Box sx={{ py: 5, textAlign: 'center' }}><CircularProgress sx={{ color: tokens.accent }} /></Box>
          ) : saved.length === 0 ? (
            <Box sx={{ py: 5, textAlign: 'center' }}>
              <Description sx={{ fontSize: 40, color: '#CBD5E1', mb: 1 }} />
              <Typography sx={{ fontSize: 14, fontWeight: 700, color: tokens.textPrimary, fontFamily: "DM Sans,sans-serif" }}>
                No saved lesson plans yet
              </Typography>
              <Typography sx={{ fontSize: 12.5, color: tokens.textMuted, fontFamily: "DM Sans,sans-serif", mb: 2 }}>
                Generate one on the “Create a plan” tab and hit Save.
              </Typography>
              <Button onClick={() => setTab(0)} variant="contained"
                sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, bgcolor: tokens.accent, '&:hover': { bgcolor: tokens.accentDark } }}>
                Create a lesson plan
              </Button>
            </Box>
          ) : (
            saved.map((item) => (
              <Box
                key={item._id}
                sx={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5,
                  py: 1.5, borderBottom: `1px solid ${tokens.surfaceBorder}`, flexWrap: 'wrap',
                  '&:last-of-type': { borderBottom: 'none' }
                }}
              >
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: tokens.textPrimary, fontFamily: "DM Sans,sans-serif" }} noWrap>
                    {item.lessonTitle || item.unitTitle || 'Untitled lesson'}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mt: 0.5 }}>
                    {[item.subject, item.className, item.date, item.duration].filter(Boolean).map((v, i) => (
                      <Chip key={i} label={v} size="small" sx={{ height: 18, fontSize: 10.5, bgcolor: '#F1F5F9', color: tokens.textSecondary }} />
                    ))}
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  <Tooltip title="Download PDF">
                    <IconButton size="small" onClick={() => downloadPdf(item, item._id)} sx={{ color: tokens.primary }}>
                      <Download sx={{ fontSize: 19 }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Open and edit">
                    <IconButton size="small" onClick={() => openSaved(item)} sx={{ color: tokens.textSecondary }}>
                      <Edit sx={{ fontSize: 19 }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton size="small" onClick={() => setDeleteTarget(item)} sx={{ color: tokens.danger }}>
                      <Delete sx={{ fontSize: 19 }} />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
            ))
          )}
        </Paper>
      )}

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle sx={{ fontFamily: "DM Sans,sans-serif", fontWeight: 700, fontSize: 16 }}>Delete this lesson plan?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontFamily: "DM Sans,sans-serif", fontSize: 13.5 }}>
            “{deleteTarget?.lessonTitle || 'Untitled lesson'}” will be removed permanently.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button onClick={confirmDelete} sx={{ textTransform: 'none', color: tokens.danger, fontWeight: 700 }}>Delete</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!toast} autoHideDuration={4000} onClose={() => setToast('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" onClose={() => setToast('')} sx={{ borderRadius: 2, fontFamily: "DM Sans,sans-serif" }}>
          {toast}
        </Alert>
      </Snackbar>
    </Box>
  );
}
