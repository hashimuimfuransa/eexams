import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Grid,
  Divider,
  useTheme,
  alpha,
  Card,
  CardContent,
  Chip,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  ListItemSecondaryAction,
  IconButton,
  Badge,
  Tabs,
  Tab,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Alert
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Visibility as VisibilityIcon,
  Warning as WarningIcon,
  Block as BlockIcon,
  ScreenShare as ScreenShareIcon,
  Message as MessageIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

// Mock data for active exams
const activeExams = [
  {
    id: '1',
    title: 'Biology Midterm Exam',
    startTime: '10:00 AM',
    endTime: '11:30 AM',
    duration: '90 min',
    activeStudents: 42,
    totalStudents: 45,
    status: 'in-progress'
  },
  {
    id: '2',
    title: 'Chemistry Quiz 3',
    startTime: '09:30 AM',
    endTime: '10:15 AM',
    duration: '45 min',
    activeStudents: 30,
    totalStudents: 32,
    status: 'ending-soon'
  },
  {
    id: '3',
    title: 'Physics Problem Set',
    startTime: '11:00 AM',
    endTime: '12:30 PM',
    duration: '90 min',
    activeStudents: 0,
    totalStudents: 38,
    status: 'starting-soon'
  }
];

// Mock data for active students
const activeStudents = [
  {
    id: '1',
    name: 'John Doe',
    examId: '1',
    examTitle: 'Biology Midterm Exam',
    progress: 65,
    timeRemaining: '32 min',
    status: 'active',
    alerts: 0
  },
  {
    id: '2',
    name: 'Jane Smith',
    examId: '1',
    examTitle: 'Biology Midterm Exam',
    progress: 78,
    timeRemaining: '32 min',
    status: 'active',
    alerts: 0
  },
  {
    id: '3',
    name: 'Robert Johnson',
    examId: '1',
    examTitle: 'Biology Midterm Exam',
    progress: 45,
    timeRemaining: '32 min',
    status: 'idle',
    alerts: 1
  },
  {
    id: '4',
    name: 'Emily Williams',
    examId: '2',
    examTitle: 'Chemistry Quiz 3',
    progress: 90,
    timeRemaining: '5 min',
    status: 'active',
    alerts: 0
  },
  {
    id: '5',
    name: 'Michael Brown',
    examId: '2',
    examTitle: 'Chemistry Quiz 3',
    progress: 75,
    timeRemaining: '5 min',
    status: 'suspicious',
    alerts: 3
  }
];

// Mock data for security alerts
const securityAlerts = [
  {
    id: '1',
    studentId: '5',
    studentName: 'Michael Brown',
    examId: '2',
    examTitle: 'Chemistry Quiz 3',
    type: 'multiple-tabs',
    timestamp: '10:05 AM',
    severity: 'high',
    status: 'unresolved'
  },
  {
    id: '2',
    studentId: '3',
    studentName: 'Robert Johnson',
    examId: '1',
    examTitle: 'Biology Midterm Exam',
    type: 'idle-timeout',
    timestamp: '10:12 AM',
    severity: 'medium',
    status: 'unresolved'
  },
  {
    id: '3',
    studentId: '5',
    studentName: 'Michael Brown',
    examId: '2',
    examTitle: 'Chemistry Quiz 3',
    type: 'screen-sharing',
    timestamp: '10:08 AM',
    severity: 'high',
    status: 'unresolved'
  },
  {
    id: '4',
    studentId: '5',
    studentName: 'Michael Brown',
    examId: '2',
    examTitle: 'Chemistry Quiz 3',
    type: 'browser-resize',
    timestamp: '10:10 AM',
    severity: 'medium',
    status: 'unresolved'
  }
];

const LiveMonitoring = () => {
  const theme = useTheme();
  const navigate = useNavigate();

  // State for tab
  const [tabValue, setTabValue] = useState(0);

  // State for filters
  const [filters, setFilters] = useState({
    exam: 'all',
    status: 'all',
    search: ''
  });

  // State for refreshing data
  const [lastRefreshed, setLastRefreshed] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

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

  // Handle refresh
  const handleRefresh = () => {
    setIsRefreshing(true);

    // Simulate refresh delay
    setTimeout(() => {
      setLastRefreshed(new Date());
      setIsRefreshing(false);
    }, 1000);
  };

  // Filter students based on filters
  const filteredStudents = activeStudents.filter(student => {
    if (filters.exam !== 'all' && student.examId !== filters.exam) return false;
    if (filters.status !== 'all' && student.status !== filters.status) return false;
    if (filters.search && !student.name.toLowerCase().includes(filters.search.toLowerCase())) return false;
    return true;
  });

  // Filter alerts based on filters
  const filteredAlerts = securityAlerts.filter(alert => {
    if (filters.exam !== 'all' && alert.examId !== filters.exam) return false;
    if (filters.search && !alert.studentName.toLowerCase().includes(filters.search.toLowerCase())) return false;
    return true;
  });

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return theme.palette.success.main;
      case 'idle':
        return theme.palette.warning.main;
      case 'suspicious':
        return theme.palette.error.main;
      case 'in-progress':
        return theme.palette.success.main;
      case 'ending-soon':
        return theme.palette.warning.main;
      case 'starting-soon':
        return theme.palette.info.main;
      default:
        return theme.palette.text.secondary;
    }
  };

  // Get alert severity color
  const getAlertSeverityColor = (severity) => {
    switch (severity) {
      case 'high':
        return theme.palette.error.main;
      case 'medium':
        return theme.palette.warning.main;
      case 'low':
        return theme.palette.info.main;
      default:
        return theme.palette.text.secondary;
    }
  };

  // Format time
  const formatTime = (date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Auto refresh effect
  useEffect(() => {
    const interval = setInterval(() => {
      handleRefresh();
    }, 60000); // Refresh every minute

    return () => clearInterval(interval);
  }, []);

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
            Live Monitoring
          </Typography>
          <Typography
            variant="subtitle1"
            color="text.secondary"
            sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}
          >
            Monitor active exams and student activity in real-time
          </Typography>
        </Box>
        <Box sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          width: { xs: '100%', sm: 'auto' },
          gap: { xs: 1, sm: 2 }
        }}>
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
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleRefresh}
            disabled={isRefreshing}
            sx={{
              borderRadius: 3,
              width: { xs: '100%', sm: 'auto' }
            }}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {/* Last refreshed */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'flex-end' }}>
        <Typography variant="body2" color="text.secondary">
          Last refreshed: {formatTime(lastRefreshed)}
        </Typography>
      </Box>

      {/* Active exams */}
      <Typography variant="h6" fontWeight="medium" gutterBottom>
        Active Exams
      </Typography>
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {activeExams.map(exam => (
          <Grid item xs={12} md={4} key={exam.id}>
            <Card
              elevation={0}
              sx={{
                borderRadius: 3,
                border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                height: '100%'
              }}
            >
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Typography variant="h6" fontWeight="medium">
                    {exam.title}
                  </Typography>
                  <Chip
                    label={exam.status === 'in-progress' ? 'In Progress' :
                           exam.status === 'ending-soon' ? 'Ending Soon' : 'Starting Soon'}
                    size="small"
                    sx={{
                      bgcolor: alpha(getStatusColor(exam.status), 0.1),
                      color: getStatusColor(exam.status),
                      fontWeight: 500,
                      borderRadius: 1
                    }}
                  />
                </Box>

                <Grid container spacing={2} sx={{ mb: 2 }}>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Start Time
                    </Typography>
                    <Typography variant="body2" fontWeight="medium">
                      {exam.startTime}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      End Time
                    </Typography>
                    <Typography variant="body2" fontWeight="medium">
                      {exam.endTime}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Duration
                    </Typography>
                    <Typography variant="body2" fontWeight="medium">
                      {exam.duration}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Students
                    </Typography>
                    <Typography variant="body2" fontWeight="medium">
                      {exam.activeStudents} / {exam.totalStudents}
                    </Typography>
                  </Grid>
                </Grid>

                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<VisibilityIcon />}
                  fullWidth
                  sx={{ borderRadius: 2 }}
                >
                  Monitor Exam
                </Button>
              </CardContent>
            </Card>
          </Grid>
        ))}
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
            label="Active Students"
            icon={<Badge badgeContent={activeStudents.length} color="primary" sx={{ '& .MuiBadge-badge': { fontSize: '0.7rem' } }}>
              <PersonIcon />
            </Badge>}
            iconPosition="start"
          />
          <Tab
            label="Security Alerts"
            icon={<Badge badgeContent={securityAlerts.length} color="error" sx={{ '& .MuiBadge-badge': { fontSize: '0.7rem' } }}>
              <WarningIcon />
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
          <Grid item xs={12} md={5}>
            <TextField
              fullWidth
              placeholder="Search students..."
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

          <Grid item xs={12} sm={6} md={3.5}>
            <FormControl fullWidth size="small">
              <InputLabel id="exam-filter-label">Exam</InputLabel>
              <Select
                labelId="exam-filter-label"
                name="exam"
                value={filters.exam}
                onChange={handleFilterChange}
                label="Exam"
                sx={{ borderRadius: 3 }}
              >
                <MenuItem value="all">All Exams</MenuItem>
                {activeExams.map(exam => (
                  <MenuItem key={exam.id} value={exam.id}>{exam.title}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6} md={3.5}>
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
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="idle">Idle</MenuItem>
                <MenuItem value="suspicious">Suspicious</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      {/* Tab content */}
      {tabValue === 0 ? (
        <Paper
          elevation={0}
          sx={{
            borderRadius: { xs: 3, md: 4 },
            border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            overflow: 'hidden'
          }}
        >
          {filteredStudents.length > 0 ? (
            <List>
              {filteredStudents.map((student, index) => (
                <ListItem
                  key={student.id}
                  divider={index < filteredStudents.length - 1}
                  sx={{
                    py: 2,
                    backgroundColor: student.status === 'suspicious' ? alpha(theme.palette.error.main, 0.05) : 'inherit'
                  }}
                >
                  <ListItemAvatar>
                    <Avatar
                      sx={{
                        bgcolor: getStatusColor(student.status),
                        color: '#fff'
                      }}
                    >
                      {student.name.charAt(0)}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Typography variant="subtitle2">
                          {student.name}
                        </Typography>
                        {student.alerts > 0 && (
                          <Chip
                            label={`${student.alerts} Alert${student.alerts > 1 ? 's' : ''}`}
                            size="small"
                            color="error"
                            sx={{ ml: 1, height: 20, fontSize: '0.7rem' }}
                          />
                        )}
                      </Box>
                    }
                    secondary={
                      <Box sx={{ mt: 0.5 }}>
                        <Typography variant="body2" color="text.secondary" component="span">
                          {student.examTitle} • Progress: {student.progress}% • Time Remaining: {student.timeRemaining}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                          <Chip
                            label={student.status.charAt(0).toUpperCase() + student.status.slice(1)}
                            size="small"
                            sx={{
                              bgcolor: alpha(getStatusColor(student.status), 0.1),
                              color: getStatusColor(student.status),
                              fontWeight: 500,
                              borderRadius: 1,
                              height: 20,
                              fontSize: '0.7rem'
                            }}
                          />
                        </Box>
                      </Box>
                    }
                  />
                  <ListItemSecondaryAction>
                    <IconButton
                      edge="end"
                      aria-label="view"
                      sx={{ mr: 1, color: theme.palette.primary.main }}
                    >
                      <VisibilityIcon />
                    </IconButton>
                    <IconButton
                      edge="end"
                      aria-label="screen"
                      sx={{ mr: 1, color: theme.palette.primary.main }}
                    >
                      <ScreenShareIcon />
                    </IconButton>
                    <IconButton
                      edge="end"
                      aria-label="message"
                      sx={{ mr: 1, color: theme.palette.primary.main }}
                    >
                      <MessageIcon />
                    </IconButton>
                    <IconButton
                      edge="end"
                      aria-label="block"
                      sx={{ color: theme.palette.error.main }}
                    >
                      <BlockIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          ) : (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <PersonIcon sx={{ fontSize: 60, color: alpha(theme.palette.text.secondary, 0.2), mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                No Active Students Found
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {filters.search || filters.exam !== 'all' || filters.status !== 'all'
                  ? 'No students match your filter criteria.'
                  : 'There are no active students at the moment.'}
              </Typography>
            </Box>
          )}
        </Paper>
      ) : (
        <Paper
          elevation={0}
          sx={{
            borderRadius: { xs: 3, md: 4 },
            border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            overflow: 'hidden'
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
                    backgroundColor: alert.severity === 'high' ? alpha(theme.palette.error.main, 0.05) : 'inherit'
                  }}
                >
                  <ListItemAvatar>
                    <Avatar
                      sx={{
                        bgcolor: getAlertSeverityColor(alert.severity),
                        color: '#fff'
                      }}
                    >
                      <WarningIcon />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Typography variant="subtitle2">
                          {alert.type === 'multiple-tabs' ? 'Multiple Tabs Detected' :
                           alert.type === 'idle-timeout' ? 'Student Idle' :
                           alert.type === 'screen-sharing' ? 'Screen Sharing Detected' :
                           'Browser Resize Detected'}
                        </Typography>
                        <Chip
                          label={alert.severity.toUpperCase()}
                          size="small"
                          sx={{
                            ml: 1,
                            height: 20,
                            fontSize: '0.7rem',
                            bgcolor: alpha(getAlertSeverityColor(alert.severity), 0.1),
                            color: getAlertSeverityColor(alert.severity),
                            fontWeight: 500
                          }}
                        />
                      </Box>
                    }
                    secondary={
                      <Box sx={{ mt: 0.5 }}>
                        <Typography variant="body2" color="text.secondary" component="span">
                          {alert.studentName} • {alert.examTitle} • {alert.timestamp}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                          <Chip
                            label={alert.status.charAt(0).toUpperCase() + alert.status.slice(1)}
                            size="small"
                            sx={{
                              bgcolor: alpha(theme.palette.warning.main, 0.1),
                              color: theme.palette.warning.main,
                              fontWeight: 500,
                              borderRadius: 1,
                              height: 20,
                              fontSize: '0.7rem'
                            }}
                          />
                        </Box>
                      </Box>
                    }
                  />
                  <ListItemSecondaryAction>
                    <IconButton
                      edge="end"
                      aria-label="view"
                      sx={{ mr: 1, color: theme.palette.primary.main }}
                    >
                      <VisibilityIcon />
                    </IconButton>
                    <IconButton
                      edge="end"
                      aria-label="message"
                      sx={{ mr: 1, color: theme.palette.primary.main }}
                    >
                      <MessageIcon />
                    </IconButton>
                    <IconButton
                      edge="end"
                      aria-label="block"
                      sx={{ color: theme.palette.error.main }}
                    >
                      <BlockIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          ) : (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <WarningIcon sx={{ fontSize: 60, color: alpha(theme.palette.text.secondary, 0.2), mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                No Security Alerts Found
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {filters.search || filters.exam !== 'all'
                  ? 'No alerts match your filter criteria.'
                  : 'There are no security alerts at the moment.'}
              </Typography>
            </Box>
          )}
        </Paper>
      )}

      {/* Help info */}
      <Alert
        severity="info"
        sx={{
          mt: 3,
          borderRadius: 2,
          boxShadow: `0 4px 12px ${alpha(theme.palette.info.main, 0.2)}`
        }}
      >
        <Typography variant="subtitle2">Live Monitoring Features</Typography>
        <Typography variant="body2">
          You can monitor student activity in real-time, view their screens, send messages, and take action on suspicious behavior.
          The system automatically detects potential violations such as tab switching, screen sharing, and extended idle time.
        </Typography>
      </Alert>
    </Box>
  );
};

export default LiveMonitoring;
