import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import App from './App.jsx';
import Login from './pages/Login';
import Register from './pages/Register';
import StudentRegister from './pages/StudentRegister';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import TeacherDashboard from './pages/TeacherDashboard';
import OrgAdminDashboard from './pages/OrgAdminDashboard';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import StudentRoutes from './StudentRoutes';
import NotFound from './pages/NotFound';
import PublicExamAccess from './pages/PublicExamAccess';
import ExamResult from './pages/ExamResult';
import PendingApproval from './pages/PendingApproval';
import CompleteRegistration from './pages/CompleteRegistration';
import Marketplace from './pages/Marketplace';
import ExamRequest from './pages/ExamRequest';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import OrganizationSubscriptionPurchase from './components/OrganizationSubscriptionPurchase';
import IndividualSubscriptionPurchase from './components/IndividualSubscriptionPurchase';
import { useAuth } from './context/AuthContext';

// Check if user registration is complete (has a subscription plan)
const isRegistrationComplete = (user) =>
  user?.subscriptionPlan !== null && user?.subscriptionPlan !== undefined;

// Check if account is approved and active (not pending admin review)
const isAccountApproved = (user) =>
  user?.subscriptionStatus === 'active';

// Protected route component
const ProtectedRoute = ({ children, requiredRole, allowedRoles, allowIncomplete = false }) => {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  // Superadmin is exempt from all subscription/registration checks
  const isSuperAdmin = user?.role === 'superadmin';

  // Redirect incomplete registrations to pending-approval (unless explicitly allowed)
  if (!allowIncomplete && !isSuperAdmin && !isRegistrationComplete(user)) {
    return <Navigate to="/pending-approval" />;
  }

  // Redirect unapproved accounts to pending-approval (unless explicitly allowed)
  if (!allowIncomplete && !isSuperAdmin && !isAccountApproved(user)) {
    return <Navigate to="/pending-approval" />;
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
  const { user, isAuthenticated } = useAuth();

  return (
    <Routes>
      {/* Public exam access - must be before catch-all routes */}
      <Route path="/join/:shareToken" element={<PublicExamAccess />} />
      <Route path="/exam/:examSlug/:shareToken" element={<PublicExamAccess />} />
      <Route path="/exam/:shareToken" element={<PublicExamAccess />} />
      <Route path="/access-code" element={<PublicExamAccess />} />
      <Route path="/exam-result/:resultId" element={<ExamResult />} />
      
      {/* Public routes */}
      <Route path="/" element={
        isAuthenticated ? (
          user?.role === 'student'
            ? <Navigate to="/student" replace />
            : user?.role === 'superadmin'
              ? <Navigate to="/super-admin" replace />
              : user?.role === 'admin'
                ? <Navigate to="/org-admin" replace />
                : <Navigate to="/teacher" replace />
        ) : <App />
      } />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/student-register" element={<StudentRegister />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/public-exams" element={<Navigate to="/marketplace" replace />} />
      <Route path="/marketplace" element={<Marketplace />} />
      <Route path="/marketplace/exams/:examId/request" element={<ExamRequest />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />

      {/* Post-registration routes - accessible to authenticated users */}
      <Route path="/pending-approval" element={<ProtectedRoute allowIncomplete={true}><PendingApproval /></ProtectedRoute>} />
      <Route path="/complete-registration" element={<ProtectedRoute allowIncomplete={true}><CompleteRegistration /></ProtectedRoute>} />

      {/* Organisation subscription purchase - reachable even while pending approval, so an org admin can pay immediately instead of waiting on manual review */}
      <Route path="/organization/subscription" element={<ProtectedRoute requiredRole="admin" allowIncomplete={true}><OrganizationSubscriptionPurchase /></ProtectedRoute>} />

      {/* Individual teacher subscription purchase - same as above, for non-organisation teacher accounts */}
      <Route path="/individual/subscription" element={<ProtectedRoute requiredRole="teacher" allowIncomplete={true}><IndividualSubscriptionPurchase /></ProtectedRoute>} />

      {/* Role-based dashboard redirect */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            {user?.role === 'student'
              ? <Navigate to="/student" replace />
              : user?.role === 'superadmin'
                ? <Navigate to="/super-admin" replace />
                : user?.role === 'admin'
                  ? <Navigate to="/org-admin" replace />
                  : <Navigate to="/teacher" replace />}
          </ProtectedRoute>
        }
      />

      {/* Teacher dashboard */}
      <Route path="/teacher/*" element={<ProtectedRoute><TeacherDashboard /></ProtectedRoute>} />

      {/* Org Admin dashboard */}
      <Route path="/org-admin/*" element={<ProtectedRoute requiredRole="admin"><OrgAdminDashboard /></ProtectedRoute>} />

      {/* Super Admin dashboard - accessible to both 'superadmin' and 'admin' roles */}
      <Route path="/super-admin/*" element={<ProtectedRoute><SuperAdminDashboard /></ProtectedRoute>} />

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
