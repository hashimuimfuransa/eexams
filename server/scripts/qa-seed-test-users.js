// One-off seed script for a live E2E test of the financial-spreadsheet paste->grade workflow.
// Creates a throwaway teacher (Basic plan, AI-enabled) and student using @example.com
// (IANA-reserved, guaranteed non-deliverable) addresses so no real inbox is touched.
// Prints ids + a signed JWT for the teacher for direct API calls.
require('dotenv').config({ path: 'D:/testfyrwanda-main/server/.env' });
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const stamp = Date.now();
  const teacher = await User.create({
    firstName: 'QAFinTest',
    lastName: 'Teacher',
    email: `qa-fin-teacher-${stamp}@example.com`,
    password: 'TestPass123!',
    role: 'teacher',
    userType: 'individual',
    subscriptionPlan: 'basic',
    subscriptionStatus: 'active',
    subscriptionExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  });

  const student = await User.create({
    firstName: 'QAFinTest',
    lastName: 'Student',
    email: `qa-fin-student-${stamp}@example.com`,
    password: 'TestPass123!',
    role: 'student',
    userType: 'individual'
  });

  const teacherToken = jwt.sign({ id: teacher._id.toString() }, process.env.JWT_SECRET, { expiresIn: '2h' });
  const studentToken = jwt.sign({ id: student._id.toString() }, process.env.JWT_SECRET, { expiresIn: '2h' });

  console.log(JSON.stringify({
    teacherId: teacher._id.toString(),
    teacherEmail: teacher.email,
    teacherToken,
    studentId: student._id.toString(),
    studentEmail: student.email,
    studentToken
  }, null, 2));

  await mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });
