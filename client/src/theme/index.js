import { createTheme, alpha } from '@mui/material/styles';

// Create a modern theme with gamified colors
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#0D406C', // Deep Navy Blue
      light: '#1A5A8C',
      dark: '#082545',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#0CBD73', // Emerald Green
      light: '#5AD5A2',
      dark: '#067A4C',
      contrastText: '#ffffff',
    },
    success: {
      main: '#0CBD73', // Emerald Green
      light: '#5AD5A2',
      dark: '#067A4C',
      contrastText: '#ffffff',
    },
    error: {
      main: '#FF5252', // Bright red
      light: '#FF8A80',
      dark: '#C62828',
      contrastText: '#ffffff',
    },
    warning: {
      main: '#FFAB2E', // Amber
      light: '#FFD54F',
      dark: '#FF8F00',
      contrastText: '#ffffff',
    },
    info: {
      main: '#2CC8FF', // Bright blue
      light: '#7ADBFF',
      dark: '#0091EA',
      contrastText: '#ffffff',
    },
    // Gamification colors
    gamification: {
      bronze: '#CD7F32',
      silver: '#C0C0C0',
      gold: '#FFD700',
      platinum: '#E5E4E2',
      diamond: '#B9F2FF',
    },
    background: {
      default: '#FAFBFF',
      paper: '#ffffff',
      card: '#ffffff',
    },
    text: {
      primary: '#0F172A',
      secondary: '#475569',
      disabled: '#94A3B8',
    },
    divider: 'rgba(0, 0, 0, 0.06)',
  },
  typography: {
    fontFamily: '"Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontWeight: 600,
      fontSize: '2.25rem',
      lineHeight: 1.2,
    },
    h2: {
      fontWeight: 600,
      fontSize: '1.875rem',
      lineHeight: 1.3,
    },
    h3: {
      fontWeight: 600,
      fontSize: '1.5rem',
      lineHeight: 1.3,
    },
    h4: {
      fontWeight: 600,
      fontSize: '1.25rem',
      lineHeight: 1.4,
    },
    h5: {
      fontWeight: 500,
      fontSize: '1.125rem',
      lineHeight: 1.4,
    },
    h6: {
      fontWeight: 500,
      fontSize: '1rem',
      lineHeight: 1.5,
    },
    subtitle1: {
      fontWeight: 500,
      fontSize: '1rem',
      lineHeight: 1.5,
    },
    subtitle2: {
      fontWeight: 500,
      fontSize: '0.875rem',
      lineHeight: 1.5,
    },
    body1: {
      fontWeight: 400,
      fontSize: '1rem',
      lineHeight: 1.6,
    },
    body2: {
      fontWeight: 400,
      fontSize: '0.875rem',
      lineHeight: 1.6,
    },
    button: {
      fontWeight: 500,
      fontSize: '0.875rem',
      textTransform: 'none',
    },
    caption: {
      fontSize: '0.75rem',
      fontWeight: 400,
      lineHeight: 1.5,
    },
    overline: {
      fontSize: '0.75rem',
      fontWeight: 500,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
    },
  },
  shape: {
    borderRadius: 8,
  },
  shadows: [
    'none',
    '0px 2px 4px rgba(0, 0, 0, 0.05)',
    '0px 4px 8px rgba(0, 0, 0, 0.05)',
    '0px 8px 16px rgba(0, 0, 0, 0.05)',
    '0px 12px 24px rgba(0, 0, 0, 0.05)',
    '0px 16px 32px rgba(0, 0, 0, 0.05)',
    '0px 20px 40px rgba(0, 0, 0, 0.05)',
    '0px 24px 48px rgba(0, 0, 0, 0.05)',
    '0px 28px 56px rgba(0, 0, 0, 0.05)',
    '0px 32px 64px rgba(0, 0, 0, 0.05)',
    '0px 36px 72px rgba(0, 0, 0, 0.05)',
    '0px 40px 80px rgba(0, 0, 0, 0.05)',
    '0px 44px 88px rgba(0, 0, 0, 0.05)',
    '0px 48px 96px rgba(0, 0, 0, 0.05)',
    '0px 52px 104px rgba(0, 0, 0, 0.05)',
    '0px 56px 112px rgba(0, 0, 0, 0.05)',
    '0px 60px 120px rgba(0, 0, 0, 0.05)',
    '0px 64px 128px rgba(0, 0, 0, 0.05)',
    '0px 68px 136px rgba(0, 0, 0, 0.05)',
    '0px 72px 144px rgba(0, 0, 0, 0.05)',
    '0px 76px 152px rgba(0, 0, 0, 0.05)',
    '0px 80px 160px rgba(0, 0, 0, 0.05)',
    '0px 84px 168px rgba(0, 0, 0, 0.05)',
    '0px 88px 176px rgba(0, 0, 0, 0.05)',
    '0px 92px 184px rgba(0, 0, 0, 0.05)',
  ],
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        '*': {
          boxSizing: 'border-box',
        },
        html: {
          margin: 0,
          padding: 0,
          width: '100%',
          height: '100%',
          WebkitOverflowScrolling: 'touch',
        },
        body: {
          margin: 0,
          padding: 0,
          width: '100%',
          height: '100%',
        },
        '#root': {
          width: '100%',
          height: '100%',
        },
        input: {
          '&[type=number]': {
            MozAppearance: 'textfield',
            '&::-webkit-outer-spin-button': {
              margin: 0,
              WebkitAppearance: 'none',
            },
            '&::-webkit-inner-spin-button': {
              margin: 0,
              WebkitAppearance: 'none',
            },
          },
        },
        img: {
          display: 'block',
          maxWidth: '100%',
        },
        a: {
          textDecoration: 'none',
          color: 'inherit',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          boxShadow: 'none',
          textTransform: 'none',
          fontWeight: 500,
          padding: '10px 20px',
          transition: 'all 0.15s ease',
          '&:hover': {
            transform: 'translateY(-1px)',
          },
          '&:active': {
            transform: 'translateY(0)',
          },
        contained: {
          '&:hover': {
            boxShadow: '0px 8px 20px rgba(0, 0, 0, 0.2)',
          },
        },
        containedPrimary: {
          background: '#0D406C',
          boxShadow: '0 2px 8px rgba(13, 64, 108, 0.15)',
          '&:hover': {
            background: '#082545',
            boxShadow: '0 4px 12px rgba(13, 64, 108, 0.25)',
          },
        },
        containedSecondary: {
          background: '#0CBD73',
          boxShadow: '0 2px 8px rgba(12, 189, 115, 0.15)',
          '&:hover': {
            background: '#067A4C',
            boxShadow: '0 4px 12px rgba(12, 189, 115, 0.25)',
          },
        },
        outlined: {
          borderWidth: '1.5px',
          borderColor: '#E2E8F0',
          '&:hover': {
            borderColor: '#0D406C',
            backgroundColor: 'rgba(13, 64, 108, 0.04)',
          },
        },
        text: {
          '&:hover': {
            backgroundColor: 'rgba(13, 64, 108, 0.04)',
          },
        },
        sizeSmall: {
          padding: '6px 16px',
          fontSize: '0.8125rem',
        },
        sizeLarge: {
          padding: '12px 24px',
          fontSize: '1rem',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          backgroundImage: 'none',
        },
        rounded: {
          borderRadius: 12,
        },
        outlined: {
          borderColor: '#E2E8F0',
        },
        elevation1: {
          boxShadow: '0px 3px 12px rgba(0, 0, 0, 0.08)',
        },
        elevation2: {
          boxShadow: '0px 5px 16px rgba(0, 0, 0, 0.08)',
        },
        elevation3: {
          boxShadow: '0px 8px 20px rgba(0, 0, 0, 0.08)',
        },
        elevation4: {
          boxShadow: '0px 10px 25px rgba(0, 0, 0, 0.08)',
        },
        elevation8: {
          boxShadow: '0px 12px 30px rgba(0, 0, 0, 0.12)',
        },
        elevation12: {
          boxShadow: '0px 16px 40px rgba(0, 0, 0, 0.12)',
        },
        elevation24: {
          boxShadow: '0px 24px 48px rgba(0, 0, 0, 0.15)',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          position: 'relative',
          borderRadius: 12,
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
          transition: 'box-shadow 0.15s ease',
          overflow: 'hidden',
          border: '1px solid #E2E8F0',
          '&:hover': {
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
          },
        },
      },
    },
    MuiCardHeader: {
      styleOverrides: {
        root: {
          padding: '20px',
        },
        title: {
          fontSize: '1rem',
          fontWeight: 600,
        },
        subheader: {
          fontSize: '0.875rem',
          color: '#64748B',
        },
        action: {
          marginRight: 0,
          marginTop: 0,
        },
      },
    },
    MuiCardContent: {
      styleOverrides: {
        root: {
          padding: '20px',
          '&:last-child': {
            paddingBottom: '20px',
          },
        },
      },
    },
    MuiCardActions: {
      styleOverrides: {
        root: {
          padding: '12px 20px',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
          backdropFilter: 'blur(8px)',
        },
        colorDefault: {
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
        },
        colorPrimary: {
          backgroundColor: '#0D406C',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRight: '1px solid #E2E8F0',
          backgroundImage: 'none',
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          marginBottom: 4,
          padding: '8px 12px',
          transition: 'background-color 0.15s ease',
          '&:hover': {
            backgroundColor: 'rgba(13, 64, 108, 0.04)',
          },
          '&.Mui-selected': {
            backgroundColor: 'rgba(13, 64, 108, 0.08)',
            '&:hover': {
              backgroundColor: 'rgba(13, 64, 108, 0.12)',
            },
            '& .MuiListItemIcon-root': {
              color: '#0D406C',
            },
            '& .MuiListItemText-primary': {
              color: '#0D406C',
              fontWeight: 600,
            },
          },
        },
      },
    },
    MuiListItemIcon: {
      styleOverrides: {
        root: {
          minWidth: 36,
          color: '#64748B',
        },
      },
    },
    MuiListItemText: {
      styleOverrides: {
        primary: {
          fontSize: '0.875rem',
          fontWeight: 500,
        },
      },
    },
    MuiAvatar: {
      styleOverrides: {
        root: {
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          transition: 'transform 0.15s ease',
          '&:hover': {
            transform: 'scale(1.02)',
          },
        },
        colorDefault: {
          backgroundColor: 'rgba(13, 64, 108, 0.08)',
          color: '#0D406C',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          fontWeight: 500,
          fontSize: '0.75rem',
          transition: 'background-color 0.15s ease',
        },
        filled: {
          '&.MuiChip-colorPrimary': {
            backgroundColor: 'rgba(13, 64, 108, 0.08)',
            color: '#0D406C',
            '&:hover': {
              backgroundColor: 'rgba(13, 64, 108, 0.12)',
            },
          },
          '&.MuiChip-colorSecondary': {
            backgroundColor: 'rgba(12, 189, 115, 0.08)',
            color: '#0CBD73',
            '&:hover': {
              backgroundColor: 'rgba(12, 189, 115, 0.12)',
            },
          },
          '&.MuiChip-colorSuccess': {
            backgroundColor: 'rgba(12, 189, 115, 0.08)',
            color: '#0CBD73',
            '&:hover': {
              backgroundColor: 'rgba(12, 189, 115, 0.12)',
            },
          },
          '&.MuiChip-colorError': {
            backgroundColor: 'rgba(239, 68, 68, 0.08)',
            color: '#EF4444',
            '&:hover': {
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
            },
          },
          '&.MuiChip-colorWarning': {
            backgroundColor: 'rgba(245, 158, 11, 0.08)',
            color: '#F59E0B',
            '&:hover': {
              backgroundColor: 'rgba(245, 158, 11, 0.12)',
            },
          },
          '&.MuiChip-colorInfo': {
            backgroundColor: 'rgba(13, 64, 108, 0.08)',
            color: '#0D406C',
            '&:hover': {
              backgroundColor: 'rgba(13, 64, 108, 0.12)',
            },
          },
        },
        outlined: {
          borderWidth: 1.5,
        },
        deleteIcon: {
          color: 'inherit',
          opacity: 0.7,
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          padding: '14px 16px',
          borderBottom: '1px solid #E2E8F0',
          fontSize: '0.875rem',
        },
        head: {
          fontWeight: 600,
          backgroundColor: '#F8FAFC',
          color: '#0F172A',
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          transition: 'background-color 0.15s ease',
          '&:hover': {
            backgroundColor: '#F8FAFC',
          },
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          height: 6,
          backgroundColor: '#E2E8F0',
        },
        bar: {
          borderRadius: 10,
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: '12px 16px',
        },
        standardSuccess: {
          backgroundColor: 'rgba(12, 189, 115, 0.08)',
          color: '#067A4C',
        },
        standardError: {
          backgroundColor: 'rgba(239, 68, 68, 0.08)',
          color: '#DC2626',
        },
        standardWarning: {
          backgroundColor: 'rgba(245, 158, 11, 0.08)',
          color: '#D97706',
        },
        standardInfo: {
          backgroundColor: 'rgba(13, 64, 108, 0.08)',
          color: '#082545',
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: '#0F172A',
          borderRadius: 6,
          padding: '6px 10px',
          fontSize: '0.75rem',
          fontWeight: 500,
        },
        arrow: {
          color: '#0F172A',
        },
      },
    },
    MuiBackdrop: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 12,
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          padding: '20px',
          fontSize: '1.125rem',
          fontWeight: 600,
        },
      },
    },
    MuiDialogContent: {
      styleOverrides: {
        root: {
          padding: '20px',
        },
      },
    },
    MuiDialogActions: {
      styleOverrides: {
        root: {
          padding: '12px 20px',
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: '#E2E8F0',
        },
      },
    },
    MuiSwitch: {
      styleOverrides: {
        root: {
          width: 42,
          height: 26,
          padding: 0,
          '& .MuiSwitch-switchBase': {
            padding: 0,
            margin: 2,
            transitionDuration: '300ms',
            '&.Mui-checked': {
              transform: 'translateX(16px)',
              color: '#fff',
              '& + .MuiSwitch-track': {
                backgroundColor: '#5D5FEF',
                opacity: 1,
                border: 0,
              },
              '&.Mui-disabled + .MuiSwitch-track': {
                opacity: 0.5,
              },
            },
            '&.Mui-focusVisible .MuiSwitch-thumb': {
              color: '#5D5FEF',
              border: '6px solid #fff',
            },
            '&.Mui-disabled .MuiSwitch-thumb': {
              color: alpha('#fff', 0.3),
            },
            '&.Mui-disabled + .MuiSwitch-track': {
              opacity: 0.3,
            },
          },
          '& .MuiSwitch-thumb': {
            boxSizing: 'border-box',
            width: 22,
            height: 22,
          },
          '& .MuiSwitch-track': {
            borderRadius: 26 / 2,
            backgroundColor: '#E2E8F0',
            opacity: 1,
          },
        },
      },
    },
    MuiBadge: {
      styleOverrides: {
        root: {
          '& .MuiBadge-badge': {
            boxShadow: '0 0 0 2px #fff',
            padding: '0 4px',
            height: 18,
            minWidth: 18,
          },
        },
        colorPrimary: {
          backgroundColor: '#0D406C',
        },
        colorSecondary: {
          backgroundColor: '#0CBD73',
        },
        colorError: {
          backgroundColor: '#EF4444',
        },
        colorInfo: {
          backgroundColor: '#0D406C',
        },
        colorSuccess: {
          backgroundColor: '#0CBD73',
        },
        colorWarning: {
          backgroundColor: '#F59E0B',
        },
      },
    },
  },
});

export default theme;
