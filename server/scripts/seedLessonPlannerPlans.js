/**
 * Seeds the Lesson Planner pricing grid as IndividualPlan catalog entries.
 *
 *   node scripts/seedLessonPlannerPlans.js            # create/update the five plans
 *   node scripts/seedLessonPlannerPlans.js --dry-run  # show what would change
 *
 * Idempotent: a plan is matched on tierKey + scope='lesson_planner', so
 * re-running updates the existing rows rather than piling up duplicates.
 * Prices, quotas and copy are all editable afterwards in Super Admin →
 * Individual Plans; this only lays down the starting grid.
 *
 * The Free entry is created like the rest so its monthly quotas can be tuned,
 * but it is never purchasable — the payment flow rejects a free/zero-price
 * plan (see initiateAccountPlanPayment).
 */
require('dotenv').config();
const mongoose = require('mongoose');
const IndividualPlan = require('../models/IndividualPlan');

const PLANS = [
  {
    tierKey: 'free',
    name: 'Free',
    description: 'Perfect for trying the toolkit with light weekly planning.',
    price: 0,
    durationValue: 1,
    durationUnit: 'months',
    lessonPlansPerMonth: 4,
    slidesPerMonth: 3,
    exercisesPerMonth: 3,
    schemesPerMonth: 1,
    prioritySupport: false,
    isPopular: false
  },
  {
    tierKey: 'basic',
    name: 'Basic',
    description: 'Best for individual teachers who create resources every week.',
    price: 998,
    durationValue: 1,
    durationUnit: 'months',
    lessonPlansPerMonth: 40,
    slidesPerMonth: 4,
    exercisesPerMonth: 15,
    schemesPerMonth: 3,
    prioritySupport: true,
    isPopular: true
  },
  {
    tierKey: 'pro',
    name: 'Pro',
    description: 'More room for busy teachers handling multiple classes and subjects.',
    price: 2000,
    durationValue: 1,
    durationUnit: 'months',
    lessonPlansPerMonth: 100,
    slidesPerMonth: 10,
    exercisesPerMonth: 25,
    schemesPerMonth: 10,
    prioritySupport: true,
    isPopular: false
  },
  {
    tierKey: 'premium',
    name: 'Premium',
    description: 'Built for heavier monthly output and fuller classroom workflows.',
    price: 3000,
    durationValue: 1,
    durationUnit: 'months',
    lessonPlansPerMonth: 200,
    slidesPerMonth: 20,
    exercisesPerMonth: 40,
    schemesPerMonth: 20,
    prioritySupport: true,
    isPopular: false
  },
  {
    tierKey: 'term_pro',
    name: 'Term Pro',
    description: 'Best for schools or teachers planning across a full term.',
    price: 4999,
    durationValue: 3,
    durationUnit: 'months',
    lessonPlansPerMonth: 300,
    slidesPerMonth: 30,
    exercisesPerMonth: 40,
    schemesPerMonth: 20,
    prioritySupport: true,
    isPopular: false
  }
];

// The model stores days; the grid is written in months. 30-day months keep
// "1 month" and "3 months" exactly 30/90 days, which is what the expiry maths
// downstream (plan.durationDays * 24h) assumes.
const DAYS_PER_MONTH = 30;

// Every one of these sells the Lesson Planner only — no exam product — so the
// exam-side limits stay null and inherit their tier default (which the
// resolver then forces to zero for this scope anyway).
const buildDoc = (plan) => ({
  tierKey: plan.tierKey,
  name: plan.name,
  scope: 'lesson_planner',
  description: plan.description,
  isPopular: plan.isPopular,
  price: plan.price,
  currency: 'RWF',
  durationDays: plan.durationValue * DAYS_PER_MONTH,
  durationValue: plan.durationValue * DAYS_PER_MONTH,
  durationUnit: 'days',
  status: 'active',
  lessonPlansPerMonth: plan.lessonPlansPerMonth,
  slidesPerMonth: plan.slidesPerMonth,
  exercisesPerMonth: plan.exercisesPerMonth,
  schemesPerMonth: plan.schemesPerMonth,
  aiFeatures: true,
  docxExport: true,
  prioritySupport: plan.prioritySupport,
  // Feature bullets mirror the price card, in the same order.
  features: [
    `${plan.lessonPlansPerMonth} lesson plans/mo`,
    `${plan.slidesPerMonth} slides/mo`,
    `${plan.exercisesPerMonth} exercises/mo`,
    `${plan.schemesPerMonth} schemes/mo`,
    'Single user',
    'PDF & DOCX export',
    plan.prioritySupport ? 'Priority email support' : 'No priority support'
  ]
});

(async () => {
  const dryRun = process.argv.includes('--dry-run');

  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not set — run this from the server directory with a .env present.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`Connected${dryRun ? ' (dry run — nothing will be written)' : ''}\n`);

  let created = 0;
  let updated = 0;

  for (const plan of PLANS) {
    const doc = buildDoc(plan);
    const existing = await IndividualPlan.findOne({ tierKey: plan.tierKey, scope: 'lesson_planner' });

    const label = `${doc.name.padEnd(10)} ${String(doc.price).padStart(5)} RWF / ${doc.durationDays}d  ` +
      `${doc.lessonPlansPerMonth} plans, ${doc.slidesPerMonth} slides, ` +
      `${doc.exercisesPerMonth} exercises, ${doc.schemesPerMonth} schemes`;

    if (existing) {
      console.log(`update  ${label}`);
      updated++;
      if (!dryRun) {
        Object.assign(existing, doc);
        await existing.save();
      }
    } else {
      console.log(`create  ${label}`);
      created++;
      if (!dryRun) await IndividualPlan.create(doc);
    }
  }

  console.log(`\n${dryRun ? 'Would create' : 'Created'} ${created}, ${dryRun ? 'would update' : 'updated'} ${updated}.`);
  await mongoose.disconnect();
})().catch(async (err) => {
  console.error('Seed failed:', err);
  try { await mongoose.disconnect(); } catch { /* already down */ }
  process.exit(1);
});
