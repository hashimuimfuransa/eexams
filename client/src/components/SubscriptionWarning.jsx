import { useState, useEffect } from 'react';
import { Box, Typography, Paper, Button, Alert, Dialog, DialogTitle, DialogContent, DialogActions, Chip } from '@mui/material';
import { Warning, Upgrade, Close } from '@mui/icons-material';
import { tokens } from '../pages/dashboardTokens';

function SubscriptionWarning({ user, onLogout }) {
  const [showDialog, setShowDialog] = useState(false);
  const [daysRemaining, setDaysRemaining] = useState(null);

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

  // Expired subscription
  if (user?.subscriptionStatus === 'expired') {
    return (
      <Dialog open={true} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Warning sx={{ color: '#DC2626', fontSize: 28 }} />
          Subscription Expired
        </DialogTitle>
        <DialogContent>
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>
              Your subscription has expired
            </Typography>
            <Typography variant="body2" sx={{ color: tokens.textMuted, mb: 3 }}>
              Your {user?.subscriptionPlan || 'free'} plan expired on{' '}
              {user?.subscriptionExpiresAt ? new Date(user.subscriptionExpiresAt).toLocaleDateString() : 'unknown'}.
              {user?.subscriptionPlan === 'free' ? (
                <Box sx={{ mt: 2, p: 2, bgcolor: '#FEF2F2', borderRadius: 2, border: '1px solid #FECACA' }}>
                  <Typography variant="body2" sx={{ color: '#991B1B', fontWeight: 600 }}>
                    ⚠️ Free plan users must upgrade to a paid plan after expiration.
                  </Typography>
                </Box>
              ) : (
                <Typography variant="body2" sx={{ mt: 2 }}>
                  Please renew your subscription to continue using the platform.
                </Typography>
              )}
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 3 }}>
              <Button
                variant="contained"
                fullWidth
                sx={{
                  borderRadius: 2,
                  bgcolor: tokens.accent,
                  '&:hover': { bgcolor: '#0AAE5E' }
                }}
                onClick={() => window.location.href = '/contact'}
                startIcon={<Upgrade />}
              >
                Upgrade Subscription
              </Button>
              <Button
                variant="outlined"
                fullWidth
                onClick={onLogout}
                sx={{ borderRadius: 2 }}
              >
                Logout
              </Button>
            </Box>
          </Box>
        </DialogContent>
      </Dialog>
    );
  }

  // Subscription expiring soon (within 30 days)
  if (daysRemaining !== null && daysRemaining <= 30 && daysRemaining > 0) {
    const isUrgent = daysRemaining <= 7;
    return (
      <Paper
        elevation={0}
        sx={{
          mb: 2,
          p: 2,
          borderRadius: 2,
          bgcolor: isUrgent ? '#FFF7ED' : '#F0FDF4',
          border: `1px solid ${isUrgent ? '#FED7AA' : '#86EFAC'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Warning sx={{ color: isUrgent ? '#B45309' : '#166534', fontSize: 24 }} />
          <Box>
            <Typography variant="body2" fontWeight={700} sx={{ color: isUrgent ? '#92400E' : '#166534' }}>
              {isUrgent ? 'Subscription Expiring Soon' : 'Subscription Expiring'}
            </Typography>
            <Typography variant="caption" sx={{ color: tokens.textMuted }}>
              Your {user?.subscriptionPlan || 'free'} plan expires in {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} on{' '}
              {user?.subscriptionExpiresAt ? new Date(user.subscriptionExpiresAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'unknown'}.
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            size="small"
            variant="contained"
            sx={{
              borderRadius: 2,
              bgcolor: tokens.accent,
              '&:hover': { bgcolor: '#0AAE5E' }
            }}
            onClick={() => window.location.href = '/contact'}
            startIcon={<Upgrade />}
          >
            Renew
          </Button>
          <IconButton size="small" onClick={() => setShowDialog(false)}>
            <Close fontSize="small" />
          </IconButton>
        </Box>
      </Paper>
    );
  }

  return null;
}

export default SubscriptionWarning;
