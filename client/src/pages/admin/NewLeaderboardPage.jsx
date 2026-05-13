import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Card,
  CardContent,
  Grid,
  Divider,
  Avatar,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  InputAdornment,
  CircularProgress,
  Button,
  IconButton,
  Tooltip,
  Alert,
  Skeleton,
  useTheme,
  alpha,
  Fade,
  Zoom
} from '@mui/material';
import {
  Search as SearchIcon,
  Refresh as RefreshIcon,
  EmojiEvents as EmojiEventsIcon,
  FilterList as FilterListIcon,
  School as SchoolIcon,
  Timer as TimerIcon,
  CheckCircle as CheckCircleIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
  Person as PersonIcon,
  Class as ClassIcon,
  Business as BusinessIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import useApiWithTimeout from '../../hooks/useApiWithTimeout';

const NewLeaderboardPage = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { apiCall, cleanup } = useApiWithTimeout(45000); // 45 second timeout with retries

  // State variables
  const [loading, setLoading] = useState(true);
  const [examsLoading, setExamsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exams, setExams] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState('all');
  const [leaderboardData, setLeaderboardData] = useState({ leaderboard: [] });
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('percentage');
  const [sortDirection, setSortDirection] = useState('desc');
  const [filterClass, setFilterClass] = useState('all');
  const [filterOrganization, setFilterOrganization] = useState('all');
  const [dataCache, setDataCache] = useState({});

  // Derived state for available filters
  const [availableClasses, setAvailableClasses] = useState([]);
  const [availableOrganizations, setAvailableOrganizations] = useState([]);

  // Mock data for quick loading
  const mockData = {
    'all': {
      examTitle: 'All Exams',
      leaderboard: Array(15).fill(0).map((_, i) => ({
        id: `mock-student-${i+1}`,
        resultId: `mock-result-${i+1}`,
        uniqueId: `mock-unique-${i+1}`,
        name: `Student ${i+1}`,
        email: `student${i+1}@example.com`,
        organization: i % 3 === 0 ? 'School A' : i % 3 === 1 ? 'School B' : 'School C',
        studentClass: i % 4 === 0 ? 'Science Class' : i % 4 === 1 ? 'Math Class' : i % 4 === 2 ? 'History Class' : 'Language Class',
        score: 70 + Math.floor(Math.random() * 30),
        maxScore: 100,
        percentage: 70 + Math.floor(Math.random() * 30),
        timeTaken: 30 + Math.floor(Math.random() * 30),
        completedAt: new Date(Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000)).toISOString(),
        examCount: 1 + Math.floor(Math.random() * 5)
      }))
    }
  };

  // Fetch exams on component mount
  useEffect(() => {
    fetchExams();
  }, []);

  // Fetch leaderboard data when selected exam changes
  useEffect(() => {
    if (selectedExamId) {
      fetchLeaderboardData(selectedExamId);
    }
  }, [selectedExamId]);

  // Extract available filter options when leaderboard data changes
  useEffect(() => {
    if (leaderboardData && leaderboardData.leaderboard && leaderboardData.leaderboard.length > 0) {
      // Extract unique classes
      const classes = [...new Set(leaderboardData.leaderboard
        .map(student => student.studentClass)
        .filter(Boolean))];
      setAvailableClasses(classes);

      // Extract unique organizations
      const organizations = [...new Set(leaderboardData.leaderboard
        .map(student => student.organization)
        .filter(Boolean))];
      setAvailableOrganizations(organizations);
    }
  }, [leaderboardData]);

  // Cleanup effect to prevent memory leaks
  useEffect(() => {
    return () => {
      // Clear any pending timeouts or abort controllers when component unmounts
      console.log('NewLeaderboardPage component unmounting, cleaning up...');
      cleanup();
    };
  }, [cleanup]);

  // Fetch exams from API
  const fetchExams = async () => {
    setExamsLoading(true);

    try {
      // First set default "All Exams" option for immediate UI rendering
      setExams([{
        _id: 'all',
        title: 'All Exams',
        description: 'View performance across all exams'
      }]);

      // Check if we have cached data
      if (localStorage.getItem('cachedExams')) {
        const cachedExams = JSON.parse(localStorage.getItem('cachedExams'));
        if (cachedExams && cachedExams.length > 0) {
          setExams([
            {
              _id: 'all',
              title: 'All Exams',
              description: 'View performance across all exams'
            },
            ...cachedExams
          ]);
        }
      }

      // Use the custom hook for API call with timeout handling
      const response = await apiCall('get', '/admin/exams');

      if (response.data && Array.isArray(response.data)) {
        const examData = [
          {
            _id: 'all',
            title: 'All Exams',
            description: 'View performance across all exams'
          },
          ...response.data
        ];

        setExams(examData);
        localStorage.setItem('cachedExams', JSON.stringify(response.data));
      }
    } catch (err) {
      console.error('Error fetching exams:', err);

      // If we don't have cached data, show error
      if (!localStorage.getItem('cachedExams')) {
        setError(`Failed to load exams: ${err.message}`);
      } else {
        console.log('Using cached exams due to fetch error');
      }
    } finally {
      setExamsLoading(false);
    }
  };

  // Fetch leaderboard data from API
  const fetchLeaderboardData = async (examId) => {
    setLoading(true);
    setError(null);

    // Check if we have cached data for this exam
    if (dataCache[examId]) {
      console.log(`Using cached data for exam ${examId}`);
      setLeaderboardData(dataCache[examId]);
      setLoading(false);
      return;
    }

    try {
      let url;
      if (examId === 'all') {
        url = '/admin/leaderboard';
      } else {
        url = `/admin/exams/${examId}/leaderboard`;
      }

      console.log(`Fetching leaderboard data from: ${url}`);

      // Use the custom hook for API call with timeout handling and retries
      const response = await apiCall('get', url);

      if (response.data && response.data.leaderboard) {
        console.log(`Successfully fetched leaderboard data for exam ${examId}`);

        // Cache the data
        setDataCache(prev => ({
          ...prev,
          [examId]: response.data
        }));

        setLeaderboardData(response.data);
      } else {
        throw new Error('Invalid data format received from server');
      }
    } catch (err) {
      console.error('Error fetching leaderboard data:', err);

      // Provide more specific error messages
      let errorMessage = 'Failed to load leaderboard data.';
      if (err.message.includes('timed out')) {
        errorMessage = 'Request timed out. The server may be busy. Please try again.';
      } else if (err.message.includes('Network error')) {
        errorMessage = 'Network error. Please check your internet connection.';
      } else if (err.response?.status === 404) {
        errorMessage = 'Leaderboard data not found for this exam.';
      } else if (err.response?.status >= 500) {
        errorMessage = 'Server error. Please try again later.';
      }

      setError(errorMessage);

      // Use mock data as fallback only if no cached data exists
      if (!dataCache[examId]) {
        console.log('Using mock data as fallback');
        setLeaderboardData(mockData.all);
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle exam selection change
  const handleExamChange = (event) => {
    setSelectedExamId(event.target.value);
  };

  // Handle search input change
  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
  };

  // Handle sort field change
  const handleSortFieldChange = (field) => {
    if (sortField === field) {
      // Toggle sort direction if clicking the same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new field and default to descending
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Handle filter changes
  const handleClassFilterChange = (event) => {
    setFilterClass(event.target.value);
  };

  const handleOrganizationFilterChange = (event) => {
    setFilterOrganization(event.target.value);
  };

  // Reset all filters
  const handleResetFilters = () => {
    setSearchTerm('');
    setFilterClass('all');
    setFilterOrganization('all');
    setSortField('percentage');
    setSortDirection('desc');
  };

  // Refresh data
  const handleRefresh = () => {
    fetchLeaderboardData(selectedExamId);
  };

  // Filter and sort the leaderboard data
  const filteredAndSortedData = useMemo(() => {
    if (!leaderboardData || !leaderboardData.leaderboard) return [];

    return leaderboardData.leaderboard
      // Apply search filter
      .filter(student => {
        if (!searchTerm) return true;
        const searchLower = searchTerm.toLowerCase();
        return (
          (student.name && student.name.toLowerCase().includes(searchLower)) ||
          (student.email && student.email.toLowerCase().includes(searchLower)) ||
          (student.studentClass && student.studentClass.toLowerCase().includes(searchLower)) ||
          (student.organization && student.organization.toLowerCase().includes(searchLower))
        );
      })
      // Apply class filter
      .filter(student => {
        if (filterClass === 'all') return true;
        return student.studentClass === filterClass;
      })
      // Apply organization filter
      .filter(student => {
        if (filterOrganization === 'all') return true;
        return student.organization === filterOrganization;
      })
      // Sort data
      .sort((a, b) => {
        let valueA, valueB;

        // Determine values to compare based on sort field
        switch (sortField) {
          case 'name':
            valueA = a.name || '';
            valueB = b.name || '';
            break;
          case 'class':
            valueA = a.studentClass || '';
            valueB = b.studentClass || '';
            break;
          case 'organization':
            valueA = a.organization || '';
            valueB = b.organization || '';
            break;
          case 'score':
            valueA = a.score || 0;
            valueB = b.score || 0;
            break;
          case 'timeTaken':
            valueA = a.timeTaken || 0;
            valueB = b.timeTaken || 0;
            break;
          case 'examCount':
            valueA = a.examCount || 0;
            valueB = b.examCount || 0;
            break;
          case 'percentage':
          default:
            valueA = a.percentage || 0;
            valueB = b.percentage || 0;
            break;
        }

        // Apply sort direction
        if (sortDirection === 'asc') {
          return typeof valueA === 'string'
            ? valueA.localeCompare(valueB)
            : valueA - valueB;
        } else {
          return typeof valueA === 'string'
            ? valueB.localeCompare(valueA)
            : valueB - valueA;
        }
      });
  }, [
    leaderboardData,
    searchTerm,
    filterClass,
    filterOrganization,
    sortField,
    sortDirection
  ]);

  // Get top performers for the highlight section
  const topPerformers = useMemo(() => {
    return filteredAndSortedData.slice(0, 3);
  }, [filteredAndSortedData]);

  // Render the medal color based on rank
  const getMedalColor = (rank) => {
    switch (rank) {
      case 0: return theme.palette.gold || '#FFD700';
      case 1: return theme.palette.silver || '#C0C0C0';
      case 2: return theme.palette.bronze || '#CD7F32';
      default: return theme.palette.grey[500];
    }
  };

  // Format percentage for display
  const formatPercentage = (value) => {
    if (value === undefined || value === null) return 'N/A';
    return `${Math.round(value)}%`;
  };

  // Render loading skeletons for the leaderboard
  const renderSkeletons = () => (
    <Box sx={{ mt: 3 }}>
      {[...Array(5)].map((_, index) => (
        <Card
          key={`skeleton-${index}`}
          variant="outlined"
          sx={{
            mb: 2,
            borderRadius: 2,
            overflow: 'hidden'
          }}
        >
          <CardContent sx={{ p: 2 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={1}>
                <Skeleton variant="circular" width={40} height={40} />
              </Grid>
              <Grid item xs={3}>
                <Skeleton variant="text" width="80%" height={24} />
                <Skeleton variant="text" width="60%" height={20} />
              </Grid>
              <Grid item xs={2}>
                <Skeleton variant="text" width="70%" height={24} />
              </Grid>
              <Grid item xs={2}>
                <Skeleton variant="text" width="70%" height={24} />
              </Grid>
              <Grid item xs={2}>
                <Skeleton variant="rectangular" width="60%" height={30} sx={{ borderRadius: 1 }} />
              </Grid>
              <Grid item xs={2}>
                <Skeleton variant="text" width="50%" height={24} />
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      ))}
    </Box>
  );

  return (
    <Box sx={{ pb: 6 }}>
      {/* Page header */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          mb: 4,
          borderRadius: 4,
          background: 'linear-gradient(135deg, #0D406C 0%, #1A5A8C 100%)',
          color: 'white',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: -20,
            right: -20,
            width: 120,
            height: 120,
            borderRadius: '50%',
            bgcolor: 'rgba(255,255,255,0.1)'
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            bottom: -30,
            left: -30,
            width: 150,
            height: 150,
            borderRadius: '50%',
            bgcolor: 'rgba(255,255,255,0.1)'
          }}
        />
        <Box sx={{ position: 'relative', zIndex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <EmojiEventsIcon sx={{ fontSize: 32, mr: 1 }} />
            <Typography variant="h4" component="h1" fontWeight="bold">
              Student Leaderboard
            </Typography>
          </Box>
          <Typography variant="subtitle1" sx={{ opacity: 0.9, maxWidth: 700 }}>
            Track student performance across all exams or filter by specific exams to identify top performers and areas for improvement.
          </Typography>
        </Box>
      </Paper>

      {/* Error message */}
      {error && (
        <Alert
          severity="warning"
          sx={{ mb: 3, borderRadius: 2 }}
          action={
            <Button
              color="inherit"
              size="small"
              onClick={handleRefresh}
            >
              Try Again
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {/* Filters and controls */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          mb: 4,
          borderRadius: 4,
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`
        }}
      >
        <Grid container spacing={3} alignItems="center">
          {/* Exam selector */}
          <Grid item xs={12} md={4}>
            <FormControl fullWidth variant="outlined" size="small">
              <InputLabel id="exam-select-label">Select Exam</InputLabel>
              <Select
                labelId="exam-select-label"
                id="exam-select"
                value={selectedExamId}
                onChange={handleExamChange}
                label="Select Exam"
                disabled={examsLoading}
                startAdornment={
                  examsLoading ? (
                    <InputAdornment position="start">
                      <CircularProgress size={20} color="inherit" />
                    </InputAdornment>
                  ) : null
                }
              >
                {exams.map((exam) => (
                  <MenuItem key={`exam-option-${exam._id}`} value={exam._id}>
                    {exam.title}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Search field */}
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              variant="outlined"
              size="small"
              placeholder="Search students..."
              value={searchTerm}
              onChange={handleSearchChange}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                )
              }}
            />
          </Grid>

          {/* Action buttons */}
          <Grid item xs={12} md={4}>
            <Box sx={{ display: 'flex', gap: 1, justifyContent: { xs: 'flex-start', md: 'flex-end' } }}>
              <Button
                variant="outlined"
                startIcon={<FilterListIcon />}
                onClick={() => document.getElementById('advanced-filters').scrollIntoView({ behavior: 'smooth' })}
              >
                Filters
              </Button>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={handleRefresh}
                disabled={loading}
              >
                Refresh
              </Button>
            </Box>
          </Grid>

          {/* Advanced filters */}
          <Grid item xs={12} id="advanced-filters">
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
              {/* Class filter */}
              <FormControl variant="outlined" size="small" sx={{ minWidth: 150 }}>
                <InputLabel id="class-filter-label">Class</InputLabel>
                <Select
                  labelId="class-filter-label"
                  id="class-filter"
                  value={filterClass}
                  onChange={handleClassFilterChange}
                  label="Class"
                >
                  <MenuItem value="all">All Classes</MenuItem>
                  {availableClasses.map((className) => (
                    <MenuItem key={`class-option-${className}`} value={className}>
                      {className}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Organization filter */}
              <FormControl variant="outlined" size="small" sx={{ minWidth: 150 }}>
                <InputLabel id="organization-filter-label">Organization</InputLabel>
                <Select
                  labelId="organization-filter-label"
                  id="organization-filter"
                  value={filterOrganization}
                  onChange={handleOrganizationFilterChange}
                  label="Organization"
                >
                  <MenuItem value="all">All Organizations</MenuItem>
                  {availableOrganizations.map((org) => (
                    <MenuItem key={`org-option-${org}`} value={org}>
                      {org}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Sort indicators */}
              <Box sx={{ display: 'flex', alignItems: 'center', ml: 'auto' }}>
                <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
                  Sort by:
                </Typography>
                <Chip
                  label={`${sortField === 'percentage' ? 'Score' :
                          sortField === 'timeTaken' ? 'Time' :
                          sortField === 'examCount' ? 'Exams Taken' :
                          sortField === 'name' ? 'Name' :
                          sortField === 'class' ? 'Class' :
                          sortField === 'organization' ? 'Organization' : 'Score'} ${sortDirection === 'asc' ? '↑' : '↓'}`}
                  size="small"
                  color="primary"
                  variant="outlined"
                  onDelete={handleResetFilters}
                  sx={{ mr: 1 }}
                />
                <Button
                  variant="text"
                  size="small"
                  onClick={handleResetFilters}
                >
                  Reset
                </Button>
              </Box>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Top performers highlight */}
      {!loading && topPerformers.length > 0 && (
        <Fade in={true} timeout={800}>
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" fontWeight="bold" gutterBottom>
              Top Performers
            </Typography>
            <Grid container spacing={3}>
              {topPerformers.map((student, index) => (
                <Grid item xs={12} sm={4} key={`top-performer-${student.uniqueId || student.id || index}-${index}`}>
                  <Zoom in={true} style={{ transitionDelay: `${index * 100}ms` }}>
                    <Card
                      elevation={3}
                      sx={{
                        height: '100%',
                        borderRadius: 4,
                        position: 'relative',
                        overflow: 'hidden',
                        transition: 'all 0.3s ease',
                        borderTop: `4px solid ${getMedalColor(index)}`,
                        '&:hover': {
                          transform: 'translateY(-5px)',
                          boxShadow: '0 10px 20px rgba(0,0,0,0.1)'
                        }
                      }}
                    >
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                          <Avatar
                            sx={{
                              bgcolor: getMedalColor(index),
                              color: '#fff',
                              width: 40,
                              height: 40,
                              mr: 2
                            }}
                          >
                            {index + 1}
                          </Avatar>
                          <Box>
                            <Typography variant="h6" fontWeight="bold">
                              {student.name}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {student.email}
                            </Typography>
                          </Box>
                        </Box>

                        <Divider sx={{ mb: 2 }} />

                        <Grid container spacing={1}>
                          <Grid item xs={6}>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              <SchoolIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                              <Typography variant="body2">
                                {student.studentClass || 'N/A'}
                              </Typography>
                            </Box>
                          </Grid>
                          <Grid item xs={6}>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              <BusinessIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                              <Typography variant="body2">
                                {student.organization || 'N/A'}
                              </Typography>
                            </Box>
                          </Grid>
                          <Grid item xs={6}>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              <CheckCircleIcon fontSize="small" sx={{ mr: 1, color: theme.palette.success.main }} />
                              <Typography variant="body2" fontWeight="bold">
                                {formatPercentage(student.percentage)}
                              </Typography>
                            </Box>
                          </Grid>
                          <Grid item xs={6}>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              <TimerIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                              <Typography variant="body2">
                                {student.timeTaken || 'N/A'} min
                              </Typography>
                            </Box>
                          </Grid>
                        </Grid>

                        {selectedExamId === 'all' && (
                          <Chip
                            label={`${student.examCount || 0} exams taken`}
                            size="small"
                            color="primary"
                            variant="outlined"
                            sx={{ mt: 2 }}
                          />
                        )}
                      </CardContent>
                    </Card>
                  </Zoom>
                </Grid>
              ))}
            </Grid>
          </Box>
        </Fade>
      )}

      {/* Main leaderboard */}
      <Paper
        elevation={0}
        sx={{
          borderRadius: 4,
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          overflow: 'hidden'
        }}
      >
        <Box sx={{ p: 3, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
          <Typography variant="h6" fontWeight="bold">
            Student Rankings
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {filteredAndSortedData.length} students found
          </Typography>
        </Box>

        {/* Table header */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr 2fr 1fr', sm: '0.5fr 2fr 1fr 1fr 1fr 1fr' },
            p: 2,
            borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            bgcolor: alpha(theme.palette.primary.main, 0.03)
          }}
        >
          <Typography variant="subtitle2" fontWeight="bold" sx={{ display: { xs: 'none', sm: 'block' } }}>
            Rank
          </Typography>
          <Typography variant="subtitle2" fontWeight="bold">
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer'
              }}
              onClick={() => handleSortFieldChange('name')}
            >
              Student
              {sortField === 'name' && (
                sortDirection === 'asc' ? <ArrowUpwardIcon fontSize="small" sx={{ ml: 0.5 }} /> : <ArrowDownwardIcon fontSize="small" sx={{ ml: 0.5 }} />
              )}
            </Box>
          </Typography>
          <Typography variant="subtitle2" fontWeight="bold" sx={{ display: { xs: 'none', sm: 'block' } }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer'
              }}
              onClick={() => handleSortFieldChange('class')}
            >
              Class
              {sortField === 'class' && (
                sortDirection === 'asc' ? <ArrowUpwardIcon fontSize="small" sx={{ ml: 0.5 }} /> : <ArrowDownwardIcon fontSize="small" sx={{ ml: 0.5 }} />
              )}
            </Box>
          </Typography>
          <Typography variant="subtitle2" fontWeight="bold" sx={{ display: { xs: 'none', sm: 'block' } }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer'
              }}
              onClick={() => handleSortFieldChange('organization')}
            >
              Organization
              {sortField === 'organization' && (
                sortDirection === 'asc' ? <ArrowUpwardIcon fontSize="small" sx={{ ml: 0.5 }} /> : <ArrowDownwardIcon fontSize="small" sx={{ ml: 0.5 }} />
              )}
            </Box>
          </Typography>
          <Typography variant="subtitle2" fontWeight="bold">
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer'
              }}
              onClick={() => handleSortFieldChange('percentage')}
            >
              Score
              {sortField === 'percentage' && (
                sortDirection === 'asc' ? <ArrowUpwardIcon fontSize="small" sx={{ ml: 0.5 }} /> : <ArrowDownwardIcon fontSize="small" sx={{ ml: 0.5 }} />
              )}
            </Box>
          </Typography>
          <Typography variant="subtitle2" fontWeight="bold" sx={{ display: { xs: 'none', sm: 'block' } }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer'
              }}
              onClick={() => handleSortFieldChange('timeTaken')}
            >
              Time
              {sortField === 'timeTaken' && (
                sortDirection === 'asc' ? <ArrowUpwardIcon fontSize="small" sx={{ ml: 0.5 }} /> : <ArrowDownwardIcon fontSize="small" sx={{ ml: 0.5 }} />
              )}
            </Box>
          </Typography>
        </Box>

        {/* Loading state */}
        {loading && renderSkeletons()}

        {/* No results state */}
        {!loading && filteredAndSortedData.length === 0 && (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No students found
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Try adjusting your filters or search criteria
            </Typography>
            <Button variant="outlined" onClick={handleResetFilters}>
              Reset Filters
            </Button>
          </Box>
        )}

        {/* Student list */}
        {!loading && filteredAndSortedData.map((student, index) => (
          <Box
            key={`student-row-${student.uniqueId || student.id || index}-${index}`}
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr 2fr 1fr', sm: '0.5fr 2fr 1fr 1fr 1fr 1fr' },
              p: 2,
              borderBottom: `1px solid ${alpha(theme.palette.divider, 0.05)}`,
              '&:hover': {
                bgcolor: alpha(theme.palette.primary.main, 0.03)
              },
              transition: 'background-color 0.2s ease',
              bgcolor: index % 2 === 0 ? 'transparent' : alpha(theme.palette.background.default, 0.5)
            }}
          >
            {/* Rank */}
            <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center' }}>
              <Avatar
                sx={{
                  width: 32,
                  height: 32,
                  bgcolor: index < 3 ? getMedalColor(index) : alpha(theme.palette.grey[500], 0.1),
                  color: index < 3 ? '#fff' : theme.palette.text.primary,
                  fontSize: '0.875rem',
                  fontWeight: 'bold'
                }}
              >
                {index + 1}
              </Avatar>
            </Box>

            {/* Student info */}
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Avatar
                sx={{
                  width: { xs: 32, sm: 40 },
                  height: { xs: 32, sm: 40 },
                  bgcolor: theme.palette.primary.main,
                  mr: 1.5,
                  display: { xs: 'none', sm: 'flex' }
                }}
              >
                <PersonIcon />
              </Avatar>
              <Box>
                <Typography variant="body1" fontWeight="medium">
                  {student.name}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>
                  {student.email}
                </Typography>
              </Box>
            </Box>

            {/* Class */}
            <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center' }}>
              <Chip
                label={student.studentClass || 'N/A'}
                size="small"
                variant="outlined"
                icon={<ClassIcon />}
                sx={{
                  maxWidth: '100%',
                  '& .MuiChip-label': {
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }
                }}
              />
            </Box>

            {/* Organization */}
            <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center' }}>
              <Chip
                label={student.organization || 'N/A'}
                size="small"
                variant="outlined"
                icon={<BusinessIcon />}
                sx={{
                  maxWidth: '100%',
                  '& .MuiChip-label': {
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }
                }}
              />
            </Box>

            {/* Score */}
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Chip
                label={formatPercentage(student.percentage)}
                size="small"
                color={
                  student.percentage >= 90 ? 'success' :
                  student.percentage >= 70 ? 'primary' :
                  student.percentage >= 50 ? 'warning' : 'error'
                }
                sx={{ fontWeight: 'bold' }}
              />
            </Box>

            {/* Time */}
            <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center' }}>
              <Chip
                label={`${student.timeTaken || 'N/A'} min`}
                size="small"
                variant="outlined"
                icon={<TimerIcon />}
              />
            </Box>
          </Box>
        ))}
      </Paper>
    </Box>
  );
};

export default NewLeaderboardPage;
