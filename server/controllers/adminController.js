const mongoose = require('mongoose');
const User = require('../models/User');
const SystemConfig = require('../models/SystemConfig');
const Exam = require('../models/Exam');
const Result = require('../models/Result');
const SecurityAlert = require('../models/SecurityAlert');
const ActivityLog = require('../models/ActivityLog');
const SharedExam = require('../models/SharedExam');
const Question = require('../models/Question');

// Helper function to check if user is super admin
const isSuperAdmin = (user) => {
  return user && user.role === 'superadmin';
};

// Simple in-memory cache for leaderboard data (5 minute TTL)
const leaderboardCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const getCacheKey = (adminId, examId = 'all') => `leaderboard_${adminId}_${examId}`;

const getCachedData = (key) => {
  const cached = leaderboardCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  return null;
};

const setCachedData = (key, data) => {
  leaderboardCache.set(key, {
    data,
    timestamp: Date.now()
  });
};

// Clean up expired cache entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of leaderboardCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      leaderboardCache.delete(key);
    }
  }
}, 10 * 60 * 1000);

// @desc    Register a new student
// @route   POST /api/admin/students
// @access  Private/Admin
const registerStudent = async (req, res) => {
  try {
    console.log('Register student request body:', req.body);
    const { firstName, lastName, email, password, class: studentClass, organization } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }

    // Check if student already exists
    const studentExists = await User.findOne({ email });

    if (studentExists) {
      return res.status(400).json({ message: 'Student with this email already exists' });
    }

    // Create student
    const student = await User.create({
      firstName,
      lastName,
      email,
      password,
      role: 'student',
      class: studentClass || '',
      organization: organization || '',
      createdBy: req.orgAdminId, // Set the org admin who owns this student (works for both admin and teacher)
    });

    console.log('Student created successfully:', student._id);

    if (student) {
      // Log the activity
      await ActivityLog.logActivity({
        user: req.user._id,
        action: 'add_student',
        details: {
          studentId: student._id,
          studentName: `${student.firstName} ${student.lastName}`,
          studentEmail: student.email,
          createdByRole: req.user.role
        }
      });

      res.status(201).json({
        _id: student._id,
        firstName: student.firstName,
        lastName: student.lastName,
        email: student.email,
        role: student.role,
        class: student.class,
        organization: student.organization
      });
    } else {
      res.status(400).json({ message: 'Invalid student data' });
    }
  } catch (error) {
    console.error('Register student error:', error);
    console.error('Error details:', error.message);

    // Handle duplicate key error (MongoDB error code 11000)
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Student with this email already exists' });
    }

    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({ message: messages.join(', ') });
    }

    res.status(500).json({ message: 'Server error. Please try again.' });
  }
};

// @desc    Get all students created by this organization (admin or teacher), or all students for super admin
// @route   GET /api/admin/students
// @access  Private/Admin or Private/Teacher
const getStudents = async (req, res) => {
  try {
    // Check if user is super admin - if so, return all students
    // For superadmin: req.orgAdminId is null, so show all students
    const query = isSuperAdmin(req.user) || !req.orgAdminId
      ? { role: 'student' }
      : { role: 'student', createdBy: req.orgAdminId };

    // Find students (all for super admin, or only this organization's students)
    const students = await User.find(query).select('-password');

    res.json(students);
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get student by ID
// @route   GET /api/admin/students/:id
// @access  Private/Admin or Private/Teacher
const getStudentById = async (req, res) => {
  try {
    const student = await User.findById(req.params.id).select('-password');

    // Check if student exists, is a student, and belongs to this organization
    if (student && student.role === 'student' &&
        (student.createdBy && student.createdBy.toString() === req.orgAdminId.toString())) {
      res.json(student);
    } else {
      res.status(404).json({ message: 'Student not found or not authorized to access this student' });
    }
  } catch (error) {
    console.error('Get student by ID error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update student
// @route   PUT /api/admin/students/:id
// @access  Private/Admin
const updateStudent = async (req, res) => {
  try {
    const { firstName, lastName, email, class: studentClass, organization, isBlocked } = req.body;

    const student = await User.findById(req.params.id);

    // Check if student exists, is a student, and belongs to this organization
    if (student && student.role === 'student' &&
        (student.createdBy && student.createdBy.toString() === req.orgAdminId.toString())) {
      // Update student fields
      if (firstName) student.firstName = firstName;
      if (lastName) student.lastName = lastName;
      if (email) student.email = email;
      if (studentClass) student.class = studentClass;
      if (organization) student.organization = organization;
      if (isBlocked !== undefined) student.isBlocked = isBlocked;

      const updatedStudent = await student.save();

      // Log the activity
      await ActivityLog.logActivity({
        user: req.user._id,
        action: 'edit_student',
        details: {
          studentId: updatedStudent._id,
          studentName: `${updatedStudent.firstName} ${updatedStudent.lastName}`,
          editedByRole: req.user.role
        }
      });

      res.json({
        _id: updatedStudent._id,
        firstName: updatedStudent.firstName,
        lastName: updatedStudent.lastName,
        email: updatedStudent.email,
        role: updatedStudent.role,
        class: updatedStudent.class,
        organization: updatedStudent.organization,
        isBlocked: updatedStudent.isBlocked
      });
    } else {
      res.status(404).json({ message: 'Student not found' });
    }
  } catch (error) {
    console.error('Update student error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Delete student
// @route   DELETE /api/admin/students/:id
// @access  Private/Admin
const deleteStudent = async (req, res) => {
  try {
    const student = await User.findById(req.params.id);

    // Check if student exists, is a student, and belongs to this organization
    if (student && student.role === 'student' &&
        (student.createdBy && student.createdBy.toString() === req.orgAdminId.toString())) {
      const studentName = `${student.firstName} ${student.lastName}`;
      await student.deleteOne();

      // Log the activity
      await ActivityLog.logActivity({
        user: req.user._id,
        action: 'delete_student',
        details: {
          studentId: req.params.id,
          studentName: studentName,
          deletedByRole: req.user.role
        }
      });

      res.json({ message: 'Student removed successfully' });
    } else {
      res.status(404).json({ message: 'Student not found' });
    }
  } catch (error) {
    console.error('Delete student error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Lock/unlock system
// @route   PUT /api/admin/system-lock
// @access  Private/Admin
const toggleSystemLock = async (req, res) => {
  try {
    const { isLocked, lockMessage } = req.body;

    const config = await SystemConfig.getConfig();

    config.isLocked = isLocked !== undefined ? isLocked : config.isLocked;
    config.lockMessage = lockMessage || config.lockMessage;
    config.updatedBy = req.user._id;
    config.updatedAt = Date.now();

    await config.save();

    // Log the activity
    await ActivityLog.logActivity({
      user: req.user._id,
      action: config.isLocked ? 'system_lock' : 'system_unlock',
      details: {
        lockMessage: config.lockMessage
      }
    });

    res.json(config);
  } catch (error) {
    console.error('Toggle system lock error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get system lock status
// @route   GET /api/admin/system-lock
// @access  Private/Admin
const getSystemLockStatus = async (req, res) => {
  try {
    const config = await SystemConfig.getConfig();
    res.json(config);
  } catch (error) {
    console.error('Get system lock status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get exam results
// @route   GET /api/admin/exams/:examId/results
// @access  Private/Admin
const getExamResults = async (req, res) => {
  try {
    const { examId } = req.params;

    // Check if exam exists and belongs to this admin
    const exam = await Exam.findOne({
      _id: examId,
      createdBy: req.orgAdminId
    });

    if (!exam) {
      return res.status(404).json({ message: 'Exam not found or not authorized' });
    }

    // Get students created by this admin
    const students = await User.find({
      role: 'student',
      createdBy: req.orgAdminId
    }).select('_id');

    const studentIds = students.map(student => student._id);

    // Get results for this exam from students created by this admin
    const results = await Result.find({
      exam: examId,
      student: { $in: studentIds }
    })
      .populate('student', 'fullName firstName lastName studentId email organization studentClass')
      .populate('exam', 'title')
      .sort({ totalScore: -1, endTime: -1 });

    // Format results with additional calculated fields
    const formattedResults = results.map(result => {
      const percentage = result.maxPossibleScore > 0
        ? Math.round((result.totalScore / result.maxPossibleScore) * 100)
        : 0;

      // Calculate time taken
      const timeTaken = result.endTime && result.startTime
        ? Math.round((new Date(result.endTime) - new Date(result.startTime)) / (1000 * 60))
        : 0;

      return {
        _id: result._id,
        student: {
          _id: result.student._id,
          fullName: result.student.fullName ||
                   `${result.student.firstName || ''} ${result.student.lastName || ''}`.trim(),
          firstName: result.student.firstName,
          lastName: result.student.lastName,
          studentId: result.student.studentId,
          email: result.student.email,
          organization: result.student.organization,
          studentClass: result.student.studentClass
        },
        exam: result.exam,
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

    res.json(formattedResults);
  } catch (error) {
    console.error('Get exam results error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get overall leaderboard for students created by this admin
// @route   GET /api/admin/leaderboard
// @access  Private/Admin
const getOverallLeaderboard = async (req, res) => {
  try {
    console.log(`Admin ${req.user._id} requesting overall leaderboard`);
    const startTime = Date.now();

    // Check cache first
    const cacheKey = getCacheKey(req.user._id, 'all');
    const cachedData = getCachedData(cacheKey);
    if (cachedData) {
      console.log(`Returning cached overall leaderboard for admin ${req.user._id}`);
      return res.json(cachedData);
    }

    // Get students created by this admin with lean query for better performance
    const students = await User.find({
      role: 'student',
      createdBy: req.orgAdminId
    }).select('_id').lean();

    const studentIds = students.map(student => student._id);
    console.log(`Found ${studentIds.length} students for admin`);

    // Get exams created by this admin with lean query
    const exams = await Exam.find({ createdBy: req.orgAdminId }).select('_id').lean();
    const examIds = exams.map(exam => exam._id);
    console.log(`Found ${examIds.length} exams for admin`);

    // Get all completed results for students created by this admin taking exams created by this admin
    const results = await Result.find({
      isCompleted: true,
      student: { $in: studentIds },
      exam: { $in: examIds }
    })
      .populate({
        path: 'student',
        select: 'firstName lastName email organization class',
        options: { virtuals: true }
      })
      .populate('exam', 'title maxPossibleScore')
      .select('totalScore maxPossibleScore startTime endTime exam');

    // Group results by student
    const studentResults = {};

    results.forEach(result => {
      if (!result.student) return;

      const studentId = result.student._id.toString();

      if (!studentResults[studentId]) {
        studentResults[studentId] = {
          id: studentId,
          name: `${result.student.firstName || ''} ${result.student.lastName || ''}`.trim(),
          firstName: result.student.firstName || '',
          lastName: result.student.lastName || '',
          email: result.student.email || '',
          organization: result.student.organization || '',
          studentClass: result.student.class || '',
          exams: [],
          totalScore: 0,
          totalMaxScore: 0,
          totalTimeTaken: 0,
          examCount: 0
        };
      }

      // Calculate percentage score
      const percentage = result.maxPossibleScore > 0
        ? Math.round((result.totalScore / result.maxPossibleScore) * 100)
        : 0;

      // Calculate time taken in minutes
      const startTime = new Date(result.startTime);
      const endTime = new Date(result.endTime || startTime);
      const timeTakenMs = endTime - startTime;
      const timeTakenMinutes = Math.round(timeTakenMs / (1000 * 60));

      // Add exam result
      studentResults[studentId].exams.push({
        examId: result.exam._id,
        examTitle: result.exam.title,
        score: result.totalScore,
        maxScore: result.maxPossibleScore,
        percentage,
        timeTaken: timeTakenMinutes,
        completedAt: result.endTime
      });

      // Update totals
      studentResults[studentId].totalScore += result.totalScore;
      studentResults[studentId].totalMaxScore += result.maxPossibleScore;
      studentResults[studentId].totalTimeTaken += timeTakenMinutes;
      studentResults[studentId].examCount += 1;
    });

    // Convert to array and calculate overall percentage
    const leaderboardData = Object.values(studentResults).map(student => {
      const overallPercentage = student.totalMaxScore > 0
        ? Math.round((student.totalScore / student.totalMaxScore) * 100)
        : 0;

      const avgTimeTaken = student.examCount > 0
        ? Math.round(student.totalTimeTaken / student.examCount)
        : 0;

      return {
        ...student,
        percentage: overallPercentage,
        timeTaken: avgTimeTaken,
        // Add a unique identifier for each student in the overall leaderboard
        uniqueId: `overall-${student.id}`
      };
    });

    // Sort by percentage score (highest first), then by time taken (shortest first)
    leaderboardData.sort((a, b) => {
      if (b.percentage !== a.percentage) {
        return b.percentage - a.percentage;
      }
      return a.timeTaken - b.timeTaken;
    });

    // Limit to top 50 for better performance
    const limitedData = leaderboardData.slice(0, 50);

    const endTime = Date.now();
    console.log(`Overall leaderboard generated in ${endTime - startTime}ms with ${limitedData.length} students`);

    const responseData = {
      examTitle: "All Exams",
      leaderboard: limitedData
    };

    // Cache the response
    setCachedData(cacheKey, responseData);

    res.json(responseData);
  } catch (error) {
    console.error('Get overall leaderboard error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get exam leaderboard
// @route   GET /api/admin/exams/:examId/leaderboard
// @access  Private/Admin
const getExamLeaderboard = async (req, res) => {
  try {
    const { examId } = req.params;
    console.log(`Admin ${req.user._id} requesting leaderboard for exam ${examId}`);
    const startTime = Date.now();

    // Check cache first
    const cacheKey = getCacheKey(req.user._id, examId);
    const cachedData = getCachedData(cacheKey);
    if (cachedData) {
      console.log(`Returning cached exam leaderboard for admin ${req.user._id}, exam ${examId}`);
      return res.json(cachedData);
    }

    // Check if exam exists and belongs to this admin
    const exam = await Exam.findOne({
      _id: examId,
      createdBy: req.orgAdminId
    }).lean();

    if (!exam) {
      return res.status(404).json({ message: 'Exam not found or access denied' });
    }

    // Get students created by this admin
    const students = await User.find({
      role: 'student',
      createdBy: req.orgAdminId
    }).select('_id').lean();

    const studentIds = students.map(student => student._id);

    // Get completed results for this exam from admin's students only
    const results = await Result.find({
      exam: examId,
      isCompleted: true,
      student: { $in: studentIds }
    })
      .populate({
        path: 'student',
        select: 'firstName lastName email organization class',
        options: { virtuals: true }
      })
      .populate('exam', 'title maxPossibleScore')
      .select('totalScore maxPossibleScore startTime endTime')
      .limit(100); // Limit for performance

    // Format the results for the leaderboard
    const leaderboardData = results.map(result => {
      // Ensure student data exists
      if (!result.student) {
        console.error('Missing student data for result:', result._id);
        return null;
      }

      // Calculate percentage score
      const percentage = result.maxPossibleScore > 0
        ? Math.round((result.totalScore / result.maxPossibleScore) * 100)
        : 0;

      // Calculate time taken in minutes
      const startTime = new Date(result.startTime);
      const endTime = new Date(result.endTime || startTime); // Use startTime as fallback
      const timeTakenMs = endTime - startTime;
      const timeTakenMinutes = Math.round(timeTakenMs / (1000 * 60));

      // Create fullName from firstName and lastName if not available
      const fullName = `${result.student.firstName || ''} ${result.student.lastName || ''}`.trim();

      return {
        id: result.student._id,
        resultId: result._id, // Ensure this is included for unique keys
        name: fullName,
        firstName: result.student.firstName || '',
        lastName: result.student.lastName || '',
        email: result.student.email || '',
        organization: result.student.organization || '',
        studentClass: result.student.class || '', // Use class field from User model
        score: result.totalScore || 0,
        maxScore: result.maxPossibleScore || 0,
        percentage,
        timeTaken: timeTakenMinutes,
        completedAt: result.endTime,
        startTime: result.startTime,
        examId: result.exam._id,
        // Add a unique identifier combining student ID and result ID
        uniqueId: `${result.student._id}-${result._id}`
      };
    }).filter(Boolean); // Remove any null entries

    // Sort by percentage score (highest first), then by time taken (shortest first)
    leaderboardData.sort((a, b) => {
      if (b.percentage !== a.percentage) {
        return b.percentage - a.percentage;
      }
      return a.timeTaken - b.timeTaken;
    });

    const endTime = Date.now();
    console.log(`Exam leaderboard for ${examId} generated in ${endTime - startTime}ms with ${leaderboardData.length} students`);

    const responseData = {
      examTitle: exam.title,
      leaderboard: leaderboardData
    };

    // Cache the response
    setCachedData(cacheKey, responseData);

    res.json(responseData);
  } catch (error) {
    console.error('Get exam leaderboard error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get detailed result for a student
// @route   GET /api/admin/results/:resultId
// @access  Private/Admin
const getDetailedResult = async (req, res) => {
  try {
    const { resultId } = req.params;

    const result = await Result.findById(resultId)
      .populate('student', 'fullName firstName lastName studentId email organization studentClass')
      .populate('exam', 'title description totalPoints timeLimit')
      .populate({
        path: 'answers.question',
        select: 'text type options correctAnswer points section'
      });

    if (!result) {
      return res.status(404).json({ message: 'Result not found' });
    }

    // Check if this result belongs to an exam created by this organization
    const exam = await Exam.findById(result.exam._id);

    if (!exam || exam.createdBy.toString() !== req.orgAdminId.toString()) {
      return res.status(403).json({ message: 'Not authorized to view this result' });
    }

    // Calculate additional statistics
    const percentage = result.maxPossibleScore > 0
      ? Math.round((result.totalScore / result.maxPossibleScore) * 100)
      : 0;

    const timeTaken = result.endTime && result.startTime
      ? Math.round((new Date(result.endTime) - new Date(result.startTime)) / (1000 * 60))
      : 0;

    // Analyze answers by section and type
    const answerAnalysis = {
      bySection: {},
      byType: {},
      correctAnswers: 0,
      totalAnswers: result.answers.length
    };

    result.answers.forEach(answer => {
      const section = answer.question.section || 'Unknown';
      const type = answer.question.type || 'Unknown';

      // Initialize section if not exists
      if (!answerAnalysis.bySection[section]) {
        answerAnalysis.bySection[section] = {
          total: 0,
          correct: 0,
          score: 0,
          maxScore: 0
        };
      }

      // Initialize type if not exists
      if (!answerAnalysis.byType[type]) {
        answerAnalysis.byType[type] = {
          total: 0,
          correct: 0,
          score: 0,
          maxScore: 0
        };
      }

      // Update counts
      answerAnalysis.bySection[section].total++;
      answerAnalysis.byType[type].total++;
      answerAnalysis.bySection[section].score += answer.score || 0;
      answerAnalysis.byType[type].score += answer.score || 0;
      answerAnalysis.bySection[section].maxScore += answer.question.points || 0;
      answerAnalysis.byType[type].maxScore += answer.question.points || 0;

      if (answer.isCorrect) {
        answerAnalysis.bySection[section].correct++;
        answerAnalysis.byType[type].correct++;
        answerAnalysis.correctAnswers++;
      }
    });

    // Format the response with enhanced data
    const enhancedResult = {
      ...result.toObject(),
      percentage,
      timeTaken,
      grade: percentage >= 90 ? 'A' : percentage >= 80 ? 'B' : percentage >= 70 ? 'C' : percentage >= 60 ? 'D' : 'F',
      analysis: answerAnalysis,
      performance: {
        excellent: percentage >= 90,
        good: percentage >= 70 && percentage < 90,
        average: percentage >= 50 && percentage < 70,
        poor: percentage < 50
      }
    };

    res.json(enhancedResult);
  } catch (error) {
    console.error('Get detailed result error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Export exam results as CSV
// @route   GET /api/admin/exams/:examId/results/export
// @access  Private/Admin
const exportExamResults = async (req, res) => {
  try {
    const { examId } = req.params;

    // Check if exam exists
    const exam = await Exam.findById(examId);

    if (!exam) {
      return res.status(404).json({ message: 'Exam not found' });
    }

    // Get all results for this exam
    const results = await Result.find({ exam: examId })
      .populate('student', 'fullName studentId email')
      .populate('exam', 'title');

    // Create CSV header
    let csv = 'Student ID,Full Name,Email,Start Time,End Time,Total Score,Max Score,Percentage\n';

    // Add data rows
    results.forEach(result => {
      const percentage = ((result.totalScore / result.maxPossibleScore) * 100).toFixed(2);

      csv += `${result.student.studentId},${result.student.fullName},${result.student.email},`;
      csv += `${result.startTime},${result.endTime || ''},${result.totalScore},`;
      csv += `${result.maxPossibleScore},${percentage}%\n`;
    });

    // Set headers for CSV download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=exam-results-${examId}.csv`);

    res.send(csv);
  } catch (error) {
    console.error('Export exam results error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get dashboard statistics for this admin (or all stats for super admin)
// @route   GET /api/admin/dashboard-stats
// @access  Private/Admin
const getDashboardStats = async (req, res) => {
  try {
    // Check if user is super admin
    const superAdmin = isSuperAdmin(req.user);

    // Build queries based on super admin status
    // For superadmin: req.orgAdminId is null, so show all data
    const studentQuery = superAdmin || !req.orgAdminId ? { role: 'student' } : { role: 'student', createdBy: req.orgAdminId };
    const examQuery = superAdmin || !req.orgAdminId ? {} : { createdBy: req.orgAdminId };
    const upcomingExamQuery = superAdmin || !req.orgAdminId
      ? { scheduledFor: { $gt: new Date() }, status: 'scheduled' }
      : { scheduledFor: { $gt: new Date() }, status: 'scheduled', createdBy: req.orgAdminId };
    const activeExamQuery = superAdmin || !req.orgAdminId
      ? { isLocked: false }
      : { isLocked: false, createdBy: req.orgAdminId };

    // Get count of students
    const studentCount = await User.countDocuments(studentQuery);

    // Get count of exams
    const examCount = await Exam.countDocuments(examQuery);

    // Get count of upcoming exams (scheduled in the future)
    const upcomingExams = await Exam.countDocuments(upcomingExamQuery);

    // Get count of active exams (not locked)
    const activeExams = await Exam.countDocuments(activeExamQuery);

    // Get students
    const students = await User.find(studentQuery).select('_id');
    const studentIds = students.map(student => student._id);

    // Get exams
    const exams = await Exam.find(examQuery).select('_id');
    const examIds = exams.map(exam => exam._id);

    // Get results (super admin sees all completed results)
    const resultQuery = superAdmin || !req.orgAdminId
      ? { isCompleted: true, exam: { $in: examIds } }
      : { isCompleted: true, student: { $in: studentIds }, exam: { $in: examIds } };
    const results = await Result.find(resultQuery);

    // Calculate performance stats for students created by this admin
    const totalResults = results.length;
    const averageScore = totalResults > 0
      ? Math.round(results.reduce((sum, result) => {
          const percentage = result.maxPossibleScore > 0
            ? (result.totalScore / result.maxPossibleScore) * 100
            : 0;
          return sum + percentage;
        }, 0) / totalResults)
      : 0;

    // Count performance levels
    const excellentCount = results.filter(r => {
      const percentage = r.maxPossibleScore > 0 ? (r.totalScore / r.maxPossibleScore) * 100 : 0;
      return percentage >= 90;
    }).length;

    const goodCount = results.filter(r => {
      const percentage = r.maxPossibleScore > 0 ? (r.totalScore / r.maxPossibleScore) * 100 : 0;
      return percentage >= 70 && percentage < 90;
    }).length;

    const averageCount = results.filter(r => {
      const percentage = r.maxPossibleScore > 0 ? (r.totalScore / r.maxPossibleScore) * 100 : 0;
      return percentage >= 50 && percentage < 70;
    }).length;

    const poorCount = results.filter(r => {
      const percentage = r.maxPossibleScore > 0 ? (r.totalScore / r.maxPossibleScore) * 100 : 0;
      return percentage < 50;
    }).length;

    // Get count of unresolved security alerts
    const securityAlerts = await SecurityAlert.countDocuments({ status: 'unresolved' });

    // Get recent activities from the ActivityLog
    const activities = await ActivityLog.find({})
      .populate('user', 'firstName lastName')
      .sort({ timestamp: -1 })
      .limit(10);

    // Format the activities for display
    const recentActivities = activities.map(activity => activity.formatForDisplay());

    // Return dashboard stats
    res.json({
      totalStudents: studentCount,
      totalExams: examCount,
      activeExams,
      upcomingExams,
      totalResults,
      averageScore,
      performanceBreakdown: {
        excellent: excellentCount,
        good: goodCount,
        average: averageCount,
        poor: poorCount
      },
      securityAlerts,
      recentActivities
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get exam by ID
// @route   GET /api/admin/exams/:id
// @access  Private/Admin
const getExamById = async (req, res) => {
  try {
    const { id } = req.params;

    // Find the exam by ID with populated sections and questions
    const exam = await Exam.findById(id)
      .populate('createdBy', 'firstName lastName')
      .populate({ path: 'sections.questions', model: 'Question' });

    if (!exam) {
      return res.status(404).json({ message: 'Exam not found' });
    }

    // Return the exam with all fields including sections and questions
    res.json(exam);
  } catch (error) {
    console.error('Get exam by ID error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get all exams created by this admin (or all exams for super admin)
// @route   GET /api/admin/exams
// @access  Private/Admin
const getAllExams = async (req, res) => {
  try {
    console.log('getAllExams - req.orgAdminId:', req.orgAdminId);
    console.log('getAllExams - req.user._id:', req.user?._id);
    console.log('getAllExams - req.user.role:', req.user?.role);

    // Check if user is super admin - if so, return all exams
    // For superadmin: req.orgAdminId is null, so show all data
    const query = isSuperAdmin(req.user) || !req.orgAdminId ? {} : { createdBy: req.orgAdminId };

    // Get all exams (or only this admin's exams) with populated creator, sections, and questions
    const exams = await Exam.find(query)
      .populate('createdBy', 'firstName lastName')
      .populate({ path: 'sections.questions', model: 'Question' })
      .sort({ createdAt: -1 });
    
    console.log('getAllExams - exams found:', exams.length);

    // Count students for each exam and calculate question count
    const examsWithStudentCount = await Promise.all(
      exams.map(async (exam) => {
        const studentCount = await Result.countDocuments({ exam: exam._id });

        // Calculate completion rate
        const completedCount = await Result.countDocuments({
          exam: exam._id,
          isCompleted: true
        });

        const completionRate = studentCount > 0
          ? Math.round((completedCount / studentCount) * 100)
          : 0;

        // Count total questions across all sections
        const questionCount = (exam.sections || []).reduce((sum, sec) => sum + (sec.questions?.length || 0), 0);

        return {
          _id: exam._id,
          title: exam.title,
          description: exam.description,
          timeLimit: exam.timeLimit,
          passingScore: exam.passingScore,
          totalPoints: exam.totalPoints,
          isLocked: exam.isLocked,
          createdAt: exam.createdAt,
          updatedAt: exam.updatedAt,
          scheduledFor: exam.scheduledFor,
          status: exam.status,
          createdBy: exam.createdBy ? `${exam.createdBy.firstName} ${exam.createdBy.lastName}` : 'Unknown',
          students: studentCount,
          completionRate,
          assignedTo: exam.assignedTo || [],
          sections: exam.sections || [],
          questions: questionCount
        };
      })
    );

    res.json(examsWithStudentCount);
  } catch (error) {
    console.error('Get all exams error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get all scheduled exams created by this admin
// @route   GET /api/admin/scheduled-exams
// @access  Private/Admin
const getScheduledExams = async (req, res) => {
  try {
    // Get all scheduled exams created by this admin (with scheduledFor date in the future)
    const scheduledExams = await Exam.find({
      scheduledFor: { $ne: null },
      status: 'scheduled',
      createdBy: req.orgAdminId
    })
      .populate('createdBy', 'firstName lastName')
      .sort({ scheduledFor: 1 });

    // Format exams with additional data
    const formattedExams = scheduledExams.map((exam) => {
      return {
        _id: exam._id,
        title: exam.title,
        description: exam.description,
        timeLimit: exam.timeLimit,
        totalPoints: exam.totalPoints,
        scheduledFor: exam.scheduledFor,
        startTime: exam.startTime,
        endTime: exam.endTime,
        status: exam.status,
        createdBy: `${exam.createdBy.firstName} ${exam.createdBy.lastName}`,
        assignedTo: exam.assignedTo || [],
        allowLateSubmission: exam.allowLateSubmission || false,
        isLocked: exam.isLocked
      };
    });

    res.json(formattedExams);
  } catch (error) {
    console.error('Get scheduled exams error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get recent exams created by this admin
// @route   GET /api/admin/recent-exams
// @access  Private/Admin
const getRecentExams = async (req, res) => {
  try {
    // Get 5 most recent exams created by this admin
    const recentExams = await Exam.find({ createdBy: req.orgAdminId })
      .populate('createdBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(5);

    // Format exams with additional data
    const formattedExams = await Promise.all(
      recentExams.map(async (exam) => {
        const studentCount = await Result.countDocuments({ exam: exam._id });
        const completedCount = await Result.countDocuments({
          exam: exam._id,
          isCompleted: true
        });

        const completionRate = studentCount > 0
          ? Math.round((completedCount / studentCount) * 100)
          : 0;

        // Format date for display
        const examDate = new Date(exam.scheduledFor || exam.createdAt);
        const formattedDate = examDate.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });

        const formattedTime = examDate.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit'
        });

        // Determine status
        let status = 'scheduled';
        if (exam.isLocked === false && exam.scheduledFor && new Date(exam.scheduledFor) <= new Date()) {
          status = 'active';
        } else if (completionRate === 100) {
          status = 'completed';
        }

        return {
          id: exam._id,
          title: exam.title,
          date: formattedDate,
          time: formattedTime,
          students: studentCount,
          status,
          completionRate
        };
      })
    );

    res.json(formattedExams);
  } catch (error) {
    console.error('Get recent exams error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get recent students created by this admin
// @route   GET /api/admin/recent-students
// @access  Private/Admin
const getRecentStudents = async (req, res) => {
  try {
    // Get 5 most recently registered students created by this admin
    const recentStudents = await User.find({
      role: 'student',
      createdBy: req.orgAdminId
    })
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(5);

    // Format students with additional data
    const formattedStudents = recentStudents.map(student => {
      // Format date for display
      const registeredDate = new Date(student.createdAt);
      const formattedDate = registeredDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });

      return {
        id: student._id,
        name: `${student.firstName} ${student.lastName}`,
        email: student.email,
        registeredDate: formattedDate,
        avatar: null, // Could be added in the future
        performance: Math.floor(Math.random() * 25) + 75 // Mock performance data
      };
    });

    res.json(formattedStudents);
  } catch (error) {
    console.error('Get recent students error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get security alerts
// @route   GET /api/admin/security-alerts
// @access  Private/Admin
const getSecurityAlerts = async (req, res) => {
  try {
    // Get all security alerts with populated student data
    const alerts = await SecurityAlert.find({})
      .populate('student', 'firstName lastName email class organization')
      .populate('exam', 'title')
      .sort({ timestamp: -1 });

    res.json(alerts);
  } catch (error) {
    console.error('Get security alerts error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Resolve a security alert
// @route   PUT /api/admin/security-alerts/:id/resolve
// @access  Private/Admin
const resolveSecurityAlert = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const alert = await SecurityAlert.findById(id);

    if (!alert) {
      return res.status(404).json({ message: 'Security alert not found' });
    }

    if (alert.status === 'resolved') {
      return res.status(400).json({ message: 'Alert is already resolved' });
    }

    // Resolve the alert
    await alert.resolve(req.user._id, notes);

    // Populate student data for the response
    const resolvedAlert = await SecurityAlert.findById(id)
      .populate('student', 'firstName lastName email')
      .populate('resolvedBy', 'firstName lastName');

    // Log the activity
    await ActivityLog.logActivity({
      user: req.user._id,
      action: 'resolve_alert',
      details: {
        alertId: alert._id,
        alertType: alert.type,
        studentId: alert.student,
        studentName: `${resolvedAlert.student.firstName} ${resolvedAlert.student.lastName}`
      }
    });

    res.json(resolvedAlert);
  } catch (error) {
    console.error('Resolve security alert error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Ignore a security alert
// @route   PUT /api/admin/security-alerts/:id/ignore
// @access  Private/Admin
const ignoreSecurityAlert = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const alert = await SecurityAlert.findById(id);

    if (!alert) {
      return res.status(404).json({ message: 'Security alert not found' });
    }

    if (alert.status !== 'unresolved') {
      return res.status(400).json({ message: 'Alert is already processed' });
    }

    // Ignore the alert
    await alert.ignore(req.user._id, notes);

    // Populate student data for the response
    const ignoredAlert = await SecurityAlert.findById(id)
      .populate('student', 'firstName lastName email')
      .populate('resolvedBy', 'firstName lastName');

    // Log the activity
    await ActivityLog.logActivity({
      user: req.user._id,
      action: 'ignore_alert',
      details: {
        alertId: alert._id,
        alertType: alert.type,
        studentId: alert.student
      }
    });

    res.json(ignoredAlert);
  } catch (error) {
    console.error('Ignore security alert error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Toggle exam lock status
// @route   PUT /api/admin/exams/:id/toggle-lock
// @access  Private/Admin
const toggleExamLock = async (req, res) => {
  try {
    const { id } = req.params;
    const { isLocked } = req.body;

    console.log(`Toggling exam lock for exam ${id} to ${isLocked}`);

    const exam = await Exam.findById(id);

    if (!exam) {
      console.log(`Exam not found with ID: ${id}`);
      return res.status(404).json({ message: 'Exam not found' });
    }

    // Update exam lock status
    exam.isLocked = isLocked;
    await exam.save();

    console.log(`Exam ${exam.title} (${exam._id}) lock status updated to: ${exam.isLocked}`);

    // Log the activity
    await ActivityLog.logActivity({
      user: req.user._id,
      action: isLocked ? 'lock_exam' : 'unlock_exam',
      details: {
        examId: exam._id,
        examTitle: exam.title
      }
    });

    res.json({
      _id: exam._id,
      title: exam.title,
      isLocked: exam.isLocked,
      message: `Exam ${isLocked ? 'locked' : 'unlocked'} successfully`
    });
  } catch (error) {
    console.error('Toggle exam lock error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get recent activity logs
// @route   GET /api/admin/activity-logs
// @access  Private/Admin
const getActivityLogs = async (req, res) => {
  try {
    const logs = await ActivityLog.find({})
      .populate('user', 'firstName lastName email')
      .sort({ timestamp: -1 })
      .limit(50);

    res.json(logs);
  } catch (error) {
    console.error('Get activity logs error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Create a new exam
// @route   POST /api/admin/exams
// @access  Private/Admin
const createExam = async (req, res) => {
  try {
    console.log('Create exam request received:', req.body);
    console.log('Files received:', req.files);
    console.log('createExam - req.orgAdminId:', req.orgAdminId);
    console.log('createExam - req.user._id:', req.user?._id);
    console.log('createExam - req.user.role:', req.user?.role);

    // Ensure we have a valid createdBy ID
    const createdById = req.orgAdminId || req.user?._id;
    if (!createdById) {
      return res.status(401).json({ message: 'Not authenticated or missing user information' });
    }

    const { title, timeLimit, isLocked, passingScore } = req.body;
    const description = req.body.description && req.body.description.trim() ? req.body.description.trim() : 'Exam';

    // Validate required fields
    if (!title || !timeLimit) {
      return res.status(400).json({ message: 'Please provide title and time limit' });
    }

    // Initialize file variables
    let examFilePath = null;
    let answerFilePath = null;

    // Check if files are uploaded
    if (req.files) {
      if (req.files.examFile) {
        const examFile = req.files.examFile[0];
        examFilePath = examFile.path;
        console.log('Exam file uploaded:', examFilePath);
      }

      if (req.files.answerFile) {
        const answerFile = req.files.answerFile[0];
        answerFilePath = answerFile.path;
        console.log('Answer file uploaded:', answerFilePath);
      }
    }

    // Convert isLocked to boolean if it's a string
    const isLockedBool = isLocked === 'true' || isLocked === true;

    console.log('Creating exam with data:', {
      title,
      description,
      timeLimit: Number(timeLimit),
      passingScore: Number(passingScore) || 70,
      originalFile: examFilePath ? 'Yes' : 'No',
      answerFile: answerFilePath ? 'Yes' : 'No',
      isLocked: isLockedBool
    });

    // Create exam
    console.log('About to create exam with createdBy:', createdById);
    const exam = await Exam.create({
      title,
      description,
      timeLimit: Number(timeLimit),
      passingScore: Number(passingScore) || 70,
      originalFile: examFilePath,
      answerFile: answerFilePath,
      isLocked: isLockedBool,
      createdBy: createdById,
      status: 'draft'
    });
    console.log('Exam created with _id:', exam._id, 'createdBy:', exam.createdBy);

    // Log activity
    await ActivityLog.logActivity({
      user: req.user._id,
      action: 'create_exam',
      details: {
        examId: exam._id,
        examTitle: exam.title
      }
    });

    // Parse the exam file to extract questions if it exists
    if (examFilePath) {
      try {
        const { parseFile } = require('../utils/fileParser');
        console.log('Attempting to parse exam file:', examFilePath);

        const parsedExam = await parseFile(examFilePath);
        console.log('Exam file parsed successfully');

        // Create default sections if they don't exist
        if (!exam.sections || exam.sections.length === 0) {
          exam.sections = [
            { name: 'A', description: 'Multiple Choice Questions', questions: [] },
            { name: 'B', description: 'Short Answer Questions', questions: [] },
            { name: 'C', description: 'Long Answer Questions', questions: [] }
          ];
          await exam.save();
          console.log('Created default sections for exam');
        }

        // Create questions for each section
        if (parsedExam && parsedExam.sections) {
          const Question = require('../models/Question');

          for (const section of parsedExam.sections) {
            if (section.questions && section.questions.length > 0) {
              // Find or create the section in the exam
              let examSection = exam.sections.find(s => s.name === section.name);
              if (!examSection) {
                exam.sections.push({
                  name: section.name,
                  description: section.description || `Section ${section.name}`,
                  questions: []
                });
                await exam.save();
                examSection = exam.sections.find(s => s.name === section.name);
                console.log(`Created new section ${section.name} for exam`);
              }

              for (const questionData of section.questions) {
                try {
                  // Validate question data before creating
                  let questionType = questionData.type || 'multiple-choice';

                  // Ensure type is valid
                  if (!['multiple-choice', 'open-ended'].includes(questionType)) {
                    console.warn(`Invalid question type: ${questionType}, defaulting to multiple-choice`);
                    questionType = 'multiple-choice';
                  }

                  // Ensure options are properly formatted for multiple-choice questions
                  let options = [];
                  if (questionType === 'multiple-choice') {
                    if (Array.isArray(questionData.options)) {
                      // Check if options are already in the correct format
                      if (questionData.options.length > 0 && typeof questionData.options[0] === 'object' && 'text' in questionData.options[0]) {
                        options = questionData.options;
                      } else {
                        // Convert simple string array to proper format
                        options = questionData.options.map(opt => ({
                          text: opt,
                          isCorrect: opt === questionData.correctAnswer
                        }));
                      }
                    } else {
                      // Default options if none provided
                      options = [
                        { text: 'Option A', isCorrect: true },
                        { text: 'Option B', isCorrect: false },
                        { text: 'Option C', isCorrect: false },
                        { text: 'Option D', isCorrect: false }
                      ];
                    }
                  }

                  // Ensure correctAnswer is provided
                  const correctAnswer = questionData.correctAnswer ||
                    (questionType === 'multiple-choice' ? 'Option A' : 'Sample answer');

                  // Create the question with validated data
                  const question = await Question.create({
                    text: questionData.text || 'Sample question',
                    type: questionType,
                    options: options,
                    correctAnswer: correctAnswer,
                    points: questionData.points || 1,
                    exam: exam._id,
                    section: section.name
                  });

                  // Add question to the appropriate section
                  const sectionIndex = exam.sections.findIndex(s => s.name === section.name);
                  if (sectionIndex !== -1) {
                    exam.sections[sectionIndex].questions.push(question._id);
                  }

                  console.log('Created question:', question._id, 'for section', section.name);
                } catch (questionError) {
                  console.error('Error creating question:', questionError);
                  // Continue with next question instead of failing the whole process
                }
              }
            }
          }

          // Save the exam with all questions
          await exam.save();
          console.log('Questions extracted and created successfully');
        }
      } catch (parseError) {
        console.error('Error parsing exam file:', parseError);
        // Don't delete the exam, just log the error
        console.log('Continuing without parsing questions');
      }
    }

    // Handle manually-provided sections with inline questions (manual exam creation, no file)
    if (!examFilePath && req.body.sections && Array.isArray(req.body.sections)) {
      console.log('Handling manual exam with sections:', req.body.sections.length);
      const TYPE_MAP = { 'fill-blank': 'fill-in-blank', 'short-answer': 'open-ended' };
      const HAS_OPTIONS = new Set(['multiple-choice', 'true-false']);

      // Step 1: ensure all sections exist on the exam document, then save once
      for (const sec of req.body.sections) {
        if (!sec.questions || !sec.questions.length) {
          console.log('Section has no questions, skipping:', sec.name);
          continue;
        }
        if (!exam.sections.find(s => s.name === sec.name)) {
          console.log('Adding new section:', sec.name);
          exam.sections.push({ name: sec.name, description: sec.description || `Section ${sec.name}`, questions: [] });
        } else {
          const existing = exam.sections.find(s => s.name === sec.name);
          if (sec.description) existing.description = sec.description;
          console.log('Updated existing section:', sec.name);
        }
      }
      await exam.save(); // persist sections so findIndex is stable
      console.log('Sections saved, now creating questions');

      // Step 2: create questions section by section
      for (const sec of req.body.sections) {
        if (!sec.questions || !sec.questions.length) continue;
        console.log(`Creating ${sec.questions.length} questions for section ${sec.name}`);
        for (const qd of sec.questions) {
          if (!qd.text) continue;
          const qType = TYPE_MAP[qd.type] || qd.type || 'multiple-choice';

          // Build options: only for MC/TF, strip empty-text options
          let options = [];
          if (qType === 'multiple-choice') {
            options = (qd.options || []).filter(o => o.text && o.text.trim());
          } else if (qType === 'true-false') {
            options = [
              { text: 'True',  isCorrect: qd.correctAnswer === 'True',  letter: 'A' },
              { text: 'False', isCorrect: qd.correctAnswer === 'False', letter: 'B' },
            ];
          }

          let correctAnswer = qd.correctAnswer || '';
          if (!correctAnswer && qType === 'multiple-choice') {
            const correct = options.find(o => o.isCorrect);
            correctAnswer = correct ? (correct.letter || correct.text) : 'Not provided';
          }
          if (!correctAnswer) correctAnswer = 'Not provided';

          try {
            const q = await Question.create({
              text: qd.text, type: qType, options, correctAnswer,
              points: qd.points || 1, difficulty: qd.difficulty || 'medium',
              exam: exam._id, section: sec.name,
            });
            const si = exam.sections.findIndex(s => s.name === sec.name);
            if (si !== -1) {
              exam.sections[si].questions.push(q._id);
              console.log(`Created question ${q._id} for section ${sec.name}`);
            }
          } catch (qErr) { console.error('Error creating question:', qErr.message); }
        }
      }
      await exam.save();
      console.log('Manual exam completed with sections and questions');
    }

    res.status(201).json(exam);
  } catch (error) {
    console.error('Create exam error:', error);

    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({ message: messages.join(', ') });
    }

    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Schedule an exam
// @route   POST /api/admin/schedule-exam
// @access  Private/Admin
const scheduleExam = async (req, res) => {
  try {
    const {
      examId,
      studentIds,
      date,
      startTime,
      endTime,
      sendNotification,
      allowLateSubmission
    } = req.body;

    // Validate required fields
    if (!examId || !date || !startTime || !endTime) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }

    // Check if exam exists
    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({ message: 'Exam not found' });
    }

    // Parse dates from ISO strings
    console.log('Received date data:', { date, startTime, endTime });

    let scheduledDate, startDateTime, endDateTime;

    try {
      // Parse the date
      scheduledDate = new Date(date);

      // Parse start and end times
      startDateTime = new Date(startTime);
      endDateTime = new Date(endTime);

      // Validate dates
      if (isNaN(scheduledDate.getTime())) {
        return res.status(400).json({ message: 'Invalid date format' });
      }

      if (isNaN(startDateTime.getTime())) {
        return res.status(400).json({ message: 'Invalid start time format' });
      }

      if (isNaN(endDateTime.getTime())) {
        return res.status(400).json({ message: 'Invalid end time format' });
      }

      console.log('Parsed dates:', {
        scheduledDate: scheduledDate.toISOString(),
        startDateTime: startDateTime.toISOString(),
        endDateTime: endDateTime.toISOString()
      });
    } catch (error) {
      console.error('Error parsing dates:', error);
      return res.status(400).json({ message: 'Error parsing date/time values' });
    }

    // Update exam with scheduling information
    exam.scheduledFor = scheduledDate;
    exam.startTime = startDateTime;
    exam.endTime = endDateTime;
    exam.status = 'scheduled';
    exam.allowLateSubmission = allowLateSubmission || false;

    // If studentIds are provided, assign the exam to those students
    if (studentIds && studentIds.length > 0) {
      // Ensure studentIds is an array
      const studentIdsArray = Array.isArray(studentIds) ? studentIds : [studentIds];
      console.log('Processing student IDs:', studentIdsArray);

      // Convert string IDs to ObjectIds if needed
      const validStudentIds = studentIdsArray.filter(id => {
        try {
          if (!id) {
            console.warn('Null or undefined student ID found');
            return false;
          }

          // Convert to string if it's an object with _id property
          const idStr = typeof id === 'object' && id._id ? id._id.toString() : id.toString();
          return mongoose.Types.ObjectId.isValid(idStr);
        } catch (err) {
          console.error('Invalid student ID:', id, err);
          return false;
        }
      });

      // If we already have assignedTo, merge the arrays and remove duplicates
      if (exam.assignedTo && exam.assignedTo.length > 0) {
        // Convert existing IDs to strings for comparison
        const existingIds = exam.assignedTo.map(id => id.toString());

        // Add only new IDs that don't already exist
        const newIds = validStudentIds.filter(id => !existingIds.includes(id.toString()));

        // Combine existing and new IDs
        const newObjectIds = newIds.map(id => {
          const idStr = typeof id === 'object' && id._id ? id._id.toString() : id.toString();
          return new mongoose.Types.ObjectId(idStr);
        });
        exam.assignedTo = [...exam.assignedTo, ...newObjectIds];
      } else {
        // Just set the new IDs
        exam.assignedTo = validStudentIds.map(id => {
          const idStr = typeof id === 'object' && id._id ? id._id.toString() : id.toString();
          return new mongoose.Types.ObjectId(idStr);
        });
      }

      console.log(`Assigned exam to ${exam.assignedTo.length} students`);
    }

    await exam.save();

    console.log('Exam scheduled successfully:', {
      _id: exam._id,
      title: exam.title,
      scheduledFor: exam.scheduledFor,
      startTime: exam.startTime,
      endTime: exam.endTime,
      assignedTo: exam.assignedTo?.length || 0
    });

    // Log activity
    try {
      await ActivityLog.logActivity({
        user: req.user._id,
        action: 'schedule_exam',
        details: {
          examId: exam._id,
          examTitle: exam.title,
          scheduledFor: scheduledDate
        }
      });
    } catch (logError) {
      // Just log the error but don't fail the request
      console.error('Error logging exam scheduling activity:', logError);
    }

    // Send notifications to students if requested
    if (sendNotification && studentIds && studentIds.length > 0) {
      // In a real app, this would send emails or push notifications
      console.log(`Notifications would be sent to ${studentIds.length} students`);
    }

    res.status(200).json({
      message: 'Exam scheduled successfully',
      exam: {
        _id: exam._id,
        title: exam.title,
        scheduledFor: exam.scheduledFor,
        startTime: exam.startTime,
        endTime: exam.endTime,
        status: exam.status,
        assignedTo: exam.assignedTo || []
      }
    });
  } catch (error) {
    console.error('Schedule exam error:', error);

    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({ message: messages.join(', ') });
    }

    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update a scheduled exam
// @route   PUT /api/admin/exams/:id/schedule
// @access  Private/Admin
const updateScheduledExam = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      studentIds,
      date,
      startTime,
      endTime,
      sendNotification,
      allowLateSubmission
    } = req.body;

    // Validate required fields
    if (!date || !startTime || !endTime) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }

    // Check if exam exists
    const exam = await Exam.findById(id);
    if (!exam) {
      return res.status(404).json({ message: 'Exam not found' });
    }

    // Parse dates from ISO strings
    console.log('Received date data for update:', { date, startTime, endTime });

    let scheduledDate, startDateTime, endDateTime;

    try {
      // Parse the date
      scheduledDate = new Date(date);

      // Parse start and end times
      startDateTime = new Date(startTime);
      endDateTime = new Date(endTime);

      // Validate dates
      if (isNaN(scheduledDate.getTime())) {
        return res.status(400).json({ message: 'Invalid date format' });
      }

      if (isNaN(startDateTime.getTime())) {
        return res.status(400).json({ message: 'Invalid start time format' });
      }

      if (isNaN(endDateTime.getTime())) {
        return res.status(400).json({ message: 'Invalid end time format' });
      }

      console.log('Parsed dates for update:', {
        scheduledDate: scheduledDate.toISOString(),
        startDateTime: startDateTime.toISOString(),
        endDateTime: endDateTime.toISOString()
      });
    } catch (error) {
      console.error('Error parsing dates:', error);
      return res.status(400).json({ message: 'Error parsing date/time values' });
    }

    // Update exam with scheduling information
    exam.scheduledFor = scheduledDate;
    exam.startTime = startDateTime;
    exam.endTime = endDateTime;
    exam.allowLateSubmission = allowLateSubmission || false;

    // If studentIds are provided, update the assigned students
    if (studentIds && studentIds.length > 0) {
      // Ensure studentIds is an array
      const studentIdsArray = Array.isArray(studentIds) ? studentIds : [studentIds];
      console.log('Processing student IDs for update:', studentIdsArray);

      // Convert string IDs to ObjectIds if needed
      const validStudentIds = studentIdsArray.filter(id => {
        try {
          if (!id) {
            console.warn('Null or undefined student ID found');
            return false;
          }

          // Convert to string if it's an object with _id property
          const idStr = typeof id === 'object' && id._id ? id._id.toString() : id.toString();
          return mongoose.Types.ObjectId.isValid(idStr);
        } catch (err) {
          console.error('Invalid student ID:', id, err);
          return false;
        }
      });

      // Set the new student IDs
      exam.assignedTo = validStudentIds.map(id => {
        const idStr = typeof id === 'object' && id._id ? id._id.toString() : id.toString();
        return new mongoose.Types.ObjectId(idStr);
      });

      console.log(`Updated exam with ${exam.assignedTo.length} students`);
    }

    await exam.save();

    console.log('Exam schedule updated successfully:', {
      _id: exam._id,
      title: exam.title,
      scheduledFor: exam.scheduledFor,
      startTime: exam.startTime,
      endTime: exam.endTime,
      assignedTo: exam.assignedTo?.length || 0
    });

    // Log activity
    try {
      await ActivityLog.logActivity({
        user: req.user._id,
        action: 'update_exam_schedule',
        details: {
          examId: exam._id,
          examTitle: exam.title,
          scheduledFor: scheduledDate
        }
      });
    } catch (logError) {
      // Just log the error but don't fail the request
      console.error('Error logging exam schedule update activity:', logError);
    }

    // Send notifications to students if requested
    if (sendNotification && studentIds && studentIds.length > 0) {
      // In a real app, this would send emails or push notifications
      console.log(`Notifications would be sent to ${studentIds.length} students about schedule changes`);
    }

    res.status(200).json({
      message: 'Exam schedule updated successfully',
      exam: {
        _id: exam._id,
        title: exam.title,
        scheduledFor: exam.scheduledFor,
        startTime: exam.startTime,
        endTime: exam.endTime,
        status: exam.status,
        assignedTo: exam.assignedTo || []
      }
    });
  } catch (error) {
    console.error('Update scheduled exam error:', error);

    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({ message: messages.join(', ') });
    }

    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get all exam results for exams created by this admin
// @route   GET /api/admin/results
// @access  Private/Admin
const getAllResults = async (req, res) => {
  try {
    // Get students created by this admin
    const students = await User.find({
      role: 'student',
      createdBy: req.orgAdminId
    }).select('_id');

    const studentIds = students.map(student => student._id);

    // Get all exams created by this admin
    const exams = await Exam.find({ createdBy: req.orgAdminId }).select('_id');
    const examIds = exams.map(exam => exam._id);

    // Get all results for students created by this admin taking exams created by this admin
    const results = await Result.find({
      isCompleted: true,
      student: { $in: studentIds },
      exam: { $in: examIds }
    })
      .populate('student', 'firstName lastName fullName email organization studentClass studentId')
      .populate('exam', 'title totalPoints')
      .sort({ endTime: -1 });

    // Format the results with enhanced data
    const formattedResults = results.map(result => {
      const percentage = result.maxPossibleScore > 0
        ? Math.round((result.totalScore / result.maxPossibleScore) * 100)
        : 0;

      // Calculate time taken in minutes
      const timeTaken = result.endTime && result.startTime
        ? Math.round((new Date(result.endTime) - new Date(result.startTime)) / (1000 * 60))
        : 0;

      // Determine grade based on percentage
      let grade = 'F';
      if (percentage >= 90) grade = 'A';
      else if (percentage >= 80) grade = 'B';
      else if (percentage >= 70) grade = 'C';
      else if (percentage >= 60) grade = 'D';

      return {
        _id: result._id,
        student: {
          _id: result.student?._id || null,
          fullName: result.student?.fullName ||
                   (result.student ? `${result.student.firstName || ''} ${result.student.lastName || ''}`.trim() : 'Unknown'),
          firstName: result.student?.firstName || '',
          lastName: result.student?.lastName || '',
          email: result.student?.email || 'Unknown',
          studentId: result.student?.studentId || '',
          organization: result.student?.organization || '',
          studentClass: result.student?.studentClass || ''
        },
        exam: {
          _id: result.exam?._id || null,
          title: result.exam?.title || 'Unknown',
          totalPoints: result.exam?.totalPoints || result.maxPossibleScore
        },
        totalScore: result.totalScore || 0,
        maxPossibleScore: result.maxPossibleScore || 0,
        percentage,
        grade,
        timeTaken,
        startTime: result.startTime,
        endTime: result.endTime,
        isCompleted: result.isCompleted,
        aiGradingStatus: result.aiGradingStatus || 'completed'
      };
    });

    // Add summary statistics
    const summary = {
      totalResults: formattedResults.length,
      averageScore: formattedResults.length > 0
        ? Math.round(formattedResults.reduce((sum, result) => sum + result.percentage, 0) / formattedResults.length)
        : 0,
      excellentCount: formattedResults.filter(r => r.percentage >= 90).length,
      goodCount: formattedResults.filter(r => r.percentage >= 70 && r.percentage < 90).length,
      averageCount: formattedResults.filter(r => r.percentage >= 50 && r.percentage < 70).length,
      poorCount: formattedResults.filter(r => r.percentage < 50).length
    };

    res.json({
      results: formattedResults,
      summary
    });
  } catch (error) {
    console.error('Get all results error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get student performance analytics for admin dashboard
// @route   GET /api/admin/analytics/student-performance
// @access  Private/Admin
const getStudentPerformanceAnalytics = async (req, res) => {
  try {
    // Get students created by this admin
    const students = await User.find({
      role: 'student',
      createdBy: req.orgAdminId
    }).select('_id firstName lastName fullName email organization studentClass');

    const studentIds = students.map(student => student._id);

    // Get exams created by this admin
    const exams = await Exam.find({ createdBy: req.orgAdminId }).select('_id title');
    const examIds = exams.map(exam => exam._id);

    // Get all results for students created by this admin taking exams created by this admin
    const results = await Result.find({
      isCompleted: true,
      student: { $in: studentIds },
      exam: { $in: examIds }
    })
      .populate('student', 'firstName lastName fullName email organization studentClass')
      .populate('exam', 'title')
      .sort({ endTime: -1 });

    // Calculate student performance metrics
    const studentPerformance = {};

    results.forEach(result => {
      const studentId = result.student._id.toString();

      if (!studentPerformance[studentId]) {
        studentPerformance[studentId] = {
          student: result.student,
          exams: [],
          totalScore: 0,
          totalMaxScore: 0,
          examCount: 0,
          averageScore: 0,
          bestScore: 0,
          worstScore: 100,
          improvementTrend: 0
        };
      }

      const percentage = result.maxPossibleScore > 0
        ? Math.round((result.totalScore / result.maxPossibleScore) * 100)
        : 0;

      const timeTaken = result.endTime && result.startTime
        ? Math.round((new Date(result.endTime) - new Date(result.startTime)) / (1000 * 60))
        : 0;

      studentPerformance[studentId].exams.push({
        examId: result.exam._id,
        examTitle: result.exam.title,
        score: result.totalScore,
        maxScore: result.maxPossibleScore,
        percentage,
        timeTaken,
        completedAt: result.endTime
      });

      studentPerformance[studentId].totalScore += result.totalScore;
      studentPerformance[studentId].totalMaxScore += result.maxPossibleScore;
      studentPerformance[studentId].examCount++;
      studentPerformance[studentId].bestScore = Math.max(studentPerformance[studentId].bestScore, percentage);
      studentPerformance[studentId].worstScore = Math.min(studentPerformance[studentId].worstScore, percentage);
    });

    // Calculate final metrics and trends
    const performanceArray = Object.values(studentPerformance).map(student => {
      student.averageScore = student.totalMaxScore > 0
        ? Math.round((student.totalScore / student.totalMaxScore) * 100)
        : 0;

      // Calculate improvement trend (compare first 3 and last 3 exams)
      if (student.exams.length >= 3) {
        const sortedExams = student.exams.sort((a, b) => new Date(a.completedAt) - new Date(b.completedAt));
        const firstThree = sortedExams.slice(0, 3);
        const lastThree = sortedExams.slice(-3);

        const firstAvg = firstThree.reduce((sum, exam) => sum + exam.percentage, 0) / firstThree.length;
        const lastAvg = lastThree.reduce((sum, exam) => sum + exam.percentage, 0) / lastThree.length;

        student.improvementTrend = Math.round(lastAvg - firstAvg);
      }

      return {
        id: student.student._id,
        name: student.student.fullName ||
              `${student.student.firstName || ''} ${student.student.lastName || ''}`.trim(),
        email: student.student.email,
        organization: student.student.organization,
        studentClass: student.student.studentClass,
        exams: student.examCount,
        avgScore: student.averageScore,
        bestScore: student.bestScore,
        worstScore: student.worstScore === 100 ? 0 : student.worstScore,
        trend: student.improvementTrend,
        lastExam: student.exams.length > 0
          ? student.exams.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))[0].completedAt
          : null,
        performance: student.averageScore >= 90 ? 'excellent' :
                    student.averageScore >= 70 ? 'good' :
                    student.averageScore >= 50 ? 'average' : 'poor'
      };
    });

    // Sort by average score descending
    performanceArray.sort((a, b) => b.avgScore - a.avgScore);

    // Calculate overall statistics
    const overallStats = {
      totalStudents: performanceArray.length,
      studentsWithExams: performanceArray.filter(s => s.exams > 0).length,
      averageClassScore: performanceArray.length > 0
        ? Math.round(performanceArray.reduce((sum, s) => sum + s.avgScore, 0) / performanceArray.length)
        : 0,
      excellentStudents: performanceArray.filter(s => s.performance === 'excellent').length,
      goodStudents: performanceArray.filter(s => s.performance === 'good').length,
      averageStudents: performanceArray.filter(s => s.performance === 'average').length,
      poorStudents: performanceArray.filter(s => s.performance === 'poor').length,
      improvingStudents: performanceArray.filter(s => s.trend > 0).length,
      decliningStudents: performanceArray.filter(s => s.trend < 0).length
    };

    res.json({
      students: performanceArray,
      stats: overallStats
    });
  } catch (error) {
    console.error('Get student performance analytics error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Debug admin data to troubleshoot issues
// @route   GET /api/admin/debug
// @access  Private/Admin
const debugAdminData = async (req, res) => {
  try {
    const adminId = req.user._id;

    // Get admin info
    const admin = await User.findById(adminId).select('firstName lastName email role');

    // Get exams created by this admin
    const exams = await Exam.find({ createdBy: adminId })
      .select('title createdAt isLocked')
      .sort({ createdAt: -1 });

    // Get students created by this admin
    const studentsCreatedByAdmin = await User.find({
      role: 'student',
      createdBy: adminId
    }).select('firstName lastName email createdAt');

    // Get all students who have taken exams created by this admin
    const examIds = exams.map(exam => exam._id);
    const allResults = await Result.find({ exam: { $in: examIds } })
      .populate('student', 'firstName lastName email createdBy')
      .populate('exam', 'title')
      .select('student exam isCompleted totalScore maxPossibleScore endTime');

    // Get unique students who took exams
    const studentsWhoTookExams = [];
    const studentMap = new Map();

    allResults.forEach(result => {
      if (result.student && !studentMap.has(result.student._id.toString())) {
        studentMap.set(result.student._id.toString(), {
          _id: result.student._id,
          name: `${result.student.firstName || ''} ${result.student.lastName || ''}`.trim(),
          email: result.student.email,
          createdBy: result.student.createdBy,
          createdByThisAdmin: result.student.createdBy?.toString() === adminId.toString()
        });
        studentsWhoTookExams.push(studentMap.get(result.student._id.toString()));
      }
    });

    // Count results by status
    const completedResults = allResults.filter(r => r.isCompleted);
    const pendingResults = allResults.filter(r => !r.isCompleted);

    const debugInfo = {
      admin: {
        id: admin._id,
        name: `${admin.firstName} ${admin.lastName}`,
        email: admin.email,
        role: admin.role
      },
      exams: {
        total: exams.length,
        locked: exams.filter(e => e.isLocked).length,
        unlocked: exams.filter(e => !e.isLocked).length,
        list: exams.map(e => ({
          id: e._id,
          title: e.title,
          isLocked: e.isLocked,
          createdAt: e.createdAt
        }))
      },
      students: {
        createdByThisAdmin: studentsCreatedByAdmin.length,
        whoTookExams: studentsWhoTookExams.length,
        createdByThisAdminList: studentsCreatedByAdmin.map(s => ({
          id: s._id,
          name: `${s.firstName} ${s.lastName}`,
          email: s.email
        })),
        whoTookExamsList: studentsWhoTookExams
      },
      results: {
        total: allResults.length,
        completed: completedResults.length,
        pending: pendingResults.length,
        completedList: completedResults.map(r => ({
          id: r._id,
          student: r.student ? `${r.student.firstName} ${r.student.lastName}` : 'Unknown',
          exam: r.exam?.title || 'Unknown',
          score: `${r.totalScore}/${r.maxPossibleScore}`,
          percentage: r.maxPossibleScore > 0 ? Math.round((r.totalScore / r.maxPossibleScore) * 100) : 0,
          completedAt: r.endTime
        }))
      }
    };

    res.json(debugInfo);
  } catch (error) {
    console.error('Debug admin data error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get student results for admin to review and regrade
// @route   GET /api/admin/student-results
// @access  Private/Admin
const getStudentResultsForRegrade = async (req, res) => {
  try {
    console.log('=== ADMIN STUDENT RESULTS ENDPOINT HIT ===');
    console.log('Query params:', req.query);
    console.log('Admin user:', req.user._id);

    const { examId, studentId, status, sortBy = 'endTime', sortOrder = 'desc' } = req.query;

    // Build query for results
    let query = { isCompleted: true };

    // Get students created by this admin
    const students = await User.find({
      role: 'student',
      createdBy: req.orgAdminId
    }).select('_id');

    const studentIds = students.map(student => student._id);

    // Get exams created by this admin
    const exams = await Exam.find({ createdBy: req.orgAdminId }).select('_id');
    const examIds = exams.map(exam => exam._id);

    console.log(`Admin ${req.user._id} has ${studentIds.length} students and ${examIds.length} exams`);

    // Filter by admin's students and exams - but be more flexible
    if (studentIds.length > 0 && examIds.length > 0) {
      query.$or = [
        { student: { $in: studentIds }, exam: { $in: examIds } }, // Both student and exam by admin
        { student: { $in: studentIds } }, // Student by admin (any exam)
        { exam: { $in: examIds } } // Exam by admin (any student)
      ];
    } else if (studentIds.length > 0) {
      query.student = { $in: studentIds };
    } else if (examIds.length > 0) {
      query.exam = { $in: examIds };
    } else {
      // Admin has no students or exams, return empty results
      return res.json({
        results: [],
        summary: {
          totalResults: 0,
          needsReview: 0,
          potentialImprovements: 0,
          averageScore: 0,
          gradeDistribution: { excellent: 0, good: 0, average: 0, poor: 0 }
        },
        filters: { examId: examId || null, studentId: studentId || null, status: status || null, sortBy, sortOrder }
      });
    }

    // Apply additional filters
    if (examId) {
      query.exam = examId;
    }

    if (studentId) {
      query.student = studentId;
    }

    if (status) {
      if (status === 'needs-grading') {
        query.$or = [
          { aiGradingStatus: { $ne: 'completed' } },
          { aiGradingStatus: { $exists: false } },
          { 'answers.score': 0, 'answers.textAnswer': { $exists: true, $ne: '' } }
        ];
      } else if (status === 'low-scores') {
        // We'll filter this after getting results
      }
    }

    // Get results with populated data
    const results = await Result.find(query)
      .populate({
        path: 'student',
        select: 'firstName lastName fullName email organization studentClass studentId'
      })
      .populate({
        path: 'exam',
        select: 'title description totalPoints timeLimit'
      })
      .populate({
        path: 'answers.question',
        select: 'text type points correctAnswer section'
      })
      .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 });

    // Format results with enhanced data for regrading
    const formattedResults = results.map(result => {
      const percentage = result.maxPossibleScore > 0
        ? Math.round((result.totalScore / result.maxPossibleScore) * 100)
        : 0;

      const timeTaken = result.endTime && result.startTime
        ? Math.round((new Date(result.endTime) - new Date(result.startTime)) / (1000 * 60))
        : 0;

      // Analyze answers for regrading opportunities
      const answerAnalysis = {
        totalAnswers: result.answers.length,
        answersWithZeroScore: result.answers.filter(a => (a.score || 0) === 0 && (a.textAnswer || a.selectedOption)).length,
        answersNeedingReview: result.answers.filter(a =>
          !a.feedback ||
          a.feedback.includes('keyword matching') ||
          a.feedback.includes('Unable to grade')
        ).length,
        potentialImprovements: result.answers.filter(a => {
          const question = a.question;
          if (!question) return false;

          // Check for semantic matches that might have been missed
          if (question.type === 'multiple-choice' && a.selectedOption && question.correctAnswer) {
            const selected = (a.selectedOption || '').toLowerCase().trim();
            const correct = (question.correctAnswer || '').toLowerCase().trim();
            return (a.score || 0) === 0 && (
              selected === correct ||
              correct.includes(selected) ||
              selected.includes(correct)
            );
          }
          return false;
        }).length
      };

      return {
        _id: result._id,
        student: {
          _id: result.student._id,
          name: result.student.fullName ||
                `${result.student.firstName || ''} ${result.student.lastName || ''}`.trim(),
          email: result.student.email,
          organization: result.student.organization,
          studentClass: result.student.studentClass,
          studentId: result.student.studentId
        },
        exam: {
          _id: result.exam._id,
          title: result.exam.title,
          description: result.exam.description,
          totalPoints: result.exam.totalPoints,
          timeLimit: result.exam.timeLimit
        },
        scores: {
          totalScore: result.totalScore,
          maxPossibleScore: result.maxPossibleScore,
          percentage
        },
        timing: {
          startTime: result.startTime,
          endTime: result.endTime,
          timeTaken
        },
        grading: {
          aiGradingStatus: result.aiGradingStatus || 'pending',
          needsReview: answerAnalysis.answersNeedingReview > 0 || answerAnalysis.potentialImprovements > 0,
          potentialImprovement: answerAnalysis.potentialImprovements > 0
        },
        analysis: answerAnalysis,
        grade: percentage >= 90 ? 'A' : percentage >= 80 ? 'B' : percentage >= 70 ? 'C' : percentage >= 60 ? 'D' : 'F',
        performance: percentage >= 90 ? 'excellent' : percentage >= 70 ? 'good' : percentage >= 50 ? 'average' : 'poor'
      };
    });

    // Apply low-scores filter if requested
    let filteredResults = formattedResults;
    if (status === 'low-scores') {
      filteredResults = formattedResults.filter(r => r.scores.percentage < 70);
    }

    // Calculate summary statistics
    const summary = {
      totalResults: filteredResults.length,
      needsReview: filteredResults.filter(r => r.grading.needsReview).length,
      potentialImprovements: filteredResults.filter(r => r.grading.potentialImprovement).length,
      averageScore: filteredResults.length > 0
        ? Math.round(filteredResults.reduce((sum, r) => sum + r.scores.percentage, 0) / filteredResults.length)
        : 0,
      gradeDistribution: {
        excellent: filteredResults.filter(r => r.performance === 'excellent').length,
        good: filteredResults.filter(r => r.performance === 'good').length,
        average: filteredResults.filter(r => r.performance === 'average').length,
        poor: filteredResults.filter(r => r.performance === 'poor').length
      }
    };

    res.json({
      results: filteredResults,
      summary,
      filters: {
        examId: examId || null,
        studentId: studentId || null,
        status: status || null,
        sortBy,
        sortOrder
      }
    });

  } catch (error) {
    console.error('Get student results for regrade error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Regrade a specific student result
// @route   POST /api/admin/regrade-result/:resultId
// @access  Private/Admin
const regradeStudentResult = async (req, res) => {
  try {
    const { resultId } = req.params;
    const { method = 'ai', forceRegrade = false } = req.body;

    // Find the result and verify admin ownership
    const result = await Result.findById(resultId)
      .populate({
        path: 'student',
        select: 'firstName lastName email createdBy'
      })
      .populate({
        path: 'exam',
        select: 'title createdBy'
      });

    if (!result) {
      return res.status(404).json({ message: 'Result not found' });
    }

    // Verify admin has access to this result
    const hasAccess = result.exam.createdBy.toString() === req.user._id.toString() ||
                     result.student.createdBy.toString() === req.user._id.toString();

    if (!hasAccess) {
      return res.status(403).json({ message: 'Not authorized to regrade this result' });
    }

    console.log(`Admin ${req.user._id} regrading result ${resultId} using method: ${method}`);

    let regradingResult;

    // Store the old score before regrading
    const oldScore = result.totalScore || 0;
    const oldPercentage = result.maxPossibleScore > 0 ? Math.round((oldScore / result.maxPossibleScore) * 100) : 0;

    if (method === 'ai') {
      // Use AI regrading
      const { regradeExamResult } = require('../utils/gradeExam');
      regradingResult = await regradeExamResult(resultId, forceRegrade);

      // Ensure we have the old score information
      if (!regradingResult.oldScore) {
        regradingResult.oldScore = oldScore;
        regradingResult.oldPercentage = oldPercentage;
      }
    } else if (method === 'comprehensive') {
      // Use comprehensive AI grading
      const { gradeQuestionByType } = require('../utils/enhancedGrading');

      // Reload result with questions
      const fullResult = await Result.findById(resultId)
        .populate({
          path: 'answers.question',
          select: 'text type points correctAnswer options'
        });

      let totalScore = 0;
      let improvedAnswers = 0;

      for (let i = 0; i < fullResult.answers.length; i++) {
        const answer = fullResult.answers[i];
        const question = answer.question;

        if (!question) continue;

        try {
          const grading = await gradeQuestionByType(question, answer, question.correctAnswer);

          const oldScore = answer.score || 0;
          const newScore = grading.score || 0;

          fullResult.answers[i].score = newScore;
          fullResult.answers[i].feedback = grading.feedback || 'Regraded by admin';
          fullResult.answers[i].isCorrect = newScore >= question.points;
          fullResult.answers[i].correctedAnswer = grading.correctedAnswer || question.correctAnswer;
          fullResult.answers[i].gradingMethod = grading.details?.gradingMethod || 'admin_regrade'; // Track grading method

          totalScore += newScore;

          if (newScore !== oldScore) {
            improvedAnswers++;
            console.log(`Answer ${i}: Score changed from ${oldScore} to ${newScore}`);
          }

        } catch (gradingError) {
          console.error(`Error regrading answer ${i}:`, gradingError.message);
          totalScore += answer.score || 0;
        }
      }

      fullResult.totalScore = totalScore;
      fullResult.aiGradingStatus = 'completed';

      // Save the result to ensure database persistence like regrading system
      await fullResult.save();
      console.log(`Admin regrade completed and saved to database for result ${resultId}`);

      regradingResult = {
        resultId,
        oldScore,
        oldPercentage,
        totalScore,
        maxPossibleScore: fullResult.maxPossibleScore,
        percentage: (totalScore / fullResult.maxPossibleScore) * 100,
        improvedAnswers
      };
    }

    // Get updated result for response
    const updatedResult = await Result.findById(resultId)
      .populate('student', 'firstName lastName email')
      .populate('exam', 'title');

    const newPercentage = updatedResult.maxPossibleScore > 0
      ? Math.round((updatedResult.totalScore / updatedResult.maxPossibleScore) * 100)
      : 0;

    res.json({
      message: 'Result regraded successfully',
      result: {
        _id: updatedResult._id,
        student: `${updatedResult.student.firstName} ${updatedResult.student.lastName}`,
        exam: updatedResult.exam.title,
        oldScore: regradingResult.oldScore || 'N/A',
        newScore: updatedResult.totalScore,
        maxScore: updatedResult.maxPossibleScore,
        oldPercentage: regradingResult.oldPercentage || 'N/A',
        newPercentage,
        improvement: (updatedResult.totalScore - (regradingResult.oldScore || updatedResult.totalScore)),
        method
      }
    });

  } catch (error) {
    console.error('Regrade student result error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Register a new teacher (instructor) - Only organization admins can do this
// @route   POST /api/admin/teachers
// @access  Private/Admin only (not teachers)
const registerTeacher = async (req, res) => {
  try {
    // Only admins can create teachers
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only organization admins can create teachers' });
    }

    const { firstName, lastName, email, password, phone, class: teacherClass } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }

    // Check if teacher already exists
    const teacherExists = await User.findOne({ email });

    if (teacherExists) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    // Get the admin's organization
    const admin = await User.findById(req.user._id);

    // Enforce teacher limit based on org plan
    const { getPlanConfigForUser } = require('../config/plans');
    const planConfig = getPlanConfigForUser(admin.subscriptionPlan, 'organization');
    const currentTeacherCount = await User.countDocuments({ parentAdmin: req.user._id, role: 'teacher' });
    if (planConfig.maxTeachers !== Infinity && currentTeacherCount >= planConfig.maxTeachers) {
      return res.status(403).json({
        message: `Your ${admin.subscriptionPlan || 'free'} plan allows a maximum of ${planConfig.maxTeachers} teacher${planConfig.maxTeachers === 1 ? '' : 's'}. Please upgrade your plan to add more teachers.`,
        limit: planConfig.maxTeachers,
        current: currentTeacherCount
      });
    }

    // Create teacher
    const teacher = await User.create({
      firstName,
      lastName,
      email,
      password,
      role: 'teacher',
      userType: 'organization',   // org teacher, NOT individual
      phone,
      class: teacherClass || '',
      organization: admin.organization,
      parentAdmin: req.user._id,
      createdBy: req.user._id,
      // Teacher inherits org plan — status mirrors admin's
      subscriptionPlan: admin.subscriptionPlan || 'free',
      subscriptionStatus: admin.subscriptionStatus || 'active'
    });

    // Log the activity
    await ActivityLog.logActivity({
      user: req.user._id,
      action: 'add_teacher',
      details: {
        teacherId: teacher._id,
        teacherName: `${teacher.firstName} ${teacher.lastName}`,
        teacherEmail: teacher.email
      }
    });

    res.status(201).json({
      _id: teacher._id,
      firstName: teacher.firstName,
      lastName: teacher.lastName,
      email: teacher.email,
      role: teacher.role,
      phone: teacher.phone,
      class: teacher.class,
      organization: teacher.organization
    });
  } catch (error) {
    console.error('Register teacher error:', error);

    // Handle duplicate key error (MongoDB error code 11000)
    if (error.code === 11000) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    res.status(500).json({ message: 'Server error. Please try again.' });
  }
};

// @desc    Get all teachers created by this admin
// @route   GET /api/admin/teachers
// @access  Private/Admin
const getTeachers = async (req, res) => {
  try {
    // Only admins can view their teachers
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Find teachers created by this admin
    const teachers = await User.find({
      role: 'teacher',
      parentAdmin: req.user._id
    }).select('-password');

    res.json(teachers);
  } catch (error) {
    console.error('Get teachers error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get teacher by ID
// @route   GET /api/admin/teachers/:id
// @access  Private/Admin
const getTeacherById = async (req, res) => {
  try {
    // Only admins can view their teachers
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const teacher = await User.findById(req.params.id).select('-password');

    // Check if teacher exists, is a teacher, and was created by this admin
    if (teacher && teacher.role === 'teacher' &&
        (teacher.parentAdmin && teacher.parentAdmin.toString() === req.user._id.toString())) {
      res.json(teacher);
    } else {
      res.status(404).json({ message: 'Teacher not found' });
    }
  } catch (error) {
    console.error('Get teacher by ID error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update teacher
// @route   PUT /api/admin/teachers/:id
// @access  Private/Admin
const updateTeacher = async (req, res) => {
  try {
    // Only admins can update their teachers
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { firstName, lastName, email, phone, class: teacherClass, isBlocked } = req.body;

    const teacher = await User.findById(req.params.id);

    // Check if teacher exists, is a teacher, and was created by this admin
    if (teacher && teacher.role === 'teacher' &&
        (teacher.parentAdmin && teacher.parentAdmin.toString() === req.user._id.toString())) {
      // Update teacher fields
      if (firstName) teacher.firstName = firstName;
      if (lastName) teacher.lastName = lastName;
      if (email) teacher.email = email;
      if (phone) teacher.phone = phone;
      if (teacherClass) teacher.class = teacherClass;
      if (isBlocked !== undefined) teacher.isBlocked = isBlocked;

      const updatedTeacher = await teacher.save();

      // Log the activity
      await ActivityLog.logActivity({
        user: req.user._id,
        action: 'edit_teacher',
        details: {
          teacherId: updatedTeacher._id,
          teacherName: `${updatedTeacher.firstName} ${updatedTeacher.lastName}`
        }
      });

      res.json({
        _id: updatedTeacher._id,
        firstName: updatedTeacher.firstName,
        lastName: updatedTeacher.lastName,
        email: updatedTeacher.email,
        role: updatedTeacher.role,
        phone: updatedTeacher.phone,
        class: updatedTeacher.class,
        isBlocked: updatedTeacher.isBlocked
      });
    } else {
      res.status(404).json({ message: 'Teacher not found' });
    }
  } catch (error) {
    console.error('Update teacher error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Delete teacher
// @route   DELETE /api/admin/teachers/:id
// @access  Private/Admin
const deleteTeacher = async (req, res) => {
  try {
    // Only admins can delete their teachers
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const teacher = await User.findById(req.params.id);

    // Check if teacher exists, is a teacher, and was created by this admin
    if (teacher && teacher.role === 'teacher' &&
        (teacher.parentAdmin && teacher.parentAdmin.toString() === req.user._id.toString())) {
      const teacherName = `${teacher.firstName} ${teacher.lastName}`;
      await teacher.deleteOne();

      // Log the activity
      await ActivityLog.logActivity({
        user: req.user._id,
        action: 'delete_teacher',
        details: {
          teacherId: req.params.id,
          teacherName: teacherName
        }
      });

      res.json({ message: 'Teacher removed successfully' });
    } else {
      res.status(404).json({ message: 'Teacher not found' });
    }
  } catch (error) {
    console.error('Delete teacher error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get organization subscription and details
// @route   GET /api/admin/organization
// @access  Private/Admin
const getOrganizationDetails = async (req, res) => {
  try {
    // Only admins can view their organization details
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const admin = await User.findById(req.user._id).select('-password');

    // Count teachers
    const teacherCount = await User.countDocuments({
      role: 'teacher',
      parentAdmin: req.user._id
    });

    // Count students
    const studentCount = await User.countDocuments({
      role: 'student',
      createdBy: req.user._id
    });

    // Count exams
    const examCount = await Exam.countDocuments({ createdBy: req.user._id });

    res.json({
      organization: {
        _id: admin._id,
        name: admin.organization,
        email: admin.email,
        firstName: admin.firstName,
        lastName: admin.lastName,
        phone: admin.phone,
        subscriptionPlan: admin.subscriptionPlan,
        subscriptionStatus: admin.subscriptionStatus,
        subscriptionExpiresAt: admin.subscriptionExpiresAt,
        createdAt: admin.createdAt
      },
      stats: {
        teacherCount,
        studentCount,
        examCount
      }
    });
  } catch (error) {
    console.error('Get organization details error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Question Bank ───────────────────────────────────────────────────────────

// @desc    Get all questions from exams created by this admin
// @route   GET /api/admin/questions
// @access  Private/Admin or Teacher
const getQuestions = async (req, res) => {
  try {
    const Question = require('../models/Question');
    const exams = await Exam.find({ createdBy: req.orgAdminId }).select('_id title');
    const examIds = exams.map(e => e._id);
    const questions = await Question.find({ exam: { $in: examIds } })
      .populate('exam', 'title')
      .sort({ createdAt: -1 })
      .lean();
    res.json(questions);
  } catch (err) {
    console.error('getQuestions error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update a question
// @route   PUT /api/admin/questions/:id
// @access  Private/Admin or Teacher
const updateQuestion = async (req, res) => {
  try {
    const Question = require('../models/Question');
    const q = await Question.findById(req.params.id).populate('exam', 'createdBy');
    if (!q) return res.status(404).json({ message: 'Question not found' });
    if (q.exam.createdBy.toString() !== req.orgAdminId.toString())
      return res.status(403).json({ message: 'Not authorized' });
    const { text, type, points, difficulty, correctAnswer, options } = req.body;
    if (text !== undefined) q.text = text;
    if (type !== undefined) q.type = type;
    if (points !== undefined) q.points = points;
    if (difficulty !== undefined) q.difficulty = difficulty;
    if (correctAnswer !== undefined) q.correctAnswer = correctAnswer;
    if (options !== undefined) q.options = options;
    await q.save();
    res.json(q);
  } catch (err) {
    console.error('updateQuestion error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Delete a question
// @route   DELETE /api/admin/questions/:id
// @access  Private/Admin or Teacher
const deleteQuestion = async (req, res) => {
  try {
    const Question = require('../models/Question');
    const q = await Question.findById(req.params.id).populate('exam', 'createdBy');
    if (!q) return res.status(404).json({ message: 'Question not found' });
    if (q.exam.createdBy.toString() !== req.orgAdminId.toString())
      return res.status(403).json({ message: 'Not authorized' });
    await q.deleteOne();
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('deleteQuestion error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Templates ────────────────────────────────────────────────────────────────

// @desc    Get exam templates (exams with status 'template') created by this admin
// @route   GET /api/admin/templates
// @access  Private/Admin or Teacher
const getTemplates = async (req, res) => {
  try {
    const templates = await Exam.find({ createdBy: req.orgAdminId, status: 'template' })
      .select('title description timeLimit passingScore sections totalPoints createdAt')
      .populate({ path: 'sections.questions', select: 'text type points' })
      .sort({ createdAt: -1 })
      .lean();
    res.json(templates);
  } catch (err) {
    console.error('getTemplates error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Save an existing exam as a template
// @route   POST /api/admin/templates
// @access  Private/Admin or Teacher
const createTemplate = async (req, res) => {
  try {
    const { examId } = req.body;
    if (!examId) return res.status(400).json({ message: 'examId is required' });
    const source = await Exam.findOne({ _id: examId, createdBy: req.orgAdminId });
    if (!source) return res.status(404).json({ message: 'Exam not found' });
    const tmpl = new Exam({
      title: `[Template] ${source.title}`,
      description: source.description,
      timeLimit: source.timeLimit,
      passingScore: source.passingScore,
      sections: source.sections,
      totalPoints: source.totalPoints,
      allowSelectiveAnswering: source.allowSelectiveAnswering,
      sectionBRequiredQuestions: source.sectionBRequiredQuestions,
      sectionCRequiredQuestions: source.sectionCRequiredQuestions,
      createdBy: req.orgAdminId,
      status: 'template',
      isLocked: true,
    });
    await tmpl.save();
    res.status(201).json(tmpl);
  } catch (err) {
    console.error('createTemplate error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Duplicate a template into a new draft exam
// @route   POST /api/admin/templates/:id/use
// @access  Private/Admin or Teacher
const useTemplate = async (req, res) => {
  try {
    const tmpl = await Exam.findOne({ _id: req.params.id, createdBy: req.orgAdminId, status: 'template' });
    if (!tmpl) return res.status(404).json({ message: 'Template not found' });
    const exam = new Exam({
      title: tmpl.title.replace('[Template] ', '').trim() + ' (Copy)',
      description: tmpl.description,
      timeLimit: tmpl.timeLimit,
      passingScore: tmpl.passingScore,
      sections: tmpl.sections,
      totalPoints: tmpl.totalPoints,
      allowSelectiveAnswering: tmpl.allowSelectiveAnswering,
      sectionBRequiredQuestions: tmpl.sectionBRequiredQuestions,
      sectionCRequiredQuestions: tmpl.sectionCRequiredQuestions,
      createdBy: req.orgAdminId,
      status: 'draft',
      isLocked: true,
    });
    await exam.save();
    res.status(201).json(exam);
  } catch (err) {
    console.error('useTemplate error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Delete a template
// @route   DELETE /api/admin/templates/:id
// @access  Private/Admin or Teacher
const deleteTemplate = async (req, res) => {
  try {
    const tmpl = await Exam.findOneAndDelete({ _id: req.params.id, createdBy: req.orgAdminId, status: 'template' });
    if (!tmpl) return res.status(404).json({ message: 'Template not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('deleteTemplate error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Reports ──────────────────────────────────────────────────────────────────

// @desc    Get report summary for this admin's students and exams
// @route   GET /api/admin/reports/summary
// @access  Private/Admin or Teacher
const getReportsSummary = async (req, res) => {
  try {
    const exams = await Exam.find({ createdBy: req.orgAdminId, status: { $ne: 'template' } }).lean();
    const examIds = exams.map(e => e._id);

    const students = await User.find({
      $or: [{ createdBy: req.orgAdminId }, { orgAdmin: req.orgAdminId }],
      role: 'student'
    }).select('_id firstName lastName email class').lean();
    const studentIds = students.map(s => s._id);

    const results = await Result.find({
      student: { $in: studentIds },
      exam: { $in: examIds }
    }).populate('exam', 'title').lean();

    // per-exam stats
    const examStats = exams.map(exam => {
      const examResults = results.filter(r => r.exam?._id?.toString() === exam._id.toString());
      const avg = examResults.length
        ? Math.round(examResults.reduce((s, r) => s + (r.percentage ?? 0), 0) / examResults.length)
        : null;
      const passed = examResults.filter(r => (r.percentage ?? 0) >= (exam.passingScore ?? 70)).length;
      return {
        _id: exam._id,
        title: exam.title,
        status: exam.status,
        submissions: examResults.length,
        avgScore: avg,
        passRate: examResults.length ? Math.round((passed / examResults.length) * 100) : null,
        createdAt: exam.createdAt,
      };
    }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // per-student stats
    const studentStats = students.map(s => {
      const sr = results.filter(r => r.student?.toString() === s._id.toString());
      const avg = sr.length ? Math.round(sr.reduce((acc, r) => acc + (r.percentage ?? 0), 0) / sr.length) : null;
      return { ...s, examsCompleted: sr.length, avgScore: avg };
    }).sort((a, b) => (b.avgScore ?? -1) - (a.avgScore ?? -1));

    const overallAvg = results.length
      ? Math.round(results.reduce((s, r) => s + (r.percentage ?? 0), 0) / results.length)
      : 0;
    const overallPass = results.length
      ? Math.round((results.filter(r => (r.percentage ?? 0) >= 70).length / results.length) * 100)
      : 0;

    res.json({
      summary: {
        totalExams: exams.length,
        totalStudents: students.length,
        totalSubmissions: results.length,
        overallAvgScore: overallAvg,
        overallPassRate: overallPass,
      },
      examStats,
      studentStats,
    });
  } catch (err) {
    console.error('getReportsSummary error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  registerStudent,
  getStudents,
  getStudentById,
  updateStudent,
  deleteStudent,
  toggleSystemLock,
  getSystemLockStatus,
  getExamResults,
  getExamLeaderboard,
  getOverallLeaderboard,
  getDetailedResult,
  exportExamResults,
  getDashboardStats,
  getAllExams,
  getExamById,
  getScheduledExams,
  getRecentExams,
  getRecentStudents,
  toggleExamLock,
  getSecurityAlerts,
  resolveSecurityAlert,
  ignoreSecurityAlert,
  getActivityLogs,
  createExam,
  scheduleExam,
  updateScheduledExam,
  getAllResults,
  getStudentPerformanceAnalytics,
  debugAdminData,
  getStudentResultsForRegrade,
  regradeStudentResult,
  registerTeacher,
  getTeachers,
  getTeacherById,
  updateTeacher,
  deleteTeacher,
  getOrganizationDetails,
  getQuestions,
  updateQuestion,
  deleteQuestion,
  getTemplates,
  createTemplate,
  useTemplate,
  deleteTemplate,
  getReportsSummary,
};

/* ── EXAM SHARING ── */

const shareExam = async (req, res) => {
  try {
    const { examId } = req.params;
    const { shareType = 'link', settings = {} } = req.body;

    const exam = await Exam.findOne({ _id: examId, createdBy: req.orgAdminId });
    if (!exam) return res.status(404).json({ message: 'Exam not found' });

    // Activate the exam if it was a draft
    if (exam.status === 'draft') {
      exam.status = 'active';
      exam.isLocked = false;
      await exam.save();
    }

    // Check for an existing active share
    let share = await SharedExam.findOne({ exam: examId, sharedBy: req.orgAdminId, isActive: true });

    if (!share) {
      const token = SharedExam.generateShareToken();
      share = await SharedExam.create({
        exam: examId,
        sharedBy: req.orgAdminId,
        shareToken: token,
        shareType,
        settings: {
          publicAccess: settings.publicAccess !== false,
          requirePassword: !!settings.requirePassword,
          password: settings.password || null,
          maxStudents: settings.maxStudents || null,
          expiresAt: settings.expiresAt || null,
          allowMultipleAttempts: !!settings.allowMultipleAttempts,
          showResults: settings.showResults !== false,
        },
      });
    } else {
      // Update settings on existing share
      share.shareType = shareType;
      Object.assign(share.settings, settings);
      await share.save();
    }

    const base = process.env.CLIENT_URL || 'http://localhost:3000';
    res.json({
      shareToken: share.shareToken,
      publicLink: `${base}/join/${share.shareToken}`,
      privateLink: `${base}/join/${share.shareToken}?mode=private`,
      share,
    });
  } catch (err) {
    console.error('shareExam error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

const getExamPreview = async (req, res) => {
  try {
    const { examId } = req.params;
    const exam = await Exam.findOne({ _id: examId, createdBy: req.orgAdminId })
      .populate({ path: 'sections.questions', model: 'Question' });
    if (!exam) return res.status(404).json({ message: 'Exam not found' });

    const share = await SharedExam.findOne({ exam: examId, sharedBy: req.orgAdminId, isActive: true });

    res.json({ exam, share: share || null });
  } catch (err) {
    console.error('getExamPreview error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

const createStudentAccounts = async (req, res) => {
  try {
    const { examId } = req.params;
    const { students } = req.body; // [{ firstName, lastName, email, class }]

    if (!Array.isArray(students) || !students.length)
      return res.status(400).json({ message: 'Students array is required' });

    const exam = await Exam.findOne({ _id: examId, createdBy: req.orgAdminId });
    if (!exam) return res.status(404).json({ message: 'Exam not found' });

    const created = [];
    const skipped = [];
    const DEFAULT_PASSWORD = 'Exam@2024';

    for (const s of students) {
      if (!s.email || !s.firstName || !s.lastName) { skipped.push({ ...s, reason: 'Missing required fields' }); continue; }
      const exists = await User.findOne({ email: s.email.toLowerCase() });
      if (exists) {
        // Assign exam to existing student
        if (!exam.assignedTo.map(id => id.toString()).includes(exists._id.toString())) {
          exam.assignedTo.push(exists._id);
        }
        skipped.push({ email: s.email, reason: 'Account already exists — exam assigned' });
        continue;
      }
      const user = await User.create({
        firstName: s.firstName.trim(),
        lastName: s.lastName.trim(),
        email: s.email.toLowerCase().trim(),
        password: DEFAULT_PASSWORD,
        role: 'student',
        class: s.class || '',
        createdBy: req.user._id,
        organization: req.user.organization || '',
        parentAdmin: req.user._id,
      });
      exam.assignedTo.push(user._id);
      created.push({ _id: user._id, email: user.email, firstName: user.firstName, lastName: user.lastName, tempPassword: DEFAULT_PASSWORD });
    }

    await exam.save();
    res.json({ created, skipped, total: students.length });
  } catch (err) {
    console.error('createStudentAccounts error:', err);
    res.status(500).json({ message: err.message || 'Server error' });
  }
};

const updateExam = async (req, res) => {
  try {
    const exam = await Exam.findOne({ _id: req.params.id, createdBy: req.orgAdminId })
      .populate({ path: 'sections.questions', model: 'Question' });
    if (!exam) return res.status(404).json({ message: 'Exam not found' });
    
    const { title, description, timeLimit, passingScore, sections } = req.body;
    if (title) exam.title = title;
    if (description) exam.description = description;
    if (timeLimit) exam.timeLimit = Number(timeLimit);
    if (passingScore) exam.passingScore = Number(passingScore);
    
    // Handle sections update if provided
    if (sections && Array.isArray(sections)) {
      exam.sections = sections.map(sec => ({
        name: sec.name,
        description: sec.description,
        questions: sec.questions?.map(q => q._id || q) || []
      }));
    }
    
    await exam.save();
    const updated = await Exam.findById(exam._id)
      .populate({ path: 'sections.questions', model: 'Question' });
    res.json(updated);
  } catch (err) {
    console.error('updateExam error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteExam = async (req, res) => {
  try {
    const exam = await Exam.findOne({ _id: req.params.id, createdBy: req.orgAdminId });
    if (!exam) return res.status(404).json({ message: 'Exam not found' });
    await Question.deleteMany({ exam: exam._id });
    await Exam.deleteOne({ _id: exam._id });
    res.json({ message: 'Exam deleted' });
  } catch (err) {
    console.error('deleteExam error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports.shareExam = shareExam;
module.exports.getExamPreview = getExamPreview;
module.exports.createStudentAccounts = createStudentAccounts;
module.exports.updateExam = updateExam;
module.exports.deleteExam = deleteExam;
