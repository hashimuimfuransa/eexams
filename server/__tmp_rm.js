require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const r = await User.deleteMany({ email: /^zz-uicheck@/ });
  console.log('test users removed:', r.deletedCount);
  await mongoose.disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
