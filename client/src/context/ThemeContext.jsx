import React, { createContext, useState, useContext, useMemo, useEffect } from 'react';
import { ThemeProvider as MuiThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, alpha } from '@mui/material';

// Create a context for theme settings
export const ThemeContext = createContext({
  mode: 'light',
  toggleMode: () => {},
});

// Custom hook to use the theme context
export const useThemeMode = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }) => {
  // Get the theme mode from localStorage or default to 'light'
  const [mode, setMode] = useState(() => {
    const savedMode = localStorage.getItem('themeMode');
    return savedMode || 'light';
  });

  // Toggle between light and dark mode
  const toggleMode = () => {
    setMode((prevMode) => {
      const newMode = prevMode === 'light' ? 'dark' : 'light';
      localStorage.setItem('themeMode', newMode);
      return newMode;
    });
  };

  // Create the theme based on the current mode
  const theme = useMemo(() => {
    return createTheme({
      palette: {
        mode,
        primary: {
          main: '#0D406C', // Deep Navy Blue
          light: mode === 'dark' ? '#1A5A8C' : '#2A6FA6',
          dark: mode === 'dark' ? '#082545' : '#052037',
          contrastText: '#ffffff',
        },
        secondary: {
          main: '#9DF6D6', // Mint Green
          light: mode === 'dark' ? '#B5F8E0' : '#C8F9E8',
          dark: mode === 'dark' ? '#7FE4C2' : '#5FD6A8',
          contrastText: '#0D406C',
        },
        success: {
          main: '#0CBD73', // Emerald Green
          light: mode === 'dark' ? '#2FD090' : '#4DD899',
          dark: mode === 'dark' ? '#09965C' : '#067A4C',
          contrastText: '#ffffff',
        },
        error: {
          main: '#FF5252', // Bright red
          light: mode === 'dark' ? '#FF8A80' : '#FF8A80',
          dark: mode === 'dark' ? '#C62828' : '#C62828',
          contrastText: '#ffffff',
        },
        warning: {
          main: '#FFAB2E', // Amber
          light: mode === 'dark' ? '#FFD54F' : '#FFD54F',
          dark: mode === 'dark' ? '#FF8F00' : '#FF8F00',
          contrastText: '#0D406C',
        },
        info: {
          main: '#A2F8EC', // Light Aqua/Turquoise
          light: mode === 'dark' ? '#B5FAF0' : '#C8FCF4',
          dark: mode === 'dark' ? '#8AE4D8' : '#6AD0C4',
          contrastText: '#0D406C',
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
          default: mode === 'dark' ? '#0A1929' : '#F5FBF8',
          paper: mode === 'dark' ? '#0F2744' : '#ffffff',
          card: mode === 'dark' ? 'rgba(15, 39, 68, 0.9)' : 'rgba(255, 255, 255, 0.95)',
          gradient: mode === 'dark' 
            ? 'linear-gradient(135deg, #0A1929 0%, #0F2744 100%)' 
            : 'linear-gradient(135deg, #F5FBF8 0%, #E8F5F0 100%)',
        },
        text: {
          primary: mode === 'dark' ? '#E0E0E0' : '#2B3674',
          secondary: mode === 'dark' ? '#A0A0A0' : '#707EAE',
          disabled: mode === 'dark' ? '#6C6C6C' : '#A3AED0',
        },
        divider: mode === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
      },
      typography: {
        fontFamily: '"Inter", "Poppins", "Roboto", "Helvetica", "Arial", sans-serif',
        h1: {
          fontWeight: 700,
          fontSize: '2.5rem',
        },
        h2: {
          fontWeight: 700,
          fontSize: '2rem',
        },
        h3: {
          fontWeight: 600,
          fontSize: '1.75rem',
        },
        h4: {
          fontWeight: 600,
          fontSize: '1.5rem',
        },
        h5: {
          fontWeight: 600,
          fontSize: '1.25rem',
        },
        h6: {
          fontWeight: 600,
          fontSize: '1rem',
        },
        subtitle1: {
          fontWeight: 500,
          fontSize: '1rem',
        },
        subtitle2: {
          fontWeight: 500,
          fontSize: '0.875rem',
        },
        body1: {
          fontWeight: 400,
          fontSize: '1rem',
        },
        body2: {
          fontWeight: 400,
          fontSize: '0.875rem',
        },
        button: {
          fontWeight: 600,
          fontSize: '0.875rem',
          textTransform: 'none',
        },
        caption: {
          fontWeight: 400,
          fontSize: '0.75rem',
        },
        overline: {
          fontWeight: 600,
          fontSize: '0.75rem',
          textTransform: 'uppercase',
          letterSpacing: '0.2em',
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
              transition: 'background-color 0.3s ease',
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
      },
    });
  }, [mode]);

  // Context value
  const contextValue = useMemo(() => {
    return { mode, toggleMode };
  }, [mode]);

  return (
    <ThemeContext.Provider value={contextValue}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
};
