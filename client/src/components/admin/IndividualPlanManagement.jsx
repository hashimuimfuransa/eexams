import { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Button,
  Card,
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
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  FormControlLabel,
  Divider,
  Stack,
  Tooltip
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Person,
  Save,
  Cancel
} from '@mui/icons-material';
import api from '../../services/api';
import { formatPlanDuration } from '../../utils/planUtils';

// -1 is the "Unlimited" sentinel (JSON-safe stand-in for Infinity) — the
// server converts it back to Infinity when resolving enforcement, see
// server/utils/planLimits.js and server/config/plans.js.
const UNLIMITED = -1;

const LIMIT_FIELD_DEFS = [
  { key: 'maxExams', label: 'Max Exams' },
  { key: 'maxStudents', label: 'Max Students' },
  { key: 'maxTeachers', label: 'Max Teacher Accounts' }
];

const FEATURE_FLAG_DEFS = [
  { key: 'aiFeatures', label: 'AI Question Generation' },
  { key: 'advancedAI', label: 'Advanced AI Features' },
  { key: 'analytics', label: 'Analytics Dashboard' },
  { key: 'prioritySupport', label: 'Priority Support' },
  { key: 'customBranding', label: 'Custom Branding' },
  { key: 'apiAccess', label: 'API Access' },
  { key: 'marketplaceAccess', label: 'Marketplace Access' },
  { key: 'templates', label: 'Exam Templates' }
];

// Only used to pre-fill sensible starting values when adding a new plan or
// switching tier — NOT authoritative. The actual enforced defaults live in
// server/config/plans.js PLANS; leaving a field blank/"Default" here means
// the server falls back to those hardcoded numbers.
const TIER_DEFAULTS = {
  basic: { maxExams: 30, maxStudents: 200, maxTeachers: 3, aiFeatures: true, advancedAI: false, analytics: true, prioritySupport: false, customBranding: false, apiAccess: false, marketplaceAccess: false, templates: true },
  premium: { maxExams: UNLIMITED, maxStudents: UNLIMITED, maxTeachers: 10, aiFeatures: true, advancedAI: true, analytics: true, prioritySupport: true, customBranding: false, apiAccess: false, marketplaceAccess: false, templates: true },
  enterprise: { maxExams: UNLIMITED, maxStudents: UNLIMITED, maxTeachers: UNLIMITED, aiFeatures: true, advancedAI: true, analytics: true, prioritySupport: true, customBranding: true, apiAccess: true, marketplaceAccess: true, templates: true }
};

const DEFAULT_FORM = {
  tierKey: 'basic',
  name: '',
  price: 0,
  currency: 'RWF',
  durationValue: 30,
  durationUnit: 'days',
  status: 'active',
  discountPercentage: 0,
  ...TIER_DEFAULTS.basic
};

const formatLimitDisplay = (value) => {
  if (value === UNLIMITED) return 'Unlimited';
  if (value === null || value === undefined) return 'Default';
  return value;
};

// Builds the checkout-facing feature bullets straight from the actual
// selected limits/toggles, so what a buyer sees always matches what's
// enforced — no separately-typed marketing copy to drift out of sync.
const buildFeatureList = (formData) => {
  const list = LIMIT_FIELD_DEFS.map(({ key, label }) => {
    const noun = label.replace(/^Max /, '').toLowerCase();
    return formData[key] === UNLIMITED ? `Unlimited ${noun}` : `Up to ${formData[key]} ${noun}`;
  });
  FEATURE_FLAG_DEFS.forEach(({ key, label }) => {
    if (formData[key]) list.push(label);
  });
  return list;
};

const IndividualPlanManagement = () => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [formData, setFormData] = useState(DEFAULT_FORM);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const res = await api.get('/individual-plans');
      setPlans(res.data || []);
    } catch (err) {
      console.error('Error fetching individual plans:', err);
      setError('Failed to load individual (teacher) plans');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (plan = null) => {
    if (plan) {
      setEditingPlan(plan);
      const tierDefaults = TIER_DEFAULTS[plan.tierKey] || TIER_DEFAULTS.basic;
      const limitFields = {};
      [...LIMIT_FIELD_DEFS, ...FEATURE_FLAG_DEFS].forEach(({ key }) => {
        limitFields[key] = (plan[key] === undefined || plan[key] === null) ? tierDefaults[key] : plan[key];
      });
      setFormData({
        tierKey: plan.tierKey || 'basic',
        name: plan.name,
        price: plan.price,
        currency: plan.currency || 'RWF',
        durationValue: plan.durationValue ?? plan.durationDays,
        durationUnit: plan.durationUnit || 'days',
        status: plan.status || 'active',
        discountPercentage: plan.discountPercentage || 0,
        ...limitFields
      });
    } else {
      setEditingPlan(null);
      setFormData(DEFAULT_FORM);
    }
    setDialogOpen(true);
  };

  const handleTierChange = (newTier) => {
    setFormData((prev) => ({
      ...prev,
      tierKey: newTier,
      // Only reset limits to the new tier's suggested defaults when adding a
      // new plan — editing an existing plan should never silently overwrite
      // values the admin already set.
      ...(editingPlan ? {} : TIER_DEFAULTS[newTier])
    }));
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingPlan(null);
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      setError(null);

      const payload = { ...formData, features: buildFeatureList(formData) };

      if (editingPlan) {
        await api.put(`/individual-plans/${editingPlan._id}`, payload);
      } else {
        await api.post('/individual-plans', payload);
      }

      await fetchPlans();
      handleCloseDialog();
    } catch (err) {
      console.error('Error saving individual plan:', err);
      setError(err.response?.data?.message || 'Failed to save plan');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (planId) => {
    if (!window.confirm('Are you sure you want to delete this plan?')) return;

    try {
      await api.delete(`/individual-plans/${planId}`);
      await fetchPlans();
    } catch (err) {
      console.error('Error deleting individual plan:', err);
      setError(err.response?.data?.message || 'Failed to delete plan');
    }
  };

  const handleToggleStatus = async (plan) => {
    try {
      await api.patch(`/individual-plans/${plan._id}/status`, { status: plan.status === 'active' ? 'inactive' : 'active' });
      await fetchPlans();
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
          <Person color="primary" />
          Individual Teacher Plan Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => handleOpenDialog()}
        >
          Add Plan
        </Button>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        These are the paid plans individual (non-organisation) teachers can purchase via mobile money, Airtel Money, or
        card. Editing a plan changes the price/duration/features shown at checkout for new purchases going forward.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Card component={Paper} elevation={3}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Tier</TableCell>
                <TableCell>Plan Name</TableCell>
                <TableCell>Price</TableCell>
                <TableCell>Duration</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Discount</TableCell>
                <TableCell>Limits &amp; Features</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {plans.map((plan) => (
                <TableRow key={plan._id}>
                  <TableCell>
                    <Chip label={plan.tierKey} color="secondary" size="small" sx={{ textTransform: 'capitalize' }} />
                  </TableCell>
                  <TableCell>
                    <Typography fontWeight="bold">{plan.name}</Typography>
                  </TableCell>
                  <TableCell>{plan.currency} {plan.price.toLocaleString()}</TableCell>
                  <TableCell>{formatPlanDuration(plan)}</TableCell>
                  <TableCell>
                    <Chip label={plan.status} color={plan.status === 'active' ? 'success' : 'default'} size="small" />
                  </TableCell>
                  <TableCell>{plan.discountPercentage > 0 ? `${plan.discountPercentage}%` : '-'}</TableCell>
                  <TableCell>
                    <Tooltip
                      title={
                        <Box>
                          {LIMIT_FIELD_DEFS.map((f) => (
                            <Typography key={f.key} variant="caption" display="block">
                              {f.label}: {formatLimitDisplay(plan[f.key])}
                            </Typography>
                          ))}
                          {FEATURE_FLAG_DEFS.map((f) => (
                            <Typography key={f.key} variant="caption" display="block">
                              {f.label}: {plan[f.key] === true ? 'On' : plan[f.key] === false ? 'Off' : 'Default'}
                            </Typography>
                          ))}
                        </Box>
                      }
                    >
                      <Chip
                        label={
                          [...LIMIT_FIELD_DEFS, ...FEATURE_FLAG_DEFS].some((f) => plan[f.key] !== null && plan[f.key] !== undefined)
                            ? 'Custom limits'
                            : 'Default limits'
                        }
                        size="small"
                        variant="outlined"
                      />
                    </Tooltip>
                  </TableCell>
                  <TableCell align="right">
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
              {plans.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <Typography color="text.secondary" sx={{ py: 3 }}>No individual plans yet.</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingPlan ? 'Edit Individual Plan' : 'Add New Individual Plan'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Tier</InputLabel>
                  <Select
                    value={formData.tierKey}
                    onChange={(e) => handleTierChange(e.target.value)}
                    label="Tier"
                    required
                  >
                    <MenuItem value="basic">Basic</MenuItem>
                    <MenuItem value="premium">Premium</MenuItem>
                    <MenuItem value="enterprise">Enterprise</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Plan Name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Price"
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                  required
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
              <Grid item xs={12} sm={3}>
                <TextField
                  fullWidth
                  label="Duration"
                  type="number"
                  value={formData.durationValue}
                  onChange={(e) => setFormData({ ...formData, durationValue: parseFloat(e.target.value) || 0 })}
                  inputProps={{ min: 0.01, step: 'any' }}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={3}>
                <FormControl fullWidth>
                  <InputLabel>Unit</InputLabel>
                  <Select
                    value={formData.durationUnit}
                    onChange={(e) => setFormData({ ...formData, durationUnit: e.target.value })}
                    label="Unit"
                  >
                    <MenuItem value="hours">Hours</MenuItem>
                    <MenuItem value="days">Days</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Discount Percentage"
                  type="number"
                  value={formData.discountPercentage}
                  onChange={(e) => setFormData({ ...formData, discountPercentage: parseInt(e.target.value) || 0 })}
                  inputProps={{ min: 0, max: 100 }}
                />
              </Grid>
              <Grid item xs={12}>
                <Divider sx={{ my: 1 }} />
                <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
                  Usage Limits
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  These are enforced server-side. Leave "Unlimited" off and set a number, or turn it on to remove the cap entirely.
                </Typography>
              </Grid>
              {LIMIT_FIELD_DEFS.map(({ key, label }) => (
                <Grid item xs={12} sm={4} key={key}>
                  <Stack spacing={0.5}>
                    <TextField
                      fullWidth
                      label={label}
                      type="number"
                      value={formData[key] === UNLIMITED ? '' : formData[key]}
                      onChange={(e) => setFormData({ ...formData, [key]: parseInt(e.target.value, 10) || 0 })}
                      disabled={formData[key] === UNLIMITED}
                      inputProps={{ min: 0 }}
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          size="small"
                          checked={formData[key] === UNLIMITED}
                          onChange={(e) => {
                            const tierDefaults = TIER_DEFAULTS[formData.tierKey] || TIER_DEFAULTS.basic;
                            const fallback = tierDefaults[key] === UNLIMITED ? 0 : tierDefaults[key];
                            setFormData({ ...formData, [key]: e.target.checked ? UNLIMITED : fallback });
                          }}
                        />
                      }
                      label="Unlimited"
                    />
                  </Stack>
                </Grid>
              ))}

              <Grid item xs={12}>
                <Divider sx={{ my: 1 }} />
                <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
                  Feature Access
                </Typography>
              </Grid>
              {FEATURE_FLAG_DEFS.map(({ key, label }) => (
                <Grid item xs={12} sm={6} key={key}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={!!formData[key]}
                        onChange={(e) => setFormData({ ...formData, [key]: e.target.checked })}
                      />
                    }
                    label={label}
                  />
                </Grid>
              ))}

              <Grid item xs={12}>
                <Divider sx={{ my: 1 }} />
                <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
                  Checkout Preview
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  This is exactly what buyers will see on the pricing/checkout page — generated from the limits and toggles above.
                </Typography>
                <Stack direction="row" flexWrap="wrap" gap={1}>
                  {buildFeatureList(formData).map((feature) => (
                    <Chip key={feature} label={feature} size="small" color="primary" variant="outlined" />
                  ))}
                </Stack>
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
            disabled={submitting || !formData.name}
          >
            {submitting ? <CircularProgress size={20} /> : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default IndividualPlanManagement;
