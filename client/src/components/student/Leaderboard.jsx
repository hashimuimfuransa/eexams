import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link as RouterLink } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Alert,
  Divider,
  Button,
  Grid,
  Paper,
  LinearProgress,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Tabs,
  Tab,
  Tooltip,
  useTheme,
  useMediaQuery,
  alpha,
  Grow,
  Zoom
} from '@mui/material';
import {
  EmojiEvents,
  Leaderboard as LeaderboardIcon,
  CheckCircle,
  Cancel,
  ArrowBack,
  Refresh,
  Assessment,
  People,
  TrendingUp,
  AccessTime
} from '@mui/icons-material';
import api from '../../services/api';
import StudentLayout from './StudentLayout';

const MEDAL = { 1: '🥇', 2: '🥈', 3: '🥉' };
const PODIUM_COLOR = { 1: '#FFD700', 2: '#C0C0C0', 3: '#CD7F32' };
const PODIUM_HEIGHT = { 1: 110, 2: 85, 3: 70 };

const RankBadge = ({ rank, small = false }) => (
  <Box sx={{
    width: small ? 26 : 32, height: small ? 26 : 32, borderRadius: '50%', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    bgcolor: rank === 1 ? '#FFD700' : rank === 2 ? '#C0C0C0' : rank === 3 ? '#CD7F32' : 'grey.200',
    fontSize: small ? (rank <= 3 ? 12 : 10) : (rank <= 3 ? 15 : 12), fontWeight: 800,
    boxShadow: rank <= 3 ? '0 2px 6px rgba(0,0,0,0.2)' : 'none'
  }}>
    {rank <= 3 ? MEDAL[rank] : <Typography variant="caption" fontWeight={800} sx={{ fontSize: small ? 9 : 11 }}>#{rank}</Typography>}
  </Box>
);

const Leaderboard = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [searchParams, setSearchParams] = useSearchParams();

  const [results, setResults] = useState([]);
  const [leaderboards, setLeaderboards] = useState({});
  const [classLeaderboard, setClassLeaderboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lbLoading, setLbLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tabValue, setTabValue] = useState(0); // 0 = class, 1 = per-exam
  const [selectedExamId, setSelectedExamId] = useState('');

  // Pre-select exam from URL query param ?exam=...
  const paramExamId = searchParams.get('exam');

  const fetchInitialData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [resultsRes, classRes] = await Promise.all([
        api.get('/student/results'),
        api.get('/student/leaderboard').catch(() => ({ data: { leaderboard: [] } }))
      ]);
      const fetchedResults = resultsRes.data?.results || resultsRes.data || [];
      setResults(fetchedResults);
      setClassLeaderboard(classRes.data);

      // If URL has ?exam=... switch to per-exam tab and pre-select
      if (paramExamId) {
        setTabValue(1);
        setSelectedExamId(paramExamId);
      } else if (fetchedResults.length > 0) {
        const firstExamId = fetchedResults[0]?.exam?._id || fetchedResults[0]?.exam;
        if (firstExamId) setSelectedExamId(String(firstExamId));
      }
    } catch (err) {
      setError('Failed to load leaderboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [paramExamId]);

  useEffect(() => { fetchInitialData(); }, [fetchInitialData]);

  // Fetch per-exam leaderboard when selectedExamId changes
  useEffect(() => {
    if (!selectedExamId || leaderboards[selectedExamId]) return;
    setLbLoading(true);
    api.get(`/student/leaderboard/exam/${selectedExamId}`)
      .then(res => setLeaderboards(prev => ({ ...prev, [selectedExamId]: res.data })))
      .catch(() => setLeaderboards(prev => ({ ...prev, [selectedExamId]: { leaderboard: [], examTitle: '' } })))
      .finally(() => setLbLoading(false));
  }, [selectedExamId, leaderboards]);

  const handleExamChange = (e) => {
    const id = e.target.value;
    setSelectedExamId(id);
    setSearchParams(id ? { exam: id } : {});
  };

  const currentLb = leaderboards[selectedExamId];
  const myExamEntry = currentLb?.leaderboard?.find(e => e.isCurrentUser);
  const myClassEntry = classLeaderboard?.leaderboard?.find(e => e.isCurrentUser);

  const calculatePercentage = (score, max) => {
    if (!score || !max || max === 0) return 0;
    return Math.round((score / max) * 100);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const renderLeaderboardTable = (leaderboard) => {
    if (!leaderboard || leaderboard.length === 0) {
      return (
        <Box sx={{ py: 6, textAlign: 'center' }}>
          <People sx={{ fontSize: 56, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">No data yet</Typography>
          <Typography variant="body2" color="text.secondary">Be the first to complete this exam!</Typography>
        </Box>
      );
    }

    return (
      <Box>
        {leaderboard.map((entry, idx) => (
          <Box key={entry.id || idx} sx={{
            display: 'flex', alignItems: 'center', gap: { xs: 0.75, sm: 2 },
            px: { xs: 1, sm: 2 }, py: { xs: 0.9, sm: 1.25 }, borderRadius: 2, mb: 0.75,
            bgcolor: entry.isCurrentUser ? alpha('#0D406C', 0.09) : idx % 2 === 0 ? 'grey.50' : 'white',
            border: entry.isCurrentUser ? '2px solid' : '1px solid transparent',
            borderColor: entry.isCurrentUser ? 'primary.main' : 'transparent',
            transition: 'all 0.15s ease',
            '&:hover': { bgcolor: entry.isCurrentUser ? alpha('#0D406C', 0.13) : 'grey.100' }
          }}>
            <RankBadge rank={entry.rank} small={isMobile} />

            <Typography variant="body2" sx={{ flex: 1, fontWeight: entry.isCurrentUser ? 700 : 400, minWidth: 0 }} noWrap>
              {entry.name}
              {entry.isCurrentUser && (
                <Chip label="You" size="small" color="primary" sx={{ ml: 1, height: 18, fontSize: 10 }} />
              )}
            </Typography>

            {!isMobile && (
              <Box sx={{ width: 140 }}>
                <Box sx={{ height: 7, borderRadius: 4, bgcolor: 'grey.200', overflow: 'hidden' }}>
                  <Box sx={{
                    height: '100%', width: `${entry.percentage}%`, borderRadius: 4,
                    bgcolor: entry.percentage >= 80 ? 'success.main' : entry.percentage >= 60 ? 'warning.main' : 'error.main',
                    transition: 'width 0.6s ease'
                  }} />
                </Box>
              </Box>
            )}

            <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
              <Chip
                label={`${entry.percentage}%`}
                size="small"
                color={entry.percentage >= 80 ? 'success' : entry.percentage >= 60 ? 'warning' : 'error'}
                sx={{ fontWeight: 700, mb: 0.25, fontSize: { xs: 10, sm: 12 } }}
              />
              {!isMobile && entry.totalScore !== undefined && (
                <Typography variant="caption" display="block" color="text.secondary">
                  {entry.totalScore}/{entry.maxPossibleScore} pts
                </Typography>
              )}
            </Box>
          </Box>
        ))}
      </Box>
    );
  };

  const renderPodium = (leaderboard) => {
    if (!leaderboard || leaderboard.length < 2) return null;
    const podiumOrder = [1, 0, 2].filter(i => leaderboard[i]);
    const podiumSizes = isMobile
      ? { 1: { width: 90, avatar: 38, height: 80 }, 2: { width: 75, avatar: 32, height: 62 }, 3: { width: 70, avatar: 30, height: 52 } }
      : { 1: { width: 130, avatar: 52, height: 110 }, 2: { width: 110, avatar: 44, height: 85 }, 3: { width: 100, avatar: 40, height: 70 } };
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end',
        gap: { xs: 1, sm: 3 }, mb: 3, mt: 1 }}>
        {podiumOrder.map((podiumIdx) => {
          const entry = leaderboard[podiumIdx];
          const rank = podiumIdx + 1;
          const sz = podiumSizes[rank];
          return (
            <Box key={podiumIdx} sx={{ textAlign: 'center', width: sz.width, flexShrink: 0 }}>
              <Box sx={{
                width: sz.avatar, height: sz.avatar, borderRadius: '50%', bgcolor: PODIUM_COLOR[rank],
                display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 0.5,
                fontSize: isMobile ? 16 : 22,
                border: entry.isCurrentUser ? '3px solid #0D406C' : '2px solid white',
                boxShadow: entry.isCurrentUser ? '0 0 0 3px #0D406C' : '0 2px 8px rgba(0,0,0,0.2)'
              }}>
                {MEDAL[rank]}
              </Box>
              <Typography fontWeight={800} display="block" noWrap
                sx={{ px: 0.25, fontSize: { xs: '0.65rem', sm: '0.75rem' } }}>
                {entry.name.split(' ')[0]}
              </Typography>
              {entry.isCurrentUser && (
                <Chip label="You" size="small" color="primary"
                  sx={{ height: 14, fontSize: 8, mb: 0.25, '& .MuiChip-label': { px: 0.75 } }} />
              )}
              <Box sx={{
                height: sz.height, bgcolor: PODIUM_COLOR[rank],
                borderRadius: '6px 6px 0 0', opacity: 0.8,
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Typography fontWeight={800} sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                  {entry.percentage}%
                </Typography>
              </Box>
            </Box>
          );
        })}
      </Box>
    );
  };

  if (loading) {
    return (
      <StudentLayout>
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
            <CircularProgress />
          </Box>
        </Container>
      </StudentLayout>
    );
  }

  return (
    <StudentLayout>
      <Container maxWidth="lg" sx={{ mb: 8 }}>
        {/* Header */}
        <Grow in={true} timeout={500}>
          <Paper elevation={0} sx={{
            p: { xs: 2.5, sm: 3.5 }, mb: 3, borderRadius: 3,
            background: 'linear-gradient(135deg, #0D406C 0%, #1565c0 60%, #0CBD73 100%)',
            color: 'white'
          }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' },
              flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <LeaderboardIcon sx={{ fontSize: 28 }} />
                  <Typography variant="h5" fontWeight={800}>Leaderboard</Typography>
                </Box>
                <Typography variant="body2" sx={{ opacity: 0.85 }}>
                  See how you rank against your classmates across all exams
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button variant="contained" component={RouterLink} to="/student/dashboard"
                  startIcon={<ArrowBack />}
                  size={isMobile ? 'small' : 'medium'}
                  sx={{ bgcolor: 'rgba(255,255,255,0.15)', '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' },
                    textTransform: 'none', fontWeight: 700 }}>
                  {isMobile ? 'Back' : 'Dashboard'}
                </Button>
                <Button variant="contained" onClick={fetchInitialData}
                  startIcon={<Refresh />}
                  size={isMobile ? 'small' : 'medium'}
                  sx={{ bgcolor: 'rgba(255,255,255,0.15)', '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' },
                    textTransform: 'none', fontWeight: 700 }}>
                  {isMobile ? '' : 'Refresh'}
                </Button>
              </Box>
            </Box>
          </Paper>
        </Grow>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>{error}</Alert>
        )}

        {/* My Stats summary cards */}
        {(myClassEntry || myExamEntry || results.length > 0) && (
          <Zoom in={true} style={{ transitionDelay: '100ms' }}>
            <Box sx={{ mb: 3 }}>
              <Grid container spacing={1.5}>
                {myClassEntry && (
                  <Grid item xs={6} sm={4}>
                    <Card elevation={2} sx={{ borderRadius: 2, p: { xs: 1.5, sm: 2 }, textAlign: 'center',
                      background: alpha('#0D406C', 0.06), border: '1.5px solid', borderColor: 'primary.light' }}>
                      <Typography variant="caption" color="text.secondary" fontWeight={700}
                        sx={{ textTransform: 'uppercase', fontSize: { xs: 9, sm: 11 } }}>
                        Class Rank
                      </Typography>
                      <Typography fontWeight={800} color="primary.main"
                        sx={{ fontSize: { xs: '1.8rem', sm: '2.125rem' }, lineHeight: 1.2, mt: 0.25 }}>
                        #{myClassEntry.rank}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: 9, sm: 11 } }}>
                        of {classLeaderboard?.leaderboard?.length || '—'}
                      </Typography>
                    </Card>
                  </Grid>
                )}
                {myClassEntry && (
                  <Grid item xs={6} sm={4}>
                    <Card elevation={2} sx={{ borderRadius: 2, p: { xs: 1.5, sm: 2 }, textAlign: 'center' }}>
                      <Typography variant="caption" color="text.secondary" fontWeight={700}
                        sx={{ textTransform: 'uppercase', fontSize: { xs: 9, sm: 11 } }}>
                        Overall
                      </Typography>
                      <Typography fontWeight={800} color={myClassEntry.percentage >= 70 ? 'success.main' : 'error.main'}
                        sx={{ fontSize: { xs: '1.8rem', sm: '2.125rem' }, lineHeight: 1.2, mt: 0.25 }}>
                        {myClassEntry.percentage}%
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: 9, sm: 11 } }}>
                        {myClassEntry.examCount || '—'} exam{myClassEntry.examCount !== 1 ? 's' : ''}
                      </Typography>
                    </Card>
                  </Grid>
                )}
                <Grid item xs={myClassEntry ? 12 : 6} sm={4}>
                  <Card elevation={2} sx={{ borderRadius: 2, p: { xs: 1.5, sm: 2 }, textAlign: 'center',
                    display: 'flex', flexDirection: { xs: myClassEntry ? 'row' : 'column', sm: 'column' },
                    alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="caption" color="text.secondary" fontWeight={700}
                        sx={{ textTransform: 'uppercase', fontSize: { xs: 9, sm: 11 } }}>
                        Completed
                      </Typography>
                      <Typography fontWeight={800} color="text.primary"
                        sx={{ fontSize: { xs: '1.8rem', sm: '2.125rem' }, lineHeight: 1.2, mt: 0.25 }}>
                        {results.length}
                      </Typography>
                    </Box>
                    <Button size="small" component={RouterLink} to="/student/results"
                      sx={{ textTransform: 'none', fontSize: { xs: 11, sm: 12 }, whiteSpace: 'nowrap' }}>
                      View all →
                    </Button>
                  </Card>
                </Grid>
              </Grid>
            </Box>
          </Zoom>
        )}

        {/* Tabs */}
        <Card elevation={2} sx={{ borderRadius: 3 }}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}
              variant="fullWidth" indicatorColor="primary" textColor="primary">
              <Tab label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <People sx={{ fontSize: { xs: 16, sm: 20 } }} />
                  <Typography variant="body2" fontWeight={700} sx={{ fontSize: { xs: '0.78rem', sm: '0.875rem' } }}>
                    {isMobile ? 'Class' : 'Class Leaderboard'}
                  </Typography>
                </Box>
              } />
              <Tab label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Assessment sx={{ fontSize: { xs: 16, sm: 20 } }} />
                  <Typography variant="body2" fontWeight={700} sx={{ fontSize: { xs: '0.78rem', sm: '0.875rem' } }}>
                    {isMobile ? 'Per Exam' : 'Per-Exam Leaderboard'}
                  </Typography>
                </Box>
              } />
            </Tabs>
          </Box>

          {/* ── Tab 0: Class Leaderboard ── */}
          {tabValue === 0 && (
            <Box sx={{ p: { xs: 2, sm: 3 } }}>
              {!classLeaderboard || classLeaderboard.leaderboard?.length === 0 ? (
                <Box sx={{ py: 6, textAlign: 'center' }}>
                  <People sx={{ fontSize: 56, color: 'text.disabled', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary">No class leaderboard yet</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {classLeaderboard?.message || 'Complete exams to appear on the leaderboard.'}
                  </Typography>
                </Box>
              ) : (
                <>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle1" fontWeight={700}>
                      Class: {classLeaderboard.classInfo?.name || '—'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {classLeaderboard.leaderboard.length} students ranked by overall average score
                    </Typography>
                  </Box>
                  {renderPodium(classLeaderboard.leaderboard)}
                  <Divider sx={{ my: 2 }} />
                  {renderLeaderboardTable(classLeaderboard.leaderboard)}
                </>
              )}
            </Box>
          )}

          {/* ── Tab 1: Per-Exam Leaderboard ── */}
          {tabValue === 1 && (
            <Box sx={{ p: { xs: 2, sm: 3 } }}>
              {results.length === 0 ? (
                <Box sx={{ py: 6, textAlign: 'center' }}>
                  <Assessment sx={{ fontSize: 56, color: 'text.disabled', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary">No completed exams</Typography>
                  <Typography variant="body2" color="text.secondary">Complete an exam to see per-exam rankings.</Typography>
                </Box>
              ) : (
                <>
                  {/* Exam selector */}
                  <FormControl fullWidth sx={{ mb: 3 }}>
                    <InputLabel>Select Exam</InputLabel>
                    <Select
                      value={selectedExamId}
                      onChange={handleExamChange}
                      label="Select Exam"
                    >
                      {results.map((result) => {
                        const examId = result.exam?._id || result.exam;
                        const examTitle = result.examTitle || result.exam?.title || 'Exam';
                        const pct = calculatePercentage(result.totalScore, result.maxPossibleScore);
                        return (
                          <MenuItem key={result._id} value={String(examId)}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 2 }}>
                              <Typography variant="body2" noWrap sx={{ flex: 1 }}>{examTitle}</Typography>
                              <Chip label={`${pct}%`} size="small"
                                color={pct >= 70 ? 'success' : 'error'} sx={{ fontWeight: 700 }} />
                            </Box>
                          </MenuItem>
                        );
                      })}
                    </Select>
                  </FormControl>

                  {selectedExamId && (() => {
                    const selectedResult = results.find(r => String(r.exam?._id || r.exam) === selectedExamId);
                    const pct = selectedResult ? calculatePercentage(selectedResult.totalScore, selectedResult.maxPossibleScore) : 0;
                    return (
                      <Box sx={{ mb: 3, p: { xs: 1.5, sm: 2 }, bgcolor: 'grey.50', borderRadius: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                          flexWrap: 'wrap', gap: 1, mb: 1.25 }}>
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography variant="subtitle2" fontWeight={700}
                              sx={{ fontSize: { xs: '0.85rem', sm: '1rem' }, wordBreak: 'break-word' }}>
                              {currentLb?.examTitle || selectedResult?.examTitle || 'Exam'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Completed: {formatDate(selectedResult?.endTime)}
                            </Typography>
                          </Box>
                          <Button size="small" variant="outlined" component={RouterLink}
                            to={`/student/results/${selectedResult?._id}`}
                            sx={{ textTransform: 'none', fontWeight: 600, flexShrink: 0 }}>
                            My Result
                          </Button>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          <Chip label={`Your score: ${pct}%`}
                            color={pct >= 70 ? 'success' : 'error'}
                            sx={{ fontWeight: 700, fontSize: { xs: 11, sm: 13 } }} />
                          {myExamEntry && (
                            <Chip icon={<EmojiEvents fontSize="small" />}
                              label={`Rank #${myExamEntry.rank} of ${currentLb?.leaderboard?.length}`}
                              sx={{
                                fontWeight: 700, fontSize: { xs: 11, sm: 13 },
                                bgcolor: myExamEntry.rank === 1 ? '#FFD700' : myExamEntry.rank === 2 ? '#C0C0C0' : myExamEntry.rank === 3 ? '#CD7F32' : undefined,
                                color: myExamEntry.rank <= 3 ? 'black' : undefined
                              }} />
                          )}
                        </Box>
                      </Box>
                    );
                  })()}

                  {lbLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                      <CircularProgress />
                    </Box>
                  ) : currentLb ? (
                    <>
                      {renderPodium(currentLb.leaderboard)}
                      {currentLb.leaderboard?.length > 0 && <Divider sx={{ my: 2 }} />}
                      {renderLeaderboardTable(currentLb.leaderboard)}
                    </>
                  ) : (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                      <CircularProgress size={28} />
                    </Box>
                  )}
                </>
              )}
            </Box>
          )}
        </Card>
      </Container>
    </StudentLayout>
  );
};

export default Leaderboard;
