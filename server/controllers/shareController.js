const SharedExam = require('../models/SharedExam');
const Exam = require('../models/Exam');
const User = require('../models/User');
const Result = require('../models/Result');
const ActivityLog = require('../models/ActivityLog');

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
      invitedEmails
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
    const invitedEmailsList = invitedEmails ? invitedEmails.map(email => ({
      email: email.toLowerCase().trim(),
      inviteToken: SharedExam.generateShareToken()
    })) : [];

    // Create shared exam
    const sharedExam = await SharedExam.create({
      exam: examId,
      sharedBy: req.user._id,
      shareToken,
      shareType: shareType || 'link',
      settings,
      invitedEmails: invitedEmailsList,
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

    if (sharedExam.isFull()) {
      return res.status(403).json({ message: 'Maximum number of students reached' });
    }

    // Increment view count
    sharedExam.incrementViews();
    await sharedExam.save();

    // Return exam details without sensitive info
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
        sections: sharedExam.exam.sections || [],
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
    const { password } = req.body;

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
    let { email, name, password, inviteToken } = req.body;

    const sharedExam = await SharedExam.findOne({ shareToken })
      .populate({
        path: 'exam',
        select: 'title description timeLimit totalPoints passingScore questions sections',
        populate: {
          path: 'sections.questions',
          model: 'Question'
        }
      });

    if (!sharedExam) {
      return res.status(404).json({ message: 'Share link not found' });
    }

    console.log('Join exam - Shared exam found:', sharedExam.shareToken);
    console.log('Join exam - Exam sections:', sharedExam.exam?.sections);
    if (sharedExam.exam?.sections) {
      sharedExam.exam.sections.forEach((section, idx) => {
        console.log(`  Section ${idx} (${section.name}): ${section.questions?.length || 0} questions`);
      });
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

    // Check if email-based access is required
    if (sharedExam.shareType === 'email' && !inviteToken) {
      return res.status(403).json({ message: 'This exam requires an email invitation' });
    }

    // Validate invite token if provided
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

    // For public links without email/name, generate temporary ones
    if (!email || !name) {
      const tempId = Math.random().toString(36).substring(2, 11);
      email = `student-${tempId}@exam.local`;
      name = `Student ${tempId}`;
    }

    // Normalize email
    email = email.toLowerCase().trim();

    // Check if already joined
    const existingStudent = sharedExam.students.find(
      s => s.email === email
    );

    if (existingStudent) {
      // If multiple attempts not allowed and already completed
      if (!sharedExam.settings.allowMultipleAttempts && existingStudent.hasCompleted) {
        return res.status(400).json({
          message: 'You have already completed this exam',
          hasCompleted: true,
          resultId: existingStudent.result
        });
      }

      // Return existing student info
      return res.json({
        success: true,
        message: 'Welcome back!',
        isNew: false,
        studentId: existingStudent._id,
        exam: sharedExam.exam,
        settings: sharedExam.settings
      });
    }

    // Create new student user if doesn't exist
    let studentUser = await User.findOne({ email });

    if (!studentUser) {
      // Create a temporary student account
      const randomPassword = Math.random().toString(36).slice(-8);
      const nameParts = name.split(' ');
      const firstName = nameParts[0] || 'Student';
      const lastName = nameParts.slice(1).join(' ') || 'User';
      
      studentUser = await User.create({
        email: email.toLowerCase().trim(),
        password: randomPassword,
        firstName,
        lastName,
        role: 'student',
        userType: 'individual',
        createdBy: sharedExam.sharedBy
      });
    }

    // Add student to share
    const studentData = {
      studentId: studentUser._id,
      email: email.toLowerCase().trim(),
      name: name,
      accessMethod: inviteToken ? 'invite' : 'link'
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

    res.status(201).json({
      success: true,
      message: 'Successfully joined the exam',
      isNew: true,
      studentId: studentUser._id,
      exam: sharedExam.exam,
      settings: sharedExam.settings
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

    // Grade the exam
    const detailedAnswers = [];
    allQuestions.forEach(question => {
      const points = question.points || 1;
      totalPoints += points;

      const studentAnswer = answers[question._id];
      let isCorrect = false;

      // Grade based on question type
      if (question.type === 'multiple-choice') {
        // For multiple choice, find the option that matches the student's answer
        const selectedOption = question.options?.find(opt => opt.text === studentAnswer);
        if (selectedOption) {
          // Check if this option is the correct one
          isCorrect = selectedOption.isCorrect || selectedOption.letter === question.correctAnswer;
        }
      } else if (question.type === 'true-false') {
        // For true/false, compare directly
        isCorrect = studentAnswer === question.correctAnswer;
      } else {
        // For open-ended and fill-in-blank, do exact match (case-insensitive)
        isCorrect = studentAnswer?.toLowerCase().trim() === question.correctAnswer?.toLowerCase().trim();
      }

      if (isCorrect) {
        earnedPoints += points;
      }

      // Build answer object based on question type
      const answerObj = {
        question: question._id,
        isCorrect,
        score: isCorrect ? points : 0
      };

      if (question.type === 'multiple-choice' || question.type === 'true-false') {
        answerObj.selectedOption = studentAnswer || 'Not answered';
        answerObj.correctedAnswer = question.correctAnswer;
      } else if (question.type === 'open-ended' || question.type === 'fill-in-blank') {
        answerObj.textAnswer = studentAnswer || 'Not answered';
        answerObj.correctedAnswer = question.correctAnswer;
      }

      detailedAnswers.push(answerObj);
    });

    const percentage = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0;
    const isPassed = percentage >= (sharedExam.exam?.passingScore || 70);

    // Create result
    const result = await Result.create({
      student: studentId,
      exam: sharedExam.exam._id,
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
    await sharedExam.save();

    // Increment completed count
    sharedExam.incrementCompleted();
    await sharedExam.save();

    res.status(201).json({
      success: true,
      message: 'Exam submitted successfully',
      resultId: result._id,
      score: earnedPoints,
      totalScore: totalPoints,
      percentage: Math.round(percentage),
      isPassed
    });

  } catch (error) {
    console.error('Submit shared exam error:', error);
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
  updateShare,
  deleteShare,
  getMyShares,
  getShareStats
};
