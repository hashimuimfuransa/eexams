const Subscription = require('../models/Subscription');
const User = require('../models/User');
const Exam = require('../models/Exam');
const Level = require('../models/Level');
const { freeExamMatchesUserSubLevel, subscriptionCoversExam } = require('../utils/subLevelAccess');

/**
 * Middleware to validate exam access based on level, subscription status, and free exam usage
 */
const validateExamAccess = async (req, res, next) => {
  try {
    const examId = req.params.id || req.body.examId;
    const userId = req.user._id;

    // Get the exam
    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({ message: 'Exam not found' });
    }

    // Get the user with level information
    const user = await User.findById(userId).populate('level');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if user has selected a level
    if (!user.level) {
      return res.status(403).json({ 
        message: 'Please select your learning level before accessing exams',
        requiresLevelSelection: true
      });
    }

    // Check if exam belongs to user's level
    if (exam.level && exam.level.toString() !== user.level._id.toString()) {
      return res.status(403).json({ 
        message: 'This exam is not available for your current level',
        userLevel: user.level.name,
        examLevel: exam.level ? (await Level.findById(exam.level)).name : 'Not assigned'
      });
    }

    // If exam is free, check free exam usage
    if (exam.accessType === 'free') {
      // A sub-level-tagged free exam requires the student's own sub-level to match
      if (!freeExamMatchesUserSubLevel(exam, user)) {
        return res.status(403).json({
          message: 'This free exam is not available for your sub-level',
          requiresSubLevelMatch: true
        });
      }

      // Check if user has already used their free exam for this level
      if (user.freeExamUsed && user.freeExamLevel &&
          user.freeExamLevel.toString() === user.level._id.toString()) {
        return res.status(403).json({
          message: 'You have already used your free exam for this level. Subscribe to access more exams.',
          freeExamUsed: true,
          requiresSubscription: true
        });
      }

      // Allow access to free exam
      req.examAccess = {
        type: 'free',
        canAccess: true
      };
      return next();
    }

    // If exam requires subscription, check subscription status
    if (exam.accessType === 'subscription') {
      const subscription = await Subscription.getActiveSubscriptionForLevel(
        userId,
        user.level._id
      );

      if (!subscription || !subscription.isValid()) {
        return res.status(403).json({
          message: 'This exam requires an active subscription',
          requiresSubscription: true,
          currentLevel: user.level.name
        });
      }

      // Check if subscription has expired
      if (subscription.expiresAt < new Date()) {
        return res.status(403).json({
          message: 'Your subscription has expired. Please renew to continue.',
          subscriptionExpired: true
        });
      }

      // A sub-level-specific subscription only covers exams in that
      // sub-level (or untagged, general exams); it does not unlock other
      // sub-levels' content.
      if (!subscriptionCoversExam(subscription, exam)) {
        return res.status(403).json({
          message: 'Your subscription does not cover this sub-level. Upgrade to a full-level plan or the matching sub-level plan.',
          requiresSubLevelMatch: true,
          subscriptionSubLevel: subscription.subLevel,
          examSubLevel: exam.subLevel
        });
      }

      // Allow access with subscription
      req.examAccess = {
        type: 'subscription',
        canAccess: true,
        subscription: subscription
      };
      return next();
    }

    // Default: allow access for teachers, admins, and superadmins
    if (['teacher', 'admin', 'superadmin'].includes(user.role)) {
      req.examAccess = {
        type: 'admin',
        canAccess: true
      };
      return next();
    }

    // If we reach here, deny access
    return res.status(403).json({ 
      message: 'You do not have permission to access this exam' 
    });

  } catch (error) {
    console.error('Exam access validation error:', error);
    res.status(500).json({ message: 'Server error during access validation' });
  }
};

/**
 * Middleware to mark free exam as used after exam completion
 */
const markFreeExamUsed = async (req, res, next) => {
  try {
    const examId = req.params.id || req.body.examId;
    const userId = req.user._id;

    const exam = await Exam.findById(examId);
    const user = await User.findById(userId);

    if (exam.accessType === 'free' && !user.freeExamUsed) {
      user.freeExamUsed = true;
      user.freeExamLevel = user.level;
      await user.save();
    }

    next();
  } catch (error) {
    console.error('Mark free exam used error:', error);
    // Don't block the request if this fails
    next();
  }
};

/**
 * Middleware to check if user needs to select a level
 */
const checkLevelSelection = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    // Skip level check for teachers, admins, and superadmins
    if (['teacher', 'admin', 'superadmin'].includes(user.role)) {
      return next();
    }

    // Check if student has selected a level
    if (!user.level) {
      return res.status(403).json({ 
        message: 'Please select your learning level to continue',
        requiresLevelSelection: true
      });
    }

    next();
  } catch (error) {
    console.error('Check level selection error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  validateExamAccess,
  markFreeExamUsed,
  checkLevelSelection
};
