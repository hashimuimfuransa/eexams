import { useState, useEffect } from 'react';
import {
  Box, Typography, Chip, Button, Paper, Grid, TextField,
  CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  useMediaQuery, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, LinearProgress, IconButton, Tooltip, Avatar,
  Select, MenuItem, InputAdornment, FormControl, InputLabel, OutlinedInput
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
      {activeSection === 'home'      && <OverviewSection stats={stats} statsLoading={statsLoading} teachers={filteredTeachers} exams={filteredExams} results={results} />}
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
function OverviewSection({ stats, statsLoading, teachers, exams, results }) {
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
            <SectionTitle action={<Button size="small" sx={{ color: tokens.accent, fontWeight: 700, fontSize: 12, textTransform: 'none' }}>View All</Button>}>Recent Teachers</SectionTitle>
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
            <Button fullWidth size="small" endIcon={<ArrowForward fontSize="small" />}
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
            { label: 'Add Teacher',    icon: <PersonAdd sx={{ fontSize: 18 }} />,  color: tokens.primary, bg: 'rgba(13,64,108,0.07)' },
            { label: 'Create Exam',    icon: <Add sx={{ fontSize: 18 }} />,         color: tokens.accent,  bg: 'rgba(12,189,115,0.09)' },
            { label: 'View Students',  icon: <People sx={{ fontSize: 18 }} />,      color: '#6366F1',      bg: 'rgba(99,102,241,0.09)' },
            { label: 'View Reports',   icon: <BarChart sx={{ fontSize: 18 }} />,    color: tokens.warning, bg: 'rgba(245,158,11,0.09)' },
          ].map((a, i) => (
            <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: { xs: 1.5, sm: 2.5 }, py: 1.5, borderRadius: 2.5, bgcolor: a.bg, cursor: 'pointer', flex: '1 1 130px', minWidth: { xs: 0, sm: 130 }, border: `1px solid ${a.color}18`, '&:hover': { opacity: 0.82 } }}>
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
  if (avg === null) return { label: 'No Data', color: '#94A3B8', bg: '#F1F5F9' };
  if (avg >= 80) return { label: 'Excellent', color: '#0CBD73', bg: 'rgba(12,189,115,0.1)' };
  if (avg >= 60) return { label: 'Good', color: '#6366F1', bg: 'rgba(99,102,241,0.1)' };
  if (avg >= 40) return { label: 'Average', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' };
  return { label: 'Needs Help', color: '#EF4444', bg: 'rgba(239,68,68,0.08)' };
}

function getPerfFeedback(avg, examsCount) {
  if (avg === null || examsCount === 0) return 'No exams taken yet.';
  if (avg >= 80) return 'Outstanding performance — keep it up!';
  if (avg >= 60) return 'Good results with room to improve.';
  if (avg >= 40) return 'Performing at average — needs more practice.';
  return 'Struggling — consider extra support sessions.';
}

function StudentsSection() {
  const [students, setStudents] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [perfFilter, setPerfFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [detailStudent, setDetailStudent] = useState(null);

  useEffect(() => {
    Promise.all([
      api.get('/admin/students'),
      api.get('/admin/results')
    ]).then(([sr, rr]) => {
      setStudents(sr.data || []);
      const raw = rr.data;
      setResults(Array.isArray(raw) ? raw : (raw?.results || []));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const studentStats = students.map(s => {
    const sResults = results.filter(r => r.student?._id === s._id || r.student === s._id);
    const examsCount = sResults.length;
    const avg = examsCount > 0
      ? Math.round(sResults.reduce((acc, r) => acc + (r.percentage ?? 0), 0) / examsCount)
      : null;
    const best = examsCount > 0 ? Math.max(...sResults.map(r => r.percentage ?? 0)) : null;
    const tier = getPerfTier(avg);
    return { ...s, examsCount, avg, best, tier };
  });

  const filtered = studentStats.filter(s => {
    const matchSearch = `${s.firstName} ${s.lastName} ${s.email}`.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === '' ? true : statusFilter === 'blocked' ? s.isBlocked : !s.isBlocked;
    const matchPerf = perfFilter === '' ? true : s.tier.label === perfFilter;
    return matchSearch && matchStatus && matchPerf;
  }).sort((a, b) => {
    if (sortBy === 'score') return (b.avg ?? -1) - (a.avg ?? -1);
    if (sortBy === 'exams') return b.examsCount - a.examsCount;
    return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
  });

  const totalExcellent = studentStats.filter(s => s.tier.label === 'Excellent').length;
  const totalNeedsHelp = studentStats.filter(s => s.tier.label === 'Needs Help').length;
  const overallAvg = studentStats.filter(s => s.avg !== null).length > 0
    ? Math.round(studentStats.filter(s => s.avg !== null).reduce((a, s) => a + s.avg, 0) / studentStats.filter(s => s.avg !== null).length)
    : null;

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}><CircularProgress sx={{ color: tokens.accent }} /></Box>;

  return (
    <Box>
      <SectionTitle>Students ({students.length})</SectionTitle>

      {/* Performance Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'Total Students', value: students.length, color: tokens.primary, bg: 'rgba(13,64,108,0.08)' },
          { label: 'Class Average', value: overallAvg !== null ? `${overallAvg}%` : '—', color: '#6366F1', bg: 'rgba(99,102,241,0.09)' },
          { label: 'Excellent (≥80%)', value: totalExcellent, color: tokens.accentDark, bg: 'rgba(12,189,115,0.09)' },
          { label: 'Needs Help (<40%)', value: totalNeedsHelp, color: '#EF4444', bg: 'rgba(239,68,68,0.07)' },
        ].map((card, i) => (
          <Grid item xs={6} sm={3} key={i}>
            <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white' }}>
              <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
                <Typography fontWeight={800} sx={{ color: card.color, fontSize: 14 }}>{card.value}</Typography>
              </Box>
              <Typography sx={{ fontSize: 11.5, color: tokens.textMuted, fontFamily: "'DM Sans',sans-serif" }}>{card.label}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* Filters Row */}
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
        <TextField size="small" placeholder="Search students…" value={search} onChange={e => setSearch(e.target.value)}
          sx={{ width: 180, '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
        <Select size="small" value={perfFilter} onChange={e => setPerfFilter(e.target.value)} displayEmpty sx={{ borderRadius: 2, minWidth: 130, fontSize: 13 }}>
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
        <Select size="small" value={sortBy} onChange={e => setSortBy(e.target.value)} displayEmpty sx={{ borderRadius: 2, minWidth: 120, fontSize: 13 }}>
          <MenuItem value="name">Sort: Name</MenuItem>
          <MenuItem value="score">Sort: Score ↓</MenuItem>
          <MenuItem value="exams">Sort: Exams ↓</MenuItem>
        </Select>
      </Box>

      <Paper elevation={0} sx={{ borderRadius: 3, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white', overflow: 'hidden' }}>
        <TableContainer sx={{ overflowX: 'auto' }}><Table sx={{ minWidth: 620 }}>
          <TableHead><TableRow sx={{ bgcolor: '#F8FAFC' }}>
            {['Student', 'Email / Class', 'Exams Taken', 'Avg Score', 'Performance', 'Feedback', 'Status'].map(h =>
              <TableCell key={h} sx={{ fontWeight: 700, color: tokens.textSecondary, fontSize: 12, whiteSpace: 'nowrap' }}>{h}</TableCell>)}
          </TableRow></TableHead>
          <TableBody>
            {filtered.length === 0
              ? <TableRow><TableCell colSpan={7} align="center" sx={{ py: 5, color: tokens.textMuted }}>No students match your filters.</TableCell></TableRow>
              : filtered.map(s => (
                <TableRow key={s._id} sx={{ '&:hover': { bgcolor: '#F8FAFC' }, cursor: 'pointer' }} onClick={() => setDetailStudent(s)}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Avatar sx={{ width: 32, height: 32, bgcolor: 'rgba(12,189,115,0.1)', color: tokens.accentDark, fontWeight: 700, fontSize: 13 }}>{s.firstName?.charAt(0)}</Avatar>
                      <Typography variant="body2" fontWeight={600} sx={{ fontFamily: "'DM Sans',sans-serif" }}>{s.firstName} {s.lastName}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ color: tokens.textMuted }}>{s.email}</Typography>
                    {s.class && <Chip label={s.class} size="small" sx={{ mt: 0.25, fontSize: 10, height: 18, bgcolor: 'rgba(13,64,108,0.07)', color: tokens.primary }} />}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={700} sx={{ color: tokens.textPrimary }}>{s.examsCount}</Typography>
                  </TableCell>
                  <TableCell>
                    {s.avg !== null
                      ? <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                          <Typography variant="body2" fontWeight={700} sx={{ color: s.tier.color }}>{s.avg}%</Typography>
                          <LinearProgress variant="determinate" value={s.avg} sx={{ width: 50, height: 5, borderRadius: 3, bgcolor: s.tier.bg, '& .MuiLinearProgress-bar': { bgcolor: s.tier.color } }} />
                        </Box>
                      : <Typography variant="caption" sx={{ color: tokens.textMuted }}>—</Typography>}
                  </TableCell>
                  <TableCell>
                    <Chip label={s.tier.label} size="small" sx={{ bgcolor: s.tier.bg, color: s.tier.color, fontWeight: 700, fontSize: 11 }} />
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" sx={{ color: tokens.textMuted, fontStyle: 'italic', maxWidth: 160, display: 'block' }}>
                      {getPerfFeedback(s.avg, s.examsCount)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={s.isBlocked ? 'Blocked' : 'Active'} size="small" sx={{ bgcolor: s.isBlocked ? 'rgba(239,68,68,0.08)' : 'rgba(12,189,115,0.1)', color: s.isBlocked ? '#EF4444' : tokens.accentDark, fontWeight: 600 }} />
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table></TableContainer>
      </Paper>

      {/* Student Detail Dialog */}
      <Dialog open={!!detailStudent} onClose={() => setDetailStudent(null)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        {detailStudent && (() => {
          const sResults = results.filter(r => r.student?._id === detailStudent._id || r.student === detailStudent._id);
          return (
            <>
              <DialogTitle sx={{ fontWeight: 700, fontFamily: "'DM Sans',sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                {detailStudent.firstName} {detailStudent.lastName}
                <IconButton size="small" onClick={() => setDetailStudent(null)}><Close fontSize="small" /></IconButton>
              </DialogTitle>
              <DialogContent>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                  <Chip label={detailStudent.tier.label} sx={{ bgcolor: detailStudent.tier.bg, color: detailStudent.tier.color, fontWeight: 700 }} />
                  {detailStudent.class && <Chip label={`Class: ${detailStudent.class}`} sx={{ bgcolor: 'rgba(13,64,108,0.07)', color: tokens.primary }} />}
                  <Chip label={detailStudent.isBlocked ? 'Blocked' : 'Active'} sx={{ bgcolor: detailStudent.isBlocked ? 'rgba(239,68,68,0.08)' : 'rgba(12,189,115,0.1)', color: detailStudent.isBlocked ? '#EF4444' : tokens.accentDark }} />
                </Box>
                <Typography variant="body2" sx={{ color: tokens.textMuted, mb: 0.5 }}>{detailStudent.email}</Typography>
                <Box sx={{ p: 1.5, bgcolor: detailStudent.tier.bg, borderRadius: 2, mb: 2 }}>
                  <Typography variant="body2" fontWeight={600} sx={{ color: detailStudent.tier.color }}>
                    💬 {getPerfFeedback(detailStudent.avg, detailStudent.examsCount)}
                  </Typography>
                </Box>
                <Grid container spacing={1.5} sx={{ mb: 2 }}>
                  {[
                    { label: 'Exams Taken', value: detailStudent.examsCount },
                    { label: 'Avg Score', value: detailStudent.avg !== null ? `${detailStudent.avg}%` : '—' },
                    { label: 'Best Score', value: detailStudent.best !== null ? `${Math.round(detailStudent.best)}%` : '—' },
                  ].map((m, i) => (
                    <Grid item xs={4} key={i}>
                      <Paper elevation={0} sx={{ p: 1.5, borderRadius: 2, border: `1px solid ${tokens.surfaceBorder}`, textAlign: 'center' }}>
                        <Typography fontWeight={800} sx={{ color: tokens.textPrimary, fontSize: 18 }}>{m.value}</Typography>
                        <Typography sx={{ fontSize: 10.5, color: tokens.textMuted }}>{m.label}</Typography>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
                {sResults.length > 0 && (
                  <>
                    <Typography fontWeight={700} sx={{ fontSize: 13, mb: 1 }}>Exam History</Typography>
                    {sResults.slice(0, 6).map((r, i) => (
                      <Box key={i} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.75, borderBottom: i < sResults.length - 1 ? `1px solid ${tokens.surfaceBorder}` : 'none' }}>
                        <Typography variant="body2" sx={{ color: tokens.textPrimary, maxWidth: 160 }} noWrap>{r.exam?.title || 'Exam'}</Typography>
                        <Chip label={`${Math.round(r.percentage ?? 0)}%`} size="small" sx={{ bgcolor: getPerfTier(r.percentage).bg, color: getPerfTier(r.percentage).color, fontWeight: 700, fontSize: 11 }} />
                      </Box>
                    ))}
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

function ExamsSection({ exams }) {
  return(
    <Box>
      <SectionTitle>Exams</SectionTitle>
      <Paper elevation={0} sx={{borderRadius:3,border:`1px solid ${tokens.surfaceBorder}`,bgcolor:'white',overflow:'hidden'}}>
        <TableContainer sx={{overflowX:'auto'}}><Table sx={{minWidth:500}}>
          <TableHead><TableRow sx={{bgcolor:'#F8FAFC'}}>{['Title','Status','Questions','Time','Created'].map(h=><TableCell key={h} sx={{fontWeight:700,color:tokens.textSecondary,fontSize:12}}>{h}</TableCell>)}</TableRow></TableHead>
          <TableBody>
            {exams.length===0?<TableRow><TableCell colSpan={5} align="center" sx={{py:5,color:tokens.textMuted}}>No exams.</TableCell></TableRow>:
            exams.map(e=>{const sc=e.status==='active'?tokens.accent:e.status==='draft'?tokens.warning:'#6366F1';return(
              <TableRow key={e._id} sx={{'&:hover':{bgcolor:'#F8FAFC'}}}>
                <TableCell><Typography variant="body2" fontWeight={600}>{e.title}</Typography></TableCell>
                <TableCell><Chip label={e.status||'draft'} size="small" sx={{bgcolor:`${sc}14`,color:sc,fontWeight:600,textTransform:'capitalize'}}/></TableCell>
                <TableCell><Chip label={e.questions?.length||0} size="small" sx={{bgcolor:'rgba(13,64,108,0.07)',color:tokens.primary}}/></TableCell>
                <TableCell><Typography variant="body2" sx={{color:tokens.textMuted}}>{e.timeLimit} min</Typography></TableCell>
                <TableCell><Typography variant="caption" sx={{color:tokens.textMuted}}>{new Date(e.createdAt).toLocaleDateString()}</Typography></TableCell>
              </TableRow>);})}
          </TableBody>
        </Table></TableContainer>
      </Paper>
    </Box>
  );
}

function ResultsSection({ results }) {
  const [selectedResult, setSelectedResult] = useState(null);
  const [detailedResult, setDetailedResult] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

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

  const handleCloseDetail = () => {
    setSelectedResult(null);
    setDetailedResult(null);
  };

  return(
    <Box>
      <SectionTitle>Results</SectionTitle>
      <Paper elevation={0} sx={{borderRadius:3,border:`1px solid ${tokens.surfaceBorder}`,bgcolor:'white',overflow:'hidden'}}>
        <TableContainer sx={{overflowX:'auto'}}><Table sx={{minWidth:440}}>
          <TableHead><TableRow sx={{bgcolor:'#F8FAFC'}}>{['Student','Exam','Score','Date','Actions'].map(h=><TableCell key={h} sx={{fontWeight:700,color:tokens.textSecondary,fontSize:12}}>{h}</TableCell>)}</TableRow></TableHead>
          <TableBody>
            {results.length===0?<TableRow><TableCell colSpan={5} align="center" sx={{py:5,color:tokens.textMuted}}>No results.</TableCell></TableRow>:
            results.slice(0,50).map(r=>{const pct=Math.round(r.percentage??0);return(
              <TableRow key={r._id} sx={{'&:hover':{bgcolor:'#F8FAFC'}}}>
                <TableCell>{r.student?.firstName} {r.student?.lastName}</TableCell>
                <TableCell sx={{color:tokens.textMuted}}>{r.exam?.title}</TableCell>
                <TableCell><Box sx={{display:'flex',alignItems:'center',gap:1}}><LinearProgress variant="determinate" value={pct} sx={{width:60,height:6,borderRadius:3,bgcolor:'#EEF2FF','& .MuiLinearProgress-bar':{bgcolor:pct>=70?tokens.accent:'#EF4444',borderRadius:3}}}/><Typography sx={{fontSize:12,fontWeight:700,color:pct>=70?tokens.accentDark:'#EF4444'}}>{pct}%</Typography></Box></TableCell>
                <TableCell><Typography variant="caption" sx={{color:tokens.textMuted}}>{new Date(r.submittedAt||r.createdAt).toLocaleDateString()}</Typography></TableCell>
                <TableCell>
                  <Button size="small" onClick={() => handleViewDetails(r)} sx={{textTransform:'none',fontWeight:600,fontSize:11}}>
                    View Details
                  </Button>
                </TableCell>
              </TableRow>);})}
          </TableBody>
        </Table></TableContainer>
      </Paper>

      {/* Detailed Result Dialog */}
      <Dialog open={!!selectedResult} onClose={handleCloseDetail} maxWidth="md" fullWidth PaperProps={{sx:{borderRadius:3}}}>
        <DialogTitle sx={{fontWeight:700,fontFamily:"'DM Sans',sans-serif"}}>
          Detailed Result - {selectedResult?.student?.firstName} {selectedResult?.student?.lastName}
        </DialogTitle>
        <DialogContent sx={{pt:'16px !important'}}>
          {loadingDetail?<Box sx={{display:'flex',justifyContent:'center',py:6}}><CircularProgress sx={{color:tokens.accent}}/></Box>:
          detailedResult?(
            <Box>
              <Box sx={{mb:3,p:2,bgcolor:'#F8FAFC',borderRadius:2}}>
                <Typography fontWeight={600} sx={{mb:1}}>Exam: {detailedResult.exam?.title}</Typography>
                <Typography variant="body2" sx={{color:tokens.textMuted}}>
                  Score: {detailedResult.totalScore}/{detailedResult.maxPossibleScore} ({detailedResult.percentage}%) | 
                  Time: {detailedResult.timeTaken} min | 
                  Grade: {detailedResult.grade}
                </Typography>
              </Box>
              
              <Typography fontWeight={600} sx={{mb:2}}>Answer Analysis</Typography>
              {detailedResult.answers?.map((answer,idx)=>(
                <Box key={idx} sx={{mb:2,p:2,border:`1px solid ${tokens.surfaceBorder}`,borderRadius:2}}>
                  <Box sx={{display:'flex',justifyContent:'space-between',alignItems:'center',mb:1}}>
                    <Typography variant="body2" fontWeight={600}>Question {idx+1}</Typography>
                    <Chip 
                      label={answer.isCorrect?'Correct':'Incorrect'} 
                      size="small" 
                      sx={{bgcolor:answer.isCorrect?'rgba(12,189,115,0.1)':'rgba(239,68,68,0.1)',color:answer.isCorrect?tokens.accent:'#EF4444',fontWeight:600}}
                    />
                  </Box>
                  <Typography variant="caption" sx={{color:tokens.textMuted,display:'block',mb:1}}>
                    Points: {answer.score}/{answer.question?.points} | Method: {answer.gradingMethod}
                  </Typography>
                  {answer.feedback && (
                    <Typography variant="body2" sx={{color:tokens.textSecondary,fontSize:12}}>
                      Feedback: {answer.feedback}
                    </Typography>
                  )}
                </Box>
              ))}
            </Box>
          ):<Typography sx={{color:tokens.textMuted}}>No detailed data available.</Typography>}
        </DialogContent>
        <DialogActions sx={{px:3,pb:2.5}}>
          <Button onClick={handleCloseDetail} sx={{borderRadius:2,textTransform:'none'}}>Close</Button>
        </DialogActions>
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
  const [first,setFirst]=useState(user?.firstName||'');
  const [last,setLast]=useState(user?.lastName||'');
  const [saved,setSaved]=useState(false);
  const save=async()=>{try{await api.put('/profile',{firstName:first,lastName:last});setSaved(true);setTimeout(()=>setSaved(false),2500);}catch{}};
  return(
    <Box>
      <SectionTitle>Settings</SectionTitle>
      <Paper elevation={0} sx={{p:{xs:2,sm:3},borderRadius:3,bgcolor:'white',border:`1px solid ${tokens.surfaceBorder}`}}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}><TextField fullWidth label="First Name" value={first} onChange={e=>setFirst(e.target.value)} size="small" sx={{'& .MuiOutlinedInput-root':{borderRadius:2}}}/></Grid>
          <Grid item xs={12} sm={6}><TextField fullWidth label="Last Name" value={last} onChange={e=>setLast(e.target.value)} size="small" sx={{'& .MuiOutlinedInput-root':{borderRadius:2}}}/></Grid>
          <Grid item xs={12}><TextField fullWidth label="Email" defaultValue={user?.email} size="small" InputProps={{readOnly:true}} sx={{'& .MuiOutlinedInput-root':{borderRadius:2}}}/></Grid>
          <Grid item xs={12}><Button variant="contained" onClick={save} sx={{borderRadius:2,fontWeight:700,background:gradients.brand,textTransform:'none'}}>{saved?'✓ Saved!':'Save Changes'}</Button></Grid>
        </Grid>
      </Paper>
    </Box>
  );
}
