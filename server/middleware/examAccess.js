const Subscription = require('../models/Subscription');
const User = require('../models/User');
const Exam = require('../models/Exam');
const Level = require('../models/Level');
const ExamRequest = require('../models/ExamRequest');
const SharedExam = require('../models/SharedExam');
const Result = require('../models/Result');
const {
  freeExamMatchesUserSubLevel,
  subscriptionCoversExam,
  syncUserLevelFromSubscription,
  getActiveLevelSubscriptions,
  findSubscriptionCoveringExam
} = require('../utils/subLevelAccess');

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

    // Fill in a missing level from an active subscription before gating on it
    // below. A level the student *has* chosen is left alone even when their
    // plan covers a different one — the subscription check further down grants
    // that plan's exams without touching the selection.
    const synced = await syncUserLevelFromSubscription(userId, user.level?._id, user.subLevel);
    if (synced) {
      user.level = synced.level;
      user.subLevel = synced.subLevel;
    }

    // A direct assignment (teacher/marketplace grant) or an approved exam
    // request is a legacy grant that bypasses level/sub-level/subscription
    // gating entirely — the student was explicitly given this exam, so it
    // shouldn't matter whether they've selected a level yet or whether it
    // matches the exam's level/sub-level.
    const hasLegacyGrant = (exam.assignedTo || []).some(id => id.toString() === userId.toString()) ||
      !!(await ExamRequest.exists({ exam: exam._id, student: userId, status: 'approved' }));

    if (hasLegacyGrant) {
      req.examAccess = { type: 'legacy-grant', canAccess: true };
      return next();
    }

    // A student who joined this exam via a teacher's public/private share
    // link was explicitly let in through that flow (join password, invite,
    // etc.) — that should also bypass level/sub-level/subscription gating,
    // the same way a direct assignment does. Without this, students who
    // haven't picked a level yet (or whose level doesn't match) get a 403
    // on /exam/:id/start even though they were just allowed to join.
    const hasShareGrant = !!(await SharedExam.exists({
      exam: exam._id,
      isActive: true,
      students: {
        $elemMatch: {
          $or: [
            { student: userId },
            { studentId: userId },
            ...(user.email ? [{ email: user.email.toLowerCase().trim() }] : [])
          ]
        }
      }
    }));

    if (hasShareGrant) {
      req.examAccess = { type: 'share-grant', canAccess: true };
      return next();
    }

    // An exam-scoped subscription (bought for this exam specifically) unlocks
    // it whatever its access type, level, or sub-level.
    const examSubscription = await Subscription.getActiveSubscriptionForExam(userId, exam._id);
    if (examSubscription && examSubscription.isValid()) {
      req.examAccess = {
        type: 'subscription-exam',
        canAccess: true,
        subscription: examSubscription
      };
      return next();
    }

    // A level subscription unlocks its own level's exams regardless of which
    // level the student currently has selected — students can hold a plan on
    // one level while browsing another, and the exam bank lists that plan's
    // exams (first, in fact), so starting them has to work too. Checked ahead
    // of the level-mismatch and free-exam rules below, since both of those key
    // off the *selected* level and would otherwise refuse paid-for content.
    const levelSubscriptions = await getActiveLevelSubscriptions(userId);
    const coveringSubscription = findSubscriptionCoveringExam(levelSubscriptions, exam);
    if (coveringSubscription) {
      req.examAccess = {
        type: 'subscription',
        canAccess: true,
        subscription: coveringSubscription
      };
      return next();
    }

    // Check if exam belongs to user's level (only enforced once a level is selected)
    if (user.level && exam.level && exam.level.toString() !== user.level._id.toString()) {
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

      // A free exam grants exactly one attempt to non-subscribers — retaking
      // it (once a completed result already exists) requires an active
      // subscription, the same as any subscription-gated exam, so students
      // can't keep retaking free content indefinitely without ever paying.
      const alreadyCompleted = await Result.exists({
        student: userId,
        exam: exam._id,
        isCompleted: true
      });

      // Reaching here means neither an exam-scoped nor a level subscription
      // covers this exam — both were checked (and would have returned) above.
      if (alreadyCompleted) {
        return res.status(403).json({
          message: 'This exam requires an active subscription to retake. Subscribe to unlock unlimited retakes.',
          requiresSubscription: true
        });
      }

      req.examAccess = {
        type: 'free',
        canAccess: true
      };
      return next();
    }

    // If exam requires subscription, every path that could have granted it ran
    // above — all that's left is reporting the right reason for the refusal.
    if (exam.accessType === 'subscription') {
      // An active plan on this exam's own level can only have failed the
      // coverage test on sub-level scope.
      const activeSameLevel = levelSubscriptions.find(sub =>
        !!exam.level && (sub.level?._id || sub.level)?.toString() === exam.level.toString());

      if (activeSameLevel) {
        // A sub-level-specific subscription only covers exams in that
        // sub-level (or untagged, general exams); it does not unlock other
        // sub-levels' content.
        return res.status(403).json({
          message: 'Your subscription does not cover this sub-level. Upgrade to a full-level plan or the matching sub-level plan.',
          requiresSubLevelMatch: true,
          subscriptionSubLevel: activeSameLevel.subLevel,
          examSubLevel: exam.subLevel
        });
      }

      // Distinguish "never subscribed" from "lapsed" so the student is told to
      // renew rather than to shop for a plan they already bought.
      const lapsedSameLevel = exam.level
        ? await Subscription.findOne({ user: userId, level: exam.level, exam: null })
            .sort({ expiresAt: -1 })
        : null;

      if (lapsedSameLevel && subscriptionCoversExam(lapsedSameLevel, exam)) {
        return res.status(403).json({
          message: 'Your subscription has expired. Please renew to continue.',
          subscriptionExpired: true
        });
      }

      return res.status(403).json({
        message: 'This exam requires an active subscription',
        requiresSubscription: true,
        currentLevel: user.level?.name
      });
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
