const User = require('../models/User');
const Exam = require('../models/Exam');
const ActivityLog = require('../models/ActivityLog');

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

    // Get all individual teachers (they act as their own organization)
    const individualTeachers = await User.find({
      role: 'teacher',
      userType: 'individual'
    }).select('-password').sort({ createdAt: -1 });

    // Combine all organization entities
    const allOrgs = [...orgAdmins, ...individualTeachers];

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

        return {
          _id: org._id,
          name: org.organization || `${org.firstName} ${org.lastName} (Individual)`,
          email: org.email,
          firstName: org.firstName,
          lastName: org.lastName,
          phone: org.phone,
          role: org.role,
          userType: org.userType,
          subscriptionPlan: org.subscriptionPlan,
          subscriptionStatus: org.subscriptionStatus,
          subscriptionExpiresAt: org.subscriptionExpiresAt,
          isBlocked: org.isBlocked,
          createdAt: org.createdAt,
          lastLogin: org.lastLogin,
          stats: {
            teacherCount,
            studentCount,
            examCount
          }
        };
      })
    );

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
    const { firstName, lastName, email, phone, role, organization, isBlocked, subscriptionPlan, subscriptionStatus } = req.body;

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent changing another super admin's role unless you're the main super admin
    if (user.role === 'superadmin' && role && role !== 'superadmin') {
      return res.status(403).json({ message: 'Cannot demote a super admin' });
    }

    // Update fields
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (email) user.email = email;
    if (phone) user.phone = phone;
    if (role) user.role = role;
    if (organization !== undefined) user.organization = organization;
    if (isBlocked !== undefined) user.isBlocked = isBlocked;
    if (subscriptionPlan) user.subscriptionPlan = subscriptionPlan;
    if (subscriptionStatus) user.subscriptionStatus = subscriptionStatus;

    await user.save();

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

    // Prevent deleting the main super admin
    if (user.role === 'superadmin') {
      return res.status(403).json({ message: 'Cannot delete a super admin account' });
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
      .populate('user', 'firstName lastName email');

    if (!request) {
      return res.status(404).json({ message: 'Subscription request not found' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ message: 'Request has already been processed' });
    }

    // Update user subscription
    await User.findByIdAndUpdate(request.user._id, {
      subscriptionPlan: request.requestedPlan,
      subscriptionStatus: 'active',
      subscriptionStartDate: new Date(),
      subscriptionEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      lastPaymentDate: new Date()
    });

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
    // Find users with paid subscriptions (not free)
    const subscriptions = await User.find({
      subscriptionPlan: { $ne: 'free' }
    })
    .select('firstName lastName email organization subscriptionPlan subscriptionStatus subscriptionStartDate subscriptionEndDate lastPaymentDate')
    .sort({ subscriptionStartDate: -1 });

    // Format response
    const formattedSubs = subscriptions.map(user => ({
      _id: user._id,
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        organization: user.organization
      },
      plan: user.subscriptionPlan,
      status: user.subscriptionStatus,
      startDate: user.subscriptionStartDate,
      endDate: user.subscriptionEndDate,
      lastPayment: user.lastPaymentDate
    }));

    res.json({
      subscriptions: formattedSubs,
      count: formattedSubs.length
    });
  } catch (error) {
    console.error('Get all subscriptions error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getAllOrganizations,
  getOrganizationById,
  updateOrganizationSubscription,
  toggleOrganizationBlock,
  getSuperAdminDashboardStats,
  deleteOrganization,
  getAllUsers,
  getAllExams,
  getAllResults,
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
  getAllSubscriptions
};
