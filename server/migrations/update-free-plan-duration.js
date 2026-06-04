require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function updateFreePlanDuration() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
    });

    console.log('Connected to MongoDB');

    // Find all individual free plan users (not organizations) - teachers only
    const freeUsers = await User.find({
      subscriptionPlan: 'free',
      userType: 'individual',
      subscriptionStatus: 'active',
      role: 'teacher'
    });

    console.log(`Found ${freeUsers.length} individual free plan users`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const user of freeUsers) {
      // Calculate 14 days from subscription start date, or from now if not available
      const startDate = user.subscriptionStartDate || user.createdAt;
      const newExpiresAt = new Date(startDate.getTime() + 14 * 24 * 60 * 60 * 1000);
      
      // Only update if the current expiration is more than 14 days from start
      const currentExpiresAt = user.subscriptionExpiresAt;
      const oldExpiresAt = new Date(startDate.getTime() + 365 * 24 * 60 * 60 * 1000);
      
      // Check if user has the old 365-day expiration
      if (currentExpiresAt && currentExpiresAt.getTime() === oldExpiresAt.getTime()) {
        await User.findByIdAndUpdate(user._id, {
          subscriptionExpiresAt: newExpiresAt,
          subscriptionEndDate: newExpiresAt
        });
        console.log(`✅ Updated: ${user.email} - Old expiry: ${currentExpiresAt.toISOString().split('T')[0]}, New expiry: ${newExpiresAt.toISOString().split('T')[0]}`);
        updatedCount++;
      } else if (!currentExpiresAt || new Date() > currentExpiresAt) {
        // If no expiry or already expired, set to 14 days from now
        const expiresFromNow = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
        await User.findByIdAndUpdate(user._id, {
          subscriptionExpiresAt: expiresFromNow,
          subscriptionEndDate: expiresFromNow,
          subscriptionStatus: 'active'
        });
        console.log(`✅ Updated (no expiry/expired): ${user.email} - New expiry: ${expiresFromNow.toISOString().split('T')[0]}`);
        updatedCount++;
      } else {
        console.log(`⏭️ Skipped: ${user.email} - Already has custom expiry: ${currentExpiresAt.toISOString().split('T')[0]}`);
        skippedCount++;
      }
    }

    console.log('\n=== Summary ===');
    console.log(`Total free users found: ${freeUsers.length}`);
    console.log(`Updated: ${updatedCount}`);
    console.log(`Skipped: ${skippedCount}`);

    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
    process.exit(0);
  } catch (error) {
    console.error('Error updating free plan duration:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

updateFreePlanDuration();
