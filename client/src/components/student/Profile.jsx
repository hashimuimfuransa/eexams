import React, { useState, useEffect, useContext } from 'react';
import {
  Container,
  Grid,
  Paper,
  Typography,
  Box,
  Button,
  TextField,
  Avatar,
  Divider,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Alert,
  Snackbar,
  IconButton,
  InputAdornment,
  Grow,
  Fade,
  useTheme,
  alpha,
  Zoom,
  LinearProgress
} from '@mui/material';
import {
  Person,
  Email,
  School,
  Edit,
  Save,
  Cancel,
  Visibility,
  VisibilityOff,
  Badge,
  Business,
  Class as ClassIcon,
  Star,
  EmojiEvents,
  LocalFireDepartment,
  WorkspacePremium,
  Verified,
  PhotoCamera
} from '@mui/icons-material';
import { AuthContext } from '../../context/AuthContext';
import api from '../../services/api';
import StudentLayout from './StudentLayout';

const Profile = () => {
  const theme = useTheme();
  const { user, updateUserProfile } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    currentPassword: '',
    class: '',
    organization: ''
  });

  useEffect(() => {
    if (user) {
      setFormData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        password: '',
        currentPassword: '',
        class: user.class || '',
        organization: user.organization || ''
      });
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleToggleEditMode = () => {
    setEditMode(!editMode);
    if (editMode) {
      // Reset form data when canceling edit
      setFormData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        password: '',
        currentPassword: '',
        class: user.class || '',
        organization: user.organization || ''
      });
    }
  };

  const handleToggleShowPassword = () => {
    setShowPassword(!showPassword);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Prepare data for API
      const updateData = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        class: formData.class,
        organization: formData.organization
      };

      // Only include password if it was changed
      if (formData.password) {
        updateData.password = formData.password;
        updateData.currentPassword = formData.currentPassword;
      }

      // Call API to update profile
      const response = await api.put('/profile', updateData);

      // Update local user data
      updateUserProfile(response.data);

      setSnackbar({
        open: true,
        message: 'Profile updated successfully',
        severity: 'success'
      });

      setEditMode(false);
    } catch (error) {
      console.error('Error updating profile:', error);
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Failed to update profile',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSnackbarClose = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  return (
    <StudentLayout>
      <Container maxWidth="lg" sx={{ mb: { xs: 4, sm: 6, md: 8 }, mt: { xs: 3, sm: 4, md: 5 }, px: { xs: 1, sm: 2, md: 3 } }}>
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={handleSnackbarClose}
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <Alert
            onClose={handleSnackbarClose}
            severity={snackbar.severity}
            variant="filled"
            sx={{ width: '100%' }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>

        <Grow in={true} timeout={800}>
          <Paper
            elevation={0}
            sx={{
              p: { xs: 4, sm: 5, md: 6 },
              mb: { xs: 3, sm: 4 },
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
                width: { xs: '150px', sm: '200px', md: '250px' },
                height: { xs: '150px', sm: '200px', md: '250px' },
                background: 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)',
                borderRadius: '50%',
                animation: 'profileFloat 10s ease-in-out infinite',
                '@keyframes profileFloat': {
                  '0%': { transform: 'translateY(0px) rotate(0deg)' },
                  '50%': { transform: 'translateY(-20px) rotate(180deg)' },
                  '100%': { transform: 'translateY(0px) rotate(360deg)' }
                }
              }}
            />

            {/* Profile sparkles */}
            {[...Array(8)].map((_, i) => (
              <Box
                key={i}
                sx={{
                  position: 'absolute',
                  width: { xs: 3, sm: 4 },
                  height: { xs: 3, sm: 4 },
                  borderRadius: '50%',
                  bgcolor: 'rgba(255,255,255,0.8)',
                  top: `${15 + i * 10}%`,
                  left: `${10 + i * 10}%`,
                  animation: `profileSparkle 4s ease-in-out infinite ${i * 0.3}s`,
                  '@keyframes profileSparkle': {
                    '0%, 100%': { opacity: 0, transform: 'scale(0) rotate(0deg)' },
                    '50%': { opacity: 1, transform: 'scale(1) rotate(180deg)' }
                  }
                }}
              />
            ))}

            <Box sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: { xs: 'flex-start', sm: 'center' },
              flexDirection: { xs: 'column', sm: 'row' },
              gap: { xs: 3, sm: 2 },
              position: 'relative',
              zIndex: 1
            }}>
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
                  Your Profile 👤
                </Typography>
                <Typography
                  variant="h6"
                  sx={{
                    color: 'rgba(255,255,255,0.9)',
                    fontSize: { xs: '1rem', sm: '1.2rem' },
                    fontWeight: 'medium'
                  }}
                >
                  Manage your account settings and personal information
                </Typography>
              </Box>

              <Button
                variant="contained"
                color="secondary"
                onClick={handleToggleEditMode}
                startIcon={editMode ? <Cancel /> : <Edit />}
                sx={{
                  color: 'black',
                  fontWeight: 'bold',
                  borderRadius: 3,
                  px: { xs: 3, sm: 4 },
                  py: { xs: 1.2, sm: 1.5 },
                  fontSize: { xs: '0.9rem', sm: '1rem' },
                  boxShadow: `0 4px 12px ${alpha(theme.palette.secondary.main, 0.3)}`,
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: `0 6px 16px ${alpha(theme.palette.secondary.main, 0.4)}`
                  }
                }}
              >
                {editMode ? 'Cancel Changes' : 'Edit Profile'}
              </Button>
            </Box>
          </Paper>
        </Grow>

        <Grid container spacing={{ xs: 3, sm: 4 }}>
          <Grid item xs={12} md={4}>
            <Fade in={true} timeout={1000}>
              <Card
                elevation={8}
                sx={{
                  height: '100%',
                  borderRadius: 4,
                  position: 'relative',
                  overflow: 'hidden',
                  background: `linear-gradient(135deg,
                    ${alpha(theme.palette.background.paper, 0.9)} 0%,
                    ${alpha(theme.palette.background.paper, 1)} 100%)`,
                  border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                  transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  '&:hover': {
                    transform: 'translateY(-8px)',
                    boxShadow: `0 20px 40px ${alpha(theme.palette.primary.main, 0.15)}`
                  }
                }}
              >
                {/* Profile card glow effect */}
                <Box
                  sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    background: `radial-gradient(circle at top center, ${alpha(theme.palette.primary.main, 0.05)} 0%, transparent 50%)`,
                    animation: 'profileCardGlow 4s ease-in-out infinite alternate',
                    '@keyframes profileCardGlow': {
                      '0%': { opacity: 0.3 },
                      '100%': { opacity: 0.7 }
                    }
                  }}
                />

                <CardContent sx={{ p: { xs: 3, sm: 4 }, textAlign: 'center', position: 'relative', zIndex: 1 }}>
                  {/* Enhanced Avatar Section */}
                  <Box sx={{ position: 'relative', display: 'inline-block', mb: 3 }}>
                    {/* Rotating border */}
                    <Box
                      sx={{
                        position: 'absolute',
                        top: -8,
                        left: -8,
                        right: -8,
                        bottom: -8,
                        borderRadius: '50%',
                        background: `conic-gradient(
                          ${theme.palette.primary.main} 0deg,
                          ${theme.palette.secondary.main} 120deg,
                          ${theme.palette.info.main} 240deg,
                          ${theme.palette.primary.main} 360deg
                        )`,
                        animation: 'profileAvatarRotate 8s linear infinite',
                        '@keyframes profileAvatarRotate': {
                          '0%': { transform: 'rotate(0deg)' },
                          '100%': { transform: 'rotate(360deg)' }
                        }
                      }}
                    />

                    <Avatar
                      sx={{
                        width: { xs: 100, sm: 120, md: 140 },
                        height: { xs: 100, sm: 120, md: 140 },
                        bgcolor: 'background.paper',
                        color: theme.palette.primary.main,
                        fontSize: { xs: '2.5rem', sm: '3rem', md: '3.5rem' },
                        fontWeight: 'bold',
                        boxShadow: `0 12px 30px ${alpha(theme.palette.primary.main, 0.3)}`,
                        border: '6px solid white',
                        position: 'relative',
                        zIndex: 2,
                        transition: 'all 0.4s ease',
                        animation: 'profileAvatarFloat 6s ease-in-out infinite',
                        '@keyframes profileAvatarFloat': {
                          '0%, 100%': { transform: 'translateY(0px)' },
                          '50%': { transform: 'translateY(-8px)' }
                        },
                        '&:hover': {
                          transform: 'scale(1.05)',
                          boxShadow: `0 16px 40px ${alpha(theme.palette.primary.main, 0.4)}`
                        }
                      }}
                    >
                      {user?.firstName?.charAt(0) || user?.email?.charAt(0) || 'S'}
                    </Avatar>

                    {/* Status indicator */}
                    <Box
                      sx={{
                        position: 'absolute',
                        bottom: 8,
                        right: 8,
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        bgcolor: 'success.main',
                        border: '4px solid white',
                        boxShadow: `0 0 0 3px ${alpha(theme.palette.success.main, 0.3)}`,
                        animation: 'profileStatusPulse 2s ease-in-out infinite',
                        '@keyframes profileStatusPulse': {
                          '0%, 100%': { transform: 'scale(1)' },
                          '50%': { transform: 'scale(1.2)' }
                        },
                        zIndex: 3
                      }}
                    />

                    {/* Verified badge */}
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        bgcolor: theme.palette.info.main,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: `0 4px 12px ${alpha(theme.palette.info.main, 0.4)}`,
                        animation: 'profileVerifiedShine 3s ease-in-out infinite',
                        '@keyframes profileVerifiedShine': {
                          '0%, 100%': { transform: 'scale(1) rotate(0deg)' },
                          '50%': { transform: 'scale(1.1) rotate(180deg)' }
                        },
                        zIndex: 3
                      }}
                    >
                      <Verified sx={{ color: 'white', fontSize: '1rem' }} />
                    </Box>
                  </Box>

                  <Typography
                    variant="h4"
                    fontWeight="bold"
                    sx={{
                      mb: 1,
                      fontSize: { xs: '1.3rem', sm: '1.5rem', md: '1.7rem' },
                      background: `linear-gradient(135deg, ${theme.palette.text.primary}, ${alpha(theme.palette.text.primary, 0.8)})`,
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text'
                    }}
                  >
                    {user?.firstName} {user?.lastName}
                  </Typography>

                  <Typography
                    variant="body1"
                    color="text.secondary"
                    sx={{
                      mb: 2,
                      fontSize: { xs: '0.9rem', sm: '1rem' },
                      fontWeight: 'medium'
                    }}
                  >
                    {user?.email}
                  </Typography>

                  <Chip
                    icon={<WorkspacePremium />}
                    label="Student"
                    color="primary"
                    sx={{
                      mt: 1,
                      borderRadius: 3,
                      fontWeight: 'bold',
                      px: 2,
                      '& .MuiChip-icon': {
                        color: 'white'
                      }
                    }}
                  />

                  <Divider sx={{ my: 3 }} />

                  {/* Enhanced Info Section */}
                  <Box sx={{ textAlign: 'left' }}>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        mb: 3,
                        p: 2,
                        borderRadius: 3,
                        background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)}, ${alpha(theme.palette.primary.light, 0.03)})`,
                        border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                        transition: 'all 0.3s ease',
                        '&:hover': {
                          transform: 'translateX(4px)',
                          boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.1)}`
                        }
                      }}
                    >
                      <Avatar
                        sx={{
                          width: 40,
                          height: 40,
                          bgcolor: theme.palette.primary.main,
                          mr: 2,
                          boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.3)}`
                        }}
                      >
                        <School sx={{ fontSize: '1.2rem' }} />
                      </Avatar>
                      <Box>
                        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 'medium' }}>
                          Class
                        </Typography>
                        <Typography variant="body1" fontWeight="bold" color="primary.main">
                          {user?.class || 'Not specified'}
                        </Typography>
                      </Box>
                    </Box>

                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        mb: 2,
                        p: 2,
                        borderRadius: 3,
                        background: `linear-gradient(135deg, ${alpha(theme.palette.secondary.main, 0.05)}, ${alpha(theme.palette.secondary.light, 0.03)})`,
                        border: `1px solid ${alpha(theme.palette.secondary.main, 0.1)}`,
                        transition: 'all 0.3s ease',
                        '&:hover': {
                          transform: 'translateX(4px)',
                          boxShadow: `0 4px 12px ${alpha(theme.palette.secondary.main, 0.1)}`
                        }
                      }}
                    >
                      <Avatar
                        sx={{
                          width: 40,
                          height: 40,
                          bgcolor: theme.palette.secondary.main,
                          mr: 2,
                          boxShadow: `0 4px 12px ${alpha(theme.palette.secondary.main, 0.3)}`
                        }}
                      >
                        <Business sx={{ fontSize: '1.2rem' }} />
                      </Avatar>
                      <Box>
                        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 'medium' }}>
                          Organization
                        </Typography>
                        <Typography variant="body1" fontWeight="bold" color="secondary.main">
                          {user?.organization || 'Not specified'}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Fade>
          </Grid>

          <Grid item xs={12} md={8}>
            <Fade in={true} timeout={1200}>
              <Card
                elevation={8}
                sx={{
                  borderRadius: 4,
                  position: 'relative',
                  overflow: 'hidden',
                  background: `linear-gradient(135deg,
                    ${alpha(theme.palette.background.paper, 0.9)} 0%,
                    ${alpha(theme.palette.background.paper, 1)} 100%)`,
                  border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                  transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: `0 20px 40px ${alpha(theme.palette.primary.main, 0.15)}`
                  }
                }}
              >
                {/* Form glow effect */}
                <Box
                  sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    background: `radial-gradient(circle at top right, ${alpha(theme.palette.secondary.main, 0.05)} 0%, transparent 50%)`,
                    animation: 'formGlow 5s ease-in-out infinite alternate',
                    '@keyframes formGlow': {
                      '0%': { opacity: 0.3 },
                      '100%': { opacity: 0.6 }
                    }
                  }}
                />

                <CardContent sx={{ p: { xs: 3, sm: 4, md: 5 }, position: 'relative', zIndex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
                    <Avatar
                      sx={{
                        width: 48,
                        height: 48,
                        bgcolor: theme.palette.secondary.main,
                        mr: 2,
                        boxShadow: `0 4px 12px ${alpha(theme.palette.secondary.main, 0.3)}`
                      }}
                    >
                      <Person sx={{ fontSize: '1.5rem' }} />
                    </Avatar>
                    <Box>
                      <Typography
                        variant="h4"
                        fontWeight="bold"
                        sx={{
                          fontSize: { xs: '1.5rem', sm: '1.8rem', md: '2rem' },
                          background: `linear-gradient(135deg, ${theme.palette.secondary.main}, ${theme.palette.secondary.dark})`,
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          backgroundClip: 'text',
                          position: 'relative',
                          '&::after': {
                            content: '""',
                            position: 'absolute',
                            bottom: -4,
                            left: 0,
                            width: '50%',
                            height: 3,
                            background: `linear-gradient(90deg, ${theme.palette.secondary.main}, ${theme.palette.secondary.light})`,
                            borderRadius: 2
                          }
                        }}
                      >
                        {editMode ? 'Edit Profile Information' : 'Profile Information'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {editMode ? 'Update your profile details and preferences' : 'View your current profile information'}
                      </Typography>
                    </Box>
                  </Box>

                  <Box component="form" onSubmit={handleSubmit}>
                    <Grid container spacing={{ xs: 2, sm: 3 }}>
                      <Grid item xs={12} sm={6}>
                        <Zoom in={true} style={{ transitionDelay: '200ms' }}>
                          <TextField
                            fullWidth
                            label="First Name"
                            name="firstName"
                            value={formData.firstName}
                            onChange={handleChange}
                            disabled={!editMode}
                            required
                            InputProps={{
                              startAdornment: (
                                <InputAdornment position="start">
                                  <Person sx={{ color: editMode ? theme.palette.primary.main : 'text.secondary' }} />
                                </InputAdornment>
                              ),
                            }}
                            sx={{
                              '& .MuiOutlinedInput-root': {
                                borderRadius: 3,
                                transition: 'all 0.3s ease',
                                '&:hover': {
                                  boxShadow: editMode ? `0 4px 12px ${alpha(theme.palette.primary.main, 0.15)}` : 'none'
                                },
                                '&.Mui-focused': {
                                  boxShadow: `0 6px 16px ${alpha(theme.palette.primary.main, 0.2)}`
                                }
                              },
                              '& .MuiInputLabel-root': {
                                fontWeight: 'medium'
                              }
                            }}
                          />
                        </Zoom>
                      </Grid>

                      <Grid item xs={12} sm={6}>
                        <Zoom in={true} style={{ transitionDelay: '300ms' }}>
                          <TextField
                            fullWidth
                            label="Last Name"
                            name="lastName"
                            value={formData.lastName}
                            onChange={handleChange}
                            disabled={!editMode}
                            required
                            InputProps={{
                              startAdornment: (
                                <InputAdornment position="start">
                                  <Person sx={{ color: editMode ? theme.palette.primary.main : 'text.secondary' }} />
                                </InputAdornment>
                              ),
                            }}
                            sx={{
                              '& .MuiOutlinedInput-root': {
                                borderRadius: 3,
                                transition: 'all 0.3s ease',
                                '&:hover': {
                                  boxShadow: editMode ? `0 4px 12px ${alpha(theme.palette.primary.main, 0.15)}` : 'none'
                                },
                                '&.Mui-focused': {
                                  boxShadow: `0 6px 16px ${alpha(theme.palette.primary.main, 0.2)}`
                                }
                              },
                              '& .MuiInputLabel-root': {
                                fontWeight: 'medium'
                              }
                            }}
                          />
                        </Zoom>
                      </Grid>

                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          label="Email Address"
                          name="email"
                          value={formData.email}
                          onChange={handleChange}
                          disabled={true}
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <Email color="primary" />
                              </InputAdornment>
                            ),
                          }}
                        />
                      </Grid>

                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label="Class"
                          name="class"
                          value={formData.class}
                          onChange={handleChange}
                          disabled={!editMode}
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <ClassIcon color="primary" />
                              </InputAdornment>
                            ),
                          }}
                        />
                      </Grid>

                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label="Organization"
                          name="organization"
                          value={formData.organization}
                          onChange={handleChange}
                          disabled={!editMode}
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <Business color="primary" />
                              </InputAdornment>
                            ),
                          }}
                        />
                      </Grid>

                      {editMode && (
                        <>
                          <Grid item xs={12}>
                            <Divider>
                              <Chip label="Change Password (Optional)" sx={{ borderRadius: 0 }} />
                            </Divider>
                          </Grid>

                          <Grid item xs={12} sm={6}>
                            <TextField
                              fullWidth
                              label="Current Password"
                              name="currentPassword"
                              type={showPassword ? 'text' : 'password'}
                              value={formData.currentPassword}
                              onChange={handleChange}
                              InputProps={{
                                endAdornment: (
                                  <InputAdornment position="end">
                                    <IconButton
                                      onClick={handleToggleShowPassword}
                                      edge="end"
                                    >
                                      {showPassword ? <VisibilityOff /> : <Visibility />}
                                    </IconButton>
                                  </InputAdornment>
                                ),
                              }}
                            />
                          </Grid>

                          <Grid item xs={12} sm={6}>
                            <TextField
                              fullWidth
                              label="New Password"
                              name="password"
                              type={showPassword ? 'text' : 'password'}
                              value={formData.password}
                              onChange={handleChange}
                              InputProps={{
                                endAdornment: (
                                  <InputAdornment position="end">
                                    <IconButton
                                      onClick={handleToggleShowPassword}
                                      edge="end"
                                    >
                                      {showPassword ? <VisibilityOff /> : <Visibility />}
                                    </IconButton>
                                  </InputAdornment>
                                ),
                              }}
                            />
                          </Grid>
                        </>
                      )}
                    </Grid>

                    {editMode && (
                      <Zoom in={editMode} timeout={500}>
                        <Box
                          sx={{
                            mt: 5,
                            display: 'flex',
                            justifyContent: { xs: 'center', sm: 'flex-end' },
                            flexDirection: { xs: 'column', sm: 'row' },
                            gap: { xs: 2, sm: 3 },
                            p: 3,
                            borderRadius: 3,
                            background: `linear-gradient(135deg, ${alpha(theme.palette.grey[100], 0.5)}, ${alpha(theme.palette.grey[50], 0.8)})`,
                            border: `1px solid ${alpha(theme.palette.grey[300], 0.3)}`
                          }}
                        >
                          <Button
                            variant="outlined"
                            onClick={handleToggleEditMode}
                            startIcon={<Cancel />}
                            sx={{
                              borderRadius: 3,
                              px: { xs: 4, sm: 5 },
                              py: { xs: 1.2, sm: 1.5 },
                              fontSize: { xs: '0.9rem', sm: '1rem' },
                              fontWeight: 'bold',
                              borderColor: theme.palette.grey[400],
                              color: theme.palette.grey[700],
                              transition: 'all 0.3s ease',
                              '&:hover': {
                                borderColor: theme.palette.grey[600],
                                backgroundColor: alpha(theme.palette.grey[100], 0.8),
                                transform: 'translateY(-2px)',
                                boxShadow: `0 4px 12px ${alpha(theme.palette.grey[400], 0.3)}`
                              }
                            }}
                          >
                            Cancel Changes
                          </Button>
                          <Button
                            type="submit"
                            variant="contained"
                            color="primary"
                            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <Save />}
                            disabled={loading}
                            sx={{
                              borderRadius: 3,
                              px: { xs: 4, sm: 5 },
                              py: { xs: 1.2, sm: 1.5 },
                              fontSize: { xs: '0.9rem', sm: '1rem' },
                              fontWeight: 'bold',
                              background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
                              boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.3)}`,
                              transition: 'all 0.3s ease',
                              '&:hover': {
                                background: `linear-gradient(135deg, ${theme.palette.primary.dark}, ${theme.palette.primary.main})`,
                                transform: 'translateY(-2px)',
                                boxShadow: `0 6px 16px ${alpha(theme.palette.primary.main, 0.4)}`
                              },
                              '&:disabled': {
                                background: alpha(theme.palette.primary.main, 0.6),
                                transform: 'none'
                              }
                            }}
                          >
                            {loading ? 'Saving Changes...' : 'Save Changes'}
                          </Button>
                        </Box>
                      </Zoom>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Fade>
          </Grid>
        </Grid>
      </Container>
    </StudentLayout>
  );
};

export default Profile;
