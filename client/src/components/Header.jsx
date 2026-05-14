import React, { useContext, useState, useEffect } from 'react';
import { Link as RouterLink, useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Box,
  Avatar,
  Divider,
  Container,
  Tooltip,
  Badge,
  useScrollTrigger,
  Slide,
  Fade,
  Chip
} from '@mui/material';
import {
  AccountCircle,
  Menu as MenuIcon,
  Dashboard,
  School,
  Assignment,
  Assessment,
  Logout,
  Person,
  Notifications
} from '@mui/icons-material';
import { AuthContext } from '../context/AuthContext';

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

const Header = () => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [anchorEl, setAnchorEl] = useState(null);
  const [mobileMenuAnchorEl, setMobileMenuAnchorEl] = useState(null);
  const [notifications, setNotifications] = useState(0);
  const [isScrolled, setIsScrolled] = useState(false);

  // Check if current route is active
  const isActive = (path) => {
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      setIsScrolled(scrollPosition > 10);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Simulate notifications (in a real app, this would come from an API)
  useEffect(() => {
    if (user) {
      // For demo purposes, student gets 2 notifications, admin gets 3
      setNotifications(user.role === 'student' ? 2 : 3);
    }
  }, [user]);

  const handleProfileMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMobileMenuOpen = (event) => {
    setMobileMenuAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setMobileMenuAnchorEl(null);
  };

  const handleLogout = () => {
    handleMenuClose();
    logout();
    navigate('/login');
  };

  const handleProfile = () => {
    handleMenuClose();
    navigate('/profile');
  };

  const renderMenu = (
    <Menu
      anchorEl={anchorEl}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      keepMounted
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      open={Boolean(anchorEl)}
      onClose={handleMenuClose}
      PaperProps={{
        elevation: 3,
        sx: {
          borderRadius: 2,
          minWidth: 180,
          mt: 1,
          overflow: 'visible',
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
    >
      <Box sx={{ px: 2, py: 1.5 }}>
        <Typography variant="subtitle1" fontWeight="bold">
          {user?.fullName || 'User'}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {user?.role === 'superadmin' ? 'Super Admin' : user?.role === 'admin' ? 'Administrator' : 'Student'}
        </Typography>
      </Box>
      <Divider />
      <MenuItem onClick={handleProfile} sx={{ py: 1.5 }}>
        <Person sx={{ mr: 2, fontSize: 20, color: 'primary.main' }} />
        Profile
      </MenuItem>
      <MenuItem onClick={handleLogout} sx={{ py: 1.5 }}>
        <Logout sx={{ mr: 2, fontSize: 20, color: 'error.main' }} />
        Logout
      </MenuItem>
    </Menu>
  );

  const renderMobileMenu = (
    <Menu
      anchorEl={mobileMenuAnchorEl}
      anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      keepMounted
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      open={Boolean(mobileMenuAnchorEl)}
      onClose={handleMenuClose}
      PaperProps={{
        elevation: 3,
        sx: {
          borderRadius: 2,
          minWidth: 200,
          mt: 1,
        },
      }}
    >
      {user && (user.role === 'admin' || user.role === 'superadmin') && (
        <>
          <MenuItem
            component={RouterLink}
            to="/dashboard"
            selected={isActive('/dashboard')}
            sx={{ py: 1.5 }}
          >
            <Dashboard sx={{ mr: 2, fontSize: 20, color: 'primary.main' }} />
            Dashboard
          </MenuItem>
          <MenuItem
            component={RouterLink}
            to="/admin/students"
            selected={isActive('/admin/students')}
            sx={{ py: 1.5 }}
          >
            <School sx={{ mr: 2, fontSize: 20, color: 'primary.main' }} />
            Students
          </MenuItem>
          <MenuItem
            component={RouterLink}
            to="/admin/exams"
            selected={isActive('/admin/exams')}
            sx={{ py: 1.5 }}
          >
            <Assignment sx={{ mr: 2, fontSize: 20, color: 'primary.main' }} />
            Exams
          </MenuItem>
          <MenuItem
            component={RouterLink}
            to="/admin/results"
            selected={isActive('/admin/results')}
            sx={{ py: 1.5 }}
          >
            <Assessment sx={{ mr: 2, fontSize: 20, color: 'primary.main' }} />
            Results
          </MenuItem>
          <Divider />
        </>
      )}

      {user && user.role === 'student' && (
        <>
          <MenuItem
            component={RouterLink}
            to="/student"
            selected={isActive('/student')}
            sx={{ py: 1.5 }}
          >
            <Dashboard sx={{ mr: 2, fontSize: 20, color: 'primary.main' }} />
            Dashboard
          </MenuItem>
          <MenuItem
            component={RouterLink}
            to="/student/exams"
            selected={isActive('/student/exams')}
            sx={{ py: 1.5 }}
          >
            <Assignment sx={{ mr: 2, fontSize: 20, color: 'primary.main' }} />
            Exams
          </MenuItem>
          <MenuItem
            component={RouterLink}
            to="/student/results"
            selected={isActive('/student/results')}
            sx={{ py: 1.5 }}
          >
            <Assessment sx={{ mr: 2, fontSize: 20, color: 'primary.main' }} />
            Results
          </MenuItem>
          <Divider />
        </>
      )}

      <MenuItem onClick={handleProfile} sx={{ py: 1.5 }}>
        <Person sx={{ mr: 2, fontSize: 20, color: 'primary.main' }} />
        Profile
      </MenuItem>
      <MenuItem onClick={handleLogout} sx={{ py: 1.5 }}>
        <Logout sx={{ mr: 2, fontSize: 20, color: 'error.main' }} />
        Logout
      </MenuItem>
    </Menu>
  );

  return (
    <Box sx={{ flexGrow: 1 }}>
      <HideOnScroll>
        <AppBar
          position="fixed"
          color="primary"
          sx={{
            boxShadow: isScrolled ? 6 : 0,
            transition: 'all 0.3s ease',
            background: isScrolled
              ? 'linear-gradient(90deg, #0D406C, #1A5A8C)'
              : 'linear-gradient(90deg, rgba(13, 64, 108, 0.95), rgba(26, 90, 140, 0.95))',
            backdropFilter: 'blur(8px)',
          }}
        >
          <Container maxWidth="lg">
            <Toolbar sx={{ py: { xs: 1, md: isScrolled ? 0.5 : 1 } }}>
              <Avatar
                src="/logo.png"
                alt="Logo"
                sx={{
                  width: { xs: 50, md: isScrolled ? 50 : 60 },
                  height: { xs: 50, md: isScrolled ? 50 : 60 },
                  transition: 'all 0.3s ease',
                  bgcolor: 'transparent',
                }}
              />

              <Box sx={{ flexGrow: 1 }} />

              {user ? (
                <>
                  <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center' }}>
                    {(user.role === 'admin' || user.role === 'superadmin') && (
                      <>
                        <Button
                          color="inherit"
                          component={RouterLink}
                          to="/dashboard"
                          startIcon={<Dashboard />}
                          sx={{
                            mx: 0.5,
                            borderRadius: 2,
                            ...(isActive('/admin') && {
                              bgcolor: 'rgba(255, 255, 255, 0.15)',
                              fontWeight: 'bold',
                            })
                          }}
                        >
                          Dashboard
                        </Button>
                        <Button
                          color="inherit"
                          component={RouterLink}
                          to="/admin/students"
                          startIcon={<School />}
                          sx={{
                            mx: 0.5,
                            borderRadius: 2,
                            ...(isActive('/admin/students') && {
                              bgcolor: 'rgba(255, 255, 255, 0.15)',
                              fontWeight: 'bold',
                            })
                          }}
                        >
                          Students
                        </Button>
                        <Button
                          color="inherit"
                          component={RouterLink}
                          to="/admin/exams"
                          startIcon={<Assignment />}
                          sx={{
                            mx: 0.5,
                            borderRadius: 2,
                            ...(isActive('/admin/exams') && {
                              bgcolor: 'rgba(255, 255, 255, 0.15)',
                              fontWeight: 'bold',
                            })
                          }}
                        >
                          Exams
                        </Button>
                        <Button
                          color="inherit"
                          component={RouterLink}
                          to="/admin/results"
                          startIcon={<Assessment />}
                          sx={{
                            mx: 0.5,
                            borderRadius: 2,
                            ...(isActive('/admin/results') && {
                              bgcolor: 'rgba(255, 255, 255, 0.15)',
                              fontWeight: 'bold',
                            })
                          }}
                        >
                          Results
                        </Button>
                      </>
                    )}

                    {user.role === 'student' && (
                      <>
                        <Button
                          color="inherit"
                          component={RouterLink}
                          to="/student"
                          startIcon={<Dashboard />}
                          sx={{
                            mx: 0.5,
                            borderRadius: 2,
                            ...(isActive('/student') && {
                              bgcolor: 'rgba(255, 255, 255, 0.15)',
                              fontWeight: 'bold',
                            })
                          }}
                        >
                          Dashboard
                        </Button>
                        <Button
                          color="inherit"
                          component={RouterLink}
                          to="/student/exams"
                          startIcon={<Assignment />}
                          sx={{
                            mx: 0.5,
                            borderRadius: 2,
                            ...(isActive('/student/exams') && {
                              bgcolor: 'rgba(255, 255, 255, 0.15)',
                              fontWeight: 'bold',
                            })
                          }}
                        >
                          Exams
                        </Button>
                        <Button
                          color="inherit"
                          component={RouterLink}
                          to="/student/results"
                          startIcon={<Assessment />}
                          sx={{
                            mx: 0.5,
                            borderRadius: 2,
                            ...(isActive('/student/results') && {
                              bgcolor: 'rgba(255, 255, 255, 0.15)',
                              fontWeight: 'bold',
                            })
                          }}
                        >
                          Results
                        </Button>
                      </>
                    )}

                    <Tooltip title="Notifications">
                      <IconButton color="inherit" sx={{ ml: 1 }}>
                        <Badge badgeContent={notifications} color="secondary">
                          <Notifications />
                        </Badge>
                      </IconButton>
                    </Tooltip>

                    <Tooltip title="Account">
                      <IconButton
                        edge="end"
                        aria-label="account of current user"
                        aria-haspopup="true"
                        onClick={handleProfileMenuOpen}
                        color="inherit"
                        sx={{ ml: 1 }}
                      >
                        <Avatar
                          sx={{
                            width: 36,
                            height: 36,
                            bgcolor: 'secondary.main',
                            border: '2px solid rgba(255,255,255,0.8)',
                            fontWeight: 'bold',
                            transition: 'all 0.2s ease',
                            '&:hover': {
                              transform: 'scale(1.1)',
                            }
                          }}
                        >
                          {user.fullName ? user.fullName.charAt(0).toUpperCase() : <AccountCircle />}
                        </Avatar>
                      </IconButton>
                    </Tooltip>
                  </Box>

                  <Box sx={{ display: { xs: 'flex', md: 'none' } }}>
                    {notifications > 0 && (
                      <IconButton color="inherit" sx={{ mr: 1 }}>
                        <Badge badgeContent={notifications} color="secondary">
                          <Notifications />
                        </Badge>
                      </IconButton>
                    )}

                    <IconButton
                      edge="end"
                      aria-label="show more"
                      aria-haspopup="true"
                      onClick={handleMobileMenuOpen}
                      color="inherit"
                    >
                      <MenuIcon />
                    </IconButton>
                  </Box>
                </>
              ) : (
                <Fade in={true}>
                  <Button
                    variant="contained"
                    color="secondary"
                    component={RouterLink}
                    to="/login"
                    sx={{
                      color: 'black',
                      fontWeight: 'bold',
                      px: 3
                    }}
                  >
                    Login
                  </Button>
                </Fade>
              )}
            </Toolbar>
          </Container>
        </AppBar>
      </HideOnScroll>

      {/* Toolbar placeholder to prevent content from hiding behind the AppBar */}
      <Toolbar sx={{ mb: 2 }} />

      {renderMobileMenu}
      {renderMenu}
    </Box>
  );
};

export default Header;
