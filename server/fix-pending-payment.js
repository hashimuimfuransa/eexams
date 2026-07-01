const mongoose = require('mongoose');
require('dotenv').config();

const PendingPayment = require('./models/PendingPayment');
require('./models/SubscriptionPlan');
require('./models/Subscription');
require('./models/User');
require('./models/Level');
const itecPayment = require('./services/itecPayment');
const { activatePendingPayment } = require('./controllers/subscriptionController');

async function main() {
  const arg = process.argv[2];
  const dryRun = process.argv.includes('--dry-run');

  if (!arg) {
    console.log('Usage: node fix-pending-payment.js <reference|paymentId> [--dry-run]');
    process.exit(1);
  }

  const referenceOrPaymentId = String(arg);

  if (!process.env.MONGODB_URI) {
    console.error('Missing MONGODB_URI in .env');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  // We try reference first (req_ref/req body reference).
  // If not found, try paymentId/transaction id (paymentId column).
  let pending = await PendingPayment.findOne({ reference: referenceOrPaymentId })
    .populate('plan')
    .populate('level');

  if (!pending) {
    pending = await PendingPayment.findOne({ paymentId: referenceOrPaymentId })
      .populate('plan')
      .populate('level');
  }

  if (!pending) {
    console.error('No PendingPayment found for reference/paymentId:', referenceOrPaymentId);
    console.error('Tried: { reference: arg } then { paymentId: arg }');
    process.exit(1);
  }

  console.log('PendingPayment:', {
    reference: pending.reference,
    status: pending.status,
    user: pending.user?.toString?.() || pending.user,
    plan: pending.plan?.toString?.() || pending.plan,
    level: pending.level?.toString?.() || pending.level,
    amount: pending.amount,
    currency: pending.currency,
    paymentMethod: pending.paymentMethod,
    subscription: pending.subscription?.toString?.() || pending.subscription
  });

  if (pending.status !== 'pending') {
    console.log('PendingPayment status is not pending. Nothing to do.');
    process.exit(0);
  }

  // Ask iTechPay to verify again.
  const verify = await itecPayment.verifyPayment(pending.reference, pending.paymentMethod);
  console.log('iTechPay verify result:', verify);

  if (!verify.success) {
    console.error('Payment not verified as successful; aborting activation.');
    process.exit(1);
  }

  if (dryRun) {
    console.log('[Dry run] Would activate subscription for user:', pending.user.toString());
    process.exit(0);
  }

  const subscription = await activatePendingPayment(pending._id, {
    amount: verify.amount,
    currency: verify.currency,
    transactionId: verify.transactionId,
    paymentMethod: pending.paymentMethod
  });

  console.log('✅ Activated subscription:', subscription._id.toString());
}

main().catch((e) => {
  console.error('Fix pending payment failed:', e);
  process.exit(1);
});
