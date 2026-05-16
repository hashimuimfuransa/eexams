import { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  Button,
  Card,
  CardContent,
  CardActions,
  TextField,
  Grid,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Tooltip,
  CircularProgress,
  Alert,
  Fab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Snackbar
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Search,
  Sort,
  FilterList,
  Email,
  Person
} from '@mui/icons-material';
import { Checkbox } from '@mui/material';
import api from '../../services/api';

const StudentManagement = () => {
  const [studentLists, setStudentLists] = useState([]);
  const [myStudents, setMyStudents] = useState([]);
  const [selectedList, setSelectedList] = useState(null);
  const [students, setStudents] = useState([]);
  const [orgStudents, setOrgStudents] = useState([]); // All students in organization
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name-asc');
  const [filterStatus, setFilterStatus] = useState('all');
  const [classFilter, setClassFilter] = useState('all');
  
  // Dialog states
  const [createListDialog, setCreateListDialog] = useState(false);
  const [addStudentDialog, setAddStudentDialog] = useState(false);
  const [editStudentDialog, setEditStudentDialog] = useState(false);
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState(false);
  const [importDialog, setImportDialog] = useState(false);
  
  // Form states
  const [listName, setListName] = useState('');
  const [listDescription, setListDescription] = useState('');
  const [studentName, setStudentName] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [editingStudent, setEditingStudent] = useState(null);
  const [deletingStudent, setDeletingStudent] = useState(null);
  const [selectedStudentsToImport, setSelectedStudentsToImport] = useState([]);
  const [snack, setSnack] = useState('');
  const [sharedExams, setSharedExams] = useState([]);
  const [loadingSharedExams, setLoadingSharedExams] = useState(false);

  useEffect(() => {
    fetchStudentLists();
    fetchMyStudents();
    fetchSharedExams();
    fetchOrgStudents();
  }, []);

  const fetchSharedExams = async () => {
    try {
      setLoadingSharedExams(true);
      const res = await api.get('/share/all');
      setSharedExams(res.data.sharedExams || []);
    } catch (err) {
      console.error('Error fetching shared exams:', err);
      setError('Failed to load shared exams');
    } finally {
      setLoadingSharedExams(false);
    }
  };

  const fetchStudentLists = async () => {
    try {
      setLoading(true);
      const res = await api.get('/student-lists');
      setStudentLists(res.data.lists || []);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching student lists:', err);
      setError('Failed to load student lists');
      setLoading(false);
    }
  };

  const fetchMyStudents = async () => {
    try {
      const res = await api.get('/student-lists/my-students');
      setMyStudents(res.data.students || []);
    } catch (err) {
      console.error('Error fetching my students:', err);
    }
  };

  const fetchOrgStudents = async () => {
    try {
      const params = {};
      if (classFilter !== 'all') {
        params.class = classFilter;
      }
      if (sortBy) {
        params.sortBy = sortBy;
      }
      const res = await api.get('/admin/students', { params });
      setOrgStudents(res.data || []);
    } catch (err) {
      console.error('Error fetching organization students:', err);
    }
  };

  const handleSelectList = (list) => {
    setSelectedList(list);
    setStudents(list.students || []);
    setSortBy(list.sortOrder || 'name-asc');
  };

  const handleCreateList = async () => {
    try {
      const res = await api.post('/student-lists', {
        name: listName,
        description: listDescription,
        students: [],
        sortOrder: 'custom'
      });
      setCreateListDialog(false);
      setListName('');
      setListDescription('');
      fetchStudentLists();
    } catch (err) {
      console.error('Error creating list:', err);
      setError('Failed to create student list');
    }
  };

  const handleAddStudent = async () => {
    try {
      await api.post(`/student-lists/${selectedList._id}/students`, {
        name: studentName,
        email: studentEmail
      });
      setAddStudentDialog(false);
      setStudentName('');
      setStudentEmail('');
      fetchStudentLists();
      // Refresh selected list
      if (selectedList) {
        const updatedList = studentLists.find(l => l._id === selectedList._id);
        if (updatedList) handleSelectList(updatedList);
      }
    } catch (err) {
      console.error('Error adding student:', err);
      setError('Failed to add student');
    }
  };

  const handleEditStudent = async () => {
    try {
      const updatedStudents = students.map(s => 
        s.email === editingStudent.email 
          ? { ...s, name: studentName, email: studentEmail }
          : s
      );
      
      await api.put(`/student-lists/${selectedList._id}`, {
        students: updatedStudents
      });
      setEditStudentDialog(false);
      setStudentName('');
      setStudentEmail('');
      setEditingStudent(null);
      fetchStudentLists();
      if (selectedList) {
        const updatedList = studentLists.find(l => l._id === selectedList._id);
        if (updatedList) handleSelectList(updatedList);
      }
    } catch (err) {
      console.error('Error editing student:', err);
      setError('Failed to update student');
    }
  };

  const handleDeleteStudent = async () => {
    try {
      await api.delete(`/student-lists/${selectedList._id}/students/${deletingStudent.email}`);
      setDeleteConfirmDialog(false);
      setDeletingStudent(null);
      fetchStudentLists();
      if (selectedList) {
        const updatedList = studentLists.find(l => l._id === selectedList._id);
        if (updatedList) handleSelectList(updatedList);
      }
    } catch (err) {
      console.error('Error deleting student:', err);
      setError('Failed to delete student');
    }
  };

  const handleDeleteMyStudent = async (studentId) => {
    try {
      await api.delete(`/student-lists/my-students/${studentId}`);
      fetchMyStudents();
      setError(null);
    } catch (err) {
      console.error('Error deleting my student:', err);
      setError('Failed to delete student');
    }
  };

  const handleDeleteAllMyStudents = async () => {
    if (!window.confirm('Are you sure you want to delete all students created by you? This action cannot be undone.')) {
      return;
    }
    try {
      const res = await api.delete('/student-lists/my-students');
      fetchMyStudents();
      setError(null);
      setSnack(`${res.data.deletedCount} students deleted successfully`);
      setTimeout(() => setSnack(''), 3000);
    } catch (err) {
      console.error('Error deleting all students:', err);
      setError('Failed to delete all students');
    }
  };

  const handleRemoveSharedStudent = async (shareToken, studentId) => {
    try {
      await api.delete(`/share/${shareToken}/students/${studentId}`);
      setSnack('Student removed successfully');
      fetchSharedExams();
    } catch (err) {
      console.error('Error removing student:', err);
      setSnack(err.response?.data?.message || 'Failed to remove student');
    }
  };

  const handleSort = async (newSortOrder) => {
    try {
      setSortBy(newSortOrder);
      await api.put(`/student-lists/${selectedList._id}/sort`, {
        sortOrder: newSortOrder
      });
      fetchStudentLists();
      if (selectedList) {
        const updatedList = studentLists.find(l => l._id === selectedList._id);
        if (updatedList) handleSelectList(updatedList);
      }
    } catch (err) {
      console.error('Error sorting list:', err);
      setError('Failed to sort list');
    }
  };

  const handleDeleteList = async (listId) => {
    try {
      await api.delete(`/student-lists/${listId}`);
      if (selectedList && selectedList._id === listId) {
        setSelectedList(null);
        setStudents([]);
      }
      fetchStudentLists();
    } catch (err) {
      console.error('Error deleting list:', err);
      setError('Failed to delete student list');
    }
  };

  const handleImportStudents = async () => {
    if (!selectedList) {
      setError('Please select a student list first');
      return;
    }

    try {
      for (const studentId of selectedStudentsToImport) {
        const student = myStudents.find(s => s._id === studentId);
        if (student) {
          await api.post(`/student-lists/${selectedList._id}/students`, {
            name: `${student.firstName} ${student.lastName}`,
            email: student.email
          });
        }
      }
      setImportDialog(false);
      setSelectedStudentsToImport([]);
      fetchStudentLists();
      fetchMyStudents();
      if (selectedList) {
        const updatedList = studentLists.find(l => l._id === selectedList._id);
        if (updatedList) handleSelectList(updatedList);
      }
    } catch (err) {
      console.error('Error importing students:', err);
      setError('Failed to import students');
    }
  };

  const toggleStudentSelection = (studentId) => {
    setSelectedStudentsToImport(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  // Filter and sort students
  const filteredStudents = students
    .filter(student => {
      if (!searchTerm) return true;
      const searchLower = searchTerm.toLowerCase();
      return (
        student.name.toLowerCase().includes(searchLower) ||
        student.email.toLowerCase().includes(searchLower)
      );
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name-asc':
          return a.name.localeCompare(b.name);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        case 'email-asc':
          return a.email.localeCompare(b.email);
        case 'email-desc':
          return b.email.localeCompare(a.email);
        default:
          return 0;
      }
    });

  // Filter and sort org students
  const filteredOrgStudents = orgStudents
    .filter(student => {
      if (!searchTerm) return true;
      const searchLower = searchTerm.toLowerCase();
      return (
        `${student.firstName} ${student.lastName}`.toLowerCase().includes(searchLower) ||
        student.email.toLowerCase().includes(searchLower)
      );
    });

  // Get unique classes from org students
  const uniqueClasses = [...new Set(orgStudents.map(s => s.class).filter(Boolean))].sort();

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, textAlign: 'center' }}>
        <CircularProgress size={60} />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Loading student lists...
        </Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 8 }}>
      <Typography variant="h4" component="h1" fontWeight="bold" gutterBottom>
        Student Management
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Manage your student lists and students.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Snackbar
        open={!!snack}
        autoHideDuration={3000}
        onClose={() => setSnack('')}
        message={snack}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      />

      <Grid container spacing={3}>
        {/* Student Lists Panel */}
        <Grid item xs={12} md={4}>
          <Paper elevation={2} sx={{ p: 2, height: '100%' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" fontWeight="bold">
                Student Lists
              </Typography>
              <Tooltip title="Create New List">
                <IconButton
                  onClick={() => setCreateListDialog(true)}
                  color="primary"
                >
                  <Add />
                </IconButton>
              </Tooltip>
            </Box>

            {/* Organization Students Tab */}
            <Box sx={{ mb: 2, pb: 2, borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>
                All Organization Students ({orgStudents.length})
              </Typography>
              <FormControl size="small" fullWidth sx={{ mb: 1 }}>
                <InputLabel>Filter by Class</InputLabel>
                <Select
                  value={classFilter}
                  onChange={(e) => {
                    setClassFilter(e.target.value);
                    fetchOrgStudents();
                  }}
                  label="Filter by Class"
                >
                  <MenuItem value="all">All Classes</MenuItem>
                  {uniqueClasses.map(cls => (
                    <MenuItem key={cls} value={cls}>{cls}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            <Box sx={{ maxHeight: 600, overflow: 'auto' }}>
              {studentLists.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                  No student lists yet. Create one to get started.
                </Typography>
              ) : (
                studentLists.map((list) => (
                  <Card
                    key={list._id}
                    elevation={1}
                    sx={{
                      mb: 2,
                      cursor: 'pointer',
                      border: selectedList?._id === list._id ? 2 : 0,
                      borderColor: 'primary.main'
                    }}
                    onClick={() => handleSelectList(list)}
                  >
                    <CardContent sx={{ pb: 1 }}>
                      <Typography variant="subtitle2" fontWeight="bold">
                        {list.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {list.students?.length || 0} students
                      </Typography>
                      {list.description && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          {list.description}
                        </Typography>
                      )}
                    </CardContent>
                    <CardActions sx={{ pt: 0 }}>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteList(list._id);
                        }}
                        color="error"
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </CardActions>
                  </Card>
                ))
              )}

              {/* Show students created during exam publishing */}
              {myStudents.length > 0 && (
                <Box sx={{ mt: 3, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Typography variant="subtitle2" fontWeight="bold">
                      Students Created During Exam Publishing ({myStudents.length})
                    </Typography>
                    <Button
                      size="small"
                      variant="outlined"
                      color="error"
                      onClick={handleDeleteAllMyStudents}
                      sx={{ borderRadius: 2, textTransform: 'none', fontSize: 12 }}
                    >
                      Delete All
                    </Button>
                  </Box>
                  {myStudents.slice(0, 5).map((student) => (
                    <Box
                      key={student._id}
                      sx={{
                        py: 1,
                        px: 1,
                        mb: 1,
                        bgcolor: 'action.hover',
                        borderRadius: 1,
                        fontSize: '0.875rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <Box>
                        <Typography variant="body2" noWrap>
                          {student.firstName} {student.lastName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap>
                          {student.email}
                        </Typography>
                      </Box>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDeleteMyStudent(student._id)}
                        title="Delete student"
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </Box>
                  ))}
                  {myStudents.length > 5 && (
                    <Typography variant="caption" color="text.secondary">
                      +{myStudents.length - 5} more students
                    </Typography>
                  )}
                  <Button
                    size="small"
                    variant="outlined"
                    fullWidth
                    sx={{ mt: 2 }}
                    onClick={() => setImportDialog(true)}
                  >
                    Import to Student List
                  </Button>
                </Box>
              )}
            </Box>
          </Paper>
        </Grid>

        {/* Organization Students Panel */}
        <Grid item xs={12}>
          <Paper elevation={2} sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" fontWeight="bold">
                All Students in Organization ({filteredOrgStudents.length})
              </Typography>
              <Button
                size="small"
                variant="outlined"
                onClick={fetchOrgStudents}
              >
                Refresh
              </Button>
            </Box>

            {/* Filters */}
            <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
              <TextField
                size="small"
                placeholder="Search students..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />
                }}
                sx={{ flexGrow: 1, minWidth: 200 }}
              />
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Sort By</InputLabel>
                <Select
                  value={sortBy}
                  onChange={(e) => {
                    setSortBy(e.target.value);
                    fetchOrgStudents();
                  }}
                  label="Sort By"
                >
                  <MenuItem value="name-asc">Name (A-Z)</MenuItem>
                  <MenuItem value="name-desc">Name (Z-A)</MenuItem>
                  <MenuItem value="class-asc">Class (A-Z)</MenuItem>
                  <MenuItem value="class-desc">Class (Z-A)</MenuItem>
                  <MenuItem value="email-asc">Email (A-Z)</MenuItem>
                  <MenuItem value="email-desc">Email (Z-A)</MenuItem>
                </Select>
              </FormControl>
            </Box>

            {/* Organization Students Table */}
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Class</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredOrgStudents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} align="center">
                        <Typography variant="body2" color="text.secondary">
                          No students found
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredOrgStudents.map((student) => (
                      <TableRow key={student._id}>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Person fontSize="small" color="action" />
                            {student.firstName} {student.lastName}
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Email fontSize="small" color="action" />
                            {student.email}
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={student.class || 'No Class'}
                            size="small"
                            color={student.class ? 'primary' : 'default'}
                            variant={student.class ? 'outlined' : 'filled'}
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        {/* Historical Shared Exams Panel */}
        <Grid item xs={12}>
          <Paper elevation={2} sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" fontWeight="bold">
                Historical Shared Exams (Including Deleted Exams)
              </Typography>
              <Button
                size="small"
                variant="outlined"
                onClick={fetchSharedExams}
                disabled={loadingSharedExams}
              >
                {loadingSharedExams ? <CircularProgress size={16} /> : 'Refresh'}
              </Button>
            </Box>
            {sharedExams.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                No shared exams found.
              </Typography>
            ) : (
              <Box sx={{ maxHeight: 500, overflowY: 'auto' }}>
                {sharedExams.map((sharedExam) => (
                  <Card key={sharedExam._id} sx={{ mb: 2 }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                        <Typography variant="subtitle1" fontWeight="bold">
                          {sharedExam.examTitle}
                        </Typography>
                        {sharedExam.isExamDeleted && (
                          <Chip
                            label="Exam Deleted"
                            size="small"
                            color="error"
                            sx={{ ml: 1 }}
                          />
                        )}
                      </Box>
                      <Typography variant="caption" color="text.secondary" sx={{ mb: 2 }}>
                        Created: {new Date(sharedExam.createdAt).toLocaleString()}
                        {sharedExam.isExamDeleted && sharedExam.examDeletedAt && (
                          <> • Deleted: {new Date(sharedExam.examDeletedAt).toLocaleString()}</>
                        )}
                      </Typography>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        Students who joined: {sharedExam.studentsCount}
                      </Typography>
                      {sharedExam.students.length > 0 && (
                        <Box sx={{ mt: 2 }}>
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell sx={{ fontWeight: 700, fontSize: 11 }}>Name</TableCell>
                                <TableCell sx={{ fontWeight: 700, fontSize: 11 }}>Email</TableCell>
                                <TableCell sx={{ fontWeight: 700, fontSize: 11 }}>Status</TableCell>
                                <TableCell sx={{ fontWeight: 700, fontSize: 11 }}>Actions</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {sharedExam.students.map((student) => (
                                <TableRow key={student._id}>
                                  <TableCell sx={{ fontSize: 12 }}>{student.name}</TableCell>
                                  <TableCell sx={{ fontSize: 12 }}>{student.email}</TableCell>
                                  <TableCell>
                                    <Chip
                                      label={student.hasCompleted ? 'Completed' : 'In Progress'}
                                      size="small"
                                      color={student.hasCompleted ? 'success' : 'default'}
                                      sx={{ fontWeight: 600, textTransform: 'capitalize', fontSize: 11 }}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Tooltip title="Remove student">
                                      <IconButton
                                        size="small"
                                        onClick={() => handleRemoveSharedStudent(sharedExam.shareToken, student._id)}
                                        sx={{ color: '#EF4444' }}
                                      >
                                        <Delete fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Students Panel */}
      <Grid container spacing={3} sx={{ mt: 3 }}>
        <Grid item xs={12}>
          <Paper elevation={2} sx={{ p: 2 }}>
            {!selectedList ? (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <Person sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary">
                  Select a student list to view students
                </Typography>
              </Box>
            ) : (
              <>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 2 }}>
                  <Typography variant="h6" fontWeight="bold">
                    {selectedList.name}
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<Add />}
                    onClick={() => setAddStudentDialog(true)}
                    size="small"
                  >
                    Add Student
                  </Button>
                </Box>

                {/* Filters */}
                <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
                  <TextField
                    size="small"
                    placeholder="Search students..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    InputProps={{
                      startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />
                    }}
                    sx={{ flexGrow: 1, minWidth: 200 }}
                  />
                  <FormControl size="small" sx={{ minWidth: 150 }}>
                    <InputLabel>Sort By</InputLabel>
                    <Select
                      value={sortBy}
                      onChange={(e) => handleSort(e.target.value)}
                      label="Sort By"
                    >
                      <MenuItem value="name-asc">Name (A-Z)</MenuItem>
                      <MenuItem value="name-desc">Name (Z-A)</MenuItem>
                      <MenuItem value="email-asc">Email (A-Z)</MenuItem>
                      <MenuItem value="email-desc">Email (Z-A)</MenuItem>
                    </Select>
                  </FormControl>
                </Box>

                {/* Students Table */}
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Name</TableCell>
                        <TableCell>Email</TableCell>
                        <TableCell>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredStudents.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} align="center">
                            <Typography variant="body2" color="text.secondary">
                              No students found
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredStudents.map((student, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Person fontSize="small" color="action" />
                                {student.name}
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Email fontSize="small" color="action" />
                                {student.email}
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Tooltip title="Edit">
                                <IconButton
                                  size="small"
                                  onClick={() => {
                                    setEditingStudent(student);
                                    setStudentName(student.name);
                                    setStudentEmail(student.email);
                                    setEditStudentDialog(true);
                                  }}
                                >
                                  <Edit fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete">
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => {
                                    setDeletingStudent(student);
                                    setDeleteConfirmDialog(true);
                                  }}
                                >
                                  <Delete fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Create List Dialog */}
      <Dialog open={createListDialog} onClose={() => setCreateListDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Student List</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="List Name"
            fullWidth
            variant="outlined"
            value={listName}
            onChange={(e) => setListName(e.target.value)}
            sx={{ mt: 2 }}
          />
          <TextField
            margin="dense"
            label="Description (optional)"
            fullWidth
            multiline
            rows={3}
            variant="outlined"
            value={listDescription}
            onChange={(e) => setListDescription(e.target.value)}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateListDialog(false)}>Cancel</Button>
          <Button onClick={handleCreateList} variant="contained">Create</Button>
        </DialogActions>
      </Dialog>

      {/* Add Student Dialog */}
      <Dialog open={addStudentDialog} onClose={() => setAddStudentDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Student</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Student Name"
            fullWidth
            variant="outlined"
            value={studentName}
            onChange={(e) => setStudentName(e.target.value)}
            sx={{ mt: 2 }}
          />
          <TextField
            margin="dense"
            label="Student Email"
            fullWidth
            variant="outlined"
            value={studentEmail}
            onChange={(e) => setStudentEmail(e.target.value)}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddStudentDialog(false)}>Cancel</Button>
          <Button onClick={handleAddStudent} variant="contained">Add</Button>
        </DialogActions>
      </Dialog>

      {/* Edit Student Dialog */}
      <Dialog open={editStudentDialog} onClose={() => setEditStudentDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Student</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Student Name"
            fullWidth
            variant="outlined"
            value={studentName}
            onChange={(e) => setStudentName(e.target.value)}
            sx={{ mt: 2 }}
          />
          <TextField
            margin="dense"
            label="Student Email"
            fullWidth
            variant="outlined"
            value={studentEmail}
            onChange={(e) => setStudentEmail(e.target.value)}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditStudentDialog(false)}>Cancel</Button>
          <Button onClick={handleEditStudent} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmDialog} onClose={() => setDeleteConfirmDialog(false)}>
        <DialogTitle>Delete Student</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete {deletingStudent?.name} ({deletingStudent?.email})?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmDialog(false)}>Cancel</Button>
          <Button onClick={handleDeleteStudent} color="error" variant="contained">Delete</Button>
        </DialogActions>
      </Dialog>

      {/* Import Students Dialog */}
      <Dialog open={importDialog} onClose={() => setImportDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Import Students from Exam Publishing</DialogTitle>
        <DialogContent>
          {!selectedList ? (
            <Typography color="error" sx={{ py: 2 }}>
              Please select a student list first before importing students.
            </Typography>
          ) : (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Select students to import into "{selectedList.name}":
              </Typography>
              <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
                {myStudents.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                    No students found
                  </Typography>
                ) : (
                  myStudents.map((student) => (
                    <Box
                      key={student._id}
                      sx={{
                        p: 2,
                        mb: 1,
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        bgcolor: selectedStudentsToImport.includes(student._id) ? 'action.selected' : 'background.paper'
                      }}
                    >
                      <Box>
                        <Typography variant="body2" fontWeight="medium">
                          {student.firstName} {student.lastName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {student.email}
                        </Typography>
                      </Box>
                      <Checkbox
                        checked={selectedStudentsToImport.includes(student._id)}
                        onChange={() => toggleStudentSelection(student._id)}
                      />
                    </Box>
                  ))
                )}
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleImportStudents} 
            variant="contained"
            disabled={!selectedList || selectedStudentsToImport.length === 0}
          >
            Import {selectedStudentsToImport.length} Student{selectedStudentsToImport.length !== 1 ? 's' : ''}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default StudentManagement;
