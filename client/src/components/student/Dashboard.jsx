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
  Psychology
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

  const handleDirectRequest = async (examId, examTitle) => {
    try {
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

        {/* App Download Recommendation */}
        <Card
          elevation={3}
          sx={{
            mb: 4,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white'
          }}
        >
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
              <Box sx={{ flex: 1, minWidth: 250 }}>
                <Typography variant="h6" fontWeight="bold" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Psychology />
                  Boost Your Learning with Excellence Coaching Hub
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
          </CardContent>
        </Card>

        {/* Pending Exam Requests Section - Moved to top */}
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
                          {canStart ? (
                            <Button
                              variant="contained"
                              component={RouterLink}
                              to={`/student/exam/${exam._id}`}
                              size={isMobile ? 'medium' : 'large'}
                              startIcon={<PlayArrow />}
                              fullWidth={isMobile}
                              sx={{
                                fontWeight: 'bold',
                                px: { xs: 2, sm: 3 },
                                py: { xs: 1.2, sm: 1.5 },
                                textTransform: 'none'
                              }}
                            >
                              Start Exam
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
        </Box>

        {/* Approved Exam Requests Section */}
        {pendingRequests.filter(r => r.status === 'approved').length > 0 && (
          <Box sx={{ mt: 4 }}>
            <Typography variant="h5" fontWeight="bold" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CheckCircle color="success" />
              Approved Exam Requests
            </Typography>
            <Paper elevation={3} sx={{ p: 3, mb: 4, bgcolor: 'success.light', border: '2px solid', borderColor: 'success.main' }}>
              {pendingRequests.filter(r => r.status === 'approved').map((request) => (
                <Card key={request._id} elevation={2} sx={{ mb: 2, bgcolor: 'background.paper' }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                      <Box sx={{ flex: 1, minWidth: { xs: '100%', sm: 200 } }}>
                        <Typography variant={isMobile ? 'subtitle1' : 'h6'} fontWeight="bold">
                          {request.exam?.title || 'Exam'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Approved: {formatDate(request.updatedAt)}
                        </Typography>
                        {request.amount > 0 && (
                          <Typography variant="body2" color="success.main" fontWeight="bold">
                            Price: RWF {request.amount.toLocaleString()}
                          </Typography>
                        )}
                      </Box>
                      <Chip
                        label="Approved"
                        color="success"
                        size="medium"
                        sx={{ fontWeight: 'bold' }}
                      />
                    </Box>
                    <Button
                      variant="contained"
                      component={RouterLink}
                      to={`/student/exam/${request.exam?._id}`}
                      sx={{ mt: 2 }}
                      startIcon={<PlayArrow />}
                      fullWidth={isMobile}
                    >
                      Start Exam Now
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </Paper>
          </Box>
        )}

        {/* Marketplace Exams Section */}
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
                              startIcon={<AddCircle />}
                              fullWidth={isMobile}
                              sx={{
                                fontWeight: 'bold',
                                textTransform: 'none',
                                background: 'linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%)',
                                boxShadow: '0 2px 8px rgba(139,92,246,0.3)'
                              }}
                            >
                              Retake
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
                              startIcon={<AddCircle />}
                              fullWidth={isMobile}
                              sx={{
                                fontWeight: 'bold',
                                textTransform: 'none',
                                background: 'linear-gradient(135deg, #0D406C 0%, #0CBD73 100%)',
                                boxShadow: '0 2px 8px rgba(12,189,115,0.3)'
                              }}
                            >
                              Request
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
};

export default Dashboard;
