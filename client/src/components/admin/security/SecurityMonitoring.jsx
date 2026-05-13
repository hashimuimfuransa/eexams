import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  TextField,
  CircularProgress,
  Snackbar,
  Alert,
  useTheme,
  alpha
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Visibility as VisibilityIcon,
  Warning as WarningIcon,
  Block as BlockIcon,
  DevicesOther as DevicesIcon,
  TabUnselected as TabIcon,
  Public as PublicIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { getSecurityAlerts, resolveSecurityAlert, ignoreSecurityAlert } from '../../../services/adminService';

const SecurityMonitoring = () => {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState([]);
  const [filteredAlerts, setFilteredAlerts] = useState([]);
  const [tabValue, setTabValue] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionType, setActionType] = useState('');
  const [notes, setNotes] = useState('');
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });

  // Fetch security alerts
  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const data = await getSecurityAlerts();
      setAlerts(data);
      filterAlerts(data, tabValue);
    } catch (error) {
      console.error('Error fetching security alerts:', error);
      setSnackbar({
        open: true,
        message: 'Failed to load security alerts',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  // Initial data fetch
  useEffect(() => {
    fetchAlerts();
  }, []);

  // Filter alerts based on tab
  const filterAlerts = (alertsData, tab) => {
    switch (tab) {
      case 0: // All
        setFilteredAlerts(alertsData);
        break;
      case 1: // Unresolved
        setFilteredAlerts(alertsData.filter(alert => alert.status === 'unresolved'));
        break;
      case 2: // Resolved
        setFilteredAlerts(alertsData.filter(alert => alert.status === 'resolved'));
        break;
      case 3: // Ignored
        setFilteredAlerts(alertsData.filter(alert => alert.status === 'ignored'));
        break;
      default:
        setFilteredAlerts(alertsData);
    }
    setPage(0);
  };

  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
    filterAlerts(alerts, newValue);
  };

  // Handle page change
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  // Handle rows per page change
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Open dialog for resolving or ignoring alert
  const handleOpenDialog = (alert, type) => {
    setSelectedAlert(alert);
    setActionType(type);
    setNotes('');
    setDialogOpen(true);
  };

  // Close dialog
  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedAlert(null);
    setActionType('');
    setNotes('');
  };

  // Handle alert action (resolve or ignore)
  const handleAlertAction = async () => {
    if (!selectedAlert) return;

    try {
      if (actionType === 'resolve') {
        await resolveSecurityAlert(selectedAlert._id, { notes });
        setSnackbar({
          open: true,
          message: 'Alert resolved successfully',
          severity: 'success'
        });
      } else if (actionType === 'ignore') {
        await ignoreSecurityAlert(selectedAlert._id, { notes });
        setSnackbar({
          open: true,
          message: 'Alert ignored successfully',
          severity: 'success'
        });
      }
      
      // Refresh alerts
      fetchAlerts();
      handleCloseDialog();
    } catch (error) {
      console.error(`Error ${actionType === 'resolve' ? 'resolving' : 'ignoring'} alert:`, error);
      setSnackbar({
        open: true,
        message: `Failed to ${actionType} alert`,
        severity: 'error'
      });
    }
  };

  // Get icon for alert type
  const getAlertTypeIcon = (type) => {
    switch (type) {
      case 'multiple_device':
        return <DevicesIcon />;
      case 'browser_switch':
        return <TabIcon />;
      case 'ip_change':
        return <PublicIcon />;
      case 'suspicious_activity':
        return <WarningIcon />;
      default:
        return <WarningIcon />;
    }
  };

  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Get status chip
  const getStatusChip = (status) => {
    switch (status) {
      case 'unresolved':
        return (
          <Chip
            label="Unresolved"
            color="error"
            size="small"
            icon={<WarningIcon />}
            sx={{ fontWeight: 500 }}
          />
        );
      case 'resolved':
        return (
          <Chip
            label="Resolved"
            color="success"
            size="small"
            icon={<CheckCircleIcon />}
            sx={{ fontWeight: 500 }}
          />
        );
      case 'ignored':
        return (
          <Chip
            label="Ignored"
            color="default"
            size="small"
            icon={<CancelIcon />}
            sx={{ fontWeight: 500 }}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Box>
      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* Action dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog}>
        <DialogTitle>
          {actionType === 'resolve' ? 'Resolve Alert' : 'Ignore Alert'}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {actionType === 'resolve'
              ? 'Add notes about how this security issue was resolved.'
              : 'Add notes about why this alert is being ignored.'}
          </DialogContentText>
          <TextField
            autoFocus
            margin="dense"
            label="Notes"
            type="text"
            fullWidth
            multiline
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            variant="outlined"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} color="primary">
            Cancel
          </Button>
          <Button onClick={handleAlertAction} color="primary" variant="contained">
            {actionType === 'resolve' ? 'Resolve' : 'Ignore'}
          </Button>
        </DialogActions>
      </Dialog>

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
            Security Monitoring
          </Typography>
          <Typography
            variant="subtitle1"
            color="text.secondary"
            sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}
          >
            Monitor and manage security alerts
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={fetchAlerts}
          sx={{ borderRadius: 2 }}
        >
          Refresh
        </Button>
      </Box>

      {/* Tabs */}
      <Paper sx={{ mb: 3, borderRadius: 3, overflow: 'hidden' }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
          variant="fullWidth"
        >
          <Tab label="All Alerts" />
          <Tab label="Unresolved" />
          <Tab label="Resolved" />
          <Tab label="Ignored" />
        </Tabs>
      </Paper>

      {/* Alerts table */}
      <Paper sx={{ borderRadius: 3, overflow: 'hidden', mb: 3 }}>
        <TableContainer>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : filteredAlerts.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="body1" color="text.secondary">
                No alerts found
              </Typography>
            </Box>
          ) : (
            <Table>
              <TableHead sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                <TableRow>
                  <TableCell>Type</TableCell>
                  <TableCell>Student</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Time</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredAlerts
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((alert) => (
                    <TableRow key={alert._id} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {getAlertTypeIcon(alert.type)}
                          <Typography variant="body2">
                            {alert.type.replace('_', ' ').replace(/(^\w{1})|(\s+\w{1})/g, letter => letter.toUpperCase())}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        {alert.student ? (
                          <Typography variant="body2">
                            {`${alert.student.firstName} ${alert.student.lastName}`}
                            <Typography variant="caption" display="block" color="text.secondary">
                              {alert.student.email}
                            </Typography>
                          </Typography>
                        ) : (
                          'Unknown Student'
                        )}
                      </TableCell>
                      <TableCell>{alert.description}</TableCell>
                      <TableCell>{formatDate(alert.timestamp)}</TableCell>
                      <TableCell>{getStatusChip(alert.status)}</TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                          {alert.status === 'unresolved' && (
                            <>
                              <IconButton
                                size="small"
                                color="success"
                                onClick={() => handleOpenDialog(alert, 'resolve')}
                                title="Resolve"
                              >
                                <CheckCircleIcon />
                              </IconButton>
                              <IconButton
                                size="small"
                                color="default"
                                onClick={() => handleOpenDialog(alert, 'ignore')}
                                title="Ignore"
                              >
                                <CancelIcon />
                              </IconButton>
                            </>
                          )}
                          <IconButton
                            size="small"
                            color="primary"
                            title="View Details"
                          >
                            <VisibilityIcon />
                          </IconButton>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={filteredAlerts.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>
    </Box>
  );
};

export default SecurityMonitoring;
