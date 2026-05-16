const Exam = require('../models/Exam');
const ExamRequest = require('../models/ExamRequest');
const SharedExam = require('../models/SharedExam');
const User = require('../models/User');

// @desc    Get all marketplace exams
// @route   GET /api/marketplace/exams
// @access  Public
const getMarketplaceExams = async (req, res) => {
  try {
    const exams = await Exam.find({ isPubliclyListed: true, isLocked: false })
      .populate('createdBy', 'fullName')
      .populate('sections.questions')
      .select('title description timeLimit publicPrice publicDescription targetAudience createdAt createdBy sections')
      .sort({ createdAt: -1 });

    res.json(exams);
  } catch (error) {
    console.error('Get marketplace exams error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get single marketplace exam details
// @route   GET /api/marketplace/exams/:id
// @access  Public
const getMarketplaceExamById = async (req, res) => {
  try {
    const exam = await Exam.findOne({
      _id: req.params.id,
      isPubliclyListed: true,
      isLocked: false
    })
      .populate('createdBy', 'fullName')
      .select('title description timeLimit publicPrice publicDescription createdAt createdBy sections');

    if (!exam) {
      return res.status(404).json({ message: 'Exam not found or not available on marketplace' });
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
    console.error('Get marketplace exam error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Submit a request to take a marketplace exam
// @route   POST /api/marketplace/exams/:id/request
// @access  Public
const requestMarketplaceExam = async (req, res) => {
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
      return res.status(404).json({ message: 'Exam not found or not available on marketplace' });
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
    console.error('Request marketplace exam error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get all exam requests for a teacher
// @route   GET /api/marketplace/exam-requests
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
// @route   GET /api/marketplace/exams/:examId/requests
// @access  Private (Teacher)
const getExamRequests = async (req, res) => {
  try {
    // First, check if the exam exists
    const exam = await Exam.findById(req.params.examId);
    
    if (!exam) {
      return res.status(404).json({ message: 'Exam not found' });
    }

    // Check if user has permission (created the exam or belongs to same organization)
    const hasPermission = exam.createdBy.toString() === req.user._id.toString() ||
                         exam.createdBy.toString() === (req.orgAdminId?.toString()) ||
                         exam.createdBy.toString() === (req.user.parentAdmin?.toString());

    if (!hasPermission) {
      console.log('Permission denied for exam requests:', {
        examId: req.params.examId,
        examCreatedBy: exam.createdBy.toString(),
        userId: req.user._id.toString(),
        userRole: req.user.role,
        orgAdminId: req.orgAdminId?.toString(),
        parentAdmin: req.user.parentAdmin?.toString()
      });
      return res.status(403).json({ message: 'You do not have permission to access this exam' });
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
// @route   PUT /api/marketplace/exam-requests/:requestId/approve
// @access  Private (Teacher)
const approveExamRequest = async (req, res) => {
  try {
    const { waivePayment } = req.body;

    const request = await ExamRequest.findById(req.params.requestId);

    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    // Check if the teacher owns this request or belongs to same organization
    const hasPermission = request.teacher.toString() === req.user._id.toString() ||
                         request.teacher.toString() === (req.orgAdminId?.toString()) ||
                         request.teacher.toString() === (req.user.parentAdmin?.toString());

    if (!hasPermission) {
      return res.status(403).json({ message: 'You do not have permission to approve this request' });
    }

    // Check if already processed
    if (request.status !== 'pending') {
      return res.status(400).json({ message: 'Request has already been processed' });
    }

    // Create a SharedExam for the approved user
    const shareToken = SharedExam.generateShareToken();
    
    // Generate a unique 6-digit access code
    const accessCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    const sharedExam = await SharedExam.create({
      exam: request.exam,
      sharedBy: req.user._id,
      shareToken,
      shareType: 'link',
      settings: {
        publicAccess: true,
        requirePassword: false,
        maxStudents: null, // Unlimited access for marketplace exams
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
    request.accessCode = accessCode;
    request.sharedExam = sharedExam._id;
    request.paymentStatus = waivePayment ? 'waived' : (request.amount > 0 ? 'pending' : 'paid');

    await request.save();

    res.json({
      message: 'Request approved successfully',
      request,
      shareToken,
      accessCode
    });
  } catch (error) {
    console.error('Approve exam request error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Reject an exam request
// @route   PUT /api/marketplace/exam-requests/:requestId/reject
// @access  Private (Teacher)
const rejectExamRequest = async (req, res) => {
  try {
    const { notes } = req.body;

    const request = await ExamRequest.findById(req.params.requestId);

    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    // Check if the teacher owns this request or belongs to same organization
    const hasPermission = request.teacher.toString() === req.user._id.toString() ||
                         request.teacher.toString() === (req.orgAdminId?.toString()) ||
                         request.teacher.toString() === (req.user.parentAdmin?.toString());

    if (!hasPermission) {
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

// @desc    Update exam marketplace listing settings
// @route   PUT /api/marketplace/exams/:id/settings
// @access  Private (Teacher)
const updateMarketplaceExamSettings = async (req, res) => {
  try {
    const { isPubliclyListed, publicPrice, publicDescription } = req.body;

    // First, check if the exam exists
    const exam = await Exam.findById(req.params.id);

    if (!exam) {
      return res.status(404).json({ message: 'Exam not found' });
    }

    // Check if user has permission (created the exam or belongs to same organization)
    const hasPermission = exam.createdBy.toString() === req.user._id.toString() ||
                         exam.createdBy.toString() === (req.orgAdminId?.toString()) ||
                         exam.createdBy.toString() === (req.user.parentAdmin?.toString());

    if (!hasPermission) {
      return res.status(403).json({ message: 'You do not have permission to update this exam' });
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
      message: 'Exam marketplace settings updated successfully',
      exam
    });
  } catch (error) {
    console.error('Update marketplace exam settings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Mark payment as received
// @route   PUT /api/marketplace/exam-requests/:requestId/payment
// @access  Private (Teacher)
const markPaymentReceived = async (req, res) => {
  try {
    const request = await ExamRequest.findById(req.params.requestId);

    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    // Check if the teacher owns this request or belongs to same organization
    const hasPermission = request.teacher.toString() === req.user._id.toString() ||
                         request.teacher.toString() === (req.orgAdminId?.toString()) ||
                         request.teacher.toString() === (req.user.parentAdmin?.toString());

    if (!hasPermission) {
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

// @desc    Reset access link and code for an approved request
// @route   PUT /api/marketplace/exam-requests/:requestId/reset
// @access  Private (Teacher)
const resetAccessLink = async (req, res) => {
  try {
    const request = await ExamRequest.findById(req.params.requestId);

    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    // Check if the teacher owns this request or belongs to same organization
    const hasPermission = request.teacher.toString() === req.user._id.toString() ||
                         request.teacher.toString() === (req.orgAdminId?.toString()) ||
                         request.teacher.toString() === (req.user.parentAdmin?.toString());

    if (!hasPermission) {
      return res.status(403).json({ message: 'You do not have permission to reset this request' });
    }

    // Check if request is approved
    if (request.status !== 'approved') {
      return res.status(400).json({ message: 'Can only reset access for approved requests' });
    }

    // Generate new shareToken and accessCode
    const newShareToken = SharedExam.generateShareToken();
    const newAccessCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Update the SharedExam with new shareToken
    await SharedExam.findByIdAndUpdate(request.sharedExam, { shareToken: newShareToken });

    // Update the request
    request.shareToken = newShareToken;
    request.accessCode = newAccessCode;
    request.accessCodeUsed = false; // Reset the used flag so the code can be used again
    await request.save();

    res.json({
      message: 'Access link and code reset successfully',
      shareToken: newShareToken,
      accessCode: newAccessCode
    });
  } catch (error) {
    console.error('Reset access link error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Delete an exam request
// @route   DELETE /api/marketplace/exam-requests/:requestId
// @access  Private (Teacher)
const deleteExamRequest = async (req, res) => {
  try {
    const request = await ExamRequest.findById(req.params.requestId);

    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    // Check if the teacher owns this request or belongs to same organization
    const hasPermission = request.teacher.toString() === req.user._id.toString() ||
                         request.teacher.toString() === (req.orgAdminId?.toString()) ||
                         request.teacher.toString() === (req.user.parentAdmin?.toString());

    if (!hasPermission) {
      return res.status(403).json({ message: 'You do not have permission to delete this request' });
    }

    // If there's a shared exam, delete it
    if (request.sharedExam) {
      await SharedExam.findByIdAndDelete(request.sharedExam);
    }

    // Delete the request
    await ExamRequest.findByIdAndDelete(req.params.requestId);

    res.json({
      message: 'Request deleted successfully'
    });
  } catch (error) {
    console.error('Delete exam request error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get exam details by access code
// @route   GET /api/marketplace/access/:accessCode
// @access  Public
const getExamByAccessCode = async (req, res) => {
  try {
    const { accessCode } = req.params;

    // Find the exam request with this access code
    const request = await ExamRequest.findOne({ accessCode, status: 'approved' })
      .populate('exam')
      .populate('sharedExam');

    if (!request) {
      return res.status(404).json({ message: 'Invalid access code or exam not found' });
    }

    // Check if the access code has already been used (exam completed)
    if (request.accessCodeUsed) {
      return res.status(403).json({
        message: 'This access code has already been used. The exam has been completed.'
      });
    }

    // Get the shared exam details
    const sharedExam = await SharedExam.findById(request.sharedExam)
      .populate('exam');

    if (!sharedExam) {
      return res.status(404).json({ message: 'Shared exam not found' });
    }

    res.json({
      shareToken: request.shareToken,
      exam: sharedExam.exam,
      shareData: {
        settings: sharedExam.settings
      }
    });
  } catch (error) {
    console.error('Get exam by access code error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getMarketplaceExams,
  getMarketplaceExamById,
  requestMarketplaceExam,
  getTeacherExamRequests,
  getExamRequests,
  approveExamRequest,
  rejectExamRequest,
  updateMarketplaceExamSettings,
  markPaymentReceived,
  resetAccessLink,
  deleteExamRequest,
  getExamByAccessCode
};
