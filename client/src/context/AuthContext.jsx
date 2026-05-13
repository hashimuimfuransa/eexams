import { createContext, useState, useEffect, useContext } from 'react';
import api from '../services/api';
import LoadingScreen from '../components/common/LoadingScreen';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // Start with loading true
  const [error, setError] = useState(null);
  const [initialized, setInitialized] = useState(false);

  // Check for saved user on initial load
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Get saved user from localStorage
        const savedUser = localStorage.getItem('user');
        const savedToken = localStorage.getItem('token');

        if (savedUser && savedToken) {
          try {
            // Parse the user data
            const userData = JSON.parse(savedUser);

            // Basic token validation - check if it's not expired
            if (userData.token) {
              try {
                // Decode JWT to check expiration (basic check)
                const tokenParts = userData.token.split('.');
                if (tokenParts.length === 3) {
                  const payload = JSON.parse(atob(tokenParts[1]));
                  const currentTime = Date.now() / 1000;

                  // If token is expired, clear it
                  if (payload.exp && payload.exp < currentTime) {
                    console.log('Token expired, clearing auth data');
                    localStorage.removeItem('user');
                    localStorage.removeItem('token');
                    return;
                  }
                }
              } catch (tokenError) {
                console.error('Error parsing token:', tokenError);
                localStorage.removeItem('user');
                localStorage.removeItem('token');
                return;
              }

              // If token seems valid, set user without server verification
              // Server verification will happen automatically on first API call
              setUser(userData);
            }
          } catch (parseError) {
            console.error('Error parsing saved user data:', parseError);
            localStorage.removeItem('user');
            localStorage.removeItem('token');
          }
        }
      } catch (err) {
        console.error('Error checking authentication:', err);
        // Clear potentially corrupted data
        localStorage.removeItem('user');
        localStorage.removeItem('token');
      } finally {
        // Set loading to false when done
        setLoading(false);
        setInitialized(true);
      }
    };

    checkAuth();
  }, []);

  // Login function with 5-second timeout
  const login = async (userData) => {
    try {
      setLoading(true);
      setError(null);

      // Create a timeout promise that rejects after 20 seconds
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('Login timeout: The request took too long to complete. Please check your credentials and internet connection, then try again.'));
        }, 20000); // 20 seconds timeout
      });

      // Create the login request promise
      const loginPromise = api.post('/auth/login', {
        email: userData.email,
        password: userData.password,
      }, {
        timeout: 20000 // 20 seconds timeout for axios as well
      });

      // Race between the login request and the timeout
      const response = await Promise.race([loginPromise, timeoutPromise]);

      // Create user object from response
      const user = {
        id: response.data._id,
        email: response.data.email,
        firstName: response.data.firstName,
        lastName: response.data.lastName,
        role: response.data.role,
        userType: response.data.userType,
        token: response.data.token,
        subscriptionPlan: response.data.subscriptionPlan,
        subscriptionStatus: response.data.subscriptionStatus,
      };

      // Save user to localStorage
      localStorage.setItem('user', JSON.stringify(user));
      // Also save token separately for API interceptor
      localStorage.setItem('token', response.data.token);
      setUser(user);
      setLoading(false);
      return user;
    } catch (err) {
      let errorMessage = 'Login failed';

      // Handle different types of errors
      if (err.message && err.message.includes('timeout')) {
        errorMessage = err.message;
      } else if (err.code === 'ECONNABORTED' || err.message.includes('timeout')) {
        errorMessage = 'Login timeout: The request took too long to complete. Please check your credentials and internet connection, then try again.';
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
      setLoading(false);
      throw new Error(errorMessage);
    }
  };

  // Register function - supports both organization and individual teacher accounts
  const register = async (userData) => {
    try {
      setLoading(true);
      setError(null);

      // Prepare registration data
      const registrationData = {
        email: userData.email,
        password: userData.password,
        firstName: userData.firstName || '',
        lastName: userData.lastName || '',
        phone: userData.phone || '',
        accountType: userData.accountType || 'individual', // 'individual' or 'organization'
        subscriptionPlan: userData.subscriptionPlan || 'free',
      };

      // Add organization-specific fields only for organization accounts
      if (userData.accountType === 'organization') {
        registrationData.organization = userData.organization || '';
      }

      // Make API call to register endpoint
      const response = await api.post('/auth/register', registrationData, {
        timeout: 5000
      });

      // Create user object from response
      const user = {
        id: response.data._id,
        email: response.data.email,
        firstName: response.data.firstName,
        lastName: response.data.lastName,
        role: response.data.role,
        userType: response.data.userType,
        token: response.data.token,
        subscriptionPlan: response.data.subscriptionPlan,
        subscriptionStatus: response.data.subscriptionStatus,
      };

      // Add organization info for organization accounts
      if (response.data.organization) {
        user.organization = response.data.organization;
      }

      // Save user to localStorage
      localStorage.setItem('user', JSON.stringify(user));
      // Also save token separately for API interceptor
      localStorage.setItem('token', response.data.token);
      setUser(user);
      setLoading(false);
      return user;
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Registration failed';
      setError(errorMessage);
      setLoading(false);
      throw new Error(errorMessage);
    }
  };

  // Google OAuth login function
  const googleLogin = async (googleData) => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.post('/auth/google', googleData, {
        timeout: 10000
      });

      // Create user object from response
      const user = {
        id: response.data._id,
        email: response.data.email,
        firstName: response.data.firstName,
        lastName: response.data.lastName,
        role: response.data.role,
        userType: response.data.userType,
        isGoogleUser: true,
        token: response.data.token,
        subscriptionPlan: response.data.subscriptionPlan,
        subscriptionStatus: response.data.subscriptionStatus,
      };

      // Add organization info for organization accounts
      if (response.data.organization) {
        user.organization = response.data.organization;
      }

      // Save user to localStorage
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('token', response.data.token);
      setUser(user);
      setLoading(false);
      return { user, isNewUser: response.data.isNewUser };
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Google login failed';
      setError(errorMessage);
      setLoading(false);
      throw new Error(errorMessage);
    }
  };

  // Logout function
  const logout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    setUser(null);
  };

  // Computed property to check if user is authenticated
  const isAuthenticated = !!user;

  // Function to update user profile data
  const updateUserProfile = (userData) => {
    if (user && userData) {
      // Create updated user object
      const updatedUser = {
        ...user,
        firstName: userData.firstName || user.firstName,
        lastName: userData.lastName || user.lastName,
        class: userData.class,
        organization: userData.organization
      };

      // Update localStorage
      localStorage.setItem('user', JSON.stringify(updatedUser));

      // Update state
      setUser(updatedUser);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        isAuthenticated,
        initialized,
        login,
        register,
        googleLogin,
        logout,
        updateUserProfile,
        setUser
      }}
    >
      {initialized ? children : <LoadingScreen message="Verifying authentication..." />}
    </AuthContext.Provider>
  );
};

// Custom hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
