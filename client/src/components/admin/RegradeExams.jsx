import { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
  Snackbar,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Switch,
  FormControlLabel
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import api from '../../services/api';

const RegradeExams = () => {
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [openSnackbar, setOpenSnackbar] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedResult, setSelectedResult] = useState(null);
  const [forceRegrade, setForceRegrade] = useState(false);
  const [batchProcessing, setBatchProcessing] = useState(false);

  // Fetch all exam results
  useEffect(() => {
    const fetchResults = async () => {
      try {
        setLoading(true);
        const response = await api.get('/admin/results');
        setResults(response.data);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching results:', err);
        setError('Failed to fetch exam results');
        setOpenSnackbar(true);
        setLoading(false);
      }
    };

    fetchResults();
  }, []);

  // Handle regrading a specific result
  const handleRegradeResult = async (resultId) => {
    try {
      setLoading(true);
      const response = await api.post(`/exam/regrade/${resultId}`, { forceRegrade });

      setMessage('Exam regraded successfully');
      setOpenSnackbar(true);
      setLoading(false);

      // Update the result in the list
      setResults(prevResults =>
        prevResults.map(result =>
          result._id === resultId
            ? { ...result, totalScore: response.data.result.totalScore }
            : result
        )
      );
    } catch (err) {
      console.error('Error regrading result:', err);
      setError('Failed to regrade exam');
      setOpenSnackbar(true);
      setLoading(false);
    }
  };

  // Handle regrading all ungraded results
  const handleRegradeAll = async () => {
    try {
      setBatchProcessing(true);
      await api.post('/exam/regrade-all', {});

      setMessage('Batch regrading process started. This may take some time.');
      setOpenSnackbar(true);

      // Set a timeout to refresh the results after a delay
      setTimeout(() => {
        window.location.reload();
      }, 10000);
    } catch (err) {
      console.error('Error starting batch regrade:', err);
      setError('Failed to start batch regrading process');
      setOpenSnackbar(true);
      setBatchProcessing(false);
    }
  };

  // Open confirmation dialog
  const openRegradeDialog = (result) => {
    setSelectedResult(result);
    setOpenDialog(true);
  };

  // Close confirmation dialog
  const closeRegradeDialog = () => {
    setOpenDialog(false);
    setSelectedResult(null);
  };

  // Confirm regrade
  const confirmRegrade = () => {
    if (selectedResult) {
      handleRegradeResult(selectedResult._id);
      closeRegradeDialog();
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Regrade Exams
      </Typography>

      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="body1">
          Use this tool to regrade exams that may have incorrect or missing AI grades.
        </Typography>

        <Button
          variant="contained"
          color="primary"
          onClick={handleRegradeAll}
          disabled={batchProcessing}
          startIcon={batchProcessing ? <CircularProgress size={20} color="inherit" /> : null}
        >
          {batchProcessing ? 'Processing...' : 'Regrade All Ungraded Exams'}
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: theme.palette.primary.main }}>
                <TableCell sx={{ color: 'white' }}>Student</TableCell>
                <TableCell sx={{ color: 'white' }}>Exam</TableCell>
                <TableCell sx={{ color: 'white' }}>Score</TableCell>
                <TableCell sx={{ color: 'white' }}>Completion Date</TableCell>
                <TableCell sx={{ color: 'white' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {results.length > 0 ? (
                results.map((result) => (
                  <TableRow key={result._id}>
                    <TableCell>{result.student?.fullName || 'Unknown'}</TableCell>
                    <TableCell>{result.exam?.title || 'Unknown'}</TableCell>
                    <TableCell>
                      {result.totalScore}/{result.maxPossibleScore}
                      ({Math.round((result.totalScore / result.maxPossibleScore) * 100)}%)
                    </TableCell>
                    <TableCell>
                      {new Date(result.endTime).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outlined"
                        color="primary"
                        onClick={() => openRegradeDialog(result)}
                      >
                        Regrade
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    No exam results found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Confirmation Dialog */}
      <Dialog open={openDialog} onClose={closeRegradeDialog}>
        <DialogTitle>Confirm Regrading</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to regrade this exam result?
            {selectedResult && (
              <Box component="span" sx={{ display: 'block', mt: 1 }}>
                <strong>Student:</strong> {selectedResult.student?.fullName || 'Unknown'}<br />
                <strong>Exam:</strong> {selectedResult.exam?.title || 'Unknown'}<br />
                <strong>Current Score:</strong> {selectedResult.totalScore}/{selectedResult.maxPossibleScore}
              </Box>
            )}
          </DialogContentText>
          <FormControlLabel
            control={
              <Switch
                checked={forceRegrade}
                onChange={(e) => setForceRegrade(e.target.checked)}
                color="primary"
              />
            }
            label="Force regrade all answers (including already graded ones)"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeRegradeDialog} color="primary">
            Cancel
          </Button>
          <Button onClick={confirmRegrade} color="primary" variant="contained">
            Regrade
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for messages */}
      <Snackbar
        open={openSnackbar}
        autoHideDuration={6000}
        onClose={() => setOpenSnackbar(false)}
      >
        <Alert
          onClose={() => setOpenSnackbar(false)}
          severity={error ? 'error' : 'success'}
          sx={{ width: '100%' }}
        >
          {error || message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default RegradeExams;
