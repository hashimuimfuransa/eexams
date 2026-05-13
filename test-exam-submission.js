/**
 * Test script to verify exam submission functionality
 * This script tests the core exam submission flow
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

// Test data
const testStudent = {
  email: 'test.student@example.com',
  password: 'testpassword123'
};

const testAnswers = [
  {
    questionId: '6832c3ecc85ab1b56578d27a',
    answer: 'A physical connection of all devices',
    questionType: 'multiple-choice'
  },
  {
    questionId: '6832c3ecc85ab1b56578d280',
    answer: 'True',
    questionType: 'multiple-choice'
  }
];

async function testExamSubmission() {
  try {
    console.log('🧪 Testing Exam Submission Functionality...\n');

    // Step 1: Login as student
    console.log('1. Logging in as student...');
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      email: testStudent.email,
      password: testStudent.password
    });

    if (loginResponse.data.success) {
      console.log('✅ Student login successful');
      const token = loginResponse.data.token;
      const studentId = loginResponse.data.user.id;

      // Step 2: Get available exams
      console.log('\n2. Fetching available exams...');
      const examsResponse = await axios.get(`${BASE_URL}/student/exams`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (examsResponse.data.success && examsResponse.data.exams.length > 0) {
        console.log(`✅ Found ${examsResponse.data.exams.length} available exams`);
        const examId = examsResponse.data.exams[0]._id;

        // Step 3: Start exam
        console.log('\n3. Starting exam...');
        const startResponse = await axios.post(`${BASE_URL}/exam/${examId}/start`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (startResponse.data.success) {
          console.log('✅ Exam started successfully');

          // Step 4: Submit exam
          console.log('\n4. Submitting exam answers...');
          const submitResponse = await axios.post(`${BASE_URL}/exam/${examId}/submit`, {
            answers: testAnswers
          }, {
            headers: { Authorization: `Bearer ${token}` }
          });

          if (submitResponse.data.success) {
            console.log('✅ Exam submitted successfully!');
            console.log(`📊 Final Score: ${submitResponse.data.result.score}/${submitResponse.data.result.totalMarks}`);
            console.log(`📈 Percentage: ${submitResponse.data.result.percentage}%`);
            console.log(`⏱️  Time Taken: ${submitResponse.data.result.timeTaken} seconds`);
            
            // Display graded answers
            console.log('\n📝 Graded Answers:');
            submitResponse.data.result.gradedAnswers.forEach((answer, index) => {
              console.log(`   ${index + 1}. ${answer.isCorrect ? '✅' : '❌'} Score: ${answer.score}/${answer.maxScore}`);
              if (answer.feedback) {
                console.log(`      Feedback: ${answer.feedback.substring(0, 100)}...`);
              }
            });

            console.log('\n🎉 Exam submission test completed successfully!');
            return true;
          } else {
            console.log('❌ Exam submission failed:', submitResponse.data.message);
            return false;
          }
        } else {
          console.log('❌ Failed to start exam:', startResponse.data.message);
          return false;
        }
      } else {
        console.log('❌ No exams available for testing');
        return false;
      }
    } else {
      console.log('❌ Student login failed:', loginResponse.data.message);
      return false;
    }
  } catch (error) {
    console.log('❌ Test failed with error:', error.response?.data?.message || error.message);
    return false;
  }
}

// Run the test
if (require.main === module) {
  testExamSubmission().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { testExamSubmission };
