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
  AdminPanelSettings, SupervisorAccount, School, TrendingUp,
  CheckCircle, Block, Edit, Add, ArrowForward
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { tokens, gradients, planColors as PLAN_COLORS } from './dashboardTokens';
import { DashboardShell, Sidebar, Topbar, SectionTitle } from './DashboardShell';

const nav = [
  { id: 'home',          label: 'Overview',       icon: <DashIcon sx={{ fontSize: 20 }} /> },
  { id: 'organizations', label: 'Organizations',  icon: <Business sx={{ fontSize: 20 }} /> },
  { id: 'users',         label: 'All Users',      icon: <People sx={{ fontSize: 20 }} /> },
  { id: 'subscriptions', label: 'Subscriptions',  icon: <AttachMoney sx={{ fontSize: 20 }} /> },
  { id: 'analytics',     label: 'Analytics',      icon: <TrendingUp sx={{ fontSize: 20 }} /> },
  { id: 'settings',      label: 'Settings',       icon: <Settings sx={{ fontSize: 20 }} /> },
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
      sidebarEl={<Sidebar user={user} logout={logout} activeSection={activeSection} setActiveSection={setActiveSection} onClose={() => setSidebarOpen(false)} isMobile={isMobile} nav={nav} portalLabel="Super Admin" logoIcon={<AdminPanelSettings sx={{ color: 'white', fontSize: 20 }} />} />}
      topbarEl={<Topbar greeting={`Good morning, ${user?.firstName || 'Admin'} 👋`} sub="Platform-wide activity and management" user={user} onMenuClick={() => setSidebarOpen(v => !v)} onLogout={logout} roleLabel="Super Admin" />}
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
  const [orgs,setOrgs]=useState([]);
  const [loading,setLoading]=useState(true);
  const [selected,setSelected]=useState(null);
  const [plan,setPlan]=useState('');
  const [status,setStatus]=useState('');
  const [saving,setSaving]=useState(false);

  useEffect(()=>{api.get('/superadmin/organizations').then(r=>setOrgs(r.data||[])).finally(()=>setLoading(false));},[]);

  const handleOpen=(o)=>{setSelected(o);setPlan(o.subscriptionPlan||'free');setStatus(o.subscriptionStatus||'pending');};
  const handleSave=async()=>{
    setSaving(true);
    try{await api.put(`/superadmin/organizations/${selected._id}/subscription`,{subscriptionPlan:plan,subscriptionStatus:status});setOrgs(p=>p.map(o=>o._id===selected._id?{...o,subscriptionPlan:plan,subscriptionStatus:status}:o));setSelected(null);}
    catch{}finally{setSaving(false);}
  };
  const handleToggle=async(o)=>{
    try{await api.put(`/superadmin/organizations/${o._id}/toggle-block`);setOrgs(p=>p.map(x=>x._id===o._id?{...x,isBlocked:!x.isBlocked}:x));}catch{}
  };

  return(
    <Box>
      <SectionTitle>Organizations</SectionTitle>
      {loading?<Box sx={{display:'flex',justifyContent:'center',mt:6}}><CircularProgress sx={{color:tokens.accent}}/></Box>:(
        <Paper elevation={0} sx={{borderRadius:3,border:`1px solid ${tokens.surfaceBorder}`,bgcolor:'white',overflow:'hidden'}}>
          <TableContainer><Table>
            <TableHead><TableRow sx={{bgcolor:'#F8FAFC'}}>{['Organization','Admin','Plan','Status','Actions'].map(h=><TableCell key={h} sx={{fontWeight:700,color:tokens.textSecondary,fontSize:12}}>{h}</TableCell>)}</TableRow></TableHead>
            <TableBody>
              {orgs.length===0?<TableRow><TableCell colSpan={5} align="center" sx={{py:5,color:tokens.textMuted}}>No organizations.</TableCell></TableRow>:
              orgs.map(o=>(
                <TableRow key={o._id} sx={{'&:hover':{bgcolor:'#F8FAFC'}}}>
                  <TableCell><Box sx={{display:'flex',alignItems:'center',gap:1.5}}><Avatar sx={{width:32,height:32,background:gradients.brand,fontSize:13,fontWeight:700}}>{(o.organization||o.firstName)?.charAt(0)}</Avatar><Typography variant="body2" fontWeight={600}>{o.organization||'—'}</Typography></Box></TableCell>
                  <TableCell><Typography variant="body2">{o.firstName} {o.lastName}</Typography><Typography variant="caption" sx={{color:tokens.textMuted}}>{o.email}</Typography></TableCell>
                  <TableCell><Chip label={o.subscriptionPlan||'free'} size="small" sx={{bgcolor:`${PLAN_COLORS[o.subscriptionPlan]||PLAN_COLORS.free}14`,color:PLAN_COLORS[o.subscriptionPlan]||PLAN_COLORS.free,fontWeight:600}}/></TableCell>
                  <TableCell><Chip label={o.isBlocked?'Blocked':(o.subscriptionStatus||'pending')} size="small" sx={{bgcolor:o.isBlocked?'rgba(239,68,68,0.08)':o.subscriptionStatus==='active'?'rgba(12,189,115,0.1)':'rgba(245,158,11,0.1)',color:o.isBlocked?'#EF4444':o.subscriptionStatus==='active'?tokens.accentDark:tokens.warning,fontWeight:600}}/></TableCell>
                  <TableCell><Box sx={{display:'flex',gap:0.5}}>
                    <Tooltip title="Edit subscription"><IconButton size="small" onClick={()=>handleOpen(o)} sx={{color:tokens.primary}}><Edit fontSize="small"/></IconButton></Tooltip>
                    <Tooltip title={o.isBlocked?'Unblock':'Block'}><IconButton size="small" onClick={()=>handleToggle(o)} sx={{color:o.isBlocked?tokens.accent:'#EF4444'}}>{o.isBlocked?<CheckCircle fontSize="small"/>:<Block fontSize="small"/>}</IconButton></Tooltip>
                  </Box></TableCell>
                </TableRow>))}
            </TableBody>
          </Table></TableContainer>
        </Paper>
      )}
      <Dialog open={Boolean(selected)} onClose={()=>setSelected(null)} maxWidth="xs" fullWidth PaperProps={{sx:{borderRadius:3}}}>
        <DialogTitle sx={{fontWeight:700,fontFamily:"'DM Sans',sans-serif"}}>Edit Subscription — {selected?.organization}</DialogTitle>
        <DialogContent sx={{pt:'16px !important'}}>
          <Grid container spacing={2}>
            <Grid item xs={12}><FormControl fullWidth size="small"><InputLabel>Plan</InputLabel><Select label="Plan" value={plan} onChange={e=>setPlan(e.target.value)} sx={{borderRadius:2}}>{['free','basic','premium','enterprise'].map(p=><MuiMenuItem key={p} value={p}>{p.charAt(0).toUpperCase()+p.slice(1)}</MuiMenuItem>)}</Select></FormControl></Grid>
            <Grid item xs={12}><FormControl fullWidth size="small"><InputLabel>Status</InputLabel><Select label="Status" value={status} onChange={e=>setStatus(e.target.value)} sx={{borderRadius:2}}>{['active','pending','expired','cancelled'].map(s=><MuiMenuItem key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</MuiMenuItem>)}</Select></FormControl></Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{px:3,pb:2.5}}>
          <Button onClick={()=>setSelected(null)} sx={{borderRadius:2,textTransform:'none'}}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving} sx={{borderRadius:2,background:gradients.brand,textTransform:'none',fontWeight:700}}>{saving?'Saving…':'Save'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function AllUsersSection() {
  const [users,setUsers]=useState([]);
  const [loading,setLoading]=useState(true);
  const [search,setSearch]=useState('');
  useEffect(()=>{api.get('/superadmin/organizations').then(r=>setUsers(r.data||[])).finally(()=>setLoading(false));},[]);
  const filtered=users.filter(u=>`${u.firstName} ${u.lastName} ${u.email} ${u.organization||''}`.toLowerCase().includes(search.toLowerCase()));
  return(
    <Box>
      <SectionTitle action={<TextField size="small" placeholder="Search…" value={search} onChange={e=>setSearch(e.target.value)} sx={{'& .MuiOutlinedInput-root':{borderRadius:2},width:220}}/>}>All Users</SectionTitle>
      {loading?<Box sx={{display:'flex',justifyContent:'center',mt:6}}><CircularProgress sx={{color:tokens.accent}}/></Box>:(
        <Paper elevation={0} sx={{borderRadius:3,border:`1px solid ${tokens.surfaceBorder}`,bgcolor:'white',overflow:'hidden'}}>
          <TableContainer><Table>
            <TableHead><TableRow sx={{bgcolor:'#F8FAFC'}}>{['User','Role','Organization','Plan','Status'].map(h=><TableCell key={h} sx={{fontWeight:700,color:tokens.textSecondary,fontSize:12}}>{h}</TableCell>)}</TableRow></TableHead>
            <TableBody>
              {filtered.length===0?<TableRow><TableCell colSpan={5} align="center" sx={{py:5,color:tokens.textMuted}}>No users found.</TableCell></TableRow>:
              filtered.map(u=>{const rc={admin:tokens.primary,teacher:tokens.accent,student:tokens.warning}[u.role]||'#64748B';return(
                <TableRow key={u._id} sx={{'&:hover':{bgcolor:'#F8FAFC'}}}>
                  <TableCell><Box sx={{display:'flex',alignItems:'center',gap:1.5}}><Avatar sx={{width:32,height:32,bgcolor:`${rc}1A`,color:rc,fontSize:13,fontWeight:700}}>{u.firstName?.charAt(0)}</Avatar><Box><Typography variant="body2" fontWeight={600}>{u.firstName} {u.lastName}</Typography><Typography variant="caption" sx={{color:tokens.textMuted}}>{u.email}</Typography></Box></Box></TableCell>
                  <TableCell><Chip label={u.role||'admin'} size="small" sx={{bgcolor:`${rc}14`,color:rc,fontWeight:600}}/></TableCell>
                  <TableCell><Typography variant="body2" sx={{color:tokens.textMuted}}>{u.organization||'—'}</Typography></TableCell>
                  <TableCell><Chip label={u.subscriptionPlan||'free'} size="small" sx={{bgcolor:`${PLAN_COLORS[u.subscriptionPlan]||PLAN_COLORS.free}14`,color:PLAN_COLORS[u.subscriptionPlan]||PLAN_COLORS.free,fontWeight:600}}/></TableCell>
                  <TableCell><Chip label={u.isBlocked?'Blocked':'Active'} size="small" sx={{bgcolor:u.isBlocked?'rgba(239,68,68,0.08)':'rgba(12,189,115,0.1)',color:u.isBlocked?'#EF4444':tokens.accentDark,fontWeight:600}}/></TableCell>
                </TableRow>);})}
            </TableBody>
          </Table></TableContainer>
        </Paper>
      )}
    </Box>
  );
}

function SubscriptionsSection({ stats }) {
  const plans=[
    {name:'Free',price:'$0/mo',key:'free',features:['5 exams/month','Basic AI','30 students max']},
    {name:'Basic',price:'$9/mo',key:'basic',features:['30 exams/month','Full AI','200 students','Analytics']},
    {name:'Premium',price:'$29/mo',key:'premium',features:['Unlimited exams','Advanced AI','Unlimited students','Priority support']},
    {name:'Enterprise',price:'Custom',key:'enterprise',features:['Custom limits','Dedicated support','Custom branding','API access']},
  ];
  return(
    <Box>
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
