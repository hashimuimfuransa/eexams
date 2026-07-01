import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useThemeMode } from '../context/ThemeContext';
import api from '../services/api';

const tokens = {
  primary: '#0D406C',
  accent: '#0CBD73',
  accentBlue: '#2B7FFF',
  danger: '#ef4444',
  warning: '#F59E0B',
  surface: '#ffffff',
  textPrimary: '#1f2937',
  textSecondary: '#6b7280',
  surfaceAlt: '#f3f4f6',
  border: '#e5e7eb',
  dark: {
    surface: '#0f172a',
    surfaceAlt: '#1e293b',
    surfaceCard: '#243048',
    textPrimary: '#f8fafc',
    textSecondary: '#94a3b8',
    border: '#334155'
  }
};

const INDIVIDUAL_PRICES = {
  free:       { label: 'Free',       rwf: 0,        usd: 0     },
  basic:      { label: 'Basic',      rwf: 100000,   usd: 100   },
  premium:    { label: 'Premium',    rwf: 200000,   usd: 200   },
  enterprise: { label: 'Enterprise', rwf: null,     usd: null  },
};

const ORG_PRICES = {
  free:       { label: 'Free Trial', rwf: 0,        usd: 0     },
  basic:      { label: 'Basic',      rwf: 100000,   usd: 100   },
  premium:    { label: 'Premium',    rwf: 300000,   usd: 300   },
  enterprise: { label: 'Enterprise', rwf: null,     usd: null  },
};

export default function PendingApproval() {
  const { user, logout, setUser } = useAuth();
  const { mode } = useThemeMode();
  const isDark = mode === 'dark';
  const navigate = useNavigate();
  const [checkStatus, setCheckStatus] = useState('idle'); // 'idle' | 'checking' | 'approved'

  const checkApproval = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    setCheckStatus('checking');
    try {
      const res = await api.get('/auth/verify', {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Always refresh identity fields from verify response
      const refreshed = {
        ...user,
        userType: res.data.userType || user?.userType,
        role: res.data.role || user?.role,
        organization: res.data.organization || user?.organization,
        subscriptionPlan: res.data.subscriptionPlan ?? user?.subscriptionPlan,
        subscriptionStatus: res.data.subscriptionStatus,
      };
      localStorage.setItem('user', JSON.stringify(refreshed));
      if (setUser) setUser(refreshed);
      if (res.data.subscriptionStatus === 'active') {
        setCheckStatus('approved');
        setTimeout(() => navigate('/dashboard'), 1500);
      } else {
        setCheckStatus('idle');
      }
    } catch {
      setCheckStatus('idle');
    }
  }, [user, navigate, setUser]);

  useEffect(() => {
    checkApproval();
    const interval = setInterval(checkApproval, 15000);
    return () => clearInterval(interval);
  }, [checkApproval]);

  const plan = user?.subscriptionPlan || 'free';
  // Treat as org if userType is 'organization' OR role is 'admin' (covers stale localStorage)
  const isOrg = user?.userType === 'organization' || user?.role === 'admin';
  const PLAN_PRICES = isOrg ? ORG_PRICES : INDIVIDUAL_PRICES;
  const planInfo = PLAN_PRICES[plan] || PLAN_PRICES.free;
  const isPaid = plan !== 'free' && planInfo.rwf !== 0;
  const isEnterprise = plan === 'enterprise';

  const cardBg = isDark ? tokens.dark.surfaceAlt : tokens.surface;
  const innerCardBg = isDark ? tokens.dark.surfaceCard : '#f8fafc';
  const borderColor = isDark ? tokens.dark.border : tokens.border;
  const textPrimary = isDark ? tokens.dark.textPrimary : tokens.textPrimary;
  const textSecondary = isDark ? tokens.dark.textSecondary : tokens.textSecondary;

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      padding: '32px 16px',
      background: isDark
        ? `radial-gradient(ellipse 80% 50% at 50% -10%, rgba(12,189,115,0.06) 0%, transparent 70%), ${tokens.dark.surface}`
        : `radial-gradient(ellipse 80% 50% at 50% -10%, rgba(12,189,115,0.08) 0%, transparent 70%), #f0f4f8`,
      fontFamily: "'DM Sans', sans-serif"
    }}>
      <div style={{ maxWidth: 560, width: '100%' }}>

        {/* Approved banner — shows when approval is detected before redirect */}
        {checkStatus === 'approved' && (
          <div style={{
            padding: '16px 20px', borderRadius: 14, marginBottom: 16,
            background: 'linear-gradient(135deg, #0CBD73 0%, #059669 100%)',
            color: 'white', textAlign: 'center', fontWeight: 700, fontSize: 16,
            boxShadow: '0 8px 24px rgba(12,189,115,0.4)',
          }}>
            ✅ Your account has been approved! Redirecting to your dashboard...
          </div>
        )}

        {/* Live check status strip */}
        <div style={{
          padding: '8px 16px', borderRadius: 10, marginBottom: 12,
          background: isDark ? tokens.dark.surfaceCard : '#f0fdf4',
          border: `1px solid ${checkStatus === 'checking' ? tokens.accent : borderColor}`,
          display: 'flex', alignItems: 'center', gap: 8,
          transition: 'border-color 0.3s',
        }}>
          <span style={{
            display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
            background: checkStatus === 'checking' ? tokens.accent : checkStatus === 'approved' ? '#0CBD73' : '#94a3b8',
            boxShadow: checkStatus === 'checking' ? `0 0 0 3px rgba(12,189,115,0.25)` : 'none',
            animation: checkStatus === 'checking' ? 'pulse 1.2s ease-in-out infinite' : 'none',
          }}/>
          <span style={{ fontSize: 12, color: textSecondary, fontWeight: 500 }}>
            {checkStatus === 'checking' ? 'Checking approval status...' : 'Auto-checking every 15 seconds'}
          </span>
          <button onClick={checkApproval} style={{
            marginLeft: 'auto', fontSize: 11, fontWeight: 600, cursor: 'pointer',
            padding: '3px 10px', borderRadius: 6, border: `1px solid ${borderColor}`,
            background: 'transparent', color: tokens.accentBlue,
          }}>
            Check now
          </button>
        </div>

        {/* Header card */}
        <div style={{
          padding: '36px 36px 28px',
          borderRadius: 20,
          background: cardBg,
          border: `1px solid ${borderColor}`,
          boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.4)' : '0 8px 32px rgba(15,23,42,0.08)',
          textAlign: 'center',
          marginBottom: 16,
        }}>
          {/* Icon */}
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: `rgba(12,189,115,0.12)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
          }}>
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke={tokens.accent} strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>

          <h1 style={{ fontSize: 24, fontWeight: 800, color: textPrimary, marginBottom: 10, letterSpacing: '-0.02em' }}>
            Account Pending Approval
          </h1>

          <p style={{ fontSize: 15, color: textSecondary, lineHeight: 1.65, marginBottom: 20 }}>
            Thank you for choosing the{' '}
            <strong style={{ color: textPrimary }}>{planInfo.label}</strong> plan.
            {isPaid && !isEnterprise
              ? ' Pay below to activate your account instantly.'
              : isEnterprise
                ? ' Our team will reach out shortly to set up your custom package.'
                : ' Your account is currently under review by our team and will be activated shortly.'}
          </p>

          {/* Status badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: isDark ? 'rgba(12,189,115,0.1)' : 'rgba(12,189,115,0.07)',
            border: `1px solid rgba(12,189,115,0.25)`,
            borderRadius: 100, padding: '6px 16px',
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: tokens.accent, display: 'inline-block' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: tokens.accent }}>
              {isPaid && !isEnterprise ? 'Status: Awaiting Payment' : 'Status: Pending Approval — allow 1-2 business days'}
            </span>
          </div>
        </div>

        {/* Pay Now — activates automatically via mobile money/Airtel/card, no
            manual bank transfer or proof-of-payment review needed anymore */}
        {isPaid && !isEnterprise && (
          <div style={{
            borderRadius: 20,
            background: 'linear-gradient(135deg, #0D406C 0%, #0CBD73 100%)',
            padding: '20px 24px',
            marginBottom: 16,
            textAlign: 'center',
            boxShadow: '0 8px 24px rgba(12,189,115,0.3)',
          }}>
            <p style={{ fontSize: 22, fontWeight: 800, color: 'white', marginBottom: 4 }}>
              {planInfo.rwf?.toLocaleString()} RWF
              <span style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.8)', marginLeft: 6 }}>
                (~${planInfo.usd}/mo)
              </span>
            </p>
            <p style={{ fontSize: 14, color: 'white', marginBottom: 12, fontWeight: 500 }}>
              Pay instantly with Mobile Money, Airtel Money, or Card — your account activates automatically.
            </p>
            <button
              onClick={() => navigate(isOrg ? '/organization/subscription' : '/individual/subscription')}
              style={{
                padding: '13px 32px', borderRadius: 12, border: 'none',
                background: 'white', color: tokens.primary, fontSize: 15, fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Pay Now
            </button>
          </div>
        )}

        {/* Enterprise contact card */}
        {isEnterprise && (
          <div style={{
            borderRadius: 20, background: cardBg, border: `1px solid ${borderColor}`,
            boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.3)' : '0 8px 32px rgba(15,23,42,0.07)',
            padding: '20px 24px', marginBottom: 16,
          }}>
            <p style={{ fontSize: 14, color: textSecondary, lineHeight: 1.6 }}>
              For <strong style={{ color: textPrimary }}>Enterprise</strong> pricing, our team will contact you directly to discuss a custom package.
              You can also reach us at{' '}
              <a href="mailto:info@excellencecoachinghub.com" style={{ color: tokens.accentBlue, fontWeight: 600, textDecoration: 'none' }}>info@excellencecoachinghub.com</a>
              {' '}or call{' '}
              <a href="tel:+250781671517" style={{ color: tokens.accentBlue, fontWeight: 600, textDecoration: 'none' }}>+250 781 671 517</a>
              {' '}·{' '}
              <a href="tel:+250793828834" style={{ color: tokens.accentBlue, fontWeight: 600, textDecoration: 'none' }}>+250 793 828 834</a>
              {' '}·{' '}
              <a href="tel:0788535156" style={{ color: tokens.accentBlue, fontWeight: 600, textDecoration: 'none' }}>0788 535 156</a>.
            </p>
          </div>
        )}

        {/* Sign out + support */}
        <div style={{
          borderRadius: 20, background: cardBg, border: `1px solid ${borderColor}`,
          boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.3)' : '0 8px 32px rgba(15,23,42,0.07)',
          padding: '20px 24px', textAlign: 'center',
        }}>
          <button
            onClick={logout}
            style={{
              width: '100%', padding: '13px 24px', borderRadius: 12,
              border: `1.5px solid ${borderColor}`,
              background: 'transparent',
              color: textPrimary, fontSize: 15, fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.2s', marginBottom: 16,
            }}
          >
            Sign Out
          </button>
          <p style={{ fontSize: 13, color: textSecondary }}>
            Need help?{' '}
            <a href="mailto:info@excellencecoachinghub.com" style={{ color: tokens.accentBlue, textDecoration: 'none', fontWeight: 600 }}>info@excellencecoachinghub.com</a>
            {' '}·{' '}
            <a href="tel:+250781671517" style={{ color: tokens.accentBlue, textDecoration: 'none', fontWeight: 600 }}>+250 781 671 517</a>
            {' '}·{' '}
            <a href="tel:0788535156" style={{ color: tokens.accentBlue, textDecoration: 'none', fontWeight: 600 }}>0788 535 156</a>
          </p>
        </div>

      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
      `}</style>
    </div>
  );
}
