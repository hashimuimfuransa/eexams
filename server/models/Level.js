const mongoose = require('mongoose');

const SubLevelSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
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
  }
}, { _id: true });

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
  // Optional sub-levels (e.g., P1-P6 under Primary, S1-S6 under Secondary)
  subLevels: [SubLevelSchema],
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

// Add a sub-level
LevelSchema.methods.addSubLevel = async function(subLevelData) {
  // Check if sub-level with same name already exists
  const existingSub = this.subLevels.find(
    s => s.name.toLowerCase() === subLevelData.name.toLowerCase()
  );
  if (existingSub) {
    throw new Error('Sub-level with this name already exists');
  }
  
  this.subLevels.push(subLevelData);
  await this.save();
  return this.subLevels[this.subLevels.length - 1];
};

// Update a sub-level
LevelSchema.methods.updateSubLevel = async function(subLevelId, updateData) {
  const subLevel = this.subLevels.id(subLevelId);
  if (!subLevel) {
    throw new Error('Sub-level not found');
  }
  
  if (updateData.name !== undefined) subLevel.name = updateData.name;
  if (updateData.description !== undefined) subLevel.description = updateData.description;
  if (updateData.displayOrder !== undefined) subLevel.displayOrder = updateData.displayOrder;
  if (updateData.isActive !== undefined) subLevel.isActive = updateData.isActive;
  
  await this.save();
  return subLevel;
};

// Remove a sub-level
LevelSchema.methods.removeSubLevel = async function(subLevelId) {
  const subLevel = this.subLevels.id(subLevelId);
  if (!subLevel) {
    throw new Error('Sub-level not found');
  }
  
  subLevel.remove();
  await this.save();
  return true;
};

// Get all active sub-levels sorted by displayOrder
LevelSchema.methods.getActiveSubLevels = function() {
  return this.subLevels
    .filter(s => s.isActive)
    .sort((a, b) => a.displayOrder - b.displayOrder);
};

module.exports = mongoose.model('Level', LevelSchema);
