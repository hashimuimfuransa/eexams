const mongoose = require('mongoose');
require('dotenv').config();

const PendingPayment = require('./models/PendingPayment');
require('./models/SubscriptionPlan');
require('./models/Subscription');
require('./models/User');
require('./models/Level');
const itecPayment = require('./services/itecPayment');
const { activatePendingPayment } = require('./controllers/subscriptionController');

// Sweeps PendingPayment records stuck in 'pending' (the iTechPay webhook never
// reached the server) and activates any that iTechPay confirms actually
// succeeded. Safe to re-run: activatePendingPayment is idempotent per reference.
async function main() {
  const dryRun = process.argv.includes('--dry-run');

  if (!process.env.MONGODB_URI) {
    console.error('Missing MONGODB_URI in .env');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const stuck = await PendingPayment.find({ status: 'pending' }).populate('user', 'email').sort({ createdAt: 1 });
  console.log(`Found ${stuck.length} pending payment(s) to check.\n`);

  let activated = 0;
  let stillPending = 0;
  let failed = 0;
  let errored = 0;

  for (const pending of stuck) {
    const label = `${pending.reference} (user=${pending.user?.email || pending.user}, amount=${pending.amount} ${pending.currency})`;
    try {
      const verify = await itecPayment.verifyPayment(pending.reference, pending.paymentMethod);

      if (verify.success) {
        console.log(`✅ ${label} — confirmed paid by iTechPay`);
        if (!dryRun) {
          await activatePendingPayment(pending._id, {
            amount: verify.amount,
            currency: verify.currency,
            transactionId: verify.transactionId,
            paymentMethod: pending.paymentMethod
          });
          console.log(`   → subscription activated`);
        } else {
          console.log(`   → [dry run] would activate subscription`);
        }
        activated++;
      } else {
        const cancelledStatuses = ['cancelled', 'canceled', 'rejected', 'failed', 'error', 'declined'];
        if (cancelledStatuses.includes(verify.status)) {
          console.log(`✗ ${label} — status=${verify.status}, marking failed`);
          if (!dryRun) {
            pending.status = 'failed';
            await pending.save();
          }
          failed++;
        } else {
          console.log(`… ${label} — still pending/unknown (status=${verify.status})`);
          stillPending++;
        }
      }
    } catch (err) {
      console.error(`⚠ ${label} — error checking: ${err.message}`);
      errored++;
    }
  }

  console.log(`\nDone. activated=${activated} stillPending=${stillPending} failed=${failed} errored=${errored}${dryRun ? ' (dry run — nothing was written)' : ''}`);
  process.exit(0);
}

main().catch((e) => {
  console.error('Reconcile failed:', e);
  process.exit(1);
});
