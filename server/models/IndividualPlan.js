const mongoose = require('mongoose');
const { PLAN_SCOPES, DEFAULT_PLAN_SCOPE, TIER_ORDER } = require('../utils/planLimits');

// Purchasable catalog entries for individual (non-organisation) teacher
// subscriptions — same shape and role as OrganizationPlan, kept as a
// separate model because pricing/duration differ per audience (matches the
// existing convention of one model per plan audience, e.g. SubscriptionPlan
// for level/exam plans vs OrganizationPlan for organisation plans).
const IndividualPlanSchema = new mongoose.Schema({
  // 'free' is allowed here so the Free card on the pricing grid is editable
  // too — it is granted at signup, never purchased (the payment flow rejects
  // it), but its Lesson Planner quotas should be tunable like every other.
  tierKey: {
    type: String,
    enum: TIER_ORDER,
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  // Which product this plan sells. A teacher can be sold the Lesson Planner on
  // its own, the exam product on its own, or both in one plan — so the same
  // tier can exist at several price points with different scopes. Defaults to
  // 'both', which is what every plan created before this field existed grants.
  scope: {
    type: String,
    enum: PLAN_SCOPES,
    default: DEFAULT_PLAN_SCOPE
  },
  // One-line pitch under the plan name on the pricing grid
  // ("Best for individual teachers who create resources every week").
  description: {
    type: String,
    trim: true,
    default: ''
  },
  // Marks the card the grid highlights. Not enforced to be unique — the
  // pricing grid highlights every plan carrying it, which is what an admin
  // running two promotions at once would expect.
  isPopular: {
    type: Boolean,
    default: false
  },
  badgeText: {
    type: String,
    trim: true,
    default: 'MOST POPULAR'
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
  // Lesson Planner monthly output quotas (see PLANNER_QUOTA_FIELDS). Null
  // inherits the tier default from config/plans.js; -1 is unlimited.
  lessonPlansPerMonth: { type: Number, default: null },
  slidesPerMonth: { type: Number, default: null },
  exercisesPerMonth: { type: Number, default: null },
  schemesPerMonth: { type: Number, default: null },
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
  docxExport: { type: Boolean, default: null },
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
IndividualPlanSchema.index({ scope: 1, status: 1 });
IndividualPlanSchema.index({ status: 1, price: 1 });

IndividualPlanSchema.statics.getActivePlans = async function() {
  return this.find({ status: 'active' }).sort({ price: 1 });
};

IndividualPlanSchema.virtual('formattedPrice').get(function() {
  return `${this.price.toLocaleString()} ${this.currency}`;
});

module.exports = mongoose.model('IndividualPlan', IndividualPlanSchema);
