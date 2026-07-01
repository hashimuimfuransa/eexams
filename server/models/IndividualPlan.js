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
  durationDays: {
    type: Number,
    required: true,
    min: 1
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
