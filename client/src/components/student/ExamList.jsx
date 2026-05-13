import React, { useState, useEffect } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Container,
  Grid,
  Typography,
  Box,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  Divider,
  TextField,
  InputAdornment,
  CircularProgress,
  Fade,
  Grow,
  Paper,
  Tab,
  Tabs,
  Alert,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Search,
  PlayArrow,
  CheckCircle,
  AccessTime,
  ArrowForward,
  FilterList,
  Sort,
  Refresh
} from '@mui/icons-material';
import api from '../../services/api';
import StudentLayout from './StudentLayout';

const ExamList = () => {
  const [exams, setExams] = useState([]);
  const [filteredExams, setFilteredExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [tabValue, setTabValue] = useState(0);
  const [sortOrder, setSortOrder] = useState('newest');

  useEffect(() => {
    fetchExams();
  }, []);

  const fetchExams = async () => {
    try {
      setLoading(true);
      setError(null);
      // Fixed API endpoint
      const res = await api.get('/student/exams');
      setExams(res.data);
      setFilteredExams(res.data);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching exams:', err);
      setError('Failed to load exams. Please try again later.');
      setLoading(false);
    }
  };

  useEffect(() => {
    // Filter exams based on search term and tab value
    let filtered = [...exams];

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(
        exam =>
          exam.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          exam.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by tab value
    if (tabValue === 1) {
      // Available exams (not started or in progress)
      filtered = filtered.filter(
        exam => exam.status === 'not-started' || exam.status === 'in-progress'
      );
    } else if (tabValue === 2) {
      // Completed exams
      filtered = filtered.filter(exam => exam.status === 'completed');
    }

    // Sort exams
    filtered.sort((a, b) => {
      if (sortOrder === 'newest') {
        return new Date(b.createdAt) - new Date(a.createdAt);
      } else if (sortOrder === 'oldest') {
        return new Date(a.createdAt) - new Date(b.createdAt);
      } else if (sortOrder === 'title-asc') {
        return a.title.localeCompare(b.title);
      } else if (sortOrder === 'title-desc') {
        return b.title.localeCompare(a.title);
      }
      return 0;
    });

    setFilteredExams(filtered);
  }, [exams, searchTerm, tabValue, sortOrder]);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleSortChange = () => {
    const orders = ['newest', 'oldest', 'title-asc', 'title-desc'];
    const currentIndex = orders.indexOf(sortOrder);
    const nextIndex = (currentIndex + 1) % orders.length;
    setSortOrder(orders[nextIndex]);
  };

  const getSortOrderLabel = () => {
    switch (sortOrder) {
      case 'newest':
        return 'Newest First';
      case 'oldest':
        return 'Oldest First';
      case 'title-asc':
        return 'Title (A-Z)';
      case 'title-desc':
        return 'Title (Z-A)';
      default:
        return 'Sort';
    }
  };

  // Function to get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'in-progress':
        return 'warning';
      case 'not-started':
        return 'info';
      default:
        return 'default';
    }
  };

  // Function to get status icon
  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle />;
      case 'in-progress':
        return <AccessTime />;
      case 'not-started':
        return <PlayArrow />;
      default:
        return null;
    }
  };

  return (
    <StudentLayout>
      <Container maxWidth="lg" sx={{ mb: 4 }}>
        <Grow in={true} timeout={800}>
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
          <Typography variant="h4" component="h1" fontWeight="bold" gutterBottom>
            Available Exams
          </Typography>
          <Typography variant="subtitle1">
            Browse and take exams assigned to you
          </Typography>
        </Paper>
      </Grow>

      {/* Filters and Search */}
      <Fade in={true} timeout={1000}>
        <Paper elevation={2} sx={{ mb: 4, p: 2, borderRadius: 2 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                variant="outlined"
                placeholder="Search exams..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search />
                    </InputAdornment>
                  ),
                  sx: { borderRadius: 30 }
                }}
                size="small"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                <Tooltip title="Change sort order">
                  <Button
                    variant="outlined"
                    startIcon={<Sort />}
                    onClick={handleSortChange}
                    size="small"
                  >
                    {getSortOrderLabel()}
                  </Button>
                </Tooltip>
                <Tooltip title="Refresh exams">
                  <IconButton onClick={fetchExams} color="primary">
                    <Refresh />
                  </IconButton>
                </Tooltip>
              </Box>
            </Grid>
          </Grid>

          <Box sx={{ mt: 2 }}>
            <Tabs
              value={tabValue}
              onChange={handleTabChange}
              indicatorColor="primary"
              textColor="primary"
              variant="fullWidth"
            >
              <Tab label="All Exams" />
              <Tab label="Available" />
              <Tab label="Completed" />
            </Tabs>
          </Box>
        </Paper>
      </Fade>

      {/* Error Alert */}
      {error && (
        <Alert
          severity="error"
          sx={{ mb: 4 }}
          action={
            <Button color="inherit" size="small" onClick={fetchExams}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {/* Exams Grid */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 8 }}>
          <CircularProgress size={60} />
        </Box>
      ) : filteredExams.length > 0 ? (
        <Grid container spacing={3}>
          {filteredExams.map((exam, index) => (
            <Grid item xs={12} md={4} key={exam._id}>
              <Grow in={true} style={{ transformOrigin: '0 0 0' }} timeout={1000 + (index * 100)}>
                <Card
                  elevation={3}
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative',
                    overflow: 'hidden',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      transform: 'translateY(-8px)',
                      boxShadow: '0 12px 20px rgba(0, 0, 0, 0.2)',
                    }
                  }}
                >
                  {/* Status indicator */}
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '5px',
                      bgcolor: exam.status === 'completed'
                        ? 'success.main'
                        : exam.status === 'in-progress'
                          ? 'warning.main'
                          : 'info.main',
                    }}
                  />

                  <CardContent sx={{ flexGrow: 1, pt: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                      <Typography variant="h5" component="h2" fontWeight="bold">
                        {exam.title}
                      </Typography>
                      <Chip
                        icon={getStatusIcon(exam.status)}
                        label={exam.status.replace('-', ' ')}
                        color={getStatusColor(exam.status)}
                        size="small"
                        sx={{ textTransform: 'capitalize' }}
                      />
                    </Box>

                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {exam.description?.substring(0, 150)}
                      {exam.description?.length > 150 ? '...' : ''}
                    </Typography>

                    <Divider sx={{ my: 2 }} />

                    <Grid container spacing={2}>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="text.secondary">
                          <strong>Time Limit:</strong>
                        </Typography>
                        <Typography variant="body1">
                          {exam.timeLimit} minutes
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="text.secondary">
                          <strong>Created By:</strong>
                        </Typography>
                        <Typography variant="body1">
                          {exam.createdBy?.fullName || 'Admin'}
                        </Typography>
                      </Grid>
                    </Grid>
                  </CardContent>

                  <CardActions sx={{ p: 2, pt: 0 }}>
                    <Button
                      variant="contained"
                      color={
                        exam.status === 'completed'
                          ? 'success'
                          : exam.status === 'in-progress'
                            ? 'warning'
                            : 'primary'
                      }
                      component={RouterLink}
                      to={`/student/exam/${exam._id}`}
                      endIcon={<ArrowForward />}
                      fullWidth
                      sx={{
                        py: 1,
                        position: 'relative',
                        overflow: 'hidden',
                        '&::after': {
                          content: '""',
                          position: 'absolute',
                          top: 0,
                          left: '-100%',
                          width: '100%',
                          height: '100%',
                          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
                          transition: 'all 0.5s',
                        },
                        '&:hover::after': {
                          left: '100%',
                        }
                      }}
                    >
                      {exam.status === 'in-progress'
                        ? 'Continue Exam'
                        : exam.status === 'completed'
                          ? 'View Results'
                          : 'Start Exam'}
                    </Button>
                  </CardActions>
                </Card>
              </Grow>
            </Grid>
          ))}
        </Grid>
      ) : (
        <Paper
          elevation={1}
          sx={{
            p: 4,
            textAlign: 'center',
            borderRadius: 2,
            bgcolor: 'background.paper'
          }}
        >
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No exams found
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {searchTerm
              ? 'Try adjusting your search or filters'
              : 'There are no exams available at the moment'}
          </Typography>
          {searchTerm && (
            <Button
              variant="outlined"
              sx={{ mt: 2 }}
              onClick={() => setSearchTerm('')}
            >
              Clear Search
            </Button>
          )}
        </Paper>
      )}
      </Container>
    </StudentLayout>
  );
};

export default ExamList;
