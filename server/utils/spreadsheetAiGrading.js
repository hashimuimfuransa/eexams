/**
 * AI review for financial-spreadsheet answers.
 *
 * Cell matching — even the layout-tolerant matching in spreadsheetGrading.js — only ever asks
 * "is this figure where a figure should be?". It cannot recognise that a student:
 *   - reached the right answer by a different but valid route,
 *   - laid the statement out their own way with extra workings columns,
 *   - carried an earlier arithmetic slip through correctly (own-figure marks),
 *   - or did the calculation in the grid and explained the reasoning in the written box.
 *
 * A human marker credits all of those. This pass gives the same answer to an examiner model,
 * grading the grid and the written explanation together against the whole marking guide.
 *
 * It never lowers a score: the caller takes the better of the deterministic and AI marks, so a
 * conservative or unavailable model can only ever leave the cell-matched score standing.
 */

// groqClient is required lazily, never at module load: it throws outright when GROQ_API_KEY is
// unset, which would take the whole grading module down with it and stop every question being
// marked — not just the AI review this file provides.

const MAX_TABLE_ROWS = 60;   // keeps very large sheets inside the context window
const MAX_CELL_CHARS = 60;

/** Renders a table set as a readable pipe-delimited grid — far easier for a model than raw JSON. */
function tablesToText(tables, label) {
  if (!Array.isArray(tables) || !tables.length) return `${label}: (nothing provided)`;

  return tables.map((t, i) => {
    const title = t.title || `Table ${i + 1}`;
    const headers = (t.headers || []).join(' | ');
    const rows = (t.data || [])
      .slice(0, MAX_TABLE_ROWS)
      .filter(row => (row || []).some(cell => String(cell ?? '').trim() !== ''))
      .map(row => (row || [])
        .map(cell => String(cell ?? '').trim().slice(0, MAX_CELL_CHARS))
        .join(' | '))
      .join('\n');
    return `### ${title}\n${headers}\n${rows || '(empty)'}`;
  }).join('\n\n');
}

// Same money-string parsing the grader uses, so "Frw 2,638,000" in the sheet and "2638000" in the
// AI's quote are recognised as the same figure.
const CURRENCY_CODE = 'frw|rwf|ksh|kes|usd|eur|gbp|ugx|tzs|zar|ngn|rs';
const LEADING_CURRENCY_RE  = new RegExp(`^(?:${CURRENCY_CODE})\\s*(?=[\\d.+-])`, 'i');
const TRAILING_CURRENCY_RE = new RegExp(`([\\d.])\\s*(?:${CURRENCY_CODE})$`, 'i');

// Ratio guides state values with units — "1.5:1", "4.64 times", "28.57%" — and these must reduce
// to plain numbers, or the marking guide's own figures are unreadable and every credit gets
// rejected for "not matching the guide".
const UNIT_SUFFIX_RE = /(:\s*1|times?|days?|weeks?|months?|years?|x)\s*$/i;

function asNumber(value) {
  let str = String(value ?? '').trim();
  if (!str) return NaN;
  const bracketed = /^\(.*\)$/.test(str);
  if (bracketed) str = str.slice(1, -1);
  str = str
    .replace(UNIT_SUFFIX_RE, '')
    .replace(LEADING_CURRENCY_RE, '')
    .replace(TRAILING_CURRENCY_RE, '$1')
    .replace(/[,$€£¥₹₦%\s]/g, '');
  const n = Number(str);
  if (!Number.isFinite(n)) return NaN;
  return bracketed ? -n : n;
}

/** Everything the student actually wrote — grid cells and the written explanation. */
function buildEvidenceIndex(studentTables, writtenAnswer) {
  const texts = new Set();
  const numbers = [];
  const add = (raw) => {
    const s = String(raw ?? '').trim();
    if (!s) return;
    texts.add(s.toLowerCase());
    const n = asNumber(s);
    // The decimal places the value was written to are kept: a guide of "2.3:1" should accept a
    // student's 2.3333333333, the same judgement cellsEqual() makes in spreadsheetGrading.js.
    if (!Number.isNaN(n)) {
      const dp = (String(s).match(/\.(\d+)/) || [, ''])[1].length;
      numbers.push({ value: n, dp: Math.min(dp, 6) });
    }
  };

  for (const t of studentTables || []) {
    for (const row of t?.data || []) for (const cell of row || []) add(cell);
  }
  const written = String(writtenAnswer || '');
  for (const m of written.matchAll(/-?\d[\d,.]*/g)) add(m[0]);

  return { texts, numbers, written: written.toLowerCase() };
}

const hasNumber = (n, index) => index.numbers.some(({ value, dp }) => {
  if (Number(n.toFixed(dp)) === Number(value.toFixed(dp))) return true;
  const tolerance = Math.max(Math.abs(value) * 0.01, 0.01);
  return Math.abs(value - n) <= tolerance;
});

/**
 * True when the AI's quoted evidence really appears in the student's answer.
 *
 * Deliberately not a literal string test. A marker quotes what earned the mark the way it reads —
 * "Gross Profit = 2,638,000" — while the grid holds "GP" and "2,638,000" in separate cells. What
 * has to be verified is that the FIGURES exist in the student's work; the surrounding wording is
 * the marker's, not the student's.
 */
function evidenceFound(evidence, index) {
  const s = String(evidence ?? '').trim();
  if (!s) return false;

  if (index.texts.has(s.toLowerCase())) return true;

  const asWhole = asNumber(s);
  if (!Number.isNaN(asWhole) && hasNumber(asWhole, index)) return true;

  // Every figure quoted inside the evidence must be somewhere in the student's answer.
  const quotedNumbers = [...s.matchAll(/-?\d[\d,.]*/g)]
    .map(m => asNumber(m[0]))
    .filter(n => !Number.isNaN(n));
  if (quotedNumbers.length && quotedNumbers.every(n => hasNumber(n, index))) return true;

  // A phrase genuinely lifted from the written explanation.
  if (s.length >= 6 && index.written.includes(s.toLowerCase())) return true;

  return false;
}

/**
 * @param {Object}  opts
 * @param {string}  opts.questionText     what the student was asked
 * @param {Array}   opts.modelTables      the marking guide's tables
 * @param {Array}   opts.studentTables    the student's tables
 * @param {string}  opts.writtenModel     model answer for the written half (may be empty)
 * @param {string}  opts.writtenAnswer    the student's written answer (may be empty)
 * @param {number}  opts.totalPoints      marks available for the whole question
 * @param {Object}  opts.deterministic    { correctCells, gradableCells } from cell matching
 * @returns {Promise<{score:number, feedback:string, aiGraded:boolean}|null>} null when unavailable
 */
async function aiReviewSpreadsheetAnswer({
  questionText, modelTables, studentTables, writtenModel, writtenAnswer, totalPoints, deterministic
}) {
  const prompt = `You are an experienced accounting examiner marking one exam question.

QUESTION
${(questionText || '').slice(0, 1500)}

MARKING GUIDE — the correct statement(s):
${tablesToText(modelTables, 'Marking guide')}

${writtenModel ? `MARKING GUIDE — expected written explanation:\n${String(writtenModel).slice(0, 1500)}\n` : ''}
THE STUDENT'S SPREADSHEET:
${tablesToText(studentTables, "Student's spreadsheet")}

${writtenAnswer ? `THE STUDENT'S WRITTEN EXPLANATION:\n${String(writtenAnswer).slice(0, 2000)}\n` : 'THE STUDENT WROTE NO EXPLANATION.\n'}
MARKS AVAILABLE: ${totalPoints}

You are the marker. There is no requirement for the student's layout to match the marking guide — students structure a statement differently, label lines differently, add their own workings columns, and split work between the grid and the written explanation. Judge whether the accounting is right, not whether it sits in the same cell.

Mark as a human examiner would:
- Credit a correct figure wherever it appears — any row, any column, either the grid or the explanation.
- Treat the grid and the written explanation as ONE answer. Work shown in either earns its marks.
- Accept a figure stated with or without its unit: "1.5", "1.5:1", "4.64 times" and "28.57%" are the same answer as the guide's equivalent.
- Award own-figure (follow-on) marks ONLY where a later figure is correctly derived from an earlier value the student themselves got wrong. Own-figure credit NEVER applies to an independently computed value: if a figure differs from the guide and does not follow from the student's own earlier working, it is simply WRONG and earns nothing.
- Credit a valid alternative method that reaches a defensible answer. A different number is not an alternative method unless the student's own working supports it.
- Award NOTHING for figures or statements that appear nowhere in the student's work.
- The row labels and section headings were PRE-PRINTED in the blank sheet the student was given. They are not the student's work — award nothing for them.

HOW TO ALLOCATE THE ${totalPoints} MARKS
1. First identify the distinct outcomes the marking guide requires (each key figure, total, subtotal or conclusion).
2. Split the ${totalPoints} marks across those outcomes — they must add up to exactly ${totalPoints} if every one is achieved.
3. Then award each outcome in full, in part, or not at all, based on the student's work.

A complete and correct answer MUST receive all ${totalPoints} marks, however it is laid out. Do not hold marks back because the presentation differs from the guide.

For every mark you award you MUST quote the exact figure or phrase from the student's work that earned it, copied verbatim from their grid or explanation. A mark with no quotable evidence in the student's answer is not a mark.

Return ONLY this JSON:
{
  "awarded": [
    { "requirement": "<the outcome from the guide>", "marks": <marks you allocated to it and the student earned>, "evidence": "<exact figure or phrase copied from the student's answer>", "ownFigure": <true only if this credit is follow-on from the student's own earlier wrong value, otherwise false> }
  ],
  "missing": [{ "requirement": "<outcome not achieved>", "marks": <marks lost> }],
  "feedback": "<2-4 sentences: what was achieved, what was missing, and any own-figure credit given>"
}
The marks across "awarded" and "missing" together must total exactly ${totalPoints}.`;

  try {
    const groqClient = require('./groqClient');
    const response = await groqClient.generateContent(prompt, {
      model: 'smart',
      jsonMode: true,
      temperature: 0.1,
      maxTokens: 1024
    });

    let parsed = response?.parsedContent;
    if (!parsed && response?.text) {
      try { parsed = JSON.parse(response.text); } catch { /* fall through */ }
    }
    if (!parsed || typeof parsed !== 'object') return null;

    // Every awarded mark has to point at something the student actually wrote. Asked to mark
    // generously, a model will otherwise credit work that isn't there — on a near-empty sheet it
    // awarded half marks for "own-figure" follow-through that had no figures to follow. Checking
    // the quoted evidence against the student's own answer keeps the marking generous about
    // layout and method while staying anchored to what was really submitted.
    const evidenceIndex = buildEvidenceIndex(studentTables, writtenAnswer);
    const guideIndex = buildEvidenceIndex(modelTables, writtenModel);
    const awarded = Array.isArray(parsed.awarded) ? parsed.awarded : [];

    let score = 0;
    const credited = [];
    const rejected = [];
    for (const item of awarded) {
      const marks = Number(item?.marks);
      if (!Number.isFinite(marks) || marks <= 0) continue;
      const requirement = item?.requirement || 'requirement';

      // The quoted work has to exist in the student's answer.
      if (!evidenceFound(item?.evidence, evidenceIndex)) {
        rejected.push(`${requirement} — no matching work found`);
        continue;
      }

      // …and, unless the model has flagged it as follow-on from the student's own earlier value,
      // the figure has to be one the marking guide actually expects. Told repeatedly not to, the
      // model still credited a stock-turnover ratio of 3.87 against a guide of 4.64 as "own-figure"
      // work. Prompting alone could not hold that line, so it is checked here instead.
      const isOwnFigure = item?.ownFigure === true;
      const quoted = [...String(item?.evidence ?? '').matchAll(/-?\d[\d,.]*/g)]
        .map(mm => asNumber(mm[0]))
        .filter(n => !Number.isNaN(n));
      const matchesGuide = !quoted.length || quoted.some(n => hasNumber(n, guideIndex));

      if (!isOwnFigure && !matchesGuide) {
        rejected.push(`${requirement} — figure does not match the marking guide`);
        continue;
      }

      score += marks;
      credited.push(`${requirement} (${marks})`);
    }

    score = Math.max(0, Math.min(totalPoints, Math.round(score * 100) / 100));

    return {
      score,
      feedback: String(parsed.feedback || 'Marked by examiner review.').trim(),
      credited,
      rejected,
      missing: (Array.isArray(parsed.missing) ? parsed.missing : [])
        .slice(0, 8)
        .map(m => (typeof m === 'string' ? m : String(m?.requirement || '')))
        .filter(Boolean),
      aiGraded: true
    };
  } catch (err) {
    // Never fatal — the caller keeps the deterministic score.
    console.error('AI spreadsheet review unavailable:', err.message);
    return null;
  }
}

module.exports = { aiReviewSpreadsheetAnswer, tablesToText };
