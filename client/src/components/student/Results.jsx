import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
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
  Accordion,
  AccordionSummary,
  AccordionDetails,
  LinearProgress,
  Tabs,
  Tab,
  Grow,
  Zoom,
  Fade,
  IconButton,
  Tooltip,
  useTheme,
  alpha,
  Avatar,
  Slide
} from '@mui/material';
import {
  ExpandMore,
  CheckCircle,
  Cancel,
  ArrowBack,
  EmojiEvents,
  Timeline,
  School,
  AccessTime,
  Refresh,
  Search,
  FilterList,
  Sort,
  Info,
  Star,
  StarBorder,
  TrendingUp,
  Assessment,
  LocalFireDepartment,
  WorkspacePremium,
  Verified,
  AutoGraph,
  Speed,
  Psychology
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import api from '../../services/api';
import StudentLayout from './StudentLayout';

// Styled components
const ScoreCircle = styled(Box)(({ theme, score }) => {
  let color = theme.palette.error.main;
  if (score >= 80) {
    color = theme.palette.success.main;
  } else if (score >= 60) {
    color = theme.palette.warning.main;
  } else if (score >= 40) {
    color = theme.palette.info.main;
  }

  return {
    position: 'relative',
    width: 120,
    height: 120,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: '50%',
    background: `conic-gradient(${color} ${score}%, #e0e0e0 0)`,
    '&::before': {
      content: '""',
      position: 'absolute',
      width: 100,
      height: 100,
      borderRadius: '50%',
      background: theme.palette.background.paper,
    }
  };
});

const GradeBadge = styled(Box)(({ theme, score }) => {
  let color = theme.palette.error.main;
  let grade = 'F';

  if (score >= 90) {
    color = theme.palette.success.dark;
    grade = 'A+';
  } else if (score >= 80) {
    color = theme.palette.success.main;
    grade = 'A';
  } else if (score >= 70) {
    color = theme.palette.success.light;
    grade = 'B';
  } else if (score >= 60) {
    color = theme.palette.warning.main;
    grade = 'C';
  } else if (score >= 50) {
    color = theme.palette.warning.light;
    grade = 'D';
  }

  return {
    width: 60,
    height: 60,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: '50%',
    background: color,
    color: 'white',
    fontWeight: 'bold',
    fontSize: '1.5rem',
    boxShadow: '0 4px 10px rgba(0, 0, 0, 0.2)',
    border: '3px solid white',
    grade
  };
});

const Results = () => {
  const theme = useTheme();
  const { resultId } = useParams();
  const navigate = useNavigate();

  const [results, setResults] = useState([]);
  const [detailedResult, setDetailedResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tabValue, setTabValue] = useState(0);

  useEffect(() => {
    const fetchResults = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fixed API endpoint
        const res = await api.get('/student/results');
        setResults(res.data);

        // If resultId is provided, fetch detailed result
        if (resultId) {
          await fetchDetailedResult(resultId);
        }

        setLoading(false);
      } catch (err) {
        console.error('Error fetching results:', err);
        console.error('Error response:', err.response);
        console.error('Error message:', err.message);
        console.error('Error status:', err.response?.status);
        setError(`Failed to load results: ${err.response?.data?.message || err.message || 'Please try again later.'}`);
        setLoading(false);
      }
    };

    fetchResults();
  }, [resultId]);

  const fetchDetailedResult = async (id) => {
    try {
      setDetailLoading(true);
      console.log('Fetching detailed result for ID:', id);

      // Fixed API endpoint with extended timeout for detailed results
      const res = await api.get(`/student/results/${id}`, {
        timeout: 30000 // 30 seconds timeout for detailed results with AI processing
      });
      console.log('Detailed result data received:', res.data);

      if (!res.data) {
        throw new Error('No data received from server');
      }

      setDetailedResult(res.data);
      setTabValue(0); // Reset tab when loading new result
      setDetailLoading(false);
    } catch (err) {
      console.error('Error fetching detailed result:', err);
      console.error('Error details:', err.response?.data || err.message);

      let errorMessage = 'Failed to load detailed result. Please try again later.';

      // Handle specific error types
      if (err.code === 'ECONNABORTED' || err.message.includes('timeout')) {
        errorMessage = 'Request timed out. The result is taking longer than expected to load. Please try again.';
      } else if (err.response?.status === 408) {
        errorMessage = 'The request timed out due to heavy processing. Please try again in a moment.';
      } else if (err.response?.data?.timeout) {
        errorMessage = `Request timed out after ${Math.round((err.response.data.duration || 30000) / 1000)} seconds. Please try again.`;
      } else if (err.response?.status === 404) {
        errorMessage = 'Result not found or not accessible.';
      }

      setError(errorMessage);
      setDetailLoading(false);

      // Navigate back to results list after a delay if there's an error
      setTimeout(() => {
        navigate('/student/results');
      }, 5000); // Increased delay for timeout errors
    }
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  // Format date
  const formatDate = (dateString) => {
    const options = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  // Calculate percentage
  const calculatePercentage = (score, maxScore) => {
    // Handle edge cases to prevent NaN
    if (!score || !maxScore || maxScore === 0) {
      return 0;
    }
    return Math.round((score / maxScore) * 100);
  };

  if (loading) {
    return (
      <StudentLayout>
        <Container maxWidth="md" sx={{
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
                  background: `radial-gradient(circle, ${alpha(theme.palette.primary.main, 0.1)} 0%, transparent 70%)`,
                  animation: 'loadingFloat 3s ease-in-out infinite',
                  '@keyframes loadingFloat': {
                    '0%, 100%': { transform: 'translateY(0px) scale(1)' },
                    '50%': { transform: 'translateY(-10px) scale(1.1)' }
                  }
                }}
              />

              <CircularProgress
                size={80}
                thickness={4}
                sx={{
                  color: theme.palette.primary.main,
                  animation: 'loadingPulse 2s ease-in-out infinite',
                  '@keyframes loadingPulse': {
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
                  background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Assessment sx={{ color: 'white', fontSize: '1.5rem' }} />
              </Box>
            </Box>
          </Fade>

          <Slide direction="up" in={true} timeout={1000}>
            <Typography
              variant="h5"
              sx={{
                mt: 4,
                fontWeight: 'bold',
                background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}
            >
              Loading Your Results...
            </Typography>
          </Slide>

          <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
            {detailLoading
              ? 'Loading detailed results with AI analysis...'
              : 'Please wait while we fetch your exam performance data'
            }
          </Typography>

          {detailLoading && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2, fontStyle: 'italic' }}>
              This may take up to 30 seconds for results with AI grading
            </Typography>
          )}
        </Container>
      </StudentLayout>
    );
  }

  if (error) {
    return (
      <StudentLayout>
        <Container maxWidth="md">
          <Alert
            severity="error"
            sx={{ mb: 4 }}
            action={
              <Button color="inherit" size="small" onClick={() => navigate('/student')}>
                Back to Dashboard
              </Button>
            }
          >
            {error}
          </Alert>
        </Container>
      </StudentLayout>
    );
  }

  // If resultId is provided, show detailed result
  if (resultId && detailedResult) {
    const percentage = calculatePercentage(detailedResult.totalScore, detailedResult.maxPossibleScore);

    // Group answers by section
    const sectionAnswers = {};
    detailedResult.answers.forEach(answer => {
      const section = answer.question.section;
      if (!sectionAnswers[section]) {
        sectionAnswers[section] = [];
      }
      sectionAnswers[section].push(answer);
    });

    return (
      <StudentLayout>
        <Container maxWidth="lg" sx={{ mb: 8 }}>
          <Grow in={true} timeout={800}>
          <Paper
            elevation={3}
            sx={{
              p: 3,
              mb: 4,
              borderRadius: 4,
              background: 'linear-gradient(135deg, #0D406C 0%, #1A5A8C 100%)',
              color: 'white',
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography variant="h4" component="h1" fontWeight="bold" gutterBottom>
                  {detailedResult.exam.title}
                </Typography>
                <Typography variant="subtitle1">
                  Completed on {formatDate(detailedResult.endTime)}
                </Typography>
              </Box>

              <Button
                variant="contained"
                color="secondary"
                onClick={() => navigate('/student/results')}
                startIcon={<ArrowBack />}
                sx={{ color: 'black', fontWeight: 'bold' }}
              >
                Back to Results
              </Button>
            </Box>
          </Paper>
        </Grow>

        <Grid container spacing={4}>
          {/* Score Summary */}
          <Grid item xs={12} md={4}>
            <Zoom in={true} style={{ transitionDelay: '200ms' }}>
              <Card elevation={3} sx={{ height: '100%' }}>
                <CardContent sx={{ p: 4, textAlign: 'center' }}>
                  <Typography variant="h5" component="h2" fontWeight="bold" gutterBottom>
                    Your Score
                  </Typography>

                  <Box sx={{ display: 'flex', justifyContent: 'center', my: 4, position: 'relative' }}>
                    <ScoreCircle score={percentage}>
                      <Box sx={{ position: 'relative', textAlign: 'center' }}>
                        <Typography variant="h4" component="div" fontWeight="bold">
                          {percentage}%
                        </Typography>
                      </Box>
                    </ScoreCircle>

                    <Box sx={{ position: 'absolute', bottom: -10, right: '30%' }}>
                      <GradeBadge score={percentage} />
                    </Box>
                  </Box>

                  <Typography variant="h6" gutterBottom>
                    {detailedResult.totalScore} / {detailedResult.maxPossibleScore} points
                  </Typography>

                  <Divider sx={{ my: 3 }} />

                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">
                        Start Time
                      </Typography>
                      <Typography variant="body1" fontWeight="medium">
                        {formatDate(detailedResult.startTime)}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">
                        End Time
                      </Typography>
                      <Typography variant="body1" fontWeight="medium">
                        {formatDate(detailedResult.endTime)}
                      </Typography>
                    </Grid>
                    <Grid item xs={12}>
                      <Typography variant="body2" color="text.secondary">
                        Time Taken
                      </Typography>
                      <Typography variant="body1" fontWeight="medium">
                        {Math.round((new Date(detailedResult.endTime) - new Date(detailedResult.startTime)) / 60000)} minutes
                      </Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Zoom>
          </Grid>

          {/* Detailed Results */}
          <Grid item xs={12} md={8}>
            <Zoom in={true} style={{ transitionDelay: '400ms' }}>
              <Card elevation={3}>
                <CardContent sx={{ p: 0 }}>
                  <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                    <Tabs
                      value={tabValue}
                      onChange={handleTabChange}
                      indicatorColor="primary"
                      textColor="primary"
                      variant="fullWidth"
                    >
                      <Tab label="Section A" />
                      <Tab label="Section B" />
                      <Tab label="Section C" />
                    </Tabs>
                  </Box>

                  {['A', 'B', 'C'].map((section, index) => (
                    <Box
                      key={section}
                      role="tabpanel"
                      hidden={tabValue !== index}
                      id={`section-tabpanel-${index}`}
                      aria-labelledby={`section-tab-${index}`}
                      sx={{ p: 3 }}
                    >
                      {tabValue === index && (
                        <>
                          <Typography variant="h6" fontWeight="bold" gutterBottom>
                            Section {section} Questions
                          </Typography>

                          {sectionAnswers[section] && sectionAnswers[section].length > 0 ? (
                            sectionAnswers[section].map((answer, answerIndex) => (
                              <Accordion
                                key={answer._id}
                                elevation={1}
                                sx={{
                                  mb: 2,
                                  borderLeft: '4px solid',
                                  borderColor: answer.isCorrect ? 'success.main' : 'error.main',
                                  '&:before': { display: 'none' }
                                }}
                              >
                                <AccordionSummary
                                  expandIcon={<ExpandMore />}
                                  aria-controls={`panel${answerIndex}-content`}
                                  id={`panel${answerIndex}-header`}
                                >
                                  <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'space-between' }}>
                                    <Typography fontWeight="medium">
                                      Question {answerIndex + 1}: {answer.question.text.substring(0, 50)}
                                      {answer.question.text.length > 50 ? '...' : ''}
                                    </Typography>
                                    <Box sx={{ display: 'flex', alignItems: 'center', ml: 2 }}>
                                      <Chip
                                        icon={answer.isCorrect ? <CheckCircle /> : <Cancel />}
                                        label={`${answer.score}/${answer.question.points} pts`}
                                        color={answer.isCorrect ? 'success' : 'error'}
                                        size="small"
                                        sx={{ ml: 1 }}
                                      />
                                    </Box>
                                  </Box>
                                </AccordionSummary>
                                <AccordionDetails>
                                  <Typography variant="body1" gutterBottom>
                                    <strong>Question:</strong> {answer.question.text}
                                  </Typography>

                                  {answer.question.type === 'multiple-choice' ? (
                                    <>
                                      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                                        <strong>Your Answer:</strong>
                                      </Typography>
                                      <Typography
                                        variant="body1"
                                        sx={{
                                          color: answer.isCorrect ? 'success.main' : 'error.main',
                                          fontWeight: 'medium'
                                        }}
                                      >
                                        {answer.selectedOption}
                                      </Typography>

                                      {!answer.isCorrect && (
                                        <>
                                          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                                            <strong>Correct Answer:</strong>
                                          </Typography>
                                          <Typography variant="body1" color="success.main" fontWeight="medium">
                                            {answer.question.correctAnswer}
                                          </Typography>
                                        </>
                                      )}

                                      {answer.feedback && (
                                        <>
                                          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                                            <strong>Feedback:</strong>
                                          </Typography>
                                          <Typography variant="body1">
                                            {answer.feedback}
                                          </Typography>
                                        </>
                                      )}
                                    </>
                                  ) : (
                                    <>
                                      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                                        <strong>Your Answer:</strong>
                                      </Typography>
                                      <Typography variant="body1" sx={{ mb: 2 }}>
                                        {answer.textAnswer || 'No answer provided'}
                                      </Typography>

                                      <Typography variant="body2" color="text.secondary">
                                        <strong>Model Answer:</strong>
                                      </Typography>
                                      <Typography variant="body1" sx={{ mb: 2 }}>
                                        {answer.question.correctAnswer}
                                      </Typography>

                                      {answer.feedback && (
                                        <>
                                          <Typography variant="body2" color="text.secondary">
                                            <strong>Feedback:</strong>
                                          </Typography>
                                          <Typography variant="body1">
                                            {answer.feedback}
                                          </Typography>
                                        </>
                                      )}
                                    </>
                                  )}
                                </AccordionDetails>
                              </Accordion>
                            ))
                          ) : (
                            <Typography variant="body1" color="text.secondary" align="center" sx={{ py: 4 }}>
                              No questions in this section.
                            </Typography>
                          )}
                        </>
                      )}
                    </Box>
                  ))}
                </CardContent>
              </Card>
            </Zoom>
          </Grid>
        </Grid>
        </Container>
      </StudentLayout>
    );
  }

  // Show list of all results
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
                ${theme.palette.primary.dark} 0%,
                ${theme.palette.primary.main} 50%,
                ${theme.palette.secondary.main} 100%)`,
              color: 'white',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: `0 25px 50px ${alpha(theme.palette.primary.main, 0.3)}`,
              transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
              '&:hover': {
                boxShadow: `0 30px 60px ${alpha(theme.palette.primary.main, 0.4)}`,
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
                animation: 'resultsFloat 10s ease-in-out infinite',
                '@keyframes resultsFloat': {
                  '0%': { transform: 'translateY(0px) rotate(0deg)' },
                  '50%': { transform: 'translateY(-20px) rotate(180deg)' },
                  '100%': { transform: 'translateY(0px) rotate(360deg)' }
                }
              }}
            />

            {/* Results sparkles */}
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
                  animation: `resultsSparkle 4s ease-in-out infinite ${i * 0.3}s`,
                  '@keyframes resultsSparkle': {
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
                    animation: 'resultsIconFloat 6s ease-in-out infinite',
                    '@keyframes resultsIconFloat': {
                      '0%, 100%': { transform: 'translateY(0px) rotate(0deg)' },
                      '50%': { transform: 'translateY(-8px) rotate(10deg)' }
                    }
                  }}
                >
                  <EmojiEvents sx={{ fontSize: { xs: '2rem', sm: '2.5rem' }, color: 'white' }} />
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
                    Your Exam Results 📊
                  </Typography>
                  <Typography
                    variant="h6"
                    sx={{
                      color: 'rgba(255,255,255,0.9)',
                      fontSize: { xs: '1rem', sm: '1.2rem' },
                      fontWeight: 'medium'
                    }}
                  >
                    Track your academic performance and achievements
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Chip
                  icon={<TrendingUp />}
                  label="Performance Analytics"
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
                  icon={<AutoGraph />}
                  label="Detailed Insights"
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

      {results.length > 0 ? (
        <Grid container spacing={{ xs: 2, sm: 3, md: 4 }}>
          {results.map((result, index) => {
            const percentage = calculatePercentage(result.totalScore, result.maxPossibleScore);

            return (
              <Grid item xs={12} sm={6} lg={4} key={result._id}>
                <Zoom in={true} style={{ transitionDelay: `${200 + (index * 100)}ms` }}>
                  <Card
                    elevation={8}
                    sx={{
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      position: 'relative',
                      overflow: 'hidden',
                      borderRadius: 4,
                      background: `linear-gradient(135deg,
                        ${alpha(theme.palette.background.paper, 0.9)} 0%,
                        ${alpha(theme.palette.background.paper, 1)} 100%)`,
                      border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                      transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                      '&:hover': {
                        transform: 'translateY(-12px) scale(1.02)',
                        boxShadow: `0 20px 40px ${alpha(theme.palette.primary.main, 0.2)}`,
                      }
                    }}
                  >
                    {/* Enhanced top indicator */}
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '6px',
                        background: percentage >= 80
                          ? `linear-gradient(90deg, ${theme.palette.success.main}, ${theme.palette.success.light})`
                          : percentage >= 60
                            ? `linear-gradient(90deg, ${theme.palette.warning.main}, ${theme.palette.warning.light})`
                            : `linear-gradient(90deg, ${theme.palette.error.main}, ${theme.palette.error.light})`,
                        boxShadow: `0 2px 8px ${alpha(
                          percentage >= 80 ? theme.palette.success.main :
                          percentage >= 60 ? theme.palette.warning.main : theme.palette.error.main,
                          0.3
                        )}`
                      }}
                    />

                    {/* Card glow effect */}
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        background: `radial-gradient(circle at top right, ${alpha(theme.palette.primary.main, 0.05)} 0%, transparent 50%)`,
                        animation: 'cardGlow 4s ease-in-out infinite alternate',
                        '@keyframes cardGlow': {
                          '0%': { opacity: 0.3 },
                          '100%': { opacity: 0.6 }
                        }
                      }}
                    />

                    <CardContent sx={{ flexGrow: 1, pt: 4, px: 3, position: 'relative', zIndex: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
                        <Box sx={{ flex: 1, mr: 2 }}>
                          <Typography
                            variant="h6"
                            component="h2"
                            fontWeight="bold"
                            sx={{
                              fontSize: { xs: '1.1rem', sm: '1.25rem' },
                              background: `linear-gradient(135deg, ${theme.palette.text.primary}, ${alpha(theme.palette.text.primary, 0.8)})`,
                              WebkitBackgroundClip: 'text',
                              WebkitTextFillColor: 'transparent',
                              backgroundClip: 'text',
                              mb: 1,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical'
                            }}
                          >
                            {result.exam.title}
                          </Typography>

                          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                            {result.exam.description}
                          </Typography>

                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                            <Chip
                              icon={result.passed ? <CheckCircle sx={{ fontSize: '0.8rem' }} /> : <Cancel sx={{ fontSize: '0.8rem' }} />}
                              label={result.passed ? 'Passed' : 'Failed'}
                              size="small"
                              sx={{
                                bgcolor: result.passed ? alpha(theme.palette.success.main, 0.1) : alpha(theme.palette.error.main, 0.1),
                                color: result.passed ? theme.palette.success.main : theme.palette.error.main,
                                fontWeight: 'medium',
                                fontSize: '0.7rem',
                                height: 20,
                                '& .MuiChip-icon': {
                                  color: result.passed ? theme.palette.success.main : theme.palette.error.main
                                }
                              }}
                            />
                            <Chip
                              icon={<WorkspacePremium sx={{ fontSize: '0.8rem' }} />}
                              label="Completed"
                              size="small"
                              sx={{
                                bgcolor: alpha(theme.palette.success.main, 0.1),
                                color: theme.palette.success.main,
                                fontWeight: 'medium',
                                fontSize: '0.7rem',
                                height: 20,
                                '& .MuiChip-icon': {
                                  color: theme.palette.success.main
                                }
                              }}
                            />
                            <Chip
                              icon={<Verified sx={{ fontSize: '0.7rem' }} />}
                              label="Graded"
                              size="small"
                              sx={{
                                bgcolor: alpha(theme.palette.info.main, 0.1),
                                color: theme.palette.info.main,
                                fontWeight: 'medium',
                                fontSize: '0.65rem',
                                height: 18,
                                '& .MuiChip-icon': {
                                  color: theme.palette.info.main
                                }
                              }}
                            />
                          </Box>
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'center', flexDirection: 'column', gap: 0.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Box
                                key={star}
                                component={star <= Math.ceil(percentage / 20) ? Star : StarBorder}
                                sx={{
                                  color: theme.palette.warning.main,
                                  fontSize: '1.1rem',
                                  animation: star <= Math.ceil(percentage / 20) ? 'starShine 2s ease-in-out infinite' : 'none',
                                  animationDelay: `${star * 0.1}s`,
                                  '@keyframes starShine': {
                                    '0%, 100%': { opacity: 1, transform: 'scale(1)' },
                                    '50%': { opacity: 0.7, transform: 'scale(1.1)' }
                                  }
                                }}
                              />
                            ))}
                          </Box>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                            {Math.ceil(percentage / 20)}/5 stars
                          </Typography>
                        </Box>
                      </Box>

                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, p: 1.5, borderRadius: 2, bgcolor: alpha(theme.palette.grey[100], 0.5) }}>
                        <Avatar
                          sx={{
                            width: 32,
                            height: 32,
                            bgcolor: theme.palette.info.main,
                            mr: 1.5
                          }}
                        >
                          <AccessTime sx={{ fontSize: '1rem' }} />
                        </Avatar>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem', fontWeight: 'medium' }}>
                            Completed on {formatDate(result.endTime)}
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 2, mt: 0.5 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                              <strong>Time:</strong> {result.exam.timeLimit} min
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                              <strong>Questions:</strong> {result.exam.totalQuestions || 'N/A'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                              <strong>Passing Score:</strong> {result.exam.passingScore}%
                            </Typography>
                          </Box>
                        </Box>
                      </Box>

                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="body2" color="text.secondary" gutterBottom sx={{ fontWeight: 'medium' }}>
                            Your Performance
                          </Typography>
                          <Typography
                            variant="h4"
                            fontWeight="bold"
                            sx={{
                              fontSize: { xs: '1.8rem', sm: '2rem' },
                              background: percentage >= 80
                                ? `linear-gradient(135deg, ${theme.palette.success.main}, ${theme.palette.success.dark})`
                                : percentage >= 60
                                  ? `linear-gradient(135deg, ${theme.palette.warning.main}, ${theme.palette.warning.dark})`
                                  : `linear-gradient(135deg, ${theme.palette.error.main}, ${theme.palette.error.dark})`,
                              WebkitBackgroundClip: 'text',
                              WebkitTextFillColor: 'transparent',
                              backgroundClip: 'text',
                              mb: 0.5
                            }}
                          >
                            {percentage}%
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 'medium' }}>
                            {result.totalScore} / {result.maxPossibleScore} points
                          </Typography>
                        </Box>

                        <Box sx={{ position: 'relative' }}>
                          <Box
                            sx={{
                              position: 'absolute',
                              top: -4,
                              left: -4,
                              right: -4,
                              bottom: -4,
                              borderRadius: '50%',
                              background: `conic-gradient(
                                ${percentage >= 80 ? theme.palette.success.main :
                                  percentage >= 60 ? theme.palette.warning.main : theme.palette.error.main} 0deg,
                                ${percentage >= 80 ? theme.palette.success.light :
                                  percentage >= 60 ? theme.palette.warning.light : theme.palette.error.light} 120deg,
                                ${percentage >= 80 ? theme.palette.success.main :
                                  percentage >= 60 ? theme.palette.warning.main : theme.palette.error.main} 240deg
                              )`,
                              animation: 'gradeRotate 8s linear infinite',
                              '@keyframes gradeRotate': {
                                '0%': { transform: 'rotate(0deg)' },
                                '100%': { transform: 'rotate(360deg)' }
                              }
                            }}
                          />
                          <GradeBadge score={percentage} />
                        </Box>
                      </Box>

                      <LinearProgress
                        variant="determinate"
                        value={percentage}
                        sx={{
                          height: 10,
                          borderRadius: 5,
                          mb: 3,
                          bgcolor: alpha(theme.palette.grey[300], 0.3),
                          '& .MuiLinearProgress-bar': {
                            borderRadius: 5,
                            background: percentage >= 80
                              ? `linear-gradient(90deg, ${theme.palette.success.main}, ${theme.palette.success.light})`
                              : percentage >= 60
                                ? `linear-gradient(90deg, ${theme.palette.warning.main}, ${theme.palette.warning.light})`
                                : `linear-gradient(90deg, ${theme.palette.error.main}, ${theme.palette.error.light})`,
                            boxShadow: `0 2px 8px ${alpha(
                              percentage >= 80 ? theme.palette.success.main :
                              percentage >= 60 ? theme.palette.warning.main : theme.palette.error.main,
                              0.3
                            )}`
                          }
                        }}
                      />
                    </CardContent>

                    <Divider sx={{ opacity: 0.3 }} />

                    <Box sx={{ p: 3 }}>
                      <Button
                        variant="contained"
                        color="primary"
                        component={RouterLink}
                        to={`/student/results/${result._id}`}
                        fullWidth
                        startIcon={<Assessment />}
                        sx={{
                          py: 1.5,
                          fontWeight: 'bold',
                          fontSize: '0.9rem',
                          borderRadius: 3,
                          background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
                          boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.3)}`,
                          position: 'relative',
                          overflow: 'hidden',
                          transition: 'all 0.3s ease',
                          '&::before': {
                            content: '""',
                            position: 'absolute',
                            top: 0,
                            left: '-100%',
                            width: '100%',
                            height: '100%',
                            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
                            transition: 'all 0.6s ease'
                          },
                          '&:hover': {
                            transform: 'translateY(-2px)',
                            boxShadow: `0 6px 16px ${alpha(theme.palette.primary.main, 0.4)}`,
                            '&::before': {
                              left: '100%'
                            }
                          }
                        }}
                      >
                        View Detailed Analysis
                      </Button>
                    </Box>
                  </Card>
                </Zoom>
              </Grid>
            );
          })}
        </Grid>
      ) : (
        <Fade in={true} timeout={1000}>
          <Paper
            elevation={8}
            sx={{
              p: { xs: 4, sm: 6, md: 8 },
              textAlign: 'center',
              borderRadius: 4,
              background: `linear-gradient(135deg,
                ${alpha(theme.palette.background.paper, 0.9)} 0%,
                ${alpha(theme.palette.background.paper, 1)} 100%)`,
              border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
              position: 'relative',
              overflow: 'hidden',
              minHeight: '400px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {/* Empty state decorative elements */}
            <Box
              sx={{
                position: 'absolute',
                top: -30,
                right: -30,
                width: '200px',
                height: '200px',
                background: `radial-gradient(circle, ${alpha(theme.palette.primary.main, 0.05)} 0%, transparent 70%)`,
                borderRadius: '50%',
                animation: 'emptyStateFloat 8s ease-in-out infinite',
                '@keyframes emptyStateFloat': {
                  '0%, 100%': { transform: 'translateY(0px) rotate(0deg)' },
                  '50%': { transform: 'translateY(-20px) rotate(180deg)' }
                }
              }}
            />

            <Avatar
              sx={{
                width: { xs: 80, sm: 100 },
                height: { xs: 80, sm: 100 },
                bgcolor: alpha(theme.palette.primary.main, 0.1),
                mb: 3,
                animation: 'emptyStateIconFloat 6s ease-in-out infinite',
                '@keyframes emptyStateIconFloat': {
                  '0%, 100%': { transform: 'translateY(0px)' },
                  '50%': { transform: 'translateY(-10px)' }
                }
              }}
            >
              <Assessment sx={{
                fontSize: { xs: '2.5rem', sm: '3rem' },
                color: theme.palette.primary.main,
                opacity: 0.7
              }} />
            </Avatar>

            <Typography
              variant="h4"
              fontWeight="bold"
              sx={{
                mb: 2,
                fontSize: { xs: '1.5rem', sm: '2rem' },
                background: `linear-gradient(135deg, ${theme.palette.text.primary}, ${alpha(theme.palette.text.primary, 0.7)})`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}
            >
              No Results Yet 📋
            </Typography>

            <Typography
              variant="h6"
              color="text.secondary"
              sx={{
                mb: 4,
                maxWidth: '500px',
                fontSize: { xs: '1rem', sm: '1.1rem' },
                lineHeight: 1.6
              }}
            >
              You haven't completed any exams yet. Start taking exams to see your performance analytics and detailed results here.
            </Typography>

            <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
              <Button
                variant="contained"
                color="primary"
                component={RouterLink}
                to="/student/exams"
                size="large"
                startIcon={<School />}
                sx={{
                  px: 4,
                  py: 1.5,
                  fontWeight: 'bold',
                  borderRadius: 3,
                  background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
                  boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.3)}`,
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: `0 6px 16px ${alpha(theme.palette.primary.main, 0.4)}`
                  }
                }}
              >
                Browse Available Exams
              </Button>

              <Button
                variant="outlined"
                color="primary"
                component={RouterLink}
                to="/student/dashboard"
                size="large"
                startIcon={<TrendingUp />}
                sx={{
                  px: 4,
                  py: 1.5,
                  fontWeight: 'bold',
                  borderRadius: 3,
                  borderWidth: 2,
                  '&:hover': {
                    borderWidth: 2,
                    transform: 'translateY(-2px)',
                    boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.2)}`
                  }
                }}
              >
                Go to Dashboard
              </Button>
            </Box>
          </Paper>
        </Fade>
      )}
      </Container>
    </StudentLayout>
  );
};

export default Results;
