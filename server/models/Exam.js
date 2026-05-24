const mongoose = require('mongoose');

const ExamSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  timeLimit: {
    type: Number, // in minutes
    required: true
  },
  passingScore: {
    type: Number,
    default: 70
  },
  isLocked: {
    type: Boolean,
    default: true
  },
  originalFile: {
    type: String, // path to the uploaded file
    default: null
  },
  answerFile: {
    type: String, // path to the answer file
    default: null
  },
  questionImages: [{
    originalName: String,
    filename: String,
    path: String,
    url: String
  }],
  scheduledFor: {
    type: Date,
    default: null
  },
  startTime: {
    type: Date,
    default: null
  },
  endTime: {
    type: Date,
    default: null
  },
  assignedTo: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  allowLateSubmission: {
    type: Boolean,
    default: false
  },
  allowSelectiveAnswering: {
    type: Boolean,
    default: false
  },
  allowRetake: {
    type: Boolean,
    default: false
  },
  sectionBRequiredQuestions: {
    type: Number,
    default: 3
  },
  sectionCRequiredQuestions: {
    type: Number,
    default: 1
  },
  status: {
    type: String,
    enum: ['draft', 'scheduled', 'active', 'completed', 'template'],
    default: 'draft'
  },
  totalPoints: {
    type: Number,
    default: 0
  },
  // Public publishing settings
  isPubliclyListed: {
    type: Boolean,
    default: false
  },
  publicPrice: {
    type: Number,
    default: 0
  },
  publicDescription: {
    type: String,
    default: null
  },
  targetAudience: {
    type: String,
    default: null
  },
  level: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Level',
    default: null
  },
  subLevel: {
    type: String, // Stores the sub-level name (e.g., "P6", "S3")
    default: null
  },
  sections: [{
    name: {
      type: String,
      required: true
    },
    description: {
      type: String
    },
    questionCount: {
      type: Number,
      default: 0
    },
    questions: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question'
    }]
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Performance indexes for common query patterns
ExamSchema.index({ createdBy: 1, createdAt: -1 }); // For getting user's exams sorted by date
ExamSchema.index({ status: 1, isLocked: 1 }); // For filtering by status and lock state
ExamSchema.index({ assignedTo: 1 }); // For finding exams assigned to students
ExamSchema.index({ isPubliclyListed: 1, status: 1 }); // For public exam listings
ExamSchema.index({ level: 1, subLevel: 1 }); // For filtering by education level
ExamSchema.index({ createdAt: -1 }); // For recent exams
ExamSchema.index({ title: 'text', description: 'text' }); // For text search

module.exports = mongoose.model('Exam', ExamSchema);
