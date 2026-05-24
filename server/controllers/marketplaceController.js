const Exam = require('../models/Exam');
const ExamRequest = require('../models/ExamRequest');
const SharedExam = require('../models/SharedExam');
const User = require('../models/User');
const Result = require('../models/Result');
const emailService = require('../utils/emailService');

// @desc    Get all marketplace exams
// @route   GET /api/marketplace/exams
// @access  Public
const getMarketplaceExams = async (req, res) => {
  try {
    const exams = await Exam.find({ isPubliclyListed: true, isLocked: false })
      .populate('createdBy', 'fullName')
      .populate('sections.questions')
      .populate('level', 'name description subLevels')
      .select('title description timeLimit publicPrice publicDescription targetAudience level subLevel createdAt createdBy sections isPubliclyListed isLocked status')
      .sort({ createdAt: -1 });

    console.log('Marketplace exams count:', exams.length); // Debug log
    console.log('Marketplace exams:', exams.map(e => ({ id: e._id, title: e.title, isPubliclyListed: e.isPubliclyListed, isLocked: e.isLocked, status: e.status }))); // Debug log

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

// Helper function to process exam approval (used for both manual and automatic approval)
const processExamApproval = async (request, waivePayment = false) => {
  // Create or find the user account
  let studentUser;
  let isNewUser = false;
  let tempPassword = null;

  if (request.userInfo.email) {
    studentUser = await User.findOne({ email: request.userInfo.email.toLowerCase().trim() });
  }

  if (!studentUser) {
    // Create a new student account
    tempPassword = Math.random().toString(36).slice(-8);
    const nameParts = request.userInfo.name.split(' ');
    const firstName = nameParts[0] || 'Student';
    const lastName = nameParts.slice(1).join(' ') || 'User';

    studentUser = await User.create({
      email: request.userInfo.email ? request.userInfo.email.toLowerCase().trim() : `student-${Date.now()}@exam.local`,
      password: tempPassword,
      firstName,
      lastName,
      role: 'student',
      userType: 'individual',
      createdBy: request.teacher
    });
    isNewUser = true;
  }

  // Assign the exam to the user
  const exam = await Exam.findById(request.exam);
  console.log(`Marketplace approval - Exam found: ${!!exam}, Exam locked: ${exam?.isLocked}, Current assignedTo: ${exam?.assignedTo?.length || 0}`);
  console.log(`Marketplace approval - Student user ID: ${studentUser._id}, Already assigned: ${exam?.assignedTo?.includes(studentUser._id)}`);

  if (exam && !exam.assignedTo.includes(studentUser._id)) {
    exam.assignedTo.push(studentUser._id);
    // Ensure exam is active so students can see it
    if (exam.status === 'draft') {
      exam.status = 'active';
    }
    await exam.save();
    console.log(`Marketplace approval - Successfully assigned student ${studentUser._id} to exam ${exam._id}`);
    console.log(`Marketplace approval - New assignedTo count: ${exam.assignedTo.length}, status: ${exam.status}`);
  } else if (exam) {
    console.log(`Marketplace approval - Student already assigned to exam`);
  } else {
    console.log(`Marketplace approval - Exam not found: ${request.exam}`);
  }

  // Create a SharedExam for the approved user
  const shareToken = SharedExam.generateShareToken();

  // Generate a unique 6-digit access code
  const accessCode = Math.floor(100000 + Math.random() * 900000).toString();

  // Generate exam slug from exam title
  const examSlug = SharedExam.generateSlug(exam?.title || 'marketplace-exam') || 'marketplace-exam';

  const sharedExam = await SharedExam.create({
    exam: request.exam,
    sharedBy: request.teacher,
    shareToken,
    examSlug,
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
    student: studentUser._id,
    studentId: studentUser._id,
    email: studentUser.email,
    name: studentUser.firstName + ' ' + studentUser.lastName,
    accessMethod: 'link',
    isActiveSession: false,
    lastActivity: null,
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

  console.log('Marketplace approval - Setting sharedExam:', {
    requestId: request._id,
    sharedExamId: sharedExam._id,
    shareToken: shareToken
  });

  await request.save();

  // Send email notification to student about exam approval
  // Include login credentials if this is a new user
  emailService.sendStudentExamApprovedEmail(studentUser, exam, shareToken, isNewUser ? tempPassword : null).catch(err => {
    console.error('[Marketplace] Failed to send student exam approval email:', err);
  });

  return {
    request,
    shareToken,
    accessCode,
    studentUser: {
      email: studentUser.email,
      name: studentUser.firstName + ' ' + studentUser.lastName
    }
  };
};

// @desc    Submit a request to take a marketplace exam
// @route   POST /api/marketplace/exams/:id/request
// @access  Public (for guest) or Private (for authenticated students)
const requestMarketplaceExam = async (req, res) => {
  try {
    // Check if user is authenticated
    const isAuthenticated = req.user && req.user._id;
    const isRetake = req.body?.isRetake === true;
    
    let name, phone, email;

    if (isAuthenticated) {
      // Use authenticated user info
      name = req.user.fullName || `${req.user.firstName} ${req.user.lastName}`;
      phone = req.user.phone || '';
      email = req.user.email;
    } else {
      // Use provided info for guest users (deprecated)
      const { name: providedName, phone: providedPhone, email: providedEmail } = req.body || {};
      name = providedName;
      phone = providedPhone;
      email = providedEmail;

      // Validate required fields for guest users
      if (!name || !phone) {
        return res.status(400).json({ message: 'Name and phone number are required' });
      }
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
    const query = { exam: exam._id, status: { $in: ['pending', 'approved'] } };

    if (isAuthenticated) {
      query.student = req.user._id;
    } else {
      query['userInfo.email'] = email;
    }

    const existingRequest = await ExamRequest.findOne(query);

    if (existingRequest) {
      if (existingRequest.status === 'pending') {
        return res.status(400).json({ message: 'You already have a pending request for this exam' });
      } else if (existingRequest.status === 'approved') {
        // Check if the user has completed the exam - if so, allow re-request
        const completedResult = await Result.findOne({
          student: isAuthenticated ? req.user._id : null,
          exam: exam._id,
          isCompleted: true
        });

        if (completedResult) {
          // User has completed the exam, allow re-request by updating the existing request
          existingRequest.status = 'pending';
          existingRequest.processedAt = null;
          existingRequest.shareToken = null;
          existingRequest.sharedExam = null;
          existingRequest.paymentStatus = 'pending';
          await existingRequest.save();

          console.log(`Re-request allowed for completed exam: ${exam._id}, student: ${isAuthenticated ? req.user._id : email}`);
        } else {
          // User is approved but hasn't completed - check if exam is assigned
          const isAssigned = await Exam.findOne({
            _id: exam._id,
            assignedTo: isAuthenticated ? req.user._id : null
          });

          if (!isAssigned && isAuthenticated) {
            // Exam is approved but not assigned - assign it now
            console.log(`Re-assigning approved exam to student: ${exam._id}, student: ${req.user._id}`);
            await Exam.findByIdAndUpdate(exam._id, { $push: { assignedTo: req.user._id } });
          }

          return res.status(400).json({
            message: 'You have already been approved for this exam',
            shareToken: existingRequest.shareToken
          });
        }
      }
    }

    // Check if user has a rejected request - allow re-request
    const rejectedQuery = { exam: exam._id, status: 'rejected' };

    if (isAuthenticated) {
      rejectedQuery.student = req.user._id;
    } else {
      rejectedQuery['userInfo.email'] = email;
    }

    const rejectedRequest = await ExamRequest.findOne(rejectedQuery);

    if (rejectedRequest) {
      // Update the rejected request to pending
      rejectedRequest.status = 'pending';
      rejectedRequest.processedAt = null;
      rejectedRequest.shareToken = null;
      rejectedRequest.sharedExam = null;
      rejectedRequest.paymentStatus = 'pending';
      await rejectedRequest.save();

      // Send email notification to all super admins about the re-request
      emailService.sendSuperAdminPendingRequestEmail(rejectedRequest, exam, {
        name: name,
        email: email,
        phone: phone
      }).catch(err => {
        console.error('[Marketplace] Failed to send super admin notification for re-request:', err);
      });

      console.log(`Re-request allowed for rejected exam: ${exam._id}, student: ${isAuthenticated ? req.user._id : email}`);
      return res.status(201).json({
        message: 'Request submitted successfully. The teacher will review your request.',
        requestId: rejectedRequest._id
      });
    }

    // Clean up duplicate pending requests for the same exam from the same student
    if (isAuthenticated) {
      const duplicateRequests = await ExamRequest.find({
        exam: exam._id,
        student: req.user._id,
        status: 'pending'
      });

      if (duplicateRequests.length > 0) {
        // Keep the most recent request, delete others
        const requestsToDelete = duplicateRequests
          .sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt))
          .slice(1);

        if (requestsToDelete.length > 0) {
          await ExamRequest.deleteMany({ _id: { $in: requestsToDelete.map(r => r._id) } });
          console.log(`Removed ${requestsToDelete.length} duplicate pending requests for exam ${exam._id}, student ${req.user._id}`);
        }

        // Return the existing pending request instead of creating a new one
        return res.status(400).json({
          message: 'You already have a pending request for this exam',
          requestId: duplicateRequests[0]._id
        });
      }
    }

    // Calculate the amount - 500 RWF for retakes of free exams
    let amount = exam.publicPrice || 0;
    if (isRetake && amount === 0) {
      amount = 500;
    }

    // Create the request
    const requestData = {
      exam: exam._id,
      examTitle: exam.title,
      teacher: exam.createdBy,
      userInfo: {
        name: name.trim(),
        email: email.trim(),
        phone: phone?.trim() || null
      },
      amount: amount,
      isRetake: isRetake
    };

    // Add student reference if authenticated
    if (isAuthenticated) {
      requestData.student = req.user._id;
    }

    const examRequest = await ExamRequest.create(requestData);

    // Send email notification to all super admins about the new pending request
    emailService.sendSuperAdminPendingRequestEmail(examRequest, exam, {
      name: name,
      email: email,
      phone: phone
    }).catch(err => {
      console.error('[Marketplace] Failed to send super admin notification:', err);
    });

    // Check if exam is free (price = 0) - auto-approve, but NOT for retakes
    const isFree = exam.publicPrice === 0 || exam.publicPrice === '0' || exam.publicPrice === '0 RWF';
    
    if (isFree && !isRetake) {
      console.log(`Auto-approving free exam request: ${exam._id}, price: ${exam.publicPrice}`);
      
      // Process the approval automatically
      const approvalResult = await processExamApproval(examRequest, false);
      
      return res.status(201).json({
        message: 'Request approved automatically. This exam is free!',
        requestId: examRequest._id,
        shareToken: approvalResult.shareToken,
        accessCode: approvalResult.accessCode,
        autoApproved: true
      });
    }

    res.status(201).json({
      message: isRetake && isFree 
        ? 'Retake request submitted successfully. Please pay 500 RWF to complete your request.'
        : 'Request submitted successfully. The teacher will review your request.',
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

    // Use the helper function to process approval
    const approvalResult = await processExamApproval(request, waivePayment);

    res.json({
      message: 'Request approved successfully',
      request: approvalResult.request,
      shareToken: approvalResult.shareToken,
      accessCode: approvalResult.accessCode,
      studentUser: approvalResult.studentUser
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

const Level = require('../models/Level');

// @desc    Update exam marketplace listing settings
// @route   PUT /api/marketplace/exams/:id/settings
// @access  Private (Teacher)
const updateMarketplaceExamSettings = async (req, res) => {
  try {
    const { isPubliclyListed, publicPrice, publicDescription, targetAudience, levelId, newLevelName, subLevel } = req.body;

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
    if (targetAudience !== undefined) {
      exam.targetAudience = targetAudience;
    }

    // Handle sub-level
    if (subLevel !== undefined) {
      exam.subLevel = subLevel || null;
    }

    // Handle level - either select existing or create new
    if (newLevelName && newLevelName.trim()) {
      // Create or find existing level
      const level = await Level.findOrCreate(newLevelName.trim(), req.user._id);
      exam.level = level._id;
      // Also update targetAudience for backward compatibility
      exam.targetAudience = level.name;
    } else if (levelId) {
      const level = await Level.findById(levelId);
      if (level) {
        exam.level = level._id;
        exam.targetAudience = level.name;
      }
    }

    await exam.save();

    // Populate level for response
    await exam.populate('level');

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

// @desc    Get student's exam requests
// @route   GET /api/marketplace/student/requests
// @access  Private (Student)
const getStudentExamRequests = async (req, res) => {
  try {
    const requests = await ExamRequest.find({ student: req.user._id })
      .populate('exam', 'title description timeLimit publicPrice')
      .populate('teacher', 'fullName email')
      .sort({ requestedAt: -1 });

    res.json(requests);
  } catch (error) {
    console.error('Get student exam requests error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get all levels
// @route   GET /api/marketplace/levels
// @access  Public
const getAllLevels = async (req, res) => {
  try {
    const levels = await Level.find({ isActive: true })
      .select('name description displayOrder isActive subLevels usageCount createdAt')
      .sort({ displayOrder: 1, name: 1 });
    res.json(levels);
  } catch (error) {
    console.error('Get all levels error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Create a new level
// @route   POST /api/marketplace/levels
// @access  Private (Teacher)
const createLevel = async (req, res) => {
  try {
    const { name, description, displayOrder } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Level name is required' });
    }

    // Check if level already exists (case-insensitive)
    const existingLevel = await Level.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') }
    });

    if (existingLevel) {
      return res.status(400).json({ message: 'Level already exists', level: existingLevel });
    }

    const level = await Level.create({
      name: name.trim(),
      description: description || null,
      displayOrder: displayOrder || 0,
      createdBy: req.user._id
    });

    res.status(201).json({
      message: 'Level created successfully',
      level
    });
  } catch (error) {
    console.error('Create level error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update a level
// @route   PUT /api/marketplace/levels/:id
// @access  Private (Teacher)
const updateLevel = async (req, res) => {
  try {
    const { name, description, displayOrder, isActive } = req.body;

    const level = await Level.findById(req.params.id);
    if (!level) {
      return res.status(404).json({ message: 'Level not found' });
    }

    // Check for name conflict if name is being changed
    if (name && name.trim() !== level.name) {
      const existingLevel = await Level.findOne({
        name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
        _id: { $ne: req.params.id }
      });

      if (existingLevel) {
        return res.status(400).json({ message: 'Level name already in use' });
      }
    }

    if (name !== undefined) level.name = name.trim();
    if (description !== undefined) level.description = description;
    if (displayOrder !== undefined) level.displayOrder = displayOrder;
    if (isActive !== undefined) level.isActive = isActive;

    await level.save();

    res.json({
      message: 'Level updated successfully',
      level
    });
  } catch (error) {
    console.error('Update level error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Delete a level
// @route   DELETE /api/marketplace/levels/:id
// @access  Private (Teacher)
const deleteLevel = async (req, res) => {
  try {
    const level = await Level.findById(req.params.id);
    if (!level) {
      return res.status(404).json({ message: 'Level not found' });
    }

    // Check if level is in use by any exams
    const examCount = await Exam.countDocuments({ level: req.params.id });
    if (examCount > 0) {
      return res.status(400).json({
        message: `Cannot delete level. It is currently used by ${examCount} exam(s).`
      });
    }

    await Level.findByIdAndDelete(req.params.id);
    res.json({ message: 'Level deleted successfully' });
  } catch (error) {
    console.error('Delete level error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Add a sub-level to a level
// @route   POST /api/marketplace/levels/:id/sublevels
// @access  Private (Teacher)
const addSubLevel = async (req, res) => {
  try {
    const { name, description, displayOrder } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Sub-level name is required' });
    }

    const level = await Level.findById(req.params.id);
    if (!level) {
      return res.status(404).json({ message: 'Level not found' });
    }

    // Check for duplicate sub-level name
    const existingSub = level.subLevels.find(
      s => s.name.toLowerCase() === name.trim().toLowerCase()
    );
    if (existingSub) {
      return res.status(400).json({ message: 'Sub-level with this name already exists' });
    }

    level.subLevels.push({
      name: name.trim(),
      description: description || null,
      displayOrder: displayOrder || 0
    });

    await level.save();

    res.status(201).json({
      message: 'Sub-level added successfully',
      subLevel: level.subLevels[level.subLevels.length - 1],
      level
    });
  } catch (error) {
    console.error('Add sub-level error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update a sub-level
// @route   PUT /api/marketplace/levels/:id/sublevels/:subLevelId
// @access  Private (Teacher)
const updateSubLevel = async (req, res) => {
  try {
    const { name, description, displayOrder, isActive } = req.body;

    const level = await Level.findById(req.params.id);
    if (!level) {
      return res.status(404).json({ message: 'Level not found' });
    }

    const subLevel = level.subLevels.id(req.params.subLevelId);
    if (!subLevel) {
      return res.status(404).json({ message: 'Sub-level not found' });
    }

    // Check for name conflict if name is being changed
    if (name && name.trim() !== subLevel.name) {
      const existingSub = level.subLevels.find(
        s => s._id.toString() !== req.params.subLevelId &&
             s.name.toLowerCase() === name.trim().toLowerCase()
      );
      if (existingSub) {
        return res.status(400).json({ message: 'Sub-level name already in use' });
      }
    }

    if (name !== undefined) subLevel.name = name.trim();
    if (description !== undefined) subLevel.description = description;
    if (displayOrder !== undefined) subLevel.displayOrder = displayOrder;
    if (isActive !== undefined) subLevel.isActive = isActive;

    await level.save();

    res.json({
      message: 'Sub-level updated successfully',
      subLevel,
      level
    });
  } catch (error) {
    console.error('Update sub-level error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Delete a sub-level
// @route   DELETE /api/marketplace/levels/:id/sublevels/:subLevelId
// @access  Private (Teacher)
const deleteSubLevel = async (req, res) => {
  try {
    const level = await Level.findById(req.params.id);
    if (!level) {
      return res.status(404).json({ message: 'Level not found' });
    }

    const subLevel = level.subLevels.id(req.params.subLevelId);
    if (!subLevel) {
      return res.status(404).json({ message: 'Sub-level not found' });
    }

    // Check if sub-level is in use by any exams
    const examCount = await Exam.countDocuments({ subLevel: req.params.subLevelId });
    if (examCount > 0) {
      return res.status(400).json({
        message: `Cannot delete sub-level. It is currently used by ${examCount} exam(s).`
      });
    }

    subLevel.remove();
    await level.save();

    res.json({ message: 'Sub-level deleted successfully', level });
  } catch (error) {
    console.error('Delete sub-level error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get personalized exam recommendations for student
// @route   GET /api/marketplace/recommendations
// @access  Private (Student)
const getPersonalizedRecommendations = async (req, res) => {
  try {
    const studentId = req.user._id;

    // Get student's exam history (completed exams)
    const completedResults = await Result.find({
      student: studentId,
      isCompleted: true
    }).populate('exam', 'title level targetAudience');

    // Extract levels from completed exams
    const completedExamIds = completedResults.map(r => r.exam?._id?.toString()).filter(Boolean);
    const completedLevels = [...new Set(completedResults
      .map(r => r.exam?.level?.toString() || r.exam?.targetAudience)
      .filter(Boolean))];

    // Build query for recommended exams
    let recommendationQuery = {
      isPubliclyListed: true,
      isLocked: false,
      _id: { $nin: completedExamIds }
    };

    // If student has history, prioritize similar levels
    if (completedLevels.length > 0) {
      // First try to find exams with same level/targetAudience
      const levelRecommendations = await Exam.find({
        ...recommendationQuery,
        $or: [
          { level: { $in: completedLevels } },
          { targetAudience: { $in: completedLevels } }
        ]
      })
        .populate('createdBy', 'fullName')
        .populate('level', 'name description')
        .limit(6);

      if (levelRecommendations.length >= 3) {
        return res.json({
          recommendations: levelRecommendations,
          basedOn: 'level_history',
          completedExams: completedResults.length
        });
      }
    }

    // Fallback: return newest exams
    const fallbackRecommendations = await Exam.find(recommendationQuery)
      .populate('createdBy', 'fullName')
      .populate('level', 'name description')
      .sort({ createdAt: -1 })
      .limit(6);

    res.json({
      recommendations: fallbackRecommendations,
      basedOn: completedLevels.length > 0 ? 'mixed' : 'newest',
      completedExams: completedResults.length
    });
  } catch (error) {
    console.error('Get personalized recommendations error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get student's exam completion status for marketplace exams
// @route   GET /api/marketplace/exam-completion-status
// @access  Private (Student)
const getExamCompletionStatus = async (req, res) => {
  try {
    const studentId = req.user._id;

    // Get all completed exams by this student
    const completedResults = await Result.find({
      student: studentId,
      isCompleted: true
    }).select('exam');

    const completedExamIds = completedResults.map(r => r.exam.toString());

    // Get approved exam requests
    const approvedRequests = await ExamRequest.find({
      student: studentId,
      status: 'approved'
    }).select('exam');

    // Filter out completed exams from approved list
    // Students should only see exams as "approved" if they haven't completed them yet
    const approvedExamIds = approvedRequests
      .map(r => r.exam.toString())
      .filter(examId => !completedExamIds.includes(examId));

    // Get pending retake requests
    const pendingRetakeRequests = await ExamRequest.find({
      student: studentId,
      status: 'pending',
      isRetake: true
    }).select('exam');

    const pendingRetakeExamIds = pendingRetakeRequests.map(r => r.exam.toString());

    res.json({
      completedExamIds,
      approvedExamIds,
      pendingRetakeExamIds,
      canRetake: completedExamIds // Exams that can be retaken
    });
  } catch (error) {
    console.error('Get exam completion status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get student results for teacher's marketplace exams
// @route   GET /api/marketplace/teacher/results
// @access  Private (Teacher)
const getTeacherMarketplaceResults = async (req, res) => {
  try {
    const { examId } = req.query;

    // Build query for exams created by this teacher (or their organization)
    const examQuery = {
      isPubliclyListed: true,
      $or: [
        { createdBy: req.user._id },
        { createdBy: req.orgAdminId },
        { createdBy: req.user.parentAdmin }
      ]
    };

    // If specific examId is provided, filter by it
    if (examId) {
      examQuery._id = examId;
    }

    // Get all marketplace exams by this teacher
    const exams = await Exam.find(examQuery).select('_id title');

    if (exams.length === 0) {
      return res.json({
        exams: [],
        results: [],
        summary: {
          totalExams: 0,
          totalResults: 0,
          averageScore: 0
        }
      });
    }

    const examIds = exams.map(e => e._id);

    // Get all results for these exams
    const results = await Result.find({
      exam: { $in: examIds },
      isCompleted: true
    })
      .populate('student', 'firstName lastName email studentId organization studentClass')
      .populate('exam', 'title description timeLimit')
      .sort({ endTime: -1 });

    // Format results with additional calculated fields
    const formattedResults = results.map(result => {
      const percentage = result.maxPossibleScore > 0
        ? Math.round((result.totalScore / result.maxPossibleScore) * 100)
        : 0;

      const timeTaken = result.endTime && result.startTime
        ? Math.round((new Date(result.endTime) - new Date(result.startTime)) / (1000 * 60))
        : 0;

      return {
        _id: result._id,
        student: {
          _id: result.student._id,
          fullName: result.student.firstName && result.student.lastName
            ? `${result.student.firstName} ${result.student.lastName}`
            : result.student.studentId || 'Unknown',
          firstName: result.student.firstName,
          lastName: result.student.lastName,
          studentId: result.student.studentId,
          email: result.student.email,
          organization: result.student.organization,
          studentClass: result.student.studentClass
        },
        exam: {
          _id: result.exam._id,
          title: result.exam.title,
          description: result.exam.description,
          timeLimit: result.exam.timeLimit
        },
        totalScore: result.totalScore || 0,
        maxPossibleScore: result.maxPossibleScore || 0,
        percentage,
        timeTaken,
        startTime: result.startTime,
        endTime: result.endTime,
        isCompleted: result.isCompleted,
        aiGradingStatus: result.aiGradingStatus
      };
    });

    // Calculate summary statistics
    const totalResults = formattedResults.length;
    const averageScore = totalResults > 0
      ? Math.round(formattedResults.reduce((sum, r) => sum + r.percentage, 0) / totalResults)
      : 0;

    // Group results by exam
    const resultsByExam = {};
    formattedResults.forEach(result => {
      const examId = result.exam._id.toString();
      if (!resultsByExam[examId]) {
        resultsByExam[examId] = {
          exam: result.exam,
          results: [],
          averageScore: 0,
          totalAttempts: 0
        };
      }
      resultsByExam[examId].results.push(result);
      resultsByExam[examId].totalAttempts++;
    });

    // Calculate average score per exam
    Object.keys(resultsByExam).forEach(examId => {
      const examData = resultsByExam[examId];
      examData.averageScore = examData.totalAttempts > 0
        ? Math.round(examData.results.reduce((sum, r) => sum + r.percentage, 0) / examData.totalAttempts)
        : 0;
    });

    res.json({
      exams,
      results: formattedResults,
      resultsByExam: Object.values(resultsByExam),
      summary: {
        totalExams: exams.length,
        totalResults,
        averageScore
      }
    });
  } catch (error) {
    console.error('Get teacher marketplace results error:', error);
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
  getExamByAccessCode,
  getStudentExamRequests,
  getAllLevels,
  createLevel,
  updateLevel,
  deleteLevel,
  addSubLevel,
  updateSubLevel,
  processExamApproval,
  deleteSubLevel,
  getPersonalizedRecommendations,
  getExamCompletionStatus,
  getTeacherMarketplaceResults
};
