import React, { useState, useEffect, useContext } from 'react';
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
  CardActions,
  Divider,
  Avatar,
  Chip,
  LinearProgress,
  Grow,
  Zoom,
  IconButton,
  Tooltip,
  Switch,
  FormControlLabel,
  TextField,
  useTheme,
  alpha,
  Slide,
  Fade
} from '@mui/material';
import {
  People,
  School,
  Assessment,
  LockOpen,
  Lock,
  Add,
  ArrowForward,
  Refresh,
  Edit,
  Delete,
  CheckCircle,
  Cancel,
  Warning,
  Dashboard as DashboardIcon,
  TrendingUp,
  Security,
  AdminPanelSettings,
  AutoGraph,
  LocalFireDepartment,
  WorkspacePremium,
  Verified
} from '@mui/icons-material';
import { AuthContext } from '../../context/AuthContext';
import api from '../../services/api';

const Dashboard = () => {
  const theme = useTheme();
  const { user } = useContext(AuthContext);
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalExams: 0,
    completedExams: 0,
    pendingGrading: 0
  });
  const [systemLocked, setSystemLocked] = useState(false);
  const [lockMessage, setLockMessage] = useState('');
  const [recentExams, setRecentExams] = useState([]);
  const [recentStudents, setRecentStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lockLoading, setLockLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch system lock status
      const lockRes = await api.get('/admin/system-lock');
      setSystemLocked(lockRes.data.isLocked);
      setLockMessage(lockRes.data.lockMessage);

      // Fetch students
      const studentsRes = await api.get('/admin/students');

      // Fetch exams
      const examsRes = await api.get('/exam');

      // Calculate stats
      const students = studentsRes.data;
      const exams = examsRes.data;

      const completedExams = exams.filter(exam => !exam.isLocked).length;

      // TODO: Replace with actual API call when implemented
      const pendingGrading = Math.floor(Math.random() * 10); // Placeholder

      setStats({
        totalStudents: students.length,
        totalExams: exams.length,
        completedExams,
        pendingGrading
      });

      // Get recent exams
      const sortedExams = [...exams].sort((a, b) => {
        return new Date(b.createdAt) - new Date(a.createdAt);
      }).slice(0, 3);

      setRecentExams(sortedExams);

      // Get recent students
      const sortedStudents = [...students].sort((a, b) => {
        return new Date(b.createdAt) - new Date(a.createdAt);
      }).slice(0, 5);

      setRecentStudents(sortedStudents);

      setLoading(false);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setError('Failed to load dashboard data. Please try again.');
      setLoading(false);
    }
  };

  const handleSystemLockToggle = async () => {
    try {
      setLockLoading(true);

      await api.put('/admin/system-lock', {
        isLocked: !systemLocked,
        lockMessage
      });

      setSystemLocked(!systemLocked);
      setLockLoading(false);
    } catch (error) {
      console.error('Error toggling system lock:', error);
      setError('Failed to update system lock status. Please try again.');
      setLockLoading(false);
    }
  };

  const handleLockMessageChange = (e) => {
    setLockMessage(e.target.value);
  };

  const handleSaveLockMessage = async () => {
    try {
      setLockLoading(true);

      await api.put('/admin/system-lock', {
        isLocked: systemLocked,
        lockMessage
      });

      setLockLoading(false);
    } catch (error) {
      console.error('Error updating lock message:', error);
      setError('Failed to update lock message. Please try again.');
      setLockLoading(false);
    }
  };

  // Format date
  const formatDate = (dateString) => {
    const options = {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  return (
    <Container maxWidth="lg" sx={{ mt: { xs: 3, sm: 4, md: 5 }, mb: { xs: 4, sm: 6, md: 8 }, px: { xs: 1, sm: 2, md: 3 } }}>
      <Grow in={true} timeout={800}>
        <Grid container spacing={{ xs: 2, sm: 3, md: 4 }}>
          {/* Enhanced Welcome Card */}
          <Grid item xs={12}>
            <Paper
              elevation={0}
              sx={{
                p: { xs: 4, sm: 5, md: 6 },
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                alignItems: { xs: 'flex-start', sm: 'center' },
                justifyContent: 'space-between',
                borderRadius: { xs: 4, md: 6 },
                background: `linear-gradient(135deg,
                  ${theme.palette.primary.dark} 0%,
                  ${theme.palette.primary.main} 50%,
                  ${theme.palette.secondary.main} 100%)`,
                color: 'white',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: `0 25px 50px ${alpha(theme.palette.primary.main, 0.3)}`,
                transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                '&:hover': {
                  boxShadow: `0 30px 60px ${alpha(theme.palette.primary.main, 0.4)}`,
                  transform: 'translateY(-4px)'
                }
              }}
            >
              {/* Enhanced decorative elements */}
              <Box
                sx={{
                  position: 'absolute',
                  top: -50,
                  right: -50,
                  width: { xs: '200px', sm: '250px', md: '300px' },
                  height: { xs: '200px', sm: '250px', md: '300px' },
                  background: 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)',
                  borderRadius: '50%',
                  animation: 'adminFloat 12s ease-in-out infinite',
                  '@keyframes adminFloat': {
                    '0%': { transform: 'translateY(0px) rotate(0deg)' },
                    '50%': { transform: 'translateY(-20px) rotate(180deg)' },
                    '100%': { transform: 'translateY(0px) rotate(360deg)' }
                  }
                }}
              />

              {/* Admin sparkles */}
              {[...Array(10)].map((_, i) => (
                <Box
                  key={i}
                  sx={{
                    position: 'absolute',
                    width: { xs: 3, sm: 4 },
                    height: { xs: 3, sm: 4 },
                    borderRadius: '50%',
                    bgcolor: 'rgba(255,255,255,0.8)',
                    top: `${10 + i * 8}%`,
                    left: `${5 + i * 9}%`,
                    animation: `adminSparkle 5s ease-in-out infinite ${i * 0.4}s`,
                    '@keyframes adminSparkle': {
                      '0%, 100%': { opacity: 0, transform: 'scale(0) rotate(0deg)' },
                      '50%': { opacity: 1, transform: 'scale(1) rotate(180deg)' }
                    }
                  }}
                />
              ))}

              <Box sx={{
                display: 'flex',
                alignItems: 'center',
                mb: { xs: 3, sm: 0 },
                position: 'relative',
                zIndex: 1
              }}>
                <Avatar
                  sx={{
                    bgcolor: 'rgba(255,255,255,0.2)',
                    width: { xs: 70, sm: 80 },
                    height: { xs: 70, sm: 80 },
                    mr: 3,
                    border: '3px solid rgba(255,255,255,0.3)',
                    boxShadow: '0 8px 20px rgba(0, 0, 0, 0.3)',
                    fontSize: { xs: '1.8rem', sm: '2rem' },
                    fontWeight: 'bold',
                    animation: 'adminAvatarFloat 6s ease-in-out infinite',
                    '@keyframes adminAvatarFloat': {
                      '0%, 100%': { transform: 'translateY(0px) rotate(0deg)' },
                      '50%': { transform: 'translateY(-8px) rotate(5deg)' }
                    }
                  }}
                >
                  <AdminPanelSettings sx={{ fontSize: { xs: '2rem', sm: '2.5rem' } }} />
                </Avatar>
                <Box>
                  <Typography
                    variant="h3"
                    component="h1"
                    fontWeight="bold"
                    sx={{
                      fontSize: { xs: '2rem', sm: '2.5rem', md: '3rem' },
                      background: 'linear-gradient(135deg, #ffffff 0%, #f0f0f0 50%, #ffffff 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                      mb: 1,
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
                    Welcome, {user?.fullName || 'Admin'}! 👨‍💼
                  </Typography>
                  <Typography
                    variant="h6"
                    sx={{
                      color: 'rgba(255,255,255,0.9)',
                      fontSize: { xs: '1rem', sm: '1.2rem' },
                      fontWeight: 'medium'
                    }}
                  >
                    Manage your educational ecosystem with powerful tools
                  </Typography>
                </Box>
              </Box>

              <Box sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                flexDirection: { xs: 'row', sm: 'row' },
                position: 'relative',
                zIndex: 1
              }}>
                <Tooltip title="Refresh dashboard data" arrow>
                  <IconButton
                    color="inherit"
                    onClick={fetchDashboardData}
                    sx={{
                      bgcolor: 'rgba(255,255,255,0.2)',
                      border: '1px solid rgba(255,255,255,0.3)',
                      '&:hover': {
                        bgcolor: 'rgba(255,255,255,0.3)',
                        transform: 'scale(1.1)'
                      }
                    }}
                  >
                    <Refresh />
                  </IconButton>
                </Tooltip>
                <Button
                  variant="contained"
                  color="secondary"
                  component={RouterLink}
                  to="/admin/exams"
                  endIcon={<ArrowForward />}
                  sx={{
                    fontWeight: 'bold',
                    px: 3,
                    py: 1.5,
                    borderRadius: 3,
                    bgcolor: 'rgba(255,255,255,0.9)',
                    color: theme.palette.primary.main,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                    '&:hover': {
                      bgcolor: 'rgba(255,255,255,1)',
                      transform: 'translateY(-2px)',
                      boxShadow: '0 6px 16px rgba(0,0,0,0.3)'
                    }
                  }}
                >
                  Manage Exams
                </Button>
              </Box>
            </Paper>
          </Grid>

          {/* Enhanced Stats Cards */}
          <Grid item xs={12}>
            <Grid container spacing={{ xs: 2, sm: 3 }}>
              <Grid item xs={12} sm={6} md={3}>
                <Zoom in={true} style={{ transitionDelay: '200ms' }}>
                  <Card
                    elevation={8}
                    sx={{
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      position: 'relative',
                      overflow: 'hidden',
                      borderRadius: 4,
                      background: `linear-gradient(135deg,
                        ${alpha(theme.palette.background.paper, 0.9)} 0%,
                        ${alpha(theme.palette.background.paper, 1)} 100%)`,
                      border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        transform: 'translateY(-8px)',
                        boxShadow: `0 20px 40px ${alpha(theme.palette.primary.main, 0.2)}`
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
                        background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.primary.light})`,
                        boxShadow: `0 2px 8px ${alpha(theme.palette.primary.main, 0.3)}`
                      }}
                    />
                    <CardContent sx={{ p: 3 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                        <Box>
                          <Typography variant="h6" component="h2" fontWeight="bold" color="text.primary">
                            Students
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Total registered
                          </Typography>
                        </Box>
                        <Avatar
                          sx={{
                            bgcolor: alpha(theme.palette.primary.main, 0.1),
                            color: theme.palette.primary.main,
                            width: 50,
                            height: 50,
                            animation: 'statsIconFloat 4s ease-in-out infinite',
                            '@keyframes statsIconFloat': {
                              '0%, 100%': { transform: 'translateY(0px)' },
                              '50%': { transform: 'translateY(-4px)' }
                            }
                          }}
                        >
                          <People sx={{ fontSize: '1.5rem' }} />
                        </Avatar>
                      </Box>
                      <Typography
                        variant="h3"
                        component="p"
                        fontWeight="bold"
                        sx={{
                          background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          backgroundClip: 'text',
                          mb: 2
                        }}
                      >
                        {stats.totalStudents}
                      </Typography>
                      <Button
                        component={RouterLink}
                        to="/admin/students"
                        variant="contained"
                        color="primary"
                        size="small"
                        fullWidth
                        sx={{
                          borderRadius: 2,
                          fontWeight: 'bold',
                          '&:hover': {
                            transform: 'scale(1.02)'
                          }
                        }}
                      >
                        Manage Students
                      </Button>
                    </CardContent>
                  </Card>
                </Zoom>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Zoom in={true} style={{ transitionDelay: '300ms' }}>
                  <Card
                    elevation={8}
                    sx={{
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      position: 'relative',
                      overflow: 'hidden',
                      borderRadius: 4,
                      background: `linear-gradient(135deg,
                        ${alpha(theme.palette.background.paper, 0.9)} 0%,
                        ${alpha(theme.palette.background.paper, 1)} 100%)`,
                      border: `1px solid ${alpha(theme.palette.info.main, 0.1)}`,
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        transform: 'translateY(-8px)',
                        boxShadow: `0 20px 40px ${alpha(theme.palette.info.main, 0.2)}`
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
                        background: `linear-gradient(90deg, ${theme.palette.info.main}, ${theme.palette.info.light})`,
                        boxShadow: `0 2px 8px ${alpha(theme.palette.info.main, 0.3)}`
                      }}
                    />
                    <CardContent sx={{ p: 3 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                        <Box>
                          <Typography variant="h6" component="h2" fontWeight="bold" color="text.primary">
                            Total Exams
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Created exams
                          </Typography>
                        </Box>
                        <Avatar
                          sx={{
                            bgcolor: alpha(theme.palette.info.main, 0.1),
                            color: theme.palette.info.main,
                            width: 50,
                            height: 50,
                            animation: 'statsIconFloat 4s ease-in-out infinite 0.5s'
                          }}
                        >
                          <School sx={{ fontSize: '1.5rem' }} />
                        </Avatar>
                      </Box>
                      <Typography
                        variant="h3"
                        component="p"
                        fontWeight="bold"
                        sx={{
                          background: `linear-gradient(135deg, ${theme.palette.info.main}, ${theme.palette.info.dark})`,
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          backgroundClip: 'text',
                          mb: 2
                        }}
                      >
                        {stats.totalExams}
                      </Typography>
                      <Button
                        component={RouterLink}
                        to="/admin/exams"
                        variant="contained"
                        color="info"
                        size="small"
                        fullWidth
                        sx={{
                          borderRadius: 2,
                          fontWeight: 'bold',
                          '&:hover': {
                            transform: 'scale(1.02)'
                          }
                        }}
                      >
                        Manage Exams
                      </Button>
                    </CardContent>
                  </Card>
                </Zoom>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Zoom in={true} style={{ transitionDelay: '400ms' }}>
                  <Card
                    elevation={8}
                    sx={{
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      position: 'relative',
                      overflow: 'hidden',
                      borderRadius: 4,
                      background: `linear-gradient(135deg,
                        ${alpha(theme.palette.background.paper, 0.9)} 0%,
                        ${alpha(theme.palette.background.paper, 1)} 100%)`,
                      border: `1px solid ${alpha(theme.palette.success.main, 0.1)}`,
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        transform: 'translateY(-8px)',
                        boxShadow: `0 20px 40px ${alpha(theme.palette.success.main, 0.2)}`
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
                        background: `linear-gradient(90deg, ${theme.palette.success.main}, ${theme.palette.success.light})`,
                        boxShadow: `0 2px 8px ${alpha(theme.palette.success.main, 0.3)}`
                      }}
                    />
                    <CardContent sx={{ p: 3 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                        <Box>
                          <Typography variant="h6" component="h2" fontWeight="bold" color="text.primary">
                            Active Exams
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Unlocked exams
                          </Typography>
                        </Box>
                        <Avatar
                          sx={{
                            bgcolor: alpha(theme.palette.success.main, 0.1),
                            color: theme.palette.success.main,
                            width: 50,
                            height: 50,
                            animation: 'statsIconFloat 4s ease-in-out infinite 1s'
                          }}
                        >
                          <LockOpen sx={{ fontSize: '1.5rem' }} />
                        </Avatar>
                      </Box>
                      <Typography
                        variant="h3"
                        component="p"
                        fontWeight="bold"
                        sx={{
                          background: `linear-gradient(135deg, ${theme.palette.success.main}, ${theme.palette.success.dark})`,
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          backgroundClip: 'text',
                          mb: 2
                        }}
                      >
                        {stats.completedExams}
                      </Typography>
                      <Button
                        component={RouterLink}
                        to="/admin/exams"
                        variant="contained"
                        color="success"
                        size="small"
                        fullWidth
                        sx={{
                          borderRadius: 2,
                          fontWeight: 'bold',
                          '&:hover': {
                            transform: 'scale(1.02)'
                          }
                        }}
                      >
                        View Active
                      </Button>
                    </CardContent>
                  </Card>
                </Zoom>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Zoom in={true} style={{ transitionDelay: '500ms' }}>
                  <Card
                    elevation={8}
                    sx={{
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      position: 'relative',
                      overflow: 'hidden',
                      borderRadius: 4,
                      background: `linear-gradient(135deg,
                        ${alpha(theme.palette.background.paper, 0.9)} 0%,
                        ${alpha(theme.palette.background.paper, 1)} 100%)`,
                      border: `1px solid ${alpha(theme.palette.warning.main, 0.1)}`,
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        transform: 'translateY(-8px)',
                        boxShadow: `0 20px 40px ${alpha(theme.palette.warning.main, 0.2)}`
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
                        background: `linear-gradient(90deg, ${theme.palette.warning.main}, ${theme.palette.warning.light})`,
                        boxShadow: `0 2px 8px ${alpha(theme.palette.warning.main, 0.3)}`
                      }}
                    />
                    <CardContent sx={{ p: 3 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                        <Box>
                          <Typography variant="h6" component="h2" fontWeight="bold" color="text.primary">
                            Pending Grading
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Awaiting review
                          </Typography>
                        </Box>
                        <Avatar
                          sx={{
                            bgcolor: alpha(theme.palette.warning.main, 0.1),
                            color: theme.palette.warning.main,
                            width: 50,
                            height: 50,
                            animation: 'statsIconFloat 4s ease-in-out infinite 1.5s'
                          }}
                        >
                          <Assessment sx={{ fontSize: '1.5rem' }} />
                        </Avatar>
                      </Box>
                      <Typography
                        variant="h3"
                        component="p"
                        fontWeight="bold"
                        sx={{
                          background: `linear-gradient(135deg, ${theme.palette.warning.main}, ${theme.palette.warning.dark})`,
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          backgroundClip: 'text',
                          mb: 2
                        }}
                      >
                        {stats.pendingGrading}
                      </Typography>
                      <Button
                        component={RouterLink}
                        to="/admin/results"
                        variant="contained"
                        color="warning"
                        size="small"
                        fullWidth
                        sx={{
                          borderRadius: 2,
                          fontWeight: 'bold',
                          '&:hover': {
                            transform: 'scale(1.02)'
                          }
                        }}
                      >
                        Review Results
                      </Button>
                    </CardContent>
                  </Card>
                </Zoom>
              </Grid>
            </Grid>
          </Grid>

          {/* System Lock Control */}
          <Grid item xs={12}>
            <Zoom in={true} style={{ transitionDelay: '600ms' }}>
              <Card elevation={3}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h5" component="h2" fontWeight="bold">
                      System Lock Control
                    </Typography>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={systemLocked}
                          onChange={handleSystemLockToggle}
                          color="primary"
                          disabled={lockLoading}
                        />
                      }
                      label={systemLocked ? 'System Locked' : 'System Unlocked'}
                    />
                  </Box>

                  <Divider sx={{ mb: 2 }} />

                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Box sx={{ mr: 2 }}>
                      {systemLocked ? (
                        <Avatar sx={{ bgcolor: 'error.main' }}>
                          <Lock />
                        </Avatar>
                      ) : (
                        <Avatar sx={{ bgcolor: 'success.main' }}>
                          <LockOpen />
                        </Avatar>
                      )}
                    </Box>
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="body1" fontWeight="medium">
                        {systemLocked
                          ? 'The system is currently locked. Students can only access exams.'
                          : 'The system is currently unlocked. Students have full access.'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {systemLocked
                          ? 'When locked, students can only access and take exams, but cannot view other parts of the system.'
                          : 'When unlocked, students have access to all features of the system.'}
                      </Typography>
                    </Box>
                  </Box>

                  <TextField
                    fullWidth
                    label="Lock Message (displayed to students when system is locked)"
                    value={lockMessage}
                    onChange={handleLockMessageChange}
                    variant="outlined"
                    margin="normal"
                    disabled={lockLoading}
                  />

                  <Button
                    variant="contained"
                    color="primary"
                    onClick={handleSaveLockMessage}
                    disabled={lockLoading}
                    sx={{ mt: 2 }}
                  >
                    Save Message
                  </Button>
                </CardContent>
              </Card>
            </Zoom>
          </Grid>

          {/* Recent Exams */}
          <Grid item xs={12} md={7}>
            <Zoom in={true} style={{ transitionDelay: '700ms' }}>
              <Card elevation={3}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h5" component="h2" fontWeight="bold">
                      Recent Exams
                    </Typography>
                    <Button
                      variant="contained"
                      color="primary"
                      component={RouterLink}
                      to="/admin/exams"
                      startIcon={<Add />}
                      size="small"
                    >
                      New Exam
                    </Button>
                  </Box>

                  <Divider sx={{ mb: 2 }} />

                  {loading ? (
                    <LinearProgress />
                  ) : recentExams.length > 0 ? (
                    recentExams.map((exam) => (
                      <Card
                        key={exam._id}
                        variant="outlined"
                        sx={{
                          mb: 2,
                          transition: 'transform 0.2s',
                          '&:hover': {
                            transform: 'translateY(-4px)',
                            boxShadow: '0 4px 10px rgba(0, 0, 0, 0.1)',
                          }
                        }}
                      >
                        <CardContent sx={{ pb: 1 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <Box>
                              <Typography variant="h6" component="h3" fontWeight="bold">
                                {exam.title}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {exam.description?.substring(0, 100)}
                                {exam.description?.length > 100 ? '...' : ''}
                              </Typography>
                            </Box>
                            <Chip
                              icon={exam.isLocked ? <Lock /> : <LockOpen />}
                              label={exam.isLocked ? 'Locked' : 'Unlocked'}
                              color={exam.isLocked ? 'error' : 'success'}
                              size="small"
                            />
                          </Box>
                        </CardContent>
                        <CardActions sx={{ justifyContent: 'flex-end' }}>
                          <Button
                            size="small"
                            component={RouterLink}
                            to={`/admin/results/${exam._id}`}
                            startIcon={<Assessment />}
                          >
                            Results
                          </Button>
                          <Button
                            size="small"
                            component={RouterLink}
                            to={`/admin/exams/${exam._id}`}
                            startIcon={<Edit />}
                          >
                            Edit
                          </Button>
                        </CardActions>
                      </Card>
                    ))
                  ) : (
                    <Typography variant="body1" color="text.secondary" align="center" sx={{ py: 4 }}>
                      No exams available. Create your first exam!
                    </Typography>
                  )}

                  {recentExams.length > 0 && (
                    <Box sx={{ textAlign: 'center', mt: 2 }}>
                      <Button
                        component={RouterLink}
                        to="/admin/exams"
                        color="primary"
                        endIcon={<ArrowForward />}
                      >
                        View All Exams
                      </Button>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Zoom>
          </Grid>

          {/* Recent Students */}
          <Grid item xs={12} md={5}>
            <Zoom in={true} style={{ transitionDelay: '800ms' }}>
              <Card elevation={3}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h5" component="h2" fontWeight="bold">
                      Recent Students
                    </Typography>
                    <Button
                      variant="contained"
                      color="primary"
                      component={RouterLink}
                      to="/admin/students"
                      startIcon={<Add />}
                      size="small"
                    >
                      Add Student
                    </Button>
                  </Box>

                  <Divider sx={{ mb: 2 }} />

                  {loading ? (
                    <LinearProgress />
                  ) : recentStudents.length > 0 ? (
                    recentStudents.map((student) => (
                      <Box
                        key={student._id}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          mb: 2,
                          p: 1,
                          borderRadius: 2,
                          transition: 'all 0.2s',
                          '&:hover': {
                            bgcolor: 'action.hover',
                          }
                        }}
                      >
                        <Avatar
                          sx={{
                            mr: 2,
                            bgcolor: 'primary.main',
                            boxShadow: '0 2px 5px rgba(0, 0, 0, 0.2)',
                          }}
                        >
                          {student.fullName.charAt(0).toUpperCase()}
                        </Avatar>
                        <Box sx={{ flexGrow: 1 }}>
                          <Typography variant="body1" fontWeight="medium">
                            {student.fullName}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            ID: {student.studentId} | {student.email}
                          </Typography>
                        </Box>
                        <IconButton
                          component={RouterLink}
                          to={`/admin/students/${student._id}`}
                          color="primary"
                          size="small"
                        >
                          <Edit fontSize="small" />
                        </IconButton>
                      </Box>
                    ))
                  ) : (
                    <Typography variant="body1" color="text.secondary" align="center" sx={{ py: 4 }}>
                      No students registered. Add your first student!
                    </Typography>
                  )}

                  {recentStudents.length > 0 && (
                    <Box sx={{ textAlign: 'center', mt: 2 }}>
                      <Button
                        component={RouterLink}
                        to="/admin/students"
                        color="primary"
                        endIcon={<ArrowForward />}
                      >
                        View All Students
                      </Button>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Zoom>
          </Grid>
        </Grid>
      </Grow>
    </Container>
  );
};

export default Dashboard;
