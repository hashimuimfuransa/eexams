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
  IconButton, Tooltip, TextField, Stack, Divider, CircularProgress, Collapse
} from '@mui/material';
import {
  Lock, LockOpen, TableChart,
  RestartAlt, CheckCircle, Info,
  AddCircleOutline, RemoveCircleOutline,
  FormatBold, FormatItalic,
  FormatAlignLeft, FormatAlignCenter, FormatAlignRight,
  Undo, Redo, Functions, AutoAwesome, ExpandMore, ExpandLess
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
  }));
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

function serialise(tables) {
  return JSON.stringify({ tables: tables.map(({ _key, ...t }) => t) });
}

// Derives the blank grid students see from the teacher's model answer: same tables, titles and
// headers (so the grading position-by-position comparison in spreadsheetGrading.js still lines
// up), but every column after the first (the row-label column, e.g. "Account / Item") is cleared.
// This removes the need for teachers to hand-author a second, separately-maintained template —
// a source of drift where a template that didn't structurally match the model broke grading.
function blankTemplateFromModelJSON(modelJson) {
  try {
    const parsed = JSON.parse(modelJson);
    const tables = (parsed.tables || []).map(t => ({
      title: t.title || '',
      headers: [...(t.headers || [])],
      data: (t.data || []).map(row => row.map((cell, ci) => (ci === 0 ? cell : ''))),
    }));
    return JSON.stringify({ tables });
  } catch {
    return modelJson;
  }
}

// ── CSS injection for custom cell classes ─────────────────────────────────────
const CELL_STYLE_ID = 'fin-spreadsheet-styles';
if (typeof document !== 'undefined' && !document.getElementById(CELL_STYLE_ID)) {
  const style = document.createElement('style');
  style.id = CELL_STYLE_ID;
  style.textContent = `
    .fin-bold { font-weight: 700 !important; }
    .fin-italic { font-style: italic !important; }
    .fin-align-left { text-align: left !important; }
    .fin-align-center { text-align: center !important; }
    .fin-align-right { text-align: right !important; }
    .fin-header-row { background: #EFF6FF !important; font-weight: 700 !important; color: #1E40AF !important; }
    .fin-total-row { background: #F0FDF4 !important; font-weight: 700 !important; border-top: 2px solid #059669 !important; }
    .fin-subtotal { background: #FFFBEB !important; font-style: italic !important; }
    .htInvalid { background: #FEF2F2 !important; }
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

function applyNumericFormat(hot, format) {
  const sel = hot.getSelectedRange();
  if (!sel) return;
  sel.forEach(range => {
    const { from, to } = range;
    for (let r = from.row; r <= to.row; r++) {
      for (let c = from.col; c <= to.col; c++) {
        hot.setCellMeta(r, c, 'type', 'numeric');
        hot.setCellMeta(r, c, 'numericFormat', { pattern: format });
      }
    }
  });
  hot.render();
}

// ── EditableGrid ──────────────────────────────────────────────────────────────
function EditableGrid({ data, headers: initialHeaders, hotRef, height, accentColor = '#059669', onChange }) {
  const containerRef = useRef(null);
  const hotInstance  = useRef(null);
  const [headers, setHeaders] = useState(initialHeaders);
  const headersRef = useRef(initialHeaders);

  useEffect(() => { headersRef.current = headers; }, [headers]);

  // Mount HOT with HyperFormula + all finance features
  useEffect(() => {
    if (!containerRef.current) return;

    const hot = new Handsontable(containerRef.current, {
      data: data && data.length ? data : makeEmptyData(),
      colHeaders: headersRef.current,
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

      // ── Cell types: numeric, text, date, dropdown ───────────────────────
      columns: headersRef.current.map((_, i) => ({
        type: i === 0 ? 'text' : 'text', // overridden per-cell via meta
      })),

      // ── UX features ─────────────────────────────────────────────────────
      manualColumnResize: true,
      manualRowResize: true,
      manualColumnMove: true,
      manualRowMove: true,
      stretchH: 'all',
      wordWrap: true,
      autoWrapRow: false,
      autoWrapCol: false,
      columnSorting: true,
      multiColumnSorting: false,
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
      contextMenu: {
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

      // ── Callbacks ───────────────────────────────────────────────────────
      afterChange(changes, source) {
        if (!changes || source === 'loadData') return;
        onChange?.(this.getData(), headersRef.current);
      },
      afterCreateRow() { onChange?.(this.getData(), headersRef.current); },
      afterRemoveRow() { onChange?.(this.getData(), headersRef.current); },
      afterCreateCol() {
        const newH = [...headersRef.current, `Col ${headersRef.current.length + 1}`];
        headersRef.current = newH;
        setHeaders(newH);
        this.updateSettings({ colHeaders: newH });
        onChange?.(this.getData(), newH);
      },
      afterRemoveCol() {
        const newH = headersRef.current.slice(0, this.countCols());
        headersRef.current = newH;
        setHeaders(newH);
        this.updateSettings({ colHeaders: newH });
        onChange?.(this.getData(), newH);
      },
      afterMergeCells() { onChange?.(this.getData(), headersRef.current); },
      afterUnmergeCells() { onChange?.(this.getData(), headersRef.current); },
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

  const addRow    = () => { const h = hot(); if (h) h.alter('insert_row_below', h.countRows() - 1); };
  const removeRow = () => { const h = hot(); if (h && h.countRows() > 1) h.alter('remove_row', h.countRows() - 1); };
  const addCol    = () => { const h = hot(); if (h) h.alter('insert_col_end', h.countCols() - 1); };
  const removeCol = () => { const h = hot(); if (h && h.countCols() > 1) h.alter('remove_col', h.countCols() - 1); };
  const undo      = () => hot()?.undo();
  const redo      = () => hot()?.redo();

  const bold       = () => { const h = hot(); if (h) toggleClassOnSelection(h, 'fin-bold'); };
  const italic     = () => { const h = hot(); if (h) toggleClassOnSelection(h, 'fin-italic'); };
  const alignLeft  = () => { const h = hot(); if (h) applyClassToSelection(h, 'fin-align-left',   ['fin-align-center','fin-align-right']); };
  const alignCenter= () => { const h = hot(); if (h) applyClassToSelection(h, 'fin-align-center', ['fin-align-left','fin-align-right']); };
  const alignRight = () => { const h = hot(); if (h) applyClassToSelection(h, 'fin-align-right',  ['fin-align-left','fin-align-center']); };

  const markHeaderRow = () => { const h = hot(); if (h) applyClassToSelection(h, 'fin-header-row', ['fin-total-row','fin-subtotal']); };
  const markTotalRow  = () => { const h = hot(); if (h) applyClassToSelection(h, 'fin-total-row',  ['fin-header-row','fin-subtotal']); };
  const markSubtotal  = () => { const h = hot(); if (h) applyClassToSelection(h, 'fin-subtotal',   ['fin-header-row','fin-total-row']); };

  const insertSumFormula = () => {
    const h = hot();
    if (!h) return;
    const sel = h.getSelectedRange();
    if (!sel) return;
    const { from, to } = sel[0];
    // put SUM of the column above selected cell
    const topRow = from.row; const col = from.col;
    if (topRow < 1) return;
    const startCell = `${Handsontable.helper.spreadsheetColumnLabel(col + 1)}${topRow}`;
    const endCell   = `${Handsontable.helper.spreadsheetColumnLabel(col + 1)}${to.row}`;
    h.setDataAtCell(to.row + 1 >= h.countRows() ? to.row : to.row + 1, col, `=SUM(${startCell}:${endCell})`);
  };

  const renameHeader = (i, value) => {
    const newH = [...headers];
    newH[i] = value;
    headersRef.current = newH;
    setHeaders(newH);
    hot()?.updateSettings({ colHeaders: newH });
    onChange?.(hot()?.getData() ?? [], newH);
  };

  const btnSx = {
    textTransform: 'none', fontSize: 11, borderRadius: 1.5,
    py: 0.25, px: 0.75, minWidth: 0, borderColor: accentColor, color: accentColor,
  };
  const removeBtnSx = { ...btnSx, borderColor: '#EF4444', color: '#EF4444' };
  const iconBtnSx   = { width: 28, height: 28, borderRadius: 1, border: '1px solid #D1D5DB', color: '#374151' };

  return (
    <Box>
      {/* ── Row 1: Structure toolbar ── */}
      <Stack direction="row" flexWrap="wrap" gap={0.75} alignItems="center"
        sx={{ px: 1, py: 0.75, bgcolor: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>

        {/* Undo / Redo */}
        <Tooltip title="Undo (Ctrl+Z)"><span>
          <IconButton size="small" onClick={undo} sx={iconBtnSx}><Undo sx={{ fontSize: 15 }} /></IconButton>
        </span></Tooltip>
        <Tooltip title="Redo (Ctrl+Y)"><span>
          <IconButton size="small" onClick={redo} sx={iconBtnSx}><Redo sx={{ fontSize: 15 }} /></IconButton>
        </span></Tooltip>

        <Divider orientation="vertical" flexItem />

        {/* Bold / Italic */}
        <Tooltip title="Bold selected cells"><span>
          <IconButton size="small" onClick={bold}   sx={iconBtnSx}><FormatBold   sx={{ fontSize: 15 }} /></IconButton>
        </span></Tooltip>
        <Tooltip title="Italic selected cells"><span>
          <IconButton size="small" onClick={italic} sx={iconBtnSx}><FormatItalic sx={{ fontSize: 15 }} /></IconButton>
        </span></Tooltip>

        <Divider orientation="vertical" flexItem />

        {/* Alignment */}
        <Tooltip title="Align left"><span>
          <IconButton size="small" onClick={alignLeft}   sx={iconBtnSx}><FormatAlignLeft   sx={{ fontSize: 15 }} /></IconButton>
        </span></Tooltip>
        <Tooltip title="Align center"><span>
          <IconButton size="small" onClick={alignCenter} sx={iconBtnSx}><FormatAlignCenter sx={{ fontSize: 15 }} /></IconButton>
        </span></Tooltip>
        <Tooltip title="Align right"><span>
          <IconButton size="small" onClick={alignRight}  sx={iconBtnSx}><FormatAlignRight  sx={{ fontSize: 15 }} /></IconButton>
        </span></Tooltip>

        <Divider orientation="vertical" flexItem />

        {/* Number formats */}
        <Tooltip title="Format as Currency (1,234.00)"><span>
          <Button size="small" variant="outlined" onClick={() => applyNumericFormat(hot(), '0,0.00')} sx={btnSx}>$ Currency</Button>
        </span></Tooltip>
        <Tooltip title="Format as Percentage (12.50%)"><span>
          <Button size="small" variant="outlined" onClick={() => applyNumericFormat(hot(), '0.00%')} sx={btnSx}>% Percent</Button>
        </span></Tooltip>
        <Tooltip title="Format as Integer (1,234)"><span>
          <Button size="small" variant="outlined" onClick={() => applyNumericFormat(hot(), '0,0')} sx={btnSx}># Integer</Button>
        </span></Tooltip>
        <Tooltip title="Format as Decimal (1,234.56)"><span>
          <Button size="small" variant="outlined" onClick={() => applyNumericFormat(hot(), '0,0.00')} sx={btnSx}>.0 Decimal</Button>
        </span></Tooltip>

        <Divider orientation="vertical" flexItem />

        {/* Row styles */}
        <Tooltip title="Mark selection as header row (blue)"><span>
          <Button size="small" variant="outlined" onClick={markHeaderRow} sx={{ ...btnSx, borderColor: '#3B82F6', color: '#3B82F6' }}>Header Row</Button>
        </span></Tooltip>
        <Tooltip title="Mark selection as total row (green)"><span>
          <Button size="small" variant="outlined" onClick={markTotalRow} sx={{ ...btnSx, borderColor: '#059669', color: '#059669' }}>Total Row</Button>
        </span></Tooltip>
        <Tooltip title="Mark selection as subtotal (yellow)"><span>
          <Button size="small" variant="outlined" onClick={markSubtotal} sx={{ ...btnSx, borderColor: '#D97706', color: '#D97706' }}>Subtotal</Button>
        </span></Tooltip>

        <Divider orientation="vertical" flexItem />

        {/* SUM shortcut */}
        <Tooltip title="Insert =SUM() below selection"><span>
          <Button size="small" variant="outlined" startIcon={<Functions sx={{ fontSize: 13 }} />} onClick={insertSumFormula} sx={btnSx}>AutoSum</Button>
        </span></Tooltip>

        <Box sx={{ flexGrow: 1 }} />
        <Typography sx={{ fontSize: 10, color: '#9CA3AF' }}>Right-click for more options</Typography>
      </Stack>

      {/* ── Row 2: Structure (rows / cols) ── */}
      <Stack direction="row" flexWrap="wrap" gap={0.75} alignItems="center"
        sx={{ px: 1, py: 0.5, bgcolor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
        <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Rows:</Typography>
        <Tooltip title="Add row at bottom"><span>
          <Button size="small" variant="outlined" startIcon={<AddCircleOutline sx={{ fontSize: 12 }} />} onClick={addRow} sx={btnSx}>Add Row</Button>
        </span></Tooltip>
        <Tooltip title="Remove last row"><span>
          <Button size="small" variant="outlined" startIcon={<RemoveCircleOutline sx={{ fontSize: 12 }} />} onClick={removeRow} sx={removeBtnSx}>Remove Row</Button>
        </span></Tooltip>
        <Divider orientation="vertical" flexItem />
        <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Columns:</Typography>
        <Tooltip title="Add column at right"><span>
          <Button size="small" variant="outlined" startIcon={<AddCircleOutline sx={{ fontSize: 12 }} />} onClick={addCol} sx={btnSx}>Add Column</Button>
        </span></Tooltip>
        <Tooltip title="Remove last column"><span>
          <Button size="small" variant="outlined" startIcon={<RemoveCircleOutline sx={{ fontSize: 12 }} />} onClick={removeCol} sx={removeBtnSx}>Remove Column</Button>
        </span></Tooltip>
        <Box sx={{ flexGrow: 1 }} />
        <Typography sx={{ fontSize: 10, color: '#9CA3AF', fontStyle: 'italic' }}>
          Formulas: =SUM(B2:B10) · =IF(A1&gt;0,"profit","loss") · =NPV(rate,B2:B10) · =PMT(rate,nper,pv)
        </Typography>
      </Stack>

      {/* ── Row 3: Column header rename strip ── */}
      <Stack direction="row" alignItems="center"
        sx={{ px: 1, py: 0.5, bgcolor: '#EFF6FF', borderBottom: '1px solid #BFDBFE', overflowX: 'auto', gap: 0.5 }}>
        <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#3B82F6', whiteSpace: 'nowrap', mr: 0.5 }}>
          Column names:
        </Typography>
        {headers.map((h, i) => (
          <TextField key={i} size="small" value={h} onChange={(e) => renameHeader(i, e.target.value)}
            sx={{
              minWidth: 80, maxWidth: 140,
              '& .MuiInputBase-input': { fontSize: 11, py: 0.35, px: 0.75, fontWeight: 600, color: '#1E40AF' },
              '& .MuiOutlinedInput-root': { borderRadius: 1 },
            }}
          />
        ))}
      </Stack>

      {/* ── Grid ── */}
      <Box sx={{ overflowX: 'auto', colorScheme: 'light' }}>
        <div ref={containerRef} />
      </Box>
    </Box>
  );
}

// ── ReadOnlyGrid ──────────────────────────────────────────────────────────────
function ReadOnlyGrid({ data, headers, height }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const hot = new Handsontable(containerRef.current, {
      data: data && data.length ? data : makeEmptyData(),
      colHeaders: headers && headers.length ? headers : [...DEFAULT_HEADERS],
      rowHeaders: true,
      height,
      width: '100%',
      licenseKey: 'non-commercial-and-evaluation',
      className: 'ht-theme-main',
      readOnly: true,
      stretchH: 'all',
      wordWrap: true,
      manualColumnResize: true,
      contextMenu: false,
      formulas: {
        engine: HyperFormula.buildEmpty({ licenseKey: 'gpl-v3' }),
        sheetName: 'Sheet1',
      },
    });
    return () => hot.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Box sx={{ overflowX: 'auto', colorScheme: 'light' }}>
      <div ref={containerRef} />
    </Box>
  );
}

// ── StatementTableEditor: title field + remove button + one EditableGrid ──────
function StatementTableEditor({ table, index, count, onTableChange, onTitleChange, onRemove, canRemove, height, accentColor }) {
  const hotRef = useRef(null);
  const tableHeight = count > 1 ? Math.min(height, 320) : height;

  return (
    <Box sx={{ mb: count > 1 ? 2 : 0, border: count > 1 ? '1px solid #E5E7EB' : 'none', borderRadius: 1.5, overflow: 'hidden' }}>
      {count > 1 && (
        <Stack direction="row" alignItems="center" spacing={1}
          sx={{ px: 1, py: 0.5, bgcolor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
          <TableChart sx={{ fontSize: 15, color: accentColor }} />
          <TextField
            size="small"
            placeholder={`Statement ${index + 1} title (e.g. Income Statement)`}
            value={table.title}
            onChange={(e) => onTitleChange(index, e.target.value)}
            sx={{
              flexGrow: 1,
              '& .MuiInputBase-input': { fontSize: 12, fontWeight: 700, py: 0.5, color: '#1F2937' },
            }}
          />
          {canRemove && (
            <Tooltip title="Remove this table">
              <IconButton size="small" onClick={() => onRemove(index)} sx={{ color: '#EF4444' }}>
                <RemoveCircleOutline sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      )}
      <EditableGrid
        data={table.data}
        headers={table.headers}
        hotRef={hotRef}
        height={tableHeight}
        accentColor={accentColor}
        onChange={(data, headers) => onTableChange(index, data, headers)}
      />
    </Box>
  );
}

// ── StatementTableReadOnly ─────────────────────────────────────────────────────
function StatementTableReadOnly({ table, index, count, height }) {
  const tableHeight = count > 1 ? Math.min(height, 320) : height;
  return (
    <Box sx={{ mb: count > 1 ? 2 : 0, border: count > 1 ? '1px solid #E5E7EB' : 'none', borderRadius: 1.5, overflow: 'hidden' }}>
      {count > 1 && (
        <Box sx={{ px: 1, py: 0.5, bgcolor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>
            {table.title || `Table ${index + 1}`}
          </Typography>
        </Box>
      )}
      <ReadOnlyGrid data={table.data} headers={table.headers} height={tableHeight} />
    </Box>
  );
}

// ── useTableSet: manages an array of tables + add/remove/update handlers ──────
function useTableSet(initialTables, onChangeCb) {
  const [tables, setTables] = useState(initialTables);

  const updateTable = useCallback((idx, data, headers) => {
    setTables(prev => {
      const next = prev.map((t, i) => (i === idx ? { ...t, data, headers } : t));
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

  return { tables, setTables, updateTable, updateTitle, addTable, removeTable, replaceAll };
}

// ── AI paste-and-fill box (teacher-setup only) ─────────────────────────────────
// Lets a teacher paste a table copied from Excel/Word (e.g. a trial balance) and have AI turn
// it into the spreadsheet grid, instead of re-typing every row/value by hand. Only touches the
// model-answer table set via onFill — the student-facing template is re-derived automatically
// by the caller's onModelChange handler, same as any other manual edit to the grid.
function AiFillSpreadsheetBox({ questionText, passage, modelTables, onFill }) {
  const [open, setOpen] = useState(true);
  const [pasted, setPasted] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [applied, setApplied] = useState(false);

  const filled = hasAnyContent(modelTables || []);

  const handleFill = async () => {
    if (!pasted.trim() || loading) return;
    setLoading(true);
    setError('');
    setApplied(false);
    try {
      const { data } = await api.post('/exam/ai-fill-spreadsheet', {
        questionText: questionText || '',
        passage: passage || '',
        pastedTable: pasted,
        currentSpreadsheet: filled ? serialise(modelTables) : '',
      });
      const tables = coerceToTables(JSON.parse(data.spreadsheetModelAnswer));
      if (!tables || !tables.length) {
        setError('AI could not read a table from that data. Try pasting it again.');
        return;
      }
      onFill(cloneTables(tables));
      setPasted('');
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
          {filled ? 'AI Assist — request a change to this spreadsheet' : 'AI Fill from a pasted table'}
        </Typography>
        {open ? <ExpandLess sx={{ fontSize: 16, color: '#059669' }} /> : <ExpandMore sx={{ fontSize: 16, color: '#059669' }} />}
      </Box>
      <Collapse in={open}>
        <Box sx={{ px: 1.5, pb: 1.5 }}>
          <Typography sx={{ fontSize: 11, color: '#047857', mb: 1 }}>
            {filled
              ? 'Already have a grid? Ask AI to change it — e.g. "change salary expense to 500,000", "add a row for depreciation", or paste corrected/extra data — and it will update the existing table(s) instead of starting over.'
              : 'Paste a table from Excel or Word (trial balance, adjustments, or a full statement) and AI will build the grid and compute the values for you.'}
          </Typography>
          <TextField
            fullWidth
            multiline
            minRows={filled ? 2 : 4}
            maxRows={10}
            placeholder={filled ? 'Describe a change, or paste new/corrected data…' : 'Paste your table here…'}
            value={pasted}
            onChange={(e) => { setPasted(e.target.value); setApplied(false); }}
            disabled={loading}
            sx={{ bgcolor: 'white', mb: 1, '& .MuiOutlinedInput-root': { fontSize: 12 } }}
          />
          {error && <Alert severity="error" sx={{ mb: 1, py: 0, fontSize: 11 }}>{error}</Alert>}
          {applied && !error && (
            <Alert severity="success" sx={{ mb: 1, py: 0, fontSize: 11 }}>
              Applied — review the grid below. You can ask for another change any time.
            </Alert>
          )}
          <Button
            size="small"
            variant="contained"
            disabled={!pasted.trim() || loading}
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

        <Alert severity="info" icon={<Info sx={{ fontSize: 15 }} />}
          sx={{ mx: 1, mt: 1, py: 0.5, fontSize: 11, '& .MuiAlert-message': { fontSize: 11 } }}>
          Fill in the complete, correct financial statement(s) below — row labels and final values.
          Students will see a blank version of this grid (row labels visible, values cleared) and must
          work out the figures themselves from the transaction image(s) attached to this question.
          If the question covers more than one statement (e.g. Income Statement + Balance Sheet),
          use "Add another table" for each one.
        </Alert>

        <Box sx={{ p: 1 }}>
          {model.tables.map((t, i) => (
            <StatementTableEditor
              key={t._key}
              table={t}
              index={i}
              count={model.tables.length}
              onTableChange={model.updateTable}
              onTitleChange={model.updateTitle}
              onRemove={model.removeTable}
              canRemove={model.tables.length > 1}
              height={height}
              accentColor="#059669"
            />
          ))}
          <Button size="small" variant="outlined" startIcon={<AddCircleOutline sx={{ fontSize: 14 }} />}
            onClick={model.addTable}
            sx={{ textTransform: 'none', fontSize: 11, borderRadius: 1.5, borderColor: '#059669', color: '#059669' }}>
            Add another statement table
          </Button>
        </Box>
      </Box>
    );
  }

  // ── GRADING ────────────────────────────────────────────────────────────────
  if (isGrading) {
    return (
      <Box sx={{ border: '1px solid #FDE68A', borderRadius: 2, overflow: 'hidden' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1, bgcolor: '#FFFBEB', borderBottom: '1px solid #FDE68A' }}>
          <TableChart sx={{ fontSize: 18, color: '#D97706' }} />
          <Typography sx={{ fontWeight: 700, fontSize: 13, color: '#92400E', flexGrow: 1 }}>
            Financial Spreadsheet — Grading View
          </Typography>
        </Box>
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}
          sx={{ bgcolor: '#FAFAFA', borderBottom: '1px solid #E2E8F0', minHeight: 36,
            '& .MuiTab-root': { minHeight: 36, fontSize: 12, fontWeight: 600, textTransform: 'none' } }}>
          <Tab label="📝 Student's Answer" />
          <Tab label="✅ Model Answer" />
        </Tabs>
        {activeTab === 0 && (
          <Box sx={{ p: 1 }}>
            {answer.tables.map((t, i) => (
              <StatementTableReadOnly key={t._key} table={t} index={i} count={answer.tables.length} height={height} />
            ))}
          </Box>
        )}
        {activeTab === 1 && (
          <Box sx={{ p: 1 }}>
            <Alert severity="success" icon={<CheckCircle sx={{ fontSize: 15 }} />}
              sx={{ mb: 1, py: 0.5, '& .MuiAlert-message': { fontSize: 11 } }}>
              Model answer for reference. Use Manual Regrade to assign a score.
            </Alert>
            {model.tables.map((t, i) => (
              <StatementTableReadOnly key={t._key} table={t} index={i} count={model.tables.length} height={height} />
            ))}
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
          Financial Spreadsheet — Enter your answers directly in the cells below
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
          {answer.tables.map((t, i) => (
            <StatementTableReadOnly key={t._key} table={t} index={i} count={answer.tables.length} height={height} />
          ))}
        </Box>
      ) : (
        <Box sx={{ p: 1 }}>
          {answer.tables.map((t, i) => (
            <StatementTableEditor
              key={t._key}
              table={t}
              index={i}
              count={answer.tables.length}
              onTableChange={answer.updateTable}
              onTitleChange={answer.updateTitle}
              onRemove={answer.removeTable}
              canRemove={answer.tables.length > 1}
              height={height}
              accentColor="#3B82F6"
            />
          ))}
          <Button size="small" variant="outlined" startIcon={<AddCircleOutline sx={{ fontSize: 14 }} />}
            onClick={answer.addTable}
            sx={{ textTransform: 'none', fontSize: 11, borderRadius: 1.5, borderColor: '#3B82F6', color: '#3B82F6' }}>
            Add another statement table
          </Button>
        </Box>
      )}

      {!readOnly && (
        <Box sx={{ px: 2, py: 0.5, bgcolor: '#F8FAFC', borderTop: '1px solid #E2E8F0' }}>
          <Typography sx={{ fontSize: 10, color: '#9CA3AF' }}>
            💡 Click any cell to edit • Right-click for insert/remove options • Add a table if the question asks for another statement • Your answer saves automatically when you proceed
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
      readOnly={readOnly}
      height={height}
    />
  );
}
