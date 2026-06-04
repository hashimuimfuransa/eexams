import { useState, useEffect } from 'react';
import {
  Box, Typography, Button, Paper, Grid, TextField, CircularProgress,
  Avatar, Chip, FormControl, InputLabel, Select, MenuItem, InputAdornment,
  Alert, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  LinearProgress
} from '@mui/material';
import { EmojiEvents, Leaderboard as LeaderboardIcon, Search, Download } from '@mui/icons-material';
import api from '../../services/api';
import { tokens } from '../../pages/dashboardTokens';

export default function LeaderboardSection({ exams: examsProp = [], systemWide = false }) {
  const [selectedExam, setSelectedExam] = useState(null); // Will be set to most recent exam
  const [leaderboard, setLeaderboard] = useState([]);
  const [examTitle, setExamTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchStudent, setSearchStudent] = useState('');
  const [examSearchTerm, setExamSearchTerm] = useState(''); // Search for exams
  const [filterPassed, setFilterPassed] = useState('all');
  const [filterClass, setFilterClass] = useState('all');
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [exams, setExams] = useState(examsProp);
  const [examsLoading, setExamsLoading] = useState(false);
  
  // LAZY LOADING: Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const pageSize = 20;

  // Self-fetch exams when none provided by parent
  useEffect(() => {
    if (examsProp.length > 0) { 
      setExams(examsProp);
      // Set default to most recent exam if not already set
      if (!selectedExam && examsProp.length > 0) {
        const mostRecent = examsProp.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
        setSelectedExam(mostRecent._id);
      }
      return; 
    }
    setExamsLoading(true);
    const endpoint = systemWide ? '/superadmin/leaderboard' : '/admin/exams';
    api.get(endpoint)
      .then(r => {
        if (systemWide) {
          setExams(r.data.exams || []);
          // Set default to most recent exam if not already set
          if (!selectedExam && r.data.exams && r.data.exams.length > 0) {
            const mostRecent = r.data.exams.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
            setSelectedExam(mostRecent._id);
          } else if (!selectedExam) {
            // Fallback to showing all exams if no exam selected
            setLeaderboard(r.data.leaderboard || []);
            setExamTitle(r.data.examTitle || 'All Exams');
          }
        } else {
          setExams(r.data || []);
          // Set default to most recent exam if not already set
          if (!selectedExam && r.data && r.data.length > 0) {
            const mostRecent = r.data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
            setSelectedExam(mostRecent._id);
          }
        }
      })
      .catch(() => {})
      .finally(() => setExamsLoading(false));
  }, [examsProp, systemWide]);

  useEffect(() => {
    if (!selectedExam && !systemWide) { setLeaderboard([]); setExamTitle(''); return; }
    setLoading(true); setError('');
    // LAZY LOADING: Add pagination parameters
    const params = { page: currentPage, limit: pageSize };
    let endpoint;
    
    if (systemWide) {
      // Super admin: use superadmin endpoint with examId as query param
      endpoint = `/superadmin/leaderboard`;
      if (selectedExam) {
        params.examId = selectedExam;
      }
    } else {
      // Regular admin: use admin endpoint with examId in path
      endpoint = `/admin/exams/${selectedExam}/leaderboard`;
    }
    
    api.get(endpoint, { params })
      .then(res => {
        const newLeaderboard = res.data.leaderboard || [];
        // LAZY LOADING: Append if loading more pages
        if (currentPage > 1) {
          setLeaderboard(prev => [...prev, ...newLeaderboard]);
        } else {
          setLeaderboard(newLeaderboard);
        }
        setExamTitle(res.data.examTitle || '');
        // Update hasMore based on pagination response
        setHasMore(res.data.pagination ? currentPage < res.data.pagination.totalPages : newLeaderboard.length === pageSize);
      })
      .catch(err => setError(err.response?.data?.message || 'Failed to load leaderboard'))
      .finally(() => {
        setLoading(false);
        setLoadingMore(false);
      });
  }, [selectedExam, systemWide, currentPage]);

  const gradeColor = g => ({ A:'#16a34a', B:'#0284c7', C:'#d97706', D:'#ea580c', F:'#dc2626' }[g] || '#6b7280');
  const getGrade = pct => pct>=90?'A':pct>=80?'B':pct>=70?'C':pct>=60?'D':'F';
  const medalColor = rank => rank===1?'#F59E0B':rank===2?'#94A3B8':rank===3?'#B45309':'transparent';

  // LAZY LOADING: Load more data
  const loadMore = () => {
    if (!loadingMore && hasMore) {
      setLoadingMore(true);
      setCurrentPage(prev => prev + 1);
    }
  };

  // Handle exam selection change
  const handleExamChange = (examId) => {
    setSelectedExam(examId);
    setCurrentPage(1);
    setHasMore(true);
  };

  // Get selected exam details
  const selectedExamObj = exams.find(e => e._id === selectedExam);

  const filtered = leaderboard.filter(e => {
    const name = `${e.firstName||e.student?.firstName||''} ${e.lastName||e.student?.lastName||''}`.toLowerCase();
    if (searchStudent && !name.includes(searchStudent.toLowerCase())) return false;
    const pct = Math.round(e.percentage ?? 0);
    if (filterPassed === 'passed' && pct < 70) return false;
    if (filterPassed === 'failed' && pct >= 70) return false;
    const sc = e.studentClass || e.student?.studentClass || '';
    if (filterClass !== 'all' && sc !== filterClass) return false;
    return true;
  });

  const avgScore = leaderboard.length ? Math.round(leaderboard.reduce((s,e)=>s+(e.percentage??0),0)/leaderboard.length) : 0;
  const passRate = leaderboard.length ? Math.round((leaderboard.filter(e=>(e.percentage??0)>=70).length/leaderboard.length)*100) : 0;
  const uniqueClasses = [...new Set(leaderboard.map(e => e.studentClass || e.student?.studentClass || '').filter(Boolean))].sort();

  const handleDownloadPdf = () => {
    setDownloadingPdf(true);
    try {
      const gc = g => ({ A:'#16a34a', B:'#0284c7', C:'#d97706', D:'#ea580c', F:'#dc2626' }[g] || '#6b7280');
      const gg = pct => pct>=90?'A':pct>=80?'B':pct>=70?'C':pct>=60?'D':'F';
      const topPct = leaderboard.length ? Math.round(leaderboard[0]?.percentage??0) : 0;
      const rows = filtered.map((e, i) => {
        const pct = Math.round(e.percentage ?? 0);
        const grade = gg(pct);
        const rank = e.rank ?? (i + 1);
        const fn = e.firstName || e.student?.firstName || '\u2014';
        const ln = e.lastName || e.student?.lastName || '';
        const sc = e.studentClass || e.student?.studentClass || '';
        const medal = rank===1?'🥇':rank===2?'🥈':rank===3?'🥉':String(rank);
        const passed = pct >= 70;
        const org = e.organization || '';
        return `<tr>
          <td style="text-align:center;font-size:16px">${medal}</td>
          <td><strong>${fn} ${ln}</strong>${sc?`<br/><small style="color:#6b7280">Class ${sc}</small>`:''}</td>
          ${systemWide?`<td style="text-align:center;color:#6b7280">${org}</td>`:''}
          <td style="text-align:center;font-weight:700;color:${passed?'#16a34a':'#dc2626'}">${pct}%</td>
          <td style="text-align:center"><span style="background:${gc(grade)}20;color:${gc(grade)};font-weight:700;padding:2px 8px;border-radius:4px">${grade}</span></td>
          <td style="text-align:center;color:#6b7280">${e.timeTaken!=null?e.timeTaken+' min':'\u2014'}</td>
          <td style="text-align:center;color:#6b7280">${(e.completedAt||e.endTime)?new Date(e.completedAt||e.endTime).toLocaleDateString():'\u2014'}</td>
        </tr>`;
      }).join('');
      const html = `<html><head><title>Leaderboard \u2014 ${examTitle}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:28px;color:#1e293b}
        h1{margin:0 0 4px;font-size:22px}.subtitle{color:#64748b;font-size:13px;margin-bottom:20px}
        .stats{display:flex;gap:16px;margin-bottom:20px;flex-wrap:wrap}
        .stat{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 18px}
        .stat-value{font-size:20px;font-weight:800;color:#0c3b5e}.stat-label{font-size:11px;color:#94a3b8}
        table{width:100%;border-collapse:collapse;font-size:13px}
        th{background:#f8fafc;text-align:left;padding:10px 12px;font-weight:700;color:#64748b;border-bottom:2px solid #e2e8f0}
        td{padding:9px 12px;border-bottom:1px solid #f1f5f9;vertical-align:middle}
        .footer{margin-top:24px;text-align:center;font-size:11px;color:#94a3b8}
      </style></head><body>
      <h1>🏆 Leaderboard</h1>
      <div class="subtitle">${examTitle} &nbsp;&middot;&nbsp; Generated ${new Date().toLocaleDateString()}</div>
      <div class="stats">
        <div class="stat"><div class="stat-value">${leaderboard.length}</div><div class="stat-label">Students</div></div>
        <div class="stat"><div class="stat-value">${avgScore}%</div><div class="stat-label">Average Score</div></div>
        <div class="stat"><div class="stat-value">${passRate}%</div><div class="stat-label">Pass Rate</div></div>
        <div class="stat"><div class="stat-value">${topPct}%</div><div class="stat-label">Top Score</div></div>
      </div>
      <table><thead><tr><th>Rank</th><th>Student</th>${systemWide?'<th>Organization</th>':''}<th>Score</th><th>Grade</th><th>Time</th><th>Date</th></tr></thead>
      <tbody>${rows}</tbody></table>
      <div class="footer">eExams Platform &nbsp;&middot;&nbsp; ${new Date().toLocaleString()}</div>
      </body></html>`;
      const win = window.open('', '_blank');
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => { win.print(); }, 400);
    } catch (err) {
      console.error('PDF error:', err);
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', mb:2, flexWrap:'wrap', gap:1 }}>
        <Box sx={{ display:'flex', alignItems:'center', gap:1 }}>
          <EmojiEvents sx={{ color:'#F59E0B', fontSize:24 }} />
          <Typography fontWeight={700} sx={{ fontSize:18, fontFamily:"'DM Sans',sans-serif", color:tokens.textPrimary }}>
            Leaderboard
          </Typography>
        </Box>
        {leaderboard.length > 0 && (
          <Button size="small" variant="outlined"
            startIcon={downloadingPdf ? <CircularProgress size={14}/> : <Download fontSize="small"/>}
            onClick={handleDownloadPdf} disabled={downloadingPdf}
            sx={{ textTransform:'none', fontWeight:600, borderRadius:2, fontSize:12 }}>
            {downloadingPdf ? 'Preparing…' : 'Download PDF'}
          </Button>
        )}
      </Box>

      {/* Exam picker + filters */}
      <Paper elevation={0} sx={{ p:2.5, mb:2, borderRadius:3, border:`1px solid ${tokens.surfaceBorder}`, bgcolor:'white' }}>
        <Grid container spacing={2} alignItems="center">
          {/* Current exam display */}
          <Grid item xs={12} sm={6} md={4}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="subtitle2" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: 13 }}>
                Current Exam:
              </Typography>
              {selectedExamObj ? (
                <Typography variant="body1" sx={{ fontWeight: 700, color: '#0c3b5e', fontSize: 13 }}>
                  {selectedExamObj.title}
                </Typography>
              ) : (
                <CircularProgress size={16} />
              )}
            </Box>
          </Grid>

          {/* Exam search field */}
          <Grid item xs={12} sm={6} md={4}>
            <TextField size="small" fullWidth placeholder="Search exams to switch..."
              value={examSearchTerm} onChange={e => setExamSearchTerm(e.target.value)}
              InputProps={{ 
                startAdornment: <InputAdornment position="start"><Search sx={{ fontSize:16, color:tokens.textMuted }}/></InputAdornment>
              }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius:2, fontSize:13 } }} />
            {/* Exam search results dropdown */}
            {examSearchTerm && (
              <Paper
                elevation={3}
                sx={{
                  position: 'absolute',
                  zIndex: 10,
                  mt: 1,
                  maxHeight: 200,
                  overflow: 'auto',
                  width: '100%'
                }}
              >
                {exams
                  .filter(exam => 
                    exam.title?.toLowerCase().includes(examSearchTerm.toLowerCase()) ||
                    exam.description?.toLowerCase().includes(examSearchTerm.toLowerCase())
                  )
                  .slice(0, 10)
                  .map(exam => (
                    <MenuItem
                      key={exam._id}
                      onClick={() => {
                        handleExamChange(exam._id);
                        setExamSearchTerm('');
                      }}
                      selected={exam._id === selectedExam}
                      sx={{ fontSize: 13 }}
                    >
                      {exam.title}
                    </MenuItem>
                  ))}
              </Paper>
            )}
          </Grid>
          {selectedExam && (
            <>
              <Grid item xs={12} sm={6} md={3}>
                <TextField size="small" fullWidth placeholder="Search student…"
                  value={searchStudent} onChange={e => setSearchStudent(e.target.value)}
                  InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ fontSize:16, color:tokens.textMuted }}/></InputAdornment> }}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius:2, fontSize:13 } }} />
              </Grid>
              <Grid item xs={12} sm={4} md={2}>
                <FormControl size="small" fullWidth>
                  <InputLabel sx={{ fontSize:13 }}>Status</InputLabel>
                  <Select value={filterPassed} onChange={e => setFilterPassed(e.target.value)} label="Status"
                    sx={{ borderRadius:2, fontSize:13 }}>
                    <MenuItem value="all" sx={{ fontSize:13 }}>All</MenuItem>
                    <MenuItem value="passed" sx={{ fontSize:13 }}>Passed</MenuItem>
                    <MenuItem value="failed" sx={{ fontSize:13 }}>Failed</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={4} md={2}>
                <FormControl size="small" fullWidth>
                  <InputLabel sx={{ fontSize:13 }}>Class</InputLabel>
                  <Select value={filterClass} onChange={e => setFilterClass(e.target.value)} label="Class"
                    sx={{ borderRadius:2, fontSize:13 }}>
                    <MenuItem value="all" sx={{ fontSize:13 }}>All</MenuItem>
                    {uniqueClasses.map(c => <MenuItem key={c} value={c} sx={{ fontSize:13 }}>{c}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
            </>
          )}
        </Grid>
      </Paper>

      {/* States */}
      {!selectedExam ? (
        <Paper elevation={0} sx={{ p:6, borderRadius:3, border:`1px solid ${tokens.surfaceBorder}`, bgcolor:'white', textAlign:'center' }}>
          <LeaderboardIcon sx={{ fontSize:48, color:'#ccc', mb:1.5 }} />
          <Typography sx={{ color:tokens.textMuted, fontSize:14, fontFamily:"'DM Sans',sans-serif" }}>
            Select an exam above to view the student leaderboard and performance tracking
          </Typography>
        </Paper>
      ) : loading ? (
        <Box sx={{ display:'flex', justifyContent:'center', mt:6 }}><CircularProgress sx={{ color:tokens.accent }}/></Box>
      ) : error ? (
        <Alert severity="error" sx={{ borderRadius:2 }}>{error}</Alert>
      ) : (
        <>
          {/* Summary stats */}
          {leaderboard.length > 0 && (
            <Grid container spacing={1.5} sx={{ mb:2 }}>
              {[
                { label:'Students Completed', value:leaderboard.length,            color:tokens.accent, bg:'rgba(12,189,115,0.08)' },
                { label:'Average Score',       value:`${avgScore}%`,               color:'#6366F1',     bg:'rgba(99,102,241,0.08)' },
                { label:'Pass Rate',           value:`${passRate}%`,               color:'#0284c7',     bg:'rgba(2,132,199,0.08)' },
                { label:'Top Score',           value:`${Math.round(leaderboard[0]?.percentage??0)}%`, color:'#F59E0B', bg:'rgba(245,158,11,0.08)' },
              ].map((s, i) => (
                <Grid item xs={6} md={3} key={i}>
                  <Paper elevation={0} sx={{ p:1.5, borderRadius:2.5, border:`1px solid ${tokens.surfaceBorder}`, bgcolor:'white',
                    display:'flex', alignItems:'center', gap:1.5 }}>
                    <Box sx={{ width:38, height:38, borderRadius:2, bgcolor:s.bg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <Typography fontWeight={800} sx={{ fontSize:13, color:s.color }}>{s.value}</Typography>
                    </Box>
                    <Typography sx={{ fontSize:11.5, color:tokens.textMuted, fontFamily:"'DM Sans',sans-serif", lineHeight:1.3 }}>{s.label}</Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          )}

          {/* Top 3 podium */}
          {leaderboard.length >= 3 && !searchStudent && filterPassed === 'all' && filterClass === 'all' && (
            <Paper elevation={0} sx={{ p:3, mb:2, borderRadius:3, border:`1px solid ${tokens.surfaceBorder}`, bgcolor:'white' }}>
              <Typography fontWeight={700} sx={{ fontSize:13, color:tokens.textMuted, mb:2, fontFamily:"'DM Sans',sans-serif" }}>
                🏆 TOP PERFORMERS — {examTitle}
              </Typography>
              <Box sx={{ display:'flex', justifyContent:'center', alignItems:'flex-end', gap:{ xs:1, sm:3 } }}>
                {[leaderboard[1], leaderboard[0], leaderboard[2]].map((e, podiumIdx) => {
                  if (!e) return null;
                  const rank = podiumIdx===1?1:podiumIdx===0?2:3;
                  const pct = Math.round(e.percentage??0);
                  const heights = [96, 120, 80];
                  const medal = ['🥈','🥇','🥉'][podiumIdx];
                  const fn = e.firstName||e.student?.firstName||'?';
                  const ln = e.lastName||e.student?.lastName||'';
                  return (
                    <Box key={e.uniqueId||e._id} sx={{ display:'flex', flexDirection:'column', alignItems:'center', flex:1, maxWidth:120 }}>
                      <Avatar sx={{ width:rank===1?46:36, height:rank===1?46:36, bgcolor:medalColor(rank), fontWeight:700, fontSize:rank===1?18:14, mb:0.5 }}>
                        {fn.charAt(0)}
                      </Avatar>
                      <Typography sx={{ fontSize:12, fontWeight:700, textAlign:'center', lineHeight:1.2, mb:0.5 }}>
                        {fn} {ln.charAt(0)}.
                      </Typography>
                      <Typography sx={{ fontSize:13, fontWeight:800, color:medalColor(rank) }}>{pct}%</Typography>
                      <Box sx={{ width:'100%', height:heights[podiumIdx],
                        bgcolor:rank===1?'#FEF3C7':rank===2?'#F1F5F9':'#FFF7ED',
                        border:`2px solid ${medalColor(rank)}`, borderRadius:'6px 6px 0 0',
                        display:'flex', alignItems:'center', justifyContent:'center', mt:0.5 }}>
                        <Typography sx={{ fontSize:rank===1?22:18 }}>{medal}</Typography>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </Paper>
          )}

          {/* Full ranked table */}
          <Paper elevation={0} sx={{ borderRadius:3, border:`1px solid ${tokens.surfaceBorder}`, bgcolor:'white', overflow:'hidden' }}>
            {filtered.length === 0 ? (
              <Box sx={{ py:6, textAlign:'center' }}>
                <Typography sx={{ color:tokens.textMuted, fontSize:14 }}>No students match the filters.</Typography>
              </Box>
            ) : (
              <TableContainer sx={{ overflowX:'auto' }}>
                <Table sx={{ minWidth:400 }}>
                  <TableHead>
                    <TableRow sx={{ bgcolor:'#F8FAFC' }}>
                      {['Rank','Student', systemWide ? 'Organization' : null, 'Score','Grade','Time Taken','Completed'].filter(Boolean).map(h => (
                        <TableCell key={h} sx={{ fontWeight:700, color:tokens.textSecondary, fontSize:12, py:1.5 }}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filtered.map((e, i) => {
                      const pct = Math.round(e.percentage??0);
                      const grade = getGrade(pct);
                      const rank = e.rank ?? (i+1);
                      const passed = pct >= 70;
                      const fn = e.firstName||e.student?.firstName||'?';
                      const ln = e.lastName||e.student?.lastName||'';
                      const sc = e.studentClass||e.student?.studentClass||'';
                      return (
                        <TableRow key={e.uniqueId||e._id||i} sx={{ '&:hover':{ bgcolor:'#F8FAFC' } }}>
                          <TableCell sx={{ py:1.25 }}>
                            {rank <= 3 ? (
                              <Typography sx={{ fontSize:16 }}>{rank===1?'🥇':rank===2?'🥈':'🥉'}</Typography>
                            ) : (
                              <Box sx={{ width:24, height:24, borderRadius:'50%', bgcolor:'#F1F5F9',
                                display:'flex', alignItems:'center', justifyContent:'center' }}>
                                <Typography sx={{ fontSize:11, fontWeight:700, color:tokens.textSecondary }}>{rank}</Typography>
                              </Box>
                            )}
                          </TableCell>
                          <TableCell sx={{ py:1.25 }}>
                            <Box sx={{ display:'flex', alignItems:'center', gap:1 }}>
                              <Avatar sx={{ width:28, height:28, bgcolor:passed?tokens.accent:'#EF4444', fontSize:11, fontWeight:700 }}>
                                {fn.charAt(0)}
                              </Avatar>
                              <Box>
                                <Typography sx={{ fontSize:13, fontWeight:600, lineHeight:1.2 }}>{fn} {ln}</Typography>
                                {sc && <Typography variant="caption" sx={{ color:tokens.textMuted }}>Class {sc}</Typography>}
                              </Box>
                            </Box>
                          </TableCell>
                          {systemWide && (
                            <TableCell sx={{ py:1.25 }}>
                              <Typography variant="caption" sx={{ color:tokens.textMuted }}>
                                {e.organization || '—'}
                              </Typography>
                            </TableCell>
                          )}
                          <TableCell sx={{ py:1.25 }}>
                            <Box sx={{ display:'flex', alignItems:'center', gap:1 }}>
                              <LinearProgress variant="determinate" value={pct}
                                sx={{ width:56, height:5, borderRadius:3, bgcolor:'#EEF2FF',
                                  '& .MuiLinearProgress-bar':{ bgcolor:passed?tokens.accent:'#EF4444', borderRadius:3 } }} />
                              <Typography sx={{ fontSize:12, fontWeight:700, color:passed?tokens.accentDark:'#EF4444', minWidth:36 }}>
                                {pct}%
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell sx={{ py:1.25 }}>
                            <Chip label={grade} size="small"
                              sx={{ height:20, fontSize:11, fontWeight:700, bgcolor:`${gradeColor(grade)}18`, color:gradeColor(grade) }} />
                          </TableCell>
                          <TableCell sx={{ py:1.25 }}>
                            <Typography variant="caption" sx={{ color:tokens.textMuted }}>
                              {e.timeTaken != null ? `${e.timeTaken}m` : '-'}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ py:1.25 }}>
                            <Typography variant="caption" sx={{ color:tokens.textMuted }}>
                              {(e.completedAt||e.endTime) ? new Date(e.completedAt||e.endTime).toLocaleDateString() : '-'}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
            
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
          </Paper>
        </>
      )}
    </Box>
  );
}
