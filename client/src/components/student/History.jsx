import React, { useState, useEffect } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  Button,
  Chip,
  Divider,
  CircularProgress,
  Alert,
  Paper,
  Avatar,
  Stack,
  useTheme
} from '@mui/material';
import {
  School,
  CheckCircle,
  AccessTime,
  CalendarToday,
  ArrowForward,
  Assessment,
  History as HistoryIcon
} from '@mui/icons-material';
import StudentLayout from './StudentLayout';
import api from '../../services/api';

const History = () => {
  const theme = useTheme();
  const [examHistory, setExamHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchExamHistory = async () => {
      try {
        setLoading(true);
        // Fetch both exams and results to create a complete history
        const examsRes = await api.get('/student/exams');
        const resultsRes = await api.get('/student/results');

        // Combine and sort by date
        const exams = examsRes.data.map(exam => ({
          ...exam,
          type: 'exam',
          date: exam.startTime || exam.scheduledFor || exam.createdAt
        }));

        const results = resultsRes.data.map(result => ({
          ...result,
          type: 'result',
          date: result.completedAt || result.endTime
        }));

        const combined = [...exams, ...results].sort((a, b) => new Date(b.date) - new Date(a.date));
        setExamHistory(combined);
        setError(null);
      } catch (err) {
        console.error('Error fetching exam history:', err);
        setError('Failed to load your exam history. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchExamHistory();
  }, []);

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

  return (
    <StudentLayout>
      <Container maxWidth="lg" sx={{ mb: 8 }}>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" fontWeight="bold" gutterBottom>
            Exam History
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Track your exam activity and progress over time
          </Typography>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 8 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ my: 4 }}>
            {error}
          </Alert>
        ) : examHistory.length === 0 ? (
          <Box sx={{ textAlign: 'center', my: 8 }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No exam history found
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              You haven't taken any exams yet.
            </Typography>
            <Button
              variant="contained"
              color="primary"
              component={RouterLink}
              to="/student/exams"
              startIcon={<School />}
              sx={{ borderRadius: 0 }}
            >
              Browse Available Exams
            </Button>
          </Box>
        ) : (
          <Grid container spacing={4}>
            <Grid item xs={12} md={8}>
              <Paper elevation={3} sx={{ p: 3, borderRadius: 0 }}>
                <Typography variant="h6" fontWeight="bold" gutterBottom>
                  Activity Timeline
                </Typography>
                <Divider sx={{ mb: 3 }} />

                <Stack spacing={3} sx={{ my: 3 }}>
                  {examHistory.map((item, index) => (
                    <Box
                      key={item._id || index}
                      sx={{
                        display: 'flex',
                        flexDirection: index % 2 === 0 ? 'row' : 'row-reverse',
                        alignItems: 'flex-start',
                        position: 'relative',
                        mb: 4
                      }}
                    >
                      {/* Date */}
                      <Box
                        sx={{
                          width: '30%',
                          textAlign: index % 2 === 0 ? 'right' : 'left',
                          pr: index % 2 === 0 ? 3 : 0,
                          pl: index % 2 === 0 ? 0 : 3,
                          pt: 1
                        }}
                      >
                        <Typography color="text.secondary" variant="body2">
                          {formatDate(item.date)}
                        </Typography>
                      </Box>

                      {/* Icon */}
                      <Box sx={{ position: 'relative', zIndex: 2 }}>
                        <Avatar
                          sx={{
                            bgcolor:
                              item.type === 'result' ? 'success.main' :
                              item.status === 'in-progress' ? 'warning.main' :
                              item.status === 'completed' ? 'success.main' : 'primary.main',
                            width: 40,
                            height: 40,
                            boxShadow: '0 0 0 4px white, 0 0 0 5px rgba(0,0,0,0.1)'
                          }}
                        >
                          {item.type === 'result' ? <Assessment /> :
                           item.status === 'in-progress' ? <AccessTime /> :
                           item.status === 'completed' ? <CheckCircle /> : <School />}
                        </Avatar>

                        {/* Connector line */}
                        {index < examHistory.length - 1 && (
                          <Box
                            sx={{
                              position: 'absolute',
                              top: 40,
                              left: '50%',
                              transform: 'translateX(-50%)',
                              width: 2,
                              height: 50,
                              bgcolor: 'divider',
                              zIndex: 1
                            }}
                          />
                        )}
                      </Box>

                      {/* Content */}
                      <Box
                        sx={{
                          width: '30%',
                          pl: index % 2 === 0 ? 3 : 0,
                          pr: index % 2 === 0 ? 0 : 3
                        }}
                      >
                        <Paper elevation={2} sx={{ p: 2, borderRadius: 0 }}>
                          <Typography variant="subtitle1" fontWeight="bold">
                            {item.type === 'result' ? item.examTitle : item.title}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {item.type === 'result'
                              ? `Completed with score: ${item.score}%`
                              : `Status: ${item.status?.replace('-', ' ') || 'Unknown'}`}
                          </Typography>
                          <Box sx={{ mt: 1 }}>
                            <Button
                              size="small"
                              variant="outlined"
                              color={
                                item.type === 'result' ? 'success' :
                                item.status === 'in-progress' ? 'warning' :
                                item.status === 'completed' ? 'success' : 'primary'
                              }
                              component={RouterLink}
                              to={item.type === 'result'
                                ? `/student/results/${item._id}`
                                : `/student/exam/${item._id}`}
                              endIcon={<ArrowForward />}
                              sx={{
                                mt: 1,
                                borderRadius: 0 // Remove rounded corners
                              }}
                            >
                              {item.type === 'result'
                                ? 'View Results'
                                : item.status === 'in-progress'
                                  ? 'Continue Exam'
                                  : item.status === 'completed'
                                    ? 'View Results'
                                    : 'Start Exam'}
                            </Button>
                          </Box>
                        </Paper>
                      </Box>
                    </Box>
                  ))}
                </Stack>
              </Paper>
            </Grid>

            <Grid item xs={12} md={4}>
              <Card elevation={3} sx={{ borderRadius: 0, mb: 3 }}>
                <CardContent>
                  <Typography variant="h6" fontWeight="bold" gutterBottom>
                    Activity Summary
                  </Typography>
                  <Divider sx={{ mb: 2 }} />

                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      Total Exams
                    </Typography>
                    <Typography variant="h5" fontWeight="bold" color="primary.main">
                      {examHistory.filter(item => item.type === 'exam').length}
                    </Typography>
                  </Box>

                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      Completed Exams
                    </Typography>
                    <Typography variant="h5" fontWeight="bold" color="success.main">
                      {examHistory.filter(item => item.type === 'result').length}
                    </Typography>
                  </Box>

                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      In Progress
                    </Typography>
                    <Typography variant="h5" fontWeight="bold" color="warning.main">
                      {examHistory.filter(item => item.type === 'exam' && item.status === 'in-progress').length}
                    </Typography>
                  </Box>

                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Not Started
                    </Typography>
                    <Typography variant="h5" fontWeight="bold" color="info.main">
                      {examHistory.filter(item => item.type === 'exam' && item.status === 'not-started').length}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>

              <Card elevation={3} sx={{ borderRadius: 0 }}>
                <CardContent>
                  <Typography variant="h6" fontWeight="bold" gutterBottom>
                    Quick Links
                  </Typography>
                  <Divider sx={{ mb: 2 }} />

                  <Button
                    fullWidth
                    variant="contained"
                    color="primary"
                    component={RouterLink}
                    to="/student/exams"
                    startIcon={<School />}
                    sx={{ mb: 2, borderRadius: 0 }}
                  >
                    Available Exams
                  </Button>

                  <Button
                    fullWidth
                    variant="contained"
                    color="secondary"
                    component={RouterLink}
                    to="/student/results"
                    startIcon={<Assessment />}
                    sx={{ color: 'black', borderRadius: 0 }}
                  >
                    View Results
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}
      </Container>
    </StudentLayout>
  );
};

export default History;
