const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const SubscriptionRequest = require('../models/SubscriptionRequest');
const { getPlanUsage } = require('../middleware/planRestrictions');

// @route   PUT /api/profile
// @desc    Update user profile
// @access  Private
router.put('/', auth, async (req, res) => {
  try {
    const { firstName, lastName, class: studentClass, organization, password, currentPassword } = req.body;

    // Find the user
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update basic profile fields
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    
    // Update student-specific fields if user is a student
    if (user.role === 'student') {
      if (studentClass !== undefined) user.class = studentClass;
      if (organization !== undefined) user.organization = organization;
    }

    // Handle password change if provided
    if (password && currentPassword) {
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

module.exports = router;
