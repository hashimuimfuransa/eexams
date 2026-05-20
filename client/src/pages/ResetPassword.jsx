import React, { useState, useEffect } from 'react';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
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
  Lock: (p) => <svg width={p.s || 18} height={p.s || 18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  Eye: (p) => <svg width={p.s || 18} height={p.s || 18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  EyeOff: (p) => <svg width={p.s || 18} height={p.s || 18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/></svg>,
  Sun: (p) => <svg width={p.s || 16} height={p.s || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>,
  Moon: (p) => <svg width={p.s || 16} height={p.s || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
  Check: (p) => <svg width={p.s || 16} height={p.s || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  Alert: (p) => <svg width={p.s || 16} height={p.s || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  X: (p) => <svg width={p.s || 16} height={p.s || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Arrow: (p) => <svg width={p.s || 16} height={p.s || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>,
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

const ResetPassword = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [tokenValid, setTokenValid] = useState(false);
  const [email, setEmail] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [validationErrors, setValidationErrors] = useState({});

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { mode, toggleMode } = useThemeMode();
  const isDark = mode === 'dark';

  // Verify token on mount
  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setError('Invalid or missing reset token. Please request a new password reset.');
        setVerifying(false);
        return;
      }

      try {
        const response = await api.get(`/auth/verify-reset-token?token=${token}`);
        if (response.data.valid) {
          setTokenValid(true);
          setEmail(response.data.email);
        }
      } catch (err) {
        setError(err.response?.data?.message || 'Invalid or expired reset token. Please request a new password reset.');
      } finally {
        setVerifying(false);
      }
    };

    verifyToken();
  }, [token]);

  const validatePassword = () => {
    const errors = {};

    if (!password) {
      errors.password = 'Password is required';
    } else if (password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      errors.password = 'Must contain uppercase, lowercase, and a number';
    }

    if (!confirmPassword) {
      errors.confirmPassword = 'Please confirm your password';
    } else if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setValidationErrors({});
    setSnackbar({ open: false, message: '', severity: 'info' });

    const errors = validatePassword();
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      setLoading(false);
      return;
    }

    try {
      const response = await api.post('/auth/reset-password', { token, password });
      setSuccess(true);
      setSnackbar({ open: true, message: response.data.message, severity: 'success' });
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to reset password. Please try again.';
      setSnackbar({ open: true, message, severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  if (verifying) {
    return (
      <div style={{
        minHeight: '100vh',
        fontFamily: "'DM Sans', sans-serif",
        background: isDark ? tokens.dark.bg : '#F5FBF8',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 48,
            height: 48,
            border: `3px solid ${tokens.surfaceBorder}`,
            borderTopColor: tokens.accent,
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px',
          }} />
          <p style={{ color: isDark ? tokens.dark.textSecondary : tokens.textSecondary }}>Verifying reset link...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        minHeight: '100vh',
        fontFamily: "'DM Sans', sans-serif",
        background: isDark ? tokens.dark.bg : '#F5FBF8',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}>
        <div style={{
          maxWidth: 400,
          width: '100%',
          background: isDark ? tokens.dark.surface : tokens.surface,
          border: `1px solid ${isDark ? tokens.dark.border : tokens.surfaceBorder}`,
          borderRadius: 20,
          padding: '40px 32px',
          textAlign: 'center',
          boxShadow: isDark ? '0 32px 64px rgba(0,0,0,0.5)' : '0 32px 64px rgba(15,23,42,0.12)',
        }}>
          <div style={{
            width: 64,
            height: 64,
            borderRadius: 16,
            background: 'rgba(239,68,68,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px',
          }}>
            <Icon.Alert s={32} style={{ color: tokens.danger }} />
          </div>
          <h1 style={{
            fontSize: 24,
            fontWeight: 700,
            color: isDark ? tokens.dark.textPrimary : tokens.textPrimary,
            marginBottom: 12,
          }}>
            Invalid Link
          </h1>
          <p style={{
            fontSize: 15,
            color: isDark ? tokens.dark.textSecondary : tokens.textSecondary,
            marginBottom: 24,
            lineHeight: 1.6,
          }}>
            {error}
          </p>
          <button
            onClick={() => navigate('/forgot-password')}
            style={{
              padding: '14px 28px',
              borderRadius: 12,
              border: 'none',
              background: 'linear-gradient(135deg, #0D406C 0%, #0CBD73 100%)',
              color: 'white',
              cursor: 'pointer',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 15,
              fontWeight: 700,
              boxShadow: '0 8px 24px rgba(12,189,115,0.35)',
            }}
          >
            Request new reset link
          </button>
        </div>
      </div>
    );
  }

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
          {/* Badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '5px 12px', borderRadius: 100,
            background: isDark ? 'rgba(12,189,115,0.15)' : 'rgba(12,189,115,0.08)',
            border: `1px solid ${isDark ? 'rgba(12,189,115,0.3)' : 'rgba(12,189,115,0.2)'}`,
            marginBottom: 20,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: tokens.success, animation: 'pulse 2s infinite' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: tokens.accent, letterSpacing: '0.04em' }}>Reset Password</span>
          </div>

          {!success ? (
            <>
              <h1 style={{
                fontWeight: 800, fontSize: 32, letterSpacing: '-0.02em', lineHeight: 1.15,
                color: isDark ? tokens.dark.textPrimary : tokens.textPrimary, marginBottom: 8,
              }}>
                Create new password
              </h1>
              <p style={{ fontSize: 15, color: isDark ? tokens.dark.textSecondary : tokens.textSecondary, marginBottom: 28, lineHeight: 1.6 }}>
                Enter a new password for <strong style={{ color: isDark ? tokens.dark.textPrimary : tokens.textPrimary }}>{email}</strong>
              </p>

              <form onSubmit={handleSubmit}>
                {/* Password Input */}
                <div style={{ marginBottom: 18 }}>
                  <label style={{
                    display: 'block', marginBottom: 8,
                    fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600,
                    color: isDark ? tokens.dark.textSecondary : tokens.textSecondary,
                  }}>New password</label>
                  <div style={{
                    position: 'relative',
                    borderRadius: 12,
                    border: `1.5px solid ${validationErrors.password ? tokens.danger : isDark ? tokens.dark.border : tokens.surfaceBorder}`,
                    background: isDark ? tokens.dark.surfaceAlt : tokens.surfaceAlt,
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                    boxShadow: validationErrors.password ? `0 0 0 4px rgba(239,68,68,0.12)` : 'none',
                    display: 'flex', alignItems: 'center',
                  }}>
                    <div style={{ paddingLeft: 14, color: validationErrors.password ? tokens.danger : isDark ? tokens.dark.textSecondary : tokens.textSecondary, display: 'flex', alignItems: 'center' }}>
                      <Icon.Lock />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter new password"
                      required
                      autoFocus
                      style={{
                        flex: 1, padding: '14px 12px', border: 'none', outline: 'none',
                        background: 'transparent', fontFamily: "'DM Sans', sans-serif",
                        fontSize: 15, fontWeight: 500,
                        color: isDark ? tokens.dark.textPrimary : tokens.textPrimary,
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{ paddingRight: 14, background: 'none', border: 'none', cursor: 'pointer', color: isDark ? tokens.dark.textSecondary : tokens.textSecondary, display: 'flex', alignItems: 'center' }}
                    >
                      {showPassword ? <Icon.EyeOff /> : <Icon.Eye />}
                    </button>
                  </div>
                  {validationErrors.password && (
                    <div style={{ marginTop: 6, fontSize: 12, color: tokens.danger, fontWeight: 500 }}>
                      {validationErrors.password}
                    </div>
                  )}
                  {!validationErrors.password && (
                    <div style={{ marginTop: 6, fontSize: 12, color: isDark ? tokens.dark.textSecondary : tokens.textSecondary, fontWeight: 500 }}>
                      Must contain uppercase, lowercase, and number
                    </div>
                  )}
                </div>

                {/* Confirm Password Input */}
                <div style={{ marginBottom: 24 }}>
                  <label style={{
                    display: 'block', marginBottom: 8,
                    fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600,
                    color: isDark ? tokens.dark.textSecondary : tokens.textSecondary,
                  }}>Confirm password</label>
                  <div style={{
                    position: 'relative',
                    borderRadius: 12,
                    border: `1.5px solid ${validationErrors.confirmPassword ? tokens.danger : isDark ? tokens.dark.border : tokens.surfaceBorder}`,
                    background: isDark ? tokens.dark.surfaceAlt : tokens.surfaceAlt,
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                    boxShadow: validationErrors.confirmPassword ? `0 0 0 4px rgba(239,68,68,0.12)` : 'none',
                    display: 'flex', alignItems: 'center',
                  }}>
                    <div style={{ paddingLeft: 14, color: validationErrors.confirmPassword ? tokens.danger : isDark ? tokens.dark.textSecondary : tokens.textSecondary, display: 'flex', alignItems: 'center' }}>
                      <Icon.Lock />
                    </div>
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      required
                      style={{
                        flex: 1, padding: '14px 12px', border: 'none', outline: 'none',
                        background: 'transparent', fontFamily: "'DM Sans', sans-serif",
                        fontSize: 15, fontWeight: 500,
                        color: isDark ? tokens.dark.textPrimary : tokens.textPrimary,
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      style={{ paddingRight: 14, background: 'none', border: 'none', cursor: 'pointer', color: isDark ? tokens.dark.textSecondary : tokens.textSecondary, display: 'flex', alignItems: 'center' }}
                    >
                      {showConfirmPassword ? <Icon.EyeOff /> : <Icon.Eye />}
                    </button>
                  </div>
                  {validationErrors.confirmPassword && (
                    <div style={{ marginTop: 6, fontSize: 12, color: tokens.danger, fontWeight: 500 }}>
                      {validationErrors.confirmPassword}
                    </div>
                  )}
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
                  {loading ? 'Resetting...' : 'Reset password'}
                </button>
              </form>
            </>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: 80,
                height: 80,
                borderRadius: 20,
                background: 'linear-gradient(135deg, #0D406C 0%, #0CBD73 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 24px',
                animation: 'scaleIn 0.5s ease',
              }}>
                <Icon.Check s={40} style={{ color: 'white' }} />
              </div>
              <h1 style={{
                fontWeight: 800, fontSize: 28, letterSpacing: '-0.02em',
                color: isDark ? tokens.dark.textPrimary : tokens.textPrimary, marginBottom: 12,
              }}>
                Password reset successful!
              </h1>
              <p style={{ fontSize: 15, color: isDark ? tokens.dark.textSecondary : tokens.textSecondary, marginBottom: 28, lineHeight: 1.6 }}>
                Your password has been updated. You can now log in with your new password.
              </p>
              <button
                onClick={() => navigate('/login')}
                style={{
                  padding: '16px 32px',
                  borderRadius: 12,
                  border: 'none',
                  background: 'linear-gradient(135deg, #0D406C 0%, #0CBD73 100%)',
                  color: 'white',
                  cursor: 'pointer',
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 16,
                  fontWeight: 700,
                  boxShadow: '0 8px 24px rgba(12,189,115,0.35)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
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
                Go to login <Icon.Arrow />
              </button>
            </div>
          )}
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
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.8); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
};

export default ResetPassword;
