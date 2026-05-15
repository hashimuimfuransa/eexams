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
  TableRow
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
import api from '../../services/api';

const StudentManagement = () => {
  const [studentLists, setStudentLists] = useState([]);
  const [selectedList, setSelectedList] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name-asc');
  const [filterStatus, setFilterStatus] = useState('all');
  
  // Dialog states
  const [createListDialog, setCreateListDialog] = useState(false);
  const [addStudentDialog, setAddStudentDialog] = useState(false);
  const [editStudentDialog, setEditStudentDialog] = useState(false);
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState(false);
  
  // Form states
  const [listName, setListName] = useState('');
  const [listDescription, setListDescription] = useState('');
  const [studentName, setStudentName] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [editingStudent, setEditingStudent] = useState(null);
  const [deletingStudent, setDeletingStudent] = useState(null);

  useEffect(() => {
    fetchStudentLists();
  }, []);

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
            </Box>
          </Paper>
        </Grid>

        {/* Students Panel */}
        <Grid item xs={12} md={8}>
          <Paper elevation={2} sx={{ p: 2, height: '100%' }}>
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
    </Container>
  );
};

export default StudentManagement;
