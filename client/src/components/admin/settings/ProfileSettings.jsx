import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Grid,
  Divider,
  useTheme,
  alpha,
  Avatar,
  IconButton,
  InputAdornment,
  Tab,
  Tabs,
  Switch,
  FormControlLabel,
  Alert
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  PhotoCamera as PhotoCameraIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  School as SchoolIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';

const ProfileSettings = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Tab state
  const [activeTab, setActiveTab] = useState(0);

  // Form state
  const [profileData, setProfileData] = useState({
    firstName: user?.firstName || 'Admin',
    lastName: user?.lastName || 'User',
    email: user?.email || 'admin@example.com',
    phone: '123-456-7890',
    institution: 'University of Example',
    bio: 'Administrator for the eexams exam management system.',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    emailNotifications: true,
    smsNotifications: false,
    twoFactorAuth: false
  });

  // Password visibility state
  const [showPassword, setShowPassword] = useState({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false
  });

  // Success message state
  const [showSuccess, setShowSuccess] = useState(false);

  // Handle tab change
  const handleTabChange = (_, newValue) => {
    setActiveTab(newValue);
  };

  // Handle form input changes
  const handleChange = (e) => {
    const { name, value, checked } = e.target;
    setProfileData({
      ...profileData,
      [name]: name === 'emailNotifications' || name === 'smsNotifications' || name === 'twoFactorAuth'
        ? checked
        : value
    });
  };

  // Toggle password visibility
  const togglePasswordVisibility = (field) => {
    setShowPassword({
      ...showPassword,
      [field]: !showPassword[field]
    });
  };

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Saving profile data:', profileData);
    // In a real app, this would be an API call

    // Show success message
    setShowSuccess(true);

    // Hide success message after 3 seconds
    setTimeout(() => {
      setShowSuccess(false);
    }, 3000);
  };

  return (
    <Box>
      {/* Page header */}
      <Box sx={{
        mb: { xs: 2, md: 4 },
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        justifyContent: 'space-between',
        alignItems: { xs: 'flex-start', sm: 'center' },
        gap: { xs: 2, sm: 0 }
      }}>
        <Box>
          <Typography
            variant="h4"
            component="h1"
            fontWeight="bold"
            gutterBottom
            sx={{ fontSize: { xs: '1.5rem', sm: '2rem', md: '2.125rem' } }}
          >
            Profile Settings
          </Typography>
          <Typography
            variant="subtitle1"
            color="text.secondary"
            sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}
          >
            Manage your profile and account settings
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/dashboard')}
          sx={{
            borderRadius: 3,
            width: { xs: '100%', sm: 'auto' }
          }}
        >
          Back to Dashboard
        </Button>
      </Box>

      {/* Success Alert */}
      {showSuccess && (
        <Alert
          severity="success"
          sx={{
            mb: 3,
            borderRadius: 2,
            boxShadow: `0 4px 12px ${alpha(theme.palette.success.main, 0.2)}`
          }}
          onClose={() => setShowSuccess(false)}
        >
          Profile updated successfully!
        </Alert>
      )}

      {/* Profile Avatar */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          mb: 4
        }}
      >
        <Box sx={{ position: 'relative' }}>
          <Avatar
            sx={{
              width: 120,
              height: 120,
              mb: 2,
              background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
              boxShadow: `0 4px 20px ${alpha(theme.palette.primary.main, 0.4)}`,
              border: `4px solid ${alpha(theme.palette.background.paper, 0.9)}`
            }}
          >
            {profileData.firstName.charAt(0)}
          </Avatar>
          <IconButton
            sx={{
              position: 'absolute',
              bottom: 10,
              right: 0,
              backgroundColor: theme.palette.background.paper,
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
              '&:hover': {
                backgroundColor: alpha(theme.palette.primary.main, 0.1)
              }
            }}
          >
            <PhotoCameraIcon />
          </IconButton>
        </Box>
        <Typography variant="h6" fontWeight="bold">
          {profileData.firstName} {profileData.lastName}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {profileData.email}
        </Typography>
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 500,
              fontSize: '1rem',
              minWidth: 100
            }
          }}
        >
          <Tab label="Personal Info" />
          <Tab label="Security" />
          <Tab label="Notifications" />
        </Tabs>
      </Box>

      {/* Tab Panels */}
      <Box component="form" onSubmit={handleSubmit}>
        {/* Personal Info Tab */}
        {activeTab === 0 && (
          <Paper
            elevation={0}
            sx={{
              borderRadius: { xs: 3, md: 4 },
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
              overflow: 'hidden',
              p: { xs: 2, md: 3 },
              mb: 4
            }}
          >
            <Grid container spacing={3}>
              {/* Basic Info */}
              <Grid item xs={12}>
                <Typography variant="h6" fontWeight="medium" gutterBottom>
                  Basic Information
                </Typography>
                <Divider sx={{ mb: 2 }} />
              </Grid>

              {/* First Name */}
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="First Name"
                  name="firstName"
                  value={profileData.firstName}
                  onChange={handleChange}
                  required
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <PersonIcon color="action" />
                      </InputAdornment>
                    ),
                  }}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />
              </Grid>

              {/* Last Name */}
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Last Name"
                  name="lastName"
                  value={profileData.lastName}
                  onChange={handleChange}
                  required
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />
              </Grid>

              {/* Contact Info */}
              <Grid item xs={12} sx={{ mt: 2 }}>
                <Typography variant="h6" fontWeight="medium" gutterBottom>
                  Contact Information
                </Typography>
                <Divider sx={{ mb: 2 }} />
              </Grid>

              {/* Email */}
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Email"
                  name="email"
                  type="email"
                  value={profileData.email}
                  onChange={handleChange}
                  required
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <EmailIcon color="action" />
                      </InputAdornment>
                    ),
                  }}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />
              </Grid>

              {/* Phone */}
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Phone"
                  name="phone"
                  value={profileData.phone}
                  onChange={handleChange}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <PhoneIcon color="action" />
                      </InputAdornment>
                    ),
                  }}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />
              </Grid>

              {/* Institution */}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Institution"
                  name="institution"
                  value={profileData.institution}
                  onChange={handleChange}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SchoolIcon color="action" />
                      </InputAdornment>
                    ),
                  }}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />
              </Grid>

              {/* Bio */}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Bio"
                  name="bio"
                  value={profileData.bio}
                  onChange={handleChange}
                  multiline
                  rows={4}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />
              </Grid>
            </Grid>
          </Paper>
        )}

        {/* Security Tab */}
        {activeTab === 1 && (
          <Paper
            elevation={0}
            sx={{
              borderRadius: { xs: 3, md: 4 },
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
              overflow: 'hidden',
              p: { xs: 2, md: 3 },
              mb: 4
            }}
          >
            <Grid container spacing={3}>
              {/* Change Password */}
              <Grid item xs={12}>
                <Typography variant="h6" fontWeight="medium" gutterBottom>
                  Change Password
                </Typography>
                <Divider sx={{ mb: 2 }} />
              </Grid>

              {/* Current Password */}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Current Password"
                  name="currentPassword"
                  type={showPassword.currentPassword ? 'text' : 'password'}
                  value={profileData.currentPassword}
                  onChange={handleChange}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => togglePasswordVisibility('currentPassword')}
                          edge="end"
                        >
                          {showPassword.currentPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />
              </Grid>

              {/* New Password */}
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="New Password"
                  name="newPassword"
                  type={showPassword.newPassword ? 'text' : 'password'}
                  value={profileData.newPassword}
                  onChange={handleChange}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => togglePasswordVisibility('newPassword')}
                          edge="end"
                        >
                          {showPassword.newPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />
              </Grid>

              {/* Confirm Password */}
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Confirm Password"
                  name="confirmPassword"
                  type={showPassword.confirmPassword ? 'text' : 'password'}
                  value={profileData.confirmPassword}
                  onChange={handleChange}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => togglePasswordVisibility('confirmPassword')}
                          edge="end"
                        >
                          {showPassword.confirmPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />
              </Grid>

              {/* Two-Factor Authentication */}
              <Grid item xs={12} sx={{ mt: 2 }}>
                <Typography variant="h6" fontWeight="medium" gutterBottom>
                  Two-Factor Authentication
                </Typography>
                <Divider sx={{ mb: 2 }} />
              </Grid>

              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={profileData.twoFactorAuth}
                      onChange={handleChange}
                      name="twoFactorAuth"
                      color="primary"
                    />
                  }
                  label="Enable two-factor authentication"
                />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Two-factor authentication adds an extra layer of security to your account by requiring more than just a password to sign in.
                </Typography>
              </Grid>
            </Grid>
          </Paper>
        )}

        {/* Notifications Tab */}
        {activeTab === 2 && (
          <Paper
            elevation={0}
            sx={{
              borderRadius: { xs: 3, md: 4 },
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
              overflow: 'hidden',
              p: { xs: 2, md: 3 },
              mb: 4
            }}
          >
            <Grid container spacing={3}>
              {/* Notification Settings */}
              <Grid item xs={12}>
                <Typography variant="h6" fontWeight="medium" gutterBottom>
                  Notification Settings
                </Typography>
                <Divider sx={{ mb: 2 }} />
              </Grid>

              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={profileData.emailNotifications}
                      onChange={handleChange}
                      name="emailNotifications"
                      color="primary"
                    />
                  }
                  label="Email Notifications"
                />
                <Typography variant="body2" color="text.secondary" sx={{ ml: 4, mb: 2 }}>
                  Receive email notifications about exam schedules, student activities, and system updates.
                </Typography>

                <FormControlLabel
                  control={
                    <Switch
                      checked={profileData.smsNotifications}
                      onChange={handleChange}
                      name="smsNotifications"
                      color="primary"
                    />
                  }
                  label="SMS Notifications"
                />
                <Typography variant="body2" color="text.secondary" sx={{ ml: 4 }}>
                  Receive text message alerts for important events like exam start times and security alerts.
                </Typography>
              </Grid>
            </Grid>
          </Paper>
        )}

        {/* Save Button */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 4 }}>
          <Button
            variant="contained"
            color="primary"
            size="large"
            type="submit"
            startIcon={<SaveIcon />}
            sx={{
              borderRadius: 3,
              px: 4,
              py: 1.5,
              boxShadow: `0 4px 14px ${alpha(theme.palette.primary.main, 0.3)}`,
              width: { xs: '100%', sm: 'auto' }
            }}
          >
            Save Changes
          </Button>
        </Box>
      </Box>
    </Box>
  );
};

export default ProfileSettings;
