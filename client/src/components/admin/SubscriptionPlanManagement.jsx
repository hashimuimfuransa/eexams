import { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Chip,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
  CircularProgress,
  Switch,
  FormControlLabel,
  Select,
  MenuItem,
  FormControl,
  InputLabel
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  WorkspacePremium,
  Save,
  Cancel,
  People
} from '@mui/icons-material';
import api from '../../services/api';
import { formatPlanDuration } from '../../utils/planUtils';

// Duration units a plan's pricing options can be sold in.
const UNIT_OPTIONS = [
  { value: 'hours', label: 'Hours' },
  { value: 'days', label: 'Days' },
  { value: 'weeks', label: 'Weeks' },
  { value: 'months', label: 'Months' }
];
const UNIT_SINGULAR = { hours: 'Hour', days: 'Day', weeks: 'Week', months: 'Month' };

// One-click starting points for common billing cadences, so an admin can
// spin up an hourly + daily + weekly + monthly option without retyping units.
const VARIANT_PRESETS = [
  { label: 'Hourly', durationValue: 4, durationUnit: 'hours' },
  { label: 'Daily', durationValue: 1, durationUnit: 'days' },
  { label: 'Weekly', durationValue: 1, durationUnit: 'weeks' },
  { label: 'Monthly', durationValue: 1, durationUnit: 'months' }
];

let variantKeySeq = 0;
const makeVariant = (overrides = {}) => ({
  key: `v${++variantKeySeq}`,
  price: 0,
  durationValue: 30,
  durationUnit: 'days',
  discountPercentage: 0,
  ...overrides
});

const emptyFormData = () => ({
  planType: 'level',
  levelId: '',
  subLevel: '',
  examId: '',
  name: '',
  currency: 'RWF',
  status: 'active',
  features: '',
  variants: [makeVariant()]
});

const SubscriptionPlanManagement = () => {
  const [plans, setPlans] = useState([]);
  const [levels, setLevels] = useState([]);
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [formData, setFormData] = useState(emptyFormData());
  const [submitting, setSubmitting] = useState(false);
  const [subscribersDialog, setSubscribersDialog] = useState({ open: false, plan: null, subscribers: [], loading: false });

  const selectedLevelObj = levels.find(l => l._id === formData.levelId);
  const availableSubLevels = (selectedLevelObj?.subLevels || []).filter(s => s.isActive);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [plansRes, levelsRes, examsRes] = await Promise.all([
        api.get('/subscription-plans'),
        api.get('/levels'),
        api.get('/exam')
      ]);
      setPlans(plansRes.data || []);
      setLevels(levelsRes.data || []);
      setExams(examsRes.data || []);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (plan = null) => {
    if (plan) {
      setEditingPlan(plan);
      setFormData({
        planType: plan.planType || 'level',
        levelId: plan.level?._id || '',
        subLevel: plan.subLevel || '',
        examId: plan.exam?._id || '',
        name: plan.name,
        currency: plan.currency || 'RWF',
        status: plan.status || 'active',
        features: (plan.features || []).join(', '),
        variants: [makeVariant({
          price: plan.price,
          durationValue: plan.durationValue ?? plan.durationDays,
          durationUnit: plan.durationUnit || 'days',
          discountPercentage: plan.discountPercentage || 0
        })]
      });
    } else {
      setEditingPlan(null);
      setFormData(emptyFormData());
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingPlan(null);
  };

  const updateVariant = (key, field, value) => {
    setFormData(prev => ({
      ...prev,
      variants: prev.variants.map(v => (v.key === key ? { ...v, [field]: value } : v))
    }));
  };

  const addVariant = (preset = {}) => {
    setFormData(prev => ({ ...prev, variants: [...prev.variants, makeVariant(preset)] }));
  };

  const removeVariant = (key) => {
    setFormData(prev => ({ ...prev, variants: prev.variants.filter(v => v.key !== key) }));
  };

  const buildVariantName = (baseName, variant, multiple) => {
    if (!multiple) return baseName;
    const unitLabel = UNIT_SINGULAR[variant.durationUnit] || 'Day';
    return `${baseName} — ${variant.durationValue} ${unitLabel}${Number(variant.durationValue) === 1 ? '' : 's'}`;
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      setError(null);

      const sharedData = {
        planType: formData.planType,
        level: formData.planType === 'level' ? formData.levelId : null,
        subLevel: formData.planType === 'level' ? (formData.subLevel || null) : null,
        exam: formData.planType === 'exam' ? formData.examId : null,
        currency: formData.currency,
        status: formData.status,
        features: formData.features.split(',').map(f => f.trim()).filter(Boolean)
      };

      if (editingPlan) {
        const variant = formData.variants[0];
        await api.put(`/subscription-plans/${editingPlan._id}`, {
          ...sharedData,
          name: formData.name,
          price: variant.price,
          durationValue: variant.durationValue,
          durationUnit: variant.durationUnit,
          discountPercentage: variant.discountPercentage
        });
      } else {
        const multiple = formData.variants.length > 1;
        const failures = [];
        for (const variant of formData.variants) {
          try {
            await api.post('/subscription-plans', {
              ...sharedData,
              name: buildVariantName(formData.name, variant, multiple),
              price: variant.price,
              durationValue: variant.durationValue,
              durationUnit: variant.durationUnit,
              discountPercentage: variant.discountPercentage
            });
          } catch (err) {
            failures.push(`${variant.durationValue} ${variant.durationUnit} — ${err.response?.data?.message || 'failed'}`);
          }
        }
        if (failures.length) {
          throw new Error(`Some pricing options could not be saved: ${failures.join('; ')}`);
        }
      }

      await fetchData();
      handleCloseDialog();
    } catch (err) {
      console.error('Error saving plan:', err);
      setError(err.response?.data?.message || err.message || 'Failed to save plan');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (planId) => {
    if (!window.confirm('Are you sure you want to delete this plan?')) return;

    try {
      await api.delete(`/subscription-plans/${planId}`);
      await fetchData();
    } catch (err) {
      console.error('Error deleting plan:', err);
      setError(err.response?.data?.message || 'Failed to delete plan');
    }
  };

  const handleViewSubscribers = async (plan) => {
    setSubscribersDialog({ open: true, plan, subscribers: [], loading: true });
    try {
      const res = await api.get('/subscriptions', { params: { plan: plan._id, limit: 100 } });
      setSubscribersDialog({ open: true, plan, subscribers: res.data?.subscriptions || [], loading: false });
    } catch (err) {
      console.error('Error fetching subscribers:', err);
      setSubscribersDialog({ open: true, plan, subscribers: [], loading: false });
    }
  };

  const handleToggleStatus = async (plan) => {
    try {
      await api.patch(`/subscription-plans/${plan._id}/status`, { status: plan.status === 'active' ? 'inactive' : 'active' });
      await fetchData();
    } catch (err) {
      console.error('Error updating plan status:', err);
      setError('Failed to update plan status');
    }
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, textAlign: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 8 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <WorkspacePremium color="primary" />
          Subscription Plan Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => handleOpenDialog()}
        >
          Add Plan
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <TableContainer component={Paper} elevation={3}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Plan Type</TableCell>
              <TableCell>Plan Name</TableCell>
              <TableCell>Level/Exam</TableCell>
              <TableCell>Price</TableCell>
              <TableCell>Duration</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Discount</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {plans.map((plan) => (
              <TableRow key={plan._id}>
                <TableCell>
                  <Chip
                    label={plan.planType === 'exam' ? 'Exam' : 'Level'}
                    color={plan.planType === 'exam' ? 'primary' : 'secondary'}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Typography fontWeight="bold">{plan.name}</Typography>
                </TableCell>
                <TableCell>
                  {plan.planType === 'exam'
                    ? (plan.exam?.title || '-')
                    : `${plan.level?.name || '-'}${plan.subLevel ? ` — ${plan.subLevel}` : ''}`
                  }
                </TableCell>
                <TableCell>
                  {plan.currency} {plan.price.toLocaleString()}
                </TableCell>
                <TableCell>{formatPlanDuration(plan)}</TableCell>
                <TableCell>
                  <Chip
                    label={plan.status}
                    color={plan.status === 'active' ? 'success' : 'default'}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  {plan.discountPercentage > 0 ? `${plan.discountPercentage}%` : '-'}
                </TableCell>
                <TableCell align="right">
                  <IconButton onClick={() => handleViewSubscribers(plan)} size="small" title="View Subscribers">
                    <People />
                  </IconButton>
                  <IconButton onClick={() => handleOpenDialog(plan)} size="small">
                    <Edit />
                  </IconButton>
                  <IconButton onClick={() => handleToggleStatus(plan)} size="small">
                    <Switch checked={plan.status === 'active'} />
                  </IconButton>
                  <IconButton onClick={() => handleDelete(plan._id)} size="small" color="error">
                    <Delete />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingPlan ? 'Edit Subscription Plan' : 'Add New Subscription Plan'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Plan Type</InputLabel>
                  <Select
                    value={formData.planType}
                    onChange={(e) => setFormData({ ...formData, planType: e.target.value, levelId: '', subLevel: '', examId: '' })}
                    label="Plan Type"
                    required
                  >
                    <MenuItem value="level">Level-based</MenuItem>
                    <MenuItem value="exam">Exam-based</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              {formData.planType === 'level' ? (
                <>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth sx={{ mb: 2 }}>
                      <InputLabel>Level</InputLabel>
                      <Select
                        value={formData.levelId}
                        onChange={(e) => setFormData({ ...formData, levelId: e.target.value, subLevel: '' })}
                        label="Level"
                        required
                      >
                        {levels.map((level) => (
                          <MenuItem key={level._id} value={level._id}>
                            {level.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  {availableSubLevels.length > 0 && (
                    <Grid item xs={12} sm={6}>
                      <FormControl fullWidth sx={{ mb: 2 }}>
                        <InputLabel>Sub-Level (optional)</InputLabel>
                        <Select
                          value={formData.subLevel}
                          onChange={(e) => setFormData({ ...formData, subLevel: e.target.value })}
                          label="Sub-Level (optional)"
                        >
                          <MenuItem value="">
                            <em>Entire level (all sub-levels)</em>
                          </MenuItem>
                          {availableSubLevels.map((sub) => (
                            <MenuItem key={sub._id} value={sub.name}>
                              {sub.name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                  )}
                </>
              ) : (
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>Exam</InputLabel>
                    <Select
                      value={formData.examId}
                      onChange={(e) => setFormData({ ...formData, examId: e.target.value })}
                      label="Exam"
                      required
                    >
                      {exams.map((exam) => (
                        <MenuItem key={exam._id} value={exam._id}>
                          {exam.title}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              )}
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Plan Name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  helperText={
                    !editingPlan && formData.variants.length > 1
                      ? 'Base name — each pricing option below becomes its own plan, e.g. "Name — 1 Week".'
                      : ' '
                  }
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Currency</InputLabel>
                  <Select
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    label="Currency"
                  >
                    <MenuItem value="RWF">RWF</MenuItem>
                    <MenuItem value="USD">USD</MenuItem>
                    <MenuItem value="EUR">EUR</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12}>
                <Typography variant="subtitle2" fontWeight="bold" sx={{ mt: 1 }}>
                  Pricing &amp; Duration Options
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
                  {editingPlan
                    ? 'Price and billing period for this plan.'
                    : 'Add one row per billing period — hourly, daily, weekly, monthly. Each row is saved as its own plan.'}
                </Typography>

                {formData.variants.map((variant) => (
                  <Box
                    key={variant.key}
                    sx={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 1.5,
                      alignItems: 'flex-start',
                      p: 1.5,
                      mb: 1,
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1
                    }}
                  >
                    <TextField
                      label="Duration"
                      type="number"
                      size="small"
                      value={variant.durationValue}
                      onChange={(e) => updateVariant(variant.key, 'durationValue', parseFloat(e.target.value) || 0)}
                      inputProps={{ min: 0.01, step: 'any' }}
                      sx={{ width: 110 }}
                      required
                    />
                    <FormControl size="small" sx={{ width: 130 }}>
                      <InputLabel>Unit</InputLabel>
                      <Select
                        value={variant.durationUnit}
                        label="Unit"
                        onChange={(e) => updateVariant(variant.key, 'durationUnit', e.target.value)}
                      >
                        {UNIT_OPTIONS.map((u) => (
                          <MenuItem key={u.value} value={u.value}>{u.label}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <TextField
                      label="Price"
                      type="number"
                      size="small"
                      value={variant.price}
                      onChange={(e) => updateVariant(variant.key, 'price', parseFloat(e.target.value) || 0)}
                      sx={{ width: 130 }}
                      required
                    />
                    <TextField
                      label="Discount %"
                      type="number"
                      size="small"
                      value={variant.discountPercentage}
                      onChange={(e) => updateVariant(variant.key, 'discountPercentage', parseInt(e.target.value) || 0)}
                      inputProps={{ min: 0, max: 100 }}
                      sx={{ width: 110 }}
                    />
                    {!editingPlan && formData.variants.length > 1 && (
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => removeVariant(variant.key)}
                        sx={{ ml: 'auto' }}
                        title="Remove this pricing option"
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    )}
                  </Box>
                ))}

                {!editingPlan && (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                    {VARIANT_PRESETS.map((preset) => (
                      <Chip
                        key={preset.label}
                        icon={<Add fontSize="small" />}
                        label={preset.label}
                        onClick={() => addVariant(preset)}
                        variant="outlined"
                        clickable
                      />
                    ))}
                    <Chip
                      icon={<Add fontSize="small" />}
                      label="Custom option"
                      onClick={() => addVariant()}
                      variant="outlined"
                      clickable
                    />
                  </Box>
                )}
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Features (comma-separated)"
                  value={formData.features}
                  onChange={(e) => setFormData({ ...formData, features: e.target.value })}
                  multiline
                  rows={2}
                  placeholder="e.g., Unlimited exams, Practice questions, Progress tracking"
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} startIcon={<Cancel />}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            startIcon={<Save />}
            disabled={
              submitting ||
              !formData.name ||
              (formData.planType === 'level' ? !formData.levelId : !formData.examId) ||
              formData.variants.length === 0 ||
              formData.variants.some((v) => !v.durationValue || v.price === '' || v.price === null || v.price === undefined || v.price < 0)
            }
          >
            {submitting ? <CircularProgress size={20} /> : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={subscribersDialog.open} onClose={() => setSubscribersDialog({ open: false, plan: null, subscribers: [], loading: false })} maxWidth="md" fullWidth>
        <DialogTitle>
          Subscribers — {subscribersDialog.plan?.name}
        </DialogTitle>
        <DialogContent>
          {subscribersDialog.loading ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : subscribersDialog.subscribers.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
              No subscribers for this plan yet.
            </Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>User</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Started</TableCell>
                    <TableCell>Expires</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {subscribersDialog.subscribers.map((sub) => (
                    <TableRow key={sub._id}>
                      <TableCell>
                        <Typography fontWeight="bold">{sub.user?.firstName} {sub.user?.lastName}</Typography>
                        <Typography variant="caption" color="text.secondary">{sub.user?.email}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={sub.status} color={sub.status === 'active' ? 'success' : 'default'} size="small" />
                      </TableCell>
                      <TableCell>{new Date(sub.startsAt).toLocaleDateString()}</TableCell>
                      <TableCell>{new Date(sub.expiresAt).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSubscribersDialog({ open: false, plan: null, subscribers: [], loading: false })}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default SubscriptionPlanManagement;
