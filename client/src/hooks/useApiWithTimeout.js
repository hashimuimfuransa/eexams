import { useCallback, useRef } from 'react';
import api from '../services/api';

/**
 * Custom hook for making API calls with timeout and proper error handling
 * @param {number} timeout - Timeout in milliseconds (default: 30000)
 * @returns {Object} - Object containing apiCall function and utilities
 */
const useApiWithTimeout = (timeout = 30000) => {
  const abortControllerRef = useRef(null);

  const apiCall = useCallback(async (method, url, data = null, options = {}, retries = 2) => {
    let lastError;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        // Cancel any previous request
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }

        // Create new abort controller
        abortControllerRef.current = new AbortController();

        // Set up timeout
        const timeoutId = setTimeout(() => {
          if (abortControllerRef.current) {
            abortControllerRef.current.abort();
          }
        }, timeout);

        // Prepare request config
        const config = {
          signal: abortControllerRef.current.signal,
          ...options
        };

        let response;

        // Make the API call based on method
        switch (method.toLowerCase()) {
          case 'get':
            response = await api.get(url, config);
            break;
          case 'post':
            response = await api.post(url, data, config);
            break;
          case 'put':
            response = await api.put(url, data, config);
            break;
          case 'delete':
            response = await api.delete(url, config);
            break;
          case 'patch':
            response = await api.patch(url, data, config);
            break;
          default:
            throw new Error(`Unsupported HTTP method: ${method}`);
        }

        // Clear timeout on successful response
        clearTimeout(timeoutId);

        return response;
      } catch (error) {
        lastError = error;

        // Handle different types of errors
        if (error.name === 'CanceledError' || error.code === 'ERR_CANCELED') {
          console.log(`API request to ${url} was canceled (attempt ${attempt + 1}/${retries + 1})`);

          // If this is the last attempt, throw timeout error
          if (attempt === retries) {
            throw new Error('Request timed out. Please check your connection and try again.');
          }

          // Wait before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
          continue;
        } else if (error.code === 'NETWORK_ERROR' || error.message === 'Network Error') {
          console.error(`Network error for ${url} (attempt ${attempt + 1}/${retries + 1}):`, error);

          // If this is the last attempt, throw network error
          if (attempt === retries) {
            throw new Error('Network error. Please check your internet connection.');
          }

          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
          continue;
        } else if (error.response) {
          // Server responded with error status - don't retry these
          console.error(`API error for ${url}:`, error.response.status, error.response.data);
          throw error; // Re-throw to let the calling component handle it
        } else {
          // Other errors
          console.error(`Unexpected error for ${url} (attempt ${attempt + 1}/${retries + 1}):`, error);

          // If this is the last attempt, throw generic error
          if (attempt === retries) {
            throw new Error('An unexpected error occurred. Please try again.');
          }

          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
          continue;
        }
      }
    }

    // This should never be reached, but just in case
    throw lastError || new Error('Request failed after all retry attempts.');
  }, [timeout]);

  const cancelRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  // Cleanup function to cancel any pending requests
  const cleanup = useCallback(() => {
    cancelRequest();
  }, [cancelRequest]);

  return {
    apiCall,
    cancelRequest,
    cleanup
  };
};

export default useApiWithTimeout;
