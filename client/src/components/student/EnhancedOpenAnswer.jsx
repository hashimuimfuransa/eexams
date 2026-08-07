import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  TextField,
  Tabs,
  Tab,
  Typography,
  Paper,
  Chip,
  Tooltip,
  IconButton,
  Collapse,
  Alert,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import {
  Functions,
  Edit,
  InfoOutlined,
  CheckCircleOutline,
  Code,
  KeyboardReturn,
  Keyboard,
  Backspace,
  Undo,
  Redo,
  DeleteOutline,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import 'mathlive';
import { EditorView, basicSetup } from 'codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { java } from '@codemirror/lang-java';
import { cpp } from '@codemirror/lang-cpp';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';
import { sql } from '@codemirror/lang-sql';
import { xml } from '@codemirror/lang-xml';
import { oneDark } from '@codemirror/theme-one-dark';

/* ─── Tokens ─────────────────────────────────────────────── */
const TOKEN = {
  radius: '6px',
  transition: 'all 0.18s ease',
  fontMono: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
  fontSans: "'IBM Plex Sans', 'Segoe UI', sans-serif",
};

/* ─── Quick-insert symbol groups ─────────────────────────────
   `#?` becomes an empty box the cursor jumps into, so whatever the
   student types next lands *inside* the fraction / root / power.
   `#0` wraps whatever is currently selected.                        */
const SYMBOL_GROUPS = [
  {
    label: 'Everyday',
    symbols: [
      { label: 'a/b', latex: '\\frac{#?}{#?}', name: 'Fraction (one number over another)' },
      { label: '√', latex: '\\sqrt{#0}', name: 'Square root' },
      { label: 'x²', latex: '^{2}', name: 'Squared' },
      { label: 'xⁿ', latex: '^{#?}', name: 'To the power of' },
      { label: 'xₙ', latex: '_{#?}', name: 'Small number below (subscript)' },
      { label: '×', latex: '\\times', name: 'Multiply' },
      { label: '÷', latex: '\\div', name: 'Divide' },
      { label: '±', latex: '\\pm', name: 'Plus or minus' },
      { label: '( )', latex: '\\left(#0\\right)', name: 'Brackets' },
      { label: 'π', latex: '\\pi', name: 'Pi' },
      { label: '°', latex: '^{\\circ}', name: 'Degrees' },
      { label: '%', latex: '\\%', name: 'Percent' },
    ],
  },
  {
    label: 'Compare',
    symbols: [
      { label: '=', latex: '=', name: 'Equals' },
      { label: '≠', latex: '\\neq', name: 'Not equal to' },
      { label: '<', latex: '<', name: 'Less than' },
      { label: '>', latex: '>', name: 'Greater than' },
      { label: '≤', latex: '\\leq', name: 'Less than or equal to' },
      { label: '≥', latex: '\\geq', name: 'Greater than or equal to' },
      { label: '≈', latex: '\\approx', name: 'Roughly equal to' },
      { label: '≡', latex: '\\equiv', name: 'Identical to' },
      { label: '∝', latex: '\\propto', name: 'Proportional to' },
      { label: '∞', latex: '\\infty', name: 'Infinity' },
      { label: '→', latex: '\\rightarrow', name: 'Gives / leads to' },
      { label: '∴', latex: '\\therefore', name: 'Therefore' },
    ],
  },
  {
    label: 'Powers & roots',
    symbols: [
      { label: 'x²', latex: '^{2}', name: 'Squared' },
      { label: 'x³', latex: '^{3}', name: 'Cubed' },
      { label: 'xⁿ', latex: '^{#?}', name: 'To the power of' },
      { label: '√', latex: '\\sqrt{#0}', name: 'Square root' },
      { label: '∛', latex: '\\sqrt[3]{#0}', name: 'Cube root' },
      { label: 'ⁿ√', latex: '\\sqrt[#?]{#0}', name: 'Any root' },
      { label: '|x|', latex: '\\left|#0\\right|', name: 'Absolute value' },
      { label: 'eˣ', latex: 'e^{#?}', name: 'e to the power of' },
      { label: 'log', latex: '\\log', name: 'Logarithm (base 10)' },
      { label: 'log₂', latex: '\\log_{#?}', name: 'Logarithm with a base' },
      { label: 'ln', latex: '\\ln', name: 'Natural logarithm' },
      { label: '10ⁿ', latex: '\\times10^{#?}', name: 'Times ten to the power of' },
    ],
  },
  {
    label: 'Greek letters',
    symbols: [
      { label: 'α', latex: '\\alpha', name: 'alpha' },
      { label: 'β', latex: '\\beta', name: 'beta' },
      { label: 'γ', latex: '\\gamma', name: 'gamma' },
      { label: 'δ', latex: '\\delta', name: 'delta' },
      { label: 'θ', latex: '\\theta', name: 'theta' },
      { label: 'λ', latex: '\\lambda', name: 'lambda' },
      { label: 'μ', latex: '\\mu', name: 'mu' },
      { label: 'π', latex: '\\pi', name: 'pi' },
      { label: 'σ', latex: '\\sigma', name: 'sigma' },
      { label: 'φ', latex: '\\phi', name: 'phi' },
      { label: 'ω', latex: '\\omega', name: 'omega' },
      { label: 'Σ', latex: '\\Sigma', name: 'capital sigma' },
      { label: 'Δ', latex: '\\Delta', name: 'capital delta (change in)' },
      { label: 'Ω', latex: '\\Omega', name: 'capital omega (ohms)' },
    ],
  },
  {
    label: 'Trigonometry',
    symbols: [
      { label: 'sin', latex: '\\sin', name: 'sine' },
      { label: 'cos', latex: '\\cos', name: 'cosine' },
      { label: 'tan', latex: '\\tan', name: 'tangent' },
      { label: 'sin⁻¹', latex: '\\sin^{-1}', name: 'inverse sine' },
      { label: 'cos⁻¹', latex: '\\cos^{-1}', name: 'inverse cosine' },
      { label: 'tan⁻¹', latex: '\\tan^{-1}', name: 'inverse tangent' },
      { label: 'θ', latex: '\\theta', name: 'theta (angle)' },
      { label: '°', latex: '^{\\circ}', name: 'Degrees' },
      { label: '∠', latex: '\\angle', name: 'Angle' },
      { label: '⊥', latex: '\\perp', name: 'Perpendicular to' },
      { label: '∥', latex: '\\parallel', name: 'Parallel to' },
      { label: '△', latex: '\\triangle', name: 'Triangle' },
    ],
  },
  {
    label: 'Calculus',
    symbols: [
      { label: '∫', latex: '\\int#0', name: 'Integral' },
      { label: '∫ᵇₐ', latex: '\\int_{#?}^{#?}', name: 'Integral between two limits' },
      { label: '∑', latex: '\\sum_{#?}^{#?}', name: 'Sum of' },
      { label: '∏', latex: '\\prod_{#?}^{#?}', name: 'Product of' },
      { label: 'lim', latex: '\\lim_{#?}', name: 'Limit' },
      { label: 'd/dx', latex: '\\frac{d}{dx}', name: 'Derivative with respect to x' },
      { label: 'dy/dx', latex: '\\frac{dy}{dx}', name: 'Derivative of y' },
      { label: '∂', latex: '\\partial', name: 'Partial derivative' },
      { label: '∮', latex: '\\oint', name: 'Closed integral' },
      { label: 'Δ', latex: '\\Delta', name: 'Change in' },
    ],
  },
  {
    label: 'Sets & vectors',
    symbols: [
      { label: '∈', latex: '\\in', name: 'Is a member of' },
      { label: '∉', latex: '\\notin', name: 'Is not a member of' },
      { label: '⊂', latex: '\\subset', name: 'Is a subset of' },
      { label: '∪', latex: '\\cup', name: 'Union' },
      { label: '∩', latex: '\\cap', name: 'Intersection' },
      { label: '∅', latex: '\\emptyset', name: 'Empty set' },
      { label: 'a⃗', latex: '\\vec{#0}', name: 'Vector' },
      { label: 'â', latex: '\\hat{#0}', name: 'Unit vector' },
      { label: '·', latex: '\\cdot', name: 'Dot product' },
      { label: '×', latex: '\\times', name: 'Cross product' },
      { label: 'matrix', latex: '\\begin{pmatrix}#? & #? \\\\ #? & #?\\end{pmatrix}', name: '2 by 2 matrix' },
      { label: 'det', latex: '\\det', name: 'Determinant' },
    ],
  },
];

/* ─── Styled components ──────────────────────────────────── */
const Shell = styled(Paper)(({ theme }) => ({
  border: `1.5px solid ${theme.palette.divider}`,
  borderRadius: '10px',
  overflow: 'hidden',
  boxShadow: theme.shadows[1],
  fontFamily: TOKEN.fontSans,
}));

const TabBar = styled(Tabs)(({ theme }) => ({
  background: theme.palette.mode === 'dark'
    ? 'rgba(255,255,255,0.04)'
    : 'rgba(0,0,0,0.03)',
  borderBottom: `1.5px solid ${theme.palette.divider}`,
  minHeight: 44,
  '& .MuiTab-root': {
    minHeight: 44,
    fontSize: '0.8125rem',
    fontWeight: 600,
    letterSpacing: '0.02em',
    textTransform: 'none',
    fontFamily: TOKEN.fontSans,
    gap: 6,
  },
}));

const SymbolBar = styled(Box)(({ theme }) => ({
  background: theme.palette.mode === 'dark'
    ? 'rgba(255,255,255,0.03)'
    : 'rgba(0,0,0,0.02)',
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: TOKEN.radius,
  marginTop: 12,
  padding: '10px 12px',
  display: 'flex',
  alignItems: 'flex-start',
  gap: 8,
  flexWrap: 'wrap',
  overflowX: 'auto',
}));

const GroupLabel = styled(Typography)(({ theme }) => ({
  fontSize: '0.65rem',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: theme.palette.text.disabled,
  marginTop: 6,
  marginBottom: 2,
  fontFamily: TOKEN.fontSans,
  whiteSpace: 'nowrap',
}));

const SymBtn = styled('button')(({ theme }) => ({
  // A sans stack renders π, √ and the superscripts far better than the mono one
  fontFamily: "'Segoe UI Symbol', 'IBM Plex Sans', 'Segoe UI', sans-serif",
  fontSize: '1rem',
  minWidth: 44,
  minHeight: 40,
  padding: '4px 10px',
  borderRadius: 6,
  border: `1px solid ${theme.palette.divider}`,
  background: theme.palette.background.paper,
  color: theme.palette.text.primary,
  cursor: 'pointer',
  transition: TOKEN.transition,
  lineHeight: 1.4,
  '&:hover': {
    background: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    borderColor: theme.palette.primary.main,
    transform: 'translateY(-1px)',
    boxShadow: `0 2px 8px ${theme.palette.primary.main}44`,
  },
  '&:active': { transform: 'none' },
  '&:disabled': { opacity: 0.45, cursor: 'not-allowed' },
}));

/* Big, clearly-labelled editing actions above the equation box */
const ToolBtn = styled(Button)(({ theme }) => ({
  textTransform: 'none',
  fontFamily: TOKEN.fontSans,
  fontWeight: 600,
  fontSize: '0.8rem',
  minHeight: 36,
  borderRadius: 6,
  paddingLeft: 10,
  paddingRight: 10,
  borderColor: theme.palette.divider,
  color: theme.palette.text.primary,
  '& .MuiButton-startIcon': { marginRight: 5 },
}));

const MathFieldWrapper = styled(Box)(({ theme }) => ({
  '& math-field': {
    width: '100%',
    display: 'block',
    fontSize: '22px',
    lineHeight: 1.6,
    border: `1.5px solid ${theme.palette.divider}`,
    borderRadius: TOKEN.radius,
    padding: '14px 16px',
    backgroundColor: theme.palette.background.paper,
    color: theme.palette.text.primary,
    minHeight: 120,
    outline: 'none',
    fontFamily: TOKEN.fontMono,
    transition: TOKEN.transition,
    boxSizing: 'border-box',
    '--hue': theme.palette.mode === 'dark' ? '220' : '220',
    '--keyboard-zindex': 2000,
    '&:focus': {
      borderColor: theme.palette.primary.main,
      boxShadow: `0 0 0 3px ${theme.palette.primary.main}22`,
    },
  },
}));

const StatusRow = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginTop: 6,
  gap: 8,
});

/* ─── Programming language options ─────────────────────────── */
const LANGUAGES = [
  { value: 'javascript', label: 'JavaScript', extension: 'js' },
  { value: 'python', label: 'Python', extension: 'py' },
  { value: 'java', label: 'Java', extension: 'java' },
  { value: 'cpp', label: 'C++', extension: 'cpp' },
  { value: 'html', label: 'HTML', extension: 'html' },
  { value: 'css', label: 'CSS', extension: 'css' },
  { value: 'json', label: 'JSON', extension: 'json' },
  { value: 'sql', label: 'SQL', extension: 'sql' },
  { value: 'xml', label: 'XML', extension: 'xml' },
];

/* ─── Saved answers are one string: "[MATH: …] [CODE: lang\n…] text" ───
   Split it back apart so a student who leaves a question and comes back
   still sees their equation and code where they left them.            */
const takeBlock = (source, prefix) => {
  if (!source.startsWith(prefix)) return null;
  let depth = 1;
  for (let i = prefix.length; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '[') depth += 1;
    else if (ch === ']') {
      depth -= 1;
      if (depth === 0) {
        return {
          content: source.slice(prefix.length, i),
          rest: source.slice(i + 1).replace(/^\s/, ''),
        };
      }
    }
  }
  return null;
};

const splitAnswer = (raw) => {
  let rest = raw || '';
  let math = '';
  let code = '';
  let language = '';

  const mathBlock = takeBlock(rest, '[MATH: ');
  if (mathBlock) {
    math = mathBlock.content;
    rest = mathBlock.rest;
  }

  const codeBlock = takeBlock(rest, '[CODE: ');
  if (codeBlock) {
    const newline = codeBlock.content.indexOf('\n');
    language = newline === -1 ? '' : codeBlock.content.slice(0, newline).trim();
    code = newline === -1 ? codeBlock.content : codeBlock.content.slice(newline + 1);
    rest = codeBlock.rest;
  }

  return { math, code, language, text: rest };
};

/* ─── Main Component ─────────────────────────────────────── */
const EnhancedOpenAnswer = ({ question, answer, onAnswerChange, disabled, answerRef }) => {
  const initial = splitAnswer(answer?.textAnswer);
  const [activeTab, setActiveTab] = useState(0);
  const [mathValue, setMathValue] = useState(initial.math);
  const [textValue, setTextValue] = useState(initial.text);
  const [activeGroup, setActiveGroup] = useState(SYMBOL_GROUPS[0].label);
  const [mathReady, setMathReady] = useState(false);
  const [codeValue, setCodeValue] = useState(initial.code);
  const [selectedLanguage, setSelectedLanguage] = useState(initial.language || 'javascript');
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const mathfieldRef = useRef(null);
  const codeEditorRef = useRef(null);
  const codeEditorContainerRef = useRef(null);

  // Reset local state when the question changes
  useEffect(() => {
    const parts = splitAnswer(answer?.textAnswer);
    setTextValue(parts.text);
    setMathValue(parts.math);
    setCodeValue(parts.code);
    if (parts.language) setSelectedLanguage(parts.language);
    setActiveTab(0);
  }, [question._id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Expose a method to get the current combined answer
  useEffect(() => {
    if (answerRef) {
      answerRef.current = () => {
        let combined = '';
        if (mathValue) combined += `[MATH: ${mathValue}] `;
        if (codeValue) combined += `[CODE: ${selectedLanguage}\n${codeValue}] `;
        if (textValue) combined += textValue;
        return combined || '';
      };
    }
  }, [mathValue, codeValue, selectedLanguage, textValue, answerRef]);

  const updateCombined = useCallback(
    (math, code, text) => {
      let combined = '';
      if (math) combined += `[MATH: ${math}] `;
      if (code) combined += `[CODE: ${selectedLanguage}\n${code}] `;
      if (text) combined += text;
      onAnswerChange(question._id, combined || '', question.type);
    },
    [question._id, question.type, onAnswerChange, selectedLanguage]
  );

  /* Set up the math field every time the Math tab is opened */
  useEffect(() => {
    if (activeTab !== 1) return undefined;
    const mf = mathfieldRef.current;
    if (!mf) return undefined;

    // MathLive 0.100 configures these as properties. Smart mode is off on
    // purpose: it silently switches to text mode while a student types.
    mf.smartMode = false;
    mf.smartFence = true;
    mf.smartSuperscript = true;
    mf.mathVirtualKeyboardPolicy = 'auto';

    // Restore anything the student wrote earlier without disturbing the
    // cursor while they are typing.
    if ((mf.value ?? '') !== mathValue) mf.value = mathValue;

    const onInput = () => {
      setMathValue(mf.value ?? '');
      // Don't call updateCombined on every keystroke to prevent typing interruption
    };

    // Enter starts a new line. MathLive wraps the content in a multi-line
    // environment for us - inserting a raw "\\" only prints backslashes.
    // A row cannot be added from inside a fraction or a root, so in that
    // case finish the current line first.
    const onKeyDown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        const before = mf.value ?? '';
        mf.executeCommand('addRowAfter');
        if ((mf.value ?? '') === before) {
          mf.executeCommand('moveToMathfieldEnd');
          mf.executeCommand('addRowAfter');
        }
        setMathValue(mf.value ?? '');
      }
    };

    mf.addEventListener('input', onInput);
    mf.addEventListener('keydown', onKeyDown);
    setMathReady(true);

    return () => {
      mf.removeEventListener('input', onInput);
      mf.removeEventListener('keydown', onKeyDown);
    };
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  /* On-screen keyboard: works on laptops too, not just touch screens */
  useEffect(() => {
    const vk = window.mathVirtualKeyboard;
    if (!vk) return undefined;

    vk.layouts = ['numeric', 'symbols', 'alphabetic', 'greek'];
    vk.alphabeticLayout = 'qwerty';
    // The big return key adds a new line instead of just closing the keyboard.
    vk.actionKeycap = { label: 'new line', command: 'addRowAfter' };

    // During a fullscreen exam the keyboard must live inside the fullscreen
    // element, otherwise it is invisible.
    const syncContainer = () => {
      const fs = document.fullscreenElement;
      vk.container = fs && !fs.contains(document.body) ? fs : document.body;
    };
    const syncVisible = () => setKeyboardVisible(vk.visible);

    syncContainer();
    document.addEventListener('fullscreenchange', syncContainer);
    vk.addEventListener('virtual-keyboard-toggle', syncVisible);

    return () => {
      document.removeEventListener('fullscreenchange', syncContainer);
      vk.removeEventListener('virtual-keyboard-toggle', syncVisible);
    };
  }, []);

  /* Keep the math field locked once the answer is submitted */
  useEffect(() => {
    const mf = mathfieldRef.current;
    if (mf) mf.readOnly = !!disabled;
  }, [disabled, activeTab]);

  /* Hide the on-screen keyboard when leaving the Math tab */
  useEffect(() => {
    if (activeTab === 1) return;
    const vk = window.mathVirtualKeyboard;
    if (vk?.visible) vk.hide();
  }, [activeTab]);

  /* Set up CodeMirror editor */
  useEffect(() => {
    if (activeTab !== 2 || !codeEditorContainerRef.current) return;

    // Clean up existing editor
    if (codeEditorRef.current) {
      codeEditorRef.current.destroy();
      codeEditorRef.current = null;
    }

    const container = codeEditorContainerRef.current;
    container.innerHTML = '';

    // Language extension mapping
    const languageExtensions = {
      javascript: javascript(),
      python: python(),
      java: java(),
      cpp: cpp(),
      html: html(),
      css: css(),
      json: json(),
      sql: sql(),
      xml: xml(),
    };

    const editor = new EditorView({
      doc: codeValue,
      extensions: [
        basicSetup,
        languageExtensions[selectedLanguage] || javascript(),
        oneDark,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            setCodeValue(update.state.doc.toString());
          }
        }),
        EditorView.theme({
          '&': {
            height: '300px',
            fontSize: '14px',
          },
          '.cm-scroller': {
            overflow: 'auto',
          },
        }),
      ],
      parent: container,
    });

    codeEditorRef.current = editor;

    return () => {
      if (codeEditorRef.current) {
        codeEditorRef.current.destroy();
        codeEditorRef.current = null;
      }
    };
  }, [activeTab, selectedLanguage]);

  /* Insert a LaTeX snippet at the math-field cursor */
  const insertSymbol = (latex) => {
    const mf = mathfieldRef.current;
    if (!mf) return;
    mf.focus();
    mf.executeCommand(['insert', latex]);
    setMathValue(mf.value ?? '');
    // Don't call updateCombined on symbol insert to prevent interruption
  };

  /* Toolbar actions - the same things the keyboard does, but visible */
  const runMathCommand = (command) => {
    const mf = mathfieldRef.current;
    if (!mf) return;
    mf.focus();
    mf.executeCommand(command);
    setMathValue(mf.value ?? '');
  };

  /* Start a new line. If the cursor sits inside a fraction or a root the
     row cannot be added there, so finish that line first and try again. */
  const insertNewLine = () => {
    const mf = mathfieldRef.current;
    if (!mf) return;
    mf.focus();
    const before = mf.value ?? '';
    mf.executeCommand('addRowAfter');
    if ((mf.value ?? '') === before) {
      mf.executeCommand('moveToMathfieldEnd');
      mf.executeCommand('addRowAfter');
    }
    setMathValue(mf.value ?? '');
  };

  const clearMath = () => {
    const mf = mathfieldRef.current;
    if (!mf) return;
    mf.value = '';
    mf.focus();
    setMathValue('');
  };

  const toggleKeyboard = () => {
    const vk = window.mathVirtualKeyboard;
    if (!vk) return;
    mathfieldRef.current?.focus();
    if (vk.visible) {
      vk.hide();
      setKeyboardVisible(false);
    } else {
      vk.show();
      setKeyboardVisible(true);
    }
  };

  const mathLineCount = mathValue ? mathValue.split('\\\\').length : 0;

  const handleTextChange = (e) => {
    const val = e.target.value;
    setTextValue(val);
    // Don't call updateCombined on every keystroke to prevent typing interruption
  };

  const handleTextBlur = () => {
    // Don't call updateCombined on blur to prevent overwriting saved state
    // The save will happen when clicking next
  };

  const handleTabChange = (event, newValue) => {
    // Sync answer before switching tabs
    updateCombined(mathValue, codeValue, textValue);
    setActiveTab(newValue);
  };

  const isSection = question?.section;
  const rows = isSection === 'C' ? 12 : 6;
  const recommended = isSection === 'C' ? 300 : null;
  const hasContent = mathValue.trim() || textValue.trim() || codeValue.trim();

  return (
    <Box sx={{ mt: 2 }}>
      <Shell elevation={0}>
        {/* ── Tab bar ── */}
        <TabBar value={activeTab} onChange={handleTabChange}>
          <Tab icon={<Edit fontSize="small" />} label="Written Answer" iconPosition="start" />
          <Tab icon={<Functions fontSize="small" />} label="Math / Equations" iconPosition="start" />
          <Tab icon={<Code fontSize="small" />} label="Code / Programming" iconPosition="start" />
        </TabBar>

        {/* ── Tab content ── */}
        <Box sx={{ p: 2 }}>
          {/* TEXT TAB */}
          {activeTab === 0 && (
            <Box>
              <TextField
                fullWidth
                multiline
                rows={rows}
                placeholder="Write your answer here. Show all working clearly and logically."
                value={textValue}
                onChange={handleTextChange}
                disabled={disabled}
                variant="outlined"
                inputProps={{
                  style: { fontFamily: TOKEN.fontSans, fontSize: '0.9375rem', lineHeight: 1.7 },
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: TOKEN.radius,
                    '& fieldset': { borderColor: 'divider' },
                    '&:hover fieldset': { borderColor: 'text.secondary' },
                    '&.Mui-focused fieldset': { borderColor: 'primary.main', borderWidth: 1.5 },
                  },
                }}
              />
              <StatusRow>
                <Typography variant="caption" color="text.disabled" sx={{ fontFamily: TOKEN.fontMono }}>
                  {textValue.length} chars
                  {recommended && textValue.length < recommended && (
                    <Box component="span" sx={{ color: 'warning.main', ml: 1 }}>
                      (aim for {recommended}+)
                    </Box>
                  )}
                </Typography>
                <Typography variant="caption" color="text.disabled" sx={{ fontFamily: TOKEN.fontSans }}>
                  <Box component="kbd" sx={{ px: 0.6, py: 0.1, borderRadius: '3px', border: '1px solid', borderColor: 'divider', bgcolor: 'background.default', fontFamily: TOKEN.fontMono, fontSize: '0.65rem' }}>Enter</Box>
                  {' '}for new line
                </Typography>
                {mathValue && (
                  <Chip
                    icon={<Functions sx={{ fontSize: '0.75rem !important' }} />}
                    label="Equation attached"
                    size="small"
                    color="info"
                    variant="outlined"
                    sx={{ fontSize: '0.7rem', height: 22 }}
                  />
                )}
                {textValue.length > 10 && (
                  <CheckCircleOutline sx={{ fontSize: 16, color: 'success.main' }} />
                )}
              </StatusRow>
            </Box>
          )}

          {/* MATH TAB */}
          {activeTab === 1 && (
            <Box>
              {/* Plain-language instructions */}
              <Alert
                severity="info"
                icon={false}
                sx={{
                  mb: 1.5,
                  py: 0.5,
                  borderRadius: TOKEN.radius,
                  fontFamily: TOKEN.fontSans,
                  fontSize: '0.8rem',
                  '& .MuiAlert-message': { py: 0.5 },
                }}
              >
                Write your working in the white box below. Press{' '}
                <Box component="kbd" sx={{ px: 0.6, py: 0.1, borderRadius: '3px', border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', fontFamily: TOKEN.fontMono, fontSize: '0.7rem' }}>Enter</Box>
                {' '}to start a new line. No keyboard? Tap <strong>On-screen keys</strong>.
              </Alert>

              {/* Big visible actions */}
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1.5 }}>
                <ToolBtn
                  variant="contained"
                  disableElevation
                  disabled={disabled}
                  startIcon={<KeyboardReturn fontSize="small" />}
                  onClick={insertNewLine}
                >
                  New line
                </ToolBtn>
                <ToolBtn
                  variant={keyboardVisible ? 'contained' : 'outlined'}
                  disableElevation
                  disabled={disabled}
                  color={keyboardVisible ? 'primary' : 'inherit'}
                  startIcon={<Keyboard fontSize="small" />}
                  onClick={toggleKeyboard}
                >
                  {keyboardVisible ? 'Hide keys' : 'On-screen keys'}
                </ToolBtn>
                <ToolBtn
                  variant="outlined"
                  disabled={disabled}
                  startIcon={<Backspace fontSize="small" />}
                  onClick={() => runMathCommand('deleteBackward')}
                >
                  Delete
                </ToolBtn>
                <ToolBtn
                  variant="outlined"
                  disabled={disabled}
                  startIcon={<Undo fontSize="small" />}
                  onClick={() => runMathCommand('undo')}
                >
                  Undo
                </ToolBtn>
                <ToolBtn
                  variant="outlined"
                  disabled={disabled}
                  startIcon={<Redo fontSize="small" />}
                  onClick={() => runMathCommand('redo')}
                >
                  Redo
                </ToolBtn>
                <ToolBtn
                  variant="outlined"
                  color="error"
                  disabled={disabled || !mathValue}
                  startIcon={<DeleteOutline fontSize="small" />}
                  onClick={clearMath}
                >
                  Start again
                </ToolBtn>
              </Box>

              <MathFieldWrapper>
                <math-field
                  ref={mathfieldRef}
                  id={`math-input-${question._id}`}
                  math-virtual-keyboard-policy="auto"
                  default-mode="math"
                />
              </MathFieldWrapper>

              <StatusRow>
                <Typography variant="caption" color="text.disabled" sx={{ fontFamily: TOKEN.fontSans, fontSize: '0.72rem' }}>
                  {mathValue
                    ? `${mathLineCount} line${mathLineCount === 1 ? '' : 's'} written`
                    : 'Nothing written yet'}
                </Typography>
                {mathValue && (
                  <CheckCircleOutline sx={{ fontSize: 16, color: 'success.main' }} />
                )}
              </StatusRow>

              {/* ── Math symbol palette ── */}
              <SymbolBar>
                  {/* Group selector chips */}
                  <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                    <Typography
                      variant="caption"
                      sx={{ fontFamily: TOKEN.fontSans, fontWeight: 700, color: 'text.secondary', mb: 0.5 }}
                    >
                      Tap a symbol to add it to your answer
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.75, mb: 1, flexWrap: 'wrap' }}>
                      {SYMBOL_GROUPS.map((g) => (
                        <Chip
                          key={g.label}
                          label={g.label}
                          variant={activeGroup === g.label ? 'filled' : 'outlined'}
                          color={activeGroup === g.label ? 'primary' : 'default'}
                          onClick={() => setActiveGroup(g.label)}
                          sx={{
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            fontFamily: TOKEN.fontSans,
                            height: 30,
                            cursor: 'pointer',
                          }}
                        />
                      ))}
                    </Box>
                    {/* Symbol buttons for active group */}
                    {SYMBOL_GROUPS.filter((g) => g.label === activeGroup).map((g) => (
                      <Box key={g.label} sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6 }}>
                        {g.symbols.map((s) => (
                          <Tooltip key={`${g.label}-${s.label}`} title={s.name} arrow placement="top">
                            <SymBtn
                              type="button"
                              aria-label={s.name}
                              disabled={disabled}
                              onClick={() => insertSymbol(s.latex)}
                            >
                              {s.label}
                            </SymBtn>
                          </Tooltip>
                        ))}
                      </Box>
                    ))}
                  </Box>
              </SymbolBar>

              {/* Worked example - shown until the student starts writing */}
              <Collapse in={!mathValue}>
                <Box
                  sx={{
                    mt: 2,
                    p: 1.5,
                    borderRadius: TOKEN.radius,
                    border: '1px dashed',
                    borderColor: 'divider',
                    bgcolor: 'background.default',
                  }}
                >
                  <Typography variant="caption" color="text.secondary" sx={{ fontFamily: TOKEN.fontSans, display: 'block', mb: 0.75, fontWeight: 700 }}>
                    How to write your working
                  </Typography>
                  {[
                    ['Type it like you say it', 'Type  2x+3=11  and it appears as proper maths.'],
                    ['One step per line', 'Press Enter after each step, like writing in an exercise book.'],
                    ['Fractions and roots', 'Tap  a/b  or  √  in the palette above, then type inside the box that appears.'],
                    ['Powers', 'Tap  x²  or type  ^  then the power.'],
                  ].map(([name, hint]) => (
                    <Box key={name} sx={{ display: 'flex', gap: 1, alignItems: 'baseline', mb: 0.5 }}>
                      <Typography variant="caption" sx={{ width: 150, flexShrink: 0, fontFamily: TOKEN.fontSans, fontWeight: 600, color: 'text.secondary' }}>
                        {name}
                      </Typography>
                      <Typography variant="caption" sx={{ fontFamily: TOKEN.fontSans, color: 'text.disabled' }}>
                        {hint}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Collapse>

              {/* For students who already know LaTeX */}
              <Collapse in={!!mathValue}>
                <Tooltip title={mathValue} arrow placement="top">
                  <Typography
                    variant="caption"
                    color="text.disabled"
                    sx={{ fontFamily: TOKEN.fontMono, fontSize: '0.68rem', display: 'block', mt: 0.5, wordBreak: 'break-all' }}
                  >
                    LaTeX: {mathValue.slice(0, 80)}{mathValue.length > 80 ? '…' : ''}
                  </Typography>
                </Tooltip>
              </Collapse>
            </Box>
          )}

          {/* CODE TAB */}
          {activeTab === 2 && (
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <Code fontSize="small" sx={{ color: 'text.secondary' }} />
                <Typography variant="caption" color="text.secondary" sx={{ fontFamily: TOKEN.fontSans }}>
                  Write your code solution below · Select your programming language
                </Typography>
                <Tooltip
                  title="Use this editor to write and format code. Syntax highlighting is available for multiple languages."
                  arrow
                >
                  <InfoOutlined sx={{ fontSize: 15, color: 'text.disabled', ml: 'auto', cursor: 'help' }} />
                </Tooltip>
              </Box>

              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel id="language-select-label" sx={{ fontSize: '0.875rem' }}>Programming Language</InputLabel>
                <Select
                  labelId="language-select-label"
                  value={selectedLanguage}
                  label="Programming Language"
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                  disabled={disabled}
                  sx={{ fontSize: '0.875rem' }}
                >
                  {LANGUAGES.map((lang) => (
                    <MenuItem key={lang.value} value={lang.value} sx={{ fontSize: '0.875rem' }}>
                      {lang.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Box
                ref={codeEditorContainerRef}
                sx={{
                  border: `1.5px solid`,
                  borderColor: 'divider',
                  borderRadius: TOKEN.radius,
                  overflow: 'hidden',
                  minHeight: '300px',
                  '& .cm-editor': {
                    height: '300px',
                  },
                }}
              />

              <StatusRow>
                <Typography variant="caption" color="text.disabled" sx={{ fontFamily: TOKEN.fontMono, fontSize: '0.7rem' }}>
                  {codeValue ? `${codeValue.split('\n').length} lines, ${codeValue.length} chars` : 'No code entered'}
                </Typography>
                {codeValue && (
                  <CheckCircleOutline sx={{ fontSize: 16, color: 'success.main' }} />
                )}
              </StatusRow>
            </Box>
          )}
        </Box>
      </Shell>

      {/* ── Both-tab status banner ── */}
      {hasContent && (
        <Alert
          severity="success"
          icon={<CheckCircleOutline fontSize="inherit" />}
          sx={{ mt: 1.5, py: 0.5, borderRadius: TOKEN.radius, fontFamily: TOKEN.fontSans, fontSize: '0.8rem' }}
        >
          Answer recorded.
          {mathValue && textValue && codeValue
            ? ' Written answer + equation + code saved.'
            : mathValue && textValue
            ? ' Written answer + equation saved.'
            : mathValue && codeValue
            ? ' Equation + code saved.'
            : textValue && codeValue
            ? ' Written answer + code saved.'
            : mathValue
            ? ' Equation saved.'
            : codeValue
            ? ' Code saved.'
            : ' Written answer saved.'}
        </Alert>
      )}
    </Box>
  );
};

export default EnhancedOpenAnswer;