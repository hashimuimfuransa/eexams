import api from './api';

// Get dashboard statistics
export const getDashboardStats = async () => {
  try {
    // Use real API call
    const response = await api.get('/admin/dashboard-stats');
    return response.data;
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    throw error;
  }
};

// Get all students
export const getAllStudents = async () => {
  try {
    // Use real API call
    const response = await api.get('/admin/students');
    return response.data;
  } catch (error) {
    console.error('Error fetching students:', error);
    throw error;
  }
};

// Register a new student
export const registerStudent = async (studentData) => {
  try {
    const response = await api.post('/admin/students', studentData);
    return response.data;
  } catch (error) {
    console.error('Error registering student:', error);
    throw error;
  }
};

// Update a student
export const updateStudent = async (id, studentData) => {
  try {
    const response = await api.put(`/admin/students/${id}`, studentData);
    return response.data;
  } catch (error) {
    console.error('Error updating student:', error);
    throw error;
  }
};

// Delete a student
export const deleteStudent = async (id) => {
  try {
    const response = await api.delete(`/admin/students/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting student:', error);
    throw error;
  }
};

// Get all teachers
export const getAllTeachers = async () => {
  try {
    const response = await api.get('/admin/teachers');
    return response.data;
  } catch (error) {
    console.error('Error fetching teachers:', error);
    throw error;
  }
};

// Create a new teacher
export const createTeacher = async (teacherData) => {
  try {
    const response = await api.post('/admin/teachers', teacherData);
    return response.data;
  } catch (error) {
    console.error('Error creating teacher:', error);
    throw error;
  }
};

// Update a teacher
export const updateTeacher = async (id, teacherData) => {
  try {
    const response = await api.put(`/admin/teachers/${id}`, teacherData);
    return response.data;
  } catch (error) {
    console.error('Error updating teacher:', error);
    throw error;
  }
};

// Delete a teacher
export const deleteTeacher = async (id) => {
  try {
    const response = await api.delete(`/admin/teachers/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting teacher:', error);
    throw error;
  }
};

// Get organization details
export const getOrganizationDetails = async () => {
  try {
    const response = await api.get('/admin/organization');
    return response.data;
  } catch (error) {
    console.error('Error fetching organization details:', error);
    throw error;
  }
};

// Get all exams
export const getAllExams = async () => {
  try {
    // Use real API call
    const response = await api.get('/admin/exams');
    return response.data;
  } catch (error) {
    console.error('Error fetching exams:', error);
    throw error;
  }
};

// Get scheduled exams
export const getScheduledExams = async () => {
  try {
    // Using the primary endpoint for scheduled exams
    const response = await api.get('/admin/exams/scheduled');
    return response.data;
  } catch (error) {
    console.error('Error fetching scheduled exams:', error);
    throw error;
  }
};

// Toggle exam lock status
export const toggleExamLock = async (id, isLocked) => {
  try {
    const response = await api.put(`/admin/exams/${id}/toggle-lock`, { isLocked });
    return response.data;
  } catch (error) {
    console.error('Error toggling exam lock:', error);
    throw error;
  }
};

// Get exam by ID
export const getExamById = async (id) => {
  try {
    const response = await api.get(`/admin/exams/${id}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Create a new exam
export const createExam = async (examData) => {
  try {
    const response = await api.post('/admin/exams', examData);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Update an exam
export const updateExam = async (id, examData) => {
  try {
    const response = await api.put(`/admin/exams/${id}`, examData);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Delete an exam
export const deleteExam = async (id) => {
  try {
    console.log(`Deleting exam with ID: ${id}`);
    // Remove the /api prefix since it's already in the baseURL
    const response = await api.delete(`/exam/${id}`);
    console.log('Delete exam response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error in deleteExam service:', error);
    throw error;
  }
};

// Schedule an exam
export const scheduleExam = async (scheduleData) => {
  try {
    const response = await api.post('/admin/schedule-exam', scheduleData);
    return response.data;
  } catch (error) {
    console.error('Error scheduling exam:', error);
    throw error;
  }
};

// Get recent exams
export const getRecentExams = async () => {
  try {
    const response = await api.get('/admin/recent-exams');
    return response.data;
  } catch (error) {
    console.error('Error fetching recent exams:', error);
    throw error;
  }
};

// Get recent students
export const getRecentStudents = async () => {
  try {
    const response = await api.get('/admin/recent-students');
    return response.data;
  } catch (error) {
    console.error('Error fetching recent students:', error);
    throw error;
  }
};

// Get security alerts
export const getSecurityAlerts = async () => {
  try {
    const response = await api.get('/admin/security-alerts');
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Resolve a security alert
export const resolveSecurityAlert = async (alertId, data) => {
  try {
    const response = await api.put(`/admin/security-alerts/${alertId}/resolve`, data);
    return response.data;
  } catch (error) {
    console.error('Error resolving security alert:', error);
    throw error;
  }
};

// Ignore a security alert
export const ignoreSecurityAlert = async (alertId, data) => {
  try {
    const response = await api.put(`/admin/security-alerts/${alertId}/ignore`, data);
    return response.data;
  } catch (error) {
    console.error('Error ignoring security alert:', error);
    throw error;
  }
};

// Get activity logs
export const getActivityLogs = async () => {
  try {
    const response = await api.get('/admin/activity-logs');
    return response.data;
  } catch (error) {
    console.error('Error fetching activity logs:', error);
    throw error;
  }
};

// Update security settings
export const updateSecuritySettings = async (settings) => {
  try {
    const response = await api.put('/admin/security-settings', settings);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Get security settings
export const getSecuritySettings = async () => {
  try {
    const response = await api.get('/admin/security-settings');
    return response.data;
  } catch (error) {
    throw error;
  }
};

// This function was removed to fix duplicate declaration
// The getScheduledExams function is already defined at line 73

// Update a scheduled exam
export const updateScheduledExam = async (examId, scheduleData) => {
  try {
    const response = await api.put(`/admin/exams/${examId}/schedule`, scheduleData);
    return response.data;
  } catch (error) {
    console.error('Error updating scheduled exam:', error);
    throw error;
  }
};

// Get student results for regrading
export const getStudentResultsForRegrade = async (queryParams = '') => {
  try {
    const response = await api.get(`/admin/student-results?${queryParams}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching student results for regrade:', error);
    throw error;
  }
};

// Regrade a student result
export const regradeStudentResult = async (resultId, data) => {
  try {
    const response = await api.post(`/admin/regrade-result/${resultId}`, data);
    return response.data;
  } catch (error) {
    console.error('Error regrading student result:', error);
    throw error;
  }
};

// Get all results
export const getAllResults = async () => {
  try {
    const response = await api.get('/admin/results');
    return response.data;
  } catch (error) {
    console.error('Error fetching all results:', error);
    throw error;
  }
};

// Get detailed result
export const getDetailedResult = async (resultId) => {
  try {
    const response = await api.get(`/admin/results/${resultId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching detailed result:', error);
    throw error;
  }
};

// Get exam leaderboard
export const getExamLeaderboard = async (examId) => {
  try {
    const response = await api.get(`/admin/exams/${examId}/leaderboard`);
    return response.data;
  } catch (error) {
    console.error('Error fetching exam leaderboard:', error);
    throw error;
  }
};

// Get overall leaderboard
export const getOverallLeaderboard = async () => {
  try {
    const response = await api.get('/admin/leaderboard');
    return response.data;
  } catch (error) {
    console.error('Error fetching overall leaderboard:', error);
    throw error;
  }
};

// Bulk regrade exam results
export const bulkRegradeResults = async (resultIds, method = 'comprehensive', forceRegrade = true) => {
  try {
    const response = await api.post('/exam/regrade-all', {
      resultIds,
      method,
      forceRegrade
    });
    return response.data;
  } catch (error) {
    console.error('Error bulk regrading results:', error);
    throw error;
  }
};

// Reset student exam for retake
export const resetStudentExam = async (shareToken, studentId) => {
  try {
    const response = await api.post(`/share/${shareToken}/unlock/${studentId}`);
    return response.data;
  } catch (error) {
    console.error('Error resetting student exam:', error);
    throw error;
  }
};

// Reset share link expiration
export const resetShareExpiration = async (shareId, newExpiresAt = null) => {
  try {
    const response = await api.post(`/share/${shareId}/reset-expiration`, { newExpiresAt });
    return response.data;
  } catch (error) {
    console.error('Error resetting share expiration:', error);
    throw error;
  }
};

// Default export with all functions
const adminService = {
  getDashboardStats,
  getAllStudents,
  registerStudent,
  updateStudent,
  deleteStudent,
  getAllExams,
  getScheduledExams,
  toggleExamLock,
  getExamById,
  createExam,
  updateExam,
  deleteExam,
  scheduleExam,
  getRecentExams,
  getRecentStudents,
  getSecurityAlerts,
  resolveSecurityAlert,
  ignoreSecurityAlert,
  getActivityLogs,
  updateSecuritySettings,
  getSecuritySettings,
  updateScheduledExam,
  getStudentResultsForRegrade,
  regradeStudentResult,
  getAllResults,
  getDetailedResult,
  getExamLeaderboard,
  getOverallLeaderboard,
  bulkRegradeResults,
  resetStudentExam,
  resetShareExpiration,
  // Teacher management
  getAllTeachers,
  createTeacher,
  updateTeacher,
  deleteTeacher,
  // Organization
  getOrganizationDetails
};

export default adminService;
