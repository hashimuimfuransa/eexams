const Subscription = require('../models/Subscription');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const Level = require('../models/Level');
const User = require('../models/User');
const Result = require('../models/Result');
const PendingPayment = require('../models/PendingPayment');
const itecPayment = require('../services/itecPayment');

// @desc    Get all subscriptions
// @route   GET /api/subscriptions
// @access  Private/SuperAdmin
const getSubscriptions = async (req, res) => {
  try {
    const { user, level, plan, status, page = 1, limit = 20 } = req.query;

    let query = {};
    if (user) query.user = user;
    if (level) query.level = level;
    if (plan) query.plan = plan;
    if (status) query.status = status;

    const subscriptions = await Subscription.find(query)
      .populate('user', 'firstName lastName email')
      .populate('level', 'name')
      .populate('plan', 'name price durationDays')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Subscription.countDocuments(query);

    res.json({
      subscriptions,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Get subscriptions error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get subscription by ID
// @route   GET /api/subscriptions/:id
// @access  Private
const getSubscriptionById = async (req, res) => {
  try {
    const subscription = await Subscription.findById(req.params.id)
      .populate('user', 'firstName lastName email')
      .populate('level', 'name description')
      .populate('plan', 'name price durationDays features');

    if (!subscription) {
      return res.status(404).json({ message: 'Subscription not found' });
    }

    // Check if user has permission to view this subscription
    if (req.user.role !== 'superadmin' && req.user.role !== 'admin') {
      if (subscription.user._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not authorized to view this subscription' });
      }
    }

    res.json(subscription);
  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get current user's active subscription
// @route   GET /api/subscriptions/my/active
// @access  Private
const getMyActiveSubscription = async (req, res) => {
  try {
    const subscription = await Subscription.getActiveSubscription(req.user._id);

    res.json(subscription);
  } catch (error) {
    console.error('Get my active subscription error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Initiate subscription payment
// @route   POST /api/subscriptions/initiate
// @access  Private
const initiateSubscriptionPayment = async (req, res) => {
  try {
    const { planId, paymentMethod = 'mobile_money', phone } = req.body;
    console.log(`\n[Payment] ── Initiate ──────────────────────────────`);
    console.log(`[Payment] user=${req.user?._id} (${req.user?.email})`);
    console.log(`[Payment] planId=${planId}, method=${paymentMethod}, phone=${phone || 'n/a'}`);

    const validMethods = ['airtel_money', 'mobile_money', 'card'];
    if (!validMethods.includes(paymentMethod)) {
      return res.status(400).json({ message: 'Invalid payment method. Use airtel_money, mobile_money, or card' });
    }

    if (paymentMethod !== 'card' && !phone) {
      return res.status(400).json({ message: 'Phone number is required for mobile money payments' });
    }

    // Get the plan
    const plan = await SubscriptionPlan.findById(planId).populate('level');
    if (!plan) {
      return res.status(404).json({ message: 'Subscription plan not found' });
    }

    if (plan.status !== 'active') {
      return res.status(400).json({ message: 'This plan is not currently available' });
    }

    if (!plan.level) {
      return res.status(400).json({ message: 'This plan is not associated with a level' });
    }

    // Check if user has a level
    if (!req.user.level) {
      return res.status(400).json({ message: 'Please select a learning level first' });
    }

    // An existing active subscription for a DIFFERENT level blocks purchase
    // (must change level first). An existing active subscription for the
    // SAME level as this plan is allowed through — the callback will treat
    // it as a renewal (extend) rather than rejecting the purchase.
    const existingSubscription = await Subscription.getActiveSubscription(req.user._id);
    if (existingSubscription && existingSubscription.level._id.toString() !== plan.level._id.toString()) {
      return res.status(400).json({
        message: 'You already have an active subscription for a different level',
        existingSubscription
      });
    }

    console.log(`[Payment] plan="${plan.name}" price=${plan.price} ${plan.currency}, level=${plan.level?.name}`);

    const paymentResult = await itecPayment.createPaymentRequest({
      amount: plan.price,
      currency: plan.currency,
      userId: req.user._id,
      planId: plan._id,
      paymentMethod,
      phone: phone || null,
      email: req.user.email
    });

    // Record the pending payment server-side so the callback can look up the
    // true user/plan by reference instead of trusting client-echoed values.
    await PendingPayment.create({
      reference: paymentResult.reference,
      user: req.user._id,
      plan: plan._id,
      level: plan.level._id,
      subLevel: plan.subLevel || null,
      paymentId: paymentResult.paymentId,
      amount: plan.price,
      currency: plan.currency,
      paymentMethod,
      status: 'pending'
    });

    console.log(`[Payment] ✓ created: ref=${paymentResult.reference}, paymentId=${paymentResult.paymentId}, hasUrl=${!!paymentResult.paymentUrl}`);

    res.json({
      success: true,
      paymentUrl: paymentResult.paymentUrl || null,
      paymentId: paymentResult.paymentId,
      reference: paymentResult.reference,
      paymentMethod,
      message: paymentMethod === 'card'
        ? 'Redirect to the payment URL to complete your payment'
        : 'Check your phone for a payment prompt',
      plan: {
        id: plan._id,
        name: plan.name,
        price: plan.price,
        currency: plan.currency,
        durationDays: plan.durationDays
      }
    });
  } catch (error) {
    console.error(`[Payment] ✗ initiateSubscriptionPayment failed:`);
    console.error(`[Payment]   message: ${error.message}`);
    console.error(`[Payment]   stack:   ${error.stack}`);
    const statusCode = error.isGatewayError ? 400 : 500;
    res.status(statusCode).json({ message: error.message || 'Failed to initiate payment' });
  }
};

// @desc    Process payment callback
// @route   POST /api/subscriptions/callback
// @access  Public
const processPaymentCallback = async (req, res) => {
  try {
    console.log(`\n[Payment] ── Callback ──────────────────────────────`);
    console.log(`[Payment] body: ${JSON.stringify(req.body)}`);
    // iTechPay sends: { req_ref, transaction_id, amount, status }
    // For card the frontend may also POST after redirect: { reference, transaction_id, status }
    const reference = req.body.req_ref || req.body.reference;
    const transactionId = req.body.transaction_id || req.body.transactionId;
    const { amount, status } = req.body;

    if (!reference) {
      return res.status(400).json({ message: 'Missing payment reference (req_ref)' });
    }

    // Look up the trusted user/plan/level from the record we created at
    // initiate time. We never trust userId/planId from the callback body.
    const pendingPayment = await PendingPayment.findOne({ reference });
    if (!pendingPayment) {
      return res.status(404).json({ message: 'Payment reference not recognized' });
    }

    // Idempotency: if this reference was already processed, don't create a
    // second subscription.
    if (pendingPayment.status === 'completed') {
      const existing = await Subscription.findById(pendingPayment.subscription);
      return res.json({
        success: true,
        subscription: existing,
        message: 'Payment already processed'
      });
    }

    // Verify the payment with iTechPay using the stored payment method
    const callbackResult = await itecPayment.processCallback({
      transaction_id: transactionId,
      amount,
      status,
      req_ref: reference,
      paymentMethod: pendingPayment.paymentMethod
    });

    if (!callbackResult.success) {
      pendingPayment.status = 'failed';
      await pendingPayment.save();
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed',
        status: callbackResult.status
      });
    }

    const plan = await SubscriptionPlan.findById(pendingPayment.plan).populate('level');
    if (!plan) {
      return res.status(404).json({ message: 'Subscription plan not found' });
    }

    // If the user already has an active subscription for this same level,
    // treat this payment as a renewal (extend) instead of creating a
    // duplicate subscription record.
    const existingSubscription = await Subscription.getActiveSubscriptionForLevel(
      pendingPayment.user,
      plan.level._id
    );

    let subscription;
    if (existingSubscription) {
      const baseDate = existingSubscription.expiresAt > new Date() ? existingSubscription.expiresAt : new Date();
      const newExpiry = new Date(baseDate);
      newExpiry.setDate(newExpiry.getDate() + plan.durationDays);
      await existingSubscription.renew(newExpiry);
      existingSubscription.plan = plan._id;
      existingSubscription.subLevel = plan.subLevel || null;
      existingSubscription.paymentReference = transactionId;
      existingSubscription.amountPaid = callbackResult.amount;
      existingSubscription.currency = callbackResult.currency;
      await existingSubscription.save();
      subscription = existingSubscription;
    } else {
      subscription = await Subscription.create({
        user: pendingPayment.user,
        level: plan.level._id,
        subLevel: plan.subLevel || null,
        plan: plan._id,
        startsAt: new Date(),
        expiresAt: new Date(Date.now() + plan.durationDays * 24 * 60 * 60 * 1000),
        status: 'active',
        paymentMethod: callbackResult.paymentMethod || pendingPayment.paymentMethod,
        paymentReference: transactionId,
        amountPaid: callbackResult.amount,
        currency: callbackResult.currency
      });
    }

    await User.findByIdAndUpdate(pendingPayment.user, { level: plan.level._id });

    pendingPayment.status = 'completed';
    pendingPayment.subscription = subscription._id;
    await pendingPayment.save();

    res.json({
      success: true,
      subscription: subscription,
      message: 'Payment successful and subscription activated'
    });
  } catch (error) {
    console.error('Process callback error:', error);
    res.status(500).json({ message: error.message || 'Failed to process payment callback' });
  }
};

// @desc    Create new subscription directly, bypassing payment (e.g. comp/manual grants)
// @route   POST /api/subscriptions
// @access  Private/SuperAdmin
const createSubscription = async (req, res) => {
  try {
    const { userId, planId, paymentMethod, paymentReference, amountPaid } = req.body;

    if (!userId) {
      return res.status(400).json({ message: 'userId is required' });
    }

    // Get the plan
    const plan = await SubscriptionPlan.findById(planId);
    if (!plan) {
      return res.status(404).json({ message: 'Subscription plan not found' });
    }

    if (plan.status !== 'active') {
      return res.status(400).json({ message: 'This plan is not currently available' });
    }

    // Check if user already has an active subscription for this level
    const existingSubscription = await Subscription.getActiveSubscriptionForLevel(
      userId,
      plan.level
    );

    if (existingSubscription) {
      return res.status(400).json({
        message: 'This user already has an active subscription for this level'
      });
    }

    // Calculate expiry date
    const startDate = new Date();
    const expiresAt = new Date(startDate);
    expiresAt.setDate(expiresAt.getDate() + plan.durationDays);

    // Create subscription
    const subscription = await Subscription.create({
      user: userId,
      level: plan.level,
      subLevel: plan.subLevel || null,
      plan: planId,
      startsAt: startDate,
      expiresAt,
      status: 'active',
      paymentMethod: paymentMethod || 'itec',
      paymentReference,
      amountPaid: amountPaid || plan.price,
      currency: plan.currency
    });

    // Update user's level
    await User.findByIdAndUpdate(userId, { level: plan.level });

    const populatedSubscription = await Subscription.findById(subscription._id)
      .populate('user', 'firstName lastName email')
      .populate('level', 'name description')
      .populate('plan', 'name price durationDays features');

    res.status(201).json(populatedSubscription);
  } catch (error) {
    console.error('Create subscription error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Cancel subscription
// @route   PATCH /api/subscriptions/:id/cancel
// @access  Private
const cancelSubscription = async (req, res) => {
  try {
    const subscription = await Subscription.findById(req.params.id);

    if (!subscription) {
      return res.status(404).json({ message: 'Subscription not found' });
    }

    // Check if user has permission to cancel this subscription
    if (req.user.role !== 'superadmin' && req.user.role !== 'admin') {
      if (subscription.user.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not authorized to cancel this subscription' });
      }
    }

    await subscription.cancel();

    const populatedSubscription = await Subscription.findById(subscription._id)
      .populate('user', 'firstName lastName email')
      .populate('level', 'name description')
      .populate('plan', 'name price durationDays');

    res.json(populatedSubscription);
  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Renew subscription
// @route   PATCH /api/subscriptions/:id/renew
// @access  Private
const renewSubscription = async (req, res) => {
  try {
    const { paymentReference, amountPaid } = req.body;

    const subscription = await Subscription.findById(req.params.id)
      .populate('plan');

    if (!subscription) {
      return res.status(404).json({ message: 'Subscription not found' });
    }

    // Check if user has permission to renew this subscription
    if (req.user.role !== 'superadmin' && req.user.role !== 'admin') {
      if (subscription.user.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not authorized to renew this subscription' });
      }
    }

    // Calculate new expiry date
    const currentExpiry = new Date(subscription.expiresAt);
    const now = new Date();
    const baseDate = currentExpiry > now ? currentExpiry : now;
    const newExpiry = new Date(baseDate);
    newExpiry.setDate(newExpiry.getDate() + subscription.plan.durationDays);

    await subscription.renew(newExpiry);

    if (paymentReference) {
      subscription.paymentReference = paymentReference;
    }
    if (amountPaid) {
      subscription.amountPaid = amountPaid;
    }
    await subscription.save();

    const populatedSubscription = await Subscription.findById(subscription._id)
      .populate('user', 'firstName lastName email')
      .populate('level', 'name description')
      .populate('plan', 'name price durationDays');

    res.json(populatedSubscription);
  } catch (error) {
    console.error('Renew subscription error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get subscription statistics
// @route   GET /api/subscriptions/stats
// @access  Private/SuperAdmin
const getSubscriptionStats = async (req, res) => {
  try {
    const { level, startDate, endDate } = req.query;

    let matchQuery = {};
    if (level) matchQuery.level = level;
    if (startDate || endDate) {
      matchQuery.createdAt = {};
      if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
      if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
    }

    const now = new Date();

    const totalSubscriptions = await Subscription.countDocuments(matchQuery);
    const activeSubscribers = await Subscription.countDocuments({
      ...matchQuery,
      status: 'active'
    });
    const expiredSubscriptions = await Subscription.countDocuments({
      ...matchQuery,
      status: 'expired'
    });
    const cancelledSubscriptions = await Subscription.countDocuments({
      ...matchQuery,
      status: 'cancelled'
    });

    const levelsCount = await Level.countDocuments({ isActive: true });

    // Calculate total revenue
    const subscriptions = await Subscription.find(matchQuery);
    const totalRevenue = subscriptions.reduce((sum, sub) => sum + (sub.amountPaid || 0), 0);

    // Subscribers per level (active + total counts, revenue)
    const subscribersByLevelAgg = await Subscription.aggregate([
      { $match: matchQuery },
      { $group: {
          _id: '$level',
          totalCount: { $sum: 1 },
          activeCount: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
          revenue: { $sum: '$amountPaid' }
        } },
      { $lookup: { from: 'levels', localField: '_id', foreignField: '_id', as: 'levelInfo' } },
      { $unwind: { path: '$levelInfo', preserveNullAndEmptyArrays: true } },
      { $project: {
          level: { _id: '$_id', name: '$levelInfo.name' },
          activeCount: 1,
          totalCount: 1,
          revenue: 1
        }
      },
      { $sort: { totalCount: -1 } }
    ]);

    // Revenue by plan
    const revenueByPlan = await Subscription.aggregate([
      { $match: matchQuery },
      { $group: {
          _id: '$plan',
          subscriberCount: { $sum: 1 },
          revenue: { $sum: '$amountPaid' }
        } },
      { $lookup: { from: 'subscriptionplans', localField: '_id', foreignField: '_id', as: 'planInfo' } },
      { $unwind: { path: '$planInfo', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'levels', localField: 'planInfo.level', foreignField: '_id', as: 'levelInfo' } },
      { $unwind: { path: '$levelInfo', preserveNullAndEmptyArrays: true } },
      { $project: {
          plan: { _id: '$_id', name: '$planInfo.name', level: { name: '$levelInfo.name' } },
          subscriberCount: 1,
          revenue: 1
        }
      },
      { $sort: { revenue: -1 } }
    ]);

    // Recent subscriptions (most recent 20)
    const recentSubscriptions = await Subscription.find(matchQuery)
      .populate('user', 'firstName lastName email')
      .populate('level', 'name')
      .populate('plan', 'name')
      .sort({ createdAt: -1 })
      .limit(20);

    // Revenue by period (last 7 / 30 / 365 days)
    const periodStart = (days) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const revenueSince = async (days) => {
      const result = await Subscription.aggregate([
        { $match: { ...matchQuery, createdAt: { $gte: periodStart(days) } } },
        { $group: { _id: null, revenue: { $sum: '$amountPaid' }, count: { $sum: 1 } } }
      ]);
      return { revenue: result[0]?.revenue || 0, count: result[0]?.count || 0 };
    };
    const [weeklyRevenue, monthlyRevenue, yearlyRevenue] = await Promise.all([
      revenueSince(7),
      revenueSince(30),
      revenueSince(365)
    ]);

    // Most popular levels (ranked by subscriber count)
    const popularLevels = subscribersByLevelAgg
      .slice()
      .sort((a, b) => b.totalCount - a.totalCount)
      .slice(0, 10);

    // Most attempted exams (from Result collection)
    const mostAttemptedExams = await Result.aggregate([
      { $group: { _id: '$exam', attemptCount: { $sum: 1 } } },
      { $sort: { attemptCount: -1 } },
      { $limit: 10 },
      { $lookup: { from: 'exams', localField: '_id', foreignField: '_id', as: 'examInfo' } },
      { $unwind: { path: '$examInfo', preserveNullAndEmptyArrays: true } },
      { $project: { exam: { _id: '$_id', title: '$examInfo.title' }, attemptCount: 1 } }
    ]);

    // Free exam conversion rate: of users who have used their free exam,
    // how many went on to purchase a subscription at all
    const freeExamUserIds = await User.find({ freeExamUsed: true }).distinct('_id');
    const convertedCount = freeExamUserIds.length > 0
      ? await Subscription.countDocuments({ user: { $in: freeExamUserIds } })
      : 0;
    const convertedUserCount = freeExamUserIds.length > 0
      ? (await Subscription.distinct('user', { user: { $in: freeExamUserIds } })).length
      : 0;
    const freeExamConversionRate = {
      freeExamUsers: freeExamUserIds.length,
      convertedUsers: convertedUserCount,
      rate: freeExamUserIds.length > 0 ? Math.round((convertedUserCount / freeExamUserIds.length) * 100) : 0
    };

    // Subscription renewals
    const renewalsAgg = await Subscription.aggregate([
      { $match: { renewalCount: { $gt: 0 } } },
      { $group: { _id: null, totalRenewals: { $sum: '$renewalCount' }, subscriptionsRenewed: { $sum: 1 } } }
    ]);
    const renewals = {
      totalRenewals: renewalsAgg[0]?.totalRenewals || 0,
      subscriptionsRenewed: renewalsAgg[0]?.subscriptionsRenewed || 0
    };

    // Expired subscriptions detail (most recent 20)
    const expiredSubscriptionsList = await Subscription.find({ ...matchQuery, status: 'expired' })
      .populate('user', 'firstName lastName email')
      .populate('level', 'name')
      .populate('plan', 'name')
      .sort({ expiresAt: -1 })
      .limit(20);

    res.json({
      totalSubscriptions,
      activeSubscribers,
      expiredSubscriptions,
      cancelledSubscriptions,
      totalRevenue,
      levelsCount,
      subscribersByLevel: subscribersByLevelAgg,
      revenueByPlan,
      recentSubscriptions,
      revenueByPeriod: {
        weekly: weeklyRevenue,
        monthly: monthlyRevenue,
        yearly: yearlyRevenue
      },
      popularLevels,
      mostAttemptedExams,
      freeExamConversionRate,
      renewals,
      expiredSubscriptionsList
    });
  } catch (error) {
    console.error('Get subscription stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get the user's most recent pending mobile money payment (if any)
// @route   GET /api/subscriptions/my/pending-payment
// @access  Private
const getMyPendingPayment = async (req, res) => {
  try {
    const pending = await PendingPayment.findOne({ user: req.user._id, status: 'pending' })
      .populate('plan', 'name price currency')
      .sort({ createdAt: -1 });

    if (!pending) return res.json(null);

    res.json({
      reference: pending.reference,
      paymentMethod: pending.paymentMethod,
      amount: pending.amount,
      currency: pending.currency,
      plan: pending.plan,
      createdAt: pending.createdAt
    });
  } catch (error) {
    console.error('getMyPendingPayment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Poll payment status for a pending mobile money payment
// @route   GET /api/subscriptions/payment-status/:reference
// @access  Private
const checkPaymentStatus = async (req, res) => {
  try {
    const { reference } = req.params;
    const pendingPayment = await PendingPayment.findOne({ reference, user: req.user._id });
    if (!pendingPayment) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    if (pendingPayment.status === 'completed') {
      return res.json({ status: 'completed', success: true });
    }
    if (pendingPayment.status === 'failed') {
      return res.json({ status: 'cancelled', success: false, cancelled: true });
    }

    // Ask iTechPay for live status
    const result = await itecPayment.verifyPayment(reference, pendingPayment.paymentMethod);

    const cancelledStatuses = ['cancelled', 'canceled', 'rejected', 'failed', 'error', 'declined'];

    if (result.success) {
      return res.json({ status: 'completed', success: true });
    }

    if (cancelledStatuses.includes(result.status)) {
      pendingPayment.status = 'failed';
      await pendingPayment.save();
      return res.json({ status: 'cancelled', success: false, cancelled: true });
    }

    // Still waiting (pending / processing / unknown)
    return res.json({ status: 'pending', success: false, pending: true });
  } catch (error) {
    console.error('Check payment status error:', error);
    res.status(500).json({ message: 'Failed to check payment status' });
  }
};

module.exports = {
  getSubscriptions,
  getSubscriptionById,
  getMyActiveSubscription,
  getMyPendingPayment,
  initiateSubscriptionPayment,
  processPaymentCallback,
  checkPaymentStatus,
  createSubscription,
  cancelSubscription,
  renewSubscription,
  getSubscriptionStats
};
