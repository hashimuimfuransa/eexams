const mongoose = require('mongoose');

const LevelSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  description: {
    type: String,
    default: null
  },
  displayOrder: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  usageCount: {
    type: Number,
    default: 0
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
LevelSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Static method to find or create level
LevelSchema.statics.findOrCreate = async function(name, userId) {
  const trimmedName = name.trim();
  let level = await this.findOne({ name: { $regex: new RegExp(`^${trimmedName}$`, 'i') } });
  
  if (!level) {
    level = await this.create({
      name: trimmedName,
      createdBy: userId
    });
  }
  
  return level;
};

// Increment usage count
LevelSchema.methods.incrementUsage = async function() {
  this.usageCount += 1;
  await this.save();
};

module.exports = mongoose.model('Level', LevelSchema);
