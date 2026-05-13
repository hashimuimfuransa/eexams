import api from './api';

/**
 * Get all exams assigned to the student
 * @returns {Promise} - Promise with all assigned exams
 */
export const getAssignedExams = async () => {
  try {
    const response = await api.get('/student/exams');
    return response.data;
  } catch (error) {
    console.error('Error fetching assigned exams:', error);
    throw error;
  }
};

/**
 * Get exam by ID
 * @param {string} id - Exam ID
 * @returns {Promise} - Promise with exam data
 */
export const getExamById = async (id) => {
  try {
    const response = await api.get(`/student/exams/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching exam:', error);
    throw error;
  }
};

/**
 * Start an exam
 * @param {string} id - Exam ID
 * @returns {Promise} - Promise with exam session data
 */
export const startExam = async (id) => {
  try {
    const response = await api.post(`/student/exams/${id}/start`);
    return response.data;
  } catch (error) {
    console.error('Error starting exam:', error);
    throw error;
  }
};

/**
 * Submit an exam
 * @param {string} id - Exam ID
 * @param {Object} answers - Student's answers
 * @returns {Promise} - Promise with submission confirmation
 */
export const submitExam = async (id, answers) => {
  try {
    const response = await api.post(`/student/exams/${id}/submit`, { answers });
    return response.data;
  } catch (error) {
    console.error('Error submitting exam:', error);
    throw error;
  }
};

/**
 * Get student's exam results
 * @returns {Promise} - Promise with exam results
 */
export const getExamResults = async () => {
  try {
    const response = await api.get('/student/results');
    return response.data;
  } catch (error) {
    console.error('Error fetching exam results:', error);
    throw error;
  }
};

/**
 * Get detailed result for a specific exam
 * @param {string} id - Exam ID
 * @returns {Promise} - Promise with detailed exam result
 */
export const getDetailedResult = async (id) => {
  try {
    const response = await api.get(`/student/results/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching detailed result:', error);
    throw error;
  }
};

/**
 * Get class leaderboard data
 * @returns {Promise} - Promise with leaderboard data for students in the same class
 */
export const getClassLeaderboard = async () => {
  try {
    const response = await api.get('/student/leaderboard');
    return response.data;
  } catch (error) {
    console.error('Error fetching class leaderboard:', error);
    throw error;
  }
};
