import { useState, useEffect } from 'react';
import {
  Box, Typography, Chip, Button, Paper, Grid, TextField,
  CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  useMediaQuery, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, LinearProgress, IconButton, Tooltip, Avatar,
  Select, MenuItem, InputAdornment, FormControl, InputLabel, OutlinedInput,
  Snackbar, Alert, Divider
} from '@mui/material';
import {
  Dashboard as DashIcon, People, Assignment, BarChart, Settings,
  SupervisorAccount, TrendingUp, PersonAdd, CheckCircle,
  Delete, Edit, Close, Add, ArrowForward, Visibility, VisibilityOff, Male, Female
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { tokens, gradients } from './dashboardTokens';
import { DashboardShell, Sidebar, Topbar, SectionTitle, getDynamicGreeting } from './DashboardShell';
import SubscriptionWarning from '../components/SubscriptionWarning';

const nav = [
  { id: 'home',     label: 'Overview',   icon: <DashIcon sx={{ fontSize: 20 }} /> },
  { id: 'teachers', label: 'Teachers',   icon: <SupervisorAccount sx={{ fontSize: 20 }} /> },
  { id: 'students', label: 'Students',   icon: <People sx={{ fontSize: 20 }} /> },
  { id: 'exams',    label: 'Exams',      icon: <Assignment sx={{ fontSize: 20 }} /> },
  { id: 'results',  label: 'Results',    icon: <BarChart sx={{ fontSize: 20 }} /> },
  { id: 'analytics',label: 'Analytics',  icon: <TrendingUp sx={{ fontSize: 20 }} /> },
  { id: 'settings', label: 'Settings',   icon: <Settings sx={{ fontSize: 20 }} /> },
];

function AreaChart({ data = [], color = tokens.accent }) {
  if (!data.length || data.length < 2) data = [50,60,45,75,65,80,72];
  const w = 380, h = 110, max = Math.max(...data) || 100;
  const pts = data.map((v, i) => `${(i/(data.length-1))*w},${h-(v/max)*(h-12)-6}`).join(' ');
  const area = `${pts} ${w},${h} 0,${h}`;
  const labels = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  return (
    <svg viewBox={`0 0 ${w} ${h+22}`} style={{ width: '100%', height: 140 }}>
      <defs><linearGradient id="ag2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.22"/><stop offset="100%" stopColor={color} stopOpacity="0.02"/></linearGradient></defs>
      {[0,25,50,75,100].map(y=><line key={y} x1="0" x2={w} y1={h-(y/100)*(h-12)-6} y2={h-(y/100)*(h-12)-6} stroke="#E2E8F0" strokeWidth="1"/>)}
      <polygon points={area} fill="url(#ag2)"/>
      <polyline fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={pts}/>
      {data.map((v,i)=>{const cx=(i/(data.length-1))*w,cy=h-(v/max)*(h-12)-6;return<circle key={i} cx={cx} cy={cy} r="4" fill="white" stroke={color} strokeWidth="2"/>;})}
      {labels.slice(0,data.length).map((l,i)=><text key={i} x={(i/(Math.max(data.length,1)-1))*w} y={h+18} textAnchor="middle" fontSize="10" fill={tokens.textMuted}>{l}</text>)}
    </svg>
  );
}

export default function OrgAdminDashboard() {
  const isMobile = useMediaQuery('(max-width:900px)');
  const isXs = useMediaQuery('(max-width:600px)');
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const [activeSection, setActiveSection] = useState('home');
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [teachers, setTeachers] = useState([]);
  const [exams, setExams] = useState([]);
  const [results, setResults] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (query) => {
    setSearchQuery(query);
  };

  useEffect(() => {
    if (!user) return; // Don't fetch if user is not authenticated
    
    api.get('/admin/dashboard-stats').then(r => setStats(r.data)).catch(() => setStats({})).finally(() => setStatsLoading(false));
    api.get('/admin/teachers').then(r => setTeachers(r.data || [])).catch(() => {});
    api.get('/admin/exams').then(r => setExams((r.data || []).slice(0, 10))).catch(() => {});
    api.get('/admin/results').then(r => setResults(Array.isArray(r.data) ? r.data : (r.data?.results || []))).catch(() => {});
  }, [user]);

  const filteredExams = exams.filter(exam =>
    !searchQuery ||
    exam.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    exam.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredTeachers = teachers.filter(teacher =>
    !searchQuery ||
    teacher.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    teacher.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    teacher.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <DashboardShell
      sidebarEl={<Sidebar user={user} logout={logout} activeSection={activeSection} setActiveSection={setActiveSection} onClose={() => setSidebarOpen(false)} isMobile={isMobile} nav={nav} portalLabel="School Admin" />}
      topbarEl={<Topbar greeting={getDynamicGreeting(user?.firstName || 'Admin')} sub={user?.organization ? `${user.organization} · School Admin` : "Here's what's happening today."} user={user} onMenuClick={() => setSidebarOpen(v => !v)} onLogout={logout} roleLabel="School Admin" onSearch={handleSearch} />}
      sidebarOpen={sidebarOpen} isMobile={isMobile} onCloseSidebar={() => setSidebarOpen(false)}>
      <SubscriptionWarning user={user} onLogout={logout} />
      {activeSection === 'home'      && <OverviewSection stats={stats} statsLoading={statsLoading} teachers={filteredTeachers} exams={filteredExams} results={results} setActiveSection={setActiveSection} />}
      {activeSection === 'teachers'  && <TeachersSection teachers={filteredTeachers} setTeachers={setTeachers} />}
      {activeSection === 'students'  && <StudentsSection />}
      {activeSection === 'exams'     && <ExamsSection exams={filteredExams} />}
      {activeSection === 'results'   && <ResultsSection results={results} />}
      {activeSection === 'analytics' && <AnalyticsSection results={results} exams={filteredExams} teachers={filteredTeachers} />}
      {activeSection === 'settings'  && <SettingsSection user={user} />}
    </DashboardShell>
  );
}

/* ── OVERVIEW ── */
function OverviewSection({ stats, statsLoading, teachers, exams, results, setActiveSection }) {
  const avg = results.length ? Math.round(results.reduce((s,r)=>s+(r.percentage??0),0)/results.length) : 0;
  const perfData = results.slice(-7).map(r => Math.round(r.percentage ?? 0));

  const statCards = [
    { label: 'Total Teachers', value: stats?.totalTeachers ?? teachers.length, sub: `${teachers.length} active`, subColor: tokens.primary, iconBg: 'rgba(13,64,108,0.1)', icon: <SupervisorAccount sx={{ color: tokens.primary, fontSize: 24 }} /> },
    { label: 'Total Students', value: stats?.totalStudents ?? 0, sub: 'enrolled', subColor: tokens.accent, iconBg: 'rgba(12,189,115,0.1)', icon: <People sx={{ color: tokens.accent, fontSize: 24 }} /> },
    { label: 'Active Exams',   value: stats?.activeExams ?? 0,   sub: 'this month', subColor: tokens.warning, iconBg: 'rgba(245,158,11,0.1)', icon: <Assignment sx={{ color: tokens.warning, fontSize: 24 }} /> },
    { label: 'Average Score',  value: `${avg}%`,                 sub: `${results.length} results`, subColor: '#6366F1', iconBg: 'rgba(99,102,241,0.1)', icon: <BarChart sx={{ color: '#6366F1', fontSize: 24 }} /> },
  ];

  return (
    <Box>
      {/* Hero */}
      <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: 3, background: gradients.brand, color: 'white', position: 'relative', overflow: 'hidden' }}>
        <Box sx={{ position: 'absolute', right: -50, top: -50, width: 200, height: 200, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.06)' }} />
        <Typography variant="h5" fontWeight={700} sx={{ fontFamily: "'DM Sans',sans-serif" }}>School Overview</Typography>
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', mt: 0.5, fontFamily: "'DM Sans',sans-serif" }}>Manage your teachers, students and exams from one place.</Typography>
      </Paper>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {statCards.map((s, i) => (
          <Grid item xs={6} md={3} key={i}>
            <Paper elevation={0} sx={{ p: { xs: 1.5, sm: 2.5 }, borderRadius: 3, bgcolor: 'white', border: `1px solid ${tokens.surfaceBorder}`, '&:hover': { boxShadow: '0 6px 24px rgba(13,64,108,0.09)' } }}>
              <Box sx={{ width: { xs: 38, sm: 48 }, height: { xs: 38, sm: 48 }, borderRadius: 2.5, bgcolor: s.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1.5 }}>{s.icon}</Box>
              {statsLoading ? <CircularProgress size={20} sx={{ color: tokens.accent }} /> :
                <Typography fontWeight={800} sx={{ color: tokens.textPrimary, fontFamily: "'DM Sans',sans-serif", lineHeight: 1, fontSize: { xs: '1.25rem', sm: '1.5rem', md: '2.125rem' } }}>{s.value}</Typography>}
              <Typography sx={{ fontSize: { xs: 11, sm: 12.5 }, color: tokens.textMuted, fontFamily: "'DM Sans',sans-serif", mt: 0.25 }} noWrap>{s.label}</Typography>
              <Typography sx={{ fontSize: { xs: 10.5, sm: 11.5 }, color: s.subColor, fontWeight: 600, fontFamily: "'DM Sans',sans-serif", mt: 0.35 }} noWrap>{s.sub}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2.5}>
        {/* Recent Teachers */}
        <Grid item xs={12} sm={5} md={5}>
          <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white' }}>
            <SectionTitle action={<Button size="small" onClick={() => setActiveSection('teachers')} sx={{ color: tokens.accent, fontWeight: 700, fontSize: 12, textTransform: 'none' }}>View All</Button>}>Recent Teachers</SectionTitle>
            {teachers.length === 0 ? <Typography sx={{ color: tokens.textMuted, fontSize: 13 }}>No teachers yet.</Typography> :
              teachers.slice(0, 5).map((t, i) => (
                <Box key={t._id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1.25, borderBottom: i < 4 ? `1px solid ${tokens.surfaceBorder}` : 'none' }}>
                  <Avatar sx={{ width: 34, height: 34, bgcolor: 'rgba(13,64,108,0.1)', color: tokens.primary, fontWeight: 700, fontSize: 14 }}>{t.firstName?.charAt(0)}</Avatar>
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="body2" fontWeight={600} sx={{ fontFamily: "'DM Sans',sans-serif" }}>{t.firstName} {t.lastName}</Typography>
                    <Typography variant="caption" sx={{ color: tokens.textMuted }}>{t.email}</Typography>
                  </Box>
                  <Chip label="Active" size="small" sx={{ bgcolor: 'rgba(12,189,115,0.1)', color: tokens.accentDark, fontWeight: 600, fontSize: 11 }} />
                </Box>
              ))}
          </Paper>
        </Grid>

        {/* Performance */}
        <Grid item xs={12} sm={7} md={7}>
          <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white' }}>
            <SectionTitle action={<Chip label="This Week" size="small" sx={{ bgcolor: '#F1F5F9', color: tokens.textSecondary, fontSize: 11 }} />}>Performance Overview</SectionTitle>
            <AreaChart data={perfData.length >= 3 ? perfData : [55,65,50,80,70,85,75]} color={tokens.accent} />
            {avg > 0 && <Box sx={{ textAlign: 'center', mt: 0.5 }}><Chip label={`${avg}% Average Score`} sx={{ bgcolor: 'rgba(12,189,115,0.1)', color: tokens.accentDark, fontWeight: 700, fontSize: 12 }} /></Box>}
            <Button fullWidth size="small" endIcon={<ArrowForward fontSize="small" />} onClick={() => setActiveSection('analytics')}
              sx={{ mt: 1.5, color: tokens.accent, fontWeight: 600, fontSize: 12, textTransform: 'none', bgcolor: 'rgba(12,189,115,0.05)', borderRadius: 2, py: 1, '&:hover': { bgcolor: 'rgba(12,189,115,0.1)' } }}>
              View Analytics
            </Button>
          </Paper>
        </Grid>
      </Grid>

      {/* Quick Actions */}
      <Paper elevation={0} sx={{ mt: 2.5, p: 2.5, borderRadius: 3, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white' }}>
        <Typography fontWeight={700} sx={{ fontSize: 15, fontFamily: "'DM Sans',sans-serif", mb: 2 }}>Quick Actions</Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
          {[
            { label: 'Add Teacher',    icon: <PersonAdd sx={{ fontSize: 18 }} />,  color: tokens.primary, bg: 'rgba(13,64,108,0.07)',   section: 'teachers' },
            { label: 'View Exams',     icon: <Assignment sx={{ fontSize: 18 }} />, color: tokens.accent,  bg: 'rgba(12,189,115,0.09)',  section: 'exams' },
            { label: 'View Students',  icon: <People sx={{ fontSize: 18 }} />,      color: '#6366F1',      bg: 'rgba(99,102,241,0.09)',  section: 'students' },
            { label: 'Analytics',      icon: <BarChart sx={{ fontSize: 18 }} />,    color: tokens.warning, bg: 'rgba(245,158,11,0.09)',  section: 'analytics' },
          ].map((a, i) => (
            <Box key={i} onClick={() => setActiveSection(a.section)} sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: { xs: 1.5, sm: 2.5 }, py: 1.5, borderRadius: 2.5, bgcolor: a.bg, cursor: 'pointer', flex: '1 1 130px', minWidth: { xs: 0, sm: 130 }, border: `1px solid ${a.color}18`, transition: 'opacity 0.15s', '&:hover': { opacity: 0.82 } }}>
              <Box sx={{ color: a.color }}>{a.icon}</Box>
              <Typography fontWeight={700} sx={{ color: a.color, fontSize: 13.5, fontFamily: "'DM Sans',sans-serif" }}>{a.label}</Typography>
            </Box>
          ))}
        </Box>
      </Paper>
    </Box>
  );
}

/* ── TEACHERS ── */
function TagInput({ label, value, onChange }) {
  const [input, setInput] = useState('');
  const handleKey = (e) => {
    if ((e.key === 'Enter' || e.key === ',') && input.trim()) {
      e.preventDefault();
      const tag = input.trim().replace(/,$/, '');
      if (tag && !value.includes(tag)) onChange([...value, tag]);
      setInput('');
    } else if (e.key === 'Backspace' && !input && value.length) {
      onChange(value.slice(0, -1));
    }
  };
  return (
    <Box sx={{ border: '1px solid rgba(0,0,0,0.23)', borderRadius: 2, px: 1.5, pt: 1, pb: 0.5, '&:hover': { borderColor: 'rgba(0,0,0,0.87)' }, minHeight: 40 }}>
      <Typography variant="caption" sx={{ color: 'rgba(0,0,0,0.6)', fontSize: 11, display: 'block', mb: 0.25 }}>{label} — press Enter or comma to add</Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 0.5 }}>
        {value.map((v, i) => (
          <Chip key={i} label={v} size="small" onDelete={() => onChange(value.filter((_, idx) => idx !== i))}
            sx={{ fontSize: 12, height: 24, bgcolor: 'rgba(13,64,108,0.09)', color: tokens.primary }} />
        ))}
      </Box>
      <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey}
        placeholder={value.length ? '' : `Add ${label.toLowerCase()}…`}
        style={{ border: 'none', outline: 'none', fontSize: 13, width: '100%', padding: '2px 0', fontFamily: 'inherit', background: 'transparent' }} />
    </Box>
  );
}

const ACTION_LABELS = {
  add_teacher: { label: 'Added teacher', color: '#0CBD73', bg: 'rgba(12,189,115,0.1)' },
  edit_teacher: { label: 'Edited teacher', color: '#6366F1', bg: 'rgba(99,102,241,0.1)' },
  delete_teacher: { label: 'Deleted teacher', color: '#EF4444', bg: 'rgba(239,68,68,0.08)' },
  create_exam: { label: 'Created exam', color: '#0D406C', bg: 'rgba(13,64,108,0.08)' },
  edit_exam: { label: 'Edited exam', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
  schedule_exam: { label: 'Scheduled exam', color: '#8B5CF6', bg: 'rgba(139,92,246,0.1)' },
  lock_exam: { label: 'Locked exam', color: '#EF4444', bg: 'rgba(239,68,68,0.08)' },
  unlock_exam: { label: 'Unlocked exam', color: '#0CBD73', bg: 'rgba(12,189,115,0.1)' },
  add_student: { label: 'Added student', color: '#0D406C', bg: 'rgba(13,64,108,0.08)' },
  edit_student: { label: 'Edited student', color: '#6366F1', bg: 'rgba(99,102,241,0.1)' },
  delete_student: { label: 'Deleted student', color: '#EF4444', bg: 'rgba(239,68,68,0.08)' },
  grade_exam: { label: 'Graded exam', color: '#0CBD73', bg: 'rgba(12,189,115,0.1)' },
  login: { label: 'Logged in', color: '#6366F1', bg: 'rgba(99,102,241,0.1)' },
};

function timeAgo(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function TeachersSection({ teachers, setTeachers }) {
  const isXs = useMediaQuery('(max-width:600px)');
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const emptyForm = { firstName: '', lastName: '', email: '', password: '', phone: '', gender: '', subjects: [], classes: [] };
  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', email: '', phone: '', gender: '', subjects: [], classes: [] });
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [genderFilter, setGenderFilter] = useState('');
  const [addError, setAddError] = useState('');
  const [activities, setActivities] = useState([]);
  const [activitiesLoading, setActivitiesLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/activity-logs').then(r => setActivities(r.data || [])).catch(() => {}).finally(() => setActivitiesLoading(false));
  }, []);

  const handleAdd = async () => {
    setSaving(true);
    setAddError('');
    try {
      const r = await api.post('/admin/teachers', form);
      setTeachers(p => [...p, r.data]);
      setAddOpen(false);
      setForm(emptyForm);
      setShowPassword(false);
    } catch (err) {
      setAddError(err.response?.data?.message || 'Failed to add teacher.');
    } finally { setSaving(false); }
  };

  const handleEdit = async () => {
    if (!editTarget) return;
    setSaving(true);
    try {
      const r = await api.put(`/admin/teachers/${editTarget._id}`, editForm);
      setTeachers(p => p.map(t => t._id === editTarget._id ? { ...t, ...r.data } : t));
      setEditTarget(null);
    } catch {} finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await api.delete(`/admin/teachers/${deleteTarget._id}`);
      setTeachers(p => p.filter(t => t._id !== deleteTarget._id));
      setDeleteTarget(null);
    } catch {} finally { setSaving(false); }
  };

  const openEdit = (t) => {
    setEditForm({
      firstName: t.firstName || '', lastName: t.lastName || '', email: t.email || '',
      phone: t.phone || '', gender: t.gender || '',
      subjects: Array.isArray(t.subjects) ? t.subjects : [],
      classes: Array.isArray(t.classes) ? t.classes : []
    });
    setEditTarget(t);
  };

  const filtered = teachers.filter(t => {
    const matchSearch = `${t.firstName} ${t.lastName} ${t.email}`.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === '' ? true : statusFilter === 'blocked' ? t.isBlocked : !t.isBlocked;
    const matchGender = genderFilter === '' ? true : t.gender === genderFilter;
    return matchSearch && matchStatus && matchGender;
  });

  return (
    <Box>
      <SectionTitle action={
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField size="small" placeholder="Search teachers…" value={search} onChange={e => setSearch(e.target.value)}
            sx={{ width: 160, '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
          <Select size="small" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} displayEmpty
            sx={{ borderRadius: 2, minWidth: 110, fontSize: 13 }}>
            <MenuItem value="">All Status</MenuItem>
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="blocked">Blocked</MenuItem>
          </Select>
          <Select size="small" value={genderFilter} onChange={e => setGenderFilter(e.target.value)} displayEmpty
            sx={{ borderRadius: 2, minWidth: 110, fontSize: 13 }}>
            <MenuItem value="">All Genders</MenuItem>
            <MenuItem value="male">Male</MenuItem>
            <MenuItem value="female">Female</MenuItem>
          </Select>
          <Button variant="contained" size="small" startIcon={<Add />} onClick={() => setAddOpen(true)}
            sx={{ borderRadius: 2.5, background: gradients.brand, textTransform: 'none', fontWeight: 700, whiteSpace: 'nowrap' }}>
            Add Teacher
          </Button>
        </Box>
      }>Teachers ({teachers.length})</SectionTitle>

      <Paper elevation={0} sx={{ borderRadius: 3, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white', overflow: 'hidden' }}>
        <TableContainer sx={{ overflowX: 'auto' }}><Table sx={{ minWidth: 620 }}>
          <TableHead><TableRow sx={{ bgcolor: '#F8FAFC' }}>
            {['Teacher', 'Email', 'Classes & Subjects', 'Status', 'Joined', 'Actions'].map(h =>
              <TableCell key={h} sx={{ fontWeight: 700, color: tokens.textSecondary, fontSize: 12, whiteSpace: 'nowrap' }}>{h}</TableCell>)}
          </TableRow></TableHead>
          <TableBody>
            {filtered.length === 0
              ? <TableRow><TableCell colSpan={6} align="center" sx={{ py: 5, color: tokens.textMuted }}>No teachers found.</TableCell></TableRow>
              : filtered.map(t => (
                <TableRow key={t._id} sx={{ '&:hover': { bgcolor: '#F8FAFC' } }}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Avatar sx={{ width: 34, height: 34, bgcolor: t.gender === 'female' ? 'rgba(236,72,153,0.12)' : 'rgba(13,64,108,0.1)', color: t.gender === 'female' ? '#DB2777' : tokens.primary, fontWeight: 700, fontSize: 14 }}>
                        {t.firstName?.charAt(0)}
                      </Avatar>
                      <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Typography variant="body2" fontWeight={600} sx={{ fontFamily: "'DM Sans',sans-serif" }}>{t.firstName} {t.lastName}</Typography>
                          {t.gender === 'male' && <Male sx={{ fontSize: 14, color: tokens.primary, opacity: 0.7 }} />}
                          {t.gender === 'female' && <Female sx={{ fontSize: 14, color: '#DB2777', opacity: 0.7 }} />}
                        </Box>
                        {t.phone && <Typography variant="caption" sx={{ color: tokens.textMuted }}>📞 {t.phone}</Typography>}
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell><Typography variant="body2" sx={{ color: tokens.textMuted }}>{t.email}</Typography></TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.4, maxWidth: 220 }}>
                      {(Array.isArray(t.classes) ? t.classes : []).map((c, i) => (
                        <Chip key={`c${i}`} label={c} size="small" sx={{ fontSize: 10, height: 20, bgcolor: 'rgba(99,102,241,0.09)', color: '#4F46E5', fontWeight: 600 }} />
                      ))}
                      {(Array.isArray(t.subjects) ? t.subjects : []).map((s, i) => (
                        <Chip key={`s${i}`} label={s} size="small" sx={{ fontSize: 10, height: 20, bgcolor: 'rgba(12,189,115,0.09)', color: tokens.accentDark, fontWeight: 600 }} />
                      ))}
                      {!t.classes?.length && !t.subjects?.length && <Typography variant="caption" sx={{ color: tokens.textMuted }}>—</Typography>}
                    </Box>
                  </TableCell>
                  <TableCell><Chip label={t.isBlocked ? 'Blocked' : 'Active'} size="small" sx={{ bgcolor: t.isBlocked ? 'rgba(239,68,68,0.08)' : 'rgba(12,189,115,0.1)', color: t.isBlocked ? '#EF4444' : tokens.accentDark, fontWeight: 600 }} /></TableCell>
                  <TableCell><Typography variant="caption" sx={{ color: tokens.textMuted }}>{t.createdAt ? new Date(t.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</Typography></TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => openEdit(t)} sx={{ color: tokens.primary, '&:hover': { bgcolor: 'rgba(13,64,108,0.08)' } }}><Edit fontSize="small" /></IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" onClick={() => setDeleteTarget(t)} sx={{ color: '#EF4444', '&:hover': { bgcolor: 'rgba(239,68,68,0.08)' } }}><Delete fontSize="small" /></IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table></TableContainer>
      </Paper>

      {/* Add Teacher Dialog */}
      <Dialog open={addOpen} onClose={() => { setAddOpen(false); setAddError(''); setForm(emptyForm); setShowPassword(false); }} maxWidth="sm" fullWidth fullScreen={isXs} PaperProps={{ sx: { borderRadius: isXs ? 0 : 3 } }}>
        <DialogTitle sx={{ fontWeight: 700, fontFamily: "'DM Sans',sans-serif" }}>Add Teacher</DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          {addError && (
            <Box sx={{ p: 1.5, mb: 2, bgcolor: '#FEF2F2', borderRadius: 2, border: '1px solid #FECACA' }}>
              <Typography variant="body2" sx={{ color: '#B91C1C', fontWeight: 600 }}>⚠️ {addError}</Typography>
            </Box>
          )}
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <TextField fullWidth label="First Name" size="small" value={form.firstName} onChange={e => setForm(p => ({ ...p, firstName: e.target.value }))} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth label="Last Name" size="small" value={form.lastName} onChange={e => setForm(p => ({ ...p, lastName: e.target.value }))} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Email" size="small" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Phone (optional)" size="small" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth size="small" variant="outlined" sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}>
                <InputLabel>Password</InputLabel>
                <OutlinedInput
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  endAdornment={
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setShowPassword(v => !v)} edge="end">
                        {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  }
                />
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <Select fullWidth size="small" value={form.gender} onChange={e => setForm(p => ({ ...p, gender: e.target.value }))} displayEmpty sx={{ borderRadius: 2 }}>
                <MenuItem value="">Gender (optional)</MenuItem>
                <MenuItem value="male">Male</MenuItem>
                <MenuItem value="female">Female</MenuItem>
              </Select>
            </Grid>
            <Grid item xs={12}>
              <TagInput label="Classes" value={form.classes} onChange={v => setForm(p => ({ ...p, classes: v }))} />
            </Grid>
            <Grid item xs={12}>
              <TagInput label="Subjects" value={form.subjects} onChange={v => setForm(p => ({ ...p, subjects: v }))} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => { setAddOpen(false); setAddError(''); setForm(emptyForm); setShowPassword(false); }} sx={{ borderRadius: 2, textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained" onClick={handleAdd} disabled={saving} sx={{ borderRadius: 2, background: gradients.brand, textTransform: 'none', fontWeight: 700 }}>{saving ? 'Adding…' : 'Add Teacher'}</Button>
        </DialogActions>
      </Dialog>

      {/* Edit Teacher Dialog */}
      <Dialog open={!!editTarget} onClose={() => setEditTarget(null)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700, fontFamily: "'DM Sans',sans-serif" }}>Edit Teacher</DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <TextField fullWidth label="First Name" size="small" value={editForm.firstName} onChange={e => setEditForm(p => ({ ...p, firstName: e.target.value }))} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth label="Last Name" size="small" value={editForm.lastName} onChange={e => setEditForm(p => ({ ...p, lastName: e.target.value }))} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Email" size="small" value={editForm.email} onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Phone (optional)" size="small" value={editForm.phone} onChange={e => setEditForm(p => ({ ...p, phone: e.target.value }))} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
            </Grid>
            <Grid item xs={12}>
              <Select fullWidth size="small" value={editForm.gender} onChange={e => setEditForm(p => ({ ...p, gender: e.target.value }))} displayEmpty sx={{ borderRadius: 2 }}>
                <MenuItem value="">Gender (optional)</MenuItem>
                <MenuItem value="male">Male</MenuItem>
                <MenuItem value="female">Female</MenuItem>
              </Select>
            </Grid>
            <Grid item xs={12}>
              <TagInput label="Classes" value={editForm.classes} onChange={v => setEditForm(p => ({ ...p, classes: v }))} />
            </Grid>
            <Grid item xs={12}>
              <TagInput label="Subjects" value={editForm.subjects} onChange={v => setEditForm(p => ({ ...p, subjects: v }))} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setEditTarget(null)} sx={{ borderRadius: 2, textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained" onClick={handleEdit} disabled={saving} sx={{ borderRadius: 2, background: gradients.brand, textTransform: 'none', fontWeight: 700 }}>{saving ? 'Saving…' : 'Save Changes'}</Button>
        </DialogActions>
      </Dialog>

      {/* Recent Teacher Activities */}
      <Box sx={{ mt: 3 }}>
        <Typography fontWeight={700} sx={{ fontSize: 15, fontFamily: "'DM Sans',sans-serif", mb: 1.5 }}>Recent Activities</Typography>
        <Paper elevation={0} sx={{ borderRadius: 3, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white', p: 2 }}>
          {activitiesLoading
            ? <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={24} sx={{ color: tokens.accent }} /></Box>
            : activities.length === 0
              ? <Typography sx={{ color: tokens.textMuted, fontSize: 13, textAlign: 'center', py: 3 }}>No recent activity.</Typography>
              : activities.slice(0, 15).map((a, i) => {
                  const meta = ACTION_LABELS[a.action] || { label: a.action, color: tokens.textSecondary, bg: '#F8FAFC' };
                  const name = a.user ? `${a.user.firstName || ''} ${a.user.lastName || ''}`.trim() : 'Unknown';
                  const role = a.user?.role;
                  const detail = a.details?.teacherName || a.details?.examTitle || a.details?.studentName || '';
                  return (
                    <Box key={a._id} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, py: 1.25, borderBottom: i < 14 ? `1px solid ${tokens.surfaceBorder}` : 'none' }}>
                      <Avatar sx={{ width: 32, height: 32, bgcolor: meta.bg, color: meta.color, fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                        {name.charAt(0)}
                      </Avatar>
                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                          <Typography variant="body2" fontWeight={700} sx={{ fontFamily: "'DM Sans',sans-serif" }}>{name}</Typography>
                          {role && <Chip label={role} size="small" sx={{ fontSize: 10, height: 18, bgcolor: role === 'teacher' ? 'rgba(99,102,241,0.1)' : 'rgba(13,64,108,0.08)', color: role === 'teacher' ? '#4F46E5' : tokens.primary, fontWeight: 600 }} />}
                          <Chip label={meta.label} size="small" sx={{ fontSize: 10, height: 18, bgcolor: meta.bg, color: meta.color, fontWeight: 600 }} />
                          {detail && <Typography variant="caption" sx={{ color: tokens.textMuted, fontStyle: 'italic' }}>— {detail}</Typography>}
                        </Box>
                      </Box>
                      <Typography variant="caption" sx={{ color: tokens.textMuted, whiteSpace: 'nowrap', flexShrink: 0 }}>{timeAgo(a.timestamp)}</Typography>
                    </Box>
                  );
                })}
        </Paper>
      </Box>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Delete Teacher</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>Are you sure you want to <b>permanently delete</b> this teacher?</Typography>
          <Box sx={{ p: 2, bgcolor: '#FEF2F2', borderRadius: 2, border: '1px solid #FECACA', mb: 1 }}>
            <Typography variant="body2" fontWeight={600} sx={{ color: '#7F1D1D' }}>⚠️ This action cannot be undone.</Typography>
          </Box>
          {deleteTarget && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, bgcolor: '#F8FAFC', borderRadius: 2, mt: 1 }}>
              <Avatar sx={{ width: 36, height: 36, bgcolor: 'rgba(13,64,108,0.1)', color: tokens.primary, fontWeight: 700 }}>{deleteTarget.firstName?.charAt(0)}</Avatar>
              <Box>
                <Typography variant="body2" fontWeight={600}>{deleteTarget.firstName} {deleteTarget.lastName}</Typography>
                <Typography variant="caption" sx={{ color: tokens.textMuted }}>{deleteTarget.email}</Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setDeleteTarget(null)} disabled={saving} sx={{ borderRadius: 2, textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained" onClick={handleDelete} disabled={saving} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, bgcolor: '#EF4444', '&:hover': { bgcolor: '#DC2626' } }}>
            {saving ? 'Deleting…' : 'Delete Permanently'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function getPerfTier(avg) {
  if (avg === null || avg === undefined) return { label: 'No Data', color: '#94A3B8', bg: '#F1F5F9' };
  if (avg >= 80) return { label: 'Excellent', color: '#0CBD73', bg: 'rgba(12,189,115,0.1)' };
  if (avg >= 60) return { label: 'Good', color: '#6366F1', bg: 'rgba(99,102,241,0.1)' };
  if (avg >= 40) return { label: 'Average', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' };
  return { label: 'Needs Help', color: '#EF4444', bg: 'rgba(239,68,68,0.08)' };
}

function getPerfFeedback(avg, examsCount) {
  if (!examsCount || avg === null || avg === undefined) return 'No exams taken yet.';
  if (avg >= 80) return 'Outstanding performance — keep it up!';
  if (avg >= 60) return 'Good results, room to improve.';
  if (avg >= 40) return 'Average — needs more practice.';
  return 'Struggling — recommend extra support.';
}

function StudentsSection() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [perfFilter, setPerfFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [registeredByFilter, setRegisteredByFilter] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [detailStudent, setDetailStudent] = useState(null);

  useEffect(() => {
    api.get('/admin/student-management')
      .then(r => setStudents(r.data?.students || []))
      .catch(() => setError('Failed to load students.'))
      .finally(() => setLoading(false));
  }, []);

  // Enrich each student with tier
  const enriched = students.map(s => ({ ...s, tier: getPerfTier(s.avg) }));

  // Unique classes and registeredBy names for filter dropdowns
  const classes = [...new Set(enriched.map(s => s.class).filter(Boolean))].sort();
  const registeredByOptions = [...new Map(
    enriched.filter(s => s.createdBy).map(s => [s.createdBy._id, s.createdBy])
  ).values()];

  const filtered = enriched.filter(s => {
    const matchSearch = `${s.firstName} ${s.lastName} ${s.email}`.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || (statusFilter === 'blocked' ? s.isBlocked : !s.isBlocked);
    const matchPerf = !perfFilter || s.tier.label === perfFilter;
    const matchClass = !classFilter || s.class === classFilter;
    const matchReg = !registeredByFilter || s.createdBy?._id === registeredByFilter;
    return matchSearch && matchStatus && matchPerf && matchClass && matchReg;
  }).sort((a, b) => {
    if (sortBy === 'score') return (b.avg ?? -1) - (a.avg ?? -1);
    if (sortBy === 'exams') return b.examsCount - a.examsCount;
    if (sortBy === 'worst') return (a.worst ?? 101) - (b.worst ?? 101);
    return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
  });

  const withExams = enriched.filter(s => s.examsCount > 0);
  const totalExcellent = enriched.filter(s => s.tier.label === 'Excellent').length;
  const totalNeedsHelp = enriched.filter(s => s.tier.label === 'Needs Help').length;
  const overallAvg = withExams.length > 0
    ? Math.round(withExams.reduce((a, s) => a + s.avg, 0) / withExams.length)
    : null;
  const improving = enriched.filter(s => s.trend > 0).length;

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}><CircularProgress sx={{ color: tokens.accent }} /></Box>;
  if (error) return <Box sx={{ p: 3 }}><Typography color="error">{error}</Typography></Box>;

  return (
    <Box>
      <SectionTitle>Students ({enriched.length})</SectionTitle>

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'Total Students', value: enriched.length, color: tokens.primary, bg: 'rgba(13,64,108,0.08)' },
          { label: 'Class Average', value: overallAvg !== null ? `${overallAvg}%` : '—', color: '#6366F1', bg: 'rgba(99,102,241,0.09)' },
          { label: 'Excellent (≥80%)', value: totalExcellent, color: tokens.accentDark, bg: 'rgba(12,189,115,0.09)' },
          { label: 'Needs Help (<40%)', value: totalNeedsHelp, color: '#EF4444', bg: 'rgba(239,68,68,0.07)' },
          { label: 'Improving Trend', value: improving, color: '#8B5CF6', bg: 'rgba(139,92,246,0.08)' },
          { label: 'No Exams Yet', value: enriched.length - withExams.length, color: '#94A3B8', bg: '#F1F5F9' },
        ].map((card, i) => (
          <Grid item xs={6} sm={4} md={2} key={i}>
            <Paper elevation={0} sx={{ p: 1.75, borderRadius: 3, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white' }}>
              <Box sx={{ width: 34, height: 34, borderRadius: 2, bgcolor: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 0.75 }}>
                <Typography fontWeight={800} sx={{ color: card.color, fontSize: 13 }}>{card.value}</Typography>
              </Box>
              <Typography sx={{ fontSize: 11, color: tokens.textMuted, fontFamily: "'DM Sans',sans-serif", lineHeight: 1.3 }}>{card.label}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
        <TextField size="small" placeholder="Search by name / email…" value={search} onChange={e => setSearch(e.target.value)}
          sx={{ width: 200, '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
        <Select size="small" value={perfFilter} onChange={e => setPerfFilter(e.target.value)} displayEmpty sx={{ borderRadius: 2, minWidth: 140, fontSize: 13 }}>
          <MenuItem value="">All Performance</MenuItem>
          <MenuItem value="Excellent">Excellent (≥80%)</MenuItem>
          <MenuItem value="Good">Good (60–79%)</MenuItem>
          <MenuItem value="Average">Average (40–59%)</MenuItem>
          <MenuItem value="Needs Help">Needs Help (&lt;40%)</MenuItem>
          <MenuItem value="No Data">No Exams Yet</MenuItem>
        </Select>
        <Select size="small" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} displayEmpty sx={{ borderRadius: 2, minWidth: 110, fontSize: 13 }}>
          <MenuItem value="">All Status</MenuItem>
          <MenuItem value="active">Active</MenuItem>
          <MenuItem value="blocked">Blocked</MenuItem>
        </Select>
        {classes.length > 0 && (
          <Select size="small" value={classFilter} onChange={e => setClassFilter(e.target.value)} displayEmpty sx={{ borderRadius: 2, minWidth: 110, fontSize: 13 }}>
            <MenuItem value="">All Classes</MenuItem>
            {classes.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </Select>
        )}
        {registeredByOptions.length > 1 && (
          <Select size="small" value={registeredByFilter} onChange={e => setRegisteredByFilter(e.target.value)} displayEmpty sx={{ borderRadius: 2, minWidth: 140, fontSize: 13 }}>
            <MenuItem value="">All Registrants</MenuItem>
            {registeredByOptions.map(r => (
              <MenuItem key={r._id} value={r._id}>{r.name} ({r.role})</MenuItem>
            ))}
          </Select>
        )}
        <Select size="small" value={sortBy} onChange={e => setSortBy(e.target.value)} displayEmpty sx={{ borderRadius: 2, minWidth: 130, fontSize: 13 }}>
          <MenuItem value="name">Sort: Name A–Z</MenuItem>
          <MenuItem value="score">Sort: Avg Score ↓</MenuItem>
          <MenuItem value="exams">Sort: Most Exams</MenuItem>
          <MenuItem value="worst">Sort: Weakest First</MenuItem>
        </Select>
      </Box>

      <Paper elevation={0} sx={{ borderRadius: 3, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white', overflow: 'hidden' }}>
        <TableContainer sx={{ overflowX: 'auto' }}><Table sx={{ minWidth: 750 }}>
          <TableHead><TableRow sx={{ bgcolor: '#F8FAFC' }}>
            {['Student', 'Class', 'Registered By', 'Exams', 'Avg', 'Best', 'Worst', 'Trend', 'Performance', 'Weaknesses', 'Status'].map(h =>
              <TableCell key={h} sx={{ fontWeight: 700, color: tokens.textSecondary, fontSize: 11, whiteSpace: 'nowrap', py: 1.25 }}>{h}</TableCell>)}
          </TableRow></TableHead>
          <TableBody>
            {filtered.length === 0
              ? <TableRow><TableCell colSpan={11} align="center" sx={{ py: 5, color: tokens.textMuted }}>No students match your filters.</TableCell></TableRow>
              : filtered.map(s => {
                  const tier = s.tier;
                  return (
                    <TableRow key={s._id} sx={{ '&:hover': { bgcolor: '#F8FAFC' }, cursor: 'pointer' }} onClick={() => setDetailStudent(s)}>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                          <Avatar sx={{ width: 30, height: 30, bgcolor: tier.bg, color: tier.color, fontWeight: 700, fontSize: 12 }}>{s.firstName?.charAt(0)}</Avatar>
                          <Box>
                            <Typography variant="body2" fontWeight={600} sx={{ fontFamily: "'DM Sans',sans-serif", lineHeight: 1.2 }}>{s.firstName} {s.lastName}</Typography>
                            <Typography variant="caption" sx={{ color: tokens.textMuted }}>{s.email}</Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        {s.class ? <Chip label={s.class} size="small" sx={{ fontSize: 10, height: 18, bgcolor: 'rgba(13,64,108,0.07)', color: tokens.primary, fontWeight: 600 }} /> : <Typography variant="caption" sx={{ color: tokens.textMuted }}>—</Typography>}
                      </TableCell>
                      <TableCell>
                        {s.createdBy
                          ? <Box><Typography variant="caption" fontWeight={600} sx={{ color: tokens.textPrimary }}>{s.createdBy.name}</Typography>
                              <Chip label={s.createdBy.role} size="small" sx={{ ml: 0.5, fontSize: 9, height: 16, bgcolor: s.createdBy.role === 'teacher' ? 'rgba(99,102,241,0.1)' : 'rgba(13,64,108,0.08)', color: s.createdBy.role === 'teacher' ? '#4F46E5' : tokens.primary }} /></Box>
                          : <Typography variant="caption" sx={{ color: tokens.textMuted }}>—</Typography>}
                      </TableCell>
                      <TableCell><Typography variant="body2" fontWeight={700}>{s.examsCount}</Typography></TableCell>
                      <TableCell>
                        {s.avg !== null && s.avg !== undefined
                          ? <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Typography variant="body2" fontWeight={700} sx={{ color: tier.color }}>{s.avg}%</Typography>
                              <LinearProgress variant="determinate" value={s.avg} sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: tier.bg, '& .MuiLinearProgress-bar': { bgcolor: tier.color } }} />
                            </Box>
                          : <Typography variant="caption" sx={{ color: tokens.textMuted }}>—</Typography>}
                      </TableCell>
                      <TableCell>
                        {s.best !== null && s.best !== undefined
                          ? <Typography variant="body2" fontWeight={600} sx={{ color: '#0CBD73' }}>{s.best}%</Typography>
                          : <Typography variant="caption" sx={{ color: tokens.textMuted }}>—</Typography>}
                      </TableCell>
                      <TableCell>
                        {s.worst !== null && s.worst !== undefined
                          ? <Typography variant="body2" fontWeight={600} sx={{ color: s.worst < 40 ? '#EF4444' : tokens.textPrimary }}>{s.worst}%</Typography>
                          : <Typography variant="caption" sx={{ color: tokens.textMuted }}>—</Typography>}
                      </TableCell>
                      <TableCell>
                        {s.examsCount >= 3
                          ? <Chip label={s.trend > 0 ? `+${s.trend}%` : `${s.trend}%`} size="small"
                              sx={{ fontSize: 10, height: 18, fontWeight: 700,
                                bgcolor: s.trend > 0 ? 'rgba(12,189,115,0.1)' : s.trend < 0 ? 'rgba(239,68,68,0.08)' : '#F1F5F9',
                                color: s.trend > 0 ? '#0CBD73' : s.trend < 0 ? '#EF4444' : '#94A3B8' }} />
                          : <Typography variant="caption" sx={{ color: tokens.textMuted }}>—</Typography>}
                      </TableCell>
                      <TableCell>
                        <Chip label={tier.label} size="small" sx={{ bgcolor: tier.bg, color: tier.color, fontWeight: 700, fontSize: 10 }} />
                      </TableCell>
                      <TableCell sx={{ maxWidth: 160 }}>
                        {s.weakExams?.length > 0
                          ? <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.3 }}>
                              {s.weakExams.slice(0, 2).map((w, i) => (
                                <Chip key={i} label={w} size="small" sx={{ fontSize: 9, height: 17, bgcolor: 'rgba(239,68,68,0.07)', color: '#B91C1C', maxWidth: 140 }} />
                              ))}
                              {s.weakExams.length > 2 && <Typography variant="caption" sx={{ color: tokens.textMuted }}>+{s.weakExams.length - 2} more</Typography>}
                            </Box>
                          : <Typography variant="caption" sx={{ color: tokens.textMuted }}>None</Typography>}
                      </TableCell>
                      <TableCell>
                        <Chip label={s.isBlocked ? 'Blocked' : 'Active'} size="small"
                          sx={{ bgcolor: s.isBlocked ? 'rgba(239,68,68,0.08)' : 'rgba(12,189,115,0.1)', color: s.isBlocked ? '#EF4444' : tokens.accentDark, fontWeight: 600 }} />
                      </TableCell>
                    </TableRow>
                  );
                })}
          </TableBody>
        </Table></TableContainer>
      </Paper>

      {/* Student Detail Dialog */}
      <Dialog open={!!detailStudent} onClose={() => setDetailStudent(null)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        {detailStudent && (() => {
          const tier = detailStudent.tier;
          return (
            <>
              <DialogTitle sx={{ fontWeight: 700, fontFamily: "'DM Sans',sans-serif", pb: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Avatar sx={{ width: 38, height: 38, bgcolor: tier.bg, color: tier.color, fontWeight: 700 }}>{detailStudent.firstName?.charAt(0)}</Avatar>
                  <Box>
                    <Typography fontWeight={700} sx={{ fontFamily: "'DM Sans',sans-serif", lineHeight: 1.2 }}>{detailStudent.firstName} {detailStudent.lastName}</Typography>
                    <Typography variant="caption" sx={{ color: tokens.textMuted }}>{detailStudent.email}</Typography>
                  </Box>
                </Box>
                <IconButton size="small" onClick={() => setDetailStudent(null)}><Close fontSize="small" /></IconButton>
              </DialogTitle>
              <DialogContent sx={{ pt: 2 }}>
                {/* Chips row */}
                <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 2 }}>
                  <Chip label={tier.label} sx={{ bgcolor: tier.bg, color: tier.color, fontWeight: 700, fontSize: 12 }} />
                  {detailStudent.class && <Chip label={`Class: ${detailStudent.class}`} sx={{ bgcolor: 'rgba(13,64,108,0.07)', color: tokens.primary, fontSize: 12 }} />}
                  {detailStudent.createdBy && <Chip label={`By: ${detailStudent.createdBy.name}`} sx={{ bgcolor: 'rgba(99,102,241,0.08)', color: '#4F46E5', fontSize: 12 }} />}
                  <Chip label={detailStudent.isBlocked ? 'Blocked' : 'Active'} sx={{ bgcolor: detailStudent.isBlocked ? 'rgba(239,68,68,0.08)' : 'rgba(12,189,115,0.1)', color: detailStudent.isBlocked ? '#EF4444' : tokens.accentDark, fontSize: 12 }} />
                </Box>

                {/* System feedback */}
                <Box sx={{ p: 1.5, bgcolor: tier.bg, borderRadius: 2, mb: 2, border: `1px solid ${tier.color}22` }}>
                  <Typography variant="body2" fontWeight={600} sx={{ color: tier.color }}>
                    💬 {getPerfFeedback(detailStudent.avg, detailStudent.examsCount)}
                  </Typography>
                </Box>

                {/* Stats mini cards */}
                <Grid container spacing={1.5} sx={{ mb: 2 }}>
                  {[
                    { label: 'Exams Taken', value: detailStudent.examsCount },
                    { label: 'Avg Score', value: detailStudent.avg !== null && detailStudent.avg !== undefined ? `${detailStudent.avg}%` : '—' },
                    { label: 'Best Score', value: detailStudent.best !== null && detailStudent.best !== undefined ? `${detailStudent.best}%` : '—' },
                    { label: 'Worst Score', value: detailStudent.worst !== null && detailStudent.worst !== undefined ? `${detailStudent.worst}%` : '—' },
                    { label: 'Trend', value: detailStudent.examsCount >= 3 ? (detailStudent.trend > 0 ? `+${detailStudent.trend}%` : `${detailStudent.trend}%`) : 'N/A' },
                  ].map((m, i) => (
                    <Grid item xs={4} key={i}>
                      <Paper elevation={0} sx={{ p: 1.25, borderRadius: 2, border: `1px solid ${tokens.surfaceBorder}`, textAlign: 'center' }}>
                        <Typography fontWeight={800} sx={{ color: tokens.textPrimary, fontSize: 16 }}>{m.value}</Typography>
                        <Typography sx={{ fontSize: 10, color: tokens.textMuted }}>{m.label}</Typography>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>

                {/* Weaknesses */}
                {detailStudent.weakExams?.length > 0 && (
                  <Box sx={{ mb: 2 }}>
                    <Typography fontWeight={700} sx={{ fontSize: 12.5, mb: 0.75, color: '#B91C1C' }}>⚠️ Weaknesses (scored &lt;50%)</Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {detailStudent.weakExams.map((w, i) => (
                        <Chip key={i} label={w} size="small" sx={{ bgcolor: 'rgba(239,68,68,0.07)', color: '#B91C1C', fontSize: 11 }} />
                      ))}
                    </Box>
                  </Box>
                )}

                {/* Exam history */}
                {detailStudent.results?.length > 0 && (
                  <>
                    <Typography fontWeight={700} sx={{ fontSize: 12.5, mb: 1 }}>All Grades</Typography>
                    {[...detailStudent.results].sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt)).map((r, i) => {
                      const rTier = getPerfTier(r.percentage);
                      return (
                        <Box key={i} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.75, borderBottom: `1px solid ${tokens.surfaceBorder}` }}>
                          <Box sx={{ flexGrow: 1, minWidth: 0, mr: 1 }}>
                            <Typography variant="body2" fontWeight={600} noWrap>{r.examTitle}</Typography>
                            <Typography variant="caption" sx={{ color: tokens.textMuted }}>{r.score}/{r.maxScore} pts · {r.completedAt ? new Date(r.completedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</Typography>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0 }}>
                            <Chip label={r.grade} size="small" sx={{ fontWeight: 800, fontSize: 11, bgcolor: rTier.bg, color: rTier.color, minWidth: 28 }} />
                            <Typography variant="body2" fontWeight={700} sx={{ color: rTier.color, minWidth: 38, textAlign: 'right' }}>{r.percentage}%</Typography>
                          </Box>
                        </Box>
                      );
                    })}
                  </>
                )}
              </DialogContent>
              <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button onClick={() => setDetailStudent(null)} sx={{ borderRadius: 2, textTransform: 'none' }}>Close</Button>
              </DialogActions>
            </>
          );
        })()}
      </Dialog>
    </Box>
  );
}

function statusColor(status) {
  if (status === 'active') return { color: tokens.accent, bg: 'rgba(12,189,115,0.1)' };
  if (status === 'draft') return { color: tokens.warning, bg: 'rgba(245,158,11,0.1)' };
  if (status === 'scheduled') return { color: '#8B5CF6', bg: 'rgba(139,92,246,0.1)' };
  if (status === 'completed') return { color: '#6366F1', bg: 'rgba(99,102,241,0.1)' };
  if (status === 'locked') return { color: '#EF4444', bg: 'rgba(239,68,68,0.08)' };
  return { color: tokens.textSecondary, bg: '#F1F5F9' };
}

function ExamsSection({ exams }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('newest');

  const filtered = exams.filter(e => {
    const matchSearch = !search || e.title?.toLowerCase().includes(search.toLowerCase()) ||
      e.description?.toLowerCase().includes(search.toLowerCase()) ||
      (typeof e.createdBy === 'string' && e.createdBy.toLowerCase().includes(search.toLowerCase()));
    const matchStatus = !statusFilter || (e.status || 'draft') === statusFilter;
    return matchSearch && matchStatus;
  }).sort((a, b) => {
    if (sortBy === 'newest') return new Date(b.createdAt) - new Date(a.createdAt);
    if (sortBy === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt);
    if (sortBy === 'title') return (a.title || '').localeCompare(b.title || '');
    if (sortBy === 'questions') return (b.questions || 0) - (a.questions || 0);
    if (sortBy === 'students') return (b.students || 0) - (a.students || 0);
    return 0;
  });

  const statusCounts = { total: exams.length, active: 0, draft: 0, scheduled: 0, completed: 0, locked: 0 };
  exams.forEach(e => { const s = e.status || 'draft'; if (statusCounts[s] !== undefined) statusCounts[s]++; });

  return (
    <Box>
      <SectionTitle>Exams ({exams.length})</SectionTitle>

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'Total', value: statusCounts.total, color: tokens.primary, bg: 'rgba(13,64,108,0.08)' },
          { label: 'Active', value: statusCounts.active, color: tokens.accent, bg: 'rgba(12,189,115,0.1)' },
          { label: 'Draft', value: statusCounts.draft, color: tokens.warning, bg: 'rgba(245,158,11,0.1)' },
          { label: 'Scheduled', value: statusCounts.scheduled, color: '#8B5CF6', bg: 'rgba(139,92,246,0.1)' },
          { label: 'Completed', value: statusCounts.completed, color: '#6366F1', bg: 'rgba(99,102,241,0.1)' },
          { label: 'Locked', value: statusCounts.locked, color: '#EF4444', bg: 'rgba(239,68,68,0.08)' },
        ].map((c, i) => (
          <Grid item xs={6} sm={4} md={2} key={i}>
            <Paper elevation={0} onClick={() => setStatusFilter(c.label === 'Total' ? '' : c.label.toLowerCase())}
              sx={{ p: 1.75, borderRadius: 3, border: `1px solid ${statusFilter === (c.label === 'Total' ? 'NONE' : c.label.toLowerCase()) ? c.color : tokens.surfaceBorder}`, bgcolor: 'white', cursor: 'pointer', '&:hover': { borderColor: c.color } }}>
              <Box sx={{ width: 32, height: 32, borderRadius: 2, bgcolor: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 0.75 }}>
                <Typography fontWeight={800} sx={{ color: c.color, fontSize: 13 }}>{c.value}</Typography>
              </Box>
              <Typography sx={{ fontSize: 11, color: tokens.textMuted, fontFamily: "'DM Sans',sans-serif" }}>{c.label}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
        <TextField size="small" placeholder="Search exams…" value={search} onChange={e => setSearch(e.target.value)}
          sx={{ width: 200, '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
        <Select size="small" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} displayEmpty sx={{ borderRadius: 2, minWidth: 120, fontSize: 13 }}>
          <MenuItem value="">All Status</MenuItem>
          <MenuItem value="active">Active</MenuItem>
          <MenuItem value="draft">Draft</MenuItem>
          <MenuItem value="scheduled">Scheduled</MenuItem>
          <MenuItem value="completed">Completed</MenuItem>
          <MenuItem value="locked">Locked</MenuItem>
        </Select>
        <Select size="small" value={sortBy} onChange={e => setSortBy(e.target.value)} displayEmpty sx={{ borderRadius: 2, minWidth: 140, fontSize: 13 }}>
          <MenuItem value="newest">Sort: Newest First</MenuItem>
          <MenuItem value="oldest">Sort: Oldest First</MenuItem>
          <MenuItem value="title">Sort: Title A–Z</MenuItem>
          <MenuItem value="questions">Sort: Most Questions</MenuItem>
          <MenuItem value="students">Sort: Most Students</MenuItem>
        </Select>
        {(search || statusFilter) && (
          <Button size="small" onClick={() => { setSearch(''); setStatusFilter(''); }} sx={{ borderRadius: 2, textTransform: 'none', color: tokens.textMuted, fontSize: 12 }}>
            Clear filters
          </Button>
        )}
      </Box>

      <Paper elevation={0} sx={{ borderRadius: 3, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white', overflow: 'hidden' }}>
        <TableContainer sx={{ overflowX: 'auto' }}><Table sx={{ minWidth: 620 }}>
          <TableHead><TableRow sx={{ bgcolor: '#F8FAFC' }}>
            {['Title', 'Status', 'Questions', 'Students', 'Completion', 'Time Limit', 'Created By', 'Created'].map(h =>
              <TableCell key={h} sx={{ fontWeight: 700, color: tokens.textSecondary, fontSize: 11, whiteSpace: 'nowrap', py: 1.25 }}>{h}</TableCell>)}
          </TableRow></TableHead>
          <TableBody>
            {filtered.length === 0
              ? <TableRow><TableCell colSpan={8} align="center" sx={{ py: 5, color: tokens.textMuted }}>No exams match your filters.</TableCell></TableRow>
              : filtered.map(e => {
                  const sc = statusColor(e.status || 'draft');
                  return (
                    <TableRow key={e._id} sx={{ '&:hover': { bgcolor: '#F8FAFC' } }}>
                      <TableCell sx={{ maxWidth: 220 }}>
                        <Typography variant="body2" fontWeight={700} sx={{ fontFamily: "'DM Sans',sans-serif" }} noWrap>{e.title}</Typography>
                        {e.description && <Typography variant="caption" sx={{ color: tokens.textMuted, display: 'block' }} noWrap>{e.description}</Typography>}
                      </TableCell>
                      <TableCell>
                        <Chip label={e.status || 'draft'} size="small" sx={{ bgcolor: sc.bg, color: sc.color, fontWeight: 700, fontSize: 10, textTransform: 'capitalize' }} />
                        {e.isLocked && <Chip label="Locked" size="small" sx={{ ml: 0.5, fontSize: 9, height: 16, bgcolor: 'rgba(239,68,68,0.08)', color: '#EF4444', fontWeight: 600 }} />}
                      </TableCell>
                      <TableCell><Chip label={e.questions || 0} size="small" sx={{ bgcolor: 'rgba(13,64,108,0.07)', color: tokens.primary, fontWeight: 600 }} /></TableCell>
                      <TableCell><Typography variant="body2" fontWeight={600}>{e.students || 0}</Typography></TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                          <LinearProgress variant="determinate" value={e.completionRate || 0}
                            sx={{ width: 44, height: 4, borderRadius: 2, bgcolor: 'rgba(13,64,108,0.07)', '& .MuiLinearProgress-bar': { bgcolor: tokens.accent } }} />
                          <Typography variant="caption" fontWeight={600} sx={{ color: tokens.textMuted }}>{e.completionRate || 0}%</Typography>
                        </Box>
                      </TableCell>
                      <TableCell><Typography variant="body2" sx={{ color: tokens.textMuted }}>{e.timeLimit} min</Typography></TableCell>
                      <TableCell><Typography variant="caption" sx={{ color: tokens.textMuted }}>{e.createdBy || '—'}</Typography></TableCell>
                      <TableCell><Typography variant="caption" sx={{ color: tokens.textMuted, whiteSpace: 'nowrap' }}>{new Date(e.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</Typography></TableCell>
                    </TableRow>
                  );
                })}
          </TableBody>
        </Table></TableContainer>
      </Paper>
    </Box>
  );
}

function gradeColor(grade) {
  if (grade === 'A') return { color: '#0CBD73', bg: 'rgba(12,189,115,0.1)' };
  if (grade === 'B') return { color: '#6366F1', bg: 'rgba(99,102,241,0.1)' };
  if (grade === 'C') return { color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' };
  if (grade === 'D') return { color: '#FB923C', bg: 'rgba(251,146,60,0.1)' };
  return { color: '#EF4444', bg: 'rgba(239,68,68,0.08)' };
}

function ResultsSection({ results }) {
  const [search, setSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState('');
  const [examFilter, setExamFilter] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [selectedResult, setSelectedResult] = useState(null);
  const [detailedResult, setDetailedResult] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Unique exam titles for filter dropdown
  const examTitles = [...new Set(results.map(r => r.exam?.title).filter(Boolean))].sort();

  const getGradeBand = (pct) => {
    if (pct >= 90) return 'A';
    if (pct >= 80) return 'B';
    if (pct >= 70) return 'C';
    if (pct >= 60) return 'D';
    return 'F';
  };

  const filtered = results.filter(r => {
    const name = `${r.student?.firstName || ''} ${r.student?.lastName || ''} ${r.student?.email || ''}`.toLowerCase();
    const matchSearch = !search || name.includes(search.toLowerCase()) || r.exam?.title?.toLowerCase().includes(search.toLowerCase());
    const pct = Math.round(r.percentage ?? 0);
    const band = r.grade || getGradeBand(pct);
    const matchGrade = !gradeFilter || band === gradeFilter;
    const matchExam = !examFilter || r.exam?.title === examFilter;
    return matchSearch && matchGrade && matchExam;
  }).sort((a, b) => {
    const dateA = new Date(a.endTime || a.submittedAt || a.createdAt);
    const dateB = new Date(b.endTime || b.submittedAt || b.createdAt);
    if (sortBy === 'newest') return dateB - dateA;
    if (sortBy === 'oldest') return dateA - dateB;
    if (sortBy === 'score-desc') return (b.percentage ?? 0) - (a.percentage ?? 0);
    if (sortBy === 'score-asc') return (a.percentage ?? 0) - (b.percentage ?? 0);
    const nameA = `${a.student?.firstName} ${a.student?.lastName}`;
    const nameB = `${b.student?.firstName} ${b.student?.lastName}`;
    if (sortBy === 'student') return nameA.localeCompare(nameB);
    return 0;
  });

  // Summary stats
  const total = results.length;
  const passed = results.filter(r => (r.percentage ?? 0) >= 50).length;
  const avgPct = total > 0 ? Math.round(results.reduce((s, r) => s + (r.percentage ?? 0), 0) / total) : 0;
  const gradeCounts = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  results.forEach(r => { const b = r.grade || getGradeBand(Math.round(r.percentage ?? 0)); if (gradeCounts[b] !== undefined) gradeCounts[b]++; });

  const handleViewDetails = async (result) => {
    setSelectedResult(result);
    setLoadingDetail(true);
    try {
      const response = await api.get(`/admin/results/${result._id}`);
      setDetailedResult(response.data);
    } catch (error) {
      console.error('Error fetching detailed result:', error);
    } finally {
      setLoadingDetail(false);
    }
  };

  return (
    <Box>
      <SectionTitle>Results ({total})</SectionTitle>

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'Total Results', value: total, color: tokens.primary, bg: 'rgba(13,64,108,0.08)' },
          { label: 'Class Average', value: `${avgPct}%`, color: '#6366F1', bg: 'rgba(99,102,241,0.09)' },
          { label: `Passed (≥50%)`, value: passed, color: tokens.accentDark, bg: 'rgba(12,189,115,0.09)' },
          { label: 'Failed (<50%)', value: total - passed, color: '#EF4444', bg: 'rgba(239,68,68,0.07)' },
          ...['A', 'B', 'C', 'D', 'F'].map(g => ({ label: `Grade ${g}`, value: gradeCounts[g], color: gradeColor(g).color, bg: gradeColor(g).bg })),
        ].map((c, i) => (
          <Grid item xs={6} sm={4} md={2} key={i}>
            <Paper elevation={0} sx={{ p: 1.75, borderRadius: 3, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white' }}>
              <Box sx={{ width: 32, height: 32, borderRadius: 2, bgcolor: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 0.75 }}>
                <Typography fontWeight={800} sx={{ color: c.color, fontSize: 13 }}>{c.value}</Typography>
              </Box>
              <Typography sx={{ fontSize: 11, color: tokens.textMuted, fontFamily: "'DM Sans',sans-serif" }}>{c.label}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
        <TextField size="small" placeholder="Search student / exam…" value={search} onChange={e => setSearch(e.target.value)}
          sx={{ width: 210, '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
        <Select size="small" value={gradeFilter} onChange={e => setGradeFilter(e.target.value)} displayEmpty sx={{ borderRadius: 2, minWidth: 110, fontSize: 13 }}>
          <MenuItem value="">All Grades</MenuItem>
          {['A', 'B', 'C', 'D', 'F'].map(g => <MenuItem key={g} value={g}>Grade {g}</MenuItem>)}
        </Select>
        {examTitles.length > 0 && (
          <Select size="small" value={examFilter} onChange={e => setExamFilter(e.target.value)} displayEmpty sx={{ borderRadius: 2, minWidth: 160, fontSize: 13 }}>
            <MenuItem value="">All Exams</MenuItem>
            {examTitles.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
          </Select>
        )}
        <Select size="small" value={sortBy} onChange={e => setSortBy(e.target.value)} displayEmpty sx={{ borderRadius: 2, minWidth: 150, fontSize: 13 }}>
          <MenuItem value="newest">Sort: Newest First</MenuItem>
          <MenuItem value="oldest">Sort: Oldest First</MenuItem>
          <MenuItem value="score-desc">Sort: Score High–Low</MenuItem>
          <MenuItem value="score-asc">Sort: Score Low–High</MenuItem>
          <MenuItem value="student">Sort: Student A–Z</MenuItem>
        </Select>
        {(search || gradeFilter || examFilter) && (
          <Button size="small" onClick={() => { setSearch(''); setGradeFilter(''); setExamFilter(''); }}
            sx={{ borderRadius: 2, textTransform: 'none', color: tokens.textMuted, fontSize: 12 }}>Clear</Button>
        )}
      </Box>

      <Paper elevation={0} sx={{ borderRadius: 3, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white', overflow: 'hidden' }}>
        <TableContainer sx={{ overflowX: 'auto' }}><Table sx={{ minWidth: 640 }}>
          <TableHead><TableRow sx={{ bgcolor: '#F8FAFC' }}>
            {['Student', 'Exam', 'Score', 'Grade', 'Time Taken', 'Submitted', 'Actions'].map(h =>
              <TableCell key={h} sx={{ fontWeight: 700, color: tokens.textSecondary, fontSize: 11, whiteSpace: 'nowrap', py: 1.25 }}>{h}</TableCell>)}
          </TableRow></TableHead>
          <TableBody>
            {filtered.length === 0
              ? <TableRow><TableCell colSpan={7} align="center" sx={{ py: 5, color: tokens.textMuted }}>No results match your filters.</TableCell></TableRow>
              : filtered.slice(0, 100).map(r => {
                  const pct = Math.round(r.percentage ?? 0);
                  const band = r.grade || getGradeBand(pct);
                  const gc = gradeColor(band);
                  const submittedAt = r.endTime || r.submittedAt || r.createdAt;
                  return (
                    <TableRow key={r._id} sx={{ '&:hover': { bgcolor: '#F8FAFC' } }}>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                          <Avatar sx={{ width: 28, height: 28, bgcolor: gc.bg, color: gc.color, fontWeight: 700, fontSize: 11 }}>
                            {(r.student?.firstName || '?').charAt(0)}
                          </Avatar>
                          <Box>
                            <Typography variant="body2" fontWeight={600} sx={{ fontFamily: "'DM Sans',sans-serif", lineHeight: 1.2 }}>
                              {r.student?.firstName} {r.student?.lastName}
                            </Typography>
                            <Typography variant="caption" sx={{ color: tokens.textMuted }}>{r.student?.email}</Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ maxWidth: 180 }}>
                        <Typography variant="body2" fontWeight={600} noWrap>{r.exam?.title || '—'}</Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                          <LinearProgress variant="determinate" value={pct}
                            sx={{ width: 48, height: 5, borderRadius: 2, bgcolor: gc.bg, '& .MuiLinearProgress-bar': { bgcolor: gc.color } }} />
                          <Typography variant="body2" fontWeight={700} sx={{ color: gc.color }}>{pct}%</Typography>
                        </Box>
                        <Typography variant="caption" sx={{ color: tokens.textMuted }}>{r.totalScore}/{r.maxPossibleScore} pts</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={band} size="small" sx={{ bgcolor: gc.bg, color: gc.color, fontWeight: 800, fontSize: 11, minWidth: 28 }} />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ color: tokens.textMuted }}>{r.timeTaken ? `${r.timeTaken} min` : '—'}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" sx={{ color: tokens.textMuted, whiteSpace: 'nowrap' }}>
                          {submittedAt ? new Date(submittedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Button size="small" variant="outlined" onClick={() => handleViewDetails(r)}
                          sx={{ textTransform: 'none', fontWeight: 600, fontSize: 11, borderRadius: 1.5, py: 0.25, borderColor: tokens.surfaceBorder, color: tokens.primary, '&:hover': { borderColor: tokens.primary, bgcolor: 'rgba(13,64,108,0.04)' } }}>
                          Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
          </TableBody>
        </Table></TableContainer>
        {filtered.length > 100 && (
          <Box sx={{ p: 1.5, borderTop: `1px solid ${tokens.surfaceBorder}`, textAlign: 'center' }}>
            <Typography variant="caption" sx={{ color: tokens.textMuted }}>Showing 100 of {filtered.length} results — use filters to narrow down</Typography>
          </Box>
        )}
      </Paper>

      {/* Detailed Result Dialog */}
      <Dialog open={!!selectedResult} onClose={() => { setSelectedResult(null); setDetailedResult(null); }} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        {selectedResult && (
          <>
            <DialogTitle sx={{ fontWeight: 700, fontFamily: "'DM Sans',sans-serif", pb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography fontWeight={700} sx={{ fontFamily: "'DM Sans',sans-serif" }}>
                  {selectedResult.student?.firstName} {selectedResult.student?.lastName}
                </Typography>
                <Typography variant="caption" sx={{ color: tokens.textMuted }}>{selectedResult.exam?.title}</Typography>
              </Box>
              <IconButton size="small" onClick={() => { setSelectedResult(null); setDetailedResult(null); }}><Close fontSize="small" /></IconButton>
            </DialogTitle>
            <DialogContent sx={{ pt: '8px !important' }}>
              {loadingDetail
                ? <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress sx={{ color: tokens.accent }} /></Box>
                : detailedResult ? (
                    <Box>
                      {/* Score header */}
                      <Box sx={{ mb: 2.5, p: 2, bgcolor: '#F8FAFC', borderRadius: 2, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                        {(() => {
                          const pct = detailedResult.percentage ?? Math.round((detailedResult.totalScore / (detailedResult.maxPossibleScore || 1)) * 100);
                          const band = detailedResult.grade || getGradeBand(pct);
                          const gc = gradeColor(band);
                          return (
                            <>
                              <Chip label={band} sx={{ fontWeight: 800, fontSize: 16, height: 36, px: 1, bgcolor: gc.bg, color: gc.color }} />
                              <Box>
                                <Typography fontWeight={700}>{pct}% — {detailedResult.totalScore}/{detailedResult.maxPossibleScore} pts</Typography>
                                <Typography variant="caption" sx={{ color: tokens.textMuted }}>
                                  Time taken: {detailedResult.timeTaken || '—'} min &nbsp;·&nbsp;
                                  Submitted: {detailedResult.endTime ? new Date(detailedResult.endTime).toLocaleString() : '—'}
                                </Typography>
                              </Box>
                            </>
                          );
                        })()}
                      </Box>

                      {/* Answer analysis */}
                      <Typography fontWeight={700} sx={{ mb: 1.5, fontSize: 13 }}>Answer Analysis ({detailedResult.answers?.length || 0} questions)</Typography>
                      {detailedResult.answers?.length > 0
                        ? detailedResult.answers.map((ans, idx) => {
                            const correct = ans.isCorrect;
                            return (
                              <Box key={idx} sx={{ mb: 1.5, p: 1.75, border: `1px solid ${correct ? 'rgba(12,189,115,0.25)' : 'rgba(239,68,68,0.2)'}`, borderRadius: 2, bgcolor: correct ? 'rgba(12,189,115,0.03)' : 'rgba(239,68,68,0.02)' }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                                  <Typography variant="body2" fontWeight={700}>Q{idx + 1}</Typography>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                    <Chip label={correct ? 'Correct' : 'Incorrect'} size="small"
                                      sx={{ bgcolor: correct ? 'rgba(12,189,115,0.1)' : 'rgba(239,68,68,0.1)', color: correct ? tokens.accent : '#EF4444', fontWeight: 700, fontSize: 10 }} />
                                    <Typography variant="caption" fontWeight={700} sx={{ color: tokens.textMuted }}>
                                      {ans.score ?? 0}/{ans.question?.points ?? 0} pts
                                    </Typography>
                                  </Box>
                                </Box>
                                {ans.gradingMethod && (
                                  <Typography variant="caption" sx={{ color: tokens.textMuted, display: 'block', mb: ans.feedback ? 0.5 : 0 }}>
                                    Method: {ans.gradingMethod}
                                  </Typography>
                                )}
                                {ans.feedback && (
                                  <Box sx={{ mt: 0.5, p: 1, bgcolor: 'rgba(99,102,241,0.05)', borderRadius: 1.5, borderLeft: '3px solid #6366F1' }}>
                                    <Typography variant="caption" sx={{ color: '#4F46E5', fontStyle: 'italic' }}>💬 {ans.feedback}</Typography>
                                  </Box>
                                )}
                              </Box>
                            );
                          })
                        : <Typography sx={{ color: tokens.textMuted, fontSize: 13 }}>No answer data available.</Typography>}
                    </Box>
                  )
                : <Typography sx={{ color: tokens.textMuted }}>No detailed data available.</Typography>}
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2.5 }}>
              <Button onClick={() => { setSelectedResult(null); setDetailedResult(null); }} sx={{ borderRadius: 2, textTransform: 'none' }}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
}

function AnalyticsSection({ results, exams, teachers }) {
  const avg = results.length?Math.round(results.reduce((s,r)=>s+(r.percentage??0),0)/results.length):0;
  const passRate = results.length?Math.round((results.filter(r=>(r.percentage??0)>=50).length/results.length)*100):0;
  const perfData = results.slice(-7).map(r=>Math.round(r.percentage??0));
  return(
    <Box>
      <SectionTitle>Analytics</SectionTitle>
      <Grid container spacing={2} sx={{mb:3}}>
        {[{label:'Teachers',value:teachers.length,icon:<SupervisorAccount sx={{color:tokens.primary,fontSize:24}}/>,bg:'rgba(13,64,108,0.1)'},
          {label:'Total Exams',value:exams.length,icon:<Assignment sx={{color:tokens.accent,fontSize:24}}/>,bg:'rgba(12,189,115,0.1)'},
          {label:'Average Score',value:`${avg}%`,icon:<BarChart sx={{color:tokens.warning,fontSize:24}}/>,bg:'rgba(245,158,11,0.1)'},
          {label:'Pass Rate',value:`${passRate}%`,icon:<CheckCircle sx={{color:'#6366F1',fontSize:24}}/>,bg:'rgba(99,102,241,0.1)'}
        ].map((c,i)=>(
          <Grid item xs={6} md={3} key={i}>
            <Paper elevation={0} sx={{p:{xs:1.5,sm:2.5},borderRadius:3,bgcolor:'white',border:`1px solid ${tokens.surfaceBorder}`,display:'flex',alignItems:'center',gap:{xs:1,sm:2},'&:hover':{boxShadow:'0 6px 24px rgba(13,64,108,0.09)'}}}>
              <Box sx={{width:{xs:36,sm:48},height:{xs:36,sm:48},borderRadius:2.5,bgcolor:c.bg,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{c.icon}</Box>
              <Box sx={{minWidth:0}}><Typography fontWeight={800} sx={{fontFamily:"'DM Sans',sans-serif",fontSize:{xs:'1rem',sm:'1.5rem'}}}>{c.value}</Typography><Typography sx={{fontSize:{xs:10.5,sm:12},color:tokens.textMuted}} noWrap>{c.label}</Typography></Box>
            </Paper>
          </Grid>
        ))}
      </Grid>
      <Paper elevation={0} sx={{p:3,borderRadius:3,border:`1px solid ${tokens.surfaceBorder}`,bgcolor:'white'}}>
        <SectionTitle>Score Trend</SectionTitle>
        <AreaChart data={perfData.length>=3?perfData:[50,60,45,75,65,80,72]} color={tokens.accent}/>
      </Paper>
    </Box>
  );
}

function SettingsSection({ user }) {
  const { updateUserProfile } = useAuth();
  const [profile, setProfile] = useState({ firstName: user?.firstName||'', lastName: user?.lastName||'', phone: user?.phone||'', gender: user?.gender||'' });
  const [pwd, setPwd] = useState({ current: '', newPwd: '', confirm: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);
  const [snack, setSnack] = useState({ open: false, msg: '', severity: 'success' });
  const tf = { size: 'small', sx: { '& .MuiOutlinedInput-root': { borderRadius: 2 } } };

  const handleProfile = async () => {
    if (!profile.firstName.trim() || !profile.lastName.trim()) return setSnack({ open: true, msg: 'First and last name are required.', severity: 'error' });
    setSaving(true);
    try {
      const res = await api.put('/profile', { firstName: profile.firstName, lastName: profile.lastName, phone: profile.phone, gender: profile.gender });
      updateUserProfile(res.data);
      setSnack({ open: true, msg: 'Profile updated successfully.', severity: 'success' });
    } catch (e) {
      setSnack({ open: true, msg: e.response?.data?.message || 'Failed to save profile.', severity: 'error' });
    } finally { setSaving(false); }
  };

  const handlePassword = async () => {
    if (!pwd.current || !pwd.newPwd) return setSnack({ open: true, msg: 'Fill in current and new password.', severity: 'error' });
    if (pwd.newPwd.length < 6) return setSnack({ open: true, msg: 'New password must be at least 6 characters.', severity: 'error' });
    if (pwd.newPwd !== pwd.confirm) return setSnack({ open: true, msg: 'New passwords do not match.', severity: 'error' });
    setSavingPwd(true);
    try {
      await api.put('/auth/change-password', { currentPassword: pwd.current, newPassword: pwd.newPwd });
      setPwd({ current: '', newPwd: '', confirm: '' });
      setSnack({ open: true, msg: 'Password changed successfully.', severity: 'success' });
    } catch (e) {
      setSnack({ open: true, msg: e.response?.data?.message || 'Failed to change password.', severity: 'error' });
    } finally { setSavingPwd(false); }
  };

  return (
    <Box>
      <SectionTitle>Settings</SectionTitle>
      <Grid container spacing={3}>
        {/* Profile Card */}
        <Grid item xs={12} md={6}>
          <Paper elevation={0} sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3, bgcolor: 'white', border: `1px solid ${tokens.surfaceBorder}`, height: '100%' }}>
            <Typography fontWeight={700} sx={{ fontFamily: "'DM Sans',sans-serif", mb: 2 }}>Profile Information</Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}><TextField fullWidth label="First Name" value={profile.firstName} onChange={e => setProfile(p => ({ ...p, firstName: e.target.value }))} {...tf} /></Grid>
              <Grid item xs={12} sm={6}><TextField fullWidth label="Last Name" value={profile.lastName} onChange={e => setProfile(p => ({ ...p, lastName: e.target.value }))} {...tf} /></Grid>
              <Grid item xs={12}><TextField fullWidth label="Email" value={user?.email || ''} {...tf} InputProps={{ readOnly: true }} sx={{ ...tf.sx, '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: '#F8FAFC' } }} /></Grid>
              <Grid item xs={12} sm={6}><TextField fullWidth label="Phone" value={profile.phone} onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))} placeholder="+250 7XX XXX XXX" {...tf} /></Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small" sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}>
                  <InputLabel>Gender</InputLabel>
                  <Select label="Gender" value={profile.gender} onChange={e => setProfile(p => ({ ...p, gender: e.target.value }))}>
                    <MenuItem value="">Prefer not to say</MenuItem>
                    <MenuItem value="male">Male</MenuItem>
                    <MenuItem value="female">Female</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <Button variant="contained" onClick={handleProfile} disabled={saving} sx={{ borderRadius: 2, fontWeight: 700, background: gradients.brand, textTransform: 'none', minWidth: 140 }}>
                  {saving ? <CircularProgress size={18} sx={{ color: 'white' }} /> : 'Save Profile'}
                </Button>
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        {/* Password Card */}
        <Grid item xs={12} md={6}>
          <Paper elevation={0} sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3, bgcolor: 'white', border: `1px solid ${tokens.surfaceBorder}`, height: '100%' }}>
            <Typography fontWeight={700} sx={{ fontFamily: "'DM Sans',sans-serif", mb: 2 }}>Change Password</Typography>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField fullWidth label="Current Password" type={showPwd ? 'text' : 'password'} value={pwd.current} onChange={e => setPwd(p => ({ ...p, current: e.target.value }))} {...tf}
                  InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" onClick={() => setShowPwd(v => !v)}>{showPwd ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}</IconButton></InputAdornment> }} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth label="New Password" type={showPwd ? 'text' : 'password'} value={pwd.newPwd} onChange={e => setPwd(p => ({ ...p, newPwd: e.target.value }))} {...tf}
                  InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" onClick={() => setShowPwd(v => !v)}>{showPwd ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}</IconButton></InputAdornment> }} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth label="Confirm New Password" type={showPwd ? 'text' : 'password'} value={pwd.confirm} onChange={e => setPwd(p => ({ ...p, confirm: e.target.value }))} {...tf}
                  error={!!pwd.confirm && pwd.confirm !== pwd.newPwd}
                  helperText={pwd.confirm && pwd.confirm !== pwd.newPwd ? 'Passwords do not match' : ''}
                  InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" onClick={() => setShowPwd(v => !v)}>{showPwd ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}</IconButton></InputAdornment> }} />
              </Grid>
              <Grid item xs={12}>
                <Button variant="contained" onClick={handlePassword} disabled={savingPwd} sx={{ borderRadius: 2, fontWeight: 700, bgcolor: '#1E293B', textTransform: 'none', minWidth: 160, '&:hover': { bgcolor: '#0F172A' } }}>
                  {savingPwd ? <CircularProgress size={18} sx={{ color: 'white' }} /> : 'Change Password'}
                </Button>
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        {/* Account Info */}
        <Grid item xs={12}>
          <Paper elevation={0} sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3, bgcolor: 'white', border: `1px solid ${tokens.surfaceBorder}` }}>
            <Typography fontWeight={700} sx={{ fontFamily: "'DM Sans',sans-serif", mb: 1.5 }}>Account Info</Typography>
            <Grid container spacing={1.5}>
              {[
                { label: 'Role', value: user?.role },
                { label: 'Plan', value: user?.subscriptionPlan || 'free' },
                { label: 'Organization', value: user?.organization || '—' },
                { label: 'Account Type', value: user?.userType || '—' },
              ].map((item, i) => (
                <Grid item xs={6} sm={3} key={i}>
                  <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: '#F8FAFC', border: `1px solid ${tokens.surfaceBorder}` }}>
                    <Typography variant="caption" sx={{ color: tokens.textMuted, display: 'block', mb: 0.25 }}>{item.label}</Typography>
                    <Typography variant="body2" fontWeight={700} sx={{ textTransform: 'capitalize' }}>{item.value}</Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Paper>
        </Grid>
      </Grid>

      <Snackbar open={snack.open} autoHideDuration={3500} onClose={() => setSnack(s => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snack.severity} onClose={() => setSnack(s => ({ ...s, open: false }))} sx={{ borderRadius: 2 }}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  );
}
