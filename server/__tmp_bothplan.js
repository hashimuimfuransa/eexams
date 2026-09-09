require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const IndividualPlan = require('./models/IndividualPlan');
(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  // Switch the check user onto a plan covering BOTH products -> 5 stat cards.
  const plan = await IndividualPlan.findOne({ scope: { $in: ['both', null] } }).lean()
            || await IndividualPlan.findOne({ scope: { $exists: false } }).lean();
  await User.updateOne({ email: 'zz-uicheck@example.test' },
    { subscriptionPlan: plan?.tierKey || 'basic', subscriptionPlanRef: plan?._id || null });
  console.log('switched to:', plan?.name, '| scope:', plan?.scope || '(unset => both)');
  await mongoose.disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
