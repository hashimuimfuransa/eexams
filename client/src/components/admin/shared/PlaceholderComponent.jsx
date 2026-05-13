import React from 'react';
import { Box, Typography, Paper, Button, useTheme, alpha } from '@mui/material';
import { Construction as ConstructionIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const PlaceholderComponent = ({ title, description, returnPath = '/admin', returnText = 'Return to Dashboard' }) => {
  const theme = useTheme();
  const navigate = useNavigate();

  return (
    <Box>
      {/* Page header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" fontWeight="bold" gutterBottom>
          {title}
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          {description}
        </Typography>
      </Box>

      <Paper
        elevation={0}
        sx={{
          p: 5,
          borderRadius: 4,
          textAlign: 'center',
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.9)}, ${alpha(theme.palette.background.paper, 0.7)})`,
          backdropFilter: 'blur(8px)'
        }}
      >
        <ConstructionIcon sx={{ fontSize: 80, color: alpha(theme.palette.primary.main, 0.3), mb: 2 }} />
        
        <Typography variant="h5" gutterBottom fontWeight="bold">
          Coming Soon
        </Typography>
        
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: 600, mx: 'auto' }}>
          This feature is currently under development and will be available soon. Check back later for updates.
        </Typography>
        
        <Button
          variant="contained"
          onClick={() => navigate(returnPath)}
          sx={{
            borderRadius: 3,
            px: 4,
            py: 1.2
          }}
        >
          {returnText}
        </Button>
      </Paper>
    </Box>
  );
};

export default PlaceholderComponent;
