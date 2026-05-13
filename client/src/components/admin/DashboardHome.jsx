import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Button,
  Card,
  CardContent,
  CardActions,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  IconButton,
  LinearProgress,
  Skeleton,
  Alert,
  Snackbar,
  useTheme,
  alpha,
  Fade,
  Zoom,
  Tooltip,
  Chip
} from '@mui/material';
import {
  People as PeopleIcon,
  Assignment as AssignmentIcon,
  CalendarToday as CalendarIcon,
  ArrowForward as ArrowForwardIcon,
  Notifications as NotificationsIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Person as PersonIcon,
  School as SchoolIcon,
  Refresh as RefreshIcon,
  EmojiEvents as TrophyIcon,
  Star as StarIcon,
  Whatshot as FireIcon,
  Bolt as BoltIcon,
  BarChart as ChartIcon,
  Lightbulb as LightbulbIcon,
  Security as SecurityIcon,
  Add as AddIcon,
  Dashboard as DashboardIcon,
  AccessTime as AccessTimeIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { getDashboardStats, getScheduledExams, getSecurityAlerts } from '../../services/adminService';

// Import gamification components
import StatsCard from '../gamification/StatsCard';
import ProgressCard from '../gamification/ProgressCard';
import AchievementCard from '../gamification/AchievementCard';
import Leaderboard from '../gamification/Leaderboard';

const DashboardHome = () => {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
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
  const [upcomingExams, setUpcomingExams] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Gamification data
  const [achievements, setAchievements] = useState([
    {
      id: 1,
      title: 'Exam Master',
      description: 'Create 10 exams with different question types',
      progress: 7,
      maxProgress: 10,
      level: 2,
      type: 'gold',
      icon: 'trophy',
      unlocked: false
    },
    {
      id: 2,
      title: 'Student Mentor',
      description: 'Register 50 students in the system',
      progress: 50,
      maxProgress: 50,
      level: 3,
      type: 'platinum',
      icon: 'star',
      unlocked: true
    },
    {
      id: 3,
      title: 'AI Grader',
      description: 'Grade 20 exams using AI',
      progress: 12,
      maxProgress: 20,
      level: 1,
      type: 'silver',
      icon: 'bolt',
      unlocked: false
    },
    {
      id: 4,
      title: 'Security Guardian',
      description: 'Resolve 15 security alerts',
      progress: 8,
      maxProgress: 15,
      level: 1,
      type: 'bronze',
      icon: 'school',
      unlocked: false
    }
  ]);

  const [leaderboardData, setLeaderboardData] = useState([
    {
      id: '1',
      name: 'John Smith',
      email: 'john@example.com',
      title: 'Math Teacher',
      score: 1250,
      progress: 85,
      avatar: ''
    },
    {
      id: '2',
      name: 'Sarah Johnson',
      email: 'sarah@example.com',
      title: 'Science Teacher',
      score: 980,
      progress: 72,
      avatar: ''
    },
    {
      id: 'current-user', // This would be the current user's ID
      name: 'You',
      email: 'your.email@example.com',
      title: 'Admin',
      score: 850,
      progress: 68,
      avatar: ''
    },
    {
      id: '3',
      name: 'Michael Brown',
      email: 'michael@example.com',
      title: 'History Teacher',
      score: 720,
      progress: 56,
      avatar: ''
    },
    {
      id: '4',
      name: 'Emily Davis',
      email: 'emily@example.com',
      title: 'English Teacher',
      score: 650,
      progress: 48,
      avatar: ''
    }
  ]);

  const [progressData, setProgressData] = useState({
    examCreation: {
      title: 'Exam Creation',
      subtitle: 'Progress towards your monthly goal',
      progress: 65,
      maxProgress: 100
    },
    studentRegistration: {
      title: 'Student Registration',
      subtitle: 'New students registered this month',
      progress: 42,
      maxProgress: 100
    },
    systemUsage: {
      title: 'System Usage',
      subtitle: 'Overall system utilization',
      progress: 78,
      maxProgress: 100
    }
  });

  const navigate = useNavigate();

  // Fetch dashboard data
  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Get dashboard stats from API using the adminService
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

      // Get upcoming exams from API using the adminService
      const examsData = await getScheduledExams();
      const formattedExams = examsData.map(exam => {
        // Format the date and time
        const examDate = new Date(exam.scheduledFor);
        return {
          id: exam._id,
          title: exam.title,
          date: examDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
          time: examDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          students: exam.students || 0
        };
      });

      setUpcomingExams(formattedExams);

      // Get recent activities from API (using the activities from dashboard stats)
      setRecentActivities(statsData.recentActivities || []);

      // Update progress data based on stats
      setProgressData({
        examCreation: {
          title: 'Exam Creation',
          subtitle: 'Progress towards your monthly goal',
          progress: Math.min(statsData.activeExams * 10 || 65, 100),
          maxProgress: 100
        },
        studentRegistration: {
          title: 'Student Registration',
          subtitle: 'New students registered this month',
          progress: Math.min(statsData.totalStudents / 2 || 42, 100),
          maxProgress: 100
        },
        systemUsage: {
          title: 'System Usage',
          subtitle: 'Overall system utilization',
          progress: 78, // This would come from a different API endpoint in a real app
          maxProgress: 100
        }
      });

      // Update achievements based on stats
      setAchievements(prevAchievements => {
        return prevAchievements.map(achievement => {
          // Update progress based on stats
          if (achievement.id === 1) { // Exam Master
            return {
              ...achievement,
              progress: Math.min(statsData.activeExams || 7, achievement.maxProgress),
              unlocked: (statsData.activeExams || 7) >= achievement.maxProgress
            };
          } else if (achievement.id === 2) { // Student Mentor
            return {
              ...achievement,
              progress: Math.min(statsData.totalStudents || 50, achievement.maxProgress),
              unlocked: (statsData.totalStudents || 50) >= achievement.maxProgress
            };
          } else if (achievement.id === 3) { // AI Grader
            // This would come from a different API endpoint in a real app
            return achievement;
          } else if (achievement.id === 4) { // Security Guardian
            return {
              ...achievement,
              progress: Math.min(statsData.securityAlerts * 3 || 8, achievement.maxProgress),
              unlocked: (statsData.securityAlerts * 3 || 8) >= achievement.maxProgress
            };
          }
          return achievement;
        });
      });

    } catch (err) {
      console.error('Error fetching dashboard data:', err);

      // Fallback to mock data if API fails
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
          value: 3,
          icon: <WarningIcon />,
          color: theme.palette.error.main,
          trend: -3,
          trendLabel: 'vs last week',
          tooltip: 'Active security alerts requiring attention'
        }
      ]);

      setUpcomingExams([
        { id: 1, title: 'Mathematics Final', date: 'Jun 15, 2023', time: '09:00 AM', students: 42 },
        { id: 2, title: 'Physics Midterm', date: 'Jun 18, 2023', time: '10:30 AM', students: 38 },
        { id: 3, title: 'Computer Science Quiz', date: 'Jun 20, 2023', time: '02:00 PM', students: 25 }
      ]);

      setRecentActivities([
        { id: 1, type: 'student_added', user: 'John Doe', time: '2 hours ago' },
        { id: 2, type: 'exam_created', exam: 'Biology Final', time: '5 hours ago' },
        { id: 3, type: 'exam_completed', exam: 'Chemistry Quiz', students: 35, time: '1 day ago' },
        { id: 4, type: 'security_alert', student: 'Alice Smith', issue: 'Multiple device login', time: '2 days ago' }
      ]);

      // Show error message
      setError('Could not connect to the server. Showing mock data instead.');
      setSnackbar({
        open: true,
        message: 'Failed to load dashboard data from server',
        severity: 'warning'
      });
    } finally {
      setLoading(false);
    }
  };

  // Load data on component mount
  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Handle snackbar close
  const handleSnackbarClose = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  // Handle refresh button click
  const handleRefresh = () => {
    fetchDashboardData();
  };

  // Navigate to create exam page
  const handleCreateExam = () => {
    navigate('/admin/exams/create');
  };

  // Navigate to view all exams
  const handleViewAllExams = () => {
    navigate('/admin/exams');
  };

  // Navigate to student management
  const handleAddStudent = () => {
    navigate('/admin/students/add');
  };

  // Navigate to schedule exam
  const handleScheduleExam = () => {
    navigate('/admin/exams/schedule');
  };

  return (
    <Box>
      {/* Dashboard Header */}
      <Paper
        elevation={3}
        sx={{
          mb: 4,
          p: 3,
          borderRadius: 4,
          background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, ${alpha(theme.palette.secondary.main, 0.05)} 100%)`,
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundImage: 'url(https://www.transparenttextures.com/patterns/cubes.png)',
            opacity: 0.04,
            zIndex: 0,
          }
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between',
            alignItems: { xs: 'flex-start', sm: 'center' },
            gap: { xs: 2, sm: 0 },
            position: 'relative',
            zIndex: 1
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Box
              sx={{
                width: 50,
                height: 50,
                borderRadius: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
                boxShadow: `0 8px 16px ${alpha(theme.palette.primary.main, 0.4)}`,
                mr: 2.5,
                transform: 'rotate(-5deg)',
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'rotate(0deg) scale(1.05)',
                }
              }}
            >
              <DashboardIcon sx={{ color: 'white', fontSize: 28 }} />
            </Box>
            <Box>
              <Typography
                variant="h4"
                component="h1"
                fontWeight="bold"
                color="text.primary"
                sx={{
                  fontSize: { xs: '1.5rem', sm: '1.75rem', md: '2rem' },
                  lineHeight: 1.2,
                  background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  textShadow: '0 2px 4px rgba(0,0,0,0.05)'
                }}
              >
                Welcome Back!
              </Typography>
              <Typography
                variant="subtitle1"
                color="text.secondary"
                sx={{ mt: 0.5 }}
              >
                {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </Typography>
            </Box>
          {loading && (
            <LinearProgress
              sx={{
                ml: 2,
                width: 40,
                height: 4,
                borderRadius: 2
              }}
            />
          )}
          {!loading && (
            <Tooltip title="Refresh dashboard">
              <IconButton
                color="primary"
                onClick={handleRefresh}
                sx={{
                  ml: 1,
                  '&:hover': {
                    transform: 'rotate(180deg)',
                    transition: 'transform 0.5s ease'
                  }
                }}
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            color="primary"
            onClick={handleAddStudent}
            startIcon={<PersonIcon />}
            sx={{
              display: { xs: 'none', md: 'flex' },
              borderRadius: 12,
              borderWidth: '2px',
              px: 2.5,
              py: 1,
              '&:hover': {
                borderWidth: '2px',
                transform: 'translateY(-3px)',
                boxShadow: `0 6px 15px ${alpha(theme.palette.primary.main, 0.2)}`,
              }
            }}
          >
            Add Student
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleCreateExam}
            startIcon={<AssignmentIcon />}
            sx={{
              borderRadius: 12,
              px: 2.5,
              py: 1,
              boxShadow: `0 6px 16px ${alpha(theme.palette.primary.main, 0.4)}`,
              background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
              '&:hover': {
                transform: 'translateY(-3px)',
                boxShadow: `0 8px 20px ${alpha(theme.palette.primary.main, 0.6)}`,
              }
            }}
          >
            Create New Exam
          </Button>
        </Box>
      </Paper>
      </Box>

      {error && (
        <Alert
          severity="error"
          variant="filled"
          sx={{
            mb: 3,
            borderRadius: theme.shape.borderRadius,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
          }}
          action={
            <Button color="inherit" size="small" onClick={handleRefresh}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {/* Stats Cards */}
      <Zoom in={true} timeout={800}>
        <Box>
          <Grid container spacing={3} sx={{ mb: 4 }}>
            {stats.map((stat, index) => (
              <Grid item xs={12} sm={6} md={3} key={index}>
                <StatsCard
                  title={stat.title}
                  value={loading ? '-' : stat.value}
                  icon={stat.icon}
                  color={stat.color}
                  trend={stat.trend}
                  trendLabel={stat.trendLabel}
                  tooltip={stat.tooltip}
                  animation={!loading}
                />
              </Grid>
            ))}
          </Grid>
        </Box>
      </Zoom>

      {/* Middle Section - Progress Cards */}
      <Fade in={true} timeout={1000}>
        <Box sx={{ mb: 4 }}>
          <Paper
            elevation={0}
            sx={{
              p: 2,
              mb: 3,
              borderRadius: 3,
              background: `linear-gradient(135deg, ${alpha(theme.palette.background.default, 0.6)}, ${alpha(theme.palette.background.default, 0.9)})`,
              backdropFilter: 'blur(10px)',
              border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
            }}
          >
            <Typography
              variant="h5"
              component="h2"
              fontWeight="bold"
              color="text.primary"
              sx={{
                mb: 1,
                display: 'flex',
                alignItems: 'center',
                '&::before': {
                  content: '""',
                  display: 'inline-block',
                  width: 4,
                  height: 24,
                  background: `linear-gradient(to bottom, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                  borderRadius: 4,
                  mr: 2
                }
              }}
            >
              Your Progress
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Track your progress and achievements in the system
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} md={4}>
                <ProgressCard
                  title={progressData.examCreation.title}
                  subtitle={progressData.examCreation.subtitle}
                  progress={progressData.examCreation.progress}
                  maxProgress={progressData.examCreation.maxProgress}
                  color={theme.palette.primary.main}
                  type="circular"
                  showButton={true}
                  buttonText="Create Exam"
                  onClick={handleCreateExam}
                  animation={!loading}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <ProgressCard
                  title={progressData.studentRegistration.title}
                  subtitle={progressData.studentRegistration.subtitle}
                  progress={progressData.studentRegistration.progress}
                  maxProgress={progressData.studentRegistration.maxProgress}
                  color={theme.palette.secondary.main}
                  type="circular"
                  showButton={true}
                  buttonText="Add Student"
                  onClick={handleAddStudent}
                  animation={!loading}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <ProgressCard
                  title={progressData.systemUsage.title}
                  subtitle={progressData.systemUsage.subtitle}
                  progress={progressData.systemUsage.progress}
                  maxProgress={progressData.systemUsage.maxProgress}
                  color={theme.palette.success.main}
                  type="circular"
                  showButton={true}
                  buttonText="View Reports"
                  onClick={() => navigate('/admin/reports')}
                  animation={!loading}
                />
              </Grid>
            </Grid>
          </Paper>
        </Box>
      </Fade>

      <Grid container spacing={4}>
        {/* Upcoming Exams */}
        <Grid item xs={12} md={6}>
          <Card
            elevation={4}
            sx={{
              p: 0,
              borderRadius: 4,
              overflow: 'hidden',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              transition: 'all 0.3s ease',
              '&:hover': {
                transform: 'translateY(-8px)',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
              },
              position: 'relative',
              border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '6px',
                background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.primary.light})`,
                boxShadow: `0 2px 10px ${alpha(theme.palette.primary.main, 0.3)}`,
              }
            }}
          >
            <Box
              sx={{
                py: 2,
                px: 3,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
                background: alpha(theme.palette.primary.main, 0.03),
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Avatar
                  sx={{
                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                    color: theme.palette.primary.main,
                    mr: 1.5,
                    width: 36,
                    height: 36,
                  }}
                >
                  <CalendarIcon fontSize="small" />
                </Avatar>
                <Typography variant="h6" fontWeight="bold" color="text.primary">
                  Upcoming Exams
                </Typography>
              </Box>
              <Chip
                label={`${upcomingExams.length} Exams`}
                size="small"
                color="primary"
                sx={{
                  fontWeight: 'medium',
                  borderRadius: '10px',
                  '& .MuiChip-label': { px: 1.5 }
                }}
              />
            </Box>

            {loading ? (
              <Box sx={{ p: 3 }}>
                {[1, 2, 3].map((item) => (
                  <Box key={item} sx={{ display: 'flex', mb: 3, alignItems: 'center' }}>
                    <Skeleton variant="circular" width={40} height={40} sx={{ mr: 2 }} />
                    <Box sx={{ width: '100%' }}>
                      <Skeleton variant="text" width="70%" height={24} />
                      <Skeleton variant="text" width="40%" height={20} />
                    </Box>
                  </Box>
                ))}
              </Box>
            ) : upcomingExams.length > 0 ? (
              <List sx={{ p: 0, flexGrow: 1, overflow: 'auto', maxHeight: 320 }}>
                {upcomingExams.map((exam, index) => (
                  <React.Fragment key={exam.id}>
                    <ListItem
                      secondaryAction={
                        <Tooltip title="View Details">
                          <IconButton
                            edge="end"
                            aria-label="view details"
                            onClick={() => navigate(`/admin/exams/${exam.id}`)}
                            sx={{
                              color: theme.palette.primary.main,
                              '&:hover': {
                                bgcolor: alpha(theme.palette.primary.main, 0.1),
                                transform: 'scale(1.1)',
                              }
                            }}
                          >
                            <ArrowForwardIcon />
                          </IconButton>
                        </Tooltip>
                      }
                      sx={{
                        py: 2,
                        px: 3,
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          bgcolor: alpha(theme.palette.primary.main, 0.04),
                          transform: 'translateX(4px)',
                        }
                      }}
                    >
                      <ListItemAvatar>
                        <Avatar
                          sx={{
                            bgcolor: alpha(theme.palette.primary.main, 0.1),
                            color: theme.palette.primary.main,
                            boxShadow: `0 4px 8px ${alpha(theme.palette.primary.main, 0.2)}`,
                          }}
                        >
                          <AssignmentIcon />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Typography variant="subtitle1" fontWeight="bold" color="text.primary">
                            {exam.title}
                          </Typography>
                        }
                        secondary={
                          <Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                              <CalendarIcon sx={{ fontSize: '0.875rem', color: 'text.secondary', mr: 0.5 }} />
                              <Typography variant="body2" color="text.secondary">
                                {exam.date} at {exam.time}
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                              <PeopleIcon sx={{ fontSize: '0.875rem', color: 'text.secondary', mr: 0.5 }} />
                              <Typography variant="body2" color="text.secondary">
                                {exam.students} students
                              </Typography>
                            </Box>
                          </Box>
                        }
                      />
                    </ListItem>
                    {index < upcomingExams.length - 1 && (
                      <Divider sx={{ mx: 3, borderColor: alpha(theme.palette.divider, 0.08) }} />
                    )}
                  </React.Fragment>
                ))}
              </List>
            ) : (
              <Box sx={{ p: 4, textAlign: 'center', flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <CalendarIcon sx={{ fontSize: 60, color: alpha(theme.palette.primary.main, 0.2), mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  No upcoming exams
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Schedule an exam to see it here
                </Typography>
              </Box>
            )}

            <Box sx={{
              p: 2,
              textAlign: 'center',
              borderTop: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
              background: alpha(theme.palette.primary.main, 0.02),
            }}>
              <Button
                variant="outlined"
                color="primary"
                endIcon={<ArrowForwardIcon />}
                onClick={handleViewAllExams}
                sx={{
                  borderRadius: theme.shape.borderRadius,
                  textTransform: 'none',
                  fontWeight: 'medium',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                  }
                }}
              >
                View All Exams
              </Button>
            </Box>
          </Card>
        </Grid>

        {/* Recent Activities */}
        <Grid item xs={12} md={6}>
          <Card
            elevation={4}
            sx={{
              p: 0,
              borderRadius: 4,
              overflow: 'hidden',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              transition: 'all 0.3s ease',
              '&:hover': {
                transform: 'translateY(-8px)',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
              },
              position: 'relative',
              border: `1px solid ${alpha(theme.palette.secondary.main, 0.1)}`,
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '6px',
                background: `linear-gradient(90deg, ${theme.palette.secondary.main}, ${theme.palette.secondary.light})`,
                boxShadow: `0 2px 10px ${alpha(theme.palette.secondary.main, 0.3)}`,
              }
            }}
          >
            <Box
              sx={{
                py: 2,
                px: 3,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
                background: alpha(theme.palette.secondary.main, 0.03),
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Avatar
                  sx={{
                    bgcolor: alpha(theme.palette.secondary.main, 0.1),
                    color: theme.palette.secondary.main,
                    mr: 1.5,
                    width: 36,
                    height: 36,
                  }}
                >
                  <NotificationsIcon fontSize="small" />
                </Avatar>
                <Typography variant="h6" fontWeight="bold" color="text.primary">
                  Recent Activities
                </Typography>
              </Box>
              <Chip
                label={`${recentActivities.length} Activities`}
                size="small"
                color="secondary"
                sx={{
                  fontWeight: 'medium',
                  borderRadius: '10px',
                  '& .MuiChip-label': { px: 1.5 }
                }}
              />
            </Box>

            {loading ? (
              <Box sx={{ p: 3 }}>
                {[1, 2, 3, 4].map((item) => (
                  <Box key={item} sx={{ display: 'flex', mb: 3, alignItems: 'center' }}>
                    <Skeleton variant="circular" width={40} height={40} sx={{ mr: 2 }} />
                    <Box sx={{ width: '100%' }}>
                      <Skeleton variant="text" width="80%" height={24} />
                      <Skeleton variant="text" width="30%" height={20} />
                    </Box>
                  </Box>
                ))}
              </Box>
            ) : recentActivities.length > 0 ? (
              <List sx={{ p: 0, flexGrow: 1, overflow: 'auto', maxHeight: 320 }}>
                {recentActivities.map((activity, index) => (
                  <React.Fragment key={activity.id}>
                    <ListItem
                      sx={{
                        py: 2,
                        px: 3,
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          bgcolor: alpha(theme.palette.secondary.main, 0.04),
                          transform: 'translateX(4px)',
                        }
                      }}
                    >
                      <ListItemAvatar>
                        <Avatar
                          sx={{
                            bgcolor: alpha(getActivityColor(activity.type), 0.1),
                            color: getActivityColor(activity.type),
                            boxShadow: `0 4px 8px ${alpha(getActivityColor(activity.type), 0.2)}`,
                          }}
                        >
                          {getActivityIcon(activity.type)}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Typography variant="subtitle1" fontWeight="medium" color="text.primary">
                            {getActivityText(activity)}
                          </Typography>
                        }
                        secondary={
                          <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                            <AccessTimeIcon sx={{ fontSize: '0.875rem', color: 'text.secondary', mr: 0.5 }} />
                            <Typography variant="body2" color="text.secondary">
                              {activity.time}
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                    {index < recentActivities.length - 1 && (
                      <Divider sx={{ mx: 3, borderColor: alpha(theme.palette.divider, 0.08) }} />
                    )}
                  </React.Fragment>
                ))}
              </List>
            ) : (
              <Box sx={{ p: 4, textAlign: 'center', flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <NotificationsIcon sx={{ fontSize: 60, color: alpha(theme.palette.secondary.main, 0.2), mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  No recent activities
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Activities will appear here as you use the system
                </Typography>
              </Box>
            )}

            <Box sx={{
              p: 2,
              textAlign: 'center',
              borderTop: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
              background: alpha(theme.palette.secondary.main, 0.02),
            }}>
              <Button
                variant="outlined"
                color="secondary"
                endIcon={<ArrowForwardIcon />}
                sx={{
                  borderRadius: theme.shape.borderRadius,
                  textTransform: 'none',
                  fontWeight: 'medium',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                  }
                }}
              >
                View All Activities
              </Button>
            </Box>
          </Card>
        </Grid>

        {/* Achievements Section */}
        <Grid item xs={12}>
          <Paper
            elevation={0}
            sx={{
              p: 3,
              mb: 3,
              borderRadius: 3,
              background: `linear-gradient(135deg, ${alpha(theme.palette.background.default, 0.6)}, ${alpha(theme.palette.background.default, 0.9)})`,
              backdropFilter: 'blur(10px)',
              border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
              position: 'relative',
              overflow: 'hidden',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                backgroundImage: 'url(https://www.transparenttextures.com/patterns/cubes.png)',
                opacity: 0.03,
                zIndex: 0,
              }
            }}
          >
            <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Avatar
                  sx={{
                    bgcolor: alpha(theme.palette.gamification.gold, 0.1),
                    color: theme.palette.gamification.gold,
                    mr: 2,
                    width: 48,
                    height: 48,
                    boxShadow: `0 4px 12px ${alpha(theme.palette.gamification.gold, 0.3)}`,
                  }}
                >
                  <TrophyIcon />
                </Avatar>
                <Box>
                  <Typography variant="h5" fontWeight="bold" color="text.primary">
                    Your Achievements
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Track your progress and unlock new achievements
                  </Typography>
                </Box>
              </Box>
              <Button
                variant="outlined"
                color="primary"
                endIcon={<ArrowForwardIcon />}
                sx={{
                  textTransform: 'none',
                  fontWeight: 'medium',
                  borderRadius: 12,
                  px: 2,
                  '&:hover': {
                    transform: 'translateX(4px)',
                    transition: 'transform 0.2s ease'
                  }
                }}
              >
                View All Achievements
              </Button>
            </Box>

          <Grid container spacing={3}>
            {achievements.map((achievement) => (
              <Grid item xs={12} sm={6} md={3} key={achievement.id}>
                <AchievementCard
                  title={achievement.title}
                  description={achievement.description}
                  progress={achievement.progress}
                  maxProgress={achievement.maxProgress}
                  level={achievement.level}
                  type={achievement.type}
                  icon={achievement.icon}
                  unlocked={achievement.unlocked}
                />
              </Grid>
            ))}
          </Grid>
          </Paper>
        </Grid>

        {/* Leaderboard and Quick Actions Section */}
        <Grid item xs={12} container spacing={4} sx={{ mt: 2 }}>
          {/* Leaderboard */}
          <Grid item xs={12} md={6}>
            <Leaderboard
              title="Admin Leaderboard"
              data={leaderboardData}
              maxItems={5}
              showViewAll={true}
              onViewAll={() => navigate('/admin/leaderboard')}
              highlightCurrentUser={true}
              currentUserId="current-user"
              type="score"
            />
          </Grid>

          {/* Quick Actions */}
          <Grid item xs={12} md={6}>
            <Card
              elevation={4}
              sx={{
                p: 0,
                borderRadius: theme.shape.borderRadius,
                overflow: 'hidden',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-5px)',
                  boxShadow: '0 16px 32px rgba(0, 0, 0, 0.1)',
                },
                position: 'relative',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '4px',
                  background: `linear-gradient(90deg, ${theme.palette.info.main}, ${theme.palette.info.light})`,
                }
              }}
            >
              <Box
                sx={{
                  py: 2,
                  px: 3,
                  display: 'flex',
                  alignItems: 'center',
                  borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
                  background: alpha(theme.palette.info.main, 0.03),
                }}
              >
                <Avatar
                  sx={{
                    bgcolor: alpha(theme.palette.info.main, 0.1),
                    color: theme.palette.info.main,
                    mr: 1.5,
                    width: 36,
                    height: 36,
                  }}
                >
                  <LightbulbIcon fontSize="small" />
                </Avatar>
                <Typography variant="h6" fontWeight="bold" color="text.primary">
                  Quick Actions
                </Typography>
              </Box>

              <Box sx={{ p: 3, flexGrow: 1 }}>
                <Grid container spacing={2}>
                  {[
                    { title: 'Add Student', icon: PersonIcon, color: theme.palette.primary.main, action: handleAddStudent },
                    { title: 'Create Exam', icon: AssignmentIcon, color: theme.palette.secondary.main, action: handleCreateExam },
                    { title: 'Schedule Exam', icon: CalendarIcon, color: theme.palette.success.main, action: handleScheduleExam },
                    { title: 'View Reports', icon: ChartIcon, color: theme.palette.info.main, action: () => navigate('/admin/reports') }
                  ].map((action, index) => (
                    <Grid item xs={6} key={index}>
                      <Button
                        variant="outlined"
                        fullWidth
                        onClick={action.action}
                        sx={{
                          p: 2,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          borderColor: alpha(action.color, 0.3),
                          color: action.color,
                          borderWidth: '2px',
                          borderRadius: theme.shape.borderRadius,
                          transition: 'all 0.3s ease',
                          '&:hover': {
                            borderColor: action.color,
                            bgcolor: alpha(action.color, 0.05),
                            transform: 'translateY(-5px)',
                            boxShadow: `0 8px 15px ${alpha(action.color, 0.2)}`,
                          }
                        }}
                      >
                        <action.icon sx={{ fontSize: 32, mb: 1 }} />
                        {action.title}
                      </Button>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            </Card>
          </Grid>
        </Grid>
      </Grid>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={handleSnackbarClose}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
          variant="filled"
          elevation={6}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

// Helper functions for activity feed
const getActivityColor = (type) => {
  switch (type) {
    case 'student_added':
      return '#0D406C'; // Deep Navy Blue
    case 'exam_created':
      return '#9DF6D6'; // Mint Green
    case 'exam_completed':
      return '#0CBD73'; // Emerald Green
    case 'security_alert':
      return '#d32f2f';
    default:
      return '#A2F8EC'; // Light Aqua/Turquoise
  }
};

const getActivityIcon = (type) => {
  switch (type) {
    case 'student_added':
      return <PersonIcon sx={{ color: '#0D406C' }} />;
    case 'exam_created':
      return <AssignmentIcon sx={{ color: '#9DF6D6' }} />;
    case 'exam_completed':
      return <CheckCircleIcon sx={{ color: '#0CBD73' }} />;
    case 'security_alert':
      return <WarningIcon sx={{ color: '#d32f2f' }} />;
    default:
      return <NotificationsIcon sx={{ color: '#A2F8EC' }} />;
  }
};

const getActivityText = (activity) => {
  switch (activity.type) {
    case 'student_added':
      return `New student ${activity.user} was added`;
    case 'exam_created':
      return `New exam "${activity.exam}" was created`;
    case 'exam_completed':
      return `Exam "${activity.exam}" completed by ${activity.students} students`;
    case 'security_alert':
      return `Security alert: ${activity.student} - ${activity.issue}`;
    default:
      return 'Unknown activity';
  }
};

export default DashboardHome;
