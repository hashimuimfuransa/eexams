import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  Button,
  Typography,
  Box,
  Avatar,
  CircularProgress,
  Alert,
  useTheme,
  useMediaQuery,
  Stepper,
  Step,
  StepLabel,
  Fade,
  TextField,
  InputAdornment,
  IconButton
} from '@mui/material';
import {
  School,
  CheckCircle,
  ArrowForward,
  ArrowBack,
  Search,
  Clear
} from '@mui/icons-material';
import api from '../services/api';

// Only show the search box once the list is long enough that filtering actually helps
const SEARCH_THRESHOLD = 5;

// Brand palette (matches client/src/context/ThemeContext.jsx)
const BRAND = {
  navy: '#0D406C',
  navyDark: '#052037',
  emerald: '#0CBD73',
  mint: '#9DF6D6'
};
const BRAND_GRADIENT = `linear-gradient(135deg, ${BRAND.navy} 0%, ${BRAND.emerald} 100%)`;

const LevelSelectionModal = ({ open, onClose, onSelectLevel }) => {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  const [levels, setLevels] = useState([]);
  const [selectedLevel, setSelectedLevel] = useState('');
  const [selectedSubLevel, setSelectedSubLevel] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(0); // 0 = pick level, 1 = pick sub-level
  const [levelSearch, setLevelSearch] = useState('');
  const [subLevelSearch, setSubLevelSearch] = useState('');

  const selectedLevelObj = levels.find(l => l._id === selectedLevel);
  const availableSubLevels = (selectedLevelObj?.subLevels || []).filter(s => s.isActive);
  const hasSubLevels = availableSubLevels.length > 0;

  // Searching a level name matches directly. Searching a sub-level name (e.g. "P3")
  // instead surfaces the parent level, with a hint pointing the user to it.
  const filteredLevels = (() => {
    const q = levelSearch.trim().toLowerCase();
    if (!q) return levels;
    return levels
      .map(l => {
        const matchesLevel = l.name.toLowerCase().includes(q) || (l.description || '').toLowerCase().includes(q);
        const matchedSub = !matchesLevel
          ? (l.subLevels || []).find(s => s.isActive && s.name.toLowerCase().includes(q))
          : null;
        if (!matchesLevel && !matchedSub) return null;
        return { ...l, _matchedSubLevel: matchedSub ? matchedSub.name : null };
      })
      .filter(Boolean);
  })();

  const indexedSubLevels = availableSubLevels.map((s, i) => ({ ...s, _displayIndex: i }));
  const filteredSubLevels = subLevelSearch.trim()
    ? indexedSubLevels.filter(s => s.name.toLowerCase().includes(subLevelSearch.trim().toLowerCase()))
    : indexedSubLevels;

  useEffect(() => {
    if (open) {
      fetchLevels();
      setStep(0);
      setSelectedLevel('');
      setSelectedSubLevel('');
      setError(null);
      setLevelSearch('');
      setSubLevelSearch('');
    }
  }, [open]);

  const fetchLevels = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/levels');
      setLevels(response.data || []);
    } catch (err) {
      setError('Failed to load levels. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLevelSelect = (level) => {
    setSelectedLevel(level._id);
    setSelectedSubLevel('');
    setError(null);
    // If they found this level by searching a sub-level name, carry that search
    // into step 1 so the matching sub-level is already filtered into view.
    setSubLevelSearch(level._matchedSubLevel || '');
  };

  const handleNext = () => {
    if (!selectedLevel) {
      setError('Please choose your education level to continue.');
      return;
    }
    if (hasSubLevels) {
      setStep(1);
      setError(null);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    setStep(0);
    setSelectedSubLevel('');
    setSubLevelSearch('');
    setError(null);
  };

  const handleSubmit = async () => {
    if (!selectedLevel) return;
    if (hasSubLevels && !selectedSubLevel) {
      setError('Please choose your specific sub-level to continue.');
      return;
    }
    try {
      setSubmitting(true);
      setError(null);
      const response = await api.post('/auth/select-level', {
        levelId: selectedLevel,
        subLevel: selectedSubLevel || undefined
      });
      onSelectLevel(selectedLevel, response.data?.level, response.data?.subLevel);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to select level. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const levelColors = [
    { bg: '#EAF3FB', border: '#BFDBFE', icon: BRAND.navy, text: BRAND.navy },
    { bg: '#ECFDF5', border: '#A7F3D0', icon: BRAND.emerald, text: '#0A7A4A' },
    { bg: '#FFF7ED', border: '#FED7AA', icon: '#F97316', text: '#9A3412' },
    { bg: '#FAF5FF', border: '#E9D5FF', icon: '#A855F7', text: '#6B21A8' },
  ];

  return (
    <Dialog
      open={open}
      onClose={() => {}}
      maxWidth="sm"
      fullWidth
      fullScreen={fullScreen}
      disableEscapeKeyDown
      PaperProps={{
        sx: {
          borderRadius: fullScreen ? 0 : 3,
          overflow: 'hidden',
          m: fullScreen ? 0 : 2,
        }
      }}
    >
      {/* Header */}
      <Box
        sx={{
          background: BRAND_GRADIENT,
          p: { xs: 3, sm: 4 },
          pb: { xs: 2.5, sm: 3 },
          color: '#fff',
          textAlign: 'center'
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1.5 }}>
          <Avatar
            src="/logo.png"
            alt="eexams"
            sx={{
              width: 56,
              height: 56,
              bgcolor: '#fff',
              border: '3px solid rgba(255,255,255,0.5)',
              boxShadow: '0 4px 14px rgba(0,0,0,0.2)'
            }}
          >
            <School sx={{ fontSize: 28, color: BRAND.navy }} />
          </Avatar>
        </Box>
        <Typography variant="h5" fontWeight={800} sx={{ mb: 0.5, lineHeight: 1.2 }}>
          Welcome to eexams!
        </Typography>
        <Typography variant="body2" sx={{ opacity: 0.85, fontSize: { xs: 13, sm: 14 } }}>
          Tell us your education level so we can show you the right exams for you.
        </Typography>

        {hasSubLevels && (
          <Box sx={{ mt: 2.5 }}>
            <Stepper activeStep={step} alternativeLabel sx={{ '& .MuiStepLabel-label': { color: 'rgba(255,255,255,0.7)', fontSize: 12 }, '& .MuiStepLabel-label.Mui-active': { color: '#fff', fontWeight: 700 }, '& .MuiStepConnector-line': { borderColor: 'rgba(255,255,255,0.3)' } }}>
              <Step>
                <StepLabel StepIconProps={{ sx: { color: step >= 0 ? '#fff' : 'rgba(255,255,255,0.4)', '& .MuiStepIcon-text': { fill: BRAND.navy } } }}>
                  Education Level
                </StepLabel>
              </Step>
              <Step>
                <StepLabel StepIconProps={{ sx: { color: step >= 1 ? '#fff' : 'rgba(255,255,255,0.4)', '& .MuiStepIcon-text': { fill: BRAND.navy } } }}>
                  Specific Level
                </StepLabel>
              </Step>
            </Stepper>
          </Box>
        )}
      </Box>

      <DialogContent sx={{ p: { xs: 2.5, sm: 3 }, bgcolor: '#F8FAFC' }}>
        {loading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 5, gap: 2 }}>
            <CircularProgress />
            <Typography variant="body2" color="text.secondary">Loading available levels…</Typography>
          </Box>
        ) : (
          <>
            {error && (
              <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            {/* Step 0: Pick education level */}
            {step === 0 && (
              <Fade in>
                <Box>
                  <Typography variant="body1" fontWeight={600} sx={{ mb: 0.5, color: '#1E293B' }}>
                    What is your current education level?
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#64748B', mb: 2, fontSize: 13 }}>
                    Select the level that best matches where you are in school right now.
                  </Typography>

                  {levels.length > SEARCH_THRESHOLD && (
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="Search levels…"
                      value={levelSearch}
                      onChange={(e) => setLevelSearch(e.target.value)}
                      sx={{ mb: 2, bgcolor: '#fff', borderRadius: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Search sx={{ fontSize: 18, color: '#94A3B8' }} />
                          </InputAdornment>
                        ),
                        endAdornment: levelSearch && (
                          <InputAdornment position="end">
                            <IconButton size="small" onClick={() => setLevelSearch('')}>
                              <Clear sx={{ fontSize: 16 }} />
                            </IconButton>
                          </InputAdornment>
                        )
                      }}
                    />
                  )}

                  {filteredLevels.length === 0 ? (
                    <Box sx={{ py: 4, textAlign: 'center' }}>
                      <Typography variant="body2" sx={{ color: '#94A3B8' }}>
                        No levels match "{levelSearch}".
                      </Typography>
                    </Box>
                  ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {filteredLevels.map((level, idx) => {
                      const color = levelColors[idx % levelColors.length];
                      const isSelected = selectedLevel === level._id;
                      return (
                        <Box
                          key={level._id}
                          onClick={() => handleLevelSelect(level)}
                          sx={{
                            p: { xs: 2, sm: 2.5 },
                            borderRadius: 2.5,
                            border: `2px solid ${isSelected ? color.icon : '#E2E8F0'}`,
                            bgcolor: isSelected ? color.bg : '#fff',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 2,
                            transition: 'all 0.18s ease',
                            boxShadow: isSelected ? `0 0 0 3px ${color.border}` : '0 1px 3px rgba(0,0,0,0.06)',
                            '&:hover': {
                              border: `2px solid ${color.icon}`,
                              bgcolor: color.bg,
                              transform: 'translateY(-1px)',
                              boxShadow: `0 4px 12px rgba(0,0,0,0.1)`,
                            }
                          }}
                        >
                          <Box
                            sx={{
                              width: 40,
                              height: 40,
                              borderRadius: '50%',
                              bgcolor: isSelected ? color.icon : '#F1F5F9',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              transition: 'all 0.18s ease',
                            }}
                          >
                            <School sx={{ fontSize: 20, color: isSelected ? '#fff' : '#94A3B8' }} />
                          </Box>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography fontWeight={700} sx={{ color: isSelected ? color.text : '#1E293B', fontSize: { xs: 14, sm: 15 } }}>
                              {level.name}
                            </Typography>
                            {level.description && (
                              <Typography variant="body2" sx={{ color: isSelected ? color.text : '#64748B', opacity: isSelected ? 0.85 : 1, fontSize: 12, mt: 0.25 }}>
                                {level.description}
                              </Typography>
                            )}
                            {level._matchedSubLevel && (
                              <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: isSelected ? color.text : BRAND.emerald, fontWeight: 700 }}>
                                Includes "{level._matchedSubLevel}" — select this, then pick it next
                              </Typography>
                            )}
                          </Box>
                          {isSelected && (
                            <CheckCircle sx={{ color: color.icon, fontSize: 22, flexShrink: 0 }} />
                          )}
                        </Box>
                      );
                    })}
                  </Box>
                  )}
                </Box>
              </Fade>
            )}

            {/* Step 1: Pick sub-level */}
            {step === 1 && selectedLevelObj && (
              <Fade in>
                <Box>
                  <Typography variant="body1" fontWeight={600} sx={{ mb: 0.5, color: '#1E293B' }}>
                    Which specific level within {selectedLevelObj.name}?
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#64748B', mb: 2, fontSize: 13 }}>
                    Pick the one that matches your current year or class.
                  </Typography>

                  {(availableSubLevels.length > SEARCH_THRESHOLD || subLevelSearch) && (
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="Search…"
                      value={subLevelSearch}
                      onChange={(e) => setSubLevelSearch(e.target.value)}
                      sx={{ mb: 2, bgcolor: '#fff', borderRadius: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Search sx={{ fontSize: 18, color: '#94A3B8' }} />
                          </InputAdornment>
                        ),
                        endAdornment: subLevelSearch && (
                          <InputAdornment position="end">
                            <IconButton size="small" onClick={() => setSubLevelSearch('')}>
                              <Clear sx={{ fontSize: 16 }} />
                            </IconButton>
                          </InputAdornment>
                        )
                      }}
                    />
                  )}

                  {filteredSubLevels.length === 0 ? (
                    <Box sx={{ py: 4, textAlign: 'center' }}>
                      <Typography variant="body2" sx={{ color: '#94A3B8' }}>
                        No matches for "{subLevelSearch}".
                      </Typography>
                    </Box>
                  ) : (
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 1.5 }}>
                    {filteredSubLevels.map((sub) => {
                      const isSelected = selectedSubLevel === sub.name;
                      return (
                        <Box
                          key={sub._id}
                          onClick={() => { setSelectedSubLevel(sub.name); setError(null); }}
                          sx={{
                            p: 2,
                            borderRadius: 2.5,
                            border: `2px solid ${isSelected ? BRAND.navy : '#E2E8F0'}`,
                            bgcolor: isSelected ? '#EAF3FB' : '#fff',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1.5,
                            transition: 'all 0.18s ease',
                            boxShadow: isSelected ? '0 0 0 3px #BFDBFE' : '0 1px 3px rgba(0,0,0,0.06)',
                            '&:hover': {
                              border: `2px solid ${BRAND.navy}`,
                              bgcolor: '#EAF3FB',
                              transform: 'translateY(-1px)',
                              boxShadow: '0 4px 12px rgba(13,64,108,0.15)',
                            }
                          }}
                        >
                          <Box
                            sx={{
                              width: 32,
                              height: 32,
                              borderRadius: '50%',
                              bgcolor: isSelected ? BRAND.navy : '#F1F5F9',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              transition: 'all 0.18s ease',
                            }}
                          >
                            <Typography fontWeight={700} sx={{ fontSize: 13, color: isSelected ? '#fff' : '#64748B' }}>
                              {sub._displayIndex + 1}
                            </Typography>
                          </Box>
                          <Typography fontWeight={600} sx={{ color: isSelected ? BRAND.navy : '#1E293B', fontSize: { xs: 13, sm: 14 }, flex: 1 }}>
                            {sub.name}
                          </Typography>
                          {isSelected && <CheckCircle sx={{ color: BRAND.navy, fontSize: 18, flexShrink: 0 }} />}
                        </Box>
                      );
                    })}
                  </Box>
                  )}

                  {selectedLevelObj && (
                    <Box sx={{ mt: 2, p: 1.5, bgcolor: '#F0FDF4', borderRadius: 2, border: '1px solid #BBF7D0' }}>
                      <Typography variant="body2" sx={{ color: '#166534', fontSize: 12 }}>
                        <strong>Selected level:</strong> {selectedLevelObj.name}
                        {selectedSubLevel && <> &bull; <strong>{selectedSubLevel}</strong></>}
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Fade>
            )}
          </>
        )}
      </DialogContent>

      {/* Footer actions */}
      {!loading && (
        <Box
          sx={{
            px: { xs: 2.5, sm: 3 },
            py: 2.5,
            bgcolor: '#F8FAFC',
            borderTop: '1px solid #E2E8F0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 2
          }}
        >
          {step === 1 ? (
            <Button
              startIcon={<ArrowBack />}
              onClick={handleBack}
              disabled={submitting}
              sx={{ textTransform: 'none', fontWeight: 600, color: '#64748B' }}
            >
              Back
            </Button>
          ) : (
            <Box />
          )}

          <Button
            variant="contained"
            endIcon={step === 0 && hasSubLevels ? <ArrowForward /> : null}
            onClick={step === 0 ? handleNext : handleSubmit}
            disabled={
              !selectedLevel ||
              submitting ||
              (step === 1 && !selectedSubLevel)
            }
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              borderRadius: 2,
              px: 3,
              py: 1.25,
              minWidth: 140,
              background: BRAND_GRADIENT,
              boxShadow: '0 4px 12px rgba(13,64,108,0.3)',
              '&:hover': { background: `linear-gradient(135deg, ${BRAND.navyDark} 0%, ${BRAND.emerald} 100%)` },
              '&:disabled': { background: '#E2E8F0', boxShadow: 'none' }
            }}
          >
            {submitting ? (
              <CircularProgress size={20} sx={{ color: '#fff' }} />
            ) : step === 0 && hasSubLevels ? (
              'Next'
            ) : (
              'Start Exams'
            )}
          </Button>
        </Box>
      )}
    </Dialog>
  );
};

export default LevelSelectionModal;
