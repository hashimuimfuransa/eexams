import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  IconButton,
  Chip,
  Tooltip,
  Snackbar,
  Alert,
  CircularProgress,
  useTheme,
  alpha,
  TablePagination,
  Divider,
  Avatar,
  AvatarGroup
} from '@mui/material';
import {
  Edit as EditIcon,
  Visibility as VisibilityIcon,
  Refresh as RefreshIcon,
  ArrowBack as ArrowBackIcon,
  Schedule as ScheduleIcon,
  CalendarMonth as CalendarIcon,
  Group as GroupIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { getScheduledExams, getAllStudents } from '../../../services/adminService';
import { format } from 'date-fns';
import EmptyState from '../../common/EmptyState';

const ScheduledExams = () => {
  const theme = useTheme();
  const navigate = useNavigate();

  // State
  const [exams, setExams] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Snackbar state
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });

  // Fetch scheduled exams and students
  useEffect(() => {
    fetchScheduledExams();
    fetchStudents();
  }, []);

  // Fetch students
  const fetchStudents = async () => {
    setLoadingStudents(true);
    try {
      const data = await getAllStudents();
      setStudents(data);
    } catch (error) {
      console.error('Error fetching students:', error);
      setSnackbar({
        open: true,
        message: 'Failed to load students. Please try again.',
        severity: 'error'
      });
    } finally {
      setLoadingStudents(false);
    }
  };

  const fetchScheduledExams = async () => {
    setLoading(true);
    try {
      const data = await getScheduledExams();
      console.log('Scheduled exams:', data);

      // Process the exams to include student count from assignedTo array
      const processedExams = data.map(exam => {
        // Ensure assignedTo is always an array
        if (!exam.assignedTo) {
          exam.assignedTo = [];
        }

        return {
          ...exam,
          students: exam.assignedTo.length
        };
      });

      console.log('Processed exams with assignedTo:', processedExams);
      setExams(processedExams);
    } catch (error) {
      console.error('Error fetching scheduled exams:', error);
      setSnackbar({
        open: true,
        message: 'Failed to load scheduled exams. Please try again.',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
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

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'Not scheduled';
    try {
      return format(new Date(dateString), 'MMM d, yyyy');
    } catch (error) {
      return 'Invalid date';
    }
  };

  // Format time
  const formatTime = (dateString) => {
    if (!dateString) return '';
    try {
      return format(new Date(dateString), 'h:mm a');
    } catch (error) {
      return '';
    }
  };

  // Handle edit
  const handleEdit = (examId) => {
    navigate(`/admin/exams/scheduled/edit/${examId}`);
  };

  // Handle view
  const handleView = (examId) => {
    navigate(`/admin/exams/${examId}`);
  };

  // Handle refresh
  const handleRefresh = () => {
    fetchScheduledExams();
    fetchStudents();
  };

  // Handle snackbar close
  const handleSnackbarClose = () => {
    setSnackbar({ ...snackbar, open: false });
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
            Scheduled Exams
          </Typography>
          <Typography
            variant="subtitle1"
            color="text.secondary"
            sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}
          >
            View and manage all scheduled exams
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
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
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/admin/exams')}
            sx={{
              borderRadius: 3,
              width: { xs: '100%', sm: 'auto' }
            }}
          >
            Back to Exams
          </Button>
        </Box>
      </Box>

      {/* Exams table */}
      <Paper
        elevation={0}
        sx={{
          borderRadius: { xs: 3, md: 4 },
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          overflow: 'hidden'
        }}
      >
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : exams.length === 0 ? (
          <EmptyState
            icon={<ScheduleIcon sx={{ fontSize: 60 }} />}
            title="No Scheduled Exams"
            description="You haven't scheduled any exams yet."
            actionText="Schedule an Exam"
            onAction={() => navigate('/admin/exams/schedule')}
          />
        ) : (
          <>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Exam Title</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Time</TableCell>
                    <TableCell>Students</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {exams
                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                    .map((exam) => (
                      <TableRow key={exam._id}>
                        <TableCell>
                          <Typography variant="body1" fontWeight="medium">
                            {exam.title}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <CalendarIcon fontSize="small" color="action" />
                            {formatDate(exam.scheduledFor)}
                          </Box>
                        </TableCell>
                        <TableCell>
                          {formatTime(exam.startTime)} - {formatTime(exam.endTime)}
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <GroupIcon fontSize="small" color="action" />
                            {exam.assignedTo && exam.assignedTo.length > 0 ? (
                              <Tooltip
                                title={
                                  <Box>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                                      Assigned Students:
                                    </Typography>
                                    {exam.assignedTo.map(studentId => {
                                      const student = students.find(s => s._id === studentId);
                                      return student ? (
                                        <Typography key={studentId} variant="body2" sx={{ mb: 0.5 }}>
                                          {student.firstName} {student.lastName}
                                        </Typography>
                                      ) : null;
                                    })}
                                  </Box>
                                }
                              >
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                  <AvatarGroup max={3} sx={{ mr: 1 }}>
                                    {exam.assignedTo.map(studentId => {
                                      const student = students.find(s => s._id === studentId);
                                      return student ? (
                                        <Avatar
                                          key={studentId}
                                          sx={{ width: 24, height: 24, fontSize: '0.75rem' }}
                                        >
                                          {student.firstName[0]}{student.lastName[0]}
                                        </Avatar>
                                      ) : null;
                                    })}
                                  </AvatarGroup>
                                  <Typography variant="body2">
                                    {exam.assignedTo ? exam.assignedTo.length : 0} {exam.assignedTo && exam.assignedTo.length === 1 ? 'student' : 'students'}
                                  </Typography>
                                </Box>
                              </Tooltip>
                            ) : (
                              <Typography variant="body2" color="text.secondary">
                                No students assigned
                              </Typography>
                            )}
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={exam.status || 'Scheduled'}
                            color={
                              exam.status === 'completed' ? 'success' :
                              exam.status === 'active' ? 'primary' :
                              'default'
                            }
                            size="small"
                            sx={{ borderRadius: 1 }}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                            <Tooltip title="Edit Schedule">
                              <IconButton
                                size="small"
                                onClick={() => handleEdit(exam._id)}
                                sx={{
                                  backgroundColor: alpha(theme.palette.primary.main, 0.1),
                                  '&:hover': {
                                    backgroundColor: alpha(theme.palette.primary.main, 0.2),
                                  }
                                }}
                              >
                                <EditIcon fontSize="small" color="primary" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="View Exam">
                              <IconButton
                                size="small"
                                onClick={() => handleView(exam._id)}
                                sx={{
                                  backgroundColor: alpha(theme.palette.info.main, 0.1),
                                  '&:hover': {
                                    backgroundColor: alpha(theme.palette.info.main, 0.2),
                                  }
                                }}
                              >
                                <VisibilityIcon fontSize="small" color="info" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              rowsPerPageOptions={[5, 10, 25]}
              component="div"
              count={exams.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
            />
          </>
        )}
      </Paper>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
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

export default ScheduledExams;
