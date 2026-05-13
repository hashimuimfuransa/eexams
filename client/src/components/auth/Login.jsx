import React, { useState, useContext, useEffect } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Avatar,
  Alert,
  CircularProgress,
  Grow,
  Slide,
  Grid,
  Card,
  CardContent,
  Divider,
  InputAdornment,
  IconButton,
  Fade,
  Zoom,
  Snackbar
} from '@mui/material';
import {
  LockOutlined,
  School,
  Person,
  Visibility,
  VisibilityOff,
  Security,
  CheckCircle,
  ArrowBack,
  Timer,
  Assessment,
  ErrorOutline,
  WarningAmber,
  InfoOutlined
} from '@mui/icons-material';
import { AuthContext } from '../../context/AuthContext';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showError, setShowError] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [animationComplete, setAnimationComplete] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'info'
  });
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [isLockedOut, setIsLockedOut] = useState(false);
  const [lockoutEndTime, setLockoutEndTime] = useState(null);
  const [remainingTime, setRemainingTime] = useState(0);
  const { login, error, loading } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    // Set animation complete after a delay
    const timer = setTimeout(() => {
      setAnimationComplete(true);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  // Check for existing lockout on component mount
  useEffect(() => {
    const storedLockoutEnd = localStorage.getItem('authLoginLockoutEnd');
    const storedFailedAttempts = localStorage.getItem('authLoginFailedAttempts');

    if (storedLockoutEnd) {
      const lockoutEnd = new Date(storedLockoutEnd);
      const now = new Date();

      if (now < lockoutEnd) {
        setIsLockedOut(true);
        setLockoutEndTime(lockoutEnd);
        setRemainingTime(Math.ceil((lockoutEnd - now) / 1000));
      } else {
        localStorage.removeItem('authLoginLockoutEnd');
        localStorage.removeItem('authLoginFailedAttempts');
      }
    }

    if (storedFailedAttempts) {
      setFailedAttempts(parseInt(storedFailedAttempts, 10));
    }
  }, []);

  // Countdown timer for lockout
  useEffect(() => {
    let interval;
    if (isLockedOut && remainingTime > 0) {
      interval = setInterval(() => {
        setRemainingTime(prev => {
          if (prev <= 1) {
            setIsLockedOut(false);
            setLockoutEndTime(null);
            setFailedAttempts(0);
            localStorage.removeItem('authLoginLockoutEnd');
            localStorage.removeItem('authLoginFailedAttempts');
            setSnackbar({
              open: true,
              message: 'Lockout expired. You can now try logging in again.',
              severity: 'info'
            });
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLockedOut, remainingTime]);

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleLockout = () => {
    const lockoutDuration = Math.min(300, 60 * Math.pow(2, Math.max(0, failedAttempts - 2)));
    const lockoutEnd = new Date(Date.now() + lockoutDuration * 1000);

    setIsLockedOut(true);
    setLockoutEndTime(lockoutEnd);
    setRemainingTime(lockoutDuration);

    localStorage.setItem('authLoginLockoutEnd', lockoutEnd.toISOString());
    localStorage.setItem('authLoginFailedAttempts', failedAttempts.toString());

    setSnackbar({
      open: true,
      message: `Too many failed attempts. Please wait ${formatTime(lockoutDuration)} before trying again.`,
      severity: 'error'
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setShowError(false);
    setSnackbar({ open: false, message: '', severity: 'info' });

    // Check if user is locked out
    if (isLockedOut) {
      setSnackbar({
        open: true,
        message: `Account temporarily locked. Please wait ${formatTime(remainingTime)} before trying again.`,
        severity: 'error'
      });
      return;
    }

    // Basic validation
    if (!username || !password) {
      setShowError(true);
      setSnackbar({
        open: true,
        message: 'Please enter both username and password',
        severity: 'warning'
      });
      return;
    }

    // Show initial login message
    setSnackbar({
      open: true,
      message: 'Logging in... Please wait (will timeout in 20 seconds if credentials are invalid)',
      severity: 'info'
    });

    try {
      await login({ email: username, password });

      // Reset failed attempts on successful login
      setFailedAttempts(0);
      localStorage.removeItem('authLoginFailedAttempts');
      localStorage.removeItem('authLoginLockoutEnd');

      // Show success message
      setSnackbar({
        open: true,
        message: 'Login successful! Redirecting...',
        severity: 'success'
      });

      setTimeout(() => {
        navigate('/');
      }, 400); // Reduced from 800ms to 400ms for faster navigation
    } catch (err) {
      setShowError(true);
      console.error('Login error:', err);

      // Track failed attempts for authentication errors
      let shouldTrackFailure = false;
      let errorMessage = 'Login failed. Please check your credentials.';

      // Handle timeout errors specifically
      if (err.message && err.message.includes('timeout')) {
        errorMessage = err.message;
        shouldTrackFailure = false; // Don't track timeout as failed attempt
      } else if (err.message && err.message.includes('Invalid credentials')) {
        shouldTrackFailure = true;
        errorMessage = 'Invalid credentials. Please check your username and password.';
      } else if (err.message && err.message.includes('blocked')) {
        errorMessage = 'Your account has been blocked. Please contact an administrator.';
        shouldTrackFailure = false;
      } else if (err.message && err.message.includes('Server error')) {
        errorMessage = 'Server error. Please try again later.';
        shouldTrackFailure = false;
      } else if (err.message) {
        // Check if it's a credential error
        if (err.message.toLowerCase().includes('credential') ||
            err.message.toLowerCase().includes('password') ||
            err.message.toLowerCase().includes('email')) {
          shouldTrackFailure = true;
        }
        errorMessage = err.message;
      }

      if (err.response) {
        switch (err.response.status) {
          case 401:
            errorMessage = 'Invalid credentials - Please check your username and password';
            shouldTrackFailure = true;
            break;
          case 403:
            errorMessage = 'Account disabled - Contact your administrator';
            break;
          case 404:
            errorMessage = 'Account not found - Please check your username';
            shouldTrackFailure = true;
            break;
          case 429:
            errorMessage = 'Too many attempts - Please wait before trying again';
            break;
          case 500:
            errorMessage = 'Server error - Please try again later';
            break;
          default:
            errorMessage = err.response.data?.message || 'Login failed. Please try again.';
            shouldTrackFailure = true;
        }
      } else if (err.request) {
        errorMessage = 'Connection failed - Check your internet connection';
      } else if (err.code === 'ECONNABORTED' || err.message.includes('timeout')) {
        errorMessage = 'Request timeout - Server is taking too long to respond';
      } else {
        errorMessage = err.message || 'Login failed. Please try again.';
        shouldTrackFailure = true;
      }

      // Track failed attempts and handle lockout
      if (shouldTrackFailure) {
        const newFailedAttempts = failedAttempts + 1;
        setFailedAttempts(newFailedAttempts);
        localStorage.setItem('authLoginFailedAttempts', newFailedAttempts.toString());

        // Check if lockout should be triggered (after 3 failed attempts)
        if (newFailedAttempts >= 3) {
          handleLockout();
          return;
        } else {
          // Show warning about remaining attempts
          const remainingAttempts = 3 - newFailedAttempts;
          errorMessage += ` (${remainingAttempts} attempt${remainingAttempts !== 1 ? 's' : ''} remaining)`;
        }
      }

      // Show error message immediately
      setSnackbar({
        open: true,
        message: errorMessage,
        severity: 'error'
      });
    }
  };

  const handleTogglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleSnackbarClose = (event, reason) => {
    if (reason === 'clickaway') {
      return;
    }
    setSnackbar({ ...snackbar, open: false });
  };

  const getSnackbarIcon = (severity) => {
    switch (severity) {
      case 'success':
        return <CheckCircle />;
      case 'error':
        return <ErrorOutline />;
      case 'warning':
        return <WarningAmber />;
      case 'info':
      default:
        return <InfoOutlined />;
    }
  };

  return (
    <Container component="main" maxWidth="md">
      <Box sx={{ mt: 4, mb: 4 }}>
        <Button
          component={RouterLink}
          to="/"
          startIcon={<ArrowBack />}
          sx={{ mb: 2 }}
        >
          Back to Home
        </Button>
      </Box>

      <Grid container spacing={3} sx={{ mt: 2 }}>
        {/* Left side - Login Form */}
        <Grid item xs={12} md={6}>
          <Grow in={true} timeout={800}>
            <Paper
              elevation={6}
              sx={{
                p: 4,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                borderRadius: 4,
                background: 'linear-gradient(135deg, #ffffff 0%, #f5f5f5 100%)',
                position: 'relative',
                overflow: 'hidden',
                height: '100%',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '5px',
                  background: `linear-gradient(90deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                }
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  width: '100%',
                }}
              >
                <Avatar
                  src="/logo.png"
                  alt="Logo"
                  sx={{
                    m: 1,
                    bgcolor: 'transparent',
                    width: 70,
                    height: 70,
                    boxShadow: '0 4px 10px rgba(0, 0, 0, 0.2)',
                    animation: animationComplete ? 'none' : 'pulse 1.5s infinite',
                    '@keyframes pulse': {
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
                />

                <Typography
                  component="h1"
                  variant="h4"
                  sx={{
                    fontWeight: 700,
                    mb: 1,
                    background: `linear-gradient(90deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  National Score
                </Typography>

                <Typography variant="h6" sx={{ mb: 3, color: 'text.secondary', textAlign: 'center' }}>
                  Sign in to your account
                </Typography>

                {error && showError && (
                  <Slide direction="down" in={showError} mountOnEnter unmountOnExit>
                    <Alert
                      severity="error"
                      sx={{ width: '100%', mb: 2 }}
                      onClose={() => setShowError(false)}
                    >
                      {error}
                    </Alert>
                  </Slide>
                )}

                <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1, width: '100%' }}>
                  <TextField
                    margin="normal"
                    required
                    fullWidth
                    id="username"
                    label="Username"
                    name="username"
                    autoComplete="username"
                    autoFocus
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Person color="primary" />
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                      }
                    }}
                  />

                  <TextField
                    margin="normal"
                    required
                    fullWidth
                    name="password"
                    label="Password"
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <LockOutlined color="primary" />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            aria-label="toggle password visibility"
                            onClick={handleTogglePasswordVisibility}
                            edge="end"
                          >
                            {showPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      )
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                      }
                    }}
                  />

                  <Button
                    type="submit"
                    fullWidth
                    variant="contained"
                    disabled={loading}
                    sx={{
                      mt: 3,
                      mb: 2,
                      py: 1.5,
                      fontSize: '1rem',
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
                    {loading ? (
                      <CircularProgress size={24} color="inherit" />
                    ) : (
                      'Sign In'
                    )}
                  </Button>

                  <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 2 }}>
                    Contact administrator if you don't have an account
                  </Typography>
                </Box>
              </Box>
            </Paper>
          </Grow>
        </Grid>

        {/* Right side - Information */}
        <Grid item xs={12} md={6}>
          <Fade in={true} timeout={1200}>
            <Box>
              <Typography variant="h5" component="h2" fontWeight="bold" gutterBottom>
                Welcome to National Score
              </Typography>

              <Typography variant="body1" paragraph>
                The comprehensive online examination platform designed for educational institutions.
              </Typography>

              <Divider sx={{ my: 3 }} />

              <Typography variant="h6" fontWeight="bold" gutterBottom>
                Key Benefits
              </Typography>

              {[
                { icon: <School />, text: "Access all your exams in one place" },
                { icon: <Timer />, text: "Take timed exams with automatic submission" },
                { icon: <Assessment />, text: "View detailed performance analytics" },
                { icon: <Security />, text: "Secure and reliable testing environment" }
              ].map((benefit, index) => (
                <Zoom in={true} style={{ transitionDelay: `${500 + (index * 150)}ms` }} key={index}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 2 }}>
                    <Avatar sx={{ bgcolor: 'primary.main', width: 40, height: 40 }}>
                      {benefit.icon}
                    </Avatar>
                    <Typography variant="body1">{benefit.text}</Typography>
                  </Box>
                </Zoom>
              ))}

              <Divider sx={{ my: 3 }} />

              <Card elevation={2} sx={{ mt: 3, borderRadius: 3, bgcolor: 'primary.lighter' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                    <Avatar sx={{ bgcolor: 'success.main' }}>
                      <CheckCircle />
                    </Avatar>
                    <Box>
                      <Typography variant="h6" fontWeight="bold" gutterBottom>
                        Need Help?
                      </Typography>
                      <Typography variant="body2">
                        If you're having trouble logging in or need assistance, please contact your administrator.
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Box>
          </Fade>
        </Grid>
      </Grid>

      {/* Enhanced Snackbar for user feedback */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={snackbar.severity === 'error' ? 8000 : snackbar.severity === 'success' ? 3000 : 5000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        sx={{ mt: 8 }}
      >
        <Alert
          onClose={handleSnackbarClose}
          severity={snackbar.severity}
          variant="filled"
          icon={getSnackbarIcon(snackbar.severity)}
          sx={{
            width: '100%',
            borderRadius: 2,
            fontWeight: 500,
            boxShadow: '0 8px 25px rgba(0,0,0,0.15)',
            '& .MuiAlert-icon': {
              fontSize: '1.5rem'
            }
          }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default Login;
