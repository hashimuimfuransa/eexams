const mongoose = require('mongoose');

// Purchasable catalog entries for individual (non-organisation) teacher
// subscriptions — same shape and role as OrganizationPlan, kept as a
// separate model because pricing/duration differ per audience (matches the
// existing convention of one model per plan audience, e.g. SubscriptionPlan
// for level/exam plans vs OrganizationPlan for organisation plans).
const IndividualPlanSchema = new mongoose.Schema({
  tierKey: {
    type: String,
    enum: ['basic', 'premium', 'enterprise'],
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'RWF',
    trim: true
  },
  // Canonical duration used by every expiry calculation, always expressed in
  // days (fractional when the plan was entered in hours, e.g. 12 hours = 0.5).
  durationDays: {
    type: Number,
    required: true,
    min: 0.01
  },
  // The raw number/unit the admin entered, kept only so the edit UI can
  // redisplay "12 hours" instead of "0.5 days" — durationDays is authoritative.
  durationValue: {
    type: Number,
    min: 0.01
  },
  durationUnit: {
    type: String,
    enum: ['hours', 'days'],
    default: 'days'
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  features: [{
    type: String
  }],
  discountPercentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
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

IndividualPlanSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

IndividualPlanSchema.index({ tierKey: 1, status: 1 });
IndividualPlanSchema.index({ status: 1, price: 1 });

IndividualPlanSchema.statics.getActivePlans = async function() {
  return this.find({ status: 'active' }).sort({ price: 1 });
};

IndividualPlanSchema.virtual('formattedPrice').get(function() {
  return `${this.price.toLocaleString()} ${this.currency}`;
});

module.exports = mongoose.model('IndividualPlan', IndividualPlanSchema);
