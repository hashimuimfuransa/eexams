import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Grid,
  Divider,
  useTheme,
  alpha,
  Card,
  CardContent,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  LinearProgress,
  Alert
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  GetApp as DownloadIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  School as SchoolIcon,
  Person as PersonIcon,
  Assignment as AssignmentIcon,
  BarChart as BarChartIcon,
  PieChart as PieChartIcon,
  Timeline as TimelineIcon,
  CalendarToday as CalendarIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

// Mock data for performance metrics
const performanceData = {
  overallStats: {
    averageScore: 78,
    passingRate: 85,
    completionRate: 92,
    averageTime: 45
  },
  examPerformance: [
    { id: '1', title: 'Biology Midterm Exam', avgScore: 78, passingRate: 89, submissions: 45, date: '2023-10-15' },
    { id: '2', title: 'Chemistry Quiz 3', avgScore: 82, passingRate: 94, submissions: 32, date: '2023-10-12' },
    { id: '3', title: 'Physics Problem Set', avgScore: 71, passingRate: 76, submissions: 38, date: '2023-10-10' },
    { id: '4', title: 'Mathematics Final Exam', avgScore: 68, passingRate: 73, submissions: 41, date: '2023-10-05' },
    { id: '5', title: 'English Literature Essay', avgScore: 85, passingRate: 97, submissions: 29, date: '2023-10-01' }
  ],
  studentPerformance: [
    { id: '1', name: 'John Doe', avgScore: 82, examsCompleted: 5, trend: 'up' },
    { id: '2', name: 'Jane Smith', avgScore: 91, examsCompleted: 5, trend: 'up' },
    { id: '3', name: 'Robert Johnson', avgScore: 75, examsCompleted: 4, trend: 'down' },
    { id: '4', name: 'Emily Williams', avgScore: 88, examsCompleted: 5, trend: 'stable' },
    { id: '5', name: 'Michael Brown', avgScore: 65, examsCompleted: 3, trend: 'down' }
  ],
  questionAnalysis: [
    { id: '1', question: 'Explain the process of photosynthesis', avgScore: 65, difficulty: 'high' },
    { id: '2', question: 'Calculate the molarity of a solution', avgScore: 72, difficulty: 'medium' },
    { id: '3', question: 'Solve the quadratic equation', avgScore: 58, difficulty: 'high' },
    { id: '4', question: 'Analyze the main theme of the novel', avgScore: 81, difficulty: 'medium' },
    { id: '5', question: 'Describe Newton\'s laws of motion', avgScore: 76, difficulty: 'low' }
  ]
};

const PerformanceAnalytics = () => {
  const theme = useTheme();
  const navigate = useNavigate();

  // State for tab
  const [tabValue, setTabValue] = useState(0);

  // State for filters
  const [filters, setFilters] = useState({
    timeRange: 'all',
    examType: 'all',
    studentGroup: 'all'
  });

  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  // Handle filter change
  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilters({
      ...filters,
      [name]: value
    });
  };

  // Handle export data
  const handleExportData = () => {
    // In a real app, this would export data to CSV/Excel
    console.log('Exporting data...');
  };

  // Get trend icon and color
  const getTrendInfo = (trend) => {
    switch (trend) {
      case 'up':
        return { icon: <TrendingUpIcon fontSize="small" />, color: theme.palette.success.main };
      case 'down':
        return { icon: <TrendingDownIcon fontSize="small" />, color: theme.palette.error.main };
      case 'stable':
        return { icon: <TimelineIcon fontSize="small" />, color: theme.palette.info.main };
      default:
        return { icon: <TimelineIcon fontSize="small" />, color: theme.palette.text.secondary };
    }
  };

  // Render score with color
  const renderScore = (score) => {
    let color;
    if (score >= 90) color = theme.palette.success.main;
    else if (score >= 75) color = theme.palette.success.light;
    else if (score >= 60) color = theme.palette.warning.main;
    else color = theme.palette.error.main;

    return (
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <Typography variant="body2" fontWeight="medium" sx={{ color }}>
          {score}%
        </Typography>
        <Box sx={{ ml: 1, flex: 1, maxWidth: 50 }}>
          <LinearProgress
            variant="determinate"
            value={score}
            sx={{
              height: 6,
              borderRadius: 3,
              backgroundColor: alpha(color, 0.2),
              '& .MuiLinearProgress-bar': {
                backgroundColor: color
              }
            }}
          />
        </Box>
      </Box>
    );
  };

  // Get difficulty color
  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case 'high':
        return theme.palette.error.main;
      case 'medium':
        return theme.palette.warning.main;
      case 'low':
        return theme.palette.success.main;
      default:
        return theme.palette.text.secondary;
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
            Performance Analytics
          </Typography>
          <Typography
            variant="subtitle1"
            color="text.secondary"
            sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}
          >
            Analyze student performance with detailed charts and metrics
          </Typography>
        </Box>
        <Box sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          width: { xs: '100%', sm: 'auto' },
          gap: { xs: 1, sm: 2 }
        }}>
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/admin/results')}
            sx={{
              borderRadius: 3,
              width: { xs: '100%', sm: 'auto' }
            }}
          >
            Back to Results
          </Button>
          <Button
            variant="contained"
            startIcon={<DownloadIcon />}
            onClick={handleExportData}
            sx={{
              borderRadius: 3,
              px: { xs: 2, md: 3 },
              py: { xs: 1, md: 1.2 },
              width: { xs: '100%', sm: 'auto' },
              boxShadow: `0 4px 14px ${alpha(theme.palette.primary.main, 0.3)}`
            }}
          >
            Export Data
          </Button>
        </Box>
      </Box>

      {/* Filters */}
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2, md: 3 },
          mb: { xs: 2, md: 3 },
          borderRadius: { xs: 3, md: 4 },
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`
        }}
      >
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth size="small">
              <InputLabel id="time-range-label">Time Range</InputLabel>
              <Select
                labelId="time-range-label"
                name="timeRange"
                value={filters.timeRange}
                onChange={handleFilterChange}
                label="Time Range"
                sx={{ borderRadius: 3 }}
              >
                <MenuItem value="all">All Time</MenuItem>
                <MenuItem value="last-week">Last Week</MenuItem>
                <MenuItem value="last-month">Last Month</MenuItem>
                <MenuItem value="last-3-months">Last 3 Months</MenuItem>
                <MenuItem value="custom">Custom Range</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={4}>
            <FormControl fullWidth size="small">
              <InputLabel id="exam-type-label">Exam Type</InputLabel>
              <Select
                labelId="exam-type-label"
                name="examType"
                value={filters.examType}
                onChange={handleFilterChange}
                label="Exam Type"
                sx={{ borderRadius: 3 }}
              >
                <MenuItem value="all">All Types</MenuItem>
                <MenuItem value="quiz">Quiz</MenuItem>
                <MenuItem value="midterm">Midterm</MenuItem>
                <MenuItem value="final">Final</MenuItem>
                <MenuItem value="assignment">Assignment</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={4}>
            <FormControl fullWidth size="small">
              <InputLabel id="student-group-label">Student Group</InputLabel>
              <Select
                labelId="student-group-label"
                name="studentGroup"
                value={filters.studentGroup}
                onChange={handleFilterChange}
                label="Student Group"
                sx={{ borderRadius: 3 }}
              >
                <MenuItem value="all">All Groups</MenuItem>
                <MenuItem value="biology-a">Biology Class A</MenuItem>
                <MenuItem value="chemistry-b">Chemistry Class B</MenuItem>
                <MenuItem value="physics">Physics Group</MenuItem>
                <MenuItem value="mathematics">Mathematics Advanced</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      {/* Performance metrics */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card
            elevation={0}
            sx={{
              borderRadius: 3,
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
              height: '100%'
            }}
          >
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 40,
                    height: 40,
                    borderRadius: 2,
                    backgroundColor: alpha(theme.palette.primary.main, 0.1),
                    color: theme.palette.primary.main,
                    mr: 2
                  }}
                >
                  <SchoolIcon />
                </Box>
                <Typography variant="h4" fontWeight="bold">
                  {performanceData.overallStats.averageScore}%
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Average Score
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card
            elevation={0}
            sx={{
              borderRadius: 3,
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
              height: '100%'
            }}
          >
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 40,
                    height: 40,
                    borderRadius: 2,
                    backgroundColor: alpha(theme.palette.success.main, 0.1),
                    color: theme.palette.success.main,
                    mr: 2
                  }}
                >
                  <TrendingUpIcon />
                </Box>
                <Typography variant="h4" fontWeight="bold">
                  {performanceData.overallStats.passingRate}%
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Passing Rate
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card
            elevation={0}
            sx={{
              borderRadius: 3,
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
              height: '100%'
            }}
          >
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 40,
                    height: 40,
                    borderRadius: 2,
                    backgroundColor: alpha(theme.palette.info.main, 0.1),
                    color: theme.palette.info.main,
                    mr: 2
                  }}
                >
                  <AssignmentIcon />
                </Box>
                <Typography variant="h4" fontWeight="bold">
                  {performanceData.overallStats.completionRate}%
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Completion Rate
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card
            elevation={0}
            sx={{
              borderRadius: 3,
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
              height: '100%'
            }}
          >
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 40,
                    height: 40,
                    borderRadius: 2,
                    backgroundColor: alpha(theme.palette.warning.main, 0.1),
                    color: theme.palette.warning.main,
                    mr: 2
                  }}
                >
                  <TimelineIcon />
                </Box>
                <Typography variant="h4" fontWeight="bold">
                  {performanceData.overallStats.averageTime}m
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Average Time
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Chart placeholders */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={8}>
          <Paper
            elevation={0}
            sx={{
              borderRadius: 3,
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
              p: 3,
              height: '100%'
            }}
          >
            <Typography variant="h6" fontWeight="medium" gutterBottom>
              Score Distribution
            </Typography>
            <Divider sx={{ mb: 3 }} />

            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 300,
              border: `1px dashed ${alpha(theme.palette.divider, 0.3)}`,
              borderRadius: 2
            }}>
              <Box sx={{ textAlign: 'center' }}>
                <BarChartIcon sx={{ fontSize: 60, color: alpha(theme.palette.primary.main, 0.2), mb: 2 }} />
                <Typography variant="body1" color="text.secondary">
                  Bar Chart Placeholder
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  (Score distribution across exams)
                </Typography>
              </Box>
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper
            elevation={0}
            sx={{
              borderRadius: 3,
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
              p: 3,
              height: '100%'
            }}
          >
            <Typography variant="h6" fontWeight="medium" gutterBottom>
              Performance by Category
            </Typography>
            <Divider sx={{ mb: 3 }} />

            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 300,
              border: `1px dashed ${alpha(theme.palette.divider, 0.3)}`,
              borderRadius: 2
            }}>
              <Box sx={{ textAlign: 'center' }}>
                <PieChartIcon sx={{ fontSize: 60, color: alpha(theme.palette.primary.main, 0.2), mb: 2 }} />
                <Typography variant="body1" color="text.secondary">
                  Pie Chart Placeholder
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  (Performance by subject category)
                </Typography>
              </Box>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Box sx={{ mb: 3 }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 500,
              fontSize: '1rem',
              minWidth: 100
            }
          }}
        >
          <Tab
            label="Exam Performance"
            icon={<AssignmentIcon />}
            iconPosition="start"
          />
          <Tab
            label="Student Performance"
            icon={<PersonIcon />}
            iconPosition="start"
          />
          <Tab
            label="Question Analysis"
            icon={<BarChartIcon />}
            iconPosition="start"
          />
        </Tabs>
      </Box>

      {/* Tab content */}
      <Paper
        elevation={0}
        sx={{
          borderRadius: { xs: 3, md: 4 },
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          overflow: 'hidden',
          mb: 3
        }}
      >
        {tabValue === 0 && (
          <TableContainer>
            <Table>
              <TableHead sx={{ backgroundColor: alpha(theme.palette.primary.main, 0.05) }}>
                <TableRow>
                  <TableCell>Exam Title</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Submissions</TableCell>
                  <TableCell>Avg. Score</TableCell>
                  <TableCell>Passing Rate</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {performanceData.examPerformance.map((exam) => (
                  <TableRow key={exam.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {exam.title}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <CalendarIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary', fontSize: '1rem' }} />
                        <Typography variant="body2">{exam.date}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>{exam.submissions}</TableCell>
                    <TableCell>{renderScore(exam.avgScore)}</TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {exam.passingRate}%
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {tabValue === 1 && (
          <TableContainer>
            <Table>
              <TableHead sx={{ backgroundColor: alpha(theme.palette.primary.main, 0.05) }}>
                <TableRow>
                  <TableCell>Student Name</TableCell>
                  <TableCell>Exams Completed</TableCell>
                  <TableCell>Avg. Score</TableCell>
                  <TableCell>Trend</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {performanceData.studentPerformance.map((student) => (
                  <TableRow key={student.id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <PersonIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary', fontSize: '1rem' }} />
                        <Typography variant="body2" fontWeight="medium">
                          {student.name}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>{student.examsCompleted}</TableCell>
                    <TableCell>{renderScore(student.avgScore)}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        {getTrendInfo(student.trend).icon}
                        <Typography
                          variant="body2"
                          fontWeight="medium"
                          sx={{ ml: 1, color: getTrendInfo(student.trend).color }}
                        >
                          {student.trend.charAt(0).toUpperCase() + student.trend.slice(1)}
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {tabValue === 2 && (
          <TableContainer>
            <Table>
              <TableHead sx={{ backgroundColor: alpha(theme.palette.primary.main, 0.05) }}>
                <TableRow>
                  <TableCell>Question</TableCell>
                  <TableCell>Avg. Score</TableCell>
                  <TableCell>Difficulty</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {performanceData.questionAnalysis.map((question) => (
                  <TableRow key={question.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {question.question}
                      </Typography>
                    </TableCell>
                    <TableCell>{renderScore(question.avgScore)}</TableCell>
                    <TableCell>
                      <Chip
                        label={question.difficulty.charAt(0).toUpperCase() + question.difficulty.slice(1)}
                        size="small"
                        sx={{
                          bgcolor: alpha(getDifficultyColor(question.difficulty), 0.1),
                          color: getDifficultyColor(question.difficulty),
                          fontWeight: 500,
                          borderRadius: 1
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Note about charts */}
      <Alert
        severity="info"
        sx={{
          mb: 3,
          borderRadius: 2,
          boxShadow: `0 4px 12px ${alpha(theme.palette.info.main, 0.2)}`
        }}
      >
        <Typography variant="subtitle2">About Analytics</Typography>
        <Typography variant="body2">
          This is a simplified version of the analytics dashboard. In a production environment, this would include interactive charts,
          more detailed metrics, and the ability to drill down into specific data points. You would also be able to export detailed reports.
        </Typography>
      </Alert>
    </Box>
  );
};

export default PerformanceAnalytics;
