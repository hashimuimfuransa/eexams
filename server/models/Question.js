const mongoose = require('mongoose');

const QuestionSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['multiple-choice', 'open-ended', 'true-false', 'fill-in-blank', 'matching', 'ordering', 'drag-drop'],
    required: true
  },
  options: [{
    text: {
      type: String,
      required: true
    },
    isCorrect: {
      type: Boolean,
      default: false
    },
    letter: {
      type: String,
      enum: ['A', 'B', 'C', 'D', 'a', 'b', 'c', 'd']
    },
    value: {
      type: String
    }
  }],
  correctAnswer: {
    type: String, // For open-ended questions, this is the model answer
    default: 'Not provided' // Make it not required with a default value
  },
  points: {
    type: Number,
    required: true,
    default: 1
  },
  exam: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Exam',
    required: true
  },
  section: {
    type: String,
    enum: ['A', 'B', 'C'],
    required: true
  },
  // For matching questions
  matchingPairs: {
    leftColumn: [String],
    rightColumn: [String],
    correctPairs: [{
      left: Number,
      right: Number
    }]
  },
  // For ordering questions
  itemsToOrder: {
    items: [String],
    correctOrder: [Number]
  },
  // For drag-drop questions
  dragDropData: {
    dropZones: [String],
    draggableItems: [String],
    correctPlacements: [{
      item: Number,
      zone: Number
    }]
  },
  // For multi-part questions
  subQuestions: [{
    text: String,
    type: {
      type: String,
      enum: ['multiple-choice', 'open-ended', 'true-false', 'fill-in-blank']
    },
    options: [{
      text: String,
      isCorrect: Boolean,
      letter: String
    }],
    correctAnswer: String,
    points: Number
  }],
  // Question metadata
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium'
  },
  tags: [String],
  estimatedTime: {
    type: Number, // in minutes
    default: 2
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Question', QuestionSchema);
