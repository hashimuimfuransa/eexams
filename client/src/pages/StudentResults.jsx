import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box, Typography, Paper, TextField, Button, CircularProgress, Alert, Chip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Divider,
  InputAdornment, LinearProgress
} from '@mui/material';
import { Search, Print, School, Badge, EmojiEvents, MenuBook, Download } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useThemeMode } from '../context/ThemeContext';
import Nav from '../components/Nav';
import SEO from '../components/SEO';
import api from '../services/api';
import downloadFile from '../utils/downloadFile';

// Public transcript lookup. A student types the registration number their
// school issued and gets every published term back — no account, no login.

const gradeColor = (percentage) => {
  if (percentage >= 80) return '#0CBD73';
  if (percentage >= 60) return '#0D406C';
  if (percentage >= 50) return '#F59E0B';
  return '#EF4444';
};

const formatDate = (value) => {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString();
};

const StudentResults = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated, user, logout } = useAuth();
  const { mode, toggleMode } = useThemeMode();
  const isDark = mode === 'dark';

  const [regNumber, setRegNumber] = useState(searchParams.get('reg') || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [scrolled, setScrolled] = useState(0);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const lookup = useCallback(async (value) => {
    const trimmed = String(value || '').trim();
    if (!trimmed) {
      setError('Enter your registration number to see your results.');
      return;
    }

    setLoading(true);
    setError('');
    setData(null);

    try {
      const res = await api.get(`/results/transcript/${encodeURIComponent(trimmed)}`);
      setData(res.data);
    } catch (err) {
      const status = err.response?.status;
      setError(
        err.response?.data?.message ||
        (status === 429
          ? 'Too many lookups from this device. Please wait a few minutes.'
          : 'Could not load your results. Please try again.')
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // Deep link support: /results?reg=GSK-2026-0001 loads straight away, so a
  // school can hand out one link per student.
  useEffect(() => {
    const fromUrl = searchParams.get('reg');
    if (fromUrl) lookup(fromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = regNumber.trim();
    setSearchParams(trimmed ? { reg: trimmed } : {}, { replace: true });
    lookup(trimmed);
  };

  // The server renders the formal transcript (school header, grading key,
  // verification reference, signature and stamp panel). window.print() only
  // ever produced a screenshot of this page, which is not a document a school
  // or employer would accept.
  const handleDownload = async () => {
    if (!data) return;
    setDownloading(true);
    setError('');
    try {
      await downloadFile(
        `/results/transcript/${encodeURIComponent(data.student.registrationNumber)}/pdf`,
        {},
        `transcript-${data.student.registrationNumber}.pdf`
      );
    } catch (err) {
      setError(err.message || 'Could not download your transcript. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const handleLogout = () => { logout?.(); };

  const bg = isDark ? '#0F172A' : '#F1F5F9';
  const surface = isDark ? '#1E293B' : '#FFFFFF';
  const border = isDark ? '#334155' : '#E2E8F0';
  const textPrimary = isDark ? '#F8FAFC' : '#0F172A';
  const textMuted = isDark ? '#94A3B8' : '#64748B';

  return (
    <>
      <SEO
        title="Check Your Results | eexams"
        description="Enter your student registration number to view your transcript and the marks you scored in each subject."
        canonical="https://www.eexams.net/results"
        ogUrl="https://www.eexams.net/results"
      />

      {/* Print styles: strip the page chrome so a transcript prints as a document */}
      <style>{`
        @media print {
          nav, header, .no-print { display: none !important; }
          body { background: #fff !important; }
          .print-area { box-shadow: none !important; border: none !important; padding: 0 !important; }
        }
      `}</style>

      <Box className="no-print">
        <Nav
          scrolled={scrolled > 20}
          mode={mode}
          toggleMode={toggleMode}
          isAuthenticated={isAuthenticated}
          user={user}
          handleLogout={handleLogout}
          currentRoute="/results"
        />
      </Box>

      <Box sx={{ minHeight: '100vh', bgcolor: bg, pt: { xs: 10, sm: 14, md: 18 }, pb: { xs: 5, sm: 8 } }}>
        <Box sx={{ maxWidth: 1000, mx: 'auto', px: { xs: 1.5, sm: 2, md: 3 } }}>

          {/* Lookup form */}
          <Box className="no-print" sx={{ textAlign: 'center', mb: 4 }}>
            <Typography variant="h4" fontWeight={700} sx={{ color: isDark ? '#F8FAFC' : '#0D406C', mb: 1, fontSize: { xs: '1.5rem', sm: '2rem' } }}>
              Check Your Results
            </Typography>
            <Typography sx={{ color: textMuted, maxWidth: 560, mx: 'auto', fontSize: { xs: 13, sm: 15 }, mb: 3 }}>
              Enter the registration number your school gave you to see your transcript and the marks you scored in every subject.
            </Typography>

            <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', gap: 1.5, maxWidth: 520, mx: 'auto', flexDirection: { xs: 'column', sm: 'row' } }}>
              <TextField
                fullWidth
                value={regNumber}
                onChange={(e) => setRegNumber(e.target.value)}
                placeholder="e.g. GSK-2026-0042"
                autoComplete="off"
                inputProps={{ 'aria-label': 'Registration number', maxLength: 40 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Badge sx={{ color: textMuted, fontSize: 20 }} />
                    </InputAdornment>
                  ),
                  sx: { borderRadius: 2.5, bgcolor: surface, fontWeight: 600, letterSpacing: 0.5 }
                }}
              />
              <Button
                type="submit"
                variant="contained"
                disabled={loading}
                startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <Search />}
                sx={{
                  borderRadius: 2.5, px: 4, fontWeight: 700, textTransform: 'none', whiteSpace: 'nowrap',
                  background: 'linear-gradient(135deg, #0D406C 0%, #0CBD73 100%)', boxShadow: 'none'
                }}
              >
                {loading ? 'Searching' : 'Get Results'}
              </Button>
            </Box>

            {error && (
              <Alert severity="error" sx={{ mt: 2.5, maxWidth: 520, mx: 'auto', borderRadius: 2, textAlign: 'left' }}>
                {error}
              </Alert>
            )}
          </Box>

          {/* Transcript */}
          {data && (
            <Box className="print-area">
              {/* Student header */}
              <Paper elevation={0} sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3, border: `1px solid ${border}`, bgcolor: surface, mb: 2.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap' }}>
                  <Box>
                    <Typography variant="h5" fontWeight={800} sx={{ color: textPrimary, lineHeight: 1.2 }}>
                      {data.student.fullName}
                    </Typography>
                    <Typography sx={{ color: textMuted, fontSize: 14, mt: 0.5, display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <School sx={{ fontSize: 16 }} /> {data.student.school || 'School not set'}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mt: 1.5 }}>
                      <Chip size="small" label={data.student.registrationNumber} sx={{ fontWeight: 700, bgcolor: 'rgba(13,64,108,0.09)', color: isDark ? '#93C5FD' : '#0D406C' }} />
                      {data.student.class && <Chip size="small" label={`Class ${data.student.class}`} sx={{ bgcolor: 'rgba(12,189,115,0.12)', color: '#067A4C', fontWeight: 600 }} />}
                      <Chip size="small" label={`${data.termsCount} term${data.termsCount === 1 ? '' : 's'} recorded`} sx={{ bgcolor: isDark ? '#334155' : '#F1F5F9', color: textMuted }} />
                    </Box>
                  </Box>

                  <Box sx={{ textAlign: 'center', minWidth: 130 }}>
                    <Typography sx={{ fontSize: 11, color: textMuted, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700 }}>
                      Overall Average
                    </Typography>
                    <Typography sx={{ fontSize: 40, fontWeight: 800, lineHeight: 1.1, color: gradeColor(data.overallPercentage) }}>
                      {data.overallPercentage}%
                    </Typography>
                    <Box className="no-print" sx={{ mt: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.25 }}>
                      <Button
                        variant="contained"
                        size="small"
                        disabled={downloading}
                        startIcon={downloading ? <CircularProgress size={14} color="inherit" /> : <Download sx={{ fontSize: 16 }} />}
                        onClick={handleDownload}
                        sx={{
                          textTransform: 'none', fontWeight: 700, borderRadius: 2.5, px: 2, whiteSpace: 'nowrap',
                          background: 'linear-gradient(135deg, #0D406C 0%, #0CBD73 100%)', boxShadow: 'none'
                        }}
                      >
                        {downloading ? 'Preparing…' : 'Download Transcript'}
                      </Button>
                      <Button
                        size="small"
                        startIcon={<Print sx={{ fontSize: 14 }} />}
                        onClick={() => window.print()}
                        sx={{ textTransform: 'none', fontWeight: 600, color: textMuted, fontSize: 11.5 }}
                      >
                        Print this page
                      </Button>
                    </Box>
                  </Box>
                </Box>
              </Paper>

              {/* One card per term */}
              {data.records.map((record) => (
                <Paper key={record._id} elevation={0} sx={{ borderRadius: 3, border: `1px solid ${border}`, bgcolor: surface, mb: 2.5, overflow: 'hidden' }}>
                  <Box sx={{ p: { xs: 2, sm: 2.5 }, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                    <Box>
                      <Typography fontWeight={700} sx={{ color: textPrimary, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <MenuBook sx={{ fontSize: 18, color: textMuted }} />
                        {record.term} · {record.academicYear}
                      </Typography>
                      <Typography sx={{ fontSize: 12.5, color: textMuted, mt: 0.35 }}>
                        {record.class ? `Class ${record.class}` : 'Class not recorded'}
                        {record.schoolName ? ` · ${record.schoolName}` : ''}
                        {record.updatedAt ? ` · Updated ${formatDate(record.updatedAt)}` : ''}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center', flexWrap: 'wrap' }}>
                      {record.position && (
                        <Chip
                          size="small"
                          icon={<EmojiEvents sx={{ fontSize: 15 }} />}
                          label={record.outOf ? `Position ${record.position} of ${record.outOf}` : `Position ${record.position}`}
                          sx={{ bgcolor: 'rgba(245,158,11,0.14)', color: '#B45309', fontWeight: 700 }}
                        />
                      )}
                      <Chip
                        size="small"
                        label={`${record.totalMarks} / ${record.totalMaxMarks}`}
                        sx={{ bgcolor: isDark ? '#334155' : '#F1F5F9', color: textMuted, fontWeight: 600 }}
                      />
                      <Chip
                        size="small"
                        label={`${record.percentage}% · ${record.grade}`}
                        sx={{ bgcolor: `${gradeColor(record.percentage)}1F`, color: gradeColor(record.percentage), fontWeight: 800 }}
                      />
                    </Box>
                  </Box>

                  <Divider sx={{ borderColor: border }} />

                  <TableContainer sx={{ overflowX: 'auto' }}>
                    <Table size="small" sx={{ minWidth: 620 }}>
                      <TableHead>
                        <TableRow sx={{ bgcolor: isDark ? '#172033' : '#F8FAFC' }}>
                          {['Subject', 'Marks', 'Out Of', '%', 'Grade', 'Remark'].map(h => (
                            <TableCell key={h} sx={{ fontWeight: 700, fontSize: 11.5, color: textMuted, borderColor: border, whiteSpace: 'nowrap' }}>
                              {h}
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {record.subjects.map((subject) => (
                          <TableRow key={subject._id || subject.name}>
                            <TableCell sx={{ borderColor: border, color: textPrimary }}>
                              <Typography variant="body2" fontWeight={600}>{subject.name}</Typography>
                              {subject.code && <Typography variant="caption" sx={{ color: textMuted }}>{subject.code}</Typography>}
                            </TableCell>
                            <TableCell sx={{ borderColor: border, color: textPrimary, fontWeight: 700 }}>{subject.marks}</TableCell>
                            <TableCell sx={{ borderColor: border, color: textMuted }}>{subject.maxMarks}</TableCell>
                            <TableCell sx={{ borderColor: border, minWidth: 110 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                <Typography variant="body2" fontWeight={700} sx={{ color: gradeColor(subject.percentage) }}>
                                  {subject.percentage}%
                                </Typography>
                                <LinearProgress
                                  variant="determinate"
                                  value={Math.min(subject.percentage, 100)}
                                  sx={{
                                    width: 44, height: 4, borderRadius: 2,
                                    bgcolor: isDark ? '#334155' : '#E2E8F0',
                                    '& .MuiLinearProgress-bar': { bgcolor: gradeColor(subject.percentage) }
                                  }}
                                />
                              </Box>
                            </TableCell>
                            <TableCell sx={{ borderColor: border }}>
                              <Chip size="small" label={subject.grade} sx={{ height: 20, fontSize: 11, fontWeight: 800, bgcolor: `${gradeColor(subject.percentage)}1F`, color: gradeColor(subject.percentage) }} />
                            </TableCell>
                            <TableCell sx={{ borderColor: border, color: textMuted, fontSize: 12.5 }}>{subject.remark || '—'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  {record.remarks && (
                    <Box sx={{ p: 2, borderTop: `1px solid ${border}`, bgcolor: isDark ? '#172033' : '#F8FAFC' }}>
                      <Typography sx={{ fontSize: 11, color: textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, mb: 0.5 }}>
                        School remarks
                      </Typography>
                      <Typography variant="body2" sx={{ color: textPrimary }}>{record.remarks}</Typography>
                    </Box>
                  )}
                </Paper>
              ))}

              <Typography sx={{ color: textMuted, fontSize: 12, textAlign: 'center', mt: 3 }}>
                Results are entered and published by your school. If something looks wrong, contact your school administrator.
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
    </>
  );
};

export default StudentResults;
