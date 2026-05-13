import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Grid,
  MenuItem,
  Divider,
  useTheme,
  alpha,
  FormControlLabel,
  Switch,
  Chip,
  Snackbar,
  Alert,
  CircularProgress,
  Autocomplete,
  Checkbox,
  FormGroup,
  FormControl,
  InputLabel,
  Select,
  ListItemText,
  FormHelperText
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Schedule as ScheduleIcon,
  CalendarMonth as CalendarIcon,
  AccessTime as TimeIcon,
  Person as PersonIcon,
  Group as GroupIcon,
  Add as AddIcon
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { getAllExams, getAllStudents, scheduleExam } from '../../../services/adminService';

const ExamScheduler = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const preSelectedExamId = queryParams.get('examId');

  // State for exams and students
  const [exams, setExams] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);

  // Snackbar state
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });

  // Form state
  const [scheduleData, setScheduleData] = useState({
    examId: preSelectedExamId || '',
    studentIds: [],
    date: null,
    startTime: null,
    endTime: null,
    sendNotification: true,
    allowLateSubmission: false
  });

  // Validation state
  const [errors, setErrors] = useState({
    examId: '',
    studentIds: '',
    date: '',
    startTime: '',
    endTime: ''
  });

  // Fetch exams and students on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch exams
        const examsData = await getAllExams();
        console.log('Fetched exams:', examsData);

        // Show all exams that aren't already scheduled
        // If status is missing, assume it's a draft
        // Log all exams for debugging
        console.log('All exams:', examsData);

        // Filter exams that can be scheduled
        // IMPORTANT: Show ALL exams regardless of status for now
        // This ensures we can see the exams we've created
        const schedulableExams = examsData;

        // Log each exam for debugging
        examsData.forEach(exam => {
          console.log(`Exam ${exam.title} (${exam._id}): scheduledFor=${exam.scheduledFor}, status=${exam.status}`);
        });

        console.log('Schedulable exams:', schedulableExams);
        setExams(schedulableExams);

        // Fetch students
        const studentsData = await getAllStudents();
        setStudents(studentsData);
      } catch (error) {
        console.error('Error fetching data:', error);
        setSnackbar({
          open: true,
          message: 'Failed to load data. Please try again.',
          severity: 'error'
        });
      } finally {
        setDataLoading(false);
      }
    };

    fetchData();
  }, []);

  // Handle form input changes
  const handleChange = (e) => {
    const { name, value, checked } = e.target;
    setScheduleData({
      ...scheduleData,
      [name]: name === 'sendNotification' || name === 'allowLateSubmission' ? checked : value
    });

    // Clear error for this field
    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: ''
      });
    }
  };

  // Handle date change
  const handleDateChange = (newDate) => {
    setScheduleData({
      ...scheduleData,
      date: newDate
    });

    // Clear date error
    if (errors.date) {
      setErrors({
        ...errors,
        date: ''
      });
    }
  };

  // Handle time change
  const handleTimeChange = (name, newTime) => {
    setScheduleData({
      ...scheduleData,
      [name]: newTime
    });

    // Clear time error
    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: ''
      });
    }
  };

  // Handle student selection
  const handleStudentChange = (event) => {
    const { value } = event.target;
    setScheduleData({
      ...scheduleData,
      studentIds: value
    });

    // Clear student error
    if (errors.studentIds) {
      setErrors({
        ...errors,
        studentIds: ''
      });
    }
  };

  // Close snackbar
  const handleCloseSnackbar = () => {
    setSnackbar({
      ...snackbar,
      open: false
    });
  };

  // Validate form
  const validateForm = () => {
    const newErrors = {
      examId: '',
      studentIds: '',
      date: '',
      startTime: '',
      endTime: ''
    };

    let isValid = true;

    if (!scheduleData.examId) {
      newErrors.examId = 'Please select an exam';
      isValid = false;
    }

    if (!scheduleData.studentIds || scheduleData.studentIds.length === 0) {
      newErrors.studentIds = 'Please select at least one student';
      isValid = false;
    }

    if (!scheduleData.date) {
      newErrors.date = 'Please select a date';
      isValid = false;
    }

    if (!scheduleData.startTime) {
      newErrors.startTime = 'Please select a start time';
      isValid = false;
    }

    if (!scheduleData.endTime) {
      newErrors.endTime = 'Please select an end time';
      isValid = false;
    }

    // Check if end time is after start time
    if (scheduleData.startTime && scheduleData.endTime) {
      const startHours = scheduleData.startTime.getHours();
      const startMinutes = scheduleData.startTime.getMinutes();
      const endHours = scheduleData.endTime.getHours();
      const endMinutes = scheduleData.endTime.getMinutes();

      if (endHours < startHours || (endHours === startHours && endMinutes <= startMinutes)) {
        newErrors.endTime = 'End time must be after start time';
        isValid = false;
      }
    }

    setErrors(newErrors);
    return isValid;
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate form
    if (!validateForm()) {
      setSnackbar({
        open: true,
        message: 'Please fix the errors before submitting',
        severity: 'error'
      });
      return;
    }

    setLoading(true);

    try {
      // Make sure we have all required data
      if (!scheduleData.examId || !scheduleData.date || !scheduleData.startTime || !scheduleData.endTime) {
        throw new Error('Please fill in all required fields');
      }

      // Format the data for the API
      const formattedData = {
        examId: scheduleData.examId,
        studentIds: scheduleData.studentIds || [],
        date: scheduleData.date.toISOString(),
        startTime: scheduleData.startTime.toISOString(),
        endTime: scheduleData.endTime.toISOString(),
        sendNotification: scheduleData.sendNotification,
        allowLateSubmission: scheduleData.allowLateSubmission
      };

      console.log('Sending data to API:', formattedData);

      // Call API to schedule exam
      const result = await scheduleExam(formattedData);

      console.log('Exam scheduled successfully:', result);

      // Show success message
      setSnackbar({
        open: true,
        message: 'Exam scheduled successfully!',
        severity: 'success'
      });

      // Navigate back to exams list after a short delay
      setTimeout(() => {
        navigate('/admin/exams');
      }, 2000);
    } catch (error) {
      console.error('Error scheduling exam:', error);

      // Show error message
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Failed to schedule exam. Please try again.',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
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
            Schedule Exam
          </Typography>
          <Typography
            variant="subtitle1"
            color="text.secondary"
            sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}
          >
            Schedule exams for students with specific time slots
          </Typography>
        </Box>
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

      {/* Form */}
      <Paper
        elevation={0}
        sx={{
          borderRadius: { xs: 3, md: 4 },
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          overflow: 'hidden'
        }}
      >
        <Box
          component="form"
          onSubmit={handleSubmit}
          sx={{ p: { xs: 2, md: 3 } }}
        >
          <Grid container spacing={3}>
            {/* Schedule Details */}
            <Grid item xs={12}>
              <Typography variant="h6" fontWeight="medium" gutterBottom>
                Schedule Details
              </Typography>
              <Divider sx={{ mb: 2 }} />
            </Grid>

            {/* Select Exam */}
            <Grid item xs={12} sm={6}>
              {dataLoading ? (
                <Box sx={{ display: 'flex', alignItems: 'center', height: '56px' }}>
                  <CircularProgress size={24} sx={{ mr: 2 }} />
                  <Typography variant="body2">Loading exams...</Typography>
                </Box>
              ) : (
                <TextField
                  fullWidth
                  select
                  label="Select Exam"
                  name="examId"
                  value={scheduleData.examId}
                  onChange={handleChange}
                  required
                  error={!!errors.examId}
                  helperText={errors.examId}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                >
                  {exams.length > 0 ? (
                    exams.map((exam) => (
                      <MenuItem key={exam._id} value={exam._id}>
                        {exam.title}
                      </MenuItem>
                    ))
                  ) : (
                    <MenuItem disabled>No unscheduled exams available. Create a new exam first.</MenuItem>
                  )}
                  {exams.length === 0 && (
                    <>
                      <FormHelperText error>
                        No unscheduled exams available. Please create a new exam first.
                      </FormHelperText>
                      <Button
                        variant="outlined"
                        color="primary"
                        size="small"
                        onClick={() => navigate('/admin/exams/create')}
                        startIcon={<AddIcon />}
                        sx={{ mt: 1, borderRadius: 2 }}
                      >
                        Create New Exam
                      </Button>
                    </>
                  )}
                </TextField>
              )}
            </Grid>

            {/* Select Students */}
            <Grid item xs={12} sm={6}>
              {dataLoading ? (
                <Box sx={{ display: 'flex', alignItems: 'center', height: '56px' }}>
                  <CircularProgress size={24} sx={{ mr: 2 }} />
                  <Typography variant="body2">Loading students...</Typography>
                </Box>
              ) : (
                <FormControl
                  fullWidth
                  error={!!errors.studentIds}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                >
                  <InputLabel id="select-students-label">Select Students</InputLabel>
                  <Select
                    labelId="select-students-label"
                    multiple
                    name="studentIds"
                    value={scheduleData.studentIds}
                    onChange={handleStudentChange}
                    renderValue={(selected) => {
                      if (selected.length === 0) {
                        return <Typography color="text.secondary">No students selected</Typography>;
                      }

                      if (selected.length === 1) {
                        const student = students.find(s => s._id === selected[0]);
                        return student ? `${student.firstName} ${student.lastName}` : 'Unknown student';
                      }

                      return `${selected.length} students selected`;
                    }}
                  >
                    {students.length > 0 ? (
                      students.map((student) => (
                        <MenuItem key={student._id} value={student._id}>
                          <Checkbox checked={scheduleData.studentIds.indexOf(student._id) > -1} />
                          <ListItemText
                            primary={`${student.firstName} ${student.lastName}`}
                            secondary={student.email}
                          />
                        </MenuItem>
                      ))
                    ) : (
                      <MenuItem disabled>No available students</MenuItem>
                    )}
                  </Select>
                  {errors.studentIds && (
                    <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.5 }}>
                      {errors.studentIds}
                    </Typography>
                  )}
                </FormControl>
              )}
            </Grid>

            {/* Date and Time */}
            <Grid item xs={12}>
              <Typography variant="subtitle1" fontWeight="medium" gutterBottom>
                Date and Time
              </Typography>
            </Grid>

            {/* Date Picker */}
            <Grid item xs={12} sm={4}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="Exam Date"
                  value={scheduleData.date}
                  onChange={handleDateChange}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      required: true,
                      error: !!errors.date,
                      helperText: errors.date,
                      sx: { '& .MuiOutlinedInput-root': { borderRadius: 2 } }
                    }
                  }}
                />
              </LocalizationProvider>
            </Grid>

            {/* Start Time */}
            <Grid item xs={12} sm={4}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <TimePicker
                  label="Start Time"
                  value={scheduleData.startTime}
                  onChange={(newTime) => handleTimeChange('startTime', newTime)}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      required: true,
                      error: !!errors.startTime,
                      helperText: errors.startTime,
                      sx: { '& .MuiOutlinedInput-root': { borderRadius: 2 } }
                    }
                  }}
                />
              </LocalizationProvider>
            </Grid>

            {/* End Time */}
            <Grid item xs={12} sm={4}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <TimePicker
                  label="End Time"
                  value={scheduleData.endTime}
                  onChange={(newTime) => handleTimeChange('endTime', newTime)}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      required: true,
                      error: !!errors.endTime,
                      helperText: errors.endTime,
                      sx: { '& .MuiOutlinedInput-root': { borderRadius: 2 } }
                    }
                  }}
                />
              </LocalizationProvider>
            </Grid>

            {/* Options */}
            <Grid item xs={12}>
              <Typography variant="subtitle1" fontWeight="medium" gutterBottom>
                Options
              </Typography>
              <Divider sx={{ mb: 2 }} />
            </Grid>

            {/* Send Notification */}
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={scheduleData.sendNotification}
                    onChange={handleChange}
                    name="sendNotification"
                    color="primary"
                  />
                }
                label="Send notification to students"
              />
            </Grid>

            {/* Allow Late Submission */}
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={scheduleData.allowLateSubmission}
                    onChange={handleChange}
                    name="allowLateSubmission"
                    color="primary"
                  />
                }
                label="Allow late submission (with penalty)"
              />
            </Grid>

            {/* Submit Button */}
            <Grid item xs={12} sx={{ mt: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  variant="contained"
                  color="primary"
                  size="large"
                  type="submit"
                  startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <ScheduleIcon />}
                  disabled={loading}
                  sx={{
                    borderRadius: 3,
                    px: 4,
                    py: 1.5,
                    boxShadow: `0 4px 14px ${alpha(theme.palette.primary.main, 0.3)}`,
                    width: { xs: '100%', sm: 'auto' }
                  }}
                >
                  {loading ? 'Scheduling...' : 'Schedule Exam'}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </Box>
      </Paper>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
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
    </Box>
  );
};

export default ExamScheduler;
