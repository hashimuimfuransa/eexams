import { useState, useEffect } from 'react';
import {
  Box, Typography, Chip, Button, Paper, Grid, TextField,
  CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  useMediaQuery, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, LinearProgress, IconButton, Tooltip,
  Select, FormControl, InputLabel, MenuItem as MuiMenuItem, Avatar
} from '@mui/material';
import {
  Dashboard as DashIcon, Business, People, Settings, AttachMoney,
  SupervisorAccount, School, TrendingUp,
  CheckCircle, Block, Edit, Add, ArrowForward, Delete, InfoOutlined, Close
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { tokens, gradients, planColors as PLAN_COLORS } from './dashboardTokens';
import { DashboardShell, Sidebar, Topbar, SectionTitle, getDynamicGreeting } from './DashboardShell';

const nav = [
  { id: 'home',          label: 'Overview',                icon: <DashIcon sx={{ fontSize: 20 }} /> },
  { id: 'organizations', label: 'Organizations & Teachers', icon: <Business sx={{ fontSize: 20 }} /> },
  { id: 'users',         label: 'All Users',               icon: <People sx={{ fontSize: 20 }} /> },
  { id: 'subscriptions', label: 'Subscriptions',             icon: <AttachMoney sx={{ fontSize: 20 }} /> },
  { id: 'analytics',     label: 'Analytics',               icon: <TrendingUp sx={{ fontSize: 20 }} /> },
  { id: 'settings',      label: 'Settings',                icon: <Settings sx={{ fontSize: 20 }} /> },
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

  useEffect(() => {
    api.get('/superadmin/dashboard-stats').then(r => setStats(r.data)).catch(() => setStats({})).finally(() => setStatsLoading(false));
  }, []);

  return (
    <DashboardShell
      sidebarEl={<Sidebar user={user} logout={logout} activeSection={activeSection} setActiveSection={setActiveSection} onClose={() => setSidebarOpen(false)} isMobile={isMobile} nav={nav} portalLabel="Super Admin" />}
      topbarEl={<Topbar greeting={getDynamicGreeting(user?.firstName || 'Admin')} sub="Platform-wide activity and management" user={user} onMenuClick={() => setSidebarOpen(v => !v)} onLogout={logout} roleLabel="Super Admin" />}
      sidebarOpen={sidebarOpen} isMobile={isMobile} onCloseSidebar={() => setSidebarOpen(false)}>
      {activeSection === 'home'          && <OverviewSection stats={stats} statsLoading={statsLoading} />}
      {activeSection === 'organizations' && <OrganizationsSection />}
      {activeSection === 'users'         && <AllUsersSection />}
      {activeSection === 'subscriptions' && <SubscriptionsSection stats={stats} />}
      {activeSection === 'analytics'     && <AnalyticsSection stats={stats} />}
      {activeSection === 'settings'      && <SettingsSection user={user} />}
    </DashboardShell>
  );
}

/* ── OVERVIEW ── */
function OverviewSection({ stats, statsLoading }) {
  const [orgs, setOrgs] = useState([]);
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  useEffect(() => { api.get('/superadmin/organizations').then(r => setOrgs((r.data||[]).slice(0,5))).catch(()=>{}).finally(()=>setLoadingOrgs(false)); }, []);

  const planData = [
    { plan:'Free',       color: PLAN_COLORS.free,       count: stats?.planBreakdown?.free ?? 0 },
    { plan:'Basic',      color: PLAN_COLORS.basic,      count: stats?.planBreakdown?.basic ?? 0 },
    { plan:'Premium',    color: PLAN_COLORS.premium,    count: stats?.planBreakdown?.premium ?? 0 },
    { plan:'Enterprise', color: PLAN_COLORS.enterprise, count: stats?.planBreakdown?.enterprise ?? 0 },
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
            <SectionTitle action={<Button size="small" sx={{color:tokens.accent,fontWeight:700,fontSize:12,textTransform:'none'}}>View All</Button>}>Recent Organizations</SectionTitle>
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

  useEffect(()=>{api.get('/superadmin/organizations').then(r=>setAllOrgs(r.data||[])).finally(()=>setLoading(false));},[]);

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
    if (typeFilter === 'organization') return o.role === 'admin' || o.role === 'superadmin';
    if (typeFilter === 'individual') return o.role === 'teacher' && o.userType === 'individual';
    return true;
  });

  const organizations = filterOrgs(filteredAllOrgs.filter(o => o.role === 'admin' || o.role === 'superadmin'));
  const individuals = filterOrgs(filteredAllOrgs.filter(o => o.role === 'teacher' && o.userType === 'individual'));

  const handleOpen=(o)=>{setSelected(o);setPlan(o.subscriptionPlan||'free');setStatus(o.subscriptionStatus||'pending');};
  const handleSave=async()=>{
    setSaving(true);
    try{await api.put(`/superadmin/organizations/${selected._id}/subscription`,{subscriptionPlan:plan,subscriptionStatus:status});setAllOrgs(p=>p.map(o=>o._id===selected._id?{...o,subscriptionPlan:plan,subscriptionStatus:status}:o));setSelected(null);}
    catch{}finally{setSaving(false);}
  };
  const handleToggle=async(o)=>{
    try{await api.put(`/superadmin/organizations/${o._id}/toggle-block`);setAllOrgs(p=>p.map(x=>x._id===o._id?{...x,isBlocked:!x.isBlocked}:x));}catch{}
  };

  const StatBadge = ({ icon, value, label, color }) => (
    <Box sx={{display:'flex',alignItems:'center',gap:0.75,bgcolor:`${color}15`,px:1.5,py:0.5,borderRadius:2}}>
      {icon}
      <Typography variant="caption" fontWeight={700} sx={{color}}>{value}</Typography>
      <Typography variant="caption" sx={{color:tokens.textMuted,fontSize:'10px'}}>{label}</Typography>
    </Box>
  );

  const renderOrgCards = (data, title, isOrg) => (
    <Box sx={{mb:4}}>
      <Box sx={{display:'flex',alignItems:'center',gap:1.5,mb:2}}>
        {isOrg ? <Business sx={{color:tokens.primary,fontSize:22}}/> : <SupervisorAccount sx={{color:tokens.accent,fontSize:22}}/>}
        <Typography variant="h6" fontWeight={700} sx={{color:tokens.textPrimary,fontFamily:"'DM Sans',sans-serif"}}>
          {title}
        </Typography>
        <Chip label={data.length} size="small" sx={{bgcolor:isOrg?`${tokens.primary}15`:`${tokens.accent}15`,color:isOrg?tokens.primary:tokens.accent,fontWeight:700,ml:1}}/>
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
                      background:isSuper?gradients.brand:(isOrg?`linear-gradient(135deg,${tokens.primary}20,${tokens.primary}40)`:`linear-gradient(135deg,${tokens.accent}20,${tokens.accent}40)`),
                      color:isSuper?'white':(isOrg?tokens.primary:tokens.accent)
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
        hasActiveFilters && (
          <Button size="small" onClick={clearFilters} sx={{color:tokens.textMuted,textTransform:'none',fontWeight:600}}>
            Clear Filters
          </Button>
        )
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

  const filtered=users.filter(u=>`${u.firstName} ${u.lastName} ${u.email} ${u.organization||''}`.toLowerCase().includes(search.toLowerCase()));

  return(
    <Box>
      <SectionTitle action={
        <Box sx={{display:'flex',gap:1}}>
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
    </Box>
  );
}

function SubscriptionsSection({ stats }) {
  const [activeTab, setActiveTab] = useState('pending_users'); // 'plans', 'requests', 'all', 'pending_users'
  const [requests, setRequests] = useState([]);
  const [allSubs, setAllSubs] = useState([]);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [approvalNote, setApprovalNote] = useState('');
  const [processing, setProcessing] = useState(false);
  const [actionUser, setActionUser] = useState(null); // {user, action: 'approve'|'reject'|'delete'}

  const plans=[
    {name:'Free',price:'0 RWF/mo',key:'free',features:['5 exams/month','Basic AI','30 students max']},
    {name:'Basic',price:'9,000 RWF/mo',key:'basic',features:['30 exams/month','Full AI','200 students','Analytics']},
    {name:'Premium',price:'29,000 RWF/mo',key:'premium',features:['Unlimited exams','Advanced AI','Unlimited students','Priority support']},
    {name:'Enterprise',price:'Custom',key:'enterprise',features:['Everything in Premium','Unlimited teachers','White-label & custom branding','API access','Dedicated account manager','Custom integrations','SLA guarantee','On-premise option','Bulk student import','Multi-school management']},
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
    if (activeTab === 'requests') {
      fetchRequests();
    } else if (activeTab === 'all') {
      fetchAllSubscriptions();
    } else if (activeTab === 'pending_users') {
      fetchPendingUsers();
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

  const handleApproveUser = async () => {
    if (!actionUser) return;
    setProcessing(true);
    try {
      await api.put(`/superadmin/users/${actionUser.user._id}`, { subscriptionStatus: 'active' });
      setPendingUsers(prev => prev.filter(u => u._id !== actionUser.user._id));
      setActionUser(null);
    } catch (err) { console.error('Approve failed:', err); }
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

  const handleDeleteUser = async () => {
    if (!actionUser) return;
    setProcessing(true);
    try {
      await api.delete(`/superadmin/users/${actionUser.user._id}`);
      setPendingUsers(prev => prev.filter(u => u._id !== actionUser.user._id));
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

  return(
    <Box>
      {/* Tabs */}
      <Box sx={{display:'flex',gap:1,mb:3}}>
        {[
          {id:'pending_users',label:'Pending Approvals',icon:'🕐',badge:pendingUsersCount},
          {id:'plans',label:'Plans Overview',icon:'📊'},
          {id:'requests',label:'Payment Requests',icon:'⏳',badge:pendingCount},
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
                      <Chip label="Pending" size="small" sx={{bgcolor:'rgba(245,158,11,0.1)',color:'#B45309',fontWeight:700,fontSize:11}}/>
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

          {/* Action confirmation dialog */}
          <Dialog open={Boolean(actionUser)} onClose={() => setActionUser(null)} maxWidth="xs" fullWidth PaperProps={{sx:{borderRadius:3}}}>
            <DialogTitle sx={{fontWeight:700,fontFamily:"'DM Sans',sans-serif",pb:1}}>
              {actionUser?.action === 'approve' && '✅ Approve Account'}
              {actionUser?.action === 'reject'  && '❌ Reject Account'}
              {actionUser?.action === 'delete'  && '🗑️ Delete Account'}
              <Typography variant="caption" sx={{color:tokens.textMuted,display:'block',mt:0.5}}>
                {actionUser?.user?.firstName} {actionUser?.user?.lastName} — {actionUser?.user?.subscriptionPlan} plan
              </Typography>
            </DialogTitle>
            <DialogContent sx={{pt:'16px !important'}}>
              {actionUser?.action === 'approve' && (
                <Box sx={{p:2,bgcolor:'#F0FDF4',borderRadius:2,border:'1px solid #86EFAC'}}>
                  <Typography variant="body2" sx={{color:'#166534'}}>This will set the account to <b>active</b> and grant the user access to their dashboard.</Typography>
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
            </DialogContent>
            <DialogActions sx={{px:3,pb:2.5,gap:1}}>
              <Button onClick={() => setActionUser(null)} sx={{borderRadius:2,textTransform:'none',fontWeight:600}}>Cancel</Button>
              <Button variant="contained" disabled={processing}
                onClick={actionUser?.action === 'approve' ? handleApproveUser : actionUser?.action === 'reject' ? handleRejectUser : handleDeleteUser}
                sx={{
                  borderRadius:2,textTransform:'none',fontWeight:700,px:3,
                  bgcolor: actionUser?.action === 'approve' ? tokens.accent : actionUser?.action === 'reject' ? '#F59E0B' : '#EF4444',
                  '&:hover':{ bgcolor: actionUser?.action === 'approve' ? '#0AAE5E' : actionUser?.action === 'reject' ? '#D97706' : '#DC2626' }
                }}
              >
                {processing ? 'Processing...' : `Confirm ${actionUser?.action === 'approve' ? 'Approval' : actionUser?.action === 'reject' ? 'Rejection' : 'Delete'}`}
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
          {loading ? (
            <Box sx={{display:'flex',justifyContent:'center',mt:6}}><CircularProgress sx={{color:tokens.accent}}/></Box>
          ) : (
            <Paper elevation={0} sx={{borderRadius:3,border:`1px solid ${tokens.surfaceBorder}`,bgcolor:'white',overflow:'hidden'}}>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow sx={{bgcolor:'#F8FAFC'}}>
                      <TableCell sx={{fontWeight:700,color:tokens.textSecondary,fontSize:12}}>User/Organization</TableCell>
                      <TableCell sx={{fontWeight:700,color:tokens.textSecondary,fontSize:12}}>Plan</TableCell>
                      <TableCell sx={{fontWeight:700,color:tokens.textSecondary,fontSize:12}}>Status</TableCell>
                      <TableCell sx={{fontWeight:700,color:tokens.textSecondary,fontSize:12}}>Started</TableCell>
                      <TableCell sx={{fontWeight:700,color:tokens.textSecondary,fontSize:12}}>Expires</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {allSubs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} align="center" sx={{py:5,color:tokens.textMuted}}>No active subscriptions found.</TableCell>
                      </TableRow>
                    ) : (
                      allSubs.map(sub => (
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
                              label={sub.plan} 
                              size="small"
                              sx={{bgcolor:`${PLAN_COLORS[sub.plan]}15`,color:PLAN_COLORS[sub.plan],fontWeight:600,textTransform:'capitalize'}}
                            />
                          </TableCell>
                          <TableCell>
                            <Chip 
                              label={sub.status} 
                              size="small"
                              sx={{
                                bgcolor:sub.status==='active'?'rgba(12,189,115,0.1)':'rgba(245,158,11,0.1)',
                                color:sub.status==='active'?tokens.accentDark:tokens.warning,
                                fontWeight:600
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{color:tokens.textMuted}}>
                              {new Date(sub.startDate).toLocaleDateString()}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{color:tokens.textMuted}}>
                              {sub.endDate ? new Date(sub.endDate).toLocaleDateString() : '—'}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))
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
  return(
    <Box>
      <SectionTitle>Platform Analytics</SectionTitle>
      <Grid container spacing={2} sx={{mb:3}}>
        {[
          {label:'Organizations',value:stats?.totalOrganizations??0,icon:<Business sx={{color:tokens.primary,fontSize:24}}/>,bg:'rgba(13,64,108,0.1)'},
          {label:'Teachers',value:stats?.totalTeachers??0,icon:<SupervisorAccount sx={{color:tokens.accent,fontSize:24}}/>,bg:'rgba(12,189,115,0.1)'},
          {label:'Students',value:stats?.totalStudents??0,icon:<People sx={{color:tokens.warning,fontSize:24}}/>,bg:'rgba(245,158,11,0.1)'},
          {label:'Total Exams',value:stats?.totalExams??0,icon:<School sx={{color:'#6366F1',fontSize:24}}/>,bg:'rgba(99,102,241,0.1)'},
        ].map((c,i)=>(
          <Grid item xs={6} md={3} key={i}>
            <Paper elevation={0} sx={{p:2.5,borderRadius:3,bgcolor:'white',border:`1px solid ${tokens.surfaceBorder}`,display:'flex',alignItems:'center',gap:2,'&:hover':{boxShadow:'0 6px 24px rgba(13,64,108,0.09)'}}}>
              <Box sx={{width:48,height:48,borderRadius:2.5,bgcolor:c.bg,display:'flex',alignItems:'center',justifyContent:'center'}}>{c.icon}</Box>
              <Box><Typography variant="h5" fontWeight={800} sx={{fontFamily:"'DM Sans',sans-serif"}}>{c.value}</Typography><Typography sx={{fontSize:12,color:tokens.textMuted}}>{c.label}</Typography></Box>
            </Paper>
          </Grid>
        ))}
      </Grid>
      <Paper elevation={0} sx={{p:3,borderRadius:3,border:`1px solid ${tokens.surfaceBorder}`,bgcolor:'white'}}>
        <SectionTitle>Platform Growth Trend</SectionTitle>
        <AreaChart data={[30,45,40,60,55,75,70]} color={tokens.accent}/>
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
