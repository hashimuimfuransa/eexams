import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  Grid,
  Chip,
  CircularProgress,
  Alert,
  TextField,
  InputAdornment
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import axios from 'axios';

const PublicExamList = () => {
  const navigate = useNavigate();
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedExam, setSelectedExam] = useState(null);
  const [requestDialog, setRequestDialog] = useState({ open: false, exam: null });
  const [requestForm, setRequestForm] = useState({ name: '', phone: '', email: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState(null);

  useEffect(() => {
    fetchPublicExams();
  }, []);

  const fetchPublicExams = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/public/exams');
      setExams(response.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching public exams:', err);
      setError('Failed to load exams. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleExamClick = (exam) => {
    setSelectedExam(exam);
    setRequestDialog({ open: true, exam });
    setRequestForm({ name: '', phone: '', email: '' });
    setSubmitMessage(null);
  };

  const handleRequestSubmit = async (e) => {
    e.preventDefault();
    
    if (!requestForm.name.trim() || !requestForm.email.trim()) {
      setSubmitMessage({ type: 'error', text: 'Name and email are required' });
      return;
    }

    setSubmitting(true);
    try {
      const response = await axios.post(`/public/exams/${requestDialog.exam._id}/request`, {
        name: requestForm.name,
        phone: requestForm.phone,
        email: requestForm.email
      });

      setSubmitMessage({ type: 'success', text: response.data.message });
      setRequestForm({ name: '', phone: '', email: '' });
      
      setTimeout(() => {
        setRequestDialog({ open: false, exam: null });
        setSubmitMessage(null);
      }, 3000);
    } catch (err) {
      console.error('Error submitting request:', err);
      setSubmitMessage({ 
        type: 'error', 
        text: err.response?.data?.message || 'Failed to submit request. Please try again.' 
      });
    } finally {
      setSubmitting(false);
    }
  };

  const filteredExams = exams.filter(exam =>
    exam.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (exam.description && exam.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', bgcolor: '#F1F5F9' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ bgcolor: '#F1F5F9', minHeight: '100vh', py: 4 }}>
      <Container maxWidth="lg">
        <Box sx={{ mb: 4, textAlign: 'center' }}>
          <Typography variant="h4" fontWeight={700} sx={{ mb: 2 }}>
            📚 Available Exams
          </Typography>
          <Typography sx={{ color: '#64748b', mb: 3 }}>
            Browse and request access to publicly available exams
          </Typography>
          
          <TextField
            fullWidth
            maxWidth={600}
            placeholder="Search exams..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            sx={{ 
              maxWidth: 600, 
              mx: 'auto',
              '& .MuiOutlinedInput-root': { 
                borderRadius: 2,
                bgcolor: 'white'
              } 
            }}
          />
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {filteredExams.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="h6" sx={{ color: '#64748b' }}>
              {searchTerm ? 'No exams match your search' : 'No public exams available at this time'}
            </Typography>
          </Box>
        ) : (
          <Grid container spacing={3}>
            {filteredExams.map((exam) => (
              <Grid item xs={12} sm={6} md={4} key={exam._id}>
                <Card 
                  elevation={0}
                  sx={{ 
                    height: '100%', 
                    display: 'flex', 
                    flexDirection: 'column',
                    borderRadius: 3,
                    border: '1px solid #e2e8f0',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.1)'
                    }
                  }}
                >
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>
                      {exam.title}
                    </Typography>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        color: '#64748b', 
                        mb: 2,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}
                    >
                      {exam.publicDescription || exam.description}
                    </Typography>
                    
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                      <Chip 
                        label={`${exam.timeLimit} min`}
                        size="small"
                        sx={{ bgcolor: '#E0F2FE', color: '#0369A1', fontWeight: 600 }}
                      />
                      {exam.publicPrice > 0 && (
                        <Chip 
                          label={`RWF ${exam.publicPrice}`}
                          size="small"
                          sx={{ bgcolor: '#FEF3C7', color: '#B45309', fontWeight: 600 }}
                        />
                      )}
                      {exam.publicPrice === 0 && (
                        <Chip 
                          label="FREE"
                          size="small"
                          sx={{ bgcolor: '#DCFCE7', color: '#15803D', fontWeight: 600 }}
                        />
                      )}
                    </Box>

                    <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                      By {exam.createdBy?.fullName || 'Unknown'}
                    </Typography>
                  </CardContent>
                  <CardActions sx={{ p: 2, pt: 0 }}>
                    <Button
                      fullWidth
                      variant="contained"
                      onClick={() => handleExamClick(exam)}
                      sx={{ 
                        borderRadius: 2, 
                        textTransform: 'none', 
                        fontWeight: 700,
                        py: 1.5
                      }}
                    >
                      Request Access
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Container>

      {/* Request Dialog */}
      {requestDialog.open && (
        <Box sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          bgcolor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999
        }}>
          <Box sx={{
            bgcolor: 'white',
            borderRadius: 3,
            maxWidth: 500,
            width: '90%',
            maxHeight: '90vh',
            overflowY: 'auto',
            p: 4
          }}>
            <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
              Request Exam Access
            </Typography>
            
            <Box sx={{ bgcolor: '#F8FAFC', p: 2, borderRadius: 2, mb: 3 }}>
              <Typography variant="h6" fontWeight={600} sx={{ mb: 1 }}>
                {requestDialog.exam?.title}
              </Typography>
              <Typography variant="body2" sx={{ color: '#64748b' }}>
                {requestDialog.exam?.publicDescription || requestDialog.exam?.description}
              </Typography>
              {requestDialog.exam?.publicPrice > 0 && (
                <Typography variant="h6" fontWeight={700} sx={{ color: '#B45309', mt: 2 }}>
                  Price: RWF {requestDialog.exam.publicPrice}
                </Typography>
              )}
            </Box>

            {submitMessage && (
              <Alert severity={submitMessage.type} sx={{ mb: 3 }}>
                {submitMessage.text}
              </Alert>
            )}

            <form onSubmit={handleRequestSubmit}>
              <TextField
                fullWidth
                label="Full Name *"
                value={requestForm.name}
                onChange={(e) => setRequestForm({ ...requestForm, name: e.target.value })}
                required
                sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />
              
              <TextField
                fullWidth
                label="Email Address *"
                type="email"
                value={requestForm.email}
                onChange={(e) => setRequestForm({ ...requestForm, email: e.target.value })}
                required
                sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />
              
              <TextField
                fullWidth
                label="Phone Number (optional)"
                value={requestForm.phone}
                onChange={(e) => setRequestForm({ ...requestForm, phone: e.target.value })}
                sx={{ mb: 3, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />

              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button
                  type="button"
                  variant="outlined"
                  onClick={() => setRequestDialog({ open: false, exam: null })}
                  disabled={submitting}
                  sx={{ 
                    flex: 1, 
                    borderRadius: 2, 
                    textTransform: 'none', 
                    fontWeight: 600 
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={submitting}
                  sx={{ 
                    flex: 1, 
                    borderRadius: 2, 
                    textTransform: 'none', 
                    fontWeight: 700 
                  }}
                >
                  {submitting ? 'Submitting...' : 'Submit Request'}
                </Button>
              </Box>
            </form>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default PublicExamList;
