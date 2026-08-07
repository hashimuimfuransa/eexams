import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useTheme
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  Backspace,
  BookmarkAdd,
  Calculate,
  Close,
  DeleteSweep,
  ExpandLess,
  History
} from '@mui/icons-material';

/* -------------------------------------------------------------------------- */
/*  Expression engine (no eval - safe tokenizer + recursive descent parser)     */
/* -------------------------------------------------------------------------- */

const FUNCTION_NAMES = [
  'asin', 'acos', 'atan',
  'sinh', 'cosh', 'tanh',
  'sin', 'cos', 'tan',
  'sqrt', 'cbrt',
  'log', 'ln', 'exp', 'abs'
];

// Longest first so "asin" is not read as "a" + "sin"
const SORTED_FUNCTIONS = [...FUNCTION_NAMES].sort((a, b) => b.length - a.length);

const tokenize = (input) => {
  const s = String(input).replace(/\s+/g, ' ');
  const tokens = [];
  let i = 0;

  while (i < s.length) {
    const c = s[i];

    if (c === ' ') { i += 1; continue; }

    if (/[0-9.]/.test(c)) {
      const match = /^(\d+(\.\d*)?|\.\d+)(E[+-]?\d+)?/.exec(s.slice(i));
      if (!match) throw new Error('Invalid number');
      const value = parseFloat(match[0]);
      if (Number.isNaN(value)) throw new Error('Invalid number');
      tokens.push({ type: 'num', value });
      i += match[0].length;
      continue;
    }

    if (s.startsWith('mod', i)) { tokens.push({ type: 'op', value: 'mod' }); i += 3; continue; }
    if (s.startsWith('Ans', i) || s.startsWith('ans', i)) { tokens.push({ type: 'ans' }); i += 3; continue; }

    const fn = SORTED_FUNCTIONS.find((name) => s.startsWith(name, i));
    if (fn) { tokens.push({ type: 'fn', value: fn }); i += fn.length; continue; }

    if (c === '√') { tokens.push({ type: 'fn', value: 'sqrt' }); i += 1; continue; }
    if (c === '∛') { tokens.push({ type: 'fn', value: 'cbrt' }); i += 1; continue; }
    if (c === 'π') { tokens.push({ type: 'num', value: Math.PI }); i += 1; continue; }
    if (c === 'e') { tokens.push({ type: 'num', value: Math.E }); i += 1; continue; }

    if (c === '+') { tokens.push({ type: 'op', value: '+' }); i += 1; continue; }
    if (c === '-' || c === '−') { tokens.push({ type: 'op', value: '-' }); i += 1; continue; }
    if (c === '*' || c === '×') { tokens.push({ type: 'op', value: '*' }); i += 1; continue; }
    if (c === '/' || c === '÷') { tokens.push({ type: 'op', value: '/' }); i += 1; continue; }
    if (c === '^') { tokens.push({ type: 'op', value: '^' }); i += 1; continue; }
    if (c === '(') { tokens.push({ type: 'lparen' }); i += 1; continue; }
    if (c === ')') { tokens.push({ type: 'rparen' }); i += 1; continue; }
    if (c === '!') { tokens.push({ type: 'fact' }); i += 1; continue; }
    if (c === '%') { tokens.push({ type: 'pct' }); i += 1; continue; }

    throw new Error(`Unexpected "${c}"`);
  }

  return tokens;
};

const parse = (tokens) => {
  let pos = 0;
  const peek = () => tokens[pos];
  const eat = (type, value) => {
    const t = tokens[pos];
    if (!t || t.type !== type || (value !== undefined && t.value !== value)) return null;
    pos += 1;
    return t;
  };

  const startsPrimary = (t) =>
    !!t && (t.type === 'num' || t.type === 'ans' || t.type === 'fn' || t.type === 'lparen');

  const parsePrimary = () => {
    const t = peek();
    if (!t) throw new Error('Incomplete expression');

    if (t.type === 'num') { pos += 1; return { kind: 'num', value: t.value }; }
    if (t.type === 'ans') { pos += 1; return { kind: 'ans' }; }

    if (t.type === 'lparen') {
      pos += 1;
      const inner = parseExpression();
      if (!eat('rparen')) throw new Error('Missing ")"');
      return inner;
    }

    if (t.type === 'fn') {
      pos += 1;
      return { kind: 'fn', name: t.value, arg: parsePostfix() };
    }

    throw new Error('Incomplete expression');
  };

  const parsePostfix = () => {
    let node = parsePrimary();
    for (;;) {
      if (eat('fact')) { node = { kind: 'fact', arg: node }; continue; }
      if (eat('pct')) { node = { kind: 'pct', arg: node }; continue; }
      break;
    }
    return node;
  };

  const parsePower = () => {
    const base = parsePostfix();
    if (eat('op', '^')) return { kind: 'bin', op: '^', left: base, right: parseUnary() };
    return base;
  };

  const parseUnary = () => {
    if (eat('op', '-')) return { kind: 'neg', arg: parseUnary() };
    if (eat('op', '+')) return parseUnary();
    return parsePower();
  };

  const parseTerm = () => {
    let node = parseUnary();
    for (;;) {
      const t = peek();
      if (t && t.type === 'op' && (t.value === '*' || t.value === '/' || t.value === 'mod')) {
        pos += 1;
        node = { kind: 'bin', op: t.value, left: node, right: parseUnary() };
        continue;
      }
      // Implicit multiplication: 2(3+1), 3π, 2sin30
      if (startsPrimary(t)) {
        node = { kind: 'bin', op: '*', left: node, right: parseUnary() };
        continue;
      }
      break;
    }
    return node;
  };

  function parseExpression() {
    let node = parseTerm();
    for (;;) {
      const t = peek();
      if (t && t.type === 'op' && (t.value === '+' || t.value === '-')) {
        pos += 1;
        node = { kind: 'bin', op: t.value, left: node, right: parseTerm() };
        continue;
      }
      break;
    }
    return node;
  }

  const tree = parseExpression();
  if (pos !== tokens.length) throw new Error('Invalid expression');
  return tree;
};

const factorial = (n) => {
  if (!Number.isInteger(n) || n < 0) throw new Error('Factorial needs a whole number');
  if (n > 170) return Infinity;
  let result = 1;
  for (let k = 2; k <= n; k += 1) result *= k;
  return result;
};

const createEvaluator = ({ angleMode, ans }) => {
  const isDeg = angleMode === 'DEG';
  const toRadians = (v) => (isDeg ? (v * Math.PI) / 180 : v);
  const fromRadians = (v) => (isDeg ? (v * 180) / Math.PI : v);
  // Degrees are exact values in practice (sin 30 = 0.5), so trim float noise.
  const tidy = (v) => {
    if (!isDeg || !Number.isFinite(v)) return v;
    const rounded = Math.round(v * 1e12) / 1e12;
    return Object.is(rounded, -0) ? 0 : rounded;
  };

  const applyFunction = (name, x) => {
    switch (name) {
      case 'sin': return tidy(Math.sin(toRadians(x)));
      case 'cos': return tidy(Math.cos(toRadians(x)));
      case 'tan':
        if (isDeg && Math.abs(((x % 180) + 180) % 180) === 90) throw new Error('tan is undefined here');
        return tidy(Math.tan(toRadians(x)));
      case 'asin':
        if (x < -1 || x > 1) throw new Error('asin needs -1 to 1');
        return tidy(fromRadians(Math.asin(x)));
      case 'acos':
        if (x < -1 || x > 1) throw new Error('acos needs -1 to 1');
        return tidy(fromRadians(Math.acos(x)));
      case 'atan': return tidy(fromRadians(Math.atan(x)));
      case 'sinh': return Math.sinh(x);
      case 'cosh': return Math.cosh(x);
      case 'tanh': return Math.tanh(x);
      case 'sqrt':
        if (x < 0) throw new Error('Cannot take √ of a negative number');
        return Math.sqrt(x);
      case 'cbrt': return Math.cbrt(x);
      case 'log':
        if (x <= 0) throw new Error('log needs a positive number');
        return Math.log10(x);
      case 'ln':
        if (x <= 0) throw new Error('ln needs a positive number');
        return Math.log(x);
      case 'exp': return Math.exp(x);
      case 'abs': return Math.abs(x);
      default: throw new Error(`Unknown function ${name}`);
    }
  };

  const evaluate = (node) => {
    switch (node.kind) {
      case 'num': return node.value;
      case 'ans': return Number(ans) || 0;
      case 'neg': return -evaluate(node.arg);
      case 'fn': return applyFunction(node.name, evaluate(node.arg));
      case 'fact': return factorial(evaluate(node.arg));
      case 'pct': return evaluate(node.arg) / 100;
      case 'bin': {
        const left = evaluate(node.left);
        // "200 + 15%" means 200 + 15% of 200, the way every calculator behaves.
        if ((node.op === '+' || node.op === '-') && node.right.kind === 'pct') {
          const portion = (left * evaluate(node.right.arg)) / 100;
          return node.op === '+' ? left + portion : left - portion;
        }
        const right = evaluate(node.right);
        switch (node.op) {
          case '+': return left + right;
          case '-': return left - right;
          case '*': return left * right;
          case '/':
            if (right === 0) throw new Error('Cannot divide by zero');
            return left / right;
          case 'mod':
            if (right === 0) throw new Error('Cannot divide by zero');
            return left % right;
          case '^': return left ** right;
          default: throw new Error('Unknown operator');
        }
      }
      default: throw new Error('Invalid expression');
    }
  };

  return evaluate;
};

/**
 * Balance unclosed brackets and drop a dangling operator so that a
 * half-typed expression such as "2*sin(30" still evaluates.
 */
const normalizeExpression = (raw) => {
  let expression = String(raw).trim();
  expression = expression.replace(/[+\-*/^×÷−]+$/, '').trim();
  expression = expression.replace(/\bmod$/, '').trim();

  let open = 0;
  for (const ch of expression) {
    if (ch === '(') open += 1;
    else if (ch === ')') open = Math.max(0, open - 1);
  }
  return expression + ')'.repeat(open);
};

export const evaluateExpression = (raw, { angleMode = 'DEG', ans = 0 } = {}) => {
  const expression = normalizeExpression(raw);
  if (!expression) throw new Error('Nothing to calculate');

  const value = createEvaluator({ angleMode, ans })(parse(tokenize(expression)));
  if (typeof value !== 'number' || Number.isNaN(value)) throw new Error('Result is not a number');
  if (!Number.isFinite(value)) throw new Error('Result is too large');
  return value;
};

export const formatNumber = (value) => {
  if (!Number.isFinite(value)) return 'Error';
  if (Number.isInteger(value) && Math.abs(value) < 1e15) return String(value);

  const magnitude = Math.abs(value);
  if (magnitude !== 0 && (magnitude < 1e-9 || magnitude >= 1e12)) {
    return value.toExponential(9).replace(/\.?0+e/, 'e');
  }

  let text = value.toPrecision(12);
  if (text.includes('.')) text = text.replace(/0+$/, '').replace(/\.$/, '');
  return text;
};

/* -------------------------------------------------------------------------- */
/*  Shared state - memory, saved numbers, history and Ans survive re-opening    */
/* -------------------------------------------------------------------------- */

const STORAGE_KEY = 'examScientificCalculator';
const DEFAULT_STATE = { angleMode: 'DEG', memory: null, ans: null, saved: [], history: [] };

let sharedState = null;
const subscribers = new Set();

const readState = () => {
  if (sharedState) return sharedState;
  let stored = {};
  try {
    stored = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY)) || {};
  } catch (error) {
    stored = {};
  }
  sharedState = { ...DEFAULT_STATE, ...stored };
  return sharedState;
};

const updateState = (patch) => {
  sharedState = { ...readState(), ...patch };
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(sharedState));
  } catch (error) {
    /* storage is optional */
  }
  subscribers.forEach((notify) => notify(sharedState));
};

const useCalculatorState = () => {
  const [state, setState] = useState(readState);
  useEffect(() => {
    const notify = (next) => setState(next);
    subscribers.add(notify);
    setState(readState());
    return () => subscribers.delete(notify);
  }, []);
  return state;
};

/* -------------------------------------------------------------------------- */
/*  Keypad                                                                      */
/* -------------------------------------------------------------------------- */

// Multi-character tokens are removed in one go by the delete key.
const TOKENS = [
  'asin(', 'acos(', 'atan(', 'sinh(', 'cosh(', 'tanh(',
  'sin(', 'cos(', 'tan(', 'sqrt(', 'cbrt(', 'log(', 'ln(', 'exp(', 'abs(',
  '√(', '∛(', '10^(', '^(-1)', ' mod ', 'Ans', '(-'
];

const VARIANT_KEYS = {
  digit: 'digit',
  operator: 'operator',
  function: 'function',
  memory: 'memory',
  danger: 'danger',
  equals: 'equals'
};

const CalculatorPanel = ({ compact = false, autoFocus = true }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { angleMode, memory, ans, saved, history } = useCalculatorState();

  const [expression, setExpression] = useState('');
  const [error, setError] = useState('');
  const [secondary, setSecondary] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) inputRef.current.focus();
  }, [autoFocus]);

  const caret = useCallback(() => {
    const el = inputRef.current;
    if (!el || document.activeElement !== el) {
      return { start: expression.length, end: expression.length, el };
    }
    return { start: el.selectionStart ?? expression.length, end: el.selectionEnd ?? expression.length, el };
  }, [expression]);

  const applyEdit = useCallback((nextExpression, caretPosition) => {
    setExpression(nextExpression);
    setError('');
    const el = inputRef.current;
    if (!el) return;
    window.requestAnimationFrame(() => {
      el.focus();
      const position = Math.max(0, Math.min(caretPosition, nextExpression.length));
      el.setSelectionRange(position, position);
    });
  }, []);

  const insert = useCallback((text) => {
    const { start, end } = caret();
    applyEdit(expression.slice(0, start) + text + expression.slice(end), start + text.length);
  }, [applyEdit, caret, expression]);

  /** Deletes one character - or one whole token such as "sin(" - at the caret. */
  const backspace = useCallback(() => {
    const { start, end } = caret();

    if (start !== end) {
      applyEdit(expression.slice(0, start) + expression.slice(end), start);
      return;
    }
    if (start === 0) return;

    const before = expression.slice(0, start);
    const token = TOKENS.find((candidate) => before.endsWith(candidate));
    const length = token ? token.length : 1;
    applyEdit(expression.slice(0, start - length) + expression.slice(start), start - length);
  }, [applyEdit, caret, expression]);

  /** Clears just the number being typed, keeping the rest of the expression. */
  const clearEntry = useCallback(() => {
    const { start, end } = caret();
    if (start !== end) { backspace(); return; }

    const before = expression.slice(0, start);
    const match = /(\d+\.?\d*|\.\d+)$/.exec(before);
    if (!match) { backspace(); return; }
    applyEdit(expression.slice(0, start - match[0].length) + expression.slice(start), start - match[0].length);
  }, [applyEdit, backspace, caret, expression]);

  const clearAll = useCallback(() => {
    setExpression('');
    setError('');
    if (inputRef.current) inputRef.current.focus();
  }, []);

  /** Toggles the sign of the number at the caret: 25 -> (-25) -> 25 */
  const toggleSign = useCallback(() => {
    const { start } = caret();
    const before = expression.slice(0, start);

    const wrapped = /\(-(\d+\.?\d*|\.\d+)\)$/.exec(before);
    if (wrapped) {
      const head = expression.slice(0, start - wrapped[0].length);
      applyEdit(head + wrapped[1] + expression.slice(start), head.length + wrapped[1].length);
      return;
    }

    const plain = /(\d+\.?\d*|\.\d+)$/.exec(before);
    if (plain) {
      const head = expression.slice(0, start - plain[0].length);
      const replacement = `(-${plain[1]})`;
      applyEdit(head + replacement + expression.slice(start), head.length + replacement.length);
      return;
    }

    insert('(-');
  }, [applyEdit, caret, expression, insert]);

  const preview = useMemo(() => {
    if (!expression.trim()) return null;
    try {
      const value = evaluateExpression(expression, { angleMode, ans: ans ?? 0 });
      const text = formatNumber(value);
      return text === expression.trim() ? null : text;
    } catch (err) {
      return null;
    }
  }, [angleMode, ans, expression]);

  /** Current value: the live result if the expression is valid, otherwise Ans. */
  const currentValue = useCallback(() => {
    try {
      return evaluateExpression(expression, { angleMode, ans: ans ?? 0 });
    } catch (err) {
      return Number(ans) || 0;
    }
  }, [angleMode, ans, expression]);

  const calculate = useCallback(() => {
    const trimmed = expression.trim();
    if (!trimmed) return;
    try {
      const value = evaluateExpression(trimmed, { angleMode, ans: ans ?? 0 });
      const text = formatNumber(value);
      updateState({
        ans: value,
        history: [{ id: `${Date.now()}`, expression: trimmed, result: text }, ...(history || [])].slice(0, 30)
      });
      setError('');
      setExpression(text);
      const el = inputRef.current;
      if (el) {
        window.requestAnimationFrame(() => {
          el.focus();
          el.setSelectionRange(text.length, text.length);
        });
      }
    } catch (err) {
      setError(err.message || 'Invalid expression');
    }
  }, [angleMode, ans, expression, history]);

  const saveNumber = useCallback(() => {
    const value = currentValue();
    if (!Number.isFinite(value)) return;
    const entry = { id: `${Date.now()}`, value };
    updateState({ saved: [entry, ...(saved || []).filter((item) => item.value !== value)].slice(0, 12) });
  }, [currentValue, saved]);

  const keyStyles = useCallback((variant) => {
    const palette = {
      [VARIANT_KEYS.digit]: isDark ? alpha(theme.palette.common.white, 0.12) : theme.palette.grey[200],
      [VARIANT_KEYS.operator]: alpha(theme.palette.warning.main, isDark ? 0.28 : 0.22),
      [VARIANT_KEYS.function]: alpha(theme.palette.info.main, isDark ? 0.25 : 0.16),
      [VARIANT_KEYS.memory]: alpha(theme.palette.secondary.main, isDark ? 0.28 : 0.16),
      [VARIANT_KEYS.danger]: alpha(theme.palette.error.main, isDark ? 0.32 : 0.18),
      [VARIANT_KEYS.equals]: theme.palette.success.main
    };
    const background = palette[variant] || palette[VARIANT_KEYS.digit];

    return {
      bgcolor: background,
      color: variant === VARIANT_KEYS.equals ? theme.palette.success.contrastText : 'text.primary',
      minWidth: 0,
      px: 0,
      lineHeight: 1.1,
      minHeight: compact ? 32 : 40,
      fontSize: compact ? 12 : 14,
      fontWeight: variant === VARIANT_KEYS.digit || variant === VARIANT_KEYS.equals ? 700 : 600,
      textTransform: 'none',
      borderRadius: 1,
      '&:hover': {
        bgcolor: variant === VARIANT_KEYS.equals
          ? theme.palette.success.dark
          : alpha(background, Math.min(1, (isDark ? 0.45 : 0.38))),
        filter: 'brightness(1.05)'
      }
    };
  }, [compact, isDark, theme]);

  const memoryValue = Number.isFinite(memory) ? memory : null;

  const keys = useMemo(() => [
    { label: 'MC', title: 'Clear memory', variant: VARIANT_KEYS.memory, onClick: () => updateState({ memory: null }), disabled: memoryValue === null },
    { label: 'MR', title: 'Recall the number in memory', variant: VARIANT_KEYS.memory, onClick: () => insert(formatNumber(memoryValue ?? 0)), disabled: memoryValue === null },
    { label: 'M+', title: 'Add the current value to memory', variant: VARIANT_KEYS.memory, onClick: () => updateState({ memory: (memoryValue ?? 0) + currentValue() }) },
    { label: 'M-', title: 'Subtract the current value from memory', variant: VARIANT_KEYS.memory, onClick: () => updateState({ memory: (memoryValue ?? 0) - currentValue() }) },
    { label: 'MS', title: 'Store the current value in memory', variant: VARIANT_KEYS.memory, onClick: () => updateState({ memory: currentValue() }) },

    { label: '2nd', title: 'Second functions (inverse)', variant: secondary ? VARIANT_KEYS.equals : VARIANT_KEYS.function, onClick: () => setSecondary((value) => !value) },
    { label: angleMode, title: 'Switch between degrees and radians', variant: VARIANT_KEYS.function, onClick: () => updateState({ angleMode: angleMode === 'DEG' ? 'RAD' : 'DEG' }) },
    { label: '(', variant: VARIANT_KEYS.function, onClick: () => insert('(') },
    { label: ')', variant: VARIANT_KEYS.function, onClick: () => insert(')') },
    {
      label: <Backspace sx={{ fontSize: compact ? 16 : 18 }} />,
      ariaLabel: 'Delete one character',
      title: 'Delete one character or function (Backspace)',
      variant: VARIANT_KEYS.danger,
      onClick: backspace
    },

    secondary
      ? { label: 'sin⁻¹', variant: VARIANT_KEYS.function, onClick: () => insert('asin(') }
      : { label: 'sin', variant: VARIANT_KEYS.function, onClick: () => insert('sin(') },
    secondary
      ? { label: 'cos⁻¹', variant: VARIANT_KEYS.function, onClick: () => insert('acos(') }
      : { label: 'cos', variant: VARIANT_KEYS.function, onClick: () => insert('cos(') },
    secondary
      ? { label: 'tan⁻¹', variant: VARIANT_KEYS.function, onClick: () => insert('atan(') }
      : { label: 'tan', variant: VARIANT_KEYS.function, onClick: () => insert('tan(') },
    secondary
      ? { label: 'eˣ', title: 'e to the power of x', variant: VARIANT_KEYS.function, onClick: () => insert('exp(') }
      : { label: 'ln', variant: VARIANT_KEYS.function, onClick: () => insert('ln(') },
    secondary
      ? { label: '10ˣ', variant: VARIANT_KEYS.function, onClick: () => insert('10^(') }
      : { label: 'log', variant: VARIANT_KEYS.function, onClick: () => insert('log(') },

    secondary
      ? { label: 'x³', variant: VARIANT_KEYS.function, onClick: () => insert('^3') }
      : { label: 'x²', variant: VARIANT_KEYS.function, onClick: () => insert('^2') },
    { label: 'xʸ', title: 'Power', variant: VARIANT_KEYS.function, onClick: () => insert('^') },
    secondary
      ? { label: '∛', title: 'Cube root', variant: VARIANT_KEYS.function, onClick: () => insert('∛(') }
      : { label: '√', title: 'Square root', variant: VARIANT_KEYS.function, onClick: () => insert('√(') },
    { label: 'n!', title: 'Factorial', variant: VARIANT_KEYS.function, onClick: () => insert('!') },
    secondary
      ? { label: '|x|', title: 'Absolute value', variant: VARIANT_KEYS.function, onClick: () => insert('abs(') }
      : { label: '1/x', title: 'Reciprocal', variant: VARIANT_KEYS.function, onClick: () => insert('^(-1)') },

    { label: 'π', variant: VARIANT_KEYS.function, onClick: () => insert('π') },
    { label: 'e', variant: VARIANT_KEYS.function, onClick: () => insert('e') },
    { label: '%', title: 'Percent', variant: VARIANT_KEYS.function, onClick: () => insert('%') },
    { label: 'mod', title: 'Remainder', variant: VARIANT_KEYS.function, onClick: () => insert(' mod ') },
    { label: 'Ans', title: 'Last result', variant: VARIANT_KEYS.function, onClick: () => insert('Ans'), disabled: ans === null || ans === undefined },

    { label: '7', variant: VARIANT_KEYS.digit, onClick: () => insert('7') },
    { label: '8', variant: VARIANT_KEYS.digit, onClick: () => insert('8') },
    { label: '9', variant: VARIANT_KEYS.digit, onClick: () => insert('9') },
    { label: '÷', variant: VARIANT_KEYS.operator, onClick: () => insert('/') },
    { label: 'C', title: 'Clear everything', variant: VARIANT_KEYS.danger, onClick: clearAll },

    { label: '4', variant: VARIANT_KEYS.digit, onClick: () => insert('4') },
    { label: '5', variant: VARIANT_KEYS.digit, onClick: () => insert('5') },
    { label: '6', variant: VARIANT_KEYS.digit, onClick: () => insert('6') },
    { label: '×', variant: VARIANT_KEYS.operator, onClick: () => insert('*') },
    { label: 'CE', title: 'Clear the number you are typing', variant: VARIANT_KEYS.danger, onClick: clearEntry },

    { label: '1', variant: VARIANT_KEYS.digit, onClick: () => insert('1') },
    { label: '2', variant: VARIANT_KEYS.digit, onClick: () => insert('2') },
    { label: '3', variant: VARIANT_KEYS.digit, onClick: () => insert('3') },
    { label: '−', variant: VARIANT_KEYS.operator, onClick: () => insert('-') },
    { label: '±', title: 'Change sign', variant: VARIANT_KEYS.operator, onClick: toggleSign },

    { label: '0', variant: VARIANT_KEYS.digit, onClick: () => insert('0') },
    { label: '.', variant: VARIANT_KEYS.digit, onClick: () => insert('.') },
    { label: 'EXP', title: 'Times ten to the power of', variant: VARIANT_KEYS.operator, onClick: () => insert('E') },
    { label: '+', variant: VARIANT_KEYS.operator, onClick: () => insert('+') },
    { label: '=', variant: VARIANT_KEYS.equals, onClick: calculate }
  ], [angleMode, ans, backspace, calculate, clearAll, clearEntry, compact, currentValue, insert, memoryValue, secondary, toggleSign]);

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === '=') {
      event.preventDefault();
      calculate();
      return;
    }
    if (event.key === 'Escape') {
      event.stopPropagation();
      clearAll();
    }
  };

  const handleChange = (event) => {
    // Keep only characters the parser understands.
    const cleaned = event.target.value.replace(/[^0-9a-zA-Z.+\-*/^()!%×÷−√∛π ]/g, '');
    setExpression(cleaned);
    setError('');
  };

  return (
    <Box sx={{ width: '100%' }}>
      {/* Status bar */}
      <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 0.75 }}>
        <Chip
          size="small"
          label={angleMode}
          onClick={() => updateState({ angleMode: angleMode === 'DEG' ? 'RAD' : 'DEG' })}
          sx={{ height: 20, fontSize: 10, fontWeight: 700 }}
          color="primary"
          variant="outlined"
        />
        {memoryValue !== null && (
          <Tooltip title="Number stored in memory - press MR to use it">
            <Chip
              size="small"
              label={`M ${formatNumber(memoryValue)}`}
              onClick={() => insert(formatNumber(memoryValue))}
              sx={{ height: 20, fontSize: 10, maxWidth: 110 }}
              color="secondary"
              variant="outlined"
            />
          </Tooltip>
        )}
        <Box sx={{ flexGrow: 1 }} />
        <Tooltip title="Save this number for later">
          <span>
            <IconButton size="small" onClick={saveNumber} sx={{ p: 0.4 }}>
              <BookmarkAdd sx={{ fontSize: 18 }} />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Calculation history">
          <span>
            <IconButton
              size="small"
              onClick={() => setShowHistory((value) => !value)}
              color={showHistory ? 'primary' : 'default'}
              sx={{ p: 0.4 }}
            >
              <History sx={{ fontSize: 18 }} />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>

      {/* Display */}
      <Box
        sx={{
          bgcolor: isDark ? alpha(theme.palette.common.black, 0.4) : theme.palette.grey[50],
          border: '1px solid',
          borderColor: error ? 'error.main' : 'divider',
          borderRadius: 1,
          px: 1,
          py: 0.5,
          mb: 0.75
        }}
      >
        <TextField
          inputRef={inputRef}
          value={expression}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          variant="standard"
          fullWidth
          placeholder="0"
          autoComplete="off"
          spellCheck={false}
          InputProps={{ disableUnderline: true }}
          inputProps={{
            'aria-label': 'Calculator expression',
            style: {
              textAlign: 'right',
              fontFamily: 'monospace',
              fontWeight: 700,
              fontSize: compact ? '1.05rem' : '1.35rem',
              padding: 0
            }
          }}
        />
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            textAlign: 'right',
            minHeight: 16,
            color: error ? 'error.main' : 'text.secondary',
            fontFamily: 'monospace'
          }}
        >
          {error || (preview ? `= ${preview}` : ans !== null && ans !== undefined ? `Ans = ${formatNumber(ans)}` : '')}
        </Typography>
      </Box>

      {/* Saved numbers */}
      <Box sx={{ mb: 0.75 }}>
        <Stack
          direction="row"
          spacing={0.5}
          alignItems="center"
          sx={{ overflowX: 'auto', pb: 0.25, '&::-webkit-scrollbar': { height: 4 } }}
        >
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', flexShrink: 0 }}>
            Saved:
          </Typography>
          {(saved || []).length === 0 ? (
            <Typography variant="caption" sx={{ color: 'text.disabled', flexShrink: 0 }}>
              tap the bookmark to keep a result
            </Typography>
          ) : (
            <>
              {saved.map((item) => (
                <Chip
                  key={item.id}
                  size="small"
                  label={formatNumber(item.value)}
                  onClick={() => insert(formatNumber(item.value))}
                  onDelete={() => updateState({ saved: saved.filter((entry) => entry.id !== item.id) })}
                  sx={{ height: 22, fontSize: 11, fontFamily: 'monospace', flexShrink: 0 }}
                />
              ))}
              <Tooltip title="Remove all saved numbers">
                <IconButton size="small" onClick={() => updateState({ saved: [] })} sx={{ p: 0.3, flexShrink: 0 }}>
                  <DeleteSweep sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </>
          )}
        </Stack>
      </Box>

      {/* History */}
      {showHistory && (
        <Box
          sx={{
            mb: 0.75,
            maxHeight: 130,
            overflowY: 'auto',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            p: 0.5
          }}
        >
          {(history || []).length === 0 ? (
            <Typography variant="caption" color="text.disabled">
              No calculations yet.
            </Typography>
          ) : (
            <>
              {history.map((item) => (
                <Box
                  key={item.id}
                  onClick={() => insert(item.result)}
                  sx={{
                    cursor: 'pointer',
                    px: 0.5,
                    py: 0.25,
                    borderRadius: 0.5,
                    '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.08) }
                  }}
                  title="Click to use this result"
                >
                  <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', fontFamily: 'monospace' }}>
                    {item.expression}
                  </Typography>
                  <Typography variant="caption" sx={{ display: 'block', textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>
                    = {item.result}
                  </Typography>
                </Box>
              ))}
              <Button size="small" fullWidth onClick={() => updateState({ history: [] })} sx={{ fontSize: 11, textTransform: 'none' }}>
                Clear history
              </Button>
            </>
          )}
        </Box>
      )}

      {/* Keypad */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: compact ? 0.4 : 0.6 }}>
        {keys.map((key, index) => {
          const button = (
            <Button
              onMouseDown={(event) => event.preventDefault()}
              onClick={key.onClick}
              disabled={key.disabled}
              aria-label={key.ariaLabel || (typeof key.label === 'string' ? key.label : undefined)}
              sx={keyStyles(key.variant)}
            >
              {key.label}
            </Button>
          );
          return key.title ? (
            <Tooltip key={index} title={key.title} enterDelay={600}>
              <span style={{ display: 'grid' }}>{button}</span>
            </Tooltip>
          ) : <React.Fragment key={index}>{button}</React.Fragment>;
        })}
      </Box>
    </Box>
  );
};

export default CalculatorPanel;

/* -------------------------------------------------------------------------- */
/*  Dialog wrapper                                                              */
/* -------------------------------------------------------------------------- */

export const CalculatorDialog = ({ open, onClose, title = 'Scientific Calculator' }) => (
  <Dialog
    open={open}
    onClose={onClose}
    maxWidth="xs"
    fullWidth
    aria-labelledby="calculator-dialog-title"
    sx={{ '& .MuiDialog-paper': { maxWidth: 400, width: '100%', m: 1 } }}
  >
    <Box
      id="calculator-dialog-title"
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        bgcolor: 'primary.main',
        color: 'primary.contrastText',
        px: 1.5,
        py: 1
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <Calculate sx={{ fontSize: 20 }} />
        <Typography variant="subtitle2" fontWeight="bold">{title}</Typography>
      </Box>
      <IconButton onClick={onClose} size="small" sx={{ color: 'inherit' }} aria-label="Close calculator">
        <Close sx={{ fontSize: 20 }} />
      </IconButton>
    </Box>
    <DialogContent sx={{ p: 1.25 }}>
      <CalculatorPanel />
    </DialogContent>
  </Dialog>
);

/* -------------------------------------------------------------------------- */
/*  Draggable floating wrapper                                                  */
/* -------------------------------------------------------------------------- */

export const DraggableCalculator = ({ open, onClose }) => {
  const [minimized, setMinimized] = useState(false);
  const [position, setPosition] = useState(null);
  const boxRef = useRef(null);
  const dragRef = useRef(null);

  const handlePointerDown = (event) => {
    const node = boxRef.current;
    if (!node || event.button === 2) return;
    const rect = node.getBoundingClientRect();
    dragRef.current = { offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top };
    setPosition({ x: rect.left, y: rect.top });
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch (error) {
      /* pointer capture is best effort */
    }
  };

  const handlePointerMove = (event) => {
    const drag = dragRef.current;
    const node = boxRef.current;
    if (!drag || !node) return;
    event.preventDefault();
    const rect = node.getBoundingClientRect();
    const maxX = Math.max(0, window.innerWidth - rect.width);
    const maxY = Math.max(0, window.innerHeight - rect.height);
    setPosition({
      x: Math.min(Math.max(0, event.clientX - drag.offsetX), maxX),
      y: Math.min(Math.max(0, event.clientY - drag.offsetY), maxY)
    });
  };

  const handlePointerUp = (event) => {
    dragRef.current = null;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch (error) {
      /* pointer capture is best effort */
    }
  };

  if (!open) return null;

  if (minimized) {
    return (
      <Box
        onClick={() => setMinimized(false)}
        role="button"
        aria-label="Open calculator"
        sx={{
          position: 'fixed',
          bottom: 20,
          right: 20,
          zIndex: 9999,
          bgcolor: 'primary.main',
          borderRadius: '50%',
          width: 56,
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: 4,
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          '&:hover': { transform: 'scale(1.1)', boxShadow: 6 }
        }}
      >
        <Calculate sx={{ color: 'white', fontSize: 28 }} />
      </Box>
    );
  }

  return (
    <Box
      ref={boxRef}
      sx={{
        position: 'fixed',
        top: position ? position.y : '50%',
        left: position ? position.x : '50%',
        transform: position ? 'none' : 'translate(-50%, -50%)',
        zIndex: 9999,
        width: { xs: 300, sm: 340 },
        maxWidth: 'calc(100vw - 16px)',
        maxHeight: 'calc(100vh - 16px)',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.paper',
        borderRadius: 2,
        boxShadow: 8,
        border: '2px solid',
        borderColor: 'primary.main',
        overflow: 'hidden'
      }}
    >
      <Box
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        sx={{
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          p: 0.75,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'move',
          touchAction: 'none',
          userSelect: 'none'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Calculate sx={{ mr: 0.5, fontSize: 16 }} />
          <Typography variant="body2" fontWeight="bold" sx={{ fontSize: 13 }}>
            Calculator
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 0.25 }}>
          <IconButton
            onClick={() => setMinimized(true)}
            size="small"
            sx={{ color: 'inherit', p: 0.5, '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}
            title="Minimize"
          >
            <ExpandLess sx={{ fontSize: 18 }} />
          </IconButton>
          <IconButton
            onClick={onClose}
            size="small"
            sx={{ color: 'inherit', p: 0.5, '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}
            title="Close"
          >
            <Close sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>
      </Box>

      <Box sx={{ p: 0.75, overflowY: 'auto' }}>
        <CalculatorPanel compact />
      </Box>
    </Box>
  );
};
