import React, { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useThemeMode } from '../context/ThemeContext';

// ─── Design tokens ────────────────────────────────────────────────────────────
const tokens = {
  // Brand palette
  primary: '#0D406C',        // Deep Navy Blue
  primaryLight: '#1A5A8C',
  primaryDark: '#082545',
  accent: '#0CBD73',         // Emerald Green
  accentLight: '#5AD5A2',    // Seafoam Green
  accentDark: '#067A4C',
  accentGlow: 'rgba(12,189,115,0.18)',
  mint: '#9DF6D6',           // Mint Green
  aqua: '#A2F8EC',           // Light Aqua / Turquoise
  success: '#0CBD73',
  warning: '#F59E0B',
  danger: '#EF4444',
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  surface: '#FFFFFF',
  surfaceAlt: '#F5FBF8',
  surfaceBorder: '#D7E5DD',
  dark: {
    bg: '#031526',
    surface: '#082A45',
    surfaceAlt: '#0D406C',
    border: '#1A5A8C',
    textPrimary: '#E8F8F1',
    textSecondary: '#9DC4D9',
  },
};

// ─── Nav ──────────────────────────────────────────────────────────────────────
function Nav({ scrolled, mode, toggleMode, isAuthenticated, user, handleLogout, currentRoute }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const isDark = mode === 'dark';

  const scrollTo = (id, route) => {
    setOpen(false);
    if (route) {
      navigate(route);
      return;
    }
    // If not on home page, navigate to home page with hash
    if (currentRoute !== '/') {
      navigate(`/#${id}`);
      return;
    }
    // If on home page, scroll to the section
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const navLinks = [
    { id: 'features', label: 'Features' },
    { id: 'how-it-works', label: 'How it works' },
    { id: 'faq', label: 'FAQ' },
    { id: 'contact', label: 'Contact' },
    { id: 'marketplace', label: 'Exam Bank', route: '/marketplace' },
  ];

  const navBg = isDark
    ? `rgba(6,11,24,${scrolled ? 0.98 : 0.7})`
    : `rgba(255,255,255,${scrolled ? 0.98 : 0.85})`;

  return (
    <>
      <style>{`
        @media (min-width: 768px) {
          .mobile-menu-btn {
            display: none !important;
          }
          .desktop-nav-links {
            display: flex !important;
          }
          .desktop-auth {
            display: inline-flex !important;
          }
        }
        @media (max-width: 767px) {
          .desktop-nav-links {
            display: none !important;
          }
          .desktop-auth {
            display: none !important;
          }
        }
      `}</style>
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        backdropFilter: 'blur(20px)',
        background: navBg,
        borderBottom: `1px solid ${isDark ? 'rgba(30,41,59,0.8)' : 'rgba(226,232,240,0.8)'}`,
        transition: 'background 0.3s ease, box-shadow 0.3s ease',
        boxShadow: scrolled ? (isDark ? '0 4px 24px rgba(0,0,0,0.4)' : '0 4px 24px rgba(15,23,42,0.08)') : 'none',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 16px', height: 'auto', minHeight: 72, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
          {/* Logo */}
          <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0, flexShrink: 0 }}>
            <img src="/logo.png" alt="eexams" style={{ width: 50, height: 50, borderRadius: 12, objectFit: 'cover', backgroundColor: isDark ? 'rgba(255,255,255,0.95)' : 'transparent', padding: isDark ? '4px' : '0', boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.1)' }} />
          </button>

          {/* Desktop links */}
          <div style={{ flex: 1, display: 'none', alignItems: 'center', gap: 2, justifyContent: 'center' }} className="desktop-nav-links">
            {navLinks.map(l => (
              l.route ? (
                <RouterLink key={l.id} to={l.route} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '10px 18px', borderRadius: 12,
                  fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 14,
                  color: (l.route === currentRoute) ? tokens.accent : (isDark ? tokens.dark.textSecondary : tokens.textSecondary),
                  transition: 'all 0.2s',
                  textDecoration: 'none',
                }}
                  onMouseEnter={e => { e.target.style.color = tokens.accent; e.target.style.background = tokens.accentGlow; }}
                  onMouseLeave={e => { e.target.style.color = (l.route === currentRoute) ? tokens.accent : (isDark ? tokens.dark.textSecondary : tokens.textSecondary); e.target.style.background = 'none'; }}
                >{l.label}</RouterLink>
              ) : (
                <button key={l.id} onClick={() => scrollTo(l.id)} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '10px 18px', borderRadius: 12,
                  fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 14,
                  color: isDark ? tokens.dark.textSecondary : tokens.textSecondary,
                  transition: 'all 0.2s',
                }}
                  onMouseEnter={e => { e.target.style.color = tokens.accent; e.target.style.background = tokens.accentGlow; }}
                  onMouseLeave={e => { e.target.style.color = isDark ? tokens.dark.textSecondary : tokens.textSecondary; e.target.style.background = 'none'; }}
                >{l.label}</button>
              )
            ))}
          </div>

          {/* Right side */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
            {/* Theme toggle */}
            <button onClick={toggleMode} style={{
              width: 40, height: 40, borderRadius: 12, border: `1px solid ${isDark ? tokens.dark.border : tokens.surfaceBorder}`,
              background: isDark ? tokens.dark.surfaceAlt : tokens.surfaceAlt,
              cursor: 'pointer', display: 'none', alignItems: 'center', justifyContent: 'center',
              color: isDark ? tokens.dark.textSecondary : tokens.textSecondary,
              transition: 'all 0.2s', flexShrink: 0,
            }} className="desktop-auth">
              {isDark
                ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
                : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
              }
            </button>

            {isAuthenticated ? (
              <>
                <RouterLink to="/dashboard" style={{
                  padding: '10px 20px', borderRadius: 12, fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 14,
                  border: `1.5px solid ${isDark ? tokens.dark.border : tokens.surfaceBorder}`,
                  color: isDark ? tokens.dark.textPrimary : tokens.textPrimary,
                  textDecoration: 'none', transition: 'all 0.2s',
                  background: isDark ? tokens.dark.surfaceAlt : 'transparent',
                  display: 'none',
                }} className="desktop-auth">Dashboard</RouterLink>
                <button onClick={handleLogout} style={{
                  padding: '10px 20px', borderRadius: 12, fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 14,
                  background: 'linear-gradient(135deg, #0D406C 0%, #0CBD73 100%)',
                  color: 'white', border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                  boxShadow: '0 2px 8px rgba(12,189,115,0.25)', display: 'none',
                }} className="desktop-auth">Logout</button>
              </>
            ) : (
              <>
                <RouterLink to="/login" style={{
                  padding: '10px 20px', borderRadius: 12, fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 14,
                  border: `1.5px solid ${isDark ? tokens.dark.border : tokens.surfaceBorder}`,
                  color: isDark ? tokens.dark.textPrimary : tokens.textPrimary,
                  textDecoration: 'none', transition: 'all 0.2s',
                  background: isDark ? tokens.dark.surfaceAlt : 'transparent',
                  display: 'none',
                }} className="desktop-auth">Log in</RouterLink>
                <RouterLink to="/register" style={{
                  padding: '10px 20px', borderRadius: 12, fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 14,
                  background: 'linear-gradient(135deg, #0D406C 0%, #0CBD73 100%)',
                  color: 'white', textDecoration: 'none', transition: 'all 0.2s',
                  boxShadow: '0 2px 8px rgba(12,189,115,0.25)', display: 'none',
                }} className="desktop-auth">Start for free</RouterLink>
              </>
            )}

            {/* Mobile menu button - only on mobile */}
            <button onClick={() => setOpen(!open)} style={{
              width: 40, height: 40, borderRadius: 12,
              border: `1px solid ${isDark ? tokens.dark.border : tokens.surfaceBorder}`,
              background: isDark ? tokens.dark.surfaceAlt : tokens.surfaceAlt,
              cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }} className="mobile-menu-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={isDark ? '#94A3B8' : '#64748B'} strokeWidth="2">
                <path d={open ? "M18 6L6 18M6 6l12 12" : "M3 12h18M3 6h18M3 18h18"} />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {open && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0,
            background: isDark ? tokens.dark.bg : tokens.surface,
            borderBottom: `1px solid ${isDark ? tokens.dark.border : tokens.surfaceBorder}`,
            padding: '16px', display: 'flex', flexDirection: 'column', gap: 2,
            boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.5)' : '0 8px 32px rgba(15,23,42,0.12)',
          }}>
            {navLinks.map(l => (
              l.route ? (
                <RouterLink key={l.id} to={l.route} onClick={() => setOpen(false)} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '14px 16px', borderRadius: 12, textAlign: 'left',
                  fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 16,
                  color: (l.route === currentRoute) ? tokens.accent : (isDark ? tokens.dark.textPrimary : tokens.textPrimary),
                  textDecoration: 'none', display: 'block'
                }}>{l.label}</RouterLink>
              ) : (
                <button key={l.id} onClick={() => scrollTo(l.id)} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '14px 16px', borderRadius: 12, textAlign: 'left',
                  fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 16,
                  color: isDark ? tokens.dark.textPrimary : tokens.textPrimary,
                }}>{l.label}</button>
              )
            ))}
            <div style={{ height: 1, background: isDark ? tokens.dark.border : tokens.surfaceBorder, margin: '12px 0' }} />
            {isAuthenticated ? (
              <>
                <RouterLink to="/dashboard" onClick={() => setOpen(false)} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '14px 16px', borderRadius: 12, textAlign: 'left',
                  fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 16,
                  color: isDark ? tokens.dark.textPrimary : tokens.textPrimary,
                  textDecoration: 'none', display: 'block'
                }}>Dashboard</RouterLink>
                <button onClick={() => { handleLogout(); setOpen(false); }} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '14px 16px', borderRadius: 12, textAlign: 'left',
                  fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 16,
                  color: isDark ? tokens.dark.textPrimary : tokens.textPrimary,
                }}>Logout</button>
              </>
            ) : (
              <>
                <RouterLink to="/login" onClick={() => setOpen(false)} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '14px 16px', borderRadius: 12, textAlign: 'left',
                  fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 16,
                  color: isDark ? tokens.dark.textPrimary : tokens.textPrimary,
                  textDecoration: 'none', display: 'block'
                }}>Log in</RouterLink>
                <RouterLink to="/register" onClick={() => setOpen(false)} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '14px 16px', borderRadius: 12, textAlign: 'left',
                  fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 16,
                  color: isDark ? tokens.dark.textPrimary : tokens.textPrimary,
                  textDecoration: 'none', display: 'block'
                }}>Start for free</RouterLink>
              </>
            )}
          </div>
        )}
      </nav>
    </>
  );
}

export default Nav;
