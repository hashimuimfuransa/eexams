import { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Chip,
  Button,
  Stack,
  Alert,
  Snackbar,
  TextField,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Collapse,
  IconButton,
  Tabs,
  Tab
} from '@mui/material';
import {
  Assessment,
  TrendingUp,
  People,
  AttachMoney,
  School,
  HourglassEmpty,
  CheckCircle,
  Cancel,
  Business,
  Person,
  Block,
  ManageAccounts,
  Search,
  FilterAltOff,
  ExpandMore,
  ExpandLess
} from '@mui/icons-material';
import api from '../../services/api';

// Renders the org/individual-teacher account-plan report block: summary
// counts, revenue by tier, and the most recent completed purchases. These
// subscriptions live on User.subscriptionPlan (not the Subscription
// collection), so they're reported separately from the level-based stats above.
const AccountPlanSection = ({ title, icon, data }) => {
  const revenueByTier = data?.revenueByTier || [];
  const recentPayments = data?.recentPayments || [];

  return (
    <Card elevation={3}>
      <CardContent>
        <Typography variant="h6" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          {icon}
          {title}
        </Typography>

        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} sm={4}>
            <Box sx={{ p: 2, bgcolor: 'success.light', borderRadius: 2 }}>
              <Typography variant="body2" color="text.secondary">Active Accounts</Typography>
              <Typography variant="h5" fontWeight="bold">{data?.activeCount || 0}</Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Box sx={{ p: 2, bgcolor: 'primary.light', borderRadius: 2 }}>
              <Typography variant="body2" color="text.secondary">Total Revenue</Typography>
              <Typography variant="h5" fontWeight="bold">RWF {(data?.totalRevenue || 0).toLocaleString()}</Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Box sx={{ p: 2, bgcolor: 'info.light', borderRadius: 2 }}>
              <Typography variant="body2" color="text.secondary">Total Purchases</Typography>
              <Typography variant="h5" fontWeight="bold">{data?.totalPurchases || 0}</Typography>
            </Box>
          </Grid>
        </Grid>

        <Grid container spacing={2}>
          <Grid item xs={12} md={5}>
            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>Revenue by Tier</Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Plan</TableCell>
                    <TableCell align="right">Purchases</TableCell>
                    <TableCell align="right">Revenue</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {revenueByTier.map((item) => (
                    <TableRow key={item.plan?._id}>
                      <TableCell>
                        <Typography fontWeight="bold">{item.plan?.name || 'Unknown'}</Typography>
                        <Typography variant="caption" color="text.secondary">{item.plan?.tierKey}</Typography>
                      </TableCell>
                      <TableCell align="right">{item.subscriberCount}</TableCell>
                      <TableCell align="right">{item.revenue ? `RWF ${item.revenue.toLocaleString()}` : '-'}</TableCell>
                    </TableRow>
                  ))}
                  {revenueByTier.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} align="center">
                        <Typography variant="body2" color="text.secondary">No purchases yet</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Grid>

          <Grid item xs={12} md={7}>
            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>Recent Purchases</Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>User</TableCell>
                    <TableCell>Plan</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell>Date</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {recentPayments.map((p) => (
                    <TableRow key={p._id}>
                      <TableCell>
                        <Typography fontWeight="bold">{p.user?.firstName} {p.user?.lastName}</Typography>
                        <Typography variant="caption" color="text.secondary">{p.user?.organization || p.user?.email}</Typography>
                      </TableCell>
                      <TableCell>{p.organizationPlan?.name || p.individualPlan?.name || '-'}</TableCell>
                      <TableCell align="right">{p.currency} {p.amount?.toLocaleString()}</TableCell>
                      <TableCell>{new Date(p.updatedAt).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                  {recentPayments.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} align="center">
                        <Typography variant="body2" color="text.secondary">No purchases yet</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};

const SubscriptionReports = () => {
  const [stats, setStats] = useState(null);
  const [pendingPayments, setPendingPayments] = useState([]);
  const [pendingLoading, setPendingLoading] = useState(true);
  const [actioningId, setActioningId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  // Organisation admins + individual teachers and their account-level plan —
  // lets the super admin cancel/disable any active subscriber directly here.
  const [subscribers, setSubscribers] = useState([]);
  const [subscribersLoading, setSubscribersLoading] = useState(true);
  const [subscriberActioningId, setSubscriberActioningId] = useState(null);
  // Level-based Subscription records (per-exam-level purchases) shown in the
  // "Recent Subscriptions" table below — cancel action uses a separate id
  // space since it acts on Subscription documents, not User documents.
  const [subActioningId, setSubActioningId] = useState(null);

  // Search + filters for the Manage Subscribers table
  const [subscriberSearch, setSubscriberSearch] = useState('');
  const [subscriberTypeFilter, setSubscriberTypeFilter] = useState('all');
  const [subscriberPlanFilter, setSubscriberPlanFilter] = useState('all');
  const [subscriberStatusFilter, setSubscriberStatusFilter] = useState('all');
  const [subscriberAccountFilter, setSubscriberAccountFilter] = useState('all');

  const hasActiveSubscriberFilters = !!subscriberSearch.trim()
    || subscriberTypeFilter !== 'all'
    || subscriberPlanFilter !== 'all'
    || subscriberStatusFilter !== 'all'
    || subscriberAccountFilter !== 'all';

  const clearSubscriberFilters = () => {
    setSubscriberSearch('');
    setSubscriberTypeFilter('all');
    setSubscriberPlanFilter('all');
    setSubscriberStatusFilter('all');
    setSubscriberAccountFilter('all');
  };

  const filteredSubscribers = subscribers.filter((u) => {
    const q = subscriberSearch.trim().toLowerCase();
    const matchesSearch = !q
      || `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase().includes(q)
      || (u.email || '').toLowerCase().includes(q)
      || (u.organization || '').toLowerCase().includes(q);
    const matchesType = subscriberTypeFilter === 'all'
      || (subscriberTypeFilter === 'organization' ? u.role === 'admin' : u.role === 'teacher');
    const matchesPlan = subscriberPlanFilter === 'all' || u.subscriptionPlan === subscriberPlanFilter;
    const matchesStatus = subscriberStatusFilter === 'all' || u.subscriptionStatus === subscriberStatusFilter;
    const matchesAccount = subscriberAccountFilter === 'all'
      || (subscriberAccountFilter === 'disabled' ? u.isBlocked : !u.isBlocked);
    return matchesSearch && matchesType && matchesPlan && matchesStatus && matchesAccount;
  });

  // "Manage Subscribers" is minimised by default — it's a heavy management
  // panel, not something needed on every page load.
  const [subscribersExpanded, setSubscribersExpanded] = useState(false);
  const [subscriberTab, setSubscriberTab] = useState(0); // 0 = account plans, 1 = exam/level subscribers

  // Exam/level subscribers (Subscription model) — students & teachers who
  // bought a per-level exam plan, as opposed to the account-wide org/individual
  // plans above. Fetched in full (not just "recent") so they can be searched here.
  const [examSubs, setExamSubs] = useState([]);
  const [examSubsLoading, setExamSubsLoading] = useState(true);
  const [examSearch, setExamSearch] = useState('');
  const [examStatusFilter, setExamStatusFilter] = useState('all');
  const [examLevelFilter, setExamLevelFilter] = useState('all');

  const examLevelOptions = Array.from(
    new Set(examSubs.map((s) => s.level?.name).filter(Boolean))
  ).sort();

  const hasActiveExamFilters = !!examSearch.trim() || examStatusFilter !== 'all' || examLevelFilter !== 'all';
  const clearExamFilters = () => {
    setExamSearch('');
    setExamStatusFilter('all');
    setExamLevelFilter('all');
  };

  const filteredExamSubs = examSubs.filter((sub) => {
    const q = examSearch.trim().toLowerCase();
    const matchesSearch = !q
      || `${sub.user?.firstName || ''} ${sub.user?.lastName || ''}`.toLowerCase().includes(q)
      || (sub.user?.email || '').toLowerCase().includes(q)
      || (sub.plan?.name || '').toLowerCase().includes(q)
      || (sub.level?.name || '').toLowerCase().includes(q);
    const matchesStatus = examStatusFilter === 'all' || sub.status === examStatusFilter;
    const matchesLevel = examLevelFilter === 'all' || sub.level?.name === examLevelFilter;
    return matchesSearch && matchesStatus && matchesLevel;
  });

  useEffect(() => {
    fetchStats();
    fetchPendingPayments();
    fetchSubscribers();
    fetchExamSubs();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await api.get('/subscriptions/stats/overview');
      setStats(response.data);
    } catch (err) {
      console.error('Error fetching stats:', err);
      setError('Failed to load subscription statistics');
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingPayments = async () => {
    try {
      setPendingLoading(true);
      const response = await api.get('/subscriptions/pending');
      setPendingPayments(response.data || []);
    } catch (err) {
      console.error('Error fetching pending payments:', err);
    } finally {
      setPendingLoading(false);
    }
  };

  const handleApprove = async (id) => {
    setActioningId(id);
    try {
      const res = await api.post(`/subscriptions/pending/${id}/approve`);
      setToast({ severity: 'success', message: res.data.message || 'Subscription activated' });
      await Promise.all([fetchPendingPayments(), fetchStats()]);
    } catch (err) {
      setToast({ severity: 'error', message: err.response?.data?.message || 'Approval failed' });
    } finally {
      setActioningId(null);
    }
  };

  const handleReject = async (id) => {
    setActioningId(id);
    try {
      await api.patch(`/subscriptions/pending/${id}/reject`);
      setToast({ severity: 'info', message: 'Payment marked as failed' });
      await fetchPendingPayments();
    } catch (err) {
      setToast({ severity: 'error', message: err.response?.data?.message || 'Failed to reject' });
    } finally {
      setActioningId(null);
    }
  };

  const fetchSubscribers = async () => {
    try {
      setSubscribersLoading(true);
      const res = await api.get('/subscriptions/account-plans/subscribers');
      setSubscribers(res.data || []);
    } catch (err) {
      console.error('Error fetching subscribers:', err);
    } finally {
      setSubscribersLoading(false);
    }
  };

  const handleCancelAccountPlan = async (user) => {
    if (!window.confirm(`Cancel ${user.firstName} ${user.lastName}'s ${user.subscriptionPlan} plan and revert them to Free?`)) return;
    setSubscriberActioningId(user._id);
    try {
      const res = await api.post(`/subscriptions/account-plans/${user._id}/cancel`);
      setToast({ severity: 'success', message: res.data.message || 'Plan cancelled' });
      await Promise.all([fetchSubscribers(), fetchStats()]);
    } catch (err) {
      setToast({ severity: 'error', message: err.response?.data?.message || 'Failed to cancel plan' });
    } finally {
      setSubscriberActioningId(null);
    }
  };

  const handleToggleBlock = async (user) => {
    const verb = user.isBlocked ? 'enable' : 'disable';
    if (!window.confirm(`Are you sure you want to ${verb} ${user.firstName} ${user.lastName}'s account?`)) return;
    setSubscriberActioningId(user._id);
    try {
      await api.put(`/superadmin/users/${user._id}/toggle-block`);
      setToast({ severity: 'success', message: `Account ${user.isBlocked ? 'enabled' : 'disabled'}` });
      await fetchSubscribers();
    } catch (err) {
      setToast({ severity: 'error', message: err.response?.data?.message || 'Failed to update account' });
    } finally {
      setSubscriberActioningId(null);
    }
  };

  const fetchExamSubs = async () => {
    try {
      setExamSubsLoading(true);
      const res = await api.get('/subscriptions', { params: { limit: 500 } });
      setExamSubs(res.data?.subscriptions || []);
    } catch (err) {
      console.error('Error fetching exam subscribers:', err);
    } finally {
      setExamSubsLoading(false);
    }
  };

  const handleCancelLevelSubscription = async (sub) => {
    if (!window.confirm(`Cancel ${sub.user?.firstName} ${sub.user?.lastName}'s "${sub.plan?.name}" subscription?`)) return;
    setSubActioningId(sub._id);
    try {
      await api.patch(`/subscriptions/${sub._id}/cancel`);
      setToast({ severity: 'success', message: 'Subscription cancelled' });
      await Promise.all([fetchStats(), fetchExamSubs()]);
    } catch (err) {
      setToast({ severity: 'error', message: err.response?.data?.message || 'Failed to cancel subscription' });
    } finally {
      setSubActioningId(null);
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
      <Typography variant="h4" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4 }}>
        <Assessment color="primary" />
        Subscription Reports & Analytics
      </Typography>

      {error && (
        <Box sx={{ mb: 3, p: 2, bgcolor: 'error.light', borderRadius: 2 }}>
          <Typography color="error">{error}</Typography>
        </Box>
      )}

      {/* Pending Payments Needing Review */}
      <Card elevation={3} sx={{ mb: 4, border: pendingPayments.length > 0 ? '1px solid' : 'none', borderColor: 'warning.main' }}>
        <CardContent>
          <Typography variant="h6" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <HourglassEmpty color="warning" />
            Pending Payments Needing Review
            {pendingPayments.length > 0 && (
              <Chip label={pendingPayments.length} color="warning" size="small" />
            )}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Payments the payment gateway hasn't confirmed back to us yet, or that a student paid but the system never activated.
            "Approve" re-checks with iTechPay and activates the subscription only if it confirms the payment succeeded.
          </Typography>
          {pendingLoading ? (
            <CircularProgress size={24} />
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>User</TableCell>
                    <TableCell>Plan</TableCell>
                    <TableCell>Level</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell>Method</TableCell>
                    <TableCell>Requested</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pendingPayments.map((p) => (
                    <TableRow key={p._id}>
                      <TableCell>
                        <Typography fontWeight="bold">
                          {p.user?.firstName} {p.user?.lastName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {p.user?.email}
                        </Typography>
                      </TableCell>
                      <TableCell>{p.plan?.name}</TableCell>
                      <TableCell>{p.level?.name}</TableCell>
                      <TableCell align="right">{p.currency} {p.amount?.toLocaleString()}</TableCell>
                      <TableCell>{p.paymentMethod}</TableCell>
                      <TableCell>{new Date(p.createdAt).toLocaleString()}</TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          <Button
                            size="small"
                            variant="contained"
                            color="success"
                            startIcon={<CheckCircle />}
                            disabled={actioningId === p._id}
                            onClick={() => handleApprove(p._id)}
                          >
                            Approve
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            color="error"
                            startIcon={<Cancel />}
                            disabled={actioningId === p._id}
                            onClick={() => handleReject(p._id)}
                          >
                            Reject
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                  {pendingPayments.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} align="center">
                        <Typography variant="body2" color="text.secondary">No pending payments — all clear</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Manage Subscribers — organisation admins, individual teachers, and exam/level subscribers */}
      <Card elevation={3} sx={{ mb: 4 }}>
        <CardContent>
          <Box
            onClick={() => setSubscribersExpanded((v) => !v)}
            sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
          >
            <Typography variant="h6" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ManageAccounts color="primary" />
              Manage Subscribers
              <Chip label={subscribers.length + examSubs.length} size="small" />
            </Typography>
            <IconButton size="small">
              {subscribersExpanded ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
          </Box>

          <Collapse in={subscribersExpanded} timeout="auto" unmountOnExit>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 2 }}>
              Manage every active subscriber — organisation/individual account plans and per-level exam subscriptions.
              "Cancel Plan"/"Cancel" ends the active subscription; "Disable" blocks the account entirely until re-enabled.
            </Typography>

            <Tabs value={subscriberTab} onChange={(e, v) => setSubscriberTab(v)} sx={{ mb: 2 }}>
              <Tab label={`Account Plans (${subscribers.length})`} />
              <Tab label={`Exam / Level Subscribers (${examSubs.length})`} />
            </Tabs>

            {subscriberTab === 0 && (
              <>
                <Stack direction="row" spacing={1.5} sx={{ mb: 2, flexWrap: 'wrap', rowGap: 1.5 }} alignItems="center">
                  <TextField
                    size="small"
                    placeholder="Search name, email, organization..."
                    value={subscriberSearch}
                    onChange={(e) => setSubscriberSearch(e.target.value)}
                    sx={{ minWidth: 260, flexGrow: 1 }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Search fontSize="small" />
                        </InputAdornment>
                      )
                    }}
                  />
                  <FormControl size="small" sx={{ minWidth: 140 }}>
                    <InputLabel>Type</InputLabel>
                    <Select label="Type" value={subscriberTypeFilter} onChange={(e) => setSubscriberTypeFilter(e.target.value)}>
                      <MenuItem value="all">All types</MenuItem>
                      <MenuItem value="organization">Organization</MenuItem>
                      <MenuItem value="individual">Individual</MenuItem>
                    </Select>
                  </FormControl>
                  <FormControl size="small" sx={{ minWidth: 140 }}>
                    <InputLabel>Plan</InputLabel>
                    <Select label="Plan" value={subscriberPlanFilter} onChange={(e) => setSubscriberPlanFilter(e.target.value)}>
                      <MenuItem value="all">All plans</MenuItem>
                      <MenuItem value="free">Free</MenuItem>
                      <MenuItem value="basic">Basic</MenuItem>
                      <MenuItem value="premium">Premium</MenuItem>
                      <MenuItem value="enterprise">Enterprise</MenuItem>
                    </Select>
                  </FormControl>
                  <FormControl size="small" sx={{ minWidth: 140 }}>
                    <InputLabel>Status</InputLabel>
                    <Select label="Status" value={subscriberStatusFilter} onChange={(e) => setSubscriberStatusFilter(e.target.value)}>
                      <MenuItem value="all">All statuses</MenuItem>
                      <MenuItem value="active">Active</MenuItem>
                      <MenuItem value="pending">Pending</MenuItem>
                      <MenuItem value="expired">Expired</MenuItem>
                      <MenuItem value="cancelled">Cancelled</MenuItem>
                    </Select>
                  </FormControl>
                  <FormControl size="small" sx={{ minWidth: 140 }}>
                    <InputLabel>Account</InputLabel>
                    <Select label="Account" value={subscriberAccountFilter} onChange={(e) => setSubscriberAccountFilter(e.target.value)}>
                      <MenuItem value="all">All accounts</MenuItem>
                      <MenuItem value="enabled">Enabled</MenuItem>
                      <MenuItem value="disabled">Disabled</MenuItem>
                    </Select>
                  </FormControl>
                  {hasActiveSubscriberFilters && (
                    <Button size="small" startIcon={<FilterAltOff />} onClick={clearSubscriberFilters}>
                      Clear filters
                    </Button>
                  )}
                </Stack>

                {!subscribersLoading && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                    Showing {filteredSubscribers.length} of {subscribers.length} subscriber{subscribers.length === 1 ? '' : 's'}
                  </Typography>
                )}

                {subscribersLoading ? (
                  <CircularProgress size={24} />
                ) : (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>User</TableCell>
                          <TableCell>Type</TableCell>
                          <TableCell>Plan</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell>Expires</TableCell>
                          <TableCell>Account</TableCell>
                          <TableCell align="right">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {filteredSubscribers.map((u) => (
                          <TableRow key={u._id}>
                            <TableCell>
                              <Typography fontWeight="bold">{u.firstName} {u.lastName}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {u.organization || u.email}
                              </Typography>
                            </TableCell>
                            <TableCell>{u.role === 'admin' ? 'Organization' : 'Individual'}</TableCell>
                            <TableCell sx={{ textTransform: 'capitalize' }}>{u.subscriptionPlan}</TableCell>
                            <TableCell>
                              <Chip
                                label={u.subscriptionStatus}
                                size="small"
                                color={u.subscriptionStatus === 'active' ? 'success' : u.subscriptionStatus === 'pending' ? 'warning' : 'default'}
                                sx={{ textTransform: 'capitalize' }}
                              />
                            </TableCell>
                            <TableCell>
                              {(u.subscriptionExpiresAt || u.subscriptionEndDate)
                                ? new Date(u.subscriptionExpiresAt || u.subscriptionEndDate).toLocaleString('en-GB', {
                                    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                                  })
                                : '-'}
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={u.isBlocked ? 'Disabled' : 'Enabled'}
                                size="small"
                                color={u.isBlocked ? 'error' : 'success'}
                              />
                            </TableCell>
                            <TableCell align="right">
                              <Stack direction="row" spacing={1} justifyContent="flex-end">
                                <Button
                                  size="small"
                                  variant="outlined"
                                  color="warning"
                                  startIcon={<Cancel />}
                                  disabled={subscriberActioningId === u._id || u.subscriptionPlan === 'free'}
                                  onClick={() => handleCancelAccountPlan(u)}
                                >
                                  Cancel Plan
                                </Button>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  color={u.isBlocked ? 'success' : 'error'}
                                  startIcon={u.isBlocked ? <CheckCircle /> : <Block />}
                                  disabled={subscriberActioningId === u._id}
                                  onClick={() => handleToggleBlock(u)}
                                >
                                  {u.isBlocked ? 'Enable' : 'Disable'}
                                </Button>
                              </Stack>
                            </TableCell>
                          </TableRow>
                        ))}
                        {filteredSubscribers.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={7} align="center">
                              <Typography variant="body2" color="text.secondary">
                                {subscribers.length === 0 ? 'No subscribers found' : 'No subscribers match your filters'}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </>
            )}

            {subscriberTab === 1 && (
              <>
                <Stack direction="row" spacing={1.5} sx={{ mb: 2, flexWrap: 'wrap', rowGap: 1.5 }} alignItems="center">
                  <TextField
                    size="small"
                    placeholder="Search name, email, plan, level..."
                    value={examSearch}
                    onChange={(e) => setExamSearch(e.target.value)}
                    sx={{ minWidth: 260, flexGrow: 1 }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Search fontSize="small" />
                        </InputAdornment>
                      )
                    }}
                  />
                  <FormControl size="small" sx={{ minWidth: 140 }}>
                    <InputLabel>Level</InputLabel>
                    <Select label="Level" value={examLevelFilter} onChange={(e) => setExamLevelFilter(e.target.value)}>
                      <MenuItem value="all">All levels</MenuItem>
                      {examLevelOptions.map((name) => (
                        <MenuItem key={name} value={name}>{name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl size="small" sx={{ minWidth: 140 }}>
                    <InputLabel>Status</InputLabel>
                    <Select label="Status" value={examStatusFilter} onChange={(e) => setExamStatusFilter(e.target.value)}>
                      <MenuItem value="all">All statuses</MenuItem>
                      <MenuItem value="active">Active</MenuItem>
                      <MenuItem value="pending">Pending</MenuItem>
                      <MenuItem value="expired">Expired</MenuItem>
                      <MenuItem value="cancelled">Cancelled</MenuItem>
                    </Select>
                  </FormControl>
                  {hasActiveExamFilters && (
                    <Button size="small" startIcon={<FilterAltOff />} onClick={clearExamFilters}>
                      Clear filters
                    </Button>
                  )}
                </Stack>

                {!examSubsLoading && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                    Showing {filteredExamSubs.length} of {examSubs.length} subscriber{examSubs.length === 1 ? '' : 's'}
                  </Typography>
                )}

                {examSubsLoading ? (
                  <CircularProgress size={24} />
                ) : (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>User</TableCell>
                          <TableCell>Plan</TableCell>
                          <TableCell>Level</TableCell>
                          <TableCell>Expires</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell align="right">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {filteredExamSubs.map((sub) => (
                          <TableRow key={sub._id}>
                            <TableCell>
                              <Typography fontWeight="bold">{sub.user?.firstName} {sub.user?.lastName}</Typography>
                              <Typography variant="caption" color="text.secondary">{sub.user?.email}</Typography>
                            </TableCell>
                            <TableCell>{sub.plan?.name}</TableCell>
                            <TableCell>{sub.level?.name}</TableCell>
                            <TableCell>{sub.expiresAt ? new Date(sub.expiresAt).toLocaleDateString() : '-'}</TableCell>
                            <TableCell>
                              <Chip
                                label={sub.status}
                                size="small"
                                color={sub.status === 'active' ? 'success' : 'default'}
                                sx={{ textTransform: 'capitalize' }}
                              />
                            </TableCell>
                            <TableCell align="right">
                              <Button
                                size="small"
                                variant="outlined"
                                color="warning"
                                startIcon={<Cancel />}
                                disabled={subActioningId === sub._id || sub.status !== 'active'}
                                onClick={() => handleCancelLevelSubscription(sub)}
                              >
                                Cancel
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                        {filteredExamSubs.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={6} align="center">
                              <Typography variant="body2" color="text.secondary">
                                {examSubs.length === 0 ? 'No exam subscribers found' : 'No subscribers match your filters'}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </>
            )}
          </Collapse>
        </CardContent>
      </Card>

      {stats && (
        <Grid container spacing={3}>
          {/* Summary Cards */}
          <Grid item xs={12} sm={6} md={3}>
            <Card elevation={3}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{ p: 2, bgcolor: 'primary.light', borderRadius: 2 }}>
                    <AttachMoney color="primary" />
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Total Revenue
                    </Typography>
                    <Typography variant="h5" fontWeight="bold">
                      {stats.totalRevenue ? `RWF ${stats.totalRevenue.toLocaleString()}` : 'RWF 0'}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card elevation={3}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{ p: 2, bgcolor: 'success.light', borderRadius: 2 }}>
                    <People color="success" />
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Active Subscribers
                    </Typography>
                    <Typography variant="h5" fontWeight="bold">
                      {stats.activeSubscribers || 0}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card elevation={3}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{ p: 2, bgcolor: 'info.light', borderRadius: 2 }}>
                    <TrendingUp color="info" />
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Total Subscriptions
                    </Typography>
                    <Typography variant="h5" fontWeight="bold">
                      {stats.totalSubscriptions || 0}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card elevation={3}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{ p: 2, bgcolor: 'warning.light', borderRadius: 2 }}>
                    <School color="warning" />
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Levels Active
                    </Typography>
                    <Typography variant="h5" fontWeight="bold">
                      {stats.levelsCount || 0}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Subscribers by Level */}
          <Grid item xs={12} md={6}>
            <Card elevation={3}>
              <CardContent>
                <Typography variant="h6" fontWeight="bold" gutterBottom>
                  Subscribers by Level
                </Typography>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Level</TableCell>
                        <TableCell align="right">Active</TableCell>
                        <TableCell align="right">Total</TableCell>
                        <TableCell align="right">Revenue</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {stats.subscribersByLevel?.map((item) => (
                        <TableRow key={item.level?._id}>
                          <TableCell>
                            <Typography fontWeight="bold">{item.level?.name || 'Unknown'}</Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Chip
                              label={item.activeCount}
                              color="success"
                              size="small"
                            />
                          </TableCell>
                          <TableCell align="right">{item.totalCount}</TableCell>
                          <TableCell align="right">
                            {item.revenue ? `RWF ${item.revenue.toLocaleString()}` : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>

          {/* Revenue by Plan */}
          <Grid item xs={12} md={6}>
            <Card elevation={3}>
              <CardContent>
                <Typography variant="h6" fontWeight="bold" gutterBottom>
                  Revenue by Plan
                </Typography>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Plan</TableCell>
                        <TableCell align="right">Subscribers</TableCell>
                        <TableCell align="right">Revenue</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {stats.revenueByPlan?.map((item) => (
                        <TableRow key={item.plan?._id}>
                          <TableCell>
                            <Typography fontWeight="bold">{item.plan?.name || 'Unknown'}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {item.plan?.level?.name}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">{item.subscriberCount}</TableCell>
                          <TableCell align="right">
                            {item.revenue ? `RWF ${item.revenue.toLocaleString()}` : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>

          {/* Revenue by Period */}
          <Grid item xs={12} sm={4}>
            <Card elevation={3}>
              <CardContent>
                <Typography variant="body2" color="text.secondary">Weekly Revenue (7d)</Typography>
                <Typography variant="h5" fontWeight="bold">RWF {(stats.revenueByPeriod?.weekly?.revenue || 0).toLocaleString()}</Typography>
                <Typography variant="caption" color="text.secondary">{stats.revenueByPeriod?.weekly?.count || 0} subscriptions</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Card elevation={3}>
              <CardContent>
                <Typography variant="body2" color="text.secondary">Monthly Revenue (30d)</Typography>
                <Typography variant="h5" fontWeight="bold">RWF {(stats.revenueByPeriod?.monthly?.revenue || 0).toLocaleString()}</Typography>
                <Typography variant="caption" color="text.secondary">{stats.revenueByPeriod?.monthly?.count || 0} subscriptions</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Card elevation={3}>
              <CardContent>
                <Typography variant="body2" color="text.secondary">Yearly Revenue (365d)</Typography>
                <Typography variant="h5" fontWeight="bold">RWF {(stats.revenueByPeriod?.yearly?.revenue || 0).toLocaleString()}</Typography>
                <Typography variant="caption" color="text.secondary">{stats.revenueByPeriod?.yearly?.count || 0} subscriptions</Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Most Popular Levels */}
          <Grid item xs={12} md={6}>
            <Card elevation={3}>
              <CardContent>
                <Typography variant="h6" fontWeight="bold" gutterBottom>
                  Most Popular Levels
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Level</TableCell>
                        <TableCell align="right">Subscribers</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {stats.popularLevels?.map((item, idx) => (
                        <TableRow key={item.level?._id || idx}>
                          <TableCell>{item.level?.name || 'Unknown'}</TableCell>
                          <TableCell align="right">{item.totalCount}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>

          {/* Most Attempted Exams */}
          <Grid item xs={12} md={6}>
            <Card elevation={3}>
              <CardContent>
                <Typography variant="h6" fontWeight="bold" gutterBottom>
                  Most Attempted Exams
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Exam</TableCell>
                        <TableCell align="right">Attempts</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {stats.mostAttemptedExams?.map((item, idx) => (
                        <TableRow key={item.exam?._id || idx}>
                          <TableCell>{item.exam?.title || 'Unknown'}</TableCell>
                          <TableCell align="right">{item.attemptCount}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>

          {/* Free Exam Conversion + Renewals */}
          <Grid item xs={12} sm={6} md={4}>
            <Card elevation={3}>
              <CardContent>
                <Typography variant="body2" color="text.secondary">Free Exam Conversion Rate</Typography>
                <Typography variant="h5" fontWeight="bold">{stats.freeExamConversionRate?.rate ?? 0}%</Typography>
                <Typography variant="caption" color="text.secondary">
                  {stats.freeExamConversionRate?.convertedUsers || 0} of {stats.freeExamConversionRate?.freeExamUsers || 0} free-exam users subscribed
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <Card elevation={3}>
              <CardContent>
                <Typography variant="body2" color="text.secondary">Subscription Renewals</Typography>
                <Typography variant="h5" fontWeight="bold">{stats.renewals?.totalRenewals || 0}</Typography>
                <Typography variant="caption" color="text.secondary">
                  across {stats.renewals?.subscriptionsRenewed || 0} subscriptions
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <Card elevation={3}>
              <CardContent>
                <Typography variant="body2" color="text.secondary">Expired Subscriptions</Typography>
                <Typography variant="h5" fontWeight="bold">{stats.expiredSubscriptions || 0}</Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Recent Renewals Detail */}
          <Grid item xs={12}>
            <Card elevation={3}>
              <CardContent>
                <Typography variant="h6" fontWeight="bold" gutterBottom>
                  Recent Subscription Renewals
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>User</TableCell>
                        <TableCell>Plan</TableCell>
                        <TableCell>Level</TableCell>
                        <TableCell align="right">Times Renewed</TableCell>
                        <TableCell>Last Renewed</TableCell>
                        <TableCell>New Expiry</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {stats.renewalsList?.map((sub) => (
                        <TableRow key={sub._id}>
                          <TableCell>
                            <Typography fontWeight="bold">
                              {sub.user?.firstName} {sub.user?.lastName}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {sub.user?.email}
                            </Typography>
                          </TableCell>
                          <TableCell>{sub.plan?.name}</TableCell>
                          <TableCell>{sub.level?.name}</TableCell>
                          <TableCell align="right">
                            <Chip label={sub.renewalCount} size="small" color="info" />
                          </TableCell>
                          <TableCell>{sub.lastRenewedAt ? new Date(sub.lastRenewedAt).toLocaleDateString() : '-'}</TableCell>
                          <TableCell>{new Date(sub.expiresAt).toLocaleDateString()}</TableCell>
                        </TableRow>
                      ))}
                      {(!stats.renewalsList || stats.renewalsList.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={6} align="center">
                            <Typography variant="body2" color="text.secondary">No renewals yet</Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>

          {/* Expired Subscriptions Detail */}
          <Grid item xs={12}>
            <Card elevation={3}>
              <CardContent>
                <Typography variant="h6" fontWeight="bold" gutterBottom>
                  Recently Expired Subscriptions
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>User</TableCell>
                        <TableCell>Plan</TableCell>
                        <TableCell>Level</TableCell>
                        <TableCell>Expired On</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {stats.expiredSubscriptionsList?.map((sub) => (
                        <TableRow key={sub._id}>
                          <TableCell>
                            <Typography fontWeight="bold">
                              {sub.user?.firstName} {sub.user?.lastName}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {sub.user?.email}
                            </Typography>
                          </TableCell>
                          <TableCell>{sub.plan?.name}</TableCell>
                          <TableCell>{sub.level?.name}</TableCell>
                          <TableCell>{new Date(sub.expiresAt).toLocaleDateString()}</TableCell>
                        </TableRow>
                      ))}
                      {(!stats.expiredSubscriptionsList || stats.expiredSubscriptionsList.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={4} align="center">
                            <Typography variant="body2" color="text.secondary">No expired subscriptions</Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>

          {/* Recent Subscriptions */}
          <Grid item xs={12}>
            <Card elevation={3}>
              <CardContent>
                <Typography variant="h6" fontWeight="bold" gutterBottom>
                  Recent Subscriptions
                </Typography>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>User</TableCell>
                        <TableCell>Plan</TableCell>
                        <TableCell>Level</TableCell>
                        <TableCell>Start Date</TableCell>
                        <TableCell>Expiry Date</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {stats.recentSubscriptions?.map((sub) => (
                        <TableRow key={sub._id}>
                          <TableCell>
                            <Typography fontWeight="bold">
                              {sub.user?.firstName} {sub.user?.lastName}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {sub.user?.email}
                            </Typography>
                          </TableCell>
                          <TableCell>{sub.plan?.name}</TableCell>
                          <TableCell>{sub.level?.name}</TableCell>
                          <TableCell>
                            {new Date(sub.startsAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            {new Date(sub.expiresAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={sub.status}
                              color={sub.status === 'active' ? 'success' : 'default'}
                              size="small"
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Button
                              size="small"
                              variant="outlined"
                              color="warning"
                              startIcon={<Cancel />}
                              disabled={subActioningId === sub._id || sub.status !== 'active'}
                              onClick={() => handleCancelLevelSubscription(sub)}
                            >
                              Cancel
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>

          {/* Organization Subscriptions */}
          <Grid item xs={12}>
            <AccountPlanSection
              title="Organization Subscriptions"
              icon={<Business color="primary" />}
              data={stats.accountPlans?.organization}
            />
          </Grid>

          {/* Individual Teacher Subscriptions */}
          <Grid item xs={12}>
            <AccountPlanSection
              title="Individual Teacher Subscriptions"
              icon={<Person color="primary" />}
              data={stats.accountPlans?.individual}
            />
          </Grid>
        </Grid>
      )}

      <Snackbar
        open={!!toast}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {toast && (
          <Alert severity={toast.severity} onClose={() => setToast(null)}>
            {toast.message}
          </Alert>
        )}
      </Snackbar>
    </Container>
  );
};

export default SubscriptionReports;
