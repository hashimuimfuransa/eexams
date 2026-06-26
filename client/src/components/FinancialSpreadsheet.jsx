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
 *
 * Modes:
 *  teacher-setup  – editable: Student Template tab + Model Answer tab
 *  student        – editable: single grid pre-filled from template
 *  grading        – read-only: Student Answer + Model Answer tabs
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Box, Tabs, Tab, Chip, Typography, Alert, Button,
  IconButton, Tooltip, TextField, Stack, Divider
} from '@mui/material';
import {
  Lock, LockOpen, TableChart,
  ContentCopy, RestartAlt, CheckCircle, Info,
  AddCircleOutline, RemoveCircleOutline,
  FormatBold, FormatItalic,
  FormatAlignLeft, FormatAlignCenter, FormatAlignRight,
  Undo, Redo, Functions
} from '@mui/icons-material';

import Handsontable from 'handsontable';
import { HyperFormula } from 'hyperformula';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/styles/handsontable.min.css';

registerAllModules();

// ── Defaults ──────────────────────────────────────────────────────────────────
const DEFAULT_ROWS = 20;
const DEFAULT_COLS = 8;
const DEFAULT_HEADERS = ['Account / Item', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Total'];

function makeEmptyData(rows = DEFAULT_ROWS, cols = DEFAULT_COLS) {
  return Array.from({ length: rows }, () => Array(cols).fill(''));
}

function parseSheet(raw) {
  if (!raw) return { data: makeEmptyData(), headers: [...DEFAULT_HEADERS] };
  try {
    const p = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return {
      data:    p.data    && p.data.length    ? p.data    : makeEmptyData(),
      headers: p.headers && p.headers.length ? p.headers : [...DEFAULT_HEADERS],
    };
  } catch {
    return { data: makeEmptyData(), headers: [...DEFAULT_HEADERS] };
  }
}

function serialise(data, headers) {
  return JSON.stringify({ data, headers });
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
      <Box sx={{ overflowX: 'auto' }}>
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
    <Box sx={{ overflowX: 'auto' }}>
      <div ref={containerRef} />
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
  const isStudent      = mode === 'student';

  const [activeTab, setActiveTab] = useState(0);

  // Parse stored sheets
  const templateSheet = parseSheet(questionData?.spreadsheetTemplate);
  const modelSheet    = parseSheet(questionData?.spreadsheetModelAnswer);
  const studentSheet  = parseSheet(studentAnswerRaw);

  // Editable state for teacher-setup
  const [templateData,    setTemplateData]    = useState(templateSheet.data);
  const [templateHeaders, setTemplateHeaders] = useState(templateSheet.headers);
  const [modelData,       setModelData]       = useState(modelSheet.data);
  const [modelHeaders,    setModelHeaders]    = useState(modelSheet.headers);

  // Editable state for student
  const [answerData,    setAnswerData]    = useState(() => {
    if (isStudent && templateSheet.data?.length) return templateSheet.data.map(r => [...r]);
    if (isStudent && studentSheet.data?.length)  return studentSheet.data;
    return makeEmptyData();
  });
  const [answerHeaders, setAnswerHeaders] = useState(templateSheet.headers);

  const templateRef = useRef(null);
  const modelRef    = useRef(null);
  const answerRef   = useRef(null);

  const handleTemplateChange = useCallback((data, headers) => {
    setTemplateData(data);
    setTemplateHeaders(headers);
    onTemplateChange?.(serialise(data, headers));
  }, [onTemplateChange]);

  const handleModelChange = useCallback((data, headers) => {
    setModelData(data);
    setModelHeaders(headers);
    onModelChange?.(serialise(data, headers));
  }, [onModelChange]);

  const handleAnswerChange = useCallback((data, headers) => {
    setAnswerData(data);
    setAnswerHeaders(headers);
    onAnswerChange?.(serialise(data, headers));
  }, [onAnswerChange]);

  const handleCopyToModel = () => {
    const dataCopy    = templateData.map(r => [...r]);
    const headersCopy = [...templateHeaders];
    setModelData(dataCopy);
    setModelHeaders(headersCopy);
    onModelChange?.(serialise(dataCopy, headersCopy));
  };

  const handleReset = () => {
    const fresh = templateSheet.data.map(r => [...r]);
    setAnswerData(fresh);
    onAnswerChange?.(serialise(fresh, answerHeaders));
  };

  // ── TEACHER SETUP ──────────────────────────────────────────────────────────
  if (isTeacherSetup) {
    return (
      <Box sx={{ border: '1px solid #D1FAE5', borderRadius: 2, overflow: 'hidden' }}>
        {/* Banner */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1, bgcolor: '#ECFDF5', borderBottom: '1px solid #A7F3D0' }}>
          <TableChart sx={{ fontSize: 18, color: '#059669' }} />
          <Typography sx={{ fontWeight: 700, fontSize: 13, color: '#065F46', flexGrow: 1 }}>
            Financial Spreadsheet Editor
          </Typography>
          <Chip icon={<Lock sx={{ fontSize: 12 }} />} label="Model Answer hidden from students"
            size="small" sx={{ bgcolor: '#D1FAE5', color: '#065F46', fontSize: 10, fontWeight: 600 }} />
        </Box>

        {/* Tabs */}
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}
          sx={{ bgcolor: '#F9FAFB', borderBottom: '1px solid #E5E7EB', minHeight: 36,
            '& .MuiTab-root': { minHeight: 36, fontSize: 12, fontWeight: 600, textTransform: 'none', py: 0 } }}>
          <Tab label="📋 Student Template" />
          <Tab label="🔒 Model Answer (hidden from students)" />
        </Tabs>

        {activeTab === 0 && (
          <Box>
            <Alert severity="info" icon={<Info sx={{ fontSize: 15 }} />}
              sx={{ mx: 1, mt: 1, py: 0.5, fontSize: 11, '& .MuiAlert-message': { fontSize: 11 } }}>
              Design what the student will see and fill in. Use the toolbar to add/remove rows and columns.
              Rename columns by editing the blue fields above the grid. Leave answer cells blank.
            </Alert>
            <EditableGrid
              data={templateData}
              headers={templateHeaders}
              hotRef={templateRef}
              height={height}
              accentColor="#059669"
              onChange={handleTemplateChange}
            />
          </Box>
        )}

        {activeTab === 1 && (
          <Box>
            <Alert severity="success" icon={<Lock sx={{ fontSize: 15 }} />}
              sx={{ mx: 1, mt: 1, py: 0.5, fontSize: 11, '& .MuiAlert-message': { fontSize: 11 } }}>
              Fill in the correct answers. This is used for grading only — students never see this.
            </Alert>
            <Box sx={{ px: 1, pt: 0.5 }}>
              <Button size="small" variant="outlined" startIcon={<ContentCopy sx={{ fontSize: 13 }} />}
                onClick={handleCopyToModel}
                sx={{ textTransform: 'none', fontSize: 11, borderRadius: 1.5, borderColor: '#059669', color: '#059669' }}>
                Copy layout from Student Template
              </Button>
            </Box>
            <EditableGrid
              data={modelData}
              headers={modelHeaders}
              hotRef={modelRef}
              height={height}
              accentColor="#059669"
              onChange={handleModelChange}
            />
          </Box>
        )}
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
            <ReadOnlyGrid data={studentSheet.data} headers={studentSheet.headers} height={height} />
          </Box>
        )}
        {activeTab === 1 && (
          <Box sx={{ p: 1 }}>
            <Alert severity="success" icon={<CheckCircle sx={{ fontSize: 15 }} />}
              sx={{ mb: 1, py: 0.5, '& .MuiAlert-message': { fontSize: 11 } }}>
              Model answer for reference. Use Manual Regrade to assign a score.
            </Alert>
            <ReadOnlyGrid data={modelSheet.data} headers={modelSheet.headers} height={height} />
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
          <ReadOnlyGrid data={answerData} headers={answerHeaders} height={height} />
        </Box>
      ) : (
        <EditableGrid
          data={answerData}
          headers={answerHeaders}
          hotRef={answerRef}
          height={height}
          accentColor="#3B82F6"
          onChange={handleAnswerChange}
        />
      )}

      {!readOnly && (
        <Box sx={{ px: 2, py: 0.5, bgcolor: '#F8FAFC', borderTop: '1px solid #E2E8F0' }}>
          <Typography sx={{ fontSize: 10, color: '#9CA3AF' }}>
            💡 Click any cell to edit • Right-click for insert/remove options • Your answer saves automatically when you proceed
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
