import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Grid,
  Card,
  CardContent,
  CardActions,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  Switch,
  FormControlLabel,
  Tooltip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Avatar,
  Badge
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Event as EventIcon,
  EventAvailable as EventAvailableIcon,
  EventBusy as EventBusyIcon,
  AccessTime as TimeIcon,
  Lock as LockIcon,
  LockOpen as UnlockIcon,
  Notifications as NotificationsIcon,
  Group as GroupIcon,
  School as SchoolIcon,
  Assignment as AssignmentIcon,
  CalendarToday as CalendarIcon,
  Timer as TimerIcon,
  NotificationsActive as AlertIcon
} from '@mui/icons-material';
// Using standard TextField for date/time input instead of MUI DateTimePicker
// to avoid additional dependencies

// Mock data for scheduled exams
const mockScheduledExams = [
  {
    id: 1,
    examId: 2,
    examTitle: 'Physics Midterm',
    subject: 'Physics',
    scheduledDate: new Date('2023-06-18T10:30:00'),
    duration: 90,
    status: 'upcoming',
    classes: ['Class 12A', 'Class 12B'],
    totalStudents: 80,
    isLocked: true
  },
  {
    id: 2,
    examId: 3,
    examTitle: 'Computer Science Quiz',
    subject: 'Computer Science',
    scheduledDate: new Date('2023-06-20T14:00:00'),
    duration: 45,
    status: 'upcoming',
    classes: ['Class 11A'],
    totalStudents: 25,
    isLocked: true
  },
  {
    id: 3,
    examId: 5,
    examTitle: 'Chemistry Lab Test',
    subject: 'Chemistry',
    scheduledDate: new Date('2023-06-15T09:00:00'),
    duration: 60,
    status: 'upcoming',
    classes: ['Class 11B', 'Class 12A'],
    totalStudents: 65,
    isLocked: true
  },
  {
    id: 4,
    examId: 1,
    examTitle: 'Mathematics Final Exam',
    subject: 'Mathematics',
    scheduledDate: new Date('2023-06-25T13:00:00'),
    duration: 120,
    status: 'upcoming',
    classes: ['Class 12A', 'Class 12B'],
    totalStudents: 78,
    isLocked: true
  }
];

// Mock data for available exams
const mockAvailableExams = [
  {
    id: 1,
    title: 'Mathematics Final Exam',
    subject: 'Mathematics',
    duration: 120,
    totalQuestions: 50,
    totalMarks: 100
  },
  {
    id: 5,
    title: 'Chemistry Lab Test',
    subject: 'Chemistry',
    duration: 60,
    totalQuestions: 25,
    totalMarks: 50
  }
];

// Mock data for classes
const mockClasses = [
  { id: 1, name: 'Class 11A', students: 25 },
  { id: 2, name: 'Class 11B', students: 30 },
  { id: 3, name: 'Class 12A', students: 35 },
  { id: 4, name: 'Class 12B', students: 40 }
];

const ScheduleManagement = () => {
  const [scheduledExams, setScheduledExams] = useState(mockScheduledExams);
  const [openDialog, setOpenDialog] = useState(false);
  const [currentSchedule, setCurrentSchedule] = useState(null);
  const [selectedExam, setSelectedExam] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedClasses, setSelectedClasses] = useState([]);
  const [sendNotification, setSendNotification] = useState(true);
  const [lockExam, setLockExam] = useState(true);

  // Handle opening the schedule dialog
  const handleOpenDialog = (schedule = null) => {
    if (schedule) {
      setCurrentSchedule(schedule);
      setSelectedExam(schedule.examId);
      setSelectedDate(schedule.scheduledDate);
      setSelectedClasses(schedule.classes);
      setLockExam(schedule.isLocked);
    } else {
      setCurrentSchedule(null);
      setSelectedExam('');
      setSelectedDate(new Date());
      setSelectedClasses([]);
      setLockExam(true);
    }
    setOpenDialog(true);
  };

  // Handle closing the dialog
  const handleCloseDialog = () => {
    setOpenDialog(false);
  };

  // Handle saving the schedule
  const handleSaveSchedule = () => {
    // Find the selected exam details
    const examDetails = mockAvailableExams.find(exam => exam.id === selectedExam);

    if (!examDetails) return;

    if (currentSchedule) {
      // Update existing schedule
      setScheduledExams(scheduledExams.map(schedule =>
        schedule.id === currentSchedule.id ? {
          ...schedule,
          examId: selectedExam,
          examTitle: examDetails.title,
          subject: examDetails.subject,
          scheduledDate: selectedDate,
          duration: examDetails.duration,
          classes: selectedClasses,
          totalStudents: calculateTotalStudents(selectedClasses),
          isLocked: lockExam
        } : schedule
      ));
    } else {
      // Create new schedule
      const newSchedule = {
        id: scheduledExams.length + 1,
        examId: selectedExam,
        examTitle: examDetails.title,
        subject: examDetails.subject,
        scheduledDate: selectedDate,
        duration: examDetails.duration,
        status: 'upcoming',
        classes: selectedClasses,
        totalStudents: calculateTotalStudents(selectedClasses),
        isLocked: lockExam
      };
      setScheduledExams([...scheduledExams, newSchedule]);
    }
    handleCloseDialog();
  };

  // Calculate total students from selected classes
  const calculateTotalStudents = (classNames) => {
    return classNames.reduce((total, className) => {
      const classInfo = mockClasses.find(c => c.name === className);
      return total + (classInfo ? classInfo.students : 0);
    }, 0);
  };

  // Handle deleting a schedule
  const handleDeleteSchedule = (id) => {
    setScheduledExams(scheduledExams.filter(schedule => schedule.id !== id));
  };

  // Handle toggling lock status
  const handleToggleLock = (id) => {
    setScheduledExams(scheduledExams.map(schedule =>
      schedule.id === id ? { ...schedule, isLocked: !schedule.isLocked } : schedule
    ));
  };

  // Format date for display
  const formatDate = (date) => {
    return new Date(date).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: 'numeric'
    });
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'upcoming':
        return 'primary';
      case 'in-progress':
        return 'success';
      case 'completed':
        return 'secondary';
      case 'cancelled':
        return 'error';
      default:
        return 'default';
    }
  };

  // Sort exams by date
  const sortedExams = [...scheduledExams].sort((a, b) =>
    new Date(a.scheduledDate) - new Date(b.scheduledDate)
  );

  return (
    <Box>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" component="h1" fontWeight="bold" color="primary.dark">
          Exam Schedule
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Schedule New Exam
        </Button>
      </Box>

      {/* Calendar View */}
      <Paper elevation={3} sx={{ p: 3, mb: 4, borderRadius: 2 }}>
        <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
          Upcoming Exams
        </Typography>

        <Grid container spacing={3}>
          {sortedExams.map((schedule) => (
            <Grid item xs={12} sm={6} md={4} key={schedule.id}>
              <Card
                elevation={3}
                sx={{
                  borderRadius: 2,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                  overflow: 'visible',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '4px',
                    bgcolor: schedule.isLocked ? 'error.main' : 'success.main',
                    borderRadius: '4px 4px 0 0',
                  }
                }}
              >
                <Box sx={{ position: 'absolute', top: -10, right: 20 }}>
                  <Chip
                    label={schedule.status.charAt(0).toUpperCase() + schedule.status.slice(1)}
                    color={getStatusColor(schedule.status)}
                    size="small"
                  />
                </Box>

                <CardContent sx={{ flexGrow: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Avatar
                      sx={{
                        bgcolor: 'primary.lighter',
                        color: 'primary.main',
                        mr: 2
                      }}
                    >
                      <AssignmentIcon />
                    </Avatar>
                    <Typography variant="h6" fontWeight="bold" noWrap>
                      {schedule.examTitle}
                    </Typography>
                  </Box>

                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Subject: {schedule.subject}
                  </Typography>

                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <CalendarIcon fontSize="small" sx={{ mr: 1, color: 'primary.main' }} />
                    <Typography variant="body2">
                      {formatDate(schedule.scheduledDate)}
                    </Typography>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <TimerIcon fontSize="small" sx={{ mr: 1, color: 'warning.main' }} />
                    <Typography variant="body2">
                      Duration: {schedule.duration} minutes
                    </Typography>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <GroupIcon fontSize="small" sx={{ mr: 1, color: 'info.main' }} />
                    <Typography variant="body2">
                      {schedule.totalStudents} Students
                    </Typography>
                  </Box>

                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Classes:
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {schedule.classes.map((cls, index) => (
                        <Chip
                          key={index}
                          label={cls}
                          size="small"
                          sx={{ bgcolor: 'primary.lighter', color: 'primary.main' }}
                        />
                      ))}
                    </Box>
                  </Box>
                </CardContent>

                <Divider />

                <CardActions sx={{ justifyContent: 'space-between', p: 2 }}>
                  <Box>
                    <Tooltip title={schedule.isLocked ? 'Unlock Exam' : 'Lock Exam'}>
                      <IconButton
                        color={schedule.isLocked ? 'error' : 'success'}
                        onClick={() => handleToggleLock(schedule.id)}
                      >
                        {schedule.isLocked ? <LockIcon /> : <UnlockIcon />}
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Send Notification">
                      <IconButton color="primary">
                        <NotificationsIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                  <Box>
                    <Tooltip title="Edit Schedule">
                      <IconButton
                        color="primary"
                        onClick={() => handleOpenDialog(schedule)}
                      >
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete Schedule">
                      <IconButton
                        color="error"
                        onClick={() => handleDeleteSchedule(schedule.id)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </CardActions>
              </Card>
            </Grid>
          ))}

          {scheduledExams.length === 0 && (
            <Grid item xs={12}>
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <EventBusyIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary">
                  No exams scheduled
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Click the "Schedule New Exam" button to get started
                </Typography>
              </Box>
            </Grid>
          )}
        </Grid>
      </Paper>

      {/* Schedule Dialog */}
      <Dialog
        open={openDialog}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {currentSchedule ? 'Edit Exam Schedule' : 'Schedule New Exam'}
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <FormControl fullWidth required>
                <InputLabel>Select Exam</InputLabel>
                <Select
                  value={selectedExam}
                  label="Select Exam"
                  onChange={(e) => setSelectedExam(e.target.value)}
                >
                  {mockAvailableExams.map((exam) => (
                    <MenuItem key={exam.id} value={exam.id}>
                      {exam.title} ({exam.subject})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label="Schedule Date"
                type="date"
                fullWidth
                required
                value={selectedDate ? selectedDate.toISOString().split('T')[0] : ''}
                onChange={(e) => {
                  const newDate = new Date(e.target.value);
                  // Preserve the time from the existing date if it exists
                  if (selectedDate) {
                    newDate.setHours(selectedDate.getHours(), selectedDate.getMinutes());
                  }
                  setSelectedDate(newDate);
                }}
                InputLabelProps={{
                  shrink: true,
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Schedule Time"
                type="time"
                fullWidth
                required
                value={selectedDate ?
                  `${String(selectedDate.getHours()).padStart(2, '0')}:${String(selectedDate.getMinutes()).padStart(2, '0')}`
                  : ''}
                onChange={(e) => {
                  const [hours, minutes] = e.target.value.split(':').map(Number);
                  const newDate = new Date(selectedDate || new Date());
                  newDate.setHours(hours, minutes);
                  setSelectedDate(newDate);
                }}
                InputLabelProps={{
                  shrink: true,
                }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth required>
                <InputLabel>Select Classes</InputLabel>
                <Select
                  multiple
                  value={selectedClasses}
                  label="Select Classes"
                  onChange={(e) => setSelectedClasses(e.target.value)}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selected.map((value) => (
                        <Chip key={value} label={value} size="small" />
                      ))}
                    </Box>
                  )}
                >
                  {mockClasses.map((cls) => (
                    <MenuItem key={cls.id} value={cls.name}>
                      {cls.name} ({cls.students} students)
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
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
                    checked={lockExam}
                    onChange={(e) => setLockExam(e.target.checked)}
                    color="primary"
                  />
                }
                label="Lock Exam (Students need admin to unlock)"
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={sendNotification}
                    onChange={(e) => setSendNotification(e.target.checked)}
                    color="primary"
                  />
                }
                label="Send Notification to Students"
              />
            </Grid>

            {selectedClasses.length > 0 && (
              <Grid item xs={12}>
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Summary:
                  </Typography>
                  <Typography variant="body2">
                    This exam will be scheduled for {selectedClasses.length} classes with approximately {calculateTotalStudents(selectedClasses)} students.
                  </Typography>
                </Paper>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleSaveSchedule}
            disabled={!selectedExam || selectedClasses.length === 0}
          >
            {currentSchedule ? 'Update Schedule' : 'Schedule Exam'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ScheduleManagement;
