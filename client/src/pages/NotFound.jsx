import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, Container, Paper } from '@mui/material';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { SentimentVeryDissatisfied as SadIcon } from '@mui/icons-material';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '../context/AuthContext';
import { useThemeMode } from '../context/ThemeContext';
import Nav from '../components/Nav';

const NotFound = () => {
  const { mode } = useThemeMode();
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(0);
  const isDark = mode === 'dark';

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <>
      <Helmet>
        <title>404 - Page Not Found | eexams</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <Nav
        scrolled={scrolled > 20}
        mode={mode}
        toggleMode={() => {}}
        isAuthenticated={isAuthenticated}
        user={user}
        handleLogout={handleLogout}
        currentRoute="*"
      />
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
          bgcolor: 'background.default',
          pt: 20,
        }}
      >
      <Container maxWidth="md" sx={{ flex: 1, display: 'flex', alignItems: 'center' }}>
        <Paper
          elevation={3}
          sx={{
            p: 5,
            borderRadius: 4,
            textAlign: 'center',
            width: '100%',
            maxWidth: 600,
            mx: 'auto',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.1)',
          }}
        >
          <SadIcon sx={{ fontSize: 100, color: 'primary.main', mb: 3 }} />
          
          <Typography variant="h2" component="h1" fontWeight="bold" gutterBottom>
            404
          </Typography>
          
          <Typography variant="h4" gutterBottom>
            Page Not Found
          </Typography>
          
          <Typography variant="body1" color="text.secondary" paragraph sx={{ mb: 4 }}>
            The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
          </Typography>
          
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
            <Button
              variant="outlined"
              color="primary"
              component={RouterLink}
              to="/"
              size="large"
            >
              Go to Home
            </Button>
            
            <Button
              variant="contained"
              color="primary"
              component={RouterLink}
              to="/dashboard"
              size="large"
            >
              Go to Dashboard
            </Button>
          </Box>
        </Paper>
      </Container>
    </Box>
    </>
  );
};

export default NotFound;
