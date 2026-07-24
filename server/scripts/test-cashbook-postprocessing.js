/**
 * Fast, offline unit test for the Cash Book Dr/Cr post-processing safety net
 * (server/routes/exam.js: fixCashBookBalance, blankOutUnusedCashBookCells) — no Groq API call,
 * no Express/Mongo, no API key required. Verifies the exact bug this safety net was added to
 * cover: unlike Ledger/Trial Balance tables (headers containing "Debit"/"Credit"), a Cash Book's
 * headers use the "(Dr)"/"(Cr)" abbreviation per the prompt's own formatting rule, so the older
 * safety net keyed on the literal words "Debit"/"Credit" (fixDebitCreditPlacement etc.) always skipped it.
 *
 * Usage: node server/scripts/test-cashbook-postprocessing.js
 */

process.env.GROQ_API_KEY = process.env.GROQ_API_KEY || 'unused-for-this-test';
const { fixCashBookBalance, blankOutUnusedCashBookCells, fixDebitCreditPlacement } = require('../routes/exam.js');

let failures = 0;
function check(name, fn) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
  } catch (err) {
    failures++;
    console.error(`  FAIL  ${name}\n        ${err.message}`);
  }
}
function assertEqual(actual, expected, msg) {
  if (actual !== expected) throw new Error(`${msg}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

console.log('Cash Book post-processing safety net\n');

check('fixCashBookBalance tops up an undervalued "Bal c/d" row so Dr total === Cr total', () => {
  const table = {
    title: 'Adjusted Cash Book',
    headers: ['Details (Dr)', 'Amount', 'Details (Cr)', 'Amount'],
    data: [
      ['Balance b/d', 3350000, 'Dishonoured cheque', 1640000],
      ['Direct deposit', 260000, 'Bank charges', 250000],
      ['', '', 'Bal c/d', 500000], // wrong — AI under-computed the balancing figure
      ['Total', 3610000, 'Total', 2390000],
    ],
  };
  fixCashBookBalance(table);
  const drTotal = table.data.slice(0, 3).reduce((s, r) => s + Number(r[1] || 0), 0);
  const crTotal = table.data.slice(0, 3).reduce((s, r) => s + Number(r[3] || 0), 0);
  assertEqual(drTotal, crTotal, 'Dr/Cr totals after fix');
  assertEqual(table.data[2][3], 1720000, 'corrected Bal c/d amount');
  const totalsRow = table.data[3];
  assertEqual(totalsRow[1], totalsRow[3], 'grand total row identical on both sides');
});

check('fixCashBookBalance leaves an already-balanced table untouched (besides totals row)', () => {
  const table = {
    title: 'Cash Book',
    headers: ['Details (Dr)', 'Amount', 'Details (Cr)', 'Amount'],
    data: [
      ['Balance b/d', 1000, 'Rent paid', 400],
      ['', '', 'Bal c/d', 600],
      ['Total', 1000, 'Total', 1000],
    ],
  };
  const before = JSON.stringify(table.data.slice(0, 2));
  fixCashBookBalance(table);
  assertEqual(JSON.stringify(table.data.slice(0, 2)), before, 'non-totals rows unchanged');
});

check('fixCashBookBalance does nothing to a non-Cash-Book table (no (Dr)/(Cr) headers)', () => {
  const table = {
    title: 'Trial Balance',
    headers: ['Item', 'Debit', 'Credit'],
    data: [['Capital', '', 1000], ['Cash', 1000, '']],
  };
  const before = JSON.stringify(table);
  fixCashBookBalance(table);
  assertEqual(JSON.stringify(table), before, 'trial balance table untouched');
});

check('blankOutUnusedCashBookCells blanks a stray 0 where the label cell is empty', () => {
  const table = {
    title: 'Cash Book',
    headers: ['Details (Dr)', 'Amount', 'Details (Cr)', 'Amount'],
    data: [
      ['Balance b/d', 1000, '', 0], // AI wrote 0 instead of "" for the unused Cr side
      ['', 0, 'Rent paid', 400],
    ],
  };
  blankOutUnusedCashBookCells(table);
  assertEqual(table.data[0][3], '', 'unused Cr amount blanked');
  assertEqual(table.data[1][1], '', 'unused Dr amount blanked');
  assertEqual(table.data[0][1], 1000, 'real Dr amount left alone');
  assertEqual(table.data[1][3], 400, 'real Cr amount left alone');
});

check('fixDebitCreditPlacement ignores a next-period "Balance b/d" continuation row when checking balance (ledger-style Cash Book, found via live image testing)', () => {
  const table = {
    title: 'Cash Book (Bank column only)',
    headers: ['Date', 'Particulars', 'Ref', 'Bank Dr (Receipts)', 'Bank Cr (Payments)'],
    data: [
      ['13-Jul', 'Cash sales banked', 'CB/CS', 350000, ''],
      ['16-Jul', 'Pierre (receipt)', 'CB/Pierre', 1050000, ''],
      ['24-Jul', 'Vincent (on account)', 'CB/Vincent', 250000, ''],
      ['19-Jul', 'Kasinza (settlement)', 'CB/Kasinza', '', 1000000],
      ['21-Jul', 'Delivery expenses', 'CB/Exp', '', 55000],
      ['30-Jul', "Assistant's wages", 'CB/Wages', '', 380000],
      ['31-Jul', 'Aline (settlement)', 'CB/Aline', '', 500000],
      ['31-Jul', 'Bank charges', 'CB/Chgs', '', 12000],
      ['31-Jul', 'Balance c/d', '', 297000, ''],
      ['01-Aug', 'Balance b/d (overdraft)', '', '', 297000],
    ],
  };
  const before = JSON.stringify(table.data);
  let warned = '';
  const origWarn = console.warn;
  console.warn = (msg) => { warned += msg; };
  try {
    fixDebitCreditPlacement(table);
  } finally {
    console.warn = origWarn;
  }
  if (warned.includes('unbalanced')) throw new Error(`incorrectly flagged an already-balanced table as unbalanced: ${warned}`);
  assertEqual(JSON.stringify(table.data), before, 'table left unchanged (it was already correct)');
});

console.log(failures ? `\n${failures} test(s) FAILED` : '\nAll tests passed');
process.exit(failures ? 1 : 0);
