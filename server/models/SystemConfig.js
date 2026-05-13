const mongoose = require('mongoose');

const SystemConfigSchema = new mongoose.Schema({
  isLocked: {
    type: Boolean,
    default: false,
    required: true
  },
  lockMessage: {
    type: String,
    default: 'The system is currently locked. Only exams are accessible.'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Ensure only one system config document exists
SystemConfigSchema.statics.getConfig = async function() {
  const config = await this.findOne();
  if (config) {
    return config;
  }
  
  // Create default config if none exists
  return await this.create({ isLocked: false });
};

module.exports = mongoose.model('SystemConfig', SystemConfigSchema);
