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
  InputAdornment,
  Select,
  MenuItem
} from '@mui/material';
import {
  WorkspacePremium,
  CheckCircle,
  ArrowBack,
  PhoneAndroid,
  CreditCard,
  Phone,
  Refresh
} from '@mui/icons-material';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const COUNTRY_CODES = [
  { code: '+250', country: 'Rwanda',   flag: '🇷🇼' },
  { code: '+256', country: 'Uganda',   flag: '🇺🇬' },
  { code: '+257', country: 'Burundi',  flag: '🇧🇮' },
  { code: '+243', country: 'DR Congo', flag: '🇨🇩' },
  { code: '+255', country: 'Tanzania', flag: '🇹🇿' },
  { code: '+254', country: 'Kenya',    flag: '🇰🇪' },
];

// Parse a stored profile phone into { code, local } pieces
const parseProfilePhone = (phone) => {
  if (!phone) return { code: '+250', local: '' };
  const p = phone.replace(/[\s\-().]/g, '');
  for (const { code } of COUNTRY_CODES) {
    const num = code.slice(1); // "250", "256", …
    if (p.startsWith('+' + num)) return { code, local: p.slice(code.length) };
    if (p.startsWith(num) && p.length > num.length) return { code, local: p.slice(num.length) };
  }
  if (p.startsWith('0') && p.length === 10) return { code: '+250', local: p.slice(1) };
  return { code: '+250', local: p };
};

const PAYMENT_METHODS = [
  {
    id: 'mobile_money',
    label: 'MTN Mobile Money',
    description: 'Pay via MTN MoMo push prompt',
    icon: <PhoneAndroid />,
    color: '#FFC107',
    textColor: '#000',
    requiresPhone: true,
    phonePlaceholder: '781 234 567',
    phoneHelperText: 'MTN numbers start with 78 or 79',
    phoneLocalRegex: /^(78|79)\d{7}$/,
    phoneError: 'Enter a valid MTN number (78 or 79 followed by 7 digits)',
  },
  {
    id: 'airtel_money',
    label: 'Airtel Money',
    description: 'Pay via Airtel Money push prompt',
    icon: <Phone />,
    color: '#F44336',
    textColor: '#fff',
    requiresPhone: true,
    phonePlaceholder: '721 234 567',
    phoneHelperText: 'Airtel numbers start with 72 or 73',
    phoneLocalRegex: /^(72|73)\d{7}$/,
    phoneError: 'Enter a valid Airtel number (72 or 73 followed by 7 digits)',
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
    phoneHelperText: '',
    phoneLocalRegex: null,
    phoneError: '',
  },
];

const GATEWAY_ERROR_MESSAGES = {
  'payment request failed': 'Payment failed. Please make sure your phone number is registered for {method} and has sufficient balance.',
  'invalid phone': 'The phone number you entered is not registered for {method}. Please use your active mobile money number.',
  'phone not found': 'Phone number not found. Please enter the number registered with your {method} account.',
  'insufficient funds': 'Insufficient balance. Please top up your {method} wallet and try again.',
  'transaction failed': 'Transaction could not be processed. Please check your phone number and try again.',
};

const getFriendlyErrorMessage = (rawMessage, paymentMethod) => {
  if (!rawMessage) return 'Payment failed. Please try again.';
  const methodLabel = paymentMethod === 'mobile_money' ? 'MTN MoMo'
    : paymentMethod === 'airtel_money' ? 'Airtel Money'
    : 'card';
  const lower = rawMessage.toLowerCase();
  for (const [key, template] of Object.entries(GATEWAY_ERROR_MESSAGES)) {
    if (lower.includes(key)) {
      return template.replace(/{method}/g, methodLabel);
    }
  }
  return rawMessage;
};

const SubscriptionPurchase = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [plans, setPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('mobile_money');
  const [countryCode, setCountryCode] = useState('+250');
  const [localPhone, setLocalPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [mobilePending, setMobilePending] = useState(false);
  const [pendingReference, setPendingReference] = useState(null);
  const [paymentCancelled, setPaymentCancelled] = useState(false);

  useEffect(() => {
    if (!user?.level) {
      navigate('/student/dashboard');
      return;
    }
    fetchPlans();
  }, [user]);

  // Auto-fill phone from profile on mount
  useEffect(() => {
    if (user?.phone) {
      const { code, local } = parseProfilePhone(user.phone);
      setCountryCode(code);
      setLocalPhone(local);
    }
  }, []);

  // Poll for payment status while mobile payment is pending
  useEffect(() => {
    if (!mobilePending || !pendingReference) return;

    const interval = setInterval(async () => {
      try {
        const res = await api.get(`/subscriptions/payment-status/${pendingReference}`);
        const { status, cancelled, success } = res.data;
        if (success || status === 'completed') {
          clearInterval(interval);
          setMobilePending(false);
          navigate('/student/dashboard');
        } else if (cancelled || status === 'cancelled') {
          clearInterval(interval);
          setMobilePending(false);
          setPaymentCancelled(true);
          setPendingReference(null);
        }
        // status === 'pending' → keep polling
      } catch {
        // network hiccup — keep polling
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [mobilePending, pendingReference]);

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

  const validatePhone = (value, code = countryCode) => {
    if (!selectedMethodConfig?.requiresPhone) return true;
    const cleaned = value.replace(/[\s\-]/g, '');
    if (!cleaned) {
      setPhoneError('Phone number is required');
      return false;
    }
    if (code === '+250' && selectedMethodConfig.phoneLocalRegex) {
      if (!selectedMethodConfig.phoneLocalRegex.test(cleaned)) {
        setPhoneError(selectedMethodConfig.phoneError);
        return false;
      }
    } else if (!/^\d{7,12}$/.test(cleaned)) {
      setPhoneError('Enter a valid phone number (7–12 digits)');
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
    if (selectedMethodConfig?.requiresPhone && !validatePhone(localPhone)) return;

    try {
      setSubmitting(true);
      setError(null);
      setMobilePending(false);
      setPaymentCancelled(false);
      setPendingReference(null);

      const payload = { planId: selectedPlan, paymentMethod };
      if (selectedMethodConfig?.requiresPhone) payload.phone = countryCode + localPhone.replace(/[\s\-]/g, '');

      const response = await api.post('/subscriptions/initiate', payload);

      if (response.data.success) {
        if (response.data.paymentUrl) {
          // Card: redirect to payment gateway
          window.location.href = response.data.paymentUrl;
        } else {
          // Mobile money: push sent to phone — start polling
          setPendingReference(response.data.reference);
          setMobilePending(true);
        }
      } else {
        setError('Failed to initiate payment. Please try again.');
      }
    } catch (err) {
      console.error('Error purchasing subscription:', err);
      const rawMsg = err.response?.data?.message || '';
      setError(getFriendlyErrorMessage(rawMsg, paymentMethod));
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

      {paymentCancelled && (
        <Alert
          severity="error"
          sx={{ mb: 3 }}
          action={
            <Button
              color="inherit"
              size="small"
              startIcon={<Refresh />}
              onClick={() => setPaymentCancelled(false)}
            >
              Try Again
            </Button>
          }
        >
          <Typography fontWeight="bold">Payment cancelled</Typography>
          <Typography variant="body2">
            You cancelled the USSD payment prompt. You can request again whenever you&apos;re ready.
          </Typography>
        </Alert>
      )}

      {mobilePending && (
        <Alert severity="info" sx={{ mb: 3 }} icon={<PhoneAndroid />}>
          <Typography fontWeight="bold">Payment prompt sent to your phone!</Typography>
          <Typography variant="body2" sx={{ mt: 0.5 }}>
            Open your <strong>{paymentMethod === 'mobile_money' ? 'MTN MoMo' : 'Airtel Money'}</strong> app or dial the USSD code to approve the payment of{' '}
            <strong>RWF {selectedPlanData?.price?.toLocaleString()}</strong>.
            Your subscription will activate automatically once the payment is confirmed.
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Payments are securely processed by <strong>ITEC Pay</strong>.
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
                    onClick={() => {
                      setPaymentMethod(method.id);
                      setPhoneError('');
                      if (user?.phone) {
                        const { code, local } = parseProfilePhone(user.phone);
                        setCountryCode(code);
                        setLocalPhone(local);
                      } else {
                        setLocalPhone('');
                      }
                    }}
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
                  value={localPhone}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^\d\s\-]/g, '');
                    setLocalPhone(val);
                    if (phoneError) validatePhone(val);
                  }}
                  error={!!phoneError}
                  helperText={phoneError || selectedMethodConfig.phoneHelperText}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start" sx={{ mr: 0 }}>
                        <Select
                          value={countryCode}
                          onChange={(e) => {
                            setCountryCode(e.target.value);
                            if (phoneError) validatePhone(localPhone, e.target.value);
                          }}
                          variant="standard"
                          disableUnderline
                          renderValue={(val) => {
                            const entry = COUNTRY_CODES.find(c => c.code === val);
                            return (
                              <Typography variant="body2" sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                                {entry?.flag} {val}
                              </Typography>
                            );
                          }}
                          sx={{ minWidth: 90, '& .MuiSelect-select': { py: 0 } }}
                        >
                          {COUNTRY_CODES.map(({ code, country, flag }) => (
                            <MenuItem key={code} value={code}>
                              <Typography variant="body2">{flag} {code} — {country}</Typography>
                            </MenuItem>
                          ))}
                        </Select>
                        <Divider orientation="vertical" flexItem sx={{ mx: 1, my: 0.5 }} />
                      </InputAdornment>
                    )
                  }}
                  sx={{ mb: 2 }}
                  size="small"
                  inputProps={{ inputMode: 'tel' }}
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
                  variant="outlined"
                  color="error"
                  fullWidth
                  size="small"
                  startIcon={<Refresh />}
                  onClick={() => {
                    setMobilePending(false);
                    setPendingReference(null);
                    setPaymentCancelled(true);
                  }}
                  sx={{ mt: 1 }}
                >
                  Cancel &amp; Try Again
                </Button>
              )}

              {mobilePending && (
                <Button
                  variant="text"
                  fullWidth
                  size="small"
                  onClick={() => navigate('/student/dashboard')}
                  sx={{ mt: 0.5 }}
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
