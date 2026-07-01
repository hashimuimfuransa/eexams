const mongoose = require('mongoose');

const SubscriptionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  level: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Level',
    required: true
  },
  // Optional sub-level scope, copied from the plan purchased. Null means
  // the subscription covers the whole level (all sub-levels).
  subLevel: {
    type: String,
    default: null
  },
  plan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubscriptionPlan',
    required: true
  },
  startsAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'expired', 'cancelled', 'pending'],
    default: 'active'
  },
  paymentMethod: {
    type: String,
    enum: ['itec', 'airtel_money', 'mobile_money', 'bank_transfer', 'card'],
    default: 'mobile_money'
  },
  paymentReference: {
    type: String,
    trim: true
  },
  amountPaid: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'RWF'
  },
  autoRenew: {
    type: Boolean,
    default: false
  },
  cancelledAt: {
    type: Date,
    default: null
  },
  renewalCount: {
    type: Number,
    default: 0
  },
  lastRenewedAt: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update updatedAt on save
SubscriptionSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Index for faster queries
SubscriptionSchema.index({ user: 1, status: 1 });
SubscriptionSchema.index({ level: 1, status: 1 });
SubscriptionSchema.index({ expiresAt: 1, status: 1 });
SubscriptionSchema.index({ user: 1, level: 1, status: 1 });

// Static method to get active subscription for user
SubscriptionSchema.statics.getActiveSubscription = async function(userId) {
  const now = new Date();
  return this.findOne({
    user: userId,
    status: 'active',
    expiresAt: { $gt: now }
  }).populate('level').populate('plan');
};

// Static method to get active subscription for user and level
SubscriptionSchema.statics.getActiveSubscriptionForLevel = async function(userId, levelId) {
  const now = new Date();
  return this.findOne({
    user: userId,
    level: levelId,
    status: 'active',
    expiresAt: { $gt: now }
  }).populate('level').populate('plan');
};

// Instance method to check if subscription is valid
SubscriptionSchema.methods.isValid = function() {
  const now = new Date();
  return this.status === 'active' && this.expiresAt > now;
};

// Instance method to get days remaining
SubscriptionSchema.methods.getDaysRemaining = function() {
  const now = new Date();
  const expiresAt = new Date(this.expiresAt);
  const diffTime = expiresAt - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
};

// Instance method to cancel subscription
SubscriptionSchema.methods.cancel = async function() {
  this.status = 'cancelled';
  this.cancelledAt = new Date();
  this.autoRenew = false;
  await this.save();
  return this;
};

// Instance method to renew subscription
SubscriptionSchema.methods.renew = async function(newExpiryDate) {
  this.expiresAt = newExpiryDate;
  this.renewalCount += 1;
  this.lastRenewedAt = new Date();
  this.status = 'active';
  await this.save();
  return this;
};

module.exports = mongoose.model('Subscription', SubscriptionSchema);
