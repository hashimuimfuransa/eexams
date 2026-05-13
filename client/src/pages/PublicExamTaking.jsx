import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Paper,
  Typography,
  Button,
  Card,
  CardContent,
  Radio,
  RadioGroup,
  FormControlLabel,
  TextField,
  CircularProgress,
  Alert,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Checkbox,
  FormControlLabel as MuiFormControlLabel
} from '@mui/material';
import { Timer, Send, ArrowBack, ArrowForward, Fullscreen, FullscreenExit, Warning } from '@mui/icons-material';
import api from '../services/api';

const PublicExamTaking = () => {
  const { shareToken } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [examSession, setExamSession] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [allQuestions, setAllQuestions] = useState([]);
  const [showInstructions, setShowInstructions] = useState(true);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [examStarted, setExamStarted] = useState(false);

  useEffect(() => {
    // Get the exam session from localStorage
    const sessionStr = localStorage.getItem('publicExamSession');
    
    if (!sessionStr) {
      setError('No active exam session. Please access the exam via the public link.');
      setLoading(false);
      return;
    }

    try {
      const session = JSON.parse(sessionStr);
      
      // Verify the shareToken matches
      if (session.shareToken !== shareToken) {
        setError('Invalid exam session.');
        setLoading(false);
        return;
      }

      setExamSession(session);
      
      console.log('Exam session loaded:', session);
      console.log('Exam data:', session.exam);
      console.log('Sections:', session.exam?.sections);
      
      // Flatten all questions from sections
      const questions = [];
      if (session.exam?.sections && Array.isArray(session.exam.sections)) {
        console.log('Processing sections:', session.exam.sections.length);
        session.exam.sections.forEach((section, sectionIdx) => {
          console.log(`Section ${sectionIdx} (${section.name}):`, section);
          if (section.questions && Array.isArray(section.questions)) {
            console.log(`  Found ${section.questions.length} questions`);
            section.questions.forEach((q, qIdx) => {
              console.log(`  Question ${qIdx}:`, q);
              questions.push({
                ...q,
                sectionName: section.name
              });
            });
          } else {
            console.log(`  No questions array found`);
          }
        });
      } else {
        console.log('No sections found or sections is not an array');
      }
      
      console.log('Total questions flattened:', questions.length);
      setAllQuestions(questions);
      
      // Initialize time limit
      if (session.exam?.timeLimit) {
        setTimeRemaining(session.exam.timeLimit * 60); // Convert to seconds
      }
      
      setLoading(false);
    } catch (err) {
      console.error('Error loading exam session:', err);
      setError('Failed to load exam session.');
      setLoading(false);
    }
  }, [shareToken]);

  // Timer effect
  useEffect(() => {
    if (!timeRemaining || timeRemaining <= 0) return;

    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          handleSubmitExam();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeRemaining]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsFullscreen(false);
      } else {
        setIsFullscreen(true);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Prevent tab switching and other security measures
  useEffect(() => {
    if (!examStarted) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.warn('User switched tabs during exam');
      }
    };

    const handleBeforeUnload = (e) => {
      if (examStarted && !submitting) {
        e.preventDefault();
        e.returnValue = 'Are you sure you want to leave? Your exam will be submitted.';
        return 'Are you sure you want to leave? Your exam will be submitted.';
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [examStarted, submitting]);

  const handleAnswerChange = (questionId, answer) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));
  };

  const handleSubmitExam = async () => {
    setSubmitting(true);
    try {
      // Submit exam answers
      const response = await api.post(`/share/${shareToken}/submit`, {
        answers,
        studentId: examSession.studentId
      });

      // Clear session and redirect to results
      localStorage.removeItem('publicExamSession');
      navigate(`/exam-result/${response.data.resultId}`);
    } catch (err) {
      console.error('Error submitting exam:', err);
      setError('Failed to submit exam. Please try again.');
    } finally {
      setSubmitting(false);
      setShowSubmitDialog(false);
    }
  };

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const currentQuestion = allQuestions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / allQuestions.length) * 100;
  const answeredCount = Object.keys(answers).length;

  const handleStartExam = () => {
    if (!agreedToTerms) {
      alert('Please agree to the terms and conditions to proceed.');
      return;
    }
    setShowInstructions(false);
    setExamStarted(true);
    
    // Request fullscreen
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
      elem.requestFullscreen().catch(err => {
        console.log('Fullscreen request failed:', err);
      });
    }
  };

  const handleExitFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }
  };

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (err) {
      console.error('Fullscreen error:', err);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="error">{error}</Alert>
        <Button onClick={() => navigate('/')} sx={{ mt: 2 }}>Go to Home</Button>
      </Container>
    );
  }

  // Instructions Page
  if (showInstructions) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: '#F1F5F9', py: 4 }}>
        <Container maxWidth="md">
          <Paper sx={{ p: 4, bgcolor: 'white' }}>
            <Typography variant="h4" fontWeight={700} sx={{ mb: 3, color: '#0D406C' }}>
              {examSession?.exam?.title}
            </Typography>

            <Alert severity="info" sx={{ mb: 3 }}>
              <Typography fontWeight={600}>Important Instructions</Typography>
            </Alert>

            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                📋 Exam Details
              </Typography>
              <Box sx={{ bgcolor: '#F8FAFC', p: 3, borderRadius: 2, mb: 2 }}>
                <Typography sx={{ mb: 1 }}>
                  <strong>Total Questions:</strong> {allQuestions.length}
                </Typography>
                <Typography sx={{ mb: 1 }}>
                  <strong>Time Limit:</strong> {examSession?.exam?.timeLimit} minutes
                </Typography>
                <Typography sx={{ mb: 1 }}>
                  <strong>Passing Score:</strong> {examSession?.exam?.passingScore}%
                </Typography>
              </Box>
            </Box>

            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                ⚠️ Security & Conduct Rules
              </Typography>
              <Box sx={{ bgcolor: '#FEF3C7', p: 3, borderRadius: 2, border: '1px solid #FCD34D' }}>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  <li>This exam will be taken in <strong>fullscreen mode</strong></li>
                  <li>Do not minimize the browser or switch tabs during the exam</li>
                  <li>Do not use external resources or aids</li>
                  <li>Do not share answers with other students</li>
                  <li>The timer will auto-submit when time expires</li>
                  <li>All answers are automatically saved as you progress</li>
                  <li>You cannot go back to previous questions after moving forward</li>
                </ul>
              </Box>
            </Box>

            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                ✓ How to Take the Exam
              </Typography>
              <Box sx={{ bgcolor: '#F8FAFC', p: 3, borderRadius: 2 }}>
                <ol style={{ margin: 0, paddingLeft: 20 }}>
                  <li>Read each question carefully</li>
                  <li>Select your answer from the options provided</li>
                  <li>Click "Next" to proceed to the next question</li>
                  <li>Use the timer to manage your time</li>
                  <li>Click "Submit Exam" on the last question to finish</li>
                </ol>
              </Box>
            </Box>

            <Box sx={{ mb: 4, p: 3, bgcolor: '#EFF6FF', borderRadius: 2, border: '1px solid #BFDBFE' }}>
              <MuiFormControlLabel
                control={
                  <Checkbox
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                  />
                }
                label={
                  <Typography>
                    I understand the rules and agree to follow the exam conduct guidelines. I confirm that I will take this exam honestly and without any external assistance.
                  </Typography>
                }
              />
            </Box>

            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="outlined"
                onClick={() => navigate('/')}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                size="large"
                onClick={handleStartExam}
                disabled={!agreedToTerms}
                sx={{ flex: 1 }}
              >
                Start Exam
              </Button>
            </Box>
          </Paper>
        </Container>
      </Box>
    );
  }

  if (!currentQuestion) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="warning">No questions found in this exam.</Alert>
      </Container>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#F1F5F9', py: 4, position: 'relative' }}>
      <Container maxWidth="lg">
        {/* Security Warning */}
        {!isFullscreen && (
          <Alert severity="warning" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Warning sx={{ fontSize: 20 }} />
            <Typography>
              Please enable fullscreen mode for exam security. Press the fullscreen button in the top right.
            </Typography>
          </Alert>
        )}

        {/* Header */}
        <Paper sx={{ p: 3, mb: 3, bgcolor: 'white' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box>
              <Typography variant="h5" fontWeight={700}>
                {examSession?.exam?.title}
              </Typography>
              <Typography sx={{ color: '#64748b', fontSize: 14 }}>
                Question {currentQuestionIndex + 1} of {allQuestions.length}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <Button
                size="small"
                variant="outlined"
                startIcon={isFullscreen ? <FullscreenExit /> : <Fullscreen />}
                onClick={toggleFullscreen}
              >
                {isFullscreen ? 'Exit' : 'Fullscreen'}
              </Button>
              <Box sx={{ textAlign: 'right' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Timer sx={{ color: timeRemaining < 300 ? '#EF4444' : '#0CBD73' }} />
                  <Typography sx={{ fontWeight: 700, color: timeRemaining < 300 ? '#EF4444' : '#0F172A' }}>
                    {formatTime(timeRemaining || 0)}
                  </Typography>
                </Box>
                <Typography sx={{ fontSize: 12, color: '#64748b' }}>
                  {answeredCount}/{allQuestions.length} answered
                </Typography>
              </Box>
            </Box>
          </Box>
          <LinearProgress variant="determinate" value={progress} />
        </Paper>

        {/* Question */}
        <Paper sx={{ p: 4, mb: 3, bgcolor: 'white' }}>
          <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
            {currentQuestion.text}
          </Typography>

          {/* Answer Options */}
          {currentQuestion.type === 'multiple-choice' && (
            <RadioGroup
              value={answers[currentQuestion._id] || ''}
              onChange={(e) => handleAnswerChange(currentQuestion._id, e.target.value)}
            >
              {currentQuestion.options?.map((option, idx) => (
                <FormControlLabel
                  key={idx}
                  value={option.text || option.letter}
                  control={<Radio />}
                  label={option.text}
                  sx={{ mb: 2, p: 2, border: '1px solid #e2e8f0', borderRadius: 1 }}
                />
              ))}
            </RadioGroup>
          )}

          {currentQuestion.type === 'true-false' && (
            <RadioGroup
              value={answers[currentQuestion._id] || ''}
              onChange={(e) => handleAnswerChange(currentQuestion._id, e.target.value)}
            >
              <FormControlLabel
                value="True"
                control={<Radio />}
                label="True"
                sx={{ mb: 2, p: 2, border: '1px solid #e2e8f0', borderRadius: 1 }}
              />
              <FormControlLabel
                value="False"
                control={<Radio />}
                label="False"
                sx={{ mb: 2, p: 2, border: '1px solid #e2e8f0', borderRadius: 1 }}
              />
            </RadioGroup>
          )}

          {(currentQuestion.type === 'open-ended' || currentQuestion.type === 'fill-in-blank') && (
            <TextField
              fullWidth
              multiline
              rows={4}
              placeholder="Enter your answer..."
              value={answers[currentQuestion._id] || ''}
              onChange={(e) => handleAnswerChange(currentQuestion._id, e.target.value)}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1 } }}
            />
          )}
        </Paper>

        {/* Navigation */}
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'space-between' }}>
          <Button
            variant="outlined"
            startIcon={<ArrowBack />}
            onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
            disabled={currentQuestionIndex === 0}
          >
            Previous
          </Button>

          <Box sx={{ display: 'flex', gap: 2 }}>
            {currentQuestionIndex === allQuestions.length - 1 ? (
              <Button
                variant="contained"
                endIcon={<Send />}
                onClick={() => setShowSubmitDialog(true)}
                disabled={submitting}
              >
                Submit Exam
              </Button>
            ) : (
              <Button
                variant="contained"
                endIcon={<ArrowForward />}
                onClick={() => setCurrentQuestionIndex(currentQuestionIndex + 1)}
              >
                Next
              </Button>
            )}
          </Box>
        </Box>
      </Container>

      {/* Submit Confirmation Dialog */}
      <Dialog open={showSubmitDialog} onClose={() => setShowSubmitDialog(false)}>
        <DialogTitle>Submit Exam?</DialogTitle>
        <DialogContent>
          <Typography>
            You have answered {answeredCount} out of {allQuestions.length} questions.
            Are you sure you want to submit?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSubmitDialog(false)}>Cancel</Button>
          <Button
            onClick={handleSubmitExam}
            variant="contained"
            disabled={submitting}
          >
            {submitting ? 'Submitting...' : 'Submit'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PublicExamTaking;
