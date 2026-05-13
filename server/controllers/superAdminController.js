const User = require('../models/User');
const Exam = require('../models/Exam');
const ActivityLog = require('../models/ActivityLog');

// @desc    Get all organizations (admins with subscriptions)
// @route   GET /api/superadmin/organizations
// @access  Private/SuperAdmin
const getAllOrganizations = async (req, res) => {
  try {
    // Get all organizations (users with admin role and subscription info)
    const organizations = await User.find({
      role: 'admin',
      subscriptionPlan: { $ne: null }
    }).select('-password').sort({ createdAt: -1 });

    // Get stats for each organization
    const organizationsWithStats = await Promise.all(
      organizations.map(async (org) => {
        const teacherCount = await User.countDocuments({
          role: 'teacher',
          parentAdmin: org._id
        });

        const studentCount = await User.countDocuments({
          role: 'student',
          createdBy: org._id
        });

        const examCount = await Exam.countDocuments({
          createdBy: org._id
        });

        return {
          _id: org._id,
          name: org.organization,
          email: org.email,
          firstName: org.firstName,
          lastName: org.lastName,
          phone: org.phone,
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

    if (!organization || organization.role !== 'admin') {
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

    if (!organization || organization.role !== 'admin') {
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

    if (!organization || organization.role !== 'admin') {
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
    // Count total organizations
    const totalOrganizations = await User.countDocuments({
      role: 'admin',
      subscriptionPlan: { $ne: null }
    });

    // Count organizations by subscription plan
    const freeOrganizations = await User.countDocuments({
      role: 'admin',
      subscriptionPlan: 'free'
    });
    const basicOrganizations = await User.countDocuments({
      role: 'admin',
      subscriptionPlan: 'basic'
    });
    const premiumOrganizations = await User.countDocuments({
      role: 'admin',
      subscriptionPlan: 'premium'
    });
    const enterpriseOrganizations = await User.countDocuments({
      role: 'admin',
      subscriptionPlan: 'enterprise'
    });

    // Count active vs pending subscriptions
    const activeSubscriptions = await User.countDocuments({
      role: 'admin',
      subscriptionStatus: 'active'
    });
    const pendingSubscriptions = await User.countDocuments({
      role: 'admin',
      subscriptionStatus: 'pending'
    });
    const expiredSubscriptions = await User.countDocuments({
      role: 'admin',
      subscriptionStatus: 'expired'
    });

    // Count total teachers
    const totalTeachers = await User.countDocuments({
      role: 'teacher'
    });

    // Count total students
    const totalStudents = await User.countDocuments({
      role: 'student'
    });

    // Count total exams
    const totalExams = await Exam.countDocuments();

    // Get recent organizations (last 5)
    const recentOrganizations = await User.find({
      role: 'admin',
      subscriptionPlan: { $ne: null }
    })
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
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
        teachers: totalTeachers,
        students: totalStudents
      },
      exams: totalExams,
      recentOrganizations: recentOrganizations.map(org => ({
        _id: org._id,
        name: org.organization,
        email: org.email,
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

    if (!organization || organization.role !== 'admin') {
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

module.exports = {
  getAllOrganizations,
  getOrganizationById,
  updateOrganizationSubscription,
  toggleOrganizationBlock,
  getSuperAdminDashboardStats,
  deleteOrganization
};
