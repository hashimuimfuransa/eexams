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
  sections: [{
    name: {
      type: String,
      required: true
    },
    description: {
      type: String
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

module.exports = mongoose.model('Exam', ExamSchema);
