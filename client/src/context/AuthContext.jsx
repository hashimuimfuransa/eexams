import { createContext, useState, useEffect, useContext } from 'react';
import api from '../services/api';
import LoadingScreen from '../components/common/LoadingScreen';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // Start with loading true
  const [error, setError] = useState(null);
  const [initialized, setInitialized] = useState(false);

  // Derived value for authentication status
  const isAuthenticated = !!user;

  // Session timeout duration: 1 day in milliseconds
  const SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours

  // Check for session timeout
  const checkSessionTimeout = () => {
    const lastActivity = localStorage.getItem('lastActivity');
    if (lastActivity) {
      const timeSinceLastActivity = Date.now() - parseInt(lastActivity);
      if (timeSinceLastActivity > SESSION_TIMEOUT) {
        console.log('Session expired due to inactivity, logging out');
        logout();
        return true;
      }
    }
    return false;
  };

  // Update last activity timestamp
  const updateLastActivity = () => {
    localStorage.setItem('lastActivity', Date.now().toString());
  };

  // Check for saved user on initial load
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Check session timeout first
        if (checkSessionTimeout()) {
          setLoading(false);
          setInitialized(true);
          return;
        }

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
                    localStorage.removeItem('lastActivity');
                    return;
                  }
                }
              } catch (tokenError) {
                console.error('Error parsing token:', tokenError);
                localStorage.removeItem('user');
                localStorage.removeItem('token');
                localStorage.removeItem('lastActivity');
                return;
              }

              // Re-verify with the server to get the latest subscriptionStatus
              // (prevents stale localStorage from bypassing pending-approval guard)
              try {
                const verifyRes = await api.get('/auth/verify', {
                  headers: { Authorization: `Bearer ${savedToken}` }
                });
                const freshUser = {
                  ...userData,
                  // Always trust server for identity/role fields — never let stale localStorage win
                  role: verifyRes.data.role || userData.role,
                  userType: verifyRes.data.userType || userData.userType,
                  organization: verifyRes.data.organization || userData.organization,
                  phone: verifyRes.data.phone || userData.phone,
                  isOrgTeacher: verifyRes.data.isOrgTeacher ?? false,
                  // Use ?? for plan/status so superadmin null values don't overwrite localStorage
                  subscriptionPlan: verifyRes.data.subscriptionPlan ?? userData.subscriptionPlan,
                  subscriptionStatus: verifyRes.data.subscriptionStatus ?? userData.subscriptionStatus,
                  subscriptionExpiresAt: verifyRes.data.subscriptionExpiresAt ?? userData.subscriptionExpiresAt,
                  level: verifyRes.data.level ?? userData.level,
                  subLevel: verifyRes.data.subLevel ?? userData.subLevel,
                  freeExamUsed: verifyRes.data.freeExamUsed ?? userData.freeExamUsed,
                  freeExamLevel: verifyRes.data.freeExamLevel ?? userData.freeExamLevel,
                  requiresLevelSelection: verifyRes.data.requiresLevelSelection ?? userData.requiresLevelSelection ?? false,
                };
                localStorage.setItem('user', JSON.stringify(freshUser));
                setUser(freshUser);
                updateLastActivity(); // Update activity timestamp on successful auth
              } catch {
                // If verify fails (network issue), fall back to localStorage data
                setUser(userData);
                updateLastActivity(); // Update activity timestamp
              }
            }
          } catch (parseError) {
            console.error('Error parsing saved user data:', parseError);
            localStorage.removeItem('user');
            localStorage.removeItem('token');
            localStorage.removeItem('lastActivity');
          }
        }
      } catch (err) {
        console.error('Error checking authentication:', err);
        // Clear potentially corrupted data
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        localStorage.removeItem('lastActivity');
      } finally {
        // Set loading to false when done
        setLoading(false);
        setInitialized(true);
      }
    };

    checkAuth();
  }, []);

  // Track user activity and update session timeout
  useEffect(() => {
    if (!isAuthenticated) return;

    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

    const handleActivity = () => {
      updateLastActivity();
    };

    // Add event listeners for user activity
    activityEvents.forEach(event => {
      window.addEventListener(event, handleActivity);
    });

    // Update activity timestamp immediately
    updateLastActivity();

    // Set up periodic check for session timeout
    const intervalId = setInterval(() => {
      if (checkSessionTimeout()) {
        // Session expired, redirect to login will happen via route protection
        window.location.href = '/login';
      }
    }, 60000); // Check every minute

    return () => {
      activityEvents.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      clearInterval(intervalId);
    };
  }, [isAuthenticated]);

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
        phone: userData.phone,
        password: userData.password,
      }, {
        timeout: 20000 // 20 seconds timeout for axios as well
      });

      // Race between the login request and the timeout
      const response = await Promise.race([loginPromise, timeoutPromise]);

      // Create user object from response
      const user = {
        id: response.data._id,
        _id: response.data._id,
        email: response.data.email,
        firstName: response.data.firstName,
        lastName: response.data.lastName,
        role: response.data.role,
        userType: response.data.userType || (response.data.role === 'admin' ? 'organization' : 'individual'),
        token: response.data.token,
        subscriptionPlan: response.data.subscriptionPlan,
        subscriptionStatus: response.data.subscriptionStatus,
        subscriptionExpiresAt: response.data.subscriptionExpiresAt,
        organization: response.data.organization,
        isOrgTeacher: response.data.isOrgTeacher ?? false,
        phone: response.data.phone,
        level: response.data.level,
        subLevel: response.data.subLevel,
        freeExamUsed: response.data.freeExamUsed,
        freeExamLevel: response.data.freeExamLevel,
        requiresLevelSelection: response.data.requiresLevelSelection ?? false,
      };

      // Save user to localStorage
      localStorage.setItem('user', JSON.stringify(user));
      // Also save token separately for API interceptor
      localStorage.setItem('token', response.data.token);
      // Update activity timestamp
      updateLastActivity();
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
      // Throw the original error to preserve response data
      throw err;
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

      // Add role if provided (important for students)
      if (userData.role) {
        registrationData.role = userData.role;
      }

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
        _id: response.data._id,
        email: response.data.email,
        firstName: response.data.firstName,
        lastName: response.data.lastName,
        role: response.data.role,
        userType: response.data.userType || (response.data.role === 'admin' ? 'organization' : 'individual'),
        token: response.data.token,
        subscriptionPlan: response.data.subscriptionPlan,
        subscriptionStatus: response.data.subscriptionStatus,
        organization: response.data.organization,
        phone: response.data.phone,
      };

      // Save user to localStorage
      localStorage.setItem('user', JSON.stringify(user));
      // Also save token separately for API interceptor
      localStorage.setItem('token', response.data.token);
      // Update activity timestamp
      updateLastActivity();
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
  const googleLogin = async (googleData, saveNewUserSession = false) => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.post('/auth/google', googleData, {
        timeout: 10000
      });

      // Create user object from response
      const user = {
        id: response.data._id,
        _id: response.data._id,
        email: response.data.email,
        firstName: response.data.firstName,
        lastName: response.data.lastName,
        role: response.data.role,
        userType: response.data.userType || (response.data.role === 'admin' ? 'organization' : 'individual'),
        isGoogleUser: true,
        token: response.data.token,
        subscriptionPlan: response.data.subscriptionPlan,
        subscriptionStatus: response.data.subscriptionStatus,
        organization: response.data.organization,
        phone: response.data.phone,
        level: response.data.level,
        subLevel: response.data.subLevel,
        freeExamUsed: response.data.freeExamUsed,
        freeExamLevel: response.data.freeExamLevel,
        requiresLevelSelection: response.data.requiresLevelSelection ?? false,
      };

      // Only persist session for existing (returning) users by default.
      // New users must complete registration first — do NOT save to
      // localStorage so the Register page's "already logged in" guard
      // does not fire and redirect them away to the dashboard.
      // However, if saveNewUserSession is true (e.g., for student registration),
      // save the session even for new users.
      if (!response.data.isNewUser || saveNewUserSession) {
        localStorage.setItem('user', JSON.stringify(user));
        localStorage.setItem('token', response.data.token);
        // Update activity timestamp
        updateLastActivity();
        setUser(user);
      }

      setLoading(false);
      return { user, isNewUser: response.data.isNewUser };
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Google login failed';
      setError(errorMessage);
      setLoading(false);
      throw new Error(errorMessage);
    }
  };

  // Update the user's selected learning level (after first-login selection or a level change)
  const updateUserLevel = (levelData, subLevel = null) => {
    if (!user) return;
    const updatedUser = {
      ...user,
      level: levelData,
      subLevel: subLevel || null,
      requiresLevelSelection: false,
      freeExamUsed: false,
      freeExamLevel: null
    };
    localStorage.setItem('user', JSON.stringify(updatedUser));
    setUser(updatedUser);
  };

  // Clear the user's learning level (e.g. user opts to deselect it)
  const clearUserLevel = () => {
    if (!user) return;
    const updatedUser = {
      ...user,
      level: null,
      subLevel: null,
      requiresLevelSelection: user.role === 'student',
      freeExamUsed: false,
      freeExamLevel: null
    };
    localStorage.setItem('user', JSON.stringify(updatedUser));
    setUser(updatedUser);
  };

  // Logout function
  const logout = () => {
    // Best-effort: clear the server-side active session marker so this
    // device's token can't be mistaken for a still-active session. Don't
    // block local logout on it.
    api.post('/auth/logout').catch(() => {});
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('lastActivity');
    setUser(null);
  };

  // Function to update user profile data
  const updateUserProfile = (userData) => {
    if (user && userData) {
      // Create updated user object
      const updatedUser = {
        ...user,
        firstName: userData.firstName || user.firstName,
        lastName: userData.lastName || user.lastName,
        phone: userData.phone !== undefined ? userData.phone : user.phone,
        gender: userData.gender !== undefined ? userData.gender : user.gender,
        class: userData.class,
        organization: userData.organization,
        level: userData.level !== undefined ? userData.level : user.level,
        subLevel: userData.subLevel !== undefined ? userData.subLevel : user.subLevel,
        freeExamUsed: userData.freeExamUsed !== undefined ? userData.freeExamUsed : user.freeExamUsed,
        freeExamLevel: userData.freeExamLevel !== undefined ? userData.freeExamLevel : user.freeExamLevel,
        requiresLevelSelection: userData.level ? false : user.requiresLevelSelection
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
        updateUserLevel,
        clearUserLevel,
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
