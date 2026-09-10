const mongoose = require('mongoose');

// Teacher tool telemetry — one document per interaction with a teacher tool.
//
// Why this exists separately from LessonPlan/PlannerResource: those collections
// only hold what a teacher chose to KEEP. A teacher who generates six slide
// decks with AI and saves none of them looks completely idle in the saved
// libraries, and that is exactly the usage the platform pays Groq for and that
// super admins need to see. Every draft, export, refusal and failure is
// recorded here the moment it happens, whether or not it ever becomes a row in
// a library table.
//
// Why not ActivityLog: that log is an audit trail of administrative acts
// (blocked a user, deleted an exam) keyed on a closed `action` enum, read as a
// human-readable feed. Tool usage is high-volume metering with a different
// shape (tool + action + outcome + how long the model took) that gets
// aggregated, not read line by line. Mixing them would bloat the audit feed
// with hundreds of AI drafts and force every aggregation to filter around it.

// The tool registry. `group` drives how the super admin dashboard buckets a
// tool ('planner' = Lesson Planner studio, 'exam' = exam builder AI helpers),
// and `quotaKind` links a planner tool back to the PlannerResource `kind` /
// LessonPlan collection it produces, so saved-vs-generated can be compared.
const TOOLS = {
  lesson_plan:         { label: 'Lesson Plans',        group: 'planner', quotaKind: 'lessonPlan' },
  slides:              { label: 'Slide Decks',         group: 'planner', quotaKind: 'slides' },
  exercises:           { label: 'Exercise Sheets',     group: 'planner', quotaKind: 'exercises' },
  scheme:              { label: 'Schemes of Work',     group: 'planner', quotaKind: 'scheme' },
  reference_extract:   { label: 'Reference Upload',    group: 'planner', quotaKind: null },
  exam_ai_generate:    { label: 'AI Exam Generator',   group: 'exam',    quotaKind: null },
  exam_ai_question:    { label: 'AI Question Assist',  group: 'exam',    quotaKind: null },
  exam_ai_spreadsheet: { label: 'AI Spreadsheet Fill', group: 'exam',    quotaKind: null },
  exam_ai_chat:        { label: 'AI Teaching Chat',    group: 'exam',    quotaKind: null },
  exam_reference:      { label: 'Exam Reference Read', group: 'exam',    quotaKind: null }
};

const TOOL_KEYS = Object.keys(TOOLS);

// What the teacher did with the tool. `generate` is the one that answers "they
// used it even if nothing was saved"; `save` is the subset that became a
// library row. Keeping them as separate events (rather than a `saved` flag on
// the generation) is deliberate: a teacher can save a plan they wrote by hand,
// re-save an AI draft after heavy editing, or export a draft without ever
// saving it, and each of those is a distinct thing to count.
const ACTIONS = {
  generate: { label: 'Generated with AI' },
  save:     { label: 'Saved' },
  update:   { label: 'Edited' },
  export:   { label: 'Downloaded' },
  delete:   { label: 'Deleted' },
  extract:  { label: 'Reference read' }
};

const ACTION_KEYS = Object.keys(ACTIONS);

// success = the teacher got what they asked for; blocked = the platform
// refused (monthly allowance spent, plan does not include the tool), which is
// an upsell signal rather than a fault; failed = the AI or the server broke,
// which is a reliability signal. All three are usage.
const STATUSES = ['success', 'blocked', 'failed'];

const ToolUsageSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  // Denormalised so an organisation's tool usage can be aggregated without
  // joining back to User — mirrors PlannerResource.orgAdminId.
  orgAdminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true
  },
  // Kept on the event because a teacher can later be deleted, change role, or
  // move organisation, and a usage report for last quarter should still say
  // who produced it.
  userRole: { type: String, default: '' },
  organization: { type: String, default: '' },

  tool: { type: String, enum: TOOL_KEYS, required: true },
  action: { type: String, enum: ACTION_KEYS, required: true },
  status: { type: String, enum: STATUSES, default: 'success' },

  // Export format ('pdf' | 'docx' | 'pptx') — only set on `export` events.
  format: { type: String, default: '' },

  // Enough of the subject matter to make a usage row readable in the admin UI
  // without loading the underlying document (which may since have been deleted).
  title: { type: String, trim: true, default: '' },
  subject: { type: String, trim: true, default: '' },
  className: { type: String, trim: true, default: '' },

  // Set on save/update/export of something in a library; null for pure drafts,
  // which is precisely what makes an unsaved generation identifiable.
  resource: { type: mongoose.Schema.Types.ObjectId, default: null },

  // How long the AI call took, for spotting slow/failing models.
  durationMs: { type: Number, default: 0 },

  // Free-form: refusal code and remaining allowance on a `blocked` event, the
  // error message on a `failed` one, file name and size on an extract, etc.
  meta: { type: Object, default: {} }
}, { timestamps: true });

// The three shapes every report uses: one teacher's timeline, one tool's
// volume over a period, and the platform-wide feed.
ToolUsageSchema.index({ user: 1, createdAt: -1 });
ToolUsageSchema.index({ tool: 1, action: 1, createdAt: -1 });
ToolUsageSchema.index({ createdAt: -1 });

module.exports = mongoose.model('ToolUsage', ToolUsageSchema);
module.exports.TOOLS = TOOLS;
module.exports.TOOL_KEYS = TOOL_KEYS;
module.exports.ACTIONS = ACTIONS;
module.exports.ACTION_KEYS = ACTION_KEYS;
module.exports.STATUSES = STATUSES;
