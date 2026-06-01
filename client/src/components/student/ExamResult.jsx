import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  Box,
  Grid,
  Divider,
  Button,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Alert,
  AlertTitle,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Tooltip,
  LinearProgress,
  useTheme,
  Snackbar
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  ExpandMore,
  Check,
  Close,
  ArrowBack,
  Timer,
  School,
  CheckCircle,
  Cancel,
  Info,
  QuestionAnswer,
  Psychology,
  Autorenew,
  Error,
  HourglassEmpty,
  InfoOutlined
} from '@mui/icons-material';
import api from '../../utils/api';
import { formatDate } from '../../utils/formatters';
import { useAuth } from '../../context/AuthContext';

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

const ExamResult = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [exam, setExam] = useState(null);
  const [logoutWarning, setLogoutWarning] = useState(false);

  // Function to determine color based on score percentage
  const getScoreColor = (scoreRatio) => {
    const percentage = scoreRatio * 100;
    if (percentage >= 90) return theme.palette.success.main;
    if (percentage >= 75) return theme.palette.success.light;
    if (percentage >= 60) return theme.palette.primary.main;
    if (percentage >= 50) return theme.palette.warning.main;
    return theme.palette.error.main;
  };

  useEffect(() => {
    const fetchResult = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/exam/result/${id}`);
        setResult(response.data.result);
        setExam(response.data.exam);
        setLoading(false);

        // Auto-logout after viewing results (for security)
        if (user && user.role === 'student') {
          setLogoutWarning(true);
          const logoutTimer = setTimeout(() => {
            logout();
            navigate('/');
          }, 10000); // 10 seconds to view results

          return () => clearTimeout(logoutTimer);
        }
      } catch (err) {
        console.error('Error fetching exam result:', err);
        setError('Failed to load exam results. Please try again later.');
        setLoading(false);
      }
    };

    fetchResult();
  }, [id, user, logout, navigate]);

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ mt: 8, textAlign: 'center' }}>
        <CircularProgress size={60} />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Loading exam results...
        </Typography>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="md" sx={{ mt: 8 }}>
        <Snackbar
          open={logoutWarning}
          autoHideDuration={10000}
          onClose={() => setLogoutWarning(false)}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        >
          <Alert severity="info">
            You will be automatically logged out in 10 seconds for security.
          </Alert>
        </Snackbar>
        <Paper elevation={3} sx={{ p: 4, textAlign: 'center', borderRadius: 0 }}>
          <Typography variant="h5" component="h1" fontWeight="bold" gutterBottom color="error.main">
            Error
          </Typography>
          <Typography variant="body1" paragraph>
            {error}
          </Typography>
          <Button
            variant="contained"
            color="primary"
            onClick={() => navigate('/student/exams')}
            startIcon={<ArrowBack />}
            sx={{ mt: 2, borderRadius: 0 }}
          >
            Back to Exams
          </Button>
        </Paper>
      </Container>
    );
  }

  if (!result || !exam) {
    return (
      <Container maxWidth="md" sx={{ mt: 8, textAlign: 'center' }}>
        <Paper elevation={3} sx={{ p: 4, borderRadius: 0 }}>
          <Typography variant="h5" component="h1" fontWeight="bold" gutterBottom>
            No Results Found
          </Typography>
          <Typography variant="body1" paragraph>
            We couldn't find any results for this exam. Please contact your administrator.
          </Typography>
          <Button
            variant="contained"
            color="primary"
            onClick={() => navigate('/student/exams')}
            startIcon={<ArrowBack />}
            sx={{ mt: 2, borderRadius: 0 }}
          >
            Back to Exams
          </Button>
        </Paper>
      </Container>
    );
  }

  // Calculate score percentage
  const scorePercentage = Math.round((result.totalScore / result.maxPossibleScore) * 100);

  // Determine result status
  const getResultStatus = () => {
    if (scorePercentage >= 80) return { text: 'Excellent', color: 'success.main' };
    if (scorePercentage >= 60) return { text: 'Good', color: 'primary.main' };
    if (scorePercentage >= 40) return { text: 'Fair', color: 'warning.main' };
    return { text: 'Needs Improvement', color: 'error.main' };
  };

  const status = getResultStatus();

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 8 }}>
      <Snackbar
        open={logoutWarning}
        autoHideDuration={10000}
        onClose={() => setLogoutWarning(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity="info">
          You will be automatically logged out in 10 seconds for security.
        </Alert>
      </Snackbar>
      {/* Result Summary */}
      <Paper elevation={3} sx={{ p: 4, mb: 4, borderRadius: 0, position: 'relative', overflow: 'hidden' }}>
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '8px',
            background: `linear-gradient(90deg, ${status.color} 0%, ${status.color} 100%)`,
          }}
        />

        <Grid container spacing={4} alignItems="center">
          <Grid item xs={12} md={7}>
            <Typography variant="h4" component="h1" fontWeight="bold" gutterBottom>
              {exam.title}
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph>
              {exam.description}
            </Typography>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 2 }}>
              <Chip
                icon={<School />}
                label={`Completed: ${formatDate(result.endTime)}`}
                variant="outlined"
              />
              <Chip
                icon={<Timer />}
                label={`Duration: ${Math.round((new Date(result.endTime) - new Date(result.startTime)) / 60000)} minutes`}
                variant="outlined"
              />

              {/* AI Grading Status Indicator */}
              {result.aiGradingStatus && (
                <Chip
                  icon={
                    result.aiGradingStatus === 'completed' ? <CheckCircle /> :
                    result.aiGradingStatus === 'in-progress' ? <Autorenew /> :
                    result.aiGradingStatus === 'failed' ? <Error /> : <HourglassEmpty />
                  }
                  label={
                    result.aiGradingStatus === 'completed' ? 'AI Grading Complete' :
                    result.aiGradingStatus === 'in-progress' ? 'AI Grading in Progress' :
                    result.aiGradingStatus === 'failed' ? 'AI Grading Failed' : 'AI Grading Pending'
                  }
                  color={
                    result.aiGradingStatus === 'completed' ? 'success' :
                    result.aiGradingStatus === 'in-progress' ? 'info' :
                    result.aiGradingStatus === 'failed' ? 'error' : 'default'
                  }
                  variant="outlined"
                />
              )}
            </Box>
          </Grid>

          <Grid item xs={12} md={5}>
            <Box sx={{ textAlign: 'center' }}>
              <Box
                sx={{
                  position: 'relative',
                  width: 180,
                  height: 180,
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  margin: '0 auto',
                }}
              >
                <CircularProgress
                  variant="determinate"
                  value={100}
                  size={180}
                  thickness={4}
                  sx={{ color: 'grey.200', position: 'absolute' }}
                />
                <CircularProgress
                  variant="determinate"
                  value={scorePercentage}
                  size={180}
                  thickness={4}
                  sx={{ color: status.color, position: 'absolute' }}
                />
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                  }}
                >
                  <Typography variant="h3" component="div" fontWeight="bold" sx={{ color: status.color }}>
                    {scorePercentage}%
                  </Typography>
                  <Typography variant="body1" color="text.secondary">
                    {result.totalScore} / {result.maxPossibleScore} points
                  </Typography>
                </Box>
              </Box>

              <Typography variant="h6" sx={{ mt: 2, color: status.color, fontWeight: 'bold' }}>
                {status.text}
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* App Download Recommendation for Failed Questions */}
      {scorePercentage < 70 && (
        <Paper
          elevation={3}
          sx={{
            p: 3,
            mb: 4,
            borderRadius: 0,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
            <Box sx={{ flex: 1, minWidth: 250 }}>
              <Typography variant="h6" fontWeight="bold" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Psychology />
                Improve Your Scores with Excellence Coaching Hub
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                Download our mobile app to access detailed explanations, practice questions, and personalized learning paths to help you master topics you're struggling with.
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                href="https://play.google.com/store/apps/details?id=com.excellencecoachinghub.app&pcampaignid=web_share"
                target="_blank"
                rel="noopener noreferrer"
                startIcon={<GooglePlayIcon />}
                sx={{
                  bgcolor: 'white',
                  color: '#667eea',
                  fontWeight: 'bold',
                  textTransform: 'none',
                  '&:hover': {
                    bgcolor: 'rgba(255,255,255,0.9)',
                    color: '#764ba2'
                  }
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
                sx={{
                  bgcolor: 'white',
                  color: '#667eea',
                  fontWeight: 'bold',
                  textTransform: 'none',
                  '&:hover': {
                    bgcolor: 'rgba(255,255,255,0.9)',
                    color: '#764ba2'
                  }
                }}
              >
                Microsoft Store
              </Button>
            </Box>
          </Box>
        </Paper>
      )}

      {/* Detailed Results */}
      <Typography variant="h5" component="h2" fontWeight="bold" gutterBottom>
        Detailed Results
      </Typography>

      {/* Build a map of all shown question IDs to avoid duplicates */}
      {(() => {
        const shownQuestionIds = new Set();
        
        // First, collect all question IDs from exam sections
        exam.sections?.forEach(section => {
          section.questions?.forEach(q => {
            if (q._id) shownQuestionIds.add(q._id);
          });
        });

        // Find answers not in exam sections (orphaned questions)
        const orphanedAnswers = result.answers.filter(a => 
          a.question?._id && !shownQuestionIds.has(a.question._id)
        );

        return (
          <>
            {/* Render exam sections */}
            {exam.sections?.map((section) => (
              <Accordion key={section.name} defaultExpanded sx={{ mb: 2, borderRadius: 0, overflow: 'hidden' }}>
                <AccordionSummary
                  expandIcon={<ExpandMore />}
                  sx={{
                    bgcolor: 'background.paper',
                    borderLeft: '4px solid',
                    borderColor: 'primary.main',
                  }}
                >
                  <Typography variant="h6" fontWeight="bold">
                    Section {section.name}
                    {section.description && (
                      <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                        - {section.description}
                      </Typography>
                    )}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <List sx={{ width: '100%' }}>
                    {section.questions?.map((question, index) => {
                      const answer = result.answers.find(a => a.question?._id === question._id);
                      const isCorrect = answer?.isCorrect;

                return (
                  <React.Fragment key={question._id}>
                    <ListItem
                      alignItems="flex-start"
                      sx={{
                        flexDirection: 'column',
                        p: 2,
                        bgcolor: isCorrect ? 'success.lighter' : 'error.lighter',
                        borderRadius: 1,
                        mb: 2
                      }}
                    >
                      <Box sx={{ display: 'flex', width: '100%', mb: 1 }}>
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          {isCorrect ? (
                            <CheckCircle color="success" />
                          ) : (
                            <Cancel color="error" />
                          )}
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Typography variant="subtitle1" fontWeight="bold">
                              Question {index + 1}: {question.text}
                            </Typography>
                          }
                          secondary={
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                              {question.points} point{question.points !== 1 ? 's' : ''}
                            </Typography>
                          }
                        />
                        <Chip
                          label={`${answer?.score || 0}/${question.points}`}
                          color={isCorrect ? "success" : "error"}
                          size="small"
                          sx={{ minWidth: 60 }}
                        />
                      </Box>

                      <Box sx={{ pl: 7, width: '100%' }}>
                        {/* Student's Answer */}
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Your Answer:
                        </Typography>
                        {question.type === 'multiple-choice' || question.type === 'true-false' ? (
                          <Box
                            sx={{
                              p: 2,
                              bgcolor: 'background.paper',
                              borderRadius: 1,
                              mb: 2,
                              fontWeight: isCorrect ? 'bold' : 'normal',
                              typography: 'body1'
                            }}
                          >
                            {/* Display option letter if available */}
                            {answer?.selectedOptionLetter ? (
                              <>
                                <Typography component="span" fontWeight="bold" color="primary.main">
                                  {answer.selectedOptionLetter}.{' '}
                                </Typography>
                                {answer.selectedOption || 'No answer provided'}
                              </>
                            ) : (
                              answer?.selectedOption || answer?.textAnswer || 'No answer provided'
                            )}
                          </Box>
                        ) : question.type === 'matching' ? (
                          <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1, mb: 2 }}>
                            {answer?.matchingAnswers && answer.matchingAnswers.length > 0 ? (
                              <Typography variant="body2">
                                {answer.matchingAnswers.map((match, idx) => (
                                  <span key={idx}>Match {idx + 1}: Item {match.left + 1} → Item {match.right + 1}<br /></span>
                                ))}
                              </Typography>
                            ) : (
                              'No matching answer provided'
                            )}
                          </Box>
                        ) : question.type === 'fill-in-blank' || question.type === 'fill-blank' ? (
                          <Box
                            sx={{
                              p: 2,
                              bgcolor: 'background.paper',
                              borderRadius: 1,
                              mb: 2,
                              fontWeight: isCorrect ? 'bold' : 'normal'
                            }}
                          >
                            {answer?.textAnswer || 'No answer provided'}
                          </Box>
                        ) : (
                          <Typography
                            variant="body1"
                            sx={{
                              p: 2,
                              bgcolor: 'background.paper',
                              borderRadius: 1,
                              mb: 2,
                              fontWeight: isCorrect ? 'bold' : 'normal'
                            }}
                          >
                            {answer?.textAnswer || answer?.selectedOption || 'No answer provided'}
                          </Typography>
                        )}

                        {/* Correct Answer (only shown if student's answer is incorrect) */}
                        {!isCorrect && (
                          <>
                            <Typography variant="body2" color="success.main" fontWeight="bold" gutterBottom>
                              Correct Answer:
                            </Typography>
                            {question.type === 'multiple-choice' && answer?.correctOptionLetter ? (
                              <Box
                                sx={{
                                  p: 2,
                                  bgcolor: 'success.lighter',
                                  borderRadius: 1,
                                  mb: 2,
                                  fontWeight: 'bold',
                                  typography: 'body1'
                                }}
                              >
                                <Typography component="span" fontWeight="bold" color="success.main">
                                  {answer.correctOptionLetter}.{' '}
                                </Typography>
                                {question.correctAnswer}
                              </Box>
                            ) : (
                              <Typography
                                variant="body1"
                                sx={{
                                  p: 2,
                                  bgcolor: 'success.lighter',
                                  borderRadius: 1,
                                  mb: 2,
                                  fontWeight: 'bold'
                                }}
                              >
                                {question.correctAnswer}
                              </Typography>
                            )}
                          </>
                        )}

                        {/* Feedback */}
                        {answer?.feedback && (
                          <Alert
                            severity={isCorrect ? "success" : "info"}
                            icon={isCorrect ? <Check /> : <Psychology />}
                            sx={{ mb: 2 }}
                          >
                            <AlertTitle>
                              {isCorrect ? "Correct" : "Feedback"}
                            </AlertTitle>
                            <Typography variant="body2" fontWeight="medium">
                              {answer.feedback}
                            </Typography>
                          </Alert>
                        )}

                        {/* Sub-questions display */}
                        {(question.subQuestions && question.subQuestions.length > 0) || (answer.subQuestionAnswers && answer.subQuestionAnswers.length > 0) ? (
                          <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                              Sub-Questions:
                              {question.subQuestionConfig?.mode === 'choose-n' && (
                                <Chip
                                  label={`Choose ${question.subQuestionConfig.requiredCount || 1}`}
                                  size="small"
                                  color="warning"
                                  sx={{ ml: 1 }}
                                />
                              )}
                            </Typography>

                            {/* Show selected sub-questions for choose-n mode */}
                            {question.subQuestionConfig?.mode === 'choose-n' && answer.selectedSubQuestionIndices && (
                              <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
                                Selected: {answer.selectedSubQuestionIndices.map(idx =>
                                  question.subQuestions[idx]?.label || String.fromCharCode(65 + idx)
                                ).join(', ')}
                              </Typography>
                            )}

                            {/* Display sub-questions from question.subQuestions if available */}
                            {question.subQuestions && question.subQuestions.length > 0 ? (
                              question.subQuestions.map((subQ, subIdx) => {
                                const isSelected = question.subQuestionConfig?.mode === 'choose-n'
                                  ? (answer.selectedSubQuestionIndices || []).includes(subIdx)
                                  : true; // In 'all' mode, all are shown

                                if (!isSelected) return null;

                                const subAnswer = answer.subQuestionAnswers?.[subIdx];
                                const subResult = answer.subQuestionResults?.[subIdx];

                                return (
                                  <Box key={subIdx} sx={{ p: 1.5, mb: 1, bgcolor: 'white', borderRadius: 1, borderLeft: '3px solid', borderColor: subResult?.isCorrect ? 'success.main' : 'error.main' }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                      <Typography variant="body2" fontWeight="medium" sx={{ flex: 1 }}>
                                        {subQ.label || `Part ${String.fromCharCode(65 + subIdx)}`}: {subQ.text}
                                      </Typography>
                                      {subResult && (
                                        <Chip
                                          icon={subResult.isCorrect ? <CheckCircle fontSize="small" /> : <Cancel fontSize="small" />}
                                          label={`${subResult.score}/${subResult.maxPoints || subQ.points || 1}`}
                                          color={subResult.isCorrect ? 'success' : 'error'}
                                          size="small"
                                          sx={{ ml: 1 }}
                                        />
                                      )}
                                    </Box>
                                    {subAnswer?.answered ? (
                                      <Box sx={{ mt: 1 }}>
                                        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                                          <strong>Your answer:</strong> {subAnswer.selectedOption || subAnswer.textAnswer || 'Answered'}
                                        </Typography>
                                        {subResult && !subResult.isCorrect && subResult.correctedAnswer && (
                                          <Typography variant="body2" color="success.main" sx={{ mb: 0.5 }}>
                                            <strong>Correct answer:</strong> {subResult.correctedAnswer}
                                          </Typography>
                                        )}
                                        {subResult && subResult.feedback && (
                                          <Alert
                                            severity={isCorrect ? "success" : "info"}
                                            icon={isCorrect ? <Check fontSize="small" /> : <InfoOutlined fontSize="small" />}
                                            sx={{ mt: 1, py: 0.5, px: 1 }}
                                          >
                                            <Typography variant="body2" fontWeight="medium">
                                              {subResult.feedback}
                                            </Typography>
                                          </Alert>
                                        )}
                                      </Box>
                                    ) : (
                                      <Typography variant="body2" color="error.main" sx={{ mt: 1 }}>
                                        Not answered
                                      </Typography>
                                    )}
                                  </Box>
                                );
                              })
                            ) : (
                              /* Fallback: Display sub-answers when question.subQuestions doesn't exist */
                              answer.subQuestionAnswers && answer.subQuestionAnswers.map((subAnswer, subIdx) => {
                                const subResult = answer.subQuestionResults?.[subIdx];
                                const isCorrect = subResult?.isCorrect;

                                return (
                                  <Box key={subIdx} sx={{ p: 1.5, mb: 1, bgcolor: 'white', borderRadius: 1, borderLeft: '3px solid', borderColor: isCorrect ? 'success.main' : 'error.main' }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                      <Typography variant="body2" fontWeight="medium" sx={{ flex: 1 }}>
                                        Part {subIdx + 1}
                                      </Typography>
                                      {subResult && (
                                        <Chip
                                          icon={isCorrect ? <CheckCircle fontSize="small" /> : <Cancel fontSize="small" />}
                                          label={`${subResult.score}/${subResult.maxPoints || 1}`}
                                          color={isCorrect ? 'success' : 'error'}
                                          size="small"
                                          sx={{ ml: 1 }}
                                        />
                                      )}
                                    </Box>
                                    {subAnswer?.answered ? (
                                      <Box sx={{ mt: 1 }}>
                                        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                                          <strong>Your answer:</strong> {subAnswer.selectedOption || subAnswer.textAnswer || 'Answered'}
                                        </Typography>
                                        {subResult && !isCorrect && subResult.correctedAnswer && (
                                          <Typography variant="body2" color="success.main" sx={{ mb: 0.5 }}>
                                            <strong>Correct answer:</strong> {subResult.correctedAnswer}
                                          </Typography>
                                        )}
                                        {subResult && subResult.feedback && (
                                          <Alert
                                            severity={isCorrect ? "success" : "info"}
                                            icon={isCorrect ? <Check fontSize="small" /> : <InfoOutlined fontSize="small" />}
                                            sx={{ mt: 1, py: 0.5, px: 1 }}
                                          >
                                            <Typography variant="body2" fontWeight="medium">
                                              {subResult.feedback}
                                            </Typography>
                                          </Alert>
                                        )}
                                      </Box>
                                    ) : (
                                      <Typography variant="body2" color="error.main" sx={{ mt: 1 }}>
                                        Not answered
                                      </Typography>
                                    )}
                                  </Box>
                                );
                              })
                            )}
                          </Box>
                        ) : null}

                        {/* App Recommendation for Failed Questions */}
                        {!isCorrect && (
                          <Box
                            sx={{
                              mt: 2,
                              p: 2,
                              bgcolor: alpha(theme.palette.primary.main, 0.05),
                              borderRadius: 1,
                              border: '1px solid',
                              borderColor: alpha(theme.palette.primary.main, 0.2)
                            }}
                          >
                            <Typography variant="subtitle2" color="primary.main" gutterBottom sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
                              <Psychology sx={{ fontSize: '1rem', mr: 1 }} />
                              Need help understanding this topic?
                            </Typography>
                            <Typography variant="body2" sx={{ mb: 1.5, lineHeight: 1.5 }}>
                              Download Excellence Coaching Hub app for detailed explanations and practice on this topic.
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                              <Button
                                size="small"
                                variant="outlined"
                                href="https://play.google.com/store/apps/details?id=com.excellencecoachinghub.app&pcampaignid=web_share"
                                target="_blank"
                                rel="noopener noreferrer"
                                startIcon={<GooglePlayIcon />}
                                sx={{
                                  textTransform: 'none',
                                  fontWeight: 'bold',
                                  fontSize: '0.75rem'
                                }}
                              >
                                Google Play
                              </Button>
                              <Button
                                size="small"
                                variant="outlined"
                                href="https://apps.microsoft.com/detail/9NW5V60BNHNN?hl=en-us&gl=US&ocid=pdpshare"
                                target="_blank"
                                rel="noopener noreferrer"
                                startIcon={<MicrosoftStoreIcon />}
                                sx={{
                                  textTransform: 'none',
                                  fontWeight: 'bold',
                                  fontSize: '0.75rem'
                                }}
                              >
                                Microsoft Store
                              </Button>
                            </Box>
                          </Box>
                        )}

                        {/* Enhanced AI Grading Details - for open-ended questions (Sections B & C) */}
                        {(question.type === 'open-ended' || question.type === 'fill-in-blank') && answer?.score !== undefined && (
                          <Box sx={{ mt: 2, mb: 2, p: 3, bgcolor: alpha(theme.palette.primary.main, 0.05), borderRadius: 2, border: '1px solid', borderColor: alpha(theme.palette.primary.main, 0.2) }}>
                            <Typography variant="subtitle1" color="primary.main" gutterBottom sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
                              <Psychology sx={{ fontSize: '1.2rem', mr: 1 }} />
                              🤖 AI Grading Analysis for Section {question.section}
                            </Typography>

                            <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                              <Box sx={{ flex: 1 }}>
                                <Typography variant="body2" color="text.secondary" gutterBottom>
                                  Score Quality
                                </Typography>
                                <LinearProgress
                                  variant="determinate"
                                  value={(answer.score / question.points) * 100}
                                  sx={{
                                    height: 8,
                                    borderRadius: 4,
                                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                                    '& .MuiLinearProgress-bar': {
                                      bgcolor: getScoreColor(answer.score / question.points),
                                    }
                                  }}
                                />
                              </Box>
                              <Box sx={{ ml: 2, minWidth: 60, textAlign: 'right' }}>
                                <Typography variant="body2" fontWeight="bold" color={getScoreColor(answer.score / question.points)}>
                                  {Math.round((answer.score / question.points) * 100)}%
                                </Typography>
                              </Box>
                            </Box>

                            {answer.conceptsPresent && answer.conceptsPresent.length > 0 && (
                              <Box sx={{ mt: 2 }}>
                                <Typography variant="body2" color="text.secondary" gutterBottom>
                                  Key Concepts Covered:
                                </Typography>
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 0.5 }}>
                                  {answer.conceptsPresent.map((concept, idx) => (
                                    <Chip
                                      key={idx}
                                      label={concept}
                                      size="small"
                                      color="success"
                                      variant="outlined"
                                      icon={<Check fontSize="small" />}
                                    />
                                  ))}
                                </Box>
                              </Box>
                            )}

                            {answer.conceptsMissing && answer.conceptsMissing.length > 0 && (
                              <Box sx={{ mt: 2 }}>
                                <Typography variant="body2" color="text.secondary" gutterBottom>
                                  Concepts to Improve:
                                </Typography>
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 0.5 }}>
                                  {answer.conceptsMissing.map((concept, idx) => (
                                    <Chip
                                      key={idx}
                                      label={concept}
                                      size="small"
                                      color="error"
                                      variant="outlined"
                                      icon={<Close fontSize="small" />}
                                    />
                                  ))}
                                </Box>
                              </Box>
                            )}

                            {/* Enhanced AI Feedback for Sections B & C */}
                            {answer.feedback && (question.section === 'B' || question.section === 'C') && (
                              <Box sx={{ mt: 3, p: 2, bgcolor: alpha(theme.palette.info.main, 0.05), borderRadius: 1, border: '1px solid', borderColor: alpha(theme.palette.info.main, 0.2) }}>
                                <Typography variant="subtitle2" color="info.main" gutterBottom sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
                                  <Psychology sx={{ fontSize: '1rem', mr: 1 }} />
                                  AI Detailed Feedback
                                </Typography>
                                <Typography variant="body2" sx={{ lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                                  {answer.feedback}
                                </Typography>
                              </Box>
                            )}

                            {/* Model Answer Display for Sections B & C */}
                            {answer.correctedAnswer && (question.section === 'B' || question.section === 'C') && (
                              <Box sx={{ mt: 3, p: 2, bgcolor: alpha(theme.palette.success.main, 0.05), borderRadius: 1, border: '1px solid', borderColor: alpha(theme.palette.success.main, 0.2) }}>
                                <Typography variant="subtitle2" color="success.main" gutterBottom sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
                                  <CheckCircle sx={{ fontSize: '1rem', mr: 1 }} />
                                  Model Answer
                                </Typography>
                                <Typography variant="body2" sx={{ lineHeight: 1.6, whiteSpace: 'pre-wrap', fontStyle: 'italic' }}>
                                  {answer.correctedAnswer}
                                </Typography>
                              </Box>
                            )}

                            {/* AI Grading Method Indicator */}
                            {answer.gradingMethod && (question.section === 'B' || question.section === 'C') && (
                              <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Chip
                                  size="small"
                                  label={
                                    answer.gradingMethod === 'enhanced_ai' || answer.gradingMethod === 'enhanced_ai_grading' ? 'AI Graded' :
                                    answer.gradingMethod === 'semantic_match' ? 'AI + Semantic Analysis' :
                                    answer.gradingMethod === 'keyword_matching' ? 'Keyword Analysis' :
                                    'Automated Grading'
                                  }
                                  color={
                                    answer.gradingMethod === 'enhanced_ai' || answer.gradingMethod === 'enhanced_ai_grading' ? 'primary' :
                                    answer.gradingMethod === 'semantic_match' ? 'secondary' :
                                    'default'
                                  }
                                  variant="outlined"
                                  icon={<Psychology />}
                                />
                                {answer.gradingMethod === 'enhanced_ai' || answer.gradingMethod === 'enhanced_ai_grading' ? (
                                  <Typography variant="caption" color="text.secondary">
                                    Graded using advanced AI analysis
                                  </Typography>
                                ) : null}
                              </Box>
                            )}
                          </Box>
                        )}
                      </Box>
                    </ListItem>
                    {index < section.questions.length - 1 && <Divider />}
                  </React.Fragment>
                );
              })}
            </List>
          </AccordionDetails>
        </Accordion>
      ))}

            {/* Render orphaned questions (those not in exam sections) */}
            {orphanedAnswers.length > 0 && (
              <Accordion defaultExpanded sx={{ mb: 2, borderRadius: 0, overflow: 'hidden' }}>
                <AccordionSummary
                  expandIcon={<ExpandMore />}
                  sx={{
                    bgcolor: 'background.paper',
                    borderLeft: '4px solid',
                    borderColor: 'warning.main',
                  }}
                >
                  <Typography variant="h6" fontWeight="bold">
                    Additional Questions
                    <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                      - Fill-in-blank, Matching, and Other Question Types
                    </Typography>
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <List sx={{ width: '100%' }}>
                    {orphanedAnswers.map((answer, index) => {
                      const question = answer.question;
                      const isCorrect = answer?.isCorrect;

                      return (
                        <React.Fragment key={question._id || index}>
                          <ListItem
                            alignItems="flex-start"
                            sx={{
                              flexDirection: 'column',
                              p: 2,
                              bgcolor: isCorrect ? 'success.lighter' : 'error.lighter',
                              borderRadius: 1,
                              mb: 2
                            }}
                          >
                            <Box sx={{ display: 'flex', width: '100%', mb: 1 }}>
                              <ListItemIcon sx={{ minWidth: 36 }}>
                                {isCorrect ? (
                                  <CheckCircle color="success" />
                                ) : (
                                  <Cancel color="error" />
                                )}
                              </ListItemIcon>
                              <ListItemText
                                primary={
                                  <Typography variant="subtitle1" fontWeight="bold">
                                    Question {index + 1}: {question.text || 'Question text not available'}
                                  </Typography>
                                }
                                secondary={
                                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                    Type: {question.type || 'unknown'} | {question.points || 1} point{question.points !== 1 ? 's' : ''}
                                  </Typography>
                                }
                              />
                              <Chip
                                label={`${answer?.score || 0}/${question.points || 1}`}
                                color={isCorrect ? "success" : "error"}
                                size="small"
                                sx={{ minWidth: 60 }}
                              />
                            </Box>

                            <Box sx={{ pl: 7, width: '100%' }}>
                              {/* Student's Answer */}
                              <Typography variant="body2" color="text.secondary" gutterBottom>
                                Your Answer:
                              </Typography>
                              {question.type === 'multiple-choice' || question.type === 'true-false' ? (
                                <Box
                                  sx={{
                                    p: 2,
                                    bgcolor: 'background.paper',
                                    borderRadius: 1,
                                    mb: 2,
                                    fontWeight: isCorrect ? 'bold' : 'normal',
                                    typography: 'body1'
                                  }}
                                >
                                  {answer?.selectedOption || answer?.textAnswer || 'No answer provided'}
                                </Box>
                              ) : question.type === 'matching' ? (
                                <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1, mb: 2 }}>
                                  {answer?.matchingAnswers ? (
                                    <Typography variant="body2">
                                      {answer.matchingAnswers.map((match, idx) => (
                                        <span key={idx}>Match {idx + 1}: {match.left} → {match.right}<br /></span>
                                      ))}
                                    </Typography>
                                  ) : (
                                    'No matching answer provided'
                                  )}
                                </Box>
                              ) : question.type === 'fill-in-blank' || question.type === 'fill-blank' ? (
                                <Box
                                  sx={{
                                    p: 2,
                                    bgcolor: 'background.paper',
                                    borderRadius: 1,
                                    mb: 2,
                                    fontWeight: isCorrect ? 'bold' : 'normal'
                                  }}
                                >
                                  {answer?.textAnswer || 'No answer provided'}
                                </Box>
                              ) : (
                                <Typography
                                  variant="body1"
                                  sx={{
                                    p: 2,
                                    bgcolor: 'background.paper',
                                    borderRadius: 1,
                                    mb: 2,
                                    fontWeight: isCorrect ? 'bold' : 'normal'
                                  }}
                                >
                                  {answer?.textAnswer || answer?.selectedOption || 'No answer provided'}
                                </Typography>
                              )}

                              {/* Correct Answer (only shown if student's answer is incorrect) */}
                              {!isCorrect && question.correctAnswer && (
                                <>
                                  <Typography variant="body2" color="success.main" fontWeight="bold" gutterBottom>
                                    Correct Answer:
                                  </Typography>
                                  <Typography
                                    variant="body1"
                                    sx={{
                                      p: 2,
                                      bgcolor: 'success.lighter',
                                      borderRadius: 1,
                                      mb: 2,
                                      fontWeight: 'bold'
                                    }}
                                  >
                                    {question.correctAnswer}
                                  </Typography>
                                </>
                              )}

                              {/* Feedback */}
                              {answer?.feedback && (
                                <Alert
                                  severity={isCorrect ? "success" : "info"}
                                  icon={isCorrect ? <Check /> : <Psychology />}
                                  sx={{ mb: 2 }}
                                >
                                  <AlertTitle>
                                    {isCorrect ? "Correct" : "Feedback"}
                                  </AlertTitle>
                                  <Typography variant="body2" fontWeight="medium">
                                    {answer.feedback}
                                  </Typography>
                                </Alert>
                              )}
                            </Box>
                          </ListItem>
                          {index < orphanedAnswers.length - 1 && <Divider />}
                        </React.Fragment>
                      );
                    })}
                  </List>
                </AccordionDetails>
              </Accordion>
            )}
          </>
        );
      })()}

      <Box sx={{ mt: 4, display: 'flex', justifyContent: 'center', gap: 2 }}>
        <Button
          variant="contained"
          color="primary"
          onClick={() => navigate('/student/exams')}
          startIcon={<ArrowBack />}
          sx={{ borderRadius: 0 }}
        >
          Back to Exams
        </Button>

        {/* Regrade button - only show if AI grading failed or if there are answers without feedback */}
        {(result.aiGradingStatus === 'failed' ||
          result.answers.some(a => a.textAnswer && !a.feedback)) && (
          <Button
            variant="outlined"
            color="secondary"
            onClick={async () => {
              try {
                setLoading(true);
                await api.post(`/exam/regrade/${result._id}`);
                // Reload the page to show updated results
                window.location.reload();
              } catch (err) {
                console.error('Error requesting regrade:', err);
                setError('Failed to request regrade. Please try again later.');
                setLoading(false);
              }
            }}
            startIcon={<Autorenew />}
            sx={{ borderRadius: 0 }}
            disabled={loading || result.aiGradingStatus === 'in-progress'}
          >
            Request AI Regrade
          </Button>
        )}
      </Box>
    </Container>
  );
};

export default ExamResult;
