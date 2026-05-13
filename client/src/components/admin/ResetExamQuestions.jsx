import React, { useState } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  AlertTitle,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Check as CheckIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  QuestionAnswer as QuestionIcon
} from '@mui/icons-material';
import api from '../../services/api';

const ResetExamQuestions = ({ examId, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [result, setResult] = useState(null);

  const handleReset = async () => {
    if (!window.confirm('Are you sure you want to reset all questions for this exam? This will delete all existing questions and re-extract them from the original file. This action cannot be undone.')) {
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);
    setResult(null);

    try {
      const response = await api.post(`/exam/${examId}/reset-questions`);
      setSuccess(true);
      setResult(response.data);

      if (onSuccess && typeof onSuccess === 'function') {
        onSuccess(response.data.exam);
      }
    } catch (err) {
      console.error('Error resetting exam questions:', err);
      setError(err.response?.data?.message || 'Failed to reset exam questions');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper elevation={2} sx={{ p: 3, mb: 3, borderRadius: 0 }}>
      <Typography variant="h6" gutterBottom>
        Reset Exam Questions
      </Typography>

      <Typography variant="body2" color="text.secondary" paragraph>
        This will delete all existing questions and re-extract them from the original uploaded file.
        Use this if the AI didn't properly extract questions the first time.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          <AlertTitle>Error</AlertTitle>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          <AlertTitle>Success</AlertTitle>
          Questions have been reset and re-extracted successfully.
        </Alert>
      )}

      {result && (
        <Box sx={{ mt: 2, mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Extraction Results:
          </Typography>
          <Divider sx={{ mb: 1 }} />
          <List dense>
            {result.exam.sections.map((section) => (
              <ListItem key={section.name}>
                <ListItemIcon>
                  <QuestionIcon color="primary" />
                </ListItemIcon>
                <ListItemText
                  primary={`Section ${section.name}: ${section.description}`}
                  secondary={`${section.questions.length} questions extracted`}
                />
                <Chip
                  size="small"
                  label={`${section.questions.length} questions`}
                  color={section.questions.length > 0 ? "success" : "error"}
                />
              </ListItem>
            ))}
          </List>
        </Box>
      )}

      <Button
        variant="contained"
        color="primary"
        startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <RefreshIcon />}
        onClick={handleReset}
        disabled={loading}
        sx={{ mt: 2, borderRadius: 0 }}
      >
        {loading ? 'Processing...' : 'Reset Questions'}
      </Button>
    </Paper>
  );
};

export default ResetExamQuestions;
