require('dotenv').config();
const mongoose = require('mongoose');
const Exam = require('../models/Exam');

async function setAllExamsSubscription() {
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

    console.log('\n=== Before ===');
    console.log(`Total exams: ${totalExams}`);
    console.log(`Free: ${freeCount}`);
    console.log(`Subscription: ${subscriptionCount}`);
    console.log(`Unset: ${unsetCount}`);

    const result = await Exam.updateMany({}, { $set: { accessType: 'subscription' } });

    console.log('\n=== Update Result ===');
    console.log(`Matched: ${result.matchedCount}`);
    console.log(`Modified: ${result.modifiedCount}`);

    const afterSubscription = await Exam.countDocuments({ accessType: 'subscription' });
    console.log('\n=== After ===');
    console.log(`Subscription: ${afterSubscription} / ${totalExams}`);

    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
    process.exit(0);
  } catch (error) {
    console.error('Error setting exams to subscription:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

setAllExamsSubscription();
