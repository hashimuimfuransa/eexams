import React, { useState } from 'react';
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
  Chip,
  Card,
  CardContent,
  LinearProgress,
  Slider,
  FormControlLabel,
  Switch,
  Alert
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  AutoAwesome as AutoAwesomeIcon,
  Settings as SettingsIcon,
  Assignment as AssignmentIcon,
  Psychology as PsychologyIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const AIGrading = () => {
  const theme = useTheme();
  const navigate = useNavigate();

  // Available exams (in a real app, this would come from an API)
  const exams = [
    { id: '1', title: 'Biology Final Exam', status: 'completed', submissions: 45 },
    { id: '2', title: 'Chemistry Quiz', status: 'completed', submissions: 32 },
    { id: '3', title: 'Physics Midterm', status: 'completed', submissions: 38 },
    { id: '4', title: 'Mathematics Test', status: 'completed', submissions: 41 },
    { id: '5', title: 'English Literature Essay', status: 'completed', submissions: 29 }
  ];

  // Form state
  const [selectedExam, setSelectedExam] = useState('');
  const [aiSettings, setAiSettings] = useState({
    strictness: 70,
    enablePartialCredit: true,
    considerSpelling: false,
    considerGrammar: true
  });

  // Grading state
  const [isGrading, setIsGrading] = useState(false);
  const [gradingProgress, setGradingProgress] = useState(0);
  const [gradingComplete, setGradingComplete] = useState(false);

  // Handle exam selection
  const handleExamChange = (e) => {
    setSelectedExam(e.target.value);
    setGradingComplete(false);
  };

  // Handle AI settings change
  const handleSettingsChange = (name, value) => {
    setAiSettings({
      ...aiSettings,
      [name]: value
    });
  };

  // Handle switch change
  const handleSwitchChange = (e) => {
    const { name, checked } = e.target;
    setAiSettings({
      ...aiSettings,
      [name]: checked
    });
  };

  // Start grading process
  const handleStartGrading = () => {
    setIsGrading(true);
    setGradingProgress(0);
    setGradingComplete(false);

    // Simulate grading progress
    const interval = setInterval(() => {
      setGradingProgress((prevProgress) => {
        const newProgress = prevProgress + Math.random() * 10;
        if (newProgress >= 100) {
          clearInterval(interval);
          setIsGrading(false);
          setGradingComplete(true);
          return 100;
        }
        return newProgress;
      });
    }, 500);
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
            AI Grading
          </Typography>
          <Typography
            variant="subtitle1"
            color="text.secondary"
            sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}
          >
            Use AI to automatically grade open-ended questions
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

      {/* Main content */}
      <Grid container spacing={3}>
        {/* Left column - Exam selection and grading */}
        <Grid item xs={12} md={7}>
          <Paper
            elevation={0}
            sx={{
              borderRadius: { xs: 3, md: 4 },
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
              overflow: 'hidden',
              p: { xs: 2, md: 3 },
              mb: 3
            }}
          >
            <Typography variant="h6" fontWeight="medium" gutterBottom>
              Select Exam to Grade
            </Typography>
            <Divider sx={{ mb: 2 }} />

            <TextField
              fullWidth
              select
              label="Select Completed Exam"
              value={selectedExam}
              onChange={handleExamChange}
              sx={{
                mb: 3,
                '& .MuiOutlinedInput-root': { borderRadius: 2 }
              }}
            >
              {exams.map((exam) => (
                <MenuItem key={exam.id} value={exam.id}>
                  {exam.title} ({exam.submissions} submissions)
                </MenuItem>
              ))}
            </TextField>

            {selectedExam && (
              <>
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle1" fontWeight="medium" gutterBottom>
                    Grading Status
                  </Typography>

                  {isGrading ? (
                    <Box sx={{ width: '100%' }}>
                      <LinearProgress
                        variant="determinate"
                        value={gradingProgress}
                        sx={{
                          height: 10,
                          borderRadius: 5,
                          mb: 1
                        }}
                      />
                      <Typography variant="body2" color="text.secondary" align="center">
                        Grading in progress... {Math.round(gradingProgress)}%
                      </Typography>
                    </Box>
                  ) : gradingComplete ? (
                    <Alert
                      severity="success"
                      sx={{
                        borderRadius: 2,
                        boxShadow: `0 4px 12px ${alpha(theme.palette.success.main, 0.2)}`
                      }}
                    >
                      Grading completed successfully! You can now review the results.
                    </Alert>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      Click "Start AI Grading" to begin the automated grading process.
                    </Typography>
                  )}
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                  <Button
                    variant="contained"
                    color="primary"
                    size="large"
                    startIcon={<AutoAwesomeIcon />}
                    onClick={handleStartGrading}
                    disabled={isGrading || !selectedExam}
                    sx={{
                      borderRadius: 3,
                      px: 4,
                      py: 1.5,
                      boxShadow: `0 4px 14px ${alpha(theme.palette.primary.main, 0.3)}`,
                      width: { xs: '100%', sm: 'auto' }
                    }}
                  >
                    Start AI Grading
                  </Button>
                </Box>
              </>
            )}
          </Paper>

          {/* Results preview (only shown when grading is complete) */}
          {gradingComplete && (
            <Paper
              elevation={0}
              sx={{
                borderRadius: { xs: 3, md: 4 },
                border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                overflow: 'hidden',
                p: { xs: 2, md: 3 }
              }}
            >
              <Typography variant="h6" fontWeight="medium" gutterBottom>
                Grading Results Preview
              </Typography>
              <Divider sx={{ mb: 2 }} />

              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Card variant="outlined" sx={{ borderRadius: 2 }}>
                    <CardContent>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        Average Score
                      </Typography>
                      <Typography variant="h4" fontWeight="bold" color="primary.main">
                        78%
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Card variant="outlined" sx={{ borderRadius: 2 }}>
                    <CardContent>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        Completion Rate
                      </Typography>
                      <Typography variant="h4" fontWeight="bold" color="success.main">
                        100%
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
                <Button
                  variant="outlined"
                  color="primary"
                  startIcon={<AssignmentIcon />}
                  sx={{
                    borderRadius: 3,
                    px: 3,
                    py: 1
                  }}
                >
                  View Detailed Results
                </Button>
              </Box>
            </Paper>
          )}
        </Grid>

        {/* Right column - AI settings */}
        <Grid item xs={12} md={5}>
          <Paper
            elevation={0}
            sx={{
              borderRadius: { xs: 3, md: 4 },
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
              overflow: 'hidden',
              p: { xs: 2, md: 3 }
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <SettingsIcon sx={{ mr: 1, color: theme.palette.primary.main }} />
              <Typography variant="h6" fontWeight="medium">
                AI Grading Settings
              </Typography>
            </Box>
            <Divider sx={{ mb: 3 }} />

            <Box sx={{ mb: 4 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle2">
                  Grading Strictness
                </Typography>
                <Chip
                  label={`${aiSettings.strictness}%`}
                  size="small"
                  color={aiSettings.strictness > 80 ? 'error' : aiSettings.strictness > 60 ? 'warning' : 'success'}
                />
              </Box>
              <Slider
                value={aiSettings.strictness}
                onChange={(_, value) => handleSettingsChange('strictness', value)}
                aria-labelledby="strictness-slider"
                valueLabelDisplay="auto"
                step={5}
                marks
                min={0}
                max={100}
              />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Higher strictness requires more precise answers but may be less forgiving of minor variations.
              </Typography>
            </Box>

            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Grading Options
              </Typography>

              <FormControlLabel
                control={
                  <Switch
                    checked={aiSettings.enablePartialCredit}
                    onChange={handleSwitchChange}
                    name="enablePartialCredit"
                    color="primary"
                  />
                }
                label="Enable partial credit"
                sx={{ display: 'block', mb: 1 }}
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={aiSettings.considerSpelling}
                    onChange={handleSwitchChange}
                    name="considerSpelling"
                    color="primary"
                  />
                }
                label="Consider spelling in grading"
                sx={{ display: 'block', mb: 1 }}
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={aiSettings.considerGrammar}
                    onChange={handleSwitchChange}
                    name="considerGrammar"
                    color="primary"
                  />
                }
                label="Consider grammar in grading"
                sx={{ display: 'block' }}
              />
            </Box>

            <Box sx={{ mt: 4, p: 2, bgcolor: alpha(theme.palette.info.main, 0.1), borderRadius: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <PsychologyIcon sx={{ mr: 1, color: theme.palette.info.main }} />
                <Typography variant="subtitle2" color="info.main">
                  About AI Grading
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Our AI grading system uses Google Gemini API to evaluate open-ended responses based on accuracy,
                completeness, and relevance to the expected answers. The system can understand context and
                semantic meaning, allowing for variations in how students express correct answers.
              </Typography>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default AIGrading;
