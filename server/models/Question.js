const mongoose = require('mongoose');

// Canonical set of question types the rest of the app knows how to render/grade.
// AI document extraction sometimes hallucinates a topic/subject (e.g. "algebra",
// "numerical") into this field instead of a real question type. normalizeQuestionType()
// catches anything outside this list before Mongoose's enum validator would otherwise
// reject the whole save.
const VALID_QUESTION_TYPES = ['multiple-choice', 'open-ended', 'true-false', 'fill-blank', 'fill-in-blank', 'short-answer', 'essay', 'extended-response', 'matching', 'ordering', 'drag-drop', 'image-based', 'image', 'structured', 'financial-spreadsheet', 'table-completion', 'numerical'];

function normalizeQuestionType(value) {
  if (VALID_QUESTION_TYPES.includes(value)) return value;
  console.warn(`Unrecognized question type "${value}" - defaulting to "open-ended"`);
  return 'open-ended';
}

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
    enum: VALID_QUESTION_TYPES,
    set: normalizeQuestionType,
    required: true
  },
  imageUrl: {
    type: String,
    default: ''
  },
  // Multiple reference images (e.g. several transaction screenshots or a long document split
  // into parts). imageUrl above is kept for backward compatibility with existing questions;
  // when imageUrls has entries it takes precedence for display.
  imageUrls: [{
    type: String
  }],
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
  // "Select all that apply" multiple-choice: more than one option is correct and the student
  // ticks every one they think belongs. Off by default so existing single-answer questions keep
  // their radio-button behaviour. Detection at grading time also treats any question with two or
  // more options flagged isCorrect as a multi-answer question, so papers imported/extracted with
  // several correct options are graded properly even without this flag set.
  allowMultipleAnswers: {
    type: Boolean,
    default: false
  },
  // How a multi-answer question is marked:
  //  'partial'        - credit per correct option ticked, minus one option's worth per wrong tick
  //  'all-or-nothing' - full marks only when the selection matches the key exactly
  multipleAnswerScoring: {
    type: String,
    enum: ['partial', 'all-or-nothing'],
    default: 'partial'
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
      enum: VALID_QUESTION_TYPES,
      set: normalizeQuestionType
    },
    options: [{
      text: String,
      isCorrect: Boolean,
      letter: String
    }],
    // Same "select all that apply" support as the top-level fields above, per sub-question.
    allowMultipleAnswers: Boolean,
    multipleAnswerScoring: {
      type: String,
      enum: ['partial', 'all-or-nothing']
    },
    correctAnswer: String,
    points: Number,
    imageUrl: String, // For image-based sub-questions (legacy single-image field)
    imageUrls: [String], // Multiple reference images for a sub-question; takes precedence over imageUrl when present
    spreadsheetTemplate: String, // For financial-spreadsheet sub-questions - same JSON-string shape as the top-level field
    spreadsheetModelAnswer: String,
    // Same optional written-answer-alongside-the-spreadsheet support as the top-level fields above
    requiresWrittenAnswer: Boolean,
    writtenAnswerPrompt: String,
    writtenAnswerModelAnswer: String,
    writtenAnswerPoints: Number
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
  // Optional written/explanatory answer alongside a financial-spreadsheet question (e.g. "also
  // comment on why gross profit changed") — graded separately from the spreadsheet cells and
  // combined into one score. writtenAnswerPoints is taken out of the question's own `points`;
  // the remainder goes to the spreadsheet portion.
  requiresWrittenAnswer: {
    type: Boolean,
    default: false
  },
  writtenAnswerPrompt: {
    type: String,
    default: ''
  },
  writtenAnswerModelAnswer: {
    type: String,
    default: ''
  },
  writtenAnswerPoints: {
    type: Number,
    default: 0
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
// Exported so the AI-generation/extraction paths can recognise a type that is already canonical
// instead of running it through their keyword mapper (which turns "numerical" and
// "extended-response" - both perfectly valid here - into "multiple-choice").
module.exports.VALID_QUESTION_TYPES = VALID_QUESTION_TYPES;
