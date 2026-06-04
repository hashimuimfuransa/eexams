import { useState, useEffect, useRef } from 'react';
import {
  Box, Typography, Chip, Button, Paper, Grid, TextField,
  CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  useMediaQuery, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, LinearProgress, IconButton, Tooltip,
  Select, FormControl, InputLabel, MenuItem as MuiMenuItem, Avatar,
  InputAdornment, Snackbar, Alert
} from '@mui/material';
import {
  Dashboard as DashIcon, Business, People, Settings, AttachMoney,
  SupervisorAccount, School, TrendingUp,
  CheckCircle, Block, Edit, Add, ArrowForward, Delete, InfoOutlined, Close,
  Visibility, VisibilityOff, Assessment, Person, Email, EmojiEvents, ReportProblem
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { tokens, gradients, planColors as PLAN_COLORS } from './dashboardTokens';
import { DashboardShell, Sidebar, Topbar, SectionTitle, getDynamicGreeting } from './DashboardShell';
import LeaderboardSection from '../components/admin/LeaderboardSection';

const nav = [
  { id: 'home',          label: 'Overview',                icon: <DashIcon sx={{ fontSize: 20 }} /> },
  { id: 'organizations', label: 'Organizations',           icon: <Business sx={{ fontSize: 20 }} /> },
  { id: 'teachers',      label: 'Teachers',               icon: <SupervisorAccount sx={{ fontSize: 20 }} /> },
  { id: 'users',         label: 'All Users',               icon: <People sx={{ fontSize: 20 }} /> },
  { id: 'exam-requests', label: 'Exam Requests',           icon: <School sx={{ fontSize: 20 }} /> },
  { id: 'subscriptions', label: 'Subscriptions',             icon: <AttachMoney sx={{ fontSize: 20 }} /> },
  { id: 'marketplace',   label: 'Exam Bank Marketplace',    icon: <School sx={{ fontSize: 20 }} /> },
  { id: 'student-results', label: 'Student Results',  icon: <Assessment sx={{ fontSize: 20 }} /> },
  { id: 'reclamations',    label: 'Reclamations',        icon: <ReportProblem sx={{ fontSize: 20 }} /> },
  { id: 'leaderboard',     label: 'Leaderboard',      icon: <EmojiEvents sx={{ fontSize: 20 }} /> },
  { id: 'analytics',       label: 'Analytics',        icon: <TrendingUp sx={{ fontSize: 20 }} /> },
  { id: 'settings',        label: 'Settings',         icon: <Settings sx={{ fontSize: 20 }} /> },
];

function AreaChart({ data = [], color = tokens.accent }) {
  if (!data.length || data.length < 2) data = [50,60,45,75,65,80,72];
  const w = 380, h = 110, max = Math.max(...data) || 100;
  const pts = data.map((v,i)=>`${(i/(data.length-1))*w},${h-(v/max)*(h-12)-6}`).join(' ');
  const area = `${pts} ${w},${h} 0,${h}`;
  const labels = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  return (
    <svg viewBox={`0 0 ${w} ${h+22}`} style={{ width:'100%', height:140 }}>
      <defs><linearGradient id="ag3" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.22"/><stop offset="100%" stopColor={color} stopOpacity="0.02"/></linearGradient></defs>
      {[0,25,50,75,100].map(y=><line key={y} x1="0" x2={w} y1={h-(y/100)*(h-12)-6} y2={h-(y/100)*(h-12)-6} stroke="#E2E8F0" strokeWidth="1"/>)}
      <polygon points={area} fill="url(#ag3)"/>
      <polyline fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={pts}/>
      {data.map((v,i)=>{const cx=(i/(data.length-1))*w,cy=h-(v/max)*(h-12)-6;return<circle key={i} cx={cx} cy={cy} r="4" fill="white" stroke={color} strokeWidth="2"/>;})}
      {labels.slice(0,data.length).map((l,i)=><text key={i} x={(i/(Math.max(data.length,1)-1))*w} y={h+18} textAnchor="middle" fontSize="10" fill={tokens.textMuted}>{l}</text>)}
    </svg>
  );
}

export default function SuperAdminDashboard() {
  const isMobile = useMediaQuery('(max-width:900px)');
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const [activeSection, setActiveSection] = useState('home');
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (query) => {
    setSearchQuery(query);
  };

  useEffect(() => {
    api.get('/superadmin/dashboard-stats').then(r => setStats(r.data)).catch(() => setStats({})).finally(() => setStatsLoading(false));
  }, []);

  return (
    <DashboardShell
      sidebarEl={<Sidebar user={user} logout={logout} activeSection={activeSection} setActiveSection={setActiveSection} onClose={() => setSidebarOpen(false)} isMobile={isMobile} nav={nav} portalLabel="Super Admin" />}
      topbarEl={<Topbar greeting={getDynamicGreeting(user?.firstName || 'Admin')} sub="Platform-wide activity and management" user={user} onMenuClick={() => setSidebarOpen(v => !v)} onLogout={logout} roleLabel="Super Admin" onSearch={handleSearch} />}
      sidebarOpen={sidebarOpen} isMobile={isMobile} onCloseSidebar={() => setSidebarOpen(false)}>
      {activeSection === 'home'          && <OverviewSection stats={stats} statsLoading={statsLoading} searchQuery={searchQuery} setActiveSection={setActiveSection} />}
      {activeSection === 'organizations' && <OrganizationsSection searchQuery={searchQuery} />}
      {activeSection === 'teachers'      && <TeachersSection searchQuery={searchQuery} />}
      {activeSection === 'users'         && <AllUsersSection searchQuery={searchQuery} />}
      {activeSection === 'exam-requests' && <ExamRequestsSection searchQuery={searchQuery} />}
      {activeSection === 'subscriptions' && <SubscriptionsSection stats={stats} />}
      {activeSection === 'marketplace'   && <ExamBankMarketplaceSection searchQuery={searchQuery} />}
      {activeSection === 'student-results' && <StudentResultsSection searchQuery={searchQuery} />}
      {activeSection === 'reclamations'    && <ReclamationsSection searchQuery={searchQuery} />}
      {activeSection === 'leaderboard'     && <LeaderboardSection systemWide={true} />}
      {activeSection === 'analytics'       && <AnalyticsSection stats={stats} />}
      {activeSection === 'settings'      && <SettingsSection user={user} />}
    </DashboardShell>
  );
}

/* ── OVERVIEW ── */
function OverviewSection({ stats, statsLoading, setActiveSection }) {
  const [orgs, setOrgs] = useState([]);
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  useEffect(() => { api.get('/superadmin/organizations').then(r => setOrgs((r.data||[]).slice(0,5))).catch(()=>{}).finally(()=>setLoadingOrgs(false)); }, []);

  const planData = [
    { plan:'Free',       color: PLAN_COLORS.free,       count: stats?.organizations?.byPlan?.free ?? 0 },
    { plan:'Basic',      color: PLAN_COLORS.basic,      count: stats?.organizations?.byPlan?.basic ?? 0 },
    { plan:'Premium',    color: PLAN_COLORS.premium,    count: stats?.organizations?.byPlan?.premium ?? 0 },
    { plan:'Enterprise', color: PLAN_COLORS.enterprise, count: stats?.organizations?.byPlan?.enterprise ?? 0 },
  ];
  const planTotal = planData.reduce((s,p)=>s+p.count,0)||1;

  const statCards = [
    { label:'Organizations',  value:stats?.totalOrganizations, iconBg:'rgba(13,64,108,0.1)',  icon:<Business sx={{color:tokens.primary,fontSize:24}}/>,       sub:'registered', subColor:tokens.primary },
    { label:'Total Teachers', value:stats?.totalTeachers,      iconBg:'rgba(12,189,115,0.1)', icon:<SupervisorAccount sx={{color:tokens.accent,fontSize:24}}/>, sub:'platform-wide', subColor:tokens.accent },
    { label:'Total Students', value:stats?.totalStudents,      iconBg:'rgba(245,158,11,0.1)', icon:<People sx={{color:tokens.warning,fontSize:24}}/>,           sub:'enrolled', subColor:tokens.warning },
    { label:'Active Exams',   value:stats?.totalExams,         iconBg:'rgba(99,102,241,0.1)', icon:<School sx={{color:'#6366F1',fontSize:24}}/>,                sub:'running', subColor:'#6366F1' },
  ];

  return (
    <Box>
      <Paper elevation={0} sx={{ p:3, mb:3, borderRadius:3, background:gradients.brand, color:'white', position:'relative', overflow:'hidden' }}>
        <Box sx={{ position:'absolute', right:-50, top:-50, width:200, height:200, borderRadius:'50%', bgcolor:'rgba(255,255,255,0.06)' }}/>
        <Typography variant="h5" fontWeight={700} sx={{ fontFamily:"'DM Sans',sans-serif" }}>Platform Overview</Typography>
        <Typography variant="body2" sx={{ color:'rgba(255,255,255,0.8)', mt:0.5, fontFamily:"'DM Sans',sans-serif" }}>Manage all organizations, subscriptions and platform activity.</Typography>
      </Paper>

      <Grid container spacing={2} sx={{ mb:3 }}>
        {statCards.map((s,i)=>(
          <Grid item xs={6} md={3} key={i}>
            <Paper elevation={0} sx={{ p:2.5, borderRadius:3, bgcolor:'white', border:`1px solid ${tokens.surfaceBorder}`, '&:hover':{boxShadow:'0 6px 24px rgba(13,64,108,0.09)'} }}>
              <Box sx={{ width:48, height:48, borderRadius:2.5, bgcolor:s.iconBg, display:'flex', alignItems:'center', justifyContent:'center', mb:1.5 }}>{s.icon}</Box>
              {statsLoading?<CircularProgress size={20} sx={{color:tokens.accent}}/>:
                <Typography variant="h4" fontWeight={800} sx={{ color:tokens.textPrimary, fontFamily:"'DM Sans',sans-serif", lineHeight:1 }}>{s.value??'—'}</Typography>}
              <Typography sx={{ fontSize:12.5, color:tokens.textMuted, fontFamily:"'DM Sans',sans-serif", mt:0.25 }}>{s.label}</Typography>
              <Typography sx={{ fontSize:11.5, color:s.subColor, fontWeight:600, fontFamily:"'DM Sans',sans-serif", mt:0.35 }}>{s.sub}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2.5}>
        {/* Subscription breakdown */}
        <Grid item xs={12} md={5}>
          <Paper elevation={0} sx={{ p:2.5, borderRadius:3, border:`1px solid ${tokens.surfaceBorder}`, bgcolor:'white' }}>
            <SectionTitle>Subscription Breakdown</SectionTitle>
            {statsLoading?<CircularProgress size={22} sx={{color:tokens.accent}}/>:planData.map((p,i)=>(
              <Box key={i} sx={{ mb:1.75 }}>
                <Box sx={{ display:'flex', justifyContent:'space-between', mb:0.5 }}>
                  <Box sx={{ display:'flex', alignItems:'center', gap:1 }}>
                    <Box sx={{ width:10, height:10, borderRadius:'50%', bgcolor:p.color }}/>
                    <Typography variant="body2" fontWeight={600} sx={{ fontFamily:"'DM Sans',sans-serif" }}>{p.plan}</Typography>
                  </Box>
                  <Typography variant="body2" fontWeight={700} sx={{ color:tokens.textPrimary }}>{p.count}</Typography>
                </Box>
                <LinearProgress variant="determinate" value={(p.count/planTotal)*100}
                  sx={{ height:7, borderRadius:4, bgcolor:`${p.color}1A`, '& .MuiLinearProgress-bar':{bgcolor:p.color,borderRadius:4} }}/>
              </Box>
            ))}
          </Paper>
        </Grid>

        {/* Recent orgs */}
        <Grid item xs={12} md={7}>
          <Paper elevation={0} sx={{ p:2.5, borderRadius:3, border:`1px solid ${tokens.surfaceBorder}`, bgcolor:'white' }}>
            <SectionTitle action={<Button size="small" onClick={() => setActiveSection('organizations')} sx={{color:tokens.accent,fontWeight:700,fontSize:12,textTransform:'none'}}>View All</Button>}>Recent Organizations</SectionTitle>
            {loadingOrgs?<CircularProgress size={22} sx={{color:tokens.accent}}/>:orgs.length===0?<Typography sx={{color:tokens.textMuted,fontSize:13}}>No organizations yet.</Typography>:(
              <TableContainer><Table size="small">
                <TableHead><TableRow sx={{bgcolor:'#F8FAFC'}}>{['Organization','Plan','Status'].map(h=><TableCell key={h} sx={{fontWeight:700,color:tokens.textSecondary,fontSize:12}}>{h}</TableCell>)}</TableRow></TableHead>
                <TableBody>
                  {orgs.map(o=>(
                    <TableRow key={o._id} sx={{'&:hover':{bgcolor:'#F8FAFC'}}}>
                      <TableCell><Box sx={{display:'flex',alignItems:'center',gap:1.25}}><Avatar sx={{width:30,height:30,background:gradients.brand,fontSize:12,fontWeight:700}}>{(o.organization||o.firstName)?.charAt(0)}</Avatar><Box><Typography variant="body2" fontWeight={600}>{o.organization||`${o.firstName} ${o.lastName}`}</Typography><Typography variant="caption" sx={{color:tokens.textMuted}}>{o.email}</Typography></Box></Box></TableCell>
                      <TableCell><Chip label={o.subscriptionPlan||'free'} size="small" sx={{bgcolor:`${PLAN_COLORS[o.subscriptionPlan]||PLAN_COLORS.free}14`,color:PLAN_COLORS[o.subscriptionPlan]||PLAN_COLORS.free,fontWeight:600}}/></TableCell>
                      <TableCell><Chip label={o.subscriptionStatus||'pending'} size="small" sx={{bgcolor:o.subscriptionStatus==='active'?'rgba(12,189,115,0.1)':'rgba(245,158,11,0.1)',color:o.subscriptionStatus==='active'?tokens.accentDark:tokens.warning,fontWeight:600}}/></TableCell>
                    </TableRow>))}
                </TableBody>
              </Table></TableContainer>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Quick Actions */}
      <Paper elevation={0} sx={{ mt:2.5, p:2.5, borderRadius:3, border:`1px solid ${tokens.surfaceBorder}`, bgcolor:'white' }}>
        <Typography fontWeight={700} sx={{ fontSize:15, fontFamily:"'DM Sans',sans-serif", mb:2 }}>Quick Actions</Typography>
        <Box sx={{ display:'flex', flexWrap:'wrap', gap:1.5 }}>
          {[
            { label:'Organizations', icon:<Business sx={{fontSize:18}}/>,       color:tokens.primary, bg:'rgba(13,64,108,0.07)',   section:'organizations' },
            { label:'All Users',     icon:<People sx={{fontSize:18}}/>,         color:'#6366F1',      bg:'rgba(99,102,241,0.09)',  section:'users' },
            { label:'Subscriptions', icon:<AttachMoney sx={{fontSize:18}}/>,    color:tokens.accent,  bg:'rgba(12,189,115,0.09)',  section:'subscriptions' },
            { label:'Analytics',     icon:<TrendingUp sx={{fontSize:18}}/>,     color:tokens.warning, bg:'rgba(245,158,11,0.09)',  section:'analytics' },
            { label:'Settings',      icon:<Settings sx={{fontSize:18}}/>,       color:'#64748B',      bg:'rgba(100,116,139,0.09)', section:'settings' },
          ].map((a,i)=>(
            <Box key={i} onClick={()=>setActiveSection(a.section)} sx={{ display:'flex', alignItems:'center', gap:1.25, px:{xs:1.5,sm:2.5}, py:1.5, borderRadius:2.5, bgcolor:a.bg, cursor:'pointer', flex:'1 1 120px', minWidth:{xs:0,sm:120}, border:`1px solid ${a.color}18`, transition:'opacity 0.15s', '&:hover':{opacity:0.82} }}>
              <Box sx={{color:a.color}}>{a.icon}</Box>
              <Typography fontWeight={700} sx={{color:a.color, fontSize:13.5, fontFamily:"'DM Sans',sans-serif"}}>{a.label}</Typography>
            </Box>
          ))}
        </Box>
      </Paper>
    </Box>
  );
}

/* ── ORGANIZATIONS ── */
function OrganizationsSection() {
  const [allOrgs,setAllOrgs]=useState([]);
  const [loading,setLoading]=useState(true);
  const [selected,setSelected]=useState(null);
  const [plan,setPlan]=useState('');
  const [status,setStatus]=useState('');
  const [saving,setSaving]=useState(false);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [sortBy, setSortBy] = useState('name');

  // Delete organization state
  const [deleteDialog, setDeleteDialog] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Activity dialog state
  const [activityDialog, setActivityDialog] = useState(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityData, setActivityData] = useState(null);
  const [activityPeriod, setActivityPeriod] = useState('30d');

  useEffect(()=>{
    api.get('/superadmin/organizations').then(r=>{
      const data = (r.data||[]).map(o => {
        if (o.category) return o;
        const isOrgAdmin = o.role === 'admin' || o.role === 'superadmin';
        const isOrgTeacher = o.role === 'teacher' && o.parentAdmin != null;
        return { ...o, category: isOrgAdmin ? 'organization' : isOrgTeacher ? 'org_teacher' : 'individual' };
      });
      setAllOrgs(data);
    }).finally(()=>setLoading(false));
  },[]);

  // Filter function
  const filterOrgs = (orgs) => {
    return orgs.filter(o => {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery || 
        (o.organization?.toLowerCase().includes(searchLower)) ||
        (o.firstName?.toLowerCase().includes(searchLower)) ||
        (o.lastName?.toLowerCase().includes(searchLower)) ||
        (o.email?.toLowerCase().includes(searchLower));
      
      const matchesPlan = !planFilter || o.subscriptionPlan === planFilter;
      const matchesStatus = !statusFilter || 
        (statusFilter === 'blocked' ? o.isBlocked : o.subscriptionStatus === statusFilter);
      
      return matchesSearch && matchesPlan && matchesStatus;
    }).sort((a, b) => {
      if (sortBy === 'name') {
        const nameA = (a.organization || `${a.firstName} ${a.lastName}`).toLowerCase();
        const nameB = (b.organization || `${b.firstName} ${b.lastName}`).toLowerCase();
        return nameA.localeCompare(nameB);
      } else if (sortBy === 'students') {
        return (b.stats?.studentCount || 0) - (a.stats?.studentCount || 0);
      } else if (sortBy === 'exams') {
        return (b.stats?.examCount || 0) - (a.stats?.examCount || 0);
      } else if (sortBy === 'recent') {
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      }
      return 0;
    });
  };

  // Apply type filter first, then other filters
  const filteredAllOrgs = allOrgs.filter(o => {
    if (typeFilter === 'organization') return o.category === 'organization';
    if (typeFilter === 'org_teacher') return o.category === 'org_teacher';
    if (typeFilter === 'individual') return o.category === 'individual';
    return true;
  });

  // Show all categories by default to match dashboard stats
  const organizations = filterOrgs(filteredAllOrgs.filter(o => o.category === 'organization'));
  const orgTeachers = filterOrgs(filteredAllOrgs.filter(o => o.category === 'org_teacher'));
  const individuals = filterOrgs(filteredAllOrgs.filter(o => o.category === 'individual'));

  // Combined list for "All" view (matches dashboard stats count)
  const allCombined = filterOrgs(filteredAllOrgs);

  const handleOpen=(o)=>{setSelected(o);setPlan(o.subscriptionPlan||'free');setStatus(o.subscriptionStatus||'pending');};
  const handleSave=async()=>{
    setSaving(true);
    try{await api.put(`/superadmin/organizations/${selected._id}/subscription`,{subscriptionPlan:plan,subscriptionStatus:status});setAllOrgs(p=>p.map(o=>o._id===selected._id?{...o,subscriptionPlan:plan,subscriptionStatus:status}:o));setSelected(null);}
    catch{}finally{setSaving(false);}
  };
  const handleToggle=async(o)=>{
    try{await api.put(`/superadmin/organizations/${o._id}/toggle-block`);setAllOrgs(p=>p.map(x=>x._id===o._id?{...x,isBlocked:!x.isBlocked}:x));}catch{}
  };

  const handleDeleteOrganization=async()=>{
    if(!deleteDialog)return;
    setDeleting(true);
    try{
      await api.delete(`/superadmin/organizations/${deleteDialog._id}`);
      setAllOrgs(p=>p.filter(o=>o._id!==deleteDialog._id));
      setDeleteDialog(null);
    }catch(err){
      console.error('Delete organization error:',err);
    }finally{
      setDeleting(false);
    }
  };

  const handleViewActivity=async(org)=>{
    setActivityDialog(org);
    setActivityLoading(true);
    setActivityData(null);
    try{
      const response=await api.get(`/superadmin/organizations/${org._id}/activity?period=${activityPeriod}`);
      setActivityData(response.data);
    }catch(err){
      console.error('Fetch activity error:',err);
    }finally{
      setActivityLoading(false);
    }
  };

  const handleActivityPeriodChange=(period)=>{
    setActivityPeriod(period);
    if(activityDialog){
      handleViewActivity(activityDialog);
    }
  };

  const StatBadge = ({ icon, value, label, color }) => (
    <Box sx={{display:'flex',alignItems:'center',gap:0.75,bgcolor:`${color}15`,px:1.5,py:0.5,borderRadius:2}}>
      {icon}
      <Typography variant="caption" fontWeight={700} sx={{color}}>{value}</Typography>
      <Typography variant="caption" sx={{color:tokens.textMuted,fontSize:'10px'}}>{label}</Typography>
    </Box>
  );

  const renderOrgCards = (data, title, isOrg, isOrgTeacher = false) => (
    <Box sx={{mb:4}}>
      <Box sx={{display:'flex',alignItems:'center',gap:1.5,mb:2}}>
        {isOrg ? <Business sx={{color:tokens.primary,fontSize:22}}/> : isOrgTeacher ? <SupervisorAccount sx={{color:'#6366F1',fontSize:22}}/> : <SupervisorAccount sx={{color:tokens.accent,fontSize:22}}/>}
        <Typography variant="h6" fontWeight={700} sx={{color:tokens.textPrimary,fontFamily:"'DM Sans',sans-serif"}}>
          {title}
        </Typography>
        <Chip label={data.length} size="small" sx={{bgcolor:isOrg?`${tokens.primary}15`:isOrgTeacher?'rgba(99,102,241,0.12)':`${tokens.accent}15`,color:isOrg?tokens.primary:isOrgTeacher?'#6366F1':tokens.accent,fontWeight:700,ml:1}}/>
      </Box>

      {data.length===0?(
        <Paper elevation={0} sx={{p:4,borderRadius:3,border:`1px dashed ${tokens.surfaceBorder}`,bgcolor:'#FAFBFC',textAlign:'center'}}>
          <Typography sx={{color:tokens.textMuted}}>No {title.toLowerCase()} found.</Typography>
        </Paper>
      ):(
        <Grid container spacing={2}>
          {data.map(o=>{
            const isIndividual = o.role === 'teacher';
            const isSuper = o.role === 'superadmin';

            return (
              <Grid item xs={12} md={isOrg?6:4} lg={isOrg?4:3} key={o._id}>
                <Paper elevation={0} sx={{
                  p:2.5,borderRadius:3,border:`1px solid ${tokens.surfaceBorder}`,bgcolor:'white',
                  transition:'all 0.2s ease','&:hover':{boxShadow:'0 8px 30px rgba(13,64,108,0.12)',transform:'translateY(-2px)'}
                }}>
                  {/* Header */}
                  <Box sx={{display:'flex',alignItems:'flex-start',gap:1.5,mb:2}}>
                    <Avatar sx={{
                      width:44,height:44,fontSize:16,fontWeight:700,
                      background:isSuper?gradients.brand:(isOrg?`linear-gradient(135deg,${tokens.primary}20,${tokens.primary}40)`:isOrgTeacher?'linear-gradient(135deg,rgba(99,102,241,0.12),rgba(99,102,241,0.25))':`linear-gradient(135deg,${tokens.accent}20,${tokens.accent}40)`),
                      color:isSuper?'white':(isOrg?tokens.primary:isOrgTeacher?'#6366F1':tokens.accent)
                    }}>
                      {isOrg?(o.organization?.charAt(0)||'?'):o.firstName?.charAt(0)}
                    </Avatar>
                    <Box sx={{flex:1,minWidth:0}}>
                      <Typography variant="body1" fontWeight={700} sx={{fontFamily:"'DM Sans',sans-serif",whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                        {isOrg?o.organization:`${o.firstName} ${o.lastName}`}
                      </Typography>
                      <Typography variant="caption" sx={{color:tokens.textMuted,display:'block'}}>{o.email}</Typography>
                      {isOrg && (
                        <Chip label={isSuper?'Super Admin':'Organization Admin'} size="small" sx={{
                          mt:0.75,height:20,fontSize:'10px',
                          bgcolor:isSuper?'rgba(139,92,246,0.1)':`${tokens.primary}10`,
                          color:isSuper?'#8B5CF6':tokens.primary,fontWeight:600
                        }}/>
                      )}
                      {isOrgTeacher && (
                        <Chip label={`${o.organization||'Org'} Teacher`} size="small" sx={{
                          mt:0.75,height:20,fontSize:'10px',
                          bgcolor:'rgba(99,102,241,0.1)',
                          color:'#6366F1',fontWeight:600
                        }}/>
                      )}
                    </Box>
                  </Box>

                  {/* Stats */}
                  <Box sx={{display:'flex',flexWrap:'wrap',gap:1,mb:2}}>
                    {isOrg && <StatBadge icon={<SupervisorAccount sx={{fontSize:14,color:tokens.accent}}/>} value={o.stats?.teacherCount??0} label="Teachers" color={tokens.accent}/>}
                    <StatBadge icon={<People sx={{fontSize:14,color:tokens.warning}}/>} value={o.stats?.studentCount??0} label="Students" color={tokens.warning}/>
                    <StatBadge icon={<School sx={{fontSize:14,color:'#6366F1'}}/>} value={o.stats?.examCount??0} label="Exams" color="#6366F1"/>
                  </Box>

                  {/* Footer */}
                  <Box sx={{display:'flex',alignItems:'center',justifyContent:'space-between',pt:1.5,borderTop:`1px solid ${tokens.surfaceBorder}`}}>
                    <Box sx={{display:'flex',alignItems:'center',gap:1}}>
                      {isOrg && <Chip label={o.subscriptionPlan||'free'} size="small" sx={{height:22,fontSize:'11px',bgcolor:`${PLAN_COLORS[o.subscriptionPlan]||PLAN_COLORS.free}15`,color:PLAN_COLORS[o.subscriptionPlan]||PLAN_COLORS.free,fontWeight:600,textTransform:'capitalize'}}/>}
                      <Chip label={o.isBlocked?'Blocked':(o.subscriptionStatus||'active')} size="small" sx={{
                        height:22,fontSize:'11px',fontWeight:600,
                        bgcolor:o.isBlocked?'rgba(239,68,68,0.1)':o.subscriptionStatus==='active'?'rgba(12,189,115,0.1)':'rgba(245,158,11,0.1)',
                        color:o.isBlocked?'#EF4444':o.subscriptionStatus==='active'?tokens.accentDark:tokens.warning
                      }}/>
                    </Box>
                    <Box sx={{display:'flex',gap:0.5}}>
                      <Tooltip title="View Activity">
                        <IconButton size="small" onClick={()=>handleViewActivity(o)} sx={{color:tokens.textSecondary,bgcolor:`${tokens.textSecondary}10`,'&:hover':{bgcolor:`${tokens.textSecondary}20`},width:32,height:32}}>
                          <Assessment fontSize="small"/>
                        </IconButton>
                      </Tooltip>
                      {!isIndividual && (
                        <Tooltip title="Edit subscription">
                          <IconButton size="small" onClick={()=>handleOpen(o)} sx={{color:tokens.primary,bgcolor:`${tokens.primary}10`,'&:hover':{bgcolor:`${tokens.primary}20`},width:32,height:32}}>
                            <Edit fontSize="small"/>
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title={o.isBlocked?'Unblock':'Block'}>
                        <IconButton size="small" onClick={()=>handleToggle(o)} sx={{color:o.isBlocked?tokens.accent:'#EF4444',bgcolor:o.isBlocked?`${tokens.accent}10`:'rgba(239,68,68,0.1)','&:hover':{bgcolor:o.isBlocked?`${tokens.accent}20`:'rgba(239,68,68,0.2)'},width:32,height:32}}>
                          {o.isBlocked?<CheckCircle fontSize="small"/>:<Block fontSize="small"/>}
                        </IconButton>
                      </Tooltip>
                      {isOrg && (
                        <Tooltip title="Delete Organization">
                          <IconButton size="small" onClick={()=>setDeleteDialog(o)} sx={{color:'#EF4444',bgcolor:'rgba(239,68,68,0.1)','&:hover':{bgcolor:'rgba(239,68,68,0.2)'},width:32,height:32}}>
                            <Delete fontSize="small"/>
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  </Box>
                </Paper>
              </Grid>
            );
          })}
        </Grid>
      )}
    </Box>
  );

  // Check if any filters are active
  const hasActiveFilters = searchQuery || planFilter || statusFilter || typeFilter || sortBy !== 'name';
  const clearFilters = () => {
    setSearchQuery('');
    setPlanFilter('');
    setStatusFilter('');
    setTypeFilter('');
    setSortBy('name');
  };

  return(
    <Box>
      <SectionTitle action={
        <Box sx={{display:'flex',alignItems:'center',gap:2}}>
          <Typography variant="caption" sx={{color:tokens.textMuted,fontWeight:600}}>
            Total: {allCombined.length} (Orgs: {organizations.length}, Org Teachers: {orgTeachers.length}, Individual: {individuals.length})
          </Typography>
          {hasActiveFilters && (
            <Button size="small" onClick={clearFilters} sx={{color:tokens.textMuted,textTransform:'none',fontWeight:600}}>
              Clear Filters
            </Button>
          )}
        </Box>
      }>Organizations & Teachers</SectionTitle>

      {/* Filter Bar */}
      <Paper elevation={0} sx={{p:2,mb:3,borderRadius:3,border:`1px solid ${tokens.surfaceBorder}`,bgcolor:'white'}}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search name, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: <Box component="span" sx={{color:tokens.textMuted,mr:1}}>🔍</Box>
              }}
              sx={{'& .MuiOutlinedInput-root':{borderRadius:2,bgcolor:'#FAFBFC'}}}
            />
          </Grid>
          <Grid item xs={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Type</InputLabel>
              <Select label="Type" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} sx={{borderRadius:2,bgcolor:'#FAFBFC'}}>
                <MuiMenuItem value="">All Types</MuiMenuItem>
                <MuiMenuItem value="organization">Organizations</MuiMenuItem>
                <MuiMenuItem value="org_teacher">Organization Teachers</MuiMenuItem>
                <MuiMenuItem value="individual">Individual Teachers</MuiMenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Plan</InputLabel>
              <Select label="Plan" value={planFilter} onChange={(e) => setPlanFilter(e.target.value)} sx={{borderRadius:2,bgcolor:'#FAFBFC'}}>
                <MuiMenuItem value="">All Plans</MuiMenuItem>
                <MuiMenuItem value="free">Free</MuiMenuItem>
                <MuiMenuItem value="basic">Basic</MuiMenuItem>
                <MuiMenuItem value="premium">Premium</MuiMenuItem>
                <MuiMenuItem value="enterprise">Enterprise</MuiMenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select label="Status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} sx={{borderRadius:2,bgcolor:'#FAFBFC'}}>
                <MuiMenuItem value="">All Status</MuiMenuItem>
                <MuiMenuItem value="active">Active</MuiMenuItem>
                <MuiMenuItem value="pending">Pending</MuiMenuItem>
                <MuiMenuItem value="blocked">Blocked</MuiMenuItem>
                <MuiMenuItem value="expired">Expired</MuiMenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Sort By</InputLabel>
              <Select label="Sort By" value={sortBy} onChange={(e) => setSortBy(e.target.value)} sx={{borderRadius:2,bgcolor:'#FAFBFC'}}>
                <MuiMenuItem value="name">Name (A-Z)</MuiMenuItem>
                <MuiMenuItem value="students">Most Students</MuiMenuItem>
                <MuiMenuItem value="exams">Most Exams</MuiMenuItem>
                <MuiMenuItem value="recent">Recently Added</MuiMenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>

        {/* Active Filter Chips */}
        {hasActiveFilters && (
          <Box sx={{display:'flex',flexWrap:'wrap',gap:1,mt:2,pt:2,borderTop:`1px solid ${tokens.surfaceBorder}`}}>
            <Typography variant="caption" sx={{color:tokens.textMuted,fontWeight:600,display:'flex',alignItems:'center'}}>Active:</Typography>
            {searchQuery && <Chip label={`Search: "${searchQuery}"`} size="small" onDelete={() => setSearchQuery('')} sx={{bgcolor:`${tokens.primary}10`,color:tokens.primary,fontWeight:600}}/>}
            {typeFilter && <Chip label={`Type: ${typeFilter}`} size="small" onDelete={() => setTypeFilter('')} sx={{bgcolor:`${tokens.accent}10`,color:tokens.accent,fontWeight:600}}/>}
            {planFilter && <Chip label={`Plan: ${planFilter}`} size="small" onDelete={() => setPlanFilter('')} sx={{bgcolor:`${PLAN_COLORS[planFilter]}15`,color:PLAN_COLORS[planFilter],fontWeight:600}}/>}
            {statusFilter && <Chip label={`Status: ${statusFilter}`} size="small" onDelete={() => setStatusFilter('')} sx={{bgcolor:'rgba(99,102,241,0.1)',color:'#6366F1',fontWeight:600}}/>}
            {sortBy !== 'name' && <Chip label={`Sort: ${sortBy}`} size="small" onDelete={() => setSortBy('name')} sx={{bgcolor:'rgba(245,158,11,0.1)',color:tokens.warning,fontWeight:600}}/>}
          </Box>
        )}
      </Paper>

      {loading?(
        <Box sx={{display:'flex',justifyContent:'center',mt:8}}>
          <CircularProgress sx={{color:tokens.accent}}/>
        </Box>
      ):(
        <>
          {(typeFilter === '' || typeFilter === 'organization') && renderOrgCards(organizations, `Organizations (Schools/Institutions) (${organizations.length})`, true)}
          {(typeFilter === '' || typeFilter === 'org_teacher') && renderOrgCards(orgTeachers, `Organization Teachers (${orgTeachers.length})`, false, true)}
          {(typeFilter === '' || typeFilter === 'individual') && renderOrgCards(individuals, `Individual Teachers (${individuals.length})`, false)}
        </>
      )}
      <Dialog open={Boolean(selected)} onClose={()=>setSelected(null)} maxWidth="xs" fullWidth PaperProps={{sx:{borderRadius:3}}}>
        <DialogTitle sx={{fontWeight:700,fontFamily:"'DM Sans',sans-serif",pb:1}}>
          Edit Subscription
          <Typography variant="caption" sx={{color:tokens.textMuted,display:'block',mt:0.5}}>{selected?.organization}</Typography>
        </DialogTitle>
        <DialogContent sx={{pt:'20px !important'}}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <FormControl fullWidth size="small">
                <InputLabel sx={{fontWeight:600}}>Subscription Plan</InputLabel>
                <Select label="Subscription Plan" value={plan} onChange={e=>setPlan(e.target.value)} sx={{borderRadius:2}}>
                  {['free','basic','premium','enterprise'].map(p=><MuiMenuItem key={p} value={p} sx={{textTransform:'capitalize'}}>{p}</MuiMenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth size="small">
                <InputLabel sx={{fontWeight:600}}>Status</InputLabel>
                <Select label="Status" value={status} onChange={e=>setStatus(e.target.value)} sx={{borderRadius:2}}>
                  {['active','pending','expired','cancelled'].map(s=><MuiMenuItem key={s} value={s} sx={{textTransform:'capitalize'}}>{s}</MuiMenuItem>)}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{px:3,pb:2.5}}>
          <Button onClick={()=>setSelected(null)} sx={{borderRadius:2,textTransform:'none',fontWeight:600}}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving} sx={{borderRadius:2,background:gradients.brand,textTransform:'none',fontWeight:700,px:3}}>
            {saving?'Saving…':'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Organization Confirmation Dialog */}
      <Dialog open={!!deleteDialog} onClose={()=>setDeleteDialog(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{fontWeight:700}}>
          Delete Organization
        </DialogTitle>
        <DialogContent>
          <Typography sx={{mb:2}}>Are you sure you want to <b>permanently delete</b> this organization?</Typography>
          <Box sx={{p:2,bgcolor:'#FEF2F2',borderRadius:2,border:'1px solid #FECACA',mb:2}}>
            <Typography variant="body2" fontWeight={600} sx={{color:'#7F1D1D'}}>⚠️ Warning: This action cannot be undone!</Typography>
            <Typography variant="body2" sx={{color:'#991B1B',mt:0.5}}>All teachers, students, exams, and results associated with this organization will be permanently removed.</Typography>
          </Box>
          {deleteDialog&&(
            <Box sx={{display:'flex',alignItems:'center',gap:2,p:2,bgcolor:'#F8FAFC',borderRadius:2}}>
              <Avatar sx={{width:40,height:40,bgcolor:tokens.primary,color:'white'}}>{deleteDialog.organization?.charAt(0)||deleteDialog.firstName?.charAt(0)}</Avatar>
              <Box>
                <Typography fontWeight={600}>{deleteDialog.organization||`${deleteDialog.firstName} ${deleteDialog.lastName}`}</Typography>
                <Typography variant="caption" sx={{color:tokens.textMuted}}>{deleteDialog.email} • {deleteDialog.role}</Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{px:3,pb:2}}>
          <Button onClick={()=>setDeleteDialog(null)} disabled={deleting} sx={{textTransform:'none'}}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleDeleteOrganization}
            disabled={deleting}
            sx={{
              textTransform:'none',
              bgcolor:'#EF4444',
              '&:hover':{bgcolor:'#DC2626'}
            }}
            startIcon={deleting?<CircularProgress size={16} sx={{color:'white'}}/>:<Delete/>}
          >
            {deleting?'Deleting...':'Delete Permanently'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Activity Dialog */}
      <Dialog open={!!activityDialog} onClose={()=>setActivityDialog(null)} maxWidth="md" fullWidth PaperProps={{sx:{borderRadius:3}}}>
        <DialogTitle sx={{fontWeight:700,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <Box>
            <Typography variant="h6">Activity Log</Typography>
            {activityDialog && <Typography variant="caption" sx={{color:tokens.textMuted,display:'block',mt:0.5}}>{activityDialog.organization||`${activityDialog.firstName} ${activityDialog.lastName}`}</Typography>}
          </Box>
          <IconButton onClick={()=>setActivityDialog(null)}><Close/></IconButton>
        </DialogTitle>
        <DialogContent>
          {/* Period Selector */}
          <Box sx={{display:'flex',gap:1,mb:3}}>
            {['7d','30d','90d','1y'].map(period=>(
              <Button
                key={period}
                size="small"
                variant={activityPeriod===period?'contained':'outlined'}
                onClick={()=>handleActivityPeriodChange(period)}
                sx={{textTransform:'none',borderRadius:2}}
              >
                {period==='7d'?'7 Days':period==='30d'?'30 Days':period==='90d'?'90 Days':'1 Year'}
              </Button>
            ))}
          </Box>

          {activityLoading?(
            <Box sx={{display:'flex',justifyContent:'center',py:8}}>
              <CircularProgress sx={{color:tokens.accent}}/>
            </Box>
          ):activityData?(
            <Box>
              {/* Activity Summary */}
              <Paper elevation={0} sx={{p:2,mb:3,borderRadius:2,bgcolor:'#F8FAFC'}}>
                <Typography variant="body2" fontWeight={600} sx={{mb:1.5,color:tokens.textMuted}}>Activity Summary ({activityData.totalActivities} activities)</Typography>
                <Grid container spacing={1}>
                  {Object.entries(activityData.summary).map(([action,count])=>(
                    <Grid item xs={6} md={4} key={action}>
                      <Box sx={{display:'flex',alignItems:'center',gap:0.75,p:1,bgcolor:'white',borderRadius:1.5,border:`1px solid ${tokens.surfaceBorder}`}}>
                        <Typography variant="caption" fontWeight={700} sx={{color:tokens.primary}}>{count}</Typography>
                        <Typography variant="caption" sx={{color:tokens.textMuted,textTransform:'capitalize'}}>{action.replace(/_/g,' ')}</Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </Paper>

              {/* Activity List */}
              <Typography variant="body2" fontWeight={600} sx={{mb:2,color:tokens.textMuted}}>Recent Activities</Typography>
              {activityData.activities.length===0?(
                <Paper elevation={0} sx={{p:4,borderRadius:2,border:`1px dashed ${tokens.surfaceBorder}`,bgcolor:'#FAFBFC',textAlign:'center'}}>
                  <Typography sx={{color:tokens.textMuted}}>No activities found in this period.</Typography>
                </Paper>
              ):(
                <Box sx={{maxHeight:400,overflowY:'auto'}}>
                  {activityData.activities.map((activity,index)=>(
                    <Box key={index} sx={{display:'flex',alignItems:'flex-start',gap:2,p:2,borderBottom:`1px solid ${tokens.surfaceBorder}`,'&:last-child':{borderBottom:'none'}}}>
                      <Avatar sx={{width:36,height:36,fontSize:14,bgcolor:`${tokens.primary}15`,color:tokens.primary}}>
                        {activity.user?.firstName?.charAt(0)||'?'}
                      </Avatar>
                      <Box sx={{flex:1}}>
                        <Typography variant="body2" fontWeight={600}>{activity.user?.firstName} {activity.user?.lastName}</Typography>
                        <Typography variant="caption" sx={{color:tokens.textMuted,display:'block'}}>{activity.action.replace(/_/g,' ').toUpperCase()}</Typography>
                        <Typography variant="caption" sx={{color:tokens.textMuted}}>{new Date(activity.timestamp).toLocaleString()}</Typography>
                      </Box>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          ):(
            <Paper elevation={0} sx={{p:4,borderRadius:2,border:`1px dashed ${tokens.surfaceBorder}`,bgcolor:'#FAFBFC',textAlign:'center'}}>
              <Typography sx={{color:tokens.textMuted}}>Failed to load activity data.</Typography>
            </Paper>
          )}
        </DialogContent>
        <DialogActions sx={{px:3,pb:2}}>
          <Button onClick={()=>setActivityDialog(null)} sx={{textTransform:'none'}}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

/* ── TEACHERS SECTION ── */
function TeachersSection({ searchQuery: initialSearchQuery }) {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery || '');
  const [activityDialog, setActivityDialog] = useState(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityData, setActivityData] = useState(null);
  const [activityPeriod, setActivityPeriod] = useState('30d');

  useEffect(() => {
    api.get('/superadmin/teachers').then(r => {
      setTeachers(r.data || []);
    }).catch(err => {
      console.error('Fetch teachers error:', err);
    }).finally(() => setLoading(false));
  }, []);

  const handleViewActivity = async (teacher) => {
    setActivityDialog(teacher);
    setActivityLoading(true);
    setActivityData(null);
    try {
      const response = await api.get(`/superadmin/teachers/${teacher._id}/activity?period=${activityPeriod}`);
      setActivityData(response.data);
    } catch (err) {
      console.error('Fetch activity error:', err);
    } finally {
      setActivityLoading(false);
    }
  };

  const handleActivityPeriodChange = (period) => {
    setActivityPeriod(period);
    if (activityDialog) {
      handleViewActivity(activityDialog);
    }
  };

  const filteredTeachers = teachers.filter(t => {
    const searchLower = searchQuery.toLowerCase();
    return !searchQuery ||
      (t.firstName?.toLowerCase().includes(searchLower)) ||
      (t.lastName?.toLowerCase().includes(searchLower)) ||
      (t.email?.toLowerCase().includes(searchLower)) ||
      (t.organization?.toLowerCase().includes(searchLower));
  });

  const StatBadge = ({ icon, value, label, color }) => (
    <Box sx={{display:'flex',alignItems:'center',gap:0.75,bgcolor:`${color}15`,px:1.5,py:0.5,borderRadius:2}}>
      {icon}
      <Typography variant="caption" fontWeight={700} sx={{color}}>{value}</Typography>
      <Typography variant="caption" sx={{color:tokens.textMuted,fontSize:'10px'}}>{label}</Typography>
    </Box>
  );

  return (
    <Box>
      <SectionTitle>Teachers</SectionTitle>

      {/* Filter Bar */}
      <Paper elevation={0} sx={{p:2,mb:3,borderRadius:3,border:`1px solid ${tokens.surfaceBorder}`,bgcolor:'white'}}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search teachers by name, email, organization..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: <Box component="span" sx={{color:tokens.textMuted,mr:1}}>🔍</Box>
          }}
          sx={{'& .MuiOutlinedInput-root':{borderRadius:2,bgcolor:'#FAFBFC'}}}
        />
      </Paper>

      {loading ? (
        <Box sx={{display:'flex',justifyContent:'center',py:8}}>
          <CircularProgress sx={{color:tokens.accent}}/>
        </Box>
      ) : filteredTeachers.length === 0 ? (
        <Paper elevation={0} sx={{p:8,borderRadius:3,border:`1px dashed ${tokens.surfaceBorder}`,bgcolor:'#FAFBFC',textAlign:'center'}}>
          <SupervisorAccount sx={{fontSize:48,color:tokens.textMuted,mb:2}}/>
          <Typography variant="h6" sx={{color:tokens.textMuted,mb:1}}>No teachers found</Typography>
          <Typography variant="body2" sx={{color:tokens.textMuted}}>
            {searchQuery ? 'No teachers match your search criteria' : 'There are no teachers in the system yet'}
          </Typography>
        </Paper>
      ) : (
        <Grid container spacing={2}>
          {filteredTeachers.map(teacher => (
            <Grid item xs={12} md={6} lg={4} key={teacher._id}>
              <Paper elevation={0} sx={{
                p:2.5,borderRadius:3,border:`1px solid ${tokens.surfaceBorder}`,bgcolor:'white',
                transition:'all 0.2s ease','&:hover':{boxShadow:'0 8px 30px rgba(13,64,108,0.12)',transform:'translateY(-2px)'}
              }}>
                {/* Header */}
                <Box sx={{display:'flex',alignItems:'flex-start',gap:1.5,mb:2}}>
                  <Avatar sx={{
                    width:44,height:44,fontSize:16,fontWeight:700,
                    background:`linear-gradient(135deg,${tokens.accent}20,${tokens.accent}40)`,
                    color:tokens.accent
                  }}>
                    {teacher.firstName?.charAt(0)}
                  </Avatar>
                  <Box sx={{flex:1,minWidth:0}}>
                    <Typography variant="body1" fontWeight={700} sx={{fontFamily:"'DM Sans',sans-serif",whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                      {teacher.firstName} {teacher.lastName}
                    </Typography>
                    <Typography variant="caption" sx={{color:tokens.textMuted,display:'block'}}>{teacher.email}</Typography>
                    {teacher.organization && (
                      <Typography variant="caption" sx={{color:tokens.textMuted,display:'block',mt:0.5}}>{teacher.organization}</Typography>
                    )}
                  </Box>
                </Box>

                {/* Stats */}
                <Box sx={{display:'flex',flexWrap:'wrap',gap:1,mb:2}}>
                  <StatBadge icon={<People sx={{fontSize:14,color:tokens.warning}}/>} value={teacher.stats?.studentCount??0} label="Students" color={tokens.warning}/>
                  <StatBadge icon={<School sx={{fontSize:14,color:'#6366F1'}}/>} value={teacher.stats?.examCount??0} label="Exams" color="#6366F1"/>
                  <StatBadge icon={<Assessment sx={{fontSize:14,color:tokens.primary}}/>} value={teacher.stats?.activityCount??0} label="Activities" color={tokens.primary}/>
                </Box>

                {/* Footer */}
                <Box sx={{display:'flex',alignItems:'center',justifyContent:'space-between',pt:1.5,borderTop:`1px solid ${tokens.surfaceBorder}`}}>
                  <Box sx={{display:'flex',alignItems:'center',gap:1}}>
                    <Chip label={teacher.isBlocked?'Blocked':'Active'} size="small" sx={{
                      height:22,fontSize:'11px',fontWeight:600,
                      bgcolor:teacher.isBlocked?'rgba(239,68,68,0.1)':'rgba(12,189,115,0.1)',
                      color:teacher.isBlocked?'#EF4444':tokens.accentDark
                    }}/>
                  </Box>
                  <Box sx={{display:'flex',gap:0.5}}>
                    <Tooltip title="View Activity">
                      <IconButton size="small" onClick={()=>handleViewActivity(teacher)} sx={{color:tokens.textSecondary,bgcolor:`${tokens.textSecondary}10`,'&:hover':{bgcolor:`${tokens.textSecondary}20`},width:32,height:32}}>
                        <Assessment fontSize="small"/>
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Activity Dialog */}
      <Dialog open={!!activityDialog} onClose={()=>setActivityDialog(null)} maxWidth="md" fullWidth PaperProps={{sx:{borderRadius:3}}}>
        <DialogTitle sx={{fontWeight:700,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <Box>
            <Typography variant="h6">Teacher Activity Log</Typography>
            {activityDialog && <Typography variant="caption" sx={{color:tokens.textMuted,display:'block',mt:0.5}}>{activityDialog.firstName} {activityDialog.lastName}</Typography>}
          </Box>
          <IconButton onClick={()=>setActivityDialog(null)}><Close/></IconButton>
        </DialogTitle>
        <DialogContent>
          {/* Period Selector */}
          <Box sx={{display:'flex',gap:1,mb:3}}>
            {['7d','30d','90d','1y'].map(period=>(
              <Button
                key={period}
                size="small"
                variant={activityPeriod===period?'contained':'outlined'}
                onClick={()=>handleActivityPeriodChange(period)}
                sx={{textTransform:'none',borderRadius:2}}
              >
                {period==='7d'?'7 Days':period==='30d'?'30 Days':period==='90d'?'90 Days':'1 Year'}
              </Button>
            ))}
          </Box>

          {activityLoading?(
            <Box sx={{display:'flex',justifyContent:'center',py:8}}>
              <CircularProgress sx={{color:tokens.accent}}/>
            </Box>
          ):activityData?(
            <Box>
              {/* Activity Summary */}
              <Paper elevation={0} sx={{p:2,mb:3,borderRadius:2,bgcolor:'#F8FAFC'}}>
                <Typography variant="body2" fontWeight={600} sx={{mb:1.5,color:tokens.textMuted}}>Activity Summary ({activityData.totalActivities} activities)</Typography>
                <Grid container spacing={1}>
                  {Object.entries(activityData.summary).map(([action,count])=>(
                    <Grid item xs={6} md={4} key={action}>
                      <Box sx={{display:'flex',alignItems:'center',gap:0.75,p:1,bgcolor:'white',borderRadius:1.5,border:`1px solid ${tokens.surfaceBorder}`}}>
                        <Typography variant="caption" fontWeight={700} sx={{color:tokens.primary}}>{count}</Typography>
                        <Typography variant="caption" sx={{color:tokens.textMuted,textTransform:'capitalize'}}>{action.replace(/_/g,' ')}</Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </Paper>

              {/* Activity List */}
              <Typography variant="body2" fontWeight={600} sx={{mb:2,color:tokens.textMuted}}>Recent Activities</Typography>
              {activityData.activities.length===0?(
                <Paper elevation={0} sx={{p:4,borderRadius:2,border:`1px dashed ${tokens.surfaceBorder}`,bgcolor:'#FAFBFC',textAlign:'center'}}>
                  <Typography sx={{color:tokens.textMuted}}>No activities found in this period.</Typography>
                </Paper>
              ):(
                <Box sx={{maxHeight:400,overflowY:'auto'}}>
                  {activityData.activities.map((activity,index)=>(
                    <Box key={index} sx={{display:'flex',alignItems:'flex-start',gap:2,p:2,borderBottom:`1px solid ${tokens.surfaceBorder}`,'&:last-child':{borderBottom:'none'}}}>
                      <Avatar sx={{width:36,height:36,fontSize:14,bgcolor:`${tokens.accent}15`,color:tokens.accent}}>
                        {activityData.teacher?.firstName?.charAt(0)||'?'}
                      </Avatar>
                      <Box sx={{flex:1}}>
                        <Typography variant="body2" fontWeight={600}>{activityData.teacher?.firstName} {activityData.teacher?.lastName}</Typography>
                        <Typography variant="caption" sx={{color:tokens.textMuted,display:'block'}}>{activity.action.replace(/_/g,' ').toUpperCase()}</Typography>
                        <Typography variant="caption" sx={{color:tokens.textMuted}}>{new Date(activity.timestamp).toLocaleString()}</Typography>
                      </Box>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          ):(
            <Paper elevation={0} sx={{p:4,borderRadius:2,border:`1px dashed ${tokens.surfaceBorder}`,bgcolor:'#FAFBFC',textAlign:'center'}}>
              <Typography sx={{color:tokens.textMuted}}>Failed to load activity data.</Typography>
            </Paper>
          )}
        </DialogContent>
        <DialogActions sx={{px:3,pb:2}}>
          <Button onClick={()=>setActivityDialog(null)} sx={{textTransform:'none'}}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function AllUsersSection() {
  const [users,setUsers]=useState([]);
  const [loading,setLoading]=useState(true);
  const [search,setSearch]=useState('');
  const [roleFilter,setRoleFilter]=useState('');
  const [selectedUser,setSelectedUser]=useState(null);
  const [viewUser,setViewUser]=useState(null);
  const [actionDialog,setActionDialog]=useState(null); // 'block', 'unblock', 'delete'
  const [processing,setProcessing]=useState(false);
  const [createDialog, setCreateDialog] = useState(false);
  const [newSuperAdmin, setNewSuperAdmin] = useState({ firstName: '', lastName: '', email: '', password: '', phone: '', organization: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [editUserDialog, setEditUserDialog] = useState(null);
  const [editUserData, setEditUserData] = useState({ firstName: '', lastName: '', email: '', phone: '', organization: '', password: '', currentPassword: '' });
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [snack, setSnack] = useState({ open: false, msg: '', severity: 'success' });

  const fetchUsers=()=>{
    setLoading(true);
    const params = roleFilter ? `?role=${roleFilter}` : '';
    api.get(`/superadmin/users${params}`).then(r=>setUsers(r.data?.users||[])).finally(()=>setLoading(false));
  };

  useEffect(()=>{
    fetchUsers();
  },[roleFilter]);

  const handleBlock=async()=>{
    if(!selectedUser)return;
    setProcessing(true);
    try{
      await api.put(`/superadmin/users/${selectedUser._id}/toggle-block`);
      setUsers(p=>p.map(u=>u._id===selectedUser._id?{...u,isBlocked:!u.isBlocked}:u));
      setActionDialog(null);
      setSelectedUser(null);
    }catch(err){
      console.error('Block error:',err);
    }finally{
      setProcessing(false);
    }
  };

  const handleDelete=async()=>{
    if(!selectedUser)return;
    setProcessing(true);
    try{
      await api.delete(`/superadmin/users/${selectedUser._id}`);
      setUsers(p=>p.filter(u=>u._id!==selectedUser._id));
      setActionDialog(null);
      setSelectedUser(null);
    }catch(err){
      console.error('Delete error:',err);
    }finally{
      setProcessing(false);
    }
  };

  const openDialog=(user,action)=>{
    setSelectedUser(user);
    setActionDialog(action);
  };

  const handleCreateSuperAdmin = async () => {
    if (!newSuperAdmin.firstName || !newSuperAdmin.lastName || !newSuperAdmin.email || !newSuperAdmin.password) {
      setSnack({ open: true, msg: 'All fields are required', severity: 'error' });
      return;
    }
    setProcessing(true);
    try {
      await api.post('/superadmin/create-superadmin', newSuperAdmin);
      setSnack({ open: true, msg: 'Super admin created successfully', severity: 'success' });
      setCreateDialog(false);
      setNewSuperAdmin({ firstName: '', lastName: '', email: '', password: '', phone: '', organization: '' });
      fetchUsers();
    } catch (err) {
      setSnack({ open: true, msg: err.response?.data?.message || 'Failed to create super admin', severity: 'error' });
    } finally {
      setProcessing(false);
    }
  };

  const handleEditUser = (user) => {
    setEditUserDialog(user);
    setEditUserData({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone || '',
      organization: user.organization || '',
      password: '',
      currentPassword: ''
    });
  };

  const handleSaveUserEdit = async () => {
    if (!editUserData.firstName || !editUserData.lastName || !editUserData.email) {
      setSnack({ open: true, msg: 'First name, last name, and email are required', severity: 'error' });
      return;
    }
    setProcessing(true);
    try {
      const payload = {
        firstName: editUserData.firstName,
        lastName: editUserData.lastName,
        email: editUserData.email,
        phone: editUserData.phone,
        organization: editUserData.organization
      };
      
      // Only include password if it's not empty
      if (editUserData.password) {
        payload.password = editUserData.password;
      }
      
      // Include current password if email is changing for super admin
      if (editUserData.email !== editUserDialog.email && editUserDialog.role === 'superadmin') {
        payload.currentPassword = editUserData.currentPassword;
      }
      
      await api.put(`/superadmin/users/${editUserDialog._id}`, payload);
      setSnack({ open: true, msg: 'User updated successfully', severity: 'success' });
      setEditUserDialog(null);
      setEditUserData({ firstName: '', lastName: '', email: '', phone: '', organization: '', password: '', currentPassword: '' });
      fetchUsers();
    } catch (err) {
      setSnack({ open: true, msg: err.response?.data?.message || 'Failed to update user', severity: 'error' });
    } finally {
      setProcessing(false);
    }
  };

  const filtered=users.filter(u=>`${u.firstName} ${u.lastName} ${u.email} ${u.organization||''}`.toLowerCase().includes(search.toLowerCase()));

  return(
    <Box>
      <SectionTitle action={
        <Box sx={{display:'flex',gap:1}}>
          <Button
            variant="contained"
            startIcon={<Add fontSize="small"/>}
            onClick={() => setCreateDialog(true)}
            sx={{borderRadius:2,fontWeight:700,background:gradients.brand,textTransform:'none',px:2}}
          >
            Add Super Admin
          </Button>
          <FormControl size="small" sx={{width:120}}>
            <InputLabel>Filter Role</InputLabel>
            <Select label="Filter Role" value={roleFilter} onChange={e=>setRoleFilter(e.target.value)} sx={{borderRadius:2}}>
              <MuiMenuItem value="">All</MuiMenuItem>
              <MuiMenuItem value="superadmin">Super Admin</MuiMenuItem>
              <MuiMenuItem value="admin">Admin</MuiMenuItem>
              <MuiMenuItem value="teacher">Teacher</MuiMenuItem>
              <MuiMenuItem value="student">Student</MuiMenuItem>
            </Select>
          </FormControl>
          <TextField size="small" placeholder="Search…" value={search} onChange={e=>setSearch(e.target.value)} sx={{'& .MuiOutlinedInput-root':{borderRadius:2},width:220}}/></Box>}>
        All Users
      </SectionTitle>
      {loading?<Box sx={{display:'flex',justifyContent:'center',mt:6}}><CircularProgress sx={{color:tokens.accent}}/></Box>:(
        <Paper elevation={0} sx={{borderRadius:3,border:`1px solid ${tokens.surfaceBorder}`,bgcolor:'white',overflow:'hidden'}}>
          <TableContainer><Table>
            <TableHead><TableRow sx={{bgcolor:'#F8FAFC'}}>{['User','Role','Type/Org','Plan','Status','Actions'].map(h=><TableCell key={h} sx={{fontWeight:700,color:tokens.textSecondary,fontSize:12}}>{h}</TableCell>)}</TableRow></TableHead>
            <TableBody>
              {filtered.length===0?<TableRow><TableCell colSpan={6} align="center" sx={{py:5,color:tokens.textMuted}}>No users found.</TableCell></TableRow>:
              filtered.map(u=>{
                const rc={superadmin:'#8B5CF6',admin:tokens.primary,teacher:tokens.accent,student:tokens.warning}[u.role]||'#64748B';
                const typeLabel = u.userType === 'organization' ? (u.organization||'Organization') : (u.userType==='individual'?'Individual':'—');
                return(
                <TableRow key={u._id} sx={{'&:hover':{bgcolor:'#F8FAFC'}}}>
                  <TableCell><Box sx={{display:'flex',alignItems:'center',gap:1.5}}><Avatar sx={{width:32,height:32,bgcolor:`${rc}1A`,color:rc,fontSize:13,fontWeight:700}}>{u.firstName?.charAt(0)}</Avatar><Box><Typography variant="body2" fontWeight={600}>{u.firstName} {u.lastName}</Typography><Typography variant="caption" sx={{color:tokens.textMuted}}>{u.email}</Typography>{u.phone&&<Typography variant="caption" sx={{color:tokens.textMuted,display:'block'}}>📞 {u.phone}</Typography>}</Box></Box></TableCell>
                  <TableCell><Chip label={u.role} size="small" sx={{bgcolor:`${rc}14`,color:rc,fontWeight:600}}/></TableCell>
                  <TableCell><Typography variant="body2" sx={{color:tokens.textMuted}}>{typeLabel}</Typography></TableCell>
                  <TableCell>
                    <Chip label={u.subscriptionPlan||'free'} size="small" sx={{bgcolor:`${PLAN_COLORS[u.subscriptionPlan]||PLAN_COLORS.free}14`,color:PLAN_COLORS[u.subscriptionPlan]||PLAN_COLORS.free,fontWeight:600}}/>
                    <Chip label={u.subscriptionStatus||'—'} size="small" sx={{ml:0.5,bgcolor:u.subscriptionStatus==='active'?'rgba(12,189,115,0.1)':u.subscriptionStatus==='pending'?'rgba(245,158,11,0.1)':'rgba(100,116,139,0.1)',color:u.subscriptionStatus==='active'?tokens.accentDark:u.subscriptionStatus==='pending'?'#B45309':'#64748B',fontWeight:600}}/>
                  </TableCell>
                  <TableCell><Chip label={u.isBlocked?'Blocked':u.subscriptionStatus==='pending'?'Pending':'Active'} size="small" sx={{bgcolor:u.isBlocked?'rgba(239,68,68,0.08)':u.subscriptionStatus==='pending'?'rgba(245,158,11,0.1)':'rgba(12,189,115,0.1)',color:u.isBlocked?'#EF4444':u.subscriptionStatus==='pending'?'#B45309':tokens.accentDark,fontWeight:600}}/></TableCell>
                  <TableCell>
                    <Box sx={{display:'flex',gap:0.5}}>
                      <Tooltip title="Edit User">
                        <IconButton size="small" onClick={()=>handleEditUser(u)} sx={{color:tokens.primary,bgcolor:`${tokens.primary}10`,'&:hover':{bgcolor:`${tokens.primary}20`}}}>
                          <Edit fontSize="small"/>
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="View Details">
                        <IconButton size="small" onClick={()=>setViewUser(u)} sx={{color:tokens.primary,bgcolor:`${tokens.primary}10`,'&:hover':{bgcolor:`${tokens.primary}20`}}}>
                          <InfoOutlined fontSize="small"/>
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={u.isBlocked?"Unblock User":"Block User"}>
                        <IconButton size="small" onClick={()=>openDialog(u,u.isBlocked?'unblock':'block')} sx={{color:u.isBlocked?tokens.accent:'#F59E0B'}}>
                          {u.isBlocked?<CheckCircle fontSize="small"/>:<Block fontSize="small"/>}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete User">
                        <IconButton size="small" onClick={()=>openDialog(u,'delete')} sx={{color:'#EF4444'}}>
                          <Delete fontSize="small"/>
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>);})}
            </TableBody>
          </Table></TableContainer>
        </Paper>
      )}

      {/* User Detail Dialog */}
      <Dialog open={!!viewUser} onClose={()=>setViewUser(null)} maxWidth="sm" fullWidth PaperProps={{sx:{borderRadius:3}}}>
        <DialogTitle sx={{fontWeight:700,fontFamily:"'DM Sans',sans-serif",pb:1}}>
          👤 User Details
          <IconButton size="small" onClick={()=>setViewUser(null)} sx={{position:'absolute',right:16,top:16,color:tokens.textMuted}}><Close fontSize="small"/></IconButton>
        </DialogTitle>
        <DialogContent sx={{pt:'8px !important'}}>
          {viewUser&&(
            <Box>
              <Box sx={{display:'flex',alignItems:'center',gap:2,p:2,bgcolor:'#F8FAFC',borderRadius:2,mb:2}}>
                <Avatar sx={{width:52,height:52,bgcolor:`${tokens.primary}15`,color:tokens.primary,fontWeight:700,fontSize:20}}>{viewUser.firstName?.charAt(0)}{viewUser.lastName?.charAt(0)}</Avatar>
                <Box>
                  <Typography fontWeight={700} fontSize={16}>{viewUser.firstName} {viewUser.lastName}</Typography>
                  <Typography variant="body2" sx={{color:tokens.textMuted}}>{viewUser.email}</Typography>
                  <Chip label={viewUser.role} size="small" sx={{mt:0.5,bgcolor:`${{'superadmin':'#8B5CF6',admin:tokens.primary,teacher:tokens.accent,student:tokens.warning}[viewUser.role]||'#64748B'}14`,color:{'superadmin':'#8B5CF6',admin:tokens.primary,teacher:tokens.accent,student:tokens.warning}[viewUser.role]||'#64748B',fontWeight:600}}/>
                </Box>
              </Box>
              <Box sx={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:1.5}}>
                {[{label:'Phone',value:viewUser.phone||'—',icon:'📞'},{label:'Organization',value:viewUser.organization||'—',icon:'🏢'},{label:'Account Type',value:viewUser.userType||'—',icon:'👤'},{label:'Subscription Plan',value:viewUser.subscriptionPlan||'free',icon:'💳'},{label:'Subscription Status',value:viewUser.subscriptionStatus||'—',icon:'✅'},{label:'Blocked',value:viewUser.isBlocked?'Yes':'No',icon:'🚫'},{label:'Registered',value:viewUser.createdAt?new Date(viewUser.createdAt).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}):'—',icon:'📅'},{label:'Last Login',value:viewUser.lastLogin?new Date(viewUser.lastLogin).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}):'—',icon:'🕐'}].map(({label,value,icon})=>(
                  <Box key={label} sx={{p:1.5,bgcolor:'#F8FAFC',borderRadius:2,border:'1px solid #E5E7EB'}}>
                    <Typography variant="caption" sx={{color:tokens.textMuted,display:'block',mb:0.25}}>{icon} {label}</Typography>
                    <Typography variant="body2" fontWeight={600} sx={{wordBreak:'break-all'}}>{value}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{px:3,pb:2.5}}>
          <Button onClick={()=>setViewUser(null)} sx={{borderRadius:2,textTransform:'none',fontWeight:600}}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Action Confirmation Dialog */}
      <Dialog open={!!actionDialog} onClose={()=>setActionDialog(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{fontWeight:700}}>
          {actionDialog==='delete'?'Delete User':actionDialog==='block'?'Block User':'Unblock User'}
        </DialogTitle>
        <DialogContent>
          {actionDialog==='delete'?(
            <>
              <Typography sx={{mb:2}}>Are you sure you want to <b>permanently delete</b> this user?</Typography>
              <Box sx={{p:2,bgcolor:'#FEF2F2',borderRadius:2,border:'1px solid #FECACA',mb:2}}>
                <Typography variant="body2" fontWeight={600} sx={{color:'#7F1D1D'}}>⚠️ Warning: This action cannot be undone!</Typography>
                <Typography variant="body2" sx={{color:'#991B1B',mt:0.5}}>All user data, exams, and results will be permanently removed.</Typography>
              </Box>
            </>
          ):actionDialog==='block'?(
            <>
              <Typography sx={{mb:2}}>Are you sure you want to <b>block</b> this user?</Typography>
              <Box sx={{p:2,bgcolor:'#FFFBEB',borderRadius:2,border:'1px solid #FCD34D',mb:2}}>
                <Typography variant="body2" sx={{color:'#92400E'}}>The user will be temporarily prevented from accessing the platform. You can unblock them anytime.</Typography>
              </Box>
            </>
          ):actionDialog==='unblock'?(
            <>
              <Typography sx={{mb:2}}>Are you sure you want to <b>unblock</b> this user?</Typography>
              <Box sx={{p:2,bgcolor:'#F0FDF4',borderRadius:2,border:'1px solid #86EFAC',mb:2}}>
                <Typography variant="body2" sx={{color:'#166534'}}>The user will regain access to the platform immediately.</Typography>
              </Box>
            </>
          ):null}
          {selectedUser&&(
            <Box sx={{display:'flex',alignItems:'center',gap:2,p:2,bgcolor:'#F8FAFC',borderRadius:2}}>
              <Avatar sx={{width:40,height:40,bgcolor:tokens.primary,color:'white'}}>{selectedUser.firstName?.charAt(0)}</Avatar>
              <Box>
                <Typography fontWeight={600}>{selectedUser.firstName} {selectedUser.lastName}</Typography>
                <Typography variant="caption" sx={{color:tokens.textMuted}}>{selectedUser.email} • {selectedUser.role}</Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{px:3,pb:2}}>
          <Button onClick={()=>setActionDialog(null)} disabled={processing} sx={{textTransform:'none'}}>Cancel</Button>
          <Button
            variant="contained"
            onClick={actionDialog==='delete'?handleDelete:handleBlock}
            disabled={processing}
            sx={{
              textTransform:'none',
              bgcolor:actionDialog==='delete'?'#EF4444':actionDialog==='block'?'#F59E0B':tokens.accent,
              '&:hover':{bgcolor:actionDialog==='delete'?'#DC2626':actionDialog==='block'?'#D97706':'#059669'}
            }}
            startIcon={processing?<CircularProgress size={16} sx={{color:'white'}}/>:actionDialog==='delete'?<Delete/>:actionDialog==='block'?<Block/>:<CheckCircle/>}
          >
            {processing?'Processing...':actionDialog==='delete'?'Delete Permanently':actionDialog==='block'?'Block User':'Unblock User'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Super Admin Dialog */}
      <Dialog open={createDialog} onClose={() => setCreateDialog(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700, fontFamily: "'DM Sans', sans-serif", pb: 1 }}>
          Add New Super Admin
          <IconButton size="small" onClick={() => setCreateDialog(false)} sx={{ position: 'absolute', right: 16, top: 16, color: tokens.textMuted }}><Close fontSize="small" /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: '8px !important' }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="First Name"
                size="small"
                value={newSuperAdmin.firstName}
                onChange={e => setNewSuperAdmin({ ...newSuperAdmin, firstName: e.target.value })}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Last Name"
                size="small"
                value={newSuperAdmin.lastName}
                onChange={e => setNewSuperAdmin({ ...newSuperAdmin, lastName: e.target.value })}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Email"
                size="small"
                type="email"
                value={newSuperAdmin.email}
                onChange={e => setNewSuperAdmin({ ...newSuperAdmin, email: e.target.value })}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Password"
                size="small"
                type={showPassword ? 'text' : 'password'}
                value={newSuperAdmin.password}
                onChange={e => setNewSuperAdmin({ ...newSuperAdmin, password: e.target.value })}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setShowPassword(!showPassword)} edge="end">
                        {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  )
                }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Phone (Optional)"
                size="small"
                value={newSuperAdmin.phone}
                onChange={e => setNewSuperAdmin({ ...newSuperAdmin, phone: e.target.value })}
                placeholder="+250 7XX XXX XXX"
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Organization (Optional)"
                size="small"
                value={newSuperAdmin.organization}
                onChange={e => setNewSuperAdmin({ ...newSuperAdmin, organization: e.target.value })}
                placeholder="TestFy Rwanda"
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setCreateDialog(false)} disabled={processing} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreateSuperAdmin}
            disabled={processing}
            sx={{ borderRadius: 2, background: gradients.brand, textTransform: 'none', fontWeight: 700, px: 3 }}
            startIcon={processing ? <CircularProgress size={16} sx={{ color: 'white' }} /> : <Add fontSize="small" />}
          >
            {processing ? 'Creating...' : 'Create Super Admin'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={!!editUserDialog} onClose={() => setEditUserDialog(null)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700, fontFamily: "'DM Sans', sans-serif", pb: 1 }}>
          Edit User
          <IconButton size="small" onClick={() => setEditUserDialog(null)} sx={{ position: 'absolute', right: 16, top: 16, color: tokens.textMuted }}><Close fontSize="small" /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: '8px !important' }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="First Name"
                size="small"
                value={editUserData.firstName}
                onChange={e => setEditUserData({ ...editUserData, firstName: e.target.value })}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Last Name"
                size="small"
                value={editUserData.lastName}
                onChange={e => setEditUserData({ ...editUserData, lastName: e.target.value })}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Email"
                size="small"
                type="email"
                value={editUserData.email}
                onChange={e => setEditUserData({ ...editUserData, email: e.target.value })}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />
            </Grid>
            {editUserDialog?.role === 'superadmin' && editUserData.email !== editUserDialog.email && (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Current Password (required to change email)"
                  size="small"
                  type="password"
                  value={editUserData.currentPassword}
                  onChange={e => setEditUserData({ ...editUserData, currentPassword: e.target.value })}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />
              </Grid>
            )}
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="New Password (leave blank to keep current)"
                size="small"
                type={showEditPassword ? 'text' : 'password'}
                value={editUserData.password}
                onChange={e => setEditUserData({ ...editUserData, password: e.target.value })}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setShowEditPassword(!showEditPassword)} edge="end">
                        {showEditPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  )
                }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Phone"
                size="small"
                value={editUserData.phone}
                onChange={e => setEditUserData({ ...editUserData, phone: e.target.value })}
                placeholder="+250 7XX XXX XXX"
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Organization"
                size="small"
                value={editUserData.organization}
                onChange={e => setEditUserData({ ...editUserData, organization: e.target.value })}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setEditUserDialog(null)} disabled={processing} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSaveUserEdit}
            disabled={processing}
            sx={{ borderRadius: 2, background: gradients.brand, textTransform: 'none', fontWeight: 700, px: 3 }}
            startIcon={processing ? <CircularProgress size={16} sx={{ color: 'white' }} /> : <Edit fontSize="small" />}
          >
            {processing ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snack.open} autoHideDuration={3500} onClose={() => setSnack(s => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snack.severity} onClose={() => setSnack(s => ({ ...s, open: false }))} sx={{ borderRadius: 2 }}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  );
}

function SubscriptionsSection({ stats }) {
  const [activeTab, setActiveTab] = useState('pending_users'); // 'plans', 'all', 'pending_users', 'expired'
  const [requests, setRequests] = useState([]);
  const [allSubs, setAllSubs] = useState([]);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [expiredUsers, setExpiredUsers] = useState([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [approvalNote, setApprovalNote] = useState('');
  const [processing, setProcessing] = useState(false);
  const [actionUser, setActionUser] = useState(null); // {user, action: 'approve'|'reject'|'delete'|'renew'}
  const [renewPlan, setRenewPlan] = useState('basic'); // For renewing expired subscriptions
  const [subFilter, setSubFilter] = useState({ plan: '', status: '', expiring: '' }); // Filters for subscriptions

  const plans=[
    {name:'Free',price:'0 RWF/mo',key:'free',features:['5 exams/month','Basic AI','5 students max','1 teacher']},
    {name:'Basic',price:'100,000 RWF/mo',key:'basic',features:['30 exams/month','Full AI','200 students','Analytics']},
    {name:'Premium',price:'200,000 RWF/mo (Individual) / 300,000 RWF/mo (Org)',key:'premium',features:['Unlimited exams','Advanced AI','Unlimited students','Priority support']},
  ];

  // Super Admin Contact Info
  const CONTACT_INFO = {
    phone1: '+250781671517',
    phone2: '+250793828834',
    phone3: '0788535156',
    momoCode: '81671517',
    whatsapp: '+250781671517'
  };

  useEffect(() => {
    if (activeTab === 'all') {
      fetchAllSubscriptions();
    } else if (activeTab === 'pending_users') {
      fetchPendingUsers();
    } else if (activeTab === 'expired') {
      fetchExpiredUsers();
    }
  }, [activeTab]);

  const fetchPendingUsers = async () => {
    setPendingLoading(true);
    try {
      const res = await api.get('/superadmin/users?subscriptionStatus=pending&limit=200');
      setPendingUsers(res.data?.users || []);
    } catch (err) {
      console.error('Failed to fetch pending users:', err);
    } finally {
      setPendingLoading(false);
    }
  };

  const fetchExpiredUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/superadmin/users?subscriptionStatus=expired&limit=200');
      setExpiredUsers(res.data?.users || []);
    } catch (err) {
      console.error('Failed to fetch expired users:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveUser = async () => {
    if (!actionUser) return;
    setProcessing(true);
    try {
      const planToUse = actionUser.user.subscriptionPlan || 'free';
      const expiresAt = planToUse === 'enterprise' ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await api.put(`/superadmin/users/${actionUser.user._id}`, { 
        subscriptionStatus: 'active', 
        subscriptionExpiresAt: expiresAt,
        subscriptionStartDate: new Date()
      });
      setPendingUsers(prev => prev.filter(u => u._id !== actionUser.user._id));
      setActionUser(null);
    } catch (err) {
      console.error('Approve failed:', err);
      if (err.response?.data?.message) {
        alert(err.response.data.message);
      }
    }
    finally { setProcessing(false); }
  };

  const handleRejectUser = async () => {
    if (!actionUser) return;
    setProcessing(true);
    try {
      await api.put(`/superadmin/users/${actionUser.user._id}`, { subscriptionStatus: 'rejected', isBlocked: true });
      setPendingUsers(prev => prev.filter(u => u._id !== actionUser.user._id));
      setActionUser(null);
    } catch (err) { console.error('Reject failed:', err); }
    finally { setProcessing(false); }
  };

  const handleRenewUser = async () => {
    if (!actionUser) return;
    setProcessing(true);
    try {
      const planToUse = renewPlan;
      const expiresAt = planToUse === 'enterprise' ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await api.put(`/superadmin/users/${actionUser.user._id}`, { subscriptionStatus: 'active', subscriptionPlan: planToUse, subscriptionExpiresAt: expiresAt });
      setExpiredUsers(prev => prev.filter(u => u._id !== actionUser.user._id));
      setActionUser(null);
      setRenewPlan('basic'); // Reset to default
    } catch (err) {
      console.error('Renew failed:', err);
      if (err.response?.data?.message) {
        alert(err.response.data.message);
      }
    }
    finally { setProcessing(false); }
  };

  const handleDeleteUser = async () => {
    if (!actionUser) return;
    setProcessing(true);
    try {
      await api.delete(`/superadmin/users/${actionUser.user._id}`);
      setPendingUsers(prev => prev.filter(u => u._id !== actionUser.user._id));
      setExpiredUsers(prev => prev.filter(u => u._id !== actionUser.user._id));
      setActionUser(null);
    } catch (err) { console.error('Delete failed:', err); }
    finally { setProcessing(false); }
  };

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await api.get('/superadmin/subscription-requests?status=pending');
      setRequests(res.data?.requests || []);
    } catch (err) {
      console.error('Failed to fetch requests:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllSubscriptions = async () => {
    setLoading(true);
    try {
      const res = await api.get('/superadmin/subscriptions');
      setAllSubs(res.data?.subscriptions || []);
    } catch (err) {
      console.error('Failed to fetch subscriptions:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filter subscriptions based on filters
  const filteredSubs = allSubs.filter(sub => {
    if (subFilter.plan && sub.plan !== subFilter.plan) return false;
    if (subFilter.status && sub.status !== subFilter.status) return false;
    if (subFilter.expiring) {
      const now = new Date();
      const endDate = sub.endDate ? new Date(sub.endDate) : null;
      if (!endDate) return false;
      const daysRemaining = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
      if (subFilter.expiring === '7days' && daysRemaining > 7) return false;
      if (subFilter.expiring === '30days' && daysRemaining > 30) return false;
      if (subFilter.expiring === 'expired' && daysRemaining > 0) return false;
    }
    return true;
  });

  const handleApprove = async (requestId) => {
    setProcessing(true);
    try {
      await api.put(`/superadmin/subscription-requests/${requestId}/approve`, { note: approvalNote });
      setRequests(prev => prev.filter(r => r._id !== requestId));
      setSelectedRequest(null);
      setApprovalNote('');
    } catch (err) {
      console.error('Failed to approve:', err);
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (requestId) => {
    setProcessing(true);
    try {
      await api.put(`/superadmin/subscription-requests/${requestId}/reject`, { note: approvalNote });
      setRequests(prev => prev.filter(r => r._id !== requestId));
      setSelectedRequest(null);
      setApprovalNote('');
    } catch (err) {
      console.error('Failed to reject:', err);
    } finally {
      setProcessing(false);
    }
  };

  const pendingCount = requests.length;
  const pendingUsersCount = pendingUsers.length;
  const expiredUsersCount = expiredUsers.length;

  return(
    <Box>
      {/* Tabs */}
      <Box sx={{display:'flex',gap:1,mb:3}}>
        {[
          {id:'pending_users',label:'Pending Approvals',icon:'🕐',badge:pendingUsersCount},
          {id:'expired',label:'Expired Subscriptions',icon:'⚠️',badge:expiredUsersCount},
          {id:'plans',label:'Plans Overview',icon:'📊'},
          {id:'all',label:'All Subscriptions',icon:'📋'},
        ].map(tab => (
          <Button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            sx={{
              px:3,py:1.5,borderRadius:2,fontWeight:700,textTransform:'none',fontFamily:"'DM Sans',sans-serif",
              bgcolor:activeTab===tab.id?tokens.primary:'white',
              color:activeTab===tab.id?'white':tokens.textPrimary,
              border:`1px solid ${activeTab===tab.id?tokens.primary:tokens.surfaceBorder}`,
              boxShadow:activeTab===tab.id?'0 4px 14px rgba(13,64,108,0.25)':'none',
              '&:hover':{bgcolor:activeTab===tab.id?tokens.primary:'#F8FAFC'}
            }}
          >
            {tab.icon} {tab.label}
            {tab.badge > 0 && (
              <Chip label={tab.badge} size="small" sx={{ml:1,height:20,fontSize:'11px',fontWeight:700,bgcolor:'#EF4444',color:'white'}}/>
            )}
          </Button>
        ))}
      </Box>

      {/* PLANS TAB */}
      {activeTab === 'plans' && (
        <>
          <Paper elevation={0} sx={{p:3,mb:3,borderRadius:3,border:`1px solid ${tokens.surfaceBorder}`,bgcolor:'white'}}>
            <Typography variant="h6" fontWeight={700} sx={{mb:2,fontFamily:"'DM Sans',sans-serif"}}>
              💳 Payment Instructions for Users
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Paper sx={{p:2.5,bgcolor:'#F0FDF4',borderRadius:2,border:'1px solid #86EFAC'}}>
                  <Typography variant="subtitle2" fontWeight={700} sx={{color:'#166534',mb:1.5}}>📱 Mobile Money (MoMo)</Typography>
                  <Box sx={{display:'flex',flexDirection:'column',gap:1}}>
                    <Box sx={{display:'flex',justifyContent:'space-between'}}>
                      <Typography variant="body2" sx={{color:tokens.textMuted}}>MoMo Number:</Typography>
                      <Typography variant="body2" fontWeight={700} sx={{color:'#166534',fontFamily:'monospace'}}>+250 781 671 517</Typography>
                    </Box>
                    <Box sx={{display:'flex',justifyContent:'space-between'}}>
                      <Typography variant="body2" sx={{color:tokens.textMuted}}>MoMo Code:</Typography>
                      <Typography variant="body2" fontWeight={700} sx={{color:'#166534',fontFamily:'monospace'}}>{CONTACT_INFO.momoCode}</Typography>
                    </Box>
                    <Box sx={{display:'flex',justifyContent:'space-between'}}>
                      <Typography variant="body2" sx={{color:tokens.textMuted}}>Account Name:</Typography>
                      <Typography variant="body2" fontWeight={700} sx={{color:'#166534'}}>Excellence Coaching Hub ECH LTD</Typography>
                    </Box>
                  </Box>
                </Paper>
              </Grid>
              <Grid item xs={12} md={6}>
                <Paper sx={{p:2.5,bgcolor:'#EFF6FF',borderRadius:2,border:'1px solid #93C5FD'}}>
                  <Typography variant="subtitle2" fontWeight={700} sx={{color:tokens.primary,mb:1.5}}>🏦 Bank Transfer (BK)</Typography>
                  <Box sx={{display:'flex',flexDirection:'column',gap:1}}>
                    <Box sx={{display:'flex',justifyContent:'space-between'}}>
                      <Typography variant="body2" sx={{color:tokens.textMuted}}>Account No:</Typography>
                      <Typography variant="body2" fontWeight={700} sx={{color:tokens.primary,fontFamily:'monospace'}}>1002 1358 4477</Typography>
                    </Box>
                    <Box sx={{display:'flex',justifyContent:'space-between'}}>
                      <Typography variant="body2" sx={{color:tokens.textMuted}}>Bank:</Typography>
                      <Typography variant="body2" fontWeight={700} sx={{color:tokens.primary}}>Bank of Kigali</Typography>
                    </Box>
                    <Box sx={{display:'flex',justifyContent:'space-between'}}>
                      <Typography variant="body2" sx={{color:tokens.textMuted}}>Account Name:</Typography>
                      <Typography variant="body2" fontWeight={700} sx={{color:tokens.primary}}>Excellence Coaching Hub ECH LTD</Typography>
                    </Box>
                  </Box>
                </Paper>
              </Grid>
              <Grid item xs={12} md={6}>
                <Paper sx={{p:2.5,bgcolor:'#EFF6FF',borderRadius:2,border:'1px solid #93C5FD'}}>
                  <Typography variant="subtitle2" fontWeight={700} sx={{color:tokens.primary,mb:1.5}}>📞 Contact Super Admin</Typography>
                  <Box sx={{display:'flex',flexDirection:'column',gap:0.75}}>
                    <Typography variant="body2" sx={{color:tokens.textMuted}}>For subscription inquiries:</Typography>
                    <Typography variant="body2" fontWeight={600}>{CONTACT_INFO.phone1}</Typography>
                    <Typography variant="body2" fontWeight={600}>{CONTACT_INFO.phone2}</Typography>
                    <Typography variant="body2" fontWeight={600}>{CONTACT_INFO.phone3}</Typography>
                  </Box>
                </Paper>
              </Grid>
            </Grid>
          </Paper>

          <SectionTitle>Subscription Plans</SectionTitle>
          <Grid container spacing={2}>
            {plans.map((p,i)=>{const color=PLAN_COLORS[p.key];const count=stats?.planBreakdown?.[p.key]??0;return(
              <Grid item xs={12} sm={6} md={3} key={i}>
                <Paper elevation={0} sx={{p:2.5,borderRadius:3,height:'100%',border:`1.5px solid ${color}28`,background:`linear-gradient(135deg,${color}06 0%,transparent 100%)`,transition:'box-shadow 0.2s','&:hover':{boxShadow:'0 6px 24px rgba(0,0,0,0.08)'}}}>
                  <Box sx={{display:'flex',alignItems:'center',gap:1,mb:1.5}}>
                    <Box sx={{width:38,height:38,borderRadius:2,bgcolor:`${color}14`,color,display:'flex',alignItems:'center',justifyContent:'center'}}><AttachMoney fontSize="small"/></Box>
                    <Box><Typography variant="subtitle1" fontWeight={700} sx={{fontFamily:"'DM Sans',sans-serif"}}>{p.name}</Typography><Typography variant="body2" fontWeight={700} sx={{color}}>{p.price}</Typography></Box>
                  </Box>
                  <Chip label={`${count} accounts`} size="small" sx={{mb:1.5,bgcolor:`${color}14`,color,fontWeight:600}}/>
                  {p.features.map((f,fi)=>(
                    <Box key={fi} sx={{display:'flex',alignItems:'center',gap:1,mb:0.75}}>
                      <CheckCircle sx={{fontSize:13,color}}/>
                      <Typography variant="caption" sx={{color:tokens.textSecondary,fontFamily:"'DM Sans',sans-serif"}}>{f}</Typography>
                    </Box>
                  ))}
                </Paper>
              </Grid>
            );})}
          </Grid>
        </>
      )}

      {/* PENDING USERS TAB */}
      {activeTab === 'pending_users' && (
        <Box>
          <SectionTitle action={
            <Button onClick={fetchPendingUsers} size="small" sx={{color:tokens.accent,textTransform:'none',fontWeight:600}}>🔄 Refresh</Button>
          }>Accounts Awaiting Approval ({pendingUsersCount})</SectionTitle>

          {pendingLoading ? (
            <Box sx={{display:'flex',justifyContent:'center',mt:6}}><CircularProgress sx={{color:tokens.accent}}/></Box>
          ) : pendingUsers.length === 0 ? (
            <Paper elevation={0} sx={{p:4,borderRadius:3,border:`1px dashed ${tokens.surfaceBorder}`,bgcolor:'#FAFBFC',textAlign:'center'}}>
              <Typography variant="h6" sx={{color:tokens.textMuted,mb:1}}>No pending accounts</Typography>
              <Typography variant="body2" sx={{color:tokens.textMuted}}>All registered users have been reviewed.</Typography>
            </Paper>
          ) : (
            <Grid container spacing={2}>
              {pendingUsers.map(u => (
                <Grid item xs={12} md={6} key={u._id}>
                  <Paper elevation={0} sx={{p:2.5,borderRadius:3,border:`2px solid rgba(245,158,11,0.3)`,bgcolor:'white','&:hover':{boxShadow:'0 4px 20px rgba(0,0,0,0.08)'}}}>
                    <Box sx={{display:'flex',alignItems:'center',gap:1.5,mb:2}}>
                      <Avatar sx={{width:44,height:44,bgcolor:`${tokens.primary}15`,color:tokens.primary,fontWeight:700,fontSize:16}}>
                        {u.firstName?.charAt(0)}{u.lastName?.charAt(0)}
                      </Avatar>
                      <Box sx={{flex:1,minWidth:0}}>
                        <Typography variant="body1" fontWeight={700} noWrap>{u.firstName} {u.lastName}</Typography>
                        <Typography variant="caption" sx={{color:tokens.textMuted}} noWrap>{u.email}</Typography>
                      </Box>
                      <Box sx={{display:'flex',flexDirection:'column',gap:0.5,alignItems:'flex-end'}}>
                        <Chip label="Pending" size="small" sx={{bgcolor:'rgba(245,158,11,0.1)',color:'#B45309',fontWeight:700,fontSize:11}}/>
                        {u.subscriptionPlan === 'free' && u.subscriptionStatus === 'expired' && (
                          <Chip label="⚠️ Upgrade Required" size="small" sx={{bgcolor:'rgba(220,38,38,0.1)',color:'#DC2626',fontWeight:700,fontSize:10}}/>
                        )}
                      </Box>
                    </Box>

                    <Box sx={{display:'flex',flexWrap:'wrap',gap:1,mb:2}}>
                      <Chip label={u.subscriptionPlan||'free'} size="small" sx={{bgcolor:`${PLAN_COLORS[u.subscriptionPlan]||PLAN_COLORS.free}15`,color:PLAN_COLORS[u.subscriptionPlan]||PLAN_COLORS.free,fontWeight:600,textTransform:'capitalize'}}/>
                      <Chip label={u.userType||'individual'} size="small" sx={{bgcolor:'#F3F4F6',color:tokens.textSecondary,fontWeight:600,textTransform:'capitalize'}}/>
                      <Chip label={u.role||'—'} size="small" sx={{bgcolor:'#EFF6FF',color:tokens.primary,fontWeight:600}}/>
                      {u.organization && <Chip label={u.organization} size="small" sx={{bgcolor:'#F5F3FF',color:'#7C3AED',fontWeight:600}}/>}
                    </Box>

                    <Box sx={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:1,mb:2}}>
                      {[
                        {icon:'📞', label:'Phone',    value: u.phone || '—'},
                        {icon:'📧', label:'Email',    value: u.email},
                        {icon:'📅', label:'Registered', value: u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : '—'},
                        {icon:'🕐', label:'Last Login', value: u.lastLogin ? new Date(u.lastLogin).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : 'Never'},
                      ].map(({icon,label,value})=>(
                        <Box key={label} sx={{p:1,bgcolor:'#F8FAFC',borderRadius:1.5,border:'1px solid #E5E7EB'}}>
                          <Typography variant="caption" sx={{color:tokens.textMuted,display:'block'}}>{icon} {label}</Typography>
                          <Typography variant="caption" fontWeight={600} sx={{wordBreak:'break-all'}}>{value}</Typography>
                        </Box>
                      ))}
                    </Box>

                    <Box sx={{display:'flex',gap:1,pt:1.5,borderTop:`1px solid ${tokens.surfaceBorder}`}}>
                      <Button size="small" variant="outlined"
                        onClick={() => setActionUser({user:u, action:'delete'})}
                        sx={{borderRadius:2,textTransform:'none',fontWeight:600,fontSize:12,px:1.5,borderColor:'#EF4444',color:'#EF4444','&:hover':{bgcolor:'rgba(239,68,68,0.05)'}}}
                      >Delete</Button>
                      <Button size="small" variant="outlined"
                        onClick={() => setActionUser({user:u, action:'reject'})}
                        sx={{flex:1,borderRadius:2,textTransform:'none',fontWeight:600,fontSize:12,borderColor:'#F59E0B',color:'#B45309','&:hover':{bgcolor:'rgba(245,158,11,0.05)'}}}
                      >Reject</Button>
                      <Button size="small" variant="contained"
                        onClick={() => setActionUser({user:u, action:'approve'})}
                        sx={{flex:1,borderRadius:2,textTransform:'none',fontWeight:700,fontSize:12,bgcolor:tokens.accent,'&:hover':{bgcolor:'#0AAE5E'}}}
                      >✓ Approve</Button>
                    </Box>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          )}

      {/* EXPIRED SUBSCRIPTIONS TAB */}
      {activeTab === 'expired' && (
        <Box>
          <SectionTitle action={
            <Button onClick={fetchExpiredUsers} size="small" sx={{color:tokens.accent,textTransform:'none',fontWeight:600}}>🔄 Refresh</Button>
          }>Expired Subscriptions ({expiredUsersCount})</SectionTitle>

          {loading ? (
            <Box sx={{display:'flex',justifyContent:'center',mt:6}}><CircularProgress sx={{color:tokens.accent}}/></Box>
          ) : expiredUsers.length === 0 ? (
            <Paper elevation={0} sx={{p:4,borderRadius:3,border:`1px dashed ${tokens.surfaceBorder}`,bgcolor:'#FAFBFC',textAlign:'center'}}>
              <Typography variant="h6" sx={{color:tokens.textMuted,mb:1}}>No expired subscriptions</Typography>
              <Typography variant="body2" sx={{color:tokens.textMuted}}>All active subscriptions are current.</Typography>
            </Paper>
          ) : (
            <Grid container spacing={2}>
              {expiredUsers.map(u => (
                <Grid item xs={12} md={6} key={u._id}>
                  <Paper elevation={0} sx={{p:2.5,borderRadius:3,border:`2px solid rgba(239,68,68,0.3)`,bgcolor:'white','&:hover':{boxShadow:'0 4px 20px rgba(0,0,0,0.08)'}}}>
                    <Box sx={{display:'flex',alignItems:'center',gap:1.5,mb:2}}>
                      <Avatar sx={{width:44,height:44,bgcolor:`${tokens.primary}15`,color:tokens.primary,fontWeight:700,fontSize:16}}>
                        {u.firstName?.charAt(0)}{u.lastName?.charAt(0)}
                      </Avatar>
                      <Box sx={{flex:1,minWidth:0}}>
                        <Typography variant="body1" fontWeight={700} noWrap>{u.firstName} {u.lastName}</Typography>
                        <Typography variant="caption" sx={{color:tokens.textMuted}} noWrap>{u.email}</Typography>
                      </Box>
                      <Chip label="Expired" size="small" sx={{bgcolor:'rgba(239,68,68,0.1)',color:'#DC2626',fontWeight:700,fontSize:11}}/>
                    </Box>

                    <Box sx={{display:'flex',flexWrap:'wrap',gap:1,mb:2}}>
                      <Chip label={u.subscriptionPlan||'free'} size="small" sx={{bgcolor:`${PLAN_COLORS[u.subscriptionPlan]||PLAN_COLORS.free}15`,color:PLAN_COLORS[u.subscriptionPlan]||PLAN_COLORS.free,fontWeight:600,textTransform:'capitalize'}}/>
                      <Chip label={u.userType||'individual'} size="small" sx={{bgcolor:'#F3F4F6',color:tokens.textSecondary,fontWeight:600,textTransform:'capitalize'}}/>
                      <Chip label={u.role||'—'} size="small" sx={{bgcolor:'#EFF6FF',color:tokens.primary,fontWeight:600}}/>
                      {u.organization && <Chip label={u.organization} size="small" sx={{bgcolor:'#F5F3FF',color:'#7C3AED',fontWeight:600}}/>}
                    </Box>

                    <Box sx={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:1,mb:2}}>
                      {[
                        {icon:'📞', label:'Phone',    value: u.phone || '—'},
                        {icon:'📧', label:'Email',    value: u.email},
                        {icon:'📅', label:'Registered', value: u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : '—'},
                        {icon:'⏰', label:'Expired On', value: u.subscriptionExpiresAt ? new Date(u.subscriptionExpiresAt).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : '—'},
                      ].map(({icon,label,value})=>(
                        <Box key={label} sx={{p:1,bgcolor:'#F8FAFC',borderRadius:1.5,border:'1px solid #E5E7EB'}}>
                          <Typography variant="caption" sx={{color:tokens.textMuted,display:'block'}}>{icon} {label}</Typography>
                          <Typography variant="caption" fontWeight={600} sx={{wordBreak:'break-all'}}>{value}</Typography>
                        </Box>
                      ))}
                    </Box>

                    <Box sx={{display:'flex',gap:1,pt:1.5,borderTop:`1px solid ${tokens.surfaceBorder}`}}>
                      <Button size="small" variant="outlined"
                        onClick={() => { setActionUser({user:u, action:'renew'}); setRenewPlan(u.subscriptionPlan === 'free' ? 'basic' : u.subscriptionPlan); }}
                        sx={{flex:1,borderRadius:2,textTransform:'none',fontWeight:600,fontSize:12,borderColor:tokens.accent,color:tokens.accent,'&:hover':{bgcolor:'rgba(12,189,115,0.05)'}}}
                      >🔄 Renew</Button>
                      <Button size="small" variant="outlined"
                        onClick={() => setActionUser({user:u, action:'delete'})}
                        sx={{borderRadius:2,textTransform:'none',fontWeight:600,fontSize:12,px:1.5,borderColor:'#EF4444',color:'#EF4444','&:hover':{bgcolor:'rgba(239,68,68,0.05)'}}}
                      >Delete</Button>
                    </Box>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      )}

          {/* Action confirmation dialog */}
          <Dialog open={Boolean(actionUser)} onClose={() => setActionUser(null)} maxWidth="sm" fullWidth PaperProps={{sx:{borderRadius:3}}}>
            <DialogTitle sx={{fontWeight:700,fontFamily:"'DM Sans',sans-serif",pb:1}}>
              {actionUser?.action === 'approve' && '✅ Approve Account'}
              {actionUser?.action === 'reject'  && '❌ Reject Account'}
              {actionUser?.action === 'delete'  && '🗑️ Delete Account'}
              {actionUser?.action === 'renew'   && '🔄 Renew Subscription'}
              <Typography variant="caption" sx={{color:tokens.textMuted,display:'block',mt:0.5}}>
                {actionUser?.user?.firstName} {actionUser?.user?.lastName} — {actionUser?.user?.subscriptionPlan} plan
              </Typography>
            </DialogTitle>
            <DialogContent sx={{pt:'16px !important'}}>
              {actionUser?.action === 'approve' && (
                <Box>
                  <Box sx={{p:2,bgcolor:'#F0FDF4',borderRadius:2,border:'1px solid #86EFAC',mb:2}}>
                    <Typography variant="body2" sx={{color:'#166534'}}>This will set the account to <b>active</b> and grant the user access to their dashboard.</Typography>
                  </Box>
                  {actionUser?.user?.subscriptionPlan === 'free' && actionUser?.user?.subscriptionStatus === 'expired' && (
                    <Box sx={{p:2,bgcolor:'#FEF2F2',borderRadius:2,border:'1px solid #FECACA'}}>
                      <Typography variant="body2" sx={{color:'#991B1B'}}>⚠️ This user was on a free plan that expired. They must upgrade to a paid plan (Basic, Premium, or Enterprise) to renew. Please change their plan before approving.</Typography>
                    </Box>
                  )}
                </Box>
              )}
              {actionUser?.action === 'reject' && (
                <Box sx={{p:2,bgcolor:'#FFF7ED',borderRadius:2,border:'1px solid #FED7AA'}}>
                  <Typography variant="body2" sx={{color:'#92400E'}}>This will mark the account as <b>rejected</b> and block login. The user data is kept.</Typography>
                </Box>
              )}
              {actionUser?.action === 'delete' && (
                <Box sx={{p:2,bgcolor:'#FEF2F2',borderRadius:2,border:'1px solid #FECACA'}}>
                  <Typography variant="body2" sx={{color:'#991B1B'}}>This will <b>permanently delete</b> the user account and all associated data. This cannot be undone.</Typography>
                </Box>
              )}
              {actionUser?.action === 'renew' && (
                <Box>
                  <Box sx={{p:2,bgcolor:'#F0FDF4',borderRadius:2,border:'1px solid #86EFAC',mb:2}}>
                    <Typography variant="body2" sx={{color:'#166534',mb:1}}>This will renew the subscription and extend it by 30 days. Enterprise plans do not expire.</Typography>
                    {actionUser?.user?.subscriptionPlan === 'free' && (
                      <Typography variant="caption" sx={{color:'#DC2626',fontWeight:600,display:'block',mt:1}}>⚠️ Free plan users must upgrade to a paid plan after expiration.</Typography>
                    )}
                  </Box>
                  
                  <Typography variant="subtitle2" fontWeight={700} sx={{mb:1}}>Select Plan:</Typography>
                  <Box sx={{display:'flex',flexDirection:'column',gap:1}}>
                    {['basic','premium','enterprise'].map(plan => (
                      <Paper 
                        key={plan}
                        onClick={() => setRenewPlan(plan)}
                        sx={{
                          p:2,
                          borderRadius:2,
                          border: `2px solid ${renewPlan === plan ? tokens.accent : '#E5E7EB'}`,
                          bgcolor: renewPlan === plan ? '#F0FDF4' : 'white',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          '&:hover': { bgcolor: '#F8FAFC' }
                        }}
                      >
                        <Box sx={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                          <Box>
                            <Typography variant="body2" fontWeight={700} sx={{textTransform:'capitalize'}}>{plan}</Typography>
                            <Typography variant="caption" sx={{color:tokens.textMuted}}>
                              {plan === 'basic' && '100,000 RWF/mo'}
                              {plan === 'premium' && '200,000 RWF/mo'}
                              {plan === 'enterprise' && 'Perpetual access'}
                            </Typography>
                          </Box>
                          {renewPlan === plan && <CheckCircle sx={{color:tokens.accent,fontSize:20}} />}
                        </Box>
                      </Paper>
                    ))}
                  </Box>
                </Box>
              )}
            </DialogContent>
            <DialogActions sx={{px:3,pb:2.5,gap:1}}>
              <Button onClick={() => setActionUser(null)} sx={{borderRadius:2,textTransform:'none',fontWeight:600}}>Cancel</Button>
              <Button variant="contained" disabled={processing}
                onClick={actionUser?.action === 'approve' ? handleApproveUser : actionUser?.action === 'reject' ? handleRejectUser : actionUser?.action === 'renew' ? handleRenewUser : handleDeleteUser}
                sx={{
                  borderRadius:2,textTransform:'none',fontWeight:700,px:3,
                  bgcolor: actionUser?.action === 'approve' ? tokens.accent : actionUser?.action === 'reject' ? '#F59E0B' : actionUser?.action === 'renew' ? tokens.accent : '#EF4444',
                  '&:hover':{ bgcolor: actionUser?.action === 'approve' ? '#0AAE5E' : actionUser?.action === 'reject' ? '#D97706' : actionUser?.action === 'renew' ? '#0AAE5E' : '#DC2626' }
                }}
              >
                {processing ? 'Processing...' : `Confirm ${actionUser?.action === 'approve' ? 'Approval' : actionUser?.action === 'reject' ? 'Rejection' : actionUser?.action === 'renew' ? 'Renewal' : 'Delete'}`}
              </Button>
            </DialogActions>
          </Dialog>
        </Box>
      )}

      {/* REQUESTS TAB */}
      {activeTab === 'requests' && (
        <Box>
          <SectionTitle action={
            <Button onClick={fetchRequests} size="small" sx={{color:tokens.accent,textTransform:'none',fontWeight:600}}>
              🔄 Refresh
            </Button>
          }>Pending Subscription Requests ({pendingCount})</SectionTitle>
          
          {loading ? (
            <Box sx={{display:'flex',justifyContent:'center',mt:6}}><CircularProgress sx={{color:tokens.accent}}/></Box>
          ) : requests.length === 0 ? (
            <Paper elevation={0} sx={{p:4,borderRadius:3,border:`1px dashed ${tokens.surfaceBorder}`,bgcolor:'#FAFBFC',textAlign:'center'}}>
              <Typography variant="h6" sx={{color:tokens.textMuted,mb:1}}>No pending requests</Typography>
              <Typography variant="body2" sx={{color:tokens.textMuted}}>All subscription requests have been processed.</Typography>
            </Paper>
          ) : (
            <Grid container spacing={2}>
              {requests.map(req => (
                <Grid item xs={12} md={6} key={req._id}>
                  <Paper elevation={0} sx={{p:2.5,borderRadius:3,border:`1px solid ${tokens.surfaceBorder}`,bgcolor:'white','&:hover':{boxShadow:'0 4px 20px rgba(0,0,0,0.08)'}}}>
                    <Box sx={{display:'flex',alignItems:'center',gap:1.5,mb:2}}>
                      <Avatar sx={{width:44,height:44,bgcolor:`${tokens.primary}15`,color:tokens.primary,fontWeight:700}}>
                        {req.user?.firstName?.charAt(0)}
                      </Avatar>
                      <Box sx={{flex:1}}>
                        <Typography variant="body1" fontWeight={700}>{req.user?.firstName} {req.user?.lastName}</Typography>
                        <Typography variant="caption" sx={{color:tokens.textMuted}}>{req.user?.email}</Typography>
                      </Box>
                      <Chip 
                        label={`${req.requestedPlan} - ${req.paymentMethod === 'momo' ? 'MoMo' : 'Bank'}`} 
                        size="small"
                        sx={{bgcolor:`${PLAN_COLORS[req.requestedPlan]}15`,color:PLAN_COLORS[req.requestedPlan],fontWeight:600}}
                      />
                    </Box>

                    <Box sx={{display:'flex',flexWrap:'wrap',gap:1,mb:2}}>
                      <Box sx={{px:1.5,py:0.5,bgcolor:'#F3F4F6',borderRadius:1.5}}>
                        <Typography variant="caption" sx={{color:tokens.textMuted}}>Phone: <b>{req.phoneNumber}</b></Typography>
                      </Box>
                      <Box sx={{px:1.5,py:0.5,bgcolor:'#F3F4F6',borderRadius:1.5}}>
                        <Typography variant="caption" sx={{color:tokens.textMuted}}>Amount: <b>{req.amountPaid} RWF</b></Typography>
                      </Box>
                      <Box sx={{px:1.5,py:0.5,bgcolor:'#F3F4F6',borderRadius:1.5}}>
                        <Typography variant="caption" sx={{color:tokens.textMuted}}>TxID: <b>{req.transactionId?.slice(0,8)}...</b></Typography>
                      </Box>
                    </Box>

                    {req.notes && (
                      <Typography variant="body2" sx={{color:tokens.textMuted,mb:2,fontStyle:'italic'}}>
                        "{req.notes}"
                      </Typography>
                    )}

                    <Box sx={{display:'flex',gap:1,pt:1.5,borderTop:`1px solid ${tokens.surfaceBorder}`}}>
                      <Button 
                        variant="outlined" 
                        onClick={() => setSelectedRequest(req)}
                        sx={{flex:1,borderRadius:2,textTransform:'none',fontWeight:600,borderColor:'#EF4444',color:'#EF4444','&:hover':{bgcolor:'rgba(239,68,68,0.05)',borderColor:'#EF4444'}}}
                      >
                        Reject
                      </Button>
                      <Button 
                        variant="contained" 
                        onClick={() => setSelectedRequest({...req, action: 'approve' })}
                        sx={{flex:1,borderRadius:2,textTransform:'none',fontWeight:700,bgcolor:tokens.accent,'&:hover':{bgcolor:'#0AAE5E'}}}
                      >
                        Approve & Activate
                      </Button>
                    </Box>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      )}

      {/* Approval/Reject Dialog */}
      <Dialog open={Boolean(selectedRequest)} onClose={() => {setSelectedRequest(null);setApprovalNote('');}} maxWidth="sm" fullWidth PaperProps={{sx:{borderRadius:3}}}>
        <DialogTitle sx={{fontWeight:700,fontFamily:"'DM Sans',sans-serif",pb:1}}>
          {selectedRequest?.action === 'approve' ? '✅ Approve Subscription' : '❌ Reject Subscription Request'}
          <Typography variant="caption" sx={{color:tokens.textMuted,display:'block',mt:0.5}}>
            {selectedRequest?.user?.firstName} {selectedRequest?.user?.lastName} - {selectedRequest?.requestedPlan} Plan
          </Typography>
        </DialogTitle>
        <DialogContent sx={{pt:'20px !important'}}>
          {selectedRequest?.action === 'approve' && (
            <Box sx={{mb:2,p:2,bgcolor:'#F0FDF4',borderRadius:2,border:'1px solid #86EFAC'}}>
              <Typography variant="body2" sx={{color:'#166534',fontWeight:600}}>
                User has paid: {selectedRequest?.amountPaid} RWF via {selectedRequest?.paymentMethod === 'momo' ? 'MTN MoMo' : 'Bank Transfer'}
              </Typography>
              <Typography variant="caption" sx={{color:'#166534'}}>
                Transaction ID: {selectedRequest?.transactionId}
              </Typography>
            </Box>
          )}
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Note (optional)"
            placeholder={selectedRequest?.action === 'approve' ? "Add activation note or confirmation..." : "Reason for rejection..."}
            value={approvalNote}
            onChange={(e) => setApprovalNote(e.target.value)}
            sx={{'& .MuiOutlinedInput-root':{borderRadius:2}}}
          />
        </DialogContent>
        <DialogActions sx={{px:3,pb:2.5}}>
          <Button onClick={() => {setSelectedRequest(null);setApprovalNote('');}} sx={{borderRadius:2,textTransform:'none',fontWeight:600}}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={() => selectedRequest?.action === 'approve' ? handleApprove(selectedRequest._id) : handleReject(selectedRequest._id)}
            disabled={processing}
            sx={{
              borderRadius:2,textTransform:'none',fontWeight:700,px:3,
              bgcolor:selectedRequest?.action === 'approve' ? tokens.accent : '#EF4444',
              '&:hover':{bgcolor:selectedRequest?.action === 'approve' ? '#0AAE5E' : '#DC2626'}
            }}
          >
            {processing ? 'Processing...' : (selectedRequest?.action === 'approve' ? 'Confirm Approval' : 'Confirm Rejection')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ALL SUBSCRIPTIONS TAB */}
      {activeTab === 'all' && (
        <Box>
          <SectionTitle>All Active Subscriptions</SectionTitle>
          
          {/* Filters */}
          <Paper elevation={0} sx={{p:2,mb:2,borderRadius:2,border:`1px solid ${tokens.surfaceBorder}`,bgcolor:'white'}}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Plan</InputLabel>
                  <Select label="Plan" value={subFilter.plan} onChange={(e) => setSubFilter({...subFilter, plan: e.target.value})} sx={{borderRadius:2}}>
                    <MuiMenuItem value="">All Plans</MuiMenuItem>
                    <MuiMenuItem value="free">Free</MuiMenuItem>
                    <MuiMenuItem value="basic">Basic</MuiMenuItem>
                    <MuiMenuItem value="premium">Premium</MuiMenuItem>
                    <MuiMenuItem value="enterprise">Enterprise</MuiMenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Status</InputLabel>
                  <Select label="Status" value={subFilter.status} onChange={(e) => setSubFilter({...subFilter, status: e.target.value})} sx={{borderRadius:2}}>
                    <MuiMenuItem value="">All Status</MuiMenuItem>
                    <MuiMenuItem value="active">Active</MuiMenuItem>
                    <MuiMenuItem value="pending">Pending</MuiMenuItem>
                    <MuiMenuItem value="expired">Expired</MuiMenuItem>
                    <MuiMenuItem value="cancelled">Cancelled</MuiMenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Expiration</InputLabel>
                  <Select label="Expiration" value={subFilter.expiring} onChange={(e) => setSubFilter({...subFilter, expiring: e.target.value})} sx={{borderRadius:2}}>
                    <MuiMenuItem value="">All</MuiMenuItem>
                    <MuiMenuItem value="7days">Expiring in 7 days</MuiMenuItem>
                    <MuiMenuItem value="30days">Expiring in 30 days</MuiMenuItem>
                    <MuiMenuItem value="expired">Expired</MuiMenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={3}>
                <Button size="small" onClick={() => setSubFilter({ plan: '', status: '', expiring: '' })} sx={{borderRadius:2}}>Clear Filters</Button>
              </Grid>
            </Grid>
          </Paper>

          {loading ? (
            <Box sx={{display:'flex',justifyContent:'center',mt:6}}><CircularProgress sx={{color:tokens.accent}}/></Box>
          ) : (
            <Paper elevation={0} sx={{borderRadius:3,border:`1px solid ${tokens.surfaceBorder}`,bgcolor:'white',overflow:'hidden'}}>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow sx={{bgcolor:'#F8FAFC'}}>
                      <TableCell sx={{fontWeight:700,color:tokens.textSecondary,fontSize:12}}>User/Organization</TableCell>
                      <TableCell sx={{fontWeight:700,color:tokens.textSecondary,fontSize:12}}>Type</TableCell>
                      <TableCell sx={{fontWeight:700,color:tokens.textSecondary,fontSize:12}}>Plan</TableCell>
                      <TableCell sx={{fontWeight:700,color:tokens.textSecondary,fontSize:12}}>Status</TableCell>
                      <TableCell sx={{fontWeight:700,color:tokens.textSecondary,fontSize:12}}>Started</TableCell>
                      <TableCell sx={{fontWeight:700,color:tokens.textSecondary,fontSize:12}}>Expires</TableCell>
                      <TableCell sx={{fontWeight:700,color:tokens.textSecondary,fontSize:12}}>Days Remaining</TableCell>
                      <TableCell sx={{fontWeight:700,color:tokens.textSecondary,fontSize:12}}>Last Payment</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredSubs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} align="center" sx={{py:5,color:tokens.textMuted}}>No subscriptions found matching your filters.</TableCell>
                      </TableRow>
                    ) : (
                      filteredSubs.map(sub => {
                        const now = new Date();
                        const endDate = sub.endDate ? new Date(sub.endDate) : null;
                        const daysRemaining = endDate ? Math.ceil((endDate - now) / (1000 * 60 * 60 * 24)) : null;
                        const isExpiringSoon = daysRemaining !== null && daysRemaining <= 7 && daysRemaining > 0;
                        const isExpired = daysRemaining !== null && daysRemaining <= 0;
                        const isEnterprise = sub.plan === 'enterprise';
                        
                        return (
                          <TableRow key={sub._id} sx={{'&:hover':{bgcolor:'#F8FAFC'}}}>
                            <TableCell>
                              <Box sx={{display:'flex',alignItems:'center',gap:1.5}}>
                                <Avatar sx={{width:32,height:32,bgcolor:`${tokens.primary}15`,color:tokens.primary,fontSize:12,fontWeight:700}}>
                                  {sub.user?.firstName?.charAt(0)}
                                </Avatar>
                                <Box>
                                  <Typography variant="body2" fontWeight={600}>{sub.user?.firstName} {sub.user?.lastName}</Typography>
                                  <Typography variant="caption" sx={{color:tokens.textMuted}}>{sub.user?.organization || sub.user?.email}</Typography>
                                </Box>
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Chip 
                                label={sub.userType || 'Individual'} 
                                size="small"
                                sx={{bgcolor:'#F3F4F6',color:tokens.textSecondary,fontWeight:600,textTransform:'capitalize'}}
                              />
                            </TableCell>
                            <TableCell>
                              <Box sx={{display:'flex',alignItems:'center',gap:1}}>
                                <Chip 
                                  label={sub.plan} 
                                  size="small"
                                  sx={{bgcolor:`${PLAN_COLORS[sub.plan]}15`,color:PLAN_COLORS[sub.plan],fontWeight:600,textTransform:'capitalize'}}
                                />
                                {isEnterprise && <Typography variant="caption" sx={{color:tokens.accent,fontWeight:600}}>∞</Typography>}
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Chip 
                                label={sub.status} 
                                size="small"
                                sx={{
                                  bgcolor:sub.status==='active'?'rgba(12,189,115,0.1)':sub.status==='expired'?'rgba(239,68,68,0.1)':'rgba(245,158,11,0.1)',
                                  color:sub.status==='active'?tokens.accentDark:sub.status==='expired'?'#DC2626':tokens.warning,
                                  fontWeight:600
                                }}
                              />
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" sx={{color:tokens.textMuted}}>
                                {sub.startDate ? new Date(sub.startDate).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : '—'}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" sx={{color:tokens.textMuted}}>
                                {endDate ? new Date(endDate).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : '—'}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Box sx={{display:'flex',alignItems:'center',gap:1}}>
                                {isEnterprise ? (
                                  <Typography variant="body2" sx={{color:tokens.accent,fontWeight:600}}>Never</Typography>
                                ) : isExpired ? (
                                  <Chip label="Expired" size="small" sx={{bgcolor:'rgba(239,68,68,0.1)',color:'#DC2626',fontWeight:600}}/>
                                ) : daysRemaining !== null ? (
                                  <Chip 
                                    label={`${daysRemaining}d`} 
                                    size="small"
                                    sx={{
                                      bgcolor:isExpiringSoon?'rgba(245,158,11,0.1)':'rgba(12,189,115,0.1)',
                                      color:isExpiringSoon?'#B45309':tokens.accentDark,
                                      fontWeight:600
                                    }}
                                  />
                                ) : (
                                  <Typography variant="body2" sx={{color:tokens.textMuted}}>—</Typography>
                                )}
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" sx={{color:tokens.textMuted}}>
                                {sub.lastPaymentDate ? new Date(sub.lastPaymentDate).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : '—'}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}
        </Box>
      )}
    </Box>
  );
}

function AnalyticsSection({ stats }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [period, setPeriod] = useState('30d');
  const [loading, setLoading] = useState(false);
  const [studentAnalytics, setStudentAnalytics] = useState(null);
  const [teacherAnalytics, setTeacherAnalytics] = useState(null);
  const [orgAnalytics, setOrgAnalytics] = useState(null);
  const [trendsAnalytics, setTrendsAnalytics] = useState(null);
  const [examAnalytics, setExamAnalytics] = useState(null);
  const [marketplaceAnalytics, setMarketplaceAnalytics] = useState(null);

  const tabs = [
    { id: 'overview', label: 'Overview', icon: <TrendingUp sx={{fontSize:18}}/> },
    { id: 'students', label: 'Students', icon: <People sx={{fontSize:18}}/> },
    { id: 'teachers', label: 'Teachers', icon: <SupervisorAccount sx={{fontSize:18}}/> },
    { id: 'organizations', label: 'Organizations', icon: <Business sx={{fontSize:18}}/> },
    { id: 'trends', label: 'Trends', icon: <TrendingUp sx={{fontSize:18}}/> },
    { id: 'exams', label: 'Exams', icon: <School sx={{fontSize:18}}/> },
    { id: 'marketplace', label: 'Marketplace', icon: <AttachMoney sx={{fontSize:18}}/> },
  ];

  const periods = [
    { value: '7d', label: '7 Days' },
    { value: '30d', label: '30 Days' },
    { value: '90d', label: '90 Days' },
    { value: '1y', label: '1 Year' },
  ];

  useEffect(() => {
    if (activeTab === 'students') fetchStudentAnalytics();
    else if (activeTab === 'teachers') fetchTeacherAnalytics();
    else if (activeTab === 'organizations') fetchOrgAnalytics();
    else if (activeTab === 'trends') fetchTrendsAnalytics();
    else if (activeTab === 'exams') fetchExamAnalytics();
    else if (activeTab === 'marketplace') fetchMarketplaceAnalytics();
  }, [activeTab, period]);

  const fetchStudentAnalytics = async () => {
    setLoading(true);
    try {
      const res = await api.get('/superadmin/analytics/students', { params: { period } });
      setStudentAnalytics(res.data);
    } catch (err) {
      console.error('Failed to fetch student analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTeacherAnalytics = async () => {
    setLoading(true);
    try {
      const res = await api.get('/superadmin/analytics/teachers', { params: { period } });
      setTeacherAnalytics(res.data);
    } catch (err) {
      console.error('Failed to fetch teacher analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrgAnalytics = async () => {
    setLoading(true);
    try {
      const res = await api.get('/superadmin/analytics/organizations', { params: { period } });
      setOrgAnalytics(res.data);
    } catch (err) {
      console.error('Failed to fetch org analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTrendsAnalytics = async () => {
    setLoading(true);
    try {
      const res = await api.get('/superadmin/analytics/trends', { params: { period } });
      setTrendsAnalytics(res.data);
    } catch (err) {
      console.error('Failed to fetch trends analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchExamAnalytics = async () => {
    setLoading(true);
    try {
      const res = await api.get('/superadmin/analytics/exams', { params: { period } });
      setExamAnalytics(res.data);
    } catch (err) {
      console.error('Failed to fetch exam analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMarketplaceAnalytics = async () => {
    setLoading(true);
    try {
      const res = await api.get('/superadmin/analytics/marketplace', { params: { period } });
      setMarketplaceAnalytics(res.data);
    } catch (err) {
      console.error('Failed to fetch marketplace analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ label, value, icon, color, bg, sub }) => (
    <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, bgcolor: 'white', border: `1px solid ${tokens.surfaceBorder}`, display: 'flex', alignItems: 'center', gap: 2, '&:hover': { boxShadow: '0 6px 24px rgba(13,64,108,0.09)' } }}>
      <Box sx={{ width: 48, height: 48, borderRadius: 2.5, bgcolor: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</Box>
      <Box>
        <Typography variant="h4" fontWeight={800} sx={{ color, fontFamily: "'DM Sans',sans-serif", lineHeight: 1 }}>{value || '—'}</Typography>
        <Typography sx={{ fontSize: 12, color: tokens.textMuted, fontWeight: 600 }}>{label}</Typography>
        {sub && <Typography sx={{ fontSize: 10, color: tokens.textMuted }}>{sub}</Typography>}
      </Box>
    </Paper>
  );

  return (
    <Box>
      <SectionTitle>Advanced Analytics</SectionTitle>

      {/* Period Selector */}
      <Paper elevation={0} sx={{ p: 2, mb: 3, borderRadius: 3, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: tokens.textSecondary }}>Time Period:</Typography>
          {periods.map(p => (
            <Chip
              key={p.value}
              label={p.label}
              onClick={() => setPeriod(p.value)}
              sx={{
                borderRadius: 2,
                fontWeight: 700,
                fontSize: 12,
                bgcolor: period === p.value ? tokens.primary : 'white',
                color: period === p.value ? 'white' : tokens.textSecondary,
                border: period === p.value ? 'none' : `1px solid ${tokens.surfaceBorder}`,
                cursor: 'pointer',
                '&:hover': { bgcolor: period === p.value ? tokens.primary : '#F8FAFC' }
              }}
            />
          ))}
        </Box>
      </Paper>

      {/* Tabs */}
      <Paper elevation={0} sx={{ mb: 3, borderRadius: 3, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white' }}>
        <Box sx={{ display: 'flex', borderBottom: `1px solid ${tokens.surfaceBorder}` }}>
          {tabs.map(tab => (
            <Box
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              sx={{
                px: 3,
                py: 2,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                borderBottom: activeTab === tab.id ? `3px solid ${tokens.primary}` : '3px solid transparent',
                bgcolor: activeTab === tab.id ? '#F8FAFC' : 'white',
                transition: 'all 0.2s',
                '&:hover': { bgcolor: '#F8FAFC' }
              }}
            >
              {tab.icon}
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: activeTab === tab.id ? tokens.primary : tokens.textSecondary, fontFamily: "'DM Sans',sans-serif" }}>
                {tab.label}
              </Typography>
            </Box>
          ))}
        </Box>
      </Paper>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress sx={{ color: tokens.accent }} />
        </Box>
      ) : (
        <>
          {activeTab === 'overview' && (
            <Grid container spacing={2}>
              <Grid item xs={6} md={3}>
                <StatCard label="Organizations" value={stats?.totalOrganizations ?? 0} icon={<Business sx={{ color: tokens.primary, fontSize: 24 }} />} color={tokens.primary} bg="rgba(13,64,108,0.1)" />
              </Grid>
              <Grid item xs={6} md={3}>
                <StatCard label="Teachers" value={stats?.totalTeachers ?? 0} icon={<SupervisorAccount sx={{ color: tokens.accent, fontSize: 24 }} />} color={tokens.accent} bg="rgba(12,189,115,0.1)" />
              </Grid>
              <Grid item xs={6} md={3}>
                <StatCard label="Students" value={stats?.totalStudents ?? 0} icon={<People sx={{ color: tokens.warning, fontSize: 24 }} />} color={tokens.warning} bg="rgba(245,158,11,0.1)" />
              </Grid>
              <Grid item xs={6} md={3}>
                <StatCard label="Total Exams" value={stats?.totalExams ?? 0} icon={<School sx={{ color: '#6366F1', fontSize: 24 }} />} color="#6366F1" bg="rgba(99,102,241,0.1)" />
              </Grid>
              <Grid item xs={12}>
                <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white' }}>
                  <SectionTitle>Platform Growth Trend</SectionTitle>
                  <AreaChart data={[30, 45, 40, 60, 55, 75, 70]} color={tokens.accent} />
                </Paper>
              </Grid>
            </Grid>
          )}

          {activeTab === 'students' && studentAnalytics && (
            <Grid container spacing={2}>
              <Grid item xs={6} md={3}>
                <StatCard label="Students Analyzed" value={studentAnalytics.summary?.totalStudentsAnalyzed ?? 0} icon={<People sx={{ color: tokens.primary, fontSize: 24 }} />} color={tokens.primary} bg="rgba(13,64,108,0.1)" />
              </Grid>
              <Grid item xs={6} md={3}>
                <StatCard label="Avg Score" value={`${studentAnalytics.summary?.overallAverageScore ?? 0}%`} icon={<TrendingUp sx={{ color: tokens.accent, fontSize: 24 }} />} color={tokens.accent} bg="rgba(12,189,115,0.1)" />
              </Grid>
              <Grid item xs={6} md={3}>
                <StatCard label="Pass Rate" value={`${studentAnalytics.summary?.overallPassRate ?? 0}%`} icon={<CheckCircle sx={{ color: tokens.warning, fontSize: 24 }} />} color={tokens.warning} bg="rgba(245,158,11,0.1)" />
              </Grid>
              <Grid item xs={6} md={3}>
                <StatCard label="Exams Completed" value={studentAnalytics.summary?.totalExamsCompleted ?? 0} icon={<School sx={{ color: '#6366F1', fontSize: 24 }} />} color="#6366F1" bg="rgba(99,102,241,0.1)" />
              </Grid>

              <Grid item xs={12} md={6}>
                <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white' }}>
                  <SectionTitle>Top Performers</SectionTitle>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                          <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Student</TableCell>
                          <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Organization</TableCell>
                          <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Avg Score</TableCell>
                          <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Pass Rate</TableCell>
                          <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Exams</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {studentAnalytics.topPerformers?.slice(0, 5).map((s, i) => (
                          <TableRow key={i} sx={{ '&:hover': { bgcolor: '#F8FAFC' } }}>
                            <TableCell>
                              <Typography variant="body2" fontWeight={600}>{s.student?.firstName} {s.student?.lastName}</Typography>
                              <Typography variant="caption" sx={{ color: tokens.textMuted }}>{s.student?.email}</Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" fontWeight={600}>{s.organization?.name || '—'}</Typography>
                            </TableCell>
                            <TableCell><Typography sx={{ fontWeight: 700, color: tokens.accent }}>{s.averageScore}%</Typography></TableCell>
                            <TableCell><Typography sx={{ fontWeight: 700, color: s.passRate >= 70 ? tokens.accent : tokens.warning }}>{s.passRate}%</Typography></TableCell>
                            <TableCell>{s.examCount}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              </Grid>

              <Grid item xs={12} md={6}>
                <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white' }}>
                  <SectionTitle>Students Needing Improvement</SectionTitle>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                          <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Student</TableCell>
                          <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Organization</TableCell>
                          <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Avg Score</TableCell>
                          <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Pass Rate</TableCell>
                          <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Exams</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {studentAnalytics.needingImprovement?.slice(0, 5).map((s, i) => (
                          <TableRow key={i} sx={{ '&:hover': { bgcolor: '#F8FAFC' } }}>
                            <TableCell>
                              <Typography variant="body2" fontWeight={600}>{s.student?.firstName} {s.student?.lastName}</Typography>
                              <Typography variant="caption" sx={{ color: tokens.textMuted }}>{s.student?.email}</Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" fontWeight={600}>{s.organization?.name || '—'}</Typography>
                            </TableCell>
                            <TableCell><Typography sx={{ fontWeight: 700, color: '#EF4444' }}>{s.averageScore}%</Typography></TableCell>
                            <TableCell><Typography sx={{ fontWeight: 700, color: tokens.warning }}>{s.passRate}%</Typography></TableCell>
                            <TableCell>{s.examCount}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              </Grid>

              <Grid item xs={12}>
                <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white' }}>
                  <SectionTitle>Subject Breakdown</SectionTitle>
                  <Grid container spacing={2}>
                    {studentAnalytics.subjectBreakdown?.map((subject, i) => (
                      <Grid item xs={6} md={3} key={i}>
                        <Box sx={{ p: 2, borderRadius: 2, bgcolor: '#F8FAFC', border: `1px solid ${tokens.surfaceBorder}` }}>
                          <Typography variant="h6" fontWeight={700} sx={{ color: tokens.primary }}>{subject.subject}</Typography>
                          <Typography variant="body2" sx={{ color: tokens.textMuted }}>{subject.examCount} exams</Typography>
                          <Typography variant="h5" fontWeight={800} sx={{ color: subject.averageScore >= 70 ? tokens.accent : tokens.warning }}>{subject.averageScore}% avg</Typography>
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                </Paper>
              </Grid>
            </Grid>
          )}

          {activeTab === 'teachers' && teacherAnalytics && (
            <Grid container spacing={2}>
              <Grid item xs={6} md={3}>
                <StatCard label="Total Teachers" value={teacherAnalytics.summary?.totalTeachers ?? 0} icon={<SupervisorAccount sx={{ color: tokens.primary, fontSize: 24 }} />} color={tokens.primary} bg="rgba(13,64,108,0.1)" />
              </Grid>
              <Grid item xs={6} md={3}>
                <StatCard label="Active Teachers" value={teacherAnalytics.summary?.activeTeachers ?? 0} icon={<CheckCircle sx={{ color: tokens.accent, fontSize: 24 }} />} color={tokens.accent} bg="rgba(12,189,115,0.1)" />
              </Grid>
              <Grid item xs={6} md={3}>
                <StatCard label="Exams Created" value={teacherAnalytics.summary?.totalExamsCreated ?? 0} icon={<School sx={{ color: tokens.warning, fontSize: 24 }} />} color={tokens.warning} bg="rgba(245,158,11,0.1)" />
              </Grid>
              <Grid item xs={6} md={3}>
                <StatCard label="Student Attempts" value={teacherAnalytics.summary?.totalStudentAttempts ?? 0} icon={<People sx={{ color: '#6366F1', fontSize: 24 }} />} color="#6366F1" bg="rgba(99,102,241,0.1)" />
              </Grid>

              <Grid item xs={12} md={6}>
                <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white' }}>
                  <SectionTitle>Top Teachers by Performance</SectionTitle>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                          <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Teacher</TableCell>
                          <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Organization</TableCell>
                          <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Exams</TableCell>
                          <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Students</TableCell>
                          <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Avg Score</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {teacherAnalytics.topTeachers?.slice(0, 5).map((t, i) => (
                          <TableRow key={i} sx={{ '&:hover': { bgcolor: '#F8FAFC' } }}>
                            <TableCell>
                              <Typography variant="body2" fontWeight={600}>{t.teacher?.firstName} {t.teacher?.lastName}</Typography>
                              <Typography variant="caption" sx={{ color: tokens.textMuted }}>{t.teacher?.email}</Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" fontWeight={600}>{t.organization?.name || '—'}</Typography>
                            </TableCell>
                            <TableCell>{t.examCount}</TableCell>
                            <TableCell>{t.totalStudents}</TableCell>
                            <TableCell><Typography sx={{ fontWeight: 700, color: t.averageStudentScore >= 70 ? tokens.accent : tokens.warning }}>{t.averageStudentScore}%</Typography></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              </Grid>

              <Grid item xs={12} md={6}>
                <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white' }}>
                  <SectionTitle>Most Active Teachers</SectionTitle>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                          <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Teacher</TableCell>
                          <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Organization</TableCell>
                          <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Exams Created</TableCell>
                          <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Students</TableCell>
                          <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Avg Score</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {teacherAnalytics.mostActiveTeachers?.slice(0, 5).map((t, i) => (
                          <TableRow key={i} sx={{ '&:hover': { bgcolor: '#F8FAFC' } }}>
                            <TableCell>
                              <Typography variant="body2" fontWeight={600}>{t.teacher?.firstName} {t.teacher?.lastName}</Typography>
                              <Typography variant="caption" sx={{ color: tokens.textMuted }}>{t.teacher?.email}</Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" fontWeight={600}>{t.organization?.name || '—'}</Typography>
                            </TableCell>
                            <TableCell><Typography sx={{ fontWeight: 700, color: tokens.primary }}>{t.examCount}</Typography></TableCell>
                            <TableCell>{t.totalStudents}</TableCell>
                            <TableCell><Typography sx={{ fontWeight: 700, color: t.averageStudentScore >= 70 ? tokens.accent : tokens.warning }}>{t.averageStudentScore}%</Typography></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              </Grid>
            </Grid>
          )}

          {activeTab === 'organizations' && orgAnalytics && (
            <Grid container spacing={2}>
              <Grid item xs={6} md={3}>
                <StatCard label="Total Organizations" value={orgAnalytics.summary?.totalOrganizations ?? 0} icon={<Business sx={{ color: tokens.primary, fontSize: 24 }} />} color={tokens.primary} bg="rgba(13,64,108,0.1)" />
              </Grid>
              <Grid item xs={6} md={3}>
                <StatCard label="Active Organizations" value={orgAnalytics.summary?.activeOrganizations ?? 0} icon={<CheckCircle sx={{ color: tokens.accent, fontSize: 24 }} />} color={tokens.accent} bg="rgba(12,189,115,0.1)" />
              </Grid>
              <Grid item xs={6} md={3}>
                <StatCard label="Exams Created" value={orgAnalytics.summary?.totalExamsCreated ?? 0} icon={<School sx={{ color: tokens.warning, fontSize: 24 }} />} color={tokens.warning} bg="rgba(245,158,11,0.1)" />
              </Grid>
              <Grid item xs={6} md={3}>
                <StatCard label="Student Attempts" value={orgAnalytics.summary?.totalStudentAttempts ?? 0} icon={<People sx={{ color: '#6366F1', fontSize: 24 }} />} color="#6366F1" bg="rgba(99,102,241,0.1)" />
              </Grid>

              <Grid item xs={12}>
                <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white' }}>
                  <SectionTitle>Top Organizations</SectionTitle>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                          <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Organization</TableCell>
                          <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Teachers</TableCell>
                          <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Exams</TableCell>
                          <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Students</TableCell>
                          <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Avg Score</TableCell>
                          <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Plan</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {orgAnalytics.topOrganizations?.slice(0, 10).map((org, i) => (
                          <TableRow key={i} sx={{ '&:hover': { bgcolor: '#F8FAFC' } }}>
                            <TableCell>
                              <Typography variant="body2" fontWeight={600}>{org.organization?.organization || `${org.organization?.firstName} ${org.organization?.lastName}`}</Typography>
                              <Typography variant="caption" sx={{ color: tokens.textMuted }}>{org.organization?.email}</Typography>
                            </TableCell>
                            <TableCell>{org.teacherCount}</TableCell>
                            <TableCell>{org.examCount}</TableCell>
                            <TableCell>{org.studentCount}</TableCell>
                            <TableCell><Typography sx={{ fontWeight: 700, color: org.averageStudentScore >= 70 ? tokens.accent : tokens.warning }}>{org.averageStudentScore}%</Typography></TableCell>
                            <TableCell><Chip label={org.subscriptionPlan} size="small" sx={{ bgcolor: `${PLAN_COLORS[org.subscriptionPlan] || PLAN_COLORS.free}15`, color: PLAN_COLORS[org.subscriptionPlan] || PLAN_COLORS.free, fontWeight: 600, textTransform: 'capitalize' }} /></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              </Grid>

              <Grid item xs={12}>
                <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white' }}>
                  <SectionTitle>By Subscription Plan</SectionTitle>
                  <Grid container spacing={2}>
                    {Object.entries(orgAnalytics.byPlan || {}).map(([plan, orgs]) => (
                      <Grid item xs={6} md={3} key={plan}>
                        <Box sx={{ p: 2, borderRadius: 2, bgcolor: '#F8FAFC', border: `1px solid ${tokens.surfaceBorder}` }}>
                          <Typography variant="h6" fontWeight={700} sx={{ color: PLAN_COLORS[plan] || tokens.textSecondary, textTransform: 'capitalize' }}>{plan}</Typography>
                          <Typography variant="h5" fontWeight={800} sx={{ color: tokens.primary }}>{orgs.length} organizations</Typography>
                          <Typography variant="caption" sx={{ color: tokens.textMuted }}>Total exams: {orgs.reduce((sum, o) => sum + o.examCount, 0)}</Typography>
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                </Paper>
              </Grid>
            </Grid>
          )}

          {activeTab === 'trends' && trendsAnalytics && (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white' }}>
                  <SectionTitle>User Registrations Over Time</SectionTitle>
                  <Box sx={{ mt: 2 }}>
                    {trendsAnalytics.userRegistrations?.length > 0 ? (
                      <AreaChart data={trendsAnalytics.userRegistrations.map(d => d.total)} color={tokens.primary} />
                    ) : (
                      <Typography sx={{ color: tokens.textMuted }}>No data available</Typography>
                    )}
                  </Box>
                </Paper>
              </Grid>
              <Grid item xs={12} md={6}>
                <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white' }}>
                  <SectionTitle>Exam Creation Trend</SectionTitle>
                  <Box sx={{ mt: 2 }}>
                    {trendsAnalytics.examCreation?.length > 0 ? (
                      <AreaChart data={trendsAnalytics.examCreation.map(d => d.total)} color={tokens.accent} />
                    ) : (
                      <Typography sx={{ color: tokens.textMuted }}>No data available</Typography>
                    )}
                  </Box>
                </Paper>
              </Grid>
              <Grid item xs={12} md={6}>
                <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white' }}>
                  <SectionTitle>Exam Completions Trend</SectionTitle>
                  <Box sx={{ mt: 2 }}>
                    {trendsAnalytics.examCompletions?.length > 0 ? (
                      <AreaChart data={trendsAnalytics.examCompletions.map(d => d.total)} color={tokens.warning} />
                    ) : (
                      <Typography sx={{ color: tokens.textMuted }}>No data available</Typography>
                    )}
                  </Box>
                </Paper>
              </Grid>
            </Grid>
          )}

          {activeTab === 'exams' && examAnalytics && (
            <Grid container spacing={2}>
              <Grid item xs={6} md={3}>
                <StatCard label="Total Exams" value={examAnalytics.summary?.totalExams ?? 0} icon={<School sx={{ color: tokens.primary, fontSize: 24 }} />} color={tokens.primary} bg="rgba(13,64,108,0.1)" />
              </Grid>
              <Grid item xs={6} md={3}>
                <StatCard label="With Completions" value={examAnalytics.summary?.examsWithCompletions ?? 0} icon={<CheckCircle sx={{ color: tokens.accent, fontSize: 24 }} />} color={tokens.accent} bg="rgba(12,189,115,0.1)" />
              </Grid>
              <Grid item xs={6} md={3}>
                <StatCard label="Total Completions" value={examAnalytics.summary?.totalCompletions ?? 0} icon={<People sx={{ color: tokens.warning, fontSize: 24 }} />} color={tokens.warning} bg="rgba(245,158,11,0.1)" />
              </Grid>
              <Grid item xs={6} md={3}>
                <StatCard label="Overall Avg Score" value={`${Math.round(examAnalytics.summary?.overallAverageScore ?? 0)}%`} icon={<TrendingUp sx={{ color: '#6366F1', fontSize: 24 }} />} color="#6366F1" bg="rgba(99,102,241,0.1)" />
              </Grid>

              <Grid item xs={12} md={6}>
                <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white' }}>
                  <SectionTitle>Most Popular Exams</SectionTitle>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                          <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Exam</TableCell>
                          <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Completions</TableCell>
                          <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Avg Score</TableCell>
                          <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Pass Rate</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {examAnalytics.mostPopularExams?.slice(0, 5).map((e, i) => (
                          <TableRow key={i} sx={{ '&:hover': { bgcolor: '#F8FAFC' } }}>
                            <TableCell>
                              <Typography variant="body2" fontWeight={600}>{e.exam?.title}</Typography>
                              <Typography variant="caption" sx={{ color: tokens.textMuted }}>By {e.exam?.createdBy?.firstName} {e.exam?.createdBy?.lastName}</Typography>
                            </TableCell>
                            <TableCell><Typography sx={{ fontWeight: 700, color: tokens.primary }}>{e.completionCount}</Typography></TableCell>
                            <TableCell><Typography sx={{ fontWeight: 700, color: e.averageScore >= 70 ? tokens.accent : tokens.warning }}>{e.averageScore}%</Typography></TableCell>
                            <TableCell><Typography sx={{ fontWeight: 700, color: e.passRate >= 70 ? tokens.accent : tokens.warning }}>{e.passRate}%</Typography></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              </Grid>

              <Grid item xs={12} md={6}>
                <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white' }}>
                  <SectionTitle>Most Difficult Exams</SectionTitle>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                          <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Exam</TableCell>
                          <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Completions</TableCell>
                          <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Avg Score</TableCell>
                          <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Pass Rate</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {examAnalytics.mostDifficultExams?.slice(0, 5).map((e, i) => (
                          <TableRow key={i} sx={{ '&:hover': { bgcolor: '#F8FAFC' } }}>
                            <TableCell>
                              <Typography variant="body2" fontWeight={600}>{e.exam?.title}</Typography>
                              <Typography variant="caption" sx={{ color: tokens.textMuted }}>By {e.exam?.createdBy?.firstName} {e.exam?.createdBy?.lastName}</Typography>
                            </TableCell>
                            <TableCell>{e.completionCount}</TableCell>
                            <TableCell><Typography sx={{ fontWeight: 700, color: '#EF4444' }}>{e.averageScore}%</Typography></TableCell>
                            <TableCell><Typography sx={{ fontWeight: 700, color: tokens.warning }}>{e.passRate}%</Typography></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              </Grid>
            </Grid>
          )}

          {activeTab === 'marketplace' && marketplaceAnalytics && (
            <Grid container spacing={2}>
              <Grid item xs={6} md={3}>
                <StatCard label="Marketplace Exams" value={marketplaceAnalytics.summary?.totalMarketplaceExams ?? 0} icon={<School sx={{ color: tokens.primary, fontSize: 24 }} />} color={tokens.primary} bg="rgba(13,64,108,0.1)" />
              </Grid>
              <Grid item xs={6} md={3}>
                <StatCard label="Total Requests" value={marketplaceAnalytics.summary?.totalRequests ?? 0} icon={<People sx={{ color: tokens.accent, fontSize: 24 }} />} color={tokens.accent} bg="rgba(12,189,115,0.1)" />
              </Grid>
              <Grid item xs={6} md={3}>
                <StatCard label="Approval Rate" value={`${marketplaceAnalytics.summary?.approvalRate ?? 0}%`} icon={<CheckCircle sx={{ color: tokens.warning, fontSize: 24 }} />} color={tokens.warning} bg="rgba(245,158,11,0.1)" />
              </Grid>
              <Grid item xs={6} md={3}>
                <StatCard label="Total Revenue" value={`$${marketplaceAnalytics.summary?.totalRevenue ?? 0}`} icon={<AttachMoney sx={{ color: '#6366F1', fontSize: 24 }} />} color="#6366F1" bg="rgba(99,102,241,0.1)" />
              </Grid>

              <Grid item xs={12}>
                <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white' }}>
                  <SectionTitle>Top Requested Exams</SectionTitle>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                          <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Exam</TableCell>
                          <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Requests</TableCell>
                          <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Approved</TableCell>
                          <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Revenue</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {marketplaceAnalytics.topRequestedExams?.slice(0, 10).map((e, i) => (
                          <TableRow key={i} sx={{ '&:hover': { bgcolor: '#F8FAFC' } }}>
                            <TableCell>
                              <Typography variant="body2" fontWeight={600}>{e.exam?.title}</Typography>
                              <Typography variant="caption" sx={{ color: tokens.textMuted }}>Price: ${e.exam?.publicPrice || 0}</Typography>
                            </TableCell>
                            <TableCell><Typography sx={{ fontWeight: 700, color: tokens.primary }}>{e.requestCount}</Typography></TableCell>
                            <TableCell><Typography sx={{ fontWeight: 700, color: tokens.accent }}>{e.approvedCount}</Typography></TableCell>
                            <TableCell><Typography sx={{ fontWeight: 700, color: '#6366F1' }}>${e.revenue}</Typography></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              </Grid>
            </Grid>
          )}
        </>
      )}
    </Box>
  );
}

function SettingsSection({ user }) {
  const { updateUserProfile } = useAuth();
  const [profile, setProfile] = useState({ firstName: user?.firstName||'', lastName: user?.lastName||'', email: user?.email||'', phone: user?.phone||'', gender: user?.gender||'' });
  const [pwd, setPwd] = useState({ current: '', newPwd: '', confirm: '' });
  const [emailPwd, setEmailPwd] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);
  const [snack, setSnack] = useState({ open: false, msg: '', severity: 'success' });
  const tf = { size: 'small', sx: { '& .MuiOutlinedInput-root': { borderRadius: 2 } } };

  const handleProfile = async () => {
    if (!profile.firstName.trim() || !profile.lastName.trim()) return setSnack({ open: true, msg: 'First and last name are required.', severity: 'error' });
    if (!profile.email.trim()) return setSnack({ open: true, msg: 'Email is required.', severity: 'error' });
    
    // If email is being changed, require current password
    if (profile.email !== user?.email && !emailPwd) {
      return setSnack({ open: true, msg: 'Current password is required to change email.', severity: 'error' });
    }
    
    setSaving(true);
    try {
      const payload = { 
        firstName: profile.firstName, 
        lastName: profile.lastName, 
        phone: profile.phone, 
        gender: profile.gender 
      };
      
      // Include email and current password if email is being changed
      if (profile.email !== user?.email) {
        payload.email = profile.email;
        payload.currentPassword = emailPwd;
      }
      
      const res = await api.put('/profile', payload);
      updateUserProfile(res.data);
      setSnack({ open: true, msg: 'Profile updated successfully.', severity: 'success' });
      setEmailPwd('');
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
        <Grid item xs={12} md={6}>
          <Paper elevation={0} sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3, bgcolor: 'white', border: `1px solid ${tokens.surfaceBorder}`, height: '100%' }}>
            <Typography fontWeight={700} sx={{ fontFamily: "'DM Sans',sans-serif", mb: 2 }}>Profile Information</Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}><TextField fullWidth label="First Name" value={profile.firstName} onChange={e => setProfile(p => ({ ...p, firstName: e.target.value }))} {...tf} /></Grid>
              <Grid item xs={12} sm={6}><TextField fullWidth label="Last Name" value={profile.lastName} onChange={e => setProfile(p => ({ ...p, lastName: e.target.value }))} {...tf} /></Grid>
              <Grid item xs={12}>
                <TextField 
                  fullWidth 
                  label="Email" 
                  value={profile.email} 
                  onChange={e => setProfile(p => ({ ...p, email: e.target.value }))} 
                  {...tf} 
                />
              </Grid>
              {profile.email !== user?.email && (
                <Grid item xs={12}>
                  <TextField 
                    fullWidth 
                    label="Current Password (required to change email)" 
                    type="password" 
                    value={emailPwd} 
                    onChange={e => setEmailPwd(e.target.value)} 
                    {...tf} 
                  />
                </Grid>
              )}
              <Grid item xs={12} sm={6}><TextField fullWidth label="Phone" value={profile.phone} onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))} placeholder="+250 7XX XXX XXX" {...tf} /></Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small" sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}>
                  <InputLabel>Gender</InputLabel>
                  <Select label="Gender" value={profile.gender} onChange={e => setProfile(p => ({ ...p, gender: e.target.value }))}>
                    <MuiMenuItem value="">Prefer not to say</MuiMenuItem>
                    <MuiMenuItem value="male">Male</MuiMenuItem>
                    <MuiMenuItem value="female">Female</MuiMenuItem>
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

/* ── EXAM BANK MARKETPLACE ── */
function ExamBankMarketplaceSection({ searchQuery }) {
  const [exams, setExams] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedExam, setSelectedExam] = useState(null);
  const [examDetails, setExamDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [editDialog, setEditDialog] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState(null);
  const [saving, setSaving] = useState(false);
  const [levels, setLevels] = useState([]);
  const [loadingLevels, setLoadingLevels] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [results, setResults] = useState([]);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [resultsSummary, setResultsSummary] = useState(null);
  const [reviewDialog, setReviewDialog] = useState(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewData, setReviewData] = useState(null);

  // Filter states
  const [localSearch, setLocalSearch] = useState(searchQuery || '');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const observerRef = useRef(null);

  // Callback ref for sentinel element - triggers observe/unobserve automatically
  const sentinelRef = useRef(null);
  const setSentinelRef = useRef((node) => {
    if (sentinelRef.current && observerRef.current) {
      observerRef.current.unobserve(sentinelRef.current);
    }
    sentinelRef.current = node;
    if (node && observerRef.current) {
      observerRef.current.observe(node);
    }
  }).current;

  // Infinite scroll with IntersectionObserver
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
          setPage(p => p + 1);
        }
      },
      { threshold: 0.1, rootMargin: '300px' }
    );
    if (sentinelRef.current) {
      observerRef.current.observe(sentinelRef.current);
    }
    return () => observerRef.current?.disconnect();
  }, [hasMore, loading, loadingMore]);

  // Sync local search with parent searchQuery prop
  useEffect(() => {
    setLocalSearch(searchQuery || '');
  }, [searchQuery]);

  // Filter exams client-side by search term
  const filteredExams = exams.filter(exam => {
    if (!localSearch) return true;
    const q = localSearch.toLowerCase();
    return (
      exam.title?.toLowerCase().includes(q) ||
      exam.createdBy?.organization?.toLowerCase().includes(q) ||
      exam.createdBy?.firstName?.toLowerCase().includes(q) ||
      exam.createdBy?.lastName?.toLowerCase().includes(q) ||
      exam.targetAudience?.toLowerCase().includes(q) ||
      exam.level?.name?.toLowerCase().includes(q) ||
      exam.publicDescription?.toLowerCase().includes(q)
    );
  });

  // Helper to get option display text (handles both string and object formats)
  const getOptionText = (opt) => {
    if (typeof opt === 'string') return opt;
    if (opt && typeof opt === 'object') return opt.text || opt.label || opt.value || '';
    return '';
  };

  // Handle filter changes with reset
  const handleStatusFilterChange = (value) => {
    setStatusFilter(value);
    setPage(1);
    setHasMore(true);
    setExams([]);
  };

  const handleSortByChange = (value) => {
    setSortBy(value);
    setPage(1);
    setHasMore(true);
    setExams([]);
  };

  useEffect(() => {
    fetchExams();
    fetchLevels();
    if (tabValue === 1) {
      fetchResults();
    }
  }, [statusFilter, sortBy, tabValue, page]);

  const fetchExams = async (reset = false) => {
    if (reset) {
      setPage(1);
      setHasMore(true);
      setExams([]);
    }
    const isFirstPage = reset || page === 1;
    if (isFirstPage) setLoading(true);
    else setLoadingMore(true);
    try {
      const res = await api.get('/superadmin/marketplace-exams', {
        params: { status: statusFilter, sortBy, page: reset ? 1 : page, limit: 50 }
      });
      const newExams = res.data.exams || [];
      setExams(prev => reset ? newExams : [...prev, ...newExams]);
      if (res.data.stats) setStats(res.data.stats);
      setHasMore(newExams.length >= 50);
    } catch (err) {
      console.error('Failed to fetch marketplace exams:', err);
      console.error('Error details:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
        config: err.config
      });
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const fetchExamDetails = async (examId) => {
    setDetailsLoading(true);
    try {
      const res = await api.get(`/superadmin/marketplace-exams/${examId}/usage`);
      setExamDetails(res.data);
      setSelectedExam(examId);
    } catch (err) {
      console.error('Failed to fetch exam details:', err);
    } finally {
      setDetailsLoading(false);
    }
  };

  const fetchLevels = async () => {
    try {
      setLoadingLevels(true);
      const response = await api.get('/marketplace/levels');
      setLevels(response.data);
    } catch (error) {
      console.error('Error fetching levels:', error);
    } finally {
      setLoadingLevels(false);
    }
  };

  const fetchResults = async () => {
    try {
      setResultsLoading(true);
      const response = await api.get('/superadmin/marketplace/results');
      setResults(response.data.results || []);
      setResultsSummary(response.data.summary || null);
    } catch (error) {
      console.error('Error fetching results:', error);
    } finally {
      setResultsLoading(false);
    }
  };

  const getAvailableSubLevels = () => {
    if (!editDialog?.levelId) return [];
    const selectedLevel = levels.find(l => l._id === editDialog.levelId);
    return selectedLevel?.subLevels?.filter(s => s.isActive) || [];
  };

  const handleEditSettings = async () => {
    if (!editDialog) return;
    setSaving(true);
    try {
      await api.put(`/superadmin/marketplace-exams/${editDialog._id}/settings`, {
        title: editDialog.title,
        isPubliclyListed: editDialog.isPubliclyListed,
        publicPrice: editDialog.publicPrice,
        retakePrice: editDialog.retakePrice ?? 0,
        publicDescription: editDialog.publicDescription,
        targetAudience: editDialog.targetAudience,
        levelId: editDialog.levelId,
        subLevel: editDialog.subLevel,
        status: editDialog.status
      });
      setSnack({ open: true, msg: 'Exam settings updated successfully', severity: 'success' });
      setEditDialog(null);
      fetchExams();
    } catch (err) {
      setSnack({ open: true, msg: err.response?.data?.message || 'Failed to update settings', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleReviewExam = async (exam) => {
    setReviewDialog(exam);
    setReviewLoading(true);
    setReviewData(null);
    try {
      const res = await api.get(`/superadmin/marketplace-exams/${exam._id}/review`);
      setReviewData(res.data.exam);
    } catch (err) {
      console.error('Failed to fetch exam for review:', err);
      setSnack({ open: true, msg: 'Failed to load exam details', severity: 'error' });
    } finally {
      setReviewLoading(false);
    }
  };

  const handleDeleteExam = async () => {
    if (!deleteDialog) return;
    setSaving(true);
    try {
      await api.delete(`/superadmin/exams/${deleteDialog._id}`);
      setSnack({ open: true, msg: 'Exam deleted successfully', severity: 'success' });
      setDeleteDialog(null);
      if (selectedExam === deleteDialog._id) {
        setSelectedExam(null);
        setExamDetails(null);
      }
      fetchExams();
    } catch (err) {
      setSnack({ open: true, msg: err.response?.data?.message || 'Failed to delete exam', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const [snack, setSnack] = useState({ open: false, msg: '', severity: 'info' });

  const StatCard = ({ label, value, icon, color, bg }) => (
    <Box sx={{ p: 2.5, borderRadius: 3, bgcolor: 'white', border: `1px solid ${tokens.surfaceBorder}`, display: 'flex', alignItems: 'center', gap: 2 }}>
      <Box sx={{ width: 48, height: 48, borderRadius: 2.5, bgcolor: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</Box>
      <Box>
        <Typography variant="h4" fontWeight={800} sx={{ color, fontFamily: "'DM Sans',sans-serif", lineHeight: 1 }}>{value || '—'}</Typography>
        <Typography variant="caption" sx={{ color: tokens.textMuted, fontWeight: 600 }}>{label}</Typography>
      </Box>
    </Box>
  );

  return (
    <Box>
      <SectionTitle>Exam Bank Marketplace</SectionTitle>

      {/* Overall Stats */}
      {stats && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={6} md={3}>
            <StatCard label="Marketplace Exams" value={stats.totalMarketplaceExams} icon={<School sx={{ color: tokens.primary, fontSize: 24 }} />} color={tokens.primary} bg="rgba(13,64,108,0.1)" />
          </Grid>
          <Grid item xs={6} md={3}>
            <StatCard label="Total Requests" value={stats.totalRequests} icon={<People sx={{ color: tokens.accent, fontSize: 24 }} />} color={tokens.accent} bg="rgba(12,189,115,0.1)" />
          </Grid>
          <Grid item xs={6} md={3}>
            <StatCard label="Completions" value={stats.totalCompletions} icon={<CheckCircle sx={{ color: '#6366F1', fontSize: 24 }} />} color="#6366F1" bg="rgba(99,102,241,0.1)" />
          </Grid>
          <Grid item xs={6} md={3}>
            <StatCard label="Completion Rate" value={`${stats.overallCompletionRate}%`} icon={<TrendingUp sx={{ color: tokens.warning, fontSize: 24 }} />} color={tokens.warning} bg="rgba(245,158,11,0.1)" />
          </Grid>
        </Grid>
      )}

      {/* Tabs */}
      <Box sx={{ mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item>
            <Button
              variant={tabValue === 0 ? 'contained' : 'outlined'}
              onClick={() => setTabValue(0)}
              sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
            >
              Exams
            </Button>
          </Grid>
          <Grid item>
            <Button
              variant={tabValue === 1 ? 'contained' : 'outlined'}
              onClick={() => setTabValue(1)}
              sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
              startIcon={<Assessment />}
            >
              Student Results
              {resultsSummary && resultsSummary.totalResults > 0 && (
                <Box component="span" sx={{ ml: 1, px: 1, py: 0.25, borderRadius: 1, bgcolor: 'rgba(12,189,115,0.1)', color: '#0CBD73', fontSize: 12, fontWeight: 700 }}>
                  {resultsSummary.totalResults}
                </Box>
              )}
            </Button>
          </Grid>
        </Grid>
      </Box>

      {/* Exams Tab */}
      {tabValue === 0 && (
        <>
      {/* Filter Bar */}
      <Paper elevation={0} sx={{ p: 2, mb: 3, borderRadius: 3, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white' }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search exams by title, creator, level..."
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              InputProps={{
                startAdornment: <Box component="span" sx={{ color: tokens.textMuted, mr: 1 }}>🔍</Box>
              }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: '#FAFBFC' } }}
            />
          </Grid>
          <Grid item xs={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select label="Status" value={statusFilter} onChange={(e) => handleStatusFilterChange(e.target.value)} sx={{ borderRadius: 2, bgcolor: '#FAFBFC' }}>
                <MuiMenuItem value="">All Status</MuiMenuItem>
                <MuiMenuItem value="public">Public</MuiMenuItem>
                <MuiMenuItem value="private">Private</MuiMenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Sort By</InputLabel>
              <Select label="Sort By" value={sortBy} onChange={(e) => handleSortByChange(e.target.value)} sx={{ borderRadius: 2, bgcolor: '#FAFBFC' }}>
                <MuiMenuItem value="createdAt">Recently Added</MuiMenuItem>
                <MuiMenuItem value="requests">Most Requests</MuiMenuItem>
                <MuiMenuItem value="completions">Most Completions</MuiMenuItem>
                <MuiMenuItem value="price">Highest Price</MuiMenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={2}>
            <Button fullWidth variant="outlined" onClick={() => fetchExams(true)} sx={{ borderRadius: 2, height: 37, textTransform: 'none', fontWeight: 600 }}>Refresh</Button>
          </Grid>
        </Grid>
      </Paper>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
          <CircularProgress sx={{ color: tokens.accent }} />
        </Box>
      ) : filteredExams.length === 0 ? (
        <Paper elevation={0} sx={{ p: 4, borderRadius: 3, border: `1px dashed ${tokens.surfaceBorder}`, bgcolor: '#FAFBFC', textAlign: 'center' }}>
          <Typography sx={{ color: tokens.textMuted }}>{localSearch ? `No exams matching "${localSearch}"` : 'No exams found in marketplace.'}</Typography>
        </Paper>
      ) : (
        <Grid container spacing={2}>
          {filteredExams.map((exam) => (
            <Grid item xs={12} md={6} lg={4} key={exam._id}>
              <Paper elevation={0} sx={{
                p: 2.5, borderRadius: 3, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white',
                transition: 'all 0.2s ease', '&:hover': { boxShadow: '0 8px 30px rgba(13,64,108,0.12)', transform: 'translateY(-2px)' },
                cursor: 'pointer'
              }} onClick={() => fetchExamDetails(exam._id)}>
                {/* Header */}
                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body1" fontWeight={700} sx={{ fontFamily: "'DM Sans',sans-serif", mb: 0.5 }} noWrap>{exam.title}</Typography>
                    <Typography variant="caption" sx={{ color: tokens.textMuted, display: 'block' }}>
                      By {exam.createdBy?.organization || `${exam.createdBy?.firstName} ${exam.createdBy?.lastName}`}
                    </Typography>
                  </Box>
                  <Chip
                    label={exam.isPubliclyListed ? 'Public' : 'Private'}
                    size="small"
                    sx={{
                      height: 22, fontSize: '11px', fontWeight: 600,
                      bgcolor: exam.isPubliclyListed ? 'rgba(12,189,115,0.1)' : 'rgba(100,116,139,0.1)',
                      color: exam.isPubliclyListed ? tokens.accent : '#64748B'
                    }}
                  />
                </Box>

                {/* Stats */}
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, bgcolor: '#F8FAFC', px: 1.25, py: 0.5, borderRadius: 1.5 }}>
                    <People sx={{ fontSize: 14, color: tokens.accent }} />
                    <Typography variant="caption" fontWeight={700} sx={{ color: tokens.textPrimary }}>{exam.stats?.requestCount || 0}</Typography>
                    <Typography variant="caption" sx={{ color: tokens.textMuted, fontSize: '10px' }}>requests</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, bgcolor: '#F8FAFC', px: 1.25, py: 0.5, borderRadius: 1.5 }}>
                    <CheckCircle sx={{ fontSize: 14, color: '#6366F1' }} />
                    <Typography variant="caption" fontWeight={700} sx={{ color: tokens.textPrimary }}>{exam.stats?.completedCount || 0}</Typography>
                    <Typography variant="caption" sx={{ color: tokens.textMuted, fontSize: '10px' }}>completed</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, bgcolor: '#F8FAFC', px: 1.25, py: 0.5, borderRadius: 1.5 }}>
                    <TrendingUp sx={{ fontSize: 14, color: tokens.warning }} />
                    <Typography variant="caption" fontWeight={700} sx={{ color: tokens.textPrimary }}>{exam.stats?.averageScore || 0}%</Typography>
                    <Typography variant="caption" sx={{ color: tokens.textMuted, fontSize: '10px' }}>avg score</Typography>
                  </Box>
                </Box>

                {/* Footer */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pt: 1.5, borderTop: `1px solid ${tokens.surfaceBorder}` }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Typography variant="body2" fontWeight={700} sx={{ color: tokens.accent }}>
                      {exam.publicPrice > 0 ? `${exam.publicPrice} RWF` : 'Free'}
                    </Typography>
                    {exam.retakePrice > 0 && (
                      <Typography variant="caption" fontWeight={600} sx={{ color: tokens.warning }}>
                        Retake: {exam.retakePrice} RWF
                      </Typography>
                    )}
                    {exam.level && (
                      <Chip label={exam.level.name} size="small" sx={{ height: 20, fontSize: '10px', bgcolor: 'rgba(99,102,241,0.1)', color: '#6366F1', fontWeight: 600 }} />
                    )}
                  </Box>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <Tooltip title="Review Questions">
                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleReviewExam(exam); }} sx={{ color: tokens.accent, bgcolor: 'rgba(12,189,115,0.1)', '&:hover': { bgcolor: 'rgba(12,189,115,0.2)' }, width: 32, height: 32 }}>
                        <Visibility fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Edit Settings">
                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); setEditDialog({ ...exam, levelId: exam.level?._id || null, subLevel: exam.subLevel || '' }); }} sx={{ color: tokens.primary, bgcolor: `${tokens.primary}10`, '&:hover': { bgcolor: `${tokens.primary}20` }, width: 32, height: 32 }}>
                        <Edit fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete Exam">
                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); setDeleteDialog(exam); }} sx={{ color: '#EF4444', bgcolor: 'rgba(239,68,68,0.1)', '&:hover': { bgcolor: 'rgba(239,68,68,0.2)' }, width: 32, height: 32 }}>
                        <Delete fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Infinite scroll sentinel */}
      {hasMore && !loading && (
        <Box ref={setSentinelRef} sx={{ display: 'flex', justifyContent: 'center', mt: 3, py: 2 }}>
          {loadingMore && <CircularProgress size={28} sx={{ color: tokens.accent }} />}
        </Box>
      )}

      {/* Exam Details Dialog */}
      <Dialog open={!!selectedExam} onClose={() => setSelectedExam(null)} maxWidth="lg" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700, fontFamily: "'DM Sans',sans-serif", pb: 1 }}>
          Exam Usage Details
          {selectedExam && <Typography variant="caption" sx={{ color: tokens.textMuted, display: 'block', mt: 0.5 }}>{exams.find(e => e._id === selectedExam)?.title}</Typography>}
        </DialogTitle>
        <DialogContent sx={{ pt: '20px !important' }}>
          {detailsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress sx={{ color: tokens.accent }} />
            </Box>
          ) : examDetails ? (
            <Grid container spacing={2}>
              {/* Stats Overview */}
              <Grid item xs={12}>
                <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, bgcolor: '#F8FAFC', border: `1px solid ${tokens.surfaceBorder}` }}>
                  <Typography fontWeight={700} sx={{ mb: 2 }}>Performance Overview</Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={6} md={3}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h4" fontWeight={800} sx={{ color: tokens.primary }}>{examDetails.stats.totalRequests}</Typography>
                        <Typography variant="caption" sx={{ color: tokens.textMuted }}>Total Requests</Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={6} md={3}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h4" fontWeight={800} sx={{ color: tokens.accent }}>{examDetails.stats.completedResults}</Typography>
                        <Typography variant="caption" sx={{ color: tokens.textMuted }}>Completed</Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={6} md={3}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h4" fontWeight={800} sx={{ color: '#6366F1' }}>{examDetails.stats.averageScore}%</Typography>
                        <Typography variant="caption" sx={{ color: tokens.textMuted }}>Avg Score</Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={6} md={3}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h4" fontWeight={800} sx={{ color: tokens.warning }}>{examDetails.stats.completionRate}%</Typography>
                        <Typography variant="caption" sx={{ color: tokens.textMuted }}>Completion Rate</Typography>
                      </Box>
                    </Grid>
                  </Grid>
                </Paper>
              </Grid>

              {/* Recent Requests */}
              <Grid item xs={12} md={6}>
                <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, bgcolor: 'white', border: `1px solid ${tokens.surfaceBorder}`, maxHeight: 400, overflow: 'auto' }}>
                  <Typography fontWeight={700} sx={{ mb: 2 }}>Recent Requests</Typography>
                  {examDetails.requests.all.length === 0 ? (
                    <Typography variant="body2" sx={{ color: tokens.textMuted }}>No requests yet.</Typography>
                  ) : (
                    examDetails.requests.all.slice(0, 10).map((req) => (
                      <Box key={req._id} sx={{ p: 1.5, borderRadius: 2, bgcolor: '#F8FAFC', mb: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Typography variant="body2" fontWeight={600}>{req.student?.firstName} {req.student?.lastName}</Typography>
                          <Chip label={req.status} size="small" sx={{
                            height: 20, fontSize: '10px', fontWeight: 600,
                            bgcolor: req.status === 'approved' ? 'rgba(12,189,115,0.1)' : req.status === 'rejected' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
                            color: req.status === 'approved' ? tokens.accent : req.status === 'rejected' ? '#EF4444' : tokens.warning
                          }} />
                        </Box>
                        <Typography variant="caption" sx={{ color: tokens.textMuted }}>{new Date(req.requestedAt).toLocaleDateString()}</Typography>
                      </Box>
                    ))
                  )}
                </Paper>
              </Grid>

              {/* Score Distribution */}
              <Grid item xs={12} md={6}>
                <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, bgcolor: 'white', border: `1px solid ${tokens.surfaceBorder}` }}>
                  <Typography fontWeight={700} sx={{ mb: 2 }}>Score Distribution</Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {[
                      { label: 'Excellent (80%+)', value: examDetails.stats.scoreDistribution.excellent, color: tokens.accent },
                      { label: 'Good (60-79%)', value: examDetails.stats.scoreDistribution.good, color: '#6366F1' },
                      { label: 'Average (40-59%)', value: examDetails.stats.scoreDistribution.average, color: tokens.warning },
                      { label: 'Poor (<40%)', value: examDetails.stats.scoreDistribution.poor, color: '#EF4444' },
                    ].map((item) => (
                      <Box key={item.label}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                          <Typography variant="caption" fontWeight={600}>{item.label}</Typography>
                          <Typography variant="caption" fontWeight={700} sx={{ color: item.color }}>{item.value}</Typography>
                        </Box>
                        <LinearProgress variant="determinate" value={examDetails.stats.completedResults > 0 ? (item.value / examDetails.stats.completedResults) * 100 : 0}
                          sx={{ height: 8, borderRadius: 4, bgcolor: `${item.color}15`, '& .MuiLinearProgress-bar': { bgcolor: item.color, borderRadius: 4 } }} />
                      </Box>
                    ))}
                  </Box>
                </Paper>
              </Grid>
            </Grid>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setSelectedExam(null)} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Edit Settings Dialog */}
      <Dialog open={!!editDialog} onClose={() => setEditDialog(null)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700, fontFamily: "'DM Sans',sans-serif", pb: 1 }}>
          Edit Exam Settings
          {editDialog && <Typography variant="caption" sx={{ color: tokens.textMuted, display: 'block', mt: 0.5 }}>{editDialog.title}</Typography>}
        </DialogTitle>
        <DialogContent sx={{ pt: '20px !important' }}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField fullWidth label="Exam Title" size="small" value={editDialog?.title || ''} onChange={(e) => setEditDialog(d => ({ ...d, title: e.target.value }))} sx={{ borderRadius: 2 }} />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth size="small">
                <InputLabel sx={{ fontWeight: 600 }}>Visibility</InputLabel>
                <Select label="Visibility" value={editDialog?.isPubliclyListed || false} onChange={(e) => setEditDialog(d => ({ ...d, isPubliclyListed: e.target.value }))} sx={{ borderRadius: 2 }}>
                  <MuiMenuItem value={true}>Public (Marketplace)</MuiMenuItem>
                  <MuiMenuItem value={false}>Private</MuiMenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth label="Take Price (RWF)" type="number" size="small" value={editDialog?.publicPrice ?? 0} onChange={(e) => setEditDialog(d => ({ ...d, publicPrice: e.target.value }))} helperText="0 for free" sx={{ borderRadius: 2 }} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth label="Retake Price (RWF)" type="number" size="small" value={editDialog?.retakePrice ?? 0} onChange={(e) => setEditDialog(d => ({ ...d, retakePrice: e.target.value }))} helperText="0 for free retake" sx={{ borderRadius: 2 }} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Public Description" multiline rows={3} size="small" value={editDialog?.publicDescription || ''} onChange={(e) => setEditDialog(d => ({ ...d, publicDescription: e.target.value }))} sx={{ borderRadius: 2 }} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Target Audience" size="small" value={editDialog?.targetAudience || ''} onChange={(e) => setEditDialog(d => ({ ...d, targetAudience: e.target.value }))} sx={{ borderRadius: 2 }} />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth size="small">
                <InputLabel sx={{ fontWeight: 600 }}>Level</InputLabel>
                <Select
                  label="Level"
                  value={editDialog?.levelId ? String(editDialog.levelId) : ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    setEditDialog(d => ({ ...d, levelId: value, subLevel: '' }));
                  }}
                  sx={{ borderRadius: 2 }}
                  disabled={loadingLevels}
                >
                  <MuiMenuItem value="">
                    <em>Select a level</em>
                  </MuiMenuItem>
                  {levels.map((level) => (
                    <MuiMenuItem
                      key={String(level._id)}
                      value={String(level._id)}
                    >
                      {level.name}
                      {level.subLevels?.filter(s => s.isActive).length > 0 && (
                        <Typography component="span" variant="caption" sx={{ ml: 1, color: '#0CBD73', fontSize: 10 }}>
                          ({level.subLevels.filter(s => s.isActive).length} sub)
                        </Typography>
                      )}
                    </MuiMenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth size="small" disabled={getAvailableSubLevels().length === 0}>
                <InputLabel sx={{ fontWeight: 600 }}>Sub-Level</InputLabel>
                <Select
                  label="Sub-Level"
                  value={editDialog?.subLevel || ''}
                  onChange={(e) => setEditDialog(d => ({ ...d, subLevel: e.target.value }))}
                  sx={{ borderRadius: 2 }}
                >
                  <MuiMenuItem value="">
                    {getAvailableSubLevels().length === 0 ? 'No sub-levels' : 'All'}
                  </MuiMenuItem>
                  {getAvailableSubLevels().map(subLevel => (
                    <MuiMenuItem key={subLevel._id} value={subLevel.name}>
                      {subLevel.name}
                    </MuiMenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth size="small">
                <InputLabel sx={{ fontWeight: 600 }}>Status</InputLabel>
                <Select label="Status" value={editDialog?.status || 'draft'} onChange={(e) => setEditDialog(d => ({ ...d, status: e.target.value }))} sx={{ borderRadius: 2 }}>
                  <MuiMenuItem value="draft">Draft</MuiMenuItem>
                  <MuiMenuItem value="scheduled">Scheduled</MuiMenuItem>
                  <MuiMenuItem value="active">Active</MuiMenuItem>
                  <MuiMenuItem value="completed">Completed</MuiMenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setEditDialog(null)} disabled={saving} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}>Cancel</Button>
          <Button variant="contained" onClick={handleEditSettings} disabled={saving} sx={{ borderRadius: 2, background: gradients.brand, textTransform: 'none', fontWeight: 700, px: 3 }}>
            {saving ? 'Saving…' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteDialog} onClose={() => setDeleteDialog(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Delete Exam</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>Are you sure you want to <b>permanently delete</b> this exam?</Typography>
          <Box sx={{ p: 2, bgcolor: '#FEF2F2', borderRadius: 2, border: '1px solid #FECACA', mb: 2 }}>
            <Typography variant="body2" fontWeight={600} sx={{ color: '#7F1D1D' }}>⚠️ Warning: This action cannot be undone!</Typography>
            <Typography variant="body2" sx={{ color: '#991B1B', mt: 0.5 }}>All requests, results, and associated data will be permanently removed.</Typography>
          </Box>
          {deleteDialog && (
            <Box sx={{ p: 2, bgcolor: '#F8FAFC', borderRadius: 2 }}>
              <Typography fontWeight={600}>{deleteDialog.title}</Typography>
              <Typography variant="caption" sx={{ color: tokens.textMuted }}>{deleteDialog.createdBy?.organization || `${deleteDialog.createdBy?.firstName} ${deleteDialog.createdBy?.lastName}`}</Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteDialog(null)} disabled={saving} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleDeleteExam}
            disabled={saving}
            sx={{ bgcolor: '#EF4444', '&:hover': { bgcolor: '#DC2626' }, textTransform: 'none' }}
          >
            {saving ? 'Deleting…' : 'Delete Exam'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Exam Review Dialog */}
      <Dialog open={!!reviewDialog} onClose={() => setReviewDialog(null)} maxWidth="lg" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700, fontFamily: "'DM Sans',sans-serif", pb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h6">Exam Review</Typography>
            {reviewDialog && <Typography variant="caption" sx={{ color: tokens.textMuted, display: 'block', mt: 0.5 }}>{reviewDialog.title}</Typography>}
          </Box>
          <IconButton onClick={() => setReviewDialog(null)}>
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: '20px !important' }}>
          {reviewLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress sx={{ color: tokens.accent }} />
            </Box>
          ) : reviewData ? (
            <Box>
              {/* Exam Summary */}
              <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: 2, bgcolor: '#F8FAFC' }}>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="body2" sx={{ color: tokens.textMuted, fontWeight: 600 }}>Created By</Typography>
                    <Typography variant="body1" fontWeight={600}>
                      {reviewData.createdBy?.organization || `${reviewData.createdBy?.firstName} ${reviewData.createdBy?.lastName}`}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="body2" sx={{ color: tokens.textMuted, fontWeight: 600 }}>Time Limit</Typography>
                    <Typography variant="body1" fontWeight={600}>{reviewData.timeLimit} minutes</Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="body2" sx={{ color: tokens.textMuted, fontWeight: 600 }}>Passing Score</Typography>
                    <Typography variant="body1" fontWeight={600}>{reviewData.passingScore}%</Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="body2" sx={{ color: tokens.textMuted, fontWeight: 600 }}>Status</Typography>
                    <Chip
                      label={reviewData.status}
                      size="small"
                      sx={{
                        fontWeight: 600,
                        bgcolor: reviewData.status === 'active' ? 'rgba(12,189,115,0.1)' : 'rgba(100,116,139,0.1)',
                        color: reviewData.status === 'active' ? tokens.accent : '#64748B'
                      }}
                    />
                  </Grid>
                </Grid>
              </Paper>

              {/* Questions */}
              <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>Questions ({reviewData.sections?.reduce((acc, s) => acc + (s.questions?.length || 0), 0) || 0})</Typography>
              {reviewData.sections?.map((section, sectionIndex) => (
                <Box key={section._id} sx={{ mb: 3 }}>
                  <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2, color: tokens.primary }}>
                    Section {sectionIndex + 1}: {section.title || 'Untitled Section'}
                  </Typography>
                  {section.questions?.map((question, qIndex) => (
                    <Paper key={question._id} elevation={0} sx={{ p: 3, mb: 2, borderRadius: 2, border: `1px solid ${tokens.surfaceBorder}` }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                        <Typography variant="body1" fontWeight={600} sx={{ flex: 1 }}>
                          Q{qIndex + 1}. {question.text}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, ml: 2 }}>
                          <Chip label={question.type} size="small" sx={{ fontWeight: 600, bgcolor: 'rgba(99,102,241,0.1)', color: '#6366F1' }} />
                          <Chip label={`${question.marks} marks`} size="small" sx={{ fontWeight: 600, bgcolor: 'rgba(245,158,11,0.1)', color: tokens.warning }} />
                        </Box>
                      </Box>

                      {question.type === 'multiple-choice' && (
                        <Box sx={{ mt: 2 }}>
                          <Typography variant="body2" sx={{ color: tokens.textMuted, fontWeight: 600, mb: 1 }}>Options:</Typography>
                          {question.options?.map((option, optIndex) => {
                            const optionText = getOptionText(option);
                            const isCorrect = optionText === getOptionText(question.correctAnswer);
                            return (
                              <Box
                                key={optIndex}
                                sx={{
                                  p: 1.5,
                                  mb: 1,
                                  borderRadius: 1,
                                  bgcolor: isCorrect ? 'rgba(12,189,115,0.1)' : '#F8FAFC',
                                  border: isCorrect ? `1px solid ${tokens.accent}` : '1px solid transparent',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 1
                                }}
                              >
                                {isCorrect && <CheckCircle fontSize="small" sx={{ color: tokens.accent }} />}
                                <Typography variant="body2">{optionText}</Typography>
                              </Box>
                            );
                          })}
                        </Box>
                      )}

                      {question.type === 'true-false' && (
                        <Box sx={{ mt: 2 }}>
                          <Typography variant="body2" sx={{ color: tokens.textMuted, fontWeight: 600, mb: 1 }}>Correct Answer:</Typography>
                          <Chip
                            label={question.correctAnswer}
                            size="small"
                            sx={{
                              bgcolor: 'rgba(12,189,115,0.1)',
                              color: tokens.accent,
                              fontWeight: 600
                            }}
                          />
                        </Box>
                      )}

                      {question.type === 'short-answer' && (
                        <Box sx={{ mt: 2 }}>
                          <Typography variant="body2" sx={{ color: tokens.textMuted, fontWeight: 600, mb: 1 }}>Correct Answer:</Typography>
                          <Paper elevation={0} sx={{ p: 2, bgcolor: 'rgba(12,189,115,0.05)', borderRadius: 1, border: `1px solid ${tokens.accent}33` }}>
                            <Typography variant="body2" sx={{ color: tokens.accent }}>{question.correctAnswer}</Typography>
                          </Paper>
                        </Box>
                      )}
                    </Paper>
                  ))}
                </Box>
              ))}
            </Box>
          ) : (
            <Typography sx={{ color: tokens.textMuted, textAlign: 'center', py: 4 }}>
              No exam details available
            </Typography>
          )}
        </DialogContent>
      </Dialog>

      <Snackbar open={snack.open} autoHideDuration={3500} onClose={() => setSnack(s => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snack.severity} onClose={() => setSnack(s => ({ ...s, open: false }))} sx={{ borderRadius: 2 }}>{snack.msg}</Alert>
      </Snackbar>
        </>
      )}

      {/* Results Tab */}
      {tabValue === 1 && (
        <Paper elevation={0} sx={{ borderRadius: 3, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white' }}>
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
              All Marketplace Exam Results
            </Typography>

            {resultsLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : results.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 6 }}>
                <Assessment sx={{ fontSize: 64, color: '#94a3b8', mb: 2 }} />
                <Typography variant="body1" sx={{ color: '#64748b' }}>
                  No results yet for marketplace exams
                </Typography>
              </Box>
            ) : (
              <>
                {/* Summary Stats */}
                {resultsSummary && (
                  <Grid container spacing={2} sx={{ mb: 3 }}>
                    <Grid item xs={12} md={4}>
                      <StatCard label="Total Attempts" value={resultsSummary.totalResults} icon={<Assessment sx={{ color: tokens.primary, fontSize: 24 }} />} color={tokens.primary} bg="rgba(13,64,108,0.1)" />
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <StatCard label="Average Score" value={`${resultsSummary.averageScore}%`} icon={<TrendingUp sx={{ color: tokens.accent, fontSize: 24 }} />} color={tokens.accent} bg="rgba(12,189,115,0.1)" />
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <StatCard label="Total Exams" value={resultsSummary.totalExams} icon={<School sx={{ color: '#6366F1', fontSize: 24 }} />} color="#6366F1" bg="rgba(99,102,241,0.1)" />
                    </Grid>
                  </Grid>
                )}

                {/* Results Table */}
                <TableContainer component={Paper} elevation={0}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Student</TableCell>
                        <TableCell>Email</TableCell>
                        <TableCell>Exam</TableCell>
                        <TableCell>Score</TableCell>
                        <TableCell>Percentage</TableCell>
                        <TableCell>Time Taken</TableCell>
                        <TableCell>Completed At</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {results.map((result) => (
                        <TableRow key={result._id}>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Person fontSize="small" sx={{ color: '#64748b' }} />
                              {result.student.fullName}
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Email fontSize="small" sx={{ color: '#64748b' }} />
                              {result.student.email}
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" fontWeight={500}>
                              {result.exam.title}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography fontWeight={600}>
                              {result.totalScore} / {result.maxPossibleScore}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={`${result.percentage}%`}
                              size="small"
                              color={result.percentage >= 70 ? 'success' : result.percentage >= 50 ? 'warning' : 'error'}
                              sx={{ fontWeight: 600 }}
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {result.timeTaken} min
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {new Date(result.endTime).toLocaleDateString()}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            )}
          </Box>
        </Paper>
      )}
    </Box>
  );
}

/* ── EXAM REQUESTS ── */
function ExamRequestsSection({ searchQuery }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [orgFilter, setOrgFilter] = useState('');
  const [stats, setStats] = useState(null);
  const [approveDialog, setApproveDialog] = useState(null);
  const [rejectDialog, setRejectDialog] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });
  
  // LAZY LOADING: Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const pageSize = 20;

  useEffect(() => {
    fetchRequests(1, false);
    fetchStats();
  }, [statusFilter, orgFilter]);

  const fetchRequests = async (page = 1, append = false) => {
    if (!append) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    try {
      const params = new URLSearchParams();
      params.append('page', page);
      params.append('limit', pageSize);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (orgFilter) params.append('organizationId', orgFilter);
      
      const response = await api.get(`/superadmin/exam-requests?${params.toString()}`);
      
      // Handle new API response format with pagination
      if (response.data.requests && response.data.pagination) {
        const newRequests = response.data.requests;
        if (append) {
          setRequests(prev => [...prev, ...newRequests]);
        } else {
          setRequests(newRequests);
        }
        setHasMore(page < response.data.pagination.totalPages);
      } else {
        // Fallback for old format
        setRequests(response.data || []);
        setHasMore(false);
      }
    } catch (error) {
      console.error('Error fetching exam requests:', error);
      setSnack({ open: true, message: 'Failed to load exam requests', severity: 'error' });
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // LAZY LOADING: Load more data
  const loadMore = () => {
    if (!loadingMore && hasMore) {
      const nextPage = currentPage + 1;
      setCurrentPage(nextPage);
      fetchRequests(nextPage, true);
    }
  };

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
    setHasMore(true);
  }, [statusFilter, orgFilter]);

  const fetchStats = async () => {
    try {
      const response = await api.get('/superadmin/exam-requests/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleApprove = async () => {
    if (!approveDialog) return;
    setProcessing(true);
    try {
      const response = await api.put(`/superadmin/exam-requests/${approveDialog._id}/approve`, { waivePayment: false });
      console.log('[SuperAdmin] Approval response:', response.data);
      setSnack({ open: true, message: response.data.message || 'Exam request approved successfully', severity: 'success' });
      setApproveDialog(null);
      // Reset pagination and fetch first page
      setCurrentPage(1);
      setHasMore(true);
      fetchRequests(1, false);
      fetchStats();
    } catch (error) {
      console.error('[SuperAdmin] Error approving request:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to approve request';
      console.error('[SuperAdmin] Error message:', errorMessage);
      setSnack({ open: true, message: errorMessage, severity: 'error' });
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectDialog) return;
    setProcessing(true);
    try {
      await api.put(`/superadmin/exam-requests/${rejectDialog._id}/reject`, { reason: rejectDialog.reason || 'Rejected by super admin' });
      setSnack({ open: true, message: 'Exam request rejected', severity: 'success' });
      setRejectDialog(null);
      // Reset pagination and fetch first page
      setCurrentPage(1);
      setHasMore(true);
      fetchRequests(1, false);
      fetchStats();
    } catch (error) {
      console.error('Error rejecting request:', error);
      setSnack({ open: true, message: 'Failed to reject request', severity: 'error' });
    } finally {
      setProcessing(false);
    }
  };

  const filteredRequests = requests.filter(r => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.exam?.title?.toLowerCase().includes(q) ||
      r.userInfo?.name?.toLowerCase().includes(q) ||
      r.userInfo?.email?.toLowerCase().includes(q) ||
      r.teacher?.firstName?.toLowerCase().includes(q) ||
      r.teacher?.lastName?.toLowerCase().includes(q) ||
      r.organization?.name?.toLowerCase().includes(q)
    );
  });

  const organizations = [...new Set(requests.map(r => r.organization?.id).filter(Boolean))];

  return (
    <Box>
      <SectionTitle>Exam Requests Management</SectionTitle>

      {/* Stats Cards */}
      {stats && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={6} md={3}>
            <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white' }}>
              <Typography variant="h4" fontWeight={800} sx={{ color: tokens.textPrimary }}>{stats.total || 0}</Typography>
              <Typography variant="caption" sx={{ color: tokens.textMuted }}>Total Requests</Typography>
            </Paper>
          </Grid>
          <Grid item xs={6} md={3}>
            <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white' }}>
              <Typography variant="h4" fontWeight={800} sx={{ color: tokens.warning }}>{stats.pending || 0}</Typography>
              <Typography variant="caption" sx={{ color: tokens.textMuted }}>Pending</Typography>
            </Paper>
          </Grid>
          <Grid item xs={6} md={3}>
            <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white' }}>
              <Typography variant="h4" fontWeight={800} sx={{ color: tokens.accent }}>{stats.approved || 0}</Typography>
              <Typography variant="caption" sx={{ color: tokens.textMuted }}>Approved</Typography>
            </Paper>
          </Grid>
          <Grid item xs={6} md={3}>
            <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white' }}>
              <Typography variant="h4" fontWeight={800} sx={{ color: '#EF4444' }}>{stats.rejected || 0}</Typography>
              <Typography variant="caption" sx={{ color: tokens.textMuted }}>Rejected</Typography>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* Filter Bar */}
      <Paper elevation={0} sx={{ p: 2, mb: 3, borderRadius: 3, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white' }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search by exam, student, teacher, organization..."
              value={searchQuery}
              InputProps={{
                startAdornment: <Box component="span" sx={{ color: tokens.textMuted, mr: 1 }}>🔍</Box>
              }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: '#FAFBFC' } }}
            />
          </Grid>
          <Grid item xs={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select label="Status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} sx={{ borderRadius: 2, bgcolor: '#FAFBFC' }}>
                <MuiMenuItem value="pending">Pending</MuiMenuItem>
                <MuiMenuItem value="approved">Approved</MuiMenuItem>
                <MuiMenuItem value="rejected">Rejected</MuiMenuItem>
                <MuiMenuItem value="all">All</MuiMenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Organization</InputLabel>
              <Select label="Organization" value={orgFilter} onChange={(e) => setOrgFilter(e.target.value)} sx={{ borderRadius: 2, bgcolor: '#FAFBFC' }}>
                <MuiMenuItem value="">All Organizations</MuiMenuItem>
                {organizations.map(orgId => {
                  const org = requests.find(r => r.organization?.id === orgId)?.organization;
                  return org ? (
                    <MuiMenuItem key={orgId} value={orgId}>{org.name}</MuiMenuItem>
                  ) : null;
                })}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={2}>
            <Button
              fullWidth
              variant="outlined"
              onClick={() => fetchRequests(1, false)}
              startIcon={loading ? <CircularProgress size={16} /> : null}
              disabled={loading}
              sx={{ borderRadius: 2 }}
            >
              Refresh
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Requests Table */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
          <CircularProgress sx={{ color: tokens.accent }} />
        </Box>
      ) : filteredRequests.length === 0 ? (
        <Paper elevation={0} sx={{ p: 8, borderRadius: 3, border: `1px dashed ${tokens.surfaceBorder}`, bgcolor: '#FAFBFC', textAlign: 'center' }}>
          <School sx={{ fontSize: 48, color: tokens.textMuted, mb: 2 }} />
          <Typography variant="h6" sx={{ color: tokens.textMuted, mb: 1 }}>No exam requests found</Typography>
          <Typography variant="body2" sx={{ color: tokens.textMuted }}>
            {statusFilter === 'pending' ? 'No pending exam requests to review' : 'No exam requests match your filters'}
          </Typography>
        </Paper>
      ) : (
        <Box>
          <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 3, border: `1px solid ${tokens.surfaceBorder}` }}>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                  <TableCell sx={{ fontWeight: 700, color: tokens.textSecondary, fontSize: 12 }}>Exam</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: tokens.textSecondary, fontSize: 12 }}>Student</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: tokens.textSecondary, fontSize: 12 }}>Teacher</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: tokens.textSecondary, fontSize: 12 }}>Organization</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: tokens.textSecondary, fontSize: 12 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: tokens.textSecondary, fontSize: 12 }}>Requested</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: tokens.textSecondary, fontSize: 12 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredRequests.map((request) => (
                  <TableRow key={request._id} sx={{ '&:hover': { bgcolor: '#F8FAFC' } }}>
                    <TableCell>
                      <Box>
                        <Typography variant="body2" fontWeight={600}>{request.exam?.title || 'Unknown Exam'}</Typography>
                        <Typography variant="caption" sx={{ color: tokens.textMuted }}>
                          {request.exam?.timeLimit ? `${request.exam.timeLimit} min` : 'No time limit'}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="body2" fontWeight={600}>{request.userInfo?.name || 'Unknown'}</Typography>
                        <Typography variant="caption" sx={{ color: tokens.textMuted }}>{request.userInfo?.email || 'No email'}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="body2" fontWeight={600}>
                          {request.teacher ? `${request.teacher.firstName} ${request.teacher.lastName}` : 'Unknown'}
                        </Typography>
                        <Typography variant="caption" sx={{ color: tokens.textMuted }}>{request.teacher?.email || 'No email'}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="body2" fontWeight={600}>{request.organization?.name || 'N/A'}</Typography>
                        <Typography variant="caption" sx={{ color: tokens.textMuted }}>{request.organization?.email || ''}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={request.status}
                        size="small"
                        sx={{
                          height: 24,
                          fontSize: 11,
                          fontWeight: 600,
                          bgcolor: request.status === 'pending' ? 'rgba(245,158,11,0.1)' :
                                 request.status === 'approved' ? 'rgba(12,189,115,0.1)' :
                                 'rgba(239,68,68,0.1)',
                          color: request.status === 'pending' ? tokens.warning :
                                 request.status === 'approved' ? tokens.accent :
                                 '#EF4444'
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" sx={{ color: tokens.textMuted }}>
                        {new Date(request.requestedAt).toLocaleDateString()}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {request.status === 'pending' && (
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <Tooltip title="Approve">
                            <IconButton
                              size="small"
                              onClick={() => setApproveDialog(request)}
                              sx={{ color: tokens.accent, bgcolor: 'rgba(12,189,115,0.1)', '&:hover': { bgcolor: 'rgba(12,189,115,0.2)' } }}
                            >
                              <CheckCircle fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Reject">
                            <IconButton
                              size="small"
                              onClick={() => setRejectDialog({ ...request, reason: '' })}
                              sx={{ color: '#EF4444', bgcolor: 'rgba(239,68,68,0.1)', '&:hover': { bgcolor: 'rgba(239,68,68,0.2)' } }}
                            >
                              <Block fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          
          {/* LAZY LOADING: Load More button */}
          {hasMore && !loading && (
            <Box sx={{ p: 2, textAlign: 'center' }}>
              <Button
                variant="outlined"
                onClick={loadMore}
                disabled={loadingMore}
                size="small"
                sx={{ borderRadius: 2 }}
              >
                {loadingMore ? 'Loading...' : 'Load More'}
              </Button>
            </Box>
          )}
        </Box>
      )}

      {/* Approve Dialog */}
      <Dialog open={!!approveDialog} onClose={() => setApproveDialog(null)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Approve Exam Request</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>
            Are you sure you want to approve this exam request for <b>{approveDialog?.userInfo?.name}</b>?
          </Typography>
          {approveDialog && (
            <Box sx={{ p: 2, bgcolor: '#F8FAFC', borderRadius: 2, mb: 2 }}>
              <Typography fontWeight={600}>{approveDialog.exam?.title}</Typography>
              <Typography variant="caption" sx={{ color: tokens.textMuted }}>
                Student: {approveDialog.userInfo?.email} • Organization: {approveDialog.organization?.name}
              </Typography>
            </Box>
          )}
          <Typography variant="body2" sx={{ color: tokens.textMuted }}>
            This will grant the student access to the exam and generate an access code.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setApproveDialog(null)} disabled={processing} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleApprove}
            disabled={processing}
            sx={{ borderRadius: 2, background: gradients.brand, textTransform: 'none', fontWeight: 700, px: 3 }}
          >
            {processing ? 'Approving...' : 'Approve Request'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={!!rejectDialog} onClose={() => setRejectDialog(null)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Reject Exam Request</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>
            Are you sure you want to reject this exam request for <b>{rejectDialog?.userInfo?.name}</b>?
          </Typography>
          {rejectDialog && (
            <Box sx={{ p: 2, bgcolor: '#F8FAFC', borderRadius: 2, mb: 2 }}>
              <Typography fontWeight={600}>{rejectDialog.exam?.title}</Typography>
              <Typography variant="caption" sx={{ color: tokens.textMuted }}>
                Student: {rejectDialog.userInfo?.email} • Organization: {rejectDialog.organization?.name}
              </Typography>
            </Box>
          )}
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Reason for rejection (optional)"
            value={rejectDialog?.reason || ''}
            onChange={(e) => setRejectDialog(d => ({ ...d, reason: e.target.value }))}
            sx={{ mt: 1, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setRejectDialog(null)} disabled={processing} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleReject}
            disabled={processing}
            sx={{ borderRadius: 2, bgcolor: '#EF4444', '&:hover': { bgcolor: '#DC2626' }, textTransform: 'none', fontWeight: 700, px: 3 }}
          >
            {processing ? 'Rejecting...' : 'Reject Request'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snack.open} autoHideDuration={3500} onClose={() => setSnack(s => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snack.severity}>{snack.message}</Alert>
      </Snackbar>
    </Box>
  );
}

/* ── STUDENT RESULTS ── */
function StudentResultsSection({ searchQuery }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('date');
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [selectedResult, setSelectedResult] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [resultDetails, setResultDetails] = useState(null);
  const [regradingIds, setRegradingIds] = useState(new Set());
  const [regradeMessage, setRegradeMessage] = useState(null);

  // Helper to get option display text (handles both string and object formats)
  const getOptionText = (opt) => {
    if (typeof opt === 'string') return opt;
    if (opt && typeof opt === 'object') return opt.text || opt.label || opt.value || '';
    return '';
  };

  // Helper to check if option is selected
  const isOptionSelected = (option, selectedAnswer) => {
    const optionText = getOptionText(option);
    const selectedText = getOptionText(selectedAnswer);
    return optionText === selectedText;
  };

  // Helper to check if option is correct
  const isOptionCorrect = (option, correctAnswer) => {
    const optionText = getOptionText(option);
    const correctText = getOptionText(correctAnswer);
    return optionText === correctText;
  };

  useEffect(() => {
    fetchResults();
  }, [page, rowsPerPage]);

  const fetchResults = async () => {
    setLoading(true);
    try {
      const response = await api.get('/superadmin/results', {
        params: { page, limit: rowsPerPage }
      });
      setResults(response.data.results || []);
    } catch (error) {
      console.error('Error fetching results:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (result) => {
    setSelectedResult(result);
    setDetailLoading(true);
    setResultDetails(null);
    setRegradeMessage(null);
    try {
      const response = await api.get(`/superadmin/results/${result._id}/details`);
      setResultDetails(response.data);
    } catch (error) {
      console.error('Error fetching result details:', error);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleRegrade = async (resultId) => {
    setRegradingIds(prev => new Set([...prev, resultId]));
    setRegradeMessage(null);
    try {
      const response = await api.post(`/admin/regrade-result/${resultId}`, {
        method: 'ai',
        forceRegrade: true
      }, {
        timeout: 300000 // 5 minutes timeout for regrade operations
      });
      setRegradeMessage({ type: 'success', text: 'Result regraded successfully!' });
      
      // Refresh the results and details
      await fetchResults();
      if (selectedResult) {
        await handleViewDetails(selectedResult);
      }
    } catch (error) {
      console.error('Error regrading result:', error);
      if (error.code === 'ECONNABORTED') {
        setRegradeMessage({ type: 'error', text: 'Regrade operation timed out. The backend is still processing. Please check the results later.' });
      } else {
        setRegradeMessage({ type: 'error', text: error.response?.data?.message || 'Failed to regrade result' });
      }
    } finally {
      setRegradingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(resultId);
        return newSet;
      });
    }
  };

  const filteredResults = results.filter(result => {
    const matchesSearch = !searchQuery || 
      result.student?.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      result.student?.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      result.student?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      result.exam?.title?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = filterStatus === 'all' || 
      (filterStatus === 'completed' && result.isCompleted) ||
      (filterStatus === 'incomplete' && !result.isCompleted);

    return matchesSearch && matchesStatus;
  }).sort((a, b) => {
    if (sortBy === 'date') {
      return new Date(b.createdAt) - new Date(a.createdAt);
    } else if (sortBy === 'score') {
      const scoreA = a.maxPossibleScore > 0 ? (a.totalScore / a.maxPossibleScore) * 100 : 0;
      const scoreB = b.maxPossibleScore > 0 ? (b.totalScore / b.maxPossibleScore) * 100 : 0;
      return scoreB - scoreA;
    } else if (sortBy === 'name') {
      return `${a.student?.firstName} ${a.student?.lastName}`.localeCompare(`${b.student?.firstName} ${b.student?.lastName}`);
    }
    return 0;
  });

  const getScoreColor = (percentage) => {
    if (percentage >= 70) return tokens.accent;
    if (percentage >= 50) return tokens.warning;
    return '#EF4444';
  };

  return (
    <Box>
      <SectionTitle>All Student Results</SectionTitle>

      {/* Filter Bar */}
      <Paper elevation={0} sx={{ p: 2, mb: 3, borderRadius: 3, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white' }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select label="Status" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} sx={{ borderRadius: 2, bgcolor: '#FAFBFC' }}>
                <MuiMenuItem value="all">All Status</MuiMenuItem>
                <MuiMenuItem value="completed">Completed</MuiMenuItem>
                <MuiMenuItem value="incomplete">In Progress</MuiMenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth size="small">
              <InputLabel>Sort By</InputLabel>
              <Select label="Sort By" value={sortBy} onChange={(e) => setSortBy(e.target.value)} sx={{ borderRadius: 2, bgcolor: '#FAFBFC' }}>
                <MuiMenuItem value="date">Most Recent</MuiMenuItem>
                <MuiMenuItem value="score">Highest Score</MuiMenuItem>
                <MuiMenuItem value="name">Student Name</MuiMenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={4}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" sx={{ color: tokens.textMuted, fontWeight: 600 }}>
                Total: {filteredResults.length} results
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Regrade Message */}
      {regradeMessage && (
        <Alert 
          severity={regradeMessage.type} 
          sx={{ mb: 3 }}
          onClose={() => setRegradeMessage(null)}
        >
          {regradeMessage.text}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress sx={{ color: tokens.accent }} />
        </Box>
      ) : filteredResults.length === 0 ? (
        <Paper elevation={0} sx={{ p: 4, borderRadius: 3, border: `1px dashed ${tokens.surfaceBorder}`, bgcolor: '#FAFBFC', textAlign: 'center' }}>
          <Assessment sx={{ fontSize: 64, color: tokens.textMuted, mb: 2 }} />
          <Typography sx={{ color: tokens.textMuted }}>No results found.</Typography>
        </Paper>
      ) : (
        <Paper elevation={0} sx={{ borderRadius: 3, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white' }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                  <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Student</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Email</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Exam</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Score</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Percentage</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredResults.map((result) => {
                  const percentage = result.maxPossibleScore > 0 
                    ? Math.round((result.totalScore / result.maxPossibleScore) * 100) 
                    : 0;
                  return (
                    <TableRow key={result._id} sx={{ '&:hover': { bgcolor: '#F8FAFC' } }}>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Person fontSize="small" sx={{ color: tokens.textMuted }} />
                          <Typography variant="body2" fontWeight={600}>
                            {result.student?.firstName} {result.student?.lastName}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Email fontSize="small" sx={{ color: tokens.textMuted }} />
                          <Typography variant="body2">{result.student?.email}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>{result.exam?.title}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>
                          {result.totalScore} / {result.maxPossibleScore}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={`${percentage}%`}
                          size="small"
                          sx={{
                            fontWeight: 700,
                            bgcolor: `${getScoreColor(percentage)}15`,
                            color: getScoreColor(percentage)
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={result.isCompleted ? 'Completed' : 'In Progress'}
                          size="small"
                          sx={{
                            fontWeight: 600,
                            bgcolor: result.isCompleted ? 'rgba(12,189,115,0.1)' : 'rgba(245,158,11,0.1)',
                            color: result.isCompleted ? tokens.accent : tokens.warning
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {new Date(result.createdAt).toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => handleViewDetails(result)}
                            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600, fontSize: 12 }}
                          >
                            View Details
                          </Button>
                          <Button
                            size="small"
                            variant="contained"
                            onClick={() => handleRegrade(result._id)}
                            disabled={regradingIds.has(result._id)}
                            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600, fontSize: 12, bgcolor: tokens.primary, '&:hover': { bgcolor: tokens.primary } }}
                          >
                            {regradingIds.has(result._id) ? 'Regrading...' : 'Regrade'}
                          </Button>
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
          
          {/* Pagination */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2 }}>
            <Typography variant="body2" sx={{ color: tokens.textMuted }}>
              Showing {Math.min(page * rowsPerPage, filteredResults.length)} of {filteredResults.length} results
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                size="small"
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                sx={{ borderRadius: 2 }}
              >
                Previous
              </Button>
              <Button
                size="small"
                disabled={filteredResults.length < rowsPerPage}
                onClick={() => setPage(p => p + 1)}
                sx={{ borderRadius: 2 }}
              >
                Next
              </Button>
            </Box>
          </Box>
        </Paper>
      )}

      {/* Result Details Dialog */}
      <Dialog 
        open={!!selectedResult} 
        onClose={() => setSelectedResult(null)} 
        maxWidth="md" 
        fullWidth 
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h6">Result Details</Typography>
            <Typography variant="caption" sx={{ color: tokens.textMuted }}>
              {selectedResult?.student?.firstName} {selectedResult?.student?.lastName} - {selectedResult?.exam?.title}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              size="small"
              variant="contained"
              onClick={() => handleRegrade(selectedResult?._id)}
              disabled={regradingIds.has(selectedResult?._id)}
              sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600, fontSize: 12, bgcolor: tokens.primary, '&:hover': { bgcolor: tokens.primary } }}
            >
              {regradingIds.has(selectedResult?._id) ? 'Regrading...' : 'Regrade'}
            </Button>
            <IconButton onClick={() => setSelectedResult(null)}>
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {detailLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress sx={{ color: tokens.accent }} />
            </Box>
          ) : resultDetails ? (
            <Box>
              {/* Summary */}
              <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: 2, bgcolor: '#F8FAFC' }}>
                <Grid container spacing={2}>
                  <Grid item xs={6} md={3}>
                    <Typography variant="body2" sx={{ color: tokens.textMuted, fontWeight: 600 }}>Total Score</Typography>
                    <Typography variant="h5" fontWeight={700} sx={{ color: tokens.primary }}>
                      {resultDetails.totalScore} / {resultDetails.maxPossibleScore}
                    </Typography>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Typography variant="body2" sx={{ color: tokens.textMuted, fontWeight: 600 }}>Percentage</Typography>
                    <Typography variant="h5" fontWeight={700} sx={{ color: getScoreColor(Math.round((resultDetails.totalScore / resultDetails.maxPossibleScore) * 100)) }}>
                      {Math.round((resultDetails.totalScore / resultDetails.maxPossibleScore) * 100)}%
                    </Typography>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Typography variant="body2" sx={{ color: tokens.textMuted, fontWeight: 600 }}>Questions</Typography>
                    <Typography variant="h5" fontWeight={700} sx={{ color: tokens.primary }}>
                      {resultDetails.answers?.length || 0}
                    </Typography>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Typography variant="body2" sx={{ color: tokens.textMuted, fontWeight: 600 }}>Duration</Typography>
                    <Typography variant="h5" fontWeight={700} sx={{ color: tokens.primary }}>
                      {resultDetails.duration || 'N/A'}
                    </Typography>
                  </Grid>
                </Grid>
              </Paper>

              {/* Questions and Answers */}
              <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>Questions & Answers</Typography>
              {resultDetails.answers?.map((answer, index) => {
                const question = answer.question;
                const questionText = question?.text || answer.questionText || 'Question text not available';
                const questionType = question?.type || answer.questionType || 'multiple-choice';
                const options = question?.options || answer.options || [];
                const correctAnswer = question?.correctAnswer || answer.correctAnswer;
                const selectedAnswer = answer.selectedAnswer;

                return (
                  <Paper key={index} elevation={0} sx={{ p: 3, mb: 2, borderRadius: 2, border: `1px solid ${tokens.surfaceBorder}` }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                      <Typography variant="body1" fontWeight={600} sx={{ flex: 1 }}>
                        Q{index + 1}. {questionText}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip
                          label={`${answer.score || 0} pts`}
                          size="small"
                          sx={{
                            fontWeight: 600,
                            bgcolor: 'rgba(59,130,246,0.1)',
                            color: '#3B82F6'
                          }}
                        />
                        <Chip
                          label={answer.isCorrect ? 'Correct' : 'Incorrect'}
                          size="small"
                          sx={{
                            fontWeight: 600,
                            bgcolor: answer.isCorrect ? 'rgba(12,189,115,0.1)' : 'rgba(239,68,68,0.1)',
                            color: answer.isCorrect ? tokens.accent : '#EF4444'
                          }}
                        />
                      </Box>
                    </Box>

                  {questionType === 'multiple-choice' && options.length > 0 && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="body2" sx={{ color: tokens.textMuted, fontWeight: 600, mb: 1 }}>Options:</Typography>
                      {options.map((option, optIndex) => {
                        const isSelected = isOptionSelected(option, selectedAnswer);
                        const isCorrect = isOptionCorrect(option, correctAnswer);
                        const optionText = getOptionText(option);
                        const optionLetter = String.fromCharCode(65 + optIndex);
                        return (
                          <Box
                            key={optIndex}
                            sx={{
                              p: 1.5,
                              mb: 1,
                              borderRadius: 1,
                              bgcolor: isSelected
                                ? (answer.isCorrect ? 'rgba(12,189,115,0.1)' : 'rgba(239,68,68,0.1)')
                                : isCorrect
                                ? 'rgba(12,189,115,0.05)'
                                : '#F8FAFC',
                              border: isSelected
                                ? `1px solid ${answer.isCorrect ? tokens.accent : '#EF4444'}`
                                : isCorrect
                                ? `1px solid ${tokens.accent}33`
                                : '1px solid transparent',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1
                            }}
                          >
                            {isSelected && <CheckCircle fontSize="small" sx={{ color: answer.isCorrect ? tokens.accent : '#EF4444' }} />}
                            {isCorrect && !isSelected && <CheckCircle fontSize="small" sx={{ color: tokens.accent, opacity: 0.5 }} />}
                            <Typography variant="body2" fontWeight="600" sx={{ minWidth: 20 }}>{optionLetter}.</Typography>
                            <Typography variant="body2">{optionText}</Typography>
                          </Box>
                        );
                      })}
                    </Box>
                  )}

                  {questionType === 'true-false' && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="body2" sx={{ color: tokens.textMuted, fontWeight: 600, mb: 1 }}>Your Answer:</Typography>
                      <Chip
                        label={selectedAnswer}
                        size="small"
                        sx={{
                          bgcolor: answer.isCorrect ? 'rgba(12,189,115,0.1)' : 'rgba(239,68,68,0.1)',
                          color: answer.isCorrect ? tokens.accent : '#EF4444',
                          fontWeight: 600
                        }}
                      />
                    </Box>
                  )}

                  {questionType === 'short-answer' && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="body2" sx={{ color: tokens.textMuted, fontWeight: 600, mb: 1 }}>Your Answer:</Typography>
                      <Paper elevation={0} sx={{ p: 2, bgcolor: '#F8FAFC', borderRadius: 1 }}>
                        <Typography variant="body2">{selectedAnswer || 'No answer provided'}</Typography>
                      </Paper>
                      {correctAnswer && (
                        <Box sx={{ mt: 1 }}>
                          <Typography variant="body2" sx={{ color: tokens.textMuted, fontWeight: 600, mb: 0.5 }}>Correct Answer:</Typography>
                          <Typography variant="body2" sx={{ color: tokens.accent }}>{correctAnswer}</Typography>
                        </Box>
                      )}
                    </Box>
                  )}

                  {questionType === 'matching' && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="body2" sx={{ color: tokens.textMuted, fontWeight: 600, mb: 1 }}>Your Answer:</Typography>
                      <Paper elevation={0} sx={{ p: 2, bgcolor: '#F8FAFC', borderRadius: 1 }}>
                        {answer?.matchingAnswers && answer.matchingAnswers.length > 0 ? (
                          <Typography variant="body2">
                            {answer.matchingAnswers.map((match, idx) => (
                              <span key={idx}>Match {idx + 1}: Item {match.left + 1} → Item {match.right + 1}<br /></span>
                            ))}
                          </Typography>
                        ) : (
                          <Typography variant="body2">No matching answer provided</Typography>
                        )}
                      </Paper>
                    </Box>
                  )}

                  {questionType === 'fill-in-blank' && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="body2" sx={{ color: tokens.textMuted, fontWeight: 600, mb: 1 }}>Your Answer:</Typography>
                      <Paper elevation={0} sx={{ p: 2, bgcolor: '#F8FAFC', borderRadius: 1 }}>
                        <Typography variant="body2">{selectedAnswer || 'No answer provided'}</Typography>
                      </Paper>
                      {correctAnswer && (
                        <Box sx={{ mt: 1 }}>
                          <Typography variant="body2" sx={{ color: tokens.textMuted, fontWeight: 600, mb: 0.5 }}>Correct Answer:</Typography>
                          <Typography variant="body2" sx={{ color: tokens.accent }}>{correctAnswer}</Typography>
                        </Box>
                      )}
                    </Box>
                  )}

                  {questionType === 'open-ended' && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="body2" sx={{ color: tokens.textMuted, fontWeight: 600, mb: 1 }}>Your Answer:</Typography>
                      <Paper elevation={0} sx={{ p: 2, bgcolor: '#F8FAFC', borderRadius: 1 }}>
                        <Typography variant="body2">{selectedAnswer || 'No answer provided'}</Typography>
                      </Paper>
                      {answer?.feedback && (
                        <Box sx={{ mt: 2 }}>
                          <Typography variant="body2" sx={{ color: tokens.textMuted, fontWeight: 600, mb: 1 }}>AI Feedback:</Typography>
                          <Paper elevation={0} sx={{ p: 2, bgcolor: 'rgba(59,130,246,0.05)', borderRadius: 1 }}>
                            <Typography variant="body2">{answer.feedback}</Typography>
                          </Paper>
                        </Box>
                      )}
                      {answer?.conceptsPresent && answer.conceptsPresent.length > 0 && (
                        <Box sx={{ mt: 2 }}>
                          <Typography variant="body2" sx={{ color: tokens.textMuted, fontWeight: 600, mb: 1 }}>Key Concepts Covered:</Typography>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {answer.conceptsPresent.map((concept, idx) => (
                              <Chip key={idx} label={concept} size="small" sx={{ bgcolor: 'rgba(12,189,115,0.1)', color: tokens.accent }} />
                            ))}
                          </Box>
                        </Box>
                      )}
                      {answer?.conceptsMissing && answer.conceptsMissing.length > 0 && (
                        <Box sx={{ mt: 2 }}>
                          <Typography variant="body2" sx={{ color: tokens.textMuted, fontWeight: 600, mb: 1 }}>Concepts to Improve:</Typography>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {answer.conceptsMissing.map((concept, idx) => (
                              <Chip key={idx} label={concept} size="small" sx={{ bgcolor: 'rgba(239,68,68,0.1)', color: '#EF4444' }} />
                            ))}
                          </Box>
                        </Box>
                      )}
                    </Box>
                  )}

                  {answer?.feedback && questionType !== 'open-ended' && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="body2" sx={{ color: tokens.textMuted, fontWeight: 600, mb: 1 }}>Feedback:</Typography>
                      <Paper elevation={0} sx={{ p: 2, bgcolor: answer.isCorrect ? 'rgba(12,189,115,0.05)' : 'rgba(59,130,246,0.05)', borderRadius: 1 }}>
                        <Typography variant="body2">{answer.feedback}</Typography>
                      </Paper>
                    </Box>
                  )}

                  {(answer?.subQuestionAnswers && answer.subQuestionAnswers.length > 0) && (
                    <Box sx={{ mt: 2, p: 2, bgcolor: '#F8FAFC', borderRadius: 1 }}>
                      <Typography variant="body2" sx={{ color: tokens.textMuted, fontWeight: 600, mb: 1 }}>Sub-Questions:</Typography>
                      {answer.subQuestionAnswers.map((subAnswer, subIdx) => {
                        const subResult = answer.subQuestionResults?.[subIdx];
                        const isCorrect = subResult?.isCorrect;
                        return (
                          <Box key={subIdx} sx={{ p: 1.5, mb: 1, bgcolor: 'white', borderRadius: 1, borderLeft: '3px solid', borderColor: isCorrect ? tokens.accent : '#EF4444' }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <Typography variant="body2" fontWeight="600" sx={{ flex: 1 }}>
                                Part {subIdx + 1}
                              </Typography>
                              {subResult && (
                                <Chip
                                  label={`${subResult.score}/${subResult.maxPoints || 1}`}
                                  size="small"
                                  sx={{
                                    fontWeight: 600,
                                    bgcolor: isCorrect ? 'rgba(12,189,115,0.1)' : 'rgba(239,68,68,0.1)',
                                    color: isCorrect ? tokens.accent : '#EF4444'
                                  }}
                                />
                              )}
                            </Box>
                            {subAnswer?.answered ? (
                              <Box sx={{ mt: 1 }}>
                                <Typography variant="body2" sx={{ color: tokens.textMuted }}>
                                  Your answer: {subAnswer.selectedOption || subAnswer.textAnswer || 'Answered'}
                                </Typography>
                                {subResult && !isCorrect && subResult.correctedAnswer && (
                                  <Typography variant="body2" sx={{ color: tokens.accent, mt: 0.5 }}>
                                    Correct answer: {subResult.correctedAnswer}
                                  </Typography>
                                )}
                                {subResult && subResult.feedback && (
                                  <Typography variant="body2" sx={{ mt: 0.5, fontStyle: 'italic' }}>
                                    {subResult.feedback}
                                  </Typography>
                                )}
                              </Box>
                            ) : (
                              <Typography variant="body2" sx={{ color: '#EF4444', mt: 1 }}>
                                Not answered
                              </Typography>
                            )}
                          </Box>
                        );
                      })}
                    </Box>
                  )}

                  {answer.marksObtained !== undefined && (
                    <Box sx={{ mt: 2, pt: 2, borderTop: `1px solid ${tokens.surfaceBorder}` }}>
                      <Typography variant="body2" sx={{ color: tokens.textMuted }}>
                        Marks: <strong>{answer.marksObtained}</strong> / {question?.marks || 0}
                      </Typography>
                    </Box>
                  )}
                </Paper>
                );
              })}
            </Box>
          ) : (
            <Typography sx={{ color: tokens.textMuted, textAlign: 'center', py: 4 }}>
              No details available
            </Typography>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}

/* ── RECLAMATIONS ── */
function ReclamationsSection({ searchQuery }) {
  const [reclamations, setReclamations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReclamation, setSelectedReclamation] = useState(null);
  const [responseDialogOpen, setResponseDialogOpen] = useState(false);
  const [responseText, setResponseText] = useState('');
  const [responseStatus, setResponseStatus] = useState('resolved');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchReclamations();
  }, []);

  const fetchReclamations = async () => {
    try {
      setLoading(true);
      const res = await api.get('/reclamations');
      setReclamations(res.data);
    } catch (err) {
      console.error('Error fetching reclamations:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRespond = async () => {
    if (!responseText.trim()) return;
    setSubmitting(true);
    try {
      await api.put(`/reclamations/${selectedReclamation._id}/respond`, {
        response: responseText,
        status: responseStatus
      });
      setResponseDialogOpen(false);
      setResponseText('');
      setResponseStatus('resolved');
      setSelectedReclamation(null);
      fetchReclamations();
    } catch (err) {
      console.error('Error responding to reclamation:', err);
      alert('Failed to submit response');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return '#F59E0B';
      case 'under-review': return '#3B82F6';
      case 'resolved': return '#10B981';
      case 'rejected': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return '#EF4444';
      case 'medium': return '#F59E0B';
      case 'low': return '#10B981';
      default: return '#6B7280';
    }
  };

  const filteredReclamations = reclamations.filter(r =>
    !searchQuery || 
    r.student?.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.student?.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.exam?.title?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Box>
      <SectionTitle>Student Reclamations</SectionTitle>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : filteredReclamations.length === 0 ? (
        <Paper elevation={0} sx={{ p: 4, borderRadius: 3, textAlign: 'center', border: `1px solid ${tokens.surfaceBorder}` }}>
          <ReportProblem sx={{ fontSize: 48, color: tokens.textMuted, mb: 2 }} />
          <Typography variant="h6" color="text.secondary">No reclamations found</Typography>
        </Paper>
      ) : (
        <Grid container spacing={2}>
          {filteredReclamations.map((reclamation) => (
            <Grid item xs={12} md={6} key={reclamation._id}>
              <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2.5, border: `1px solid ${tokens.surfaceBorder}`, cursor: 'pointer', '&:hover': { borderColor: tokens.primary } }}
                onClick={() => setSelectedReclamation(reclamation)}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Avatar sx={{ width: 32, height: 32, bgcolor: tokens.primary }}>
                      {reclamation.student?.firstName?.[0] || '?'}
                    </Avatar>
                    <Box>
                      <Typography variant="body2" fontWeight={600}>
                        {reclamation.student?.firstName} {reclamation.student?.lastName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {reclamation.exam?.title}
                      </Typography>
                    </Box>
                  </Box>
                  <Chip label={reclamation.status} size="small" sx={{ bgcolor: `${getStatusColor(reclamation.status)}20`, color: getStatusColor(reclamation.status), fontWeight: 600 }} />
                </Box>
                <Typography variant="body2" sx={{ mb: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {reclamation.claim}
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Chip label={reclamation.category} size="small" variant="outlined" sx={{ fontSize: 10 }} />
                    <Chip label={reclamation.priority} size="small" sx={{ bgcolor: `${getPriorityColor(reclamation.priority)}20`, color: getPriorityColor(reclamation.priority), fontSize: 10 }} />
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {new Date(reclamation.createdAt).toLocaleDateString()}
                  </Typography>
                </Box>
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Reclamation Detail Dialog */}
      <Dialog open={!!selectedReclamation} onClose={() => setSelectedReclamation(null)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Reclamation Details</DialogTitle>
        <DialogContent>
          {selectedReclamation && (
            <Box>
              <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <Avatar sx={{ width: 48, height: 48, bgcolor: tokens.primary }}>
                  {selectedReclamation.student?.firstName?.[0] || '?'}
                </Avatar>
                <Box>
                  <Typography variant="h6" fontWeight={600}>
                    {selectedReclamation.student?.firstName} {selectedReclamation.student?.lastName}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {selectedReclamation.student?.email}
                  </Typography>
                </Box>
              </Box>

              <Paper elevation={0} sx={{ p: 2, mb: 2, bgcolor: '#F8FAFC', borderRadius: 2 }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>Exam</Typography>
                <Typography variant="body2" fontWeight={600}>{selectedReclamation.exam?.title}</Typography>
              </Paper>

              <Paper elevation={0} sx={{ p: 2, mb: 2, bgcolor: '#F8FAFC', borderRadius: 2 }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>Claim</Typography>
                <Typography variant="body2">{selectedReclamation.claim}</Typography>
              </Paper>

              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <Chip label={selectedReclamation.category} size="small" />
                <Chip label={selectedReclamation.priority} size="small" sx={{ bgcolor: `${getPriorityColor(selectedReclamation.priority)}20`, color: getPriorityColor(selectedReclamation.priority) }} />
                <Chip label={selectedReclamation.status} size="small" sx={{ bgcolor: `${getStatusColor(selectedReclamation.status)}20`, color: getStatusColor(selectedReclamation.status) }} />
              </Box>

              {selectedReclamation.response && (
                <Paper elevation={0} sx={{ p: 2, mb: 2, bgcolor: '#ECFDF5', borderRadius: 2, border: '1px solid #10B981' }}>
                  <Typography variant="caption" color="#065F46" sx={{ display: 'block', mb: 0.5 }}>Response</Typography>
                  <Typography variant="body2">{selectedReclamation.response}</Typography>
                  {selectedReclamation.respondedBy && (
                    <Typography variant="caption" color="#065F46" sx={{ mt: 1, display: 'block' }}>
                      Responded by: {selectedReclamation.respondedBy.firstName} {selectedReclamation.respondedBy.lastName}
                    </Typography>
                  )}
                </Paper>
              )}

              <Typography variant="caption" color="text.secondary">
                Submitted on {new Date(selectedReclamation.createdAt).toLocaleString()}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedReclamation(null)}>Close</Button>
          {!selectedReclamation?.response && (
            <Button variant="contained" onClick={() => { setResponseDialogOpen(true); setResponseStatus(selectedReclamation.status === 'pending' ? 'under-review' : 'resolved'); }}>
              Respond
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Response Dialog */}
      <Dialog open={responseDialogOpen} onClose={() => setResponseDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Respond to Reclamation</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Status</InputLabel>
            <Select value={responseStatus} onChange={(e) => setResponseStatus(e.target.value)} label="Status">
              <MenuItem value="under-review">Under Review</MenuItem>
              <MenuItem value="resolved">Resolved</MenuItem>
              <MenuItem value="rejected">Rejected</MenuItem>
            </Select>
          </FormControl>
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Your Response"
            value={responseText}
            onChange={(e) => setResponseText(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResponseDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleRespond} disabled={!responseText.trim() || submitting}>
            {submitting ? 'Submitting...' : 'Submit Response'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
