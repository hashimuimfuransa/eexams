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
  Alert
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Block as BlockIcon,
  CheckCircle as CheckCircleIcon,
  Email as EmailIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { getAllStudents } from '../../../services/adminService';

const StudentList = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });

  // Fetch students from API
  const fetchStudents = async () => {
    setLoading(true);
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
      setLoading(false);
    }
  };

  // Load students on component mount
  useEffect(() => {
    fetchStudents();
  }, []);

  // Handle menu open
  const handleMenuOpen = (event, studentId) => {
    setAnchorEl(event.currentTarget);
    setSelectedStudentId(studentId);
  };

  // Handle menu close
  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedStudentId(null);
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

  // Filter students based on search term
  const filteredStudents = students.filter(student =>
    `${student.firstName} ${student.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (student.class && student.class.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (student.organization && student.organization.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Handle snackbar close
  const handleSnackbarClose = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  // Handle refresh
  const handleRefresh = () => {
    fetchStudents();
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
            Student Management
          </Typography>
          <Typography
            variant="subtitle1"
            color="text.secondary"
            sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}
          >
            Add, edit, and manage your students
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
            startIcon={<AddIcon />}
            onClick={() => navigate('/admin/students/import')}
            sx={{
              borderRadius: 3,
              width: { xs: '100%', sm: 'auto' }
            }}
          >
            Import Students
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/admin/students/add')}
            sx={{
              borderRadius: 3,
              px: { xs: 2, md: 3 },
              py: { xs: 1, md: 1.2 },
              width: { xs: '100%', sm: 'auto' },
              boxShadow: `0 4px 14px ${alpha(theme.palette.primary.main, 0.3)}`
            }}
          >
            Add Student
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
          placeholder="Search students..."
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

      {/* Students table */}
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
                      <TableCell sx={{ fontWeight: 'bold' }}>Student</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Email</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Class</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Organization</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Last Login</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredStudents
                      .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                      .map((student) => (
                        <TableRow
                          key={student.id}
                          sx={{
                            '&:hover': {
                              backgroundColor: alpha(theme.palette.primary.main, 0.02)
                            }
                          }}
                        >
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              <Avatar
                                sx={{
                                  bgcolor: theme.palette.primary.main,
                                  width: 36,
                                  height: 36,
                                  mr: 2
                                }}
                              >
                                {student.firstName.charAt(0)}
                              </Avatar>
                              <Typography variant="body1" fontWeight="medium">
                                {student.firstName} {student.lastName}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell>{student.email}</TableCell>
                          <TableCell>{student.class || 'N/A'}</TableCell>
                          <TableCell>{student.organization || 'N/A'}</TableCell>
                          <TableCell>
                            <Chip
                              icon={student.isBlocked ? <BlockIcon /> : <CheckCircleIcon />}
                              label={student.isBlocked ? 'Blocked' : 'Active'}
                              color={student.isBlocked ? 'error' : 'success'}
                              size="small"
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell>{formatDate(student.lastLogin)}</TableCell>
                          <TableCell>
                            <Tooltip title="Email">
                              <IconButton size="small" sx={{ mr: 1 }}>
                                <EmailIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Edit">
                              <IconButton size="small" sx={{ mr: 1 }}>
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="More actions">
                              <IconButton
                                size="small"
                                onClick={(event) => handleMenuOpen(event, student.id)}
                              >
                                <MoreVertIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>

            {/* Mobile Card View */}
            <Box sx={{ display: { xs: 'block', md: 'none' }, p: 2 }}>
              {filteredStudents
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((student) => (
                  <Paper
                    key={student.id}
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
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Avatar
                          sx={{
                            bgcolor: theme.palette.primary.main,
                            width: 40,
                            height: 40,
                            mr: 2
                          }}
                        >
                          {student.firstName.charAt(0)}
                        </Avatar>
                        <Box>
                          <Typography variant="subtitle1" fontWeight="bold">
                            {student.firstName} {student.lastName}
                          </Typography>
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: '180px'
                            }}
                          >
                            {student.email}
                          </Typography>
                        </Box>
                      </Box>
                      <Chip
                        icon={student.isBlocked ? <BlockIcon /> : <CheckCircleIcon />}
                        label={student.isBlocked ? 'Blocked' : 'Active'}
                        color={student.isBlocked ? 'error' : 'success'}
                        size="small"
                        variant="outlined"
                      />
                    </Box>

                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2 }}>
                      <Box>
                        <Typography variant="caption" color="text.secondary" display="block">
                          Class
                        </Typography>
                        <Typography variant="body2" fontWeight="medium">
                          {student.class || 'N/A'}
                        </Typography>
                      </Box>

                      <Box>
                        <Typography variant="caption" color="text.secondary" display="block">
                          Organization
                        </Typography>
                        <Typography variant="body2" fontWeight="medium">
                          {student.organization || 'N/A'}
                        </Typography>
                      </Box>

                      <Box>
                        <Typography variant="caption" color="text.secondary" display="block">
                          Last Login
                        </Typography>
                        <Typography variant="body2" fontWeight="medium">
                          {formatDate(student.lastLogin)}
                        </Typography>
                      </Box>
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', pt: 1, borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
                      <Tooltip title="Email">
                        <IconButton size="small" sx={{ mr: 1 }}>
                          <EmailIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit">
                        <IconButton size="small" sx={{ mr: 1 }}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="More actions">
                        <IconButton
                          size="small"
                          onClick={(event) => handleMenuOpen(event, student.id)}
                        >
                          <MoreVertIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Paper>
                ))}
            </Box>
            <TablePagination
              rowsPerPageOptions={[5, 10, 25]}
              component="div"
              count={filteredStudents.length}
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
          sx: {
            borderRadius: 3,
            boxShadow: '0 8px 20px rgba(0, 0, 0, 0.1)',
            width: { xs: 200, sm: 220 },
            maxWidth: { xs: 'calc(100% - 32px)', sm: 'none' },
            left: { xs: '16px !important', sm: 'auto !important' },
            right: { xs: '16px !important', sm: 'auto !important' }
          }
        }}
      >
        <MenuItem onClick={handleMenuClose} sx={{ py: 1.5 }}>
          <BlockIcon fontSize="small" sx={{ mr: 1.5 }} />
          <Typography variant="body2">Toggle Block Status</Typography>
        </MenuItem>
        <MenuItem onClick={handleMenuClose} sx={{ py: 1.5 }}>
          <DeleteIcon fontSize="small" sx={{ mr: 1.5, color: theme.palette.error.main }} />
          <Typography variant="body2" color="error">Delete</Typography>
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default StudentList;
