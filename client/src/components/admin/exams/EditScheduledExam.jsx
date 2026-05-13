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
  Snackbar,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  Checkbox,
  ListItemText,
  FormHelperText
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  CalendarMonth as CalendarIcon,
  AccessTime as TimeIcon,
  Person as PersonIcon,
  Group as GroupIcon
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import {
  getExamById,
  getAllStudents,
  updateScheduledExam
} from '../../../services/adminService';

const EditScheduledExam = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { id } = useParams();

  // State for exam and students
  const [exam, setExam] = useState(null);
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
    examId: '',
    studentIds: [],
    date: null,
    startTime: null,
    endTime: null,
    sendNotification: false,
    allowLateSubmission: false
  });

  // Validation state
  const [errors, setErrors] = useState({
    studentIds: '',
    date: '',
    startTime: '',
    endTime: ''
  });

  // Fetch exam and students on component mount
  useEffect(() => {
    const fetchData = async () => {
      setDataLoading(true);
      try {
        // Fetch students first
        const studentsData = await getAllStudents();
        setStudents(studentsData);
        console.log('Students data:', studentsData);

        // Fetch exam details
        const examData = await getExamById(id);
        console.log('Exam details:', examData);
        setExam(examData);

        // Initialize form data
        const initialData = {
          examId: examData._id,
          studentIds: examData.assignedTo || [],
          date: examData.scheduledFor ? new Date(examData.scheduledFor) : null,
          startTime: examData.startTime ? new Date(examData.startTime) : null,
          endTime: examData.endTime ? new Date(examData.endTime) : null,
          sendNotification: false,
          allowLateSubmission: examData.allowLateSubmission || false
        };

        console.log('Assigned students:', examData.assignedTo);

        setScheduleData(initialData);
      } catch (error) {
        console.error('Error fetching data:', error);
        setSnackbar({
          open: true,
          message: 'Failed to load exam data. Please try again.',
          severity: 'error'
        });
      } finally {
        setDataLoading(false);
      }
    };

    fetchData();
  }, [id]);

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
      studentIds: '',
      date: '',
      startTime: '',
      endTime: ''
    };

    let isValid = true;

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

      // Call API to update scheduled exam
      const result = await updateScheduledExam(id, formattedData);

      console.log('Exam schedule updated successfully:', result);

      // Show success message
      setSnackbar({
        open: true,
        message: 'Exam schedule updated successfully!',
        severity: 'success'
      });

      // Navigate back to scheduled exams list after a short delay
      setTimeout(() => {
        navigate('/admin/exams/scheduled');
      }, 2000);
    } catch (error) {
      console.error('Error updating exam schedule:', error);

      // Show error message
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Failed to update exam schedule. Please try again.',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  if (dataLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!exam) {
    return (
      <Box sx={{ textAlign: 'center', p: 4 }}>
        <Typography variant="h6" color="error">
          Exam not found or could not be loaded.
        </Typography>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/admin/exams/scheduled')}
          sx={{ mt: 2, borderRadius: 3 }}
        >
          Back to Scheduled Exams
        </Button>
      </Box>
    );
  }

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
            Edit Scheduled Exam
          </Typography>
          <Typography
            variant="subtitle1"
            color="text.secondary"
            sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}
          >
            Update schedule details for {exam.title}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/admin/exams/scheduled')}
          sx={{
            borderRadius: 3,
            width: { xs: '100%', sm: 'auto' }
          }}
        >
          Back to Scheduled Exams
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

            {/* Exam Title (Read-only) */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Exam Title"
                value={exam.title}
                InputProps={{
                  readOnly: true,
                }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />
            </Grid>

            {/* Select Students */}
            <Grid item xs={12}>
              <FormControl
                fullWidth
                error={!!errors.studentIds}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              >
                <InputLabel id="select-students-label">Assigned Students</InputLabel>
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

                    return `${selected.length} students assigned`;
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
                label="Send notification to students about changes"
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
                label="Allow late submission"
              />
            </Grid>

            {/* Action Buttons */}
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 2 }}>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<CancelIcon />}
                  onClick={() => navigate('/admin/exams/scheduled')}
                  sx={{ borderRadius: 2 }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  startIcon={<SaveIcon />}
                  disabled={loading}
                  sx={{ borderRadius: 2 }}
                >
                  {loading ? 'Saving...' : 'Save Changes'}
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

export default EditScheduledExam;
