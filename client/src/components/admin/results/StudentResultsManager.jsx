import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Button,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Grid,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  Tooltip,
  useTheme,
  alpha,
  Avatar,
  Stack,
  Divider,
  LinearProgress,
  Badge,
  Fade,
  Zoom,
  Skeleton
} from '@mui/material';
import {
  Visibility as ViewIcon,
  Refresh as RefreshIcon,
  FilterList as FilterIcon,
  Assessment as GradeIcon,
  TrendingUp as ImprovementIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  School as SchoolIcon,
  Quiz as QuizIcon,
  Person as PersonIcon,
  Schedule as ScheduleIcon,
  Star as StarIcon,
  AutoAwesome as AIIcon,
  Speed as SpeedIcon,
  Analytics as AnalyticsIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import adminService from '../../../services/adminService';

const StudentResultsManager = () => {
  const theme = useTheme();
  const navigate = useNavigate();

  const [results, setResults] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Filters
  const [filters, setFilters] = useState({
    examId: '',
    studentId: '',
    status: '',
    sortBy: 'endTime',
    sortOrder: 'desc'
  });

  // Regrade dialog
  const [regradeDialog, setRegradeDialog] = useState({
    open: false,
    resultId: null,
    studentName: '',
    examTitle: '',
    method: 'comprehensive'
  });

  const [regrading, setRegrading] = useState(false);
  const [bulkRegrading, setBulkRegrading] = useState(false);

  useEffect(() => {
    fetchResults();
  }, [filters]);

  const fetchResults = async () => {
    try {
      setLoading(true);
      setError('');

      const queryParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) queryParams.append(key, value);
      });

      const response = await adminService.getStudentResultsForRegrade(queryParams.toString());
      setResults(response.results || []);
      setSummary(response.summary || {});
    } catch (err) {
      console.error('Error fetching student results:', err);
      setError('Failed to fetch student results');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
    setPage(0);
  };

  const handleRegrade = async () => {
    try {
      setRegrading(true);
      setError('');

      const response = await adminService.regradeStudentResult(regradeDialog.resultId, {
        method: regradeDialog.method,
        forceRegrade: true
      });

      if (response && response.result) {
        const { newScore, maxScore, improvement, method } = response.result;
        const percentage = Math.round((newScore / maxScore) * 100);

        if (improvement > 0) {
          setSuccess(
            `✅ Successfully regraded ${regradeDialog.studentName}'s result for ${regradeDialog.examTitle}! ` +
            `Score improved by ${improvement.toFixed(1)} points (${newScore}/${maxScore} - ${percentage}%) using ${method} method.`
          );
        } else if (improvement < 0) {
          setSuccess(
            `⚠️ Regraded ${regradeDialog.studentName}'s result for ${regradeDialog.examTitle}. ` +
            `Score changed by ${improvement.toFixed(1)} points (${newScore}/${maxScore} - ${percentage}%) using ${method} method.`
          );
        } else {
          setSuccess(
            `✓ Regraded ${regradeDialog.studentName}'s result for ${regradeDialog.examTitle}. ` +
            `Score remained the same (${newScore}/${maxScore} - ${percentage}%) using ${method} method.`
          );
        }
      } else {
        setSuccess(`Successfully regraded ${regradeDialog.studentName}'s result for ${regradeDialog.examTitle}`);
      }

      setRegradeDialog({ open: false, resultId: null, studentName: '', examTitle: '', method: 'comprehensive' });

      // Refresh results
      fetchResults();
    } catch (err) {
      console.error('Error regrading result:', err);
      setError('Failed to regrade result: ' + (err.response?.data?.message || err.message));
    } finally {
      setRegrading(false);
    }
  };

  const openRegradeDialog = (result) => {
    setRegradeDialog({
      open: true,
      resultId: result._id,
      studentName: result.student.name,
      examTitle: result.exam.title,
      method: 'comprehensive'
    });
  };

  const handleBulkRegrade = async () => {
    try {
      setBulkRegrading(true);
      setError('');

      // Get all visible results (filtered results)
      const resultIds = results.map(result => result._id);

      if (resultIds.length === 0) {
        setError('No results to regrade');
        return;
      }

      // Call the bulk regrade API through adminService
      const response = await adminService.bulkRegradeResults(resultIds, 'comprehensive', true);

      setSuccess(`Bulk regrading started for ${resultIds.length} results. This may take a few minutes.`);

      // Refresh results after a delay
      setTimeout(() => {
        fetchResults();
      }, 5000);

    } catch (err) {
      console.error('Error starting bulk regrade:', err);
      setError('Failed to start bulk regrading: ' + (err.response?.data?.message || err.message));
    } finally {
      setBulkRegrading(false);
    }
  };

  const getStatusChip = (result) => {
    if (result.grading.potentialImprovement) {
      return (
        <Chip
          icon={<ImprovementIcon />}
          label="Potential Improvement"
          color="warning"
          size="small"
          variant="outlined"
        />
      );
    }

    if (result.grading.needsReview) {
      return (
        <Chip
          icon={<WarningIcon />}
          label="Needs Review"
          color="error"
          size="small"
          variant="outlined"
        />
      );
    }

    if (result.grading.aiGradingStatus === 'completed') {
      return (
        <Chip
          icon={<CheckIcon />}
          label="AI Graded"
          color="success"
          size="small"
          variant="outlined"
        />
      );
    }

    return (
      <Chip
        label="Pending"
        color="default"
        size="small"
        variant="outlined"
      />
    );
  };

  const getPerformanceColor = (percentage) => {
    if (percentage >= 90) return theme.palette.success.main;
    if (percentage >= 70) return theme.palette.info.main;
    if (percentage >= 50) return theme.palette.warning.main;
    return theme.palette.error.main;
  };

  const formatScore = (totalScore, maxScore, percentage) => (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <Typography variant="body2" fontWeight="bold" color={getPerformanceColor(percentage)}>
        {totalScore}/{maxScore}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {percentage}%
      </Typography>
    </Box>
  );

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom fontWeight="bold">
        Student Results Management
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Review and regrade student exam results
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      {/* Enhanced Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Zoom in={true} style={{ transitionDelay: '100ms' }}>
            <Card
              elevation={0}
              sx={{
                border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, ${alpha(theme.palette.primary.main, 0.02)} 100%)`,
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: theme.shadows[8],
                  border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`
                }
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <Avatar
                    sx={{
                      bgcolor: theme.palette.primary.main,
                      width: 48,
                      height: 48
                    }}
                  >
                    <AnalyticsIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="h4" fontWeight="bold" color="primary">
                      {loading ? <Skeleton width={40} /> : (summary.totalResults || 0)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" fontWeight="medium">
                      Total Results
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Zoom>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Zoom in={true} style={{ transitionDelay: '200ms' }}>
            <Card
              elevation={0}
              sx={{
                border: `1px solid ${alpha(theme.palette.warning.main, 0.2)}`,
                background: `linear-gradient(135deg, ${alpha(theme.palette.warning.main, 0.05)} 0%, ${alpha(theme.palette.warning.main, 0.02)} 100%)`,
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: theme.shadows[8],
                  border: `1px solid ${alpha(theme.palette.warning.main, 0.3)}`
                }
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <Badge badgeContent={summary.needsReview || 0} color="warning" max={99}>
                    <Avatar
                      sx={{
                        bgcolor: theme.palette.warning.main,
                        width: 48,
                        height: 48
                      }}
                    >
                      <WarningIcon />
                    </Avatar>
                  </Badge>
                  <Box>
                    <Typography variant="h4" fontWeight="bold" color="warning.main">
                      {loading ? <Skeleton width={40} /> : (summary.needsReview || 0)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" fontWeight="medium">
                      Need Review
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Zoom>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Zoom in={true} style={{ transitionDelay: '300ms' }}>
            <Card
              elevation={0}
              sx={{
                border: `1px solid ${alpha(theme.palette.success.main, 0.2)}`,
                background: `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.05)} 0%, ${alpha(theme.palette.success.main, 0.02)} 100%)`,
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: theme.shadows[8],
                  border: `1px solid ${alpha(theme.palette.success.main, 0.3)}`
                }
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <Avatar
                    sx={{
                      bgcolor: theme.palette.success.main,
                      width: 48,
                      height: 48
                    }}
                  >
                    <ImprovementIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="h4" fontWeight="bold" color="success.main">
                      {loading ? <Skeleton width={40} /> : (summary.potentialImprovements || 0)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" fontWeight="medium">
                      Can Improve
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Zoom>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Zoom in={true} style={{ transitionDelay: '400ms' }}>
            <Card
              elevation={0}
              sx={{
                border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`,
                background: `linear-gradient(135deg, ${alpha(theme.palette.info.main, 0.05)} 0%, ${alpha(theme.palette.info.main, 0.02)} 100%)`,
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: theme.shadows[8],
                  border: `1px solid ${alpha(theme.palette.info.main, 0.3)}`
                }
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <Avatar
                    sx={{
                      bgcolor: theme.palette.info.main,
                      width: 48,
                      height: 48
                    }}
                  >
                    <StarIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="h4" fontWeight="bold" color="info.main">
                      {loading ? <Skeleton width={40} /> : `${summary.averageScore || 0}%`}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" fontWeight="medium">
                      Average Score
                    </Typography>
                  </Box>
                </Stack>
                {!loading && (
                  <LinearProgress
                    variant="determinate"
                    value={summary.averageScore || 0}
                    sx={{
                      mt: 2,
                      height: 6,
                      borderRadius: 3,
                      bgcolor: alpha(theme.palette.info.main, 0.1)
                    }}
                  />
                )}
              </CardContent>
            </Card>
          </Zoom>
        </Grid>
      </Grid>

      {/* Enhanced Filters */}
      <Fade in={true}>
        <Paper
          elevation={0}
          sx={{
            p: 3,
            mb: 3,
            border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            borderRadius: 2,
            background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.8)} 0%, ${alpha(theme.palette.background.default, 0.4)} 100%)`
          }}
        >
          <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
            <Avatar sx={{ bgcolor: theme.palette.primary.main, width: 32, height: 32 }}>
              <FilterIcon fontSize="small" />
            </Avatar>
            <Typography variant="h6" fontWeight="bold">
              Filter & Sort Results
            </Typography>
          </Stack>

          <Grid container spacing={3} alignItems="center">
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Status Filter</InputLabel>
                <Select
                  value={filters.status}
                  label="Status Filter"
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        boxShadow: theme.shadows[2]
                      }
                    }
                  }}
                >
                  <MenuItem value="">
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <AnalyticsIcon fontSize="small" />
                      <span>All Results</span>
                    </Stack>
                  </MenuItem>
                  <MenuItem value="needs-grading">
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <WarningIcon fontSize="small" color="warning" />
                      <span>Needs Grading</span>
                    </Stack>
                  </MenuItem>
                  <MenuItem value="low-scores">
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <ImprovementIcon fontSize="small" color="error" />
                      <span>Low Scores (&lt;70%)</span>
                    </Stack>
                  </MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Sort By</InputLabel>
                <Select
                  value={filters.sortBy}
                  label="Sort By"
                  onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        boxShadow: theme.shadows[2]
                      }
                    }
                  }}
                >
                  <MenuItem value="endTime">
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <ScheduleIcon fontSize="small" />
                      <span>Date Completed</span>
                    </Stack>
                  </MenuItem>
                  <MenuItem value="totalScore">
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <StarIcon fontSize="small" />
                      <span>Score</span>
                    </Stack>
                  </MenuItem>
                  <MenuItem value="student.name">
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <PersonIcon fontSize="small" />
                      <span>Student Name</span>
                    </Stack>
                  </MenuItem>
                  <MenuItem value="exam.title">
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <QuizIcon fontSize="small" />
                      <span>Exam Title</span>
                    </Stack>
                  </MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Order</InputLabel>
                <Select
                  value={filters.sortOrder}
                  label="Order"
                  onChange={(e) => handleFilterChange('sortOrder', e.target.value)}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        boxShadow: theme.shadows[2]
                      }
                    }
                  }}
                >
                  <MenuItem value="desc">Descending</MenuItem>
                  <MenuItem value="asc">Ascending</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6} md={2}>
              <Button
                variant="contained"
                startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />}
                onClick={fetchResults}
                disabled={loading}
                fullWidth
                sx={{
                  borderRadius: 2,
                  textTransform: 'none',
                  fontWeight: 'bold',
                  py: 1.2,
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: theme.shadows[6]
                  }
                }}
              >
                Refresh
              </Button>
            </Grid>

            <Grid item xs={12} sm={6} md={2}>
              <Button
                variant="outlined"
                startIcon={bulkRegrading ? <CircularProgress size={16} color="inherit" /> : <AIIcon />}
                onClick={handleBulkRegrade}
                disabled={bulkRegrading || results.length === 0}
                fullWidth
                sx={{
                  borderRadius: 2,
                  textTransform: 'none',
                  fontWeight: 'bold',
                  py: 1.2,
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: theme.shadows[4]
                  }
                }}
              >
                {bulkRegrading ? 'Regrading...' : 'Bulk Regrade'}
              </Button>
            </Grid>
          </Grid>
        </Paper>
      </Fade>

      {/* Enhanced Results Table */}
      <Fade in={true}>
        <Paper
          elevation={0}
          sx={{
            border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            overflow: 'hidden',
            borderRadius: 2,
            background: theme.palette.background.paper
          }}
        >
          {loading ? (
            <Box sx={{ p: 4 }}>
              <Stack spacing={2}>
                {[...Array(5)].map((_, index) => (
                  <Skeleton key={index} variant="rectangular" height={60} sx={{ borderRadius: 1 }} />
                ))}
              </Stack>
            </Box>
          ) : results.length === 0 ? (
            <Box sx={{ p: 6, textAlign: 'center' }}>
              <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1), width: 64, height: 64, mx: 'auto', mb: 2 }}>
                <QuizIcon sx={{ fontSize: 32, color: theme.palette.primary.main }} />
              </Avatar>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No exam results found
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Try adjusting your filters or check if students have completed any exams.
              </Typography>
              <Button
                variant="contained"
                startIcon={<RefreshIcon />}
                onClick={fetchResults}
                sx={{ borderRadius: 2 }}
              >
                Refresh Results
              </Button>
            </Box>
          ) : (
            <>
              <TableContainer>
                <Table>
                  <TableHead
                    sx={{
                      background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)} 0%, ${alpha(theme.palette.primary.main, 0.04)} 100%)`
                    }}
                  >
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold', py: 2 }}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <PersonIcon fontSize="small" />
                          <span>Student</span>
                        </Stack>
                      </TableCell>
                      <TableCell sx={{ fontWeight: 'bold', py: 2 }}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <QuizIcon fontSize="small" />
                          <span>Exam</span>
                        </Stack>
                      </TableCell>
                      <TableCell align="center" sx={{ fontWeight: 'bold', py: 2 }}>
                        <Stack direction="row" alignItems="center" justifyContent="center" spacing={1}>
                          <StarIcon fontSize="small" />
                          <span>Score</span>
                        </Stack>
                      </TableCell>
                      <TableCell align="center" sx={{ fontWeight: 'bold', py: 2 }}>Grade</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 'bold', py: 2 }}>Status</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 'bold', py: 2 }}>
                        <Stack direction="row" alignItems="center" justifyContent="center" spacing={1}>
                          <ScheduleIcon fontSize="small" />
                          <span>Date</span>
                        </Stack>
                      </TableCell>
                      <TableCell align="center" sx={{ fontWeight: 'bold', py: 2 }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {results.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((result, index) => (
                      <TableRow
                        key={result._id}
                        hover
                        sx={{
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            backgroundColor: alpha(theme.palette.primary.main, 0.02),
                            transform: 'scale(1.001)'
                          }
                        }}
                      >
                        <TableCell sx={{ py: 2 }}>
                          <Stack direction="row" alignItems="center" spacing={2}>
                            <Avatar
                              sx={{
                                bgcolor: alpha(theme.palette.primary.main, 0.1),
                                color: theme.palette.primary.main,
                                width: 40,
                                height: 40
                              }}
                            >
                              {result.student.name.charAt(0).toUpperCase()}
                            </Avatar>
                            <Box>
                              <Typography variant="body2" fontWeight="medium">
                                {result.student.name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {result.student.email}
                              </Typography>
                              {result.student.studentClass && (
                                <Typography variant="caption" color="text.secondary" display="block">
                                  Class: {result.student.studentClass}
                                </Typography>
                              )}
                            </Box>
                          </Stack>
                        </TableCell>

                        <TableCell sx={{ py: 2 }}>
                          <Box>
                            <Typography variant="body2" fontWeight="medium">
                              {result.exam.title}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Max: {result.scores.maxPossibleScore} points
                            </Typography>
                          </Box>
                        </TableCell>

                        <TableCell align="center" sx={{ py: 2 }}>
                          <Stack alignItems="center" spacing={1}>
                            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                              <Typography variant="h6" fontWeight="bold" color={getPerformanceColor(result.scores.percentage)}>
                                {result.scores.totalScore}/{result.scores.maxPossibleScore}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {result.scores.percentage}%
                              </Typography>
                            </Box>
                            <LinearProgress
                              variant="determinate"
                              value={result.scores.percentage}
                              sx={{
                                width: 60,
                                height: 4,
                                borderRadius: 2,
                                bgcolor: alpha(getPerformanceColor(result.scores.percentage), 0.1),
                                '& .MuiLinearProgress-bar': {
                                  bgcolor: getPerformanceColor(result.scores.percentage)
                                }
                              }}
                            />
                          </Stack>
                        </TableCell>

                        <TableCell align="center" sx={{ py: 2 }}>
                          <Chip
                            label={result.grade}
                            size="small"
                            sx={{
                              backgroundColor: alpha(getPerformanceColor(result.scores.percentage), 0.1),
                              color: getPerformanceColor(result.scores.percentage),
                              fontWeight: 'bold',
                              minWidth: 40
                            }}
                          />
                        </TableCell>

                        <TableCell align="center" sx={{ py: 2 }}>
                          {getStatusChip(result)}
                        </TableCell>

                        <TableCell align="center" sx={{ py: 2 }}>
                          <Box>
                            <Typography variant="body2" fontWeight="medium">
                              {new Date(result.timing.endTime).toLocaleDateString()}
                            </Typography>
                            <Stack direction="row" alignItems="center" justifyContent="center" spacing={0.5}>
                              <SpeedIcon fontSize="small" color="action" />
                              <Typography variant="caption" color="text.secondary">
                                {result.timing.timeTaken}min
                              </Typography>
                            </Stack>
                          </Box>
                        </TableCell>

                        <TableCell align="center" sx={{ py: 2 }}>
                          <Stack direction="row" justifyContent="center" spacing={1}>
                            <Tooltip title="View Detailed Results" arrow>
                              <IconButton
                                size="small"
                                onClick={() => navigate(`/admin/results/${result._id}`)}
                                sx={{
                                  color: theme.palette.info.main,
                                  transition: 'all 0.2s ease',
                                  '&:hover': {
                                    backgroundColor: alpha(theme.palette.info.main, 0.1),
                                    transform: 'scale(1.1)'
                                  }
                                }}
                              >
                                <ViewIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>

                            <Tooltip title="Regrade with AI" arrow>
                              <IconButton
                                size="small"
                                onClick={() => openRegradeDialog(result)}
                                sx={{
                                  color: theme.palette.warning.main,
                                  transition: 'all 0.2s ease',
                                  '&:hover': {
                                    backgroundColor: alpha(theme.palette.warning.main, 0.1),
                                    transform: 'scale(1.1)'
                                  }
                                }}
                              >
                                <GradeIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <TablePagination
                component="div"
                count={results.length}
                page={page}
                onPageChange={(event, newPage) => setPage(newPage)}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={(event) => {
                  setRowsPerPage(parseInt(event.target.value, 10));
                  setPage(0);
                }}
                rowsPerPageOptions={[5, 10, 25, 50]}
                sx={{
                  borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                  bgcolor: alpha(theme.palette.background.default, 0.3)
                }}
              />
            </>
          )}
        </Paper>
      </Fade>

      {/* Enhanced Regrade Dialog */}
      <Dialog
        open={regradeDialog.open}
        onClose={() => setRegradeDialog({ ...regradeDialog, open: false })}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            background: `linear-gradient(135deg, ${theme.palette.background.paper} 0%, ${alpha(theme.palette.primary.main, 0.02)} 100%)`
          }
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Avatar sx={{ bgcolor: theme.palette.warning.main, width: 48, height: 48 }}>
              <AIIcon />
            </Avatar>
            <Box>
              <Typography variant="h5" fontWeight="bold">
                AI Regrade Exam Result
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Improve scoring accuracy with enhanced AI grading
              </Typography>
            </Box>
          </Stack>
        </DialogTitle>

        <Divider />

        <DialogContent sx={{ py: 3 }}>
          {/* Student and Exam Info */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} md={6}>
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                  borderRadius: 2,
                  background: alpha(theme.palette.primary.main, 0.05)
                }}
              >
                <Stack direction="row" alignItems="center" spacing={2}>
                  <Avatar sx={{ bgcolor: theme.palette.primary.main }}>
                    <PersonIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      Student
                    </Typography>
                    <Typography variant="h6" fontWeight="bold">
                      {regradeDialog.studentName}
                    </Typography>
                  </Box>
                </Stack>
              </Paper>
            </Grid>

            <Grid item xs={12} md={6}>
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`,
                  borderRadius: 2,
                  background: alpha(theme.palette.info.main, 0.05)
                }}
              >
                <Stack direction="row" alignItems="center" spacing={2}>
                  <Avatar sx={{ bgcolor: theme.palette.info.main }}>
                    <QuizIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      Exam
                    </Typography>
                    <Typography variant="h6" fontWeight="bold">
                      {regradeDialog.examTitle}
                    </Typography>
                  </Box>
                </Stack>
              </Paper>
            </Grid>
          </Grid>

          {/* Regrading Method Selection */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom fontWeight="bold">
              Select Regrading Method
            </Typography>
            <FormControl fullWidth>
              <Select
                value={regradeDialog.method}
                onChange={(e) => setRegradeDialog({ ...regradeDialog, method: e.target.value })}
                sx={{
                  borderRadius: 2,
                  '& .MuiOutlinedInput-root': {
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      boxShadow: theme.shadows[2]
                    }
                  }
                }}
              >
                <MenuItem value="comprehensive">
                  <Stack direction="row" alignItems="center" spacing={2} sx={{ py: 1 }}>
                    <Avatar sx={{ bgcolor: theme.palette.success.main, width: 32, height: 32 }}>
                      <AIIcon fontSize="small" />
                    </Avatar>
                    <Box>
                      <Typography variant="body1" fontWeight="bold">
                        Comprehensive AI Grading
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Enhanced semantic matching & improved algorithms
                      </Typography>
                    </Box>
                  </Stack>
                </MenuItem>
                <MenuItem value="ai">
                  <Stack direction="row" alignItems="center" spacing={2} sx={{ py: 1 }}>
                    <Avatar sx={{ bgcolor: theme.palette.warning.main, width: 32, height: 32 }}>
                      <GradeIcon fontSize="small" />
                    </Avatar>
                    <Box>
                      <Typography variant="body1" fontWeight="bold">
                        Standard AI Grading
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Regular AI grading system
                      </Typography>
                    </Box>
                  </Stack>
                </MenuItem>
              </Select>
            </FormControl>
          </Box>

          {/* Information Alert */}
          <Alert
            severity="info"
            icon={<AIIcon />}
            sx={{
              borderRadius: 2,
              border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`
            }}
          >
            <Typography variant="body2" fontWeight="medium" gutterBottom>
              AI Regrading Benefits:
            </Typography>
            <Box component="ul" sx={{ m: 0, pl: 2 }}>
              <li>
                <Typography variant="body2">
                  <strong>Semantic Recognition:</strong> Recognizes equivalent answers (e.g., "CPU" = "Central Processing Unit")
                </Typography>
              </li>
              <li>
                <Typography variant="body2">
                  <strong>Improved Accuracy:</strong> Better scoring for technical terms and abbreviations
                </Typography>
              </li>
              <li>
                <Typography variant="body2">
                  <strong>Fair Assessment:</strong> Ensures students get credit for correct knowledge
                </Typography>
              </li>
            </Box>
          </Alert>
        </DialogContent>

        <Divider />

        <DialogActions sx={{ p: 3 }}>
          <Button
            onClick={() => setRegradeDialog({ ...regradeDialog, open: false })}
            variant="outlined"
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 'bold',
              px: 3
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleRegrade}
            variant="contained"
            disabled={regrading}
            startIcon={regrading ? <CircularProgress size={20} color="inherit" /> : <AIIcon />}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 'bold',
              px: 4,
              background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
              '&:hover': {
                background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`,
                transform: 'translateY(-2px)',
                boxShadow: theme.shadows[8]
              }
            }}
          >
            {regrading ? 'AI Regrading in Progress...' : 'Start AI Regrade'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default StudentResultsManager;
