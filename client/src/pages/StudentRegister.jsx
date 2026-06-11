import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link as RouterLink, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useThemeMode } from '../context/ThemeContext';
import SEO from '../components/SEO';
import api from '../services/api';
import PhoneInput from '../components/PhoneInput';

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
  Lock: (p) => <svg width={p.s || 18} height={p.s || 18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  User: (p) => <svg width={p.s || 18} height={p.s || 18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  Eye: (p) => <svg width={p.s || 18} height={p.s || 18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  EyeOff: (p) => <svg width={p.s || 18} height={p.s || 18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/></svg>,
  Arrow: (p) => <svg width={p.s || 16} height={p.s || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>,
  Check: (p) => <svg width={p.s || 16} height={p.s || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  Alert: (p) => <svg width={p.s || 16} height={p.s || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  X: (p) => <svg width={p.s || 16} height={p.s || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Sun: (p) => <svg width={p.s || 16} height={p.s || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>,
  Moon: (p) => <svg width={p.s || 16} height={p.s || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
  Phone: (p) => <svg width={p.s || 18} height={p.s || 18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>,
  CheckCircle: (p) => <svg width={p.s || 16} height={p.s || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
  Circle: (p) => <svg width={p.s || 16} height={p.s || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/></svg>,
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
      padding: '12px 16px', borderRadius: 8,
      background: 'white', border: `1px solid ${palette.bg}33`,
      boxShadow: '0 2px 8px rgba(15,23,42,0.1)',
      maxWidth: 380, animation: 'slideInRight 0.15s ease',
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
function Input({ icon, label, type, value, onChange, autoFocus, autoComplete, name, id, endAdornment, isDark, error, helper, required }) {
  const [focused, setFocused] = useState(false);
  const borderColor = error ? tokens.danger : focused ? tokens.primary : isDark ? tokens.dark.border : tokens.surfaceBorder;
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{
        display: 'block', marginBottom: 6,
        fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 500,
        color: isDark ? tokens.dark.textSecondary : tokens.textSecondary,
      }}>{label}{required && <span style={{ color: tokens.danger, marginLeft: 2 }}>*</span>}</label>
      <div style={{
        position: 'relative',
        borderRadius: 8,
        border: `1.5px solid ${borderColor}`,
        background: isDark ? tokens.dark.surfaceAlt : tokens.surfaceAlt,
        transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
        boxShadow: focused && !error ? `0 0 0 3px rgba(13,64,108,0.08)` : error ? `0 0 0 3px rgba(239,68,68,0.08)` : 'none',
        display: 'flex', alignItems: 'center',
      }}>
        <div style={{ paddingLeft: 12, color: error ? tokens.danger : focused ? tokens.primary : isDark ? tokens.dark.textSecondary : tokens.textSecondary, display: 'flex', alignItems: 'center' }}>
          {icon}
        </div>
        <input
          id={id} name={name} type={type} value={value} onChange={onChange}
          autoFocus={autoFocus} autoComplete={autoComplete}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          style={{
            flex: 1, padding: '12px 10px', border: 'none', outline: 'none',
            background: 'transparent', fontFamily: "'DM Sans', sans-serif",
            fontSize: 14, fontWeight: 500,
            color: isDark ? tokens.dark.textPrimary : tokens.textPrimary,
          }}
        />
        {endAdornment && <div style={{ paddingRight: 10 }}>{endAdornment}</div>}
      </div>
      {(error || helper) && (
        <div style={{ marginTop: 4, fontSize: 12, color: error ? tokens.danger : isDark ? tokens.dark.textSecondary : tokens.textSecondary, fontWeight: 500 }}>
          {error || helper}
        </div>
      )}
    </div>
  );
}

const StudentRegister = () => {
  const [step, setStep] = useState(0); // 0 = initial choice, 1 = email/phone, 2 = password, 3 = name, 4 = phone (if email) / email (if phone), 5 = review
  const [registrationMethod, setRegistrationMethod] = useState('phone'); // 'email' or 'phone'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [validationErrors, setValidationErrors] = useState({});

  // Google OAuth states
  const [googleCredential, setGoogleCredential] = useState(null);
  const [googleUserData, setGoogleUserData] = useState(null);
  const [googleReady, setGoogleReady] = useState(false);
  const googleInitialized = useRef(false);
  const googleCallbackRef = useRef(null);

  const { register, setUser, googleLogin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { mode, toggleMode } = useThemeMode();
  const [searchParams] = useSearchParams();
  const isDark = mode === 'dark';

  // Get redirect URL from query params or location state
  const redirectUrl = searchParams.get('redirect') || location.state?.redirect || '/student/dashboard';

  // Pre-fill email if coming from login page
  useEffect(() => {
    if (location.state?.email) {
      setEmail(location.state.email);
      setStep(1); // Skip to email step since email is already filled
    }
  }, [location.state?.email]);

  // Refs for Google callback to avoid re-initialization
  const googleLoginRef = useRef(googleLogin);
  const navigateRef = useRef(navigate);
  const redirectUrlRef = useRef(redirectUrl);

  // Keep refs updated
  useEffect(() => {
    googleLoginRef.current = googleLogin;
    navigateRef.current = navigate;
    redirectUrlRef.current = redirectUrl;
  }, [googleLogin, navigate, redirectUrl]);

  // Check if already logged in - redirect to intended destination
  // Only redirect if user is already a student, otherwise allow registration flow
  useEffect(() => {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (token && user.role === 'student') {
      console.log('[StudentRegister] Student already logged in, redirecting to:', redirectUrl);
      navigate(redirectUrl);
    }
  }, [navigate, redirectUrl]);

  // Validate current step
  const validateCurrentStep = () => {
    const errors = {};

    if (step === 1) {
      if (registrationMethod === 'email') {
        if (!email) errors.email = 'Email is required';
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Please enter a valid email address';
      } else {
        if (!phone) errors.phone = 'Phone number is required';
        else if (!/^\+[\d\s\-\(\)]{10,}$/.test(phone)) errors.phone = 'Please enter a valid phone number with country code';
      }
    }

    if (step === 2) {
      if (!password) errors.password = 'Password is required';
      else if (password.length < 6) errors.password = 'Password must be at least 6 characters';
      else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) errors.password = 'Must contain uppercase, lowercase, and a number';

      if (!confirmPassword) errors.confirmPassword = 'Please confirm your password';
      else if (password !== confirmPassword) errors.confirmPassword = 'Passwords do not match';
    }

    if (step === 3) {
      if (!firstName) errors.firstName = 'First name is required';
      else if (firstName.length < 2) errors.firstName = 'Too short';

      if (!lastName) errors.lastName = 'Last name is required';
      else if (lastName.length < 2) errors.lastName = 'Too short';
    }

    if (step === 4) {
      // Step 4 is for optional phone (if email) or optional email (if phone)
      if (registrationMethod === 'email') {
        if (phone && !/^\+[\d\s\-\(\)]{10,}$/.test(phone)) errors.phone = 'Please enter a valid phone number with country code';
      } else {
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Please enter a valid email address';
      }
    }

    return errors;
  };

  const handleNext = async () => {
    const errors = validateCurrentStep();
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      setSnackbar({ open: true, message: 'Please fix the errors', severity: 'error' });
      return;
    }
    setValidationErrors({});

    // Check if email or phone already exists when on step 1
    if (step === 1) {
      setLoading(true);
      try {
        if (registrationMethod === 'email') {
          const response = await api.post('/auth/check-email', { email });
          if (response.data.exists) {
            setSnackbar({
              open: true,
              message: 'An account with this email already exists. Redirecting to login...',
              severity: 'warning'
            });
            setTimeout(() => {
              navigate('/login', { state: { redirect: redirectUrl, email } });
            }, 1500);
            setLoading(false);
            return;
          }
        } else {
          const response = await api.post('/auth/check-phone', { phone });
          if (response.data.exists) {
            setSnackbar({
              open: true,
              message: 'An account with this phone number already exists. Redirecting to login...',
              severity: 'warning'
            });
            setTimeout(() => {
              navigate('/login', { state: { redirect: redirectUrl, phone } });
            }, 1500);
            setLoading(false);
            return;
          }
        }
      } catch (err) {
        // If check fails, continue with registration (might be a network issue)
        console.error('Check failed:', err);
      } finally {
        setLoading(false);
      }
    }

    setStep(step + 1);
  };

  const handleBack = () => {
    setStep(step - 1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setValidationErrors({});

    const errors = validateCurrentStep();
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      setError('Please fix all validation errors before submitting');
      setSnackbar({ open: true, message: 'Please review and fix the errors', severity: 'error' });
      return;
    }

    setLoading(true);
    try {
      if (googleCredential) {
        // Use Google OAuth endpoint when Google credential is present
        const googleData = {
          credential: googleCredential,
          accountType: 'individual',
          subscriptionPlan: 'free',
          role: 'student',
          phone
        };
        const { user, isNewUser } = await googleLogin(googleData, true);
        if (isNewUser) {
          setSnackbar({ open: true, message: 'Student account created successfully!', severity: 'success' });
        } else {
          setSnackbar({ open: true, message: 'Welcome back!', severity: 'success' });
        }
      } else {
        // Use regular registration endpoint for email/password
        const registrationData = {
          password,
          firstName,
          lastName,
          accountType: 'individual',
          subscriptionPlan: 'free',
          role: 'student'
        };

        // Add email or phone based on registration method
        if (registrationMethod === 'email') {
          registrationData.email = email;
          if (phone) registrationData.phone = phone;
        } else {
          registrationData.phone = phone;
          if (email) registrationData.email = email;
        }

        await register(registrationData);

        setSnackbar({ open: true, message: 'Student account created successfully!', severity: 'success' });
      }

      navigate(redirectUrl);
    } catch (err) {
      let errorMessage = 'Failed to create account. Please try again.';
      let snackbarMessage = 'Registration failed';
      if (err.response) {
        switch (err.response.status) {
          case 400: errorMessage = 'Invalid registration data.'; snackbarMessage = 'Invalid data'; break;
          case 409: errorMessage = 'An account with this email already exists.'; snackbarMessage = 'Email already exists'; break;
          case 422: errorMessage = 'Please check your input data.'; snackbarMessage = 'Validation error'; break;
          case 500: errorMessage = 'Server error. Please try again later.'; snackbarMessage = 'Server error'; break;
          default: errorMessage = err.response.data?.message || errorMessage;
        }
      } else if (err.request) {
        errorMessage = 'Unable to connect to the server.';
        snackbarMessage = 'Connection failed';
      } else {
        errorMessage = err.message || errorMessage;
      }
      setError(errorMessage);
      setSnackbar({ open: true, message: snackbarMessage, severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Handle Google OAuth response
  const handleGoogleCredentialResponse = useCallback(async (response) => {
    const credential = response.credential;
    setGoogleCredential(credential);

    // Decode the JWT to get user info
    const payload = JSON.parse(atob(credential.split('.')[1]));
    setGoogleUserData(payload);

    setLoading(true);
    try {
      // Check if user already exists by calling Google login with minimal data
      const checkData = {
        credential,
        accountType: 'individual',
        subscriptionPlan: 'free',
        role: 'student'
      };
      const { user, isNewUser } = await googleLoginRef.current(checkData, true); // Save session for existing users

      console.log('[Google Auth] User data:', user);
      console.log('[Google Auth] isNewUser:', isNewUser);
      console.log('[Google Auth] User role:', user?.role);

      // Check if user is already a student (regardless of isNewUser flag)
      if (user.role === 'student' || !isNewUser) {
        // User already exists as a student - log them in and redirect to intended destination
        console.log('[Google Auth] Redirecting to:', redirectUrlRef.current);
        setSnackbar({ open: true, message: 'Welcome back! Logging you in...', severity: 'success' });
        setTimeout(() => {
          navigateRef.current(redirectUrlRef.current);
        }, 500);
      } else {
        // New user or user with different role - show registration form
        console.log('[Google Auth] Showing registration form');
        setEmail(payload.email || '');
        setFirstName(payload.given_name || '');
        setLastName(payload.family_name || '');
        setStep(5);
        setSnackbar({ open: true, message: 'Google account connected! Please complete your registration.', severity: 'success' });
      }
    } catch (err) {
      console.error('[Google Auth] Error:', err);
      // Show specific error message from API response, or fall back to a helpful message
      let errorMessage = 'Failed to connect Google account. Please try again.';
      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.response?.data?.error) {
        errorMessage = `Google auth failed: ${err.response.data.error}`;
      } else if (err.message && err.message !== 'Google login failed') {
        errorMessage = err.message;
      }
      setSnackbar({ open: true, message: errorMessage, severity: 'error' });
    } finally {
      setLoading(false);
    }
  }, []); // Empty deps - uses refs

  // Initialize Google Sign-In
  useEffect(() => {
    const loadGoogleScript = () => {
      return new Promise((resolve, reject) => {
        if (window.google) {
          resolve();
          return;
        }
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load Google script'));
        document.head.appendChild(script);
      });
    };

    const initGoogle = async () => {
      try {
        await loadGoogleScript();
        if (window.google && !googleInitialized.current) {
          // Store callback in ref to avoid re-initialization
          googleCallbackRef.current = handleGoogleCredentialResponse;
          window.google.accounts.id.initialize({
            client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || '192720000772-1qkm1i0lmg52b17vaslf0gm56lll3p0m.apps.googleusercontent.com',
            callback: googleCallbackRef.current,
            auto_select: false,
            cancel_on_tap_outside: true,
          });
          googleInitialized.current = true;
          setGoogleReady(true);
        }
      } catch (err) {
        console.error('[GoogleAuth] Failed to load:', err);
      }
    };

    initGoogle();
  }, []); // Empty deps - only run once

  // Render Google sign-in button when step is 0 and Google is initialized
  useEffect(() => {
    if (step === 0 && googleReady && window.google) {
      const container = document.getElementById('google-signin-button');
      if (container && container.children.length === 0) {
        window.google.accounts.id.renderButton(container, {
          width: '100%',
          type: 'standard',
          size: 'large',
          text: 'continue_with',
          theme: isDark ? 'filled_black' : 'outline',
          logo_alignment: 'center',
        });
      }
    }
  }, [step, googleReady, isDark]);

  return (
    <>
      <SEO
        title="Student Registration - Join eexams | Take Online Exams in Rwanda"
        description="Register as a student on eexams - Rwanda's leading online exam platform. Access public exams, take AI-graded tests, and improve your academic performance with instant results."
        keywords="student registration, Rwanda students, online exams, take exams, practice tests, exam preparation, student portal, e-learning Rwanda, academic assessment, exam results"
        ogUrl="https://www.eexams.net/student-register"
        canonical="https://www.eexams.net/student-register"
        breadcrumbs={[
          { name: 'Home', url: 'https://www.eexams.net/' },
          { name: 'Student Registration', url: 'https://www.eexams.net/student-register' }
        ]}
      />
      <div style={{
        minHeight: '100vh',
        fontFamily: "'DM Sans', sans-serif",
        background: isDark ? tokens.dark.bg : '#F5FBF8',
        position: 'relative', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>

      {/* Top bar */}
      <header style={{ position: 'relative', zIndex: 2, padding: '8px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <RouterLink to="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
            <img
              src="/logo.png"
              alt="eexams"
              style={{
                width: 60,
                height: 60,
                borderRadius: 8,
                objectFit: 'cover',
                backgroundColor: isDark ? 'rgba(255,255,255,0.95)' : 'transparent',
                padding: isDark ? '4px' : '0',
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
      <main style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '12px 16px 24px', position: 'relative', zIndex: 1 }}>
        <div style={{
          width: '100%', maxWidth: 520,
          background: isDark ? tokens.dark.surface : tokens.surface,
          border: `1px solid ${isDark ? tokens.dark.border : tokens.surfaceBorder}`,
          borderRadius: 12, padding: '24px 20px',
          boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.2)' : '0 2px 8px rgba(15,23,42,0.08)',
          animation: 'fadeInUp 0.3s ease',
        }}>
          {/* Badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '5px 12px', borderRadius: 100,
            background: isDark ? 'rgba(12,189,115,0.1)' : 'rgba(12,189,115,0.08)',
            border: `1px solid ${isDark ? 'rgba(12,189,115,0.2)' : 'rgba(12,189,115,0.15)'}`,
            marginBottom: 16,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: tokens.success }} />
            <span style={{ fontSize: 12, fontWeight: 500, color: tokens.accent, letterSpacing: '0.02em' }}>Student Registration</span>
          </div>

          <h1 style={{
            fontWeight: 600, fontSize: 26, letterSpacing: '-0.01em', lineHeight: 1.15,
            color: isDark ? tokens.dark.textPrimary : tokens.textPrimary, marginBottom: 8,
          }}>
            {step === 0 ? 'Create Student Account' :
             step === 1 ? (registrationMethod === 'email' ? 'What\'s your email?' : 'What\'s your phone number?') :
             step === 2 ? 'Create a password' :
             step === 3 ? 'What\'s your name?' :
             step === 4 ? (registrationMethod === 'email' ? 'Add your phone (optional)' : 'Add your email (optional)') :
             'Review your details'}
          </h1>
          <p style={{ fontSize: 14, color: isDark ? tokens.dark.textSecondary : tokens.textSecondary, marginBottom: 24, lineHeight: 1.6 }}>
            {step === 0 ? 'Choose how you want to sign up' :
             step === 1 ? (registrationMethod === 'email' ? 'We\'ll use this to sign you in' : 'We\'ll use this to sign you in') :
             step === 2 ? 'Make it strong and secure' :
             step === 3 ? 'So we know what to call you' :
             step === 4 ? (registrationMethod === 'email' ? 'Optional, but helpful for updates' : 'Optional, but helpful for account recovery') :
             'Almost there! Check your details below'}
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

          {googleUserData && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 16px', borderRadius: 12, marginBottom: 20,
              background: isDark ? 'rgba(12,189,115,0.15)' : 'rgba(12,189,115,0.08)',
              border: `1px solid ${isDark ? 'rgba(12,189,115,0.3)' : 'rgba(12,189,115,0.2)'}`,
            }}>
              {googleUserData.picture && (
                <img src={googleUserData.picture} alt="Profile" style={{ width: 40, height: 40, borderRadius: '50%' }} />
              )}
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: isDark ? tokens.dark.textPrimary : tokens.textPrimary }}>
                  {googleUserData.name || googleUserData.email}
                </div>
                <div style={{ fontSize: 12, color: tokens.accent }}>Connected with Google</div>
              </div>
            </div>
          )}

          {step === 0 && (
            <>
              {/* Google button first - container for Google's rendered button */}
              <div
                id="google-signin-button"
                style={{
                  width: '100%',
                  marginBottom: 16,
                  display: 'flex',
                  justifyContent: 'center',
                }}
              />

              {/* Divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
                <div style={{ flex: 1, height: 1, background: isDark ? tokens.dark.border : tokens.surfaceBorder }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: isDark ? tokens.dark.textSecondary : tokens.textSecondary, letterSpacing: '0.06em', textTransform: 'uppercase' }}>or</span>
                <div style={{ flex: 1, height: 1, background: isDark ? tokens.dark.border : tokens.surfaceBorder }} />
              </div>

              {/* Phone button - primary option */}
              <button
                type="button"
                onClick={() => { setRegistrationMethod('phone'); setStep(1); }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 12,
                  padding: '16px',
                  borderRadius: 12,
                  border: 'none',
                  background: '#0D406C',
                  color: 'white',
                  cursor: 'pointer',
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 16,
                  fontWeight: 500,
                  boxShadow: '0 2px 6px rgba(13,64,108,0.15)',
                  transition: 'transform 0.15s ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                <Icon.Phone s={20} />
                Continue with Phone
              </button>

              {/* Email button - secondary option */}
              <button
                type="button"
                onClick={() => { setRegistrationMethod('email'); setStep(1); }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 12,
                  padding: '16px',
                  borderRadius: 8,
                  border: `1.5px solid ${isDark ? tokens.dark.border : tokens.surfaceBorder}`,
                  background: isDark ? tokens.dark.surfaceAlt : tokens.surfaceAlt,
                  color: isDark ? tokens.dark.textPrimary : tokens.textPrimary,
                  cursor: 'pointer',
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 16,
                  fontWeight: 500,
                  transition: 'transform 0.15s ease, border-color 0.15s ease',
                  marginTop: 12,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.borderColor = tokens.accent;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = isDark ? tokens.dark.border : tokens.surfaceBorder;
                }}
              >
                <Icon.Mail s={20} />
                Continue with Email
              </button>
            </>
          )}

          {step > 0 && (
            <form onSubmit={step === 5 ? handleSubmit : (e) => { e.preventDefault(); handleNext(); }}>
              {step === 1 && (
                <>
                  {registrationMethod === 'email' ? (
                    <Input
                      isDark={isDark}
                      icon={<Icon.Mail />}
                      label="Email address"
                      type="email"
                      id="email"
                      name="email"
                      autoComplete="email"
                      autoFocus
                      required
                      value={email}
                      onChange={(e) => {
                        const value = e.target.value;
                        setEmail(value);
                        if (validationErrors.email) {
                          setValidationErrors(prev => ({ ...prev, email: '' }));
                        }
                        // Auto-switch to phone if user types a phone number
                        if (/^\+[\d\s\-\(\)]{10,}$/.test(value)) {
                          setPhone(value);
                          setRegistrationMethod('phone');
                          setEmail('');
                        }
                      }}
                      error={validationErrors.email}
                    />
                  ) : (
                    <PhoneInput
                      isDark={isDark}
                      label="Phone number"
                      id="phone"
                      name="phone"
                      autoComplete="tel"
                      autoFocus
                      required
                      value={phone}
                      onChange={(e) => {
                        const value = e.target.value;
                        setPhone(value);
                        if (validationErrors.phone) {
                          setValidationErrors(prev => ({ ...prev, phone: '' }));
                        }
                      }}
                      onEmailDetected={(emailValue) => {
                        setEmail(emailValue);
                        setRegistrationMethod('email');
                        setPhone('');
                      }}
                      error={validationErrors.phone}
                    />
                  )}
                </>
              )}

              {step === 2 && (
                <>
                  <Input
                    isDark={isDark}
                    icon={<Icon.Lock />}
                    label="Password"
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    name="password"
                    autoComplete="new-password"
                    required
                    autoFocus
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (validationErrors.password) {
                        setValidationErrors(prev => ({ ...prev, password: '' }));
                      }
                    }}
                    error={validationErrors.password}
                    endAdornment={
                      <button type="button" onClick={() => setShowPassword(s => !s)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: isDark ? tokens.dark.textSecondary : tokens.textSecondary, display: 'flex', padding: 4 }}>
                        {showPassword ? <Icon.EyeOff /> : <Icon.Eye />}
                      </button>
                    }
                  />

                  {/* Password strength indicator */}
                  {password && (
                    <div style={{
                      padding: '12px 14px',
                      borderRadius: 10,
                      background: isDark ? 'rgba(12,189,115,0.08)' : 'rgba(12,189,115,0.05)',
                      border: `1px solid ${isDark ? 'rgba(12,189,115,0.2)' : 'rgba(12,189,115,0.15)'}`,
                      marginBottom: 16,
                    }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: isDark ? tokens.dark.textSecondary : tokens.textSecondary, marginBottom: 10 }}>
                        Password requirements:
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                          {password.length >= 6 ? (
                            <Icon.CheckCircle s={14} style={{ color: tokens.success }} />
                          ) : (
                            <Icon.Circle s={14} style={{ color: isDark ? tokens.dark.textSecondary : tokens.textSecondary }} />
                          )}
                          <span style={{ color: password.length >= 6 ? tokens.success : (isDark ? tokens.dark.textSecondary : tokens.textSecondary) }}>
                            At least 6 characters
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                          {/[a-z]/.test(password) ? (
                            <Icon.CheckCircle s={14} style={{ color: tokens.success }} />
                          ) : (
                            <Icon.Circle s={14} style={{ color: isDark ? tokens.dark.textSecondary : tokens.textSecondary }} />
                          )}
                          <span style={{ color: /[a-z]/.test(password) ? tokens.success : (isDark ? tokens.dark.textSecondary : tokens.textSecondary) }}>
                            At least one lowercase letter
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                          {/[A-Z]/.test(password) ? (
                            <Icon.CheckCircle s={14} style={{ color: tokens.success }} />
                          ) : (
                            <Icon.Circle s={14} style={{ color: isDark ? tokens.dark.textSecondary : tokens.textSecondary }} />
                          )}
                          <span style={{ color: /[A-Z]/.test(password) ? tokens.success : (isDark ? tokens.dark.textSecondary : tokens.textSecondary) }}>
                            At least one uppercase letter
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                          {/\d/.test(password) ? (
                            <Icon.CheckCircle s={14} style={{ color: tokens.success }} />
                          ) : (
                            <Icon.Circle s={14} style={{ color: isDark ? tokens.dark.textSecondary : tokens.textSecondary }} />
                          )}
                          <span style={{ color: /\d/.test(password) ? tokens.success : (isDark ? tokens.dark.textSecondary : tokens.textSecondary) }}>
                            At least one number
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  <Input
                    isDark={isDark}
                    icon={<Icon.Lock />}
                    label="Confirm password"
                    type={showPassword ? 'text' : 'password'}
                    id="confirmPassword"
                    name="confirmPassword"
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (validationErrors.confirmPassword) {
                        setValidationErrors(prev => ({ ...prev, confirmPassword: '' }));
                      }
                    }}
                    error={validationErrors.confirmPassword}
                  />
                </>
              )}

              {step === 3 && (
                <div className="name-inputs-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <style>{`
                    @media (max-width: 640px) {
                      .name-inputs-grid {
                        grid-template-columns: 1fr !important;
                        gap: 12px !important;
                      }
                    }
                    @media (min-width: 641px) and (max-width: 900px) {
                      .name-inputs-grid {
                        grid-template-columns: 1fr 1fr !important;
                        gap: 10px !important;
                      }
                    }
                    @media (min-width: 901px) {
                      .name-inputs-grid {
                        grid-template-columns: 1fr 1fr !important;
                        gap: 12px !important;
                      }
                    }
                  `}</style>
                  <Input
                    isDark={isDark}
                    icon={<Icon.User />}
                    label="First name"
                    type="text"
                    id="firstName"
                    name="firstName"
                    autoComplete="given-name"
                    autoFocus
                    required
                    value={firstName}
                    onChange={(e) => {
                      setFirstName(e.target.value);
                      if (validationErrors.firstName) {
                        setValidationErrors(prev => ({ ...prev, firstName: '' }));
                      }
                    }}
                    error={validationErrors.firstName}
                  />
                  <Input
                    isDark={isDark}
                    icon={<Icon.User />}
                    label="Last name"
                    type="text"
                    id="lastName"
                    name="lastName"
                    autoComplete="family-name"
                    required
                    value={lastName}
                    onChange={(e) => {
                      setLastName(e.target.value);
                      if (validationErrors.lastName) {
                        setValidationErrors(prev => ({ ...prev, lastName: '' }));
                      }
                    }}
                    error={validationErrors.lastName}
                  />
                </div>
              )}

              {step === 4 && (
                <>
                  {registrationMethod === 'email' ? (
                    <PhoneInput
                      isDark={isDark}
                      label="Phone number (optional)"
                      id="phone"
                      name="phone"
                      autoComplete="tel"
                      autoFocus
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value);
                        if (validationErrors.phone) {
                          setValidationErrors(prev => ({ ...prev, phone: '' }));
                        }
                      }}
                      error={validationErrors.phone}
                      required={false}
                    />
                  ) : (
                    <Input
                      isDark={isDark}
                      icon={<Icon.Mail />}
                      label="Email address (optional)"
                      type="email"
                      id="email"
                      name="email"
                      autoComplete="email"
                      autoFocus
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (validationErrors.email) {
                          setValidationErrors(prev => ({ ...prev, email: '' }));
                        }
                      }}
                      error={validationErrors.email}
                      helper={!validationErrors.email ? 'Helpful for account recovery' : null}
                    />
                  )}
                </>
              )}

              {step === 5 && (
                <div style={{
                  padding: '20px',
                  borderRadius: 12,
                  background: isDark ? tokens.dark.surfaceAlt : tokens.surfaceAlt,
                  border: `1px solid ${isDark ? tokens.dark.border : tokens.surfaceBorder}`,
                  marginBottom: 24,
                }}>
                  <div style={{ marginBottom: 16, fontWeight: 700, fontSize: 14, color: isDark ? tokens.dark.textPrimary : tokens.textPrimary }}>
                    Your Details
                  </div>
                  <div className="review-details-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 14 }}>
                    <style>{`
                      @media (max-width: 640px) {
                        .review-details-grid {
                          grid-template-columns: 1fr !important;
                        }
                      }
                    `}</style>
                    <div>
                      <div style={{ fontSize: 12, color: isDark ? tokens.dark.textSecondary : tokens.textSecondary, marginBottom: 4 }}>
                        {registrationMethod === 'email' ? 'Email' : 'Phone'}
                      </div>
                      <div style={{ fontWeight: 500, color: isDark ? tokens.dark.textPrimary : tokens.textPrimary }}>
                        {registrationMethod === 'email' ? email : phone}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: isDark ? tokens.dark.textSecondary : tokens.textSecondary, marginBottom: 4 }}>Name</div>
                      <div style={{ fontWeight: 500, color: isDark ? tokens.dark.textPrimary : tokens.textPrimary }}>{firstName} {lastName}</div>
                    </div>
                    {(registrationMethod === 'email' ? phone : email) && (
                      <div style={{ gridColumn: '1 / -1' }}>
                        <div style={{ fontSize: 12, color: isDark ? tokens.dark.textSecondary : tokens.textSecondary, marginBottom: 4 }}>
                          {registrationMethod === 'email' ? 'Phone' : 'Email'}
                        </div>
                        <div style={{ fontWeight: 500, color: isDark ? tokens.dark.textPrimary : tokens.textPrimary }}>
                          {registrationMethod === 'email' ? phone : email}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Navigation buttons */}
              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                {step > 0 && step < 5 && (
                  <button
                    type="button"
                    onClick={handleBack}
                    style={{
                      flex: 1,
                      padding: '14px',
                      borderRadius: 12,
                      fontFamily: "'DM Sans', sans-serif",
                      fontWeight: 600,
                      fontSize: 15,
                      border: `1.5px solid ${isDark ? tokens.dark.border : tokens.surfaceBorder}`,
                      background: isDark ? tokens.dark.surfaceAlt : 'transparent',
                      color: isDark ? tokens.dark.textPrimary : tokens.textPrimary,
                      cursor: 'pointer',
                    }}
                  >
                    Back
                  </button>
                )}
                <button
                  type={step === 5 ? 'submit' : 'button'}
                  onClick={step === 5 ? undefined : handleNext}
                  disabled={loading}
                  style={{
                    flex: step > 0 && step < 5 ? 2 : 1,
                    padding: '14px',
                    borderRadius: 12,
                    fontFamily: "'DM Sans', sans-serif",
                    fontWeight: 700,
                    fontSize: 15,
                    background: 'linear-gradient(135deg, #0D406C 0%, #0CBD73 100%)',
                    color: 'white',
                    border: 'none',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.7 : 1,
                    boxShadow: '0 8px 24px rgba(12,189,115,0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    transition: 'transform 0.15s ease',
                  }}
                >
                  {loading ? (
                    <>
                      <span style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', animation: 'spin 0.8s linear infinite' }} />
                      {step === 5 ? 'Creating account...' : 'Next'}
                    </>
                  ) : (
                    <>
                      {step === 5 ? 'Create Account' : 'Next'}
                      <Icon.Arrow />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          <div style={{ 
            marginTop: 24, 
            paddingTop: 24, 
            borderTop: `1px solid ${isDark ? tokens.dark.border : tokens.surfaceBorder}`, 
            textAlign: 'center',
            background: isDark ? 'rgba(12,189,115,0.05)' : 'rgba(12,189,115,0.03)',
            borderRadius: 12,
            padding: '20px 16px',
            border: `1px solid ${isDark ? 'rgba(12,189,115,0.15)' : 'rgba(12,189,115,0.1)'}`,
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: 8, 
              marginBottom: 8 
            }}>
              <Icon.User s={16} style={{ color: tokens.accent }} />
              <span style={{ fontSize: 15, fontWeight: 600, color: isDark ? tokens.dark.textPrimary : tokens.textPrimary }}>
                Already have an account?
              </span>
            </div>
            <RouterLink 
              to="/login" 
              state={{ redirect: redirectUrl }} 
              style={{ 
                fontSize: 15, 
                fontWeight: 700, 
                color: tokens.accent, 
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 16px',
                borderRadius: 8,
                background: isDark ? 'rgba(12,189,115,0.1)' : 'rgba(12,189,115,0.08)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => { 
                e.currentTarget.style.background = isDark ? 'rgba(12,189,115,0.2)' : 'rgba(12,189,115,0.15)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => { 
                e.currentTarget.style.background = isDark ? 'rgba(12,189,115,0.1)' : 'rgba(12,189,115,0.08)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              Log in
              <Icon.Arrow s={14} />
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
        @keyframes spin { to { transform: rotate(360deg);} }
        @media (max-width: 520px) {
          main { padding: 8px 12px 20px !important; }
          main > div { padding: 28px 20px !important; border-radius: 16px !important; }
          main > div h1 { font-size: 24px !important; }
        }
      `}</style>
    </div>
    </>
  );
};

export default StudentRegister;
