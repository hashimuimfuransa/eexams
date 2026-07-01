const mongoose = require('mongoose');
require('dotenv').config();

const PendingPayment = require('./models/PendingPayment');
const SubscriptionPlan = require('./models/SubscriptionPlan');
const Subscription = require('./models/Subscription');
const User = require('./models/User');
require('./models/Level');
const itecPayment = require('./services/itecPayment');

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
  const pending = await PendingPayment.findOne({ reference: referenceOrPaymentId })
    .populate('plan')
    .populate('level');

  let pendingByPaymentId = null;
  if (!pending) {
    pendingByPaymentId = await PendingPayment.findOne({ paymentId: referenceOrPaymentId })
      .populate('plan')
      .populate('level');
  }

  const pendingFinal = pending || pendingByPaymentId;
  if (!pendingFinal) {
    console.error('No PendingPayment found for reference/paymentId:', referenceOrPaymentId);
    console.error('Tried: { reference: arg } then { paymentId: arg }');
    process.exit(1);
  }

  const pendingObj = pendingFinal;


  console.log('PendingPayment:', {
    reference: pendingObj.reference,
    status: pendingObj.status,
    user: pendingObj.user?.toString?.() || pendingObj.user,
    plan: pendingObj.plan?.toString?.() || pendingObj.plan,
    level: pendingObj.level?.toString?.() || pendingObj.level,
    amount: pendingObj.amount,
    currency: pendingObj.currency,
    paymentMethod: pendingObj.paymentMethod,
    subscription: pendingObj.subscription?.toString?.() || pendingObj.subscription
  });

  if (pendingObj.status !== 'pending') {
    console.log('PendingPayment status is not pending. Nothing to do.');
    process.exit(0);
  }

  // Ask iTechPay to verify again.
  const verify = await itecPayment.verifyPayment(pendingObj.reference, pendingObj.paymentMethod);


  console.log('iTechPay verify result:', verify);

  if (!verify.success) {
    console.error('Payment not verified as successful; aborting activation.');
    process.exit(1);
  }

  if (dryRun) {
    console.log('[Dry run] Would activate subscription for user:', pendingObj.user.toString());

    process.exit(0);
  }

  const plan = await SubscriptionPlan.findById(pendingObj.plan);

  if (!plan) {
    console.error('SubscriptionPlan not found for pending plan');
    process.exit(1);
  }
  await plan.populate('level');

  // If there is already an active subscription for same level, renew; else create.
  const existingSubscription = await Subscription.getActiveSubscriptionForLevel(pendingObj.user, plan.level._id);


  let subscription;
  const amountPaid = Number(verify.amount ?? pending.amount ?? plan.price ?? 0);

  if (existingSubscription) {
    const baseDate = existingSubscription.expiresAt > new Date() ? existingSubscription.expiresAt : new Date();
    const newExpiry = new Date(baseDate);
    newExpiry.setDate(newExpiry.getDate() + plan.durationDays);

    await existingSubscription.renew(newExpiry);
    existingSubscription.plan = plan._id;
    existingSubscription.subLevel = plan.subLevel || null;
    existingSubscription.paymentReference = verify.transactionId || pending.paymentId;
    existingSubscription.amountPaid = amountPaid;
    existingSubscription.currency = verify.currency || pending.currency || 'RWF';
    await existingSubscription.save();
    subscription = existingSubscription;
  } else {
    subscription = await Subscription.create({
      user: pendingObj.user,

      level: plan.level._id,
      subLevel: plan.subLevel || null,
      plan: plan._id,
      startsAt: new Date(),
      expiresAt: new Date(Date.now() + plan.durationDays * 24 * 60 * 60 * 1000),
      status: 'active',
      paymentMethod: pending.paymentMethod,
      paymentReference: verify.transactionId || pendingObj.paymentId,

      amountPaid,
      currency: verify.currency || pendingObj.currency || 'RWF'

    });
  }

  await User.findByIdAndUpdate(pendingObj.user, { level: plan.level._id });

  pendingObj.status = 'completed';
  pendingObj.subscription = subscription._id;
  await pendingObj.save();


  console.log('✅ Activated subscription:', subscription._id.toString());
}

main().catch((e) => {
  console.error('Fix pending payment failed:', e);
  process.exit(1);
});

