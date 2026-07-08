import { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { useAuth } from './AuthContext';
import api from '../services/api';

// Single source of truth for "what does this user's plan actually allow right
// now" — fetched from GET /profile/plan-usage, which resolves the DB-editable
// OrganizationPlan/IndividualPlan catalog (super admin overrides) merged onto
// the hardcoded defaults in server/config/plans.js. Fetched once per user
// session and shared, instead of every consumer computing it independently
// from a stale hardcoded table.
export const PlanContext = createContext(null);

export const PlanProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!isAuthenticated || !user) {
      setUsage(null);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const res = await api.get('/profile/plan-usage');
      setUsage(res.data);
    } catch (error) {
      console.error('Failed to load plan usage:', error);
      setUsage(null);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?._id, user?.subscriptionPlan, user?.subscriptionStatus]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <PlanContext.Provider value={{ usage, loading, refresh }}>
      {children}
    </PlanContext.Provider>
  );
};

export const usePlanContext = () => {
  const context = useContext(PlanContext);
  if (!context) {
    throw new Error('usePlanContext must be used within a PlanProvider');
  }
  return context;
};
