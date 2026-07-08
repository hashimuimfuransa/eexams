const User = require('../models/User');
const Exam = require('../models/Exam');
const ActivityLog = require('../models/ActivityLog');
const Result = require('../models/Result');
const ExamRequest = require('../models/ExamRequest');
const SharedExam = require('../models/SharedExam');
const bcrypt = require('bcryptjs');
const { getEffectiveSubscriptionStatus, getSubscriptionExpiryDate } = require('../utils/subscriptionStatus');

// @desc    Create a new super admin
// @route   POST /api/superadmin/create-superadmin
// @access  Private/SuperAdmin
const createSuperAdmin = async (req, res) => {
  try {
    const { email, password, firstName, lastName, phone, organization } = req.body;

    // Validation
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ message: 'Email, password, first name, and last name are required' });
    }

    // Check if user already exists
    const userExists = await User.findOne({ email: email.toLowerCase() });
    if (userExists) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    // Create super admin (password will be hashed by User model pre-save hook)
    const superAdmin = await User.create({
      email: email.toLowerCase(),
      password,
      firstName,
      lastName,
      phone: phone || '',
      organization: organization || 'TestFy Rwanda',
      role: 'superadmin',
      userType: 'organization',
      subscriptionPlan: 'enterprise',
      subscriptionStatus: 'active',
      subscriptionExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
    });

    // Log the activity
    await ActivityLog.logActivity({
      user: req.user._id,
      action: 'create_superadmin',
      details: {
        createdSuperAdminId: superAdmin._id,
        createdSuperAdminName: `${superAdmin.firstName} ${superAdmin.lastName}`,
        createdSuperAdminEmail: superAdmin.email,
        createdBy: `${req.user.firstName} ${req.user.lastName}`
      }
    });

    // Return the created super admin without password
    res.status(201).json({
      _id: superAdmin._id,
      email: superAdmin.email,
      firstName: superAdmin.firstName,
      lastName: superAdmin.lastName,
      phone: superAdmin.phone,
      organization: superAdmin.organization,
      role: superAdmin.role,
      userType: superAdmin.userType,
      subscriptionPlan: superAdmin.subscriptionPlan,
      subscriptionStatus: superAdmin.subscriptionStatus,
      createdAt: superAdmin.createdAt
    });
  } catch (error) {
    console.error('Create super admin error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get all organizations (admins, superadmins, and individual teachers)
// @route   GET /api/superadmin/organizations
// @access  Private/SuperAdmin
const getAllOrganizations = async (req, res) => {
  try {
    // Get all organization-level users (admin and superadmin roles with organization)
    const orgAdmins = await User.find({
      role: { $in: ['admin', 'superadmin'] },
      userType: 'organization'
    }).select('-password').sort({ createdAt: -1 });

    // Get all org-created teachers (have a parentAdmin set to a real ObjectId)
    const orgTeachers = await User.find({
      role: 'teacher',
      parentAdmin: { $ne: null, $exists: true }
    }).select('-password').sort({ createdAt: -1 });

    const orgTeacherIds = orgTeachers.map(t => t._id.toString());

    // Get all individual teachers (self-registered, no parent org)
    const individualTeachers = await User.find({
      role: 'teacher',
      $or: [{ parentAdmin: null }, { parentAdmin: { $exists: false } }]
    }).select('-password').sort({ createdAt: -1 });

    // Combine all organization entities
    const allOrgs = [...orgAdmins, ...individualTeachers, ...orgTeachers];

    // Get stats for each organization/individual teacher
    const organizationsWithStats = await Promise.all(
      allOrgs.map(async (org) => {
        // For org admins: count teachers with parentAdmin
        // For individual teachers: count is 0 (they are the teacher)
        const teacherCount = org.role === 'teacher'
          ? 0  // Individual teacher is the teacher themselves
          : await User.countDocuments({
              role: 'teacher',
              parentAdmin: org._id
            });

        // Count students created by this org/teacher
        const studentCount = await User.countDocuments({
          role: 'student',
          createdBy: org._id
        });

        // Count exams created by this org/teacher
        const examCount = await Exam.countDocuments({
          createdBy: org._id
        });

        const isOrgAdmin = org.role === 'admin' || org.role === 'superadmin';
        const isOrgTeacher = org.role === 'teacher' && org.parentAdmin != null;
        const category = isOrgAdmin ? 'organization' : isOrgTeacher ? 'org_teacher' : 'individual';

        return {
          _id: org._id,
          name: org.organization || `${org.firstName} ${org.lastName} (Individual)`,
          email: org.email,
          firstName: org.firstName,
          lastName: org.lastName,
          phone: org.phone,
          role: org.role,
          userType: org.userType,
          parentAdmin: org.parentAdmin,
          organization: org.organization,
          category,
          subscriptionPlan: org.subscriptionPlan,
          subscriptionStatus: org.subscriptionStatus,
          subscriptionExpiresAt: org.subscriptionExpiresAt,
          isBlocked: org.isBlocked,
          createdAt: org.createdAt,
          lastLogin: org.lastLogin,
          signinMethod: org.signinMethod || 'email',
          stats: {
            teacherCount,
            studentCount,
            examCount
          }
        };
      })
    );

    console.log('[getAllOrganizations] orgAdmins:', orgAdmins.length, '| individualTeachers:', individualTeachers.length, '| orgTeachers:', orgTeachers.length);
    console.log('[getAllOrganizations] individualTeachers detail:', individualTeachers.map(t => ({ email: t.email, userType: t.userType, parentAdmin: t.parentAdmin })));
    console.log('[getAllOrganizations] orgTeachers detail:', orgTeachers.map(t => ({ email: t.email, userType: t.userType, parentAdmin: t.parentAdmin })));
    console.log('[getAllOrganizations] categories:', organizationsWithStats.map(o => ({ email: o.email, category: o.category, role: o.role, userType: o.userType, parentAdmin: o.parentAdmin })));
    res.json(organizationsWithStats);
  } catch (error) {
    console.error('Get all organizations error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get organization by ID
// @route   GET /api/superadmin/organizations/:id
// @access  Private/SuperAdmin
const getOrganizationById = async (req, res) => {
  try {
    const organization = await User.findById(req.params.id).select('-password');

    if (!organization || (organization.role !== 'admin' && organization.role !== 'superadmin')) {
      return res.status(404).json({ message: 'Organization not found' });
    }

    // Get teachers
    const teachers = await User.find({
      role: 'teacher',
      parentAdmin: organization._id
    }).select('-password');

    // Get students count
    const studentCount = await User.countDocuments({
      role: 'student',
      createdBy: organization._id
    });

    // Get exams count
    const examCount = await Exam.countDocuments({
      createdBy: organization._id
    });

    res.json({
      organization: {
        _id: organization._id,
        name: organization.organization,
        email: organization.email,
        firstName: organization.firstName,
        lastName: organization.lastName,
        phone: organization.phone,
        subscriptionPlan: organization.subscriptionPlan,
        subscriptionStatus: organization.subscriptionStatus,
        subscriptionExpiresAt: organization.subscriptionExpiresAt,
        isBlocked: organization.isBlocked,
        createdAt: organization.createdAt,
        lastLogin: organization.lastLogin
      },
      teachers,
      stats: {
        studentCount,
        examCount
      }
    });
  } catch (error) {
    console.error('Get organization by ID error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update organization subscription
// @route   PUT /api/superadmin/organizations/:id/subscription
// @access  Private/SuperAdmin
const updateOrganizationSubscription = async (req, res) => {
  try {
    const { subscriptionPlan, subscriptionStatus, subscriptionExpiresAt } = req.body;

    const organization = await User.findById(req.params.id);

    if (!organization || (organization.role !== 'admin' && organization.role !== 'superadmin')) {
      return res.status(404).json({ message: 'Organization not found' });
    }

    // Update subscription details
    if (subscriptionPlan) organization.subscriptionPlan = subscriptionPlan;
    if (subscriptionStatus) organization.subscriptionStatus = subscriptionStatus;
    if (subscriptionExpiresAt) organization.subscriptionExpiresAt = new Date(subscriptionExpiresAt);

    const updatedOrg = await organization.save();

    // Cascade plan/status to all org teachers under this admin
    const teacherUpdate = {};
    if (subscriptionPlan) teacherUpdate.subscriptionPlan = subscriptionPlan;
    if (subscriptionStatus) teacherUpdate.subscriptionStatus = subscriptionStatus;
    if (subscriptionExpiresAt) teacherUpdate.subscriptionEndDate = new Date(subscriptionExpiresAt);
    if (Object.keys(teacherUpdate).length > 0) {
      await User.updateMany({ parentAdmin: organization._id, role: 'teacher' }, teacherUpdate);
    }

    // Log the activity
    await ActivityLog.logActivity({
      user: req.user._id,
      action: 'update_organization_subscription',
      details: {
        organizationId: updatedOrg._id,
        organizationName: updatedOrg.organization,
        subscriptionPlan: updatedOrg.subscriptionPlan,
        subscriptionStatus: updatedOrg.subscriptionStatus
      }
    });

    res.json({
      _id: updatedOrg._id,
      name: updatedOrg.organization,
      subscriptionPlan: updatedOrg.subscriptionPlan,
      subscriptionStatus: updatedOrg.subscriptionStatus,
      subscriptionExpiresAt: updatedOrg.subscriptionExpiresAt
    });
  } catch (error) {
    console.error('Update organization subscription error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Toggle organization block status
// @route   PUT /api/superadmin/organizations/:id/toggle-block
// @access  Private/SuperAdmin
const toggleOrganizationBlock = async (req, res) => {
  try {
    const organization = await User.findById(req.params.id);

    if (!organization || (organization.role !== 'admin' && organization.role !== 'superadmin')) {
      return res.status(404).json({ message: 'Organization not found' });
    }

    // Toggle block status
    organization.isBlocked = !organization.isBlocked;
    const updatedOrg = await organization.save();

    // Log the activity
    await ActivityLog.logActivity({
      user: req.user._id,
      action: updatedOrg.isBlocked ? 'block_organization' : 'unblock_organization',
      details: {
        organizationId: updatedOrg._id,
        organizationName: updatedOrg.organization
      }
    });

    res.json({
      _id: updatedOrg._id,
      name: updatedOrg.organization,
      isBlocked: updatedOrg.isBlocked,
      message: updatedOrg.isBlocked ? 'Organization blocked successfully' : 'Organization unblocked successfully'
    });
  } catch (error) {
    console.error('Toggle organization block error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get dashboard stats for super admin
// @route   GET /api/superadmin/dashboard-stats
// @access  Private/SuperAdmin
const getSuperAdminDashboardStats = async (req, res) => {
  try {
    console.log('[SuperAdmin] Getting dashboard stats...');

    // Count total organizations (admins + superadmins with organization type)
    const orgAdminCount = await User.countDocuments({
      role: { $in: ['admin', 'superadmin'] },
      userType: 'organization'
    });

    // Count individual teachers (they act as their own mini-organization)
    const individualTeacherCount = await User.countDocuments({
      role: 'teacher',
      userType: 'individual'
    });

    // Total organizations = org admins + individual teachers
    const totalOrganizations = orgAdminCount + individualTeacherCount;

    // Count organizations by subscription plan (org admins only - individual teachers don't have subscriptions)
    const freeOrganizations = await User.countDocuments({
      role: { $in: ['admin', 'superadmin'] },
      subscriptionPlan: 'free'
    });
    const basicOrganizations = await User.countDocuments({
      role: { $in: ['admin', 'superadmin'] },
      subscriptionPlan: 'basic'
    });
    const premiumOrganizations = await User.countDocuments({
      role: { $in: ['admin', 'superadmin'] },
      subscriptionPlan: 'premium'
    });
    const enterpriseOrganizations = await User.countDocuments({
      role: { $in: ['admin', 'superadmin'] },
      subscriptionPlan: 'enterprise'
    });

    // Count active vs pending subscriptions (org admins only)
    const activeSubscriptions = await User.countDocuments({
      role: { $in: ['admin', 'superadmin'] },
      subscriptionStatus: 'active'
    });
    const pendingSubscriptions = await User.countDocuments({
      role: { $in: ['admin', 'superadmin'] },
      subscriptionStatus: 'pending'
    });
    const expiredSubscriptions = await User.countDocuments({
      role: { $in: ['admin', 'superadmin'] },
      subscriptionStatus: 'expired'
    });

    // Count total teachers (system-wide - ALL teachers including individual)
    const totalTeachers = await User.countDocuments({
      role: 'teacher'
    });

    // Count total students (system-wide - ALL students)
    const totalStudents = await User.countDocuments({
      role: 'student'
    });

    // Count total exams (system-wide - ALL exams from all teachers/admins)
    const totalExams = await Exam.countDocuments();

    // Count total users
    const totalUsers = await User.countDocuments();

    // Debug logging
    console.log('[SuperAdmin] Stats:', {
      totalOrganizations,
      totalTeachers,
      totalStudents,
      totalExams,
      totalUsers,
      orgByPlan: { free: freeOrganizations, basic: basicOrganizations, premium: premiumOrganizations, enterprise: enterpriseOrganizations }
    });

    // Get recent organizations (last 5) - include both org admins and individual teachers
    const recentOrgAdmins = await User.find({
      role: { $in: ['admin', 'superadmin'] },
      userType: 'organization'
    })
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(3);

    const recentIndividualTeachers = await User.find({
      role: 'teacher',
      userType: 'individual'
    })
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(2);

    // Combine and format recent organizations
    const recentOrganizations = [...recentOrgAdmins, ...recentIndividualTeachers]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 5);

    res.json({
      // For backwards compatibility with frontend expecting flat structure
      totalOrganizations,
      totalTeachers,
      totalStudents,
      totalExams,
      totalUsers,
      // Detailed breakdown
      organizations: {
        total: totalOrganizations,
        byPlan: {
          free: freeOrganizations,
          basic: basicOrganizations,
          premium: premiumOrganizations,
          enterprise: enterpriseOrganizations
        },
        byStatus: {
          active: activeSubscriptions,
          pending: pendingSubscriptions,
          expired: expiredSubscriptions
        }
      },
      users: {
        total: totalUsers,
        teachers: totalTeachers,
        students: totalStudents,
        admins: totalOrganizations
      },
      exams: totalExams,
      recentOrganizations: recentOrganizations.map(org => ({
        _id: org._id,
        name: org.organization,
        email: org.email,
        role: org.role,
        subscriptionPlan: org.subscriptionPlan,
        subscriptionStatus: org.subscriptionStatus,
        createdAt: org.createdAt
      }))
    });
  } catch (error) {
    console.error('Get super admin dashboard stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ==================== ADVANCED ANALYTICS ====================

// @desc    Get comprehensive student performance analytics
// @route   GET /api/superadmin/analytics/students
// @access  Private/SuperAdmin
const getStudentPerformanceAnalytics = async (req, res) => {
  try {
    const { period = '30d', limit = 50, sortBy = 'averageScore' } = req.query;

    // Calculate date range
    const now = new Date();
    const startDate = new Date();
    if (period === '7d') startDate.setDate(now.getDate() - 7);
    else if (period === '30d') startDate.setDate(now.getDate() - 30);
    else if (period === '90d') startDate.setDate(now.getDate() - 90);
    else if (period === '1y') startDate.setFullYear(now.getFullYear() - 1);
    else startDate.setDate(now.getDate() - 30);

    // Get all completed results in period
    const results = await Result.find({
      isCompleted: true,
      createdAt: { $gte: startDate }
    }).populate('student', 'firstName lastName email organization createdBy').populate('exam', 'title level');

    // Fetch students with populated createdBy to get organization info
    const studentIds = results.filter(r => r.student).map(r => r.student._id);
    const studentsWithOrg = await User.find({
      _id: { $in: studentIds }
    }).populate('createdBy', 'firstName lastName organization email');

    // Create a map of student IDs to their organization info
    const studentOrgMap = new Map();
    studentsWithOrg.forEach(student => {
      if (student.createdBy) {
        studentOrgMap.set(student._id.toString(), {
          name: student.createdBy.organization || `${student.createdBy.firstName} ${student.createdBy.lastName}`,
          email: student.createdBy.email,
          id: student.createdBy._id
        });
      } else if (student.organization) {
        // If student has organization field directly
        studentOrgMap.set(student._id.toString(), {
          name: student.organization,
          email: null,
          id: null
        });
      }
    });

    // Calculate per-student metrics
    const studentMetrics = new Map();

    results.forEach(result => {
      if (!result.student) return;

      const studentId = result.student._id.toString();
      if (!studentMetrics.has(studentId)) {
        studentMetrics.set(studentId, {
          student: result.student,
          organization: studentOrgMap.get(studentId) || null,
          examCount: 0,
          totalScore: 0,
          maxPossibleScore: 0,
          passedExams: 0,
          failedExams: 0,
          totalTimeSpent: 0,
          subjects: new Map()
        });
      }

      const metrics = studentMetrics.get(studentId);
      metrics.examCount++;
      metrics.totalScore += result.totalScore || 0;
      metrics.maxPossibleScore += result.maxPossibleScore || 0;

      // Calculate pass/fail (70% threshold)
      const percentage = result.maxPossibleScore > 0 
        ? (result.totalScore / result.maxPossibleScore) * 100 
        : 0;
      if (percentage >= 70) metrics.passedExams++;
      else metrics.failedExams++;

      // Track time spent
      if (result.startTime && result.endTime) {
        metrics.totalTimeSpent += (new Date(result.endTime) - new Date(result.startTime)) / 1000 / 60; // in minutes
      }

      // Track subjects (from exam title or level)
      const subject = result.exam?.level || 'General';
      if (!metrics.subjects.has(subject)) {
        metrics.subjects.set(subject, { count: 0, totalScore: 0, maxScore: 0 });
      }
      const subjectData = metrics.subjects.get(subject);
      subjectData.count++;
      subjectData.totalScore += result.totalScore || 0;
      subjectData.maxScore += result.maxPossibleScore || 0;
    });

    // Convert to array and calculate averages
    const studentsArray = Array.from(studentMetrics.values()).map(metrics => ({
      student: metrics.student,
      organization: metrics.organization,
      examCount: metrics.examCount,
      averageScore: metrics.maxPossibleScore > 0 
        ? Math.round((metrics.totalScore / metrics.maxPossibleScore) * 100) 
        : 0,
      passRate: metrics.examCount > 0 
        ? Math.round((metrics.passedExams / metrics.examCount) * 100) 
        : 0,
      passedExams: metrics.passedExams,
      failedExams: metrics.failedExams,
      averageTimeSpent: metrics.examCount > 0 
        ? Math.round(metrics.totalTimeSpent / metrics.examCount) 
        : 0,
      subjects: Array.from(metrics.subjects.entries()).map(([subject, data]) => ({
        subject,
        examCount: data.count,
        averageScore: data.maxScore > 0 ? Math.round((data.totalScore / data.maxScore) * 100) : 0
      }))
    }));

    // Sort based on sortBy parameter
    if (sortBy === 'averageScore') {
      studentsArray.sort((a, b) => b.averageScore - a.averageScore);
    } else if (sortBy === 'examCount') {
      studentsArray.sort((a, b) => b.examCount - a.examCount);
    } else if (sortBy === 'passRate') {
      studentsArray.sort((a, b) => b.passRate - a.passRate);
    }

    // Calculate overall statistics
    const totalStudents = studentsArray.length;
    const overallAverageScore = totalStudents > 0
      ? Math.round(studentsArray.reduce((sum, s) => sum + s.averageScore, 0) / totalStudents)
      : 0;
    const overallPassRate = totalStudents > 0
      ? Math.round(studentsArray.reduce((sum, s) => sum + s.passRate, 0) / totalStudents)
      : 0;

    // Get top performers and students needing improvement
    const topPerformers = studentsArray.slice(0, 10);
    const needingImprovement = [...studentsArray]
      .filter(s => s.averageScore < 60)
      .sort((a, b) => a.averageScore - b.averageScore)
      .slice(0, 10);

    res.json({
      period,
      summary: {
        totalStudentsAnalyzed: totalStudents,
        overallAverageScore,
        overallPassRate,
        totalExamsCompleted: results.length
      },
      students: studentsArray.slice(0, parseInt(limit)),
      topPerformers,
      needingImprovement,
      subjectBreakdown: calculateSubjectBreakdown(results)
    });
  } catch (error) {
    console.error('Get student performance analytics error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get comprehensive teacher performance analytics
// @route   GET /api/superadmin/analytics/teachers
// @access  Private/SuperAdmin
const getTeacherPerformanceAnalytics = async (req, res) => {
  try {
    const { period = '30d', limit = 50, sortBy = 'examCount' } = req.query;

    const now = new Date();
    const startDate = new Date();
    if (period === '7d') startDate.setDate(now.getDate() - 7);
    else if (period === '30d') startDate.setDate(now.getDate() - 30);
    else if (period === '90d') startDate.setDate(now.getDate() - 90);
    else if (period === '1y') startDate.setFullYear(now.getFullYear() - 1);
    else startDate.setDate(now.getDate() - 30);

    // Get all teachers with organization info
    const teachers = await User.find({ role: 'teacher' })
      .select('firstName lastName email organization createdBy createdAt')
      .populate('createdBy', 'firstName lastName organization email');
    const exams = await Exam.find({
      createdBy: { $in: teachers.map(t => t._id) },
      createdAt: { $gte: startDate }
    }).populate('createdBy', 'firstName lastName email');

    // Get results for teacher exams
    const examIds = exams.map(e => e._id);
    const results = await Result.find({
      exam: { $in: examIds },
      isCompleted: true,
      createdAt: { $gte: startDate }
    }).populate('exam', 'title createdBy');

    // Calculate per-teacher metrics
    const teacherMetrics = new Map();

    teachers.forEach(teacher => {
      teacherMetrics.set(teacher._id.toString(), {
        teacher,
        organization: teacher.createdBy ? {
          name: teacher.createdBy.organization || `${teacher.createdBy.firstName} ${teacher.createdBy.lastName}`,
          email: teacher.createdBy.email,
          id: teacher.createdBy._id
        } : null,
        examCount: 0,
        totalStudents: 0,
        totalScore: 0,
        maxPossibleScore: 0,
        examsCreated: []
      });
    });

    exams.forEach(exam => {
      const teacherId = exam.createdBy._id.toString();
      if (teacherMetrics.has(teacherId)) {
        const metrics = teacherMetrics.get(teacherId);
        metrics.examCount++;
        metrics.examsCreated.push({
          id: exam._id,
          title: exam.title,
          createdAt: exam.createdAt
        });
      }
    });

    results.forEach(result => {
      const teacherId = result.exam.createdBy._id.toString();
      if (teacherMetrics.has(teacherId)) {
        const metrics = teacherMetrics.get(teacherId);
        metrics.totalStudents++;
        metrics.totalScore += result.totalScore || 0;
        metrics.maxPossibleScore += result.maxPossibleScore || 0;
      }
    });

    // Convert to array and calculate averages
    const teachersArray = Array.from(teacherMetrics.values()).map(metrics => ({
      teacher: metrics.teacher,
      organization: metrics.organization,
      examCount: metrics.examCount,
      totalStudents: metrics.totalStudents,
      averageStudentScore: metrics.maxPossibleScore > 0
        ? Math.round((metrics.totalScore / metrics.maxPossibleScore) * 100)
        : 0,
      examsCreated: metrics.examsCreated
    }));

    // Sort
    if (sortBy === 'examCount') {
      teachersArray.sort((a, b) => b.examCount - a.examCount);
    } else if (sortBy === 'studentCount') {
      teachersArray.sort((a, b) => b.totalStudents - a.totalStudents);
    } else if (sortBy === 'averageScore') {
      teachersArray.sort((a, b) => b.averageStudentScore - a.averageStudentScore);
    }

    // Get top teachers
    const topTeachers = teachersArray.slice(0, 10);
    const mostActiveTeachers = [...teachersArray]
      .sort((a, b) => b.examCount - a.examCount)
      .slice(0, 10);

    res.json({
      period,
      summary: {
        totalTeachers: teachers.length,
        activeTeachers: teachersArray.filter(t => t.examCount > 0).length,
        totalExamsCreated: exams.length,
        totalStudentAttempts: results.length
      },
      teachers: teachersArray.slice(0, parseInt(limit)),
      topTeachers,
      mostActiveTeachers
    });
  } catch (error) {
    console.error('Get teacher performance analytics error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get comprehensive organization performance analytics
// @route   GET /api/superadmin/analytics/organizations
// @access  Private/SuperAdmin
const getOrganizationPerformanceAnalytics = async (req, res) => {
  try {
    const { period = '30d', limit = 50, sortBy = 'examCount' } = req.query;

    const now = new Date();
    const startDate = new Date();
    if (period === '7d') startDate.setDate(now.getDate() - 7);
    else if (period === '30d') startDate.setDate(now.getDate() - 30);
    else if (period === '90d') startDate.setDate(now.getDate() - 90);
    else if (period === '1y') startDate.setFullYear(now.getFullYear() - 1);
    else startDate.setDate(now.getDate() - 30);

    // Get all organizations (admins + individual teachers)
    const orgAdmins = await User.find({
      role: { $in: ['admin', 'superadmin'] },
      userType: 'organization'
    }).select('firstName lastName email organization subscriptionPlan subscriptionStatus createdAt');

    const individualTeachers = await User.find({
      role: 'teacher',
      userType: 'individual'
    }).select('firstName lastName email organization createdAt');

    const organizations = [...orgAdmins, ...individualTeachers];

    // Get teachers for each organization
    const orgTeachers = await User.find({
      createdBy: { $in: organizations.map(o => o._id) },
      role: 'teacher'
    });

    // Get students for each organization
    const orgStudents = await User.find({
      createdBy: { $in: organizations.map(o => o._id) },
      role: 'student'
    });

    // Get exams created by org and its teachers
    const allCreatorIds = [
      ...organizations.map(o => o._id),
      ...orgTeachers.map(t => t._id)
    ];

    const exams = await Exam.find({
      createdBy: { $in: allCreatorIds },
      createdAt: { $gte: startDate }
    });

    // Get results for org exams
    const examIds = exams.map(e => e._id);
    const results = await Result.find({
      exam: { $in: examIds },
      isCompleted: true,
      createdAt: { $gte: startDate }
    });

    // Calculate per-organization metrics
    const orgMetrics = new Map();

    organizations.forEach(org => {
      const orgId = org._id.toString();
      const teacherCount = orgTeachers.filter(t => t.createdBy?.toString() === orgId).length;
      const studentCount = orgStudents.filter(s => s.createdBy?.toString() === orgId).length;

      orgMetrics.set(orgId, {
        organization: org,
        teacherCount,
        studentCount,
        examCount: 0,
        resultCount: 0,
        totalScore: 0,
        maxPossibleScore: 0,
        subscriptionPlan: org.subscriptionPlan || 'free',
        subscriptionStatus: org.subscriptionStatus || 'unknown'
      });
    });

    exams.forEach(exam => {
      const creatorId = exam.createdBy.toString();
      // Find which organization this creator belongs to
      const org = organizations.find(o => o._id.toString() === creatorId);
      if (org) {
        const metrics = orgMetrics.get(org._id.toString());
        if (metrics) metrics.examCount++;
      }
    });

    results.forEach(result => {
      const exam = exams.find(e => e._id.toString() === result.exam.toString());
      if (exam) {
        const creatorId = exam.createdBy.toString();
        const org = organizations.find(o => o._id.toString() === creatorId);
        if (org) {
          const metrics = orgMetrics.get(org._id.toString());
          if (metrics) {
            metrics.resultCount++;
            metrics.totalScore += result.totalScore || 0;
            metrics.maxPossibleScore += result.maxPossibleScore || 0;
          }
        }
      }
    });

    // Convert to array
    const orgsArray = Array.from(orgMetrics.values()).map(metrics => ({
      organization: metrics.organization,
      teacherCount: metrics.teacherCount,
      studentCount: metrics.studentCount,
      examCount: metrics.examCount,
      resultCount: metrics.resultCount,
      averageStudentScore: metrics.maxPossibleScore > 0
        ? Math.round((metrics.totalScore / metrics.maxPossibleScore) * 100)
        : 0,
      subscriptionPlan: metrics.subscriptionPlan,
      subscriptionStatus: metrics.subscriptionStatus
    }));

    // Sort
    if (sortBy === 'examCount') {
      orgsArray.sort((a, b) => b.examCount - a.examCount);
    } else if (sortBy === 'studentCount') {
      orgsArray.sort((a, b) => b.studentCount - a.studentCount);
    } else if (sortBy === 'resultCount') {
      orgsArray.sort((a, b) => b.resultCount - a.resultCount);
    } else if (sortBy === 'averageScore') {
      orgsArray.sort((a, b) => b.averageStudentScore - a.averageStudentScore);
    }

    // Get top organizations
    const topOrganizations = orgsArray.slice(0, 10);

    // Group by subscription plan
    const byPlan = {
      free: orgsArray.filter(o => o.subscriptionPlan === 'free'),
      basic: orgsArray.filter(o => o.subscriptionPlan === 'basic'),
      premium: orgsArray.filter(o => o.subscriptionPlan === 'premium'),
      enterprise: orgsArray.filter(o => o.subscriptionPlan === 'enterprise')
    };

    res.json({
      period,
      summary: {
        totalOrganizations: organizations.length,
        activeOrganizations: orgsArray.filter(o => o.examCount > 0).length,
        totalExamsCreated: exams.length,
        totalStudentAttempts: results.length,
        totalTeachers: orgTeachers.length,
        totalStudents: orgStudents.length
      },
      organizations: orgsArray.slice(0, parseInt(limit)),
      topOrganizations,
      byPlan
    });
  } catch (error) {
    console.error('Get organization performance analytics error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get time-series analytics for growth trends
// @route   GET /api/superadmin/analytics/trends
// @access  Private/SuperAdmin
const getTimeSeriesAnalytics = async (req, res) => {
  try {
    const { period = '30d', granularity = 'daily' } = req.query;

    const now = new Date();
    const startDate = new Date();
    if (period === '7d') startDate.setDate(now.getDate() - 7);
    else if (period === '30d') startDate.setDate(now.getDate() - 30);
    else if (period === '90d') startDate.setDate(now.getDate() - 90);
    else if (period === '1y') startDate.setFullYear(now.getFullYear() - 1);
    else startDate.setDate(now.getDate() - 30);

    // Get user registrations over time
    const userRegistrations = await User.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: {
            date: {
              $dateToString: {
                format: granularity === 'daily' ? '%Y-%m-%d' : '%Y-%m',
                date: '$createdAt'
              }
            },
            role: '$role'
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.date': 1 } }
    ]);

    // Get exam creation over time
    const examCreation = await Exam.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: {
            date: {
              $dateToString: {
                format: granularity === 'daily' ? '%Y-%m-%d' : '%Y-%m',
                date: '$createdAt'
              }
            }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.date': 1 } }
    ]);

    // Get exam completions over time
    const examCompletions = await Result.aggregate([
      { $match: { isCompleted: true, createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: {
            date: {
              $dateToString: {
                format: granularity === 'daily' ? '%Y-%m-%d' : '%Y-%m',
                date: '$createdAt'
              }
            }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.date': 1 } }
    ]);

    // Get marketplace requests over time
    const marketplaceRequests = await ExamRequest.aggregate([
      { $match: { requestedAt: { $gte: startDate } } },
      {
        $group: {
          _id: {
            date: {
              $dateToString: {
                format: granularity === 'daily' ? '%Y-%m-%d' : '%Y-%m',
                date: '$requestedAt'
              }
            },
            status: '$status'
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.date': 1 } }
    ]);

    res.json({
      period,
      granularity,
      userRegistrations: formatTimeSeriesData(userRegistrations),
      examCreation: formatTimeSeriesData(examCreation),
      examCompletions: formatTimeSeriesData(examCompletions),
      marketplaceRequests: formatTimeSeriesData(marketplaceRequests)
    });
  } catch (error) {
    console.error('Get time series analytics error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get comprehensive exam analytics
// @route   GET /api/superadmin/analytics/exams
// @access  Private/SuperAdmin
const getExamAnalytics = async (req, res) => {
  try {
    const { period = '30d', limit = 50, sortBy = 'completionCount' } = req.query;

    const now = new Date();
    const startDate = new Date();
    if (period === '7d') startDate.setDate(now.getDate() - 7);
    else if (period === '30d') startDate.setDate(now.getDate() - 30);
    else if (period === '90d') startDate.setDate(now.getDate() - 90);
    else if (period === '1y') startDate.setFullYear(now.getFullYear() - 1);
    else startDate.setDate(now.getDate() - 30);

    // Get all exams
    const exams = await Exam.find()
      .populate('createdBy', 'firstName lastName email organization')
      .populate('level', 'name')
      .sort({ createdAt: -1 });

    // Get results for all exams
    const examIds = exams.map(e => e._id);
    const results = await Result.find({
      exam: { $in: examIds },
      isCompleted: true,
      createdAt: { $gte: startDate }
    });

    // Calculate per-exam metrics
    const examMetrics = new Map();

    exams.forEach(exam => {
      examMetrics.set(exam._id.toString(), {
        exam,
        completionCount: 0,
        totalScore: 0,
        maxPossibleScore: 0,
        passedCount: 0,
        failedCount: 0,
        averageTimeSpent: 0,
        totalTimeSpent: 0
      });
    });

    results.forEach(result => {
      const examId = result.exam.toString();
      if (examMetrics.has(examId)) {
        const metrics = examMetrics.get(examId);
        metrics.completionCount++;
        metrics.totalScore += result.totalScore || 0;
        metrics.maxPossibleScore += result.maxPossibleScore || 0;

        const percentage = result.maxPossibleScore > 0
          ? (result.totalScore / result.maxPossibleScore) * 100
          : 0;
        if (percentage >= 70) metrics.passedCount++;
        else metrics.failedCount++;

        if (result.startTime && result.endTime) {
          metrics.totalTimeSpent += (new Date(result.endTime) - new Date(result.startTime)) / 1000 / 60;
        }
      }
    });

    // Convert to array and calculate averages
    const examsArray = Array.from(examMetrics.values()).map(metrics => ({
      exam: metrics.exam,
      completionCount: metrics.completionCount,
      averageScore: metrics.maxPossibleScore > 0
        ? Math.round((metrics.totalScore / metrics.maxPossibleScore) * 100)
        : 0,
      passRate: metrics.completionCount > 0
        ? Math.round((metrics.passedCount / metrics.completionCount) * 100)
        : 0,
      passedCount: metrics.passedCount,
      failedCount: metrics.failedCount,
      averageTimeSpent: metrics.completionCount > 0
        ? Math.round(metrics.totalTimeSpent / metrics.completionCount)
        : 0
    }));

    // Sort
    if (sortBy === 'completionCount') {
      examsArray.sort((a, b) => b.completionCount - a.completionCount);
    } else if (sortBy === 'averageScore') {
      examsArray.sort((a, b) => b.averageScore - a.averageScore);
    } else if (sortBy === 'passRate') {
      examsArray.sort((a, b) => b.passRate - a.passRate);
    }

    // Get most popular exams
    const mostPopularExams = examsArray.slice(0, 10);
    const mostDifficultExams = [...examsArray]
      .filter(e => e.completionCount >= 5)
      .sort((a, b) => a.averageScore - b.averageScore)
      .slice(0, 10);

    res.json({
      period,
      summary: {
        totalExams: exams.length,
        examsWithCompletions: examsArray.filter(e => e.completionCount > 0).length,
        totalCompletions: results.length,
        overallAverageScore: examsArray.reduce((sum, e) => sum + e.averageScore * e.completionCount, 0) / results.length || 0
      },
      exams: examsArray.slice(0, parseInt(limit)),
      mostPopularExams,
      mostDifficultExams
    });
  } catch (error) {
    console.error('Get exam analytics error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get marketplace analytics
// @route   GET /api/superadmin/analytics/marketplace
// @access  Private/SuperAdmin
const getMarketplaceAnalytics = async (req, res) => {
  try {
    const { period = '30d' } = req.query;

    const now = new Date();
    const startDate = new Date();
    if (period === '7d') startDate.setDate(now.getDate() - 7);
    else if (period === '30d') startDate.setDate(now.getDate() - 30);
    else if (period === '90d') startDate.setDate(now.getDate() - 90);
    else if (period === '1y') startDate.setFullYear(now.getFullYear() - 1);
    else startDate.setDate(now.getDate() - 30);

    // Get marketplace exams
    const marketplaceExams = await Exam.find({ isPubliclyListed: true });

    // Get exam requests in period
    const requests = await ExamRequest.find({
      requestedAt: { $gte: startDate }
    }).populate('exam', 'title publicPrice');

    // Calculate metrics
    const totalRequests = requests.length;
    const approvedRequests = requests.filter(r => r.status === 'approved').length;
    const pendingRequests = requests.filter(r => r.status === 'pending').length;
    const rejectedRequests = requests.filter(r => r.status === 'rejected').length;

    const approvalRate = totalRequests > 0
      ? Math.round((approvedRequests / totalRequests) * 100)
      : 0;

    // Calculate revenue
    const totalRevenue = requests
      .filter(r => r.paymentStatus === 'paid')
      .reduce((sum, r) => sum + (r.amount || 0), 0);

    // Get per-exam request stats
    const examRequestStats = new Map();
    requests.forEach(request => {
      if (!request.exam) return;
      const examId = request.exam._id.toString();
      if (!examRequestStats.has(examId)) {
        examRequestStats.set(examId, {
          exam: request.exam,
          requestCount: 0,
          approvedCount: 0,
          revenue: 0
        });
      }
      const stats = examRequestStats.get(examId);
      stats.requestCount++;
      if (request.status === 'approved') stats.approvedCount++;
      if (request.paymentStatus === 'paid') stats.revenue += request.amount || 0;
    });

    const examsArray = Array.from(examRequestStats.values())
      .sort((a, b) => b.requestCount - a.requestCount)
      .slice(0, 20);

    res.json({
      period,
      summary: {
        totalMarketplaceExams: marketplaceExams.length,
        totalRequests,
        approvedRequests,
        pendingRequests,
        rejectedRequests,
        approvalRate,
        totalRevenue
      },
      topRequestedExams: examsArray
    });
  } catch (error) {
    console.error('Get marketplace analytics error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Helper function to calculate subject breakdown
function calculateSubjectBreakdown(results) {
  const subjectMap = new Map();

  results.forEach(result => {
    const subject = result.exam?.level || 'General';
    if (!subjectMap.has(subject)) {
      subjectMap.set(subject, { count: 0, totalScore: 0, maxScore: 0 });
    }
    const data = subjectMap.get(subject);
    data.count++;
    data.totalScore += result.totalScore || 0;
    data.maxScore += result.maxPossibleScore || 0;
  });

  return Array.from(subjectMap.entries()).map(([subject, data]) => ({
    subject,
    examCount: data.count,
    averageScore: data.maxScore > 0 ? Math.round((data.totalScore / data.maxScore) * 100) : 0
  }));
}

// Helper function to format time series data
function formatTimeSeriesData(aggregateResult) {
  const formatted = new Map();

  aggregateResult.forEach(item => {
    const date = item._id.date;
    const key = item._id.role ? `${date}_${item._id.role}` : date;

    if (!formatted.has(date)) {
      formatted.set(date, { date, total: 0, byRole: {} });
    }

    const data = formatted.get(date);
    data.total += item.count;

    if (item._id.role) {
      data.byRole[item._id.role] = (data.byRole[item._id.role] || 0) + item.count;
    }
  });

  return Array.from(formatted.values()).sort((a, b) => a.date.localeCompare(b.date));
}

// @desc    Delete organization
// @route   DELETE /api/superadmin/organizations/:id
// @access  Private/SuperAdmin
const deleteOrganization = async (req, res) => {
  try {
    const organization = await User.findById(req.params.id);

    if (!organization || (organization.role !== 'admin' && organization.role !== 'superadmin')) {
      return res.status(404).json({ message: 'Organization not found' });
    }

    const orgName = organization.organization;

    // Delete all teachers created by this organization
    await User.deleteMany({
      role: 'teacher',
      parentAdmin: organization._id
    });

    // Delete all students created by this organization
    await User.deleteMany({
      role: 'student',
      createdBy: organization._id
    });

    // Delete all exams created by this organization
    await Exam.deleteMany({
      createdBy: organization._id
    });

    // Finally delete the organization
    await organization.deleteOne();

    // Log the activity
    await ActivityLog.logActivity({
      user: req.user._id,
      action: 'delete_organization',
      details: {
        organizationId: req.params.id,
        organizationName: orgName
      }
    });

    res.json({ message: 'Organization and all associated data deleted successfully' });
  } catch (error) {
    console.error('Delete organization error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get all users in the system (super admin only)
// @route   GET /api/superadmin/users
// @access  Private/SuperAdmin
const getAllUsers = async (req, res) => {
  try {
    const { role, page = 1, limit = 50, search, subscriptionStatus } = req.query;

    // Build query
    const query = {};
    if (role) query.role = role;
    if (subscriptionStatus) query.subscriptionStatus = subscriptionStatus;
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { organization: { $regex: search, $options: 'i' } }
      ];
    }

    // Get users with pagination
    const users = await User.find(query)
      .select('-password')
      .populate('parentAdmin', 'firstName lastName organization')
      .populate('createdBy', 'firstName lastName organization')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Get total count
    const total = await User.countDocuments(query);

    // Get counts by role
    const counts = {
      total: await User.countDocuments(),
      superadmin: await User.countDocuments({ role: 'superadmin' }),
      admin: await User.countDocuments({ role: 'admin' }),
      teacher: await User.countDocuments({ role: 'teacher' }),
      student: await User.countDocuments({ role: 'student' })
    };

    res.json({
      users,
      counts,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get all exams in the system (super admin only)
// @route   GET /api/superadmin/exams
// @access  Private/SuperAdmin
const getAllExams = async (req, res) => {
  try {
    const { page = 1, limit = 50, status, search } = req.query;

    // Build query
    const query = {};
    if (status) query.status = status;
    if (search) query.title = { $regex: search, $options: 'i' };

    // Get all exams with creator info
    const exams = await Exam.find(query)
      .populate('createdBy', 'firstName lastName email organization')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Get total count
    const total = await Exam.countDocuments(query);

    // Get stats
    const stats = {
      total: await Exam.countDocuments(),
      scheduled: await Exam.countDocuments({ status: 'scheduled' }),
      active: await Exam.countDocuments({ isLocked: false }),
      locked: await Exam.countDocuments({ isLocked: true })
    };

    res.json({
      exams,
      stats,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get all exams error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get all results in the system (super admin only)
// @route   GET /api/superadmin/results
// @access  Private/SuperAdmin
const getAllResults = async (req, res) => {
  try {
    const Result = require('../models/Result');
    const { page = 1, limit = 50, completed } = req.query;

    // Build query
    const query = {};
    if (completed !== undefined) query.isCompleted = completed === 'true';

    // Get all results with student and exam info
    const results = await Result.find(query)
      .populate('student', 'firstName lastName email')
      .populate('exam', 'title createdBy')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Get total count
    const total = await Result.countDocuments(query);

    // Get stats
    const stats = {
      total: await Result.countDocuments(),
      completed: await Result.countDocuments({ isCompleted: true }),
      inProgress: await Result.countDocuments({ isCompleted: false })
    };

    res.json({
      results,
      stats,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get all results error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get detailed result with questions and answers (super admin only)
// @route   GET /api/superadmin/results/:id/details
// @access  Private/SuperAdmin
const getResultDetails = async (req, res) => {
  try {
    const Result = require('../models/Result');
    const Exam = require('../models/Exam');

    const result = await Result.findById(req.params.id)
      .populate('student', 'firstName lastName email')
      .populate('exam');

    if (!result) {
      return res.status(404).json({ message: 'Result not found' });
    }

    // Get full exam details with questions
    const exam = await Exam.findById(result.exam._id)
      .populate('sections.questions');

    // Format answers with question details
    const Question = require('../models/Question');
    const formattedAnswers = await Promise.all(result.answers.map(async (answer) => {
      // Find the question in the exam using answer.question (ObjectId)
      let question = null;
      if (exam && exam.sections && answer.question) {
        for (const section of exam.sections) {
          const found = section.questions.find(q => q._id && q._id.toString() === answer.question.toString());
          if (found) {
            question = found;
            break;
          }
        }
      }

      // If question not found in exam, try to populate it from the Question model
      if (!question && answer.question) {
        try {
          const populatedQuestion = await Question.findById(answer.question);
          if (populatedQuestion) {
            question = populatedQuestion;
          }
        } catch (err) {
          console.error('Error populating question:', err);
        }
      }

      // Build question data with fallbacks
      const questionData = question || {
        _id: answer.question,
        text: 'Question text not available',
        type: 'multiple-choice',
        options: [],
        correctAnswer: answer.correctedAnswer || answer.correctOptionLetter,
        marks: 1
      };

      // Get the selected answer - check multiple possible field names
      const selectedAnswer = answer.selectedOption || answer.textAnswer || answer.selectedOptionLetter;

      return {
        ...answer.toObject ? answer.toObject() : answer,
        question: {
          _id: questionData._id,
          text: questionData.text,
          type: questionData.type,
          options: questionData.options,
          correctAnswer: questionData.correctAnswer,
          marks: questionData.marks
        },
        selectedAnswer: selectedAnswer,
        isCorrect: answer.isCorrect !== undefined ? answer.isCorrect : (
          questionData && questionData.correctAnswer === selectedAnswer
        )
      };
    }));

    // Calculate duration if start and end times exist
    let duration = 'N/A';
    if (result.startTime && result.endTime) {
      const diff = new Date(result.endTime) - new Date(result.startTime);
      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      duration = `${minutes}m ${seconds}s`;
    }

    res.json({
      _id: result._id,
      student: result.student,
      exam: result.exam,
      totalScore: result.totalScore,
      maxPossibleScore: result.maxPossibleScore,
      isCompleted: result.isCompleted,
      startTime: result.startTime,
      endTime: result.endTime,
      duration,
      answers: formattedAnswers,
      createdAt: result.createdAt
    });
  } catch (error) {
    console.error('Get result details error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get complete system overview (super admin only)
// @route   GET /api/superadmin/overview
// @access  Private/SuperAdmin
const getSystemOverview = async (req, res) => {
  try {
    const Result = require('../models/Result');

    // Count all entities
    const overview = {
      users: {
        total: await User.countDocuments(),
        superadmin: await User.countDocuments({ role: 'superadmin' }),
        admin: await User.countDocuments({ role: 'admin' }),
        teacher: await User.countDocuments({ role: 'teacher' }),
        student: await User.countDocuments({ role: 'student' })
      },
      organizations: {
        total: await User.countDocuments({ role: { $in: ['admin', 'superadmin'] }, userType: 'organization' }),
        byPlan: {
          free: await User.countDocuments({ role: 'admin', subscriptionPlan: 'free' }),
          basic: await User.countDocuments({ role: 'admin', subscriptionPlan: 'basic' }),
          premium: await User.countDocuments({ role: 'admin', subscriptionPlan: 'premium' }),
          enterprise: await User.countDocuments({ role: 'admin', subscriptionPlan: 'enterprise' })
        }
      },
      exams: {
        total: await Exam.countDocuments(),
        scheduled: await Exam.countDocuments({ status: 'scheduled' }),
        active: await Exam.countDocuments({ isLocked: false }),
        locked: await Exam.countDocuments({ isLocked: true })
      },
      results: {
        total: await Result.countDocuments(),
        completed: await Result.countDocuments({ isCompleted: true }),
        inProgress: await Result.countDocuments({ isCompleted: false })
      }
    };

    // Calculate average score
    const completedResults = await Result.find({ isCompleted: true });
    let totalScore = 0;
    let maxScore = 0;
    completedResults.forEach(r => {
      totalScore += r.totalScore || 0;
      maxScore += r.maxPossibleScore || 0;
    });
    overview.results.averageScore = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

    // Recent activity (last 24 hours)
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    overview.recentActivity = {
      newUsers: await User.countDocuments({ createdAt: { $gte: last24Hours } }),
      newExams: await Exam.countDocuments({ createdAt: { $gte: last24Hours } }),
      completedExams: await Result.countDocuments({ isCompleted: true, updatedAt: { $gte: last24Hours } })
    };

    res.json(overview);
  } catch (error) {
    console.error('Get system overview error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get any user by ID (super admin only)
// @route   GET /api/superadmin/users/:id
// @access  Private/SuperAdmin
const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get user's created content counts
    const examCount = await Exam.countDocuments({ createdBy: user._id });
    const studentCount = await User.countDocuments({ createdBy: user._id, role: 'student' });
    const teacherCount = await User.countDocuments({ parentAdmin: user._id, role: 'teacher' });

    res.json({
      user,
      stats: {
        examCount,
        studentCount,
        teacherCount
      }
    });
  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update any user (super admin only)
// @route   PUT /api/superadmin/users/:id
// @access  Private/SuperAdmin
const updateUser = async (req, res) => {
  try {
    const { firstName, lastName, email, phone, role, organization, isBlocked, subscriptionPlan, subscriptionStatus, password, currentPassword } = req.body;

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent changing another super admin's role unless you're the main super admin
    if (user.role === 'superadmin' && role && role !== 'superadmin') {
      return res.status(403).json({ message: 'Cannot demote a super admin' });
    }

    // Prevent free plan renewal for expired free users
    if (subscriptionPlan === 'free' && user.subscriptionStatus === 'expired' && user.subscriptionPlan === 'free') {
      return res.status(400).json({ 
        message: 'Free plan users cannot renew with free plan after expiration. Please upgrade to a paid plan (Basic, Premium, or Enterprise).' 
      });
    }

    // Handle email change for super admins - require current password
    if (email && email !== user.email && user.role === 'superadmin') {
      if (!currentPassword) {
        return res.status(400).json({ message: 'Current password is required to change email' });
      }
      const isMatch = await user.comparePassword(currentPassword);
      if (!isMatch) {
        return res.status(401).json({ message: 'Current password is incorrect' });
      }
      user.email = email.toLowerCase();
    }

    // Update fields
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (email && user.role !== 'superadmin') user.email = email;
    if (phone) user.phone = phone;
    if (role) user.role = role;
    if (organization !== undefined) user.organization = organization;
    if (isBlocked !== undefined) user.isBlocked = isBlocked;
    if (subscriptionPlan) user.subscriptionPlan = subscriptionPlan;
    if (subscriptionStatus) {
      user.subscriptionStatus = subscriptionStatus;
      // Set expiration date when activating subscription (enterprise doesn't expire)
      if (subscriptionStatus === 'active') {
        const planToUse = subscriptionPlan || user.subscriptionPlan;
        let expiresAt;
        if (planToUse === 'enterprise') {
          expiresAt = null;
        } else if (planToUse === 'free') {
          // Students get 365 days, teachers get 14 days
          if (user.role === 'student') {
            expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 365 days for students
          } else {
            expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days for teachers
          }
        } else {
          expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days for paid plans
        }
        user.subscriptionExpiresAt = expiresAt;
        user.subscriptionEndDate = expiresAt;
        user.subscriptionStartDate = new Date();
        user.lastPaymentDate = new Date();
      }
    }

    // Handle password change (will be hashed by User model pre-save hook)
    if (password) {
      user.password = password;
    }

    await user.save();

    // If this is an org admin, cascade plan/status changes to their teachers
    if (user.role === 'admin' && (subscriptionPlan || subscriptionStatus)) {
      const teacherUpdate = {};
      if (subscriptionPlan) teacherUpdate.subscriptionPlan = subscriptionPlan;
      if (subscriptionStatus) {
        teacherUpdate.subscriptionStatus = subscriptionStatus;
        // Set expiration date for teachers when activating
        if (subscriptionStatus === 'active') {
          const planToUse = subscriptionPlan || user.subscriptionPlan;
          let expiresAt;
          if (planToUse === 'enterprise') {
            expiresAt = null;
          } else if (planToUse === 'free') {
            expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days for free plan
          } else {
            expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days for paid plans
          }
          teacherUpdate.subscriptionExpiresAt = expiresAt;
          teacherUpdate.subscriptionEndDate = expiresAt;
          teacherUpdate.subscriptionStartDate = new Date();
        }
      }
      await User.updateMany({ parentAdmin: user._id, role: 'teacher' }, teacherUpdate);
    }

    // Log the activity
    await ActivityLog.logActivity({
      user: req.user._id,
      action: 'update_user',
      details: {
        targetUserId: user._id,
        targetUserEmail: user.email,
        changes: req.body
      }
    });

    res.json({
      message: 'User updated successfully',
      user: {
        _id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        organization: user.organization,
        isBlocked: user.isBlocked
      }
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Delete any user (super admin only)
// @route   DELETE /api/superadmin/users/:id
// @access  Private/SuperAdmin
const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent deleting yourself
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(403).json({ message: 'Cannot delete your own account' });
    }

    const userEmail = user.email;
    const userRole = user.role;

    // Delete all content created by this user based on role
    if (userRole === 'admin') {
      // Delete all teachers under this admin
      await User.deleteMany({ parentAdmin: user._id, role: 'teacher' });
      // Delete all students created by this admin
      await User.deleteMany({ createdBy: user._id, role: 'student' });
      // Delete all exams created by this admin
      await Exam.deleteMany({ createdBy: user._id });
    } else if (userRole === 'teacher') {
      // Delete all students created by this teacher
      await User.deleteMany({ createdBy: user._id, role: 'student' });
      // Delete all exams created by this teacher
      await Exam.deleteMany({ createdBy: user._id });
    } else if (userRole === 'student') {
      // Delete all results for this student
      const Result = require('../models/Result');
      await Result.deleteMany({ student: user._id });
    }

    // Finally delete the user
    await user.deleteOne();

    // Log the activity
    await ActivityLog.logActivity({
      user: req.user._id,
      action: 'delete_user',
      details: {
        deletedUserId: req.params.id,
        deletedUserEmail: userEmail,
        deletedUserRole: userRole
      }
    });

    res.json({ message: 'User and all associated data deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Toggle user block status (super admin only)
// @route   PUT /api/superadmin/users/:id/toggle-block
// @access  Private/SuperAdmin
const toggleUserBlock = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent blocking yourself
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(403).json({ message: 'Cannot block your own account' });
    }

    // Prevent blocking another super admin
    if (user.role === 'superadmin') {
      return res.status(403).json({ message: 'Cannot block a super admin' });
    }

    // Toggle block status
    user.isBlocked = !user.isBlocked;
    await user.save();

    // Log the activity
    await ActivityLog.logActivity({
      user: req.user._id,
      action: user.isBlocked ? 'block_user' : 'unblock_user',
      details: {
        targetUserId: user._id,
        targetUserEmail: user.email,
        targetUserRole: user.role
      }
    });

    res.json({
      message: user.isBlocked ? 'User blocked successfully' : 'User unblocked successfully',
      user: {
        _id: user._id,
        email: user.email,
        isBlocked: user.isBlocked
      }
    });
  } catch (error) {
    console.error('Toggle user block error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Delete any exam (super admin only)
// @route   DELETE /api/superadmin/exams/:id
// @access  Private/SuperAdmin
const deleteExam = async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);

    if (!exam) {
      return res.status(404).json({ message: 'Exam not found' });
    }

    const examTitle = exam.title;
    const examCreator = exam.createdBy;

    // Delete all results for this exam
    const Result = require('../models/Result');
    await Result.deleteMany({ exam: exam._id });

    // Delete the exam
    await exam.deleteOne();

    // Log the activity
    await ActivityLog.logActivity({
      user: req.user._id,
      action: 'delete_exam',
      details: {
        examId: req.params.id,
        examTitle: examTitle,
        examCreator: examCreator
      }
    });

    res.json({ message: 'Exam and all associated results deleted successfully' });
  } catch (error) {
    console.error('Delete exam error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get any exam by ID (super admin only)
// @route   GET /api/superadmin/exams/:id
// @access  Private/SuperAdmin
const getExamById = async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id)
      .populate('createdBy', 'firstName lastName email organization')
      .populate({ path: 'sections.questions', model: 'Question' });

    if (!exam) {
      return res.status(404).json({ message: 'Exam not found' });
    }

    // Get result count for this exam
    const Result = require('../models/Result');
    const resultCount = await Result.countDocuments({ exam: exam._id });
    const completedCount = await Result.countDocuments({ exam: exam._id, isCompleted: true });

    res.json({
      exam,
      stats: {
        totalAttempts: resultCount,
        completedAttempts: completedCount
      }
    });
  } catch (error) {
    console.error('Get exam by ID error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ==================== SUBSCRIPTION MANAGEMENT ====================

// @desc    Get subscription requests (pending or all)
// @route   GET /api/superadmin/subscription-requests
// @access  Private/SuperAdmin
const getSubscriptionRequests = async (req, res) => {
  try {
    const { status = 'pending' } = req.query;

    // Define SubscriptionRequest model if not exists
    let SubscriptionRequest;
    try {
      SubscriptionRequest = require('../models/SubscriptionRequest');
    } catch (e) {
      // If model doesn't exist, return empty array
      return res.json({ requests: [], message: 'Subscription request model not configured' });
    }

    const query = status === 'all' ? {} : { status };
    const requests = await SubscriptionRequest.find(query)
      .populate('user', 'firstName lastName email organization userType')
      .sort({ createdAt: -1 });

    res.json({
      requests,
      count: requests.length,
      status: status
    });
  } catch (error) {
    console.error('Get subscription requests error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Approve subscription request
// @route   PUT /api/superadmin/subscription-requests/:id/approve
// @access  Private/SuperAdmin
const approveSubscriptionRequest = async (req, res) => {
  try {
    const { note } = req.body;

    let SubscriptionRequest;
    try {
      SubscriptionRequest = require('../models/SubscriptionRequest');
    } catch (e) {
      return res.status(400).json({ message: 'Subscription request model not configured' });
    }

    const request = await SubscriptionRequest.findById(req.params.id)
      .populate('user', 'firstName lastName email subscriptionStatus subscriptionPlan');

    if (!request) {
      return res.status(404).json({ message: 'Subscription request not found' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ message: 'Request has already been processed' });
    }

    // Prevent free plan renewal for expired free users
    if (request.requestedPlan === 'free' && request.user.subscriptionStatus === 'expired' && request.user.subscriptionPlan === 'free') {
      return res.status(400).json({ 
        message: 'Free plan users cannot renew with free plan after expiration. Please upgrade to a paid plan (Basic, Premium, or Enterprise).' 
      });
    }

    // Calculate expiration date (enterprise doesn't expire)
    const expiresAt = request.requestedPlan === 'enterprise' ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days for non-enterprise

    // Update user subscription
    await User.findByIdAndUpdate(request.user._id, {
      subscriptionPlan: request.requestedPlan,
      subscriptionStatus: 'active',
      subscriptionStartDate: new Date(),
      subscriptionEndDate: expiresAt,
      subscriptionExpiresAt: expiresAt,
      lastPaymentDate: new Date()
    });

    // Cascade to all org teachers under this admin so their own records stay in sync
    await User.updateMany(
      { parentAdmin: request.user._id, role: 'teacher' },
      {
        subscriptionPlan: request.requestedPlan,
        subscriptionStatus: 'active',
        subscriptionStartDate: new Date(),
        subscriptionEndDate: expiresAt,
        subscriptionExpiresAt: expiresAt
      }
    );

    // Update request status
    request.status = 'approved';
    request.processedBy = req.user._id;
    request.processedAt = new Date();
    request.note = note || '';
    await request.save();

    // Log activity
    await ActivityLog.logActivity({
      user: req.user._id,
      action: 'approve_subscription',
      details: {
        requestId: request._id,
        userId: request.user._id,
        userName: `${request.user.firstName} ${request.user.lastName}`,
        plan: request.requestedPlan,
        note: note
      }
    });

    res.json({
      message: 'Subscription request approved successfully',
      request
    });
  } catch (error) {
    console.error('Approve subscription request error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Reject subscription request
// @route   PUT /api/superadmin/subscription-requests/:id/reject
// @access  Private/SuperAdmin
const rejectSubscriptionRequest = async (req, res) => {
  try {
    const { note } = req.body;

    let SubscriptionRequest;
    try {
      SubscriptionRequest = require('../models/SubscriptionRequest');
    } catch (e) {
      return res.status(400).json({ message: 'Subscription request model not configured' });
    }

    const request = await SubscriptionRequest.findById(req.params.id)
      .populate('user', 'firstName lastName email');

    if (!request) {
      return res.status(404).json({ message: 'Subscription request not found' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ message: 'Request has already been processed' });
    }

    // Update request status
    request.status = 'rejected';
    request.processedBy = req.user._id;
    request.processedAt = new Date();
    request.note = note || '';
    await request.save();

    // Log activity
    await ActivityLog.logActivity({
      user: req.user._id,
      action: 'reject_subscription',
      details: {
        requestId: request._id,
        userId: request.user._id,
        userName: `${request.user.firstName} ${request.user.lastName}`,
        plan: request.requestedPlan,
        reason: note
      }
    });

    res.json({
      message: 'Subscription request rejected',
      request
    });
  } catch (error) {
    console.error('Reject subscription request error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get all active subscriptions
// @route   GET /api/superadmin/subscriptions
// @access  Private/SuperAdmin
const getAllSubscriptions = async (req, res) => {
  try {
    // Find all users with subscriptions (including free plans)
    const subscriptions = await User.find({
      subscriptionPlan: { $in: ['free', 'basic', 'premium', 'enterprise'] }
    })
    .select('firstName lastName email organization subscriptionPlan subscriptionStatus subscriptionStartDate subscriptionEndDate subscriptionExpiresAt lastPaymentDate createdAt userType role')
    .sort({ createdAt: -1 });

    console.log('[getAllSubscriptions] Found subscriptions:', subscriptions.length);

    // Format response with backfill for null dates
    const formattedSubs = subscriptions.map(user => {
      let startDate = user.subscriptionStartDate;
      let endDate = user.subscriptionExpiresAt || user.subscriptionEndDate;
      const lastPayment = user.lastPaymentDate;

      // Backfill: if startDate is null, use createdAt as fallback
      if (!startDate && user.createdAt) {
        startDate = user.createdAt;
      }

      // Backfill: if endDate is null and user is not enterprise, set to 30 days from startDate
      // Free accounts also expire in 30 days
      if (!endDate && user.subscriptionPlan !== 'enterprise' && startDate) {
        endDate = new Date(new Date(startDate).getTime() + 30 * 24 * 60 * 60 * 1000);
      }

      // Determine user type label
      let userTypeLabel = 'Individual';
      if (user.userType === 'organization') {
        userTypeLabel = 'Organization';
      } else if (user.role === 'admin' || user.role === 'superadmin') {
        userTypeLabel = 'Organization';
      }

      // subscriptionStatus is only flipped to 'expired' lazily elsewhere, so
      // recompute it against the real expiry timestamp (hour-precise) rather
      // than trusting the stored field, which can still read 'active' after
      // a plan — including one measured in hours — has already run out.
      const effectiveStatus = getEffectiveSubscriptionStatus(user) || user.subscriptionStatus;
      endDate = getSubscriptionExpiryDate(user) || endDate;

      console.log('[getAllSubscriptions] User:', user.email, 'Plan:', user.subscriptionPlan, 'Status:', effectiveStatus, 'StartDate:', startDate, 'EndDate:', endDate, 'UserType:', userTypeLabel);

      return {
        _id: user._id,
        user: {
          _id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          organization: user.organization
        },
        plan: user.subscriptionPlan,
        status: effectiveStatus,
        startDate: startDate,
        endDate: endDate,
        lastPaymentDate: lastPayment,
        userType: userTypeLabel
      };
    });

    res.json({
      subscriptions: formattedSubs,
      count: formattedSubs.length
    });
  } catch (error) {
    console.error('Get all subscriptions error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ==================== EXAM MARKETPLACE MANAGEMENT ====================

// @desc    Get all marketplace exams with comprehensive statistics
// @route   GET /api/superadmin/marketplace-exams
// @access  Private/SuperAdmin
const getMarketplaceExamsWithStats = async (req, res) => {
  try {
    const { page = 1, limit = 50, status, search, sortBy = 'createdAt' } = req.query;


    // Build query
    const query = {};
    if (status) {
      if (status === 'public') query.isPubliclyListed = true;
      else if (status === 'private') query.isPubliclyListed = false;
    }
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Get exams with creator info - use lean() for faster serialization
    let examsQuery = Exam.find(query)
      .select('title description timeLimit publicPrice retakePrice publicDescription targetAudience isPubliclyListed isLocked status createdAt createdBy level subLevel accessType')
      .populate('createdBy', 'firstName lastName email organization')
      .populate('level', 'name subLevels');

    // Sort
    if (sortBy === 'requests') {
      examsQuery = examsQuery.sort({ 'requestCount': -1 });
    } else if (sortBy === 'completions') {
      examsQuery = examsQuery.sort({ 'completionCount': -1 });
    } else if (sortBy === 'price') {
      examsQuery = examsQuery.sort({ publicPrice: -1 });
    } else {
      examsQuery = examsQuery.sort({ createdAt: -1 });
    }

    const exams = await examsQuery
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .lean();


    // Get comprehensive stats for each exam using aggregation for better performance
    const ExamRequest = require('../models/ExamRequest');
    const Result = require('../models/Result');

    // Get all exam IDs for batch querying
    const examIds = exams.map(e => e._id);

    // Run count + both aggregations in parallel for speed
    const [total, requestStats, resultStats] = await Promise.all([
      Exam.countDocuments(query),
      ExamRequest.aggregate([
        { $match: { exam: { $in: examIds } } },
        { $group: {
          _id: '$exam',
          total: { $sum: 1 },
          approved: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } },
          pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
          rejected: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } },
          uniqueRequesters: { $addToSet: '$student' }
        }}
      ]),
      Result.aggregate([
        { $match: { exam: { $in: examIds } } },
        { $group: {
          _id: '$exam',
          completed: { $sum: { $cond: [{ $eq: ['$isCompleted', true] }, 1, 0] } },
          inProgress: { $sum: { $cond: [{ $eq: ['$isCompleted', false] }, 1, 0] } },
          totalScore: { $sum: '$totalScore' },
          maxScore: { $sum: '$maxPossibleScore' }
        }}
      ])
    ]);

    // Create lookup maps
    const requestStatsMap = new Map();
    requestStats.forEach(stat => {
      requestStatsMap.set(stat._id.toString(), {
        requestCount: stat.total,
        approvedRequests: stat.approved,
        pendingRequests: stat.pending,
        rejectedRequests: stat.rejected,
        uniqueRequestersCount: stat.uniqueRequesters.filter(id => id != null).length
      });
    });

    const resultStatsMap = new Map();
    resultStats.forEach(stat => {
      resultStatsMap.set(stat._id.toString(), {
        completedCount: stat.completed,
        inProgressCount: stat.inProgress,
        averageScore: stat.maxScore > 0 ? Math.round((stat.totalScore / stat.maxScore) * 100) : 0
      });
    });

    // Combine stats with exams (already lean, no toObject needed)
    const examsWithStats = exams.map(exam => {
      const reqStats = requestStatsMap.get(exam._id.toString()) || {
        requestCount: 0,
        approvedRequests: 0,
        pendingRequests: 0,
        rejectedRequests: 0,
        uniqueRequestersCount: 0
      };
      const resStats = resultStatsMap.get(exam._id.toString()) || {
        completedCount: 0,
        inProgressCount: 0,
        averageScore: 0
      };

      return {
        ...exam,
        stats: {
          ...reqStats,
          ...resStats,
          completionRate: reqStats.requestCount > 0 ? Math.round((resStats.completedCount / reqStats.requestCount) * 100) : 0
        }
      };
    });

    // Only fetch overall stats on first page to reduce DB load
    let overallStats = null;
    if (parseInt(page) === 1) {
      const [totalMarketplaceExams, totalRequests, totalCompletions] = await Promise.all([
        Exam.countDocuments({ isPubliclyListed: true }),
        ExamRequest.countDocuments(),
        Result.countDocuments({ isCompleted: true })
      ]);
      overallStats = {
        totalMarketplaceExams,
        totalRequests,
        totalCompletions,
        overallCompletionRate: totalRequests > 0 ? Math.round((totalCompletions / totalRequests) * 100) : 0
      };
    }

    res.json({
      exams: examsWithStats,
      ...(overallStats && { stats: overallStats }),
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get marketplace exams with stats error:', error);
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      stack: error.stack
    });
    res.status(500).json({ 
      message: 'Server error',
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// @desc    Get detailed usage information for a specific exam
// @route   GET /api/superadmin/marketplace-exams/:id/usage
// @access  Private/SuperAdmin
const getExamUsageDetails = async (req, res) => {
  try {
    console.log('[SuperAdmin] Getting exam usage details for ID:', req.params.id);
    
    const exam = await Exam.findById(req.params.id)
      .populate('createdBy', 'firstName lastName email organization')
      .populate('level', 'name subLevels');

    if (!exam) {
      console.log('[SuperAdmin] Exam not found');
      return res.status(404).json({ message: 'Exam not found' });
    }

    const ExamRequest = require('../models/ExamRequest');
    const Result = require('../models/Result');

    // Get all requests with student info
    const allRequests = await ExamRequest.find({ exam: exam._id })
      .populate('student', 'firstName lastName email')
      .sort({ requestedAt: -1 });

    // Get all results with student info
    const allResults = await Result.find({ exam: exam._id })
      .populate('student', 'firstName lastName email')
      .sort({ createdAt: -1 });

    // Group requests by status
    const requestsByStatus = {
      pending: allRequests.filter(r => r.status === 'pending'),
      approved: allRequests.filter(r => r.status === 'approved'),
      rejected: allRequests.filter(r => r.status === 'rejected')
    };

    // Group results by completion status
    const resultsByStatus = {
      completed: allResults.filter(r => r.isCompleted),
      inProgress: allResults.filter(r => !r.isCompleted)
    };

    // Calculate performance metrics
    const completedResults = resultsByStatus.completed;
    let totalScore = 0;
    let maxScore = 0;
    const scoreDistribution = { excellent: 0, good: 0, average: 0, poor: 0 };

    completedResults.forEach(r => {
      totalScore += r.totalScore || 0;
      maxScore += r.maxPossibleScore || 0;
      const percentage = r.maxPossibleScore > 0 ? (r.totalScore / r.maxPossibleScore) * 100 : 0;
      if (percentage >= 80) scoreDistribution.excellent++;
      else if (percentage >= 60) scoreDistribution.good++;
      else if (percentage >= 40) scoreDistribution.average++;
      else scoreDistribution.poor++;
    });

    const averageScore = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

    // Get unique users
    const uniqueStudents = new Set();
    allRequests.forEach(r => {
      if (r.student) uniqueStudents.add(r.student._id.toString());
    });
    allResults.forEach(r => {
      if (r.student) uniqueStudents.add(r.student._id.toString());
    });

    // Timeline data (last 30 days)
    const timeline = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayRequests = allRequests.filter(r => 
        r.requestedAt && r.requestedAt.toISOString().split('T')[0] === dateStr
      ).length;
      
      const dayCompletions = allResults.filter(r => 
        r.isCompleted && r.createdAt.toISOString().split('T')[0] === dateStr
      ).length;

      timeline.push({ date: dateStr, requests: dayRequests, completions: dayCompletions });
    }

    res.json({
      exam,
      stats: {
        totalRequests: allRequests.length,
        approvedRequests: requestsByStatus.approved.length,
        pendingRequests: requestsByStatus.pending.length,
        rejectedRequests: requestsByStatus.rejected.length,
        totalResults: allResults.length,
        completedResults: completedResults.length,
        inProgressResults: resultsByStatus.inProgress.length,
        averageScore,
        scoreDistribution,
        uniqueStudents: uniqueStudents.size,
        completionRate: allRequests.length > 0 ? Math.round((completedResults.length / allRequests.length) * 100) : 0
      },
      requests: {
        all: allRequests,
        byStatus: requestsByStatus
      },
      results: {
        all: allResults,
        byStatus: resultsByStatus
      },
      timeline
    });
  } catch (error) {
    console.error('Get exam usage details error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update exam marketplace settings (super admin override)
// @route   PUT /api/superadmin/marketplace-exams/:id/settings
// @access  Private/SuperAdmin
const updateExamMarketplaceSettings = async (req, res) => {
  try {
    const { title, description, isPubliclyListed, publicPrice, retakePrice, publicDescription, targetAudience, status, levelId, subLevel, accessType } = req.body;

    const exam = await Exam.findById(req.params.id);

    if (!exam) {
      return res.status(404).json({ message: 'Exam not found' });
    }

    // Update fields (super admin can override any setting)
    if (title !== undefined && title.trim()) exam.title = title.trim();
    if (description !== undefined) exam.description = description;
    if (isPubliclyListed !== undefined) exam.isPubliclyListed = isPubliclyListed;
    if (publicPrice !== undefined) exam.publicPrice = parseFloat(publicPrice);
    if (retakePrice !== undefined) exam.retakePrice = parseFloat(retakePrice);
    if (publicDescription !== undefined) exam.publicDescription = publicDescription;
    if (targetAudience !== undefined) exam.targetAudience = targetAudience;
    if (status !== undefined) exam.status = status;
    if (levelId !== undefined) exam.level = levelId || null;
    if (subLevel !== undefined) exam.subLevel = subLevel || null;
    if (accessType !== undefined) exam.accessType = accessType === 'free' ? 'free' : 'subscription';

    await exam.save();

    // Log the activity
    await ActivityLog.logActivity({
      user: req.user._id,
      action: 'update_exam_marketplace_settings',
      details: {
        examId: exam._id,
        examTitle: exam.title,
        changes: req.body
      }
    });

    res.json({
      message: 'Exam marketplace settings updated successfully',
      exam
    });
  } catch (error) {
    console.error('Update exam marketplace settings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update basic exam details
// @route   PUT /api/superadmin/marketplace-exams/:id
// @access  Private/SuperAdmin
const updateExamDetails = async (req, res) => {
  try {
    const { title, description, timeLimit, passingScore, isLocked } = req.body;

    const exam = await Exam.findById(req.params.id);

    if (!exam) {
      return res.status(404).json({ message: 'Exam not found' });
    }

    // Update fields
    if (title) exam.title = title;
    if (description) exam.description = description;
    if (timeLimit !== undefined) exam.timeLimit = parseInt(timeLimit);
    if (passingScore !== undefined) exam.passingScore = parseInt(passingScore);
    if (isLocked !== undefined) exam.isLocked = isLocked;

    await exam.save();

    // Log the activity
    await ActivityLog.logActivity({
      user: req.user._id,
      action: 'update_exam_details',
      details: {
        examId: exam._id,
        examTitle: exam.title,
        changes: req.body
      }
    });

    res.json({
      message: 'Exam details updated successfully',
      exam
    });
  } catch (error) {
    console.error('Update exam details error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get exam with all questions for review (super admin only)
// @route   GET /api/superadmin/marketplace-exams/:id/review
// @access  Private/SuperAdmin
const getExamForReview = async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id)
      .populate('createdBy', 'firstName lastName email organization')
      .populate('level', 'name description subLevels')
      .populate('sections.questions');

    if (!exam) {
      return res.status(404).json({ message: 'Exam not found' });
    }

    res.json({
      exam
    });
  } catch (error) {
    console.error('Get exam for review error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get all pending exam requests system-wide
// @route   GET /api/superadmin/exam-requests
// @access  Private/SuperAdmin
const getAllExamRequests = async (req, res) => {
  try {
    const { status = 'pending', organizationId, page = 1, limit = 20 } = req.query;
    
    // Parse pagination parameters
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    const skip = (pageNum - 1) * limitNum;
    
    // Build query filter
    const filter = {};
    if (status && status !== 'all') {
      filter.status = status;
    }
    
    // If organizationId is provided, filter by teacher's organization
    if (organizationId) {
      const teachers = await User.find({ 
        $or: [
          { _id: organizationId, role: 'teacher' },
          { parentAdmin: organizationId, role: 'teacher' }
        ]
      }).select('_id');
      const teacherIds = teachers.map(t => t._id);
      filter.teacher = { $in: teacherIds };
    }
    
    // OPTIMIZATION: Use aggregation pipeline to avoid N+1 queries
    // This fetches organization info in a single query instead of per-request
    const aggregationPipeline = [
      { $match: filter },
      {
        $lookup: {
          from: 'exams',
          localField: 'exam',
          foreignField: '_id',
          as: 'exam',
          pipeline: [
            {
              $project: {
                title: 1,
                description: 1,
                timeLimit: 1,
                isPubliclyListed: 1
              }
            }
          ]
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'teacher',
          foreignField: '_id',
          as: 'teacher',
          pipeline: [
            {
              $project: {
                firstName: 1,
                lastName: 1,
                email: 1,
                organization: 1,
                parentAdmin: 1,
                createdBy: 1
              }
            }
          ]
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'student',
          foreignField: '_id',
          as: 'student',
          pipeline: [
            {
              $project: {
                firstName: 1,
                lastName: 1,
                email: 1
              }
            }
          ]
        }
      },
      { $unwind: '$exam' },
      { $unwind: '$teacher' },
      { $unwind: { path: '$student', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'users',
          let: { createdBy: '$teacher.createdBy', parentAdmin: '$teacher.parentAdmin' },
          as: 'orgAdmin',
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $eq: ['$_id', '$$createdBy'] },
                    { $eq: ['$_id', '$$parentAdmin'] }
                  ]
                }
              }
            },
            {
              $project: {
                _id: 1,
                organization: 1,
                email: 1
              }
            }
          ]
        }
      },
      { $unwind: { path: '$orgAdmin', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          teacher: {
            id: '$teacher._id',
            firstName: '$teacher.firstName',
            lastName: '$teacher.lastName',
            email: '$teacher.email'
          },
          organization: {
            $cond: {
              if: '$orgAdmin',
              then: {
                id: '$orgAdmin._id',
                name: { $ifNull: ['$orgAdmin.organization', 'Unknown Organization'] },
                email: '$orgAdmin.email'
              },
              else: {
                $cond: {
                  if: '$teacher.organization',
                  then: {
                    id: '$teacher._id',
                    name: '$teacher.organization',
                    email: '$teacher.email'
                  },
                  else: {
                    id: '$teacher._id',
                    name: {
                      $concat: [
                        '$teacher.firstName',
                        ' ',
                        '$teacher.lastName',
                        ' (Individual Teacher)'
                      ]
                    },
                    email: '$teacher.email'
                  }
                }
              }
            }
          }
        }
      },
      { $sort: { requestedAt: -1 } },
      { $skip: skip },
      { $limit: limitNum }
    ];
    
    const requests = await ExamRequest.aggregate(aggregationPipeline);
    
    // Get total count for pagination
    const total = await ExamRequest.countDocuments(filter);
    
    res.json({
      requests,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Get all exam requests error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Approve an exam request (super admin override)
// @route   PUT /api/superadmin/exam-requests/:requestId/approve
// @access  Private/SuperAdmin
const superAdminApproveExamRequest = async (req, res) => {
  try {
    const { waivePayment } = req.body;
    
    console.log('[SuperAdmin] Starting exam request approval for:', req.params.requestId);
    
    const request = await ExamRequest.findById(req.params.requestId);
    
    if (!request) {
      console.log('[SuperAdmin] Request not found:', req.params.requestId);
      return res.status(404).json({ message: 'Request not found' });
    }
    
    console.log('[SuperAdmin] Request found, status:', request.status);
    
    // Check if already processed
    if (request.status !== 'pending') {
      console.log('[SuperAdmin] Request already processed:', request.status);
      return res.status(400).json({ message: 'Request has already been processed' });
    }
    
    // Import the processExamApproval function from marketplaceController
    const { processExamApproval } = require('./marketplaceController');
    
    console.log('[SuperAdmin] Calling processExamApproval...');
    // Use the helper function to process approval
    const approvalResult = await processExamApproval(request, waivePayment);
    console.log('[SuperAdmin] processExamApproval completed successfully');
    
    // Log the activity
    await ActivityLog.logActivity({
      user: req.user._id,
      action: 'superadmin_approve_exam_request',
      details: {
        requestId: request._id,
        examId: request.exam,
        teacherId: request.teacher,
        studentEmail: approvalResult.studentUser.email,
        waivedPayment: waivePayment
      }
    });
    
    console.log('[SuperAdmin] Sending success response');
    res.json({
      message: 'Request approved successfully by super admin',
      request: approvalResult.request,
      shareToken: approvalResult.shareToken,
      accessCode: approvalResult.accessCode,
      student: approvalResult.studentUser
    });
  } catch (error) {
    console.error('[SuperAdmin] Approve exam request error:', error);
    console.error('[SuperAdmin] Error stack:', error.stack);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// @desc    Reject an exam request (super admin override)
// @route   PUT /api/superadmin/exam-requests/:requestId/reject
// @access  Private/SuperAdmin
const superAdminRejectExamRequest = async (req, res) => {
  try {
    const { reason } = req.body;
    
    const request = await ExamRequest.findById(req.params.requestId);
    
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }
    
    // Check if already processed
    if (request.status !== 'pending') {
      return res.status(400).json({ message: 'Request has already been processed' });
    }
    
    // Update request status
    request.status = 'rejected';
    request.processedAt = new Date();
    request.teacherNotes = reason || 'Rejected by super admin';
    
    await request.save();
    
    // Log the activity
    await ActivityLog.logActivity({
      user: req.user._id,
      action: 'superadmin_reject_exam_request',
      details: {
        requestId: request._id,
        examId: request.exam,
        teacherId: request.teacher,
        reason: reason || 'No reason provided'
      }
    });
    
    res.json({
      message: 'Request rejected successfully',
      request
    });
  } catch (error) {
    console.error('Super admin reject exam request error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get exam request statistics for super admin
// @route   GET /api/superadmin/exam-requests/stats
// @access  Private/SuperAdmin
const getExamRequestStats = async (req, res) => {
  try {
    const totalRequests = await ExamRequest.countDocuments();
    const pendingRequests = await ExamRequest.countDocuments({ status: 'pending' });
    const approvedRequests = await ExamRequest.countDocuments({ status: 'approved' });
    const rejectedRequests = await ExamRequest.countDocuments({ status: 'rejected' });
    
    // Get requests by organization
    const requestsByOrg = await ExamRequest.aggregate([
      {
        $lookup: {
          from: 'users',
          localField: 'teacher',
          foreignField: '_id',
          as: 'teacherInfo'
        }
      },
      {
        $unwind: '$teacherInfo'
      },
      {
        $group: {
          _id: '$teacherInfo.createdBy',
          organizationName: { $first: '$teacherInfo.organization' },
          total: { $sum: 1 },
          pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
          approved: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } },
          rejected: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } }
        }
      }
    ]);
    
    res.json({
      total: totalRequests,
      pending: pendingRequests,
      approved: approvedRequests,
      rejected: rejectedRequests,
      byOrganization: requestsByOrg
    });
  } catch (error) {
    console.error('Get exam request stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get all marketplace exam results (Super Admin only)
// @route   GET /api/superadmin/marketplace/results
// @access  Private/SuperAdmin
const getAllMarketplaceResults = async (req, res) => {
  try {
    const { examId, teacherId, organizationId, limit = 100, offset = 0 } = req.query;

    // Build query for marketplace exams
    const examQuery = { isPubliclyListed: true };
    
    if (examId) {
      examQuery._id = examId;
    }
    if (teacherId) {
      examQuery.createdBy = teacherId;
    }
    if (organizationId) {
      examQuery.createdBy = organizationId;
    }

    // Get all marketplace exams
    const exams = await Exam.find(examQuery)
      .select('_id title')
      .sort({ createdAt: -1 });

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
      .populate('exam', 'title description timeLimit createdBy')
      .sort({ endTime: -1 })
      .skip(parseInt(offset))
      .limit(parseInt(limit));

    // Get total count for pagination
    const totalResultsCount = await Result.countDocuments({
      exam: { $in: examIds },
      isCompleted: true
    });

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
          timeLimit: result.exam.timeLimit,
          createdBy: result.exam.createdBy
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
    const totalResults = totalResultsCount;
    const averageScore = totalResults > 0
      ? Math.round(formattedResults.reduce((sum, r) => sum + r.percentage, 0) / formattedResults.length)
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
      },
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: totalResultsCount
      }
    });
  } catch (error) {
    console.error('Get all marketplace results error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get system-wide leaderboard (all exams, all students)
// @route   GET /api/superadmin/leaderboard
// @access  Private/SuperAdmin
const getSystemLeaderboard = async (req, res) => {
  try {
    const { examId, limit = 100 } = req.query;

    // Get all completed results
    let resultQuery = { isCompleted: true };
    if (examId) {
      resultQuery.exam = examId;
    }

    const results = await Result.find(resultQuery)
      .populate({
        path: 'student',
        select: 'firstName lastName email organization class',
        options: { virtuals: true }
      })
      .populate('exam', 'title maxPossibleScore')
      .select('totalScore maxPossibleScore startTime endTime')
      .sort({ totalScore: -1, endTime: -1 })
      .limit(parseInt(limit));

    // Format the results for the leaderboard
    const leaderboardData = results.map(result => {
      if (!result.student || !result.exam) return null;

      const percentage = result.maxPossibleScore > 0
        ? Math.round((result.totalScore / result.maxPossibleScore) * 100)
        : 0;

      const startTime = new Date(result.startTime);
      const endTime = new Date(result.endTime || startTime);
      const timeTakenMs = endTime - startTime;
      const timeTakenMinutes = Math.round(timeTakenMs / (1000 * 60));

      const fullName = `${result.student.firstName || ''} ${result.student.lastName || ''}`.trim();

      return {
        id: result.student._id,
        resultId: result._id,
        name: fullName,
        firstName: result.student.firstName || '',
        lastName: result.student.lastName || '',
        email: result.student.email || '',
        organization: result.student.organization || '',
        studentClass: result.student.class || '',
        score: result.totalScore || 0,
        maxScore: result.maxPossibleScore || 0,
        percentage,
        timeTaken: timeTakenMinutes,
        completedAt: result.endTime,
        startTime: result.startTime,
        examId: result.exam._id,
        examTitle: result.exam.title || 'Unknown',
        uniqueId: `${result.student._id}-${result._id}`
      };
    }).filter(Boolean);

    // Sort by percentage (highest first), then by time taken (shortest first)
    leaderboardData.sort((a, b) => {
      if (b.percentage !== a.percentage) {
        return b.percentage - a.percentage;
      }
      return a.timeTaken - b.timeTaken;
    });

    // Get all exams for the dropdown
    const exams = await Exam.find({}).select('_id title').sort({ title: 1 });

    res.json({
      leaderboard: leaderboardData,
      exams,
      examTitle: examId ? (await Exam.findById(examId).select('title'))?.title || 'Selected Exam' : 'All Exams'
    });
  } catch (error) {
    console.error('Get system leaderboard error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get activity logs for a specific organization/teacher
// @route   GET /api/superadmin/organizations/:id/activity
// @access  Private/SuperAdmin
const getOrganizationActivity = async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50, period = '30d' } = req.query;

    // Calculate date range
    const now = new Date();
    const startDate = new Date();
    if (period === '7d') startDate.setDate(now.getDate() - 7);
    else if (period === '30d') startDate.setDate(now.getDate() - 30);
    else if (period === '90d') startDate.setDate(now.getDate() - 90);
    else if (period === '1y') startDate.setFullYear(now.getFullYear() - 1);
    else startDate.setDate(now.getDate() - 30);

    // Get the organization/teacher
    const entity = await User.findById(id).select('-password');
    if (!entity) {
      return res.status(404).json({ message: 'Organization/Teacher not found' });
    }

    // Get all users under this organization (if it's an org admin)
    let userIds = [entity._id];
    if (entity.role === 'admin' || entity.role === 'superadmin') {
      const teachers = await User.find({ parentAdmin: entity._id, role: 'teacher' }).select('_id');
      userIds = [...userIds, ...teachers.map(t => t._id)];
    }

    // Get activity logs for all users in this scope
    const activities = await ActivityLog.find({
      user: { $in: userIds },
      timestamp: { $gte: startDate }
    })
      .populate('user', 'firstName lastName email organization')
      .sort({ timestamp: -1 })
      .limit(parseInt(limit));

    // Group activities by action type for summary
    const activitySummary = {};
    activities.forEach(activity => {
      const action = activity.action;
      if (!activitySummary[action]) {
        activitySummary[action] = 0;
      }
      activitySummary[action]++;
    });

    res.json({
      entity: {
        _id: entity._id,
        name: entity.organization || `${entity.firstName} ${entity.lastName}`,
        email: entity.email,
        role: entity.role
      },
      period,
      summary: activitySummary,
      totalActivities: activities.length,
      activities
    });
  } catch (error) {
    console.error('Get organization activity error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get all teachers with their activity
// @route   GET /api/superadmin/teachers
// @access  Private/SuperAdmin
const getAllTeachers = async (req, res) => {
  try {
    const { search, organizationId, period = '30d', limit = 50 } = req.query;

    // Calculate date range
    const now = new Date();
    const startDate = new Date();
    if (period === '7d') startDate.setDate(now.getDate() - 7);
    else if (period === '30d') startDate.setDate(now.getDate() - 30);
    else if (period === '90d') startDate.setDate(now.getDate() - 90);
    else if (period === '1y') startDate.setFullYear(now.getFullYear() - 1);
    else startDate.setDate(now.getDate() - 30);

    // Build query for teachers
    const query = { role: 'teacher' };
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    if (organizationId) {
      query.$or = [
        { parentAdmin: organizationId },
        { createdBy: organizationId }
      ];
    }

    // Get teachers
    const teachers = await User.find(query)
      .select('-password')
      .populate('parentAdmin', 'firstName lastName organization email')
      .populate('createdBy', 'firstName lastName organization email')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    // Get activity counts for each teacher
    const teachersWithActivity = await Promise.all(
      teachers.map(async (teacher) => {
        const activityCount = await ActivityLog.countDocuments({
          user: teacher._id,
          timestamp: { $gte: startDate }
        });

        // Get recent activities
        const recentActivities = await ActivityLog.find({
          user: teacher._id,
          timestamp: { $gte: startDate }
        })
          .sort({ timestamp: -1 })
          .limit(5);

        // Get stats
        const examCount = await Exam.countDocuments({ createdBy: teacher._id });
        const studentCount = await User.countDocuments({ createdBy: teacher._id, role: 'student' });

        return {
          _id: teacher._id,
          firstName: teacher.firstName,
          lastName: teacher.lastName,
          email: teacher.email,
          organization: teacher.organization,
          parentAdmin: teacher.parentAdmin,
          createdBy: teacher.createdBy,
          role: teacher.role,
          subscriptionPlan: teacher.subscriptionPlan,
          subscriptionStatus: teacher.subscriptionStatus,
          isBlocked: teacher.isBlocked,
          createdAt: teacher.createdAt,
          lastLogin: teacher.lastLogin,
          stats: {
            examCount,
            studentCount,
            activityCount
          },
          recentActivities
        };
      })
    );

    res.json(teachersWithActivity);
  } catch (error) {
    console.error('Get all teachers error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get activity logs for a specific teacher
// @route   GET /api/superadmin/teachers/:id/activity
// @access  Private/SuperAdmin
const getTeacherActivity = async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50, period = '30d' } = req.query;

    // Calculate date range
    const now = new Date();
    const startDate = new Date();
    if (period === '7d') startDate.setDate(now.getDate() - 7);
    else if (period === '30d') startDate.setDate(now.getDate() - 30);
    else if (period === '90d') startDate.setDate(now.getDate() - 90);
    else if (period === '1y') startDate.setFullYear(now.getFullYear() - 1);
    else startDate.setDate(now.getDate() - 30);

    // Get the teacher
    const teacher = await User.findById(id).select('-password');
    if (!teacher || teacher.role !== 'teacher') {
      return res.status(404).json({ message: 'Teacher not found' });
    }

    // Get activity logs
    const activities = await ActivityLog.find({
      user: teacher._id,
      timestamp: { $gte: startDate }
    })
      .sort({ timestamp: -1 })
      .limit(parseInt(limit));

    // Group activities by action type for summary
    const activitySummary = {};
    activities.forEach(activity => {
      const action = activity.action;
      if (!activitySummary[action]) {
        activitySummary[action] = 0;
      }
      activitySummary[action]++;
    });

    res.json({
      teacher: {
        _id: teacher._id,
        firstName: teacher.firstName,
        lastName: teacher.lastName,
        email: teacher.email,
        organization: teacher.organization
      },
      period,
      summary: activitySummary,
      totalActivities: activities.length,
      activities
    });
  } catch (error) {
    console.error('Get teacher activity error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  createSuperAdmin,
  getAllOrganizations,
  getOrganizationById,
  updateOrganizationSubscription,
  toggleOrganizationBlock,
  getSuperAdminDashboardStats,
  deleteOrganization,
  getAllUsers,
  getAllExams,
  getAllResults,
  getResultDetails,
  getSystemOverview,
  getUserById,
  updateUser,
  deleteUser,
  toggleUserBlock,
  deleteExam,
  getExamById,
  getSubscriptionRequests,
  approveSubscriptionRequest,
  rejectSubscriptionRequest,
  getAllSubscriptions,
  getMarketplaceExamsWithStats,
  getExamUsageDetails,
  updateExamMarketplaceSettings,
  updateExamDetails,
  getExamForReview,
  getStudentPerformanceAnalytics,
  getTeacherPerformanceAnalytics,
  getOrganizationPerformanceAnalytics,
  getTimeSeriesAnalytics,
  getExamAnalytics,
  getMarketplaceAnalytics,
  getAllExamRequests,
  superAdminApproveExamRequest,
  superAdminRejectExamRequest,
  getExamRequestStats,
  getAllMarketplaceResults,
  getSystemLeaderboard,
  getOrganizationActivity,
  getAllTeachers,
  getTeacherActivity
};
