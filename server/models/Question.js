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
    enum: ['multiple-choice', 'open-ended', 'true-false', 'fill-blank', 'fill-in-blank', 'short-answer', 'essay', 'extended-response', 'matching', 'ordering', 'drag-drop', 'image-based', 'image', 'structured', 'financial-spreadsheet', 'table-completion'],
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
      enum: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii']
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
    required: true
  },
  // For matching questions - support both strings and objects
  matchingPairs: {
    leftColumn: [{
      type: mongoose.Schema.Types.Mixed,
      default: null
    }],
    rightColumn: [{
      type: mongoose.Schema.Types.Mixed,
      default: null
    }],
    correctPairs: [{
      left: mongoose.Schema.Types.Mixed,
      right: mongoose.Schema.Types.Mixed,
      _id: false
    }]
  },
  // New structure for matching questions (from pasted exams) - support both strings and objects
  leftItems: [{
    type: mongoose.Schema.Types.Mixed,
    default: null
  }],
  rightItems: [{
    type: mongoose.Schema.Types.Mixed,
    default: null
  }],
  correctMatches: {
    type: Map,
    of: Number
  },
  // For fill-in-blank questions with word banks
  wordBank: [String],
  // For comprehension questions with passages
  passage: String,
  // For hierarchical exam structure
  subsectionTitle: String,
  subsection: String,
  instructions: String,
  sectionTitle: String,
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
    label: String, // e.g., "a)", "b)", "i)", "ii)"
    text: String,
    type: {
      type: String,
      enum: ['multiple-choice', 'open-ended', 'true-false', 'fill-blank', 'fill-in-blank', 'short-answer', 'essay', 'extended-response', 'matching', 'ordering', 'drag-drop', 'image-based', 'image', 'structured', 'financial-spreadsheet', 'table-completion']
    },
    options: [{
      text: String,
      isCorrect: Boolean,
      letter: String
    }],
    correctAnswer: String,
    points: Number,
    imageUrl: String // For image-based sub-questions
  }],
  // Sub-question configuration
  subQuestionConfig: {
    // Mode: 'all' (answer all), 'choose-n' (select N to answer)
    mode: {
      type: String,
      enum: ['all', 'choose-n'],
      default: 'all'
    },
    // Number of sub-questions student must select (when mode is 'choose-n')
    requiredCount: {
      type: Number,
      default: 1,
      min: 1
    },
    // Scoring type: 'all-or-nothing' (all correct for full marks) or 'partial' (proportional)
    scoringType: {
      type: String,
      enum: ['all-or-nothing', 'partial'],
      default: 'partial'
    }
  },
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
  spreadsheetTemplate: {
    type: String,
    default: ''
  },
  spreadsheetModelAnswer: {
    type: String,
    default: ''
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

// Performance indexes for common query patterns
QuestionSchema.index({ exam: 1, section: 1 }); // For getting questions by exam and section
QuestionSchema.index({ exam: 1, type: 1 }); // For filtering by exam and question type
QuestionSchema.index({ createdBy: 1, createdAt: -1 }); // For getting user's questions
QuestionSchema.index({ type: 1, difficulty: 1 }); // For filtering by type and difficulty
QuestionSchema.index({ tags: 1 }); // For tag-based searches
QuestionSchema.index({ text: 'text' }); // For text search

module.exports = mongoose.model('Question', QuestionSchema);
