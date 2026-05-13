import { useState, useEffect } from 'react';
import {
  Box, Typography, Chip, Button, Paper, Grid, CircularProgress,
  useMediaQuery, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, LinearProgress, Avatar
} from '@mui/material';
import {
  Dashboard as DashIcon, Assignment, History, EmojiEvents,
  Person, Settings, BarChart, School, TrendingUp, ArrowForward,
  AccessTime, CheckCircle, PlayArrow
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { tokens, gradients } from './dashboardTokens';
import { DashboardShell, Sidebar, Topbar, SectionTitle } from './DashboardShell';

const nav = [
  { id: 'home',    label: 'Dashboard', icon: <DashIcon sx={{ fontSize: 20 }} /> },
  { id: 'exams',   label: 'My Exams',  icon: <Assignment sx={{ fontSize: 20 }} /> },
  { id: 'results', label: 'Results',   icon: <BarChart sx={{ fontSize: 20 }} /> },
  { id: 'history', label: 'History',   icon: <History sx={{ fontSize: 20 }} /> },
  { id: 'profile', label: 'Profile',   icon: <Person sx={{ fontSize: 20 }} /> },
];

function Sparkline({ color = tokens.accent, values = [40,55,45,65,60,75,70] }) {
  const w = 80, h = 32;
  const max = Math.max(...values), min = Math.min(...values), range = max-min||1;
  const pts = values.map((v,i)=>`${(i/(values.length-1))*w},${h-((v-min)/range)*(h-6)-3}`).join(' ');
  return <svg width={w} height={h}><polyline fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={pts}/></svg>;
}

function AreaChart({ data = [], color = tokens.accent }) {
  if (!data.length||data.length<2) data=[50,60,45,75,65,80,72];
  const w=380,h=110,max=Math.max(...data)||100;
  const pts=data.map((v,i)=>`${(i/(data.length-1))*w},${h-(v/max)*(h-12)-6}`).join(' ');
  const area=`${pts} ${w},${h} 0,${h}`;
  const labels=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  return(
    <svg viewBox={`0 0 ${w} ${h+22}`} style={{width:'100%',height:140}}>
      <defs><linearGradient id="ag4" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.22"/><stop offset="100%" stopColor={color} stopOpacity="0.02"/></linearGradient></defs>
      {[0,25,50,75,100].map(y=><line key={y} x1="0" x2={w} y1={h-(y/100)*(h-12)-6} y2={h-(y/100)*(h-12)-6} stroke="#E2E8F0" strokeWidth="1"/>)}
      <polygon points={area} fill="url(#ag4)"/>
      <polyline fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={pts}/>
      {data.map((v,i)=>{const cx=(i/(data.length-1))*w,cy=h-(v/max)*(h-12)-6;return<circle key={i} cx={cx} cy={cy} r="4" fill="white" stroke={color} strokeWidth="2"/>;})}
      {labels.slice(0,data.length).map((l,i)=><text key={i} x={(i/(Math.max(data.length,1)-1))*w} y={h+18} textAnchor="middle" fontSize="10" fill={tokens.textMuted}>{l}</text>)}
    </svg>
  );
}

export default function StudentDashboard() {
  const isMobile = useMediaQuery('(max-width:900px)');
  const isXs = useMediaQuery('(max-width:600px)');
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const [activeSection, setActiveSection] = useState('home');
  const [exams, setExams] = useState([]);
  const [results, setResults] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/student/exams').catch(() => ({ data: [] })),
      api.get('/student/results').catch(() => ({ data: [] })),
      api.get('/student/leaderboard').catch(() => ({ data: [] })),
    ]).then(([e, r, l]) => {
      setExams(Array.isArray(e.data) ? e.data : e.data?.exams || []);
      setResults(Array.isArray(r.data) ? r.data : r.data?.results || []);
      setLeaderboard(Array.isArray(l.data) ? l.data : l.data?.leaderboard || []);
    }).finally(() => setLoading(false));
  }, []);

  const navWithNavigate = nav.map(item => ({
    ...item,
    onClickExtra: () => { if (item.id !== 'home') navigate(`/student/${item.id}`); }
  }));

  const greeting = (() => { const h = new Date().getHours(); return h<12?'Good morning':h<17?'Good afternoon':'Good evening'; })();

  return (
    <DashboardShell
      sidebarEl={<Sidebar user={user} logout={logout} activeSection={activeSection} setActiveSection={id => { setActiveSection(id); if (id !== 'home') navigate(`/student/${id}`); }} onClose={() => setSidebarOpen(false)} isMobile={isMobile} nav={nav} portalLabel="Student Portal" logoIcon={<School sx={{ color:'white', fontSize:20 }} />} />}
      topbarEl={<Topbar greeting={`${greeting}, ${user?.firstName || 'Student'} 👋`} sub="Here's what's happening with your exams today." user={user} onMenuClick={() => setSidebarOpen(v => !v)} onLogout={logout} roleLabel="Student" isXs={isXs} />}
      sidebarOpen={sidebarOpen} isMobile={isMobile} onCloseSidebar={() => setSidebarOpen(false)}>
      {activeSection === 'home' && <HomeSection exams={exams} results={results} leaderboard={leaderboard} loading={loading} user={user} navigate={navigate} />}
    </DashboardShell>
  );
}

function HomeSection({ exams, results, leaderboard, loading, user, navigate }) {
  const completed = results.length;
  const avg = results.length ? Math.round(results.reduce((s,r)=>s+(r.percentage??0),0)/results.length) : 0;
  const pending = exams.filter(e => !results.find(r => r.exam?._id === e._id)).length;
  const myRank = leaderboard.findIndex(u => u._id === user?._id || u.student?._id === user?._id);
  const perfData = results.slice(-7).map(r => Math.round(r.percentage ?? 0));

  const statCards = [
    { label:'Exams Available', value:exams.length,          sub:`${pending} pending`,   subColor:tokens.warning, iconBg:'rgba(12,189,115,0.1)',  icon:<Assignment sx={{color:tokens.accent,fontSize:24}}/>,   spark:[2,4,3,5,4,6,5] },
    { label:'Completed',       value:completed,             sub:'total finished',        subColor:'#6366F1',      iconBg:'rgba(99,102,241,0.1)',  icon:<CheckCircle sx={{color:'#6366F1',fontSize:24}}/>,       spark:[0,1,2,3,4,5,completed] },
    { label:'Average Score',   value:`${avg}%`,             sub:`${results.length} exams`, subColor:tokens.warning, iconBg:'rgba(245,158,11,0.1)', icon:<BarChart sx={{color:tokens.warning,fontSize:24}}/>, spark:[50,60,55,70,65,75,avg] },
    { label:'Class Rank',      value:myRank>=0?`#${myRank+1}`:'—', sub:'leaderboard',   subColor:'#EC4899',      iconBg:'rgba(236,72,153,0.1)', icon:<EmojiEvents sx={{color:'#EC4899',fontSize:24}}/>,        spark:[5,4,4,3,3,2,myRank>=0?myRank+1:5] },
  ];

  return (
    <Box>
      {/* Stat cards */}
      <Grid container spacing={2} sx={{ mb:2.5 }}>
        {statCards.map((s,i)=>(
          <Grid item xs={6} md={3} key={i}>
            <Paper elevation={0} sx={{ p:{xs:1.5,sm:2.5}, borderRadius:3, bgcolor:'white', border:`1px solid ${tokens.surfaceBorder}`, transition:'box-shadow 0.2s,transform 0.15s', '&:hover':{boxShadow:'0 6px 24px rgba(13,64,108,0.09)',transform:'translateY(-1px)'} }}>
              <Box sx={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', mb:1.5 }}>
                <Box sx={{ width:{xs:38,sm:48}, height:{xs:38,sm:48}, borderRadius:2.5, bgcolor:s.iconBg, display:'flex', alignItems:'center', justifyContent:'center' }}>{s.icon}</Box>
                <Box sx={{ display:{xs:'none',sm:'block'} }}><Sparkline color={s.subColor} values={s.spark}/></Box>
              </Box>
              {loading?<CircularProgress size={20} sx={{color:tokens.accent}}/>:
                <Typography fontWeight={800} sx={{ color:tokens.textPrimary, fontFamily:"'DM Sans',sans-serif", lineHeight:1, fontSize:{xs:'1.25rem',sm:'1.5rem',md:'2.125rem'} }}>{s.value}</Typography>}
              <Typography sx={{ fontSize:{xs:11,sm:12.5}, color:tokens.textMuted, fontFamily:"'DM Sans',sans-serif", mt:0.25 }} noWrap>{s.label}</Typography>
              <Typography sx={{ fontSize:{xs:10.5,sm:11.5}, color:s.subColor, fontWeight:600, fontFamily:"'DM Sans',sans-serif", mt:0.35 }} noWrap>{s.sub}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* 3-col bottom */}
      <Grid container spacing={2.5}>
        {/* Available exams */}
        <Grid item xs={12} sm={5} md={5}>
          <Paper elevation={0} sx={{ p:2.5, borderRadius:3, border:`1px solid ${tokens.surfaceBorder}`, bgcolor:'white', height:'100%' }}>
            <SectionTitle action={<Button size="small" sx={{color:tokens.accent,fontWeight:700,fontSize:12,textTransform:'none'}} onClick={()=>navigate('/student/exams')}>View All</Button>}>Available Exams</SectionTitle>
            {loading?<Box sx={{display:'flex',justifyContent:'center',py:4}}><CircularProgress sx={{color:tokens.accent}}/></Box>:
            exams.length===0?<Box sx={{py:4,textAlign:'center'}}><Assignment sx={{fontSize:44,color:tokens.surfaceBorder,mb:1}}/><Typography sx={{color:tokens.textMuted,fontSize:13}}>No exams available.</Typography></Box>:
            exams.slice(0,4).map((e,i)=>{
              const done=results.find(r=>r.exam?._id===e._id);
              return(
                <Box key={e._id||i} sx={{ display:'flex', alignItems:'center', gap:1.5, py:1.25, borderBottom:i<3?`1px solid ${tokens.surfaceBorder}`:'none' }}>
                  <Box sx={{ width:36, height:36, borderRadius:2, bgcolor:'rgba(12,189,115,0.08)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <School sx={{ fontSize:18, color:tokens.accent }}/>
                  </Box>
                  <Box sx={{ flexGrow:1, minWidth:0 }}>
                    <Typography variant="body2" fontWeight={600} noWrap sx={{ fontFamily:"'DM Sans',sans-serif" }}>{e.title}</Typography>
                    <Box sx={{ display:'flex', alignItems:'center', gap:1 }}>
                      <Typography variant="caption" sx={{ color:tokens.textMuted }}>{e.questions?.length||0} Questions</Typography>
                      {e.timeLimit&&<><Typography variant="caption" sx={{color:tokens.textMuted}}>·</Typography><AccessTime sx={{fontSize:11,color:tokens.textMuted}}/><Typography variant="caption" sx={{color:tokens.textMuted}}>{e.timeLimit}m</Typography></>}
                    </Box>
                  </Box>
                  {done?<Chip label="Done" size="small" sx={{bgcolor:'rgba(12,189,115,0.1)',color:tokens.accentDark,fontWeight:600,fontSize:11}}/>:
                    <Button size="small" variant="contained" onClick={()=>navigate(`/student/exam/${e._id}`)}
                      sx={{borderRadius:2,fontSize:11,fontWeight:700,fontFamily:"'DM Sans',sans-serif",background:gradients.brand,boxShadow:'none',textTransform:'none',py:0.4,px:1.5,minWidth:0}}>
                      Start
                    </Button>}
                </Box>
              );
            })}
            <Button fullWidth size="small" endIcon={<ArrowForward fontSize="small"/>}
              sx={{ mt:2, color:tokens.accent, fontWeight:600, fontSize:12, textTransform:'none', fontFamily:"'DM Sans',sans-serif", bgcolor:'rgba(12,189,115,0.05)', borderRadius:2, py:1, '&:hover':{bgcolor:'rgba(12,189,115,0.1)'} }}
              onClick={()=>navigate('/student/exams')}>
              View All Exams
            </Button>
          </Paper>
        </Grid>

        {/* Performance + Leaderboard stacked */}
        <Grid item xs={12} sm={7} md={7}>
          <Box sx={{ display:'flex', flexDirection:'column', gap:2.5, height:'100%' }}>
            {/* Performance */}
            <Paper elevation={0} sx={{ p:2.5, borderRadius:3, border:`1px solid ${tokens.surfaceBorder}`, bgcolor:'white' }}>
              <SectionTitle action={<Chip label="This Week" size="small" sx={{bgcolor:'#F1F5F9',color:tokens.textSecondary,fontSize:11}}/>}>Performance Overview</SectionTitle>
              <AreaChart data={perfData.length>=3?perfData:[50,60,45,75,65,80,72]} color={tokens.accent}/>
              {avg>0&&<Box sx={{textAlign:'center',mt:0.5}}><Chip label={`${avg}% Average Score`} sx={{bgcolor:'rgba(12,189,115,0.1)',color:tokens.accentDark,fontWeight:700,fontSize:12}}/></Box>}
              <Button fullWidth size="small" endIcon={<ArrowForward fontSize="small"/>}
                sx={{ mt:1.5, color:tokens.accent, fontWeight:600, fontSize:12, textTransform:'none', bgcolor:'rgba(12,189,115,0.05)', borderRadius:2, py:1, '&:hover':{bgcolor:'rgba(12,189,115,0.1)'} }}
                onClick={()=>navigate('/student/results')}>
                View All Results
              </Button>
            </Paper>

            {/* Leaderboard */}
            <Paper elevation={0} sx={{ p:2.5, borderRadius:3, border:`1px solid ${tokens.surfaceBorder}`, bgcolor:'white' }}>
              <SectionTitle action={<EmojiEvents sx={{color:tokens.warning,fontSize:18}}/>}>Top Students</SectionTitle>
              {loading?<Box sx={{display:'flex',justifyContent:'center',py:2}}><CircularProgress size={24} sx={{color:tokens.accent}}/></Box>:
              leaderboard.length===0?<Typography sx={{color:tokens.textMuted,fontSize:13,py:2,textAlign:'center'}}>No leaderboard data yet.</Typography>:
              leaderboard.slice(0,4).map((entry,i)=>{
                const name=entry.student?`${entry.student.firstName} ${entry.student.lastName}`:`${entry.firstName||''} ${entry.lastName||''}`.trim();
                const score=Math.round(entry.averageScore??entry.percentage??0);
                const isMe=entry._id===user?._id||entry.student?._id===user?._id;
                const rankColor=[tokens.warning,'#94A3B8','#CD7F32'][i]||tokens.textMuted;
                return(
                  <Box key={i} sx={{ display:'flex', alignItems:'center', gap:1.5, py:1, borderBottom:i<3?`1px solid ${tokens.surfaceBorder}`:'none', bgcolor:isMe?'rgba(12,189,115,0.04)':undefined, borderRadius:isMe?2:0, px:isMe?1:0 }}>
                    <Box sx={{ width:24, height:24, borderRadius:'50%', bgcolor:`${rankColor}1A`, color:rankColor, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800, flexShrink:0 }}>{i+1}</Box>
                    <Avatar sx={{ width:30, height:30, fontSize:12, fontWeight:700, bgcolor:isMe?tokens.accent:'rgba(13,64,108,0.1)', color:isMe?'white':tokens.primary }}>{name?.charAt(0)||'?'}</Avatar>
                    <Typography variant="body2" fontWeight={isMe?700:500} sx={{ flexGrow:1, minWidth:0, fontFamily:"'DM Sans',sans-serif", color:isMe?tokens.accentDark:tokens.textPrimary }} noWrap>{name||'Unknown'}{isMe?' (You)':''}</Typography>
                    <Chip label={`${score}%`} size="small" sx={{ bgcolor:'rgba(12,189,115,0.1)', color:tokens.accentDark, fontWeight:700, fontSize:11, height:20 }}/>
                  </Box>
                );
              })}
            </Paper>
          </Box>
        </Grid>
      </Grid>

      {/* Quick Actions */}
      <Paper elevation={0} sx={{ mt:2.5, p:2.5, borderRadius:3, border:`1px solid ${tokens.surfaceBorder}`, bgcolor:'white' }}>
        <Typography fontWeight={700} sx={{ fontSize:15, fontFamily:"'DM Sans',sans-serif", color:tokens.textPrimary, mb:2 }}>Quick Actions</Typography>
        <Box sx={{ display:'flex', flexWrap:'wrap', gap:1.5 }}>
          {[
            { label:'Take Exam',    icon:<PlayArrow sx={{fontSize:18}}/>,  color:tokens.accent,  bg:'rgba(12,189,115,0.09)', path:'/student/exams' },
            { label:'View Results', icon:<BarChart sx={{fontSize:18}}/>,   color:'#6366F1',      bg:'rgba(99,102,241,0.09)', path:'/student/results' },
            { label:'Leaderboard',  icon:<EmojiEvents sx={{fontSize:18}}/>,color:tokens.warning, bg:'rgba(245,158,11,0.09)', path:'/student/history' },
            { label:'My Profile',   icon:<Person sx={{fontSize:18}}/>,     color:'#EC4899',      bg:'rgba(236,72,153,0.09)', path:'/student/profile' },
          ].map((a,i)=>(
            <Box key={i} onClick={()=>navigate(a.path)} sx={{ display:'flex', alignItems:'center', gap:1.25, px:{xs:1.5,sm:2.5}, py:1.5, borderRadius:2.5, bgcolor:a.bg, cursor:'pointer', flex:'1 1 130px', minWidth:{xs:0,sm:130}, border:`1px solid ${a.color}18`, '&:hover':{opacity:0.82} }}>
              <Box sx={{ color:a.color }}>{a.icon}</Box>
              <Typography fontWeight={700} sx={{ color:a.color, fontSize:13.5, fontFamily:"'DM Sans',sans-serif" }}>{a.label}</Typography>
            </Box>
          ))}
        </Box>
      </Paper>
    </Box>
  );
}
