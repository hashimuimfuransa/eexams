require('dotenv').config();
const mongoose = require('mongoose');
const SharedExam = require('./models/SharedExam');
const Exam = require('./models/Exam');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const exam = await Exam.findOne({ title: 'FM2.3 FINANCIAL MANAGEMENT MOCK EXAM 1' }).select('_id').lean();
  const nobody = new mongoose.Types.ObjectId();

  const r = await SharedExam.updateMany(
    { exam: exam._id },
    { $set: {
        'students.$[entry].hasCompleted': true,
        'students.$[entry].isLocked': true,
        'students.$[entry].isActiveSession': false } },
    { arrayFilters: [{ $or: [
        { 'entry.student': nobody },
        { 'entry.studentId': nobody },
        { 'entry.email': 'nobody@example.com' } ] }] }
  );
  console.log('docs matched:', r.matchedCount, '| modified (expect 0):', r.modifiedCount);
  await mongoose.disconnect();
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
