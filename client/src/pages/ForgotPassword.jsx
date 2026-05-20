import React, { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useThemeMode } from '../context/ThemeContext';
import api from '../services/api';

// ─── Design tokens (matching login page) ──────────────────────────────────────
const tokens = {
  primary: '#0D406C',
  accent: '#0CBD73',
  accentLight: '#5AD5A2',
  accentDark: '#067A4C',
  accentGlow: 'rgba(12,189,115,0.18)',
  mint: '#9DF6D6',
  aqua: '#A2F8EC',
  success: '#0CBD73',
  warning: '#F59E0B',
  danger: '#EF4444',
  textPrimary: '#0F172A',
  textSecondary: '#475569',
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

// ─── Icons ────────────────────────────────────────────────────────────────────
const Icon = {
  Mail: (p) => <svg width={p.s || 18} height={p.s || 18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
  Sun: (p) => <svg width={p.s || 16} height={p.s || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>,
  Moon: (p) => <svg width={p.s || 16} height={p.s || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
  ArrowLeft: (p) => <svg width={p.s || 16} height={p.s || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>,
  Check: (p) => <svg width={p.s || 16} height={p.s || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  Alert: (p) => <svg width={p.s || 16} height={p.s || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  X: (p) => <svg width={p.s || 16} height={p.s || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
};

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ open, message, severity, onClose }) {
  React.useEffect(() => {
    if (!open) return;
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [open, onClose]);

  if (!open) return null;

  const palette = {
    success: { bg: '#0CBD73', icon: <Icon.Check s={18} /> },
    error: { bg: '#EF4444', icon: <Icon.Alert s={18} /> },
    warning: { bg: '#F59E0B', icon: <Icon.Alert s={18} /> },
    info: { bg: '#0CBD73', icon: <Icon.Alert s={18} /> },
  }[severity] || { bg: '#0CBD73', icon: <Icon.Alert s={18} /> };

  return (
    <div style={{
      position: 'fixed', top: 24, right: 24, zIndex: 1000,
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '14px 18px', borderRadius: 12,
      background: 'white', border: `1px solid ${palette.bg}33`,
      boxShadow: '0 12px 32px rgba(15,23,42,0.18)',
      maxWidth: 380, animation: 'slideInRight 0.3s ease',
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: `${palette.bg}18`, color: palette.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {palette.icon}
      </div>
      <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: tokens.textPrimary, lineHeight: 1.5 }}>{message}</span>
      <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: tokens.textSecondary, padding: 4, display: 'flex' }}>
        <Icon.X s={14} />
      </button>
    </div>
  );
}

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const navigate = useNavigate();
  const { mode, toggleMode } = useThemeMode();
  const isDark = mode === 'dark';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSnackbar({ open: false, message: '', severity: 'info' });

    try {
      const response = await api.post('/auth/forgot-password', { email });
      setSubmitted(true);
      setSnackbar({ open: true, message: response.data.message, severity: 'success' });
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to send reset email. Please try again.';
      setSnackbar({ open: true, message, severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      fontFamily: "'DM Sans', sans-serif",
      background: isDark
        ? `radial-gradient(ellipse 80% 60% at 50% -10%, rgba(12,189,115,0.18) 0%, transparent 70%), ${tokens.dark.bg}`
        : `radial-gradient(ellipse 80% 60% at 50% -10%, rgba(12,189,115,0.1) 0%, transparent 70%), #F5FBF8`,
      position: 'relative', overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Grid pattern */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 0,
        backgroundImage: isDark
          ? 'linear-gradient(rgba(30,41,59,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(30,41,59,0.4) 1px, transparent 1px)'
          : 'linear-gradient(rgba(226,232,240,0.7) 1px, transparent 1px), linear-gradient(90deg, rgba(226,232,240,0.7) 1px, transparent 1px)',
        backgroundSize: '60px 60px',
        maskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, black 40%, transparent 100%)',
        WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, black 40%, transparent 100%)',
      }} />
      <div style={{ position: 'absolute', top: '10%', left: '5%', width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, rgba(12,189,115,0.14) 0%, transparent 70%)', animation: 'float1 8s ease-in-out infinite', zIndex: 0 }} />
      <div style={{ position: 'absolute', bottom: '10%', right: '5%', width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(157,246,214,0.16) 0%, transparent 70%)', animation: 'float2 10s ease-in-out infinite', zIndex: 0 }} />

      {/* Header */}
      <header style={{ position: 'relative', zIndex: 2, padding: '8px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <RouterLink to="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
            <img
              src="/logo.png"
              alt="eexams"
              style={{
                width: 60,
                height: 60,
                borderRadius: 12,
                objectFit: 'cover',
                backgroundColor: isDark ? 'rgba(255,255,255,0.95)' : 'transparent',
                padding: isDark ? '4px' : '0',
                boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.3)' : 'none'
              }}
            />
          </RouterLink>
          <RouterLink to="/" style={{
            display: 'flex', alignItems: 'center',
            padding: '8px 14px', borderRadius: 10,
            fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 14,
            color: isDark ? tokens.dark.textSecondary : tokens.textSecondary,
            textDecoration: 'none', transition: 'all 0.2s',
          }}
            onMouseEnter={e => { e.target.style.color = tokens.accent; e.target.style.background = tokens.accentGlow; }}
            onMouseLeave={e => { e.target.style.color = isDark ? tokens.dark.textSecondary : tokens.textSecondary; e.target.style.background = 'none'; }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6 }}>
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            Home
          </RouterLink>
        </div>
        <button onClick={toggleMode} style={{
          width: 38, height: 38, borderRadius: 10,
          border: `1px solid ${isDark ? tokens.dark.border : tokens.surfaceBorder}`,
          background: isDark ? tokens.dark.surfaceAlt : tokens.surfaceAlt,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: isDark ? tokens.dark.textSecondary : tokens.textSecondary,
        }}>{isDark ? <Icon.Sun /> : <Icon.Moon />}</button>
      </header>

      {/* Main card */}
      <main style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '12px 24px 24px', position: 'relative', zIndex: 1 }}>
        <div style={{
          width: '100%', maxWidth: 480,
          background: isDark ? tokens.dark.surface : tokens.surface,
          border: `1px solid ${isDark ? tokens.dark.border : tokens.surfaceBorder}`,
          borderRadius: 24, padding: '40px 36px',
          boxShadow: isDark ? '0 32px 64px rgba(0,0,0,0.5)' : '0 32px 64px rgba(15,23,42,0.12)',
          animation: 'fadeInUp 0.6s ease',
        }}>
          {/* Back to login link */}
          <button
            onClick={() => navigate('/login')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 14,
              fontWeight: 500,
              color: isDark ? tokens.dark.textSecondary : tokens.textSecondary,
              marginBottom: 24,
              padding: '4px 8px',
              borderRadius: 6,
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = tokens.accent; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = isDark ? tokens.dark.textSecondary : tokens.textSecondary; }}
          >
            <Icon.ArrowLeft s={16} />
            Back to login
          </button>

          {/* Badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '5px 12px', borderRadius: 100,
            background: isDark ? 'rgba(12,189,115,0.15)' : 'rgba(12,189,115,0.08)',
            border: `1px solid ${isDark ? 'rgba(12,189,115,0.3)' : 'rgba(12,189,115,0.2)'}`,
            marginBottom: 20,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: tokens.success, animation: 'pulse 2s infinite' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: tokens.accent, letterSpacing: '0.04em' }}>Password Recovery</span>
          </div>

          <h1 style={{
            fontWeight: 800, fontSize: 32, letterSpacing: '-0.02em', lineHeight: 1.15,
            color: isDark ? tokens.dark.textPrimary : tokens.textPrimary, marginBottom: 8,
          }}>
            {submitted ? 'Check your email' : 'Forgot your password?'}
          </h1>
          <p style={{ fontSize: 15, color: isDark ? tokens.dark.textSecondary : tokens.textSecondary, marginBottom: 28, lineHeight: 1.6 }}>
            {submitted
              ? `We've sent a password reset link to ${email}. Please check your inbox and spam folder.`
              : "Enter your email address and we'll send you a link to reset your password."}
          </p>

          {!submitted ? (
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 24 }}>
                <label style={{
                  display: 'block', marginBottom: 8,
                  fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600,
                  color: isDark ? tokens.dark.textSecondary : tokens.textSecondary,
                }}>Email address</label>
                <div style={{
                  position: 'relative',
                  borderRadius: 12,
                  border: `1.5px solid ${isDark ? tokens.dark.border : tokens.surfaceBorder}`,
                  background: isDark ? tokens.dark.surfaceAlt : tokens.surfaceAlt,
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                  display: 'flex', alignItems: 'center',
                }}>
                  <div style={{ paddingLeft: 14, color: isDark ? tokens.dark.textSecondary : tokens.textSecondary, display: 'flex', alignItems: 'center' }}>
                    <Icon.Mail />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                    autoFocus
                    style={{
                      flex: 1, padding: '14px 12px', border: 'none', outline: 'none',
                      background: 'transparent', fontFamily: "'DM Sans', sans-serif",
                      fontSize: 15, fontWeight: 500,
                      color: isDark ? tokens.dark.textPrimary : tokens.textPrimary,
                    }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '16px',
                  borderRadius: 12,
                  border: 'none',
                  background: 'linear-gradient(135deg, #0D406C 0%, #0CBD73 100%)',
                  color: 'white',
                  cursor: loading ? 'wait' : 'pointer',
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 16,
                  fontWeight: 700,
                  boxShadow: '0 8px 24px rgba(12,189,115,0.35)',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                  opacity: loading ? 0.7 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!loading) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 12px 32px rgba(12,189,115,0.45)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(12,189,115,0.35)';
                }}
              >
                {loading ? 'Sending...' : 'Send reset link'}
              </button>
            </form>
          ) : (
            <div>
              <div style={{
                padding: '20px',
                borderRadius: 12,
                background: isDark ? 'rgba(12,189,115,0.15)' : 'rgba(12,189,115,0.08)',
                border: `1px solid ${isDark ? 'rgba(12,189,115,0.3)' : 'rgba(12,189,115,0.2)'}`,
                marginBottom: 24,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}>
                <div style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, #0D406C 0%, #0CBD73 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Icon.Mail s={24} />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: isDark ? tokens.dark.textPrimary : tokens.textPrimary, marginBottom: 4 }}>
                    Email sent!
                  </div>
                  <div style={{ fontSize: 13, color: isDark ? tokens.dark.textSecondary : tokens.textSecondary }}>
                    Check your inbox for the reset link
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  setSubmitted(false);
                  setEmail('');
                }}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: 12,
                  border: `1.5px solid ${isDark ? tokens.dark.border : tokens.surfaceBorder}`,
                  background: isDark ? tokens.dark.surfaceAlt : tokens.surfaceAlt,
                  color: isDark ? tokens.dark.textPrimary : tokens.textPrimary,
                  cursor: 'pointer',
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 15,
                  fontWeight: 600,
                  marginBottom: 12,
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = tokens.accent;
                  e.currentTarget.style.background = tokens.accentGlow;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = isDark ? tokens.dark.border : tokens.surfaceBorder;
                  e.currentTarget.style.background = isDark ? tokens.dark.surfaceAlt : tokens.surfaceAlt;
                }}
              >
                Send to a different email
              </button>

              <button
                onClick={() => navigate('/login')}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: 12,
                  border: 'none',
                  background: 'linear-gradient(135deg, #0D406C 0%, #0CBD73 100%)',
                  color: 'white',
                  cursor: 'pointer',
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 15,
                  fontWeight: 700,
                  boxShadow: '0 8px 24px rgba(12,189,115,0.35)',
                  transition: 'transform 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 12px 32px rgba(12,189,115,0.45)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(12,189,115,0.35)';
                }}
              >
                Back to login
              </button>
            </div>
          )}

          {/* Footer note */}
          <div style={{ marginTop: 24, paddingTop: 20, borderTop: `1px solid ${isDark ? tokens.dark.border : tokens.surfaceBorder}` }}>
            <p style={{ fontSize: 13, color: isDark ? tokens.dark.textSecondary : tokens.textSecondary, textAlign: 'center', lineHeight: 1.5 }}>
              Remember your password?{' '}
              <RouterLink to="/login" style={{ color: tokens.accent, fontWeight: 600, textDecoration: 'none' }}>
                Log in
              </RouterLink>
            </p>
          </div>
        </div>
      </main>

      {/* Toast */}
      <Toast
        open={snackbar.open}
        message={snackbar.message}
        severity={snackbar.severity}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      />

      {/* Animations */}
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes float1 {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(5deg); }
        }
        @keyframes float2 {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(20px) rotate(-5deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};

export default ForgotPassword;
