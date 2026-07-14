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
  useMediaQuery,
  alpha,
  Avatar,
  Slide,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  MenuItem,
  Select,
  TextField
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
  Psychology,
  Lightbulb,
  ErrorOutline,
  TaskAlt,
  QuestionAnswer,
  Feedback,
  BarChart,
  CompareArrows,
  SwapHoriz,
  FormatListNumbered,
  DragIndicator,
  RadioButtonChecked,
  TextFields,
  Leaderboard,
  ReportProblem
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import api from '../../services/api';
import StudentLayout from './StudentLayout';
import FinancialSpreadsheet from '../FinancialSpreadsheet';

// Google Play Icon SVG
const GooglePlayIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.3,13.1L18.06,14.37L15.5,11.81L18.06,9.25L20.3,10.5C20.93,10.86 20.93,11.73 20.3,13.1M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z" />
  </svg>
);

// Microsoft Store Icon SVG
const MicrosoftStoreIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <path d="M1,1H11V11H1V1M13,1H23V11H13V1M1,13H11V23H1V13M13,13H23V23H13V13Z" />
  </svg>
);

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
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { resultId } = useParams();
  const navigate = useNavigate();

  const [results, setResults] = useState([]);
  const [detailedResult, setDetailedResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tabValue, setTabValue] = useState(0);
  const [claimDialogOpen, setClaimDialogOpen] = useState(false);
  const [claimText, setClaimText] = useState('');
  const [claimCategory, setClaimCategory] = useState('other');
  const [claimPriority, setClaimPriority] = useState('medium');
  const [submittingClaim, setSubmittingClaim] = useState(false);
  const [myReclamations, setMyReclamations] = useState([]);
  const [reclamationsLoading, setReclamationsLoading] = useState(false);
  const [reclamationsDialogOpen, setReclamationsDialogOpen] = useState(false);

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

  const fetchMyReclamations = async () => {
    try {
      setReclamationsLoading(true);
      const res = await api.get('/reclamations/my-reclamations');
      setMyReclamations(res.data);
    } catch (err) {
      console.error('Error fetching my reclamations:', err);
    } finally {
      setReclamationsLoading(false);
    }
  };

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

  const handleSubmitClaim = async () => {
    if (!claimText.trim()) return;
    
    setSubmittingClaim(true);
    try {
      await api.post('/reclamations', {
        resultId: detailedResult._id,
        examId: detailedResult.exam._id,
        claim: claimText,
        category: claimCategory,
        priority: claimPriority
      });
      setClaimDialogOpen(false);
      setClaimText('');
      setClaimCategory('other');
      setClaimPriority('medium');
      alert('Reclamation submitted successfully. Your teacher and organization admin will review it.');
    } catch (err) {
      console.error('Error submitting claim:', err);
      alert('Failed to submit reclamation. Please try again.');
    } finally {
      setSubmittingClaim(false);
    }
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

  // ─── Helper: render label from a matching item ────────────────────────────
  const getMatchLabel = (item) => {
    if (item === null || item === undefined) return 'Unknown';
    if (typeof item === 'string') return item;
    if (typeof item === 'number') return String(item);
    if (typeof item === 'object') {
      if (item.text) return String(item.text);
      if (item.label) return String(item.label);
      if (item.value) return String(item.value);
      try { return JSON.stringify(item); } catch { return 'Object'; }
    }
    return String(item);
  };

  // ─── Helper: colour-coded score badge ─────────────────────────────────────
  const scoreBadgeColor = (pct) => {
    if (pct >= 80) return 'success';
    if (pct >= 60) return 'warning';
    return 'error';
  };

  // ─── Per-answer detail renderer ───────────────────────────────────────────
  const renderAnswerDetail = (answer) => {
    const qType = answer.question?.type || 'open-ended';
    const notAnswered = !answer.selectedOption && !answer.textAnswer &&
      (!answer.matchingAnswers || answer.matchingAnswers.length === 0) &&
      (!answer.subQuestionAnswers || answer.subQuestionAnswers.length === 0);

    const labelStyle = {
      fontWeight: 700, fontSize: 10, textTransform: 'uppercase',
      letterSpacing: 0.8, mb: 0.5, display: 'block', color: 'text.secondary'
    };

    return (
      <Box sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>

        {/* ── Full question text ── */}
        <Box sx={{ mb: 2, p: { xs: 1.5, sm: 2 }, bgcolor: 'grey.50', borderRadius: 2,
          borderLeft: '4px solid', borderColor: 'primary.main' }}>
          <Typography sx={{ ...labelStyle, mb: 0.75 }}>Full Question</Typography>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, fontSize: { xs: '0.875rem', sm: '1rem' } }}>
            {String(answer.question?.text || '')}
          </Typography>
          {answer.question?.points && (
            <Chip label={`${answer.question.points} point${answer.question.points !== 1 ? 's' : ''}`}
              size="small" variant="outlined" sx={{ mt: 1, fontSize: 10, height: 20 }} />
          )}
        </Box>

        {/* ── Not answered banner ── */}
        {notAnswered && (
          <Box sx={{ mb: 2, p: 1.5, bgcolor: alpha(theme.palette.error.main, 0.08), borderRadius: 2,
            border: '1px solid', borderColor: 'error.light',
            display: 'flex', alignItems: 'center', gap: 1 }}>
            <Cancel fontSize="small" sx={{ color: 'error.main', flexShrink: 0 }} />
            <Typography variant="body2" color="error.main" fontWeight={700}>
              This question was not answered — 0 points awarded
            </Typography>
          </Box>
        )}

        {/* ── Multiple Choice ── */}
        {qType === 'multiple-choice' && (
          <Box sx={{ mb: 2 }}>
            {answer.question?.options && answer.question.options.length > 0 ? (
              <>
                <Typography sx={labelStyle}>Answer Options</Typography>
                {answer.question.options.map((opt, oi) => {
                  const optText = typeof opt === 'object' ? opt.text : String(opt);
                  const letter = String.fromCharCode(65 + oi);
                  const isStudentAnswer = answer.selectedOptionLetter === letter ||
                    answer.selectedOption === optText ||
                    (!answer.selectedOptionLetter && !answer.selectedOption && false);
                  const isCorrectOpt = answer.correctOptionLetter === letter ||
                    answer.question?.correctAnswer === optText ||
                    answer.correctedAnswer === optText;
                  const highlight = isCorrectOpt || isStudentAnswer;
                  return (
                    <Box key={oi} sx={{
                      display: 'flex', alignItems: 'flex-start', gap: 1,
                      p: { xs: 1, sm: 1.25 }, mb: 0.75, borderRadius: 2,
                      bgcolor: isCorrectOpt
                        ? alpha(theme.palette.success.main, 0.1)
                        : isStudentAnswer
                          ? alpha(theme.palette.error.main, 0.09)
                          : 'grey.50',
                      border: '1.5px solid',
                      borderColor: isCorrectOpt ? 'success.light' : isStudentAnswer ? 'error.light' : 'transparent'
                    }}>
                      <Box sx={{
                        width: 26, height: 26, minWidth: 26, borderRadius: '50%', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12,
                        bgcolor: isCorrectOpt ? 'success.main' : isStudentAnswer ? 'error.main' : 'grey.300',
                        color: highlight ? 'white' : 'text.primary', mt: 0.1
                      }}>
                        {letter}
                      </Box>
                      <Typography variant="body2" sx={{ flex: 1, fontWeight: highlight ? 600 : 400, mt: 0.25 }}>
                        {optText}
                      </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.4, flexShrink: 0 }}>
                        {isCorrectOpt && (
                          <Chip label="✓ Correct" size="small" color="success"
                            sx={{ fontSize: 10, height: 20, fontWeight: 700 }} />
                        )}
                        {isStudentAnswer && !isCorrectOpt && (
                          <Chip label="✗ Your answer" size="small" color="error"
                            sx={{ fontSize: 10, height: 20, fontWeight: 700 }} />
                        )}
                        {isStudentAnswer && isCorrectOpt && (
                          <Chip label="✓ Your answer" size="small" color="success"
                            sx={{ fontSize: 10, height: 20, fontWeight: 700 }} />
                        )}
                      </Box>
                    </Box>
                  );
                })}

                {/* Always show the correct answer clearly at bottom */}
                {!answer.isCorrect && (
                  <Box sx={{ mt: 1.5, p: 1.25, bgcolor: alpha(theme.palette.success.main, 0.08), borderRadius: 2,
                    border: '1px solid', borderColor: 'success.light',
                    display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TaskAlt fontSize="small" sx={{ color: 'success.main', flexShrink: 0 }} />
                    <Typography variant="body2" fontWeight={700} color="success.dark">
                      Correct answer: {answer.correctOptionLetter ? `${answer.correctOptionLetter}. ` : ''}
                      {String(answer.question?.correctAnswer || answer.correctedAnswer || 'See highlighted option above')}
                    </Typography>
                  </Box>
                )}
              </>
            ) : (
              /* No options stored — show plain text fields */
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Box>
                  <Typography sx={labelStyle}>Your Answer</Typography>
                  <Box sx={{ p: 1.5, bgcolor: notAnswered ? alpha(theme.palette.error.main, 0.07) : answer.isCorrect ? alpha(theme.palette.success.main, 0.07) : alpha(theme.palette.error.main, 0.07),
                    borderRadius: 1.5, border: '1px solid', borderColor: notAnswered ? 'error.light' : answer.isCorrect ? 'success.light' : 'error.light' }}>
                    <Typography variant="body2" sx={{ color: notAnswered ? 'text.secondary' : answer.isCorrect ? 'success.dark' : 'error.dark', fontStyle: notAnswered ? 'italic' : 'normal' }}>
                      {notAnswered ? 'Not answered' : (answer.selectedOptionLetter ? `${answer.selectedOptionLetter}. ` : '') + String(answer.selectedOption || '')}
                    </Typography>
                  </Box>
                </Box>
                <Box>
                  <Typography sx={labelStyle}>Correct Answer</Typography>
                  <Box sx={{ p: 1.5, bgcolor: alpha(theme.palette.success.main, 0.07), borderRadius: 1.5, border: '1px solid', borderColor: 'success.light' }}>
                    <Typography variant="body2" color="success.dark" fontWeight={600}>
                      {answer.correctOptionLetter ? `${answer.correctOptionLetter}. ` : ''}{String(answer.question?.correctAnswer || answer.correctedAnswer || 'N/A')}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            )}
          </Box>
        )}

        {/* ── True / False ── */}
        {qType === 'true-false' && (
          <Box sx={{ mb: 2 }}>
            <Typography sx={labelStyle}>Answer Options</Typography>
            {['True', 'False'].map((optText, oi) => {
              const letter = oi === 0 ? 'A' : 'B';
              const isStudentAnswer =
                answer.selectedOptionLetter === letter ||
                answer.selectedOption?.toLowerCase() === optText.toLowerCase() ||
                answer.textAnswer?.toLowerCase() === optText.toLowerCase();
              const isCorrectOpt =
                answer.correctOptionLetter === letter ||
                answer.question?.correctAnswer?.toLowerCase() === optText.toLowerCase() ||
                answer.correctedAnswer?.toLowerCase() === optText.toLowerCase();
              const highlight = isCorrectOpt || isStudentAnswer;
              return (
                <Box key={oi} sx={{
                  display: 'flex', alignItems: 'center', gap: 1,
                  p: { xs: 1, sm: 1.25 }, mb: 0.75, borderRadius: 2,
                  bgcolor: isCorrectOpt
                    ? alpha(theme.palette.success.main, 0.1)
                    : isStudentAnswer
                      ? alpha(theme.palette.error.main, 0.09)
                      : 'grey.50',
                  border: '1.5px solid',
                  borderColor: isCorrectOpt ? 'success.light' : isStudentAnswer ? 'error.light' : 'transparent'
                }}>
                  <Box sx={{
                    width: 26, height: 26, minWidth: 26, borderRadius: '50%', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12,
                    bgcolor: isCorrectOpt ? 'success.main' : isStudentAnswer ? 'error.main' : 'grey.300',
                    color: highlight ? 'white' : 'text.primary'
                  }}>
                    {letter}
                  </Box>
                  <Typography variant="body2" sx={{ flex: 1, fontWeight: highlight ? 600 : 400 }}>
                    {optText}
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.4, flexShrink: 0 }}>
                    {isCorrectOpt && isStudentAnswer && (
                      <Chip label="✓ Your answer" size="small" color="success" sx={{ fontSize: 10, height: 20, fontWeight: 700 }} />
                    )}
                    {isCorrectOpt && !isStudentAnswer && (
                      <Chip label="✓ Correct" size="small" color="success" sx={{ fontSize: 10, height: 20, fontWeight: 700 }} />
                    )}
                    {isStudentAnswer && !isCorrectOpt && (
                      <Chip label="✗ Your answer" size="small" color="error" sx={{ fontSize: 10, height: 20, fontWeight: 700 }} />
                    )}
                  </Box>
                </Box>
              );
            })}

            {/* Always show correct answer clearly when wrong */}
            {!answer.isCorrect && (
              <Box sx={{ mt: 1.5, p: 1.25, bgcolor: alpha(theme.palette.success.main, 0.08), borderRadius: 2,
                border: '1px solid', borderColor: 'success.light',
                display: 'flex', alignItems: 'center', gap: 1 }}>
                <TaskAlt fontSize="small" sx={{ color: 'success.main', flexShrink: 0 }} />
                <Typography variant="body2" fontWeight={700} color="success.dark">
                  Correct answer:{' '}
                  {answer.correctOptionLetter ? `${answer.correctOptionLetter}. ` : ''}
                  {String(answer.question?.correctAnswer || answer.correctedAnswer || 'See highlighted option above')}
                </Typography>
              </Box>
            )}
          </Box>
        )}

        {/* ── Matching ── */}
        {qType === 'matching' && (() => {
          const leftItems = answer.question?.leftItems || answer.question?.matchingPairs?.leftColumn || [];
          const rightItems = answer.question?.rightItems || answer.question?.matchingPairs?.rightColumn || [];
          const correctPairs = answer.question?.matchingPairs?.correctPairs || [];
          const studentPairs = answer.matchingAnswers || [];
          return (
            <Box sx={{ mb: 2 }}>
              <Box sx={{ mb: 2 }}>
                <Typography sx={labelStyle}>Your Matches</Typography>
                {studentPairs.length > 0 ? studentPairs.map((pair, pi) => {
                  const ll = getMatchLabel(leftItems[pair.left]);
                  const rl = getMatchLabel(rightItems[pair.right]);
                  const correct = correctPairs.some(cp => cp.left === pair.left && cp.right === pair.right);
                  return (
                    <Box key={pi} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75, p: 1, borderRadius: 1.5,
                      bgcolor: correct ? alpha(theme.palette.success.main, 0.08) : alpha(theme.palette.error.main, 0.08),
                      border: '1px solid', borderColor: correct ? 'success.light' : 'error.light' }}>
                      {correct
                        ? <TaskAlt fontSize="small" sx={{ color: 'success.main', flexShrink: 0 }} />
                        : <Cancel fontSize="small" sx={{ color: 'error.main', flexShrink: 0 }} />}
                      <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
                        <strong>{ll}</strong> <span style={{ opacity: 0.6 }}>→</span> {rl}
                      </Typography>
                    </Box>
                  );
                }) : (
                  <Box sx={{ p: 1.5, bgcolor: alpha(theme.palette.error.main, 0.07), borderRadius: 1.5, border: '1px solid', borderColor: 'error.light' }}>
                    <Typography variant="body2" color="error.main" fontStyle="italic">Not answered</Typography>
                  </Box>
                )}
              </Box>
              <Box>
                <Typography sx={labelStyle}>Correct Matches</Typography>
                {correctPairs.map((pair, pi) => (
                  <Box key={pi} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75, p: 1, borderRadius: 1.5,
                    bgcolor: alpha(theme.palette.success.main, 0.08), border: '1px solid', borderColor: 'success.light' }}>
                    <TaskAlt fontSize="small" sx={{ color: 'success.main', flexShrink: 0 }} />
                    <Typography variant="body2" color="success.dark" sx={{ wordBreak: 'break-word' }}>
                      <strong>{getMatchLabel(leftItems[pair.left])}</strong> <span style={{ opacity: 0.6 }}>→</span> {getMatchLabel(rightItems[pair.right])}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          );
        })()}

        {/* ── Financial Spreadsheet ── */}
        {qType === 'financial-spreadsheet' && (
          <Box sx={{ mb: 2 }}>
            <FinancialSpreadsheet
              mode="grading"
              questionData={{
                ...answer.question,
                // spreadsheetModelAnswer can be missing on older/edited questions;
                // correctAnswer is always kept as a mirror of it at save time.
                spreadsheetModelAnswer: answer.question?.spreadsheetModelAnswer || answer.question?.correctAnswer,
              }}
              studentAnswerRaw={answer.textAnswer}
              height={320}
            />
          </Box>
        )}

        {/* ── Open-ended / Essay / Fill-in / Short answer ── */}
        {(qType === 'open-ended' || qType === 'essay' || qType === 'fill-in-blank' || qType === 'short-answer') && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 2 }}>
            <Box>
              <Typography sx={labelStyle}>Your Answer</Typography>
              <Box sx={{ p: 1.5, borderRadius: 1.5, border: '1px solid',
                bgcolor: notAnswered ? alpha(theme.palette.error.main, 0.05) : answer.isCorrect ? alpha(theme.palette.success.main, 0.07) : alpha(theme.palette.error.main, 0.07),
                borderColor: notAnswered ? 'error.light' : answer.isCorrect ? 'success.light' : 'error.light' }}>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap',
                  color: notAnswered ? 'text.secondary' : answer.isCorrect ? 'success.dark' : 'error.dark',
                  fontStyle: notAnswered ? 'italic' : 'normal' }}>
                  {notAnswered ? 'Not answered' : String(answer.textAnswer || '')}
                </Typography>
              </Box>
            </Box>
            <Box>
              <Typography sx={labelStyle}>Correct / Model Answer</Typography>
              <Box sx={{ p: 1.5, bgcolor: alpha(theme.palette.success.main, 0.07), borderRadius: 1.5, border: '1px solid', borderColor: 'success.light' }}>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: 'success.dark' }}>
                  {String(answer.correctedAnswer || answer.question?.correctAnswer || 'Not provided')}
                </Typography>
              </Box>
            </Box>
          </Box>
        )}

        {/* ── Sub-questions ── */}
        {answer.question?.subQuestions && answer.question.subQuestions.length > 0 && (
          <Box sx={{ mt: 2, p: { xs: 1.5, sm: 2 }, bgcolor: 'grey.50', borderRadius: 2 }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 0.5, fontSize: { xs: '0.85rem', sm: '0.9rem' } }}>
              <FormatListNumbered fontSize="small" /> Sub-Questions
              {answer.question.subQuestionConfig?.mode === 'choose-n' && (
                <Chip label={`Choose ${answer.question.subQuestionConfig.requiredCount || 1}`} size="small" color="warning" sx={{ ml: 1 }} />
              )}
            </Typography>
            {answer.question.subQuestions.map((subQ, subIdx) => {
              const isSelected = answer.question.subQuestionConfig?.mode === 'choose-n'
                ? (answer.selectedSubQuestionIndices || []).includes(subIdx)
                : true;
              if (!isSelected) return null;
              const subAnswer = answer.subQuestionAnswers?.[subIdx];
              const subResult = answer.subQuestionResults?.[subIdx];
              const subNotAnswered = !subAnswer?.answered;
              return (
                <Paper key={subIdx} elevation={0} sx={{ p: { xs: 1.25, sm: 1.5 }, mb: 1, bgcolor: 'white', borderLeft: '3px solid',
                  borderColor: subResult?.isCorrect ? 'success.main' : subNotAnswered ? 'error.light' : subResult ? 'error.main' : 'grey.300' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.75, gap: 1, flexWrap: 'wrap' }}>
                    <Typography variant="body2" fontWeight={600} sx={{ flex: 1, fontSize: { xs: '0.82rem', sm: '0.875rem' } }}>
                      {subQ.label || `Part ${String.fromCharCode(65 + subIdx)}`}: {subQ.text}
                    </Typography>
                    {subResult && (
                      <Chip icon={subResult.isCorrect ? <CheckCircle fontSize="small" /> : <Cancel fontSize="small" />}
                        label={`${subResult.score ?? 0}/${subResult.maxPoints || subQ.points || 1} pts`}
                        color={subResult.isCorrect ? 'success' : 'error'} size="small" sx={{ flexShrink: 0 }} />
                    )}
                  </Box>
                  {subNotAnswered ? (
                    <Box>
                      <Typography variant="body2" color="error.main" fontStyle="italic" sx={{ mb: 0.5 }}>Not answered</Typography>
                      {(subQ.correctAnswer || subResult?.correctedAnswer) && (
                        <Typography variant="body2" color="success.dark" sx={{ mt: 0.25 }}>
                          <strong>Correct answer:</strong> {String(subResult?.correctedAnswer || subQ.correctAnswer)}
                        </Typography>
                      )}
                    </Box>
                  ) : (
                    <Box>
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
                        <strong>Your answer:</strong> {subAnswer.selectedOption || subAnswer.textAnswer || '—'}
                      </Typography>
                      {(subQ.correctAnswer || subResult?.correctedAnswer) && (
                        <Typography variant="body2" color="success.dark" sx={{ mt: 0.5, fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
                          <strong>Correct answer:</strong> {String(subResult?.correctedAnswer || subQ.correctAnswer)}
                        </Typography>
                      )}
                      {subResult?.feedback && (
                        <Box sx={{ mt: 0.75, p: 1, bgcolor: alpha(theme.palette.primary.main, 0.06), borderRadius: 1, borderLeft: '3px solid', borderColor: 'primary.light' }}>
                          <Typography variant="body2" sx={{ fontStyle: 'italic', color: 'primary.dark', fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
                            {subResult.feedback}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  )}
                </Paper>
              );
            })}
          </Box>
        )}

        {/* ── Feedback — always shown when present (including MC and unanswered) ── */}
        {answer.feedback && (
          <Box sx={{ mt: 2, p: { xs: 1.5, sm: 2 }, bgcolor: alpha(theme.palette.primary.main, 0.06), borderRadius: 2,
            borderLeft: '4px solid', borderColor: 'primary.main' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75 }}>
              <Feedback fontSize="small" color="primary" />
              <Typography variant="body2" fontWeight={700} color="primary.main">Feedback</Typography>
            </Box>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{String(answer.feedback)}</Typography>
          </Box>
        )}

        {/* Feedback placeholder when not answered and no feedback — show generic tip */}
        {notAnswered && !answer.feedback && (
          <Box sx={{ mt: 2, p: 1.5, bgcolor: alpha('#e65100', 0.07), borderRadius: 2, borderLeft: '4px solid', borderColor: 'warning.main' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
              <Lightbulb fontSize="small" sx={{ color: 'warning.main' }} />
              <Typography variant="body2" fontWeight={700} color="warning.dark">Tip</Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              Always attempt every question — even a partial answer can earn partial credit.
            </Typography>
          </Box>
        )}

        {/* ── AI Detailed Insights ── */}
        {(answer.conceptsPresent?.length > 0 || answer.conceptsMissing?.length > 0 ||
          answer.improvementSuggestions?.length > 0 || answer.technicalAccuracy) && (
          <Box sx={{ mt: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
              <Psychology fontSize="small" color="secondary" />
              <Typography variant="body2" fontWeight={700} color="secondary.main">AI Analysis</Typography>
            </Box>
            <Grid container spacing={1.25}>
              {answer.conceptsPresent?.length > 0 && (
                <Grid item xs={12} sm={6}>
                  <Box sx={{ p: 1.5, bgcolor: alpha(theme.palette.success.main, 0.07), borderRadius: 1.5, height: '100%' }}>
                    <Typography variant="caption" fontWeight={700} color="success.dark"
                      sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                      <TaskAlt fontSize="small" /> Concepts Identified
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {answer.conceptsPresent.map((c, i) => (
                        <Chip key={i} label={c} size="small" color="success" variant="outlined"
                          sx={{ fontSize: 10, height: 20 }} />
                      ))}
                    </Box>
                  </Box>
                </Grid>
              )}
              {answer.conceptsMissing?.length > 0 && (
                <Grid item xs={12} sm={6}>
                  <Box sx={{ p: 1.5, bgcolor: alpha(theme.palette.error.main, 0.07), borderRadius: 1.5, height: '100%' }}>
                    <Typography variant="caption" fontWeight={700} color="error.dark"
                      sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                      <ErrorOutline fontSize="small" /> Missing Concepts
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {answer.conceptsMissing.map((c, i) => (
                        <Chip key={i} label={c} size="small" color="error" variant="outlined"
                          sx={{ fontSize: 10, height: 20 }} />
                      ))}
                    </Box>
                  </Box>
                </Grid>
              )}
              {answer.improvementSuggestions?.length > 0 && (
                <Grid item xs={12}>
                  <Box sx={{ p: 1.5, bgcolor: alpha('#e65100', 0.07), borderRadius: 1.5 }}>
                    <Typography variant="caption" fontWeight={700} color="warning.dark"
                      sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                      <Lightbulb fontSize="small" /> Improvement Tips
                    </Typography>
                    {answer.improvementSuggestions.map((s, i) => (
                      <Box key={i} sx={{ display: 'flex', gap: 0.75, mb: 0.75, alignItems: 'flex-start' }}>
                        <Typography variant="body2" sx={{ color: '#e65100', fontWeight: 800, flexShrink: 0, lineHeight: 1.6 }}>{i + 1}.</Typography>
                        <Typography variant="body2" sx={{ lineHeight: 1.6 }}>{s}</Typography>
                      </Box>
                    ))}
                  </Box>
                </Grid>
              )}
              {answer.technicalAccuracy && (
                <Grid item xs={12}>
                  <Box sx={{ p: 1.5, bgcolor: alpha(theme.palette.primary.main, 0.06), borderRadius: 1.5 }}>
                    <Typography variant="caption" fontWeight={700} color="primary.dark"
                      sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                      <BarChart fontSize="small" /> Technical Accuracy
                    </Typography>
                    <Typography variant="body2">{answer.technicalAccuracy}</Typography>
                  </Box>
                </Grid>
              )}
              {answer.partialCreditBreakdown && Object.values(answer.partialCreditBreakdown).some(v => v > 0) && (
                <Grid item xs={12}>
                  <Box sx={{ p: 1.5, bgcolor: 'grey.50', borderRadius: 1.5 }}>
                    <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                      Partial Credit Breakdown
                    </Typography>
                    <Grid container spacing={1}>
                      {Object.entries(answer.partialCreditBreakdown).map(([k, v]) => (
                        <Grid item xs={6} sm={3} key={k}>
                          <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize', display: 'block' }}>{k}</Typography>
                          <LinearProgress variant="determinate" value={Math.min(100, v * 10)} sx={{ height: 6, borderRadius: 3, mb: 0.5 }} />
                          <Typography variant="caption" fontWeight={700}>{v}/10</Typography>
                        </Grid>
                      ))}
                    </Grid>
                  </Box>
                </Grid>
              )}
            </Grid>
          </Box>
        )}
      </Box>
    );
  };

  // ─── If resultId is provided, show detailed result ─────────────────────────
  if (resultId && detailedResult) {
    const percentage = calculatePercentage(detailedResult.totalScore, detailedResult.maxPossibleScore);

    // Use exam sections to maintain original question order
    const examSections = detailedResult.exam?.sections || [];
    const allSections = examSections.map(s => s.name || 'A');

    // Overall stats
    const totalQ = detailedResult.answers.length;
    const correctQ = detailedResult.answers.filter(a => a.isCorrect).length;
    const timeTaken = detailedResult.endTime && detailedResult.startTime
      ? Math.round((new Date(detailedResult.endTime) - new Date(detailedResult.startTime)) / 60000)
      : null;

    // ─── Build an overall study recommendation from section performance,
    // AI-flagged missing concepts, and unanswered questions ──────────────────
    const buildRecommendation = () => {
      const answers = detailedResult.answers || [];

      const notAnsweredCount = answers.filter(a => {
        return !a.selectedOption && !a.textAnswer &&
          (!a.matchingAnswers || a.matchingAnswers.length === 0) &&
          (!a.subQuestionAnswers || a.subQuestionAnswers.length === 0);
      }).length;

      const sectionStats = examSections.map(section => {
        const sAnswers = answers.filter(a =>
          a.question && String(a.question.section || 'A') === String(section.name || 'A')
        );
        const sCorrect = sAnswers.filter(a => a.isCorrect).length;
        return {
          name: section.name || 'A',
          pct: sAnswers.length > 0 ? Math.round((sCorrect / sAnswers.length) * 100) : null,
          total: sAnswers.length
        };
      }).filter(s => s.total > 0);

      const weakSections = sectionStats
        .filter(s => s.pct !== null && s.pct < 70)
        .sort((a, b) => a.pct - b.pct);

      // Most frequently missing concepts across all AI-graded answers
      const conceptFreq = {};
      answers.forEach(a => {
        (a.conceptsMissing || []).forEach(c => {
          conceptFreq[c] = (conceptFreq[c] || 0) + 1;
        });
      });
      const topConcepts = Object.entries(conceptFreq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([c]) => c);

      // Unique AI improvement suggestions from wrong answers
      const suggestions = [];
      answers.forEach(a => {
        if (!a.isCorrect && a.improvementSuggestions?.length) {
          a.improvementSuggestions.forEach(s => {
            if (!suggestions.includes(s)) suggestions.push(s);
          });
        }
      });

      let tone = 'success';
      let headline;
      if (percentage >= 90) {
        headline = "Outstanding work! You've shown a strong command of this material — keep this level of preparation going.";
      } else if (percentage >= 70) {
        tone = 'success';
        headline = "Good performance — you passed comfortably. A little extra focus on the areas below will help you aim even higher.";
      } else if (percentage >= 50) {
        tone = 'warning';
        headline = "You're close, but a few knowledge gaps are holding your score back. Focus your revision on the areas below before retaking.";
      } else {
        tone = 'error';
        headline = 'This topic needs focused revision. Review the concepts and sections below carefully before attempting a retake.';
      }

      // Concrete action tips, most relevant first
      const tips = [];
      if (weakSections.length > 0) {
        tips.push(`Prioritize revising Section${weakSections.length > 1 ? 's' : ''} ${weakSections.map(s => `${s.name} (${s.pct}%)`).join(', ')} — your weakest area${weakSections.length > 1 ? 's' : ''}.`);
      }
      if (topConcepts.length > 0) {
        tips.push(`Go back over these specific concepts: ${topConcepts.join(', ')}.`);
      }
      if (notAnsweredCount > 0) {
        tips.push(`You left ${notAnsweredCount} question${notAnsweredCount !== 1 ? 's' : ''} unanswered — always attempt every question, since partial answers can still earn credit.`);
      }
      suggestions.slice(0, 3).forEach(s => tips.push(s));
      if (tips.length === 0) {
        tips.push('Keep practicing regularly and take a retake or a related exam to reinforce what you already know well.');
      }

      return { tone, headline, weakSections, topConcepts, tips: tips.slice(0, 5), notAnsweredCount };
    };

    // Prefer the AI-generated recommendation (grounded in this student's
    // actual answers, computed server-side and cached on the result) — it's
    // far more accurate than the client-side heuristic below, which only
    // kicks in as a fallback if the AI call hasn't completed/succeeded yet.
    const aiRecommendation = detailedResult.overallRecommendation;
    const recommendation = aiRecommendation
      ? {
          tone: aiRecommendation.tone || 'success',
          headline: aiRecommendation.headline,
          weakSections: (aiRecommendation.focusAreas || []).map(f => ({
            name: String(f.name || '').replace(/^section\s*/i, '').trim() || f.name,
            pct: f.pct
          })),
          topConcepts: aiRecommendation.topConcepts || [],
          tips: aiRecommendation.tips || [],
          isAiGenerated: true
        }
      : { ...buildRecommendation(), isAiGenerated: false };

    return (
      <StudentLayout>
        <Container maxWidth="lg" sx={{ mb: { xs: 4, sm: 8 }, px: { xs: 1.5, sm: 2, md: 3 } }}>
          {/* ── Header ── */}
          <Grow in={true} timeout={600}>
            <Paper elevation={0} sx={{
              p: { xs: 2, sm: 3.5 }, mb: { xs: 2, sm: 3 }, borderRadius: 3,
              background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 50%, ${theme.palette.secondary.main} 100%)`,
              color: 'white'
            }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' },
                flexDirection: { xs: 'column', sm: 'row' }, gap: { xs: 1.5, sm: 2 } }}>
                <Box sx={{ minWidth: 0, width: '100%' }}>
                  <Typography variant="h5" fontWeight={800} sx={{ mb: 0.5, fontSize: { xs: '1.15rem', sm: '1.5rem' }, wordBreak: 'break-word' }}>
                    {detailedResult.exam?.title || 'Exam Result'}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.85, fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
                    Completed on {formatDate(detailedResult.endTime)}
                    {timeTaken !== null && ` · ${timeTaken} min taken`}
                  </Typography>
                </Box>
                <Box sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: { xs: 1, sm: 1.5 },
                  width: { xs: '100%', sm: 'auto' }
                }}>
                  <Button variant="contained" onClick={() => navigate('/student/results')}
                    startIcon={<ArrowBack />} size={isMobile ? 'small' : 'medium'}
                    sx={{ bgcolor: 'rgba(255,255,255,0.15)', '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' }, textTransform: 'none', fontWeight: 700, fontSize: { xs: '0.75rem', sm: '0.875rem' }, whiteSpace: 'nowrap' }}>
                    All Results
                  </Button>
                  <Button variant="contained" component={RouterLink} to="/student/dashboard" size={isMobile ? 'small' : 'medium'}
                    sx={{ bgcolor: 'rgba(255,255,255,0.15)', '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' }, textTransform: 'none', fontWeight: 700, fontSize: { xs: '0.75rem', sm: '0.875rem' }, whiteSpace: 'nowrap' }}>
                    Dashboard
                  </Button>
                  <Button variant="contained" onClick={() => { fetchMyReclamations(); setReclamationsDialogOpen(true); }}
                    startIcon={<ReportProblem />} size={isMobile ? 'small' : 'medium'}
                    sx={{ bgcolor: 'rgba(255,255,255,0.15)', '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' }, textTransform: 'none', fontWeight: 700, fontSize: { xs: '0.75rem', sm: '0.875rem' }, whiteSpace: 'nowrap' }}>
                    {isMobile ? 'Reclamations' : 'My Reclamations'}
                  </Button>
                  <Button variant="contained" onClick={() => setClaimDialogOpen(true)}
                    startIcon={<ReportProblem />} size={isMobile ? 'small' : 'medium'}
                    sx={{ bgcolor: 'rgba(255,255,255,0.15)', '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' }, textTransform: 'none', fontWeight: 700, fontSize: { xs: '0.75rem', sm: '0.875rem' }, whiteSpace: 'nowrap' }}>
                    Claim Result
                  </Button>
                </Box>
              </Box>
            </Paper>
          </Grow>

          {/* ── Summary Row ── */}
          <Grid container spacing={{ xs: 1.5, sm: 2 }} sx={{ mb: { xs: 2, sm: 3 } }}>
            {/* Score card */}
            <Grid item xs={12} sm={4}>
              <Zoom in={true} style={{ transitionDelay: '100ms' }}>
                <Card elevation={2} sx={{ borderRadius: 3, textAlign: 'center', p: { xs: 2, sm: 2.5 } }}>
                  <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2, position: 'relative' }}>
                    <ScoreCircle score={percentage}>
                      <Typography variant="h4" fontWeight={800}>{percentage}%</Typography>
                    </ScoreCircle>
                    <Box sx={{ position: 'absolute', bottom: -8, right: '28%' }}>
                      <GradeBadge score={percentage} />
                    </Box>
                  </Box>
                  <Typography variant="h6" fontWeight={700}>{detailedResult.totalScore} / {detailedResult.maxPossibleScore} pts</Typography>
                  <Chip label={percentage >= 70 ? 'PASSED' : 'FAILED'} color={percentage >= 70 ? 'success' : 'error'}
                    sx={{ mt: 1, fontWeight: 700 }} />
                </Card>
              </Zoom>
            </Grid>

            {/* Stats */}
            <Grid item xs={12} sm={4}>
              <Zoom in={true} style={{ transitionDelay: '200ms' }}>
                <Card elevation={2} sx={{ borderRadius: 3, p: { xs: 2, sm: 2.5 }, height: '100%' }}>
                  <Typography variant="subtitle2" fontWeight={700} color="text.secondary" gutterBottom>Performance Stats</Typography>
                  <Divider sx={{ mb: 1.5 }} />
                  {[
                    { label: 'Correct', value: correctQ, total: totalQ, color: 'success.main' },
                    { label: 'Incorrect', value: totalQ - correctQ, total: totalQ, color: 'error.main' },
                  ].map(stat => (
                    <Box key={stat.label} sx={{ mb: 1.5 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="body2" color={stat.color} fontWeight={600}>{stat.label}</Typography>
                        <Typography variant="body2" fontWeight={700}>{stat.value}/{stat.total}</Typography>
                      </Box>
                      <LinearProgress variant="determinate" value={totalQ > 0 ? (stat.value / totalQ) * 100 : 0}
                        sx={{ height: 7, borderRadius: 4,
                          '& .MuiLinearProgress-bar': { bgcolor: stat.color } }} />
                    </Box>
                  ))}
                </Card>
              </Zoom>
            </Grid>

            {/* Time & meta */}
            <Grid item xs={12} sm={4}>
              <Zoom in={true} style={{ transitionDelay: '300ms' }}>
                <Card elevation={2} sx={{ borderRadius: 3, p: { xs: 2, sm: 2.5 }, height: '100%' }}>
                  <Typography variant="subtitle2" fontWeight={700} color="text.secondary" gutterBottom>Exam Info</Typography>
                  <Divider sx={{ mb: 1.5 }} />
                  {[
                    { label: 'Started', value: formatDate(detailedResult.startTime) },
                    { label: 'Finished', value: formatDate(detailedResult.endTime) },
                    { label: 'Duration', value: timeTaken !== null ? `${timeTaken} minutes` : '—' },
                    { label: 'Questions', value: totalQ },
                  ].map(row => (
                    <Box key={row.label} sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
                      <Typography variant="body2" color="text.secondary">{row.label}</Typography>
                      <Typography variant="body2" fontWeight={600}>{row.value}</Typography>
                    </Box>
                  ))}
                </Card>
              </Zoom>
            </Grid>
          </Grid>

          {/* ── Overall Recommendation ── */}
          <Zoom in={true} style={{ transitionDelay: '350ms' }}>
            <Paper elevation={2} sx={{
              borderRadius: 3, mb: { xs: 2, sm: 3 }, p: { xs: 2, sm: 3 }, position: 'relative', overflow: 'hidden',
              border: '1.5px solid',
              borderColor: `${recommendation.tone}.light`,
              bgcolor: alpha(theme.palette[recommendation.tone].main, 0.04)
            }}>
              <Box sx={{
                position: 'absolute', top: 0, left: 0, width: 5, height: '100%',
                bgcolor: `${recommendation.tone}.main`
              }} />
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: { xs: 1.5, sm: 2 } }}>
                <Box sx={{
                  width: { xs: 40, sm: 48 }, height: { xs: 40, sm: 48 }, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  bgcolor: alpha(theme.palette[recommendation.tone].main, 0.12)
                }}>
                  <Psychology sx={{ color: `${recommendation.tone}.main`, fontSize: { xs: 22, sm: 26 } }} />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
                    <Typography variant="subtitle1" fontWeight={800} sx={{ fontSize: { xs: '0.95rem', sm: '1.05rem' } }}>
                      Your Personalized Recommendation
                    </Typography>
                    {recommendation.isAiGenerated ? (
                      <Chip label="AI-generated" size="small" color={recommendation.tone}
                        sx={{ height: 18, fontSize: 9.5, fontWeight: 700 }} />
                    ) : (
                      <Chip label="Auto-generated" size="small" variant="outlined"
                        sx={{ height: 18, fontSize: 9.5, fontWeight: 700 }} />
                    )}
                  </Box>
                  <Typography variant="body2" sx={{ mb: 2, lineHeight: 1.6, color: 'text.secondary' }}>
                    {recommendation.headline}
                  </Typography>

                  {recommendation.weakSections.length > 0 && (
                    <Box sx={{ mb: 1.5 }}>
                      <Typography sx={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, color: 'text.secondary', mb: 0.75 }}>
                        Focus Areas
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                        {recommendation.weakSections.map(s => (
                          <Chip key={s.name} label={`Section ${s.name} — ${s.pct}%`} size="small" color="warning"
                            sx={{ fontWeight: 700 }} />
                        ))}
                      </Box>
                    </Box>
                  )}

                  {recommendation.topConcepts.length > 0 && (
                    <Box sx={{ mb: 1.5 }}>
                      <Typography sx={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, color: 'text.secondary', mb: 0.75 }}>
                        Concepts to Review
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                        {recommendation.topConcepts.map((c, i) => (
                          <Chip key={i} label={c} size="small" variant="outlined" color="error" />
                        ))}
                      </Box>
                    </Box>
                  )}

                  <Typography sx={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, color: 'text.secondary', mb: 0.75 }}>
                    What to do next
                  </Typography>
                  <Box component="ul" sx={{ m: 0, pl: 2.5, mb: 2.5 }}>
                    {recommendation.tips.map((tip, i) => (
                      <Typography key={i} component="li" variant="body2" sx={{ mb: 0.5, lineHeight: 1.6 }}>
                        {tip}
                      </Typography>
                    ))}
                  </Box>

                  {/* ── App download CTA — practice the flagged topics in the app ── */}
                  <Box sx={{
                    p: { xs: 1.75, sm: 2.25 }, borderRadius: 2,
                    bgcolor: theme.palette.primary.main, color: 'white'
                  }}>
                    <Typography fontWeight={700} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, fontSize: { xs: '0.85rem', sm: '0.95rem' } }}>
                      <Psychology fontSize="small" />
                      Master these topics with Excellence Coaching Hub
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.9, lineHeight: 1.5, mb: 1.5, fontSize: { xs: '0.78rem', sm: '0.85rem' } }}>
                      Download our mobile app for detailed explanations, practice questions, and personalized learning paths on the exact concepts you're struggling with.
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      <Button
                        variant="contained"
                        href="https://play.google.com/store/apps/details?id=com.excellencecoachinghub.app&pcampaignid=web_share"
                        target="_blank"
                        rel="noopener noreferrer"
                        startIcon={<GooglePlayIcon />}
                        size="small"
                        sx={{
                          bgcolor: 'white', color: theme.palette.primary.main, fontWeight: 600,
                          textTransform: 'none', fontSize: { xs: '0.72rem', sm: '0.8rem' },
                          '&:hover': { bgcolor: 'rgba(255,255,255,0.9)' }
                        }}
                      >
                        Google Play
                      </Button>
                      <Button
                        variant="contained"
                        href="https://apps.microsoft.com/detail/9NW5V60BNHNN?hl=en-us&gl=US&ocid=pdpshare"
                        target="_blank"
                        rel="noopener noreferrer"
                        startIcon={<MicrosoftStoreIcon />}
                        size="small"
                        sx={{
                          bgcolor: 'white', color: theme.palette.primary.main, fontWeight: 600,
                          textTransform: 'none', fontSize: { xs: '0.72rem', sm: '0.8rem' },
                          '&:hover': { bgcolor: 'rgba(255,255,255,0.9)' }
                        }}
                      >
                        Microsoft Store
                      </Button>
                    </Box>
                  </Box>
                </Box>
              </Box>
            </Paper>
          </Zoom>

          {/* ── Answers by Section ── */}
          <Zoom in={true} style={{ transitionDelay: '400ms' }}>
            <Card elevation={2} sx={{ borderRadius: 3 }}>
              <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tabs value={tabValue} onChange={handleTabChange} variant={isMobile || allSections.length > 4 ? 'scrollable' : 'fullWidth'}
                  scrollButtons="auto" allowScrollButtonsMobile indicatorColor="primary" textColor="primary">
                  {examSections.map((section, idx) => {
                    const sectionAnswers = detailedResult.answers.filter(a =>
                      a.question && String(a.question.section || 'A') === String(section.name || 'A')
                    );
                    const sCorrect = sectionAnswers.filter(a => a.isCorrect).length;
                    return (
                      <Tab key={section.name || idx} sx={{ minWidth: { xs: 88, sm: 120 }, px: { xs: 1.5, sm: 2 } }} label={
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="caption" fontWeight={700} sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>Section {section.name || 'A'}</Typography>
                          <Typography variant="caption" display="block" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }} color={sCorrect === sectionAnswers.length ? 'success.main' : 'text.secondary'}>
                            {sCorrect}/{sectionAnswers.length}
                          </Typography>
                        </Box>
                      } />
                    );
                  })}
                </Tabs>
              </Box>

              {examSections.map((section, index) => (
                <Box key={section.name || index} role="tabpanel" hidden={tabValue !== index} sx={{ p: { xs: 2, sm: 3 } }}>
                  {tabValue === index && (
                    <>
                      {/* Section summary bar */}
                      {(() => {
                        const sectionAnswers = detailedResult.answers.filter(a => 
                          a.question && String(a.question.section || 'A') === String(section.name || 'A')
                        );
                        const sCorrect = sectionAnswers.filter(a => a.isCorrect).length;
                        const sPct = sectionAnswers.length > 0 ? Math.round((sCorrect / sectionAnswers.length) * 100) : 0;
                        return (
                          <Box sx={{ mb: 2, p: { xs: 1.5, sm: 2 }, bgcolor: 'grey.50', borderRadius: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75, flexWrap: 'wrap', gap: 1 }}>
                              <Typography variant="subtitle2" fontWeight={700} sx={{ fontSize: { xs: '0.82rem', sm: '0.875rem' } }}>
                                Section {section.name || 'A'} — {sectionAnswers.length} question{sectionAnswers.length !== 1 ? 's' : ''}
                              </Typography>
                              <Chip label={`${sCorrect}/${sectionAnswers.length} · ${sPct}%`}
                                color={scoreBadgeColor(sPct)} size="small" sx={{ fontWeight: 700 }} />
                            </Box>
                            <LinearProgress variant="determinate" value={sPct} sx={{ height: 6, borderRadius: 3,
                              '& .MuiLinearProgress-bar': { bgcolor: sPct >= 70 ? 'success.main' : sPct >= 50 ? 'warning.main' : 'error.main' } }} />
                          </Box>
                        );
                      })()}

                      {section.questions && section.questions.length > 0 ? (
                        section.questions.map((questionId, qIdx) => {
                          const answer = detailedResult.answers.find(a => a.question?._id === questionId);
                          if (!answer) return null;
                          
                          const pts = answer.question?.points || 1;
                          const partialPct = pts > 0 ? Math.round((answer.score / pts) * 100) : 0;
                          const isPartial = !answer.isCorrect && answer.score > 0;
                          return (
                            <Accordion key={questionId || qIdx} elevation={0}
                              sx={{ mb: 1.5, border: '1.5px solid', borderRadius: '12px !important', overflow: 'hidden',
                                borderColor: answer.isCorrect ? 'success.light' : isPartial ? 'warning.light' : 'error.light',
                                '&:before': { display: 'none' }, '&.Mui-expanded': { margin: '0 0 12px 0 !important' } }}>
                              <AccordionSummary expandIcon={<ExpandMore />} sx={{
                                bgcolor: answer.isCorrect ? alpha(theme.palette.success.main, 0.05) : isPartial ? alpha('#e65100', 0.05) : alpha(theme.palette.error.main, 0.05),
                                px: { xs: 1.5, sm: 2 }, py: { xs: 1, sm: 1.25 } }}>
                                <Box sx={{ display: 'flex', alignItems: 'flex-start', width: '100%', gap: 1 }}>
                                  {answer.isCorrect
                                    ? <CheckCircle sx={{ color: 'success.main', flexShrink: 0, mt: 0.1, fontSize: { xs: 18, sm: 22 } }} />
                                    : isPartial
                                      ? <Info sx={{ color: 'warning.main', flexShrink: 0, mt: 0.1, fontSize: { xs: 18, sm: 22 } }} />
                                      : <Cancel sx={{ color: 'error.main', flexShrink: 0, mt: 0.1, fontSize: { xs: 18, sm: 22 } }} />}
                                  <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography fontWeight={600} sx={{ fontSize: { xs: 13, sm: 14 }, lineHeight: 1.4,
                                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                      Q{qIdx + 1}: {String(answer.question?.text || '')}
                                    </Typography>
                                    <Box sx={{ display: 'flex', gap: 0.75, mt: 0.5, flexWrap: 'wrap' }}>
                                      <Chip label={answer.question?.type?.replace(/-/g, ' ') || 'question'} size="small"
                                        variant="outlined" sx={{ height: 18, fontSize: 10, textTransform: 'capitalize' }} />
                                      {answer.isCorrect
                                        ? <Chip label="Correct" size="small" color="success" sx={{ height: 18, fontSize: 10 }} />
                                        : isPartial
                                          ? <Chip label="Partial" size="small" color="warning" sx={{ height: 18, fontSize: 10 }} />
                                          : <Chip label="Incorrect" size="small" color="error" sx={{ height: 18, fontSize: 10 }} />}
                                      <Chip label={`${answer.score ?? 0}/${pts}pts`}
                                        color={answer.isCorrect ? 'success' : isPartial ? 'warning' : 'error'} size="small"
                                        sx={{ fontWeight: 700, height: 18, fontSize: 10 }} />
                                    </Box>
                                  </Box>
                                </Box>
                              </AccordionSummary>
                              <AccordionDetails sx={{ bgcolor: 'white', borderTop: '1px solid', borderColor: 'divider', p: { xs: 1.5, sm: 2.5 } }}>
                                {renderAnswerDetail(answer)}
                              </AccordionDetails>
                            </Accordion>
                          );
                        })
                      ) : (
                        <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 4 }}>
                          No questions in this section.
                        </Typography>
                      )}
                    </>
                  )}
                </Box>
              ))}
            </Card>
          </Zoom>
        </Container>

        {/* Claim Dialog */}
        <Dialog open={claimDialogOpen} onClose={() => setClaimDialogOpen(false)} maxWidth="sm" fullWidth fullScreen={isMobile}>
          <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
            <ReportProblem color="warning" />
            Submit a Reclamation
          </DialogTitle>
          <DialogContent>
            <Alert severity="info" sx={{ mb: 2 }}>
              Your reclamation will be reviewed by your teacher, organization admin, and super admin.
            </Alert>
            <Box sx={{ mb: 2 }}>
              <Typography sx={{ fontSize: 12, fontWeight: 600, mb: 0.5 }}>Category</Typography>
              <FormControl fullWidth size="small">
                <Select value={claimCategory} onChange={(e) => setClaimCategory(e.target.value)}>
                  <MenuItem value="grading-error">Grading Error</MenuItem>
                  <MenuItem value="technical-issue">Technical Issue</MenuItem>
                  <MenuItem value="content-error">Content Error</MenuItem>
                  <MenuItem value="other">Other</MenuItem>
                </Select>
              </FormControl>
            </Box>
            <Box sx={{ mb: 2 }}>
              <Typography sx={{ fontSize: 12, fontWeight: 600, mb: 0.5 }}>Priority</Typography>
              <FormControl fullWidth size="small">
                <Select value={claimPriority} onChange={(e) => setClaimPriority(e.target.value)}>
                  <MenuItem value="low">Low</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                </Select>
              </FormControl>
            </Box>
            <TextField
              fullWidth
              multiline
              rows={4}
              label="Describe your claim"
              placeholder="Please explain why you are submitting this reclamation..."
              value={claimText}
              onChange={(e) => setClaimText(e.target.value)}
              sx={{ mb: 1 }}
            />
          </DialogContent>
          <DialogActions sx={{ px: { xs: 2, sm: 3 }, pb: { xs: 2, sm: 2.5 } }}>
            <Button onClick={() => setClaimDialogOpen(false)} sx={{ textTransform: 'none', fontWeight: 600 }}>
              Cancel
            </Button>
            <Button 
              variant="contained" 
              onClick={handleSubmitClaim}
              disabled={!claimText.trim() || submittingClaim}
              sx={{ textTransform: 'none', fontWeight: 700 }}
            >
              {submittingClaim ? 'Submitting...' : 'Submit Reclamation'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* My Reclamations Dialog */}
        <Dialog open={reclamationsDialogOpen} onClose={() => setReclamationsDialogOpen(false)} maxWidth="md" fullWidth fullScreen={isMobile}>
          <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
            <ReportProblem color="info" />
            My Reclamations
          </DialogTitle>
          <DialogContent>
            {reclamationsLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : myReclamations.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="body2" color="text.secondary">No reclamations submitted yet</Typography>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {myReclamations.map((reclamation) => (
                  <Paper key={reclamation._id} elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                      <Typography variant="subtitle2" fontWeight={600}>
                        {reclamation.exam?.title || 'Unknown Exam'}
                      </Typography>
                      <Chip 
                        label={reclamation.status} 
                        size="small" 
                        sx={{ 
                          bgcolor: reclamation.status === 'resolved' ? '#10B98120' : 
                                 reclamation.status === 'rejected' ? '#EF444420' : 
                                 reclamation.status === 'under-review' ? '#3B82F620' : '#F59E0B20',
                          color: reclamation.status === 'resolved' ? '#10B981' : 
                                 reclamation.status === 'rejected' ? '#EF4444' : 
                                 reclamation.status === 'under-review' ? '#3B82F6' : '#F59E0B',
                          fontWeight: 600 
                        }} 
                      />
                    </Box>
                    <Typography variant="body2" sx={{ mb: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {reclamation.claim}
                    </Typography>
                    {reclamation.response && (
                      <Box sx={{ p: 1.5, bgcolor: '#ECFDF5', borderRadius: 1.5, border: '1px solid #10B981', mb: 1 }}>
                        <Typography variant="caption" color="#065F46" sx={{ display: 'block', mb: 0.5, fontWeight: 600 }}>Response:</Typography>
                        <Typography variant="body2" color="#065F46">{reclamation.response}</Typography>
                      </Box>
                    )}
                    <Typography variant="caption" color="text.secondary">
                      Submitted on {new Date(reclamation.createdAt).toLocaleDateString()}
                      {reclamation.respondedAt && ` · Responded on ${new Date(reclamation.respondedAt).toLocaleDateString()}`}
                    </Typography>
                  </Paper>
                ))}
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setReclamationsDialogOpen(false)}>Close</Button>
          </DialogActions>
        </Dialog>
      </StudentLayout>
    );
  }

  // Show list of all results
  return (
    <StudentLayout>
      <Container maxWidth="lg" sx={{ mb: { xs: 4, sm: 6, md: 8 }, mt: { xs: 2, sm: 4, md: 5 }, px: { xs: 1.5, sm: 2, md: 3 } }}>
        <Grow in={true} timeout={800}>
          <Paper
            elevation={0}
            sx={{
              p: { xs: 2.5, sm: 5, md: 6 },
              mb: { xs: 2.5, sm: 4 },
              borderRadius: { xs: 3, md: 6 },
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
              gap: { xs: 2, sm: 2 },
              position: 'relative',
              zIndex: 1
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.5, sm: 2 }, minWidth: 0 }}>
                <Avatar
                  sx={{
                    width: { xs: 48, sm: 70 },
                    height: { xs: 48, sm: 70 },
                    flexShrink: 0,
                    bgcolor: 'rgba(255,255,255,0.2)',
                    border: '3px solid rgba(255,255,255,0.3)',
                    animation: 'resultsIconFloat 6s ease-in-out infinite',
                    '@keyframes resultsIconFloat': {
                      '0%, 100%': { transform: 'translateY(0px) rotate(0deg)' },
                      '50%': { transform: 'translateY(-8px) rotate(10deg)' }
                    }
                  }}
                >
                  <EmojiEvents sx={{ fontSize: { xs: '1.5rem', sm: '2.5rem' }, color: 'white' }} />
                </Avatar>

                <Box sx={{ minWidth: 0 }}>
                  <Typography
                    variant="h3"
                    component="h1"
                    fontWeight="bold"
                    sx={{
                      fontSize: { xs: '1.4rem', sm: '2.5rem', md: '3rem' },
                      background: 'linear-gradient(135deg, #ffffff 0%, #f0f0f0 50%, #ffffff 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                      mb: { xs: 0.5, sm: 1 },
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
                      fontSize: { xs: '0.8rem', sm: '1.2rem' },
                      fontWeight: 'medium'
                    }}
                  >
                    Track your academic performance and achievements
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', width: { xs: '100%', sm: 'auto' } }}>
                <Box sx={{ display: { xs: 'none', sm: 'flex' }, gap: 1, flexWrap: 'wrap' }}>
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
                <Button
                  variant="contained"
                  onClick={() => { fetchMyReclamations(); setReclamationsDialogOpen(true); }}
                  startIcon={<ReportProblem />}
                  fullWidth={isMobile}
                  size={isMobile ? 'small' : 'medium'}
                  sx={{
                    bgcolor: 'rgba(255,255,255,0.2)',
                    color: 'white',
                    fontWeight: 'bold',
                    border: '1px solid rgba(255,255,255,0.3)',
                    '&:hover': {
                      bgcolor: 'rgba(255,255,255,0.3)'
                    }
                  }}
                >
                  My Reclamations
                </Button>
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

                    <CardContent sx={{ flexGrow: 1, pt: { xs: 2.5, sm: 4 }, px: { xs: 2, sm: 3 }, position: 'relative', zIndex: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: { xs: 2, sm: 3 } }}>
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
                            {result.exam?.title || 'Exam (Deleted)'}
                          </Typography>

                          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                            {result.exam?.description || 'This exam has been deleted'}
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

                      <Box sx={{ display: 'flex', alignItems: 'center', mb: { xs: 2, sm: 3 }, p: 1.5, borderRadius: 2, bgcolor: alpha(theme.palette.grey[100], 0.5) }}>
                        <Avatar
                          sx={{
                            width: 32,
                            height: 32,
                            bgcolor: theme.palette.info.main,
                            mr: 1.5,
                            flexShrink: 0
                          }}
                        >
                          <AccessTime sx={{ fontSize: '1rem' }} />
                        </Avatar>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem', fontWeight: 'medium' }}>
                            Completed on {formatDate(result.endTime)}
                          </Typography>
                          <Box sx={{ display: 'flex', gap: { xs: 1, sm: 2 }, mt: 0.5, flexWrap: 'wrap' }}>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                              <strong>Time:</strong> {result.exam?.timeLimit || 'N/A'} min
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                              <strong>Questions:</strong> {result.exam?.totalQuestions || 'N/A'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                              <strong>Passing Score:</strong> {result.exam?.passingScore || 'N/A'}%
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

                    <Box sx={{ p: { xs: 2, sm: 3 } }}>
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
              p: { xs: 3, sm: 6, md: 8 },
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

            <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' }, width: { xs: '100%', sm: 'auto' } }}>
              <Button
                variant="contained"
                color="primary"
                component={RouterLink}
                to="/student/exams"
                size="large"
                fullWidth={isMobile}
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
                fullWidth={isMobile}
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

      {/* Claim Dialog */}
      <Dialog open={claimDialogOpen} onClose={() => setClaimDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          <ReportProblem color="warning" />
          Submit a Reclamation
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Your reclamation will be reviewed by your teacher, organization admin, and super admin.
          </Alert>
          <Box sx={{ mb: 2 }}>
            <Typography sx={{ fontSize: 12, fontWeight: 600, mb: 0.5 }}>Category</Typography>
            <FormControl fullWidth size="small">
              <Select value={claimCategory} onChange={(e) => setClaimCategory(e.target.value)}>
                <MenuItem value="grading-error">Grading Error</MenuItem>
                <MenuItem value="technical-issue">Technical Issue</MenuItem>
                <MenuItem value="content-error">Content Error</MenuItem>
                <MenuItem value="other">Other</MenuItem>
              </Select>
            </FormControl>
          </Box>
          <Box sx={{ mb: 2 }}>
            <Typography sx={{ fontSize: 12, fontWeight: 600, mb: 0.5 }}>Priority</Typography>
            <FormControl fullWidth size="small">
              <Select value={claimPriority} onChange={(e) => setClaimPriority(e.target.value)}>
                <MenuItem value="low">Low</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="high">High</MenuItem>
              </Select>
            </FormControl>
          </Box>
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Describe your claim"
            placeholder="Please explain why you are submitting this reclamation..."
            value={claimText}
            onChange={(e) => setClaimText(e.target.value)}
            sx={{ mb: 1 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setClaimDialogOpen(false)} sx={{ textTransform: 'none', fontWeight: 600 }}>
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={handleSubmitClaim}
            disabled={!claimText.trim() || submittingClaim}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            {submittingClaim ? 'Submitting...' : 'Submit Reclamation'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* My Reclamations Dialog */}
      <Dialog open={reclamationsDialogOpen} onClose={() => setReclamationsDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          <ReportProblem color="info" />
          My Reclamations
        </DialogTitle>
        <DialogContent>
          {reclamationsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : myReclamations.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body2" color="text.secondary">No reclamations submitted yet</Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {myReclamations.map((reclamation) => (
                <Paper key={reclamation._id} elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Typography variant="subtitle2" fontWeight={600}>
                      {reclamation.exam?.title || 'Unknown Exam'}
                    </Typography>
                    <Chip 
                      label={reclamation.status} 
                      size="small" 
                      sx={{ 
                        bgcolor: reclamation.status === 'resolved' ? '#10B98120' : 
                               reclamation.status === 'rejected' ? '#EF444420' : 
                               reclamation.status === 'under-review' ? '#3B82F620' : '#F59E0B20',
                        color: reclamation.status === 'resolved' ? '#10B981' : 
                               reclamation.status === 'rejected' ? '#EF4444' : 
                               reclamation.status === 'under-review' ? '#3B82F6' : '#F59E0B',
                        fontWeight: 600 
                      }} 
                    />
                  </Box>
                  <Typography variant="body2" sx={{ mb: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {reclamation.claim}
                  </Typography>
                  {reclamation.response && (
                    <Box sx={{ p: 1.5, bgcolor: '#ECFDF5', borderRadius: 1.5, border: '1px solid #10B981', mb: 1 }}>
                      <Typography variant="caption" color="#065F46" sx={{ display: 'block', mb: 0.5, fontWeight: 600 }}>Response:</Typography>
                      <Typography variant="body2" color="#065F46">{reclamation.response}</Typography>
                    </Box>
                  )}
                  <Typography variant="caption" color="text.secondary">
                    Submitted on {new Date(reclamation.createdAt).toLocaleDateString()}
                    {reclamation.respondedAt && ` · Responded on ${new Date(reclamation.respondedAt).toLocaleDateString()}`}
                  </Typography>
                </Paper>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReclamationsDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </StudentLayout>
  );
};

export default Results;
