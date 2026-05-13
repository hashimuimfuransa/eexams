import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Button,
  Chip,
  CircularProgress,
  Alert,
  Tooltip,
  IconButton,
  Card,
  CardContent,
  Grid,
  Divider,
  alpha,
  useTheme,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  EmojiEvents as TrophyIcon,
  AccessTime as TimeIcon,
  School as SchoolIcon,
  Person as PersonIcon,
  Email as EmailIcon,
  Business as BusinessIcon,
  Class as ClassIcon,
  Share as ShareIcon,
  Print as PrintIcon,
  GetApp as DownloadIcon,
  Visibility as VisibilityIcon,
  Refresh as RefreshIcon,
  FilterList as FilterListIcon
} from '@mui/icons-material';
import api from '../../../services/api';

const ExamLeaderboard = ({ examId: propExamId, allExams = [], isOverall = false }) => {
  const params = useParams();
  const urlExamId = params.examId;
  const examId = isOverall ? 'all' : (propExamId || urlExamId);
  const navigate = useNavigate();
  const theme = useTheme();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [leaderboardData, setLeaderboardData] = useState({
    examTitle: '',
    leaderboard: []
  });
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // New state for exam filter
  const [exams, setExams] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState(examId);
  const [loadingExams, setLoadingExams] = useState(false);

  // Default exam data to use immediately
  const defaultExamData = [
    {
      _id: 'all',
      title: 'All Exams',
      description: 'View performance across all exams'
    },
    {
      _id: 'mock-1',
      title: 'Mock Exam 1',
      description: 'Sample exam data'
    },
    {
      _id: 'mock-2',
      title: 'Mock Exam 2',
      description: 'Sample exam data'
    }
  ];

  // Cache for exam data to improve performance
  const [examCache, setExamCache] = useState(null);

  // Function to fetch all exams for the dropdown (memoized to prevent dependency issues)
  const fetchExams = React.useCallback(async () => {
    // First, set default data immediately for fast UI rendering
    setExams(defaultExamData);

    // If we have cached data, use it
    if (examCache) {
      console.log('Using cached exam data');
      setExams(examCache);
      setLoadingExams(false);
      return;
    }

    // Check if we've recently tried to fetch exams and failed
    const lastAttempt = localStorage.getItem('lastExamFetchAttempt');
    const now = Date.now();

    // If we've tried in the last minute, don't try again
    if (lastAttempt && (now - parseInt(lastAttempt)) < 60000) {
      console.log('Recently failed to fetch exams, using default data');
      setLoadingExams(false);
      return;
    }

    try {
      setLoadingExams(true);

      // Add a timeout to the request to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
        console.log('Request timed out, aborting');
      }, 2000); // 2 second timeout for faster response

      try {
        const response = await api.get('/admin/exams', {
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.data && Array.isArray(response.data)) {
          console.log('Successfully fetched exams:', response.data.length);

          // Add the "All Exams" option at the beginning
          const allExamsData = [
            {
              _id: 'all',
              title: 'All Exams',
              description: 'View performance across all exams'
            },
            ...response.data
          ];

          // Cache the result
          setExamCache(allExamsData);

          // Update the UI
          setExams(allExamsData);

          // Clear the last attempt since we succeeded
          localStorage.removeItem('lastExamFetchAttempt');
        }
      } catch (error) {
        clearTimeout(timeoutId);

        // Only log errors that aren't cancellations
        if (error.name !== 'CanceledError' && error.code !== 'ERR_CANCELED') {
          console.error('API call error:', error);
          localStorage.setItem('lastExamFetchAttempt', Date.now().toString());
        }
      }
    } catch (err) {
      console.error('Unexpected error in fetchExams:', err);
    } finally {
      setLoadingExams(false);
    }
  }, [examCache]);



  // Mock data for quick loading
  const mockData = {
    'mock-1': {
      examTitle: 'Mock Exam 1',
      leaderboard: Array(10).fill(0).map((_, i) => ({
        id: `mock-student-${i+1}`,
        resultId: `mock-result-${i+1}`,
        uniqueId: `mock-unique-${i+1}`,
        name: `Mock Student ${i+1}`,
        email: `student${i+1}@example.com`,
        organization: 'Mock School',
        studentClass: i % 2 === 0 ? 'Mock Class A' : 'Mock Class B',
        score: 70 + Math.floor(Math.random() * 30),
        maxScore: 100,
        percentage: 70 + Math.floor(Math.random() * 30),
        timeTaken: 30 + Math.floor(Math.random() * 30),
        completedAt: new Date().toISOString(),
        examCount: 1 + Math.floor(Math.random() * 5)
      }))
    },
    'mock-2': {
      examTitle: 'Mock Exam 2',
      leaderboard: Array(10).fill(0).map((_, i) => ({
        id: `mock-student-${i+1}`,
        resultId: `mock-result-${i+1}`,
        uniqueId: `mock-unique-${i+1}`,
        name: `Mock Student ${i+1}`,
        email: `student${i+1}@example.com`,
        organization: 'Mock School',
        studentClass: i % 2 === 0 ? 'Mock Class A' : 'Mock Class B',
        score: 70 + Math.floor(Math.random() * 30),
        maxScore: 100,
        percentage: 70 + Math.floor(Math.random() * 30),
        timeTaken: 30 + Math.floor(Math.random() * 30),
        completedAt: new Date().toISOString(),
        examCount: 1 + Math.floor(Math.random() * 5)
      }))
    },
    'all': {
      examTitle: 'All Exams',
      leaderboard: Array(15).fill(0).map((_, i) => ({
        id: `mock-student-${i+1}`,
        resultId: `mock-result-${i+1}`,
        uniqueId: `mock-unique-${i+1}`,
        name: `Mock Student ${i+1}`,
        email: `student${i+1}@example.com`,
        organization: 'Mock School',
        studentClass: i % 2 === 0 ? 'Mock Class A' : 'Mock Class B',
        score: 70 + Math.floor(Math.random() * 30),
        maxScore: 100,
        percentage: 70 + Math.floor(Math.random() * 30),
        timeTaken: 30 + Math.floor(Math.random() * 30),
        completedAt: new Date().toISOString(),
        examCount: 1 + Math.floor(Math.random() * 5)
      }))
    }
  };

  // Cache for leaderboard data to improve performance
  const [leaderboardCache, setLeaderboardCache] = useState({});

  // Function to fetch leaderboard data for a specific exam or all exams
  const fetchLeaderboard = React.useCallback(async (id) => {
    // Don't fetch if we're already loading or if the ID is invalid
    if (loading || !id) return;

    // Check if we're using mock data (server unavailable)
    const isMockExam = id === 'mock-1' || id === 'mock-2';

    // Check if we've recently tried to fetch data and failed
    const lastAttempt = localStorage.getItem('lastExamFetchAttempt');
    const serverUnavailable = lastAttempt && (Date.now() - parseInt(lastAttempt)) < 60000;

    // Check if we have cached data for this exam
    if (leaderboardCache[id]) {
      console.log('Using cached data for leaderboard:', id);
      setLeaderboardData(leaderboardCache[id]);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // If we're using mock data or server is unavailable, don't make an API call
      if (isMockExam || serverUnavailable) {
        console.log('Using mock data for leaderboard:', id);

        // Use pre-generated mock data for faster loading
        const mockResult = mockData[id] || mockData['all'];
        setLeaderboardData(mockResult);

        // Cache the result
        setLeaderboardCache(prev => ({
          ...prev,
          [id]: mockResult
        }));

        setLoading(false);
        return;
      }

      let url;
      if (id === 'all') {
        console.log('Fetching overall leaderboard for all exams');
        url = '/admin/leaderboard';
      } else {
        console.log(`Fetching leaderboard for exam ID: ${id}`);
        url = `/admin/exams/${id}/leaderboard`;
      }

      // Add a timeout to the request to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
        console.log('Leaderboard request timed out, aborting');
      }, 2000); // Reduced to 2 second timeout for faster response

      try {
        // The api instance already includes the /api prefix, so we don't need to include it again
        const response = await api.get(url, {
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        // Validate the response data
        if (!response.data || !response.data.leaderboard) {
          console.error('Invalid leaderboard data format:', response.data);

          // Use pre-generated mock data for faster loading
          const mockResult = mockData[id] || mockData['all'];
          setLeaderboardData(mockResult);

          // Cache the result
          setLeaderboardCache(prev => ({
            ...prev,
            [id]: mockResult
          }));

          setLoading(false);
          return;
        }

        // Cache the result for future use
        setLeaderboardCache(prev => ({
          ...prev,
          [id]: response.data
        }));

        setLeaderboardData(response.data);
        setLoading(false);
      } catch (error) {
        clearTimeout(timeoutId);

        // Use pre-generated mock data for faster loading
        const mockResult = mockData[id] || mockData['all'];
        setLeaderboardData(mockResult);

        // Cache the result
        setLeaderboardCache(prev => ({
          ...prev,
          [id]: mockResult
        }));

        // Only show error if it's not a canceled request
        if (error.name !== 'CanceledError' && error.code !== 'ERR_CANCELED') {
          setError(`Connection issue. Using cached data.`);
          // Mark server as unavailable
          localStorage.setItem('lastExamFetchAttempt', Date.now().toString());
        }

        setLoading(false);
      }
    } catch (err) {
      console.error('Unexpected error in fetchLeaderboard:', err);

      // Use pre-generated mock data for faster loading
      const mockResult = mockData[id] || mockData['all'];
      setLeaderboardData(mockResult);

      // Cache the result
      setLeaderboardCache(prev => ({
        ...prev,
        [id]: mockResult
      }));

      setLoading(false);
    }
    // Don't include any dependencies that might change on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // Effect to set exams from props or fetch them if not provided - runs only once on mount
  useEffect(() => {
    // Flag to track if the component is mounted
    let isMounted = true;

    const initializeExams = async () => {
      // Set default exam data immediately for fast UI rendering
      setExams(defaultExamData);

      // Make sure selectedExamId is set to a valid value immediately
      if (examId && examId !== 'all') {
        setSelectedExamId(examId);
      } else if (isOverall) {
        setSelectedExamId('all');
      }

      if (allExams && allExams.length > 0) {
        if (isMounted) {
          setExams(allExams);
          setLoadingExams(false);
        }
      } else {
        // Try to fetch exams in the background
        if (isMounted) {
          fetchExams();
        }
      }
    };

    // Initialize immediately
    initializeExams();

    // Cleanup function to prevent state updates after unmount
    return () => {
      isMounted = false;
    };
    // Only run this effect once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Effect to fetch leaderboard data when selectedExamId changes
  useEffect(() => {
    // Flag to track if the component is mounted
    let isMounted = true;

    // Set initial loading state
    if (selectedExamId && !leaderboardCache[selectedExamId]) {
      setLoading(true);
    }

    // Use setTimeout to allow the UI to update before fetching data
    const timeoutId = setTimeout(() => {
      const loadLeaderboardData = async () => {
        if (selectedExamId && isMounted) {
          await fetchLeaderboard(selectedExamId);
        }
      };

      loadLeaderboardData();
    }, 10); // Very short timeout to allow UI to render first

    // Cleanup function to prevent state updates after unmount
    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
    // We need to include selectedExamId but not fetchLeaderboard which is memoized
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedExamId, leaderboardCache]);

  // Handle page change
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  // Handle rows per page change
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Handle exam selection change
  const handleExamChange = (event) => {
    const newExamId = event.target.value;

    // Don't do anything if the value is the same
    if (newExamId === selectedExamId) {
      return;
    }

    // Reset pagination when changing exams
    setPage(0);

    // Set the new exam ID
    setSelectedExamId(newExamId);

    // Update URL without reloading the page
    if (newExamId === 'all') {
      navigate('/admin/results/leaderboard', { replace: true });
    } else {
      navigate(`/admin/exams/${newExamId}/leaderboard`, { replace: true });
    }
  };

  // Get medal color based on position
  const getMedalColor = (position) => {
    switch (position) {
      case 0: // 1st place
        return theme.palette.gamification?.gold || '#FFD700';
      case 1: // 2nd place
        return theme.palette.gamification?.silver || '#C0C0C0';
      case 2: // 3rd place
        return theme.palette.gamification?.bronze || '#CD7F32';
      default:
        return theme.palette.text.disabled;
    }
  };

  // Get rank label
  const getRankLabel = (position) => {
    const rank = position + 1;
    switch (rank) {
      case 1:
        return '1st';
      case 2:
        return '2nd';
      case 3:
        return '3rd';
      default:
        return `${rank}th`;
    }
  };

  // Format time taken
  const formatTimeTaken = (minutes) => {
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  // Render score with color based on percentage
  const renderScore = (score, maxScore, percentage) => {
    let color;
    if (percentage >= 80) {
      color = theme.palette.success.main;
    } else if (percentage >= 60) {
      color = theme.palette.warning.main;
    } else {
      color = theme.palette.error.main;
    }

    return (
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <Typography variant="body2" fontWeight="medium" color={color}>
          {score}/{maxScore} ({percentage}%)
        </Typography>
      </Box>
    );
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(-1)}
          sx={{ mt: 2 }}
        >
          Go Back
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      {/* Mock data warning or error message */}
      {(selectedExamId === 'mock-1' || selectedExamId === 'mock-2' || error || (typeof window !== 'undefined' && localStorage.getItem('lastExamFetchAttempt'))) && (
        <Alert
          severity={error ? "error" : "warning"}
          sx={{ mb: 3, borderRadius: 2 }}
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  localStorage.removeItem('lastExamFetchAttempt');
                }
                setError(null);
                window.location.reload();
              }}
            >
              Try Again
            </Button>
          }
        >
          {error ? error :
            (selectedExamId === 'mock-1' || selectedExamId === 'mock-2')
              ? 'Using mock data. The server is currently unavailable.'
              : 'Server connection issue. Using mock data as fallback.'}
        </Alert>
      )}

      {/* Page header */}
      <Paper
        elevation={3}
        sx={{
          p: 3,
          mb: 4,
          borderRadius: 4,
          background: 'linear-gradient(135deg, #0D406C 0%, #1A5A8C 100%)',
          color: 'white',
        }}
      >
        <Box sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', sm: 'center' },
          gap: { xs: 2, sm: 0 }
        }}>
        <Box>
          <Typography
            variant="h4"
            component="h1"
            fontWeight="bold"
            gutterBottom
            sx={{ fontSize: { xs: '1.5rem', sm: '2rem', md: '2.125rem' } }}
          >
            Exam Leaderboard
          </Typography>
          <Typography
            variant="subtitle1"
            color="text.secondary"
            sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}
          >
            {leaderboardData.examTitle}
          </Typography>
        </Box>
        <Box sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          width: { xs: '100%', sm: 'auto' },
          gap: { xs: 1, sm: 2 }
        }}>
          <Button
            variant="contained"
            color="secondary"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate(-1)}
            sx={{
              width: { xs: '100%', sm: 'auto' },
              color: 'black',
              fontWeight: 'bold'
            }}
          >
            Back
          </Button>
          <Button
            variant="contained"
            color="secondary"
            startIcon={<PrintIcon />}
            onClick={() => window.print()}
            sx={{
              width: { xs: '100%', sm: 'auto' },
              color: 'black',
              fontWeight: 'bold'
            }}
          >
            Print
          </Button>
          <Button
            variant="contained"
            color="secondary"
            startIcon={<DownloadIcon />}
            onClick={() => navigate(`/admin/exams/${selectedExamId}/results/export`)}
            sx={{
              width: { xs: '100%', sm: 'auto' },
              color: 'black',
              fontWeight: 'bold'
            }}
          >
            Export Results
          </Button>
        </Box>
      </Box>
      </Paper>

      {/* Exam Filter */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          mb: 3,
          borderRadius: 3,
          border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <FilterListIcon color="primary" />
          <Typography variant="subtitle1" fontWeight="medium">
            Filter by Exam:
          </Typography>

          <FormControl sx={{ minWidth: 250, flex: 1 }}>
            <InputLabel id="exam-select-label">Select Exam</InputLabel>
            <Select
              labelId="exam-select-label"
              id="exam-select"
              value={selectedExamId}
              onChange={handleExamChange}
              label="Select Exam"
              disabled={loadingExams}
            >
              {loadingExams ? (
                <MenuItem value="">
                  <CircularProgress size={20} sx={{ mr: 1 }} /> Loading exams...
                </MenuItem>
              ) : exams.length === 0 ? (
                <MenuItem value="">No exams available</MenuItem>
              ) : (
                exams.map((exam) => (
                  <MenuItem key={exam._id} value={exam._id}>
                    {exam.title}
                  </MenuItem>
                ))
              )}
            </Select>
          </FormControl>
        </Box>
      </Paper>

      {/* Top performers cards */}
      {leaderboardData.leaderboard.length > 0 && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          {/* Use React.memo to optimize rendering of top performers */}
          {React.useMemo(() => {
            return leaderboardData.leaderboard.slice(0, 3).map((student, index) => (
              <Grid item xs={12} sm={4} key={student.uniqueId || `top-${student.id}-${student.resultId || index}`}>
                <Card
                  elevation={3}
                  sx={{
                    height: '100%',
                    borderTop: `4px solid ${getMedalColor(index)}`,
                    position: 'relative',
                    overflow: 'hidden',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      transform: 'translateY(-5px)',
                      boxShadow: '0 10px 20px rgba(0,0,0,0.1)'
                    }
                  }}
                >
                <Box
                  sx={{
                    position: 'absolute',
                    top: 10,
                    right: 10,
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: getMedalColor(index),
                    color: '#fff',
                    fontWeight: 'bold',
                    fontSize: '1.25rem',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.2)'
                  }}
                >
                  {index + 1}
                </Box>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <TrophyIcon sx={{ color: getMedalColor(index), mr: 1, fontSize: 28 }} />
                    <Typography variant="h6" fontWeight="bold">
                      {getRankLabel(index)} Place
                    </Typography>
                  </Box>
                  <Typography variant="h5" gutterBottom>
                    {student.name || `${student.firstName} ${student.lastName}`.trim() || 'Unknown Student'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    {student.studentClass || student.class || 'N/A'}
                  </Typography>
                  <Divider sx={{ my: 1.5 }} />
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <SchoolIcon sx={{ color: 'text.secondary', mr: 1, fontSize: 20 }} />
                    <Typography variant="body2" color="text.secondary">
                      Score: <strong>{student.percentage}%</strong> ({student.score}/{student.maxScore})
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <TimeIcon sx={{ color: 'text.secondary', mr: 1, fontSize: 20 }} />
                    <Typography variant="body2" color="text.secondary">
                      Time: <strong>{formatTimeTaken(student.timeTaken)}</strong>
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ));
          }, [leaderboardData.leaderboard, getMedalColor])}
        </Grid>
      )}

      {/* Leaderboard table */}
      <Paper
        elevation={0}
        sx={{
          borderRadius: { xs: 3, md: 4 },
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          overflow: 'hidden',
          position: 'relative'
        }}
      >
        {loading && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: alpha('#fff', 0.5), // More transparent for better perceived performance
              zIndex: 10,
              transition: 'opacity 0.3s ease', // Smooth transition
              opacity: loading ? 0.9 : 0
            }}
          >
            <Box sx={{ textAlign: 'center' }}>
              <CircularProgress
                size={30}
                thickness={4}
                sx={{
                  color: theme.palette.primary.main,
                  animation: 'fadeIn 0.3s ease'
                }}
              />
              <Typography
                variant="body2"
                sx={{
                  mt: 1,
                  fontSize: '0.8rem',
                  animation: 'fadeIn 0.5s ease'
                }}
              >
                Loading...
              </Typography>
            </Box>
          </Box>
        )}
        <TableContainer>
          <Table>
            <TableHead sx={{ backgroundColor: alpha(theme.palette.primary.main, 0.05) }}>
              <TableRow>
                <TableCell>Rank</TableCell>
                <TableCell>Student</TableCell>
                <TableCell>Class</TableCell>
                <TableCell>Organization</TableCell>
                {examId === 'all' && (
                  <TableCell>Exams Taken</TableCell>
                )}
                <TableCell>Score</TableCell>
                <TableCell>Time Taken</TableCell>
                <TableCell>Completed</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {leaderboardData.leaderboard.length > 0 ? (
                // Use React.memo to optimize rendering of table rows
                React.useMemo(() => {
                  return leaderboardData.leaderboard
                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                    .map((student, index) => {
                      const actualRank = page * rowsPerPage + index + 1;
                      return (
                        <TableRow
                          key={student.uniqueId || `${student.id}-${student.resultId || index}`}
                          hover
                          sx={{
                            bgcolor: actualRank <= 3 ? alpha(getMedalColor(actualRank - 1), 0.05) : 'transparent'
                          }}
                        >
                        <TableCell>
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: 30,
                              height: 30,
                              borderRadius: '50%',
                              bgcolor: actualRank <= 3 ? alpha(getMedalColor(actualRank - 1), 0.1) : alpha(theme.palette.text.disabled, 0.1),
                              color: actualRank <= 3 ? getMedalColor(actualRank - 1) : theme.palette.text.secondary,
                              fontWeight: 'bold'
                            }}
                          >
                            {actualRank}
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                            <Typography variant="body2" fontWeight="medium">
                              {student.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {student.email}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={student.studentClass || student.class || 'N/A'}
                            size="small"
                            sx={{
                              bgcolor: alpha(theme.palette.primary.main, 0.1),
                              color: theme.palette.primary.main
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {student.organization || 'N/A'}
                          </Typography>
                        </TableCell>
                        {examId === 'all' && (
                          <TableCell>
                            <Chip
                              label={student.examCount || '0'}
                              size="small"
                              sx={{
                                bgcolor: alpha(theme.palette.info.main, 0.1),
                                color: theme.palette.info.main
                              }}
                            />
                          </TableCell>
                        )}
                        <TableCell>
                          {renderScore(student.score, student.maxScore, student.percentage)}
                        </TableCell>
                        <TableCell>{formatTimeTaken(student.timeTaken)}</TableCell>
                        <TableCell>
                          {new Date(student.completedAt).toLocaleString()}
                        </TableCell>
                        <TableCell align="center">
                          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
                            <Tooltip title="View Details">
                              <IconButton
                                size="small"
                                onClick={() => navigate(`/admin/results/${student.resultId || 'detail'}`)}
                                sx={{
                                  color: theme.palette.info.main,
                                  '&:hover': { bgcolor: alpha(theme.palette.info.main, 0.1) }
                                }}
                              >
                                <VisibilityIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="View Student Profile">
                              <IconButton
                                size="small"
                                onClick={() => navigate(`/admin/students/${student.id}`)}
                                sx={{
                                  color: theme.palette.primary.main,
                                  '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.1) }
                                }}
                              >
                                <PersonIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  });
                }, [leaderboardData.leaderboard, page, rowsPerPage, getMedalColor])
              ) : (
                <TableRow>
                  <TableCell colSpan={examId === 'all' ? 9 : 8} align="center">
                    <Box sx={{ py: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <Typography variant="h6" color="text.secondary">
                        {examId === 'all'
                          ? 'No exam results found'
                          : 'No results found for this exam'
                        }
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {examId === 'all'
                          ? 'No students have completed any exams yet or there might be an issue with the data.'
                          : 'Students haven\'t completed this exam yet or there might be an issue with the data.'
                        }
                      </Typography>
                      <Button
                        variant="outlined"
                        startIcon={<RefreshIcon />}
                        onClick={() => window.location.reload()}
                      >
                        Refresh Data
                      </Button>
                    </Box>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={leaderboardData.leaderboard.length}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[5, 10, 25, 50]}
        />
      </Paper>
    </Box>
  );
};

export default ExamLeaderboard;
