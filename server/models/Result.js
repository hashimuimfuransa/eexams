const mongoose = require('mongoose');

const ResultSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  exam: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Exam',
    required: true
  },
  startTime: {
    type: Date,
    required: true,
    default: Date.now
  },
  endTime: {
    type: Date
  },
  isCompleted: {
    type: Boolean,
    default: false
  },
  answers: [{
    question: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question',
      required: true
    },
    selectedOption: {
      type: String // For multiple choice - stores the text of the selected option
    },
    selectedOptionLetter: {
      type: String // For multiple choice - stores the letter (A, B, C, D) of the selected option
    },
    correctOptionLetter: {
      type: String // For multiple choice - stores the letter of the correct option
    },
    textAnswer: {
      type: String // For open-ended
    },
    isCorrect: {
      type: Boolean
    },
    score: {
      type: Number,
      default: 0
    },
    feedback: {
      type: String // AI feedback for open-ended questions
    },
    correctedAnswer: {
      type: mongoose.Schema.Types.Mixed // Correct answer for reference (can be string or object)
    },
    isSelected: {
      type: Boolean,
      default: true // By default, all questions are selected
    },
    // For matching questions
    matchingAnswers: [{
      left: Number,
      right: Number,
      _id: false
    }],
    // For ordering questions
    orderingAnswer: [Number],
    // For drag-drop questions
    dragDropAnswer: [{
      item: Number,
      zone: Number,
      _id: false
    }],
    // For multi-part questions
    subAnswers: [{
      selectedOption: String,
      textAnswer: String,
      isCorrect: Boolean,
      score: Number
    }],
    // For sub-question answers (fill-in-blank, multiple-choice within a question)
    subQuestionAnswers: [{
      answered: Boolean,
      answeredAt: Date,
      selectedOption: String,
      textAnswer: String,
      questionType: String
    }],
    hasSubQuestionAnswers: {
      type: Boolean,
      default: false
    },
    answered: {
      type: Boolean,
      default: false
    },
    // Answer metadata
    timeSpent: {
      type: Number, // in seconds
      default: 0
    },
    attempts: {
      type: Number,
      default: 1
    },
    confidence: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    },
    // Grading method tracking
    gradingMethod: {
      type: String,
      enum: [
        'enhanced_grading',
        'enhanced_ai_grading',
        'enhanced_ai',
        'semantic_match',
        'direct_comparison',
        'keyword_matching',
        'default_fallback',
        'background_ai_grading',
        'manual_grading',
        'ai_grading',
        'regrade_ai_grading',
        'admin_regrade',
        'ai_assisted',
        'predefined',
        'error_fallback',
        'fallback',
        'no_answer',
        'fallback_no_answer',
        'fallback_no_model',
        'fallback_exact_match',
        'fallback_exact_match_cleaned',
        'fallback_abbreviation_match',
        'fallback_expansion_match',
        'fallback_semantic_match',
        'fallback_keyword_matching',
        'groq_ai',
        'not_selected',
        // New fast grading methods
        'fast_grading',
        'fast_multiple_choice',
        'fast_ai_grading',
        'fast_similarity',
        'fast_keywords',
        'no_selection',
        'incomplete_multipart',
        'incomplete_multipart_fallback',
        'answer_validation_failed',
        'unsupported_type',
        'fallback_error',
        'exact_match',
        'error',
        // Enhanced AI grading for sections (generic, works for any section)
        'enhanced_ai_grading_section',
        'letter_comparison_failed',
        'letter_comparison',
        'matching_grading',
        'ordering_grading',
        'drag_drop_grading',
        // Sub-question grading
        'sub_question_grading',
        // AI-determined grading methods
        'ai_determined_correct',
        'ai_determined_incorrect',
        // Numerical and keyword matching methods
        'numerical_match',
        'numerical_partial',
        'numerical_mismatch',
        'keyword_matching_poor',
        'meaningless_answer',
        'meaningless_answer_short',
        'meaningless_answer_fallback',
        'ai_no_model_answer',
        'default_fallback_insufficient',
        'letter_based',
        'isCorrect_flag',
        'modelAnswer_comparison',
        'spreadsheet_manual_grading'
      ],
      default: 'enhanced_grading'
    },
    // Enhanced AI grading fields for sections B & C
    conceptsPresent: [{
      type: String // Key concepts identified in the answer
    }],
    conceptsMissing: [{
      type: String // Key concepts missing from the answer
    }],
    improvementSuggestions: [{
      type: String // Specific suggestions for improvement
    }],
    technicalAccuracy: {
      type: String // Assessment of technical correctness
    },
    confidenceLevel: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    },
    partialCreditBreakdown: {
      accuracy: { type: Number, default: 0 },
      completeness: { type: Number, default: 0 },
      understanding: { type: Number, default: 0 },
      clarity: { type: Number, default: 0 }
    }
  }],
  totalScore: {
    type: Number,
    default: 0
  },
  maxPossibleScore: {
    type: Number,
    required: true
  },
  aiGradingStatus: {
    type: String,
    enum: ['pending', 'in-progress', 'completed', 'failed'],
    default: 'pending'
  },
  // AI-generated overall study recommendation, computed once (lazily, on first
  // detail-view fetch) and cached here so repeat views don't re-call the AI.
  overallRecommendation: {
    headline: { type: String },
    tone: { type: String, enum: ['success', 'warning', 'error'] },
    focusAreas: [{
      name: { type: String },
      pct: { type: Number },
      _id: false
    }],
    topConcepts: [{ type: String }],
    tips: [{ type: String }],
    generatedAt: { type: Date }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Performance indexes for common query patterns
ResultSchema.index({ student: 1, exam: 1, isCompleted: 1 }); // For finding student's exam results
ResultSchema.index({ exam: 1, isCompleted: 1 }); // For getting all results for an exam
ResultSchema.index({ student: 1, createdAt: -1 }); // For student's result history
ResultSchema.index({ aiGradingStatus: 1 }); // For AI grading queue processing
ResultSchema.index({ createdAt: -1 }); // For recent results

module.exports = mongoose.model('Result', ResultSchema);
