import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Box, Typography, Card, CardContent, Button, TextField, CircularProgress, Alert, Grid, Chip, Divider } from '@mui/material';
import { ArrowBack, School, AccessTime, AttachMoney, CheckCircle } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useThemeMode } from '../context/ThemeContext';
import Nav from '../components/Nav';
import SEO from '../components/SEO';
import api from '../services/api';

const ExamRequest = () => {
  const { examId } = useParams();
  const [searchParams] = useSearchParams();
  const isRetake = searchParams.get('retake') === 'true';
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

  // Auto-handle free exams and free retakes
  useEffect(() => {
    const effectivePrice = isRetake ? (exam?.retakePrice ?? 0) : (exam?.publicPrice ?? 0);
    if (exam && effectivePrice === 0 && isAuthenticated && user?.role === 'student') {
      handleAutoAccess();
    }
  }, [exam, isAuthenticated, user, isRetake]);

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

    // For authenticated students, no form fields are required
    // For unauthenticated users, name and phone are required
    if (!isAuthenticated) {
      if (!formData.name) {
        setError('Name is required');
        return;
      }
      if (!formData.phone) {
        setError('Phone number is required');
        return;
      }
    }

    try {
      setSubmitting(true);
      setError(null);

      // The server will use authenticated user info if available
      const response = await api.post(`/marketplace/exams/${examId}/request`, {
        ...formData,
        isRetake
      });

      setSuccess(true);

      // Check if auto-approved (free exam/retake)
      const isAutoApproved = response.data?.autoApproved;

      // For auto-approved retakes, add delay to ensure DB deletion is committed
      if (isAutoApproved && isRetake) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      setTimeout(() => {
        navigate('/student/dashboard');
      }, 3000);
    } catch (err) {
      console.error('Error submitting request:', err);
      const errorMessage = err.response?.data?.message || 'Failed to submit request. Please try again.';

      // Check if error is due to pending request or already approved
      if (errorMessage.toLowerCase().includes('pending') ||
          errorMessage.toLowerCase().includes('already') ||
          errorMessage.toLowerCase().includes('approved')) {
        // Show user-friendly message and redirect to dashboard
        setError(errorMessage + ' Redirecting to your dashboard...');
        setTimeout(() => {
          navigate('/student/dashboard');
        }, 2000);
      } else {
        setError(errorMessage);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleAutoAccess = async () => {
    try {
      setSubmitting(true);
      const response = await api.post(`/marketplace/exams/${examId}/request`, { ...formData, isRetake });
      setSuccess(true);

      // For free exams, backend returns autoApproved: true with shareToken
      // Redirect directly to the exam instead of dashboard
      const { shareToken, autoApproved } = response.data;

      if (autoApproved && shareToken) {
        // Small delay to ensure database deletion is committed (for retakes)
        if (isRetake) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        // Redirect directly to exam for instant access
        navigate(`/exam/${shareToken}`);
      } else {
        // Fallback to dashboard if something went wrong
        navigate('/student/dashboard');
      }
    } catch (err) {
      console.error('Error auto-granting access:', err);
      const errorMessage = err.response?.data?.message || 'Failed to grant access. Please try again.';

      // Check if error is due to pending request or already approved
      if (errorMessage.toLowerCase().includes('pending') ||
          errorMessage.toLowerCase().includes('already') ||
          errorMessage.toLowerCase().includes('approved')) {
        setError(errorMessage + ' Redirecting to your dashboard...');
        setTimeout(() => {
          navigate('/student/dashboard');
        }, 2000);
      } else {
        setError(errorMessage);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const calculateTotalQuestions = (sections) => {
    return sections?.reduce((sum, section) => sum + (section.questions?.length || 0), 0) || 0;
  };

  // Calculate effective price based on actual exam pricing
  const getEffectivePrice = () => {
    if (isRetake) {
      return exam?.retakePrice ?? 0;
    }
    return exam?.publicPrice ?? 0;
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
      {exam && (
        <SEO
          title={`${exam.title} - Public Exam | eexams`}
          description={`${exam.publicDescription || exam.description} - ${calculateTotalQuestions(exam.sections)} questions, ${exam.timeLimit} minutes. Request access to this exam on eexams.`}
          keywords={`${exam.title}, ${exam.level?.name || exam.targetAudience}, exam, Rwanda, ${exam.subLevel || ''}, practice test, study material`}
          ogUrl={`https://www.eexams.net/marketplace/exams/${examId}/request`}
          canonical={`https://www.eexams.net/marketplace/exams/${examId}/request`}
          breadcrumbs={[
            { name: 'Home', url: 'https://www.eexams.net/' },
            { name: 'Marketplace', url: 'https://www.eexams.net/marketplace' },
            { name: exam.title, url: `https://www.eexams.net/marketplace/exams/${examId}/request` }
          ]}
          structuredData={{
            '@context': 'https://schema.org',
            '@type': 'Quiz',
            name: exam.title,
            description: exam.publicDescription || exam.description,
            educationalLevel: exam.level?.name || exam.targetAudience,
            learningResourceType: 'Exam',
            timeRequired: `PT${exam.timeLimit}M`,
            about: {
              '@type': 'Thing',
              name: exam.level?.name || exam.targetAudience
            },
            offers: exam.publicPrice > 0 ? {
              '@type': 'Offer',
              price: exam.publicPrice,
              priceCurrency: 'RWF',
              availability: 'https://schema.org/InStock'
            } : {
              '@type': 'Offer',
              price: '0',
              priceCurrency: 'RWF',
              availability: 'https://schema.org/InStock'
            },
            provider: {
              '@type': 'Organization',
              name: 'eexams',
              url: 'https://www.eexams.net/'
            }
          }}
        />
      )}
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
          <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
            <Button
              onClick={() => navigate('/marketplace')}
              sx={{ textTransform: 'none', fontWeight: 600, color: '#64748B' }}
              startIcon={<ArrowBack />}
            >
              Back to Marketplace
            </Button>
            {isAuthenticated && user?.role === 'student' && (
              <Button
                onClick={() => navigate('/student/dashboard')}
                sx={{ textTransform: 'none', fontWeight: 600, color: '#0D406C' }}
              >
                Go to Dashboard
              </Button>
            )}
          </Box>

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
              {getEffectivePrice() === 0
                ? 'Access granted! Redirecting to exam...'
                : 'Request submitted successfully! The teacher will review your request. Redirecting to dashboard...'}
            </Alert>
          )}

          {exam && (
            <Grid container spacing={3}>
              {/* Request Form Card */}
              <Grid item xs={12} md={12}>
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
                          {isRetake ? 'Request Retake' : 'Request Access'}
                        </Typography>
                        <Typography sx={{ color: '#64748B', fontSize: 14 }}>
                          {isRetake ? 'Submit your retake request for this exam' : 'Fill in your details to request access to this exam'}
                        </Typography>
                      </Box>
                    </Box>

                    <Divider sx={{ mb: 3 }} />

                    {isAuthenticated ? (
                      <>
                        <Box sx={{ mb: 3, p: 3, borderRadius: 2, bgcolor: 'rgba(12,189,115,0.08)', border: '1px solid rgba(12,189,115,0.2)' }}>
                          <Typography sx={{ fontSize: 14, fontWeight: 600, color: '#0CBD73', mb: 2 }}>
                            Payment & Approval Information
                          </Typography>
                          {getEffectivePrice() > 0 ? (
                            <>
                              <Box sx={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'space-between', 
                                p: 2, 
                                borderRadius: 2, 
                                background: 'rgba(245,158,11,0.08)', 
                                border: '1px solid rgba(245,158,11,0.2)',
                                mb: 2
                              }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <AttachMoney sx={{ color: '#F59E0B', fontSize: 20 }} />
                                  <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#64748B' }}>
                                    {isRetake && exam?.publicPrice === 0 ? 'Retake Fee' : 'Amount to Pay'}
                                  </Typography>
                                </Box>
                                <Typography sx={{ fontSize: 18, fontWeight: 700, color: '#F59E0B' }}>
                                  RWF {getEffectivePrice().toLocaleString()}
                                </Typography>
                              </Box>
                              <Typography sx={{ fontSize: 13, color: '#64748B', lineHeight: 1.8, mb: 2 }}>
                                {isRetake && exam?.publicPrice === 0
                                  ? 'Retake fee for this free exam. Please contact us for payment instructions and approval:'
                                  : 'To complete your request, please contact us for payment instructions and approval:'}
                              </Typography>
                            </>
                          ) : (
                            <Typography sx={{ fontSize: 13, color: '#64748B', lineHeight: 1.8, mb: 2 }}>
                              This is a free exam. You will be granted access automatically.
                            </Typography>
                          )}
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            <Typography sx={{ fontSize: 14, fontWeight: 600, color: '#0F172A' }}>
                              📞 +250 788 535 156
                            </Typography>
                            <Typography sx={{ fontSize: 14, fontWeight: 600, color: '#0F172A' }}>
                              📞 +250 793 828 834
                            </Typography>
                            <Typography sx={{ fontSize: 14, fontWeight: 600, color: '#0F172A' }}>
                              📞 +250 781 671 517
                            </Typography>
                          </Box>
                        </Box>

                        {getEffectivePrice() > 0 && (
                          <Button
                            onClick={handleSubmit}
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
                              isRetake ? 'Request Retake' : 'Request Access'
                            )}
                          </Button>
                        )}
                      </>
                    ) : (
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
                    )}

                    {getEffectivePrice() > 0 && (
                      <Box sx={{ mt: 3, p: 2, borderRadius: 2, bgcolor: 'rgba(13,64,108,0.05)' }}>
                        <Typography sx={{ fontSize: 13, color: '#64748B', lineHeight: 1.6 }}>
                          <strong>Note:</strong> The teacher will review your request and approve or reject it.
                          You will be notified once a decision is made. If approved, you'll receive access to take the exam.
                        </Typography>
                      </Box>
                    )}
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
