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
  useTheme
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

const ExamResult = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [exam, setExam] = useState(null);

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
      } catch (err) {
        console.error('Error fetching exam result:', err);
        setError('Failed to load exam results. Please try again later.');
        setLoading(false);
      }
    };

    fetchResult();
  }, [id]);

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

      {/* Detailed Results */}
      <Typography variant="h5" component="h2" fontWeight="bold" gutterBottom>
        Detailed Results
      </Typography>

      {exam.sections.map((section) => (
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
              {section.questions.map((question, index) => {
                const answer = result.answers.find(a => a.question._id === question._id);
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
                        />
                      </Box>

                      <Box sx={{ pl: 7, width: '100%' }}>
                        {/* Student's Answer */}
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Your Answer:
                        </Typography>
                        {question.type === 'multiple-choice' ? (
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
                              answer?.selectedOption || 'No answer provided'
                            )}
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
                            {answer?.textAnswer || 'No answer provided'}
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
