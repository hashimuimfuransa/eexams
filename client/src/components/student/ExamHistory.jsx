import React, { useState, useEffect } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Container,
  Grid,
  Paper,
  Typography,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Chip,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tab,
  Grow,
  Fade,
  IconButton,
  Tooltip,
  TextField,
  InputAdornment,
  useTheme,
  alpha,
  Avatar,
  Slide,
  Zoom,
  LinearProgress,
  Badge
} from '@mui/material';
import {
  History,
  CheckCircle,
  Cancel,
  AccessTime,
  Search,
  FilterList,
  Sort,
  Info,
  EmojiEvents,
  Timeline,
  School,
  Visibility,
  TrendingUp,
  Assessment,
  LocalFireDepartment,
  WorkspacePremium,
  Verified,
  AutoGraph,
  Speed,
  Psychology,
  Star,
  StarBorder,
  CalendarToday,
  BarChart,
  Refresh
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import api from '../../services/api';
import StudentLayout from './StudentLayout';

// Styled components
const StyledTableCell = styled(TableCell)(({ theme }) => ({
  fontWeight: 'medium',
  '&.MuiTableCell-head': {
    backgroundColor: theme.palette.primary.light,
    color: theme.palette.common.white,
    fontWeight: 'bold',
  },
}));

const StyledTableRow = styled(TableRow)(({ theme }) => ({
  '&:nth-of-type(odd)': {
    backgroundColor: theme.palette.action.hover,
  },
  '&:hover': {
    backgroundColor: theme.palette.primary.lighter,
  },
  // hide last border
  '&:last-child td, &:last-child th': {
    border: 0,
  },
}));

const ExamHistory = () => {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [examHistory, setExamHistory] = useState([]);
  const [filteredHistory, setFilteredHistory] = useState([]);
  const [error, setError] = useState(null);
  const [tabValue, setTabValue] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchExamHistory();
  }, []);

  useEffect(() => {
    filterExamHistory();
  }, [examHistory, tabValue, searchTerm]);

  const fetchExamHistory = async () => {
    setLoading(true);
    try {
      // Replace with actual API call when available
      // const response = await api.get('/student/exam-history');
      // setExamHistory(response.data);

      // Mock data for now
      const mockData = [
        {
          _id: '1',
          examId: {
            _id: 'exam1',
            title: 'Mathematics 101 Final Exam',
            totalPoints: 100
          },
          score: 85,
          status: 'completed',
          startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          endTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(),
          submittedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 1.5 * 60 * 60 * 1000).toISOString(),
          correctAnswers: 17,
          totalQuestions: 20
        },
        {
          _id: '2',
          examId: {
            _id: 'exam2',
            title: 'Physics 202 Midterm',
            totalPoints: 50
          },
          score: 42,
          status: 'completed',
          startTime: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
          endTime: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000 + 1.5 * 60 * 60 * 1000).toISOString(),
          submittedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000 + 1.2 * 60 * 60 * 1000).toISOString(),
          correctAnswers: 14,
          totalQuestions: 15
        },
        {
          _id: '3',
          examId: {
            _id: 'exam3',
            title: 'Chemistry 101 Quiz',
            totalPoints: 30
          },
          score: 18,
          status: 'completed',
          startTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          endTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 1 * 60 * 60 * 1000).toISOString(),
          submittedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 0.8 * 60 * 60 * 1000).toISOString(),
          correctAnswers: 6,
          totalQuestions: 10
        },
        {
          _id: '4',
          examId: {
            _id: 'exam4',
            title: 'Biology 201 Final',
            totalPoints: 100
          },
          score: 92,
          status: 'completed',
          startTime: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          endTime: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000).toISOString(),
          submittedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000 + 2.5 * 60 * 60 * 1000).toISOString(),
          correctAnswers: 46,
          totalQuestions: 50
        },
        {
          _id: '5',
          examId: {
            _id: 'exam5',
            title: 'Computer Science 303 Midterm',
            totalPoints: 80
          },
          score: 72,
          status: 'completed',
          startTime: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(),
          endTime: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(),
          submittedAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000 + 1.8 * 60 * 60 * 1000).toISOString(),
          correctAnswers: 18,
          totalQuestions: 20
        }
      ];

      setExamHistory(mockData);
      setError(null);
    } catch (error) {
      console.error('Error fetching exam history:', error);
      setError('Failed to load exam history. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const filterExamHistory = () => {
    let filtered = [...examHistory];

    // Apply tab filter
    if (tabValue === 1) { // High scores
      filtered = filtered.filter(exam => {
        const percentage = (exam.score / exam.examId.totalPoints) * 100;
        return percentage >= 80;
      });
    } else if (tabValue === 2) { // Low scores
      filtered = filtered.filter(exam => {
        const percentage = (exam.score / exam.examId.totalPoints) * 100;
        return percentage < 60;
      });
    }

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(exam =>
        exam.examId.title.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredHistory(filtered);
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
  };

  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  const getScoreColor = (score, totalPoints) => {
    const percentage = (score / totalPoints) * 100;
    if (percentage >= 80) return 'success.main';
    if (percentage >= 60) return 'warning.main';
    return 'error.main';
  };

  if (loading) {
    return (
      <StudentLayout>
        <Container maxWidth="lg" sx={{
          textAlign: 'center',
          mt: { xs: 4, sm: 6, md: 8 },
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh'
        }}>
          <Fade in={true} timeout={800}>
            <Box sx={{ position: 'relative' }}>
              {/* Animated background circles */}
              <Box
                sx={{
                  position: 'absolute',
                  top: -20,
                  left: -20,
                  width: 100,
                  height: 100,
                  borderRadius: '50%',
                  background: `radial-gradient(circle, ${alpha(theme.palette.secondary.main, 0.1)} 0%, transparent 70%)`,
                  animation: 'historyLoadingFloat 3s ease-in-out infinite',
                  '@keyframes historyLoadingFloat': {
                    '0%, 100%': { transform: 'translateY(0px) scale(1)' },
                    '50%': { transform: 'translateY(-10px) scale(1.1)' }
                  }
                }}
              />

              <CircularProgress
                size={80}
                thickness={4}
                sx={{
                  color: theme.palette.secondary.main,
                  animation: 'historyLoadingPulse 2s ease-in-out infinite',
                  '@keyframes historyLoadingPulse': {
                    '0%, 100%': { opacity: 1 },
                    '50%': { opacity: 0.7 }
                  }
                }}
              />

              <Box
                sx={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: `linear-gradient(135deg, ${theme.palette.secondary.main}, ${theme.palette.info.main})`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <History sx={{ color: 'white', fontSize: '1.5rem' }} />
              </Box>
            </Box>
          </Fade>

          <Slide direction="up" in={true} timeout={1000}>
            <Typography
              variant="h5"
              sx={{
                mt: 4,
                fontWeight: 'bold',
                background: `linear-gradient(135deg, ${theme.palette.secondary.main}, ${theme.palette.info.main})`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}
            >
              Loading Exam History...
            </Typography>
          </Slide>

          <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
            Please wait while we fetch your exam performance timeline
          </Typography>
        </Container>
      </StudentLayout>
    );
  }

  if (error) {
    return (
      <StudentLayout>
        <Container maxWidth="lg" sx={{ py: 4 }}>
          <Alert severity="error" sx={{ mb: 4 }}>
            {error}
          </Alert>
          <Button
            variant="contained"
            color="primary"
            onClick={fetchExamHistory}
            startIcon={<Refresh />}
          >
            Try Again
          </Button>
        </Container>
      </StudentLayout>
    );
  }

  return (
    <StudentLayout>
      <Container maxWidth="lg" sx={{ mb: { xs: 4, sm: 6, md: 8 }, mt: { xs: 3, sm: 4, md: 5 }, px: { xs: 1, sm: 2, md: 3 } }}>
        <Grow in={true} timeout={800}>
          <Paper
            elevation={0}
            sx={{
              p: { xs: 4, sm: 5, md: 6 },
              mb: { xs: 3, sm: 4 },
              borderRadius: { xs: 4, md: 6 },
              background: `linear-gradient(135deg,
                ${theme.palette.secondary.dark} 0%,
                ${theme.palette.secondary.main} 50%,
                ${theme.palette.info.main} 100%)`,
              color: 'white',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: `0 25px 50px ${alpha(theme.palette.secondary.main, 0.3)}`,
              transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
              '&:hover': {
                boxShadow: `0 30px 60px ${alpha(theme.palette.secondary.main, 0.4)}`,
                transform: 'translateY(-4px)'
              }
            }}
          >
            {/* Enhanced decorative elements */}
            <Box
              sx={{
                position: 'absolute',
                top: -50,
                right: -50,
                width: { xs: '150px', sm: '200px', md: '250px' },
                height: { xs: '150px', sm: '200px', md: '250px' },
                background: 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)',
                borderRadius: '50%',
                animation: 'historyFloat 10s ease-in-out infinite',
                '@keyframes historyFloat': {
                  '0%': { transform: 'translateY(0px) rotate(0deg)' },
                  '50%': { transform: 'translateY(-20px) rotate(180deg)' },
                  '100%': { transform: 'translateY(0px) rotate(360deg)' }
                }
              }}
            />

            {/* History sparkles */}
            {[...Array(8)].map((_, i) => (
              <Box
                key={i}
                sx={{
                  position: 'absolute',
                  width: { xs: 3, sm: 4 },
                  height: { xs: 3, sm: 4 },
                  borderRadius: '50%',
                  bgcolor: 'rgba(255,255,255,0.8)',
                  top: `${15 + i * 10}%`,
                  left: `${10 + i * 10}%`,
                  animation: `historySparkle 4s ease-in-out infinite ${i * 0.3}s`,
                  '@keyframes historySparkle': {
                    '0%, 100%': { opacity: 0, transform: 'scale(0) rotate(0deg)' },
                    '50%': { opacity: 1, transform: 'scale(1) rotate(180deg)' }
                  }
                }}
              />
            ))}

            <Box sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: { xs: 'flex-start', sm: 'center' },
              flexDirection: { xs: 'column', sm: 'row' },
              gap: { xs: 3, sm: 2 },
              position: 'relative',
              zIndex: 1
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar
                  sx={{
                    width: { xs: 60, sm: 70 },
                    height: { xs: 60, sm: 70 },
                    bgcolor: 'rgba(255,255,255,0.2)',
                    border: '3px solid rgba(255,255,255,0.3)',
                    animation: 'historyIconFloat 6s ease-in-out infinite',
                    '@keyframes historyIconFloat': {
                      '0%, 100%': { transform: 'translateY(0px) rotate(0deg)' },
                      '50%': { transform: 'translateY(-8px) rotate(10deg)' }
                    }
                  }}
                >
                  <Timeline sx={{ fontSize: { xs: '2rem', sm: '2.5rem' }, color: 'white' }} />
                </Avatar>

                <Box>
                  <Typography
                    variant="h3"
                    component="h1"
                    fontWeight="bold"
                    sx={{
                      fontSize: { xs: '2rem', sm: '2.5rem', md: '3rem' },
                      background: 'linear-gradient(135deg, #ffffff 0%, #f0f0f0 50%, #ffffff 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                      mb: 1,
                      letterSpacing: '-0.02em',
                      position: 'relative',
                      '&::after': {
                        content: '""',
                        position: 'absolute',
                        bottom: -8,
                        left: 0,
                        width: '60%',
                        height: 4,
                        background: 'linear-gradient(90deg, rgba(255,255,255,0.8), rgba(255,255,255,0.3))',
                        borderRadius: 2
                      }
                    }}
                  >
                    Exam History 📚
                  </Typography>
                  <Typography
                    variant="h6"
                    sx={{
                      color: 'rgba(255,255,255,0.9)',
                      fontSize: { xs: '1rem', sm: '1.2rem' },
                      fontWeight: 'medium'
                    }}
                  >
                    Track your academic journey and performance trends
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Chip
                  icon={<BarChart />}
                  label="Performance Tracking"
                  sx={{
                    bgcolor: 'rgba(255,255,255,0.2)',
                    color: 'white',
                    fontWeight: 'bold',
                    border: '1px solid rgba(255,255,255,0.3)',
                    '&:hover': {
                      bgcolor: 'rgba(255,255,255,0.3)'
                    }
                  }}
                />
                <Chip
                  icon={<CalendarToday />}
                  label="Timeline View"
                  sx={{
                    bgcolor: 'rgba(255,255,255,0.2)',
                    color: 'white',
                    fontWeight: 'bold',
                    border: '1px solid rgba(255,255,255,0.3)',
                    '&:hover': {
                      bgcolor: 'rgba(255,255,255,0.3)'
                    }
                  }}
                />
              </Box>
            </Box>
          </Paper>
        </Grow>

        <Grid container spacing={{ xs: 2, sm: 3, md: 4 }}>
          <Grid item xs={12}>
            <Fade in={true} timeout={1000}>
              <Paper
                elevation={8}
                sx={{
                  borderRadius: 4,
                  overflow: 'hidden',
                  background: `linear-gradient(135deg,
                    ${alpha(theme.palette.background.paper, 0.9)} 0%,
                    ${alpha(theme.palette.background.paper, 1)} 100%)`,
                  border: `1px solid ${alpha(theme.palette.secondary.main, 0.1)}`,
                  position: 'relative'
                }}
              >
                {/* Enhanced controls section */}
                <Box sx={{
                  p: { xs: 2, sm: 3 },
                  display: 'flex',
                  flexDirection: { xs: 'column', md: 'row' },
                  alignItems: { xs: 'stretch', md: 'center' },
                  gap: { xs: 2, md: 3 },
                  background: `linear-gradient(135deg, ${alpha(theme.palette.secondary.main, 0.05)}, ${alpha(theme.palette.info.main, 0.05)})`,
                  borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`
                }}>
                  <Box sx={{ flex: 1 }}>
                    <Tabs
                      value={tabValue}
                      onChange={handleTabChange}
                      indicatorColor="secondary"
                      textColor="secondary"
                      variant="scrollable"
                      scrollButtons="auto"
                      sx={{
                        '& .MuiTab-root': {
                          fontWeight: 'bold',
                          fontSize: { xs: '0.8rem', sm: '0.9rem' },
                          minHeight: { xs: 40, sm: 48 },
                          transition: 'all 0.3s ease',
                          '&:hover': {
                            color: theme.palette.secondary.main,
                            transform: 'translateY(-2px)'
                          }
                        },
                        '& .Mui-selected': {
                          background: `linear-gradient(135deg, ${alpha(theme.palette.secondary.main, 0.1)}, ${alpha(theme.palette.secondary.light, 0.05)})`,
                          borderRadius: 2
                        }
                      }}
                    >
                      <Tab
                        label="All Exams"
                        icon={<Assessment sx={{ fontSize: '1rem' }} />}
                        iconPosition="start"
                      />
                      <Tab
                        label="High Scores"
                        icon={<EmojiEvents sx={{ fontSize: '1rem' }} />}
                        iconPosition="start"
                      />
                      <Tab
                        label="Low Scores"
                        icon={<TrendingUp sx={{ fontSize: '1rem' }} />}
                        iconPosition="start"
                      />
                    </Tabs>
                  </Box>

                  <TextField
                    placeholder="Search exam history..."
                    size="small"
                    value={searchTerm}
                    onChange={handleSearchChange}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Search sx={{ color: theme.palette.secondary.main }} />
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                      width: { xs: '100%', md: '300px' },
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 3,
                        transition: 'all 0.3s ease',
                        '&:hover': {
                          boxShadow: `0 4px 12px ${alpha(theme.palette.secondary.main, 0.15)}`
                        },
                        '&.Mui-focused': {
                          boxShadow: `0 6px 16px ${alpha(theme.palette.secondary.main, 0.2)}`
                        }
                      }
                    }}
                  />
                </Box>

                {/* Desktop Table View */}
                <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                  <TableContainer>
                    <Table sx={{ minWidth: 700 }}>
                      <TableHead>
                        <TableRow sx={{
                          bgcolor: alpha(theme.palette.secondary.main, 0.05),
                          '& .MuiTableCell-head': {
                            fontWeight: 'bold',
                            fontSize: '0.9rem',
                            color: theme.palette.secondary.main
                          }
                        }}>
                          <StyledTableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <School sx={{ fontSize: '1rem' }} />
                              Exam Title
                            </Box>
                          </StyledTableCell>
                          <StyledTableCell align="center">
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                              <CalendarToday sx={{ fontSize: '1rem' }} />
                              Date Taken
                            </Box>
                          </StyledTableCell>
                          <StyledTableCell align="center">
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                              <Assessment sx={{ fontSize: '1rem' }} />
                              Score
                            </Box>
                          </StyledTableCell>
                          <StyledTableCell align="center">
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                              <BarChart sx={{ fontSize: '1rem' }} />
                              Correct Answers
                            </Box>
                          </StyledTableCell>
                          <StyledTableCell align="center">Actions</StyledTableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {filteredHistory.length > 0 ? (
                          filteredHistory.map((exam, index) => (
                            <StyledTableRow
                              key={exam._id}
                              sx={{
                                '&:nth-of-type(odd)': {
                                  backgroundColor: alpha(theme.palette.grey[50], 0.5),
                                },
                                '&:hover': {
                                  backgroundColor: alpha(theme.palette.secondary.main, 0.08),
                                  transform: 'scale(1.01)',
                                  boxShadow: `0 4px 12px ${alpha(theme.palette.secondary.main, 0.15)}`
                                },
                                transition: 'all 0.3s ease',
                              }}
                            >
                              <StyledTableCell component="th" scope="row">
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                  <Avatar
                                    sx={{
                                      width: 32,
                                      height: 32,
                                      bgcolor: theme.palette.secondary.main,
                                      mr: 2,
                                      fontSize: '0.8rem'
                                    }}
                                  >
                                    <School sx={{ fontSize: '1rem' }} />
                                  </Avatar>
                                  <Typography variant="body2" fontWeight="medium">
                                    {exam.examId.title}
                                  </Typography>
                                </Box>
                              </StyledTableCell>
                              <StyledTableCell align="center">
                                <Typography variant="body2" fontWeight="medium">
                                  {formatDate(exam.startTime)}
                                </Typography>
                              </StyledTableCell>
                              <StyledTableCell align="center">
                                <Typography
                                  variant="body2"
                                  fontWeight="bold"
                                  sx={{ color: getScoreColor(exam.score, exam.examId.totalPoints) }}
                                >
                                  {exam.score} / {exam.examId.totalPoints}
                                  <Typography component="span" variant="body2" sx={{ ml: 1, opacity: 0.8 }}>
                                    ({Math.round((exam.score / exam.examId.totalPoints) * 100)}%)
                                  </Typography>
                                </Typography>
                              </StyledTableCell>
                              <StyledTableCell align="center">
                                <Typography variant="body2" fontWeight="medium">
                                  {exam.correctAnswers} / {exam.totalQuestions}
                                </Typography>
                              </StyledTableCell>
                              <StyledTableCell align="center">
                                <Tooltip title="View detailed analysis" arrow>
                                  <Button
                                    variant="contained"
                                    size="small"
                                    component={RouterLink}
                                    to={`/student/results/${exam._id}`}
                                    startIcon={<Visibility />}
                                    color="secondary"
                                    sx={{
                                      borderRadius: 2,
                                      fontWeight: 'bold',
                                      '&:hover': {
                                        transform: 'scale(1.05)'
                                      }
                                    }}
                                  >
                                    View Details
                                  </Button>
                                </Tooltip>
                              </StyledTableCell>
                            </StyledTableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                                <Avatar
                                  sx={{
                                    width: 60,
                                    height: 60,
                                    bgcolor: alpha(theme.palette.secondary.main, 0.1),
                                    mb: 1
                                  }}
                                >
                                  <History sx={{ fontSize: '2rem', color: theme.palette.secondary.main, opacity: 0.7 }} />
                                </Avatar>
                                <Typography variant="h6" color="text.secondary" fontWeight="bold">
                                  No exam history found
                                </Typography>
                                <Typography variant="body2" color="text.secondary" textAlign="center">
                                  {searchTerm && 'No exams match your search criteria'}
                                  {tabValue === 1 && 'No exams with high scores found'}
                                  {tabValue === 2 && 'No exams with low scores found'}
                                  {!searchTerm && tabValue === 0 && 'You haven\'t taken any exams yet'}
                                </Typography>
                              </Box>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>

                {/* Mobile Card View */}
                <Box sx={{ display: { xs: 'block', md: 'none' }, p: 2 }}>
                  {filteredHistory.length > 0 ? (
                    <Grid container spacing={2}>
                      {filteredHistory.map((exam, index) => {
                        const percentage = Math.round((exam.score / exam.examId.totalPoints) * 100);

                        return (
                          <Grid item xs={12} key={exam._id}>
                            <Zoom in={true} style={{ transitionDelay: `${index * 100}ms` }}>
                              <Card
                                elevation={4}
                                sx={{
                                  borderRadius: 3,
                                  position: 'relative',
                                  overflow: 'hidden',
                                  background: `linear-gradient(135deg,
                                    ${alpha(theme.palette.background.paper, 0.9)} 0%,
                                    ${alpha(theme.palette.background.paper, 1)} 100%)`,
                                  border: `1px solid ${alpha(theme.palette.secondary.main, 0.1)}`,
                                  transition: 'all 0.3s ease',
                                  '&:hover': {
                                    transform: 'translateY(-4px)',
                                    boxShadow: `0 8px 24px ${alpha(theme.palette.secondary.main, 0.2)}`
                                  }
                                }}
                              >
                                {/* Top indicator */}
                                <Box
                                  sx={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    height: '4px',
                                    background: `linear-gradient(90deg, ${theme.palette.secondary.main}, ${theme.palette.secondary.light})`
                                  }}
                                />

                                <CardContent sx={{ p: 3 }}>
                                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                                    <Box sx={{ flex: 1, mr: 2 }}>
                                      <Typography
                                        variant="h6"
                                        fontWeight="bold"
                                        sx={{
                                          fontSize: '1.1rem',
                                          mb: 1,
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          display: '-webkit-box',
                                          WebkitLineClamp: 2,
                                          WebkitBoxOrient: 'vertical'
                                        }}
                                      >
                                        {exam.examId.title}
                                      </Typography>

                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                        <Chip
                                          icon={<CalendarToday sx={{ fontSize: '0.8rem' }} />}
                                          label={formatDate(exam.startTime)}
                                          size="small"
                                          sx={{
                                            bgcolor: alpha(theme.palette.info.main, 0.1),
                                            color: theme.palette.info.main,
                                            fontWeight: 'medium',
                                            fontSize: '0.7rem',
                                            height: 20
                                          }}
                                        />
                                        <Chip
                                          icon={<Verified sx={{ fontSize: '0.7rem' }} />}
                                          label="Completed"
                                          size="small"
                                          sx={{
                                            bgcolor: alpha(theme.palette.success.main, 0.1),
                                            color: theme.palette.success.main,
                                            fontWeight: 'medium',
                                            fontSize: '0.65rem',
                                            height: 18
                                          }}
                                        />
                                      </Box>
                                    </Box>

                                    <Avatar
                                      sx={{
                                        width: 40,
                                        height: 40,
                                        bgcolor: theme.palette.secondary.main,
                                        fontSize: '1rem'
                                      }}
                                    >
                                      {percentage}%
                                    </Avatar>
                                  </Box>

                                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                    <Box>
                                      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 'medium' }}>
                                        Score
                                      </Typography>
                                      <Typography variant="h6" fontWeight="bold">
                                        {exam.score} / {exam.examId.totalPoints}
                                      </Typography>
                                    </Box>

                                    <Box sx={{ textAlign: 'right' }}>
                                      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 'medium' }}>
                                        Correct Answers
                                      </Typography>
                                      <Typography variant="h6" fontWeight="bold">
                                        {exam.correctAnswers} / {exam.totalQuestions}
                                      </Typography>
                                    </Box>
                                  </Box>

                                  <Button
                                    variant="contained"
                                    color="secondary"
                                    component={RouterLink}
                                    to={`/student/results/${exam._id}`}
                                    fullWidth
                                    startIcon={<Visibility />}
                                    sx={{
                                      py: 1.2,
                                      fontWeight: 'bold',
                                      borderRadius: 2,
                                      background: `linear-gradient(135deg, ${theme.palette.secondary.main}, ${theme.palette.secondary.dark})`,
                                      '&:hover': {
                                        transform: 'translateY(-1px)',
                                        boxShadow: `0 4px 12px ${alpha(theme.palette.secondary.main, 0.3)}`
                                      }
                                    }}
                                  >
                                    View Detailed Analysis
                                  </Button>
                                </CardContent>
                              </Card>
                            </Zoom>
                          </Grid>
                        );
                      })}
                    </Grid>
                  ) : (
                    <Box sx={{
                      textAlign: 'center',
                      py: 6,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 2
                    }}>
                      <Avatar
                        sx={{
                          width: 80,
                          height: 80,
                          bgcolor: alpha(theme.palette.secondary.main, 0.1),
                          mb: 2
                        }}
                      >
                        <History sx={{ fontSize: '2.5rem', color: theme.palette.secondary.main, opacity: 0.7 }} />
                      </Avatar>
                      <Typography variant="h5" color="text.secondary" fontWeight="bold">
                        No exam history found
                      </Typography>
                      <Typography variant="body1" color="text.secondary" textAlign="center">
                        {searchTerm && 'No exams match your search criteria'}
                        {tabValue === 1 && 'No exams with high scores found'}
                        {tabValue === 2 && 'No exams with low scores found'}
                        {!searchTerm && tabValue === 0 && 'You haven\'t taken any exams yet'}
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Paper>
            </Fade>
          </Grid>
        </Grid>
      </Container>
    </StudentLayout>
  );
};

export default ExamHistory;
