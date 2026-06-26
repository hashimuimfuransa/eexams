import React, { useState, useEffect } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  Button,
  Chip,
  Divider,
  CircularProgress,
  Alert,
  Paper,
  Avatar,
  LinearProgress,
  useTheme,
  useMediaQuery,
  alpha
} from '@mui/material';
import {
  School,
  CalendarToday,
  ArrowForward,
  Assessment,
  History as HistoryIcon,
  CheckCircle,
  Cancel,
  AccessTime,
  Timer,
  Security,
  Calculate,
  PlayArrow,
  PlaylistAddCheck,
  EmojiEvents,
  Refresh,
  Visibility
} from '@mui/icons-material';
import StudentLayout from './StudentLayout';
import api from '../../services/api';
import ExamInstructions from '../ExamInstructions';

const History = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [examHistory, setExamHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [selectedExam, setSelectedExam] = useState(null);

  const fetchExamHistory = async () => {
    try {
      setLoading(true);
      const [examsRes, resultsRes] = await Promise.allSettled([
        api.get('/student/exams'),
        api.get('/student/results')
      ]);

      const exams = examsRes.status === 'fulfilled'
        ? examsRes.value.data.map(exam => ({
            ...exam,
            type: 'exam',
            date: exam.startTime || exam.scheduledFor || exam.createdAt
          }))
        : [];

      const results = resultsRes.status === 'fulfilled'
        ? resultsRes.value.data.map(result => ({
            ...result,
            type: 'result',
            date: result.completedAt || result.endTime
          }))
        : [];

      const combined = [...exams, ...results]
        .filter(item => item.date)
        .sort((a, b) => new Date(b.date) - new Date(a.date));
      setExamHistory(combined);
      setError(null);
    } catch (err) {
      console.error('Error fetching exam history:', err);
      setError('Failed to load your exam history. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleExamClick = (item) => {
    if (item.type === 'result') {
      // Go directly to results without instructions
      navigate(`/student/results/${item._id}`);
    } else {
      // Show instructions for all exams (including in-progress)
      setSelectedExam(item);
      setShowInstructions(true);
    }
  };

  const handleProceedToExam = () => {
    setShowInstructions(false);
    if (selectedExam) {
      navigate(`/student/exam/${selectedExam._id}`);
    }
  };

  const handleCancelInstructions = () => {
    setShowInstructions(false);
    setSelectedExam(null);
  };

  useEffect(() => {
    fetchExamHistory();
  }, []);

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const formatDateShort = (dateString) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric'
    });
  };

  const getItemColor = (item) => {
    if (item.type === 'result') {
      const pct = item.maxPossibleScore > 0
        ? Math.round((item.totalScore / item.maxPossibleScore) * 100) : 0;
      return pct >= 70 ? 'success.main' : 'error.main';
    }
    if (item.status === 'in-progress') return 'warning.main';
    if (item.status === 'completed') return 'success.main';
    return 'primary.main';
  };

  const getItemIcon = (item) => {
    if (item.type === 'result') return <Assessment sx={{ fontSize: '1.1rem' }} />;
    if (item.status === 'in-progress') return <AccessTime sx={{ fontSize: '1.1rem' }} />;
    if (item.status === 'completed') return <CheckCircle sx={{ fontSize: '1.1rem' }} />;
    return <School sx={{ fontSize: '1.1rem' }} />;
  };

  const getItemLabel = (item) => {
    if (item.type === 'result') return 'Completed';
    if (item.status === 'in-progress') return 'In Progress';
    if (item.status === 'completed') return 'Completed';
    return 'Available';
  };

  const completedCount = examHistory.filter(i => i.type === 'result').length;
  const inProgressCount = examHistory.filter(i => i.type === 'exam' && i.status === 'in-progress').length;
  const availableCount = examHistory.filter(i => i.type === 'exam' && i.status !== 'in-progress' && i.status !== 'completed').length;
  const passedCount = examHistory.filter(i => {
    if (i.type !== 'result') return false;
    const pct = i.maxPossibleScore > 0 ? Math.round((i.totalScore / i.maxPossibleScore) * 100) : 0;
    return pct >= 70;
  }).length;

  if (loading) {
    return (
      <StudentLayout>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 2 }}>
          <CircularProgress size={56} thickness={4} />
          <Typography variant="body1" color="text.secondary">Loading exam history…</Typography>
        </Box>
      </StudentLayout>
    );
  }

  if (error) {
    return (
      <StudentLayout>
        <Container maxWidth="md" sx={{ py: 4 }}>
          <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>
          <Button variant="contained" startIcon={<Refresh />} onClick={fetchExamHistory}>
            Try Again
          </Button>
        </Container>
      </StudentLayout>
    );
  }

  return (
    <StudentLayout>
      <Container maxWidth="lg" sx={{ mb: 8, px: { xs: 1.5, sm: 2, md: 3 } }}>

        {/* ── Header ── */}
        <Paper elevation={0} sx={{
          p: { xs: 2.5, sm: 3.5 }, mb: 3, borderRadius: 3,
          background: `linear-gradient(135deg, ${theme.palette.secondary.dark} 0%, ${theme.palette.secondary.main} 60%, ${theme.palette.info.main} 100%)`,
          color: 'white', overflow: 'hidden', position: 'relative'
        }}>
          <Box sx={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160,
            borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 70%)' }} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' },
            flexDirection: { xs: 'column', sm: 'row' }, gap: 2, position: 'relative' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: { xs: 44, sm: 52 }, height: { xs: 44, sm: 52 } }}>
                <HistoryIcon sx={{ fontSize: { xs: '1.4rem', sm: '1.8rem' } }} />
              </Avatar>
              <Box>
                <Typography fontWeight={800} sx={{ fontSize: { xs: '1.4rem', sm: '1.8rem' }, lineHeight: 1.2 }}>
                  Exam History
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.85, mt: 0.25 }}>
                  Your full academic activity timeline
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Button variant="contained" component={RouterLink} to="/student/exams"
                startIcon={<School />} size={isMobile ? 'small' : 'medium'}
                sx={{ bgcolor: 'rgba(255,255,255,0.15)', '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' },
                  textTransform: 'none', fontWeight: 700 }}>
                {isMobile ? 'Exams' : 'Available Exams'}
              </Button>
              <Button variant="contained" component={RouterLink} to="/student/results"
                startIcon={<Assessment />} size={isMobile ? 'small' : 'medium'}
                sx={{ bgcolor: 'rgba(255,255,255,0.15)', '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' },
                  textTransform: 'none', fontWeight: 700 }}>
                Results
              </Button>
            </Box>
          </Box>
        </Paper>

        {/* ── Stats Row ── */}
        <Grid container spacing={1.5} sx={{ mb: 3 }}>
          {[
            { label: 'Completed', value: completedCount, color: 'success.main', bgcolor: alpha('#2e7d32', 0.08), icon: <CheckCircle sx={{ fontSize: 20 }} /> },
            { label: 'Passed', value: passedCount, color: '#e65100', bgcolor: alpha('#e65100', 0.08), icon: <EmojiEvents sx={{ fontSize: 20 }} /> },
            { label: 'In Progress', value: inProgressCount, color: 'warning.main', bgcolor: alpha('#ed6c02', 0.08), icon: <AccessTime sx={{ fontSize: 20 }} /> },
            { label: 'Available', value: availableCount, color: 'primary.main', bgcolor: alpha('#0D406C', 0.08), icon: <School sx={{ fontSize: 20 }} /> },
          ].map(stat => (
            <Grid item xs={6} sm={3} key={stat.label}>
              <Card elevation={1} sx={{ borderRadius: 2.5, p: { xs: 1.5, sm: 2 }, bgcolor: stat.bgcolor,
                display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={{ color: stat.color, flexShrink: 0 }}>{stat.icon}</Box>
                <Box>
                  <Typography fontWeight={800} sx={{ color: stat.color, fontSize: { xs: '1.3rem', sm: '1.6rem' }, lineHeight: 1 }}>
                    {stat.value}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: 10, sm: 11 }, fontWeight: 600 }}>
                    {stat.label}
                  </Typography>
                </Box>
              </Card>
            </Grid>
          ))}
        </Grid>

        {examHistory.length === 0 ? (
          <Paper elevation={1} sx={{ borderRadius: 3, p: 6, textAlign: 'center' }}>
            <HistoryIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>No exam history yet</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Start by taking an exam — your activity will appear here.
            </Typography>
            <Button variant="contained" component={RouterLink} to="/student/exams" startIcon={<School />}>
              Browse Available Exams
            </Button>
          </Paper>
        ) : (
          <Grid container spacing={{ xs: 2, sm: 3 }}>

            {/* ── Timeline ── */}
            <Grid item xs={12} md={8}>
              <Paper elevation={2} sx={{ borderRadius: 3, overflow: 'hidden' }}>
                <Box sx={{ px: { xs: 2, sm: 3 }, py: 2, borderBottom: '1px solid', borderColor: 'divider',
                  display: 'flex', alignItems: 'center', gap: 1 }}>
                  <HistoryIcon color="secondary" fontSize="small" />
                  <Typography variant="subtitle1" fontWeight={700}>Activity Timeline</Typography>
                  <Chip label={`${examHistory.length} events`} size="small" sx={{ ml: 'auto', fontWeight: 600 }} />
                </Box>

                <Box sx={{ p: { xs: 2, sm: 3 } }}>
                  {examHistory.map((item, index) => {
                    const isResult = item.type === 'result';
                    const pct = isResult && item.maxPossibleScore > 0
                      ? Math.round((item.totalScore / item.maxPossibleScore) * 100) : null;
                    const dotColor = getItemColor(item);
                    const isLast = index === examHistory.length - 1;
                    const title = isResult ? (item.exam?.title || item.examTitle || 'Exam') : (item.title || 'Exam');

                    return (
                      <Box key={item._id || index} sx={{ display: 'flex', gap: { xs: 1.5, sm: 2 }, mb: isLast ? 0 : 2.5 }}>
                        {/* Timeline spine */}
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                          <Avatar sx={{
                            width: { xs: 36, sm: 42 }, height: { xs: 36, sm: 42 },
                            bgcolor: dotColor, boxShadow: `0 0 0 3px white, 0 0 0 4px ${alpha(dotColor === 'success.main' ? '#2e7d32' : dotColor === 'warning.main' ? '#ed6c02' : dotColor === 'error.main' ? '#d32f2f' : '#0D406C', 0.25)}`
                          }}>
                            {getItemIcon(item)}
                          </Avatar>
                          {!isLast && (
                            <Box sx={{ width: 2, flex: 1, minHeight: 20, mt: 0.5,
                              background: `linear-gradient(to bottom, ${alpha('#0D406C', 0.2)}, ${alpha('#0D406C', 0.05)})` }} />
                          )}
                        </Box>

                        {/* Card content */}
                        <Box sx={{ flex: 1, minWidth: 0, pb: isLast ? 0 : 1 }}>
                          <Paper elevation={0} sx={{
                            p: { xs: 1.5, sm: 2 }, borderRadius: 2.5,
                            border: '1px solid', borderColor: 'divider',
                            bgcolor: isResult
                              ? (pct >= 70 ? alpha('#2e7d32', 0.04) : alpha('#d32f2f', 0.04))
                              : item.status === 'in-progress' ? alpha('#ed6c02', 0.04) : 'background.paper',
                            transition: 'box-shadow 0.2s',
                            '&:hover': { boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }
                          }}>
                            {/* Top row: title + date */}
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1, mb: 1 }}>
                              <Typography fontWeight={700} sx={{
                                fontSize: { xs: '0.875rem', sm: '0.95rem' }, flex: 1,
                                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
                              }}>
                                {title}
                              </Typography>
                              <Typography variant="caption" color="text.secondary"
                                sx={{ flexShrink: 0, fontSize: { xs: 10, sm: 11 }, whiteSpace: 'nowrap' }}>
                                {formatDateShort(item.date)}
                              </Typography>
                            </Box>

                            {/* Chips row */}
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1.25 }}>
                              <Chip label={getItemLabel(item)} size="small"
                                sx={{ height: 20, fontSize: 10, fontWeight: 700,
                                  bgcolor: isResult ? (pct >= 70 ? alpha('#2e7d32', 0.12) : alpha('#d32f2f', 0.1)) : alpha('#0D406C', 0.1),
                                  color: isResult ? (pct >= 70 ? 'success.dark' : 'error.dark') : 'primary.dark' }} />
                              {isResult && pct !== null && (
                                <Chip label={`${pct}%`} size="small"
                                  color={pct >= 70 ? 'success' : pct >= 50 ? 'warning' : 'error'}
                                  sx={{ height: 20, fontSize: 10, fontWeight: 800 }} />
                              )}
                              {item.type === 'exam' && (
                                <Chip label={item.status?.replace(/-/g, ' ') || 'available'} size="small" variant="outlined"
                                  sx={{ height: 20, fontSize: 10, textTransform: 'capitalize' }} />
                              )}
                            </Box>

                            {/* Result details */}
                            {isResult && (
                              <Box sx={{ mb: 1 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                  <Typography variant="caption" color="text.secondary" fontWeight={600}>
                                    Score: {item.totalScore}/{item.maxPossibleScore}
                                  </Typography>
                                  <Typography variant="caption" color={pct >= 70 ? 'success.main' : 'error.main'} fontWeight={700}>
                                    {pct >= 70 ? '✓ Passed' : '✗ Failed'}
                                  </Typography>
                                </Box>
                                <LinearProgress variant="determinate" value={pct || 0}
                                  sx={{ height: 5, borderRadius: 3,
                                    '& .MuiLinearProgress-bar': { bgcolor: pct >= 70 ? 'success.main' : pct >= 50 ? 'warning.main' : 'error.main' } }} />
                              </Box>
                            )}

                            {/* Exam details */}
                            {!isResult && item.timeLimit && (
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.75 }}>
                                <AccessTime sx={{ fontSize: 12 }} /> {item.timeLimit} min
                              </Typography>
                            )}

                            {/* Action button */}
                            <Button size="small" variant="outlined"
                              color={isResult ? (pct >= 70 ? 'success' : 'error') : item.status === 'in-progress' ? 'warning' : 'primary'}
                              onClick={() => handleExamClick(item)}
                              endIcon={isResult ? <Visibility sx={{ fontSize: 14 }} /> : item.status === 'in-progress' ? <PlayArrow sx={{ fontSize: 14 }} /> : <ArrowForward sx={{ fontSize: 14 }} />}
                              sx={{ textTransform: 'none', fontWeight: 600, fontSize: { xs: '0.75rem', sm: '0.8rem' },
                                py: 0.5, px: 1.5, borderRadius: 2 }}>
                              {isResult ? 'View Results' : item.status === 'in-progress' ? 'Continue' : 'Start Exam'}
                            </Button>
                          </Paper>
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              </Paper>
            </Grid>

            {/* ── Sidebar: Summary + Quick Links ── */}
            <Grid item xs={12} md={4}>
              {/* Summary card */}
              <Card elevation={2} sx={{ borderRadius: 3, mb: 2 }}>
                <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
                  <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                    Activity Summary
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  {[
                    { label: 'Total Events', value: examHistory.length, color: 'text.primary' },
                    { label: 'Exams Completed', value: completedCount, color: 'success.main' },
                    { label: 'Passed', value: passedCount, color: '#e65100' },
                    { label: 'In Progress', value: inProgressCount, color: 'warning.main' },
                    { label: 'Still Available', value: availableCount, color: 'primary.main' },
                  ].map(row => (
                    <Box key={row.label} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                      <Typography variant="body2" color="text.secondary">{row.label}</Typography>
                      <Typography variant="h6" fontWeight={800} sx={{ color: row.color, lineHeight: 1 }}>
                        {row.value}
                      </Typography>
                    </Box>
                  ))}
                </CardContent>
              </Card>

              {/* Quick links */}
              <Card elevation={2} sx={{ borderRadius: 3 }}>
                <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
                  <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                    Quick Links
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Button fullWidth variant="contained" color="primary" component={RouterLink}
                    to="/student/exams" startIcon={<School />}
                    sx={{ mb: 1.5, textTransform: 'none', fontWeight: 700, borderRadius: 2 }}>
                    Available Exams
                  </Button>
                  <Button fullWidth variant="outlined" color="primary" component={RouterLink}
                    to="/student/results" startIcon={<Assessment />}
                    sx={{ mb: 1.5, textTransform: 'none', fontWeight: 700, borderRadius: 2 }}>
                    View Results
                  </Button>
                  <Button fullWidth variant="outlined" color="secondary" component={RouterLink}
                    to="/student/leaderboard" startIcon={<EmojiEvents />}
                    sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}>
                    Leaderboard
                  </Button>
                </CardContent>
              </Card>
            </Grid>

          </Grid>
        )}
      </Container>

      {showInstructions && selectedExam && (
        <ExamInstructions
          exam={selectedExam}
          onProceed={handleProceedToExam}
          onCancel={handleCancelInstructions}
        />
      )}
    </StudentLayout>
  );
};

export default History;
