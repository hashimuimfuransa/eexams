import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Switch,
  FormControlLabel,
  Divider,
  Button,
  Card,
  CardContent,
  CardHeader,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  Alert,
  TextField,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  Slider,
  Select,
  MenuItem,
  FormControl,
  InputLabel
} from '@mui/material';
import {
  Security as SecurityIcon,
  DevicesOther as DevicesIcon,
  Block as BlockIcon,
  Notifications as NotificationsIcon,
  Timer as TimerIcon,
  Save as SaveIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Delete as DeleteIcon,
  History as HistoryIcon,
  PersonOff as PersonOffIcon,
  Settings as SettingsIcon,
  LockPerson as LockPersonIcon
} from '@mui/icons-material';

// Mock security alerts
const mockSecurityAlerts = [
  {
    id: 1,
    student: 'David Brown',
    email: 'david.brown@example.com',
    issue: 'Multiple device login attempt',
    timestamp: '2023-05-28 14:23:45',
    status: 'blocked',
    deviceInfo: 'Chrome on Windows, Chrome on Android'
  },
  {
    id: 2,
    student: 'Emily Williams',
    email: 'emily.williams@example.com',
    issue: 'Tab switching detected',
    timestamp: '2023-05-27 10:15:30',
    status: 'warned',
    deviceInfo: 'Firefox on MacOS'
  },
  {
    id: 3,
    student: 'Michael Johnson',
    email: 'michael.johnson@example.com',
    issue: 'Suspicious activity',
    timestamp: '2023-05-26 09:45:12',
    status: 'investigating',
    deviceInfo: 'Chrome on Windows'
  }
];

const SecuritySettings = () => {
  // Security settings state
  const [settings, setSettings] = useState({
    singleDeviceLogin: true,
    autoBlockMultipleDevices: true,
    notifyAdminOnViolation: true,
    preventTabSwitching: true,
    preventCopyPaste: true,
    preventScreenCapture: true,
    lockdownBrowser: false,
    requireWebcam: false,
    recordSessions: false,
    maxLoginAttempts: 5,
    sessionTimeout: 30,
    ipRestriction: false,
    allowedIPs: '',
    blockVPNs: true
  });

  // Security alerts state
  const [securityAlerts, setSecurityAlerts] = useState(mockSecurityAlerts);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [alertDialogOpen, setAlertDialogOpen] = useState(false);

  // Handle settings change
  const handleSettingChange = (setting, value) => {
    setSettings({
      ...settings,
      [setting]: value
    });
  };

  // Handle saving settings
  const handleSaveSettings = () => {
    // In a real app, this would save to the backend
    console.log('Saving settings:', settings);
    // Show success message or notification
  };

  // Handle opening alert details
  const handleOpenAlertDetails = (alert) => {
    setSelectedAlert(alert);
    setAlertDialogOpen(true);
  };

  // Handle resolving an alert
  const handleResolveAlert = (id) => {
    setSecurityAlerts(securityAlerts.map(alert => 
      alert.id === id ? { ...alert, status: 'resolved' } : alert
    ));
    setAlertDialogOpen(false);
  };

  // Handle deleting an alert
  const handleDeleteAlert = (id) => {
    setSecurityAlerts(securityAlerts.filter(alert => alert.id !== id));
    if (selectedAlert?.id === id) {
      setAlertDialogOpen(false);
    }
  };

  // Get status chip color
  const getStatusColor = (status) => {
    switch (status) {
      case 'blocked':
        return 'error';
      case 'warned':
        return 'warning';
      case 'investigating':
        return 'info';
      case 'resolved':
        return 'success';
      default:
        return 'default';
    }
  };

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" fontWeight="bold" color="primary.dark">
          Security Settings
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Configure security settings to protect exam integrity and prevent cheating
        </Typography>
      </Box>

      {/* Security Alerts */}
      <Paper elevation={3} sx={{ p: 3, mb: 4, borderRadius: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center' }}>
            <WarningIcon sx={{ mr: 1, color: 'warning.main' }} />
            Security Alerts
          </Typography>
          <Chip 
            label={`${securityAlerts.length} Active Alerts`} 
            color="warning" 
            size="small"
          />
        </Box>

        {securityAlerts.length > 0 ? (
          <List sx={{ width: '100%' }}>
            {securityAlerts.map((alert) => (
              <ListItem
                key={alert.id}
                sx={{ 
                  mb: 1, 
                  borderRadius: 1,
                  bgcolor: 'background.paper',
                  border: '1px solid',
                  borderColor: 'divider',
                  '&:hover': {
                    bgcolor: 'action.hover',
                  }
                }}
              >
                <ListItemIcon>
                  {alert.issue.includes('Multiple device') ? (
                    <DevicesIcon color="error" />
                  ) : alert.issue.includes('Tab switching') ? (
                    <VisibilityOffIcon color="warning" />
                  ) : (
                    <WarningIcon color="info" />
                  )}
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Typography variant="subtitle1" fontWeight="medium">
                      {alert.student} - {alert.issue}
                    </Typography>
                  }
                  secondary={
                    <Typography variant="body2" color="text.secondary">
                      {alert.timestamp}
                    </Typography>
                  }
                />
                <Chip 
                  label={alert.status.charAt(0).toUpperCase() + alert.status.slice(1)} 
                  color={getStatusColor(alert.status)}
                  size="small"
                  sx={{ mr: 1 }}
                />
                <ListItemSecondaryAction>
                  <Tooltip title="View Details">
                    <IconButton 
                      edge="end" 
                      onClick={() => handleOpenAlertDetails(alert)}
                      size="small"
                    >
                      <InfoIcon />
                    </IconButton>
                  </Tooltip>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        ) : (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <SecurityIcon sx={{ fontSize: 48, color: 'success.main', mb: 1 }} />
            <Typography variant="body1" color="text.secondary">
              No security alerts at this time
            </Typography>
          </Box>
        )}
      </Paper>

      {/* Security Settings */}
      <Grid container spacing={4}>
        {/* Device Restrictions */}
        <Grid item xs={12} md={6}>
          <Card elevation={3} sx={{ borderRadius: 2, height: '100%' }}>
            <CardHeader
              title={
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <DevicesIcon sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography variant="h6" fontWeight="bold">
                    Device Restrictions
                  </Typography>
                </Box>
              }
            />
            <Divider />
            <CardContent>
              <List disablePadding>
                <ListItem>
                  <ListItemText
                    primary="Single Device Login"
                    secondary="Restrict students to login from only one device at a time"
                  />
                  <Switch
                    edge="end"
                    checked={settings.singleDeviceLogin}
                    onChange={(e) => handleSettingChange('singleDeviceLogin', e.target.checked)}
                    color="primary"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Auto-Block Multiple Devices"
                    secondary="Automatically block accounts that attempt to login from multiple devices"
                  />
                  <Switch
                    edge="end"
                    checked={settings.autoBlockMultipleDevices}
                    onChange={(e) => handleSettingChange('autoBlockMultipleDevices', e.target.checked)}
                    color="primary"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Notify Admin on Violations"
                    secondary="Send notifications to admin when security violations occur"
                  />
                  <Switch
                    edge="end"
                    checked={settings.notifyAdminOnViolation}
                    onChange={(e) => handleSettingChange('notifyAdminOnViolation', e.target.checked)}
                    color="primary"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Maximum Login Attempts"
                    secondary="Number of failed login attempts before account is locked"
                  />
                  <Box sx={{ width: 150 }}>
                    <Slider
                      value={settings.maxLoginAttempts}
                      onChange={(e, newValue) => handleSettingChange('maxLoginAttempts', newValue)}
                      step={1}
                      marks
                      min={1}
                      max={10}
                      valueLabelDisplay="auto"
                    />
                  </Box>
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Exam Security */}
        <Grid item xs={12} md={6}>
          <Card elevation={3} sx={{ borderRadius: 2, height: '100%' }}>
            <CardHeader
              title={
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <LockPersonIcon sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography variant="h6" fontWeight="bold">
                    Exam Security
                  </Typography>
                </Box>
              }
            />
            <Divider />
            <CardContent>
              <List disablePadding>
                <ListItem>
                  <ListItemText
                    primary="Prevent Tab Switching"
                    secondary="Prevent students from switching tabs during exams"
                  />
                  <Switch
                    edge="end"
                    checked={settings.preventTabSwitching}
                    onChange={(e) => handleSettingChange('preventTabSwitching', e.target.checked)}
                    color="primary"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Prevent Copy/Paste"
                    secondary="Disable copy and paste functionality during exams"
                  />
                  <Switch
                    edge="end"
                    checked={settings.preventCopyPaste}
                    onChange={(e) => handleSettingChange('preventCopyPaste', e.target.checked)}
                    color="primary"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Prevent Screen Capture"
                    secondary="Block screen capture and screenshots during exams"
                  />
                  <Switch
                    edge="end"
                    checked={settings.preventScreenCapture}
                    onChange={(e) => handleSettingChange('preventScreenCapture', e.target.checked)}
                    color="primary"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Lockdown Browser"
                    secondary="Require students to use a secure browser for exams"
                  />
                  <Switch
                    edge="end"
                    checked={settings.lockdownBrowser}
                    onChange={(e) => handleSettingChange('lockdownBrowser', e.target.checked)}
                    color="primary"
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Advanced Security */}
        <Grid item xs={12}>
          <Card elevation={3} sx={{ borderRadius: 2 }}>
            <CardHeader
              title={
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <SettingsIcon sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography variant="h6" fontWeight="bold">
                    Advanced Security Settings
                  </Typography>
                </Box>
              }
            />
            <Divider />
            <CardContent>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <List disablePadding>
                    <ListItem>
                      <ListItemText
                        primary="Require Webcam"
                        secondary="Require students to enable webcam during exams for proctoring"
                      />
                      <Switch
                        edge="end"
                        checked={settings.requireWebcam}
                        onChange={(e) => handleSettingChange('requireWebcam', e.target.checked)}
                        color="primary"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText
                        primary="Record Sessions"
                        secondary="Record exam sessions for later review"
                      />
                      <Switch
                        edge="end"
                        checked={settings.recordSessions}
                        onChange={(e) => handleSettingChange('recordSessions', e.target.checked)}
                        color="primary"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText
                        primary="Session Timeout (minutes)"
                        secondary="Automatically end session after period of inactivity"
                      />
                      <Box sx={{ width: 150 }}>
                        <Slider
                          value={settings.sessionTimeout}
                          onChange={(e, newValue) => handleSettingChange('sessionTimeout', newValue)}
                          step={5}
                          marks
                          min={5}
                          max={60}
                          valueLabelDisplay="auto"
                        />
                      </Box>
                    </ListItem>
                  </List>
                </Grid>
                <Grid item xs={12} md={6}>
                  <List disablePadding>
                    <ListItem>
                      <ListItemText
                        primary="IP Restriction"
                        secondary="Restrict access to specific IP addresses or ranges"
                      />
                      <Switch
                        edge="end"
                        checked={settings.ipRestriction}
                        onChange={(e) => handleSettingChange('ipRestriction', e.target.checked)}
                        color="primary"
                      />
                    </ListItem>
                    {settings.ipRestriction && (
                      <ListItem>
                        <TextField
                          fullWidth
                          label="Allowed IP Addresses"
                          placeholder="e.g. 192.168.1.1, 10.0.0.0/24"
                          value={settings.allowedIPs}
                          onChange={(e) => handleSettingChange('allowedIPs', e.target.value)}
                          helperText="Enter comma-separated IP addresses or CIDR ranges"
                          variant="outlined"
                          size="small"
                        />
                      </ListItem>
                    )}
                    <ListItem>
                      <ListItemText
                        primary="Block VPNs and Proxies"
                        secondary="Prevent access through VPNs and proxy servers"
                      />
                      <Switch
                        edge="end"
                        checked={settings.blockVPNs}
                        onChange={(e) => handleSettingChange('blockVPNs', e.target.checked)}
                        color="primary"
                      />
                    </ListItem>
                  </List>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Save Button */}
      <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          color="primary"
          size="large"
          startIcon={<SaveIcon />}
          onClick={handleSaveSettings}
        >
          Save Security Settings
        </Button>
      </Box>

      {/* Alert Details Dialog */}
      <Dialog
        open={alertDialogOpen}
        onClose={() => setAlertDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        {selectedAlert && (
          <>
            <DialogTitle>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <WarningIcon sx={{ mr: 1, color: getStatusColor(selectedAlert.status) }} />
                Security Alert Details
              </Box>
            </DialogTitle>
            <DialogContent dividers>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Alert severity={
                    selectedAlert.status === 'blocked' ? 'error' :
                    selectedAlert.status === 'warned' ? 'warning' :
                    selectedAlert.status === 'investigating' ? 'info' : 'success'
                  }>
                    {selectedAlert.issue}
                  </Alert>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2">Student:</Typography>
                  <Typography variant="body2">{selectedAlert.student}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2">Email:</Typography>
                  <Typography variant="body2">{selectedAlert.email}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2">Timestamp:</Typography>
                  <Typography variant="body2">{selectedAlert.timestamp}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2">Status:</Typography>
                  <Chip 
                    label={selectedAlert.status.charAt(0).toUpperCase() + selectedAlert.status.slice(1)} 
                    color={getStatusColor(selectedAlert.status)}
                    size="small"
                  />
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2">Device Information:</Typography>
                  <Typography variant="body2">{selectedAlert.deviceInfo}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2">Recommended Action:</Typography>
                  <Typography variant="body2">
                    {selectedAlert.status === 'blocked' ? 
                      'Account has been automatically blocked. Review and contact student if necessary.' :
                      selectedAlert.status === 'warned' ?
                      'Student has been warned. Monitor for further violations.' :
                      'Investigate the suspicious activity and take appropriate action.'}
                  </Typography>
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button 
                startIcon={<DeleteIcon />}
                color="error"
                onClick={() => handleDeleteAlert(selectedAlert.id)}
              >
                Delete Alert
              </Button>
              <Button 
                variant="contained"
                color="primary"
                onClick={() => handleResolveAlert(selectedAlert.id)}
                disabled={selectedAlert.status === 'resolved'}
              >
                Mark as Resolved
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
};

export default SecuritySettings;
