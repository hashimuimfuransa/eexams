const mongoose = require('mongoose');
const { gradeLetter, gradeRemark, toPercentage, PASS_PERCENTAGE } = require('../utils/gradeScale');

/**
 * One subject line on a transcript. Marks are entered by hand by the school
 * admin, so grade/percentage are derived here rather than trusted from the client.
 */
const SubjectMarkSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  // Optional teacher-facing code, e.g. MAT101
  code: {
    type: String,
    trim: true,
    default: ''
  },
  marks: {
    type: Number,
    required: true,
    min: 0
  },
  maxMarks: {
    type: Number,
    required: true,
    min: 1,
    default: 100
  },
  // Weight when averaging subjects (credits/periods). 1 = evenly weighted.
  coefficient: {
    type: Number,
    default: 1,
    min: 0
  },
  percentage: { type: Number, default: 0 },
  grade: { type: String, default: '' },
  remark: { type: String, trim: true, default: '' },
  teacherName: { type: String, trim: true, default: '' }
}, { _id: true });

/**
 * A student's manually entered results for one term of one academic year.
 * The school admin creates these; the student reads them on /results with
 * nothing but their registration number.
 */
const AcademicRecordSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  // The organisation admin who owns this record (req.orgAdminId).
  school: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  // Snapshot of the school name at issue time — schools get renamed, printed
  // transcripts should not change retroactively.
  schoolName: {
    type: String,
    trim: true,
    default: ''
  },
  // Snapshot of the registration number, so a transcript stays findable even
  // if the student record is later edited.
  registrationNumber: {
    type: String,
    trim: true,
    uppercase: true,
    default: '',
    index: true
  },
  academicYear: {
    type: String,
    required: true,
    trim: true // e.g. "2025-2026"
  },
  term: {
    type: String,
    required: true,
    trim: true,
    default: 'Term 1'
  },
  // Class/level the student sat this term in, snapshotted at entry time.
  class: {
    type: String,
    trim: true,
    default: ''
  },
  subjects: {
    type: [SubjectMarkSchema],
    default: []
  },
  // Computed in the pre-validate hook below — never accepted from the client.
  totalMarks: { type: Number, default: 0 },
  totalMaxMarks: { type: Number, default: 0 },
  percentage: { type: Number, default: 0 },
  grade: { type: String, default: '' },
  passed: { type: Boolean, default: false },
  subjectsPassed: { type: Number, default: 0 },
  // Optional class ranking, entered by the admin.
  position: { type: Number, default: null },
  outOf: { type: Number, default: null },
  remarks: {
    type: String,
    trim: true,
    default: ''
  },
  // Students only see published records, so an admin can enter marks over
  // several sittings and release them when the term is closed.
  isPublished: {
    type: Boolean,
    default: true
  },
  issuedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// One record per student per term per year — re-entering a term updates it
// rather than silently creating a second conflicting transcript row.
AcademicRecordSchema.index({ student: 1, academicYear: 1, term: 1 }, { unique: true });
AcademicRecordSchema.index({ school: 1, academicYear: 1 });

/**
 * Recompute every derived field from the subject rows. Runs on validate so it
 * also covers findByIdAndUpdate paths that use { runValidators: true } documents.
 */
AcademicRecordSchema.methods.recalculate = function () {
  let totalWeighted = 0;
  let totalWeight = 0;
  let totalMarks = 0;
  let totalMaxMarks = 0;
  let subjectsPassed = 0;

  this.subjects.forEach(subject => {
    const pct = toPercentage(subject.marks, subject.maxMarks);
    subject.percentage = pct;
    subject.grade = gradeLetter(pct);
    if (!subject.remark) subject.remark = gradeRemark(pct);

    const weight = Number.isFinite(subject.coefficient) && subject.coefficient > 0
      ? subject.coefficient
      : 1;
    totalWeighted += pct * weight;
    totalWeight += weight;
    totalMarks += Number(subject.marks) || 0;
    totalMaxMarks += Number(subject.maxMarks) || 0;
    if (pct >= PASS_PERCENTAGE) subjectsPassed += 1;
  });

  const overall = totalWeight > 0 ? Math.round((totalWeighted / totalWeight) * 10) / 10 : 0;

  this.totalMarks = Math.round(totalMarks * 100) / 100;
  this.totalMaxMarks = Math.round(totalMaxMarks * 100) / 100;
  this.percentage = overall;
  this.grade = gradeLetter(overall);
  this.passed = overall >= PASS_PERCENTAGE;
  this.subjectsPassed = subjectsPassed;

  return this;
};

AcademicRecordSchema.pre('validate', function (next) {
  this.recalculate();
  next();
});

AcademicRecordSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('AcademicRecord', AcademicRecordSchema);
