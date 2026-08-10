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

const SOLVER_SYSTEM_PROMPT = 'You are a subject expert answering an exam question. You are not ' +
  'grading anyone. You set out the method and the arithmetic to be done, and you never evaluate ' +
  'the arithmetic yourself. You always return valid JSON.';

/**
 * Work out the correct answer to a question WITHOUT showing the model the marking guide or the
 * student's answer.
 *
 * A grader shown the marking guide anchors to it. In testing, a grader given a guide that
 * computed WACC without dividing by total capital copied that method into its own "solution",
 * declared the two agreed, and marked a correct student wrong - even when told to solve the
 * question first. It cannot un-see the guide. So the solve happens here, in its own call, with
 * neither the guide nor the answer in context.
 *
 * The model returns arithmetic as unevaluated expressions, which are then computed with the
 * calculator in checkArithmetic - it supplies the method, we supply the numbers.
 *
 * This call does not depend on the student, so every student sitting the same paper produces an
 * identical prompt and hits the response cache. It costs one call per question, not per script.
 *
 * @param {Function} generateContent - groqClient.generateContent, passed in to avoid a cycle
 * @param {Object} params - questionText, maxPoints, questionType, extraContext
 * @returns {Promise<string>} - A reference solution block for the grading prompt, or ''
 */
async function solveQuestionIndependently(generateContent, params = {}) {
  const { questionText, maxPoints, questionType = 'open-ended', extraContext = '' } = params;
  if (!questionText || String(questionText).trim().length < 15) return '';

  const prompt = `Answer this exam question yourself. You are NOT grading anyone and there is no
student answer to look at - produce the correct answer from your own subject knowledge.

QUESTION (${maxPoints} marks, type: ${questionType}): ${questionText}
${extraContext ? `${extraContext}\n` : ''}
Give:
- "method": the approach and the formulas it needs, in a few sentences. Be precise about what
  each formula divides by and what it is weighted by.
- "calculations": every sum the answer needs, each as a label plus a PURE arithmetic expression
  containing only numbers and + - * / ( ) and %. Substitute the numbers from the question - no
  variable names, no units, no words. DO NOT work out the results; they will be calculated for
  you, and your own arithmetic is not reliable.
- "keyPoints": the distinct creditworthy points a full-mark answer must contain.

Return only JSON:
{
  "method": "<the method and formulas>",
  "calculations": [{"label": "<what this computes>", "expression": "<numbers and operators only>"}],
  "keyPoints": ["<point>", "..."]
}`;

  try {
    const response = await generateContent(prompt, {
      systemPrompt: SOLVER_SYSTEM_PROMPT,
      model: 'smart',
      jsonMode: true,
      temperature: 0.1,
      maxTokens: 1024
    });

    const parsed = response.parsedContent ||
      JSON.parse(String(response.text || '').replace(/```json\n?|\n?```/g, '').trim());
    if (!parsed || !parsed.method) return '';

    const lines = [];
    for (const calc of Array.isArray(parsed.calculations) ? parsed.calculations : []) {
      if (!calc || !calc.expression) continue;
      const value = evaluateNumericExpression(String(calc.expression));
      if (value === null) continue;
      // Show rates both ways. The model returns weights and costs as decimals while students
      // write them as percentages, and the grader was failing to see 0.144444 and "14.3%" as
      // the same figure.
      const plain = Number(value.toPrecision(6));
      const shown = Math.abs(value) > 0 && Math.abs(value) < 1
        ? `${plain} (= ${Number((value * 100).toPrecision(6))}%)`
        : `${plain}`;
      lines.push(`  ${calc.label || 'result'}: ${calc.expression} = ${shown}`);
    }

    const points = (Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [])
      .filter(Boolean).map(kp => `  - ${kp}`).join('\n');

    return `\nREFERENCE SOLUTION - worked out independently, before the marking guide or the
student's answer were seen. The figures below were computed with a calculator and are correct:
Method: ${parsed.method}
${lines.length > 0 ? `Computed figures:\n${lines.join('\n')}\n` : ''}${points ? `Expected points:\n${points}\n` : ''}`;
  } catch (error) {
    console.log(`⚠️ Independent solve failed, grading against the marking guide alone: ${error.message}`);
    return '';
  }
}

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
  extraContext = '',
  referenceSolution = ''
}) {
  const markLabel = `${maxPoints} mark${Number(maxPoints) === 1 ? '' : 's'}`;
  const wantsDetail = section !== 'A' && Number(maxPoints) > 1;
  const arithmetic = formatArithmeticCheck(studentAnswer, modelAnswer);

  return `Grade this student answer.

QUESTION (${markLabel}, type: ${questionType}): ${questionText || '(question text unavailable)'}
${extraContext ? `${extraContext}\n` : ''}${referenceSolution}
MARKING GUIDE: ${modelAnswer || '(none supplied - use the reference solution and your own subject knowledge)'}

STUDENT ANSWER: ${studentAnswer}
${arithmetic}
STEP 1 - In "workings", state the correct answer, taking the method and figures from the
REFERENCE SOLUTION and the ARITHMETIC CHECK above where they are given. Those were produced
without sight of the marking guide and with a calculator, so they outrank both the guide and
your own mental arithmetic. Never recompute a figure they already give you.

STEP 2 - In "guideCheck", compare the correct answer with the marking guide. Marking guides are
written by hand and are sometimes wrong, incomplete, or only one of several valid answers. If
the guide disagrees with the reference solution - a wrong formula, wrong arithmetic, a missing
valid alternative - the reference solution wins: set "markingGuideReliable" to false and explain
in "markingGuideConcern". Never mark a student wrong for disagreeing with a guide that is itself
wrong. If the two agree, say so and leave "markingGuideReliable" true.

STEP 2b - In "studentCheck", compare the student's answer with the REFERENCE SOLUTION, not with
the guide. State whether their method matches and whether their figures match.

STEP 3 - List the distinct creditworthy points for this question. Take them from the marking
guide where it is sound, and from your own knowledge where it is not. A question worth
${markLabel} normally has between 1 and ${maxPoints} such points. Keep them at concept level
("transaction motive: cash held for day-to-day operating payments"), never individual words.
For a calculation, make the method its own point or points - the formula used, the correct
figures put into it, the correct final result - so that working can earn marks separately from
the answer.
If the student makes a point that correctly answers the question but is absent from the marking
guide, ADD IT as a key point in its own right and credit it. The guide is a guide, not the only
permitted answer; a student who answers correctly in their own words, or gives a different but
equally valid reason, example or method, earns the mark.

STEP 4 - For every point, decide what the student earned:
  "full"    - the student clearly states this point. Different wording, synonyms, abbreviations,
              misspellings, simplified phrasing and different-but-valid reasoning are all fine;
              judge meaning and correctness, not wording.
  "partial" - the student gestures at this point but is vague, unexplained or half right. Naming
              a term with no explanation, where the question asked the student to explain, is
              "partial" at best.
  "none"    - the student does not address this point, contradicts it, or is wrong.

STEP 5 - Score it: (number of "full" + half the "partial") / (total points) x ${maxPoints}.

CALCULATIONS - method carries marks:
- THE NUMBERS SETTLE THE METHOD. If the student's final figures agree with the reference
  solution's computed figures, allowing for rounding, then their method is correct - a wrong
  method does not arrive at the right number by accident. Credit the method points "full" and do
  not mark them down because the working is laid out differently from the reference. Computing
  each component's contribution separately (20/(20+25)*20% = 8.8%) is the same method as
  applying weights first ((E/V) x Re); so is any other rearrangement that reaches the same
  figure. Compare percentages against decimals correctly: 14.3% is 0.143.
- Take every figure from the ARITHMETIC CHECK above. It was produced by a calculator and you are
  not. Where it says a student's calculation is CORRECT, that calculation is correct - credit it
  "full" and never mark it down as a miscalculation, a rounding problem or "close but not exact".
  Judge only the method: did they use the right formula with the right inputs?
- MARK STEP BY STEP. The arithmetic check lists the student's steps one at a time. Every step it
  marks CORRECT is a step the student got right and must be credited. A step it marks WRONG
  costs only its own point - one bad addition at the end does not retroactively make the correct
  steps before it wrong, and does not make the method wrong. A student who sets up every formula
  correctly and then slips on the last sum has earned most of the marks, not none of them.
- A correct formula, correctly set up with the right figures, earns its marks even when a later
  step slips. Correct method with a wrong final result is never 0.
- Rounding is not an error. 14.3% and 14.44% are the same answer; so are 8.8% and 8.89%.
  Students round at each step and that costs no marks.
- If the arithmetic check shows the marking guide's own sums are wrong, say so and set
  "markingGuideReliable" to false.
- Format never costs marks: $600 = 600 = 600 dollars; shown working is a plus, not a problem.
- A bare final figure with no working, that is also wrong, earns nothing.

HARD RULES - these override everything above:
- No marks for restating the question, for generic filler, or for effort alone.
- If no point is covered, the score is 0. A wrong answer scores 0; there is no minimum mark.
- Being on the right topic is not answering. For "explain the motives for holding cash", the
  answer "cash is important to a business" covers no point and scores 0.
- One vague clause does not cover a multi-point answer. Mark what is written, not what the
  student might have meant.
- "I don't know", "skip", "none", "n/a" and the like score 0.
- Never report a score higher than your own point-by-point verdicts support.

FEEDBACK: ${wantsDetail ? 'Two or three sentences, addressed to the student.' : 'One sentence.'}
Name what they got right and name specifically what was missing. Do not praise an answer that
scored below half marks. If the marking guide was wrong, tell the student their answer was
accepted as correct.

Return only JSON, no text around it. Fill the fields in this order - the first three are your
own reasoning and must be written before you decide anything:
{
  "workings": "<your own step-by-step solution to the question, with the arithmetic carried out>",
  "guideCheck": "<does your solution agree with the marking guide? if not, which is right and why>",
  "studentCheck": "<does the student's method and result match YOUR solution?>",
  "markingGuideReliable": true|false,
  "markingGuideConcern": "<what is wrong with the guide, or empty>",
  "independentVerdict": "correct|mostly-correct|partially-correct|incorrect",
  "keyPoints": [{"point": "<point>", "credit": "full|partial|none", "inGuide": true|false, "reason": "<short>"}],
  "score": <number between 0 and ${maxPoints}>,
  "feedback": "<feedback to the student>",
  "correctedAnswer": "<the full correct answer>"
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
 * The AI's self-reported score is treated as a ceiling that its point-by-point breakdown must
 * justify: coverage can only lower the mark, never raise it. This is what stops an answer that
 * covers nothing from being handed 4/5.
 *
 * The breakdown includes points the student earned that the marking guide never listed, so
 * answering correctly in your own words is not penalised. The one case where the cap is lifted
 * is a marking guide the grader judged to be wrong against an answer it judged correct - there
 * the guide is not a yardstick at all, and the answer is flagged for a teacher to look at.
 *
 * @param {Object} result - Parsed JSON returned by the grading model
 * @param {number} rawMaxPoints - Marks available
 * @param {Object} [options]
 * @param {string} [options.label] - Identifier for logging
 * @returns {{score: number, coverage: number|null, keyPoints: Array, adjusted: boolean,
 *            needsReview: boolean, reviewReason: string}}
 */
function reconcileScoreWithCoverage(result, rawMaxPoints, options = {}) {
  const label = options.label || 'answer';
  // Questions occasionally reach grading without a mark allocation; never let that turn into NaN.
  const maxPoints = Number.isFinite(Number(rawMaxPoints)) ? Number(rawMaxPoints) : 0;
  const rawScore = Number(result && result.score);
  let score = Number.isFinite(rawScore) ? Math.min(Math.max(rawScore, 0), maxPoints) : 0;

  const verdict = String((result && result.independentVerdict) || '').toLowerCase().trim();
  const guideReliable = !(result && result.markingGuideReliable === false);
  const guideConcern = String((result && result.markingGuideConcern) || '').trim();

  // The grader marked the answer correct on its own subject knowledge and the marking guide
  // wrong. Scoring against that guide would penalise a right answer, so its coverage is not
  // applied - but a human is told to check, because this is also how a lenient grader would
  // try to talk its way out of the cap.
  const guideOverridden = !guideReliable && (verdict === 'correct' || verdict === 'mostly-correct');

  const keyPoints = Array.isArray(result && result.keyPoints)
    ? result.keyPoints.filter(kp => kp && typeof kp === 'object')
    : [];

  const review = guideOverridden
    ? {
        needsReview: true,
        reviewReason: guideConcern
          ? `Marked against the grader's own working because the marking guide looks wrong: ${guideConcern}`
          : "Marked against the grader's own working because the marking guide looks wrong."
      }
    : { needsReview: false, reviewReason: '' };

  if (keyPoints.length === 0) {
    // No breakdown to check against - keep the model's score, just bounded and rounded.
    return { score: roundMark(score, maxPoints), coverage: null, keyPoints: [], adjusted: false, ...review };
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

  if (guideOverridden) {
    console.log(`⚠️ Grading: ${label} - marking guide judged unreliable (${guideConcern || 'no reason given'}), ` +
      `keeping the grader's score of ${score}/${maxPoints} and flagging for teacher review`);
    return { score: roundMark(score, maxPoints), coverage, keyPoints, adjusted: false, ...review };
  }

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

  return { score, coverage, keyPoints, adjusted, ...review };
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
 * Check the arithmetic in a written answer with an actual calculator.
 *
 * Language models are unreliable at arithmetic, and a grader that miscalculates marks correct
 * work wrong. Asking the model to "carry the arithmetic out" does not fix this - in testing, a
 * grader set up the right WACC formula and then evaluated 6.5/45 as 6.5%, which is how a
 * correct student answer came to be marked 0. So the sums are done here, in code, and the
 * verified results are handed to the model as facts it is told not to contradict.
 *
 * Handles the "label = expression = result" shape students actually write, e.g.
 * "Cost of equity (Ke)= 20/(20+25)*20%= 8.8%".
 *
 * @param {string} text - The answer (or marking guide) to check
 * @returns {Array<{expression: string, stated: string, computed: number, correct: boolean}>}
 */
function checkArithmetic(text) {
  const source = String(text || '')
    .replace(/[×✕]/g, '*')
    .replace(/[÷]/g, '/')
    .replace(/[$€£¥₹]|Rwf/gi, '')
    .replace(/(\d),(\d{3})/g, '$1$2');

  const findings = [];

  // Students separate steps with newlines, semicolons and commas alike. Thousands separators
  // were stripped above, so splitting on commas is safe.
  for (const rawSegment of source.split(/[\n;,]+/)) {
    const parts = rawSegment.split('=');
    if (parts.length < 2) continue;

    // Check every link of a chain, so "Ke= 20/45*20%= 8.9%" is graded as its own step even
    // when a later step in the same answer is wrong. Marking only the final step made one bad
    // addition look like a wrong method.
    for (let i = 0; i < parts.length - 1; i++) {
      const expression = parts[i].trim();
      const stated = parts[i + 1].trim();
      if (!expression || !stated) continue;

      const computed = evaluateNumericExpression(expression);
      // The right-hand side of a chain link is often another expression ("... = 2.5 + 4 = 6.5"),
      // so evaluate it too rather than grabbing its first number and calling the step wrong.
      const statedValue = evaluateNumericExpression(stated) ?? parseNumeric(stated);
      if (computed === null || statedValue === null) continue;

      // Percentages only compare meaningfully against percentages.
      if (/%/.test(expression) !== /%/.test(stated)) continue;

      findings.push({
        expression,
        stated,
        computed,
        correct: valuesAgree(computed, statedValue)
      });
    }
  }

  return findings;
}

/** Safely evaluate a bare arithmetic expression, or null if it is not one. */
function evaluateNumericExpression(expression) {
  if (expression.length > 200) return null;
  // "20%" means twenty hundredths. Do this before the charset check strips the sign.
  const withPercents = expression.replace(/(\d+(?:\.\d+)?)\s*%/g, '($1/100)');
  if (!/^[0-9+\-*/().\s]+$/.test(withPercents)) return null;
  if (!/[+\-*/]/.test(withPercents)) return null;      // a bare number is not a calculation
  if (!/\d/.test(withPercents)) return null;

  try {
    // Safe: the string is already restricted to digits, operators, parentheses and dots, so
    // there is no identifier or call syntax left for it to reach anything.
    const value = Function(`"use strict"; return (${withPercents});`)();
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

/** Parse a stated result like "8.8%" or "12.6" into a number, percentages as fractions. */
function parseNumeric(text) {
  const match = String(text).match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const value = parseFloat(match[0]);
  if (!Number.isFinite(value)) return null;
  return /%/.test(text) ? value / 100 : value;
}

/**
 * Do two figures agree, allowing for the rounding students do at each step? Deliberately loose:
 * truncating 8.89% to 8.8% at three intermediate steps is not a mistake worth marks.
 */
function valuesAgree(a, b, relativeTolerance = 0.02) {
  if (a === b) return true;
  const scale = Math.max(Math.abs(a), Math.abs(b));
  if (scale === 0) return true;
  return Math.abs(a - b) / scale <= relativeTolerance;
}

/**
 * Render the arithmetic check as a block for the prompt, or '' when there is nothing to report.
 */
function formatArithmeticCheck(studentAnswer, modelAnswer) {
  const student = checkArithmetic(studentAnswer);
  const guide = checkArithmetic(modelAnswer);
  if (student.length === 0 && guide.length === 0) return '';

  const render = (findings) => findings
    .map(f => `  ${f.expression} = ${f.stated}  ->  ${f.correct ? 'CORRECT' : `WRONG, it comes to ${Number(f.computed.toPrecision(6))}`}`)
    .join('\n');

  let block = '\nARITHMETIC CHECK - these sums were evaluated with a calculator, not estimated.\n' +
    'They are authoritative. Do NOT contradict them and do NOT redo them in your head:\n';
  if (student.length > 0) {
    const wrong = student.filter(f => !f.correct).length;
    block += `Student's calculations (${student.length - wrong} of ${student.length} correct):\n${render(student)}\n`;
  }
  if (guide.length > 0) {
    const wrong = guide.filter(f => !f.correct).length;
    block += `Marking guide's calculations (${guide.length - wrong} of ${guide.length} correct):\n${render(guide)}\n`;
  }
  return block;
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
  SOLVER_SYSTEM_PROMPT,
  buildOpenEndedGradingPrompt,
  solveQuestionIndependently,
  reconcileScoreWithCoverage,
  summariseCoverage,
  roundMark,
  contentWords,
  characterSimilarity,
  levenshteinDistance,
  isTypoMatch,
  checkArithmetic,
  formatArithmeticCheck,
  STOP_WORDS
};
