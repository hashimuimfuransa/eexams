require('dotenv').config();
const mongoose = require('mongoose');
const Result = require('./models/Result');
const Exam = require('./models/Exam');
const User = require('./models/User');
const Subscription = require('./models/Subscription');
const ExamRequest = require('./models/ExamRequest');
require('./models/Level');

const RESULT_ID = process.argv[2] || '6a75acb520d1a9aa73a8742b';

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const result = await Result.findById(RESULT_ID).lean();
  if (!result) {
    console.log('Result not found:', RESULT_ID);
    const recent = await Result.find({ isCompleted: true }).sort({ endTime: -1 }).limit(5).select('_id exam student endTime').lean();
    console.log('Recent completed results:', recent);
    return mongoose.disconnect();
  }

  const exam = await Exam.findById(result.exam)
    .select('title allowRetake isLocked accessType level subLevel assignedTo status').lean();
  const user = await User.findById(result.student).populate('level').lean();

  console.log('RESULT   ', result._id.toString(), 'completed:', result.isCompleted);
  console.log('EXAM     ', exam && {
    _id: exam._id.toString(),
    title: exam.title,
    allowRetake: exam.allowRetake,
    isLocked: exam.isLocked,
    accessType: exam.accessType,
    level: exam.level?.toString(),
    subLevel: exam.subLevel,
    status: exam.status,
    assignedCount: (exam.assignedTo || []).length,
    assignedToThisUser: (exam.assignedTo || []).some(id => id.toString() === result.student.toString())
  });
  console.log('USER     ', user && {
    _id: user._id.toString(),
    email: user.email,
    level: user.level?._id?.toString(),
    levelName: user.level?.name,
    subLevel: user.subLevel
  });

  const reqs = await ExamRequest.find({ student: result.student, exam: result.exam }).select('status isRetake accessCodeUsed').lean();
  console.log('REQUESTS ', reqs);

  const subs = await Subscription.find({ user: result.student }).select('planType level subLevel exam status expiresAt').lean();
  console.log('SUBS     ', subs.map(s => ({
    planType: s.planType, level: s.level?.toString(), subLevel: s.subLevel,
    exam: s.exam?.toString(), status: s.status, expiresAt: s.expiresAt
  })));

  await mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });
