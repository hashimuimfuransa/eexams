import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useThemeMode } from '../context/ThemeContext';
import api from '../services/api';

// ─── Design tokens ────────────────────────────────────────────────────────────
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

const Icon = {
  Mail: (p) => <svg width={p.s || 18} height={p.s || 18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
  Lock: (p) => <svg width={p.s || 18} height={p.s || 18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  User: (p) => <svg width={p.s || 18} height={p.s || 18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  Building: (p) => <svg width={p.s || 18} height={p.s || 18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4"/></svg>,
  Phone: (p) => <svg width={p.s || 18} height={p.s || 18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>,
  Eye: (p) => <svg width={p.s || 18} height={p.s || 18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  EyeOff: (p) => <svg width={p.s || 18} height={p.s || 18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>,
  Arrow: (p) => <svg width={p.s || 16} height={p.s || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>,
  ArrowLeft: (p) => <svg width={p.s || 16} height={p.s || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>,
  Check: (p) => <svg width={p.s || 16} height={p.s || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  Alert: (p) => <svg width={p.s || 16} height={p.s || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  X: (p) => <svg width={p.s || 16} height={p.s || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Sun: (p) => <svg width={p.s || 16} height={p.s || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>,
  Moon: (p) => <svg width={p.s || 16} height={p.s || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
};

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
      <div style={{ width: 32, height: 32, borderRadius: 8, background: `${palette.bg}18`, color: palette.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{palette.icon}</div>
      <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: tokens.textPrimary, lineHeight: 1.5 }}>{message}</span>
      <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: tokens.textSecondary, padding: 4, display: 'flex' }}><Icon.X s={14} /></button>
    </div>
  );
}

function Input({ icon, label, type, value, onChange, autoFocus, autoComplete, name, id, endAdornment, isDark, error, helper, required, optional }) {
  const [focused, setFocused] = useState(false);
  const borderColor = error ? tokens.danger : focused ? tokens.accent : isDark ? tokens.dark.border : tokens.surfaceBorder;
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6,
        fontSize: 13, fontWeight: 600, color: isDark ? tokens.dark.textSecondary : tokens.textSecondary,
      }}>
        <span>{label}{required && <span style={{ color: tokens.danger, marginLeft: 2 }}>*</span>}</span>
        {optional && <span style={{ fontSize: 11, fontWeight: 500, color: isDark ? tokens.dark.textSecondary : tokens.textSecondary, opacity: 0.7 }}>Optional</span>}
      </label>
      <div style={{
        position: 'relative', borderRadius: 12,
        border: `1.5px solid ${borderColor}`,
        background: isDark ? tokens.dark.surfaceAlt : tokens.surfaceAlt,
        transition: 'border-color 0.2s, box-shadow 0.2s',
        boxShadow: focused && !error ? `0 0 0 4px ${tokens.accentGlow}` : error ? `0 0 0 4px rgba(239,68,68,0.12)` : 'none',
        display: 'flex', alignItems: 'center',
      }}>
        <div style={{ paddingLeft: 14, color: error ? tokens.danger : focused ? tokens.accent : isDark ? tokens.dark.textSecondary : tokens.textSecondary, display: 'flex' }}>{icon}</div>
        <input
          id={id} name={name} type={type} value={value} onChange={onChange}
          autoFocus={autoFocus} autoComplete={autoComplete}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          style={{
            flex: 1, padding: '13px 12px', border: 'none', outline: 'none',
            background: 'transparent', fontFamily: "'DM Sans', sans-serif",
            fontSize: 15, fontWeight: 500,
            color: isDark ? tokens.dark.textPrimary : tokens.textPrimary,
          }}
        />
        {endAdornment && <div style={{ paddingRight: 12 }}>{endAdornment}</div>}
      </div>
      {(error || helper) && (
        <div style={{ marginTop: 6, fontSize: 12, color: error ? tokens.danger : isDark ? tokens.dark.textSecondary : tokens.textSecondary, fontWeight: 500 }}>
          {error || helper}
        </div>
      )}
    </div>
  );
}

// Updated steps for both account types - both now have Plan selection
const ORG_STEPS = ['Account', 'Profile', 'Organization', 'Plan', 'Done'];
const TEACHER_STEPS = ['Account', 'Profile', 'Plan', 'Done'];

const Register = () => {
  const [activeStep, setActiveStep] = useState(0);
  const [accountType, setAccountType] = useState('individual'); // 'individual' or 'organization'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [organization, setOrganization] = useState('');
  const [phone, setPhone] = useState('');
  const [subscriptionPlan, setSubscriptionPlan] = useState('free');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [validationErrors, setValidationErrors] = useState({});

  // Google OAuth states
  const [googleCredential, setGoogleCredential] = useState(null);
  const [googleUserData, setGoogleUserData] = useState(null);
  const [isGoogleFlow, setIsGoogleFlow] = useState(false);
  const googleButtonRef = useRef(null);
  const googleInitialized = useRef(false);
  const googleButtonRendered = useRef(false);

  // Initialize hooks before any effects that use them
  const { register } = useAuth();
  const navigate = useNavigate();
  const { mode, toggleMode } = useThemeMode();

  // Check if already logged in - redirect to dashboard
  useEffect(() => {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (token && user.role) {
      console.log('[Register] User already logged in, redirecting to dashboard');
      navigate('/dashboard');
    }
  }, [navigate]);

  // Get steps based on account type
  const STEPS = accountType === 'organization' ? ORG_STEPS : TEACHER_STEPS;
  const isDark = mode === 'dark';

  const validateStep = (step) => {
    const errors = {};
    if (step === 0) {
      // Step 0 only validates account type selection
      // No validation needed here - just selecting account type
    } else if (step === 1) {
      // Step 1: Account Credentials (skip for Google users)
      if (!isGoogleFlow) {
        if (!email) errors.email = 'Email is required';
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Please enter a valid email address';
        if (!password) errors.password = 'Password is required';
        else if (password.length < 6) errors.password = 'Password must be at least 6 characters';
        else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) errors.password = 'Must contain uppercase, lowercase, and a number';
        if (!confirmPassword) errors.confirmPassword = 'Please confirm your password';
        else if (password !== confirmPassword) errors.confirmPassword = 'Passwords do not match';
      }
    } else if (step === 2) {
      // Step 2: Profile for both types
      if (!firstName) errors.firstName = 'First name is required';
      else if (firstName.length < 2) errors.firstName = 'Too short';
      if (!lastName) errors.lastName = 'Last name is required';
      else if (lastName.length < 2) errors.lastName = 'Too short';
      if (phone && !/^\+?[\d\s\-\(\)]{10,}$/.test(phone)) errors.phone = 'Please enter a valid phone number';

      if (accountType === 'organization') {
        // Organization name validation for org accounts
        if (!organization) errors.organization = 'Organization/school name is required';
        else if (organization.length < 2) errors.organization = 'Too short';
      } else {
        // Plan selection for individual accounts
        if (!subscriptionPlan) errors.subscriptionPlan = 'Please select a subscription plan';
      }
    } else if (step === 3 && accountType === 'organization') {
      // Plan step for org accounts
      if (!subscriptionPlan) errors.subscriptionPlan = 'Please select a subscription plan';
    }
    return errors;
  };

  const handleNext = () => {
    const errors = validateStep(activeStep);
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError(Object.values(errors)[0]);
      setSnackbar({ open: true, message: 'Please fix the errors before continuing', severity: 'warning' });
      return;
    }
    setError('');
    setValidationErrors({});
    setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
    setError('');
  };

  // Handle Google OAuth response
  const handleGoogleCredentialResponse = useCallback((response) => {
    const credential = response.credential;
    setGoogleCredential(credential);

    // Decode the JWT to get user info
    const payload = JSON.parse(atob(credential.split('.')[1]));
    setGoogleUserData(payload);

    // Pre-fill form with Google data
    setEmail(payload.email || '');
    setFirstName(payload.given_name || '');
    setLastName(payload.family_name || '');
    setIsGoogleFlow(true);

    // Start at step 0 so user can select account type, profile will be pre-filled
    setSnackbar({ open: true, message: 'Google account connected! Please select your account type.', severity: 'success' });
    setActiveStep(0);
  }, []);

  // Check for Google data from login redirect
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const isGoogleRedirect = urlParams.get('google') === 'true';

    if (isGoogleRedirect) {
      const googleData = localStorage.getItem('googleAuthData');
      if (googleData) {
        const data = JSON.parse(googleData);
        setGoogleCredential(data.credential);
        setEmail(data.email || '');
        setFirstName(data.firstName || '');
        setLastName(data.lastName || '');
        setIsGoogleFlow(true);
        // Start at step 0 so user can choose account type, but profile info is pre-filled
        setActiveStep(0);
        setSnackbar({ open: true, message: `Welcome ${data.firstName || ''}! Your Google info is pre-filled. Please select your account type and plan to continue.`, severity: 'info' });
        // Clean up
        localStorage.removeItem('googleAuthData');
      }
    }
  }, []);

  // Initialize Google Sign-In button
  // Load Google script dynamically and initialize
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
          window.google.accounts.id.initialize({
            client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || '192720000772-1qkm1i0lmg52b17vaslf0gm56lll3p0m.apps.googleusercontent.com',
            callback: handleGoogleCredentialResponse,
            auto_select: true,  // Enable for returning users - shows "Continue as [Name]"
            cancel_on_tap_outside: true,
          });
          googleInitialized.current = true;

          // Check for returning Google user (one-tap prompt)
          if (!isGoogleFlow) {
            window.google.accounts.id.prompt((notification) => {
              if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                // User dismissed or not shown, continue normally
                console.log('[GoogleAuth] One-tap not shown:', notification.getNotDisplayedReason() || notification.getSkippedReason());
              }
            });
          }
        }
      } catch (err) {
        console.error('[GoogleAuth] Failed to load:', err);
      }
    };

    initGoogle();
  }, [handleGoogleCredentialResponse, isGoogleFlow]);

  // Render Google button when on step 0
  useEffect(() => {
    if (activeStep === 0 && googleButtonRef.current && window.google && isGoogleFlow === false && !googleButtonRendered.current) {
      googleButtonRendered.current = true;
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: isDark ? 'filled_black' : 'outline',
        size: 'large',
        width: 400,
        text: 'continue_with',
        shape: 'rectangular',
        logo_alignment: 'left',
      });
    }
  }, [activeStep, isDark, isGoogleFlow]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setValidationErrors({});

    // Validate all steps based on account type
    let allErrors = { ...validateStep(0), ...validateStep(1) };
    if (accountType === 'organization') {
      allErrors = { ...allErrors, ...validateStep(2), ...validateStep(3) };
    } else {
      allErrors = { ...allErrors, ...validateStep(2) };
    }
    if (Object.keys(allErrors).length > 0) {
      setValidationErrors(allErrors);
      setError('Please fix all validation errors before submitting');
      setSnackbar({ open: true, message: 'Please review and fix the errors', severity: 'error' });
      setActiveStep(0);
      return;
    }

    setLoading(true);
    try {
      let response;

      if (isGoogleFlow && googleCredential) {
        // Google OAuth registration
        response = await api.post('/auth/google', {
          credential: googleCredential,
          accountType,
          subscriptionPlan,
          organization: accountType === 'organization' ? organization : undefined,
          phone
        });

        // Save user data to localStorage
        const user = {
          id: response.data._id,
          email: response.data.email,
          firstName: response.data.firstName,
          lastName: response.data.lastName,
          role: response.data.role,
          userType: response.data.userType,
          isGoogleUser: true,
          token: response.data.token,
        };

        if (response.data.organization) {
          user.organization = response.data.organization;
          user.subscriptionPlan = response.data.subscriptionPlan;
          user.subscriptionStatus = response.data.subscriptionStatus;
        }

        localStorage.setItem('user', JSON.stringify(user));
        localStorage.setItem('token', response.data.token);
      } else {
        // Regular email/password registration
        const registrationData = {
          email,
          password,
          firstName,
          lastName,
          phone,
          accountType
        };

        // Add organization and subscription data
        if (accountType === 'organization') {
          registrationData.organization = organization;
          registrationData.subscriptionPlan = subscriptionPlan;
        } else {
          // Individual teachers can also select a plan
          registrationData.subscriptionPlan = subscriptionPlan;
        }

        await register(registrationData);
      }

      const successMessage = accountType === 'organization'
        ? `Welcome to eexams, ${firstName}! Organization registered successfully.`
        : `Welcome to eexams, ${firstName}! Your teacher account is ready.`;
      setSnackbar({ open: true, message: successMessage, severity: 'success' });

      // Navigate to dashboard or complete registration based on plan selection
      const finalStep = accountType === 'organization' ? 4 : 3;
      setActiveStep(finalStep);

      setTimeout(() => {
        // Check if user has a subscription plan selected
        const savedUser = JSON.parse(localStorage.getItem('user') || '{}');
        if (savedUser.subscriptionPlan) {
          // Has plan - check if paid plan needs approval
          if (savedUser.subscriptionPlan !== 'free' && savedUser.subscriptionStatus !== 'active') {
            navigate('/pending-approval');
          } else {
            navigate('/dashboard');
          }
        } else {
          // No plan selected - go to complete registration
          navigate('/complete-registration');
        }
      }, 2000);
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
      setActiveStep(0);
    } finally {
      setLoading(false);
    }
  };

  // ─── Step content ─────────────────────────────────────────────────────────
  const renderStep = () => {
    // Step 0: Account Type Selection
    if (activeStep === 0) {
      return (
        <div style={{ marginTop: 8 }}>
          <p style={{ fontSize: 15, color: isDark ? tokens.dark.textSecondary : tokens.textSecondary, marginBottom: 20, lineHeight: 1.5 }}>
            Choose how you want to use eexams. Select the option that best fits your needs.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Individual Teacher Option */}
            <div
              onClick={() => setAccountType('individual')}
              style={{
                padding: '20px',
                borderRadius: 12,
                border: `2px solid ${accountType === 'individual' ? tokens.accent : isDark ? tokens.dark.border : tokens.surfaceBorder}`,
                background: accountType === 'individual' ? `${tokens.accent}10` : isDark ? tokens.dark.surfaceAlt : tokens.surfaceAlt,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 16,
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: accountType === 'individual' ? tokens.accent : isDark ? tokens.dark.surface : tokens.surface,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: accountType === 'individual' ? 'white' : isDark ? tokens.dark.textSecondary : tokens.textSecondary
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: isDark ? tokens.dark.textPrimary : tokens.textPrimary }}>Individual Teacher</span>
                  {accountType === 'individual' && <Icon.Check s={16} />}
                </div>
                <div style={{ fontSize: 13, color: isDark ? tokens.dark.textSecondary : tokens.textSecondary, lineHeight: 1.5 }}>
                  Perfect for individual educators. Create exams, share via links, and track student results. Free forever.
                </div>
              </div>
            </div>

            {/* Organization Option */}
            <div
              onClick={() => setAccountType('organization')}
              style={{
                padding: '20px',
                borderRadius: 12,
                border: `2px solid ${accountType === 'organization' ? '#0D406C' : isDark ? tokens.dark.border : tokens.surfaceBorder}`,
                background: accountType === 'organization' ? 'rgba(13, 64, 108, 0.1)' : isDark ? tokens.dark.surfaceAlt : tokens.surfaceAlt,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 16,
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: accountType === 'organization' ? '#0D406C' : isDark ? tokens.dark.surface : tokens.surface,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: accountType === 'organization' ? 'white' : isDark ? tokens.dark.textSecondary : tokens.textSecondary
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: isDark ? tokens.dark.textPrimary : tokens.textPrimary }}>School / Organization</span>
                  {accountType === 'organization' && <Icon.Check s={16} />}
                </div>
                <div style={{ fontSize: 13, color: isDark ? tokens.dark.textSecondary : tokens.textSecondary, lineHeight: 1.5 }}>
                  For schools and institutions. Manage multiple teachers, track progress across classes, and access advanced analytics.
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Step 1: Account Credentials (or Google info for OAuth users)
    if (activeStep === 1) {
      return (
        <>
          {/* Show Google user info if using OAuth */}
          {isGoogleFlow && googleUserData && (
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

          {/* Show email and password fields only for non-Google users */}
          {!isGoogleFlow && (
            <>
              <Input isDark={isDark} icon={<Icon.Mail />} label="Email address" type="email" id="email" name="email"
                autoComplete="email" autoFocus required
                value={email} onChange={(e) => setEmail(e.target.value)} error={validationErrors.email} />

              <Input isDark={isDark} icon={<Icon.Lock />} label="Password" type={showPassword ? 'text' : 'password'}
                id="password" name="password" autoComplete="new-password" required
                value={password} onChange={(e) => setPassword(e.target.value)}
                error={validationErrors.password}
                helper={!validationErrors.password ? 'Must contain uppercase, lowercase, and number' : null}
                endAdornment={
                  <button type="button" onClick={() => setShowPassword(s => !s)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: isDark ? tokens.dark.textSecondary : tokens.textSecondary, display: 'flex', padding: 4 }}>
                    {showPassword ? <Icon.EyeOff /> : <Icon.Eye />}
                  </button>
                } />
              <Input isDark={isDark} icon={<Icon.Lock />} label="Confirm password" type={showPassword ? 'text' : 'password'}
                id="confirmPassword" name="confirmPassword" autoComplete="new-password" required
                value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                error={validationErrors.confirmPassword} />
            </>
          )}

          {/* For Google users, show a message to continue to next step */}
          {isGoogleFlow && (
            <div style={{ padding: '12px 0', textAlign: 'center', color: isDark ? tokens.dark.textSecondary : tokens.textSecondary }}>
              <p style={{ fontSize: 14 }}>Your Google account is connected. Continue to select your account type and plan.</p>
            </div>
          )}
        </>
      );
    }

    // Step 2: Profile (name, phone)
    if (activeStep === 2) {
      return (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Input isDark={isDark} icon={<Icon.User />} label="First name" type="text" id="firstName" name="firstName"
              autoComplete="given-name" autoFocus required
              value={firstName} onChange={(e) => setFirstName(e.target.value)} error={validationErrors.firstName} />
            <Input isDark={isDark} icon={<Icon.User />} label="Last name" type="text" id="lastName" name="lastName"
              autoComplete="family-name" required
              value={lastName} onChange={(e) => setLastName(e.target.value)} error={validationErrors.lastName} />
          </div>
          <Input isDark={isDark} icon={<Icon.Phone />} label="Phone number" type="tel" id="phone" name="phone"
            autoComplete="tel" optional
            value={phone} onChange={(e) => setPhone(e.target.value)}
            error={validationErrors.phone}
            helper={!validationErrors.phone ? 'Include country code if international' : null} />

          {accountType === 'organization' && (
            <Input isDark={isDark} icon={<Icon.Building />} label="Organization / school name *" type="text" id="organization" name="organization"
              autoComplete="organization" required
              value={organization} onChange={(e) => setOrganization(e.target.value)} error={validationErrors.organization} />
          )}
        </>
      );
    }

    // Step 3: Subscription Plan for organizations, Step 2: Plan for individuals
    if ((activeStep === 3 && accountType === 'organization') || (activeStep === 2 && accountType === 'individual')) {
      // Different plans for individuals vs organizations
      const orgPlans = [
        { id: 'free', name: 'Free Trial', price: '$0', period: '30 days', features: ['Up to 50 students', '5 exams', 'Basic support', 'No credit card required'], color: '#64748B', popular: false },
        { id: 'basic', name: 'Basic', price: '$29', period: '/month', features: ['Up to 200 students', 'Unlimited exams', 'Email support', 'Basic analytics', 'Export results'], color: '#0CBD73', popular: true },
        { id: 'premium', name: 'Premium', price: '$79', period: '/month', features: ['Up to 500 students', 'Unlimited exams', 'Priority support', 'Advanced analytics', 'Custom branding', 'AI grading'], color: '#0D406C', popular: false },
        { id: 'enterprise', name: 'Enterprise', price: 'Custom', period: '', features: ['Unlimited students', 'Unlimited exams', '24/7 support', 'Full analytics', 'Custom integrations', 'Dedicated manager', 'SLA guarantee'], color: '#8B5CF6', popular: false }
      ];

      const individualPlans = [
        { id: 'free', name: 'Free', price: '$0', period: 'forever', features: ['Up to 30 students', '10 exams/month', 'Basic AI grading', 'Email support', 'Standard templates'], color: '#64748B', popular: false },
        { id: 'pro', name: 'Pro', price: '$9', period: '/month', features: ['Up to 100 students', 'Unlimited exams', 'Advanced AI grading', 'Priority support', 'Custom branding', 'Detailed analytics'], color: '#0CBD73', popular: true },
        { id: 'premium', name: 'Premium', price: '$19', period: '/month', features: ['Up to 300 students', 'Unlimited exams', 'Full AI features', '24/7 support', 'Custom branding', 'Advanced analytics', 'API access'], color: '#0D406C', popular: false }
      ];

      const plans = accountType === 'organization' ? orgPlans : individualPlans;
      const planTitle = accountType === 'organization' ? 'Select a plan for your organization' : 'Choose your teacher plan';
      const planDescription = accountType === 'organization'
        ? 'Select a subscription plan for your organization. You can upgrade or change plans anytime from your dashboard.'
        : 'Select the plan that works best for your teaching needs. Upgrade anytime as you grow.';

      return (
        <div style={{ marginTop: 8 }}>
          <p style={{ fontSize: 15, color: isDark ? tokens.dark.textSecondary : tokens.textSecondary, marginBottom: 20, lineHeight: 1.5 }}>
            {planDescription}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {plans.map((plan) => (
              <div
                key={plan.id}
                onClick={() => setSubscriptionPlan(plan.id)}
                style={{
                  padding: '16px 20px',
                  borderRadius: 12,
                  border: `2px solid ${subscriptionPlan === plan.id ? plan.color : isDark ? tokens.dark.border : tokens.surfaceBorder}`,
                  background: subscriptionPlan === plan.id ? `${plan.color}10` : isDark ? tokens.dark.surfaceAlt : tokens.surfaceAlt,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  transition: 'all 0.2s ease',
                  position: 'relative'
                }}
              >
                {plan.popular && (
                  <div style={{
                    position: 'absolute', top: -8, right: 12,
                    background: 'linear-gradient(135deg, #0CBD73 0%, #5AD5A2 100%)',
                    color: 'white', fontSize: 10, fontWeight: 700,
                    padding: '3px 10px', borderRadius: 10,
                    textTransform: 'uppercase', letterSpacing: '0.5px'
                  }}>
                    Popular
                  </div>
                )}
                <div style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  border: `2px solid ${subscriptionPlan === plan.id ? plan.color : isDark ? tokens.dark.border : tokens.surfaceBorder}`,
                  background: subscriptionPlan === plan.id ? plan.color : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  {subscriptionPlan === plan.id && <Icon.Check s={14} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: isDark ? tokens.dark.textPrimary : tokens.textPrimary }}>{plan.name}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: plan.color }}>{plan.price}<span style={{ fontSize: 12, fontWeight: 500 }}>{plan.period}</span></span>
                  </div>
                  <div style={{ fontSize: 12, color: isDark ? tokens.dark.textSecondary : tokens.textSecondary, lineHeight: 1.4 }}>
                    {plan.features.join(' • ')}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {validationErrors.subscriptionPlan && (
            <div style={{ marginTop: 12, fontSize: 12, color: tokens.danger, fontWeight: 500 }}>
              {validationErrors.subscriptionPlan}
            </div>
          )}
        </div>
      );
    }

    // Step 3 (individual) or Step 4 (organization) - Success
    // For individual teachers: activeStep === 3
    // For organizations: activeStep === 4
    const isTeacherSuccess = accountType === 'individual' && activeStep === 3;
    const isOrgSuccess = accountType === 'organization' && activeStep === 4;

    if (isTeacherSuccess || isOrgSuccess) {
      return (
      <div style={{ textAlign: 'center', padding: '20px 0' }}>
        <div style={{
          width: 96, height: 96, borderRadius: '50%',
          background: 'linear-gradient(135deg, #0CBD73 0%, #5AD5A2 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 24px', boxShadow: '0 16px 40px rgba(16,185,129,0.4)',
          animation: 'scaleIn 0.5s ease',
        }}>
          <Icon.Check s={44} />
        </div>
        <h2 style={{ fontWeight: 800, fontSize: 26, letterSpacing: '-0.02em', color: isDark ? tokens.dark.textPrimary : tokens.textPrimary, marginBottom: 10 }}>
          You're all set!
        </h2>
        <p style={{ fontSize: 15, color: isDark ? tokens.dark.textSecondary : tokens.textSecondary, marginBottom: 28, lineHeight: 1.6 }}>
          Your account has been created. Redirecting you to your dashboard...
        </p>
        <button onClick={() => navigate('/login')} style={{
          padding: '12px 28px', borderRadius: 12,
          fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 15,
          background: 'linear-gradient(135deg, #0D406C 0%, #0CBD73 100%)',
          color: 'white', border: 'none', cursor: 'pointer',
          boxShadow: '0 8px 24px rgba(12,189,115,0.35)',
          display: 'inline-flex', alignItems: 'center', gap: 8,
        }}>
          Go to login <Icon.Arrow />
        </button>
      </div>
      );
    }
    return null;
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

      <main style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '12px 24px 24px', position: 'relative', zIndex: 1 }}>
        <div style={{
          width: '100%', maxWidth: 520,
          background: isDark ? tokens.dark.surface : tokens.surface,
          border: `1px solid ${isDark ? tokens.dark.border : tokens.surfaceBorder}`,
          borderRadius: 24, padding: '40px 36px',
          boxShadow: isDark ? '0 32px 64px rgba(0,0,0,0.5)' : '0 32px 64px rgba(15,23,42,0.12)',
          animation: 'fadeInUp 0.6s ease',
        }}>
          {/* Only show header on non-success steps */}
          {activeStep < (accountType === 'organization' ? 4 : 3) && (
            <>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '5px 12px', borderRadius: 100,
                background: isDark ? 'rgba(12,189,115,0.15)' : 'rgba(12,189,115,0.08)',
                border: `1px solid ${isDark ? 'rgba(12,189,115,0.3)' : 'rgba(12,189,115,0.2)'}`,
                marginBottom: 20,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: tokens.success, animation: 'pulse 2s infinite' }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: tokens.accent, letterSpacing: '0.04em' }}>
                  {accountType === 'organization' ? 'Register your organization' : 'Create your teacher account'}
                </span>
              </div>

              <h1 style={{
                fontWeight: 800, fontSize: 30, letterSpacing: '-0.02em', lineHeight: 1.15,
                color: isDark ? tokens.dark.textPrimary : tokens.textPrimary, marginBottom: 8,
              }}>
                Join <span style={{ background: 'linear-gradient(135deg, #0D406C 0%, #5AD5A2 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>eexams</span>
              </h1>
              <p style={{ fontSize: 15, color: isDark ? tokens.dark.textSecondary : tokens.textSecondary, marginBottom: 28, lineHeight: 1.6 }}>
                AI-powered exams for Rwanda's schools and universities.
              </p>

              {/* Progress stepper - dynamic based on account type */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 32 }}>
                {STEPS.slice(0, accountType === 'organization' ? 4 : 3).map((label, i) => {
                  const active = i === activeStep;
                  const completed = i < activeStep;
                  return (
                    <React.Fragment key={i}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 'none' }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: 10,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 700, fontSize: 13,
                          background: completed
                            ? 'linear-gradient(135deg, #0CBD73 0%, #5AD5A2 100%)'
                            : active ? 'linear-gradient(135deg, #0D406C 0%, #0CBD73 100%)' : isDark ? tokens.dark.surfaceAlt : tokens.surfaceAlt,
                          color: active || completed ? 'white' : isDark ? tokens.dark.textSecondary : tokens.textSecondary,
                          border: active || completed ? 'none' : `1.5px solid ${isDark ? tokens.dark.border : tokens.surfaceBorder}`,
                          transition: 'all 0.3s',
                        }}>
                          {completed ? <Icon.Check s={14} /> : i + 1}
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 600, color: active ? (isDark ? tokens.dark.textPrimary : tokens.textPrimary) : isDark ? tokens.dark.textSecondary : tokens.textSecondary }}>
                          {label}
                        </span>
                      </div>
                      {i < (accountType === 'organization' ? 3 : 2) && (
                        <div style={{ flex: 1, height: 2, margin: '0 14px', borderRadius: 2, background: completed || active ? `linear-gradient(90deg, ${tokens.success}, ${tokens.accent})` : isDark ? tokens.dark.border : tokens.surfaceBorder }} />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </>
          )}

          {error && activeStep < (accountType === 'organization' ? 4 : 3) && (
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
            {renderStep()}

            {activeStep < (accountType === 'organization' ? 4 : 3) && (
              <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                {activeStep > 0 && (
                  <button type="button" onClick={handleBack} style={{
                    padding: '13px 22px', borderRadius: 12,
                    fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 14,
                    background: 'none',
                    border: `1.5px solid ${isDark ? tokens.dark.border : tokens.surfaceBorder}`,
                    color: isDark ? tokens.dark.textPrimary : tokens.textPrimary,
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    <Icon.ArrowLeft /> Back
                  </button>
                )}
                {activeStep === 0 && (
                  <button type="button" onClick={handleNext} style={{
                    flex: 1, padding: '14px', borderRadius: 12,
                    fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 15,
                    background: 'linear-gradient(135deg, #0D406C 0%, #0CBD73 100%)',
                    color: 'white', border: 'none', cursor: 'pointer',
                    boxShadow: '0 8px 24px rgba(12,189,115,0.35)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}>
                    Continue <Icon.Arrow />
                  </button>
                )}
                {/* Show next button for steps 1 (profile) and 2 (org info for orgs) */}
                {(activeStep === 1) || (accountType === 'organization' && activeStep === 2) ? (
                  <button type="button" onClick={handleNext} style={{
                    flex: 1, padding: '14px', borderRadius: 12,
                    fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 15,
                    background: 'linear-gradient(135deg, #0D406C 0%, #0CBD73 100%)',
                    color: 'white', border: 'none', cursor: 'pointer',
                    boxShadow: '0 8px 24px rgba(12,189,115,0.35)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}>
                    Continue <Icon.Arrow />
                  </button>
                ) : null}
                {/* Show submit button on final step before success */}
                {(accountType === 'individual' && activeStep === 2) || (accountType === 'organization' && activeStep === 3) ? (
                  <button type="submit" disabled={loading} style={{
                    flex: 1, padding: '14px', borderRadius: 12,
                    fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 15,
                    background: 'linear-gradient(135deg, #0D406C 0%, #0CBD73 100%)',
                    color: 'white', border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.7 : 1,
                    boxShadow: '0 8px 24px rgba(12,189,115,0.35)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}>
                    {loading ? (
                      <>
                        <span style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', animation: 'spin 0.8s linear infinite' }} />
                        Creating account...
                      </>
                    ) : (
                      <>Create account <Icon.Arrow /></>
                    )}
                  </button>
                ) : null}
              </div>
            )}
          </form>

          {activeStep === 0 && (
            <>
              {/* Divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0 18px' }}>
                <div style={{ flex: 1, height: 1, background: isDark ? tokens.dark.border : tokens.surfaceBorder }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: isDark ? tokens.dark.textSecondary : tokens.textSecondary, letterSpacing: '0.06em', textTransform: 'uppercase' }}>or</span>
                <div style={{ flex: 1, height: 1, background: isDark ? tokens.dark.border : tokens.surfaceBorder }} />
              </div>

              {/* Google Sign Up */}
              <div
                ref={googleButtonRef}
                style={{
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'center',
                }}
              />
            </>
          )}

          {/* Show login link during registration steps, not on success */}
          {activeStep < (accountType === 'organization' ? 4 : 3) && (
            <div style={{ marginTop: 24, paddingTop: 20, borderTop: `1px solid ${isDark ? tokens.dark.border : tokens.surfaceBorder}`, textAlign: 'center' }}>
              <span style={{ fontSize: 14, color: isDark ? tokens.dark.textSecondary : tokens.textSecondary }}>
                Already have an account?{' '}
              </span>
              <RouterLink to="/login" style={{ fontSize: 14, fontWeight: 700, color: tokens.accent, textDecoration: 'none' }}>
                Log in
              </RouterLink>
            </div>
          )}
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
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.5);} to { opacity: 1; transform: scale(1);} }
        @keyframes float1 { 0%,100% { transform: translate(0,0);} 50% { transform: translate(12px,-20px);} }
        @keyframes float2 { 0%,100% { transform: translate(0,0);} 50% { transform: translate(-12px,16px);} }
      `}</style>
    </div>
  );
};

export default Register;
