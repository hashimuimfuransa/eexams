import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import App from './App.jsx';
import Login from './pages/Login';
import Register from './pages/Register';
import TeacherDashboard from './pages/TeacherDashboard';
import OrgAdminDashboard from './pages/OrgAdminDashboard';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import StudentRoutes from './StudentRoutes';
import NotFound from './pages/NotFound';
import { useAuth } from './context/AuthContext';

// Protected route component
const ProtectedRoute = ({ children, requiredRole, allowedRoles }) => {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  // If a specific role is required and user doesn't have it
  if (requiredRole && user?.role !== requiredRole) {
    return <Navigate to="/dashboard" />;
  }

  // If multiple roles are allowed, check if user's role is in the allowed list
  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    return <Navigate to="/dashboard" />;
  }

  return children;
};

const AppRoutes = () => {
  const { user } = useAuth();

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<App />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Role-based dashboard redirect */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            {user?.role === 'student'
              ? <Navigate to="/student" replace />
              : user?.role === 'admin' && user?.userType === 'organization'
                ? <Navigate to="/org-admin" replace />
                : user?.role === 'admin'
                  ? <Navigate to="/super-admin" replace />
                  : <Navigate to="/teacher" replace />}
          </ProtectedRoute>
        }
      />

      {/* Teacher dashboard */}
      <Route path="/teacher/*" element={<ProtectedRoute><TeacherDashboard /></ProtectedRoute>} />

      {/* Org Admin dashboard */}
      <Route path="/org-admin/*" element={<ProtectedRoute requiredRole="admin"><OrgAdminDashboard /></ProtectedRoute>} />

      {/* Super Admin dashboard */}
      <Route path="/super-admin/*" element={<ProtectedRoute requiredRole="admin"><SuperAdminDashboard /></ProtectedRoute>} />

      {/* Student routes */}
      <Route path="/student/*" element={<ProtectedRoute><StudentRoutes /></ProtectedRoute>} />

      {/* Legacy admin redirect */}
      <Route path="/admin/*" element={<Navigate to="/org-admin" replace />} />

      {/* 404 route */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default AppRoutes;
