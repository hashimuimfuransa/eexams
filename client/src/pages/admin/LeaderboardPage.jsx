import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, CircularProgress, Alert, Button, alpha, useTheme } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import ExamLeaderboard from '../../components/admin/results/ExamLeaderboard';
import api from '../../services/api';

const LeaderboardPage = () => {
  const theme = useTheme();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exams, setExams] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState('all');

  // Fetch all exams when component mounts
  useEffect(() => {
    const fetchExams = async () => {
      try {
        setLoading(true);
        const response = await api.get('/admin/exams');

        if (response.data && Array.isArray(response.data)) {
          // Add "All Exams" option at the beginning
          const allExamsOption = {
            _id: 'all',
            title: 'All Exams',
            description: 'View performance across all exams'
          };

          setExams([allExamsOption, ...response.data]);

          // "All Exams" is selected by default
          setSelectedExamId('all');
        } else {
          setError('Failed to load exams. Invalid data format received.');
        }
      } catch (err) {
        console.error('Error fetching exams:', err);
        setError('Failed to load exams. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchExams();
  }, []);

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
          variant="outlined"
          onClick={() => navigate('/dashboard')}
          sx={{ mt: 2 }}
        >
          Back to Dashboard
        </Button>
      </Box>
    );
  }

  if (exams.length === 0) {
    return (
      <Paper
        elevation={0}
        sx={{
          p: 4,
          borderRadius: 3,
          textAlign: 'center',
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`
        }}
      >
        <Typography variant="h5" gutterBottom>
          No Exams Available
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          There are no exams available to display in the leaderboard.
        </Typography>
        <Button
          variant="contained"
          color="primary"
          onClick={() => navigate('/admin/exams/create')}
        >
          Create an Exam
        </Button>
      </Paper>
    );
  }

  // Add a key to force re-render when selectedExamId changes
  const componentKey = `leaderboard-${selectedExamId}`;

  return (
    <Box>
      {selectedExamId === 'all' ? (
        // For "All Exams", we'll fetch data from the overall leaderboard endpoint
        <ExamLeaderboard
          key={componentKey}
          isOverall={true}
          allExams={exams}
        />
      ) : (
        // For specific exam, pass the exam ID
        <ExamLeaderboard
          key={componentKey}
          examId={selectedExamId}
          allExams={exams}
        />
      )}
    </Box>
  );
};

export default LeaderboardPage;
