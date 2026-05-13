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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  IconButton,
  Tooltip,
  Card,
  CardContent,
  InputAdornment
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  GetApp as DownloadIcon,
  Person as PersonIcon,
  Login as LoginIcon,
  Logout as LogoutIcon,
  Edit as EditIcon,
  Add as AddIcon,
  Settings as SettingsIcon,
  Assignment as AssignmentIcon,
  CalendarToday as CalendarIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';

// Mock data for activity logs
const activityLogsData = [
  {
    id: '1',
    user: 'Admin User',
    action: 'login',
    details: 'Logged in successfully',
    ip: '192.168.1.1',
    timestamp: '2023-10-15 09:30:15',
    userType: 'admin'
  },
  {
    id: '2',
    user: 'John Doe',
    action: 'exam-start',
    details: 'Started Biology Midterm Exam',
    ip: '192.168.1.45',
    timestamp: '2023-10-15 10:00:05',
    userType: 'student'
  },
  {
    id: '3',
    user: 'Admin User',
    action: 'student-add',
    details: 'Added new student: Emily Williams',
    ip: '192.168.1.1',
    timestamp: '2023-10-15 10:15:22',
    userType: 'admin'
  },
  {
    id: '4',
    user: 'Jane Smith',
    action: 'exam-submit',
    details: 'Submitted Chemistry Quiz 3',
    ip: '192.168.1.78',
    timestamp: '2023-10-15 10:15:45',
    userType: 'student'
  },
  {
    id: '5',
    user: 'Admin User',
    action: 'exam-create',
    details: 'Created new exam: Physics Problem Set',
    ip: '192.168.1.1',
    timestamp: '2023-10-15 11:05:33',
    userType: 'admin'
  },
  {
    id: '6',
    user: 'Robert Johnson',
    action: 'login',
    details: 'Logged in successfully',
    ip: '192.168.1.92',
    timestamp: '2023-10-15 11:10:18',
    userType: 'student'
  },
  {
    id: '7',
    user: 'Michael Brown',
    action: 'exam-start',
    details: 'Started Chemistry Quiz 3',
    ip: '192.168.1.105',
    timestamp: '2023-10-15 11:15:02',
    userType: 'student'
  },
  {
    id: '8',
    user: 'Admin User',
    action: 'settings-update',
    details: 'Updated system settings',
    ip: '192.168.1.1',
    timestamp: '2023-10-15 11:30:45',
    userType: 'admin'
  },
  {
    id: '9',
    user: 'Emily Williams',
    action: 'login',
    details: 'Logged in successfully',
    ip: '192.168.1.112',
    timestamp: '2023-10-15 12:05:10',
    userType: 'student'
  },
  {
    id: '10',
    user: 'Admin User',
    action: 'logout',
    details: 'Logged out',
    ip: '192.168.1.1',
    timestamp: '2023-10-15 12:30:00',
    userType: 'admin'
  }
];

const ActivityLogs = () => {
  const theme = useTheme();
  const navigate = useNavigate();

  // State for pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // State for filters
  const [filters, setFilters] = useState({
    search: '',
    userType: 'all',
    action: 'all',
    startDate: null,
    endDate: null
  });

  // Handle page change
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  // Handle rows per page change
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Handle filter change
  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilters({
      ...filters,
      [name]: value
    });
  };

  // Handle date change
  const handleDateChange = (name, date) => {
    setFilters({
      ...filters,
      [name]: date
    });
  };

  // Handle refresh
  const handleRefresh = () => {
    // In a real app, this would refresh the data from the server
    console.log('Refreshing data...');
  };

  // Handle export
  const handleExport = () => {
    // In a real app, this would export the data to CSV/Excel
    console.log('Exporting data...');
  };

  // Filter logs based on filters
  const filteredLogs = activityLogsData.filter(log => {
    // Filter by search
    if (filters.search &&
        !log.user.toLowerCase().includes(filters.search.toLowerCase()) &&
        !log.details.toLowerCase().includes(filters.search.toLowerCase()) &&
        !log.ip.includes(filters.search)) {
      return false;
    }

    // Filter by user type
    if (filters.userType !== 'all' && log.userType !== filters.userType) {
      return false;
    }

    // Filter by action
    if (filters.action !== 'all' && log.action !== filters.action) {
      return false;
    }

    // Filter by date range
    if (filters.startDate && new Date(log.timestamp) < filters.startDate) {
      return false;
    }

    if (filters.endDate) {
      const endDateWithTime = new Date(filters.endDate);
      endDateWithTime.setHours(23, 59, 59, 999);
      if (new Date(log.timestamp) > endDateWithTime) {
        return false;
      }
    }

    return true;
  });

  // Get action icon and color
  const getActionInfo = (action) => {
    switch (action) {
      case 'login':
        return { icon: <LoginIcon fontSize="small" />, color: theme.palette.success.main };
      case 'logout':
        return { icon: <LogoutIcon fontSize="small" />, color: theme.palette.info.main };
      case 'exam-start':
        return { icon: <AssignmentIcon fontSize="small" />, color: theme.palette.primary.main };
      case 'exam-submit':
        return { icon: <AssignmentIcon fontSize="small" />, color: theme.palette.success.main };
      case 'exam-create':
        return { icon: <AddIcon fontSize="small" />, color: theme.palette.primary.main };
      case 'student-add':
        return { icon: <PersonIcon fontSize="small" />, color: theme.palette.primary.main };
      case 'settings-update':
        return { icon: <SettingsIcon fontSize="small" />, color: theme.palette.warning.main };
      default:
        return { icon: <EditIcon fontSize="small" />, color: theme.palette.text.secondary };
    }
  };

  // Get action display name
  const getActionName = (action) => {
    switch (action) {
      case 'login':
        return 'Login';
      case 'logout':
        return 'Logout';
      case 'exam-start':
        return 'Exam Started';
      case 'exam-submit':
        return 'Exam Submitted';
      case 'exam-create':
        return 'Exam Created';
      case 'student-add':
        return 'Student Added';
      case 'settings-update':
        return 'Settings Updated';
      default:
        return action.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
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
            Activity Logs
          </Typography>
          <Typography
            variant="subtitle1"
            color="text.secondary"
            sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}
          >
            View detailed logs of all system activities
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
            onClick={() => navigate('/admin/security/monitoring')}
            sx={{
              borderRadius: 3,
              width: { xs: '100%', sm: 'auto' }
            }}
          >
            Back to Monitoring
          </Button>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleRefresh}
            sx={{
              borderRadius: 3,
              width: { xs: '100%', sm: 'auto' }
            }}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {/* Activity summary */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={6} sm={3}>
          <Card
            elevation={0}
            sx={{
              borderRadius: 3,
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
              height: '100%'
            }}
          >
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 36,
                    height: 36,
                    borderRadius: 2,
                    backgroundColor: alpha(theme.palette.primary.main, 0.1),
                    color: theme.palette.primary.main,
                    mr: 1.5
                  }}
                >
                  <PersonIcon fontSize="small" />
                </Box>
                <Typography variant="h6" fontWeight="bold">
                  {activityLogsData.filter(log => log.userType === 'admin').length}
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Admin Activities
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={6} sm={3}>
          <Card
            elevation={0}
            sx={{
              borderRadius: 3,
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
              height: '100%'
            }}
          >
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 36,
                    height: 36,
                    borderRadius: 2,
                    backgroundColor: alpha(theme.palette.info.main, 0.1),
                    color: theme.palette.info.main,
                    mr: 1.5
                  }}
                >
                  <PersonIcon fontSize="small" />
                </Box>
                <Typography variant="h6" fontWeight="bold">
                  {activityLogsData.filter(log => log.userType === 'student').length}
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Student Activities
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={6} sm={3}>
          <Card
            elevation={0}
            sx={{
              borderRadius: 3,
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
              height: '100%'
            }}
          >
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 36,
                    height: 36,
                    borderRadius: 2,
                    backgroundColor: alpha(theme.palette.success.main, 0.1),
                    color: theme.palette.success.main,
                    mr: 1.5
                  }}
                >
                  <LoginIcon fontSize="small" />
                </Box>
                <Typography variant="h6" fontWeight="bold">
                  {activityLogsData.filter(log => log.action === 'login').length}
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Login Events
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={6} sm={3}>
          <Card
            elevation={0}
            sx={{
              borderRadius: 3,
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
              height: '100%'
            }}
          >
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 36,
                    height: 36,
                    borderRadius: 2,
                    backgroundColor: alpha(theme.palette.primary.main, 0.1),
                    color: theme.palette.primary.main,
                    mr: 1.5
                  }}
                >
                  <AssignmentIcon fontSize="small" />
                </Box>
                <Typography variant="h6" fontWeight="bold">
                  {activityLogsData.filter(log => log.action.includes('exam')).length}
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Exam Activities
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

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
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              placeholder="Search logs..."
              name="search"
              value={filters.search}
              onChange={handleFilterChange}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" />
                  </InputAdornment>
                ),
                sx: { borderRadius: 3 }
              }}
              size="small"
            />
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel id="user-type-filter-label">User Type</InputLabel>
              <Select
                labelId="user-type-filter-label"
                name="userType"
                value={filters.userType}
                onChange={handleFilterChange}
                label="User Type"
                sx={{ borderRadius: 3 }}
              >
                <MenuItem value="all">All Users</MenuItem>
                <MenuItem value="admin">Admin</MenuItem>
                <MenuItem value="student">Student</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel id="action-filter-label">Action</InputLabel>
              <Select
                labelId="action-filter-label"
                name="action"
                value={filters.action}
                onChange={handleFilterChange}
                label="Action"
                sx={{ borderRadius: 3 }}
              >
                <MenuItem value="all">All Actions</MenuItem>
                <MenuItem value="login">Login</MenuItem>
                <MenuItem value="logout">Logout</MenuItem>
                <MenuItem value="exam-start">Exam Started</MenuItem>
                <MenuItem value="exam-submit">Exam Submitted</MenuItem>
                <MenuItem value="exam-create">Exam Created</MenuItem>
                <MenuItem value="student-add">Student Added</MenuItem>
                <MenuItem value="settings-update">Settings Updated</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DatePicker
                label="Start Date"
                value={filters.startDate}
                onChange={(date) => handleDateChange('startDate', date)}
                slotProps={{
                  textField: {
                    size: 'small',
                    fullWidth: true,
                    sx: { '& .MuiOutlinedInput-root': { borderRadius: 3 } }
                  }
                }}
              />
            </LocalizationProvider>
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DatePicker
                label="End Date"
                value={filters.endDate}
                onChange={(date) => handleDateChange('endDate', date)}
                slotProps={{
                  textField: {
                    size: 'small',
                    fullWidth: true,
                    sx: { '& .MuiOutlinedInput-root': { borderRadius: 3 } }
                  }
                }}
              />
            </LocalizationProvider>
          </Grid>

          <Grid item xs={12} md={1} sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Tooltip title="Export Logs">
              <IconButton onClick={handleExport}>
                <DownloadIcon />
              </IconButton>
            </Tooltip>
          </Grid>
        </Grid>
      </Paper>

      {/* Logs table */}
      <Paper
        elevation={0}
        sx={{
          borderRadius: { xs: 3, md: 4 },
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          overflow: 'hidden',
          mb: 3
        }}
      >
        <TableContainer>
          <Table>
            <TableHead sx={{ backgroundColor: alpha(theme.palette.primary.main, 0.05) }}>
              <TableRow>
                <TableCell>Timestamp</TableCell>
                <TableCell>User</TableCell>
                <TableCell>Action</TableCell>
                <TableCell>Details</TableCell>
                <TableCell>IP Address</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredLogs
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((log) => (
                <TableRow key={log.id} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <CalendarIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary', fontSize: '1rem' }} />
                      <Typography variant="body2">{log.timestamp}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Chip
                        label={log.userType.charAt(0).toUpperCase() + log.userType.slice(1)}
                        size="small"
                        sx={{
                          mr: 1,
                          bgcolor: log.userType === 'admin'
                            ? alpha(theme.palette.primary.main, 0.1)
                            : alpha(theme.palette.info.main, 0.1),
                          color: log.userType === 'admin'
                            ? theme.palette.primary.main
                            : theme.palette.info.main,
                          height: 20,
                          fontSize: '0.7rem'
                        }}
                      />
                      <Typography variant="body2">{log.user}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 24,
                          height: 24,
                          borderRadius: 1,
                          backgroundColor: alpha(getActionInfo(log.action).color, 0.1),
                          color: getActionInfo(log.action).color,
                          mr: 1
                        }}
                      >
                        {getActionInfo(log.action).icon}
                      </Box>
                      <Typography variant="body2">{getActionName(log.action)}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{log.details}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{log.ip}</Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={filteredLogs.length}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[10, 25, 50, 100]}
        />
      </Paper>

      {/* Export options */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3 }}>
        <Button
          variant="contained"
          startIcon={<DownloadIcon />}
          onClick={handleExport}
          sx={{
            borderRadius: 3,
            px: 3,
            py: 1.2,
            boxShadow: `0 4px 14px ${alpha(theme.palette.primary.main, 0.3)}`
          }}
        >
          Export Logs
        </Button>
      </Box>
    </Box>
  );
};

export default ActivityLogs;
