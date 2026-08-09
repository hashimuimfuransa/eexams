/**
 * FinancialSpreadsheet.jsx  –  Handsontable + HyperFormula spreadsheet.
 *
 * Features:
 *  - Full Excel-like formulas via HyperFormula (SUM, IF, VLOOKUP, NPV, IRR, PMT …)
 *  - Number / Currency / Percentage / Date cell types
 *  - Custom borders, merge cells, freeze rows, column sorting
 *  - Undo / Redo, Copy / Paste, Fill-down
 *  - Formatting toolbar: Bold, Italic, Align, Currency format, % format
 *  - Add / Remove rows & columns; editable column headers
 *  - Right-click context menu with all structural options
 *  - Multiple named tables per question (e.g. a question that asks for both an
 *    Income Statement AND a Statement of Financial Position) — tables can be
 *    added/removed independently, each with its own title and grid.
 *
 * Modes:
 *  teacher-setup  – editable: Student Template tab + Model Answer tab
 *  student        – editable: one grid per table, pre-filled from template; can add more tables
 *  grading        – read-only: Student Answer + Model Answer tabs
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Box, Tabs, Tab, Chip, Typography, Alert, Button,
  IconButton, Tooltip, TextField, Stack, CircularProgress, Collapse,
  Checkbox, FormControlLabel, Dialog, DialogTitle, DialogContent, DialogActions,
  InputAdornment, ListItemButton, Menu, MenuItem
} from '@mui/material';
import {
  Lock, LockOpen, TableChart,
  RestartAlt, CheckCircle, Info,
  RemoveCircleOutline,
  FormatBold, FormatItalic, FormatUnderlined,
  FormatAlignLeft, FormatAlignCenter, FormatAlignRight,
  Undo, Redo, Functions, AutoAwesome, ExpandMore, ExpandLess,
  AddPhotoAlternate, Close, Article, HelpOutline, Search, Add, AcUnit
} from '@mui/icons-material';
import api from '../services/api';

import Handsontable from 'handsontable';
import { HyperFormula } from 'hyperformula';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/styles/handsontable.min.css';
import 'handsontable/styles/ht-theme-main.min.css';

registerAllModules();

// ── Defaults ──────────────────────────────────────────────────────────────────
const DEFAULT_ROWS = 20;
const DEFAULT_COLS = 8;
const DEFAULT_HEADERS = ['Account / Item', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Total'];

function makeEmptyData(rows = DEFAULT_ROWS, cols = DEFAULT_COLS) {
  return Array.from({ length: rows }, () => Array(cols).fill(''));
}

// ── Excel-parity helpers ──────────────────────────────────────────────────────
// Students come to this grid already knowing Excel, so the grid has to speak Excel's language:
// A/B/C column letters, 1-based row numbers, "B4" cell references and =FORMULA() syntax.

// NOTE: Handsontable's spreadsheetColumnLabel is 0-based — spreadsheetColumnLabel(0) === 'A'.
function colLabel(colIndex) {
  const fn = Handsontable?.helper?.spreadsheetColumnLabel;
  if (typeof fn === 'function') return fn(colIndex);
  let n = colIndex;
  let label = '';
  while (n >= 0) {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  }
  return label;
}

const cellRefOf = (row, col) => `${colLabel(col)}${row + 1}`;

const rangeRefOf = (r1, c1, r2, c2) => {
  const top = Math.min(r1, r2), bottom = Math.max(r1, r2);
  const left = Math.min(c1, c2), right = Math.max(c1, c2);
  const start = cellRefOf(top, left);
  return top === bottom && left === right ? start : `${start}:${cellRefOf(bottom, right)}`;
};

// ── Excel "point mode" ────────────────────────────────────────────────────────
// In Excel, half-typing a formula and then clicking a cell inserts that cell's reference instead
// of ending the edit. Without it, clicking mid-formula committed the fragment ("=B1+") and the
// engine turned it into an error — so the natural way to build a formula was the one way that
// couldn't work. These two helpers decide when a click should point rather than commit, and
// where the reference goes.

// A reference already sitting at the end of the text: Excel replaces it when you click again.
const TRAILING_REF_RE = /\$?[A-Za-z]{1,3}\$?\d+(:\$?[A-Za-z]{1,3}\$?\d+)?$/;
// Tokens a reference may legally follow: "=", an operator, "(", "," and so on.
const REF_FOLLOWS_RE = /[=+\-*/^(,;:<>&%]\s*$/;

// True while the text is a formula whose next token could be a cell reference. A finished formula
// ("=SUM(B1:B3)") returns false, so clicking away from one still behaves normally.
function isFormulaInProgress(text) {
  const s = String(text ?? '');
  if (!s.trimStart().startsWith('=')) return false;
  return REF_FOLLOWS_RE.test(s) || TRAILING_REF_RE.test(s);
}

// Appends the reference, or replaces the trailing one when the click is a correction rather than
// a continuation — "=B1+" + B5 becomes "=B1+B5", while "=B1" + B5 becomes "=B5".
function withRefInserted(text, ref) {
  const s = String(text ?? '');
  if (!REF_FOLLOWS_RE.test(s) && TRAILING_REF_RE.test(s)) return s.replace(TRAILING_REF_RE, ref);
  return s + ref;
}

// Teacher-authored column names are rendered into the header via innerHTML, so escape them.
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Parses the money-ish strings that show up in accounting answers — "1,234.50", "(500)" for a
// negative, "Frw 5,400,000", "5,400,000 Frw", "€120", "12.5%". Kept deliberately in step with the
// server grader's cellsEqual() so the status bar's Sum, the right-alignment cue and the number
// formatting all agree with what will actually be marked.
//
// A currency WORD is matched against a fixed list of codes rather than "any short word", at both
// ends. Stripping any short word would misread real cell values: a ratio-analysis "45 days" would
// compare equal to a bare "45", and a ledger date like "July 6" — which exists in these questions
// — would parse as the number 6 and match a student who simply wrote "6".
const CURRENCY_CODE = 'frw|rwf|ksh|kes|usd|eur|gbp|ugx|tzs|zar|ngn|rs';
const LEADING_CURRENCY_RE  = new RegExp(`^(?:${CURRENCY_CODE})\\s*(?=[\\d.+-])`, 'i');
const TRAILING_CURRENCY_RE = new RegExp(`([\\d.])\\s*(?:${CURRENCY_CODE})$`, 'i');

function toNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  let s = String(value ?? '').trim();
  if (s === '') return NaN;
  const bracketed = /^\(.*\)$/.test(s);
  if (bracketed) s = s.slice(1, -1);
  s = s
    .replace(LEADING_CURRENCY_RE, '')             // "Frw 5,400,000"
    .replace(TRAILING_CURRENCY_RE, '$1')          // "5,400,000 Frw"
    .replace(/[,$€£¥₹₦%\s]/g, '');                // separators, percent and currency symbols
  const n = Number(s);
  if (!Number.isFinite(n)) return NaN;
  return bracketed ? -n : n;
}

const looksNumeric = (value) => !Number.isNaN(toNumber(value));

const formatStat = (n) =>
  Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—';

// ── Number formatting ─────────────────────────────────────────────────────────
// Done here rather than through Handsontable's numeric cell type, which could not work for these
// sheets. That path formats only values its own isNumeric() accepts — plain digits — so every
// figure already carrying a thousands separator, a currency prefix or accounting brackets
// ("5,400,000", "Frw 5,400,000", "(500)") was returned untouched and the button appeared dead.
// It also required flipping cells to type:'numeric', which fought the grid's own renderer and
// flagged string cells invalid, and its `numericFormat.pattern` API is deprecated in v17.
//
// Formatting is presentation only: the cell keeps the text the student typed, exactly as in
// Excel, so what gets graded never changes with the format applied.
const CURRENCY_OPTIONS = [
  { label: 'No symbol', symbol: '' },
  { label: 'Frw',       symbol: 'Frw ' },
  { label: 'USD  $',    symbol: '$' },
  { label: 'EUR  €',    symbol: '€' },
  { label: 'GBP  £',    symbol: '£' },
  { label: 'KES  KSh',  symbol: 'KSh ' },
];

function formatCellForDisplay(raw, fmt) {
  if (!fmt || !fmt.kind) return raw; // no format, or formatting explicitly cleared
  const n = toNumber(raw);
  if (Number.isNaN(n)) return raw; // row labels and notes pass through untouched

  const decimals = Math.max(0, Math.min(6, fmt.decimals ?? 2));
  const body = Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  if (fmt.kind === 'percent') return `${n < 0 ? '-' : ''}${body}%`;

  // Accounting convention: negatives in brackets rather than with a minus sign.
  const symbol = fmt.symbol || '';
  return n < 0 ? `(${symbol}${body})` : `${symbol}${body}`;
}

let tableIdSeq = 0;
function nextTableKey() {
  tableIdSeq += 1;
  return `tbl_${Date.now()}_${tableIdSeq}`;
}

function makeEmptyTable(title = '') {
  return { _key: nextTableKey(), title, headers: [...DEFAULT_HEADERS], data: makeEmptyData() };
}

function cloneTables(tables) {
  return tables.map(t => ({
    _key: nextTableKey(),
    title: t.title || '',
    headers: [...t.headers],
    data: t.data.map(row => [...row]),
    ...(Array.isArray(t.formulas) && t.formulas.length
      ? { formulas: t.formulas.map(row => [...row]) }
      : {}),
    ...(Array.isArray(t.givenColumns) ? { givenColumns: [...t.givenColumns] } : {}),
  }));
}

// `data` always holds evaluated values (that's what the server grades against), while `formulas`
// holds the raw "=SUM(B2:B10)" the author typed. Excel keeps your formula when you reopen a file;
// without this the grid used to silently replace it with a frozen number on resume. Merged
// cell-by-cell so a stale/short formulas array can never drop rows of real data.
function mergeFormulas(data, formulas) {
  if (!Array.isArray(formulas) || !formulas.length || !Array.isArray(data)) return data;
  return data.map((row, r) =>
    row.map((cell, c) => {
      const f = formulas[r]?.[c];
      return typeof f === 'string' && f.trim().startsWith('=') ? f : cell;
    })
  );
}

// Only worth persisting if something in the grid actually is a formula.
function extractFormulas(sourceData) {
  if (!Array.isArray(sourceData)) return undefined;
  const hasFormula = sourceData.some(row =>
    Array.isArray(row) && row.some(cell => typeof cell === 'string' && cell.trim().startsWith('='))
  );
  if (!hasFormula) return undefined;
  return sourceData.map(row => (Array.isArray(row) ? row.map(c => (c === null || c === undefined ? '' : c)) : []));
}

// A single table entry may come from the AI/legacy data in a few shapes:
//  - { title?, headers: [...], data: [[...]] }               (canonical)
//  - flat "label: value" object, e.g. {"Revenue":800000}      (AI drift, no headers/data keys)
// Coerce either into the canonical shape. Returns null if nothing usable is found.
function coerceTable(t) {
  if (!t || typeof t !== 'object') return null;
  if (Array.isArray(t.data) && t.data.length) {
    return {
      title: typeof t.title === 'string' ? t.title : '',
      headers: Array.isArray(t.headers) && t.headers.length ? t.headers : [...DEFAULT_HEADERS],
      data: t.data,
      ...(Array.isArray(t.formulas) && t.formulas.length ? { formulas: t.formulas } : {}),
      ...(Array.isArray(t.givenColumns) ? { givenColumns: t.givenColumns } : {}),
    };
  }
  const entries = Object.entries(t).filter(([key]) => !['headers', 'data', 'title'].includes(key));
  if (entries.length === 0) return null;
  return {
    title: typeof t.title === 'string' ? t.title : '',
    headers: ['Item', 'Amount'],
    data: entries.map(([key, value]) => [key, value === null || value === undefined ? '' : String(value)]),
  };
}

// Normalizes any of the shapes the AI/legacy data may produce into a plain array of tables:
//  - { tables: [ {title, headers, data}, ... ] }   (canonical, multi-table)
//  - [ {title, headers, data}, ... ]               (bare array of tables)
//  - { headers: [...], data: [[...]] }             (legacy single-table shape)
//  - flat "label: value" object                    (AI drift)
function coerceToTables(parsed) {
  if (!parsed || typeof parsed !== 'object') return null;
  if (Array.isArray(parsed)) {
    const tables = parsed.map(coerceTable).filter(Boolean);
    return tables.length ? tables : null;
  }
  if (Array.isArray(parsed.tables)) {
    const tables = parsed.tables.map(coerceTable).filter(Boolean);
    return tables.length ? tables : null;
  }
  const single = coerceTable(parsed);
  return single ? [single] : null;
}

function parseSheet(raw) {
  if (!raw) return [makeEmptyTable()];
  try {
    const p = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const tables = coerceToTables(p);
    if (!tables || !tables.length) return [makeEmptyTable()];
    return tables.map(t => ({ _key: nextTableKey(), ...t }));
  } catch {
    return [makeEmptyTable()];
  }
}

// Answer is "meaningfully filled" if at least one cell across all tables is non-blank.
// Used to decide whether a resumed student answer should win over the blank template.
function hasAnyContent(tables) {
  return tables.some(t => t.data.some(row => row.some(cell => String(cell ?? '').trim() !== '')));
}

// `givenColumns` is written only once a teacher has explicitly set it — leaving it absent keeps
// the resolveGivenColumns() heuristic live for questions nobody has reviewed yet.
function serialise(tables) {
  return JSON.stringify({
    tables: tables.map(({ _key, formulas, givenColumns, ...t }) => ({
      ...t,
      ...(Array.isArray(formulas) && formulas.length ? { formulas } : {}),
      ...(Array.isArray(givenColumns) ? { givenColumns } : {}),
    })),
  });
}

// ── Which columns are handed to the student ───────────────────────────────────
// The template used to keep column 0 verbatim on the assumption that it is always a row-label
// column ("Sales", "Cost of Sales", …) worth giving away as scaffolding. That assumption breaks
// on the accounting layouts the exam-import prompt mandates: a ledger's column 0 is a Date that
// repeats ("30/06" eight times) and an investment-appraisal column 0 is a project code ("A" five
// times, then "B"). Those are answers, not labels, and pre-filling them both looked wrong and
// handed out free marks — the grader counts every non-empty model cell.

// "01/06", "30-06-2023", "1 June", "12/06/23" — a posting date, not a line-item name.
const DATE_LIKE = /^\d{1,2}\s*[/-]\s*\d{1,2}(\s*[/-]\s*\d{2,4})?$|^\d{1,2}[\s/-]*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i;

function looksLikeRowLabels(values) {
  const nonEmpty = values.map(v => String(v ?? '').trim()).filter(Boolean);
  if (!nonEmpty.length) return false;

  // A column that repeats itself is grouping rows, not naming them.
  const distinct = new Set(nonEmpty.map(v => v.toLowerCase()));
  if (nonEmpty.length >= 3 && distinct.size / nonEmpty.length < 0.8) return false;

  // Row labels read as words — "Cost of Sales", not "A", "2" or "30/06".
  const wordy = nonEmpty.filter(v => /[A-Za-z]{3,}/.test(v) && !DATE_LIKE.test(v));
  return wordy.length / nonEmpty.length >= 0.6;
}

// Returns the column indices the student sees pre-filled. An explicit `givenColumns` on the table
// (set by the teacher in the setup grid) always wins; otherwise the leading columns are scanned
// and the scan stops at the first that doesn't read as row labels. Scanning only a prefix is
// deliberate — a wordy column in the middle of a ledger ("Details") is part of the answer.
function resolveGivenColumns(table) {
  if (Array.isArray(table?.givenColumns)) return table.givenColumns;
  const rows = table?.data || [];
  const width = rows.reduce((w, r) => Math.max(w, Array.isArray(r) ? r.length : 0), 0);
  const given = [];
  for (let c = 0; c < width; c++) {
    if (!looksLikeRowLabels(rows.map(r => r?.[c]))) break;
    given.push(c);
  }
  return given;
}

// Derives the blank grid students see from the teacher's model answer: same tables, titles and
// headers (so the grading position-by-position comparison in spreadsheetGrading.js still lines
// up), with the given columns kept and every other cell cleared. This removes the need for
// teachers to hand-author a second, separately-maintained template — a source of drift where a
// template that didn't structurally match the model broke grading.
function blankTemplateFromModelJSON(modelJson) {
  try {
    const parsed = JSON.parse(modelJson);
    // Formulas are deliberately dropped: the student's grid must start blank, and a leftover
    // "=SUM(B2:B10)" from the model answer would hand them the working for free.
    const tables = (parsed.tables || []).map(t => {
      const given = new Set(resolveGivenColumns(t));
      return {
        title: t.title || '',
        headers: [...(t.headers || [])],
        data: (t.data || []).map(row => row.map((cell, ci) => (given.has(ci) ? cell : ''))),
      };
    });
    return JSON.stringify({ tables });
  } catch {
    return modelJson;
  }
}

// ── Excel skin ────────────────────────────────────────────────────────────────
// Handsontable's "main" theme is entirely CSS-variable driven, so the whole grid can be recoloured
// to match Microsoft Excel by overriding those variables on a wrapper class rather than fighting
// the library's own stylesheet. Colours below are Excel's (Microsoft 365, light theme):
// #107C41 accent green, #F5F5F5 headers, #D9D9D9 gridlines, Calibri body text.
const EXCEL = {
  green:       '#107C41',
  greenDark:   '#0E6B38',
  greenLight:  '#D3E3DA',
  greenPale:   '#E9F2EE',
  ribbonBg:    '#F3F2F1',
  ribbonEdge:  '#E1DFDD',
  headerBg:    '#F5F5F5',
  headerText:  '#444444',
  gridLine:    '#D9D9D9',
  borderGray:  '#C6C6C6',
  text:        '#212121',
  muted:       '#605E5C',
  font:        `Calibri, 'Segoe UI', system-ui, -apple-system, sans-serif`,
};

const CELL_STYLE_ID = 'fin-spreadsheet-styles';
if (typeof document !== 'undefined' && !document.getElementById(CELL_STYLE_ID)) {
  const style = document.createElement('style');
  style.id = CELL_STYLE_ID;
  style.textContent = `
    .fin-bold { font-weight: 700 !important; }
    .fin-italic { font-style: italic !important; }
    .fin-underline { text-decoration: underline !important; }
    .fin-align-left { text-align: left !important; }
    .fin-align-center { text-align: center !important; }
    .fin-align-right { text-align: right !important; }
    .fin-header-row { background: #EFF6FF !important; font-weight: 700 !important; color: #1E40AF !important; }
    .fin-total-row { background: #F0FDF4 !important; font-weight: 700 !important; border-top: 2px solid ${EXCEL.green} !important; }
    .fin-subtotal { background: #FFFBEB !important; font-style: italic !important; }
    .htInvalid { background: #FEF2F2 !important; }

    /* Excel-style two-line column head: the A/B/C letter students need to write formulas,
       with the question's own column name underneath so they still know what the column holds. */
    .fin-col-head { display: block; line-height: 1.15; padding: 1px 3px; }
    .fin-col-letter { display: block; font-size: 10px; font-weight: 700; color: ${EXCEL.muted}; letter-spacing: 0.6px; }
    /* Wraps rather than truncating: a clipped "Total" or "FRW '000'" leaves the student guessing
       what the column is for, and the header is the only label they get. */
    .fin-col-name { display: block; font-size: 11px; font-weight: 600; color: ${EXCEL.text};
                    white-space: normal; overflow-wrap: break-word; hyphens: auto; }
    /* Numbers right-align like Excel, so a value that failed to register as a number is obvious. */
    .fin-numeric-cell { text-align: right; }

    /* ── Excel colour scheme applied to the Handsontable theme ── */
    .fin-excel .ht-theme-main {
      --ht-font-family: ${EXCEL.font};
      --ht-font-size: 13px;
      --ht-line-height: 1.35;
      --ht-foreground-color: ${EXCEL.text};
      --ht-background-color: #FFFFFF;
      --ht-accent-color: ${EXCEL.green};
      --ht-border-color: ${EXCEL.borderGray};
      --ht-cell-horizontal-border-color: ${EXCEL.gridLine};
      --ht-cell-vertical-border-color: ${EXCEL.gridLine};
      --ht-cell-horizontal-padding: 6px;
      --ht-cell-vertical-padding: 2px;
      --ht-cell-selection-background-color: rgba(16, 124, 65, 0.10);
      --ht-cell-selection-border-color: ${EXCEL.green};
      --ht-cell-autofill-border-color: ${EXCEL.green};
      --ht-cell-autofill-background-color: ${EXCEL.green};
      --ht-cell-autofill-fill-border-color: ${EXCEL.green};
      --ht-cell-editor-border-color: ${EXCEL.green};
      --ht-cell-read-only-background-color: #FAFAFA;

      --ht-header-background-color: ${EXCEL.headerBg};
      --ht-header-foreground-color: ${EXCEL.headerText};
      --ht-header-font-weight: 400;
      --ht-header-highlighted-background-color: ${EXCEL.greenLight};
      --ht-header-highlighted-foreground-color: ${EXCEL.greenDark};
      --ht-header-active-background-color: ${EXCEL.green};
      --ht-header-active-foreground-color: #FFFFFF;
      --ht-header-row-background-color: ${EXCEL.headerBg};
      --ht-header-row-foreground-color: ${EXCEL.headerText};
      --ht-header-row-highlighted-background-color: ${EXCEL.greenLight};
      --ht-header-row-highlighted-foreground-color: ${EXCEL.greenDark};
      --ht-header-row-active-background-color: ${EXCEL.green};
      --ht-header-row-active-foreground-color: #FFFFFF;
    }
    /* Excel highlights the letter/number of the active cell's own row and column. */
    .fin-excel .ht-theme-main th.ht__highlight .fin-col-letter { color: ${EXCEL.greenDark}; }

    /* ── Chrome around the grid ── */
    .fin-ribbon-btn {
      display: inline-flex; align-items: center; justify-content: center; gap: 4px;
      min-width: 26px; height: 26px; padding: 0 6px; border: 1px solid transparent;
      border-radius: 3px; background: transparent; cursor: pointer;
      font-family: ${EXCEL.font}; font-size: 12px; color: ${EXCEL.text};
      transition: background-color 90ms ease, border-color 90ms ease;
    }
    .fin-ribbon-btn:hover:not(:disabled) { background: #EDEBE9; border-color: #D2D0CE; }
    .fin-ribbon-btn:active:not(:disabled) { background: #E1DFDD; }
    .fin-ribbon-btn:disabled { color: #A19F9D; cursor: default; }
    .fin-ribbon-btn.is-active { background: ${EXCEL.greenLight}; border-color: #A8CBBA; }

    .fin-sheet-tab {
      display: inline-flex; align-items: center; gap: 5px; height: 24px; padding: 0 12px;
      border: 1px solid transparent; border-bottom: none; cursor: pointer; max-width: 190px;
      font-family: ${EXCEL.font}; font-size: 12px; color: ${EXCEL.muted};
      background: transparent; white-space: nowrap;
    }
    .fin-sheet-tab:hover { background: #EDEBE9; }
    .fin-sheet-tab.is-active {
      background: #FFFFFF; color: ${EXCEL.green}; font-weight: 700;
      border-color: ${EXCEL.ribbonEdge}; border-top: 2px solid ${EXCEL.green};
    }
    .fin-sheet-tab-label { overflow: hidden; text-overflow: ellipsis; }
  `;
  document.head.appendChild(style);
}

// ── Cell meta helpers ──────────────────────────────────────────────────────────
function applyClassToSelection(hot, cls, exclusive = []) {
  const sel = hot.getSelectedRange();
  if (!sel) return;
  sel.forEach(range => {
    const { from, to } = range;
    for (let r = from.row; r <= to.row; r++) {
      for (let c = from.col; c <= to.col; c++) {
        const current = hot.getCellMeta(r, c).className || '';
        let classes = current.split(' ').filter(Boolean);
        exclusive.forEach(e => { classes = classes.filter(k => k !== e); });
        if (!classes.includes(cls)) classes.push(cls);
        hot.setCellMeta(r, c, 'className', classes.join(' '));
      }
    }
  });
  hot.render();
}

function toggleClassOnSelection(hot, cls) {
  const sel = hot.getSelectedRange();
  if (!sel) return;
  sel.forEach(range => {
    const { from, to } = range;
    for (let r = from.row; r <= to.row; r++) {
      for (let c = from.col; c <= to.col; c++) {
        const current = hot.getCellMeta(r, c).className || '';
        let classes = current.split(' ').filter(Boolean);
        if (classes.includes(cls)) {
          classes = classes.filter(k => k !== cls);
        } else {
          classes.push(cls);
        }
        hot.setCellMeta(r, c, 'className', classes.join(' '));
      }
    }
  });
  hot.render();
}

// Merges a format patch into the selected cells' own `finFormat` meta, so "increase decimals"
// keeps whatever currency symbol is already applied instead of replacing the whole format.
function applyCellFormat(hot, patch) {
  const sel = hot?.getSelectedRange();
  if (!hot || !sel) return;
  sel.forEach(({ from, to }) => {
    for (let r = Math.min(from.row, to.row); r <= Math.max(from.row, to.row); r++) {
      for (let c = Math.min(from.col, to.col); c <= Math.max(from.col, to.col); c++) {
        const current = hot.getCellMeta(r, c).finFormat || {};
        hot.setCellMeta(r, c, 'finFormat', { kind: 'accounting', decimals: 2, ...current, ...patch });
      }
    }
  });
  hot.render();
}

// Right-aligns anything that reads as a number, the way Excel does — a figure that stays
// left-aligned is the student's cue that the cell wasn't understood as a number.
const baseTextRenderer =
  Handsontable.renderers?.getRenderer?.('text') ||
  Handsontable.renderers?.textRenderer ||
  Handsontable.renderers?.TextRenderer;

function finTextRenderer(instance, td, row, col, prop, value, cellProperties) {
  const display = formatCellForDisplay(value, cellProperties.finFormat);
  baseTextRenderer.call(this, instance, td, row, col, prop, display, cellProperties);
  td.classList.toggle('fin-numeric-cell', looksNumeric(value));
}

// Sum / Average / Count for the current selection, matching Excel's status bar — the fastest way
// for a student to sanity-check a subtotal without typing a formula.
const MAX_STAT_CELLS = 20000;
function computeSelectionStats(hot) {
  const ranges = hot.getSelectedRange();
  if (!ranges || !ranges.length) return null;

  const numbers = [];
  let scanned = 0;
  let filled = 0;

  for (const { from, to } of ranges) {
    const r1 = Math.min(from.row, to.row);
    const r2 = Math.max(from.row, to.row);
    const c1 = Math.min(from.col, to.col);
    const c2 = Math.max(from.col, to.col);
    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) {
        if (++scanned > MAX_STAT_CELLS) return null;
        const v = hot.getDataAtCell(r, c);
        if (String(v ?? '').trim() === '') continue;
        filled++;
        const n = toNumber(v);
        if (!Number.isNaN(n)) numbers.push(n);
      }
    }
  }

  if (!numbers.length) return { count: filled, numericCount: 0 };
  const sum = numbers.reduce((a, b) => a + b, 0);
  return {
    count: filled,
    numericCount: numbers.length,
    sum,
    average: sum / numbers.length,
    min: Math.min(...numbers),
    max: Math.max(...numbers),
  };
}

// ── Insert Function dialog ────────────────────────────────────────────────────
// Excel's fx browser, trimmed to the functions an accounting paper actually needs. A student who
// knows "there must be a function for this" but not its name can find it here rather than guess —
// and every entry shows the same syntax line Excel does, so the knowledge transfers back.
const FUNCTION_CATALOG = [
  { group: 'Most used', items: [
    { name: 'SUM',     syntax: 'SUM(range)',                    desc: 'Adds up all the numbers in a range. e.g. =SUM(B2:B10)' },
    { name: 'AVERAGE', syntax: 'AVERAGE(range)',                desc: 'Mean of the numbers in a range.' },
    { name: 'COUNT',   syntax: 'COUNT(range)',                  desc: 'How many cells in the range hold a number.' },
    { name: 'MIN',     syntax: 'MIN(range)',                    desc: 'Smallest number in the range.' },
    { name: 'MAX',     syntax: 'MAX(range)',                    desc: 'Largest number in the range.' },
    { name: 'ROUND',   syntax: 'ROUND(number, digits)',         desc: 'Rounds to the given decimal places. =ROUND(B4,0) gives a whole number.' },
    { name: 'ABS',     syntax: 'ABS(number)',                   desc: 'Value without its minus sign — handy for showing a loss as a positive figure.' },
  ]},
  { group: 'Logic & lookup', items: [
    { name: 'IF',      syntax: 'IF(test, if_true, if_false)',   desc: 'Chooses between two results. =IF(B12>0,"Profit","Loss")' },
    { name: 'SUMIF',   syntax: 'SUMIF(range, criteria, [sum_range])', desc: 'Adds only the cells that meet a condition.' },
    { name: 'COUNTIF', syntax: 'COUNTIF(range, criteria)',      desc: 'Counts only the cells that meet a condition.' },
    { name: 'VLOOKUP', syntax: 'VLOOKUP(value, table, col, [exact])', desc: 'Looks a value up in the first column of a table and returns a figure from another column.' },
    { name: 'IFERROR', syntax: 'IFERROR(value, if_error)',      desc: 'Shows your own text instead of an error such as #DIV/0!.' },
  ]},
  { group: 'Financial', items: [
    { name: 'NPV',     syntax: 'NPV(rate, values)',             desc: 'Net present value of a series of cash flows at a discount rate.' },
    { name: 'IRR',     syntax: 'IRR(values)',                   desc: 'Internal rate of return of a series of cash flows.' },
    { name: 'PMT',     syntax: 'PMT(rate, nper, pv)',           desc: 'Repayment per period on a loan.' },
    { name: 'FV',      syntax: 'FV(rate, nper, pmt, [pv])',     desc: 'Future value of an investment.' },
    { name: 'PV',      syntax: 'PV(rate, nper, pmt, [fv])',     desc: 'Present value of a series of payments.' },
    { name: 'SLN',     syntax: 'SLN(cost, salvage, life)',      desc: 'Straight-line depreciation for one period.' },
  ]},
];

function InsertFunctionDialog({ open, onClose, onInsert }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(FUNCTION_CATALOG[0].items[0]);

  const needle = query.trim().toLowerCase();
  const groups = FUNCTION_CATALOG
    .map(g => ({
      ...g,
      items: needle
        ? g.items.filter(i => i.name.toLowerCase().includes(needle) || i.desc.toLowerCase().includes(needle))
        : g.items,
    }))
    .filter(g => g.items.length);

  const insert = (fn) => { onInsert(fn); onClose(); };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontSize: 15, fontWeight: 700, color: EXCEL.text, py: 1.25 }}>
        Insert Function
      </DialogTitle>
      <DialogContent dividers sx={{ p: 0 }}>
        <Box sx={{ p: 1.25, borderBottom: `1px solid ${EXCEL.ribbonEdge}` }}>
          <TextField
            autoFocus fullWidth size="small" placeholder="Search for a function…"
            value={query} onChange={(e) => setQuery(e.target.value)}
            InputProps={{ startAdornment: (
              <InputAdornment position="start"><Search sx={{ fontSize: 17, color: EXCEL.muted }} /></InputAdornment>
            ) }}
            sx={{ '& .MuiInputBase-input': { fontSize: 13 } }}
          />
        </Box>
        <Box sx={{ display: 'flex', minHeight: 280 }}>
          <Box sx={{ width: '48%', borderRight: `1px solid ${EXCEL.ribbonEdge}`, overflowY: 'auto', maxHeight: 320 }}>
            {groups.length === 0 && (
              <Typography sx={{ p: 2, fontSize: 12.5, color: EXCEL.muted }}>No function matches “{query}”.</Typography>
            )}
            {groups.map(g => (
              <Box key={g.group}>
                <Typography sx={{
                  px: 1.5, py: 0.5, fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: 0.6, color: EXCEL.muted, bgcolor: EXCEL.ribbonBg,
                }}>{g.group}</Typography>
                {g.items.map(item => (
                  <ListItemButton
                    key={item.name}
                    selected={selected?.name === item.name}
                    onClick={() => setSelected(item)}
                    onDoubleClick={() => insert(item)}
                    sx={{
                      py: 0.4, px: 1.5,
                      '&.Mui-selected': { bgcolor: EXCEL.greenPale },
                      '&.Mui-selected:hover': { bgcolor: EXCEL.greenLight },
                    }}
                  >
                    <Typography sx={{ fontSize: 12.5, fontFamily: 'monospace', fontWeight: 700, color: EXCEL.text }}>
                      {item.name}
                    </Typography>
                  </ListItemButton>
                ))}
              </Box>
            ))}
          </Box>
          <Box sx={{ flex: 1, p: 1.75 }}>
            {selected && (
              <>
                <Typography sx={{ fontSize: 13, fontFamily: 'monospace', fontWeight: 700, color: EXCEL.green, mb: 1 }}>
                  ={selected.syntax}
                </Typography>
                <Typography sx={{ fontSize: 12.5, color: EXCEL.text, lineHeight: 1.55 }}>
                  {selected.desc}
                </Typography>
              </>
            )}
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 2, py: 1 }}>
        <Button onClick={onClose} sx={{ textTransform: 'none', fontSize: 13, color: EXCEL.muted }}>Cancel</Button>
        <Button
          variant="contained" disabled={!selected} onClick={() => selected && insert(selected)}
          sx={{ textTransform: 'none', fontSize: 13, bgcolor: EXCEL.green, '&:hover': { bgcolor: EXCEL.greenDark } }}
        >
          Insert
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Header quality check (teacher setup) ──────────────────────────────────────
// The column headers are the only labels a student gets, so an unclear set makes an otherwise
// correct template unanswerable. Two failure modes show up in real questions: the untouched
// placeholder headers (a "Jan…Jun, Total" grid on a question that isn't monthly), and repeated
// names — a statement's workings column and its running-total column are both "FRW '000'", and
// nothing on screen says which is which.
function headerProblems(headers = []) {
  const names = headers.map(h => String(h ?? '').trim());
  const problems = [];

  const placeholders = names.filter((n, i) => n && n === DEFAULT_HEADERS[i]).length;
  if (placeholders >= 3) {
    problems.push('These are still the default placeholder column names — rename them to match the statement this question actually asks for.');
  }

  const seen = new Map();
  const dupes = [];
  names.forEach((n, i) => {
    if (!n) return;
    const key = n.toLowerCase();
    if (seen.has(key)) dupes.push(`${colLabel(seen.get(key))} and ${colLabel(i)} are both "${n}"`);
    else seen.set(key, i);
  });
  if (dupes.length) {
    problems.push(`Students can't tell these columns apart: ${dupes.join('; ')}. Give them distinct names (e.g. "Workings" and "Total").`);
  }

  const blanks = names.filter(n => !n).length;
  if (blanks) problems.push(`${blanks} column${blanks > 1 ? 's have' : ' has'} no name at all.`);

  return problems;
}

// ── Add-column dialog ─────────────────────────────────────────────────────────
// A question's template can arrive without the column the answer actually needs — a running
// "Total", or a workings column beside the figures. Rather than leaving the student stuck with a
// grid that can't hold a complete answer, they can append one; naming it up front keeps the sheet
// readable (and readable for whoever marks it) instead of adding a blank "Col 5".
const COLUMN_NAME_SUGGESTIONS = ['Total', 'Workings', 'Amount', 'Debit', 'Credit', 'Subtotal'];

function AddColumnDialog({ open, existingHeaders = [], onClose, onAdd }) {
  const [name, setName] = useState('Total');

  useEffect(() => {
    if (!open) return;
    const taken = existingHeaders.map(h => String(h ?? '').trim().toLowerCase());
    setName(COLUMN_NAME_SUGGESTIONS.find(s => !taken.includes(s.toLowerCase())) || '');
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = () => {
    const clean = name.trim();
    if (!clean) return;
    onAdd(clean);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontSize: 15, fontWeight: 700, color: EXCEL.text, py: 1.25 }}>
        Add a column
      </DialogTitle>
      <DialogContent dividers>
        <Typography sx={{ fontSize: 12.5, color: EXCEL.muted, mb: 1.5 }}>
          The new column is added at the right-hand end of the sheet, so nothing you have already
          entered moves. Give it a name so it's clear what it holds.
        </Typography>
        <TextField
          autoFocus fullWidth size="small" label="Column name" value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
          sx={{ mb: 1.5, '& .MuiInputBase-input': { fontSize: 13 } }}
        />
        <Stack direction="row" flexWrap="wrap" gap={0.75}>
          {COLUMN_NAME_SUGGESTIONS.map(s => (
            <Chip key={s} label={s} size="small" onClick={() => setName(s)}
              variant={name === s ? 'filled' : 'outlined'}
              sx={{
                fontSize: 11, height: 24, cursor: 'pointer',
                ...(name === s ? { bgcolor: EXCEL.greenLight, color: EXCEL.greenDark, fontWeight: 700 } : {}),
              }}
            />
          ))}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 2, py: 1 }}>
        <Button onClick={onClose} sx={{ textTransform: 'none', fontSize: 13, color: EXCEL.muted }}>Cancel</Button>
        <Button variant="contained" disabled={!name.trim()} onClick={submit}
          sx={{ textTransform: 'none', fontSize: 13, bgcolor: EXCEL.green, '&:hover': { bgcolor: EXCEL.greenDark } }}>
          Add column
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── EditableGrid ──────────────────────────────────────────────────────────────
// `variant`:
//   'full'   – teacher setup: every structural + formatting control
//   'simple' – student sitting the exam: the Excel-familiar controls only. Insert/remove row and
//              column are deliberately withheld because the grader compares the student's grid to
//              the model answer *by position* (spreadsheetGrading.js), so a single inserted row
//              shifts everything below it and zeroes otherwise-correct work.
function EditableGrid({
  data, headers: initialHeaders, formulas, hotRef, height,
  onChange, onStatsChange, variant = 'full',
  givenColumns = [], onToggleGivenColumn,
}) {
  const containerRef = useRef(null);
  const hotInstance  = useRef(null);
  const [headers, setHeaders] = useState(initialHeaders);
  const headersRef = useRef(initialHeaders);
  const isSimple = variant === 'simple';
  const givenSet = new Set(givenColumns);

  // Formula bar + status bar state
  const [activeRef, setActiveRef] = useState(cellRefOf(0, 0));
  const [formulaText, setFormulaText] = useState('');
  const [formulaDirty, setFormulaDirty] = useState(false);
  const lastSelRef = useRef([0, 0]);
  // Handsontable moves the selection on mousedown, i.e. *before* the formula field's blur fires.
  // These two refs keep an in-progress formula-bar edit pinned to the cell it was started on
  // instead of silently landing in (or being discarded by) whichever cell was clicked next.
  const formulaFocusedRef = useRef(false);
  const formulaTargetRef  = useRef([0, 0]);
  const formulaInputRef   = useRef(null);
  const [fxOpen, setFxOpen] = useState(false);

  // Last selected range, so a ribbon action can restore the selection if anything has cleared it
  // (a dialog, the currency menu, or a stray click) rather than quietly doing nothing.
  const lastRangeRef = useRef(null);

  // Point mode bookkeeping. `formulaTextRef` mirrors formulaText because Handsontable's hooks are
  // registered once and would otherwise close over the first render's value. `pointRef` holds the
  // in-flight reference insertion: which surface is being edited ('bar' or 'cell'), the text as it
  // stood before this click so a drag can keep rewriting the same token, and the drag anchor.
  const formulaTextRef = useRef('');
  useEffect(() => { formulaTextRef.current = formulaText; }, [formulaText]);
  const pointRef = useRef(null);

  // Column count the question shipped with — the boundary between the template's own columns and
  // anything the student appended themselves.
  const baseColCountRef = useRef(initialHeaders?.length ?? 0);
  const pendingColNameRef = useRef(null);
  const [addColOpen, setAddColOpen] = useState(false);
  const [currencyAnchor, setCurrencyAnchor] = useState(null);
  // Short-lived message telling the student why a ribbon button did nothing, instead of the
  // button appearing broken.
  const [hint, setHintRaw] = useState('');
  const hintTimerRef = useRef(null);
  const setHint = (message) => {
    setHintRaw(message);
    clearTimeout(hintTimerRef.current);
    hintTimerRef.current = setTimeout(() => setHintRaw(''), 4000);
  };
  useEffect(() => () => clearTimeout(hintTimerRef.current), []);

  useEffect(() => { headersRef.current = headers; }, [headers]);

  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  // The status bar lives in the workbook shell (below the sheet tabs, as in Excel), so this grid
  // only reports the numbers rather than rendering them.
  const onStatsChangeRef = useRef(onStatsChange);
  useEffect(() => { onStatsChangeRef.current = onStatsChange; }, [onStatsChange]);
  const setStats = (s) => onStatsChangeRef.current?.(s);

  // Single place that pushes a change upward, so every callback reports values *and* formulas.
  const emit = useCallback((hot, cols) => {
    onChangeRef.current?.(hot.getData(), cols, extractFormulas(hot.getSourceData()));
  }, []);

  // Renders "A" over "Account / Item" so a student can read a cell reference straight off the
  // grid. Without the letters, an Excel-literate student has no way to know that the "Feb"
  // column is column C, which makes every formula they already know unusable.
  const buildColHeader = useCallback((visualColIndex) => {
    const name = headersRef.current?.[visualColIndex];
    const letter = colLabel(visualColIndex);
    // Two columns can legitimately carry the same name (a statement's workings column and its
    // running-total column are both "FRW '000'"), so the tooltip spells out which is which.
    const dupIndex = name
      ? headersRef.current.filter((h, i) => i < visualColIndex && String(h).trim() === String(name).trim()).length
      : 0;
    const title = name
      ? `Column ${letter} — ${name}${dupIndex ? ` (${dupIndex + 1}${dupIndex === 1 ? 'nd' : 'rd'} column with this name)` : ''}`
      : `Column ${letter}`;
    return (
      `<span class="fin-col-head" title="${escapeHtml(title)}">` +
      `<span class="fin-col-letter">${letter}</span>` +
      (name ? `<span class="fin-col-name">${escapeHtml(name)}</span>` : '') +
      `</span>`
    );
  }, []);

  // Writes the reference for the cell/range being pointed at into whichever surface is mid-edit.
  const applyPointRef = useCallback((r1, c1, r2 = r1, c2 = c1) => {
    const ctx = pointRef.current;
    if (!ctx) return;
    const next = withRefInserted(ctx.base, rangeRefOf(r1, c1, r2, c2));

    if (ctx.target === 'cell') {
      const editor = hotInstance.current?.getActiveEditor();
      if (editor?.isOpened?.()) {
        editor.setValue(next);
        editor.focus?.();
      }
      return;
    }

    setFormulaText(next);
    setFormulaDirty(true);
    // Handsontable focuses its own hidden textarea on mousedown, so the caret has to be put back
    // at the end of the fx bar after the click settles.
    requestAnimationFrame(() => {
      const input = formulaInputRef.current;
      if (!input) return;
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    });
  }, []);

  // Mount HOT with HyperFormula + all finance features
  useEffect(() => {
    if (!containerRef.current) return;

    const initialData = mergeFormulas(data && data.length ? data : makeEmptyData(), formulas);

    const hot = new Handsontable(containerRef.current, {
      data: initialData,
      colHeaders: buildColHeader,
      rowHeaders: true,
      height,
      width: '100%',
      licenseKey: 'non-commercial-and-evaluation',
      className: 'ht-theme-main',

      // ── Formula engine ──────────────────────────────────────────────────
      formulas: {
        engine: HyperFormula.buildEmpty({ licenseKey: 'gpl-v3' }),
        sheetName: 'Sheet1',
      },

      // Cell types are overridden per-cell via meta (the number-format buttons); this default
      // renderer only adds Excel's numeric right-alignment on top of plain text cells.
      renderer: finTextRenderer,

      // Every ribbon action works on the current selection, and Handsontable clears the selection
      // on any click outside the grid by default — so clicking $ , % , AutoSum or a format button
      // wiped the very selection it was meant to act on, and the button silently did nothing.
      outsideClickDeselects: false,

      // ── UX features ─────────────────────────────────────────────────────
      manualColumnResize: true,
      manualRowResize: true,
      // Reordering and sorting are authoring tools, not answering tools: for a student they
      // rearrange the answer out of step with the marking scheme. Sorting is the sharpest edge —
      // a single stray click on a column header would reshuffle every figure they had entered.
      manualColumnMove: !isSimple,
      manualRowMove: !isSimple,
      columnSorting: !isSimple,
      multiColumnSorting: false,
      stretchH: 'all',
      wordWrap: true,
      autoWrapRow: false,
      autoWrapCol: false,
      mergeCells: true,
      customBorders: true,
      undoRedo: true,
      fillHandle: true,
      copyPaste: true,
      comments: true,
      fixedRowsTop: 0,
      fixedColumnsStart: 0,
      minSpareRows: 1,

      // ── Context menu ────────────────────────────────────────────────────
      contextMenu: isSimple ? {
        items: {
          copy:           {},
          cut:            {},
          separator1:     Handsontable.plugins.ContextMenu.SEPARATOR,
          undo:           {},
          redo:           {},
          separator2:     Handsontable.plugins.ContextMenu.SEPARATOR,
          commentsAddEdit: { name: '💬 Add / Edit note' },
          commentsRemove:  { name: '✕ Remove note' },
        },
      } : {
        items: {
          row_above:      { name: '⬆ Insert row above' },
          row_below:      { name: '⬇ Insert row below' },
          remove_row:     { name: '✕ Remove row' },
          separator1:     Handsontable.plugins.ContextMenu.SEPARATOR,
          col_left:       { name: '◀ Insert column left' },
          col_right:      { name: '▶ Insert column right' },
          remove_col:     { name: '✕ Remove column' },
          separator2:     Handsontable.plugins.ContextMenu.SEPARATOR,
          mergeCells:     { name: 'Merge / Unmerge cells' },
          separator3:     Handsontable.plugins.ContextMenu.SEPARATOR,
          copy:           {},
          cut:            {},
          separator4:     Handsontable.plugins.ContextMenu.SEPARATOR,
          commentsAddEdit: { name: '💬 Add / Edit comment' },
          commentsRemove:  { name: '✕ Remove comment' },
          separator5:     Handsontable.plugins.ContextMenu.SEPARATOR,
          clear_column:   { name: 'Clear column' },
          separator6:     Handsontable.plugins.ContextMenu.SEPARATOR,
          freeze_column:  {
            name: '❄ Freeze / Unfreeze column',
            callback(key, sel) {
              const col = sel[0].start.col;
              const frozen = hot.getSettings().fixedColumnsStart || 0;
              hot.updateSettings({ fixedColumnsStart: frozen === col + 1 ? 0 : col + 1 });
            },
          },
          freeze_row: {
            name: '❄ Freeze / Unfreeze row',
            callback(key, sel) {
              const row = sel[0].start.row;
              const frozen = hot.getSettings().fixedRowsTop || 0;
              hot.updateSettings({ fixedRowsTop: frozen === row + 1 ? 0 : row + 1 });
            },
          },
        },
      },

      // ── Point mode: click a cell while typing a formula to insert its reference ──────────
      // Two surfaces can be mid-formula, and they need opposite treatment:
      //   fx bar  – preventDefault keeps the caret in the input, but Handsontable is allowed to
      //             select as usual, so dragging out a range drives afterSelection for free.
      //   in-cell – the selection must be suppressed entirely, because any selection change
      //             closes the open editor; the drag is tracked by hand instead.
      beforeOnCellMouseDown(event, coords, TD, controller) {
        if (!coords || coords.row < 0 || coords.col < 0) return; // headers, not cells

        const editor = this.getActiveEditor();
        const editingCell = editor?.isOpened?.() && isFormulaInProgress(editor.getValue());
        const editingBar  = formulaFocusedRef.current && isFormulaInProgress(formulaTextRef.current);
        if (!editingCell && !editingBar) return;

        pointRef.current = {
          target: editingCell ? 'cell' : 'bar',
          base: editingCell ? String(editor.getValue() ?? '') : formulaTextRef.current,
          anchor: [coords.row, coords.col],
        };
        event.preventDefault();

        if (!editingCell) return; // fx bar: let the normal selection happen

        // Suppress the selection so the open editor survives the click. Handsontable gates this
        // on its own flag (tableView checks isImmediatePropagationStopped, which reads
        // `event.isImmediatePropagationEnabled`) — the native stopImmediatePropagation() does not
        // set it, so its helper must be used. The controller is belt-and-braces for the same aim.
        Handsontable.dom.stopImmediatePropagation(event);
        if (controller) { controller.row = true; controller.column = true; controller.cell = true; }
        applyPointRef(coords.row, coords.col);

        // Track the drag ourselves so a range can be pointed at without the editor closing.
        const hot = this;
        const onMove = (moveEvent) => {
          const el = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY);
          const td = el?.closest?.('td');
          if (!td || !hot.rootElement.contains(td)) return;
          const to = hot.getCoords(td);
          if (!to || to.row < 0 || to.col < 0) return;
          const [ar, ac] = pointRef.current?.anchor ?? [to.row, to.col];
          applyPointRef(ar, ac, to.row, to.col);
        };
        const onUp = () => {
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
          if (pointRef.current?.target === 'cell') pointRef.current = null;
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      },

      // Ctrl+B / Ctrl+I / Ctrl+U are pure muscle memory for anyone who has used Excel, and
      // silently doing nothing is worse than not offering the formatting at all.
      beforeKeyDown(event) {
        if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
        const key = event.key?.toLowerCase();
        const cls = key === 'b' ? 'fin-bold' : key === 'i' ? 'fin-italic' : key === 'u' ? 'fin-underline' : null;
        if (!cls) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        toggleClassOnSelection(this, cls);
      },

      // ── Callbacks ───────────────────────────────────────────────────────
      // getData() returns evaluated values (what gets graded); getSourceData() returns the raw
      // formulas the author typed, kept alongside so they survive a save/resume round-trip.
      afterChange(changes, source) {
        if (!changes || source === 'loadData') return;
        emit(this, headersRef.current);
      },
      afterCreateRow() { emit(this, headersRef.current); },
      afterRemoveRow() { emit(this, headersRef.current); },
      afterCreateCol() {
        const name = pendingColNameRef.current || `Col ${headersRef.current.length + 1}`;
        pendingColNameRef.current = null;
        const newH = [...headersRef.current, name];
        headersRef.current = newH;
        setHeaders(newH);
        this.updateSettings({ colHeaders: buildColHeader });
        emit(this, newH);
      },
      afterRemoveCol() {
        const newH = headersRef.current.slice(0, this.countCols());
        headersRef.current = newH;
        setHeaders(newH);
        this.updateSettings({ colHeaders: buildColHeader });
        emit(this, newH);
      },
      afterMergeCells() { emit(this, headersRef.current); },
      afterUnmergeCells() { emit(this, headersRef.current); },

      // While the fx bar is pointing, every selection change (including each step of a drag)
      // rewrites the reference rather than moving which cell is being edited.
      afterSelection(r1, c1, r2, c2) {
        if (pointRef.current?.target === 'bar') applyPointRef(r1, c1, r2, c2);
      },

      // Keep the formula bar and status bar in step with the selection, like Excel.
      afterSelectionEnd(row, col, row2, col2) {
        lastRangeRef.current = [row, col, row2, col2];
        setStats(computeSelectionStats(this));
        if (pointRef.current?.target === 'bar') {
          applyPointRef(row, col, row2, col2);
          return; // the edited cell is unchanged — only the reference moved
        }
        lastSelRef.current = [row, col];
        // An unsaved formula-bar edit belongs to the previously selected cell — leave it alone.
        if (formulaFocusedRef.current) return;
        setActiveRef(cellRefOf(row, col));
        const source = this.getSourceDataAtCell(row, col);
        setFormulaText(source === null || source === undefined ? '' : String(source));
        setFormulaDirty(false);
      },
      afterDeselect() { setStats(null); },
    });

    hotInstance.current = hot;
    if (hotRef) hotRef.current = hot;

    return () => {
      hot.destroy();
      hotInstance.current = null;
      if (hotRef) hotRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Toolbar helpers ──────────────────────────────────────────────────────────
  const hot = () => hotInstance.current;

  // Returns the grid only when there is a range to act on, restoring the last one if the live
  // selection has been lost. Formatting buttons apply to "the cells you have selected", so
  // without this they appear broken exactly when a user has been clicking around the ribbon.
  const withSelection = (fn) => {
    const h = hot();
    if (!h) return;
    if (!h.getSelectedRange() && lastRangeRef.current) {
      const [r1, c1, r2, c2] = lastRangeRef.current;
      h.selectCells([[r1, c1, r2, c2]]);
    }
    if (!h.getSelectedRange()) {
      setHint('Select the cell or cells you want to change first, then click the button.');
      return;
    }
    fn(h);
  };

  const addRow    = () => { const h = hot(); if (h) h.alter('insert_row_below', h.countRows() - 1); };
  const removeRow = () => { const h = hot(); if (h && h.countRows() > 1) h.alter('remove_row', h.countRows() - 1); };

  // Columns are only ever appended, never inserted, so the columns the marking scheme knows about
  // keep their positions — the same constraint that governs rows.
  const addColumn = (name) => {
    const h = hot();
    if (!h) return;
    pendingColNameRef.current = name || '';
    h.alter('insert_col_end', h.countCols() - 1);
  };

  // Students may only take back columns they themselves added; the template's own columns are
  // part of the question and removing one would misalign every column to its right.
  const canRemoveCol = isSimple
    ? headers.length > baseColCountRef.current
    : headers.length > 1;
  const removeCol = () => {
    const h = hot();
    if (h && canRemoveCol) h.alter('remove_col', h.countCols() - 1);
  };
  const undo      = () => hot()?.undo();
  const redo      = () => hot()?.redo();

  const bold       = () => withSelection(h => toggleClassOnSelection(h, 'fin-bold'));
  const italic     = () => withSelection(h => toggleClassOnSelection(h, 'fin-italic'));
  const underline  = () => withSelection(h => toggleClassOnSelection(h, 'fin-underline'));
  const alignLeft  = () => withSelection(h => applyClassToSelection(h, 'fin-align-left',   ['fin-align-center','fin-align-right']));
  const alignCenter= () => withSelection(h => applyClassToSelection(h, 'fin-align-center', ['fin-align-left','fin-align-right']));
  const alignRight = () => withSelection(h => applyClassToSelection(h, 'fin-align-right',  ['fin-align-left','fin-align-center']));

  const markHeaderRow = () => withSelection(h => applyClassToSelection(h, 'fin-header-row', ['fin-total-row','fin-subtotal']));
  const markTotalRow  = () => withSelection(h => applyClassToSelection(h, 'fin-total-row',  ['fin-header-row','fin-subtotal']));
  const markSubtotal  = () => withSelection(h => applyClassToSelection(h, 'fin-subtotal',   ['fin-header-row','fin-total-row']));

  // Excel's "Increase / Decrease Decimal": steps each selected cell's own decimal count, keeping
  // whatever currency symbol and kind it already carries.
  const stepDecimals = (delta) => withSelection((h) => {
    h.getSelectedRange().forEach(({ from, to }) => {
      for (let r = Math.min(from.row, to.row); r <= Math.max(from.row, to.row); r++) {
        for (let c = Math.min(from.col, to.col); c <= Math.max(from.col, to.col); c++) {
          const current = h.getCellMeta(r, c).finFormat || { kind: 'accounting', decimals: 2 };
          const next = Math.max(0, Math.min(6, (current.decimals ?? 2) + delta));
          h.setCellMeta(r, c, 'finFormat', { ...current, decimals: next });
        }
      }
    });
    h.render();
  });

  // Excel's freeze panes: pin everything above and left of the selected cell.
  const toggleFreeze = () => withSelection((h) => {
    const [row, col] = h.getSelectedLast();
    const { fixedRowsTop = 0, fixedColumnsStart = 0 } = h.getSettings();
    const alreadyFrozen = fixedRowsTop === row && fixedColumnsStart === col && (row > 0 || col > 0);
    h.updateSettings(alreadyFrozen
      ? { fixedRowsTop: 0, fixedColumnsStart: 0 }
      : { fixedRowsTop: row, fixedColumnsStart: col });
  });

  // Sums the selected cells into the cell just below the selection, like Excel's AutoSum.
  // (spreadsheetColumnLabel is 0-based, and A1 references are 1-based rows — the previous
  // version passed col+1 and a 0-based row, so it summed the wrong column and skipped a row.)
  const insertSumFormula = () => withSelection((h) => {
    const { from, to } = h.getSelectedRange()[0];
    const col      = Math.min(from.col, to.col);
    const firstRow = Math.min(from.row, to.row);
    const lastRow  = Math.max(from.row, to.row);
    const letter   = colLabel(col);
    const target   = Math.min(lastRow + 1, h.countRows() - 1);
    if (target <= lastRow) {
      setHint('AutoSum needs an empty row below the figures — add a row, then try again.');
      return;
    }
    h.setDataAtCell(target, col, `=SUM(${letter}${firstRow + 1}:${letter}${lastRow + 1})`);
    h.selectCell(target, col);
  });

  // ── Formula bar ──────────────────────────────────────────────────────────────
  // Pulls the fx bar back in line with whatever cell is selected right now.
  const syncFormulaFromSelection = () => {
    const h = hot();
    if (!h) return;
    const [row, col] = lastSelRef.current;
    setActiveRef(cellRefOf(row, col));
    const source = h.getSourceDataAtCell(row, col);
    setFormulaText(source === null || source === undefined ? '' : String(source));
    setFormulaDirty(false);
  };

  const commitFormula = ({ refocusGrid }) => {
    const h = hot();
    if (!h) return;
    const [row, col] = formulaTargetRef.current;
    h.setDataAtCell(row, col, formulaText === '' ? null : formulaText);
    setFormulaDirty(false);
    if (refocusGrid) h.selectCell(row, col);
  };

  const onFormulaFocus = () => {
    formulaFocusedRef.current = true;
    formulaTargetRef.current = lastSelRef.current;
  };

  const finishFormulaEdit = () => {
    formulaFocusedRef.current = false;
    if (!formulaDirty) return;
    commitFormula({ refocusGrid: false });
    // The click that caused the blur has already moved the selection elsewhere.
    if (formulaTargetRef.current.join() !== lastSelRef.current.join()) syncFormulaFromSelection();
  };

  const onFormulaBlur = () => {
    // A blur caused by pointing at a cell must not commit the half-written formula — that is
    // exactly the case that used to save "=B1+" and produce an error. Handsontable steals focus
    // on mousedown and applyPointRef hands it back a frame later, so the way to tell a point-click
    // from a real click-away is simply whether focus came back.
    if (pointRef.current?.target === 'bar') {
      requestAnimationFrame(() => {
        if (document.activeElement === formulaInputRef.current) return;
        pointRef.current = null;
        finishFormulaEdit();
      });
      return;
    }
    finishFormulaEdit();
  };

  const cancelFormula = () => {
    formulaFocusedRef.current = false;
    pointRef.current = null;
    syncFormulaFromSelection();
    const [row, col] = lastSelRef.current;
    hot()?.selectCell(row, col);
  };

  const onFormulaKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      formulaFocusedRef.current = false;
      pointRef.current = null;
      commitFormula({ refocusGrid: true });
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelFormula();
    }
  };

  // Typing ends the current reference insertion: the next click starts a fresh one rather than
  // overwriting whatever the student has just typed by hand.
  const onFormulaInput = (value) => {
    pointRef.current = null;
    setFormulaText(value);
    setFormulaDirty(true);
  };

  // Drops "=NAME(" into the fx bar with the caret ready for arguments, like Excel's fx button.
  const insertFunction = (fn) => {
    pointRef.current = null;
    setFormulaText(`=${fn.name}(`);
    setFormulaDirty(true);
    requestAnimationFrame(() => {
      const input = formulaInputRef.current;
      if (!input) return;
      input.focus();
      const end = input.value.length;
      input.setSelectionRange(end, end);
    });
  };

  const renameHeader = (i, value) => {
    const newH = [...headers];
    newH[i] = value;
    headersRef.current = newH;
    setHeaders(newH);
    const h = hot();
    h?.updateSettings({ colHeaders: buildColHeader });
    if (h) emit(h, newH);
  };

  // Excel ribbon primitives: a flat icon/text button, and a labelled group of them.
  const RibbonBtn = ({ title, onClick, children, disabled }) => (
    <Tooltip title={title} disableInteractive>
      <span>
        <button
          type="button"
          className="fin-ribbon-btn"
          // Keeps the grid's selection and focus intact — a plain click would blur the grid
          // before onClick ran, leaving the action with nothing to apply to.
          onMouseDown={(e) => e.preventDefault()}
          onClick={onClick}
          disabled={disabled}
          aria-label={typeof title === 'string' ? title : undefined}>
          {children}
        </button>
      </span>
    </Tooltip>
  );

  const RibbonGroup = ({ label, children }) => (
    <Box sx={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.25,
      px: 0.75, borderRight: `1px solid ${EXCEL.ribbonEdge}`, minWidth: 0,
    }}>
      <Stack direction="row" alignItems="center" gap={0.25}>{children}</Stack>
      <Typography sx={{ fontSize: 9.5, color: EXCEL.muted, lineHeight: 1, fontFamily: EXCEL.font }}>
        {label}
      </Typography>
    </Box>
  );

  const icon = { fontSize: 16 };

  return (
    <Box className="fin-excel">
      {/* ── Ribbon (Excel's Home tab) ── */}
      <Stack direction="row" flexWrap="wrap" alignItems="stretch" rowGap={0.5}
        sx={{ px: 0.5, py: 0.5, bgcolor: EXCEL.ribbonBg, borderBottom: `1px solid ${EXCEL.ribbonEdge}` }}>

        <RibbonGroup label="Undo">
          <RibbonBtn title="Undo (Ctrl+Z)" onClick={undo}><Undo sx={icon} /></RibbonBtn>
          <RibbonBtn title="Redo (Ctrl+Y)" onClick={redo}><Redo sx={icon} /></RibbonBtn>
        </RibbonGroup>

        <RibbonGroup label="Font">
          <RibbonBtn title="Bold (Ctrl+B)"      onClick={bold}><FormatBold sx={icon} /></RibbonBtn>
          <RibbonBtn title="Italic (Ctrl+I)"    onClick={italic}><FormatItalic sx={icon} /></RibbonBtn>
          <RibbonBtn title="Underline (Ctrl+U)" onClick={underline}><FormatUnderlined sx={icon} /></RibbonBtn>
        </RibbonGroup>

        <RibbonGroup label="Alignment">
          <RibbonBtn title="Align left"   onClick={alignLeft}><FormatAlignLeft sx={icon} /></RibbonBtn>
          <RibbonBtn title="Align center" onClick={alignCenter}><FormatAlignCenter sx={icon} /></RibbonBtn>
          <RibbonBtn title="Align right"  onClick={alignRight}><FormatAlignRight sx={icon} /></RibbonBtn>
        </RibbonGroup>

        <RibbonGroup label="Number">
          <RibbonBtn
            title="Accounting format — 1,234.00, with negatives in brackets. Click the arrow to add a currency symbol."
            onClick={() => withSelection(h => applyCellFormat(h, { kind: 'accounting', symbol: '', decimals: 2 }))}
          >
            <span style={{ fontWeight: 700 }}>$</span>
          </RibbonBtn>
          <RibbonBtn title="Choose a currency symbol" onClick={(e) => setCurrencyAnchor(e.currentTarget)}>
            <span style={{ fontSize: 9 }}>▾</span>
          </RibbonBtn>
          <RibbonBtn title="Percent — shows the figure with a % sign" onClick={() => withSelection(h => applyCellFormat(h, { kind: 'percent', decimals: 2 }))}>
            <span style={{ fontWeight: 700 }}>%</span>
          </RibbonBtn>
          <RibbonBtn title="Comma style — 1,234, no decimals" onClick={() => withSelection(h => applyCellFormat(h, { kind: 'accounting', symbol: '', decimals: 0 }))}>
            <span style={{ fontWeight: 700 }}>,</span>
          </RibbonBtn>
          <RibbonBtn title="Increase decimal places" onClick={() => stepDecimals(1)}>
            <span style={{ fontSize: 11, letterSpacing: '-0.5px' }}>.00→</span>
          </RibbonBtn>
          <RibbonBtn title="Decrease decimal places" onClick={() => stepDecimals(-1)}>
            <span style={{ fontSize: 11, letterSpacing: '-0.5px' }}>←.0</span>
          </RibbonBtn>
          <RibbonBtn title="Remove formatting — show the figure exactly as typed" onClick={() => withSelection(h => applyCellFormat(h, { kind: null, symbol: '' }))}>
            <span style={{ fontSize: 10 }}>✕</span>
          </RibbonBtn>
        </RibbonGroup>

        <RibbonGroup label="Editing">
          <RibbonBtn title="AutoSum — select the figures to add, then click" onClick={insertSumFormula}>
            <Functions sx={icon} /><span style={{ fontSize: 11.5 }}>AutoSum</span>
          </RibbonBtn>
          <RibbonBtn title="Insert function — browse the formulas you can use" onClick={() => setFxOpen(true)}>
            <span style={{ fontStyle: 'italic', fontWeight: 700, fontSize: 12.5 }}>fx</span>
          </RibbonBtn>
          <RibbonBtn title="Freeze panes at the selected cell" onClick={toggleFreeze}>
            <AcUnit sx={icon} />
          </RibbonBtn>
        </RibbonGroup>

        <RibbonGroup label="Cells">
          <RibbonBtn title="Add a row at the bottom" onClick={addRow}>
            <Add sx={icon} /><span style={{ fontSize: 11.5 }}>Row</span>
          </RibbonBtn>
          <RibbonBtn
            title="Add a column at the right — use this if the answer needs a Total or workings column the sheet doesn't have"
            onClick={() => setAddColOpen(true)}
          >
            <Add sx={icon} /><span style={{ fontSize: 11.5 }}>Column</span>
          </RibbonBtn>
          {!isSimple && (
            <RibbonBtn title="Remove the last row" onClick={removeRow}><RemoveCircleOutline sx={icon} /></RibbonBtn>
          )}
          <RibbonBtn
            title={canRemoveCol
              ? 'Remove the last column'
              : "This sheet's own columns are part of the question and can't be removed — only ones you add"}
            onClick={removeCol}
            disabled={!canRemoveCol}
          >
            <Close sx={icon} />
          </RibbonBtn>
        </RibbonGroup>

        {!isSimple && (
          <RibbonGroup label="Styles">
            <RibbonBtn title="Mark selection as a header row" onClick={markHeaderRow}>
              <span style={{ fontSize: 11.5 }}>Header</span>
            </RibbonBtn>
            <RibbonBtn title="Mark selection as a total row" onClick={markTotalRow}>
              <span style={{ fontSize: 11.5 }}>Total</span>
            </RibbonBtn>
            <RibbonBtn title="Mark selection as a subtotal row" onClick={markSubtotal}>
              <span style={{ fontSize: 11.5 }}>Subtotal</span>
            </RibbonBtn>
          </RibbonGroup>
        )}
      </Stack>

      {/* ── Name Box + fx bar ───────────────────────────────────────────────────
          The single most-missed piece of Excel: without it a student can't see that a cell holds
          "=SUM(B2:B10)" rather than a typed number, and can't fix a formula without retyping it. */}
      <Stack direction="row" alignItems="center"
        sx={{ bgcolor: '#FFFFFF', borderBottom: `1px solid ${EXCEL.borderGray}` }}>
        <Tooltip title="Name Box — the cell you are in" disableInteractive>
          <Box sx={{
            minWidth: 68, textAlign: 'center', px: 1, py: 0.4,
            borderRight: `1px solid ${EXCEL.borderGray}`,
            fontSize: 12, fontWeight: 600, color: EXCEL.text, fontFamily: EXCEL.font,
          }}>
            {activeRef}
          </Box>
        </Tooltip>
        <Tooltip title="Insert function" disableInteractive>
          <Box component="button" type="button" onClick={() => setFxOpen(true)}
            sx={{
              px: 1.25, py: 0.4, border: 'none', borderRight: `1px solid ${EXCEL.borderGray}`,
              bgcolor: 'transparent', cursor: 'pointer', fontStyle: 'italic', fontWeight: 700,
              fontSize: 13, color: EXCEL.muted, fontFamily: EXCEL.font,
              '&:hover': { bgcolor: '#EDEBE9', color: EXCEL.green },
            }}>
            fx
          </Box>
        </Tooltip>
        <TextField
          fullWidth variant="standard" inputRef={formulaInputRef}
          value={formulaText}
          placeholder="Type a value, or start with = for a formula — e.g. =SUM(B2:B10)"
          onChange={(e) => onFormulaInput(e.target.value)}
          onKeyDown={onFormulaKeyDown}
          onFocus={onFormulaFocus}
          onBlur={onFormulaBlur}
          InputProps={{ disableUnderline: true }}
          sx={{ '& .MuiInputBase-input': { fontSize: 13, py: 0.45, px: 1, fontFamily: EXCEL.font, color: EXCEL.text } }}
        />
      </Stack>

      {/* ── Column setup strip (teacher only) ───────────────────────────────────
          Each column carries a "Given / To answer" toggle. Given columns are copied into the
          student's blank sheet as scaffolding; everything else is cleared for them to work out.
          Until a teacher touches a toggle the state shown is resolveGivenColumns()'s guess, so
          what they see here is exactly what the student will get. */}
      {!isSimple && (
        <Stack direction="row" alignItems="flex-start"
          sx={{ px: 1, py: 0.75, bgcolor: EXCEL.greenPale, borderBottom: `1px solid ${EXCEL.ribbonEdge}`, overflowX: 'auto', gap: 0.75 }}>
          <Box sx={{ minWidth: 96, pt: 0.5 }}>
            <Typography sx={{ fontSize: 10, fontWeight: 700, color: EXCEL.greenDark, whiteSpace: 'nowrap' }}>
              Column setup
            </Typography>
            <Typography sx={{ fontSize: 9.5, color: EXCEL.muted, whiteSpace: 'nowrap' }}>
              name · given?
            </Typography>
          </Box>
          {headers.map((h, i) => {
            const isGiven = givenSet.has(i);
            return (
              <Stack key={i} spacing={0.4} sx={{ minWidth: 108, maxWidth: 150 }}>
                <TextField size="small" value={h} onChange={(e) => renameHeader(i, e.target.value)}
                  InputProps={{ startAdornment: (
                    <InputAdornment position="start">
                      <Box component="span" sx={{ fontSize: 10, fontWeight: 700, color: EXCEL.muted }}>{colLabel(i)}</Box>
                    </InputAdornment>
                  ) }}
                  sx={{
                    bgcolor: '#FFFFFF',
                    '& .MuiInputBase-input': { fontSize: 11, py: 0.35, px: 0.5, fontWeight: 600, color: EXCEL.text },
                    '& .MuiOutlinedInput-root': { borderRadius: 0.5, pl: 0.75 },
                  }}
                />
                <Tooltip
                  title={isGiven
                    ? 'Students see this column already filled in (row labels / scaffolding). Click to make them answer it.'
                    : 'Students get this column blank and must work it out. Click to hand it to them instead.'}
                  disableInteractive
                >
                  <Box component="button" type="button" onClick={() => onToggleGivenColumn?.(i)}
                    sx={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.4,
                      width: '100%', py: 0.2, cursor: 'pointer', borderRadius: 0.5,
                      fontFamily: EXCEL.font, fontSize: 10, fontWeight: 700,
                      border: `1px solid ${isGiven ? '#A8CBBA' : '#E0C9A8'}`,
                      bgcolor: isGiven ? EXCEL.greenLight : '#FDF3E3',
                      color: isGiven ? EXCEL.greenDark : '#8A5A16',
                      '&:hover': { filter: 'brightness(0.96)' },
                    }}>
                    {isGiven ? <><Lock sx={{ fontSize: 11 }} />Given</> : <><Article sx={{ fontSize: 11 }} />To answer</>}
                  </Box>
                </Tooltip>
              </Stack>
            );
          })}
        </Stack>
      )}

      {!isSimple && headerProblems(headers).length > 0 && (
        <Alert severity="warning" sx={{ borderRadius: 0, py: 0.25, '& .MuiAlert-message': { fontSize: 11.5 } }}>
          <b>This template won't read clearly to students.</b>
          <Box component="ul" sx={{ m: 0, pl: 2 }}>
            {headerProblems(headers).map((p, i) => <li key={i}>{p}</li>)}
          </Box>
        </Alert>
      )}

      {/* ── Grid ── */}
      <Box sx={{ overflowX: 'auto', colorScheme: 'light' }}>
        <div ref={containerRef} />
      </Box>

      <Menu
        anchorEl={currencyAnchor}
        open={Boolean(currencyAnchor)}
        onClose={() => setCurrencyAnchor(null)}
      >
        {CURRENCY_OPTIONS.map(({ label, symbol }) => (
          <MenuItem
            key={label}
            onClick={() => {
              withSelection(h => applyCellFormat(h, { kind: 'accounting', symbol, decimals: 2 }));
              setCurrencyAnchor(null);
            }}
            sx={{ fontSize: 12.5, fontFamily: EXCEL.font, py: 0.5 }}
          >
            {label}
            <Box component="span" sx={{ ml: 'auto', pl: 2, color: EXCEL.muted, fontSize: 11.5 }}>
              {symbol ? `${symbol}1,234.00` : '1,234.00'}
            </Box>
          </MenuItem>
        ))}
      </Menu>

      {hint && (
        <Alert severity="info" sx={{ borderRadius: 0, py: 0.25, '& .MuiAlert-message': { fontSize: 11.5 } }}>
          {hint}
        </Alert>
      )}

      <InsertFunctionDialog open={fxOpen} onClose={() => setFxOpen(false)} onInsert={insertFunction} />
      <AddColumnDialog
        open={addColOpen}
        existingHeaders={headers}
        onClose={() => setAddColOpen(false)}
        onAdd={addColumn}
      />
    </Box>
  );
}

// ── ReadOnlyGrid ──────────────────────────────────────────────────────────────
function ReadOnlyGrid({ data, headers, height, hotRef }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const cols = headers && headers.length ? headers : [...DEFAULT_HEADERS];
    const hot = new Handsontable(containerRef.current, {
      data: data && data.length ? data : makeEmptyData(),
      // Same lettered headers as the editable grid, so a marker or a student reviewing their
      // result reads the exact cell references they used while answering.
      colHeaders: (i) =>
        `<span class="fin-col-head"><span class="fin-col-letter">${colLabel(i)}</span>` +
        (cols[i] ? `<span class="fin-col-name">${escapeHtml(cols[i])}</span>` : '') +
        `</span>`,
      rowHeaders: true,
      height,
      width: '100%',
      licenseKey: 'non-commercial-and-evaluation',
      className: 'ht-theme-main',
      readOnly: true,
      renderer: finTextRenderer,
      stretchH: 'all',
      wordWrap: true,
      manualColumnResize: true,
      contextMenu: false,
      formulas: {
        engine: HyperFormula.buildEmpty({ licenseKey: 'gpl-v3' }),
        sheetName: 'Sheet1',
      },
    });
    if (hotRef) hotRef.current = hot;
    return () => {
      hot.destroy();
      if (hotRef) hotRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Box className="fin-excel" sx={{ overflowX: 'auto', colorScheme: 'light' }}>
      <div ref={containerRef} />
    </Box>
  );
}

// ── Sheet tabs + status bar ───────────────────────────────────────────────────
// A financial question often asks for two or three statements at once (Income Statement, Balance
// Sheet, a workings note). Excel's answer to that is sheets, so that is what these are: one tab
// per statement, renamed by double-clicking the tab exactly as in Excel — far clearer than the
// stack of unlabelled grids this used to render.
function SheetTabs({ tables, activeIdx, onSelect, onRename, onAdd, onRemove, readOnly }) {
  const [renamingIdx, setRenamingIdx] = useState(-1);
  const [draft, setDraft] = useState('');

  const startRename = (idx) => {
    if (readOnly) return;
    setRenamingIdx(idx);
    setDraft(tables[idx].title || '');
  };

  const commitRename = () => {
    if (renamingIdx >= 0) onRename?.(renamingIdx, draft.trim());
    setRenamingIdx(-1);
  };

  return (
    <Stack direction="row" alignItems="center"
      sx={{ bgcolor: EXCEL.ribbonBg, borderTop: `1px solid ${EXCEL.borderGray}`, px: 0.5, overflowX: 'auto' }}>
      {tables.map((t, i) => {
        const label = t.title || `Sheet${i + 1}`;
        if (i === renamingIdx) {
          return (
            <TextField
              key={t._key} autoFocus variant="standard" value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); commitRename(); }
                if (e.key === 'Escape') { e.preventDefault(); setRenamingIdx(-1); }
              }}
              InputProps={{ disableUnderline: true }}
              sx={{
                width: 150, mx: 0.25, bgcolor: '#FFFFFF', border: `1px solid ${EXCEL.green}`,
                '& .MuiInputBase-input': { fontSize: 12, py: 0.35, px: 0.75, fontFamily: EXCEL.font, fontWeight: 700 },
              }}
            />
          );
        }
        return (
          <Tooltip key={t._key} title={readOnly ? label : `${label} — double-click to rename`} disableInteractive>
            <Box
              className={`fin-sheet-tab${i === activeIdx ? ' is-active' : ''}`}
              onClick={() => onSelect(i)}
              onDoubleClick={() => startRename(i)}
            >
              <span className="fin-sheet-tab-label">{label}</span>
              {!readOnly && tables.length > 1 && (
                <Close
                  sx={{ fontSize: 13, opacity: 0.55, '&:hover': { opacity: 1, color: '#C00000' } }}
                  onClick={(e) => { e.stopPropagation(); onRemove?.(i); }}
                />
              )}
            </Box>
          </Tooltip>
        );
      })}
      {!readOnly && (
        <Tooltip title="Add another statement (new sheet)" disableInteractive>
          <Box component="button" type="button" onClick={onAdd}
            sx={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 24, height: 24, ml: 0.5, border: 'none', bgcolor: 'transparent',
              cursor: 'pointer', color: EXCEL.muted, borderRadius: '3px',
              '&:hover': { bgcolor: '#EDEBE9', color: EXCEL.green },
            }}>
            <Add sx={{ fontSize: 16 }} />
          </Box>
        </Tooltip>
      )}
    </Stack>
  );
}

function StatusBar({ stats, sheetCount, activeIdx }) {
  const hasNumbers = stats && stats.numericCount > 0;
  return (
    <Stack direction="row" alignItems="center" gap={2} flexWrap="wrap"
      sx={{
        px: 1.25, py: 0.3, minHeight: 22, bgcolor: EXCEL.ribbonBg,
        borderTop: `1px solid ${EXCEL.ribbonEdge}`, fontFamily: EXCEL.font,
      }}>
      <Typography sx={{ fontSize: 11, color: EXCEL.muted, fontFamily: EXCEL.font }}>Ready</Typography>
      <Typography sx={{ fontSize: 11, color: EXCEL.muted, fontFamily: EXCEL.font }}>
        Sheet {activeIdx + 1} of {sheetCount}
      </Typography>
      <Box sx={{ flexGrow: 1 }} />
      {hasNumbers ? (
        <>
          <Typography sx={{ fontSize: 11, color: EXCEL.text, fontFamily: EXCEL.font }}>
            Average: {formatStat(stats.average)}
          </Typography>
          <Typography sx={{ fontSize: 11, color: EXCEL.text, fontFamily: EXCEL.font }}>
            Count: {stats.numericCount}
          </Typography>
          <Typography sx={{ fontSize: 11, color: EXCEL.text, fontWeight: 700, fontFamily: EXCEL.font }}>
            Sum: {formatStat(stats.sum)}
          </Typography>
        </>
      ) : (
        <Typography sx={{ fontSize: 10.5, color: EXCEL.muted, fontFamily: EXCEL.font }}>
          Select figures to see their Sum, Average and Count
        </Typography>
      )}
    </Stack>
  );
}

// ── ExcelWorkbook ─────────────────────────────────────────────────────────────
// The workbook shell: one EditableGrid per statement, only the active one visible, sheet tabs and
// the status bar underneath. Inactive grids stay mounted (hidden) rather than being unmounted, so
// switching tabs keeps each sheet's cell formatting, undo history and scroll position — losing
// those mid-exam would be its own bug. Handsontable measures itself as zero-width while hidden,
// so the newly revealed sheet is told to re-measure.
function ExcelWorkbook({
  tables, variant = 'full', height,
  onTableChange, onTitleChange, onAddTable, onRemoveTable, onGivenColumnsChange,
}) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [stats, setStats] = useState(null);
  // One stable ref object per sheet — EditableGrid writes its Handsontable instance into it.
  const hotRefs = useRef([]);
  const hotRefAt = (i) => (hotRefs.current[i] ||= { current: null });

  // Derived, not stored: a sheet can be removed underneath us, and `addSheet` deliberately points
  // at an index that only becomes valid on the next render.
  const safeIdx = Math.min(activeIdx, Math.max(0, tables.length - 1));

  // Handsontable measures itself as zero-width inside a display:none parent, so whichever sheet
  // has just become visible has to be told to re-measure.
  useEffect(() => {
    const id = requestAnimationFrame(() => hotRefAt(safeIdx).current?.refreshDimensions?.());
    return () => cancelAnimationFrame(id);
  }, [safeIdx]);

  const selectSheet = (idx) => { setActiveIdx(idx); setStats(null); };
  const addSheet = () => { onAddTable?.(); selectSheet(tables.length); };
  const removeSheet = (idx) => { onRemoveTable?.(idx); if (idx <= safeIdx) selectSheet(Math.max(0, safeIdx - 1)); };

  return (
    <Box className="fin-excel" sx={{ border: `1px solid ${EXCEL.borderGray}`, borderRadius: 0.5, overflow: 'hidden', bgcolor: '#FFFFFF' }}>
      {tables.map((t, i) => {
        // The toggle shows the effective state — the teacher's explicit choice if there is one,
        // otherwise the heuristic's — so the strip always mirrors what the student will receive.
        const given = resolveGivenColumns(t);
        return (
          <Box key={t._key} sx={{ display: i === safeIdx ? 'block' : 'none' }}>
            <EditableGrid
              data={t.data}
              headers={t.headers}
              formulas={t.formulas}
              hotRef={hotRefAt(i)}
              height={height}
              variant={variant}
              givenColumns={given}
              onToggleGivenColumn={(col) => onGivenColumnsChange?.(
                i,
                given.includes(col) ? given.filter(c => c !== col) : [...given, col].sort((a, b) => a - b)
              )}
              onChange={(data, headers, formulas) => onTableChange(i, data, headers, formulas)}
              onStatsChange={setStats}
            />
          </Box>
        );
      })}
      <SheetTabs
        tables={tables}
        activeIdx={safeIdx}
        onSelect={selectSheet}
        onRename={onTitleChange}
        onAdd={addSheet}
        onRemove={removeSheet}
      />
      <StatusBar stats={stats} sheetCount={tables.length} activeIdx={safeIdx} />
    </Box>
  );
}

// ── ReadOnlyWorkbook: same shell, no editing ──────────────────────────────────
function ReadOnlyWorkbook({ tables, height }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const safeIdx = Math.min(activeIdx, Math.max(0, tables.length - 1));
  const hotRefs = useRef([]);
  const hotRefAt = (i) => (hotRefs.current[i] ||= { current: null });

  useEffect(() => {
    const id = requestAnimationFrame(() => hotRefAt(safeIdx).current?.refreshDimensions?.());
    return () => cancelAnimationFrame(id);
  }, [safeIdx]);

  return (
    <Box className="fin-excel" sx={{ border: `1px solid ${EXCEL.borderGray}`, borderRadius: 0.5, overflow: 'hidden', bgcolor: '#FFFFFF' }}>
      {tables.map((t, i) => (
        <Box key={t._key} sx={{ display: i === safeIdx ? 'block' : 'none' }}>
          <ReadOnlyGrid data={t.data} headers={t.headers} height={height} hotRef={hotRefAt(i)} />
        </Box>
      ))}
      <SheetTabs tables={tables} activeIdx={safeIdx} onSelect={setActiveIdx} readOnly />
    </Box>
  );
}

// ── useTableSet: manages an array of tables + add/remove/update handlers ──────
function useTableSet(initialTables, onChangeCb) {
  const [tables, setTables] = useState(initialTables);

  const updateTable = useCallback((idx, data, headers, formulas) => {
    setTables(prev => {
      const next = prev.map((t, i) => (i === idx ? { ...t, data, headers, formulas } : t));
      onChangeCb?.(serialise(next));
      return next;
    });
  }, [onChangeCb]);

  const updateGivenColumns = useCallback((idx, givenColumns) => {
    setTables(prev => {
      const next = prev.map((t, i) => (i === idx ? { ...t, givenColumns } : t));
      onChangeCb?.(serialise(next));
      return next;
    });
  }, [onChangeCb]);

  const updateTitle = useCallback((idx, title) => {
    setTables(prev => {
      const next = prev.map((t, i) => (i === idx ? { ...t, title } : t));
      onChangeCb?.(serialise(next));
      return next;
    });
  }, [onChangeCb]);

  const addTable = useCallback(() => {
    setTables(prev => {
      const next = [...prev, makeEmptyTable('')];
      onChangeCb?.(serialise(next));
      return next;
    });
  }, [onChangeCb]);

  const removeTable = useCallback((idx) => {
    setTables(prev => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((_, i) => i !== idx);
      onChangeCb?.(serialise(next));
      return next;
    });
  }, [onChangeCb]);

  const replaceAll = useCallback((newTables) => {
    setTables(newTables);
    onChangeCb?.(serialise(newTables));
  }, [onChangeCb]);

  return { tables, setTables, updateTable, updateTitle, updateGivenColumns, addTable, removeTable, replaceAll };
}

// ── Student help panel ────────────────────────────────────────────────────────
// Students arrive already knowing Excel, so the job here is not to teach spreadsheets — it is to
// tell them, up front, exactly which Excel habits carry over and which two don't (don't insert
// rows; add extra tables instead of squeezing a second statement into one). Open by default the
// first time; the dismissal is remembered so it doesn't eat exam time on later questions.
const HELP_DISMISS_KEY = 'fin-spreadsheet-help-dismissed';

const FORMULA_EXAMPLES = [
  ['=SUM(B2:B10)',          'Add up cells B2 down to B10'],
  ['=B5-B9',                'Subtract one cell from another (e.g. Gross Profit)'],
  ['=B4*0.18',              'Multiply — e.g. 18% VAT on the value in B4'],
  ['=SUM(B2:B6)-SUM(C2:C6)','Combine ranges in one formula'],
  ['=ROUND(B7,0)',          'Round to the nearest whole number'],
  ['=IF(B12>0,"Profit","Loss")', 'Conditional text'],
];

function SpreadsheetHelpBox() {
  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem(HELP_DISMISS_KEY) !== '1'; } catch { return true; }
  });

  const toggle = () => {
    setOpen(prev => {
      const next = !prev;
      try { localStorage.setItem(HELP_DISMISS_KEY, next ? '0' : '1'); } catch { /* private mode */ }
      return next;
    });
  };

  const Row = ({ formula, meaning }) => (
    <Stack direction="row" spacing={1} alignItems="baseline" sx={{ mb: 0.25 }}>
      <Typography sx={{
        fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: '#1E40AF',
        bgcolor: '#FFFFFF', border: '1px solid #BFDBFE', borderRadius: 0.75,
        px: 0.6, py: 0.1, whiteSpace: 'nowrap',
      }}>{formula}</Typography>
      <Typography sx={{ fontSize: 11, color: '#334155' }}>{meaning}</Typography>
    </Stack>
  );

  return (
    <Box sx={{ mb: 1, border: '1px solid #BFDBFE', borderRadius: 1.5, bgcolor: '#F8FAFF' }}>
      <Box onClick={toggle}
        sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1.5, py: 0.75, cursor: 'pointer' }}>
        <HelpOutline sx={{ fontSize: 16, color: '#2563EB' }} />
        <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#1E40AF', flexGrow: 1 }}>
          How to use this sheet — it works like Excel
        </Typography>
        {open ? <ExpandLess sx={{ fontSize: 17, color: '#2563EB' }} /> : <ExpandMore sx={{ fontSize: 17, color: '#2563EB' }} />}
      </Box>

      <Collapse in={open}>
        <Box sx={{ px: 1.5, pb: 1.5 }}>
          <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: '#1E40AF', mb: 0.5 }}>
            Reading the sheet
          </Typography>
          <Typography sx={{ fontSize: 11.5, color: '#334155', mb: 1 }}>
            Columns are lettered <b>A, B, C…</b> across the top (the question's own column name is
            printed underneath the letter), and rows are numbered <b>1, 2, 3…</b> down the left. So
            the cell in column B, row 4 is <b>B4</b> — exactly as in Excel. The box on the left of
            the <i>fx</i> bar always shows which cell you are in, and the bar itself shows what that
            cell really contains, so you can check or fix a formula without retyping it.
          </Typography>

          <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: '#1E40AF', mb: 0.5 }}>
            Formulas — start with <code>=</code>, same as Excel
          </Typography>
          <Box sx={{ mb: 1 }}>
            {FORMULA_EXAMPLES.map(([formula, meaning]) => (
              <Row key={formula} formula={formula} meaning={meaning} />
            ))}
          </Box>
          <Typography sx={{ fontSize: 11.5, color: '#334155', mb: 1 }}>
            You don't have to type the cell names. Start the formula, then <b>click the cell you
            mean</b> and its reference is inserted for you — type <code>=</code>, click B5, type
            <code> -</code>, click B9 to get <code>=B5-B9</code>. Drag across cells to pick a whole
            range like <code>B2:B10</code>. Exactly as in Excel.
          </Typography>
          <Typography sx={{ fontSize: 11.5, color: '#334155', mb: 1 }}>
            Or select the cells you want to add and click <b>AutoSum</b> — the total drops into the
            cell below. Select any range of figures and the bar under the grid shows their
            <b> Sum, Average and Count</b>, just like Excel's status bar.
          </Typography>

          <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: '#1E40AF', mb: 0.5 }}>
            Keyboard shortcuts that work here
          </Typography>
          <Typography sx={{ fontSize: 11.5, color: '#334155', mb: 1 }}>
            <b>Enter</b> move down · <b>Tab</b> move right · <b>F2</b> or double-click to edit a
            cell · <b>Ctrl+C / Ctrl+V</b> copy &amp; paste (including from Excel) ·
            <b> Ctrl+Z / Ctrl+Y</b> undo &amp; redo · arrow keys to move · drag the small square at
            the corner of a selection to fill down.
          </Typography>

          <Alert severity="warning" icon={<Info sx={{ fontSize: 15 }} />}
            sx={{ py: 0.25, '& .MuiAlert-message': { fontSize: 11.5 } }}>
            <b>Three things to watch:</b> (1) the labels already filled in are the ones your marks
            are matched against, so <b>don't insert or delete rows in the middle</b> — use
            <b> Add Row</b> in the ribbon for an extra row at the bottom. (2) If the sheet is
            missing a column your answer needs — a <b>Total</b>, or somewhere to show your
            workings — click <b>Add Column</b>. It's added at the far right and you name it, so
            nothing you've already typed moves and the marker can see what it is. (3) If the
            question asks for more than one statement, each gets its <b>own sheet tab</b> at the
            bottom — click a tab to switch, <b>+</b> to add one, double-click a tab to rename it.
            Your work is saved when you move to the next question.
          </Alert>
        </Box>
      </Collapse>
    </Box>
  );
}

// ── Written-answer config (teacher-setup only) ─────────────────────────────────
// Some financial questions need more than the spreadsheet — e.g. "prepare the income statement
// AND comment on why gross profit changed". Lets a teacher optionally require a written answer
// alongside the grid, with its own prompt/model-answer/points so it can be graded separately
// (via AI open-ended grading) and combined into one score.
function WrittenAnswerConfigBox({ questionData, onConfigChange }) {
  const [open, setOpen] = useState(!!questionData?.requiresWrittenAnswer);
  const required = !!questionData?.requiresWrittenAnswer;

  return (
    <Box sx={{ mx: 1, mt: 1, border: '1px dashed #7C3AED', borderRadius: 1.5, bgcolor: '#F5F3FF' }}>
      <Box
        onClick={() => setOpen(o => !o)}
        sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1.5, py: 0.75, cursor: 'pointer' }}
      >
        <Article sx={{ fontSize: 15, color: '#7C3AED' }} />
        <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: '#5B21B6', flexGrow: 1 }}>
          {required ? 'Written answer required alongside the spreadsheet' : 'Also require a written answer? (optional)'}
        </Typography>
        {open ? <ExpandLess sx={{ fontSize: 16, color: '#7C3AED' }} /> : <ExpandMore sx={{ fontSize: 16, color: '#7C3AED' }} />}
      </Box>
      <Collapse in={open}>
        <Box sx={{ px: 1.5, pb: 1.5 }}>
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={required}
                onChange={(e) => onConfigChange({ requiresWrittenAnswer: e.target.checked })}
              />
            }
            label={<Typography sx={{ fontSize: 11.5, color: '#5B21B6' }}>Students must also write a text answer for this question (e.g. an explanation/comment), not just fill the grid</Typography>}
            sx={{ mb: required ? 1 : 0 }}
          />
          {required && (
            <>
              <TextField
                fullWidth
                size="small"
                multiline
                minRows={2}
                label="What should the written answer cover?"
                placeholder='e.g. "Comment on why gross profit margin changed compared to last year."'
                value={questionData?.writtenAnswerPrompt || ''}
                onChange={(e) => onConfigChange({ writtenAnswerPrompt: e.target.value })}
                sx={{ bgcolor: 'white', mb: 1, '& .MuiOutlinedInput-root': { fontSize: 12 } }}
              />
              <TextField
                fullWidth
                size="small"
                multiline
                minRows={2}
                label="Model answer / grading notes (used for AI grading)"
                placeholder="What should a full-marks written answer say?"
                value={questionData?.writtenAnswerModelAnswer || ''}
                onChange={(e) => onConfigChange({ writtenAnswerModelAnswer: e.target.value })}
                sx={{ bgcolor: 'white', mb: 1, '& .MuiOutlinedInput-root': { fontSize: 12 } }}
              />
              <TextField
                size="small"
                type="number"
                label="Marks for the written part"
                inputProps={{ min: 0, max: questionData?.points || questionData?.marks || 1 }}
                value={questionData?.writtenAnswerPoints || 0}
                onChange={(e) => onConfigChange({ writtenAnswerPoints: Math.max(0, parseInt(e.target.value) || 0) })}
                helperText={`Out of ${questionData?.points || questionData?.marks || 1} total — the rest goes to the spreadsheet`}
                sx={{ bgcolor: 'white', width: 220, '& .MuiOutlinedInput-root': { fontSize: 12 } }}
              />
            </>
          )}
        </Box>
      </Collapse>
    </Box>
  );
}

// ── AI paste-and-fill box (teacher-setup only) ─────────────────────────────────
// Lets a teacher paste a table copied from Excel/Word (e.g. a trial balance) and have AI turn
// it into the spreadsheet grid, instead of re-typing every row/value by hand. Only touches the
// model-answer table set via onFill — the student-facing template is re-derived automatically
// by the caller's onModelChange handler, same as any other manual edit to the grid.
function AiFillSpreadsheetBox({ questionText, passage, modelTables, onFill }) {
  const [open, setOpen] = useState(true);
  const [pasted, setPasted] = useState('');
  const [images, setImages] = useState([]); // [{ url: dataUri, name }]
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [applied, setApplied] = useState(false);

  const filled = hasAnyContent(modelTables || []);
  const canSubmit = (pasted.trim() || images.length > 0) && !loading;

  const handleImagePick = (fileList) => {
    const files = Array.from(fileList || []).slice(0, 3 - images.length);
    if (!files.length) return;
    Promise.all(files.map(file => new Promise(resolve => {
      const reader = new FileReader();
      reader.onloadend = () => resolve({ url: reader.result, name: file.name });
      reader.readAsDataURL(file);
    }))).then(newEntries => setImages(prev => [...prev, ...newEntries].slice(0, 3)));
  };

  const removeImage = (i) => setImages(prev => prev.filter((_, idx) => idx !== i));

  const handleFill = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError('');
    setApplied(false);
    try {
      const { data } = await api.post('/exam/ai-fill-spreadsheet', {
        questionText: questionText || '',
        passage: passage || '',
        pastedTable: pasted,
        imageDataUris: images.map(img => img.url),
        currentSpreadsheet: filled ? serialise(modelTables) : '',
      }, { timeout: 90000 });
      const tables = coerceToTables(JSON.parse(data.spreadsheetModelAnswer));
      if (!tables || !tables.length) {
        setError('AI could not read a table from that. Try again with clearer data or a clearer photo.');
        return;
      }
      onFill(cloneTables(tables));
      setPasted('');
      setImages([]);
      setApplied(true);
    } catch (err) {
      setError(err.response?.data?.message || 'AI could not build the spreadsheet. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ mx: 1, mt: 1, mb: 0.5, border: '1px dashed #059669', borderRadius: 1.5, bgcolor: '#F0FDF4' }}>
      <Box
        onClick={() => setOpen(o => !o)}
        sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1.5, py: 0.75, cursor: 'pointer' }}
      >
        <AutoAwesome sx={{ fontSize: 15, color: '#059669' }} />
        <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: '#065F46', flexGrow: 1 }}>
          {filled ? 'AI Assist — request a change to this spreadsheet' : 'AI Fill from a pasted table or photo'}
        </Typography>
        {open ? <ExpandLess sx={{ fontSize: 16, color: '#059669' }} /> : <ExpandMore sx={{ fontSize: 16, color: '#059669' }} />}
      </Box>
      <Collapse in={open}>
        <Box sx={{ px: 1.5, pb: 1.5 }}>
          <Typography sx={{ fontSize: 11, color: '#047857', mb: 1 }}>
            {filled
              ? 'Already have a grid? Ask AI to change it — e.g. "change salary expense to 500,000", "add a row for depreciation" — paste corrected/extra data, or upload a photo, and it will update the existing table(s) instead of starting over.'
              : 'Paste a table from Excel or Word, and/or upload a photo or screenshot of it (a trial balance, ledger, journal, or a finished statement) — AI will read the data and build the grid with the values computed for you.'}
          </Typography>
          <TextField
            fullWidth
            multiline
            minRows={filled ? 2 : 4}
            maxRows={10}
            placeholder={filled ? 'Describe a change, or paste new/corrected data…' : 'Paste your table here (optional if you upload a photo below)…'}
            value={pasted}
            onChange={(e) => { setPasted(e.target.value); setApplied(false); }}
            disabled={loading}
            sx={{ bgcolor: 'white', mb: 1, '& .MuiOutlinedInput-root': { fontSize: 12 } }}
          />

          {images.length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
              {images.map((img, i) => (
                <Box key={i} sx={{ position: 'relative', width: 72, height: 72 }}>
                  <Box
                    component="img"
                    src={img.url}
                    alt={img.name || `Upload ${i + 1}`}
                    sx={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 1, border: '1px solid #A7F3D0' }}
                  />
                  <IconButton
                    size="small"
                    onClick={() => removeImage(i)}
                    disabled={loading}
                    sx={{ position: 'absolute', top: -8, right: -8, bgcolor: 'rgba(239,68,68,0.92)', color: 'white', p: 0.25, '&:hover': { bgcolor: '#EF4444' } }}
                  >
                    <Close sx={{ fontSize: 12 }} />
                  </IconButton>
                </Box>
              ))}
            </Box>
          )}

          <Button
            component="label"
            size="small"
            variant="outlined"
            disabled={loading || images.length >= 3}
            startIcon={<AddPhotoAlternate sx={{ fontSize: 15 }} />}
            sx={{ textTransform: 'none', fontSize: 11, borderRadius: 1.5, borderColor: '#059669', color: '#059669', mb: 1 }}
          >
            {images.length > 0 ? `Add another photo (${images.length}/3)` : 'Upload a photo or screenshot'}
            <input
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => { handleImagePick(e.target.files); e.target.value = ''; }}
            />
          </Button>

          {error && <Alert severity="error" sx={{ mb: 1, py: 0, fontSize: 11 }}>{error}</Alert>}
          {applied && !error && (
            <Alert severity="success" sx={{ mb: 1, py: 0, fontSize: 11 }}>
              Applied — review the grid below. You can ask for another change any time.
            </Alert>
          )}
          <Button
            size="small"
            variant="contained"
            disabled={!canSubmit}
            onClick={handleFill}
            startIcon={loading ? <CircularProgress size={14} color="inherit" /> : <AutoAwesome sx={{ fontSize: 14 }} />}
            sx={{ textTransform: 'none', fontSize: 11.5, bgcolor: '#059669', '&:hover': { bgcolor: '#047857' } }}
          >
            {loading ? (filled ? 'Updating…' : 'Filling…') : (filled ? 'AI Update Spreadsheet' : 'AI Fill Spreadsheet')}
          </Button>
        </Box>
      </Collapse>
    </Box>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function FinancialSpreadsheet({
  mode = 'student',
  questionData = {},
  studentAnswerRaw = null,
  onTemplateChange,
  onModelChange,
  onAnswerChange,
  onConfigChange,
  writtenAnswer = '',
  // Marks and feedback for the written half, shown beside the answer in grading mode.
  writtenAnswerScore,
  writtenAnswerPoints,
  writtenAnswerFeedback,
  onWrittenAnswerChange,
  readOnly = false,
  height = 400,
}) {
  const isTeacherSetup = mode === 'teacher-setup';
  const isGrading      = mode === 'grading';
  const isStudent       = mode === 'student';

  const [activeTab, setActiveTab] = useState(0);

  // Parse stored sheets (each is an array of { title, headers, data } tables)
  const templateTablesInit = parseSheet(questionData?.spreadsheetTemplate);
  const modelTablesInit    = parseSheet(questionData?.spreadsheetModelAnswer);

  const answerTablesInit = (() => {
    if (!isStudent) return parseSheet(studentAnswerRaw);
    // Prefer a resumed answer that actually has content; otherwise start from the template
    // (a still-blank parsed answer would otherwise always lose progress on re-mount).
    if (studentAnswerRaw) {
      const parsedAnswer = parseSheet(studentAnswerRaw);
      if (hasAnyContent(parsedAnswer)) return parsedAnswer;
    }
    if (questionData?.spreadsheetTemplate) return cloneTables(templateTablesInit);
    return parseSheet(studentAnswerRaw);
  })();

  const template = useTableSet(templateTablesInit, (json) => onTemplateChange?.(json));
  const model    = useTableSet(modelTablesInit, (json) => {
    onModelChange?.(json);
    // Keep the student-facing blank grid in lockstep with the model answer automatically —
    // teachers only maintain one grid now (see blankTemplateFromModelJSON above).
    onTemplateChange?.(blankTemplateFromModelJSON(json));
  });
  const answer   = useTableSet(answerTablesInit, (json) => onAnswerChange?.(json));

  // On first mount of the teacher-setup editor, push the derived template once so a legacy
  // question (with a stale, separately-authored template) gets reconciled to the model answer
  // as soon as a teacher opens it, even before they make any edit.
  useEffect(() => {
    if (isTeacherSetup && modelTablesInit.length) {
      onTemplateChange?.(blankTemplateFromModelJSON(serialise(modelTablesInit)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleReset = () => {
    answer.replaceAll(cloneTables(template.tables));
  };

  // ── TEACHER SETUP ──────────────────────────────────────────────────────────
  if (isTeacherSetup) {
    return (
      <Box sx={{ border: '1px solid #D1FAE5', borderRadius: 2, overflow: 'hidden' }}>
        {/* Banner */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1, bgcolor: '#ECFDF5', borderBottom: '1px solid #A7F3D0' }}>
          <TableChart sx={{ fontSize: 18, color: '#059669' }} />
          <Typography sx={{ fontWeight: 700, fontSize: 13, color: '#065F46', flexGrow: 1 }}>
            Financial Spreadsheet — Model Answer
          </Typography>
          <Chip icon={<Lock sx={{ fontSize: 12 }} />} label="Hidden from students"
            size="small" sx={{ bgcolor: '#D1FAE5', color: '#065F46', fontSize: 10, fontWeight: 600 }} />
        </Box>

        <AiFillSpreadsheetBox
          questionText={questionData?.text}
          passage={questionData?.passage || questionData?.context}
          modelTables={model.tables}
          onFill={(tables) => model.replaceAll(tables)}
        />

        <WrittenAnswerConfigBox
          questionData={questionData}
          onConfigChange={(patch) => onConfigChange?.(patch)}
        />

        <Alert severity="info" icon={<Info sx={{ fontSize: 15 }} />}
          sx={{ mx: 1, mt: 1, py: 0.5, fontSize: 11, '& .MuiAlert-message': { fontSize: 11 } }}>
          Fill in the complete, correct financial statement(s) below — row labels and final values.
          Students get a copy of this grid with the <b>Given</b> columns kept and every other cell
          cleared, so they work the figures out themselves. Check the <b>Column setup</b> row above
          the grid: leading label columns ("Account / Item") are marked Given automatically, while
          columns that are really answers — a repeating Date or Project code — are left for the
          student. Click any toggle to override. If the question covers more than one statement,
          use the sheet tabs at the bottom to add one per statement.
        </Alert>

        <Box sx={{ p: 1 }}>
          <ExcelWorkbook
            tables={model.tables}
            variant="full"
            height={height}
            onTableChange={model.updateTable}
            onTitleChange={model.updateTitle}
            onGivenColumnsChange={model.updateGivenColumns}
            onAddTable={model.addTable}
            onRemoveTable={model.removeTable}
          />
        </Box>
      </Box>
    );
  }

  // ── GRADING ────────────────────────────────────────────────────────────────
  if (isGrading) {
    // A student who never touched the grid would otherwise be shown an empty default 20x8 sheet,
    // which reads as "this is what they submitted" rather than "they submitted nothing". Fall
    // back to the blank template they were given, clearly labelled.
    const answered = hasAnyContent(answer.tables);
    const fallbackTables = answered ? answer.tables : templateTablesInit;

    return (
      <Box sx={{ border: '1px solid #FDE68A', borderRadius: 2, overflow: 'hidden' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1, bgcolor: '#FFFBEB', borderBottom: '1px solid #FDE68A' }}>
          <TableChart sx={{ fontSize: 18, color: '#D97706' }} />
          <Typography sx={{ fontWeight: 700, fontSize: 13, color: '#92400E', flexGrow: 1 }}>
            Financial Spreadsheet
          </Typography>
        </Box>
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}
          sx={{ bgcolor: '#FAFAFA', borderBottom: '1px solid #E2E8F0', minHeight: 36,
            '& .MuiTab-root': { minHeight: 36, fontSize: 12, fontWeight: 600, textTransform: 'none' } }}>
          <Tab label="📝 Answer given" />
          <Tab label="✅ Correct answer" />
        </Tabs>
        {activeTab === 0 && (
          <Box sx={{ p: 1 }}>
            {!answered && (
              <Alert severity="warning" sx={{ mb: 1, py: 0.25, '& .MuiAlert-message': { fontSize: 11 } }}>
                Nothing was entered in the spreadsheet. Showing the blank sheet as it was given, so
                you can see what the question asked for.
              </Alert>
            )}
            <ReadOnlyWorkbook tables={fallbackTables} height={height} />
            {(questionData?.requiresWrittenAnswer || writtenAnswer) && (
              <Box sx={{ mt: 1.5, border: '1px solid #E2E8F0', borderRadius: 1.5, bgcolor: 'white', overflow: 'hidden' }}>
                <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap"
                  sx={{ px: 1.5, py: 0.75, bgcolor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                  <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: '#1E40AF' }}>✍️ Written Answer</Typography>
                  {/* The mark for the written half, beside the answer it belongs to — a student
                      could previously see their explanation and the spreadsheet score, but nothing
                      telling them whether the explanation itself earned anything. */}
                  {writtenAnswerPoints > 0 && (
                    <Chip
                      size="small"
                      label={`${writtenAnswerScore ?? 0} / ${writtenAnswerPoints}`}
                      sx={{
                        height: 20, fontSize: 11, fontWeight: 700,
                        bgcolor: (writtenAnswerScore ?? 0) >= writtenAnswerPoints ? '#DCFCE7'
                          : (writtenAnswerScore ?? 0) > 0 ? '#FEF3C7' : '#FEE2E2',
                        color: (writtenAnswerScore ?? 0) >= writtenAnswerPoints ? '#166534'
                          : (writtenAnswerScore ?? 0) > 0 ? '#92400E' : '#991B1B',
                      }}
                    />
                  )}
                </Stack>
                <Box sx={{ p: 1.5 }}>
                  <Typography sx={{ fontSize: 12, whiteSpace: 'pre-wrap', color: writtenAnswer ? '#1E293B' : '#94A3B8' }}>
                    {writtenAnswer || 'No written answer submitted.'}
                  </Typography>
                  {writtenAnswerFeedback && (
                    <Box sx={{ mt: 1, p: 1, bgcolor: '#F5F3FF', borderLeft: '3px solid #7C3AED', borderRadius: 0.5 }}>
                      <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: '#5B21B6', mb: 0.25 }}>
                        How this explanation was marked
                      </Typography>
                      <Typography sx={{ fontSize: 11.5, color: '#334155', whiteSpace: 'pre-wrap' }}>
                        {writtenAnswerFeedback}
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Box>
            )}
          </Box>
        )}
        {activeTab === 1 && (
          <Box sx={{ p: 1 }}>
            <Alert severity="success" icon={<CheckCircle sx={{ fontSize: 15 }} />}
              sx={{ mb: 1, py: 0.5, '& .MuiAlert-message': { fontSize: 11 } }}>
              {hasAnyContent(model.tables)
                ? 'The correct, fully worked statement — compare it against the answer given.'
                : 'No correct answer was recorded for this question, so it could not be marked automatically.'}
            </Alert>
            <ReadOnlyWorkbook tables={model.tables} height={height} />
            {questionData?.requiresWrittenAnswer && (
              <Box sx={{ mt: 1.5, p: 1.5, border: '1px solid #A7F3D0', borderRadius: 1.5, bgcolor: '#ECFDF5' }}>
                <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: '#065F46', mb: 0.5 }}>✍️ Written Answer — Model / Grading Notes</Typography>
                {questionData?.writtenAnswerPrompt && (
                  <Typography sx={{ fontSize: 11.5, color: '#065F46', mb: 0.5, fontStyle: 'italic' }}>{questionData.writtenAnswerPrompt}</Typography>
                )}
                <Typography sx={{ fontSize: 12, whiteSpace: 'pre-wrap', color: '#065F46' }}>
                  {questionData?.writtenAnswerModelAnswer || 'No model answer provided.'}
                </Typography>
              </Box>
            )}
          </Box>
        )}
      </Box>
    );
  }

  // ── STUDENT ────────────────────────────────────────────────────────────────
  return (
    <Box sx={{ border: '1px solid #BFDBFE', borderRadius: 2, overflow: 'hidden' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 0.75, bgcolor: '#EFF6FF', borderBottom: '1px solid #BFDBFE' }}>
        <LockOpen sx={{ fontSize: 16, color: '#3B82F6' }} />
        <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#1E40AF', flexGrow: 1 }}>
          Financial Spreadsheet — works like Excel: columns A, B, C…, rows 1, 2, 3…, and formulas start with =
        </Typography>
        {!readOnly && (
          <Tooltip title="Reset to original template">
            <IconButton size="small" onClick={handleReset} sx={{ color: '#6B7280' }}>
              <RestartAlt sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {readOnly ? (
        <Box sx={{ p: 1 }}>
          <ReadOnlyWorkbook tables={answer.tables} height={height} />
        </Box>
      ) : (
        <Box sx={{ p: 1 }}>
          <SpreadsheetHelpBox />
          <ExcelWorkbook
            tables={answer.tables}
            variant="simple"
            height={height}
            onTableChange={answer.updateTable}
            onTitleChange={answer.updateTitle}
            onAddTable={answer.addTable}
            onRemoveTable={answer.removeTable}
          />
        </Box>
      )}

      {questionData?.requiresWrittenAnswer && (
        <Box sx={{ p: 1.5, borderTop: '1px solid #E2E8F0', bgcolor: '#F8FAFC' }}>
          <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: '#1E40AF', mb: 0.5 }}>
            ✍️ Written Answer Required
          </Typography>
          {questionData?.writtenAnswerPrompt && (
            <Typography sx={{ fontSize: 11.5, color: '#334155', mb: 1, fontStyle: 'italic' }}>
              {questionData.writtenAnswerPrompt}
            </Typography>
          )}
          <TextField
            fullWidth
            multiline
            minRows={3}
            placeholder="Type your written answer here…"
            value={writtenAnswer || ''}
            onChange={(e) => onWrittenAnswerChange?.(e.target.value)}
            disabled={readOnly}
            sx={{ bgcolor: 'white', '& .MuiOutlinedInput-root': { fontSize: 13 } }}
          />
        </Box>
      )}

      {!readOnly && (
        <Box sx={{ px: 2, py: 0.5, bgcolor: '#F8FAFC', borderTop: '1px solid #E2E8F0' }}>
          <Typography sx={{ fontSize: 10, color: '#9CA3AF' }}>
            💡 Click a cell and type, or press F2 to edit • Start with = for a formula, e.g. =SUM(B2:B10) • Select figures to see their Sum under the grid • Your answer saves automatically when you proceed
          </Typography>
        </Box>
      )}
    </Box>
  );
}

export { FinancialSpreadsheet };

export function FinancialSpreadsheetQuestion({
  question = {},
  mode = 'student',
  studentAnswer = null,
  onTemplateChange,
  onModelChange,
  onAnswerChange,
  onConfigChange,
  writtenAnswer = '',
  onWrittenAnswerChange,
  readOnly = false,
  height = 500,
}) {
  return (
    <FinancialSpreadsheet
      mode={mode}
      questionData={question}
      studentAnswerRaw={studentAnswer}
      onTemplateChange={onTemplateChange}
      onModelChange={onModelChange}
      onAnswerChange={onAnswerChange}
      onConfigChange={onConfigChange}
      writtenAnswer={writtenAnswer}
      onWrittenAnswerChange={onWrittenAnswerChange}
      readOnly={readOnly}
      height={height}
    />
  );
}
