import React, { createContext, useState, useEffect, useContext } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button, Box, Typography } from '@mui/material';
import { Warning, Fullscreen, FullscreenExit, Lock } from '@mui/icons-material';
import './ExamSecurity.css';

// Create a context for exam security
export const ExamSecurityContext = createContext();

export const useExamSecurity = () => useContext(ExamSecurityContext);

const ExamSecurityProvider = ({ children, active = false }) => {
  const [isActive, setIsActive] = useState(active);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [warningVisible, setWarningVisible] = useState(false);
  const [warningCount, setWarningCount] = useState(0);
  const [lastFocusTime, setLastFocusTime] = useState(Date.now());
  const [showFocusWarning, setShowFocusWarning] = useState(false);
  const [showFullscreenPrompt, setShowFullscreenPrompt] = useState(false);

  // Function to enter fullscreen mode
  const enterFullscreen = () => {
    const docEl = document.documentElement;

    if (docEl.requestFullscreen) {
      docEl.requestFullscreen();
    } else if (docEl.mozRequestFullScreen) {
      docEl.mozRequestFullScreen();
    } else if (docEl.webkitRequestFullscreen) {
      docEl.webkitRequestFullscreen();
    } else if (docEl.msRequestFullscreen) {
      docEl.msRequestFullscreen();
    }

    setIsFullscreen(true);
  };

  // Function to exit fullscreen mode
  const exitFullscreen = () => {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    }

    setIsFullscreen(false);
  };

  // Toggle fullscreen mode
  const toggleFullscreen = () => {
    if (isFullscreen) {
      exitFullscreen();
    } else {
      enterFullscreen();
    }
  };

  // Function to show warning
  const showWarning = () => {
    setWarningVisible(true);
    setWarningCount(prev => prev + 1);
    
    // Auto-hide warning after 5 seconds
    setTimeout(() => {
      setWarningVisible(false);
    }, 5000);
  };

  // Handle visibility change (tab switching)
  useEffect(() => {
    if (!isActive) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // User switched to another tab
        showWarning();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isActive]);

  // Handle window focus/blur
  useEffect(() => {
    if (!isActive) return;

    const handleFocus = () => {
      const now = Date.now();
      const timeDiff = now - lastFocusTime;
      
      // If the window was blurred for more than 2 seconds, show a warning
      if (timeDiff > 2000) {
        setShowFocusWarning(true);
      }
      
      setLastFocusTime(now);
    };

    const handleBlur = () => {
      setLastFocusTime(Date.now());
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, [isActive, lastFocusTime]);

  // Handle fullscreen change
  useEffect(() => {
    if (!isActive) return;

    const handleFullscreenChange = () => {
      const isDocFullscreen = !!(
        document.fullscreenElement ||
        document.mozFullScreenElement ||
        document.webkitFullscreenElement ||
        document.msFullscreenElement
      );
      
      setIsFullscreen(isDocFullscreen);
      
      // If user manually exits fullscreen, show prompt to re-enter
      if (!isDocFullscreen && isFullscreen) {
        setShowFullscreenPrompt(true);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, [isActive, isFullscreen]);

  // Prevent right-click
  useEffect(() => {
    if (!isActive) return;

    const handleContextMenu = (e) => {
      e.preventDefault();
      return false;
    };

    document.addEventListener('contextmenu', handleContextMenu);
    
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [isActive]);

  // Prevent keyboard shortcuts
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e) => {
      // Prevent Ctrl+C, Ctrl+V, Ctrl+P, Ctrl+S, Alt+Tab, etc.
      if (
        (e.ctrlKey && (
          e.key === 'c' || 
          e.key === 'v' || 
          e.key === 'p' || 
          e.key === 's' ||
          e.key === 'a' ||
          e.key === 'u' ||
          e.key === 'j' ||
          e.key === 'Tab'
        )) ||
        (e.altKey && e.key === 'Tab') ||
        (e.key === 'PrintScreen') ||
        (e.key === 'F12')
      ) {
        e.preventDefault();
        showWarning();
        return false;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isActive]);

  return (
    <ExamSecurityContext.Provider 
      value={{ 
        isActive, 
        setIsActive, 
        isFullscreen, 
        enterFullscreen, 
        exitFullscreen, 
        toggleFullscreen,
        warningCount
      }}
    >
      {/* Wrap children with security class if active */}
      <div className={isActive ? 'exam-secure-content' : ''}>
        {children}
      </div>

      {/* Warning overlay */}
      {isActive && warningVisible && (
        <div className="exam-warning-overlay">
          <Warning className="exam-warning-icon" />
          <div className="exam-warning-title">Security Warning</div>
          <div className="exam-warning-message">
            Attempting to leave the exam or use restricted functions is not allowed.
            This incident has been recorded. Continued attempts may result in exam termination.
          </div>
          <button 
            className="exam-warning-button"
            onClick={() => setWarningVisible(false)}
          >
            Return to Exam
          </button>
        </div>
      )}

      {/* Focus warning dialog */}
      <Dialog
        open={showFocusWarning}
        onClose={() => setShowFocusWarning(false)}
      >
        <DialogTitle sx={{ bgcolor: 'warning.light', color: 'warning.contrastText' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Warning sx={{ mr: 1 }} />
            Navigation Warning
          </Box>
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            You appear to have navigated away from the exam window. 
            This action has been recorded. Continued attempts to navigate away may result in exam termination.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setShowFocusWarning(false)} 
            color="primary" 
            variant="contained"
            autoFocus
          >
            Return to Exam
          </Button>
        </DialogActions>
      </Dialog>

      {/* Fullscreen prompt dialog */}
      <Dialog
        open={showFullscreenPrompt}
        onClose={() => setShowFullscreenPrompt(false)}
      >
        <DialogTitle sx={{ bgcolor: 'primary.light', color: 'primary.contrastText' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Fullscreen sx={{ mr: 1 }} />
            Fullscreen Mode Required
          </Box>
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            For exam security, fullscreen mode is required. Please click the button below to re-enter fullscreen mode.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => {
              enterFullscreen();
              setShowFullscreenPrompt(false);
            }} 
            color="primary" 
            variant="contained"
            startIcon={<Fullscreen />}
            autoFocus
          >
            Enter Fullscreen
          </Button>
        </DialogActions>
      </Dialog>
    </ExamSecurityContext.Provider>
  );
};

export default ExamSecurityProvider;
