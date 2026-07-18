// Grading for 'financial-spreadsheet' (table-completion) questions.
// A question can require one or several financial-statement tables (e.g. "prepare both an
// Income Statement and a Statement of Financial Position" in one question). Both the student's
// answer and the model answer are stored as a JSON string of the shape
// { tables: [{ title, headers, data: string[][] }, ...] } (see FinancialSpreadsheet.jsx `serialise`).
// The student's grid starts as a copy of the teacher's template, so label/header cells the
// student never touches already match the model answer; only the blank cells the student was
// meant to fill in actually discriminate the score.

// A single table entry may come from the AI/legacy data in a few shapes:
//  - { title?, headers: [...], data: [[...]] }               (canonical)
//  - flat "label: value" object, e.g. {"Revenue":800000}      (AI drift, no headers/data keys)
// Coerce either into the canonical shape. Returns null if nothing usable is found.
function coerceTable(t) {
  if (!t || typeof t !== 'object') return null;
  if (Array.isArray(t.data)) {
    return {
      title: typeof t.title === 'string' ? t.title : '',
      headers: Array.isArray(t.headers) ? t.headers : [],
      data: t.data
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

function cellsEqual(studentVal, modelVal) {
  const studentStr = (studentVal ?? '').toString().trim();
  const modelStr = (modelVal ?? '').toString().trim();

  if (modelStr === '') return true; // nothing expected here
  if (studentStr === '') return false;

  if (studentStr.toLowerCase() === modelStr.toLowerCase()) return true;

  // Numeric comparison with tolerance for rounding / formatting differences
  // (e.g. "1,234.00" vs 1234, or currency symbols)
  const toNumber = (s) => {
    const cleaned = s.replace(/[,$%\s]/g, '');
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : NaN;
  };
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

  pairs.forEach(({ modelTable, studentTable }, tableIdx) => {
    let tableGradable = 0;
    let tableCorrect = 0;
    const rowCount = modelTable.data.length;

    for (let r = 0; r < rowCount; r++) {
      const modelRow = modelTable.data[r] || [];
      const studentRow = (studentTable.data || [])[r] || [];
      for (let c = 0; c < modelRow.length; c++) {
        const modelVal = modelRow[c];
        if (modelVal === undefined || modelVal === null || String(modelVal).trim() === '') continue;

        tableGradable++;
        const studentVal = studentRow[c];
        if (cellsEqual(studentVal, modelVal)) {
          tableCorrect++;
        } else if (mismatches.length < 10) {
          mismatches.push({ table: modelTable.title || `Table ${tableIdx + 1}`, row: r, col: c, expected: modelVal, got: studentVal ?? '' });
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
  const score = Math.round(ratio * points);
  const isCorrect = score >= points;
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
async function gradeFinancialSpreadsheetWithWritten(question, answer, modelAnswer) {
  const totalPoints = question.points || 1;
  const requiresWritten = !!question.requiresWrittenAnswer;
  const writtenPoints = requiresWritten ? Math.max(0, Math.min(question.writtenAnswerPoints || 0, totalPoints)) : 0;
  const spreadsheetPoints = Math.max(0, totalPoints - writtenPoints);

  const spreadsheetResult = gradeFinancialSpreadsheet({ ...question, points: spreadsheetPoints }, answer, modelAnswer);

  if (!requiresWritten || writtenPoints <= 0) {
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
    // Lazily required to avoid a require cycle at module load if aiGrading.js ever imports
    // something from this file in the future.
    const { gradeOpenEndedAnswer } = require('./aiGrading');
    const graded = await gradeOpenEndedAnswer(
      writtenAnswer,
      question.writtenAnswerModelAnswer || '',
      writtenPoints,
      question.writtenAnswerPrompt || question.text || ''
    );
    writtenResult = { score: graded.score, feedback: graded.feedback, correctedAnswer: graded.correctedAnswer };
  }

  const combinedScore = (spreadsheetResult.score || 0) + (writtenResult.score || 0);

  return {
    score: combinedScore,
    isCorrect: combinedScore >= totalPoints,
    feedback: `Spreadsheet: ${spreadsheetResult.feedback}\n\nWritten answer: ${writtenResult.feedback}`,
    correctedAnswer: spreadsheetResult.correctedAnswer,
    gradingMethod: 'spreadsheet_and_written_grading',
    writtenAnswerScore: writtenResult.score,
    writtenAnswerFeedback: writtenResult.feedback,
    details: {
      answerType: 'financial-spreadsheet',
      spreadsheet: spreadsheetResult.details,
      written: { points: writtenPoints, ...writtenResult }
    }
  };
}

module.exports = { gradeFinancialSpreadsheet, gradeFinancialSpreadsheetWithWritten, parseSheets, parseSheet: parseSheets, coerceToTables, coerceToGrid, cellsEqual };
