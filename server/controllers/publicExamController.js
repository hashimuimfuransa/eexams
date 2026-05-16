const Exam = require('../models/Exam');
const ExamRequest = require('../models/ExamRequest');
const SharedExam = require('../models/SharedExam');
const User = require('../models/User');

// @desc    Get all publicly listed exams
// @route   GET /api/public/exams
// @access  Public
const getPublicExams = async (req, res) => {
  try {
    const exams = await Exam.find({ isPubliclyListed: true, isLocked: false })
      .populate('createdBy', 'fullName')
      .select('title description timeLimit publicPrice publicDescription createdAt createdBy')
      .sort({ createdAt: -1 });

    res.json(exams);
  } catch (error) {
    console.error('Get public exams error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get single public exam details
// @route   GET /api/public/exams/:id
// @access  Public
const getPublicExamById = async (req, res) => {
  try {
    const exam = await Exam.findOne({
      _id: req.params.id,
      isPubliclyListed: true,
      isLocked: false
    })
      .populate('createdBy', 'fullName')
      .select('title description timeLimit publicPrice publicDescription createdAt createdBy sections');

    if (!exam) {
      return res.status(404).json({ message: 'Exam not found or not publicly available' });
    }

    // Calculate total questions
    const totalQuestions = exam.sections.reduce((sum, section) => {
      return sum + (section.questions?.length || 0);
    }, 0);

    res.json({
      ...exam.toObject(),
      totalQuestions
    });
  } catch (error) {
    console.error('Get public exam error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Submit a request to take a public exam
// @route   POST /api/public/exams/:id/request
// @access  Public
const requestPublicExam = async (req, res) => {
  try {
    const { name, phone, email } = req.body;

    // Validate required fields
    if (!name || !phone) {
      return res.status(400).json({ message: 'Name and phone number are required' });
    }

    // Check if exam exists and is publicly listed
    const exam = await Exam.findOne({
      _id: req.params.id,
      isPubliclyListed: true,
      isLocked: false
    });

    if (!exam) {
      return res.status(404).json({ message: 'Exam not found or not publicly available' });
    }

    // Check if user already has a pending or approved request for this exam
    const existingRequest = await ExamRequest.findOne({
      exam: exam._id,
      'userInfo.email': email,
      status: { $in: ['pending', 'approved'] }
    });

    if (existingRequest) {
      if (existingRequest.status === 'pending') {
        return res.status(400).json({ message: 'You already have a pending request for this exam' });
      } else if (existingRequest.status === 'approved') {
        return res.status(400).json({ 
          message: 'You have already been approved for this exam',
          shareToken: existingRequest.shareToken
        });
      }
    }

    // Create the request
    const examRequest = await ExamRequest.create({
      exam: exam._id,
      teacher: exam.createdBy,
      userInfo: {
        name: name.trim(),
        email: email.trim(),
        phone: phone?.trim() || null
      },
      amount: exam.publicPrice || 0
    });

    res.status(201).json({
      message: 'Request submitted successfully. The teacher will review your request.',
      requestId: examRequest._id
    });
  } catch (error) {
    console.error('Request public exam error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get all exam requests for a teacher
// @route   GET /api/public/exam-requests
// @access  Private (Teacher)
const getTeacherExamRequests = async (req, res) => {
  try {
    const requests = await ExamRequest.find({ teacher: req.user._id })
      .populate('exam', 'title description timeLimit')
      .sort({ requestedAt: -1 });

    res.json(requests);
  } catch (error) {
    console.error('Get teacher exam requests error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get requests for a specific exam
// @route   GET /api/public/exams/:examId/requests
// @access  Private (Teacher)
const getExamRequests = async (req, res) => {
  try {
    // For teachers, allow accessing exams from their organization; for admins, use orgAdminId
    let query = { _id: req.params.examId };
    if (req.user.role === 'teacher' && req.orgAdminId) {
      query.$or = [
        { createdBy: req.orgAdminId },  // Exams created by their admin
        { createdBy: req.user._id }    // Exams created by the teacher themselves
      ];
    } else {
      query.createdBy = req.orgAdminId || req.user._id;
    }
    
    const exam = await Exam.findOne(query);

    if (!exam) {
      return res.status(404).json({ message: 'Exam not found or you do not have permission' });
    }

    const requests = await ExamRequest.find({ exam: req.params.examId })
      .sort({ requestedAt: -1 });

    res.json(requests);
  } catch (error) {
    console.error('Get exam requests error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Approve an exam request
// @route   PUT /api/public/exam-requests/:requestId/approve
// @access  Private (Teacher)
const approveExamRequest = async (req, res) => {
  try {
    const { waivePayment } = req.body;

    const request = await ExamRequest.findById(req.params.requestId);

    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    // Check if the teacher owns this request
    if (request.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You do not have permission to approve this request' });
    }

    // Check if already processed
    if (request.status !== 'pending') {
      return res.status(400).json({ message: 'Request has already been processed' });
    }

    // Create a SharedExam for the approved user
    const shareToken = SharedExam.generateShareToken();
    
    const sharedExam = await SharedExam.create({
      exam: request.exam,
      sharedBy: req.user._id,
      shareToken,
      shareType: 'link',
      settings: {
        publicAccess: true,
        requirePassword: false,
        maxStudents: 1, // Only this user can access
        allowMultipleAttempts: false,
        showResults: true
      }
    });

    // Add the student to the shared exam
    sharedExam.students.push({
      student: null,
      email: request.userInfo.email || null,
      name: request.userInfo.name,
      accessMethod: 'link',
      firstAccessedAt: new Date()
    });

    await sharedExam.save();

    // Update the request
    request.status = 'approved';
    request.processedAt = new Date();
    request.shareToken = shareToken;
    request.sharedExam = sharedExam._id;
    request.paymentStatus = waivePayment ? 'waived' : (request.amount > 0 ? 'pending' : 'paid');

    await request.save();

    res.json({
      message: 'Request approved successfully',
      request,
      shareToken
    });
  } catch (error) {
    console.error('Approve exam request error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Reject an exam request
// @route   PUT /api/public/exam-requests/:requestId/reject
// @access  Private (Teacher)
const rejectExamRequest = async (req, res) => {
  try {
    const { notes } = req.body;

    const request = await ExamRequest.findById(req.params.requestId);

    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    // Check if the teacher owns this request
    if (request.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You do not have permission to reject this request' });
    }

    // Check if already processed
    if (request.status !== 'pending') {
      return res.status(400).json({ message: 'Request has already been processed' });
    }

    // Update the request
    request.status = 'rejected';
    request.processedAt = new Date();
    request.teacherNotes = notes || null;

    await request.save();

    res.json({
      message: 'Request rejected successfully',
      request
    });
  } catch (error) {
    console.error('Reject exam request error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update exam public listing settings
// @route   PUT /api/public/exams/:id/settings
// @access  Private (Teacher)
const updatePublicExamSettings = async (req, res) => {
  try {
    const { isPubliclyListed, publicPrice, publicDescription } = req.body;

    // For teachers, allow updating exams from their organization; for admins, use orgAdminId
    let query = { _id: req.params.id };
    if (req.user.role === 'teacher' && req.orgAdminId) {
      query.$or = [
        { createdBy: req.orgAdminId },  // Exams created by their admin
        { createdBy: req.user._id }    // Exams created by the teacher themselves
      ];
    } else {
      query.createdBy = req.orgAdminId || req.user._id;
    }

    const exam = await Exam.findOne(query);

    if (!exam) {
      return res.status(404).json({ message: 'Exam not found or you do not have permission' });
    }

    // Update fields
    if (isPubliclyListed !== undefined) {
      exam.isPubliclyListed = isPubliclyListed;
    }
    if (publicPrice !== undefined) {
      exam.publicPrice = parseFloat(publicPrice);
    }
    if (publicDescription !== undefined) {
      exam.publicDescription = publicDescription;
    }

    await exam.save();

    res.json({
      message: 'Exam settings updated successfully',
      exam
    });
  } catch (error) {
    console.error('Update public exam settings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Mark payment as received
// @route   PUT /api/public/exam-requests/:requestId/payment
// @access  Private (Teacher)
const markPaymentReceived = async (req, res) => {
  try {
    const request = await ExamRequest.findById(req.params.requestId);

    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    // Check if the teacher owns this request
    if (request.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You do not have permission to update this request' });
    }

    // Update payment status
    request.paymentStatus = 'paid';
    await request.save();

    res.json({
      message: 'Payment marked as received',
      request
    });
  } catch (error) {
    console.error('Mark payment received error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getPublicExams,
  getPublicExamById,
  requestPublicExam,
  getTeacherExamRequests,
  getExamRequests,
  approveExamRequest,
  rejectExamRequest,
  updatePublicExamSettings,
  markPaymentReceived
};
