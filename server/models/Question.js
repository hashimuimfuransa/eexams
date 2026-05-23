const mongoose = require('mongoose');

const QuestionSchema = new mongoose.Schema({
  text: {
    type: String,
    required: function() {
      // Text is required unless the question has an imageUrl (for image-based questions)
      return !this.imageUrl;
    }
  },
  type: {
    type: String,
    enum: ['multiple-choice', 'open-ended', 'true-false', 'fill-blank', 'fill-in-blank', 'short-answer', 'matching', 'ordering', 'drag-drop', 'image-based', 'image'],
    required: true
  },
  imageUrl: {
    type: String,
    default: ''
  },
  options: [{
    text: {
      type: String,
      required: function() {
        // Only require text if the question type needs options
        return ['multiple-choice', 'true-false'].includes(this.type);
      }
    },
    isCorrect: {
      type: Boolean,
      default: false
    },
    letter: {
      type: String,
      enum: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
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
      left: String,
      right: String
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
  // Additional fields for AI grading and detailed answers
  explanation: {
    type: String,
    default: ''
  },
  answerKey: {
    type: String,
    default: ''
  },
  gradingCriteria: [{
    criteria: {
      type: String
    },
    points: {
      type: Number,
      default: 1
    }
  }],
  keyPoints: [String],
  acceptableAnswers: [String],
  marks: {
    type: Number,
    default: 1
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Question', QuestionSchema);
