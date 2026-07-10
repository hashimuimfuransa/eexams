// One-off admin utility: for every existing level-based / exam-based
// SubscriptionPlan, fill in whichever of the four duration units
// (hours / days / weeks / months) that scope is still missing, deriving
// price from the existing plan's price-per-day so hour -> day -> week ->
// month reads as a natural "buy more, save more" ladder.
//
// Usage (from server/):
//   node scripts/generatePlanVariants.js              # dry run, prints what would be created
//   node scripts/generatePlanVariants.js --apply       # actually writes the new plans
//
// Safe to re-run: any unit that already exists for a scope is left alone,
// and --apply re-checks for a duplicate immediately before each insert.

require('dotenv').config();
const mongoose = require('mongoose');
require('../models/Level');
require('../models/Exam');
const SubscriptionPlan = require('../models/SubscriptionPlan');

const UNIT_TO_DAYS = { hours: 1 / 24, days: 1, weeks: 7, months: 30 };
const UNIT_LABEL = { hours: 'Hour', days: 'Day', weeks: 'Week', months: 'Month' };
// Per-day discount baked into the price for longer commitments.
const UNIT_FACTOR = { hours: 1, days: 1, weeks: 0.9, months: 0.75 };
// Badge shown on longer options ("10% OFF"); does not affect the charged price.
const UNIT_DISCOUNT_BADGE = { hours: 0, days: 0, weeks: 10, months: 25 };
const DEFAULT_DURATION_VALUE = { hours: 4, days: 1, weeks: 1, months: 1 };
const UNIT_ORDER = ['hours', 'days', 'weeks', 'months'];

const roundPrice = (value, currency) => {
  if (currency === 'RWF') return Math.max(1, Math.round(value / 10) * 10);
  return Math.round(value * 100) / 100;
};

// Strip a "— 1 Week" / "- 3 Months" style suffix so re-runs (and plans that
// already got a variant added by hand) derive a clean shared base name.
const cleanBaseName = (name) =>
  name.replace(/\s*[—-]\s*\d+(\.\d+)?\s*(Hour|Day|Week|Month)s?\s*$/i, '').trim();

const scopeKey = (plan) =>
  plan.planType === 'level'
    ? `level:${plan.level}:${plan.subLevel || ''}`
    : `exam:${plan.exam}`;

async function main() {
  const apply = process.argv.includes('--apply');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`Connected. Mode: ${apply ? 'APPLY (writes to DB)' : 'DRY RUN (no changes)'}\n`);

  const plans = await SubscriptionPlan.find({})
    .populate('level', 'name')
    .populate('exam', 'title');

  const groups = new Map();
  for (const p of plans) {
    const key = scopeKey(p);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }

  const toCreate = [];
  for (const group of groups.values()) {
    const existingUnits = new Set(group.map((p) => p.durationUnit || 'days'));
    // Use whichever existing plan is finest-grained as the pricing anchor.
    const base = [...group].sort((a, b) => a.durationDays - b.durationDays)[0];
    const baseUnit = base.durationUnit || 'days';
    const rawDailyRate = base.price / base.durationDays / (UNIT_FACTOR[baseUnit] || 1);
    const baseName = cleanBaseName(base.name);
    const scopeLabel =
      base.planType === 'level'
        ? `${base.level?.name || 'level'}${base.subLevel ? ' — ' + base.subLevel : ''}`
        : base.exam?.title || 'exam';

    for (const unit of UNIT_ORDER) {
      if (existingUnits.has(unit)) continue;

      const durationValue = DEFAULT_DURATION_VALUE[unit];
      const days = durationValue * UNIT_TO_DAYS[unit];
      const price = roundPrice(rawDailyRate * days * UNIT_FACTOR[unit], base.currency);
      const name = `${baseName} — ${durationValue} ${UNIT_LABEL[unit]}${durationValue === 1 ? '' : 's'}`;

      toCreate.push({
        scopeLabel,
        planType: base.planType,
        level: base.planType === 'level' ? base.level?._id : null,
        subLevel: base.planType === 'level' ? base.subLevel || null : null,
        exam: base.planType === 'exam' ? base.exam?._id : null,
        name,
        price,
        currency: base.currency,
        durationDays: days,
        durationValue,
        durationUnit: unit,
        status: 'active',
        features: base.features,
        discountPercentage: UNIT_DISCOUNT_BADGE[unit],
        createdBy: base.createdBy
      });
    }
  }

  console.log(`${groups.size} plan scope(s) found across ${plans.length} existing plan(s).`);
  console.log(`${toCreate.length} missing pricing option(s):\n`);

  for (const c of toCreate) {
    console.log(
      `  [${c.scopeLabel}] ${c.name}  ->  ${c.price.toLocaleString()} ${c.currency}  (${c.durationValue} ${c.durationUnit}${c.discountPercentage ? `, badge ${c.discountPercentage}% OFF` : ''})`
    );
  }

  if (!toCreate.length) {
    console.log('\nNothing to do — every scope already has hour/day/week/month options.');
  } else if (apply) {
    console.log('\nCreating...');
    let created = 0;
    for (const c of toCreate) {
      const { scopeLabel, ...doc } = c;
      const exists = await SubscriptionPlan.findOne({
        planType: doc.planType,
        level: doc.level,
        subLevel: doc.subLevel,
        exam: doc.exam,
        durationUnit: doc.durationUnit
      });
      if (exists) {
        console.log(`  Skipped (already exists): ${doc.name}`);
        continue;
      }
      await SubscriptionPlan.create(doc);
      created += 1;
      console.log(`  Created: ${doc.name}`);
    }
    console.log(`\nDone — ${created} plan(s) created.`);
  } else {
    console.log('\nDry run only — no changes written. Re-run with --apply to create these plans.');
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
