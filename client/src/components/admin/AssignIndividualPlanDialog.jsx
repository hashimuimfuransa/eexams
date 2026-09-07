import { useState, useEffect, useMemo } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Box, Typography, Chip,
  Button, CircularProgress, Alert, FormControl, InputLabel, Select, MenuItem,
  TextField, Divider, IconButton, Grid
} from '@mui/material';
import { Close, CardMembership } from '@mui/icons-material';
import api from '../../services/api';
import { tokens, gradients, planColors as PLAN_COLORS } from '../../pages/dashboardTokens';
import { formatPlanDuration } from '../../utils/planUtils';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const getExpiry = (teacher) =>
  teacher?.subscriptionExpiresAt || teacher?.subscriptionEndDate || null;

// Mirror of server/utils/subscriptionStatus.js — the stored status can sit
// stale at 'active' long after the expiry timestamp has passed, so never show
// the raw field on its own.
const getEffectiveStatus = (teacher) => {
  if (!teacher) return null;
  if (teacher.subscriptionPlan === 'enterprise') return teacher.subscriptionStatus;
  if (teacher.subscriptionStatus === 'cancelled') return teacher.subscriptionStatus;
  const expiry = getExpiry(teacher);
  if (!expiry) return teacher.subscriptionStatus;
  return new Date(expiry).getTime() <= Date.now() ? 'expired' : teacher.subscriptionStatus;
};

const formatDate = (value) =>
  value ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';

const STATUS_COLORS = {
  active: tokens.accentDark,
  pending: tokens.warning,
  expired: '#EF4444',
  cancelled: '#EF4444'
};

/**
 * Super-admin grant of an IndividualPlan to a self-registered (individual)
 * teacher. Org teachers are excluded — their plan comes from their admin's
 * organisation subscription — and the server rejects them too.
 */
export default function AssignIndividualPlanDialog({ open, teacher, onClose, onUpdated }) {
  const [plans, setPlans] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [planId, setPlanId] = useState('');
  const [mode, setMode] = useState('extend');
  const [customDays, setCustomDays] = useState('');
  const [saving, setSaving] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setMode('extend');
    setCustomDays('');
    setConfirmRevoke(false);
    setLoadingPlans(true);
    api.get('/individual-plans')
      .then((res) => {
        const list = res.data || [];
        setPlans(list);
        // Pre-select an active plan on the teacher's current tier when they
        // already have one (the common case: a renewal), else the cheapest
        // active plan — the list arrives sorted by price.
        const active = list.filter((p) => p.status === 'active');
        const sameTier = active.find((p) => p.tierKey === teacher?.subscriptionPlan);
        setPlanId((sameTier || active[0] || list[0])?._id || '');
      })
      .catch((err) => {
        console.error('Error fetching individual plans:', err);
        setError('Failed to load the individual plan catalog');
      })
      .finally(() => setLoadingPlans(false));
  }, [open, teacher?._id, teacher?.subscriptionPlan]);

  const selectedPlan = useMemo(() => plans.find((p) => p._id === planId) || null, [plans, planId]);

  const currentStatus = getEffectiveStatus(teacher);
  const currentExpiry = getExpiry(teacher);
  const currentPlan = teacher?.subscriptionPlan || 'free';
  const isPaidNow = currentPlan !== 'free';
  const daysRemaining = currentExpiry
    ? Math.max(0, Math.ceil((new Date(currentExpiry).getTime() - Date.now()) / MS_PER_DAY))
    : null;

  const customDaysInvalid = customDays !== '' && (!Number.isFinite(Number(customDays)) || Number(customDays) <= 0);

  // Same computation the server does, so the admin sees the resulting expiry
  // before committing.
  const previewExpiry = useMemo(() => {
    if (!selectedPlan) return null;
    const days = customDays === '' ? selectedPlan.durationDays : Number(customDays);
    if (!Number.isFinite(days) || days <= 0) return null;
    const stillRunning = currentStatus === 'active' && currentExpiry && new Date(currentExpiry) > new Date();
    const base = mode === 'extend' && stillRunning ? new Date(currentExpiry) : new Date();
    return new Date(base.getTime() + days * MS_PER_DAY);
  }, [selectedPlan, customDays, mode, currentStatus, currentExpiry]);

  const handleAssign = async () => {
    if (!selectedPlan) return;
    setSaving(true);
    setError(null);
    try {
      const res = await api.put(`/superadmin/teachers/${teacher._id}/individual-plan`, {
        planId: selectedPlan._id,
        mode,
        ...(customDays === '' ? {} : { durationDays: Number(customDays) })
      });
      onUpdated?.(res.data.teacher, res.data.message);
      onClose();
    } catch (err) {
      console.error('Assign individual plan error:', err);
      setError(err.response?.data?.message || 'Failed to assign the plan');
    } finally {
      setSaving(false);
    }
  };

  const handleRevoke = async () => {
    setRevoking(true);
    setError(null);
    try {
      const res = await api.delete(`/superadmin/teachers/${teacher._id}/individual-plan`);
      onUpdated?.(res.data.teacher, res.data.message);
      onClose();
    } catch (err) {
      console.error('Revoke individual plan error:', err);
      setError(err.response?.data?.message || 'Failed to revoke the plan');
    } finally {
      setRevoking(false);
      setConfirmRevoke(false);
    }
  };

  const busy = saving || revoking;

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <CardMembership sx={{ color: tokens.accent }} />
          <Box>
            <Typography variant="h6" fontWeight={700} sx={{ fontFamily: "'DM Sans',sans-serif" }}>Assign Individual Plan</Typography>
            {teacher && (
              <Typography variant="caption" sx={{ color: tokens.textMuted, display: 'block' }}>
                {teacher.firstName} {teacher.lastName} • {teacher.email}
              </Typography>
            )}
          </Box>
        </Box>
        <IconButton size="small" onClick={onClose} disabled={busy}><Close fontSize="small" /></IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: '12px !important' }}>
        {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

        {/* Current subscription */}
        <Box sx={{ p: 2, mb: 2.5, borderRadius: 2, bgcolor: '#F8FAFC', border: `1px solid ${tokens.surfaceBorder}` }}>
          <Typography variant="caption" fontWeight={700} sx={{ color: tokens.textMuted, letterSpacing: 0.4 }}>CURRENT SUBSCRIPTION</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1, flexWrap: 'wrap' }}>
            <Chip
              label={currentPlan}
              size="small"
              sx={{ height: 24, fontWeight: 700, textTransform: 'capitalize', bgcolor: `${PLAN_COLORS[currentPlan] || PLAN_COLORS.free}15`, color: PLAN_COLORS[currentPlan] || PLAN_COLORS.free }}
            />
            <Chip
              label={currentStatus || 'unknown'}
              size="small"
              sx={{ height: 24, fontWeight: 600, textTransform: 'capitalize', bgcolor: `${STATUS_COLORS[currentStatus] || tokens.textMuted}15`, color: STATUS_COLORS[currentStatus] || tokens.textMuted }}
            />
            <Typography variant="caption" sx={{ color: tokens.textMuted }}>
              {isPaidNow
                ? `Expires ${formatDate(currentExpiry)}${daysRemaining !== null ? ` (${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left)` : ''}`
                : 'No paid plan yet'}
            </Typography>
          </Box>
        </Box>

        {loadingPlans ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={28} sx={{ color: tokens.accent }} /></Box>
        ) : plans.length === 0 ? (
          <Alert severity="info" sx={{ borderRadius: 2 }}>
            No individual plans exist yet. Create one under <b>Individual Plans</b> first.
          </Alert>
        ) : (
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <FormControl fullWidth size="small">
                <InputLabel sx={{ fontWeight: 600 }}>Plan</InputLabel>
                <Select
                  label="Plan"
                  value={planId}
                  onChange={(e) => setPlanId(e.target.value)}
                  sx={{ borderRadius: 2 }}
                  renderValue={(value) => {
                    const p = plans.find((x) => x._id === value);
                    return p ? `${p.name} — ${p.price?.toLocaleString()} ${p.currency || 'RWF'} · ${formatPlanDuration(p)}` : '';
                  }}
                >
                  {plans.map((p) => (
                    <MenuItem key={p._id} value={p._id}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Typography variant="body2" fontWeight={600}>{p.name}</Typography>
                        <Chip label={p.tierKey} size="small" sx={{ height: 18, fontSize: 10, textTransform: 'capitalize', bgcolor: `${PLAN_COLORS[p.tierKey] || PLAN_COLORS.free}15`, color: PLAN_COLORS[p.tierKey] || PLAN_COLORS.free }} />
                        <Typography variant="caption" sx={{ color: tokens.textMuted }}>
                          {p.price?.toLocaleString()} {p.currency || 'RWF'} • {formatPlanDuration(p)}
                        </Typography>
                        {p.status !== 'active' && (
                          <Chip label="inactive" size="small" sx={{ height: 18, fontSize: 10, bgcolor: 'rgba(239,68,68,0.1)', color: '#EF4444' }} />
                        )}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel sx={{ fontWeight: 600 }}>Start</InputLabel>
                <Select label="Start" value={mode} onChange={(e) => setMode(e.target.value)} sx={{ borderRadius: 2 }}>
                  <MenuItem value="extend">Extend remaining time</MenuItem>
                  <MenuItem value="replace">Restart from today</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="Custom duration (days)"
                value={customDays}
                onChange={(e) => setCustomDays(e.target.value)}
                error={customDaysInvalid}
                helperText={customDaysInvalid
                  ? 'Must be a positive number'
                  : selectedPlan ? `Blank = plan default (${formatPlanDuration(selectedPlan)})` : ' '}
                inputProps={{ min: 0, step: 'any' }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />
            </Grid>

            <Grid item xs={12}>
              <Box sx={{ p: 1.75, borderRadius: 2, bgcolor: `${tokens.accent}0D`, border: `1px solid ${tokens.accent}33` }}>
                <Typography variant="caption" sx={{ color: tokens.textMuted, fontWeight: 600, display: 'block' }}>New expiry after assigning</Typography>
                <Typography variant="body2" fontWeight={700} sx={{ color: tokens.accentDark }}>
                  {previewExpiry ? formatDate(previewExpiry) : '—'}
                </Typography>
                <Typography variant="caption" sx={{ color: tokens.textMuted }}>
                  Manual grant — no payment is recorded against it.
                </Typography>
              </Box>
            </Grid>
          </Grid>
        )}

        {isPaidNow && (
          <>
            <Divider sx={{ my: 2.5 }} />
            {confirmRevoke ? (
              <Alert
                severity="warning"
                sx={{ borderRadius: 2 }}
                action={
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button size="small" onClick={() => setConfirmRevoke(false)} disabled={revoking} sx={{ textTransform: 'none' }}>Keep</Button>
                    <Button size="small" color="error" variant="contained" onClick={handleRevoke} disabled={revoking} sx={{ textTransform: 'none' }}>
                      {revoking ? 'Revoking…' : 'Revoke'}
                    </Button>
                  </Box>
                }
              >
                Move this teacher back to the free plan? Their paid access ends immediately.
              </Alert>
            ) : (
              <Button size="small" color="error" onClick={() => setConfirmRevoke(true)} disabled={busy} sx={{ textTransform: 'none', fontWeight: 600 }}>
                Revoke plan (back to Free)
              </Button>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={busy} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleAssign}
          disabled={busy || !selectedPlan || customDaysInvalid}
          startIcon={saving ? <CircularProgress size={16} sx={{ color: 'white' }} /> : null}
          sx={{ borderRadius: 2, background: gradients.brand, textTransform: 'none', fontWeight: 700, px: 3 }}
        >
          {saving ? 'Assigning…' : 'Assign Plan'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
