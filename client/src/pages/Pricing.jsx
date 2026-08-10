import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Card, CardContent, Button, Chip, CircularProgress, Alert, Tabs, Tab, Grid, Divider } from '@mui/material';
import { CheckCircle, WorkspacePremium, School, Person, Business, ArrowForward } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useThemeMode } from '../context/ThemeContext';
import Nav from '../components/Nav';
import SEO from '../components/SEO';
import api from '../services/api';
import { formatPlanDuration } from '../utils/planUtils';

// Public pricing page. Everything here comes from the three super-admin-editable
// plan catalogs, so prices shown to visitors always match what they will be
// charged — there are no hardcoded prices in this file.
const AUDIENCES = [
  { key: 'student', label: 'Students', icon: <School sx={{ fontSize: 18 }} /> },
  { key: 'teacher', label: 'Teachers', icon: <Person sx={{ fontSize: 18 }} /> },
  { key: 'organization', label: 'Schools', icon: <Business sx={{ fontSize: 18 }} /> },
];

const Pricing = () => {
  const [audience, setAudience] = useState('student');
  const [studentPlans, setStudentPlans] = useState([]);
  const [teacherPlans, setTeacherPlans] = useState([]);
  const [orgPlans, setOrgPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [scrolled, setScrolled] = useState(0);

  const navigate = useNavigate();
  const { isAuthenticated, user, logout } = useAuth();
  const { mode, toggleMode } = useThemeMode();
  const isDark = mode === 'dark';

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Land signed-in users on the tab that matches their account type.
  useEffect(() => {
    if (user?.role === 'teacher') setAudience('teacher');
    else if (user?.role === 'admin') setAudience('organization');
  }, [user?.role]);

  useEffect(() => {
    let cancelled = false;

    const fetchPlans = async () => {
      try {
        // All three endpoints are public, so this works with no account. One
        // failing catalog shouldn't blank the other two tabs.
        const [students, teachers, orgs] = await Promise.allSettled([
          api.get('/subscription-plans/public'),
          api.get('/individual-plans/active'),
          api.get('/organization-plans/active'),
        ]);
        if (cancelled) return;

        setStudentPlans(students.status === 'fulfilled' ? students.value.data || [] : []);
        setTeacherPlans(teachers.status === 'fulfilled' ? teachers.value.data || [] : []);
        setOrgPlans(orgs.status === 'fulfilled' ? orgs.value.data || [] : []);

        if ([students, teachers, orgs].every(r => r.status === 'rejected')) {
          setError('Could not load plans right now. Please try again in a moment.');
        }
      } catch (err) {
        if (!cancelled) setError('Could not load plans right now. Please try again in a moment.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchPlans();
    return () => { cancelled = true; };
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // Each audience buys from its own flow, and all of them sit behind auth — so
  // visitors are pointed at the matching sign-up instead of a login wall.
  const getCta = (key) => {
    if (key === 'student') {
      return isAuthenticated && user?.role === 'student'
        ? { label: 'Go to my subscriptions', to: '/student/subscriptions' }
        : { label: 'Sign up to subscribe', to: '/student-register' };
    }
    if (key === 'teacher') {
      return isAuthenticated && user?.role === 'teacher'
        ? { label: 'Subscribe', to: '/individual/subscription' }
        : { label: 'Create a teacher account', to: '/register' };
    }
    return isAuthenticated && user?.role === 'admin'
      ? { label: 'Subscribe', to: '/organization/subscription' }
      : { label: 'Register your school', to: '/register' };
  };

  const formatPrice = (plan) =>
    `${plan.currency === 'RWF' ? 'RWF' : '$'} ${(plan.price || 0).toLocaleString()}`;

  // Enforcement limits are nullable — null means "fall back to the tier default"
  // on the server, so there is no number to show. -1 means unlimited.
  const getLimitRows = (plan) => {
    const rows = [
      ['Exams', plan.maxExams],
      ['Teachers', plan.maxTeachers],
      ['Students', plan.maxStudents],
      ['Exams per month', plan.examPerMonth],
    ]
      .filter(([, value]) => value !== null && value !== undefined)
      .map(([label, value]) => [label, value === -1 ? 'Unlimited' : value.toLocaleString()]);

    if (plan.storageLimit !== null && plan.storageLimit !== undefined) {
      rows.push(['Storage', plan.storageLimit === -1 ? 'Unlimited' : `${plan.storageLimit} MB`]);
    }
    return rows;
  };

  const getFeatureChips = (plan) =>
    [
      plan.aiFeatures && 'AI grading',
      plan.advancedAI && 'Advanced AI',
      plan.analytics && 'Analytics',
    ].filter(Boolean);

  // Student plans are level-scoped, so they read best grouped by level with the
  // durations of that level listed together.
  const groupedStudentPlans = studentPlans.reduce((groups, plan) => {
    const key = plan.level?.name || 'Other';
    (groups[key] = groups[key] || []).push(plan);
    return groups;
  }, {});

  const cardSx = {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    borderRadius: 2,
    border: isDark ? '1px solid #334155' : '1px solid #E2E8F0',
    bgcolor: isDark ? '#1E293B' : 'white',
    transition: 'all 0.15s ease',
    '&:hover': {
      borderColor: '#0CBD73',
      transform: 'translateY(-2px)',
      boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.3)' : '0 8px 24px rgba(15,23,42,0.08)',
    },
  };

  const renderPlanCard = (plan, audienceKey) => {
    const cta = getCta(audienceKey);
    const limitRows = getLimitRows(plan);
    const featureChips = getFeatureChips(plan);

    return (
      <Grid item xs={12} sm={6} md={4} key={plan._id}>
        <Card elevation={0} sx={cardSx}>
          <CardContent sx={{ p: { xs: 2, sm: 2.5 }, display: 'flex', flexDirection: 'column', flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1 }}>
              <Typography variant="h6" fontWeight={700} sx={{ color: isDark ? '#F8FAFC' : '#0D406C' }}>
                {plan.name}
              </Typography>
              {plan.subLevel && <Chip label={plan.subLevel} size="small" variant="outlined" />}
              {plan.discountPercentage > 0 && (
                <Chip label={`${plan.discountPercentage}% OFF`} color="error" size="small" sx={{ fontWeight: 600 }} />
              )}
            </Box>

            <Typography variant="h4" fontWeight={700} sx={{ color: '#0CBD73', fontSize: { xs: '1.5rem', sm: '2rem' } }}>
              {formatPrice(plan)}
            </Typography>
            <Typography variant="body2" sx={{ color: isDark ? '#94A3B8' : '#64748B', mb: 2 }}>
              {formatPlanDuration(plan)} access
            </Typography>

            {limitRows.length > 0 && (
              <Box sx={{ mb: 1.5 }}>
                {limitRows.map(([label, value]) => (
                  <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.35 }}>
                    <Typography variant="body2" sx={{ color: isDark ? '#94A3B8' : '#64748B' }}>{label}</Typography>
                    <Typography variant="body2" fontWeight={600} sx={{ color: isDark ? '#E2E8F0' : '#0F172A' }}>{value}</Typography>
                  </Box>
                ))}
              </Box>
            )}

            {featureChips.length > 0 && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1.5 }}>
                {featureChips.map(chip => (
                  <Chip key={chip} label={chip} size="small" color="success" variant="outlined" />
                ))}
              </Box>
            )}

            {plan.features?.length > 0 && (
              <Box sx={{ mb: 2 }}>
                {plan.features.map((feature, idx) => (
                  <Box key={idx} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 0.5 }}>
                    <CheckCircle sx={{ color: '#0CBD73', fontSize: 18, mt: '2px', flexShrink: 0 }} />
                    <Typography variant="body2" sx={{ color: isDark ? '#CBD5E1' : '#475569' }}>{feature}</Typography>
                  </Box>
                ))}
              </Box>
            )}

            <Button
              fullWidth
              variant="contained"
              endIcon={<ArrowForward />}
              onClick={() => navigate(cta.to)}
              sx={{
                mt: 'auto',
                borderRadius: 1.5,
                textTransform: 'none',
                fontWeight: 700,
                bgcolor: '#0D406C',
                '&:hover': { bgcolor: '#0A3355' },
              }}
            >
              {cta.label}
            </Button>
          </CardContent>
        </Card>
      </Grid>
    );
  };

  const renderEmpty = (message) => (
    <Box sx={{ textAlign: 'center', py: { xs: 5, sm: 8 } }}>
      <WorkspacePremium sx={{ fontSize: { xs: 48, sm: 64 }, color: isDark ? '#475569' : '#CBD5E1', mb: 2 }} />
      <Typography variant="h6" sx={{ color: isDark ? '#94A3B8' : '#64748B' }}>{message}</Typography>
    </Box>
  );

  return (
    <>
      <SEO
        title="Subscription Plans & Pricing | eexams"
        description="See every eexams subscription plan and price — student level plans, individual teacher plans and school plans. Compare durations, features and limits before you subscribe."
        keywords="eexams pricing, exam subscription Rwanda, student subscription plans, teacher plans, school exam platform pricing, online exam plans"
        ogUrl="https://www.eexams.net/subscriptions"
        canonical="https://www.eexams.net/subscriptions"
        breadcrumbs={[
          { name: 'Home', url: 'https://www.eexams.net/' },
          { name: 'Subscriptions', url: 'https://www.eexams.net/subscriptions' },
        ]}
      />
      <Nav
        scrolled={scrolled > 20}
        mode={mode}
        toggleMode={toggleMode}
        isAuthenticated={isAuthenticated}
        user={user}
        handleLogout={handleLogout}
        currentRoute="/subscriptions"
      />

      <Box sx={{ minHeight: '100vh', bgcolor: isDark ? '#0F172A' : '#F1F5F9', pt: { xs: 10, sm: 14, md: 20 }, pb: { xs: 5, sm: 8 } }}>
        <Box sx={{ maxWidth: 1200, margin: '0 auto', px: { xs: 1.5, sm: 2, md: 3 } }}>
          {/* Header */}
          <Box sx={{ textAlign: 'center', mb: { xs: 3, sm: 5 } }}>
            <Typography
              variant="h4"
              fontWeight={700}
              sx={{ color: isDark ? '#F8FAFC' : '#0D406C', mb: 1, fontSize: { xs: '1.5rem', sm: '2rem', md: '2.125rem' } }}
            >
              Subscription Plans
            </Typography>
            <Typography sx={{ color: isDark ? '#94A3B8' : '#64748B', maxWidth: 620, mx: 'auto', fontSize: { xs: 13, sm: 15, md: 16 } }}>
              Every plan and price on eexams, in one place. Students subscribe per level; teachers and schools subscribe per account.
            </Typography>
          </Box>

          {/* Audience tabs */}
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: { xs: 2.5, sm: 4 } }}>
            <Tabs
              value={audience}
              onChange={(e, value) => setAudience(value)}
              variant="scrollable"
              scrollButtons="auto"
              allowScrollButtonsMobile
              sx={{
                minHeight: 0,
                '& .MuiTab-root': {
                  textTransform: 'none',
                  fontWeight: 600,
                  minHeight: 44,
                  color: isDark ? '#94A3B8' : '#64748B',
                },
                '& .Mui-selected': { color: '#0D406C !important' },
                '& .MuiTabs-indicator': { backgroundColor: '#0CBD73', height: 3, borderRadius: 3 },
              }}
            >
              {AUDIENCES.map(a => (
                <Tab key={a.key} value={a.key} label={a.label} icon={a.icon} iconPosition="start" />
              ))}
            </Tabs>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 4, maxWidth: 600, mx: 'auto', borderRadius: 2 }}>
              {error}
            </Alert>
          )}

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              {/* ---- Students: level plans, grouped by level ---- */}
              {audience === 'student' && (
                <>
                  <Alert severity="success" sx={{ borderRadius: 2, mb: 3 }}>
                    <strong>Try before you pay</strong> — one exam per level is free, no account needed. Subscribe to unlock the rest of that level.
                  </Alert>

                  {studentPlans.length === 0
                    ? renderEmpty('No student plans are published yet')
                    : Object.entries(groupedStudentPlans).map(([levelName, plans]) => (
                        <Box key={levelName} sx={{ mb: { xs: 3, sm: 5 } }}>
                          <Typography variant="h6" fontWeight={600} sx={{ color: isDark ? '#F8FAFC' : '#0D406C', mb: 0.5 }}>
                            {levelName}
                          </Typography>
                          <Divider sx={{ mb: 2, borderColor: isDark ? '#334155' : '#E2E8F0' }} />
                          <Grid container spacing={{ xs: 2, sm: 3 }}>
                            {plans.map(plan => renderPlanCard(plan, 'student'))}
                          </Grid>
                        </Box>
                      ))}
                </>
              )}

              {/* ---- Individual teachers ---- */}
              {audience === 'teacher' && (
                <>
                  <Alert severity="info" sx={{ borderRadius: 2, mb: 3 }}>
                    For teachers running exams on their own, without a school account.
                  </Alert>
                  {teacherPlans.length === 0
                    ? renderEmpty('No teacher plans are published yet')
                    : (
                      <Grid container spacing={{ xs: 2, sm: 3 }}>
                        {teacherPlans.map(plan => renderPlanCard(plan, 'teacher'))}
                      </Grid>
                    )}
                </>
              )}

              {/* ---- Schools / organisations ---- */}
              {audience === 'organization' && (
                <>
                  <Alert severity="info" sx={{ borderRadius: 2, mb: 3 }}>
                    For schools and institutions managing several teachers and student groups.
                  </Alert>
                  {orgPlans.length === 0
                    ? renderEmpty('No school plans are published yet')
                    : (
                      <Grid container spacing={{ xs: 2, sm: 3 }}>
                        {orgPlans.map(plan => renderPlanCard(plan, 'organization'))}
                      </Grid>
                    )}
                </>
              )}
            </>
          )}
        </Box>
      </Box>
    </>
  );
};

export default Pricing;
