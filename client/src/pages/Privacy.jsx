import React, { useState, useEffect } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Paper,
  Divider
} from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { useThemeMode } from '../context/ThemeContext';
import Nav from '../components/Nav';

const Privacy = () => {
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
      <Nav
        scrolled={scrolled > 20}
        mode={mode}
        toggleMode={() => {}}
        isAuthenticated={isAuthenticated}
        user={user}
        handleLogout={handleLogout}
        currentRoute="/privacy"
      />
      <Container maxWidth="md" sx={{ py: 12, pt: 20 }}>
      <Paper
        elevation={0}
        sx={{
          p: 6,
          borderRadius: 3,
          backgroundColor: isDark ? '#1a1a2e' : '#ffffff',
          color: isDark ? '#e0e0e0' : '#1a1a2e',
        }}
      >
        <Typography variant="h3" gutterBottom fontWeight={700}>
          Privacy Policy
        </Typography>
        <Typography variant="subtitle1" color="text.secondary" paragraph>
          Last updated: {new Date().toLocaleDateString()}
        </Typography>

        <Divider sx={{ my: 4 }} />

        <Typography variant="h5" gutterBottom fontWeight={600}>
          1. Information We Collect
        </Typography>
        <Typography paragraph>
          eexams collects information you provide directly, including:
        </Typography>
        <Box component="ul" sx={{ pl: 3, mb: 3 }}>
          <Typography component="li" paragraph>
            Account information (name, email, role)
          </Typography>
          <Typography component="li" paragraph>
            Exam submissions and answers
          </Typography>
          <Typography component="li" paragraph>
            Usage data and analytics
          </Typography>
        </Box>

        <Typography variant="h5" gutterBottom fontWeight={600}>
          2. How We Use Your Information
        </Typography>
        <Typography paragraph>
          We use your information to:
        </Typography>
        <Box component="ul" sx={{ pl: 3, mb: 3 }}>
          <Typography component="li" paragraph>
            Provide and improve our services
          </Typography>
          <Typography component="li" paragraph>
            Grade exams and provide results
          </Typography>
          <Typography component="li" paragraph>
            Communicate with you about your account
          </Typography>
        </Box>

        <Typography variant="h5" gutterBottom fontWeight={600}>
          3. Data Security
        </Typography>
        <Typography paragraph>
          We implement appropriate security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.
        </Typography>

        <Typography variant="h5" gutterBottom fontWeight={600}>
          4. Your Rights
        </Typography>
        <Typography paragraph>
          You have the right to access, correct, or delete your personal data. Contact us to exercise these rights.
        </Typography>

        <Typography variant="h5" gutterBottom fontWeight={600}>
          5. Contact Us
        </Typography>
        <Typography paragraph>
          For privacy-related inquiries, please contact us through the platform or email info@excellencecoachinghub.com
        </Typography>

        <Divider sx={{ my: 4 }} />

        <Typography variant="body2" color="text.secondary">
          Provided by Excellence Coaching Hub
        </Typography>
      </Paper>
    </Container>
    </>
  );
};

export default Privacy;
