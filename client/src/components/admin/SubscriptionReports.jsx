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
  Chip
} from '@mui/material';
import {
  Assessment,
  TrendingUp,
  People,
  AttachMoney,
  School
} from '@mui/icons-material';
import api from '../../services/api';

const SubscriptionReports = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchStats();
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
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </Container>
  );
};

export default SubscriptionReports;
