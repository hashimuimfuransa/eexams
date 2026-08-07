// One-off utility: dump every subscription plan stored in the database.
// Reads the three plan collections (SubscriptionPlan for level/exam plans,
// OrganizationPlan and IndividualPlan for account-tier plans) and prints
// name, price, currency, duration, status and planType.
//
// Usage (from server/):
//   node list-all-plans.js

require('dotenv').config();
const mongoose = require('mongoose');
const SubscriptionPlan = require('./models/SubscriptionPlan');
const OrganizationPlan = require('./models/OrganizationPlan');
const IndividualPlan = require('./models/IndividualPlan');
const Level = require('./models/Level');
const Exam = require('./models/Exam');

const fmtDuration = (p) => {
  const unit = p.durationUnit || 'days';
  const value = p.durationValue ?? (unit === 'hours' ? Math.round(p.durationDays * 24) : p.durationDays);
  return `${value} ${unit}`;
};

const fmtPrice = (p) => `${p.price} ${p.currency}`;

async function main() {
  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000
  });
  console.log('Connected to MongoDB\n');

  // ---- SubscriptionPlan (level/exam based) ----
  const sPlans = await SubscriptionPlan.find().populate('level', 'name').populate('exam', 'title');
  console.log('========================================================');
  console.log(`SUBSCRIPTION PLANS (level / exam based) — ${sPlans.length}`);
  console.log('========================================================');
  sPlans.sort((a, b) => (a.planType || '').localeCompare(b.planType || '') || a.level?.name?.localeCompare(b.level?.name || ''));
  for (const p of sPlans) {
    const scope = p.planType === 'level'
      ? `Level: ${p.level?.name || '?'}${p.subLevel ? ` / ${p.subLevel}` : ''}`
      : `Exam: ${p.exam?.title || '?'}`;
    console.log(`- [${p.planType}] ${p.name}  |  ${fmtPrice(p)}  |  ${fmtDuration(p)}  |  status=${p.status}  |  ${scope}`);
  }

  // ---- OrganizationPlan (org account tiers) ----
  const oPlans = await OrganizationPlan.find();
  console.log('\n========================================================');
  console.log(`ORGANIZATION PLANS (account tiers) — ${oPlans.length}`);
  console.log('========================================================');
  oPlans.sort((a, b) => a.price - b.price);
  for (const p of oPlans) {
    console.log(`- [${p.tierKey}] ${p.name}  |  ${fmtPrice(p)}  |  ${fmtDuration(p)}  |  status=${p.status}  |  discount=${p.discountPercentage}%`);
  }

  // ---- IndividualPlan (teacher account tiers) ----
  const iPlans = await IndividualPlan.find();
  console.log('\n========================================================');
  console.log(`INDIVIDUAL PLANS (teacher account tiers) — ${iPlans.length}`);
  console.log('========================================================');
  iPlans.sort((a, b) => a.price - b.price);
  for (const p of iPlans) {
    console.log(`- [${p.tierKey}] ${p.name}  |  ${fmtPrice(p)}  |  ${fmtDuration(p)}  |  status=${p.status}  |  discount=${p.discountPercentage}%`);
  }

  await mongoose.disconnect();
  console.log('\nDatabase connection closed');
  process.exit(0);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
