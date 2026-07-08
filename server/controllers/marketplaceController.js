const Exam = require('../models/Exam');
const ExamRequest = require('../models/ExamRequest');
const SharedExam = require('../models/SharedExam');
const User = require('../models/User');
const Result = require('../models/Result');
const Subscription = require('../models/Subscription');
const emailService = require('../utils/emailService');
const { subscriptionCoversExam } = require('../utils/subLevelAccess');

// Determine whether an authenticated student already has subscription-based
// access to a given exam — either an exam-scoped subscription bought for
// this exam specifically, or an active subscription for the exam's level
// (with sub-level matching). Free exams and unauthenticated requests are
// handled separately by callers — this only covers the "subscription"
// accessType case.
const hasActiveSubscriptionForExam = async (userId, exam) => {
  if (!userId) return false;

  const examSubscription = await Subscription.getActiveSubscriptionForExam(userId, exam._id);
  if (examSubscription && examSubscription.isValid()) return true;

  if (!exam.level) return false;
  const subscription = await Subscription.getActiveSubscriptionForLevel(userId, exam.level);
  if (!subscription || !subscription.isValid()) return false;
  return subscriptionCoversExam(subscription, exam);
};

// @desc    Get all marketplace exams
// @route   GET /api/marketplace/exams
// @access  Public
const getMarketplaceExams = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    const exams = await Exam.find({ isPubliclyListed: true, isLocked: false })
      .populate('createdBy', 'fullName')
      .populate('level', 'name description subLevels')
      .select('title description timeLimit publicPrice retakePrice publicDescription targetAudience level subLevel createdAt createdBy sections.name sections.questions sections.questionCount isPubliclyListed isLocked status accessType')
      .sort({ accessType: 1, createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean();

    // Compute totalQuestions from sections.questions array length (ObjectId refs, not populated)
    const examsWithCounts = exams.map(exam => ({
      ...exam,
      totalQuestions: exam.sections?.reduce((sum, s) => sum + (s.questions?.length || s.questionCount || 0), 0) || 0,
      sections: exam.sections?.map(s => ({
        name: s.name,
        questionCount: s.questions?.length || s.questionCount || 0
      }))
    }));

    res.json(examsWithCounts);
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
      .select('title description timeLimit publicPrice retakePrice publicDescription createdAt createdBy sections accessType level subLevel');

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

  // Prefer the stored student reference (ObjectId) over email lookup
  if (request.student) {
    studentUser = await User.findById(request.student);
  }

  if (!studentUser && request.userInfo.email) {
    studentUser = await User.findOne({ email: (request.userInfo.email || '').toLowerCase().trim() });
  }

  if (!studentUser) {
    // Create a new student account
    tempPassword = Math.random().toString(36).slice(-8);
    const nameParts = (request.userInfo.name || 'Student User').split(' ');
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

  // If this is a retake approval, delete the previous completed result so the student can retake
  if (request.isRetake) {
    const deletedResult = await Result.findOneAndDelete({
      student: studentUser._id,
      exam: request.exam,
      isCompleted: true
    });
    if (deletedResult) {
      console.log(`✅ Retake approval - Deleted previous completed result: ${deletedResult._id}, student ${studentUser._id}, exam ${request.exam}`);
    } else {
      console.log(`⚠️ Retake approval - No completed result found to delete: student ${studentUser._id}, exam ${request.exam}`);
    }
  }

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
      name = req.user.fullName || `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || 'User';
      phone = req.user.phone || '';
      email = req.user.email || '';
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

    // Ensure name and email are defined before using them
    if (!name) {
      name = 'User';
    }
    if (!email) {
      email = '';
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
          // User has completed the exam, allow re-request by updating the existing request.
          // A completed result already proves this is a retake regardless of
          // whether the caller's isRetake flag was set (some callers, like the
          // dashboard's quick "Retake" button, don't send it) — force it true
          // so a later rejection correctly remembers this as a retake.
          existingRequest.status = 'pending';
          existingRequest.isRetake = true;
          existingRequest.processedAt = null;
          existingRequest.shareToken = null;
          existingRequest.sharedExam = null;
          existingRequest.paymentStatus = 'pending';
          await existingRequest.save();

          console.log(`Re-request allowed for completed exam: ${exam._id}, student: ${isAuthenticated ? req.user._id : email}, isRetake: ${isRetake}`);

          // A completed exam being re-requested is always a retake, even for
          // free exams — free exams grant one attempt to non-subscribers;
          // retaking (any exam) requires an active subscription covering
          // this exam's level/sub-level.
          const canAutoApprove = isAuthenticated && await hasActiveSubscriptionForExam(req.user._id, exam);

          if (canAutoApprove) {
            console.log(`Auto-approving retake (existing request path): ${exam._id}, student: ${isAuthenticated ? req.user._id : email}`);
            const approvalResult = await processExamApproval(existingRequest, false);
            return res.status(201).json({
              message: isRetake ? 'Retake approved automatically!' : 'Request approved automatically!',
              requestId: existingRequest._id,
              shareToken: approvalResult.shareToken,
              accessCode: approvalResult.accessCode,
              autoApproved: true
            });
          }

          // Subscription required — do not fall back to the legacy pay-per-exam
          // pending-review flow for subscription-gated exams.
          existingRequest.status = 'rejected';
          existingRequest.processedAt = new Date();
          await existingRequest.save();

          return res.status(403).json({
            message: 'This exam requires an active subscription for your level. Subscribe to access it.',
            requiresSubscription: true
          });
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
      // A rejected retake request still needs an active subscription to
      // re-approve, even for free exams — only a non-retake (first-time)
      // rejection can fall back to the free-exam auto-approve.
      const canAutoApprove = rejectedRequest.isRetake
        ? (isAuthenticated && await hasActiveSubscriptionForExam(req.user._id, exam))
        : (exam.accessType === 'free' ||
          (isAuthenticated && await hasActiveSubscriptionForExam(req.user._id, exam)));

      if (!canAutoApprove) {
        return res.status(403).json({
          message: 'This exam requires an active subscription for your level. Subscribe to access it.',
          requiresSubscription: true
        });
      }

      // Update the rejected request and approve it now that access is confirmed
      rejectedRequest.status = 'pending';
      rejectedRequest.processedAt = null;
      rejectedRequest.shareToken = null;
      rejectedRequest.sharedExam = null;
      rejectedRequest.paymentStatus = 'pending';
      await rejectedRequest.save();

      console.log(`Re-request approved for exam: ${exam._id}, student: ${isAuthenticated ? req.user._id : email}`);
      const approvalResult = await processExamApproval(rejectedRequest, false);
      return res.status(201).json({
        message: 'Request approved automatically!',
        requestId: rejectedRequest._id,
        shareToken: approvalResult.shareToken,
        accessCode: approvalResult.accessCode,
        autoApproved: true
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

    // No ExamRequest exists yet for this student/exam, but they may have
    // already completed it directly (e.g. via the level exam bank, without
    // ever going through this request flow) — that still counts as a retake
    // attempt, so free exams don't get an unlimited self-service loophole.
    const alreadyCompletedDirectly = isAuthenticated && !!(await Result.findOne({
      student: req.user._id,
      exam: exam._id,
      isCompleted: true
    }));

    // Free exams always auto-approve on a genuine first attempt; subscription
    // exams (and any retake, including of a free exam) require an active
    // subscription covering this exam's level/sub-level. Unauthenticated
    // (guest) requests can never satisfy a subscription requirement.
    const canAutoApprove = alreadyCompletedDirectly
      ? (isAuthenticated && await hasActiveSubscriptionForExam(req.user._id, exam))
      : (exam.accessType === 'free' ||
        (isAuthenticated && await hasActiveSubscriptionForExam(req.user._id, exam)));

    if (!canAutoApprove) {
      return res.status(403).json({
        message: isAuthenticated
          ? 'This exam requires an active subscription for your level. Subscribe to access it.'
          : 'This exam requires an active subscription. Please log in and subscribe to access it.',
        requiresSubscription: true
      });
    }

    // Calculate the amount - use retakePrice for retakes, publicPrice for initial requests
    let amount = isRetake ? (exam.retakePrice || 0) : (exam.publicPrice || 0);

    // Create the request
    const requestData = {
      exam: exam._id,
      examTitle: exam.title,
      teacher: exam.createdBy,
      userInfo: {
        name: (name || 'User').trim(),
        email: (email || '').trim(),
        phone: phone?.trim() || null
      },
      amount: amount,
      isRetake: isRetake || alreadyCompletedDirectly
    };

    // Add student reference if authenticated
    if (isAuthenticated) {
      requestData.student = req.user._id;
    }

    const examRequest = await ExamRequest.create(requestData);

    console.log(`Auto-approving exam request: ${exam._id}, isRetake: ${isRetake}, accessType: ${exam.accessType}`);

    // Process the approval automatically
    const approvalResult = await processExamApproval(examRequest, false);

    return res.status(201).json({
      message: isRetake ? 'Retake request approved automatically!' : 'Request approved automatically!',
      requestId: examRequest._id,
      shareToken: approvalResult.shareToken,
      accessCode: approvalResult.accessCode,
      autoApproved: true
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
    const { isPubliclyListed, publicPrice, retakePrice, publicDescription, targetAudience, levelId, newLevelName, subLevel } = req.body;

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
    if (retakePrice !== undefined) {
      exam.retakePrice = parseFloat(retakePrice);
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
      const level = await Level.findOrCreate((newLevelName || '').trim(), req.user._id);
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
        .select('title description timeLimit publicPrice retakePrice publicDescription targetAudience level subLevel createdAt createdBy sections.name sections.questions sections.questionCount accessType')
        .populate('createdBy', 'fullName')
        .populate('level', 'name description')
        .limit(6)
        .lean();

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
      .select('title description timeLimit publicPrice retakePrice publicDescription targetAudience level subLevel createdAt createdBy sections.name sections.questions sections.questionCount')
      .populate('createdBy', 'fullName')
      .populate('level', 'name description')
      .sort({ createdAt: -1 })
      .limit(6)
      .lean();

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

    // Run all 3 queries in parallel for speed
    const [completedResults, approvedRequests, pendingRetakeRequests] = await Promise.all([
      Result.find({ student: studentId, isCompleted: true }).select('exam').lean(),
      ExamRequest.find({ student: studentId, status: 'approved' }).select('exam').lean(),
      ExamRequest.find({ student: studentId, status: 'pending', isRetake: true }).select('exam').lean()
    ]);

    const completedExamIds = completedResults.map(r => r.exam.toString());

    // Filter out completed exams from approved list
    // Students should only see exams as "approved" if they haven't completed them yet
    const approvedExamIds = approvedRequests
      .map(r => r.exam.toString())
      .filter(examId => !completedExamIds.includes(examId));

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
