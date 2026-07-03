const Subscription = require('../models/Subscription');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const OrganizationPlan = require('../models/OrganizationPlan');
const IndividualPlan = require('../models/IndividualPlan');
const Level = require('../models/Level');
const User = require('../models/User');
const Result = require('../models/Result');
const PendingPayment = require('../models/PendingPayment');
const itecPayment = require('../services/itecPayment');
const { streamSubscriptionInvoice } = require('../utils/invoiceGenerator');

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

// @desc    Download a PDF invoice for a paid subscription
// @route   GET /api/subscriptions/:id/invoice
// @access  Private (owner or SuperAdmin — enforced by validateSubscriptionOwnership)
const downloadSubscriptionInvoice = async (req, res) => {
  try {
    const subscription = await Subscription.findById(req.params.id)
      .populate('user', 'firstName lastName email')
      .populate('level', 'name')
      .populate('exam', 'title')
      .populate('plan', 'name durationDays durationValue durationUnit');

    if (!subscription) {
      return res.status(404).json({ message: 'Subscription not found' });
    }

    // Ownership already checked by validateSubscriptionOwnership middleware.
    streamSubscriptionInvoice(res, subscription);
  } catch (error) {
    console.error('Download subscription invoice error:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Server error while generating invoice' });
    }
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
    const plan = await SubscriptionPlan.findById(planId).populate('level').populate('exam');
    if (!plan) {
      return res.status(404).json({ message: 'Subscription plan not found' });
    }

    if (plan.status !== 'active') {
      return res.status(400).json({ message: 'This plan is not currently available' });
    }

    let pendingPaymentData;

    if (plan.planType === 'exam') {
      if (!plan.exam) {
        return res.status(400).json({ message: 'This plan is not associated with an exam' });
      }

      // Courtesy check so students don't pay for an exam they can never
      // reach — the real enforcement is examAccess.js at start/answer time.
      if (req.user.level && plan.exam.level && plan.exam.level.toString() !== req.user.level.toString()) {
        return res.status(400).json({ message: 'This exam is not available for your current level' });
      }

      console.log(`[Payment] plan="${plan.name}" price=${plan.price} ${plan.currency}, exam=${plan.exam?.title}`);

      pendingPaymentData = {
        plan: plan._id,
        exam: plan.exam._id,
        level: plan.exam.level || null,
        subLevel: null
      };
    } else {
      if (!plan.level) {
        return res.status(400).json({ message: 'This plan is not associated with a level' });
      }

      // Check if user has a level
      if (!req.user.level) {
        return res.status(400).json({ message: 'Please select a learning level first' });
      }

      // An existing active level-wide subscription for a DIFFERENT level blocks
      // purchase (must change level first). An existing active subscription for
      // the SAME level as this plan is allowed through — the callback will treat
      // it as a renewal (extend) rather than rejecting the purchase. Exam-scoped
      // subscriptions don't count toward this conflict check.
      const existingSubscription = await Subscription.getActiveLevelSubscription(req.user._id);
      if (existingSubscription && existingSubscription.level._id.toString() !== plan.level._id.toString()) {
        return res.status(400).json({
          message: 'You already have an active subscription for a different level',
          existingSubscription
        });
      }

      console.log(`[Payment] plan="${plan.name}" price=${plan.price} ${plan.currency}, level=${plan.level?.name}`);

      pendingPaymentData = {
        plan: plan._id,
        level: plan.level._id,
        subLevel: plan.subLevel || null
      };
    }

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
      ...pendingPaymentData,
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

// Shared by both the organisation and individual (teacher) plan purchase
// flows — same PLANS-style catalog shape (tierKey/name/price/durationDays),
// only the model and the PendingPayment field they're recorded under differ.
const ACCOUNT_PLAN_KINDS = {
  organization: { Model: OrganizationPlan, pendingField: 'organizationPlan', label: 'Organization' },
  individual: { Model: IndividualPlan, pendingField: 'individualPlan', label: 'Individual' }
};

const initiateAccountPlanPayment = async (req, res, kind) => {
  const { Model, pendingField, label } = ACCOUNT_PLAN_KINDS[kind];
  try {
    const { planId, paymentMethod = 'mobile_money', phone } = req.body;
    console.log(`\n[Payment] ── Initiate (${kind}) ─────────────────────────`);
    console.log(`[Payment] user=${req.user?._id} (${req.user?.email})`);
    console.log(`[Payment] planId=${planId}, method=${paymentMethod}, phone=${phone || 'n/a'}`);

    const validMethods = ['airtel_money', 'mobile_money', 'card'];
    if (!validMethods.includes(paymentMethod)) {
      return res.status(400).json({ message: 'Invalid payment method. Use airtel_money, mobile_money, or card' });
    }

    if (paymentMethod !== 'card' && !phone) {
      return res.status(400).json({ message: 'Phone number is required for mobile money payments' });
    }

    const plan = await Model.findById(planId);
    if (!plan) {
      return res.status(404).json({ message: `${label} plan not found` });
    }

    if (plan.status !== 'active') {
      return res.status(400).json({ message: 'This plan is not currently available' });
    }

    console.log(`[Payment] ${kind} plan="${plan.name}" (${plan.tierKey}) price=${plan.price} ${plan.currency}`);

    const paymentResult = await itecPayment.createPaymentRequest({
      amount: plan.price,
      currency: plan.currency,
      userId: req.user._id,
      planId: plan._id,
      paymentMethod,
      phone: phone || null,
      email: req.user.email
    });

    await PendingPayment.create({
      reference: paymentResult.reference,
      user: req.user._id,
      [pendingField]: plan._id,
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
    console.error(`[Payment] ✗ initiate${label}SubscriptionPayment failed:`);
    console.error(`[Payment]   message: ${error.message}`);
    console.error(`[Payment]   stack:   ${error.stack}`);
    const statusCode = error.isGatewayError ? 400 : 500;
    res.status(statusCode).json({ message: error.message || 'Failed to initiate payment' });
  }
};

// @desc    Initiate payment for an organisation subscription plan
// @route   POST /api/subscriptions/organization/initiate
// @access  Private/Admin (organisation owner) or SuperAdmin
const initiateOrganizationSubscriptionPayment = (req, res) => initiateAccountPlanPayment(req, res, 'organization');

// @desc    Initiate payment for an individual (teacher) subscription plan
// @route   POST /api/subscriptions/individual/initiate
// @access  Private/Teacher (individual, non-organisation)
const initiateIndividualSubscriptionPayment = (req, res) => {
  // Org teachers' plans are managed by their admin, not self-purchased.
  if (req.user.parentAdmin) {
    return res.status(403).json({ message: 'Your subscription plan is managed by your organisation admin.' });
  }
  return initiateAccountPlanPayment(req, res, 'individual');
};

// Activates an organisation/individual subscription for a pending payment
// iTechPay has confirmed as successful. Extends the current subscription
// window if the account is already active/paid (renewal), otherwise starts
// a fresh one. Shared between the two kinds since both just update the same
// User.subscriptionPlan/subscriptionStatus/subscriptionEndDate fields.
const activateAccountPlanPendingPayment = async (pendingPayment, Model, planId) => {
  const plan = await Model.findById(planId);
  if (!plan) {
    throw new Error('Plan not found for pending payment');
  }

  const user = await User.findById(pendingPayment.user);
  if (!user) {
    throw new Error('User not found for pending payment');
  }

  const now = new Date();
  const baseDate = (user.subscriptionStatus === 'active' && user.subscriptionEndDate && user.subscriptionEndDate > now)
    ? user.subscriptionEndDate
    : now;
  const newExpiry = new Date(baseDate.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);

  user.subscriptionPlan = plan.tierKey;
  user.subscriptionStatus = 'active';
  if (!user.subscriptionStartDate) user.subscriptionStartDate = now;
  user.subscriptionEndDate = newExpiry;
  user.subscriptionExpiresAt = newExpiry;
  user.lastPaymentDate = now;
  await user.save();

  pendingPayment.status = 'completed';
  await pendingPayment.save();

  return user;
};

// Activates a subscription for a pending payment iTechPay has confirmed as
// successful. Shared by the webhook callback and the status-polling fallback,
// since either one may be the first to observe success — the webhook isn't
// reliably delivered by the gateway, so polling has to be able to activate
// too, not just report status back to the frontend.
const activatePendingPayment = async (pendingPaymentId, { amount, currency, transactionId, paymentMethod }) => {
  const pendingPayment = await PendingPayment.findById(pendingPaymentId);

  if (pendingPayment.organizationPlan || pendingPayment.individualPlan) {
    if (pendingPayment.status === 'completed') {
      return User.findById(pendingPayment.user).select('subscriptionPlan subscriptionStatus subscriptionStartDate subscriptionEndDate');
    }
    const { Model } = pendingPayment.organizationPlan ? ACCOUNT_PLAN_KINDS.organization : ACCOUNT_PLAN_KINDS.individual;
    const planId = pendingPayment.organizationPlan || pendingPayment.individualPlan;
    return activateAccountPlanPendingPayment(pendingPayment, Model, planId);
  }

  if (pendingPayment.status === 'completed') {
    return Subscription.findById(pendingPayment.subscription);
  }

  const plan = await SubscriptionPlan.findById(pendingPayment.plan).populate('level').populate('exam');
  if (!plan) {
    throw new Error('Subscription plan not found for pending payment');
  }

  const isExamPlan = plan.planType === 'exam';

  const existingSubscription = isExamPlan
    ? await Subscription.getActiveSubscriptionForExam(pendingPayment.user, plan.exam._id)
    : await Subscription.getActiveSubscriptionForLevel(pendingPayment.user, plan.level._id);

  let subscription;
  if (existingSubscription) {
    const baseDate = existingSubscription.expiresAt > new Date() ? existingSubscription.expiresAt : new Date();
    const newExpiry = new Date(baseDate.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);
    await existingSubscription.renew(newExpiry);
    existingSubscription.plan = plan._id;
    if (!isExamPlan) existingSubscription.subLevel = plan.subLevel || null;
    existingSubscription.paymentReference = transactionId || pendingPayment.paymentId;
    // Accumulate, don't overwrite — amountPaid is the running total ever paid
    // on this subscription across all renewals, so total-revenue reporting
    // doesn't lose the original payment every time someone renews.
    existingSubscription.amountPaid = (existingSubscription.amountPaid || 0) + Number(amount ?? pendingPayment.amount ?? 0);
    existingSubscription.currency = currency || pendingPayment.currency || 'RWF';
    await existingSubscription.save();
    subscription = existingSubscription;
  } else {
    subscription = await Subscription.create({
      user: pendingPayment.user,
      level: isExamPlan ? (plan.exam.level || null) : plan.level._id,
      subLevel: isExamPlan ? null : (plan.subLevel || null),
      exam: isExamPlan ? plan.exam._id : null,
      planType: isExamPlan ? 'exam' : 'level',
      plan: plan._id,
      startsAt: new Date(),
      expiresAt: new Date(Date.now() + plan.durationDays * 24 * 60 * 60 * 1000),
      status: 'active',
      paymentMethod: paymentMethod || pendingPayment.paymentMethod,
      paymentReference: transactionId || pendingPayment.paymentId,
      amountPaid: Number(amount ?? pendingPayment.amount ?? 0),
      currency: currency || pendingPayment.currency || 'RWF'
    });
  }

  // Exam-scoped purchases grant access to that one exam only — unlike a
  // level plan, they must not change the student's selected level.
  if (!isExamPlan) {
    await User.findByIdAndUpdate(pendingPayment.user, { level: plan.level._id });
  }

  pendingPayment.status = 'completed';
  pendingPayment.subscription = subscription._id;
  await pendingPayment.save();

  return subscription;
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
    // iTechPay payloads can vary; support common shapes.
    const reference =
      req.body.req_ref ||
      req.body.reference ||
      req.body?.data?.req_ref ||
      req.body?.data?.reference;

    const transactionId =
      req.body.transaction_id ||
      req.body.transactionId ||
      req.body?.data?.transaction_id ||
      req.body?.data?.transactionId;

    const status = req.body.status || req.body?.data?.status;
    const amount = req.body.amount || req.body?.data?.amount;

    console.log('[Payment] parsed callback:', {
      reference,
      transactionId,
      status,
      amount: amount != null ? String(amount) : amount
    });

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
      amount: Number(amount),
      status,
      req_ref: reference,
      paymentMethod: pendingPayment.paymentMethod
    });

    console.log('[Payment] callbackResult:', {
      success: callbackResult?.success,
      status: callbackResult?.status,
      amount: callbackResult?.amount,
      currency: callbackResult?.currency,
      transactionId: callbackResult?.transactionId
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

    const subscription = await activatePendingPayment(pendingPayment._id, {
      amount: callbackResult.amount ?? amount,
      currency: callbackResult.currency,
      transactionId,
      paymentMethod: callbackResult.paymentMethod || pendingPayment.paymentMethod
    });

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
    const expiresAt = new Date(startDate.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);

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
    const newExpiry = new Date(baseDate.getTime() + subscription.plan.durationDays * 24 * 60 * 60 * 1000);

    await subscription.renew(newExpiry);

    if (paymentReference) {
      subscription.paymentReference = paymentReference;
    }
    if (amountPaid) {
      // Accumulate, don't overwrite — see activatePendingPayment for why.
      subscription.amountPaid = (subscription.amountPaid || 0) + Number(amountPaid);
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

// @desc    List organisation admins + independent teachers and their current
//          account-plan (User.subscriptionPlan/subscriptionStatus), so the
//          super admin can manage/cancel any active plan from the
//          Subscription Reports page. Org-managed teachers are excluded
//          since their plan is inherited from their parentAdmin, not their own.
// @route   GET /api/subscriptions/account-plans/subscribers
// @access  Private/SuperAdmin
const getAccountPlanSubscribers = async (req, res) => {
  try {
    const subscribers = await User.find({
      role: { $in: ['admin', 'teacher'] },
      parentAdmin: null,
      subscriptionPlan: { $ne: null }
    })
      .select('firstName lastName email organization role userType subscriptionPlan subscriptionStatus subscriptionStartDate subscriptionEndDate subscriptionExpiresAt isBlocked createdAt')
      .sort({ subscriptionStatus: 1, subscriptionEndDate: 1 });

    res.json(subscribers);
  } catch (error) {
    console.error('getAccountPlanSubscribers error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Cancel a user's active organisation/individual account-plan
//          subscription — immediately reverts them to the Free plan.
// @route   POST /api/subscriptions/account-plans/:userId/cancel
// @access  Private/SuperAdmin
const cancelAccountPlanSubscription = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (!['admin', 'teacher'].includes(user.role)) {
      return res.status(400).json({ message: 'This user does not have an account-level plan' });
    }
    if (user.parentAdmin) {
      return res.status(400).json({ message: 'Org-managed teachers inherit their plan from their organisation admin — cancel the admin\'s plan instead' });
    }
    if (user.subscriptionPlan === 'free') {
      return res.status(400).json({ message: 'This user is already on the Free plan' });
    }

    const now = new Date();
    const isOrg = user.role === 'admin';
    const expiry = new Date(now.getTime() + (isOrg ? 30 : 14) * 24 * 60 * 60 * 1000);

    user.subscriptionPlan = 'free';
    user.subscriptionStatus = 'active';
    user.subscriptionStartDate = now;
    user.subscriptionEndDate = expiry;
    user.subscriptionExpiresAt = expiry;
    await user.save();

    res.json({
      success: true,
      message: 'Subscription cancelled — user reverted to the Free plan',
      user: {
        _id: user._id,
        subscriptionPlan: user.subscriptionPlan,
        subscriptionStatus: user.subscriptionStatus,
        subscriptionExpiresAt: user.subscriptionExpiresAt
      }
    });
  } catch (error) {
    console.error('cancelAccountPlanSubscription error:', error);
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

    // Recently renewed subscriptions (most recent 20)
    const renewalsList = await Subscription.find({ ...matchQuery, renewalCount: { $gt: 0 } })
      .populate('user', 'firstName lastName email')
      .populate('level', 'name')
      .populate('plan', 'name')
      .sort({ lastRenewedAt: -1 })
      .limit(20);

    // Pending payments awaiting activation (stuck / needs admin review)
    const pendingPaymentsCount = await PendingPayment.countDocuments({ status: 'pending' });

    // Expired subscriptions detail (most recent 20)
    const expiredSubscriptionsList = await Subscription.find({ ...matchQuery, status: 'expired' })
      .populate('user', 'firstName lastName email')
      .populate('level', 'name')
      .populate('plan', 'name')
      .sort({ expiresAt: -1 })
      .limit(20);

    // Organisation + individual teacher account-plan subscriptions. These
    // don't live in the Subscription collection (they're User.subscriptionPlan/
    // subscriptionStatus fields updated directly — see activateAccountPlanPendingPayment),
    // so they need their own stats built from PendingPayment (completed) + User.
    const buildAccountPlanStats = async (kind) => {
      const { pendingField } = ACCOUNT_PLAN_KINDS[kind];
      const planCollection = kind === 'organization' ? 'organizationplans' : 'individualplans';
      const userQuery = kind === 'organization'
        ? { role: 'admin', userType: 'organization' }
        : { role: 'teacher', userType: 'individual', parentAdmin: null };

      const activeCount = await User.countDocuments({
        ...userQuery,
        subscriptionStatus: 'active',
        subscriptionEndDate: { $gt: now }
      });

      const revenueByTier = await PendingPayment.aggregate([
        { $match: { status: 'completed', [pendingField]: { $ne: null } } },
        { $group: {
            _id: `$${pendingField}`,
            subscriberCount: { $sum: 1 },
            revenue: { $sum: '$amount' }
          } },
        { $lookup: { from: planCollection, localField: '_id', foreignField: '_id', as: 'planInfo' } },
        { $unwind: { path: '$planInfo', preserveNullAndEmptyArrays: true } },
        { $project: {
            plan: { _id: '$_id', name: '$planInfo.name', tierKey: '$planInfo.tierKey' },
            subscriberCount: 1,
            revenue: 1
          }
        },
        { $sort: { revenue: -1 } }
      ]);

      const totalRevenue = revenueByTier.reduce((sum, r) => sum + (r.revenue || 0), 0);
      const totalPurchases = revenueByTier.reduce((sum, r) => sum + (r.subscriberCount || 0), 0);

      const recentPayments = await PendingPayment.find({ status: 'completed', [pendingField]: { $ne: null } })
        .populate('user', 'firstName lastName email organization')
        .populate(pendingField, 'name tierKey')
        .sort({ updatedAt: -1 })
        .limit(20);

      return { activeCount, totalRevenue, totalPurchases, revenueByTier, recentPayments };
    };

    const [organizationPlanStats, individualPlanStats] = await Promise.all([
      buildAccountPlanStats('organization'),
      buildAccountPlanStats('individual')
    ]);

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
      renewalsList,
      pendingPaymentsCount,
      expiredSubscriptionsList,
      accountPlans: {
        organization: organizationPlanStats,
        individual: individualPlanStats
      }
    });
  } catch (error) {
    console.error('Get subscription stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get the user's most recent pending mobile money payment (if any)
// @route   GET /api/subscriptions/my/pending-payment
// @access  Private
//
// Also acts as a fallback reconciler: the primary activation path is the
// frontend polling /payment-status while the user waits on the payment page,
// but if they close the tab/app before that resolves, the payment can be
// left stuck as 'pending' forever (the iTechPay webhook is unreliable). This
// endpoint is called on every dashboard load, so it doubles as a chance to
// re-check with iTechPay and activate/fail it even if nobody was watching.
const getMyPendingPayment = async (req, res) => {
  try {
    const pending = await PendingPayment.findOne({ user: req.user._id, status: 'pending' })
      .populate('plan', 'name price currency')
      .populate('organizationPlan', 'name price currency tierKey')
      .populate('individualPlan', 'name price currency tierKey')
      .sort({ createdAt: -1 });

    if (!pending) return res.json(null);

    try {
      const verify = await itecPayment.verifyPayment(pending.reference, pending.paymentMethod);
      if (verify.success) {
        await activatePendingPayment(pending._id, {
          amount: verify.amount,
          currency: verify.currency,
          transactionId: verify.transactionId,
          paymentMethod: pending.paymentMethod
        });
        return res.json(null);
      }
      const cancelledStatuses = ['cancelled', 'canceled', 'rejected', 'failed', 'error', 'declined'];
      if (cancelledStatuses.includes(verify.status)) {
        pending.status = 'failed';
        await pending.save();
        return res.json(null);
      }
    } catch (verifyErr) {
      console.warn('getMyPendingPayment: iTechPay re-verify failed, showing stale pending state:', verifyErr.message);
    }

    res.json({
      reference: pending.reference,
      paymentMethod: pending.paymentMethod,
      amount: pending.amount,
      currency: pending.currency,
      plan: pending.plan || pending.organizationPlan || pending.individualPlan,
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
      await activatePendingPayment(pendingPayment._id, {
        amount: result.amount,
        currency: result.currency,
        transactionId: result.transactionId,
        paymentMethod: pendingPayment.paymentMethod
      });
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

// @desc    List pending payments awaiting review (paid-but-not-activated /
//          stuck in flight) so admins can see and resolve them without a script
// @route   GET /api/subscriptions/pending
// @access  Private/SuperAdmin
const getPendingPayments = async (req, res) => {
  try {
    const pending = await PendingPayment.find({ status: 'pending' })
      .populate('user', 'firstName lastName email')
      .populate('plan', 'name price durationDays')
      .populate('level', 'name')
      .populate('organizationPlan', 'name price durationDays tierKey')
      .populate('individualPlan', 'name price durationDays tierKey')
      .sort({ createdAt: -1 });

    res.json(pending);
  } catch (error) {
    console.error('getPendingPayments error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Manually re-verify a pending payment with iTechPay and activate
//          the subscription if confirmed paid
// @route   POST /api/subscriptions/pending/:id/approve
// @access  Private/SuperAdmin
const approvePendingPayment = async (req, res) => {
  try {
    const pendingPayment = await PendingPayment.findById(req.params.id);
    if (!pendingPayment) {
      return res.status(404).json({ message: 'Pending payment not found' });
    }

    if (pendingPayment.status === 'completed') {
      const existing = await Subscription.findById(pendingPayment.subscription)
        .populate('user', 'firstName lastName email')
        .populate('level', 'name')
        .populate('plan', 'name price durationDays');
      return res.json({ success: true, subscription: existing, message: 'Payment already processed' });
    }

    const verify = await itecPayment.verifyPayment(pendingPayment.reference, pendingPayment.paymentMethod);
    if (!verify.success) {
      return res.status(400).json({
        success: false,
        message: `iTechPay does not confirm this payment as successful (status: ${verify.status})`
      });
    }

    const subscription = await activatePendingPayment(pendingPayment._id, {
      amount: verify.amount,
      currency: verify.currency,
      transactionId: verify.transactionId,
      paymentMethod: pendingPayment.paymentMethod
    });

    const populated = await Subscription.findById(subscription._id)
      .populate('user', 'firstName lastName email')
      .populate('level', 'name')
      .populate('plan', 'name price durationDays');

    res.json({ success: true, subscription: populated, message: 'Payment verified and subscription activated' });
  } catch (error) {
    console.error('approvePendingPayment error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// @desc    Mark a stuck pending payment as failed (dismiss it from the review queue)
// @route   PATCH /api/subscriptions/pending/:id/reject
// @access  Private/SuperAdmin
const rejectPendingPayment = async (req, res) => {
  try {
    const pendingPayment = await PendingPayment.findById(req.params.id);
    if (!pendingPayment) {
      return res.status(404).json({ message: 'Pending payment not found' });
    }
    if (pendingPayment.status !== 'pending') {
      return res.status(400).json({ message: 'Only pending payments can be rejected' });
    }

    pendingPayment.status = 'failed';
    await pendingPayment.save();

    res.json({ success: true, message: 'Payment marked as failed' });
  } catch (error) {
    console.error('rejectPendingPayment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  activatePendingPayment,
  initiateOrganizationSubscriptionPayment,
  initiateIndividualSubscriptionPayment,
  getSubscriptions,
  getSubscriptionById,
  downloadSubscriptionInvoice,
  getMyActiveSubscription,
  getMyPendingPayment,
  initiateSubscriptionPayment,
  processPaymentCallback,
  checkPaymentStatus,
  getPendingPayments,
  approvePendingPayment,
  rejectPendingPayment,
  createSubscription,
  cancelSubscription,
  renewSubscription,
  getSubscriptionStats,
  getAccountPlanSubscribers,
  cancelAccountPlanSubscription
};
