require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function checkStudentAccounts() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
    });

    console.log('Connected to MongoDB');

    // Check if any students were updated with 14-day expiration
    const students = await User.find({
      role: 'student',
      subscriptionPlan: 'free',
      userType: 'individual',
      subscriptionStatus: 'active',
      subscriptionExpiresAt: { $gte: new Date('2026-06-17'), $lte: new Date('2026-06-19') }
    });

    console.log(`Found ${students.length} students with 14-day expiration (June 17-19, 2026)`);

    if (students.length > 0) {
      console.log('\nStudents affected:');
      students.forEach(student => {
        console.log(`- ${student.email} - Expires: ${student.subscriptionExpiresAt.toISOString().split('T')[0]}`);
      });

      // Revert students to 365 days
      console.log('\nReverting students to 365-day expiration...');
      for (const student of students) {
        const startDate = student.subscriptionStartDate || student.createdAt;
        const oldExpiresAt = new Date(startDate.getTime() + 365 * 24 * 60 * 60 * 1000);
        
        await User.findByIdAndUpdate(student._id, {
          subscriptionExpiresAt: oldExpiresAt,
          subscriptionEndDate: oldExpiresAt
        });
        console.log(`✅ Reverted: ${student.email} - New expiry: ${oldExpiresAt.toISOString().split('T')[0]}`);
      }
    } else {
      console.log('✅ No students were affected by the migration.');
    }

    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
    process.exit(0);
  } catch (error) {
    console.error('Error checking student accounts:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

checkStudentAccounts();
