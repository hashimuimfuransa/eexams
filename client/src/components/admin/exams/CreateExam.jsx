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
  FormHelperText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Select,
  MenuItem
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Add as AddIcon,
  Upload as UploadIcon,
  Description as DescriptionIcon,
  ExpandMore as ExpandMoreIcon,
  Visibility as VisibilityIcon,
  Delete as DeleteIcon,
  RadioButtonChecked,
  CheckBox,
  ShortText,
  FormatListNumbered
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
  const [questionImages, setQuestionImages] = useState([]);

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
    answerFile: '',
    questionImages: ''
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
    { type: 'open-ended', label: 'Open Ended', icon: <FormatListNumbered sx={{ fontSize: 14 }} />, color: '#EC4899' },
    { type: 'image', label: 'Image Based', icon: <DescriptionIcon sx={{ fontSize: 14 }} />, color: '#10B981' }
  ];

  // Preview modal state
  const [previewModalOpen, setPreviewModalOpen] = useState(false);

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
    correctAnswer: '',
    image: null,
    imageUrl: ''
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
      } else if (name === 'questionImages') {
        setQuestionImages(Array.from(files));
        setErrors({
          ...errors,
          questionImages: ''
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

      if (questionImages.length > 0) {
        questionImages.forEach((image, index) => {
          formData.append(`questionImages[${index}]`, image);
        });
      }

      // Call API to create exam
      const result = await createExam(formData);

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

  // Open preview modal
  const handleOpenPreview = () => {
    setPreviewModalOpen(true);
  };

  // Close preview modal
  const handleClosePreview = () => {
    setPreviewModalOpen(false);
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
      correctAnswer: '',
      image: null,
      imageUrl: ''
    });
    setAddQuestionDialogOpen(true);
  };

  // Close add question dialog
  const handleCloseAddQuestion = () => {
    setAddQuestionDialogOpen(false);
    setSelectedSection(null);
  };

  // Handle image upload
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewQuestion({
          ...newQuestion,
          image: file,
          imageUrl: reader.result
        });
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle image removal
  const handleRemoveImage = () => {
    setNewQuestion({
      ...newQuestion,
      image: null,
      imageUrl: ''
    });
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
    } else if (type === 'image') {
      setNewQuestion({
        ...newQuestion,
        type,
        options: [],
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
    if (!newQuestion.text.trim() && !newQuestion.image) {
      setSnackbar({
        open: true,
        message: 'Question text or image is required',
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

    // Remove options array for question types that don't use it
    if (newQuestion.type === 'image' || newQuestion.type === 'open-ended' || 
        newQuestion.type === 'short-answer' || newQuestion.type === 'fill-blank') {
      delete questionToAdd.options;
    }

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

            {/* Question Images Upload */}
            <Grid item xs={12}>
              <FormControl fullWidth error={!!errors.questionImages}>
                <InputLabel htmlFor="question-images" shrink>
                  Question Images (for image-based questions) - Optional
                </InputLabel>
                <Box
                  sx={{
                    border: `1px solid ${errors.questionImages ? theme.palette.error.main : alpha(theme.palette.divider, 0.5)}`,
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
                  htmlFor="question-images"
                >
                  <input
                    id="question-images"
                    name="questionImages"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />
                  <UploadIcon
                    sx={{
                      fontSize: 40,
                      color: questionImages.length > 0 ? theme.palette.success.main : alpha(theme.palette.text.primary, 0.5),
                      mb: 1
                    }}
                  />
                  <Typography variant="body1" align="center" gutterBottom>
                    {questionImages.length > 0 
                      ? `${questionImages.length} image(s) selected` 
                      : 'Click to upload question images'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" align="center">
                    JPEG, PNG, GIF, WebP (max 10 images, 10MB each)
                  </Typography>
                </Box>
                {errors.questionImages && (
                  <FormHelperText error>{errors.questionImages}</FormHelperText>
                )}
                {questionImages.length > 0 && (
                  <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {questionImages.map((file, index) => (
                      <Chip
                        key={index}
                        label={file.name}
                        size="small"
                        onDelete={() => {
                          const newImages = questionImages.filter((_, i) => i !== index);
                          setQuestionImages(newImages);
                        }}
                      />
                    ))}
                  </Box>
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

      {/* Questions Section with Preview */}
      <Paper
        elevation={0}
        sx={{
          borderRadius: { xs: 3, md: 4 },
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          overflow: 'hidden',
          p: { xs: 2, md: 3 },
          mb: 4
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h6" fontWeight="medium" gutterBottom>
              Questions
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Preview and manage exam questions by section
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<VisibilityIcon />}
            onClick={handleOpenPreview}
            sx={{
              borderRadius: 3,
              px: 3,
              py: 1
            }}
          >
            Preview & Edit Questions
          </Button>
        </Box>

        {/* Summary of questions */}
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          {sections.map(section => (
            <Chip
              key={section.id}
              label={`Section ${section.name}: ${section.questions?.length || 0} questions`}
              color="primary"
              variant="outlined"
              size="medium"
            />
          ))}
        </Box>
      </Paper>

      {/* Exam Preview Modal */}
      <Dialog
        open={previewModalOpen}
        onClose={handleClosePreview}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            maxHeight: '90vh'
          }
        }}
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" fontWeight="bold">
              Exam Preview - {examData.title || 'Untitled Exam'}
            </Typography>
            <Button onClick={handleClosePreview} size="small">
              Close
            </Button>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pb: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Manage questions for each section. Click "Add Question" to add new questions to a section.
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
                                  backgroundColor: alpha(questionTypes.find(qt => qt.type === question.type)?.color || '#999', 0.1),
                                  color: questionTypes.find(qt => qt.type === question.type)?.color || '#999'
                                }}
                              />
                              <Typography variant="caption" color="text.secondary">
                                {question.points} points
                              </Typography>
                            </Box>
                            <Typography variant="body1" gutterBottom>
                              <strong>Q{qIndex + 1}:</strong> {question.text}
                            </Typography>

                            {question.imageUrl && (
                              <Box
                                component="img"
                                src={question.imageUrl}
                                alt="Question image"
                                sx={{ maxWidth: 200, maxHeight: 150, borderRadius: 1, mt: 1, objectFit: 'contain' }}
                              />
                            )}

                            {question.options && question.options.length > 0 && (
                              <Box sx={{ mt: 2, ml: 2 }}>
                                {question.options.map((option, oIndex) => (
                                  <Typography
                                    key={oIndex}
                                    variant="body2"
                                    sx={{
                                      color: option.isCorrect ? 'success.main' : 'text.primary',
                                      fontWeight: option.isCorrect ? 'bold' : 'normal'
                                    }}
                                  >
                                    {option.letter}. {option.text || '(empty)'} {option.isCorrect && '✓'}
                                  </Typography>
                                ))}
                              </Box>
                            )}
                          </Box>
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteQuestion(section.id, question.id)}
                            sx={{ ml: 1, color: 'error.main' }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </Paper>
                    ))}
                  </Box>
                ) : (
                  <Alert severity="info" sx={{ mt: 2 }}>
                    No questions in this section yet. Click "Add Question" to add questions.
                  </Alert>
                )}
              </AccordionDetails>
            </Accordion>
          ))}
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button onClick={handleClosePreview}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Add Question Dialog */}
      <Dialog
        open={addQuestionDialogOpen}
        onClose={handleCloseAddQuestion}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3
          }
        }}
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" fontWeight="bold">
              Add Question to Section {selectedSection}
            </Typography>
            <Button onClick={handleCloseAddQuestion} size="small">
              Cancel
            </Button>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pb: 2 }}>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            {/* Question Type */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                Question Type
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                {questionTypes.map(qt => (
                  <Button
                    key={qt.type}
                    variant={newQuestion.type === qt.type ? 'contained' : 'outlined'}
                    size="small"
                    onClick={() => handleQuestionTypeChange(qt.type)}
                    sx={{
                      borderRadius: 2,
                      borderColor: qt.color,
                      backgroundColor: newQuestion.type === qt.type ? qt.color : 'transparent',
                      color: newQuestion.type === qt.type ? '#fff' : qt.color
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {qt.icon}
                      {qt.label}
                    </Box>
                  </Button>
                ))}
              </Box>
            </Grid>

            {/* Question Text */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Question Text"
                value={newQuestion.text}
                onChange={(e) => setNewQuestion({ ...newQuestion, text: e.target.value })}
                multiline
                rows={3}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />
            </Grid>

            {/* Image Upload */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                Question Image (Optional)
              </Typography>
              {newQuestion.imageUrl ? (
                <Box sx={{ position: 'relative', width: '100%', maxWidth: 400 }}>
                  <Box
                    component="img"
                    src={newQuestion.imageUrl}
                    alt="Question image"
                    sx={{ width: '100%', borderRadius: 2, maxHeight: 300, objectFit: 'contain' }}
                  />
                  <Button
                    size="small"
                    variant="contained"
                    color="error"
                    onClick={handleRemoveImage}
                    sx={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      borderRadius: 2,
                      minWidth: 'auto',
                      px: 1
                    }}
                  >
                    <DeleteIcon fontSize="small" />
                  </Button>
                </Box>
              ) : (
                <Box
                  sx={{
                    border: `1px dashed ${alpha(theme.palette.divider, 0.5)}`,
                    borderRadius: 2,
                    p: 3,
                    textAlign: 'center',
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
                    accept="image/*"
                    onChange={handleImageUpload}
                    style={{ display: 'none' }}
                  />
                  <UploadIcon
                    sx={{
                      fontSize: 32,
                      color: alpha(theme.palette.text.primary, 0.5),
                      mb: 1
                    }}
                  />
                  <Typography variant="body2" color="text.secondary">
                    Click to upload image
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    PNG, JPG, GIF up to 10MB
                  </Typography>
                </Box>
              )}
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
                <Typography variant="subtitle2" gutterBottom sx={{ mt: 1 }}>
                  Answer Options (click to select correct answer)
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {newQuestion.options.map((option, index) => (
                    <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip
                        label={option.letter}
                        size="small"
                        sx={{ minWidth: 40, justifyContent: 'center' }}
                      />
                      <TextField
                        fullWidth
                        size="small"
                        value={option.text}
                        onChange={(e) => handleOptionChange(index, e.target.value)}
                        placeholder={`Option ${option.letter}`}
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                      />
                      <Button
                        size="small"
                        variant={option.isCorrect ? 'contained' : 'outlined'}
                        color={option.isCorrect ? 'success' : 'primary'}
                        onClick={() => handleCorrectAnswerChange(index)}
                        sx={{ minWidth: 80, borderRadius: 2 }}
                      >
                        {option.isCorrect ? 'Correct' : 'Mark Correct'}
                      </Button>
                      {newQuestion.type === 'multiple-choice' && newQuestion.options.length > 2 && (
                        <IconButton
                          size="small"
                          onClick={() => handleRemoveOption(index)}
                          sx={{ color: 'error.main' }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      )}
                    </Box>
                  ))}
                  {newQuestion.type === 'multiple-choice' && newQuestion.options.length < 6 && (
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={handleAddOption}
                      startIcon={<AddIcon />}
                      sx={{ borderRadius: 2, mt: 1, alignSelf: 'flex-start' }}
                    >
                      Add Option
                    </Button>
                  )}
                </Box>
              </Grid>
            )}

            {/* Correct answer for fill-blank and open-ended */}
            {(newQuestion.type === 'fill-blank' || newQuestion.type === 'open-ended') && (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Correct Answer"
                  value={newQuestion.correctAnswer}
                  onChange={(e) => setNewQuestion({ ...newQuestion, correctAnswer: e.target.value })}
                  multiline
                  rows={2}
                  helperText="Provide the correct answer for grading"
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button onClick={handleCloseAddQuestion}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleAddQuestion}
            sx={{ borderRadius: 2 }}
          >
            Add Question
          </Button>
        </DialogActions>
      </Dialog>

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
