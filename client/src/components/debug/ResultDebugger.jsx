import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  TextField,
  Grid,
  Card,
  CardContent,
  useTheme
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Search as SearchIcon,
  BugReport as BugIcon
} from '@mui/icons-material';
import api from '../../services/api';

const ResultDebugger = () => {
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [studentDebug, setStudentDebug] = useState(null);
  const [adminDebug, setAdminDebug] = useState(null);
  const [resultId, setResultId] = useState('6831b9a3a682bcd513d9dfb2');
  const [testResult, setTestResult] = useState(null);

  const fetchStudentDebug = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get('/student/debug-results');
      setStudentDebug(response.data);
    } catch (err) {
      console.error('Error fetching student debug:', err);
      setError('Failed to fetch student debug data: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  const fetchAdminDebug = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get('/admin/debug');
      setAdminDebug(response.data);
    } catch (err) {
      console.error('Error fetching admin debug:', err);
      setError('Failed to fetch admin debug data: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  const testSpecificResult = async () => {
    if (!resultId) {
      setError('Please enter a result ID');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setTestResult(null);

      // First, check if the result exists using our debug endpoint
      try {
        const checkResponse = await api.get(`/student/check-result/${resultId}`);
        console.log('Check result response:', checkResponse.data);

        if (!checkResponse.data.exists) {
          setTestResult({
            type: 'check',
            success: false,
            checkData: checkResponse.data,
            message: 'Result does not exist in database'
          });
          return;
        }

        if (!checkResponse.data.canAccess) {
          setTestResult({
            type: 'check',
            success: false,
            checkData: checkResponse.data,
            message: `Result exists but cannot access: ${!checkResponse.data.belongsToStudent ? 'Not your result' : 'Not completed'}`
          });
          return;
        }

        // If we can access it, try to fetch the full result
        try {
          const studentResponse = await api.get(`/student/results/${resultId}`);
          setTestResult({
            type: 'student',
            success: true,
            data: studentResponse.data,
            checkData: checkResponse.data
          });
        } catch (studentErr) {
          console.log('Student fetch failed after check passed:', studentErr);

          // Try to fetch as admin
          try {
            const adminResponse = await api.get(`/admin/results/${resultId}`);
            setTestResult({
              type: 'admin',
              success: true,
              data: adminResponse.data,
              checkData: checkResponse.data
            });
          } catch (adminErr) {
            console.log('Admin fetch failed:', adminErr);
            setTestResult({
              type: 'both',
              success: false,
              studentError: studentErr.response?.data?.message || studentErr.message,
              adminError: adminErr.response?.data?.message || adminErr.message,
              checkData: checkResponse.data
            });
          }
        }
      } catch (checkErr) {
        console.log('Check endpoint failed:', checkErr);
        setError('Failed to check result: ' + (checkErr.response?.data?.message || checkErr.message));
      }
    } catch (err) {
      console.error('Error testing result:', err);
      setError('Failed to test result: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudentDebug();
    fetchAdminDebug();
  }, []);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom fontWeight="bold">
        Result Debugger
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Debug tool to troubleshoot result access issues
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Test Specific Result */}
      <Paper elevation={0} sx={{ p: 3, mb: 3, border: `1px solid ${theme.palette.divider}` }}>
        <Typography variant="h6" gutterBottom>
          Test Specific Result
        </Typography>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={8}>
            <TextField
              fullWidth
              label="Result ID"
              value={resultId}
              onChange={(e) => setResultId(e.target.value)}
              placeholder="Enter result ID to test"
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <Button
              variant="contained"
              startIcon={loading ? <CircularProgress size={20} /> : <SearchIcon />}
              onClick={testSpecificResult}
              disabled={loading}
              fullWidth
            >
              Test Result
            </Button>
          </Grid>
        </Grid>

        {testResult && (
          <Box sx={{ mt: 3 }}>
            {testResult.success ? (
              <Alert severity="success">
                <Typography variant="body2">
                  <strong>Success!</strong> Result found via {testResult.type} endpoint.
                </Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Exam: {testResult.data.exam?.title || 'Unknown'}
                </Typography>
                <Typography variant="body2">
                  Score: {testResult.data.totalScore}/{testResult.data.maxPossibleScore}
                </Typography>
                {testResult.checkData && (
                  <Box sx={{ mt: 2, p: 1, bgcolor: 'rgba(0,0,0,0.05)', borderRadius: 1 }}>
                    <Typography variant="caption" display="block">
                      <strong>Debug Info:</strong>
                    </Typography>
                    <Typography variant="caption" display="block">
                      Result ID: {testResult.checkData.debug?.resultId}
                    </Typography>
                    <Typography variant="caption" display="block">
                      Belongs to Student: {testResult.checkData.belongsToStudent ? 'Yes' : 'No'}
                    </Typography>
                    <Typography variant="caption" display="block">
                      Is Completed: {testResult.checkData.isCompleted ? 'Yes' : 'No'}
                    </Typography>
                  </Box>
                )}
              </Alert>
            ) : (
              <Alert severity="error">
                <Typography variant="body2">
                  <strong>Failed to access result:</strong>
                </Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  {testResult.message || 'Unknown error'}
                </Typography>
                {testResult.studentError && (
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    Student Error: {testResult.studentError}
                  </Typography>
                )}
                {testResult.adminError && (
                  <Typography variant="body2">
                    Admin Error: {testResult.adminError}
                  </Typography>
                )}
                {testResult.checkData && (
                  <Box sx={{ mt: 2, p: 1, bgcolor: 'rgba(0,0,0,0.05)', borderRadius: 1 }}>
                    <Typography variant="caption" display="block">
                      <strong>Debug Info:</strong>
                    </Typography>
                    <Typography variant="caption" display="block">
                      Result Exists: {testResult.checkData.exists ? 'Yes' : 'No'}
                    </Typography>
                    {testResult.checkData.exists && (
                      <>
                        <Typography variant="caption" display="block">
                          Belongs to Student: {testResult.checkData.belongsToStudent ? 'Yes' : 'No'}
                        </Typography>
                        <Typography variant="caption" display="block">
                          Is Completed: {testResult.checkData.isCompleted ? 'Yes' : 'No'}
                        </Typography>
                        <Typography variant="caption" display="block">
                          Can Access: {testResult.checkData.canAccess ? 'Yes' : 'No'}
                        </Typography>
                        {testResult.checkData.debug && (
                          <>
                            <Typography variant="caption" display="block">
                              Result Student: {testResult.checkData.debug.resultStudent}
                            </Typography>
                            <Typography variant="caption" display="block">
                              Requesting Student: {testResult.checkData.debug.requestingStudent}
                            </Typography>
                            <Typography variant="caption" display="block">
                              Exam ID: {testResult.checkData.debug.examId}
                            </Typography>
                          </>
                        )}
                      </>
                    )}
                    {!testResult.checkData.exists && testResult.checkData.debug?.sampleResults && (
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="caption" display="block">
                          <strong>Sample Results in Database:</strong>
                        </Typography>
                        {testResult.checkData.debug.sampleResults.slice(0, 3).map((sample, index) => (
                          <Typography key={index} variant="caption" display="block">
                            {sample.id} (Student: {sample.student}, Completed: {sample.completed ? 'Yes' : 'No'})
                          </Typography>
                        ))}
                      </Box>
                    )}
                  </Box>
                )}
              </Alert>
            )}
          </Box>
        )}
      </Paper>

      {/* Student Debug Info */}
      <Paper elevation={0} sx={{ p: 3, mb: 3, border: `1px solid ${theme.palette.divider}` }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">
            Student Debug Info
          </Typography>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchStudentDebug}
            disabled={loading}
          >
            Refresh
          </Button>
        </Box>

        {studentDebug && (
          <Box>
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={4}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" color="primary">
                      {studentDebug.results.total}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Results
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" color="success.main">
                      {studentDebug.results.completed}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Completed
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" color="warning.main">
                      {studentDebug.results.pending}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Pending
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            <Typography variant="subtitle1" gutterBottom fontWeight="bold">
              Completed Results
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Result ID</TableCell>
                    <TableCell>Exam</TableCell>
                    <TableCell>Score</TableCell>
                    <TableCell>Completed</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {studentDebug.results.completedList.map((result) => (
                    <TableRow key={result.id}>
                      <TableCell>
                        <Typography variant="body2" fontFamily="monospace">
                          {result.id}
                        </Typography>
                      </TableCell>
                      <TableCell>{result.exam}</TableCell>
                      <TableCell>{result.score} ({result.percentage}%)</TableCell>
                      <TableCell>
                        {new Date(result.completedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={result.isCompleted ? 'Completed' : 'Pending'}
                          color={result.isCompleted ? 'success' : 'warning'}
                          size="small"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}
      </Paper>

      {/* Admin Debug Info */}
      <Paper elevation={0} sx={{ p: 3, border: `1px solid ${theme.palette.divider}` }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">
            Admin Debug Info
          </Typography>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchAdminDebug}
            disabled={loading}
          >
            Refresh
          </Button>
        </Box>

        {adminDebug && (
          <Box>
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={3}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" color="primary">
                      {adminDebug.exams.total}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Exams
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={3}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" color="info.main">
                      {adminDebug.students.createdByThisAdmin}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Students Created
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={3}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" color="success.main">
                      {adminDebug.students.whoTookExams}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Students Who Took Exams
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={3}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" color="warning.main">
                      {adminDebug.results.completed}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Completed Results
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            <Typography variant="subtitle1" gutterBottom fontWeight="bold">
              Recent Results
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Result ID</TableCell>
                    <TableCell>Student</TableCell>
                    <TableCell>Exam</TableCell>
                    <TableCell>Score</TableCell>
                    <TableCell>Completed</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {adminDebug.results.completedList.slice(0, 10).map((result) => (
                    <TableRow key={result.id}>
                      <TableCell>
                        <Typography variant="body2" fontFamily="monospace">
                          {result.id}
                        </Typography>
                      </TableCell>
                      <TableCell>{result.student}</TableCell>
                      <TableCell>{result.exam}</TableCell>
                      <TableCell>{result.score} ({result.percentage}%)</TableCell>
                      <TableCell>
                        {new Date(result.completedAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default ResultDebugger;
