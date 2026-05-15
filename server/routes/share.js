const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { isAdminOrTeacher } = require('../middleware/role');
const {
  createShare,
  getExamShares,
  getSharedExam,
  verifySharePassword,
  joinSharedExam,
  submitSharedExam,
  unlockStudentExam,
  updateShare,
  deleteShare,
  getMyShares,
  getShareStats
} = require('../controllers/shareController');

// Public routes (for students accessing shared exams)
router.get('/:shareToken', getSharedExam);
router.post('/:shareToken/verify-password', verifySharePassword);
router.post('/:shareToken/join', joinSharedExam);
router.post('/:shareToken/submit', submitSharedExam);

// Protected routes (for teachers managing shares)
router.use(auth);

// Create share for an exam
router.post('/exam/:examId', isAdminOrTeacher, createShare);

// Get all shares for an exam
router.get('/exam/:examId/shares', isAdminOrTeacher, getExamShares);

// Get all shares created by the teacher
router.get('/my-shares', isAdminOrTeacher, getMyShares);

// Get share statistics
router.get('/:shareId/stats', isAdminOrTeacher, getShareStats);

// Update share settings
router.put('/:shareId', isAdminOrTeacher, updateShare);

// Delete share
router.delete('/:shareId', isAdminOrTeacher, deleteShare);

// Unlock student exam (allow retaking)
router.post('/:shareToken/unlock/:studentId', isAdminOrTeacher, unlockStudentExam);

module.exports = router;
