import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Card, CardContent, Button, Chip, CircularProgress, Alert, TextField, Grid, FormControl, InputLabel, Select, MenuItem, Accordion, AccordionSummary, AccordionDetails, Collapse } from '@mui/material';
import { Search, School, AccessTime, AttachMoney, FilterList, ExpandMore, Share, Sort, AccessTime as TimeIcon, KeyboardArrowDown, KeyboardArrowUp, ArrowBack } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useThemeMode } from '../context/ThemeContext';
import Nav from '../components/Nav';
import SEO from '../components/SEO';
import api from '../services/api';

const Marketplace = () => {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);

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
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
          setPage(p => p + 1);
        }
      },
      { threshold: 0.1, rootMargin: '300px' }
    );
    if (sentinelRef.current) {
      observerRef.current.observe(sentinelRef.current);
    }
    return () => observerRef.current?.disconnect();
  }, [hasMore, loading, loadingMore]);
  const [searchTerm, setSearchTerm] = useState('');
  const [targetAudienceFilter, setTargetAudienceFilter] = useState('all');
  const [priceFilter, setPriceFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
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
    fetchMarketplaceExams();
    fetchLevels();
    if (isStudent) {
      fetchExamCompletionStatus();
      fetchRecommendations();
    }
  }, [isAuthenticated, user]);

  // Fetch next page when page increments
  useEffect(() => {
    if (page > 1) {
      fetchMarketplaceExams(page);
    }
  }, [page]);

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

  const fetchMarketplaceExams = async (pageNum = 1) => {
    try {
      if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);
      const response = await api.get('/marketplace/exams', {
        params: { page: pageNum, limit: 50 }
      });
      const newExams = response.data;
      setExams(prev => pageNum === 1 ? newExams : [...prev, ...newExams]);
      setHasMore(newExams.length >= 50);
    } catch (err) {
      console.error('Error fetching marketplace exams:', err);
      setError('Failed to load marketplace exams. Please try again later.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
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

  const filteredExams = exams.filter(exam => {
    // Search filter
    const matchesSearch = 
      exam.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      exam.publicDescription?.toLowerCase().includes(searchTerm.toLowerCase());
    
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
    
    // Price filter
    const matchesPrice = 
      priceFilter === 'all' ||
      (priceFilter === 'free' && exam.publicPrice === 0) ||
      (priceFilter === 'paid' && exam.publicPrice > 0);
    
    return matchesSearch && matchesLevel && matchesSubLevel && matchesPrice;
  }).sort((a, b) => {
    // Sort logic
    switch (sortBy) {
      case 'newest':
        return new Date(b.createdAt) - new Date(a.createdAt);
      case 'oldest':
        return new Date(a.createdAt) - new Date(b.createdAt);
      case 'price-low':
        return (a.publicPrice || 0) - (b.publicPrice || 0);
      case 'price-high':
        return (b.publicPrice || 0) - (a.publicPrice || 0);
      case 'title-asc':
        return (a.title || '').localeCompare(b.title || '');
      case 'title-desc':
        return (b.title || '').localeCompare(a.title || '');
      default:
        return new Date(b.createdAt) - new Date(a.createdAt);
    }
  });

  const calculateTotalQuestions = (exam) => {
    return exam.totalQuestions || exam.sections?.reduce((sum, section) => sum + (section.questionCount || section.questions?.length || 0), 0) || 0;
  };

  const clearFilters = () => {
    setSearchTerm('');
    setTargetAudienceFilter('all');
    setLevelFilter('all');
    setSubLevelFilter('all');
    setPriceFilter('all');
    setSortBy('newest');
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

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', bgcolor: '#F1F5F9' }}>
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
      <Box sx={{ minHeight: '100vh', bgcolor: '#F1F5F9', pt: 20, pb: 8 }}>
        <Box sx={{ maxWidth: 1200, margin: '0 auto', px: 3 }}>
        {/* Header */}
        <Box sx={{ mb: 4, textAlign: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2, gap: 2 }}>
            <Button
              onClick={() => navigate(-1)}
              startIcon={<ArrowBack />}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                color: '#0D406C',
                '&:hover': {
                  bgcolor: 'rgba(13,64,108,0.05)'
                }
              }}
            >
              Back
            </Button>
            <Typography variant="h2" fontWeight={800} sx={{ color: '#0D406C' }}>
              Exam Bank
            </Typography>
          </Box>
          <Typography sx={{ color: '#64748B', maxWidth: 600, mx: 'auto', mb: 4, fontSize: 16 }}>
            Browse and request access to publicly available exams
          </Typography>

          {/* Compact Filters Section */}
          <Box 
            sx={{ 
              maxWidth: 900, 
              mx: 'auto', 
              bgcolor: 'white',
              boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
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
                <FilterList sx={{ mr: 1, color: '#0D406C', fontSize: 20 }} />
                <Typography fontWeight={700} sx={{ color: '#0F172A', fontSize: 15 }}>
                  Filter Exams
                </Typography>
                {(searchTerm || levelFilter !== 'all' || subLevelFilter !== 'all' || priceFilter !== 'all' || sortBy !== 'newest') && (
                  <Chip 
                    label={`${[
                      searchTerm && 'search', 
                      levelFilter !== 'all' && (levels.find(l => l._id === levelFilter)?.name || levelFilter), 
                      subLevelFilter !== 'all' && subLevelFilter, 
                      priceFilter !== 'all' && priceFilter, 
                      sortBy !== 'newest' && 'sort'
                    ].filter(Boolean).length} active`}
                    size="small"
                    sx={{ ml: 2, bgcolor: '#0CBD73', color: 'white', fontWeight: 600, height: 22, fontSize: 11 }}
                  />
                )}
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {(searchTerm || levelFilter !== 'all' || subLevelFilter !== 'all' || priceFilter !== 'all' || sortBy !== 'newest') && (
                  <Button
                    onClick={(e) => { e.stopPropagation(); clearFilters(); }}
                    size="small"
                    variant="text"
                    sx={{ borderRadius: 1.5, textTransform: 'none', fontWeight: 600, fontSize: 13, color: '#64748B', minWidth: 'auto', px: 1.5 }}
                  >
                    Clear
                  </Button>
                )}
                {showFilters ? <KeyboardArrowUp sx={{ color: '#64748B' }} /> : <KeyboardArrowDown sx={{ color: '#64748B' }} />}
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
                    placeholder="Search exams..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    InputProps={{
                      startAdornment: <Search sx={{ color: '#94A3B8', mr: 0.5, fontSize: 18 }} />,
                      sx: { borderRadius: 1.5, fontSize: 14 }
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': { borderRadius: 1.5 }
                    }}
                  />
                </Grid>

                {/* Level Filter - Primary */}
                <Grid item xs={6} sm={3} md={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel sx={{ fontSize: 13 }}>Level</InputLabel>
                    <Select
                      value={levelFilter}
                      onChange={(e) => handleLevelChange(e.target.value)}
                      label="Level"
                      sx={{ borderRadius: 1.5, fontSize: 14 }}
                    >
                      <MenuItem value="all">All</MenuItem>
                      {levels.map(level => (
                        <MenuItem key={level._id} value={level._id}>
                          {level.name}
                          {level.subLevels?.filter(s => s.isActive).length > 0 && (
                            <Typography component="span" variant="caption" sx={{ ml: 1, color: '#0CBD73', fontSize: 10 }}>
                              ({level.subLevels.filter(s => s.isActive).length} sub)
                            </Typography>
                          )}
                        </MenuItem>
                      ))}
                      {levels.length === 0 && uniqueAudiences.length > 0 && (
                        uniqueAudiences.map(audience => (
                          <MenuItem key={audience} value={audience}>{audience}</MenuItem>
                        ))
                      )}
                    </Select>
                  </FormControl>
                </Grid>

                {/* Sub-Level Filter - Secondary (only shown if level has sub-levels) */}
                <Grid item xs={6} sm={3} md={2}>
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

                {/* Price Filter */}
                <Grid item xs={6} sm={3} md={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel sx={{ fontSize: 13 }}>Price</InputLabel>
                    <Select
                      value={priceFilter}
                      onChange={(e) => setPriceFilter(e.target.value)}
                      label="Price"
                      sx={{ borderRadius: 1.5, fontSize: 14 }}
                    >
                      <MenuItem value="all">All</MenuItem>
                      <MenuItem value="free">Free</MenuItem>
                      <MenuItem value="paid">Paid</MenuItem>
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
                      <MenuItem value="newest">Newest</MenuItem>
                      <MenuItem value="oldest">Oldest</MenuItem>
                      <MenuItem value="price-low">Price: Low</MenuItem>
                      <MenuItem value="price-high">Price: High</MenuItem>
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
          <Box sx={{ mb: 5 }}>
            <Typography variant="h5" fontWeight={700} sx={{ mb: 3, color: '#0D406C', display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box component="span" sx={{ fontSize: 24 }}>🎯</Box>
              Recommended For You
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748B', mb: 2 }}>
              Based on your exam history
            </Typography>
            <Grid container spacing={2}>
              {recommendations.slice(0, 3).map((exam) => {
                const totalQuestions = calculateTotalQuestions(exam);
                const isCompleted = completedExamIds.includes(exam._id);
                return (
                  <Grid item xs={12} sm={6} md={4} key={`rec-${exam._id}`}>
                    <Card
                      elevation={0}
                      sx={{
                        borderRadius: 3,
                        border: '2px solid #0CBD73',
                        transition: 'all 0.3s',
                        cursor: 'pointer',
                        '&:hover': {
                          transform: 'translateY(-4px)',
                          boxShadow: '0 12px 24px rgba(12,189,115,0.2)'
                        }
                      }}
                    >
                      <CardContent sx={{ p: 2.5 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                          <Chip
                            label="Recommended"
                            size="small"
                            sx={{
                              background: 'linear-gradient(135deg, #0CBD73 0%, #5AD5A2 100%)',
                              color: 'white',
                              fontWeight: 700,
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
                        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1, color: '#0F172A', fontSize: 16, lineHeight: 1.3 }}>
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
                          onClick={() => handleRequestAccess(exam._id, isCompleted)}
                          sx={{
                            borderRadius: 2,
                            textTransform: 'none',
                            fontWeight: 700,
                            background: isCompleted
                              ? 'linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%)'
                              : 'linear-gradient(135deg, #0D406C 0%, #0CBD73 100%)',
                            fontSize: 12
                          }}
                        >
                          {isCompleted ? 'Retake' : 'Request Access'}
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
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <School sx={{ fontSize: 64, color: '#CBD5E1', mb: 2 }} />
            <Typography variant="h6" sx={{ color: '#64748B', mb: 1 }}>
              {searchTerm ? 'No exams found matching your search' : 'No exams available in the exam bank yet'}
            </Typography>
            <Typography sx={{ color: '#94A3B8' }}>
              {searchTerm ? 'Try different keywords' : 'Check back later for new exams'}
            </Typography>
          </Box>
        ) : (
          <Grid container spacing={3}>
            {filteredExams.map((exam) => (
              <Grid item xs={12} sm={6} md={4} key={exam._id}>
                <Card 
                  elevation={0} 
                  sx={{ 
                    borderRadius: 4, 
                    border: '1px solid #E2E8F0',
                    transition: 'all 0.3s',
                    cursor: 'pointer',
                    '&:hover': {
                      transform: 'translateY(-6px)',
                      boxShadow: '0 24px 48px rgba(15,23,42,0.12)'
                    }
                  }}
                >
                  <CardContent sx={{ p: 3 }}>
                    {/* Header with badges */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                      <Chip 
                        label="Public Exam" 
                        size="small" 
                        sx={{ 
                          background: 'linear-gradient(135deg, #0CBD73 0%, #5AD5A2 100%)',
                          color: 'white',
                          fontWeight: 700,
                          fontSize: 11,
                          letterSpacing: '0.04em'
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
                            fontSize: 11
                          }}
                        />
                      )}
                    </Box>
                    
                    {/* Published Date */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1.5 }}>
                      <TimeIcon sx={{ fontSize: 14, color: '#94A3B8' }} />
                      <Typography sx={{ fontSize: 12, color: '#94A3B8', fontWeight: 500 }}>
                        Published {formatRelativeTime(exam.createdAt)}
                      </Typography>
                    </Box>
                    
                    {/* Title */}
                    <Typography variant="h6" fontWeight={700} sx={{ mb: 1.5, color: '#0F172A', lineHeight: 1.3, fontSize: 20 }}>
                      {exam.title}
                    </Typography>
                    
                    {/* Description */}
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        color: '#64748B', 
                        mb: 2.5,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        lineHeight: 1.6
                      }}
                    >
                      {exam.publicDescription || exam.description}
                    </Typography>

                    {/* Stats */}
                    <Box sx={{ 
                      display: 'grid', 
                      gridTemplateColumns: '1fr 1fr', 
                      gap: 1.5, 
                      mb: 2.5, 
                      p: 2, 
                      borderRadius: 3, 
                      background: 'rgba(241,245,249,0.8)' 
                    }}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography sx={{ fontSize: 24, fontWeight: 800, color: '#0D406C', lineHeight: 1, mb: 0.5 }}>
                          {calculateTotalQuestions(exam)}
                        </Typography>
                        <Typography sx={{ fontSize: 11, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Questions
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography sx={{ fontSize: 24, fontWeight: 800, color: '#0CBD73', lineHeight: 1, mb: 0.5 }}>
                          {exam.timeLimit}
                        </Typography>
                        <Typography sx={{ fontSize: 11, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Minutes
                        </Typography>
                      </Box>
                    </Box>

                    {/* Price or Free indicator */}
                    {exam.publicPrice > 0 ? (
                      <Box sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between', 
                        p: 1.5, 
                        borderRadius: 2.5, 
                        background: 'rgba(245,158,11,0.08)', 
                        border: '1px solid rgba(245,158,11,0.2)',
                        mb: 2
                      }}>
                        <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#64748B' }}>Price</Typography>
                        <Typography sx={{ fontSize: 16, fontWeight: 700, color: '#F59E0B' }}>
                          RWF {exam.publicPrice.toLocaleString()}
                        </Typography>
                      </Box>
                    ) : (
                      <Box sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        p: 1.5, 
                        borderRadius: 2.5, 
                        background: 'rgba(12,189,115,0.08)', 
                        border: '1px solid rgba(12,189,115,0.2)',
                        mb: 2
                      }}>
                        <Typography sx={{ fontSize: 16, fontWeight: 700, color: '#0CBD73' }}>
                          Free
                        </Typography>
                      </Box>
                    )}

                    <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                      {(() => {
                        const isCompleted = completedExamIds.includes(exam._id);
                        const isApproved = approvedExamIds.includes(exam._id);
                        const hasPendingRetake = pendingRetakeExamIds.includes(exam._id);
                        
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
                                fontWeight: 700,
                                background: 'linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%)',
                                boxShadow: '0 4px 12px rgba(139,92,246,0.35)'
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
                              onClick={() => handleRequestAccess(exam._id, false)}
                              sx={{
                                borderRadius: 2,
                                textTransform: 'none',
                                fontWeight: 700,
                                background: 'linear-gradient(135deg, #0D406C 0%, #0CBD73 100%)',
                                boxShadow: '0 4px 12px rgba(12,189,115,0.35)'
                              }}
                            >
                              Request Access
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
                          borderColor: '#0D406C',
                          color: '#0D406C'
                        }}
                      >
                        <Share />
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
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
