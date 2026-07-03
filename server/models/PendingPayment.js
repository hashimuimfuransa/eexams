const mongoose = require('mongoose');

const PendingPaymentSchema = new mongoose.Schema({
  reference: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Exactly one of `plan` (level/exam subscription), `organizationPlan`
  // (organisation tier subscription), or `individualPlan` (individual teacher
  // tier subscription) is set, depending on what's being paid for.
  plan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubscriptionPlan',
    required: function() { return !this.organizationPlan && !this.individualPlan; }
  },
  // Required for level-type `plan` purchases; null for exam-type plans
  // (see `exam` below) and account-tier plans.
  level: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Level',
    required: function() { return !this.organizationPlan && !this.individualPlan && !this.exam; }
  },
  // Set when `plan` is an exam-type SubscriptionPlan — the specific exam
  // being purchased access to.
  exam: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Exam',
    default: null
  },
  organizationPlan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'OrganizationPlan',
    default: null
  },
  individualPlan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'IndividualPlan',
    default: null
  },
  subLevel: {
    type: String,
    default: null
  },
  paymentId: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'RWF'
  },
  paymentMethod: {
    type: String,
    enum: ['airtel_money', 'mobile_money', 'card'],
    default: 'mobile_money'
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending'
  },
  subscription: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subscription',
    default: null
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('PendingPayment', PendingPaymentSchema);
