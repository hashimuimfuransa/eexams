/**
 * Backfill registration numbers for students created before the transcript
 * feature existed. Without a number a student cannot look themselves up on
 * /results, so every existing student needs one.
 *
 * Numbers are grouped by school (User.organization) so each school gets its
 * own prefix and its own sequence, e.g. GSK-2026-0001, GSK-2026-0002.
 *
 * Usage:  node server/migrations/assign-student-registration-numbers.js
 *         node server/migrations/assign-student-registration-numbers.js --dry-run
 */
require('dotenv').config();
const mongoose = require('mongoose');

async function assignStudentRegistrationNumbers() {
  const dryRun = process.argv.includes('--dry-run');

  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
    });
    console.log('Connected to MongoDB');

    const User = require('../models/User');
    const { assignRegistrationNumber, generateRegistrationNumber } = require('../utils/registrationNumber');

    const students = await User.find({
      role: 'student',
      registrationNumber: { $in: [null, ''] }
    }).sort({ organization: 1, createdAt: 1 });

    if (students.length === 0) {
      console.log('✅ Every student already has a registration number. Nothing to do.');
      return;
    }

    console.log(`Found ${students.length} student(s) without a registration number.`);

    if (dryRun) {
      // Preview only the first number per school — the rest follow in sequence.
      const bySchool = new Map();
      students.forEach(s => {
        const key = s.organization || '(no school)';
        bySchool.set(key, (bySchool.get(key) || 0) + 1);
      });
      for (const [school, count] of bySchool) {
        const sample = await generateRegistrationNumber(school === '(no school)' ? '' : school);
        console.log(`  ${school}: ${count} student(s), starting at ${sample}`);
      }
      console.log('\nDry run — no changes written. Re-run without --dry-run to apply.');
      return;
    }

    let assigned = 0;
    let failed = 0;

    for (const student of students) {
      try {
        const number = await assignRegistrationNumber(student, student.organization);
        assigned++;
        console.log(`  ✓ ${student.firstName} ${student.lastName} → ${number}`);
      } catch (error) {
        failed++;
        console.error(`  ✗ ${student.firstName} ${student.lastName} (${student._id}): ${error.message}`);
      }
    }

    console.log(`\n✅ Assigned ${assigned} registration number(s).`);
    if (failed > 0) console.log(`⚠️  ${failed} student(s) failed — re-run to retry them.`);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

assignStudentRegistrationNumbers();
