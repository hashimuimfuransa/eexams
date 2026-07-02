import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Paper, Button, IconButton, Chip, Dialog, DialogTitle, DialogContent } from '@mui/material';
import { WarningAmber, ArrowForward, Close, RocketLaunch, ErrorOutline, Bolt } from '@mui/icons-material';
import { tokens } from '../pages/dashboardTokens';

// Shared visual for the free-plan nudge and the expiring-soon banner —
// three severities that only differ by color/copy/urgency.
function UpgradeBanner({ severity, icon, title, chipLabel, message, ctaLabel, onUpgrade, onDismiss }) {
  const palettes = {
    calm: { grad: 'linear-gradient(135deg, rgba(12,189,115,0.10), rgba(12,189,115,0.02))', border: 'rgba(12,189,115,0.28)', accent: tokens.accent, iconBg: 'rgba(12,189,115,0.14)', chipBg: 'rgba(12,189,115,0.14)', chipColor: '#0B7A4A', titleColor: tokens.textPrimary },
    warning: { grad: 'linear-gradient(135deg, rgba(245,158,11,0.14), rgba(245,158,11,0.03))', border: 'rgba(245,158,11,0.35)', accent: '#D97706', iconBg: 'rgba(245,158,11,0.18)', chipBg: 'rgba(245,158,11,0.18)', chipColor: '#92400E', titleColor: '#92400E' },
    urgent: { grad: 'linear-gradient(135deg, rgba(239,68,68,0.14), rgba(239,68,68,0.03))', border: 'rgba(239,68,68,0.4)', accent: '#DC2626', iconBg: 'rgba(239,68,68,0.18)', chipBg: 'rgba(239,68,68,0.18)', chipColor: '#991B1B', titleColor: '#991B1B' }
  };
  const p = palettes[severity];

  return (
    <Paper
      elevation={0}
      sx={{
        position: 'relative',
        mb: 2.5,
        p: { xs: 2, sm: 2.5 },
        pr: { xs: 5, sm: 5.5 },
        borderRadius: 3,
        background: p.grad,
        border: `1px solid ${p.border}`,
        borderLeft: `4px solid ${p.accent}`,
        boxShadow: '0 4px 18px rgba(13,64,108,0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 2,
        flexWrap: 'wrap'
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.75, minWidth: 0 }}>
        <Box sx={{
          width: 44, height: 44, borderRadius: '50%', bgcolor: p.iconBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          boxShadow: `0 0 0 4px ${p.iconBg.replace('0.14', '0.06').replace('0.18', '0.08')}`
        }}>
          {icon}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.25 }}>
            <Typography variant="body2" fontWeight={800} sx={{ color: p.titleColor, fontSize: 14 }}>
              {title}
            </Typography>
            {chipLabel && (
              <Chip
                label={chipLabel}
                size="small"
                sx={{ height: 20, fontSize: 10.5, fontWeight: 700, bgcolor: p.chipBg, color: p.chipColor }}
              />
            )}
          </Box>
          <Typography variant="caption" sx={{ color: tokens.textMuted, lineHeight: 1.4, display: 'block' }}>
            {message}
          </Typography>
        </Box>
      </Box>

      <Button
        variant="contained"
        onClick={onUpgrade}
        endIcon={<ArrowForward sx={{ fontSize: 16 }} />}
        sx={{
          borderRadius: 2.5,
          bgcolor: p.accent,
          whiteSpace: 'nowrap',
          fontWeight: 700,
          textTransform: 'none',
          px: 2.25,
          boxShadow: `0 4px 12px ${p.accent}40`,
          transition: 'transform 0.15s, box-shadow 0.15s',
          '&:hover': { bgcolor: p.accent, transform: 'translateY(-1px)', boxShadow: `0 6px 16px ${p.accent}55` }
        }}
      >
        {ctaLabel}
      </Button>

      <IconButton
        size="small"
        onClick={onDismiss}
        sx={{ position: 'absolute', top: 8, right: 8, color: tokens.textMuted }}
      >
        <Close fontSize="small" />
      </IconButton>
    </Paper>
  );
}

function SubscriptionWarning({ user, onLogout }) {
  const navigate = useNavigate();
  const [expiringDismissed, setExpiringDismissed] = useState(false);
  const [freeBannerDismissed, setFreeBannerDismissed] = useState(false);
  const [daysRemaining, setDaysRemaining] = useState(null);

  const isOrg = user?.userType === 'organization' || user?.role === 'admin';
  const goToUpgrade = () => navigate(isOrg ? '/organization/subscription' : '/individual/subscription');

  useEffect(() => {
    if (!user?.subscriptionExpiresAt) {
      setDaysRemaining(null);
      return;
    }

    const now = new Date();
    const expiresAt = new Date(user.subscriptionExpiresAt);
    const diffTime = expiresAt - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    setDaysRemaining(diffDays);
  }, [user?.subscriptionExpiresAt]);

  // Enterprise plans don't expire
  if (user?.subscriptionPlan === 'enterprise') {
    return null;
  }

  // Expired subscription (or free plan whose trial period has run out)
  if (user?.subscriptionStatus === 'expired') {
    const isFreePlan = (user?.subscriptionPlan || 'free').toLowerCase() === 'free';
    return (
      <Dialog open={true} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 4, overflow: 'hidden' } }}>
        <Box sx={{ background: 'linear-gradient(135deg, #DC2626, #B91C1C)', px: 3, py: 3, textAlign: 'center' }}>
          <Box sx={{
            width: 56, height: 56, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 1.5
          }}>
            <ErrorOutline sx={{ color: 'white', fontSize: 30 }} />
          </Box>
          <Typography variant="h6" sx={{ color: 'white', fontWeight: 800 }}>
            {isFreePlan ? 'Your Free Plan Has Ended' : 'Your Subscription Has Expired'}
          </Typography>
        </Box>
        <DialogContent sx={{ pt: 3 }}>
          <Box sx={{ textAlign: 'center', pb: 1 }}>
            <Typography variant="body2" sx={{ color: tokens.textMuted, mb: 2 }}>
              {isFreePlan
                ? `Your free plan expired on ${user?.subscriptionExpiresAt ? new Date(user.subscriptionExpiresAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'unknown'}. Upgrade now to keep creating exams, adding students, and using every feature without interruption.`
                : `Your ${user?.subscriptionPlan} plan expired on ${user?.subscriptionExpiresAt ? new Date(user.subscriptionExpiresAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'unknown'}. Renew now to pick up right where you left off.`}
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 3 }}>
              <Button
                variant="contained"
                fullWidth
                size="large"
                sx={{
                  borderRadius: 2.5,
                  bgcolor: tokens.accent,
                  fontWeight: 700,
                  textTransform: 'none',
                  py: 1.25,
                  boxShadow: `0 4px 14px ${tokens.accent}55`,
                  '&:hover': { bgcolor: '#0AAE5E' }
                }}
                onClick={goToUpgrade}
                endIcon={<ArrowForward />}
              >
                {isFreePlan ? 'Upgrade Now' : 'Renew Subscription'}
              </Button>
              <Button
                variant="text"
                fullWidth
                onClick={onLogout}
                sx={{ borderRadius: 2, color: tokens.textMuted, textTransform: 'none' }}
              >
                Sign Out
              </Button>
            </Box>
          </Box>
        </DialogContent>
      </Dialog>
    );
  }

  // Subscription expiring soon (within 30 days) — applies to free-trial
  // periods too, since a free plan's subscriptionExpiresAt works the same way.
  if (daysRemaining !== null && daysRemaining <= 30 && daysRemaining > 0 && !expiringDismissed) {
    const isUrgent = daysRemaining <= 7;
    const planLabel = (user?.subscriptionPlan || 'free').toLowerCase() === 'free' ? 'free plan' : `${user?.subscriptionPlan} plan`;
    return (
      <UpgradeBanner
        severity={isUrgent ? 'urgent' : 'warning'}
        icon={isUrgent ? <Bolt sx={{ color: '#DC2626', fontSize: 22 }} /> : <WarningAmber sx={{ color: '#D97706', fontSize: 22 }} />}
        title={isUrgent ? 'Your plan expires very soon' : 'Your plan is expiring soon'}
        chipLabel={`${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} left`}
        message={`Your ${planLabel} ends on ${user?.subscriptionExpiresAt ? new Date(user.subscriptionExpiresAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'unknown'}. Upgrade now to avoid any interruption to your exams and students.`}
        ctaLabel={isUrgent ? 'Upgrade Now' : 'Renew Plan'}
        onUpgrade={goToUpgrade}
        onDismiss={() => setExpiringDismissed(true)}
      />
    );
  }

  // Free plan, nothing expiring imminently — a gentle, ever-present nudge.
  // Org teachers' plans are managed by their admin, so they get no upgrade CTA of their own.
  const plan = (user?.subscriptionPlan || 'free').toLowerCase();
  if (plan === 'free' && !user?.isOrgTeacher && !freeBannerDismissed) {
    return (
      <UpgradeBanner
        severity="calm"
        icon={<RocketLaunch sx={{ color: tokens.accent, fontSize: 21 }} />}
        title="You're on the Free plan"
        chipLabel={null}
        message={isOrg
          ? "Unlock more teachers, more students, and advanced reports by upgrading — it only takes a minute."
          : "Unlock unlimited exams, AI-powered question generation, and richer reports by upgrading — it only takes a minute."}
        ctaLabel="Upgrade Now"
        onUpgrade={goToUpgrade}
        onDismiss={() => setFreeBannerDismissed(true)}
      />
    );
  }

  return null;
}

export default SubscriptionWarning;
