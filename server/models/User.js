const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    index: true // Add index for faster login lookups
  },
  password: {
    type: String,
    required: function() {
      // Password required only for non-OAuth users
      return !this.googleId;
    }
  },
  // Google OAuth fields
  googleId: {
    type: String,
    unique: true,
    sparse: true, // Allows null/undefined values while maintaining uniqueness
    index: true
  },
  googleProfilePicture: {
    type: String,
    default: null
  },
  isGoogleUser: {
    type: Boolean,
    default: false
  },
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },

  phone: {
    type: String,
    trim: true
  },
  role: {
    type: String,
    enum: ['admin', 'teacher', 'student'],
    default: 'teacher' // Default for individual teacher registration
  },
  // User type: individual or organization-based
  userType: {
    type: String,
    enum: ['individual', 'organization'],
    default: 'individual' // Default to individual teacher
  },
  class: {
    type: String,
    trim: true
  },
  organization: {
    type: String,
    trim: true,
    required: function() {
      // Organization is required for organization-based accounts
      return this.userType === 'organization' || this.role === 'admin';
    }
  },
  // For teachers: the parent admin (organization) who created them
  parentAdmin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  // For organizations: subscription plan details
  subscriptionPlan: {
    type: String,
    enum: ['free', 'basic', 'premium', 'enterprise'],
    default: null
  },
  subscriptionStatus: {
    type: String,
    enum: ['active', 'pending', 'expired', 'cancelled'],
    default: null
  },
  subscriptionExpiresAt: {
    type: Date,
    default: null
  },
  lastLogin: {
    type: Date,
    default: null
  },
  deviceId: {
    type: String,
    default: null
  },
  isBlocked: {
    type: Boolean,
    default: false
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Hash password before saving - optimized for faster login
UserSchema.pre('save', async function(next) {
  // Skip password hashing for Google OAuth users or if password not modified
  if (!this.isModified('password') || !this.password) {
    return next();
  }

  try {
    // Reduced salt rounds from 10 to 8 for faster password comparison
    // Still secure but significantly faster for login operations
    const salt = await bcrypt.genSalt(8);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords
UserSchema.methods.comparePassword = async function(candidatePassword) {
  // Google OAuth users don't have passwords
  if (!this.password) {
    return false;
  }
  return await bcrypt.compare(candidatePassword, this.password);
};

// Virtual for fullName
UserSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`.trim();
});

module.exports = mongoose.model('User', UserSchema);
