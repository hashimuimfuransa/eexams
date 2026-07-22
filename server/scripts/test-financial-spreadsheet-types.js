/**
 * Regression test for the "AI Fill Spreadsheet" prompt (server/routes/exam.js,
 * buildFillSpreadsheetPrompt) — the assistant used in the question/exam editor to turn a
 * pasted table or plain-English request into a financial-spreadsheet question.
 *
 * Calls the REAL prompt (imported directly from exam.js, not duplicated here) against the REAL
 * Groq API for one representative sample of every accounting document type the prompt claims to
 * support, and checks the returned table(s) actually have the shape that type is supposed to
 * have (headers, balancing, columnar-vs-2-column, etc.) — not just that Groq returned valid JSON.
 *
 * Deliberately does NOT go through Express/Mongo/auth: exam.js exports buildFillSpreadsheetPrompt
 * purely for this purpose, so this test can run standalone with only GROQ_API_KEY configured,
 * without touching the live database or requiring a logged-in teacher session.
 *
 * Usage: node server/scripts/test-financial-spreadsheet-types.js
 * Optional: node server/scripts/test-financial-spreadsheet-types.js "Cash Book" "Ratio Analysis"
 *           (runs only test cases whose name includes one of the given substrings)
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const fs = require('fs');
const { buildFillSpreadsheetPrompt } = require('../routes/exam.js');
const groqClient = require('../utils/groqClient');

const OUT_DIR = path.join(__dirname, '..', 'temp');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
const OUT_FILE = path.join(OUT_DIR, 'financial-spreadsheet-type-test-results.json');

// ── helpers used by the per-type validators ────────────────────────────────────────────────
const toNum = (v) => {
  if (typeof v === 'number') return v;
  const n = parseFloat(String(v ?? '').replace(/,/g, '').replace(/[()]/g, ''));
  return isNaN(n) ? 0 : n;
};

const findTable = (tables, ...keywords) =>
  tables.find(t => keywords.some(k => (t.title || '').toLowerCase().includes(k.toLowerCase())));

const headerIdx = (table, ...keywords) =>
  (table.headers || []).findIndex(h => keywords.some(k => String(h || '').toLowerCase().includes(k.toLowerCase())));

const colTotal = (table, idx) => (table.data || []).reduce((sum, row) => sum + toNum(row[idx]), 0);

const isRatioString = (v) => /%|:\s*1\b|day|time/i.test(String(v || ''));

// ── test cases ──────────────────────────────────────────────────────────────────────────────
// Each case supplies the question wording + pasted source data a teacher would realistically
// give the assistant, and a validate(tables) function asserting the shape rules from point 1-9
// / FORMAT BY DOCUMENT TYPE in the prompt. validate() should throw a descriptive Error on failure.
const CASES = [
  {
    name: 'Trial Balance',
    questionText: 'Prepare a trial balance as at 31 December 2024 from the following balances.',
    pastedTable: 'Bank 49,528,000 (Dr); Motor Vehicle 16,000,000 (Dr); Inventory 25,200,000 (Dr); Prepaid Rent 1,404,000 (Dr); Rent 468,000 (Dr); Accounts Receivable 1,000,000 (Dr); Accounts Payable 400,000 (Cr); Sales 27,200,000 (Cr); Capital 66,000,000 (Cr)',
    validate(tables) {
      const t = findTable(tables, 'trial balance');
      if (!t) throw new Error('no Trial Balance table returned');
      const dr = headerIdx(t, 'debit'), cr = headerIdx(t, 'credit');
      if (dr === -1 || cr === -1) throw new Error(`expected Debit/Credit headers, got ${JSON.stringify(t.headers)}`);
      const drTotal = colTotal(t, dr), crTotal = colTotal(t, cr);
      if (Math.abs(drTotal - crTotal) > 1) throw new Error(`does not balance: Dr ${drTotal} vs Cr ${crTotal}`);
    }
  },
  {
    name: 'Ledger Accounts / T-accounts',
    questionText: 'Prepare the Capital account and the Bank account as ledger T-accounts for October 2024.',
    pastedTable: 'Capital account: 01-Oct Bank 50,000,000 (Cr), 01-Oct Motor Vehicle 16,000,000 (Cr).\nBank account: 01-Oct Capital 50,000,000 (Dr), 02-Oct Rent 1,872,000 (Cr).',
    validate(tables) {
      if (tables.length < 2) throw new Error(`expected one table per account (>=2), got ${tables.length}`);
      for (const t of tables) {
        const dr = headerIdx(t, 'debit'), cr = headerIdx(t, 'credit');
        if (dr === -1 || cr === -1) throw new Error(`table "${t.title}" missing Debit/Credit headers: ${JSON.stringify(t.headers)}`);
      }
    }
  },
  {
    name: 'Journal Entries',
    questionText: 'Prepare the journal entries to record the following transaction: purchased inventory of 5,000,000 on credit from a supplier.',
    pastedTable: '',
    validate(tables) {
      const t = tables[0];
      if (!t) throw new Error('no table returned');
      const dr = headerIdx(t, 'debit'), cr = headerIdx(t, 'credit');
      if (dr === -1 || cr === -1) throw new Error(`expected Debit/Credit headers, got ${JSON.stringify(t.headers)}`);
      const hasTo = (t.data || []).some(row => String(row[headerIdx(t, 'particulars') === -1 ? 0 : headerIdx(t, 'particulars')] || '').toLowerCase().startsWith('to '));
      if (!hasTo) throw new Error('no row prefixed "To ..." for the credited account');
    }
  },
  {
    name: 'Income Statement',
    questionText: 'Prepare a Statement of Profit or Loss for the year ended 31 December 2024.',
    pastedTable: 'Revenue 463,000,000; Purchases 296,000,000; Return outwards 7,500,000; Closing inventory 52,600,000; Wages and salaries 96,000,000 (16,500,000 prepaid); Marketing costs 14,500,000; Other operating expenses 18,650,000; Interest expense 1,440,000; Income tax 1,200,000.',
    validate(tables) {
      const t = findTable(tables, 'income statement', 'profit or loss', 'profit and loss');
      if (!t) throw new Error('no Income Statement table returned');
      const dr = headerIdx(t, 'debit'), cr = headerIdx(t, 'credit');
      if (dr !== -1 || cr !== -1) throw new Error('Income Statement must not use Debit/Credit headers');
      const hasGrossProfit = (t.data || []).some(r => /gross profit/i.test(r[0] || ''));
      if (!hasGrossProfit) throw new Error('no "Gross Profit" row found');
    }
  },
  {
    name: 'Statement of Financial Position',
    questionText: 'Prepare a Statement of Financial Position as at 31 December 2024.',
    // Real, verified-balanced figures (Total Assets = Total Equity and Liabilities = 616,470) from
    // the Muhanga Ltd example in the sample marking guide — deliberately not invented numbers,
    // since made-up SOFP figures that don't actually balance produce a false-positive test failure.
    pastedTable: 'Land 124,800,000; Buildings (net) 181,400,000; Plant & Machinery (net) 112,710,000; Computers (net) 36,000,000; Inventory 52,600,000; Receivables (net) 35,280,000; Prepaid Salaries 16,500,000; Cash at bank 57,180,000; Share capital 290,000,000; Share premium 50,000,000; Retained earnings 101,030,000; 12% Redeemable Debentures 120,000,000; Trade payables 52,800,000; Accrued interest 1,440,000; Tax payable 1,200,000.',
    validate(tables) {
      const t = findTable(tables, 'financial position', 'balance sheet');
      if (!t) throw new Error('no Statement of Financial Position table returned');
      const rows = (t.data || []).map(r => (r[0] || '').toLowerCase());
      const totalAssetsRow = t.data.find(r => /total assets/i.test(r[0] || ''));
      const totalEqLiabRow = t.data.find(r => /total equity and liabilities|total capital and liabilities/i.test(r[0] || ''));
      if (!totalAssetsRow || !totalEqLiabRow) throw new Error('missing Total Assets / Total Equity and Liabilities rows');
      const lastCol = t.headers.length - 1;
      const ta = toNum(totalAssetsRow[lastCol]), tel = toNum(totalEqLiabRow[lastCol]);
      if (Math.abs(ta - tel) > 1) throw new Error(`SOFP does not balance: Total Assets ${ta} vs Total Equity & Liabilities ${tel}`);
      void rows;
    }
  },
  {
    name: 'Statement of Changes in Equity',
    questionText: 'Prepare a Statement of Changes in Equity for the year ended 31 December 2024.',
    pastedTable: 'Balance b/f: Share Capital 200,000,000, Retained Earnings 155,000,000. Profit for the year 160,000,000. Dividends paid 55,000,000.',
    validate(tables) {
      const t = findTable(tables, 'changes in equity');
      if (!t) throw new Error('no Statement of Changes in Equity table returned');
      if (t.headers.length < 3) throw new Error(`expected a column per equity component, got headers ${JSON.stringify(t.headers)}`);
    }
  },
  {
    name: 'Cash Flow Statement (IAS 7, with derived workings)',
    questionText: 'Prepare a Statement of Cash Flows for the year ended 31 December 2024 using the indirect method, including all necessary workings.',
    pastedTable: 'Profit before tax 300,000,000. PPE cost b/f 595,000,000, c/f 720,000,000. Accumulated depreciation b/f 340,000,000, c/f 290,000,000 (after disposal). Asset disposed: cost 85,000,000, carrying amount 45,000,000, sold for 32,000,000. Tax payable b/f 110,000,000, c/f 120,000,000, tax charge 140,000,000. Interest payable b/f 25,000,000, c/f 0, finance cost 75,000,000. Inventory increase 48,000,000. Receivables increase 75,000,000. Payables increase 8,000,000. Shares issued 50,000,000, share premium 10,000,000, loan raised 120,000,000, dividends paid 55,000,000. Cash and cash equivalents opening -97,000,000, closing -33,000,000.',
    validate(tables) {
      const t = findTable(tables, 'cash flow');
      if (!t) throw new Error('no Cash Flow Statement table returned');
      const hasOperating = (t.data || []).some(r => /operating activ/i.test(r[0] || ''));
      const hasInvesting = (t.data || []).some(r => /investing activ/i.test(r[0] || ''));
      const hasFinancing = (t.data || []).some(r => /financing activ/i.test(r[0] || ''));
      if (!hasOperating || !hasInvesting || !hasFinancing) throw new Error('missing one of Operating/Investing/Financing Activities sections');
      const workings = tables.filter(x => /^wk\d/i.test(x.title || ''));
      if (workings.length === 0) throw new Error('expected at least one WK supporting-workings table given derivable figures (depreciation, tax paid, disposal gain/loss) were not given directly');
    }
  },
  {
    name: 'Cash Book / Adjusted Cash Book',
    questionText: 'Prepare the adjusted cash book as at 31 December 2024.',
    pastedTable: 'Balance as per cash book 3,350,000 (Dr). Dishonoured cheque 1,640,000 (Cr). Cash book undercast 420,000 (Dr). Standing order not yet in cash book 500,000 (Cr). Bank charges 250,000 (Cr). Direct deposit by customer 260,000 (Dr).',
    validate(tables) {
      const t = findTable(tables, 'cash book');
      if (!t) throw new Error('no Cash Book table returned');
      const h = (t.headers || []).map(x => String(x || '').toLowerCase());
      if (!h.some(x => x.includes('dr')) || !h.some(x => x.includes('cr'))) throw new Error(`expected "(Dr)"/"(Cr)" headers, got ${JSON.stringify(t.headers)}`);
      if (h.some(x => x.includes('debit') || x.includes('credit'))) throw new Error('Cash Book should use "(Dr)"/"(Cr)" abbreviations, not the words Debit/Credit');
      if (t.headers.length !== 4) throw new Error(`expected 4 columns (Details Dr, Amount, Details Cr, Amount), got ${t.headers.length}`);
      const drAmtIdx = 1, crAmtIdx = 3;
      const drTotalRow = t.data.find(r => /total/i.test(r[0] || '') || /total/i.test(r[2] || ''));
      if (drTotalRow) {
        const a = toNum(drTotalRow[drAmtIdx]), b = toNum(drTotalRow[crAmtIdx]);
        if (a > 0 && b > 0 && Math.abs(a - b) > 1) throw new Error(`final totals differ: Dr side ${a} vs Cr side ${b}`);
      }
    }
  },
  {
    name: 'Bank Reconciliation Statement',
    questionText: 'Prepare a bank reconciliation statement as at 31 December 2024, starting from the adjusted cash book balance of 4,167,000.',
    pastedTable: 'Adjusted cash book balance 4,167,000. Unpresented cheque (John) 1,772,000. Uncredited cheque from customer 1,800,000.',
    validate(tables) {
      const t = findTable(tables, 'bank reconciliation');
      if (!t) throw new Error('no Bank Reconciliation Statement table returned');
      const dr = headerIdx(t, 'debit'), cr = headerIdx(t, 'credit');
      if (dr !== -1 || cr !== -1) throw new Error('Bank Reconciliation Statement must not use Debit/Credit headers');
      const hasAdd = (t.data || []).some(r => /^add:?$/i.test((r[0] || '').trim()));
      const hasLess = (t.data || []).some(r => /^less:?$/i.test((r[0] || '').trim()));
      if (!hasAdd || !hasLess) throw new Error('missing "Add:"/"Less:" section-header rows');
    }
  },
  {
    name: 'Ratio Analysis',
    questionText: 'Calculate the current ratio, gross profit margin, and receivables period for 2023 and 2024.',
    pastedTable: '2023: Current assets 1,286,020,000, Current liabilities 268,820,000, Revenue 4,816,906,000, Gross profit 1,289,466,000, Receivables 652,500,000.\n2024: Current assets 1,305,080,000, Current liabilities 415,250,000, Revenue 5,205,514,000, Gross profit 1,500,824,000, Receivables 660,900,000.',
    validate(tables) {
      const t = findTable(tables, 'ratio');
      if (!t) throw new Error('no Ratio Analysis table returned');
      if (t.headers.length < 3) throw new Error(`expected one column per year plus Ratio, got headers ${JSON.stringify(t.headers)}`);
      const valueCols = t.headers.map((_, i) => i).filter(i => !/ratio|formula/i.test(t.headers[i] || ''));
      const anyFormatted = (t.data || []).some(row => valueCols.some(i => isRatioString(row[i])));
      if (!anyFormatted) throw new Error('no value cell looks like a formatted ratio string (e.g. "X%", "X:1", "X days")');
    }
  },
  {
    name: 'IPSAS Statement of Financial Performance & Position',
    questionText: 'Prepare (i) the Statement of Financial Performance and (ii) the Statement of Financial Position for the Ministry of Sports for the year ended 31 December 2024.',
    pastedTable: 'Transfers from exchequer 356,000,000; Fees and fines 12,000,000; Salaries and wages 186,500,000; Finance cost 52,000,000; Accumulated surplus b/f 112,050,000; Land and buildings 190,930,000; Cash and cash equivalents 29,550,000; Long-term borrowings 62,320,000; Ministries payables 16,000,000.',
    validate(tables) {
      const perf = findTable(tables, 'financial performance');
      const pos = findTable(tables, 'financial position');
      if (!perf) throw new Error('no Statement of Financial Performance table returned');
      if (!pos) throw new Error('no Statement of Financial Position table returned');
      const hasSurplus = (perf.data || []).some(r => /surplus/i.test(r[0] || ''));
      if (!hasSurplus) throw new Error('Statement of Financial Performance missing a "Surplus/(Deficit)" row');
      const hasAccSurplus = (pos.data || []).some(r => /accumulated surplus/i.test(r[0] || ''));
      if (!hasAccSurplus) throw new Error('Statement of Financial Position missing "Accumulated Surplus" (should replace Retained Earnings)');
    }
  },
  {
    name: 'Control Account (Receivables Control)',
    questionText: 'Prepare the Receivables (Sales Ledger) Control Account for the month of December 2024.',
    pastedTable: 'Balance b/f 8,000,000 (Dr). Credit sales 25,000,000 (Dr). Cash received 20,000,000 (Cr). Discounts allowed 500,000 (Cr). Bad debts written off 300,000 (Cr).',
    validate(tables) {
      const t = tables[0];
      if (!t) throw new Error('no table returned');
      const dr = headerIdx(t, 'debit'), cr = headerIdx(t, 'credit');
      if (dr === -1 || cr === -1) throw new Error(`Control account expected Debit/Credit ledger headers, got ${JSON.stringify(t.headers)}`);
    }
  },
  {
    name: 'Suspense Account & Correction of Errors',
    questionText: 'A trial balance failed to agree by 250,000, the difference being posted to a suspense account. (a) Prepare the suspense account showing the correcting entries. (b) Prepare a statement of corrected net profit given profit was originally calculated as 5,000,000.\n1. A sale of 250,000 was completely omitted from the sales account (only the debtor was debited).',
    pastedTable: '',
    validate(tables) {
      const suspense = findTable(tables, 'suspense');
      const corrected = findTable(tables, 'corrected net profit', 'corrected profit');
      if (!suspense) throw new Error('no Suspense Account table returned');
      const dr = headerIdx(suspense, 'debit'), cr = headerIdx(suspense, 'credit');
      if (dr === -1 || cr === -1) throw new Error('Suspense Account must be ledger-shaped with Debit/Credit headers');
      if (!corrected) throw new Error('no Statement of Corrected Net Profit table returned');
    }
  },
  {
    name: 'Manufacturing Account',
    questionText: 'Prepare a Manufacturing Account (Statement of Cost of Production) for the year ended 31 December 2024.',
    pastedTable: 'Opening inventory of raw materials 2,000,000; Purchases of raw materials 20,000,000; Closing inventory of raw materials 3,000,000; Direct labour 8,000,000; Factory overheads 5,000,000; Opening WIP 1,000,000; Closing WIP 1,500,000.',
    validate(tables) {
      const t = findTable(tables, 'manufacturing', 'cost of production');
      if (!t) throw new Error('no Manufacturing Account table returned');
      const hasPrimeCost = (t.data || []).some(r => /prime cost/i.test(r[0] || ''));
      const hasCostOfProduction = (t.data || []).some(r => /cost of production/i.test(r[0] || ''));
      if (!hasPrimeCost) throw new Error('missing "Prime Cost" row');
      if (!hasCostOfProduction) throw new Error('missing "Cost of Production" row');
    }
  },
  {
    name: 'Statement of Affairs (Incomplete Records)',
    questionText: 'A trader does not keep proper books. Prepare statements of affairs at the start and end of the year, and compute the profit for the period from incomplete records.',
    pastedTable: 'At 1 Jan 2024: Assets 40,000,000, Liabilities 15,000,000. At 31 Dec 2024: Assets 58,000,000, Liabilities 18,000,000. Additional capital introduced during the year 5,000,000. Drawings during the year 6,000,000.',
    validate(tables) {
      const t = findTable(tables, 'statement of affairs', 'incomplete records', 'profit from incomplete');
      if (!t) throw new Error('no Statement of Affairs / incomplete-records table returned');
    }
  },
  {
    name: "Partnership Appropriation + Partners' Capital Accounts",
    questionText: 'A and B are partners sharing profits equally. Prepare (i) the Profit and Loss Appropriation Account and (ii) the Partners\' Capital Accounts for the year ended 31 December 2024.',
    pastedTable: 'Net profit 20,000,000. Interest on capital: A 1,000,000, B 800,000. Partner salary: B 2,000,000. Capital balances b/f: A 30,000,000, B 25,000,000. Drawings: A 4,000,000, B 3,500,000.',
    validate(tables) {
      const approp = findTable(tables, 'appropriation');
      const capital = findTable(tables, 'capital account');
      if (!approp) throw new Error('no Profit & Loss Appropriation Account table returned');
      if (!capital) throw new Error("no Partners' Capital Accounts table returned");
      if (capital.headers.length < 3) throw new Error(`Partners' Capital Accounts should be columnar (one column per partner), got headers ${JSON.stringify(capital.headers)}`);
      const dr = headerIdx(capital, 'debit'), cr = headerIdx(capital, 'credit');
      if (dr !== -1 && cr !== -1 && capital.headers.length <= 4) throw new Error('Partners\' Capital Accounts should be columnar-by-partner, not a plain 2-column Dr/Cr ledger');
    }
  },
  {
    name: 'Receipts & Payments / Income & Expenditure (Non-Profit)',
    questionText: 'A sports club has provided the following. Prepare (i) the Receipts and Payments Account and (ii) the Income and Expenditure Account for the year ended 31 December 2024.',
    pastedTable: 'Subscriptions received 5,000,000; Cash at bank b/f 1,000,000; Rent paid 2,000,000; Purchase of new equipment (capital item) 3,000,000; Refreshment sales 800,000; Wages 1,200,000.',
    validate(tables) {
      const rp = findTable(tables, 'receipts and payments');
      const ie = findTable(tables, 'income and expenditure');
      if (!rp) throw new Error('no Receipts and Payments Account table returned');
      if (!ie) throw new Error('no Income and Expenditure Account table returned');
      if (rp.headers.length !== 4) throw new Error(`Receipts and Payments Account should be the 4-column cash-book shape, got headers ${JSON.stringify(rp.headers)}`);
      const hasSurplus = (ie.data || []).some(r => /surplus|deficit/i.test(r[0] || ''));
      if (!hasSurplus) throw new Error('Income and Expenditure Account missing a "Surplus/(Deficit)" row');
    }
  },
  {
    name: 'PPE Note (columnar by asset class)',
    questionText: 'Prepare the Property, Plant and Equipment note for the year ended 31 December 2024, showing cost, accumulated depreciation, and net book value for Land, Buildings, and Equipment.',
    pastedTable: 'Land: cost b/f 50,000,000, no depreciation. Buildings: cost b/f 100,000,000, additions 10,000,000, accumulated depreciation b/f 20,000,000, charge for year 5,000,000. Equipment: cost b/f 30,000,000, disposals 5,000,000 (accumulated depreciation eliminated 4,000,000), accumulated depreciation b/f 10,000,000, charge for year 3,000,000.',
    validate(tables) {
      const t = findTable(tables, 'property, plant', 'ppe');
      if (!t) throw new Error('no PPE note table returned');
      if (t.headers.length < 4) throw new Error(`PPE note should be columnar by asset class (Land/Buildings/Equipment/Total), got headers ${JSON.stringify(t.headers)}`);
      const hasNBV = (t.data || []).some(r => /net book value/i.test(r[0] || ''));
      if (!hasNBV) throw new Error('missing "Net Book Value" row');
    }
  },
  {
    name: 'Cash Budget (columnar by period)',
    questionText: 'Prepare a cash budget for January, February, and March 2025.',
    pastedTable: 'Opening cash balance January 2,000,000. Cash sales: Jan 5,000,000, Feb 6,000,000, Mar 7,000,000. Cash purchases: Jan 3,000,000, Feb 3,500,000, Mar 4,000,000. Rent paid each month 1,000,000.',
    validate(tables) {
      const t = findTable(tables, 'cash budget', 'budget');
      if (!t) throw new Error('no Cash Budget table returned');
      if (t.headers.length < 4) throw new Error(`Cash Budget should be columnar by month (Item/Jan/Feb/Mar/Total), got headers ${JSON.stringify(t.headers)}`);
    }
  },
  {
    name: 'Investment Appraisal (NPV)',
    questionText: 'A project requires an initial investment of 10,000,000 and is expected to generate cash inflows of 4,000,000 per year for 4 years. The cost of capital is 10%. Calculate the Net Present Value.',
    pastedTable: '',
    validate(tables) {
      const t = findTable(tables, 'npv', 'net present value', 'investment appraisal');
      if (!t) throw new Error('no NPV/investment appraisal table returned');
      const h = (t.headers || []).map(x => String(x || '').toLowerCase());
      if (!h.some(x => x.includes('year'))) throw new Error(`expected a "Year" column, got ${JSON.stringify(t.headers)}`);
      if (!h.some(x => x.includes('present value'))) throw new Error(`expected a "Present Value" column, got ${JSON.stringify(t.headers)}`);
      const hasNPVRow = (t.data || []).some(r => /net present value|\bnpv\b/i.test(r[0] || ''));
      if (!hasNPVRow) throw new Error('missing a "Net Present Value"/"NPV" row');
    }
  },
  {
    name: 'Loan / Bond Amortization Schedule',
    questionText: 'A loan of 10,000,000 at 10% annual interest is repaid in 3 equal annual instalments of 4,021,148. Prepare the loan amortization schedule.',
    pastedTable: '',
    validate(tables) {
      const t = findTable(tables, 'amortization', 'amortisation', 'loan schedule');
      if (!t) throw new Error('no Loan Amortization Schedule table returned');
      const h = (t.headers || []).map(x => String(x || '').toLowerCase());
      if (!h.some(x => x.includes('opening'))) throw new Error(`expected "Opening Balance" column, got ${JSON.stringify(t.headers)}`);
      if (!h.some(x => x.includes('closing'))) throw new Error(`expected "Closing Balance" column, got ${JSON.stringify(t.headers)}`);
      if (!h.some(x => x.includes('interest'))) throw new Error(`expected "Interest" column, got ${JSON.stringify(t.headers)}`);
    }
  },
  {
    name: 'Standard Costing Variance Analysis',
    questionText: 'Calculate the material price variance and material usage variance, and reconcile budgeted profit to actual profit.',
    pastedTable: 'Standard price per kg 10; actual price per kg 11; standard usage 1,000kg for actual output; actual usage 950kg. Budgeted profit 5,000,000.',
    validate(tables) {
      const t = findTable(tables, 'variance');
      if (!t) throw new Error('no Variance Analysis table returned');
      const h = (t.headers || []).map(x => String(x || '').toLowerCase());
      if (!h.some(x => x.includes('favourable') || x.includes('favorable') || x.includes('adverse'))) {
        throw new Error(`expected a Favourable/Adverse column, got ${JSON.stringify(t.headers)}`);
      }
    }
  }
];

// ── runner ──────────────────────────────────────────────────────────────────────────────────
async function runCase(testCase) {
  const prompt = buildFillSpreadsheetPrompt(testCase.questionText, '', testCase.pastedTable, '');
  const result = await groqClient.generateContent(prompt, {
    model: 'smart',
    jsonMode: true,
    temperature: 0.1,
    maxTokens: 4096,
    skipCache: true // this is a regression test — always hit the model fresh, never a stale cached answer
  });
  const parsed = result.parsedContent
    || (result.text ? JSON.parse(result.text.match(/\{[\s\S]*\}/)?.[0] || '{}') : {});
  if (!parsed.spreadsheetModelAnswer) {
    throw new Error('response had no spreadsheetModelAnswer');
  }
  const modelAnswer = typeof parsed.spreadsheetModelAnswer === 'string'
    ? JSON.parse(parsed.spreadsheetModelAnswer)
    : parsed.spreadsheetModelAnswer;
  const tables = modelAnswer.tables;
  if (!Array.isArray(tables) || tables.length === 0) {
    throw new Error('spreadsheetModelAnswer.tables is missing or empty');
  }
  testCase.validate(tables);
  return tables;
}

async function main() {
  const filterArgs = process.argv.slice(2).map(a => a.toLowerCase());
  const casesToRun = filterArgs.length
    ? CASES.filter(c => filterArgs.some(f => c.name.toLowerCase().includes(f)))
    : CASES;

  if (casesToRun.length === 0) {
    console.error('No test cases matched filter:', filterArgs.join(', '));
    process.exit(1);
  }

  console.log(`Running ${casesToRun.length} financial-spreadsheet type test(s) against the live Groq API...\n`);

  const results = [];
  for (const testCase of casesToRun) {
    process.stdout.write(`  [ .. ] ${testCase.name}`);
    const startedAt = Date.now();
    try {
      const tables = await runCase(testCase);
      const ms = Date.now() - startedAt;
      console.log(`\r  [ OK ] ${testCase.name} (${ms}ms, ${tables.length} table(s))`);
      results.push({ name: testCase.name, status: 'PASS', ms, tables });
    } catch (err) {
      const ms = Date.now() - startedAt;
      console.log(`\r  [FAIL] ${testCase.name} (${ms}ms) — ${err.message}`);
      results.push({ name: testCase.name, status: 'FAIL', ms, error: err.message });
    }
  }

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;

  console.log(`\n${passed}/${results.length} passed, ${failed} failed.`);
  if (failed > 0) {
    console.log('\nFailures:');
    results.filter(r => r.status === 'FAIL').forEach(r => console.log(`  - ${r.name}: ${r.error}`));
  }

  fs.writeFileSync(OUT_FILE, JSON.stringify(results, null, 2));
  console.log(`\nFull results (including generated tables) written to ${OUT_FILE}`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Test runner crashed:', err);
  process.exit(1);
});
