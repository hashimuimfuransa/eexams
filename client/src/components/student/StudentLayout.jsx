import React, { useState } from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Avatar,
  Tooltip,
  Menu,
  MenuItem,
  useTheme,
  useMediaQuery,
  Badge,
  alpha,
  Collapse,
  Button,
  Chip,
  LinearProgress,
  Zoom,
  Fade,
  Slide
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  School,
  Assessment,
  Person,
  Logout,
  ExpandLess,
  ExpandMore,
  Notifications,
  Settings,
  Help,
  ChevronLeft,
  ChevronRight,
  Assignment,
  EmojiEvents,
  History,
  AccountCircle,
  DarkMode as DarkModeIcon,
  LightMode as LightModeIcon,
  Star,
  LocalFireDepartment,
  TrendingUp,
  Verified,
  WorkspacePremium,
  AutoGraph,
  Close
} from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';
import { useThemeMode } from '../../context/ThemeContext';

const drawerWidth = 260;

const StudentLayout = ({ children }) => {
  const theme = useTheme();
  const { user, logout } = useAuth();
  const { mode, toggleMode } = useThemeMode();
  const location = useLocation();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [notificationsAnchorEl, setNotificationsAnchorEl] = useState(null);
  const [examSubmenuOpen, setExamSubmenuOpen] = useState(true);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleProfileMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setAnchorEl(null);
  };

  const handleNotificationsOpen = (event) => {
    setNotificationsAnchorEl(event.currentTarget);
  };

  const handleNotificationsClose = () => {
    setNotificationsAnchorEl(null);
  };

  const handleLogout = () => {
    handleProfileMenuClose();
    logout();
  };

  const toggleExamSubmenu = () => {
    setExamSubmenuOpen(!examSubmenuOpen);
  };

  const isActive = (path) => {
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const drawer = (
    <Box sx={{
      overflow: 'auto',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: mode === 'dark'
        ? `linear-gradient(180deg, ${alpha(theme.palette.background.paper, 0.95)} 0%, ${alpha(theme.palette.background.paper, 0.98)} 100%)`
        : `linear-gradient(180deg, #fafbfc 0%, #f8f9fa 100%)`,
      borderRight: `1px solid ${mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'}`,
      transition: 'all 0.3s ease',
      position: 'relative'
    }}>
      {/* Enhanced Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          padding: theme.spacing(3),
          background: `linear-gradient(135deg,
            ${theme.palette.primary.dark} 0%,
            ${theme.palette.primary.main} 50%,
            ${theme.palette.secondary.main} 100%)`,
          color: 'white',
          position: 'relative',
          overflow: 'hidden',
          minHeight: 80
        }}
      >
        {/* Enhanced decorative elements */}
        <Box
          sx={{
            position: 'absolute',
            top: -30,
            right: -30,
            width: '120px',
            height: '120px',
            background: 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)',
            borderRadius: '50%',
            animation: 'headerFloat 8s ease-in-out infinite',
            '@keyframes headerFloat': {
              '0%': { transform: 'translateY(0px) rotate(0deg)' },
              '50%': { transform: 'translateY(-10px) rotate(180deg)' },
              '100%': { transform: 'translateY(0px) rotate(360deg)' }
            }
          }}
        />

        {/* Header sparkles */}
        {[...Array(5)].map((_, i) => (
          <Box
            key={i}
            sx={{
              position: 'absolute',
              width: 3,
              height: 3,
              borderRadius: '50%',
              bgcolor: 'rgba(255,255,255,0.8)',
              top: `${20 + i * 15}%`,
              left: `${10 + i * 20}%`,
              animation: `headerSparkle 3s ease-in-out infinite ${i * 0.4}s`,
              '@keyframes headerSparkle': {
                '0%, 100%': { opacity: 0, transform: 'scale(0)' },
                '50%': { opacity: 1, transform: 'scale(1)' }
              }
            }}
          />
        ))}

        {/* Enhanced logo */}
        <Box sx={{ position: 'relative' }}>
          <Box
            sx={{
              position: 'absolute',
              top: -4,
              left: -4,
              right: -4,
              bottom: -4,
              borderRadius: '50%',
              background: `conic-gradient(
                ${theme.palette.secondary.main} 0deg,
                ${theme.palette.warning.main} 120deg,
                ${theme.palette.info.main} 240deg,
                ${theme.palette.secondary.main} 360deg
              )`,
              animation: 'logoRotate 8s linear infinite',
              '@keyframes logoRotate': {
                '0%': { transform: 'rotate(0deg)' },
                '100%': { transform: 'rotate(360deg)' }
              }
            }}
          />

          <Avatar
            src="/logo.png"
            alt="Logo"
            sx={{
              bgcolor: 'background.paper',
              width: 60,
              height: 60,
              boxShadow: '0 6px 16px rgba(0,0,0,0.3)',
              border: '3px solid white',
              position: 'relative',
              zIndex: 2,
              animation: 'logoFloat 6s ease-in-out infinite',
              '@keyframes logoFloat': {
                '0%, 100%': { transform: 'translateY(0px)' },
                '50%': { transform: 'translateY(-4px)' }
              }
            }}
          />
        </Box>

        {isMobile && (
          <IconButton
            onClick={handleDrawerToggle}
            sx={{
              color: 'white',
              bgcolor: 'rgba(255,255,255,0.15)',
              border: '1px solid rgba(255,255,255,0.2)',
              '&:hover': {
                bgcolor: 'rgba(255,255,255,0.25)',
                transform: 'scale(1.05)'
              },
              transition: 'all 0.3s ease'
            }}
          >
            <Close />
          </IconButton>
        )}
      </Box>
      <Divider />

      <Box sx={{ p: { xs: 2, sm: 2.5 } }}>
        <Fade in={true} timeout={800}>
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            mb: 2,
            p: { xs: 2, sm: 2.5 },
            borderRadius: 3,
            background: `linear-gradient(135deg,
              ${alpha(theme.palette.primary.main, 0.06)} 0%,
              ${alpha(theme.palette.secondary.main, 0.06)} 100%)`,
            border: `1px solid ${alpha(theme.palette.primary.main, 0.12)}`,
            boxShadow: `0 2px 8px ${alpha(theme.palette.primary.main, 0.08)}`,
            position: 'relative',
            overflow: 'hidden',
            transition: 'all 0.3s ease',
            '&:hover': {
              transform: 'translateY(-1px)',
              boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.12)}`
            }
          }}>
            {/* Simplified glow effect */}
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                background: `radial-gradient(circle at top left, ${alpha(theme.palette.primary.main, 0.03)} 0%, transparent 60%)`,
                opacity: 0.7
              }}
            />

            {/* Optimized Avatar */}
            <Box sx={{ position: 'relative', mr: 2 }}>
              <Avatar
                sx={{
                  width: { xs: 48, sm: 52 },
                  height: { xs: 48, sm: 52 },
                  bgcolor: theme.palette.primary.main,
                  color: 'white',
                  fontSize: { xs: '1.2rem', sm: '1.3rem' },
                  fontWeight: 'bold',
                  boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.3)}`,
                  border: '3px solid white',
                  position: 'relative',
                  zIndex: 2
                }}
              >
                {user?.firstName?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'S'}
              </Avatar>

              {/* Status indicator */}
              <Box
                sx={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  bgcolor: 'success.main',
                  border: '2px solid white',
                  boxShadow: `0 0 0 1px ${alpha(theme.palette.success.main, 0.3)}`,
                  zIndex: 3
                }}
              />
            </Box>

            <Box sx={{ flex: 1, position: 'relative', zIndex: 1, minWidth: 0 }}>
              <Typography
                variant="subtitle1"
                fontWeight="bold"
                sx={{
                  fontSize: { xs: '0.95rem', sm: '1rem' },
                  mb: 0.5,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {user?.firstName ? `${user.firstName} ${user.lastName}` : user?.email || 'Student'}
              </Typography>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                <Chip
                  icon={<WorkspacePremium sx={{ fontSize: '0.8rem' }} />}
                  label="Student"
                  size="small"
                  sx={{
                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                    color: theme.palette.primary.main,
                    fontWeight: 'medium',
                    fontSize: '0.7rem',
                    height: 20,
                    borderRadius: 2,
                    '& .MuiChip-icon': {
                      color: theme.palette.primary.main
                    }
                  }}
                />
                <Chip
                  icon={<Verified sx={{ fontSize: '0.7rem' }} />}
                  label="Active"
                  size="small"
                  sx={{
                    bgcolor: alpha(theme.palette.success.main, 0.1),
                    color: theme.palette.success.main,
                    fontWeight: 'medium',
                    fontSize: '0.65rem',
                    height: 18,
                    borderRadius: 2,
                    '& .MuiChip-icon': {
                      color: theme.palette.success.main
                    }
                  }}
                />
              </Box>

              {/* Compact progress indicator */}
              <Box sx={{ mt: 0.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight="medium" sx={{ fontSize: '0.7rem' }}>
                    Progress
                  </Typography>
                  <Typography variant="caption" color="primary.main" fontWeight="bold" sx={{ fontSize: '0.7rem' }}>
                    75%
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={75}
                  sx={{
                    height: 4,
                    borderRadius: 2,
                    bgcolor: alpha(theme.palette.grey[300], 0.3),
                    '& .MuiLinearProgress-bar': {
                      borderRadius: 2,
                      background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`
                    }
                  }}
                />
              </Box>
            </Box>
          </Box>
        </Fade>
      </Box>

      <Divider />

      <List component="nav" sx={{
        px: 2,
        position: 'relative',
        '&::before': {
          content: '""',
          position: 'absolute',
          left: '10px',
          top: '10px',
          bottom: '10px',
          width: '1px',
          background: 'linear-gradient(to bottom, transparent, rgba(13, 64, 108, 0.2), transparent)',
          zIndex: 0
        }
      }}>
        <Fade in={true} timeout={600}>
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            pl: 2,
            mb: 2,
            mt: 1
          }}>
            <Box
              sx={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                animation: 'menuIconRotate 8s linear infinite',
                '@keyframes menuIconRotate': {
                  '0%': { transform: 'rotate(0deg)' },
                  '100%': { transform: 'rotate(360deg)' }
                }
              }}
            >
              <Star sx={{ fontSize: '0.8rem', color: 'white' }} />
            </Box>
            <Typography
              variant="overline"
              sx={{
                opacity: 0.8,
                fontWeight: 'bold',
                letterSpacing: 1.2,
                fontSize: '0.75rem',
                background: `linear-gradient(135deg, ${theme.palette.text.primary}, ${alpha(theme.palette.text.primary, 0.7)})`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}
            >
              MAIN MENU
            </Typography>
          </Box>
        </Fade>

        <Zoom in={true} style={{ transitionDelay: '100ms' }}>
          <ListItem disablePadding sx={{ mb: 1.5 }}>
            <ListItemButton
              component={RouterLink}
              to="/student/dashboard"
              selected={isActive('/student/dashboard') || isActive('/student')}
              sx={{
                borderRadius: 3,
                py: 2,
                px: 2,
                position: 'relative',
                overflow: 'hidden',
                transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)}, ${alpha(theme.palette.secondary.main, 0.05)})`,
                  opacity: 0,
                  transition: 'opacity 0.3s ease'
                },
                '&.Mui-selected': {
                  background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.12)}, ${alpha(theme.palette.primary.light, 0.08)})`,
                  color: 'primary.main',
                  borderLeft: '4px solid',
                  borderColor: 'primary.main',
                  boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.2)}`,
                  transform: 'translateX(4px)',
                  '&:hover': {
                    background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.15)}, ${alpha(theme.palette.primary.light, 0.1)})`,
                    transform: 'translateX(6px) scale(1.02)',
                  },
                  '& .MuiListItemIcon-root': {
                    color: 'primary.main',
                    transform: 'scale(1.1)'
                  },
                  '&::before': {
                    opacity: 1
                  }
                },
                '&:hover': {
                  background: alpha(theme.palette.primary.main, 0.06),
                  transform: 'translateX(6px) scale(1.02)',
                  boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.1)}`,
                  '&::before': {
                    opacity: 1
                  }
                }
              }}
            >
              <ListItemIcon sx={{ minWidth: 48, transition: 'all 0.3s ease' }}>
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: isActive('/student/dashboard') || isActive('/student')
                      ? `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.15)}, ${alpha(theme.palette.primary.light, 0.1)})`
                      : alpha(theme.palette.grey[100], 0.5),
                    transition: 'all 0.3s ease',
                    position: 'relative',
                    overflow: 'hidden',
                    '&::after': isActive('/student/dashboard') || isActive('/student') ? {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: '-100%',
                      width: '100%',
                      height: '100%',
                      background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
                      animation: 'iconShine 2s ease-in-out infinite',
                      '@keyframes iconShine': {
                        '0%': { left: '-100%' },
                        '100%': { left: '100%' }
                      }
                    } : {}
                  }}
                >
                  <DashboardIcon
                    sx={{
                      fontSize: '1.2rem',
                      color: isActive('/student/dashboard') || isActive('/student') ? 'primary.main' : 'text.secondary',
                      transition: 'all 0.3s ease'
                    }}
                  />
                </Box>
              </ListItemIcon>
              <ListItemText
                primary="Dashboard"
                primaryTypographyProps={{
                  fontWeight: isActive('/student/dashboard') || isActive('/student') ? 'bold' : 'medium',
                  fontSize: '0.95rem',
                  transition: 'all 0.3s ease'
                }}
              />

              {/* Active indicator */}
              {(isActive('/student/dashboard') || isActive('/student')) && (
                <Box
                  sx={{
                    position: 'absolute',
                    right: 12,
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    bgcolor: theme.palette.primary.main,
                    boxShadow: `0 0 8px ${theme.palette.primary.main}`,
                    animation: 'activeIndicator 2s ease-in-out infinite',
                    '@keyframes activeIndicator': {
                      '0%, 100%': { opacity: 1, transform: 'scale(1)' },
                      '50%': { opacity: 0.7, transform: 'scale(1.2)' }
                    }
                  }}
                />
              )}
            </ListItemButton>
          </ListItem>
        </Zoom>

        <ListItem disablePadding sx={{ mb: 1 }}>
          <ListItemButton
            onClick={toggleExamSubmenu}
            sx={{
              borderRadius: 0, // Remove rounded corners
              py: 1.5, // Increase padding for better touch targets
              mb: 0.5, // Add margin between items
              ...(isActive('/student/exams') || isActive('/student/exam') || isActive('/student/results') || isActive('/student/history') ? {
                background: 'linear-gradient(90deg, rgba(13, 64, 108, 0.1) 0%, rgba(13, 64, 108, 0.2) 100%)',
                color: 'primary.main',
                borderLeft: '4px solid', // Add left border for selected items
                borderColor: 'primary.main',
                '& .MuiListItemIcon-root': {
                  color: 'primary.main',
                },
                boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
              } : {}),
              '&:hover': {
                background: 'rgba(0, 0, 0, 0.04)',
                borderLeft: '4px solid', // Add left border on hover
                borderColor: 'rgba(13, 64, 108, 0.3)',
              },
              transition: 'all 0.2s ease',
            }}
          >
            <ListItemIcon>
              <Avatar
                sx={{
                  bgcolor: isActive('/student/exams') || isActive('/student/exam') || isActive('/student/results') || isActive('/student/history') ? 'primary.lighter' : 'transparent',
                  color: isActive('/student/exams') || isActive('/student/exam') || isActive('/student/results') || isActive('/student/history') ? 'primary.main' : 'action.active',
                  width: 32,
                  height: 32,
                }}
              >
                <Assignment fontSize="small" />
              </Avatar>
            </ListItemIcon>
            <ListItemText
              primary="Exams"
              primaryTypographyProps={{
                fontWeight: isActive('/student/exams') || isActive('/student/exam') || isActive('/student/results') || isActive('/student/history') ? 'bold' : 'medium'
              }}
            />
            {examSubmenuOpen ? <ExpandLess /> : <ExpandMore />}
          </ListItemButton>
        </ListItem>

        <Collapse in={examSubmenuOpen} timeout="auto" unmountOnExit>
          <List component="div" disablePadding sx={{ ml: 2, mt: 1 }}>
            <ListItemButton
              component={RouterLink}
              to="/student/exams"
              selected={isActive('/student/exams')}
              sx={{
                pl: 2,
                borderRadius: 0, // Remove rounded corners
                mb: 1,
                py: 1.2, // Increase padding for better touch targets
                '&.Mui-selected': {
                  backgroundColor: 'primary.lighter',
                  color: 'primary.main',
                  borderLeft: '3px solid', // Add left border for selected items
                  borderColor: 'primary.main',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
                },
                '&:hover': {
                  backgroundColor: 'rgba(0, 0, 0, 0.04)',
                  borderLeft: '3px solid', // Add left border on hover
                  borderColor: 'rgba(13, 64, 108, 0.3)',
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>
                <School fontSize="small" color={isActive('/student/exams') ? 'primary' : 'inherit'} />
              </ListItemIcon>
              <ListItemText
                primary="Available Exams"
                primaryTypographyProps={{
                  fontSize: '0.9rem',
                  fontWeight: isActive('/student/exams') ? 'bold' : 'medium'
                }}
              />
            </ListItemButton>

            <ListItemButton
              component={RouterLink}
              to="/student/results"
              selected={isActive('/student/results')}
              sx={{
                pl: 2,
                borderRadius: 0, // Remove rounded corners
                mb: 1,
                py: 1.2, // Increase padding for better touch targets
                '&.Mui-selected': {
                  backgroundColor: 'primary.lighter',
                  color: 'primary.main',
                  borderLeft: '3px solid', // Add left border for selected items
                  borderColor: 'primary.main',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
                },
                '&:hover': {
                  backgroundColor: 'rgba(0, 0, 0, 0.04)',
                  borderLeft: '3px solid', // Add left border on hover
                  borderColor: 'rgba(13, 64, 108, 0.3)',
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>
                <EmojiEvents fontSize="small" color={isActive('/student/results') ? 'primary' : 'inherit'} />
              </ListItemIcon>
              <ListItemText
                primary="Results"
                primaryTypographyProps={{
                  fontSize: '0.9rem',
                  fontWeight: isActive('/student/results') ? 'bold' : 'medium'
                }}
              />
            </ListItemButton>

            <ListItemButton
              component={RouterLink}
              to="/student/history"
              selected={isActive('/student/history')}
              sx={{
                pl: 2,
                borderRadius: 0, // Remove rounded corners
                mb: 1,
                py: 1.2, // Increase padding for better touch targets
                '&.Mui-selected': {
                  backgroundColor: 'primary.lighter',
                  color: 'primary.main',
                  borderLeft: '3px solid', // Add left border for selected items
                  borderColor: 'primary.main',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
                },
                '&:hover': {
                  backgroundColor: 'rgba(0, 0, 0, 0.04)',
                  borderLeft: '3px solid', // Add left border on hover
                  borderColor: 'rgba(13, 64, 108, 0.3)',
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>
                <History fontSize="small" color={isActive('/student/history') ? 'primary' : 'inherit'} />
              </ListItemIcon>
              <ListItemText
                primary="Exam History"
                primaryTypographyProps={{
                  fontSize: '0.9rem',
                  fontWeight: isActive('/student/history') ? 'bold' : 'medium'
                }}
              />
            </ListItemButton>
          </List>
        </Collapse>

        <Fade in={true} timeout={800}>
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            pl: 2,
            mb: 2,
            mt: 2
          }}>
            <Box
              sx={{
                width: 20,
                height: 20,
                borderRadius: '50%',
                background: `linear-gradient(135deg, ${theme.palette.secondary.main}, ${theme.palette.info.main})`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Person sx={{ fontSize: '0.7rem', color: 'white' }} />
            </Box>
            <Typography
              variant="overline"
              sx={{
                opacity: 0.8,
                fontWeight: 'bold',
                letterSpacing: 1.2,
                fontSize: '0.75rem',
                background: `linear-gradient(135deg, ${theme.palette.text.primary}, ${alpha(theme.palette.text.primary, 0.7)})`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}
            >
              ACCOUNT
            </Typography>
          </Box>
        </Fade>

        <Zoom in={true} style={{ transitionDelay: '300ms' }}>
          <ListItem disablePadding sx={{ mb: 1.5 }}>
            <ListItemButton
              component={RouterLink}
              to="/student/profile"
              selected={isActive('/student/profile')}
              sx={{
                borderRadius: 3,
                py: 2,
                px: 2,
                position: 'relative',
                overflow: 'hidden',
                transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  background: `linear-gradient(135deg, ${alpha(theme.palette.secondary.main, 0.05)}, ${alpha(theme.palette.info.main, 0.05)})`,
                  opacity: 0,
                  transition: 'opacity 0.3s ease'
                },
                '&.Mui-selected': {
                  background: `linear-gradient(135deg, ${alpha(theme.palette.secondary.main, 0.12)}, ${alpha(theme.palette.secondary.light, 0.08)})`,
                  color: 'secondary.main',
                  borderLeft: '4px solid',
                  borderColor: 'secondary.main',
                  boxShadow: `0 4px 12px ${alpha(theme.palette.secondary.main, 0.2)}`,
                  transform: 'translateX(4px)',
                  '&:hover': {
                    background: `linear-gradient(135deg, ${alpha(theme.palette.secondary.main, 0.15)}, ${alpha(theme.palette.secondary.light, 0.1)})`,
                    transform: 'translateX(6px) scale(1.02)',
                  },
                  '& .MuiListItemIcon-root': {
                    color: 'secondary.main',
                    transform: 'scale(1.1)'
                  },
                  '&::before': {
                    opacity: 1
                  }
                },
                '&:hover': {
                  background: alpha(theme.palette.secondary.main, 0.06),
                  transform: 'translateX(6px) scale(1.02)',
                  boxShadow: `0 4px 12px ${alpha(theme.palette.secondary.main, 0.1)}`,
                  '&::before': {
                    opacity: 1
                  }
                }
              }}
            >
              <ListItemIcon sx={{ minWidth: 48, transition: 'all 0.3s ease' }}>
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: isActive('/student/profile')
                      ? `linear-gradient(135deg, ${alpha(theme.palette.secondary.main, 0.15)}, ${alpha(theme.palette.secondary.light, 0.1)})`
                      : alpha(theme.palette.grey[100], 0.5),
                    transition: 'all 0.3s ease'
                  }}
                >
                  <Person
                    sx={{
                      fontSize: '1.2rem',
                      color: isActive('/student/profile') ? 'secondary.main' : 'text.secondary',
                      transition: 'all 0.3s ease'
                    }}
                  />
                </Box>
              </ListItemIcon>
              <ListItemText
                primary="Profile"
                primaryTypographyProps={{
                  fontWeight: isActive('/student/profile') ? 'bold' : 'medium',
                  fontSize: '0.95rem',
                  transition: 'all 0.3s ease'
                }}
              />

              {/* Active indicator */}
              {isActive('/student/profile') && (
                <Box
                  sx={{
                    position: 'absolute',
                    right: 12,
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    bgcolor: theme.palette.secondary.main,
                    boxShadow: `0 0 8px ${theme.palette.secondary.main}`,
                    animation: 'activeIndicator 2s ease-in-out infinite',
                    '@keyframes activeIndicator': {
                      '0%, 100%': { opacity: 1, transform: 'scale(1)' },
                      '50%': { opacity: 0.7, transform: 'scale(1.2)' }
                    }
                  }}
                />
              )}
            </ListItemButton>
          </ListItem>
        </Zoom>

        <Box sx={{ px: 2, mt: 3, mb: 2 }}>
          <Zoom in={true} style={{ transitionDelay: '400ms' }}>
            <Button
              fullWidth
              variant="contained"
              color="error"
              onClick={handleLogout}
              startIcon={<Logout />}
              sx={{
                py: 1.8,
                borderRadius: 3,
                fontWeight: 'bold',
                fontSize: '0.9rem',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: `0 4px 12px ${alpha(theme.palette.error.main, 0.3)}`,
                transition: 'all 0.3s ease',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: '-100%',
                  width: '100%',
                  height: '100%',
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
                  transition: 'all 0.6s ease'
                },
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: `0 6px 16px ${alpha(theme.palette.error.main, 0.4)}`,
                  '&::before': {
                    left: '100%'
                  }
                },
                '&:active': {
                  transform: 'translateY(0px)'
                }
              }}
            >
              Logout
            </Button>
          </Zoom>
        </Box>
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
          boxShadow: mode === 'dark' ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 15px rgba(0,0,0,0.15)',
          background: mode === 'dark'
            ? 'linear-gradient(135deg, #2c1a4d 0%, #3a2063 100%)'
            : 'linear-gradient(135deg, #0D406C 0%, #1A5A8C 100%)',
          color: 'white',
          borderRadius: 0,
          borderBottom: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.1)'}`,
          transition: 'all 0.3s ease'
        }}
      >
        <Toolbar sx={{ py: { xs: 1, md: 1.5 } }}>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{
              mr: 2,
              display: { md: 'none' },
              bgcolor: 'rgba(255,255,255,0.1)',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' }
            }}
          >
            <MenuIcon />
          </IconButton>

          {/* Page title - can be dynamic based on current route */}
          <Typography
            variant="h6"
            component="h1"
            sx={{
              display: { xs: 'none', sm: 'block' },
              fontWeight: 'bold',
              letterSpacing: '0.5px',
              textShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }}
          >
            Student Portal
          </Typography>

          <Box sx={{ flexGrow: 1 }} />

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Tooltip title="Notifications">
              <IconButton
                size="large"
                color="inherit"
                onClick={handleNotificationsOpen}
                sx={{
                  bgcolor: 'rgba(255,255,255,0.1)',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' }
                }}
              >
                <Badge badgeContent={3} color="error">
                  <Notifications />
                </Badge>
              </IconButton>
            </Tooltip>

            <Tooltip title={`Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`}>
              <IconButton
                size="large"
                color="inherit"
                onClick={toggleMode}
                sx={{
                  bgcolor: 'rgba(255,255,255,0.1)',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' },
                  transition: 'all 0.3s ease',
                }}
              >
                {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
              </IconButton>
            </Tooltip>

            <Tooltip title="Help">
              <IconButton
                size="large"
                color="inherit"
                sx={{
                  bgcolor: 'rgba(255,255,255,0.1)',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' }
                }}
              >
                <Help />
              </IconButton>
            </Tooltip>

            <Tooltip title="Account">
              <IconButton
                size="large"
                edge="end"
                onClick={handleProfileMenuOpen}
                color="inherit"
                sx={{
                  bgcolor: 'rgba(255,255,255,0.1)',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' }
                }}
              >
                <AccountCircle />
              </IconButton>
            </Tooltip>
          </Box>
        </Toolbar>
      </AppBar>

      <Box
        component="nav"
        sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile
          }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
              borderRadius: 0 // Remove rounded corners
            },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
              borderRadius: 0 // Remove rounded corners
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 1.5, sm: 2, md: 3 },
          width: { md: `calc(100% - ${drawerWidth}px)` },
          minHeight: '100vh',
          backgroundColor: 'background.default',
          pt: { xs: 8, md: 10 },
          transition: theme.transitions.create(['width', 'margin', 'background-color'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
          maxWidth: '100%',
          boxSizing: 'border-box',
          overflow: 'hidden',
          position: 'relative',
          '&::before': mode === 'dark' ? {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '200px',
            background: 'radial-gradient(circle at top right, rgba(13, 64, 108, 0.1), transparent 70%)',
            pointerEvents: 'none',
            zIndex: 0
          } : {}
        }}
      >
        {children}
      </Box>

      {/* Profile Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleProfileMenuClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        PaperProps={{
          elevation: 3,
          sx: {
            mt: 1.5,
            width: 200,
            borderRadius: 0, // Remove rounded corners
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
          }
        }}
      >
        <MenuItem component={RouterLink} to="/student/profile" onClick={handleProfileMenuClose}>
          <ListItemIcon>
            <Person fontSize="small" />
          </ListItemIcon>
          Profile
        </MenuItem>
        <MenuItem onClick={handleProfileMenuClose}>
          <ListItemIcon>
            <Settings fontSize="small" />
          </ListItemIcon>
          Settings
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleLogout}>
          <ListItemIcon>
            <Logout fontSize="small" color="error" />
          </ListItemIcon>
          <Typography color="error">Logout</Typography>
        </MenuItem>
      </Menu>

      {/* Notifications Menu */}
      <Menu
        anchorEl={notificationsAnchorEl}
        open={Boolean(notificationsAnchorEl)}
        onClose={handleNotificationsClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        PaperProps={{
          elevation: 3,
          sx: {
            mt: 1.5,
            width: 320,
            borderRadius: 0, // Remove rounded corners
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
          }
        }}
      >
        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle1" fontWeight="bold">Notifications</Typography>
        </Box>
        <MenuItem onClick={handleNotificationsClose}>
          <Box sx={{ width: '100%' }}>
            <Typography variant="body2" fontWeight="medium">New exam assigned</Typography>
            <Typography variant="caption" color="text.secondary">
              Mathematics 101 exam has been assigned to you
            </Typography>
          </Box>
        </MenuItem>
        <MenuItem onClick={handleNotificationsClose}>
          <Box sx={{ width: '100%' }}>
            <Typography variant="body2" fontWeight="medium">Exam results available</Typography>
            <Typography variant="caption" color="text.secondary">
              Your Physics 202 exam results are now available
            </Typography>
          </Box>
        </MenuItem>
        <MenuItem onClick={handleNotificationsClose}>
          <Box sx={{ width: '100%' }}>
            <Typography variant="body2" fontWeight="medium">Upcoming exam reminder</Typography>
            <Typography variant="caption" color="text.secondary">
              Chemistry 101 exam starts in 2 days
            </Typography>
          </Box>
        </MenuItem>
        <Box sx={{ p: 1, borderTop: '1px solid', borderColor: 'divider', textAlign: 'center' }}>
          <Button size="small" onClick={handleNotificationsClose}>
            View all notifications
          </Button>
        </Box>
      </Menu>
    </Box>
  );
};

export default StudentLayout;
