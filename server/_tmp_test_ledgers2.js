require('dotenv').config();
const groqClient = require('./utils/groqClient.js');

const questionText = 'i. Relevant ledgers account for the period of three months ended 31 December 2024';

// Focus test on just the two accounts that showed the side-flip bug before
const combinedInput = `Prepaid Rent
Date Particulars Dr(FRW) Cr(FRW)
02-Oct Bank (annual rent paid) 1,872,000
 Rent Expense  468,000
 Balance c/f  1,404,000

Rent expense
Date Particulars Dr(FRW) Cr(FRW)
 Rent Expense 468,000
 Balance c/f  468,000`;

const prompt = `You are a qualified accounting/finance teacher and exam assistant (IFRS/IAS-based, but adapt to whatever curriculum the question implies). Build (or update) the spreadsheet grid for this exam question from data/instructions the teacher provides. Get the ACCOUNTING right first — correct classification, correct ordering, correct arithmetic — then format it professionally.

STEP ZERO — WORK OUT WHAT OUTPUT TYPE IS ACTUALLY BEING ASKED FOR. If the question says "ledger(s)", or the input is already one or more running Dr/Cr accounts, reproduce those exact ledger accounts, one table per account. Do NOT turn them into a financial statement.

Question: "${questionText}"
Teacher's input (treat as authoritative): "${combinedInput}"

Return ONLY JSON of this shape:
{
  "spreadsheetTemplate": {"tables":[{"title":"...","headers":["Item","...","..."],"data":[["Row label","",""], ...]}]},
  "spreadsheetModelAnswer": {"tables":[{"title":"...","headers":["Item","...","..."],"data":[["Row label","computed value",""], ...]}]}
}
- EVERY VALUE CELL MUST BE A PLAIN FINAL NUMBER, NEVER AN ARITHMETIC EXPRESSION.
- COMPLETE EVERYTHING THAT WAS PASTED.

FORMAT BY DOCUMENT TYPE:
  * Ledger accounts / T-accounts: one table per account, headers ["Date","Particulars","Debit","Credit"], preserving EVERY structural detail exactly as the source shows it — this account type is where getting the side (column) right matters most and is most often gotten wrong:
    - Every entry goes on EXACTLY the side (Debit or Credit) the source already shows it on. Never move an entry to the "textbook" side you'd expect from general accounting convention if the source shows it differently — the source is authoritative, not your prior expectations.
    - The closing "Balance b/d"/"Balance c/d"/"Balance c/f" figure's SIDE is determined by which column needs it to make the two column totals equal (it goes on whichever side currently has the SMALLER total) — if the source already shows which side it's on, copy that side exactly; only compute the NUMBER if the cell was left blank, never re-derive or flip which column it sits in.
    - After filling in every row, the Debit column total and the Credit column total for that account must be EQUAL (a ledger account always balances) — if they don't, you put something on the wrong side; find and fix it before returning.
    - Keep every account/particulars label worded exactly as given (e.g. if the source writes "Rent expense" in lower case, keep that exact wording — do not re-capitalize, rename, or tidy it up).
    - Preserve the exact number and order of accounts/tables given.

Before returning, sanity-check: for each ledger account, does the Debit column total equal the Credit column total?`;

groqClient.generateContent(prompt, { model: 'smart', jsonMode: true, temperature: 0.1, maxTokens: 4096, skipCache: true })
  .then(result => {
    const tables = result.parsedContent?.spreadsheetModelAnswer?.tables || [];
    tables.forEach(t => {
      console.log('=== ' + t.title + ' ===');
      let drTotal = 0, crTotal = 0;
      t.data.forEach(row => {
        console.log(row);
        drTotal += Number(row[2]) || 0;
        crTotal += Number(row[3]) || 0;
      });
      console.log('Dr total:', drTotal, 'Cr total:', crTotal, drTotal === crTotal ? 'BALANCED ✓' : 'NOT BALANCED ✗');
    });
  })
  .catch(err => console.error('ERROR', err.status, err.message));
