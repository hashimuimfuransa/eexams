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
  MenuItem,
  ToggleButtonGroup,
  ToggleButton,
  FormControl,
  InputLabel,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  WorkspacePremium,
  CheckCircle,
  ArrowBack,
  PhoneAndroid,
  CreditCard,
  Phone,
  Refresh,
  School,
  Quiz,
  Download,
  FilterList,
  Info
} from '@mui/icons-material';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatPlanDuration } from '../utils/planUtils';

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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [planScope, setPlanScope] = useState('level'); // 'level' | 'exam'
  const [plans, setPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState('');
  const [examOptions, setExamOptions] = useState([]);
  const [examOptionsLoading, setExamOptionsLoading] = useState(false);
  const [selectedExamId, setSelectedExamId] = useState('');

  // Filters for "Whole Level" scope — plans are fetched once across every
  // level, then narrowed down client-side so the filters feel instant.
  const [allLevelPlans, setAllLevelPlans] = useState([]);
  const [levelsList, setLevelsList] = useState([]);
  const [filterLevelId, setFilterLevelId] = useState('');
  const [filterSubLevel, setFilterSubLevel] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sortBy, setSortBy] = useState('recommended');
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
  const [newSubscriptionId, setNewSubscriptionId] = useState(null);
  const [downloadingInvoice, setDownloadingInvoice] = useState(false);

  useEffect(() => {
    if (!user?.level) {
      navigate('/student/dashboard');
      return;
    }
    setFilterLevelId(user.level._id);
    setFilterSubLevel(user.subLevel || '');
    fetchAllLevelPlans();
    fetchLevelsList();
    fetchExamOptions();
  }, [user]);

  const fetchLevelsList = async () => {
    try {
      const response = await api.get('/levels');
      setLevelsList(response.data || []);
    } catch (err) {
      console.error('Error fetching levels:', err);
    }
  };

  const fetchExamOptions = async () => {
    try {
      setExamOptionsLoading(true);
      const response = await api.get('/student/exams');
      // Only exams that actually need unlocking — already-accessible ones
      // (free, legacy grant, or already covered by a level subscription)
      // don't need a separate exam-scoped purchase.
      const subscriptionExams = Array.isArray(response.data)
        ? response.data.filter(e => e.accessType === 'subscription' && e.accessUnlocked === false)
        : [];
      setExamOptions(subscriptionExams);
    } catch (err) {
      console.error('Error fetching exams:', err);
    } finally {
      setExamOptionsLoading(false);
    }
  };

  const handleScopeChange = (_e, value) => {
    if (!value || value === planScope) return;
    setPlanScope(value);
    setSelectedPlan('');
    setError(null);
    if (value === 'exam') {
      if (selectedExamId) fetchExamPlans(selectedExamId);
      else setPlans([]);
    }
    // Switching to 'level' needs no fetch — the filter effect below
    // recomputes `plans` from the already-fetched `allLevelPlans`.
  };

  const handleExamSelect = (examId) => {
    setSelectedExamId(examId);
    setSelectedPlan('');
    if (examId) fetchExamPlans(examId);
    else setPlans([]);
  };

  const fetchExamPlans = async (examId) => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`/subscription-plans/exam/${examId}/active`);
      setPlans(response.data || []);
    } catch (err) {
      console.error('Error fetching exam plans:', err);
      setError('Failed to load subscription plans for this exam. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Auto-fill phone from profile on mount + restore any pending state
  // that survived a mobile-browser reload (USSD hijacks the browser focus)
  useEffect(() => {
    if (user?.phone) {
      const { code, local } = parseProfilePhone(user.phone);
      setCountryCode(code);
      setLocalPhone(local);
    }

    const saved = sessionStorage.getItem('pendingMobilePayment');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.reference && data.paymentMethod) {
          setPendingReference(data.reference);
          setPaymentMethod(data.paymentMethod);
          if (data.planId) setSelectedPlan(data.planId);
          if (data.plan) setPendingPlanData(data.plan);
          if (data.planScope === 'exam' && data.examId) {
            setPlanScope('exam');
            setSelectedExamId(data.examId);
            fetchExamPlans(data.examId);
          }
          setMobilePending(true);
        }
      } catch {
        sessionStorage.removeItem('pendingMobilePayment');
      }
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
          sessionStorage.removeItem('pendingMobilePayment');
          setMobilePending(false);
          setPendingReference(null);
          setPaymentSuccess(true);
          fetchNewSubscriptionId();
        } else if (cancelled || status === 'cancelled') {
          clearInterval(interval);
          sessionStorage.removeItem('pendingMobilePayment');
          setMobilePending(false);
          setPaymentCancelled(true);
          setPendingReference(null);
          setPendingPlanData(null);
        }
        // status === 'pending' → keep polling
      } catch {
        // network hiccup — keep polling
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [mobilePending, pendingReference, navigate]);

  // After a successful payment, grab the resulting subscription's ID so the
  // success screen can offer an invoice download.
  const fetchNewSubscriptionId = async () => {
    try {
      const response = await api.get('/subscriptions/my/active');
      setNewSubscriptionId(response.data?._id || null);
    } catch (err) {
      console.error('Error fetching new subscription:', err);
    }
  };

  const handleDownloadInvoice = async () => {
    if (!newSubscriptionId) return;
    try {
      setDownloadingInvoice(true);
      const response = await api.get(`/subscriptions/${newSubscriptionId}/invoice`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `invoice-${newSubscriptionId.slice(-8)}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading invoice:', err);
      alert('Failed to download invoice. Please try again.');
    } finally {
      setDownloadingInvoice(false);
    }
  };

  // Fetches every active level-wide plan (across all levels) once — the
  // filter controls below then narrow this down client-side, so changing a
  // filter feels instant instead of round-tripping to the server each time.
  const fetchAllLevelPlans = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/subscription-plans', {
        params: { planType: 'level', status: 'active' }
      });
      setAllLevelPlans(response.data || []);
    } catch (err) {
      console.error('Error fetching plans:', err);
      setError('Failed to load subscription plans. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Sub-levels available for whichever level is currently selected in the
  // filter — used to populate the sub-level dropdown.
  const filterLevelObj = levelsList.find(l => l._id === filterLevelId);
  const availableFilterSubLevels = (filterLevelObj?.subLevels || []).filter(s => s.isActive);

  // Recompute the visible plan list whenever the level scope is "level" and
  // any filter (or the raw plan set) changes.
  useEffect(() => {
    if (planScope !== 'level') return;

    const filtered = allLevelPlans
      .filter(p => !filterLevelId || p.level?._id === filterLevelId)
      .filter(p => {
        if (!filterSubLevel) return true;
        if (filterSubLevel === '__entire__') return !p.subLevel;
        return p.subLevel === filterSubLevel;
      })
      .filter(p => minPrice === '' || p.price >= Number(minPrice))
      .filter(p => maxPrice === '' || p.price <= Number(maxPrice))
      .sort((a, b) => {
        if (sortBy === 'price_asc') return a.price - b.price;
        if (sortBy === 'price_desc') return b.price - a.price;
        return a.durationDays - b.durationDays; // recommended: shortest/cheapest plans first
      });

    setPlans(filtered);
    // Deselect a plan that's been filtered out, so Order Summary can't be
    // left pointing at a plan that's no longer in the visible list.
    setSelectedPlan(prev => (filtered.some(p => p._id === prev) ? prev : ''));
  }, [planScope, allLevelPlans, filterLevelId, filterSubLevel, minPrice, maxPrice, sortBy]);

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
      sessionStorage.removeItem('pendingMobilePayment');

      const payload = { planId: selectedPlan, paymentMethod };
      if (selectedMethodConfig?.requiresPhone) payload.phone = countryCode + localPhone.replace(/[\s\-]/g, '');

      const response = await api.post('/subscriptions/initiate', payload);

      if (response.data.success) {
        if (response.data.paymentUrl) {
          // Card: redirect to payment gateway
          window.location.href = response.data.paymentUrl;
        } else {
          // Mobile money: push sent to phone — persist state so a mobile
          // browser reload (triggered by the USSD OS dialog) doesn't lose it
          const planSnapshot = {
            name: selectedPlanData?.name,
            price: selectedPlanData?.price,
            currency: selectedPlanData?.currency,
          };
          sessionStorage.setItem('pendingMobilePayment', JSON.stringify({
            reference: response.data.reference,
            paymentMethod,
            planId: selectedPlan,
            plan: planSnapshot,
            planScope,
            examId: planScope === 'exam' ? selectedExamId : null,
          }));
          setPendingPlanData(planSnapshot);
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

  if (paymentSuccess) {
    return (
      <Container maxWidth="sm" sx={{ mt: { xs: 4, sm: 8 }, px: { xs: 2, sm: 3 }, textAlign: 'center' }}>
        <Paper elevation={3} sx={{ p: { xs: 3, sm: 6 }, borderRadius: 3 }}>
          <CheckCircle color="success" sx={{ fontSize: { xs: 56, sm: 80 }, mb: 2 }} />
          <Typography variant={isMobile ? 'h6' : 'h5'} fontWeight="bold" color="success.main" gutterBottom>
            Payment Successful!
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            Your subscription is now active. You can access all subscription exams immediately.
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5, justifyContent: 'center' }}>
            <Button
              variant="outlined"
              color="success"
              size="large"
              fullWidth={isMobile}
              onClick={handleDownloadInvoice}
              disabled={!newSubscriptionId || downloadingInvoice}
              startIcon={downloadingInvoice ? <CircularProgress size={18} /> : <Download />}
              sx={{ borderRadius: 2 }}
            >
              {downloadingInvoice ? 'Preparing…' : 'Download Invoice'}
            </Button>
            <Button
              variant="contained"
              color="success"
              size="large"
              fullWidth={isMobile}
              onClick={() => navigate('/student/dashboard')}
              sx={{ borderRadius: 2 }}
            >
              Go to Dashboard
            </Button>
          </Box>
        </Paper>
      </Container>
    );
  }

  if (loading && !mobilePending) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, px: { xs: 2, sm: 3 }, textAlign: 'center' }}>
        <CircularProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>Loading subscription plans...</Typography>
      </Container>
    );
  }

  const selectedPlanData = plans.find(p => p._id === selectedPlan);

  return (
    <Container maxWidth="lg" sx={{ mt: { xs: 2, sm: 4 }, mb: { xs: 4, sm: 8 }, px: { xs: 2, sm: 3 } }}>
      <Button
        startIcon={<ArrowBack />}
        onClick={() => navigate('/student/dashboard')}
        size={isMobile ? 'small' : 'medium'}
        sx={{ mb: { xs: 2, sm: 3 } }}
      >
        Back to Dashboard
      </Button>

      <Box sx={{ textAlign: 'center', mb: { xs: 3, sm: 4 } }}>
        <Typography
          variant={isMobile ? 'h5' : 'h4'}
          fontWeight="bold"
          gutterBottom
          sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: { xs: 1, sm: 2 } }}
        >
          <WorkspacePremium color="primary" fontSize={isMobile ? 'medium' : 'large'} />
          Choose Your Subscription Plan
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ px: { xs: 1, sm: 0 } }}>
          {planScope === 'level'
            ? 'Browse plans by level, sub-level, or price to find the right fit'
            : 'Unlock a single exam without subscribing to the whole level'}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'center', mb: { xs: 3, sm: 4 } }}>
        <ToggleButtonGroup
          value={planScope}
          exclusive
          onChange={handleScopeChange}
          disabled={mobilePending}
          fullWidth={isMobile}
          sx={{
            bgcolor: 'background.paper',
            boxShadow: 1,
            borderRadius: 2,
            width: { xs: '100%', sm: 'auto' },
            '& .MuiToggleButton-root': {
              textTransform: 'none',
              px: { xs: 1.5, sm: 3 },
              py: 1,
              fontWeight: 600,
              borderRadius: 2,
              fontSize: { xs: '0.8rem', sm: '0.875rem' },
              flex: { xs: 1, sm: 'initial' },
              whiteSpace: 'nowrap'
            }
          }}
        >
          <ToggleButton value="level">
            <School fontSize="small" sx={{ mr: 1 }} />
            Whole Level
          </ToggleButton>
          <ToggleButton value="exam">
            <Quiz fontSize="small" sx={{ mr: 1 }} />
            Single Exam
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {planScope === 'exam' && (
        <Box sx={{ maxWidth: 480, mx: 'auto', mb: { xs: 3, sm: 4 } }}>
          <FormControl fullWidth disabled={mobilePending}>
            <InputLabel>Choose an exam</InputLabel>
            <Select
              value={selectedExamId}
              label="Choose an exam"
              onChange={(e) => handleExamSelect(e.target.value)}
            >
              {examOptionsLoading && (
                <MenuItem value="" disabled>Loading exams...</MenuItem>
              )}
              {!examOptionsLoading && examOptions.length === 0 && (
                <MenuItem value="" disabled>No subscription-only exams available for your level</MenuItem>
              )}
              {examOptions.map((exam) => (
                <MenuItem key={exam._id} value={exam._id}>
                  {exam.title}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      )}

      {planScope === 'level' && (
        <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, mb: { xs: 3, sm: 4 }, borderRadius: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <FilterList fontSize="small" color="action" />
            <Typography variant="subtitle2" fontWeight="bold" color="text.secondary">
              Filter Plans
            </Typography>
          </Box>
          <Grid container spacing={1.5}>
            <Grid item xs={6} sm={3}>
              <FormControl fullWidth size="small" disabled={mobilePending}>
                <InputLabel>Level</InputLabel>
                <Select
                  value={filterLevelId}
                  label="Level"
                  onChange={(e) => { setFilterLevelId(e.target.value); setFilterSubLevel(''); }}
                >
                  {levelsList.map((lvl) => (
                    <MenuItem key={lvl._id} value={lvl._id}>
                      {lvl.name}{lvl._id === user?.level?._id ? ' (Your level)' : ''}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} sm={3}>
              <FormControl fullWidth size="small" disabled={mobilePending || availableFilterSubLevels.length === 0}>
                <InputLabel>Sub-level</InputLabel>
                <Select
                  value={filterSubLevel}
                  label="Sub-level"
                  onChange={(e) => setFilterSubLevel(e.target.value)}
                >
                  <MenuItem value="">All Sub-levels</MenuItem>
                  <MenuItem value="__entire__">Entire Level Only</MenuItem>
                  {availableFilterSubLevels.map((sub) => (
                    <MenuItem key={sub._id || sub.name} value={sub.name}>{sub.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} sm={2}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="Min Price"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                disabled={mobilePending}
                inputProps={{ min: 0 }}
              />
            </Grid>
            <Grid item xs={6} sm={2}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="Max Price"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                disabled={mobilePending}
                inputProps={{ min: 0 }}
              />
            </Grid>
            <Grid item xs={12} sm={2}>
              <FormControl fullWidth size="small" disabled={mobilePending}>
                <InputLabel>Sort By</InputLabel>
                <Select value={sortBy} label="Sort By" onChange={(e) => setSortBy(e.target.value)}>
                  <MenuItem value="recommended">Recommended</MenuItem>
                  <MenuItem value="price_asc">Price: Low to High</MenuItem>
                  <MenuItem value="price_desc">Price: High to Low</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          {filterLevelId && filterLevelId !== user?.level?._id && (
            <Alert severity="info" icon={<Info fontSize="small" />} sx={{ mt: 1.5, py: 0, fontSize: '0.8rem' }}>
              You're browsing plans for a different level. Purchasing one will switch your account to that level.
            </Alert>
          )}
        </Paper>
      )}

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

      {planScope === 'exam' && !selectedExamId && !mobilePending ? (
        <Paper sx={{ p: { xs: 3, sm: 4 }, textAlign: 'center', borderRadius: 2 }}>
          <Typography variant={isMobile ? 'subtitle1' : 'h6'} color="text.secondary">
            Pick an exam above to see its subscription plans.
          </Typography>
        </Paper>
      ) : !loading && plans.length === 0 && !mobilePending ? (
        <Paper sx={{ p: { xs: 3, sm: 4 }, textAlign: 'center', borderRadius: 2 }}>
          <Typography variant={isMobile ? 'subtitle1' : 'h6'} color="text.secondary">
            {planScope === 'level'
              ? 'No plans match your filters.'
              : 'No subscription plans available for this exam yet.'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {planScope === 'level'
              ? 'Try widening your price range or choosing a different level/sub-level.'
              : 'Please contact support for more information.'}
          </Typography>
        </Paper>
      ) : !loading && (
        <Grid container spacing={{ xs: 2, sm: 3 }}>
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
                  <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 2 }, mb: 1, flexWrap: 'wrap' }}>
                          <Radio checked={selectedPlan === plan._id} value={plan._id} sx={{ p: { xs: 0.5, sm: 1 } }} />
                          <Typography variant={isMobile ? 'subtitle1' : 'h6'} fontWeight="bold">{plan.name}</Typography>
                          <Chip
                            label={planScope === 'exam' ? 'Single Exam' : (plan.subLevel ? plan.subLevel : 'Entire Level')}
                            color={planScope === 'exam' ? 'secondary' : (plan.subLevel ? 'default' : 'primary')}
                            size="small"
                            variant="outlined"
                          />
                          {plan.discountPercentage > 0 && (
                            <Chip label={`${plan.discountPercentage}% OFF`} color="error" size="small" sx={{ fontWeight: 500 }} />
                          )}
                        </Box>
                        <Typography variant="h4" fontWeight="bold" color="primary" sx={{ mb: 1, fontSize: { xs: '1.5rem', sm: '2.125rem' } }}>
                          {plan.currency === 'RWF' ? 'RWF' : '$'} {plan.price.toLocaleString()}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          {formatPlanDuration(plan)} access
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
            <Paper sx={{ p: { xs: 2, sm: 3 }, position: { xs: 'static', md: 'sticky' }, top: 100, borderRadius: 2 }}>
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
                    <Typography variant="body2">{formatPlanDuration(selectedPlanData)}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      {planScope === 'exam' ? 'Exam:' : 'Level:'}
                    </Typography>
                    <Typography variant="body2" sx={{ textAlign: 'right' }}>
                      {planScope === 'exam'
                        ? (examOptions.find(e => e._id === selectedExamId)?.title || '—')
                        : `${selectedPlanData?.level?.name || '—'}${selectedPlanData?.subLevel ? ` — ${selectedPlanData.subLevel}` : ''}`}
                    </Typography>
                  </Box>
                  {planScope === 'level' && selectedPlanData?.level?._id && selectedPlanData.level._id !== user?.level?._id && (
                    <Alert severity="warning" sx={{ mb: 2, py: 0, fontSize: '0.75rem' }}>
                      This will switch your account level to {selectedPlanData.level.name}.
                    </Alert>
                  )}
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
                      gap: { xs: 1, sm: 1.5 },
                      p: { xs: 1, sm: 1.5 },
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
                        width: { xs: 32, sm: 36 },
                        height: { xs: 32, sm: 36 },
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
                    sessionStorage.removeItem('pendingMobilePayment');
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
