const mongoose = require('mongoose');

const ExamRequestSchema = new mongoose.Schema({
  // The exam being requested
  exam: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Exam',
    required: true
  },
  // The teacher who published the exam
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // User information (for non-authenticated users)
  userInfo: {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      trim: true
    },
    phone: {
      type: String,
      trim: true
    }
  },
  // Request status
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  // Payment amount set by teacher
  amount: {
    type: Number,
    default: 0
  },
  // Payment status
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'waived'],
    default: 'pending'
  },
  // When the request was made
  requestedAt: {
    type: Date,
    default: Date.now
  },
  // When the request was approved/rejected
  processedAt: {
    type: Date,
    default: null
  },
  // Notes from teacher (rejection reason, etc.)
  teacherNotes: {
    type: String,
    default: null
  },
  // If approved, the share token to access the exam
  shareToken: {
    type: String,
    default: null
  },
  // If approved, the access code to enter the exam
  accessCode: {
    type: String,
    default: null
  },
  // Track if the access code has been used (exam completed)
  accessCodeUsed: {
    type: Boolean,
    default: false
  },
  // If approved, the SharedExam reference
  sharedExam: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SharedExam',
    default: null
  }
});

// Index for efficient queries
ExamRequestSchema.index({ exam: 1, status: 1 });
ExamRequestSchema.index({ teacher: 1, status: 1 });
ExamRequestSchema.index({ 'userInfo.email': 1 });
ExamRequestSchema.index({ accessCode: 1 });

module.exports = mongoose.model('ExamRequest', ExamRequestSchema);
