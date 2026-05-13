import React, { useState, useEffect } from 'react';
import {
  Container,
  Grid,
  Paper,
  Typography,
  Box,
  Button,
  TextField,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  IconButton,
  Chip,
  Tooltip,
  CircularProgress,
  Alert,
  Snackbar,
  InputAdornment,
  Grow,
  Zoom,
  Fade,
  useTheme,
  alpha,
  Avatar,
  Card,
  CardContent,
  Slide
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Search,
  Refresh,
  PersonAdd,
  CheckCircle,
  Error,
  Visibility,
  VisibilityOff,
  People,
  School,
  Email,
  Badge,
  FilterList,
  Download,
  Upload
} from '@mui/icons-material';
import api from '../../services/api';

const StudentManagement = () => {
  const theme = useTheme();
  const [students, setStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Student form
  const [openForm, setOpenForm] = useState(false);
  const [formMode, setFormMode] = useState('add'); // 'add' or 'edit'
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    fullName: '',
    email: '',
    studentId: ''
  });
  const [formErrors, setFormErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);

  // Delete confirmation
  const [openDeleteConfirm, setOpenDeleteConfirm] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState(null);

  // Snackbar
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });

  // Fetch students
  useEffect(() => {
    fetchStudents();
  }, []);

  // Filter students based on search term
  useEffect(() => {
    if (searchTerm) {
      const filtered = students.filter(
        student =>
          student.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          student.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
          student.studentId.toLowerCase().includes(searchTerm.toLowerCase()) ||
          student.username.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredStudents(filtered);
    } else {
      setFilteredStudents(students);
    }
    setPage(0);
  }, [searchTerm, students]);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await api.get('/admin/students');
      setStudents(res.data);
      setFilteredStudents(res.data);

      setLoading(false);
    } catch (err) {
      console.error('Error fetching students:', err);
      setError('Failed to load students. Please try again later.');
      setLoading(false);
    }
  };

  // Form handlers
  const handleOpenForm = (mode, student = null) => {
    setFormMode(mode);
    setSelectedStudent(student);

    if (mode === 'edit' && student) {
      setFormData({
        username: student.username,
        password: '',
        fullName: student.fullName,
        email: student.email,
        studentId: student.studentId
      });
    } else {
      setFormData({
        username: '',
        password: '',
        fullName: '',
        email: '',
        studentId: ''
      });
    }

    setFormErrors({});
    setOpenForm(true);
  };

  const handleCloseForm = () => {
    setOpenForm(false);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Clear error for this field
    if (formErrors[name]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const errors = {};

    if (!formData.username.trim()) {
      errors.username = 'Username is required';
    }

    if (formMode === 'add' && !formData.password.trim()) {
      errors.password = 'Password is required';
    }

    if (!formData.fullName.trim()) {
      errors.fullName = 'Full name is required';
    }

    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'Email is invalid';
    }

    if (!formData.studentId.trim()) {
      errors.studentId = 'Student ID is required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmitForm = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      if (formMode === 'add') {
        // Add new student
        const res = await api.post('/admin/students', formData);

        setStudents(prev => [...prev, res.data]);

        setSnackbar({
          open: true,
          message: 'Student added successfully',
          severity: 'success'
        });
      } else {
        // Edit existing student
        const dataToUpdate = { ...formData };
        if (!dataToUpdate.password) {
          delete dataToUpdate.password;
        }

        const res = await api.put(`/admin/students/${selectedStudent._id}`, dataToUpdate);

        setStudents(prev =>
          prev.map(student =>
            student._id === selectedStudent._id ? res.data : student
          )
        );

        setSnackbar({
          open: true,
          message: 'Student updated successfully',
          severity: 'success'
        });
      }

      handleCloseForm();
    } catch (err) {
      console.error('Error saving student:', err);

      setSnackbar({
        open: true,
        message: `Failed to ${formMode === 'add' ? 'add' : 'update'} student: ${err.response?.data?.message || 'Unknown error'}`,
        severity: 'error'
      });
    }
  };

  // Delete handlers
  const handleOpenDeleteConfirm = (student) => {
    setStudentToDelete(student);
    setOpenDeleteConfirm(true);
  };

  const handleCloseDeleteConfirm = () => {
    setOpenDeleteConfirm(false);
    setStudentToDelete(null);
  };

  const handleDeleteStudent = async () => {
    try {
      await api.delete(`/api/admin/students/${studentToDelete._id}`);

      setStudents(prev =>
        prev.filter(student => student._id !== studentToDelete._id)
      );

      setSnackbar({
        open: true,
        message: 'Student deleted successfully',
        severity: 'success'
      });

      handleCloseDeleteConfirm();
    } catch (err) {
      console.error('Error deleting student:', err);

      setSnackbar({
        open: true,
        message: `Failed to delete student: ${err.response?.data?.message || 'Unknown error'}`,
        severity: 'error'
      });

      handleCloseDeleteConfirm();
    }
  };

  // Pagination handlers
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Snackbar handler
  const handleCloseSnackbar = () => {
    setSnackbar(prev => ({
      ...prev,
      open: false
    }));
  };

  return (
    <Container maxWidth="lg" sx={{ mt: { xs: 3, sm: 4, md: 5 }, mb: { xs: 4, sm: 6, md: 8 }, px: { xs: 1, sm: 2, md: 3 } }}>
      <Grow in={true} timeout={800}>
        <Paper
          elevation={0}
          sx={{
            p: { xs: 4, sm: 5, md: 6 },
            mb: { xs: 3, sm: 4 },
            borderRadius: { xs: 4, md: 6 },
            background: `linear-gradient(135deg,
              ${theme.palette.primary.dark} 0%,
              ${theme.palette.primary.main} 50%,
              ${theme.palette.secondary.main} 100%)`,
            color: 'white',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: `0 25px 50px ${alpha(theme.palette.primary.main, 0.3)}`,
            transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
            '&:hover': {
              boxShadow: `0 30px 60px ${alpha(theme.palette.primary.main, 0.4)}`,
              transform: 'translateY(-4px)'
            }
          }}
        >
          {/* Enhanced decorative elements */}
          <Box
            sx={{
              position: 'absolute',
              top: -50,
              right: -50,
              width: { xs: '200px', sm: '250px', md: '300px' },
              height: { xs: '200px', sm: '250px', md: '300px' },
              background: 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)',
              borderRadius: '50%',
              animation: 'studentFloat 10s ease-in-out infinite',
              '@keyframes studentFloat': {
                '0%': { transform: 'translateY(0px) rotate(0deg)' },
                '50%': { transform: 'translateY(-20px) rotate(180deg)' },
                '100%': { transform: 'translateY(0px) rotate(360deg)' }
              }
            }}
          />

          {/* Student sparkles */}
          {[...Array(8)].map((_, i) => (
            <Box
              key={i}
              sx={{
                position: 'absolute',
                width: { xs: 3, sm: 4 },
                height: { xs: 3, sm: 4 },
                borderRadius: '50%',
                bgcolor: 'rgba(255,255,255,0.8)',
                top: `${15 + i * 10}%`,
                left: `${10 + i * 10}%`,
                animation: `studentSparkle 4s ease-in-out infinite ${i * 0.3}s`,
                '@keyframes studentSparkle': {
                  '0%, 100%': { opacity: 0, transform: 'scale(0) rotate(0deg)' },
                  '50%': { opacity: 1, transform: 'scale(1) rotate(180deg)' }
                }
              }}
            />
          ))}

          <Box sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: { xs: 'flex-start', sm: 'center' },
            flexDirection: { xs: 'column', sm: 'row' },
            gap: { xs: 3, sm: 2 },
            position: 'relative',
            zIndex: 1
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar
                sx={{
                  width: { xs: 60, sm: 70 },
                  height: { xs: 60, sm: 70 },
                  bgcolor: 'rgba(255,255,255,0.2)',
                  border: '3px solid rgba(255,255,255,0.3)',
                  animation: 'studentIconFloat 6s ease-in-out infinite',
                  '@keyframes studentIconFloat': {
                    '0%, 100%': { transform: 'translateY(0px) rotate(0deg)' },
                    '50%': { transform: 'translateY(-8px) rotate(10deg)' }
                  }
                }}
              >
                <People sx={{ fontSize: { xs: '2rem', sm: '2.5rem' }, color: 'white' }} />
              </Avatar>

              <Box>
                <Typography
                  variant="h3"
                  component="h1"
                  fontWeight="bold"
                  sx={{
                    fontSize: { xs: '2rem', sm: '2.5rem', md: '3rem' },
                    background: 'linear-gradient(135deg, #ffffff 0%, #f0f0f0 50%, #ffffff 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    mb: 1,
                    letterSpacing: '-0.02em',
                    position: 'relative',
                    '&::after': {
                      content: '""',
                      position: 'absolute',
                      bottom: -8,
                      left: 0,
                      width: '60%',
                      height: 4,
                      background: 'linear-gradient(90deg, rgba(255,255,255,0.8), rgba(255,255,255,0.3))',
                      borderRadius: 2
                    }
                  }}
                >
                  Student Management 👥
                </Typography>
                <Typography
                  variant="h6"
                  sx={{
                    color: 'rgba(255,255,255,0.9)',
                    fontSize: { xs: '1rem', sm: '1.2rem' },
                    fontWeight: 'medium'
                  }}
                >
                  Manage student accounts and information
                </Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'row', sm: 'row' } }}>
              <Button
                variant="contained"
                color="secondary"
                onClick={() => handleOpenForm('add')}
                startIcon={<PersonAdd />}
                sx={{
                  fontWeight: 'bold',
                  px: 3,
                  py: 1.5,
                  borderRadius: 3,
                  bgcolor: 'rgba(255,255,255,0.9)',
                  color: theme.palette.primary.main,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                  '&:hover': {
                    bgcolor: 'rgba(255,255,255,1)',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 6px 16px rgba(0,0,0,0.3)'
                  }
                }}
              >
                Add New Student
              </Button>
            </Box>
          </Box>
        </Paper>
      </Grow>

      <Fade in={true} timeout={1000}>
        <Paper
          elevation={8}
          sx={{
            mb: 4,
            p: { xs: 2, sm: 3 },
            borderRadius: 4,
            background: `linear-gradient(135deg,
              ${alpha(theme.palette.background.paper, 0.9)} 0%,
              ${alpha(theme.palette.background.paper, 1)} 100%)`,
            border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
            position: 'relative'
          }}
        >
          {/* Stats Summary */}
          <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Chip
              icon={<People />}
              label={`${filteredStudents.length} Students`}
              sx={{
                bgcolor: alpha(theme.palette.primary.main, 0.1),
                color: theme.palette.primary.main,
                fontWeight: 'bold',
                '& .MuiChip-icon': {
                  color: theme.palette.primary.main
                }
              }}
            />
            <Chip
              icon={<School />}
              label="Active Accounts"
              sx={{
                bgcolor: alpha(theme.palette.success.main, 0.1),
                color: theme.palette.success.main,
                fontWeight: 'bold',
                '& .MuiChip-icon': {
                  color: theme.palette.success.main
                }
              }}
            />
          </Box>

          <Grid container spacing={{ xs: 2, sm: 3 }} alignItems="center">
            <Grid item xs={12} md={8}>
              <TextField
                fullWidth
                variant="outlined"
                placeholder="Search by name, email, student ID, or username..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search sx={{ color: theme.palette.primary.main }} />
                    </InputAdornment>
                  ),
                  sx: {
                    borderRadius: 3,
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.15)}`
                    },
                    '&.Mui-focused': {
                      boxShadow: `0 6px 16px ${alpha(theme.palette.primary.main, 0.2)}`
                    }
                  }
                }}
                size="small"
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <Box sx={{ display: 'flex', justifyContent: { xs: 'flex-start', md: 'flex-end' }, gap: 1 }}>
                <Button
                  variant="outlined"
                  startIcon={<Refresh />}
                  onClick={fetchStudents}
                  sx={{
                    borderRadius: 2,
                    fontWeight: 'bold',
                    '&:hover': {
                      transform: 'scale(1.02)'
                    }
                  }}
                >
                  Refresh
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<FilterList />}
                  sx={{
                    borderRadius: 2,
                    fontWeight: 'bold',
                    '&:hover': {
                      transform: 'scale(1.02)'
                    }
                  }}
                >
                  Filter
                </Button>
              </Box>
            </Grid>
          </Grid>
        </Paper>
      </Fade>

      {/* Error Alert */}
      {error && (
        <Alert
          severity="error"
          sx={{ mb: 4 }}
          action={
            <Button color="inherit" size="small" onClick={fetchStudents}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {/* Enhanced Students Table */}
      <Zoom in={true} style={{ transitionDelay: '400ms' }}>
        <Paper
          elevation={8}
          sx={{
            borderRadius: 4,
            overflow: 'hidden',
            background: `linear-gradient(135deg,
              ${alpha(theme.palette.background.paper, 0.9)} 0%,
              ${alpha(theme.palette.background.paper, 1)} 100%)`,
            border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`
          }}
        >
          <TableContainer>
            <Table>
              <TableHead sx={{
                background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
                '& .MuiTableCell-head': {
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: '0.9rem',
                  py: 2
                }
              }}>
                <TableRow>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Badge sx={{ fontSize: '1rem' }} />
                      Student ID
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <People sx={{ fontSize: '1rem' }} />
                      Full Name
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <School sx={{ fontSize: '1rem' }} />
                      Username
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Email sx={{ fontSize: '1rem' }} />
                      Email
                    </Box>
                  </TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                        <CircularProgress
                          size={50}
                          sx={{ color: theme.palette.primary.main }}
                        />
                        <Typography variant="body1" color="text.secondary">
                          Loading students...
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                ) : filteredStudents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                        <Avatar
                          sx={{
                            width: 60,
                            height: 60,
                            bgcolor: alpha(theme.palette.primary.main, 0.1),
                            mb: 1
                          }}
                        >
                          <People sx={{ fontSize: '2rem', color: theme.palette.primary.main, opacity: 0.7 }} />
                        </Avatar>
                        <Typography variant="h6" color="text.secondary" fontWeight="bold">
                          {searchTerm ? 'No students match your search' : 'No students found'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {searchTerm ? 'Try adjusting your search criteria' : 'Add your first student to get started'}
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStudents
                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                    .map((student, index) => (
                      <TableRow
                        key={student._id}
                        sx={{
                          '&:nth-of-type(odd)': {
                            backgroundColor: alpha(theme.palette.grey[50], 0.5),
                          },
                          '&:hover': {
                            bgcolor: alpha(theme.palette.primary.main, 0.08),
                            transform: 'scale(1.01)',
                            boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.15)}`,
                            transition: 'all 0.3s ease'
                          }
                        }}
                      >
                        <TableCell>
                          <Chip
                            label={student.studentId}
                            sx={{
                              bgcolor: alpha(theme.palette.primary.main, 0.1),
                              color: theme.palette.primary.main,
                              fontWeight: 'bold',
                              fontSize: '0.8rem'
                            }}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Avatar
                              sx={{
                                width: 32,
                                height: 32,
                                bgcolor: theme.palette.primary.main,
                                mr: 2,
                                fontSize: '0.8rem'
                              }}
                            >
                              {student.fullName.charAt(0).toUpperCase()}
                            </Avatar>
                            <Typography variant="body2" fontWeight="medium">
                              {student.fullName}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight="medium">
                            {student.username}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight="medium">
                            {student.email}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Tooltip title="Edit Student" arrow>
                            <IconButton
                              color="primary"
                              onClick={() => handleOpenForm('edit', student)}
                              size="small"
                              sx={{
                                mr: 1,
                                bgcolor: alpha(theme.palette.primary.main, 0.1),
                                '&:hover': {
                                  bgcolor: alpha(theme.palette.primary.main, 0.2),
                                  transform: 'scale(1.1)'
                                }
                              }}
                            >
                              <Edit />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete Student" arrow>
                            <IconButton
                              color="error"
                              onClick={() => handleOpenDeleteConfirm(student)}
                              size="small"
                              sx={{
                                bgcolor: alpha(theme.palette.error.main, 0.1),
                                '&:hover': {
                                  bgcolor: alpha(theme.palette.error.main, 0.2),
                                  transform: 'scale(1.1)'
                                }
                              }}
                            >
                              <Delete />
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
            rowsPerPageOptions={[5, 10, 25]}
            component="div"
            count={filteredStudents.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </Paper>
      </Zoom>

      {/* Add/Edit Student Dialog */}
      <Dialog open={openForm} onClose={handleCloseForm} maxWidth="sm" fullWidth>
        <DialogTitle>
          {formMode === 'add' ? 'Add New Student' : 'Edit Student'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Full Name"
                name="fullName"
                value={formData.fullName}
                onChange={handleFormChange}
                error={!!formErrors.fullName}
                helperText={formErrors.fullName}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Student ID"
                name="studentId"
                value={formData.studentId}
                onChange={handleFormChange}
                error={!!formErrors.studentId}
                helperText={formErrors.studentId}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleFormChange}
                error={!!formErrors.email}
                helperText={formErrors.email}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Username"
                name="username"
                value={formData.username}
                onChange={handleFormChange}
                error={!!formErrors.username}
                helperText={formErrors.username}
                required
                disabled={formMode === 'edit'}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label={formMode === 'edit' ? 'New Password (leave blank to keep current)' : 'Password'}
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={handleFormChange}
                error={!!formErrors.password}
                helperText={formErrors.password}
                required={formMode === 'add'}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={handleCloseForm} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={handleSubmitForm}
            variant="contained"
            color="primary"
            startIcon={formMode === 'add' ? <Add /> : <Edit />}
          >
            {formMode === 'add' ? 'Add Student' : 'Update Student'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={openDeleteConfirm} onClose={handleCloseDeleteConfirm}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete the student <strong>{studentToDelete?.fullName}</strong>?
            This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={handleCloseDeleteConfirm} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={handleDeleteStudent}
            variant="contained"
            color="error"
            startIcon={<Delete />}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default StudentManagement;
