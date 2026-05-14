import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useThemeMode } from '../context/ThemeContext';
import api from '../services/api';

const tokens = {
  primary: '#0A3675',
  accent: '#2B7FFF',
  accentGlow: 'rgba(43, 127, 255, 0.15)',
  danger: '#ef4444',
  success: '#10b981',
  surface: '#ffffff',
  textPrimary: '#1f2937',
  textSecondary: '#6b7280',
  surfaceAlt: '#f3f4f6',
  surfaceBorder: '#e5e7eb',
  dark: {
    surface: '#0f172a',
    surfaceAlt: '#1e293b',
    surface: '#0B1121',
    textPrimary: '#f8fafc',
    textSecondary: '#94a3b8',
    border: '#334155'
  }
};

// Add spinner animation styles
const spinnerStyles = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;

const PLANS = [
  {
    id: 'free',
    name: 'Free Plan',
    price: 'Free',
    description: 'Perfect for individual teachers getting started',
    features: ['Create up to 5 exams', 'Basic analytics', 'Email support']
  },
  {
    id: 'basic',
    name: 'Basic Plan',
    price: '9,000 RWF/month',
    description: 'For growing educators with more needs',
    features: ['Up to 30 exams', 'Advanced analytics', 'Priority support', 'AI features']
  },
  {
    id: 'premium',
    name: 'Premium Plan',
    price: '29,000 RWF/month',
    description: 'Best for schools and institutions',
    features: ['Unlimited exams', 'Everything in Basic', 'Advanced AI', 'Priority support']
  },
  {
    id: 'enterprise',
    name: 'Enterprise Plan',
    price: 'Custom Pricing',
    description: 'For large institutions & multi-school systems',
    features: ['Everything in Premium', 'Unlimited teachers', 'White-label & custom branding', 'Full API access', 'Dedicated account manager', 'Custom integrations', 'SLA guarantee', 'On-premise option', 'Bulk student import', 'Multi-school management']
  }
];

export default function CompleteRegistration() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const { mode } = useThemeMode();
  const isDark = mode === 'dark';

  const [accountType, setAccountType] = useState('individual');
  const [selectedPlan, setSelectedPlan] = useState('free');
  const [organization, setOrganization] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1);

  // Check if user already has complete registration
  useEffect(() => {
    if (user?.subscriptionPlan) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleSubmit = async () => {
    setLoading(true);
    setError('');

    try {
      const updateData = {
        accountType,
        subscriptionPlan: selectedPlan,
        phone: phone || user?.phone || ''
      };

      if (accountType === 'organization') {
        if (!organization.trim()) {
          setError('Organization name is required');
          setLoading(false);
          return;
        }
        updateData.organization = organization;
      }

      // Update user profile
      const response = await api.put('/auth/profile', updateData);

      if (response.data) {
        // Update local user state
        const updatedUser = {
          ...user,
          ...response.data,
          subscriptionPlan: selectedPlan,
          subscriptionStatus: selectedPlan === 'free' ? 'active' : 'pending'
        };

        localStorage.setItem('user', JSON.stringify(updatedUser));
        setUser(updatedUser);

        // Redirect based on plan type
        if (selectedPlan === 'free') {
          navigate('/dashboard');
        } else {
          navigate('/pending-approval');
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to complete registration');
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
    <>
      <h2 style={{
        fontSize: '20px',
        fontWeight: 700,
        color: isDark ? tokens.dark.textPrimary : tokens.textPrimary,
        marginBottom: '8px'
      }}>
        Choose Account Type
      </h2>
      <p style={{
        fontSize: '14px',
        color: isDark ? tokens.dark.textSecondary : tokens.textSecondary,
        marginBottom: '24px'
      }}>
        Select how you will be using eexams
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
        {/* Individual Option */}
        <div
          onClick={() => setAccountType('individual')}
          style={{
            padding: '20px',
            borderRadius: '12px',
            border: `2px solid ${accountType === 'individual' ? tokens.accent : isDark ? tokens.dark.border : tokens.surfaceBorder}`,
            background: accountType === 'individual' ? `${tokens.accent}10` : isDark ? tokens.dark.surfaceAlt : tokens.surfaceAlt,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '16px'
          }}
        >
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
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
            <div style={{ fontSize: '16px', fontWeight: 700, color: isDark ? tokens.dark.textPrimary : tokens.textPrimary, marginBottom: '4px' }}>
              Individual Teacher
            </div>
            <div style={{ fontSize: '13px', color: isDark ? tokens.dark.textSecondary : tokens.textSecondary }}>
              Perfect for individual educators creating and managing exams
            </div>
          </div>
        </div>

        {/* Organization Option */}
        <div
          onClick={() => setAccountType('organization')}
          style={{
            padding: '20px',
            borderRadius: '12px',
            border: `2px solid ${accountType === 'organization' ? tokens.primary : isDark ? tokens.dark.border : tokens.surfaceBorder}`,
            background: accountType === 'organization' ? 'rgba(10, 54, 117, 0.1)' : isDark ? tokens.dark.surfaceAlt : tokens.surfaceAlt,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '16px'
          }}
        >
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: accountType === 'organization' ? tokens.primary : isDark ? tokens.dark.surface : tokens.surface,
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
            <div style={{ fontSize: '16px', fontWeight: 700, color: isDark ? tokens.dark.textPrimary : tokens.textPrimary, marginBottom: '4px' }}>
              Organization / School
            </div>
            <div style={{ fontSize: '13px', color: isDark ? tokens.dark.textSecondary : tokens.textSecondary }}>
              For schools, institutions, and organizations with multiple teachers
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={() => setStep(2)}
        style={{
          width: '100%',
          padding: '14px 24px',
          borderRadius: '12px',
          border: 'none',
          background: tokens.accent,
          color: 'white',
          fontSize: '15px',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.2s'
        }}
      >
        Continue
      </button>
    </>
  );

  const renderStep2 = () => (
    <>
      <h2 style={{
        fontSize: '20px',
        fontWeight: 700,
        color: isDark ? tokens.dark.textPrimary : tokens.textPrimary,
        marginBottom: '8px'
      }}>
        {accountType === 'organization' ? 'Organization Details' : 'Complete Profile'}
      </h2>
      <p style={{
        fontSize: '14px',
        color: isDark ? tokens.dark.textSecondary : tokens.textSecondary,
        marginBottom: '24px'
      }}>
        {accountType === 'organization' ? 'Enter your organization details' : 'Add your contact information'}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
        {accountType === 'organization' && (
          <div>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 600,
              color: isDark ? tokens.dark.textPrimary : tokens.textPrimary,
              marginBottom: '6px'
            }}>
              Organization Name *
            </label>
            <input
              type="text"
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
              placeholder="Enter organization or school name"
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '12px',
                border: `1.5px solid ${isDark ? tokens.dark.border : tokens.surfaceBorder}`,
                background: isDark ? tokens.dark.surfaceAlt : tokens.surfaceAlt,
                color: isDark ? tokens.dark.textPrimary : tokens.textPrimary,
                fontSize: '15px',
                outline: 'none'
              }}
            />
          </div>
        )}

        <div>
          <label style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: 600,
            color: isDark ? tokens.dark.textPrimary : tokens.textPrimary,
            marginBottom: '6px'
          }}>
            Phone Number (Optional)
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Enter your phone number"
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: '12px',
              border: `1.5px solid ${isDark ? tokens.dark.border : tokens.surfaceBorder}`,
              background: isDark ? tokens.dark.surfaceAlt : tokens.surfaceAlt,
              color: isDark ? tokens.dark.textPrimary : tokens.textPrimary,
              fontSize: '15px',
              outline: 'none'
            }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          onClick={() => setStep(1)}
          style={{
            flex: 1,
            padding: '14px 24px',
            borderRadius: '12px',
            border: `1.5px solid ${isDark ? tokens.dark.border : tokens.surfaceBorder}`,
            background: 'transparent',
            color: isDark ? tokens.dark.textPrimary : tokens.textPrimary,
            fontSize: '15px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          Back
        </button>
        <button
          onClick={() => setStep(3)}
          style={{
            flex: 1,
            padding: '14px 24px',
            borderRadius: '12px',
            border: 'none',
            background: tokens.accent,
            color: 'white',
            fontSize: '15px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          Continue
        </button>
      </div>
    </>
  );

  const renderStep3 = () => (
    <>
      <h2 style={{
        fontSize: '20px',
        fontWeight: 700,
        color: isDark ? tokens.dark.textPrimary : tokens.textPrimary,
        marginBottom: '8px'
      }}>
        Select Your Plan
      </h2>
      <p style={{
        fontSize: '14px',
        color: isDark ? tokens.dark.textSecondary : tokens.textSecondary,
        marginBottom: '24px'
      }}>
        Choose the plan that best fits your needs
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            onClick={() => setSelectedPlan(plan.id)}
            style={{
              padding: '20px',
              borderRadius: '12px',
              border: `2px solid ${selectedPlan === plan.id ? tokens.accent : isDark ? tokens.dark.border : tokens.surfaceBorder}`,
              background: selectedPlan === plan.id ? `${tokens.accent}10` : isDark ? tokens.dark.surfaceAlt : tokens.surfaceAlt,
              cursor: 'pointer'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '16px', fontWeight: 700, color: isDark ? tokens.dark.textPrimary : tokens.textPrimary }}>
                {plan.name}
              </span>
              <span style={{ fontSize: '18px', fontWeight: 700, color: tokens.accent }}>
                {plan.price}
              </span>
            </div>
            <p style={{ fontSize: '13px', color: isDark ? tokens.dark.textSecondary : tokens.textSecondary, marginBottom: '12px' }}>
              {plan.description}
            </p>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {plan.features.map((feature, idx) => (
                <li key={idx} style={{
                  fontSize: '13px',
                  color: isDark ? tokens.dark.textSecondary : tokens.textSecondary,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '4px'
                }}>
                  <span style={{ color: tokens.success }}>✓</span> {feature}
                </li>
              ))}
            </ul>
            {plan.id !== 'free' && (
              <div style={{
                marginTop: '12px',
                padding: '8px 12px',
                background: 'rgba(239, 68, 68, 0.1)',
                borderRadius: '8px',
                fontSize: '12px',
                color: tokens.danger,
                textAlign: 'center'
              }}>
                ⚠ Requires admin approval before accessing dashboard
              </div>
            )}
          </div>
        ))}
      </div>

      {error && (
        <div style={{
          padding: '12px',
          borderRadius: '8px',
          background: 'rgba(239, 68, 68, 0.1)',
          color: tokens.danger,
          fontSize: '14px',
          marginBottom: '16px'
        }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          onClick={() => setStep(2)}
          disabled={loading}
          style={{
            flex: 1,
            padding: '14px 24px',
            borderRadius: '12px',
            border: `1.5px solid ${isDark ? tokens.dark.border : tokens.surfaceBorder}`,
            background: 'transparent',
            color: isDark ? tokens.dark.textPrimary : tokens.textPrimary,
            fontSize: '15px',
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1
          }}
        >
          Back
        </button>
        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            flex: 1,
            padding: '14px 24px',
            borderRadius: '12px',
            border: 'none',
            background: tokens.accent,
            color: 'white',
            fontSize: '15px',
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          {loading ? (
            <>
              <span style={{ width: '16px', height: '16px', border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              Processing...
            </>
          ) : (
            'Complete Registration'
          )}
        </button>
      </div>
    </>
  );

  return (
    <>
      <style>{spinnerStyles}</style>
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
        maxWidth: '520px',
        width: '100%',
        padding: '32px',
        borderRadius: '16px',
        background: isDark ? tokens.dark.surfaceAlt : tokens.surface,
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)'
      }}>
        {/* Progress indicator */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              style={{
                flex: 1,
                height: '4px',
                borderRadius: '2px',
                background: s <= step ? tokens.accent : isDark ? tokens.dark.border : tokens.surfaceBorder,
                transition: 'background 0.3s'
              }}
            />
          ))}
        </div>

        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
      </div>
    </div>
    </>
  );
}
