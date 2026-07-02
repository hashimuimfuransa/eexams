import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Button, Dialog, DialogContent, LinearProgress } from '@mui/material';
import { Lock, ArrowForward } from '@mui/icons-material';
import { tokens } from '../pages/dashboardTokens';
import { useAuth } from '../context/AuthContext';

// Single global popup for "you've hit your plan limit" (exams / students /
// teachers). The api.js response interceptor broadcasts a 'plan-limit-exceeded'
// window event whenever the backend returns { code: 'PLAN_LIMIT_EXCEEDED' },
// so this works for every action — exam creation, adding a student, adding a
// teacher — for both teacher and admin accounts, without wiring each call site.
export default function PlanLimitModal() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    const handler = (e) => setDetail(e.detail || {});
    window.addEventListener('plan-limit-exceeded', handler);
    return () => window.removeEventListener('plan-limit-exceeded', handler);
  }, []);

  if (!detail) return null;

  const isOrg = user?.userType === 'organization' || user?.role === 'admin';
  const { message, limit, current } = detail;
  const percent = typeof limit === 'number' && limit > 0 && typeof current === 'number'
    ? Math.min(100, Math.round((current / limit) * 100))
    : 100;

  const handleUpgrade = () => {
    setDetail(null);
    navigate(isOrg ? '/organization/subscription' : '/individual/subscription');
  };

  return (
    <Dialog open onClose={() => setDetail(null)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 4, overflow: 'hidden' } }}>
      <Box sx={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)', px: 3, py: 3, textAlign: 'center' }}>
        <Box sx={{
          width: 56, height: 56, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 1.5
        }}>
          <Lock sx={{ color: 'white', fontSize: 28 }} />
        </Box>
        <Typography variant="h6" sx={{ color: 'white', fontWeight: 800 }}>
          You've Reached Your Plan Limit
        </Typography>
      </Box>
      <DialogContent sx={{ pt: 3, textAlign: 'center' }}>
        <Typography variant="body2" sx={{ color: tokens.textMuted, mb: typeof limit === 'number' ? 2 : 3 }}>
          {message || 'This action requires a higher plan.'}
        </Typography>

        {typeof limit === 'number' && typeof current === 'number' && (
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="caption" sx={{ color: tokens.textMuted, fontWeight: 600 }}>Used</Typography>
              <Typography variant="caption" sx={{ color: '#D97706', fontWeight: 700 }}>{current} / {limit}</Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={percent}
              sx={{ height: 8, borderRadius: 4, bgcolor: '#FEF3C7', '& .MuiLinearProgress-bar': { bgcolor: '#F59E0B', borderRadius: 4 } }}
            />
          </Box>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Button
            variant="contained"
            fullWidth
            size="large"
            onClick={handleUpgrade}
            endIcon={<ArrowForward />}
            sx={{
              borderRadius: 2.5,
              bgcolor: tokens.accent,
              fontWeight: 700,
              textTransform: 'none',
              py: 1.25,
              boxShadow: `0 4px 14px ${tokens.accent}55`,
              '&:hover': { bgcolor: '#0AAE5E' }
            }}
          >
            Upgrade Now
          </Button>
          <Button
            variant="text"
            fullWidth
            onClick={() => setDetail(null)}
            sx={{ borderRadius: 2, color: tokens.textMuted, textTransform: 'none' }}
          >
            Maybe Later
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
