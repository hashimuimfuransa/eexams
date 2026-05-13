import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Grid,
  MenuItem,
  FormControl,
  FormControlLabel,
  Checkbox,
  InputAdornment,
  IconButton,
  Divider,
  Alert,
  Snackbar,
  useTheme,
  alpha,
  Fade,
  CircularProgress
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  PersonAdd as PersonAddIcon,
  Email as EmailIcon,
  School as SchoolIcon,
  Badge as BadgeIcon,
  Lock as LockIcon,
  Business as BusinessIcon,
  Class as ClassIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { registerStudent } from '../../../services/adminService';

const AddStudent = () => {
  const theme = useTheme();
  const navigate = useNavigate();

  // Form state
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    class: '',
    organization: '',
    password: '',
    confirmPassword: '',
    sendInvitation: true
  });

  // Validation state
  const [errors, setErrors] = useState({});

  // Password visibility state
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Loading state
  const [loading, setLoading] = useState(false);

  // Snackbar state
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });

  // Handle form input changes
  const handleChange = (e) => {
    const { name, value, checked } = e.target;
    setFormData({
      ...formData,
      [name]: name === 'sendInvitation' ? checked : value
    });

    // Clear error when field is edited
    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: ''
      });
    }
  };

  // Toggle password visibility
  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  // Toggle confirm password visibility
  const toggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword(!showConfirmPassword);
  };

  // Validate form
  const validateForm = () => {
    const newErrors = {};

    // Validate first name
    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }

    // Validate last name
    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!emailRegex.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    // Validate class
    if (!formData.class.trim()) {
      newErrors.class = 'Class is required';
    }

    // Validate organization
    if (!formData.organization.trim()) {
      newErrors.organization = 'Organization is required';
    }

    // Validate password
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    // Validate confirm password
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (validateForm()) {
      setLoading(true);

      try {
        // Prepare data for API
        const studentData = {
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          password: formData.password,
          class: formData.class,
          organization: formData.organization
        };

        console.log('Sending student data:', studentData);

        // Call API to register student
        const result = await registerStudent(studentData);
        console.log('Student registration successful:', result);

        // Show success message
        setSnackbar({
          open: true,
          message: 'Student added successfully!',
          severity: 'success'
        });

        // Send email invitation if selected
        if (formData.sendInvitation) {
          // This would be implemented in a real app
          console.log('Sending invitation email to:', formData.email);
        }

        // Reset form
        setFormData({
          firstName: '',
          lastName: '',
          email: '',
          class: '',
          organization: '',
          password: '',
          confirmPassword: '',
          sendInvitation: true
        });

        // Navigate after successful submission
        setTimeout(() => {
          navigate('/admin/students');
        }, 2000);
      } catch (error) {
        console.error('Error adding student:', error);

        let errorMessage = 'Failed to add student. Please try again.';

        // Get error message from response if available
        if (error.response && error.response.data) {
          errorMessage = error.response.data.message || errorMessage;
        }

        setSnackbar({
          open: true,
          message: errorMessage,
          severity: 'error'
        });
      } finally {
        setLoading(false);
      }
    }
  };

  // Handle snackbar close
  const handleSnackbarClose = () => {
    setSnackbar({
      ...snackbar,
      open: false
    });
  };

  // We're now using a text field for organization, so we don't need this list
  // The admin will type in the organization name directly

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
            Add New Student
          </Typography>
          <Typography
            variant="subtitle1"
            color="text.secondary"
            sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}
          >
            Create a new student account and send an invitation
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/admin/students')}
          sx={{
            borderRadius: 3,
            width: { xs: '100%', sm: 'auto' }
          }}
        >
          Back to Students
        </Button>
      </Box>

      {/* Form */}
      <Fade in={true} timeout={500}>
        <Paper
          elevation={0}
          sx={{
            borderRadius: { xs: 3, md: 4 },
            border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            overflow: 'hidden'
          }}
        >
          <Box
            component="form"
            onSubmit={handleSubmit}
            sx={{ p: { xs: 2, md: 3 } }}
          >
            <Grid container spacing={3}>
              {/* Personal Information */}
              <Grid item xs={12}>
                <Typography variant="h6" fontWeight="medium" gutterBottom>
                  Personal Information
                </Typography>
                <Divider sx={{ mb: 2 }} />
              </Grid>

              {/* First Name */}
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="First Name"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  error={!!errors.firstName}
                  helperText={errors.firstName}
                  required
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <PersonAddIcon color="action" />
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
                  value={formData.lastName}
                  onChange={handleChange}
                  error={!!errors.lastName}
                  helperText={errors.lastName}
                  required
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />
              </Grid>

              {/* Email */}
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  error={!!errors.email}
                  helperText={errors.email}
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

              {/* Class */}
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Class"
                  name="class"
                  value={formData.class}
                  onChange={handleChange}
                  error={!!errors.class}
                  helperText={errors.class || "e.g. Grade 10, CS101, Year 3"}
                  required
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <ClassIcon color="action" />
                      </InputAdornment>
                    ),
                  }}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />
              </Grid>

              {/* Organization */}
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Organization"
                  name="organization"
                  value={formData.organization}
                  onChange={handleChange}
                  error={!!errors.organization}
                  helperText={errors.organization || "Enter school or institution name"}
                  required
                  placeholder="e.g. Example High School"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <BusinessIcon color="action" />
                      </InputAdornment>
                    ),
                  }}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />
              </Grid>

              {/* Account Information */}
              <Grid item xs={12} sx={{ mt: 2 }}>
                <Typography variant="h6" fontWeight="medium" gutterBottom>
                  Account Information
                </Typography>
                <Divider sx={{ mb: 2 }} />
              </Grid>

              {/* Password */}
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={handleChange}
                  error={!!errors.password}
                  helperText={errors.password}
                  required
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockIcon color="action" />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={togglePasswordVisibility}
                          edge="end"
                        >
                          {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
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
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  error={!!errors.confirmPassword}
                  helperText={errors.confirmPassword}
                  required
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockIcon color="action" />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={toggleConfirmPasswordVisibility}
                          edge="end"
                        >
                          {showConfirmPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />
              </Grid>

              {/* Send Invitation */}
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formData.sendInvitation}
                      onChange={handleChange}
                      name="sendInvitation"
                      color="primary"
                    />
                  }
                  label="Send email invitation to the student"
                />
              </Grid>

              {/* Submit Button */}
              <Grid item xs={12} sx={{ mt: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    variant="contained"
                    color="primary"
                    size="large"
                    type="submit"
                    disabled={loading}
                    startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                    sx={{
                      borderRadius: 3,
                      px: 4,
                      py: 1.5,
                      boxShadow: `0 4px 14px ${alpha(theme.palette.primary.main, 0.3)}`,
                      width: { xs: '100%', sm: 'auto' }
                    }}
                  >
                    {loading ? 'Adding Student...' : 'Add Student'}
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </Box>
        </Paper>
      </Fade>

      {/* Success/Error Snackbar */}
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
    </Box>
  );
};

export default AddStudent;
