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
  getShareStats,
  resetShareExpiration,
  removeStudentFromShare,
  getAllSharedExams
} = require('../controllers/shareController');

// Get all shared exams for teacher (including orphaned ones) - must be before /:shareToken routes
router.get('/all', auth, isAdminOrTeacher, getAllSharedExams);

// DEBUG: List all shared exams in database (remove after debugging)
router.get('/debug/list-all', async (req, res) => {
  try {
    const SharedExam = require('../models/SharedExam');
    const allShares = await SharedExam.find({}).select('shareToken exam sharedBy isActive createdAt').sort({ createdAt: -1 }).limit(20);
    res.json({
      success: true,
      count: allShares.length,
      shares: allShares.map(s => ({
        shareToken: s.shareToken,
        exam: s.exam,
        sharedBy: s.sharedBy,
        isActive: s.isActive,
        createdAt: s.createdAt
      }))
    });
  } catch (error) {
    console.error('Debug list error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

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

// Update share settings
router.put('/:shareId', isAdminOrTeacher, updateShare);

// Delete share
router.delete('/:shareId', isAdminOrTeacher, deleteShare);

// Unlock student exam (allow retaking)
router.post('/:shareId/unlock-student/:studentId', isAdminOrTeacher, unlockStudentExam);

// Get share statistics
router.get('/:shareId/stats', isAdminOrTeacher, getShareStats);

// Reset share expiration
router.post('/:shareId/reset-expiration', isAdminOrTeacher, resetShareExpiration);

// Remove student from shared exam
router.delete('/:shareToken/students/:studentId', isAdminOrTeacher, removeStudentFromShare);

module.exports = router;
