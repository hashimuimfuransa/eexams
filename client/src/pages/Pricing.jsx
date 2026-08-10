import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Card, CardContent, Button, Chip, CircularProgress, Alert, Tabs, Tab, Grid, Divider, TextField, MenuItem } from '@mui/material';
import { CheckCircle, WorkspacePremium, School, Person, Business, ArrowForward, FilterList, Refresh } from '@mui/icons-material';
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

  // Filters. The three catalogs are fetched once and narrowed client-side, so
  // changing a filter is instant and the page stays usable with no account.
  const [search, setSearch] = useState('');
  const [filterLevel, setFilterLevel] = useState('');
  const [filterSubLevel, setFilterSubLevel] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [filterDuration, setFilterDuration] = useState('');
  const [filterPlanType, setFilterPlanType] = useState('');
  const [sortBy, setSortBy] = useState('recommended');

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
  const getCta = (key, plan) => {
    if (key === 'student') {
      // An exam plan deep-links into the purchase flow already pointed at that
      // exam, so the student doesn't have to find it again in the picker.
      const examId = plan?.planType === 'exam' ? (plan.exam?._id || plan.exam) : null;
      return isAuthenticated && user?.role === 'student'
        ? {
            label: examId ? 'Unlock this exam' : 'Go to my subscriptions',
            to: examId ? `/student/subscriptions?examId=${examId}` : '/student/subscriptions'
          }
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

  // ── Filtering ──────────────────────────────────────────────────────────────

  const activePlans = audience === 'student' ? studentPlans
    : audience === 'teacher' ? teacherPlans
    : orgPlans;

  // An exam-scoped plan carries no level of its own — it inherits the level of
  // the exam it unlocks, which is what students filter and group by.
  const levelOf = (plan) => plan.level || plan.exam?.level || null;
  const levelIdOf = (plan) => String(levelOf(plan)?._id || levelOf(plan) || '');
  const levelNameOf = (plan) => levelOf(plan)?.name || null;
  const subLevelOf = (plan) => plan.subLevel || plan.exam?.subLevel || null;
  const isExamPlan = (plan) => plan.planType === 'exam' && !!plan.exam;

  // A duration label is only offered when the plan actually carries a duration —
  // formatPlanDuration would otherwise render "undefined days".
  const durationLabelOf = (plan) =>
    (plan.durationValue || plan.durationDays) ? formatPlanDuration(plan) : null;

  // Picking a sub-level asks "what covers this sub-level", not "what is tagged
  // with it": a plan with no sub-level is a whole-level plan that unlocks every
  // sub-level, so hiding it would hide the very plan most students want.
  // "__entire__" is the strict option for whole-level plans only.
  const matchesSubLevelFilter = (subLevel) => {
    if (!filterSubLevel) return true;
    if (filterSubLevel === '__entire__') return !subLevel;
    return !subLevel || subLevel === filterSubLevel;
  };

  const levelOptions = useMemo(() => {
    const byId = new Map();
    studentPlans.forEach(plan => {
      const id = levelIdOf(plan);
      if (id && !byId.has(id)) byId.set(id, levelNameOf(plan) || 'Level');
    });
    return [...byId.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [studentPlans]);

  const subLevelOptions = useMemo(() => (
    [...new Set(
      studentPlans
        .filter(plan => !filterLevel || levelIdOf(plan) === filterLevel)
        .map(plan => subLevelOf(plan))
        .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b))
  ), [studentPlans, filterLevel]);

  // Only worth offering when the catalog actually mixes the two scopes.
  const hasExamPlans = useMemo(() => studentPlans.some(isExamPlan), [studentPlans]);

  // Plans left after the student-only level/sub-level/plan-type narrowing — also
  // what the Duration dropdown builds its options from, so it can never list a
  // duration that matches nothing.
  const scopedPlans = useMemo(() => (
    audience !== 'student'
      ? activePlans
      : activePlans
          .filter(plan => !filterLevel || levelIdOf(plan) === filterLevel)
          .filter(plan => matchesSubLevelFilter(subLevelOf(plan)))
          .filter(plan => !filterPlanType ||
            (filterPlanType === 'exam' ? isExamPlan(plan) : !isExamPlan(plan)))
  ), [audience, activePlans, filterLevel, filterSubLevel, filterPlanType]);

  const durationOptions = useMemo(() => {
    const byLabel = new Map();
    scopedPlans.forEach(plan => {
      const label = durationLabelOf(plan);
      if (label && !byLabel.has(label)) byLabel.set(label, plan.durationDays ?? 0);
    });
    return [...byLabel.entries()]
      .map(([label, days]) => ({ label, days }))
      .sort((a, b) => a.days - b.days);
  }, [scopedPlans]);

  const filteredPlans = useMemo(() => {
    const query = search.trim().toLowerCase();
    const list = scopedPlans.filter(plan => {
      if (query) {
        const haystack = `${plan.name || ''} ${plan.description || ''} ${subLevelOf(plan) || ''} ${levelNameOf(plan) || ''} ${plan.exam?.title || ''}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      if (minPrice !== '' && (plan.price || 0) < Number(minPrice)) return false;
      if (maxPrice !== '' && (plan.price || 0) > Number(maxPrice)) return false;
      if (filterDuration && durationLabelOf(plan) !== filterDuration) return false;
      return true;
    });

    if (sortBy === 'price_asc') return [...list].sort((a, b) => (a.price || 0) - (b.price || 0));
    if (sortBy === 'price_desc') return [...list].sort((a, b) => (b.price || 0) - (a.price || 0));
    if (sortBy === 'duration_asc') return [...list].sort((a, b) => (a.durationDays || 0) - (b.durationDays || 0));
    if (sortBy === 'duration_desc') return [...list].sort((a, b) => (b.durationDays || 0) - (a.durationDays || 0));
    return list; // recommended: the order the catalog is published in
  }, [scopedPlans, search, minPrice, maxPrice, filterDuration, sortBy]);

  const filtersActive = !!search || !!filterLevel || !!filterSubLevel || !!filterPlanType ||
    minPrice !== '' || maxPrice !== '' || !!filterDuration || sortBy !== 'recommended';

  const clearFilters = () => {
    setSearch('');
    setFilterLevel('');
    setFilterSubLevel('');
    setFilterPlanType('');
    setMinPrice('');
    setMaxPrice('');
    setFilterDuration('');
    setSortBy('recommended');
  };

  // Each tab is a different catalog — a price range or duration that made sense
  // for student level plans rarely does for school plans, and level/sub-level
  // don't exist outside the student tab at all.
  useEffect(() => { clearFilters(); }, [audience]);

  // A sub-level or duration that no longer exists after another filter changed
  // would silently empty the list — drop it instead.
  useEffect(() => {
    if (filterSubLevel && filterSubLevel !== '__entire__' && !subLevelOptions.includes(filterSubLevel)) {
      setFilterSubLevel('');
    }
  }, [subLevelOptions, filterSubLevel]);

  useEffect(() => {
    if (filterDuration && !durationOptions.some(option => option.label === filterDuration)) {
      setFilterDuration('');
    }
  }, [durationOptions, filterDuration]);

  // Student plans read best grouped by level, with the durations of that level
  // listed together — exam plans included, under the level of the exam they
  // unlock, so a visitor sees both ways to buy into a level side by side.
  const groupedStudentPlans = filteredPlans.reduce((groups, plan) => {
    const key = levelNameOf(plan) || 'Other';
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
    const cta = getCta(audienceKey, plan);
    const limitRows = getLimitRows(plan);
    const featureChips = getFeatureChips(plan);
    const examPlan = isExamPlan(plan);

    return (
      <Grid item xs={12} sm={6} md={4} key={plan._id}>
        <Card elevation={0} sx={cardSx}>
          <CardContent sx={{ p: { xs: 2, sm: 2.5 }, display: 'flex', flexDirection: 'column', flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1 }}>
              <Typography variant="h6" fontWeight={700} sx={{ color: isDark ? '#F8FAFC' : '#0D406C' }}>
                {plan.name}
              </Typography>
              {examPlan
                ? <Chip label="Single exam" size="small" color="secondary" variant="outlined" sx={{ fontWeight: 600 }} />
                : <Chip label={plan.subLevel || 'Whole level'} size="small" variant="outlined" />}
              {examPlan && plan.exam?.subLevel && (
                <Chip label={plan.exam.subLevel} size="small" variant="outlined" />
              )}
              {plan.discountPercentage > 0 && (
                <Chip label={`${plan.discountPercentage}% OFF`} color="error" size="small" sx={{ fontWeight: 600 }} />
              )}
            </Box>

            {/* Which exam the money buys — without it, two single-exam plans at
                the same price are indistinguishable. */}
            {examPlan && plan.exam?.title && (
              <Typography variant="body2" fontWeight={600} sx={{ color: isDark ? '#CBD5E1' : '#475569', mb: 1 }}>
                Unlocks: {plan.exam.title}
              </Typography>
            )}

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

  // Distinct from renderEmpty: plans exist, the filters just hid them — so the
  // way out is offered right there instead of leaving a dead end.
  const renderNoMatches = () => (
    <Box sx={{ textAlign: 'center', py: { xs: 4, sm: 6 } }}>
      <FilterList sx={{ fontSize: { xs: 40, sm: 52 }, color: isDark ? '#475569' : '#CBD5E1', mb: 1.5 }} />
      <Typography variant="h6" sx={{ color: isDark ? '#94A3B8' : '#64748B' }}>
        No plans match your filters
      </Typography>
      <Button
        onClick={clearFilters}
        startIcon={<Refresh />}
        sx={{ mt: 1.5, textTransform: 'none', fontWeight: 700, color: isDark ? '#0CBD73' : '#0D406C' }}
      >
        Clear filters
      </Button>
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
              Every plan and price on eexams, in one place. Students subscribe per level or unlock a single exam; teachers and schools subscribe per account.
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
              {/* ---- Filters ---- */}
              {activePlans.length > 0 && (
                <Box
                  sx={{
                    mb: { xs: 2.5, sm: 3 },
                    p: { xs: 1.5, sm: 2 },
                    borderRadius: 2,
                    border: isDark ? '1px solid #334155' : '1px solid #E2E8F0',
                    bgcolor: isDark ? '#1E293B' : 'white',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
                    <FilterList sx={{ fontSize: 18, color: isDark ? '#94A3B8' : '#64748B' }} />
                    <Typography variant="subtitle2" fontWeight={700} sx={{ color: isDark ? '#E2E8F0' : '#0F172A' }}>
                      Filter plans
                    </Typography>
                    <Typography variant="caption" sx={{ color: isDark ? '#94A3B8' : '#64748B' }}>
                      {filteredPlans.length} of {activePlans.length}
                    </Typography>
                    <Button
                      size="small"
                      onClick={clearFilters}
                      disabled={!filtersActive}
                      startIcon={<Refresh sx={{ fontSize: 16 }} />}
                      sx={{ ml: 'auto', textTransform: 'none', fontWeight: 600, color: isDark ? '#0CBD73' : '#0D406C' }}
                    >
                      Clear
                    </Button>
                  </Box>

                  <Grid container spacing={1.5}>
                    {audience === 'student' && (
                      <>
                        <Grid item xs={6} sm={4} md={2}>
                          <TextField
                            select
                            fullWidth
                            size="small"
                            label="Level"
                            value={filterLevel}
                            onChange={(e) => { setFilterLevel(e.target.value); setFilterSubLevel(''); }}
                          >
                            <MenuItem value="">All levels</MenuItem>
                            {levelOptions.map(({ value, label }) => (
                              <MenuItem key={value} value={value}>{label}</MenuItem>
                            ))}
                          </TextField>
                        </Grid>
                        <Grid item xs={6} sm={4} md={2}>
                          <TextField
                            select
                            fullWidth
                            size="small"
                            label="Sub-level"
                            value={filterSubLevel}
                            onChange={(e) => setFilterSubLevel(e.target.value)}
                            disabled={subLevelOptions.length === 0}
                          >
                            <MenuItem value="">All sub-levels</MenuItem>
                            <MenuItem value="__entire__">Whole level only</MenuItem>
                            {subLevelOptions.map(name => (
                              <MenuItem key={name} value={name}>{name}</MenuItem>
                            ))}
                          </TextField>
                        </Grid>
                        {hasExamPlans && (
                          <Grid item xs={6} sm={4} md={2}>
                            <TextField
                              select
                              fullWidth
                              size="small"
                              label="Plan type"
                              value={filterPlanType}
                              onChange={(e) => setFilterPlanType(e.target.value)}
                            >
                              <MenuItem value="">Level & exam plans</MenuItem>
                              <MenuItem value="level">Whole level only</MenuItem>
                              <MenuItem value="exam">Single exam only</MenuItem>
                            </TextField>
                          </Grid>
                        )}
                      </>
                    )}

                    <Grid item xs={12} sm={4} md={audience === 'student' ? 2 : 3}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Search"
                        placeholder="Plan name..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </Grid>

                    <Grid item xs={6} sm={4} md={audience === 'student' ? 2 : 3}>
                      <TextField
                        select
                        fullWidth
                        size="small"
                        label="Duration"
                        value={filterDuration}
                        onChange={(e) => setFilterDuration(e.target.value)}
                        disabled={durationOptions.length === 0}
                      >
                        <MenuItem value="">Any duration</MenuItem>
                        {durationOptions.map(({ label }) => (
                          <MenuItem key={label} value={label}>{label}</MenuItem>
                        ))}
                      </TextField>
                    </Grid>

                    <Grid item xs={3} sm={2} md={1}>
                      <TextField
                        fullWidth
                        size="small"
                        type="number"
                        label="Min"
                        value={minPrice}
                        onChange={(e) => setMinPrice(e.target.value)}
                        inputProps={{ min: 0 }}
                      />
                    </Grid>
                    <Grid item xs={3} sm={2} md={1}>
                      <TextField
                        fullWidth
                        size="small"
                        type="number"
                        label="Max"
                        value={maxPrice}
                        onChange={(e) => setMaxPrice(e.target.value)}
                        inputProps={{ min: 0 }}
                      />
                    </Grid>

                    <Grid item xs={6} sm={4} md={audience === 'student' ? 2 : 4}>
                      <TextField
                        select
                        fullWidth
                        size="small"
                        label="Sort by"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                      >
                        <MenuItem value="recommended">Recommended</MenuItem>
                        <MenuItem value="price_asc">Price: low to high</MenuItem>
                        <MenuItem value="price_desc">Price: high to low</MenuItem>
                        <MenuItem value="duration_asc">Duration: shortest</MenuItem>
                        <MenuItem value="duration_desc">Duration: longest</MenuItem>
                      </TextField>
                    </Grid>
                  </Grid>
                </Box>
              )}

              {/* ---- Students: level plans, grouped by level ---- */}
              {audience === 'student' && (
                <>
                  <Alert severity="success" sx={{ borderRadius: 2, mb: 3 }}>
                    <strong>Try before you pay</strong> — one exam per level is free, no account needed. Subscribe to unlock the rest of that level
                    {hasExamPlans ? ', or buy a single exam on its own — both are listed under each level below.' : '.'}
                  </Alert>

                  {studentPlans.length === 0
                    ? renderEmpty('No student plans are published yet')
                    : filteredPlans.length === 0
                    ? renderNoMatches()
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
                    : filteredPlans.length === 0
                    ? renderNoMatches()
                    : (
                      <Grid container spacing={{ xs: 2, sm: 3 }}>
                        {filteredPlans.map(plan => renderPlanCard(plan, 'teacher'))}
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
                    : filteredPlans.length === 0
                    ? renderNoMatches()
                    : (
                      <Grid container spacing={{ xs: 2, sm: 3 }}>
                        {filteredPlans.map(plan => renderPlanCard(plan, 'organization'))}
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
