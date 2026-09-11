import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import StudentDashboard from './components/student/Dashboard';
import StudentExams from './components/student/Exams';
import StudentResults from './components/student/Results';
import StudentHistory from './components/student/History';
import StudentProfile from './components/student/Profile';
import StudentLeaderboard from './components/student/Leaderboard';
import ExamInterface from './components/student/ExamInterface';
import ExamCountdown from './components/student/ExamCountdown';
import SelectiveAnsweringDebug from './components/student/SelectiveAnsweringDebug';
import SubscriptionPurchase from './components/SubscriptionPurchase';
import SubscriptionCallback from './pages/SubscriptionCallback';
import ForcePasswordChangeDialog from './components/student/ForcePasswordChangeDialog';
import { useAuth } from './context/AuthContext';

const StudentRoutes = () => {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  // A student still on the password their teacher gave them must choose
  // their own — but not mid-exam: an exam link takes them into the exam first.
  const isOnExamScreen = location.pathname.startsWith('/student/exam/');
  const mustChangePassword = !!user?.mustChangePassword && !isOnExamScreen;

  return (
    <>
      {mustChangePassword && <ForcePasswordChangeDialog />}
      <Routes>
        {/* Default route redirects to dashboard */}
        <Route path="/" element={<Navigate to="/student/dashboard" />} />

        {/* Student Dashboard */}
        <Route path="/dashboard" element={<StudentDashboard />} />

        {/* Exams Routes */}
        <Route path="/exams" element={<StudentExams />} />
        <Route path="/exam/start/:id" element={<ExamCountdown />} />
        <Route path="/exam/:id" element={<ExamInterface />} />
        <Route path="/exam/:id/debug" element={<SelectiveAnsweringDebug />} />

        {/* Results Routes */}
        <Route path="/results" element={<StudentResults />} />
        <Route path="/results/:resultId" element={<StudentResults />} />

        {/* History Route */}
        <Route path="/history" element={<StudentHistory />} />

        {/* Leaderboard Route */}
        <Route path="/leaderboard" element={<StudentLeaderboard />} />

        {/* Profile Route */}
        <Route path="/profile" element={<StudentProfile />} />

        {/* Subscription Routes */}
        <Route path="/subscriptions" element={<SubscriptionPurchase />} />
        <Route path="/subscriptions/callback" element={<SubscriptionCallback />} />

        {/* Catch-all route for student section */}
        <Route path="*" element={<Navigate to="/student/dashboard" />} />
      </Routes>
    </>
  );
};

export default StudentRoutes;
