import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Alert,
  CircularProgress,
  Divider,
  List,
  ListItem,
  ListItemText,
  Chip
} from '@mui/material';
import { useParams } from 'react-router-dom';
import api from '../../services/api';

// This is a debug component to check if selective answering is working correctly
const SelectiveAnsweringDebug = () => {
  const { id } = useParams(); // Exam ID
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exam, setExam] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch exam data
        const examResponse = await api.get(`/exam/${id}`);
        setExam(examResponse.data);

        // Fetch result data if available
        try {
          const resultResponse = await api.get(`/exam/${id}/result`);
          setResult(resultResponse.data);
        } catch (err) {
          console.log('No result found for this exam');
        }

      } catch (err) {
        console.error('Error fetching data:', err);
        setError(err.response?.data?.message || 'Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchData();
    }
  }, [id]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h4" gutterBottom>
        Selective Answering Debug
      </Typography>

      <Divider sx={{ my: 2 }} />

      <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
        <Typography variant="h5" gutterBottom>
          Exam Configuration
        </Typography>

        <List>
          <ListItem>
            <ListItemText
              primary="Exam Title"
              secondary={exam?.title || 'N/A'}
            />
          </ListItem>

          <ListItem>
            <ListItemText
              primary="Selective Answering Enabled"
              secondary={
                <Chip
                  label={exam?.allowSelectiveAnswering ? 'Yes' : 'No'}
                  color={exam?.allowSelectiveAnswering ? 'success' : 'default'}
                  size="small"
                />
              }
            />
          </ListItem>

          <ListItem>
            <ListItemText
              primary="Section B Required Questions"
              secondary={exam?.sectionBRequiredQuestions || 'N/A'}
            />
          </ListItem>

          <ListItem>
            <ListItemText
              primary="Section C Required Questions"
              secondary={exam?.sectionCRequiredQuestions || 'N/A'}
            />
          </ListItem>
        </List>
      </Paper>

      {result && (
        <Paper elevation={3} sx={{ p: 3 }}>
          <Typography variant="h5" gutterBottom>
            Result Data
          </Typography>

          <List>
            <ListItem>
              <ListItemText
                primary="Selected Questions"
                secondary={
                  result.selectedQuestions?.length > 0
                    ? result.selectedQuestions.join(', ')
                    : 'None'
                }
              />
            </ListItem>

            {result.answers && (
              <>
                <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>
                  Answers with Selection Status
                </Typography>

                {result.answers.map((answer, index) => (
                  <Paper
                    key={index}
                    elevation={1}
                    sx={{
                      p: 2,
                      mb: 2,
                      bgcolor: answer.isSelected === false ? '#f5f5f5' : undefined,
                      border: answer.isSelected === false ? '1px dashed #ccc' : undefined
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="subtitle1">
                        Question {index + 1} (Section {answer.section})
                      </Typography>
                      <Chip
                        label={answer.isSelected === false ? 'Not Selected' : 'Selected'}
                        color={answer.isSelected === false ? 'default' : 'primary'}
                        size="small"
                      />
                    </Box>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>Answer:</strong> {answer.answer || 'No answer'}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Score:</strong> {answer.score !== undefined ? answer.score : 'Not graded'}
                      {answer.isSelected === false && ' (Not counted)'}
                    </Typography>
                  </Paper>
                ))}
              </>
            )}
          </List>
        </Paper>
      )}
    </Box>
  );
};

export default SelectiveAnsweringDebug;
