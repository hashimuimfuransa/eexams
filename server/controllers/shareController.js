const Exam = require('../models/Exam');
const SharedExam = require('../models/SharedExam');
const Result = require('../models/Result');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const jwt = require('jsonwebtoken');

// Generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d'
  });
};
const StudentList = require('../models/StudentList');
const ExamRequest = require('../models/ExamRequest');

// @desc    Create a share link for an exam
// @route   POST /api/share/exam/:examId
// @access  Private (Teacher)
const createShare = async (req, res) => {
  try {
    const { examId } = req.params;
    const {
      shareType,
      publicAccess,
      requirePassword,
      password,
      maxStudents,
      expiresAt,
      allowMultipleAttempts,
      showResults,
      invitedEmails,
      studentListId
    } = req.body;

    // Check if exam exists and belongs to the teacher
    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({ message: 'Exam not found' });
    }

    // Check if teacher owns this exam
    if (exam.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to share this exam' });
    }

    // Generate unique share token
    let shareToken = SharedExam.generateShareToken();
    let existingShare = await SharedExam.findOne({ shareToken });

    // Ensure unique token
    while (existingShare) {
      shareToken = SharedExam.generateShareToken();
      existingShare = await SharedExam.findOne({ shareToken });
    }

    // Create share settings
    const settings = {
      publicAccess: publicAccess !== undefined ? publicAccess : true,
      requirePassword: requirePassword || false,
      password: requirePassword ? password : null,
      maxStudents: maxStudents || null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      allowMultipleAttempts: allowMultipleAttempts !== undefined ? allowMultipleAttempts : false,
      showResults: showResults !== undefined ? showResults : true
    };

    // Prepare invited emails array
    let invitedEmailsList = [];
    let studentsFromList = [];

    // If studentListId is provided, load students from the saved list
    if (studentListId) {
      const studentList = await StudentList.findOne({
        _id: studentListId,
        teacher: req.user._id,
        isActive: true
      });

      if (!studentList) {
        return res.status(404).json({ message: 'Student list not found' });
      }

      // Add students from the list
      studentsFromList = studentList.students.map(student => ({
        name: student.name,
        email: student.email,
        accessMethod: 'link',
        firstAccessedAt: null
      }));

      invitedEmailsList = studentList.students.map(student => ({
        email: student.email.toLowerCase().trim(),
        inviteToken: SharedExam.generateShareToken()
      }));
    } else if (invitedEmails) {
      // Use provided invited emails
      invitedEmailsList = invitedEmails.map(email => ({
        email: email.toLowerCase().trim(),
        inviteToken: SharedExam.generateShareToken()
      }));
    }

    // Create shared exam
    const sharedExam = await SharedExam.create({
      exam: examId,
      sharedBy: req.user._id,
      shareToken,
      shareType: shareType || 'link',
      settings,
      invitedEmails: invitedEmailsList,
      students: studentsFromList,
      isActive: true
    });

    // Generate share URL
    const shareUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/exam/${shareToken}`;

    // Log activity
    await ActivityLog.logActivity({
      user: req.user._id,
      action: 'share_exam',
      details: {
        examId,
        sharedExamId: sharedExam._id,
        shareType: shareType || 'link',
        shareToken
      }
    });

    res.status(201).json({
      success: true,
      message: 'Exam shared successfully',
      shareData: {
        shareId: sharedExam._id,
        shareToken: sharedExam.shareToken,
        shareUrl,
        shareType: sharedExam.shareType,
        settings: sharedExam.settings,
        invitedCount: invitedEmailsList.length
      }
    });

  } catch (error) {
    console.error('Create share error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get all shares for an exam
// @route   GET /api/share/exam/:examId/shares
// @access  Private (Teacher)
const getExamShares = async (req, res) => {
  try {
    const { examId } = req.params;

    // Check if exam exists and belongs to teacher
    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({ message: 'Exam not found' });
    }

    if (exam.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const shares = await SharedExam.find({ exam: examId })
      .populate('students.student', 'firstName lastName email')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      shares: shares.map(share => ({
        id: share._id,
        shareToken: share.shareToken,
        shareType: share.shareType,
        isActive: share.isActive,
        settings: share.settings,
        stats: share.stats,
        studentsCount: share.students.length,
        invitedCount: share.invitedEmails.length,
        createdAt: share.createdAt,
        shareUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/exam/${share.shareToken}`
      }))
    });

  } catch (error) {
    console.error('Get exam shares error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get shared exam details (for public access)
// @route   GET /api/share/:shareToken
// @access  Public
const getSharedExam = async (req, res) => {
  try {
    const { shareToken } = req.params;

    const sharedExam = await SharedExam.findOne({ shareToken })
      .populate({
        path: 'exam',
        select: 'title description timeLimit totalPoints passingScore questions fileUrl sections',
        populate: {
          path: 'sections.questions',
          model: 'Question'
        }
      })
      .populate('sharedBy', 'firstName lastName email');

    if (!sharedExam) {
      return res.status(404).json({ message: 'Share link not found' });
    }

    // Ensure exam has all three sections (A, B, C) even if empty
    if (sharedExam.exam) {
      const requiredSections = ['A', 'B', 'C'];
      const existingSections = sharedExam.exam.sections || [];
      const existingSectionNames = existingSections.map(s => s.name);

      // Add missing sections
      requiredSections.forEach(sectionName => {
        if (!existingSectionNames.includes(sectionName)) {
          const descriptions = {
            'A': 'Multiple Choice Questions',
            'B': 'Short Answer Questions',
            'C': 'Essay Questions'
          };
          sharedExam.exam.sections.push({
            name: sectionName,
            description: descriptions[sectionName] || `Section ${sectionName}`,
            questions: []
          });
          console.log(`Added missing section ${sectionName} to exam in getSharedExam`);
        }
      });
    }

    console.log('Shared exam found:', sharedExam.shareToken);
    console.log('Exam sections:', sharedExam.exam?.sections);
    
    if (sharedExam.exam?.sections) {
      sharedExam.exam.sections.forEach((section, idx) => {
        console.log(`Section ${idx} (${section.name}): ${section.questions?.length || 0} questions`);
      });
    }

    if (!sharedExam.isActive) {
      return res.status(403).json({ message: 'This share link has been deactivated' });
    }

    if (sharedExam.isExpired()) {
      return res.status(403).json({ message: 'This share link has expired' });
    }

    // Check if full, but allow if students have been removed
    if (sharedExam.isFull()) {
      console.log('Share is full:', {
        studentsLength: sharedExam.students.length,
        maxStudents: sharedExam.settings.maxStudents,
        students: sharedExam.students
      });
      return res.status(403).json({ message: 'Maximum number of students reached' });
    }

    if (!sharedExam.isScheduled()) {
      if (sharedExam.isFuture()) {
        const startTime = sharedExam.settings.scheduledStart;
        return res.status(403).json({
          message: 'This exam is scheduled for the future',
          scheduledStart: startTime
        });
      } else {
        return res.status(403).json({ message: 'This exam is no longer available' });
      }
    }

    // Increment view count
    sharedExam.incrementViews();
    await sharedExam.save();

    // Return exam details without sensitive info
    // Sanitize question data to remove correct answers
    const sanitizedSections = (sharedExam.exam.sections || []).map(section => ({
      ...section,
      questions: (section.questions || []).map(question => {
        const sanitizedQuestion = { ...question };
        // Remove correctOrder from itemsToOrder
        if (sanitizedQuestion.itemsToOrder) {
          sanitizedQuestion.itemsToOrder = {
            items: sanitizedQuestion.itemsToOrder.items || []
          };
        }
        // Remove correctPairs from matchingPairs
        if (sanitizedQuestion.matchingPairs) {
          sanitizedQuestion.matchingPairs = {
            leftColumn: sanitizedQuestion.matchingPairs.leftColumn || [],
            rightColumn: sanitizedQuestion.matchingPairs.rightColumn || []
          };
        }
        // Remove correctPlacements from dragDropData
        if (sanitizedQuestion.dragDropData) {
          sanitizedQuestion.dragDropData = {
            dropZones: sanitizedQuestion.dragDropData.dropZones || [],
            draggableItems: sanitizedQuestion.dragDropData.draggableItems || []
          };
        }
        // Remove correctAnswer for all question types
        delete sanitizedQuestion.correctAnswer;
        return sanitizedQuestion;
      })
    }));

    res.json({
      success: true,
      shareData: {
        shareToken: sharedExam.shareToken,
        shareType: sharedExam.shareType,
        settings: {
          publicAccess: sharedExam.settings.publicAccess,
          requirePassword: sharedExam.settings.requirePassword,
          maxStudents: sharedExam.settings.maxStudents,
          allowMultipleAttempts: sharedExam.settings.allowMultipleAttempts,
          showResults: sharedExam.settings.showResults
        },
        stats: {
          totalViews: sharedExam.stats.totalViews,
          totalStarted: sharedExam.stats.totalStarted,
          totalCompleted: sharedExam.stats.totalCompleted
        }
      },
      exam: {
        id: sharedExam.exam._id,
        title: sharedExam.exam.title,
        description: sharedExam.exam.description,
        timeLimit: sharedExam.exam.timeLimit,
        totalPoints: sharedExam.exam.totalPoints,
        passingScore: sharedExam.exam.passingScore,
        questionCount: sharedExam.exam.questions?.length || 0,
        sections: sanitizedSections,
        hasFile: !!sharedExam.exam.fileUrl
      },
      sharedBy: {
        name: `${sharedExam.sharedBy.firstName} ${sharedExam.sharedBy.lastName}`,
        email: sharedExam.sharedBy.email
      }
    });

  } catch (error) {
    console.error('Get shared exam error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Verify password for protected share
// @route   POST /api/share/:shareToken/verify-password
// @access  Public
const verifySharePassword = async (req, res) => {
  try {
    const { shareToken } = req.params;
    let { email, name, password, inviteToken, isPrivate } = req.body;

    console.log('Join request received:');
    console.log('  isPrivate from request:', isPrivate);
    console.log('  email:', email);
    console.log('  name:', name);

    const sharedExam = await SharedExam.findOne({ shareToken });

    if (!sharedExam) {
      return res.status(404).json({ message: 'Share link not found' });
    }

    if (!sharedExam.isActive || sharedExam.isExpired()) {
      return res.status(403).json({ message: 'Share link is not active' });
    }

    if (sharedExam.settings.requirePassword && sharedExam.settings.password !== password) {
      return res.status(401).json({ message: 'Incorrect password' });
    }

    res.json({ success: true, message: 'Password verified' });

  } catch (error) {
    console.error('Verify share password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Join shared exam as a student
// @route   POST /api/share/:shareToken/join
// @access  Public
const joinSharedExam = async (req, res) => {
  try {
    const { shareToken } = req.params;
    let { email, name, password, inviteToken, isPrivate } = req.body;

    console.log('Join request - isPrivate from body:', isPrivate);
    console.log('Join request - email:', email);
    console.log('Join request - name:', name);

    const sharedExam = await SharedExam.findOne({ shareToken })
      .populate({
        path: 'exam',
        select: 'title description timeLimit totalPoints passingScore questions sections assignedTo',
        populate: {
          path: 'sections.questions',
          model: 'Question'
        }
      });

    // Ensure exam has all three sections (A, B, C) even if empty
    if (sharedExam && sharedExam.exam) {
      const requiredSections = ['A', 'B', 'C'];
      const existingSections = sharedExam.exam.sections || [];
      const existingSectionNames = existingSections.map(s => s.name);

      // Add missing sections
      requiredSections.forEach(sectionName => {
        if (!existingSectionNames.includes(sectionName)) {
          const descriptions = {
            'A': 'Multiple Choice Questions',
            'B': 'Short Answer Questions',
            'C': 'Essay Questions'
          };
          sharedExam.exam.sections.push({
            name: sectionName,
            description: descriptions[sectionName] || `Section ${sectionName}`,
            questions: []
          });
          console.log(`Added missing section ${sectionName} to exam`);
        }
      });
    }

    if (!sharedExam) {
      return res.status(404).json({ message: 'Share link not found' });
    }

    console.log('Join exam - Shared exam found:', sharedExam.shareToken, 'isPrivate:', isPrivate);
    console.log('Join exam - Exam sections:', sharedExam.exam?.sections);
    console.log('Join exam - Exam sections count:', sharedExam.exam?.sections?.length || 0);
    if (sharedExam.exam?.sections) {
      sharedExam.exam.sections.forEach((section, idx) => {
        console.log(`  Section ${idx} (${section.name}): ${section.questions?.length || 0} questions, description: ${section.description || 'N/A'}`);
      });
    } else {
      console.log('  No sections found on exam');
    }

    if (!sharedExam.isActive || sharedExam.isExpired()) {
      return res.status(403).json({ message: 'Share link is not active' });
    }

    if (sharedExam.isFull()) {
      return res.status(403).json({ message: 'Maximum number of students reached' });
    }

    // Check password if required
    if (sharedExam.settings.requirePassword && sharedExam.settings.password !== password) {
      return res.status(401).json({ message: 'Incorrect password' });
    }

    // Email invitation check removed - allow all users to join shared exams

    // Check if full, but allow if students have been removed
    if (sharedExam.isFull()) {
      console.log('Join: Share is full:', {
        studentsLength: sharedExam.students.length,
        maxStudents: sharedExam.settings.maxStudents,
        students: sharedExam.students
      });
      return res.status(403).json({ message: 'Maximum number of students reached' });
    }

    // Check password if required
    if (inviteToken) {
      const invitedEmail = sharedExam.invitedEmails.find(
        inv => inv.inviteToken === inviteToken
      );
      if (!invitedEmail) {
        return res.status(403).json({ message: 'Invalid invitation' });
      }
      // Check if already joined
      if (invitedEmail.hasJoined) {
        return res.status(400).json({ message: 'You have already joined this exam' });
      }
    }

    // For public links without email/name, generate temporary ones and treat as guest access
    if (!email || !name) {
      const tempId = Math.random().toString(36).substring(2, 11);
      email = `student-${tempId}@exam.local`;
      name = `Student ${tempId}`;
      isPrivate = false; // Override to false for guest access
      console.log('Guest access detected, generated temp email:', email);
    }

    // For private mode with email/name provided, validate they are not empty
    if (isPrivate && (!email || !name)) {
      return res.status(400).json({ message: 'Email and name are required for private exam access' });
    }

    // Normalize email
    email = email.toLowerCase().trim();

    // Check if already joined and has an active session (prevents simultaneous access)
    const existingStudent = sharedExam.students.find(
      s => s.email === email
    );

    if (existingStudent) {
      // Check if student has an active session (currently taking the exam)
      if (existingStudent.isActiveSession) {
        // Check if the session has expired (more than 30 minutes since last activity)
        const sessionTimeout = 30 * 60 * 1000; // 30 minutes
        const now = Date.now();
        const lastActivity = existingStudent.lastActivity || existingStudent.joinedAt;
        
        if (now - lastActivity < sessionTimeout) {
          return res.status(409).json({
            message: 'You are already taking this exam in another session. Please complete that session first or wait for it to expire.',
            hasActiveSession: true,
            sessionExpiresAt: lastActivity + sessionTimeout
          });
        }
        // Session expired, allow re-joining
        existingStudent.isActiveSession = false;
      }

      // If multiple attempts not allowed and already completed
      if (!sharedExam.settings.allowMultipleAttempts && existingStudent.hasCompleted) {
        return res.status(400).json({
          message: 'You have already completed this exam',
          hasCompleted: true,
          resultId: existingStudent.result
        });
      }

      // For private mode, always allow rejoining regardless of completion status
      // (teacher can reset students to allow retakes)
      if (isPrivate) {
        console.log('Private mode: allowing student to rejoin exam');
        // Reset completion status for private mode joins
        existingStudent.hasCompleted = false;
        existingStudent.result = null;
        existingStudent.completedAt = null;
        await sharedExam.save();
      }

      // Check if exam is locked for this student
      if (existingStudent.isLocked) {
        return res.status(403).json({
          message: 'This exam has been locked. Please contact your teacher to unlock it.',
          isLocked: true
        });
      }

      // Mark as active session and update last activity
      existingStudent.isActiveSession = true;
      existingStudent.lastActivity = Date.now();
      await sharedExam.save();

      // Sanitize question data to remove correct answers before returning
      const sanitizedSections = (sharedExam.exam.sections || []).map(section => ({
        ...section,
        questions: (section.questions || []).map(question => {
          const sanitizedQuestion = { ...question };
          // Remove correctOrder from itemsToOrder
          if (sanitizedQuestion.itemsToOrder) {
            sanitizedQuestion.itemsToOrder = {
              items: sanitizedQuestion.itemsToOrder.items || []
            };
          }
          // Remove correctPairs from matchingPairs
          if (sanitizedQuestion.matchingPairs) {
            sanitizedQuestion.matchingPairs = {
              leftColumn: sanitizedQuestion.matchingPairs.leftColumn || [],
              rightColumn: sanitizedQuestion.matchingPairs.rightColumn || []
            };
          }
          // Remove correctPlacements from dragDropData
          if (sanitizedQuestion.dragDropData) {
            sanitizedQuestion.dragDropData = {
              dropZones: sanitizedQuestion.dragDropData.dropZones || [],
              draggableItems: sanitizedQuestion.dragDropData.draggableItems || []
            };
          }
          // Remove correctAnswer for all question types
          delete sanitizedQuestion.correctAnswer;
          return sanitizedQuestion;
        })
      }));

      // Return existing student info
      return res.json({
        success: true,
        message: 'Welcome back!',
        isNew: false,
        studentId: existingStudent._id,
        exam: {
          _id: sharedExam.exam._id,
          ...sharedExam.exam,
          sections: sanitizedSections
        },
        settings: sharedExam.settings,
        token: null,
        user: null
      });
    }

    // Create new student user if doesn't exist
    let studentUser = await User.findOne({ email });
    let isNewUser = false;
    let tempPassword = null;

    if (!studentUser) {
      // Create a temporary student account
      tempPassword = Math.random().toString(36).slice(-8);
      const nameParts = name.split(' ');
      const firstName = nameParts[0] || 'Student';
      const lastName = nameParts.slice(1).join(' ') || 'User';
      
      studentUser = await User.create({
        email: email.toLowerCase().trim(),
        password: tempPassword,
        firstName,
        lastName,
        role: 'student',
        userType: 'individual',
        createdBy: sharedExam.sharedBy
      });
      isNewUser = true;
    } else {
      // For existing users, retrieve their password if it's a temporary account
      // This is for guest users who are rejoining
      if (!isPrivate) {
        tempPassword = studentUser.password;
      }
    }

    // Add student to share
    const studentData = {
      studentId: studentUser._id,
      email: email.toLowerCase().trim(),
      name: name,
      accessMethod: inviteToken ? 'invite' : 'link',
      isActiveSession: true,
      lastActivity: Date.now()
    };

    const { isNew } = sharedExam.addStudent(studentData);

    // Update invite status if using invite token
    if (inviteToken) {
      const invite = sharedExam.invitedEmails.find(inv => inv.inviteToken === inviteToken);
      if (invite) {
        invite.hasJoined = true;
        invite.student = studentUser._id;
        invite.joinedAt = new Date();
      }
    }

    await sharedExam.save();

    // Increment started count
    sharedExam.incrementStarted();
    await sharedExam.save();

    // Log activity
    await ActivityLog.logActivity({
      user: sharedExam.sharedBy,
      action: 'student_joined_shared_exam',
      details: {
        examId: sharedExam.exam._id,
        sharedExamId: sharedExam._id,
        studentId: studentUser._id,
        studentEmail: email
      }
    });

    // Sanitize question data to remove correct answers before returning
    const sanitizedSections = (sharedExam.exam.sections || []).map(section => ({
      ...section,
      questions: (section.questions || []).map(question => {
        const sanitizedQuestion = { ...question };
        // Remove correctOrder from itemsToOrder
        if (sanitizedQuestion.itemsToOrder) {
          sanitizedQuestion.itemsToOrder = {
            items: sanitizedQuestion.itemsToOrder.items || []
          };
        }
        // Remove correctPairs from matchingPairs
        if (sanitizedQuestion.matchingPairs) {
          sanitizedQuestion.matchingPairs = {
            leftColumn: sanitizedQuestion.matchingPairs.leftColumn || [],
            rightColumn: sanitizedQuestion.matchingPairs.rightColumn || []
          };
        }
        // Remove correctPlacements from dragDropData
        if (sanitizedQuestion.dragDropData) {
          sanitizedQuestion.dragDropData = {
            dropZones: sanitizedQuestion.dragDropData.dropZones || [],
            draggableItems: sanitizedQuestion.dragDropData.draggableItems || []
          };
        }
        // Remove correctAnswer for all question types
        delete sanitizedQuestion.correctAnswer;
        return sanitizedQuestion;
      })
    }));

    // Generate token for guest users (public access without authentication)
    let token = null;
    if (!isPrivate) {
      token = generateToken(studentUser._id);
    }

    // Create exam session (Result) for the student so ExamInterface can load it
    const Result = require('../models/Result');
    let resultId = null;

    try {
      // Check if there's an existing incomplete result for this student and exam
      const existingResult = await Result.findOne({
        student: studentUser._id,
        exam: sharedExam.exam._id,
        isCompleted: false
      });

      if (!existingResult) {
        // Calculate max possible score
        const maxPossibleScore = sharedExam.exam.sections?.reduce((total, section) => {
          const sectionQuestions = section.questions || [];
          return total + sectionQuestions.reduce((sectionTotal, q) => sectionTotal + (q.points || 1), 0);
        }, 0) || 0;

        // Create new result
        const result = await Result.create({
          student: studentUser._id,
          exam: sharedExam.exam._id,
          startTime: Date.now(),
          maxPossibleScore,
          answers: [],
          isCompleted: false
        });
        resultId = result._id;

        // Store resultId in shared exam students
        const studentIndex = sharedExam.students.findIndex(s => 
          s.studentId && s.studentId.toString() === studentUser._id.toString()
        );
        if (studentIndex !== -1) {
          sharedExam.students[studentIndex].result = resultId;
        }
        await sharedExam.save();

        console.log('Created exam session (Result) for student:', resultId);
      } else {
        resultId = existingResult._id;
        console.log('Using existing exam session (Result):', resultId);
      }
    } catch (resultError) {
      console.error('Error creating exam session:', resultError);
      // Continue without result - frontend will handle error
    }

    res.status(201).json({
      success: true,
      message: 'Successfully joined the exam',
      isNew: true,
      studentId: studentUser._id,
      resultId: resultId, // Include resultId for ExamInterface
      exam: {
        _id: sharedExam.exam._id,
        ...sharedExam.exam,
        sections: sanitizedSections
      },
      settings: sharedExam.settings,
      token: token,
      user: token ? {
        email: studentUser.email,
        tempPassword: tempPassword,
        _id: studentUser._id
      } : null
    });

  } catch (error) {
    console.error('Join shared exam error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update share settings
// @route   PUT /api/share/:shareId
// @access  Private (Teacher)
const updateShare = async (req, res) => {
  try {
    const { shareId } = req.params;
    const { isActive, settings } = req.body;

    const sharedExam = await SharedExam.findById(shareId);

    if (!sharedExam) {
      return res.status(404).json({ message: 'Share not found' });
    }

    // Check ownership
    if (sharedExam.sharedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Update fields
    if (isActive !== undefined) sharedExam.isActive = isActive;
    if (settings) {
      Object.assign(sharedExam.settings, settings);
    }

    await sharedExam.save();

    res.json({
      success: true,
      message: 'Share updated successfully',
      share: sharedExam
    });

  } catch (error) {
    console.error('Update share error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Delete a share
// @route   DELETE /api/share/:shareId
// @access  Private (Teacher)
const deleteShare = async (req, res) => {
  try {
    const { shareId } = req.params;

    const sharedExam = await SharedExam.findById(shareId);

    if (!sharedExam) {
      return res.status(404).json({ message: 'Share not found' });
    }

    if (sharedExam.sharedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    await sharedExam.deleteOne();

    res.json({
      success: true,
      message: 'Share deleted successfully'
    });

  } catch (error) {
    console.error('Delete share error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get all shares created by a teacher
// @route   GET /api/share/my-shares
// @access  Private (Teacher)
const getMyShares = async (req, res) => {
  try {
    const shares = await SharedExam.find({ sharedBy: req.user._id })
      .populate('exam', 'title description')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      shares: shares.map(share => ({
        id: share._id,
        exam: share.exam,
        shareToken: share.shareToken,
        shareType: share.shareType,
        isActive: share.isActive,
        settings: share.settings,
        stats: share.stats,
        studentsCount: share.students.length,
        createdAt: share.createdAt,
        shareUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/exam/${share.shareToken}`
      }))
    });

  } catch (error) {
    console.error('Get my shares error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get share statistics
// @route   GET /api/share/:shareId/stats
// @access  Private (Teacher)
const getShareStats = async (req, res) => {
  try {
    const { shareId } = req.params;

    const sharedExam = await SharedExam.findById(shareId)
      .populate('students.student', 'firstName lastName email')
      .populate('students.result', 'totalScore maxPossibleScore endTime');

    if (!sharedExam) {
      return res.status(404).json({ message: 'Share not found' });
    }

    if (sharedExam.sharedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Calculate additional stats
    const completedCount = sharedExam.students.filter(s => s.hasCompleted).length;
    const inProgressCount = sharedExam.students.filter(s => !s.hasCompleted).length;

    // Average score calculation
    let totalScore = 0;
    let totalMaxScore = 0;
    sharedExam.students.forEach(s => {
      if (s.result) {
        totalScore += s.result.totalScore || 0;
        totalMaxScore += s.result.maxPossibleScore || 1;
      }
    });
    const averagePercentage = totalMaxScore > 0 ? (totalScore / totalMaxScore) * 100 : 0;

    res.json({
      success: true,
      stats: {
        totalViews: sharedExam.stats.totalViews,
        totalStarted: sharedExam.stats.totalStarted,
        totalCompleted: sharedExam.stats.totalCompleted,
        completedCount,
        inProgressCount,
        averagePercentage: Math.round(averagePercentage * 100) / 100,
        students: sharedExam.students.map(s => ({
          id: s._id,
          name: s.name || (s.student ? `${s.student.firstName} ${s.student.lastName}` : 'Unknown'),
          email: s.email,
          hasCompleted: s.hasCompleted,
          score: s.result ? {
            total: s.result.totalScore,
            max: s.result.maxPossibleScore,
            percentage: s.result.maxPossibleScore > 0
              ? Math.round((s.result.totalScore / s.result.maxPossibleScore) * 100 * 100) / 100
              : 0
          } : null,
          completedAt: s.completedAt,
          firstAccessedAt: s.firstAccessedAt
        }))
      }
    });

  } catch (error) {
    console.error('Get share stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get all shared exams for a teacher (including orphaned ones)
// @route   GET /api/share/all
// @access  Private (Teacher)
const getAllSharedExams = async (req, res) => {
  try {
    const sharedExams = await SharedExam.find({ sharedBy: req.user._id })
      .populate('exam', 'title')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      sharedExams: sharedExams.map(se => ({
        _id: se._id,
        shareToken: se.shareToken,
        shareType: se.shareType,
        examTitle: se.examTitle || (se.exam?.title || 'Unknown'),
        isExamDeleted: se.isExamDeleted,
        examDeletedAt: se.examDeletedAt,
        studentsCount: se.students.length,
        students: se.students.map(s => ({
          _id: s._id,
          name: s.name,
          email: s.email,
          hasCompleted: s.hasCompleted,
          firstAccessedAt: s.firstAccessedAt
        })),
        createdAt: se.createdAt,
        isActive: se.isActive
      }))
    });
  } catch (error) {
    console.error('Get all shared exams error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Submit shared exam answers
// @route   POST /api/share/:shareToken/submit
// @access  Public
const submitSharedExam = async (req, res) => {
  try {
    const { shareToken } = req.params;
    const { answers, studentId } = req.body;

    console.log('Submit exam - shareToken:', shareToken);
    console.log('Submit exam - studentId:', studentId);
    console.log('Submit exam - answers:', Object.keys(answers).length);
    console.log('Submit exam - answer keys:', Object.keys(answers));
    console.log('Submit exam - sample answer:', Object.values(answers)[0]);

    const sharedExam = await SharedExam.findOne({ shareToken })
      .populate('students.student', 'email firstName lastName')
      .populate({
        path: 'exam',
        select: 'title description timeLimit totalPoints passingScore sections',
        populate: {
          path: 'sections.questions',
          model: 'Question'
        }
      });

    if (!sharedExam) {
      return res.status(404).json({ message: 'Share link not found' });
    }

    // Ensure exam has all three sections (A, B, C) even if empty
    if (sharedExam.exam) {
      const requiredSections = ['A', 'B', 'C'];
      const existingSections = sharedExam.exam.sections || [];
      const existingSectionNames = existingSections.map(s => s.name);

      // Add missing sections
      requiredSections.forEach(sectionName => {
        if (!existingSectionNames.includes(sectionName)) {
          const descriptions = {
            'A': 'Multiple Choice Questions',
            'B': 'Short Answer Questions',
            'C': 'Essay Questions'
          };
          sharedExam.exam.sections.push({
            name: sectionName,
            description: descriptions[sectionName] || `Section ${sectionName}`,
            questions: []
          });
          console.log(`Added missing section ${sectionName} to exam in submitSharedExam`);
        }
      });
    }

    // Find the student in the shared exam
    console.log('Students in shared exam:', sharedExam.students.length);
    sharedExam.students.forEach((s, idx) => {
      console.log(`  Student ${idx}: student=${s.student?._id}, email=${s.email}`);
    });

    const studentData = sharedExam.students.find(s => {
      if (!s.student) return false;
      return s.student._id.toString() === studentId;
    });
    
    console.log('Found student data:', studentData ? 'Yes' : 'No');
    
    if (!studentData) {
      return res.status(403).json({ message: 'Student not found in this exam' });
    }

    // Create a result record
    const Result = require('../models/Result');
    
    // Import enhanced grading functions
    const { gradeQuestionByType } = require('../utils/enhancedGrading');
    
    // Calculate score
    let totalPoints = 0;
    let earnedPoints = 0;

    // Flatten all questions from sections
    const allQuestions = [];
    if (sharedExam.exam?.sections) {
      sharedExam.exam.sections.forEach(section => {
        if (section.questions && Array.isArray(section.questions)) {
          allQuestions.push(...section.questions);
        }
      });
    }

    console.log('Total questions:', allQuestions.length);

    // Grade the exam using enhanced grading
    // Separate questions into AI-graded (open-ended) and simple-graded (multiple-choice, etc.)
    const aiGradedQuestions = [];
    const simpleGradedQuestions = [];
    
    for (const question of allQuestions) {
      const points = question.points || 1;
      totalPoints += points;

      const studentAnswer = answers[question._id];
      
      console.log(`Processing question ${question._id}, studentAnswer:`, studentAnswer);
      
      // Handle answer object format from frontend - improved extraction
      let actualAnswer = studentAnswer;
      if (studentAnswer && typeof studentAnswer === 'object') {
        // Frontend sends answer objects with selectedOption/textAnswer fields
        actualAnswer = studentAnswer.selectedOption || studentAnswer.textAnswer || JSON.stringify(studentAnswer);
        console.log(`Extracted actualAnswer from object:`, actualAnswer);
      } else if (studentAnswer === undefined || studentAnswer === null) {
        actualAnswer = 'Not answered';
        console.log(`StudentAnswer is undefined/null, setting to 'Not answered'`);
      }
      
      const answerObj = {
        question: question._id,
        points: points
      };

      // Prepare answer object based on question type
      if (question.type === 'multiple-choice' || question.type === 'true-false') {
        answerObj.selectedOption = actualAnswer || 'Not answered';
        answerObj.selectedOptionLetter = typeof actualAnswer === 'string' ? actualAnswer.match(/^[A-D]/i)?.[0]?.toUpperCase() || null : null;
        answerObj.correctedAnswer = question.correctAnswer;
        simpleGradedQuestions.push({ question, answerObj });
      } else if (question.type === 'open-ended' || question.type === 'fill-in-blank' || question.type === 'short-answer') {
        answerObj.textAnswer = actualAnswer || 'Not answered';
        answerObj.correctedAnswer = question.correctAnswer;
        aiGradedQuestions.push({ question, answerObj });
      } else if (question.type === 'matching') {
        answerObj.matchingAnswers = actualAnswer || [];
        simpleGradedQuestions.push({ question, answerObj });
      } else if (question.type === 'ordering') {
        answerObj.orderingAnswer = actualAnswer || [];
        simpleGradedQuestions.push({ question, answerObj });
      } else {
        // Default to simple grading for unknown types
        answerObj.textAnswer = actualAnswer || 'Not answered';
        answerObj.correctedAnswer = question.correctAnswer;
        simpleGradedQuestions.push({ question, answerObj });
      }
    }

    console.log(`📊 Question breakdown: ${aiGradedQuestions.length} AI-graded, ${simpleGradedQuestions.length} simple-graded`);

    // Grade simple questions in parallel (fast)
    const simpleGradingPromises = simpleGradedQuestions.map(async ({ question, answerObj }) => {
      try {
        const gradingResult = await gradeQuestionByType(question, answerObj, question.correctAnswer);
        
        answerObj.isCorrect = gradingResult.score === answerObj.points;
        answerObj.score = Math.min(Math.max(0, gradingResult.score || 0), answerObj.points);
        answerObj.feedback = gradingResult.feedback;
        answerObj.details = gradingResult.details;
        
        if (gradingResult.correctedAnswer) {
          answerObj.correctedAnswer = gradingResult.correctedAnswer;
        }
        
        if (gradingResult.details?.gradingMethod) {
          answerObj.gradingMethod = gradingResult.details.gradingMethod;
        }
        
        return answerObj;
      } catch (gradingError) {
        console.error('Error grading simple question:', gradingError);
        // Fallback grading
        answerObj.isCorrect = false;
        answerObj.score = 0;
        answerObj.feedback = 'Grading error';
        answerObj.gradingMethod = 'error_fallback';
        return answerObj;
      }
    });

    // Grade AI questions in parallel batches (to avoid overwhelming the API)
    const BATCH_SIZE = 5; // Process 5 AI questions at a time
    const detailedAnswers = [];
    let aiGradedCount = 0;

    for (let i = 0; i < aiGradedQuestions.length; i += BATCH_SIZE) {
      const batch = aiGradedQuestions.slice(i, i + BATCH_SIZE);
      console.log(`🤖 Processing AI grading batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(aiGradedQuestions.length / BATCH_SIZE)} (${batch.length} questions)`);
      
      const batchPromises = batch.map(async ({ question, answerObj }) => {
        try {
          const gradingResult = await gradeQuestionByType(question, answerObj, question.correctAnswer);
          
          answerObj.isCorrect = gradingResult.score === answerObj.points;
          answerObj.score = Math.min(Math.max(0, gradingResult.score || 0), answerObj.points);
          answerObj.feedback = gradingResult.feedback;
          answerObj.details = gradingResult.details;
          
          if (gradingResult.correctedAnswer) {
            answerObj.correctedAnswer = gradingResult.correctedAnswer;
          }
          
          // Add AI grading details if available
          if (gradingResult.details?.keyConceptsPresent) {
            answerObj.conceptsPresent = gradingResult.details.keyConceptsPresent;
          }
          if (gradingResult.details?.keyConceptsMissing) {
            answerObj.conceptsMissing = gradingResult.details.keyConceptsMissing;
          }
          if (gradingResult.details?.gradingMethod) {
            answerObj.gradingMethod = gradingResult.details.gradingMethod;
          }
          
          return answerObj;
        } catch (gradingError) {
          console.error('Error grading AI question:', gradingError);
          // Fallback to simple grading
          let isCorrect = false;
          if (answerObj.textAnswer && question.correctAnswer) {
            isCorrect = answerObj.textAnswer.toLowerCase().trim() === question.correctAnswer.toLowerCase().trim();
          }
          
          answerObj.isCorrect = isCorrect;
          answerObj.score = isCorrect ? answerObj.points : 0;
          answerObj.feedback = isCorrect ? 'Correct' : 'Incorrect (AI grading failed, used fallback)';
          answerObj.gradingMethod = 'ai_error_fallback';
          return answerObj;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      detailedAnswers.push(...batchResults);
      aiGradedCount += batchResults.length;
      console.log(`✅ Completed batch ${Math.floor(i / BATCH_SIZE) + 1}, graded ${batchResults.length} questions`);
    }

    // Add simple-graded results
    const simpleResults = await Promise.all(simpleGradingPromises);
    detailedAnswers.push(...simpleResults);

    // Calculate total earned points
    detailedAnswers.forEach(answer => {
      earnedPoints += answer.score || 0;
    });

    console.log(`✅ Grading complete: ${detailedAnswers.length} total questions, ${aiGradedCount} AI-graded, ${simpleResults.length} simple-graded`);

    const percentage = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0;
    const isPassed = percentage >= (sharedExam.exam?.passingScore || 70);

    // Create result with student name
    const result = await Result.create({
      student: studentId,
      studentName: studentData.name || studentData.student?.name || 'Student',
      studentEmail: studentData.email || studentData.student?.email || '',
      exam: sharedExam.exam._id,
      examTitle: sharedExam.exam?.title || 'Exam',
      answers: detailedAnswers,
      totalScore: earnedPoints,
      maxPossibleScore: totalPoints,
      isCompleted: true,
      endTime: new Date(),
      aiGradingStatus: 'completed'
    });

    console.log('Result created:', result._id);

    // Update student data
    studentData.hasCompleted = true;
    studentData.result = result._id;
    studentData.completedAt = new Date();
    studentData.isActiveSession = false; // Clear active session on completion
    studentData.isLocked = true; // Lock exam after completion to prevent retaking
    await sharedExam.save();

    // Mark the access code as used if this exam was accessed via marketplace access code
    const examRequest = await ExamRequest.findOne({ shareToken, status: 'approved' });
    if (examRequest && !examRequest.accessCodeUsed) {
      examRequest.accessCodeUsed = true;
      await examRequest.save();
      console.log('Access code marked as used for request:', examRequest._id);
    }

    // Increment completed count
    sharedExam.incrementCompleted();
    await sharedExam.save();

    res.status(201).json({
      success: true,
      message: 'Exam submitted successfully',
      resultId: result._id,
      totalScore: earnedPoints,  // Frontend expects this as earned points
      maxPossibleScore: totalPoints,  // Frontend expects this as max possible
      score: earnedPoints,
      percentage: Math.round(percentage),
      isPassed
    });

  } catch (error) {
    console.error('Submit shared exam error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Unlock a student's exam (allow retaking)
// @route   POST /api/share/:shareToken/unlock/:studentId
// @access  Private (Teacher)
const unlockStudentExam = async (req, res) => {
  try {
    const { shareToken, studentId } = req.params;

    const sharedExam = await SharedExam.findOne({ shareToken });

    if (!sharedExam) {
      return res.status(404).json({ message: 'Share link not found' });
    }

    // Check if the user is the teacher who shared the exam OR their admin
    const isAuthorized = sharedExam.sharedBy.toString() === req.user._id.toString() ||
      (req.user.role === 'admin' && sharedExam.sharedBy.toString() === req.user._id.toString()) ||
      (req.user.role === 'admin' && req.user._id.toString() === req.orgAdminId?.toString()) ||
      (req.user.role === 'teacher' && req.user.parentAdmin && sharedExam.sharedBy.toString() === req.user.parentAdmin.toString());

    if (!isAuthorized) {
      return res.status(403).json({ message: 'Not authorized to unlock this exam' });
    }

    // Unlock the student's exam
    const unlocked = sharedExam.unlockStudent(studentId);

    if (!unlocked) {
      return res.status(404).json({ message: 'Student not found in this exam' });
    }

    await sharedExam.save();

    res.json({
      success: true,
      message: 'Student exam unlocked successfully'
    });

  } catch (error) {
    console.error('Unlock student exam error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Reset expired share link (extend expiration)
// @route   POST /api/share/:shareId/reset-expiration
// @access  Private (Teacher)
const resetShareExpiration = async (req, res) => {
  try {
    const { shareId } = req.params;
    const { newExpiresAt } = req.body;

    const sharedExam = await SharedExam.findById(shareId);

    if (!sharedExam) {
      return res.status(404).json({ message: 'Share not found' });
    }

    // Check ownership
    if (sharedExam.sharedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // If newExpiresAt is provided, use it; otherwise extend by 7 days from now
    if (newExpiresAt) {
      sharedExam.settings.expiresAt = new Date(newExpiresAt);
    } else {
      const extendedDate = new Date();
      extendedDate.setDate(extendedDate.getDate() + 7);
      sharedExam.settings.expiresAt = extendedDate;
    }

    // Ensure the share is active
    sharedExam.isActive = true;

    await sharedExam.save();

    // Generate share URL
    const shareUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/exam/${sharedExam.shareToken}`;

    res.json({
      success: true,
      message: 'Share link expiration reset successfully',
      shareData: {
        shareId: sharedExam._id,
        shareToken: sharedExam.shareToken,
        shareUrl,
        expiresAt: sharedExam.settings.expiresAt
      }
    });

  } catch (error) {
    console.error('Reset share expiration error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Remove a student from a shared exam
// @route   DELETE /api/share/:shareToken/students/:studentId
// @access  Private (Teacher)
const removeStudentFromShare = async (req, res) => {
  try {
    const { shareToken, studentId } = req.params;

    const sharedExam = await SharedExam.findOne({ shareToken });

    if (!sharedExam) {
      return res.status(404).json({ message: 'Share link not found' });
    }

    // Check ownership or admin permission
    const isAuthorized = sharedExam.sharedBy.toString() === req.user._id.toString() ||
      (req.user.role === 'admin' && sharedExam.sharedBy.toString() === req.user._id.toString()) ||
      (req.user.role === 'admin' && req.user._id.toString() === req.orgAdminId?.toString()) ||
      (req.user.role === 'teacher' && req.user.parentAdmin && sharedExam.sharedBy.toString() === req.user.parentAdmin.toString());

    if (!isAuthorized) {
      return res.status(403).json({ message: 'Not authorized to remove students from this exam' });
    }

    // Remove the student
    const removed = sharedExam.removeStudent(studentId);

    if (!removed) {
      return res.status(404).json({ message: 'Student not found in this exam' });
    }

    await sharedExam.save();

    // Log activity
    await ActivityLog.logActivity({
      user: req.user._id,
      action: 'remove_student_from_share',
      details: {
        sharedExamId: sharedExam._id,
        studentId: studentId,
        shareToken: shareToken
      }
    });

    res.json({
      success: true,
      message: 'Student removed successfully'
    });

  } catch (error) {
    console.error('Remove student from share error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
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
};
