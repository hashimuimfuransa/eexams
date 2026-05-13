/**
 * DashboardShell — shared layout used by all 4 role dashboards.
 * Provides: Sidebar, Topbar, StatCard, and the page wrapper.
 */
import { useState } from 'react';
import {
  Box, Typography, Avatar, IconButton, Divider, Chip, Button, Paper,
  TextField, CircularProgress, Drawer, List, ListItemButton,
  ListItemIcon, ListItemText, InputAdornment, useMediaQuery, Menu, MenuItem
} from '@mui/material';
import {
  NotificationsNone, Menu as MenuIcon, Close, Search, Logout, Star,
  TrendingUp, TrendingDown
} from '@mui/icons-material';
import { tokens, gradients } from './dashboardTokens';

export const W = 260;

// ─── Logo ─────────────────────────────────────────────────────────────────────
export function LogoMark({ size = 36, icon }) {
  return (
    <Box sx={{
      width: size, height: size, borderRadius: '10px',
      background: gradients.accent, display: 'flex',
      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      {icon}
    </Box>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
export function Sidebar({ user, logout, activeSection, setActiveSection, onClose, isMobile, nav, portalLabel, logoIcon }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: tokens.primary, overflowY: 'auto' }}>
      {/* Brand */}
      <Box sx={{ px: 2.5, py: 2.25, display: 'flex', alignItems: 'center', gap: 1.5, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <LogoMark size={36} icon={logoIcon} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ color: 'white', fontWeight: 800, fontSize: 17, lineHeight: 1, letterSpacing: '-0.3px', fontFamily: "'DM Sans',sans-serif" }}>eexams</Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 10.5, fontFamily: "'DM Sans',sans-serif" }}>{portalLabel}</Typography>
        </Box>
        {isMobile && <IconButton size="small" sx={{ color: 'rgba(255,255,255,0.5)' }} onClick={onClose}><Close fontSize="small" /></IconButton>}
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

      {/* Upgrade */}
      <Box sx={{ mx: 1.5, mb: 1.5, p: 2, borderRadius: 2.5, bgcolor: 'rgba(12,189,115,0.12)', border: '1px solid rgba(12,189,115,0.2)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75 }}>
          <Star sx={{ color: '#F59E0B', fontSize: 15 }} />
          <Typography sx={{ color: 'white', fontWeight: 700, fontSize: 12, fontFamily: "'DM Sans',sans-serif" }}>Upgrade to Pro</Typography>
        </Box>
        <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontFamily: "'DM Sans',sans-serif", lineHeight: 1.4, mb: 1.25 }}>Unlock advanced features and grow your impact.</Typography>
        <Button size="small" fullWidth sx={{ bgcolor: tokens.accent, color: 'white', borderRadius: 2, fontSize: 11, fontWeight: 700, fontFamily: "'DM Sans',sans-serif", py: 0.75, textTransform: 'none', '&:hover': { bgcolor: tokens.accentDark } }}>
          Upgrade Now →
        </Button>
      </Box>

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
