const mongoose = require('mongoose');
const Exam = require('./models/Exam');
require('dotenv').config();

async function checkExamStatus() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Check the exam that was attempted to be added
    const examId = '6a0b0925c69b3bcd584859c4';
    
    const exam = await Exam.findById(examId);
    if (!exam) {
      console.log('Exam not found with ID:', examId);
    } else {
      console.log('Exam found:', exam.title);
      console.log('isPubliclyListed:', exam.isPubliclyListed);
      console.log('isLocked:', exam.isLocked);
      console.log('status:', exam.status);
      console.log('createdBy:', exam.createdBy);
    }

    // Also check the exam that is showing in marketplace
    const marketplaceExamId = '6a0aeb8aa3aa9358a333db2d';
    const marketplaceExam = await Exam.findById(marketplaceExamId);
    if (marketplaceExam) {
      console.log('\nMarketplace exam:', marketplaceExam.title);
      console.log('isPubliclyListed:', marketplaceExam.isPubliclyListed);
      console.log('isLocked:', marketplaceExam.isLocked);
      console.log('status:', marketplaceExam.status);
    }
    
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkExamStatus();
