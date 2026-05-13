import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  CircularProgress,
  Alert,
  Snackbar,
  IconButton,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Delete as DeleteIcon,
  Close as CloseIcon,
  Upload as UploadIcon,
  Description as DescriptionIcon
} from '@mui/icons-material';
import { getExamById, updateExam } from '../../../services/examService';

const EditExam = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { id } = useParams();

  // State
  const [examData, setExamData] = useState({
    title: '',
    description: '',
    timeLimit: 60,
    passingScore: 70,
    isLocked: false,
    allowSelectiveAnswering: false,
    sectionBRequiredQuestions: 3,
    sectionCRequiredQuestions: 1
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });

  // File state
  const [examFile, setExamFile] = useState(null);
  const [answerFile, setAnswerFile] = useState(null);
  const [currentExamFile, setCurrentExamFile] = useState(null);
  const [currentAnswerFile, setCurrentAnswerFile] = useState(null);

  // Dialog state
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  // Validation state
  const [errors, setErrors] = useState({
    title: '',
    description: '',
    timeLimit: ''
  });

  // Fetch exam data
  useEffect(() => {
    const fetchExamData = async () => {
      try {
        setLoading(true);
        console.log('Fetching exam with ID for editing:', id);
        const data = await getExamById(id);
        console.log('Exam data received for editing:', data);

        setExamData({
          title: data.title || '',
          description: data.description || '',
          timeLimit: data.timeLimit || 60,
          passingScore: data.passingScore || 70,
          isLocked: data.isLocked || false,
          allowSelectiveAnswering: data.allowSelectiveAnswering || false,
          sectionBRequiredQuestions: data.sectionBRequiredQuestions || 3,
          sectionCRequiredQuestions: data.sectionCRequiredQuestions || 1
        });

        setCurrentExamFile(data.originalFile);
        setCurrentAnswerFile(data.answerFile);
      } catch (err) {
        console.error('Error fetching exam:', err);
        setError(`Failed to load exam data: ${err.message || 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchExamData();
    } else {
      setError('No exam ID provided');
      setLoading(false);
    }
  }, [id]);

  // Handle form input changes
  const handleChange = (e) => {
    const { name, value, checked } = e.target;
    setExamData({
      ...examData,
      [name]: (name === 'isLocked' || name === 'allowSelectiveAnswering') ? checked : value
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
      } else if (name === 'answerFile') {
        setAnswerFile(files[0]);
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
      timeLimit: ''
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

    setSaving(true);

    try {
      // Create FormData for file upload
      const formData = new FormData();

      // Add exam data
      formData.append('title', examData.title);
      formData.append('description', examData.description);
      formData.append('timeLimit', examData.timeLimit);
      formData.append('passingScore', examData.passingScore);
      formData.append('isLocked', examData.isLocked);
      formData.append('allowSelectiveAnswering', examData.allowSelectiveAnswering);
      formData.append('sectionBRequiredQuestions', examData.sectionBRequiredQuestions);
      formData.append('sectionCRequiredQuestions', examData.sectionCRequiredQuestions);

      // Add files if selected
      if (examFile) {
        formData.append('examFile', examFile);
      }

      if (answerFile) {
        formData.append('answerFile', answerFile);
      }

      // Call API to update exam
      await updateExam(id, formData);

      setSnackbar({
        open: true,
        message: 'Exam updated successfully!',
        severity: 'success'
      });

      // Navigate back to exam view after a short delay
      setTimeout(() => {
        navigate(`/admin/exams/${id}/view`);
      }, 1500);
    } catch (error) {
      console.error('Error updating exam:', error);

      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Failed to update exam. Please try again.',
        severity: 'error'
      });
    } finally {
      setSaving(false);
    }
  };

  // Open confirm dialog
  const handleOpenConfirmDialog = () => {
    setConfirmDialogOpen(true);
  };

  // Close confirm dialog
  const handleCloseConfirmDialog = () => {
    setConfirmDialogOpen(false);
  };

  // Handle delete exam
  const handleDeleteExam = () => {
    // This would be implemented with a delete API call
    setConfirmDialogOpen(false);

    setSnackbar({
      open: true,
      message: 'Delete functionality will be implemented soon',
      severity: 'info'
    });
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/admin/exams')}
          sx={{ mt: 2 }}
        >
          Back to Exams
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
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

      {/* Header */}
      <Box sx={{
        mb: 3,
        display: 'flex',
        justifyContent: 'space-between',
        flexDirection: { xs: 'column', sm: 'row' },
        gap: { xs: 2, sm: 0 }
      }}>
        <Box>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate(`/admin/exams/${id}/view`)}
            sx={{ mb: 1 }}
          >
            Back to Exam
          </Button>
          <Typography variant="h4" component="h1" fontWeight="bold">
            Edit Exam
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={handleOpenConfirmDialog}
            sx={{ borderRadius: 2 }}
          >
            Delete
          </Button>
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
            onClick={handleSubmit}
            disabled={saving}
            sx={{
              borderRadius: 2,
              boxShadow: `0 4px 14px ${alpha(theme.palette.primary.main, 0.3)}`
            }}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </Box>
      </Box>

      {/* Edit Form */}
      <Paper
        elevation={0}
        sx={{
          borderRadius: 3,
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          overflow: 'hidden',
          mb: 3
        }}
      >
        <Box component="form" onSubmit={handleSubmit} sx={{ p: 3 }}>
          <Grid container spacing={3}>
            {/* Title */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Exam Title"
                name="title"
                value={examData.title}
                onChange={handleChange}
                error={!!errors.title}
                helperText={errors.title}
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
                error={!!errors.description}
                helperText={errors.description}
                required
                multiline
                rows={4}
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
                error={!!errors.timeLimit}
                helperText={errors.timeLimit}
                required
                InputProps={{
                  endAdornment: <InputAdornment position="end">min</InputAdornment>,
                }}
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
                InputProps={{
                  endAdornment: <InputAdornment position="end">%</InputAdornment>,
                }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />
            </Grid>

            <Grid item xs={12}>
              <Divider sx={{ my: 1 }} />
            </Grid>

            {/* File Uploads */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Exam Files
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Upload new files or keep the existing ones
              </Typography>
            </Grid>

            {/* Exam File */}
            <Grid item xs={12} sm={6}>
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  borderRadius: 2,
                  border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
                  backgroundColor: alpha(theme.palette.background.default, 0.5)
                }}
              >
                <Typography variant="subtitle1" fontWeight="medium" gutterBottom>
                  Exam File
                </Typography>

                {currentExamFile && !examFile && (
                  <Box sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
                    <DescriptionIcon sx={{ mr: 1, color: theme.palette.primary.main }} />
                    <Typography variant="body2">
                      Current file: {currentExamFile.split('/').pop()}
                    </Typography>
                  </Box>
                )}

                <Box
                  sx={{
                    border: `1px dashed ${alpha(theme.palette.primary.main, 0.5)}`,
                    borderRadius: 2,
                    p: 2,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '100px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      backgroundColor: alpha(theme.palette.primary.main, 0.05),
                      borderColor: theme.palette.primary.main
                    }
                  }}
                  component="label"
                >
                  <input
                    type="file"
                    name="examFile"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                    accept=".pdf,.doc,.docx"
                  />
                  <UploadIcon
                    sx={{
                      fontSize: 40,
                      color: examFile ? theme.palette.success.main : alpha(theme.palette.text.primary, 0.5),
                      mb: 1
                    }}
                  />
                  <Typography variant="body1" align="center" gutterBottom>
                    {examFile ? examFile.name : 'Click to upload new exam file'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" align="center">
                    PDF or Word document (.pdf, .doc, .docx)
                  </Typography>
                </Box>
              </Paper>
            </Grid>

            {/* Answer File */}
            <Grid item xs={12} sm={6}>
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  borderRadius: 2,
                  border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
                  backgroundColor: alpha(theme.palette.background.default, 0.5)
                }}
              >
                <Typography variant="subtitle1" fontWeight="medium" gutterBottom>
                  Answer File
                </Typography>

                {currentAnswerFile && !answerFile && (
                  <Box sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
                    <DescriptionIcon sx={{ mr: 1, color: theme.palette.secondary.main }} />
                    <Typography variant="body2">
                      Current file: {currentAnswerFile.split('/').pop()}
                    </Typography>
                  </Box>
                )}

                <Box
                  sx={{
                    border: `1px dashed ${alpha(theme.palette.secondary.main, 0.5)}`,
                    borderRadius: 2,
                    p: 2,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '100px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      backgroundColor: alpha(theme.palette.secondary.main, 0.05),
                      borderColor: theme.palette.secondary.main
                    }
                  }}
                  component="label"
                >
                  <input
                    type="file"
                    name="answerFile"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                    accept=".pdf,.doc,.docx"
                  />
                  <UploadIcon
                    sx={{
                      fontSize: 40,
                      color: answerFile ? theme.palette.success.main : alpha(theme.palette.text.primary, 0.5),
                      mb: 1
                    }}
                  />
                  <Typography variant="body1" align="center" gutterBottom>
                    {answerFile ? answerFile.name : 'Click to upload new answer file'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" align="center">
                    PDF or Word document (.pdf, .doc, .docx)
                  </Typography>
                </Box>
              </Paper>
            </Grid>

            <Grid item xs={12}>
              <Divider sx={{ my: 1 }} />
            </Grid>

            {/* Lock Exam */}
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={Boolean(examData.isLocked)}
                    onChange={handleChange}
                    name="isLocked"
                    color="primary"
                  />
                }
                label="Lock exam (students cannot access until unlocked)"
              />
            </Grid>

            <Grid item xs={12}>
              <Divider sx={{ my: 1 }} />
            </Grid>

            {/* Selective Answering Options */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Advanced Options
              </Typography>
            </Grid>

            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={Boolean(examData.allowSelectiveAnswering)}
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
          </Grid>
        </Box>
      </Paper>

      {/* Confirm Delete Dialog */}
      <Dialog
        open={confirmDialogOpen}
        onClose={handleCloseConfirmDialog}
        maxWidth="sm"
        PaperProps={{
          sx: {
            borderRadius: 3,
            p: 1
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 'bold' }}>
          Confirm Delete
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1">
            Are you sure you want to delete this exam? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={handleCloseConfirmDialog}
            variant="outlined"
            sx={{ borderRadius: 2 }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDeleteExam}
            variant="contained"
            color="error"
            sx={{ borderRadius: 2 }}
          >
            Delete Exam
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default EditExam;
