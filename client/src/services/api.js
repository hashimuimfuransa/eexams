import axios from 'axios';

// Create an axios instance with default config optimized for speed
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 8000 // 8 seconds default timeout - reduced for faster feedback
});

// Add a request interceptor to add auth token to requests
api.interceptors.request.use(
  (config) => {
    // Try to get token from localStorage directly
    let token = localStorage.getItem('token');

    // If token is not found directly, try to get it from the user object
    if (!token) {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          token = user.token;
        } catch (err) {
          console.error('Error parsing user data:', err);
        }
      }
    }

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add a response interceptor to handle common errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Handle 401 Unauthorized errors (token expired or invalid)
    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      // Don't try to verify if the failing request was already a verify request
      // This prevents infinite loops
      if (originalRequest.url && originalRequest.url.includes('/auth/verify')) {
        console.log('Token verification failed - clearing auth data');
        // Clear auth data
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        // Only redirect if we're not already on login page
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }

      try {
        // Try to verify the token with a fresh axios instance to avoid interceptor loops
        const verifyResponse = await axios.get(
          `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/auth/verify`,
          {
            headers: {
              'Authorization': originalRequest.headers.Authorization,
              'Content-Type': 'application/json'
            },
            timeout: 5000
          }
        );

        // If verification succeeds, retry the original request
        if (verifyResponse.status === 200) {
          return api(originalRequest);
        }
      } catch (verifyError) {
        console.log('Authentication failed - clearing auth data');
        // Clear auth data
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        // Only redirect if we're not already on login page
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
      }
    }

    // Handle 403 Forbidden errors (insufficient permissions)
    if (error.response && error.response.status === 403) {
      console.error('You do not have permission to access this resource');
    }

    // Handle 500 Server errors
    if (error.response && error.response.status >= 500) {
      console.error('Server error occurred. Please try again later.');
    }

    return Promise.reject(error);
  }
);

export default api;
