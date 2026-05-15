import { useState, useEffect, useContext } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Alert,
  Divider,
  useTheme
} from '@mui/material';
import {
  Assessment,
  CheckCircle,
  Cancel,
  Schedule
} from '@mui/icons-material';
import { AuthContext } from '../../context/AuthContext';
import api from '../../services/api';
import StudentLayout from './StudentLayout';

const Dashboard = () => {
  const theme = useTheme();
  const { user } = useContext(AuthContext);
  const [results, setResults] = useState([]);
  const [scheduledExams, setScheduledExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Fetch results
        const resultsRes = await api.get('/student/results');
        setResults(resultsRes.data);

        // Fetch scheduled exams (exams that are scheduled for the future)
        try {
          const scheduledRes = await api.get('/student/scheduled-exams');
          setScheduledExams(scheduledRes.data || []);
        } catch (scheduledErr) {
          console.error('Error fetching scheduled exams:', scheduledErr);
          setScheduledExams([]);
        }

        setLoading(false);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load data. Please try again later.');
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const calculatePercentage = (score, maxScore) => {
    if (!score || !maxScore || maxScore === 0) return 0;
    return Math.round((score / maxScore) * 100);
  };

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

  const formatScheduleDate = (dateString) => {
    const options = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  if (loading) {
    return (
      <StudentLayout>
        <Container maxWidth="lg" sx={{ mt: 4, textAlign: 'center' }}>
          <CircularProgress size={60} />
          <Typography variant="h6" sx={{ mt: 2 }}>
            Loading your results...
          </Typography>
        </Container>
      </StudentLayout>
    );
  }

  if (error) {
    return (
      <StudentLayout>
        <Container maxWidth="lg" sx={{ mt: 4 }}>
          <Alert severity="error">{error}</Alert>
        </Container>
      </StudentLayout>
    );
  }

  return (
    <StudentLayout>
      <Container maxWidth="lg" sx={{ mt: 4, mb: 8 }}>
        <Typography variant="h4" component="h1" fontWeight="bold" gutterBottom>
          My Exam Results
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          Welcome, {user?.firstName || 'Student'}! Here are your exam results and scheduled exams.
        </Typography>

        {/* Scheduled Exams Section */}
        {scheduledExams.length > 0 && (
          <Box sx={{ mt: 4 }}>
            <Typography variant="h5" fontWeight="bold" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Schedule color="primary" />
              Scheduled Exams
            </Typography>
            <Paper elevation={2} sx={{ p: 3, mb: 4, bgcolor: 'primary.light' }}>
              {scheduledExams.map((exam) => (
                <Card key={exam._id} elevation={1} sx={{ mb: 2, bgcolor: 'background.paper' }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                      <Box>
                        <Typography variant="h6" fontWeight="bold">
                          {exam.examTitle || exam.title || 'Exam'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Scheduled: {formatScheduleDate(exam.scheduledStart)}
                        </Typography>
                      </Box>
                      <Chip
                        label="Scheduled"
                        color="info"
                        size="small"
                        sx={{ fontWeight: 'bold' }}
                      />
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </Paper>
          </Box>
        )}

        {/* Completed Exams Section */}
        <Divider sx={{ my: 4 }} />
        <Typography variant="h5" fontWeight="bold" gutterBottom>
          Completed Exams
        </Typography>

        {results.length === 0 ? (
          <Paper elevation={3} sx={{ p: 4, textAlign: 'center', mt: 4 }}>
            <Assessment sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              No results yet
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Complete an exam to see your results here.
            </Typography>
          </Paper>
        ) : (
          <Box sx={{ mt: 2 }}>
            {results.map((result) => {
              const percentage = calculatePercentage(result.totalScore, result.maxPossibleScore);
              const isPassed = percentage >= 70;

              return (
                <Card key={result._id} elevation={2} sx={{ mb: 3 }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
                      <Box sx={{ flex: 1, minWidth: 200 }}>
                        <Typography variant="h6" fontWeight="bold" gutterBottom>
                          {result.examTitle || result.exam?.title || 'Exam'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Completed: {formatDate(result.endTime)}
                        </Typography>
                      </Box>
                      
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Chip
                          icon={isPassed ? <CheckCircle /> : <Cancel />}
                          label={`${percentage}%`}
                          color={isPassed ? 'success' : 'error'}
                          size="medium"
                          sx={{ fontWeight: 'bold' }}
                        />
                        <Typography variant="body2" color="text.secondary">
                          {result.totalScore} / {result.maxPossibleScore} points
                        </Typography>
                      </Box>
                    </Box>

                    <Button
                      variant="outlined"
                      component={RouterLink}
                      to={`/student/results/${result._id}`}
                      sx={{ mt: 2 }}
                    >
                      View Details
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </Box>
        )}
      </Container>
    </StudentLayout>
  );
};

export default Dashboard;
