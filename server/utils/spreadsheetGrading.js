// Grading for 'financial-spreadsheet' (table-completion) questions.
// A question can require one or several financial-statement tables (e.g. "prepare both an
// Income Statement and a Statement of Financial Position" in one question). Both the student's
// answer and the model answer are stored as a JSON string of the shape
// { tables: [{ title, headers, data: string[][] }, ...] } (see FinancialSpreadsheet.jsx `serialise`).
// The student's grid starts as a copy of the teacher's template, so label/header cells the
// student never touches already match the model answer; only the blank cells the student was
// meant to fill in actually discriminate the score.

const { withOverrides } = require('./toPlainDoc');
const { aiReviewSpreadsheetAnswer } = require('./spreadsheetAiGrading');

// A single table entry may come from the AI/legacy data in a few shapes:
//  - { title?, headers: [...], data: [[...]] }               (canonical)
//  - flat "label: value" object, e.g. {"Revenue":800000}      (AI drift, no headers/data keys)
// Coerce either into the canonical shape. Returns null if nothing usable is found.
function coerceTable(t) {
  if (!t || typeof t !== 'object') return null;
  if (Array.isArray(t.data)) {
    // `formulas` (the raw "=SUM(B2:B10)" behind a value) and `givenColumns` (which columns the
    // student receives pre-filled) are carried through untouched. Neither affects grading — only
    // `data` is compared — but normalizeSpreadsheetField() re-serialises through here, so
    // dropping them would silently discard a teacher's column setup and everyone's formulas.
    return {
      title: typeof t.title === 'string' ? t.title : '',
      headers: Array.isArray(t.headers) ? t.headers : [],
      data: t.data,
      ...(Array.isArray(t.formulas) && t.formulas.length ? { formulas: t.formulas } : {}),
      ...(Array.isArray(t.givenColumns) ? { givenColumns: t.givenColumns } : {})
    };
  }
  const entries = Object.entries(t).filter(([key]) => !['headers', 'data', 'title'].includes(key));
  if (entries.length === 0) return null;
  return {
    title: typeof t.title === 'string' ? t.title : '',
    headers: ['Item', 'Amount'],
    data: entries.map(([key, value]) => [key, value === null || value === undefined ? '' : String(value)])
  };
}

// Normalizes any of the shapes the AI/legacy data may produce into { tables: [...] }:
//  - { tables: [ {title, headers, data}, ... ] }   (canonical, multi-table)
//  - [ {title, headers, data}, ... ]               (bare array of tables)
//  - { headers: [...], data: [[...]] }             (legacy single-table shape)
//  - flat "label: value" object                    (AI drift)
function coerceToTables(parsed) {
  if (!parsed || typeof parsed !== 'object') return null;
  if (Array.isArray(parsed)) {
    const tables = parsed.map(coerceTable).filter(Boolean);
    return tables.length ? { tables } : null;
  }
  if (Array.isArray(parsed.tables)) {
    const tables = parsed.tables.map(coerceTable).filter(Boolean);
    return tables.length ? { tables } : null;
  }
  const single = coerceTable(parsed);
  return single ? { tables: [single] } : null;
}

// Kept as an alias: routes/exam.js's normalizeSpreadsheetField() only cares that this returns
// something JSON-serialisable in the canonical shape.
const coerceToGrid = coerceToTables;

function parseSheets(raw) {
  if (!raw) return null;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return coerceToTables(parsed);
  } catch {
    return null;
  }
}

const CURRENCY_CODE = 'frw|rwf|ksh|kes|usd|eur|gbp|ugx|tzs|zar|ngn|rs';
const LEADING_CURRENCY_RE  = new RegExp(`^(?:${CURRENCY_CODE})\\s*(?=[\\d.+-])`, 'i');
const TRAILING_CURRENCY_RE = new RegExp(`([\\d.])\\s*(?:${CURRENCY_CODE})$`, 'i');

// Shared by cellsEqual and the layout-tolerant matchers below.
const toNumber = (s) => {
  let str = String(s ?? '').trim();
  if (str === '') return NaN;
  const bracketed = /^\(.*\)$/.test(str);
  if (bracketed) str = str.slice(1, -1);
  str = str
    .replace(LEADING_CURRENCY_RE, '')             // "Frw 5,400,000"
    .replace(TRAILING_CURRENCY_RE, '$1')          // "5,400,000 Frw"
    .replace(/[,$€£¥₹₦%\s]/g, '');                // separators, percent and currency symbols
  const n = Number(str);
  if (!Number.isFinite(n)) return NaN;
  return bracketed ? -n : n;
};

// Ratio-analysis guides state a value with its unit — "1.5:1", "4.64 times", "28.57%", "45 days" —
// while a student typically types the bare number the calculator gave them. Splitting the unit off
// lets the figures be compared, and comparing the units afterwards keeps "45 days" from matching
// "45 years".
const UNIT_SUFFIX_RE = /(:\s*1|%|times?|days?|weeks?|months?|years?|x)\s*$/i;

function splitUnit(value) {
  const str = String(value ?? '').trim();
  const match = str.match(UNIT_SUFFIX_RE);
  if (!match) return { body: str, unit: '' };
  const unit = match[1].replace(/\s+/g, '').toLowerCase().replace(/s$/, '');
  return {
    body: str.slice(0, match.index).trim(),
    unit: unit === ':1' || unit === 'x' ? 'ratio' : unit
  };
}

/** Decimal places the marking guide chose to state — the precision it expects. */
function decimalsOf(value) {
  const match = String(value ?? '').match(/\.(\d+)\s*$/);
  return match ? Math.min(match[1].length, 6) : 0;
}

function cellsEqual(studentVal, modelVal) {
  const studentStr = (studentVal ?? '').toString().trim();
  const modelStr = (modelVal ?? '').toString().trim();

  if (modelStr === '') return true; // nothing expected here
  if (studentStr === '') return false;

  if (studentStr.toLowerCase() === modelStr.toLowerCase()) return true;

  // Unit-aware numeric comparison, tried before the plain money comparison below.
  const s = splitUnit(studentStr);
  const m = splitUnit(modelStr);
  if (s.unit || m.unit) {
    const sNum = toNumber(s.body);
    const mNum = toNumber(m.body);
    if (!Number.isNaN(sNum) && !Number.isNaN(mNum)) {
      // "45 days" is not "45 years"; but a bare "45" against "45 days" is the right figure.
      if (s.unit && m.unit && s.unit !== m.unit) return false;
      // Judge at the precision the guide states: a guide of "2.3:1" accepts 2.3333333333.
      const dp = decimalsOf(m.body);
      if (Number(sNum.toFixed(dp)) === Number(mNum.toFixed(dp))) return true;
      const tolerance = Math.max(Math.abs(mNum) * 0.01, 0.01);
      return Math.abs(sNum - mNum) <= tolerance;
    }
  }

  // Numeric comparison with tolerance for rounding / formatting differences, e.g. "1,234.00" vs
  // 1234. Two accounting conventions have to be understood or correct work is marked wrong:
  //   - a bracketed figure is negative — "(500)" means -500, and it is how every marking guide
  //     and the sheet's own accounting format render a negative;
  //   - a figure may carry its currency inline — "Frw 2,638,000", "KSh 4,000", "£120".
  // Both previously produced NaN, and a NaN on either side fell through to `return false`, so a
  // student who wrote "(500)" against a model answer of "-500" scored zero for that cell.
  // Kept in step with toNumber() in client/src/components/FinancialSpreadsheet.jsx — the sheet's
  // status bar and number formatting use the same rules, so what a student sees adding up is what
  // gets marked. Currency words are matched against a fixed list rather than "any short word":
  // stripping any short word would make a ratio-analysis "45 days" equal a bare "45", and a
  // ledger date like "July 6" (present in these questions) parse as the number 6.
  const studentNum = toNumber(studentStr);
  const modelNum = toNumber(modelStr);

  if (!Number.isNaN(studentNum) && !Number.isNaN(modelNum)) {
    const tolerance = Math.max(Math.abs(modelNum) * 0.01, 0.01);
    return Math.abs(studentNum - modelNum) <= tolerance;
  }

  return false;
}

function normalizeTitle(title) {
  return (title || '').toString().trim().toLowerCase();
}

// ── Layout-tolerant matching ──────────────────────────────────────────────────
// Strict position matching punishes a student for laying the statement out differently from the
// marking guide even when every figure is right: insert one row, add a workings column, or put
// the same line item two rows further down, and everything below shifts and scores zero. These
// matchers find a model cell's value wherever the student actually put it, so marks follow the
// accounting, not the geometry.

// The text that names a row — normally the line item ("Cost of Sales"), which is what a marker
// reads the row by. Skips numeric cells so a row starting with a date or code still resolves.
function rowLabel(row) {
  for (const cell of row || []) {
    const s = String(cell ?? '').trim();
    if (s && Number.isNaN(toNumber(s))) return s.toLowerCase().replace(/\s+/g, ' ');
  }
  return '';
}

function indexRowsByLabel(table) {
  const index = new Map();
  (table?.data || []).forEach((row, r) => {
    const label = rowLabel(row);
    if (!label) return;
    if (!index.has(label)) index.set(label, []);
    index.get(label).push(r);
  });
  return index;
}

/**
 * Finds `modelVal` anywhere in the student's answer, trying the strictest match first.
 *
 * The principle is the marker's: if the required figure is present and correct, it earns its mark
 * wherever the student put it. Position is only used to prefer the most likely match when the same
 * value appears more than once — it is never a requirement.
 *
 * Two safeguards keep that from becoming a giveaway:
 *   - `used` records student cells already credited, so one figure can never satisfy two model
 *     cells (a statement that legitimately repeats a total still needs it entered twice);
 *   - `wasGiven` excludes cells the blank template already contained, so a number handed to the
 *     student in the question can't be credited as though they had worked it out.
 *
 * @returns {string|null} how it matched, if at all
 */
function locateModelCell({
  modelVal, modelRow, rowIdx, colIdx, tableIdx,
  studentTable, studentByLabel, allStudentTables, used, wasGiven
}) {
  const data = studentTable?.data || [];
  const take = (t, r, c) => {
    const key = `${t}:${r}:${c}`;
    if (used.has(key)) return false;
    used.add(key);
    return true;
  };

  // 1. Same cell the marking guide uses.
  if (cellsEqual(data[rowIdx]?.[colIdx], modelVal) && take(tableIdx, rowIdx, colIdx)) return 'position';

  const label = rowLabel(modelRow);
  const candidateRows = label ? (studentByLabel.get(label) || []) : [];

  // 2. Row moved, but the figure is in the expected column of that row.
  for (const r of candidateRows) {
    if (cellsEqual(data[r]?.[colIdx], modelVal) && take(tableIdx, r, colIdx)) return 'row-label';
  }

  // 3. Row moved and columns shifted — the figure is somewhere on the right line.
  for (const r of candidateRows) {
    const row = data[r] || [];
    for (let c = 0; c < row.length; c++) {
      if (c === colIdx) continue;
      if (cellsEqual(row[c], modelVal) && take(tableIdx, r, c)) return 'row-label-any-column';
    }
  }

  // 4. The student restructured the statement — find the figure anywhere in this table, ignoring
  //    cells the template already gave them.
  for (let r = 0; r < data.length; r++) {
    const row = data[r] || [];
    for (let c = 0; c < row.length; c++) {
      if (wasGiven(tableIdx, r, c)) continue;
      if (cellsEqual(row[c], modelVal) && take(tableIdx, r, c)) return 'anywhere-in-table';
    }
  }

  // 5. Last resort: the student put it on another sheet (e.g. all workings on one tab).
  for (let t = 0; t < allStudentTables.length; t++) {
    if (allStudentTables[t] === studentTable) continue;
    const rows = allStudentTables[t]?.data || [];
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r] || [];
      for (let c = 0; c < row.length; c++) {
        if (wasGiven(t, r, c)) continue;
        if (cellsEqual(row[c], modelVal) && take(t, r, c)) return 'another-table';
      }
    }
  }

  return null;
}

// Pairs each model table with the best-matching student table: by title first (case-insensitive),
// falling back to positional index. This keeps grading robust whether the student left the
// teacher's table titles untouched, renamed them, or added/removed extra tables of their own.
function pairTables(modelTables, studentTables) {
  const usedStudentIdx = new Set();
  return modelTables.map((modelTable, i) => {
    let studentIdx = -1;
    if (modelTable.title) {
      studentIdx = studentTables.findIndex((st, si) => !usedStudentIdx.has(si) && normalizeTitle(st.title) === normalizeTitle(modelTable.title));
    }
    if (studentIdx === -1 && !usedStudentIdx.has(i) && studentTables[i]) {
      studentIdx = i;
    }
    if (studentIdx !== -1) usedStudentIdx.add(studentIdx);
    return { modelTable, studentTable: studentIdx !== -1 ? studentTables[studentIdx] : { data: [] } };
  });
}

/**
 * Compare a student's spreadsheet answer against the model answer and
 * produce a proportional score, matching the pattern used by matching/ordering grading.
 * Supports questions with multiple statement tables (e.g. Income Statement + Balance Sheet).
 * @param {Object} question - Question doc/object with `points` and `correctAnswer` (JSON string of the model tables)
 * @param {Object} answer - Result answer with `textAnswer` (JSON string of the student's tables)
 * @param {string} modelAnswer - Fallback model answer JSON string (usually question.correctAnswer)
 */
function gradeFinancialSpreadsheet(question, answer, modelAnswer) {
  const points = question.points || 1;
  const studentSheets = parseSheets(answer?.textAnswer);
  const modelSheets = parseSheets(question?.spreadsheetModelAnswer || modelAnswer);

  if (!studentSheets) {
    return {
      score: 0,
      isCorrect: false,
      feedback: 'No spreadsheet answer was submitted.',
      correctedAnswer: modelAnswer,
      gradingMethod: 'no_answer'
    };
  }

  if (!modelSheets) {
    // No model answer to compare against - can't auto-grade, needs manual review
    return {
      score: 0,
      isCorrect: false,
      feedback: 'No model answer is available for this spreadsheet question. Manual grading is required.',
      correctedAnswer: modelAnswer,
      gradingMethod: 'spreadsheet_grading'
    };
  }

  const pairs = pairTables(modelSheets.tables, studentSheets.tables);

  let gradableCells = 0;
  let correctCells = 0;
  const mismatches = [];
  const perTable = [];

  // How many cells were credited somewhere other than the marking guide's own position — used
  // only to explain the score, since a relocated figure is still worth full marks.
  let relocatedCells = 0;

  // Shared across every table: a figure the student entered once can only ever earn one mark,
  // even when the search widens to other sheets.
  const used = new Set();
  const allStudentTables = studentSheets.tables || [];

  // Cells the blank template already contained are the question's own data, not the student's
  // work, so the wide searches below must not credit them.
  const templateTables = parseSheets(question?.spreadsheetTemplate)?.tables || [];
  const wasGiven = (t, r, c) => {
    const given = String(templateTables[t]?.data?.[r]?.[c] ?? '').trim();
    if (!given) return false;
    return given === String(allStudentTables[t]?.data?.[r]?.[c] ?? '').trim();
  };

  // Cells the template supplied are also not worth marks. They used to be counted as gradable AND
  // automatically correct, because the student's sheet starts as a copy of the template — which
  // put a floor of "50% for a completely blank answer" under every score, and charged a student
  // who relabelled a line ("Turnover" for "Sales") for a label they were never asked to produce.
  // Marks now attach only to what the student actually had to work out.
  const templateSuppliedAt = (t, r, c) =>
    String(templateTables[t]?.data?.[r]?.[c] ?? '').trim() !== '';
  const excludeGivenCells = templateTables.length > 0;

  pairs.forEach(({ modelTable, studentTable }, tableIdx) => {
    let tableGradable = 0;
    let tableCorrect = 0;
    const rowCount = modelTable.data.length;
    const studentByLabel = indexRowsByLabel(studentTable);

    for (let r = 0; r < rowCount; r++) {
      const modelRow = modelTable.data[r] || [];
      for (let c = 0; c < modelRow.length; c++) {
        const modelVal = modelRow[c];
        if (modelVal === undefined || modelVal === null || String(modelVal).trim() === '') continue;
        // Given to the student in the blank sheet — scaffolding, not an answer.
        if (excludeGivenCells && templateSuppliedAt(tableIdx, r, c)) continue;

        tableGradable++;
        const how = locateModelCell({
          modelVal, modelRow, rowIdx: r, colIdx: c, tableIdx,
          studentTable, studentByLabel, allStudentTables, used, wasGiven
        });
        if (how) {
          tableCorrect++;
          if (how !== 'position') relocatedCells++;
        } else if (mismatches.length < 10) {
          mismatches.push({
            table: modelTable.title || `Table ${tableIdx + 1}`,
            row: r, col: c, expected: modelVal,
            got: (studentTable.data || [])[r]?.[c] ?? ''
          });
        }
      }
    }

    gradableCells += tableGradable;
    correctCells += tableCorrect;
    perTable.push({ title: modelTable.title || `Table ${tableIdx + 1}`, correctCells: tableCorrect, gradableCells: tableGradable });
  });

  if (gradableCells === 0) {
    return {
      score: 0,
      isCorrect: false,
      feedback: 'The model answer has no fillable cells to grade against. Manual grading is required.',
      correctedAnswer: modelAnswer,
      gradingMethod: 'spreadsheet_grading'
    };
  }

  const ratio = correctCells / gradableCells;
  // Kept to 2dp rather than rounded to a whole mark. A spreadsheet answer is scored across many
  // cells but the question may be worth only a handful of marks, so Math.round() threw away all
  // partial credit: 32 of 126 cells correct on a 1-mark part rounded to 0, and a student who had
  // genuinely filled in correct figures was told they scored nothing. Anything under half a mark
  // used to vanish entirely.
  const score = Math.round(ratio * points * 100) / 100;
  const isCorrect = correctCells === gradableCells;
  const tableNote = modelSheets.tables.length > 1 ? ` across ${modelSheets.tables.length} tables` : '';

  const feedback = ratio === 1
    ? `All ${gradableCells} filled cells are correct${tableNote}!`
    : `${correctCells}/${gradableCells} filled cells are correct${tableNote}.`;

  return {
    score,
    isCorrect,
    feedback,
    correctedAnswer: modelAnswer,
    gradingMethod: 'spreadsheet_grading',
    details: {
      answerType: 'financial-spreadsheet',
      correctCells,
      gradableCells,
      accuracy: ratio,
      mismatches,
      perTable
    }
  };
}

/**
 * Grades a financial-spreadsheet question that may ALSO require an optional written/explanatory
 * answer alongside the grid (e.g. "prepare the income statement AND comment on why gross profit
 * changed"). The two parts are graded independently — the spreadsheet cell-by-cell as usual, the
 * written part via AI open-ended grading against the teacher's writtenAnswerModelAnswer — and
 * combined into a single score/feedback so every existing caller of gradeFinancialSpreadsheet can
 * be swapped for this without changing how it consumes the result.
 *
 * When question.requiresWrittenAnswer is falsy (the common case today), this is exactly
 * equivalent to calling gradeFinancialSpreadsheet directly — the written half is skipped.
 *
 * @param {Object} question - question (or sub-question) object with points/spreadsheetModelAnswer
 *   and optionally requiresWrittenAnswer/writtenAnswerModelAnswer/writtenAnswerPoints
 * @param {Object} answer - student's answer: { textAnswer (spreadsheet JSON), writtenAnswer }
 * @param {string} modelAnswer - fallback spreadsheet model answer if question.spreadsheetModelAnswer is unset
 * @returns {Promise<Object>} - same shape as gradeFinancialSpreadsheet, plus a `details.written` block when graded
 */
/**
 * True when the student added something of their own — any cell the blank template did not
 * already contain, or any written answer. Comparing against the template rather than against
 * "is the sheet empty" matters because the template pre-fills the row labels, so an untouched
 * sheet is never actually empty.
 */
function hasStudentContribution(question, answer, writtenAnswer) {
  if (String(writtenAnswer || '').trim()) return true;

  const studentTables = parseSheets(answer?.textAnswer)?.tables || [];
  if (!studentTables.length) return false;

  const templateTables = parseSheets(question?.spreadsheetTemplate)?.tables || [];
  const givenAt = (t, r, c) => {
    const val = templateTables[t]?.data?.[r]?.[c];
    return String(val ?? '').trim();
  };

  for (let t = 0; t < studentTables.length; t++) {
    const rows = studentTables[t]?.data || [];
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r] || [];
      for (let c = 0; c < row.length; c++) {
        const value = String(row[c] ?? '').trim();
        if (!value) continue;
        // Anything not already handed to them in the template counts as their own work.
        if (value !== givenAt(t, r, c)) return true;
      }
    }
  }
  return false;
}

/**
 * How many of the question's marks belong to the written half.
 *
 * `writtenAnswerPoints` is routinely left unset even when a teacher has ticked "requires a written
 * answer" and written a full marking guide for it. The old code read `writtenAnswerPoints || 0`,
 * got 0, and returned early — so the student's written answer was never marked at all and the
 * whole question rode on the grid. This resolves a share instead of dropping the half:
 *
 *   1. the teacher's explicit split, when they set one;
 *   2. failing that, the marks the marking guide annotates itself — accounting guides are written
 *      as "PI A = 163,305,000/105,000,000 = 1.5553 (1 mark)", so those add up to the real weight;
 *   3. failing that, an even split, since a required written answer must be worth something.
 */
function resolveWrittenPoints(question, totalPoints) {
  const explicit = Number(question.writtenAnswerPoints);
  if (Number.isFinite(explicit) && explicit > 0) return Math.min(explicit, totalPoints);

  const guide = String(question.writtenAnswerModelAnswer || '');
  let annotated = 0;
  for (const match of guide.matchAll(/\(\s*(\d+(?:\.\d+)?)\s*marks?\s*\)/gi)) {
    annotated += Number(match[1]);
  }
  // Must leave something for the spreadsheet, or the grid stops counting.
  if (annotated > 0 && annotated < totalPoints) return annotated;

  return Math.round((totalPoints / 2) * 100) / 100;
}

async function gradeFinancialSpreadsheetWithWritten(question, answer, modelAnswer) {
  const totalPoints = question.points || 1;
  const studentWrote = !!String(answer?.writtenAnswer || '').trim();
  const hasWrittenGuide = !!String(question.writtenAnswerModelAnswer || '').trim();

  // Mark the written half whenever the teacher asked for one, and also when they supplied a
  // marking guide for it and the student actually wrote something — a guide exists precisely so
  // that part can be marked.
  const gradeWritten = !!question.requiresWrittenAnswer || (hasWrittenGuide && studentWrote);
  const writtenPoints = gradeWritten ? resolveWrittenPoints(question, totalPoints) : 0;
  const spreadsheetPoints = Math.max(0, totalPoints - writtenPoints);

  const spreadsheetResult = gradeFinancialSpreadsheet(withOverrides(question, { points: spreadsheetPoints }), answer, modelAnswer);

  if (!gradeWritten || writtenPoints <= 0) {
    return spreadsheetResult;
  }

  const writtenAnswer = (answer?.writtenAnswer || '').trim();
  let writtenResult;
  if (!writtenAnswer) {
    writtenResult = {
      score: 0,
      feedback: 'No written answer was submitted for the part that requires one.',
      correctedAnswer: question.writtenAnswerModelAnswer || ''
    };
  } else {
    // Isolated so a failure in the written half can never discard the spreadsheet half. The
    // require is lazy (avoiding a cycle if aiGrading ever imports from here) and pulls in
    // groqClient, which throws outright when GROQ_API_KEY is unset — without this guard that
    // threw straight past the caller and the whole question kept its previous score, so a
    // regrade appeared to do nothing.
    try {
      const { gradeOpenEndedAnswer } = require('./aiGrading');
      const graded = await gradeOpenEndedAnswer(
        writtenAnswer,
        question.writtenAnswerModelAnswer || '',
        writtenPoints,
        question.writtenAnswerPrompt || question.text || ''
      );
      writtenResult = {
        score: Number(graded?.score) || 0,
        feedback: graded?.feedback || 'Written answer graded.',
        correctedAnswer: graded?.correctedAnswer || question.writtenAnswerModelAnswer || ''
      };
    } catch (err) {
      console.error('Written-answer grading failed for a financial-spreadsheet question:', err.message);
      writtenResult = {
        score: 0,
        feedback: 'The written answer could not be marked automatically and needs manual review.',
        correctedAnswer: question.writtenAnswerModelAnswer || '',
        needsManualReview: true
      };
    }
  }

  // Both halves are capped at their own allocation before being added, so an over-generous AI
  // score on the written part can never push the question past what it is worth.
  const writtenScore = Math.min(Math.max(writtenResult.score || 0, 0), writtenPoints);
  const combinedScore = Math.round(((spreadsheetResult.score || 0) + writtenScore) * 100) / 100;

  // ── Holistic AI review ──────────────────────────────────────────────────────
  // The two halves above are marked in isolation: figures against cells, prose against the
  // written guide. A student who computed in the grid and justified in words — or who used a
  // valid alternative method, or carried an early slip through correctly — is short-changed by
  // that split. This marks both together, and can only raise the score, so a cautious or
  // unavailable model leaves the cell-matched marks standing.
  const sheetDetails = spreadsheetResult.details || {};
  let aiResult = null;
  // Only worth asking when the student actually put something in. The template hands them the row
  // labels, so a completely untouched sheet still "matches" those cells — and an examiner model
  // shown that sheet will read the given labels as the student's own work and award marks for a
  // blank answer. Deterministic marking already tolerates that floor; the AI must not build on it.
  if (combinedScore < totalPoints && hasStudentContribution(question, answer, writtenAnswer)) {
    aiResult = await aiReviewSpreadsheetAnswer({
      questionText: question.text || question.writtenAnswerPrompt || '',
      modelTables: parseSheets(question.spreadsheetModelAnswer || modelAnswer)?.tables || [],
      studentTables: parseSheets(answer?.textAnswer)?.tables || [],
      writtenModel: question.writtenAnswerModelAnswer || '',
      writtenAnswer,
      totalPoints,
      deterministic: {
        correctCells: sheetDetails.correctCells || 0,
        gradableCells: sheetDetails.gradableCells || 0
      }
    });
  }

  // The examiner review is the primary judgement: exact cell matching cannot recognise a correct
  // answer laid out differently, reached by another valid method, or split between the grid and
  // the explanation. Cell matching stays as a floor so a literally-perfect answer can never be
  // marked down by a cautious or unavailable model. Every mark the review awards has already been
  // checked against something the student actually wrote (see spreadsheetAiGrading.js), which is
  // what keeps "mark the substance" from becoming "mark whatever the model imagines".
  const usedAi = !!aiResult && aiResult.score > combinedScore;
  const finalScore = usedAi ? aiResult.score : combinedScore;

  return {
    score: finalScore,
    isCorrect: finalScore >= totalPoints,
    feedback: `Spreadsheet (${spreadsheetResult.score || 0}/${spreadsheetPoints}): ${spreadsheetResult.feedback}`
      + `\nWritten answer (${writtenScore}/${writtenPoints}): ${writtenResult.feedback}`
      + (usedAi ? `\n\nExaminer review (${finalScore}/${totalPoints}): ${aiResult.feedback}` : ''),
    correctedAnswer: spreadsheetResult.correctedAnswer,
    gradingMethod: usedAi ? 'spreadsheet_written_and_ai_review' : 'spreadsheet_and_written_grading',
    writtenAnswerScore: writtenScore,
    writtenAnswerFeedback: writtenResult.feedback,
    details: {
      answerType: 'financial-spreadsheet',
      spreadsheet: spreadsheetResult.details,
      written: { ...writtenResult, points: writtenPoints, score: writtenScore },
      ...(aiResult ? { aiReview: { ...aiResult, applied: usedAi, cellMatchedScore: combinedScore } } : {})
    }
  };
}

module.exports = { gradeFinancialSpreadsheet, gradeFinancialSpreadsheetWithWritten, parseSheets, parseSheet: parseSheets, coerceToTables, coerceToGrid, cellsEqual };
