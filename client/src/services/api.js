import axios from 'axios';

// Create an axios instance with default config optimized for speed
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 60000 // 60 seconds default timeout
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

    // For file uploads (FormData), let browser set Content-Type with correct boundary
    if (config.data && config.data instanceof FormData) {
      config.timeout = 600000; // 10 minutes for file uploads
      delete config.headers['Content-Type']; // Browser will set with boundary
      console.log('API Interceptor: FormData detected, deleted Content-Type header');
      console.log('API Interceptor: Request URL:', config.url);
      console.log('API Interceptor: FormData entries count:', Array.from(config.data.entries()).length);
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
    // But skip for public share endpoints and marketplace student endpoints
    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      // Don't redirect for public share endpoints or marketplace endpoints
      // (marketplace is public, and student-specific endpoints should fail gracefully)
      if (originalRequest.url && (
        originalRequest.url.includes('/share/') ||
        originalRequest.url.includes('/marketplace/')
      )) {
        return Promise.reject(error);
      }

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
