import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Tooltip,
  CircularProgress,
  useTheme,
  alpha,
  Snackbar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  Checkbox,
  ListItemText,
  Divider,
  Avatar,
  AvatarGroup
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
  Visibility as VisibilityIcon,
  Refresh as RefreshIcon,
  Schedule as ScheduleIcon,
  Group as GroupIcon,
  PersonAdd as PersonAddIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { getAllExams, toggleExamLock, getAllStudents, scheduleExam, deleteExam } from '../../../services/adminService';

const ExamList = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [exams, setExams] = useState([]);
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedExamId, setSelectedExamId] = useState(null);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });

  // Assign students dialog state
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [assigningStudents, setAssigningStudents] = useState(false);

  // Delete exam dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingExam, setDeletingExam] = useState(false);

  // Fetch exams from API
  const fetchExams = async () => {
    setLoading(true);
    try {
      const data = await getAllExams();
      setExams(data);
    } catch (error) {
      console.error('Error fetching exams:', error);
      setSnackbar({
        open: true,
        message: 'Failed to load exams. Please try again.',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch students from API
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

  // Load exams on component mount
  useEffect(() => {
    fetchExams();
    fetchStudents();
  }, []);

  // Open assign students dialog
  const handleOpenAssignDialog = (examId) => {
    const exam = exams.find(e => e._id === examId);
    if (exam) {
      setSelectedExamId(examId);
      setSelectedStudentIds(exam.assignedTo || []);
      setAssignDialogOpen(true);
    } else {
      console.error('Could not find exam with ID:', examId);
      setSnackbar({
        open: true,
        message: 'Could not find the selected exam. Please refresh the page and try again.',
        severity: 'error'
      });
    }
  };

  // Close assign students dialog
  const handleCloseAssignDialog = () => {
    setAssignDialogOpen(false);
    setSelectedStudentIds([]);
  };

  // Handle student selection change
  const handleStudentSelectionChange = (event) => {
    setSelectedStudentIds(event.target.value);
  };

  // Handle assign students
  const handleAssignStudents = async () => {
    setAssigningStudents(true);

    try {
      // Make sure we have a valid exam ID
      if (!selectedExamId) {
        throw new Error('No exam selected');
      }

      // Find the exam in our local state
      const exam = exams.find(e => e._id === selectedExamId);
      if (!exam) {
        console.warn('Exam not found in local state, proceeding with ID only');
      }

      // Prepare data for scheduling API
      const scheduleData = {
        examId: selectedExamId,
        studentIds: selectedStudentIds,
        date: new Date().toISOString(),  // Use current date as default
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + ((exam?.timeLimit || 60) * 60 * 1000)).toISOString(),
        sendNotification: false,
        allowLateSubmission: false
      };

      console.log('Sending assignment data:', scheduleData);

      // Validate student IDs
      if (!Array.isArray(selectedStudentIds)) {
        throw new Error('Selected student IDs must be an array');
      }

      if (selectedStudentIds.some(id => !id)) {
        throw new Error('One or more selected student IDs are invalid');
      }

      // Call API to schedule exam with assigned students
      const result = await scheduleExam(scheduleData);
      console.log('Assignment successful:', result);

      // Get the updated assignedTo array from the response
      const updatedAssignedTo = result.exam.assignedTo || [];

      // Update the exams list with the new assigned students
      setExams(prevExams =>
        prevExams.map(e =>
          e._id === selectedExamId ? { ...e, assignedTo: updatedAssignedTo } : e
        )
      );

      setSnackbar({
        open: true,
        message: 'Students assigned successfully',
        severity: 'success'
      });

      // Close the dialog
      handleCloseAssignDialog();
    } catch (error) {
      console.error('Error assigning students:', error);
      setSnackbar({
        open: true,
        message: error.message || 'Failed to assign students. Please try again.',
        severity: 'error'
      });
    } finally {
      setAssigningStudents(false);
    }
  };

  // Handle toggle exam lock
  const handleToggleLock = async (examId, currentLockStatus) => {
    try {
      await toggleExamLock(examId, !currentLockStatus);

      // Update the exams list with the new lock status
      setExams(prevExams =>
        prevExams.map(exam =>
          exam._id === examId ? { ...exam, isLocked: !currentLockStatus } : exam
        )
      );

      setSnackbar({
        open: true,
        message: `Exam ${currentLockStatus ? 'unlocked' : 'locked'} successfully`,
        severity: 'success'
      });
    } catch (error) {
      console.error('Error toggling exam lock:', error);
      setSnackbar({
        open: true,
        message: 'Failed to update exam status. Please try again.',
        severity: 'error'
      });
    }

    // Close the menu
    handleMenuClose();
  };

  // Handle menu open
  const handleMenuOpen = (event, examId) => {
    setAnchorEl(event.currentTarget);
    setSelectedExamId(examId);
  };

  // Handle menu close
  const handleMenuClose = () => {
    setAnchorEl(null);
    // Don't reset selectedExamId immediately to avoid issues with the menu
    setTimeout(() => {
      setSelectedExamId(null);
    }, 100);
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

  // Handle search
  const handleSearch = (event) => {
    setSearchTerm(event.target.value);
    setPage(0);
  };

  // Filter exams based on search term
  const filteredExams = exams.filter(exam =>
    exam.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    exam.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Handle snackbar close
  const handleSnackbarClose = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  // Handle delete exam dialog open
  const handleOpenDeleteDialog = (examId) => {
    if (!examId) {
      console.error('No exam ID provided to handleOpenDeleteDialog');
      setSnackbar({
        open: true,
        message: 'Error: No exam selected for deletion',
        severity: 'error'
      });
      return;
    }

    console.log('Setting selected exam ID for deletion:', examId);
    setSelectedExamId(examId);
    setDeleteDialogOpen(true);
  };

  // Handle delete exam dialog close
  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setSelectedExamId(null);
  };

  // Handle delete exam with ID parameter
  const handleDeleteExamWithId = async (examId) => {
    if (!examId) {
      console.error('No exam ID provided to handleDeleteExamWithId');
      setSnackbar({
        open: true,
        message: 'Error: No exam ID provided for deletion',
        severity: 'error'
      });
      return;
    }

    console.log(`Attempting to delete exam with ID: ${examId}`);
    setDeletingExam(true);

    try {
      // Call the delete API
      const result = await deleteExam(examId);
      console.log('Delete exam result:', result);

      // Update the exams list by removing the deleted exam
      setExams(prevExams => prevExams.filter(exam => exam._id !== examId));

      // Show success message
      setSnackbar({
        open: true,
        message: 'Exam deleted successfully',
        severity: 'success'
      });

      // Close the dialog
      handleCloseDeleteDialog();

      // Refresh the exam list to ensure it's up to date
      setTimeout(() => {
        fetchExams();
      }, 1000);
    } catch (error) {
      console.error('Error deleting exam:', error);
      setSnackbar({
        open: true,
        message: `Failed to delete exam: ${error.message || 'Unknown error'}`,
        severity: 'error'
      });
    } finally {
      setDeletingExam(false);
    }
  };

  // Handle delete exam (using selectedExamId from state)
  const handleDeleteExam = async () => {
    if (!selectedExamId) {
      console.error('No exam ID selected for deletion');
      setSnackbar({
        open: true,
        message: 'Error: No exam selected for deletion',
        severity: 'error'
      });
      return;
    }

    // Call the version that takes an explicit ID parameter
    await handleDeleteExamWithId(selectedExamId);
  };

  // Handle refresh
  const handleRefresh = () => {
    fetchExams();
  };

  return (
    <Box>
      {/* Snackbar for notifications */}
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
            Exam Management
          </Typography>
          <Typography
            variant="subtitle1"
            color="text.secondary"
            sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}
          >
            Create, edit, and manage your exams
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Tooltip title="Refresh">
            <IconButton
              onClick={handleRefresh}
              sx={{
                borderRadius: 2,
                border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                color: theme.palette.primary.main
              }}
            >
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant="outlined"
            startIcon={<ScheduleIcon />}
            onClick={() => navigate('/admin/exams/scheduled')}
            sx={{
              borderRadius: 3,
              px: { xs: 2, md: 3 },
              py: { xs: 1, md: 1.2 },
              alignSelf: { xs: 'stretch', sm: 'auto' }
            }}
          >
            Scheduled Exams
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/admin/exams/create')}
            sx={{
              borderRadius: 3,
              px: { xs: 2, md: 3 },
              py: { xs: 1, md: 1.2 },
              alignSelf: { xs: 'stretch', sm: 'auto' },
              boxShadow: `0 4px 14px ${alpha(theme.palette.primary.main, 0.3)}`
            }}
          >
            Create Exam
          </Button>
        </Box>
      </Box>

      {/* Search and filters */}
      <Paper
        elevation={0}
        sx={{
          p: { xs: 1.5, md: 2 },
          mb: { xs: 2, md: 3 },
          borderRadius: { xs: 3, md: 4 },
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`
        }}
      >
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Search exams..."
          value={searchTerm}
          onChange={handleSearch}
          size="small"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" />
              </InputAdornment>
            ),
            sx: {
              borderRadius: 3,
              fontSize: { xs: '0.875rem', md: '1rem' }
            }
          }}
        />
      </Paper>

      {/* Exams table */}
      <Paper
        elevation={0}
        sx={{
          borderRadius: { xs: 3, md: 4 },
          overflow: 'hidden',
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          display: { xs: 'block', md: 'block' },
          width: '100%',
          overflowX: 'auto'
        }}
      >
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {/* Desktop Table View */}
            <Box sx={{ display: { xs: 'none', md: 'block' } }}>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow sx={{ backgroundColor: alpha(theme.palette.primary.main, 0.05) }}>
                      <TableCell sx={{ fontWeight: 'bold' }}>Title</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Description</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Time Limit</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Created</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Students</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredExams
                      .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                      .map((exam) => (
                        <TableRow
                          key={exam._id}
                          sx={{
                            '&:hover': {
                              backgroundColor: alpha(theme.palette.primary.main, 0.02)
                            }
                          }}
                        >
                          <TableCell sx={{ fontWeight: 'medium' }}>{exam.title}</TableCell>
                          <TableCell>{exam.description}</TableCell>
                          <TableCell>{exam.timeLimit} min</TableCell>
                          <TableCell>
                            <Chip
                              icon={exam.isLocked ? <LockIcon /> : <LockOpenIcon />}
                              label={exam.isLocked ? 'Locked' : 'Unlocked'}
                              color={exam.isLocked ? 'error' : 'success'}
                              size="small"
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell>{formatDate(exam.createdAt)}</TableCell>
                          <TableCell>
                            {exam.assignedTo && exam.assignedTo.length > 0 ? (
                              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <AvatarGroup max={3} sx={{ mr: 1 }}>
                                  {exam.assignedTo.map(studentId => {
                                    const student = students.find(s => s._id === studentId);
                                    return (
                                      <Avatar
                                        key={studentId}
                                        sx={{ width: 24, height: 24, fontSize: '0.75rem' }}
                                      >
                                        {student ? student.firstName[0] + student.lastName[0] : '?'}
                                      </Avatar>
                                    );
                                  })}
                                </AvatarGroup>
                                <Typography variant="body2">
                                  {exam.assignedTo.length} {exam.assignedTo.length === 1 ? 'student' : 'students'}
                                </Typography>
                              </Box>
                            ) : (
                              <Typography variant="body2" color="text.secondary">
                                No students assigned
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                              <Tooltip title="View Exam">
                                <IconButton
                                  size="small"
                                  sx={{
                                    mr: 1,
                                    color: theme.palette.info.main,
                                    '&:hover': {
                                      backgroundColor: alpha(theme.palette.info.main, 0.1)
                                    }
                                  }}
                                  onClick={() => navigate(`/admin/exams/${exam._id}/view`)}
                                >
                                  <VisibilityIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Edit Exam">
                                <IconButton
                                  size="small"
                                  sx={{
                                    mr: 1,
                                    color: theme.palette.primary.main,
                                    '&:hover': {
                                      backgroundColor: alpha(theme.palette.primary.main, 0.1)
                                    }
                                  }}
                                  onClick={() => navigate(`/admin/exams/${exam._id}/edit`)}
                                >
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="More Actions">
                                <IconButton
                                  size="small"
                                  onClick={(event) => handleMenuOpen(event, exam._id)}
                                  sx={{
                                    color: theme.palette.text.secondary,
                                    '&:hover': {
                                      backgroundColor: alpha(theme.palette.text.secondary, 0.1)
                                    }
                                  }}
                                >
                                  <MoreVertIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>

            {/* Mobile Card View */}
            <Box sx={{ display: { xs: 'block', md: 'none' }, p: 2 }}>
              {filteredExams
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((exam) => (
                  <Paper
                    key={exam._id}
                    elevation={0}
                    sx={{
                      p: 2,
                      mb: 2,
                      borderRadius: 3,
                      border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                      '&:hover': {
                        boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.1)}`,
                      }
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                      <Typography variant="subtitle1" fontWeight="bold" sx={{ mr: 2 }}>
                        {exam.title}
                      </Typography>
                      <Chip
                        icon={exam.isLocked ? <LockIcon /> : <LockOpenIcon />}
                        label={exam.isLocked ? 'Locked' : 'Unlocked'}
                        color={exam.isLocked ? 'error' : 'success'}
                        size="small"
                        variant="outlined"
                      />
                    </Box>

                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {exam.description}
                    </Typography>

                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2 }}>
                      <Box>
                        <Typography variant="caption" color="text.secondary" display="block">
                          Time Limit
                        </Typography>
                        <Typography variant="body2" fontWeight="medium">
                          {exam.timeLimit} min
                        </Typography>
                      </Box>

                      <Box>
                        <Typography variant="caption" color="text.secondary" display="block">
                          Created
                        </Typography>
                        <Typography variant="body2" fontWeight="medium">
                          {formatDate(exam.createdAt)}
                        </Typography>
                      </Box>

                      <Box>
                        <Typography variant="caption" color="text.secondary" display="block">
                          Students
                        </Typography>
                        {exam.assignedTo && exam.assignedTo.length > 0 ? (
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <AvatarGroup max={2} sx={{ mr: 1 }}>
                              {exam.assignedTo.map(studentId => {
                                const student = students.find(s => s._id === studentId);
                                return (
                                  <Avatar
                                    key={studentId}
                                    sx={{ width: 20, height: 20, fontSize: '0.7rem' }}
                                  >
                                    {student ? student.firstName[0] + student.lastName[0] : '?'}
                                  </Avatar>
                                );
                              })}
                            </AvatarGroup>
                            <Typography variant="body2" fontWeight="medium">
                              {exam.assignedTo.length}
                            </Typography>
                          </Box>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            None
                          </Typography>
                        )}
                      </Box>
                    </Box>

                    <Box sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      pt: 1.5,
                      borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`
                    }}>
                      <Box>
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<VisibilityIcon />}
                          onClick={() => navigate(`/admin/exams/${exam._id}/view`)}
                          sx={{
                            mr: 1,
                            borderRadius: 2,
                            color: theme.palette.info.main,
                            borderColor: alpha(theme.palette.info.main, 0.5),
                            '&:hover': {
                              borderColor: theme.palette.info.main,
                              backgroundColor: alpha(theme.palette.info.main, 0.1)
                            }
                          }}
                        >
                          View
                        </Button>
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<EditIcon />}
                          onClick={() => navigate(`/admin/exams/${exam._id}/edit`)}
                          sx={{
                            borderRadius: 2,
                            color: theme.palette.primary.main,
                            borderColor: alpha(theme.palette.primary.main, 0.5),
                            '&:hover': {
                              borderColor: theme.palette.primary.main,
                              backgroundColor: alpha(theme.palette.primary.main, 0.1)
                            }
                          }}
                        >
                          Edit
                        </Button>
                      </Box>
                      <Tooltip title="More Actions">
                        <IconButton
                          size="small"
                          onClick={(event) => handleMenuOpen(event, exam._id)}
                          sx={{
                            color: theme.palette.text.secondary,
                            '&:hover': {
                              backgroundColor: alpha(theme.palette.text.secondary, 0.1)
                            }
                          }}
                        >
                          <MoreVertIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Paper>
                ))}
            </Box>
            <TablePagination
              rowsPerPageOptions={[5, 10, 25]}
              component="div"
              count={filteredExams.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              sx={{
                '.MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows': {
                  fontSize: { xs: '0.75rem', sm: '0.875rem' }
                },
                '.MuiTablePagination-select': {
                  fontSize: { xs: '0.75rem', sm: '0.875rem' }
                }
              }}
              labelRowsPerPage={
                <Typography
                  variant="body2"
                  sx={{
                    display: { xs: 'none', sm: 'block' },
                    fontSize: { xs: '0.75rem', sm: '0.875rem' }
                  }}
                >
                  Rows per page:
                </Typography>
              }
            />
          </>
        )}
      </Paper>

      {/* Actions menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        PaperProps={{
          elevation: 3,
          sx: {
            overflow: 'visible',
            mt: 1.5,
            borderRadius: 3,
            boxShadow: '0 8px 20px rgba(0, 0, 0, 0.1)',
            width: { xs: 220, sm: 240 },
            maxWidth: { xs: 'calc(100% - 32px)', sm: 'none' },
            left: { xs: '16px !important', sm: 'auto !important' },
            right: { xs: '16px !important', sm: 'auto !important' },
            '&:before': {
              content: '""',
              display: 'block',
              position: 'absolute',
              top: 0,
              right: 14,
              width: 10,
              height: 10,
              bgcolor: 'background.paper',
              transform: 'translateY(-50%) rotate(45deg)',
              zIndex: 0,
            },
          }
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        {selectedExamId && (
          <>
            <Box sx={{ px: 2, py: 1.5 }}>
              <Typography variant="subtitle2" fontWeight="bold" color="text.primary">
                Exam Actions
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {exams.find(e => e._id === selectedExamId)?.title || 'Selected Exam'}
              </Typography>
            </Box>
            <Divider sx={{ my: 0.5 }} />
            <MenuItem
              onClick={() => navigate(`/admin/exams/${selectedExamId}/view`)}
              sx={{ py: 1.5 }}
            >
              <VisibilityIcon fontSize="small" sx={{ mr: 1.5, color: theme.palette.info.main }} />
              <Typography variant="body2">View Exam</Typography>
            </MenuItem>
            <MenuItem
              onClick={() => navigate(`/admin/exams/${selectedExamId}/edit`)}
              sx={{ py: 1.5 }}
            >
              <EditIcon fontSize="small" sx={{ mr: 1.5, color: theme.palette.primary.main }} />
              <Typography variant="body2">Edit Exam</Typography>
            </MenuItem>
            <Divider sx={{ my: 0.5 }} />
            <MenuItem
              onClick={() => {
                const exam = exams.find(e => e._id === selectedExamId);
                if (exam) {
                  handleToggleLock(selectedExamId, exam.isLocked);
                }
              }}
              sx={{ py: 1.5 }}
            >
              {exams.find(e => e._id === selectedExamId)?.isLocked ? (
                <LockOpenIcon fontSize="small" sx={{ mr: 1.5, color: theme.palette.success.main }} />
              ) : (
                <LockIcon fontSize="small" sx={{ mr: 1.5, color: theme.palette.warning.main }} />
              )}
              <Typography variant="body2">
                {exams.find(e => e._id === selectedExamId)?.isLocked ? 'Unlock Exam' : 'Lock Exam'}
              </Typography>
            </MenuItem>
            <MenuItem
              onClick={() => {
                handleMenuClose(); // Close menu first
                setTimeout(() => {
                  handleOpenAssignDialog(selectedExamId);
                }, 100);
              }}
              sx={{ py: 1.5 }}
            >
              <PersonAddIcon fontSize="small" sx={{ mr: 1.5, color: theme.palette.info.main }} />
              <Typography variant="body2">Assign Students</Typography>
            </MenuItem>
            <MenuItem
              onClick={() => navigate(`/admin/exams/schedule?examId=${selectedExamId}`)}
              sx={{ py: 1.5 }}
            >
              <ScheduleIcon fontSize="small" sx={{ mr: 1.5, color: theme.palette.primary.main }} />
              <Typography variant="body2">Schedule Exam</Typography>
            </MenuItem>
            <Divider sx={{ my: 0.5 }} />
            <MenuItem
              onClick={(event) => {
                // Store the exam ID in a variable to ensure it's captured
                const examIdToDelete = selectedExamId;
                console.log('Delete exam clicked for ID:', examIdToDelete);

                // Close the menu first to prevent the ID from being reset
                handleMenuClose();

                // Use setTimeout to ensure the menu close completes before opening the dialog
                setTimeout(() => {
                  console.log('Opening delete dialog for exam ID:', examIdToDelete);
                  handleOpenDeleteDialog(examIdToDelete);
                }, 100);
              }}
              sx={{ py: 1.5 }}
            >
              <DeleteIcon fontSize="small" sx={{ mr: 1.5, color: theme.palette.error.main }} />
              <Typography variant="body2" color="error">Delete Exam</Typography>
            </MenuItem>
          </>
        )}
      </Menu>

      {/* Delete Exam Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleCloseDeleteDialog}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            p: 1
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 'bold', color: theme.palette.error.main }}>
          Delete Exam
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Are you sure you want to delete this exam?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {exams.find(e => e._id === selectedExamId)?.title}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Exam ID: {selectedExamId}
          </Typography>
          <Typography variant="body2" color="error" sx={{ mt: 2, fontWeight: 'medium' }}>
            This action cannot be undone. All questions and student results associated with this exam will be permanently deleted.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={handleCloseDeleteDialog}
            variant="outlined"
            sx={{ borderRadius: 2 }}
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              // Store the exam ID in a local variable to ensure it's captured
              const examIdToDelete = selectedExamId;
              console.log('Delete button clicked, exam ID:', examIdToDelete);

              if (!examIdToDelete) {
                console.error('No exam ID available for deletion');
                setSnackbar({
                  open: true,
                  message: 'Error: No exam selected for deletion',
                  severity: 'error'
                });
                return;
              }

              // Call a modified version of handleDeleteExam that takes the ID directly
              handleDeleteExamWithId(examIdToDelete);
            }}
            variant="contained"
            color="error"
            disabled={deletingExam || !selectedExamId}
            startIcon={deletingExam ? <CircularProgress size={20} color="inherit" /> : <DeleteIcon />}
            sx={{
              borderRadius: 2,
              ml: 1,
              fontWeight: 'bold',
              px: 3,
              py: 1,
              boxShadow: '0 4px 10px rgba(211, 47, 47, 0.3)'
            }}
          >
            {deletingExam ? 'Deleting...' : 'Delete Exam'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Assign Students Dialog */}
      <Dialog
        open={assignDialogOpen}
        onClose={handleCloseAssignDialog}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            p: 1
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 'bold' }}>
          Assign Students to Exam
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Select students who will be able to take this exam
          </Typography>

          {loadingStudents ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}>
              <CircularProgress size={30} />
            </Box>
          ) : (
            <FormControl fullWidth sx={{ mt: 1 }}>
              <InputLabel id="assign-students-label">Select Students</InputLabel>
              <Select
                labelId="assign-students-label"
                multiple
                value={selectedStudentIds}
                onChange={handleStudentSelectionChange}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.length > 3 ? (
                      <Chip
                        label={`${selected.length} students selected`}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                    ) : (
                      selected.map((value) => {
                        const student = students.find(s => s._id === value);
                        return (
                          <Chip
                            key={value}
                            label={student ? `${student.firstName} ${student.lastName}` : 'Unknown'}
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                        );
                      })
                    )}
                  </Box>
                )}
                sx={{ minHeight: 100 }}
              >
                {students.map((student) => (
                  <MenuItem key={student._id} value={student._id}>
                    <Checkbox checked={selectedStudentIds.indexOf(student._id) > -1} />
                    <ListItemText
                      primary={`${student.firstName} ${student.lastName}`}
                      secondary={student.email}
                    />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={handleCloseAssignDialog}
            variant="outlined"
            sx={{ borderRadius: 2 }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAssignStudents}
            variant="contained"
            disabled={assigningStudents || loadingStudents}
            startIcon={assigningStudents ? <CircularProgress size={20} color="inherit" /> : <PersonAddIcon />}
            sx={{
              borderRadius: 2,
              boxShadow: `0 4px 14px ${alpha(theme.palette.primary.main, 0.3)}`
            }}
          >
            {assigningStudents ? 'Assigning...' : 'Assign Students'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ExamList;
