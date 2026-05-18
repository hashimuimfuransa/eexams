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
  DialogActions,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Checkbox
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Delete as DeleteIcon,
  Close as CloseIcon,
  Upload as UploadIcon,
  Description as DescriptionIcon,
  Add as AddIcon,
  ExpandMore as ExpandMoreIcon,
  RadioButtonChecked,
  CheckBox,
  ShortText,
  FormatListNumbered
} from '@mui/icons-material';
import { getExamById as getExamByIdService, updateExam } from '../../../services/examService';
import { getExamById as getAdminExamById } from '../../../services/adminService';

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

  // Sections and Questions state
  const [sections, setSections] = useState([
    { id: 'A', name: 'A', description: 'Section A - All questions required', questions: [] },
    { id: 'B', name: 'B', description: 'Section B - Selective answering', questions: [] },
    { id: 'C', name: 'C', description: 'Section C - Selective answering', questions: [] }
  ]);

  // Question types configuration
  const questionTypes = [
    { type: 'multiple-choice', label: 'Multiple Choice', icon: <RadioButtonChecked sx={{ fontSize: 14 }} />, color: '#3B82F6' },
    { type: 'true-false', label: 'True / False', icon: <CheckBox sx={{ fontSize: 14 }} />, color: '#8B5CF6' },
    { type: 'fill-blank', label: 'Fill in the Blank', icon: <ShortText sx={{ fontSize: 14 }} />, color: '#F59E0B' },
    { type: 'open-ended', label: 'Open Ended', icon: <FormatListNumbered sx={{ fontSize: 14 }} />, color: '#EC4899' }
  ];

  // Add question dialog state
  const [addQuestionDialogOpen, setAddQuestionDialogOpen] = useState(false);
  const [selectedSection, setSelectedSection] = useState(null);
  const [newQuestion, setNewQuestion] = useState({
    text: '',
    type: 'multiple-choice',
    points: 2,
    options: [
      { text: '', isCorrect: false, letter: 'A' },
      { text: '', isCorrect: false, letter: 'B' },
      { text: '', isCorrect: false, letter: 'C' },
      { text: '', isCorrect: false, letter: 'D' }
    ],
    correctAnswer: ''
  });

  // Fetch exam data
  useEffect(() => {
    const fetchExamData = async () => {
      try {
        setLoading(true);
        console.log('Fetching exam with ID for editing:', id);
        // Try admin endpoint first (for teachers/admins), fall back to exam endpoint
        let data;
        try {
          data = await getAdminExamById(id);
          console.log('Exam data received from admin endpoint for editing:', data);
        } catch (adminError) {
          console.log('Admin endpoint failed, trying exam endpoint:', adminError);
          data = await getExamByIdService(id);
          console.log('Exam data received from exam endpoint for editing:', data);
        }

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

        // Load existing sections and questions
        if (data.sections && data.sections.length > 0) {
          setSections(data.sections);
        }
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
      formData.append('sections', JSON.stringify(sections));

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

  // Open add question dialog
  const handleOpenAddQuestion = (sectionId) => {
    setSelectedSection(sectionId);
    setNewQuestion({
      text: '',
      type: 'multiple-choice',
      points: 2,
      options: [
        { text: '', isCorrect: false, letter: 'A' },
        { text: '', isCorrect: false, letter: 'B' },
        { text: '', isCorrect: false, letter: 'C' },
        { text: '', isCorrect: false, letter: 'D' }
      ],
      correctAnswer: ''
    });
    setAddQuestionDialogOpen(true);
  };

  // Close add question dialog
  const handleCloseAddQuestion = () => {
    setAddQuestionDialogOpen(false);
    setSelectedSection(null);
  };

  // Handle question type change
  const handleQuestionTypeChange = (type) => {
    if (type === 'true-false') {
      setNewQuestion({
        ...newQuestion,
        type,
        options: [
          { text: 'True', isCorrect: false, letter: 'A' },
          { text: 'False', isCorrect: false, letter: 'B' }
        ],
        correctAnswer: ''
      });
    } else if (type === 'multiple-choice') {
      setNewQuestion({
        ...newQuestion,
        type,
        options: [
          { text: '', isCorrect: false, letter: 'A' },
          { text: '', isCorrect: false, letter: 'B' },
          { text: '', isCorrect: false, letter: 'C' },
          { text: '', isCorrect: false, letter: 'D' }
        ],
        correctAnswer: ''
      });
    } else {
      setNewQuestion({
        ...newQuestion,
        type,
        options: [],
        correctAnswer: ''
      });
    }
  };

  // Handle option change
  const handleOptionChange = (index, value) => {
    const updatedOptions = [...newQuestion.options];
    updatedOptions[index] = { ...updatedOptions[index], text: value };
    setNewQuestion({ ...newQuestion, options: updatedOptions });
  };

  // Handle correct answer selection
  const handleCorrectAnswerChange = (index) => {
    const updatedOptions = newQuestion.options.map((opt, i) => ({
      ...opt,
      isCorrect: i === index
    }));
    setNewQuestion({ ...newQuestion, options: updatedOptions });
  };

  // Add new option
  const handleAddOption = () => {
    const nextLetter = String.fromCharCode(65 + newQuestion.options.length);
    setNewQuestion({
      ...newQuestion,
      options: [...newQuestion.options, { text: '', isCorrect: false, letter: nextLetter }]
    });
  };

  // Remove option
  const handleRemoveOption = (index) => {
    const updatedOptions = newQuestion.options.filter((_, i) => i !== index);
    // Reassign letters
    const reassignedOptions = updatedOptions.map((opt, i) => ({
      ...opt,
      letter: String.fromCharCode(65 + i)
    }));
    setNewQuestion({ ...newQuestion, options: reassignedOptions });
  };

  // Add question to section
  const handleAddQuestion = () => {
    if (!newQuestion.text.trim()) {
      setSnackbar({
        open: true,
        message: 'Question text is required',
        severity: 'error'
      });
      return;
    }

    // For multiple-choice and true-false, ensure a correct answer is selected
    if (newQuestion.type === 'multiple-choice' || newQuestion.type === 'true-false') {
      const hasCorrectAnswer = newQuestion.options.some(opt => opt.isCorrect);
      if (!hasCorrectAnswer) {
        setSnackbar({
          open: true,
          message: 'Please select the correct answer',
          severity: 'error'
        });
        return;
      }
    }

    const questionToAdd = {
      ...newQuestion,
      id: Date.now().toString(),
      section: selectedSection
    };

    setSections(prevSections =>
      prevSections.map(section =>
        section.id === selectedSection
          ? { ...section, questions: [...section.questions, questionToAdd] }
          : section
      )
    );

    setAddQuestionDialogOpen(false);
    setSnackbar({
      open: true,
      message: 'Question added successfully',
      severity: 'success'
    });
  };

  // Delete question
  const handleDeleteQuestion = (sectionId, questionId) => {
    setSections(prevSections =>
      prevSections.map(section =>
        section.id === sectionId
          ? { ...section, questions: section.questions.filter(q => q.id !== questionId) }
          : section
      )
    );
  };

  // Update question
  const handleUpdateQuestion = (sectionId, questionId, updatedQuestion) => {
    setSections(prevSections =>
      prevSections.map(section =>
        section.id === sectionId
          ? {
              ...section,
              questions: section.questions.map(q =>
                q.id === questionId ? { ...q, ...updatedQuestion } : q
              )
            }
          : section
      )
    );
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

      {/* Questions and Sections Management */}
      <Paper
        elevation={0}
        sx={{
          borderRadius: 3,
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          overflow: 'hidden',
          mb: 3
        }}
      >
        <Box sx={{ p: 3 }}>
          <Typography variant="h6" fontWeight="bold" gutterBottom>
            Questions by Section
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Add and manage questions for each section. Different question types can be added to different sections.
          </Typography>

          {sections.map((section, sectionIndex) => (
            <Accordion
              key={section.id}
              defaultExpanded={sectionIndex === 0}
              sx={{
                mb: 2,
                borderRadius: 2,
                '&:before': { display: 'none' },
                boxShadow: `0 1px 3px ${alpha(theme.palette.divider, 0.1)}`
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                sx={{
                  backgroundColor: alpha(theme.palette.primary.main, 0.05),
                  '&:hover': {
                    backgroundColor: alpha(theme.palette.primary.main, 0.1)
                  }
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', mr: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Typography variant="subtitle1" fontWeight="bold" sx={{ mr: 2 }}>
                      Section {section.name}
                    </Typography>
                    <Chip
                      label={`${section.questions?.length || 0} questions`}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                  </Box>
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenAddQuestion(section.id);
                    }}
                    sx={{ borderRadius: 2 }}
                  >
                    Add Question
                  </Button>
                </Box>
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {section.description}
                </Typography>

                {section.questions && section.questions.length > 0 ? (
                  <Box>
                    {section.questions.map((question, qIndex) => (
                      <Paper
                        key={question.id || qIndex}
                        elevation={0}
                        sx={{
                          p: 2,
                          mb: 2,
                          borderRadius: 2,
                          border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
                          backgroundColor: alpha(theme.palette.background.default, 0.5)
                        }}
                      >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                          <Box sx={{ flex: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                              <Chip
                                label={questionTypes.find(qt => qt.type === question.type)?.label || question.type}
                                size="small"
                                sx={{
                                  mr: 1,
                                  backgroundColor: questionTypes.find(qt => qt.type === question.type)?.color || '#757575',
                                  color: 'white'
                                }}
                              />
                              <Chip
                                label={`${question.points || 2} pts`}
                                size="small"
                                variant="outlined"
                              />
                            </Box>
                            <Typography variant="body1" fontWeight="medium">
                              {qIndex + 1}. {question.text}
                            </Typography>
                          </Box>
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteQuestion(section.id, question.id)}
                            color="error"
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Box>

                        {/* Display options for multiple-choice and true-false */}
                        {(question.type === 'multiple-choice' || question.type === 'true-false') && question.options && (
                          <Box sx={{ ml: 2, mt: 1 }}>
                            {question.options.map((option, optIndex) => (
                              <Box
                                key={optIndex}
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  py: 0.5,
                                  color: option.isCorrect ? 'success.main' : 'text.secondary'
                                }}
                              >
                                {option.isCorrect && <CheckBox sx={{ fontSize: 16, mr: 1 }} />}
                                {!option.isCorrect && <RadioButtonChecked sx={{ fontSize: 16, mr: 1 }} />}
                                <Typography variant="body2">
                                  {option.letter}. {option.text}
                                </Typography>
                              </Box>
                            ))}
                          </Box>
                        )}

                        {/* Display correct answer for other types */}
                        {question.type !== 'multiple-choice' && question.type !== 'true-false' && question.correctAnswer && (
                          <Box sx={{ ml: 2, mt: 1 }}>
                            <Typography variant="body2" color="text.secondary">
                              <strong>Answer:</strong> {question.correctAnswer}
                            </Typography>
                          </Box>
                        )}
                      </Paper>
                    ))}
                  </Box>
                ) : (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    No questions in this section yet. Click "Add Question" to add questions.
                  </Alert>
                )}
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      </Paper>

      {/* Add Question Dialog */}
      <Dialog
        open={addQuestionDialogOpen}
        onClose={handleCloseAddQuestion}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 3 }
        }}
      >
        <DialogTitle>
          <Typography variant="h6" fontWeight="bold">
            Add Question to Section {selectedSection}
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Grid container spacing={2}>
            {/* Question Type */}
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Question Type</InputLabel>
                <Select
                  value={newQuestion.type}
                  label="Question Type"
                  onChange={(e) => handleQuestionTypeChange(e.target.value)}
                >
                  {questionTypes.map(qt => (
                    <MenuItem key={qt.type} value={qt.type}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Box sx={{ mr: 1, color: qt.color }}>{qt.icon}</Box>
                        {qt.label}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Question Text */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Question Text"
                multiline
                rows={3}
                value={newQuestion.text}
                onChange={(e) => setNewQuestion({ ...newQuestion, text: e.target.value })}
                required
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />
            </Grid>

            {/* Points */}
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Points"
                type="number"
                value={newQuestion.points}
                onChange={(e) => setNewQuestion({ ...newQuestion, points: parseInt(e.target.value) || 0 })}
                InputProps={{ inputProps: { min: 1 } }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />
            </Grid>

            {/* Options for multiple-choice and true-false */}
            {(newQuestion.type === 'multiple-choice' || newQuestion.type === 'true-false') && (
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>
                  Answer Options (select the correct one)
                </Typography>
                {newQuestion.options.map((option, index) => (
                  <Box key={index} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={option.isCorrect}
                          onChange={() => handleCorrectAnswerChange(index)}
                          color="success"
                        />
                      }
                      label=""
                    />
                    <TextField
                      fullWidth
                      size="small"
                      value={option.text}
                      onChange={(e) => handleOptionChange(index, e.target.value)}
                      placeholder={`Option ${option.letter}`}
                      sx={{ mr: 1, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                    />
                    {newQuestion.type === 'multiple-choice' && newQuestion.options.length > 2 && (
                      <IconButton
                        size="small"
                        onClick={() => handleRemoveOption(index)}
                        color="error"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    )}
                  </Box>
                ))}
                {newQuestion.type === 'multiple-choice' && newQuestion.options.length < 6 && (
                  <Button
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={handleAddOption}
                    sx={{ mt: 1 }}
                  >
                    Add Option
                  </Button>
                )}
              </Grid>
            )}

            {/* Correct answer for fill-blank and open-ended */}
            {(newQuestion.type === 'fill-blank' || newQuestion.type === 'open-ended') && (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Correct Answer / Model Answer"
                  multiline
                  rows={3}
                  value={newQuestion.correctAnswer}
                  onChange={(e) => setNewQuestion({ ...newQuestion, correctAnswer: e.target.value })}
                  helperText="Provide the correct answer or a model answer for open-ended questions"
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={handleCloseAddQuestion}
            variant="outlined"
            sx={{ borderRadius: 2 }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAddQuestion}
            variant="contained"
            sx={{ borderRadius: 2 }}
          >
            Add Question
          </Button>
        </DialogActions>
      </Dialog>

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
