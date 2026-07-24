// One-off admin utility: create the standard 4-hour / 1-day / 1-week / 1-month
// pricing ladder for secondary sub-levels that currently have zero
// SubscriptionPlan documents (S1, S2, S4 as of 2026-07-24 — S3, S5, S6
// already have plans). Clones the existing S6 plan set for each missing
// sub-level, swapping the sub-level name in the plan name/features and
// keeping the identical price/discount ladder every other S-level uses.
//
// Usage (from server/):
//   node scripts/createMissingSubLevelPlans.js                     # dry run
//   node scripts/createMissingSubLevelPlans.js --apply              # write to DB
//   node scripts/createMissingSubLevelPlans.js --apply --subLevels=S1,S2,S4
//
// Safe to re-run: any sub-level that already has at least one plan is skipped.

require('dotenv').config();
const mongoose = require('mongoose');
require('../models/Level');
const SubscriptionPlan = require('../models/SubscriptionPlan');

const TEMPLATE_SUBLEVEL = 'S6';
const DEFAULT_TARGETS = ['S1', 'S2', 'S4'];

const argSubLevels = process.argv.find((a) => a.startsWith('--subLevels='));
const targets = argSubLevels
  ? argSubLevels.split('=')[1].split(',').map((s) => s.trim()).filter(Boolean)
  : DEFAULT_TARGETS;

async function main() {
  const apply = process.argv.includes('--apply');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`Connected. Mode: ${apply ? 'APPLY (writes to DB)' : 'DRY RUN (no changes)'}`);
  console.log(`Target sub-levels: ${targets.join(', ')}\n`);

  const templatePlans = await SubscriptionPlan.find({
    planType: 'level',
    subLevel: TEMPLATE_SUBLEVEL
  }).sort({ durationDays: 1 });

  if (!templatePlans.length) {
    throw new Error(`No template plans found for subLevel "${TEMPLATE_SUBLEVEL}" — nothing to clone from.`);
  }

  const swap = (text, target) =>
    text.replace(new RegExp(`\\b${TEMPLATE_SUBLEVEL}\\b`, 'g'), target);

  const toCreate = [];
  for (const target of targets) {
    const existing = await SubscriptionPlan.countDocuments({ planType: 'level', subLevel: target });
    if (existing > 0) {
      console.log(`Skipping ${target} — already has ${existing} plan(s).`);
      continue;
    }

    for (const t of templatePlans) {
      toCreate.push({
        target,
        planType: t.planType,
        level: t.level,
        subLevel: target,
        name: swap(t.name, target),
        price: t.price,
        currency: t.currency,
        durationDays: t.durationDays,
        durationValue: t.durationValue,
        durationUnit: t.durationUnit,
        status: t.status,
        features: t.features.map((f) => swap(f, target)),
        discountPercentage: t.discountPercentage,
        createdBy: t.createdBy
      });
    }
  }

  console.log(`\n${toCreate.length} plan(s) to create:\n`);
  for (const c of toCreate) {
    console.log(
      `  [${c.target}] ${c.name}  ->  ${c.price.toLocaleString()} ${c.currency}  (${c.durationValue} ${c.durationUnit}${c.discountPercentage ? `, badge ${c.discountPercentage}% OFF` : ''})`
    );
  }

  if (!toCreate.length) {
    console.log('\nNothing to do.');
  } else if (apply) {
    console.log('\nCreating...');
    let created = 0;
    for (const c of toCreate) {
      const { target, ...doc } = c;
      const exists = await SubscriptionPlan.findOne({
        planType: doc.planType,
        level: doc.level,
        subLevel: doc.subLevel,
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
