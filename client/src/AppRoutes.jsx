import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

// Pages
import App from './App';
import Login from './pages/Login';
import Register from './pages/Register';
import TeacherDashboard from './pages/TeacherDashboard';
import OrgAdminDashboard from './pages/OrgAdminDashboard';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import NotFound from './pages/NotFound';
import PendingApproval from './pages/PendingApproval';
import CompleteRegistration from './pages/CompleteRegistration';

// Student Dashboard (new page-level component)
import StudentDashboard from './pages/StudentDashboard';

// Student sub-page components
import ExamList from './components/student/ExamList';
import Results from './components/student/Results';
import Profile from './components/student/Profile';
import ExamHistory from './components/student/ExamHistory';

// Public exam access
import PublicExamAccess from './pages/PublicExamAccess';

// Check if user registration is complete
const isRegistrationComplete = (user) => {
  // Registration is complete if subscriptionPlan is selected
  return user?.subscriptionPlan !== null && user?.subscriptionPlan !== undefined;
};

// Check if user's subscription is approved (for paid plans)
const isSubscriptionApproved = (user) => {
  // Free plan users are always approved
  if (user?.subscriptionPlan === 'free') {
    return true;
  }
  // Paid plan users need status to be 'active'
  return user?.subscriptionStatus === 'active';
};

// Protected route component
const ProtectedRoute = ({ children, requiredRole, allowIncomplete = false }) => {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  // Check if registration is complete (unless explicitly allowed)
  if (!allowIncomplete && !isRegistrationComplete(user)) {
    return <Navigate to="/complete-registration" />;
  }

  // Check if subscription is approved (for paid plans)
  if (!allowIncomplete && !isSubscriptionApproved(user)) {
    return <Navigate to="/pending-approval" />;
  }

  // If a specific role is required and user doesn't have it
  if (requiredRole && user?.role !== requiredRole) {
    return <Navigate to="/dashboard" />;
  }

  return children;
};

const AppRoutes = () => {
  const { user } = useAuth();

  return (
    <Routes>
      {/* Public exam access - must be before catch-all routes */}
      <Route path="/join/:shareToken" element={<PublicExamAccess />} />
      
      {/* Public routes */}
      <Route path="/" element={<App />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Registration completion route - accessible to authenticated users with incomplete registration */}
      <Route
        path="/complete-registration"
        element={
          <ProtectedRoute allowIncomplete={true}>
            <CompleteRegistration />
          </ProtectedRoute>
        }
      />

      {/* Pending approval page - accessible to authenticated users waiting for approval */}
      <Route
        path="/pending-approval"
        element={
          <ProtectedRoute allowIncomplete={true}>
            <PendingApproval />
          </ProtectedRoute>
        }
      />

      {/* Role-based dashboard redirect */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            {user?.role === 'student'
              ? <Navigate to="/student/dashboard" replace />
              : user?.role === 'admin' && user?.userType === 'organization'
                ? <Navigate to="/org-admin" replace />
                : user?.role === 'admin'
                  ? <Navigate to="/super-admin" replace />
                  : <Navigate to="/teacher" replace />}
          </ProtectedRoute>
        }
      />

      {/* Teacher dashboard */}
      <Route
        path="/teacher/*"
        element={
          <ProtectedRoute>
            <TeacherDashboard />
          </ProtectedRoute>
        }
      />

      {/* Org Admin dashboard */}
      <Route
        path="/org-admin/*"
        element={
          <ProtectedRoute requiredRole="admin">
            <OrgAdminDashboard />
          </ProtectedRoute>
        }
      />

      {/* Super Admin dashboard */}
      <Route
        path="/super-admin/*"
        element={
          <ProtectedRoute requiredRole="admin">
            <SuperAdminDashboard />
          </ProtectedRoute>
        }
      />

      {/* Student routes */}
      <Route
        path="/student/*"
        element={
          <ProtectedRoute requiredRole="student">
            <Routes>
              <Route path="/" element={<StudentDashboard />} />
              <Route path="dashboard" element={<StudentDashboard />} />
              <Route path="exams" element={<ExamList />} />
              <Route path="results" element={<Results />} />
              <Route path="results/:resultId" element={<Results />} />
              <Route path="history" element={<ExamHistory />} />
              <Route path="profile" element={<Profile />} />
            </Routes>
          </ProtectedRoute>
        }
      />

      {/* Legacy admin redirect */}
      <Route path="/admin/*" element={<Navigate to="/org-admin" replace />} />

      {/* 404 route */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default AppRoutes;
