import { useState, useEffect, useContext, memo } from 'react';
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
  useTheme,
  IconButton
} from '@mui/material';
import {
  Assessment,
  CheckCircle,
  Cancel,
  Schedule,
  PlayArrow,
  Lock,
  School,
  AccessTime,
  Refresh
} from '@mui/icons-material';
import { AuthContext } from '../../context/AuthContext';
import api from '../../services/api';
import StudentLayout from './StudentLayout';

const Dashboard = memo(() => {
  const theme = useTheme();
  const { user } = useContext(AuthContext);
  const [results, setResults] = useState([]);
  const [scheduledExams, setScheduledExams] = useState([]);
  const [availableExams, setAvailableExams] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [marketplaceExams, setMarketplaceExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      // Fetch all data in parallel for faster loading
      const [resultsRes, examsRes, scheduledRes, requestsRes, marketplaceRes] = await Promise.allSettled([
        api.get('/student/results'),
        api.get('/student/exams'),
        api.get('/student/scheduled-exams'),
        api.get('/marketplace/student/requests'),
        api.get('/marketplace/exams')
      ]);

      // Process results
      if (resultsRes.status === 'fulfilled') {
        setResults(resultsRes.value.data);
      }

      // Process available exams (remove duplicates)
      if (examsRes.status === 'fulfilled') {
        const uniqueExams = Array.isArray(examsRes.value.data) ? examsRes.value.data.filter((exam, index, self) =>
          index === self.findIndex((e) => e._id === exam._id)
        ) : [];
        setAvailableExams(uniqueExams);
      } else {
        setAvailableExams([]);
      }

      // Process scheduled exams
      if (scheduledRes.status === 'fulfilled') {
        setScheduledExams(scheduledRes.value.data || []);
      } else {
        setScheduledExams([]);
      }

      // Process pending requests (remove duplicates)
      if (requestsRes.status === 'fulfilled') {
        const uniqueRequests = Array.isArray(requestsRes.value.data) ? requestsRes.value.data.filter((request, index, self) =>
          index === self.findIndex((r) => r.exam?._id === request.exam?._id)
        ) : [];
        setPendingRequests(uniqueRequests);
      } else {
        setPendingRequests([]);
      }

      // Process marketplace exams (remove duplicates)
      if (marketplaceRes.status === 'fulfilled') {
        const uniqueMarketplaceExams = Array.isArray(marketplaceRes.value.data) ? marketplaceRes.value.data.filter((exam, index, self) =>
          index === self.findIndex((e) => e._id === exam._id)
        ) : [];
        setMarketplaceExams(uniqueMarketplaceExams);
      } else {
        setMarketplaceExams([]);
      }

    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load data. Please try again later.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  // Auto-refresh data every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchData(true);
    }, 30000);

    return () => clearInterval(interval);
  }, [user]);

  const handleRefresh = () => {
    fetchData(true);
  };

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
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h4" component="h1" fontWeight="bold" gutterBottom sx={{ mb: 0 }}>
            My Dashboard
          </Typography>
          <IconButton
            onClick={handleRefresh}
            disabled={refreshing}
            sx={{
              bgcolor: 'primary.main',
              color: 'white',
              '&:hover': {
                bgcolor: 'primary.dark',
              },
              '&:disabled': {
                bgcolor: 'action.disabled',
              }
            }}
          >
            <Refresh sx={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          </IconButton>
        </Box>
        <Typography variant="body1" color="text.secondary" paragraph>
          Welcome, {user?.firstName || 'Student'}! Here are your available exams and results.
        </Typography>

        {/* Available Exams Section */}
        <Box sx={{ mt: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h5" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <School color="primary" />
              Available Exams
            </Typography>
            <Button
              variant="text"
              component={RouterLink}
              to="/student/exams"
              size="small"
              sx={{ color: 'primary.main', fontWeight: 'bold' }}
            >
              View All →
            </Button>
          </Box>

          {availableExams.length === 0 ? (
            <Paper elevation={3} sx={{ p: 4, textAlign: 'center', mb: 4, bgcolor: 'grey.50' }}>
              <School sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" fontWeight="bold">
                No Available Exams
              </Typography>
              <Typography variant="body2" color="text.secondary">
                All assigned exams have been completed. Check back later for new exams.
              </Typography>
            </Paper>
          ) : (
            <Box sx={{ display: 'grid', gap: 2, mb: 4 }}>
              {availableExams.map((exam) => {
                const canStart = !exam.isLocked && exam.status !== 'in-progress';
                const getStatusLabel = () => {
                  if (exam.status === 'completed') return 'Retake Available';
                  if (exam.status === 'in-progress') return 'In Progress';
                  if (exam.isLocked) return 'Locked';
                  if (exam.availability === 'upcoming') return 'Upcoming';
                  if (exam.availability === 'expired') return 'Expired';
                  return 'Available';
                };
                const getStatusColor = () => {
                  if (exam.status === 'completed') return 'success';
                  if (exam.status === 'in-progress') return 'warning';
                  if (exam.isLocked || exam.availability === 'expired') return 'error';
                  if (exam.availability === 'upcoming') return 'info';
                  return 'success';
                };
                return (
                  <Card 
                    key={exam._id} 
                    elevation={canStart ? 3 : 1} 
                    sx={{ 
                      mb: 0, 
                      bgcolor: 'background.paper',
                      border: canStart ? '2px solid' : '1px solid',
                      borderColor: canStart ? 'primary.main' : 'divider',
                      transition: 'all 0.2s ease-in-out',
                      '&:hover': canStart ? {
                        transform: 'translateY(-4px)',
                        boxShadow: 6
                      } : {}
                    }}
                  >
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                        <Box sx={{ flex: 1, minWidth: 250 }}>
                          <Typography variant="h6" fontWeight="bold" sx={{ mb: 1 }}>
                            {exam.title || 'Exam'}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                            <Chip
                              icon={<School fontSize="small" />}
                              label={`${exam.questions || 0} Questions`}
                              size="small"
                              variant="outlined"
                            />
                            {exam.timeLimit && (
                              <Chip
                                icon={<AccessTime fontSize="small" />}
                                label={`${exam.timeLimit} minutes`}
                                size="small"
                                variant="outlined"
                              />
                            )}
                          </Box>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Chip
                            label={getStatusLabel()}
                            color={getStatusColor()}
                            size="medium"
                            sx={{ fontWeight: 'bold', fontSize: '0.875rem' }}
                          />
                          {canStart ? (
                            <Button
                              variant="contained"
                              component={RouterLink}
                              to={`/student/exam/${exam._id}`}
                              size="large"
                              startIcon={<PlayArrow />}
                              sx={{
                                fontWeight: 'bold',
                                px: 3,
                                py: 1.5,
                                textTransform: 'none'
                              }}
                            >
                              Start Exam
                            </Button>
                          ) : (
                            <Button
                              variant="outlined"
                              disabled
                              size="large"
                              startIcon={<Lock />}
                              sx={{
                                fontWeight: 'bold',
                                px: 3,
                                py: 1.5,
                                textTransform: 'none'
                              }}
                            >
                              Not Available
                            </Button>
                          )}
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                );
              })}
            </Box>
          )}
        </Box>

        {/* Pending Exam Requests Section */}
        {pendingRequests.filter(r => r.status === 'pending').length > 0 && (
          <Box sx={{ mt: 4 }}>
            <Typography variant="h5" fontWeight="bold" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Schedule color="warning" />
              Pending Exam Requests
            </Typography>
            <Paper elevation={2} sx={{ p: 3, mb: 4, bgcolor: 'warning.light' }}>
              {pendingRequests.filter(r => r.status === 'pending').map((request) => (
                <Card key={request._id} elevation={1} sx={{ mb: 2, bgcolor: 'background.paper' }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                      <Box sx={{ flex: 1, minWidth: 200 }}>
                        <Typography variant="h6" fontWeight="bold">
                          {request.exam?.title || 'Exam'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Requested: {formatDate(request.requestedAt)}
                        </Typography>
                        {request.amount > 0 && (
                          <Typography variant="body2" color="warning.main" fontWeight="bold">
                            Price: RWF {request.amount.toLocaleString()}
                          </Typography>
                        )}
                      </Box>
                      <Chip
                        label="Pending Approval"
                        color="warning"
                        size="small"
                        sx={{ fontWeight: 'bold' }}
                      />
                    </Box>
                    <Box sx={{ mt: 2, p: 2, borderRadius: 2, bgcolor: 'rgba(13,64,108,0.05)' }}>
                      <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#0D406C', mb: 1 }}>
                        Have questions? Contact us:
                      </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        <Typography sx={{ fontSize: 13, color: '#64748B' }}>
                          📞 +250 788 535 156
                        </Typography>
                        <Typography sx={{ fontSize: 13, color: '#64748B' }}>
                          📞 +250 793 828 834
                        </Typography>
                        <Typography sx={{ fontSize: 13, color: '#64748B' }}>
                          📞 +250 781 671 517
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </Paper>
          </Box>
        )}

        {/* Marketplace Exams Section */}
        <Box sx={{ mt: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h5" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <School color="primary" />
              Exam Bank
            </Typography>
            <Button
              variant="text"
              component={RouterLink}
              to="/marketplace"
              size="small"
              sx={{ color: 'primary.main', fontWeight: 'bold' }}
            >
              View All →
            </Button>
          </Box>

          {marketplaceExams.length === 0 ? (
            <Paper elevation={3} sx={{ p: 4, textAlign: 'center', mb: 4, bgcolor: 'grey.50' }}>
              <School sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" fontWeight="bold">
                No Exams Available
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Check back later for new exams in the exam bank.
              </Typography>
            </Paper>
          ) : (
            <Box sx={{ display: 'grid', gap: 2, mb: 4 }}>
              {marketplaceExams
                .filter(exam => !availableExams.some(e => e._id === exam._id))
                .slice(0, 3)
                .map((exam) => {
                const totalQuestions = exam.sections?.reduce((sum, section) => sum + (section.questions?.length || 0), 0) || 0;
                const isRequested = pendingRequests.some(r => r.exam?._id === exam._id);
                const isApproved = pendingRequests.some(r => r.exam?._id === exam._id && r.status === 'approved');

                return (
                  <Card
                    key={exam._id}
                    elevation={2}
                    sx={{
                      mb: 0,
                      bgcolor: 'background.paper',
                      border: '1px solid',
                      borderColor: 'divider',
                      transition: 'all 0.2s ease-in-out',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: 4
                      }
                    }}
                  >
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
                        <Box sx={{ flex: 1, minWidth: 200 }}>
                          <Typography variant="h6" fontWeight="bold" sx={{ mb: 1 }}>
                            {exam.title || 'Exam'}
                          </Typography>
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{
                              mb: 1.5,
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden'
                            }}
                          >
                            {exam.publicDescription || exam.description}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                            <Chip
                              icon={<School fontSize="small" />}
                              label={`${totalQuestions} Questions`}
                              size="small"
                              variant="outlined"
                            />
                            {exam.timeLimit && (
                              <Chip
                                icon={<AccessTime fontSize="small" />}
                                label={`${exam.timeLimit} minutes`}
                                size="small"
                                variant="outlined"
                              />
                            )}
                            {exam.publicPrice > 0 && (
                              <Chip
                                label={`RWF ${exam.publicPrice.toLocaleString()}`}
                                size="small"
                                color="warning"
                                variant="outlined"
                              />
                            )}
                          </Box>
                        </Box>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 140 }}>
                          {isApproved ? (
                            <Button
                              variant="outlined"
                              disabled
                              size="small"
                              sx={{
                                fontWeight: 'bold',
                                textTransform: 'none'
                              }}
                            >
                              Approved
                            </Button>
                          ) : isRequested ? (
                            <Button
                              variant="outlined"
                              disabled
                              size="small"
                              sx={{
                                fontWeight: 'bold',
                                textTransform: 'none'
                              }}
                            >
                              Requested
                            </Button>
                          ) : (
                            <Button
                              variant="contained"
                              component={RouterLink}
                              to={`/marketplace/exams/${exam._id}/request`}
                              size="small"
                              sx={{
                                fontWeight: 'bold',
                                textTransform: 'none',
                                background: 'linear-gradient(135deg, #0D406C 0%, #0CBD73 100%)'
                              }}
                            >
                              Request Access
                            </Button>
                          )}
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                );
              })}
            </Box>
          )}
        </Box>

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
});

export default Dashboard;
