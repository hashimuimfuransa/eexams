import React, { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Box,
  Typography,
  Button,
  Container,
  Avatar,
  useScrollTrigger,
  Slide,
  Menu,
  MenuItem,
  IconButton,
  Divider,
  Tooltip,
  Badge,
  useTheme,
  alpha
} from '@mui/material';
import {
  ArrowBack,
  Person,
  Notifications,
  Dashboard,
  Settings,
  Logout,
  Menu as MenuIcon,
  AccountCircle
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';

// Hide app bar on scroll
function HideOnScroll(props) {
  const { children } = props;
  const trigger = useScrollTrigger();

  return (
    <Slide appear={false} direction="down" in={!trigger}>
      {children}
    </Slide>
  );
}

const AuthHeader = ({ title }) => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();

  // State for user menu
  const [userMenuAnchorEl, setUserMenuAnchorEl] = useState(null);
  const [mobileMenuAnchorEl, setMobileMenuAnchorEl] = useState(null);

  // Handle user menu open/close
  const handleUserMenuOpen = (event) => {
    setUserMenuAnchorEl(event.currentTarget);
  };

  const handleUserMenuClose = () => {
    setUserMenuAnchorEl(null);
  };

  // Handle mobile menu open/close
  const handleMobileMenuOpen = (event) => {
    setMobileMenuAnchorEl(event.currentTarget);
  };

  const handleMobileMenuClose = () => {
    setMobileMenuAnchorEl(null);
  };

  // Handle logout
  const handleLogout = () => {
    handleUserMenuClose();
    logout();
    navigate('/login');
  };

  // Get user initials for avatar
  const getUserInitials = () => {
    if (!user) return '?';

    const firstInitial = user.firstName ? user.firstName.charAt(0) : '';
    const lastInitial = user.lastName ? user.lastName.charAt(0) : '';

    return (firstInitial + lastInitial).toUpperCase();
  };

  return (
    <HideOnScroll>
      <AppBar
        position="fixed"
        color="primary"
        elevation={0}
        sx={{
          background: 'linear-gradient(90deg, #0D406C, #1A5A8C)',
          boxShadow: '0 8px 25px rgba(0, 0, 0, 0.15)',
          backdropFilter: 'blur(8px)',
          borderBottom: '1px solid',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderRadius: 0, // Remove rounded corners
        }}
      >
        <Container maxWidth="lg">
          <Toolbar sx={{ py: { xs: 1, md: 1.5 } }}>
            {/* Logo and Brand */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                textDecoration: 'none',
                color: 'inherit',
              }}
              component={RouterLink}
              to="/"
            >
              <Avatar
                src="/logo.png"
                alt="Logo"
                sx={{
                  width: 55,
                  height: 55,
                  backgroundColor: 'rgba(255,255,255,0.95)',
                  p: '3px',
                  boxShadow: '0 6px 12px rgba(0, 0, 0, 0.3)',
                  border: '2px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: 0, // Square avatar
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    transform: 'scale(1.05)',
                    boxShadow: '0 8px 16px rgba(0, 0, 0, 0.4)',
                  }
                }}
              />
            </Box>

            <Box sx={{ flexGrow: 1 }} />

            {/* Page Title */}
            <Typography
              variant="h6"
              sx={{
                display: { xs: 'none', sm: 'block' },
                color: 'white',
                fontWeight: 'medium',
                mx: 2,
                textShadow: '0 2px 8px rgba(0,0,0,0.2)',
                letterSpacing: '0.5px',
              }}
            >
              {title}
            </Typography>

            <Box sx={{ flexGrow: 1 }} />

            {/* Desktop Navigation */}
            <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center' }}>
              {isAuthenticated ? (
                <>
                  {/* Dashboard Button */}
                  <Button
                    component={RouterLink}
                    to="/dashboard"
                    startIcon={<Dashboard />}
                    sx={{
                      color: 'white',
                      mx: 1,
                      px: 2,
                      py: 1,
                      borderRadius: 0, // Remove rounded corners
                      '&:hover': {
                        bgcolor: 'rgba(255, 255, 255, 0.1)',
                        transform: 'translateY(-2px)',
                      },
                      transition: 'all 0.2s ease',
                    }}
                  >
                    Dashboard
                  </Button>

                  {/* Notifications */}
                  <Tooltip title="Notifications">
                    <IconButton
                      color="inherit"
                      sx={{
                        mx: 1,
                        bgcolor: 'rgba(255, 255, 255, 0.1)',
                        borderRadius: 0, // Remove rounded corners
                        '&:hover': {
                          bgcolor: 'rgba(255, 255, 255, 0.2)',
                        }
                      }}
                    >
                      <Badge
                        badgeContent={3}
                        color="secondary"
                        sx={{
                          '& .MuiBadge-badge': {
                            borderRadius: 0, // Square badge
                          }
                        }}
                      >
                        <Notifications />
                      </Badge>
                    </IconButton>
                  </Tooltip>

                  {/* User Menu */}
                  <Box sx={{ ml: 2 }}>
                    <Tooltip title="Account settings">
                      <IconButton
                        onClick={handleUserMenuOpen}
                        sx={{
                          p: 0,
                          border: '2px solid rgba(255, 255, 255, 0.3)',
                          borderRadius: 0, // Remove rounded corners
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            borderColor: 'white',
                          }
                        }}
                      >
                        <Avatar
                          sx={{
                            bgcolor: 'secondary.main',
                            color: 'black',
                            fontWeight: 'bold',
                            boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
                            borderRadius: 0, // Square avatar
                          }}
                        >
                          {getUserInitials()}
                        </Avatar>
                      </IconButton>
                    </Tooltip>
                    <Menu
                      anchorEl={userMenuAnchorEl}
                      open={Boolean(userMenuAnchorEl)}
                      onClose={handleUserMenuClose}
                      onClick={handleUserMenuClose}
                      PaperProps={{
                        elevation: 3,
                        sx: {
                          overflow: 'visible',
                          filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.2))',
                          mt: 1.5,
                          borderRadius: 0, // Remove rounded corners
                          minWidth: 200,
                          '&:before': {
                            content: '""',
                            display: 'block',
                            position: 'absolute',
                            top: 0,
                            right: 14,
                            width: 10,
                            height: 10,
                            bgcolor: 'background.paper',
                            transform: 'translateY(-50%) rotate(45deg)',
                            zIndex: 0,
                          },
                        },
                      }}
                      transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                      anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                    >
                      <Box sx={{ px: 2, py: 1.5 }}>
                        <Typography variant="subtitle1" fontWeight="bold">
                          {user?.firstName} {user?.lastName}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {user?.email}
                        </Typography>
                      </Box>
                      <Divider />
                      <MenuItem component={RouterLink} to="/profile">
                        <Person sx={{ mr: 2 }} /> Profile
                      </MenuItem>
                      <MenuItem component={RouterLink} to="/settings">
                        <Settings sx={{ mr: 2 }} /> Settings
                      </MenuItem>
                      <Divider />
                      <MenuItem onClick={handleLogout}>
                        <Logout sx={{ mr: 2 }} /> Logout
                      </MenuItem>
                    </Menu>
                  </Box>
                </>
              ) : (
                <Button
                  component={RouterLink}
                  to="/"
                  startIcon={<ArrowBack />}
                  sx={{
                    color: 'white',
                    px: 3,
                    py: 1,
                    borderRadius: 0, // Remove rounded corners
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    '&:hover': {
                      bgcolor: 'rgba(255, 255, 255, 0.1)',
                      borderColor: 'white',
                    },
                    transition: 'all 0.2s ease',
                  }}
                >
                  Back to Home
                </Button>
              )}
            </Box>

            {/* Mobile Navigation */}
            <Box sx={{ display: { xs: 'flex', md: 'none' } }}>
              {isAuthenticated ? (
                <>
                  <IconButton
                    color="inherit"
                    onClick={handleMobileMenuOpen}
                    sx={{
                      ml: 1,
                      bgcolor: 'rgba(255, 255, 255, 0.1)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: 0, // Remove rounded corners
                      '&:hover': {
                        bgcolor: 'rgba(255, 255, 255, 0.2)',
                      }
                    }}
                  >
                    <MenuIcon />
                  </IconButton>
                  <Menu
                    anchorEl={mobileMenuAnchorEl}
                    open={Boolean(mobileMenuAnchorEl)}
                    onClose={handleMobileMenuClose}
                    PaperProps={{
                      elevation: 3,
                      sx: {
                        borderRadius: 0, // Remove rounded corners
                        minWidth: 200,
                        mt: 1,
                      },
                    }}
                  >
                    <Box sx={{ px: 2, py: 1.5 }}>
                      <Typography variant="subtitle1" fontWeight="bold">
                        {user?.firstName} {user?.lastName}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {user?.email}
                      </Typography>
                    </Box>
                    <Divider />
                    <MenuItem component={RouterLink} to="/dashboard">
                      <Dashboard sx={{ mr: 2 }} /> Dashboard
                    </MenuItem>
                    <MenuItem component={RouterLink} to="/profile">
                      <Person sx={{ mr: 2 }} /> Profile
                    </MenuItem>
                    <MenuItem component={RouterLink} to="/settings">
                      <Settings sx={{ mr: 2 }} /> Settings
                    </MenuItem>
                    <Divider />
                    <MenuItem onClick={handleLogout}>
                      <Logout sx={{ mr: 2 }} /> Logout
                    </MenuItem>
                  </Menu>
                </>
              ) : (
                <Button
                  component={RouterLink}
                  to="/"
                  startIcon={<ArrowBack />}
                  sx={{
                    color: 'white',
                    borderRadius: 0, // Remove rounded corners
                    '&:hover': {
                      bgcolor: 'rgba(255, 255, 255, 0.1)',
                    },
                  }}
                >
                  Home
                </Button>
              )}
            </Box>
          </Toolbar>
        </Container>
      </AppBar>
    </HideOnScroll>
  );
};

export default AuthHeader;
