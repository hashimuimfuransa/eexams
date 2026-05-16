import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Typography, Card, CardContent, Button, TextField, CircularProgress, Alert, Grid, Chip, Divider } from '@mui/material';
import { ArrowBack, School, AccessTime, AttachMoney, CheckCircle } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useThemeMode } from '../context/ThemeContext';
import Nav from '../components/Nav';
import api from '../services/api';

const ExamRequest = () => {
  const { examId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, user, logout } = useAuth();
  const { mode, toggleMode } = useThemeMode();
  const scrollY = useState(0)[0];

  const [exam, setExam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: ''
  });

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  useEffect(() => {
    if (isAuthenticated && user) {
      setFormData({
        name: user.fullName || '',
        phone: user.phone || '',
        email: user.email || ''
      });
    }
    fetchExamDetails();
  }, [examId, isAuthenticated, user]);

  const fetchExamDetails = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/marketplace/exams/${examId}`);
      setExam(response.data);
    } catch (err) {
      console.error('Error fetching exam details:', err);
      setError('Failed to load exam details. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.phone) {
      setError('Name and phone number are required');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      
      const response = await api.post(`/marketplace/exams/${examId}/request`, formData);
      
      setSuccess(true);
      
      setTimeout(() => {
        navigate('/marketplace');
      }, 3000);
    } catch (err) {
      console.error('Error submitting request:', err);
      setError(err.response?.data?.message || 'Failed to submit request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const calculateTotalQuestions = (sections) => {
    return sections?.reduce((sum, section) => sum + (section.questions?.length || 0), 0) || 0;
  };

  if (loading) {
    return (
      <>
        <Nav 
          scrolled={scrollY > 40}
          mode={mode}
          toggleMode={toggleMode}
          isAuthenticated={isAuthenticated}
          user={user}
          handleLogout={handleLogout}
          currentRoute="/marketplace"
        />
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', bgcolor: '#F1F5F9' }}>
          <CircularProgress />
        </Box>
      </>
    );
  }

  return (
    <>
      <Nav 
        scrolled={scrollY > 40}
        mode={mode}
        toggleMode={toggleMode}
        isAuthenticated={isAuthenticated}
        user={user}
        handleLogout={handleLogout}
        currentRoute="/marketplace"
      />
      <Box sx={{ minHeight: '100vh', bgcolor: '#F1F5F9', pt: 20, pb: 8 }}>
        <Box sx={{ maxWidth: 900, margin: '0 auto', px: 3 }}>
          {/* Back Button */}
          <Button
            onClick={() => navigate('/marketplace')}
            sx={{ mb: 3, textTransform: 'none', fontWeight: 600, color: '#64748B' }}
            startIcon={<ArrowBack />}
          >
            Back to Marketplace
          </Button>

          {error && !success && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          {success && (
            <Alert 
              severity="success" 
              sx={{ mb: 3 }}
              icon={<CheckCircle />}
            >
              Request submitted successfully! The teacher will review your request. Redirecting to marketplace...
            </Alert>
          )}

          {exam && (
            <Grid container spacing={3}>
              {/* Exam Details Card */}
              <Grid item xs={12} md={5}>
                <Card 
                  elevation={0} 
                  sx={{ 
                    borderRadius: 3, 
                    border: '1px solid #E2E8F0',
                    height: 'fit-content'
                  }}
                >
                  <CardContent sx={{ p: 3 }}>
                    <Chip 
                      label="Public Exam" 
                      size="small" 
                      sx={{ 
                        background: 'linear-gradient(135deg, #0CBD73 0%, #5AD5A2 100%)',
                        color: 'white',
                        fontWeight: 700,
                        fontSize: 11,
                        letterSpacing: '0.04em',
                        mb: 2
                      }} 
                    />
                    
                    <Typography variant="h5" fontWeight={700} sx={{ mb: 2, color: '#0F172A', lineHeight: 1.3 }}>
                      {exam.title}
                    </Typography>
                    
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        color: '#64748B', 
                        mb: 3,
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        lineHeight: 1.6
                      }}
                    >
                      {exam.publicDescription || exam.description}
                    </Typography>

                    <Divider sx={{ mb: 3 }} />

                    {/* Stats */}
                    <Box sx={{ 
                      display: 'grid', 
                      gridTemplateColumns: '1fr 1fr', 
                      gap: 2, 
                      mb: 3 
                    }}>
                      <Box sx={{ textAlign: 'center', p: 2, borderRadius: 2, bgcolor: 'rgba(241,245,249,0.8)' }}>
                        <Typography sx={{ fontSize: 24, fontWeight: 800, color: '#0D406C', lineHeight: 1, mb: 0.5 }}>
                          {calculateTotalQuestions(exam.sections)}
                        </Typography>
                        <Typography sx={{ fontSize: 11, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Questions
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: 'center', p: 2, borderRadius: 2, bgcolor: 'rgba(241,245,249,0.8)' }}>
                        <Typography sx={{ fontSize: 24, fontWeight: 800, color: '#0CBD73', lineHeight: 1, mb: 0.5 }}>
                          {exam.timeLimit}
                        </Typography>
                        <Typography sx={{ fontSize: 11, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Minutes
                        </Typography>
                      </Box>
                    </Box>

                    {/* Price */}
                    {exam.publicPrice > 0 ? (
                      <Box sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between', 
                        p: 2, 
                        borderRadius: 2, 
                        background: 'rgba(245,158,11,0.08)', 
                        border: '1px solid rgba(245,158,11,0.2)'
                      }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <AttachMoney sx={{ color: '#F59E0B', fontSize: 20 }} />
                          <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#64748B' }}>Price</Typography>
                        </Box>
                        <Typography sx={{ fontSize: 18, fontWeight: 700, color: '#F59E0B' }}>
                          RWF {exam.publicPrice.toLocaleString()}
                        </Typography>
                      </Box>
                    ) : (
                      <Box sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        p: 2, 
                        borderRadius: 2, 
                        background: 'rgba(12,189,115,0.08)', 
                        border: '1px solid rgba(12,189,115,0.2)'
                      }}>
                        <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#0CBD73' }}>
                          Free Exam
                        </Typography>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Grid>

              {/* Request Form Card */}
              <Grid item xs={12} md={7}>
                <Card 
                  elevation={0} 
                  sx={{ 
                    borderRadius: 3, 
                    border: '1px solid #E2E8F0'
                  }}
                >
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                      <School sx={{ color: '#0D406C', fontSize: 28 }} />
                      <Box>
                        <Typography variant="h5" fontWeight={700} sx={{ color: '#0F172A' }}>
                          Request Access
                        </Typography>
                        <Typography sx={{ color: '#64748B', fontSize: 14 }}>
                          Fill in your details to request access to this exam
                        </Typography>
                      </Box>
                    </Box>

                    <Divider sx={{ mb: 3 }} />

                    <form onSubmit={handleSubmit}>
                      <Grid container spacing={2.5}>
                        <Grid item xs={12}>
                          <TextField
                            fullWidth
                            label="Full Name *"
                            name="name"
                            value={formData.name}
                            onChange={handleInputChange}
                            required
                            disabled={submitting || success}
                            sx={{ 
                              '& .MuiOutlinedInput-root': { borderRadius: 2 }
                            }}
                          />
                        </Grid>

                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            label="Phone Number *"
                            name="phone"
                            value={formData.phone}
                            onChange={handleInputChange}
                            required
                            disabled={submitting || success}
                            sx={{ 
                              '& .MuiOutlinedInput-root': { borderRadius: 2 }
                            }}
                          />
                        </Grid>

                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            label="Email Address"
                            name="email"
                            type="email"
                            value={formData.email}
                            onChange={handleInputChange}
                            disabled={submitting || success}
                            sx={{ 
                              '& .MuiOutlinedInput-root': { borderRadius: 2 }
                            }}
                          />
                        </Grid>

                        <Grid item xs={12}>
                          <Button
                            type="submit"
                            fullWidth
                            variant="contained"
                            disabled={submitting || success}
                            sx={{
                              borderRadius: 2,
                              textTransform: 'none',
                              fontWeight: 700,
                              py: 1.5,
                              background: 'linear-gradient(135deg, #0D406C 0%, #0CBD73 100%)',
                              boxShadow: '0 4px 12px rgba(12,189,115,0.35)',
                              fontSize: 16
                            }}
                          >
                            {submitting ? (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <CircularProgress size={20} color="inherit" />
                                Submitting...
                              </Box>
                            ) : (
                              'Submit Request'
                            )}
                          </Button>
                        </Grid>
                      </Grid>
                    </form>

                    <Box sx={{ mt: 3, p: 2, borderRadius: 2, bgcolor: 'rgba(13,64,108,0.05)' }}>
                      <Typography sx={{ fontSize: 13, color: '#64748B', lineHeight: 1.6 }}>
                        <strong>Note:</strong> The teacher will review your request and approve or reject it. 
                        You will be notified once a decision is made. If approved, you'll receive access to take the exam.
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}
        </Box>
      </Box>
    </>
  );
};

export default ExamRequest;
