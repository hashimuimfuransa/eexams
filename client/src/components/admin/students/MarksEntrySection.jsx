import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box, Typography, Paper, Grid, TextField, Button, IconButton, Chip, Avatar,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Dialog,
  DialogTitle, DialogContent, DialogActions, CircularProgress, Snackbar, Alert,
  Select, MenuItem, Tooltip, Divider, FormControlLabel, Switch, InputAdornment,
  Tabs, Tab
} from '@mui/material';
import {
  Add, Close, Delete, Edit, Search, ContentCopy, Badge as BadgeIcon,
  AutoFixHigh, Save, MenuBook, OpenInNew, Download, PictureAsPdf
} from '@mui/icons-material';
import api from '../../../services/api';
import { tokens, gradients } from '../../../pages/dashboardTokens';
import { SectionTitle } from '../../../pages/DashboardShell';
import downloadFile from '../../../utils/downloadFile';
import TranscriptAnalytics from './TranscriptAnalytics';

// School admins enter term marks by hand here. The server recomputes every
// total and grade on save, so the figures shown while typing are a preview only.

const TERMS = ['Term 1', 'Term 2', 'Term 3', 'Semester 1', 'Semester 2', 'Annual'];

// Mirrors server/utils/gradeScale.js so the preview matches what gets stored.
const gradeLetter = (pct) => {
  if (pct >= 90) return 'A';
  if (pct >= 80) return 'B';
  if (pct >= 70) return 'C';
  if (pct >= 60) return 'D';
  if (pct >= 50) return 'E';
  return 'F';
};

const gradeColor = (pct) => {
  if (pct >= 80) return '#0CBD73';
  if (pct >= 60) return tokens.primary;
  if (pct >= 50) return '#F59E0B';
  return '#EF4444';
};

const pctOf = (marks, maxMarks) => {
  const m = Number(marks);
  const max = Number(maxMarks);
  if (!Number.isFinite(m) || !Number.isFinite(max) || max <= 0) return 0;
  return Math.round((m / max) * 1000) / 10;
};

// Default academic year label, e.g. "2025-2026" — schools usually start in September.
const defaultAcademicYear = () => {
  const now = new Date();
  const startYear = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  return `${startYear}-${startYear + 1}`;
};

const emptySubject = () => ({ name: '', code: '', marks: '', maxMarks: 100, coefficient: 1, remark: '' });

const blankForm = (student) => ({
  recordId: null,
  academicYear: defaultAcademicYear(),
  term: 'Term 1',
  class: student?.class || '',
  position: '',
  outOf: '',
  remarks: '',
  isPublished: true,
  subjects: [emptySubject(), emptySubject(), emptySubject()]
});

export default function MarksEntrySection() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [snack, setSnack] = useState('');
  const [issuing, setIssuing] = useState(false);
  const [tab, setTab] = useState('entry');
  const [downloading, setDownloading] = useState(false);

  // Selected student + their existing records
  const [selected, setSelected] = useState(null);
  const [records, setRecords] = useState([]);
  const [recordsLoading, setRecordsLoading] = useState(false);

  // Marks entry form
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(blankForm(null));
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Registration number editor
  const [regDialog, setRegDialog] = useState(null);
  const [regValue, setRegValue] = useState('');
  const [regSaving, setRegSaving] = useState(false);
  const [regError, setRegError] = useState('');
  const [nextRegNumber, setNextRegNumber] = useState('');

  const [deleteTarget, setDeleteTarget] = useState(null);

  const loadStudents = useCallback(() => {
    setLoading(true);
    api.get('/admin/transcripts/students')
      .then(r => { setStudents(r.data?.students || []); setLoadError(''); })
      .catch(() => setLoadError('Failed to load students.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadStudents(); }, [loadStudents]);

  const loadRecords = useCallback((studentId) => {
    setRecordsLoading(true);
    api.get(`/admin/transcripts/student/${studentId}`)
      .then(r => {
        setRecords(r.data?.records || []);
        // The server issues a number on first save, so refresh what we show.
        if (r.data?.student) setSelected(prev => (prev ? { ...prev, ...r.data.student } : r.data.student));
      })
      .catch(() => setSnack('Failed to load this student’s records'))
      .finally(() => setRecordsLoading(false));
  }, []);

  const openStudent = (student) => {
    setSelected(student);
    setRecords([]);
    loadRecords(student._id);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter(s =>
      `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) ||
      (s.email || '').toLowerCase().includes(q) ||
      (s.registrationNumber || '').toLowerCase().includes(q) ||
      (s.class || '').toLowerCase().includes(q)
    );
  }, [students, search]);

  const missingRegNumbers = students.filter(s => !s.registrationNumber).length;

  // ── Live preview of the totals the server will compute ──
  const preview = useMemo(() => {
    let weighted = 0, weight = 0, total = 0, max = 0;
    form.subjects.forEach(s => {
      if (!s.name.trim() || s.marks === '') return;
      const pct = pctOf(s.marks, s.maxMarks);
      const w = Number(s.coefficient) > 0 ? Number(s.coefficient) : 1;
      weighted += pct * w;
      weight += w;
      total += Number(s.marks) || 0;
      max += Number(s.maxMarks) || 0;
    });
    const overall = weight > 0 ? Math.round((weighted / weight) * 10) / 10 : 0;
    return { overall, total, max, grade: gradeLetter(overall), filled: weight > 0 };
  }, [form.subjects]);

  // ── Form helpers ──
  const setSubject = (index, field, value) => {
    setForm(f => ({
      ...f,
      subjects: f.subjects.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    }));
  };
  const addSubjectRow = () => setForm(f => ({ ...f, subjects: [...f.subjects, emptySubject()] }));
  const removeSubjectRow = (index) =>
    setForm(f => ({ ...f, subjects: f.subjects.filter((_, i) => i !== index) }));

  const openNewRecord = () => {
    setForm(blankForm(selected));
    setFormError('');
    setFormOpen(true);
  };

  const openEditRecord = (record) => {
    setForm({
      recordId: record._id,
      academicYear: record.academicYear || '',
      term: record.term || 'Term 1',
      class: record.class || '',
      position: record.position ?? '',
      outOf: record.outOf ?? '',
      remarks: record.remarks || '',
      isPublished: record.isPublished !== false,
      subjects: (record.subjects || []).map(s => ({
        name: s.name || '',
        code: s.code || '',
        marks: s.marks ?? '',
        maxMarks: s.maxMarks ?? 100,
        coefficient: s.coefficient ?? 1,
        remark: s.remark || ''
      }))
    });
    setFormError('');
    setFormOpen(true);
  };

  const handleSave = async () => {
    const subjects = form.subjects
      .filter(s => s.name.trim() !== '' || s.marks !== '')
      .map(s => ({
        name: s.name.trim(),
        code: s.code.trim(),
        marks: s.marks,
        maxMarks: s.maxMarks === '' ? 100 : s.maxMarks,
        coefficient: s.coefficient === '' ? 1 : s.coefficient,
        remark: s.remark.trim()
      }));

    if (!form.academicYear.trim()) { setFormError('Academic year is required.'); return; }
    if (!form.term.trim()) { setFormError('Term is required.'); return; }
    if (subjects.length === 0) { setFormError('Add at least one subject with marks.'); return; }

    const incomplete = subjects.find(s => !s.name || s.marks === '' || s.marks === null);
    if (incomplete) {
      setFormError(`Fill in both a subject name and marks for every row (check "${incomplete.name || 'the blank row'}").`);
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      const payload = {
        academicYear: form.academicYear.trim(),
        term: form.term.trim(),
        class: form.class.trim(),
        subjects,
        remarks: form.remarks.trim(),
        position: form.position,
        outOf: form.outOf,
        isPublished: form.isPublished
      };

      if (form.recordId) {
        await api.put(`/admin/transcripts/${form.recordId}`, payload);
        setSnack('✓ Marks updated');
      } else {
        await api.post('/admin/transcripts', { studentId: selected._id, ...payload });
        setSnack('✓ Marks saved — the transcript is now on /results');
      }

      setFormOpen(false);
      loadRecords(selected._id);
      loadStudents();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to save marks');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRecord = async () => {
    try {
      await api.delete(`/admin/transcripts/${deleteTarget._id}`);
      setSnack('✓ Record deleted');
      setDeleteTarget(null);
      loadRecords(selected._id);
      loadStudents();
    } catch (err) {
      setSnack(err.response?.data?.message || 'Failed to delete record');
      setDeleteTarget(null);
    }
  };

  const handleIssueMissing = async () => {
    setIssuing(true);
    try {
      const res = await api.post('/admin/students/generate-registration-numbers');
      // The endpoint reports partial failures in a 200, so only claim success
      // when nothing failed.
      const failedCount = (res.data?.failed || []).length;
      const message = res.data?.message || 'Registration numbers issued';
      setSnack(failedCount > 0 ? message : `✓ ${message}`);
      loadStudents();
    } catch (err) {
      setSnack(err.response?.data?.message || 'Failed to issue registration numbers');
    } finally {
      setIssuing(false);
    }
  };

  const openRegDialog = (student) => {
    setRegDialog(student);
    setRegValue(student.registrationNumber || '');
    setRegError('');
    // Show what the school would issue next, so leaving the field blank is
    // an informed choice rather than a guess.
    setNextRegNumber('');
    api.get('/admin/students/next-registration-number')
      .then(r => setNextRegNumber(r.data?.registrationNumber || ''))
      .catch(() => setNextRegNumber(''));
  };

  const handleSaveRegNumber = async () => {
    setRegSaving(true);
    setRegError('');
    try {
      const res = await api.put(`/admin/students/${regDialog._id}/registration-number`, {
        registrationNumber: regValue.trim()
      });
      setSnack(`✓ Registration number set to ${res.data.registrationNumber}`);
      setRegDialog(null);
      loadStudents();
      if (selected?._id === regDialog._id) loadRecords(regDialog._id);
    } catch (err) {
      setRegError(err.response?.data?.message || 'Failed to save registration number');
    } finally {
      setRegSaving(false);
    }
  };

  const copyResultsLink = (student) => {
    const link = `${window.location.origin}/results?reg=${encodeURIComponent(student.registrationNumber)}`;
    navigator.clipboard?.writeText(link)
      .then(() => setSnack('✓ Results link copied to clipboard'))
      .catch(() => setSnack(link));
  };

  /** Whole-school booklet, unfiltered. The Performance tab offers filtered exports. */
  const downloadAllTranscripts = async () => {
    setDownloading(true);
    try {
      const name = await downloadFile('/admin/transcripts/export/pdf', {}, 'transcripts.pdf');
      setSnack(`✓ Downloaded ${name}`);
    } catch (err) {
      setSnack(err.message || 'Download failed');
    } finally {
      setDownloading(false);
    }
  };

  const downloadStudentTranscript = async (student) => {
    setDownloading(true);
    try {
      const name = await downloadFile('/admin/transcripts/export/pdf', { studentId: student._id }, 'transcript.pdf');
      setSnack(`✓ Downloaded ${name}`);
    } catch (err) {
      setSnack(err.message || 'Download failed');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}><CircularProgress sx={{ color: tokens.accent }} /></Box>;
  }
  if (loadError) {
    return <Box sx={{ p: 3 }}><Typography color="error">{loadError}</Typography></Box>;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, flexWrap: 'wrap', gap: 1.5 }}>
        <SectionTitle>Marks &amp; Transcripts</SectionTitle>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {tab === 'entry' && (
          <Button
            variant="outlined"
            startIcon={downloading ? <CircularProgress size={16} /> : <Download />}
            onClick={downloadAllTranscripts}
            disabled={downloading}
            sx={{ borderRadius: 2.5, fontWeight: 700, textTransform: 'none', borderColor: tokens.primary, color: tokens.primary }}
          >
            {downloading ? 'Preparing…' : 'Download all transcripts'}
          </Button>
        )}
        {missingRegNumbers > 0 && (
          <Button
            variant="outlined"
            startIcon={issuing ? <CircularProgress size={16} /> : <AutoFixHigh />}
            onClick={handleIssueMissing}
            disabled={issuing}
            sx={{ borderRadius: 2.5, fontWeight: 700, textTransform: 'none', borderColor: tokens.accent, color: tokens.accentDark }}
          >
            Issue numbers for {missingRegNumbers} student{missingRegNumbers === 1 ? '' : 's'}
          </Button>
        )}
        </Box>
      </Box>

      <Tabs
        value={tab}
        onChange={(e, v) => setTab(v)}
        sx={{
          mb: 2.5, minHeight: 0, borderBottom: `1px solid ${tokens.surfaceBorder}`,
          '& .MuiTab-root': { textTransform: 'none', fontWeight: 700, minHeight: 40, fontSize: 13.5, color: tokens.textMuted },
          '& .Mui-selected': { color: tokens.primary },
          '& .MuiTabs-indicator': { backgroundColor: tokens.accent, height: 3, borderRadius: 2 }
        }}
      >
        <Tab value="entry" label="Enter Marks" />
        <Tab value="analytics" label="Performance" />
      </Tabs>

      {tab === 'analytics' && <TranscriptAnalytics />}

      {tab === 'entry' && (
      <>

      <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'rgba(12,189,115,0.05)', mb: 2.5 }}>
        <Typography variant="body2" sx={{ color: tokens.textSecondary, fontFamily: "'DM Sans',sans-serif" }}>
          Pick a student, enter their subject marks for a term, and the system builds the transcript.
          Students read it at <strong>/results</strong> by typing their registration number — no login needed.
        </Typography>
      </Paper>

      <Grid container spacing={2.5}>
        {/* ── Student picker ── */}
        <Grid item xs={12} md={selected ? 5 : 12}>
          <Paper elevation={0} sx={{ borderRadius: 3, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white', overflow: 'hidden' }}>
            <Box sx={{ p: 1.75, borderBottom: `1px solid ${tokens.surfaceBorder}` }}>
              <TextField
                size="small" fullWidth placeholder="Search name, reg number, class…"
                value={search} onChange={e => setSearch(e.target.value)}
                InputProps={{
                  startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 18, color: tokens.textMuted }} /></InputAdornment>,
                  sx: { borderRadius: 2 }
                }}
              />
            </Box>
            <TableContainer sx={{ maxHeight: selected ? 560 : 'none', overflowX: 'auto' }}>
              <Table stickyHeader size="small" sx={{ minWidth: selected ? 380 : 700 }}>
                <TableHead>
                  <TableRow>
                    {['Student', 'Reg Number', ...(selected ? [] : ['Class']), 'Terms', ''].map(h => (
                      <TableCell key={h} sx={{ fontWeight: 700, fontSize: 11, color: tokens.textSecondary, bgcolor: '#F8FAFC', whiteSpace: 'nowrap' }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={5} align="center" sx={{ py: 5, color: tokens.textMuted }}>No students match your search.</TableCell></TableRow>
                  ) : filtered.map(s => (
                    <TableRow
                      key={s._id}
                      hover
                      selected={selected?._id === s._id}
                      onClick={() => openStudent(s)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                          <Avatar sx={{ width: 28, height: 28, fontSize: 12, fontWeight: 700, bgcolor: 'rgba(13,64,108,0.08)', color: tokens.primary }}>
                            {s.firstName?.charAt(0)?.toUpperCase()}
                          </Avatar>
                          <Box>
                            <Typography variant="body2" fontWeight={600} sx={{ lineHeight: 1.2 }}>{s.firstName} {s.lastName}</Typography>
                            <Typography variant="caption" sx={{ color: tokens.textMuted }}>{s.email}</Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        {s.registrationNumber
                          ? <Chip size="small" label={s.registrationNumber} sx={{ fontSize: 10.5, height: 20, fontWeight: 700, bgcolor: 'rgba(13,64,108,0.07)', color: tokens.primary }} />
                          : <Chip size="small" label="Not issued" sx={{ fontSize: 10.5, height: 20, bgcolor: 'rgba(245,158,11,0.12)', color: '#B45309' }} />}
                      </TableCell>
                      {!selected && (
                        <TableCell>
                          <Typography variant="caption" sx={{ color: tokens.textMuted }}>{s.class || '—'}</Typography>
                        </TableCell>
                      )}
                      <TableCell>
                        <Typography variant="body2" fontWeight={700} sx={{ color: s.recordsCount ? tokens.accentDark : tokens.textMuted }}>
                          {s.recordsCount}
                        </Typography>
                      </TableCell>
                      <TableCell align="right" onClick={e => e.stopPropagation()}>
                        <Tooltip title="Set registration number">
                          <IconButton size="small" onClick={() => openRegDialog(s)}><BadgeIcon sx={{ fontSize: 16, color: tokens.textMuted }} /></IconButton>
                        </Tooltip>
                        {s.registrationNumber && (
                          <Tooltip title="Copy results link">
                            <IconButton size="small" onClick={() => copyResultsLink(s)}><ContentCopy sx={{ fontSize: 15, color: tokens.textMuted }} /></IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        {/* ── Selected student's records ── */}
        {selected && (
          <Grid item xs={12} md={7}>
            <Paper elevation={0} sx={{ borderRadius: 3, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white', overflow: 'hidden' }}>
              <Box sx={{ p: 2, borderBottom: `1px solid ${tokens.surfaceBorder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                <Box>
                  <Typography fontWeight={700} sx={{ fontFamily: "'DM Sans',sans-serif", lineHeight: 1.2 }}>
                    {selected.firstName} {selected.lastName}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.6, mt: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
                    {selected.registrationNumber
                      ? <Chip size="small" label={selected.registrationNumber} sx={{ fontSize: 10.5, height: 20, fontWeight: 700, bgcolor: 'rgba(13,64,108,0.07)', color: tokens.primary }} />
                      : <Chip size="small" label="No reg number yet — one is issued on first save" sx={{ fontSize: 10.5, height: 20, bgcolor: 'rgba(245,158,11,0.12)', color: '#B45309' }} />}
                    {selected.class && <Chip size="small" label={selected.class} sx={{ fontSize: 10.5, height: 20, bgcolor: '#F1F5F9', color: tokens.textSecondary }} />}
                    {selected.registrationNumber && (
                      <Tooltip title="Open the student view of this transcript">
                        <IconButton
                          size="small"
                          onClick={() => window.open(`/results?reg=${encodeURIComponent(selected.registrationNumber)}`, '_blank', 'noopener')}
                        >
                          <OpenInNew sx={{ fontSize: 15, color: tokens.textMuted }} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {records.length > 0 && (
                    <Tooltip title="Download this student's transcript as a PDF">
                      <span>
                        <IconButton size="small" onClick={() => downloadStudentTranscript(selected)} disabled={downloading}>
                          <PictureAsPdf sx={{ fontSize: 18, color: downloading ? tokens.textMuted : '#B91C1C' }} />
                        </IconButton>
                      </span>
                    </Tooltip>
                  )}
                  <Button
                    variant="contained" size="small" startIcon={<Add />} onClick={openNewRecord}
                    sx={{ borderRadius: 2.5, fontWeight: 700, textTransform: 'none', background: gradients.brand, boxShadow: 'none' }}
                  >
                    Enter Marks
                  </Button>
                  <IconButton size="small" onClick={() => { setSelected(null); setRecords([]); }}><Close fontSize="small" /></IconButton>
                </Box>
              </Box>

              {recordsLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}><CircularProgress size={26} sx={{ color: tokens.accent }} /></Box>
              ) : records.length === 0 ? (
                <Box sx={{ py: 6, textAlign: 'center' }}>
                  <MenuBook sx={{ fontSize: 34, color: tokens.textMuted, mb: 1 }} />
                  <Typography variant="body2" sx={{ color: tokens.textMuted }}>
                    No marks recorded yet. Click <strong>Enter Marks</strong> to build this student&rsquo;s first transcript.
                  </Typography>
                </Box>
              ) : (
                <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {records.map(record => (
                    <Paper key={record._id} elevation={0} sx={{ borderRadius: 2.5, border: `1px solid ${tokens.surfaceBorder}`, overflow: 'hidden' }}>
                      <Box sx={{ px: 1.75, py: 1.25, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, flexWrap: 'wrap', bgcolor: '#F8FAFC' }}>
                        <Box>
                          <Typography variant="body2" fontWeight={700}>{record.term} · {record.academicYear}</Typography>
                          <Typography variant="caption" sx={{ color: tokens.textMuted }}>
                            {record.subjects?.length || 0} subject{record.subjects?.length === 1 ? '' : 's'}
                            {record.class ? ` · Class ${record.class}` : ''}
                            {record.position ? ` · Position ${record.position}${record.outOf ? `/${record.outOf}` : ''}` : ''}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                          {!record.isPublished && (
                            <Chip size="small" label="Draft" sx={{ height: 20, fontSize: 10, bgcolor: 'rgba(245,158,11,0.14)', color: '#B45309', fontWeight: 700 }} />
                          )}
                          <Chip
                            size="small"
                            label={`${record.percentage}% · ${record.grade}`}
                            sx={{ height: 22, fontSize: 11, fontWeight: 800, bgcolor: `${gradeColor(record.percentage)}1F`, color: gradeColor(record.percentage) }}
                          />
                          <IconButton size="small" onClick={() => openEditRecord(record)}><Edit sx={{ fontSize: 15, color: tokens.textMuted }} /></IconButton>
                          <IconButton size="small" onClick={() => setDeleteTarget(record)}><Delete sx={{ fontSize: 15, color: '#EF4444' }} /></IconButton>
                        </Box>
                      </Box>
                      <TableContainer sx={{ overflowX: 'auto' }}>
                        <Table size="small" sx={{ minWidth: 380 }}>
                          <TableBody>
                            {(record.subjects || []).map(s => (
                              <TableRow key={s._id || s.name}>
                                <TableCell sx={{ fontSize: 12.5, border: 0, py: 0.6 }}>{s.name}</TableCell>
                                <TableCell sx={{ fontSize: 12.5, border: 0, py: 0.6, fontWeight: 700, whiteSpace: 'nowrap' }}>
                                  {s.marks} / {s.maxMarks}
                                </TableCell>
                                <TableCell sx={{ fontSize: 12.5, border: 0, py: 0.6, color: gradeColor(s.percentage), fontWeight: 700, whiteSpace: 'nowrap' }}>
                                  {s.percentage}% ({s.grade})
                                </TableCell>
                                <TableCell sx={{ fontSize: 12, border: 0, py: 0.6, color: tokens.textMuted }}>{s.remark || ''}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Paper>
                  ))}
                </Box>
              )}
            </Paper>
          </Grid>
        )}
      </Grid>

      </>
      )}

      {/* ── Marks entry dialog ── */}
      <Dialog open={formOpen} onClose={() => !saving && setFormOpen(false)} maxWidth="lg" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700, fontFamily: "'DM Sans',sans-serif", display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            {form.recordId ? 'Edit marks' : 'Enter marks'}
            <Typography variant="caption" sx={{ display: 'block', color: tokens.textMuted, fontWeight: 400 }}>
              {selected?.firstName} {selected?.lastName}
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setFormOpen(false)} disabled={saving}><Close fontSize="small" /></IconButton>
        </DialogTitle>

        <DialogContent dividers>
          <Grid container spacing={1.5} sx={{ mb: 2 }}>
            <Grid item xs={12} sm={3}>
              <TextField
                fullWidth size="small" label="Academic year" placeholder="2025-2026"
                value={form.academicYear} onChange={e => setForm(f => ({ ...f, academicYear: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <Select
                fullWidth size="small" value={form.term}
                onChange={e => setForm(f => ({ ...f, term: e.target.value }))}
              >
                {TERMS.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
              </Select>
            </Grid>
            <Grid item xs={6} sm={2}>
              <TextField fullWidth size="small" label="Class" value={form.class} onChange={e => setForm(f => ({ ...f, class: e.target.value }))} />
            </Grid>
            <Grid item xs={3} sm={2}>
              <TextField fullWidth size="small" type="number" label="Position" value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))} />
            </Grid>
            <Grid item xs={3} sm={2}>
              <TextField fullWidth size="small" type="number" label="Out of" value={form.outOf} onChange={e => setForm(f => ({ ...f, outOf: e.target.value }))} />
            </Grid>
          </Grid>

          <Divider sx={{ mb: 2 }} />

          {/* Subject rows */}
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table size="small" sx={{ minWidth: 780 }}>
              <TableHead>
                <TableRow>
                  {['Subject *', 'Code', 'Marks *', 'Out of', 'Coef.', '%', 'Remark', ''].map(h => (
                    <TableCell key={h} sx={{ fontWeight: 700, fontSize: 11, color: tokens.textSecondary, whiteSpace: 'nowrap' }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {form.subjects.map((s, i) => {
                  const pct = s.marks === '' ? null : pctOf(s.marks, s.maxMarks);
                  const over = s.marks !== '' && Number(s.marks) > Number(s.maxMarks);
                  return (
                    <TableRow key={i}>
                      <TableCell sx={{ minWidth: 160 }}>
                        <TextField fullWidth size="small" placeholder="Mathematics" value={s.name} onChange={e => setSubject(i, 'name', e.target.value)} />
                      </TableCell>
                      <TableCell sx={{ width: 90 }}>
                        <TextField fullWidth size="small" placeholder="MAT" value={s.code} onChange={e => setSubject(i, 'code', e.target.value)} />
                      </TableCell>
                      <TableCell sx={{ width: 92 }}>
                        <TextField
                          fullWidth size="small" type="number" value={s.marks} error={over}
                          onChange={e => setSubject(i, 'marks', e.target.value)}
                        />
                      </TableCell>
                      <TableCell sx={{ width: 92 }}>
                        <TextField fullWidth size="small" type="number" value={s.maxMarks} onChange={e => setSubject(i, 'maxMarks', e.target.value)} />
                      </TableCell>
                      <TableCell sx={{ width: 78 }}>
                        <TextField fullWidth size="small" type="number" value={s.coefficient} onChange={e => setSubject(i, 'coefficient', e.target.value)} />
                      </TableCell>
                      <TableCell sx={{ width: 80, whiteSpace: 'nowrap' }}>
                        {pct === null ? (
                          <Typography variant="caption" sx={{ color: tokens.textMuted }}>—</Typography>
                        ) : over ? (
                          <Typography variant="caption" sx={{ color: '#EF4444', fontWeight: 700 }}>too high</Typography>
                        ) : (
                          <Typography variant="body2" fontWeight={700} sx={{ color: gradeColor(pct) }}>
                            {pct}% {gradeLetter(pct)}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ minWidth: 140 }}>
                        <TextField fullWidth size="small" placeholder="optional" value={s.remark} onChange={e => setSubject(i, 'remark', e.target.value)} />
                      </TableCell>
                      <TableCell sx={{ width: 40 }}>
                        <IconButton size="small" onClick={() => removeSubjectRow(i)} disabled={form.subjects.length === 1}>
                          <Delete sx={{ fontSize: 16, color: form.subjects.length === 1 ? tokens.textMuted : '#EF4444' }} />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>

          <Button size="small" startIcon={<Add />} onClick={addSubjectRow} sx={{ mt: 1, textTransform: 'none', fontWeight: 700, color: tokens.accentDark }}>
            Add subject
          </Button>

          <Divider sx={{ my: 2 }} />

          <Grid container spacing={1.5} alignItems="center">
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth size="small" multiline minRows={2} label="School remarks (shown on the transcript)"
                value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControlLabel
                control={<Switch checked={form.isPublished} onChange={e => setForm(f => ({ ...f, isPublished: e.target.checked }))} />}
                label={<Typography variant="body2">{form.isPublished ? 'Visible on /results' : 'Draft — hidden from student'}</Typography>}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <Paper elevation={0} sx={{ p: 1.5, borderRadius: 2.5, border: `1px solid ${tokens.surfaceBorder}`, textAlign: 'center', bgcolor: '#F8FAFC' }}>
                <Typography variant="caption" sx={{ color: tokens.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Term total
                </Typography>
                <Typography sx={{ fontWeight: 800, fontSize: 22, color: preview.filled ? gradeColor(preview.overall) : tokens.textMuted, lineHeight: 1.2 }}>
                  {preview.filled ? `${preview.overall}%` : '—'}
                </Typography>
                <Typography variant="caption" sx={{ color: tokens.textMuted }}>
                  {preview.filled ? `${preview.total} / ${preview.max} · Grade ${preview.grade}` : 'Enter marks to preview'}
                </Typography>
              </Paper>
            </Grid>
          </Grid>

          {formError && <Alert severity="error" sx={{ mt: 2, borderRadius: 2 }}>{formError}</Alert>}
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setFormOpen(false)} disabled={saving} sx={{ textTransform: 'none', color: tokens.textSecondary }}>Cancel</Button>
          <Button
            variant="contained" onClick={handleSave} disabled={saving}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Save />}
            sx={{ borderRadius: 2.5, fontWeight: 700, textTransform: 'none', background: gradients.brand, boxShadow: 'none' }}
          >
            {saving ? 'Saving…' : form.recordId ? 'Update marks' : 'Save marks'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Registration number dialog ── */}
      <Dialog open={!!regDialog} onClose={() => !regSaving && setRegDialog(null)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700, fontFamily: "'DM Sans',sans-serif" }}>Registration number</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: tokens.textMuted, mb: 2 }}>
            {regDialog?.firstName} {regDialog?.lastName} uses this number to open their transcript on /results.
            Leave it blank to have the system issue the next one for your school.
          </Typography>
          <TextField
            fullWidth size="small" label="Registration number" placeholder="Leave blank to auto-generate"
            value={regValue} onChange={e => setRegValue(e.target.value)}
            inputProps={{ maxLength: 30 }}
            helperText={nextRegNumber ? `Next auto-generated number: ${nextRegNumber}` : ' '}
          />
          {regError && <Alert severity="error" sx={{ mt: 2, borderRadius: 2 }}>{regError}</Alert>}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setRegDialog(null)} disabled={regSaving} sx={{ textTransform: 'none', color: tokens.textSecondary }}>Cancel</Button>
          <Button
            variant="contained" onClick={handleSaveRegNumber} disabled={regSaving}
            sx={{ borderRadius: 2.5, fontWeight: 700, textTransform: 'none', background: gradients.brand, boxShadow: 'none' }}
          >
            {regSaving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Delete confirmation ── */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700, fontFamily: "'DM Sans',sans-serif" }}>Delete these marks?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: tokens.textSecondary }}>
            {deleteTarget?.term} · {deleteTarget?.academicYear} will be removed from this student&rsquo;s transcript. This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setDeleteTarget(null)} sx={{ textTransform: 'none', color: tokens.textSecondary }}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDeleteRecord} sx={{ borderRadius: 2.5, fontWeight: 700, textTransform: 'none', boxShadow: 'none' }}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!snack} autoHideDuration={4000} onClose={() => setSnack('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setSnack('')} severity={snack.startsWith('✓') ? 'success' : 'error'} sx={{ borderRadius: 2 }}>{snack}</Alert>
      </Snackbar>
    </Box>
  );
}
