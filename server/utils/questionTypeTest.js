/**
 * Comprehensive test utility for question types and grading
 * Tests all supported question types to ensure proper submission and grading
 */

const { gradeQuestionByType } = require('./enhancedGrading');
const { validateAnswerSubmission } = require('./examSubmissionValidator');

/**
 * Test data for different question types
 */
const testQuestions = {
  multipleChoice: {
    _id: 'test-mc-1',
    type: 'multiple-choice',
    text: 'What does WAN stand for?',
    section: 'A',
    points: 1,
    options: [
      { letter: 'A', text: 'Wide Area Network', isCorrect: true },
      { letter: 'B', text: 'Wireless Access Network', isCorrect: false },
      { letter: 'C', text: 'Web Application Network', isCorrect: false },
      { letter: 'D', text: 'World Area Network', isCorrect: false }
    ],
    correctAnswer: 'A. Wide Area Network'
  },

  trueFalse: {
    _id: 'test-tf-1',
    type: 'true-false',
    text: 'TCP is a connection-oriented protocol. True or False?',
    section: 'A',
    points: 1,
    options: [
      { letter: 'A', text: 'True', isCorrect: true },
      { letter: 'B', text: 'False', isCorrect: false }
    ],
    correctAnswer: 'True'
  },

  fillInBlank: {
    _id: 'test-fib-1',
    type: 'fill-in-blank',
    text: 'The _______ protocol is used for secure web communication.',
    section: 'A',
    points: 1,
    correctAnswer: 'HTTPS'
  },

  shortAnswer: {
    _id: 'test-sa-1',
    type: 'short-answer',
    text: 'Define what CPU stands for and briefly explain its function.',
    section: 'B',
    points: 3,
    correctAnswer: 'CPU stands for Central Processing Unit. It is the main component of a computer that executes instructions and performs calculations.'
  },

  essay: {
    _id: 'test-essay-1',
    type: 'essay',
    text: 'Explain the differences between LAN, WAN, and MAN networks. Discuss their characteristics, advantages, and typical use cases.',
    section: 'C',
    points: 10,
    correctAnswer: 'LAN (Local Area Network) covers a small geographic area like a building. WAN (Wide Area Network) covers large geographic areas. MAN (Metropolitan Area Network) covers a city-sized area. Each has different characteristics in terms of speed, cost, and coverage.'
  },

  matching: {
    _id: 'test-match-1',
    type: 'matching',
    text: 'Match the network protocols with their descriptions.',
    section: 'A',
    points: 4,
    matchingPairs: {
      leftColumn: ['HTTP', 'FTP', 'SMTP', 'DNS'],
      rightColumn: ['File Transfer', 'Web Pages', 'Email', 'Domain Names'],
      correctPairs: [
        { left: 0, right: 1 }, // HTTP -> Web Pages
        { left: 1, right: 0 }, // FTP -> File Transfer
        { left: 2, right: 2 }, // SMTP -> Email
        { left: 3, right: 3 }  // DNS -> Domain Names
      ]
    }
  }
};

/**
 * Test answers for each question type
 */
const testAnswers = {
  multipleChoice: {
    correct: { selectedOption: 'A. Wide Area Network', selectedOptionLetter: 'A' },
    semanticallyCorrect: { selectedOption: 'WAN', selectedOptionLetter: 'A' },
    incorrect: { selectedOption: 'B. Wireless Access Network', selectedOptionLetter: 'B' }
  },

  trueFalse: {
    correct: { selectedOption: 'True' },
    incorrect: { selectedOption: 'False' }
  },

  fillInBlank: {
    correct: { textAnswer: 'HTTPS' },
    semanticallyCorrect: { textAnswer: 'HTTPS (Hypertext Transfer Protocol Secure)' },
    partiallyCorrect: { textAnswer: 'SSL' },
    incorrect: { textAnswer: 'HTTP' }
  },

  shortAnswer: {
    correct: { textAnswer: 'CPU stands for Central Processing Unit. It executes instructions and performs calculations.' },
    partiallyCorrect: { textAnswer: 'Central Processing Unit - processes data' },
    incorrect: { textAnswer: 'Computer Processing Unit' }
  },

  essay: {
    correct: { textAnswer: 'LAN (Local Area Network) covers small areas like buildings with high speed and low cost. WAN (Wide Area Network) covers large geographic areas with lower speed but wide coverage. MAN (Metropolitan Area Network) covers city-sized areas, bridging LAN and WAN characteristics.' },
    partiallyCorrect: { textAnswer: 'LAN is local network, WAN is wide network, MAN is metropolitan network.' },
    incorrect: { textAnswer: 'They are all types of networks.' }
  },

  matching: {
    correct: { matchingAnswers: [{ left: 0, right: 1 }, { left: 1, right: 0 }, { left: 2, right: 2 }, { left: 3, right: 3 }] },
    partiallyCorrect: { matchingAnswers: [{ left: 0, right: 1 }, { left: 1, right: 0 }] },
    incorrect: { matchingAnswers: [{ left: 0, right: 0 }, { left: 1, right: 1 }] }
  }
};

/**
 * Run comprehensive tests for all question types
 */
const runQuestionTypeTests = async () => {
  console.log('🧪 Starting comprehensive question type tests...\n');
  
  const results = {
    passed: 0,
    failed: 0,
    details: []
  };

  // Test each question type
  for (const [questionType, question] of Object.entries(testQuestions)) {
    console.log(`\n📝 Testing ${questionType} questions...`);
    
    const answers = testAnswers[questionType];
    
    for (const [answerType, answer] of Object.entries(answers)) {
      try {
        console.log(`  Testing ${answerType} answer...`);
        
        // Test validation
        const validation = validateAnswerSubmission(
          { questionId: question._id, ...answer, questionType: question.type },
          question
        );
        
        if (!validation.success) {
          console.log(`    ❌ Validation failed: ${validation.errors.join(', ')}`);
          results.failed++;
          results.details.push({
            questionType,
            answerType,
            test: 'validation',
            status: 'failed',
            error: validation.errors.join(', ')
          });
          continue;
        }
        
        // Test grading
        const grading = await gradeQuestionByType(question, answer, question.correctAnswer);
        
        console.log(`    📊 Score: ${grading.score}/${question.points}`);
        console.log(`    💬 Feedback: ${grading.feedback}`);
        
        // Validate grading results
        const expectedScore = getExpectedScore(questionType, answerType, question.points);
        const scoreInRange = Math.abs(grading.score - expectedScore) <= 1; // Allow 1 point tolerance
        
        if (scoreInRange) {
          console.log(`    ✅ Grading passed (expected ~${expectedScore}, got ${grading.score})`);
          results.passed++;
          results.details.push({
            questionType,
            answerType,
            test: 'grading',
            status: 'passed',
            score: grading.score,
            expectedScore,
            feedback: grading.feedback
          });
        } else {
          console.log(`    ❌ Grading failed (expected ~${expectedScore}, got ${grading.score})`);
          results.failed++;
          results.details.push({
            questionType,
            answerType,
            test: 'grading',
            status: 'failed',
            score: grading.score,
            expectedScore,
            feedback: grading.feedback
          });
        }
        
      } catch (error) {
        console.log(`    ❌ Error: ${error.message}`);
        results.failed++;
        results.details.push({
          questionType,
          answerType,
          test: 'error',
          status: 'failed',
          error: error.message
        });
      }
    }
  }

  // Print summary
  console.log('\n📊 Test Results Summary:');
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`📈 Success Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);
  
  return results;
};

/**
 * Get expected score based on answer type
 */
const getExpectedScore = (questionType, answerType, maxPoints) => {
  switch (answerType) {
    case 'correct':
    case 'semanticallyCorrect':
      return maxPoints;
    case 'partiallyCorrect':
      return Math.ceil(maxPoints * 0.5); // 50% for partial credit
    case 'incorrect':
      return 0;
    default:
      return 0;
  }
};

module.exports = {
  runQuestionTypeTests,
  testQuestions,
  testAnswers
};
