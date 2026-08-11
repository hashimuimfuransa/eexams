const Exam = require('../models/Exam');
const Result = require('../models/Result');
const User = require('../models/User');
const SharedExam = require('../models/SharedExam');
const ExamRequest = require('../models/ExamRequest');
const Subscription = require('../models/Subscription');
const emailService = require('../utils/emailService');
const {
  freeExamMatchesUserSubLevel,
  syncUserLevelFromSubscription,
  getActiveLevelSubscriptions,
  findSubscriptionCoveringExam,
  subscriptionExamQuery
} = require('../utils/subLevelAccess');
const { generateOverallRecommendation } = require('../utils/resultRecommendation');
const { SPREADSHEET_QUESTION_FIELDS } = require('../utils/resultQuestionFields');

// @desc    Get available exams for student (level-scoped exam bank)
// @route   GET /api/student/exams
// @access  Private/Student
const getAvailableExams = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('level');

    // Fills in a missing level only (see syncUserLevelFromSubscription); a
    // level the student picked is never overwritten by their plan's level.
    // Runs independently of getMyActiveSubscription's own call since the
    // dashboard fetches both endpoints in parallel.
    const synced = await syncUserLevelFromSubscription(req.user._id, user.level?._id, user.subLevel);
    if (synced) {
      user.level = synced.level;
      user.subLevel = synced.subLevel;
    }

    // Get all approved exam requests for this student (retake and initial) —
    // these are explicit teacher/marketplace grants, kept as a supplementary
    // always-unlocked access path layered on top of level + subscription checks.
    const approvedRequests = await ExamRequest.find({
      student: req.user._id,
      status: 'approved'
    }).select('exam isRetake accessCodeUsed');
    const approvedExamIds = approvedRequests.map(r => r.exam.toString());

    // Only count retake as active if the access code hasn't been used (i.e. retake not yet completed)
    const approvedRetakeExamIds = approvedRequests.filter(r => r.isRetake && !r.accessCodeUsed).map(r => r.exam.toString());
    // A grant unlocks the exam only while it is unspent — completeExam sets
    // accessCodeUsed on every request for the exam once the student submits.
    // Counting spent initial requests here (the old `!r.isRetake ||` arm) left
    // lapsed subscribers looking permanently unlocked on the dashboard, which
    // is exactly the access validateExamAccess used to hand them.
    const approvedAccessExamIds = approvedRequests
      .filter(r => !r.accessCodeUsed)
      .map(r => r.exam.toString());

    // Every active level subscription the student holds — not just one for the
    // level they currently have selected. A student can be subscribed to a
    // different level (or sub-level) than the one selected, and that plan's
    // exams are the ones they paid for, so they belong in the bank (and at the
    // top of it) regardless of the current selection.
    const levelSubscriptions = await getActiveLevelSubscriptions(req.user._id);

    // Exam-scoped subscriptions (bought for one specific exam rather than
    // the whole level) — each one unlocks just its own exam.
    const examSubscriptions = await Subscription.find({
      user: req.user._id,
      exam: { $ne: null },
      status: 'active',
      expiresAt: { $gt: new Date() }
    }).select('exam');
    const examSubscribedIds = new Set(examSubscriptions.map(s => s.exam.toString()));

    // Exam bank = exams belonging to the student's selected level AND
    // matching their sub-level (or sub-level-agnostic, level-wide exams),
    // PLUS everything covered by an active subscription on any level,
    // PLUS any exam explicitly granted via a legacy assignment/approved
    // request (regardless of level/sub-level), so teacher-shared exams keep
    // working. Without the sub-level filter, a student would see every other
    // sub-level's exams mixed into their list as permanently "locked" —
    // confusingly implying their subscription (which is correctly sub-level
    // scoped) isn't working, when it actually is.
    const levelWithSubLevelMatch = user.level ? {
      level: user.level._id,
      $or: [
        { subLevel: null },
        { subLevel: { $exists: false } },
        ...(user.subLevel ? [{ subLevel: user.subLevel }] : [])
      ]
    } : null;

    const subscriptionScopes = levelSubscriptions
      .map(subscriptionExamQuery)
      .filter(Boolean);

    const exams = await Exam.find({
      $or: [
        ...(levelWithSubLevelMatch ? [levelWithSubLevelMatch] : []),
        ...subscriptionScopes,
        { _id: { $in: [...examSubscribedIds] } },
        { assignedTo: req.user._id },
        { _id: { $in: approvedExamIds } }
      ],
      status: 'active'
    })
      .populate('createdBy', 'firstName lastName')
      .populate('level', 'name')
      .populate('sections.questions')
      .select('title description timeLimit isLocked accessType level subLevel scheduledFor startTime endTime createdAt allowSelectiveAnswering allowRetake sectionBRequiredQuestions sectionCRequiredQuestions sections');

    // Get results for this student
    const results = await Result.find({
      student: req.user._id
    }).select('exam isCompleted');

    // Map results to exam IDs (exclude approved retake exams from completed list)
    const completedExams = results
      .filter(result => result.isCompleted && !approvedRetakeExamIds.includes(result.exam.toString()))
      .map(result => result.exam.toString());

    const inProgressExams = results
      .filter(result => !result.isCompleted)
      .map(result => result.exam.toString());

    // Current time for availability check
    const now = new Date();

    // Add status to each exam
    const examsWithStatus = exams.map(exam => {
      const examObj = exam.toObject();

      // Calculate total questions from all sections
      const totalQuestions = exam.sections?.reduce((sum, section) => {
        return sum + (section.questions?.length || 0);
      }, 0) || 0;
      examObj.questions = totalQuestions;

      // Add completion status
      // If student has an approved retake request for this exam, show as not-started regardless of previous completion
      const hasApprovedRetake = approvedRetakeExamIds.includes(exam._id.toString());

      if (hasApprovedRetake) {
        examObj.status = 'not-started';
      } else if (completedExams.includes(exam._id.toString())) {
        examObj.status = 'completed';
      } else if (inProgressExams.includes(exam._id.toString())) {
        examObj.status = 'in-progress';
      } else {
        examObj.status = 'not-started';
      }

      // Determine subscription/free-exam access. A legacy explicit grant
      // (assignedTo/approved request) always unlocks the exam regardless of
      // access type, since the teacher/admin already granted it directly.
      const hasLegacyGrant = approvedAccessExamIds.includes(exam._id.toString());
      // Keyed on the exam's own level, so a plan bought for a level other than
      // the selected one still unlocks its exams.
      const coveringSubscription = findSubscriptionCoveringExam(levelSubscriptions, exam);
      const hasExamSubscription = examSubscribedIds.has(exam._id.toString());
      let accessUnlocked;
      if (hasLegacyGrant) {
        accessUnlocked = true;
      } else if (hasExamSubscription || coveringSubscription) {
        accessUnlocked = true;
      } else if (exam.accessType === 'free') {
        // A free exam grants exactly one attempt to non-subscribers — once
        // completed, retaking it requires an active subscription just like
        // any other subscription-gated content (handled above).
        const isCompletedFree = completedExams.includes(exam._id.toString());
        accessUnlocked = freeExamMatchesUserSubLevel(exam, user) && !isCompletedFree;
      } else {
        accessUnlocked = false;
      }
      examObj.accessUnlocked = accessUnlocked;

      // Surfaced to the client so subscription content can lead the list and
      // be labelled with the level it was paid for — a student subscribed to a
      // level other than the one they selected otherwise has no way to tell
      // why an unfamiliar level's exams are in their bank.
      examObj.subscriptionUnlocked = !!coveringSubscription || hasExamSubscription;
      examObj.levelName = exam.level?.name || null;
      examObj.isSelectedLevel = !!user.level && !!exam.level &&
        (exam.level._id || exam.level).toString() === user.level._id.toString();

      // Teacher's manual isLocked flag combines with subscription/free-exam access
      if (exam.isLocked && hasLegacyGrant) {
        examObj.isLocked = false;
      } else {
        examObj.isLocked = !!exam.isLocked || !accessUnlocked;
      }

      // Add availability status
      if (examObj.isLocked) {
        examObj.availability = 'locked';
      } else if (exam.startTime && exam.endTime) {
        if (now < exam.startTime) {
          examObj.availability = 'upcoming';
        } else if (now >= exam.startTime && now <= exam.endTime) {
          examObj.availability = 'available';
        } else {
          examObj.availability = 'expired';
        }
      } else {
        examObj.availability = 'unknown';
      }

      return examObj;
    });

    // Order the bank the way a student reads it: exams their subscription pays
    // for first, then anything else they can start right now, then locked
    // content — newest first within each tier. Clients re-sort for their own
    // filters, but this keeps any consumer that just renders the array (and
    // anything that truncates it) showing the paid-for exams on top.
    const accessRank = (examObj) => {
      if (examObj.subscriptionUnlocked) return 0;
      if (examObj.accessUnlocked) return 1;
      return 2;
    };
    examsWithStatus.sort((a, b) =>
      accessRank(a) - accessRank(b) || new Date(b.createdAt) - new Date(a.createdAt));

    res.json(examsWithStatus);
  } catch (error) {
    console.error('Get available exams error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get in-progress exams for student
// @route   GET /api/student/exams/in-progress
// @access  Private/Student
const getInProgressExams = async (req, res) => {
  try {
    // Get results for this student that are not completed
    const inProgressResults = await Result.find({
      student: req.user._id,
      isCompleted: false
    }).populate('exam', 'title description timeLimit');

    // Calculate time remaining for each in-progress exam
    const inProgressExams = inProgressResults.map(result => {
      const exam = result.exam;
      const timeLimit = exam?.timeLimit || 0;
      const startTime = result.startTime || new Date();
      const endTime = new Date(startTime.getTime() + timeLimit * 60 * 1000);
      const now = new Date();
      const timeRemaining = Math.max(0, endTime.getTime() - now.getTime());

      return {
        _id: result._id,
        exam: exam,
        startTime: result.startTime,
        timeRemaining: timeRemaining,
        isCompleted: result.isCompleted
      };
    });

    res.json(inProgressExams);
  } catch (error) {
    console.error('Get in-progress exams error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get specific exam by ID for student
// @route   GET /api/student/exams/:examId
// @access  Private/Student
const getExamById = async (req, res) => {
  try {
    // Check if exam is accessible via share token (for marketplace users)
    const { shareToken } = req.query;
    let exam;

    if (shareToken) {
      // Check if user has access via share token
      const sharedExam = await SharedExam.findOne({ shareToken });
      if (sharedExam && sharedExam.exam.toString() === req.params.examId) {
        // Check if user is in the shared exam students list
        const isStudentInShared = sharedExam.students.some(
          s => s.student?.toString() === req.user._id.toString()
        );
        if (isStudentInShared) {
          exam = await Exam.findById(req.params.examId)
            .populate('createdBy', 'firstName lastName')
            .populate('sections.questions')
            .select('title description timeLimit isLocked scheduledFor startTime endTime createdAt allowSelectiveAnswering allowRetake sectionBRequiredQuestions sectionCRequiredQuestions sections calculatorEnabled');
        }
      }
    }

    // If not found via share token, check if assigned, has an approved request,
    // OR belongs to the student's subscribed level (level-based access model).
    let hasLegacyGrant = false;
    if (!exam) {
      const user = await User.findById(req.user._id).populate('level');

      // Fills in a missing level only — see syncUserLevelFromSubscription.
      // Keeps the level query below consistent with the exam bank listing
      // and live access checks.
      const synced = await syncUserLevelFromSubscription(req.user._id, user?.level?._id, user?.subLevel);
      if (synced && user) {
        user.level = synced.level;
        user.subLevel = synced.subLevel;
      }

      // Check if student has an approved request for this exam. Kept for the
      // lookup below (so a granted exam outside the student's level is still
      // *found* and can report a proper lock reason instead of a bare 404)
      // even when the grant itself has been spent.
      const approvedRequest = await ExamRequest.findOne({
        exam: req.params.examId,
        student: req.user._id,
        status: 'approved'
      });
      // A direct assignment (teacher/marketplace grant) is a legacy grant
      // just like an approved request — it bypasses level/subscription
      // gating regardless of whether the student has selected a level.
      // Only an unspent request grants, matching validateExamAccess: once
      // completeExam marks it used, access falls back to the subscription
      // rules rather than staying open forever.
      const isAssigned = await Exam.exists({ _id: req.params.examId, assignedTo: req.user._id });
      hasLegacyGrant = (!!approvedRequest && !approvedRequest.accessCodeUsed) || !!isAssigned;

      // Any level the student holds an active subscription for is reachable
      // here, not just the selected one — the exam bank lists those exams, so
      // opening one has to work too.
      const levelSubscriptions = await getActiveLevelSubscriptions(req.user._id);
      const subscribedLevelIds = levelSubscriptions
        .map(sub => sub.level?._id || sub.level)
        .filter(Boolean);

      exam = await Exam.findOne({
        _id: req.params.examId,
        $or: [
          { assignedTo: req.user._id },
          { _id: { $in: approvedRequest ? [approvedRequest.exam] : [] } },
          ...(user?.level ? [{ level: user.level._id }] : []),
          ...(subscribedLevelIds.length ? [{ level: { $in: subscribedLevelIds } }] : [])
        ]
      })
        .populate('createdBy', 'firstName lastName')
        .populate('sections.questions')
        .select('title description timeLimit isLocked accessType level subLevel scheduledFor startTime endTime createdAt allowSelectiveAnswering allowRetake sectionBRequiredQuestions sectionCRequiredQuestions sections calculatorEnabled');

      // If the exam was only matched via the student's level (not a legacy
      // grant), gate it by subscription/free-exam status just like the exam
      // bank listing does, so this endpoint stays consistent with it.
      if (exam && !hasLegacyGrant) {
        // A subscription covering this exam's own level unlocks it whatever
        // its access type and whatever level the student has selected.
        const examSubscription = await Subscription.getActiveSubscriptionForExam(req.user._id, exam._id);
        const subscriptionUnlocked = !!findSubscriptionCoveringExam(levelSubscriptions, exam) ||
          !!(examSubscription && examSubscription.isValid());

        if (!subscriptionUnlocked) {
          if (exam.accessType === 'free') {
            if (!freeExamMatchesUserSubLevel(exam, user)) {
              return res.json({
                _id: exam._id,
                title: exam.title,
                description: exam.description,
                timeLimit: exam.timeLimit,
                isLocked: true,
                message: 'This free exam is not available for your sub-level'
              });
            }

            // One attempt per free exam for non-subscribers — the same rule
            // validateExamAccess enforces at /start. Reported here too so a
            // lapsed subscriber sees the lock instead of a loaded exam that
            // 403s the moment they try to begin it.
            const spentFreeAttempt = await Result.exists({
              student: req.user._id,
              exam: exam._id,
              isCompleted: true
            });

            if (spentFreeAttempt) {
              return res.json({
                _id: exam._id,
                title: exam.title,
                description: exam.description,
                timeLimit: exam.timeLimit,
                isLocked: true,
                message: 'This exam requires an active subscription to retake. Subscribe to unlock unlimited retakes.'
              });
            }
          } else {
            return res.json({
              _id: exam._id,
              title: exam.title,
              description: exam.description,
              timeLimit: exam.timeLimit,
              isLocked: true,
              message: 'This exam requires an active subscription'
            });
          }
        }
      }
    }

    if (!exam) {
      return res.status(404).json({ message: 'Exam not found or not assigned to you' });
    }

    // Log section data to check if passage is present
    console.log('Exam sections data:', exam.sections?.map(s => ({
      name: s.name,
      hasPassage: !!s.passage,
      passageLength: s.passage?.length || 0,
      hasInstructions: !!s.instructions,
      hasWordBank: s.wordBank?.length > 0
    })));

    // Also check if questions have passage field
    console.log('Questions with passage:', exam.sections?.flatMap(s => s.questions || []).filter(q => q.passage).map(q => ({
      id: q._id,
      section: q.section,
      hasPassage: !!q.passage,
      passageLength: q.passage?.length || 0
    })));

    const examObj = exam.toObject();

    // Calculate total questions from all sections
    const totalQuestions = exam.sections?.reduce((sum, section) => {
      return sum + (section.questions?.length || 0);
    }, 0) || 0;
    examObj.questions = totalQuestions;

    // Get results for this student
    const results = await Result.find({
      student: req.user._id
    }).select('exam isCompleted');

    // Map results to exam IDs
    const completedExams = results
      .filter(result => result.isCompleted)
      .map(result => result.exam.toString());

    const inProgressExams = results
      .filter(result => !result.isCompleted)
      .map(result => result.exam.toString());

    // Check if student has an approved request for this exam (overrides isLocked)
    const approvedRequest = await ExamRequest.findOne({
      student: req.user._id,
      exam: exam._id,
      status: 'approved'
    });
    if (exam.isLocked && approvedRequest) {
      examObj.isLocked = false;
    }

    // Add completion status
    if (completedExams.includes(exam._id.toString())) {
      examObj.status = 'completed';
    } else if (inProgressExams.includes(exam._id.toString())) {
      examObj.status = 'in-progress';
    } else {
      examObj.status = 'not-started';
    }

    // Add availability status
    const now = new Date();
    if (examObj.isLocked) {
      examObj.availability = 'locked';
    } else if (exam.startTime && exam.endTime) {
      if (now < exam.startTime) {
        examObj.availability = 'upcoming';
      } else if (now >= exam.startTime && now <= exam.endTime) {
        examObj.availability = 'available';
      } else {
        examObj.availability = 'expired';
      }
    } else {
      examObj.availability = 'unknown';
    }

    res.json(examObj);
  } catch (error) {
    console.error('Get exam by ID error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get student's exam results
// @route   GET /api/student/results
// @access  Private/Student
const getStudentResults = async (req, res) => {
  try {
    const results = await Result.find({
      student: req.user._id,
      isCompleted: true
    })
      .sort({ endTime: -1, createdAt: -1 }) // Most recent attempt first
      .populate('exam', 'title description timeLimit passingScore sections')
      .select('-answers');

    // Add additional exam details to each result
    const enrichedResults = results.map(result => {
      const resultObj = result.toObject();

      // Skip results with missing exam data
      if (!result.exam) {
        return {
          ...resultObj,
          exam: null,
          totalQuestions: 0,
          passingScore: 50,
          percentage: 0,
          passed: false
        };
      }

      // Calculate total questions from exam sections
      const totalQuestions = result.exam?.sections?.reduce((sum, section) => {
        return sum + (section.questions?.length || 0);
      }, 0) || 0;

      // Calculate percentage
      const percentage = result.maxPossibleScore > 0
        ? Math.round((result.totalScore / result.maxPossibleScore) * 100)
        : 0;

      // Determine pass/fail
      const passed = result.exam.passingScore
        ? percentage >= result.exam.passingScore
        : percentage >= 50; // Default 50% if no passing score set

      return {
        ...resultObj,
        exam: {
          ...resultObj.exam,
          totalQuestions,
          passingScore: result.exam.passingScore || 50
        },
        percentage,
        passed
      };
    });

    res.json(enrichedResults);
  } catch (error) {
    console.error('Get student results error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Works out whether a student can start another attempt at an exam they have
// already completed, mirroring exactly what POST /exam/:id/start will accept:
// validateExamAccess's grant/level/subscription rules plus the admin lock.
// startExam itself imposes no extra retake limit — a completed result simply
// falls through to a new attempt — so access IS retake availability here.
//
// Deliberately NOT gated on exam.allowRetake: that schema flag defaults to
// false and no code path or admin screen ever sets it, so gating on it would
// hide the button on every exam in the database while the API happily allows
// the attempt. It's still reported for callers that want to show the flag.
const buildRetakeInfo = async (exam, userId) => {
  const info = {
    allowRetake: !!exam?.allowRetake,
    accessUnlocked: false,
    canRetake: false,
    requiresSubscription: false
  };

  if (!exam) return info;

  const user = await User.findById(userId).populate('level');
  if (!user) return info;

  // Fill in a missing level from the active subscription before gating on it,
  // same as the exam-bank/start paths do.
  const synced = await syncUserLevelFromSubscription(userId, user.level?._id, user.subLevel);
  if (synced) {
    user.level = synced.level;
    user.subLevel = synced.subLevel;
  }

  // An explicit grant (teacher assignment / approved request) unlocks the exam
  // regardless of level or subscription. A retake request only counts while its
  // access code is unused — once spent, the retake it paid for is over.
  const approvedRequests = await ExamRequest.find({
    student: userId,
    exam: exam._id,
    status: 'approved'
  }).select('isRetake accessCodeUsed').lean();

  const hasApprovedRetake = approvedRequests.some(r => r.isRetake && !r.accessCodeUsed);
  // Queried rather than populated onto the exam — the client has no business
  // receiving the whole assignedTo roster just to render one button.
  // Spent requests don't count: completeExam marks every request for the exam
  // used on submission, and validateExamAccess refuses them, so offering the
  // button off a spent one only produces a 403 on click.
  const hasLegacyGrant = approvedRequests.some(r => !r.accessCodeUsed) ||
    !!(await Exam.exists({ _id: exam._id, assignedTo: userId }));

  // Joining via a teacher's share link is a grant too — validateExamAccess lets
  // it through, so the button must not tell these students to buy a plan.
  const hasShareGrant = hasLegacyGrant ? false : !!(await SharedExam.exists({
    exam: exam._id,
    isActive: true,
    students: {
      $elemMatch: {
        isLocked: { $ne: true },
        hasCompleted: { $ne: true },
        $or: [
          { student: userId },
          { studentId: userId },
          ...(user.email ? [{ email: user.email.toLowerCase().trim() }] : [])
        ]
      }
    }
  }));

  const hasDirectGrant = hasLegacyGrant || hasShareGrant;

  // Keyed on the exam's level rather than the selected one: a subscription
  // bought for another level still unlocks its own exams, exactly as
  // validateExamAccess decides it.
  const levelSubscriptions = await getActiveLevelSubscriptions(userId);
  const coveringSubscription = findSubscriptionCoveringExam(levelSubscriptions, exam);

  // A student whose level moved on since taking this exam, and who holds no
  // subscription covering it, is refused by validateExamAccess.
  const levelMismatch = !coveringSubscription && !!user.level && !!exam.level &&
    exam.level.toString() !== user.level._id.toString();

  if (hasDirectGrant) {
    info.accessUnlocked = true;
  } else if (levelMismatch) {
    info.accessUnlocked = false;
  } else {
    const examSubscription = await Subscription.getActiveSubscriptionForExam(userId, exam._id);
    if (examSubscription && examSubscription.isValid()) {
      info.accessUnlocked = true;
    } else {
      // A free exam grants one attempt only — the student has already spent it
      // on the result they're looking at, so a retake needs a subscription too.
      info.accessUnlocked = !!coveringSubscription;
    }
  }

  const isLocked = hasDirectGrant ? false : !!exam.isLocked;

  // An approved, unused retake request is a direct grant of one more attempt,
  // so it stands on its own even past the admin lock.
  info.canRetake = hasApprovedRetake || (info.accessUnlocked && !isLocked);
  info.requiresSubscription = !info.canRetake && !isLocked;

  return info;
};

// @desc    Get detailed result for a specific exam
// @route   GET /api/student/results/:resultId
// @access  Private/Student
const getDetailedResult = async (req, res) => {
  // Declared outside the try so the catch can still read it — otherwise any
  // failure in here throws a second time on `startTime is not defined` and the
  // real error never reaches the log or the client.
  const startTime = Date.now();
  try {
    console.log(`🔍 Fetching detailed result for ID: ${req.params.resultId}, student: ${req.user._id}`);

    // Validate the resultId
    if (!req.params.resultId || !req.params.resultId.match(/^[0-9a-fA-F]{24}$/)) {
      console.log(`❌ Invalid result ID format: ${req.params.resultId}`);
      return res.status(400).json({ message: 'Invalid result ID format' });
    }

    // Set a timeout for the database query
    const queryTimeout = 25000; // 25 seconds timeout

    // First, check if the result exists at all
    const resultExists = await Result.findById(req.params.resultId);
    if (!resultExists) {
      console.log(`Result with ID ${req.params.resultId} does not exist in database`);

      // Let's also check if there are any results for this student
      const studentResults = await Result.find({ student: req.user._id });
      console.log(`Student ${req.user._id} has ${studentResults.length} total results`);

      return res.status(404).json({
        message: 'Result not found',
        debug: {
          resultId: req.params.resultId,
          studentId: req.user._id,
          totalStudentResults: studentResults.length
        }
      });
    }

    console.log(`Result exists. Student: ${resultExists.student}, Completed: ${resultExists.isCompleted}, Exam: ${resultExists.exam}`);

    // Check if it belongs to this student
    if (resultExists.student.toString() !== req.user._id.toString()) {
      console.log(`Result belongs to different student. Expected: ${req.user._id}, Found: ${resultExists.student}`);
      return res.status(403).json({ message: 'Not authorized to view this result' });
    }

    // Check if it's completed
    if (!resultExists.isCompleted) {
      console.log(`Result is not completed yet`);
      return res.status(404).json({ message: 'Result not completed yet' });
    }

    // Create a timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Database query timeout')), queryTimeout);
    });

    // Optimized query with lean() for better performance
    const queryPromise = Result.findOne({
      _id: req.params.resultId,
      student: req.user._id,
      isCompleted: true
    })
    .populate({
      path: 'answers.question',
      // SPREADSHEET_QUESTION_FIELDS is appended so the written-answer half of a
      // financial-spreadsheet question (prompt, model answer, marks) reaches the results view
      // alongside the grid — previously only the two grid fields were selected.
      select: `text type options correctAnswer points section matchingPairs leftItems rightItems subQuestions subQuestionConfig imageUrl wordBank passage subsectionTitle subsection instructions sectionTitle itemsToOrder dragDropData explanation answerKey gradingCriteria keyPoints acceptableAnswers marks correctMatches ${SPREADSHEET_QUESTION_FIELDS.join(' ')}`,
      options: { lean: true } // Use lean for better performance
    })
    .populate({
      path: 'exam',
      select: 'title description timeLimit sections allowRetake isLocked accessType level subLevel',
      options: { lean: true }
    })
    .lean(); // Use lean for the main query too

    // Race the query against the timeout
    const result = await Promise.race([queryPromise, timeoutPromise]);

    if (!result) {
      console.log(`Result not found after population for ID: ${req.params.resultId}, student: ${req.user._id}`);
      return res.status(404).json({ message: 'Result not found or not completed yet' });
    }

    // Check if all questions are properly populated
    const hasInvalidQuestions = result.answers.some(answer => !answer.question);
    if (hasInvalidQuestions) {
      console.log('Some questions could not be populated, they may have been deleted');

      // Filter out answers with missing questions
      result.answers = result.answers.filter(answer => answer.question);

      // Recalculate total score if needed
      if (result.answers.length > 0) {
        result.totalScore = result.answers.reduce((total, answer) => total + (answer.score || 0), 0);
      }
    }

    // Lazily generate the AI overall recommendation on first view, then cache
    // it on the Result document so later views are instant and don't re-call
    // the AI. Failures here must never block the result from loading — the
    // frontend has its own heuristic fallback if this stays null.
    // NOTE: check `.headline` rather than the whole object's truthiness —
    // Mongoose auto-populates empty-array defaults (focusAreas/topConcepts/tips)
    // for this nested schema path on ANY Result.save() (e.g. during grading),
    // long before this recommendation is ever generated, so the object is
    // never actually null/undefined in practice.
    if (!result.overallRecommendation?.headline && result.answers.length > 0) {
      const recommendation = await generateOverallRecommendation(result);
      if (recommendation) {
        result.overallRecommendation = recommendation;
        Result.findByIdAndUpdate(req.params.resultId, { overallRecommendation: recommendation }).catch(err =>
          console.error('Failed to persist overallRecommendation:', err.message)
        );
      }
    }

    // Tell the result page whether another attempt is available. Never let a
    // failure here block the result itself — the page just hides the button.
    try {
      result.retakeInfo = await buildRetakeInfo(result.exam, req.user._id);
    } catch (retakeError) {
      console.error('Failed to resolve retake availability:', retakeError.message);
      result.retakeInfo = { allowRetake: false, accessUnlocked: false, canRetake: false, requiresSubscription: false };
    }

    const endTime = Date.now();
    const queryDuration = endTime - startTime;

    console.log(`✅ Successfully retrieved result with ${result.answers.length} answers`);
    console.log(`⏱️ Query completed in ${queryDuration}ms`);
    res.json(result);
  } catch (error) {
    const endTime = Date.now();
    const queryDuration = endTime - startTime;

    console.error('❌ Get detailed result error:', error.message);
    console.error(`⏱️ Query failed after ${queryDuration}ms`);

    if (error.message === 'Database query timeout') {
      return res.status(408).json({
        message: 'Request timeout - the query took too long to complete. Please try again.',
        timeout: true,
        duration: queryDuration
      });
    }

    res.status(500).json({
      message: 'Server error while fetching result details',
      error: error.message,
      duration: queryDuration
    });
  }
};

// @desc    Get current exam session
// @route   GET /api/student/exams/:examId/session
// @access  Private/Student
const getCurrentExamSession = async (req, res) => {
  try {
    const result = await Result.findOne({
      student: req.user._id,
      exam: req.params.examId,
      isCompleted: false
    }).populate({
      path: 'answers.question',
      select: 'text type options points section'
    }).populate('exam', 'title description timeLimit');

    if (!result) {
      // Return null instead of 404 to allow frontend to start a new session
      return res.json(null);
    }

    // Calculate time remaining
    const startTime = new Date(result.startTime).getTime();
    const currentTime = Date.now();
    const timeLimit = result.exam.timeLimit * 60 * 1000; // Convert minutes to milliseconds
    const timeElapsed = currentTime - startTime;
    const timeRemaining = Math.max(0, timeLimit - timeElapsed);

    res.json({
      ...result.toObject(),
      timeRemaining
    });
  } catch (error) {
    console.error('Get current exam session error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get class leaderboard
// @route   GET /api/student/leaderboard
// @access  Private/Student
const getClassLeaderboard = async (req, res) => {
  try {
    // Get the current student's class
    const currentStudent = await User.findById(req.user._id).select('class organization');

    if (!currentStudent) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // If student doesn't have a class assigned, return an empty leaderboard
    if (!currentStudent.class) {
      return res.json({
        leaderboard: [],
        message: 'No class assigned to this student'
      });
    }

    // Find all students in the same class
    const classmates = await User.find({
      role: 'student',
      class: currentStudent.class,
      organization: currentStudent.organization
    }).select('_id firstName lastName');

    if (!classmates || classmates.length === 0) {
      return res.json({
        leaderboard: [],
        message: 'No other students found in your class'
      });
    }

    // Get all completed results for these students
    const classmateIds = classmates.map(student => student._id);

    // Get all completed results
    const results = await Result.find({
      student: { $in: classmateIds },
      isCompleted: true
    })
      .populate({
        path: 'student',
        select: 'firstName lastName email class organization',
        options: { virtuals: true }
      })
      .populate('exam', 'title maxPossibleScore')
      .select('totalScore maxPossibleScore startTime endTime exam');

    // Group results by student
    const studentResults = {};

    results.forEach(result => {
      const studentId = result.student._id.toString();

      if (!studentResults[studentId]) {
        studentResults[studentId] = {
          id: studentId,
          name: `${result.student.firstName} ${result.student.lastName}`,
          studentClass: result.student.class,
          organization: result.student.organization,
          totalScore: 0,
          totalPossible: 0,
          examCount: 0,
          isCurrentUser: studentId === req.user._id.toString()
        };
      }

      // Add this result's score to the student's total
      studentResults[studentId].totalScore += result.totalScore || 0;
      studentResults[studentId].totalPossible += result.maxPossibleScore || 0;
      studentResults[studentId].examCount += 1;
    });

    // Convert to array and calculate percentages
    const leaderboard = Object.values(studentResults).map(student => {
      const percentage = student.totalPossible > 0
        ? Math.round((student.totalScore / student.totalPossible) * 100)
        : 0;

      return {
        ...student,
        percentage,
        score: student.totalScore // For compatibility with the frontend
      };
    });

    // Sort by percentage (highest first)
    leaderboard.sort((a, b) => b.percentage - a.percentage);

    // Add rank property
    leaderboard.forEach((student, index) => {
      student.rank = index + 1;
    });

    res.json({
      leaderboard,
      classInfo: {
        name: currentStudent.class,
        organization: currentStudent.organization
      }
    });
  } catch (error) {
    console.error('Get class leaderboard error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Debug student results to troubleshoot issues
// @route   GET /api/student/debug-results
// @access  Private/Student
const debugStudentResults = async (req, res) => {
  try {
    const studentId = req.user._id;

    // Get all results for this student
    const allResults = await Result.find({ student: studentId })
      .populate('exam', 'title createdBy')
      .populate('student', 'firstName lastName email')
      .sort({ createdAt: -1 });

    // Get completed results
    const completedResults = allResults.filter(r => r.isCompleted);

    // Get pending results
    const pendingResults = allResults.filter(r => !r.isCompleted);

    const debugInfo = {
      student: {
        id: studentId,
        name: req.user.firstName + ' ' + req.user.lastName,
        email: req.user.email
      },
      results: {
        total: allResults.length,
        completed: completedResults.length,
        pending: pendingResults.length,
        completedList: completedResults.map(r => ({
          id: r._id,
          exam: r.exam?.title || 'Unknown',
          examId: r.exam?._id || 'Unknown',
          examCreatedBy: r.exam?.createdBy || 'Unknown',
          score: `${r.totalScore}/${r.maxPossibleScore}`,
          percentage: r.maxPossibleScore > 0 ? Math.round((r.totalScore / r.maxPossibleScore) * 100) : 0,
          completedAt: r.endTime,
          createdAt: r.createdAt,
          isCompleted: r.isCompleted,
          answersCount: r.answers?.length || 0
        })),
        pendingList: pendingResults.map(r => ({
          id: r._id,
          exam: r.exam?.title || 'Unknown',
          examId: r.exam?._id || 'Unknown',
          startedAt: r.startTime,
          createdAt: r.createdAt,
          isCompleted: r.isCompleted,
          answersCount: r.answers?.length || 0
        }))
      }
    };

    res.json(debugInfo);
  } catch (error) {
    console.error('Debug student results error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Check if a specific result exists and provide debug info
// @route   GET /api/student/check-result/:resultId
// @access  Private/Student
const checkSpecificResult = async (req, res) => {
  try {
    const { resultId } = req.params;
    const studentId = req.user._id;

    console.log(`Checking result ${resultId} for student ${studentId}`);

    // Check if result exists at all
    const result = await Result.findById(resultId);

    if (!result) {
      // Get all results in the database for debugging
      const allResults = await Result.find({}).select('_id student exam isCompleted').limit(10);

      return res.json({
        exists: false,
        message: 'Result not found in database',
        debug: {
          searchedId: resultId,
          studentId,
          sampleResults: allResults.map(r => ({
            id: r._id,
            student: r.student,
            exam: r.exam,
            completed: r.isCompleted
          }))
        }
      });
    }

    // Result exists, check ownership and completion
    const belongsToStudent = result.student.toString() === studentId.toString();
    const isCompleted = result.isCompleted;

    res.json({
      exists: true,
      belongsToStudent,
      isCompleted,
      canAccess: belongsToStudent && isCompleted,
      debug: {
        resultId: result._id,
        resultStudent: result.student,
        requestingStudent: studentId,
        examId: result.exam,
        completed: result.isCompleted,
        startTime: result.startTime,
        endTime: result.endTime,
        answersCount: result.answers?.length || 0
      }
    });

  } catch (error) {
    console.error('Check specific result error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get scheduled exams for student
// @route   GET /api/student/scheduled-exams
// @access  Private/Student
const getScheduledExams = async (req, res) => {
  try {
    const studentId = req.user._id;
    const now = new Date();

    // Find all shared exams where this student has joined and are scheduled for the future
    const sharedExams = await SharedExam.find({
      'students.student': studentId,
      'settings.scheduledStart': { $gt: now }
    })
      .populate('exam', 'title description')
      .select('shareToken settings.scheduledStart settings.scheduledEnd');

    // Format the response
    const scheduledExams = sharedExams.map(se => ({
      _id: se._id,
      shareToken: se.shareToken,
      examTitle: se.exam?.title || 'Exam',
      title: se.exam?.title || 'Exam',
      description: se.exam?.description,
      scheduledStart: se.settings.scheduledStart,
      scheduledEnd: se.settings.scheduledEnd
    }));

    res.json(scheduledExams);
  } catch (error) {
    console.error('Get scheduled exams error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get student progress statistics
// @route   GET /api/student/progress
// @access  Private/Student
const getStudentProgress = async (req, res) => {
  try {
    const studentId = req.user._id;

    // Get all exams assigned to this student
    const assignedExams = await Exam.find({
      assignedTo: studentId,
      status: 'active'
    }).select('_id');

    const totalExams = assignedExams.length;

    // Get completed results for this student
    const completedResults = await Result.find({
      student: studentId,
      isCompleted: true
    }).select('exam');

    const completedExams = completedResults.length;

    // Calculate progress percentage
    const progressPercentage = totalExams > 0
      ? Math.round((completedExams / totalExams) * 100)
      : 0;

    // Get in-progress exams
    const inProgressResults = await Result.find({
      student: studentId,
      isCompleted: false
    }).select('exam');

    const inProgressExams = inProgressResults.length;

    res.json({
      totalExams,
      completedExams,
      inProgressExams,
      progressPercentage
    });
  } catch (error) {
    console.error('Get student progress error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Request retake for an assigned exam
// @route   POST /api/student/exams/:examId/retake-request
// @access  Private/Student
const requestExamRetake = async (req, res) => {
  try {
    const examId = req.params.examId;

    // Check if exam exists and is assigned to the student
    const exam = await Exam.findOne({
      _id: examId,
      assignedTo: req.user._id
    }).populate('createdBy', 'fullName email');

    if (!exam) {
      return res.status(404).json({ message: 'Exam not found or not assigned to you' });
    }

    // Check if student has completed this exam
    const completedResult = await Result.findOne({
      student: req.user._id,
      exam: examId,
      isCompleted: true
    });

    if (!completedResult) {
      return res.status(400).json({ message: 'You must complete the exam before requesting a retake' });
    }

    // Check if there's already a pending retake request
    const existingRequest = await ExamRequest.findOne({
      exam: examId,
      student: req.user._id,
      status: 'pending',
      isRetake: true
    });

    if (existingRequest) {
      return res.status(400).json({ message: 'You already have a pending retake request for this exam' });
    }

    // Use the exam's retakePrice for retake fee
    const retakeFee = exam.retakePrice || 0;

    // Create the retake request
    const examRequest = await ExamRequest.create({
      exam: examId,
      examTitle: exam.title,
      teacher: exam.createdBy._id,
      student: req.user._id,
      userInfo: {
        name: `${req.user.firstName} ${req.user.lastName}`,
        email: req.user.email,
        phone: req.user.phone || ''
      },
      amount: retakeFee,
      isRetake: true,
      status: retakeFee === 0 ? 'approved' : 'pending'
    });

    // If retake is free, auto-approve and provide access
    if (retakeFee === 0) {
      console.log(`Auto-approving free retake request for exam ${examId}, student ${req.user._id}`);

      // Delete the previous completed result to allow retake
      const deletedResult = await Result.findOneAndDelete({
        student: req.user._id,
        exam: examId,
        isCompleted: true
      });
      if (deletedResult) {
        console.log(`✅ Free retake - Deleted previous result: ${deletedResult._id}`);
      } else {
        console.log(`⚠️ Free retake - No completed result found to delete`);
      }

      return res.status(201).json({
        message: 'Retake request approved automatically. This retake is free!',
        requestId: examRequest._id,
        amount: retakeFee,
        autoApproved: true
      });
    }

    // Send email notification to the teacher about the retake request
    emailService.sendTeacherRetakeRequestEmail(examRequest, exam, req.user).catch(err => {
      console.error('[Student] Failed to send teacher retake request email:', err);
    });

    res.status(201).json({
      message: `Retake request submitted successfully. Please pay ${retakeFee} RWF to complete your request.`,
      requestId: examRequest._id,
      amount: retakeFee
    });
  } catch (error) {
    console.error('Request exam retake error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get per-exam leaderboard — ranks all students who completed a specific exam
// @route   GET /api/student/leaderboard/exam/:examId
// @access  Private/Student
const getExamLeaderboard = async (req, res) => {
  try {
    const { examId } = req.params;

    // Verify the requesting student has completed this exam (strongest access proof)
    const [exam, studentResult] = await Promise.all([
      Exam.findById(examId).select('title'),
      Result.findOne({ exam: examId, student: req.user._id, isCompleted: true }).select('_id').lean()
    ]);

    if (!exam) {
      return res.status(404).json({ message: 'Exam not found' });
    }

    if (!studentResult) {
      return res.status(403).json({ message: 'Not authorized to view this exam leaderboard' });
    }

    // Get all completed results for this exam
    const results = await Result.find({ exam: examId, isCompleted: true })
      .populate('student', 'firstName lastName')
      .select('student totalScore maxPossibleScore endTime')
      .lean();

    if (!results.length) {
      return res.json({ leaderboard: [], examTitle: exam.title });
    }

    // Keep only the best result per student
    const bestByStudent = {};
    results.forEach(r => {
      if (!r.student) return;
      const sid = r.student._id.toString();
      const pct = r.maxPossibleScore > 0 ? (r.totalScore / r.maxPossibleScore) * 100 : 0;
      if (!bestByStudent[sid] || pct > bestByStudent[sid].percentage) {
        bestByStudent[sid] = {
          id: sid,
          name: `${r.student.firstName} ${r.student.lastName}`,
          totalScore: r.totalScore,
          maxPossibleScore: r.maxPossibleScore,
          percentage: Math.round(pct),
          completedAt: r.endTime,
          isCurrentUser: sid === req.user._id.toString()
        };
      }
    });

    // Sort by percentage desc, then by completedAt asc (faster finisher ranks higher on tie)
    const leaderboard = Object.values(bestByStudent).sort((a, b) => {
      if (b.percentage !== a.percentage) return b.percentage - a.percentage;
      return new Date(a.completedAt) - new Date(b.completedAt);
    });

    // Assign ranks
    leaderboard.forEach((entry, i) => { entry.rank = i + 1; });

    res.json({ leaderboard, examTitle: exam.title });
  } catch (error) {
    console.error('Get exam leaderboard error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get real notifications for the logged-in student
// @route   GET /api/student/notifications
// @access  Private/Student
const getStudentNotifications = async (req, res) => {
  try {
    const studentId = req.user._id;
    const now = new Date();
    const notifications = [];

    // 1. Recently completed results (last 14 days)
    const recentResults = await Result.find({
      student: studentId,
      isCompleted: true,
      endTime: { $gte: new Date(now - 14 * 24 * 60 * 60 * 1000) }
    })
      .populate('exam', 'title passingScore')
      .sort({ endTime: -1 })
      .limit(5)
      .lean();

    for (const result of recentResults) {
      const pct = result.maxPossibleScore > 0
        ? Math.round((result.totalScore / result.maxPossibleScore) * 100)
        : 0;
      const passed = pct >= (result.exam?.passingScore || 70);
      notifications.push({
        _id: `result-${result._id}`,
        type: 'result',
        title: 'Exam result available',
        message: `${result.exam?.title || 'Exam'} — you scored ${pct}% (${passed ? 'Passed' : 'Failed'})`,
        link: `/student/results/${result._id}`,
        read: false,
        createdAt: result.endTime
      });
    }

    // 2. Exam request status changes (approved/rejected in last 14 days)
    const recentRequests = await ExamRequest.find({
      student: studentId,
      status: { $in: ['approved', 'rejected'] },
      processedAt: { $gte: new Date(now - 14 * 24 * 60 * 60 * 1000) }
    })
      .populate('exam', 'title')
      .sort({ processedAt: -1 })
      .limit(5)
      .lean();

    for (const req_ of recentRequests) {
      const examTitle = req_.examTitle || req_.exam?.title || 'Exam';
      notifications.push({
        _id: `request-${req_._id}`,
        type: req_.status === 'approved' ? 'success' : 'warning',
        title: req_.status === 'approved' ? 'Exam request approved' : 'Exam request rejected',
        message: req_.status === 'approved'
          ? `Your request for "${examTitle}" was approved. You can now access it.`
          : `Your request for "${examTitle}" was rejected.${req_.teacherNotes ? ` Reason: ${req_.teacherNotes}` : ''}`,
        link: req_.status === 'approved' ? `/student/exams` : null,
        read: false,
        createdAt: req_.processedAt
      });
    }

    // 3. Upcoming scheduled exams in the next 48 hours
    const upcoming = await Exam.find({
      'students.user': studentId,
      scheduledFor: { $gte: now, $lte: new Date(now.getTime() + 48 * 60 * 60 * 1000) },
      status: 'active'
    })
      .select('title scheduledFor')
      .sort({ scheduledFor: 1 })
      .limit(3)
      .lean();

    for (const exam of upcoming) {
      const hoursAway = Math.round((new Date(exam.scheduledFor) - now) / (1000 * 60 * 60));
      notifications.push({
        _id: `upcoming-${exam._id}`,
        type: 'info',
        title: 'Upcoming exam',
        message: `"${exam.title}" starts in ${hoursAway < 1 ? 'less than an hour' : `${hoursAway} hour${hoursAway === 1 ? '' : 's'}`}`,
        link: `/student/exams`,
        read: false,
        createdAt: new Date()
      });
    }

    // Sort all by date descending
    notifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({
      notifications: notifications.slice(0, 10),
      unreadCount: notifications.length
    });
  } catch (error) {
    console.error('Error fetching student notifications:', error);
    res.status(500).json({ message: 'Failed to fetch notifications', notifications: [], unreadCount: 0 });
  }
};

module.exports = {
  getAvailableExams,
  getExamById,
  getStudentResults,
  getDetailedResult,
  getCurrentExamSession,
  getClassLeaderboard,
  getExamLeaderboard,
  debugStudentResults,
  checkSpecificResult,
  getScheduledExams,
  getInProgressExams,
  getStudentProgress,
  requestExamRetake,
  getStudentNotifications
};
