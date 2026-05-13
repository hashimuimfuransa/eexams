import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Tabs,
  Tab,
  Divider,
  Switch,
  FormControlLabel,
  Tooltip
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ContentCopy as DuplicateIcon,
  Visibility as ViewIcon,
  Lock as LockIcon,
  LockOpen as UnlockIcon,
  Timer as TimerIcon,
  Search as SearchIcon
} from '@mui/icons-material';

// Mock data for exams
const mockExams = [
  {
    id: 1,
    title: 'Mathematics Final Exam',
    subject: 'Mathematics',
    duration: 120,
    totalQuestions: 50,
    totalMarks: 100,
    status: 'draft',
    createdAt: '2023-05-10'
  },
  {
    id: 2,
    title: 'Physics Midterm',
    subject: 'Physics',
    duration: 90,
    totalQuestions: 30,
    totalMarks: 60,
    status: 'scheduled',
    scheduledFor: '2023-06-18 10:30 AM',
    status: 'scheduled',
    createdAt: '2023-05-15'
  },
  {
    id: 3,
    title: 'Computer Science Quiz',
    subject: 'Computer Science',
    duration: 45,
    totalQuestions: 20,
    totalMarks: 40,
    status: 'active',
    createdAt: '2023-05-20'
  },
  {
    id: 4,
    title: 'Biology Final Exam',
    subject: 'Biology',
    duration: 120,
    totalQuestions: 60,
    totalMarks: 100,
    status: 'completed',
    createdAt: '2023-04-25'
  },
  {
    id: 5,
    title: 'Chemistry Lab Test',
    subject: 'Chemistry',
    duration: 60,
    totalQuestions: 25,
    totalMarks: 50,
    status: 'draft',
    createdAt: '2023-05-22'
  }
];

const ExamManagement = () => {
  const [exams, setExams] = useState(mockExams);
  const [openDialog, setOpenDialog] = useState(false);
  const [currentExam, setCurrentExam] = useState(null);
  const [tabValue, setTabValue] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  // Handle opening the create/edit exam dialog
  const handleOpenDialog = (exam = null) => {
    setCurrentExam(exam);
    setOpenDialog(true);
  };

  // Handle closing the dialog
  const handleCloseDialog = () => {
    setOpenDialog(false);
    setCurrentExam(null);
  };

  // Handle saving the exam
  const handleSaveExam = () => {
    // In a real app, this would save to the backend
    // For now, we'll just update our local state
    if (currentExam?.id) {
      // Update existing exam
      setExams(exams.map(exam =>
        exam.id === currentExam.id ? { ...currentExam } : exam
      ));
    } else {
      // Create new exam
      const newExam = {
        ...currentExam,
        id: exams.length + 1,
        status: 'draft',
        createdAt: new Date().toISOString().split('T')[0]
      };
      setExams([...exams, newExam]);
    }
    handleCloseDialog();
  };

  // Handle deleting an exam
  const handleDeleteExam = (id) => {
    // In a real app, this would delete from the backend
    setExams(exams.filter(exam => exam.id !== id));
  };

  // Handle duplicating an exam
  const handleDuplicateExam = (exam) => {
    const duplicatedExam = {
      ...exam,
      id: exams.length + 1,
      title: `Copy of ${exam.title}`,
      status: 'draft',
      createdAt: new Date().toISOString().split('T')[0]
    };
    setExams([...exams, duplicatedExam]);
  };

  // Handle locking/unlocking an exam
  const handleToggleLock = (id) => {
    setExams(exams.map(exam =>
      exam.id === id ? {
        ...exam,
        status: exam.status === 'scheduled' ? 'active' : (exam.status === 'active' ? 'scheduled' : exam.status)
      } : exam
    ));
  };

  // Filter exams based on search query and status filter
  const filteredExams = exams.filter(exam => {
    const matchesSearch = exam.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         exam.subject.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || exam.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  // Get status chip color
  const getStatusColor = (status) => {
    switch (status) {
      case 'draft':
        return 'default';
      case 'scheduled':
        return 'primary';
      case 'active':
        return 'success';
      case 'completed':
        return 'secondary';
      default:
        return 'default';
    }
  };

  return (
    <Box>
      <Paper
        elevation={3}
        sx={{
          mb: 4,
          p: 3,
          borderRadius: 4,
          background: `linear-gradient(135deg, rgba(93, 95, 239, 0.05) 0%, rgba(93, 95, 239, 0.1) 100%)`,
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundImage: 'url(https://www.transparenttextures.com/patterns/cubes.png)',
            opacity: 0.04,
            zIndex: 0,
          }
        }}
      >
        <Box sx={{ position: 'relative', zIndex: 1 }}>
          <Typography
            variant="h4"
            component="h1"
            fontWeight="bold"
            sx={{
              background: `linear-gradient(135deg, #5D5FEF, #4240B3)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              mb: 0.5
            }}
          >
            Exam Management
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Create, edit and manage your exams
          </Typography>
        </Box>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
          sx={{
            borderRadius: 12,
            px: 3,
            py: 1.2,
            boxShadow: '0 8px 16px rgba(93, 95, 239, 0.3)',
            background: 'linear-gradient(135deg, #5D5FEF, #4240B3)',
            position: 'relative',
            zIndex: 1,
            '&:hover': {
              boxShadow: '0 12px 20px rgba(93, 95, 239, 0.4)',
              transform: 'translateY(-3px)'
            }
          }}
        >
          Create New Exam
        </Button>
      </Paper>

      {/* Filters and Search */}
      <Paper
        elevation={2}
        sx={{
          p: 3,
          mb: 3,
          borderRadius: 4,
          border: '1px solid rgba(93, 95, 239, 0.08)',
          background: 'white'
        }}
      >
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              variant="outlined"
              placeholder="Search exams by title or subject..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                sx: {
                  borderRadius: 3,
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(93, 95, 239, 0.15)',
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(93, 95, 239, 0.3)',
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#5D5FEF',
                  }
                }
              }}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>Filter by Status</InputLabel>
              <Select
                value={filterStatus}
                label="Filter by Status"
                onChange={(e) => setFilterStatus(e.target.value)}
                sx={{
                  borderRadius: 3,
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(93, 95, 239, 0.15)',
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(93, 95, 239, 0.3)',
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#5D5FEF',
                  }
                }}
              >
                <MenuItem value="all">All Statuses</MenuItem>
                <MenuItem value="draft">Draft</MenuItem>
                <MenuItem value="scheduled">Scheduled</MenuItem>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      {/* Tabs for different exam views */}
      <Box sx={{ mb: 3 }}>
        <Tabs
          value={tabValue}
          onChange={(e, newValue) => setTabValue(newValue)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            '& .MuiTabs-indicator': {
              backgroundColor: '#5D5FEF',
              height: 3,
              borderRadius: '3px 3px 0 0'
            },
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.95rem',
              minWidth: 100,
              transition: 'all 0.2s',
              '&.Mui-selected': {
                color: '#5D5FEF',
              },
              '&:hover': {
                color: '#5D5FEF',
                opacity: 0.8
              }
            }
          }}
        >
          <Tab label="All Exams" />
          <Tab label="Draft" />
          <Tab label="Scheduled" />
          <Tab label="Active" />
          <Tab label="Completed" />
        </Tabs>
      </Box>

      {/* Exams Table */}
      <TableContainer
        component={Paper}
        elevation={3}
        sx={{
          borderRadius: 4,
          overflow: 'hidden',
          border: '1px solid rgba(93, 95, 239, 0.08)',
          '& .MuiTable-root': {
            borderCollapse: 'separate',
            borderSpacing: '0 4px'
          }
        }}
      >
        <Table>
          <TableHead sx={{
            background: 'linear-gradient(135deg, rgba(93, 95, 239, 0.08) 0%, rgba(93, 95, 239, 0.15) 100%)'
          }}>
            <TableRow>
              <TableCell sx={{
                fontWeight: 'bold',
                color: '#2B3674',
                fontSize: '0.95rem',
                py: 2.5
              }}>Exam Title</TableCell>
              <TableCell sx={{
                fontWeight: 'bold',
                color: '#2B3674',
                fontSize: '0.95rem'
              }}>Subject</TableCell>
              <TableCell sx={{
                fontWeight: 'bold',
                color: '#2B3674',
                fontSize: '0.95rem'
              }}>Duration</TableCell>
              <TableCell sx={{
                fontWeight: 'bold',
                color: '#2B3674',
                fontSize: '0.95rem'
              }}>Questions</TableCell>
              <TableCell sx={{
                fontWeight: 'bold',
                color: '#2B3674',
                fontSize: '0.95rem'
              }}>Status</TableCell>
              <TableCell sx={{
                fontWeight: 'bold',
                color: '#2B3674',
                fontSize: '0.95rem'
              }}>Created</TableCell>
              <TableCell align="center" sx={{
                fontWeight: 'bold',
                color: '#2B3674',
                fontSize: '0.95rem'
              }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredExams.map((exam) => (
              <TableRow
                key={exam.id}
                hover
                sx={{
                  transition: 'all 0.2s',
                  '&:hover': {
                    backgroundColor: 'rgba(93, 95, 239, 0.04)',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
                  },
                  '& > .MuiTableCell-root': {
                    borderBottom: '1px solid rgba(93, 95, 239, 0.08)',
                    py: 2
                  }
                }}
              >
                <TableCell sx={{ fontWeight: 'medium' }}>{exam.title}</TableCell>
                <TableCell>{exam.subject}</TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <TimerIcon sx={{ fontSize: 16, mr: 0.5, color: 'text.secondary' }} />
                    {exam.duration} mins
                  </Box>
                </TableCell>
                <TableCell>{exam.totalQuestions}</TableCell>
                <TableCell>
                  <Chip
                    label={exam.status.charAt(0).toUpperCase() + exam.status.slice(1)}
                    color={getStatusColor(exam.status)}
                    size="small"
                    sx={{
                      fontWeight: 'medium',
                      borderRadius: '12px',
                      px: 1
                    }}
                  />
                </TableCell>
                <TableCell>{exam.createdAt}</TableCell>
                <TableCell align="center">
                  <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                    <Tooltip title="View Exam" arrow>
                      <IconButton
                        size="small"
                        color="primary"
                        sx={{
                          bgcolor: 'rgba(93, 95, 239, 0.08)',
                          mr: 0.5,
                          '&:hover': {
                            bgcolor: 'rgba(93, 95, 239, 0.15)',
                          }
                        }}
                      >
                        <ViewIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Edit Exam" arrow>
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => handleOpenDialog(exam)}
                        sx={{
                          bgcolor: 'rgba(93, 95, 239, 0.08)',
                          mr: 0.5,
                          '&:hover': {
                            bgcolor: 'rgba(93, 95, 239, 0.15)',
                          }
                        }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Duplicate Exam" arrow>
                      <IconButton
                        size="small"
                        color="secondary"
                        onClick={() => handleDuplicateExam(exam)}
                        sx={{
                          bgcolor: 'rgba(255, 107, 139, 0.08)',
                          mr: 0.5,
                          '&:hover': {
                            bgcolor: 'rgba(255, 107, 139, 0.15)',
                          }
                        }}
                      >
                        <DuplicateIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {(exam.status === 'scheduled' || exam.status === 'active') && (
                      <Tooltip title={exam.status === 'scheduled' ? 'Unlock Exam' : 'Lock Exam'} arrow>
                        <IconButton
                          size="small"
                          color={exam.status === 'active' ? 'error' : 'success'}
                          onClick={() => handleToggleLock(exam.id)}
                          sx={{
                            bgcolor: exam.status === 'active'
                              ? 'rgba(255, 82, 82, 0.08)'
                              : 'rgba(56, 217, 169, 0.08)',
                            mr: 0.5,
                            '&:hover': {
                              bgcolor: exam.status === 'active'
                                ? 'rgba(255, 82, 82, 0.15)'
                                : 'rgba(56, 217, 169, 0.15)',
                            }
                          }}
                        >
                          {exam.status === 'scheduled' ? <UnlockIcon fontSize="small" /> : <LockIcon fontSize="small" />}
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip title="Delete Exam" arrow>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDeleteExam(exam.id)}
                        sx={{
                          bgcolor: 'rgba(255, 82, 82, 0.08)',
                          '&:hover': {
                            bgcolor: 'rgba(255, 82, 82, 0.15)',
                          }
                        }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
            {filteredExams.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 3 }}>
                  <Typography variant="body1" color="text.secondary">
                    No exams found. Create a new exam to get started.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create/Edit Exam Dialog */}
      <Dialog
        open={openDialog}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 4,
            boxShadow: '0 24px 48px rgba(0, 0, 0, 0.2)',
            backgroundImage: 'linear-gradient(135deg, rgba(93, 95, 239, 0.02) 0%, rgba(93, 95, 239, 0.05) 100%)',
          }
        }}
      >
        <DialogTitle sx={{
          p: 3,
          background: 'linear-gradient(135deg, rgba(93, 95, 239, 0.08) 0%, rgba(93, 95, 239, 0.15) 100%)',
          borderBottom: '1px solid rgba(93, 95, 239, 0.1)'
        }}>
          <Typography variant="h5" component="h2" fontWeight="bold" color="primary.main">
            {currentExam ? 'Edit Exam' : 'Create New Exam'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {currentExam ? 'Update the exam details below' : 'Fill in the exam details below'}
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <Grid container spacing={3} sx={{ mt: 0 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Exam Title"
                variant="outlined"
                value={currentExam?.title || ''}
                onChange={(e) => setCurrentExam({ ...currentExam, title: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Subject"
                variant="outlined"
                value={currentExam?.subject || ''}
                onChange={(e) => setCurrentExam({ ...currentExam, subject: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Duration (minutes)"
                variant="outlined"
                type="number"
                value={currentExam?.duration || ''}
                onChange={(e) => setCurrentExam({ ...currentExam, duration: parseInt(e.target.value) })}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Total Questions"
                variant="outlined"
                type="number"
                value={currentExam?.totalQuestions || ''}
                onChange={(e) => setCurrentExam({ ...currentExam, totalQuestions: parseInt(e.target.value) })}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Total Marks"
                variant="outlined"
                type="number"
                value={currentExam?.totalMarks || ''}
                onChange={(e) => setCurrentExam({ ...currentExam, totalMarks: parseInt(e.target.value) })}
                required
              />
            </Grid>

            <Grid item xs={12}>
              <Divider sx={{ my: 1 }}>
                <Chip label="Exam Settings" />
              </Divider>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={currentExam?.randomizeQuestions || false}
                    onChange={(e) => setCurrentExam({ ...currentExam, randomizeQuestions: e.target.checked })}
                    color="primary"
                  />
                }
                label="Randomize Questions"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={currentExam?.preventTabSwitching || false}
                    onChange={(e) => setCurrentExam({ ...currentExam, preventTabSwitching: e.target.checked })}
                    color="primary"
                  />
                }
                label="Prevent Tab Switching"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={currentExam?.showResults || false}
                    onChange={(e) => setCurrentExam({ ...currentExam, showResults: e.target.checked })}
                    color="primary"
                  />
                }
                label="Show Results After Completion"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={currentExam?.singleDeviceOnly || true}
                    onChange={(e) => setCurrentExam({ ...currentExam, singleDeviceOnly: e.target.checked })}
                    color="primary"
                  />
                }
                label="Single Device Only"
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Instructions"
                variant="outlined"
                multiline
                rows={4}
                value={currentExam?.instructions || ''}
                onChange={(e) => setCurrentExam({ ...currentExam, instructions: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 3, borderTop: '1px solid rgba(93, 95, 239, 0.1)' }}>
          <Button
            onClick={handleCloseDialog}
            variant="outlined"
            sx={{
              borderRadius: 12,
              px: 3,
              borderWidth: 2,
              '&:hover': {
                borderWidth: 2
              }
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleSaveExam}
            sx={{
              borderRadius: 12,
              px: 3,
              py: 1.2,
              boxShadow: '0 8px 16px rgba(93, 95, 239, 0.3)',
              background: 'linear-gradient(135deg, #5D5FEF, #4240B3)',
              '&:hover': {
                boxShadow: '0 12px 20px rgba(93, 95, 239, 0.4)',
                transform: 'translateY(-2px)'
              }
            }}
          >
            {currentExam?.id ? 'Update Exam' : 'Create Exam'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ExamManagement;
