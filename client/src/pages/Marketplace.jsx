import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Card, CardContent, Button, Chip, CircularProgress, Alert, TextField, Grid, FormControl, InputLabel, Select, MenuItem, Accordion, AccordionSummary, AccordionDetails, Collapse } from '@mui/material';
import { Search, School, AccessTime, AttachMoney, FilterList, ExpandMore, Share, Sort, AccessTime as TimeIcon, KeyboardArrowDown, KeyboardArrowUp, ArrowBack, WorkspacePremium, Lock, ArrowForward, PlayArrow } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useThemeMode } from '../context/ThemeContext';
import Nav from '../components/Nav';
import SEO from '../components/SEO';
import api from '../services/api';
import SearchableSelect from '../components/shared/SearchableSelect';

const Marketplace = () => {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  // Debounced copy of searchTerm — the exam bank is paginated (50 at a time),
  // so searching only what is loaded would hide most of the catalog. The
  // server does the matching; this is what gets sent to it.
  const [appliedSearch, setAppliedSearch] = useState('');
  // True only while a search-triggered refetch is in flight. Kept separate from
  // `loading` so the page (and the focused search box) stays mounted — see the
  // full-page spinner below, which is reserved for the very first load.
  const [searching, setSearching] = useState(false);
  const hasLoadedOnce = useRef(false);
  // Monotonic request id: a slow response for "chem" must never overwrite the
  // newer results for "chemistry".
  const requestIdRef = useRef(0);

  // Infinite scroll
  const observerRef = useRef(null);
  const sentinelRef = useRef(null);
  const setSentinelRef = useRef((node) => {
    if (sentinelRef.current && observerRef.current) {
      observerRef.current.unobserve(sentinelRef.current);
    }
    sentinelRef.current = node;
    if (node && observerRef.current) {
      observerRef.current.observe(node);
    }
  }).current;

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        // `searching` is included so a pending search refetch isn't raced by
        // an infinite-scroll page bump appending results for the old query.
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore && !searching) {
          setPage(p => p + 1);
        }
      },
      { threshold: 0.1, rootMargin: '300px' }
    );
    if (sentinelRef.current) {
      observerRef.current.observe(sentinelRef.current);
    }
    return () => observerRef.current?.disconnect();
  }, [hasMore, loading, loadingMore, searching]);

  const [targetAudienceFilter, setTargetAudienceFilter] = useState('all');
  const [priceFilter, setPriceFilter] = useState('all');
  const [sortBy, setSortBy] = useState('free-first');
  const [completedExamIds, setCompletedExamIds] = useState([]);
  const [approvedExamIds, setApprovedExamIds] = useState([]);
  const [pendingRetakeExamIds, setPendingRetakeExamIds] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  
  // Level filtering
  const [levels, setLevels] = useState([]);
  const [levelFilter, setLevelFilter] = useState('all');
  const [subLevelFilter, setSubLevelFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(true);
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const [subscriptionChecked, setSubscriptionChecked] = useState(false);
  const navigate = useNavigate();
  const { isAuthenticated, user, logout } = useAuth();
  const { mode, toggleMode } = useThemeMode();
  const scrollY = useState(0)[0];
  const isStudent = isAuthenticated && user?.role === 'student';

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  useEffect(() => {
    fetchLevels();
    if (isStudent) {
      fetchExamCompletionStatus();
      fetchRecommendations();
      fetchSubscriptionStatus();
    } else {
      setSubscriptionChecked(true);
    }
  }, [isAuthenticated, user]);

  const fetchSubscriptionStatus = async () => {
    try {
      const response = await api.get('/subscriptions/my/active');
      setHasActiveSubscription(!!response.data);
    } catch (err) {
      setHasActiveSubscription(false);
    } finally {
      setSubscriptionChecked(true);
    }
  };

  // Fetch next page when page increments
  useEffect(() => {
    if (page > 1) {
      fetchMarketplaceExams(page, appliedSearch);
    }
  }, [page]);

  // Debounce typing so each keystroke doesn't hit the server. The timer resets
  // on every keystroke, so the query only fires once the user pauses — long
  // enough (600ms) that a slow typist isn't cut off mid-word.
  useEffect(() => {
    const next = searchTerm.trim();
    // Nothing new to ask the server (e.g. the user only added trailing spaces).
    if (next === appliedSearch) return;
    const timer = setTimeout(() => setAppliedSearch(next), 600);
    return () => clearTimeout(timer);
  }, [searchTerm, appliedSearch]);

  // Load page 1 on mount, and re-query whenever the search changes or the
  // signed-in user changes (the server tailors access flags per student).
  // Depends on user?._id rather than the user object so an unrelated profile
  // refresh doesn't re-run the query.
  useEffect(() => {
    setPage(1);
    setHasMore(true);
    fetchMarketplaceExams(1, appliedSearch);
  }, [appliedSearch, isAuthenticated, user?._id]);

  const fetchLevels = async () => {
    try {
      const response = await api.get('/marketplace/levels');
      setLevels(response.data || []);
    } catch (err) {
      console.error('Error fetching levels:', err);
    }
  };

  // Get available sub-levels for selected level
  const getAvailableSubLevels = () => {
    if (levelFilter === 'all') return [];
    // Try to find by ID first, then by name
    const selectedLevel = levels.find(l => l._id === levelFilter) || 
                         levels.find(l => l.name === levelFilter);
    return selectedLevel?.subLevels?.filter(s => s.isActive) || [];
  };

  const fetchMarketplaceExams = async (pageNum = 1, search = '') => {
    const requestId = ++requestIdRef.current;
    // Only the very first load blanks the page. Every later refetch (a new
    // search, a user change) keeps the current results on screen and shows a
    // small inline spinner instead, so the search box never unmounts and the
    // user can keep typing.
    if (pageNum === 1) {
      if (hasLoadedOnce.current) setSearching(true);
      else setLoading(true);
    } else {
      setLoadingMore(true);
    }
    try {
      const response = await api.get('/marketplace/exams', {
        params: { page: pageNum, limit: 50, ...(search ? { search } : {}) }
      });
      // A newer request was fired while this one was in flight — discard it.
      if (requestId !== requestIdRef.current) return;
      const newExams = response.data;
      setExams(prev => pageNum === 1 ? newExams : [...prev, ...newExams]);
      setHasMore(newExams.length >= 50);
      setError(null);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      console.error('Error fetching marketplace exams:', err);
      setError('Failed to load marketplace exams. Please try again later.');
      // Stop infinite-scroll retries — otherwise the sentinel stays visible
      // (nothing new rendered) and the observer keeps incrementing the page,
      // hammering the server with an unbounded retry loop.
      setHasMore(false);
    } finally {
      if (requestId === requestIdRef.current) {
        hasLoadedOnce.current = true;
        setLoading(false);
        setSearching(false);
        setLoadingMore(false);
      }
    }
  };

  const fetchExamCompletionStatus = async () => {
    // Extra guard: only fetch for authenticated students
    if (!isAuthenticated || user?.role !== 'student') return;
    try {
      const response = await api.get('/marketplace/exam-completion-status');
      setCompletedExamIds(response.data.completedExamIds || []);
      setApprovedExamIds(response.data.approvedExamIds || []);
      setPendingRetakeExamIds(response.data.pendingRetakeExamIds || []);
    } catch (err) {
      console.error('Error fetching exam completion status:', err);
    }
  };

  const fetchRecommendations = async () => {
    // Extra guard: only fetch for authenticated students
    if (!isAuthenticated || user?.role !== 'student') return;
    try {
      setLoadingRecommendations(true);
      const response = await api.get('/marketplace/recommendations');
      setRecommendations(response.data.recommendations || []);
    } catch (err) {
      console.error('Error fetching recommendations:', err);
    } finally {
      setLoadingRecommendations(false);
    }
  };

  const handleRequestAccess = async (examId, isRetake = false) => {
    // Check if user is authenticated as a student
    const isStudent = isAuthenticated && user?.role === 'student';

    if (!isStudent) {
      // Redirect to student registration with the exam as redirect target
      const redirectUrl = `/marketplace/exams/${examId}/request${isRetake ? '?retake=true' : ''}`;
      navigate(`/student-register?redirect=${encodeURIComponent(redirectUrl)}`);
      return;
    }

    // Check if user is already approved for this exam
    if (approvedExamIds.includes(examId) && !isRetake) {
      alert('You have already been approved for this exam. Redirecting to dashboard to take the exam...');
      setTimeout(() => {
        navigate('/student/dashboard');
      }, 2000);
      return;
    }

    // Check if there's already a pending retake request for this exam
    if (isRetake && pendingRetakeExamIds.includes(examId)) {
      alert('You already have a pending retake request for this exam. Redirecting to dashboard to view your pending requests...');
      setTimeout(() => {
        navigate('/student/dashboard');
      }, 2000);
      return;
    }

    // Always redirect to exam request page (for both first time and retake)
    navigate(`/marketplace/exams/${examId}/request${isRetake ? '?retake=true' : ''}`);
  };

  const handleShareExam = async (examId, examTitle) => {
    const redirectUrl = `/marketplace/exams/${examId}/request`;
    const shareUrl = `${window.location.origin}/student-register?redirect=${encodeURIComponent(redirectUrl)}`;
    const shareData = {
      title: examTitle || 'Exam',
      text: `Check out this exam on eexams: ${examTitle || 'Exam'}`,
      url: shareUrl
    };

    // Try modern Web Share API first
    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        // User cancelled or error occurred, fall back to clipboard
        if (err.name !== 'AbortError') {
          console.error('Share failed:', err);
        }
      }
    }

    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(shareUrl);
      alert('Exam link copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      alert('Failed to copy link. Please copy manually: ' + shareUrl);
    }
  };

  // Get unique target audiences from exams
  const uniqueAudiences = [...new Set(exams.map(exam => exam.targetAudience).filter(Boolean))];

  // Same token-AND / multi-field rule the server applies, so results don't
  // shift when the debounced server query lands. Filtering on the live
  // `searchTerm` (not the debounced one) narrows what is already loaded on
  // every keystroke, so typing feels instant while the server call waits.
  const searchTokens = searchTerm.trim().toLowerCase().split(/\s+/).filter(Boolean);

  // The typed term hasn't reached the server yet, or its response is still in
  // flight. Used to say "Searching…" instead of "No exams found" — the wider
  // catalog may well contain a match that simply isn't loaded yet.
  const searchPending = searchTerm.trim() !== appliedSearch || searching;

  const filteredExams = exams.filter(exam => {
    // Search filter — matches title, either description, level or sub-level,
    // so "S3", "secondary school" or "s6 chemistry" all find their exams.
    const haystack = [
      exam.title,
      exam.publicDescription,
      exam.description,
      exam.level?.name,
      exam.subLevel,
      exam.targetAudience
    ].filter(Boolean).join(' ').toLowerCase();
    const matchesSearch = searchTokens.every(token => haystack.includes(token));


    // Level filter - handles both level ID and level name matching
    let matchesLevel = levelFilter === 'all';
    if (!matchesLevel && levelFilter !== 'all') {
      // Check if levelFilter matches level ID
      if (exam.level?._id === levelFilter) {
        matchesLevel = true;
      }
      // Check if levelFilter matches level name (fallback for backward compatibility)
      else if (exam.level?.name === levelFilter) {
        matchesLevel = true;
      }
      // Check if levelFilter matches targetAudience string (legacy exams)
      else if (exam.targetAudience === levelFilter) {
        matchesLevel = true;
      }
    }
    
    // Sub-level filter - only applies when a specific level is selected
    const matchesSubLevel = 
      subLevelFilter === 'all' || 
      exam.subLevel === subLevelFilter;
    
    // Access type filter (renamed conceptually from "price" to accessType)
    const matchesPrice =
      priceFilter === 'all' ||
      (priceFilter === 'free' && exam.accessType !== 'subscription') ||
      (priceFilter === 'paid' && exam.accessType === 'subscription');

    return matchesSearch && matchesLevel && matchesSubLevel && matchesPrice;
  }).sort((a, b) => {
    switch (sortBy) {
      case 'free-first': {
        const freeRank = (a.accessType === 'subscription' ? 1 : 0) - (b.accessType === 'subscription' ? 1 : 0);
        if (freeRank !== 0) return freeRank;
        return new Date(b.createdAt) - new Date(a.createdAt);
      }
      case 'newest':
        return new Date(b.createdAt) - new Date(a.createdAt);
      case 'oldest':
        return new Date(a.createdAt) - new Date(b.createdAt);
      case 'title-asc':
        return (a.title || '').localeCompare(b.title || '');
      case 'title-desc':
        return (b.title || '').localeCompare(a.title || '');
      default:
        return new Date(b.createdAt) - new Date(a.createdAt);
    }
  });

  // Section banners are tied to what actually survived the filters: filtering
  // down to subscription-only results must not leave a stray "Free Exams"
  // header sitting above a list with no free exam in it, and vice versa.
  const hasFreeResults = filteredExams.some(exam => exam.accessType !== 'subscription');
  const hasSubscriptionResults = filteredExams.some(exam => exam.accessType === 'subscription');
  // Only "free-first" sorts the two kinds into contiguous blocks. Under any
  // other sort they interleave, so an inline group header would be wrong (and
  // would repeat at every switch between the two) — those sorts get a single
  // banner above the grid instead.
  const groupedByAccess = sortBy === 'free-first';
  const firstFreeIdx = groupedByAccess
    ? filteredExams.findIndex(exam => exam.accessType !== 'subscription')
    : -1;
  const firstSubscriptionIdx = groupedByAccess
    ? filteredExams.findIndex(exam => exam.accessType === 'subscription')
    : -1;

  // Defined once so the grouped (inline) and ungrouped (top of grid) layouts
  // below render the exact same notice.
  const freeSectionNotice = (
    <Alert severity="success" sx={{ borderRadius: 2 }}>
      <strong>Free Exams</strong> — try one exam per level at no cost, no account needed for these. Once used, subscribe to unlock unlimited exams.
    </Alert>
  );

  const subscriptionSectionNotice = (
    <Alert
      severity="info"
      sx={{ borderRadius: 2 }}
      icon={<WorkspacePremium />}
      action={
        <Button color="inherit" size="small" onClick={() => navigate(isAuthenticated ? '/student/subscriptions' : '/student-register')} sx={{ fontWeight: 'bold' }}>
          {isAuthenticated ? 'Subscribe' : 'Sign Up'}
        </Button>
      }
    >
      <strong>Subscription Exams</strong> — these require an active subscription for your level to unlock.
    </Alert>
  );

  const calculateTotalQuestions = (exam) => {
    return exam.totalQuestions || exam.sections?.reduce((sum, section) => sum + (section.questionCount || section.questions?.length || 0), 0) || 0;
  };

  const clearFilters = () => {
    setSearchTerm('');
    setTargetAudienceFilter('all');
    setLevelFilter('all');
    setSubLevelFilter('all');
    setPriceFilter('all');
    setSortBy('free-first');
  };

  // Handle level change with reset of sub-level
  const handleLevelChange = (newLevelId) => {
    setLevelFilter(newLevelId);
    setSubLevelFilter('all');
  };

  // Format relative time (e.g., "2 days ago", "Just now")
  const formatRelativeTime = (dateString) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} min ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 604800)} weeks ago`;
    if (diffInSeconds < 31536000) return `${Math.floor(diffInSeconds / 2592000)} months ago`;
    return `${Math.floor(diffInSeconds / 31536000)} years ago`;
  };

  // First load only — `loading` is never set again once the page has rendered
  // results, so a search can't blank the screen out from under the user.
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', bgcolor: mode === 'dark' ? '#0F172A' : '#F1F5F9' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <>
      <SEO
        title="Exam Marketplace - Browse Public Exams in Rwanda | eexams"
        description="Discover and access public exams shared by teachers across Rwanda. Browse exam bank, find practice tests, and request access to exams for your studies."
        keywords="exam marketplace, public exams Rwanda, exam bank, practice tests, Rwanda exams, secondary exams, primary exams, national exams, exam sharing, teacher exams, student exams, exam preparation"
        ogUrl="https://www.eexams.net/marketplace"
        canonical="https://www.eexams.net/marketplace"
        breadcrumbs={[
          { name: 'Home', url: 'https://www.eexams.net/' },
          { name: 'Marketplace', url: 'https://www.eexams.net/marketplace' }
        ]}
        structuredData={{
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: 'Exam Marketplace',
          description: 'Browse and access public exams shared by teachers across Rwanda',
          url: 'https://www.eexams.net/marketplace',
          mainEntity: {
            '@type': 'ItemList',
            itemListElement: exams.slice(0, 10).map((exam, index) => ({
              '@type': 'ListItem',
              position: index + 1,
              item: {
                '@type': 'CreativeWork',
                name: exam.title,
                description: exam.publicDescription || exam.description,
                educationalLevel: exam.level?.name || exam.targetAudience,
                learningResourceType: 'Exam',
                offers: exam.publicPrice > 0 ? {
                  '@type': 'Offer',
                  price: exam.publicPrice,
                  priceCurrency: 'RWF'
                } : {
                  '@type': 'Offer',
                  price: '0',
                  priceCurrency: 'RWF'
                }
              }
            }))
          }
        }}
      />
      <Nav
        scrolled={scrollY > 40}
        mode={mode}
        toggleMode={toggleMode}
        isAuthenticated={isAuthenticated}
        user={user}
        handleLogout={handleLogout}
        currentRoute="/marketplace"
      />
      <Box sx={{ minHeight: '100vh', bgcolor: mode === 'dark' ? '#0F172A' : '#F1F5F9', pt: { xs: 10, sm: 14, md: 20 }, pb: { xs: 5, sm: 8 } }}>
        <Box sx={{ maxWidth: 1200, margin: '0 auto', px: { xs: 1.5, sm: 2, md: 3 } }}>
        {/* Header */}
        <Box sx={{ mb: { xs: 3, sm: 4 }, textAlign: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2, gap: 1.5, flexWrap: 'wrap' }}>
            <Button
              onClick={() => navigate(-1)}
              startIcon={<ArrowBack />}
              size="small"
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                color: '#0D406C',
                '&:hover': { bgcolor: 'rgba(13,64,108,0.05)' }
              }}
            >
              Back
            </Button>
            <Typography
              variant="h2"
              fontWeight={600}
              sx={{
                color: mode === 'dark' ? '#F8FAFC' : '#0D406C',
                fontSize: { xs: '1.6rem', sm: '2.4rem', md: '3rem' }
              }}
            >
              Exam Bank
            </Typography>
          </Box>
          <Typography sx={{ color: mode === 'dark' ? '#94A3B8' : '#64748B', maxWidth: 600, mx: 'auto', mb: { xs: 2.5, sm: 4 }, fontSize: { xs: 13, sm: 15, md: 16 } }}>
            Browse and request access to publicly available exams
          </Typography>

          {/* Free-access / subscription notice — shown to logged-out visitors
              and to students without an active subscription */}
          {subscriptionChecked && (!isAuthenticated || (isStudent && !hasActiveSubscription)) && (
            <Box
              onClick={() => navigate(isAuthenticated ? '/student/subscriptions' : '/student-register')}
              sx={{
                maxWidth: 900,
                mx: 'auto',
                mb: 3,
                borderRadius: 999,
                px: { xs: 2, sm: 3 },
                py: { xs: 1.25, sm: 1.5 },
                display: 'flex',
                alignItems: 'center',
                gap: { xs: 1.5, sm: 2 },
                justifyContent: 'space-between',
                cursor: 'pointer',
                background: 'linear-gradient(135deg, #0D406C 0%, #1671C7 100%)',
                boxShadow: '0 6px 20px rgba(13,64,108,0.3)',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                '&:hover': {
                  transform: 'translateY(-1px)',
                  boxShadow: '0 8px 24px rgba(13,64,108,0.4)'
                }
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    bgcolor: 'rgba(255,255,255,0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  <Lock sx={{ color: 'white', fontSize: 16 }} />
                </Box>
                <Typography
                  noWrap
                  sx={{ color: 'white', fontWeight: 600, fontSize: { xs: 12.5, sm: 14.5 }, overflow: 'hidden', textOverflow: 'ellipsis' }}
                >
                  1 free exam per level — unlock the rest
                </Typography>
              </Box>
              <Button
                variant="contained"
                endIcon={<ArrowForward sx={{ fontSize: 16 }} />}
                sx={{
                  borderRadius: 999,
                  textTransform: 'none',
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  bgcolor: 'white',
                  color: '#0D406C',
                  px: { xs: 1.75, sm: 2.5 },
                  py: 0.5,
                  minWidth: 0,
                  fontSize: { xs: 12, sm: 13.5 },
                  boxShadow: 'none',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.9)', boxShadow: 'none' }
                }}
              >
                {isAuthenticated ? 'Subscribe' : 'Sign Up'}
              </Button>
            </Box>
          )}

          {/* Compact Filters Section */}
          <Box 
            sx={{ 
              maxWidth: 900, 
              mx: 'auto', 
              bgcolor: mode === 'dark' ? '#1E293B' : 'white',
              boxShadow: mode === 'dark' ? '0 1px 3px rgba(0,0,0,0.2)' : '0 1px 3px rgba(0,0,0,0.05)',
              borderRadius: 2,
              p: { xs: 2, sm: 2.5 },
              mb: 3
            }}
          >
            {/* Header with Toggle */}
            <Box 
              sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                cursor: 'pointer'
              }}
              onClick={() => setShowFilters(!showFilters)}
            >
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <FilterList sx={{ mr: 1, color: mode === 'dark' ? '#94A3B8' : '#0D406C', fontSize: 20 }} />
                <Typography fontWeight={600} sx={{ color: mode === 'dark' ? '#F8FAFC' : '#0F172A', fontSize: 15 }}>
                  Filter Exams
                </Typography>
                {(searchTerm || levelFilter !== 'all' || subLevelFilter !== 'all' || priceFilter !== 'all' || sortBy !== 'free-first') && (
                  <Chip
                    label={`${[
                      searchTerm && 'search',
                      levelFilter !== 'all' && (levels.find(l => l._id === levelFilter)?.name || levelFilter),
                      subLevelFilter !== 'all' && subLevelFilter,
                      priceFilter !== 'all' && priceFilter,
                      sortBy !== 'free-first' && 'sort'
                    ].filter(Boolean).length} active`}
                    size="small"
                    sx={{ ml: 2, bgcolor: '#0CBD73', color: 'white', fontWeight: 600, height: 22, fontSize: 11 }}
                  />
                )}
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {(searchTerm || levelFilter !== 'all' || subLevelFilter !== 'all' || priceFilter !== 'all' || sortBy !== 'free-first') && (
                  <Button
                    onClick={(e) => { e.stopPropagation(); clearFilters(); }}
                    size="small"
                    variant="text"
                    sx={{ borderRadius: 1.5, textTransform: 'none', fontWeight: 600, fontSize: 13, color: '#64748B', minWidth: 'auto', px: 1.5 }}
                  >
                    Clear
                  </Button>
                )}
                {showFilters ? <KeyboardArrowUp sx={{ color: mode === 'dark' ? '#94A3B8' : '#64748B' }} /> : <KeyboardArrowDown sx={{ color: mode === 'dark' ? '#94A3B8' : '#64748B' }} />}
              </Box>
            </Box>
            
            {/* Collapsible Filter Content */}
            <Collapse in={showFilters} timeout={300}>
              <Grid container spacing={{ xs: 1.5, sm: 2 }} alignItems="center" sx={{ mt: 2 }}>
                {/* Search */}
                <Grid item xs={12} sm={6} md={4}>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Search by subject or level (e.g. S3, chemistry)"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    InputProps={{
                      startAdornment: <Search sx={{ color: mode === 'dark' ? '#64748B' : '#94A3B8', mr: 0.5, fontSize: 18 }} />,
                      // Progress lives inside the field so the results below stay
                      // put — nothing jumps or unmounts while the user types.
                      endAdornment: searchPending && searchTerm.trim() ? (
                        <CircularProgress size={16} sx={{ color: mode === 'dark' ? '#64748B' : '#94A3B8' }} />
                      ) : null,
                      sx: { borderRadius: 1.5, fontSize: 14, bgcolor: mode === 'dark' ? '#0F172A' : 'white' }
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': { borderRadius: 1.5 }
                    }}
                  />
                </Grid>

                {/* Level Filter - Primary */}
                <Grid item xs={12} sm={3} md={2}>
                  <SearchableSelect
                    label="Level"
                    value={levelFilter}
                    onChange={(value) => handleLevelChange(value || 'all')}
                    emptyValue="all"
                    placeholder="Search levels..."
                    options={[
                      { value: 'all', label: 'All' },
                      ...(levels.length > 0
                        ? levels.map(level => {
                            const subCount = level.subLevels?.filter(s => s.isActive).length || 0;
                            return {
                              value: level._id,
                              label: subCount > 0 ? `${level.name} (${subCount} sub)` : level.name
                            };
                          })
                        : uniqueAudiences.map(audience => ({ value: audience, label: audience })))
                    ]}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5, fontSize: 14 } }}
                  />
                </Grid>

                {/* Sub-Level Filter - Secondary (only shown if level has sub-levels) */}
                <Grid item xs={12} sm={3} md={2}>
                  <FormControl fullWidth size="small" disabled={getAvailableSubLevels().length === 0}>
                    <InputLabel sx={{ fontSize: 13 }}>Sub-Level</InputLabel>
                    <Select
                      value={subLevelFilter}
                      onChange={(e) => setSubLevelFilter(e.target.value)}
                      label="Sub-Level"
                      sx={{ borderRadius: 1.5, fontSize: 14 }}
                    >
                      <MenuItem value="all">
                        {getAvailableSubLevels().length === 0 ? 'No sub-levels' : 'All'}
                      </MenuItem>
                      {getAvailableSubLevels().map(subLevel => (
                        <MenuItem key={subLevel._id} value={subLevel.name}>
                          {subLevel.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                {/* Access Type Filter */}
                <Grid item xs={6} sm={3} md={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel sx={{ fontSize: 13 }}>Access</InputLabel>
                    <Select
                      value={priceFilter}
                      onChange={(e) => setPriceFilter(e.target.value)}
                      label="Access"
                      sx={{ borderRadius: 1.5, fontSize: 14 }}
                    >
                      <MenuItem value="all">All</MenuItem>
                      <MenuItem value="free">Free</MenuItem>
                      <MenuItem value="paid">Subscription</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                {/* Sort By */}
                <Grid item xs={6} sm={3} md={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel sx={{ fontSize: 13 }}>Sort</InputLabel>
                    <Select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      label="Sort"
                      sx={{ borderRadius: 1.5, fontSize: 14 }}
                    >
                      <MenuItem value="free-first">Free First</MenuItem>
                      <MenuItem value="newest">Newest</MenuItem>
                      <MenuItem value="oldest">Oldest</MenuItem>
                      <MenuItem value="title-asc">A-Z</MenuItem>
                      <MenuItem value="title-desc">Z-A</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </Collapse>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 4, maxWidth: 600, mx: 'auto' }}>
            {error}
          </Alert>
        )}

        {/* Personalized Recommendations Section */}
        {isStudent && recommendations.length > 0 && (
          <Box sx={{ mb: { xs: 3, sm: 5 } }}>
            <Typography variant="h6" fontWeight={600} sx={{ mb: 1.5, color: mode === 'dark' ? '#F8FAFC' : '#0D406C', display: 'flex', alignItems: 'center', gap: 1, fontSize: { xs: '1rem', sm: '1.25rem' } }}>
              <Box component="span">🎯</Box>
              Recommended For You
            </Typography>
            <Typography variant="body2" sx={{ color: mode === 'dark' ? '#94A3B8' : '#64748B', mb: 2, fontSize: { xs: 12, sm: 14 } }}>
              Based on your exam history
            </Typography>
            <Grid container spacing={{ xs: 1.5, sm: 2 }}>
              {recommendations.slice(0, 3).map((exam) => {
                const totalQuestions = calculateTotalQuestions(exam);
                const isCompleted = completedExamIds.includes(exam._id);
                const isFreeExam = exam.accessType !== 'subscription';
                return (
                  <Grid item xs={12} sm={6} md={4} key={`rec-${exam._id}`}>
                    <Card
                      elevation={0}
                      sx={{
                        borderRadius: 2,
                        border: '1px solid #0CBD73',
                        bgcolor: mode === 'dark' ? '#1E293B' : 'white',
                        transition: 'all 0.15s ease',
                        cursor: 'pointer',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        '&:hover': {
                          transform: 'translateY(-2px)',
                          boxShadow: '0 2px 8px rgba(12,189,115,0.15)'
                        }
                      }}
                    >
                      <CardContent sx={{ p: { xs: 1.5, sm: 2.5 }, '&:last-child': { pb: { xs: 1.5, sm: 2.5 } }, display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                          <Chip
                            label="Recommended"
                            size="small"
                            sx={{
                              background: '#0CBD73',
                              color: 'white',
                              fontWeight: 600,
                              fontSize: 10
                            }}
                          />
                          {(exam.level?.name || exam.targetAudience || exam.subLevel) && (
                            <Chip
                              label={exam.subLevel 
                                ? `${exam.level?.name || exam.targetAudience} - ${exam.subLevel}`
                                : (exam.level?.name || exam.targetAudience)}
                              size="small"
                              sx={{
                                background: 'rgba(13,71,161,0.1)',
                                color: '#0D406C',
                                fontWeight: 600,
                                fontSize: 10
                              }}
                            />
                          )}
                        </Box>
                        <Typography variant="subtitle1" fontWeight={600} sx={{
                          mb: 1,
                          color: mode === 'dark' ? '#F8FAFC' : '#0F172A',
                          fontSize: 16,
                          lineHeight: 1.3,
                          minHeight: 42,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden'
                        }}>
                          {exam.title}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
                          <Chip
                            label={`${totalQuestions} Questions`}
                            size="small"
                            variant="outlined"
                            sx={{ fontSize: 10 }}
                          />
                          <Chip
                            label={`${exam.timeLimit} min`}
                            size="small"
                            variant="outlined"
                            sx={{ fontSize: 10 }}
                          />
                        </Box>
                        <Button
                          fullWidth
                          variant="contained"
                          size="small"
                          startIcon={!isCompleted && isFreeExam ? <PlayArrow /> : undefined}
                          onClick={() => handleRequestAccess(exam._id, isCompleted)}
                          sx={{
                            mt: 'auto',
                            borderRadius: 2,
                            textTransform: 'none',
                            fontWeight: !isCompleted && isFreeExam ? 700 : 500,
                            background: isCompleted
                              ? '#8B5CF6'
                              : (isFreeExam ? '#0CBD73' : '#0D406C'),
                            fontSize: 12,
                            '&:hover': {
                              background: isCompleted
                                ? '#7C3AED'
                                : (isFreeExam ? '#0AA865' : '#0A3355')
                            }
                          }}
                        >
                          {isCompleted ? 'Retake' : (isFreeExam ? 'Start Exam' : 'Request Access')}
                        </Button>
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          </Box>
        )}

        {/* Exam Grid */}
        {filteredExams.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: { xs: 5, sm: 8 } }}>
            {searchPending ? (
              <>
                <CircularProgress size={32} sx={{ mb: 2, color: mode === 'dark' ? '#475569' : '#CBD5E1' }} />
                <Typography variant="h6" sx={{ color: mode === 'dark' ? '#94A3B8' : '#64748B' }}>
                  Searching the exam bank…
                </Typography>
              </>
            ) : (
              <>
                <School sx={{ fontSize: { xs: 48, sm: 64 }, color: mode === 'dark' ? '#475569' : '#CBD5E1', mb: 2 }} />
                <Typography variant="h6" sx={{ color: mode === 'dark' ? '#94A3B8' : '#64748B', mb: 1 }}>
                  {searchTerm ? 'No exams found matching your search' : 'No exams available in the exam bank yet'}
                </Typography>
                <Typography sx={{ color: mode === 'dark' ? '#64748B' : '#94A3B8' }}>
                  {searchTerm ? 'Try different keywords' : 'Check back later for new exams'}
                </Typography>
              </>
            )}
          </Box>
        ) : (
          <Grid
            container
            spacing={{ xs: 2, sm: 3 }}
            sx={{ opacity: searching ? 0.55 : 1, transition: 'opacity 0.2s ease' }}
          >
            {/* Ungrouped sorts interleave the two kinds, so their banners go
                once at the top rather than inline between the cards. */}
            {!groupedByAccess && hasFreeResults && (
              <Grid item xs={12}>{freeSectionNotice}</Grid>
            )}
            {!groupedByAccess && hasSubscriptionResults && (
              <Grid item xs={12}>{subscriptionSectionNotice}</Grid>
            )}
            {filteredExams.map((exam, idx) => {
              // Each banner renders at most once, and only when its section is
              // non-empty after filtering.
              const isFirstFree = idx === firstFreeIdx;
              const isFirstSubscription = idx === firstSubscriptionIdx;

              return (
              <React.Fragment key={exam._id}>
                {isFirstFree && (
                  <Grid item xs={12}>{freeSectionNotice}</Grid>
                )}
                {isFirstSubscription && (
                  <Grid item xs={12}>{subscriptionSectionNotice}</Grid>
                )}
              <Grid item xs={12} sm={6} md={4}>
                <Card
                  elevation={0}
                  sx={{
                    borderRadius: 2,
                    border: mode === 'dark' ? '1px solid #334155' : '1px solid #E2E8F0',
                    bgcolor: mode === 'dark' ? '#1E293B' : 'white',
                    transition: 'all 0.15s ease',
                    cursor: 'pointer',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: mode === 'dark' ? '0 2px 8px rgba(0,0,0,0.2)' : '0 1px 3px rgba(15,23,42,0.08)'
                    }
                  }}
                >
                  <CardContent sx={{ p: { xs: 2, sm: 3 }, '&:last-child': { pb: { xs: 2, sm: 3 } }, display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                    {/* Header with badges */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5, gap: 1 }}>
                      <Chip 
                        label="Public Exam" 
                        size="small" 
                        sx={{ 
                          background: '#0CBD73',
                          color: 'white',
                          fontWeight: 600,
                          fontSize: 11,
                          letterSpacing: '0.02em'
                        }} 
                      />
                      {(exam.targetAudience || exam.level?.name || exam.subLevel) && (
                        <Chip
                          label={exam.subLevel
                            ? `${exam.level?.name || exam.targetAudience} - ${exam.subLevel}`
                            : (exam.targetAudience || exam.level?.name)}
                          size="small"
                          sx={{
                            background: 'rgba(13,71,161,0.1)',
                            color: '#0D406C',
                            fontWeight: 600,
                            fontSize: 10,
                            maxWidth: 160,
                            '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
                          }}
                        />
                      )}
                    </Box>

                    {/* Published Date */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                      <TimeIcon sx={{ fontSize: 13, color: mode === 'dark' ? '#64748B' : '#94A3B8' }} />
                      <Typography sx={{ fontSize: 11, color: mode === 'dark' ? '#64748B' : '#94A3B8', fontWeight: 500 }}>
                        Published {formatRelativeTime(exam.createdAt)}
                      </Typography>
                    </Box>

                    {/* Title */}
                    <Typography variant="h6" fontWeight={600} sx={{
                      mb: 1,
                      color: mode === 'dark' ? '#F8FAFC' : '#0F172A',
                      lineHeight: 1.3,
                      fontSize: { xs: 15, sm: 17, md: 18 },
                      minHeight: { xs: 39, sm: 45, md: 47 },
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}>
                      {exam.title}
                    </Typography>
                    
                    {/* Description */}
                    <Typography
                      variant="body2"
                      sx={{
                        color: mode === 'dark' ? '#94A3B8' : '#64748B',
                        mb: 2,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        lineHeight: 1.5,
                        fontSize: { xs: 12, sm: 13 },
                        minHeight: { xs: 36, sm: 39 }
                      }}
                    >
                      {exam.publicDescription || exam.description}
                    </Typography>

                    {/* Stats */}
                    <Box sx={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 1,
                      mb: 2,
                      p: { xs: 1.5, sm: 2 },
                      borderRadius: 2,
                      background: mode === 'dark' ? 'rgba(30,41,59,0.8)' : 'rgba(241,245,249,0.8)'
                    }}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography sx={{ fontSize: { xs: 17, sm: 20 }, fontWeight: 700, color: mode === 'dark' ? '#F8FAFC' : '#0D406C', lineHeight: 1, mb: 0.25 }}>
                          {calculateTotalQuestions(exam)}
                        </Typography>
                        <Typography sx={{ fontSize: 10, fontWeight: 500, color: mode === 'dark' ? '#94A3B8' : '#64748B', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                          Questions
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography sx={{ fontSize: { xs: 17, sm: 20 }, fontWeight: 700, color: '#0CBD73', lineHeight: 1, mb: 0.25 }}>
                          {exam.timeLimit}
                        </Typography>
                        <Typography sx={{ fontSize: 10, fontWeight: 500, color: mode === 'dark' ? '#94A3B8' : '#64748B', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                          Minutes
                        </Typography>
                      </Box>
                    </Box>

                    {/* Access type badge */}
                    {exam.accessType === 'subscription' ? (
                      <Box sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 0.5,
                        py: 1,
                        px: 1.5,
                        borderRadius: 2,
                        background: 'rgba(99,102,241,0.08)',
                        border: '1px solid rgba(99,102,241,0.2)',
                        mt: 'auto',
                        mb: 1.5
                      }}>
                        <Typography sx={{ fontSize: { xs: 13, sm: 15 }, fontWeight: 700, color: '#6366F1' }}>
                          🔒 Subscription Required
                        </Typography>
                      </Box>
                    ) : (
                      <Box sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        py: 1,
                        px: 1.5,
                        borderRadius: 2,
                        background: 'rgba(12,189,115,0.08)',
                        border: '1px solid rgba(12,189,115,0.2)',
                        mt: 'auto',
                        mb: 1.5
                      }}>
                        <Typography sx={{ fontSize: { xs: 13, sm: 15 }, fontWeight: 700, color: '#0CBD73' }}>
                          ✓ Free
                        </Typography>
                      </Box>
                    )}

                    <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
                      {(() => {
                        const isCompleted = completedExamIds.includes(exam._id);
                        const isApproved = approvedExamIds.includes(exam._id);
                        const hasPendingRetake = pendingRetakeExamIds.includes(exam._id);
                        const isFreeExam = exam.accessType !== 'subscription';

                        if (isCompleted) {
                          if (hasPendingRetake) {
                            return (
                              <Button
                                fullWidth
                                variant="contained"
                                disabled
                                sx={{
                                  borderRadius: 2,
                                  textTransform: 'none',
                                  fontWeight: 700,
                                  background: '#FEF3C7',
                                  color: '#D97706'
                                }}
                              >
                                Retake Pending
                              </Button>
                            );
                          }
                          return (
                            <Button
                              fullWidth
                              variant="contained"
                              onClick={() => handleRequestAccess(exam._id, true)}
                              sx={{
                                borderRadius: 2,
                                textTransform: 'none',
                                fontWeight: 500,
                                background: '#8B5CF6',
                                boxShadow: '0 1px 3px rgba(139,92,246,0.2)'
                              }}
                            >
                              Retake Exam
                            </Button>
                          );
                        } else if (isApproved) {
                          return (
                            <Button
                              fullWidth
                              variant="contained"
                              disabled
                              sx={{
                                borderRadius: 2,
                                textTransform: 'none',
                                fontWeight: 700,
                                background: '#E2E8F0',
                                color: '#64748B'
                              }}
                            >
                              Already Approved
                            </Button>
                          );
                        } else {
                          return (
                            <Button
                              fullWidth
                              variant="contained"
                              startIcon={isFreeExam ? <PlayArrow /> : undefined}
                              onClick={() => handleRequestAccess(exam._id, false)}
                              sx={{
                                borderRadius: 2,
                                textTransform: 'none',
                                fontWeight: isFreeExam ? 700 : 500,
                                fontSize: isFreeExam ? 15 : 'inherit',
                                background: isFreeExam ? '#0CBD73' : '#0D406C',
                                boxShadow: isFreeExam
                                  ? '0 2px 6px rgba(12,189,115,0.3)'
                                  : '0 1px 3px rgba(13,64,108,0.15)',
                                '&:hover': {
                                  background: isFreeExam ? '#0AA865' : '#0A3355'
                                }
                              }}
                            >
                              {isFreeExam ? 'Start Exam' : 'Request Access'}
                            </Button>
                          );
                        }
                      })()}
                      <Button
                        variant="outlined"
                        onClick={() => handleShareExam(exam._id, exam.title)}
                        sx={{
                          borderRadius: 2,
                          textTransform: 'none',
                          fontWeight: 700,
                          minWidth: 48,
                          borderColor: mode === 'dark' ? '#94A3B8' : '#0D406C',
                          color: mode === 'dark' ? '#94A3B8' : '#0D406C'
                        }}
                      >
                        <Share />
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
              </React.Fragment>
              );
            })}
          </Grid>
        )}

        {/* Infinite scroll sentinel */}
        {hasMore && !loading && (
          <Box ref={setSentinelRef} sx={{ display: 'flex', justifyContent: 'center', mt: 4, py: 2 }}>
            {loadingMore && <CircularProgress size={28} />}
          </Box>
        )}
      </Box>
    </Box>
    </>
  );
};

export default Marketplace;
