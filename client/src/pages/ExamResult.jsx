import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Paper,
  Typography,
  Button,
  LinearProgress,
  Card,
  CardContent,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
  Snackbar
} from '@mui/material';
import { CheckCircle, Cancel, Home } from '@mui/icons-material';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const ExamResult = () => {
  const { resultId } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [logoutWarning, setLogoutWarning] = useState(false);

  useEffect(() => {
    const fetchResult = async () => {
      try {
        const response = await api.get(`/results/${resultId}`);
        setResult(response.data);
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
        console.error('Error loading result:', err);
        setError('Failed to load exam result');
        setLoading(false);
      }
    };

    fetchResult();
  }, [resultId, user, logout, navigate]);

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

  if (!result) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="warning">Result not found</Alert>
      </Container>
    );
  }

  const percentage = result.maxPossibleScore > 0 
    ? (result.totalScore / result.maxPossibleScore) * 100 
    : 0;
  const passingScore = 70; // Default passing score
  const isPassed = percentage >= passingScore;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#F1F5F9', py: 4 }}>
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
      <Container maxWidth="lg">
        {/* Score Card */}
        <Paper sx={{ p: 4, mb: 4, bgcolor: 'white', textAlign: 'center' }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
            {isPassed ? (
              <CheckCircle sx={{ fontSize: 80, color: '#0CBD73' }} />
            ) : (
              <Cancel sx={{ fontSize: 80, color: '#EF4444' }} />
            )}
          </Box>

          <Typography variant="h4" fontWeight={700} sx={{ mb: 2 }}>
            {isPassed ? 'Congratulations!' : 'Result'}
          </Typography>

          <Typography sx={{ color: '#64748b', mb: 3, fontSize: 16 }}>
            {isPassed
              ? 'You have successfully passed the exam!'
              : 'You did not meet the passing score. Please review the answers below.'}
          </Typography>

          <Box sx={{ mb: 4 }}>
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 2, mb: 2 }}>
              <Typography variant="h2" fontWeight={700} sx={{ color: isPassed ? '#0CBD73' : '#EF4444' }}>
                {Math.round(percentage)}%
              </Typography>
              <Typography sx={{ color: '#64748b', mb: 1 }}>
                ({result.totalScore}/{result.maxPossibleScore} points)
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={percentage}
              sx={{
                height: 10,
                borderRadius: 5,
                backgroundColor: '#E2E8F0',
                '& .MuiLinearProgress-bar': {
                  backgroundColor: isPassed ? '#0CBD73' : '#EF4444',
                  borderRadius: 5
                }
              }}
            />
          </Box>

          <Chip
            label={isPassed ? 'PASSED' : 'FAILED'}
            color={isPassed ? 'success' : 'error'}
            sx={{ fontWeight: 700, fontSize: 14, px: 2, py: 3 }}
          />
        </Paper>

        {/* Detailed Answers */}
        <Paper sx={{ p: 4, mb: 4, bgcolor: 'white' }}>
          <Typography variant="h6" fontWeight={700} sx={{ mb: 3 }}>
            Detailed Answers
          </Typography>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ backgroundColor: '#F8FAFC' }}>
                  <TableCell sx={{ fontWeight: 700 }}>Question</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Your Answer</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Correct Answer</TableCell>
                  <TableCell sx={{ fontWeight: 700, textAlign: 'center' }}>Result</TableCell>
                  <TableCell sx={{ fontWeight: 700, textAlign: 'right' }}>Points</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {result.answers?.map((answer, idx) => (
                  <TableRow key={idx} sx={{ '&:hover': { backgroundColor: '#F8FAFC' } }}>
                    <TableCell sx={{ maxWidth: 300 }}>
                      <Typography sx={{ fontSize: 14 }}>
                        {idx + 1}. Question {idx + 1}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontSize: 14, color: '#64748b' }}>
                        {answer.selectedOption || answer.textAnswer || 'Not answered'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontSize: 14, color: '#0CBD73', fontWeight: 600 }}>
                        {answer.correctedAnswer || 'N/A'}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ textAlign: 'center' }}>
                      {answer.isCorrect ? (
                        <CheckCircle sx={{ color: '#0CBD73' }} />
                      ) : (
                        <Cancel sx={{ color: '#EF4444' }} />
                      )}
                    </TableCell>
                    <TableCell sx={{ textAlign: 'right' }}>
                      <Typography sx={{ fontWeight: 700 }}>
                        {answer.score}/1
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        {/* Action Buttons */}
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
          <Button
            variant="contained"
            size="large"
            startIcon={<Home />}
            onClick={() => navigate('/')}
          >
            Go to Home
          </Button>
        </Box>
      </Container>
    </Box>
  );
};

export default ExamResult;
