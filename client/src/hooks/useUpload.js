import { useState, useCallback, useRef, useEffect } from 'react';
import axios from 'axios';

const useUpload = (options = {}) => {
  const {
    maxRetries = 3,
    retryDelay = 2000,
    chunkSize = 5 * 1024 * 1024, // 5MB chunks
    onProgress,
    onSuccess,
    onError,
    onRetry
  } = options;

  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState('online');
  const abortControllerRef = useRef(null);
  const retryTimeoutRef = useRef(null);

  // Monitor connection status
  useEffect(() => {
    const handleOnline = () => setConnectionStatus('online');
    const handleOffline = () => setConnectionStatus('offline');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check initial status
    if (!navigator.onLine) {
      setConnectionStatus('offline');
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  const cancelUpload = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setUploading(false);
    setProgress(0);
  }, []);

  const reset = useCallback(() => {
    setProgress(0);
    setUploading(false);
    setError(null);
    setRetryCount(0);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const upload = useCallback(async (url, file, metadata = {}, attempt = 0) => {
    // Check connection
    if (!navigator.onLine) {
      const offlineError = new Error('You appear to be offline. Please check your connection and try again.');
      setError(offlineError);
      setConnectionStatus('offline');
      if (onError) onError(offlineError);
      throw offlineError;
    }

    setConnectionStatus('online');
    setUploading(true);
    setError(null);
    setRetryCount(attempt);

    // Create abort controller for this upload
    abortControllerRef.current = new AbortController();

    const formData = new FormData();
    formData.append('file', file);
    
    // Add metadata
    Object.keys(metadata).forEach(key => {
      formData.append(key, metadata[key]);
    });

    try {
      const response = await axios.post(url, formData, {
        // IMPORTANT: Don't set Content-Type manually - browser will set it with correct boundary
        signal: abortControllerRef.current.signal,
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            setProgress(percentCompleted);
            if (onProgress) onProgress(percentCompleted);
          }
        },
        timeout: 600000, // 10 minutes timeout for large files
      });

      setUploading(false);
      setProgress(100);
      setRetryCount(0);
      
      if (onSuccess) onSuccess(response.data);
      return response.data;

    } catch (err) {
      // Handle user cancellation
      if (axios.isCancel(err)) {
        setUploading(false);
        setProgress(0);
        throw err;
      }

      // Check if it's a retryable error
      const isRetryable = 
        !err.response || // Network error (no response)
        err.code === 'ECONNABORTED' || // Timeout
        err.code === 'ERR_NETWORK' || // Network error
        (err.response && err.response.status >= 500) || // Server error
        (err.message && err.message.includes('Unexpected end of form'));

      if (isRetryable && attempt < maxRetries) {
        console.log(`Upload failed, retrying... (${attempt + 1}/${maxRetries})`);
        
        if (onRetry) onRetry(attempt + 1, maxRetries);

        // Wait before retrying
        await new Promise(resolve => {
          retryTimeoutRef.current = setTimeout(resolve, retryDelay * (attempt + 1));
        });

        // Retry upload
        return upload(url, file, metadata, attempt + 1);
      }

      // Max retries reached or non-retryable error
      setUploading(false);
      setError(err);
      if (onError) onError(err);
      throw err;
    }
  }, [maxRetries, retryDelay, onProgress, onSuccess, onError, onRetry]);

  // Upload with chunking for very large files
  const uploadChunked = useCallback(async (url, file, metadata = {}) => {
    // For files smaller than chunk size, use regular upload
    if (file.size <= chunkSize) {
      return upload(url, file, metadata);
    }

    // For large files, we could implement chunked upload
    // For now, use regular upload with increased timeout
    return upload(url, file, metadata);
  }, [chunkSize, upload]);

  return {
    upload,
    uploadChunked,
    cancelUpload,
    reset,
    progress,
    uploading,
    error,
    retryCount,
    connectionStatus
  };
};

export default useUpload;
