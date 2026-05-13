import { useAuth } from '../context/AuthContext';
import { useThemeMode } from '../context/ThemeContext';

const tokens = {
  primary: '#0A3675',
  accent: '#2B7FFF',
  danger: '#ef4444',
  surface: '#ffffff',
  textPrimary: '#1f2937',
  textSecondary: '#6b7280',
  surfaceAlt: '#f3f4f6',
  dark: {
    surface: '#0f172a',
    surfaceAlt: '#1e293b',
    textPrimary: '#f8fafc',
    textSecondary: '#94a3b8',
    border: '#334155'
  }
};

export default function PendingApproval() {
  const { user, logout } = useAuth();
  const { mode } = useThemeMode();
  const isDark = mode === 'dark';

  const handleLogout = () => {
    logout();
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      background: isDark ? tokens.dark.surface : tokens.surfaceAlt,
      fontFamily: "'DM Sans', sans-serif"
    }}>
      <div style={{
        maxWidth: '480px',
        width: '100%',
        padding: '40px',
        borderRadius: '16px',
        background: isDark ? tokens.dark.surfaceAlt : tokens.surface,
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
        textAlign: 'center'
      }}>
        {/* Clock Icon */}
        <div style={{
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          background: 'rgba(43, 127, 255, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px'
        }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={tokens.accent} strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>

        <h1 style={{
          fontSize: '24px',
          fontWeight: 700,
          color: isDark ? tokens.dark.textPrimary : tokens.textPrimary,
          marginBottom: '12px'
        }}>
          Account Pending Approval
        </h1>

        <p style={{
          fontSize: '15px',
          color: isDark ? tokens.dark.textSecondary : tokens.textSecondary,
          lineHeight: 1.6,
          marginBottom: '24px'
        }}>
          Thank you for choosing the <strong>{user?.subscriptionPlan || 'paid'}</strong> plan.
          Your account is currently under review by our team.
          You will receive an email notification once your account is approved.
        </p>

        <div style={{
          background: isDark ? 'rgba(43, 127, 255, 0.1)' : 'rgba(43, 127, 255, 0.05)',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '24px'
        }}>
          <div style={{
            fontSize: '14px',
            fontWeight: 600,
            color: tokens.accent,
            marginBottom: '4px'
          }}>
            Status: Pending Approval
          </div>
          <div style={{
            fontSize: '13px',
            color: isDark ? tokens.dark.textSecondary : tokens.textSecondary
          }}>
            Please allow 1-2 business days for processing
          </div>
        </div>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <button
            onClick={handleLogout}
            style={{
              padding: '14px 24px',
              borderRadius: '12px',
              border: `1.5px solid ${isDark ? tokens.dark.border : '#e5e7eb'}`,
              background: 'transparent',
              color: isDark ? tokens.dark.textPrimary : tokens.textPrimary,
              fontSize: '15px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            Sign Out
          </button>
        </div>

        <p style={{
          fontSize: '13px',
          color: isDark ? tokens.dark.textSecondary : tokens.textSecondary,
          marginTop: '24px'
        }}>
          Need help? Contact support at <a href="mailto:support@eexams.rw" style={{ color: tokens.accent, textDecoration: 'none' }}>support@eexams.rw</a>
        </p>
      </div>
    </div>
  );
}
