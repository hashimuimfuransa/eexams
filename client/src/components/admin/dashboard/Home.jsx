import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Button,
  Card,
  CardContent,
  Avatar,
  Divider,
  IconButton,
  Tooltip,
  CircularProgress,
  useTheme,
  alpha,
  Zoom,
  Fade,
  LinearProgress,
  Stack,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import { useThemeMode } from '../../../context/ThemeContext';
import {
  People as PeopleIcon,
  Assignment as AssignmentIcon,
  CalendarToday as CalendarIcon,
  Warning as WarningIcon,
  Refresh as RefreshIcon,
  Add as AddIcon,
  ArrowForward as ArrowForwardIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  CheckCircle as CheckCircleIcon,
  School as SchoolIcon,
  Timeline as TimelineIcon,
  Insights as InsightsIcon,
  Speed as SpeedIcon,
  Notifications as NotificationsIcon,
  Person as PersonIcon,
  Event as EventIcon,
  Security as SecurityIcon,
  EmojiEvents as EmojiEventsIcon,
  AccessTime as AccessTimeIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { getDashboardStats, getRecentExams, getRecentStudents } from '../../../services/adminService';
import { useAuth } from '../../../context/AuthContext';
import api from '../../../services/api';

const Home = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { mode } = useThemeMode();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Dashboard data states
  const [stats, setStats] = useState([
    {
      title: 'Total Students',
      value: 0,
      icon: <PeopleIcon />,
      color: theme.palette.primary.main,
      trend: 12,
      trendLabel: 'vs last month',
      tooltip: 'Total number of registered students'
    },
    {
      title: 'Active Exams',
      value: 0,
      icon: <AssignmentIcon />,
      color: theme.palette.secondary.main,
      trend: 5,
      trendLabel: 'vs last week',
      tooltip: 'Currently active exams'
    },
    {
      title: 'Upcoming Exams',
      value: 0,
      icon: <CalendarIcon />,
      color: theme.palette.success.main,
      trend: 8,
      trendLabel: 'new scheduled',
      tooltip: 'Exams scheduled for the future'
    },
    {
      title: 'Security Alerts',
      value: 0,
      icon: <WarningIcon />,
      color: theme.palette.error.main,
      trend: -3,
      trendLabel: 'vs last week',
      tooltip: 'Active security alerts requiring attention'
    }
  ]);

  const [recentExams, setRecentExams] = useState([]);
  const [recentStudents, setRecentStudents] = useState([]);
  const [activities, setActivities] = useState([]);
  const [performanceData, setPerformanceData] = useState({});
  const [completionRates, setCompletionRates] = useState([]);
  const [topPerformers, setTopPerformers] = useState([]);

  // Chart options for student performance
  const performanceChartOptions = {
    chart: {
      type: 'area',
      height: 350,
      toolbar: {
        show: false
      },
      fontFamily: theme.typography.fontFamily,
      foreColor: theme.palette.text.secondary
    },
    colors: [theme.palette.primary.main, theme.palette.secondary.main],
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.7,
        opacityTo: 0.2,
        stops: [0, 90, 100]
      }
    },
    dataLabels: {
      enabled: false
    },
    stroke: {
      curve: 'smooth',
      width: 3
    },
    grid: {
      borderColor: alpha(theme.palette.divider, 0.1),
      row: {
        colors: [alpha(theme.palette.background.default, 0.5), 'transparent'],
        opacity: 0.5
      }
    },
    markers: {
      size: 4
    },
    xaxis: {
      categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      labels: {
        style: {
          colors: theme.palette.text.secondary
        }
      }
    },
    yaxis: {
      labels: {
        style: {
          colors: theme.palette.text.secondary
        }
      }
    },
    tooltip: {
      theme: theme.palette.mode
    },
    legend: {
      position: 'top',
      horizontalAlign: 'right',
      labels: {
        colors: theme.palette.text.primary
      }
    }
  };

  // Chart options for exam completion rates
  const completionChartOptions = {
    chart: {
      type: 'donut',
      height: 350,
      fontFamily: theme.typography.fontFamily,
      foreColor: theme.palette.text.secondary
    },
    colors: [
      theme.palette.success.main,
      theme.palette.warning.main,
      theme.palette.error.main
    ],
    labels: ['Completed', 'In Progress', 'Not Started'],
    legend: {
      position: 'bottom',
      labels: {
        colors: theme.palette.text.primary
      }
    },
    dataLabels: {
      enabled: false
    },
    plotOptions: {
      pie: {
        donut: {
          size: '70%',
          labels: {
            show: true,
            name: {
              show: true,
              fontSize: '16px',
              fontWeight: 600,
              color: theme.palette.text.primary
            },
            value: {
              show: true,
              fontSize: '20px',
              fontWeight: 700,
              color: theme.palette.text.primary
            },
            total: {
              show: true,
              label: 'Total',
              fontSize: '16px',
              fontWeight: 600,
              color: theme.palette.text.primary
            }
          }
        }
      }
    }
  };

  // Fetch dashboard data
  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Get dashboard stats from API
      const statsData = await getDashboardStats();

      // Update stats with real data
      setStats([
        {
          title: 'Total Students',
          value: statsData.totalStudents || 0,
          icon: <PeopleIcon />,
          color: theme.palette.primary.main,
          trend: 12,
          trendLabel: 'vs last month',
          tooltip: 'Total number of registered students'
        },
        {
          title: 'Active Exams',
          value: statsData.activeExams || 0,
          icon: <AssignmentIcon />,
          color: theme.palette.secondary.main,
          trend: 5,
          trendLabel: 'vs last week',
          tooltip: 'Currently active exams'
        },
        {
          title: 'Upcoming Exams',
          value: statsData.upcomingExams || 0,
          icon: <CalendarIcon />,
          color: theme.palette.success.main,
          trend: 8,
          trendLabel: 'new scheduled',
          tooltip: 'Exams scheduled for the future'
        },
        {
          title: 'Security Alerts',
          value: statsData.securityAlerts || 0,
          icon: <WarningIcon />,
          color: theme.palette.error.main,
          trend: -3,
          trendLabel: 'vs last week',
          tooltip: 'Active security alerts requiring attention'
        }
      ]);

      // Set recent activities
      if (statsData.recentActivities) {
        setActivities(statsData.recentActivities);
      }

      // Get recent exams data from the API
      try {
        const recentExamsData = await getRecentExams();
        setRecentExams(recentExamsData);

        // If we have exams, try to fetch the leaderboard for the first exam
        if (recentExamsData && recentExamsData.length > 0) {
          try {
            const leaderboardResponse = await api.get(`/admin/exams/${recentExamsData[0].id}/leaderboard`);
            if (leaderboardResponse.data && leaderboardResponse.data.leaderboard) {
              // Get top 3 performers
              setTopPerformers(leaderboardResponse.data.leaderboard.slice(0, 3));
            }
          } catch (leaderboardError) {
            console.error('Error fetching leaderboard:', leaderboardError);
            // Set mock top performers if leaderboard fetch fails
            setTopPerformers([
              {
                id: '1',
                name: 'John Doe',
                studentClass: 'Science Class',
                percentage: 95,
                timeTaken: 45
              },
              {
                id: '2',
                name: 'Jane Smith',
                studentClass: 'Math Class',
                percentage: 92,
                timeTaken: 50
              },
              {
                id: '3',
                name: 'Alex Johnson',
                studentClass: 'History Class',
                percentage: 89,
                timeTaken: 55
              }
            ]);
          }
        }
      } catch (error) {
        console.error('Error fetching recent exams:', error);
      }

      // Get recent students data from the API
      try {
        const recentStudentsData = await getRecentStudents();
        setRecentStudents(recentStudentsData);
      } catch (error) {
        console.error('Error fetching recent students:', error);
      }

      // Set performance data for charts
      setPerformanceData({
        series: [
          {
            name: 'Average Score',
            data: [65, 72, 78, 75, 82, 88, 85, 83, 86, 90, 88, 92]
          },
          {
            name: 'Completion Rate',
            data: [70, 75, 80, 78, 85, 90, 88, 87, 89, 92, 90, 95]
          }
        ]
      });

      // Set completion rates for donut chart
      setCompletionRates([65, 25, 10]); // Completed, In Progress, Not Started

      setLoading(false);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError('Failed to load dashboard data. Please try again.');
      setLoading(false);

      // Set mock data if API fails
      setStats([
        {
          title: 'Total Students',
          value: 156,
          icon: <PeopleIcon />,
          color: theme.palette.primary.main,
          trend: 12,
          trendLabel: 'vs last month',
          tooltip: 'Total number of registered students'
        },
        {
          title: 'Active Exams',
          value: 8,
          icon: <AssignmentIcon />,
          color: theme.palette.secondary.main,
          trend: 5,
          trendLabel: 'vs last week',
          tooltip: 'Currently active exams'
        },
        {
          title: 'Upcoming Exams',
          value: 12,
          icon: <CalendarIcon />,
          color: theme.palette.success.main,
          trend: 8,
          trendLabel: 'new scheduled',
          tooltip: 'Exams scheduled for the future'
        },
        {
          title: 'Security Alerts',
          value: 2,
          icon: <WarningIcon />,
          color: theme.palette.error.main,
          trend: -3,
          trendLabel: 'vs last week',
          tooltip: 'Active security alerts requiring attention'
        }
      ]);

      // Set mock activities
      setActivities([
        {
          id: 1,
          type: 'student_added',
          user: 'John Doe',
          time: '2 hours ago'
        },
        {
          id: 2,
          type: 'exam_created',
          exam: 'Biology Final',
          time: '5 hours ago'
        },
        {
          id: 3,
          type: 'exam_completed',
          exam: 'Chemistry Quiz',
          students: 35,
          time: '1 day ago'
        },
        {
          id: 4,
          type: 'security_alert',
          student: 'Alice Smith',
          issue: 'Multiple device login',
          time: '2 days ago'
        }
      ]);

      // Set mock performance data
      setPerformanceData({
        series: [
          {
            name: 'Average Score',
            data: [65, 72, 78, 75, 82, 88, 85, 83, 86, 90, 88, 92]
          },
          {
            name: 'Completion Rate',
            data: [70, 75, 80, 78, 85, 90, 88, 87, 89, 92, 90, 95]
          }
        ]
      });

      // Set mock completion rates
      setCompletionRates([65, 25, 10]);
    }
  };

  // Navigation handlers
  const handleCreateExam = () => {
    navigate('/admin/exams/create');
  };

  const handleViewAllExams = () => {
    navigate('/admin/exams');
  };

  const handleAddStudent = () => {
    navigate('/admin/students/add');
  };

  const handleViewAllStudents = () => {
    navigate('/admin/students');
  };

  const handleViewAnalytics = () => {
    navigate('/admin/results/analytics');
  };

  const handleViewLeaderboard = () => {
    // Navigate to the main leaderboard page
    navigate('/admin/results/leaderboard');
  };

  const handleViewSecurity = () => {
    navigate('/admin/security/monitoring');
  };

  return (
    <Box>
      {/* Page header with enhanced styling */}
      <Box
        sx={{
          mb: { xs: 3, sm: 4 },
          p: { xs: 2, sm: 3 },
          borderRadius: { xs: 2, sm: 3 },
          background: mode === 'dark'
            ? `linear-gradient(120deg, ${alpha(theme.palette.primary.main, 0.15)} 0%, ${alpha(theme.palette.secondary.main, 0.15)} 100%)`
            : `linear-gradient(120deg, ${alpha(theme.palette.primary.main, 0.08)} 0%, ${alpha(theme.palette.secondary.main, 0.08)} 100%)`,
          boxShadow: mode === 'dark'
            ? `inset 0 0 20px ${alpha(theme.palette.primary.main, 0.1)}`
            : `inset 0 0 20px ${alpha(theme.palette.primary.main, 0.03)}`,
          border: `1px solid ${alpha(theme.palette.primary.main, mode === 'dark' ? 0.2 : 0.1)}`,
          position: 'relative',
          overflow: 'hidden',
          transition: 'all 0.3s ease'
        }}
      >
        {/* Decorative elements */}
        <Box
          sx={{
            position: 'absolute',
            top: -30,
            right: -30,
            width: 150,
            height: 150,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${alpha(theme.palette.primary.main, 0.1)} 0%, transparent 70%)`,
            display: { xs: 'none', sm: 'block' }
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            bottom: -20,
            left: -20,
            width: 100,
            height: 100,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${alpha(theme.palette.secondary.main, 0.1)} 0%, transparent 70%)`,
            display: { xs: 'none', sm: 'block' }
          }}
        />

        <Box sx={{ position: 'relative', zIndex: 1 }}>
          <Typography
            variant="h4"
            component="h1"
            fontWeight="bold"
            gutterBottom
            sx={{
              fontSize: { xs: '1.75rem', sm: '2rem', md: '2.25rem' },
              background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              display: 'inline-block'
            }}
          >
            Welcome, {user?.firstName || 'Admin'}!
          </Typography>
          <Typography
            variant="subtitle1"
            sx={{
              color: alpha(theme.palette.text.primary, 0.8),
              fontSize: { xs: '0.875rem', sm: '1rem' },
              maxWidth: { sm: '80%', md: '60%' }
            }}
          >
            Here's an overview of your system. Track student performance, manage exams, and monitor your platform's activity.
          </Typography>

          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            mt: 2,
            color: theme.palette.text.secondary,
            fontSize: { xs: '0.75rem', sm: '0.875rem' }
          }}>
            <AccessTimeIcon sx={{ fontSize: '1rem', mr: 0.5 }} />
            <Typography variant="caption">
              Last updated: {new Date().toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </Typography>
            <Tooltip title="Refresh dashboard data">
              <IconButton
                size="small"
                onClick={fetchDashboardData}
                sx={{ ml: 1, color: theme.palette.primary.main }}
              >
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Box>

      {/* Stats Cards with enhanced styling */}
      <Zoom in={true} timeout={800}>
        <Box>
          <Typography
            variant="h6"
            sx={{
              mb: 2,
              fontSize: { xs: '1rem', sm: '1.1rem', md: '1.25rem' },
              fontWeight: 600,
              color: alpha(theme.palette.text.primary, 0.9),
              display: 'flex',
              alignItems: 'center',
              '&::before': {
                content: '""',
                display: 'inline-block',
                width: { xs: 16, sm: 20 },
                height: { xs: 3, sm: 4 },
                borderRadius: 4,
                background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                mr: 1.5
              }
            }}
          >
            Key Metrics
          </Typography>
          <Grid container spacing={{ xs: 1.5, sm: 2, md: 3 }} sx={{ mb: 4 }}>
            {stats.map((stat, index) => (
              <Grid item xs={6} sm={6} md={3} key={`stat-card-${stat.title}-${index}`}>
                <Card
                  elevation={0}
                  sx={{
                    height: '100%',
                    borderRadius: { xs: 2, md: 3 },
                    p: { xs: 0.5, sm: 1, md: 1.5 },
                    background: `linear-gradient(135deg, ${alpha(stat.color, 0.03)} 0%, ${alpha(stat.color, 0.08)} 100%)`,
                    border: `1px solid ${alpha(stat.color, 0.1)}`,
                    transition: 'all 0.3s ease',
                    overflow: 'hidden',
                    position: 'relative',
                    '&::after': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      background: `radial-gradient(circle at top right, ${alpha(stat.color, 0.15)}, transparent 70%)`,
                      opacity: 0,
                      transition: 'opacity 0.3s ease',
                      zIndex: 0
                    },
                    '&:hover': {
                      transform: 'translateY(-5px)',
                      boxShadow: `0 10px 25px ${alpha(stat.color, 0.2)}`,
                      '&::after': {
                        opacity: 1
                      }
                    }
                  }}
                >
                  <CardContent sx={{ p: { xs: 1, sm: 1.5, md: 2 }, '&:last-child': { pb: { xs: 1, sm: 1.5, md: 2 } } }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                      <Typography
                        variant="subtitle1"
                        component="h2"
                        fontWeight="bold"
                        color="text.primary"
                        sx={{
                          fontSize: { xs: '0.75rem', sm: '0.875rem', md: '1rem' },
                          maxWidth: { xs: '70%', sm: '75%' }
                        }}
                      >
                        {stat.title}
                      </Typography>
                      <Avatar
                        sx={{
                          bgcolor: alpha(stat.color, 0.2),
                          color: stat.color,
                          width: { xs: 28, sm: 32, md: 40 },
                          height: { xs: 28, sm: 32, md: 40 }
                        }}
                      >
                        {stat.icon}
                      </Avatar>
                    </Box>

                    <Typography
                      variant="h4"
                      component="div"
                      fontWeight="bold"
                      color={stat.color}
                      sx={{
                        mb: 1,
                        fontSize: { xs: '1.25rem', sm: '1.5rem', md: '2rem', lg: '2.5rem' },
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      {loading ? <CircularProgress size={24} color="inherit" /> : stat.value}
                    </Typography>

                    <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          color: stat.trend >= 0 ? 'success.main' : 'error.main',
                          bgcolor: stat.trend >= 0 ? alpha(theme.palette.success.main, 0.1) : alpha(theme.palette.error.main, 0.1),
                          borderRadius: 1,
                          px: { xs: 0.5, sm: 1 },
                          py: 0.5,
                          fontSize: { xs: '0.7rem', sm: '0.75rem' }
                        }}
                      >
                        {stat.trend >= 0 ? <TrendingUpIcon fontSize="small" sx={{ mr: 0.5, fontSize: { xs: '0.875rem', sm: '1rem' } }} /> : <TrendingDownIcon fontSize="small" sx={{ mr: 0.5, fontSize: { xs: '0.875rem', sm: '1rem' } }} />}
                        <Typography variant="caption" fontWeight="bold" sx={{ fontSize: 'inherit' }}>
                          {Math.abs(stat.trend)}%
                        </Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary" sx={{ ml: 1, fontSize: { xs: '0.65rem', sm: '0.7rem', md: '0.75rem' } }}>
                        {stat.trendLabel}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      </Zoom>

      {/* Recent Activity Section with enhanced styling */}
      <Box sx={{ mb: 3 }}>
        <Typography
          variant="h6"
          sx={{
            mb: 2,
            fontSize: { xs: '1rem', sm: '1.1rem', md: '1.25rem' },
            fontWeight: 600,
            color: alpha(theme.palette.text.primary, 0.9),
            display: 'flex',
            alignItems: 'center',
            '&::before': {
              content: '""',
              display: 'inline-block',
              width: { xs: 16, sm: 20 },
              height: { xs: 3, sm: 4 },
              borderRadius: 4,
              background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.light})`,
              mr: 1.5
            }
          }}
        >
          Recent Activity
        </Typography>
      </Box>
      <Grid container spacing={{ xs: 2, sm: 3, md: 4 }}>
        {/* Recent Exams */}
        <Grid item xs={12} md={6}>
          <Fade in={true} timeout={1000}>
            <Card elevation={0} sx={{
              borderRadius: { xs: 2, md: 3 },
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.02)} 0%, ${alpha(theme.palette.primary.main, 0.06)} 100%)`,
              transition: 'all 0.3s ease',
              '&:hover': {
                boxShadow: `0 8px 25px ${alpha(theme.palette.primary.main, 0.1)}`,
                transform: 'translateY(-5px)'
              },
              position: 'relative',
              overflow: 'hidden'
            }}>
              {/* Decorative element */}
              <Box
                sx={{
                  position: 'absolute',
                  top: -30,
                  right: -30,
                  width: 120,
                  height: 120,
                  borderRadius: '50%',
                  background: `radial-gradient(circle, ${alpha(theme.palette.primary.main, 0.1)} 0%, transparent 70%)`,
                  display: { xs: 'none', sm: 'block' }
                }}
              />
              <CardContent sx={{ p: { xs: 1.5, sm: 2, md: 3 }, flexGrow: 1, position: 'relative', zIndex: 1 }}>
                <Box sx={{
                  display: 'flex',
                  flexDirection: { xs: 'column', sm: 'row' },
                  justifyContent: 'space-between',
                  alignItems: { xs: 'flex-start', sm: 'center' },
                  mb: 2,
                  gap: { xs: 1, sm: 0 }
                }}>
                  <Typography
                    variant="h6"
                    component="h2"
                    fontWeight="bold"
                    sx={{
                      mb: { xs: 0.5, sm: 0 },
                      fontSize: { xs: '1rem', sm: '1.1rem', md: '1.25rem' }
                    }}
                  >
                    Recent Exams
                  </Typography>
                  <Box sx={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: { xs: 0.5, sm: 1 },
                    justifyContent: { xs: 'flex-start', sm: 'flex-end' },
                    width: { xs: '100%', sm: 'auto' }
                  }}>
                    <Tooltip title="Refresh">
                      <IconButton size="small" onClick={fetchDashboardData}>
                        <RefreshIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<AddIcon sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }} />}
                      onClick={handleCreateExam}
                      sx={{
                        fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.8rem' },
                        py: { xs: 0.5, sm: 0.75 },
                        px: { xs: 1, sm: 1.5 }
                      }}
                    >
                      New Exam
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      endIcon={<ArrowForwardIcon sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }} />}
                      onClick={handleViewAllExams}
                      sx={{
                        fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.8rem' },
                        py: { xs: 0.5, sm: 0.75 },
                        px: { xs: 1, sm: 1.5 }
                      }}
                    >
                      View All
                    </Button>
                  </Box>
                </Box>

                <Divider sx={{ mb: 2 }} />

                {loading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                    <CircularProgress />
                  </Box>
                ) : recentExams.length === 0 ? (
                  <Box sx={{ textAlign: 'center', p: 3 }}>
                    <Typography variant="body2" color="text.secondary">
                      No exams found. Create your first exam.
                    </Typography>
                    <Button
                      variant="contained"
                      startIcon={<AddIcon />}
                      onClick={handleCreateExam}
                      sx={{ mt: 2 }}
                    >
                      Create Exam
                    </Button>
                  </Box>
                ) : (
                  <Box>
                    {recentExams.map((exam, index) => (
                      <Card
                        key={`recent-exam-${exam.id || index}-${index}`}
                        variant="outlined"
                        sx={{
                          mb: 2,
                          borderRadius: 3,
                          transition: 'all 0.3s ease',
                          '&:hover': {
                            transform: 'translateX(5px)',
                            boxShadow: '0 4px 10px rgba(0, 0, 0, 0.1)',
                          }
                        }}
                      >
                        <CardContent sx={{ p: { xs: 1.5, sm: 2 }, '&:last-child': { pb: { xs: 1.5, sm: 2 } } }}>
                          <Grid container alignItems="center" spacing={1}>
                            <Grid item xs={12} sm={7}>
                              <Typography
                                variant="subtitle1"
                                fontWeight="bold"
                                sx={{ fontSize: { xs: '0.9rem', sm: '1rem' } }}
                              >
                                {exam.title}
                              </Typography>
                              <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
                              >
                                {exam.date} at {exam.time}
                              </Typography>
                            </Grid>
                            <Grid item xs={6} sm={3} sx={{ textAlign: { xs: 'left', sm: 'center' } }}>
                              <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
                              >
                                Students
                              </Typography>
                              <Typography
                                variant="subtitle2"
                                fontWeight="bold"
                                sx={{ fontSize: { xs: '0.8rem', sm: '0.9rem' } }}
                              >
                                {exam.students}
                              </Typography>
                            </Grid>
                            <Grid item xs={6} sm={2} sx={{ textAlign: 'right' }}>
                              <Box
                                sx={{
                                  display: 'inline-block',
                                  px: 1.5,
                                  py: 0.5,
                                  borderRadius: 1,
                                  fontSize: { xs: '0.7rem', sm: '0.75rem' },
                                  fontWeight: 'bold',
                                  textTransform: 'capitalize',
                                  bgcolor: exam.status === 'active'
                                    ? alpha(theme.palette.success.main, 0.1)
                                    : exam.status === 'completed'
                                      ? alpha(theme.palette.info.main, 0.1)
                                      : alpha(theme.palette.warning.main, 0.1),
                                  color: exam.status === 'active'
                                    ? theme.palette.success.main
                                    : exam.status === 'completed'
                                      ? theme.palette.info.main
                                      : theme.palette.warning.main,
                                }}
                              >
                                {exam.status}
                              </Box>
                            </Grid>
                          </Grid>
                        </CardContent>
                      </Card>
                    ))}
                  </Box>
                )}
              </CardContent>
            </Card>
          </Fade>
        </Grid>

        {/* Recent Students */}
        <Grid item xs={12} md={6}>
          <Fade in={true} timeout={1200}>
            <Card elevation={0} sx={{
              borderRadius: { xs: 2, md: 3 },
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              background: `linear-gradient(135deg, ${alpha(theme.palette.secondary.main, 0.02)} 0%, ${alpha(theme.palette.secondary.main, 0.06)} 100%)`,
              transition: 'all 0.3s ease',
              '&:hover': {
                boxShadow: `0 8px 25px ${alpha(theme.palette.secondary.main, 0.1)}`,
                transform: 'translateY(-5px)'
              },
              position: 'relative',
              overflow: 'hidden'
            }}>
              {/* Decorative element */}
              <Box
                sx={{
                  position: 'absolute',
                  top: -30,
                  right: -30,
                  width: 120,
                  height: 120,
                  borderRadius: '50%',
                  background: `radial-gradient(circle, ${alpha(theme.palette.secondary.main, 0.1)} 0%, transparent 70%)`,
                  display: { xs: 'none', sm: 'block' }
                }}
              />
              <CardContent sx={{ p: { xs: 1.5, sm: 2, md: 3 }, flexGrow: 1, position: 'relative', zIndex: 1 }}>
                <Box sx={{
                  display: 'flex',
                  flexDirection: { xs: 'column', sm: 'row' },
                  justifyContent: 'space-between',
                  alignItems: { xs: 'flex-start', sm: 'center' },
                  mb: 2,
                  gap: { xs: 1, sm: 0 }
                }}>
                  <Typography
                    variant="h6"
                    component="h2"
                    fontWeight="bold"
                    sx={{
                      mb: { xs: 0.5, sm: 0 },
                      fontSize: { xs: '1rem', sm: '1.1rem', md: '1.25rem' }
                    }}
                  >
                    Recent Students
                  </Typography>
                  <Box sx={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: { xs: 0.5, sm: 1 },
                    justifyContent: { xs: 'flex-start', sm: 'flex-end' },
                    width: { xs: '100%', sm: 'auto' }
                  }}>
                    <Tooltip title="Refresh">
                      <IconButton size="small" onClick={fetchDashboardData}>
                        <RefreshIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<AddIcon sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }} />}
                      onClick={handleAddStudent}
                      sx={{
                        fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.8rem' },
                        py: { xs: 0.5, sm: 0.75 },
                        px: { xs: 1, sm: 1.5 }
                      }}
                    >
                      Add Student
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      endIcon={<ArrowForwardIcon sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }} />}
                      onClick={handleViewAllStudents}
                      sx={{
                        fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.8rem' },
                        py: { xs: 0.5, sm: 0.75 },
                        px: { xs: 1, sm: 1.5 }
                      }}
                    >
                      View All
                    </Button>
                  </Box>
                </Box>

                <Divider sx={{ mb: 2 }} />

                {loading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                    <CircularProgress />
                  </Box>
                ) : recentStudents.length === 0 ? (
                  <Box sx={{ textAlign: 'center', p: 3 }}>
                    <Typography variant="body2" color="text.secondary">
                      No students found. Add your first student.
                    </Typography>
                    <Button
                      variant="contained"
                      startIcon={<AddIcon />}
                      onClick={handleAddStudent}
                      sx={{ mt: 2 }}
                    >
                      Add Student
                    </Button>
                  </Box>
                ) : (
                  <Box>
                    {recentStudents.map((student, index) => (
                      <Card
                        key={`recent-student-${student.id || index}-${index}`}
                        variant="outlined"
                        sx={{
                          mb: 2,
                          borderRadius: 3,
                          transition: 'all 0.3s ease',
                          '&:hover': {
                            transform: 'translateX(5px)',
                            boxShadow: '0 4px 10px rgba(0, 0, 0, 0.1)',
                          }
                        }}
                      >
                        <CardContent sx={{ p: { xs: 1.5, sm: 2 }, '&:last-child': { pb: { xs: 1.5, sm: 2 } } }}>
                          <Grid container alignItems="center" spacing={1}>
                            <Grid item xs={3} sm={2}>
                              <Avatar
                                sx={{
                                  bgcolor: theme.palette.primary.main,
                                  width: { xs: 32, sm: 40 },
                                  height: { xs: 32, sm: 40 }
                                }}
                              >
                                {student.name.charAt(0)}
                              </Avatar>
                            </Grid>
                            <Grid item xs={9} sm={7}>
                              <Typography
                                variant="subtitle1"
                                fontWeight="bold"
                                sx={{ fontSize: { xs: '0.9rem', sm: '1rem' } }}
                              >
                                {student.name}
                              </Typography>
                              <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{
                                  fontSize: { xs: '0.75rem', sm: '0.875rem' },
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                {student.email}
                              </Typography>
                            </Grid>
                            <Grid item xs={12} sm={3} sx={{ textAlign: { xs: 'left', sm: 'right' }, pl: { xs: 3, sm: 1 } }}>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}
                              >
                                Registered
                              </Typography>
                              <Typography
                                variant="body2"
                                fontWeight="medium"
                                sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
                              >
                                {student.registeredDate}
                              </Typography>
                            </Grid>
                          </Grid>
                        </CardContent>
                      </Card>
                    ))}
                  </Box>
                )}
              </CardContent>
            </Card>
          </Fade>
        </Grid>
      </Grid>

      {/* Leaderboard Highlight with enhanced styling */}
      <Box sx={{ mt: { xs: 4, md: 5 }, mb: 2 }}>
        <Typography
          variant="h6"
          sx={{
            mb: 2,
            fontSize: { xs: '1rem', sm: '1.1rem', md: '1.25rem' },
            fontWeight: 600,
            color: alpha(theme.palette.text.primary, 0.9),
            display: 'flex',
            alignItems: 'center',
            '&::before': {
              content: '""',
              display: 'inline-block',
              width: { xs: 16, sm: 20 },
              height: { xs: 3, sm: 4 },
              borderRadius: 4,
              background: `linear-gradient(90deg, #FF9800, #ED6C02)`,
              mr: 1.5
            }
          }}
        >
          Student Performance
        </Typography>
      </Box>
      <Fade in={true} timeout={1250}>
        <Card
          elevation={0}
          sx={{
            borderRadius: { xs: 2, md: 3 },
            background: 'linear-gradient(135deg, #FF9800 0%, #ED6C02 100%)',
            color: 'white',
            position: 'relative',
            overflow: 'hidden',
            transition: 'all 0.3s ease',
            boxShadow: '0 10px 30px rgba(237, 108, 2, 0.2)',
            '&:hover': {
              boxShadow: '0 15px 40px rgba(237, 108, 2, 0.3)',
              transform: 'translateY(-5px)'
            }
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              top: -20,
              right: -20,
              width: { xs: 80, sm: 100, md: 120 },
              height: { xs: 80, sm: 100, md: 120 },
              borderRadius: '50%',
              bgcolor: 'rgba(255,255,255,0.1)'
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              bottom: -30,
              left: -30,
              width: { xs: 100, sm: 120, md: 150 },
              height: { xs: 100, sm: 120, md: 150 },
              borderRadius: '50%',
              bgcolor: 'rgba(255,255,255,0.1)'
            }}
          />
          <CardContent sx={{ position: 'relative', zIndex: 1, p: { xs: 2, sm: 2.5, md: 3 } }}>
            <Box sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              justifyContent: 'space-between',
              alignItems: { xs: 'flex-start', sm: 'center' },
              mb: { xs: 1.5, sm: 2 },
              gap: { xs: 1, sm: 0 }
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <EmojiEventsIcon sx={{ fontSize: { xs: 24, sm: 28, md: 32 }, mr: 1 }} />
                <Typography
                  variant="h5"
                  component="h2"
                  fontWeight="bold"
                  sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem', md: '1.5rem' } }}
                >
                  Student Leaderboard
                </Typography>
              </Box>
              <Button
                variant="contained"
                color="secondary"
                startIcon={<ArrowForwardIcon sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }} />}
                onClick={() => handleViewLeaderboard()}
                sx={{
                  color: 'black',
                  fontWeight: 'bold',
                  fontSize: { xs: '0.75rem', sm: '0.8rem', md: '0.875rem' },
                  py: { xs: 0.75, sm: 1 },
                  px: { xs: 1.5, sm: 2 },
                  '&:hover': {
                    bgcolor: '#FFF',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 4px 8px rgba(0,0,0,0.2)'
                  },
                  transition: 'all 0.2s ease'
                }}
              >
                View Leaderboard
              </Button>
            </Box>

            <Typography
              variant="body1"
              sx={{
                mb: { xs: 2, sm: 3 },
                opacity: 0.9,
                fontSize: { xs: '0.875rem', sm: '1rem' },
                display: { xs: 'none', sm: 'block' }
              }}
            >
              Check out the top-performing students across all exams. See who's leading the class!
            </Typography>

            <Grid container spacing={{ xs: 1, sm: 2 }}>
              {loading ? (
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                    <CircularProgress sx={{ color: 'white' }} />
                  </Box>
                </Grid>
              ) : topPerformers.length > 0 ? (
                topPerformers.map((student, index) => (
                  <Grid item xs={12} sm={4} key={`top-performer-${student.id || student.uniqueId || index}-${index}`}>
                    <Card
                      elevation={2}
                      sx={{
                        bgcolor: 'rgba(255,255,255,0.9)',
                        color: 'black',
                        borderRadius: { xs: 2, md: 3 },
                        transition: 'all 0.3s ease',
                        '&:hover': {
                          transform: 'translateY(-5px)',
                          boxShadow: '0 8px 16px rgba(0,0,0,0.2)'
                        }
                      }}
                    >
                      <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                          <Box
                            sx={{
                              width: { xs: 24, sm: 28, md: 30 },
                              height: { xs: 24, sm: 28, md: 30 },
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 'bold',
                              mr: 1,
                              bgcolor: index === 0 ? '#FFD700' : index === 1 ? '#C0C0C0' : '#CD7F32',
                              color: index === 0 ? 'black' : index === 1 ? 'black' : 'white',
                              fontSize: { xs: '0.75rem', sm: '0.875rem' }
                            }}
                          >
                            {index + 1}
                          </Box>
                          <Typography
                            variant="h6"
                            fontWeight="bold"
                            sx={{
                              fontSize: { xs: '0.9rem', sm: '1rem', md: '1.1rem' },
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}
                          >
                            {student.name}
                          </Typography>
                        </Box>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          gutterBottom
                          sx={{
                            fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.8rem' },
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                        >
                          {student.studentClass || 'N/A'}
                        </Typography>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography
                            variant="body2"
                            fontWeight="medium"
                            sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.8rem' } }}
                          >
                            Score: <strong>{student.percentage}%</strong>
                          </Typography>
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.8rem' } }}
                          >
                            {student.timeTaken} min
                          </Typography>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))
              ) : (
                <Grid item xs={12}>
                  <Card
                    elevation={2}
                    sx={{
                      bgcolor: 'rgba(255,255,255,0.9)',
                      color: 'black',
                      borderRadius: { xs: 2, md: 3 },
                      p: { xs: 1.5, sm: 2 },
                      textAlign: 'center'
                    }}
                  >
                    <Typography variant="body1" sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>
                      No student performance data available yet.
                    </Typography>
                    <Button
                      variant="contained"
                      color="primary"
                      onClick={() => navigate('/admin/results')}
                      sx={{
                        mt: { xs: 1.5, sm: 2 },
                        fontSize: { xs: '0.75rem', sm: '0.8rem', md: '0.875rem' }
                      }}
                    >
                      View Results
                    </Button>
                  </Card>
                </Grid>
              )}
            </Grid>
          </CardContent>
        </Card>
      </Fade>

      {/* Recent Activities */}
      <Fade in={true} timeout={1300}>
        <Card elevation={0} sx={{ mt: 4, borderRadius: 4, border: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" component="h2" fontWeight="bold">
                Recent Activities
              </Typography>
              <Tooltip title="Refresh">
                <IconButton size="small" onClick={fetchDashboardData}>
                  <RefreshIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>

            <Divider sx={{ mb: 2 }} />

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress />
              </Box>
            ) : (
              <Box>
                {/* Activity items */}
                <Stack spacing={2}>
                  {[
                    {
                      id: 'activity-1',
                      type: 'student',
                      title: 'New student registered',
                      description: 'John Doe has registered as a new student',
                      time: '2 hours ago',
                      color: theme.palette.primary.main,
                      icon: <PeopleIcon />
                    },
                    {
                      id: 'activity-2',
                      type: 'exam-created',
                      title: 'Exam created',
                      description: 'Biology Final exam has been created',
                      time: '5 hours ago',
                      color: theme.palette.secondary.main,
                      icon: <AssignmentIcon />
                    },
                    {
                      id: 'activity-3',
                      type: 'exam-completed',
                      title: 'Exam completed',
                      description: 'Chemistry Quiz completed by 35 students',
                      time: '1 day ago',
                      color: theme.palette.success.main,
                      icon: <AssignmentIcon />
                    },
                    {
                      id: 'activity-4',
                      type: 'security',
                      title: 'Security alert',
                      description: 'Multiple device login detected for Alice Smith',
                      time: '2 days ago',
                      color: theme.palette.error.main,
                      icon: <WarningIcon />
                    }
                  ].map((activity, index) => (
                    <Card
                      key={`activity-card-${activity.id}-${index}`}
                      variant="outlined"
                      sx={{
                        borderRadius: 3,
                        borderColor: alpha(activity.color, 0.2)
                      }}
                    >
                      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Avatar sx={{ bgcolor: alpha(activity.color, 0.1), color: activity.color }}>
                            {activity.icon}
                          </Avatar>
                          <Box sx={{ ml: 2 }}>
                            <Typography variant="body1" fontWeight="medium">
                              {activity.title}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {activity.description}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {activity.time}
                            </Typography>
                          </Box>
                        </Box>
                      </CardContent>
                    </Card>
                  ))}
                </Stack>
              </Box>
            )}
          </CardContent>
        </Card>
      </Fade>

      {/* Quick Actions with enhanced styling */}
      <Box sx={{ mt: { xs: 4, md: 5 }, mb: 2 }}>
        <Typography
          variant="h6"
          sx={{
            mb: 2,
            fontSize: { xs: '1rem', sm: '1.1rem', md: '1.25rem' },
            fontWeight: 600,
            color: alpha(theme.palette.text.primary, 0.9),
            display: 'flex',
            alignItems: 'center',
            '&::before': {
              content: '""',
              display: 'inline-block',
              width: { xs: 16, sm: 20 },
              height: { xs: 3, sm: 4 },
              borderRadius: 4,
              background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
              mr: 1.5
            }
          }}
        >
          Quick Actions
        </Typography>
      </Box>
      <Fade in={true} timeout={1400}>
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2, sm: 2.5, md: 3 },
            borderRadius: { xs: 2, md: 3 },
            background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.03)}, ${alpha(theme.palette.secondary.main, 0.03)})`,
            border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
            position: 'relative',
            overflow: 'hidden',
            transition: 'all 0.3s ease',
            '&:hover': {
              boxShadow: `0 10px 30px ${alpha(theme.palette.primary.main, 0.1)}`,
            }
          }}
        >
          <Grid container spacing={{ xs: 2, sm: 2.5, md: 3 }} sx={{ mt: 1 }}>
            <Grid item xs={6} sm={6} md={2.4}>
              <Button
                fullWidth
                variant="contained"
                color="primary"
                startIcon={<AddIcon sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }} />}
                onClick={handleCreateExam}
                sx={{
                  py: { xs: 1, sm: 1.25, md: 1.5 },
                  px: { xs: 1, sm: 1.5, md: 2 },
                  borderRadius: { xs: 2, md: 3 },
                  boxShadow: `0 4px 14px ${alpha(theme.palette.primary.main, 0.3)}`,
                  fontSize: { xs: '0.7rem', sm: '0.8rem', md: '0.875rem' },
                  whiteSpace: 'nowrap',
                  minHeight: { xs: '40px', sm: '45px', md: '50px' },
                  background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${alpha(theme.palette.primary.dark, 0.9)})`,
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    boxShadow: `0 6px 20px ${alpha(theme.palette.primary.main, 0.4)}`,
                    transform: 'translateY(-2px)',
                    background: `linear-gradient(135deg, ${theme.palette.primary.dark}, ${theme.palette.primary.main})`,
                  },
                  '& .MuiButton-startIcon': {
                    marginRight: { xs: 0.5, sm: 0.75, md: 1 }
                  }
                }}
              >
                <Box sx={{ display: { xs: 'none', sm: 'inline' } }}>Create New</Box> Exam
              </Button>
            </Grid>
            <Grid item xs={6} sm={6} md={2.4}>
              <Button
                fullWidth
                variant="contained"
                color="secondary"
                startIcon={<PeopleIcon sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }} />}
                onClick={handleAddStudent}
                sx={{
                  py: { xs: 1, sm: 1.25, md: 1.5 },
                  px: { xs: 1, sm: 1.5, md: 2 },
                  borderRadius: { xs: 2, md: 3 },
                  boxShadow: `0 4px 14px ${alpha(theme.palette.secondary.main, 0.3)}`,
                  fontSize: { xs: '0.7rem', sm: '0.8rem', md: '0.875rem' },
                  whiteSpace: 'nowrap',
                  minHeight: { xs: '40px', sm: '45px', md: '50px' },
                  background: `linear-gradient(135deg, ${theme.palette.secondary.main}, ${alpha(theme.palette.secondary.dark, 0.9)})`,
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    boxShadow: `0 6px 20px ${alpha(theme.palette.secondary.main, 0.4)}`,
                    transform: 'translateY(-2px)',
                    background: `linear-gradient(135deg, ${theme.palette.secondary.dark}, ${theme.palette.secondary.main})`,
                  },
                  '& .MuiButton-startIcon': {
                    marginRight: { xs: 0.5, sm: 0.75, md: 1 }
                  }
                }}
              >
                <Box sx={{ display: { xs: 'none', sm: 'inline' } }}>Add New</Box> Student
              </Button>
            </Grid>
            <Grid item xs={6} sm={6} md={2.4}>
              <Button
                fullWidth
                variant="contained"
                color="success"
                startIcon={<CalendarIcon sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }} />}
                onClick={() => navigate('/admin/exams/schedule')}
                sx={{
                  py: { xs: 1, sm: 1.25, md: 1.5 },
                  px: { xs: 1, sm: 1.5, md: 2 },
                  borderRadius: { xs: 2, md: 3 },
                  boxShadow: `0 4px 14px ${alpha(theme.palette.success.main, 0.3)}`,
                  fontSize: { xs: '0.7rem', sm: '0.8rem', md: '0.875rem' },
                  whiteSpace: 'nowrap',
                  minHeight: { xs: '40px', sm: '45px', md: '50px' },
                  background: `linear-gradient(135deg, ${theme.palette.success.main}, ${alpha(theme.palette.success.dark, 0.9)})`,
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    boxShadow: `0 6px 20px ${alpha(theme.palette.success.main, 0.4)}`,
                    transform: 'translateY(-2px)',
                    background: `linear-gradient(135deg, ${theme.palette.success.dark}, ${theme.palette.success.main})`,
                  },
                  '& .MuiButton-startIcon': {
                    marginRight: { xs: 0.5, sm: 0.75, md: 1 }
                  }
                }}
              >
                <Box sx={{ display: { xs: 'none', sm: 'inline' } }}>Schedule</Box> Exam
              </Button>
            </Grid>
            <Grid item xs={6} sm={6} md={2.4}>
              <Button
                fullWidth
                variant="contained"
                color="info"
                startIcon={<AssignmentIcon sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }} />}
                onClick={() => navigate('/admin/exams/grading')}
                sx={{
                  py: { xs: 1, sm: 1.25, md: 1.5 },
                  px: { xs: 1, sm: 1.5, md: 2 },
                  borderRadius: { xs: 2, md: 3 },
                  boxShadow: `0 4px 14px ${alpha(theme.palette.info.main, 0.3)}`,
                  fontSize: { xs: '0.7rem', sm: '0.8rem', md: '0.875rem' },
                  whiteSpace: 'nowrap',
                  minHeight: { xs: '40px', sm: '45px', md: '50px' },
                  background: `linear-gradient(135deg, ${theme.palette.info.main}, ${alpha(theme.palette.info.dark, 0.9)})`,
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    boxShadow: `0 6px 20px ${alpha(theme.palette.info.main, 0.4)}`,
                    transform: 'translateY(-2px)',
                    background: `linear-gradient(135deg, ${theme.palette.info.dark}, ${theme.palette.info.main})`,
                  },
                  '& .MuiButton-startIcon': {
                    marginRight: { xs: 0.5, sm: 0.75, md: 1 }
                  }
                }}
              >
                <Box sx={{ display: { xs: 'none', sm: 'inline' } }}>AI</Box> Grading
              </Button>
            </Grid>
            <Grid item xs={6} sm={6} md={2.4}>
              <Button
                fullWidth
                variant="contained"
                color="warning"
                startIcon={<EmojiEventsIcon sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }} />}
                onClick={() => handleViewLeaderboard()}
                sx={{
                  py: { xs: 1, sm: 1.25, md: 1.5 },
                  px: { xs: 1, sm: 1.5, md: 2 },
                  borderRadius: { xs: 2, md: 3 },
                  boxShadow: `0 4px 14px ${alpha(theme.palette.warning.main, 0.3)}`,
                  fontSize: { xs: '0.7rem', sm: '0.8rem', md: '0.875rem' },
                  whiteSpace: 'nowrap',
                  minHeight: { xs: '40px', sm: '45px', md: '50px' },
                  background: `linear-gradient(135deg, ${theme.palette.warning.main}, ${alpha(theme.palette.warning.dark, 0.9)})`,
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    boxShadow: `0 6px 20px ${alpha(theme.palette.warning.main, 0.4)}`,
                    transform: 'translateY(-2px)',
                    background: `linear-gradient(135deg, ${theme.palette.warning.dark}, ${theme.palette.warning.main})`,
                  },
                  '& .MuiButton-startIcon': {
                    marginRight: { xs: 0.5, sm: 0.75, md: 1 }
                  }
                }}
              >
                <Box sx={{ display: { xs: 'none', sm: 'inline' } }}>View</Box> Leaderboard
              </Button>
            </Grid>
          </Grid>
        </Paper>
      </Fade>
    </Box>
  );
};

export default Home;
