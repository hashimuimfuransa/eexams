const mongoose = require('mongoose');
const Exam = require('../models/Exam');

/**
 * Migration: Update questionCount field for all exam sections
 * This fixes the issue where question count shows zero in teacher dashboard
 */

async function updateSectionQuestionCounts() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/eexams';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // Find all exams
    const exams = await Exam.find({});
    console.log(`Found ${exams.length} exams to process`);

    let updatedCount = 0;

    for (const exam of exams) {
      let examUpdated = false;

      // Update questionCount for each section
      for (const section of exam.sections) {
        const actualQuestionCount = section.questions ? section.questions.length : 0;
        
        // Only update if questionCount is missing or incorrect
        if (section.questionCount === undefined || section.questionCount !== actualQuestionCount) {
          section.questionCount = actualQuestionCount;
          examUpdated = true;
          console.log(`  Section ${section.name}: Updated questionCount from ${section.questionCount} to ${actualQuestionCount}`);
        }
      }

      if (examUpdated) {
        await exam.save();
        updatedCount++;
        console.log(`✓ Updated exam: ${exam.title}`);
      }
    }

    console.log(`\nMigration complete! Updated ${updatedCount} out of ${exams.length} exams`);
    process.exit(0);
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
}

updateSectionQuestionCounts();
