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
  InputLabel
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Business,
  Save,
  Cancel
} from '@mui/icons-material';
import api from '../../services/api';

const DEFAULT_FORM = {
  tierKey: 'basic',
  name: '',
  price: 0,
  currency: 'RWF',
  durationDays: 30,
  status: 'active',
  features: '',
  discountPercentage: 0
};

const OrganizationPlanManagement = () => {
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
      const res = await api.get('/organization-plans');
      setPlans(res.data || []);
    } catch (err) {
      console.error('Error fetching organization plans:', err);
      setError('Failed to load organisation plans');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (plan = null) => {
    if (plan) {
      setEditingPlan(plan);
      setFormData({
        tierKey: plan.tierKey || 'basic',
        name: plan.name,
        price: plan.price,
        currency: plan.currency || 'RWF',
        durationDays: plan.durationDays,
        status: plan.status || 'active',
        features: (plan.features || []).join(', '),
        discountPercentage: plan.discountPercentage || 0
      });
    } else {
      setEditingPlan(null);
      setFormData(DEFAULT_FORM);
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingPlan(null);
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      setError(null);

      const payload = { ...formData, features: formData.features.split(',').map(f => f.trim()).filter(Boolean) };

      if (editingPlan) {
        await api.put(`/organization-plans/${editingPlan._id}`, payload);
      } else {
        await api.post('/organization-plans', payload);
      }

      await fetchPlans();
      handleCloseDialog();
    } catch (err) {
      console.error('Error saving organization plan:', err);
      setError(err.response?.data?.message || 'Failed to save plan');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (planId) => {
    if (!window.confirm('Are you sure you want to delete this plan?')) return;

    try {
      await api.delete(`/organization-plans/${planId}`);
      await fetchPlans();
    } catch (err) {
      console.error('Error deleting organization plan:', err);
      setError(err.response?.data?.message || 'Failed to delete plan');
    }
  };

  const handleToggleStatus = async (plan) => {
    try {
      await api.patch(`/organization-plans/${plan._id}/status`, { status: plan.status === 'active' ? 'inactive' : 'active' });
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
          <Business color="primary" />
          Organisation Plan Management
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
        These are the paid plans organisations can purchase (via mobile money, Airtel Money, or card). Editing a plan
        changes the price/duration/features shown at checkout for new purchases going forward.
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
                  <TableCell>{plan.durationDays} days</TableCell>
                  <TableCell>
                    <Chip label={plan.status} color={plan.status === 'active' ? 'success' : 'default'} size="small" />
                  </TableCell>
                  <TableCell>{plan.discountPercentage > 0 ? `${plan.discountPercentage}%` : '-'}</TableCell>
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
                  <TableCell colSpan={7} align="center">
                    <Typography color="text.secondary" sx={{ py: 3 }}>No organisation plans yet.</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingPlan ? 'Edit Organisation Plan' : 'Add New Organisation Plan'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Tier</InputLabel>
                  <Select
                    value={formData.tierKey}
                    onChange={(e) => setFormData({ ...formData, tierKey: e.target.value })}
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
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Duration (Days)"
                  type="number"
                  value={formData.durationDays}
                  onChange={(e) => setFormData({ ...formData, durationDays: parseInt(e.target.value) || 30 })}
                  required
                />
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
                <TextField
                  fullWidth
                  label="Features (comma-separated)"
                  value={formData.features}
                  onChange={(e) => setFormData({ ...formData, features: e.target.value })}
                  multiline
                  rows={2}
                  placeholder="e.g., 5 teacher accounts, 300 students, AI features, Full analytics"
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
            disabled={submitting || !formData.name}
          >
            {submitting ? <CircularProgress size={20} /> : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default OrganizationPlanManagement;
