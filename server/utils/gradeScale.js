/**
 * Percentage -> letter grade for manually entered marks.
 *
 * Thresholds match the ones already used for exam results elsewhere in the
 * app (adminController, student dashboards) so a transcript and an exam
 * result never disagree about what 82% is called.
 */
const GRADE_SCALE = [
  { min: 90, grade: 'A', remark: 'Excellent',     passed: true  },
  { min: 80, grade: 'B', remark: 'Very Good',     passed: true  },
  { min: 70, grade: 'C', remark: 'Good',          passed: true  },
  { min: 60, grade: 'D', remark: 'Satisfactory',  passed: true  },
  { min: 50, grade: 'E', remark: 'Pass',          passed: true  },
  { min: 0,  grade: 'F', remark: 'Fail',          passed: false }
];

const PASS_PERCENTAGE = 50;

const gradeFor = (percentage) => {
  const pct = Number(percentage);
  if (!Number.isFinite(pct)) return GRADE_SCALE[GRADE_SCALE.length - 1];
  return GRADE_SCALE.find(g => pct >= g.min) || GRADE_SCALE[GRADE_SCALE.length - 1];
};

const gradeLetter = (percentage) => gradeFor(percentage).grade;
const gradeRemark = (percentage) => gradeFor(percentage).remark;

/** Percentage of marks out of maxMarks, rounded to 1 decimal, 0 when maxMarks is 0. */
const toPercentage = (marks, maxMarks) => {
  const m = Number(marks);
  const max = Number(maxMarks);
  if (!Number.isFinite(m) || !Number.isFinite(max) || max <= 0) return 0;
  return Math.round((m / max) * 1000) / 10;
};

module.exports = { GRADE_SCALE, PASS_PERCENTAGE, gradeFor, gradeLetter, gradeRemark, toPercentage };
