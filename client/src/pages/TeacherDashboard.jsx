import { useState, useRef, useEffect, useCallback, memo } from 'react';
import { getImageUrl } from '../utils/getImageUrl';
import { useNavigate } from 'react-router-dom';
import useUpload from '../hooks/useUpload';
import UploadProgress from '../components/UploadProgress';
import {
  Box, Typography, Chip, Button, Paper, Grid, TextField,
  CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  InputAdornment, useMediaQuery, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, LinearProgress,
  IconButton, Tooltip, Avatar, Select, MenuItem, FormControl, InputLabel, FormHelperText,
  Tabs, Tab, Alert, Snackbar, Accordion, AccordionSummary, AccordionDetails,
  Divider, Checkbox, ListItemText, Radio, FormControlLabel, RadioGroup
} from '@mui/material';
import {
  AutoAwesome, CloudUpload, Assignment, People, BarChart, Settings,
  CheckCircle, Add, Publish, Share, Description,
  DashboardCustomize, FormatListNumbered, ShortText, ToggleOn,
  FileUpload, TrendingUp, ArrowForward, ArrowUpward, ArrowDownward,
  Quiz, ListAlt, NoteAlt, Edit, ContentCopy, Download,
  Search, FilterList, Refresh, CheckCircleOutline,
  ErrorOutline, HourglassEmpty, PlayArrow, SaveAlt, Close,
  ExpandMore, ExpandLess, Delete, RadioButtonChecked, CheckBox,
  DragIndicator, SwapVert, Mic, MicOff, Stop, RestartAlt, Visibility, VisibilityOff, LockReset, Info, Article
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { tokens, gradients } from './dashboardTokens';
import { DashboardShell, Sidebar, Topbar, SectionTitle, W, getDynamicGreeting } from './DashboardShell';
import StudentManagement from '../components/teacher/StudentManagement';
import MarketplaceManager from '../components/teacher/MarketplaceManager';
import usePlan from '../hooks/usePlan';
import SubscriptionWarning from '../components/SubscriptionWarning';

// Memoized StudentRow component to prevent unnecessary re-renders
const StudentRow = memo(({ row, index, fields, onUpdate, onRemove, disabled, canRemove }) => {
  console.log('StudentRow render:', { index, row, disabled, canRemove });
  return (
    <TableRow key={row.id || index}>
      {fields.map(f => (
        <TableCell sx={{ py: 0.5, px: 0.75 }}>
          <TextField 
            fullWidth 
            size="small" 
            value={row[f]} 
            onChange={e => {
              console.log('TextField onChange:', { index, field: f, value: e.target.value });
              onUpdate(index, f, e.target.value);
            }}
            disabled={disabled}
            placeholder={f === 'email' ? 'student@email.com' : f === 'class' ? 'e.g. 10A' : ''}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5, fontSize: 12 } }} 
            inputProps={{ autoComplete: 'off' }}
          />
        </TableCell>
      ))}
      <TableCell sx={{ py: 0.5 }}>
        <IconButton 
          size="small" 
          onClick={() => onRemove(index)} 
          disabled={disabled || !canRemove} 
          sx={{ color: tokens.danger }}
        >
          <Delete fontSize="small" />
        </IconButton>
      </TableCell>
    </TableRow>
  );
});

// Question Editor Component for Generated Exams
const GeneratedQuestionEditor = ({ question, index, onUpdate, onDelete, isMobile, sections, onSectionChange }) => {
  const [expanded, setExpanded] = useState(false);
  const [edited, setEdited] = useState(false);
  const [localQ, setLocalQ] = useState(question);

  const qType = localQ.type || 'multiple-choice';
  const typeColors = {
    'multiple-choice': '#3B82F6',
    'true-false': '#8B5CF6',
    'fill-blank': '#F59E0B',
    'fill-in-blank': '#F59E0B',
    'open-ended': '#EC4899',
    'short-answer': '#8B5CF6',
    'essay': '#F59E0B',
    'matching': '#10B981',
    'ordering': '#6366F1'
  };
  const typeIcons = {
    'multiple-choice': <RadioButtonChecked sx={{ fontSize: 14 }} />,
    'true-false': <CheckBox sx={{ fontSize: 14 }} />,
    'fill-blank': <ShortText sx={{ fontSize: 14 }} />,
    'fill-in-blank': <ShortText sx={{ fontSize: 14 }} />,
    'open-ended': <FormatListNumbered sx={{ fontSize: 14 }} />,
    'short-answer': <ShortText sx={{ fontSize: 14 }} />,
    'essay': <Article sx={{ fontSize: 14 }} />,
    'matching': <FormatListNumbered sx={{ fontSize: 14 }} />,
    'ordering': <FormatListNumbered sx={{ fontSize: 14 }} />
  };

  const handleSave = () => {
    onUpdate(localQ);
    setEdited(false);
  };

  const handleCancel = () => {
    setLocalQ(question);
    setEdited(false);
  };

  // Helper to get option display text (handles both string and object formats)
  const getOptionText = (opt) => {
    if (typeof opt === 'string') return opt;
    if (opt && typeof opt === 'object') return opt.text || opt.label || opt.value || '';
    return '';
  };

  const updateOption = (idx, value) => {
    const newOptions = [...(localQ.options || [])];
    const currentOpt = newOptions[idx];
    // Preserve object structure if it exists, otherwise use string
    if (currentOpt && typeof currentOpt === 'object') {
      newOptions[idx] = { ...currentOpt, text: value };
    } else {
      newOptions[idx] = value;
    }
    setLocalQ({ ...localQ, options: newOptions });
    setEdited(true);
  };

  const addOption = () => {
    const currentOptions = localQ.options || [];
    const newOption = { 
      text: `Option ${String.fromCharCode(65 + currentOptions.length)}`, 
      isCorrect: false, 
      letter: String.fromCharCode(65 + currentOptions.length) 
    };
    setLocalQ({ ...localQ, options: [...currentOptions, newOption] });
    setEdited(true);
  };

  const removeOption = (idx) => {
    const newOptions = (localQ.options || []).filter((_, i) => i !== idx);
    setLocalQ({ ...localQ, options: newOptions });
    setEdited(true);
  };

  return (
    <Paper elevation={0} sx={{ border: `1px solid ${edited ? '#F59E0B' : tokens.surfaceBorder}`, borderRadius: 2, transition: 'all 0.2s' }}>
      {/* Header - Always visible */}
      <Box 
        sx={{ 
          p: 1.5, 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1.5,
          cursor: 'pointer',
          bgcolor: expanded ? '#F8FAFC' : 'white',
          '&:hover': { bgcolor: '#F8FAFC' }
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <Chip 
          label={`Q${index + 1}`} 
          size="small" 
          sx={{ 
            bgcolor: `${typeColors[qType]}15`, 
            color: typeColors[qType], 
            fontWeight: 700,
            minWidth: 45
          }} 
        />
        {sections && sections.length > 0 && (
          <FormControl size="small" sx={{ minWidth: 100 }}>
            <InputLabel>Section</InputLabel>
            <Select
              value={localQ.section || 'A'}
              label="Section"
              onChange={(e) => {
                const newSection = e.target.value;
                setLocalQ({ ...localQ, section: newSection });
                setEdited(true);
                if (onSectionChange) {
                  onSectionChange(index, newSection);
                }
              }}
              onClick={(e) => e.stopPropagation()}
              sx={{ borderRadius: 2, '& .MuiSelect-select': { fontSize: 11, py: 0.5 } }}
            >
              {sections.map((s, idx) => (
                <MenuItem key={idx} value={s.name} sx={{ fontSize: 11 }}>
                  Section {s.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
        <Box sx={{ flexGrow: 1, minWidth: 0, maxWidth: isMobile ? 'calc(100% - 80px)' : 'auto' }}>
          <Typography variant="body2" sx={{ fontFamily: "DM Sans,sans-serif", fontWeight: 500, fontSize: isMobile ? 12 : 14 }} noWrap={!expanded}>
            {localQ.text || 'Untitled Question'}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: isMobile ? 0.5 : 1, mt: 0.25, flexWrap: 'wrap' }}>
            {localQ.subsectionTitle && (
              <Chip label={localQ.subsectionTitle} size="small" sx={{ height: 16, fontSize: 9, bgcolor: '#E0E7FF', color: '#3730A3', fontWeight: 600 }} />
            )}
            {localQ.wordBank && localQ.wordBank.length > 0 && (
              <Chip label="Word Bank" size="small" sx={{ height: 16, fontSize: 9, bgcolor: '#DCFCE7', color: '#166534', fontWeight: 600 }} />
            )}
            {localQ.passage && (
              <Chip label="Passage" size="small" sx={{ height: 16, fontSize: 9, bgcolor: '#DBEAFE', color: '#1E40AF', fontWeight: 600 }} />
            )}
            {localQ.subQuestions && Array.isArray(localQ.subQuestions) && localQ.subQuestions.length > 0 && (
              <Chip label={`${localQ.subQuestions.length} Sub-Q${localQ.subQuestions.length > 1 ? 's' : ''}`} size="small" sx={{ height: 16, fontSize: 9, bgcolor: '#DCFCE7', color: '#166534', fontWeight: 600 }} />
            )}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: tokens.textMuted, fontSize: isMobile ? 10 : 11 }}>
              {typeIcons[qType]}
              <span style={{ textTransform: 'capitalize', fontSize: isMobile ? 9 : 11 }}>{qType.replace('-', ' ')}</span>
            </Box>
            <Typography sx={{ fontSize: isMobile ? 10 : 11, color: tokens.textMuted }}>• {localQ.marks || 1}m</Typography>
            {/* Show MCQ options preview in collapsed view */}
            {qType === 'multiple-choice' && (localQ.options || []).length > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 0.5 }}>
                {!isMobile && <Typography sx={{ fontSize: 10, color: tokens.textMuted }}>• Options:</Typography>}
                {(localQ.options || []).slice(0, 4).map((opt, idx) => (
                  isMobile ? (
                    <Chip 
                      key={idx}
                      label={String.fromCharCode(65 + idx)} 
                      size="small" 
                      sx={{ 
                        height: 16, 
                        minWidth: 18, 
                        fontSize: 8, 
                        fontWeight: 800, 
                        bgcolor: opt.isCorrect || opt.correct ? `${typeColors[qType]}50` : `${typeColors[qType]}20`, 
                        color: typeColors[qType],
                        border: opt.isCorrect || opt.correct ? `1.5px solid ${typeColors[qType]}` : `1px solid ${typeColors[qType]}40`,
                      }} 
                    />
                  ) : (
                    <Tooltip key={idx} title={getOptionText(opt) || `Option ${String.fromCharCode(65 + idx)}`} arrow>
                      <Chip 
                        label={String.fromCharCode(65 + idx)} 
                        size="small" 
                        sx={{ 
                          height: 18, 
                          minWidth: 22, 
                          fontSize: 9, 
                          fontWeight: 700, 
                          bgcolor: opt.isCorrect || opt.correct ? `${typeColors[qType]}40` : `${typeColors[qType]}15`, 
                          color: typeColors[qType],
                          border: opt.isCorrect || opt.correct ? `2px solid ${typeColors[qType]}` : `1px solid ${typeColors[qType]}30`,
                          cursor: 'pointer'
                        }} 
                      />
                    </Tooltip>
                  )
                ))}
              </Box>
            )}
            {/* Show correct answer indicator */}
            {localQ.correctAnswer && (
              <Chip 
                label={`Answer: ${localQ.correctAnswer.slice(0, 15)}${localQ.correctAnswer.length > 15 ? '...' : ''}`} 
                size="small" 
                sx={{ height: 16, fontSize: 9, bgcolor: '#DBEAFE', color: '#1E40AF', fontWeight: 600 }} 
              />
            )}
            {edited && <Chip label="Modified" size="small" sx={{ height: 16, fontSize: 9, bgcolor: '#FEF3C7', color: '#D97706', fontWeight: 600 }} />}
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {edited ? (
            <>
              <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleSave(); }} sx={{ color: tokens.accent }}>
                <CheckCircleOutline sx={{ fontSize: 18 }} />
              </IconButton>
              <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleCancel(); }} sx={{ color: '#EF4444' }}>
                <Close sx={{ fontSize: 18 }} />
              </IconButton>
            </>
          ) : (
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }} sx={{ color: tokens.textMuted }}>
              {expanded ? <ExpandLess sx={{ fontSize: 18 }} /> : <ExpandMore sx={{ fontSize: 18 }} />}
            </IconButton>
          )}
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); onDelete(); }} sx={{ color: '#EF4444', ml: 0.5 }}>
            <Delete sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>
      </Box>

      {/* Expanded Editor - Improved Layout */}
      {expanded && (
        <Box sx={{ p: isMobile ? 2 : 2.5, pt: 2, bgcolor: '#F8FAFC', borderTop: `2px solid ${typeColors[qType]}40` }}>
          {/* Section Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, pb: 1.5, borderBottom: `1px dashed ${tokens.surfaceBorder}` }}>
            <Box sx={{ color: typeColors[qType], display: 'flex', alignItems: 'center' }}>
              {typeIcons[qType]}
            </Box>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: tokens.textPrimary, textTransform: 'capitalize' }}>
              {qType.replace('-', ' ')} Question Editor
            </Typography>
          </Box>

          {/* Display Context Information (Passage, Word Bank, Instructions) */}
          {localQ.passage && (
            <Box sx={{ mb: 2, p: 1.5, bgcolor: '#EFF6FF', borderRadius: 2, border: '1px solid #BFDBFE' }}>
              <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#1E40AF', mb: 0.5, textTransform: 'uppercase' }}>
                📖 Passage
              </Typography>
              <Typography sx={{ fontSize: 12, color: '#1E3A8A', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                {localQ.passage}
              </Typography>
            </Box>
          )}
          
          {localQ.wordBank && localQ.wordBank.length > 0 && (
            <Box sx={{ mb: 2, p: 1.5, bgcolor: '#F0FDF4', borderRadius: 2, border: '1px solid #BBF7D0' }}>
              <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#166534', mb: 0.5, textTransform: 'uppercase' }}>
                📝 Word Bank
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {localQ.wordBank.map((word, idx) => (
                  <Chip key={idx} label={word} size="small" sx={{ bgcolor: '#DCFCE7', color: '#166534', fontSize: 11, fontWeight: 600 }} />
                ))}
              </Box>
            </Box>
          )}
          
          {localQ.instructions && (
            <Box sx={{ mb: 2, p: 1.5, bgcolor: '#FEF3C7', borderRadius: 2, border: '1px solid #FDE68A' }}>
              <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#92400E', mb: 0.5, textTransform: 'uppercase' }}>
                ℹ️ Instructions
              </Typography>
              <Typography sx={{ fontSize: 12, color: '#78350F', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                {localQ.instructions}
              </Typography>
            </Box>
          )}

          {localQ.subsectionTitle && (
            <Box sx={{ mb: 2 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: tokens.textSecondary, textTransform: 'uppercase' }}>
                Subsection
              </Typography>
              <Typography sx={{ fontSize: 13, color: tokens.textPrimary, fontWeight: 600 }}>
                {localQ.subsectionTitle}
              </Typography>
            </Box>
          )}

          <Grid container spacing={2.5}>
            {/* Question Text - Full Width */}
            <Grid item xs={12}>
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: tokens.textSecondary, mb: 0.75, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Question Text *
              </Typography>
              <TextField
                fullWidth
                size="small"
                placeholder="Enter the question here..."
                multiline
                minRows={3}
                maxRows={6}
                value={localQ.text || ''}
                onChange={(e) => { setLocalQ({ ...localQ, text: e.target.value }); setEdited(true); }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: 'white', fontSize: 14, lineHeight: 1.6 } }}
              />
            </Grid>

            {/* Image Upload - Available for all question types */}
            <Grid item xs={12}>
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: tokens.textSecondary, mb: 0.75, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Question Image (Optional)
              </Typography>
              {localQ.imageUrl || localQ.image ? (
                <Box sx={{ position: 'relative', width: '100%', maxWidth: 400 }}>
                  <Box
                    component="img"
                    src={getImageUrl(localQ.imageUrl || localQ.image)}
                    alt="Question image"
                    sx={{ width: '100%', borderRadius: 2, maxHeight: 300, objectFit: 'contain' }}
                  />
                  <Button
                    size="small"
                    variant="contained"
                    color="error"
                    onClick={() => { setLocalQ({ ...localQ, image: null, imageUrl: '' }); setEdited(true); }}
                    sx={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      borderRadius: 2,
                      minWidth: 'auto',
                      px: 1
                    }}
                  >
                    <Delete fontSize="small" />
                  </Button>
                </Box>
              ) : (
                <Box
                  sx={{
                    border: `1px dashed ${tokens.surfaceBorder}`,
                    borderRadius: 2,
                    p: 3,
                    textAlign: 'center',
                    cursor: 'pointer',
                    '&:hover': {
                      borderColor: tokens.primary,
                      backgroundColor: 'rgba(12,189,115,0.02)'
                    }
                  }}
                  component="label"
                >
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setLocalQ({
                            ...localQ,
                            image: file,
                            imageUrl: reader.result
                          });
                          setEdited(true);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    style={{ display: 'none' }}
                  />
                  <Add sx={{ fontSize: 32, color: tokens.textMuted, mb: 1 }} />
                  <Typography sx={{ fontSize: 13, color: tokens.textMuted }}>
                    Click to upload image
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: tokens.textMuted }}>
                    PNG, JPG, GIF up to 10MB
                  </Typography>
                </Box>
              )}
            </Grid>

            {/* Settings Row - Responsive: 2 cols on mobile, 4 cols on desktop */}
            <Grid item xs={12} sm={6} md={3}>
              <Typography sx={{ fontSize: isMobile ? 10 : 11, fontWeight: 700, color: tokens.textSecondary, mb: 0.75, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Question Type *
              </Typography>
              <FormControl fullWidth size="small">
                <Select
                  value={qType}
                  onChange={(e) => { setLocalQ({ ...localQ, type: e.target.value }); setEdited(true); }}
                  sx={{ borderRadius: 2, bgcolor: 'white', fontSize: isMobile ? 12 : 13 }}
                  displayEmpty
                >
                  <MenuItem value="multiple-choice" sx={{ fontSize: isMobile ? 12 : 14 }}>Multiple Choice</MenuItem>
                  <MenuItem value="true-false" sx={{ fontSize: isMobile ? 12 : 14 }}>True / False</MenuItem>
                  <MenuItem value="fill-blank" sx={{ fontSize: isMobile ? 12 : 14 }}>Fill in Blank</MenuItem>
                  <MenuItem value="short-answer" sx={{ fontSize: isMobile ? 12 : 14 }}>Short Answer</MenuItem>
                  <MenuItem value="essay" sx={{ fontSize: isMobile ? 12 : 14 }}>Essay</MenuItem>
                  <MenuItem value="open-ended" sx={{ fontSize: isMobile ? 12 : 14 }}>Open Ended</MenuItem>
                  <MenuItem value="matching" sx={{ fontSize: isMobile ? 12 : 14 }}>Matching</MenuItem>
                  <MenuItem value="ordering" sx={{ fontSize: isMobile ? 12 : 14 }}>Ordering</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} sm={3} md={2}>
              <Typography sx={{ fontSize: isMobile ? 10 : 11, fontWeight: 700, color: tokens.textSecondary, mb: 0.75, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Marks *
              </Typography>
              <TextField
                fullWidth
                size="small"
                type="number"
                inputProps={{ min: 1, max: 100 }}
                value={localQ.marks || 1}
                onChange={(e) => { setLocalQ({ ...localQ, marks: +e.target.value }); setEdited(true); }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: 'white', fontSize: isMobile ? 12 : 13 } }}
              />
            </Grid>
            <Grid item xs={6} sm={3} md={2}>
              <Typography sx={{ fontSize: isMobile ? 10 : 11, fontWeight: 700, color: tokens.textSecondary, mb: 0.75, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Difficulty
              </Typography>
              <FormControl fullWidth size="small">
                <Select
                  value={localQ.difficulty || 'medium'}
                  onChange={(e) => { setLocalQ({ ...localQ, difficulty: e.target.value }); setEdited(true); }}
                  sx={{ borderRadius: 2, bgcolor: 'white', fontSize: isMobile ? 12 : 13 }}
                >
                  <MenuItem value="easy" sx={{ fontSize: isMobile ? 12 : 14 }}>Easy</MenuItem>
                  <MenuItem value="medium" sx={{ fontSize: isMobile ? 12 : 14 }}>Medium</MenuItem>
                  <MenuItem value="hard" sx={{ fontSize: isMobile ? 12 : 14 }}>Hard</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={5}>
              <Typography sx={{ fontSize: isMobile ? 10 : 11, fontWeight: 700, color: tokens.textSecondary, mb: 0.75, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Correct Answer *
              </Typography>
              <TextField
                fullWidth
                size="small"
                placeholder={qType === 'multiple-choice' ? 'e.g., A or the correct option text' : qType === 'true-false' ? 'True or False' : 'Enter the correct answer'}
                value={localQ.correctAnswer || ''}
                onChange={(e) => { setLocalQ({ ...localQ, correctAnswer: e.target.value }); setEdited(true); }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: 'white', fontSize: isMobile ? 12 : 13 } }}
              />
            </Grid>

            {/* Options for Multiple Choice - Full Width Section */}
            {qType === 'multiple-choice' && (
              <Grid item xs={12}>
                <Box sx={{ mt: 1, p: isMobile ? 1.5 : 2, bgcolor: 'white', borderRadius: 2, border: `1px solid ${tokens.surfaceBorder}` }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: isMobile ? 1.5 : 2 }}>
                    <Typography sx={{ fontSize: isMobile ? 11 : 12, fontWeight: 700, color: tokens.textPrimary, display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <RadioButtonChecked sx={{ fontSize: isMobile ? 14 : 16, color: typeColors[qType] }} />
                      Answer Options
                    </Typography>
                    <Chip 
                      label={`${(localQ.options || []).length} options`} 
                      size="small" 
                      sx={{ height: isMobile ? 20 : 22, fontSize: isMobile ? 10 : 11, bgcolor: `${typeColors[qType]}15`, color: typeColors[qType], fontWeight: 600 }} 
                    />
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 1 : 1.25 }}>
                    {(localQ.options || ['Option A', 'Option B', 'Option C', 'Option D']).map((opt, idx) => {
                      const isCorrect = opt && (opt.isCorrect || opt.correct);
                      return (
                        <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: isMobile ? 0.75 : 1.25, p: isMobile ? 0.75 : 1, bgcolor: isCorrect ? '#DCFCE7' : '#FAFBFC', borderRadius: 1.5, border: isCorrect ? `2px solid ${tokens.accent}` : `1px solid ${tokens.surfaceBorder}` }}>
                          <Chip 
                            label={String.fromCharCode(65 + idx)} 
                            size="small" 
                            sx={{ minWidth: isMobile ? 26 : 32, height: isMobile ? 24 : 28, fontSize: isMobile ? 10 : 12, fontWeight: 800, bgcolor: isCorrect ? `${tokens.accent}30` : `${typeColors[qType]}20`, color: isCorrect ? '#166534' : typeColors[qType], border: isCorrect ? `2px solid ${tokens.accent}` : `1.5px solid ${typeColors[qType]}40` }} 
                          />
                          <TextField
                            fullWidth
                            size="small"
                            placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                            value={getOptionText(opt)}
                            onChange={(e) => updateOption(idx, e.target.value)}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5, bgcolor: 'white', fontSize: isMobile ? 12 : 13 } }}
                          />
                          <IconButton size="small" onClick={() => removeOption(idx)} sx={{ color: '#EF4444', p: isMobile ? 0.5 : 0.75 }}>
                            <Delete sx={{ fontSize: isMobile ? 16 : 18 }} />
                          </IconButton>
                        </Box>
                      );
                    })}
                    <Button 
                      variant="outlined"
                      size="small" 
                      onClick={addOption}
                      startIcon={<Add sx={{ fontSize: isMobile ? 16 : 18 }} />}
                      sx={{ mt: 1, py: isMobile ? 0.75 : 1, borderRadius: 2, textTransform: 'none', fontSize: isMobile ? 12 : 13, fontWeight: 600, borderStyle: 'dashed', borderColor: tokens.primary, color: tokens.primary, '&:hover': { bgcolor: `${tokens.primary}10`, borderStyle: 'solid' } }}
                    >
                      {isMobile ? 'Add Option' : 'Add Another Option'}
                    </Button>
                  </Box>
                </Box>
              </Grid>
            )}

            {/* Grading Criteria - for Open Ended questions */}
            {(qType === 'open-ended' || qType === 'short-answer') && (
              <Grid item xs={12}>
                <Box sx={{ p: isMobile ? 1.5 : 2, bgcolor: '#FEF3C7', borderRadius: 2, border: '1px solid #FCD34D' }}>
                  <Typography sx={{ fontSize: isMobile ? 10 : 11, fontWeight: 700, color: '#92400E', mb: 1, textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <CheckCircleOutline sx={{ fontSize: isMobile ? 12 : 14 }} />
                    Grading Criteria / Key Points
                  </Typography>
                  <Typography sx={{ fontSize: isMobile ? 11 : 12, color: '#92400E', mb: 1.5, fontStyle: 'italic' }}>
                    List specific criteria that must be present for full marks. The AI will use these to grade accurately.
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder={isMobile ? "1. Key point (2 marks)" : "e.g., 1. Defines photosynthesis (2 marks)&#10;2. Mentions chlorophyll (1 mark)&#10;3. Explains energy conversion (2 marks)&#10;4. Provides chemical equation (1 mark)"}
                    multiline
                    minRows={isMobile ? 3 : 4}
                    maxRows={8}
                    value={localQ.gradingCriteria ? (Array.isArray(localQ.gradingCriteria) ? localQ.gradingCriteria.join('\n') : localQ.gradingCriteria) : (localQ.keyPoints ? localQ.keyPoints.join('\n') : '')}
                    onChange={(e) => { 
                      const lines = e.target.value.split('\n').filter(l => l.trim());
                      setLocalQ({ ...localQ, gradingCriteria: lines, keyPoints: lines }); 
                      setEdited(true); 
                    }}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: 'white', fontSize: isMobile ? 12 : 13, lineHeight: 1.6 } }}
                  />
                </Box>
              </Grid>
            )}

            {/* Matching Question Editor */}
            {qType === 'matching' && (
              <Grid item xs={12}>
                <Box sx={{ p: isMobile ? 1.5 : 2, bgcolor: '#ECFDF5', borderRadius: 2, border: `1px solid ${typeColors[qType]}` }}>
                  <Typography sx={{ fontSize: isMobile ? 10 : 11, fontWeight: 700, color: '#065F46', mb: 1, textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <DragIndicator sx={{ fontSize: isMobile ? 12 : 14 }} />
                    Matching Pairs (Left → Right)
                  </Typography>
                  <Typography sx={{ fontSize: isMobile ? 11 : 12, color: '#047857', mb: 1.5, fontStyle: 'italic' }}>
                    Students will drag items from right to match with items on left
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {(localQ.leftItems || localQ.options?.filter((_, i) => i % 2 === 0) || []).map((item, i) => (
                      <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <TextField
                          fullWidth
                          size="small"
                          placeholder={`Left item ${i + 1}`}
                          value={typeof item === 'string' ? item : item.text}
                          onChange={e => {
                            const newLeft = [...(localQ.leftItems || localQ.options?.filter((_, idx) => idx % 2 === 0) || [])];
                            newLeft[i] = { text: e.target.value };
                            setLocalQ({ ...localQ, leftItems: newLeft });
                            setEdited(true);
                          }}
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: 'white', fontSize: isMobile ? 12 : 13 } }}
                        />
                        <DragIndicator sx={{ color: 'text.secondary', flexShrink: 0 }} />
                        <TextField
                          fullWidth
                          size="small"
                          placeholder={`Right match ${i + 1}`}
                          value={(() => {
                            const rightItems = localQ.rightItems || localQ.options?.filter((_, idx) => idx % 2 === 1) || [];
                            const rightItem = rightItems[i];
                            return typeof rightItem === 'string' ? rightItem : rightItem?.text || '';
                          })()}
                          onChange={e => {
                            const newRight = [...(localQ.rightItems || localQ.options?.filter((_, idx) => idx % 2 === 1) || [])];
                            newRight[i] = { text: e.target.value };
                            setLocalQ({ ...localQ, rightItems: newRight });
                            setEdited(true);
                          }}
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: 'white', fontSize: isMobile ? 12 : 13 } }}
                        />
                        <IconButton
                          size="small"
                          onClick={() => {
                            const leftItems = [...(localQ.leftItems || localQ.options?.filter((_, idx) => idx % 2 === 0) || [])];
                            const rightItems = [...(localQ.rightItems || localQ.options?.filter((_, idx) => idx % 2 === 1) || [])];
                            leftItems.splice(i, 1);
                            rightItems.splice(i, 1);
                            setLocalQ({ ...localQ, leftItems, rightItems });
                            setEdited(true);
                          }}
                          sx={{ color: '#EF4444' }}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </Box>
                    ))}
                  </Box>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<Add />}
                    onClick={() => {
                      const leftItems = [...(localQ.leftItems || localQ.options?.filter((_, idx) => idx % 2 === 0) || [])];
                      const rightItems = [...(localQ.rightItems || localQ.options?.filter((_, idx) => idx % 2 === 1) || [])];
                      leftItems.push({ text: '' });
                      rightItems.push({ text: '' });
                      setLocalQ({ ...localQ, leftItems, rightItems });
                      setEdited(true);
                    }}
                    sx={{ mt: 2, textTransform: 'none', borderStyle: 'dashed', fontSize: isMobile ? 12 : 13 }}
                  >
                    Add Pair
                  </Button>
                </Box>
              </Grid>
            )}

            {/* Ordering Question Editor */}
            {qType === 'ordering' && (
              <Grid item xs={12}>
                <Box sx={{ p: isMobile ? 1.5 : 2, bgcolor: '#EEF2FF', borderRadius: 2, border: `1px solid ${typeColors[qType]}` }}>
                  <Typography sx={{ fontSize: isMobile ? 10 : 11, fontWeight: 700, color: '#3730A3', mb: 1, textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <SwapVert sx={{ fontSize: isMobile ? 12 : 14 }} />
                    Items to Order (Correct Order)
                  </Typography>
                  <Typography sx={{ fontSize: isMobile ? 11 : 12, color: '#4338CA', mb: 1.5, fontStyle: 'italic' }}>
                    Items will be shuffled for students. They drag to arrange in this order.
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {(localQ.items || localQ.options || []).map((item, i) => (
                      <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box
                          sx={{
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            bgcolor: typeColors[qType],
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 'bold',
                            fontSize: 12,
                            flexShrink: 0
                          }}
                        >
                          {i + 1}
                        </Box>
                        <DragIndicator sx={{ color: 'text.secondary', flexShrink: 0 }} />
                        <TextField
                          fullWidth
                          size="small"
                          placeholder={`Item ${i + 1}`}
                          value={typeof item === 'string' ? item : item.text}
                          onChange={e => {
                            const newItems = [...(localQ.items || localQ.options || [])];
                            newItems[i] = { text: e.target.value };
                            setLocalQ({ ...localQ, items: newItems });
                            setEdited(true);
                          }}
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: 'white', fontSize: isMobile ? 12 : 13 } }}
                        />
                        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                          <IconButton
                            size="small"
                            onClick={() => {
                              const items = [...(localQ.items || localQ.options || [])];
                              if (i > 0) {
                                [items[i - 1], items[i]] = [items[i], items[i - 1]];
                                setLocalQ({ ...localQ, items });
                                setEdited(true);
                              }
                            }}
                            disabled={i === 0}
                            sx={{ p: 0.3 }}
                          >
                            ▲
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => {
                              const items = [...(localQ.items || localQ.options || [])];
                              if (i < items.length - 1) {
                                [items[i], items[i + 1]] = [items[i + 1], items[i]];
                                setLocalQ({ ...localQ, items });
                                setEdited(true);
                              }
                            }}
                            disabled={i === (localQ.items || localQ.options || []).length - 1}
                            sx={{ p: 0.3 }}
                          >
                            ▼
                          </IconButton>
                        </Box>
                        <IconButton
                          size="small"
                          onClick={() => {
                            const items = [...(localQ.items || localQ.options || [])];
                            items.splice(i, 1);
                            setLocalQ({ ...localQ, items });
                            setEdited(true);
                          }}
                          sx={{ color: '#EF4444' }}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </Box>
                    ))}
                  </Box>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<Add />}
                    onClick={() => {
                      const items = [...(localQ.items || localQ.options || [])];
                      items.push({ text: '' });
                      setLocalQ({ ...localQ, items });
                      setEdited(true);
                    }}
                    sx={{ mt: 2, textTransform: 'none', borderStyle: 'dashed', fontSize: isMobile ? 12 : 13 }}
                  >
                    Add Item
                  </Button>
                </Box>
              </Grid>
            )}

            {/* Model Answer / Explanation */}
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75, flexWrap: 'wrap' }}>
                <Typography sx={{ fontSize: isMobile ? 10 : 11, fontWeight: 700, color: tokens.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {qType === 'open-ended' || qType === 'short-answer' ? (isMobile ? 'Model Answer *' : 'Comprehensive Model Answer *') : 'Explanation / Answer Key *'}
                </Typography>
                <Chip 
                  label="For AI Grading" 
                  size="small" 
                  sx={{ height: isMobile ? 16 : 18, fontSize: isMobile ? 8 : 9, bgcolor: '#DBEAFE', color: '#1E40AF', fontWeight: 700 }} 
                />
              </Box>
              <Typography sx={{ fontSize: isMobile ? 11 : 12, color: tokens.textMuted, mb: 1.5 }}>
                {qType === 'open-ended' 
                  ? (isMobile ? 'Provide a detailed model answer for AI grading comparison.' : 'Provide a detailed model answer (150-300 words) with key points, examples, and expected structure. The AI will compare student answers against this.')
                  : qType === 'multiple-choice' 
                    ? (isMobile ? 'Explain correct answer and why others are wrong.' : 'Explain why the correct answer is right and why each distractor is wrong. This helps the AI provide feedback on wrong answers.')
                    : (isMobile ? 'Provide correct answer and variations.' : 'Provide the correct answer and any acceptable variations.')}
              </Typography>

              {/* Add Sub-Questions Button (for questions without sub-questions) */}
              {(!localQ.subQuestions || !Array.isArray(localQ.subQuestions) || localQ.subQuestions.length === 0) && (
                <Box sx={{ mb: 2 }}>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<Add />}
                    onClick={() => {
                      setLocalQ({
                        ...localQ,
                        subQuestions: [
                          {
                            label: 'a)',
                            text: '',
                            type: 'open-ended',
                            points: 1,
                            correctAnswer: '',
                            options: []
                          }
                        ],
                        subQuestionConfig: {
                          mode: 'all',
                          requiredCount: 1,
                          scoringType: 'partial'
                        }
                      });
                      setEdited(true);
                    }}
                    sx={{
                      borderRadius: 2,
                      textTransform: 'none',
                      fontSize: 12,
                      borderStyle: 'dashed',
                      borderColor: tokens.accent,
                      color: tokens.accent,
                      '&:hover': { bgcolor: 'rgba(12,189,115,0.05)', borderStyle: 'solid' }
                    }}
                  >
                    + Add Sub-Questions
                  </Button>
                  <Typography sx={{ fontSize: 11, color: tokens.textMuted, mt: 0.5 }}>
                    Break this question into multiple sub-questions for students to answer
                  </Typography>
                </Box>
              )}

              {/* Display and edit subquestions if they exist */}
              {localQ.subQuestions && Array.isArray(localQ.subQuestions) && localQ.subQuestions.length > 0 ? (
                <Box sx={{ mb: 1.5 }}>
                  {/* Sub-question Configuration */}
                  <Paper elevation={0} sx={{ p: 1.5, mb: 2, bgcolor: '#FFF8E1', border: '1px solid #FFE082', borderRadius: 2 }}>
                    <Typography sx={{ fontSize: 11, fontWeight: 600, color: '#F57C00', mb: 1 }}>
                      Sub-Question Configuration
                    </Typography>
                    
                    {/* Mode Selection */}
                    <FormControl component="fieldset" fullWidth sx={{ mb: 2 }}>
                      <RadioGroup
                        row
                        value={localQ.subQuestionConfig?.mode || localQ.subQuestionMode || 'all'}
                        onChange={(e) => {
                          const newMode = e.target.value;
                          setLocalQ({ 
                            ...localQ, 
                            subQuestionConfig: { 
                              ...(localQ.subQuestionConfig || {}), 
                              mode: newMode,
                              requiredCount: localQ.subQuestionConfig?.requiredCount || 1
                            },
                            subQuestionMode: undefined // Clear old field
                          });
                          setEdited(true);
                        }}
                      >
                        <FormControlLabel
                          value="all"
                          control={<Radio size="small" />}
                          label={
                            <Box>
                              <Typography sx={{ fontSize: 11, fontWeight: 500 }}>Answer ALL</Typography>
                              <Typography sx={{ fontSize: 10, color: '#666' }}>Student must answer every sub-question</Typography>
                            </Box>
                          }
                        />
                        <FormControlLabel
                          value="choose-n"
                          control={<Radio size="small" />}
                          label={
                            <Box>
                              <Typography sx={{ fontSize: 11, fontWeight: 500 }}>Choose N</Typography>
                              <Typography sx={{ fontSize: 10, color: '#666' }}>Student picks N sub-questions to answer</Typography>
                            </Box>
                          }
                        />
                      </RadioGroup>
                    </FormControl>
                    
                    {/* Choose-N Configuration */}
                    {(localQ.subQuestionConfig?.mode === 'choose-n' || localQ.subQuestionMode === 'choose-one') && (
                      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                        <TextField
                          size="small"
                          type="number"
                          label="Required Count"
                          value={localQ.subQuestionConfig?.requiredCount || 1}
                          onChange={(e) => {
                            const count = Math.max(1, Math.min(localQ.subQuestions.length, parseInt(e.target.value) || 1));
                            setLocalQ({ 
                              ...localQ, 
                              subQuestionConfig: { 
                                ...(localQ.subQuestionConfig || {}), 
                                mode: 'choose-n',
                                requiredCount: count 
                              }
                            });
                            setEdited(true);
                          }}
                          inputProps={{ min: 1, max: localQ.subQuestions.length }}
                          sx={{ width: 100, '& .MuiInputBase-root': { fontSize: 12 } }}
                        />
                        <FormControl size="small" sx={{ minWidth: 150 }}>
                          <InputLabel sx={{ fontSize: 11 }}>Scoring Type</InputLabel>
                          <Select
                            value={localQ.subQuestionConfig?.scoringType || 'partial'}
                            onChange={(e) => {
                              setLocalQ({ 
                                ...localQ, 
                                subQuestionConfig: { 
                                  ...(localQ.subQuestionConfig || {}), 
                                  mode: 'choose-n',
                                  scoringType: e.target.value 
                                }
                              });
                              setEdited(true);
                            }}
                            sx={{ fontSize: 12 }}
                          >
                            <MenuItem value="partial" sx={{ fontSize: 12 }}>Independent (Each question graded separately)</MenuItem>
                            <MenuItem value="all-or-nothing" sx={{ fontSize: 12 }}>All-or-Nothing (All must be correct)</MenuItem>
                          </Select>
                        </FormControl>
                      </Box>
                    )}
                    
                    {(localQ.subQuestionConfig?.mode === 'choose-n' || localQ.subQuestionMode === 'choose-one') && (
                      <Alert severity="warning" sx={{ mt: 2, py: 0.5, '& .MuiAlert-message': { fontSize: 10 } }}>
                        Student selects <strong>{localQ.subQuestionConfig?.requiredCount || 1}</strong> from {localQ.subQuestions.length} options. 
                        {localQ.subQuestionConfig?.scoringType === 'all-or-nothing' 
                          ? 'All-or-Nothing: Must get ALL selected questions correct for full marks.'
                          : 'Independent Grading: Each selected question earns its own marks (not required to get all correct).'
                        }
                      </Alert>
                    )}
                  </Paper>
                  
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography sx={{ fontSize: 12, fontWeight: 600, color: tokens.textPrimary }}>
                      Subquestions ({localQ.subQuestions.length})
                    </Typography>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => {
                        const newSubQ = {
                          label: `${String.fromCharCode(97 + localQ.subQuestions.length)})`,
                          text: '',
                          type: 'open-ended',
                          points: localQ.subQuestionMode === 'choose-one' ? (localQ.points || 1) : 1,
                          correctAnswer: '',
                          options: []
                        };
                        setLocalQ({ ...localQ, subQuestions: [...localQ.subQuestions, newSubQ] });
                        setEdited(true);
                      }}
                      sx={{ fontSize: 10, minWidth: 'auto', py: 0.3, px: 1 }}
                    >
                      + Add Subquestion
                    </Button>
                  </Box>
                  {localQ.subQuestions.map((subQ, idx) => (
                    <Paper key={idx} elevation={0} sx={{ p: 1.5, mb: 1.5, bgcolor: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: 2 }}>
                      {/* Subquestion header with label and type */}
                      <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                        <TextField
                          size="small"
                          placeholder="Label (e.g., a), b), i))"
                          value={subQ.label || ''}
                          onChange={(e) => {
                            const updated = [...localQ.subQuestions];
                            updated[idx] = { ...subQ, label: e.target.value };
                            setLocalQ({ ...localQ, subQuestions: updated });
                            setEdited(true);
                          }}
                          sx={{ width: 70, '& .MuiInputBase-root': { fontSize: 11, height: 28 } }}
                        />
                        <FormControl size="small" sx={{ minWidth: 120 }}>
                          <Select
                            value={subQ.type || 'open-ended'}
                            onChange={(e) => {
                              const updated = [...localQ.subQuestions];
                              updated[idx] = { ...subQ, type: e.target.value, options: e.target.value === 'multiple-choice' ? [{ letter: 'i', text: '', isCorrect: false }] : [] };
                              setLocalQ({ ...localQ, subQuestions: updated });
                              setEdited(true);
                            }}
                            sx={{ fontSize: 11, height: 28 }}
                          >
                            <MenuItem value="open-ended">Open-ended</MenuItem>
                            <MenuItem value="short-answer">Short Answer</MenuItem>
                            <MenuItem value="essay">Essay</MenuItem>
                            <MenuItem value="multiple-choice">Multiple Choice</MenuItem>
                            <MenuItem value="true-false">True/False</MenuItem>
                            <MenuItem value="fill-in-blank">Fill in blank</MenuItem>
                          </Select>
                        </FormControl>
                        <TextField
                          size="small"
                          type="number"
                          placeholder="Points"
                          value={subQ.points || 1}
                          onChange={(e) => {
                            const updated = [...localQ.subQuestions];
                            updated[idx] = { ...subQ, points: parseInt(e.target.value) || 1 };
                            setLocalQ({ ...localQ, subQuestions: updated });
                            setEdited(true);
                          }}
                          sx={{ width: 70, '& .MuiInputBase-root': { fontSize: 11, height: 28 } }}
                        />
                        <IconButton
                          size="small"
                          onClick={() => {
                            const updated = localQ.subQuestions.filter((_, i) => i !== idx);
                            setLocalQ({ ...localQ, subQuestions: updated });
                            setEdited(true);
                          }}
                          sx={{ color: '#DC2626', p: 0.3 }}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </Box>

                      {/* Subquestion text */}
                      <TextField
                        fullWidth
                        size="small"
                        placeholder="Subquestion text..."
                        value={subQ.text || ''}
                        onChange={(e) => {
                          const updated = [...localQ.subQuestions];
                          updated[idx] = { ...subQ, text: e.target.value };
                          setLocalQ({ ...localQ, subQuestions: updated });
                          setEdited(true);
                        }}
                        sx={{ mb: 1, '& .MuiInputBase-root': { fontSize: 11, minHeight: 32 } }}
                      />

                      {/* MCQ Options for subquestion */}
                      {subQ.type === 'multiple-choice' && (
                        <Box sx={{ mb: 1, pl: 1, borderLeft: '2px solid #BAE6FD' }}>
                          <Typography sx={{ fontSize: 10, color: '#0369A1', mb: 0.5 }}>Options:</Typography>
                          {(subQ.options || []).map((opt, optIdx) => (
                            <Box key={optIdx} sx={{ display: 'flex', gap: 0.5, alignItems: 'center', mb: 0.5 }}>
                              <TextField
                                size="small"
                                placeholder={`${optIdx + 1}`}
                                value={opt.letter || ''}
                                onChange={(e) => {
                                  const updated = [...localQ.subQuestions];
                                  const updatedOptions = [...(subQ.options || [])];
                                  updatedOptions[optIdx] = { ...opt, letter: e.target.value };
                                  updated[idx] = { ...subQ, options: updatedOptions };
                                  setLocalQ({ ...localQ, subQuestions: updated });
                                  setEdited(true);
                                }}
                                sx={{ width: 40, '& .MuiInputBase-root': { fontSize: 10, height: 24 } }}
                              />
                              <TextField
                                fullWidth
                                size="small"
                                placeholder={`Option ${optIdx + 1} text`}
                                value={opt.text || ''}
                                onChange={(e) => {
                                  const updated = [...localQ.subQuestions];
                                  const updatedOptions = [...(subQ.options || [])];
                                  updatedOptions[optIdx] = { ...opt, text: e.target.value };
                                  updated[idx] = { ...subQ, options: updatedOptions };
                                  setLocalQ({ ...localQ, subQuestions: updated });
                                  setEdited(true);
                                }}
                                sx={{ '& .MuiInputBase-root': { fontSize: 11, height: 24 } }}
                              />
                              <FormControlLabel
                                control={
                                  <Radio
                                    size="small"
                                    checked={opt.isCorrect || false}
                                    onChange={() => {
                                      const updated = [...localQ.subQuestions];
                                      const updatedOptions = (subQ.options || []).map((o, i) => ({ ...o, isCorrect: i === optIdx }));
                                      updated[idx] = { ...subQ, options: updatedOptions, correctAnswer: opt.letter || '' };
                                      setLocalQ({ ...localQ, subQuestions: updated });
                                      setEdited(true);
                                    }}
                                  />
                                }
                                label={<Typography sx={{ fontSize: 9 }}>Correct</Typography>}
                              />
                              <IconButton
                                size="small"
                                onClick={() => {
                                  const updated = [...localQ.subQuestions];
                                  const updatedOptions = (subQ.options || []).filter((_, i) => i !== optIdx);
                                  updated[idx] = { ...subQ, options: updatedOptions };
                                  setLocalQ({ ...localQ, subQuestions: updated });
                                  setEdited(true);
                                }}
                                sx={{ p: 0.2 }}
                              >
                                <Delete fontSize="small" sx={{ fontSize: 14 }} />
                              </IconButton>
                            </Box>
                          ))}
                          <Button
                            size="small"
                            variant="text"
                            onClick={() => {
                              const updated = [...localQ.subQuestions];
                              const newLetter = String.fromCharCode(105 + (subQ.options || []).length);
                              updated[idx] = { ...subQ, options: [...(subQ.options || []), { letter: newLetter, text: '', isCorrect: false }] };
                              setLocalQ({ ...localQ, subQuestions: updated });
                              setEdited(true);
                            }}
                            sx={{ fontSize: 9, mt: 0.5 }}
                          >
                            + Add Option
                          </Button>
                        </Box>
                      )}

                      {/* Correct Answer */}
                      {subQ.type !== 'multiple-choice' && (
                        <TextField
                          fullWidth
                          size="small"
                          placeholder="Correct answer..."
                          value={subQ.correctAnswer || ''}
                          onChange={(e) => {
                            const updated = [...localQ.subQuestions];
                            updated[idx] = { ...subQ, correctAnswer: e.target.value };
                            setLocalQ({ ...localQ, subQuestions: updated });
                            setEdited(true);
                          }}
                          sx={{ '& .MuiInputBase-root': { fontSize: 11, minHeight: 32 } }}
                        />
                      )}
                      {subQ.type === 'multiple-choice' && (
                        <Typography sx={{ fontSize: 10, color: '#075985', mt: 0.5 }}>
                          Correct Answer Letter: <strong>{subQ.correctAnswer || 'Not set'}</strong>
                        </Typography>
                      )}
                    </Paper>
                  ))}
                </Box>
              ) : (
                <TextField
                  fullWidth
                  size="small"
                  placeholder={qType === 'open-ended' 
                    ? (isMobile ? "Enter model answer..." : "Enter a comprehensive model answer here... Include all key points, examples, and structure expected in a complete answer.")
                    : "Explanation for correct answer..."}
                  multiline
                  minRows={qType === 'open-ended' ? (isMobile ? 4 : 6) : (isMobile ? 3 : 4)}
                  maxRows={10}
                  value={localQ.explanation || localQ.answerKey || localQ.correctAnswer || ''}
                  onChange={(e) => { setLocalQ({ ...localQ, explanation: e.target.value, answerKey: e.target.value }); setEdited(true); }}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: 'white', fontSize: isMobile ? 12 : 13, lineHeight: 1.7 } }}
                />
              )}
            </Grid>
          </Grid>
        </Box>
      )}
    </Paper>
  );
};

// Function to get navigation items based on subscription plan
const getNavigationItems = (user, hasTemplatesAccess) => {
  const baseNav = [
    { id: 'home',      label: 'Dashboard',  icon: <DashboardCustomize sx={{ fontSize: 20 }} /> },
    { id: 'exams',     label: 'My Exams',   icon: <Assignment sx={{ fontSize: 20 }} /> },
    { id: 'students',  label: 'Students',   icon: <People sx={{ fontSize: 20 }} /> },
    { id: 'results',   label: 'Results',    icon: <ListAlt sx={{ fontSize: 20 }} /> },
    { id: 'settings',  label: 'Settings',   icon: <Settings sx={{ fontSize: 20 }} /> },
  ];

  // Only show templates if user has access (Basic plan or higher)
  if (hasTemplatesAccess) {
    baseNav.splice(4, 0, { id: 'templates', label: 'Templates',  icon: <Description sx={{ fontSize: 20 }} /> });
  }

  // If not custom enterprise, remove AI-related features from home section
  // (The AI tab is part of the home section, not a separate nav item)
  return baseNav;
};

/* ── Sparkline ── */
function Sparkline({ color = tokens.accent, values = [40,55,45,65,60,75,70] }) {
  const w = 80, h = 32;
  const max = Math.max(...values), min = Math.min(...values), range = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - ((v - min) / range) * (h - 6) - 3}`).join(' ');
  return (
    <svg width={w} height={h}><polyline fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={pts} /></svg>
  );
}

/* ── Area chart ── */
function AreaChart({ data = [], color = tokens.accent }) {
  if (!data.length || data.length < 2) data = [50,60,45,75,65,80,72];
  const w = 380, h = 110;
  const max = Math.max(...data) || 100;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * (h - 12) - 6}`).join(' ');
  const area = `${pts} ${w},${h} 0,${h}`;
  const labels = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  return (
    <svg viewBox={`0 0 ${w} ${h + 22}`} style={{ width: '100%', height: 140 }}>
      <defs>
        <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[0,25,50,75,100].map(y => <line key={y} x1="0" x2={w} y1={h-(y/100)*(h-12)-6} y2={h-(y/100)*(h-12)-6} stroke="#E2E8F0" strokeWidth="1" />)}
      {[0,25,50,75,100].map(y => <text key={y} x={-4} y={h-(y/100)*(h-12)-4} textAnchor="end" fontSize="9" fill={tokens.textMuted}>{y}%</text>)}
      <polygon points={area} fill="url(#ag)" />
      <polyline fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={pts} />
      {data.map((v, i) => { const cx = (i/(data.length-1))*w, cy = h-(v/max)*(h-12)-6; return <circle key={i} cx={cx} cy={cy} r="4" fill="white" stroke={color} strokeWidth="2" />; })}
      {labels.slice(0, data.length).map((l, i) => <text key={i} x={(i/(Math.max(data.length,1)-1))*w} y={h+18} textAnchor="middle" fontSize="10" fill={tokens.textMuted}>{l}</text>)}
    </svg>
  );
}

/* ── Donut ── */
function DonutChart({ data, total }) {
  const size = 110, stroke = 18, r = (size - stroke) / 2, circ = 2 * Math.PI * r;
  let off = 0;
  const segs = data.map(d => { const pct = total > 0 ? d.count / total : 0; const s = { ...d, dash: `${pct * circ} ${circ}`, off }; off += pct * circ; return s; });
  return (
    <Box sx={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#F1F5F9" strokeWidth={stroke} />
        {segs.map((s, i) => <circle key={i} cx={size/2} cy={size/2} r={r} fill="none" stroke={s.color} strokeWidth={stroke} strokeDasharray={s.dash} strokeDashoffset={-s.off} strokeLinecap="round" />)}
      </svg>
      <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <Typography fontWeight={800} sx={{ fontSize: 20, color: tokens.textPrimary, lineHeight: 1, fontFamily: "DM Sans,sans-serif" }}>{total}</Typography>
        <Typography sx={{ fontSize: 10, color: tokens.textMuted, fontFamily: "DM Sans,sans-serif" }}>Total</Typography>
      </Box>
    </Box>
  );
}

/* ── Main ── */
export default function TeacherDashboard() {
  const isMobile = useMediaQuery('(max-width:900px)');
  const isXs = useMediaQuery('(max-width:600px)');
  const { user, logout } = useAuth();
  const { hasTemplatesAccess } = usePlan();
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const [activeSection, setActiveSection] = useState('home');
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [exams, setExams] = useState([]);
  const [results, setResults] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingApprovals, setPendingApprovals] = useState(0);

  const handleSearch = (query) => {
    setSearchQuery(query);
  };

  useEffect(() => {
    if (!user) return; // Don't fetch if user is not authenticated
    
    api.get('/admin/dashboard-stats')
      .then(r => setStats(r.data))
      .catch(err => {
        console.error('Error fetching dashboard stats:', err);
        setStats({});
      })
      .finally(() => setStatsLoading(false));
    
    api.get('/admin/exams')
      .then(r => {
        console.log('Dashboard exams fetched:', r.data);
        setExams(r.data || []);
      })
      .catch(err => {
        console.error('Error fetching exams in dashboard:', err);
      });
    
    api.get('/admin/results')
      .then(r => setResults(Array.isArray(r.data) ? r.data : (r.data?.results || [])))
      .catch(err => {
        console.error('Error fetching results:', err);
      });
  }, [user]);

  // Auto-refresh pending approvals every 30 seconds (enterprise only)
  const isEnterprise = (user?.subscriptionPlan === 'enterprise' && user?.subscriptionType === 'custom') ||
                       (user?.organization?.subscriptionPlan === 'enterprise' && user?.organization?.subscriptionType === 'custom');
  useEffect(() => {
    if (!user || !isEnterprise) return;

    const fetchPendingApprovals = async () => {
      try {
        const response = await api.get('/marketplace/exam-requests');
        const pendingCount = response.data.filter(r => r.status === 'pending').length;
        setPendingApprovals(pendingCount);
      } catch (err) {
        console.error('Error fetching pending approvals:', err);
      }
    };

    fetchPendingApprovals();
    const interval = setInterval(fetchPendingApprovals, 30000);

    return () => clearInterval(interval);
  }, [user, isEnterprise]);

  const filteredExams = exams.filter(exam =>
    !searchQuery || 
    exam.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    exam.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get navigation items based on subscription plan
  const nav = getNavigationItems(user, hasTemplatesAccess);

  return (
    <DashboardShell
      sidebarEl={<Sidebar user={user} logout={logout} activeSection={activeSection} setActiveSection={setActiveSection} onClose={() => setSidebarOpen(false)} isMobile={isMobile} nav={nav} portalLabel="Teacher Portal" />}
      topbarEl={<Topbar greeting={getDynamicGreeting(user?.firstName || 'Teacher')} sub="Here's what's happening with your exams today." user={user} onMenuClick={() => setSidebarOpen(v => !v)} onLogout={logout} roleLabel="Teacher" isXs={isXs} onSearch={handleSearch} />}
      sidebarOpen={sidebarOpen} isMobile={isMobile} onCloseSidebar={() => setSidebarOpen(false)}>
      <SubscriptionWarning user={user} onLogout={logout} />
      {activeSection === 'home'      && <HomeSection stats={stats} statsLoading={statsLoading} exams={filteredExams} results={results} setActiveSection={setActiveSection} setExams={setExams} pendingApprovals={pendingApprovals} user={user} />}
      {activeSection === 'exams'     && <ExamsSection exams={filteredExams} setExams={setExams} setActiveSection={setActiveSection} user={user} />}
      {activeSection === 'students'  && <StudentsSection />}
      {activeSection === 'results'   && <ResultsSection results={results} />}
      {activeSection === 'templates' && <TemplatesSection exams={filteredExams} setExams={setExams} setActiveSection={setActiveSection} />}
      {activeSection === 'reports'   && <ReportsSection />}
      {activeSection === 'settings'  && <SettingsSection user={user} />}
    </DashboardShell>
  );
}

// Plan limits for question generation (mirrors server AI_PLAN_LIMITS)
const PLAN_Q_LIMITS = {
  free:       { maxQuestions: 0,  maxPerType: 0 },
  basic:      { maxQuestions: 20, maxPerType: 10 },
  premium:    { maxQuestions: 50, maxPerType: 20 },
  enterprise: { maxQuestions: 100, maxPerType: 50 },
};

/* ── HOME ── */
function HomeSection({ stats, statsLoading, exams, results, setActiveSection, setExams, pendingApprovals, user }) {
  const isXs = useMediaQuery('(max-width:600px)');
  const { canUseAdvancedAI, hasMarketplaceAccess, hasTemplatesAccess } = usePlan();
  const [aiMode, setAiMode] = useState(canUseAdvancedAI ? 'describe' : 'upload');
  const [manualExam, setManualExam] = useState({ title: '', description: 'Exam', timeLimit: 60, passingScore: 70, sections: [{ name: 'A', description: 'Section A', questions: [] }] });
  const [manualSection, setManualSection] = useState(0);
  const [manualQ, setManualQ] = useState({ text: '', type: 'multiple-choice', points: 2, difficulty: 'medium', options: [{ text: '', isCorrect: false, letter: 'A' }, { text: '', isCorrect: false, letter: 'B' }, { text: '', isCorrect: false, letter: 'C' }, { text: '', isCorrect: false, letter: 'D' }], correctAnswer: '' });
  const [manualPublishing, setManualPublishing] = useState(false);
  const [manualError, setManualError] = useState('');
  const [prompt, setPrompt] = useState('');
  const [pastedExam, setPastedExam] = useState('');
  const [examInputMode, setExamInputMode] = useState('describe'); // 'describe' or 'paste'
  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploadedFileContent, setUploadedFileContent] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [generated, setGenerated] = useState(null);
  const [generatedSections, setGeneratedSections] = useState([{ name: 'A', description: 'Section A' }]);
  const [loading, setLoading] = useState(false);

  // Auto-update generatedSections when exam is loaded
  useEffect(() => {
    if (generated?.sections && generated.sections.length > 0) {
      const sections = generated.sections.map(s => ({ name: s.name, description: s.description || `Section ${s.name}` }));
      setGeneratedSections(sections);
    }
  }, [generated]);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadAnswer, setUploadAnswer] = useState(null);
  const [examTitle, setExamTitle] = useState('');
  const [examTimeLimit, setExamTimeLimit] = useState('');
  const [publishExamId, setPublishExamId] = useState(null);
  const fileRef = useRef();
  const ansRef = useRef();
  const referenceFileRef = useRef();
  // AI chat assistant - Enhanced with smart guidance
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([{ role: 'assistant', text: 'Hi! I\'m your AI teaching assistant. I can help you create exams, design assessment strategies, or answer questions about pedagogy.\n\n**Quick tips:**\n• Be specific about subject, grade level, and topics\n• Tell me how many questions you need and what types (e.g., "10 multiple-choice, 5 short-answer")\n• Include all requirements in your prompt for best results', suggestions: ['Create a math exam for Grade 10 with 15 multiple-choice questions', 'How to assess critical thinking?', 'Design a science quiz with 20 questions: 10 multiple-choice, 5 true-false, 5 short-answer'] }]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [hasSpeechSupport, setHasSpeechSupport] = useState(false);
  const recognitionRef = useRef(null);

  // Check for speech recognition support and initialize
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      setHasSpeechSupport(true);
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
          } else {
            interimTranscript += transcript;
          }
        }

        if (finalTranscript) {
          setPrompt(prev => prev + finalTranscript);
        }
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsRecording(false);
      };

      recognition.onend = () => {
        if (isRecording) {
          setIsRecording(false);
        }
      };

      recognitionRef.current = recognition;
    }
  }, [isRecording]);

  const startRecording = () => {
    if (recognitionRef.current && !isRecording) {
      recognitionRef.current.start();
      setIsRecording(true);
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }
  };

  // Auto-save disabled to prevent conflicts with manual saves and version errors
  const [showSuggestions, setShowSuggestions] = useState(true);
  const chatEndRef = useRef();

  // Smart input validation and guidance
  const INCOMPLETE_PATTERNS = [
    { pattern: /^(hi|hello|hey|hola|greetings)[\s!]*$/i, message: '👋 Hello! To help you best, please tell me:\n• What subject is the exam for?\n• What grade/level?\n• How many questions?\n• Any specific topics?', example: 'Example: "Create a biology exam for Grade 10 about cell structure with 15 questions"' },
    { pattern: /^(help|assist|support)[\s!]*$/i, message: 'I\'m here to help! Here\'s what I can do:\n• Create complete exams with specific topics\n• Suggest assessment strategies\n• Help with question design\n• Explain grading rubrics', example: 'Try: "I need a history exam about WWII for Grade 11"' },
    { pattern: /^(create|make|generate).*(exam|quiz|test)/i, message: 'I\'d love to help create an exam! Please provide more details:\n• **Subject:** What topic or subject area?\n• **Grade/Level:** What grade or difficulty?\n• **Question count:** How many questions?\n• **Topics:** Any specific content areas?', example: 'Example: "Create a 20-question physics exam about mechanics for Grade 12"' },
    { pattern: /^(what|how|why|when|where|who)[\s?]*$/i, message: 'That\'s a bit broad! Could you be more specific? For example:\n• "What types of questions work best for assessing problem-solving?"\n• "How should I structure a 60-minute exam?"\n• "What\'s a good way to test vocabulary retention?"', example: '' },
    { pattern: /^\d+\s*questions?$/i, message: 'You mentioned a number of questions, but I need more context:\n• What subject/topic?\n• What grade level?\n• What type of assessment?', example: 'Example: "10 multiple-choice questions about photosynthesis for Grade 9"' },
  ];

  const COMMON_SUGGESTIONS = [
    { text: '📝 Create exam', prompt: 'Create a [subject] exam for [grade] covering [topics]' },
    { text: '📊 Assessment tips', prompt: 'What are effective ways to assess [skill/concept]?' },
    { text: '❓ Question ideas', prompt: 'What questions can I ask about [topic] for [grade level]?' },
    { text: '📋 Exam structure', prompt: 'How should I structure a [duration] exam on [subject]?' },
    { text: '🎯 Learning objectives', prompt: 'Help me write learning objectives for [topic]' },
  ];

  const effectivePlan = (user?.subscriptionPlan || 'free').toLowerCase();
  const planLimits = PLAN_Q_LIMITS[effectivePlan] || PLAN_Q_LIMITS.free;
  const canUseAI = planLimits.maxQuestions > 0;

  // Smart message analyzer to detect incomplete inputs
  const analyzeMessage = (msg) => {
    const trimmed = msg.trim();
    if (trimmed.length < 3) return { isComplete: false, guidance: 'Please type a bit more so I can understand what you need.' };
    
    for (const pattern of INCOMPLETE_PATTERNS) {
      if (pattern.pattern.test(trimmed)) {
        return { isComplete: false, guidance: pattern.message, example: pattern.example };
      }
    }
    
    // Check for vague exam requests
    if (/exam|quiz|test|assessment/i.test(trimmed)) {
      const hasSubject = /\b(math|science|biology|chemistry|physics|history|geography|english|literature|language|art|music|pe|computer|coding|programming|algebra|geometry|calculus|essay|writing|reading)\b/i.test(trimmed);
      const hasGrade = /\b(grade\s*\d+|class\s*\d+|year\s*\d+|g\d+|primary|secondary|high\s*school|college|university|\d+(th|st|nd|rd)\s*grade)\b/i.test(trimmed);
      const hasCount = /\b(\d+\s*(questions?|qs?|items?)|few|several|some|many)\b/i.test(trimmed);
      const hasTopic = /\b(about|on|covering|regarding|concerning|topic|chapter|unit|module|theme)\b/i.test(trimmed);
      
      const missing = [];
      if (!hasSubject) missing.push('• **Subject:** What subject is this for?');
      if (!hasGrade) missing.push('• **Grade/Level:** What grade or difficulty level?');
      if (!hasCount) missing.push('• **Question count:** How many questions do you need?');
      if (!hasTopic) missing.push('• **Specific topics:** What content should be covered?');
      
      if (missing.length > 0) {
        return {
          isComplete: false,
          guidance: `I can help create that exam! To make it perfect, I need a bit more information:\n\n${missing.join('\n')}`,
          example: 'Example: "Create a 15-question biology exam about cell division and genetics for Grade 10"'
        };
      }
    }
    
    return { isComplete: true };
  };

  const handleSuggestionClick = (prompt) => {
    setChatInput(prompt);
    setShowSuggestions(false);
  };

  const handleSendChat = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const msg = chatInput.trim();
    
    // Analyze message before sending
    const analysis = analyzeMessage(msg);
    
    if (!analysis.isComplete) {
      // Show guidance instead of sending incomplete message
      setChatMessages(prev => [
        ...prev, 
        { role: 'user', text: msg },
        { role: 'assistant', text: analysis.guidance + (analysis.example ? `\n\n${analysis.example}` : ''), type: 'guidance', suggestions: ['Create a math exam for Grade 10', 'Design a science quiz', 'Assessment strategies for essay writing'] }
      ]);
      setChatInput('');
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      return;
    }
    
    setChatInput('');
    setShowSuggestions(false);
    setChatMessages(prev => [...prev, { role: 'user', text: msg }]);
    setChatLoading(true);
    try {
      const res = await api.post('/exam/ai-chat', { message: msg }, { timeout: 60000 });
      setChatMessages(prev => [...prev, { role: 'assistant', text: res.data.reply }]);
    } catch (err) {
      const is429 = err.response?.status === 429 || err.response?.data?.message?.includes('429');
      setChatMessages(prev => [...prev, { 
        role: 'assistant', 
        text: is429 
          ? '⏱️ I\'m a bit busy right now. Please wait a moment and try again.'
          : 'Sorry, I could not respond. Please try again.',
        type: 'error'
      }]);
    } finally {
      setChatLoading(false);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  };

  useEffect(() => {
    if (chatOpen) setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  }, [chatMessages, chatOpen]);

  const qDist = [
    { label: 'Multiple Choice', color: tokens.accent,  count: stats?.questionTypes?.multiple_choice ?? 8 },
    { label: 'True / False',    color: '#6366F1',       count: stats?.questionTypes?.true_false ?? 4 },
    { label: 'Fill in the Blank', color: tokens.warning, count: stats?.questionTypes?.fill_blank ?? 2 },
    { label: 'Open Question',   color: '#EC4899',       count: stats?.questionTypes?.open_question ?? 1 },
  ];
  const qTotal = qDist.reduce((s, q) => s + q.count, 0);
  const perfData = results.slice(-7).map(r => Math.round(r.percentage ?? r.scores?.percentage ?? 0));
  const avgPerf = results.length ? Math.round(results.reduce((s, r) => s + ((r.percentage ?? r.scores?.percentage ?? 0)), 0) / results.length) : (stats?.avgScore ? Math.round(stats.avgScore) : 0);

  const handleGenerate = async () => {
    if (examInputMode === 'describe' && !prompt.trim() && !uploadedFileContent) return;
    if (examInputMode === 'paste' && !pastedExam.trim()) return;
    if (!canUseAI) { setAiError('AI exam generation requires Basic plan or higher. Please upgrade your subscription.'); return; }
    setAiLoading(true); setAiError('');
    try {
      const payload = examInputMode === 'paste'
        ? { prompt: prompt.trim(), pastedExam: pastedExam.trim() }
        : { prompt: prompt.trim(), referenceContent: uploadedFileContent };
      const res = await api.post('/exam/ai-generate', payload, { timeout: 90000 });
      setGenerated(res.data);
    }
    catch (err) { setAiError(err.response?.data?.message || 'AI generation failed.'); }
    finally { setAiLoading(false); }
  };

  // Use the new upload hook for reference file uploads
  const {
    upload,
    progress: uploadProgress,
    uploading: isUploading,
    error: uploadError,
    retryCount: uploadRetryCount,
    connectionStatus: uploadConnectionStatus,
    reset: resetUpload
  } = useUpload({
    maxRetries: 3,
    onSuccess: (data) => {
      setUploadedFileContent(data.content);
      setAiLoading(false);
    },
    onError: (err) => {
      if (err.response?.status === 413) {
        setAiError('File too large. Maximum size is 50MB.');
      } else {
        setAiError(err.response?.data?.message || err.message || 'Failed to upload file');
      }
      setUploadedFile(null);
      setAiLoading(false);
    }
  });

  const handleFileUpload = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const file = e.target.files[0];
    if (!file) {
      console.log('No file selected');
      return;
    }

    console.log('File selected:', file.name, 'Size:', file.size, 'Type:', file.type);

    // Validate file size (50MB limit)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      setAiError(`File too large. Maximum size is 50MB. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB.`);
      return;
    }

    setUploadedFile(file);
    setAiLoading(true);
    setAiError('');

    try {
      console.log('Starting upload to /exam/upload-reference');
      await upload('/exam/upload-reference', file);
      console.log('Upload completed successfully');
    } catch (err) {
      // Error is handled by onError callback
      console.error('Upload failed:', err);
    }
  };

  const handleCancelUpload = () => {
    resetUpload();
    setUploadedFile(null);
    setAiLoading(false);
  };

  const handleUpload = async () => {
    if (!uploadFile) return;
    if (!examTitle.trim() || !examTimeLimit.trim()) {
      setAiError('Please provide title and time limit');
      return;
    }
    setAiLoading(true); setAiError('');
    console.log('=== UPLOAD DEBUG START ===');
    console.log('uploadFile:', uploadFile ? { name: uploadFile.name, size: uploadFile.size, type: uploadFile.type } : null);
    console.log('examTitle:', examTitle);
    console.log('examTimeLimit:', examTimeLimit);
    console.log('uploadAnswer:', uploadAnswer ? { name: uploadAnswer.name, size: uploadAnswer.size } : null);
    try {
      const fd = new FormData();
      fd.append('examFile', uploadFile);
      fd.append('title', examTitle);
      fd.append('timeLimit', examTimeLimit);
      if (uploadAnswer) fd.append('answerFile', uploadAnswer);
      
      // Debug: Log FormData entries
      console.log('FormData entries:');
      for (let [key, value] of fd.entries()) {
        if (value instanceof File) {
          console.log(`  ${key}: File { name: ${value.name}, size: ${value.size}, type: ${value.type} }`);
        } else {
          console.log(`  ${key}: ${value}`);
        }
      }
      
      console.log('Sending POST to /admin/exams...');
      const res = await api.post('/admin/exams', fd, { timeout: 300000 });
      console.log('Upload success:', res.data);
      setGenerated(res.data);
      if (res.data.parsingFailed) {
        setAiError('PDF parsing failed due to file corruption. You can manually add questions using the editor below.');
      }
    } catch (err) { 
      console.error('Upload error:', err);
      console.error('Error response:', err.response?.data);
      console.error('Error status:', err.response?.status);
      setAiError(err.response?.data?.message || 'Upload failed.'); 
    }
    finally { 
      console.log('=== UPLOAD DEBUG END ===');
      setAiLoading(false); 
    }
  };

  const [savingDraft, setSavingDraft] = useState(false);

  const handlePublish = async () => {
    try {
      // Ensure all questions have proper grading fields for accurate AI grading
      const examToPublish = {
        ...generated,
        questions: (generated.questions || []).map(q => ({
          text: q.text,
          type: q.type || 'multiple-choice',
          marks: q.marks || q.points || 1,
          difficulty: q.difficulty || 'medium',
          correctAnswer: q.correctAnswer || '',
          options: q.options || [],
          // Comprehensive grading fields
          explanation: q.explanation || q.answerKey || '',
          answerKey: q.answerKey || q.explanation || '',
          gradingCriteria: Array.isArray(q.gradingCriteria) ? q.gradingCriteria : 
                          Array.isArray(q.keyPoints) ? q.keyPoints : [],
          keyPoints: Array.isArray(q.keyPoints) ? q.keyPoints : 
                     Array.isArray(q.gradingCriteria) ? q.gradingCriteria : [],
          acceptableAnswers: q.acceptableAnswers || [],
          // Include any additional fields from the AI
          ...q
        }))
      };
      
      const res = await api.post('/admin/exams', examToPublish);
      setPublishExamId(res.data._id);
      setGenerated(null);
    } catch (err) {
      console.error('Publish error:', err);
      alert('Failed to publish exam. Please try again.');
    }
  };

  const handleSaveDraft = async () => {
    if (!generated?.title || !generated?.questions?.length) {
      alert('Please add a title and at least one question before saving.');
      return;
    }
    
    setSavingDraft(true);
    try {
      // Build sections array from generated data
      const sectionsArray = generated.sections || [];
      
      const draftData = {
        title: generated.title,
        description: generated.description || generated.title,
        timeLimit: generated.timeLimit || 60,
        passingScore: generated.passingScore || 70,
        totalMarks: generated.totalMarks || generated.questions.reduce((s, q) => s + (q.marks || 1), 0),
        sections: sectionsArray,
        questions: generated.questions.map(q => ({
          text: q.text,
          type: q.type || 'multiple-choice',
          marks: q.marks || q.points || 1,
          difficulty: q.difficulty || 'medium',
          correctAnswer: q.correctAnswer || '',
          options: q.options || [],
          explanation: q.explanation || q.answerKey || '',
          answerKey: q.answerKey || q.explanation || '',
          gradingCriteria: q.gradingCriteria || q.keyPoints || [],
          keyPoints: q.keyPoints || q.gradingCriteria || [],
          acceptableAnswers: q.acceptableAnswers || [],
          section: q.section || 'A',
          leftItems: q.leftItems,
          rightItems: q.rightItems,
          items: q.items,
          matchingPairs: q.matchingPairs,
          itemsToOrder: q.itemsToOrder,
          passage: q.passage,
          instructions: q.instructions,
          wordBank: q.wordBank,
          subQuestions: q.subQuestions || [],
          subQuestionConfig: q.subQuestionConfig || { mode: 'all', requiredCount: 1, scoringType: 'partial' }
        }))
      };
      
      const res = await api.post('/exam/save-draft', draftData, { timeout: 120000 }); // 2 minutes for long exams
      alert(`Draft saved successfully! You can find it in the "My Exams" section.`);
      
      // Refresh the exams list to show the newly saved draft
      api.get('/admin/exams')
        .then(r => {
          console.log('Refreshed exams after draft save:', r.data);
          console.log('Draft exam should be in this list');
          setExams(r.data || []);
          setGenerated(null); // Clear the generated state after saving
        })
        .catch(err => {
          console.error('Error refreshing exams after saving draft:', err);
        });
    } catch (err) {
      console.error('Save draft error:', err);
      alert(err.response?.data?.message || 'Failed to save draft. Please try again.');
    } finally {
      setSavingDraft(false);
    }
  };

  const addManualQuestion = () => {
    if (!manualQ.text.trim()) return;
    const q = { ...manualQ };
    if (q.type === 'true-false') { q.options = [{ text: 'True', isCorrect: q.correctAnswer === 'True', letter: 'A' }, { text: 'False', isCorrect: q.correctAnswer === 'False', letter: 'B' }]; }
    setManualExam(p => { const secs = [...p.sections]; secs[manualSection] = { ...secs[manualSection], questions: [...(secs[manualSection].questions || []), q] }; return { ...p, sections: secs }; });
    setManualQ({ text: '', type: 'multiple-choice', points: 2, difficulty: 'medium', options: [{ text: '', isCorrect: false, letter: 'A' }, { text: '', isCorrect: false, letter: 'B' }, { text: '', isCorrect: false, letter: 'C' }, { text: '', isCorrect: false, letter: 'D' }], correctAnswer: '' });
  };

  const removeManualQuestion = (secIdx, qIdx) => {
    setManualExam(p => { const secs = [...p.sections]; secs[secIdx].questions = secs[secIdx].questions.filter((_, i) => i !== qIdx); return { ...p, sections: secs }; });
  };

  const handleManualPublish = async () => {
    if (!manualExam.title.trim()) { setManualError('Please enter an exam title.'); return; }
    const total = manualExam.sections.reduce((s, sec) => s + (sec.questions?.length || 0), 0);
    if (total === 0) { setManualError('Add at least one question before publishing.'); return; }
    setManualPublishing(true); setManualError('');
    try {
      const res = await api.post('/admin/exams', manualExam);
      setPublishExamId(res.data._id);
      setManualExam({ title: '', description: 'Exam', timeLimit: 60, passingScore: 70, sections: [{ name: 'A', description: 'Section A', questions: [] }] });
      setManualSection(0);
    } catch (err) { setManualError(err.response?.data?.message || 'Publish failed.'); }
    finally { setManualPublishing(false); }
  };

  const handleManualSaveDraft = async () => {
    if (!manualExam.title.trim()) {
      alert('Please enter an exam title before saving as draft.');
      return;
    }
    
    setSavingDraft(true);
    try {
      const draftData = {
        title: manualExam.title,
        description: manualExam.description || 'Exam',
        timeLimit: manualExam.timeLimit || 60,
        passingScore: manualExam.passingScore || 70,
        sections: manualExam.sections,
        questions: manualExam.sections.flatMap(sec => sec.questions || []).map(q => ({
          text: q.text,
          type: q.type || 'multiple-choice',
          marks: q.points || 1,
          difficulty: q.difficulty || 'medium',
          correctAnswer: q.correctAnswer || '',
          options: q.options || [],
          section: q.section || 'A',
          leftItems: q.leftItems,
          rightItems: q.rightItems,
          items: q.items,
          matchingPairs: q.matchingPairs,
          itemsToOrder: q.itemsToOrder,
          passage: q.passage,
          instructions: q.instructions,
          wordBank: q.wordBank,
          subQuestions: q.subQuestions || [],
          subQuestionConfig: q.subQuestionConfig || { mode: 'all', requiredCount: 1, scoringType: 'partial' }
        }))
      };
      
      const res = await api.post('/exam/save-draft', draftData, { timeout: 120000 });
      alert(`Draft saved successfully! You can find it in the "My Exams" section.`);
      
      api.get('/admin/exams')
        .then(r => {
          setExams(r.data || []);
        })
        .catch(err => {
          console.error('Error refreshing exams after saving draft:', err);
        });
    } catch (err) {
      console.error('Save draft error:', err);
      alert(err.response?.data?.message || 'Failed to save draft. Please try again.');
    } finally {
      setSavingDraft(false);
    }
  };

  const statCards = [
    { label: 'Exams Created',  value: stats?.totalExams    ?? 0,    sub: '+3 this week',  subColor: tokens.accent,  iconBg: 'rgba(12,189,115,0.1)',  icon: <Assignment sx={{ color: tokens.accent, fontSize: { xs: 20, sm: 24 } }} />,  spark: [5,8,6,10,9,12,10] },
    { label: 'Total Students', value: stats?.totalStudents ?? 0,    sub: '+18 this week', subColor: '#6366F1',       iconBg: 'rgba(99,102,241,0.1)',  icon: <People sx={{ color: '#6366F1', fontSize: { xs: 20, sm: 24 } }} />,           spark: [200,220,230,240,244,246,248] },
    { label: 'Average Score',  value: `${Math.round(stats?.averageScore ?? 0)}%`, sub: '+6% this week', subColor: tokens.warning, iconBg: 'rgba(245,158,11,0.1)', icon: <BarChart sx={{ color: tokens.warning, fontSize: { xs: 20, sm: 24 } }} />, spark: [65,70,68,75,72,78,75] },
    { label: 'Pass Rate',      value: `${stats?.passRate ?? 0}%`,     sub: '+4% this week', subColor: '#EC4899',       iconBg: 'rgba(236,72,153,0.1)',  icon: <CheckCircle sx={{ color: '#EC4899', fontSize: { xs: 20, sm: 24 } }} />,        spark: [70,72,74,76,75,78,77] },
    ...(hasMarketplaceAccess ? [{ label: 'Pending Approvals', value: pendingApprovals ?? 0, sub: 'Auto-refreshing', subColor: '#F59E0B', iconBg: 'rgba(245,158,11,0.1)', icon: <HourglassEmpty sx={{ color: '#F59E0B', fontSize: { xs: 20, sm: 24 } }} />, spark: [2,3,1,4,2,5,3] }] : []),
  ];

  return (
    <Box>
      {/* Stat cards with sparkline */}
      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        {statCards.map((s, i) => (
          <Grid item xs={6} md={2.4} key={i}>
            <Paper elevation={0} sx={{ p: { xs: 1.5, sm: 2.5 }, borderRadius: 3, bgcolor: 'white', border: `1px solid ${tokens.surfaceBorder}`, transition: 'box-shadow 0.2s,transform 0.15s', '&:hover': { boxShadow: '0 6px 24px rgba(13,64,108,0.09)', transform: 'translateY(-1px)' } }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1.5 }}>
                <Box sx={{ width: { xs: 38, sm: 48 }, height: { xs: 38, sm: 48 }, borderRadius: 2.5, bgcolor: s.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{s.icon}</Box>
                <Box sx={{ display: { xs: 'none', sm: 'block' } }}><Sparkline color={s.subColor} values={s.spark} /></Box>
              </Box>
              {statsLoading ? <CircularProgress size={20} sx={{ color: tokens.accent }} /> :
                <Typography fontWeight={800} sx={{ color: tokens.textPrimary, fontFamily: "DM Sans,sans-serif", lineHeight: 1, fontSize: { xs: '1.25rem', sm: '1.5rem', md: '2.125rem' } }}>{s.value}</Typography>}
              <Typography sx={{ fontSize: { xs: 11, sm: 12.5 }, color: tokens.textMuted, fontFamily: "DM Sans,sans-serif", mt: 0.25 }} noWrap>{s.label}</Typography>
              <Typography sx={{ fontSize: { xs: 10.5, sm: 11.5 }, color: s.subColor, fontWeight: 600, fontFamily: "DM Sans,sans-serif", mt: 0.35 }} noWrap>{s.sub}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* AI Creator */}
      <Paper elevation={0} sx={{ borderRadius: 3, overflow: 'hidden', mb: 2.5, border: `1px solid ${tokens.surfaceBorder}` }}>
        <Box sx={{ px: isXs ? 2 : 3, py: isXs ? 2 : 2.25, background: gradients.brand, display: 'flex', alignItems: isXs ? 'stretch' : 'center', justifyContent: 'space-between', flexDirection: isXs ? 'column' : 'row', gap: isXs ? 1.5 : 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: isXs ? 1.5 : 2, width: isXs ? '100%' : 'auto' }}>
            <Box sx={{ width: isXs ? 36 : 42, height: isXs ? 36 : 42, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <AutoAwesome sx={{ color: 'white', fontSize: isXs ? 18 : 22 }} />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography fontWeight={700} color="white" sx={{ fontSize: isXs ? 14 : 16, fontFamily: "DM Sans,sans-serif" }}>Exam Creator</Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.8)', fontSize: isXs ? 11 : 12.5, fontFamily: "DM Sans,sans-serif", lineHeight: 1.4 }}>{isXs ? 'Create exams quickly • Reuse from Question Bank' : 'Describe your exam or upload a document to create it quickly • Reuse questions from Question Bank'}</Typography>
            </Box>
          </Box>
          {hasTemplatesAccess && (
            <Button variant="contained" onClick={() => setActiveSection('templates')} sx={{ bgcolor: 'white', color: tokens.primary, borderRadius: 2.5, fontWeight: 700, fontSize: isXs ? 11 : 13, textTransform: 'none', px: isXs ? 2 : 3, py: isXs ? 1 : 1.25, fontFamily: "DM Sans,sans-serif", width: isXs ? '100%' : 'auto', '&:hover': { bgcolor: 'rgba(255,255,255,0.9)' } }}>
              {isXs ? '📋 Templates & Bank' : '📋 Use Templates & Question Bank'}
            </Button>
          )}
        </Box>

        <Box sx={{ display: 'flex', bgcolor: 'white', borderBottom: `1px solid ${tokens.surfaceBorder}`, flexWrap: isXs ? 'wrap' : 'nowrap' }}>
          {[...(canUseAdvancedAI ? [{ key: 'describe', label: isXs ? '✏ Describe' : '✏  Describe' }] : []), { key: 'upload', label: isXs ? '☁ Upload' : '☁  Upload Doc' }, { key: 'manual', label: isXs ? '✍ Manual' : '✍  Manual Build' }].map(tab => (
            <Button key={tab.key} onClick={() => setAiMode(tab.key)} sx={{ flex: isXs ? '1 1 33%' : 1, py: isXs ? 1 : 1.5, fontWeight: 600, fontSize: { xs: 10, sm: 13 }, textTransform: 'none', borderRadius: 0, fontFamily: "DM Sans,sans-serif", borderBottom: aiMode === tab.key ? `2.5px solid ${tokens.primary}` : '2.5px solid transparent', color: aiMode === tab.key ? tokens.primary : tokens.textMuted, minWidth: isXs ? 0 : 'auto' }}>
              {tab.label}
            </Button>
          ))}
        </Box>

        <Box sx={{ p: isXs ? 2 : 3, bgcolor: 'white' }}>
          {aiMode === 'manual' ? (
            <ManualExamBuilder
              exam={manualExam} setExam={setManualExam}
              sectionIdx={manualSection} setSectionIdx={setManualSection}
              question={manualQ} setQuestion={setManualQ}
              onAddQuestion={addManualQuestion}
              onRemoveQuestion={removeManualQuestion}
              onPublish={handleManualPublish}
              publishing={manualPublishing}
              error={manualError}
              onSaveDraft={handleManualSaveDraft}
              savingDraft={savingDraft}
            />
          ) : aiMode === 'describe' ? (
            <>
              {/* Plan badge */}
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5, flexDirection: isXs ? 'column' : 'row', gap: isXs ? 1 : 0, alignItems: isXs ? 'stretch' : 'center' }}>
                <Chip
                  label={`${effectivePlan.charAt(0).toUpperCase() + effectivePlan.slice(1)} Plan · max ${planLimits.maxQuestions || 0} questions`}
                  size="small"
                  sx={{ bgcolor: canUseAI ? 'rgba(12,189,115,0.1)' : 'rgba(239,68,68,0.08)', color: canUseAI ? tokens.accentDark : '#EF4444', fontWeight: 700, fontSize: isXs ? 10 : 11, width: isXs ? '100%' : 'auto' }}
                />
                <Button size="small" onClick={() => setChatOpen(v => !v)}
                  sx={{ borderRadius: 2, color: tokens.primary, bgcolor: 'rgba(13,64,108,0.07)', fontFamily: "DM Sans,sans-serif", fontSize: isXs ? 11 : 12, textTransform: 'none', px: isXs ? 1.5 : 2, py: isXs ? 0.75 : 1, fontWeight: 600, width: isXs ? '100%' : 'auto', '&:hover': { bgcolor: 'rgba(13,64,108,0.13)' } }}>
                  💬 AI Assistant
                </Button>
              </Box>

              {/* AI Chat panel - Enhanced */}
              {chatOpen && (
                <Paper elevation={0} sx={{ mb: 2, border: `1px solid ${tokens.surfaceBorder}`, borderRadius: 2.5, overflow: 'hidden' }}>
                  <Box sx={{ px: isXs ? 1.5 : 2, py: isXs ? 1 : 1.25, bgcolor: tokens.primary, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography fontWeight={700} sx={{ color: 'white', fontSize: isXs ? 12 : 13, fontFamily: "DM Sans,sans-serif" }}>AI Teaching Assistant</Typography>
                      <Box sx={{ px: isXs ? 0.5 : 0.75, py: isXs ? 0.15 : 0.25, borderRadius: 1, bgcolor: 'rgba(255,255,255,0.2)', fontSize: isXs ? 9 : 10, color: 'white', fontWeight: 600 }}>Smart Guide</Box>
                    </Box>
                    <IconButton size="small" onClick={() => setChatOpen(false)} sx={{ color: 'rgba(255,255,255,0.7)', p: isXs ? 0.25 : 0.5 }}><Close sx={{ fontSize: isXs ? 14 : 16 }} /></IconButton>
                  </Box>
                  <Box sx={{ maxHeight: isXs ? 250 : 320, overflowY: 'auto', p: isXs ? 1 : 1.5, display: 'flex', flexDirection: 'column', gap: 1.5, bgcolor: '#F8FAFC' }}>
                    {chatMessages.map((m, i) => (
                      <Box key={i}>
                        <Box sx={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                          <Box sx={{ 
                            maxWidth: isXs ? '90%' : '85%', 
                            px: isXs ? 1 : 1.5, 
                            py: isXs ? 0.75 : 1, 
                            borderRadius: m.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px', 
                            bgcolor: m.role === 'user' ? tokens.primary : m.type === 'guidance' ? '#FEF3C7' : 'white', 
                            color: m.role === 'user' ? 'white' : tokens.textPrimary, 
                            fontSize: isXs ? 12 : 13, 
                            fontFamily: "DM Sans,sans-serif", 
                            border: m.role !== 'user' ? `1px solid ${m.type === 'guidance' ? '#FCD34D' : tokens.surfaceBorder}` : 'none', 
                            lineHeight: 1.6, 
                            whiteSpace: 'pre-wrap',
                            boxShadow: m.type === 'guidance' ? '0 2px 8px rgba(252, 211, 77, 0.2)' : 'none'
                          }}>
                            {m.text}
                          </Box>
                        </Box>
                        {/* Suggestion chips for guidance messages */}
                        {m.suggestions && (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1, ml: 0.5 }}>
                            {m.suggestions.map((suggestion, idx) => (
                              <Button
                                key={idx}
                                size="small"
                                onClick={() => handleSuggestionClick(suggestion)}
                                sx={{
                                  px: 1.5,
                                  py: 0.5,
                                  borderRadius: 2,
                                  fontSize: 11,
                                  fontWeight: 600,
                                  textTransform: 'none',
                                  bgcolor: 'white',
                                  color: tokens.primary,
                                  border: `1px solid ${tokens.surfaceBorder}`,
                                  '&:hover': { bgcolor: tokens.primary, color: 'white', borderColor: tokens.primary }
                                }}
                              >
                                {suggestion}
                              </Button>
                            ))}
                          </Box>
                        )}
                      </Box>
                    ))}
                    {chatLoading && (
                      <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
                        <Box sx={{ px: 1.5, py: 1, borderRadius: '12px 12px 12px 2px', bgcolor: 'white', border: `1px solid ${tokens.surfaceBorder}`, fontSize: 13, color: tokens.textMuted, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <CircularProgress size={14} thickness={2} />
                          Thinking…
                        </Box>
                      </Box>
                    )}
                    <div ref={chatEndRef} />
                  </Box>
                  
                  {/* Quick suggestion chips */}
                  {showSuggestions && !chatLoading && (
                    <Box sx={{ px: 1.5, py: 1, borderTop: `1px solid ${tokens.surfaceBorder}`, bgcolor: '#F1F5F9' }}>
                      <Typography sx={{ fontSize: 10, color: tokens.textMuted, fontWeight: 600, mb: 0.75, textTransform: 'uppercase', letterSpacing: 0.5 }}>Quick Actions</Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                        {COMMON_SUGGESTIONS.map((s, idx) => (
                          <Button
                            key={idx}
                            size="small"
                            onClick={() => handleSuggestionClick(s.prompt)}
                            sx={{
                              px: 1.25,
                              py: 0.5,
                              borderRadius: 1.5,
                              fontSize: 11,
                              fontWeight: 600,
                              textTransform: 'none',
                              bgcolor: 'white',
                              color: tokens.textSecondary,
                              border: `1px solid ${tokens.surfaceBorder}`,
                              '&:hover': { bgcolor: tokens.primary, color: 'white', borderColor: tokens.primary }
                            }}
                          >
                            {s.text}
                          </Button>
                        ))}
                      </Box>
                    </Box>
                  )}
                  
                  <Box sx={{ display: 'flex', gap: 1, p: 1, borderTop: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white' }}>
                    <TextField
                      fullWidth 
                      size="small" 
                      placeholder="Describe what you need (e.g., 'Create a biology exam for Grade 10 about cell structure')"
                      value={chatInput} 
                      onChange={e => { setChatInput(e.target.value); if (!e.target.value) setShowSuggestions(true); }}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendChat(); } }}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, fontSize: 13, bgcolor: '#FAFBFC' } }}
                    />
                    <Button 
                      variant="contained" 
                      onClick={handleSendChat} 
                      disabled={chatLoading || !chatInput.trim()}
                      sx={{ borderRadius: 2, minWidth: 40, px: 1.5, background: gradients.brand, boxShadow: 'none', textTransform: 'none', fontWeight: 700, fontSize: 12 }}>
                      Send
                    </Button>
                  </Box>
                </Paper>
              )}

              {/* Input mode toggle */}
              <Box sx={{ mb: 2, display: 'flex', gap: 1 }}>
                <Button
                  size="small"
                  onClick={() => setExamInputMode('describe')}
                  sx={{
                    borderRadius: 2,
                    px: 2,
                    py: 1,
                    textTransform: 'none',
                    fontWeight: 600,
                    fontSize: 13,
                    fontFamily: "DM Sans,sans-serif",
                    bgcolor: examInputMode === 'describe' ? tokens.primary : '#F1F5F9',
                    color: examInputMode === 'describe' ? 'white' : tokens.textSecondary,
                    '&:hover': { bgcolor: examInputMode === 'describe' ? tokens.primaryDark : '#E2E8F0' }
                  }}
                >
                  ✏️ Describe Exam
                </Button>
                <Button
                  size="small"
                  onClick={() => setExamInputMode('paste')}
                  sx={{
                    borderRadius: 2,
                    px: 2,
                    py: 1,
                    textTransform: 'none',
                    fontWeight: 600,
                    fontSize: 13,
                    fontFamily: "DM Sans,sans-serif",
                    bgcolor: examInputMode === 'paste' ? tokens.primary : '#F1F5F9',
                    color: examInputMode === 'paste' ? 'white' : tokens.textSecondary,
                    '&:hover': { bgcolor: examInputMode === 'paste' ? tokens.primaryDark : '#E2E8F0' }
                  }}
                >
                  📋 Paste Exam
                </Button>
              </Box>

              {/* Smart exam description input with guidance */}
              <Box sx={{ mb: 2 }}>
                {examInputMode === 'describe' ? (
                  <Box>
                    {/* File upload section */}
                    <Box sx={{ mb: 2, p: 2, bgcolor: '#F8FAFC', borderRadius: 2, border: '2px dashed #CBD5E1' }}>
                      <Typography sx={{ fontSize: 12, fontWeight: 700, color: tokens.textSecondary, mb: 1, textTransform: 'uppercase' }}>
                        📎 Upload Reference Material (Optional)
                      </Typography>
                      <Typography sx={{ fontSize: 12, color: tokens.textMuted, mb: 1.5 }}>
                        Upload an exam, textbook, or study guide for the AI to reference when generating questions
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: tokens.textMuted, mb: 1.5 }}>
                        Supported formats: PDF, DOC, DOCX, TXT (Max: 50MB)
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx,.txt"
                          ref={referenceFileRef}
                          onChange={handleFileUpload}
                          disabled={!canUseAI || aiLoading}
                          style={{ display: 'none' }}
                          id="reference-file-upload"
                        />
                        <label htmlFor="reference-file-upload">
                          <Button
                            component="span"
                            variant="outlined"
                            size="small"
                            disabled={!canUseAI || aiLoading}
                            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
                          >
                            Choose File
                          </Button>
                        </label>
                        {/* Upload Progress Indicator */}
                        <Box sx={{ width: '100%', mt: 1 }}>
                          <UploadProgress
                            progress={uploadProgress}
                            uploading={isUploading}
                            error={uploadError}
                            retryCount={uploadRetryCount}
                            maxRetries={3}
                            connectionStatus={uploadConnectionStatus}
                            fileName={uploadedFile?.name}
                            fileSize={uploadedFile?.size}
                            onCancel={handleCancelUpload}
                            onRetry={() => uploadedFile && upload('/exam/upload-reference', uploadedFile)}
                            success={!!uploadedFileContent}
                          />
                        </Box>
                        
                        {/* Success message */}
                        {uploadedFileContent && (
                          <Box sx={{ mt: 1, p: 1, bgcolor: '#DBEAFE', borderRadius: 1 }}>
                            <Typography sx={{ fontSize: 11, color: '#1E40AF', fontWeight: 600 }}>
                              ✓ File uploaded successfully - AI will use this as reference
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    </Box>

                    <Box sx={{ position: 'relative' }}>
                      <TextField
                        fullWidth
                        multiline
                        minRows={isXs ? 4 : 3}
                        maxRows={isXs ? 8 : 6}
                        placeholder={isXs ? "Describe your exam:\n• Subject & topic\n• Grade level\n• Number of questions & types\n• Duration" : "Describe your exam in detail for best results:\n• Subject: What topic or subject area?\n• Grade/Level: What grade or class level?\n• Topics: What specific content to cover?\n• Question count & types: How many questions of each type? (e.g., 10 multiple-choice, 5 short-answer, 3 open-ended)\n• Duration: How long should the exam be?\n\nExample: 'Biology exam for Grade 10 covering cell division and photosynthesis with 15 multiple-choice questions, 5 short-answer questions, and 3 open-ended questions, 60 minutes duration'"}
                        value={prompt}
                        onChange={e => setPrompt(e.target.value)}
                        disabled={!canUseAI}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 2,
                            fontFamily: "DM Sans,sans-serif",
                            bgcolor: '#FAFBFC',
                            fontSize: isXs ? 13 : 14,
                            lineHeight: 1.6,
                            paddingRight: isRecording ? '60px' : '48px'
                          }
                        }}
                      />
                      {/* Voice recording button */}
                      {hasSpeechSupport && canUseAI && (
                        <Box sx={{ position: 'absolute', right: isXs ? 6 : 8, top: isXs ? 6 : 8, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                          <Tooltip title={isRecording ? "Stop recording" : "Use voice command to describe your exam"}>
                            <IconButton
                              onClick={isRecording ? stopRecording : startRecording}
                              size="small"
                              sx={{
                                bgcolor: isRecording ? '#EF4444' : tokens.primary,
                                color: 'white',
                                width: isXs ? 36 : 40,
                                height: isXs ? 36 : 40,
                                '&:hover': { bgcolor: isRecording ? '#DC2626' : tokens.primaryDark },
                                animation: isRecording ? 'pulse 1.5s infinite' : 'none',
                                '@keyframes pulse': {
                                  '0%': { transform: 'scale(1)', boxShadow: '0 0 0 0 rgba(239, 68, 68, 0.7)' },
                                  '70%': { transform: 'scale(1.05)', boxShadow: '0 0 0 10px rgba(239, 68, 68, 0)' },
                                  '100%': { transform: 'scale(1)', boxShadow: '0 0 0 0 rgba(239, 68, 68, 0)' }
                                }
                              }}
                            >
                              {isRecording ? <Stop sx={{ fontSize: isXs ? 18 : 20 }} /> : <Mic sx={{ fontSize: isXs ? 18 : 20 }} />}
                            </IconButton>
                          </Tooltip>
                          {isRecording && (
                            <Box sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 0.5,
                              bgcolor: '#EF4444',
                              color: 'white',
                              px: 1,
                              py: 0.25,
                              borderRadius: 1,
                              fontSize: 9,
                              fontWeight: 700,
                              animation: 'pulse 1.5s infinite'
                            }}>
                              <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'white' }} />
                              Recording
                            </Box>
                          )}
                        </Box>
                      )}
                      {!hasSpeechSupport && canUseAI && (
                        <Tooltip title="Voice commands not supported in this browser (use Chrome or Edge)">
                          <IconButton
                            size="small"
                            disabled
                            sx={{ position: 'absolute', right: 8, top: 8, color: tokens.textMuted }}
                          >
                            <MicOff sx={{ fontSize: 20 }} />
                          </IconButton>
                        </Tooltip>
                      )}
                      {/* Voice command tip */}
                      {hasSpeechSupport && canUseAI && !prompt && (
                        <Alert severity="info" sx={{ mt: 1, py: 0.5, fontSize: 12 }}>
                          🎙️ <strong>Voice Command:</strong> Click the microphone button to describe your exam verbally. Include subject, grade level, number of questions, and question types (e.g., "Create a Grade 10 math exam with 15 multiple-choice questions").
                        </Alert>
                      )}
                      {/* Input validation hint */}
                      {prompt.trim() && prompt.trim().length < 20 && (
                        <Alert severity="info" sx={{ mt: 1, py: 0.5, fontSize: 12 }}>
                          💡 Tip: Add more details like subject, grade level, question types and counts for better results.
                        </Alert>
                      )}
                      {prompt.trim() && prompt.trim().length >= 20 && (
                        <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <CheckCircle sx={{ fontSize: 14, color: tokens.accent }} />
                          <Typography sx={{ fontSize: 11, color: tokens.textMuted }}>
                            Good! Ready to create a quality exam.
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  </Box>
                ) : (
                  <Box>
                    <TextField 
                      fullWidth 
                      multiline 
                      minRows={isXs ? 6 : 5} 
                      maxRows={isXs ? 12 : 10} 
                      placeholder="Paste your exam content here including questions and marking guide. The AI will extract the EXACT questions from your pasted exam and convert them to the proper format. The same questions will be used - no new questions will be created.

Example format:
SECTION A: Multiple Choice (20 marks)
1. What is the capital of Rwanda?
   A. Kigali
   B. Gisenyi
   C. Butare
   D. Ruhengeri
   Answer: A (2 marks)

2. Which of the following is a component of a cell?
   A. Nucleus
   B. Mitochondria
   C. Both A and B
   D. None of the above
   Answer: C (2 marks)

SECTION B: Short Answer (10 marks)
3. Explain the process of photosynthesis in 3-4 sentences.
   Answer: Photosynthesis is the process by which plants convert light energy into chemical energy... (5 marks)

4. Define the term 'mitosis'.
   Answer: Mitosis is the process of cell division... (5 marks)"
                      value={pastedExam} 
                      onChange={e => setPastedExam(e.target.value)}
                      disabled={!canUseAI}
                      sx={{ 
                        '& .MuiOutlinedInput-root': { 
                          borderRadius: 2, 
                          fontFamily: "DM Sans,sans-serif", 
                          bgcolor: '#FAFBFC', 
                          fontSize: isXs ? 12 : 13, 
                          lineHeight: 1.6,
                        } 
                      }} 
                    />
                    <TextField 
                      fullWidth 
                      multiline 
                      minRows={isXs ? 2 : 2} 
                      maxRows={isXs ? 4 : 3} 
                      placeholder="Optional: Add any specific instructions for the new exam (e.g., 'Make it about the same topic but for Grade 11 instead of Grade 10')"
                      value={prompt} 
                      onChange={e => setPrompt(e.target.value)}
                      disabled={!canUseAI}
                      sx={{ 
                        mt: 2,
                        '& .MuiOutlinedInput-root': { 
                          borderRadius: 2, 
                          fontFamily: "DM Sans,sans-serif", 
                          bgcolor: '#FAFBFC', 
                          fontSize: isXs ? 12 : 13, 
                          lineHeight: 1.5,
                        } 
                      }} 
                    />
                  </Box>
                )}
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', flexDirection: isXs ? 'column' : 'row' }}>
                <Box sx={{ flexGrow: 1 }} />
                <Button variant="contained" startIcon={aiLoading ? <CircularProgress size={16} color="inherit" /> : <AutoAwesome />}
                  onClick={handleGenerate} disabled={aiLoading || (examInputMode === 'describe' && !prompt.trim()) || (examInputMode === 'paste' && !pastedExam.trim()) || !canUseAI}
                  sx={{ borderRadius: 2.5, fontWeight: 700, px: isXs ? 2.5 : 3, py: isXs ? 1.25 : 1.5, textTransform: 'none', background: canUseAI ? gradients.brand : '#CBD5E1', boxShadow: 'none', fontFamily: "DM Sans,sans-serif", fontSize: isXs ? 13 : 14, width: isXs ? '100%' : 'auto', '&:hover': { boxShadow: canUseAI ? '0 4px 14px rgba(12,189,115,0.35)' : 'none' } }}>
                  {aiLoading ? 'Generating…' : '✦ Generate Exam'}
                </Button>
              </Box>
              {aiError && <Box sx={{ mt: 2, p: isXs ? 1 : 1.5, borderRadius: 2, bgcolor: 'rgba(239,68,68,0.07)', color: '#EF4444', fontSize: isXs ? 12 : 13 }}>{aiError}</Box>}
            </>
          ) : (
            <>
              <Grid container spacing={isXs ? 1.5 : 2} sx={{ mb: isXs ? 1.5 : 2 }}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Exam Title *"
                    placeholder="Enter exam title"
                    value={examTitle}
                    onChange={(e) => setExamTitle(e.target.value)}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, fontSize: isXs ? 13 : 14 } }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Time Limit (minutes) *"
                    placeholder="e.g., 60"
                    type="number"
                    inputProps={{ min: 1 }}
                    value={examTimeLimit}
                    onChange={(e) => setExamTimeLimit(e.target.value)}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, fontSize: isXs ? 13 : 14 } }}
                  />
                </Grid>
              </Grid>
              <Grid container spacing={isXs ? 1.5 : 2} sx={{ mb: isXs ? 1.5 : 2 }}>
                {[{ ref: fileRef, file: uploadFile, set: setUploadFile, label: 'Upload Exam Document', sub: 'PDF, Word or TXT' },
                  { ref: ansRef, file: uploadAnswer, set: setUploadAnswer, label: 'Upload Answer Sheet', sub: 'Optional' }].map((item, i) => (
                  <Grid item xs={12} md={6} key={i}>
                    <Paper onClick={() => item.ref.current.click()} elevation={0} sx={{ p: isXs ? 2 : 3, borderRadius: 3, textAlign: 'center', cursor: 'pointer', border: `2px dashed ${item.file ? tokens.accent : tokens.surfaceBorder}`, bgcolor: item.file ? 'rgba(12,189,115,0.03)' : '#FAFBFC', '&:hover': { borderColor: tokens.accent } }}>
                      <input ref={item.ref} type="file" hidden accept=".pdf,.doc,.docx,.txt" onChange={e => item.set(e.target.files[0])} />
                      {item.file ? <><CheckCircle sx={{ color: tokens.accent, fontSize: isXs ? 28 : 32, mb: 0.5 }} /><Typography variant="body2" fontWeight={600} fontSize={isXs ? 12 : 14}>{item.file.name}</Typography></> :
                        <><FileUpload sx={{ color: tokens.textMuted, fontSize: isXs ? 28 : 32, mb: 0.5 }} /><Typography variant="body2" fontWeight={600} sx={{ color: tokens.textPrimary, fontSize: isXs ? 12 : 14 }}>{item.label}</Typography><Typography variant="caption" sx={{ color: tokens.textMuted, fontSize: isXs ? 11 : 12 }}>{item.sub}</Typography></>}
                    </Paper>
                  </Grid>
                ))}
              </Grid>
              {aiError && <Box sx={{ mb: 2, p: isXs ? 1 : 1.5, borderRadius: 2, bgcolor: 'rgba(239,68,68,0.07)', color: '#EF4444', fontSize: isXs ? 12 : 13 }}>{aiError}</Box>}
              <Button variant="contained" startIcon={aiLoading ? <CircularProgress size={16} color="inherit" /> : <CloudUpload />} onClick={handleUpload} disabled={aiLoading || !uploadFile}
                sx={{ borderRadius: 2.5, fontWeight: 700, px: isXs ? 2.5 : 3, py: isXs ? 1.25 : 1.5, textTransform: 'none', background: gradients.brand, boxShadow: 'none', fontFamily: "DM Sans,sans-serif", fontSize: isXs ? 13 : 14, width: isXs ? '100%' : 'auto' }}>
                {aiLoading ? 'Processing…' : 'Process & Generate'}
              </Button>
            </>
          )}
        </Box>
      </Paper>


      {/* Generated editor - Full question preview with editing */}
      {generated && (
        <Paper elevation={0} sx={{ mb: 2.5, borderRadius: 3, border: `1.5px solid ${tokens.accent}` }}>
          <Box sx={{ px: isXs ? 2 : 3, py: 2, background: gradients.accent, display: 'flex', flexDirection: isXs ? 'column' : 'row', alignItems: isXs ? 'flex-start' : 'center', justifyContent: 'space-between', gap: isXs ? 1.5 : 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <CheckCircle sx={{ color: 'white', fontSize: isXs ? 24 : 28 }} />
              <Box>
                <Typography fontWeight={700} color="white" sx={{ fontFamily: "DM Sans,sans-serif", fontSize: isXs ? 14 : 16 }}>Exam Generated!</Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.85)', fontFamily: "DM Sans,sans-serif", fontSize: isXs ? 10 : 12 }}>
                  {generated?.questions?.length || 0} questions ready for review
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, width: isXs ? '100%' : 'auto', justifyContent: isXs ? 'flex-end' : 'flex-start' }}>
              <Button size={isXs ? "small" : "small"} onClick={() => setGenerated(null)} sx={{ color: 'white', border: '1px solid rgba(255,255,255,0.5)', borderRadius: 2, textTransform: 'none', fontSize: isXs ? 11 : 13 }}>Discard</Button>
              <Button size={isXs ? "small" : "small"} onClick={handleSaveDraft} disabled={savingDraft}
                startIcon={savingDraft ? <CircularProgress size={14} color="inherit" /> : null}
                sx={{ color: 'white', border: '1px solid rgba(255,255,255,0.5)', borderRadius: 2, textTransform: 'none', fontSize: isXs ? 11 : 13 }}>
                {savingDraft ? 'Saving...' : ' Save Draft'}
              </Button>
            </Box>
          </Box>
          <Box sx={{ p: isXs ? 2 : 3, bgcolor: 'white' }}>
            {/* Exam Details */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={6}>
                <TextField 
                  label="Exam Title" 
                  fullWidth 
                  size="small" 
                  value={generated?.title || ''} 
                  onChange={e => setGenerated(p => ({ ...p, title: e.target.value }))} 
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} 
                />
              </Grid>
              <Grid item xs={6} sm={3}>
                <TextField 
                  label="Time (min)" 
                  type="number" 
                  fullWidth 
                  size="small" 
                  value={generated?.timeLimit || 60} 
                  onChange={e => setGenerated(p => ({ ...p, timeLimit: +e.target.value }))} 
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} 
                />
              </Grid>
              <Grid item xs={6} sm={3}>
                <TextField 
                  label="Total Marks" 
                  type="number" 
                  fullWidth 
                  size="small" 
                  value={generated?.questions?.reduce((s, q) => s + (q.marks || q.points || 1), 0) || 0}
                  InputProps={{ readOnly: true }}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: '#F8FAFC' } }} 
                />
              </Grid>
            </Grid>

            {/* Section Management */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 2, mb: 1.5 }}>
              <Typography fontWeight={700} sx={{ fontSize: 13, color: tokens.textPrimary, fontFamily: "DM Sans,sans-serif" }}>
                Exam Sections
              </Typography>
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Number of Sections</InputLabel>
                <Select
                  value={generatedSections.length}
                  label="Number of Sections"
                  onChange={(e) => {
                    const newCount = e.target.value;
                    const currentCount = generatedSections.length;
                    if (newCount > currentCount) {
                      // Add sections
                      for (let i = currentCount; i < newCount; i++) {
                        const name = String.fromCharCode(65 + i);
                        setGeneratedSections(prev => [...prev, { name, description: `Section ${name}` }]);
                      }
                    } else if (newCount < currentCount) {
                      // Remove sections from the end
                      setGeneratedSections(prev => prev.slice(0, newCount));
                    }
                  }}
                  sx={{ borderRadius: 2 }}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                    <MenuItem key={num} value={num}>{num}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Typography sx={{ fontSize: 11, color: tokens.textMuted }}>
                Sections: {generatedSections.map(s => s.name).join(', ')}
              </Typography>
            </Box>

            {/* Questions Editor */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
              <Typography fontWeight={700} sx={{ fontSize: 14, color: tokens.textPrimary, fontFamily: "DM Sans,sans-serif" }}>
                Questions Preview & Editor
              </Typography>
              <Button
                variant="outlined"
                size="small"
                startIcon={<Add />}
                onClick={() => {
                  // Add a new manual question to the generated exam
                  const newQuestion = {
                    text: '',
                    type: 'multiple-choice',
                    points: 2,
                    difficulty: 'medium',
                    marks: 2,
                    options: [
                      { text: '', isCorrect: false, letter: 'A' },
                      { text: '', isCorrect: false, letter: 'B' },
                      { text: '', isCorrect: false, letter: 'C' },
                      { text: '', isCorrect: false, letter: 'D' }
                    ],
                    correctAnswer: '',
                    section: generatedSections[0]?.name || 'A'
                  };
                  setGenerated(p => ({ ...p, questions: [...(p.questions || []), newQuestion] }));
                }}
                sx={{ borderRadius: 2, textTransform: 'none', fontSize: 12 }}
              >
                Add Manual Question
              </Button>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, maxHeight: 'none', overflowY: 'visible', overflowX: 'visible', pr: 0.5 }}>
              {(generated?.questions || []).map((q, idx) => (
                <GeneratedQuestionEditor 
                  key={idx} 
                  question={q} 
                  index={idx}
                  isMobile={isXs}
                  sections={generatedSections}
                  onSectionChange={(qIdx, sectionName) => {
                    const newQuestions = [...(generated.questions || [])];
                    newQuestions[qIdx] = { ...newQuestions[qIdx], section: sectionName };
                    setGenerated(p => ({ ...p, questions: newQuestions }));
                  }}
                  onUpdate={(updatedQ) => {
                    const newQuestions = [...(generated.questions || [])];
                    newQuestions[idx] = updatedQ;
                    setGenerated(p => ({ ...p, questions: newQuestions }));
                  }}
                  onDelete={() => {
                    const newQuestions = (generated.questions || []).filter((_, i) => i !== idx);
                    setGenerated(p => ({ ...p, questions: newQuestions }));
                  }}
                />
              ))}
            </Box>
          </Box>
        </Paper>
      )}

      {/* 3-col bottom row */}
      <Grid container spacing={2.5}>
        {/* Recent Exams */}
        <Grid item xs={12} sm={6} md={4}>
          <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white', height: '100%' }}>
            <SectionTitle action={<Button size="small" onClick={() => setActiveSection('exams')} sx={{ color: tokens.accent, fontWeight: 700, fontSize: 12, textTransform: 'none' }}>View All</Button>}>Recent Exams</SectionTitle>
            {exams.length === 0
              ? <Box sx={{ py: 4, textAlign: 'center' }}><Typography sx={{ color: tokens.textMuted, fontSize: 13 }}>No exams yet.</Typography></Box>
              : exams.slice(0, 3).map((e, i) => {
                  const sc = e.status === 'active' ? tokens.accent : e.status === 'draft' ? tokens.warning : '#6366F1';
                  // Calculate total questions from all sections
                  const totalQuestions = e.sections?.reduce((total, section) =>
                    total + (section.questions?.length || 0), 0
                  ) || e.questions?.length || 0;
                  return (
                    <Box key={e._id || i} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1.5, borderBottom: i < 2 ? `1px solid ${tokens.surfaceBorder}` : 'none' }}>
                      <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: 'rgba(12,189,115,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Assignment sx={{ fontSize: 18, color: tokens.accent }} />
                      </Box>
                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={600} noWrap sx={{ fontFamily: "DM Sans,sans-serif" }}>{e.title}</Typography>
                        <Typography variant="caption" sx={{ color: tokens.textMuted }}>{totalQuestions} Questions</Typography>
                      </Box>
                      <Chip label={e.status || 'draft'} size="small" sx={{ bgcolor: `${sc}14`, color: sc, fontWeight: 600, fontSize: 11, textTransform: 'capitalize' }} />
                    </Box>
                  );
                })}
            <Button fullWidth size="small" endIcon={<ArrowForward fontSize="small" />} onClick={() => setActiveSection('exams')}
              sx={{ mt: 2, color: tokens.accent, fontWeight: 600, fontSize: 12, textTransform: 'none', fontFamily: "DM Sans,sans-serif", bgcolor: 'rgba(12,189,115,0.05)', borderRadius: 2, py: 1, '&:hover': { bgcolor: 'rgba(12,189,115,0.1)' } }}>
              View All Exams
            </Button>
          </Paper>
        </Grid>

        {/* Performance Overview */}
        <Grid item xs={12} sm={12} md={4}>
          <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white', height: '100%' }}>
            <SectionTitle action={<Chip label="This Week" size="small" sx={{ bgcolor: '#F1F5F9', color: tokens.textSecondary, fontSize: 11, fontWeight: 600 }} />}>
              Performance Overview
            </SectionTitle>
            <AreaChart data={perfData.length >= 3 ? perfData : [50,60,45,75,65,80,72]} color={tokens.accent} />
            <Box sx={{ textAlign: 'center', mt: 0.5 }}>
              <Chip label={`${avgPerf}% Average Score`} sx={{ bgcolor: 'rgba(12,189,115,0.1)', color: tokens.accentDark, fontWeight: 700, fontSize: 12 }} />
            </Box>
            <Button fullWidth size="small" endIcon={<ArrowForward fontSize="small" />} onClick={() => setActiveSection('results')}
              sx={{ mt: 2, color: tokens.accent, fontWeight: 600, fontSize: 12, textTransform: 'none', fontFamily: "DM Sans,sans-serif", bgcolor: 'rgba(12,189,115,0.05)', borderRadius: 2, py: 1, '&:hover': { bgcolor: 'rgba(12,189,115,0.1)' } }}>
              View Analytics
            </Button>
          </Paper>
        </Grid>
      </Grid>

      {/* Quick Actions */}
      <Paper elevation={0} sx={{ mt: 2.5, p: 2.5, borderRadius: 3, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white' }}>
        <Typography fontWeight={700} sx={{ fontSize: 15, fontFamily: "DM Sans,sans-serif", color: tokens.textPrimary, mb: 2 }}>Quick Actions</Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
          {[
            { label: 'Create Exam',      icon: <Add sx={{ fontSize: 18 }} />,         color: tokens.accent,  bg: 'rgba(12,189,115,0.09)',  section: 'exams' },
            { label: 'Add Students',     icon: <People sx={{ fontSize: 18 }} />,       color: '#6366F1',      bg: 'rgba(99,102,241,0.09)',  section: 'students' },
            ...(hasTemplatesAccess ? [{ label: 'Browse Templates', icon: <Description sx={{ fontSize: 18 }} />,  color: tokens.primary, bg: 'rgba(13,64,108,0.07)',   section: 'templates' }] : []),
            { label: 'View Reports',     icon: <BarChart sx={{ fontSize: 18 }} />,     color: tokens.warning, bg: 'rgba(245,158,11,0.09)',  section: 'reports' },
          ].map((a, i) => (
            <Box key={i} onClick={() => setActiveSection(a.section)} sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: { xs: 1.5, sm: 2.5 }, py: 1.5, borderRadius: 2.5, bgcolor: a.bg, cursor: 'pointer', flex: '1 1 130px', minWidth: { xs: 0, sm: 130 }, border: `1px solid ${a.color}18`, transition: 'opacity 0.15s', '&:hover': { opacity: 0.82 } }}>
              <Box sx={{ color: a.color }}>{a.icon}</Box>
              <Typography fontWeight={700} sx={{ color: a.color, fontSize: 13.5, fontFamily: "DM Sans,sans-serif" }}>{a.label}</Typography>
            </Box>
          ))}
        </Box>
      </Paper>

      {publishExamId && <PublishDialog examId={publishExamId} onClose={() => setPublishExamId(null)} setActiveSection={setActiveSection} />}
    </Box>
  );
}

/* ── EXAM PREVIEW PANEL ── */
function ExamPreviewPanel({ exam }) {
  const [activeSection, setActiveSection] = useState(null);
  const [activeQIdx, setActiveQIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(exam.timeLimit * 60);

  const sections = (exam.sections || []).filter(s => s.questions?.length > 0);

  useEffect(() => {
    if (sections.length > 0 && !activeSection) setActiveSection(sections[0].name);
  }, [sections]);

  useEffect(() => {
    const t = setInterval(() => setTimeLeft(p => Math.max(0, p - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  const fmt = (s) => `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  const timerColor = timeLeft < exam.timeLimit * 6 ? '#EF4444' : timeLeft < exam.timeLimit * 15 ? '#F59E0B' : tokens.primary;

  const curSection = sections.find(s => s.name === activeSection);
  const questions = curSection?.questions || [];
  const q = questions[activeQIdx];
  const allQ = sections.flatMap(s => s.questions || []);
  const answeredCount = Object.keys(answers).length;

  const setAnswer = (qId, val) => setAnswers(p => ({ ...p, [qId]: val }));

  const isOpen = q && (q.type === 'open-ended' || q.type === 'short-answer');
  const isFill = q && (q.type === 'fill-in-blank' || q.type === 'fill-blank');
  const isTF   = q && q.type === 'true-false';
  const isMC   = q && q.type === 'multiple-choice';
  const isMatching = q && q.type === 'matching';
  const isOrdering = q && q.type === 'ordering';
  const isDragDrop = q && q.type === 'drag-drop';
  const isImage = q && (q.type === 'image' || q.type === 'image-based');
  const hasSubQuestions = q && q.subQuestions && Array.isArray(q.subQuestions) && q.subQuestions.length > 0;

  return (
    <Box sx={{ bgcolor: '#F1F5F9', minHeight: 480 }}>
      {/* Preview banner */}
      <Box sx={{ bgcolor: '#1E293B', px: 3, py: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip label="PREVIEW MODE" size="small" sx={{ bgcolor: tokens.warning, color: 'white', fontWeight: 800, fontSize: 10, letterSpacing: 0.5 }} />
          <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, fontFamily: "DM Sans,sans-serif" }}>
            This is how students will see the exam — answers are not submitted
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: timerColor, px: 1.5, py: 0.5, borderRadius: 2 }}>
          <HourglassEmpty sx={{ color: 'white', fontSize: 15 }} />
          <Typography sx={{ color: 'white', fontWeight: 700, fontSize: 14, fontFamily: 'monospace' }}>{fmt(timeLeft)}</Typography>
        </Box>
      </Box>

      {sections.length === 0 ? (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Typography sx={{ color: tokens.textMuted, fontSize: 14 }}>No questions found. Add questions before previewing.</Typography>
        </Box>
      ) : (
        <Grid container sx={{ minHeight: 440 }}>
          {/* Left sidebar */}
          <Grid item xs={12} sm={3} sx={{ bgcolor: 'white', borderRight: `1px solid ${tokens.surfaceBorder}`, p: 2 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 12, color: tokens.textMuted, mb: 1.5, textTransform: 'uppercase', letterSpacing: 0.5 }}>Sections</Typography>
            {sections.map(sec => (
              <Box key={sec.name} onClick={() => { setActiveSection(sec.name); setActiveQIdx(0); }}
                sx={{ p: 1.5, mb: 0.75, borderRadius: 2, cursor: 'pointer', bgcolor: activeSection === sec.name ? tokens.primary : '#F8FAFC', color: activeSection === sec.name ? 'white' : tokens.textPrimary, fontWeight: 700, fontSize: 13, fontFamily: "DM Sans,sans-serif", border: `1px solid ${activeSection === sec.name ? tokens.primary : tokens.surfaceBorder}` }}>
                Section {sec.name}
                <Typography component="span" sx={{ fontSize: 11, fontWeight: 400, ml: 0.75, opacity: 0.8 }}>({sec.questions.length} q)</Typography>
              </Box>
            ))}
            <Divider sx={{ my: 1.5 }} />
            <Typography sx={{ fontWeight: 700, fontSize: 12, color: tokens.textMuted, mb: 1, textTransform: 'uppercase', letterSpacing: 0.5 }}>Questions</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {questions.map((qItem, i) => (
                <Box key={i} onClick={() => setActiveQIdx(i)}
                  sx={{ width: 28, height: 28, borderRadius: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 12, fontWeight: 700, bgcolor: answers[qItem._id] ? tokens.accent : activeQIdx === i ? tokens.primary : '#F1F5F9', color: answers[qItem._id] || activeQIdx === i ? 'white' : tokens.textSecondary, border: `1px solid ${activeQIdx === i ? tokens.primary : tokens.surfaceBorder}` }}>
                  {i + 1}
                </Box>
              ))}
            </Box>
            <Box sx={{ mt: 2, p: 1.5, borderRadius: 2, bgcolor: 'rgba(12,189,115,0.07)', border: `1px solid ${tokens.accent}` }}>
              <Typography sx={{ fontSize: 12, color: tokens.accentDark, fontWeight: 700 }}>{answeredCount}/{allQ.length} answered</Typography>
              <LinearProgress variant="determinate" value={allQ.length ? (answeredCount / allQ.length) * 100 : 0} sx={{ mt: 0.75, borderRadius: 2, height: 5, bgcolor: 'rgba(12,189,115,0.15)', '& .MuiLinearProgress-bar': { bgcolor: tokens.accent } }} />
            </Box>
          </Grid>

          {/* Main question area */}
          <Grid item xs={12} sm={9} sx={{ p: 3 }}>
            {q ? (
              <>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip label={`Q${activeQIdx + 1} of ${questions.length}`} sx={{ fontWeight: 700, bgcolor: tokens.primary, color: 'white' }} />
                    <Chip label={q.type?.replace(/-/g, ' ')} size="small" sx={{ bgcolor: '#F1F5F9', color: tokens.textSecondary, textTransform: 'capitalize' }} />
                    <Chip label={`${q.points} pt${q.points !== 1 ? 's' : ''}`} size="small" sx={{ bgcolor: 'rgba(245,158,11,0.1)', color: tokens.warning, fontWeight: 700 }} />
                  </Box>
                  <Chip label={q.difficulty || 'medium'} size="small" sx={{ bgcolor: q.difficulty === 'hard' ? 'rgba(239,68,68,0.1)' : q.difficulty === 'easy' ? 'rgba(12,189,115,0.1)' : 'rgba(245,158,11,0.1)', color: q.difficulty === 'hard' ? '#EF4444' : q.difficulty === 'easy' ? tokens.accent : tokens.warning, fontWeight: 700, textTransform: 'capitalize' }} />
                </Box>

                {/* Section-level passage, instructions, and word bank */}
                {curSection?.passage && (
                  <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2.5, border: `1px solid ${tokens.primary}`, bgcolor: 'rgba(59,130,246,0.03)', mb: 2.5 }}>
                    <Typography sx={{ fontSize: 13, fontWeight: 700, color: tokens.primary, mb: 1, textTransform: 'uppercase', letterSpacing: 0.5 }}>Passage</Typography>
                    <Typography sx={{ fontSize: 14, color: tokens.textPrimary, fontFamily: "DM Sans,sans-serif", lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{curSection.passage}</Typography>
                  </Paper>
                )}

                {curSection?.instructions && (
                  <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: `1px solid ${tokens.warning}`, bgcolor: 'rgba(245,158,11,0.05)', mb: 2.5 }}>
                    <Typography sx={{ fontSize: 13, fontWeight: 600, color: tokens.warning, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Info sx={{ fontSize: 16 }} />
                      Instructions
                    </Typography>
                    <Typography sx={{ fontSize: 13, color: tokens.textPrimary, mt: 1, fontFamily: "DM Sans,sans-serif", lineHeight: 1.6 }}>{curSection.instructions}</Typography>
                  </Paper>
                )}

                {curSection?.wordBank && curSection.wordBank.length > 0 && (
                  <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: `1px solid ${tokens.accent}`, bgcolor: 'rgba(12,189,115,0.05)', mb: 2.5 }}>
                    <Typography sx={{ fontSize: 13, fontWeight: 600, color: tokens.accent, mb: 1 }}>Word Bank</Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                      {curSection.wordBank.map((word, i) => (
                        <Chip key={i} label={word} size="small" sx={{ bgcolor: 'white', border: `1px solid ${tokens.accent}`, color: tokens.textPrimary, fontSize: 12 }} />
                      ))}
                    </Box>
                  </Paper>
                )}

                <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2.5, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white', mb: 2.5 }}>
                  {q.text && (
                    <Typography sx={{ fontSize: 15, fontWeight: 600, color: tokens.textPrimary, fontFamily: "DM Sans,sans-serif", lineHeight: 1.6, mb: (q.imageUrl || q.image) ? 2 : 0 }}>{q.text}</Typography>
                  )}
                  {(q.imageUrl || q.image) && (
                    <Box
                      component="img"
                      src={getImageUrl(q.imageUrl || q.image)}
                      alt="Question image"
                      sx={{ display: 'block', maxWidth: '100%', maxHeight: isImage ? 480 : 320, borderRadius: 2, objectFit: 'contain', mx: isImage ? 'auto' : 0 }}
                    />
                  )}
                  {isImage && !(q.imageUrl || q.image) && (
                    <Box sx={{ p: 4, textAlign: 'center', border: `2px dashed ${tokens.surfaceBorder}`, borderRadius: 2, bgcolor: '#F8FAFC' }}>
                      <Typography sx={{ fontSize: 13, color: tokens.textMuted }}>No image attached to this question.</Typography>
                    </Box>
                  )}
                </Paper>

                {/* Multiple choice */}
                {isMC && !hasSubQuestions && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {(q.options || []).map((opt, oi) => {
                      const letter = opt.letter || String.fromCharCode(65 + oi);
                      const selected = answers[q._id] === letter;
                      return (
                        <Box key={oi} onClick={() => setAnswer(q._id, letter)}
                          sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.75, borderRadius: 2, cursor: 'pointer', border: `2px solid ${selected ? tokens.accent : tokens.surfaceBorder}`, bgcolor: selected ? 'rgba(12,189,115,0.06)' : 'white', transition: 'all 0.15s', '&:hover': { borderColor: tokens.accent, bgcolor: 'rgba(12,189,115,0.03)' } }}>
                          <Box sx={{ width: 28, height: 28, borderRadius: '50%', border: `2px solid ${selected ? tokens.accent : tokens.surfaceBorder}`, bgcolor: selected ? tokens.accent : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {selected ? <CheckCircle sx={{ fontSize: 16, color: 'white' }} /> : <Typography sx={{ fontSize: 12, fontWeight: 700, color: tokens.textSecondary }}>{letter}</Typography>}
                          </Box>
                          <Typography sx={{ fontSize: 14, color: tokens.textPrimary, fontFamily: "DM Sans,sans-serif" }}>{opt.text}</Typography>
                        </Box>
                      );
                    })}
                  </Box>
                )}

                {/* True / False */}
                {isTF && !hasSubQuestions && (
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    {['True', 'False'].map(val => {
                      const sel = answers[q._id] === val;
                      return (
                        <Box key={val} onClick={() => setAnswer(q._id, val)}
                          sx={{ flex: 1, p: 2.5, borderRadius: 2.5, textAlign: 'center', cursor: 'pointer', border: `2px solid ${sel ? tokens.accent : tokens.surfaceBorder}`, bgcolor: sel ? 'rgba(12,189,115,0.07)' : 'white', fontWeight: 700, fontSize: 16, color: sel ? tokens.accentDark : tokens.textSecondary, transition: 'all 0.15s', '&:hover': { borderColor: tokens.accent } }}>
                          {val}
                        </Box>
                      );
                    })}
                  </Box>
                )}

                {/* Fill blank */}
                {isFill && !hasSubQuestions && (
                  <TextField fullWidth placeholder="Type your answer here…" value={answers[q._id] || ''}
                    onChange={e => setAnswer(q._id, e.target.value)}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, fontSize: 14, bgcolor: 'white' } }} />
                )}

                {/* Open / Short */}
                {isOpen && !hasSubQuestions && (
                  <TextField fullWidth multiline minRows={4} placeholder="Write your answer here…" value={answers[q._id] || ''}
                    onChange={e => setAnswer(q._id, e.target.value)}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, fontSize: 14, bgcolor: 'white' } }} />
                )}

                {/* Matching */}
                {isMatching && !hasSubQuestions && (
                  <Box>
                    <Typography sx={{ fontSize: 13, fontWeight: 600, color: tokens.textSecondary, mb: 2 }}>
                      Drag items from the right to match with items on the left
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={6}>
                        <Typography sx={{ fontSize: 12, fontWeight: 700, color: tokens.primary, mb: 1.5 }}>Match These:</Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                          {(q.leftItems || []).map((item, i) => (
                            <Paper key={i} sx={{ p: 1.5, borderRadius: 1.5, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white' }}>
                              <Typography sx={{ fontSize: 13, color: tokens.textPrimary }}>{typeof item === 'string' ? item : item.text}</Typography>
                            </Paper>
                          ))}
                        </Box>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography sx={{ fontSize: 12, fontWeight: 700, color: tokens.accent, mb: 1.5 }}>Items to Match:</Typography>
                        <Paper sx={{ p: 1.5, borderRadius: 1.5, bgcolor: '#F8FAFC', minHeight: 100 }}>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {(q.rightItems || []).map((item, i) => (
                              <Chip key={i} label={typeof item === 'string' ? item : item.text} size="small" sx={{ bgcolor: 'white', border: `1px solid ${tokens.accent}`, fontSize: 12 }} />
                            ))}
                          </Box>
                        </Paper>
                      </Grid>
                    </Grid>
                  </Box>
                )}

                {/* Ordering */}
                {isOrdering && !hasSubQuestions && (
                  <Box>
                    <Typography sx={{ fontSize: 13, fontWeight: 600, color: tokens.textSecondary, mb: 2 }}>
                      Drag to reorder the items in the correct sequence
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {(q.items || q.itemsToOrder?.items || []).map((item, i) => (
                        <Paper key={i} sx={{ p: 1.5, borderRadius: 1.5, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white', display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography sx={{ fontSize: 12, fontWeight: 700, color: tokens.textSecondary, minWidth: 24 }}>{i + 1}.</Typography>
                          <Typography sx={{ fontSize: 13, color: tokens.textPrimary }}>{typeof item === 'string' ? item : item.text}</Typography>
                        </Paper>
                      ))}
                    </Box>
                  </Box>
                )}

                {/* Image / Image-based */}
                {isImage && !hasSubQuestions && (
                  <Box>
                    <Typography sx={{ fontSize: 13, fontWeight: 600, color: tokens.textSecondary, mb: 1.5 }}>
                      Study the image above and write your answer below.
                    </Typography>
                    <TextField
                      fullWidth
                      multiline
                      minRows={4}
                      placeholder="Write your answer here…"
                      value={answers[q._id] || ''}
                      onChange={e => setAnswer(q._id, e.target.value)}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, fontSize: 14, bgcolor: 'white' } }}
                    />
                  </Box>
                )}

                {/* Drag-Drop */}
                {isDragDrop && !hasSubQuestions && (
                  <Box>
                    <Typography sx={{ fontSize: 13, fontWeight: 600, color: tokens.textSecondary, mb: 2 }}>
                      Drag items to their correct drop zones
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={6}>
                        <Typography sx={{ fontSize: 12, fontWeight: 700, color: tokens.primary, mb: 1.5 }}>Drop Zones:</Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                          {(q.dropZones || q.dragDropData?.dropZones || []).map((zone, i) => (
                            <Paper key={i} sx={{ p: 2, borderRadius: 1.5, border: `2px dashed ${tokens.surfaceBorder}`, bgcolor: '#F8FAFC', minHeight: 60 }}>
                              <Typography sx={{ fontSize: 13, color: tokens.textSecondary, fontStyle: 'italic' }}>{typeof zone === 'string' ? zone : zone.label || `Zone ${i + 1}`}</Typography>
                            </Paper>
                          ))}
                        </Box>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography sx={{ fontSize: 12, fontWeight: 700, color: tokens.accent, mb: 1.5 }}>Draggable Items:</Typography>
                        <Paper sx={{ p: 1.5, borderRadius: 1.5, bgcolor: '#F8FAFC', minHeight: 100 }}>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {(q.draggableItems || q.dragDropData?.draggableItems || []).map((item, i) => (
                              <Chip key={i} label={typeof item === 'string' ? item : item.text} size="small" sx={{ bgcolor: 'white', border: `1px solid ${tokens.accent}`, fontSize: 12 }} />
                            ))}
                          </Box>
                        </Paper>
                      </Grid>
                    </Grid>
                  </Box>
                )}

                {/* Sub-Questions */}
                {hasSubQuestions && (
                  <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2.5, border: `1px solid ${tokens.accent}`, bgcolor: 'rgba(12,189,115,0.03)', mt: 2.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                      <Typography sx={{ fontSize: 14, fontWeight: 700, color: tokens.accentDark, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Sub-Questions ({q.subQuestions.length})
                      </Typography>
                      {q.subQuestionConfig && (
                        <Chip 
                          label={q.subQuestionConfig.mode === 'all' ? 'Answer All' : `Choose ${q.subQuestionConfig.requiredCount || 1}`}
                          size="small"
                          sx={{ bgcolor: tokens.warning, color: 'white', fontWeight: 700, fontSize: 11 }}
                        />
                      )}
                    </Box>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {q.subQuestions.map((subQ, subIdx) => {
                        const subQId = `${q._id}_sub_${subIdx}`;
                        const isSubMC = subQ.type === 'multiple-choice';
                        const isSubOpen = subQ.type === 'open-ended' || subQ.type === 'short-answer';
                        const isSubTF = subQ.type === 'true-false';
                        const isSubFill = subQ.type === 'fill-in-blank' || subQ.type === 'fill-blank';
                        
                        return (
                          <Paper key={subIdx} elevation={0} sx={{ p: 2, borderRadius: 2, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white' }}>
                            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1.5 }}>
                              <Chip 
                                label={subQ.label || String.fromCharCode(97 + subIdx) + ')'} 
                                size="small" 
                                sx={{ bgcolor: tokens.primary, color: 'white', fontWeight: 700, fontSize: 11, minWidth: 32 }}
                              />
                              <Typography sx={{ fontSize: 13, fontWeight: 600, color: tokens.textPrimary, flex: 1 }}>
                                {subQ.text}
                              </Typography>
                              <Chip 
                                label={`${subQ.points || 1} pt`} 
                                size="small" 
                                sx={{ bgcolor: 'rgba(245,158,11,0.1)', color: tokens.warning, fontWeight: 700, fontSize: 10 }}
                              />
                            </Box>
                            
                            {/* Sub-question MCQ */}
                            {isSubMC && subQ.options && (
                              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, pl: 4 }}>
                                {subQ.options.map((opt, optIdx) => {
                                  const letter = opt.letter || String.fromCharCode(97 + optIdx);
                                  const selected = answers[subQId] === letter;
                                  return (
                                    <Box key={optIdx} onClick={() => setAnswer(subQId, letter)}
                                      sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, borderRadius: 1.5, cursor: 'pointer', border: `1px solid ${selected ? tokens.accent : tokens.surfaceBorder}`, bgcolor: selected ? 'rgba(12,189,115,0.06)' : '#F8FAFC', transition: 'all 0.15s', '&:hover': { borderColor: tokens.accent } }}>
                                      <Box sx={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${selected ? tokens.accent : tokens.surfaceBorder}`, bgcolor: selected ? tokens.accent : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        {selected ? <CheckCircle sx={{ fontSize: 12, color: 'white' }} /> : <Typography sx={{ fontSize: 10, fontWeight: 700, color: tokens.textSecondary }}>{letter}</Typography>}
                                      </Box>
                                      <Typography sx={{ fontSize: 12, color: tokens.textPrimary }}>{opt.text}</Typography>
                                    </Box>
                                  );
                                })}
                              </Box>
                            )}
                            
                            {/* Sub-question True/False */}
                            {isSubTF && (
                              <Box sx={{ display: 'flex', gap: 1.5, pl: 4 }}>
                                {['True', 'False'].map(val => {
                                  const sel = answers[subQId] === val;
                                  return (
                                    <Box key={val} onClick={() => setAnswer(subQId, val)}
                                      sx={{ flex: 1, p: 1.5, borderRadius: 1.5, textAlign: 'center', cursor: 'pointer', border: `1px solid ${sel ? tokens.accent : tokens.surfaceBorder}`, bgcolor: sel ? 'rgba(12,189,115,0.07)' : '#F8FAFC', fontWeight: 700, fontSize: 13, color: sel ? tokens.accentDark : tokens.textSecondary }}>
                                      {val}
                                    </Box>
                                  );
                                })}
                              </Box>
                            )}
                            
                            {/* Sub-question Fill-in-blank */}
                            {isSubFill && (
                              <TextField 
                                fullWidth 
                                size="small"
                                placeholder="Type your answer..." 
                                value={answers[subQId] || ''}
                                onChange={e => setAnswer(subQId, e.target.value)}
                                sx={{ pl: 4, '& .MuiOutlinedInput-root': { borderRadius: 1.5, fontSize: 12, bgcolor: '#F8FAFC' } }} 
                              />
                            )}
                            
                            {/* Sub-question Open-ended */}
                            {isSubOpen && (
                              <TextField 
                                fullWidth 
                                multiline 
                                minRows={2}
                                size="small"
                                placeholder="Write your answer..." 
                                value={answers[subQId] || ''}
                                onChange={e => setAnswer(subQId, e.target.value)}
                                sx={{ pl: 4, '& .MuiOutlinedInput-root': { borderRadius: 1.5, fontSize: 12, bgcolor: '#F8FAFC' } }} 
                              />
                            )}
                          </Paper>
                        );
                      })}
                    </Box>
                  </Paper>
                )}

                {/* Navigation */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
                  <Button startIcon={<ArrowForward sx={{ transform: 'scaleX(-1)' }} />} disabled={activeQIdx === 0}
                    onClick={() => setActiveQIdx(p => p - 1)}
                    sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, color: tokens.textSecondary }}>
                    Previous
                  </Button>
                  <Button variant="contained" endIcon={<ArrowForward />}
                    disabled={activeQIdx === questions.length - 1}
                    onClick={() => setActiveQIdx(p => p + 1)}
                    sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, background: gradients.brand, boxShadow: 'none' }}>
                    Next Question
                  </Button>
                </Box>
              </>
            ) : (
              <Typography sx={{ color: tokens.textMuted, textAlign: 'center', pt: 6 }}>Select a section to begin.</Typography>
            )}
          </Grid>
        </Grid>
      )}
    </Box>
  );
}

/* ── PUBLISH DIALOG ── */
function PublishDialog({ examId, onClose, setActiveSection }) {
  console.log('PublishDialog render');
  const { user } = useAuth();
  const { hasMarketplaceAccess } = usePlan();
  const isXs = useMediaQuery('(max-width:600px)');
  const [tab, setTab] = useState(0);
  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [shareResult, setShareResult] = useState(null);
  const [shareSettings, setShareSettings] = useState({ publicAccess: true, requirePassword: false, password: '', allowMultipleAttempts: false, showResults: true, maxStudents: '', expiresAt: '' });
  const [studentRows, setStudentRows] = useState([{ firstName: '', lastName: '', email: '', class: '' }]);
  const [creating, setCreating] = useState(false);
  const [createResult, setCreateResult] = useState(null);
  const [snack, setSnack] = useState('');
  const [copied, setCopied] = useState('');
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [editingSectionIndex, setEditingSectionIndex] = useState(null);
  const [editingQuestionIndex, setEditingQuestionIndex] = useState(null);
  
  // Add question state
  const [addQuestionDialogOpen, setAddQuestionDialogOpen] = useState(false);
  const [addingSectionIndex, setAddingSectionIndex] = useState(null);
  const [newQuestion, setNewQuestion] = useState({
    text: '',
    type: 'multiple-choice',
    points: 2,
    options: [
      { text: '', isCorrect: false, letter: 'A' },
      { text: '', isCorrect: false, letter: 'B' },
      { text: '', isCorrect: false, letter: 'C' },
      { text: '', isCorrect: false, letter: 'D' }
    ],
    correctAnswer: '',
    matchingPairs: { leftColumn: ['', ''], rightColumn: ['', ''] },
    itemsToOrder: { items: ['', '', ''] },
    image: null,
    imageUrl: ''
  });
  
  const [studentSelectionMode, setStudentSelectionMode] = useState('select'); // 'manual' or 'select'
  const [existingStudents, setExistingStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const [studentSortBy, setStudentSortBy] = useState('name');
  const [createStudentDialog, setCreateStudentDialog] = useState(false);
  const [newStudentForm, setNewStudentForm] = useState({ firstName: '', lastName: '', email: '', phone: '', class: '', gender: '' });
  const [newStudentFormError, setNewStudentFormError] = useState('');
  const [creatingStudent, setCreatingStudent] = useState(false);
  const [assignedStudents, setAssignedStudents] = useState([]);
  const [loadingAssigned, setLoadingAssigned] = useState(false);
  const [examResults, setExamResults] = useState([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [resettingExpiration, setResettingExpiration] = useState(false);
  const [shareStats, setShareStats] = useState(null);
  const [addingToBank, setAddingToBank] = useState(false);

  useEffect(() => {
    api.get(`/admin/exams/${examId}/preview`).then(r => {
      setPreview(r.data);
      if (r.data?.exam?.assignedTo) {
        fetchAssignedStudents(r.data.exam.assignedTo);
      }
    }).catch(() => {}).finally(() => setLoadingPreview(false));
  }, [examId]);

  useEffect(() => {
    if (studentSelectionMode === 'select') {
      fetchExistingStudents();
    }
  }, [studentSelectionMode]);

  useEffect(() => {
    if (tab === 2) {
      fetchExistingStudents();
      fetchExamResults();
    }
  }, [tab]);

  useEffect(() => {
    if (shareResult?.shareId) {
      fetchShareStats(shareResult.shareId);
    }
  }, [shareResult]);

  const fetchExistingStudents = async () => {
    setLoadingStudents(true);
    try {
      const res = await api.get('/admin/students');
      setExistingStudents(res.data || []);
    } catch (err) {
      console.error('Error fetching students:', err);
      setSnack('Failed to load existing students');
    } finally {
      setLoadingStudents(false);
    }
  };

  const handleCreateNewStudent = async () => {
    if (!newStudentForm.firstName.trim() || !newStudentForm.lastName.trim() || !newStudentForm.email.trim()) {
      setNewStudentFormError('First name, last name and email are required.');
      return;
    }
    setCreatingStudent(true);
    setNewStudentFormError('');
    try {
      const res = await api.post('/admin/students', newStudentForm);
      const newStudent = res.data;
      setExistingStudents(prev => [...prev, newStudent]);
      setSelectedStudentIds(prev => [...prev, newStudent._id.toString()]);
      setSnack('✓ Student created successfully');
      setCreateStudentDialog(false);
      setNewStudentForm({ firstName: '', lastName: '', email: '', phone: '', class: '', gender: '' });
    } catch (err) {
      setNewStudentFormError(err.response?.data?.message || 'Failed to create student');
    } finally {
      setCreatingStudent(false);
    }
  };

  const fetchAssignedStudents = async (studentIds) => {
    setLoadingAssigned(true);
    try {
      const res = await api.get('/admin/students');
      const allStudents = res.data || [];
      const assigned = allStudents.filter(s => studentIds.includes(s._id.toString()));
      setAssignedStudents(assigned);
    } catch (err) {
      console.error('Error fetching assigned students:', err);
    } finally {
      setLoadingAssigned(false);
    }
  };

  const fetchExamResults = async () => {
    setLoadingResults(true);
    try {
      const res = await api.get(`/admin/exams/${examId}/results`);
      setExamResults(res.data || []);
    } catch (err) {
      console.error('Error fetching exam results:', err);
    } finally {
      setLoadingResults(false);
    }
  };

  const handleRemoveStudent = async (studentId) => {
    try {
      await api.delete(`/admin/exams/${examId}/students/${studentId}`);
      setAssignedStudents(p => p.filter(s => s._id !== studentId));
      setSnack('Student removed from exam');
    } catch (err) {
      console.error('Error removing student:', err);
      setSnack(err.response?.data?.message || 'Failed to remove student');
    }
  };

  const handleShare = async (type) => {
    setSharing(true);
    try {
      const settings = { ...shareSettings, maxStudents: shareSettings.maxStudents ? +shareSettings.maxStudents : null, expiresAt: shareSettings.expiresAt || null };
      const r = await api.post(`/admin/exams/${examId}/share`, { shareType: type, settings });
      setShareResult(r.data.shareData);
    } catch (err) { setSnack(err.response?.data?.message || 'Failed to create share link'); }
    finally { setSharing(false); }
  };

  const isShareExpired = () => {
    const expiresAt = shareResult?.expiresAt || shareResult?.settings?.expiresAt;
    if (!expiresAt) return false;
    return new Date() > new Date(expiresAt);
  };

  const handleResetExpiration = async () => {
    if (!shareResult?.shareId) return;
    setResettingExpiration(true);
    try {
      const r = await api.post(`/share/${shareResult.shareId}/reset-expiration`);
      setShareResult(prev => ({
        ...prev,
        expiresAt: r.data.shareData.expiresAt,
        settings: { ...prev.settings, expiresAt: r.data.shareData.expiresAt }
      }));
      setSnack('Share link expiration reset successfully. Students can now join the exam.');
    } catch (err) {
      setSnack(err.response?.data?.message || 'Failed to reset expiration');
    } finally {
      setResettingExpiration(false);
    }
  };

  const handleRemoveSharedStudent = async (shareToken, studentId) => {
    try {
      await api.delete(`/share/${shareToken}/students/${studentId}`);
      setSnack('Student removed successfully');
      // Refresh share stats to update student list
      if (shareResult?.shareId) {
        fetchShareStats(shareResult.shareId);
      }
    } catch (err) {
      console.error('Error removing student:', err);
      setSnack(err.response?.data?.message || 'Failed to remove student');
    }
  };

  const fetchShareStats = async (shareId) => {
    try {
      const res = await api.get(`/share/${shareId}/stats`);
      setShareStats(res.data.stats);
    } catch (err) {
      console.error('Error fetching share stats:', err);
    }
  };

  const handleAddToQuestionBank = async () => {
    const userPlan = user?.subscriptionPlan?.toLowerCase() || 'free';
    console.log('User plan:', userPlan); // Debug log
    console.log('User subscriptionPlan:', user?.subscriptionPlan); // Debug log
    
    // More flexible check for premium/enterprise plans
    if (!userPlan.includes('premium') && !userPlan.includes('enterprise')) {
      setSnack('Adding exams to the question bank requires a Premium plan or higher');
      return;
    }

    setAddingToBank(true);
    try {
      await api.post(`/question-bank/${examId}/add`);
      setSnack('✓ Exam added to question bank successfully!');
      // Refresh the preview to show updated status
      const r = await api.get(`/admin/exams/${examId}/preview`);
      setPreview(r.data);
    } catch (err) {
      console.error('Error adding to question bank:', err);
      setSnack(err.response?.data?.message || 'Failed to add exam to question bank');
    } finally {
      setAddingToBank(false);
    }
  };

  const copyLink = (link, label) => { navigator.clipboard.writeText(link); setCopied(label); setTimeout(() => setCopied(''), 2500); };

  const addRow = () => setStudentRows(p => [...p, { firstName: '', lastName: '', email: '', class: '', id: Date.now() }]);
  const removeRow = (i) => setStudentRows(p => p.filter((_, idx) => idx !== i));
  const updateRow = useCallback((i, field, val) => {
    setStudentRows(p => p.map((r, idx) => idx === i ? { ...r, [field]: val } : r));
  }, []);

  const handleCreateAccounts = async () => {
    if (selectedStudentIds.length === 0) { setSnack('Please select at least one student to assign.'); return; }
    setCreating(true);
    try {
      // Assign existing students to exam
      const studentsToAssign = existingStudents.filter(s => selectedStudentIds.includes(s._id.toString()));
      const r = await api.post(`/admin/exams/${examId}/students`, { students: studentsToAssign.map(s => ({ firstName: s.firstName, lastName: s.lastName, email: s.email, class: s.class })) });
      setCreateResult(r.data);
      if (!shareResult) handleShare('email');
      // Refresh assigned students list
      fetchAssignedStudents(preview?.exam?.assignedTo || []);
      // Clear selection
      setSelectedStudentIds([]);
    } catch (err) { setSnack(err.response?.data?.message || 'Failed to assign students'); }
    finally { setCreating(false); }
  };

  const handleEditQuestion = (question, sectionIndex, questionIndex) => {
    setEditingQuestion({ ...question });
    setEditingSectionIndex(sectionIndex);
    setEditingQuestionIndex(questionIndex);
  };

  const handleSaveQuestionEdit = async () => {
    if (!editingQuestion || !exam) return;
    try {
      let finalImageUrl = editingQuestion.imageUrl || '';

      // If a new File was selected (not yet uploaded), upload it to Cloudinary first
      if (editingQuestion.image instanceof File) {
        const formData = new FormData();
        formData.append('image', editingQuestion.image);
        const uploadRes = await api.post('/admin/upload-image', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 30000
        });
        finalImageUrl = uploadRes.data.url;
      } else if (finalImageUrl.startsWith('data:')) {
        // base64 preview without a File — shouldn't be stored; clear it
        finalImageUrl = '';
      }

      // Update the question via the exam update endpoint using questions array
      await api.put(`/admin/exams/${exam._id}`, {
        questions: [{ ...editingQuestion, image: undefined, imageUrl: finalImageUrl, _id: editingQuestion._id }]
      }, { timeout: 30000 });

      // Refresh the preview
      const r = await api.get(`/admin/exams/${examId}/preview`);
      setPreview(r.data);
      setEditingQuestion(null);
      setSnack('Question updated successfully');
    } catch (err) {
      setSnack(err.response?.data?.message || 'Failed to update question');
    }
  };

  const handleDeleteQuestion = async (sectionIndex, questionIndex) => {
    if (!exam) return;
    if (!window.confirm('Are you sure you want to delete this question?')) return;

    try {
      const updatedSections = [...exam.sections];
      updatedSections[sectionIndex].questions.splice(questionIndex, 1);

      await api.put(`/admin/exams/${exam._id}`, {
        title: exam.title,
        description: exam.description,
        timeLimit: exam.timeLimit,
        passingScore: exam.passingScore,
        sections: updatedSections
      }, { timeout: 30000 }); // 30 second timeout for exam updates

      // Update local exam state
      setExam(prev => ({ ...prev, sections: updatedSections }));

      // Refresh the preview (optional - don't fail if this errors)
      try {
        const r = await api.get(`/admin/exams/${examId}/preview`);
        setPreview(r.data);
      } catch (previewErr) {
        console.error('Preview refresh failed:', previewErr);
      }

      setSnack('Question deleted successfully');
    } catch (err) {
      console.error('Delete question error:', err);
      setSnack(err.response?.data?.message || 'Failed to delete question');
    }
  };

  // Open add question dialog
  const handleOpenAddQuestion = (sectionIndex) => {
    setAddingSectionIndex(sectionIndex);
    setNewQuestion({
      text: '',
      type: 'multiple-choice',
      points: 2,
      options: [
        { text: '', isCorrect: false, letter: 'A' },
        { text: '', isCorrect: false, letter: 'B' },
        { text: '', isCorrect: false, letter: 'C' },
        { text: '', isCorrect: false, letter: 'D' }
      ],
      correctAnswer: '',
      matchingPairs: { leftColumn: ['', ''], rightColumn: ['', ''] },
      itemsToOrder: { items: ['', '', ''] },
      image: null,
      imageUrl: ''
    });
    setAddQuestionDialogOpen(true);
  };

  // Close add question dialog
  const handleCloseAddQuestion = () => {
    setAddQuestionDialogOpen(false);
    setAddingSectionIndex(null);
  };

  // Handle image upload
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewQuestion({
          ...newQuestion,
          image: file,
          imageUrl: reader.result
        });
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle image removal
  const handleRemoveImage = () => {
    setNewQuestion({
      ...newQuestion,
      image: null,
      imageUrl: ''
    });
  };

  // Handle question type change for new question
  const handleNewQuestionTypeChange = (type) => {
    if (type === 'true-false') {
      setNewQuestion({
        ...newQuestion,
        type,
        options: [
          { text: 'True', isCorrect: false, letter: 'A' },
          { text: 'False', isCorrect: false, letter: 'B' }
        ],
        correctAnswer: ''
      });
    } else if (type === 'multiple-choice') {
      setNewQuestion({
        ...newQuestion,
        type,
        options: [
          { text: '', isCorrect: false, letter: 'A' },
          { text: '', isCorrect: false, letter: 'B' },
          { text: '', isCorrect: false, letter: 'C' },
          { text: '', isCorrect: false, letter: 'D' }
        ],
        correctAnswer: ''
      });
    } else if (type === 'matching') {
      setNewQuestion({
        ...newQuestion,
        type,
        options: [],
        correctAnswer: '',
        matchingPairs: { leftColumn: ['', ''], rightColumn: ['', ''] }
      });
    } else if (type === 'ordering') {
      setNewQuestion({
        ...newQuestion,
        type,
        options: [],
        correctAnswer: '',
        itemsToOrder: { items: ['', '', ''] }
      });
    } else if (type === 'image') {
      setNewQuestion({
        ...newQuestion,
        type,
        options: [],
        correctAnswer: ''
      });
    } else {
      setNewQuestion({
        ...newQuestion,
        type,
        options: [],
        correctAnswer: ''
      });
    }
  };

  // Handle option change for new question
  const handleNewOptionChange = (index, value) => {
    const updatedOptions = [...newQuestion.options];
    updatedOptions[index] = { ...updatedOptions[index], text: value };
    setNewQuestion({ ...newQuestion, options: updatedOptions });
  };

  // Handle correct answer selection for new question
  const handleNewCorrectAnswerChange = (index) => {
    const updatedOptions = newQuestion.options.map((opt, i) => ({
      ...opt,
      isCorrect: i === index
    }));
    setNewQuestion({ ...newQuestion, options: updatedOptions });
  };

  // Add new option for new question
  const handleAddNewOption = () => {
    const nextLetter = String.fromCharCode(65 + newQuestion.options.length);
    setNewQuestion({
      ...newQuestion,
      options: [...newQuestion.options, { text: '', isCorrect: false, letter: nextLetter }]
    });
  };

  // Remove option for new question
  const handleRemoveNewOption = (index) => {
    const updatedOptions = newQuestion.options.filter((_, i) => i !== index);
    const reassignedOptions = updatedOptions.map((opt, i) => ({
      ...opt,
      letter: String.fromCharCode(65 + i)
    }));
    setNewQuestion({ ...newQuestion, options: reassignedOptions });
  };

  // Add question to section
  const handleAddQuestion = async () => {
    if (!newQuestion.text.trim() && !newQuestion.image) {
      setSnack('Question text or image is required');
      return;
    }

    // For multiple-choice and true-false, ensure a correct answer is selected
    if (newQuestion.type === 'multiple-choice' || newQuestion.type === 'true-false') {
      const hasCorrectAnswer = newQuestion.options.some(opt => opt.isCorrect);
      if (!hasCorrectAnswer) {
        setSnack('Please select the correct answer');
        return;
      }
    }

    try {
      const updatedSections = [...exam.sections];
      
      // Prepare question data - don't send empty options for non-option-based question types
      const questionToAdd = {
        ...newQuestion,
        id: Date.now().toString(),
        section: exam.sections[addingSectionIndex].name
      };
      
      // Remove options array for question types that don't use it
      if (newQuestion.type === 'image' || newQuestion.type === 'open-ended' || 
          newQuestion.type === 'short-answer' || newQuestion.type === 'fill-blank') {
        delete questionToAdd.options;
      }
      
      updatedSections[addingSectionIndex].questions = [
        ...(updatedSections[addingSectionIndex].questions || []),
        questionToAdd
      ];

      await api.put(`/admin/exams/${exam._id}`, {
        title: exam.title,
        description: exam.description,
        timeLimit: exam.timeLimit,
        passingScore: exam.passingScore,
        sections: updatedSections
      });

      // Refresh the preview
      const r = await api.get(`/admin/exams/${examId}/preview`);
      setPreview(r.data);
      setAddQuestionDialogOpen(false);
      setSnack('Question added successfully');
    } catch (err) {
      setSnack(err.response?.data?.message || 'Failed to add question');
    }
  };

  const exam = preview?.exam;
  const allQ = exam ? exam.sections.flatMap(s => s.questions || []) : [];

  return (
    <>
    <Dialog open onClose={onClose} maxWidth="md" fullWidth fullScreen={isXs} PaperProps={{ sx: { borderRadius: isXs ? 0 : 3, overflow: 'hidden' } }}>
      {/* Header */}
      <Box sx={{ background: gradients.brand, px: 3, py: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Publish sx={{ color: 'white', fontSize: 24 }} />
          <Box>
            <Typography fontWeight={700} color="white" sx={{ fontSize: 17, fontFamily: "DM Sans,sans-serif" }}>
              {loadingPreview ? 'Loading…' : exam?.title || 'Publish Exam'}
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, fontFamily: "DM Sans,sans-serif" }}>
              Preview · Share · Invite Students
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {hasMarketplaceAccess && (
            <Button
              size="small"
              variant="outlined"
              onClick={handleAddToQuestionBank}
              disabled={addingToBank}
              sx={{
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 700,
                borderColor: 'rgba(255,255,255,0.5)',
                color: 'white',
                fontSize: 12,
                px: 2,
                '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' }
              }}
            >
              {addingToBank ? 'Adding...' : 'Add to Exam Bank'}
            </Button>
          )}
          <IconButton onClick={onClose} sx={{ color: 'white' }}><Close /></IconButton>
        </Box>
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white' }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ minHeight: 44, '& .MuiTab-root': { fontWeight: 700, fontSize: 13, textTransform: 'none', fontFamily: "DM Sans,sans-serif", minHeight: 44 }, '& .MuiTabs-indicator': { backgroundColor: tokens.primary } }}>
          <Tab label="👁 Preview" />
          <Tab label="✏️ Edit Questions" />
          <Tab label="🔒 Private / Invite" />
          {hasMarketplaceAccess && <Tab label="🌐 Public Marketplace" />}
        </Tabs>
      </Box>

      <DialogContent sx={{ p: 0, bgcolor: '#F8FAFC' }}>
        {/* TAB 0 — PREVIEW (student exam-taking view) */}
        {tab === 0 && (
          loadingPreview
            ? <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress sx={{ color: tokens.accent }} /></Box>
            : exam
              ? <ExamPreviewPanel exam={exam} />
              : <Typography sx={{ color: tokens.textMuted, textAlign: 'center', py: 5 }}>Could not load exam preview.</Typography>
        )}

        {/* TAB 1 — EDIT QUESTIONS */}
        {tab === 1 && (
          <Box sx={{ p: 3, maxHeight: '70vh', overflowY: 'auto' }}>
            {exam && exam.sections && exam.sections.length > 0 ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                {exam.sections.map((sec, si) => (
                  <Paper key={si} elevation={0} sx={{ p: 2.5, borderRadius: 2.5, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                      <Box>
                        <Typography fontWeight={700} sx={{ fontSize: 15, fontFamily: "DM Sans,sans-serif" }}>Section {sec.name}</Typography>
                        <Typography sx={{ fontSize: 12, color: tokens.textMuted }}>{sec.description}</Typography>
                      </Box>
                      <Chip label={`${sec.questions?.length || 0} questions`} sx={{ bgcolor: 'rgba(12,189,115,0.1)', color: tokens.accent, fontWeight: 700 }} />
                    </Box>
                    {sec.questions && sec.questions.length > 0 ? (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        {sec.questions.map((q, qi) => (
                          <Paper key={qi} elevation={0} sx={{ p: 1.5, borderRadius: 2, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: '#F8FAFC', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
                            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75, flexWrap: 'wrap' }}>
                                <Chip label={`Q${qi + 1}`} size="small" sx={{ bgcolor: tokens.primary, color: 'white', fontWeight: 700, minWidth: 32 }} />
                                <Chip label={q.type?.replace(/-/g, ' ')} size="small" sx={{ bgcolor: '#F1F5F9', color: tokens.textSecondary, fontSize: 11, textTransform: 'capitalize' }} />
                                <Chip label={`${q.points}pt`} size="small" sx={{ bgcolor: 'rgba(245,158,11,0.1)', color: tokens.warning, fontWeight: 700, fontSize: 11 }} />
                                {q.subQuestions && Array.isArray(q.subQuestions) && q.subQuestions.length > 0 && (
                                  <Chip label={`${q.subQuestions.length} Sub-Q${q.subQuestions.length > 1 ? 's' : ''}`} size="small" sx={{ bgcolor: '#DCFCE7', color: '#166534', fontWeight: 700, fontSize: 10 }} />
                                )}
                              </Box>
                              <Typography sx={{ fontSize: 13, color: tokens.textPrimary, fontFamily: "DM Sans,sans-serif", lineHeight: 1.5 }}>{q.text}</Typography>
                              {(q.imageUrl || q.image) && (
                                <Box
                                  component="img"
                                  src={getImageUrl(q.imageUrl || q.image)}
                                  alt="Question image"
                                  sx={{ maxWidth: 200, maxHeight: 150, borderRadius: 1, mt: 1, objectFit: 'contain' }}
                                />
                              )}
                              {q.type === 'multiple-choice' && q.options && q.options.length > 0 && (
                                <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                                  {q.options.map((opt, oi) => (
                                    <Chip key={oi} label={`${opt.letter || String.fromCharCode(65 + oi)}: ${opt.text}`} size="small" sx={{ bgcolor: opt.isCorrect ? 'rgba(12,189,115,0.1)' : '#F1F5F9', color: opt.isCorrect ? tokens.accent : tokens.textSecondary, fontSize: 10, fontWeight: opt.isCorrect ? 700 : 400 }} />
                                  ))}
                                </Box>
                              )}
                              {q.subQuestions && Array.isArray(q.subQuestions) && q.subQuestions.length > 0 && (
                                <Box sx={{ mt: 1, p: 1, bgcolor: '#F0F9FF', borderRadius: 1.5, border: '1px solid #BAE6FD' }}>
                                  <Typography sx={{ fontSize: 11, fontWeight: 600, color: '#0369A1', mb: 0.5 }}>Sub-Questions:</Typography>
                                  {q.subQuestions.slice(0, 3).map((subQ, idx) => (
                                    <Box key={idx} sx={{ display: 'flex', gap: 0.5, alignItems: 'center', mb: 0.25 }}>
                                      <Typography sx={{ fontSize: 10, fontWeight: 700, color: tokens.primary }}>{subQ.label || String.fromCharCode(97 + idx) + ')'}</Typography>
                                      <Typography sx={{ fontSize: 10, color: tokens.textPrimary, noWrap: true }}>{subQ.text || '(empty)'}</Typography>
                                    </Box>
                                  ))}
                                  {q.subQuestions.length > 3 && (
                                    <Typography sx={{ fontSize: 10, color: tokens.textMuted, fontStyle: 'italic' }}>+{q.subQuestions.length - 3} more</Typography>
                                  )}
                                </Box>
                              )}
                            </Box>
                            <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                              <Tooltip title="Edit question"><IconButton size="small" sx={{ color: tokens.primary }} onClick={() => handleEditQuestion(q, si, qi)}><Edit sx={{ fontSize: 16 }} /></IconButton></Tooltip>
                              <Tooltip title="Delete question"><IconButton size="small" sx={{ color: '#EF4444' }} onClick={() => handleDeleteQuestion(si, qi)}><Delete sx={{ fontSize: 16 }} /></IconButton></Tooltip>
                            </Box>
                          </Paper>
                        ))}
                        <Button fullWidth size="small" startIcon={<Add />} onClick={() => handleOpenAddQuestion(si)}
                          sx={{ mt: 1, borderRadius: 2, textTransform: 'none', fontWeight: 700, color: tokens.accent, bgcolor: 'rgba(12,189,115,0.08)', border: `1px dashed ${tokens.accent}`, py: 1 }}>
                          Add Question to Section {sec.name}
                        </Button>
                      </Box>
                    ) : (
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5, py: 2 }}>
                        <Typography sx={{ fontSize: 12, color: tokens.textMuted, fontStyle: 'italic' }}>No questions in this section.</Typography>
                        <Button fullWidth size="small" startIcon={<Add />} onClick={() => handleOpenAddQuestion(si)}
                          sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, color: tokens.accent, bgcolor: 'rgba(12,189,115,0.08)', border: `1px dashed ${tokens.accent}`, py: 1 }}>
                          Add First Question
                        </Button>
                      </Box>
                    )}
                  </Paper>
                ))}
              </Box>
            ) : (
              <Typography sx={{ color: tokens.textMuted, textAlign: 'center', py: 5 }}>No sections or questions to edit.</Typography>
            )}
          </Box>
        )}

        {/* TAB 2 — PRIVATE / INVITE */}
        {tab === 2 && (
          <Box sx={{ p: 3 }}>
            <Paper elevation={0} sx={{ p: 2, borderRadius: 2.5, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white', mb: 2.5 }}>
              <Box sx={{ mb: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography fontWeight={700} sx={{ fontSize: 14, fontFamily: "DM Sans,sans-serif", mb: 1 }}>Assign Students to Exam</Typography>
                  <Button
                    size="small"
                    startIcon={<Add />}
                    onClick={() => setCreateStudentDialog(true)}
                    sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600, fontSize: 11, color: tokens.accent, bgcolor: 'rgba(12,189,115,0.08)' }}
                  >
                    Create New Student
                  </Button>
                </Box>
                <Typography sx={{ fontSize: 12, color: tokens.textMuted, fontFamily: "DM Sans,sans-serif" }}>Select existing students to assign to this exam</Typography>
              </Box>

              {/* Student Selection Dropdown */}
              <Box sx={{ mb: 2 }}>
                {loadingStudents ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 2 }}>
                    <CircularProgress size={20} />
                    <Typography sx={{ fontSize: 12, color: tokens.textMuted }}>Loading students...</Typography>
                  </Box>
                ) : existingStudents.length === 0 ? (
                  <Box sx={{ py: 3, textAlign: 'center' }}>
                    <Typography sx={{ fontSize: 13, color: tokens.textMuted, mb: 2, fontFamily: "DM Sans,sans-serif" }}>
                      No students found. Go to Student Management to add students first.
                    </Typography>
                    <Button
                      variant="outlined"
                      startIcon={<People />}
                      onClick={() => { onClose(); setActiveSection('students'); }}
                      sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600, fontSize: 12 }}
                    >
                      Go to Student Management
                    </Button>
                  </Box>
                ) : (
                  <Box>
                    {/* Search and Sort Controls */}
                    <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                      <TextField
                        size="small"
                        placeholder="Search students..."
                        value={studentSearchTerm}
                        onChange={(e) => setStudentSearchTerm(e.target.value)}
                        InputProps={{
                          startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 16, color: tokens.textMuted }} /></InputAdornment>
                        }}
                        sx={{ flex: '1 1 200px', '& .MuiOutlinedInput-root': { borderRadius: 2, fontSize: 13 } }}
                      />
                      <FormControl size="small" sx={{ minWidth: 140 }}>
                        <InputLabel sx={{ fontSize: 13 }}>Sort By</InputLabel>
                        <Select value={studentSortBy} onChange={(e) => setStudentSortBy(e.target.value)} label="Sort By" sx={{ borderRadius: 2, fontSize: 13 }}>
                          <MenuItem value="name">Name A–Z</MenuItem>
                          <MenuItem value="email">Email A–Z</MenuItem>
                          <MenuItem value="class">Class A–Z</MenuItem>
                        </Select>
                      </FormControl>
                    </Box>

                    {/* Select All Checkbox */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Checkbox
                        checked={selectedStudentIds.length > 0 && selectedStudentIds.length === existingStudents.length}
                        indeterminate={selectedStudentIds.length > 0 && selectedStudentIds.length < existingStudents.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedStudentIds(existingStudents.map(s => s._id.toString()));
                          } else {
                            setSelectedStudentIds([]);
                          }
                        }}
                        sx={{ '& .MuiSvgIcon-root': { fontSize: 18 } }}
                      />
                      <Typography sx={{ fontSize: 12, fontWeight: 600, color: tokens.textSecondary }}>
                        Select All ({selectedStudentIds.length}/{existingStudents.length})
                      </Typography>
                    </Box>

                    {/* Student List */}
                    <Box sx={{ maxHeight: 300, overflowY: 'auto', border: `1px solid ${tokens.surfaceBorder}`, borderRadius: 2, bgcolor: 'white' }}>
                      {existingStudents
                        .filter(s => {
                          const searchLower = studentSearchTerm.toLowerCase();
                          return (
                            s.firstName?.toLowerCase().includes(searchLower) ||
                            s.lastName?.toLowerCase().includes(searchLower) ||
                            s.email?.toLowerCase().includes(searchLower) ||
                            s.class?.toLowerCase().includes(searchLower)
                          );
                        })
                        .sort((a, b) => {
                          if (studentSortBy === 'name') {
                            return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
                          }
                          if (studentSortBy === 'email') {
                            return (a.email || '').localeCompare(b.email || '');
                          }
                          if (studentSortBy === 'class') {
                            return (a.class || '').localeCompare(b.class || '');
                          }
                          return 0;
                        })
                        .map((student) => (
                          <Box
                            key={student._id}
                            onClick={() => {
                              const isSelected = selectedStudentIds.includes(student._id.toString());
                              if (isSelected) {
                                setSelectedStudentIds(prev => prev.filter(id => id !== student._id.toString()));
                              } else {
                                setSelectedStudentIds(prev => [...prev, student._id.toString()]);
                              }
                            }}
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1,
                              py: 1,
                              px: 1.5,
                              borderBottom: `1px solid ${tokens.surfaceBorder}`,
                              cursor: 'pointer',
                              '&:hover': { bgcolor: '#F8FAFC' },
                              '&:last-child': { borderBottom: 'none' }
                            }}
                          >
                            <Checkbox
                              checked={selectedStudentIds.includes(student._id.toString())}
                              sx={{ '& .MuiSvgIcon-root': { fontSize: 18 } }}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedStudentIds(prev => [...prev, student._id.toString()]);
                                } else {
                                  setSelectedStudentIds(prev => prev.filter(id => id !== student._id.toString()));
                                }
                              }}
                            />
                            <Avatar sx={{ width: 28, height: 28, fontSize: 12, bgcolor: tokens.primary }}>{student.firstName[0]}</Avatar>
                            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                              <Typography sx={{ fontSize: 13, fontWeight: 600, fontFamily: "DM Sans,sans-serif" }}>
                                {student.firstName} {student.lastName}
                              </Typography>
                              <Typography sx={{ fontSize: 11, color: tokens.textMuted }}>{student.email}</Typography>
                            </Box>
                            {student.class && (
                              <Chip label={student.class} size="small" sx={{ fontSize: 10, bgcolor: 'rgba(12,189,115,0.1)', color: tokens.accent }} />
                            )}
                          </Box>
                        ))}
                    </Box>
                  </Box>
                )}
              </Box>
            </Paper>

            {createResult ? (
              <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2.5, border: `1.5px solid ${tokens.accent}`, bgcolor: 'rgba(12,189,115,0.03)', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <CheckCircle sx={{ color: tokens.accent }} />
                  <Typography fontWeight={700} sx={{ color: tokens.accentDark, fontFamily: "DM Sans,sans-serif" }}>
                    {createResult.created.length} student{createResult.created.length !== 1 ? 's' : ''} assigned, {createResult.skipped.length} skipped
                  </Typography>
                </Box>
                {shareResult && (
                  <Box sx={{ mb: 1.5 }}>
                    <Typography sx={{ fontSize: 12, color: tokens.textMuted, mb: 0.5 }}>Private Link (share with invited students)</Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <TextField fullWidth size="small" value={shareResult.privateLink} InputProps={{ readOnly: true }} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, fontSize: 13 } }} />
                      <Button variant="contained" onClick={() => copyLink(shareResult.privateLink, 'private')}
                        sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none', background: copied === 'private' ? tokens.accent : gradients.brand, boxShadow: 'none', whiteSpace: 'nowrap', px: 2 }}>
                        {copied === 'private' ? '✓ Copied' : 'Copy'}
                      </Button>
                    </Box>
                  </Box>
                )}
                {createResult.created.length > 0 && (
                  <Box sx={{ maxHeight: 160, overflowY: 'auto' }}>
                    <Typography sx={{ fontSize: 12, fontWeight: 700, color: tokens.textSecondary, mb: 0.5 }}>Assigned Students:</Typography>
                    {createResult.created.map((s, i) => (
                      <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5, borderBottom: `1px solid ${tokens.surfaceBorder}` }}>
                        <Avatar sx={{ width: 24, height: 24, fontSize: 11, bgcolor: tokens.accent }}>{s.firstName[0]}</Avatar>
                        <Typography sx={{ fontSize: 12, flexGrow: 1 }}>{s.firstName} {s.lastName} — <b>{s.email}</b></Typography>
                      </Box>
                    ))}
                  </Box>
                )}
                {createResult.skipped.length > 0 && (
                  <Box sx={{ maxHeight: 160, overflowY: 'auto', mt: 1 }}>
                    <Typography sx={{ fontSize: 12, fontWeight: 700, color: tokens.textSecondary, mb: 0.5 }}>Skipped (already assigned to exam):</Typography>
                    {createResult.skipped.map((s, i) => (
                      <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5, borderBottom: `1px solid ${tokens.surfaceBorder}` }}>
                        <Typography sx={{ fontSize: 12, flexGrow: 1 }}>{s.email} — <span style={{ color: tokens.textMuted }}>{s.reason}</span></Typography>
                      </Box>
                    ))}
                  </Box>
                )}
                <Button
                  fullWidth
                  variant="outlined"
                  size="small"
                  onClick={() => {
                    setCreateResult(null);
                    setSelectedStudentIds([]);
                  }}
                  sx={{ borderRadius: 2, textTransform: 'none', mt: 1.5 }}
                >
                  + Add More Students
                </Button>
              </Paper>
            ) : (
              <Button fullWidth variant="contained" size="large" startIcon={creating ? <CircularProgress size={18} color="inherit" /> : <People />}
                onClick={handleCreateAccounts} disabled={creating || selectedStudentIds.length === 0}
                sx={{ borderRadius: 2.5, fontWeight: 700, textTransform: 'none', background: gradients.brand, boxShadow: 'none', py: 1.5, fontSize: 15 }}>
                {creating ? 'Assigning Students…' : 'Assign Students & Share'}
              </Button>
            )}

            {/* Assigned Students Section */}
            {assignedStudents.length > 0 && (
              <Paper elevation={0} sx={{ p: 2, borderRadius: 2.5, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white', mt: 2.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                  <Typography fontWeight={700} sx={{ fontSize: 14, fontFamily: "DM Sans,sans-serif" }}>Assigned Students ({assignedStudents.length})</Typography>
                  {!shareResult && (
                    <Button size="small" onClick={() => handleShare('email')} disabled={sharing}
                      sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, color: tokens.accent, bgcolor: 'rgba(12,189,115,0.08)', fontSize: 12 }}>
                      {sharing ? 'Generating...' : 'Generate Share Link'}
                    </Button>
                  )}
                </Box>
                
                {shareResult && (
                  <Box sx={{ mb: 1.5, p: 1.5, bgcolor: isShareExpired() ? 'rgba(239, 68, 68, 0.05)' : 'rgba(12,189,115,0.05)', borderRadius: 2, border: `1px solid ${isShareExpired() ? '#EF4444' : tokens.accent}` }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography sx={{ fontSize: 12, color: tokens.textMuted }}>Private Link (share with invited students)</Typography>
                      {isShareExpired() ? (
                        <Chip
                          icon={<ErrorOutline sx={{ fontSize: 12 }} />}
                          label="Expired"
                          size="small"
                          sx={{ bgcolor: '#EF4444', color: 'white', fontSize: 10, fontWeight: 700, height: 22 }}
                        />
                      ) : (
                        <Chip
                          icon={<CheckCircleOutline sx={{ fontSize: 12 }} />}
                          label="Active"
                          size="small"
                          sx={{ bgcolor: tokens.accent, color: 'white', fontSize: 10, fontWeight: 700, height: 22 }}
                        />
                      )}
                    </Box>
                    {(shareResult.expiresAt || shareResult.settings?.expiresAt) && (
                      <Typography sx={{ fontSize: 11, color: isShareExpired() ? '#EF4444' : tokens.textMuted, mb: 0.5 }}>
                        Expires: {new Date(shareResult.expiresAt || shareResult.settings?.expiresAt).toLocaleString()}
                      </Typography>
                    )}
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <TextField fullWidth size="small" value={shareResult.privateLink} InputProps={{ readOnly: true }} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, fontSize: 13 } }} />
                      <Button variant="contained" onClick={() => copyLink(shareResult.privateLink, 'private')}
                        sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none', background: copied === 'private' ? tokens.accent : gradients.brand, boxShadow: 'none', whiteSpace: 'nowrap', px: 2 }}>
                        {copied === 'private' ? '✓ Copied' : 'Copy'}
                      </Button>
                      {isShareExpired() && (
                        <Button
                          variant="outlined"
                          startIcon={resettingExpiration ? <CircularProgress size={14} color="inherit" /> : <RestartAlt sx={{ fontSize: 14 }} />}
                          onClick={handleResetExpiration}
                          disabled={resettingExpiration}
                          sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none', borderColor: '#EF4444', color: '#EF4444', whiteSpace: 'nowrap', px: 2, '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.05)' } }}
                        >
                          {resettingExpiration ? 'Resetting...' : 'Reset Link'}
                        </Button>
                      )}
                    </Box>
                  </Box>
                )}
                
                <Box sx={{ maxHeight: 300, overflowY: 'auto' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                        <TableCell sx={{ fontWeight: 700, color: tokens.textSecondary, fontSize: 11 }}>Name</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: tokens.textSecondary, fontSize: 11 }}>Email</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: tokens.textSecondary, fontSize: 11 }}>Class</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: tokens.textSecondary, fontSize: 11 }}>Status</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: tokens.textSecondary, fontSize: 11 }}>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {assignedStudents.map((student) => {
                        const studentResult = examResults.find(r => r.student?._id === student._id);
                        const hasCompleted = !!studentResult;
                        return (
                          <TableRow key={student._id}>
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Avatar sx={{ width: 24, height: 24, fontSize: 11, bgcolor: tokens.primary }}>{student.firstName[0]}</Avatar>
                                {student.firstName} {student.lastName}
                              </Box>
                            </TableCell>
                            <TableCell sx={{ fontSize: 12 }}>{student.email}</TableCell>
                            <TableCell sx={{ fontSize: 12 }}>{student.class || '-'}</TableCell>
                            <TableCell>
                              {hasCompleted ? (
                                <Chip label="Completed" size="small" sx={{ fontSize: 10, bgcolor: 'rgba(12,189,115,0.1)', color: tokens.accent, fontWeight: 700 }} />
                              ) : (
                                <Chip label="Not Started" size="small" sx={{ fontSize: 10, bgcolor: 'rgba(245,158,11,0.1)', color: tokens.warning, fontWeight: 700 }} />
                              )}
                            </TableCell>
                            <TableCell>
                              <Tooltip title="Remove from exam">
                                <IconButton size="small" onClick={() => handleRemoveStudent(student._id)} sx={{ color: '#EF4444' }}>
                                  <Delete fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </Box>
              </Paper>
            )}
          </Box>
        )}

        {/* TAB 3 — PUBLIC MARKETPLACE (enterprise only) */}
        {hasMarketplaceAccess && tab === 3 && (
          <Box sx={{ p: 3 }}>
            <MarketplaceManager exam={exam} />
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, bgcolor: 'white', borderTop: `1px solid ${tokens.surfaceBorder}`, gap: 1 }}>
        <Button onClick={onClose} sx={{ borderRadius: 2, textTransform: 'none', color: tokens.textSecondary, fontWeight: 600 }}>Close</Button>
        {tab === 0 && <Button variant="contained" onClick={() => setTab(1)} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, background: gradients.brand, boxShadow: 'none' }}>Next: Edit →</Button>}
        {tab === 1 && <Button variant="contained" onClick={() => setTab(2)} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, background: gradients.brand, boxShadow: 'none' }}>Next: Share →</Button>}
      </DialogActions>

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack('')} message={snack} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />

    {/* Create Student Dialog */}
    <Dialog open={createStudentDialog} onClose={() => setCreateStudentDialog(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ fontWeight: 700, fontFamily: "DM Sans,sans-serif" }}>Create New Student</DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {newStudentFormError && <Alert severity="error" sx={{ borderRadius: 2 }}>{newStudentFormError}</Alert>}
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <TextField
              label="First Name *"
              value={newStudentForm.firstName}
              onChange={e => setNewStudentForm(p => ({ ...p, firstName: e.target.value }))}
              sx={{ flex: 1, minWidth: 200, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
            <TextField
              label="Last Name *"
              value={newStudentForm.lastName}
              onChange={e => setNewStudentForm(p => ({ ...p, lastName: e.target.value }))}
              sx={{ flex: 1, minWidth: 200, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
          </Box>
          <TextField
            label="Email *"
            type="email"
            value={newStudentForm.email}
            onChange={e => setNewStudentForm(p => ({ ...p, email: e.target.value }))}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <TextField
              label="Phone"
              value={newStudentForm.phone}
              onChange={e => setNewStudentForm(p => ({ ...p, phone: e.target.value }))}
              sx={{ flex: 1, minWidth: 200, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
            <TextField
              label="Class / Grade"
              value={newStudentForm.class}
              onChange={e => setNewStudentForm(p => ({ ...p, class: e.target.value }))}
              sx={{ flex: 1, minWidth: 200, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
          </Box>
          <FormControl sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}>
            <InputLabel>Gender</InputLabel>
            <Select
              value={newStudentForm.gender}
              onChange={e => setNewStudentForm(p => ({ ...p, gender: e.target.value }))}
              label="Gender"
            >
              <MenuItem value="">Not specified</MenuItem>
              <MenuItem value="male">Male</MenuItem>
              <MenuItem value="female">Female</MenuItem>
              <MenuItem value="other">Other</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={() => setCreateStudentDialog(false)} sx={{ borderRadius: 2, textTransform: 'none', color: tokens.textSecondary }}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleCreateNewStudent}
          disabled={creatingStudent}
          sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, background: gradients.brand, boxShadow: 'none' }}
        >
          {creatingStudent ? 'Creating...' : 'Create & Assign'}
        </Button>
      </DialogActions>
    </Dialog>
    </Dialog>

    {/* Edit Question Dialog - Separate from main dialog */}
    <Dialog open={!!editingQuestion} onClose={() => setEditingQuestion(null)} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ fontWeight: 700, fontFamily: "'DM Sans', sans-serif" }}>Edit Question</DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            fullWidth
            label="Question Text"
            multiline
            rows={3}
            value={editingQuestion?.text || ''}
            onChange={(e) => setEditingQuestion({ ...editingQuestion, text: e.target.value })}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />
          
          {/* Image Upload for Edit Question */}
          <Box>
            <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 1 }}>Question Image (Optional)</Typography>
            {editingQuestion?.imageUrl || editingQuestion?.image ? (
              <Box sx={{ position: 'relative', width: '100%', maxWidth: 400 }}>
                <Box
                  component="img"
                  src={getImageUrl(editingQuestion?.imageUrl || editingQuestion?.image)}
                  alt="Question image"
                  sx={{ width: '100%', borderRadius: 2, maxHeight: 300, objectFit: 'contain' }}
                />
                <Button
                  size="small"
                  variant="contained"
                  color="error"
                  onClick={() => setEditingQuestion({ ...editingQuestion, image: null, imageUrl: '' })}
                  sx={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    borderRadius: 2,
                    minWidth: 'auto',
                    px: 1
                  }}
                >
                  <Delete fontSize="small" />
                </Button>
              </Box>
            ) : (
              <Box
                sx={{
                  border: `1px dashed ${tokens.surfaceBorder}`,
                  borderRadius: 2,
                  p: 3,
                  textAlign: 'center',
                  cursor: 'pointer',
                  '&:hover': {
                    borderColor: tokens.primary,
                    backgroundColor: 'rgba(12,189,115,0.02)'
                  }
                }}
                component="label"
              >
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setEditingQuestion({
                          ...editingQuestion,
                          image: file,
                          imageUrl: reader.result
                        });
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  style={{ display: 'none' }}
                />
                <Add sx={{ fontSize: 32, color: tokens.textMuted, mb: 1 }} />
                <Typography sx={{ fontSize: 13, color: tokens.textMuted }}>
                  Click to upload image
                </Typography>
                <Typography sx={{ fontSize: 11, color: tokens.textMuted }}>
                  PNG, JPG, GIF up to 10MB
                </Typography>
              </Box>
            )}
          </Box>

          <Box sx={{ display: 'flex', gap: 2 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Question Type</InputLabel>
              <Select
                value={editingQuestion?.type || 'multiple-choice'}
                label="Question Type"
                onChange={(e) => setEditingQuestion({ ...editingQuestion, type: e.target.value })}
                sx={{ borderRadius: 2 }}
              >
                {['multiple-choice', 'true-false', 'short-answer', 'matching', 'ordering', 'fill-blank', 'open-ended', 'image'].map(type => (
                  <MenuItem key={type} value={type} sx={{ textTransform: 'capitalize' }}>{type.replace('-', ' ')}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="Points"
              type="number"
              value={editingQuestion?.points || editingQuestion?.marks || 1}
              onChange={(e) => setEditingQuestion({ ...editingQuestion, points: +e.target.value, marks: +e.target.value })}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
          </Box>
          <FormControl fullWidth size="small">
            <InputLabel>Section</InputLabel>
            <Select
              value={editingQuestion?.section || 'A'}
              label="Section"
              onChange={(e) => setEditingQuestion({ ...editingQuestion, section: e.target.value })}
              sx={{ borderRadius: 2 }}
            >
              {['A', 'B', 'C'].map(section => (
                <MenuItem key={section} value={section}>Section {section}</MenuItem>
              ))}
            </Select>
          </FormControl>
          {editingQuestion?.type === 'multiple-choice' && editingQuestion?.options && (
            <Box>
              <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 1 }}>Options</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {editingQuestion.options.map((opt, idx) => (
                  <Box key={idx} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <Typography sx={{ minWidth: 30, fontWeight: 700, color: tokens.primary }}>{String.fromCharCode(65 + idx)}.</Typography>
                    <TextField
                      fullWidth
                      size="small"
                      value={opt.text || ''}
                      onChange={(e) => {
                        const newOptions = [...editingQuestion.options];
                        newOptions[idx] = { ...newOptions[idx], text: e.target.value, letter: String.fromCharCode(65 + idx) };
                        setEditingQuestion({ ...editingQuestion, options: newOptions });
                      }}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                    />
                    <Checkbox
                      checked={opt.isCorrect || false}
                      onChange={(e) => {
                        let newOptions = [...editingQuestion.options];
                        newOptions = newOptions.map((o, i) => ({
                          ...o,
                          isCorrect: i === idx ? e.target.checked : false
                        }));
                        const correctLetter = e.target.checked ? String.fromCharCode(65 + idx) : '';
                        setEditingQuestion({
                          ...editingQuestion,
                          options: newOptions,
                          correctAnswer: correctLetter
                        });
                      }}
                    />
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          {editingQuestion?.type === 'true-false' && (
            <FormControl fullWidth size="small">
              <InputLabel>Correct Answer</InputLabel>
              <Select
                value={editingQuestion?.correctAnswer || ''}
                label="Correct Answer"
                onChange={(e) => setEditingQuestion({ ...editingQuestion, correctAnswer: e.target.value })}
                sx={{ borderRadius: 2 }}
              >
                <MenuItem value="True">True</MenuItem>
                <MenuItem value="False">False</MenuItem>
              </Select>
            </FormControl>
          )}

          {editingQuestion?.type === 'matching' && editingQuestion?.matchingPairs && (
            <Box>
              <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 1 }}>Matching Items</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {editingQuestion.matchingPairs.leftColumn.map((item, idx) => (
                  <Box key={idx} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <TextField
                      fullWidth
                      size="small"
                      label={`Left ${idx + 1}`}
                      value={typeof item === 'string' ? item : item?.text || ''}
                      onChange={(e) => {
                        const newLeft = [...editingQuestion.matchingPairs.leftColumn];
                        newLeft[idx] = e.target.value;
                        setEditingQuestion({
                          ...editingQuestion,
                          matchingPairs: { ...editingQuestion.matchingPairs, leftColumn: newLeft }
                        });
                      }}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                    />
                    <Typography sx={{ color: tokens.textSecondary }}>↔</Typography>
                    <TextField
                      fullWidth
                      size="small"
                      label={`Right ${idx + 1}`}
                      value={typeof editingQuestion.matchingPairs.rightColumn?.[idx] === 'string' 
                        ? editingQuestion.matchingPairs.rightColumn[idx] 
                        : editingQuestion.matchingPairs.rightColumn?.[idx]?.text || ''}
                      onChange={(e) => {
                        const newRight = [...(editingQuestion.matchingPairs.rightColumn || [])];
                        newRight[idx] = e.target.value;
                        setEditingQuestion({
                          ...editingQuestion,
                          matchingPairs: { ...editingQuestion.matchingPairs, rightColumn: newRight }
                        });
                      }}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                    />
                  </Box>
                ))}
              </Box>

              <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 1, mt: 2 }}>Correct Matches (Left Index → Right Index)</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {(editingQuestion.matchingPairs.correctPairs || []).map((pair, idx) => (
                  <Box key={idx} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <Typography sx={{ minWidth: 80, fontSize: 12, fontWeight: 600 }}>Pair {idx + 1}:</Typography>
                    <TextField
                      size="small"
                      label="Left Index"
                      type="number"
                      value={pair.left}
                      onChange={(e) => {
                        const newPairs = [...(editingQuestion.matchingPairs.correctPairs || [])];
                        newPairs[idx] = { ...newPairs[idx], left: parseInt(e.target.value) || 0 };
                        setEditingQuestion({
                          ...editingQuestion,
                          matchingPairs: { ...editingQuestion.matchingPairs, correctPairs: newPairs }
                        });
                      }}
                      sx={{ width: 100, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                    />
                    <Typography sx={{ color: tokens.textSecondary }}>→</Typography>
                    <TextField
                      size="small"
                      label="Right Index"
                      type="number"
                      value={pair.right}
                      onChange={(e) => {
                        const newPairs = [...(editingQuestion.matchingPairs.correctPairs || [])];
                        newPairs[idx] = { ...newPairs[idx], right: parseInt(e.target.value) || 0 };
                        setEditingQuestion({
                          ...editingQuestion,
                          matchingPairs: { ...editingQuestion.matchingPairs, correctPairs: newPairs }
                        });
                      }}
                      sx={{ width: 100, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                    />
                    <Typography sx={{ fontSize: 11, color: tokens.textMuted }}>
                      ({typeof editingQuestion.matchingPairs.leftColumn?.[pair.left] === 'string' 
                        ? editingQuestion.matchingPairs.leftColumn[pair.left] 
                        : editingQuestion.matchingPairs.leftColumn?.[pair.left]?.text || 'N/A'} → 
                        {typeof editingQuestion.matchingPairs.rightColumn?.[pair.right] === 'string'
                        ? editingQuestion.matchingPairs.rightColumn[pair.right]
                        : editingQuestion.matchingPairs.rightColumn?.[pair.right]?.text || 'N/A'})
                    </Typography>
                  </Box>
                ))}
                <Button
                  size="small"
                  startIcon={<Add />}
                  onClick={() => {
                    const newPairs = [...(editingQuestion.matchingPairs.correctPairs || [])];
                    newPairs.push({ left: newPairs.length, right: newPairs.length });
                    setEditingQuestion({
                      ...editingQuestion,
                      matchingPairs: { ...editingQuestion.matchingPairs, correctPairs: newPairs }
                    });
                  }}
                  sx={{ mt: 1, borderRadius: 2, textTransform: 'none', fontSize: 12 }}
                >
                  Add Correct Pair
                </Button>
              </Box>
            </Box>
          )}

          {editingQuestion?.type === 'ordering' && editingQuestion?.itemsToOrder?.items && (
            <Box>
              <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 1 }}>Items to Order</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {editingQuestion.itemsToOrder.items.map((item, idx) => (
                  <Box key={idx} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <Typography sx={{ minWidth: 30, fontWeight: 700, color: tokens.primary }}>{idx + 1}.</Typography>
                    <TextField
                      fullWidth
                      size="small"
                      value={item || ''}
                      onChange={(e) => {
                        const newItems = [...editingQuestion.itemsToOrder.items];
                        newItems[idx] = e.target.value;
                        setEditingQuestion({
                          ...editingQuestion,
                          itemsToOrder: { ...editingQuestion.itemsToOrder, items: newItems }
                        });
                      }}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                    />
                    <IconButton
                      size="small"
                      onClick={() => {
                        if (idx > 0) {
                          const newItems = [...editingQuestion.itemsToOrder.items];
                          [newItems[idx], newItems[idx - 1]] = [newItems[idx - 1], newItems[idx]];
                          setEditingQuestion({
                            ...editingQuestion,
                            itemsToOrder: { ...editingQuestion.itemsToOrder, items: newItems }
                          });
                        }
                      }}
                      disabled={idx === 0}
                    >
                      <ArrowUpward fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => {
                        if (idx < editingQuestion.itemsToOrder.items.length - 1) {
                          const newItems = [...editingQuestion.itemsToOrder.items];
                          [newItems[idx], newItems[idx + 1]] = [newItems[idx + 1], newItems[idx]];
                          setEditingQuestion({
                            ...editingQuestion,
                            itemsToOrder: { ...editingQuestion.itemsToOrder, items: newItems }
                          });
                        }
                      }}
                      disabled={idx === editingQuestion.itemsToOrder.items.length - 1}
                    >
                      <ArrowDownward fontSize="small" />
                    </IconButton>
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          {editingQuestion?.type !== 'multiple-choice' && editingQuestion?.type !== 'true-false' && editingQuestion?.type !== 'matching' && editingQuestion?.type !== 'ordering' && (
            <TextField
              fullWidth
              label="Correct Answer"
              multiline
              rows={2}
              value={editingQuestion?.correctAnswer || ''}
              onChange={(e) => setEditingQuestion({ ...editingQuestion, correctAnswer: e.target.value })}
              helperText={editingQuestion?.type === 'fill-blank' ? 'Enter the word or phrase that fills the blank' : ''}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
          )}
          <TextField
            fullWidth
            label="Explanation"
            multiline
            rows={2}
            value={editingQuestion?.explanation || ''}
            onChange={(e) => setEditingQuestion({ ...editingQuestion, explanation: e.target.value })}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />

          {/* Sub-Questions Section */}
          {(!editingQuestion?.subQuestions || !Array.isArray(editingQuestion.subQuestions) || editingQuestion.subQuestions.length === 0) ? (
            <Box sx={{ p: 2, border: `1px dashed ${tokens.accent}`, borderRadius: 2, bgcolor: 'rgba(12,189,115,0.02)' }}>
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: tokens.accent, mb: 1 }}>Sub-Questions</Typography>
              <Typography sx={{ fontSize: 11, color: tokens.textMuted, mb: 1.5 }}>Break this question into multiple sub-questions for students to answer</Typography>
              <Button
                size="small"
                variant="outlined"
                startIcon={<Add />}
                onClick={() => {
                  setEditingQuestion({
                    ...editingQuestion,
                    subQuestions: [
                      {
                        label: 'a)',
                        text: '',
                        type: 'open-ended',
                        points: 1,
                        correctAnswer: '',
                        options: []
                      }
                    ],
                    subQuestionConfig: {
                      mode: 'all',
                      requiredCount: 1,
                      scoringType: 'partial'
                    }
                  });
                }}
                sx={{ borderRadius: 2, textTransform: 'none', fontSize: 12, borderColor: tokens.accent, color: tokens.accent }}
              >
                + Add Sub-Questions
              </Button>
            </Box>
          ) : (
            <Box sx={{ p: 2, bgcolor: '#FFF8E1', borderRadius: 2, border: '1px solid #FFE082' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#F57C00' }}>Sub-Questions ({editingQuestion.subQuestions.length})</Typography>
                <IconButton
                  size="small"
                  onClick={() => setEditingQuestion({ ...editingQuestion, subQuestions: [], subQuestionConfig: undefined })}
                  sx={{ color: '#DC2626' }}
                >
                  <Delete fontSize="small" />
                </IconButton>
              </Box>

              {/* Sub-question Configuration */}
              <Box sx={{ mb: 2, p: 1.5, bgcolor: 'white', borderRadius: 1.5 }}>
                <Typography sx={{ fontSize: 10, fontWeight: 600, color: '#F57C00', mb: 1 }}>Mode:</Typography>
                <RadioGroup
                  row
                  value={editingQuestion.subQuestionConfig?.mode || 'all'}
                  onChange={(e) => {
                    setEditingQuestion({
                      ...editingQuestion,
                      subQuestionConfig: {
                        ...(editingQuestion.subQuestionConfig || {}),
                        mode: e.target.value,
                        requiredCount: editingQuestion.subQuestionConfig?.requiredCount || 1
                      }
                    });
                  }}
                >
                  <FormControlLabel value="all" control={<Radio size="small" />} label="Answer All" />
                  <FormControlLabel value="choose-n" control={<Radio size="small" />} label="Choose N" />
                </RadioGroup>
                {editingQuestion.subQuestionConfig?.mode === 'choose-n' && (
                  <TextField
                    size="small"
                    type="number"
                    label="Required Count"
                    value={editingQuestion.subQuestionConfig?.requiredCount || 1}
                    onChange={(e) => {
                      const count = Math.max(1, Math.min(editingQuestion.subQuestions.length, parseInt(e.target.value) || 1));
                      setEditingQuestion({
                        ...editingQuestion,
                        subQuestionConfig: {
                          ...(editingQuestion.subQuestionConfig || {}),
                          mode: 'choose-n',
                          requiredCount: count
                        }
                      });
                    }}
                    sx={{ width: 100, mt: 1 }}
                  />
                )}
              </Box>

              {/* Sub-questions list */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {editingQuestion.subQuestions.map((subQ, idx) => (
                  <Box key={idx} sx={{ p: 1.5, bgcolor: 'white', borderRadius: 1.5, border: '1px solid #BAE6FD' }}>
                    <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                      <TextField
                        size="small"
                        placeholder="Label"
                        value={subQ.label || ''}
                        onChange={(e) => {
                          const updated = [...editingQuestion.subQuestions];
                          updated[idx] = { ...subQ, label: e.target.value };
                          setEditingQuestion({ ...editingQuestion, subQuestions: updated });
                        }}
                        sx={{ width: 60 }}
                      />
                      <FormControl size="small" sx={{ minWidth: 100 }}>
                        <Select
                          value={subQ.type || 'open-ended'}
                          onChange={(e) => {
                            const updated = [...editingQuestion.subQuestions];
                            updated[idx] = { ...subQ, type: e.target.value, options: e.target.value === 'multiple-choice' ? [{ letter: 'i', text: '', isCorrect: false }] : [] };
                            setEditingQuestion({ ...editingQuestion, subQuestions: updated });
                          }}
                        >
                          <MenuItem value="open-ended">Open-ended</MenuItem>
                          <MenuItem value="short-answer">Short Answer</MenuItem>
                          <MenuItem value="multiple-choice">Multiple Choice</MenuItem>
                          <MenuItem value="true-false">True/False</MenuItem>
                        </Select>
                      </FormControl>
                      <TextField
                        size="small"
                        type="number"
                        label="Points"
                        value={subQ.points || 1}
                        onChange={(e) => {
                          const updated = [...editingQuestion.subQuestions];
                          updated[idx] = { ...subQ, points: parseInt(e.target.value) || 1 };
                          setEditingQuestion({ ...editingQuestion, subQuestions: updated });
                        }}
                        sx={{ width: 70 }}
                      />
                      <IconButton
                        size="small"
                        onClick={() => {
                          const updated = editingQuestion.subQuestions.filter((_, i) => i !== idx);
                          setEditingQuestion({ ...editingQuestion, subQuestions: updated });
                        }}
                        sx={{ color: '#DC2626' }}
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </Box>
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="Subquestion text..."
                      value={subQ.text || ''}
                      onChange={(e) => {
                        const updated = [...editingQuestion.subQuestions];
                        updated[idx] = { ...subQ, text: e.target.value };
                        setEditingQuestion({ ...editingQuestion, subQuestions: updated });
                      }}
                      sx={{ mb: 1 }}
                    />
                    {subQ.type === 'multiple-choice' && (
                      <Box sx={{ pl: 1, borderLeft: '2px solid #BAE6FD' }}>
                        {(subQ.options || []).map((opt, optIdx) => (
                          <Box key={optIdx} sx={{ display: 'flex', gap: 0.5, alignItems: 'center', mb: 0.5 }}>
                            <TextField
                              size="small"
                              placeholder={`${optIdx + 1}`}
                              value={opt.letter || ''}
                              onChange={(e) => {
                                const updated = [...editingQuestion.subQuestions];
                                const updatedOptions = [...(subQ.options || [])];
                                updatedOptions[optIdx] = { ...opt, letter: e.target.value };
                                updated[idx] = { ...subQ, options: updatedOptions };
                                setEditingQuestion({ ...editingQuestion, subQuestions: updated });
                              }}
                              sx={{ width: 35 }}
                            />
                            <TextField
                              fullWidth
                              size="small"
                              placeholder={`Option ${optIdx + 1}`}
                              value={opt.text || ''}
                              onChange={(e) => {
                                const updated = [...editingQuestion.subQuestions];
                                const updatedOptions = [...(subQ.options || [])];
                                updatedOptions[optIdx] = { ...opt, text: e.target.value };
                                updated[idx] = { ...subQ, options: updatedOptions };
                                setEditingQuestion({ ...editingQuestion, subQuestions: updated });
                              }}
                            />
                            <Checkbox
                              size="small"
                              checked={opt.isCorrect || false}
                              onChange={() => {
                                const updated = [...editingQuestion.subQuestions];
                                const updatedOptions = (subQ.options || []).map((o, i) => ({ ...o, isCorrect: i === optIdx }));
                                updated[idx] = { ...subQ, options: updatedOptions, correctAnswer: opt.letter || '' };
                                setEditingQuestion({ ...editingQuestion, subQuestions: updated });
                              }}
                            />
                          </Box>
                        ))}
                        <Button
                          size="small"
                          onClick={() => {
                            const updated = [...editingQuestion.subQuestions];
                            const newLetter = String.fromCharCode(105 + (subQ.options || []).length);
                            updated[idx] = { ...subQ, options: [...(subQ.options || []), { letter: newLetter, text: '', isCorrect: false }] };
                            setEditingQuestion({ ...editingQuestion, subQuestions: updated });
                          }}
                          sx={{ fontSize: 10, mt: 0.5 }}
                        >
                          + Add Option
                        </Button>
                      </Box>
                    )}
                    {subQ.type !== 'multiple-choice' && (
                      <TextField
                        fullWidth
                        size="small"
                        placeholder="Correct answer..."
                        value={subQ.correctAnswer || ''}
                        onChange={(e) => {
                          const updated = [...editingQuestion.subQuestions];
                          updated[idx] = { ...subQ, correctAnswer: e.target.value };
                          setEditingQuestion({ ...editingQuestion, subQuestions: updated });
                        }}
                      />
                    )}
                  </Box>
                ))}
                <Button
                  size="small"
                  variant="text"
                  onClick={() => {
                    const newSubQ = {
                      label: `${String.fromCharCode(97 + editingQuestion.subQuestions.length)})`,
                      text: '',
                      type: 'open-ended',
                      points: 1,
                      correctAnswer: '',
                      options: []
                    };
                    setEditingQuestion({ ...editingQuestion, subQuestions: [...editingQuestion.subQuestions, newSubQ] });
                  }}
                  sx={{ fontSize: 11 }}
                >
                  + Add Subquestion
                </Button>
              </Box>
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={() => setEditingQuestion(null)} sx={{ borderRadius: 2, textTransform: 'none', color: tokens.textSecondary }}>Cancel</Button>
        <Button variant="contained" onClick={handleSaveQuestionEdit} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, background: gradients.brand, boxShadow: 'none' }}>Save Changes</Button>
      </DialogActions>
    </Dialog>

    {/* Add Question Dialog */}
    <Dialog open={addQuestionDialogOpen} onClose={handleCloseAddQuestion} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ fontWeight: 700, fontFamily: "'DM Sans', sans-serif" }}>
        Add Question to Section {exam?.sections?.[addingSectionIndex]?.name || ''}
      </DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            fullWidth
            label="Question Text"
            multiline
            rows={3}
            value={newQuestion.text}
            onChange={(e) => setNewQuestion({ ...newQuestion, text: e.target.value })}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />
          
          {/* Image Upload */}
          <Box>
            <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 1 }}>Question Image (Optional)</Typography>
            {newQuestion.imageUrl ? (
              <Box sx={{ position: 'relative', width: '100%', maxWidth: 400 }}>
                <Box
                  component="img"
                  src={newQuestion.imageUrl}
                  alt="Question image"
                  sx={{ width: '100%', borderRadius: 2, maxHeight: 300, objectFit: 'contain' }}
                />
                <Button
                  size="small"
                  variant="contained"
                  color="error"
                  onClick={handleRemoveImage}
                  sx={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    borderRadius: 2,
                    minWidth: 'auto',
                    px: 1
                  }}
                >
                  <Delete fontSize="small" />
                </Button>
              </Box>
            ) : (
              <Box
                sx={{
                  border: `1px dashed ${tokens.surfaceBorder}`,
                  borderRadius: 2,
                  p: 3,
                  textAlign: 'center',
                  cursor: 'pointer',
                  '&:hover': {
                    borderColor: tokens.primary,
                    backgroundColor: 'rgba(12,189,115,0.02)'
                  }
                }}
                component="label"
              >
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  style={{ display: 'none' }}
                />
                <Add sx={{ fontSize: 32, color: tokens.textMuted, mb: 1 }} />
                <Typography sx={{ fontSize: 13, color: tokens.textMuted }}>
                  Click to upload image
                </Typography>
                <Typography sx={{ fontSize: 11, color: tokens.textMuted }}>
                  PNG, JPG, GIF up to 10MB
                </Typography>
              </Box>
            )}
          </Box>

          <Box sx={{ display: 'flex', gap: 2 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Question Type</InputLabel>
              <Select
                value={newQuestion.type}
                label="Question Type"
                onChange={(e) => handleNewQuestionTypeChange(e.target.value)}
                sx={{ borderRadius: 2 }}
              >
                {['multiple-choice', 'true-false', 'short-answer', 'matching', 'ordering', 'fill-blank', 'open-ended', 'image'].map(type => (
                  <MenuItem key={type} value={type} sx={{ textTransform: 'capitalize' }}>{type.replace('-', ' ')}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="Points"
              type="number"
              value={newQuestion.points}
              onChange={(e) => setNewQuestion({ ...newQuestion, points: +e.target.value })}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
          </Box>

          {newQuestion.type === 'multiple-choice' && (
            <Box>
              <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 1 }}>Options (click checkbox to select correct answer)</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {newQuestion.options.map((opt, idx) => (
                  <Box key={idx} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <Typography sx={{ minWidth: 30, fontWeight: 700, color: tokens.primary }}>{String.fromCharCode(65 + idx)}.</Typography>
                    <TextField
                      fullWidth
                      size="small"
                      value={opt.text || ''}
                      onChange={(e) => handleNewOptionChange(idx, e.target.value)}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                    />
                    <Checkbox
                      checked={opt.isCorrect || false}
                      onChange={() => handleNewCorrectAnswerChange(idx)}
                    />
                    {newQuestion.options.length > 2 && (
                      <IconButton size="small" onClick={() => handleRemoveNewOption(idx)} sx={{ color: tokens.error }}>
                        <Delete fontSize="small" />
                      </IconButton>
                    )}
                  </Box>
                ))}
                {newQuestion.options.length < 6 && (
                  <Button size="small" onClick={handleAddNewOption} startIcon={<Add />} sx={{ borderRadius: 2 }}>
                    Add Option
                  </Button>
                )}
              </Box>
            </Box>
          )}

          {newQuestion.type === 'true-false' && (
            <FormControl fullWidth size="small">
              <InputLabel>Correct Answer</InputLabel>
              <Select
                value={newQuestion.correctAnswer}
                label="Correct Answer"
                onChange={(e) => setNewQuestion({ ...newQuestion, correctAnswer: e.target.value })}
                sx={{ borderRadius: 2 }}
              >
                <MenuItem value="True">True</MenuItem>
                <MenuItem value="False">False</MenuItem>
              </Select>
            </FormControl>
          )}

          {newQuestion.type === 'matching' && (
            <Box>
              <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 1 }}>Matching Pairs</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {newQuestion.matchingPairs.leftColumn.map((item, idx) => (
                  <Box key={idx} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <TextField
                      fullWidth
                      size="small"
                      label={`Left ${idx + 1}`}
                      value={item || ''}
                      onChange={(e) => {
                        const newLeft = [...newQuestion.matchingPairs.leftColumn];
                        newLeft[idx] = e.target.value;
                        setNewQuestion({
                          ...newQuestion,
                          matchingPairs: { ...newQuestion.matchingPairs, leftColumn: newLeft }
                        });
                      }}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                    />
                    <Typography sx={{ color: tokens.textSecondary }}>↔</Typography>
                    <TextField
                      fullWidth
                      size="small"
                      label={`Right ${idx + 1}`}
                      value={newQuestion.matchingPairs.rightColumn?.[idx] || ''}
                      onChange={(e) => {
                        const newRight = [...(newQuestion.matchingPairs.rightColumn || [])];
                        newRight[idx] = e.target.value;
                        setNewQuestion({
                          ...newQuestion,
                          matchingPairs: { ...newQuestion.matchingPairs, rightColumn: newRight }
                        });
                      }}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                    />
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          {newQuestion.type === 'ordering' && (
            <Box>
              <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 1 }}>Items to Order (in correct order)</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {newQuestion.itemsToOrder.items.map((item, idx) => (
                  <Box key={idx} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <Typography sx={{ minWidth: 30, fontWeight: 700, color: tokens.primary }}>{idx + 1}.</Typography>
                    <TextField
                      fullWidth
                      size="small"
                      value={item || ''}
                      onChange={(e) => {
                        const newItems = [...newQuestion.itemsToOrder.items];
                        newItems[idx] = e.target.value;
                        setNewQuestion({
                          ...newQuestion,
                          itemsToOrder: { ...newQuestion.itemsToOrder, items: newItems }
                        });
                      }}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                    />
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          {newQuestion.type !== 'multiple-choice' && newQuestion.type !== 'true-false' && newQuestion.type !== 'matching' && newQuestion.type !== 'ordering' && (
            <TextField
              fullWidth
              label="Correct Answer"
              multiline
              rows={2}
              value={newQuestion.correctAnswer}
              onChange={(e) => setNewQuestion({ ...newQuestion, correctAnswer: e.target.value })}
              helperText={newQuestion.type === 'fill-blank' ? 'Enter the word or phrase that fills the blank' : ''}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={handleCloseAddQuestion} sx={{ borderRadius: 2, textTransform: 'none', color: tokens.textSecondary }}>Cancel</Button>
        <Button variant="contained" onClick={handleAddQuestion} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, background: gradients.brand, boxShadow: 'none' }}>Add Question</Button>
      </DialogActions>
    </Dialog>
    </>
  );
}

/* ── MANUAL EXAM BUILDER ── */
const Q_TYPES = [
  { value: 'multiple-choice', label: 'Multiple Choice' },
  { value: 'true-false',      label: 'True / False' },
  { value: 'short-answer',    label: 'Short Answer' },
  { value: 'matching',        label: 'Matching' },
  { value: 'ordering',        label: 'Ordering' },
  { value: 'fill-blank',      label: 'Fill in the Blank' },
  { value: 'open-ended',      label: 'Open Ended' },
];
const DIFFS = ['easy', 'medium', 'hard'];
const LETTERS = ['A', 'B', 'C', 'D'];

function ManualExamBuilder({ exam, setExam, sectionIdx, setSectionIdx, question, setQuestion, onAddQuestion, onRemoveQuestion, onPublish, publishing, error, onSaveDraft, savingDraft }) {
  const totalQ = exam.sections.reduce((s, sec) => s + (sec.questions?.length || 0), 0);

  const updateOption = (idx, field, val) => {
    setQuestion(p => {
      const opts = p.options.map((o, i) => {
        if (field === 'isCorrect') return { ...o, isCorrect: i === idx };
        return i === idx ? { ...o, [field]: val } : o;
      });
      const correct = field === 'isCorrect' ? LETTERS[idx] : p.correctAnswer;
      return { ...p, options: opts, correctAnswer: correct };
    });
  };

  const addSection = () => {
    const name = String.fromCharCode(65 + exam.sections.length);
    setExam(p => ({ ...p, sections: [...p.sections, { name, description: `Section ${name}`, questions: [] }] }));
    setSectionIdx(exam.sections.length);
  };

  const isOpen = question.type === 'open-ended' || question.type === 'short-answer';

  return (
    <Box>
      {/* Exam meta */}
      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        <Grid item xs={12} sm={5}>
          <TextField fullWidth size="small" label="Exam Title *" value={exam.title}
            onChange={e => setExam(p => ({ ...p, title: e.target.value }))}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
        </Grid>
        <Grid item xs={6} sm={2}>
          <TextField fullWidth size="small" label="Time (min)" type="number" value={exam.timeLimit}
            onChange={e => setExam(p => ({ ...p, timeLimit: +e.target.value }))}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
        </Grid>
        <Grid item xs={6} sm={2}>
          <TextField fullWidth size="small" label="Pass %" type="number" value={exam.passingScore}
            onChange={e => setExam(p => ({ ...p, passingScore: +e.target.value }))}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
        </Grid>
        <Grid item xs={12} sm={3}>
          <TextField fullWidth size="small" label="Description" value={exam.description}
            onChange={e => setExam(p => ({ ...p, description: e.target.value }))}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
        </Grid>
      </Grid>

      {/* Section tabs */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        {exam.sections.map((sec, i) => (
          <Chip key={i} label={`Section ${sec.name} (${sec.questions?.length || 0})`}
            onClick={() => setSectionIdx(i)} clickable
            sx={{ fontWeight: 700, bgcolor: sectionIdx === i ? tokens.primary : '#F1F5F9', color: sectionIdx === i ? 'white' : tokens.textSecondary, fontSize: 12 }} />
        ))}
        {exam.sections.length < 10 && (
          <Chip icon={<Add sx={{ fontSize: 15 }} />} label="Add Section" onClick={addSection} clickable
            sx={{ fontWeight: 600, bgcolor: 'rgba(12,189,115,0.1)', color: tokens.accent, fontSize: 12 }} />
        )}
        <Box sx={{ flexGrow: 1 }} />
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Sections</InputLabel>
          <Select
            value={exam.sections.length}
            label="Sections"
            onChange={(e) => {
              const newCount = e.target.value;
              const currentCount = exam.sections.length;
              if (newCount > currentCount) {
                // Add sections
                for (let i = currentCount; i < newCount; i++) {
                  const name = String.fromCharCode(65 + i);
                  setExam(p => ({ ...p, sections: [...p.sections, { name, description: `Section ${name}`, questions: [] }] }));
                }
              } else if (newCount < currentCount) {
                // Remove sections from the end
                setExam(p => ({ ...p, sections: p.sections.slice(0, newCount) }));
                if (sectionIdx >= newCount) setSectionIdx(Math.max(0, newCount - 1));
              }
            }}
            sx={{ borderRadius: 2 }}
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
              <MenuItem key={num} value={num}>{num}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <Chip label={`${totalQ} question${totalQ !== 1 ? 's' : ''} total`}
          sx={{ bgcolor: '#F1F5F9', color: tokens.textSecondary, fontSize: 11 }} />
      </Box>

      {/* Question builder */}
      <Paper elevation={0} sx={{ p: 2, borderRadius: 2.5, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: '#FAFBFC', mb: 2 }}>
        <Typography fontWeight={700} sx={{ fontSize: 13, color: tokens.textPrimary, fontFamily: "DM Sans,sans-serif", mb: 1.5 }}>
          Add Question to Section {exam.sections[sectionIdx]?.name}
        </Typography>

        <Grid container spacing={1.5} sx={{ mb: 1.5 }}>
          <Grid item xs={12} sm={5}>
            <FormControl fullWidth size="small">
              <InputLabel>Question Type</InputLabel>
              <Select label="Question Type" value={question.type}
                onChange={e => setQuestion(p => ({
                  ...p, type: e.target.value, correctAnswer: '',
                  options: e.target.value === 'true-false'
                    ? [{ text: 'True', isCorrect: false, letter: 'A' }, { text: 'False', isCorrect: false, letter: 'B' }]
                    : [{ text: '', isCorrect: false, letter: 'A' }, { text: '', isCorrect: false, letter: 'B' }, { text: '', isCorrect: false, letter: 'C' }, { text: '', isCorrect: false, letter: 'D' }]
                }))}
                sx={{ borderRadius: 2 }}>
                {Q_TYPES.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} sm={2}>
            <TextField fullWidth size="small" label="Points" type="number" value={question.points}
              onChange={e => setQuestion(p => ({ ...p, points: +e.target.value }))}
              inputProps={{ min: 1 }} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
          </Grid>
          <Grid item xs={6} sm={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Difficulty</InputLabel>
              <Select label="Difficulty" value={question.difficulty}
                onChange={e => setQuestion(p => ({ ...p, difficulty: e.target.value }))}
                sx={{ borderRadius: 2 }}>
                {DIFFS.map(d => <MenuItem key={d} value={d} sx={{ textTransform: 'capitalize' }}>{d}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
        </Grid>

        <TextField fullWidth size="small" label="Question Text *" multiline minRows={2}
          value={question.text} onChange={e => setQuestion(p => ({ ...p, text: e.target.value }))}
          sx={{ mb: 1.5, '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: 'white' } }} />

        {/* Multiple choice options */}
        {question.type === 'multiple-choice' && (
          <Grid container spacing={1} sx={{ mb: 1.5 }}>
            {question.options.map((opt, i) => (
              <Grid item xs={12} sm={6} key={i}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box onClick={() => updateOption(i, 'isCorrect', true)}
                    sx={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${opt.isCorrect ? tokens.accent : tokens.surfaceBorder}`, bgcolor: opt.isCorrect ? tokens.accent : 'white', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {opt.isCorrect && <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'white' }} />}
                  </Box>
                  <Chip label={LETTERS[i]} size="small" sx={{ fontWeight: 700, bgcolor: opt.isCorrect ? 'rgba(12,189,115,0.12)' : '#F1F5F9', color: opt.isCorrect ? tokens.accentDark : tokens.textSecondary, minWidth: 28 }} />
                  <TextField fullWidth size="small" placeholder={`Option ${LETTERS[i]}`} value={opt.text}
                    onChange={e => updateOption(i, 'text', e.target.value)}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: 'white', fontSize: 13 } }} />
                </Box>
              </Grid>
            ))}
            <Grid item xs={12}>
              <Typography sx={{ fontSize: 11, color: tokens.textMuted, fontFamily: "DM Sans,sans-serif" }}>Click the circle to mark the correct answer</Typography>
            </Grid>
          </Grid>
        )}

        {/* True / False */}
        {question.type === 'true-false' && (
          <Box sx={{ display: 'flex', gap: 1.5, mb: 1.5 }}>
            {['True', 'False'].map(val => (
              <Paper key={val} onClick={() => setQuestion(p => ({ ...p, correctAnswer: val, options: [{ text: 'True', isCorrect: val === 'True', letter: 'A' }, { text: 'False', isCorrect: val === 'False', letter: 'B' }] }))}
                elevation={0} sx={{ px: 3, py: 1.25, borderRadius: 2.5, cursor: 'pointer', border: `2px solid ${question.correctAnswer === val ? tokens.accent : tokens.surfaceBorder}`, bgcolor: question.correctAnswer === val ? 'rgba(12,189,115,0.07)' : 'white', fontWeight: 700, fontSize: 14, color: question.correctAnswer === val ? tokens.accentDark : tokens.textSecondary, fontFamily: "DM Sans,sans-serif" }}>
                {val}
              </Paper>
            ))}
            <Typography sx={{ alignSelf: 'center', fontSize: 11, color: tokens.textMuted }}>Click to mark correct answer</Typography>
          </Box>
        )}

        {/* Fill blank */}
        {question.type === 'fill-blank' && (
          <Box>
            <TextField fullWidth size="small" label="Correct Answer (expected fill)" value={question.correctAnswer}
              onChange={e => setQuestion(p => ({ ...p, correctAnswer: e.target.value }))}
              sx={{ mb: 1.5, '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: 'white' } }} />
            <TextField 
              fullWidth 
              size="small" 
              label="Acceptable Answers (comma-separated)" 
              placeholder="e.g., answer1, answer2, answer3"
              value={Array.isArray(question.acceptableAnswers) ? question.acceptableAnswers.join(', ') : question.acceptableAnswers || ''}
              onChange={e => {
                const answers = e.target.value.split(',').map(a => a.trim()).filter(a => a);
                setQuestion(p => ({ ...p, acceptableAnswers: answers }));
              }}
              helperText="Alternative answers that should also be marked correct"
              sx={{ mb: 1.5, '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: 'white' } }} 
            />
          </Box>
        )}

        {/* Matching Question Editor */}
        {question.type === 'matching' && (
          <Box sx={{ mb: 1.5 }}>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: tokens.textSecondary, mb: 1 }}>
              Matching Pairs (Left side → Right side)
            </Typography>
            <Typography sx={{ fontSize: 11, color: tokens.textMuted, mb: 1 }}>
              By default, left items match with right items in the same order. You can change the correct pairs in the backend if needed.
            </Typography>
            <Grid container spacing={1}>
              {(question.leftItems || question.options?.filter((_, i) => i % 2 === 0) || []).map((item, i) => (
                <Grid item xs={12} key={i}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TextField
                      fullWidth
                      size="small"
                      placeholder={`Left item ${i + 1}`}
                      value={typeof item === 'string' ? item : item.text}
                      onChange={e => {
                        const newLeft = [...(question.leftItems || question.options?.filter((_, idx) => idx % 2 === 0) || [])];
                        newLeft[i] = { text: e.target.value };
                        setQuestion(p => ({ 
                          ...p, 
                          leftItems: newLeft,
                          matchingPairs: {
                            ...p.matchingPairs,
                            leftColumn: newLeft.map(l => typeof l === 'string' ? l : l.text),
                            rightColumn: (p.rightItems || p.options?.filter((_, idx) => idx % 2 === 1) || []).map(r => typeof r === 'string' ? r : r.text)
                          }
                        }));
                      }}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: 'white' } }}
                    />
                    <DragIndicator sx={{ color: 'text.secondary' }} />
                    <TextField
                      fullWidth
                      size="small"
                      placeholder={`Right match ${i + 1}`}
                      value={(() => {
                        const rightItems = question.rightItems || question.options?.filter((_, idx) => idx % 2 === 1) || [];
                        const rightItem = rightItems[i];
                        return typeof rightItem === 'string' ? rightItem : rightItem?.text || '';
                      })()}
                      onChange={e => {
                        const newRight = [...(question.rightItems || question.options?.filter((_, idx) => idx % 2 === 1) || [])];
                        newRight[i] = { text: e.target.value };
                        setQuestion(p => ({ 
                          ...p, 
                          rightItems: newRight,
                          matchingPairs: {
                            ...p.matchingPairs,
                            leftColumn: (p.leftItems || p.options?.filter((_, idx) => idx % 2 === 0) || []).map(l => typeof l === 'string' ? l : l.text),
                            rightColumn: newRight.map(r => typeof r === 'string' ? r : r.text)
                          }
                        }));
                      }}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: 'white' } }}
                    />
                    <IconButton
                      size="small"
                      onClick={() => {
                        const leftItems = [...(question.leftItems || question.options?.filter((_, idx) => idx % 2 === 0) || [])];
                        const rightItems = [...(question.rightItems || question.options?.filter((_, idx) => idx % 2 === 1) || [])];
                        leftItems.splice(i, 1);
                        rightItems.splice(i, 1);
                        setQuestion(p => ({ 
                          ...p, 
                          leftItems, 
                          rightItems,
                          matchingPairs: {
                            ...p.matchingPairs,
                            leftColumn: leftItems.map(l => typeof l === 'string' ? l : l.text),
                            rightColumn: rightItems.map(r => typeof r === 'string' ? r : r.text)
                          }
                        }));
                      }}
                      sx={{ color: '#EF4444' }}
                    >
                      <Delete fontSize="small" />
                    </IconButton>
                  </Box>
                </Grid>
              ))}
            </Grid>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Add />}
              onClick={() => {
                const leftItems = [...(question.leftItems || question.options?.filter((_, idx) => idx % 2 === 0) || [])];
                const rightItems = [...(question.rightItems || question.options?.filter((_, idx) => idx % 2 === 1) || [])];
                leftItems.push({ text: '' });
                rightItems.push({ text: '' });
                setQuestion(p => ({ 
                  ...p, 
                  leftItems, 
                  rightItems,
                  matchingPairs: {
                    ...p.matchingPairs,
                    leftColumn: leftItems.map(l => typeof l === 'string' ? l : l.text),
                    rightColumn: rightItems.map(r => typeof r === 'string' ? r : r.text)
                  }
                }));
              }}
              sx={{ mt: 1, textTransform: 'none', borderStyle: 'dashed' }}
            >
              Add Pair
            </Button>
            <Typography sx={{ fontSize: 11, color: tokens.textMuted, mt: 1 }}>
              Students will drag items from the right column to match with items on the left
            </Typography>
          </Box>
        )}

        {/* Ordering Question Editor */}
        {question.type === 'ordering' && (
          <Box sx={{ mb: 1.5 }}>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: tokens.textSecondary, mb: 1 }}>
              Items to Order (Correct Order)
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {(question.items || question.options || []).map((item, i) => (
                <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box
                    sx={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      bgcolor: 'primary.main',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'bold',
                      fontSize: 12,
                      flexShrink: 0
                    }}
                  >
                    {i + 1}
                  </Box>
                  <DragIndicator sx={{ color: 'text.secondary' }} />
                  <TextField
                    fullWidth
                    size="small"
                    placeholder={`Item ${i + 1}`}
                    value={typeof item === 'string' ? item : item.text}
                    onChange={e => {
                      const newItems = [...(question.items || question.options || [])];
                      newItems[i] = { text: e.target.value };
                      setQuestion(p => ({ ...p, items: newItems }));
                    }}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: 'white' } }}
                  />
                  <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                    <IconButton
                      size="small"
                      onClick={() => {
                        const items = [...(question.items || question.options || [])];
                        if (i > 0) {
                          [items[i - 1], items[i]] = [items[i], items[i - 1]];
                          setQuestion(p => ({ ...p, items }));
                        }
                      }}
                      disabled={i === 0}
                      sx={{ p: 0.3 }}
                    >
                      ▲
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => {
                        const items = [...(question.items || question.options || [])];
                        if (i < items.length - 1) {
                          [items[i], items[i + 1]] = [items[i + 1], items[i]];
                          setQuestion(p => ({ ...p, items }));
                        }
                      }}
                      disabled={i === (question.items || question.options || []).length - 1}
                      sx={{ p: 0.3 }}
                    >
                      ▼
                    </IconButton>
                  </Box>
                  <IconButton
                    size="small"
                    onClick={() => {
                      const items = [...(question.items || question.options || [])];
                      items.splice(i, 1);
                      setQuestion(p => ({ ...p, items }));
                    }}
                    sx={{ color: '#EF4444' }}
                  >
                    <Delete fontSize="small" />
                  </IconButton>
                </Box>
              ))}
            </Box>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Add />}
              onClick={() => {
                const items = [...(question.items || question.options || [])];
                items.push({ text: '' });
                setQuestion(p => ({ ...p, items }));
              }}
              sx={{ mt: 1, textTransform: 'none', borderStyle: 'dashed' }}
            >
              Add Item
            </Button>
            <Typography sx={{ fontSize: 11, color: tokens.textMuted, mt: 1 }}>
              Items will be shuffled for students. They drag to arrange in the correct order shown here.
            </Typography>
          </Box>
        )}

        {/* Open / Short */}
        {isOpen && (
          <TextField fullWidth size="small" label="Model Answer (used for AI grading)" multiline minRows={2}
            value={question.correctAnswer} onChange={e => setQuestion(p => ({ ...p, correctAnswer: e.target.value }))}
            sx={{ mb: 1.5, '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: 'white' } }} />
        )}

        <Button variant="contained" startIcon={<Add />} onClick={onAddQuestion} disabled={!question.text.trim()}
          sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none', background: gradients.brand, boxShadow: 'none', fontSize: 13 }}>
          Add Question
        </Button>
      </Paper>

      {/* Questions list by section */}
      {exam.sections.map((sec, si) => sec.questions?.length > 0 && (
        <Box key={si} sx={{ mb: 1.5 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 12, color: tokens.textMuted, mb: 0.75, fontFamily: "DM Sans,sans-serif", textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Section {sec.name}
          </Typography>
          {sec.questions.map((q, qi) => (
            <Paper key={qi} elevation={0} sx={{ p: 1.5, mb: 0.75, borderRadius: 2, border: `1px solid ${tokens.surfaceBorder}`, borderLeft: `3px solid ${tokens.accent}`, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip label={`Q${qi + 1}`} size="small" sx={{ bgcolor: 'rgba(12,189,115,0.1)', color: tokens.accentDark, fontWeight: 700, minWidth: 36 }} />
              <Chip label={Q_TYPES.find(t => t.value === q.type)?.label || q.type} size="small" sx={{ bgcolor: '#F1F5F9', color: tokens.textSecondary, fontSize: 11 }} />
              <Typography variant="body2" sx={{ flexGrow: 1, fontFamily: "DM Sans,sans-serif", fontSize: 13 }} noWrap>{q.text}</Typography>
              <Chip label={`${q.points}pt`} size="small" sx={{ bgcolor: 'rgba(245,158,11,0.1)', color: tokens.warning, fontWeight: 700, fontSize: 11 }} />
              <FormControl size="small" sx={{ minWidth: 100 }}>
                <Select
                  value={si}
                  onChange={(e) => {
                    const targetSectionIdx = e.target.value;
                    if (targetSectionIdx !== si) {
                      // Move question to target section
                      const newSections = [...exam.sections];
                      const questionToMove = newSections[si].questions[qi];
                      newSections[si].questions = newSections[si].questions.filter((_, idx) => idx !== qi);
                      newSections[targetSectionIdx].questions.push(questionToMove);
                      setExam({ ...exam, sections: newSections });
                    }
                  }}
                  sx={{ borderRadius: 2, '& .MuiSelect-select': { fontSize: 11, py: 0.5 } }}
                >
                  {exam.sections.map((s, idx) => (
                    <MenuItem key={idx} value={idx} sx={{ fontSize: 11 }}>
                      Section {s.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <IconButton size="small" onClick={() => onRemoveQuestion(si, qi)} sx={{ color: tokens.danger }}><Delete fontSize="small" /></IconButton>
            </Paper>
          ))}
        </Box>
      ))}

      {error && <Box sx={{ mb: 1.5, p: 1.5, borderRadius: 2, bgcolor: 'rgba(239,68,68,0.07)', color: '#EF4444', fontSize: 13 }}>{error}</Box>}

      {/* Action buttons */}
      <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
        <Button 
          variant="outlined" 
          onClick={onSaveDraft} 
          disabled={savingDraft}
          sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600, borderColor: tokens.warning, color: tokens.warning, '&:hover': { bgcolor: 'rgba(245,158,11,0.07)' } }}
        >
          {savingDraft ? 'Saving...' : ' Save Draft'}
        </Button>
        <Button 
          variant="contained" 
          onClick={onPublish} 
          disabled={publishing}
          sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none', background: gradients.brand, boxShadow: 'none' }}
        >
          {publishing ? 'Publishing...' : 'Publish Exam'}
        </Button>
      </Box>
    </Box>
  );
}

function ExamsSection({ exams, setExams, setActiveSection, user }) {
  const { hasMarketplaceAccess } = usePlan();
  const [publishExamId, setPublishExamId] = useState(null);
  const [editExam, setEditExam] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState({});
  const [snack, setSnack] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');

  // Fetch pending approvals for each exam with auto-refresh (enterprise only)
  useEffect(() => {
    if (!hasMarketplaceAccess) return;
    const fetchPendingApprovals = async () => {
      const approvals = {};
      await Promise.all(
        exams.map(async (exam) => {
          try {
            const response = await api.get(`/marketplace/exams/${exam._id}/requests`);
            const pendingCount = response.data.filter(r => r.status === 'pending').length;
            if (pendingCount > 0) {
              approvals[exam._id] = pendingCount;
            }
          } catch (err) {
            console.error(`Error fetching approvals for exam ${exam._id}:`, err);
          }
        })
      );
      setPendingApprovals(approvals);
    };

    fetchPendingApprovals();
    const interval = setInterval(fetchPendingApprovals, 30000);

    return () => clearInterval(interval);
  }, [exams, hasMarketplaceAccess]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/admin/exams/${deleteId}`);
      setExams(p => p.filter(e => e._id !== deleteId));
      setDeleteId(null);
    } catch { }
    finally { setDeleting(false); }
  };

  const handleActivateExam = async (examId) => {
    if (!window.confirm('Activate this exam? Students will be able to see and take it once approved.')) return;
    try {
      await api.put(`/admin/exams/${examId}`, { status: 'active' });
      setExams(p => p.map(e => e._id === examId ? { ...e, status: 'active' } : e));
      setSnack('Exam activated successfully!');
    } catch {
      setSnack('Error activating exam.');
    }
  };

  const handleEditClick = async (exam) => {
    try {
      const res = await api.get(`/admin/exams/${exam._id}`);
      setEditExam(res.data);
    } catch { }
  };

  const handleSaveEdit = async (updated) => {
    try {
      const payload = {
        title: updated.title,
        description: updated.description,
        timeLimit: updated.timeLimit,
        passingScore: updated.passingScore,
        sections: updated.sections
      };
      const res = await api.put(`/admin/exams/${updated._id}`, payload);
      setExams(p => p.map(e => e._id === updated._id ? { ...e, ...res.data } : e));
      setEditExam(null);
      setSnack('Exam updated successfully');
    } catch (err) {
      setSnack(err.response?.data?.message || 'Failed to update exam');
    }
  };

  const filteredExams = exams
    .filter(e => {
      const matchSearch = !search || e.title?.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || (e.status || 'draft') === statusFilter;
      return matchSearch && matchStatus;
    })
    .sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.createdAt) - new Date(a.createdAt);
      if (sortBy === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt);
      if (sortBy === 'title') return a.title?.localeCompare(b.title);
      if (sortBy === 'questions') {
        const qa = a.sections?.reduce((s, sec) => s + (sec.questions?.length || 0), 0) || 0;
        const qb = b.sections?.reduce((s, sec) => s + (sec.questions?.length || 0), 0) || 0;
        return qb - qa;
      }
      return 0;
    });

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1.5 }}>
        <SectionTitle>My Exams</SectionTitle>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => setActiveSection('home')}
          sx={{ borderRadius: 2.5, fontWeight: 700, textTransform: 'none', background: gradients.brand, boxShadow: 'none', px: 2.5, fontFamily: "DM Sans,sans-serif", '&:hover': { boxShadow: '0 4px 14px rgba(12,189,115,0.3)' } }}
        >
          Create Exam
        </Button>
      </Box>

      {/* Filters */}
      <Paper elevation={0} sx={{ p: 2, borderRadius: 2.5, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white', mb: 2, display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
        <TextField
          size="small"
          placeholder="Search exams…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 16, color: tokens.textMuted }} /></InputAdornment> }}
          sx={{ flex: '1 1 200px', '& .MuiOutlinedInput-root': { borderRadius: 2, fontSize: 13 } }}
        />
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel sx={{ fontSize: 13 }}>Status</InputLabel>
          <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} label="Status" sx={{ borderRadius: 2, fontSize: 13 }}>
            <MenuItem value="all">All Statuses</MenuItem>
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="draft">Draft</MenuItem>
            <MenuItem value="inactive">Inactive</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel sx={{ fontSize: 13 }}>Sort By</InputLabel>
          <Select value={sortBy} onChange={e => setSortBy(e.target.value)} label="Sort By" sx={{ borderRadius: 2, fontSize: 13 }}>
            <MenuItem value="newest">Newest First</MenuItem>
            <MenuItem value="oldest">Oldest First</MenuItem>
            <MenuItem value="title">Title A–Z</MenuItem>
            <MenuItem value="questions">Most Questions</MenuItem>
          </Select>
        </FormControl>
        {(search || statusFilter !== 'all') && (
          <Chip
            label={`${filteredExams.length} of ${exams.length}`}
            size="small"
            onDelete={() => { setSearch(''); setStatusFilter('all'); }}
            sx={{ bgcolor: 'rgba(13,64,108,0.07)', color: tokens.primary, fontWeight: 600 }}
          />
        )}
      </Paper>

      <Paper elevation={0} sx={{ borderRadius: 3, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white', overflow: 'hidden', overflowX: 'auto' }}>
          <TableContainer sx={{ overflowX: 'auto' }}><Table sx={{ minWidth: 650 }}>
            <TableHead><TableRow sx={{ bgcolor: '#F8FAFC' }}>{['Title', 'Status', 'Questions', 'Time', 'Created', ...(hasMarketplaceAccess ? ['Pending Approvals'] : []), 'Actions'].map(h => <TableCell key={h} sx={{ fontWeight: 700, color: tokens.textSecondary, fontSize: 12, px: 1.5, py: 1 }}>{h}</TableCell>)}</TableRow></TableHead>
            <TableBody>
              {filteredExams.length === 0 ? <TableRow><TableCell colSpan={7} align="center" sx={{ py: 5, color: tokens.textMuted }}>{exams.length === 0 ? 'No exams yet.' : 'No exams match your filters.'}</TableCell></TableRow> :
                filteredExams.map(e => {
                  const sc = e.status === 'active' ? tokens.accent : e.status === 'draft' ? tokens.warning : '#6366F1';
                  const totalQuestions = e.sections?.reduce((total, section) =>
                    total + (section.questions?.length || 0), 0
                  ) || e.questions?.length || 0;
                  const pendingCount = pendingApprovals[e._id] || 0;
                  return (
                  <TableRow key={e._id} sx={{ '&:hover': { bgcolor: '#F8FAFC' } }}>
                    <TableCell><Typography variant="body2" fontWeight={600} sx={{ fontFamily: "DM Sans,sans-serif" }}>{e.title}</Typography></TableCell>
                    <TableCell><Chip label={e.status || 'draft'} size="small" sx={{ bgcolor: `${sc}14`, color: sc, fontWeight: 600, textTransform: 'capitalize' }} /></TableCell>
                    <TableCell><Chip label={totalQuestions} size="small" sx={{ bgcolor: 'rgba(13,64,108,0.07)', color: tokens.primary }} /></TableCell>
                    <TableCell><Typography variant="body2" sx={{ color: tokens.textMuted }}>{e.timeLimit} min</Typography></TableCell>
                    <TableCell><Typography variant="caption" sx={{ color: tokens.textMuted }}>{new Date(e.createdAt).toLocaleDateString()}</Typography></TableCell>
                    {hasMarketplaceAccess && (
                      <TableCell>
                        {pendingCount > 0 ? (
                          <Chip label={pendingCount} size="small" sx={{ bgcolor: 'rgba(245,158,11,0.1)', color: '#F59E0B', fontWeight: 700 }} />
                        ) : (
                          <Typography variant="body2" sx={{ color: tokens.textMuted }}>-</Typography>
                        )}
                      </TableCell>
                    )}
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                        {e.status === 'draft' && (
                          <Tooltip title="Activate Exam">
                            <IconButton size="small" onClick={() => handleActivateExam(e._id)} sx={{ color: '#10B981' }}><CheckCircle sx={{ fontSize: 16 }} /></IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title="Publish / Share"><IconButton size="small" onClick={() => setPublishExamId(e._id)} sx={{ color: tokens.accent }}><Publish sx={{ fontSize: 16 }} /></IconButton></Tooltip>
                        <Tooltip title="Edit"><IconButton size="small" onClick={() => handleEditClick(e)} sx={{ color: tokens.primary }}><Edit sx={{ fontSize: 16 }} /></IconButton></Tooltip>
                        <Tooltip title="Delete"><IconButton size="small" onClick={() => setDeleteId(e._id)} sx={{ color: '#EF4444' }}><Delete sx={{ fontSize: 16 }} /></IconButton></Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>); })}
            </TableBody>
          </Table></TableContainer>
      </Paper>

      {/* Edit Dialog */}
      {editExam && (
        <Dialog open onClose={() => setEditExam(null)} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
          <DialogTitle sx={{ fontWeight: 700, fontFamily: "DM Sans,sans-serif", pb: 1 }}>Edit Exam</DialogTitle>
          <DialogContent sx={{ pt: 2, maxHeight: '70vh', overflowY: 'auto' }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              {/* Basic Info */}
              <Box>
                <Typography fontWeight={700} sx={{ fontSize: 13, color: tokens.textSecondary, mb: 1.5, textTransform: 'uppercase', letterSpacing: 0.5 }}>Basic Information</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <TextField fullWidth label="Title" value={editExam.title} onChange={e => setEditExam(p => ({ ...p, title: e.target.value }))} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
                  <TextField fullWidth label="Description" value={editExam.description || ''} onChange={e => setEditExam(p => ({ ...p, description: e.target.value }))} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <TextField fullWidth label="Time Limit (min)" type="number" value={editExam.timeLimit} onChange={e => setEditExam(p => ({ ...p, timeLimit: +e.target.value }))} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
                    <TextField fullWidth label="Passing Score (%)" type="number" value={editExam.passingScore} onChange={e => setEditExam(p => ({ ...p, passingScore: +e.target.value }))} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
                  </Box>
                </Box>
              </Box>

              {/* Sections & Questions Summary */}
              <Box>
                <Typography fontWeight={700} sx={{ fontSize: 13, color: tokens.textSecondary, mb: 1.5, textTransform: 'uppercase', letterSpacing: 0.5 }}>Sections & Questions</Typography>
                {editExam.sections && editExam.sections.length > 0 ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {editExam.sections.map((sec, si) => (
                      <Paper key={si} elevation={0} sx={{ p: 1.5, borderRadius: 2, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: '#F8FAFC' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                          <Box>
                            <Typography fontWeight={700} sx={{ fontSize: 13, fontFamily: "DM Sans,sans-serif" }}>Section {sec.name}</Typography>
                            <Typography sx={{ fontSize: 11, color: tokens.textMuted }}>{sec.description}</Typography>
                          </Box>
                          <Chip label={`${sec.questions?.length || 0} Q`} size="small" sx={{ bgcolor: 'rgba(12,189,115,0.1)', color: tokens.accent, fontWeight: 700 }} />
                        </Box>
                        <Box sx={{ mt: 1 }}>
                          <TextField
                            fullWidth
                            label="Question Count"
                            type="number"
                            size="small"
                            value={sec.questionCount || sec.questions?.length || 0}
                            onChange={e => {
                              const updatedSections = [...editExam.sections];
                              updatedSections[si] = { ...sec, questionCount: parseInt(e.target.value) || 0 };
                              setEditExam(p => ({ ...p, sections: updatedSections }));
                            }}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                          />
                        </Box>
                        {sec.questions && sec.questions.length > 0 && (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1 }}>
                            {sec.questions.slice(0, 5).map((q, qi) => (
                              <Chip key={qi} label={`Q${qi + 1}`} size="small" sx={{ fontSize: 10, bgcolor: 'white', border: `1px solid ${tokens.surfaceBorder}` }} />
                            ))}
                            {sec.questions.length > 5 && <Chip label={`+${sec.questions.length - 5}`} size="small" sx={{ fontSize: 10, bgcolor: 'white', border: `1px solid ${tokens.surfaceBorder}` }} />}
                          </Box>
                        )}
                      </Paper>
                    ))}
                  </Box>
                ) : (
                  <Typography sx={{ fontSize: 12, color: tokens.textMuted, fontStyle: 'italic' }}>No sections or questions yet.</Typography>
                )}
                <Typography sx={{ fontSize: 11, color: tokens.textMuted, mt: 1.5, fontStyle: 'italic' }}>To edit questions and sections, use the exam preview or create a new exam.</Typography>
              </Box>
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
            <Button onClick={() => setEditExam(null)} sx={{ borderRadius: 2, textTransform: 'none', color: tokens.textSecondary }}>Cancel</Button>
            <Button variant="contained" onClick={() => handleSaveEdit(editExam)} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, background: gradients.brand, boxShadow: 'none' }}>Save Changes</Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteId} onClose={() => setDeleteId(null)} PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700, fontFamily: "DM Sans,sans-serif" }}>Delete Exam?</DialogTitle>
        <DialogContent><Typography sx={{ color: tokens.textSecondary }}>This will permanently delete the exam and all its questions. This cannot be undone.</Typography></DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setDeleteId(null)} sx={{ borderRadius: 2, textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained" onClick={handleDelete} disabled={deleting}
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, bgcolor: '#EF4444', '&:hover': { bgcolor: '#DC2626' }, boxShadow: 'none' }}>
            {deleting ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {publishExamId && <PublishDialog examId={publishExamId} onClose={() => setPublishExamId(null)} setActiveSection={(section) => setActiveSection(section)} />}
      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack('')} message={snack} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </Box>
  );
}

// Memoized StudentFormFields component (moved outside StudentsSection to prevent re-creation)
const StudentFormFields = memo(({ form, setForm, formError }) => {
  console.log('StudentFormFields render');
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
      {formError && <Alert severity="error" sx={{ borderRadius: 2 }}>{formError}</Alert>}
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <TextField label="First Name *" value={form.firstName} onChange={e => { console.log('First Name onChange:', e.target.value); setForm(p => ({ ...p, firstName: e.target.value })); }} sx={{ flex: 1, minWidth: 200, '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
        <TextField label="Last Name *" value={form.lastName} onChange={e => { console.log('Last Name onChange:', e.target.value); setForm(p => ({ ...p, lastName: e.target.value })); }} sx={{ flex: 1, minWidth: 200, '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
      </Box>
      <TextField label="Email *" type="email" value={form.email} onChange={e => { console.log('Email onChange:', e.target.value); setForm(p => ({ ...p, email: e.target.value })); }} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <TextField label="Phone" value={form.phone} onChange={e => { console.log('Phone onChange:', e.target.value); setForm(p => ({ ...p, phone: e.target.value })); }} sx={{ flex: 1, minWidth: 200, '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
        <TextField label="Class / Grade" value={form.class} onChange={e => { console.log('Class onChange:', e.target.value); setForm(p => ({ ...p, class: e.target.value })); }} sx={{ flex: 1, minWidth: 200, '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
      </Box>
      <FormControl sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}>
        <InputLabel>Gender</InputLabel>
        <Select value={form.gender} onChange={e => setForm(p => ({ ...p, gender: e.target.value }))} label="Gender">
          <MenuItem value="">Not specified</MenuItem>
          <MenuItem value="male">Male</MenuItem>
          <MenuItem value="female">Female</MenuItem>
          <MenuItem value="other">Other</MenuItem>
        </Select>
      </FormControl>
    </Box>
  );
});

function StudentsSection() {
  const isXs = useMediaQuery('(max-width:600px)');
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [classFilter, setClassFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [snack, setSnack] = useState('');
  const [createDialog, setCreateDialog] = useState(false);
  const [viewDialog, setViewDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(null);
  const [resetPasswordDialog, setResetPasswordDialog] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const emptyForm = { firstName: '', lastName: '', email: '', phone: '', class: '', gender: '' };
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api.get('/admin/students').then(r => setStudents(r.data || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const uniqueClasses = [...new Set(students.map(s => s.class).filter(Boolean))].sort();

  const filtered = students
    .filter(s => {
      const name = `${s.firstName} ${s.lastName}`.toLowerCase();
      const matchSearch = !search || name.includes(search.toLowerCase()) || s.email?.toLowerCase().includes(search.toLowerCase()) || s.class?.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || (statusFilter === 'active' ? !s.isBlocked : s.isBlocked);
      const matchClass = classFilter === 'all' || s.class === classFilter;
      return matchSearch && matchStatus && matchClass;
    })
    .sort((a, b) => {
      if (sortBy === 'name') return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
      if (sortBy === 'email') return a.email?.localeCompare(b.email);
      if (sortBy === 'class') return (a.class || '').localeCompare(b.class || '');
      if (sortBy === 'newest') return new Date(b.createdAt) - new Date(a.createdAt);
      return 0;
    });

  const totalActive = students.filter(s => !s.isBlocked).length;
  const totalBlocked = students.filter(s => s.isBlocked).length;
  const totalClasses = uniqueClasses.length;

  const handleCreate = async () => {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) { setFormError('First name, last name and email are required.'); return; }
    setSaving(true); setFormError('');
    try {
      await api.post('/admin/students', form);
      setSnack('✓ Student created successfully');
      setCreateDialog(false);
      setForm(emptyForm);
      load();
    } catch (err) { setFormError(err.response?.data?.message || 'Failed to create student'); }
    finally { setSaving(false); }
  };

  const handleEdit = async () => {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) { setFormError('First name, last name and email are required.'); return; }
    setSaving(true); setFormError('');
    try {
      await api.put(`/admin/students/${selectedStudent._id}`, form);
      setSnack('✓ Student updated successfully');
      setEditDialog(false);
      setForm(emptyForm);
      setSelectedStudent(null);
      load();
    } catch (err) { setFormError(err.response?.data?.message || 'Failed to update student'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/admin/students/${deleteDialog._id}`);
      setSnack('✓ Student deleted');
      setDeleteDialog(null);
      load();
    } catch (err) { setSnack(err.response?.data?.message || 'Failed to delete student'); setDeleteDialog(null); }
    finally { setDeleting(false); }
  };

  const handleToggleBlock = async (s) => {
    try {
      await api.put(`/admin/students/${s._id}`, { isBlocked: !s.isBlocked });
      setSnack(`✓ Student ${s.isBlocked ? 'unblocked' : 'blocked'}`);
      load();
    } catch { setSnack('Failed to update student status'); }
  };

  const handleResetPassword = async () => {
    setResettingPassword(true);
    try {
      await api.post(`/admin/students/${resetPasswordDialog._id}/reset-password`);
      setSnack('✓ Password reset successfully. Student will receive an email with the new password.');
      setResetPasswordDialog(null);
    } catch { setSnack('Failed to reset password'); }
    finally { setResettingPassword(false); }
  };

  const openEdit = (s) => { setSelectedStudent(s); setForm({ firstName: s.firstName || '', lastName: s.lastName || '', email: s.email || '', phone: s.phone || '', class: s.class || '', gender: s.gender || '' }); setFormError(''); setEditDialog(true); };
  const openView = (s) => { setSelectedStudent(s); setViewDialog(true); };

  const avatarBg = ['rgba(12,189,115,0.12)', 'rgba(13,64,108,0.1)', 'rgba(99,102,241,0.12)', 'rgba(245,158,11,0.12)', 'rgba(236,72,153,0.12)'];
  const avatarColor = [tokens.accentDark, tokens.primary, '#6366F1', '#D97706', '#DB2777'];
  const getAvatar = (name, idx) => ({ bg: avatarBg[idx % 5], color: avatarColor[idx % 5], letter: name?.charAt(0)?.toUpperCase() || '?' });

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5, flexWrap: 'wrap', gap: 1.5 }}>
        <SectionTitle>Students</SectionTitle>
        <Button variant="contained" startIcon={<Add />} onClick={() => { setForm(emptyForm); setFormError(''); setCreateDialog(true); }}
          sx={{ borderRadius: 2.5, fontWeight: 700, textTransform: 'none', background: gradients.brand, boxShadow: 'none', px: 2.5, fontFamily: "DM Sans,sans-serif", '&:hover': { boxShadow: '0 4px 14px rgba(12,189,115,0.3)' } }}>
          Add Student
        </Button>
      </Box>

      {/* Stat Cards */}
      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        {[
          { label: 'Total Students', value: students.length, color: tokens.primary, bg: 'rgba(13,64,108,0.07)', icon: <People sx={{ fontSize: 22, color: tokens.primary }} /> },
          { label: 'Active',         value: totalActive,     color: tokens.accentDark, bg: 'rgba(12,189,115,0.09)', icon: <CheckCircle sx={{ fontSize: 22, color: tokens.accentDark }} /> },
          { label: 'Blocked',        value: totalBlocked,    color: '#EF4444', bg: 'rgba(239,68,68,0.07)', icon: <ErrorOutline sx={{ fontSize: 22, color: '#EF4444' }} /> },
          { label: 'Classes',        value: totalClasses,    color: '#6366F1', bg: 'rgba(99,102,241,0.09)', icon: <Assignment sx={{ fontSize: 22, color: '#6366F1' }} /> },
        ].map((c, i) => (
          <Grid item xs={6} sm={3} key={i}>
            <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Box sx={{ width: 38, height: 38, borderRadius: 2, bgcolor: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{c.icon}</Box>
                <Typography fontWeight={800} sx={{ fontSize: 22, color: tokens.textPrimary, fontFamily: "DM Sans,sans-serif" }}>{c.value}</Typography>
              </Box>
              <Typography sx={{ fontSize: 12.5, color: tokens.textMuted, fontFamily: "DM Sans,sans-serif", fontWeight: 600 }}>{c.label}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* Filters */}
      <Paper elevation={0} sx={{ p: 2, borderRadius: 2.5, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white', mb: 2, display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
        <TextField size="small" placeholder="Search by name, email, class…" value={search} onChange={e => setSearch(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 16, color: tokens.textMuted }} /></InputAdornment> }}
          sx={{ flex: '1 1 200px', '& .MuiOutlinedInput-root': { borderRadius: 2, fontSize: 13 } }} />
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel sx={{ fontSize: 13 }}>Status</InputLabel>
          <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} label="Status" sx={{ borderRadius: 2, fontSize: 13 }}>
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="blocked">Blocked</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel sx={{ fontSize: 13 }}>Class</InputLabel>
          <Select value={classFilter} onChange={e => setClassFilter(e.target.value)} label="Class" sx={{ borderRadius: 2, fontSize: 13 }}>
            <MenuItem value="all">All Classes</MenuItem>
            {uniqueClasses.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel sx={{ fontSize: 13 }}>Sort By</InputLabel>
          <Select value={sortBy} onChange={e => setSortBy(e.target.value)} label="Sort By" sx={{ borderRadius: 2, fontSize: 13 }}>
            <MenuItem value="name">Name A–Z</MenuItem>
            <MenuItem value="email">Email A–Z</MenuItem>
            <MenuItem value="class">Class A–Z</MenuItem>
            <MenuItem value="newest">Newest First</MenuItem>
          </Select>
        </FormControl>
        {(search || statusFilter !== 'all' || classFilter !== 'all') && (
          <Chip label={`${filtered.length} of ${students.length}`} size="small"
            onDelete={() => { setSearch(''); setStatusFilter('all'); setClassFilter('all'); }}
            sx={{ bgcolor: 'rgba(13,64,108,0.07)', color: tokens.primary, fontWeight: 600 }} />
        )}
      </Paper>

      {/* Table */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress sx={{ color: tokens.accent }} /></Box>
      ) : (
        <Paper elevation={0} sx={{ borderRadius: 3, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white', overflow: 'hidden' }}>
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table sx={{ minWidth: 600 }}>
              <TableHead>
                <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                  {['Student', 'Email', 'Phone', 'Class', 'Gender', 'Status', 'Actions'].map(h => (
                    <TableCell key={h} sx={{ fontWeight: 700, color: tokens.textSecondary, fontSize: 12, px: 2, py: 1.25 }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} align="center" sx={{ py: 6, color: tokens.textMuted }}>
                    {students.length === 0 ? 'No students yet. Add your first student.' : 'No students match your filters.'}
                  </TableCell></TableRow>
                ) : filtered.map((s, i) => {
                  const av = getAvatar(`${s.firstName} ${s.lastName}`, i);
                  return (
                    <TableRow key={s._id} sx={{ '&:hover': { bgcolor: '#F8FAFC' } }}>
                      <TableCell sx={{ px: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Box sx={{ width: 34, height: 34, borderRadius: '50%', bgcolor: av.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: av.color, fontSize: 13, flexShrink: 0 }}>{av.letter}</Box>
                          <Box>
                            <Typography variant="body2" fontWeight={600} sx={{ fontFamily: "DM Sans,sans-serif", lineHeight: 1.3 }}>{s.firstName} {s.lastName}</Typography>
                            {s.createdAt && <Typography sx={{ fontSize: 11, color: tokens.textMuted }}>Joined {new Date(s.createdAt).toLocaleDateString()}</Typography>}
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ px: 2 }}><Typography variant="body2" sx={{ color: tokens.textSecondary }}>{s.email}</Typography></TableCell>
                      <TableCell sx={{ px: 2 }}><Typography variant="body2" sx={{ color: tokens.textMuted }}>{s.phone || '—'}</Typography></TableCell>
                      <TableCell sx={{ px: 2 }}><Chip label={s.class || 'N/A'} size="small" sx={{ bgcolor: 'rgba(13,64,108,0.07)', color: tokens.primary, fontWeight: 600, fontSize: 11 }} /></TableCell>
                      <TableCell sx={{ px: 2 }}><Typography variant="body2" sx={{ color: tokens.textMuted, textTransform: 'capitalize' }}>{s.gender || '—'}</Typography></TableCell>
                      <TableCell sx={{ px: 2 }}>
                        <Chip label={s.isBlocked ? 'Blocked' : 'Active'} size="small"
                          sx={{ bgcolor: s.isBlocked ? 'rgba(239,68,68,0.08)' : 'rgba(12,189,115,0.1)', color: s.isBlocked ? '#EF4444' : tokens.accentDark, fontWeight: 700, fontSize: 11 }} />
                      </TableCell>
                      <TableCell sx={{ px: 2 }}>
                        <Box sx={{ display: 'flex', gap: 0.25 }}>
                          <Tooltip title="View Details">
                            <IconButton size="small" onClick={() => openView(s)} sx={{ color: tokens.primary }}><Visibility sx={{ fontSize: 16 }} /></IconButton>
                          </Tooltip>
                          <Tooltip title="Edit">
                            <IconButton size="small" onClick={() => openEdit(s)} sx={{ color: tokens.accent }}><Edit sx={{ fontSize: 16 }} /></IconButton>
                          </Tooltip>
                          <Tooltip title={s.isBlocked ? 'Unblock' : 'Block'}>
                            <IconButton size="small" onClick={() => handleToggleBlock(s)} sx={{ color: s.isBlocked ? tokens.accentDark : '#F59E0B' }}>
                              {s.isBlocked ? <CheckCircleOutline sx={{ fontSize: 16 }} /> : <ErrorOutline sx={{ fontSize: 16 }} />}
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Reset Password">
                            <IconButton size="small" onClick={() => setResetPasswordDialog(s)} sx={{ color: '#6366F1' }}><LockReset sx={{ fontSize: 16 }} /></IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton size="small" onClick={() => setDeleteDialog(s)} sx={{ color: '#EF4444' }}><Delete sx={{ fontSize: 16 }} /></IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* Create Dialog */}
      <Dialog open={createDialog} onClose={() => setCreateDialog(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700, fontFamily: "DM Sans,sans-serif", pb: 0 }}>Add New Student</DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}><StudentFormFields form={form} setForm={setForm} formError={formError} /></DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setCreateDialog(false)} sx={{ borderRadius: 2, textTransform: 'none', color: tokens.textSecondary }}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={saving}
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, background: gradients.brand, boxShadow: 'none' }}>
            {saving ? <CircularProgress size={16} color="inherit" /> : 'Create Student'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialog} onClose={() => setEditDialog(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700, fontFamily: "DM Sans,sans-serif", pb: 0 }}>Edit Student</DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}><StudentFormFields form={form} setForm={setForm} formError={formError} /></DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setEditDialog(false)} sx={{ borderRadius: 2, textTransform: 'none', color: tokens.textSecondary }}>Cancel</Button>
          <Button variant="contained" onClick={handleEdit} disabled={saving}
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, background: gradients.brand, boxShadow: 'none' }}>
            {saving ? <CircularProgress size={16} color="inherit" /> : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Dialog */}
      {selectedStudent && viewDialog && (
        <Dialog open onClose={() => setViewDialog(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
          <Box sx={{ px: 3, py: 2.5, background: gradients.brand, display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ width: 48, height: 48, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: 'white', fontSize: 20 }}>
              {selectedStudent.firstName?.charAt(0)?.toUpperCase()}
            </Box>
            <Box>
              <Typography fontWeight={700} color="white" sx={{ fontSize: 16, fontFamily: "DM Sans,sans-serif" }}>{selectedStudent.firstName} {selectedStudent.lastName}</Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.8)', fontSize: 12.5 }}>{selectedStudent.email}</Typography>
            </Box>
          </Box>
          <DialogContent sx={{ pt: 2.5 }}>
            {[
              { label: 'Phone',   value: selectedStudent.phone  || '—' },
              { label: 'Class',   value: selectedStudent.class  || '—' },
              { label: 'Gender',  value: selectedStudent.gender || '—', capitalize: true },
              { label: 'Status',  value: selectedStudent.isBlocked ? 'Blocked' : 'Active' },
              { label: 'Joined',  value: selectedStudent.createdAt ? new Date(selectedStudent.createdAt).toLocaleDateString() : '—' },
            ].map(row => (
              <Box key={row.label} sx={{ display: 'flex', justifyContent: 'space-between', py: 1, borderBottom: `1px solid ${tokens.surfaceBorder}` }}>
                <Typography sx={{ fontSize: 13, color: tokens.textMuted, fontWeight: 600 }}>{row.label}</Typography>
                <Typography sx={{ fontSize: 13, color: tokens.textPrimary, fontWeight: 600, textTransform: row.capitalize ? 'capitalize' : 'none' }}>{row.value}</Typography>
              </Box>
            ))}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
            <Button onClick={() => setViewDialog(false)} sx={{ borderRadius: 2, textTransform: 'none' }}>Close</Button>
            <Button variant="outlined" onClick={() => { setViewDialog(false); openEdit(selectedStudent); }} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}>Edit</Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Delete Confirm */}
      <Dialog open={!!deleteDialog} onClose={() => setDeleteDialog(null)} PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700, fontFamily: "DM Sans,sans-serif" }}>Delete Student?</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: tokens.textSecondary }}>
            Permanently delete <strong>{deleteDialog?.firstName} {deleteDialog?.lastName}</strong>? This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setDeleteDialog(null)} sx={{ borderRadius: 2, textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained" onClick={handleDelete} disabled={deleting}
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, bgcolor: '#EF4444', '&:hover': { bgcolor: '#DC2626' }, boxShadow: 'none' }}>
            {deleting ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={!!resetPasswordDialog} onClose={() => setResetPasswordDialog(null)} PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700, fontFamily: "DM Sans,sans-serif" }}>Reset Student Password?</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: tokens.textSecondary }}>
            Reset password for <strong>{resetPasswordDialog?.firstName} {resetPasswordDialog?.lastName}</strong>? A new password will be generated and sent to their email.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setResetPasswordDialog(null)} sx={{ borderRadius: 2, textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained" onClick={handleResetPassword} disabled={resettingPassword}
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, background: gradients.brand, boxShadow: 'none' }}>
            {resettingPassword ? 'Resetting…' : 'Reset Password'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack('')} message={snack} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </Box>
  );
}

function ResultsSection({ results }) {
  const [data, setData] = useState(results);
  const [loading, setLoading] = useState(!results.length);
  const [selectedResult, setSelectedResult] = useState(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState(null);
  const [regrading, setRegrading] = useState(false);
  const [regradeSuccess, setRegradeSuccess] = useState('');
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(()=>{if(!results.length)api.get('/admin/results').then(r=>setData(Array.isArray(r.data)?r.data:(r.data?.results||[]))).finally(()=>setLoading(false));else setData(results);},[results]);

  const handleViewDetails = async (resultId) => {
    try {
      setDetailLoading(true);
      setDetailDialogOpen(true);
      setRegradeSuccess('');
      const response = await api.get(`/admin/results/${resultId}`);
      setDetailData(response.data);
    } catch (err) {
      console.error('Error fetching detailed result:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleRegrade = async () => {
    if (!detailData) return;
    
    try {
      setRegrading(true);
      const response = await api.post(`/exam/regrade/${detailData._id}`, { forceRegrade: true }, { timeout: 120000 }); // 2 minute timeout
      
      if (response.data.result) {
        const { newScore, maxScore, improvement } = response.data.result;
        const percentage = Math.round((newScore / maxScore) * 100);
        
        if (improvement > 0) {
          setRegradeSuccess(`✅ Successfully regraded! Score improved by ${improvement.toFixed(1)} points (${newScore}/${maxScore} - ${percentage}%)`);
        } else if (improvement < 0) {
          setRegradeSuccess(`⚠️ Regraded. Score changed by ${improvement.toFixed(1)} points (${newScore}/${maxScore} - ${percentage}%)`);
        } else {
          setRegradeSuccess(`✓ Regraded. Score remained the same (${newScore}/${maxScore} - ${percentage}%)`);
        }
        
        // Refresh the detailed result
        await handleViewDetails(detailData._id);
        
        // Refresh the results list
        api.get('/admin/results').then(r=>setData(Array.isArray(r.data)?r.data:(r.data?.results||[])));
      }
    } catch (err) {
      console.error('Error regrading:', err);
      setRegradeSuccess('❌ Failed to regrade. Please try again.');
    } finally {
      setRegrading(false);
    }
  };

  const handleReset = async () => {
    if (!detailData || !detailData.shareToken || !detailData.student?._id) {
      alert('Cannot reset: Missing required information');
      return;
    }
    
    try {
      setResetting(true);
      const response = await api.post(`/share/${detailData.shareToken}/unlock/${detailData.student._id}`);
      
      alert(`Successfully reset ${detailData.student?.firstName} ${detailData.student?.lastName}'s exam for ${detailData.exam?.title}. They can now retake the exam.`);
      
      setResetDialogOpen(false);
      setDetailDialogOpen(false);
      
      // Refresh the results list
      api.get('/admin/results').then(r=>setData(Array.isArray(r.data)?r.data:(r.data?.results||[])));
    } catch (err) {
      console.error('Error resetting exam:', err);
      alert('Failed to reset exam: ' + (err.response?.data?.message || err.message));
    } finally {
      setResetting(false);
    }
  };

  const handleDownloadPdf = () => {
    setDownloadingPdf(true);
    try {
      // Create a printable HTML content
      const printContent = `
        <html>
          <head>
            <title>Student Result Report</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; }
              .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
              .header h1 { margin: 0; color: #333; }
              .header p { margin: 5px 0; color: #666; }
              .section { margin-bottom: 20px; }
              .section h2 { color: #333; border-bottom: 1px solid #ddd; padding-bottom: 10px; }
              .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; }
              .info-item { padding: 10px; background: #f5f5f5; border-radius: 5px; }
              .info-item strong { display: block; color: #333; }
              .weakness { background: #fee2e2; padding: 10px; margin: 10px 0; border-left: 4px solid #dc2626; border-radius: 5px; }
              .question { background: #f9f9f9; padding: 15px; margin: 10px 0; border-radius: 5px; }
              .question.correct { border-left: 4px solid #22c55e; }
              .question.incorrect { border-left: 4px solid #ef4444; }
              .question-text { font-weight: bold; margin-bottom: 5px; }
              .question-meta { color: #666; font-size: 12px; margin-bottom: 5px; }
              .footer { margin-top: 30px; text-align: center; color: #666; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>Student Exam Result Report</h1>
              <p>Generated on ${new Date().toLocaleDateString()}</p>
            </div>
            
            <div class="section">
              <h2>Student Information</h2>
              <div class="info-grid">
                <div class="info-item"><strong>Name:</strong> ${detailData.student?.firstName} ${detailData.student?.lastName}</div>
                <div class="info-item"><strong>Exam:</strong> ${detailData.exam?.title}</div>
                <div class="info-item"><strong>Score:</strong> ${detailData.totalScore}/${detailData.maxPossibleScore} (${detailData.percentage}%)</div>
                <div class="info-item"><strong>Grade:</strong> ${detailData.grade}</div>
                ${detailData.timeTaken ? `<div class="info-item"><strong>Time Taken:</strong> ${detailData.timeTaken} minutes</div>` : ''}
                ${detailData.endTime ? `<div class="info-item"><strong>Completed:</strong> ${new Date(detailData.endTime).toLocaleDateString()}</div>` : ''}
              </div>
            </div>

            ${detailData.analysis && getWeaknesses(detailData.analysis).length > 0 ? `
            <div class="section">
              <h2>Identified Weaknesses</h2>
              ${getWeaknesses(detailData.analysis).map(w => `<div class="weakness">${w.message}</div>`).join('')}
            </div>
            ` : ''}

            <div class="section">
              <h2>Question-by-Question Analysis</h2>
              ${detailData.answers?.map((answer, idx) => `
                <div class="question ${answer.isCorrect ? 'correct' : 'incorrect'}">
                  <div class="question-text">Q${idx + 1}: ${answer.question?.text || 'Question text not available'}</div>
                  <div class="question-meta">
                    Type: ${answer.question?.type} | Points: ${answer.question?.points} | 
                    <span style="color: ${answer.isCorrect ? '#22c55e' : '#ef4444'}; font-weight: bold;">
                      ${answer.isCorrect ? 'Correct' : 'Incorrect'}
                    </span>
                  </div>
                  ${answer.question?.section ? `<div class="question-meta">Section: ${answer.question.section}</div>` : ''}
                </div>
              `).join('')}
            </div>

            ${detailData.analysis?.bySection ? `
            <div class="section">
              <h2>Performance by Section</h2>
              ${Object.entries(detailData.analysis.bySection).map(([section, data]) => {
                const accuracy = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0;
                return `<div class="info-item"><strong>${section}:</strong> ${data.correct}/${data.total} correct (${accuracy}%)</div>`;
              }).join('')}
            </div>
            ` : ''}

            <div class="footer">
              <p>This report was generated by the eExams platform</p>
            </div>
          </body>
        </html>
      `;

      // Create a new window for printing
      const printWindow = window.open('', '_blank');
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('Failed to generate PDF report');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const getWeaknesses = (analysis) => {
    if (!analysis) return [];
    const weaknesses = [];
    
    // Analyze by section
    Object.entries(analysis.bySection || {}).forEach(([section, data]) => {
      const accuracy = data.total > 0 ? (data.correct / data.total) * 100 : 0;
      if (accuracy < 60) {
        weaknesses.push({
          type: 'section',
          name: section,
          accuracy: Math.round(accuracy),
          message: `Weak in ${section} (${Math.round(accuracy)}% accuracy)`
        });
      }
    });

    // Analyze by question type
    Object.entries(analysis.byType || {}).forEach(([type, data]) => {
      const accuracy = data.total > 0 ? (data.correct / data.total) * 100 : 0;
      if (accuracy < 60) {
        weaknesses.push({
          type: 'question-type',
          name: type,
          accuracy: Math.round(accuracy),
          message: `Struggles with ${type} questions (${Math.round(accuracy)}% accuracy)`
        });
      }
    });

    return weaknesses;
  };

  return(
    <Box>
      <SectionTitle>Results</SectionTitle>
      {loading?<Box sx={{display:'flex',justifyContent:'center',mt:6}}><CircularProgress sx={{color:tokens.accent}}/></Box>:(
        <Paper elevation={0} sx={{borderRadius:3,border:`1px solid ${tokens.surfaceBorder}`,bgcolor:'white',overflow:'hidden'}}>
          <TableContainer sx={{overflowX:'auto'}}><Table sx={{minWidth:500}}>
            <TableHead><TableRow sx={{bgcolor:'#F8FAFC'}}>{['Student','Exam','Score','Time','Date','Actions'].map(h=><TableCell key={h} sx={{fontWeight:700,color:tokens.textSecondary,fontSize:12}}>{h}</TableCell>)}</TableRow></TableHead>
            <TableBody>
              {data.length===0?<TableRow><TableCell colSpan={6} align="center" sx={{py:5,color:tokens.textMuted}}>No results.</TableCell></TableRow>:
              data.slice(0,50).map(r=>{const pct=Math.round(r.percentage??r.scores?.percentage??0);return(
                <TableRow key={r._id} sx={{'&:hover':{bgcolor:'#F8FAFC'}}}>
                  <TableCell sx={{fontSize:13}}>{r.student?.firstName} {r.student?.lastName}</TableCell>
                  <TableCell sx={{fontSize:13,color:tokens.textMuted}}>{r.exam?.title}</TableCell>
                  <TableCell><Box sx={{display:'flex',alignItems:'center',gap:1}}><LinearProgress variant="determinate" value={pct} sx={{width:60,height:6,borderRadius:3,bgcolor:'#EEF2FF','& .MuiLinearProgress-bar':{bgcolor:pct>=70?tokens.accent:'#EF4444',borderRadius:3}}}/><Typography sx={{fontSize:12,fontWeight:700,color:pct>=70?tokens.accentDark:'#EF4444'}}>{pct}%</Typography></Box></TableCell>
                  <TableCell><Typography variant="caption" sx={{color:tokens.textMuted}}>{r.timeTaken?`${r.timeTaken}min`:'-'}</Typography></TableCell>
                  <TableCell><Typography variant="caption" sx={{color:tokens.textMuted}}>{new Date(r.submittedAt||r.createdAt).toLocaleDateString()}</Typography></TableCell>
                  <TableCell>
                    <Button 
                      size="small" 
                      variant="outlined"
                      onClick={() => handleViewDetails(r._id)}
                      sx={{fontSize:11,py:0.5}}
                    >
                      View Details
                    </Button>
                  </TableCell>
                </TableRow>);})}
            </TableBody>
          </Table></TableContainer>
        </Paper>
      )}

      {/* Detailed Result Dialog */}
      <Dialog 
        open={detailDialogOpen} 
        onClose={() => setDetailDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Student Result Details</DialogTitle>
        <DialogContent>
          {detailLoading ? (
            <Box sx={{display:'flex',justifyContent:'center',py:6}}><CircularProgress /></Box>
          ) : detailData ? (
            <Box>
              {/* Overview */}
              <Paper sx={{p:2,mb:2,bgcolor:'#F8FAFC'}}>
                <Typography variant="subtitle2" fontWeight="bold">Overview</Typography>
                <Grid container spacing={2} sx={{mt:1}}>
                  <Grid item xs={6}>
                    <Typography variant="body2">Student: {detailData.student?.firstName} {detailData.student?.lastName}</Typography>
                    <Typography variant="body2">Exam: {detailData.exam?.title}</Typography>
                    {detailData.timeTaken && (
                      <Typography variant="body2">Time Taken: {detailData.timeTaken} minutes</Typography>
                    )}
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2">Score: {detailData.totalScore}/{detailData.maxPossibleScore} ({detailData.percentage}%)</Typography>
                    <Typography variant="body2">Grade: {detailData.grade}</Typography>
                    {detailData.endTime && (
                      <Typography variant="body2">Completed: {new Date(detailData.endTime).toLocaleDateString()}</Typography>
                    )}
                  </Grid>
                </Grid>
              </Paper>

              {/* Weaknesses */}
              {detailData.analysis && getWeaknesses(detailData.analysis).length > 0 && (
                <Paper sx={{p:2,mb:2,bgcolor:'#FEF2F2',border:1,borderColor:'#FCA5A5'}}>
                  <Typography variant="subtitle2" fontWeight="bold" color="#DC2626">Identified Weaknesses</Typography>
                  <Box sx={{mt:1}}>
                    {getWeaknesses(detailData.analysis).map((weakness, idx) => (
                      <Typography key={idx} variant="body2" sx={{color:'#991B1B'}}>
                        • {weakness.message}
                      </Typography>
                    ))}
                  </Box>
                </Paper>
              )}

              {/* Question-by-Question Analysis */}
              <Paper sx={{p:2}}>
                <Typography variant="subtitle2" fontWeight="bold">Question-by-Question Analysis</Typography>
                <Box sx={{mt:1,maxHeight:400,overflowY:'auto'}}>
                  {detailData.answers?.map((answer, idx) => (
                    <Paper key={idx} sx={{p:1.5,mb:1,bgcolor:answer.isCorrect?'#F0FDF4':'#FEF2F2'}}>
                      <Typography variant="body2" fontWeight="medium">{answer.question?.text || 'Question text not available'}</Typography>
                      <Box sx={{display:'flex',gap:2,mt:0.5}}>
                        <Typography variant="caption" color="text.secondary">Type: {answer.question?.type}</Typography>
                        <Typography variant="caption" color="text.secondary">Points: {answer.question?.points}</Typography>
                        <Typography variant="caption" sx={{color:answer.isCorrect?'#166534':'#991B1B',fontWeight:600}}>
                          {answer.isCorrect?'Correct':'Incorrect'}
                        </Typography>
                      </Box>
                      {answer.question?.section && (
                        <Typography variant="caption" color="text.secondary">Section: {answer.question.section}</Typography>
                      )}
                    </Paper>
                  ))}
                </Box>
              </Paper>

              {/* Section Analysis */}
              {detailData.analysis?.bySection && (
                <Paper sx={{p:2,mt:2}}>
                  <Typography variant="subtitle2" fontWeight="bold">Performance by Section</Typography>
                  <Box sx={{mt:1}}>
                    {Object.entries(detailData.analysis.bySection).map(([section, data]) => {
                      const accuracy = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0;
                      return (
                        <Box key={section} sx={{mb:1}}>
                          <Typography variant="body2">{section}: {data.correct}/{data.total} correct ({accuracy}%)</Typography>
                          <LinearProgress 
                            variant="determinate" 
                            value={accuracy} 
                            sx={{height:6,borderRadius:3,mt:0.5}}
                          />
                        </Box>
                      );
                    })}
                  </Box>
                </Paper>
              )}
            </Box>
          ) : (
            <Typography>No detailed data available</Typography>
          )}
        </DialogContent>
        <DialogActions>
          {regradeSuccess && (
            <Alert severity={regradeSuccess.startsWith('✅') || regradeSuccess.startsWith('✓') ? 'success' : regradeSuccess.startsWith('⚠️') ? 'warning' : 'error'} sx={{flex: 1, mr: 2}}>
              {regradeSuccess}
            </Alert>
          )}
          <Button 
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
            startIcon={downloadingPdf ? <CircularProgress size={16} /> : <Download />}
          >
            {downloadingPdf ? 'Generating...' : 'Download PDF'}
          </Button>
          <Button onClick={() => setDetailDialogOpen(false)}>Close</Button>
          <Button 
            onClick={() => setResetDialogOpen(true)}
            variant="outlined"
            color="error"
            startIcon={<RestartAlt />}
          >
            Reset for Retake
          </Button>
          <Button 
            onClick={handleRegrade}
            variant="contained"
            disabled={regrading}
            startIcon={regrading ? <CircularProgress size={16} /> : <AutoAwesome />}
          >
            {regrading ? 'Regrading...' : 'Regrade'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reset Confirmation Dialog */}
      <Dialog
        open={resetDialogOpen}
        onClose={() => setResetDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Reset Exam for Retake</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{mb: 2}}>
            This action will reset the student's exam progress, allowing them to retake the exam from scratch. Their previous result will be cleared.
          </Alert>
          <Typography variant="body2">
            Are you sure you want to reset <strong>{detailData?.student?.firstName} {detailData?.student?.lastName}</strong>'s exam for <strong>{detailData?.exam?.title}</strong>?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleReset}
            variant="contained"
            color="error"
            disabled={resetting}
            startIcon={resetting ? <CircularProgress size={16} /> : <RestartAlt />}
          >
            {resetting ? 'Resetting...' : 'Reset Exam'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function AnalyticsSection({ results, exams }) {
  const avg = results.length?Math.round(results.reduce((s,r)=>s+((r.percentage??r.scores?.percentage??0)),0)/results.length):0;
  const passRate = results.length?Math.round((results.filter(r=>((r.percentage??r.scores?.percentage??0))>=50).length/results.length)*100):0;
  const perfData = results.slice(-7).map(r=>Math.round(r.percentage??r.scores?.percentage??0));
  return(
    <Box>
      <SectionTitle>Analytics</SectionTitle>
      <Grid container spacing={2} sx={{mb:3}}>
        {[{label:'Total Exams',value:exams.length,icon:<Assignment sx={{color:tokens.accent,fontSize:24}}/>,bg:'rgba(12,189,115,0.1)'},
          {label:'Total Results',value:results.length,icon:<BarChart sx={{color:'#6366F1',fontSize:24}}/>,bg:'rgba(99,102,241,0.1)'},
          {label:'Average Score',value:`${avg}%`,icon:<TrendingUp sx={{color:tokens.warning,fontSize:24}}/>,bg:'rgba(245,158,11,0.1)'},
          {label:'Pass Rate',value:`${passRate}%`,icon:<CheckCircle sx={{color:'#EC4899',fontSize:24}}/>,bg:'rgba(236,72,153,0.1)'}
        ].map((c,i)=>(
          <Grid item xs={6} md={3} key={i}>
            <Paper elevation={0} sx={{p:2.5,borderRadius:3,bgcolor:'white',border:`1px solid ${tokens.surfaceBorder}`,display:'flex',alignItems:'center',gap:2}}>
              <Box sx={{width:48,height:48,borderRadius:2.5,bgcolor:c.bg,display:'flex',alignItems:'center',justifyContent:'center'}}>{c.icon}</Box>
              <Box><Typography variant="h5" fontWeight={800} sx={{fontFamily:"'DM Sans',sans-serif"}}>{c.value}</Typography><Typography sx={{fontSize:12,color:tokens.textMuted,fontFamily:"'DM Sans',sans-serif"}}>{c.label}</Typography></Box>
            </Paper>
          </Grid>
        ))}
      </Grid>
      <Paper elevation={0} sx={{p:3,borderRadius:3,border:`1px solid ${tokens.surfaceBorder}`,bgcolor:'white'}}>
        <SectionTitle>Score Trend (Last 7 Results)</SectionTitle>
        <AreaChart data={perfData.length>=3?perfData:[50,60,45,75,65,80,72]} color={tokens.accent}/>
      </Paper>
    </Box>
  );
}

function SettingsSection({ user }) {
  const { updateUserProfile } = useAuth();
  const [profile, setProfile] = useState({ firstName: user?.firstName||'', lastName: user?.lastName||'', phone: user?.phone||'', gender: user?.gender||'' });
  const [pwd, setPwd] = useState({ current: '', newPwd: '', confirm: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);
  const [snack, setSnack] = useState({ open: false, msg: '', severity: 'success' });
  const tf = { size: 'small', sx: { '& .MuiOutlinedInput-root': { borderRadius: 2 } } };

  const handleProfile = async () => {
    if (!profile.firstName.trim() || !profile.lastName.trim()) return setSnack({ open: true, msg: 'First and last name are required.', severity: 'error' });
    setSaving(true);
    try {
      const res = await api.put('/profile', { firstName: profile.firstName, lastName: profile.lastName, phone: profile.phone, gender: profile.gender });
      updateUserProfile(res.data);
      setSnack({ open: true, msg: 'Profile updated successfully.', severity: 'success' });
    } catch (e) {
      setSnack({ open: true, msg: e.response?.data?.message || 'Failed to save profile.', severity: 'error' });
    } finally { setSaving(false); }
  };

  const handlePassword = async () => {
    if (!pwd.current || !pwd.newPwd) return setSnack({ open: true, msg: 'Fill in current and new password.', severity: 'error' });
    if (pwd.newPwd.length < 6) return setSnack({ open: true, msg: 'New password must be at least 6 characters.', severity: 'error' });
    if (pwd.newPwd !== pwd.confirm) return setSnack({ open: true, msg: 'New passwords do not match.', severity: 'error' });
    setSavingPwd(true);
    try {
      await api.put('/auth/change-password', { currentPassword: pwd.current, newPassword: pwd.newPwd });
      setPwd({ current: '', newPwd: '', confirm: '' });
      setSnack({ open: true, msg: 'Password changed successfully.', severity: 'success' });
    } catch (e) {
      setSnack({ open: true, msg: e.response?.data?.message || 'Failed to change password.', severity: 'error' });
    } finally { setSavingPwd(false); }
  };

  return (
    <Box>
      <SectionTitle>Settings</SectionTitle>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper elevation={0} sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3, bgcolor: 'white', border: `1px solid ${tokens.surfaceBorder}`, height: '100%' }}>
            <Typography fontWeight={700} sx={{ fontFamily: "DM Sans,sans-serif", mb: 2 }}>Profile Information</Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}><TextField fullWidth label="First Name" value={profile.firstName} onChange={e => setProfile(p => ({ ...p, firstName: e.target.value }))} {...tf} /></Grid>
              <Grid item xs={12} sm={6}><TextField fullWidth label="Last Name" value={profile.lastName} onChange={e => setProfile(p => ({ ...p, lastName: e.target.value }))} {...tf} /></Grid>
              <Grid item xs={12}><TextField fullWidth label="Email" value={user?.email || ''} {...tf} InputProps={{ readOnly: true }} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: '#F8FAFC' } }} /></Grid>
              <Grid item xs={12} sm={6}><TextField fullWidth label="Phone" value={profile.phone} onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))} placeholder="+250 7XX XXX XXX" {...tf} /></Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small" sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}>
                  <InputLabel>Gender</InputLabel>
                  <Select label="Gender" value={profile.gender} onChange={e => setProfile(p => ({ ...p, gender: e.target.value }))}>
                    <MenuItem value="">Prefer not to say</MenuItem>
                    <MenuItem value="male">Male</MenuItem>
                    <MenuItem value="female">Female</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <Button variant="contained" onClick={handleProfile} disabled={saving} sx={{ borderRadius: 2, fontWeight: 700, background: gradients.brand, textTransform: 'none', minWidth: 140 }}>
                  {saving ? <CircularProgress size={18} sx={{ color: 'white' }} /> : 'Save Profile'}
                </Button>
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper elevation={0} sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3, bgcolor: 'white', border: `1px solid ${tokens.surfaceBorder}`, height: '100%' }}>
            <Typography fontWeight={700} sx={{ fontFamily: "DM Sans,sans-serif", mb: 2 }}>Change Password</Typography>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField fullWidth label="Current Password" type={showPwd ? 'text' : 'password'} value={pwd.current} onChange={e => setPwd(p => ({ ...p, current: e.target.value }))} {...tf}
                  InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" onClick={() => setShowPwd(v => !v)}>{showPwd ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}</IconButton></InputAdornment> }} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth label="New Password" type={showPwd ? 'text' : 'password'} value={pwd.newPwd} onChange={e => setPwd(p => ({ ...p, newPwd: e.target.value }))} {...tf}
                  InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" onClick={() => setShowPwd(v => !v)}>{showPwd ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}</IconButton></InputAdornment> }} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth label="Confirm New Password" type={showPwd ? 'text' : 'password'} value={pwd.confirm} onChange={e => setPwd(p => ({ ...p, confirm: e.target.value }))} {...tf}
                  error={!!pwd.confirm && pwd.confirm !== pwd.newPwd}
                  helperText={pwd.confirm && pwd.confirm !== pwd.newPwd ? 'Passwords do not match' : ''}
                  InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" onClick={() => setShowPwd(v => !v)}>{showPwd ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}</IconButton></InputAdornment> }} />
              </Grid>
              <Grid item xs={12}>
                <Button variant="contained" onClick={handlePassword} disabled={savingPwd} sx={{ borderRadius: 2, fontWeight: 700, bgcolor: '#1E293B', textTransform: 'none', minWidth: 160, '&:hover': { bgcolor: '#0F172A' } }}>
                  {savingPwd ? <CircularProgress size={18} sx={{ color: 'white' }} /> : 'Change Password'}
                </Button>
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper elevation={0} sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3, bgcolor: 'white', border: `1px solid ${tokens.surfaceBorder}` }}>
            <Typography fontWeight={700} sx={{ fontFamily: "DM Sans,sans-serif", mb: 1.5 }}>Account Info</Typography>
            <Grid container spacing={1.5}>
              {[
                { label: 'Role', value: user?.role },
                { label: 'Plan', value: user?.subscriptionPlan || 'free' },
                { label: 'Organization', value: user?.organization || '—' },
                { label: 'Account Type', value: user?.userType || '—' },
              ].map((item, i) => (
                <Grid item xs={6} sm={3} key={i}>
                  <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: '#F8FAFC', border: `1px solid ${tokens.surfaceBorder}` }}>
                    <Typography variant="caption" sx={{ color: tokens.textMuted, display: 'block', mb: 0.25 }}>{item.label}</Typography>
                    <Typography variant="body2" fontWeight={700} sx={{ textTransform: 'capitalize' }}>{item.value}</Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Paper>
        </Grid>
      </Grid>

      <Snackbar open={snack.open} autoHideDuration={3500} onClose={() => setSnack(s => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snack.severity} onClose={() => setSnack(s => ({ ...s, open: false }))} sx={{ borderRadius: 2 }}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  );
}

/* ── QUESTIONS BANK ── */
function QuestionsSection() {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [diffFilter, setDiffFilter] = useState('all');
  const [editQ, setEditQ] = useState(null);
  const [snack, setSnack] = useState('');
  const isXs = useMediaQuery('(max-width:600px)');

  const load = useCallback(() => {
    setLoading(true);
    api.get('/admin/questions').then(r => setQuestions(r.data || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this question?')) return;
    try { await api.delete(`/admin/questions/${id}`); setQuestions(p => p.filter(q => q._id !== id)); setSnack('Question deleted.'); }
    catch { setSnack('Error deleting question.'); }
  };

  const handleSaveEdit = async () => {
    try {
      const r = await api.put(`/admin/questions/${editQ._id}`, {
        text: editQ.text, points: editQ.points, difficulty: editQ.difficulty, correctAnswer: editQ.correctAnswer,
      });
      setQuestions(p => p.map(q => q._id === editQ._id ? { ...q, ...r.data } : q));
      setEditQ(null); setSnack('Question updated.');
    } catch { setSnack('Error updating question.'); }
  };

  const filtered = questions.filter(q => {
    const matchSearch = !search || q.text?.toLowerCase().includes(search.toLowerCase()) || q.exam?.title?.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === 'all' || q.type === typeFilter;
    const matchDiff = diffFilter === 'all' || q.difficulty === diffFilter;
    return matchSearch && matchType && matchDiff;
  });

  const typeColor = { 'multiple-choice': tokens.accent, 'open-ended': '#6366F1', 'true-false': tokens.warning, 'fill-in-blank': '#EC4899', 'matching': tokens.primary, 'ordering': '#8B5CF6' };
  const diffColor = { easy: tokens.accent, medium: tokens.warning, hard: '#EF4444' };

  return (
    <Box>
      <SectionTitle action={<Button size="small" startIcon={<Refresh fontSize="small"/>} onClick={load} sx={{ color: tokens.accent, textTransform: 'none', fontWeight: 700 }}>Refresh</Button>}>
        Question Bank
      </SectionTitle>

      {/* Summary bar */}
      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        {[
          { label: 'Total Questions', value: questions.length, color: tokens.accent, bg: 'rgba(12,189,115,0.08)' },
          { label: 'Multiple Choice', value: questions.filter(q => q.type === 'multiple-choice').length, color: '#6366F1', bg: 'rgba(99,102,241,0.08)' },
          { label: 'Open Ended', value: questions.filter(q => q.type === 'open-ended').length, color: tokens.warning, bg: 'rgba(245,158,11,0.08)' },
          { label: 'Exams Covered', value: [...new Set(questions.map(q => q.exam?._id))].filter(Boolean).length, color: tokens.primary, bg: 'rgba(13,64,108,0.08)' },
        ].map((s, i) => (
          <Grid item xs={6} sm={3} key={i}>
            <Paper elevation={0} sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 3, bgcolor: 'white', border: `1px solid ${tokens.surfaceBorder}` }}>
              <Typography fontWeight={800} sx={{ fontSize: { xs: '1.3rem', sm: '1.7rem' }, color: s.color, fontFamily: "DM Sans,sans-serif" }}>{loading ? '…' : s.value}</Typography>
              <Typography sx={{ fontSize: 11.5, color: tokens.textMuted, fontFamily: "DM Sans,sans-serif" }} noWrap>{s.label}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* Filters */}
      <Paper elevation={0} sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 3, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white', mb: 2 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
          <TextField size="small" placeholder="Search questions or exams…" value={search} onChange={e => setSearch(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" sx={{ color: tokens.textMuted }} /></InputAdornment>, sx: { borderRadius: 2 } }}
            sx={{ flexGrow: 1, minWidth: 180 }} />
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Type</InputLabel>
            <Select value={typeFilter} label="Type" onChange={e => setTypeFilter(e.target.value)} sx={{ borderRadius: 2 }}>
              <MenuItem value="all">All Types</MenuItem>
              {['multiple-choice','short-answer','open-ended','true-false','fill-in-blank','matching','ordering'].map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel>Difficulty</InputLabel>
            <Select value={diffFilter} label="Difficulty" onChange={e => setDiffFilter(e.target.value)} sx={{ borderRadius: 2 }}>
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="easy">Easy</MenuItem>
              <MenuItem value="medium">Medium</MenuItem>
              <MenuItem value="hard">Hard</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Paper>

      {/* Table */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}><CircularProgress sx={{ color: tokens.accent }} /></Box>
      ) : (
        <Paper elevation={0} sx={{ borderRadius: 3, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white', overflow: 'hidden' }}>
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table sx={{ minWidth: 600 }}>
              <TableHead>
                <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                  {['Question', 'Type', 'Difficulty', 'Points', 'Exam', 'Actions'].map(h => (
                    <TableCell key={h} sx={{ fontWeight: 700, color: tokens.textSecondary, fontSize: 12, whiteSpace: 'nowrap' }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={6} align="center" sx={{ py: 6, color: tokens.textMuted }}>No questions found.</TableCell></TableRow>
                ) : filtered.map(q => (
                  <TableRow key={q._id} sx={{ '&:hover': { bgcolor: '#F8FAFC' } }}>
                    <TableCell sx={{ maxWidth: 280 }}>
                      <Typography variant="body2" sx={{ fontFamily: "DM Sans,sans-serif", display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{q.text}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={q.type} size="small" sx={{ bgcolor: `${typeColor[q.type] || tokens.primary}18`, color: typeColor[q.type] || tokens.primary, fontWeight: 600, fontSize: 11, textTransform: 'capitalize' }} />
                    </TableCell>
                    <TableCell>
                      <Chip label={q.difficulty || 'medium'} size="small" sx={{ bgcolor: `${diffColor[q.difficulty || 'medium']}18`, color: diffColor[q.difficulty || 'medium'], fontWeight: 600, fontSize: 11 }} />
                    </TableCell>
                    <TableCell><Typography variant="body2" fontWeight={700} sx={{ color: tokens.primary }}>{q.points}</Typography></TableCell>
                    <TableCell><Typography variant="caption" sx={{ color: tokens.textMuted }} noWrap>{q.exam?.title || '—'}</Typography></TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Tooltip title="Edit"><IconButton size="small" onClick={() => setEditQ({ ...q })} sx={{ color: tokens.primary, '&:hover': { bgcolor: 'rgba(13,64,108,0.07)' } }}><Edit fontSize="small" /></IconButton></Tooltip>
                        <Tooltip title="Delete"><IconButton size="small" onClick={() => handleDelete(q._id)} sx={{ color: '#EF4444', '&:hover': { bgcolor: 'rgba(239,68,68,0.07)' } }}><Delete fontSize="small" /></IconButton></Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Box sx={{ p: 1.5, borderTop: `1px solid ${tokens.surfaceBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="caption" sx={{ color: tokens.textMuted }}>{filtered.length} of {questions.length} questions</Typography>
          </Box>
        </Paper>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editQ} onClose={() => setEditQ(null)} maxWidth="sm" fullWidth fullScreen={isXs} PaperProps={{ sx: { borderRadius: isXs ? 0 : 3 } }}>
        <DialogTitle sx={{ fontWeight: 700, fontFamily: "DM Sans,sans-serif", display: 'flex', alignItems: 'center', gap: 1 }}>
          <Edit sx={{ color: tokens.primary }} /> Edit Question
        </DialogTitle>
        <DialogContent sx={{ pt: '12px !important' }}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField fullWidth multiline minRows={3} label="Question Text" value={editQ?.text || ''} onChange={e => setEditQ(p => ({ ...p, text: e.target.value }))} size="small" sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth label="Points" type="number" value={editQ?.points || 1} onChange={e => setEditQ(p => ({ ...p, points: Number(e.target.value) }))} size="small" sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Difficulty</InputLabel>
                <Select value={editQ?.difficulty || 'medium'} label="Difficulty" onChange={e => setEditQ(p => ({ ...p, difficulty: e.target.value }))} sx={{ borderRadius: 2 }}>
                  <MenuItem value="easy">Easy</MenuItem><MenuItem value="medium">Medium</MenuItem><MenuItem value="hard">Hard</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            {editQ?.type === 'open-ended' && (
              <Grid item xs={12}>
                <TextField fullWidth multiline minRows={2} label="Model Answer" value={editQ?.correctAnswer || ''} onChange={e => setEditQ(p => ({ ...p, correctAnswer: e.target.value }))} size="small" sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setEditQ(null)} sx={{ borderRadius: 2, textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveEdit} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, background: gradients.brand }}>Save</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack('')} message={snack} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </Box>
  );
}

/* ── REPORTS ── */
function ReportsSection() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);
  const [snack, setSnack] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api.get('/admin/reports/summary').then(r => setData(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const exportCSV = (rows, filename) => {
    if (!rows.length) return;
    const keys = Object.keys(rows[0]);
    const csv = [keys.join(','), ...rows.map(r => keys.map(k => JSON.stringify(r[k] ?? '')).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    setSnack(`${filename} downloaded.`);
  };

  const scoreColor = (v) => v === null ? tokens.textMuted : v >= 70 ? tokens.accentDark : v >= 50 ? tokens.warning : '#EF4444';

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress sx={{ color: tokens.accent }} /></Box>;

  const { summary, examStats = [], studentStats = [] } = data || {};

  return (
    <Box>
      <SectionTitle action={
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button size="small" startIcon={<Refresh fontSize="small" />} onClick={load} sx={{ color: tokens.accent, textTransform: 'none', fontWeight: 700 }}>Refresh</Button>
          <Button size="small" startIcon={<SaveAlt fontSize="small" />} onClick={() => exportCSV(
            examStats.map(e => ({ Title: e.title, Status: e.status, Submissions: e.submissions, 'Avg Score': e.avgScore ?? 'N/A', 'Pass Rate': e.passRate !== null ? `${e.passRate}%` : 'N/A' })),
            'exam-report.csv'
          )} sx={{ color: tokens.primary, textTransform: 'none', fontWeight: 700 }}>Export CSV</Button>
        </Box>
      }>Reports</SectionTitle>

      {/* Summary cards */}
      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        {[
          { label: 'Total Exams', value: summary?.totalExams ?? 0, color: tokens.accent, bg: 'rgba(12,189,115,0.08)', icon: <Assignment sx={{ color: tokens.accent, fontSize: 22 }} /> },
          { label: 'Total Students', value: summary?.totalStudents ?? 0, color: '#6366F1', bg: 'rgba(99,102,241,0.08)', icon: <People sx={{ color: '#6366F1', fontSize: 22 }} /> },
          { label: 'Submissions', value: summary?.totalSubmissions ?? 0, color: tokens.primary, bg: 'rgba(13,64,108,0.08)', icon: <ListAlt sx={{ color: tokens.primary, fontSize: 22 }} /> },
          { label: 'Avg Score', value: `${summary?.overallAvgScore ?? 0}%`, color: tokens.warning, bg: 'rgba(245,158,11,0.08)', icon: <BarChart sx={{ color: tokens.warning, fontSize: 22 }} /> },
          { label: 'Pass Rate', value: `${summary?.overallPassRate ?? 0}%`, color: '#EC4899', bg: 'rgba(236,72,153,0.08)', icon: <CheckCircle sx={{ color: '#EC4899', fontSize: 22 }} /> },
        ].map((s, i) => (
          <Grid item xs={6} sm={4} md={2.4} key={i}>
            <Paper elevation={0} sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 3, bgcolor: 'white', border: `1px solid ${tokens.surfaceBorder}`, display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{s.icon}</Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography fontWeight={800} sx={{ fontSize: { xs: '1.1rem', sm: '1.35rem' }, color: s.color, fontFamily: "DM Sans,sans-serif", lineHeight: 1 }}>{s.value}</Typography>
                <Typography sx={{ fontSize: 11, color: tokens.textMuted, fontFamily: "DM Sans,sans-serif" }} noWrap>{s.label}</Typography>
              </Box>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* Tabs */}
      <Paper elevation={0} sx={{ borderRadius: 3, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white', overflow: 'hidden' }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: `1px solid ${tokens.surfaceBorder}`, px: 2, '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, fontFamily: "DM Sans,sans-serif", fontSize: 13 }, '& .MuiTabs-indicator': { bgcolor: tokens.accent } }}>
          <Tab label={`By Exam (${examStats.length})`} />
          <Tab label={`By Student (${studentStats.length})`} />
        </Tabs>

        {tab === 0 && (
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table sx={{ minWidth: 560 }}>
              <TableHead>
                <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                  {['Exam Title', 'Status', 'Submissions', 'Avg Score', 'Pass Rate'].map(h => (
                    <TableCell key={h} sx={{ fontWeight: 700, color: tokens.textSecondary, fontSize: 12, whiteSpace: 'nowrap' }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {examStats.length === 0 ? (
                  <TableRow><TableCell colSpan={5} align="center" sx={{ py: 5, color: tokens.textMuted }}>No data yet.</TableCell></TableRow>
                ) : examStats.map(e => {
                  const sc = e.status === 'active' ? tokens.accent : e.status === 'completed' ? '#6366F1' : tokens.warning;
                  return (
                    <TableRow key={e._id} sx={{ '&:hover': { bgcolor: '#F8FAFC' } }}>
                      <TableCell><Typography variant="body2" fontWeight={600} sx={{ fontFamily: "DM Sans,sans-serif" }}>{e.title}</Typography></TableCell>
                      <TableCell><Chip label={e.status} size="small" sx={{ bgcolor: `${sc}18`, color: sc, fontWeight: 600, textTransform: 'capitalize' }} /></TableCell>
                      <TableCell><Typography variant="body2" fontWeight={700} sx={{ color: tokens.primary }}>{e.submissions}</Typography></TableCell>
                      <TableCell>
                        {e.avgScore !== null
                          ? <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <LinearProgress variant="determinate" value={e.avgScore} sx={{ width: 55, height: 6, borderRadius: 3, bgcolor: '#EEF2FF', '& .MuiLinearProgress-bar': { bgcolor: scoreColor(e.avgScore), borderRadius: 3 } }} />
                              <Typography sx={{ fontSize: 12, fontWeight: 700, color: scoreColor(e.avgScore) }}>{e.avgScore}%</Typography>
                            </Box>
                          : <Typography variant="caption" sx={{ color: tokens.textMuted }}>—</Typography>}
                      </TableCell>
                      <TableCell>
                        {e.passRate !== null
                          ? <Chip label={`${e.passRate}%`} size="small" sx={{ bgcolor: e.passRate >= 70 ? 'rgba(12,189,115,0.1)' : 'rgba(239,68,68,0.08)', color: e.passRate >= 70 ? tokens.accentDark : '#EF4444', fontWeight: 700 }} />
                          : <Typography variant="caption" sx={{ color: tokens.textMuted }}>—</Typography>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {tab === 1 && (
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table sx={{ minWidth: 480 }}>
              <TableHead>
                <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                  {['Student', 'Class', 'Exams Done', 'Avg Score'].map(h => (
                    <TableCell key={h} sx={{ fontWeight: 700, color: tokens.textSecondary, fontSize: 12, whiteSpace: 'nowrap' }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {studentStats.length === 0 ? (
                  <TableRow><TableCell colSpan={4} align="center" sx={{ py: 5, color: tokens.textMuted }}>No data yet.</TableCell></TableRow>
                ) : studentStats.map(s => (
                  <TableRow key={s._id} sx={{ '&:hover': { bgcolor: '#F8FAFC' } }}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar sx={{ width: 30, height: 30, fontSize: 12, fontWeight: 700, bgcolor: 'rgba(12,189,115,0.1)', color: tokens.accentDark }}>{s.firstName?.charAt(0)}</Avatar>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={600} sx={{ fontFamily: "DM Sans,sans-serif" }} noWrap>{s.firstName} {s.lastName}</Typography>
                          <Typography variant="caption" sx={{ color: tokens.textMuted }} noWrap>{s.email}</Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell><Chip label={s.class || 'N/A'} size="small" sx={{ bgcolor: 'rgba(13,64,108,0.07)', color: tokens.primary }} /></TableCell>
                    <TableCell><Typography variant="body2" fontWeight={700} sx={{ color: tokens.primary }}>{s.examsCompleted}</Typography></TableCell>
                    <TableCell>
                      {s.avgScore !== null
                        ? <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <LinearProgress variant="determinate" value={s.avgScore} sx={{ width: 55, height: 6, borderRadius: 3, bgcolor: '#EEF2FF', '& .MuiLinearProgress-bar': { bgcolor: scoreColor(s.avgScore), borderRadius: 3 } }} />
                            <Typography sx={{ fontSize: 12, fontWeight: 700, color: scoreColor(s.avgScore) }}>{s.avgScore}%</Typography>
                          </Box>
                        : <Typography variant="caption" sx={{ color: tokens.textMuted }}>—</Typography>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        <Box sx={{ p: 1.5, borderTop: `1px solid ${tokens.surfaceBorder}`, display: 'flex', justifyContent: 'flex-end' }}>
          <Button size="small" startIcon={<Download fontSize="small" />} onClick={() => exportCSV(
            tab === 0
              ? examStats.map(e => ({ Title: e.title, Status: e.status, Submissions: e.submissions, AvgScore: e.avgScore ?? '', PassRate: e.passRate !== null ? `${e.passRate}%` : '' }))
              : studentStats.map(s => ({ Name: `${s.firstName} ${s.lastName}`, Email: s.email, Class: s.class || '', ExamsDone: s.examsCompleted, AvgScore: s.avgScore ?? '' })),
            tab === 0 ? 'exam-report.csv' : 'student-report.csv'
          )} sx={{ color: tokens.primary, textTransform: 'none', fontWeight: 700, fontSize: 12 }}>
            Export CSV
          </Button>
        </Box>
      </Paper>

      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack('')} message={snack} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </Box>
  );
}

/* ── TEMPLATES ── */
function TemplatesSection({ exams, setExams, setActiveSection }) {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [questionBank, setQuestionBank] = useState([]);
  const [filteredQuestionBank, setFilteredQuestionBank] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingQB, setLoadingQB] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveDialog, setSaveDialog] = useState(false);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [snack, setSnack] = useState('');
  const [tab, setTab] = useState('question-bank'); // 'templates' or 'question-bank'
  const [searchTerm, setSearchTerm] = useState('');
  const [audienceFilter, setAudienceFilter] = useState('all');
  const [previewDialog, setPreviewDialog] = useState(false);
  const [previewExam, setPreviewExam] = useState(null);
  const [reusingExamId, setReusingExamId] = useState(null);
  const isXs = useMediaQuery('(max-width:600px)');

  const load = useCallback(() => {
    setLoading(true);
    api.get('/admin/templates').then(r => setTemplates(r.data || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const loadQuestionBank = useCallback(() => {
    setLoadingQB(true);
    api.get('/question-bank').then(r => {
      setQuestionBank(r.data || []);
      setFilteredQuestionBank(r.data || []);
    }).catch(() => {}).finally(() => setLoadingQB(false));
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadQuestionBank(); }, [loadQuestionBank]);

  // Get unique target audiences from question bank
  const uniqueAudiences = [...new Set(questionBank.map(exam => exam.targetAudience).filter(Boolean))];

  // Filter question bank based on search and audience
  useEffect(() => {
    let filtered = questionBank;

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(exam =>
        exam.title?.toLowerCase().includes(term) ||
        exam.description?.toLowerCase().includes(term) ||
        exam.publicDescription?.toLowerCase().includes(term)
      );
    }

    // Filter by audience
    if (audienceFilter !== 'all') {
      filtered = filtered.filter(exam =>
        exam.targetAudience === audienceFilter
      );
    }

    setFilteredQuestionBank(filtered);
  }, [searchTerm, audienceFilter, questionBank]);

  const handleSaveAsTemplate = async () => {
    if (!selectedExamId) return;
    setSaving(true);
    try {
      const r = await api.post('/admin/templates', { examId: selectedExamId });
      setTemplates(p => [r.data, ...p]);
      setSaveDialog(false); setSelectedExamId('');
      setSnack('Exam saved as template!');
    } catch (e) { setSnack(e.response?.data?.message || 'Error saving template.'); }
    finally { setSaving(false); }
  };

  const handleUse = async (id) => {
    try {
      const r = await api.post(`/admin/templates/${id}/use`);
      setExams(p => [r.data, ...p]);
      setSnack('New exam created from template! Opening editor...');
      navigate(`/admin/exams/${r.data._id}/edit`);
    } catch { setSnack('Error creating exam from template.'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this template?')) return;
    try { await api.delete(`/admin/templates/${id}`); setTemplates(p => p.filter(t => t._id !== id)); setSnack('Template deleted.'); }
    catch { setSnack('Error deleting template.'); }
  };

  const handleReuseQuestionBank = async (examId) => {
    setReusingExamId(examId);
    try {
      console.log('Reusing exam from question bank:', examId);
      const r = await api.post(`/question-bank/${examId}/reuse`, {}, { timeout: 120000 });
      console.log('Reuse response:', r.data);
      if (r.data && r.data._id) {
        setExams(p => [r.data, ...p]);
        setSnack('✓ Exam copied from question bank successfully!');
        setActiveSection('exams');
      } else {
        setSnack('✗ Unexpected response from server.');
      }
    } catch (error) {
      console.error('Error reusing exam:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Error copying exam from question bank.';
      setSnack(`✗ ${errorMessage}`);
    } finally {
      setReusingExamId(null);
    }
  };

  const handlePreview = (exam) => {
    setPreviewExam(exam);
    setPreviewDialog(true);
  };

  const handleClosePreview = () => {
    setPreviewDialog(false);
    setPreviewExam(null);
  };

  const totalQs = (t) => t.sections?.reduce((s, sec) => s + (sec.questions?.length || 0), 0) || 0;

  return (
    <Box>
      <SectionTitle action={
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button size="small" startIcon={<Refresh fontSize="small" />} onClick={() => { load(); loadQuestionBank(); }} sx={{ color: tokens.accent, textTransform: 'none', fontWeight: 700 }}>Refresh</Button>
          {tab === 'templates' && (
            <Button size="small" variant="contained" startIcon={<Add fontSize="small" />} onClick={() => setSaveDialog(true)}
              sx={{ background: gradients.brand, borderRadius: 2.5, textTransform: 'none', fontWeight: 700 }}>
              Save Exam as Template
            </Button>
          )}
        </Box>
      }>Templates</SectionTitle>

      {/* Tabs */}
      <Box sx={{ mb: 2.5, display: 'flex', gap: 1, borderBottom: `1px solid ${tokens.surfaceBorder}`, pb: 2 }}>
        <Button
          size="small"
          onClick={() => setTab('question-bank')}
          sx={{
            color: tab === 'question-bank' ? tokens.primary : tokens.textMuted,
            fontWeight: 700,
            textTransform: 'none',
            borderBottom: tab === 'question-bank' ? `2px solid ${tokens.primary}` : 'none',
            borderRadius: 0,
            pb: 2,
            fontSize: 13
          }}
        >
          Question Bank
        </Button>
        <Button
          size="small"
          onClick={() => setTab('templates')}
          sx={{
            color: tab === 'templates' ? tokens.primary : tokens.textMuted,
            fontWeight: 700,
            textTransform: 'none',
            borderBottom: tab === 'templates' ? `2px solid ${tokens.primary}` : 'none',
            borderRadius: 0,
            pb: 2,
            fontSize: 13
          }}
        >
          My Templates
        </Button>
      </Box>

      {/* Info banner */}
      <Paper elevation={0} sx={{ p: 2, mb: 2.5, borderRadius: 3, bgcolor: 'rgba(13,64,108,0.04)', border: `1px solid rgba(13,64,108,0.1)`, display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
        <Description sx={{ color: tokens.primary, mt: 0.25, flexShrink: 0 }} />
        <Box>
          <Typography fontWeight={700} sx={{ fontSize: 13.5, color: tokens.textPrimary, fontFamily: "DM Sans,sans-serif" }}>
            {tab === 'templates' ? 'What are templates?' : 'What is the Question Bank?'}
          </Typography>
          <Typography sx={{ fontSize: 12.5, color: tokens.textMuted, fontFamily: "DM Sans,sans-serif", mt: 0.25 }}>
            {tab === 'templates'
              ? 'Save any of your exams as a reusable template. Use a template to instantly create a new draft exam with the same structure, questions, and settings — then customise it as needed.'
              : 'Browse and reuse publicly available exams from the question bank. When you reuse an exam, a copy is created for you to edit and customise as your own. The original exam remains unchanged.'}
          </Typography>
        </Box>
      </Paper>

      {tab === 'templates' ? (
        <>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress sx={{ color: tokens.accent }} /></Box>
          ) : templates.length === 0 ? (
            <Paper elevation={0} sx={{ p: 5, borderRadius: 3, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white', textAlign: 'center' }}>
              <Box sx={{ width: 64, height: 64, borderRadius: 3, bgcolor: 'rgba(13,64,108,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2 }}>
                <Description sx={{ fontSize: 32, color: tokens.primary }} />
              </Box>
              <Typography variant="h6" fontWeight={700} sx={{ fontFamily: "DM Sans,sans-serif", color: tokens.textPrimary }}>No templates yet</Typography>
              <Typography sx={{ color: tokens.textMuted, fontFamily: "DM Sans,sans-serif", mb: 2.5, mt: 0.5 }}>Save one of your exams as a template to get started.</Typography>
              <Button variant="contained" startIcon={<Add />} onClick={() => setSaveDialog(true)} sx={{ background: gradients.brand, borderRadius: 2.5, textTransform: 'none', fontWeight: 700 }}>
                Save Exam as Template
              </Button>
            </Paper>
          ) : (
            <Grid container spacing={2.5}>
              {templates.map(t => (
                <Grid item xs={12} sm={6} md={4} key={t._id}>
                  <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white', height: '100%', display: 'flex', flexDirection: 'column', transition: 'box-shadow 0.2s', '&:hover': { boxShadow: '0 6px 24px rgba(13,64,108,0.09)' } }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1.5 }}>
                      <Box sx={{ width: 42, height: 42, borderRadius: 2.5, bgcolor: 'rgba(13,64,108,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Description sx={{ color: tokens.primary, fontSize: 22 }} />
                      </Box>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Tooltip title="Use template (creates new exam)">
                          <IconButton size="small" onClick={() => handleUse(t._id)} sx={{ color: tokens.accent, '&:hover': { bgcolor: 'rgba(12,189,115,0.1)' } }}><ContentCopy fontSize="small" /></IconButton>
                        </Tooltip>
                        <Tooltip title="Delete template">
                          <IconButton size="small" onClick={() => handleDelete(t._id)} sx={{ color: '#EF4444', '&:hover': { bgcolor: 'rgba(239,68,68,0.07)' } }}><Delete fontSize="small" /></IconButton>
                        </Tooltip>
                      </Box>
                    </Box>

                    <Typography fontWeight={700} sx={{ fontSize: 14.5, color: tokens.textPrimary, fontFamily: "DM Sans,sans-serif", mb: 0.5, flexGrow: 1 }}>
                      {t.title.replace('[Template] ', '')}
                    </Typography>
                    <Typography variant="caption" sx={{ color: tokens.textMuted, mb: 1.5, display: 'block', fontFamily: "DM Sans,sans-serif" }} noWrap>
                      {t.description}
                    </Typography>

                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 2 }}>
                      <Chip label={`${t.timeLimit} min`} size="small" sx={{ bgcolor: 'rgba(13,64,108,0.07)', color: tokens.primary, fontWeight: 600, fontSize: 11 }} />
                      <Chip label={`${totalQs(t)} questions`} size="small" sx={{ bgcolor: 'rgba(12,189,115,0.08)', color: tokens.accentDark, fontWeight: 600, fontSize: 11 }} />
                      <Chip label={`Pass: ${t.passingScore}%`} size="small" sx={{ bgcolor: 'rgba(245,158,11,0.08)', color: tokens.warning, fontWeight: 600, fontSize: 11 }} />
                    </Box>

                    <Divider sx={{ mb: 1.5 }} />

                    {t.sections?.map((sec, si) => (
                      <Box key={si} sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography sx={{ fontSize: 12, color: tokens.textMuted, fontFamily: "DM Sans,sans-serif" }}>Section {sec.name}</Typography>
                        <Typography sx={{ fontSize: 12, fontWeight: 600, color: tokens.textSecondary, fontFamily: "DM Sans,sans-serif" }}>{sec.questions?.length || 0} questions</Typography>
                      </Box>
                    ))}

                    <Button fullWidth size="small" startIcon={<PlayArrow fontSize="small" />} onClick={() => handleUse(t._id)}
                      sx={{ mt: 1.5, color: tokens.accent, fontWeight: 700, fontSize: 12.5, textTransform: 'none', bgcolor: 'rgba(12,189,115,0.06)', borderRadius: 2, py: 0.75, '&:hover': { bgcolor: 'rgba(12,189,115,0.12)' } }}>
                      Use This Template
                    </Button>

                    <Typography variant="caption" sx={{ color: tokens.textMuted, mt: 1, textAlign: 'center', display: 'block', fontSize: 11 }}>
                      Created {new Date(t.createdAt).toLocaleDateString()}
                    </Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          )}
        </>
      ) : (
        <>
          {/* Search and Filter Bar for Question Bank */}
          <Paper elevation={0} sx={{ p: 2, mb: 2.5, borderRadius: 3, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white', display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <TextField
              size="small"
              placeholder="Search exams..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: <Search sx={{ mr: 1, color: tokens.textMuted }} />,
                sx: { borderRadius: 2 }
              }}
              sx={{ flexGrow: 1, minWidth: 200 }}
            />
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Level</InputLabel>
              <Select
                value={audienceFilter}
                label="Level"
                onChange={(e) => setAudienceFilter(e.target.value)}
                sx={{ borderRadius: 2 }}
              >
                <MenuItem value="all">All Levels</MenuItem>
                {uniqueAudiences.map(audience => (
                  <MenuItem key={audience} value={audience}>{audience}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Paper>

          {loadingQB ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress sx={{ color: tokens.accent }} /></Box>
          ) : filteredQuestionBank.length === 0 ? (
            <Paper elevation={0} sx={{ p: 5, borderRadius: 3, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white', textAlign: 'center' }}>
              <Box sx={{ width: 64, height: 64, borderRadius: 3, bgcolor: 'rgba(13,64,108,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2 }}>
                <Quiz sx={{ fontSize: 32, color: tokens.primary }} />
              </Box>
              <Typography variant="h6" fontWeight={700} sx={{ fontFamily: "DM Sans,sans-serif", color: tokens.textPrimary }}>
                {searchTerm || audienceFilter !== 'all' ? 'No matching exams found' : 'No exams in question bank'}
              </Typography>
              <Typography sx={{ color: tokens.textMuted, fontFamily: "DM Sans,sans-serif", mb: 2.5, mt: 0.5 }}>
                {searchTerm || audienceFilter !== 'all' ? 'Try adjusting your search or filter criteria.' : 'There are no publicly available exams to reuse at the moment.'}
              </Typography>
            </Paper>
          ) : (
            <Grid container spacing={2.5}>
              {filteredQuestionBank.map(exam => (
                <Grid item xs={12} sm={6} md={4} key={exam._id}>
                  <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white', height: '100%', display: 'flex', flexDirection: 'column', transition: 'box-shadow 0.2s', '&:hover': { boxShadow: '0 6px 24px rgba(13,64,108,0.09)' } }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1.5 }}>
                      <Box sx={{ width: 42, height: 42, borderRadius: 2.5, bgcolor: 'rgba(13,64,108,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Quiz sx={{ color: tokens.primary, fontSize: 22 }} />
                      </Box>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Tooltip title="Preview questions">
                          <IconButton size="small" onClick={() => handlePreview(exam)} sx={{ color: tokens.primary, '&:hover': { bgcolor: 'rgba(13,64,108,0.1)' } }}><Visibility fontSize="small" /></IconButton>
                        </Tooltip>
                        <Tooltip title="Reuse exam (creates copy for you)">
                          <IconButton size="small" onClick={() => handleReuseQuestionBank(exam._id)} disabled={reusingExamId === exam._id} sx={{ color: tokens.accent, '&:hover': { bgcolor: 'rgba(12,189,115,0.1)' } }}>
                            {reusingExamId === exam._id ? <CircularProgress size={16} sx={{ color: tokens.accent }} /> : <ContentCopy fontSize="small" />}
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>

                    <Typography fontWeight={700} sx={{ fontSize: 14.5, color: tokens.textPrimary, fontFamily: '"DM Sans",sans-serif', mb: 0.5, flexGrow: 1 }}>
                      {exam.title}
                    </Typography>
                    <Typography variant="caption" sx={{ color: tokens.textMuted, mb: 1.5, display: 'block', fontFamily: '"DM Sans",sans-serif' }} noWrap>
                      {exam.publicDescription || exam.description}
                    </Typography>

                    {exam.createdBy && (
                      <Typography variant="caption" sx={{ color: tokens.textMuted, mb: 1, display: 'block', fontFamily: '"DM Sans",sans-serif' }}>
                        By {exam.createdBy.fullName || 'Unknown'}
                      </Typography>
                    )}

                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 2 }}>
                      <Chip label={`${exam.timeLimit} min`} size="small" sx={{ bgcolor: 'rgba(13,64,108,0.07)', color: tokens.primary, fontWeight: 600, fontSize: 11 }} />
                      <Chip label={`${totalQs(exam)} questions`} size="small" sx={{ bgcolor: 'rgba(12,189,115,0.08)', color: tokens.accentDark, fontWeight: 600, fontSize: 11 }} />
                      <Chip label={`Pass: ${exam.passingScore}%`} size="small" sx={{ bgcolor: 'rgba(245,158,11,0.08)', color: tokens.warning, fontWeight: 600, fontSize: 11 }} />
                    </Box>

                    <Divider sx={{ mb: 1.5 }} />

                    {exam.sections?.map((sec, si) => (
                      <Box key={si} sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography sx={{ fontSize: 12, color: tokens.textMuted, fontFamily: "DM Sans,sans-serif" }}>Section {sec.name}</Typography>
                        <Typography sx={{ fontSize: 12, fontWeight: 600, color: tokens.textSecondary, fontFamily: "DM Sans,sans-serif" }}>{sec.questions?.length || 0} questions</Typography>
                      </Box>
                    ))}

                    <Button fullWidth size="small" startIcon={reusingExamId === exam._id ? <CircularProgress size={14} sx={{ color: tokens.accent }} /> : <PlayArrow fontSize="small" />} onClick={() => handleReuseQuestionBank(exam._id)} disabled={reusingExamId === exam._id}
                      sx={{ mt: 1.5, color: tokens.accent, fontWeight: 700, fontSize: 12.5, textTransform: 'none', bgcolor: 'rgba(12,189,115,0.06)', borderRadius: 2, py: 0.75, '&:hover': { bgcolor: 'rgba(12,189,115,0.12)' } }}>
                      {reusingExamId === exam._id ? 'Copying...' : 'Reuse This Exam'}
                    </Button>

                    <Typography variant="caption" sx={{ color: tokens.textMuted, mt: 1, textAlign: 'center', display: 'block', fontSize: 11 }}>
                      Created {new Date(exam.createdAt).toLocaleDateString()}
                    </Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          )}
        </>
      )}

      {/* Save as template dialog */}
      <Dialog open={saveDialog} onClose={() => setSaveDialog(false)} maxWidth="xs" fullWidth fullScreen={isXs} PaperProps={{ sx: { borderRadius: isXs ? 0 : 3 } }}>
        <DialogTitle sx={{ fontWeight: 700, fontFamily: "DM Sans,sans-serif", display: 'flex', alignItems: 'center', gap: 1 }}>
          <Description sx={{ color: tokens.primary }} /> Save Exam as Template
        </DialogTitle>
        <DialogContent sx={{ pt: '12px !important' }}>
          <Typography sx={{ color: tokens.textMuted, mb: 2, fontSize: 13.5, fontFamily: "DM Sans,sans-serif" }}>
            Select an exam to save as a reusable template. The original exam will not be changed.
          </Typography>
          <FormControl fullWidth size="small">
            <InputLabel>Select Exam</InputLabel>
            <Select value={selectedExamId} label="Select Exam" onChange={e => setSelectedExamId(e.target.value)} sx={{ borderRadius: 2 }}>
              {exams.filter(e => e.status !== 'template').map(e => (
                <MenuItem key={e._id} value={e._id}>{e.title} <Typography component="span" variant="caption" sx={{ ml: 1, color: tokens.textMuted }}>({e.status})</Typography></MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setSaveDialog(false)} sx={{ borderRadius: 2, textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained" disabled={!selectedExamId || saving} onClick={handleSaveAsTemplate}
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, background: gradients.brand }}>
            {saving ? <CircularProgress size={18} color="inherit" /> : 'Save Template'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Preview Dialog for Question Bank Exams */}
      <Dialog open={previewDialog} onClose={handleClosePreview} maxWidth="md" fullWidth fullScreen={isXs} PaperProps={{ sx: { borderRadius: isXs ? 0 : 3 } }}>
        <DialogTitle sx={{ fontWeight: 700, fontFamily: '"DM Sans",sans-serif', display: 'flex', alignItems: 'center', gap: 1 }}>
          <Visibility sx={{ color: tokens.primary }} /> Exam Preview
        </DialogTitle>
        <DialogContent sx={{ pt: '12px !important' }}>
          {previewExam && (
            <Box>
              <Typography variant="h6" fontWeight={700} sx={{ fontFamily: '"DM Sans",sans-serif', mb: 1 }}>
                {previewExam.title}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {previewExam.publicDescription || previewExam.description}
              </Typography>

              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <Chip label={`${previewExam.timeLimit} min`} size="small" sx={{ bgcolor: 'rgba(13,64,108,0.07)', color: tokens.primary, fontWeight: 600 }} />
                <Chip label={`${totalQs(previewExam)} questions`} size="small" sx={{ bgcolor: 'rgba(12,189,115,0.08)', color: tokens.accentDark, fontWeight: 600 }} />
              </Box>

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2 }}>
                All Questions ({totalQs(previewExam)}):
              </Typography>

              {previewExam.sections && previewExam.sections.length > 0 ? (
                <Box>
                  {previewExam.sections.map((section, si) => (
                    <Box key={si} sx={{ mb: 2 }}>
                      <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
                        Section {section.name}: {section.description || ''}
                      </Typography>
                      {section.questions && section.questions.length > 0 ? (
                        <Box>
                          {section.questions.map((question, qi) => (
                            <Paper key={qi} elevation={0} sx={{ p: 1.5, mb: 1, border: `1px solid ${tokens.surfaceBorder}`, borderRadius: 2 }}>
                              <Typography variant="caption" fontWeight={600} sx={{ color: tokens.primary }}>
                                Q{qi + 1}:
                              </Typography>
                              <Typography variant="body2" sx={{ ml: 1 }}>
                                {question.text || 'No question text available'}
                              </Typography>
                              {question.type && (
                                <Chip label={question.type} size="small" sx={{ mt: 1, fontSize: 10 }} />
                              )}
                            </Paper>
                          ))}
                        </Box>
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          No questions in this section
                        </Typography>
                      )}
                    </Box>
                  ))}
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No sections available in this exam
                </Typography>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={handleClosePreview} sx={{ borderRadius: 2, textTransform: 'none' }}>Close</Button>
          {previewExam && (
            <Button
              variant="contained"
              onClick={() => {
                handleClosePreview();
                handleReuseQuestionBank(previewExam._id);
              }}
              disabled={reusingExamId === previewExam._id}
              startIcon={reusingExamId === previewExam._id ? <CircularProgress size={16} sx={{ color: 'white' }} /> : null}
              sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, background: gradients.brand }}
            >
              {reusingExamId === previewExam._id ? 'Copying...' : 'Reuse This Exam'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack('')} message={snack} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </Box>
  );
}
