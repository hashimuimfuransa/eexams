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
import SEO from '../components/SEO';

const Terms = () => {
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
      <SEO
        title="Terms of Service | eexams"
        description="Read eexams' Terms of Service. Understand the rules and guidelines for using Rwanda's leading online exam management platform."
        canonical="https://www.eexams.net/terms"
        ogUrl="https://www.eexams.net/terms"
      />
      <Nav
        scrolled={scrolled > 20}
        mode={mode}
        toggleMode={() => {}}
        isAuthenticated={isAuthenticated}
        user={user}
        handleLogout={handleLogout}
        currentRoute="/terms"
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
          Terms of Service
        </Typography>
        <Typography variant="subtitle1" color="text.secondary" paragraph>
          Last updated: {new Date().toLocaleDateString()}
        </Typography>

        <Divider sx={{ my: 4 }} />

        <Typography variant="h5" gutterBottom fontWeight={600}>
          1. Acceptance of Terms
        </Typography>
        <Typography paragraph>
          By accessing and using eexams, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our service.
        </Typography>

        <Typography variant="h5" gutterBottom fontWeight={600}>
          2. Account Responsibilities
        </Typography>
        <Typography paragraph>
          You are responsible for:
        </Typography>
        <Box component="ul" sx={{ pl: 3, mb: 3 }}>
          <Typography component="li" paragraph>
            Maintaining the confidentiality of your account credentials
          </Typography>
          <Typography component="li" paragraph>
            All activities that occur under your account
          </Typography>
          <Typography component="li" paragraph>
            Notifying us of any unauthorized use of your account
          </Typography>
        </Box>

        <Typography variant="h5" gutterBottom fontWeight={600}>
          3. Academic Integrity
        </Typography>
        <Typography paragraph>
          Users must:
        </Typography>
        <Box component="ul" sx={{ pl: 3, mb: 3 }}>
          <Typography component="li" paragraph>
            Complete exams honestly without assistance from others
          </Typography>
          <Typography component="li" paragraph>
            Not share exam questions or answers with others
          </Typography>
          <Typography component="li" paragraph>
            Respect the intellectual property of exam creators
          </Typography>
        </Box>

        <Typography variant="h5" gutterBottom fontWeight={600}>
          4. Service Availability
        </Typography>
        <Typography paragraph>
          We strive to maintain high availability but do not guarantee uninterrupted service. We reserve the right to suspend or terminate accounts that violate these terms.
        </Typography>

        <Typography variant="h5" gutterBottom fontWeight={600}>
          5. Intellectual Property
        </Typography>
        <Typography paragraph>
          All content on eexams, including exam questions, answers, and platform design, is protected by intellectual property laws. Users retain rights to their original content while granting us license to use it for service provision.
        </Typography>

        <Typography variant="h5" gutterBottom fontWeight={600}>
          6. Limitation of Liability
        </Typography>
        <Typography paragraph>
          eexams shall not be liable for any indirect, incidental, special, or consequential damages arising from use of our service.
        </Typography>

        <Typography variant="h5" gutterBottom fontWeight={600}>
          7. Changes to Terms
        </Typography>
        <Typography paragraph>
          We reserve the right to modify these terms at any time. Continued use of the service constitutes acceptance of modified terms.
        </Typography>

        <Typography variant="h5" gutterBottom fontWeight={600}>
          8. Contact
        </Typography>
        <Typography paragraph>
          For questions about these terms, please contact us through the platform or email info@excellencecoachinghub.com
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

export default Terms;
