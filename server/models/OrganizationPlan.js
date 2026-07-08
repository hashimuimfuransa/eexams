const mongoose = require('mongoose');

// Purchasable catalog entries for organisation subscriptions — the org-plan
// analog of SubscriptionPlan (level-based plans). tierKey ties a purchased
// plan back to the existing subscriptionPlan enum on User/enforcement logic
// in server/config/plans.js, so pricing/duration/features are DB-editable
// by the super admin while feature-limit enforcement stays keyed off tierKey.
const OrganizationPlanSchema = new mongoose.Schema({
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
  // Enforcement overrides — when unset (null), server/config/plans.js falls
  // back to the hardcoded default for this tierKey. -1 means "unlimited".
  maxExams: { type: Number, default: null },
  maxStudents: { type: Number, default: null },
  maxTeachers: { type: Number, default: null },
  examPerMonth: { type: Number, default: null },
  storageLimit: { type: Number, default: null }, // MB
  aiFeatures: { type: Boolean, default: null },
  advancedAI: { type: Boolean, default: null },
  analytics: { type: Boolean, default: null },
  prioritySupport: { type: Boolean, default: null },
  customBranding: { type: Boolean, default: null },
  apiAccess: { type: Boolean, default: null },
  marketplaceAccess: { type: Boolean, default: null },
  templates: { type: Boolean, default: null },
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

OrganizationPlanSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

OrganizationPlanSchema.index({ tierKey: 1, status: 1 });
OrganizationPlanSchema.index({ status: 1, price: 1 });

OrganizationPlanSchema.statics.getActivePlans = async function() {
  return this.find({ status: 'active' }).sort({ price: 1 });
};

OrganizationPlanSchema.virtual('formattedPrice').get(function() {
  return `${this.price.toLocaleString()} ${this.currency}`;
});

module.exports = mongoose.model('OrganizationPlan', OrganizationPlanSchema);
