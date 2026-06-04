import { useState, useEffect } from 'react';
import { Box, Typography, Paper, Chip, CircularProgress, Alert, Divider } from '@mui/material';
import { CalendarToday, TrendingUp, School, Assignment } from '@mui/icons-material';
import { tokens } from '../pages/dashboardTokens';
import api from '../services/api';

export default function PlanUsageCard({ user }) {
  const [planUsage, setPlanUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchPlanUsage();
  }, [user?._id]);

  const fetchPlanUsage = async () => {
    try {
      setLoading(true);
      const res = await api.get('/profile/plan-usage');
      setPlanUsage(res.data);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch plan usage:', err);
      setError('Failed to load plan information');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Paper sx={{ p: 3, borderRadius: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={24} />
        </Box>
      </Paper>
    );
  }

  if (error) {
    return (
      <Paper sx={{ p: 3, borderRadius: 2 }}>
        <Alert severity="error">{error}</Alert>
      </Paper>
    );
  }

  const { plan, planName, subscriptionStatus, subscriptionExpiresAt, daysLeft, limits, features } = planUsage;

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return '#10B981';
      case 'pending': return '#F59E0B';
      case 'expired': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const getDaysLeftColor = (days) => {
    if (days === null) return '#6B7280';
    if (days <= 7) return '#EF4444';
    if (days <= 30) return '#F59E0B';
    return '#10B981';
  };

  return (
    <Paper sx={{ p: 3, borderRadius: 2, bgcolor: 'white' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, color: tokens.primary }}>
          Subscription Plan
        </Typography>
        <Chip
          label={planName}
          sx={{
            bgcolor: `${getStatusColor(subscriptionStatus)}15`,
            color: getStatusColor(subscriptionStatus),
            fontWeight: 600,
            textTransform: 'capitalize'
          }}
        />
      </Box>

      <Box sx={{ mb: 3 }}>
        <Typography variant="body2" sx={{ color: tokens.textMuted, mb: 1 }}>
          Status
        </Typography>
        <Chip
          label={subscriptionStatus}
          sx={{
            bgcolor: `${getStatusColor(subscriptionStatus)}15`,
            color: getStatusColor(subscriptionStatus),
            fontWeight: 600,
            textTransform: 'capitalize'
          }}
        />
      </Box>

      {subscriptionExpiresAt && plan !== 'enterprise' && (
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <CalendarToday sx={{ fontSize: 18, color: tokens.textMuted }} />
            <Typography variant="body2" sx={{ color: tokens.textMuted }}>
              {daysLeft !== null ? `Days Remaining` : 'Expires On'}
            </Typography>
          </Box>
          {daysLeft !== null ? (
            <Typography
              variant="h4"
              sx={{
                fontWeight: 700,
                color: getDaysLeftColor(daysLeft),
                fontSize: '2rem'
              }}
            >
              {daysLeft} day{daysLeft !== 1 ? 's' : ''}
            </Typography>
          ) : (
            <Typography variant="body1" sx={{ fontWeight: 600, color: tokens.textMuted }}>
              {new Date(subscriptionExpiresAt).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
              })}
            </Typography>
          )}
          {daysLeft !== null && (
            <Typography variant="caption" sx={{ color: tokens.textMuted, display: 'block', mt: 0.5 }}>
              Expires: {new Date(subscriptionExpiresAt).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
              })}
            </Typography>
          )}
        </Box>
      )}

      {/* Only show usage limits for teachers and admins, not students */}
      {user?.role !== 'student' && (
        <>
          <Divider sx={{ my: 3 }} />

          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2, color: tokens.primary }}>
            Usage Limits
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {limits.exams && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Assignment sx={{ color: tokens.accent, fontSize: 20 }} />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" sx={{ color: tokens.textMuted }}>
                    Exams
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                    {limits.exams.used} / {limits.exams.limit === -1 ? 'Unlimited' : limits.exams.limit}
                  </Typography>
                </Box>
                <Box sx={{ width: 100, height: 6, bgcolor: '#E5E7EB', borderRadius: 3, overflow: 'hidden' }}>
                  <Box
                    sx={{
                      width: `${limits.exams.limit === -1 ? 100 : Math.min((limits.exams.used / limits.exams.limit) * 100, 100)}%`,
                      height: '100%',
                      bgcolor: limits.exams.limit === -1 ? '#10B981' : (limits.exams.used >= limits.exams.limit ? '#EF4444' : tokens.accent),
                      borderRadius: 3
                    }}
                  />
                </Box>
              </Box>
            )}

            {limits.students && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <School sx={{ color: tokens.accent, fontSize: 20 }} />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" sx={{ color: tokens.textMuted }}>
                    Students
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                    {limits.students.used} / {limits.students.limit === -1 ? 'Unlimited' : limits.students.limit}
                  </Typography>
                </Box>
                <Box sx={{ width: 100, height: 6, bgcolor: '#E5E7EB', borderRadius: 3, overflow: 'hidden' }}>
                  <Box
                    sx={{
                      width: `${limits.students.limit === -1 ? 100 : Math.min((limits.students.used / limits.students.limit) * 100, 100)}%`,
                      height: '100%',
                      bgcolor: limits.students.limit === -1 ? '#10B981' : (limits.students.used >= limits.students.limit ? '#EF4444' : tokens.accent),
                      borderRadius: 3
                    }}
                  />
                </Box>
              </Box>
            )}

            {limits.teachers && limits.teachers.limit > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <TrendingUp sx={{ color: tokens.accent, fontSize: 20 }} />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" sx={{ color: tokens.textMuted }}>
                    Teachers
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                    {limits.teachers.used} / {limits.teachers.limit === -1 ? 'Unlimited' : limits.teachers.limit}
                  </Typography>
                </Box>
                <Box sx={{ width: 100, height: 6, bgcolor: '#E5E7EB', borderRadius: 3, overflow: 'hidden' }}>
                  <Box
                    sx={{
                      width: `${limits.teachers.limit === -1 ? 100 : Math.min((limits.teachers.used / limits.teachers.limit) * 100, 100)}%`,
                      height: '100%',
                      bgcolor: limits.teachers.limit === -1 ? '#10B981' : (limits.teachers.used >= limits.teachers.limit ? '#EF4444' : tokens.accent),
                      borderRadius: 3
                    }}
                  />
                </Box>
              </Box>
            )}
          </Box>
        </>
      )}
    </Paper>
  );
}
