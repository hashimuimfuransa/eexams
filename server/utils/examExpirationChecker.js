const Result = require('../models/Result');
const Exam = require('../models/Exam');
const { fastChunkedGrading } = require('./fastGrading');
const { validateExamSubmission, validateSubmissionTime } = require('./examSubmissionValidator');

/**
 * Check for expired exam sessions and auto-submit them
 * This function runs periodically to handle students who leave during exams
 */
const checkExpiredExams = async () => {
  try {
    console.log('🔍 Checking for expired exam sessions...');
    
    // Find all incomplete exam results
    const incompleteResults = await Result.find({
      isCompleted: false
    }).populate('exam').populate('student', 'firstName lastName email');

    if (incompleteResults.length === 0) {
      console.log('✅ No incomplete exam sessions found');
      return;
    }

    console.log(`📊 Found ${incompleteResults.length} incomplete exam sessions`);

    let autoSubmittedCount = 0;
    const currentTime = Date.now();

    for (const result of incompleteResults) {
      try {
        if (!result.exam) {
          console.warn(`⚠️ Result ${result._id} has no associated exam, skipping`);
          continue;
        }

        // Calculate time elapsed
        const startTime = new Date(result.startTime).getTime();
        const timeLimit = result.exam.timeLimit * 60 * 1000; // Convert minutes to milliseconds
        const timeElapsed = currentTime - startTime;
        const timeRemaining = timeLimit - timeElapsed;

        // Check if time has expired
        if (timeRemaining <= 0) {
          console.log(`⏰ Exam expired for student ${result.student?.firstName} ${result.student?.lastName} (${result.student?.email})`);
          console.log(`   Exam: ${result.exam.title}`);
          console.log(`   Time elapsed: ${Math.round(timeElapsed / 60000)} minutes (limit: ${result.exam.timeLimit} minutes)`);
          console.log(`   Overdue by: ${Math.round(Math.abs(timeRemaining) / 60000)} minutes`);

          // Auto-submit the exam
          const success = await autoSubmitExpiredExam(result, result.exam);
          
          if (success) {
            autoSubmittedCount++;
            console.log(`✅ Successfully auto-submitted exam for student ${result.student?.email}`);
          } else {
            console.error(`❌ Failed to auto-submit exam for student ${result.student?.email}`);
          }
        } else {
          // Log time remaining for debugging
          const minutesRemaining = Math.round(timeRemaining / 60000);
          if (minutesRemaining <= 5) {
            console.log(`⏳ Exam expiring soon for student ${result.student?.email}: ${minutesRemaining} minutes remaining`);
          }
        }
      } catch (error) {
        console.error(`❌ Error processing result ${result._id}:`, error.message);
      }
    }

    console.log(`🎉 Auto-submission check complete. Auto-submitted ${autoSubmittedCount} expired exams`);
  } catch (error) {
    console.error('❌ Error in checkExpiredExams:', error);
  }
};

/**
 * Auto-submit an expired exam
 * @param {Object} result - The result document
 * @param {Object} exam - The exam document
 * @returns {Promise<boolean>} - Success status
 */
const autoSubmitExpiredExam = async (result, exam) => {
  try {
    console.log(`🚀 Starting auto-submission for result ${result._id}`);

    // Populate answers with question data
    const populatedResult = await Result.findById(result._id).populate({
      path: 'answers.question',
      select: 'text type correctAnswer points section options matchingPairs leftItems rightItems itemsToOrder dragDropData wordBank subQuestions'
    });

    if (!populatedResult) {
      console.error('❌ Could not populate result for auto-submission');
      return false;
    }

    // Validate that the result has answers
    if (!populatedResult.answers || populatedResult.answers.length === 0) {
      console.warn(`⚠️ Result ${result._id} has no answers, marking as completed anyway`);
      // Still mark as completed even with no answers
      populatedResult.isCompleted = true;
      populatedResult.endTime = new Date();
      populatedResult.aiGradingStatus = 'completed';
      await populatedResult.save();
      return true;
    }

    console.log(`Found ${populatedResult.answers.length} answers for auto-submission`);

    // Validate submission (allow expired time since this is auto-submission)
    const submissionValidation = validateExamSubmission(populatedResult, exam);
    
    if (!submissionValidation.success) {
      console.warn('⚠️ Submission validation failed for auto-submission:', submissionValidation.errors);
      // Continue anyway for auto-submission - don't block due to validation errors
    }

    // Start AI grading process
    console.log(`🤖 Starting AI grading for auto-submitted exam...`);

    try {
      // Use fast chunked grading
      const gradingResult = await fastChunkedGrading(populatedResult, exam);

      // fastChunkedGrading mutates populatedResult.answers in place, so only
      // the aggregate totals need to be copied over here.
      populatedResult.totalScore = gradingResult.totalScore;
      populatedResult.maxPossibleScore = gradingResult.maxPossibleScore;
      populatedResult.isCompleted = true;
      populatedResult.endTime = new Date();
      populatedResult.aiGradingStatus = 'completed';

      await populatedResult.save();

      console.log(`✅ Auto-submission completed for result ${result._id}`);
      console.log(`   Score: ${populatedResult.totalScore}/${populatedResult.maxPossibleScore}`);
      
      return true;
    } catch (gradingError) {
      console.error('❌ AI grading failed during auto-submission:', gradingError.message);
      
      // Mark as completed even if grading fails
      populatedResult.isCompleted = true;
      populatedResult.endTime = new Date();
      populatedResult.aiGradingStatus = 'failed';
      await populatedResult.save();
      
      console.log(`⚠️ Marked result ${result._id} as completed despite grading failure`);
      return true;
    }
  } catch (error) {
    console.error('❌ Error in autoSubmitExpiredExam:', error);
    return false;
  }
};

module.exports = {
  checkExpiredExams,
  autoSubmitExpiredExam
};
