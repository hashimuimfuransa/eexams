const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Level = require('../models/Level');
const ActivityLog = require('../models/ActivityLog');
const SubscriptionRequest = require('../models/SubscriptionRequest');
const Subscription = require('../models/Subscription');
const { getPlanUsage } = require('../middleware/planRestrictions');

// @route   PUT /api/profile
// @desc    Update user profile
// @access  Private
router.put('/', auth, async (req, res) => {
  try {
    const { firstName, lastName, email, phone, gender, class: studentClass, organization, password, currentPassword } = req.body;

    // Find the user
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Handle email change
    if (email && email !== user.email) {
      // Require current password to change email
      if (!currentPassword) {
        return res.status(400).json({ message: 'Current password is required to change email' });
      }

      // Verify current password
      const isMatch = await user.comparePassword(currentPassword);
      if (!isMatch) {
        return res.status(401).json({ message: 'Current password is incorrect' });
      }

      // Check if email already exists
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        return res.status(400).json({ message: 'Email already in use' });
      }

      // Update email
      user.email = email.toLowerCase();
    }

    // Update basic profile fields
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (phone !== undefined) user.phone = phone;
    if (gender !== undefined && ['male', 'female', ''].includes(gender)) user.gender = gender;

    // Update student-specific fields if user is a student
    if (user.role === 'student') {
      if (studentClass !== undefined) user.class = studentClass;
      if (organization !== undefined) user.organization = organization;
    }

    // Handle password change if provided (separate from email change)
    if (password && currentPassword && !email) {
      // Verify current password
      const isMatch = await user.comparePassword(currentPassword);
      if (!isMatch) {
        return res.status(401).json({ message: 'Current password is incorrect' });
      }
      
      // Set new password
      user.password = password;
    }

    // Save the updated user
    const updatedUser = await user.save();

    // Log the activity
    await ActivityLog.logActivity({
      user: user._id,
      action: 'edit_profile',
      details: {
        userId: user._id,
        userName: `${user.firstName} ${user.lastName}`
      }
    });

    // Return the updated user without password
    res.json({
      _id: updatedUser._id,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      email: updatedUser.email,
      role: updatedUser.role,
      phone: updatedUser.phone,
      gender: updatedUser.gender,
      class: updatedUser.class,
      organization: updatedUser.organization
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/profile/subscription-request
// @desc    Submit subscription payment request
// @access  Private
router.post('/subscription-request', auth, async (req, res) => {
  try {
    const { requestedPlan, paymentMethod, phoneNumber, transactionId, amountPaid, notes } = req.body;

    // Validation
    if (!requestedPlan || !phoneNumber || !transactionId || !amountPaid) {
      return res.status(400).json({
        message: 'Missing required fields: requestedPlan, phoneNumber, transactionId, amountPaid'
      });
    }

    // Check if user already has a pending request
    const existingRequest = await SubscriptionRequest.findOne({
      user: req.user._id,
      status: 'pending'
    });

    if (existingRequest) {
      return res.status(400).json({
        message: 'You already have a pending subscription request. Please wait for approval.'
      });
    }

    // Create new subscription request
    const request = new SubscriptionRequest({
      user: req.user._id,
      requestedPlan,
      paymentMethod: paymentMethod || 'momo',
      phoneNumber,
      transactionId,
      amountPaid,
      notes: notes || '',
      status: 'pending'
    });

    await request.save();

    // Log activity
    await ActivityLog.logActivity({
      user: req.user._id,
      action: 'submit_subscription_request',
      details: {
        requestId: request._id,
        plan: requestedPlan,
        amount: amountPaid,
        method: paymentMethod
      }
    });

    res.status(201).json({
      message: 'Subscription request submitted successfully. Please wait for admin approval.',
      request: {
        _id: request._id,
        requestedPlan: request.requestedPlan,
        status: request.status,
        createdAt: request.createdAt
      }
    });
  } catch (error) {
    console.error('Submit subscription request error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/profile/subscription-request
// @desc    Get user's subscription request status
// @access  Private
router.get('/subscription-request', auth, async (req, res) => {
  try {
    const requests = await SubscriptionRequest.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .select('-__v');

    res.json({ requests });
  } catch (error) {
    console.error('Get subscription requests error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/profile/plan-usage
// @desc    Get user's current plan usage and limits
// @access  Private
router.get('/plan-usage', auth, async (req, res) => {
  try {
    const usage = await getPlanUsage(req.user._id);
    
    if (!usage) {
      return res.status(500).json({ message: 'Failed to get plan usage' });
    }
    
    res.json(usage);
  } catch (error) {
    console.error('Get plan usage error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/profile/change-level
// @desc    Change user's learning level
// @access  Private
router.put('/change-level', auth, async (req, res) => {
  try {
    const { levelId, subLevel, confirm } = req.body;

    if (!levelId) {
      return res.status(400).json({ message: 'Level ID is required' });
    }

    // Validate level exists and is active
    const level = await Level.findById(levelId);
    if (!level) {
      return res.status(404).json({ message: 'Level not found' });
    }

    if (!level.isActive) {
      return res.status(400).json({ message: 'This level is not currently available' });
    }

    // Validate sub-level if provided
    let resolvedSubLevel = null;
    if (subLevel) {
      const activeSubLevels = level.getActiveSubLevels();
      const match = activeSubLevels.find(s => s.name === subLevel);
      if (!match) {
        return res.status(400).json({ message: 'Invalid sub-level for this level' });
      }
      resolvedSubLevel = match.name;
    }

    const currentUser = await User.findById(req.user._id);
    const isSameLevel = currentUser.level && currentUser.level.toString() === levelId;

    // Switching sub-level within the SAME level doesn't require a new
    // subscription or reset the free-exam slot — only a level change does.
    if (isSameLevel) {
      const user = await User.findByIdAndUpdate(
        req.user._id,
        { subLevel: resolvedSubLevel },
        { new: true }
      ).populate('level');

      return res.json({
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        level: user.level,
        subLevel: user.subLevel,
        freeExamUsed: user.freeExamUsed,
        freeExamLevel: user.freeExamLevel,
        subscriptionCancelled: false
      });
    }

    // Check if user has active subscription
    const activeSubscription = await Subscription.getActiveSubscription(req.user._id);

    if (activeSubscription && !confirm) {
      // Return warning that user needs to confirm
      return res.status(400).json({
        message: 'You have an active subscription for your current level. Changing level will require a new subscription.',
        hasActiveSubscription: true,
        currentLevel: activeSubscription.level.name,
        currentSubscriptionExpiry: activeSubscription.expiresAt,
        requiresConfirmation: true
      });
    }

    // If confirmed and has active subscription, cancel it
    if (activeSubscription && confirm) {
      await activeSubscription.cancel();
    }

    // Update user's level
    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        level: levelId,
        subLevel: resolvedSubLevel,
        // Reset free exam usage when changing level
        freeExamUsed: false,
        freeExamLevel: null
      },
      { new: true }
    ).populate('level');

    // Log activity
    await ActivityLog.logActivity({
      user: req.user._id,
      action: 'change_level',
      details: {
        oldLevel: activeSubscription?.level?.name || 'None',
        newLevel: level.name
      }
    });

    res.json({
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      level: user.level,
      subLevel: user.subLevel,
      freeExamUsed: user.freeExamUsed,
      freeExamLevel: user.freeExamLevel,
      subscriptionCancelled: !!activeSubscription
    });
  } catch (error) {
    console.error('Change level error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
