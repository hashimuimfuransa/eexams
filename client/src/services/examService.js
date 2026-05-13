import api from './api';

/**
 * Create a new exam with file upload
 * @param {Object} examData - Basic exam data (title, description, timeLimit)
 * @param {File} examFile - The exam file
 * @param {File} answerFile - The answer file
 * @returns {Promise} - Promise with the created exam data
 */
export const createExam = async (examData, examFile, answerFile) => {
  try {
    // Validate required fields
    if (!examData.title || !examData.description || !examData.timeLimit) {
      throw new Error('Please provide all required fields');
    }

    // Create FormData object to handle file uploads
    const formData = new FormData();

    // Add exam data
    formData.append('title', examData.title);
    formData.append('description', examData.description);
    formData.append('timeLimit', examData.timeLimit);
    formData.append('passingScore', examData.passingScore);
    formData.append('isLocked', examData.isLocked);

    // Add files
    if (examFile) {
      formData.append('examFile', examFile);
    }

    if (answerFile) {
      formData.append('answerFile', answerFile);
    }

    console.log('Sending exam data:', {
      title: examData.title,
      description: examData.description,
      timeLimit: examData.timeLimit,
      passingScore: examData.passingScore,
      isLocked: examData.isLocked,
      hasExamFile: !!examFile,
      hasAnswerFile: !!answerFile
    });

    // Make API request with FormData
    const response = await api.post('/admin/exams', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      timeout: 30000 // 30 seconds timeout for file uploads
    });

    return response.data;
  } catch (error) {
    console.error('Error creating exam:', error);

    // Check if it's a network error
    if (error.message === 'Network Error') {
      throw new Error('Network error. Please check your connection and try again.');
    }

    // Check if it's a timeout error
    if (error.code === 'ECONNABORTED') {
      throw new Error('Request timed out. Please try again with a smaller file or better connection.');
    }

    // Check if it's a server error with response
    if (error.response) {
      const errorMessage = error.response.data?.message || `Server error: ${error.response.status}`;
      console.error('Server error details:', error.response.data);
      throw new Error(errorMessage);
    }

    // For other errors, just pass through
    throw error;
  }
};

/**
 * Get all exams
 * @returns {Promise} - Promise with all exams
 */
export const getExams = async () => {
  try {
    const response = await api.get('/exam');
    return response.data;
  } catch (error) {
    console.error('Error fetching exams:', error);
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
    const response = await api.get(`/exam/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching exam:', error);
    throw error;
  }
};

/**
 * Update an exam
 * @param {string} id - Exam ID
 * @param {Object|FormData} examData - Updated exam data or FormData for file uploads
 * @returns {Promise} - Promise with updated exam data
 */
export const updateExam = async (id, examData) => {
  try {
    // Check if examData is FormData (for file uploads)
    const isFormData = examData instanceof FormData;

    const config = isFormData ? {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    } : {};

    const response = await api.put(`/exam/${id}`, examData, config);
    return response.data;
  } catch (error) {
    console.error('Error updating exam:', error);
    throw error;
  }
};

/**
 * Delete an exam
 * @param {string} id - Exam ID
 * @returns {Promise} - Promise with deletion confirmation
 */
export const deleteExam = async (id) => {
  try {
    const response = await api.delete(`/exam/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting exam:', error);
    throw error;
  }
};

/**
 * Toggle exam lock status
 * @param {string} id - Exam ID
 * @returns {Promise} - Promise with updated lock status
 */
export const toggleExamLock = async (id) => {
  try {
    const response = await api.put(`/exam/${id}/toggle-lock`);
    return response.data;
  } catch (error) {
    console.error('Error toggling exam lock:', error);
    throw error;
  }
};
