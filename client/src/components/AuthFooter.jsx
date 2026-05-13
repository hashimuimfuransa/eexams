import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Link,
  Divider,
  IconButton,
  Tooltip,
  useTheme,
  alpha
} from '@mui/material';
import { Facebook, Twitter, LinkedIn, Instagram } from '@mui/icons-material';
import { useThemeMode } from '../context/ThemeContext';

const AuthFooter = () => {
  const theme = useTheme();
  const { mode } = useThemeMode();

  return (
    <Box
      component="footer"
      sx={{
        py: 3,
        px: 2,
        mt: 'auto',
        backgroundColor: mode === 'dark'
          ? alpha(theme.palette.background.paper, 0.4)
          : 'rgba(0, 0, 0, 0.02)',
        borderTop: `1px solid ${mode === 'dark'
          ? alpha(theme.palette.common.white, 0.05)
          : 'rgba(0, 0, 0, 0.05)'}`,
        backdropFilter: 'blur(10px)',
        position: 'relative',
        zIndex: 5,
      }}
    >
      <Container maxWidth="lg">
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Typography
            variant="body2"
            color="text.secondary"
            align="center"
            sx={{
              fontWeight: 500,
              opacity: mode === 'dark' ? 0.8 : 0.7,
            }}
          >
            © {new Date().getFullYear()} eexams. All rights reserved.
          </Typography>

          <Box sx={{ display: 'flex', gap: 1, mt: { xs: 2, sm: 0 } }}>
            {[
              { icon: <Facebook fontSize="small" />, label: 'Facebook', color: '#1877F2' },
              { icon: <Twitter fontSize="small" />, label: 'Twitter', color: '#1DA1F2' },
              { icon: <LinkedIn fontSize="small" />, label: 'LinkedIn', color: '#0A66C2' },
              { icon: <Instagram fontSize="small" />, label: 'Instagram', color: '#E4405F' }
            ].map((social, index) => (
              <Tooltip key={index} title={social.label}>
                <IconButton
                  size="small"
                  sx={{
                    color: mode === 'dark' ? alpha(theme.palette.common.white, 0.6) : 'text.secondary',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      color: social.color,
                      transform: 'translateY(-2px)',
                      boxShadow: `0 4px 8px ${alpha(social.color, 0.25)}`,
                    },
                  }}
                >
                  {social.icon}
                </IconButton>
              </Tooltip>
            ))}
          </Box>
        </Box>

        <Divider
          sx={{
            my: 2,
            borderColor: mode === 'dark'
              ? alpha(theme.palette.common.white, 0.05)
              : alpha(theme.palette.common.black, 0.05),
          }}
        />

        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: { xs: 2, sm: 3 },
          }}
        >
          {[
            { label: 'Privacy Policy', to: '#' },
            { label: 'Terms of Service', to: '#' },
            { label: 'Contact Us', to: '#' },
            { label: 'Help Center', to: '#' }
          ].map((link, index) => (
            <Link
              key={index}
              component={RouterLink}
              to={link.to}
              color={mode === 'dark' ? alpha(theme.palette.common.white, 0.7) : 'text.secondary'}
              underline="none"
              variant="body2"
              sx={{
                position: 'relative',
                transition: 'all 0.2s ease',
                fontWeight: 500,
                '&:hover': {
                  color: mode === 'dark' ? theme.palette.primary.light : theme.palette.primary.main,
                  transform: 'translateY(-1px)',
                },
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  width: '0%',
                  height: '2px',
                  bottom: '-2px',
                  left: 0,
                  backgroundColor: mode === 'dark' ? theme.palette.primary.light : theme.palette.primary.main,
                  transition: 'width 0.3s ease',
                },
                '&:hover::after': {
                  width: '100%',
                }
              }}
            >
              {link.label}
            </Link>
          ))}
        </Box>
      </Container>
    </Box>
  );
};

export default AuthFooter;
