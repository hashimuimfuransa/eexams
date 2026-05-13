const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');

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

module.exports = router;
