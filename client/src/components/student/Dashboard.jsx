import { useState, useEffect, useContext } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Container,
  Grid,
  Paper,
  Typography,
  Box,
  Button,
  Card,
  CardContent,
  CardMedia,
  Divider,
  Avatar,
  Chip,
  LinearProgress,
  Grow,
  Zoom,
  Badge,
  IconButton,
  Tooltip,
  Skeleton,
  useTheme,
  alpha
} from '@mui/material';
import {
  School,
  AssignmentTurnedIn,
  EmojiEvents,
  ArrowForward,
  CheckCircle,
  AccessTime,
  PlayArrow,
  CalendarToday,
  Refresh,
  Star,
  StarBorder,
  StarHalf,
  LocalFireDepartment,
  Celebration,
  WorkspacePremium,
  AutoGraph,
  Leaderboard as LeaderboardIcon,
  Assessment
} from '@mui/icons-material';
import { AuthContext } from '../../context/AuthContext';
import api from '../../services/api';
import { getClassLeaderboard } from '../../services/studentService';
import StudentLayout from './StudentLayout';

// Import gamification components
import StatsCard from '../gamification/StatsCard';
import Leaderboard from '../gamification/Leaderboard';

const Dashboard = () => {
  const theme = useTheme();
  const { user } = useContext(AuthContext);
  const [stats, setStats] = useState({
    totalExams: 0,
    completedExams: 0,
    availableExams: 0,
    averageScore: 0,
    totalPoints: 0,
    streak: 0,
    rank: 0,
    level: 1,
    xp: 0,
    nextLevelXp: 100
  });
  const [recentExams, setRecentExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [achievements, setAchievements] = useState([]);
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [studyStreak] = useState(5); // Days in a row

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Fetch available exams
        const examsRes = await api.get('/student/exams');

        // Fetch results
        const resultsRes = await api.get('/student/results');

        // Calculate stats
        const exams = examsRes.data;
        const results = resultsRes.data;

        const completed = exams.filter(exam => exam.status === 'completed').length;
        const available = exams.filter(exam => exam.status === 'not-started').length;

        // Calculate average score
        let totalScore = 0;
        let totalMaxScore = 0;

        results.forEach(result => {
          totalScore += result.totalScore;
          totalMaxScore += result.maxPossibleScore;
        });

        const averageScore = totalMaxScore > 0
          ? Math.round((totalScore / totalMaxScore) * 100)
          : 0;

        // Calculate gamification stats
        const totalPoints = completed * 100 + Math.round(totalScore * 0.5);
        const streak = Math.min(5, completed); // Mock streak data
        const level = Math.floor(totalPoints / 100) + 1;
        const xp = totalPoints % 100;
        const nextLevelXp = 100;
        const rank = 3; // Mock rank data

        setStats({
          totalExams: exams.length,
          completedExams: completed,
          availableExams: available,
          averageScore,
          totalPoints,
          streak,
          rank,
          level,
          xp,
          nextLevelXp
        });

        // Get recent exams (both completed and available)
        const sortedExams = [...exams].sort((a, b) => {
          // Sort by status (in-progress first, then not-started, then completed)
          const statusOrder = { 'in-progress': 0, 'not-started': 1, 'completed': 2 };
          return statusOrder[a.status] - statusOrder[b.status];
        }).slice(0, 3); // Get top 3

        setRecentExams(sortedExams);

        // Mock achievements data
        setAchievements([
          {
            id: 1,
            title: 'First Exam',
            description: 'Complete your first exam',
            progress: completed > 0 ? 1 : 0,
            maxProgress: 1,
            level: 1,
            type: completed > 0 ? 'gold' : 'bronze',
            icon: 'trophy',
            unlocked: completed > 0
          },
          {
            id: 2,
            title: 'Perfect Score',
            description: 'Get 100% on any exam',
            progress: averageScore === 100 ? 1 : 0,
            maxProgress: 1,
            level: 2,
            type: 'platinum',
            icon: 'star',
            unlocked: averageScore === 100
          },
          {
            id: 3,
            title: 'Exam Master',
            description: 'Complete 5 exams',
            progress: completed,
            maxProgress: 5,
            level: 3,
            type: 'silver',
            icon: 'bolt',
            unlocked: completed >= 5
          },
          {
            id: 4,
            title: 'Study Streak',
            description: 'Maintain a 5-day study streak',
            progress: studyStreak,
            maxProgress: 5,
            level: 2,
            type: studyStreak >= 5 ? 'gold' : 'bronze',
            icon: 'fire',
            unlocked: studyStreak >= 5
          }
        ]);

        // Fetch real leaderboard data
        try {
          const leaderboardResponse = await getClassLeaderboard();
          if (leaderboardResponse && leaderboardResponse.leaderboard) {
            // Format the data for the leaderboard component
            const formattedLeaderboard = leaderboardResponse.leaderboard.map(student => ({
              id: student.id,
              name: student.name,
              score: student.percentage || student.score || 0,
              avatar: '',
              isCurrentUser: student.isCurrentUser,
              studentClass: student.studentClass,
              examCount: student.examCount
            }));
            setLeaderboardData(formattedLeaderboard);
          } else {
            // Fallback to mock data if no real data is available
            setLeaderboardData([
              { id: user?.id || 1, name: user?.firstName ? `${user.firstName} ${user.lastName}` : 'You', score: totalPoints, avatar: '', isCurrentUser: true }
            ]);
          }
        } catch (leaderboardError) {
          console.error('Error fetching leaderboard:', leaderboardError);
          // Fallback to mock data if there's an error
          setLeaderboardData([
            { id: user?.id || 1, name: user?.firstName ? `${user.firstName} ${user.lastName}` : 'You', score: totalPoints, avatar: '', isCurrentUser: true }
          ]);
        }

        setLoading(false);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [user, studyStreak]);

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

  // Helper functions for UI elements

  // Get current date
  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <StudentLayout>
      <Container maxWidth="lg" sx={{ mb: { xs: 4, sm: 6, md: 8 }, mt: { xs: 3, sm: 4, md: 5 }, px: { xs: 1, sm: 2, md: 3 } }}>
        {/* Hero Section */}
        <Grow in={true} timeout={800}>
          <Grid container spacing={{ xs: 2, sm: 3, md: 4 }}>
          {/* Hero Card with Level Progress - Ultra Enhanced */}
          <Grid item xs={12}>
            <Paper
              elevation={0}
              sx={{
                p: { xs: 4, sm: 5, md: 6 },
                display: 'flex',
                flexDirection: { xs: 'column', md: 'row' },
                alignItems: 'center',
                justifyContent: 'space-between',
                borderRadius: { xs: 4, md: 6 },
                background: `linear-gradient(135deg,
                  ${theme.palette.primary.dark} 0%,
                  ${theme.palette.primary.main} 50%,
                  ${theme.palette.secondary.main} 100%)`,
                color: 'white',
                position: 'relative',
                overflow: 'hidden',
                gap: { xs: 4, md: 5 },
                boxShadow: `0 25px 50px ${alpha(theme.palette.primary.main, 0.3)}`,
                transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                '&:hover': {
                  boxShadow: `0 30px 60px ${alpha(theme.palette.primary.main, 0.4)}`,
                  transform: 'translateY(-8px)'
                }
              }}
            >
              {/* Enhanced decorative elements */}
              <Box
                sx={{
                  position: 'absolute',
                  top: -50,
                  right: -50,
                  width: { xs: '150px', sm: '180px', md: '220px' },
                  height: { xs: '150px', sm: '180px', md: '220px' },
                  background: 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)',
                  borderRadius: '50%',
                  display: { xs: 'none', sm: 'block' },
                  animation: 'heroFloat 10s ease-in-out infinite',
                  '@keyframes heroFloat': {
                    '0%': { transform: 'translateY(0px) rotate(0deg)' },
                    '50%': { transform: 'translateY(-20px) rotate(180deg)' },
                    '100%': { transform: 'translateY(0px) rotate(360deg)' }
                  }
                }}
              />
              <Box
                sx={{
                  position: 'absolute',
                  bottom: -40,
                  left: -40,
                  width: { xs: '120px', sm: '140px', md: '170px' },
                  height: { xs: '120px', sm: '140px', md: '170px' },
                  background: 'radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 70%)',
                  borderRadius: '50%',
                  display: { xs: 'none', sm: 'block' },
                  animation: 'heroFloat 12s ease-in-out infinite reverse',
                }}
              />

              {/* Hero sparkles */}
              {[...Array(10)].map((_, i) => (
                <Box
                  key={i}
                  sx={{
                    position: 'absolute',
                    width: { xs: 3, sm: 4, md: 5 },
                    height: { xs: 3, sm: 4, md: 5 },
                    borderRadius: '50%',
                    bgcolor: 'rgba(255,255,255,0.8)',
                    top: `${10 + i * 8}%`,
                    left: `${5 + i * 9}%`,
                    animation: `heroSparkle 5s ease-in-out infinite ${i * 0.4}s`,
                    '@keyframes heroSparkle': {
                      '0%, 100%': { opacity: 0, transform: 'scale(0) rotate(0deg)' },
                      '50%': { opacity: 1, transform: 'scale(1) rotate(180deg)' }
                    }
                  }}
                />
              ))}

              <Box sx={{
                display: 'flex',
                alignItems: { xs: 'flex-start', sm: 'center' },
                flexDirection: { xs: 'column', sm: 'row' },
                mb: { xs: 2, md: 0 },
                width: { xs: '100%', md: 'auto' },
                gap: { xs: 3, sm: 4 }
              }}>
                <Box sx={{ position: 'relative' }}>
                  {/* Enhanced rotating border */}
                  <Box
                    sx={{
                      position: 'absolute',
                      top: -8,
                      left: -8,
                      right: -8,
                      bottom: -8,
                      borderRadius: '50%',
                      background: `conic-gradient(
                        ${theme.palette.secondary.main} 0deg,
                        ${theme.palette.warning.main} 120deg,
                        ${theme.palette.info.main} 240deg,
                        ${theme.palette.secondary.main} 360deg
                      )`,
                      animation: 'avatarRotate 8s linear infinite',
                      '@keyframes avatarRotate': {
                        '0%': { transform: 'rotate(0deg)' },
                        '100%': { transform: 'rotate(360deg)' }
                      }
                    }}
                  />

                  <Avatar
                    sx={{
                      bgcolor: 'background.paper',
                      color: theme.palette.primary.main,
                      width: { xs: 80, sm: 90, md: 110 },
                      height: { xs: 80, sm: 90, md: 110 },
                      fontSize: { xs: '2rem', sm: '2.5rem', md: '3rem' },
                      fontWeight: 'bold',
                      boxShadow: `0 12px 30px ${alpha(theme.palette.primary.main, 0.4)}`,
                      border: '6px solid white',
                      position: 'relative',
                      zIndex: 2,
                      transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                      animation: 'avatarFloat 6s ease-in-out infinite',
                      '@keyframes avatarFloat': {
                        '0%, 100%': { transform: 'translateY(0px)' },
                        '50%': { transform: 'translateY(-8px)' }
                      },
                      '&:hover': {
                        transform: 'scale(1.08) translateY(-4px)',
                        boxShadow: `0 16px 40px ${alpha(theme.palette.primary.main, 0.5)}`,
                      }
                    }}
                  >
                    {user?.firstName?.charAt(0).toUpperCase() || 'S'}
                  </Avatar>

                  {/* Enhanced level badge */}
                  <Tooltip title="Your current level" arrow placement="top">
                    <Avatar
                      sx={{
                        position: 'absolute',
                        bottom: -8,
                        right: -8,
                        width: { xs: 36, sm: 42, md: 48 },
                        height: { xs: 36, sm: 42, md: 48 },
                        bgcolor: theme.palette.warning.main,
                        color: 'white',
                        border: '4px solid white',
                        boxShadow: `0 6px 16px ${alpha(theme.palette.warning.main, 0.4)}`,
                        fontSize: { xs: '0.9rem', sm: '1rem', md: '1.2rem' },
                        fontWeight: 'bold',
                        transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                        animation: 'levelPulse 3s ease-in-out infinite',
                        '@keyframes levelPulse': {
                          '0%, 100%': { transform: 'scale(1)' },
                          '50%': { transform: 'scale(1.1)' }
                        },
                        '&:hover': {
                          transform: 'scale(1.2) rotate(15deg)',
                          boxShadow: `0 8px 20px ${alpha(theme.palette.warning.main, 0.6)}`,
                        },
                        zIndex: 3
                      }}
                    >
                      {loading ? '...' : stats.level}
                    </Avatar>
                  </Tooltip>

                  {/* Online status indicator */}
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      width: { xs: 16, sm: 18, md: 20 },
                      height: { xs: 16, sm: 18, md: 20 },
                      borderRadius: '50%',
                      bgcolor: 'success.main',
                      border: '3px solid white',
                      boxShadow: `0 0 0 3px ${alpha(theme.palette.success.main, 0.3)}`,
                      animation: 'onlinePulse 2s ease-in-out infinite',
                      '@keyframes onlinePulse': {
                        '0%, 100%': { transform: 'scale(1)' },
                        '50%': { transform: 'scale(1.2)' }
                      },
                      zIndex: 3
                    }}
                  />

                  {/* Achievement star */}
                  <Box
                    sx={{
                      position: 'absolute',
                      top: -5,
                      left: -5,
                      width: { xs: 24, sm: 28, md: 32 },
                      height: { xs: 24, sm: 28, md: 32 },
                      borderRadius: '50%',
                      bgcolor: theme.palette.info.main,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: `0 4px 12px ${alpha(theme.palette.info.main, 0.4)}`,
                      animation: 'starShine 4s ease-in-out infinite',
                      '@keyframes starShine': {
                        '0%, 100%': { transform: 'scale(1) rotate(0deg)' },
                        '50%': { transform: 'scale(1.15) rotate(180deg)' }
                      },
                      zIndex: 3
                    }}
                  >
                    <Star sx={{ color: 'white', fontSize: { xs: '0.8rem', sm: '1rem', md: '1.2rem' } }} />
                  </Box>
                </Box>
                <Box sx={{ maxWidth: { xs: '100%', md: '350px' } }}>
                  <Typography
                    variant="h2"
                    component="h1"
                    fontWeight="bold"
                    sx={{
                      fontSize: { xs: '2rem', sm: '2.5rem', md: '3rem', lg: '3.5rem' },
                      textShadow: '0 6px 20px rgba(0,0,0,0.4)',
                      lineHeight: 1.1,
                      mb: 2,
                      background: 'linear-gradient(135deg, #ffffff 0%, #f0f0f0 50%, #ffffff 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      letterSpacing: '-0.02em',
                      position: 'relative',
                      '&::after': {
                        content: '""',
                        position: 'absolute',
                        bottom: -8,
                        left: 0,
                        width: '60%',
                        height: 4,
                        background: 'linear-gradient(90deg, rgba(255,255,255,0.8), rgba(255,255,255,0.3))',
                        borderRadius: 2
                      }
                    }}
                  >
                    Welcome back, {user?.firstName || 'Student'}! 👋
                  </Typography>
                  <Typography
                    variant="h6"
                    sx={{
                      color: 'rgba(255,255,255,0.9)',
                      mb: 3,
                      fontSize: { xs: '1.1rem', sm: '1.3rem', md: '1.5rem' },
                      fontWeight: 'medium',
                      lineHeight: 1.4,
                      maxWidth: '95%'
                    }}
                  >
                    Ready to continue your learning journey and achieve new milestones? Let's make today count!
                  </Typography>

                  <Box sx={{
                    display: 'flex',
                    alignItems: 'center',
                    mt: 1,
                    flexWrap: 'wrap',
                    gap: 1.5
                  }}>
                    <Chip
                      icon={<WorkspacePremium sx={{
                        color: 'white !important',
                        fontSize: { xs: '1rem', sm: '1.1rem' }
                      }} />}
                      label={`${loading ? '...' : stats.totalPoints} XP`}
                      sx={{
                        bgcolor: alpha(theme.palette.secondary.main, 0.3),
                        color: 'white',
                        borderRadius: 6,
                        height: { xs: 32, sm: 36 },
                        border: '1px solid rgba(255,255,255,0.2)',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          bgcolor: alpha(theme.palette.secondary.main, 0.4),
                          transform: 'translateY(-2px)'
                        },
                        '& .MuiChip-label': {
                          fontWeight: 'bold',
                          fontSize: { xs: '0.8rem', sm: '0.85rem', md: '0.9rem' },
                          px: { xs: 1.5, sm: 2 }
                        },
                        '& .MuiChip-icon': {
                          ml: { xs: 0.75, sm: 1 }
                        }
                      }}
                    />
                    <Chip
                      icon={<LocalFireDepartment sx={{
                        color: 'white !important',
                        fontSize: { xs: '1rem', sm: '1.1rem' }
                      }} />}
                      label={`${loading ? '...' : stats.streak} Day Streak`}
                      sx={{
                        bgcolor: alpha('#ff9800', 0.3),
                        color: 'white',
                        borderRadius: 6,
                        height: { xs: 32, sm: 36 },
                        border: '1px solid rgba(255,255,255,0.2)',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          bgcolor: alpha('#ff9800', 0.4),
                          transform: 'translateY(-2px)'
                        },
                        '& .MuiChip-label': {
                          fontWeight: 'bold',
                          fontSize: { xs: '0.8rem', sm: '0.85rem', md: '0.9rem' },
                          px: { xs: 1.5, sm: 2 }
                        },
                        '& .MuiChip-icon': {
                          ml: { xs: 0.75, sm: 1 }
                        }
                      }}
                    />
                    <Chip
                      icon={<CalendarToday sx={{
                        color: 'white !important',
                        fontSize: { xs: '1rem', sm: '1.1rem' }
                      }} />}
                      label={currentDate}
                      sx={{
                        bgcolor: alpha(theme.palette.info.main, 0.3),
                        color: 'white',
                        borderRadius: 6,
                        height: { xs: 32, sm: 36 },
                        border: '1px solid rgba(255,255,255,0.2)',
                        display: { xs: 'none', md: 'flex' },
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          bgcolor: alpha(theme.palette.info.main, 0.4),
                          transform: 'translateY(-2px)'
                        },
                        '& .MuiChip-label': {
                          fontWeight: 'bold',
                          fontSize: { xs: '0.8rem', sm: '0.85rem', md: '0.9rem' },
                          px: { xs: 1.5, sm: 2 }
                        },
                        '& .MuiChip-icon': {
                          ml: { xs: 0.75, sm: 1 }
                        }
                      }}
                    />
                  </Box>

                  {/* Level Progress Bar */}
                  <Box sx={{ mt: 3, width: '100%', maxWidth: { xs: '100%', sm: 350 } }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography
                        variant="body2"
                        fontWeight="bold"
                        sx={{
                          fontSize: { xs: '0.75rem', sm: '0.8rem', md: '0.85rem' },
                          color: 'rgba(255,255,255,0.9)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.5
                        }}
                      >
                        <WorkspacePremium fontSize="small" /> Level {loading ? '...' : stats.level}
                      </Typography>
                      <Typography
                        variant="body2"
                        fontWeight="bold"
                        sx={{
                          fontSize: { xs: '0.75rem', sm: '0.8rem', md: '0.85rem' },
                          color: 'rgba(255,255,255,0.9)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.5
                        }}
                      >
                        {loading ? '...' : stats.xp}/{loading ? '...' : stats.nextLevelXp} XP
                      </Typography>
                    </Box>
                    <Box sx={{ position: 'relative' }}>
                      <LinearProgress
                        variant="determinate"
                        value={loading ? 0 : (stats.xp / stats.nextLevelXp) * 100}
                        sx={{
                          height: { xs: 8, sm: 10 },
                          borderRadius: 10,
                          bgcolor: 'rgba(255,255,255,0.15)',
                          '& .MuiLinearProgress-bar': {
                            bgcolor: theme.palette.secondary.main,
                            borderRadius: 10,
                            backgroundImage: `linear-gradient(90deg, ${alpha(theme.palette.secondary.main, 0.8)}, ${theme.palette.secondary.main})`,
                            boxShadow: `0 0 10px ${alpha(theme.palette.secondary.main, 0.5)}`,
                            transition: 'transform 1.5s cubic-bezier(0.4, 0, 0.2, 1)'
                          }
                        }}
                      />
                      {/* Animated dots on progress bar */}
                      <Box
                        sx={{
                          position: 'absolute',
                          top: '50%',
                          left: `${loading ? 0 : Math.min(98, (stats.xp / stats.nextLevelXp) * 100)}%`,
                          transform: 'translate(-50%, -50%)',
                          width: { xs: 12, sm: 16 },
                          height: { xs: 12, sm: 16 },
                          borderRadius: '50%',
                          bgcolor: 'white',
                          boxShadow: `0 0 10px ${theme.palette.secondary.main}`,
                          animation: 'pulse 1.5s infinite',
                          '@keyframes pulse': {
                            '0%': {
                              boxShadow: `0 0 0 0 ${alpha(theme.palette.secondary.main, 0.7)}`
                            },
                            '70%': {
                              boxShadow: `0 0 0 6px ${alpha(theme.palette.secondary.main, 0)}`
                            },
                            '100%': {
                              boxShadow: `0 0 0 0 ${alpha(theme.palette.secondary.main, 0)}`
                            }
                          }
                        }}
                      />
                    </Box>
                  </Box>
                </Box>
              </Box>

              <Box sx={{
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: { xs: 1, sm: 2 },
                width: { xs: '100%', md: 'auto' },
                justifyContent: { xs: 'center', md: 'flex-end' }
              }}>
                <Tooltip title={`${stats.availableExams} exams available`}>
                  <Badge
                    badgeContent={stats.availableExams}
                    color="secondary"
                    overlap="circular"
                    anchorOrigin={{
                      vertical: 'top',
                      horizontal: 'right',
                    }}
                    sx={{
                      '& .MuiBadge-badge': {
                        fontSize: { xs: '0.65rem', sm: '0.75rem' },
                        height: { xs: 16, sm: 20 },
                        minWidth: { xs: 16, sm: 20 }
                      }
                    }}
                  >
                    <Button
                      variant="contained"
                      color="secondary"
                      component={RouterLink}
                      to="/student/exams"
                      endIcon={<ArrowForward sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }} />}
                      sx={{
                        fontWeight: 'bold',
                        color: 'black',
                        px: { xs: 2, sm: 3 },
                        py: { xs: 1, sm: 1.2 },
                        borderRadius: { xs: 1, md: 2 },
                        fontSize: { xs: '0.75rem', sm: '0.875rem' }
                      }}
                    >
                      Available Exams
                    </Button>
                  </Badge>
                </Tooltip>

                <Button
                  variant="outlined"
                  component={RouterLink}
                  to="/student/results"
                  endIcon={<Assessment sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }} />}
                  sx={{
                    fontWeight: 'medium',
                    color: 'white',
                    borderColor: 'rgba(255,255,255,0.5)',
                    borderRadius: { xs: 1, md: 2 },
                    px: { xs: 1.5, sm: 2 },
                    py: { xs: 0.75, sm: 1 },
                    fontSize: { xs: '0.75rem', sm: '0.875rem' },
                    '&:hover': {
                      borderColor: 'white',
                      bgcolor: 'rgba(255,255,255,0.1)',
                    }
                  }}
                >
                  My Results
                </Button>
              </Box>
            </Paper>
          </Grid>

          {/* Stats Cards - Enhanced */}
          <Grid item xs={12}>
            <Box
              sx={{
                mb: { xs: 2, sm: 3 },
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 1
              }}
            >
              <Typography
                variant="h5"
                fontWeight="bold"
                sx={{
                  fontSize: { xs: '1.25rem', sm: '1.5rem', md: '1.75rem' },
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
                Your Dashboard
              </Typography>
              <Tooltip title="Refresh dashboard data">
                <IconButton
                  size="small"
                  onClick={() => fetchDashboardData()}
                  sx={{
                    color: theme.palette.primary.main,
                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                    '&:hover': {
                      bgcolor: alpha(theme.palette.primary.main, 0.2),
                    }
                  }}
                >
                  <Refresh fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
            <Box
              sx={{
                p: { xs: 2, sm: 3 },
                borderRadius: { xs: 2, md: 3 },
                background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.03)} 0%, ${alpha(theme.palette.secondary.main, 0.03)} 100%)`,
                border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                mb: { xs: 2, sm: 3 },
                position: 'relative',
                overflow: 'hidden'
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
              <Grid container spacing={{ xs: 2, sm: 2.5, md: 3 }} sx={{ position: 'relative', zIndex: 1 }}>
              {/* Using StatsCard component for Total Exams */}
              <Grid item xs={6} sm={6} md={3}>
                <Zoom in={true} style={{ transitionDelay: '200ms' }}>
                  <Box>
                    <StatsCard
                      title="Total Exams"
                      value={loading ? "..." : stats.totalExams}
                      icon={<School sx={{ fontSize: { xs: '1.5rem', sm: '2rem', md: '2.5rem' } }} />}
                      color={theme.palette.primary.main}
                      tooltip="Total number of exams assigned to you"
                      titleFontSize={{ xs: '0.75rem', sm: '0.875rem', md: '1rem' }}
                      valueFontSize={{ xs: '1.25rem', sm: '1.5rem', md: '2rem' }}
                      iconSize={{ xs: 40, sm: 48, md: 56 }}
                      height={{ xs: '100%', md: '100%' }}
                      padding={{ xs: 1.5, sm: 2, md: 2.5 }}
                    />
                  </Box>
                </Zoom>
              </Grid>

              {/* Using StatsCard component for Completed Exams */}
              <Grid item xs={6} sm={6} md={3}>
                <Zoom in={true} style={{ transitionDelay: '300ms' }}>
                  <Box>
                    <StatsCard
                      title="Completed Exams"
                      value={loading ? "..." : stats.completedExams}
                      icon={<AssignmentTurnedIn sx={{ fontSize: { xs: '1.5rem', sm: '2rem', md: '2.5rem' } }} />}
                      color={theme.palette.success.main}
                      trend={loading ? null : stats.completedExams > 0 ? 10 : 0}
                      trendLabel="vs last week"
                      tooltip="Number of exams you have completed"
                      titleFontSize={{ xs: '0.75rem', sm: '0.875rem', md: '1rem' }}
                      valueFontSize={{ xs: '1.25rem', sm: '1.5rem', md: '2rem' }}
                      iconSize={{ xs: 40, sm: 48, md: 56 }}
                      height={{ xs: '100%', md: '100%' }}
                      padding={{ xs: 1.5, sm: 2, md: 2.5 }}
                    />
                  </Box>
                </Zoom>
              </Grid>

              {/* Using StatsCard component for Available Exams */}
              <Grid item xs={6} sm={6} md={3}>
                <Zoom in={true} style={{ transitionDelay: '400ms' }}>
                  <Box>
                    <StatsCard
                      title="Available Exams"
                      value={loading ? "..." : stats.availableExams}
                      icon={<PlayArrow sx={{ fontSize: { xs: '1.5rem', sm: '2rem', md: '2.5rem' } }} />}
                      color={theme.palette.info.main}
                      tooltip="Number of exams available to take"
                      titleFontSize={{ xs: '0.75rem', sm: '0.875rem', md: '1rem' }}
                      valueFontSize={{ xs: '1.25rem', sm: '1.5rem', md: '2rem' }}
                      iconSize={{ xs: 40, sm: 48, md: 56 }}
                      height={{ xs: '100%', md: '100%' }}
                      padding={{ xs: 1.5, sm: 2, md: 2.5 }}
                    />
                  </Box>
                </Zoom>
              </Grid>

              {/* Using StatsCard component for Average Score */}
              <Grid item xs={6} sm={6} md={3}>
                <Zoom in={true} style={{ transitionDelay: '500ms' }}>
                  <Box>
                    <StatsCard
                      title="Average Score"
                      value={loading ? "..." : `${stats.averageScore}%`}
                      icon={<EmojiEvents sx={{ fontSize: { xs: '1.5rem', sm: '2rem', md: '2.5rem' } }} />}
                      color={theme.palette.warning.main}
                      tooltip="Your average score across all exams"
                      titleFontSize={{ xs: '0.75rem', sm: '0.875rem', md: '1rem' }}
                      valueFontSize={{ xs: '1.25rem', sm: '1.5rem', md: '2rem' }}
                      iconSize={{ xs: 40, sm: 48, md: 56 }}
                      height={{ xs: '100%', md: '100%' }}
                      padding={{ xs: 1.5, sm: 2, md: 2.5 }}
                    />
                  </Box>
                </Zoom>
              </Grid>
            </Grid>
            </Box>
          </Grid>

          {/* Progress Section - Ultra Enhanced */}
          <Grid item xs={12}>
            <Box
              sx={{
                mb: { xs: 2, sm: 3 },
                mt: { xs: 3, sm: 4 },
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 1
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box
                  sx={{
                    width: { xs: 50, sm: 60 },
                    height: { xs: 50, sm: 60 },
                    borderRadius: '50%',
                    background: `linear-gradient(135deg, ${theme.palette.success.main}, ${theme.palette.info.main})`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: `0 8px 20px ${alpha(theme.palette.success.main, 0.4)}`,
                    animation: 'progressPulse 3s ease-in-out infinite',
                    '@keyframes progressPulse': {
                      '0%': {
                        boxShadow: `0 0 0 0 ${alpha(theme.palette.success.main, 0.7)}`
                      },
                      '70%': {
                        boxShadow: `0 0 0 15px ${alpha(theme.palette.success.main, 0)}`
                      },
                      '100%': {
                        boxShadow: `0 0 0 0 ${alpha(theme.palette.success.main, 0)}`
                      }
                    }
                  }}
                >
                  <AutoGraph sx={{ color: 'white', fontSize: { xs: '1.5rem', sm: '2rem' } }} />
                </Box>
                <Box>
                  <Typography
                    variant="h4"
                    fontWeight="bold"
                    sx={{
                      fontSize: { xs: '1.5rem', sm: '1.8rem', md: '2.2rem' },
                      background: `linear-gradient(135deg, ${theme.palette.success.main}, ${theme.palette.info.main})`,
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                      letterSpacing: '0.5px',
                      textShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}
                  >
                    Your Progress
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      fontSize: { xs: '0.85rem', sm: '0.9rem' },
                      fontWeight: 'medium',
                      mt: 0.5
                    }}
                  >
                    Track your learning journey and celebrate milestones
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Chip
                  icon={<Assessment sx={{ color: 'white !important' }} />}
                  label={`${stats.completedExams}/${stats.totalExams} Completed`}
                  sx={{
                    bgcolor: theme.palette.success.main,
                    color: 'white',
                    fontWeight: 'bold',
                    borderRadius: 3,
                    '& .MuiChip-icon': {
                      color: 'white'
                    }
                  }}
                />
              </Box>
            </Box>

            <Box
              sx={{
                p: { xs: 3, sm: 4 },
                borderRadius: { xs: 3, md: 4 },
                background: `linear-gradient(135deg,
                  ${alpha(theme.palette.success.main, 0.05)} 0%,
                  ${alpha(theme.palette.info.main, 0.05)} 50%,
                  ${alpha(theme.palette.primary.main, 0.05)} 100%)`,
                border: `2px solid ${alpha(theme.palette.success.main, 0.2)}`,
                mb: { xs: 2, sm: 3 },
                position: 'relative',
                overflow: 'hidden',
                boxShadow: `0 15px 35px ${alpha(theme.palette.success.main, 0.15)}`
              }}
            >
              {/* Enhanced Decorative elements */}
              <Box
                sx={{
                  position: 'absolute',
                  top: -50,
                  right: -50,
                  width: 200,
                  height: 200,
                  borderRadius: '50%',
                  background: `radial-gradient(circle, ${alpha(theme.palette.success.main, 0.15)} 0%, transparent 70%)`,
                  display: { xs: 'none', sm: 'block' },
                  animation: 'progressFloat 8s ease-in-out infinite',
                  '@keyframes progressFloat': {
                    '0%': { transform: 'translateY(0px) rotate(0deg)' },
                    '50%': { transform: 'translateY(-25px) rotate(180deg)' },
                    '100%': { transform: 'translateY(0px) rotate(360deg)' }
                  }
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
                  background: `radial-gradient(circle, ${alpha(theme.palette.info.main, 0.15)} 0%, transparent 70%)`,
                  display: { xs: 'none', sm: 'block' },
                  animation: 'progressFloat 10s ease-in-out infinite reverse',
                }}
              />

              {/* Progress sparkles */}
              {[...Array(8)].map((_, i) => (
                <Box
                  key={i}
                  sx={{
                    position: 'absolute',
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    bgcolor: i % 2 === 0 ? theme.palette.success.main : theme.palette.info.main,
                    top: `${15 + i * 12}%`,
                    left: `${8 + i * 12}%`,
                    animation: `progressSparkle 4s ease-in-out infinite ${i * 0.3}s`,
                    '@keyframes progressSparkle': {
                      '0%, 100%': { opacity: 0, transform: 'scale(0) rotate(0deg)' },
                      '50%': { opacity: 1, transform: 'scale(1) rotate(180deg)' }
                    }
                  }}
                />
              ))}

              <Grid container spacing={3} sx={{ position: 'relative', zIndex: 1 }}>
              {/* Enhanced Circular Progress Card */}
              <Grid item xs={12} sm={6} md={4}>
                <Zoom in={true} style={{ transitionDelay: '600ms' }}>
                  <Card
                    elevation={8}
                    sx={{
                      height: '100%',
                      borderRadius: 4,
                      position: 'relative',
                      overflow: 'hidden',
                      background: `linear-gradient(135deg,
                        ${alpha(theme.palette.success.main, 0.1)} 0%,
                        ${alpha(theme.palette.info.main, 0.1)} 100%)`,
                      border: `2px solid ${alpha(theme.palette.success.main, 0.3)}`,
                      transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                      '&:hover': {
                        transform: 'translateY(-8px) scale(1.02)',
                        boxShadow: `0 20px 40px ${alpha(theme.palette.success.main, 0.3)}`,
                      }
                    }}
                  >
                    {/* Progress glow effect */}
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        background: `linear-gradient(135deg,
                          ${alpha(theme.palette.success.main, 0.1)} 0%,
                          ${alpha(theme.palette.info.main, 0.1)} 100%)`,
                        animation: 'progressGlow 3s ease-in-out infinite alternate',
                        '@keyframes progressGlow': {
                          '0%': { opacity: 0.3 },
                          '100%': { opacity: 0.7 }
                        }
                      }}
                    />

                    {/* Top border indicator */}
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: 6,
                        background: `linear-gradient(90deg, ${theme.palette.success.main}, ${theme.palette.info.main})`,
                        boxShadow: `0 2px 8px ${alpha(theme.palette.success.main, 0.4)}`
                      }}
                    />

                    <CardContent sx={{ p: 3, position: 'relative', zIndex: 2, textAlign: 'center' }}>
                      <Typography variant="h6" fontWeight="bold" sx={{ mb: 2, color: theme.palette.success.dark }}>
                        Completion Rate
                      </Typography>

                      {/* Enhanced Circular Progress */}
                      <Box sx={{ position: 'relative', display: 'inline-flex', mb: 3 }}>
                        <Box
                          sx={{
                            width: 120,
                            height: 120,
                            borderRadius: '50%',
                            background: `conic-gradient(
                              ${theme.palette.success.main} 0deg,
                              ${theme.palette.success.main} ${(stats.completedExams / Math.max(stats.totalExams, 1)) * 360}deg,
                              ${alpha(theme.palette.grey[300], 0.3)} ${(stats.completedExams / Math.max(stats.totalExams, 1)) * 360}deg,
                              ${alpha(theme.palette.grey[300], 0.3)} 360deg
                            )`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative',
                            animation: 'progressRotate 10s linear infinite',
                            '@keyframes progressRotate': {
                              '0%': { transform: 'rotate(0deg)' },
                              '100%': { transform: 'rotate(360deg)' }
                            }
                          }}
                        >
                          <Box
                            sx={{
                              width: 90,
                              height: 90,
                              borderRadius: '50%',
                              bgcolor: 'background.paper',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexDirection: 'column',
                              boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.1)'
                            }}
                          >
                            <Typography variant="h4" fontWeight="bold" color="success.main">
                              {loading ? '...' : Math.round((stats.completedExams / Math.max(stats.totalExams, 1)) * 100)}%
                            </Typography>
                            <Typography variant="caption" color="text.secondary" fontWeight="medium">
                              Complete
                            </Typography>
                          </Box>
                        </Box>

                        {/* Progress indicator dot */}
                        <Box
                          sx={{
                            position: 'absolute',
                            top: 10,
                            right: 10,
                            width: 12,
                            height: 12,
                            borderRadius: '50%',
                            bgcolor: theme.palette.success.main,
                            boxShadow: `0 0 10px ${theme.palette.success.main}`,
                            animation: 'progressPing 2s cubic-bezier(0, 0, 0.2, 1) infinite',
                            '@keyframes progressPing': {
                              '75%, 100%': {
                                transform: 'scale(2)',
                                opacity: 0
                              }
                            }
                          }}
                        />
                      </Box>

                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {loading ? 'Loading...' : `${stats.completedExams} of ${stats.totalExams} exams completed`}
                      </Typography>

                      <Button
                        variant="contained"
                        color="success"
                        onClick={() => window.location.href = '/student/exams'}
                        startIcon={<Assessment />}
                        sx={{
                          borderRadius: 3,
                          px: 3,
                          py: 1,
                          fontWeight: 'bold',
                          textTransform: 'none',
                          boxShadow: `0 4px 12px ${alpha(theme.palette.success.main, 0.3)}`,
                          '&:hover': {
                            transform: 'translateY(-2px)',
                            boxShadow: `0 6px 16px ${alpha(theme.palette.success.main, 0.4)}`
                          }
                        }}
                      >
                        View All Exams
                      </Button>
                    </CardContent>
                  </Card>
                </Zoom>
              </Grid>

              {/* Enhanced Study Streak Card */}
              <Grid item xs={12} sm={6} md={4}>
                <Zoom in={true} style={{ transitionDelay: '700ms' }}>
                  <Card
                    elevation={8}
                    sx={{
                      height: '100%',
                      borderRadius: 4,
                      position: 'relative',
                      overflow: 'hidden',
                      background: `linear-gradient(135deg,
                        ${alpha(theme.palette.error.main, 0.1)} 0%,
                        ${alpha(theme.palette.warning.main, 0.1)} 100%)`,
                      border: `2px solid ${alpha(theme.palette.error.main, 0.3)}`,
                      transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                      '&:hover': {
                        transform: 'translateY(-8px) scale(1.02)',
                        boxShadow: `0 20px 40px ${alpha(theme.palette.error.main, 0.3)}`,
                      }
                    }}
                  >
                    {/* Streak glow effect */}
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        background: `linear-gradient(135deg,
                          ${alpha(theme.palette.error.main, 0.1)} 0%,
                          ${alpha(theme.palette.warning.main, 0.1)} 100%)`,
                        animation: 'streakGlow 2s ease-in-out infinite alternate',
                        '@keyframes streakGlow': {
                          '0%': { opacity: 0.3 },
                          '100%': { opacity: 0.6 }
                        }
                      }}
                    />

                    {/* Top border indicator */}
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: 6,
                        background: `linear-gradient(90deg, ${theme.palette.error.main}, ${theme.palette.warning.main})`,
                        boxShadow: `0 2px 8px ${alpha(theme.palette.error.main, 0.4)}`
                      }}
                    />

                    <CardContent sx={{ p: 3, position: 'relative', zIndex: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                        <Typography variant="h6" fontWeight="bold" color="error.dark">
                          Study Streak
                        </Typography>
                        <Tooltip title="Days in a row you've studied">
                          <Avatar
                            sx={{
                              width: 40,
                              height: 40,
                              bgcolor: theme.palette.error.main,
                              animation: 'fireFlicker 1.5s ease-in-out infinite alternate',
                              '@keyframes fireFlicker': {
                                '0%': { transform: 'scale(1) rotate(-2deg)' },
                                '100%': { transform: 'scale(1.1) rotate(2deg)' }
                              }
                            }}
                          >
                            <LocalFireDepartment sx={{ color: 'white' }} />
                          </Avatar>
                        </Tooltip>
                      </Box>

                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3, gap: 0.5 }}>
                        {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                          <Box
                            key={day}
                            sx={{
                              width: { xs: 32, sm: 36 },
                              height: { xs: 32, sm: 36 },
                              borderRadius: 2,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              bgcolor: day <= studyStreak ? 'error.main' : alpha(theme.palette.error.main, 0.1),
                              color: day <= studyStreak ? 'white' : 'text.secondary',
                              fontWeight: 'bold',
                              fontSize: { xs: '0.8rem', sm: '0.9rem' },
                              boxShadow: day <= studyStreak ? `0 4px 12px ${alpha(theme.palette.error.main, 0.4)}` : 'none',
                              transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                              transform: day === studyStreak ? 'scale(1.15) translateY(-2px)' : 'scale(1)',
                              border: day === studyStreak ? `2px solid ${theme.palette.warning.main}` : 'none',
                              animation: day <= studyStreak ? `streakPulse 2s ease-in-out infinite ${day * 0.1}s` : 'none',
                              '@keyframes streakPulse': {
                                '0%, 100%': { boxShadow: `0 0 0 0 ${alpha(theme.palette.error.main, 0.7)}` },
                                '50%': { boxShadow: `0 0 0 4px ${alpha(theme.palette.error.main, 0)}` }
                              }
                            }}
                          >
                            {day}
                          </Box>
                        ))}
                      </Box>

                      <Box sx={{ textAlign: 'center' }}>
                        {studyStreak === 7 ? (
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 2 }}>
                            <Celebration
                              sx={{
                                color: theme.palette.error.main,
                                animation: 'celebrate 1s ease-in-out infinite alternate',
                                '@keyframes celebrate': {
                                  '0%': { transform: 'rotate(-10deg) scale(1)' },
                                  '100%': { transform: 'rotate(10deg) scale(1.2)' }
                                }
                              }}
                            />
                            <Typography variant="body1" fontWeight="bold" color="error.main">
                              Perfect week! Keep it up!
                            </Typography>
                          </Box>
                        ) : (
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            You're on a {studyStreak}-day streak! {7 - studyStreak} more days for a perfect week.
                          </Typography>
                        )}

                        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
                          <Chip
                            label={`${studyStreak} Days`}
                            size="small"
                            sx={{
                              bgcolor: alpha(theme.palette.error.main, 0.2),
                              color: theme.palette.error.dark,
                              fontWeight: 'bold',
                              borderRadius: 2
                            }}
                          />
                          <Chip
                            label={studyStreak >= 7 ? "🔥 On Fire!" : "🎯 Keep Going!"}
                            size="small"
                            sx={{
                              bgcolor: alpha(theme.palette.warning.main, 0.2),
                              color: theme.palette.warning.dark,
                              fontWeight: 'bold',
                              borderRadius: 2
                            }}
                          />
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Zoom>
              </Grid>

              {/* Enhanced Rank Card */}
              <Grid item xs={12} sm={6} md={4}>
                <Zoom in={true} style={{ transitionDelay: '800ms' }}>
                  <Card
                    elevation={8}
                    sx={{
                      height: '100%',
                      borderRadius: 4,
                      position: 'relative',
                      overflow: 'hidden',
                      background: `linear-gradient(135deg,
                        ${alpha(theme.palette.primary.main, 0.1)} 0%,
                        ${alpha(theme.palette.secondary.main, 0.1)} 100%)`,
                      border: `2px solid ${alpha(theme.palette.primary.main, 0.3)}`,
                      transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                      '&:hover': {
                        transform: 'translateY(-8px) scale(1.02)',
                        boxShadow: `0 20px 40px ${alpha(theme.palette.primary.main, 0.3)}`,
                      }
                    }}
                  >
                    {/* Rank glow effect */}
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        background: `linear-gradient(135deg,
                          ${alpha(theme.palette.primary.main, 0.1)} 0%,
                          ${alpha(theme.palette.secondary.main, 0.1)} 100%)`,
                        animation: 'rankGlow 4s ease-in-out infinite alternate',
                        '@keyframes rankGlow': {
                          '0%': { opacity: 0.3 },
                          '100%': { opacity: 0.6 }
                        }
                      }}
                    />

                    {/* Top border indicator */}
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: 6,
                        background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                        boxShadow: `0 2px 8px ${alpha(theme.palette.primary.main, 0.4)}`
                      }}
                    />

                    <CardContent sx={{ p: 3, position: 'relative', zIndex: 2, textAlign: 'center' }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                        <Typography variant="h6" fontWeight="bold" color="primary.dark">
                          Your Rank
                        </Typography>
                        <Tooltip title="Your position on the leaderboard">
                          <Avatar
                            sx={{
                              width: 40,
                              height: 40,
                              bgcolor: theme.palette.primary.main,
                              animation: 'rankBounce 2s ease-in-out infinite',
                              '@keyframes rankBounce': {
                                '0%, 20%, 50%, 80%, 100%': { transform: 'translateY(0)' },
                                '40%': { transform: 'translateY(-8px)' },
                                '60%': { transform: 'translateY(-4px)' }
                              }
                            }}
                          >
                            <LeaderboardIcon sx={{ color: 'white' }} />
                          </Avatar>
                        </Tooltip>
                      </Box>

                      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3, position: 'relative' }}>
                        <Box
                          sx={{
                            position: 'relative',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          {/* Rank circle with animated border */}
                          <Box
                            sx={{
                              width: 100,
                              height: 100,
                              borderRadius: '50%',
                              background: `conic-gradient(
                                ${theme.palette.primary.main} 0deg,
                                ${theme.palette.secondary.main} 120deg,
                                ${theme.palette.primary.main} 240deg,
                                ${theme.palette.secondary.main} 360deg
                              )`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              animation: 'rankRotate 8s linear infinite',
                              '@keyframes rankRotate': {
                                '0%': { transform: 'rotate(0deg)' },
                                '100%': { transform: 'rotate(360deg)' }
                              }
                            }}
                          >
                            <Avatar
                              sx={{
                                width: 80,
                                height: 80,
                                bgcolor: 'background.paper',
                                fontSize: '1.8rem',
                                fontWeight: 'bold',
                                color: theme.palette.primary.main,
                                boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.1)',
                                border: `3px solid ${theme.palette.background.paper}`
                              }}
                            >
                              #{loading ? "..." : stats.rank}
                            </Avatar>
                          </Box>

                          {/* Crown for top ranks */}
                          {stats.rank <= 3 && (
                            <Box
                              sx={{
                                position: 'absolute',
                                top: -10,
                                right: -5,
                                fontSize: '1.5rem',
                                animation: 'crownShine 2s ease-in-out infinite alternate',
                                '@keyframes crownShine': {
                                  '0%': { transform: 'scale(1) rotate(-5deg)' },
                                  '100%': { transform: 'scale(1.2) rotate(5deg)' }
                                }
                              }}
                            >
                              👑
                            </Box>
                          )}
                        </Box>
                      </Box>

                      <Typography variant="body1" align="center" fontWeight="medium" sx={{ mb: 2 }}>
                        {loading ? "Loading rank..." : `You're in the top ${stats.rank * 10}% of students!`}
                      </Typography>

                      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mb: 2 }}>
                        <Chip
                          label={`Rank #${stats.rank}`}
                          size="small"
                          sx={{
                            bgcolor: alpha(theme.palette.primary.main, 0.2),
                            color: theme.palette.primary.dark,
                            fontWeight: 'bold',
                            borderRadius: 2
                          }}
                        />
                        <Chip
                          label={stats.rank <= 3 ? "🏆 Top Performer" : "📈 Keep Climbing"}
                          size="small"
                          sx={{
                            bgcolor: alpha(theme.palette.secondary.main, 0.2),
                            color: theme.palette.secondary.dark,
                            fontWeight: 'bold',
                            borderRadius: 2
                          }}
                        />
                      </Box>

                      <Button
                        variant="contained"
                        color="primary"
                        size="small"
                        startIcon={<AutoGraph />}
                        sx={{
                          borderRadius: 3,
                          px: 3,
                          py: 1,
                          fontWeight: 'bold',
                          textTransform: 'none',
                          boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.3)}`,
                          '&:hover': {
                            transform: 'translateY(-2px)',
                            boxShadow: `0 6px 16px ${alpha(theme.palette.primary.main, 0.4)}`
                          }
                        }}
                      >
                        View Leaderboard
                      </Button>
                    </CardContent>
                  </Card>
                </Zoom>
              </Grid>
            </Grid>
            </Box>
          </Grid>

          {/* Achievements Section - Ultra Enhanced */}
          <Grid item xs={12}>
            <Box
              sx={{
                mb: { xs: 2, sm: 3 },
                mt: { xs: 3, sm: 4 },
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 1
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box
                  sx={{
                    width: { xs: 50, sm: 60 },
                    height: { xs: 50, sm: 60 },
                    borderRadius: '50%',
                    background: `linear-gradient(135deg, ${theme.palette.warning.main}, ${theme.palette.error.main})`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: `0 8px 20px ${alpha(theme.palette.warning.main, 0.4)}`,
                    animation: 'pulse 2s infinite',
                    '@keyframes pulse': {
                      '0%': {
                        boxShadow: `0 0 0 0 ${alpha(theme.palette.warning.main, 0.7)}`
                      },
                      '70%': {
                        boxShadow: `0 0 0 10px ${alpha(theme.palette.warning.main, 0)}`
                      },
                      '100%': {
                        boxShadow: `0 0 0 0 ${alpha(theme.palette.warning.main, 0)}`
                      }
                    }
                  }}
                >
                  <EmojiEvents sx={{ color: 'white', fontSize: { xs: '1.5rem', sm: '2rem' } }} />
                </Box>
                <Box>
                  <Typography
                    variant="h4"
                    fontWeight="bold"
                    sx={{
                      fontSize: { xs: '1.5rem', sm: '1.8rem', md: '2.2rem' },
                      background: `linear-gradient(135deg, ${theme.palette.warning.main}, ${theme.palette.error.main})`,
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                      letterSpacing: '0.5px',
                      textShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}
                  >
                    Your Achievements
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      fontSize: { xs: '0.85rem', sm: '0.9rem' },
                      fontWeight: 'medium',
                      mt: 0.5
                    }}
                  >
                    Unlock rewards as you progress through your learning journey
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Chip
                  icon={<Star sx={{ color: 'white !important' }} />}
                  label={`${achievements.filter(a => a.unlocked).length}/${achievements.length} Unlocked`}
                  sx={{
                    bgcolor: theme.palette.warning.main,
                    color: 'white',
                    fontWeight: 'bold',
                    borderRadius: 3,
                    '& .MuiChip-icon': {
                      color: 'white'
                    }
                  }}
                />
              </Box>
            </Box>

            <Box
              sx={{
                p: { xs: 3, sm: 4 },
                borderRadius: { xs: 3, md: 4 },
                background: `linear-gradient(135deg,
                  ${alpha(theme.palette.warning.main, 0.05)} 0%,
                  ${alpha(theme.palette.error.main, 0.05)} 50%,
                  ${alpha(theme.palette.secondary.main, 0.05)} 100%)`,
                border: `2px solid ${alpha(theme.palette.warning.main, 0.2)}`,
                mb: { xs: 2, sm: 3 },
                position: 'relative',
                overflow: 'hidden',
                boxShadow: `0 15px 35px ${alpha(theme.palette.warning.main, 0.15)}`
              }}
            >
              {/* Enhanced Decorative elements */}
              <Box
                sx={{
                  position: 'absolute',
                  top: -50,
                  right: -50,
                  width: 200,
                  height: 200,
                  borderRadius: '50%',
                  background: `radial-gradient(circle, ${alpha(theme.palette.warning.main, 0.15)} 0%, transparent 70%)`,
                  display: { xs: 'none', sm: 'block' },
                  animation: 'float 6s ease-in-out infinite',
                  '@keyframes float': {
                    '0%': { transform: 'translateY(0px)' },
                    '50%': { transform: 'translateY(-20px)' },
                    '100%': { transform: 'translateY(0px)' }
                  }
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
                  background: `radial-gradient(circle, ${alpha(theme.palette.error.main, 0.15)} 0%, transparent 70%)`,
                  display: { xs: 'none', sm: 'block' },
                  animation: 'float 8s ease-in-out infinite reverse',
                }}
              />

              {/* Sparkle effects */}
              {[...Array(6)].map((_, i) => (
                <Box
                  key={i}
                  sx={{
                    position: 'absolute',
                    width: 4,
                    height: 4,
                    borderRadius: '50%',
                    bgcolor: theme.palette.warning.main,
                    top: `${20 + i * 15}%`,
                    left: `${10 + i * 15}%`,
                    animation: `sparkle 3s ease-in-out infinite ${i * 0.5}s`,
                    '@keyframes sparkle': {
                      '0%, 100%': { opacity: 0, transform: 'scale(0)' },
                      '50%': { opacity: 1, transform: 'scale(1)' }
                    }
                  }}
                />
              ))}

              <Grid container spacing={3} sx={{ position: 'relative', zIndex: 1 }}>
              {loading ? (
                Array.from(new Array(4)).map((_, index) => (
                  <Grid item xs={12} sm={6} md={3} key={index}>
                    <Box
                      sx={{
                        height: 220,
                        borderRadius: 3,
                        background: `linear-gradient(135deg, ${alpha(theme.palette.grey[300], 0.3)}, ${alpha(theme.palette.grey[400], 0.3)})`,
                        animation: 'shimmer 1.5s ease-in-out infinite',
                        '@keyframes shimmer': {
                          '0%': { opacity: 0.6 },
                          '50%': { opacity: 1 },
                          '100%': { opacity: 0.6 }
                        }
                      }}
                    />
                  </Grid>
                ))
              ) : (
                achievements.map((achievement, index) => (
                  <Grid item xs={12} sm={6} md={3} key={achievement.id}>
                    <Zoom in={true} style={{ transitionDelay: `${900 + (index * 150)}ms` }}>
                      <Card
                        elevation={achievement.unlocked ? 8 : 3}
                        sx={{
                          height: '100%',
                          borderRadius: 4,
                          position: 'relative',
                          overflow: 'hidden',
                          background: achievement.unlocked
                            ? `linear-gradient(135deg,
                                ${alpha(theme.palette.warning.main, 0.1)} 0%,
                                ${alpha(theme.palette.error.main, 0.1)} 100%)`
                            : `linear-gradient(135deg,
                                ${alpha(theme.palette.grey[300], 0.1)} 0%,
                                ${alpha(theme.palette.grey[400], 0.1)} 100%)`,
                          border: achievement.unlocked
                            ? `2px solid ${alpha(theme.palette.warning.main, 0.3)}`
                            : `2px solid ${alpha(theme.palette.grey[300], 0.3)}`,
                          transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                          transform: achievement.unlocked ? 'scale(1)' : 'scale(0.95)',
                          filter: achievement.unlocked ? 'none' : 'grayscale(0.7)',
                          '&:hover': {
                            transform: achievement.unlocked ? 'translateY(-8px) scale(1.02)' : 'scale(0.98)',
                            boxShadow: achievement.unlocked
                              ? `0 20px 40px ${alpha(theme.palette.warning.main, 0.3)}`
                              : `0 10px 20px ${alpha(theme.palette.grey[400], 0.2)}`,
                          }
                        }}
                      >
                        {/* Achievement glow effect */}
                        {achievement.unlocked && (
                          <Box
                            sx={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: '100%',
                              height: '100%',
                              background: `linear-gradient(135deg,
                                ${alpha(theme.palette.warning.main, 0.1)} 0%,
                                ${alpha(theme.palette.error.main, 0.1)} 100%)`,
                              animation: 'glow 2s ease-in-out infinite alternate',
                              '@keyframes glow': {
                                '0%': { opacity: 0.3 },
                                '100%': { opacity: 0.6 }
                              }
                            }}
                          />
                        )}

                        {/* Top border indicator */}
                        <Box
                          sx={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: 6,
                            background: achievement.unlocked
                              ? `linear-gradient(90deg, ${theme.palette.warning.main}, ${theme.palette.error.main})`
                              : `linear-gradient(90deg, ${theme.palette.grey[300]}, ${theme.palette.grey[400]})`,
                            boxShadow: achievement.unlocked
                              ? `0 2px 8px ${alpha(theme.palette.warning.main, 0.4)}`
                              : 'none'
                          }}
                        />

                        <CardContent sx={{ p: 3, position: 'relative', zIndex: 2 }}>
                          {/* Achievement Icon */}
                          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                            <Avatar
                              sx={{
                                width: 60,
                                height: 60,
                                bgcolor: achievement.unlocked
                                  ? theme.palette.warning.main
                                  : theme.palette.grey[400],
                                boxShadow: achievement.unlocked
                                  ? `0 8px 20px ${alpha(theme.palette.warning.main, 0.4)}`
                                  : `0 4px 10px ${alpha(theme.palette.grey[400], 0.3)}`,
                                border: `3px solid ${achievement.unlocked ? 'white' : alpha(theme.palette.grey[300], 0.5)}`,
                                transition: 'all 0.3s ease',
                                animation: achievement.unlocked ? 'bounce 2s ease-in-out infinite' : 'none',
                                '@keyframes bounce': {
                                  '0%, 20%, 50%, 80%, 100%': { transform: 'translateY(0)' },
                                  '40%': { transform: 'translateY(-10px)' },
                                  '60%': { transform: 'translateY(-5px)' }
                                }
                              }}
                            >
                              {achievement.icon === 'trophy' && <EmojiEvents sx={{ fontSize: '2rem', color: 'white' }} />}
                              {achievement.icon === 'star' && <Star sx={{ fontSize: '2rem', color: 'white' }} />}
                              {achievement.icon === 'bolt' && <Assessment sx={{ fontSize: '2rem', color: 'white' }} />}
                              {achievement.icon === 'fire' && <LocalFireDepartment sx={{ fontSize: '2rem', color: 'white' }} />}
                            </Avatar>

                            {/* Unlock indicator */}
                            {achievement.unlocked && (
                              <Box
                                sx={{
                                  position: 'absolute',
                                  top: -5,
                                  right: -5,
                                  width: 24,
                                  height: 24,
                                  borderRadius: '50%',
                                  bgcolor: theme.palette.success.main,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  boxShadow: `0 2px 8px ${alpha(theme.palette.success.main, 0.4)}`,
                                  animation: 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
                                  '@keyframes ping': {
                                    '75%, 100%': {
                                      transform: 'scale(2)',
                                      opacity: 0
                                    }
                                  }
                                }}
                              >
                                <CheckCircle sx={{ fontSize: '1rem', color: 'white' }} />
                              </Box>
                            )}
                          </Box>

                          {/* Achievement Title */}
                          <Typography
                            variant="h6"
                            fontWeight="bold"
                            align="center"
                            sx={{
                              mb: 1,
                              fontSize: { xs: '1rem', sm: '1.1rem' },
                              color: achievement.unlocked
                                ? theme.palette.text.primary
                                : theme.palette.text.secondary,
                              textShadow: achievement.unlocked ? '0 1px 2px rgba(0,0,0,0.1)' : 'none'
                            }}
                          >
                            {achievement.title}
                          </Typography>

                          {/* Achievement Description */}
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            align="center"
                            sx={{
                              mb: 2,
                              fontSize: { xs: '0.8rem', sm: '0.85rem' },
                              lineHeight: 1.4,
                              opacity: achievement.unlocked ? 1 : 0.7
                            }}
                          >
                            {achievement.description}
                          </Typography>

                          {/* Progress Bar */}
                          <Box sx={{ mb: 2 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                              <Typography variant="caption" color="text.secondary" fontWeight="medium">
                                Progress
                              </Typography>
                              <Typography variant="caption" color="text.secondary" fontWeight="bold">
                                {achievement.progress}/{achievement.maxProgress}
                              </Typography>
                            </Box>
                            <LinearProgress
                              variant="determinate"
                              value={(achievement.progress / achievement.maxProgress) * 100}
                              sx={{
                                height: 8,
                                borderRadius: 4,
                                bgcolor: alpha(theme.palette.grey[300], 0.3),
                                '& .MuiLinearProgress-bar': {
                                  borderRadius: 4,
                                  background: achievement.unlocked
                                    ? `linear-gradient(90deg, ${theme.palette.warning.main}, ${theme.palette.error.main})`
                                    : `linear-gradient(90deg, ${theme.palette.grey[400]}, ${theme.palette.grey[500]})`,
                                  boxShadow: achievement.unlocked
                                    ? `0 0 10px ${alpha(theme.palette.warning.main, 0.5)}`
                                    : 'none',
                                  transition: 'all 0.3s ease'
                                }
                              }}
                            />
                          </Box>

                          {/* Achievement Level Badge */}
                          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                            <Chip
                              label={`Level ${achievement.level}`}
                              size="small"
                              sx={{
                                bgcolor: achievement.unlocked
                                  ? alpha(theme.palette.warning.main, 0.2)
                                  : alpha(theme.palette.grey[400], 0.2),
                                color: achievement.unlocked
                                  ? theme.palette.warning.dark
                                  : theme.palette.grey[600],
                                fontWeight: 'bold',
                                borderRadius: 2,
                                border: achievement.unlocked
                                  ? `1px solid ${alpha(theme.palette.warning.main, 0.3)}`
                                  : `1px solid ${alpha(theme.palette.grey[400], 0.3)}`
                              }}
                            />
                          </Box>
                        </CardContent>
                      </Card>
                    </Zoom>
                  </Grid>
                ))
              )}
            </Grid>
            </Box>
          </Grid>

          {/* Activity & Leaderboard Section - Ultra Enhanced */}
          <Grid item xs={12}>
            <Box
              sx={{
                mb: { xs: 2, sm: 3 },
                mt: { xs: 3, sm: 4 },
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 1
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box
                  sx={{
                    width: { xs: 50, sm: 60 },
                    height: { xs: 50, sm: 60 },
                    borderRadius: '50%',
                    background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.info.main})`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: `0 8px 20px ${alpha(theme.palette.primary.main, 0.4)}`,
                    animation: 'activityPulse 3s ease-in-out infinite',
                    '@keyframes activityPulse': {
                      '0%': {
                        boxShadow: `0 0 0 0 ${alpha(theme.palette.primary.main, 0.7)}`
                      },
                      '70%': {
                        boxShadow: `0 0 0 15px ${alpha(theme.palette.primary.main, 0)}`
                      },
                      '100%': {
                        boxShadow: `0 0 0 0 ${alpha(theme.palette.primary.main, 0)}`
                      }
                    }
                  }}
                >
                  <LeaderboardIcon sx={{ color: 'white', fontSize: { xs: '1.5rem', sm: '2rem' } }} />
                </Box>
                <Box>
                  <Typography
                    variant="h4"
                    fontWeight="bold"
                    sx={{
                      fontSize: { xs: '1.5rem', sm: '1.8rem', md: '2.2rem' },
                      background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.info.main})`,
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                      letterSpacing: '0.5px',
                      textShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}
                  >
                    Activity & Leaderboard
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      fontSize: { xs: '0.85rem', sm: '0.9rem' },
                      fontWeight: 'medium',
                      mt: 0.5
                    }}
                  >
                    Compete with classmates and track your recent exam activity
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Chip
                  icon={<Assessment sx={{ color: 'white !important' }} />}
                  label={`${recentExams.length} Recent Exams`}
                  sx={{
                    bgcolor: theme.palette.info.main,
                    color: 'white',
                    fontWeight: 'bold',
                    borderRadius: 3,
                    '& .MuiChip-icon': {
                      color: 'white'
                    }
                  }}
                />
              </Box>
            </Box>
            <Grid container spacing={3}>
              {/* Enhanced Leaderboard */}
              <Grid item xs={12} md={4}>
                <Box
                  sx={{
                    p: { xs: 3, sm: 4 },
                    borderRadius: { xs: 3, md: 4 },
                    background: `linear-gradient(135deg,
                      ${alpha(theme.palette.primary.main, 0.05)} 0%,
                      ${alpha(theme.palette.info.main, 0.05)} 50%,
                      ${alpha(theme.palette.secondary.main, 0.05)} 100%)`,
                    border: `2px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                    mb: { xs: 2, sm: 3 },
                    height: '100%',
                    position: 'relative',
                    overflow: 'hidden',
                    boxShadow: `0 15px 35px ${alpha(theme.palette.primary.main, 0.15)}`
                  }}
                >
                  {/* Enhanced Decorative elements */}
                  <Box
                    sx={{
                      position: 'absolute',
                      top: -40,
                      right: -40,
                      width: 180,
                      height: 180,
                      borderRadius: '50%',
                      background: `radial-gradient(circle, ${alpha(theme.palette.primary.main, 0.15)} 0%, transparent 70%)`,
                      display: { xs: 'none', sm: 'block' },
                      animation: 'leaderboardFloat 10s ease-in-out infinite',
                      '@keyframes leaderboardFloat': {
                        '0%': { transform: 'translateY(0px) rotate(0deg)' },
                        '50%': { transform: 'translateY(-20px) rotate(180deg)' },
                        '100%': { transform: 'translateY(0px) rotate(360deg)' }
                      }
                    }}
                  />

                  {/* Leaderboard sparkles */}
                  {[...Array(5)].map((_, i) => (
                    <Box
                      key={i}
                      sx={{
                        position: 'absolute',
                        width: 4,
                        height: 4,
                        borderRadius: '50%',
                        bgcolor: i % 2 === 0 ? theme.palette.primary.main : theme.palette.info.main,
                        top: `${20 + i * 15}%`,
                        left: `${10 + i * 20}%`,
                        animation: `leaderboardSparkle 3s ease-in-out infinite ${i * 0.4}s`,
                        '@keyframes leaderboardSparkle': {
                          '0%, 100%': { opacity: 0, transform: 'scale(0) rotate(0deg)' },
                          '50%': { opacity: 1, transform: 'scale(1) rotate(180deg)' }
                        }
                      }}
                    />
                  ))}

                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, position: 'relative', zIndex: 1 }}>
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                        boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.3)}`,
                        mr: 2,
                        animation: 'leaderboardIconBounce 2s ease-in-out infinite',
                        '@keyframes leaderboardIconBounce': {
                          '0%, 20%, 50%, 80%, 100%': { transform: 'translateY(0)' },
                          '40%': { transform: 'translateY(-5px)' },
                          '60%': { transform: 'translateY(-2px)' }
                        }
                      }}
                    >
                      <EmojiEvents sx={{ color: 'white', fontSize: '1.5rem' }} />
                    </Box>
                    <Box>
                      <Typography
                        variant="h6"
                        fontWeight="bold"
                        sx={{
                          fontSize: { xs: '1.1rem', sm: '1.2rem', md: '1.35rem' },
                          background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.info.main})`,
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          backgroundClip: 'text',
                          position: 'relative',
                          '&::after': {
                            content: '""',
                            position: 'absolute',
                            bottom: -3,
                            left: 0,
                            width: '60%',
                            height: 2,
                            backgroundColor: theme.palette.primary.main,
                            borderRadius: 1
                          }
                        }}
                      >
                        Class Leaderboard
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        Top performers in your class
                      </Typography>
                    </Box>
                  </Box>

                <Zoom in={true} style={{ transitionDelay: '1200ms' }}>
                  <Box sx={{ position: 'relative', zIndex: 1 }}>
                    <Leaderboard
                      title={leaderboardData.length > 0 ? "Class Leaderboard" : "No Classmates Found"}
                      subtitle={leaderboardData.length > 0 ?
                        leaderboardData[0]?.studentClass ?
                          `${leaderboardData[0].studentClass} - Based on exam performance` :
                          "Based on exam performance" :
                        "Complete exams to appear on the leaderboard"}
                      data={leaderboardData}
                      maxItems={5}
                      showViewAll={leaderboardData.length > 5}
                      onViewAll={() => {}}
                      highlightCurrentUser={true}
                      currentUserId={user?._id}
                      type="score"
                      emptyMessage="No students in your class have completed exams yet"
                    />
                  </Box>
                </Zoom>
                </Box>
              </Grid>

              {/* Enhanced Recent Exams */}
              <Grid item xs={12} md={8}>
                <Box
                  sx={{
                    p: { xs: 3, sm: 4 },
                    borderRadius: { xs: 3, md: 4 },
                    background: `linear-gradient(135deg,
                      ${alpha(theme.palette.info.main, 0.05)} 0%,
                      ${alpha(theme.palette.success.main, 0.05)} 50%,
                      ${alpha(theme.palette.warning.main, 0.05)} 100%)`,
                    border: `2px solid ${alpha(theme.palette.info.main, 0.2)}`,
                    mb: { xs: 2, sm: 3 },
                    height: '100%',
                    position: 'relative',
                    overflow: 'hidden',
                    boxShadow: `0 15px 35px ${alpha(theme.palette.info.main, 0.15)}`
                  }}
                >
                  {/* Enhanced Decorative elements */}
                  <Box
                    sx={{
                      position: 'absolute',
                      top: -60,
                      right: -60,
                      width: 220,
                      height: 220,
                      borderRadius: '50%',
                      background: `radial-gradient(circle, ${alpha(theme.palette.info.main, 0.15)} 0%, transparent 70%)`,
                      zIndex: 0,
                      animation: 'examFloat 12s ease-in-out infinite',
                      '@keyframes examFloat': {
                        '0%': { transform: 'translateY(0px) rotate(0deg)' },
                        '50%': { transform: 'translateY(-30px) rotate(180deg)' },
                        '100%': { transform: 'translateY(0px) rotate(360deg)' }
                      }
                    }}
                  />
                  <Box
                    sx={{
                      position: 'absolute',
                      bottom: -40,
                      left: -40,
                      width: 160,
                      height: 160,
                      borderRadius: '50%',
                      background: `radial-gradient(circle, ${alpha(theme.palette.success.main, 0.15)} 0%, transparent 70%)`,
                      zIndex: 0,
                      animation: 'examFloat 15s ease-in-out infinite reverse',
                    }}
                  />

                  {/* Exam sparkles */}
                  {[...Array(6)].map((_, i) => (
                    <Box
                      key={i}
                      sx={{
                        position: 'absolute',
                        width: 5,
                        height: 5,
                        borderRadius: '50%',
                        bgcolor: [theme.palette.info.main, theme.palette.success.main, theme.palette.warning.main][i % 3],
                        top: `${15 + i * 12}%`,
                        left: `${5 + i * 15}%`,
                        animation: `examSparkle 4s ease-in-out infinite ${i * 0.5}s`,
                        '@keyframes examSparkle': {
                          '0%, 100%': { opacity: 0, transform: 'scale(0) rotate(0deg)' },
                          '50%': { opacity: 1, transform: 'scale(1) rotate(180deg)' }
                        }
                      }}
                    />
                  ))}

                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 4, position: 'relative', zIndex: 1 }}>
                    <Box
                      sx={{
                        width: 50,
                        height: 50,
                        borderRadius: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: `linear-gradient(135deg, ${theme.palette.info.main} 0%, ${theme.palette.info.dark} 100%)`,
                        boxShadow: `0 6px 16px ${alpha(theme.palette.info.main, 0.4)}`,
                        mr: 3,
                        animation: 'examIconPulse 3s ease-in-out infinite',
                        '@keyframes examIconPulse': {
                          '0%, 100%': { transform: 'scale(1)' },
                          '50%': { transform: 'scale(1.1)' }
                        }
                      }}
                    >
                      <Assessment sx={{ color: 'white', fontSize: '1.8rem' }} />
                    </Box>
                    <Box>
                      <Typography
                        variant="h5"
                        fontWeight="bold"
                        sx={{
                          fontSize: { xs: '1.3rem', sm: '1.5rem', md: '1.7rem' },
                          background: `linear-gradient(135deg, ${theme.palette.info.main}, ${theme.palette.success.main})`,
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          backgroundClip: 'text',
                          position: 'relative',
                          '&::after': {
                            content: '""',
                            position: 'absolute',
                            bottom: -5,
                            left: 0,
                            width: '50%',
                            height: 3,
                            background: `linear-gradient(90deg, ${theme.palette.info.main}, ${theme.palette.success.main})`,
                            borderRadius: 2
                          }
                        }}
                      >
                        Recent Exams
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        Your latest exam activities and progress
                      </Typography>
                    </Box>
                  </Box>
                <Zoom in={true} style={{ transitionDelay: '1300ms' }}>
                  <Card
                    elevation={0}
                    sx={{
                      borderRadius: { xs: 2, md: 3 },
                      overflow: 'hidden',
                      position: 'relative',
                      border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        boxShadow: `0 8px 25px ${alpha(theme.palette.info.main, 0.15)}`,
                        transform: 'translateY(-5px)'
                      }
                    }}
                  >
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '6px',
                        background: `linear-gradient(90deg, ${theme.palette.info.main}, ${theme.palette.success.main})`,
                      }}
                    />
                    <CardContent sx={{ pt: 4 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Avatar
                            sx={{
                              bgcolor: 'primary.main',
                              mr: 2,
                              width: 45,
                              height: 45,
                              boxShadow: '0 4px 8px rgba(0, 0, 0, 0.15)',
                            }}
                          >
                            <School />
                          </Avatar>
                          <Typography variant="h5" component="h2" fontWeight="bold">
                            Recent Exams
                          </Typography>
                        </Box>
                        <Tooltip title="Refresh exams">
                          <IconButton
                            color="primary"
                            sx={{
                              bgcolor: 'primary.lighter',
                              '&:hover': { bgcolor: 'primary.light', color: 'white' }
                            }}
                          >
                            <Refresh />
                          </IconButton>
                        </Tooltip>
                      </Box>
                      <Divider sx={{ mb: 3 }} />

                      {loading ? (
                        <Box sx={{ py: 2 }}>
                          <Grid container spacing={3}>
                            {[1, 2, 3].map((item) => (
                              <Grid item xs={12} md={4} key={item}>
                                <Card variant="outlined" sx={{ height: '100%', p: 2, borderRadius: 0 }}>
                                  <Skeleton variant="rectangular" height={30} width="80%" sx={{ mb: 1 }} />
                                  <Skeleton variant="rectangular" height={20} width="40%" sx={{ mb: 2 }} />
                                  <Skeleton variant="rectangular" height={60} sx={{ mb: 2 }} />
                                  <Skeleton variant="rectangular" height={20} width="60%" sx={{ mb: 2 }} />
                                  <Skeleton variant="rectangular" height={36} width="100%" />
                                </Card>
                              </Grid>
                            ))}
                          </Grid>
                        </Box>
                      ) : recentExams.length > 0 ? (
                        <Grid container spacing={3}>
                          {recentExams.map((exam) => (
                            <Grid item xs={12} md={4} key={exam._id}>
                              <Card
                                elevation={3}
                                sx={{
                                  height: '100%',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  borderRadius: { xs: 3, md: 4 },
                                  transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                                  position: 'relative',
                                  overflow: 'hidden',
                                  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                                  background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.95)} 0%, ${alpha(theme.palette.background.default, 0.95)} 100%)`,
                                  backdropFilter: 'blur(10px)',
                                  boxShadow: `0 10px 20px ${alpha(
                                    exam.status === 'completed'
                                      ? theme.palette.success.main
                                      : exam.status === 'in-progress'
                                        ? theme.palette.warning.main
                                        : theme.palette.primary.main,
                                    0.1
                                  )}`,
                                  '&:hover': {
                                    transform: 'translateY(-12px) scale(1.02)',
                                    boxShadow: `0 20px 40px ${alpha(
                                      exam.status === 'completed'
                                        ? theme.palette.success.main
                                        : exam.status === 'in-progress'
                                          ? theme.palette.warning.main
                                          : theme.palette.primary.main,
                                      0.2
                                    )}`,
                                  }
                                }}
                              >
                                <Box
                                  sx={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    height: '8px',
                                    background: exam.status === 'completed'
                                      ? `linear-gradient(90deg, ${theme.palette.success.light}, ${theme.palette.success.main})`
                                      : exam.status === 'in-progress'
                                        ? `linear-gradient(90deg, ${theme.palette.warning.light}, ${theme.palette.warning.main})`
                                        : `linear-gradient(90deg, ${theme.palette.info.light}, ${theme.palette.info.main})`,
                                    boxShadow: `0 2px 6px ${alpha(
                                      exam.status === 'completed'
                                        ? theme.palette.success.main
                                        : exam.status === 'in-progress'
                                          ? theme.palette.warning.main
                                          : theme.palette.info.main,
                                      0.4
                                    )}`,
                                    zIndex: 2
                                  }}
                                />

                                <Box sx={{ position: 'relative', overflow: 'hidden' }}>
                                  <CardMedia
                                    component="img"
                                    height="160"
                                    image="/exam.jpg"
                                    alt={exam.title}
                                    sx={{
                                      objectFit: 'cover',
                                      objectPosition: 'center',
                                      transition: 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
                                      filter: 'brightness(0.9) saturate(1.1)',
                                      '&:hover': {
                                        filter: 'brightness(1.1) saturate(1.2)',
                                        transform: 'scale(1.08)'
                                      }
                                    }}
                                  />

                                  {/* Enhanced gradient overlay */}
                                  <Box
                                    sx={{
                                      position: 'absolute',
                                      top: 0,
                                      left: 0,
                                      width: '100%',
                                      height: '100%',
                                      background: `linear-gradient(135deg,
                                        transparent 0%,
                                        ${alpha(theme.palette.background.paper, 0.1)} 30%,
                                        ${alpha(theme.palette.background.paper, 0.8)} 100%)`,
                                      zIndex: 1
                                    }}
                                  />

                                  {/* Floating particles effect */}
                                  {[...Array(3)].map((_, i) => (
                                    <Box
                                      key={i}
                                      sx={{
                                        position: 'absolute',
                                        width: 6,
                                        height: 6,
                                        borderRadius: '50%',
                                        bgcolor: alpha(
                                          exam.status === 'completed'
                                            ? theme.palette.success.main
                                            : exam.status === 'in-progress'
                                              ? theme.palette.warning.main
                                              : theme.palette.primary.main,
                                          0.6
                                        ),
                                        top: `${20 + i * 25}%`,
                                        left: `${15 + i * 30}%`,
                                        animation: `examParticle 4s ease-in-out infinite ${i * 0.8}s`,
                                        '@keyframes examParticle': {
                                          '0%, 100%': { opacity: 0, transform: 'translateY(0px) scale(0)' },
                                          '50%': { opacity: 1, transform: 'translateY(-15px) scale(1)' }
                                        },
                                        zIndex: 1
                                      }}
                                    />
                                  ))}

                                  {/* Enhanced status chip */}
                                  <Chip
                                    icon={getStatusIcon(exam.status)}
                                    label={exam.status.replace('-', ' ')}
                                    color={getStatusColor(exam.status)}
                                    size="small"
                                    sx={{
                                      position: 'absolute',
                                      top: 12,
                                      right: 12,
                                      textTransform: 'capitalize',
                                      fontWeight: 'bold',
                                      fontSize: '0.75rem',
                                      boxShadow: `0 4px 12px ${alpha(
                                        exam.status === 'completed'
                                          ? theme.palette.success.main
                                          : exam.status === 'in-progress'
                                            ? theme.palette.warning.main
                                            : theme.palette.primary.main,
                                        0.4
                                      )}`,
                                      zIndex: 2,
                                      backdropFilter: 'blur(10px)',
                                      background: exam.status === 'completed'
                                        ? `linear-gradient(135deg, ${theme.palette.success.main}, ${theme.palette.success.dark})`
                                        : exam.status === 'in-progress'
                                          ? `linear-gradient(135deg, ${theme.palette.warning.main}, ${theme.palette.warning.dark})`
                                          : `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
                                      color: 'white',
                                      border: '1px solid rgba(255,255,255,0.2)',
                                      '& .MuiChip-icon': {
                                        color: 'white'
                                      },
                                      animation: 'statusGlow 3s ease-in-out infinite alternate',
                                      '@keyframes statusGlow': {
                                        '0%': { boxShadow: `0 4px 12px ${alpha(
                                          exam.status === 'completed'
                                            ? theme.palette.success.main
                                            : exam.status === 'in-progress'
                                              ? theme.palette.warning.main
                                              : theme.palette.primary.main,
                                          0.4
                                        )}` },
                                        '100%': { boxShadow: `0 6px 20px ${alpha(
                                          exam.status === 'completed'
                                            ? theme.palette.success.main
                                            : exam.status === 'in-progress'
                                              ? theme.palette.warning.main
                                              : theme.palette.primary.main,
                                          0.6
                                        )}` }
                                      }
                                    }}
                                  />

                                  {/* Difficulty indicator dots */}
                                  <Box
                                    sx={{
                                      position: 'absolute',
                                      top: 12,
                                      left: 12,
                                      display: 'flex',
                                      gap: 0.5,
                                      zIndex: 2
                                    }}
                                  >
                                    {[1, 2, 3].map((level) => (
                                      <Box
                                        key={level}
                                        sx={{
                                          width: 8,
                                          height: 8,
                                          borderRadius: '50%',
                                          bgcolor: level <= (exam.difficulty || 2)
                                            ? theme.palette.error.main
                                            : alpha(theme.palette.grey[400], 0.4),
                                          boxShadow: level <= (exam.difficulty || 2)
                                            ? `0 0 8px ${alpha(theme.palette.error.main, 0.6)}`
                                            : 'none',
                                          backdropFilter: 'blur(5px)',
                                          border: '1px solid rgba(255,255,255,0.3)'
                                        }}
                                      />
                                    ))}
                                  </Box>
                                </Box>

                                <CardContent sx={{ flexGrow: 1, pt: 3, pb: 2, px: 3 }}>
                                  <Typography
                                    variant="h6"
                                    component="h3"
                                    fontWeight="bold"
                                    sx={{
                                      display: '-webkit-box',
                                      WebkitLineClamp: 2,
                                      WebkitBoxOrient: 'vertical',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      lineHeight: 1.3,
                                      height: '2.6em',
                                      fontSize: { xs: '1.1rem', sm: '1.2rem', md: '1.25rem' },
                                      color: theme.palette.text.primary,
                                      mb: 1.5,
                                      position: 'relative',
                                      pl: 1,
                                      '&::before': {
                                        content: '""',
                                        position: 'absolute',
                                        left: -4,
                                        top: 0,
                                        height: '100%',
                                        width: 4,
                                        borderRadius: 4,
                                        backgroundColor: exam.status === 'completed'
                                          ? theme.palette.success.main
                                          : exam.status === 'in-progress'
                                            ? theme.palette.warning.main
                                            : theme.palette.primary.main,
                                      }
                                    }}
                                  >
                                    {exam.title}
                                  </Typography>

                                  <Typography
                                    variant="body2"
                                    color="text.secondary"
                                    sx={{
                                      mb: 2.5,
                                      display: '-webkit-box',
                                      WebkitLineClamp: 2,
                                      WebkitBoxOrient: 'vertical',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      height: '3em',
                                      fontSize: { xs: '0.85rem', sm: '0.9rem' },
                                      lineHeight: 1.5,
                                      opacity: 0.85
                                    }}
                                  >
                                    {exam.description || 'No description available for this exam.'}
                                  </Typography>

                                  <Box sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 2,
                                    flexWrap: 'wrap',
                                    mb: 2
                                  }}>
                                    <Chip
                                      icon={<AccessTime fontSize="small" />}
                                      label={`${exam.timeLimit} min`}
                                      size="small"
                                      variant="outlined"
                                      color={
                                        exam.status === 'completed'
                                          ? 'success'
                                          : exam.status === 'in-progress'
                                            ? 'warning'
                                            : 'primary'
                                      }
                                      sx={{
                                        borderRadius: 6,
                                        fontWeight: 'medium',
                                        '& .MuiChip-icon': {
                                          color: 'inherit'
                                        }
                                      }}
                                    />

                                    {exam.questions && (
                                      <Chip
                                        icon={<Assessment fontSize="small" />}
                                        label={`${exam.questions.length} Questions`}
                                        size="small"
                                        variant="outlined"
                                        color="info"
                                        sx={{
                                          borderRadius: 6,
                                          fontWeight: 'medium',
                                          '& .MuiChip-icon': {
                                            color: 'inherit'
                                          }
                                        }}
                                      />
                                    )}
                                  </Box>
                                </CardContent>

                                <Box sx={{ p: 2, pt: 0, px: 3 }}>
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
                                    to={exam.status === 'completed'
                                      ? `/student/results/${exam._id}`
                                      : `/student/exam/${exam._id}`}
                                    endIcon={<ArrowForward />}
                                    fullWidth
                                    sx={{
                                      borderRadius: 8,
                                      py: { xs: 1.25, md: 1.5 },
                                      fontWeight: 'bold',
                                      position: 'relative',
                                      overflow: 'hidden',
                                      boxShadow: `0 8px 16px ${alpha(
                                        exam.status === 'completed'
                                          ? theme.palette.success.main
                                          : exam.status === 'in-progress'
                                            ? theme.palette.warning.main
                                            : theme.palette.primary.main,
                                        0.25
                                      )}`,
                                      background: exam.status === 'completed'
                                        ? `linear-gradient(135deg, ${theme.palette.success.main}, ${theme.palette.success.dark})`
                                        : exam.status === 'in-progress'
                                          ? `linear-gradient(135deg, ${theme.palette.warning.main}, ${theme.palette.warning.dark})`
                                          : `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
                                      transition: 'all 0.3s ease',
                                      textTransform: 'none',
                                      fontSize: { xs: '0.9rem', sm: '1rem' },
                                      letterSpacing: 0.5,
                                      '&:hover': {
                                        transform: 'translateY(-3px)',
                                        boxShadow: `0 12px 20px ${alpha(
                                          exam.status === 'completed'
                                            ? theme.palette.success.main
                                            : exam.status === 'in-progress'
                                              ? theme.palette.warning.main
                                              : theme.palette.primary.main,
                                          0.4
                                        )}`,
                                      },
                                      '&::after': {
                                        content: '""',
                                        position: 'absolute',
                                        top: 0,
                                        left: '-100%',
                                        width: '100%',
                                        height: '100%',
                                        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
                                        transition: 'all 0.8s ease',
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
                                </Box>
                              </Card>
                            </Grid>
                          ))}
                        </Grid>
                      ) : (
                        <Paper
                          elevation={0}
                          sx={{
                            py: 6,
                            px: 4,
                            textAlign: 'center',
                            bgcolor: 'background.default',
                            borderRadius: 3,
                          }}
                        >
                          <Box
                            component="img"
                            src="/exam.jpg"
                            alt="No exams available"
                            sx={{
                              width: '100%',
                              maxWidth: 200,
                              height: 'auto',
                              mb: 2,
                              opacity: 0.8
                            }}
                          />
                          <Typography variant="h6" color="text.secondary" gutterBottom>
                            No exams available at the moment
                          </Typography>
                          <Typography variant="body2" color="text.secondary" paragraph>
                            Check back later or contact your administrator for more information.
                          </Typography>
                          <Button
                            variant="contained"
                            color="primary"
                            component={RouterLink}
                            to="/student/exams"
                            sx={{ mt: 2 }}
                          >
                            Browse All Exams
                          </Button>
                        </Paper>
                      )}
                    </CardContent>

                    {recentExams.length > 0 && (
                      <Box sx={{ p: 2, bgcolor: 'background.default', borderTop: '1px solid', borderColor: 'divider' }}>
                        <Button
                          component={RouterLink}
                          to="/student/exams"
                          color="primary"
                          endIcon={<ArrowForward />}
                          sx={{ fontWeight: 'medium' }}
                        >
                          View All Exams
                        </Button>
                      </Box>
                    )}
                  </Card>
                </Zoom>
                </Box>
              </Grid>
            </Grid>
          </Grid>
          </Grid>
        </Grow>
      </Container>
    </StudentLayout>
  );
};

export default Dashboard;
