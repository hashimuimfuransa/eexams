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
  FormControlLabel as MuiFormControlLabel,
  Grid,
  Divider,
  Chip,
  IconButton,
  Tooltip
} from '@mui/material';
import { Timer, Send, ArrowBack, ArrowForward, Fullscreen, FullscreenExit, Warning, SwapVert, DragIndicator } from '@mui/icons-material';
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
    // Sanitize input to prevent XSS
    if (typeof answer === 'string') {
      // Basic XSS prevention - remove script tags and dangerous attributes
      answer = answer
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/on\w+="[^"]*"/gi, '')
        .replace(/javascript:/gi, '');
    }
    
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
          <Alert 
            severity="warning" 
            sx={{ 
              mb: 3, 
              display: 'flex', 
              alignItems: 'center', 
              gap: 1,
              borderRadius: 2,
              border: '2px solid #F59E0B',
              boxShadow: '0 4px 12px rgba(245, 158, 11, 0.15)'
            }}
          >
            <Warning sx={{ fontSize: 24 }} />
            <Box>
              <Typography fontWeight="bold">
                Please enable fullscreen mode for exam security
              </Typography>
              <Typography variant="body2">
                Press the fullscreen button in the top right corner to continue.
              </Typography>
            </Box>
          </Alert>
        )}

        {/* Header */}
        <Paper 
          sx={{ 
            p: 3, 
            mb: 3, 
            bgcolor: 'white',
            borderRadius: 2,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)'
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box>
              <Typography variant="h5" fontWeight={700} sx={{ color: '#0D406C' }}>
                {examSession?.exam?.title}
              </Typography>
              <Typography sx={{ color: '#64748b', fontSize: 14, mt: 0.5 }}>
                Question {currentQuestionIndex + 1} of {allQuestions.length}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <Button
                size="small"
                variant={isFullscreen ? "contained" : "outlined"}
                startIcon={isFullscreen ? <FullscreenExit /> : <Fullscreen />}
                onClick={toggleFullscreen}
                sx={{
                  borderRadius: 2,
                  fontWeight: 600,
                  bgcolor: isFullscreen ? '#0D406C' : 'transparent',
                  color: isFullscreen ? 'white' : '#0D406C',
                  border: isFullscreen ? 'none' : '2px solid #0D406C',
                  '&:hover': {
                    bgcolor: isFullscreen ? '#0A3256' : 'rgba(13, 64, 108, 0.1)'
                  }
                }}
              >
                {isFullscreen ? 'Exit' : 'Fullscreen'}
              </Button>
              <Box sx={{ textAlign: 'right' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, justifyContent: 'flex-end' }}>
                  <Timer sx={{ color: timeRemaining < 300 ? '#EF4444' : '#0CBD73', fontSize: 24 }} />
                  <Typography sx={{ fontWeight: 700, color: timeRemaining < 300 ? '#EF4444' : '#0F172A', fontSize: 20 }}>
                    {formatTime(timeRemaining || 0)}
                  </Typography>
                </Box>
                <Typography sx={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>
                  {answeredCount}/{allQuestions.length} answered
                </Typography>
              </Box>
            </Box>
          </Box>
          <LinearProgress 
            variant="determinate" 
            value={progress}
            sx={{
              height: 8,
              borderRadius: 4,
              bgcolor: '#E2E8F0',
              '& .MuiLinearProgress-bar': {
                borderRadius: 4,
                bgcolor: '#0D406C'
              }
            }}
          />
        </Paper>

        {/* Question */}
        <Paper 
          sx={{ 
            p: 4, 
            mb: 3, 
            bgcolor: 'white',
            borderRadius: 2,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
            borderLeft: '4px solid #0D406C'
          }}
        >
          <Box sx={{ mb: 2 }}>
            <Chip
              label={`Question ${currentQuestionIndex + 1}`}
              size="small"
              sx={{
                bgcolor: '#0D406C',
                color: 'white',
                fontWeight: 600,
                borderRadius: 1
              }}
            />
            <Chip
              label={currentQuestion.type?.toUpperCase() || 'MULTIPLE CHOICE'}
              size="small"
              sx={{
                ml: 1,
                bgcolor: '#E2E8F0',
                color: '#475569',
                fontWeight: 500,
                borderRadius: 1
              }}
            />
          </Box>
          {/* Only show question text if it's not a fill-in-blank question (to avoid duplication) */}
          {!(currentQuestion.type === 'fill-in-blank' || currentQuestion.type === 'fill_in_blank' || currentQuestion.text?.includes('_____')) && (
            <Typography variant="h6" sx={{ mb: 3, fontWeight: 600, color: '#1E293B', fontSize: '1.2rem' }}>
              {currentQuestion.text}
            </Typography>
          )}

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
                  sx={{ 
                    mb: 2, 
                    p: 2, 
                    border: '1px solid #E2E8F0',
                    borderRadius: 2,
                    width: '100%',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      bgcolor: '#F8FAFC',
                      borderColor: '#0D406C'
                    },
                    ...(answers[currentQuestion._id] === option.text && {
                      bgcolor: '#EFF6FF',
                      borderColor: '#0D406C',
                      borderLeft: '4px solid #0D406C'
                    })
                  }}
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

          {/* Matching Question */}
          {currentQuestion.type === 'matching' && (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 2, color: '#64748b' }}>
                Match the items from the left column with the correct items from the right column
              </Typography>
              <Grid container spacing={2}>
                {/* Use seeded shuffle for consistent ordering based on question ID */}
                {(() => {
                  // Create a seeded random number generator based on question ID
                  const seed = currentQuestion._id || 'default';
                  let seedValue = 0;
                  for (let i = 0; i < seed.length; i++) {
                    seedValue += seed.charCodeAt(i);
                  }
                  
                  const seededRandom = () => {
                    const x = Math.sin(seedValue++) * 10000;
                    return x - Math.floor(x);
                  };

                  // Shuffle left column
                  const shuffledLeft = currentQuestion.matchingPairs?.leftColumn
                    ?.map((item, index) => ({ item, originalIndex: index }))
                    .sort(() => seededRandom() - 0.5) || [];

                  // Shuffle right column with different seed
                  seedValue += 1000; // Different seed for right column
                  const shuffledRight = currentQuestion.matchingPairs?.rightColumn
                    ?.map((item, index) => ({ item, originalIndex: index }))
                    .sort(() => seededRandom() - 0.5) || [];

                  return shuffledLeft.map(({ item, originalIndex }) => (
                    <Grid item xs={12} md={6} key={originalIndex}>
                      <Paper sx={{ p: 2, bgcolor: '#F8FAFC', borderRadius: 1 }}>
                        <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
                          {item}
                        </Typography>
                        <TextField
                          fullWidth
                          select
                          size="small"
                          value={answers[currentQuestion._id]?.[originalIndex] || ''}
                          onChange={(e) => {
                            const newAnswers = answers[currentQuestion._id] || {};
                            newAnswers[originalIndex] = e.target.value;
                            handleAnswerChange(currentQuestion._id, newAnswers);
                          }}
                          SelectProps={{ native: true }}
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1 } }}
                        >
                          <option value="">Select match...</option>
                          {/* Use pre-shuffled right column for consistency */}
                          {shuffledRight.map(({ item, originalIndex: rightIndex }) => (
                            <option key={rightIndex} value={item}>
                              {item}
                            </option>
                          ))}
                        </TextField>
                      </Paper>
                    </Grid>
                  ));
                })()}
              </Grid>
            </Box>
          )}

          {/* Ordering Question */}
          {currentQuestion.type === 'ordering' && (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 2, color: '#64748b' }}>
                Click to arrange the items in the correct order
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {(() => {
                  // Create a seeded random number generator based on question ID for stable shuffle
                  const seed = currentQuestion._id || 'default';
                  let seedValue = 0;
                  for (let i = 0; i < seed.length; i++) {
                    seedValue += seed.charCodeAt(i);
                  }
                  
                  const seededRandom = () => {
                    const x = Math.sin(seedValue++) * 10000;
                    return x - Math.floor(x);
                  };

                  // Shuffle items consistently based on question ID
                  const shuffledItems = currentQuestion.itemsToOrder?.items
                    ?.map((item, index) => ({ item, originalIndex: index }))
                    .sort(() => seededRandom() - 0.5) || [];

                  return shuffledItems.map(({ item, originalIndex }) => {
                    // Only use student's answers, not any pre-filled correct order from question data
                    const studentOrder = answers[currentQuestion._id] || [];
                    const itemIndex = studentOrder.indexOf(item);
                    const currentPosition = itemIndex >= 0 ? itemIndex + 1 : null;
                    
                    return (
                      <Paper
                        key={originalIndex}
                        sx={{
                          p: 2,
                          bgcolor: currentPosition ? '#EFF6FF' : '#F8FAFC',
                          border: currentPosition ? '2px solid #3B82F6' : '1px solid #E2E8F0',
                          borderRadius: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          '&:hover': { bgcolor: '#F1F5F9' }
                        }}
                        onClick={() => {
                          const newOrder = [...studentOrder];
                          if (currentPosition) {
                            newOrder.splice(itemIndex, 1);
                          } else {
                            newOrder.push(item);
                          }
                          handleAnswerChange(currentQuestion._id, newOrder);
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <SwapVert sx={{ color: '#64748b' }} />
                          <Typography variant="body2">{item}</Typography>
                        </Box>
                        {currentPosition && (
                          <Chip
                            label={`#${currentPosition}`}
                            size="small"
                            color="primary"
                            sx={{ fontWeight: 600 }}
                          />
                        )}
                      </Paper>
                    );
                  });
                })()}
              </Box>
              <Typography variant="caption" sx={{ mt: 2, color: '#64748b' }}>
                Click on items to add them to your ordered list. Click again to remove.
              </Typography>
            </Box>
          )}

          {/* Fill-in-blank Question - check first to avoid duplicates */}
          {(currentQuestion.type === 'fill-in-blank' || currentQuestion.type === 'fill_in_blank' || currentQuestion.text?.includes('_____')) && (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 2, color: '#64748b', fontWeight: 500 }}>
                Fill in the blank with the appropriate word or phrase
              </Typography>
              <Box sx={{ mb: 3, p: 3, bgcolor: '#FFFBEB', borderRadius: 2, border: '2px solid #F59E0B' }}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold', color: '#92400E' }}>
                  Complete the sentence:
                </Typography>
                <Typography variant="body1" sx={{ fontSize: '1.1rem', lineHeight: 1.6 }}>
                  {currentQuestion.text.replace(/_+/g, '_____').split('_____').map((part, index, array) => (
                    <React.Fragment key={index}>
                      {part}
                      {index === 0 && array.length > 1 && (
                        <Box
                          component="span"
                          sx={{
                            display: 'inline-block',
                            px: 2,
                            py: 0.5,
                            mx: 1,
                            borderBottom: '3px solid',
                            borderColor: answers[currentQuestion._id] ? '#10B981' : '#F59E0B',
                            backgroundColor: answers[currentQuestion._id] ?
                              'rgba(16, 185, 129, 0.1)' :
                              'rgba(245, 158, 11, 0.1)',
                            fontWeight: 'bold',
                            color: answers[currentQuestion._id] ? '#065F46' : '#92400E',
                            minWidth: '120px',
                            textAlign: 'center',
                            borderRadius: 1,
                            transition: 'all 0.3s ease',
                            fontSize: '1.1rem'
                          }}
                        >
                          {answers[currentQuestion._id] || '[ FILL IN THE BLANK ]'}
                        </Box>
                      )}
                      {index > 0 && array.length > 1 && part.trim() && (
                        <Typography component="span" sx={{ ml: 1, color: '#92400E', fontStyle: 'italic' }}>
                          {part}
                        </Typography>
                      )}
                    </React.Fragment>
                  ))}
                </Typography>
              </Box>
              <TextField
                fullWidth
                multiline
                rows={2}
                placeholder="Type your answer here..."
                value={answers[currentQuestion._id] || ''}
                onChange={(e) => handleAnswerChange(currentQuestion._id, e.target.value)}
                sx={{ 
                  '& .MuiOutlinedInput-root': { 
                    borderRadius: 2,
                    '& fieldset': {
                      borderColor: '#F59E0B'
                    },
                    '&:hover fieldset': {
                      borderColor: '#D97706'
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#D97706'
                    }
                  }
                }}
                helperText="💡 Tip: Type the word or phrase that completes the sentence"
              />
            </Box>
          )}

          {/* Open-ended / Short Answer / Essay Question - only if not fill-in-blank */}
          {!(currentQuestion.type === 'fill-in-blank' || currentQuestion.type === 'fill_in_blank' || currentQuestion.text?.includes('_____')) && 
           (currentQuestion.type === 'open-ended' || currentQuestion.type === 'short-answer' || currentQuestion.type === 'essay') && (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 2, color: '#64748b', fontWeight: 500 }}>
                {currentQuestion.type === 'short-answer' || currentQuestion.sectionName === 'B' ? (
                  <Box sx={{ p: 2, bgcolor: '#EFF6FF', borderRadius: 1, borderLeft: '4px solid #3B82F6' }}>
                    <Typography variant="body2" fontWeight="bold" color="#1E40AF">
                      Short Answer Question: Provide a concise answer (3-5 sentences) addressing the key points.
                    </Typography>
                  </Box>
                ) : (
                  <Box sx={{ p: 2, bgcolor: '#F5F3FF', borderRadius: 1, borderLeft: '4px solid #8B5CF6' }}>
                    <Typography variant="body2" fontWeight="bold" color="#5B21B6">
                      Essay Question: Write a detailed response with introduction, main points, and conclusion.
                    </Typography>
                  </Box>
                )}
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={currentQuestion.sectionName === 'C' || currentQuestion.type === 'essay' ? 12 : 6}
                placeholder={currentQuestion.sectionName === 'C' || currentQuestion.type === 'essay' ?
                  "Write your detailed answer here...\n\nInclude an introduction, main points with examples, and a conclusion." :
                  "Type your concise answer here (3-5 sentences)..."
                }
                value={answers[currentQuestion._id] || ''}
                onChange={(e) => handleAnswerChange(currentQuestion._id, e.target.value)}
                sx={{ 
                  '& .MuiOutlinedInput-root': { 
                    borderRadius: 2,
                    '& fieldset': {
                      borderColor: currentQuestion.sectionName === 'B' ? '#3B82F6' : '#8B5CF6'
                    },
                    '&:hover fieldset': {
                      borderColor: currentQuestion.sectionName === 'B' ? '#2563EB' : '#7C3AED'
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: currentQuestion.sectionName === 'B' ? '#2563EB' : '#7C3AED'
                    }
                  }
                }}
              />
            </Box>
          )}
        </Paper>

        {/* Navigation */}
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'space-between' }}>
          <Button
            variant="outlined"
            startIcon={<ArrowBack />}
            onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
            disabled={currentQuestionIndex === 0}
            sx={{
              borderRadius: 2,
              fontWeight: 600,
              px: 3,
              py: 1.5,
              border: '2px solid #0D406C',
              color: '#0D406C',
              '&:hover': {
                bgcolor: 'rgba(13, 64, 108, 0.1)',
                border: '2px solid #0D406C'
              },
              '&:disabled': {
                border: '2px solid #E2E8F0',
                color: '#94A3B8'
              }
            }}
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
                sx={{
                  borderRadius: 2,
                  fontWeight: 600,
                  px: 4,
                  py: 1.5,
                  bgcolor: '#0D406C',
                  '&:hover': {
                    bgcolor: '#0A3256'
                  },
                  '&:disabled': {
                    bgcolor: '#94A3B8'
                  }
                }}
              >
                Submit Exam
              </Button>
            ) : (
              <Button
                variant="contained"
                endIcon={<ArrowForward />}
                onClick={() => setCurrentQuestionIndex(currentQuestionIndex + 1)}
                sx={{
                  borderRadius: 2,
                  fontWeight: 600,
                  px: 4,
                  py: 1.5,
                  bgcolor: '#0D406C',
                  '&:hover': {
                    bgcolor: '#0A3256'
                  }
                }}
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
