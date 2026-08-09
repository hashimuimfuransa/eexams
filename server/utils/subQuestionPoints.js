/**
 * Marks available for each sub-question, scaled so the parts add up to what the question is
 * actually worth.
 *
 * Sub-question `points` routinely arrive as the schema default of 1 no matter what the paper says
 * — an imported 10-mark question whose part is labelled "(2 marks)… (6 marks)" in its text still
 * stores points: 1. Because an exam's total sums the PARENT question's points, such a question
 * counted 10 toward the denominator while the most its sub-questions could award was 1, so even a
 * flawless answer lost 9 marks.
 *
 * Relative weights are preserved, so parts that were given real, differing marks keep their
 * proportions; only the total is rescaled to the parent's.
 *
 * Lives in its own module because two independent grading paths need it — utils/fastGrading.js
 * (used when an exam is submitted) and utils/gradeExam.js (used when a result is regraded). They
 * had drifted into separate copies of the same `subQ.points || 1` bug, so a regrade could not
 * repair a score the initial grading had got wrong.
 */
function resolveSubQuestionPoints(question, count) {
  const declared = [];
  for (let i = 0; i < count; i++) {
    const p = Number(question?.subQuestions?.[i]?.points);
    declared.push(Number.isFinite(p) && p > 0 ? p : 1);
  }

  const declaredTotal = declared.reduce((sum, p) => sum + p, 0);
  const parentTotal = Number(question?.points);

  // Nothing reliable to scale to — keep what the sub-questions declare.
  if (!Number.isFinite(parentTotal) || parentTotal <= 0) return declared;
  if (!declaredTotal || declaredTotal === parentTotal) return declared;

  return declared.map(p => Math.round((p / declaredTotal) * parentTotal * 100) / 100);
}

module.exports = { resolveSubQuestionPoints };
