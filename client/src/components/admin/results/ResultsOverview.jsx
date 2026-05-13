import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  TextField,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  IconButton,
  Tooltip,
  LinearProgress,
  Select,
  FormControl,
  InputLabel,
  OutlinedInput,
  Tabs,
  Tab
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Search as SearchIcon,
  FilterList as FilterListIcon,
  GetApp as DownloadIcon,
  Visibility as VisibilityIcon,
  Assessment as AssessmentIcon,
  School as SchoolIcon,
  Group as GroupIcon,
  CalendarToday as CalendarIcon,
  Person as PersonIcon,
  EmojiEvents as EmojiEventsIcon
} from '@mui/icons-material';

// Mock data for recent exams
const recentExams = [
  {
    id: '65f1a2b3c4d5e6f7a8b9c0d1',
    title: 'Biology Midterm Exam',
    date: '2023-10-15',
    students: 45,
    avgScore: 78,
    passingRate: 89,
    status: 'completed'
  },
  {
    id: '65f1a2b3c4d5e6f7a8b9c0d2',
    title: 'Chemistry Quiz 3',
    date: '2023-10-12',
    students: 32,
    avgScore: 82,
    passingRate: 94,
    status: 'completed'
  },
  {
    id: '65f1a2b3c4d5e6f7a8b9c0d3',
    title: 'Physics Problem Set',
    date: '2023-10-10',
    students: 38,
    avgScore: 71,
    passingRate: 76,
    status: 'completed'
  },
  {
    id: '65f1a2b3c4d5e6f7a8b9c0d4',
    title: 'Mathematics Final Exam',
    date: '2023-10-05',
    students: 41,
    avgScore: 68,
    passingRate: 73,
    status: 'completed'
  },
  {
    id: '65f1a2b3c4d5e6f7a8b9c0d5',
    title: 'English Literature Essay',
    date: '2023-10-01',
    students: 29,
    avgScore: 85,
    passingRate: 97,
    status: 'completed'
  }
];

// Mock data for student performance
const studentPerformance = [
  {
    id: '1',
    name: 'John Doe',
    email: 'john.doe@example.com',
    exams: 5,
    avgScore: 82,
    lastExam: '2023-10-15',
    trend: 'up'
  },
  {
    id: '2',
    name: 'Jane Smith',
    email: 'jane.smith@example.com',
    exams: 5,
    avgScore: 91,
    lastExam: '2023-10-15',
    trend: 'up'
  },
  {
    id: '3',
    name: 'Robert Johnson',
    email: 'robert.johnson@example.com',
    exams: 4,
    avgScore: 75,
    lastExam: '2023-10-12',
    trend: 'down'
  },
  {
    id: '4',
    name: 'Emily Williams',
    email: 'emily.williams@example.com',
    exams: 5,
    avgScore: 88,
    lastExam: '2023-10-15',
    trend: 'stable'
  },
  {
    id: '5',
    name: 'Michael Brown',
    email: 'michael.brown@example.com',
    exams: 3,
    avgScore: 65,
    lastExam: '2023-10-10',
    trend: 'down'
  }
];

const ResultsOverview = () => {
  const theme = useTheme();
  const navigate = useNavigate();

  // State for tab
  const [tabValue, setTabValue] = useState(0);

  // State for filters
  const [filters, setFilters] = useState({
    search: '',
    dateRange: 'all',
    examType: 'all',
    studentGroup: 'all'
  });

  // State for pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);

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

  // Handle page change
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  // Handle rows per page change
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Handle view exam details
  const handleViewExamDetails = (examId) => {
    console.log('View exam details:', examId);
    // In a real app, navigate to exam details page
  };

  // Handle view student details
  const handleViewStudentDetails = (studentId) => {
    console.log('View student details:', studentId);
    // In a real app, navigate to student details page
  };

  // Handle export results
  const handleExportResults = () => {
    console.log('Export results');
    // In a real app, export results to CSV/Excel
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return theme.palette.success.main;
      case 'in-progress':
        return theme.palette.warning.main;
      case 'scheduled':
        return theme.palette.info.main;
      default:
        return theme.palette.text.secondary;
    }
  };

  // Get trend color and icon
  const getTrendInfo = (trend) => {
    switch (trend) {
      case 'up':
        return { color: theme.palette.success.main, icon: '↑' };
      case 'down':
        return { color: theme.palette.error.main, icon: '↓' };
      case 'stable':
        return { color: theme.palette.info.main, icon: '→' };
      default:
        return { color: theme.palette.text.secondary, icon: '-' };
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
            Results Overview
          </Typography>
          <Typography
            variant="subtitle1"
            color="text.secondary"
            sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}
          >
            View and analyze exam results
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
            onClick={() => navigate('/dashboard')}
            sx={{
              borderRadius: 3,
              width: { xs: '100%', sm: 'auto' }
            }}
          >
            Back to Dashboard
          </Button>
          <Button
            variant="contained"
            startIcon={<EmojiEventsIcon />}
            onClick={() => {
              // If an exam is selected in the table, navigate to its leaderboard
              if (recentExams.length > 0) {
                navigate(`/admin/exams/${recentExams[0].id}/leaderboard`);
              }
            }}
            sx={{
              borderRadius: 3,
              mr: { xs: 0, sm: 2 },
              mb: { xs: 1, sm: 0 },
              width: { xs: '100%', sm: 'auto' },
              bgcolor: alpha(theme.palette.warning.main, 0.9),
              color: 'white',
              fontWeight: 'bold',
              '&:hover': {
                bgcolor: theme.palette.warning.main,
                transform: 'translateY(-2px)',
                boxShadow: `0 4px 8px ${alpha(theme.palette.warning.main, 0.5)}`
              },
              transition: 'all 0.2s ease'
            }}
          >
            View Leaderboard
          </Button>
          <Button
            variant="contained"
            startIcon={<DownloadIcon />}
            onClick={handleExportResults}
            sx={{
              borderRadius: 3,
              px: { xs: 2, md: 3 },
              py: { xs: 1, md: 1.2 },
              width: { xs: '100%', sm: 'auto' },
              boxShadow: `0 4px 14px ${alpha(theme.palette.primary.main, 0.3)}`
            }}
          >
            Export Results
          </Button>
        </Box>
      </Box>

      {/* Stats cards */}
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
                  <AssessmentIcon />
                </Box>
                <Typography variant="h6" fontWeight="bold">
                  185
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Total Exams
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
                  <SchoolIcon />
                </Box>
                <Typography variant="h6" fontWeight="bold">
                  78%
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
                    backgroundColor: alpha(theme.palette.info.main, 0.1),
                    color: theme.palette.info.main,
                    mr: 2
                  }}
                >
                  <PersonIcon />
                </Box>
                <Typography variant="h6" fontWeight="bold">
                  342
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Total Students
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
                  <GroupIcon />
                </Box>
                <Typography variant="h6" fontWeight="bold">
                  85%
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Passing Rate
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

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
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              placeholder="Search exams or students..."
              name="search"
              value={filters.search}
              onChange={handleFilterChange}
              InputProps={{
                startAdornment: <SearchIcon color="action" sx={{ mr: 1 }} />,
                sx: { borderRadius: 3 }
              }}
              size="small"
            />
          </Grid>

          <Grid item xs={12} sm={4} md={2.5}>
            <FormControl fullWidth size="small">
              <InputLabel id="date-range-label">Date Range</InputLabel>
              <Select
                labelId="date-range-label"
                name="dateRange"
                value={filters.dateRange}
                onChange={handleFilterChange}
                input={<OutlinedInput label="Date Range" />}
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

          <Grid item xs={12} sm={4} md={2.5}>
            <FormControl fullWidth size="small">
              <InputLabel id="exam-type-label">Exam Type</InputLabel>
              <Select
                labelId="exam-type-label"
                name="examType"
                value={filters.examType}
                onChange={handleFilterChange}
                input={<OutlinedInput label="Exam Type" />}
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

          <Grid item xs={12} sm={4} md={2.5}>
            <FormControl fullWidth size="small">
              <InputLabel id="student-group-label">Student Group</InputLabel>
              <Select
                labelId="student-group-label"
                name="studentGroup"
                value={filters.studentGroup}
                onChange={handleFilterChange}
                input={<OutlinedInput label="Student Group" />}
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

          <Grid item xs={12} sm={12} md={0.5} sx={{ display: 'flex', justifyContent: { xs: 'flex-start', md: 'center' } }}>
            <Tooltip title="More Filters">
              <IconButton>
                <FilterListIcon />
              </IconButton>
            </Tooltip>
          </Grid>
        </Grid>
      </Paper>

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
          <Tab label="Exam Results" />
          <Tab label="Student Performance" />
        </Tabs>
      </Box>

      {/* Tab content */}
      {tabValue === 0 ? (
        <Paper
          elevation={0}
          sx={{
            borderRadius: { xs: 3, md: 4 },
            border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            overflow: 'hidden'
          }}
        >
          <TableContainer>
            <Table>
              <TableHead sx={{ backgroundColor: alpha(theme.palette.primary.main, 0.05) }}>
                <TableRow>
                  <TableCell>Exam Title</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Students</TableCell>
                  <TableCell>Avg. Score</TableCell>
                  <TableCell>Passing Rate</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {recentExams.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((exam) => (
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
                    <TableCell>{exam.students}</TableCell>
                    <TableCell>{renderScore(exam.avgScore)}</TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {exam.passingRate}%
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={exam.status.charAt(0).toUpperCase() + exam.status.slice(1)}
                        size="small"
                        sx={{
                          bgcolor: alpha(getStatusColor(exam.status), 0.1),
                          color: getStatusColor(exam.status),
                          fontWeight: 500,
                          borderRadius: 1
                        }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <Button
                          variant="contained"
                          size="small"
                          startIcon={<EmojiEventsIcon />}
                          onClick={() => navigate(`/admin/exams/${exam.id}/leaderboard`)}
                          sx={{
                            mr: 1,
                            bgcolor: alpha(theme.palette.warning.main, 0.9),
                            color: 'white',
                            fontWeight: 'bold',
                            '&:hover': {
                              bgcolor: theme.palette.warning.main,
                              transform: 'translateY(-2px)',
                              boxShadow: `0 4px 8px ${alpha(theme.palette.warning.main, 0.5)}`
                            },
                            transition: 'all 0.2s ease'
                          }}
                        >
                          Leaderboard
                        </Button>
                        <Tooltip title="View Details">
                          <IconButton
                            size="small"
                            onClick={() => handleViewExamDetails(exam.id)}
                            sx={{
                              color: theme.palette.primary.main,
                              '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.1) }
                            }}
                          >
                            <VisibilityIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={recentExams.length}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[5, 10, 25]}
          />
        </Paper>
      ) : (
        <Paper
          elevation={0}
          sx={{
            borderRadius: { xs: 3, md: 4 },
            border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            overflow: 'hidden'
          }}
        >
          <TableContainer>
            <Table>
              <TableHead sx={{ backgroundColor: alpha(theme.palette.primary.main, 0.05) }}>
                <TableRow>
                  <TableCell>Student</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Exams Taken</TableCell>
                  <TableCell>Avg. Score</TableCell>
                  <TableCell>Last Exam</TableCell>
                  <TableCell>Trend</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {studentPerformance.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((student) => (
                  <TableRow key={student.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {student.name}
                      </Typography>
                    </TableCell>
                    <TableCell>{student.email}</TableCell>
                    <TableCell>{student.exams}</TableCell>
                    <TableCell>{renderScore(student.avgScore)}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <CalendarIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary', fontSize: '1rem' }} />
                        <Typography variant="body2">{student.lastExam}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        fontWeight="medium"
                        sx={{ color: getTrendInfo(student.trend).color }}
                      >
                        {getTrendInfo(student.trend).icon} {student.trend.charAt(0).toUpperCase() + student.trend.slice(1)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="View Details">
                        <IconButton
                          size="small"
                          onClick={() => handleViewStudentDetails(student.id)}
                          sx={{
                            color: theme.palette.primary.main,
                            '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.1) }
                          }}
                        >
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={studentPerformance.length}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[5, 10, 25]}
          />
        </Paper>
      )}
    </Box>
  );
};

export default ResultsOverview;
