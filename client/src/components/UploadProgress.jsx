import React from 'react';
import {
  Box,
  LinearProgress,
  Typography,
  Alert,
  Chip,
  IconButton,
  Fade,
  Paper
} from '@mui/material';
import {
  CloudUpload,
  CheckCircle,
  Error as ErrorIcon,
  Refresh,
  Cancel,
  SignalWifiOff
} from '@mui/icons-material';

const UploadProgress = ({
  progress = 0,
  uploading = false,
  error = null,
  retryCount = 0,
  maxRetries = 3,
  connectionStatus = 'online',
  fileName = '',
  fileSize = 0,
  onCancel,
  onRetry,
  onClose,
  success = false
}) => {
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Connection status indicator
  if (connectionStatus === 'offline') {
    return (
      <Alert 
        severity="warning" 
        icon={<SignalWifiOff />}
        action={
          onClose && (
            <IconButton size="small" onClick={onClose}>
              <Cancel fontSize="small" />
            </IconButton>
          )
        }
      >
        <Typography variant="body2" fontWeight="medium">
          You are offline
        </Typography>
        <Typography variant="caption">
          Please check your internet connection before uploading.
        </Typography>
      </Alert>
    );
  }

  // Error state
  if (error && !uploading) {
    const isRetryable = retryCount < maxRetries;
    
    return (
      <Alert 
        severity="error"
        icon={<ErrorIcon />}
        action={
          <Box sx={{ display: 'flex', gap: 1 }}>
            {isRetryable && onRetry && (
              <IconButton 
                size="small" 
                onClick={onRetry}
                sx={{ color: 'error.main' }}
              >
                <Refresh fontSize="small" />
              </IconButton>
            )}
            {onClose && (
              <IconButton size="small" onClick={onClose}>
                <Cancel fontSize="small" />
              </IconButton>
            )}
          </Box>
        }
      >
        <Typography variant="body2" fontWeight="medium">
          Upload failed
        </Typography>
        <Typography variant="caption" display="block">
          {error.message || 'Something went wrong. Please try again.'}
        </Typography>
        {retryCount > 0 && (
          <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
            Retried {retryCount} {retryCount === 1 ? 'time' : 'times'}
          </Typography>
        )}
      </Alert>
    );
  }

  // Success state
  if (success) {
    return (
      <Fade in={true}>
        <Alert 
          severity="success"
          icon={<CheckCircle />}
          action={
            onClose && (
              <IconButton size="small" onClick={onClose}>
                <Cancel fontSize="small" />
              </IconButton>
            )
          }
        >
          <Typography variant="body2" fontWeight="medium">
            Upload complete!
          </Typography>
          <Typography variant="caption">
            {fileName} uploaded successfully
          </Typography>
        </Alert>
      </Fade>
    );
  }

  // Uploading state
  if (uploading) {
    return (
      <Paper elevation={2} sx={{ p: 2, borderRadius: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <CloudUpload sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="body2" fontWeight="medium" sx={{ flex: 1 }}>
            Uploading {fileName}
          </Typography>
          <Chip 
            label={`${progress}%`} 
            size="small" 
            color="primary" 
            variant="outlined"
            sx={{ ml: 1 }}
          />
        </Box>

        <LinearProgress 
          variant="determinate" 
          value={progress} 
          sx={{ 
            height: 8, 
            borderRadius: 1,
            mb: 1,
            backgroundColor: 'grey.200'
          }}
        />

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            {fileSize > 0 && formatFileSize(fileSize * (progress / 100))} 
            {' / '}
            {formatFileSize(fileSize)}
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {retryCount > 0 && (
              <Chip 
                label={`Retry ${retryCount}/${maxRetries}`}
                size="small"
                color="warning"
                variant="outlined"
              />
            )}
            
            <IconButton 
              size="small" 
              onClick={onCancel}
              sx={{ color: 'error.main' }}
            >
              <Cancel fontSize="small" />
            </IconButton>
          </Box>
        </Box>

        {retryCount > 0 && (
          <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 1 }}>
            Connection interrupted. Retrying upload...
          </Typography>
        )}
      </Paper>
    );
  }

  return null;
};

export default UploadProgress;
