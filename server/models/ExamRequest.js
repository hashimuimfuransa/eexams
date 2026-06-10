const mongoose = require('mongoose');

const ExamRequestSchema = new mongoose.Schema({
  // The exam being requested
  exam: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Exam',
    required: true
  },
  // Backup exam title (in case exam is deleted)
  examTitle: {
    type: String,
    default: null
  },
  // The teacher who published the exam
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // The authenticated student user (if applicable)
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  // User information (for non-authenticated users or as backup)
  userInfo: {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: false, // Made optional to support phone-only users
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
  // Whether this is a retake request
  isRetake: {
    type: Boolean,
    default: false
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
ExamRequestSchema.index({ student: 1, status: 1 });
ExamRequestSchema.index({ 'userInfo.email': 1 });
ExamRequestSchema.index({ accessCode: 1 });

module.exports = mongoose.model('ExamRequest', ExamRequestSchema);
