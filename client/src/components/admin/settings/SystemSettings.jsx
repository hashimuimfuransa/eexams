import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Grid,
  Divider,
  useTheme,
  alpha,
  Switch,
  FormControlLabel,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  OutlinedInput,
  Slider,
  Tabs,
  Tab,
  Alert,
  Snackbar,
  Card,
  CardContent,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Refresh as RefreshIcon,
  Security as SecurityIcon,
  Notifications as NotificationsIcon,
  Email as EmailIcon,
  Storage as StorageIcon,
  CloudUpload as CloudUploadIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const SystemSettings = () => {
  const theme = useTheme();
  const navigate = useNavigate();

  // State for tab
  const [tabValue, setTabValue] = useState(0);

  // State for settings
  const [settings, setSettings] = useState({
    // Security settings
    requireStrongPasswords: true,
    passwordExpiryDays: 90,
    maxLoginAttempts: 5,
    sessionTimeoutMinutes: 30,
    enableTwoFactor: false,

    // Notification settings
    emailNotifications: true,
    smsNotifications: false,
    systemAlertsEmail: 'admin@example.com',
    notifyOnExamStart: true,
    notifyOnExamEnd: true,
    notifyOnStudentRegistration: true,

    // Email settings
    smtpServer: 'smtp.example.com',
    smtpPort: 587,
    smtpUsername: 'notifications@example.com',
    smtpPassword: '••••••••••••',
    senderName: 'eexams Exam System',
    senderEmail: 'notifications@example.com',

    // Storage settings
    storageProvider: 'local',
    maxUploadSize: 10,
    allowedFileTypes: '.pdf,.doc,.docx,.jpg,.png',
    autoDeleteDays: 30,
    compressUploads: true
  });

  // State for save notification
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  // Handle settings change
  const handleSettingChange = (event) => {
    const { name, value, checked } = event.target;
    setSettings({
      ...settings,
      [name]: event.target.type === 'checkbox' ? checked : value
    });
  };

  // Handle slider change
  const handleSliderChange = (name) => (event, newValue) => {
    setSettings({
      ...settings,
      [name]: newValue
    });
  };

  // Handle save settings
  const handleSaveSettings = () => {
    // In a real app, this would save settings to the backend
    console.log('Saving settings:', settings);
    setSaveSuccess(true);
  };

  // Handle close snackbar
  const handleCloseSnackbar = () => {
    setSaveSuccess(false);
  };

  // Render tab content
  const renderTabContent = () => {
    switch (tabValue) {
      case 0: // Security
        return (
          <Box>
            <Typography variant="h6" fontWeight="medium" gutterBottom>
              Security Settings
            </Typography>
            <Divider sx={{ mb: 3 }} />

            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.requireStrongPasswords}
                      onChange={handleSettingChange}
                      name="requireStrongPasswords"
                      color="primary"
                    />
                  }
                  label="Require strong passwords"
                />
                <Typography variant="body2" color="text.secondary" sx={{ ml: 4, mb: 2 }}>
                  Passwords must contain at least 8 characters, including uppercase, lowercase, numbers, and special characters.
                </Typography>

                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.enableTwoFactor}
                      onChange={handleSettingChange}
                      name="enableTwoFactor"
                      color="primary"
                    />
                  }
                  label="Enable two-factor authentication"
                />
                <Typography variant="body2" color="text.secondary" sx={{ ml: 4, mb: 2 }}>
                  Users will be required to verify their identity using a second factor when logging in.
                </Typography>
              </Grid>

              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" gutterBottom>
                  Password Expiry (Days)
                </Typography>
                <Slider
                  value={settings.passwordExpiryDays}
                  onChange={handleSliderChange('passwordExpiryDays')}
                  aria-labelledby="password-expiry-slider"
                  valueLabelDisplay="auto"
                  step={30}
                  marks={[
                    { value: 0, label: 'Never' },
                    { value: 90, label: '90' },
                    { value: 180, label: '180' }
                  ]}
                  min={0}
                  max={180}
                  sx={{ mb: 3 }}
                />

                <Typography variant="subtitle2" gutterBottom>
                  Maximum Login Attempts
                </Typography>
                <Slider
                  value={settings.maxLoginAttempts}
                  onChange={handleSliderChange('maxLoginAttempts')}
                  aria-labelledby="max-login-attempts-slider"
                  valueLabelDisplay="auto"
                  step={1}
                  marks={[
                    { value: 3, label: '3' },
                    { value: 5, label: '5' },
                    { value: 10, label: '10' }
                  ]}
                  min={3}
                  max={10}
                  sx={{ mb: 3 }}
                />

                <Typography variant="subtitle2" gutterBottom>
                  Session Timeout (Minutes)
                </Typography>
                <Slider
                  value={settings.sessionTimeoutMinutes}
                  onChange={handleSliderChange('sessionTimeoutMinutes')}
                  aria-labelledby="session-timeout-slider"
                  valueLabelDisplay="auto"
                  step={15}
                  marks={[
                    { value: 15, label: '15' },
                    { value: 30, label: '30' },
                    { value: 60, label: '60' }
                  ]}
                  min={15}
                  max={60}
                  sx={{ mb: 3 }}
                />
              </Grid>

              <Grid item xs={12}>
                <Alert
                  severity="info"
                  sx={{
                    borderRadius: 2,
                    boxShadow: `0 4px 12px ${alpha(theme.palette.info.main, 0.2)}`
                  }}
                >
                  <Typography variant="subtitle2">Security Best Practices</Typography>
                  <Typography variant="body2">
                    We recommend enabling strong passwords and two-factor authentication for maximum security.
                    Regular password changes (every 90 days) help prevent unauthorized access.
                  </Typography>
                </Alert>
              </Grid>
            </Grid>
          </Box>
        );

      case 1: // Notifications
        return (
          <Box>
            <Typography variant="h6" fontWeight="medium" gutterBottom>
              Notification Settings
            </Typography>
            <Divider sx={{ mb: 3 }} />

            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.emailNotifications}
                      onChange={handleSettingChange}
                      name="emailNotifications"
                      color="primary"
                    />
                  }
                  label="Email Notifications"
                />
                <Typography variant="body2" color="text.secondary" sx={{ ml: 4, mb: 2 }}>
                  Send system notifications via email.
                </Typography>

                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.smsNotifications}
                      onChange={handleSettingChange}
                      name="smsNotifications"
                      color="primary"
                    />
                  }
                  label="SMS Notifications"
                />
                <Typography variant="body2" color="text.secondary" sx={{ ml: 4, mb: 2 }}>
                  Send important alerts via SMS (additional charges may apply).
                </Typography>

                <TextField
                  fullWidth
                  label="System Alerts Email"
                  name="systemAlertsEmail"
                  value={settings.systemAlertsEmail}
                  onChange={handleSettingChange}
                  margin="normal"
                  sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" gutterBottom>
                  Notification Events
                </Typography>

                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.notifyOnExamStart}
                      onChange={handleSettingChange}
                      name="notifyOnExamStart"
                      color="primary"
                    />
                  }
                  label="Exam Start"
                />
                <Typography variant="body2" color="text.secondary" sx={{ ml: 4, mb: 2 }}>
                  Notify students when an exam is about to start.
                </Typography>

                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.notifyOnExamEnd}
                      onChange={handleSettingChange}
                      name="notifyOnExamEnd"
                      color="primary"
                    />
                  }
                  label="Exam End"
                />
                <Typography variant="body2" color="text.secondary" sx={{ ml: 4, mb: 2 }}>
                  Notify students when an exam has been graded.
                </Typography>

                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.notifyOnStudentRegistration}
                      onChange={handleSettingChange}
                      name="notifyOnStudentRegistration"
                      color="primary"
                    />
                  }
                  label="Student Registration"
                />
                <Typography variant="body2" color="text.secondary" sx={{ ml: 4, mb: 2 }}>
                  Notify administrators when new students register.
                </Typography>
              </Grid>
            </Grid>
          </Box>
        );

      case 2: // Email
        return (
          <Box>
            <Typography variant="h6" fontWeight="medium" gutterBottom>
              Email Configuration
            </Typography>
            <Divider sx={{ mb: 3 }} />

            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="SMTP Server"
                  name="smtpServer"
                  value={settings.smtpServer}
                  onChange={handleSettingChange}
                  margin="normal"
                  sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />

                <TextField
                  fullWidth
                  label="SMTP Port"
                  name="smtpPort"
                  type="number"
                  value={settings.smtpPort}
                  onChange={handleSettingChange}
                  margin="normal"
                  sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />

                <TextField
                  fullWidth
                  label="SMTP Username"
                  name="smtpUsername"
                  value={settings.smtpUsername}
                  onChange={handleSettingChange}
                  margin="normal"
                  sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />

                <TextField
                  fullWidth
                  label="SMTP Password"
                  name="smtpPassword"
                  type="password"
                  value={settings.smtpPassword}
                  onChange={handleSettingChange}
                  margin="normal"
                  sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Sender Name"
                  name="senderName"
                  value={settings.senderName}
                  onChange={handleSettingChange}
                  margin="normal"
                  sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />

                <TextField
                  fullWidth
                  label="Sender Email"
                  name="senderEmail"
                  value={settings.senderEmail}
                  onChange={handleSettingChange}
                  margin="normal"
                  sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />

                <Box sx={{ mt: 3 }}>
                  <Button
                    variant="outlined"
                    color="primary"
                    sx={{ borderRadius: 2, mr: 2 }}
                  >
                    Test Connection
                  </Button>

                  <Button
                    variant="outlined"
                    color="primary"
                    sx={{ borderRadius: 2 }}
                  >
                    Send Test Email
                  </Button>
                </Box>
              </Grid>

              <Grid item xs={12}>
                <Alert
                  severity="info"
                  sx={{
                    borderRadius: 2,
                    boxShadow: `0 4px 12px ${alpha(theme.palette.info.main, 0.2)}`
                  }}
                >
                  <Typography variant="subtitle2">Email Configuration Help</Typography>
                  <Typography variant="body2">
                    For Gmail, use smtp.gmail.com (Port 587) and enable "Less secure app access" in your Google account settings.
                    For Office 365, use smtp.office365.com (Port 587).
                  </Typography>
                </Alert>
              </Grid>
            </Grid>
          </Box>
        );

      case 3: // Storage
        return (
          <Box>
            <Typography variant="h6" fontWeight="medium" gutterBottom>
              Storage Settings
            </Typography>
            <Divider sx={{ mb: 3 }} />

            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth margin="normal" sx={{ mb: 2 }}>
                  <InputLabel id="storage-provider-label">Storage Provider</InputLabel>
                  <Select
                    labelId="storage-provider-label"
                    name="storageProvider"
                    value={settings.storageProvider}
                    onChange={handleSettingChange}
                    input={<OutlinedInput label="Storage Provider" />}
                    sx={{ borderRadius: 2 }}
                  >
                    <MenuItem value="local">Local Storage</MenuItem>
                    <MenuItem value="s3">Amazon S3</MenuItem>
                    <MenuItem value="gcs">Google Cloud Storage</MenuItem>
                    <MenuItem value="azure">Azure Blob Storage</MenuItem>
                  </Select>
                </FormControl>

                <TextField
                  fullWidth
                  label="Maximum Upload Size (MB)"
                  name="maxUploadSize"
                  type="number"
                  value={settings.maxUploadSize}
                  onChange={handleSettingChange}
                  margin="normal"
                  sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />

                <TextField
                  fullWidth
                  label="Allowed File Types"
                  name="allowedFileTypes"
                  value={settings.allowedFileTypes}
                  onChange={handleSettingChange}
                  margin="normal"
                  sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                  helperText="Comma-separated list of file extensions (e.g., .pdf,.doc)"
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" gutterBottom>
                  Auto-Delete Old Files (Days)
                </Typography>
                <Slider
                  value={settings.autoDeleteDays}
                  onChange={handleSliderChange('autoDeleteDays')}
                  aria-labelledby="auto-delete-slider"
                  valueLabelDisplay="auto"
                  step={30}
                  marks={[
                    { value: 0, label: 'Never' },
                    { value: 30, label: '30' },
                    { value: 90, label: '90' },
                    { value: 180, label: '180' }
                  ]}
                  min={0}
                  max={180}
                  sx={{ mb: 3 }}
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.compressUploads}
                      onChange={handleSettingChange}
                      name="compressUploads"
                      color="primary"
                    />
                  }
                  label="Compress Uploads"
                />
                <Typography variant="body2" color="text.secondary" sx={{ ml: 4, mb: 2 }}>
                  Automatically compress uploaded files to save storage space.
                </Typography>

                {settings.storageProvider !== 'local' && (
                  <Card
                    variant="outlined"
                    sx={{
                      mt: 2,
                      borderRadius: 2,
                      border: `1px dashed ${alpha(theme.palette.primary.main, 0.5)}`
                    }}
                  >
                    <CardContent>
                      <Typography variant="subtitle2" color="primary" gutterBottom>
                        Cloud Storage Configuration
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Additional configuration is required for cloud storage providers.
                        Please contact your system administrator to set up API keys and access credentials.
                      </Typography>
                    </CardContent>
                  </Card>
                )}
              </Grid>

              <Grid item xs={12}>
                <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
                  <StorageIcon sx={{ color: theme.palette.primary.main, mr: 1 }} />
                  <Typography variant="subtitle2">
                    Current Storage Usage: 1.2 GB / 5 GB
                  </Typography>
                  <Tooltip title="Upgrade storage plan">
                    <IconButton size="small" sx={{ ml: 1 }}>
                      <InfoIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Grid>
            </Grid>
          </Box>
        );

      default:
        return null;
    }
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
            System Settings
          </Typography>
          <Typography
            variant="subtitle1"
            color="text.secondary"
            sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}
          >
            Configure system-wide settings and preferences
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

      {/* Settings tabs */}
      <Paper
        elevation={0}
        sx={{
          borderRadius: { xs: 3, md: 4 },
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          overflow: 'hidden',
          mb: 3
        }}
      >
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            px: 2,
            pt: 2,
            borderBottom: 1,
            borderColor: 'divider',
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 500,
              fontSize: '1rem',
              minWidth: 100
            }
          }}
        >
          <Tab
            label="Security"
            icon={<SecurityIcon />}
            iconPosition="start"
          />
          <Tab
            label="Notifications"
            icon={<NotificationsIcon />}
            iconPosition="start"
          />
          <Tab
            label="Email"
            icon={<EmailIcon />}
            iconPosition="start"
          />
          <Tab
            label="Storage"
            icon={<CloudUploadIcon />}
            iconPosition="start"
          />
        </Tabs>
      </Paper>

      {/* Settings content */}
      <Paper
        elevation={0}
        sx={{
          borderRadius: { xs: 3, md: 4 },
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          p: { xs: 2, md: 3 },
          mb: 3
        }}
      >
        {renderTabContent()}
      </Paper>

      {/* Action buttons */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          sx={{
            borderRadius: 3,
            px: 3,
            py: 1.2
          }}
        >
          Reset to Defaults
        </Button>
        <Button
          variant="contained"
          color="primary"
          startIcon={<SaveIcon />}
          onClick={handleSaveSettings}
          sx={{
            borderRadius: 3,
            px: 4,
            py: 1.2,
            boxShadow: `0 4px 14px ${alpha(theme.palette.primary.main, 0.3)}`
          }}
        >
          Save Settings
        </Button>
      </Box>

      {/* Success snackbar */}
      <Snackbar
        open={saveSuccess}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity="success"
          sx={{ width: '100%', borderRadius: 2 }}
        >
          Settings saved successfully!
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default SystemSettings;
