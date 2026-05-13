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
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  ListItemSecondaryAction,
  Avatar,
  IconButton,
  Chip,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Tabs,
  Tab,
  Badge,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  CheckCircle as CheckCircleIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  Search as SearchIcon,
  Flag as FlagIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

// Mock data for security alerts
const alertsData = [
  {
    id: '1',
    type: 'multiple-tabs',
    severity: 'high',
    student: 'Michael Brown',
    exam: 'Chemistry Quiz 3',
    timestamp: '2023-10-15 10:05 AM',
    status: 'unresolved',
    description: 'Student opened multiple browser tabs during the exam.',
    actions: []
  },
  {
    id: '2',
    type: 'idle-timeout',
    severity: 'medium',
    student: 'Robert Johnson',
    exam: 'Biology Midterm Exam',
    timestamp: '2023-10-15 10:12 AM',
    status: 'resolved',
    description: 'Student was idle for more than 5 minutes.',
    actions: [
      { action: 'warning-sent', timestamp: '2023-10-15 10:15 AM', by: 'System' },
      { action: 'marked-resolved', timestamp: '2023-10-15 10:20 AM', by: 'Admin' }
    ]
  },
  {
    id: '3',
    type: 'screen-sharing',
    severity: 'high',
    student: 'Michael Brown',
    exam: 'Chemistry Quiz 3',
    timestamp: '2023-10-15 10:08 AM',
    status: 'flagged',
    description: 'Screen sharing software detected during the exam.',
    actions: [
      { action: 'flagged', timestamp: '2023-10-15 10:10 AM', by: 'Admin' }
    ]
  },
  {
    id: '4',
    type: 'browser-resize',
    severity: 'medium',
    student: 'Michael Brown',
    exam: 'Chemistry Quiz 3',
    timestamp: '2023-10-15 10:10 AM',
    status: 'unresolved',
    description: 'Browser was resized multiple times, possibly to view other content.',
    actions: []
  },
  {
    id: '5',
    type: 'unauthorized-access',
    severity: 'critical',
    student: 'System',
    exam: 'All',
    timestamp: '2023-10-14 08:30 PM',
    status: 'resolved',
    description: 'Multiple failed login attempts detected from IP 192.168.1.45.',
    actions: [
      { action: 'ip-blocked', timestamp: '2023-10-14 08:35 PM', by: 'System' },
      { action: 'marked-resolved', timestamp: '2023-10-14 09:00 PM', by: 'Admin' }
    ]
  },
  {
    id: '6',
    type: 'suspicious-activity',
    severity: 'low',
    student: 'Emily Williams',
    exam: 'Physics Problem Set',
    timestamp: '2023-10-14 02:15 PM',
    status: 'dismissed',
    description: 'Unusual answer pattern detected.',
    actions: [
      { action: 'dismissed', timestamp: '2023-10-14 02:30 PM', by: 'Admin' }
    ]
  },
  {
    id: '7',
    type: 'system-update',
    severity: 'info',
    student: 'System',
    exam: 'All',
    timestamp: '2023-10-13 11:00 PM',
    status: 'info',
    description: 'System maintenance scheduled for 2023-10-20 at 11:00 PM.',
    actions: []
  }
];

const SecurityAlerts = () => {
  const theme = useTheme();
  const navigate = useNavigate();

  // State for tab
  const [tabValue, setTabValue] = useState(0);

  // State for filters
  const [filters, setFilters] = useState({
    severity: 'all',
    status: 'all',
    search: ''
  });

  // State for alert details dialog
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState(null);

  // State for action dialog
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState('');

  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  // Handle filter change
  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilters({
      ...filters,
      [name]: value
    });
  };

  // Handle view details
  const handleViewDetails = (alert) => {
    setSelectedAlert(alert);
    setDetailsOpen(true);
  };

  // Handle close details
  const handleCloseDetails = () => {
    setDetailsOpen(false);
  };

  // Handle open action dialog
  const handleOpenActionDialog = (alert, action) => {
    setSelectedAlert(alert);
    setActionType(action);
    setActionDialogOpen(true);
  };

  // Handle close action dialog
  const handleCloseActionDialog = () => {
    setActionDialogOpen(false);
  };

  // Handle perform action
  const handlePerformAction = () => {
    // In a real app, this would update the alert status
    console.log(`Performing ${actionType} on alert ${selectedAlert.id}`);
    setActionDialogOpen(false);
  };

  // Filter alerts based on tab and filters
  const getFilteredAlerts = () => {
    return alertsData.filter(alert => {
      // Filter by tab
      if (tabValue === 1 && alert.status !== 'unresolved') return false;
      if (tabValue === 2 && alert.status !== 'resolved' && alert.status !== 'dismissed') return false;

      // Filter by severity
      if (filters.severity !== 'all' && alert.severity !== filters.severity) return false;

      // Filter by status
      if (filters.status !== 'all' && alert.status !== filters.status) return false;

      // Filter by search
      if (filters.search &&
          !alert.student.toLowerCase().includes(filters.search.toLowerCase()) &&
          !alert.exam.toLowerCase().includes(filters.search.toLowerCase()) &&
          !alert.type.toLowerCase().includes(filters.search.toLowerCase())) {
        return false;
      }

      return true;
    });
  };

  // Get severity icon and color
  const getSeverityInfo = (severity) => {
    switch (severity) {
      case 'critical':
        return { icon: <ErrorIcon />, color: theme.palette.error.dark };
      case 'high':
        return { icon: <WarningIcon />, color: theme.palette.error.main };
      case 'medium':
        return { icon: <WarningIcon />, color: theme.palette.warning.main };
      case 'low':
        return { icon: <InfoIcon />, color: theme.palette.info.main };
      case 'info':
        return { icon: <InfoIcon />, color: theme.palette.primary.main };
      default:
        return { icon: <InfoIcon />, color: theme.palette.text.secondary };
    }
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'unresolved':
        return theme.palette.error.main;
      case 'flagged':
        return theme.palette.warning.main;
      case 'resolved':
        return theme.palette.success.main;
      case 'dismissed':
        return theme.palette.text.secondary;
      case 'info':
        return theme.palette.info.main;
      default:
        return theme.palette.text.secondary;
    }
  };

  // Get alert type display name
  const getAlertTypeName = (type) => {
    switch (type) {
      case 'multiple-tabs':
        return 'Multiple Tabs Detected';
      case 'idle-timeout':
        return 'Student Idle';
      case 'screen-sharing':
        return 'Screen Sharing Detected';
      case 'browser-resize':
        return 'Browser Resize Detected';
      case 'unauthorized-access':
        return 'Unauthorized Access Attempt';
      case 'suspicious-activity':
        return 'Suspicious Activity';
      case 'system-update':
        return 'System Update';
      default:
        return type.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  };

  // Get action display name
  const getActionName = (action) => {
    switch (action) {
      case 'warning-sent':
        return 'Warning Sent';
      case 'marked-resolved':
        return 'Marked as Resolved';
      case 'flagged':
        return 'Flagged for Review';
      case 'ip-blocked':
        return 'IP Address Blocked';
      case 'dismissed':
        return 'Dismissed';
      default:
        return action.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  };

  const filteredAlerts = getFilteredAlerts();

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
            Security Alerts
          </Typography>
          <Typography
            variant="subtitle1"
            color="text.secondary"
            sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}
          >
            View and manage security alerts and notifications
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/admin/security/monitoring')}
          sx={{
            borderRadius: 3,
            width: { xs: '100%', sm: 'auto' }
          }}
        >
          Back to Monitoring
        </Button>
      </Box>

      {/* Alert summary */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={6} sm={3}>
          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: 3,
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
              textAlign: 'center'
            }}
          >
            <Typography variant="h4" fontWeight="bold" color="error.main">
              {alertsData.filter(a => a.status === 'unresolved').length}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Unresolved
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={6} sm={3}>
          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: 3,
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
              textAlign: 'center'
            }}
          >
            <Typography variant="h4" fontWeight="bold" color="warning.main">
              {alertsData.filter(a => a.status === 'flagged').length}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Flagged
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={6} sm={3}>
          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: 3,
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
              textAlign: 'center'
            }}
          >
            <Typography variant="h4" fontWeight="bold" color="success.main">
              {alertsData.filter(a => a.status === 'resolved').length}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Resolved
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={6} sm={3}>
          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: 3,
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
              textAlign: 'center'
            }}
          >
            <Typography variant="h4" fontWeight="bold" color="text.secondary">
              {alertsData.filter(a => a.status === 'dismissed').length}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Dismissed
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Box sx={{ mb: 3 }}>
        <Tabs
          value={tabValue}
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
          <Tab
            label="All Alerts"
            icon={<Badge badgeContent={alertsData.length} color="primary" sx={{ '& .MuiBadge-badge': { fontSize: '0.7rem' } }}>
              <WarningIcon />
            </Badge>}
            iconPosition="start"
          />
          <Tab
            label="Unresolved"
            icon={<Badge badgeContent={alertsData.filter(a => a.status === 'unresolved').length} color="error" sx={{ '& .MuiBadge-badge': { fontSize: '0.7rem' } }}>
              <ErrorIcon />
            </Badge>}
            iconPosition="start"
          />
          <Tab
            label="Resolved"
            icon={<Badge badgeContent={alertsData.filter(a => a.status === 'resolved' || a.status === 'dismissed').length} color="success" sx={{ '& .MuiBadge-badge': { fontSize: '0.7rem' } }}>
              <CheckCircleIcon />
            </Badge>}
            iconPosition="start"
          />
        </Tabs>
      </Box>

      {/* Filters */}
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2, md: 3 },
          mb: { xs: 2, md: 3 },
          borderRadius: { xs: 3, md: 4 },
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`
        }}
      >
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              placeholder="Search alerts..."
              name="search"
              value={filters.search}
              onChange={handleFilterChange}
              InputProps={{
                startAdornment: <SearchIcon color="action" sx={{ mr: 1 }} />,
                sx: { borderRadius: 3 }
              }}
              size="small"
            />
          </Grid>

          <Grid item xs={12} sm={6} md={4}>
            <FormControl fullWidth size="small">
              <InputLabel id="severity-filter-label">Severity</InputLabel>
              <Select
                labelId="severity-filter-label"
                name="severity"
                value={filters.severity}
                onChange={handleFilterChange}
                label="Severity"
                sx={{ borderRadius: 3 }}
              >
                <MenuItem value="all">All Severities</MenuItem>
                <MenuItem value="critical">Critical</MenuItem>
                <MenuItem value="high">High</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="low">Low</MenuItem>
                <MenuItem value="info">Info</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6} md={4}>
            <FormControl fullWidth size="small">
              <InputLabel id="status-filter-label">Status</InputLabel>
              <Select
                labelId="status-filter-label"
                name="status"
                value={filters.status}
                onChange={handleFilterChange}
                label="Status"
                sx={{ borderRadius: 3 }}
              >
                <MenuItem value="all">All Statuses</MenuItem>
                <MenuItem value="unresolved">Unresolved</MenuItem>
                <MenuItem value="flagged">Flagged</MenuItem>
                <MenuItem value="resolved">Resolved</MenuItem>
                <MenuItem value="dismissed">Dismissed</MenuItem>
                <MenuItem value="info">Info</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      {/* Alerts list */}
      <Paper
        elevation={0}
        sx={{
          borderRadius: { xs: 3, md: 4 },
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          overflow: 'hidden',
          mb: 3
        }}
      >
        {filteredAlerts.length > 0 ? (
          <List>
            {filteredAlerts.map((alert, index) => (
              <ListItem
                key={alert.id}
                divider={index < filteredAlerts.length - 1}
                sx={{
                  py: 2,
                  backgroundColor: alert.severity === 'critical' || alert.severity === 'high'
                    ? alpha(theme.palette.error.main, 0.05)
                    : 'inherit'
                }}
              >
                <ListItemAvatar>
                  <Avatar
                    sx={{
                      bgcolor: alpha(getSeverityInfo(alert.severity).color, 0.1),
                      color: getSeverityInfo(alert.severity).color
                    }}
                  >
                    {getSeverityInfo(alert.severity).icon}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                      <Typography variant="subtitle2">
                        {getAlertTypeName(alert.type)}
                      </Typography>
                      <Chip
                        label={alert.severity.toUpperCase()}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: '0.7rem',
                          bgcolor: alpha(getSeverityInfo(alert.severity).color, 0.1),
                          color: getSeverityInfo(alert.severity).color,
                          fontWeight: 500
                        }}
                      />
                      <Chip
                        label={alert.status.charAt(0).toUpperCase() + alert.status.slice(1)}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: '0.7rem',
                          bgcolor: alpha(getStatusColor(alert.status), 0.1),
                          color: getStatusColor(alert.status),
                          fontWeight: 500
                        }}
                      />
                    </Box>
                  }
                  secondary={
                    <Box sx={{ mt: 0.5 }}>
                      <Typography variant="body2" color="text.secondary" component="span">
                        {alert.student} • {alert.exam} • {alert.timestamp}
                      </Typography>
                    </Box>
                  }
                />
                <ListItemSecondaryAction>
                  <IconButton
                    edge="end"
                    aria-label="view"
                    onClick={() => handleViewDetails(alert)}
                    sx={{ mr: 1, color: theme.palette.primary.main }}
                  >
                    <VisibilityIcon />
                  </IconButton>
                  {alert.status === 'unresolved' && (
                    <>
                      <IconButton
                        edge="end"
                        aria-label="flag"
                        onClick={() => handleOpenActionDialog(alert, 'flag')}
                        sx={{ mr: 1, color: theme.palette.warning.main }}
                      >
                        <FlagIcon />
                      </IconButton>
                      <IconButton
                        edge="end"
                        aria-label="resolve"
                        onClick={() => handleOpenActionDialog(alert, 'resolve')}
                        sx={{ mr: 1, color: theme.palette.success.main }}
                      >
                        <CheckCircleIcon />
                      </IconButton>
                    </>
                  )}
                  {alert.status !== 'dismissed' && alert.status !== 'info' && (
                    <IconButton
                      edge="end"
                      aria-label="dismiss"
                      onClick={() => handleOpenActionDialog(alert, 'dismiss')}
                      sx={{ color: theme.palette.text.secondary }}
                    >
                      <DeleteIcon />
                    </IconButton>
                  )}
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        ) : (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <WarningIcon sx={{ fontSize: 60, color: alpha(theme.palette.text.secondary, 0.2), mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              No Alerts Found
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {filters.search || filters.severity !== 'all' || filters.status !== 'all'
                ? 'No alerts match your filter criteria.'
                : 'There are no security alerts at the moment.'}
            </Typography>
          </Box>
        )}
      </Paper>

      {/* Alert details dialog */}
      <Dialog
        open={detailsOpen}
        onClose={handleCloseDetails}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            p: 1
          }
        }}
      >
        {selectedAlert && (
          <>
            <DialogTitle>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Avatar
                  sx={{
                    bgcolor: alpha(getSeverityInfo(selectedAlert.severity).color, 0.1),
                    color: getSeverityInfo(selectedAlert.severity).color
                  }}
                >
                  {getSeverityInfo(selectedAlert.severity).icon}
                </Avatar>
                <Typography variant="h6">
                  {getAlertTypeName(selectedAlert.type)}
                </Typography>
              </Box>
            </DialogTitle>
            <DialogContent>
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">
                    Severity
                  </Typography>
                  <Typography variant="body2" fontWeight="medium">
                    {selectedAlert.severity.toUpperCase()}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">
                    Status
                  </Typography>
                  <Typography variant="body2" fontWeight="medium">
                    {selectedAlert.status.charAt(0).toUpperCase() + selectedAlert.status.slice(1)}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">
                    Student
                  </Typography>
                  <Typography variant="body2" fontWeight="medium">
                    {selectedAlert.student}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">
                    Exam
                  </Typography>
                  <Typography variant="body2" fontWeight="medium">
                    {selectedAlert.exam}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">
                    Timestamp
                  </Typography>
                  <Typography variant="body2" fontWeight="medium">
                    {selectedAlert.timestamp}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">
                    Description
                  </Typography>
                  <Typography variant="body2" fontWeight="medium">
                    {selectedAlert.description}
                  </Typography>
                </Grid>
              </Grid>

              {selectedAlert.actions.length > 0 && (
                <>
                  <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                    Action History
                  </Typography>
                  <List dense>
                    {selectedAlert.actions.map((action, index) => (
                      <ListItem key={index} disablePadding sx={{ py: 0.5 }}>
                        <ListItemText
                          primary={getActionName(action.action)}
                          secondary={`${action.timestamp} by ${action.by}`}
                        />
                      </ListItem>
                    ))}
                  </List>
                </>
              )}
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button onClick={handleCloseDetails} variant="outlined" sx={{ borderRadius: 2 }}>
                Close
              </Button>
              {selectedAlert.status === 'unresolved' && (
                <>
                  <Button
                    onClick={() => {
                      handleCloseDetails();
                      handleOpenActionDialog(selectedAlert, 'flag');
                    }}
                    variant="outlined"
                    color="warning"
                    sx={{ borderRadius: 2 }}
                  >
                    Flag
                  </Button>
                  <Button
                    onClick={() => {
                      handleCloseDetails();
                      handleOpenActionDialog(selectedAlert, 'resolve');
                    }}
                    variant="contained"
                    color="success"
                    sx={{ borderRadius: 2 }}
                  >
                    Resolve
                  </Button>
                </>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Action dialog */}
      <Dialog
        open={actionDialogOpen}
        onClose={handleCloseActionDialog}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            p: 1
          }
        }}
      >
        {selectedAlert && (
          <>
            <DialogTitle>
              {actionType === 'flag' ? 'Flag Alert' :
               actionType === 'resolve' ? 'Resolve Alert' :
               'Dismiss Alert'}
            </DialogTitle>
            <DialogContent>
              <Typography variant="body1" paragraph>
                {actionType === 'flag' ?
                  `Are you sure you want to flag the alert "${getAlertTypeName(selectedAlert.type)}" for further review?` :
                 actionType === 'resolve' ?
                  `Are you sure you want to mark the alert "${getAlertTypeName(selectedAlert.type)}" as resolved?` :
                  `Are you sure you want to dismiss the alert "${getAlertTypeName(selectedAlert.type)}"? This action cannot be undone.`}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {actionType === 'flag' ?
                  'Flagged alerts will be prioritized for review.' :
                 actionType === 'resolve' ?
                  'Resolved alerts will be moved to the resolved tab.' :
                  'Dismissed alerts will be hidden from the main view.'}
              </Typography>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button onClick={handleCloseActionDialog} variant="outlined" sx={{ borderRadius: 2 }}>
                Cancel
              </Button>
              <Button
                onClick={handlePerformAction}
                variant="contained"
                color={
                  actionType === 'flag' ? 'warning' :
                  actionType === 'resolve' ? 'success' :
                  'primary'
                }
                sx={{ borderRadius: 2 }}
              >
                Confirm
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
};

export default SecurityAlerts;
