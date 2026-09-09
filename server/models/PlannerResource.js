const mongoose = require('mongoose');
const { THEME_KEYS, DEFAULT_THEME, LAYOUT_KEYS } = require('../utils/slideThemes');

// The Lesson Planner's non-lesson-plan outputs: slide decks, exercise sheets
// and schemes of work — the three things the pricing grid sells alongside
// lesson plans (see PLANNER_QUOTA_FIELDS in utils/planLimits.js).
//
// One collection with a `kind` discriminator rather than three near-identical
// models: they share the whole lifecycle (AI draft → teacher edits → save →
// export), and the monthly quota counters are then a single countDocuments
// with a different `kind`, which is exactly how they are billed.
//
// `content` is deliberately a per-kind sub-shape rather than one flattened
// schema — a slide has bullets and speaker notes, an exercise item has options
// and an answer, a scheme row has a week number. Forcing them into shared
// fields would make every consumer guess which ones are meaningful.

const SlideSchema = new mongoose.Schema({
  // Which of the designed layouts in utils/slidesPptx.js renders this slide.
  // A closed set: an unknown value falls back to 'bullets' at render time
  // rather than producing a blank slide.
  layout: { type: String, enum: LAYOUT_KEYS, default: 'bullets' },
  // Small caps label above the heading ("OBJECTIVES", "PRACTICE").
  eyebrow: { type: String, trim: true, default: '' },
  heading: { type: String, trim: true, default: '' },
  bullets: { type: [String], default: [] },
  // 'compare' layout only — the two panel headings.
  columnLabels: { type: [String], default: [] },
  // 'image' layout only — what the teacher should drop into the placeholder.
  imageIdea: { type: String, trim: true, default: '' },
  // 'summary' layout only — printed in its own highlighted box.
  homework: { type: String, trim: true, default: '' },
  notes: { type: String, trim: true, default: '' }
}, { _id: false });

const ExerciseItemSchema = new mongoose.Schema({
  // Section this question belongs to ("A", "B") so a sheet prints as a real
  // paper with sections rather than one flat numbered run.
  section: { type: String, trim: true, default: '' },
  number: { type: String, trim: true, default: '' },
  question: { type: String, trim: true, default: '' },
  // Empty for open-response questions; populated for multiple choice.
  options: { type: [String], default: [] },
  answer: { type: String, trim: true, default: '' },
  marks: { type: String, trim: true, default: '' },
  // How much ruled space an open-response answer needs when printed.
  answerLines: { type: Number, default: 2 }
}, { _id: false });

// Section header printed above the questions belonging to it.
const ExerciseSectionSchema = new mongoose.Schema({
  label: { type: String, trim: true, default: '' },
  title: { type: String, trim: true, default: '' },
  instructions: { type: String, trim: true, default: '' }
}, { _id: false });

const SchemeWeekSchema = new mongoose.Schema({
  week: { type: String, trim: true, default: '' },
  lessonNo: { type: String, trim: true, default: '' },
  unitTitle: { type: String, trim: true, default: '' },
  lessonTitle: { type: String, trim: true, default: '' },
  objectives: { type: String, trim: true, default: '' },
  activities: { type: String, trim: true, default: '' },
  materials: { type: String, trim: true, default: '' },
  assessment: { type: String, trim: true, default: '' }
}, { _id: false });

const PlannerResourceSchema = new mongoose.Schema({
  kind: {
    type: String,
    enum: ['slides', 'exercises', 'scheme'],
    required: true
  },

  // Shared header fields — every kind is printed with the same identifying
  // block, and teachers filter their library by these.
  title: { type: String, trim: true, default: '' },
  subject: { type: String, trim: true, default: '' },
  className: { type: String, trim: true, default: '' },
  term: { type: String, trim: true, default: '' },
  schoolName: { type: String, trim: true, default: '' },
  teacherName: { type: String, trim: true, default: '' },
  academicYear: { type: String, trim: true, default: '' },
  unitTitle: { type: String, trim: true, default: '' },
  duration: { type: String, trim: true, default: '' },
  language: { type: String, trim: true, default: '' },

  // Slide deck visual theme (utils/slideThemes.js). Stored per deck so a
  // re-export months later looks identical to the one already handed out.
  theme: { type: String, enum: THEME_KEYS, default: DEFAULT_THEME },

  // Per-kind body. Only the branch matching `kind` is ever populated.
  slides: { type: [SlideSchema], default: [] },
  instructions: { type: String, trim: true, default: '' },
  sections: { type: [ExerciseSectionSchema], default: [] },
  items: { type: [ExerciseItemSchema], default: [] },
  totalMarks: { type: String, trim: true, default: '' },
  weeks: { type: [SchemeWeekSchema], default: [] },

  // Provenance, mirroring LessonPlan.
  sourcePrompt: { type: String, default: '' },
  sourceFileName: { type: String, default: '' },
  generatedByAI: { type: Boolean, default: false },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  // Org teachers' output belongs to the organisation, same as LessonPlan.
  orgAdminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true
  }
}, { timestamps: true });

// The monthly quota counter's exact query shape (createdBy + kind + a
// createdAt lower bound), so counting a teacher's usage stays an index scan.
PlannerResourceSchema.index({ createdBy: 1, kind: 1, createdAt: -1 });

module.exports = mongoose.model('PlannerResource', PlannerResourceSchema);
