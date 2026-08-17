const mongoose = require('mongoose');

// One teaching step of the lesson (Introduction / Lesson Development / Conclusion ...).
// Activities are stored as arrays of lines so the PDF renderer can bullet them and the
// editor can add/remove individual lines without string surgery.
const LessonStepSchema = new mongoose.Schema({
  name: {
    type: String,
    default: ''
  },
  duration: {
    type: String,
    default: ''
  },
  teacherActivities: {
    type: [String],
    default: []
  },
  learnerActivities: {
    type: [String],
    default: []
  },
  // "Generic competences and cross-cutting issues + some explanations" column
  competences: {
    type: [String],
    default: []
  }
}, { _id: false });

const LessonPlanSchema = new mongoose.Schema({
  // ── Identification header (School Name / Teacher's Name line) ──
  schoolName: { type: String, trim: true, default: '' },
  teacherName: { type: String, trim: true, default: '' },

  // ── Top info table: Term | Date | Subject | Class | Unit No | Lesson No | Duration | Class size ──
  term: { type: String, trim: true, default: '' },
  // Free text rather than Date: teachers write "2026-06-04", "04/06/2026" or a week range,
  // and the value is only ever printed, never queried by range.
  date: { type: String, trim: true, default: '' },
  subject: { type: String, trim: true, default: '' },
  className: { type: String, trim: true, default: '' },
  unitNo: { type: String, trim: true, default: '' },
  lessonNo: { type: String, trim: true, default: '' },
  duration: { type: String, trim: true, default: '' },
  classSize: { type: String, trim: true, default: '' },

  specialNeeds: { type: String, trim: true, default: 'None' },

  // ── Body rows ──
  unitTitle: { type: String, trim: true, default: '' },
  keyUnitCompetence: { type: String, trim: true, default: '' },
  lessonTitle: { type: String, trim: true, default: '' },
  instructionalObjectives: { type: String, trim: true, default: '' },
  location: { type: String, trim: true, default: 'Classroom' },
  learningMaterials: { type: String, trim: true, default: '' },
  references: { type: String, trim: true, default: '' },

  // Italic line that sits above the Teacher's/Learner's activity columns
  lessonOverview: { type: String, trim: true, default: '' },

  steps: { type: [LessonStepSchema], default: [] },

  selfEvaluation: { type: String, default: '' },

  // ── Provenance / bookkeeping ──
  language: { type: String, trim: true, default: '' },
  // What the teacher typed ("Unit 6, lesson 7 of 7 — évaluation de l'unité"), kept so a plan
  // can be regenerated or refined later without re-typing the brief.
  sourcePrompt: { type: String, default: '' },
  sourceFileName: { type: String, default: '' },
  generatedByAI: { type: Boolean, default: false },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  // Organisation admin this plan belongs to (own id for individual teachers), mirroring
  // attachOrgAdminId elsewhere — lets an org list its teachers' plans later without a migration.
  orgAdminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true
  }
}, { timestamps: true });

LessonPlanSchema.index({ createdBy: 1, updatedAt: -1 });

module.exports = mongoose.model('LessonPlan', LessonPlanSchema);
