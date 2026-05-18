const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

async function updateSubscription() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Update the user's subscription plan to premium
    const userId = '6a05eebabf3d269983aec887';
    
    const user = await User.findById(userId);
    if (!user) {
      console.log('User not found');
      return;
    }

    console.log('Current subscription plan:', user.subscriptionPlan);
    console.log('User:', user.firstName, user.lastName);

    // Update to premium
    const updated = await User.findByIdAndUpdate(
      userId,
      {
        subscriptionPlan: 'premium',
        subscriptionStatus: 'active',
        subscriptionStartDate: new Date(),
        subscriptionEndDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
      },
      { new: true }
    );

    console.log('Updated subscription plan to:', updated.subscriptionPlan);
    console.log('Subscription status:', updated.subscriptionStatus);
    
    await mongoose.connection.close();
    console.log('Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

updateSubscription();
