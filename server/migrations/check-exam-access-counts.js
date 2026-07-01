require('dotenv').config();
const mongoose = require('mongoose');
const Exam = require('../models/Exam');

async function checkExamAccessCounts() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
    });

    console.log('Connected to MongoDB');

    const totalExams = await Exam.countDocuments({});
    const freeCount = await Exam.countDocuments({ accessType: 'free' });
    const subscriptionCount = await Exam.countDocuments({ accessType: 'subscription' });
    const unsetCount = await Exam.countDocuments({ accessType: { $exists: false } });
    const nullCount = await Exam.countDocuments({ accessType: null });

    console.log('\n=== Exam accessType counts (read-only, no changes made) ===');
    console.log(`Total exams: ${totalExams}`);
    console.log(`accessType = 'free': ${freeCount}`);
    console.log(`accessType = 'subscription': ${subscriptionCount}`);
    console.log(`accessType field missing entirely: ${unsetCount}`);
    console.log(`accessType = null: ${nullCount}`);

    if (freeCount > 0) {
      const sampleFree = await Exam.find({ accessType: 'free' }).select('title status createdAt').limit(10).lean();
      console.log(`\nSample of ${Math.min(10, freeCount)} currently-free exams:`);
      sampleFree.forEach(e => console.log(`  - ${e.title} (status: ${e.status})`));
    }

    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
    process.exit(0);
  } catch (error) {
    console.error('Error checking exam access counts:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

checkExamAccessCounts();
