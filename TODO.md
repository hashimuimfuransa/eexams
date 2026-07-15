# TODO (blackboxai)

## Goal
Fix all known bugs one by one in the areas discovered during repo exploration (selective answering + financial spreadsheet AI generation + retake/payment/subscription).

## Plan (high level)
1. **Selective answering flow**
   - Verify client restoration + toggling logic in `client/src/components/student/ExamInterface.jsx`.
   - Verify server enforcement and scoring consistency in `server/routes/exam.js` (`selectQuestion`, `completeExam` selective scoring).
   - Patch any mismatch (min-required counts, selectedQuestions state drift, wrong question id/section mapping, submission validation vs server grading).

2. **Financial spreadsheet AI generation + rendering**
   - Verify AI output normalization and coercion for `spreadsheetTemplate` / `spreadsheetModelAnswer` in `server/routes/exam.js`.
   - Verify canonical structure expected by `client/src/components/FinancialSpreadsheet.jsx` (Handsontable / HyperFormula tables contract).
   - Patch any cases where AI returns nested JSON objects/arrays that end up blank, or multi-table answers are not rendered.

3. **Retake / payment / subscription**
   - Validate retake enabling (`allowStudentRetake`) + request lifecycle and dashboard consumption.
   - Validate pending payment stuck states & activation polling logic.
   - Patch any mismatch causing duplicated charges, expired-but-still-active status issues, or retake not showing.

4. After each bug fix:
   - Add/adjust logging where needed.
   - Run the smallest possible sanity check (lint/build/tests if available).

## Progress tracking
- [ ] Step 1: Selective answering bug #1 (unknown)
- [ ] Step 2: Selective answering bug #2 (unknown)
- [ ] Step 3: Financial spreadsheet bug #1 (unknown)
- [ ] Step 4: Retake/payment/subscription bug #1 (unknown)
- [ ] Step 5: Regression checks

