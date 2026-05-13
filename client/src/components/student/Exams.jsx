import React, { useState, useEffect } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  CardMedia,
  CardActions,
  Button,
  Chip,
  Divider,
  CircularProgress,
  Alert,
  TextField,
  InputAdornment,
  IconButton,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Pagination,
  useTheme,
  Tooltip,
  Avatar,
  LinearProgress,
  Badge
} from '@mui/material';
import {
  Search,
  FilterList,
  Sort,
  AccessTime,
  School,
  Assignment,
  CheckCircle,
  PlayArrow,
  ArrowForward,
  CalendarToday,
  LockOutlined,
  Lock,
  Refresh,
  CheckBox,
  Info,
  Star,
  TrendingUp,
  QuestionAnswer,
  Timer,
  Grade
} from '@mui/icons-material';
import { styled, alpha } from '@mui/material/styles';
import { useThemeMode } from '../../context/ThemeContext';
import StudentLayout from './StudentLayout';
import api from '../../services/api';

// Styled components for enhanced exam cards
const ExamCard = styled(Card, {
  shouldForwardProp: (prop) => !['status', 'isLocked', 'allowSelectiveAnswering'].includes(prop),
})(({ theme, status, isLocked, allowSelectiveAnswering }) => {
  const isDark = theme.palette.mode === 'dark';

  return {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    borderRadius: '16px',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: isDark
      ? alpha(theme.palette.background.paper, 0.95)
      : theme.palette.background.paper,
    backdropFilter: 'blur(10px)',
    border: isDark
      ? `1px solid ${alpha(theme.palette.divider, 0.2)}`
      : allowSelectiveAnswering
        ? `2px solid ${alpha(theme.palette.secondary.main, 0.3)}`
        : 'none',
    boxShadow: isDark
      ? allowSelectiveAnswering
        ? `0 8px 32px ${alpha(theme.palette.secondary.main, 0.2)}`
        : '0 8px 32px rgba(0,0,0,0.3)'
      : allowSelectiveAnswering
        ? `0 4px 20px ${alpha(theme.palette.secondary.main, 0.15)}`
        : '0 4px 20px rgba(0,0,0,0.08)',
    '&:hover': {
      transform: 'translateY(-8px) scale(1.02)',
      boxShadow: isDark
        ? allowSelectiveAnswering
          ? `0 16px 48px ${alpha(theme.palette.secondary.main, 0.3)}`
          : '0 16px 48px rgba(0,0,0,0.4)'
        : allowSelectiveAnswering
          ? `0 12px 32px ${alpha(theme.palette.secondary.main, 0.25)}`
          : '0 12px 32px rgba(0,0,0,0.15)',
    },
    ...(isLocked && {
      opacity: 0.7,
      '&::after': {
        content: '""',
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: isDark ? 'rgba(0, 0, 0, 0.3)' : 'rgba(0, 0, 0, 0.1)',
        zIndex: 1,
        pointerEvents: 'none'
      }
    })
  };
});

const Exams = () => {
  const theme = useTheme();
  const { mode } = useThemeMode();
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('date');
  const [page, setPage] = useState(1);
  const examsPerPage = 6;

  useEffect(() => {
    const fetchExams = async () => {
      try {
        setLoading(true);
        const response = await api.get('/student/exams');
        console.log('Exams data from API:', response.data);

        // Check if selective answering data is present
        const hasSelectiveAnswering = response.data.some(exam => exam.allowSelectiveAnswering === true);
        console.log('Any exam has selective answering?', hasSelectiveAnswering);

        if (response.data.length > 0) {
          console.log('First exam fields:', Object.keys(response.data[0]));
          console.log('First exam selective answering:', response.data[0].allowSelectiveAnswering);
        }

        setExams(response.data);
        setError(null);
      } catch (err) {
        console.error('Error fetching exams:', err);
        setError('Failed to load exams. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchExams();
  }, []);

  // Filter and sort exams
  const filteredExams = exams
    .filter(exam => {
      // Apply search filter
      if (searchTerm && !exam.title.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }

      // Apply status filter
      if (filterStatus !== 'all' && exam.status !== filterStatus) {
        return false;
      }

      return true;
    })
    .sort((a, b) => {
      // Apply sorting
      if (sortBy === 'date') {
        return new Date(b.createdAt) - new Date(a.createdAt);
      } else if (sortBy === 'title') {
        return a.title.localeCompare(b.title);
      } else if (sortBy === 'duration') {
        return a.timeLimit - b.timeLimit;
      }
      return 0;
    });

  // Pagination
  const totalPages = Math.ceil(filteredExams.length / examsPerPage);
  const displayedExams = filteredExams.slice(
    (page - 1) * examsPerPage,
    page * examsPerPage
  );

  // Function to get status color
  const getStatusColor = (status, isLocked) => {
    if (isLocked) return 'error';

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
  const getStatusIcon = (status, isLocked) => {
    if (isLocked) return <Lock />;

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
      <Container maxWidth="lg" sx={{ mb: 8 }}>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" fontWeight="bold" gutterBottom>
            Available Exams
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Browse and take your assigned exams
          </Typography>
        </Box>

        {/* Filters and Search */}
        <Box sx={{ mb: 4, display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          <TextField
            placeholder="Search exams..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{ flexGrow: 1, minWidth: { xs: '100%', sm: 'auto' } }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            }}
            size="small"
          />

          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel id="filter-status-label">Status</InputLabel>
            <Select
              labelId="filter-status-label"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              label="Status"
              startAdornment={
                <InputAdornment position="start">
                  <FilterList fontSize="small" />
                </InputAdornment>
              }
            >
              <MenuItem value="all">All Statuses</MenuItem>
              <MenuItem value="not-started">Not Started</MenuItem>
              <MenuItem value="in-progress">In Progress</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
              <MenuItem value="locked">Locked</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel id="sort-by-label">Sort By</InputLabel>
            <Select
              labelId="sort-by-label"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              label="Sort By"
              startAdornment={
                <InputAdornment position="start">
                  <Sort fontSize="small" />
                </InputAdornment>
              }
            >
              <MenuItem value="date">Date (Newest)</MenuItem>
              <MenuItem value="title">Title (A-Z)</MenuItem>
              <MenuItem value="duration">Duration</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {/* Exams Grid */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 8 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ my: 4 }}>
            {error}
          </Alert>
        ) : displayedExams.length === 0 ? (
          <Box sx={{ textAlign: 'center', my: 8 }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No exams found
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Try adjusting your search or filters
            </Typography>
          </Box>
        ) : (
          <>
            <Grid container spacing={3}>
              {displayedExams.map((exam) => (
                <Grid item xs={12} sm={6} md={4} key={exam._id}>
                  <ExamCard
                    elevation={mode === 'dark' ? 8 : 3}
                    status={exam.status}
                    isLocked={exam.isLocked}
                    allowSelectiveAnswering={exam.allowSelectiveAnswering}
                  >
                    {/* Enhanced Header Section */}
                    <Box
                      sx={{
                        position: 'relative',
                        height: 160,
                        overflow: 'hidden',
                        background: exam.allowSelectiveAnswering
                          ? `linear-gradient(135deg, ${alpha(theme.palette.secondary.main, 0.8)}, ${alpha(theme.palette.secondary.dark, 0.9)})`
                          : exam.status === 'completed'
                            ? `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.8)}, ${alpha(theme.palette.success.dark, 0.9)})`
                            : exam.status === 'in-progress'
                              ? `linear-gradient(135deg, ${alpha(theme.palette.warning.main, 0.8)}, ${alpha(theme.palette.warning.dark, 0.9)})`
                              : `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.8)}, ${alpha(theme.palette.primary.dark, 0.9)})`,
                        '&::before': {
                          content: '""',
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: '100%',
                          background: mode === 'dark'
                            ? 'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.1) 0%, transparent 50%)'
                            : 'radial-gradient(circle at 70% 80%, rgba(255,255,255,0.3) 0%, transparent 50%)',
                          zIndex: 1
                        }
                      }}
                    >
                      {/* Exam Icon/Avatar */}
                      <Box
                        sx={{
                          position: 'absolute',
                          top: 16,
                          left: 16,
                          zIndex: 3
                        }}
                      >
                        <Avatar
                          sx={{
                            width: 48,
                            height: 48,
                            bgcolor: 'rgba(255, 255, 255, 0.2)',
                            backdropFilter: 'blur(10px)',
                            border: '2px solid rgba(255, 255, 255, 0.3)',
                            color: 'white'
                          }}
                        >
                          {exam.status === 'completed' ? <CheckCircle /> :
                           exam.status === 'in-progress' ? <Timer /> :
                           <QuestionAnswer />}
                        </Avatar>
                      </Box>

                      {/* Title and Status */}
                      <Box
                        sx={{
                          position: 'absolute',
                          bottom: 0,
                          left: 0,
                          width: '100%',
                          p: 2,
                          background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
                          zIndex: 2
                        }}
                      >
                        <Typography
                          variant="h6"
                          component="h3"
                          sx={{
                            color: 'white',
                            fontWeight: 'bold',
                            textAlign: 'left',
                            textShadow: '0 2px 8px rgba(0,0,0,0.8)',
                            mb: 0.5,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {exam.title}
                        </Typography>

                        {/* Progress indicator for in-progress exams */}
                        {exam.status === 'in-progress' && (
                          <LinearProgress
                            variant="determinate"
                            value={65} // You can calculate actual progress
                            sx={{
                              height: 4,
                              borderRadius: 2,
                              bgcolor: 'rgba(255,255,255,0.3)',
                              '& .MuiLinearProgress-bar': {
                                bgcolor: 'white',
                                borderRadius: 2
                              }
                            }}
                          />
                        )}
                      </Box>
                      {/* Enhanced Status Chip */}
                      <Chip
                        icon={getStatusIcon(exam.status, exam.isLocked)}
                        label={exam.isLocked ? 'Locked' : exam.status.replace('-', ' ')}
                        size="small"
                        sx={{
                          position: 'absolute',
                          top: 16,
                          right: 16,
                          textTransform: 'capitalize',
                          borderRadius: '12px',
                          zIndex: 3,
                          fontWeight: 'bold',
                          bgcolor: exam.isLocked
                            ? alpha(theme.palette.error.main, 0.9)
                            : exam.status === 'completed'
                              ? alpha(theme.palette.success.main, 0.9)
                              : exam.status === 'in-progress'
                                ? alpha(theme.palette.warning.main, 0.9)
                                : alpha(theme.palette.info.main, 0.9),
                          color: 'white',
                          backdropFilter: 'blur(10px)',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          boxShadow: mode === 'dark'
                            ? '0 4px 12px rgba(0,0,0,0.3)'
                            : '0 2px 8px rgba(0,0,0,0.2)',
                          '& .MuiChip-icon': {
                            color: 'white'
                          }
                        }}
                      />

                      {/* Enhanced Selective Answering Badge */}
                      {exam.allowSelectiveAnswering && (
                        <Badge
                          badgeContent={<Star sx={{ fontSize: 12 }} />}
                          sx={{
                            position: 'absolute',
                            top: 72,
                            right: 16,
                            zIndex: 3,
                            '& .MuiBadge-badge': {
                              bgcolor: alpha(theme.palette.secondary.main, 0.9),
                              color: 'white',
                              borderRadius: '50%',
                              width: 24,
                              height: 24,
                              border: '2px solid rgba(255, 255, 255, 0.3)',
                              backdropFilter: 'blur(10px)'
                            }
                          }}
                        >
                          <Chip
                            icon={<CheckBox fontSize="small" />}
                            label="Selective"
                            size="small"
                            sx={{
                              borderRadius: '12px',
                              fontWeight: 'bold',
                              bgcolor: alpha(theme.palette.secondary.main, 0.9),
                              color: 'white',
                              backdropFilter: 'blur(10px)',
                              border: '1px solid rgba(255, 255, 255, 0.2)',
                              boxShadow: mode === 'dark'
                                ? '0 4px 12px rgba(156, 39, 176, 0.3)'
                                : '0 2px 8px rgba(156, 39, 176, 0.2)',
                              '& .MuiChip-icon': {
                                color: 'white'
                              }
                            }}
                          />
                        </Badge>
                      )}
                    </Box>

                    <CardContent sx={{ flexGrow: 1, p: 3 }}>
                      {/* Enhanced Selective Answering Banner */}
                      {exam.allowSelectiveAnswering && (
                        <Box
                          sx={{
                            mb: 2,
                            p: 1.5,
                            bgcolor: mode === 'dark'
                              ? alpha(theme.palette.secondary.main, 0.15)
                              : alpha(theme.palette.secondary.main, 0.08),
                            borderLeft: `4px solid ${theme.palette.secondary.main}`,
                            borderRadius: '0 8px 8px 0',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            border: mode === 'dark'
                              ? `1px solid ${alpha(theme.palette.secondary.main, 0.3)}`
                              : 'none',
                            boxShadow: mode === 'dark'
                              ? `0 2px 8px ${alpha(theme.palette.secondary.main, 0.2)}`
                              : '0 1px 4px rgba(0,0,0,0.1)'
                          }}
                        >
                          <CheckBox fontSize="small" color="secondary" />
                          <Typography
                            variant="caption"
                            sx={{
                              fontWeight: 'bold',
                              color: theme.palette.secondary.main,
                              textTransform: 'uppercase',
                              letterSpacing: 0.5
                            }}
                          >
                            Selective Answering Exam
                          </Typography>
                        </Box>
                      )}

                      {/* Enhanced Description */}
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          mb: 2,
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          height: '4.5em',
                          lineHeight: 1.5,
                          fontSize: '0.875rem'
                        }}
                      >
                        {exam.description || 'No description available for this exam.'}
                      </Typography>

                      {/* Enhanced Info Chips */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', mb: 2 }}>
                        <Chip
                          icon={<AccessTime fontSize="small" />}
                          label={`${exam.timeLimit} min`}
                          size="small"
                          sx={{
                            borderRadius: '12px',
                            bgcolor: mode === 'dark'
                              ? alpha(theme.palette.primary.main, 0.15)
                              : alpha(theme.palette.primary.main, 0.08),
                            color: theme.palette.primary.main,
                            border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
                            fontWeight: 'medium',
                            '& .MuiChip-icon': {
                              color: theme.palette.primary.main
                            }
                          }}
                        />

                        <Chip
                          icon={<CalendarToday fontSize="small" />}
                          label={new Date(exam.scheduledFor || exam.createdAt).toLocaleDateString()}
                          size="small"
                          sx={{
                            borderRadius: '12px',
                            bgcolor: mode === 'dark'
                              ? alpha(theme.palette.info.main, 0.15)
                              : alpha(theme.palette.info.main, 0.08),
                            color: theme.palette.info.main,
                            border: `1px solid ${alpha(theme.palette.info.main, 0.3)}`,
                            fontWeight: 'medium',
                            '& .MuiChip-icon': {
                              color: theme.palette.info.main
                            }
                          }}
                        />

                        {/* Questions count chip */}
                        <Chip
                          icon={<QuestionAnswer fontSize="small" />}
                          label={`${exam.totalQuestions || '?'} Questions`}
                          size="small"
                          sx={{
                            borderRadius: '12px',
                            bgcolor: mode === 'dark'
                              ? alpha(theme.palette.success.main, 0.15)
                              : alpha(theme.palette.success.main, 0.08),
                            color: theme.palette.success.main,
                            border: `1px solid ${alpha(theme.palette.success.main, 0.3)}`,
                            fontWeight: 'medium',
                            '& .MuiChip-icon': {
                              color: theme.palette.success.main
                            }
                          }}
                        />

                        {/* Selective Answering Indicator Chip */}
                        <Chip
                          icon={exam.allowSelectiveAnswering ? <CheckBox fontSize="small" /> : <Assignment fontSize="small" />}
                          label={exam.allowSelectiveAnswering ? 'Selective' : 'Standard'}
                          size="small"
                          sx={{
                            borderRadius: '12px',
                            bgcolor: exam.allowSelectiveAnswering
                              ? mode === 'dark'
                                ? alpha(theme.palette.secondary.main, 0.15)
                                : alpha(theme.palette.secondary.main, 0.08)
                              : mode === 'dark'
                                ? alpha(theme.palette.grey[500], 0.15)
                                : alpha(theme.palette.grey[500], 0.08),
                            color: exam.allowSelectiveAnswering
                              ? theme.palette.secondary.main
                              : theme.palette.grey[600],
                            border: `1px solid ${exam.allowSelectiveAnswering
                              ? alpha(theme.palette.secondary.main, 0.3)
                              : alpha(theme.palette.grey[500], 0.3)}`,
                            fontWeight: 'medium',
                            '& .MuiChip-icon': {
                              color: exam.allowSelectiveAnswering
                                ? theme.palette.secondary.main
                                : theme.palette.grey[600]
                            }
                          }}
                        />
                      </Box>

                      {/* Selective Answering Badge */}
                      {exam.allowSelectiveAnswering && (
                        <Tooltip
                          title={
                            <React.Fragment>
                              <Box sx={{
                                p: 0.5,
                                bgcolor: theme.palette.secondary.main,
                                color: 'white',
                                mb: 1,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1
                              }}>
                                <CheckBox fontSize="small" />
                                <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                                  Selective Answering Enabled
                                </Typography>
                              </Box>
                              <Typography variant="body2" sx={{ mb: 1 }}>
                                In this exam, you can choose which questions to answer in Sections B and C.
                                Only selected questions will count toward your score.
                              </Typography>
                              <Box sx={{
                                p: 1,
                                bgcolor: 'rgba(156, 39, 176, 0.1)',
                                borderLeft: `3px solid ${theme.palette.secondary.main}`,
                                mb: 1
                              }}>
                                <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                                  Required Questions:
                                </Typography>
                                <Box component="ul" sx={{ mt: 0.5, pl: 2, mb: 0 }}>
                                  <Box component="li">
                                    <Typography variant="body2">
                                      Section B: Select any {exam.sectionBRequiredQuestions || '?'} questions
                                    </Typography>
                                  </Box>
                                  <Box component="li">
                                    <Typography variant="body2">
                                      Section C: Select any {exam.sectionCRequiredQuestions || '?'} questions
                                    </Typography>
                                  </Box>
                                </Box>
                              </Box>
                              <Typography variant="caption" sx={{ fontStyle: 'italic', display: 'block', textAlign: 'center' }}>
                                Click for more details during the exam
                              </Typography>
                            </React.Fragment>
                          }
                          arrow
                          placement="top"
                          componentsProps={{
                            tooltip: {
                              sx: {
                                bgcolor: 'white',
                                color: 'text.primary',
                                boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                                maxWidth: 320,
                                p: 2,
                                '& .MuiTooltip-arrow': {
                                  color: 'white'
                                }
                              }
                            }
                          }}
                        >
                          <Chip
                            icon={<CheckBox fontSize="small" />}
                            label="Selective Answering"
                            size="small"
                            variant="filled"
                            color="secondary"
                            sx={{
                              borderRadius: '12px',
                              fontWeight: 'bold',
                              cursor: 'help',
                              bgcolor: alpha(theme.palette.secondary.main, 0.9),
                              color: 'white',
                              backdropFilter: 'blur(10px)',
                              border: '1px solid rgba(255, 255, 255, 0.2)',
                              boxShadow: mode === 'dark'
                                ? '0 4px 12px rgba(156, 39, 176, 0.3)'
                                : '0 2px 8px rgba(156, 39, 176, 0.2)',
                              '&:hover': {
                                transform: 'translateY(-1px)',
                                boxShadow: mode === 'dark'
                                  ? '0 6px 16px rgba(156, 39, 176, 0.4)'
                                  : '0 4px 12px rgba(156, 39, 176, 0.3)',
                              },
                              '& .MuiChip-icon': {
                                color: 'white'
                              }
                            }}
                          />
                        </Tooltip>
                      )}
                    </CardContent>

                    <Divider sx={{
                      bgcolor: mode === 'dark'
                        ? alpha(theme.palette.divider, 0.1)
                        : 'divider'
                    }} />

                    {/* Enhanced Action Buttons */}
                    <CardActions sx={{
                      p: 3,
                      flexDirection: exam.status === 'completed' && !exam.isLocked ? 'column' : 'row',
                      gap: 1.5,
                      bgcolor: mode === 'dark'
                        ? alpha(theme.palette.background.default, 0.3)
                        : alpha(theme.palette.background.default, 0.5)
                    }}>
                      <Button
                        variant={exam.status === 'in-progress' ? 'contained' : 'contained'}
                        component={exam.isLocked ? undefined : RouterLink}
                        to={!exam.isLocked ? (
                          exam.status === 'completed'
                            ? `/student/results/${exam._id}`
                            : exam.status === 'in-progress'
                              ? `/student/exam/${exam._id}`
                              : `/student/exam/start/${exam._id}`
                        ) : undefined}
                        endIcon={exam.isLocked ? <LockOutlined /> : <ArrowForward />}
                        disabled={exam.isLocked}
                        fullWidth
                        sx={{
                          borderRadius: '12px',
                          py: 1.5,
                          fontWeight: 'bold',
                          textTransform: 'none',
                          fontSize: '1rem',
                          background: exam.isLocked
                            ? `linear-gradient(135deg, ${alpha(theme.palette.error.main, 0.8)}, ${alpha(theme.palette.error.dark, 0.9)})`
                            : exam.status === 'completed'
                              ? `linear-gradient(135deg, ${theme.palette.success.main}, ${theme.palette.success.dark})`
                              : exam.status === 'in-progress'
                                ? `linear-gradient(135deg, ${theme.palette.warning.main}, ${theme.palette.warning.dark})`
                                : `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
                          boxShadow: mode === 'dark'
                            ? exam.isLocked
                              ? '0 6px 20px rgba(244, 67, 54, 0.3)'
                              : exam.status === 'completed'
                                ? '0 6px 20px rgba(76, 175, 80, 0.3)'
                                : exam.status === 'in-progress'
                                  ? '0 6px 20px rgba(255, 152, 0, 0.3)'
                                  : '0 6px 20px rgba(25, 118, 210, 0.3)'
                            : '0 4px 12px rgba(0,0,0,0.15)',
                          '&:hover': {
                            transform: exam.isLocked ? 'none' : 'translateY(-2px)',
                            boxShadow: exam.isLocked
                              ? undefined
                              : mode === 'dark'
                                ? exam.status === 'completed'
                                  ? '0 8px 25px rgba(76, 175, 80, 0.4)'
                                  : exam.status === 'in-progress'
                                    ? '0 8px 25px rgba(255, 152, 0, 0.4)'
                                    : '0 8px 25px rgba(25, 118, 210, 0.4)'
                                : '0 6px 16px rgba(0,0,0,0.2)',
                          },
                          ...(exam.isLocked && {
                            '&.Mui-disabled': {
                              background: `linear-gradient(135deg, ${alpha(theme.palette.error.main, 0.5)}, ${alpha(theme.palette.error.dark, 0.6)})`,
                              color: 'white',
                              opacity: 0.8
                            }
                          })
                        }}
                      >
                        {exam.isLocked
                          ? 'Exam Locked'
                          : exam.status === 'in-progress'
                            ? 'Continue Exam'
                            : exam.status === 'completed'
                              ? 'View Results'
                              : 'Start Exam'}
                      </Button>

                      {/* Enhanced Retake button for completed exams */}
                      {exam.status === 'completed' && !exam.isLocked && (
                        <Button
                          variant="outlined"
                          component={RouterLink}
                          to={`/student/exam/start/${exam._id}`}
                          endIcon={<Refresh />}
                          fullWidth
                          sx={{
                            borderRadius: '12px',
                            py: 1.5,
                            fontWeight: 'bold',
                            textTransform: 'none',
                            fontSize: '0.95rem',
                            borderColor: theme.palette.primary.main,
                            color: theme.palette.primary.main,
                            border: `2px solid ${theme.palette.primary.main}`,
                            bgcolor: mode === 'dark'
                              ? alpha(theme.palette.primary.main, 0.1)
                              : 'transparent',
                            '&:hover': {
                              transform: 'translateY(-2px)',
                              bgcolor: alpha(theme.palette.primary.main, 0.1),
                              borderColor: theme.palette.primary.dark,
                              boxShadow: mode === 'dark'
                                ? '0 6px 20px rgba(25, 118, 210, 0.3)'
                                : '0 4px 12px rgba(25, 118, 210, 0.2)',
                            }
                          }}
                        >
                          Retake Exam
                        </Button>
                      )}
                    </CardActions>
                  </ExamCard>
                </Grid>
              ))}
            </Grid>

            {/* Enhanced Pagination */}
            {totalPages > 1 && (
              <Box sx={{
                display: 'flex',
                justifyContent: 'center',
                mt: 6,
                p: 3,
                bgcolor: mode === 'dark'
                  ? alpha(theme.palette.background.paper, 0.5)
                  : alpha(theme.palette.background.paper, 0.8),
                borderRadius: '16px',
                backdropFilter: 'blur(10px)',
                border: mode === 'dark'
                  ? `1px solid ${alpha(theme.palette.divider, 0.2)}`
                  : 'none',
                boxShadow: mode === 'dark'
                  ? '0 8px 32px rgba(0,0,0,0.3)'
                  : '0 4px 20px rgba(0,0,0,0.08)'
              }}>
                <Pagination
                  count={totalPages}
                  page={page}
                  onChange={(e, value) => setPage(value)}
                  color="primary"
                  size="large"
                  showFirstButton
                  showLastButton
                  sx={{
                    '& .MuiPaginationItem-root': {
                      borderRadius: '12px',
                      fontWeight: 'medium',
                      border: mode === 'dark'
                        ? `1px solid ${alpha(theme.palette.divider, 0.3)}`
                        : 'none',
                      bgcolor: mode === 'dark'
                        ? alpha(theme.palette.background.paper, 0.6)
                        : 'transparent',
                      '&:hover': {
                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                        transform: 'translateY(-1px)',
                        boxShadow: mode === 'dark'
                          ? '0 4px 12px rgba(25, 118, 210, 0.2)'
                          : '0 2px 8px rgba(25, 118, 210, 0.15)'
                      },
                      '&.Mui-selected': {
                        bgcolor: theme.palette.primary.main,
                        color: 'white',
                        fontWeight: 'bold',
                        boxShadow: mode === 'dark'
                          ? '0 6px 20px rgba(25, 118, 210, 0.4)'
                          : '0 4px 12px rgba(25, 118, 210, 0.3)',
                        '&:hover': {
                          bgcolor: theme.palette.primary.dark,
                        }
                      }
                    }
                  }}
                />
              </Box>
            )}
          </>
        )}
      </Container>
    </StudentLayout>
  );
};

export default Exams;
