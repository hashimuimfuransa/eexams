import React from 'react';
import { Box, useTheme, alpha } from '@mui/material';

// MainContent component with beautiful background
const MainContent = ({ children }) => {
  const theme = useTheme();

  return (
    <Box
      component="main"
      sx={{
        flexGrow: 1,
        height: '100vh',
        overflow: 'auto',
        position: 'relative',
        backgroundColor: theme.palette.background.default,
        backgroundImage: `
          radial-gradient(at 30% 0%, ${alpha(theme.palette.primary.light, 0.08)} 0, transparent 50%),
          radial-gradient(at 90% 20%, ${alpha(theme.palette.secondary.light, 0.08)} 0, transparent 50%),
          radial-gradient(at 10% 80%, ${alpha(theme.palette.success.light, 0.08)} 0, transparent 50%),
          radial-gradient(at 70% 90%, ${alpha(theme.palette.info.light, 0.08)} 0, transparent 50%)
        `,
        backgroundAttachment: 'fixed',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: 'url(https://www.transparenttextures.com/patterns/subtle-white-feathers.png)',
          opacity: 0.02,
          pointerEvents: 'none',
          zIndex: 0,
        },
        '&::after': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '100%',
          background: `
            linear-gradient(to bottom,
              ${alpha(theme.palette.background.default, 0.9)} 0%,
              ${alpha(theme.palette.background.default, 0.7)} 15%,
              ${alpha(theme.palette.background.default, 0.3)} 30%,
              ${alpha(theme.palette.background.default, 0)} 50%,
              ${alpha(theme.palette.background.default, 0.3)} 70%,
              ${alpha(theme.palette.background.default, 0.7)} 85%,
              ${alpha(theme.palette.background.default, 0.9)} 100%
            )
          `,
          opacity: 0.8,
          pointerEvents: 'none',
          zIndex: 0,
        }
      }}
    >
      {children}
    </Box>
  );
};

export default MainContent;
