import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Button,
  Grid,
  Divider,
  Chip,
  CircularProgress,
  Alert,
  useTheme,
  alpha,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Avatar,
  AvatarGroup,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  Schedule as ScheduleIcon,
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
  AccessTime as AccessTimeIcon,
  Description as DescriptionIcon,
  Person as PersonIcon,
  Group as GroupIcon,
  Download as DownloadIcon,
  Close as CloseIcon,
  PersonAdd as PersonAddIcon,
  CheckBox as CheckBoxIcon
} from '@mui/icons-material';
import { getExamById } from '../../../services/examService';
import { getAllStudents } from '../../../services/adminService';
import ResetExamQuestions from '../ResetExamQuestions';

// TabPanel component for tabs
function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`exam-tabpanel-${index}`}
      aria-labelledby={`exam-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const ViewExam = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { id } = useParams();

  // State
  const [exam, setExam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tabValue, setTabValue] = useState(0);
  const [students, setStudents] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Fetch exam data
  useEffect(() => {
    const fetchExamData = async () => {
      try {
        setLoading(true);
        console.log('Fetching exam with ID:', id);
        const examData = await getExamById(id);
        console.log('Exam data received:', examData);
        setExam(examData);

        // Fetch students data
        const studentsData = await getAllStudents();
        setStudents(studentsData);
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

  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'Not scheduled';

    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Open dialog
  const handleOpenDialog = () => {
    setDialogOpen(true);
  };

  // Close dialog
  const handleCloseDialog = () => {
    setDialogOpen(false);
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

  if (!exam) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">Exam not found</Alert>
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

  // Get assigned students
  const assignedStudents = students.filter(student =>
    exam.assignedTo && exam.assignedTo.includes(student._id)
  );

  return (
    <Box>
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
            onClick={() => navigate('/admin/exams')}
            sx={{ mb: 1 }}
          >
            Back to Exams
          </Button>
          <Typography variant="h4" component="h1" fontWeight="bold">
            {exam.title}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
            <Chip
              icon={exam.isLocked ? <LockIcon /> : <LockOpenIcon />}
              label={exam.isLocked ? 'Locked' : 'Unlocked'}
              color={exam.isLocked ? 'error' : 'success'}
              size="small"
              sx={{ mr: 1 }}
            />
            <Typography variant="body2" color="text.secondary">
              Created on {formatDate(exam.createdAt)}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={() => navigate(`/admin/exams/${id}/edit`)}
            sx={{ borderRadius: 2 }}
          >
            Edit Exam
          </Button>
          <Button
            variant="outlined"
            startIcon={<CheckBoxIcon />}
            onClick={() => navigate(`/admin/exams/${id}/enable-selective-answering`)}
            sx={{
              borderRadius: 2,
              borderColor: exam.allowSelectiveAnswering ? 'success.main' : undefined,
              color: exam.allowSelectiveAnswering ? 'success.main' : undefined,
            }}
          >
            {exam.allowSelectiveAnswering ? 'Selective Answering Enabled' : 'Enable Selective Answering'}
          </Button>
          <Button
            variant="contained"
            startIcon={<ScheduleIcon />}
            onClick={() => navigate(`/admin/exams/schedule?examId=${id}`)}
            sx={{
              borderRadius: 2,
              boxShadow: `0 4px 14px ${alpha(theme.palette.primary.main, 0.3)}`
            }}
          >
            Schedule Exam
          </Button>
        </Box>
      </Box>

      {/* Tabs */}
      <Paper
        elevation={0}
        sx={{
          borderRadius: 3,
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          overflow: 'hidden',
          mb: 3
        }}
      >
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          sx={{
            borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            '& .MuiTab-root': {
              py: 2,
              px: { xs: 2, sm: 3 }
            }
          }}
        >
          <Tab label="Overview" />
          <Tab label="Students" />
          <Tab label="Questions" />
        </Tabs>

        {/* Overview Tab */}
        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={8}>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                Exam Details
              </Typography>
              <Typography variant="body1" paragraph>
                {exam.description}
              </Typography>

              <Grid container spacing={3} sx={{ mt: 2 }}>
                <Grid item xs={12} sm={6} md={4}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                      height: '100%'
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <AccessTimeIcon color="primary" sx={{ mr: 1 }} />
                      <Typography variant="subtitle1" fontWeight="bold">
                        Time Limit
                      </Typography>
                    </Box>
                    <Typography variant="h5" fontWeight="medium">
                      {exam.timeLimit} min
                    </Typography>
                  </Paper>
                </Grid>

                <Grid item xs={12} sm={6} md={4}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                      height: '100%'
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <GroupIcon color="primary" sx={{ mr: 1 }} />
                      <Typography variant="subtitle1" fontWeight="bold">
                        Assigned Students
                      </Typography>
                    </Box>
                    <Typography variant="h5" fontWeight="medium">
                      {assignedStudents.length}
                    </Typography>
                  </Paper>
                </Grid>

                <Grid item xs={12} sm={6} md={4}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                      height: '100%'
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <ScheduleIcon color="primary" sx={{ mr: 1 }} />
                      <Typography variant="subtitle1" fontWeight="bold">
                        Scheduled For
                      </Typography>
                    </Box>
                    <Typography variant="body1">
                      {exam.scheduledFor ? formatDate(exam.scheduledFor) : 'Not scheduled yet'}
                    </Typography>
                  </Paper>
                </Grid>

                {/* Selective Answering Info */}
                <Grid item xs={12} sm={6} md={4}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                      height: '100%',
                      bgcolor: exam.allowSelectiveAnswering ? alpha(theme.palette.success.main, 0.05) : undefined,
                      borderLeft: exam.allowSelectiveAnswering ? `4px solid ${theme.palette.success.main}` : undefined
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <CheckBoxIcon
                        color={exam.allowSelectiveAnswering ? "success" : "disabled"}
                        sx={{ mr: 1 }}
                      />
                      <Typography variant="subtitle1" fontWeight="bold">
                        Selective Answering
                      </Typography>
                    </Box>
                    {exam.allowSelectiveAnswering ? (
                      <>
                        <Typography variant="body2" sx={{ mb: 1 }}>
                          <strong>Enabled</strong> - Students can choose which questions to answer
                        </Typography>
                        <Box component="ul" sx={{ pl: 2, mt: 1, mb: 0 }}>
                          <Box component="li">
                            <Typography variant="body2">
                              Section B: {exam.sectionBRequiredQuestions || 3} required questions
                            </Typography>
                          </Box>
                          <Box component="li">
                            <Typography variant="body2">
                              Section C: {exam.sectionCRequiredQuestions || 1} required questions
                            </Typography>
                          </Box>
                        </Box>
                      </>
                    ) : (
                      <Typography variant="body2">
                        <strong>Disabled</strong> - Students must answer all questions
                      </Typography>
                    )}
                  </Paper>
                </Grid>
              </Grid>
            </Grid>

            <Grid item xs={12} md={4}>
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  borderRadius: 2,
                  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                  height: '100%'
                }}
              >
                <Typography variant="h6" fontWeight="bold" gutterBottom>
                  Files
                </Typography>

                <List>
                  {exam.originalFile && (
                    <ListItem
                      button
                      onClick={handleOpenDialog}
                      sx={{
                        borderRadius: 2,
                        mb: 1,
                        '&:hover': {
                          backgroundColor: alpha(theme.palette.primary.main, 0.05)
                        }
                      }}
                    >
                      <ListItemIcon>
                        <DescriptionIcon color="primary" />
                      </ListItemIcon>
                      <ListItemText
                        primary="Exam File"
                        secondary="View or download the exam file"
                      />
                      <DownloadIcon fontSize="small" color="action" />
                    </ListItem>
                  )}

                  {exam.answerFile && (
                    <ListItem
                      button
                      onClick={handleOpenDialog}
                      sx={{
                        borderRadius: 2,
                        '&:hover': {
                          backgroundColor: alpha(theme.palette.primary.main, 0.05)
                        }
                      }}
                    >
                      <ListItemIcon>
                        <DescriptionIcon color="secondary" />
                      </ListItemIcon>
                      <ListItemText
                        primary="Answer File"
                        secondary="View or download the answer file"
                      />
                      <DownloadIcon fontSize="small" color="action" />
                    </ListItem>
                  )}

                  {!exam.originalFile && !exam.answerFile && (
                    <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                      No files uploaded for this exam
                    </Typography>
                  )}
                </List>
              </Paper>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Students Tab */}
        <TabPanel value={tabValue} index={1}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
            <Typography variant="h6" fontWeight="bold">
              Assigned Students ({assignedStudents.length})
            </Typography>
            <Button
              variant="outlined"
              startIcon={<PersonAddIcon />}
              onClick={() => navigate(`/admin/exams/${id}/assign-students`)}
              sx={{ borderRadius: 2 }}
            >
              Assign Students
            </Button>
          </Box>

          {assignedStudents.length === 0 ? (
            <Alert severity="info">
              No students assigned to this exam yet. Click "Assign Students" to add students.
            </Alert>
          ) : (
            <Grid container spacing={2}>
              {assignedStudents.map(student => (
                <Grid item xs={12} sm={6} md={4} key={student._id}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                      '&:hover': {
                        boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.1)}`
                      }
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Avatar sx={{ bgcolor: theme.palette.primary.main, mr: 2 }}>
                        {student.firstName[0]}{student.lastName[0]}
                      </Avatar>
                      <Box>
                        <Typography variant="subtitle1" fontWeight="medium">
                          {student.firstName} {student.lastName}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {student.email}
                        </Typography>
                      </Box>
                    </Box>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          )}
        </TabPanel>

        {/* Questions Tab */}
        <TabPanel value={tabValue} index={2}>
          <Typography variant="h6" fontWeight="bold" gutterBottom>
            Exam Questions
          </Typography>

          <Alert severity="info" sx={{ mb: 3 }}>
            Questions will be displayed here once they are extracted from the exam file or added manually.
          </Alert>

          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Button
                variant="outlined"
                startIcon={<EditIcon />}
                onClick={() => navigate(`/admin/exams/${id}/questions`)}
                sx={{ borderRadius: 2, mb: 3 }}
              >
                Manage Questions
              </Button>

              {/* Display sections and questions */}
              {exam.sections && exam.sections.length > 0 ? (
                <Box sx={{ mt: 2 }}>
                  {exam.sections.map((section, index) => (
                    <Paper
                      key={index}
                      elevation={0}
                      sx={{
                        p: 2,
                        mb: 2,
                        borderRadius: 2,
                        border: `1px solid ${alpha(theme.palette.divider, 0.1)}`
                      }}
                    >
                      <Typography variant="subtitle1" fontWeight="bold" color="primary">
                        Section {section.name}: {section.description}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {section.questions?.length || 0} questions
                      </Typography>
                    </Paper>
                  ))}
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No sections or questions found for this exam.
                </Typography>
              )}
            </Grid>

            <Grid item xs={12} md={6}>
              {/* Add the Reset Questions component */}
              <ResetExamQuestions
                examId={id}
                onSuccess={(updatedExam) => {
                  setExam(updatedExam);
                  console.log('Exam questions reset successfully');
                }}
              />
            </Grid>
          </Grid>
        </TabPanel>
      </Paper>

      {/* File Preview Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">File Preview</Typography>
            <IconButton onClick={handleCloseDialog} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            File preview is not available. Please download the file to view its contents.
          </Alert>
          <Box sx={{ height: '400px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <DescriptionIcon sx={{ fontSize: 100, color: alpha(theme.palette.text.primary, 0.1) }} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Close</Button>
          <Button
            variant="contained"
            startIcon={<DownloadIcon />}
            onClick={handleCloseDialog}
          >
            Download
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ViewExam;
