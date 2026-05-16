import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Card, CardContent, Button, Chip, CircularProgress, Alert, TextField, Grid, FormControl, InputLabel, Select, MenuItem, Accordion, AccordionSummary, AccordionDetails } from '@mui/material';
import { Search, School, AccessTime, AttachMoney, FilterList, ExpandMore } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useThemeMode } from '../context/ThemeContext';
import Nav from '../components/Nav';
import api from '../services/api';

const Marketplace = () => {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [targetAudienceFilter, setTargetAudienceFilter] = useState('all');
  const [priceFilter, setPriceFilter] = useState('all');
  const navigate = useNavigate();
  const { isAuthenticated, user, logout } = useAuth();
  const { mode, toggleMode } = useThemeMode();
  const scrollY = useState(0)[0];

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  useEffect(() => {
    fetchMarketplaceExams();
  }, []);

  const fetchMarketplaceExams = async () => {
    try {
      setLoading(true);
      const response = await api.get('/marketplace/exams');
      setExams(response.data);
    } catch (err) {
      console.error('Error fetching marketplace exams:', err);
      setError('Failed to load marketplace exams. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestAccess = async (examId) => {
    navigate(`/marketplace/exams/${examId}/request`);
  };

  // Get unique target audiences from exams
  const uniqueAudiences = [...new Set(exams.map(exam => exam.targetAudience).filter(Boolean))];

  const filteredExams = exams.filter(exam => {
    // Search filter
    const matchesSearch = 
      exam.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      exam.publicDescription?.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Target audience filter
    const matchesAudience = 
      targetAudienceFilter === 'all' || 
      exam.targetAudience === targetAudienceFilter;
    
    // Price filter
    const matchesPrice = 
      priceFilter === 'all' ||
      (priceFilter === 'free' && exam.publicPrice === 0) ||
      (priceFilter === 'paid' && exam.publicPrice > 0);
    
    return matchesSearch && matchesAudience && matchesPrice;
  });

  const calculateTotalQuestions = (sections) => {
    return sections?.reduce((sum, section) => sum + (section.questions?.length || 0), 0) || 0;
  };

  const clearFilters = () => {
    setSearchTerm('');
    setTargetAudienceFilter('all');
    setPriceFilter('all');
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
          <Typography variant="h2" fontWeight={800} sx={{ mb: 2, color: '#0D406C' }}>
            Exam Marketplace
          </Typography>
          <Typography sx={{ color: '#64748B', maxWidth: 600, mx: 'auto', mb: 4, fontSize: 16 }}>
            Browse and request access to publicly available exams
          </Typography>

          {/* Filters Section */}
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
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <FilterList sx={{ mr: 1, color: '#0D406C', fontSize: 20 }} />
                <Typography fontWeight={700} sx={{ color: '#0F172A', fontSize: 15 }}>
                  Filters
                </Typography>
                {(searchTerm || targetAudienceFilter !== 'all' || priceFilter !== 'all') && (
                  <Chip 
                    label={`${[searchTerm, targetAudienceFilter !== 'all' && targetAudienceFilter, priceFilter !== 'all' && priceFilter].filter(Boolean).length} active`}
                    size="small"
                    sx={{ ml: 2, bgcolor: '#0CBD73', color: 'white', fontWeight: 600, height: 22, fontSize: 11 }}
                  />
                )}
              </Box>
              {(searchTerm || targetAudienceFilter !== 'all' || priceFilter !== 'all') && (
                <Button
                  onClick={clearFilters}
                  size="small"
                  variant="text"
                  sx={{ borderRadius: 1.5, textTransform: 'none', fontWeight: 600, fontSize: 13, color: '#64748B', minWidth: 'auto', px: 1.5 }}
                >
                  Clear
                </Button>
              )}
            </Box>
            
            <Grid container spacing={{ xs: 1.5, sm: 2 }} alignItems="center">
              {/* Search */}
              <Grid item xs={12} sm={6} lg={5}>
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

              {/* Target Audience Filter */}
              <Grid item xs={6} sm={3} lg={3.5}>
                <FormControl fullWidth size="small">
                  <InputLabel sx={{ fontSize: 13 }}>Audience</InputLabel>
                  <Select
                    value={targetAudienceFilter}
                    onChange={(e) => setTargetAudienceFilter(e.target.value)}
                    label="Audience"
                    sx={{ borderRadius: 1.5, fontSize: 14 }}
                  >
                    <MenuItem value="all">All</MenuItem>
                    {uniqueAudiences.map(audience => (
                      <MenuItem key={audience} value={audience}>{audience}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* Price Filter */}
              <Grid item xs={6} sm={3} lg={3.5}>
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
            </Grid>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 4, maxWidth: 600, mx: 'auto' }}>
            {error}
          </Alert>
        )}

        {/* Exam Grid */}
        {filteredExams.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <School sx={{ fontSize: 64, color: '#CBD5E1', mb: 2 }} />
            <Typography variant="h6" sx={{ color: '#64748B', mb: 1 }}>
              {searchTerm ? 'No exams found matching your search' : 'No exams available in the marketplace yet'}
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
                      {exam.targetAudience && (
                        <Chip 
                          label={exam.targetAudience}
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
                          {calculateTotalQuestions(exam.sections)}
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

                    {/* Price if applicable */}
                    {exam.publicPrice > 0 && (
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
                    )}

                    <Button
                      fullWidth
                      variant="contained"
                      onClick={() => handleRequestAccess(exam._id)}
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
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Box>
    </Box>
    </>
  );
};

export default Marketplace;
