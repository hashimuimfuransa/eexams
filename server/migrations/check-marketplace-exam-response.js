require('dotenv').config();
const mongoose = require('mongoose');
const Exam = require('../models/Exam');

async function check() {
  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
  });

  console.log('Connected to MongoDB');

  // Simulate exactly what getMarketplaceExams returns
  const exams = await Exam.find({ isPubliclyListed: true, isLocked: false })
    .select('title description timeLimit publicPrice retakePrice publicDescription targetAudience level subLevel createdAt createdBy sections.name sections.questions sections.questionCount isPubliclyListed isLocked status accessType')
    .limit(10)
    .lean();

  console.log(`\nPublicly listed exams found: ${exams.length}`);
  exams.forEach(e => {
    console.log(`- "${e.title}" | accessType: ${JSON.stringify(e.accessType)} | publicPrice: ${e.publicPrice} | isPubliclyListed: ${e.isPubliclyListed}`);
  });

  const totalPublic = await Exam.countDocuments({ isPubliclyListed: true });
  const publicAndFree = await Exam.countDocuments({ isPubliclyListed: true, accessType: 'free' });
  const publicAndSub = await Exam.countDocuments({ isPubliclyListed: true, accessType: 'subscription' });
  console.log(`\nTotal publicly listed: ${totalPublic}`);
  console.log(`Publicly listed + free: ${publicAndFree}`);
  console.log(`Publicly listed + subscription: ${publicAndSub}`);

  await mongoose.connection.close();
  process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });
