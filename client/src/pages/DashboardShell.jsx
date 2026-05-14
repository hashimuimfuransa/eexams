/**
 * DashboardShell — shared layout used by all 4 role dashboards.
 * Provides: Sidebar, Topbar, StatCard, and the page wrapper.
 */
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box, Typography, Avatar, IconButton, Divider, Chip, Button, Paper,
  TextField, CircularProgress, Drawer, List, ListItemButton,
  ListItemIcon, ListItemText, InputAdornment, useMediaQuery, Menu, MenuItem,
  Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material';
import {
  NotificationsNone, Menu as MenuIcon, Close, Search, Logout, Star,
  TrendingUp, TrendingDown, CheckCircle
} from '@mui/icons-material';
import { tokens, gradients } from './dashboardTokens';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export const W = 260;

// ─── Get dynamic greeting based on time ──────────────────────────────────────
export function getDynamicGreeting(name) {
  const hour = new Date().getHours();
  let greeting = 'Good morning';
  if (hour >= 12 && hour < 17) greeting = 'Good afternoon';
  else if (hour >= 17 || hour < 5) greeting = 'Good evening';
  return `${greeting}, ${name || 'User'} 👋`;
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
const INDIVIDUAL_PLANS = [
  { id: 'basic',      label: 'Basic',      price: '9,000 RWF/mo',  color: '#0CBD73', features: ['30 exams/mo', '200 students', 'AI features', 'Analytics'] },
  { id: 'premium',    label: 'Premium',    price: '29,000 RWF/mo', color: '#0D406C', features: ['Unlimited exams', 'Unlimited students', 'Full AI', '24/7 support'] },
  { id: 'enterprise', label: 'Enterprise', price: 'Custom pricing', color: '#8B5CF6', features: ['Everything in Premium', 'White-label', 'API access', 'Dedicated manager'] },
];

const ORG_PLANS = [
  { id: 'basic',      label: 'Basic',      price: '15,000 RWF/mo', color: '#0CBD73', features: ['30 exams/mo', '200 students', 'AI features', 'Analytics'] },
  { id: 'premium',    label: 'Premium',    price: '49,000 RWF/mo', color: '#0D406C', features: ['Unlimited exams', 'Unlimited students', 'Full AI', '24/7 support'] },
  { id: 'enterprise', label: 'Enterprise', price: 'Custom pricing', color: '#8B5CF6', features: ['Everything in Premium', 'White-label', 'API access', 'Dedicated manager'] },
];

export function Sidebar({ user, logout, activeSection, setActiveSection, onClose, isMobile, nav, portalLabel }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser } = useAuth();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('');
  const [upgrading, setUpgrading] = useState(false);
  const [upgraded, setUpgraded] = useState(false);

  const currentPlan = user?.subscriptionPlan || 'free';
  const isOrg = user?.userType === 'organization' || user?.role === 'admin';
  const PLANS = isOrg ? ORG_PLANS : INDIVIDUAL_PLANS;

  const handleUpgradeClick = () => {
    setSelectedPlan('');
    setUpgraded(false);
    setUpgradeOpen(true);
    if (isMobile && onClose) onClose();
  };

  const handleConfirmUpgrade = async () => {
    if (!selectedPlan) return;
    setUpgrading(true);
    try {
      const res = await api.put('/auth/profile', { subscriptionPlan: selectedPlan });
      const updatedUser = {
        ...user,
        subscriptionPlan: res.data.subscriptionPlan || selectedPlan,
        subscriptionStatus: res.data.subscriptionStatus || 'pending',
      };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      if (setUser) setUser(updatedUser);
      setUpgraded(true);
    } catch (err) {
      console.error('Upgrade failed:', err);
    } finally {
      setUpgrading(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: tokens.primary, overflowY: 'auto' }}>
      {/* Brand - Logo only with white background for visibility */}
      <Box sx={{ px: 2.5, py: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <Box sx={{
          bgcolor: 'white',
          borderRadius: 3,
          p: 1,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Avatar
            src="/logo.png"
            alt="eexams"
            sx={{
              width: 50,
              height: 50,
              bgcolor: 'transparent',
              borderRadius: 2,
            }}
          />
        </Box>
        {isMobile && <IconButton size="small" sx={{ color: 'rgba(255,255,255,0.5)', ml: 1 }} onClick={onClose}><Close fontSize="small" /></IconButton>}
      </Box>

      {/* User */}
      <Box sx={{ mx: 1.5, mt: 2, p: 1.5, borderRadius: 2.5, bgcolor: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Avatar sx={{ width: 38, height: 38, background: gradients.accent, fontWeight: 700, fontSize: 15 }}>{user?.firstName?.charAt(0)}</Avatar>
        <Box sx={{ overflow: 'hidden', flex: 1 }}>
          <Typography sx={{ color: 'white', fontWeight: 600, fontSize: 13, fontFamily: "'DM Sans',sans-serif" }} noWrap>{user?.firstName} {user?.lastName}</Typography>
          <Chip label={portalLabel} size="small" sx={{ height: 16, fontSize: 9.5, mt: 0.25, bgcolor: 'rgba(12,189,115,0.18)', color: '#5AD5A2', fontWeight: 600 }} />
        </Box>
      </Box>

      {/* Nav */}
      <List sx={{ px: 1, mt: 1.5, flexGrow: 1 }}>
        {nav.map(item => (
          <ListItemButton key={item.id} selected={activeSection === item.id}
            onClick={() => { setActiveSection(item.id); if (isMobile) onClose(); }}
            sx={{
              borderRadius: 2, mb: 0.5, color: 'rgba(255,255,255,0.6)', py: 1.1,
              '&.Mui-selected': { bgcolor: tokens.accent, color: 'white', '& .MuiListItemIcon-root': { color: 'white' } },
              '&:hover:not(.Mui-selected)': { bgcolor: 'rgba(255,255,255,0.06)', color: 'white' },
            }}>
            <ListItemIcon sx={{ minWidth: 36, color: 'inherit' }}>{item.icon}</ListItemIcon>
            <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: 13.5, fontWeight: activeSection === item.id ? 700 : 500, fontFamily: "'DM Sans',sans-serif" }} />
          </ListItemButton>
        ))}
      </List>

      {/* Read-only plan info for org teachers */}
      {user?.isOrgTeacher && (
        <Box sx={{ mx: 1.5, mb: 1.5, p: 2, borderRadius: 2.5, bgcolor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
            <Star sx={{ color: '#F59E0B', fontSize: 15 }} />
            <Typography sx={{ color: 'white', fontWeight: 700, fontSize: 12, fontFamily: "'DM Sans',sans-serif" }}>Organisation Plan</Typography>
          </Box>
          <Chip label={currentPlan} size="small" sx={{ height: 16, fontSize: 9.5, bgcolor: 'rgba(12,189,115,0.18)', color: '#5AD5A2', fontWeight: 600, textTransform: 'capitalize', mb: 0.75 }} />
          <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 10.5, fontFamily: "'DM Sans',sans-serif", lineHeight: 1.4 }}>
            Your plan is managed by your organisation admin.
          </Typography>
        </Box>
      )}

      {/* Upgrade — hide for superadmin and org teachers */}
      {user?.role !== 'superadmin' && !user?.isOrgTeacher && (
        <Box sx={{ mx: 1.5, mb: 1.5, p: 2, borderRadius: 2.5, bgcolor: 'rgba(12,189,115,0.12)', border: '1px solid rgba(12,189,115,0.2)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
            <Star sx={{ color: '#F59E0B', fontSize: 15 }} />
            <Typography sx={{ color: 'white', fontWeight: 700, fontSize: 12, fontFamily: "'DM Sans',sans-serif" }}>
              {currentPlan === 'free' ? 'Upgrade to Pro' : 'Change Plan'}
            </Typography>
          </Box>
          <Chip label={`Current: ${currentPlan}`} size="small" sx={{ mb: 1, height: 16, fontSize: 9.5, bgcolor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)', fontWeight: 600, textTransform: 'capitalize' }} />
          <Button size="small" fullWidth onClick={handleUpgradeClick}
            sx={{ bgcolor: tokens.accent, color: 'white', borderRadius: 2, fontSize: 11, fontWeight: 700, fontFamily: "'DM Sans',sans-serif", py: 0.75, textTransform: 'none', '&:hover': { bgcolor: tokens.accentDark } }}>
            {currentPlan === 'free' ? 'Upgrade Now →' : 'Change Plan →'}
          </Button>
        </Box>
      )}

      {/* Upgrade Plan Dialog */}
      <Dialog open={upgradeOpen} onClose={() => { if (!upgrading) setUpgradeOpen(false); }} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700, fontFamily: "'DM Sans',sans-serif", pb: 1 }}>
          {upgraded ? '✅ Plan Change Requested' : '🚀 Change Subscription Plan'}
          <Typography variant="caption" sx={{ color: '#6b7280', display: 'block', mt: 0.5 }}>
            {upgraded ? 'Your request is pending admin approval.' : `Current plan: ${currentPlan} · Select a new plan below`}
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: '12px !important' }}>
          {upgraded ? (
            <Box sx={{ p: 2.5, bgcolor: '#F0FDF4', borderRadius: 2, border: '1px solid #86EFAC', textAlign: 'center' }}>
              <CheckCircle sx={{ color: '#16A34A', fontSize: 40, mb: 1 }} />
              <Typography fontWeight={700} sx={{ color: '#166534', mb: 0.5 }}>Plan change submitted!</Typography>
              <Typography variant="body2" sx={{ color: '#166534' }}>
                Your account is now pending admin approval for the <b>{selectedPlan}</b> plan.
                You'll be redirected to the pending approval page. Contact{' '}
                <a href="tel:+250781671517" style={{ color: '#0D406C' }}>+250 781 671 517</a> to confirm payment.
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {PLANS.filter(p => p.id !== currentPlan).map(plan => (
                <Box key={plan.id} onClick={() => setSelectedPlan(plan.id)}
                  sx={{
                    p: 2, borderRadius: 2, cursor: 'pointer', transition: 'all 0.2s',
                    border: `2px solid ${selectedPlan === plan.id ? plan.color : '#e5e7eb'}`,
                    bgcolor: selectedPlan === plan.id ? `${plan.color}08` : '#fafafa',
                  }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box sx={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${selectedPlan === plan.id ? plan.color : '#d1d5db'}`, bgcolor: selectedPlan === plan.id ? plan.color : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {selectedPlan === plan.id && <CheckCircle sx={{ fontSize: 12, color: 'white' }} />}
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography fontWeight={700} sx={{ fontSize: 15 }}>{plan.label}</Typography>
                        <Typography fontWeight={700} sx={{ color: plan.color, fontSize: 13 }}>{plan.price}</Typography>
                      </Box>
                      <Typography variant="caption" sx={{ color: '#6b7280' }}>{plan.features.join(' · ')}</Typography>
                    </Box>
                  </Box>
                </Box>
              ))}
              <Box sx={{ p: 1.5, bgcolor: '#FFF7ED', borderRadius: 2, border: '1px solid #FED7AA' }}>
                <Typography variant="caption" sx={{ color: '#92400E' }}>
                  ⚠️ After selecting a plan, your account will be set to <b>pending</b> until admin approves your payment. Make payment via MoMo code <b>81671517</b> and contact <b>+250 781 671 517</b>.
                </Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          {upgraded ? (
            <Button variant="contained" fullWidth onClick={() => { setUpgradeOpen(false); navigate('/pending-approval'); }}
              sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, bgcolor: tokens.accent, '&:hover': { bgcolor: '#0AAE5E' } }}>
              Go to Pending Approval Page
            </Button>
          ) : (
            <>
              <Button onClick={() => setUpgradeOpen(false)} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}>Cancel</Button>
              <Button variant="contained" disabled={!selectedPlan || upgrading} onClick={handleConfirmUpgrade}
                sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, px: 3, bgcolor: tokens.accent, '&:hover': { bgcolor: '#0AAE5E' } }}>
                {upgrading ? <CircularProgress size={18} sx={{ color: 'white' }} /> : `Request ${selectedPlan || 'Plan'} Upgrade`}
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />
      <Box sx={{ px: 1.5, py: 1.5 }}>
        <ListItemButton onClick={logout} sx={{ borderRadius: 2, color: 'rgba(255,255,255,0.45)', '&:hover': { color: '#EF4444', bgcolor: 'rgba(239,68,68,0.08)' } }}>
          <ListItemIcon sx={{ minWidth: 36, color: 'inherit' }}><Logout fontSize="small" /></ListItemIcon>
          <ListItemText primary="Sign Out" primaryTypographyProps={{ fontSize: 13, fontFamily: "'DM Sans',sans-serif" }} />
        </ListItemButton>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, mt: 0.5 }}>
          <Box sx={{ width: 18, height: 18, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography sx={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>?</Typography>
          </Box>
          <Box>
            <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontFamily: "'DM Sans',sans-serif" }}>Need Help?</Typography>
            <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', fontFamily: "'DM Sans',sans-serif" }}>Contact Support</Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

// ─── Topbar ───────────────────────────────────────────────────────────────────
export function Topbar({ greeting, sub, user, onMenuClick, onLogout, roleLabel }) {
  const [anchorEl, setAnchorEl] = useState(null);
  return (
    <Box sx={{
      height: 64, px: { xs: 1.5, sm: 3 }, display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 2 },
      bgcolor: 'white', borderBottom: `1px solid ${tokens.surfaceBorder}`,
      boxShadow: '0 1px 8px rgba(13,64,108,0.05)', position: 'sticky', top: 0, zIndex: 100, flexShrink: 0
    }}>
      <IconButton size="small" onClick={onMenuClick} sx={{ bgcolor: 'rgba(13,64,108,0.06)', '&:hover': { bgcolor: 'rgba(13,64,108,0.11)' } }}>
        <MenuIcon fontSize="small" sx={{ color: tokens.primary }} />
      </IconButton>
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography fontWeight={700} noWrap sx={{ color: tokens.textPrimary, lineHeight: 1.25, fontSize: { xs: '0.9rem', sm: '1.05rem' }, fontFamily: "'DM Sans',sans-serif" }}>{greeting}</Typography>
        {sub && <Typography variant="caption" noWrap sx={{ color: tokens.textMuted, fontFamily: "'DM Sans',sans-serif", display: { xs: 'none', sm: 'block' } }}>{sub}</Typography>}
      </Box>
      <TextField size="small" placeholder="Search anything…"
        InputProps={{
          startAdornment: <InputAdornment position="start"><Search fontSize="small" sx={{ color: tokens.textMuted }} /></InputAdornment>,
          sx: { borderRadius: 3, bgcolor: '#F8FAFC', fontSize: 13, fontFamily: "'DM Sans',sans-serif", '& fieldset': { border: `1px solid ${tokens.surfaceBorder}` } }
        }}
        sx={{ width: 220, display: { xs: 'none', md: 'block' } }}
      />
      <IconButton size="small" sx={{ bgcolor: 'rgba(13,64,108,0.06)', position: 'relative' }}>
        <NotificationsNone fontSize="small" sx={{ color: tokens.primary }} />
        <Box sx={{ width: 8, height: 8, bgcolor: '#EF4444', borderRadius: '50%', position: 'absolute', top: 6, right: 6, border: '1.5px solid white' }} />
      </IconButton>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer' }} onClick={e => setAnchorEl(e.currentTarget)}>
        <Avatar sx={{ width: 34, height: 34, background: gradients.brand, fontSize: 13, fontWeight: 700 }}>{user?.firstName?.charAt(0)}</Avatar>
        <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
          <Typography variant="body2" fontWeight={700} sx={{ fontFamily: "'DM Sans',sans-serif", color: tokens.textPrimary, lineHeight: 1.2 }}>{user?.firstName} {user?.lastName}</Typography>
          <Typography variant="caption" sx={{ color: tokens.textMuted, fontFamily: "'DM Sans',sans-serif" }}>{roleLabel}</Typography>
        </Box>
      </Box>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)} PaperProps={{ sx: { borderRadius: 2, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' } }}>
        <MenuItem onClick={onLogout} sx={{ color: '#EF4444', fontSize: 14, fontFamily: "'DM Sans',sans-serif" }}>Sign Out</MenuItem>
      </Menu>
    </Box>
  );
}

// ─── Stat Card (matches image: colored icon box, value, label, trend) ─────────
export function StatCard({ label, value, sub, subColor, icon, iconBg, loading }) {
  return (
    <Paper elevation={0} sx={{
      p: 2.5, borderRadius: 3, bgcolor: 'white',
      border: `1px solid ${tokens.surfaceBorder}`,
      display: 'flex', alignItems: 'flex-start', gap: 2,
      transition: 'box-shadow 0.2s, transform 0.15s',
      '&:hover': { boxShadow: '0 6px 24px rgba(13,64,108,0.1)', transform: 'translateY(-1px)' }
    }}>
      <Box sx={{ width: { xs: 42, sm: 52 }, height: { xs: 42, sm: 52 }, borderRadius: 2.5, bgcolor: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {icon}
      </Box>
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        {loading
          ? <CircularProgress size={22} sx={{ color: tokens.accent }} />
          : <Typography variant="h4" fontWeight={800} sx={{ color: tokens.textPrimary, lineHeight: 1, fontFamily: "'DM Sans',sans-serif", mb: 0.25 }}>{value ?? '—'}</Typography>
        }
        <Typography sx={{ color: tokens.textMuted, fontSize: 12.5, fontFamily: "'DM Sans',sans-serif" }}>{label}</Typography>
        {sub && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, mt: 0.5 }}>
            <TrendingUp sx={{ fontSize: 13, color: subColor || tokens.accent }} />
            <Typography sx={{ fontSize: 11.5, color: subColor || tokens.accent, fontWeight: 600, fontFamily: "'DM Sans',sans-serif" }}>{sub}</Typography>
          </Box>
        )}
      </Box>
    </Paper>
  );
}

// ─── Section title row ────────────────────────────────────────────────────────
export function SectionTitle({ children, action }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
      <Typography fontWeight={700} sx={{ color: tokens.textPrimary, fontSize: 15, fontFamily: "'DM Sans',sans-serif" }}>{children}</Typography>
      {action}
    </Box>
  );
}

// ─── Card wrapper ─────────────────────────────────────────────────────────────
export function DashCard({ children, sx = {} }) {
  return (
    <Paper elevation={0} sx={{ borderRadius: 3, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white', overflow: 'hidden', ...sx }}>
      {children}
    </Paper>
  );
}

// ─── Shell wrapper ────────────────────────────────────────────────────────────
export function DashboardShell({ sidebarEl, topbarEl, children, sidebarOpen, isMobile, onCloseSidebar }) {
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#F7FAFB', fontFamily: "'DM Sans',sans-serif" }}>
      {isMobile
        ? <Drawer open={sidebarOpen} onClose={onCloseSidebar} PaperProps={{ sx: { width: W, border: 'none' } }}>{sidebarEl}</Drawer>
        : (
          <Box sx={{ width: sidebarOpen ? W : 0, flexShrink: 0, overflow: 'hidden', transition: 'width 0.28s ease', height: '100vh', position: 'sticky', top: 0 }}>
            <Box sx={{ width: W, height: '100%' }}>{sidebarEl}</Box>
          </Box>
        )
      }
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: '100vh' }}>
        {topbarEl}
        <Box sx={{ flexGrow: 1, overflow: 'auto', p: { xs: 1.5, sm: 2, md: 3 } }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
}
