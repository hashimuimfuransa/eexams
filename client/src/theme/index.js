import { createTheme, alpha } from '@mui/material/styles';

// Create a modern theme with gamified colors
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#5D5FEF', // Vibrant purple
      light: '#8687FF',
      dark: '#4240B3',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#FF6B8B', // Playful pink
      light: '#FF9FB2',
      dark: '#D14D69',
      contrastText: '#ffffff',
    },
    success: {
      main: '#38D9A9', // Mint green
      light: '#69F0C8',
      dark: '#20B087',
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
      default: '#F4F7FE',
      paper: '#ffffff',
      card: 'rgba(255, 255, 255, 0.9)',
      gradient: 'linear-gradient(135deg, #F4F7FE 0%, #EFF3FB 100%)',
    },
    text: {
      primary: '#2B3674',
      secondary: '#707EAE',
      disabled: '#A3AED0',
    },
    divider: 'rgba(0, 0, 0, 0.06)',
  },
  typography: {
    fontFamily: '"Poppins", "Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontWeight: 700,
      fontSize: '2.5rem',
      lineHeight: 1.2,
      letterSpacing: '-0.01em',
    },
    h2: {
      fontWeight: 700,
      fontSize: '2rem',
      lineHeight: 1.2,
      letterSpacing: '-0.01em',
    },
    h3: {
      fontWeight: 700,
      fontSize: '1.75rem',
      lineHeight: 1.2,
      letterSpacing: '-0.01em',
    },
    h4: {
      fontWeight: 700,
      fontSize: '1.5rem',
      lineHeight: 1.2,
      letterSpacing: '-0.01em',
    },
    h5: {
      fontWeight: 600,
      fontSize: '1.25rem',
      lineHeight: 1.2,
      letterSpacing: '-0.01em',
    },
    h6: {
      fontWeight: 600,
      fontSize: '1rem',
      lineHeight: 1.2,
      letterSpacing: '-0.01em',
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
      lineHeight: 1.5,
    },
    body2: {
      fontWeight: 400,
      fontSize: '0.875rem',
      lineHeight: 1.5,
    },
    button: {
      fontWeight: 600,
      fontSize: '0.875rem',
      textTransform: 'none',
      letterSpacing: '0.02em',
    },
    caption: {
      fontSize: '0.75rem',
      fontWeight: 400,
      lineHeight: 1.5,
    },
    overline: {
      fontSize: '0.75rem',
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
    },
  },
  shape: {
    borderRadius: 12,
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
          borderRadius: 12,
          boxShadow: 'none',
          textTransform: 'none',
          fontWeight: 600,
          padding: '10px 20px',
          transition: 'all 0.3s ease-in-out',
          '&:hover': {
            transform: 'translateY(-3px)',
            boxShadow: '0px 6px 12px rgba(0, 0, 0, 0.15)',
          },
          '&:active': {
            transform: 'translateY(-1px)',
          },
        },
        contained: {
          '&:hover': {
            boxShadow: '0px 8px 20px rgba(0, 0, 0, 0.2)',
          },
        },
        containedPrimary: {
          background: 'linear-gradient(135deg, #5D5FEF, #8687FF)',
          boxShadow: '0px 4px 10px rgba(93, 95, 239, 0.3)',
          '&:hover': {
            background: 'linear-gradient(135deg, #4240B3, #5D5FEF)',
            boxShadow: '0px 6px 14px rgba(93, 95, 239, 0.4)',
          },
        },
        containedSecondary: {
          background: 'linear-gradient(135deg, #FF6B8B, #FF9FB2)',
          boxShadow: '0px 4px 10px rgba(255, 107, 139, 0.3)',
          '&:hover': {
            background: 'linear-gradient(135deg, #D14D69, #FF6B8B)',
            boxShadow: '0px 6px 14px rgba(255, 107, 139, 0.4)',
          },
        },
        outlined: {
          borderWidth: '2px',
          '&:hover': {
            borderWidth: '2px',
          },
        },
        text: {
          '&:hover': {
            backgroundColor: alpha('#5D5FEF', 0.04),
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
          borderRadius: 16,
          backgroundImage: 'none',
        },
        rounded: {
          borderRadius: 16,
        },
        outlined: {
          borderColor: alpha('#5D5FEF', 0.15),
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
          borderRadius: 16,
          boxShadow: '0px 4px 20px rgba(0, 0, 0, 0.08)',
          transition: 'all 0.3s ease',
          overflow: 'hidden',
          border: `1px solid ${alpha('#5D5FEF', 0.08)}`,
          '&:hover': {
            transform: 'translateY(-5px)',
            boxShadow: '0px 8px 25px rgba(0, 0, 0, 0.12)',
          },
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: `linear-gradient(135deg, ${alpha('#5D5FEF', 0.03)}, ${alpha('#FF6B8B', 0.03)})`,
            opacity: 0,
            transition: 'opacity 0.3s ease',
          },
          '&:hover::before': {
            opacity: 1,
          },
          '&::after': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '4px',
            background: `linear-gradient(90deg, ${alpha('#5D5FEF', 0.8)}, ${alpha('#FF6B8B', 0.8)})`,
            opacity: 0,
            transition: 'opacity 0.3s ease',
          },
          '&:hover::after': {
            opacity: 1,
          },
        },
      },
    },
    MuiCardHeader: {
      styleOverrides: {
        root: {
          padding: '24px',
        },
        title: {
          fontSize: '1.125rem',
          fontWeight: 600,
        },
        subheader: {
          fontSize: '0.875rem',
          color: alpha('#2B3674', 0.7),
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
          padding: '24px',
          '&:last-child': {
            paddingBottom: '24px',
          },
        },
      },
    },
    MuiCardActions: {
      styleOverrides: {
        root: {
          padding: '16px 24px',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: '0px 2px 10px rgba(0, 0, 0, 0.08)',
          backdropFilter: 'blur(8px)',
        },
        colorDefault: {
          backgroundColor: alpha('#ffffff', 0.9),
        },
        colorPrimary: {
          backgroundImage: 'linear-gradient(135deg, #5D5FEF, #4240B3)',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRight: 'none',
          backgroundImage: 'none',
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          marginBottom: 6,
          padding: '10px 16px',
          transition: 'all 0.3s ease',
          '&:hover': {
            backgroundColor: alpha('#5D5FEF', 0.06),
            transform: 'translateX(5px)',
          },
          '&.Mui-selected': {
            backgroundColor: alpha('#5D5FEF', 0.1),
            '&:hover': {
              backgroundColor: alpha('#5D5FEF', 0.15),
            },
            '&::before': {
              content: '""',
              position: 'absolute',
              left: 0,
              top: '50%',
              transform: 'translateY(-50%)',
              height: '70%',
              width: '4px',
              background: `linear-gradient(to bottom, ${alpha('#5D5FEF', 1)}, ${alpha('#8687FF', 1)})`,
              borderRadius: '0 4px 4px 0',
              boxShadow: `0 0 10px ${alpha('#5D5FEF', 0.5)}`,
            },
            '& .MuiListItemIcon-root': {
              color: '#5D5FEF',
              transform: 'scale(1.1)',
            },
            '& .MuiListItemText-primary': {
              color: '#5D5FEF',
              fontWeight: 600,
            },
          },
        },
      },
    },
    MuiListItemIcon: {
      styleOverrides: {
        root: {
          minWidth: 40,
          color: '#707EAE',
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
          boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
          transition: 'transform 0.2s ease',
          '&:hover': {
            transform: 'scale(1.05)',
          },
        },
        colorDefault: {
          backgroundColor: alpha('#5D5FEF', 0.1),
          color: '#5D5FEF',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontWeight: 500,
          fontSize: '0.75rem',
          transition: 'all 0.2s ease',
          '&:hover': {
            transform: 'translateY(-2px)',
          },
        },
        filled: {
          '&.MuiChip-colorPrimary': {
            backgroundColor: alpha('#5D5FEF', 0.1),
            color: '#5D5FEF',
            '&:hover': {
              backgroundColor: alpha('#5D5FEF', 0.2),
            },
          },
          '&.MuiChip-colorSecondary': {
            backgroundColor: alpha('#FF6B8B', 0.1),
            color: '#FF6B8B',
            '&:hover': {
              backgroundColor: alpha('#FF6B8B', 0.2),
            },
          },
          '&.MuiChip-colorSuccess': {
            backgroundColor: alpha('#38D9A9', 0.1),
            color: '#38D9A9',
            '&:hover': {
              backgroundColor: alpha('#38D9A9', 0.2),
            },
          },
          '&.MuiChip-colorError': {
            backgroundColor: alpha('#FF5252', 0.1),
            color: '#FF5252',
            '&:hover': {
              backgroundColor: alpha('#FF5252', 0.2),
            },
          },
          '&.MuiChip-colorWarning': {
            backgroundColor: alpha('#FFAB2E', 0.1),
            color: '#FFAB2E',
            '&:hover': {
              backgroundColor: alpha('#FFAB2E', 0.2),
            },
          },
          '&.MuiChip-colorInfo': {
            backgroundColor: alpha('#2CC8FF', 0.1),
            color: '#2CC8FF',
            '&:hover': {
              backgroundColor: alpha('#2CC8FF', 0.2),
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
          padding: '16px',
          borderBottom: `1px solid ${alpha('#2B3674', 0.08)}`,
          fontSize: '0.875rem',
        },
        head: {
          fontWeight: 600,
          backgroundColor: alpha('#5D5FEF', 0.02),
          color: '#2B3674',
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          transition: 'background-color 0.2s ease',
          '&:hover': {
            backgroundColor: alpha('#5D5FEF', 0.02),
          },
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          height: 8,
          backgroundColor: alpha('#5D5FEF', 0.1),
        },
        bar: {
          borderRadius: 10,
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          padding: '12px 16px',
        },
        standardSuccess: {
          backgroundColor: alpha('#38D9A9', 0.1),
          color: '#20B087',
        },
        standardError: {
          backgroundColor: alpha('#FF5252', 0.1),
          color: '#C62828',
        },
        standardWarning: {
          backgroundColor: alpha('#FFAB2E', 0.1),
          color: '#FF8F00',
        },
        standardInfo: {
          backgroundColor: alpha('#2CC8FF', 0.1),
          color: '#0091EA',
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: alpha('#2B3674', 0.9),
          borderRadius: 8,
          padding: '8px 12px',
          fontSize: '0.75rem',
          fontWeight: 500,
        },
        arrow: {
          color: alpha('#2B3674', 0.9),
        },
      },
    },
    MuiBackdrop: {
      styleOverrides: {
        root: {
          backgroundColor: alpha('#2B3674', 0.6),
          backdropFilter: 'blur(4px)',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 16,
          boxShadow: '0px 24px 48px rgba(0, 0, 0, 0.2)',
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          padding: '24px',
          fontSize: '1.25rem',
          fontWeight: 600,
        },
      },
    },
    MuiDialogContent: {
      styleOverrides: {
        root: {
          padding: '24px',
        },
      },
    },
    MuiDialogActions: {
      styleOverrides: {
        root: {
          padding: '16px 24px',
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: alpha('#2B3674', 0.08),
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
            backgroundColor: alpha('#2B3674', 0.3),
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
          backgroundColor: '#5D5FEF',
        },
        colorSecondary: {
          backgroundColor: '#FF6B8B',
        },
        colorError: {
          backgroundColor: '#FF5252',
        },
        colorInfo: {
          backgroundColor: '#2CC8FF',
        },
        colorSuccess: {
          backgroundColor: '#38D9A9',
        },
        colorWarning: {
          backgroundColor: '#FFAB2E',
        },
      },
    },
  },
});

export default theme;
