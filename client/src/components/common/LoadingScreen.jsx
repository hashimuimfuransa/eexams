import React from 'react';
import { Box, CircularProgress, Typography, Container } from '@mui/material';

const LoadingScreen = ({ message = 'Loading...' }) => {
  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          textAlign: 'center',
          p: 4
        }}
      >
        <CircularProgress
          size={60}
          thickness={4}
          color="primary"
          sx={{
            mb: 3,
            boxShadow: '0 0 20px rgba(103, 58, 183, 0.3)',
            borderRadius: 0, // This won't affect CircularProgress but keeping consistent style
          }}
        />
        <Typography
          variant="h5"
          component="h1"
          sx={{
            fontWeight: 'medium',
            color: 'text.primary',
            mb: 1
          }}
        >
          {message}
        </Typography>
        <Typography
          variant="body1"
          color="text.secondary"
          sx={{ maxWidth: '400px' }}
        >
          Please wait while we prepare your experience...
        </Typography>
      </Box>
    </Container>
  );
};

export default LoadingScreen;
