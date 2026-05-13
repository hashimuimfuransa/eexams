import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Paper,
  Button,
  CircularProgress,
  Grow,
  Divider,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  useTheme,
  Chip,
  Avatar
} from '@mui/material';
import {
  Timer,
  Info,
  Warning,
  CheckCircle,
  ArrowForward,
  Block,
  LockOutlined,
  CheckBox,
  QuestionAnswer,
  School,
  Star
} from '@mui/icons-material';
import { styled, alpha } from '@mui/material/styles';
import { useThemeMode } from '../../context/ThemeContext';
import api from '../../services/api';

const ExamCountdown = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const { mode } = useThemeMode();

  const [exam, setExam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [countdown, setCountdown] = useState(5);
  const [startingExam, setStartingExam] = useState(false);

  // Fetch exam details
  useEffect(() => {
    const fetchExam = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/exam/${id}`);

        // Check if exam is locked
        if (response.data.isLocked) {
          setError('This exam is currently locked by the administrator. Please try again later.');
          setLoading(false);
          return;
        }

        setExam(response.data);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching exam:', err);
        setError(err.response?.data?.message || 'Failed to load exam. Please try again later.');
        setLoading(false);
      }
    };

    fetchExam();
  }, [id]);

  // Countdown timer
  useEffect(() => {
    if (!loading && !error && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);

      return () => clearTimeout(timer);
    } else if (countdown === 0 && !startingExam) {
      handleStartExam();
    }
  }, [countdown, loading, error, startingExam]);

  // Prevent navigation away
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
      return '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // Start the exam
  const handleStartExam = async () => {
    try {
      setStartingExam(true);

      // Start the exam
      await api.post(`/exam/${id}/start`);

      // Navigate to the exam interface
      navigate(`/student/exam/${id}`);
    } catch (err) {
      console.error('Error starting exam:', err);
      setError(err.response?.data?.message || 'Failed to start exam. Please try again later.');
      setStartingExam(false);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ mt: 8, textAlign: 'center' }}>
        <CircularProgress size={60} />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Loading exam...
        </Typography>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="md" sx={{ mt: 8 }}>
        <Paper
          elevation={3}
          sx={{
            p: 4,
            textAlign: 'center',
            borderRadius: 0,
            position: 'relative',
            overflow: 'hidden',
            mb: 4
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '4px',
              bgcolor: 'error.main',
            }}
          />

          <Typography variant="h5" component="h1" fontWeight="bold" gutterBottom color="error.main">
            {error.includes('locked') ? 'Exam Locked' : 'Error'}
          </Typography>

          {error.includes('locked') && (
            <Box sx={{ my: 3, display: 'flex', justifyContent: 'center' }}>
              <LockOutlined sx={{ fontSize: 60, color: 'error.main', opacity: 0.7 }} />
            </Box>
          )}

          <Typography variant="body1" paragraph>
            {error}
          </Typography>

          <Typography variant="body2" color="text.secondary" paragraph>
            Please contact your administrator if you believe this is an error.
          </Typography>

          <Button
            variant="contained"
            color="primary"
            onClick={() => navigate('/student/exams')}
            sx={{ mt: 2, borderRadius: 0 }}
          >
            Back to Exams
          </Button>
        </Paper>
      </Container>
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: mode === 'dark'
          ? 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%)'
          : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        py: 8
      }}
    >
      <Container maxWidth="md">
        <Grow in={true} timeout={800}>
          <Paper
            elevation={mode === 'dark' ? 12 : 6}
            sx={{
              p: 4,
              borderRadius: '16px',
              position: 'relative',
              overflow: 'hidden',
              bgcolor: mode === 'dark'
                ? alpha(theme.palette.background.paper, 0.95)
                : 'background.paper',
              backdropFilter: 'blur(20px)',
              border: mode === 'dark'
                ? `1px solid ${alpha(theme.palette.primary.main, 0.3)}`
                : 'none',
              boxShadow: mode === 'dark'
                ? '0 16px 48px rgba(0,0,0,0.4)'
                : '0 12px 40px rgba(0,0,0,0.15)'
            }}
          >
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '4px',
                background: exam?.allowSelectiveAnswering
                  ? 'linear-gradient(90deg, #9c27b0 0%, #e91e63 100%)'
                  : 'linear-gradient(90deg, #1976d2 0%, #42a5f5 100%)',
              }}
            />

          <Typography variant="h4" component="h1" fontWeight="bold" gutterBottom textAlign="center">
            {exam.title}
          </Typography>

          <Typography variant="body1" color="text.secondary" paragraph textAlign="center">
            {exam.description}
          </Typography>

          {/* Enhanced Exam Type Indicator */}
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
            <Chip
              icon={exam.allowSelectiveAnswering ? <Star fontSize="small" /> : <QuestionAnswer fontSize="small" />}
              label={exam.allowSelectiveAnswering ? 'Selective Answering Exam' : 'Standard Exam'}
              size="medium"
              sx={{
                borderRadius: '12px',
                fontWeight: 'bold',
                bgcolor: exam.allowSelectiveAnswering
                  ? mode === 'dark'
                    ? alpha(theme.palette.secondary.main, 0.15)
                    : alpha(theme.palette.secondary.main, 0.08)
                  : mode === 'dark'
                    ? alpha(theme.palette.primary.main, 0.15)
                    : alpha(theme.palette.primary.main, 0.08),
                color: exam.allowSelectiveAnswering
                  ? theme.palette.secondary.main
                  : theme.palette.primary.main,
                border: `1px solid ${exam.allowSelectiveAnswering
                  ? alpha(theme.palette.secondary.main, 0.3)
                  : alpha(theme.palette.primary.main, 0.3)}`,
                '& .MuiChip-icon': {
                  color: exam.allowSelectiveAnswering
                    ? theme.palette.secondary.main
                    : theme.palette.primary.main
                }
              }}
            />
          </Box>

          <Divider sx={{
            my: 3,
            bgcolor: mode === 'dark'
              ? alpha(theme.palette.divider, 0.2)
              : 'divider'
          }} />

          <Box sx={{ textAlign: 'center', my: 4 }}>
            <Typography variant="h6" gutterBottom>
              Your exam will start in:
            </Typography>

            <Box
              sx={{
                display: 'inline-flex',
                position: 'relative',
                justifyContent: 'center',
                alignItems: 'center',
                my: 3
              }}
            >
              <CircularProgress
                variant="determinate"
                value={((5 - countdown) / 5) * 100}
                size={140}
                thickness={6}
                sx={{
                  color: exam?.allowSelectiveAnswering
                    ? theme.palette.secondary.main
                    : theme.palette.primary.main,
                  filter: mode === 'dark' ? 'drop-shadow(0 0 8px rgba(25, 118, 210, 0.5))' : 'none'
                }}
              />
              <Box
                sx={{
                  position: 'absolute',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Typography
                  variant="h2"
                  component="div"
                  fontWeight="bold"
                  sx={{
                    color: exam?.allowSelectiveAnswering
                      ? theme.palette.secondary.main
                      : theme.palette.primary.main,
                    textShadow: mode === 'dark' ? '0 0 10px rgba(25, 118, 210, 0.5)' : 'none'
                  }}
                >
                  {countdown}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mt: -1 }}>
                  seconds
                </Typography>
              </Box>
            </Box>
          </Box>

          <Alert
            severity="warning"
            sx={{
              mb: 3,
              borderRadius: '12px',
              bgcolor: mode === 'dark'
                ? alpha(theme.palette.warning.main, 0.1)
                : alpha(theme.palette.warning.main, 0.05),
              border: `1px solid ${alpha(theme.palette.warning.main, 0.3)}`,
              '& .MuiAlert-icon': {
                color: theme.palette.warning.main
              }
            }}
          >
            <Typography variant="body1" fontWeight="medium">
              Important: Do not leave or refresh this page. Your exam will start automatically.
            </Typography>
          </Alert>

          {/* Enhanced Selective Answering Alert */}
          {exam.allowSelectiveAnswering && (
            <Alert
              severity="info"
              sx={{
                mb: 3,
                borderRadius: '12px',
                bgcolor: mode === 'dark'
                  ? alpha(theme.palette.secondary.main, 0.1)
                  : alpha(theme.palette.secondary.main, 0.05),
                border: `1px solid ${alpha(theme.palette.secondary.main, 0.3)}`,
                borderLeft: `4px solid ${theme.palette.secondary.main}`,
                '& .MuiAlert-icon': {
                  color: theme.palette.secondary.main
                }
              }}
              icon={<CheckBox color="secondary" />}
            >
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                Selective Answering Enabled for this Exam
              </Typography>
              <Typography variant="body2">
                In this exam, you can choose which questions to answer in Sections B and C.
                You'll need to select {exam.sectionBRequiredQuestions} questions from Section B and {exam.sectionCRequiredQuestions} questions from Section C.
                Unselected questions won't count against your score.
              </Typography>
            </Alert>
          )}

          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Exam Details:
            </Typography>

            <List>
              <ListItem>
                <ListItemIcon>
                  <Timer color="primary" />
                </ListItemIcon>
                <ListItemText
                  primary="Time Limit"
                  secondary={`${exam.timeLimit} minutes`}
                />
              </ListItem>

              <ListItem>
                <ListItemIcon>
                  <Info color="primary" />
                </ListItemIcon>
                <ListItemText
                  primary="Questions"
                  secondary={`${exam.sections?.reduce((total, section) => total + section.questions.length, 0) || 0} questions in ${exam.sections?.length || 0} sections`}
                />
              </ListItem>

              <ListItem>
                <ListItemIcon>
                  <Warning color="error" />
                </ListItemIcon>
                <ListItemText
                  primary="Important"
                  secondary="Once started, you must complete the exam. The timer cannot be paused."
                />
              </ListItem>

              {/* Selective Answering Information */}
              {exam.allowSelectiveAnswering && (
                <ListItem>
                  <ListItemIcon>
                    <CheckBox color="secondary" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Selective Answering Enabled"
                    secondary={
                      <React.Fragment>
                        <Typography variant="body2" component="span">
                          You can choose which questions to answer in Sections B and C:
                        </Typography>
                        <Box component="ul" sx={{ mt: 0.5, mb: 0 }}>
                          <Box component="li">
                            <Typography variant="body2">
                              Section B: Select any {exam.sectionBRequiredQuestions || '?'} questions
                            </Typography>
                          </Box>
                          <Box component="li">
                            <Typography variant="body2">
                              Section C: Select any {exam.sectionCRequiredQuestions || '?'} questions
                            </Typography>
                          </Box>
                        </Box>
                      </React.Fragment>
                    }
                  />
                </ListItem>
              )}
            </List>
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4, gap: 2 }}>
            <Button
              variant="outlined"
              color="error"
              onClick={() => navigate('/student/exams')}
              startIcon={<Block />}
              sx={{
                borderRadius: '12px',
                py: 1.5,
                px: 3,
                fontWeight: 'bold',
                border: `2px solid ${theme.palette.error.main}`,
                bgcolor: mode === 'dark'
                  ? alpha(theme.palette.error.main, 0.1)
                  : 'transparent',
                '&:hover': {
                  bgcolor: alpha(theme.palette.error.main, 0.1),
                  transform: 'translateY(-2px)',
                  boxShadow: mode === 'dark'
                    ? '0 6px 20px rgba(244, 67, 54, 0.3)'
                    : '0 4px 12px rgba(244, 67, 54, 0.2)',
                }
              }}
              disabled={countdown <= 2 || startingExam}
            >
              Cancel
            </Button>

            <Button
              variant="contained"
              onClick={handleStartExam}
              endIcon={startingExam ? <CircularProgress size={20} color="inherit" /> : <ArrowForward />}
              sx={{
                borderRadius: '12px',
                py: 1.5,
                px: 4,
                fontWeight: 'bold',
                background: exam?.allowSelectiveAnswering
                  ? `linear-gradient(135deg, ${theme.palette.secondary.main}, ${theme.palette.secondary.dark})`
                  : `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
                boxShadow: mode === 'dark'
                  ? exam?.allowSelectiveAnswering
                    ? '0 6px 20px rgba(156, 39, 176, 0.4)'
                    : '0 6px 20px rgba(25, 118, 210, 0.4)'
                  : '0 4px 12px rgba(0,0,0,0.2)',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: mode === 'dark'
                    ? exam?.allowSelectiveAnswering
                      ? '0 8px 25px rgba(156, 39, 176, 0.5)'
                      : '0 8px 25px rgba(25, 118, 210, 0.5)'
                    : '0 6px 16px rgba(0,0,0,0.3)',
                }
              }}
              disabled={startingExam}
            >
              {startingExam ? 'Starting Exam...' : 'Start Now'}
            </Button>
          </Box>
          </Paper>
        </Grow>
      </Container>
    </Box>
  );
};

export default ExamCountdown;
