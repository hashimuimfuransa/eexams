import React, { useState, useEffect, useContext } from 'react';
import {
  Container,
  Grid,
  Paper,
  Typography,
  Box,
  Button,
  TextField,
  Avatar,
  Divider,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Alert,
  Snackbar,
  IconButton,
  InputAdornment,
  Grow,
  Fade,
  useTheme,
  alpha,
  Zoom,
  LinearProgress
} from '@mui/material';
import {
  Person,
  Email,
  School,
  Edit,
  Save,
  Cancel,
  Visibility,
  VisibilityOff,
  Business,
  Class as ClassIcon,
  WorkspacePremium,
  Verified,
  Warning,
  ArrowForward,
  CheckCircle,
  CalendarMonth,
  CreditCard,
  Loop,
  ShoppingCart,
  Download
} from '@mui/icons-material';
import { AuthContext } from '../../context/AuthContext';
import api from '../../services/api';
import StudentLayout from './StudentLayout';

// ─── Student Subscription Section ────────────────────────────────────────────
const StudentSubscriptionSection = ({ subscription, subscriptionLoading, user }) => {
  const now = new Date();
  const [downloadingInvoice, setDownloadingInvoice] = useState(false);

  const getDaysLeft = (expiresAt) => {
    if (!expiresAt) return null;
    const diff = new Date(expiresAt) - now;
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const handleDownloadInvoice = async () => {
    if (!subscription?._id) return;
    try {
      setDownloadingInvoice(true);
      const response = await api.get(`/subscriptions/${subscription._id}/invoice`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `invoice-${subscription._id.slice(-8)}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading invoice:', err);
      alert('Failed to download invoice. Please try again.');
    } finally {
      setDownloadingInvoice(false);
    }
  };

  const statusMeta = {
    active:    { color: '#10B981', bg: '#F0FDF4', border: '#BBF7D0', label: 'Active' },
    expired:   { color: '#EF4444', bg: '#FEF2F2', border: '#FECACA', label: 'Expired' },
    cancelled: { color: '#6B7280', bg: '#F9FAFB', border: '#E5E7EB', label: 'Cancelled' },
    pending:   { color: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A', label: 'Pending' },
  };

  if (subscriptionLoading) {
    return (
      <Box sx={{ p: 3, borderRadius: 2, bgcolor: 'white', border: '1px solid #E2E8F0', display: 'flex', justifyContent: 'center' }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (!subscription) {
    return (
      <Box sx={{ p: 3, borderRadius: 2, bgcolor: '#FFFBEB', border: '1px solid #FDE68A', display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <CreditCard sx={{ color: '#D97706', fontSize: 28 }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography fontWeight={700} sx={{ color: '#92400E' }}>No Active Subscription</Typography>
          <Typography variant="body2" sx={{ color: '#78350F', fontSize: 13 }}>
            Subscribe to a plan to unlock exams for your level.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<ShoppingCart />}
          href="/marketplace"
          sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, bgcolor: '#D97706', '&:hover': { bgcolor: '#B45309' }, flexShrink: 0 }}
        >
          Browse Plans
        </Button>
      </Box>
    );
  }

  const meta = statusMeta[subscription.status] || statusMeta.pending;
  const daysLeft = getDaysLeft(subscription.expiresAt);
  const daysColor = daysLeft === null ? '#6B7280' : daysLeft <= 7 ? '#EF4444' : daysLeft <= 30 ? '#F59E0B' : '#10B981';
  const levelLabel = subscription.level?.name || '—';
  const subLevelLabel = subscription.subLevel ? ` · ${subscription.subLevel}` : '';

  return (
    <Box
      sx={{
        p: 3,
        borderRadius: 3,
        bgcolor: 'white',
        border: '1px solid #E2E8F0',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2.5, flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="h6" fontWeight={700} sx={{ color: '#1E293B' }}>
            Subscription Plan
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748B', mt: 0.25 }}>
            Your current learning subscription
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Chip
            label={meta.label}
            size="small"
            sx={{ bgcolor: meta.bg, color: meta.color, border: `1px solid ${meta.border}`, fontWeight: 700, fontSize: 12 }}
          />
          <Button
            size="small"
            variant="outlined"
            onClick={handleDownloadInvoice}
            disabled={downloadingInvoice}
            startIcon={downloadingInvoice ? <CircularProgress size={14} /> : <Download sx={{ fontSize: 16 }} />}
            sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, fontSize: 12, borderColor: '#CBD5E1', color: '#334155' }}
          >
            {downloadingInvoice ? 'Preparing…' : 'Invoice'}
          </Button>
        </Box>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 2 }}>
        {/* Plan name */}
        <Box sx={{ p: 2, borderRadius: 2, bgcolor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <WorkspacePremium sx={{ fontSize: 16, color: '#6366F1' }} />
            <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600 }}>PLAN</Typography>
          </Box>
          <Typography fontWeight={700} sx={{ color: '#1E293B', fontSize: 15 }}>
            {subscription.plan?.name || '—'}
          </Typography>
        </Box>

        {/* Level coverage */}
        <Box sx={{ p: 2, borderRadius: 2, bgcolor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <School sx={{ fontSize: 16, color: '#3B82F6' }} />
            <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600 }}>COVERS</Typography>
          </Box>
          <Typography fontWeight={700} sx={{ color: '#1E293B', fontSize: 15 }}>
            {levelLabel}{subLevelLabel}
          </Typography>
        </Box>

        {/* Expiry / days left */}
        <Box sx={{ p: 2, borderRadius: 2, bgcolor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <CalendarMonth sx={{ fontSize: 16, color: daysColor }} />
            <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600 }}>EXPIRES</Typography>
          </Box>
          {daysLeft !== null ? (
            <>
              <Typography fontWeight={700} sx={{ color: daysColor, fontSize: 15 }}>
                {daysLeft} day{daysLeft !== 1 ? 's' : ''} left
              </Typography>
              <Typography variant="caption" sx={{ color: '#94A3B8' }}>
                {new Date(subscription.expiresAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
              </Typography>
            </>
          ) : (
            <Typography fontWeight={700} sx={{ color: '#6B7280', fontSize: 15 }}>Never</Typography>
          )}
        </Box>
      </Box>

      {daysLeft !== null && daysLeft <= 14 && subscription.status === 'active' && (
        <Box sx={{ mt: 2, p: 1.5, borderRadius: 2, bgcolor: daysLeft <= 7 ? '#FEF2F2' : '#FFFBEB', border: `1px solid ${daysLeft <= 7 ? '#FECACA' : '#FDE68A'}`, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Warning sx={{ color: daysLeft <= 7 ? '#EF4444' : '#D97706', fontSize: 18, flexShrink: 0 }} />
          <Typography variant="body2" sx={{ color: daysLeft <= 7 ? '#991B1B' : '#92400E', flex: 1, fontSize: 13 }}>
            {daysLeft <= 7 ? 'Your subscription expires very soon!' : 'Less than 2 weeks left on your subscription.'}
          </Typography>
          <Button
            size="small"
            variant="outlined"
            startIcon={<Loop />}
            href="/marketplace"
            sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, fontSize: 12, borderColor: daysLeft <= 7 ? '#EF4444' : '#D97706', color: daysLeft <= 7 ? '#EF4444' : '#D97706', flexShrink: 0 }}
          >
            Renew
          </Button>
        </Box>
      )}
    </Box>
  );
};

// ─── Level Section (inline in the sidebar card) ───────────────────────────────
const LevelSection = ({
  user, levels, selectedLevel, setSelectedLevel,
  selectedSubLevel, setSelectedSubLevel, availableSubLevels,
  levelChangeMode, setLevelChangeMode, levelChangeStep, setLevelChangeStep,
  levelChangeWarning, setLevelChangeWarning, changingLevel, handleLevelChange, theme
}) => {
  const levelColors = [
    { bg: '#EFF6FF', border: '#BFDBFE', icon: '#3B82F6', text: '#1E40AF' },
    { bg: '#F0FDF4', border: '#BBF7D0', icon: '#22C55E', text: '#166534' },
    { bg: '#FFF7ED', border: '#FED7AA', icon: '#F97316', text: '#9A3412' },
    { bg: '#FAF5FF', border: '#E9D5FF', icon: '#A855F7', text: '#6B21A8' },
  ];
  const selectedLevelObj = levels.find(l => l._id === selectedLevel);
  const hasSubLevels = availableSubLevels.length > 0;

  const cancelChange = () => {
    setLevelChangeMode(false);
    setLevelChangeStep(0);
    setLevelChangeWarning(null);
    setSelectedLevel(user?.level?._id || '');
    setSelectedSubLevel(user?.subLevel || '');
  };

  return (
    <Box sx={{ mb: 2, p: 2, borderRadius: 3, background: `linear-gradient(135deg, ${alpha(theme.palette.info.main, 0.05)}, ${alpha(theme.palette.info.light, 0.03)})`, border: `1px solid ${alpha(theme.palette.info.main, 0.15)}` }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: levelChangeMode ? 2 : 0 }}>
        <Avatar sx={{ width: 36, height: 36, bgcolor: theme.palette.info.main, mr: 1.5, boxShadow: `0 4px 12px ${alpha(theme.palette.info.main, 0.3)}` }}>
          <School sx={{ fontSize: '1rem' }} />
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, fontSize: 11 }}>
            LEARNING LEVEL
          </Typography>
          <Typography variant="body1" fontWeight="bold" color="info.main" sx={{ fontSize: 14 }}>
            {user?.level?.name || 'Not selected'}
            {user?.subLevel ? <Box component="span" sx={{ color: 'text.secondary', fontWeight: 400 }}> · {user.subLevel}</Box> : ''}
          </Typography>
        </Box>
        {!levelChangeMode ? (
          <Button
            size="small"
            onClick={() => { setLevelChangeMode(true); setLevelChangeStep(0); }}
            startIcon={<Edit />}
            sx={{ ml: 1, textTransform: 'none', fontSize: 12, fontWeight: 600 }}
          >
            Change
          </Button>
        ) : (
          <Button size="small" onClick={cancelChange} sx={{ ml: 1, textTransform: 'none', fontSize: 12 }}>
            Cancel
          </Button>
        )}
      </Box>

      {levelChangeMode && (
        <Box>
          {/* Step 0: Pick level */}
          {levelChangeStep === 0 && (
            <Box>
              <Typography variant="body2" sx={{ color: '#64748B', mb: 1.5, fontSize: 12 }}>
                Select your education level:
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {levels.map((level, idx) => {
                  const color = levelColors[idx % levelColors.length];
                  const isSelected = selectedLevel === level._id;
                  return (
                    <Box
                      key={level._id}
                      onClick={() => { setSelectedLevel(level._id); setSelectedSubLevel(''); }}
                      sx={{
                        p: 1.5,
                        borderRadius: 2,
                        border: `2px solid ${isSelected ? color.icon : '#E2E8F0'}`,
                        bgcolor: isSelected ? color.bg : 'white',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        transition: 'all 0.15s ease',
                        '&:hover': { border: `2px solid ${color.icon}`, bgcolor: color.bg }
                      }}
                    >
                      <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: isSelected ? color.icon : '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <School sx={{ fontSize: 14, color: isSelected ? 'white' : '#94A3B8' }} />
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography fontWeight={700} sx={{ color: isSelected ? color.text : '#1E293B', fontSize: 13 }}>
                          {level.name}
                        </Typography>
                        {level.description && (
                          <Typography variant="caption" sx={{ color: isSelected ? color.text : '#64748B', opacity: 0.8 }}>
                            {level.description}
                          </Typography>
                        )}
                      </Box>
                      {isSelected && <CheckCircle sx={{ color: color.icon, fontSize: 16, flexShrink: 0 }} />}
                    </Box>
                  );
                })}
              </Box>
              <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  variant="contained"
                  size="small"
                  disabled={!selectedLevel || changingLevel}
                  onClick={() => {
                    if (hasSubLevels) {
                      setLevelChangeStep(1);
                    } else {
                      handleLevelChange(false);
                    }
                  }}
                  sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, fontSize: 12 }}
                >
                  {hasSubLevels ? 'Next' : (changingLevel ? 'Saving…' : 'Save Level')}
                </Button>
              </Box>
            </Box>
          )}

          {/* Step 1: Pick sub-level */}
          {levelChangeStep === 1 && (
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <Button size="small" onClick={() => setLevelChangeStep(0)} sx={{ textTransform: 'none', fontSize: 12, p: 0.5 }}>
                  ← Back
                </Button>
                <Typography variant="body2" sx={{ color: '#64748B', fontSize: 12 }}>
                  Choose your sub-level within <strong>{selectedLevelObj?.name}</strong>:
                </Typography>
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1 }}>
                {availableSubLevels.map((sub, idx) => {
                  const isSelected = selectedSubLevel === sub.name;
                  return (
                    <Box
                      key={sub._id}
                      onClick={() => setSelectedSubLevel(sub.name)}
                      sx={{
                        p: 1.5,
                        borderRadius: 2,
                        border: `2px solid ${isSelected ? '#3B82F6' : '#E2E8F0'}`,
                        bgcolor: isSelected ? '#EFF6FF' : 'white',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        transition: 'all 0.15s ease',
                        '&:hover': { border: '2px solid #3B82F6', bgcolor: '#EFF6FF' }
                      }}
                    >
                      <Box sx={{ width: 22, height: 22, borderRadius: '50%', bgcolor: isSelected ? '#3B82F6' : '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Typography sx={{ fontSize: 10, fontWeight: 700, color: isSelected ? 'white' : '#64748B' }}>{idx + 1}</Typography>
                      </Box>
                      <Typography sx={{ fontSize: 12, fontWeight: isSelected ? 700 : 500, color: isSelected ? '#1E40AF' : '#1E293B', flex: 1 }}>
                        {sub.name}
                      </Typography>
                      {isSelected && <CheckCircle sx={{ color: '#3B82F6', fontSize: 14, flexShrink: 0 }} />}
                    </Box>
                  );
                })}
              </Box>
              <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  variant="contained"
                  size="small"
                  disabled={!selectedSubLevel || changingLevel}
                  onClick={() => handleLevelChange(false)}
                  sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, fontSize: 12 }}
                >
                  {changingLevel ? 'Saving…' : 'Save Level'}
                </Button>
              </Box>
            </Box>
          )}

          {/* Warning: will cancel active subscription */}
          {levelChangeWarning && (
            <Alert
              severity="warning"
              sx={{ mt: 2 }}
              action={
                <Button color="inherit" size="small" onClick={() => handleLevelChange(true)} disabled={changingLevel}>
                  Confirm
                </Button>
              }
            >
              <Typography variant="body2" fontWeight="bold">{levelChangeWarning.message}</Typography>
              <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                Current: {levelChangeWarning.currentLevel} · Expires: {new Date(levelChangeWarning.currentSubscriptionExpiry).toLocaleDateString()}
              </Typography>
            </Alert>
          )}
        </Box>
      )}
    </Box>
  );
};

const Profile = () => {
  const theme = useTheme();
  const { user, updateUserProfile, updateUserLevel } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });
  const [levels, setLevels] = useState([]);
  const [selectedLevel, setSelectedLevel] = useState('');
  const [selectedSubLevel, setSelectedSubLevel] = useState('');
  const [levelChangeMode, setLevelChangeMode] = useState(false);
  const [levelChangeStep, setLevelChangeStep] = useState(0); // 0=pick level, 1=pick sub-level
  const [levelChangeWarning, setLevelChangeWarning] = useState(null);
  const [changingLevel, setChangingLevel] = useState(false);
  const [subscription, setSubscription] = useState(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);

  const selectedLevelObj = levels.find(l => l._id === selectedLevel);
  const availableSubLevels = (selectedLevelObj?.subLevels || []).filter(s => s.isActive);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    currentPassword: '',
    class: '',
    organization: ''
  });

  useEffect(() => {
    if (user) {
      setFormData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        password: '',
        currentPassword: '',
        class: user.class || '',
        organization: user.organization || ''
      });
      setSelectedLevel(user.level?._id || '');
      setSelectedSubLevel(user.subLevel || '');
    }
  }, [user]);

  const fetchLevels = async () => {
    try {
      const response = await api.get('/levels');
      setLevels(response.data || []);
    } catch (err) {
      console.error('Error fetching levels:', err);
    }
  };

  useEffect(() => {
    fetchLevels();
    fetchSubscription();
  }, []);

  const fetchSubscription = async () => {
    try {
      setSubscriptionLoading(true);
      const res = await api.get('/subscriptions/my/active');
      setSubscription(res.data);
    } catch {
      setSubscription(null);
    } finally {
      setSubscriptionLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleToggleEditMode = () => {
    setEditMode(!editMode);
    if (editMode) {
      // Reset form data when canceling edit
      setFormData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        password: '',
        currentPassword: '',
        class: user.class || '',
        organization: user.organization || ''
      });
    }
  };

  const handleToggleShowPassword = () => {
    setShowPassword(!showPassword);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Prepare data for API
      const updateData = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        class: formData.class,
        organization: formData.organization
      };

      // Update profile information
      const profileResponse = await api.put('/profile', updateData);
      
      // Update local user data
      updateUserProfile(profileResponse.data);

      // If password was changed, update password separately
      if (formData.password) {
        await api.put('/auth/change-password', {
          currentPassword: formData.currentPassword,
          newPassword: formData.password
        });
      }

      setSnackbar({
        open: true,
        message: 'Profile updated successfully',
        severity: 'success'
      });

      setEditMode(false);
      
      // Reset password fields
      setFormData(prev => ({
        ...prev,
        password: '',
        currentPassword: ''
      }));
    } catch (error) {
      console.error('Error updating profile:', error);
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Failed to update profile',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSnackbarClose = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  const handleLevelChange = async (confirm = false) => {
    if (!selectedLevel) {
      setSnackbar({
        open: true,
        message: 'Please select a level',
        severity: 'error'
      });
      return;
    }
    if (availableSubLevels.length > 0 && !selectedSubLevel) {
      setSnackbar({
        open: true,
        message: 'Please select a sub-level',
        severity: 'error'
      });
      return;
    }

    try {
      setChangingLevel(true);
      const response = await api.put('/profile/change-level', { levelId: selectedLevel, subLevel: selectedSubLevel || undefined, confirm });

      if (response.data.requiresConfirmation) {
        setLevelChangeWarning(response.data);
        setChangingLevel(false);
        return;
      }

      setSnackbar({
        open: true,
        message: 'Level changed successfully',
        severity: 'success'
      });
      setLevelChangeMode(false);
      setLevelChangeStep(0);
      setLevelChangeWarning(null);
      updateUserProfile(response.data);
      if (response.data.level) {
        updateUserLevel(response.data.level, response.data.subLevel);
      }
      fetchSubscription();
    } catch (err) {
      console.error('Error changing level:', err);
      setSnackbar({
        open: true,
        message: err.response?.data?.message || 'Failed to change level',
        severity: 'error'
      });
    } finally {
      setChangingLevel(false);
    }
  };

  return (
    <StudentLayout>
      <Container maxWidth="lg" sx={{ mb: { xs: 4, sm: 6, md: 8 }, mt: { xs: 3, sm: 4, md: 5 }, px: { xs: 1, sm: 2, md: 3 } }}>
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={handleSnackbarClose}
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <Alert
            onClose={handleSnackbarClose}
            severity={snackbar.severity}
            variant="filled"
            sx={{ width: '100%' }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>

        <Grow in={true} timeout={800}>
          <Paper
            elevation={0}
            sx={{
              p: { xs: 4, sm: 5, md: 6 },
              mb: { xs: 3, sm: 4 },
              borderRadius: { xs: 4, md: 6 },
              background: `linear-gradient(135deg,
                ${theme.palette.primary.dark} 0%,
                ${theme.palette.primary.main} 50%,
                ${theme.palette.secondary.main} 100%)`,
              color: 'white',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: `0 25px 50px ${alpha(theme.palette.primary.main, 0.3)}`,
              transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
              '&:hover': {
                boxShadow: `0 30px 60px ${alpha(theme.palette.primary.main, 0.4)}`,
                transform: 'translateY(-4px)'
              }
            }}
          >
            {/* Enhanced decorative elements */}
            <Box
              sx={{
                position: 'absolute',
                top: -50,
                right: -50,
                width: { xs: '150px', sm: '200px', md: '250px' },
                height: { xs: '150px', sm: '200px', md: '250px' },
                background: 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)',
                borderRadius: '50%',
                animation: 'profileFloat 10s ease-in-out infinite',
                '@keyframes profileFloat': {
                  '0%': { transform: 'translateY(0px) rotate(0deg)' },
                  '50%': { transform: 'translateY(-20px) rotate(180deg)' },
                  '100%': { transform: 'translateY(0px) rotate(360deg)' }
                }
              }}
            />

            {/* Profile sparkles */}
            {[...Array(8)].map((_, i) => (
              <Box
                key={i}
                sx={{
                  position: 'absolute',
                  width: { xs: 3, sm: 4 },
                  height: { xs: 3, sm: 4 },
                  borderRadius: '50%',
                  bgcolor: 'rgba(255,255,255,0.8)',
                  top: `${15 + i * 10}%`,
                  left: `${10 + i * 10}%`,
                  animation: `profileSparkle 4s ease-in-out infinite ${i * 0.3}s`,
                  '@keyframes profileSparkle': {
                    '0%, 100%': { opacity: 0, transform: 'scale(0) rotate(0deg)' },
                    '50%': { opacity: 1, transform: 'scale(1) rotate(180deg)' }
                  }
                }}
              />
            ))}

            <Box sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: { xs: 'flex-start', sm: 'center' },
              flexDirection: { xs: 'column', sm: 'row' },
              gap: { xs: 3, sm: 2 },
              position: 'relative',
              zIndex: 1
            }}>
              <Box>
                <Typography
                  variant="h3"
                  component="h1"
                  fontWeight="bold"
                  sx={{
                    fontSize: { xs: '2rem', sm: '2.5rem', md: '3rem' },
                    background: 'linear-gradient(135deg, #ffffff 0%, #f0f0f0 50%, #ffffff 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    mb: 1,
                    letterSpacing: '-0.02em',
                    position: 'relative',
                    '&::after': {
                      content: '""',
                      position: 'absolute',
                      bottom: -8,
                      left: 0,
                      width: '60%',
                      height: 4,
                      background: 'linear-gradient(90deg, rgba(255,255,255,0.8), rgba(255,255,255,0.3))',
                      borderRadius: 2
                    }
                  }}
                >
                  Your Profile 👤
                </Typography>
                <Typography
                  variant="h6"
                  sx={{
                    color: 'rgba(255,255,255,0.9)',
                    fontSize: { xs: '1rem', sm: '1.2rem' },
                    fontWeight: 'medium'
                  }}
                >
                  Manage your account settings and personal information
                </Typography>
              </Box>

              <Button
                variant="contained"
                color="secondary"
                onClick={handleToggleEditMode}
                startIcon={editMode ? <Cancel /> : <Edit />}
                sx={{
                  color: 'black',
                  fontWeight: 'bold',
                  borderRadius: 3,
                  px: { xs: 3, sm: 4 },
                  py: { xs: 1.2, sm: 1.5 },
                  fontSize: { xs: '0.9rem', sm: '1rem' },
                  boxShadow: `0 4px 12px ${alpha(theme.palette.secondary.main, 0.3)}`,
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: `0 6px 16px ${alpha(theme.palette.secondary.main, 0.4)}`
                  }
                }}
              >
                {editMode ? 'Cancel Changes' : 'Edit Profile'}
              </Button>
            </Box>
          </Paper>
        </Grow>

        {/* Student Subscription + Level Card */}
        <Box sx={{ mb: 3 }}>
          <StudentSubscriptionSection
            subscription={subscription}
            subscriptionLoading={subscriptionLoading}
            user={user}
          />
        </Box>

        <Grid container spacing={{ xs: 3, sm: 4 }}>
          <Grid item xs={12} md={4}>
            <Fade in={true} timeout={1000}>
              <Card
                elevation={8}
                sx={{
                  height: '100%',
                  borderRadius: 4,
                  position: 'relative',
                  overflow: 'hidden',
                  background: `linear-gradient(135deg,
                    ${alpha(theme.palette.background.paper, 0.9)} 0%,
                    ${alpha(theme.palette.background.paper, 1)} 100%)`,
                  border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                  transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  '&:hover': {
                    transform: 'translateY(-8px)',
                    boxShadow: `0 20px 40px ${alpha(theme.palette.primary.main, 0.15)}`
                  }
                }}
              >
                {/* Profile card glow effect */}
                <Box
                  sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    background: `radial-gradient(circle at top center, ${alpha(theme.palette.primary.main, 0.05)} 0%, transparent 50%)`,
                    animation: 'profileCardGlow 4s ease-in-out infinite alternate',
                    '@keyframes profileCardGlow': {
                      '0%': { opacity: 0.3 },
                      '100%': { opacity: 0.7 }
                    }
                  }}
                />

                <CardContent sx={{ p: { xs: 3, sm: 4 }, textAlign: 'center', position: 'relative', zIndex: 1 }}>
                  {/* Enhanced Avatar Section */}
                  <Box sx={{ position: 'relative', display: 'inline-block', mb: 3 }}>
                    {/* Rotating border */}
                    <Box
                      sx={{
                        position: 'absolute',
                        top: -8,
                        left: -8,
                        right: -8,
                        bottom: -8,
                        borderRadius: '50%',
                        background: `conic-gradient(
                          ${theme.palette.primary.main} 0deg,
                          ${theme.palette.secondary.main} 120deg,
                          ${theme.palette.info.main} 240deg,
                          ${theme.palette.primary.main} 360deg
                        )`,
                        animation: 'profileAvatarRotate 8s linear infinite',
                        '@keyframes profileAvatarRotate': {
                          '0%': { transform: 'rotate(0deg)' },
                          '100%': { transform: 'rotate(360deg)' }
                        }
                      }}
                    />

                    <Avatar
                      sx={{
                        width: { xs: 100, sm: 120, md: 140 },
                        height: { xs: 100, sm: 120, md: 140 },
                        bgcolor: 'background.paper',
                        color: theme.palette.primary.main,
                        fontSize: { xs: '2.5rem', sm: '3rem', md: '3.5rem' },
                        fontWeight: 'bold',
                        boxShadow: `0 12px 30px ${alpha(theme.palette.primary.main, 0.3)}`,
                        border: '6px solid white',
                        position: 'relative',
                        zIndex: 2,
                        transition: 'all 0.4s ease',
                        animation: 'profileAvatarFloat 6s ease-in-out infinite',
                        '@keyframes profileAvatarFloat': {
                          '0%, 100%': { transform: 'translateY(0px)' },
                          '50%': { transform: 'translateY(-8px)' }
                        },
                        '&:hover': {
                          transform: 'scale(1.05)',
                          boxShadow: `0 16px 40px ${alpha(theme.palette.primary.main, 0.4)}`
                        }
                      }}
                    >
                      {user?.firstName?.charAt(0) || user?.email?.charAt(0) || 'S'}
                    </Avatar>

                    {/* Status indicator */}
                    <Box
                      sx={{
                        position: 'absolute',
                        bottom: 8,
                        right: 8,
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        bgcolor: 'success.main',
                        border: '4px solid white',
                        boxShadow: `0 0 0 3px ${alpha(theme.palette.success.main, 0.3)}`,
                        animation: 'profileStatusPulse 2s ease-in-out infinite',
                        '@keyframes profileStatusPulse': {
                          '0%, 100%': { transform: 'scale(1)' },
                          '50%': { transform: 'scale(1.2)' }
                        },
                        zIndex: 3
                      }}
                    />

                    {/* Verified badge */}
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        bgcolor: theme.palette.info.main,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: `0 4px 12px ${alpha(theme.palette.info.main, 0.4)}`,
                        animation: 'profileVerifiedShine 3s ease-in-out infinite',
                        '@keyframes profileVerifiedShine': {
                          '0%, 100%': { transform: 'scale(1) rotate(0deg)' },
                          '50%': { transform: 'scale(1.1) rotate(180deg)' }
                        },
                        zIndex: 3
                      }}
                    >
                      <Verified sx={{ color: 'white', fontSize: '1rem' }} />
                    </Box>
                  </Box>

                  <Typography
                    variant="h4"
                    fontWeight="bold"
                    sx={{
                      mb: 1,
                      fontSize: { xs: '1.3rem', sm: '1.5rem', md: '1.7rem' },
                      background: `linear-gradient(135deg, ${theme.palette.text.primary}, ${alpha(theme.palette.text.primary, 0.8)})`,
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text'
                    }}
                  >
                    {user?.firstName} {user?.lastName}
                  </Typography>

                  <Typography
                    variant="body1"
                    color="text.secondary"
                    sx={{
                      mb: 2,
                      fontSize: { xs: '0.9rem', sm: '1rem' },
                      fontWeight: 'medium'
                    }}
                  >
                    {user?.email}
                  </Typography>

                  <Chip
                    icon={<WorkspacePremium />}
                    label="Student"
                    color="primary"
                    sx={{
                      mt: 1,
                      borderRadius: 3,
                      fontWeight: 'bold',
                      px: 2,
                      '& .MuiChip-icon': {
                        color: 'white'
                      }
                    }}
                  />

                  <Divider sx={{ my: 3 }} />

                  {/* Enhanced Info Section */}
                  <Box sx={{ textAlign: 'left' }}>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        mb: 3,
                        p: 2,
                        borderRadius: 3,
                        background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)}, ${alpha(theme.palette.primary.light, 0.03)})`,
                        border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                        transition: 'all 0.3s ease',
                        '&:hover': {
                          transform: 'translateX(4px)',
                          boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.1)}`
                        }
                      }}
                    >
                      <Avatar
                        sx={{
                          width: 40,
                          height: 40,
                          bgcolor: theme.palette.primary.main,
                          mr: 2,
                          boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.3)}`
                        }}
                      >
                        <School sx={{ fontSize: '1.2rem' }} />
                      </Avatar>
                      <Box>
                        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 'medium' }}>
                          Class
                        </Typography>
                        <Typography variant="body1" fontWeight="bold" color="primary.main">
                          {user?.class || 'Not specified'}
                        </Typography>
                      </Box>
                    </Box>

                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        mb: 2,
                        p: 2,
                        borderRadius: 3,
                        background: `linear-gradient(135deg, ${alpha(theme.palette.secondary.main, 0.05)}, ${alpha(theme.palette.secondary.light, 0.03)})`,
                        border: `1px solid ${alpha(theme.palette.secondary.main, 0.1)}`,
                        transition: 'all 0.3s ease',
                        '&:hover': {
                          transform: 'translateX(4px)',
                          boxShadow: `0 4px 12px ${alpha(theme.palette.secondary.main, 0.1)}`
                        }
                      }}
                    >
                      <Avatar
                        sx={{
                          width: 40,
                          height: 40,
                          bgcolor: theme.palette.secondary.main,
                          mr: 2,
                          boxShadow: `0 4px 12px ${alpha(theme.palette.secondary.main, 0.3)}`
                        }}
                      >
                        <Business sx={{ fontSize: '1.2rem' }} />
                      </Avatar>
                      <Box>
                        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 'medium' }}>
                          Organization
                        </Typography>
                        <Typography variant="body1" fontWeight="bold" color="secondary.main">
                          {user?.organization || 'Not specified'}
                        </Typography>
                      </Box>
                    </Box>

                    {/* Learning Level Section */}
                    <LevelSection
                      user={user}
                      levels={levels}
                      selectedLevel={selectedLevel}
                      setSelectedLevel={setSelectedLevel}
                      selectedSubLevel={selectedSubLevel}
                      setSelectedSubLevel={setSelectedSubLevel}
                      availableSubLevels={availableSubLevels}
                      levelChangeMode={levelChangeMode}
                      setLevelChangeMode={setLevelChangeMode}
                      levelChangeStep={levelChangeStep}
                      setLevelChangeStep={setLevelChangeStep}
                      levelChangeWarning={levelChangeWarning}
                      setLevelChangeWarning={setLevelChangeWarning}
                      changingLevel={changingLevel}
                      handleLevelChange={handleLevelChange}
                      theme={theme}
                    />
                  </Box>
                </CardContent>
              </Card>
            </Fade>
          </Grid>

          <Grid item xs={12} md={8}>
            <Fade in={true} timeout={1200}>
              <Card
                elevation={8}
                sx={{
                  borderRadius: 4,
                  position: 'relative',
                  overflow: 'hidden',
                  background: `linear-gradient(135deg,
                    ${alpha(theme.palette.background.paper, 0.9)} 0%,
                    ${alpha(theme.palette.background.paper, 1)} 100%)`,
                  border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                  transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: `0 20px 40px ${alpha(theme.palette.primary.main, 0.15)}`
                  }
                }}
              >
                {/* Form glow effect */}
                <Box
                  sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    background: `radial-gradient(circle at top right, ${alpha(theme.palette.secondary.main, 0.05)} 0%, transparent 50%)`,
                    animation: 'formGlow 5s ease-in-out infinite alternate',
                    '@keyframes formGlow': {
                      '0%': { opacity: 0.3 },
                      '100%': { opacity: 0.6 }
                    }
                  }}
                />

                <CardContent sx={{ p: { xs: 3, sm: 4, md: 5 }, position: 'relative', zIndex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
                    <Avatar
                      sx={{
                        width: 48,
                        height: 48,
                        bgcolor: theme.palette.secondary.main,
                        mr: 2,
                        boxShadow: `0 4px 12px ${alpha(theme.palette.secondary.main, 0.3)}`
                      }}
                    >
                      <Person sx={{ fontSize: '1.5rem' }} />
                    </Avatar>
                    <Box>
                      <Typography
                        variant="h4"
                        fontWeight="bold"
                        sx={{
                          fontSize: { xs: '1.5rem', sm: '1.8rem', md: '2rem' },
                          background: `linear-gradient(135deg, ${theme.palette.secondary.main}, ${theme.palette.secondary.dark})`,
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          backgroundClip: 'text',
                          position: 'relative',
                          '&::after': {
                            content: '""',
                            position: 'absolute',
                            bottom: -4,
                            left: 0,
                            width: '50%',
                            height: 3,
                            background: `linear-gradient(90deg, ${theme.palette.secondary.main}, ${theme.palette.secondary.light})`,
                            borderRadius: 2
                          }
                        }}
                      >
                        {editMode ? 'Edit Profile Information' : 'Profile Information'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {editMode ? 'Update your profile details and preferences' : 'View your current profile information'}
                      </Typography>
                    </Box>
                  </Box>

                  <Box component="form" onSubmit={handleSubmit}>
                    <Grid container spacing={{ xs: 2, sm: 3 }}>
                      <Grid item xs={12} sm={6}>
                        <Zoom in={true} style={{ transitionDelay: '200ms' }}>
                          <TextField
                            fullWidth
                            label="First Name"
                            name="firstName"
                            value={formData.firstName}
                            onChange={handleChange}
                            disabled={!editMode}
                            required
                            InputProps={{
                              startAdornment: (
                                <InputAdornment position="start">
                                  <Person sx={{ color: editMode ? theme.palette.primary.main : 'text.secondary' }} />
                                </InputAdornment>
                              ),
                            }}
                            sx={{
                              '& .MuiOutlinedInput-root': {
                                borderRadius: 3,
                                transition: 'all 0.3s ease',
                                '&:hover': {
                                  boxShadow: editMode ? `0 4px 12px ${alpha(theme.palette.primary.main, 0.15)}` : 'none'
                                },
                                '&.Mui-focused': {
                                  boxShadow: `0 6px 16px ${alpha(theme.palette.primary.main, 0.2)}`
                                }
                              },
                              '& .MuiInputLabel-root': {
                                fontWeight: 'medium',
                                fontSize: { xs: '0.9rem', sm: '1rem' }
                              },
                              '& .MuiInputBase-input': {
                                fontSize: { xs: '0.95rem', sm: '1rem' }
                              }
                            }}
                          />
                        </Zoom>
                      </Grid>

                      <Grid item xs={12} sm={6}>
                        <Zoom in={true} style={{ transitionDelay: '300ms' }}>
                          <TextField
                            fullWidth
                            label="Last Name"
                            name="lastName"
                            value={formData.lastName}
                            onChange={handleChange}
                            disabled={!editMode}
                            required
                            InputProps={{
                              startAdornment: (
                                <InputAdornment position="start">
                                  <Person sx={{ color: editMode ? theme.palette.primary.main : 'text.secondary' }} />
                                </InputAdornment>
                              ),
                            }}
                            sx={{
                              '& .MuiOutlinedInput-root': {
                                borderRadius: 3,
                                transition: 'all 0.3s ease',
                                '&:hover': {
                                  boxShadow: editMode ? `0 4px 12px ${alpha(theme.palette.primary.main, 0.15)}` : 'none'
                                },
                                '&.Mui-focused': {
                                  boxShadow: `0 6px 16px ${alpha(theme.palette.primary.main, 0.2)}`
                                }
                              },
                              '& .MuiInputLabel-root': {
                                fontWeight: 'medium',
                                fontSize: { xs: '0.9rem', sm: '1rem' }
                              },
                              '& .MuiInputBase-input': {
                                fontSize: { xs: '0.95rem', sm: '1rem' }
                              }
                            }}
                          />
                        </Zoom>
                      </Grid>

                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          label="Email Address"
                          name="email"
                          value={formData.email}
                          onChange={handleChange}
                          disabled={true}
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <Email color="primary" />
                              </InputAdornment>
                            ),
                          }}
                        />
                      </Grid>

                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label="Class"
                          name="class"
                          value={formData.class}
                          onChange={handleChange}
                          disabled={!editMode}
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <ClassIcon color="primary" />
                              </InputAdornment>
                            ),
                          }}
                        />
                      </Grid>

                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label="Organization"
                          name="organization"
                          value={formData.organization}
                          onChange={handleChange}
                          disabled={!editMode}
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <Business color="primary" />
                              </InputAdornment>
                            ),
                          }}
                        />
                      </Grid>

                      <Grid item xs={12}>
                        <Divider sx={{ my: 3 }}>
                          <Chip label="Change Password" sx={{ borderRadius: 0 }} />
                        </Divider>
                      </Grid>

                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label="Current Password"
                          name="currentPassword"
                          type={showPassword ? 'text' : 'password'}
                          value={formData.currentPassword}
                          onChange={handleChange}
                          InputProps={{
                            endAdornment: (
                              <InputAdornment position="end">
                                <IconButton
                                  onClick={handleToggleShowPassword}
                                  edge="end"
                                >
                                  {showPassword ? <VisibilityOff /> : <Visibility />}
                                </IconButton>
                              </InputAdornment>
                            ),
                          }}
                        />
                      </Grid>

                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label="New Password"
                          name="password"
                          type={showPassword ? 'text' : 'password'}
                          value={formData.password}
                          onChange={handleChange}
                          InputProps={{
                            endAdornment: (
                              <InputAdornment position="end">
                                <IconButton
                                  onClick={handleToggleShowPassword}
                                  edge="end"
                                >
                                  {showPassword ? <VisibilityOff /> : <Visibility />}
                                </IconButton>
                              </InputAdornment>
                            ),
                          }}
                        />
                      </Grid>
                    </Grid>

                    {editMode && (
                      <Zoom in={editMode} timeout={500}>
                        <Box
                          sx={{
                            mt: 5,
                            display: 'flex',
                            justifyContent: { xs: 'center', sm: 'flex-end' },
                            flexDirection: { xs: 'column', sm: 'row' },
                            gap: { xs: 2, sm: 3 },
                            p: 3,
                            borderRadius: 3,
                            background: `linear-gradient(135deg, ${alpha(theme.palette.grey[100], 0.5)}, ${alpha(theme.palette.grey[50], 0.8)})`,
                            border: `1px solid ${alpha(theme.palette.grey[300], 0.3)}`
                          }}
                        >
                          <Button
                            variant="outlined"
                            onClick={handleToggleEditMode}
                            startIcon={<Cancel />}
                            sx={{
                              borderRadius: 3,
                              px: { xs: 4, sm: 5 },
                              py: { xs: 1.2, sm: 1.5 },
                              fontSize: { xs: '0.9rem', sm: '1rem' },
                              fontWeight: 'bold',
                              borderColor: theme.palette.grey[400],
                              color: theme.palette.grey[700],
                              transition: 'all 0.3s ease',
                              '&:hover': {
                                borderColor: theme.palette.grey[600],
                                backgroundColor: alpha(theme.palette.grey[100], 0.8),
                                transform: 'translateY(-2px)',
                                boxShadow: `0 4px 12px ${alpha(theme.palette.grey[400], 0.3)}`
                              }
                            }}
                          >
                            Cancel Changes
                          </Button>
                          <Button
                            type="submit"
                            variant="contained"
                            color="primary"
                            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <Save />}
                            disabled={loading}
                            sx={{
                              borderRadius: 3,
                              px: { xs: 4, sm: 5 },
                              py: { xs: 1.2, sm: 1.5 },
                              fontSize: { xs: '0.9rem', sm: '1rem' },
                              fontWeight: 'bold',
                              background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
                              boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.3)}`,
                              transition: 'all 0.3s ease',
                              '&:hover': {
                                background: `linear-gradient(135deg, ${theme.palette.primary.dark}, ${theme.palette.primary.main})`,
                                transform: 'translateY(-2px)',
                                boxShadow: `0 6px 16px ${alpha(theme.palette.primary.main, 0.4)}`
                              },
                              '&:disabled': {
                                background: alpha(theme.palette.primary.main, 0.6),
                                transform: 'none'
                              }
                            }}
                          >
                            {loading ? 'Saving Changes...' : 'Save Changes'}
                          </Button>
                        </Box>
                      </Zoom>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Fade>
          </Grid>
        </Grid>
      </Container>
    </StudentLayout>
  );
};

export default Profile;
