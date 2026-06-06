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
  useMediaQuery,
  alpha
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
  Replay,
  EmojiEvents,
  Leaderboard as LeaderboardIcon,
  WorkspacePremium,
  ExpandMore,
  ExpandLess
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
  const [leaderboards, setLeaderboards] = useState({});
  const [leaderboardLoading, setLeaderboardLoading] = useState({});
  const [expandedLeaderboard, setExpandedLeaderboard] = useState(null);

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

  const fetchLeaderboard = async (examId) => {
    if (leaderboards[examId] || leaderboardLoading[examId]) return;
    setLeaderboardLoading(prev => ({ ...prev, [examId]: true }));
    try {
      const res = await api.get(`/student/leaderboard/exam/${examId}`);
      setLeaderboards(prev => ({ ...prev, [examId]: res.data }));
    } catch (err) {
      console.error('Leaderboard fetch error:', err);
      setLeaderboards(prev => ({ ...prev, [examId]: { leaderboard: [], examTitle: '' } }));
    } finally {
      setLeaderboardLoading(prev => ({ ...prev, [examId]: false }));
    }
  };

  const handleToggleLeaderboard = (examId) => {
    if (expandedLeaderboard === examId) {
      setExpandedLeaderboard(null);
    } else {
      setExpandedLeaderboard(examId);
      fetchLeaderboard(examId);
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

  // Available exams that are NOT retake-approved (retakes shown in their own section) and NOT completed
  const regularAvailableExams = availableExams.filter(
    exam => !approvedRetakeExamIds.includes(exam._id?.toString()) && exam.status !== 'completed'
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
        {regularAvailableExams.length > 0 && (
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

          </Box>
        )}

        {/* Exam Bank Button - Always show */}
        <Box sx={{ mt: 4, mb: 4 }}>
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
              boxShadow: '0 4px 16px rgba(12,189,115,0.5), 0 0 20px rgba(12,189,115,0.3)',
              py: 2,
              fontSize: 18,
              border: '2px solid rgba(255,255,255,0.3)',
              '&:hover': {
                boxShadow: '0 6px 24px rgba(12,189,115,0.6), 0 0 30px rgba(12,189,115,0.4)',
                transform: 'translateY(-2px)'
              },
              transition: 'all 0.3s ease'
            }}
          >
            Go to Exam Bank for More Exams
          </Button>
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

        {/* Leaderboard Section — always show if student has completed exams */}
        {results.length > 0 && (
          <Box sx={{ mt: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 0 }}>
                <LeaderboardIcon color="primary" sx={{ fontSize: { xs: 24, sm: 28 } }} />
                <Typography variant={isMobile ? 'h6' : 'h5'} fontWeight="bold" sx={{ fontSize: { xs: '1.1rem', sm: '1.5rem' } }}>
                  Exam Leaderboards
                </Typography>
                <Chip label="Compare with classmates" size="small" color="info" variant="outlined" sx={{ ml: 1, display: { xs: 'none', sm: 'flex' } }} />
              </Box>
              <Button
                variant="contained"
                component={RouterLink}
                to="/student/leaderboard"
                startIcon={<LeaderboardIcon />}
                size={isMobile ? 'small' : 'medium'}
                fullWidth={isMobile}
                sx={{ textTransform: 'none', fontWeight: 700, fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
              >
                View Full Leaderboard
              </Button>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Showing your 3 most recent exams. Click an exam to see rankings, or view the full leaderboard page.
            </Typography>

            {results.slice(0, 3).map((result) => {
              const examId = result.exam?._id || result.exam;
              if (!examId) return null;
              const examTitle = result.examTitle || result.exam?.title || 'Exam';
              const percentage = calculatePercentage(result.totalScore, result.maxPossibleScore);
              const isPassed = percentage >= 70;
              const isExpanded = expandedLeaderboard === examId;
              const lbData = leaderboards[examId];
              const lbLoading = leaderboardLoading[examId];
              const myEntry = lbData?.leaderboard?.find(e => e.isCurrentUser);

              return (
                <Card key={result._id} elevation={2} sx={{ mb: 2, borderRadius: 2,
                  border: isExpanded ? '2px solid' : '1px solid',
                  borderColor: isExpanded ? 'primary.main' : 'divider' }}>
                  {/* Exam header row */}
                  <CardContent sx={{ pb: { xs: '8px !important', sm: '12px !important' }, cursor: 'pointer', p: { xs: 1.5, sm: 2 } }}
                    onClick={() => handleToggleLeaderboard(examId)}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 2 }, flexWrap: 'wrap' }}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="subtitle1" fontWeight="bold" noWrap sx={{ fontSize: { xs: '0.95rem', sm: '1rem' } }}>{examTitle}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
                          Completed: {formatDate(result.endTime)}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.75, sm: 1.5 }, flexShrink: 0, flexWrap: 'wrap' }}>
                        <Chip
                          icon={isPassed ? <CheckCircle /> : <Cancel />}
                          label={`${percentage}%`}
                          color={isPassed ? 'success' : 'error'}
                          size="small" sx={{ fontWeight: 'bold', fontSize: { xs: '0.75rem', sm: '0.875rem' }, height: { xs: 24, sm: 'auto' } }}
                        />
                        {myEntry && (
                          <Chip
                            icon={<EmojiEvents fontSize="small" />}
                            label={`Rank #${myEntry.rank}`}
                            size="small"
                            sx={{
                              fontWeight: 'bold',
                              fontSize: { xs: '0.75rem', sm: '0.875rem' },
                              height: { xs: 24, sm: 'auto' },
                              bgcolor: myEntry.rank === 1 ? '#FFD700' : myEntry.rank === 2 ? '#C0C0C0' : myEntry.rank === 3 ? '#CD7F32' : undefined,
                              color: myEntry.rank <= 3 ? 'black' : undefined
                            }}
                          />
                        )}
                        <Button size={isMobile ? 'small' : 'small'} variant="outlined" endIcon={isExpanded ? <ExpandLess /> : <ExpandMore />}
                          sx={{ textTransform: 'none', fontSize: { xs: '0.7rem', sm: '0.75rem' }, px: { xs: 1, sm: 1.5 } }}>
                          {isExpanded ? 'Hide' : 'Leaderboard'}
                        </Button>
                      </Box>
                    </Box>
                  </CardContent>

                  {/* Leaderboard panel */}
                  {isExpanded && (
                    <Box sx={{ px: { xs: 1.5, sm: 2 }, pb: { xs: 1.5, sm: 2 }, borderTop: '1px solid', borderColor: 'divider' }}>
                      <Box sx={{ display: 'flex', gap: 1.5, pt: { xs: 1, sm: 1.5 }, mb: { xs: 1, sm: 1.5 }, flexDirection: { xs: 'column', sm: 'row' } }}>
                        <Button variant="outlined" size={isMobile ? 'small' : 'small'} component={RouterLink}
                          to={`/student/results/${result._id}`} sx={{ textTransform: 'none', width: { xs: '100%', sm: 'auto' } }}>
                          View My Detailed Result
                        </Button>
                      </Box>

                      {lbLoading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                          <CircularProgress size={32} />
                        </Box>
                      ) : !lbData || lbData.leaderboard.length === 0 ? (
                        <Box sx={{ py: 3, textAlign: 'center' }}>
                          <Typography variant="body2" color="text.secondary">
                            No other students have completed this exam yet.
                          </Typography>
                        </Box>
                      ) : (
                        <Box>
                          {/* Top 3 podium */}
                          {lbData.leaderboard.length >= 2 && (
                            <Box sx={{ display: 'flex', justifyContent: 'center', gap: { xs: 0.5, sm: 2 }, mb: { xs: 1.5, sm: 2 }, mt: { xs: 0.5, sm: 1 } }}>
                              {[1, 0, 2].filter(i => lbData.leaderboard[i]).map((podiumIdx) => {
                                const entry = lbData.leaderboard[podiumIdx];
                                const podiumRank = podiumIdx + 1;
                                const podiumColors = { 1: '#FFD700', 2: '#C0C0C0', 3: '#CD7F32' };
                                const podiumHeights = { 1: { xs: 60, sm: 90 }, 2: { xs: 45, sm: 70 }, 3: { xs: 40, sm: 60 } };
                                return (
                                  <Box key={podiumIdx} sx={{ textAlign: 'center', flex: podiumRank === 1 ? '0 0 { xs: 80px, sm: 120px }' : '0 0 { xs: 60px, sm: 100px }' }}>
                                    <Box sx={{ width: { xs: 32, sm: 44 }, height: { xs: 32, sm: 44 }, borderRadius: '50%', bgcolor: podiumColors[podiumRank],
                                      display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: { xs: 0.25, sm: 0.5 },
                                      border: entry.isCurrentUser ? '2px solid #0D406C' : 'none',
                                      boxShadow: entry.isCurrentUser ? '0 0 0 1px white, 0 0 0 3px #0D406C' : 'none' }}>
                                      <Typography variant="body2" fontWeight={800} sx={{ fontSize: { xs: 9, sm: 11 } }}>
                                        {podiumRank === 1 ? '🥇' : podiumRank === 2 ? '🥈' : '🥉'}
                                      </Typography>
                                    </Box>
                                    <Box sx={{ height: podiumHeights[podiumRank], bgcolor: podiumColors[podiumRank],
                                      borderRadius: '4px 4px 0 0', opacity: 0.85, display: 'flex', alignItems: 'flex-start',
                                      justifyContent: 'center', pt: { xs: 0.5, sm: 0.75 } }}>
                                      <Typography variant="caption" fontWeight={800} sx={{ px: { xs: 0.25, sm: 0.5 }, lineHeight: 1.2, textAlign: 'center', fontSize: { xs: 8, sm: 10 } }}>
                                        {entry.name.split(' ')[0]}
                                        <br />{entry.percentage}%
                                      </Typography>
                                    </Box>
                                    {entry.isCurrentUser && (
                                      <Chip label="You" size="small" color="primary" sx={{ mt: { xs: 0.25, sm: 0.5 }, height: { xs: 14, sm: 16 }, fontSize: { xs: 8, sm: 9 } }} />
                                    )}
                                  </Box>
                                );
                              })}
                            </Box>
                          )}

                          {/* Top 5 ranking preview */}
                          {(() => {
                            const examId = result.exam?._id || result.exam;
                            const previewEntries = lbData.leaderboard.slice(0, 5);
                            const myEntryOutsideTop5 = myEntry && myEntry.rank > 5;
                            return (
                              <Box>
                                {previewEntries.map((entry, idx) => (
                                  <Box key={entry.id} sx={{
                                    display: 'flex', alignItems: 'center', gap: { xs: 0.75, sm: 1.5 }, px: { xs: 1, sm: 1.5 }, py: { xs: 0.75, sm: 1 },
                                    borderRadius: 1.5, mb: 0.5,
                                    bgcolor: entry.isCurrentUser ? alpha('#0D406C', 0.1) : idx % 2 === 0 ? 'grey.50' : 'white',
                                    border: entry.isCurrentUser ? '1.5px solid' : '1px solid transparent',
                                    borderColor: entry.isCurrentUser ? 'primary.main' : 'transparent'
                                  }}>
                                    <Box sx={{ width: { xs: 24, sm: 28 }, height: { xs: 24, sm: 28 }, borderRadius: '50%', flexShrink: 0,
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      bgcolor: entry.rank === 1 ? '#FFD700' : entry.rank === 2 ? '#C0C0C0' : entry.rank === 3 ? '#CD7F32' : 'grey.200' }}>
                                      {entry.rank <= 3
                                        ? (entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : '🥉')
                                        : <Typography variant="caption" fontWeight={800}>#{entry.rank}</Typography>}
                                    </Box>
                                    <Typography variant="body2" sx={{ flex: 1, fontWeight: entry.isCurrentUser ? 700 : 400, fontSize: { xs: '0.85rem', sm: '0.875rem' } }} noWrap>
                                      {entry.name}
                                      {entry.isCurrentUser && (
                                        <Chip label="You" size="small" color="primary" sx={{ ml: 0.5, height: { xs: 14, sm: 16 }, fontSize: { xs: 8, sm: 9 } }} />
                                      )}
                                    </Typography>
                                    <Box sx={{ width: { xs: 40, sm: 60, md: 100 } }}>
                                      <Box sx={{ height: { xs: 4, sm: 6 }, borderRadius: 3, bgcolor: 'grey.200', overflow: 'hidden' }}>
                                        <Box sx={{ height: '100%', width: `${entry.percentage}%`, borderRadius: 3,
                                          bgcolor: entry.percentage >= 80 ? 'success.main' : entry.percentage >= 60 ? 'warning.main' : 'error.main' }} />
                                      </Box>
                                    </Box>
                                    <Chip label={`${entry.percentage}%`} size="small"
                                      color={entry.percentage >= 80 ? 'success' : entry.percentage >= 60 ? 'warning' : 'error'}
                                      sx={{ fontWeight: 700, minWidth: { xs: 45, sm: 54 }, flexShrink: 0, fontSize: { xs: '0.75rem', sm: '0.875rem' }, height: { xs: 20, sm: 'auto' } }} />
                                  </Box>
                                ))}

                                {/* Show current user's position if outside top 5 */}
                                {myEntryOutsideTop5 && (
                                  <Box sx={{ px: { xs: 1, sm: 1.5 }, py: { xs: 0.25, sm: 0.5 }, textAlign: 'center' }}>
                                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>· · ·</Typography>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.75, sm: 1.5 }, px: { xs: 1, sm: 1.5 }, py: { xs: 0.75, sm: 1 },
                                      borderRadius: 1.5, bgcolor: alpha('#0D406C', 0.1), border: '1.5px solid', borderColor: 'primary.main', mt: { xs: 0.25, sm: 0.5 } }}>
                                      <Box sx={{ width: { xs: 24, sm: 28 }, height: { xs: 24, sm: 28 }, borderRadius: '50%', bgcolor: 'grey.200', flexShrink: 0,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Typography variant="caption" fontWeight={800} sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>#{myEntry.rank}</Typography>
                                      </Box>
                                      <Typography variant="body2" fontWeight={700} sx={{ flex: 1, fontSize: { xs: '0.85rem', sm: '0.875rem' } }} noWrap>
                                        {myEntry.name} <Chip label="You" size="small" color="primary" sx={{ ml: 0.5, height: { xs: 14, sm: 16 }, fontSize: { xs: 8, sm: 9 } }} />
                                      </Typography>
                                      <Chip label={`${myEntry.percentage}%`} size="small"
                                        color={myEntry.percentage >= 80 ? 'success' : myEntry.percentage >= 60 ? 'warning' : 'error'}
                                        sx={{ fontWeight: 700, minWidth: { xs: 45, sm: 54 }, flexShrink: 0, fontSize: { xs: '0.75rem', sm: '0.875rem' }, height: { xs: 20, sm: 'auto' } }} />
                                    </Box>
                                  </Box>
                                )}

                                {lbData.leaderboard.length > 5 && (
                                  <Box sx={{ mt: { xs: 1, sm: 1.5 }, textAlign: 'center' }}>
                                    <Button
                                      variant="outlined"
                                      size={isMobile ? 'small' : 'small'}
                                      component={RouterLink}
                                      to={`/student/leaderboard?exam=${examId}`}
                                      endIcon={<ArrowForward />}
                                      fullWidth={isMobile}
                                      sx={{ textTransform: 'none', fontWeight: 600, fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
                                    >
                                      View all {lbData.leaderboard.length} students
                                    </Button>
                                  </Box>
                                )}
                              </Box>
                            );
                          })()}

                          {myEntry && (
                            <Box sx={{ mt: { xs: 1, sm: 1.5 }, p: { xs: 1, sm: 1.5 }, bgcolor: alpha('#0D406C', 0.06), borderRadius: 2, textAlign: 'center' }}>
                              <Typography variant="body2" fontWeight={700} color="primary.main" sx={{ fontSize: { xs: '0.85rem', sm: '0.875rem' } }}>
                                Your rank: #{myEntry.rank} out of {lbData.leaderboard.length} students · {myEntry.percentage}%
                              </Typography>
                            </Box>
                          )}
                        </Box>
                      )}
                    </Box>
                  )}
                </Card>
              );
            })}
          </Box>
        )}

        {/* Completed Exams Section - Only show when no available exams */}
        {!hasAvailableExams && (
          <>
            <Divider sx={{ my: { xs: 3, sm: 4 } }} />
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
              <Typography variant={isMobile ? 'h6' : 'h5'} fontWeight="bold" sx={{ fontSize: { xs: '1.1rem', sm: '1.5rem' } }}>
                Completed Exams
              </Typography>
              {results.length > 0 && (
                <Button
                  variant="outlined"
                  component={RouterLink}
                  to="/student/results"
                  endIcon={<ArrowForward />}
                  size={isMobile ? 'small' : 'medium'}
                  fullWidth={isMobile}
                  sx={{ textTransform: 'none', fontWeight: 700, fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
                >
                  View All ({results.length})
                </Button>
              )}
            </Box>

            {results.length === 0 ? (
              <Paper elevation={3} sx={{ p: { xs: 3, sm: 4 }, textAlign: 'center', mt: 2 }}>
                <Assessment sx={{ fontSize: { xs: 48, sm: 64 }, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>No results yet</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.85rem', sm: '0.875rem' } }}>Complete an exam to see your results here.</Typography>
              </Paper>
            ) : (
              <Box sx={{ mt: 1 }}>
                {results.slice(0, 3).map((result) => {
                  const percentage = calculatePercentage(result.totalScore, result.maxPossibleScore);
                  const isPassed = percentage >= 70;
                  return (
                    <Card key={result._id} elevation={2} sx={{ mb: 2, borderRadius: 2 }}>
                      <CardContent sx={{ pb: { xs: '8px !important', sm: '12px !important' }, p: { xs: 1.5, sm: 2 } }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: { xs: 1, sm: 1.5 } }}>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="subtitle1" fontWeight="bold" noWrap sx={{ fontSize: { xs: '0.95rem', sm: '1rem' } }}>
                              {result.examTitle || result.exam?.title || 'Exam'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
                              Completed: {formatDate(result.endTime)}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.75, sm: 1.5 }, flexShrink: 0, flexWrap: 'wrap' }}>
                            <Chip
                              icon={isPassed ? <CheckCircle /> : <Cancel />}
                              label={`${percentage}% · ${result.totalScore}/${result.maxPossibleScore} pts`}
                              color={isPassed ? 'success' : 'error'}
                              size="small" sx={{ fontWeight: 'bold', fontSize: { xs: '0.7rem', sm: '0.875rem' }, height: { xs: 24, sm: 'auto' } }}
                            />
                            <Button
                              variant="outlined"
                              size={isMobile ? 'small' : 'small'}
                              component={RouterLink}
                              to={`/student/results/${result._id}`}
                              endIcon={<ArrowForward />}
                              sx={{ textTransform: 'none', fontSize: { xs: '0.7rem', sm: '0.75rem' }, fontWeight: 600, px: { xs: 1, sm: 1.5 } }}
                            >
                              Details
                            </Button>
                          </Box>
                        </Box>
                      </CardContent>
                    </Card>
                  );
                })}

                {results.length > 3 && (
                  <Box sx={{ textAlign: 'center', mt: 1 }}>
                    <Button
                      variant="contained"
                      component={RouterLink}
                      to="/student/results"
                      endIcon={<ArrowForward />}
                      size={isMobile ? 'small' : 'medium'}
                      fullWidth={isMobile}
                      sx={{ textTransform: 'none', fontWeight: 700, fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
                    >
                      View All {results.length} Completed Exams
                    </Button>
                  </Box>
                )}
              </Box>
            )}
          </>
        )}
      </Container>
    </StudentLayout>
  );
};

export default Dashboard;
