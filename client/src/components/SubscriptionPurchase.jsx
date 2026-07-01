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
  Paper,
  TextField,
  InputAdornment
} from '@mui/material';
import {
  WorkspacePremium,
  CheckCircle,
  ArrowBack,
  PhoneAndroid,
  CreditCard,
  Phone
} from '@mui/icons-material';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const PAYMENT_METHODS = [
  {
    id: 'mobile_money',
    label: 'MTN Mobile Money',
    description: 'Pay via MTN MoMo push prompt',
    icon: <PhoneAndroid />,
    color: '#FFC107',
    textColor: '#000',
    requiresPhone: true,
    phonePlaceholder: '07X XXX XXXX (MTN number)',
  },
  {
    id: 'airtel_money',
    label: 'Airtel Money',
    description: 'Pay via Airtel Money push prompt',
    icon: <Phone />,
    color: '#F44336',
    textColor: '#fff',
    requiresPhone: true,
    phonePlaceholder: '073 / 072 XXXXXXX (Airtel number)',
  },
  {
    id: 'card',
    label: 'Card Payment',
    description: 'Pay with Visa / Mastercard',
    icon: <CreditCard />,
    color: '#1976D2',
    textColor: '#fff',
    requiresPhone: false,
    phonePlaceholder: '',
  },
];

const SubscriptionPurchase = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [plans, setPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('mobile_money');
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [mobilePending, setMobilePending] = useState(false);

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

  const selectedMethodConfig = PAYMENT_METHODS.find(m => m.id === paymentMethod);

  const validatePhone = (value) => {
    if (!selectedMethodConfig?.requiresPhone) return true;
    const cleaned = value.replace(/[\s\-]/g, '');
    if (!cleaned) {
      setPhoneError('Phone number is required');
      return false;
    }
    if (!/^(\+?250|0)[7-8]\d{8}$/.test(cleaned)) {
      setPhoneError('Enter a valid Rwandan phone number (e.g. 0788123456)');
      return false;
    }
    setPhoneError('');
    return true;
  };

  const handlePurchase = async () => {
    if (!selectedPlan) {
      setError('Please select a subscription plan');
      return;
    }
    if (selectedMethodConfig?.requiresPhone && !validatePhone(phone)) return;

    try {
      setSubmitting(true);
      setError(null);
      setMobilePending(false);

      const payload = { planId: selectedPlan, paymentMethod };
      if (selectedMethodConfig?.requiresPhone) payload.phone = phone.trim();

      const response = await api.post('/subscriptions/initiate', payload);

      if (response.data.success) {
        if (response.data.paymentUrl) {
          // Card: redirect to payment gateway
          window.location.href = response.data.paymentUrl;
        } else {
          // Mobile money: push sent to phone
          setMobilePending(true);
        }
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

  const selectedPlanData = plans.find(p => p._id === selectedPlan);

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
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {mobilePending && (
        <Alert severity="success" sx={{ mb: 3 }} icon={<PhoneAndroid />}>
          <Typography fontWeight="bold">Payment prompt sent to your phone!</Typography>
          <Typography variant="body2">
            Open your {paymentMethod === 'mobile_money' ? 'MTN MoMo' : 'Airtel Money'} app or dial the USSD code to approve the payment of{' '}
            <strong>RWF {selectedPlanData?.price?.toLocaleString()}</strong>.
            Your subscription will activate automatically once the payment is confirmed.
          </Typography>
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
          {/* Plans list */}
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
                    '&:hover': { boxShadow: 2 }
                  }}
                  onClick={() => setSelectedPlan(plan._id)}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
                      <Box sx={{ flex: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                          <Radio checked={selectedPlan === plan._id} value={plan._id} />
                          <Typography variant="h6" fontWeight="bold">{plan.name}</Typography>
                          <Chip
                            label={plan.subLevel ? plan.subLevel : 'Entire Level'}
                            color={plan.subLevel ? 'default' : 'primary'}
                            size="small"
                            variant="outlined"
                          />
                          {plan.discountPercentage > 0 && (
                            <Chip label={`${plan.discountPercentage}% OFF`} color="error" size="small" sx={{ fontWeight: 500 }} />
                          )}
                        </Box>
                        <Typography variant="h4" fontWeight="bold" color="primary" sx={{ mb: 1 }}>
                          {plan.currency === 'RWF' ? 'RWF' : '$'} {plan.price.toLocaleString()}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          {plan.durationDays} days access
                        </Typography>
                        {plan.features?.length > 0 && (
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

          {/* Order summary + payment method */}
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3, position: 'sticky', top: 100, borderRadius: 2 }}>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                Order Summary
              </Typography>
              <Divider sx={{ my: 2 }} />

              {selectedPlan ? (
                <>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">Plan:</Typography>
                    <Typography variant="body2" fontWeight="bold">{selectedPlanData?.name}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">Duration:</Typography>
                    <Typography variant="body2">{selectedPlanData?.durationDays} days</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">Level:</Typography>
                    <Typography variant="body2">{user?.level?.name}</Typography>
                  </Box>
                  <Divider sx={{ my: 2 }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                    <Typography variant="h6" fontWeight="bold">Total:</Typography>
                    <Typography variant="h6" fontWeight="bold" color="primary">
                      {selectedPlanData?.currency === 'RWF' ? 'RWF' : '$'}{' '}
                      {selectedPlanData?.price.toLocaleString()}
                    </Typography>
                  </Box>
                </>
              ) : (
                <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 2 }}>
                  Select a plan to see order summary
                </Typography>
              )}

              {/* Payment Method Selection */}
              <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1.5 }}>
                Payment Method
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 2 }}>
                {PAYMENT_METHODS.map((method) => (
                  <Box
                    key={method.id}
                    onClick={() => { setPaymentMethod(method.id); setPhoneError(''); }}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      p: 1.5,
                      borderRadius: 2,
                      border: '2px solid',
                      borderColor: paymentMethod === method.id ? method.color : 'divider',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      bgcolor: paymentMethod === method.id ? `${method.color}18` : 'transparent',
                      '&:hover': { borderColor: method.color, bgcolor: `${method.color}10` }
                    }}
                  >
                    <Box
                      sx={{
                        width: 36,
                        height: 36,
                        borderRadius: 1.5,
                        bgcolor: method.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: method.textColor,
                        flexShrink: 0
                      }}
                    >
                      {method.icon}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" fontWeight="bold" noWrap>{method.label}</Typography>
                      <Typography variant="caption" color="text.secondary" noWrap>{method.description}</Typography>
                    </Box>
                    <Radio
                      checked={paymentMethod === method.id}
                      size="small"
                      sx={{ p: 0, color: method.color, '&.Mui-checked': { color: method.color } }}
                      readOnly
                    />
                  </Box>
                ))}
              </Box>

              {/* Phone number input for mobile money */}
              {selectedMethodConfig?.requiresPhone && (
                <TextField
                  fullWidth
                  label="Phone Number"
                  placeholder={selectedMethodConfig.phonePlaceholder}
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    if (phoneError) validatePhone(e.target.value);
                  }}
                  error={!!phoneError}
                  helperText={phoneError || 'Enter the number registered with your mobile money account'}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <PhoneAndroid fontSize="small" color="action" />
                      </InputAdornment>
                    )
                  }}
                  sx={{ mb: 2 }}
                  size="small"
                />
              )}

              <Button
                variant="contained"
                fullWidth
                size="large"
                onClick={handlePurchase}
                disabled={submitting || !selectedPlan || mobilePending}
                sx={{ borderRadius: 2, py: 1.5 }}
              >
                {submitting
                  ? <CircularProgress size={22} color="inherit" />
                  : mobilePending
                  ? 'Waiting for payment...'
                  : `Pay with ${selectedMethodConfig?.label}`}
              </Button>

              {mobilePending && (
                <Button
                  variant="text"
                  fullWidth
                  size="small"
                  onClick={() => navigate('/student/dashboard')}
                  sx={{ mt: 1 }}
                >
                  Go to Dashboard
                </Button>
              )}
            </Paper>
          </Grid>
        </Grid>
      )}
    </Container>
  );
};

export default SubscriptionPurchase;
