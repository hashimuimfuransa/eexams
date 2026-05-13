import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Grid,
  FormControlLabel,
  Switch,
  Divider,
  useTheme,
  alpha,
  Alert,
  Snackbar,
  CircularProgress,
  Input,
  InputLabel,
  FormControl,
  FormHelperText
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Add as AddIcon,
  Upload as UploadIcon,
  Description as DescriptionIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { createExam } from '../../../services/examService';

const CreateExam = () => {
  const theme = useTheme();
  const navigate = useNavigate();

  // Basic form state
  const [examData, setExamData] = useState({
    title: '',
    description: '',
    timeLimit: 60,
    passingScore: 70,
    isLocked: true,
    allowSelectiveAnswering: false,
    sectionBRequiredQuestions: 3,
    sectionCRequiredQuestions: 1
  });

  // File state
  const [examFile, setExamFile] = useState(null);
  const [answerFile, setAnswerFile] = useState(null);

  // UI state
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });

  // Validation state
  const [errors, setErrors] = useState({
    title: '',
    description: '',
    timeLimit: '',
    examFile: '',
    answerFile: ''
  });

  // Handle form input changes
  const handleChange = (e) => {
    const { name, value, checked } = e.target;
    setExamData({
      ...examData,
      [name]: name === 'isLocked' ? checked : value
    });

    // Clear error for this field
    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: ''
      });
    }
  };

  // Handle file changes
  const handleFileChange = (e) => {
    const { name, files } = e.target;
    if (files && files.length > 0) {
      if (name === 'examFile') {
        setExamFile(files[0]);
        setErrors({
          ...errors,
          examFile: ''
        });
      } else if (name === 'answerFile') {
        setAnswerFile(files[0]);
        setErrors({
          ...errors,
          answerFile: ''
        });
      }
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
      title: '',
      description: '',
      timeLimit: '',
      examFile: '',
      answerFile: ''
    };

    let isValid = true;

    if (!examData.title.trim()) {
      newErrors.title = 'Title is required';
      isValid = false;
    }

    if (!examData.description.trim()) {
      newErrors.description = 'Description is required';
      isValid = false;
    }

    if (!examData.timeLimit || examData.timeLimit <= 0) {
      newErrors.timeLimit = 'Time limit must be greater than 0';
      isValid = false;
    }

    // File validation is optional for now
    // if (!examFile) {
    //   newErrors.examFile = 'Exam file is required';
    //   isValid = false;
    // }

    // if (!answerFile) {
    //   newErrors.answerFile = 'Answer file is required';
    //   isValid = false;
    // }

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
      // Call API to create exam
      const result = await createExam(examData, examFile, answerFile);

      console.log('Exam created successfully:', result);

      // Show success message
      setSnackbar({
        open: true,
        message: 'Exam created successfully!',
        severity: 'success'
      });

      // Navigate back to exams list after a short delay
      setTimeout(() => {
        navigate('/admin/exams');
      }, 2000);
    } catch (error) {
      console.error('Error creating exam:', error);

      // Show error message
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Failed to create exam. Please try again.',
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
            Create New Exam
          </Typography>
          <Typography
            variant="subtitle1"
            color="text.secondary"
            sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}
          >
            Create a new exam with questions and sections
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
          overflow: 'hidden',
          mb: 4
        }}
      >
        <Box
          component="form"
          onSubmit={handleSubmit}
          sx={{ p: { xs: 2, md: 3 } }}
        >
          <Grid container spacing={3}>
            {/* Exam Details */}
            <Grid item xs={12}>
              <Typography variant="h6" fontWeight="medium" gutterBottom>
                Exam Details
              </Typography>
              <Divider sx={{ mb: 2 }} />
            </Grid>

            {/* Title */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Exam Title"
                name="title"
                value={examData.title}
                onChange={handleChange}
                required
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />
            </Grid>

            {/* Description */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                name="description"
                value={examData.description}
                onChange={handleChange}
                multiline
                rows={3}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />
            </Grid>

            {/* Time Limit */}
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Time Limit (minutes)"
                name="timeLimit"
                type="number"
                value={examData.timeLimit}
                onChange={handleChange}
                required
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />
            </Grid>

            {/* Passing Score */}
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Passing Score (%)"
                name="passingScore"
                type="number"
                value={examData.passingScore}
                onChange={handleChange}
                required
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />
            </Grid>

            {/* Exam File Upload */}
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth error={!!errors.examFile}>
                <InputLabel htmlFor="exam-file" shrink>
                  Exam File (PDF or Word) - Optional
                </InputLabel>
                <Box
                  sx={{
                    border: `1px solid ${errors.examFile ? theme.palette.error.main : alpha(theme.palette.divider, 0.5)}`,
                    borderRadius: 2,
                    p: 2,
                    mt: 2,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '120px',
                    backgroundColor: alpha(theme.palette.background.default, 0.5),
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      backgroundColor: alpha(theme.palette.primary.main, 0.05),
                      borderColor: theme.palette.primary.main
                    }
                  }}
                  component="label"
                  htmlFor="exam-file"
                >
                  <input
                    id="exam-file"
                    name="examFile"
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />
                  <UploadIcon
                    sx={{
                      fontSize: 40,
                      color: examFile ? theme.palette.success.main : alpha(theme.palette.text.primary, 0.5),
                      mb: 1
                    }}
                  />
                  <Typography variant="body1" align="center" gutterBottom>
                    {examFile ? examFile.name : 'Click to upload exam file'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" align="center">
                    PDF or Word document (.pdf, .doc, .docx)
                  </Typography>
                </Box>
                {errors.examFile && (
                  <FormHelperText error>{errors.examFile}</FormHelperText>
                )}
              </FormControl>
            </Grid>

            {/* Answer File Upload */}
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth error={!!errors.answerFile}>
                <InputLabel htmlFor="answer-file" shrink>
                  Answer File (PDF or Word) - Optional
                </InputLabel>
                <Box
                  sx={{
                    border: `1px solid ${errors.answerFile ? theme.palette.error.main : alpha(theme.palette.divider, 0.5)}`,
                    borderRadius: 2,
                    p: 2,
                    mt: 2,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '120px',
                    backgroundColor: alpha(theme.palette.background.default, 0.5),
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      backgroundColor: alpha(theme.palette.primary.main, 0.05),
                      borderColor: theme.palette.primary.main
                    }
                  }}
                  component="label"
                  htmlFor="answer-file"
                >
                  <input
                    id="answer-file"
                    name="answerFile"
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />
                  <DescriptionIcon
                    sx={{
                      fontSize: 40,
                      color: answerFile ? theme.palette.success.main : alpha(theme.palette.text.primary, 0.5),
                      mb: 1
                    }}
                  />
                  <Typography variant="body1" align="center" gutterBottom>
                    {answerFile ? answerFile.name : 'Click to upload answer file'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" align="center">
                    PDF or Word document (.pdf, .doc, .docx)
                  </Typography>
                </Box>
                {errors.answerFile && (
                  <FormHelperText error>{errors.answerFile}</FormHelperText>
                )}
              </FormControl>
            </Grid>

            {/* Lock Exam */}
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={examData.isLocked}
                    onChange={handleChange}
                    name="isLocked"
                    color="primary"
                  />
                }
                label="Lock exam (students cannot access until unlocked)"
              />
            </Grid>

            {/* Selective Answering Options */}
            <Grid item xs={12}>
              <Typography variant="h6" fontWeight="medium" gutterBottom sx={{ mt: 2 }}>
                Advanced Options
              </Typography>
              <Divider sx={{ mb: 2 }} />
            </Grid>

            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={examData.allowSelectiveAnswering}
                    onChange={handleChange}
                    name="allowSelectiveAnswering"
                    color="primary"
                  />
                }
                label="Enable selective answering for Sections B and C"
              />
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', ml: 2, mt: 0.5 }}>
                When enabled, students can choose which questions to answer in Sections B and C
              </Typography>
            </Grid>

            {examData.allowSelectiveAnswering && (
              <>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Required questions in Section B"
                    name="sectionBRequiredQuestions"
                    type="number"
                    value={examData.sectionBRequiredQuestions}
                    onChange={handleChange}
                    InputProps={{ inputProps: { min: 1 } }}
                    helperText="Minimum number of questions students must answer in Section B"
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Required questions in Section C"
                    name="sectionCRequiredQuestions"
                    type="number"
                    value={examData.sectionCRequiredQuestions}
                    onChange={handleChange}
                    InputProps={{ inputProps: { min: 1 } }}
                    helperText="Minimum number of questions students must answer in Section C"
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                  />
                </Grid>
              </>
            )}

            {/* Submit Button */}
            <Grid item xs={12} sx={{ mt: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  variant="contained"
                  color="primary"
                  size="large"
                  type="submit"
                  startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                  disabled={loading}
                  sx={{
                    borderRadius: 3,
                    px: 4,
                    py: 1.5,
                    boxShadow: `0 4px 14px ${alpha(theme.palette.primary.main, 0.3)}`,
                    width: { xs: '100%', sm: 'auto' }
                  }}
                >
                  {loading ? 'Creating...' : 'Create Exam'}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </Box>
      </Paper>

      {/* Questions Section - Simplified */}
      <Paper
        elevation={0}
        sx={{
          borderRadius: { xs: 3, md: 4 },
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          overflow: 'hidden',
          p: { xs: 2, md: 3 },
          mb: 4,
          textAlign: 'center'
        }}
      >
        <Typography variant="h6" fontWeight="medium" gutterBottom>
          Questions
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          You can add questions manually after creating the exam
        </Typography>
        <Alert severity="info" sx={{ mb: 3, mx: 'auto', maxWidth: 600, textAlign: 'left' }}>
          If you upload exam files, the system will try to use AI to extract questions automatically. Otherwise, you can add questions manually after creating the exam.
        </Alert>
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          sx={{
            borderRadius: 3,
            px: 3,
            py: 1
          }}
          disabled
        >
          Add Questions Later
        </Button>
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

export default CreateExam;
