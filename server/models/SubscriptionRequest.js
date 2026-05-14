const mongoose = require('mongoose');

const subscriptionRequestSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  requestedPlan: {
    type: String,
    enum: ['basic', 'premium', 'enterprise'],
    required: true
  },
  paymentMethod: {
    type: String,
    enum: ['momo', 'bank'],
    default: 'momo'
  },
  phoneNumber: {
    type: String,
    required: true
  },
  transactionId: {
    type: String,
    required: true
  },
  amountPaid: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  notes: {
    type: String,
    default: ''
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  processedAt: {
    type: Date,
    default: null
  },
  note: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Index for faster queries
subscriptionRequestSchema.index({ status: 1, createdAt: -1 });
subscriptionRequestSchema.index({ user: 1 });

module.exports = mongoose.model('SubscriptionRequest', subscriptionRequestSchema);
