require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const IndividualPlan = require('./models/IndividualPlan');
(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const email = 'zz-uicheck@example.test';
  await User.deleteOne({ email });
  // A plan covering BOTH products so all five stat cards render.
  const plan = await IndividualPlan.findOne({ tierKey: 'premium', scope: 'lesson_planner' }).lean();
  await User.create({
    email, password: 'UiCheck123!', firstName: 'Ui', lastName: 'Check',
    role: 'teacher', userType: 'individual',
    subscriptionPlan: 'premium', subscriptionPlanRef: plan?._id || null,
    subscriptionStatus: 'active',
    subscriptionExpiresAt: new Date(Date.now() + 7 * 864e5),
    subscriptionEndDate: new Date(Date.now() + 7 * 864e5)
  });
  console.log('user ready | plan:', plan?.name, plan?.scope);
  await mongoose.disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
