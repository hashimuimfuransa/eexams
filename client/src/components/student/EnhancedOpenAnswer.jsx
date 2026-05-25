import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Box,
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
} from '@mui/material';
import {
  Functions,
  Edit,
  KeyboardAlt,
  InfoOutlined,
  CheckCircleOutline,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import 'mathlive';

/* ─── Tokens ─────────────────────────────────────────────── */
const TOKEN = {
  radius: '6px',
  transition: 'all 0.18s ease',
  fontMono: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
  fontSans: "'IBM Plex Sans', 'Segoe UI', sans-serif",
};

/* ─── Quick-insert symbol groups ─────────────────────────── */
const SYMBOL_GROUPS = [
  {
    label: 'Greek',
    symbols: [
      { label: 'α', latex: '\\alpha' },
      { label: 'β', latex: '\\beta' },
      { label: 'γ', latex: '\\gamma' },
      { label: 'δ', latex: '\\delta' },
      { label: 'θ', latex: '\\theta' },
      { label: 'λ', latex: '\\lambda' },
      { label: 'μ', latex: '\\mu' },
      { label: 'π', latex: '\\pi' },
      { label: 'σ', latex: '\\sigma' },
      { label: 'φ', latex: '\\phi' },
      { label: 'ω', latex: '\\omega' },
      { label: 'Σ', latex: '\\Sigma' },
      { label: 'Δ', latex: '\\Delta' },
      { label: 'Ω', latex: '\\Omega' },
    ],
  },
  {
    label: 'Operations',
    symbols: [
      { label: '↵ line', latex: '\\\\ ' },
      { label: '√', latex: '\\sqrt{}' },
      { label: '∛', latex: '\\sqrt[3]{}' },
      { label: 'xⁿ', latex: '^{}' },
      { label: 'xₙ', latex: '_{}' },
      { label: '∫', latex: '\\int_{}^{}' },
      { label: '∮', latex: '\\oint' },
      { label: '∑', latex: '\\sum_{}^{}' },
      { label: '∏', latex: '\\prod_{}^{}' },
      { label: 'lim', latex: '\\lim_{}' },
      { label: 'log', latex: '\\log' },
      { label: 'ln', latex: '\\ln' },
      { label: 'd/dx', latex: '\\frac{d}{dx}' },
      { label: '∂', latex: '\\partial' },
      { label: 'a/b', latex: '\\frac{}{}' },
    ],
  },
  {
    label: 'Relations',
    symbols: [
      { label: '≤', latex: '\\leq' },
      { label: '≥', latex: '\\geq' },
      { label: '≠', latex: '\\neq' },
      { label: '≈', latex: '\\approx' },
      { label: '≡', latex: '\\equiv' },
      { label: '∝', latex: '\\propto' },
      { label: '∞', latex: '\\infty' },
      { label: '±', latex: '\\pm' },
      { label: '∈', latex: '\\in' },
      { label: '∉', latex: '\\notin' },
      { label: '⊂', latex: '\\subset' },
      { label: '∪', latex: '\\cup' },
      { label: '∩', latex: '\\cap' },
      { label: '→', latex: '\\rightarrow' },
    ],
  },
  {
    label: 'Vectors & Matrices',
    symbols: [
      { label: 'vec', latex: '\\vec{}' },
      { label: 'hat', latex: '\\hat{}' },
      { label: '·', latex: '\\cdot' },
      { label: '×', latex: '\\times' },
      { label: '|x|', latex: '\\left|{}\\right|' },
      { label: '||x||', latex: '\\left\\|{}\\right\\|' },
      { label: 'matrix', latex: '\\begin{pmatrix} & \\\\ & \\end{pmatrix}' },
      { label: 'det', latex: '\\det' },
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
  borderBottom: `1px solid ${theme.palette.divider}`,
  padding: '6px 12px',
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
  fontFamily: TOKEN.fontMono,
  fontSize: '0.875rem',
  padding: '3px 8px',
  borderRadius: 4,
  border: `1px solid ${theme.palette.divider}`,
  background: theme.palette.background.paper,
  color: theme.palette.text.primary,
  cursor: 'pointer',
  transition: TOKEN.transition,
  lineHeight: 1.5,
  '&:hover': {
    background: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    borderColor: theme.palette.primary.main,
    transform: 'translateY(-1px)',
    boxShadow: `0 2px 8px ${theme.palette.primary.main}44`,
  },
  '&:active': { transform: 'none' },
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

/* ─── Main Component ─────────────────────────────────────── */
const EnhancedOpenAnswer = ({ question, answer, onAnswerChange, disabled, answerRef }) => {
  const [activeTab, setActiveTab] = useState(0);
  const [mathValue, setMathValue] = useState('');
  const [textValue, setTextValue] = useState(answer?.textAnswer || '');
  const [activeGroup, setActiveGroup] = useState(SYMBOL_GROUPS[0].label);
  const [mathReady, setMathReady] = useState(false);
  const mathfieldRef = useRef(null);

  // Reset local state when the question changes
  useEffect(() => {
    setTextValue(answer?.textAnswer || '');
    setMathValue('');
    setActiveTab(0);
  }, [question._id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Expose a method to get the current combined answer
  useEffect(() => {
    if (answerRef) {
      answerRef.current = () => {
        let combined = '';
        if (mathValue) combined += `[MATH: ${mathValue}] `;
        if (textValue) combined += textValue;
        return combined || '';
      };
    }
  }, [mathValue, textValue, answerRef]);

  const updateCombined = useCallback(
    (math, text) => {
      let combined = '';
      if (math) combined += `[MATH: ${math}] `;
      if (text) combined += text;
      onAnswerChange(question._id, combined || '', question.type);
    },
    [question._id, question.type, onAnswerChange]
  );

  /* Set up math-field listeners once it mounts */
  useEffect(() => {
    const mf = mathfieldRef.current;
    if (!mf) return;

    const onInput = (e) => {
      const val = e.target.value ?? '';
      setMathValue(val);
      // Don't call updateCombined on every keystroke to prevent typing interruption
    };

    // Allow Enter to insert a new line (\\) in the math field so students
    // can answer multi-part questions on separate lines.
    const onKeyDown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        // Insert a LaTeX line-break; MathLive renders \\ as a new row
        mf.executeCommand(['insert', '\\\\ ']);
        const val = mf.value ?? '';
        setMathValue(val);
        // Don't call updateCombined on every keystroke to prevent typing interruption
      }
    };

    mf.addEventListener('input', onInput);
    mf.addEventListener('keydown', onKeyDown);
    setMathReady(true);

    return () => {
      mf.removeEventListener('input', onInput);
      mf.removeEventListener('keydown', onKeyDown);
    };
  }, [activeTab]); // re-bind when switching to math tab

  /* Insert a LaTeX snippet at the math-field cursor */
  const insertSymbol = (latex) => {
    const mf = mathfieldRef.current;
    if (!mf) return;
    mf.focus();
    mf.executeCommand(['insert', latex]);
    const val = mf.value ?? '';
    setMathValue(val);
    // Don't call updateCombined on symbol insert to prevent interruption
  };

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
    updateCombined(mathValue, textValue);
    setActiveTab(newValue);
  };

  const isSection = question?.section;
  const rows = isSection === 'C' ? 12 : 6;
  const recommended = isSection === 'C' ? 300 : null;
  const hasContent = mathValue.trim() || textValue.trim();

  return (
    <Box sx={{ mt: 2 }}>
      <Shell elevation={0}>
        {/* ── Tab bar ── */}
        <TabBar value={activeTab} onChange={handleTabChange}>
          <Tab icon={<Edit fontSize="small" />} label="Written Answer" iconPosition="start" />
          <Tab icon={<Functions fontSize="small" />} label="Math / Equations" iconPosition="start" />
        </TabBar>

        {/* ── Math symbol palette (math tab only) ── */}
        {activeTab === 1 && (
          <SymbolBar>
            {/* Group selector chips */}
            <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
              <Box sx={{ display: 'flex', gap: 0.75, mb: 1, flexWrap: 'wrap' }}>
                {SYMBOL_GROUPS.map((g) => (
                  <Chip
                    key={g.label}
                    label={g.label}
                    size="small"
                    variant={activeGroup === g.label ? 'filled' : 'outlined'}
                    color={activeGroup === g.label ? 'primary' : 'default'}
                    onClick={() => setActiveGroup(g.label)}
                    sx={{
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      fontFamily: TOKEN.fontSans,
                      height: 24,
                      cursor: 'pointer',
                    }}
                  />
                ))}
              </Box>
              {/* Symbol buttons for active group */}
              {SYMBOL_GROUPS.filter((g) => g.label === activeGroup).map((g) => (
                <Box key={g.label} sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {g.symbols.map((s) => (
                    <Tooltip key={s.latex} title={<code>{s.latex}</code>} arrow placement="top">
                      <SymBtn
                        type="button"
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
        )}

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
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <KeyboardAlt fontSize="small" sx={{ color: 'text.secondary' }} />
                <Typography variant="caption" color="text.secondary" sx={{ fontFamily: TOKEN.fontSans }}>
                  Press <Box component="kbd" sx={{ px: 0.6, py: 0.1, borderRadius: '3px', border: '1px solid', borderColor: 'divider', bgcolor: 'background.default', fontFamily: TOKEN.fontMono, fontSize: '0.7rem' }}>Enter</Box> for a new line · Use the palette for quick inserts · Type LaTeX directly
                </Typography>
                <Tooltip
                  title="This editor accepts LaTeX. E.g. \frac{1}{2}, \sqrt{x}, x^{2}. Use the symbol palette for common symbols."
                  arrow
                >
                  <InfoOutlined sx={{ fontSize: 15, color: 'text.disabled', ml: 'auto', cursor: 'help' }} />
                </Tooltip>
              </Box>

              <MathFieldWrapper>
                <math-field
                  ref={mathfieldRef}
                  id={`math-input-${question._id}`}
                  virtual-keyboard-mode="onfocus"
                  smart-mode
                  smart-fence
                  smart-superscript
                  default-mode="math"
                >{mathValue}</math-field>
              </MathFieldWrapper>

              <StatusRow>
                <Typography variant="caption" color="text.disabled" sx={{ fontFamily: TOKEN.fontMono, fontSize: '0.7rem' }}>
                  {mathValue ? `LaTeX: ${mathValue.slice(0, 60)}${mathValue.length > 60 ? '…' : ''}` : 'No equation entered'}
                </Typography>
                {mathValue && (
                  <CheckCircleOutline sx={{ fontSize: 16, color: 'success.main' }} />
                )}
              </StatusRow>

              {/* LaTeX cheat row */}
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
                  <Typography variant="caption" color="text.secondary" sx={{ fontFamily: TOKEN.fontSans, display: 'block', mb: 0.5, fontWeight: 600 }}>
                    LaTeX quick reference
                  </Typography>
                  {[
                    ['Fraction', '\\frac{a}{b}'],
                    ['Square root', '\\sqrt{x}'],
                    ['Power', 'x^{2}'],
                    ['Subscript', 'x_{n}'],
                    ['Integral', '\\int_{a}^{b} f(x)\\,dx'],
                  ].map(([name, code]) => (
                    <Box key={name} sx={{ display: 'flex', gap: 1, alignItems: 'baseline', mb: 0.25 }}>
                      <Typography variant="caption" color="text.disabled" sx={{ width: 80, flexShrink: 0, fontFamily: TOKEN.fontSans }}>
                        {name}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ fontFamily: TOKEN.fontMono, fontSize: '0.75rem', color: 'primary.main', cursor: 'pointer' }}
                        onClick={() => insertSymbol(code)}
                      >
                        {code}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Collapse>
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
          Answer recorded.{mathValue && textValue ? ' Written answer + equation saved.' : mathValue ? ' Equation saved.' : ' Written answer saved.'}
        </Alert>
      )}
    </Box>
  );
};

export default EnhancedOpenAnswer;