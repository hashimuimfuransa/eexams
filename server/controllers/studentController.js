const Exam = require('../models/Exam');
const Result = require('../models/Result');
const User = require('../models/User');
const SharedExam = require('../models/SharedExam');

// @desc    Get available exams for student
// @route   GET /api/student/exams
// @access  Private/Student
const getAvailableExams = async (req, res) => {
  try {
    // Get all exams assigned to this student with populated sections and questions
    const exams = await Exam.find({
      assignedTo: req.user._id
    })
      .populate('createdBy', 'firstName lastName')
      .populate('sections.questions')
      .select('title description timeLimit isLocked scheduledFor startTime endTime createdAt allowSelectiveAnswering allowRetake sectionBRequiredQuestions sectionCRequiredQuestions sections');

    // Log selective answering status for debugging
    if (exams.length > 0) {
      console.log(`First exam selective answering status: ${exams[0].allowSelectiveAnswering}`);
    }

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

    // Current time for availability check
    const now = new Date();

    // Fetch exams again to get the updated data after enabling selective answering
    const updatedExams = await Exam.find({
      assignedTo: req.user._id
    })
      .populate('createdBy', 'firstName lastName')
      .populate('sections.questions')
      .select('title description timeLimit isLocked scheduledFor startTime endTime createdAt allowSelectiveAnswering allowRetake sectionBRequiredQuestions sectionCRequiredQuestions sections');

    // Add status to each exam
    const examsWithStatus = updatedExams.map(exam => {
      const examObj = exam.toObject();

      // Calculate total questions from all sections
      const totalQuestions = exam.sections?.reduce((sum, section) => {
        return sum + (section.questions?.length || 0);
      }, 0) || 0;
      examObj.questions = totalQuestions;

      // Debug logging
      console.log(`Exam ${exam._id} (${exam.title}):`);
      console.log(`  - Sections count: ${exam.sections?.length || 0}`);
      console.log(`  - Total questions calculated: ${totalQuestions}`);
      if (exam.sections && exam.sections.length > 0) {
        exam.sections.forEach((section, idx) => {
          console.log(`  - Section ${idx}: ${section.name}, questions: ${section.questions?.length || 0}`);
        });
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
      if (exam.isLocked) {
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

    // Log the first exam's fields for debugging
    if (examsWithStatus.length > 0) {
      console.log('First exam fields:', Object.keys(examsWithStatus[0]));
      console.log('First exam selective answering:', examsWithStatus[0].allowSelectiveAnswering);
      console.log('First exam questions count:', examsWithStatus[0].questions);
    }

    res.json(examsWithStatus);
  } catch (error) {
    console.error('Get available exams error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get specific exam by ID for student
// @route   GET /api/student/exams/:examId
// @access  Private/Student
const getExamById = async (req, res) => {
  try {
    const exam = await Exam.findOne({
      _id: req.params.examId,
      assignedTo: req.user._id
    })
      .populate('createdBy', 'firstName lastName')
      .populate('sections.questions')
      .select('title description timeLimit isLocked scheduledFor startTime endTime createdAt allowSelectiveAnswering allowRetake sectionBRequiredQuestions sectionCRequiredQuestions sections');

    if (!exam) {
      return res.status(404).json({ message: 'Exam not found or not assigned to you' });
    }

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
    if (exam.isLocked) {
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
      .populate('exam', 'title description timeLimit passingScore sections')
      .select('-answers');

    // Add additional exam details to each result
    const enrichedResults = results.map(result => {
      const resultObj = result.toObject();
      
      // Calculate total questions from exam sections
      const totalQuestions = result.exam.sections?.reduce((sum, section) => {
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

// @desc    Get detailed result for a specific exam
// @route   GET /api/student/results/:resultId
// @access  Private/Student
const getDetailedResult = async (req, res) => {
  try {
    console.log(`🔍 Fetching detailed result for ID: ${req.params.resultId}, student: ${req.user._id}`);
    const startTime = Date.now();

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
      select: 'text type options correctAnswer points section',
      options: { lean: true } // Use lean for better performance
    })
    .populate({
      path: 'exam',
      select: 'title description timeLimit',
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

module.exports = {
  getAvailableExams,
  getExamById,
  getStudentResults,
  getDetailedResult,
  getCurrentExamSession,
  getClassLeaderboard,
  debugStudentResults,
  checkSpecificResult,
  getScheduledExams
};
