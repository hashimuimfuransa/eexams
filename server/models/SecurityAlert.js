const mongoose = require('mongoose');

const SecurityAlertSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['multiple_device', 'suspicious_activity', 'browser_switch', 'ip_change', 'unauthorized_access'],
    required: true
  },
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  exam: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Exam'
  },
  description: {
    type: String,
    required: true
  },
  details: {
    type: Object,
    default: {}
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['unresolved', 'resolved', 'ignored'],
    default: 'unresolved'
  },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  resolvedAt: {
    type: Date
  },
  notes: {
    type: String
  }
});

// Static method to create a new security alert
SecurityAlertSchema.statics.createAlert = async function(alertData) {
  try {
    const alert = new this(alertData);
    await alert.save();
    return alert;
  } catch (error) {
    console.error('Error creating security alert:', error);
    throw error;
  }
};

// Method to resolve an alert
SecurityAlertSchema.methods.resolve = async function(userId, notes) {
  this.status = 'resolved';
  this.resolvedBy = userId;
  this.resolvedAt = Date.now();
  if (notes) {
    this.notes = notes;
  }
  await this.save();
  return this;
};

// Method to ignore an alert
SecurityAlertSchema.methods.ignore = async function(userId, notes) {
  this.status = 'ignored';
  this.resolvedBy = userId;
  this.resolvedAt = Date.now();
  if (notes) {
    this.notes = notes;
  }
  await this.save();
  return this;
};

module.exports = mongoose.model('SecurityAlert', SecurityAlertSchema);
