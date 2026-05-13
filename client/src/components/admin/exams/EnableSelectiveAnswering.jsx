import React, { useState } from 'react';
import {
  Box,
  Button,
  Typography,
  TextField,
  Paper,
  Alert,
  CircularProgress,
  Divider,
  FormControlLabel,
  Switch
} from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../../services/api';

const EnableSelectiveAnswering = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    sectionBRequiredQuestions: 3,
    sectionCRequiredQuestions: 1
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await api.post(`/exam/${id}/enable-selective-answering`, formData);

      console.log('Selective answering enabled:', response.data);
      setSuccess(true);

      // Navigate back to exam view after a short delay
      setTimeout(() => {
        navigate(`/admin/exams/${id}/view`);
      }, 2000);
    } catch (err) {
      console.error('Error enabling selective answering:', err);
      setError(err.response?.data?.message || 'Failed to enable selective answering');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', mt: 4, p: 2 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Enable Selective Answering
        </Typography>

        <Typography variant="body1" paragraph>
          Enabling selective answering allows students to choose which questions they want to answer in Sections B and C.
          You can specify how many questions students must answer in each section.
        </Typography>

        <Divider sx={{ my: 3 }} />

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 3 }}>
            Selective answering has been enabled successfully!
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Section B Configuration
            </Typography>
            <TextField
              fullWidth
              label="Required questions in Section B"
              name="sectionBRequiredQuestions"
              type="number"
              value={formData.sectionBRequiredQuestions}
              onChange={handleChange}
              InputProps={{ inputProps: { min: 1 } }}
              helperText="Minimum number of questions students must answer in Section B"
              sx={{ mb: 2 }}
            />
          </Box>

          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Section C Configuration
            </Typography>
            <TextField
              fullWidth
              label="Required questions in Section C"
              name="sectionCRequiredQuestions"
              type="number"
              value={formData.sectionCRequiredQuestions}
              onChange={handleChange}
              InputProps={{ inputProps: { min: 1 } }}
              helperText="Minimum number of questions students must answer in Section C"
              sx={{ mb: 2 }}
            />
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
            <Button
              variant="outlined"
              onClick={() => navigate(`/admin/exams/${id}/view`)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={loading || success}
              startIcon={loading && <CircularProgress size={20} color="inherit" />}
            >
              {loading ? 'Enabling...' : 'Enable Selective Answering'}
            </Button>
          </Box>
        </form>
      </Paper>
    </Box>
  );
};

export default EnableSelectiveAnswering;
