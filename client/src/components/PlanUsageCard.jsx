import { useNavigate } from 'react-router-dom';
import { Box, Typography, Paper, Chip, CircularProgress, Alert, Divider, Button, Stack } from '@mui/material';
import { CalendarToday, TrendingUp, School, Assignment, WarningRounded, WorkspacePremium, CheckCircle, Lock } from '@mui/icons-material';
import { tokens } from '../pages/dashboardTokens';
import { usePlanContext } from '../context/PlanContext';

// Mirrors FEATURE_FLAG_DEFS in the Super Admin Organization/Individual Plan
// Management dialogs — same fields, same order, so what an admin toggles
// there is exactly what a user sees included/locked here.
const FEATURE_LABELS = [
  { key: 'aiFeatures', label: 'AI Question Generation' },
  { key: 'advancedAI', label: 'Advanced AI Features' },
  { key: 'analytics', label: 'Analytics Dashboard' },
  { key: 'prioritySupport', label: 'Priority Support' },
  { key: 'customBranding', label: 'Custom Branding' },
  { key: 'apiAccess', label: 'API Access' },
  { key: 'marketplaceAccess', label: 'Marketplace Access' },
  { key: 'templates', label: 'Exam Templates' }
];

export default function PlanUsageCard({ user, compact = false }) {
  const navigate = useNavigate();
  const { usage: planUsage, loading } = usePlanContext();
  const error = !loading && !planUsage ? 'Failed to load plan information' : null;

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

  const { plan, planName, subscriptionStatus, subscriptionExpiresAt, daysLeft, hoursLeft, limits, features } = planUsage;
  const isExpired = subscriptionStatus === 'expired';
  const formatExpiry = (date) => new Date(date).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  const isOrg = user?.userType === 'organization' || user?.role === 'admin';

  const resourceLabels = { exams: 'Exams', students: 'Students', teachers: 'Teacher Accounts' };
  const maxedOutResources = Object.entries(limits || {})
    .filter(([, v]) => v && v.limit !== -1 && v.limit > 0 && v.used >= v.limit)
    .map(([key, v]) => ({ key, label: resourceLabels[key] || key, ...v }));
  const hasReachedLimit = maxedOutResources.length > 0;

  const handleUpgradeClick = () => {
    navigate(isOrg ? '/organization/subscription' : '/individual/subscription');
  };

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

  if (compact) {
    return (
      <Paper
        sx={{
          p: 2,
          borderRadius: 2,
          bgcolor: hasReachedLimit ? '#FEF2F2' : 'white',
          border: hasReachedLimit ? '1px solid #FECACA' : `1px solid ${tokens.surfaceBorder || 'transparent'}`
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                bgcolor: hasReachedLimit ? '#EF4444' : `${getStatusColor(subscriptionStatus)}15`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              {hasReachedLimit
                ? <WarningRounded sx={{ color: '#fff', fontSize: 20 }} />
                : <WorkspacePremium sx={{ color: getStatusColor(subscriptionStatus), fontSize: 20 }} />}
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 700, color: tokens.primary, textTransform: 'capitalize' }} noWrap>
                {planName} Plan
              </Typography>
              <Typography variant="caption" sx={{ color: hasReachedLimit ? '#B91C1C' : tokens.textMuted, fontWeight: hasReachedLimit ? 600 : 400 }} noWrap>
                {hasReachedLimit
                  ? `${maxedOutResources.map(r => r.label).join(' & ')} limit reached`
                  : isExpired
                  ? `Expired${subscriptionExpiresAt ? ` on ${formatExpiry(subscriptionExpiresAt)}` : ''}`
                  : hoursLeft !== null
                  ? `${hoursLeft} hour${hoursLeft !== 1 ? 's' : ''} remaining`
                  : daysLeft !== null
                  ? `${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining`
                  : subscriptionStatus}
              </Typography>
            </Box>
          </Box>
          <Button
            size="small"
            onClick={handleUpgradeClick}
            variant={hasReachedLimit ? 'contained' : 'outlined'}
            sx={{
              borderRadius: 2,
              fontWeight: 700,
              flexShrink: 0,
              ...(hasReachedLimit
                ? { bgcolor: '#EF4444', '&:hover': { bgcolor: '#DC2626' } }
                : { borderColor: tokens.surfaceBorder, color: tokens.primary })
            }}
          >
            {hasReachedLimit ? 'Upgrade Now' : 'Manage Plan'}
          </Button>
        </Box>
      </Paper>
    );
  }

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

      {hasReachedLimit && (
        <Box
          sx={{
            mb: 3,
            p: 2.5,
            borderRadius: 2.5,
            background: 'linear-gradient(135deg, #EF4444 0%, #B91C1C 100%)',
            boxShadow: '0 8px 20px rgba(239,68,68,0.3)',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                bgcolor: 'rgba(255,255,255,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <WarningRounded sx={{ color: '#fff', fontSize: 22 }} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#fff', lineHeight: 1.3 }}>
                {isOrg ? "Your organisation has" : "You've"} reached your plan limit
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)', mt: 0.5 }}>
                {maxedOutResources.map(r => `${r.label} (${r.used}/${r.limit})`).join(' · ')} maxed out on the{' '}
                <strong style={{ textTransform: 'capitalize' }}>{planName}</strong> plan.
              </Typography>
            </Box>
          </Box>
          <Button
            fullWidth
            onClick={handleUpgradeClick}
            startIcon={<WorkspacePremium />}
            sx={{
              mt: 2,
              bgcolor: '#fff',
              color: '#B91C1C',
              fontWeight: 700,
              borderRadius: 2,
              py: 1,
              '&:hover': { bgcolor: 'rgba(255,255,255,0.9)' }
            }}
          >
            Upgrade Plan to Continue
          </Button>
        </Box>
      )}

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
              {isExpired ? 'Expired' : hoursLeft !== null ? 'Hours Remaining' : daysLeft !== null ? 'Days Remaining' : 'Expires On'}
            </Typography>
          </Box>
          {isExpired ? (
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#EF4444' }}>
              Expired on {formatExpiry(subscriptionExpiresAt)}
            </Typography>
          ) : hoursLeft !== null ? (
            <Typography
              variant="h4"
              sx={{ fontWeight: 700, color: getDaysLeftColor(0), fontSize: '2rem' }}
            >
              {hoursLeft} hour{hoursLeft !== 1 ? 's' : ''}
            </Typography>
          ) : daysLeft !== null ? (
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
              {formatExpiry(subscriptionExpiresAt)}
            </Typography>
          )}
          {!isExpired && (daysLeft !== null || hoursLeft !== null) && (
            <Typography variant="caption" sx={{ color: tokens.textMuted, display: 'block', mt: 0.5 }}>
              Expires: {formatExpiry(subscriptionExpiresAt)}
            </Typography>
          )}
        </Box>
      )}

      {/* Only show usage limits for teachers and admins, not students */}
      {user?.role !== 'student' && (
        <>
          <Divider sx={{ my: 3 }} />

          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.25, color: tokens.primary }}>
            {isOrg ? "Your Organisation's Usage" : 'Your Usage'}
          </Typography>
          <Typography variant="caption" sx={{ color: tokens.textMuted, display: 'block', mb: 2 }}>
            {isOrg
              ? "How your organisation's teachers, students and exams stack up against your plan."
              : 'How your exams and students stack up against your plan.'}
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {limits.exams && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  ...(limits.exams.limit !== -1 && limits.exams.used >= limits.exams.limit && {
                    p: 1.25,
                    ml: -1.25,
                    mr: -1.25,
                    borderRadius: 2,
                    bgcolor: '#FEF2F2',
                    border: '1px solid #FECACA'
                  })
                }}
              >
                <Assignment sx={{ color: limits.exams.limit !== -1 && limits.exams.used >= limits.exams.limit ? '#EF4444' : tokens.accent, fontSize: 20 }} />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" sx={{ color: tokens.textMuted }}>
                    Exams
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      {limits.exams.used} / {limits.exams.limit === -1 ? 'Unlimited' : limits.exams.limit}
                    </Typography>
                    {limits.exams.limit !== -1 && limits.exams.used >= limits.exams.limit && (
                      <Chip label="Limit reached" size="small" sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700, bgcolor: '#EF4444', color: '#fff' }} />
                    )}
                  </Box>
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
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  ...(limits.students.limit !== -1 && limits.students.used >= limits.students.limit && {
                    p: 1.25,
                    ml: -1.25,
                    mr: -1.25,
                    borderRadius: 2,
                    bgcolor: '#FEF2F2',
                    border: '1px solid #FECACA'
                  })
                }}
              >
                <School sx={{ color: limits.students.limit !== -1 && limits.students.used >= limits.students.limit ? '#EF4444' : tokens.accent, fontSize: 20 }} />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" sx={{ color: tokens.textMuted }}>
                    Students
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      {limits.students.used} / {limits.students.limit === -1 ? 'Unlimited' : limits.students.limit}
                    </Typography>
                    {limits.students.limit !== -1 && limits.students.used >= limits.students.limit && (
                      <Chip label="Limit reached" size="small" sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700, bgcolor: '#EF4444', color: '#fff' }} />
                    )}
                  </Box>
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
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  ...(limits.teachers.limit !== -1 && limits.teachers.used >= limits.teachers.limit && {
                    p: 1.25,
                    ml: -1.25,
                    mr: -1.25,
                    borderRadius: 2,
                    bgcolor: '#FEF2F2',
                    border: '1px solid #FECACA'
                  })
                }}
              >
                <TrendingUp sx={{ color: limits.teachers.limit !== -1 && limits.teachers.used >= limits.teachers.limit ? '#EF4444' : tokens.accent, fontSize: 20 }} />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" sx={{ color: tokens.textMuted }}>
                    Teacher Accounts
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      {limits.teachers.used} / {limits.teachers.limit === -1 ? 'Unlimited' : limits.teachers.limit}
                    </Typography>
                    {limits.teachers.limit !== -1 && limits.teachers.used >= limits.teachers.limit && (
                      <Chip label="Limit reached" size="small" sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700, bgcolor: '#EF4444', color: '#fff' }} />
                    )}
                  </Box>
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

          <Divider sx={{ my: 3 }} />

          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, color: tokens.primary }}>
            What's Included
          </Typography>
          <Stack direction="row" flexWrap="wrap" gap={1}>
            {FEATURE_LABELS.map(({ key, label }) => {
              const included = !!(features && features[key]);
              return (
                <Chip
                  key={key}
                  size="small"
                  icon={included ? <CheckCircle sx={{ fontSize: 16 }} /> : <Lock sx={{ fontSize: 14 }} />}
                  label={label}
                  sx={{
                    bgcolor: included ? 'rgba(16,185,129,0.1)' : '#F1F5F9',
                    color: included ? '#10B981' : tokens.textMuted,
                    fontWeight: 600,
                    '& .MuiChip-icon': { color: included ? '#10B981' : tokens.textMuted }
                  }}
                />
              );
            })}
          </Stack>
        </>
      )}
    </Paper>
  );
}
