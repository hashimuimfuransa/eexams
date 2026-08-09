/**
 * Shared rubric for grading open-ended and typed (non-multiple-choice) answers.
 *
 * The AI graders used to be prompted to "grade generously", "give students the benefit of the
 * doubt" and "NEVER award 0 points if the student shows any understanding". Combined with a
 * small/fast model that made them hand out near-full marks for answers that covered none of the
 * points in the model answer.
 *
 * Grading here is coverage-first instead: the model must enumerate the creditworthy points of
 * the expected answer and say, point by point, which ones the student actually covered. The
 * score is then recomputed from those verdicts rather than trusted, so the grader cannot report
 * "1 of 4 points covered" and still award 80%.
 */

/** Weight each per-point verdict contributes towards the mark. */
const CREDIT_WEIGHTS = {
  full: 1,
  partial: 0.5,
  none: 0
};

const GRADING_SYSTEM_PROMPT = 'You are an exam grader. You mark to the rubric you are given: ' +
  'a mark is earned only when the student states the point, never for effort, topic familiarity ' +
  'or restating the question. You judge meaning rather than wording, so synonyms, abbreviations, ' +
  'spelling mistakes and simpler phrasing never cost marks. You always return valid JSON.';

/**
 * Build the coverage-based grading prompt used by every AI grader for written answers.
 * @param {Object} params
 * @param {string} params.questionText - The question as shown to the student
 * @param {string} params.studentAnswer - What the student wrote
 * @param {string} params.modelAnswer - The expected answer, if the exam has one
 * @param {number} params.maxPoints - Marks available for this question
 * @param {string} [params.questionType] - open-ended, short-answer, fill-in-blank, ...
 * @param {string} [params.section] - Exam section, used only to set feedback length
 * @param {string} [params.extraContext] - Word bank, passage, etc.
 * @returns {string} - The prompt
 */
function buildOpenEndedGradingPrompt({
  questionText,
  studentAnswer,
  modelAnswer,
  maxPoints,
  questionType = 'open-ended',
  section = 'B',
  extraContext = ''
}) {
  const markLabel = `${maxPoints} mark${Number(maxPoints) === 1 ? '' : 's'}`;
  const wantsDetail = section !== 'A' && Number(maxPoints) > 1;

  return `Grade this student answer.

QUESTION (${markLabel}, type: ${questionType}): ${questionText || '(question text unavailable)'}
${extraContext ? `${extraContext}\n` : ''}
EXPECTED ANSWER: ${modelAnswer || '(none supplied - work out the expected answer from the question using your own subject knowledge)'}

STUDENT ANSWER: ${studentAnswer}

STEP 1 - Break the expected answer into its distinct creditworthy points.
Take the points from the expected answer where one is supplied. Keep them at concept level
("transaction motive: cash held for day-to-day operating payments"), never individual words. A
question worth ${markLabel} normally has between 1 and ${maxPoints} such points; if the expected
answer contains fewer, use only the points it actually contains.

STEP 2 - For every point, decide what the student earned:
  "full"    - the student clearly states this point. Different wording, synonyms, abbreviations,
              misspellings and simplified phrasing are all fine; judge meaning, not wording.
  "partial" - the student gestures at this point but is vague, unexplained or half right. Naming
              a term with no explanation, where the question asked the student to explain, is
              "partial" at best.
  "none"    - the student does not address this point, contradicts it, or is wrong.

STEP 3 - Score it: (number of "full" + half the "partial") / (total points) x ${maxPoints}.

HARD RULES - these override everything above:
- No marks for restating the question, for generic filler, or for effort alone.
- If no point is covered, the score is 0. A wrong answer scores 0; there is no minimum mark.
- Being on the right topic is not answering. For "explain the motives for holding cash", the
  answer "cash is important to a business" covers no point and scores 0.
- One vague clause does not cover a multi-point answer. Mark what is written, not what the
  student might have meant.
- Calculations: the final result must be correct for full marks; correct method with the wrong
  result is "partial". Format ($600 = 600 = 600 dollars) and shown working never cost marks.
- "I don't know", "skip", "none", "n/a" and the like score 0.
- Never report a score higher than your own point-by-point verdicts support.

FEEDBACK: ${wantsDetail ? 'Two or three sentences, addressed to the student.' : 'One sentence.'}
Name what they got right and name specifically what was missing. Do not praise an answer that
scored below half marks.

Return only JSON, no text around it:
{
  "keyPoints": [{"point": "<expected point>", "credit": "full|partial|none", "reason": "<short>"}],
  "score": <number between 0 and ${maxPoints}>,
  "feedback": "<feedback to the student>",
  "correctedAnswer": "<the full expected answer>"
}`;
}

/**
 * Round a mark to a granularity teachers expect: half marks on whole-mark questions,
 * 2dp where the question carries a fractional allocation (scaled sub-questions).
 */
function roundMark(value, maxPoints) {
  if (!Number.isFinite(value)) return 0;
  return Number.isInteger(maxPoints)
    ? Math.round(value * 2) / 2
    : Math.round(value * 100) / 100;
}

/**
 * Recompute the score from the grader's own per-point verdicts.
 *
 * The AI's self-reported score is treated as a ceiling that its point-by-point coverage must
 * justify: coverage can only lower the mark, never raise it. This is what stops an answer that
 * covers nothing from being handed 4/5.
 *
 * @param {Object} result - Parsed JSON returned by the grading model
 * @param {number} maxPoints - Marks available
 * @param {Object} [options]
 * @param {string} [options.label] - Identifier for logging
 * @returns {{score: number, coverage: number|null, keyPoints: Array, adjusted: boolean}}
 */
function reconcileScoreWithCoverage(result, rawMaxPoints, options = {}) {
  const label = options.label || 'answer';
  // Questions occasionally reach grading without a mark allocation; never let that turn into NaN.
  const maxPoints = Number.isFinite(Number(rawMaxPoints)) ? Number(rawMaxPoints) : 0;
  const rawScore = Number(result && result.score);
  let score = Number.isFinite(rawScore) ? Math.min(Math.max(rawScore, 0), maxPoints) : 0;

  const keyPoints = Array.isArray(result && result.keyPoints)
    ? result.keyPoints.filter(kp => kp && typeof kp === 'object')
    : [];

  if (keyPoints.length === 0) {
    // No breakdown to check against - keep the model's score, just bounded and rounded.
    return { score: roundMark(score, maxPoints), coverage: null, keyPoints: [], adjusted: false };
  }

  let earned = 0;
  for (const kp of keyPoints) {
    const credit = String(kp.credit || kp.status || 'none').toLowerCase().trim();
    if (Object.prototype.hasOwnProperty.call(CREDIT_WEIGHTS, credit)) {
      earned += CREDIT_WEIGHTS[credit];
    } else if (credit.startsWith('part')) {
      earned += CREDIT_WEIGHTS.partial;
    } else if (credit.startsWith('full') || credit === 'yes' || credit === 'covered') {
      earned += CREDIT_WEIGHTS.full;
    }
  }

  const coverage = earned / keyPoints.length;
  const coverageScore = roundMark(coverage * maxPoints, maxPoints);
  let adjusted = false;

  if (score > coverageScore) {
    console.log(`📉 Grading: capping ${label} at coverage - ${score} -> ${coverageScore} ` +
      `(${earned}/${keyPoints.length} expected points covered)`);
    score = coverageScore;
    adjusted = true;
  } else {
    score = roundMark(score, maxPoints);
  }

  if (earned === 0 && score > 0) {
    console.log(`📉 Grading: ${label} covered none of the expected points, forcing 0`);
    score = 0;
    adjusted = true;
  }

  return { score, coverage, keyPoints, adjusted };
}

/**
 * Build a one-line coverage summary to append to feedback, so the student and the teacher can
 * both see what the mark was based on.
 */
function summariseCoverage(keyPoints) {
  if (!Array.isArray(keyPoints) || keyPoints.length === 0) return '';
  const missing = keyPoints
    .filter(kp => String(kp.credit || '').toLowerCase().startsWith('none'))
    .map(kp => kp.point)
    .filter(Boolean);
  if (missing.length === 0) return '';
  return ` Points not covered: ${missing.join('; ')}.`;
}

/**
 * Words that carry no meaning on their own. Concept matching that counts these as evidence
 * will match almost any answer against almost any model answer.
 */
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'if', 'of', 'to', 'in', 'on', 'at', 'by', 'for', 'with',
  'from', 'as', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'it', 'its', 'this', 'that',
  'these', 'those', 'they', 'them', 'their', 'there', 'has', 'have', 'had', 'do', 'does', 'did',
  'can', 'could', 'will', 'would', 'should', 'may', 'might', 'must', 'not', 'no', 'so', 'such',
  'than', 'then', 'when', 'which', 'who', 'what', 'how', 'why', 'also', 'more', 'most', 'other',
  'some', 'any', 'all', 'each', 'both', 'you', 'your', 'we', 'our', 'i', 'my', 'he', 'she', 'his',
  'her', 'us', 'me', 'up', 'out', 'about', 'into', 'over', 'under', 'again', 'because'
]);

/**
 * Split text into meaningful words - stop words and one/two letter tokens dropped.
 * @param {string} text
 * @returns {string[]}
 */
function contentWords(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !STOP_WORDS.has(word));
}

/**
 * Levenshtein edit distance between two strings.
 */
function levenshteinDistance(a, b) {
  const s1 = String(a || '');
  const s2 = String(b || '');
  if (s1 === s2) return 0;
  if (!s1) return s2.length;
  if (!s2) return s1.length;

  const longer = s1.length >= s2.length ? s1 : s2;
  const shorter = s1.length >= s2.length ? s2 : s1;

  // Single-row Levenshtein - the full matrix is never needed.
  let previous = Array.from({ length: shorter.length + 1 }, (_, i) => i);
  for (let i = 1; i <= longer.length; i++) {
    const current = [i];
    for (let j = 1; j <= shorter.length; j++) {
      const cost = longer[i - 1] === shorter[j - 1] ? 0 : 1;
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
    }
    previous = current;
  }

  return previous[shorter.length];
}

/**
 * Character-level similarity (normalised Levenshtein), for comparing longer typed answers.
 * @returns {number} 0..1
 */
function characterSimilarity(a, b) {
  const s1 = String(a || '');
  const s2 = String(b || '');
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1;
  return 1 - levenshteinDistance(s1, s2) / Math.max(s1.length, s2.length);
}

/**
 * Is the difference between two typed answers a spelling mistake rather than a different answer?
 *
 * Uses absolute edit distance rather than a ratio: on a six-letter word a one-character slip is
 * only 83% similar, so a ratio threshold strict enough to reject "minimise" for "maximise" also
 * rejects "colour" for "color". Short words must match exactly - at three letters, one edit is a
 * different word ("cat"/"cot") - and two edits are only forgiven on long words, because on a
 * short one they are usually a different answer rather than a slip ("minimise"/"maximise").
 */
function isTypoMatch(a, b) {
  const s1 = String(a || '').toLowerCase().trim();
  const s2 = String(b || '').toLowerCase().trim();
  if (!s1 || !s2) return false;
  if (s1 === s2) return true;

  const shortest = Math.min(s1.length, s2.length);
  if (shortest <= 3) return false;

  const allowed = shortest <= 11 ? 1 : 2;
  return levenshteinDistance(s1, s2) <= allowed;
}

module.exports = {
  CREDIT_WEIGHTS,
  GRADING_SYSTEM_PROMPT,
  buildOpenEndedGradingPrompt,
  reconcileScoreWithCoverage,
  summariseCoverage,
  roundMark,
  contentWords,
  characterSimilarity,
  levenshteinDistance,
  isTypoMatch,
  STOP_WORDS
};
