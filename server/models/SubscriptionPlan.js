const mongoose = require('mongoose');

const SubscriptionPlanSchema = new mongoose.Schema({
  level: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Level',
    required: false
  },
  // Optional: scope a level-based plan to one sub-level within that level
  // (matches Level.subLevels[].name). Null/unset means the plan covers the
  // whole level, including all of its sub-levels.
  subLevel: {
    type: String,
    default: null
  },
  exam: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Exam',
    required: false
  },
  planType: {
    type: String,
    enum: ['level', 'exam'],
    required: true,
    default: 'level'
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

// Update updatedAt on save
SubscriptionPlanSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Index for faster queries
SubscriptionPlanSchema.index({ level: 1, status: 1 });
SubscriptionPlanSchema.index({ exam: 1, status: 1 });
SubscriptionPlanSchema.index({ planType: 1, status: 1 });
SubscriptionPlanSchema.index({ status: 1, price: 1 });

// Static method to get active plans for a level, optionally scoped to a
// sub-level. Returns level-wide plans (subLevel: null) PLUS plans matching
// the given sub-level — but not plans scoped to a *different* sub-level.
SubscriptionPlanSchema.statics.getActivePlansForLevel = async function(levelId, subLevel = null) {
  const query = { level: levelId, status: 'active', planType: 'level' };
  query.$or = subLevel
    ? [{ subLevel: null }, { subLevel: subLevel }]
    : [{ subLevel: null }];
  return this.find(query).sort({ durationDays: 1 });
};

// Static method to get active plans for an exam
SubscriptionPlanSchema.statics.getActivePlansForExam = async function(examId) {
  return this.find({ exam: examId, status: 'active', planType: 'exam' }).sort({ durationDays: 1 });
};

// Virtual for formatted price
SubscriptionPlanSchema.virtual('formattedPrice').get(function() {
  return `${this.price.toLocaleString()} ${this.currency}`;
});

module.exports = mongoose.model('SubscriptionPlan', SubscriptionPlanSchema);
