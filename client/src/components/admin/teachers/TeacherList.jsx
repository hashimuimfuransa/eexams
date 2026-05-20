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
  Avatar,
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
  Grid,
  FormControl,
  InputLabel,
  Select
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Block as BlockIcon,
  CheckCircle as CheckCircleIcon,
  Email as EmailIcon,
  School as SchoolIcon
} from '@mui/icons-material';
import { useAuth } from '../../../context/AuthContext';
import { getAllTeachers, createTeacher, updateTeacher, deleteTeacher } from '../../../services/adminService';

const TeacherList = () => {
  const theme = useTheme();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  const [loading, setLoading] = useState(true);
  const [teachers, setTeachers] = useState([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedTeacherId, setSelectedTeacherId] = useState(null);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });

  // Dialog states
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState('create'); // 'create' or 'edit'
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    phone: '',
    class: '',
    subjects: '',
    classes: ''
  });
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [teacherToDelete, setTeacherToDelete] = useState(null);

  // Fetch teachers from API
  const fetchTeachers = async () => {
    setLoading(true);
    try {
      const data = await getAllTeachers();
      setTeachers(data);
    } catch (error) {
      console.error('Error fetching teachers:', error);
      setSnackbar({
        open: true,
        message: 'Failed to load teachers. Please try again.',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  // Load teachers on component mount
  useEffect(() => {
    fetchTeachers();
  }, []);

  // Handle menu open
  const handleMenuOpen = (event, teacherId) => {
    setAnchorEl(event.currentTarget);
    setSelectedTeacherId(teacherId);
  };

  // Handle menu close
  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedTeacherId(null);
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

  // Open create dialog
  const handleOpenCreateDialog = () => {
    setDialogMode('create');
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      phone: '',
      class: '',
      subjects: '',
      classes: ''
    });
    setOpenDialog(true);
  };

  // Open edit dialog
  const handleOpenEditDialog = () => {
    const teacher = teachers.find(t => t._id === selectedTeacherId);
    if (teacher) {
      setDialogMode('edit');
      setFormData({
        firstName: teacher.firstName || '',
        lastName: teacher.lastName || '',
        email: teacher.email || '',
        password: '', // Don't show password
        phone: teacher.phone || '',
        class: teacher.class || '',
        subjects: Array.isArray(teacher.subjects) ? teacher.subjects.join(', ') : '',
        classes: Array.isArray(teacher.classes) ? teacher.classes.join(', ') : ''
      });
      setOpenDialog(true);
    }
    handleMenuClose();
  };

  // Close dialog
  const handleCloseDialog = () => {
    setOpenDialog(false);
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      phone: '',
      class: '',
      subjects: '',
      classes: ''
    });
  };

  // Handle form input change
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle form submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Convert comma-separated strings to arrays
      const submitData = {
        ...formData,
        subjects: formData.subjects ? formData.subjects.split(',').map(s => s.trim()).filter(s => s) : [],
        classes: formData.classes ? formData.classes.split(',').map(c => c.trim()).filter(c => c) : []
      };
      
      if (dialogMode === 'create') {
        await createTeacher(submitData);
        setSnackbar({
          open: true,
          message: 'Teacher created successfully!',
          severity: 'success'
        });
      } else {
        await updateTeacher(selectedTeacherId, submitData);
        setSnackbar({
          open: true,
          message: 'Teacher updated successfully!',
          severity: 'success'
        });
      }
      handleCloseDialog();
      fetchTeachers();
    } catch (error) {
      console.error('Error saving teacher:', error);
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Failed to save teacher. Please try again.',
        severity: 'error'
      });
    }
  };

  // Handle delete confirmation
  const handleOpenDeleteConfirm = () => {
    const teacher = teachers.find(t => t._id === selectedTeacherId);
    if (teacher) {
      setTeacherToDelete(teacher);
      setDeleteConfirmOpen(true);
    }
    handleMenuClose();
  };

  // Handle delete
  const handleDelete = async () => {
    try {
      await deleteTeacher(selectedTeacherId);
      setSnackbar({
        open: true,
        message: 'Teacher deleted successfully!',
        severity: 'success'
      });
      setDeleteConfirmOpen(false);
      fetchTeachers();
    } catch (error) {
      console.error('Error deleting teacher:', error);
      setSnackbar({
        open: true,
        message: 'Failed to delete teacher. Please try again.',
        severity: 'error'
      });
    }
  };

  // Handle toggle block status
  const handleToggleBlock = async () => {
    try {
      const teacher = teachers.find(t => t._id === selectedTeacherId);
      if (teacher) {
        await updateTeacher(selectedTeacherId, { isBlocked: !teacher.isBlocked });
        setSnackbar({
          open: true,
          message: teacher.isBlocked ? 'Teacher unblocked successfully!' : 'Teacher blocked successfully!',
          severity: 'success'
        });
        fetchTeachers();
      }
    } catch (error) {
      console.error('Error toggling block status:', error);
      setSnackbar({
        open: true,
        message: 'Failed to update teacher status. Please try again.',
        severity: 'error'
      });
    }
    handleMenuClose();
  };

  // Filter teachers based on search term
  const filteredTeachers = teachers.filter(teacher => {
    const searchLower = searchTerm.toLowerCase();
    return (
      (teacher.firstName?.toLowerCase() || '').includes(searchLower) ||
      (teacher.lastName?.toLowerCase() || '').includes(searchLower) ||
      (teacher.email?.toLowerCase() || '').includes(searchLower) ||
      (teacher.class?.toLowerCase() || '').includes(searchLower)
    );
  });

  // Paginate teachers
  const paginatedTeachers = filteredTeachers.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  // Get initials for avatar
  const getInitials = (firstName, lastName) => {
    return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase();
  };

  if (!isAdmin) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">
          Only organization administrators can manage teachers.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
            Teachers
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage instructors and teachers for your organization
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleOpenCreateDialog}
          sx={{
            borderRadius: 2,
            px: 3,
            py: 1,
            background: 'linear-gradient(135deg, #0D406C 0%, #0CBD73 100%)',
            textTransform: 'none',
            fontWeight: 600
          }}
        >
          Add Teacher
        </Button>
      </Box>

      {/* Search */}
      <Paper sx={{ p: 2, mb: 2, borderRadius: 2 }}>
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Search teachers by name, email, or class..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: 'text.secondary' }} />
              </InputAdornment>
            ),
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 2,
              backgroundColor: alpha(theme.palette.primary.main, 0.02),
            }
          }}
        />
      </Paper>

      {/* Teachers Table */}
      <Paper sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: alpha(theme.palette.primary.main, 0.05) }}>
                <TableCell sx={{ fontWeight: 600 }}>Teacher</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Email</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Class/Subject</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Phone</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Joined</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : paginatedTeachers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      {searchTerm ? 'No teachers found matching your search.' : 'No teachers yet. Add your first teacher to get started.'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedTeachers.map((teacher) => (
                  <TableRow
                    key={teacher._id}
                    hover
                    sx={{
                      '&:last-child td, &:last-child th': { border: 0 },
                      opacity: teacher.isBlocked ? 0.6 : 1
                    }}
                  >
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar
                          sx={{
                            bgcolor: teacher.isBlocked ? 'grey.400' : 'primary.main',
                            width: 40,
                            height: 40
                          }}
                        >
                          {getInitials(teacher.firstName, teacher.lastName)}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {teacher.firstName} {teacher.lastName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Teacher
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <EmailIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                        <Typography variant="body2">{teacher.email}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        {teacher.subjects && teacher.subjects.length > 0 && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                            <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>Subjects:</Typography>
                            {teacher.subjects.map((subject, idx) => (
                              <Chip key={`subject-${idx}`} label={subject} size="small" sx={{ fontSize: 11, height: 20 }} />
                            ))}
                          </Box>
                        )}
                        {teacher.classes && teacher.classes.length > 0 && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                            <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>Classes:</Typography>
                            {teacher.classes.map((cls, idx) => (
                              <Chip key={`class-${idx}`} label={cls} size="small" sx={{ fontSize: 11, height: 20 }} />
                            ))}
                          </Box>
                        )}
                        {(!teacher.subjects || teacher.subjects.length === 0) && (!teacher.classes || teacher.classes.length === 0) && (
                          <Typography variant="body2" sx={{ color: 'text.secondary' }}>{teacher.class || '-'}</Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{teacher.phone || '-'}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={teacher.isBlocked ? 'Blocked' : 'Active'}
                        color={teacher.isBlocked ? 'error' : 'success'}
                        sx={{ fontWeight: 500 }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {new Date(teacher.createdAt).toLocaleDateString()}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="More actions">
                        <IconButton
                          size="small"
                          onClick={(e) => handleMenuOpen(e, teacher._id)}
                        >
                          <MoreVertIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          component="div"
          count={filteredTeachers.length}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[5, 10, 25, 50]}
        />
      </Paper>

      {/* Action Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        PaperProps={{
          sx: { borderRadius: 2, minWidth: 150 }
        }}
      >
        <MenuItem onClick={handleOpenEditDialog}>
          <EditIcon sx={{ mr: 1.5, fontSize: 18 }} />
          Edit
        </MenuItem>
        <MenuItem onClick={handleToggleBlock}>
          {teachers.find(t => t._id === selectedTeacherId)?.isBlocked ? (
            <>
              <CheckCircleIcon sx={{ mr: 1.5, fontSize: 18, color: 'success.main' }} />
              Unblock
            </>
          ) : (
            <>
              <BlockIcon sx={{ mr: 1.5, fontSize: 18, color: 'warning.main' }} />
              Block
            </>
          )}
        </MenuItem>
        <MenuItem onClick={handleOpenDeleteConfirm} sx={{ color: 'error.main' }}>
          <DeleteIcon sx={{ mr: 1.5, fontSize: 18 }} />
          Delete
        </MenuItem>
      </Menu>

      {/* Create/Edit Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>
          {dialogMode === 'create' ? 'Add New Teacher' : 'Edit Teacher'}
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  name="firstName"
                  label="First Name"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  fullWidth
                  required
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  name="lastName"
                  label="Last Name"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  fullWidth
                  required
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  name="email"
                  label="Email Address"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  fullWidth
                  required
                  disabled={dialogMode === 'edit'}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />
              </Grid>
              {dialogMode === 'create' && (
                <Grid item xs={12}>
                  <TextField
                    name="password"
                    label="Password"
                    type="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    fullWidth
                    required
                    helperText="Must be at least 6 characters"
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                  />
                </Grid>
              )}
              <Grid item xs={12} sm={6}>
                <TextField
                  name="phone"
                  label="Phone Number"
                  value={formData.phone}
                  onChange={handleInputChange}
                  fullWidth
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  name="class"
                  label="Class/Subject"
                  value={formData.class}
                  onChange={handleInputChange}
                  fullWidth
                  placeholder="e.g., Science, Math, Grade 10"
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  name="subjects"
                  label="Subjects"
                  value={formData.subjects}
                  onChange={handleInputChange}
                  fullWidth
                  placeholder="e.g., Mathematics, Physics, Chemistry (comma-separated)"
                  helperText="Enter multiple subjects separated by commas"
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  name="classes"
                  label="Classes"
                  value={formData.classes}
                  onChange={handleInputChange}
                  fullWidth
                  placeholder="e.g., Grade 10, Grade 11, Grade 12 (comma-separated)"
                  helperText="Enter multiple classes separated by commas"
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={handleCloseDialog} sx={{ borderRadius: 2, textTransform: 'none' }}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              sx={{
                borderRadius: 2,
                textTransform: 'none',
                background: 'linear-gradient(135deg, #0D406C 0%, #0CBD73 100%)'
              }}
            >
              {dialogMode === 'create' ? 'Create Teacher' : 'Save Changes'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>Delete Teacher</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Are you sure you want to delete <strong>{teacherToDelete?.firstName} {teacherToDelete?.lastName}</strong>?
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteConfirmOpen(false)} sx={{ borderRadius: 2, textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            onClick={handleDelete}
            variant="contained"
            color="error"
            sx={{ borderRadius: 2, textTransform: 'none' }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          sx={{ borderRadius: 2 }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default TeacherList;
