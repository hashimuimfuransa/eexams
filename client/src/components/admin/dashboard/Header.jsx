import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Badge,
  Avatar,
  Box,
  Menu,
  MenuItem,
  Tooltip,
  Divider,
  useTheme,
  alpha,
  InputBase,
  Button
} from '@mui/material';
import {
  Menu as MenuIcon,
  Notifications as NotificationsIcon,
  Search as SearchIcon,
  Settings as SettingsIcon,
  Logout as LogoutIcon,
  Person as PersonIcon,
  Help as HelpIcon,
  DarkMode as DarkModeIcon,
  LightMode as LightModeIcon
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { useThemeMode } from '../../../context/ThemeContext';

// Styled search component
const Search = styled('div')(({ theme }) => ({
  position: 'relative',
  borderRadius: 30,
  backgroundColor: alpha(theme.palette.common.white, 0.15),
  '&:hover': {
    backgroundColor: alpha(theme.palette.common.white, 0.25),
  },
  marginRight: theme.spacing(2),
  marginLeft: 0,
  width: '100%',
  [theme.breakpoints.up('sm')]: {
    marginLeft: theme.spacing(3),
    width: 'auto',
  },
  transition: 'all 0.3s ease',
}));

const SearchIconWrapper = styled('div')(({ theme }) => ({
  padding: theme.spacing(0, 2),
  height: '100%',
  position: 'absolute',
  pointerEvents: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}));

const StyledInputBase = styled(InputBase)(({ theme }) => ({
  color: 'inherit',
  '& .MuiInputBase-input': {
    padding: theme.spacing(1, 1, 1, 0),
    paddingLeft: `calc(1em + ${theme.spacing(4)})`,
    transition: theme.transitions.create('width'),
    width: '100%',
    [theme.breakpoints.up('md')]: {
      width: '20ch',
      '&:focus': {
        width: '30ch',
      },
    },
  },
}));

const Header = ({ toggleSidebar, sidebarOpen }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { mode, toggleMode } = useThemeMode();

  // State for menus
  const [anchorElUser, setAnchorElUser] = useState(null);
  const [anchorElNotifications, setAnchorElNotifications] = useState(null);

  // Handle opening user menu
  const handleOpenUserMenu = (event) => {
    setAnchorElUser(event.currentTarget);
  };

  // Handle closing user menu
  const handleCloseUserMenu = () => {
    setAnchorElUser(null);
  };

  // Handle opening notifications menu
  const handleOpenNotificationsMenu = (event) => {
    setAnchorElNotifications(event.currentTarget);
  };

  // Handle closing notifications menu
  const handleCloseNotificationsMenu = () => {
    setAnchorElNotifications(null);
  };

  // Handle logout
  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Handle profile navigation
  const handleProfile = () => {
    navigate('/admin/settings/profile');
    handleCloseUserMenu();
  };

  // Handle settings navigation
  const handleSettings = () => {
    navigate('/admin/settings/system');
    handleCloseUserMenu();
  };

  // Mock notifications
  const notifications = [
    {
      id: 1,
      title: 'New Student Registered',
      message: 'John Doe has registered as a new student.',
      time: '5 minutes ago',
      read: false
    },
    {
      id: 2,
      title: 'Exam Completed',
      message: 'Biology Final exam has been completed by all students.',
      time: '1 hour ago',
      read: false
    },
    {
      id: 3,
      title: 'System Update',
      message: 'The system will undergo maintenance tonight at 2 AM.',
      time: '3 hours ago',
      read: true
    }
  ];

  return (
    <AppBar
      position="fixed"
      color="inherit"
      sx={{
        boxShadow: mode === 'dark' ? '0 4px 20px rgba(0, 0, 0, 0.2)' : '0 4px 20px rgba(0, 0, 0, 0.05)',
        backdropFilter: 'blur(10px)',
        borderBottom: `1px solid ${alpha(theme.palette.divider, mode === 'dark' ? 0.2 : 0.1)}`,
        backgroundColor: alpha(theme.palette.background.default, mode === 'dark' ? 0.7 : 0.85),
        transition: theme.transitions.create(['margin', 'width', 'background-color', 'box-shadow'], {
          easing: theme.transitions.easing.sharp,
          duration: theme.transitions.duration.leavingScreen,
        }),
        ...(sidebarOpen && {
          width: { md: `calc(100% - 280px)` },
          marginLeft: { md: `280px` },
          transition: theme.transitions.create(['margin', 'width', 'background-color', 'box-shadow'], {
            easing: theme.transitions.easing.easeOut,
            duration: theme.transitions.duration.enteringScreen,
          }),
        }),
      }}
    >
      <Toolbar sx={{ height: { xs: 64, md: 70 }, px: { xs: 1, sm: 2 } }}>
        {/* Menu toggle button */}
        <IconButton
          color="inherit"
          aria-label="open drawer"
          onClick={toggleSidebar}
          edge="start"
          sx={{
            mr: { xs: 1, sm: 2 },
            color: theme.palette.primary.main,
            backgroundColor: alpha(theme.palette.primary.main, 0.08),
            '&:hover': {
              backgroundColor: alpha(theme.palette.primary.main, 0.12),
            },
            borderRadius: 2,
            transition: 'all 0.3s ease',
            transform: sidebarOpen ? 'rotate(180deg)' : 'rotate(0deg)'
          }}
        >
          <MenuIcon />
        </IconButton>

        {/* Welcome message - visible on larger screens */}
        <Box sx={{ display: { xs: 'none', md: 'block' } }}>
          <Typography variant="h6" fontWeight="bold" color="text.primary">
            Welcome, {user?.firstName || 'Admin'}!
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </Typography>
        </Box>

        {/* Page title - visible on mobile only */}
        <Typography
          variant="subtitle1"
          noWrap
          component="div"
          sx={{
            display: { xs: 'block', md: 'none' },
            flexGrow: 1,
            fontWeight: 600,
            fontSize: { xs: '0.9rem', sm: '1.1rem' }
          }}
        >
          Admin Dashboard
        </Typography>

        {/* Search button for mobile - opens a full-screen search */}
        <IconButton
          sx={{
            display: { xs: 'flex', sm: 'none' },
            ml: 'auto',
            mr: 1,
            backgroundColor: alpha(theme.palette.primary.main, 0.08),
            color: theme.palette.primary.main
          }}
        >
          <SearchIcon />
        </IconButton>

        {/* Search bar - hidden on mobile */}
        <Search sx={{
          display: { xs: 'none', sm: 'block' },
          ml: { sm: 2, md: 4 },
          backgroundColor: mode === 'dark'
            ? alpha(theme.palette.common.white, 0.06)
            : alpha(theme.palette.common.black, 0.04),
          '&:hover': {
            backgroundColor: mode === 'dark'
              ? alpha(theme.palette.common.white, 0.08)
              : alpha(theme.palette.common.black, 0.06),
          },
          color: 'text.primary',
          boxShadow: mode === 'dark'
            ? `0 2px 8px ${alpha(theme.palette.common.black, 0.2)}`
            : `0 2px 5px ${alpha(theme.palette.common.black, 0.05)}`,
          borderRadius: 3,
          transition: 'all 0.3s ease',
          '&:focus-within': {
            boxShadow: `0 4px 10px ${alpha(theme.palette.primary.main, mode === 'dark' ? 0.25 : 0.15)}`,
            backgroundColor: mode === 'dark'
              ? alpha(theme.palette.common.white, 0.08)
              : alpha(theme.palette.common.black, 0.06),
          },
          width: { sm: '180px', md: '240px', lg: '300px' }
        }}>
          <SearchIconWrapper>
            <SearchIcon sx={{ color: 'text.secondary' }} />
          </SearchIconWrapper>
          <StyledInputBase
            placeholder="Search..."
            inputProps={{ 'aria-label': 'search' }}
          />
        </Search>

        <Box sx={{ flexGrow: { xs: 0, sm: 1 } }} />

        {/* Action buttons */}
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          {/* Theme toggle button - hidden on small mobile */}
          <Tooltip title={`Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`} arrow>
            <IconButton
              onClick={toggleMode}
              sx={{
                mx: { xs: 0.5, sm: 1 },
                display: { xs: 'none', sm: 'flex' },
                backgroundColor: alpha(theme.palette.primary.main, 0.08),
                '&:hover': {
                  backgroundColor: alpha(theme.palette.primary.main, 0.12),
                  transform: 'translateY(-3px)',
                },
                borderRadius: 2,
                transition: 'all 0.3s ease',
                color: mode === 'dark' ? theme.palette.primary.light : theme.palette.primary.main
              }}
            >
              {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
            </IconButton>
          </Tooltip>

          {/* Help button - hidden on small mobile */}
          <Tooltip title="Help & Support" arrow>
            <IconButton
              sx={{
                mx: { xs: 0.5, sm: 1 },
                display: { xs: 'none', sm: 'flex' },
                backgroundColor: alpha(theme.palette.info.main, 0.08),
                '&:hover': {
                  backgroundColor: alpha(theme.palette.info.main, 0.12),
                  transform: 'translateY(-3px)',
                },
                borderRadius: 2,
                transition: 'all 0.3s ease',
                color: theme.palette.info.main
              }}
            >
              <HelpIcon />
            </IconButton>
          </Tooltip>

          {/* Notifications */}
          <Tooltip title="Notifications" arrow>
            <IconButton
              onClick={handleOpenNotificationsMenu}
              sx={{
                mx: { xs: 0.5, sm: 1 },
                backgroundColor: alpha(theme.palette.secondary.main, 0.08),
                '&:hover': {
                  backgroundColor: alpha(theme.palette.secondary.main, 0.12),
                  transform: 'translateY(-3px)',
                },
                borderRadius: 2,
                transition: 'all 0.3s ease',
                color: theme.palette.secondary.main
              }}
            >
              <Badge
                badgeContent={2}
                color="error"
                sx={{
                  '& .MuiBadge-badge': {
                    boxShadow: '0 0 0 2px #fff'
                  }
                }}
              >
                <NotificationsIcon />
              </Badge>
            </IconButton>
          </Tooltip>

          {/* Notifications menu */}
          <Menu
            sx={{ mt: '45px' }}
            id="notifications-menu"
            anchorEl={anchorElNotifications}
            anchorOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            keepMounted
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            open={Boolean(anchorElNotifications)}
            onClose={handleCloseNotificationsMenu}
            PaperProps={{
              sx: {
                width: { xs: '100%', sm: 320 },
                maxWidth: { xs: 'calc(100% - 32px)', sm: 'none' },
                maxHeight: { xs: '80vh', sm: 400 },
                borderRadius: 3,
                boxShadow: '0 8px 30px rgba(0, 0, 0, 0.12)',
                overflow: 'hidden',
                left: { xs: '16px !important', sm: 'auto !important' },
                right: { xs: '16px !important', sm: 'auto !important' }
              }
            }}
          >
            <Box sx={{ p: 2, backgroundColor: alpha(theme.palette.primary.main, 0.08) }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>Notifications</Typography>
            </Box>
            <Divider />
            {notifications.length === 0 ? (
              <Box sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">No notifications</Typography>
              </Box>
            ) : (
              <>
                {notifications.map((notification) => (
                  <MenuItem
                    key={notification.id}
                    onClick={handleCloseNotificationsMenu}
                    sx={{
                      py: 1.5,
                      px: 2,
                      borderLeft: notification.read ? 'none' : `4px solid ${theme.palette.primary.main}`,
                      backgroundColor: notification.read ? 'transparent' : alpha(theme.palette.primary.main, 0.04)
                    }}
                  >
                    <Box sx={{ width: '100%' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        {notification.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" noWrap>
                        {notification.message}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                        {notification.time}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
                <Divider />
                <Box sx={{ p: 1, display: 'flex', justifyContent: 'center' }}>
                  <Button
                    size="small"
                    onClick={() => {
                      navigate('/admin/notifications');
                      handleCloseNotificationsMenu();
                    }}
                  >
                    View All
                  </Button>
                </Box>
              </>
            )}
          </Menu>

          {/* User profile */}
          <Tooltip title="Account settings" arrow>
            <IconButton
              onClick={handleOpenUserMenu}
              sx={{
                p: { xs: 0.3, sm: 0.5 },
                ml: { xs: 1, sm: 2 },
                border: `2px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-3px)',
                  border: `2px solid ${alpha(theme.palette.primary.main, 0.5)}`,
                }
              }}
            >
              <Avatar
                alt={user?.firstName || user?.email || 'User'}
                src="/static/images/avatar/2.jpg"
                sx={{
                  width: { xs: 32, sm: 38 },
                  height: { xs: 32, sm: 38 },
                  background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                  boxShadow: `0 4px 8px ${alpha(theme.palette.primary.main, 0.25)}`
                }}
              >
                {user?.firstName?.charAt(0) || user?.email?.charAt(0) || 'A'}
              </Avatar>
            </IconButton>
          </Tooltip>

          {/* User menu */}
          <Menu
            sx={{ mt: '45px' }}
            id="menu-appbar"
            anchorEl={anchorElUser}
            anchorOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            keepMounted
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            open={Boolean(anchorElUser)}
            onClose={handleCloseUserMenu}
            PaperProps={{
              sx: {
                width: { xs: '100%', sm: 250 },
                maxWidth: { xs: 'calc(100% - 32px)', sm: 'none' },
                borderRadius: 3,
                boxShadow: '0 10px 40px rgba(0, 0, 0, 0.1)',
                overflow: 'hidden',
                left: { xs: '16px !important', sm: 'auto !important' },
                right: { xs: '16px !important', sm: 'auto !important' }
              }
            }}
          >
            <Box sx={{
              p: 3,
              backgroundColor: mode === 'dark'
                ? alpha(theme.palette.primary.main, 0.15)
                : alpha(theme.palette.primary.main, 0.05),
              borderBottom: `1px solid ${alpha(theme.palette.divider, mode === 'dark' ? 0.2 : 0.1)}`,
              transition: 'all 0.3s ease'
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Avatar
                  alt={user?.firstName || user?.email || 'User'}
                  src="/static/images/avatar/2.jpg"
                  sx={{
                    width: 50,
                    height: 50,
                    background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                    boxShadow: `0 4px 8px ${alpha(theme.palette.primary.main, 0.25)}`,
                    mr: 2
                  }}
                >
                  {user?.firstName?.charAt(0) || user?.email?.charAt(0) || 'A'}
                </Avatar>
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    {user?.firstName ? `${user.firstName} ${user.lastName}` : user?.email || 'Admin User'}
                  </Typography>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      backgroundColor: alpha(theme.palette.success.main, 0.1),
                      color: theme.palette.success.main,
                      px: 1,
                      py: 0.2,
                      borderRadius: 10,
                      width: 'fit-content'
                    }}
                  >
                    <Box
                      sx={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        bgcolor: theme.palette.success.main,
                        mr: 0.5
                      }}
                    />
                    <Typography variant="caption" fontWeight="medium">
                      Administrator
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Box>
            <Box sx={{ py: 1 }}>
              <MenuItem onClick={handleProfile} sx={{ py: 1.5, px: 3 }}>
                <PersonIcon sx={{ mr: 2, fontSize: 20, color: theme.palette.primary.main }} />
                <Typography variant="body2">My Profile</Typography>
              </MenuItem>
              <MenuItem onClick={handleSettings} sx={{ py: 1.5, px: 3 }}>
                <SettingsIcon sx={{ mr: 2, fontSize: 20, color: theme.palette.secondary.main }} />
                <Typography variant="body2">Settings</Typography>
              </MenuItem>
              <Divider sx={{ my: 1 }} />
              <MenuItem onClick={handleLogout} sx={{ py: 1.5, px: 3 }}>
                <LogoutIcon sx={{ mr: 2, fontSize: 20, color: theme.palette.error.main }} />
                <Typography variant="body2" color="error">Logout</Typography>
              </MenuItem>
            </Box>
          </Menu>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Header;
