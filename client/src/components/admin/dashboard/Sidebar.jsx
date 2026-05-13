import React, { useState } from 'react';
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Collapse,
  Divider,
  Typography,
  Avatar,
  IconButton,
  useTheme,
  useMediaQuery,
  alpha
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Assignment as ExamIcon,
  People as StudentIcon,
  BarChart as AnalyticsIcon,
  Security as SecurityIcon,
  Settings as SettingsIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  ChevronLeft as ChevronLeftIcon,
  DarkMode as DarkModeIcon,
  LightMode as LightModeIcon,
  ManageAccounts as ManageIcon,
  Assessment as GradeIcon,
  Leaderboard as LeaderboardIcon,
  FileDownload as ExportIcon,
  Insights as InsightsIcon,
  SupervisorAccount as TeacherIcon
} from '@mui/icons-material';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { useThemeMode } from '../../../context/ThemeContext';

// Sidebar width
const drawerWidth = 280;

const Sidebar = ({ open, onClose }) => {
  const theme = useTheme();
  const location = useLocation();
  const { user } = useAuth();
  const { mode, toggleMode } = useThemeMode();

  // State for expanded menu items
  const [expandedItems, setExpandedItems] = useState({
    exams: location.pathname.includes('/admin/exams'),
    students: location.pathname.includes('/admin/students'),
    results: location.pathname.includes('/admin/results'),
    security: location.pathname.includes('/admin/security'),
    settings: location.pathname.includes('/admin/settings')
  });

  // Toggle expanded state for menu items
  const handleToggleExpand = (item) => {
    setExpandedItems({
      ...expandedItems,
      [item]: !expandedItems[item]
    });
  };

  // Check if a route is active
  const isActive = (path) => {
    return location.pathname === `/admin${path}`;
  };

  // Check if a parent route is active
  const isParentActive = (path) => {
    return location.pathname.startsWith(`/admin${path}`);
  };

  // Menu items configuration
  const menuItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <DashboardIcon />,
      path: '/',
      exact: true
    },
    {
      id: 'exams',
      label: 'Exam Management',
      icon: <ExamIcon />,
      expandable: true,
      subItems: [
        { id: 'exams-list', label: 'All Exams', path: '/exams' },
        { id: 'exams-create', label: 'Create Exam', path: '/exams/create' },
        { id: 'exams-schedule', label: 'Schedule Exam', path: '/exams/schedule' },
        { id: 'exams-scheduled', label: 'Scheduled Exams', path: '/exams/scheduled' },
        { id: 'exams-grading', label: 'AI Grading', path: '/exams/grading' },
        { id: 'exams-regrade', label: 'Regrade Exams', path: '/exams/regrade' },
        { id: 'exams-templates', label: 'Exam Templates', path: '/exams/templates' }
      ]
    },
    {
      id: 'students',
      label: 'Student Management',
      icon: <StudentIcon />,
      expandable: true,
      subItems: [
        { id: 'students-list', label: 'All Students', path: '/students' },
        { id: 'students-add', label: 'Add Student', path: '/students/add' },
        { id: 'students-import', label: 'Import Students', path: '/students/import' },
        { id: 'students-groups', label: 'Student Groups', path: '/students/groups' }
      ]
    },
    {
      id: 'teachers',
      label: 'Teachers',
      icon: <TeacherIcon />,
      path: '/teachers',
      adminOnly: true
    },
    {
      id: 'results',
      label: 'Results & Analytics',
      icon: <AnalyticsIcon />,
      expandable: true,
      subItems: [
        { id: 'results-manage', label: 'Manage & Regrade', path: '/results/manage', icon: <ManageIcon />, description: 'View and regrade student results' },
        { id: 'results-overview', label: 'Results Overview', path: '/results', icon: <AnalyticsIcon />, description: 'General results overview' },
        { id: 'results-analytics', label: 'Performance Analytics', path: '/results/analytics', icon: <InsightsIcon />, description: 'Detailed performance analysis' },
        { id: 'results-leaderboard', label: 'Student Leaderboard', path: '/results/leaderboard', icon: <LeaderboardIcon />, description: 'Student rankings and achievements' },
        { id: 'results-export', label: 'Export Data', path: '/results/export', icon: <ExportIcon />, description: 'Export results to files' }
      ]
    },
    {
      id: 'security',
      label: 'Security',
      icon: <SecurityIcon />,
      expandable: true,
      subItems: [
        { id: 'security-monitoring', label: 'Live Monitoring', path: '/security/monitoring' },
        { id: 'security-alerts', label: 'Security Alerts', path: '/security/alerts' },
        { id: 'security-logs', label: 'Activity Logs', path: '/security/logs' }
      ]
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: <SettingsIcon />,
      expandable: true,
      subItems: [
        { id: 'settings-profile', label: 'Profile Settings', path: '/settings/profile' },
        { id: 'settings-system', label: 'System Settings', path: '/settings/system' },
        { id: 'settings-appearance', label: 'Appearance', path: '/settings/appearance' }
      ]
    }
  ];

  // Render sidebar content
  const sidebarContent = (
    <>
      {/* Logo and close button */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 2,
          height: 70,
          background: mode === 'dark'
            ? `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.15)}, ${alpha(theme.palette.secondary.main, 0.15)})`
            : `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)}, ${alpha(theme.palette.secondary.main, 0.05)})`,
          borderBottom: `1px solid ${alpha(theme.palette.divider, mode === 'dark' ? 0.2 : 0.1)}`,
          transition: 'all 0.3s ease'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Avatar
            src="/logo.png"
            alt="Logo"
            sx={{
              width: 60,
              height: 60,
              backgroundColor: mode === 'dark' ? 'rgba(255,255,255,0.95)' : 'transparent',
              p: mode === 'dark' ? '4px' : '0',
              boxShadow: `0 4px 8px ${alpha(theme.palette.primary.main, 0.3)}`,
            }}
          />
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          {/* Theme toggle button - visible only on mobile */}
          <IconButton
            onClick={toggleMode}
            sx={{
              display: { xs: 'flex', sm: 'none' },
              mr: 1,
              backgroundColor: alpha(theme.palette.primary.main, 0.08),
              '&:hover': {
                backgroundColor: alpha(theme.palette.primary.main, 0.12),
              },
              color: mode === 'dark' ? theme.palette.primary.light : theme.palette.primary.main
            }}
          >
            {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
          </IconButton>
          <IconButton
            onClick={onClose}
            sx={{
              display: { md: 'none' },
              backgroundColor: alpha(theme.palette.primary.main, 0.1),
              '&:hover': {
                backgroundColor: alpha(theme.palette.primary.main, 0.2),
              }
            }}
          >
            <ChevronLeftIcon />
          </IconButton>
        </Box>
      </Box>

      <Divider />

      {/* User profile section */}
      <Box
        sx={{
          p: 3,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          mb: 1,
          background: mode === 'dark'
            ? `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)}, ${alpha(theme.palette.secondary.main, 0.1)})`
            : `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.03)}, ${alpha(theme.palette.secondary.main, 0.03)})`,
          transition: 'all 0.3s ease'
        }}
      >
        <Avatar
          sx={{
            width: 90,
            height: 90,
            mb: 2,
            background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
            boxShadow: `0 4px 20px ${alpha(theme.palette.primary.main, 0.4)}`,
            border: `4px solid ${alpha(theme.palette.background.paper, 0.9)}`
          }}
        >
          {user?.firstName?.charAt(0) || user?.email?.charAt(0) || 'A'}
        </Avatar>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          {user?.firstName ? `${user.firstName} ${user.lastName}` : user?.email || 'Admin User'}
        </Typography>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            mt: 0.5,
            backgroundColor: alpha(theme.palette.success.main, 0.1),
            color: theme.palette.success.main,
            px: 1.5,
            py: 0.5,
            borderRadius: 10,
          }}
        >
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              bgcolor: theme.palette.success.main,
              mr: 1
            }}
          />
          <Typography variant="caption" fontWeight="medium">
            {user?.role === 'admin' ? 'Administrator' : 'Teacher'}
          </Typography>
        </Box>
      </Box>

      <Divider />

      {/* Navigation menu - filter admin-only items for teachers */}
      <List sx={{ px: 2, py: 1 }}>
        {menuItems
          .filter(item => !(item.adminOnly && user?.role !== 'admin'))
          .map((item) => (
          <React.Fragment key={item.id}>
            {item.expandable ? (
              <>
                <ListItem disablePadding sx={{ display: 'block', mb: 1 }}>
                  <ListItemButton
                    onClick={() => handleToggleExpand(item.id)}
                    sx={{
                      borderRadius: 3,
                      mb: 0.5,
                      bgcolor: isParentActive(item.path) ? alpha(theme.palette.primary.main, 0.1) : 'transparent',
                      '&:hover': {
                        bgcolor: alpha(theme.palette.primary.main, 0.08),
                      }
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        minWidth: 40,
                        color: isParentActive(item.path) ? 'primary.main' : 'text.secondary'
                      }}
                    >
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText
                      primary={item.label}
                      primaryTypographyProps={{
                        fontWeight: isParentActive(item.path) ? 600 : 400,
                        color: isParentActive(item.path) ? 'primary.main' : 'text.primary'
                      }}
                    />
                    {expandedItems[item.id] ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </ListItemButton>

                  <Collapse in={expandedItems[item.id]} timeout="auto" unmountOnExit>
                    <List component="div" disablePadding>
                      {item.subItems.map((subItem) => (
                        <ListItemButton
                          key={subItem.id}
                          component={Link}
                          to={`/admin${subItem.path}`}
                          sx={{
                            pl: 3,
                            py: 1,
                            borderRadius: 3,
                            mb: 0.5,
                            bgcolor: isActive(subItem.path) ? alpha(theme.palette.primary.main, 0.1) : 'transparent',
                            border: isActive(subItem.path) ? `1px solid ${alpha(theme.palette.primary.main, 0.2)}` : '1px solid transparent',
                            '&:hover': {
                              bgcolor: alpha(theme.palette.primary.main, 0.08),
                              border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                              transform: 'translateX(4px)'
                            },
                            transition: 'all 0.2s ease'
                          }}
                        >
                          {subItem.icon && (
                            <ListItemIcon
                              sx={{
                                minWidth: 32,
                                color: isActive(subItem.path) ? 'primary.main' : 'text.secondary'
                              }}
                            >
                              {subItem.icon}
                            </ListItemIcon>
                          )}
                          <ListItemText
                            primary={subItem.label}
                            secondary={subItem.description}
                            primaryTypographyProps={{
                              fontSize: 14,
                              fontWeight: isActive(subItem.path) ? 600 : 500,
                              color: isActive(subItem.path) ? 'primary.main' : 'text.primary'
                            }}
                            secondaryTypographyProps={{
                              fontSize: 11,
                              color: 'text.secondary',
                              sx: {
                                display: subItem.description ? 'block' : 'none',
                                mt: 0.25,
                                lineHeight: 1.2
                              }
                            }}
                          />
                          {isActive(subItem.path) && (
                            <Box
                              sx={{
                                width: 4,
                                height: 20,
                                bgcolor: 'primary.main',
                                borderRadius: 2,
                                ml: 1
                              }}
                            />
                          )}
                        </ListItemButton>
                      ))}
                    </List>
                  </Collapse>
                </ListItem>
              </>
            ) : (
              <ListItem disablePadding sx={{ display: 'block', mb: 1 }}>
                <ListItemButton
                  component={Link}
                  to={`/admin${item.path}`}
                  sx={{
                    borderRadius: 3,
                    bgcolor: isActive(item.path) ? alpha(theme.palette.primary.main, 0.1) : 'transparent',
                    '&:hover': {
                      bgcolor: alpha(theme.palette.primary.main, 0.08),
                    }
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: 40,
                      color: isActive(item.path) ? 'primary.main' : 'text.secondary'
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.label}
                    primaryTypographyProps={{
                      fontWeight: isActive(item.path) ? 600 : 400,
                      color: isActive(item.path) ? 'primary.main' : 'text.primary'
                    }}
                  />
                </ListItemButton>
              </ListItem>
            )}
          </React.Fragment>
        ))}
      </List>

      <Box sx={{ flexGrow: 1 }} />

      {/* Footer */}
      <Box sx={{ p: 2 }}>
        {/* Theme toggle button for mobile - in footer */}
        <Box
          sx={{
            display: { xs: 'flex', sm: 'none' },
            justifyContent: 'center',
            mb: 2,
            mt: 1
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: alpha(theme.palette.primary.main, 0.08),
              borderRadius: 2,
              p: 1,
              width: 'fit-content'
            }}
          >
            <Typography variant="body2" sx={{ mr: 1 }}>
              {mode === 'dark' ? 'Dark Mode' : 'Light Mode'}
            </Typography>
            <IconButton
              onClick={toggleMode}
              size="small"
              sx={{
                backgroundColor: alpha(theme.palette.primary.main, 0.12),
                '&:hover': {
                  backgroundColor: alpha(theme.palette.primary.main, 0.2),
                },
                color: mode === 'dark' ? theme.palette.primary.light : theme.palette.primary.main
              }}
            >
              {mode === 'dark' ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
            </IconButton>
          </Box>
        </Box>

        <Typography variant="caption" color="text.secondary" align="center" display="block">
          eexams Admin Dashboard
        </Typography>
        <Typography variant="caption" display="block" color="text.secondary" align="center">
          &copy; {new Date().getFullYear()} All Rights Reserved
        </Typography>
      </Box>
    </>
  );

  return (
    <>
      {/* Mobile overlay when sidebar is open */}
      {open && (
        <Box
          onClick={onClose}
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            bgcolor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 1199,
            display: { xs: 'block', md: 'none' },
            backdropFilter: 'blur(4px)'
          }}
        />
      )}

      {/* Sidebar drawer */}
      <Drawer
        variant={useMediaQuery(theme.breakpoints.up('md')) ? "persistent" : "temporary"}
        anchor="left"
        open={open}
        onClose={onClose}
        ModalProps={{
          keepMounted: true, // Better mobile performance
        }}
        sx={{
          width: { xs: '85%', sm: drawerWidth },
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: { xs: '85%', sm: drawerWidth },
            boxSizing: 'border-box',
            border: 'none',
            boxShadow: mode === 'dark' ? '0 0 20px rgba(0, 0, 0, 0.2)' : '0 0 20px rgba(0, 0, 0, 0.05)',
            background: theme.palette.background.paper,
            backgroundImage: mode === 'dark'
              ? `linear-gradient(to bottom, ${alpha(theme.palette.background.paper, 0.9)}, ${alpha(theme.palette.background.paper, 1)})`
              : `linear-gradient(to bottom, ${alpha(theme.palette.background.paper, 0.8)}, ${alpha(theme.palette.background.paper, 1)})`,
            backdropFilter: 'blur(8px)',
            overflowX: 'hidden',
            transition: 'all 0.3s ease'
          },
        }}
      >
        {sidebarContent}
      </Drawer>
    </>
  );
};

export default Sidebar;
