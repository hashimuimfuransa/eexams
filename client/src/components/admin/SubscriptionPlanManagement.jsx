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

const SubscriptionPlanManagement = () => {
  const [plans, setPlans] = useState([]);
  const [levels, setLevels] = useState([]);
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [formData, setFormData] = useState({
    planType: 'level',
    levelId: '',
    subLevel: '',
    examId: '',
    name: '',
    price: 0,
    currency: 'RWF',
    durationDays: 30,
    status: 'active',
    features: [],
    discountPercentage: 0
  });
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
        price: plan.price,
        currency: plan.currency || 'RWF',
        durationDays: plan.durationDays,
        status: plan.status || 'active',
        features: (plan.features || []).join(', '),
        discountPercentage: plan.discountPercentage || 0
      });
    } else {
      setEditingPlan(null);
      setFormData({
        planType: 'level',
        levelId: '',
        subLevel: '',
        examId: '',
        name: '',
        price: 0,
        currency: 'RWF',
        durationDays: 30,
        status: 'active',
        features: '',
        discountPercentage: 0
      });
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

      const submitData = {
        ...formData,
        level: formData.planType === 'level' ? formData.levelId : null,
        subLevel: formData.planType === 'level' ? (formData.subLevel || null) : null,
        exam: formData.planType === 'exam' ? formData.examId : null,
        features: formData.features.split(',').map(f => f.trim()).filter(Boolean)
      };

      if (editingPlan) {
        await api.put(`/subscription-plans/${editingPlan._id}`, submitData);
      } else {
        await api.post('/subscription-plans', submitData);
      }

      await fetchData();
      handleCloseDialog();
    } catch (err) {
      console.error('Error saving plan:', err);
      setError(err.response?.data?.message || 'Failed to save plan');
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
                <TableCell>{plan.durationDays} days</TableCell>
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
            disabled={submitting || !formData.name || (formData.planType === 'level' ? !formData.levelId : !formData.examId)}
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
