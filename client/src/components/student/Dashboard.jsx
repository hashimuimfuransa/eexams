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
  useTheme,
  IconButton,
  useMediaQuery
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
  Refresh,
  ArrowForward,
  AddCircle,
  Psychology,
  Replay
} from '@mui/icons-material';
import { AuthContext } from '../../context/AuthContext';
import api from '../../services/api';
import StudentLayout from './StudentLayout';

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

const Dashboard = () => {
  const theme = useTheme();
  const { user } = useContext(AuthContext);
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const [results, setResults] = useState([]);
  const [scheduledExams, setScheduledExams] = useState([]);
  const [availableExams, setAvailableExams] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [marketplaceExams, setMarketplaceExams] = useState([]);
  const [inProgressExams, setInProgressExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [requestingExam, setRequestingExam] = useState(null);
  const [timeRemainingMap, setTimeRemainingMap] = useState({});

  const fetchData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      // Fetch all data in parallel for faster loading
      const [resultsRes, examsRes, scheduledRes, requestsRes, marketplaceRes, inProgressRes] = await Promise.allSettled([
        api.get('/student/results'),
        api.get('/student/exams'),
        api.get('/student/scheduled-exams'),
        api.get('/marketplace/student/requests'),
        api.get('/marketplace/exams'),
        api.get('/student/exams/in-progress')
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
        // Debug: log exams with their status
        console.log('[Dashboard] Available exams:', uniqueExams.map(e => ({ id: e._id, title: e.title, status: e.status, isLocked: e.isLocked })));
      } else {
        setAvailableExams([]);
      }

      // Process scheduled exams
      if (scheduledRes.status === 'fulfilled') {
        setScheduledExams(scheduledRes.value.data || []);
      } else {
        setScheduledExams([]);
      }

      // Process pending requests (remove duplicates, but keep retake requests separate)
      if (requestsRes.status === 'fulfilled') {
        const uniqueRequests = Array.isArray(requestsRes.value.data) ? requestsRes.value.data.filter((request, index, self) =>
          index === self.findIndex((r) => r.exam?._id === request.exam?._id && r.isRetake === request.isRetake)
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

      // Process in-progress exams
      if (inProgressRes.status === 'fulfilled') {
        console.log('In-progress exams data:', inProgressRes.value.data);
        setInProgressExams(inProgressRes.value.data || []);
      } else {
        console.log('In-progress exams request failed:', inProgressRes.reason);
        setInProgressExams([]);
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

  // Real-time countdown timer for in-progress exams
  useEffect(() => {
    if (inProgressExams.length === 0) return;

    // Initialize time remaining map from server data
    const initialMap = {};
    inProgressExams.forEach(exam => {
      initialMap[exam._id] = exam.timeRemaining;
    });
    setTimeRemainingMap(initialMap);

    // Update countdown every second
    const interval = setInterval(() => {
      setTimeRemainingMap(prevMap => {
        const newMap = { ...prevMap };
        let hasValidTime = false;

        inProgressExams.forEach(exam => {
          const currentRemaining = newMap[exam._id];
          if (currentRemaining > 0) {
            newMap[exam._id] = Math.max(0, currentRemaining - 1000);
            hasValidTime = true;
          }
        });

        return newMap;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [inProgressExams]);

  const handleRefresh = () => {
    fetchData(true);
  };

  const handleDirectRequest = async (examId, examTitle) => {
    try {
      setRequestingExam(examId);
      const response = await api.post(`/marketplace/exams/${examId}/request`);
      // Refresh the data to update the pending requests list
      await fetchData(true);
      // Show success message
      alert(`Request for "${examTitle}" submitted successfully! The teacher will review your request.`);
    } catch (err) {
      console.error('Error requesting exam:', err);
      if (err.response?.data?.message) {
        alert(err.response.data.message);
      } else {
        alert('Failed to submit request. Please try again.');
      }
    } finally {
      setRequestingExam(null);
    }
  };

  const handleRetakeRequest = async (examId, examTitle) => {
    try {
      setRequestingExam(examId);
      const response = await api.post(`/student/exams/${examId}/retake-request`);

      // Check if retake was auto-approved (free retake)
      const isAutoApproved = response.data?.autoApproved;

      // Small delay to ensure database deletion is committed before refresh
      if (isAutoApproved) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Refresh the data to update the exam status
      await fetchData(true);

      // Show appropriate success message
      if (isAutoApproved) {
        alert(`Retake for "${examTitle}" approved automatically! The exam is now available in the "Approved Retake Exams" section.`);
      } else {
        alert(`Retake request for "${examTitle}" submitted successfully! The teacher will review your request.`);
      }
    } catch (err) {
      console.error('Error requesting retake:', err);
      const errorMessage = err.response?.data?.message || 'Failed to submit retake request. Please try again.';

      // Check if error is due to pending request
      if (errorMessage.includes('pending') || errorMessage.includes('already')) {
        alert(errorMessage + ' You can view your pending requests in the Pending Exam Requests section above.');
      } else {
        alert(errorMessage);
      }
    } finally {
      setRequestingExam(null);
    }
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

  const formatTimeRemaining = (milliseconds) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
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

  // Approved retake requests (marketplace or assigned exam retakes)
  // Only show retakes that haven't been used yet (accessCodeUsed = false)
  const approvedRetakeRequests = pendingRequests.filter(
    r => r.status === 'approved' && r.isRetake && !r.accessCodeUsed
  );
  const approvedRetakeExamIds = approvedRetakeRequests.map(r => r.exam?._id?.toString()).filter(Boolean);

  // Available exams that are NOT retake-approved (retakes shown in their own section)
  const regularAvailableExams = availableExams.filter(
    exam => !approvedRetakeExamIds.includes(exam._id?.toString())
  );

  const hasAvailableExams = regularAvailableExams.length > 0 || approvedRetakeRequests.length > 0;

  return (
    <StudentLayout>
      <Container maxWidth="xl" sx={{ mt: { xs: 2, sm: 3, md: 4 }, mb: { xs: 2, sm: 3, md: 4 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: { xs: 3, sm: 4 }, flexWrap: 'wrap', gap: 2 }}>
          <Typography variant={isMobile ? 'h5' : 'h4'} fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Assessment color="primary" />
            Student Dashboard
          </Typography>
          <IconButton onClick={handleRefresh} disabled={refreshing} color="primary" sx={{ bgcolor: 'background.paper', boxShadow: 1 }}>
            <Refresh sx={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          </IconButton>
        </Box>
        <Typography variant="body1" color="text.secondary" paragraph>
          Welcome, {user?.firstName || 'Student'}! Here are your available exams and results.
        </Typography>

        {/* App Download Recommendation - Only show when no available exams */}
        {!hasAvailableExams && (
          <Card
            elevation={3}
            sx={{
              mb: 4,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white'
            }}
          >
            <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: { xs: 2, sm: 3 } }}>
                <Box sx={{ flex: 1, minWidth: { xs: '100%', sm: 250 } }}>
                  <Typography variant={isMobile ? 'subtitle1' : 'h6'} fontWeight="bold" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                    <Psychology fontSize={isMobile ? 'small' : 'medium'} />
                    Boost Your Learning with Excellence Coaching Hub
                  </Typography>
                  <Typography variant={isMobile ? 'caption' : 'body2'} sx={{ opacity: 0.9, lineHeight: 1.4 }}>
                    Download our mobile app to access detailed explanations, practice questions, and personalized learning paths to help you master topics you're struggling with.
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: { xs: 1, sm: 2 }, flexWrap: 'wrap', width: { xs: '100%', sm: 'auto' } }}>
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
                      fontSize: { xs: '0.75rem', sm: '0.875rem' },
                      padding: { xs: '6px 12px', sm: '8px 16px' },
                      minWidth: { xs: '100%', sm: 'auto' },
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
                      fontSize: { xs: '0.75rem', sm: '0.875rem' },
                      padding: { xs: '6px 12px', sm: '8px 16px' },
                      minWidth: { xs: '100%', sm: 'auto' },
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
            </CardContent>
          </Card>
        )}

        {/* Pending Exam Requests Section */}
        {pendingRequests.filter(r => r.status === 'pending').length > 0 && (
          <Box sx={{ mt: 4 }}>
            <Typography variant={isMobile ? 'h6' : 'h5'} fontWeight="bold" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Schedule color="warning" />
              Pending Exam Requests
            </Typography>
            <Paper elevation={3} sx={{ p: { xs: 2, sm: 3 }, mb: 4, bgcolor: 'warning.light', border: '2px solid', borderColor: 'warning.main' }}>
              {pendingRequests.filter(r => r.status === 'pending').map((request) => (
                <Card key={request._id} elevation={2} sx={{ mb: 2, bgcolor: 'background.paper' }}>
                  <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                      <Box sx={{ flex: 1, minWidth: { xs: '100%', sm: 200 } }}>
                        <Typography variant={isMobile ? 'subtitle1' : 'h6'} fontWeight="bold">
                          {request.exam?.title || request.examTitle || 'Exam'}
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
                        size="medium"
                        sx={{ fontWeight: 'bold' }}
                      />
                    </Box>
                    <Box sx={{ mt: 2, p: { xs: 1.5, sm: 2 }, borderRadius: 2, bgcolor: 'rgba(13,64,108,0.05)' }}>
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

        {/* In-Progress Exams Section */}
        {inProgressExams.filter(exam => {
          const timeRemaining = timeRemainingMap[exam._id] || exam.timeRemaining || 0;
          return timeRemaining > 0;
        }).length > 0 && (
          <Box sx={{ mt: 4 }}>
            <Typography variant="h5" fontWeight="bold" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AccessTime color="error" />
              In-Progress Exams
            </Typography>
            <Paper elevation={3} sx={{ p: { xs: 2, sm: 3 }, mb: 4, bgcolor: 'error.light', border: '2px solid', borderColor: 'error.main' }}>
              {inProgressExams.filter(exam => {
                const timeRemaining = timeRemainingMap[exam._id] || exam.timeRemaining || 0;
                return timeRemaining > 0;
              }).map((exam) => {
                const timeRemaining = timeRemainingMap[exam._id] || exam.timeRemaining || 0;
                const isUrgent = timeRemaining < 5 * 60 * 1000; // Less than 5 minutes

                return (
                  <Card key={exam._id} elevation={2} sx={{ mb: 2, bgcolor: 'background.paper', border: isUrgent ? '2px solid' : 'none', borderColor: isUrgent ? 'error.main' : 'transparent' }}>
                    <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                        <Box sx={{ flex: 1, minWidth: { xs: '100%', sm: 200 } }}>
                          <Typography variant={isMobile ? 'subtitle1' : 'h6'} fontWeight="bold">
                            {exam.exam?.title || 'Exam'}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Started: {formatDate(exam.startTime)}
                          </Typography>
                        </Box>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                            Time Remaining
                          </Typography>
                          <Typography
                            variant={isUrgent ? 'h4' : 'h5'}
                            fontWeight="bold"
                            color={isUrgent ? 'error' : 'warning'}
                            sx={{ fontFamily: 'monospace' }}
                          >
                            {formatTimeRemaining(timeRemaining)}
                          </Typography>
                          {isUrgent && (
                            <Typography variant="caption" color="error" fontWeight="bold" sx={{ display: 'block', mt: 0.5 }}>
                              ⚠️ Auto-submit soon!
                            </Typography>
                          )}
                        </Box>
                      </Box>
                      <Alert severity={isUrgent ? 'error' : 'warning'} sx={{ mt: 2 }}>
                        <Typography variant="body2" fontWeight="bold">
                          Your exam is in progress. Return to complete it before time expires or it will be auto-submitted.
                        </Typography>
                      </Alert>
                      <Button
                        variant="contained"
                        component={RouterLink}
                        to={`/student/exam/${exam.exam?._id}`}
                        fullWidth
                        sx={{
                          mt: 2,
                          background: isUrgent ? 'error.main' : 'warning.main',
                          '&:hover': {
                            background: isUrgent ? 'error.dark' : 'warning.dark'
                          }
                        }}
                        startIcon={<PlayArrow />}
                      >
                        Return to Exam
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </Paper>
          </Box>
        )}

        {/* Approved Retake Exams Section */}
        {approvedRetakeRequests.length > 0 && (
          <Box sx={{ mt: 4 }}>
            <Typography variant={isMobile ? 'h6' : 'h5'} fontWeight="bold" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Replay color="warning" />
              Approved Retake Exams
            </Typography>
            <Paper elevation={3} sx={{ p: { xs: 2, sm: 3 }, mb: 4, bgcolor: 'warning.light', border: '2px solid', borderColor: 'warning.main' }}>
              {approvedRetakeRequests.map((request) => {
                const examId = request.exam?._id;
                const examTitle = request.exam?.title || request.examTitle || 'Exam';
                const matchedAvailableExam = availableExams.find(e => e._id?.toString() === examId?.toString());
                const linkTarget = examId ? `/student/exam/${examId}` : null;

                return (
                  <Card key={request._id} elevation={2} sx={{ mb: 2, bgcolor: 'background.paper', border: '2px solid', borderColor: 'warning.main' }}>
                    <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                        <Box sx={{ flex: 1, minWidth: { xs: '100%', sm: 200 } }}>
                          <Typography variant={isMobile ? 'subtitle1' : 'h6'} fontWeight="bold">
                            {examTitle}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Retake approved on: {formatDate(request.processedAt || request.requestedAt)}
                          </Typography>
                          {matchedAvailableExam?.timeLimit && (
                            <Chip
                              icon={<AccessTime fontSize="small" />}
                              label={`${matchedAvailableExam.timeLimit} minutes`}
                              size="small"
                              variant="outlined"
                              sx={{ mt: 1 }}
                            />
                          )}
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', justifyContent: { xs: 'stretch', sm: 'flex-start' }, width: { xs: '100%', sm: 'auto' } }}>
                          <Chip
                            label="Retake Approved"
                            color="warning"
                            size="medium"
                            sx={{ fontWeight: 'bold', fontSize: '0.875rem' }}
                          />
                          {linkTarget ? (
                            <Button
                              variant="contained"
                              component={RouterLink}
                              to={linkTarget}
                              size={isMobile ? 'medium' : 'large'}
                              startIcon={<Replay />}
                              fullWidth={isMobile}
                              color="warning"
                              sx={{ fontWeight: 'bold', px: { xs: 2, sm: 3 }, py: { xs: 1.2, sm: 1.5 }, textTransform: 'none' }}
                            >
                              Start Retake
                            </Button>
                          ) : (
                            <Button variant="outlined" disabled size={isMobile ? 'medium' : 'large'} fullWidth={isMobile}>
                              Not Available
                            </Button>
                          )}
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                );
              })}
            </Paper>
          </Box>
        )}

        {/* Available Exams Section */}
        <Box sx={{ mt: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h5" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <School color="primary" />
              Available Exams
            </Typography>
            <Button
              variant="contained"
              component={RouterLink}
              to="/student/exams"
              size="small"
              endIcon={<ArrowForward />}
              sx={{
                fontWeight: 'bold',
                textTransform: 'none',
                background: 'linear-gradient(135deg, #0D406C 0%, #0CBD73 100%)',
                boxShadow: '0 2px 8px rgba(12,189,115,0.3)',
                '&:hover': {
                  boxShadow: '0 4px 12px rgba(12,189,115,0.4)'
                }
              }}
            >
              View All Exams
            </Button>
          </Box>

          {regularAvailableExams.length === 0 ? (
            <Paper elevation={3} sx={{ p: 4, textAlign: 'center', mb: 4, bgcolor: 'grey.50' }}>
              <School sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" fontWeight="bold">
                No Available Exams
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                All assigned exams have been completed. Check the exam bank for more exams.
              </Typography>
              <Button
                variant="contained"
                component={RouterLink}
                to="/marketplace"
                size="medium"
                endIcon={<ArrowForward />}
                sx={{
                  fontWeight: 'bold',
                  textTransform: 'none',
                  background: 'linear-gradient(135deg, #0D406C 0%, #0CBD73 100%)',
                  boxShadow: '0 2px 8px rgba(12,189,115,0.3)',
                  '&:hover': {
                    boxShadow: '0 4px 12px rgba(12,189,115,0.4)'
                  }
                }}
              >
                Go to Exam Bank
              </Button>
            </Paper>
          ) : (
            <Box sx={{ display: 'grid', gap: 2, mb: 4 }}>
              {regularAvailableExams.map((exam) => {
                // Check if there's a pending retake request for this exam (approved ones are in their own section)
                const approvedRetakeRequest = null;
                const pendingRetakeRequest = pendingRequests.find(
                  r => r.exam?._id?.toString() === exam._id?.toString() && r.status === 'pending' && r.isRetake
                );

                const canStart = !exam.isLocked && exam.status !== 'in-progress' && (exam.status !== 'completed' || !!approvedRetakeRequest);
                const getStatusLabel = () => {
                  if (approvedRetakeRequest) return 'Retake Approved';
                  if (pendingRetakeRequest) return 'Retake Pending';
                  if (exam.status === 'completed') return 'Completed';
                  if (exam.status === 'in-progress') return 'In Progress';
                  if (exam.isLocked) return 'Locked';
                  if (exam.availability === 'upcoming') return 'Upcoming';
                  if (exam.availability === 'expired') return 'Expired';
                  return 'Available';
                };
                const getStatusColor = () => {
                  if (approvedRetakeRequest) return 'warning';
                  if (pendingRetakeRequest) return 'warning';
                  if (exam.status === 'completed') return 'default';
                  if (exam.status === 'in-progress') return 'warning';
                  if (exam.isLocked || exam.availability === 'expired') return 'error';
                  if (exam.availability === 'upcoming') return 'info';
                  return 'success';
                };
                const isStartable = canStart || approvedRetakeRequest;
                return (
                  <Card
                    key={exam._id}
                    elevation={isStartable ? 3 : 1}
                    sx={{
                      mb: 0,
                      bgcolor: 'background.paper',
                      border: isStartable ? '2px solid' : '1px solid',
                      borderColor: approvedRetakeRequest ? 'warning.main' : isStartable ? 'primary.main' : 'divider',
                      transition: 'all 0.2s ease-in-out',
                      '&:hover': isStartable ? {
                        transform: 'translateY(-4px)',
                        boxShadow: 6
                      } : {}
                    }}
                  >
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                        <Box sx={{ flex: 1, minWidth: { xs: '100%', sm: 250 } }}>
                          <Typography variant={isMobile ? 'subtitle1' : 'h6'} fontWeight="bold" sx={{ mb: 1 }}>
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
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', justifyContent: { xs: 'stretch', sm: 'flex-start' }, width: { xs: '100%', sm: 'auto' } }}>
                          <Chip
                            label={getStatusLabel()}
                            color={getStatusColor()}
                            size="medium"
                            sx={{ fontWeight: 'bold', fontSize: '0.875rem' }}
                          />
                          {isStartable ? (
                            <Button
                              variant="contained"
                              component={RouterLink}
                              to={`/student/exam/${exam._id}`}
                              size={isMobile ? 'medium' : 'large'}
                              startIcon={<PlayArrow />}
                              fullWidth={isMobile}
                              color={approvedRetakeRequest ? 'warning' : 'primary'}
                              sx={{
                                fontWeight: 'bold',
                                px: { xs: 2, sm: 3 },
                                py: { xs: 1.2, sm: 1.5 },
                                textTransform: 'none'
                              }}
                            >
                              {approvedRetakeRequest ? 'Start Retake' : 'Start Exam'}
                            </Button>
                          ) : (
                            <Button
                              variant="outlined"
                              disabled
                              size={isMobile ? 'medium' : 'large'}
                              startIcon={<Lock />}
                              fullWidth={isMobile}
                              sx={{
                                fontWeight: 'bold',
                                px: { xs: 2, sm: 3 },
                                py: { xs: 1.2, sm: 1.5 },
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

          {/* Exam Bank Button - Always show */}
          <Box sx={{ mt: 2, mb: 4 }}>
            <Button
              variant="contained"
              component={RouterLink}
              to="/marketplace"
              size="large"
              endIcon={<ArrowForward />}
              fullWidth
              sx={{
                fontWeight: 'bold',
                textTransform: 'none',
                background: 'linear-gradient(135deg, #0D406C 0%, #0CBD73 100%)',
                boxShadow: '0 2px 8px rgba(12,189,115,0.3)',
                py: 1.5,
                fontSize: 16,
                '&:hover': {
                  boxShadow: '0 4px 12px rgba(12,189,115,0.4)'
                }
              }}
            >
              Go to Exam Bank for More Exams
            </Button>
          </Box>
        </Box>

        {/* Marketplace Exams Section - Only show when no available exams */}
        {!hasAvailableExams && (
          <Box sx={{ mt: 4 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
              <Typography variant={isMobile ? 'h6' : 'h5'} fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <School color="primary" />
                Exam Bank
              </Typography>
              <Button
                variant="contained"
                component={RouterLink}
                to="/marketplace"
                size="small"
                endIcon={<ArrowForward />}
                sx={{
                  fontWeight: 'bold',
                  textTransform: 'none',
                  background: 'linear-gradient(135deg, #0D406C 0%, #0CBD73 100%)',
                  boxShadow: '0 2px 8px rgba(12,189,115,0.3)',
                  '&:hover': {
                    boxShadow: '0 4px 12px rgba(12,189,115,0.4)'
                  }
                }}
              >
                View All Exams
              </Button>
            </Box>

            {marketplaceExams.length === 0 ? (
              <Paper elevation={3} sx={{ p: { xs: 3, sm: 4 }, textAlign: 'center', mb: 4, bgcolor: 'grey.50' }}>
                <School sx={{ fontSize: { xs: 48, sm: 64 }, color: 'text.secondary', mb: 2 }} />
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
                  const isCompleted = results.some(r => r.exam?._id === exam._id || r.exam === exam._id);

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
                      <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
                          <Box sx={{ flex: 1, minWidth: { xs: '100%', sm: 200 } }}>
                            <Typography variant={isMobile ? 'subtitle1' : 'h6'} fontWeight="bold" sx={{ mb: 1 }}>
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
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: { xs: '100%', sm: 140 }, width: { xs: '100%', sm: 'auto' } }}>
                            {isCompleted ? (
                              <Button
                                variant="contained"
                                size="small"
                                onClick={() => handleDirectRequest(exam._id, exam.title)}
                                startIcon={requestingExam === exam._id ? <CircularProgress size={16} color="inherit" /> : <AddCircle />}
                                disabled={requestingExam === exam._id}
                                fullWidth={isMobile}
                                sx={{
                                  fontWeight: 'bold',
                                  textTransform: 'none',
                                  background: 'linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%)',
                                  boxShadow: '0 2px 8px rgba(139,92,246,0.3)'
                                }}
                              >
                                {requestingExam === exam._id ? 'Requesting...' : 'Retake'}
                              </Button>
                            ) : isApproved ? (
                              <Button
                                variant="outlined"
                                disabled
                                size="small"
                                fullWidth={isMobile}
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
                                fullWidth={isMobile}
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
                                size="small"
                                onClick={() => handleDirectRequest(exam._id, exam.title)}
                                startIcon={requestingExam === exam._id ? <CircularProgress size={16} color="inherit" /> : <AddCircle />}
                                disabled={requestingExam === exam._id}
                                fullWidth={isMobile}
                                sx={{
                                  fontWeight: 'bold',
                                  textTransform: 'none',
                                  background: 'linear-gradient(135deg, #0D406C 0%, #0CBD73 100%)',
                                  boxShadow: '0 2px 8px rgba(12,189,115,0.3)'
                                }}
                              >
                                {requestingExam === exam._id ? 'Requesting...' : 'Request'}
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
        )}

        {/* Scheduled Exams Section - Only show when no available exams */}
        {!hasAvailableExams && scheduledExams.length > 0 && (
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

        {/* Completed Exams Section - Only show when no available exams */}
        {!hasAvailableExams && (
          <>
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
          </>
        )}
      </Container>
    </StudentLayout>
  );
};

export default Dashboard;
