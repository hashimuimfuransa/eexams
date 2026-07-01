import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Button,
  Radio,
  RadioGroup,
  FormControlLabel,
  CircularProgress,
  Alert,
  Chip,
  Divider,
  Grid,
  Paper
} from '@mui/material';
import { WorkspacePremium, CheckCircle, ArrowBack } from '@mui/icons-material';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const SubscriptionPurchase = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [plans, setPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!user?.level) {
      navigate('/student/dashboard');
      return;
    }
    fetchPlans();
  }, [user]);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`/subscription-plans/level/${user.level._id}/active`, {
        params: user.subLevel ? { subLevel: user.subLevel } : {}
      });
      setPlans(response.data || []);
    } catch (err) {
      console.error('Error fetching plans:', err);
      setError('Failed to load subscription plans. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async () => {
    if (!selectedPlan) {
      setError('Please select a subscription plan');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      
      // Initiate payment with ITEC gateway
      const response = await api.post('/subscriptions/initiate', { planId: selectedPlan });
      
      if (response.data.success && response.data.paymentUrl) {
        // Redirect to payment gateway
        window.location.href = response.data.paymentUrl;
      } else {
        setError('Failed to initiate payment. Please try again.');
      }
    } catch (err) {
      console.error('Error purchasing subscription:', err);
      setError(err.response?.data?.message || 'Failed to purchase subscription. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, textAlign: 'center' }}>
        <CircularProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>Loading subscription plans...</Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 8 }}>
      <Button
        startIcon={<ArrowBack />}
        onClick={() => navigate('/student/dashboard')}
        sx={{ mb: 3 }}
      >
        Back to Dashboard
      </Button>

      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <Typography variant="h4" fontWeight="bold" gutterBottom sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
          <WorkspacePremium color="primary" fontSize="large" />
          Choose Your Subscription Plan
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Select a plan for {user?.level?.name || 'your level'} to access all subscription exams
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Subscription purchased successfully! Redirecting to dashboard...
        </Alert>
      )}

      {plans.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2 }}>
          <Typography variant="h6" color="text.secondary">
            No subscription plans available for your level yet.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Please contact support for more information.
          </Typography>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <RadioGroup value={selectedPlan} onChange={(e) => setSelectedPlan(e.target.value)}>
              {plans.map((plan) => (
                <Card
                  key={plan._id}
                  elevation={selectedPlan === plan._id ? 3 : 1}
                  sx={{
                    mb: 2,
                    border: selectedPlan === plan._id ? '2px solid' : '1px solid',
                    borderColor: selectedPlan === plan._id ? 'primary.main' : 'divider',
                    borderRadius: 2,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      boxShadow: 2
                    }
                  }}
                  onClick={() => setSelectedPlan(plan._id)}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
                      <Box sx={{ flex: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                          <Radio checked={selectedPlan === plan._id} value={plan._id} />
                          <Typography variant="h6" fontWeight="bold">
                            {plan.name}
                          </Typography>
                          <Chip
                            label={plan.subLevel ? plan.subLevel : 'Entire Level'}
                            color={plan.subLevel ? 'default' : 'primary'}
                            size="small"
                            variant="outlined"
                          />
                          {plan.discountPercentage > 0 && (
                            <Chip
                              label={`${plan.discountPercentage}% OFF`}
                              color="error"
                              size="small"
                              sx={{ fontWeight: 500 }}
                            />
                          )}
                        </Box>
                        <Typography variant="h4" fontWeight="bold" color="primary" sx={{ mb: 1 }}>
                          {plan.currency === 'RWF' ? 'RWF' : '$'} {plan.price.toLocaleString()}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          {plan.durationDays} days access
                        </Typography>
                        {plan.features && plan.features.length > 0 && (
                          <Box sx={{ mt: 2 }}>
                            {plan.features.map((feature, idx) => (
                              <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                <CheckCircle color="success" fontSize="small" />
                                <Typography variant="body2">{feature}</Typography>
                              </Box>
                            ))}
                          </Box>
                        )}
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </RadioGroup>
          </Grid>

          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3, position: 'sticky', top: 100, borderRadius: 2 }}>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                Order Summary
              </Typography>
              <Divider sx={{ my: 2 }} />
              {selectedPlan ? (
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body1">Selected Plan:</Typography>
                    <Typography variant="body1" fontWeight="bold">
                      {plans.find(p => p._id === selectedPlan)?.name}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body1">Duration:</Typography>
                    <Typography variant="body1">
                      {plans.find(p => p._id === selectedPlan)?.durationDays} days
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                    <Typography variant="body1">Level:</Typography>
                    <Typography variant="body1">{user?.level?.name}</Typography>
                  </Box>
                  <Divider sx={{ my: 2 }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                    <Typography variant="h6" fontWeight="bold">Total:</Typography>
                    <Typography variant="h6" fontWeight="bold" color="primary">
                      {plans.find(p => p._id === selectedPlan)?.currency === 'RWF' ? 'RWF' : '$'}{' '}
                      {plans.find(p => p._id === selectedPlan)?.price.toLocaleString()}
                    </Typography>
                  </Box>
                  <Button
                    variant="contained"
                    fullWidth
                    size="large"
                    onClick={handlePurchase}
                    disabled={submitting}
                    sx={{ borderRadius: 2, py: 1.5 }}
                  >
                    {submitting ? <CircularProgress size={24} color="inherit" /> : 'Purchase Subscription'}
                  </Button>
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary" align="center">
                  Select a plan to see order summary
                </Typography>
              )}
            </Paper>
          </Grid>
        </Grid>
      )}
    </Container>
  );
};

export default SubscriptionPurchase;
