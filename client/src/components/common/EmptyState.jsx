import React from 'react';
import { Box, Typography, Button, alpha, useTheme } from '@mui/material';
import PropTypes from 'prop-types';

/**
 * EmptyState component for displaying when no data is available
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.icon - Icon to display
 * @param {string} props.title - Title text
 * @param {string} props.description - Description text
 * @param {string} props.actionText - Text for the action button
 * @param {Function} props.onAction - Function to call when action button is clicked
 * @param {Object} props.sx - Additional styles
 * @returns {React.ReactElement} EmptyState component
 */
const EmptyState = ({ 
  icon, 
  title, 
  description, 
  actionText, 
  onAction,
  sx = {} 
}) => {
  const theme = useTheme();
  
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        py: 6,
        px: 2,
        ...sx
      }}
    >
      {icon && (
        <Box
          sx={{
            mb: 2,
            p: 2,
            borderRadius: '50%',
            backgroundColor: alpha(theme.palette.primary.main, 0.1),
            color: theme.palette.primary.main,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {icon}
        </Box>
      )}
      
      {title && (
        <Typography
          variant="h5"
          component="h2"
          fontWeight="bold"
          gutterBottom
          sx={{ mb: 1 }}
        >
          {title}
        </Typography>
      )}
      
      {description && (
        <Typography
          variant="body1"
          color="text.secondary"
          sx={{ mb: 3, maxWidth: 400 }}
        >
          {description}
        </Typography>
      )}
      
      {actionText && onAction && (
        <Button
          variant="contained"
          color="primary"
          onClick={onAction}
          sx={{ borderRadius: 2 }}
        >
          {actionText}
        </Button>
      )}
    </Box>
  );
};

EmptyState.propTypes = {
  icon: PropTypes.node,
  title: PropTypes.string.isRequired,
  description: PropTypes.string,
  actionText: PropTypes.string,
  onAction: PropTypes.func,
  sx: PropTypes.object
};

export default EmptyState;
