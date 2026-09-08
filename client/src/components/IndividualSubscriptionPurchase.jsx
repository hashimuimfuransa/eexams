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
  CircularProgress,
  Alert,
  Chip,
  Divider,
  Grid,
  Paper,
  TextField,
  InputAdornment,
  Select,
  MenuItem,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip
} from '@mui/material';
import {
  WorkspacePremium,
  CheckCircle,
  ArrowBack,
  PhoneAndroid,
  CreditCard,
  Phone,
  Refresh,
  MenuBook,
  Assignment,
  Cancel
} from '@mui/icons-material';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatPlanDuration, getPlanScope, getPlanScopeMeta, planSellsExams, planSellsLessonPlanner } from '../utils/planUtils';

const COUNTRY_CODES = [
  { code: '+250', country: 'Rwanda',   flag: '🇷🇼' },
  { code: '+256', country: 'Uganda',   flag: '🇺🇬' },
  { code: '+257', country: 'Burundi',  flag: '🇧🇮' },
  { code: '+243', country: 'DR Congo', flag: '🇨🇩' },
  { code: '+255', country: 'Tanzania', flag: '🇹🇿' },
  { code: '+254', country: 'Kenya',    flag: '🇰🇪' },
];

const parseProfilePhone = (phone) => {
  if (!phone) return { code: '+250', local: '' };
  const p = phone.replace(/[\s\-().]/g, '');
  for (const { code } of COUNTRY_CODES) {
    const num = code.slice(1);
    if (p.startsWith('+' + num)) return { code, local: p.slice(code.length) };
    if (p.startsWith(num) && p.length > num.length) return { code, local: p.slice(num.length) };
  }
  if (p.startsWith('0') && p.length === 10) return { code: '+250', local: p.slice(1) };
  return { code: '+250', local: p };
};

// Teachers shop by what they want, not by tier — a Lesson-Planner-only plan
// and a full plan can both be "Basic". 'all' stays the default so nobody has
// to make this choice before seeing the catalog.
const SCOPE_FILTERS = [
  { key: 'all', label: 'All plans' },
  { key: 'lesson_planner', label: 'Lesson Planner' },
  { key: 'exams', label: 'Exams' }
];

// Which plans belong under each filter: a plan that sells both shows under
// either product, since it does cover it.
const matchesScopeFilter = (plan, filter) => {
  const scope = getPlanScope(plan);
  if (filter === 'all') return true;
  return scope === filter || scope === 'both';
};

// Monthly Lesson Planner output, in price-card order. Mirrors
// PLANNER_QUOTA_FIELDS on the server; a null value means the plan inherits its
// tier default, which the client can't know, so that line is simply omitted.
const QUOTA_LINES = [
  { key: 'lessonPlansPerMonth', noun: 'lesson plans' },
  { key: 'slidesPerMonth', noun: 'slides' },
  { key: 'exercisesPerMonth', noun: 'exercises' },
  { key: 'schemesPerMonth', noun: 'schemes' }
];

const isFreePlan = (plan) => plan?.tierKey === 'free' || !(plan?.price > 0);

// The checklist under each price. Built from the plan's own stored numbers so
// the card can never advertise something different from what was configured;
// `plan.features` is the fallback for catalog rows saved before the quota
// fields existed.
const planCardLines = (plan) => {
  const lines = [];

  if (planSellsLessonPlanner(plan)) {
    QUOTA_LINES.forEach(({ key, noun }) => {
      const value = plan?.[key];
      if (value === null || value === undefined) return;
      lines.push({ text: value === -1 ? `Unlimited ${noun}` : `${value} ${noun}/mo`, included: true });
    });
  }

  if (planSellsExams(plan)) {
    if (plan?.maxExams !== null && plan?.maxExams !== undefined) {
      lines.push({ text: plan.maxExams === -1 ? 'Unlimited exams' : `Up to ${plan.maxExams} exams`, included: true });
    }
    if (plan?.maxStudents !== null && plan?.maxStudents !== undefined) {
      lines.push({ text: plan.maxStudents === -1 ? 'Unlimited students' : `Up to ${plan.maxStudents} students`, included: true });
    }
  }

  // Nothing structured to show — fall back to whatever bullets were stored,
  // treating a "No ..." bullet as the excluded line it reads as.
  if (lines.length === 0 && plan?.features?.length) {
    return plan.features.map((text) => ({ text, included: !/^no\s/i.test(text) }));
  }

  lines.push({ text: 'Single user', included: true });
  if (plan?.docxExport !== false) lines.push({ text: 'PDF & DOCX export', included: true });
  lines.push({
    text: plan?.prioritySupport ? 'Priority email support' : 'No priority support',
    included: !!plan?.prioritySupport
  });

  return lines;
};

const SCOPE_ICONS = {
  both: <WorkspacePremium fontSize="small" />,
  lesson_planner: <MenuBook fontSize="small" />,
  exams: <Assignment fontSize="small" />
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

const IndividualSubscriptionPurchase = () => {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  const [plans, setPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState('');
  const [scopeFilter, setScopeFilter] = useState('all');
  const [paymentMethod, setPaymentMethod] = useState('mobile_money');
  const [countryCode, setCountryCode] = useState('+250');
  const [localPhone, setLocalPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [mobilePending, setMobilePending] = useState(false);
  const [pendingReference, setPendingReference] = useState(null);
  const [pendingPlanData, setPendingPlanData] = useState(null);
  const [paymentCancelled, setPaymentCancelled] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  // Org teachers don't have their own plan — bounce them to the dashboard
  useEffect(() => {
    if (user?.isOrgTeacher || user?.parentAdmin) {
      navigate('/teacher');
    }
  }, [user, navigate]);

  useEffect(() => {
    fetchPlans();
  }, []);

  useEffect(() => {
    if (user?.phone) {
      const { code, local } = parseProfilePhone(user.phone);
      setCountryCode(code);
      setLocalPhone(local);
    }

    const saved = sessionStorage.getItem('pendingIndividualPayment');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.reference && data.paymentMethod) {
          setPendingReference(data.reference);
          setPaymentMethod(data.paymentMethod);
          if (data.planId) setSelectedPlan(data.planId);
          if (data.plan) setPendingPlanData(data.plan);
          setMobilePending(true);
        }
      } catch {
        sessionStorage.removeItem('pendingIndividualPayment');
      }
    }
  }, []);

  useEffect(() => {
    if (!mobilePending || !pendingReference) return;

    const interval = setInterval(async () => {
      try {
        const res = await api.get(`/subscriptions/payment-status/${pendingReference}`);
        const { status, cancelled, success } = res.data;
        if (success || status === 'completed') {
          clearInterval(interval);
          sessionStorage.removeItem('pendingIndividualPayment');
          setMobilePending(false);
          setPendingReference(null);
          setPaymentSuccess(true);

          try {
            const verify = await api.get('/auth/verify');
            const refreshed = {
              ...user,
              subscriptionPlan: verify.data.subscriptionPlan ?? user?.subscriptionPlan,
              subscriptionStatus: verify.data.subscriptionStatus,
            };
            localStorage.setItem('user', JSON.stringify(refreshed));
            if (setUser) setUser(refreshed);
          } catch {
            // non-fatal — dashboard will pick up the fresh status on next load
          }

          setTimeout(() => navigate('/teacher'), 3000);
        } else if (cancelled || status === 'cancelled') {
          clearInterval(interval);
          sessionStorage.removeItem('pendingIndividualPayment');
          setMobilePending(false);
          setPaymentCancelled(true);
          setPendingReference(null);
          setPendingPlanData(null);
        }
      } catch {
        // network hiccup — keep polling
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [mobilePending, pendingReference, navigate, user, setUser]);

  // Keep the selection honest: a plan filtered out of view must not stay
  // selected behind the scenes and get charged from the order summary. Skipped
  // while a payment is pending, since that selection is the one being paid for.
  useEffect(() => {
    if (!selectedPlan || mobilePending) return;
    const stillVisible = plans.some(p => p._id === selectedPlan && matchesScopeFilter(p, scopeFilter));
    if (!stillVisible) setSelectedPlan('');
  }, [scopeFilter, plans, selectedPlan, mobilePending]);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/individual-plans/active');
      setPlans(response.data || []);
    } catch (err) {
      console.error('Error fetching individual plans:', err);
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
      setPaymentSuccess(false);
      setPendingReference(null);
      setPendingPlanData(null);
      sessionStorage.removeItem('pendingIndividualPayment');

      const payload = { planId: selectedPlan, paymentMethod };
      if (selectedMethodConfig?.requiresPhone) payload.phone = countryCode + localPhone.replace(/[\s\-]/g, '');

      const response = await api.post('/subscriptions/individual/initiate', payload);

      if (response.data.success) {
        if (response.data.paymentUrl) {
          window.location.href = response.data.paymentUrl;
        } else {
          const planSnapshot = {
            name: selectedPlanData?.name,
            price: selectedPlanData?.price,
            currency: selectedPlanData?.currency,
          };
          sessionStorage.setItem('pendingIndividualPayment', JSON.stringify({
            reference: response.data.reference,
            paymentMethod,
            planId: selectedPlan,
            plan: planSnapshot,
          }));
          setPendingPlanData(planSnapshot);
          setPendingReference(response.data.reference);
          setMobilePending(true);
        }
      } else {
        setError('Failed to initiate payment. Please try again.');
      }
    } catch (err) {
      console.error('Error purchasing individual subscription:', err);
      const rawMsg = err.response?.data?.message || '';
      setError(getFriendlyErrorMessage(rawMsg, paymentMethod));
    } finally {
      setSubmitting(false);
    }
  };

  if (paymentSuccess) {
    return (
      <Container maxWidth="sm" sx={{ mt: 8, textAlign: 'center' }}>
        <Paper elevation={3} sx={{ p: 6, borderRadius: 3 }}>
          <CheckCircle color="success" sx={{ fontSize: 80, mb: 2 }} />
          <Typography variant="h5" fontWeight="bold" color="success.main" gutterBottom>
            Payment Successful!
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
            Your subscription is now active.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Redirecting to your dashboard in a few seconds...
          </Typography>
          <Button
            variant="contained"
            color="success"
            size="large"
            onClick={() => navigate('/teacher')}
            sx={{ borderRadius: 2 }}
          >
            Go to Dashboard Now
          </Button>
        </Paper>
      </Container>
    );
  }

  if (loading && !mobilePending) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, textAlign: 'center' }}>
        <CircularProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>Loading subscription plans...</Typography>
      </Container>
    );
  }

  const selectedPlanData = plans.find(p => p._id === selectedPlan);
  const visiblePlans = plans.filter(p => matchesScopeFilter(p, scopeFilter));
  // subscriptionPlanRef pins the exact catalog entry the account holds, so a
  // renewal is labelled correctly even when several plans share a tier.
  const isCurrentPlan = (plan) => !!user?.subscriptionPlanRef && plan._id === user.subscriptionPlanRef;

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 8 }}>
      <Button
        startIcon={<ArrowBack />}
        onClick={() => navigate('/teacher')}
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
          Buy the AI Lesson Planner on its own, exams on their own, or both together
        </Typography>
        <ToggleButtonGroup
          value={scopeFilter}
          exclusive
          size="small"
          onChange={(e, value) => value && setScopeFilter(value)}
          sx={{ mt: 2 }}
        >
          {SCOPE_FILTERS.map(({ key, label }) => (
            <ToggleButton key={key} value={key} sx={{ textTransform: 'none', px: 2 }}>
              {label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
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
          <Typography fontWeight="bold">Payment failed</Typography>
          <Typography variant="body2">
            We couldn&apos;t confirm your payment — it may have been cancelled or timed out. Please try again; if money left your account, do not pay again until you&apos;ve confirmed with support.
          </Typography>
        </Alert>
      )}

      {mobilePending && (
        <Alert severity="info" sx={{ mb: 3 }} icon={<PhoneAndroid />}>
          <Typography fontWeight="bold">Payment prompt sent to your phone!</Typography>
          <Typography variant="body2" sx={{ mt: 0.5 }}>
            Open your <strong>{paymentMethod === 'mobile_money' ? 'MTN MoMo' : 'Airtel Money'}</strong> app or dial the USSD code to approve the payment of{' '}
            <strong>RWF {(pendingPlanData || selectedPlanData)?.price?.toLocaleString()}</strong>.
            Your subscription will activate automatically once the payment is confirmed.
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Payments are securely processed by <strong>ITEC Pay</strong>. This page will update automatically.
          </Typography>
        </Alert>
      )}

      {loading && mobilePending && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <CircularProgress size={28} />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Checking payment status...
          </Typography>
        </Box>
      )}

      {!loading && visiblePlans.length === 0 && !mobilePending ? (
        <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2 }}>
          <Typography variant="h6" color="text.secondary">
            {plans.length === 0
              ? 'No subscription plans available yet.'
              : `No plans cover ${scopeFilter === 'lesson_planner' ? 'the Lesson Planner' : 'exams'} right now.`}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {plans.length === 0
              ? 'Please contact support for more information.'
              : 'Try "All plans", or contact support for more information.'}
          </Typography>
        </Paper>
      ) : !loading && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            {/* Comparison grid: one card per plan, headline monthly allowance
                first, so tiers are compared on the number that differs. */}
            <Grid container spacing={2} alignItems="stretch">
              {visiblePlans.map((plan) => {
                const selected = selectedPlan === plan._id;
                const free = isFreePlan(plan);
                const current = isCurrentPlan(plan);
                return (
                  <Grid item xs={12} sm={6} lg={4} key={plan._id} sx={{ display: 'flex' }}>
                    <Card
                      elevation={selected ? 4 : 0}
                      onClick={() => { if (!free) setSelectedPlan(plan._id); }}
                      sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        width: '100%',
                        position: 'relative',
                        overflow: 'visible',
                        borderRadius: 2,
                        border: '2px solid',
                        borderColor: selected ? 'primary.main' : plan.isPopular ? 'primary.light' : 'divider',
                        cursor: free ? 'default' : 'pointer',
                        transition: 'all 0.2s ease',
                        mt: plan.isPopular ? 1.5 : 0,
                        '&:hover': free ? {} : { borderColor: 'primary.main', boxShadow: 3 }
                      }}
                    >
                      {plan.isPopular && (
                        <Chip
                          label={plan.badgeText || 'MOST POPULAR'}
                          color="primary"
                          size="small"
                          sx={{
                            position: 'absolute',
                            top: -12,
                            left: 16,
                            fontWeight: 700,
                            fontSize: 10,
                            letterSpacing: 0.5
                          }}
                        />
                      )}
                      <CardContent sx={{ display: 'flex', flexDirection: 'column', flex: 1, p: 2.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
                          <Typography variant="h6" fontWeight="bold">{plan.name}</Typography>
                          {plan.discountPercentage > 0 && (
                            <Chip label={`${plan.discountPercentage}% OFF`} color="error" size="small" sx={{ fontWeight: 600 }} />
                          )}
                        </Box>

                        {plan.description && (
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                            {plan.description}
                          </Typography>
                        )}

                        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, mb: 0.5 }}>
                          <Typography variant="h5" fontWeight="bold" color={free ? 'success.main' : 'primary.main'}>
                            {free ? 'FREE' : `${plan.currency === 'RWF' ? 'RWF' : '$'} ${plan.price.toLocaleString()}`}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            /{formatPlanDuration(plan)}
                          </Typography>
                        </Box>

                        <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5 }}>
                          {free ? 'Automatically assigned on signup' : getPlanScopeMeta(plan).label}
                        </Typography>

                        <Box sx={{ flex: 1 }}>
                          {planCardLines(plan).map(({ text, included }, idx) => (
                            <Box key={idx} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 0.75 }}>
                              {included
                                ? <CheckCircle color="success" sx={{ fontSize: 18, mt: '1px', flexShrink: 0 }} />
                                : <Cancel sx={{ fontSize: 18, mt: '1px', flexShrink: 0, color: 'text.disabled' }} />}
                              <Typography variant="body2" color={included ? 'text.primary' : 'text.disabled'}>
                                {text}
                              </Typography>
                            </Box>
                          ))}
                        </Box>

                        <Button
                          fullWidth
                          variant={selected ? 'contained' : 'outlined'}
                          disabled={free}
                          onClick={(e) => { e.stopPropagation(); setSelectedPlan(plan._id); }}
                          sx={{ mt: 2, borderRadius: 1.5, textTransform: 'none', fontWeight: 700 }}
                        >
                          {free
                            ? 'Free Plan - Assigned on Signup'
                            : current
                            ? 'Renew / Extend'
                            : selected
                            ? 'Selected'
                            : 'Upgrade Now'}
                        </Button>
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          </Grid>

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
                    <Typography variant="body2" color="text.secondary">Covers:</Typography>
                    <Typography variant="body2" fontWeight="bold" align="right">
                      {getPlanScopeMeta(selectedPlanData).label}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">Duration:</Typography>
                    <Typography variant="body2">{formatPlanDuration(selectedPlanData)}</Typography>
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
                    sessionStorage.removeItem('pendingIndividualPayment');
                    setMobilePending(false);
                    setPendingReference(null);
                    setPendingPlanData(null);
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
                  onClick={() => navigate('/teacher')}
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

export default IndividualSubscriptionPurchase;
