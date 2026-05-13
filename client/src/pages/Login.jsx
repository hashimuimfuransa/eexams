import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useThemeMode } from '../context/ThemeContext';
import api from '../services/api';

// ─── Design tokens (matching home page) ──────────────────────────────────────
const tokens = {
  primary: '#0D406C',        // Deep Navy Blue
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
  Lock: (p) => <svg width={p.s || 18} height={p.s || 18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  Eye: (p) => <svg width={p.s || 18} height={p.s || 18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  EyeOff: (p) => <svg width={p.s || 18} height={p.s || 18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/></svg>,
  Arrow: (p) => <svg width={p.s || 16} height={p.s || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>,
  Check: (p) => <svg width={p.s || 16} height={p.s || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  Alert: (p) => <svg width={p.s || 16} height={p.s || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  X: (p) => <svg width={p.s || 16} height={p.s || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Sun: (p) => <svg width={p.s || 16} height={p.s || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>,
  Moon: (p) => <svg width={p.s || 16} height={p.s || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
};

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ open, message, severity, onClose }) {
  useEffect(() => {
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

// ─── Input ────────────────────────────────────────────────────────────────────
function Input({ icon, label, type, value, onChange, autoFocus, autoComplete, name, id, endAdornment, isDark }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{
        display: 'block', marginBottom: 8,
        fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600,
        color: isDark ? tokens.dark.textSecondary : tokens.textSecondary,
      }}>{label}</label>
      <div style={{
        position: 'relative',
        borderRadius: 12,
        border: `1.5px solid ${focused ? tokens.accent : isDark ? tokens.dark.border : tokens.surfaceBorder}`,
        background: isDark ? tokens.dark.surfaceAlt : tokens.surfaceAlt,
        transition: 'border-color 0.2s, box-shadow 0.2s',
        boxShadow: focused ? `0 0 0 4px ${tokens.accentGlow}` : 'none',
        display: 'flex', alignItems: 'center',
      }}>
        <div style={{ paddingLeft: 14, color: focused ? tokens.accent : isDark ? tokens.dark.textSecondary : tokens.textSecondary, display: 'flex', alignItems: 'center' }}>
          {icon}
        </div>
        <input
          id={id} name={name} type={type} value={value} onChange={onChange}
          autoFocus={autoFocus} autoComplete={autoComplete}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          style={{
            flex: 1, padding: '14px 12px', border: 'none', outline: 'none',
            background: 'transparent', fontFamily: "'DM Sans', sans-serif",
            fontSize: 15, fontWeight: 500,
            color: isDark ? tokens.dark.textPrimary : tokens.textPrimary,
          }}
        />
        {endAdornment && <div style={{ paddingRight: 12 }}>{endAdornment}</div>}
      </div>
    </div>
  );
}

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [isLockedOut, setIsLockedOut] = useState(false);
  const [lockoutEndTime, setLockoutEndTime] = useState(null);
  const [remainingTime, setRemainingTime] = useState(0);
  const [returningUser, setReturningUser] = useState(null); // For auto-detected Google user

  // Google OAuth refs
  const googleButtonRef = useRef(null);
  const googleInitialized = useRef(false);
  const googleButtonRendered = useRef(false);

  const { login, googleLogin } = useAuth();
  const navigate = useNavigate();
  const { mode, toggleMode } = useThemeMode();
  const isDark = mode === 'dark';

  // Check if already logged in - redirect to dashboard
  useEffect(() => {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (token && user.role) {
      console.log('[Login] User already logged in, redirecting to dashboard');
      navigate('/dashboard');
    }
  }, [navigate]);

  useEffect(() => {
    const storedLockoutEnd = localStorage.getItem('loginLockoutEnd');
    const storedFailedAttempts = localStorage.getItem('loginFailedAttempts');
    if (storedLockoutEnd) {
      const lockoutEnd = new Date(storedLockoutEnd);
      const now = new Date();
      if (now < lockoutEnd) {
        setIsLockedOut(true);
        setLockoutEndTime(lockoutEnd);
        setRemainingTime(Math.ceil((lockoutEnd - now) / 1000));
      } else {
        localStorage.removeItem('loginLockoutEnd');
        localStorage.removeItem('loginFailedAttempts');
      }
    }
    if (storedFailedAttempts) setFailedAttempts(parseInt(storedFailedAttempts, 10));
  }, []);

  useEffect(() => {
    let interval;
    if (isLockedOut && remainingTime > 0) {
      interval = setInterval(() => {
        setRemainingTime(prev => {
          if (prev <= 1) {
            setIsLockedOut(false);
            setLockoutEndTime(null);
            setFailedAttempts(0);
            localStorage.removeItem('loginLockoutEnd');
            localStorage.removeItem('loginFailedAttempts');
            setSnackbar({ open: true, message: 'Lockout expired. You can now try logging in again.', severity: 'info' });
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [isLockedOut, remainingTime]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleLockout = () => {
    const lockoutDuration = Math.min(300, 60 * Math.pow(2, Math.max(0, failedAttempts - 2)));
    const lockoutEnd = new Date(Date.now() + lockoutDuration * 1000);
    setIsLockedOut(true);
    setLockoutEndTime(lockoutEnd);
    setRemainingTime(lockoutDuration);
    localStorage.setItem('loginLockoutEnd', lockoutEnd.toISOString());
    localStorage.setItem('loginFailedAttempts', failedAttempts.toString());
    setSnackbar({ open: true, message: `Too many failed attempts. Please wait ${formatTime(lockoutDuration)} before trying again.`, severity: 'error' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLockedOut) {
      setSnackbar({ open: true, message: `Account temporarily locked. Please wait ${formatTime(remainingTime)}.`, severity: 'error' });
      return;
    }
    setError('');
    if (!email || !password) {
      setError('Please enter both email and password');
      setSnackbar({ open: true, message: 'Please fill in all required fields', severity: 'warning' });
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      setSnackbar({ open: true, message: 'Invalid email format', severity: 'error' });
      return;
    }
    if (password.length < 3) {
      setError('Password is too short');
      setSnackbar({ open: true, message: 'Password must be at least 3 characters', severity: 'error' });
      return;
    }

    setLoading(true);
    setSnackbar({ open: true, message: 'Logging in...', severity: 'info' });

    try {
      const user = await login({ email, password });
      setFailedAttempts(0);
      localStorage.removeItem('loginFailedAttempts');
      localStorage.removeItem('loginLockoutEnd');
      setSnackbar({ open: true, message: `Welcome back, ${user.firstName || user.email}!`, severity: 'success' });
      setTimeout(() => {
        navigate('/dashboard');
      }, 500);
    } catch (err) {
      let shouldTrackFailure = false;
      let errorMessage = 'An unexpected error occurred. Please try again.';
      let snackbarMessage = 'Login failed';

      if (err.response) {
        switch (err.response.status) {
          case 401: errorMessage = 'Invalid email or password.'; snackbarMessage = 'Invalid credentials'; shouldTrackFailure = true; break;
          case 403: errorMessage = 'Your account has been disabled.'; snackbarMessage = 'Account disabled'; break;
          case 404: errorMessage = 'Account not found.'; snackbarMessage = 'Account not found'; shouldTrackFailure = true; break;
          case 429: errorMessage = 'Too many login attempts.'; snackbarMessage = 'Too many attempts'; break;
          case 500: errorMessage = 'Server error. Please try again later.'; snackbarMessage = 'Server error'; break;
          default: errorMessage = err.response.data?.message || errorMessage; shouldTrackFailure = true;
        }
      } else if (err.request) {
        errorMessage = 'Unable to connect to the server.';
        snackbarMessage = 'Connection failed';
      } else if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        errorMessage = 'Login timeout. Please try again.';
        snackbarMessage = 'Login timeout';
      } else {
        errorMessage = err.message || errorMessage;
        if (err.message && /credential|password|email|invalid/i.test(err.message)) shouldTrackFailure = true;
      }

      if (shouldTrackFailure) {
        const newFailed = failedAttempts + 1;
        setFailedAttempts(newFailed);
        localStorage.setItem('loginFailedAttempts', newFailed.toString());
        if (newFailed >= 3) { handleLockout(); return; }
        const rem = 3 - newFailed;
        snackbarMessage += ` (${rem} attempt${rem !== 1 ? 's' : ''} remaining)`;
      }

      setError(errorMessage);
      setSnackbar({ open: true, message: snackbarMessage, severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Handle Google OAuth response for login
  const handleGoogleCredentialResponse = useCallback(async (response) => {
    const credential = response.credential;

    setLoading(true);
    setSnackbar({ open: true, message: 'Connecting with Google...', severity: 'info' });

    try {
      // Use AuthContext's googleLogin to properly set auth state
      const result = await googleLogin({ credential, accountType: 'individual' });
      console.log('[GoogleLogin] AuthContext result:', result);

      setFailedAttempts(0);
      localStorage.removeItem('loginFailedAttempts');
      localStorage.removeItem('loginLockoutEnd');

      // If new user, redirect to registration to complete profile
      if (result.isNewUser) {
        console.log('[GoogleLogin] New user, redirecting to registration');
        setSnackbar({ open: true, message: 'Please complete your registration', severity: 'info' });
        // Store Google data for registration page
        localStorage.setItem('googleAuthData', JSON.stringify({
          credential,
          email: result.user.email,
          firstName: result.user.firstName,
          lastName: result.user.lastName
        }));
        setTimeout(() => {
          navigate('/register?google=true');
        }, 500);
        return;
      }

      console.log('[GoogleLogin] Existing user, navigating to dashboard');
      const welcomeMessage = `Welcome back, ${result.user.firstName}!`;
      setSnackbar({ open: true, message: welcomeMessage, severity: 'success' });

      setTimeout(() => {
        console.log('[GoogleLogin] Navigating to dashboard');
        navigate('/dashboard');
      }, 500);
    } catch (err) {
      console.error('[GoogleLogin] Error:', err);
      let errorMessage = 'Google login failed. Please try again.';
      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.message) {
        errorMessage = err.message;
      }
      setError(errorMessage);
      setSnackbar({ open: true, message: errorMessage, severity: 'error' });
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  // Initialize and render Google Sign-In button with dynamic script loading
  useEffect(() => {
    // Skip if user already logged in
    if (localStorage.getItem('token')) {
      console.log('[GoogleAuth] User already logged in, skipping Google init');
      return;
    }

    const loadGoogleScript = () => {
      return new Promise((resolve, reject) => {
        // Check if already loaded
        if (window.google) {
          console.log('[GoogleAuth] Google already loaded');
          resolve();
          return;
        }

        console.log('[GoogleAuth] Creating script tag...');
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;

        script.onload = () => {
          console.log('[GoogleAuth] Script loaded successfully');
          resolve();
        };

        script.onerror = (err) => {
          console.error('[GoogleAuth] Script failed to load:', err);
          reject(new Error('Failed to load Google script'));
        };

        document.head.appendChild(script);
      });
    };

    const initGoogle = async () => {
      try {
        await loadGoogleScript();

        if (!googleInitialized.current && window.google) {
          console.log('[GoogleAuth] Initializing Google accounts...');
          window.google.accounts.id.initialize({
            client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || '192720000772-1qkm1i0lmg52b17vaslf0gm56lll3p0m.apps.googleusercontent.com',
            callback: handleGoogleCredentialResponse,
            auto_select: false,  // Disable auto-select to prevent popup interference
            cancel_on_tap_outside: true,
          });
          googleInitialized.current = true;
          console.log('[GoogleAuth] Initialized successfully');
        }

        if (googleButtonRef.current && window.google && googleInitialized.current && !googleButtonRendered.current) {
          console.log('[GoogleAuth] Rendering button...');
          googleButtonRendered.current = true;
          window.google.accounts.id.renderButton(googleButtonRef.current, {
            theme: isDark ? 'filled_black' : 'outline',
            size: 'large',
            width: 400,
            text: 'continue_with',
            shape: 'rectangular',
            logo_alignment: 'left',
          });
          console.log('[GoogleAuth] Button rendered!');
        }
      } catch (err) {
        console.error('[GoogleAuth] Error:', err);
      }
    };

    initGoogle();
  }, [handleGoogleCredentialResponse, isDark]);

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
          ? 'linear-gradient(rgba(26,90,140,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(26,90,140,0.4) 1px, transparent 1px)'
          : 'linear-gradient(rgba(215,229,221,0.7) 1px, transparent 1px), linear-gradient(90deg, rgba(215,229,221,0.7) 1px, transparent 1px)',
        backgroundSize: '60px 60px',
        maskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, black 40%, transparent 100%)',
        WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, black 40%, transparent 100%)',
      }} />
      <div style={{ position: 'absolute', top: '10%', left: '5%', width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, rgba(12,189,115,0.14) 0%, transparent 70%)', animation: 'float1 8s ease-in-out infinite', zIndex: 0 }} />
      <div style={{ position: 'absolute', bottom: '10%', right: '5%', width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(157,246,214,0.16) 0%, transparent 70%)', animation: 'float2 10s ease-in-out infinite', zIndex: 0 }} />

      {/* Top bar */}
      <header style={{ position: 'relative', zIndex: 2, padding: '8px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
          width: '100%', maxWidth: 440,
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
            <span style={{ fontSize: 12, fontWeight: 600, color: tokens.accent, letterSpacing: '0.04em' }}>Welcome back</span>
          </div>

          <h1 style={{
            fontWeight: 800, fontSize: 32, letterSpacing: '-0.02em', lineHeight: 1.15,
            color: isDark ? tokens.dark.textPrimary : tokens.textPrimary, marginBottom: 8,
          }}>
            Log in to <span style={{ background: 'linear-gradient(135deg, #0D406C 0%, #0CBD73 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>eexams</span>
          </h1>
          <p style={{ fontSize: 15, color: isDark ? tokens.dark.textSecondary : tokens.textSecondary, marginBottom: 28, lineHeight: 1.6 }}>
            Access your exams, results, and analytics.
          </p>

          {error && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              padding: '12px 14px', borderRadius: 10, marginBottom: 18,
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
              color: tokens.danger,
            }}>
              <div style={{ flexShrink: 0, marginTop: 1 }}><Icon.Alert s={16} /></div>
              <span style={{ fontSize: 13.5, fontWeight: 500, lineHeight: 1.5 }}>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <Input
              isDark={isDark}
              icon={<Icon.Mail />}
              label="Email address"
              type="email" id="email" name="email" autoComplete="email" autoFocus
              value={email} onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              isDark={isDark}
              icon={<Icon.Lock />}
              label="Password"
              type={showPassword ? 'text' : 'password'}
              id="password" name="password" autoComplete="current-password"
              value={password} onChange={(e) => setPassword(e.target.value)}
              endAdornment={
                <button type="button" onClick={() => setShowPassword(s => !s)} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: isDark ? tokens.dark.textSecondary : tokens.textSecondary,
                  display: 'flex', alignItems: 'center', padding: 4,
                }}>
                  {showPassword ? <Icon.EyeOff /> : <Icon.Eye />}
                </button>
              }
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24 }}>
              <RouterLink to="#" style={{ fontSize: 13.5, fontWeight: 600, color: tokens.accent, textDecoration: 'none' }}>
                Forgot password?
              </RouterLink>
            </div>

            <button
              type="submit"
              disabled={loading || isLockedOut}
              style={{
                width: '100%', padding: '14px', borderRadius: 12,
                fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 15,
                background: isLockedOut
                  ? (isDark ? tokens.dark.surfaceAlt : tokens.surfaceAlt)
                  : 'linear-gradient(135deg, #0D406C 0%, #0CBD73 100%)',
                color: isLockedOut ? (isDark ? tokens.dark.textSecondary : tokens.textSecondary) : 'white',
                border: 'none', cursor: loading || isLockedOut ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                boxShadow: isLockedOut ? 'none' : '0 8px 24px rgba(12,189,115,0.35)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'transform 0.15s ease',
              }}
            >
              {loading ? (
                <>
                  <span style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', animation: 'spin 0.8s linear infinite' }} />
                  Logging in...
                </>
              ) : isLockedOut ? (
                <>Locked ({formatTime(remainingTime)})</>
              ) : (
                <>Log in <Icon.Arrow /></>
              )}
            </button>

            {isLockedOut && (
              <div style={{ marginTop: 16, padding: '12px 14px', borderRadius: 10, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: tokens.warning, marginBottom: 2 }}>Account temporarily locked</div>
                <div style={{ fontSize: 12.5, color: isDark ? tokens.dark.textSecondary : tokens.textSecondary }}>
                  Too many failed attempts. Wait {formatTime(remainingTime)} before retrying.
                </div>
              </div>
            )}

            {!isLockedOut && failedAttempts > 0 && (
              <div style={{ marginTop: 16, padding: '10px 14px', borderRadius: 10, background: isDark ? 'rgba(12,189,115,0.1)' : 'rgba(12,189,115,0.06)', border: `1px solid ${tokens.accent}33` }}>
                <span style={{ fontSize: 12.5, color: isDark ? tokens.dark.textSecondary : tokens.textSecondary }}>
                  {failedAttempts} failed attempt{failedAttempts !== 1 ? 's' : ''}. {3 - failedAttempts} remaining before lockout.
                </span>
              </div>
            )}
          </form>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0 18px' }}>
            <div style={{ flex: 1, height: 1, background: isDark ? tokens.dark.border : tokens.surfaceBorder }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: isDark ? tokens.dark.textSecondary : tokens.textSecondary, letterSpacing: '0.06em', textTransform: 'uppercase' }}>or</span>
            <div style={{ flex: 1, height: 1, background: isDark ? tokens.dark.border : tokens.surfaceBorder }} />
          </div>

          {/* Google Sign In */}
          <div
            ref={googleButtonRef}
            style={{
              width: '100%',
              display: 'flex',
              justifyContent: 'center',
            }}
          />

          <div style={{ marginTop: 24, paddingTop: 20, borderTop: `1px solid ${isDark ? tokens.dark.border : tokens.surfaceBorder}`, textAlign: 'center' }}>
            <span style={{ fontSize: 14, color: isDark ? tokens.dark.textSecondary : tokens.textSecondary }}>
              Don't have an account?{' '}
            </span>
            <RouterLink to="/register" style={{ fontSize: 14, fontWeight: 700, color: tokens.accent, textDecoration: 'none' }}>
              Create one
            </RouterLink>
          </div>
        </div>
      </main>

      <footer style={{ padding: '20px 32px', textAlign: 'center', fontSize: 13, color: isDark ? tokens.dark.textSecondary : tokens.textSecondary, position: 'relative', zIndex: 2 }}>
        © {new Date().getFullYear()} eexams. All rights reserved.
      </footer>

      <Toast open={snackbar.open} message={snackbar.message} severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })} />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800&display=swap');
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px);} to { opacity: 1; transform: translateY(0);} }
        @keyframes slideInRight { from { opacity: 0; transform: translateX(20px);} to { opacity: 1; transform: translateX(0);} }
        @keyframes pulse { 0%,100% { opacity: 1; transform: scale(1);} 50% { opacity: 0.6; transform: scale(1.3);} }
        @keyframes spin { to { transform: rotate(360deg);} }
        @keyframes float1 { 0%,100% { transform: translate(0,0);} 50% { transform: translate(12px,-20px);} }
        @keyframes float2 { 0%,100% { transform: translate(0,0);} 50% { transform: translate(-12px,16px);} }
      `}</style>
    </div>
  );
};

export default Login;
