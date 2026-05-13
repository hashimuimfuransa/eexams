import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Box, Typography, Chip, Button, Paper, Grid, TextField,
  CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  InputAdornment, useMediaQuery, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, LinearProgress,
  IconButton, Tooltip, Avatar, Select, MenuItem, FormControl, InputLabel,
  Tabs, Tab, Alert, Snackbar, Accordion, AccordionSummary, AccordionDetails,
  Divider
} from '@mui/material';
import {
  AutoAwesome, CloudUpload, Assignment, People, BarChart, Settings,
  CheckCircle, Add, Publish, Share, Description,
  DashboardCustomize, FormatListNumbered, ShortText, ToggleOn,
  FileUpload, School, TrendingUp, ArrowForward,
  Quiz, ListAlt, NoteAlt, Delete, Edit, ContentCopy, Download,
  ExpandMore, Search, FilterList, Refresh, CheckCircleOutline,
  ErrorOutline, HourglassEmpty, PlayArrow, SaveAlt, Close
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { tokens, gradients } from './dashboardTokens';
import { DashboardShell, Sidebar, Topbar, SectionTitle, W } from './DashboardShell';

const nav = [
  { id: 'home',      label: 'Dashboard',  icon: <DashboardCustomize sx={{ fontSize: 20 }} /> },
  { id: 'exams',     label: 'My Exams',   icon: <Assignment sx={{ fontSize: 20 }} /> },
  { id: 'students',  label: 'Students',   icon: <People sx={{ fontSize: 20 }} /> },
  { id: 'questions', label: 'Questions',  icon: <Quiz sx={{ fontSize: 20 }} /> },
  { id: 'results',   label: 'Results',    icon: <ListAlt sx={{ fontSize: 20 }} /> },
  { id: 'reports',   label: 'Reports',    icon: <NoteAlt sx={{ fontSize: 20 }} /> },
  { id: 'templates', label: 'Templates',  icon: <Description sx={{ fontSize: 20 }} /> },
  { id: 'analytics', label: 'Analytics',  icon: <BarChart sx={{ fontSize: 20 }} /> },
  { id: 'settings',  label: 'Settings',   icon: <Settings sx={{ fontSize: 20 }} /> },
];

/* ── Sparkline ── */
function Sparkline({ color = tokens.accent, values = [40,55,45,65,60,75,70] }) {
  const w = 80, h = 32;
  const max = Math.max(...values), min = Math.min(...values), range = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - ((v - min) / range) * (h - 6) - 3}`).join(' ');
  return (
    <svg width={w} height={h}><polyline fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={pts} /></svg>
  );
}

/* ── Area chart ── */
function AreaChart({ data = [], color = tokens.accent }) {
  if (!data.length || data.length < 2) data = [50,60,45,75,65,80,72];
  const w = 380, h = 110;
  const max = Math.max(...data) || 100;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * (h - 12) - 6}`).join(' ');
  const area = `${pts} ${w},${h} 0,${h}`;
  const labels = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  return (
    <svg viewBox={`0 0 ${w} ${h + 22}`} style={{ width: '100%', height: 140 }}>
      <defs>
        <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[0,25,50,75,100].map(y => <line key={y} x1="0" x2={w} y1={h-(y/100)*(h-12)-6} y2={h-(y/100)*(h-12)-6} stroke="#E2E8F0" strokeWidth="1" />)}
      {[0,25,50,75,100].map(y => <text key={y} x={-4} y={h-(y/100)*(h-12)-4} textAnchor="end" fontSize="9" fill={tokens.textMuted}>{y}%</text>)}
      <polygon points={area} fill="url(#ag)" />
      <polyline fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={pts} />
      {data.map((v, i) => { const cx = (i/(data.length-1))*w, cy = h-(v/max)*(h-12)-6; return <circle key={i} cx={cx} cy={cy} r="4" fill="white" stroke={color} strokeWidth="2" />; })}
      {labels.slice(0, data.length).map((l, i) => <text key={i} x={(i/(Math.max(data.length,1)-1))*w} y={h+18} textAnchor="middle" fontSize="10" fill={tokens.textMuted}>{l}</text>)}
    </svg>
  );
}

/* ── Donut ── */
function DonutChart({ data, total }) {
  const size = 110, stroke = 18, r = (size - stroke) / 2, circ = 2 * Math.PI * r;
  let off = 0;
  const segs = data.map(d => { const pct = total > 0 ? d.count / total : 0; const s = { ...d, dash: `${pct * circ} ${circ}`, off }; off += pct * circ; return s; });
  return (
    <Box sx={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#F1F5F9" strokeWidth={stroke} />
        {segs.map((s, i) => <circle key={i} cx={size/2} cy={size/2} r={r} fill="none" stroke={s.color} strokeWidth={stroke} strokeDasharray={s.dash} strokeDashoffset={-s.off} strokeLinecap="round" />)}
      </svg>
      <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <Typography fontWeight={800} sx={{ fontSize: 20, color: tokens.textPrimary, lineHeight: 1, fontFamily: "'DM Sans',sans-serif" }}>{total}</Typography>
        <Typography sx={{ fontSize: 10, color: tokens.textMuted, fontFamily: "'DM Sans',sans-serif" }}>Total</Typography>
      </Box>
    </Box>
  );
}

/* ── Main ── */
export default function TeacherDashboard() {
  const isMobile = useMediaQuery('(max-width:900px)');
  const isXs = useMediaQuery('(max-width:600px)');
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const [activeSection, setActiveSection] = useState('home');
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [exams, setExams] = useState([]);
  const [results, setResults] = useState([]);

  useEffect(() => {
    api.get('/admin/dashboard-stats').then(r => setStats(r.data)).catch(() => setStats({})).finally(() => setStatsLoading(false));
    api.get('/admin/exams').then(r => setExams(r.data || [])).catch(() => {});
    api.get('/admin/results').then(r => setResults(Array.isArray(r.data) ? r.data : (r.data?.results || []))).catch(() => {});
  }, []);

  return (
    <DashboardShell
      sidebarEl={<Sidebar user={user} logout={logout} activeSection={activeSection} setActiveSection={setActiveSection} onClose={() => setSidebarOpen(false)} isMobile={isMobile} nav={nav} portalLabel="Teacher Portal" logoIcon={<School sx={{ color: 'white', fontSize: 20 }} />} />}
      topbarEl={<Topbar greeting={`Good morning, ${user?.firstName || 'Teacher'} 👋`} sub="Here's what's happening with your exams today." user={user} onMenuClick={() => setSidebarOpen(v => !v)} onLogout={logout} roleLabel="Teacher" isXs={isXs} />}
      sidebarOpen={sidebarOpen} isMobile={isMobile} onCloseSidebar={() => setSidebarOpen(false)}>
      {activeSection === 'home'      && <HomeSection stats={stats} statsLoading={statsLoading} exams={exams} results={results} />}
      {activeSection === 'exams'     && <ExamsSection exams={exams} setExams={setExams} />}
      {activeSection === 'students'  && <StudentsSection />}
      {activeSection === 'questions' && <QuestionsSection />}
      {activeSection === 'results'   && <ResultsSection results={results} />}
      {activeSection === 'reports'   && <ReportsSection />}
      {activeSection === 'templates' && <TemplatesSection exams={exams} setExams={setExams} />}
      {activeSection === 'analytics' && <AnalyticsSection results={results} exams={exams} />}
      {activeSection === 'settings'  && <SettingsSection user={user} />}
    </DashboardShell>
  );
}

/* ── HOME ── */
function HomeSection({ stats, statsLoading, exams, results }) {
  const isXs = useMediaQuery('(max-width:600px)');
  const [aiMode, setAiMode] = useState('describe');
  const [manualExam, setManualExam] = useState({ title: '', description: 'Exam', timeLimit: 60, passingScore: 70, sections: [{ name: 'A', description: 'Section A', questions: [] }] });
  const [manualSection, setManualSection] = useState(0);
  const [manualQ, setManualQ] = useState({ text: '', type: 'multiple-choice', points: 2, difficulty: 'medium', options: [{ text: '', isCorrect: false, letter: 'A' }, { text: '', isCorrect: false, letter: 'B' }, { text: '', isCorrect: false, letter: 'C' }, { text: '', isCorrect: false, letter: 'D' }], correctAnswer: '' });
  const [manualPublishing, setManualPublishing] = useState(false);
  const [manualError, setManualError] = useState('');
  const [prompt, setPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [generated, setGenerated] = useState(null);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadAnswer, setUploadAnswer] = useState(null);
  const [publishExamId, setPublishExamId] = useState(null);
  const fileRef = useRef();
  const ansRef = useRef();

  const qDist = [
    { label: 'Multiple Choice', color: tokens.accent,  count: stats?.questionTypes?.multiple_choice ?? 8 },
    { label: 'True / False',    color: '#6366F1',       count: stats?.questionTypes?.true_false ?? 4 },
    { label: 'Fill in the Blank', color: tokens.warning, count: stats?.questionTypes?.fill_blank ?? 2 },
    { label: 'Open Question',   color: '#EC4899',       count: stats?.questionTypes?.open_question ?? 1 },
  ];
  const qTotal = qDist.reduce((s, q) => s + q.count, 0);
  const perfData = results.slice(-7).map(r => Math.round(r.percentage ?? 0));
  const avgPerf = perfData.length ? Math.round(perfData.reduce((a, b) => a + b, 0) / perfData.length) : (stats?.avgScore ? Math.round(stats.avgScore) : 78);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setAiLoading(true); setAiError('');
    try { const res = await api.post('/exam/ai-generate', { prompt }, { timeout: 90000 }); setGenerated(res.data); }
    catch (err) { setAiError(err.response?.data?.message || 'AI generation failed.'); }
    finally { setAiLoading(false); }
  };

  const handleUpload = async () => {
    if (!uploadFile) return;
    setAiLoading(true); setAiError('');
    try {
      const fd = new FormData();
      fd.append('examFile', uploadFile);
      if (uploadAnswer) fd.append('answerFile', uploadAnswer);
      const res = await api.post('/admin/exams', fd, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 90000 });
      setGenerated(res.data);
    } catch (err) { setAiError(err.response?.data?.message || 'Upload failed.'); }
    finally { setAiLoading(false); }
  };

  const handlePublish = async () => {
    try { const res = await api.post('/admin/exams', generated); setPublishExamId(res.data._id); setGenerated(null); } catch {}
  };

  const addManualQuestion = () => {
    if (!manualQ.text.trim()) return;
    const q = { ...manualQ };
    if (q.type === 'true-false') { q.options = [{ text: 'True', isCorrect: q.correctAnswer === 'True', letter: 'A' }, { text: 'False', isCorrect: q.correctAnswer === 'False', letter: 'B' }]; }
    setManualExam(p => { const secs = [...p.sections]; secs[manualSection] = { ...secs[manualSection], questions: [...(secs[manualSection].questions || []), q] }; return { ...p, sections: secs }; });
    setManualQ({ text: '', type: 'multiple-choice', points: 2, difficulty: 'medium', options: [{ text: '', isCorrect: false, letter: 'A' }, { text: '', isCorrect: false, letter: 'B' }, { text: '', isCorrect: false, letter: 'C' }, { text: '', isCorrect: false, letter: 'D' }], correctAnswer: '' });
  };

  const removeManualQuestion = (secIdx, qIdx) => {
    setManualExam(p => { const secs = [...p.sections]; secs[secIdx].questions = secs[secIdx].questions.filter((_, i) => i !== qIdx); return { ...p, sections: secs }; });
  };

  const handleManualPublish = async () => {
    if (!manualExam.title.trim()) { setManualError('Please enter an exam title.'); return; }
    const total = manualExam.sections.reduce((s, sec) => s + (sec.questions?.length || 0), 0);
    if (total === 0) { setManualError('Add at least one question before publishing.'); return; }
    setManualPublishing(true); setManualError('');
    try {
      const res = await api.post('/admin/exams', manualExam);
      setPublishExamId(res.data._id);
      setManualExam({ title: '', description: 'Exam', timeLimit: 60, passingScore: 70, sections: [{ name: 'A', description: 'Section A', questions: [] }] });
      setManualSection(0);
    } catch (err) { setManualError(err.response?.data?.message || 'Publish failed.'); }
    finally { setManualPublishing(false); }
  };

  const statCards = [
    { label: 'Exams Created',  value: stats?.totalExams    ?? 0,    sub: '+3 this week',  subColor: tokens.accent,  iconBg: 'rgba(12,189,115,0.1)',  icon: <Assignment sx={{ color: tokens.accent, fontSize: { xs: 20, sm: 24 } }} />,  spark: [5,8,6,10,9,12,10] },
    { label: 'Total Students', value: stats?.totalStudents ?? 0,    sub: '+18 this week', subColor: '#6366F1',       iconBg: 'rgba(99,102,241,0.1)',  icon: <People sx={{ color: '#6366F1', fontSize: { xs: 20, sm: 24 } }} />,           spark: [200,220,230,240,244,246,248] },
    { label: 'Average Score',  value: `${Math.round(stats?.avgScore ?? 0)}%`, sub: '+6% this week', subColor: tokens.warning, iconBg: 'rgba(245,158,11,0.1)', icon: <BarChart sx={{ color: tokens.warning, fontSize: { xs: 20, sm: 24 } }} />, spark: [65,70,68,75,72,78,75] },
    { label: 'Active Exams',   value: stats?.activeExams   ?? 0,    sub: '2 ending soon', subColor: '#EC4899',       iconBg: 'rgba(236,72,153,0.1)',  icon: <TrendingUp sx={{ color: '#EC4899', fontSize: { xs: 20, sm: 24 } }} />,        spark: [2,3,4,5,4,6,5] },
  ];

  return (
    <Box>
      {/* Stat cards with sparkline */}
      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        {statCards.map((s, i) => (
          <Grid item xs={6} md={3} key={i}>
            <Paper elevation={0} sx={{ p: { xs: 1.5, sm: 2.5 }, borderRadius: 3, bgcolor: 'white', border: `1px solid ${tokens.surfaceBorder}`, transition: 'box-shadow 0.2s,transform 0.15s', '&:hover': { boxShadow: '0 6px 24px rgba(13,64,108,0.09)', transform: 'translateY(-1px)' } }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1.5 }}>
                <Box sx={{ width: { xs: 38, sm: 48 }, height: { xs: 38, sm: 48 }, borderRadius: 2.5, bgcolor: s.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{s.icon}</Box>
                <Box sx={{ display: { xs: 'none', sm: 'block' } }}><Sparkline color={s.subColor} values={s.spark} /></Box>
              </Box>
              {statsLoading ? <CircularProgress size={20} sx={{ color: tokens.accent }} /> :
                <Typography fontWeight={800} sx={{ color: tokens.textPrimary, fontFamily: "'DM Sans',sans-serif", lineHeight: 1, fontSize: { xs: '1.25rem', sm: '1.5rem', md: '2.125rem' } }}>{s.value}</Typography>}
              <Typography sx={{ fontSize: { xs: 11, sm: 12.5 }, color: tokens.textMuted, fontFamily: "'DM Sans',sans-serif", mt: 0.25 }} noWrap>{s.label}</Typography>
              <Typography sx={{ fontSize: { xs: 10.5, sm: 11.5 }, color: s.subColor, fontWeight: 600, fontFamily: "'DM Sans',sans-serif", mt: 0.35 }} noWrap>{s.sub}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* AI Creator */}
      <Paper elevation={0} sx={{ borderRadius: 3, overflow: 'hidden', mb: 2.5, border: `1px solid ${tokens.surfaceBorder}` }}>
        <Box sx={{ px: 3, py: 2.25, background: gradients.brand, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ width: 42, height: 42, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AutoAwesome sx={{ color: 'white', fontSize: 22 }} />
            </Box>
            <Box>
              <Typography fontWeight={700} color="white" sx={{ fontSize: 16, fontFamily: "'DM Sans',sans-serif" }}>AI Exam Creator</Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.8)', fontSize: 12.5, fontFamily: "'DM Sans',sans-serif" }}>Describe your exam or upload a document — AI builds it for you</Typography>
            </Box>
          </Box>
          <Button variant="outlined" sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.55)', borderRadius: 2.5, fontWeight: 700, fontSize: 13, textTransform: 'none', px: 2.5, fontFamily: "'DM Sans',sans-serif", '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}>
            View Templates
          </Button>
        </Box>

        <Box sx={{ display: 'flex', bgcolor: 'white', borderBottom: `1px solid ${tokens.surfaceBorder}` }}>
          {[{ key: 'describe', label: '✏  AI Describe' }, { key: 'upload', label: '☁  Upload Doc' }, { key: 'manual', label: '✍  Manual Build' }].map(tab => (
            <Button key={tab.key} onClick={() => setAiMode(tab.key)} sx={{ flex: 1, py: 1.5, fontWeight: 600, fontSize: { xs: 11, sm: 13 }, textTransform: 'none', borderRadius: 0, fontFamily: "'DM Sans',sans-serif", borderBottom: aiMode === tab.key ? `2.5px solid ${tokens.primary}` : '2.5px solid transparent', color: aiMode === tab.key ? tokens.primary : tokens.textMuted }}>
              {tab.label}
            </Button>
          ))}
        </Box>

        <Box sx={{ p: 3, bgcolor: 'white' }}>
          {aiMode === 'manual' ? (
            <ManualExamBuilder
              exam={manualExam} setExam={setManualExam}
              sectionIdx={manualSection} setSectionIdx={setManualSection}
              question={manualQ} setQuestion={setManualQ}
              onAddQuestion={addManualQuestion}
              onRemoveQuestion={removeManualQuestion}
              onPublish={handleManualPublish}
              publishing={manualPublishing}
              error={manualError}
            />
          ) : aiMode === 'describe' ? (
            <>
              <TextField fullWidth multiline minRows={2} maxRows={5} placeholder="e.g. Biology exam for Grade 10 covering cell division and photosynthesis…"
                value={prompt} onChange={e => setPrompt(e.target.value)}
                sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2, fontFamily: "'DM Sans',sans-serif", bgcolor: '#FAFBFC', fontSize: 14 } }} />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                {['+ Add Topic', '🎓 Grade Level', '≡ Question Type', '··· More Options'].map((b, i) => (
                  <Button key={i} size="small" sx={{ borderRadius: 2, color: tokens.textSecondary, bgcolor: '#F1F5F9', fontFamily: "'DM Sans',sans-serif", fontSize: 12, textTransform: 'none', px: 1.5, '&:hover': { bgcolor: '#E2E8F0' } }}>{b}</Button>
                ))}
                <Box sx={{ flexGrow: 1 }} />
                <Button variant="contained" startIcon={aiLoading ? <CircularProgress size={16} color="inherit" /> : <AutoAwesome />}
                  onClick={handleGenerate} disabled={aiLoading || !prompt.trim()}
                  sx={{ borderRadius: 2.5, fontWeight: 700, px: 3, textTransform: 'none', background: gradients.brand, boxShadow: 'none', fontFamily: "'DM Sans',sans-serif", '&:hover': { boxShadow: '0 4px 14px rgba(12,189,115,0.35)' } }}>
                  {aiLoading ? 'Generating…' : '✦ Generate Exam'}
                </Button>
              </Box>
              {aiError && <Box sx={{ mt: 2, p: 1.5, borderRadius: 2, bgcolor: 'rgba(239,68,68,0.07)', color: '#EF4444', fontSize: 13 }}>{aiError}</Box>}
            </>
          ) : (
            <>
              <Grid container spacing={2} sx={{ mb: 2 }}>
                {[{ ref: fileRef, file: uploadFile, set: setUploadFile, label: 'Upload Exam Document', sub: 'PDF, Word or TXT' },
                  { ref: ansRef, file: uploadAnswer, set: setUploadAnswer, label: 'Upload Answer Sheet', sub: 'Optional' }].map((item, i) => (
                  <Grid item xs={12} md={6} key={i}>
                    <Paper onClick={() => item.ref.current.click()} elevation={0} sx={{ p: 3, borderRadius: 3, textAlign: 'center', cursor: 'pointer', border: `2px dashed ${item.file ? tokens.accent : tokens.surfaceBorder}`, bgcolor: item.file ? 'rgba(12,189,115,0.03)' : '#FAFBFC', '&:hover': { borderColor: tokens.accent } }}>
                      <input ref={item.ref} type="file" hidden accept=".pdf,.doc,.docx,.txt" onChange={e => item.set(e.target.files[0])} />
                      {item.file ? <><CheckCircle sx={{ color: tokens.accent, fontSize: 32, mb: 0.5 }} /><Typography variant="body2" fontWeight={600}>{item.file.name}</Typography></> :
                        <><FileUpload sx={{ color: tokens.textMuted, fontSize: 32, mb: 0.5 }} /><Typography variant="body2" fontWeight={600} sx={{ color: tokens.textPrimary }}>{item.label}</Typography><Typography variant="caption" sx={{ color: tokens.textMuted }}>{item.sub}</Typography></>}
                    </Paper>
                  </Grid>
                ))}
              </Grid>
              {aiError && <Box sx={{ mb: 2, p: 1.5, borderRadius: 2, bgcolor: 'rgba(239,68,68,0.07)', color: '#EF4444', fontSize: 13 }}>{aiError}</Box>}
              <Button variant="contained" startIcon={aiLoading ? <CircularProgress size={16} color="inherit" /> : <CloudUpload />} onClick={handleUpload} disabled={aiLoading || !uploadFile}
                sx={{ borderRadius: 2.5, fontWeight: 700, px: 3, textTransform: 'none', background: gradients.brand, boxShadow: 'none', fontFamily: "'DM Sans',sans-serif" }}>
                {aiLoading ? 'Processing…' : 'Process & Generate'}
              </Button>
            </>
          )}
        </Box>
      </Paper>


      {/* Generated editor */}
      {generated && (
        <Paper elevation={0} sx={{ mb: 2.5, borderRadius: 3, border: `1.5px solid ${tokens.accent}`, overflow: 'hidden' }}>
          <Box sx={{ px: 3, py: 2, background: gradients.accent, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <CheckCircle sx={{ color: 'white' }} />
              <Box><Typography fontWeight={700} color="white" sx={{ fontFamily: "'DM Sans',sans-serif" }}>Exam Generated!</Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.85)', fontFamily: "'DM Sans',sans-serif" }}>Review then publish</Typography></Box>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button size="small" onClick={() => setGenerated(null)} sx={{ color: 'white', border: '1px solid rgba(255,255,255,0.5)', borderRadius: 2, textTransform: 'none' }}>Discard</Button>
              <Button size="small" variant="contained" onClick={handlePublish} sx={{ bgcolor: 'white', color: tokens.accentDark, fontWeight: 700, borderRadius: 2, textTransform: 'none' }}>Publish</Button>
            </Box>
          </Box>
          <Box sx={{ p: 3, bgcolor: 'white' }}>
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={8}><TextField label="Exam Title" fullWidth size="small" value={generated?.title || ''} onChange={e => setGenerated(p => ({ ...p, title: e.target.value }))} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} /></Grid>
              <Grid item xs={4}><TextField label="Time (min)" type="number" fullWidth size="small" value={generated?.timeLimit || 60} onChange={e => setGenerated(p => ({ ...p, timeLimit: +e.target.value }))} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} /></Grid>
            </Grid>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, maxHeight: 300, overflow: 'auto' }}>
              {(generated?.questions || []).map((q, idx) => (
                <Paper key={idx} elevation={0} sx={{ p: 1.75, borderRadius: 2, border: `1px solid ${tokens.surfaceBorder}`, borderLeft: `3px solid ${tokens.accent}`, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip label={`Q${idx + 1}`} size="small" sx={{ bgcolor: 'rgba(12,189,115,0.1)', color: tokens.accentDark, fontWeight: 700 }} />
                  <Typography variant="body2" sx={{ flexGrow: 1, fontFamily: "'DM Sans',sans-serif" }} noWrap>{q.text}</Typography>
                </Paper>
              ))}
            </Box>
          </Box>
        </Paper>
      )}

      {/* 3-col bottom row */}
      <Grid container spacing={2.5}>
        {/* Donut */}
        <Grid item xs={12} sm={6} md={4}>
          <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white', height: '100%' }}>
            <SectionTitle>Question Types &amp; Counts</SectionTitle>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5 }}>
              <DonutChart data={qDist} total={qTotal} />
              <Box sx={{ flexGrow: 1 }}>
                {qDist.map((q, i) => (
                  <Box key={i} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: q.color, flexShrink: 0 }} />
                      <Typography sx={{ fontSize: 12, color: tokens.textSecondary, fontFamily: "'DM Sans',sans-serif" }}>{q.label}</Typography>
                    </Box>
                    <Typography fontWeight={700} sx={{ fontSize: 12, color: tokens.textPrimary, fontFamily: "'DM Sans',sans-serif" }}>{q.count}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>
            <Button fullWidth size="small" endIcon={<ArrowForward fontSize="small" />}
              sx={{ mt: 2, color: tokens.accent, fontWeight: 600, fontSize: 12, textTransform: 'none', fontFamily: "'DM Sans',sans-serif", bgcolor: 'rgba(12,189,115,0.05)', borderRadius: 2, py: 1, '&:hover': { bgcolor: 'rgba(12,189,115,0.1)' } }}>
              Manage Question Types
            </Button>
          </Paper>
        </Grid>

        {/* Recent Exams */}
        <Grid item xs={12} sm={6} md={4}>
          <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white', height: '100%' }}>
            <SectionTitle action={<Button size="small" sx={{ color: tokens.accent, fontWeight: 700, fontSize: 12, textTransform: 'none' }}>View All</Button>}>Recent Exams</SectionTitle>
            {exams.length === 0
              ? <Box sx={{ py: 4, textAlign: 'center' }}><Typography sx={{ color: tokens.textMuted, fontSize: 13 }}>No exams yet.</Typography></Box>
              : exams.slice(0, 3).map((e, i) => {
                  const sc = e.status === 'active' ? tokens.accent : e.status === 'draft' ? tokens.warning : '#6366F1';
                  return (
                    <Box key={e._id || i} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1.5, borderBottom: i < 2 ? `1px solid ${tokens.surfaceBorder}` : 'none' }}>
                      <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: 'rgba(12,189,115,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Assignment sx={{ fontSize: 18, color: tokens.accent }} />
                      </Box>
                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={600} noWrap sx={{ fontFamily: "'DM Sans',sans-serif" }}>{e.title}</Typography>
                        <Typography variant="caption" sx={{ color: tokens.textMuted }}>{e.questions?.length || 0} Questions</Typography>
                      </Box>
                      <Chip label={e.status || 'draft'} size="small" sx={{ bgcolor: `${sc}14`, color: sc, fontWeight: 600, fontSize: 11, textTransform: 'capitalize' }} />
                    </Box>
                  );
                })}
            <Button fullWidth size="small" endIcon={<ArrowForward fontSize="small" />}
              sx={{ mt: 2, color: tokens.accent, fontWeight: 600, fontSize: 12, textTransform: 'none', fontFamily: "'DM Sans',sans-serif", bgcolor: 'rgba(12,189,115,0.05)', borderRadius: 2, py: 1, '&:hover': { bgcolor: 'rgba(12,189,115,0.1)' } }}>
              View All Exams
            </Button>
          </Paper>
        </Grid>

        {/* Performance Overview */}
        <Grid item xs={12} sm={12} md={4}>
          <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white', height: '100%' }}>
            <SectionTitle action={<Chip label="This Week" size="small" sx={{ bgcolor: '#F1F5F9', color: tokens.textSecondary, fontSize: 11, fontWeight: 600 }} />}>
              Performance Overview
            </SectionTitle>
            <AreaChart data={perfData.length >= 3 ? perfData : [50,60,45,75,65,80,72]} color={tokens.accent} />
            <Box sx={{ textAlign: 'center', mt: 0.5 }}>
              <Chip label={`${avgPerf}% Average Score`} sx={{ bgcolor: 'rgba(12,189,115,0.1)', color: tokens.accentDark, fontWeight: 700, fontSize: 12 }} />
            </Box>
            <Button fullWidth size="small" endIcon={<ArrowForward fontSize="small" />}
              sx={{ mt: 2, color: tokens.accent, fontWeight: 600, fontSize: 12, textTransform: 'none', fontFamily: "'DM Sans',sans-serif", bgcolor: 'rgba(12,189,115,0.05)', borderRadius: 2, py: 1, '&:hover': { bgcolor: 'rgba(12,189,115,0.1)' } }}>
              View Analytics
            </Button>
          </Paper>
        </Grid>
      </Grid>

      {/* Quick Actions */}
      <Paper elevation={0} sx={{ mt: 2.5, p: 2.5, borderRadius: 3, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white' }}>
        <Typography fontWeight={700} sx={{ fontSize: 15, fontFamily: "'DM Sans',sans-serif", color: tokens.textPrimary, mb: 2 }}>Quick Actions</Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
          {[
            { label: 'Create Exam',      icon: <Add sx={{ fontSize: 18 }} />,         color: tokens.accent,  bg: 'rgba(12,189,115,0.09)' },
            { label: 'Add Students',     icon: <People sx={{ fontSize: 18 }} />,       color: '#6366F1',      bg: 'rgba(99,102,241,0.09)' },
            { label: 'Browse Templates', icon: <Description sx={{ fontSize: 18 }} />,  color: tokens.primary, bg: 'rgba(13,64,108,0.07)' },
            { label: 'View Reports',     icon: <BarChart sx={{ fontSize: 18 }} />,     color: tokens.warning, bg: 'rgba(245,158,11,0.09)' },
          ].map((a, i) => (
            <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: { xs: 1.5, sm: 2.5 }, py: 1.5, borderRadius: 2.5, bgcolor: a.bg, cursor: 'pointer', flex: '1 1 130px', minWidth: { xs: 0, sm: 130 }, border: `1px solid ${a.color}18`, transition: 'opacity 0.15s', '&:hover': { opacity: 0.82 } }}>
              <Box sx={{ color: a.color }}>{a.icon}</Box>
              <Typography fontWeight={700} sx={{ color: a.color, fontSize: 13.5, fontFamily: "'DM Sans',sans-serif" }}>{a.label}</Typography>
            </Box>
          ))}
        </Box>
      </Paper>

      {publishExamId && <PublishDialog examId={publishExamId} onClose={() => setPublishExamId(null)} />}
    </Box>
  );
}

/* ── EXAM PREVIEW PANEL ── */
function ExamPreviewPanel({ exam }) {
  const [activeSection, setActiveSection] = useState(null);
  const [activeQIdx, setActiveQIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(exam.timeLimit * 60);

  const sections = (exam.sections || []).filter(s => s.questions?.length > 0);

  useEffect(() => {
    if (sections.length > 0 && !activeSection) setActiveSection(sections[0].name);
  }, [sections]);

  useEffect(() => {
    const t = setInterval(() => setTimeLeft(p => Math.max(0, p - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  const fmt = (s) => `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  const timerColor = timeLeft < exam.timeLimit * 6 ? '#EF4444' : timeLeft < exam.timeLimit * 15 ? '#F59E0B' : tokens.primary;

  const curSection = sections.find(s => s.name === activeSection);
  const questions = curSection?.questions || [];
  const q = questions[activeQIdx];
  const allQ = sections.flatMap(s => s.questions || []);
  const answeredCount = Object.keys(answers).length;

  const setAnswer = (qId, val) => setAnswers(p => ({ ...p, [qId]: val }));

  const isOpen = q && (q.type === 'open-ended' || q.type === 'short-answer');
  const isFill = q && (q.type === 'fill-in-blank' || q.type === 'fill-blank');
  const isTF   = q && q.type === 'true-false';
  const isMC   = q && q.type === 'multiple-choice';

  return (
    <Box sx={{ bgcolor: '#F1F5F9', minHeight: 480 }}>
      {/* Preview banner */}
      <Box sx={{ bgcolor: '#1E293B', px: 3, py: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip label="PREVIEW MODE" size="small" sx={{ bgcolor: tokens.warning, color: 'white', fontWeight: 800, fontSize: 10, letterSpacing: 0.5 }} />
          <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, fontFamily: "'DM Sans',sans-serif" }}>
            This is how students will see the exam — answers are not submitted
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: timerColor, px: 1.5, py: 0.5, borderRadius: 2 }}>
          <HourglassEmpty sx={{ color: 'white', fontSize: 15 }} />
          <Typography sx={{ color: 'white', fontWeight: 700, fontSize: 14, fontFamily: 'monospace' }}>{fmt(timeLeft)}</Typography>
        </Box>
      </Box>

      {sections.length === 0 ? (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Typography sx={{ color: tokens.textMuted, fontSize: 14 }}>No questions found. Add questions before previewing.</Typography>
        </Box>
      ) : (
        <Grid container sx={{ minHeight: 440 }}>
          {/* Left sidebar */}
          <Grid item xs={12} sm={3} sx={{ bgcolor: 'white', borderRight: `1px solid ${tokens.surfaceBorder}`, p: 2 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 12, color: tokens.textMuted, mb: 1.5, textTransform: 'uppercase', letterSpacing: 0.5 }}>Sections</Typography>
            {sections.map(sec => (
              <Box key={sec.name} onClick={() => { setActiveSection(sec.name); setActiveQIdx(0); }}
                sx={{ p: 1.5, mb: 0.75, borderRadius: 2, cursor: 'pointer', bgcolor: activeSection === sec.name ? tokens.primary : '#F8FAFC', color: activeSection === sec.name ? 'white' : tokens.textPrimary, fontWeight: 700, fontSize: 13, fontFamily: "'DM Sans',sans-serif", border: `1px solid ${activeSection === sec.name ? tokens.primary : tokens.surfaceBorder}` }}>
                Section {sec.name}
                <Typography component="span" sx={{ fontSize: 11, fontWeight: 400, ml: 0.75, opacity: 0.8 }}>({sec.questions.length} q)</Typography>
              </Box>
            ))}
            <Divider sx={{ my: 1.5 }} />
            <Typography sx={{ fontWeight: 700, fontSize: 12, color: tokens.textMuted, mb: 1, textTransform: 'uppercase', letterSpacing: 0.5 }}>Questions</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {questions.map((qItem, i) => (
                <Box key={i} onClick={() => setActiveQIdx(i)}
                  sx={{ width: 28, height: 28, borderRadius: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 12, fontWeight: 700, bgcolor: answers[qItem._id] ? tokens.accent : activeQIdx === i ? tokens.primary : '#F1F5F9', color: answers[qItem._id] || activeQIdx === i ? 'white' : tokens.textSecondary, border: `1px solid ${activeQIdx === i ? tokens.primary : tokens.surfaceBorder}` }}>
                  {i + 1}
                </Box>
              ))}
            </Box>
            <Box sx={{ mt: 2, p: 1.5, borderRadius: 2, bgcolor: 'rgba(12,189,115,0.07)', border: `1px solid ${tokens.accent}` }}>
              <Typography sx={{ fontSize: 12, color: tokens.accentDark, fontWeight: 700 }}>{answeredCount}/{allQ.length} answered</Typography>
              <LinearProgress variant="determinate" value={allQ.length ? (answeredCount / allQ.length) * 100 : 0} sx={{ mt: 0.75, borderRadius: 2, height: 5, bgcolor: 'rgba(12,189,115,0.15)', '& .MuiLinearProgress-bar': { bgcolor: tokens.accent } }} />
            </Box>
          </Grid>

          {/* Main question area */}
          <Grid item xs={12} sm={9} sx={{ p: 3 }}>
            {q ? (
              <>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip label={`Q${activeQIdx + 1} of ${questions.length}`} sx={{ fontWeight: 700, bgcolor: tokens.primary, color: 'white' }} />
                    <Chip label={q.type?.replace(/-/g, ' ')} size="small" sx={{ bgcolor: '#F1F5F9', color: tokens.textSecondary, textTransform: 'capitalize' }} />
                    <Chip label={`${q.points} pt${q.points !== 1 ? 's' : ''}`} size="small" sx={{ bgcolor: 'rgba(245,158,11,0.1)', color: tokens.warning, fontWeight: 700 }} />
                  </Box>
                  <Chip label={q.difficulty || 'medium'} size="small" sx={{ bgcolor: q.difficulty === 'hard' ? 'rgba(239,68,68,0.1)' : q.difficulty === 'easy' ? 'rgba(12,189,115,0.1)' : 'rgba(245,158,11,0.1)', color: q.difficulty === 'hard' ? '#EF4444' : q.difficulty === 'easy' ? tokens.accent : tokens.warning, fontWeight: 700, textTransform: 'capitalize' }} />
                </Box>

                <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2.5, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white', mb: 2.5 }}>
                  <Typography sx={{ fontSize: 15, fontWeight: 600, color: tokens.textPrimary, fontFamily: "'DM Sans',sans-serif", lineHeight: 1.6 }}>{q.text}</Typography>
                </Paper>

                {/* Multiple choice */}
                {isMC && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {(q.options || []).map((opt, oi) => {
                      const letter = opt.letter || String.fromCharCode(65 + oi);
                      const selected = answers[q._id] === letter;
                      return (
                        <Box key={oi} onClick={() => setAnswer(q._id, letter)}
                          sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.75, borderRadius: 2, cursor: 'pointer', border: `2px solid ${selected ? tokens.accent : tokens.surfaceBorder}`, bgcolor: selected ? 'rgba(12,189,115,0.06)' : 'white', transition: 'all 0.15s', '&:hover': { borderColor: tokens.accent, bgcolor: 'rgba(12,189,115,0.03)' } }}>
                          <Box sx={{ width: 28, height: 28, borderRadius: '50%', border: `2px solid ${selected ? tokens.accent : tokens.surfaceBorder}`, bgcolor: selected ? tokens.accent : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {selected ? <CheckCircle sx={{ fontSize: 16, color: 'white' }} /> : <Typography sx={{ fontSize: 12, fontWeight: 700, color: tokens.textSecondary }}>{letter}</Typography>}
                          </Box>
                          <Typography sx={{ fontSize: 14, color: tokens.textPrimary, fontFamily: "'DM Sans',sans-serif" }}>{opt.text}</Typography>
                        </Box>
                      );
                    })}
                  </Box>
                )}

                {/* True / False */}
                {isTF && (
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    {['True', 'False'].map(val => {
                      const sel = answers[q._id] === val;
                      return (
                        <Box key={val} onClick={() => setAnswer(q._id, val)}
                          sx={{ flex: 1, p: 2.5, borderRadius: 2.5, textAlign: 'center', cursor: 'pointer', border: `2px solid ${sel ? tokens.accent : tokens.surfaceBorder}`, bgcolor: sel ? 'rgba(12,189,115,0.07)' : 'white', fontWeight: 700, fontSize: 16, color: sel ? tokens.accentDark : tokens.textSecondary, transition: 'all 0.15s', '&:hover': { borderColor: tokens.accent } }}>
                          {val}
                        </Box>
                      );
                    })}
                  </Box>
                )}

                {/* Fill blank */}
                {isFill && (
                  <TextField fullWidth placeholder="Type your answer here…" value={answers[q._id] || ''}
                    onChange={e => setAnswer(q._id, e.target.value)}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, fontSize: 14, bgcolor: 'white' } }} />
                )}

                {/* Open / Short */}
                {isOpen && (
                  <TextField fullWidth multiline minRows={4} placeholder="Write your answer here…" value={answers[q._id] || ''}
                    onChange={e => setAnswer(q._id, e.target.value)}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, fontSize: 14, bgcolor: 'white' } }} />
                )}

                {/* Navigation */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
                  <Button startIcon={<ArrowForward sx={{ transform: 'scaleX(-1)' }} />} disabled={activeQIdx === 0}
                    onClick={() => setActiveQIdx(p => p - 1)}
                    sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, color: tokens.textSecondary }}>
                    Previous
                  </Button>
                  <Button variant="contained" endIcon={<ArrowForward />}
                    disabled={activeQIdx === questions.length - 1}
                    onClick={() => setActiveQIdx(p => p + 1)}
                    sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, background: gradients.brand, boxShadow: 'none' }}>
                    Next Question
                  </Button>
                </Box>
              </>
            ) : (
              <Typography sx={{ color: tokens.textMuted, textAlign: 'center', pt: 6 }}>Select a section to begin.</Typography>
            )}
          </Grid>
        </Grid>
      )}
    </Box>
  );
}

/* ── PUBLISH DIALOG ── */
function PublishDialog({ examId, onClose }) {
  const isXs = useMediaQuery('(max-width:600px)');
  const [tab, setTab] = useState(0);
  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [shareResult, setShareResult] = useState(null);
  const [shareSettings, setShareSettings] = useState({ publicAccess: true, requirePassword: false, password: '', allowMultipleAttempts: false, showResults: true, maxStudents: '', expiresAt: '' });
  const [studentRows, setStudentRows] = useState([{ firstName: '', lastName: '', email: '', class: '' }]);
  const [creating, setCreating] = useState(false);
  const [createResult, setCreateResult] = useState(null);
  const [snack, setSnack] = useState('');
  const [copied, setCopied] = useState('');

  useEffect(() => {
    api.get(`/admin/exams/${examId}/preview`).then(r => setPreview(r.data)).catch(() => {}).finally(() => setLoadingPreview(false));
  }, [examId]);

  const handleShare = async (type) => {
    setSharing(true);
    try {
      const settings = { ...shareSettings, maxStudents: shareSettings.maxStudents ? +shareSettings.maxStudents : null, expiresAt: shareSettings.expiresAt || null };
      const r = await api.post(`/admin/exams/${examId}/share`, { shareType: type, settings });
      setShareResult(r.data);
    } catch (err) { setSnack(err.response?.data?.message || 'Failed to create share link'); }
    finally { setSharing(false); }
  };

  const copyLink = (link, label) => { navigator.clipboard.writeText(link); setCopied(label); setTimeout(() => setCopied(''), 2500); };

  const addRow = () => setStudentRows(p => [...p, { firstName: '', lastName: '', email: '', class: '' }]);
  const removeRow = (i) => setStudentRows(p => p.filter((_, idx) => idx !== i));
  const updateRow = (i, field, val) => setStudentRows(p => p.map((r, idx) => idx === i ? { ...r, [field]: val } : r));

  const handleCreateAccounts = async () => {
    const valid = studentRows.filter(s => s.email && s.firstName && s.lastName);
    if (!valid.length) { setSnack('Fill in at least one student with name and email.'); return; }
    setCreating(true);
    try {
      const r = await api.post(`/admin/exams/${examId}/students`, { students: valid });
      setCreateResult(r.data);
      if (!shareResult) handleShare('link');
    } catch (err) { setSnack(err.response?.data?.message || 'Failed to create accounts'); }
    finally { setCreating(false); }
  };

  const exam = preview?.exam;
  const allQ = exam ? exam.sections.flatMap(s => s.questions || []) : [];

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth fullScreen={isXs} PaperProps={{ sx: { borderRadius: isXs ? 0 : 3, overflow: 'hidden' } }}>
      {/* Header */}
      <Box sx={{ background: gradients.brand, px: 3, py: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Publish sx={{ color: 'white', fontSize: 24 }} />
          <Box>
            <Typography fontWeight={700} color="white" sx={{ fontSize: 17, fontFamily: "'DM Sans',sans-serif" }}>
              {loadingPreview ? 'Loading…' : exam?.title || 'Publish Exam'}
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, fontFamily: "'DM Sans',sans-serif" }}>
              Preview · Share · Invite Students
            </Typography>
          </Box>
        </Box>
        <IconButton onClick={onClose} sx={{ color: 'white' }}><Close /></IconButton>
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white' }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ minHeight: 44, '& .MuiTab-root': { fontWeight: 700, fontSize: 13, textTransform: 'none', fontFamily: "'DM Sans',sans-serif", minHeight: 44 }, '& .MuiTabs-indicator': { backgroundColor: tokens.primary } }}>
          <Tab label="👁 Preview" />
          <Tab label="🔗 Public Link" />
          <Tab label="🔒 Private / Invite" />
        </Tabs>
      </Box>

      <DialogContent sx={{ p: 0, bgcolor: '#F8FAFC' }}>
        {/* TAB 0 — PREVIEW (student exam-taking view) */}
        {tab === 0 && (
          loadingPreview
            ? <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress sx={{ color: tokens.accent }} /></Box>
            : exam
              ? <ExamPreviewPanel exam={exam} />
              : <Typography sx={{ color: tokens.textMuted, textAlign: 'center', py: 5 }}>Could not load exam preview.</Typography>
        )}

        {/* TAB 1 — PUBLIC LINK */}
        {tab === 1 && (
          <Box sx={{ p: 3 }}>
            <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2.5, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white', mb: 2 }}>
              <Typography fontWeight={700} sx={{ fontSize: 14, mb: 2, fontFamily: "'DM Sans',sans-serif" }}>Share Settings</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Allow Multiple Attempts</InputLabel>
                    <Select label="Allow Multiple Attempts" value={shareSettings.allowMultipleAttempts}
                      onChange={e => setShareSettings(p => ({ ...p, allowMultipleAttempts: e.target.value }))} sx={{ borderRadius: 2 }}>
                      <MenuItem value={false}>No (one attempt)</MenuItem>
                      <MenuItem value={true}>Yes</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Show Results After</InputLabel>
                    <Select label="Show Results After" value={shareSettings.showResults}
                      onChange={e => setShareSettings(p => ({ ...p, showResults: e.target.value }))} sx={{ borderRadius: 2 }}>
                      <MenuItem value={true}>Immediately</MenuItem>
                      <MenuItem value={false}>Manually release</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth size="small" label="Max Students (blank = unlimited)" type="number"
                    value={shareSettings.maxStudents} onChange={e => setShareSettings(p => ({ ...p, maxStudents: e.target.value }))}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth size="small" label="Expires At (blank = never)" type="datetime-local"
                    value={shareSettings.expiresAt} onChange={e => setShareSettings(p => ({ ...p, expiresAt: e.target.value }))}
                    InputLabelProps={{ shrink: true }} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Password Protect</InputLabel>
                    <Select label="Password Protect" value={shareSettings.requirePassword}
                      onChange={e => setShareSettings(p => ({ ...p, requirePassword: e.target.value }))} sx={{ borderRadius: 2 }}>
                      <MenuItem value={false}>No</MenuItem>
                      <MenuItem value={true}>Yes</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                {shareSettings.requirePassword && (
                  <Grid item xs={12} sm={6}>
                    <TextField fullWidth size="small" label="Access Password" value={shareSettings.password}
                      onChange={e => setShareSettings(p => ({ ...p, password: e.target.value }))}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
                  </Grid>
                )}
              </Grid>
            </Paper>

            {shareResult ? (
              <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2.5, border: `1.5px solid ${tokens.accent}`, bgcolor: 'rgba(12,189,115,0.03)' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <CheckCircle sx={{ color: tokens.accent }} />
                  <Typography fontWeight={700} sx={{ color: tokens.accentDark, fontFamily: "'DM Sans',sans-serif" }}>Public link created!</Typography>
                </Box>
                {[{ label: 'Public Link', value: shareResult.publicLink }].map(l => (
                  <Box key={l.label} sx={{ mb: 1.5 }}>
                    <Typography sx={{ fontSize: 12, color: tokens.textMuted, mb: 0.5, fontFamily: "'DM Sans',sans-serif" }}>{l.label}</Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <TextField fullWidth size="small" value={l.value} InputProps={{ readOnly: true }} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, fontSize: 13 } }} />
                      <Button variant="contained" onClick={() => copyLink(l.value, l.label)}
                        sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none', background: copied === l.label ? tokens.accent : gradients.brand, boxShadow: 'none', whiteSpace: 'nowrap', px: 2 }}>
                        {copied === l.label ? '✓ Copied' : 'Copy'}
                      </Button>
                    </Box>
                  </Box>
                ))}
                <Typography sx={{ fontSize: 11.5, color: tokens.textMuted, fontFamily: "'DM Sans',sans-serif" }}>
                  Anyone with this link can access the exam. Share it via WhatsApp, email, or any platform.
                </Typography>
              </Paper>
            ) : (
              <Button fullWidth variant="contained" size="large" startIcon={sharing ? <CircularProgress size={18} color="inherit" /> : <Share />}
                onClick={() => handleShare('link')} disabled={sharing}
                sx={{ borderRadius: 2.5, fontWeight: 700, textTransform: 'none', background: gradients.brand, boxShadow: 'none', py: 1.5, fontSize: 15 }}>
                {sharing ? 'Generating Link…' : 'Generate Public Link'}
              </Button>
            )}
          </Box>
        )}

        {/* TAB 2 — PRIVATE / INVITE */}
        {tab === 2 && (
          <Box sx={{ p: 3 }}>
            <Paper elevation={0} sx={{ p: 2, borderRadius: 2.5, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white', mb: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                <Typography fontWeight={700} sx={{ fontSize: 14, fontFamily: "'DM Sans',sans-serif" }}>Create Student Accounts</Typography>
                <Button size="small" startIcon={<Add />} onClick={addRow}
                  sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, color: tokens.accent, bgcolor: 'rgba(12,189,115,0.08)', fontSize: 12 }}>
                  Add Row
                </Button>
              </Box>
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small" sx={{ minWidth: 480 }}>
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                      {['First Name', 'Last Name', 'Email', 'Class', ''].map(h => (
                        <TableCell key={h} sx={{ fontWeight: 700, color: tokens.textSecondary, fontSize: 11, py: 0.75 }}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {studentRows.map((row, i) => (
                      <TableRow key={i}>
                        {['firstName', 'lastName', 'email', 'class'].map(f => (
                          <TableCell key={f} sx={{ py: 0.5, px: 0.75 }}>
                            <TextField fullWidth size="small" value={row[f]} onChange={e => updateRow(i, f, e.target.value)}
                              placeholder={f === 'email' ? 'student@email.com' : f === 'class' ? 'e.g. 10A' : ''}
                              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5, fontSize: 12 } }} />
                          </TableCell>
                        ))}
                        <TableCell sx={{ py: 0.5 }}>
                          <IconButton size="small" onClick={() => removeRow(i)} disabled={studentRows.length === 1} sx={{ color: tokens.danger }}>
                            <Delete fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
              <Typography sx={{ fontSize: 11, color: tokens.textMuted, mt: 1, fontFamily: "'DM Sans',sans-serif" }}>
                Default password: <b>Exam@2024</b> — students should change it after first login.
              </Typography>
            </Paper>

            {createResult ? (
              <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2.5, border: `1.5px solid ${tokens.accent}`, bgcolor: 'rgba(12,189,115,0.03)', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <CheckCircle sx={{ color: tokens.accent }} />
                  <Typography fontWeight={700} sx={{ color: tokens.accentDark, fontFamily: "'DM Sans',sans-serif" }}>
                    {createResult.created.length} account{createResult.created.length !== 1 ? 's' : ''} created, {createResult.skipped.length} skipped
                  </Typography>
                </Box>
                {shareResult && (
                  <Box sx={{ mb: 1.5 }}>
                    <Typography sx={{ fontSize: 12, color: tokens.textMuted, mb: 0.5 }}>Private Link (share with invited students)</Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <TextField fullWidth size="small" value={shareResult.privateLink} InputProps={{ readOnly: true }} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, fontSize: 13 } }} />
                      <Button variant="contained" onClick={() => copyLink(shareResult.privateLink, 'private')}
                        sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none', background: copied === 'private' ? tokens.accent : gradients.brand, boxShadow: 'none', whiteSpace: 'nowrap', px: 2 }}>
                        {copied === 'private' ? '✓ Copied' : 'Copy'}
                      </Button>
                    </Box>
                  </Box>
                )}
                {createResult.created.length > 0 && (
                  <Box sx={{ maxHeight: 160, overflowY: 'auto' }}>
                    <Typography sx={{ fontSize: 12, fontWeight: 700, color: tokens.textSecondary, mb: 0.5 }}>Created Accounts:</Typography>
                    {createResult.created.map((s, i) => (
                      <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5, borderBottom: `1px solid ${tokens.surfaceBorder}` }}>
                        <Avatar sx={{ width: 24, height: 24, fontSize: 11, bgcolor: tokens.accent }}>{s.firstName[0]}</Avatar>
                        <Typography sx={{ fontSize: 12, flexGrow: 1 }}>{s.firstName} {s.lastName} — <b>{s.email}</b></Typography>
                        <Chip label={`pw: ${s.tempPassword}`} size="small" sx={{ fontSize: 10, bgcolor: '#F1F5F9', color: tokens.textSecondary }} />
                      </Box>
                    ))}
                  </Box>
                )}
              </Paper>
            ) : (
              <Button fullWidth variant="contained" size="large" startIcon={creating ? <CircularProgress size={18} color="inherit" /> : <People />}
                onClick={handleCreateAccounts} disabled={creating}
                sx={{ borderRadius: 2.5, fontWeight: 700, textTransform: 'none', background: gradients.brand, boxShadow: 'none', py: 1.5, fontSize: 15 }}>
                {creating ? 'Creating Accounts…' : 'Create Accounts & Share'}
              </Button>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, bgcolor: 'white', borderTop: `1px solid ${tokens.surfaceBorder}`, gap: 1 }}>
        <Button onClick={onClose} sx={{ borderRadius: 2, textTransform: 'none', color: tokens.textSecondary, fontWeight: 600 }}>Close</Button>
        {tab === 0 && <Button variant="contained" onClick={() => setTab(1)} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, background: gradients.brand, boxShadow: 'none' }}>Next: Share →</Button>}
      </DialogActions>

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack('')} message={snack} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </Dialog>
  );
}

/* ── MANUAL EXAM BUILDER ── */
const Q_TYPES = [
  { value: 'multiple-choice', label: 'Multiple Choice' },
  { value: 'true-false',      label: 'True / False' },
  { value: 'short-answer',    label: 'Short Answer' },
  { value: 'fill-blank',      label: 'Fill in the Blank' },
  { value: 'open-ended',      label: 'Open Ended' },
];
const DIFFS = ['easy', 'medium', 'hard'];
const LETTERS = ['A', 'B', 'C', 'D'];

function ManualExamBuilder({ exam, setExam, sectionIdx, setSectionIdx, question, setQuestion, onAddQuestion, onRemoveQuestion, onPublish, publishing, error }) {
  const totalQ = exam.sections.reduce((s, sec) => s + (sec.questions?.length || 0), 0);

  const updateOption = (idx, field, val) => {
    setQuestion(p => {
      const opts = p.options.map((o, i) => {
        if (field === 'isCorrect') return { ...o, isCorrect: i === idx };
        return i === idx ? { ...o, [field]: val } : o;
      });
      const correct = field === 'isCorrect' ? LETTERS[idx] : p.correctAnswer;
      return { ...p, options: opts, correctAnswer: correct };
    });
  };

  const addSection = () => {
    const name = String.fromCharCode(65 + exam.sections.length);
    setExam(p => ({ ...p, sections: [...p.sections, { name, description: `Section ${name}`, questions: [] }] }));
    setSectionIdx(exam.sections.length);
  };

  const isOpen = question.type === 'open-ended' || question.type === 'short-answer';

  return (
    <Box>
      {/* Exam meta */}
      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        <Grid item xs={12} sm={5}>
          <TextField fullWidth size="small" label="Exam Title *" value={exam.title}
            onChange={e => setExam(p => ({ ...p, title: e.target.value }))}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
        </Grid>
        <Grid item xs={6} sm={2}>
          <TextField fullWidth size="small" label="Time (min)" type="number" value={exam.timeLimit}
            onChange={e => setExam(p => ({ ...p, timeLimit: +e.target.value }))}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
        </Grid>
        <Grid item xs={6} sm={2}>
          <TextField fullWidth size="small" label="Pass %" type="number" value={exam.passingScore}
            onChange={e => setExam(p => ({ ...p, passingScore: +e.target.value }))}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
        </Grid>
        <Grid item xs={12} sm={3}>
          <TextField fullWidth size="small" label="Description" value={exam.description}
            onChange={e => setExam(p => ({ ...p, description: e.target.value }))}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
        </Grid>
      </Grid>

      {/* Section tabs */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        {exam.sections.map((sec, i) => (
          <Chip key={i} label={`Section ${sec.name} (${sec.questions?.length || 0})`}
            onClick={() => setSectionIdx(i)} clickable
            sx={{ fontWeight: 700, bgcolor: sectionIdx === i ? tokens.primary : '#F1F5F9', color: sectionIdx === i ? 'white' : tokens.textSecondary, fontSize: 12 }} />
        ))}
        {exam.sections.length < 5 && (
          <Chip icon={<Add sx={{ fontSize: 15 }} />} label="Add Section" onClick={addSection} clickable
            sx={{ fontWeight: 600, bgcolor: 'rgba(12,189,115,0.1)', color: tokens.accent, fontSize: 12 }} />
        )}
        <Box sx={{ flexGrow: 1 }} />
        <Chip label={`${totalQ} question${totalQ !== 1 ? 's' : ''} total`}
          sx={{ bgcolor: '#F1F5F9', color: tokens.textSecondary, fontSize: 11 }} />
      </Box>

      {/* Question builder */}
      <Paper elevation={0} sx={{ p: 2, borderRadius: 2.5, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: '#FAFBFC', mb: 2 }}>
        <Typography fontWeight={700} sx={{ fontSize: 13, color: tokens.textPrimary, fontFamily: "'DM Sans',sans-serif", mb: 1.5 }}>
          Add Question to Section {exam.sections[sectionIdx]?.name}
        </Typography>

        <Grid container spacing={1.5} sx={{ mb: 1.5 }}>
          <Grid item xs={12} sm={5}>
            <FormControl fullWidth size="small">
              <InputLabel>Question Type</InputLabel>
              <Select label="Question Type" value={question.type}
                onChange={e => setQuestion(p => ({
                  ...p, type: e.target.value, correctAnswer: '',
                  options: e.target.value === 'true-false'
                    ? [{ text: 'True', isCorrect: false, letter: 'A' }, { text: 'False', isCorrect: false, letter: 'B' }]
                    : [{ text: '', isCorrect: false, letter: 'A' }, { text: '', isCorrect: false, letter: 'B' }, { text: '', isCorrect: false, letter: 'C' }, { text: '', isCorrect: false, letter: 'D' }]
                }))}
                sx={{ borderRadius: 2 }}>
                {Q_TYPES.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} sm={2}>
            <TextField fullWidth size="small" label="Points" type="number" value={question.points}
              onChange={e => setQuestion(p => ({ ...p, points: +e.target.value }))}
              inputProps={{ min: 1 }} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
          </Grid>
          <Grid item xs={6} sm={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Difficulty</InputLabel>
              <Select label="Difficulty" value={question.difficulty}
                onChange={e => setQuestion(p => ({ ...p, difficulty: e.target.value }))}
                sx={{ borderRadius: 2 }}>
                {DIFFS.map(d => <MenuItem key={d} value={d} sx={{ textTransform: 'capitalize' }}>{d}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
        </Grid>

        <TextField fullWidth size="small" label="Question Text *" multiline minRows={2}
          value={question.text} onChange={e => setQuestion(p => ({ ...p, text: e.target.value }))}
          sx={{ mb: 1.5, '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: 'white' } }} />

        {/* Multiple choice options */}
        {question.type === 'multiple-choice' && (
          <Grid container spacing={1} sx={{ mb: 1.5 }}>
            {question.options.map((opt, i) => (
              <Grid item xs={12} sm={6} key={i}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box onClick={() => updateOption(i, 'isCorrect', true)}
                    sx={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${opt.isCorrect ? tokens.accent : tokens.surfaceBorder}`, bgcolor: opt.isCorrect ? tokens.accent : 'white', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {opt.isCorrect && <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'white' }} />}
                  </Box>
                  <Chip label={LETTERS[i]} size="small" sx={{ fontWeight: 700, bgcolor: opt.isCorrect ? 'rgba(12,189,115,0.12)' : '#F1F5F9', color: opt.isCorrect ? tokens.accentDark : tokens.textSecondary, minWidth: 28 }} />
                  <TextField fullWidth size="small" placeholder={`Option ${LETTERS[i]}`} value={opt.text}
                    onChange={e => updateOption(i, 'text', e.target.value)}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: 'white', fontSize: 13 } }} />
                </Box>
              </Grid>
            ))}
            <Grid item xs={12}>
              <Typography sx={{ fontSize: 11, color: tokens.textMuted, fontFamily: "'DM Sans',sans-serif" }}>Click the circle to mark the correct answer</Typography>
            </Grid>
          </Grid>
        )}

        {/* True / False */}
        {question.type === 'true-false' && (
          <Box sx={{ display: 'flex', gap: 1.5, mb: 1.5 }}>
            {['True', 'False'].map(val => (
              <Paper key={val} onClick={() => setQuestion(p => ({ ...p, correctAnswer: val, options: [{ text: 'True', isCorrect: val === 'True', letter: 'A' }, { text: 'False', isCorrect: val === 'False', letter: 'B' }] }))}
                elevation={0} sx={{ px: 3, py: 1.25, borderRadius: 2.5, cursor: 'pointer', border: `2px solid ${question.correctAnswer === val ? tokens.accent : tokens.surfaceBorder}`, bgcolor: question.correctAnswer === val ? 'rgba(12,189,115,0.07)' : 'white', fontWeight: 700, fontSize: 14, color: question.correctAnswer === val ? tokens.accentDark : tokens.textSecondary, fontFamily: "'DM Sans',sans-serif" }}>
                {val}
              </Paper>
            ))}
            <Typography sx={{ alignSelf: 'center', fontSize: 11, color: tokens.textMuted }}>Click to mark correct answer</Typography>
          </Box>
        )}

        {/* Fill blank */}
        {question.type === 'fill-blank' && (
          <TextField fullWidth size="small" label="Correct Answer (expected fill)" value={question.correctAnswer}
            onChange={e => setQuestion(p => ({ ...p, correctAnswer: e.target.value }))}
            sx={{ mb: 1.5, '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: 'white' } }} />
        )}

        {/* Open / Short */}
        {isOpen && (
          <TextField fullWidth size="small" label="Model Answer (used for AI grading)" multiline minRows={2}
            value={question.correctAnswer} onChange={e => setQuestion(p => ({ ...p, correctAnswer: e.target.value }))}
            sx={{ mb: 1.5, '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: 'white' } }} />
        )}

        <Button variant="contained" startIcon={<Add />} onClick={onAddQuestion} disabled={!question.text.trim()}
          sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none', background: gradients.brand, boxShadow: 'none', fontSize: 13 }}>
          Add Question
        </Button>
      </Paper>

      {/* Questions list by section */}
      {exam.sections.map((sec, si) => sec.questions?.length > 0 && (
        <Box key={si} sx={{ mb: 1.5 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 12, color: tokens.textMuted, mb: 0.75, fontFamily: "'DM Sans',sans-serif", textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Section {sec.name}
          </Typography>
          {sec.questions.map((q, qi) => (
            <Paper key={qi} elevation={0} sx={{ p: 1.5, mb: 0.75, borderRadius: 2, border: `1px solid ${tokens.surfaceBorder}`, borderLeft: `3px solid ${tokens.accent}`, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip label={`Q${qi + 1}`} size="small" sx={{ bgcolor: 'rgba(12,189,115,0.1)', color: tokens.accentDark, fontWeight: 700, minWidth: 36 }} />
              <Chip label={Q_TYPES.find(t => t.value === q.type)?.label || q.type} size="small" sx={{ bgcolor: '#F1F5F9', color: tokens.textSecondary, fontSize: 11 }} />
              <Typography variant="body2" sx={{ flexGrow: 1, fontFamily: "'DM Sans',sans-serif", fontSize: 13 }} noWrap>{q.text}</Typography>
              <Chip label={`${q.points}pt`} size="small" sx={{ bgcolor: 'rgba(245,158,11,0.1)', color: tokens.warning, fontWeight: 700, fontSize: 11 }} />
              <IconButton size="small" onClick={() => onRemoveQuestion(si, qi)} sx={{ color: tokens.danger }}><Delete fontSize="small" /></IconButton>
            </Paper>
          ))}
        </Box>
      ))}

      {error && <Box sx={{ mb: 1.5, p: 1.5, borderRadius: 2, bgcolor: 'rgba(239,68,68,0.07)', color: '#EF4444', fontSize: 13 }}>{error}</Box>}

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', pt: 0.5 }}>
        <Button variant="contained" startIcon={publishing ? <CircularProgress size={16} color="inherit" /> : <Publish />}
          onClick={onPublish} disabled={publishing}
          sx={{ borderRadius: 2.5, fontWeight: 700, px: 3, textTransform: 'none', background: gradients.brand, boxShadow: 'none', fontSize: 14 }}>
          {publishing ? 'Publishing…' : `Publish Exam (${totalQ} questions)`}
        </Button>
      </Box>
    </Box>
  );
}

function ExamsSection({ exams, setExams }) {
  const [loading, setLoading] = useState(false);
  const [publishExamId, setPublishExamId] = useState(null);
  const [editExam, setEditExam] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get('/admin/exams').then(r => setExams(r.data || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/admin/exams/${deleteId}`);
      setExams(p => p.filter(e => e._id !== deleteId));
      setDeleteId(null);
    } catch { }
    finally { setDeleting(false); }
  };

  const handleSaveEdit = async (updated) => {
    try {
      const res = await api.put(`/admin/exams/${updated._id}`, { title: updated.title, description: updated.description, timeLimit: updated.timeLimit, passingScore: updated.passingScore });
      setExams(p => p.map(e => e._id === updated._id ? { ...e, ...res.data } : e));
      setEditExam(null);
    } catch { }
  };

  return (
    <Box>
      <SectionTitle>My Exams</SectionTitle>
      {loading ? <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}><CircularProgress sx={{ color: tokens.accent }} /></Box> : (
        <Paper elevation={0} sx={{ borderRadius: 3, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white', overflow: 'hidden', overflowX: 'auto' }}>
          <TableContainer sx={{ overflowX: 'auto' }}><Table sx={{ minWidth: 650 }}>
            <TableHead><TableRow sx={{ bgcolor: '#F8FAFC' }}>{['Title', 'Status', 'Questions', 'Time', 'Created', 'Actions'].map(h => <TableCell key={h} sx={{ fontWeight: 700, color: tokens.textSecondary, fontSize: 12, px: 1.5, py: 1 }}>{h}</TableCell>)}</TableRow></TableHead>
            <TableBody>
              {exams.length === 0 ? <TableRow><TableCell colSpan={6} align="center" sx={{ py: 5, color: tokens.textMuted }}>No exams yet.</TableCell></TableRow> :
                exams.map(e => { const sc = e.status === 'active' ? tokens.accent : e.status === 'draft' ? tokens.warning : '#6366F1'; return (
                  <TableRow key={e._id} sx={{ '&:hover': { bgcolor: '#F8FAFC' } }}>
                    <TableCell><Typography variant="body2" fontWeight={600} sx={{ fontFamily: "'DM Sans',sans-serif" }}>{e.title}</Typography></TableCell>
                    <TableCell><Chip label={e.status || 'draft'} size="small" sx={{ bgcolor: `${sc}14`, color: sc, fontWeight: 600, textTransform: 'capitalize' }} /></TableCell>
                    <TableCell><Chip label={e.questions?.length || 0} size="small" sx={{ bgcolor: 'rgba(13,64,108,0.07)', color: tokens.primary }} /></TableCell>
                    <TableCell><Typography variant="body2" sx={{ color: tokens.textMuted }}>{e.timeLimit} min</Typography></TableCell>
                    <TableCell><Typography variant="caption" sx={{ color: tokens.textMuted }}>{new Date(e.createdAt).toLocaleDateString()}</Typography></TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                        <Tooltip title="Publish / Share"><IconButton size="small" onClick={() => setPublishExamId(e._id)} sx={{ color: tokens.accent }}><Publish sx={{ fontSize: 16 }} /></IconButton></Tooltip>
                        <Tooltip title="Edit"><IconButton size="small" onClick={() => setEditExam({ ...e })} sx={{ color: tokens.primary }}><Edit sx={{ fontSize: 16 }} /></IconButton></Tooltip>
                        <Tooltip title="Delete"><IconButton size="small" onClick={() => setDeleteId(e._id)} sx={{ color: '#EF4444' }}><Delete sx={{ fontSize: 16 }} /></IconButton></Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>); })}
            </TableBody>
          </Table></TableContainer>
        </Paper>
      )}

      {/* Edit Dialog */}
      {editExam && (
        <Dialog open onClose={() => setEditExam(null)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
          <DialogTitle sx={{ fontWeight: 700, fontFamily: "'DM Sans',sans-serif", pb: 1 }}>Edit Exam</DialogTitle>
          <DialogContent sx={{ pt: 1 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
              <TextField fullWidth label="Title" value={editExam.title} onChange={e => setEditExam(p => ({ ...p, title: e.target.value }))} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
              <TextField fullWidth label="Description" value={editExam.description || ''} onChange={e => setEditExam(p => ({ ...p, description: e.target.value }))} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField fullWidth label="Time Limit (min)" type="number" value={editExam.timeLimit} onChange={e => setEditExam(p => ({ ...p, timeLimit: +e.target.value }))} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
                <TextField fullWidth label="Passing Score (%)" type="number" value={editExam.passingScore} onChange={e => setEditExam(p => ({ ...p, passingScore: +e.target.value }))} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
              </Box>
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
            <Button onClick={() => setEditExam(null)} sx={{ borderRadius: 2, textTransform: 'none', color: tokens.textSecondary }}>Cancel</Button>
            <Button variant="contained" onClick={() => handleSaveEdit(editExam)} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, background: gradients.brand, boxShadow: 'none' }}>Save Changes</Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteId} onClose={() => setDeleteId(null)} PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700, fontFamily: "'DM Sans',sans-serif" }}>Delete Exam?</DialogTitle>
        <DialogContent><Typography sx={{ color: tokens.textSecondary }}>This will permanently delete the exam and all its questions. This cannot be undone.</Typography></DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setDeleteId(null)} sx={{ borderRadius: 2, textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained" onClick={handleDelete} disabled={deleting}
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, bgcolor: '#EF4444', '&:hover': { bgcolor: '#DC2626' }, boxShadow: 'none' }}>
            {deleting ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {publishExamId && <PublishDialog examId={publishExamId} onClose={() => setPublishExamId(null)} />}
    </Box>
  );
}

function StudentsSection() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(()=>{api.get('/admin/students').then(r=>setStudents(r.data||[])).catch(()=>{}).finally(()=>setLoading(false));},[]);
  return(
    <Box>
      <SectionTitle>Students</SectionTitle>
      {loading?<Box sx={{display:'flex',justifyContent:'center',mt:6}}><CircularProgress sx={{color:tokens.accent}}/></Box>:(
        <Paper elevation={0} sx={{borderRadius:3,border:`1px solid ${tokens.surfaceBorder}`,bgcolor:'white',overflow:'hidden'}}>
          <TableContainer sx={{overflowX:'auto'}}><Table sx={{minWidth:480}}>
            <TableHead><TableRow sx={{bgcolor:'#F8FAFC'}}>{['Student','Email','Class','Status'].map(h=><TableCell key={h} sx={{fontWeight:700,color:tokens.textSecondary,fontSize:12}}>{h}</TableCell>)}</TableRow></TableHead>
            <TableBody>
              {students.length===0?<TableRow><TableCell colSpan={4} align="center" sx={{py:5,color:tokens.textMuted}}>No students.</TableCell></TableRow>:
              students.map(s=>(
                <TableRow key={s._id} sx={{'&:hover':{bgcolor:'#F8FAFC'}}}>
                  <TableCell><Box sx={{display:'flex',alignItems:'center',gap:1.5}}><Box sx={{width:32,height:32,borderRadius:'50%',bgcolor:'rgba(12,189,115,0.1)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,color:tokens.accent,fontSize:13}}>{s.firstName?.charAt(0)}</Box><Typography variant="body2" fontWeight={600} sx={{fontFamily:"'DM Sans',sans-serif"}}>{s.firstName} {s.lastName}</Typography></Box></TableCell>
                  <TableCell><Typography variant="body2" sx={{color:tokens.textMuted}}>{s.email}</Typography></TableCell>
                  <TableCell><Chip label={s.class||'N/A'} size="small" sx={{bgcolor:'rgba(13,64,108,0.07)',color:tokens.primary}}/></TableCell>
                  <TableCell><Chip label={s.isBlocked?'Blocked':'Active'} size="small" sx={{bgcolor:s.isBlocked?'rgba(239,68,68,0.08)':'rgba(12,189,115,0.1)',color:s.isBlocked?'#EF4444':tokens.accentDark,fontWeight:600}}/></TableCell>
                </TableRow>))}
            </TableBody>
          </Table></TableContainer>
        </Paper>
      )}
    </Box>
  );
}

function ResultsSection({ results }) {
  const [data, setData] = useState(results);
  const [loading, setLoading] = useState(!results.length);
  useEffect(()=>{if(!results.length)api.get('/admin/results').then(r=>setData(Array.isArray(r.data)?r.data:(r.data?.results||[]))).finally(()=>setLoading(false));else setData(results);},[results]);
  return(
    <Box>
      <SectionTitle>Results</SectionTitle>
      {loading?<Box sx={{display:'flex',justifyContent:'center',mt:6}}><CircularProgress sx={{color:tokens.accent}}/></Box>:(
        <Paper elevation={0} sx={{borderRadius:3,border:`1px solid ${tokens.surfaceBorder}`,bgcolor:'white',overflow:'hidden'}}>
          <TableContainer sx={{overflowX:'auto'}}><Table sx={{minWidth:440}}>
            <TableHead><TableRow sx={{bgcolor:'#F8FAFC'}}>{['Student','Exam','Score','Date'].map(h=><TableCell key={h} sx={{fontWeight:700,color:tokens.textSecondary,fontSize:12}}>{h}</TableCell>)}</TableRow></TableHead>
            <TableBody>
              {data.length===0?<TableRow><TableCell colSpan={4} align="center" sx={{py:5,color:tokens.textMuted}}>No results.</TableCell></TableRow>:
              data.slice(0,50).map(r=>{const pct=Math.round(r.percentage??0);return(
                <TableRow key={r._id} sx={{'&:hover':{bgcolor:'#F8FAFC'}}}>
                  <TableCell sx={{fontSize:13}}>{r.student?.firstName} {r.student?.lastName}</TableCell>
                  <TableCell sx={{fontSize:13,color:tokens.textMuted}}>{r.exam?.title}</TableCell>
                  <TableCell><Box sx={{display:'flex',alignItems:'center',gap:1}}><LinearProgress variant="determinate" value={pct} sx={{width:60,height:6,borderRadius:3,bgcolor:'#EEF2FF','& .MuiLinearProgress-bar':{bgcolor:pct>=70?tokens.accent:'#EF4444',borderRadius:3}}}/><Typography sx={{fontSize:12,fontWeight:700,color:pct>=70?tokens.accentDark:'#EF4444'}}>{pct}%</Typography></Box></TableCell>
                  <TableCell><Typography variant="caption" sx={{color:tokens.textMuted}}>{new Date(r.submittedAt||r.createdAt).toLocaleDateString()}</Typography></TableCell>
                </TableRow>);})}
            </TableBody>
          </Table></TableContainer>
        </Paper>
      )}
    </Box>
  );
}

function AnalyticsSection({ results, exams }) {
  const avg = results.length?Math.round(results.reduce((s,r)=>s+(r.percentage??0),0)/results.length):0;
  const passRate = results.length?Math.round((results.filter(r=>(r.percentage??0)>=50).length/results.length)*100):0;
  const perfData = results.slice(-7).map(r=>Math.round(r.percentage??0));
  return(
    <Box>
      <SectionTitle>Analytics</SectionTitle>
      <Grid container spacing={2} sx={{mb:3}}>
        {[{label:'Total Exams',value:exams.length,icon:<Assignment sx={{color:tokens.accent,fontSize:24}}/>,bg:'rgba(12,189,115,0.1)'},
          {label:'Total Results',value:results.length,icon:<BarChart sx={{color:'#6366F1',fontSize:24}}/>,bg:'rgba(99,102,241,0.1)'},
          {label:'Average Score',value:`${avg}%`,icon:<TrendingUp sx={{color:tokens.warning,fontSize:24}}/>,bg:'rgba(245,158,11,0.1)'},
          {label:'Pass Rate',value:`${passRate}%`,icon:<CheckCircle sx={{color:'#EC4899',fontSize:24}}/>,bg:'rgba(236,72,153,0.1)'}
        ].map((c,i)=>(
          <Grid item xs={6} md={3} key={i}>
            <Paper elevation={0} sx={{p:2.5,borderRadius:3,bgcolor:'white',border:`1px solid ${tokens.surfaceBorder}`,display:'flex',alignItems:'center',gap:2}}>
              <Box sx={{width:48,height:48,borderRadius:2.5,bgcolor:c.bg,display:'flex',alignItems:'center',justifyContent:'center'}}>{c.icon}</Box>
              <Box><Typography variant="h5" fontWeight={800} sx={{fontFamily:"'DM Sans',sans-serif"}}>{c.value}</Typography><Typography sx={{fontSize:12,color:tokens.textMuted,fontFamily:"'DM Sans',sans-serif"}}>{c.label}</Typography></Box>
            </Paper>
          </Grid>
        ))}
      </Grid>
      <Paper elevation={0} sx={{p:3,borderRadius:3,border:`1px solid ${tokens.surfaceBorder}`,bgcolor:'white'}}>
        <SectionTitle>Score Trend (Last 7 Results)</SectionTitle>
        <AreaChart data={perfData.length>=3?perfData:[50,60,45,75,65,80,72]} color={tokens.accent}/>
      </Paper>
    </Box>
  );
}

function SettingsSection({ user }) {
  const [first,setFirst]=useState(user?.firstName||'');
  const [last,setLast]=useState(user?.lastName||'');
  const [saved,setSaved]=useState(false);
  const save=async()=>{try{await api.put('/profile',{firstName:first,lastName:last});setSaved(true);setTimeout(()=>setSaved(false),2500);}catch{}};
  return(
    <Box>
      <SectionTitle>Settings</SectionTitle>
      <Paper elevation={0} sx={{p:3,borderRadius:3,bgcolor:'white',border:`1px solid ${tokens.surfaceBorder}`}}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}><TextField fullWidth label="First Name" value={first} onChange={e=>setFirst(e.target.value)} size="small" sx={{'& .MuiOutlinedInput-root':{borderRadius:2}}}/></Grid>
          <Grid item xs={12} md={6}><TextField fullWidth label="Last Name" value={last} onChange={e=>setLast(e.target.value)} size="small" sx={{'& .MuiOutlinedInput-root':{borderRadius:2}}}/></Grid>
          <Grid item xs={12}><TextField fullWidth label="Email" defaultValue={user?.email} size="small" InputProps={{readOnly:true}} sx={{'& .MuiOutlinedInput-root':{borderRadius:2}}}/></Grid>
          <Grid item xs={12}><Button variant="contained" onClick={save} sx={{borderRadius:2,fontWeight:700,background:gradients.brand,textTransform:'none'}}>{saved?'✓ Saved!':'Save Changes'}</Button></Grid>
        </Grid>
      </Paper>
    </Box>
  );
}

/* ── QUESTIONS BANK ── */
function QuestionsSection() {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [diffFilter, setDiffFilter] = useState('all');
  const [editQ, setEditQ] = useState(null);
  const [snack, setSnack] = useState('');
  const isXs = useMediaQuery('(max-width:600px)');

  const load = useCallback(() => {
    setLoading(true);
    api.get('/admin/questions').then(r => setQuestions(r.data || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this question?')) return;
    try { await api.delete(`/admin/questions/${id}`); setQuestions(p => p.filter(q => q._id !== id)); setSnack('Question deleted.'); }
    catch { setSnack('Error deleting question.'); }
  };

  const handleSaveEdit = async () => {
    try {
      const r = await api.put(`/admin/questions/${editQ._id}`, {
        text: editQ.text, points: editQ.points, difficulty: editQ.difficulty, correctAnswer: editQ.correctAnswer,
      });
      setQuestions(p => p.map(q => q._id === editQ._id ? { ...q, ...r.data } : q));
      setEditQ(null); setSnack('Question updated.');
    } catch { setSnack('Error updating question.'); }
  };

  const filtered = questions.filter(q => {
    const matchSearch = !search || q.text?.toLowerCase().includes(search.toLowerCase()) || q.exam?.title?.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === 'all' || q.type === typeFilter;
    const matchDiff = diffFilter === 'all' || q.difficulty === diffFilter;
    return matchSearch && matchType && matchDiff;
  });

  const typeColor = { 'multiple-choice': tokens.accent, 'open-ended': '#6366F1', 'true-false': tokens.warning, 'fill-in-blank': '#EC4899', 'matching': tokens.primary, 'ordering': '#8B5CF6' };
  const diffColor = { easy: tokens.accent, medium: tokens.warning, hard: '#EF4444' };

  return (
    <Box>
      <SectionTitle action={<Button size="small" startIcon={<Refresh fontSize="small"/>} onClick={load} sx={{ color: tokens.accent, textTransform: 'none', fontWeight: 700 }}>Refresh</Button>}>
        Question Bank
      </SectionTitle>

      {/* Summary bar */}
      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        {[
          { label: 'Total Questions', value: questions.length, color: tokens.accent, bg: 'rgba(12,189,115,0.08)' },
          { label: 'Multiple Choice', value: questions.filter(q => q.type === 'multiple-choice').length, color: '#6366F1', bg: 'rgba(99,102,241,0.08)' },
          { label: 'Open Ended', value: questions.filter(q => q.type === 'open-ended').length, color: tokens.warning, bg: 'rgba(245,158,11,0.08)' },
          { label: 'Exams Covered', value: [...new Set(questions.map(q => q.exam?._id))].filter(Boolean).length, color: tokens.primary, bg: 'rgba(13,64,108,0.08)' },
        ].map((s, i) => (
          <Grid item xs={6} sm={3} key={i}>
            <Paper elevation={0} sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 3, bgcolor: 'white', border: `1px solid ${tokens.surfaceBorder}` }}>
              <Typography fontWeight={800} sx={{ fontSize: { xs: '1.3rem', sm: '1.7rem' }, color: s.color, fontFamily: "'DM Sans',sans-serif" }}>{loading ? '…' : s.value}</Typography>
              <Typography sx={{ fontSize: 11.5, color: tokens.textMuted, fontFamily: "'DM Sans',sans-serif" }} noWrap>{s.label}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* Filters */}
      <Paper elevation={0} sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 3, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white', mb: 2 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
          <TextField size="small" placeholder="Search questions or exams…" value={search} onChange={e => setSearch(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" sx={{ color: tokens.textMuted }} /></InputAdornment>, sx: { borderRadius: 2 } }}
            sx={{ flexGrow: 1, minWidth: 180 }} />
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Type</InputLabel>
            <Select value={typeFilter} label="Type" onChange={e => setTypeFilter(e.target.value)} sx={{ borderRadius: 2 }}>
              <MenuItem value="all">All Types</MenuItem>
              {['multiple-choice','open-ended','true-false','fill-in-blank','matching','ordering'].map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel>Difficulty</InputLabel>
            <Select value={diffFilter} label="Difficulty" onChange={e => setDiffFilter(e.target.value)} sx={{ borderRadius: 2 }}>
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="easy">Easy</MenuItem>
              <MenuItem value="medium">Medium</MenuItem>
              <MenuItem value="hard">Hard</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Paper>

      {/* Table */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}><CircularProgress sx={{ color: tokens.accent }} /></Box>
      ) : (
        <Paper elevation={0} sx={{ borderRadius: 3, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white', overflow: 'hidden' }}>
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table sx={{ minWidth: 600 }}>
              <TableHead>
                <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                  {['Question', 'Type', 'Difficulty', 'Points', 'Exam', 'Actions'].map(h => (
                    <TableCell key={h} sx={{ fontWeight: 700, color: tokens.textSecondary, fontSize: 12, whiteSpace: 'nowrap' }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={6} align="center" sx={{ py: 6, color: tokens.textMuted }}>No questions found.</TableCell></TableRow>
                ) : filtered.map(q => (
                  <TableRow key={q._id} sx={{ '&:hover': { bgcolor: '#F8FAFC' } }}>
                    <TableCell sx={{ maxWidth: 280 }}>
                      <Typography variant="body2" sx={{ fontFamily: "'DM Sans',sans-serif", display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{q.text}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={q.type} size="small" sx={{ bgcolor: `${typeColor[q.type] || tokens.primary}18`, color: typeColor[q.type] || tokens.primary, fontWeight: 600, fontSize: 11, textTransform: 'capitalize' }} />
                    </TableCell>
                    <TableCell>
                      <Chip label={q.difficulty || 'medium'} size="small" sx={{ bgcolor: `${diffColor[q.difficulty || 'medium']}18`, color: diffColor[q.difficulty || 'medium'], fontWeight: 600, fontSize: 11 }} />
                    </TableCell>
                    <TableCell><Typography variant="body2" fontWeight={700} sx={{ color: tokens.primary }}>{q.points}</Typography></TableCell>
                    <TableCell><Typography variant="caption" sx={{ color: tokens.textMuted }} noWrap>{q.exam?.title || '—'}</Typography></TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Tooltip title="Edit"><IconButton size="small" onClick={() => setEditQ({ ...q })} sx={{ color: tokens.primary, '&:hover': { bgcolor: 'rgba(13,64,108,0.07)' } }}><Edit fontSize="small" /></IconButton></Tooltip>
                        <Tooltip title="Delete"><IconButton size="small" onClick={() => handleDelete(q._id)} sx={{ color: '#EF4444', '&:hover': { bgcolor: 'rgba(239,68,68,0.07)' } }}><Delete fontSize="small" /></IconButton></Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Box sx={{ p: 1.5, borderTop: `1px solid ${tokens.surfaceBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="caption" sx={{ color: tokens.textMuted }}>{filtered.length} of {questions.length} questions</Typography>
          </Box>
        </Paper>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editQ} onClose={() => setEditQ(null)} maxWidth="sm" fullWidth fullScreen={isXs} PaperProps={{ sx: { borderRadius: isXs ? 0 : 3 } }}>
        <DialogTitle sx={{ fontWeight: 700, fontFamily: "'DM Sans',sans-serif", display: 'flex', alignItems: 'center', gap: 1 }}>
          <Edit sx={{ color: tokens.primary }} /> Edit Question
        </DialogTitle>
        <DialogContent sx={{ pt: '12px !important' }}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField fullWidth multiline minRows={3} label="Question Text" value={editQ?.text || ''} onChange={e => setEditQ(p => ({ ...p, text: e.target.value }))} size="small" sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth label="Points" type="number" value={editQ?.points || 1} onChange={e => setEditQ(p => ({ ...p, points: Number(e.target.value) }))} size="small" sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Difficulty</InputLabel>
                <Select value={editQ?.difficulty || 'medium'} label="Difficulty" onChange={e => setEditQ(p => ({ ...p, difficulty: e.target.value }))} sx={{ borderRadius: 2 }}>
                  <MenuItem value="easy">Easy</MenuItem><MenuItem value="medium">Medium</MenuItem><MenuItem value="hard">Hard</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            {editQ?.type === 'open-ended' && (
              <Grid item xs={12}>
                <TextField fullWidth multiline minRows={2} label="Model Answer" value={editQ?.correctAnswer || ''} onChange={e => setEditQ(p => ({ ...p, correctAnswer: e.target.value }))} size="small" sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setEditQ(null)} sx={{ borderRadius: 2, textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveEdit} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, background: gradients.brand }}>Save</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack('')} message={snack} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </Box>
  );
}

/* ── REPORTS ── */
function ReportsSection() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);
  const [snack, setSnack] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api.get('/admin/reports/summary').then(r => setData(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const exportCSV = (rows, filename) => {
    if (!rows.length) return;
    const keys = Object.keys(rows[0]);
    const csv = [keys.join(','), ...rows.map(r => keys.map(k => JSON.stringify(r[k] ?? '')).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    setSnack(`${filename} downloaded.`);
  };

  const scoreColor = (v) => v === null ? tokens.textMuted : v >= 70 ? tokens.accentDark : v >= 50 ? tokens.warning : '#EF4444';

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress sx={{ color: tokens.accent }} /></Box>;

  const { summary, examStats = [], studentStats = [] } = data || {};

  return (
    <Box>
      <SectionTitle action={
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button size="small" startIcon={<Refresh fontSize="small" />} onClick={load} sx={{ color: tokens.accent, textTransform: 'none', fontWeight: 700 }}>Refresh</Button>
          <Button size="small" startIcon={<SaveAlt fontSize="small" />} onClick={() => exportCSV(
            examStats.map(e => ({ Title: e.title, Status: e.status, Submissions: e.submissions, 'Avg Score': e.avgScore ?? 'N/A', 'Pass Rate': e.passRate !== null ? `${e.passRate}%` : 'N/A' })),
            'exam-report.csv'
          )} sx={{ color: tokens.primary, textTransform: 'none', fontWeight: 700 }}>Export CSV</Button>
        </Box>
      }>Reports</SectionTitle>

      {/* Summary cards */}
      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        {[
          { label: 'Total Exams', value: summary?.totalExams ?? 0, color: tokens.accent, bg: 'rgba(12,189,115,0.08)', icon: <Assignment sx={{ color: tokens.accent, fontSize: 22 }} /> },
          { label: 'Total Students', value: summary?.totalStudents ?? 0, color: '#6366F1', bg: 'rgba(99,102,241,0.08)', icon: <People sx={{ color: '#6366F1', fontSize: 22 }} /> },
          { label: 'Submissions', value: summary?.totalSubmissions ?? 0, color: tokens.primary, bg: 'rgba(13,64,108,0.08)', icon: <ListAlt sx={{ color: tokens.primary, fontSize: 22 }} /> },
          { label: 'Avg Score', value: `${summary?.overallAvgScore ?? 0}%`, color: tokens.warning, bg: 'rgba(245,158,11,0.08)', icon: <BarChart sx={{ color: tokens.warning, fontSize: 22 }} /> },
          { label: 'Pass Rate', value: `${summary?.overallPassRate ?? 0}%`, color: '#EC4899', bg: 'rgba(236,72,153,0.08)', icon: <CheckCircle sx={{ color: '#EC4899', fontSize: 22 }} /> },
        ].map((s, i) => (
          <Grid item xs={6} sm={4} md={2.4} key={i}>
            <Paper elevation={0} sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 3, bgcolor: 'white', border: `1px solid ${tokens.surfaceBorder}`, display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{s.icon}</Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography fontWeight={800} sx={{ fontSize: { xs: '1.1rem', sm: '1.35rem' }, color: s.color, fontFamily: "'DM Sans',sans-serif", lineHeight: 1 }}>{s.value}</Typography>
                <Typography sx={{ fontSize: 11, color: tokens.textMuted, fontFamily: "'DM Sans',sans-serif" }} noWrap>{s.label}</Typography>
              </Box>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* Tabs */}
      <Paper elevation={0} sx={{ borderRadius: 3, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white', overflow: 'hidden' }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: `1px solid ${tokens.surfaceBorder}`, px: 2, '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, fontFamily: "'DM Sans',sans-serif", fontSize: 13 }, '& .MuiTabs-indicator': { bgcolor: tokens.accent } }}>
          <Tab label={`By Exam (${examStats.length})`} />
          <Tab label={`By Student (${studentStats.length})`} />
        </Tabs>

        {tab === 0 && (
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table sx={{ minWidth: 560 }}>
              <TableHead>
                <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                  {['Exam Title', 'Status', 'Submissions', 'Avg Score', 'Pass Rate'].map(h => (
                    <TableCell key={h} sx={{ fontWeight: 700, color: tokens.textSecondary, fontSize: 12, whiteSpace: 'nowrap' }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {examStats.length === 0 ? (
                  <TableRow><TableCell colSpan={5} align="center" sx={{ py: 5, color: tokens.textMuted }}>No data yet.</TableCell></TableRow>
                ) : examStats.map(e => {
                  const sc = e.status === 'active' ? tokens.accent : e.status === 'completed' ? '#6366F1' : tokens.warning;
                  return (
                    <TableRow key={e._id} sx={{ '&:hover': { bgcolor: '#F8FAFC' } }}>
                      <TableCell><Typography variant="body2" fontWeight={600} sx={{ fontFamily: "'DM Sans',sans-serif" }}>{e.title}</Typography></TableCell>
                      <TableCell><Chip label={e.status} size="small" sx={{ bgcolor: `${sc}18`, color: sc, fontWeight: 600, textTransform: 'capitalize' }} /></TableCell>
                      <TableCell><Typography variant="body2" fontWeight={700} sx={{ color: tokens.primary }}>{e.submissions}</Typography></TableCell>
                      <TableCell>
                        {e.avgScore !== null
                          ? <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <LinearProgress variant="determinate" value={e.avgScore} sx={{ width: 55, height: 6, borderRadius: 3, bgcolor: '#EEF2FF', '& .MuiLinearProgress-bar': { bgcolor: scoreColor(e.avgScore), borderRadius: 3 } }} />
                              <Typography sx={{ fontSize: 12, fontWeight: 700, color: scoreColor(e.avgScore) }}>{e.avgScore}%</Typography>
                            </Box>
                          : <Typography variant="caption" sx={{ color: tokens.textMuted }}>—</Typography>}
                      </TableCell>
                      <TableCell>
                        {e.passRate !== null
                          ? <Chip label={`${e.passRate}%`} size="small" sx={{ bgcolor: e.passRate >= 70 ? 'rgba(12,189,115,0.1)' : 'rgba(239,68,68,0.08)', color: e.passRate >= 70 ? tokens.accentDark : '#EF4444', fontWeight: 700 }} />
                          : <Typography variant="caption" sx={{ color: tokens.textMuted }}>—</Typography>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {tab === 1 && (
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table sx={{ minWidth: 480 }}>
              <TableHead>
                <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                  {['Student', 'Class', 'Exams Done', 'Avg Score'].map(h => (
                    <TableCell key={h} sx={{ fontWeight: 700, color: tokens.textSecondary, fontSize: 12, whiteSpace: 'nowrap' }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {studentStats.length === 0 ? (
                  <TableRow><TableCell colSpan={4} align="center" sx={{ py: 5, color: tokens.textMuted }}>No data yet.</TableCell></TableRow>
                ) : studentStats.map(s => (
                  <TableRow key={s._id} sx={{ '&:hover': { bgcolor: '#F8FAFC' } }}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar sx={{ width: 30, height: 30, fontSize: 12, fontWeight: 700, bgcolor: 'rgba(12,189,115,0.1)', color: tokens.accentDark }}>{s.firstName?.charAt(0)}</Avatar>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={600} sx={{ fontFamily: "'DM Sans',sans-serif" }} noWrap>{s.firstName} {s.lastName}</Typography>
                          <Typography variant="caption" sx={{ color: tokens.textMuted }} noWrap>{s.email}</Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell><Chip label={s.class || 'N/A'} size="small" sx={{ bgcolor: 'rgba(13,64,108,0.07)', color: tokens.primary }} /></TableCell>
                    <TableCell><Typography variant="body2" fontWeight={700} sx={{ color: tokens.primary }}>{s.examsCompleted}</Typography></TableCell>
                    <TableCell>
                      {s.avgScore !== null
                        ? <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <LinearProgress variant="determinate" value={s.avgScore} sx={{ width: 55, height: 6, borderRadius: 3, bgcolor: '#EEF2FF', '& .MuiLinearProgress-bar': { bgcolor: scoreColor(s.avgScore), borderRadius: 3 } }} />
                            <Typography sx={{ fontSize: 12, fontWeight: 700, color: scoreColor(s.avgScore) }}>{s.avgScore}%</Typography>
                          </Box>
                        : <Typography variant="caption" sx={{ color: tokens.textMuted }}>—</Typography>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        <Box sx={{ p: 1.5, borderTop: `1px solid ${tokens.surfaceBorder}`, display: 'flex', justifyContent: 'flex-end' }}>
          <Button size="small" startIcon={<Download fontSize="small" />} onClick={() => exportCSV(
            tab === 0
              ? examStats.map(e => ({ Title: e.title, Status: e.status, Submissions: e.submissions, AvgScore: e.avgScore ?? '', PassRate: e.passRate !== null ? `${e.passRate}%` : '' }))
              : studentStats.map(s => ({ Name: `${s.firstName} ${s.lastName}`, Email: s.email, Class: s.class || '', ExamsDone: s.examsCompleted, AvgScore: s.avgScore ?? '' })),
            tab === 0 ? 'exam-report.csv' : 'student-report.csv'
          )} sx={{ color: tokens.primary, textTransform: 'none', fontWeight: 700, fontSize: 12 }}>
            Export CSV
          </Button>
        </Box>
      </Paper>

      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack('')} message={snack} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </Box>
  );
}

/* ── TEMPLATES ── */
function TemplatesSection({ exams, setExams }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveDialog, setSaveDialog] = useState(false);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [snack, setSnack] = useState('');
  const isXs = useMediaQuery('(max-width:600px)');

  const load = useCallback(() => {
    setLoading(true);
    api.get('/admin/templates').then(r => setTemplates(r.data || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSaveAsTemplate = async () => {
    if (!selectedExamId) return;
    setSaving(true);
    try {
      const r = await api.post('/admin/templates', { examId: selectedExamId });
      setTemplates(p => [r.data, ...p]);
      setSaveDialog(false); setSelectedExamId('');
      setSnack('Exam saved as template!');
    } catch (e) { setSnack(e.response?.data?.message || 'Error saving template.'); }
    finally { setSaving(false); }
  };

  const handleUse = async (id) => {
    try {
      const r = await api.post(`/admin/templates/${id}/use`);
      setExams(p => [r.data, ...p]);
      setSnack('New exam created from template! Go to My Exams to view it.');
    } catch { setSnack('Error creating exam from template.'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this template?')) return;
    try { await api.delete(`/admin/templates/${id}`); setTemplates(p => p.filter(t => t._id !== id)); setSnack('Template deleted.'); }
    catch { setSnack('Error deleting template.'); }
  };

  const totalQs = (t) => t.sections?.reduce((s, sec) => s + (sec.questions?.length || 0), 0) || 0;

  return (
    <Box>
      <SectionTitle action={
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button size="small" startIcon={<Refresh fontSize="small" />} onClick={load} sx={{ color: tokens.accent, textTransform: 'none', fontWeight: 700 }}>Refresh</Button>
          <Button size="small" variant="contained" startIcon={<Add fontSize="small" />} onClick={() => setSaveDialog(true)}
            sx={{ background: gradients.brand, borderRadius: 2.5, textTransform: 'none', fontWeight: 700 }}>
            Save Exam as Template
          </Button>
        </Box>
      }>Templates</SectionTitle>

      {/* Info banner */}
      <Paper elevation={0} sx={{ p: 2, mb: 2.5, borderRadius: 3, bgcolor: 'rgba(13,64,108,0.04)', border: `1px solid rgba(13,64,108,0.1)`, display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
        <Description sx={{ color: tokens.primary, mt: 0.25, flexShrink: 0 }} />
        <Box>
          <Typography fontWeight={700} sx={{ fontSize: 13.5, color: tokens.textPrimary, fontFamily: "'DM Sans',sans-serif" }}>What are templates?</Typography>
          <Typography sx={{ fontSize: 12.5, color: tokens.textMuted, fontFamily: "'DM Sans',sans-serif", mt: 0.25 }}>
            Save any of your exams as a reusable template. Use a template to instantly create a new draft exam with the same structure, questions, and settings — then customise it as needed.
          </Typography>
        </Box>
      </Paper>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress sx={{ color: tokens.accent }} /></Box>
      ) : templates.length === 0 ? (
        <Paper elevation={0} sx={{ p: 5, borderRadius: 3, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white', textAlign: 'center' }}>
          <Box sx={{ width: 64, height: 64, borderRadius: 3, bgcolor: 'rgba(13,64,108,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2 }}>
            <Description sx={{ fontSize: 32, color: tokens.primary }} />
          </Box>
          <Typography variant="h6" fontWeight={700} sx={{ fontFamily: "'DM Sans',sans-serif", color: tokens.textPrimary }}>No templates yet</Typography>
          <Typography sx={{ color: tokens.textMuted, fontFamily: "'DM Sans',sans-serif", mb: 2.5, mt: 0.5 }}>Save one of your exams as a template to get started.</Typography>
          <Button variant="contained" startIcon={<Add />} onClick={() => setSaveDialog(true)} sx={{ background: gradients.brand, borderRadius: 2.5, textTransform: 'none', fontWeight: 700 }}>
            Save Exam as Template
          </Button>
        </Paper>
      ) : (
        <Grid container spacing={2.5}>
          {templates.map(t => (
            <Grid item xs={12} sm={6} md={4} key={t._id}>
              <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white', height: '100%', display: 'flex', flexDirection: 'column', transition: 'box-shadow 0.2s', '&:hover': { boxShadow: '0 6px 24px rgba(13,64,108,0.09)' } }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1.5 }}>
                  <Box sx={{ width: 42, height: 42, borderRadius: 2.5, bgcolor: 'rgba(13,64,108,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Description sx={{ color: tokens.primary, fontSize: 22 }} />
                  </Box>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <Tooltip title="Use template (creates new exam)">
                      <IconButton size="small" onClick={() => handleUse(t._id)} sx={{ color: tokens.accent, '&:hover': { bgcolor: 'rgba(12,189,115,0.1)' } }}><ContentCopy fontSize="small" /></IconButton>
                    </Tooltip>
                    <Tooltip title="Delete template">
                      <IconButton size="small" onClick={() => handleDelete(t._id)} sx={{ color: '#EF4444', '&:hover': { bgcolor: 'rgba(239,68,68,0.07)' } }}><Delete fontSize="small" /></IconButton>
                    </Tooltip>
                  </Box>
                </Box>

                <Typography fontWeight={700} sx={{ fontSize: 14.5, color: tokens.textPrimary, fontFamily: "'DM Sans',sans-serif", mb: 0.5, flexGrow: 1 }}>
                  {t.title.replace('[Template] ', '')}
                </Typography>
                <Typography variant="caption" sx={{ color: tokens.textMuted, mb: 1.5, display: 'block', fontFamily: "'DM Sans',sans-serif" }} noWrap>
                  {t.description}
                </Typography>

                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 2 }}>
                  <Chip label={`${t.timeLimit} min`} size="small" sx={{ bgcolor: 'rgba(13,64,108,0.07)', color: tokens.primary, fontWeight: 600, fontSize: 11 }} />
                  <Chip label={`${totalQs(t)} questions`} size="small" sx={{ bgcolor: 'rgba(12,189,115,0.08)', color: tokens.accentDark, fontWeight: 600, fontSize: 11 }} />
                  <Chip label={`Pass: ${t.passingScore}%`} size="small" sx={{ bgcolor: 'rgba(245,158,11,0.08)', color: tokens.warning, fontWeight: 600, fontSize: 11 }} />
                </Box>

                <Divider sx={{ mb: 1.5 }} />

                {t.sections?.map((sec, si) => (
                  <Box key={si} sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography sx={{ fontSize: 12, color: tokens.textMuted, fontFamily: "'DM Sans',sans-serif" }}>Section {sec.name}</Typography>
                    <Typography sx={{ fontSize: 12, fontWeight: 600, color: tokens.textSecondary, fontFamily: "'DM Sans',sans-serif" }}>{sec.questions?.length || 0} questions</Typography>
                  </Box>
                ))}

                <Button fullWidth size="small" startIcon={<PlayArrow fontSize="small" />} onClick={() => handleUse(t._id)}
                  sx={{ mt: 1.5, color: tokens.accent, fontWeight: 700, fontSize: 12.5, textTransform: 'none', bgcolor: 'rgba(12,189,115,0.06)', borderRadius: 2, py: 0.75, '&:hover': { bgcolor: 'rgba(12,189,115,0.12)' } }}>
                  Use This Template
                </Button>

                <Typography variant="caption" sx={{ color: tokens.textMuted, mt: 1, textAlign: 'center', display: 'block', fontSize: 11 }}>
                  Created {new Date(t.createdAt).toLocaleDateString()}
                </Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Save as template dialog */}
      <Dialog open={saveDialog} onClose={() => setSaveDialog(false)} maxWidth="xs" fullWidth fullScreen={isXs} PaperProps={{ sx: { borderRadius: isXs ? 0 : 3 } }}>
        <DialogTitle sx={{ fontWeight: 700, fontFamily: "'DM Sans',sans-serif", display: 'flex', alignItems: 'center', gap: 1 }}>
          <Description sx={{ color: tokens.primary }} /> Save Exam as Template
        </DialogTitle>
        <DialogContent sx={{ pt: '12px !important' }}>
          <Typography sx={{ color: tokens.textMuted, mb: 2, fontSize: 13.5, fontFamily: "'DM Sans',sans-serif" }}>
            Select an exam to save as a reusable template. The original exam will not be changed.
          </Typography>
          <FormControl fullWidth size="small">
            <InputLabel>Select Exam</InputLabel>
            <Select value={selectedExamId} label="Select Exam" onChange={e => setSelectedExamId(e.target.value)} sx={{ borderRadius: 2 }}>
              {exams.filter(e => e.status !== 'template').map(e => (
                <MenuItem key={e._id} value={e._id}>{e.title} <Typography component="span" variant="caption" sx={{ ml: 1, color: tokens.textMuted }}>({e.status})</Typography></MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setSaveDialog(false)} sx={{ borderRadius: 2, textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained" disabled={!selectedExamId || saving} onClick={handleSaveAsTemplate}
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, background: gradients.brand }}>
            {saving ? <CircularProgress size={18} color="inherit" /> : 'Save Template'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack('')} message={snack} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </Box>
  );
}
