const Reclamation = require('../models/Reclamation');
const Result = require('../models/Result');
const Exam = require('../models/Exam');
const User = require('../models/User');
const { sendReclamationResponseEmail } = require('../utils/emailService');

// @desc    Create a new reclamation
// @route   POST /api/reclamations
// @access  Private/Student
const createReclamation = async (req, res) => {
  try {
    const { resultId, examId, claim, category, priority } = req.body;

    if (!resultId || !examId || !claim) {
      return res.status(400).json({ message: 'Result ID, exam ID, and claim are required' });
    }

    // Get the result to find the exam and student info
    const result = await Result.findById(resultId).populate('exam student');
    if (!result) {
      return res.status(404).json({ message: 'Result not found' });
    }

    // Get the exam to find the teacher
    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({ message: 'Exam not found' });
    }

    // Verify the student owns this result
    if (result.student._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You can only create reclamations for your own results' });
    }

    // Find the teacher who created the exam
    const teacher = await User.findById(exam.createdBy);
    
    // Find the organization admin if applicable
    let organizationAdmin = null;
    if (req.user.parentAdmin) {
      organizationAdmin = await User.findById(req.user.parentAdmin);
    }

    const reclamation = await Reclamation.create({
      student: req.user._id,
      result: resultId,
      exam: examId,
      teacher: exam.createdBy,
      organizationAdmin: organizationAdmin?._id || null,
      claim,
      category: category || 'other',
      priority: priority || 'medium',
      status: 'pending'
    });

    const populatedReclamation = await Reclamation.findById(reclamation._id)
      .populate('student', 'firstName lastName email')
      .populate('result')
      .populate('exam', 'title')
      .populate('teacher', 'firstName lastName email')
      .populate('organizationAdmin', 'firstName lastName email');

    res.status(201).json(populatedReclamation);
  } catch (error) {
    console.error('Create reclamation error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get all reclamations (for teachers, org admins, super admins)
// @route   GET /api/reclamations
// @access  Private/Teacher/OrgAdmin/SuperAdmin
const getReclamations = async (req, res) => {
  try {
    let query = {};
    const userRole = req.user.role;

    // Filter based on user role
    if (userRole === 'teacher') {
      query.teacher = req.user._id;
    } else if (userRole === 'admin') {
      // Org admin should see all reclamations for teachers in their organization
      // Find all teachers under this org admin
      const teachersInOrg = await User.find({ parentAdmin: req.user._id, role: 'teacher' }).select('_id');
      const teacherIds = teachersInOrg.map(t => t._id);
      
      // Also include reclamations where org admin is explicitly set
      query.$or = [
        { teacher: { $in: teacherIds } },
        { organizationAdmin: req.user._id }
      ];
    }
    // Super admin can see all reclamations (no filter)

    const reclamations = await Reclamation.find(query)
      .populate('student', 'firstName lastName email')
      .populate('result')
      .populate('exam', 'title')
      .populate('teacher', 'firstName lastName email')
      .populate('organizationAdmin', 'firstName lastName email')
      .populate('respondedBy', 'firstName lastName email')
      .sort({ createdAt: -1 });

    res.json(reclamations);
  } catch (error) {
    console.error('Get reclamations error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get a single reclamation by ID
// @route   GET /api/reclamations/:id
// @access  Private
const getReclamationById = async (req, res) => {
  try {
    const reclamation = await Reclamation.findById(req.params.id)
      .populate('student', 'firstName lastName email')
      .populate('result')
      .populate('exam', 'title')
      .populate('teacher', 'firstName lastName email')
      .populate('organizationAdmin', 'firstName lastName email')
      .populate('respondedBy', 'firstName lastName email');

    if (!reclamation) {
      return res.status(404).json({ message: 'Reclamation not found' });
    }

    // Check access permissions
    const userRole = req.user.role;
    const userId = req.user._id.toString();

    if (userRole === 'student' && reclamation.student._id.toString() !== userId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    if (userRole === 'teacher' && reclamation.teacher._id.toString() !== userId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    if (userRole === 'admin') {
      // Org admin can view if they are the assigned org admin OR if the teacher is under their organization
      const isAssignedAdmin = reclamation.organizationAdmin?._id.toString() === userId;
      const isTeacherInOrg = reclamation.teacher?.parentAdmin?.toString() === userId;
      
      if (!isAssignedAdmin && !isTeacherInOrg) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    res.json(reclamation);
  } catch (error) {
    console.error('Get reclamation error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Respond to a reclamation
// @route   PUT /api/reclamations/:id/respond
// @access  Private/Teacher/OrgAdmin/SuperAdmin
const respondToReclamation = async (req, res) => {
  try {
    const { response, status } = req.body;

    if (!response) {
      return res.status(400).json({ message: 'Response is required' });
    }

    const reclamation = await Reclamation.findById(req.params.id);
    if (!reclamation) {
      return res.status(404).json({ message: 'Reclamation not found' });
    }

    // Check access permissions
    const userRole = req.user.role;
    const userId = req.user._id.toString();

    if (userRole === 'teacher' && reclamation.teacher.toString() !== userId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    if (userRole === 'admin') {
      // Org admin can respond if they are the assigned org admin OR if the teacher is under their organization
      const isAssignedAdmin = reclamation.organizationAdmin?.toString() === userId;
      const teacher = await User.findById(reclamation.teacher);
      const isTeacherInOrg = teacher?.parentAdmin?.toString() === userId;
      
      if (!isAssignedAdmin && !isTeacherInOrg) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    reclamation.response = response;
    reclamation.status = status || 'resolved';
    reclamation.respondedBy = req.user._id;
    reclamation.respondedAt = Date.now();

    await reclamation.save();

    // Send email notification to student
    const student = await User.findById(reclamation.student);
    if (student) {
      const reclamationWithExam = await Reclamation.findById(reclamation._id).populate('exam', 'title');
      await sendReclamationResponseEmail(student, reclamationWithExam, response);
    }

    const updatedReclamation = await Reclamation.findById(reclamation._id)
      .populate('student', 'firstName lastName email')
      .populate('result')
      .populate('exam', 'title')
      .populate('teacher', 'firstName lastName email')
      .populate('organizationAdmin', 'firstName lastName email')
      .populate('respondedBy', 'firstName lastName email');

    res.json(updatedReclamation);
  } catch (error) {
    console.error('Respond to reclamation error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get student's own reclamations
// @route   GET /api/reclamations/my-reclamations
// @access  Private/Student
const getMyReclamations = async (req, res) => {
  try {
    const reclamations = await Reclamation.find({ student: req.user._id })
      .populate('student', 'firstName lastName email')
      .populate('result')
      .populate('exam', 'title')
      .populate('teacher', 'firstName lastName email')
      .populate('organizationAdmin', 'firstName lastName email')
      .populate('respondedBy', 'firstName lastName email')
      .sort({ createdAt: -1 });

    res.json(reclamations);
  } catch (error) {
    console.error('Get my reclamations error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  createReclamation,
  getReclamations,
  getReclamationById,
  respondToReclamation,
  getMyReclamations
};
