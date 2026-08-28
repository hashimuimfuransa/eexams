import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Paper, Grid, Select, MenuItem, Button, CircularProgress,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip,
  Tooltip, Alert, Snackbar, Menu, Divider
} from '@mui/material';
import { Download, PictureAsPdf, TableChart, TrendingUp, Refresh } from '@mui/icons-material';
import api from '../../../services/api';
import downloadFile from '../../../utils/downloadFile';
import { tokens } from '../../../pages/dashboardTokens';

// Performance analytics over the marks the school entered by hand.
//
// Colour follows the data-viz rules for this palette:
//  · GRADE_RAMP is an ordinal ramp (A..F are ordered tiers) — one hue, monotone
//    lightness, light end 2.25:1 on the white card. Validated, do not eyeball.
//  · Subject and class bars are nominal categories, so every bar wears the SAME
//    series colour; bar length alone carries magnitude.
//  · Status green/amber/red is reserved for pass/fail state and always ships
//    with a number or word beside it, never colour alone.

// Ordinal ramp, darkest = A. Validated on #FFFFFF: monotone L, all ΔL ≥ 0.06,
// light end 2.25:1, hue spread 10°.
const GRADE_RAMP = {
  A: '#0D406C',
  B: '#15558A',
  C: '#256FA6',
  D: '#4185BC',
  E: '#5F9CCB',
  F: '#7FB3D8'
};

const SERIES = '#0D406C';      // single-series bars and the trend line
const GRID = '#E2E8F0';        // hairline, one step off the card
const AXIS = '#CBD5E1';

// Status ink — used only where the colour means good/bad, always with text.
const statusColor = (pct) => {
  if (pct >= 80) return '#067A4C';
  if (pct >= 50) return '#0D406C';
  return '#B91C1C';
};

const pct = (n) => `${Number(n ?? 0)}%`;

/** Horizontal bar row that doubles as the table view: the value is always text. */
function BarRow({ label, value, max, sub, tip }) {
  const width = max > 0 ? Math.max((value / max) * 100, 1) : 0;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 0.6 }}>
      <Typography
        sx={{ width: 150, flexShrink: 0, fontSize: 12.5, color: tokens.textPrimary, fontWeight: 600,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        title={label}
      >
        {label}
      </Typography>
      <Tooltip title={tip || `${label}: ${pct(value)}`} arrow placement="top">
        {/* The track is the hit area, so hovering anywhere on the row works. */}
        <Box sx={{ flex: 1, minWidth: 60, height: 24, display: 'flex', alignItems: 'center', cursor: 'default' }}>
          <Box sx={{ width: '100%', height: 10, bgcolor: '#F1F5F9', borderRadius: '2px', position: 'relative' }}>
            <Box sx={{
              position: 'absolute', left: 0, top: 0, bottom: 0, width: `${width}%`,
              bgcolor: SERIES, borderRadius: '2px 4px 4px 2px'
            }} />
          </Box>
        </Box>
      </Tooltip>
      <Typography sx={{ width: 52, textAlign: 'right', fontSize: 12.5, fontWeight: 700,
                        color: tokens.textPrimary, fontVariantNumeric: 'tabular-nums' }}>
        {pct(value)}
      </Typography>
      {sub !== undefined && (
        <Typography sx={{ width: 96, textAlign: 'right', fontSize: 11.5, color: tokens.textMuted,
                          fontVariantNumeric: 'tabular-nums' }}>
          {sub}
        </Typography>
      )}
    </Box>
  );
}

/** Grade distribution columns. Ordinal ramp; count labelled on every cap. */
function GradeColumns({ distribution }) {
  const max = Math.max(...distribution.map(g => g.count), 1);
  const H = 130;
  return (
    <Box sx={{ display: 'flex', alignItems: 'stretch', gap: 1.5, pt: 1 }}>
      {distribution.map(g => {
        const h = g.count > 0 ? Math.max((g.count / max) * H, 3) : 0;
        return (
          <Tooltip key={g.grade} arrow placement="top"
            title={`Grade ${g.grade} (${g.remark}): ${g.count} subject result${g.count === 1 ? '' : 's'} · ${pct(g.percentage)} of all marks`}>
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                       justifyContent: 'flex-end', cursor: 'default', minWidth: 0 }}>
              <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: tokens.textPrimary, mb: 0.5,
                                fontVariantNumeric: 'tabular-nums' }}>
                {g.count}
              </Typography>
              <Box sx={{ width: '100%', maxWidth: 24, height: H, display: 'flex', alignItems: 'flex-end' }}>
                <Box sx={{ width: '100%', height: h, bgcolor: GRADE_RAMP[g.grade] || SERIES,
                           borderRadius: '4px 4px 0 0' }} />
              </Box>
              <Box sx={{ width: '100%', height: '1px', bgcolor: AXIS, mt: 0 }} />
              <Typography sx={{ fontSize: 12, fontWeight: 800, color: tokens.textSecondary, mt: 0.6 }}>
                {g.grade}
              </Typography>
              <Typography sx={{ fontSize: 10, color: tokens.textMuted, textAlign: 'center', lineHeight: 1.2 }}>
                {g.remark}
              </Typography>
            </Box>
          </Tooltip>
        );
      })}
    </Box>
  );
}

/** Single-series trend line. No legend box — the card title names the series. */
function TrendLine({ points }) {
  const H = 150, padX = 34, padY = 18;
  // ~64px per point keeps the two-line x labels clear of each other; past ten
  // terms the plot outgrows the card and the container scrolls sideways.
  const W = Math.max(640, points.length * 64);
  const values = points.map(p => p.average);
  const max = Math.min(100, Math.max(...values, 10) * 1.15);
  const x = (i) => padX + (points.length === 1 ? (W - padX * 2) / 2 : (i / (points.length - 1)) * (W - padX * 2));
  const y = (v) => H - padY - (v / max) * (H - padY * 2);
  const path = points.map((p, i) => `${x(i)},${y(p.average)}`).join(' ');
  const ticks = [0, 25, 50, 75, 100].filter(t => t <= max);

  return (
    <Box sx={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${W} ${H + 26}`}
        style={{ width: W > 640 ? W : '100%', minWidth: 340, height: 190 }} role="img"
        aria-label="Average percentage by term">
        {/* Hairline grid, solid, recessive */}
        {ticks.map(t => (
          <g key={t}>
            <line x1={padX} x2={W - padX} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth="1" />
            <text x={padX - 6} y={y(t) + 3} textAnchor="end" fontSize="9" fill={tokens.textMuted}>{t}</text>
          </g>
        ))}
        <polyline fill="none" stroke={SERIES} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={path} />
        {points.map((p, i) => (
          <g key={p.label}>
            {/* 2px surface ring keeps a marker legible where it crosses the line */}
            <circle cx={x(i)} cy={y(p.average)} r="5" fill={SERIES} stroke="#FFFFFF" strokeWidth="2" />
            <title>{`${p.label}: ${pct(p.average)} across ${p.records} record${p.records === 1 ? '' : 's'}`}</title>
            <text x={x(i)} y={H + 12} textAnchor="middle" fontSize="9" fill={tokens.textMuted}>
              {p.term}
            </text>
            <text x={x(i)} y={H + 22} textAnchor="middle" fontSize="8" fill={tokens.textMuted}>
              {p.academicYear}
            </text>
          </g>
        ))}
        {/* Direct-label the endpoint only */}
        <text x={x(points.length - 1)} y={y(points[points.length - 1].average) - 11} textAnchor="middle"
          fontSize="10.5" fontWeight="700" fill={tokens.textPrimary}>
          {pct(points[points.length - 1].average)}
        </text>
      </svg>
    </Box>
  );
}

function Card({ title, subtitle, children, action }) {
  return (
    <Paper elevation={0} sx={{ p: 2.25, borderRadius: 3, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white', height: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.25, gap: 1 }}>
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: 14, color: tokens.textPrimary, fontFamily: "'DM Sans',sans-serif" }}>
            {title}
          </Typography>
          {subtitle && <Typography sx={{ fontSize: 11.5, color: tokens.textMuted }}>{subtitle}</Typography>}
        </Box>
        {action}
      </Box>
      {children}
    </Paper>
  );
}

export default function TranscriptAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [snack, setSnack] = useState('');
  const [downloading, setDownloading] = useState('');
  const [menuAnchor, setMenuAnchor] = useState(null);

  // One filter row scopes every chart and every export on this tab.
  const [academicYear, setAcademicYear] = useState('');
  const [term, setTerm] = useState('');
  const [className, setClassName] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api.get('/admin/transcripts/analytics', {
      params: {
        academicYear: academicYear || undefined,
        term: term || undefined,
        class: className || undefined
      }
    })
      .then(r => { setData(r.data); setError(''); })
      .catch(err => setError(err.response?.data?.message || 'Failed to load analytics.'))
      .finally(() => setLoading(false));
  }, [academicYear, term, className]);

  useEffect(() => { load(); }, [load]);

  const handleDownload = async (kind) => {
    setMenuAnchor(null);
    setDownloading(kind);
    const params = {
      academicYear: academicYear || undefined,
      term: term || undefined,
      class: className || undefined,
      ...(kind === 'summary' ? { view: 'summary' } : {})
    };
    try {
      const url = kind === 'pdf' ? '/admin/transcripts/export/pdf' : '/admin/transcripts/export/csv';
      const name = await downloadFile(url, params, kind === 'pdf' ? 'transcripts.pdf' : 'marks.csv');
      setSnack(`✓ Downloaded ${name}`);
    } catch (err) {
      setSnack(err.message || 'Download failed');
    } finally {
      setDownloading('');
    }
  };

  const filters = data?.filters || {};
  const summary = data?.summary;

  const filterRow = (
    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', mb: 2.5 }}>
      <Select size="small" value={academicYear} onChange={e => setAcademicYear(e.target.value)} displayEmpty
        sx={{ borderRadius: 2, minWidth: 150, fontSize: 13, bgcolor: 'white' }}>
        <MenuItem value="">All academic years</MenuItem>
        {(filters.availableYears || []).map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
      </Select>
      <Select size="small" value={term} onChange={e => setTerm(e.target.value)} displayEmpty
        sx={{ borderRadius: 2, minWidth: 130, fontSize: 13, bgcolor: 'white' }}>
        <MenuItem value="">All terms</MenuItem>
        {(filters.availableTerms || []).map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
      </Select>
      <Select size="small" value={className} onChange={e => setClassName(e.target.value)} displayEmpty
        sx={{ borderRadius: 2, minWidth: 130, fontSize: 13, bgcolor: 'white' }}>
        <MenuItem value="">All classes</MenuItem>
        {(filters.availableClasses || []).map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
      </Select>

      <Box sx={{ flex: 1 }} />

      <Button size="small" startIcon={<Refresh sx={{ fontSize: 16 }} />} onClick={load}
        sx={{ textTransform: 'none', fontWeight: 600, color: tokens.textSecondary }}>
        Refresh
      </Button>
      <Button
        variant="contained" size="small"
        startIcon={downloading ? <CircularProgress size={15} color="inherit" /> : <Download sx={{ fontSize: 17 }} />}
        onClick={e => setMenuAnchor(e.currentTarget)}
        disabled={!!downloading}
        sx={{ borderRadius: 2.5, fontWeight: 700, textTransform: 'none', bgcolor: tokens.primary, boxShadow: 'none',
              '&:hover': { bgcolor: tokens.primaryDark } }}
      >
        {downloading ? 'Preparing…' : 'Download'}
      </Button>
      <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}>
        <MenuItem onClick={() => handleDownload('pdf')}>
          <PictureAsPdf sx={{ fontSize: 18, mr: 1.25, color: '#B91C1C' }} />
          <Box>
            <Typography variant="body2" fontWeight={600}>Transcripts (PDF)</Typography>
            <Typography variant="caption" sx={{ color: tokens.textMuted }}>One printable page per student</Typography>
          </Box>
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => handleDownload('csv')}>
          <TableChart sx={{ fontSize: 18, mr: 1.25, color: '#067A4C' }} />
          <Box>
            <Typography variant="body2" fontWeight={600}>Marks sheet (CSV)</Typography>
            <Typography variant="caption" sx={{ color: tokens.textMuted }}>A row per subject result</Typography>
          </Box>
        </MenuItem>
        <MenuItem onClick={() => handleDownload('summary')}>
          <TableChart sx={{ fontSize: 18, mr: 1.25, color: tokens.primary }} />
          <Box>
            <Typography variant="body2" fontWeight={600}>Results summary (CSV)</Typography>
            <Typography variant="caption" sx={{ color: tokens.textMuted }}>A row per student per term</Typography>
          </Box>
        </MenuItem>
      </Menu>
    </Box>
  );

  if (loading && !data) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}><CircularProgress sx={{ color: tokens.accent }} /></Box>;
  }
  if (error) {
    return <Box>{filterRow}<Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert></Box>;
  }

  const noMarks = !summary || summary.recordsCount === 0;

  return (
    // Hold the previous render at reduced opacity on refetch — no skeleton flash.
    <Box sx={{ opacity: loading ? 0.55 : 1, transition: 'opacity 150ms' }}>
      {filterRow}

      {noMarks ? (
        <Paper elevation={0} sx={{ p: 5, borderRadius: 3, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white', textAlign: 'center' }}>
          <TrendingUp sx={{ fontSize: 36, color: tokens.textMuted, mb: 1 }} />
          <Typography variant="body2" sx={{ color: tokens.textMuted }}>
            No marks match these filters yet. Enter marks on the <strong>Enter Marks</strong> tab and the analytics will fill in.
          </Typography>
        </Paper>
      ) : (
        <>
          {/* KPI row — headline numbers are tiles, not charts */}
          <Grid container spacing={2} sx={{ mb: 2.5 }}>
            {[
              { label: 'School average', value: pct(summary.averagePercentage), color: statusColor(summary.averagePercentage), hero: true },
              { label: 'Pass rate', value: pct(summary.passRate), sub: `${summary.studentsWithMarks} student${summary.studentsWithMarks === 1 ? '' : 's'} graded` },
              { label: 'Highest / lowest', value: `${summary.highest}% / ${summary.lowest}%` },
              { label: 'Term records', value: summary.recordsCount, sub: `${summary.subjectEntries} subject results` },
              { label: 'Subjects tracked', value: summary.subjectsTracked, sub: `${summary.classesTracked} class${summary.classesTracked === 1 ? '' : 'es'}` },
              { label: 'Awaiting marks', value: summary.studentsWithoutMarks, sub: `of ${summary.totalStudents} students` },
            ].map((tile, i) => (
              <Grid item xs={6} sm={4} md={2} key={i}>
                <Paper elevation={0} sx={{ p: 1.75, borderRadius: 3, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white', height: '100%' }}>
                  <Typography sx={{ fontSize: 11, color: tokens.textMuted, fontWeight: 600, mb: 0.5, lineHeight: 1.3 }}>
                    {tile.label}
                  </Typography>
                  <Typography sx={{ fontSize: tile.hero ? 26 : 19, fontWeight: 800, lineHeight: 1.15,
                                    color: tile.color || tokens.textPrimary }}>
                    {tile.value}
                  </Typography>
                  {tile.sub && <Typography sx={{ fontSize: 10.5, color: tokens.textMuted, mt: 0.25 }}>{tile.sub}</Typography>}
                </Paper>
              </Grid>
            ))}
          </Grid>

          <Grid container spacing={2.5}>
            {/* Grade distribution */}
            <Grid item xs={12} md={6}>
              <Card title="Grade distribution" subtitle={`Across ${summary.subjectEntries} subject results`}>
                <GradeColumns distribution={data.gradeDistribution} />
              </Card>
            </Grid>

            {/* Term trend */}
            <Grid item xs={12} md={6}>
              <Card title="Average by term" subtitle="School average across every recorded term">
                {data.termTrend.length >= 2 ? (
                  <TrendLine points={data.termTrend} />
                ) : (
                  <Box sx={{ py: 5, textAlign: 'center' }}>
                    <Typography sx={{ fontSize: 12.5, color: tokens.textMuted }}>
                      {data.termTrend.length === 1
                        ? `Only ${data.termTrend[0].label} is recorded so far (${pct(data.termTrend[0].average)}). A trend appears once a second term is entered.`
                        : 'No terms recorded yet.'}
                    </Typography>
                  </Box>
                )}
              </Card>
            </Grid>

            {/* Subject performance */}
            <Grid item xs={12} md={6}>
              <Card title="Subject performance" subtitle="Average score, strongest first">
                <Box sx={{ display: 'flex', gap: 1.5, pb: 0.5, borderBottom: `1px solid ${GRID}` }}>
                  <Typography sx={{ width: 150, fontSize: 10.5, color: tokens.textMuted, fontWeight: 700 }}>SUBJECT</Typography>
                  <Box sx={{ flex: 1 }} />
                  <Typography sx={{ width: 52, textAlign: 'right', fontSize: 10.5, color: tokens.textMuted, fontWeight: 700 }}>AVG</Typography>
                  <Typography sx={{ width: 96, textAlign: 'right', fontSize: 10.5, color: tokens.textMuted, fontWeight: 700 }}>PASS RATE</Typography>
                </Box>
                <Box sx={{ maxHeight: 300, overflowY: 'auto', pt: 0.5 }}>
                  {data.subjectPerformance.map(s => (
                    <BarRow
                      key={s.name} label={s.name} value={s.average} max={100}
                      sub={`${pct(s.passRate)}`}
                      tip={`${s.name}: average ${pct(s.average)} · ${pct(s.passRate)} passing · best ${s.best}% · worst ${s.worst}% · ${s.entries} result${s.entries === 1 ? '' : 's'}`}
                    />
                  ))}
                </Box>
              </Card>
            </Grid>

            {/* Class performance */}
            <Grid item xs={12} md={6}>
              <Card title="Class performance" subtitle="Average of each student's overall score">
                <Box sx={{ display: 'flex', gap: 1.5, pb: 0.5, borderBottom: `1px solid ${GRID}` }}>
                  <Typography sx={{ width: 150, fontSize: 10.5, color: tokens.textMuted, fontWeight: 700 }}>CLASS</Typography>
                  <Box sx={{ flex: 1 }} />
                  <Typography sx={{ width: 52, textAlign: 'right', fontSize: 10.5, color: tokens.textMuted, fontWeight: 700 }}>AVG</Typography>
                  <Typography sx={{ width: 96, textAlign: 'right', fontSize: 10.5, color: tokens.textMuted, fontWeight: 700 }}>STUDENTS</Typography>
                </Box>
                <Box sx={{ maxHeight: 300, overflowY: 'auto', pt: 0.5 }}>
                  {data.classPerformance.map(c => (
                    <BarRow
                      key={c.class} label={c.class} value={c.average} max={100}
                      sub={`${c.students}`}
                      tip={`${c.class}: average ${pct(c.average)} · ${pct(c.passRate)} passing · ${c.students} student${c.students === 1 ? '' : 's'} · best ${c.best}% · worst ${c.worst}%`}
                    />
                  ))}
                </Box>
              </Card>
            </Grid>

            {/* Top performers */}
            <Grid item xs={12} md={6}>
              <Card title="Top performers" subtitle="Highest overall average">
                <TableContainer sx={{ overflowX: 'auto' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        {['Student', 'Class', 'Terms', 'Average'].map(h => (
                          <TableCell key={h} sx={{ fontSize: 10.5, fontWeight: 700, color: tokens.textMuted, borderColor: GRID }}>{h}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {data.topPerformers.map(s => (
                        <TableRow key={s._id}>
                          <TableCell sx={{ borderColor: GRID }}>
                            <Typography variant="body2" fontWeight={600} sx={{ lineHeight: 1.2 }}>{s.name}</Typography>
                            <Typography variant="caption" sx={{ color: tokens.textMuted }}>{s.registrationNumber || '—'}</Typography>
                          </TableCell>
                          <TableCell sx={{ borderColor: GRID, fontSize: 12.5, color: tokens.textSecondary }}>{s.class || '—'}</TableCell>
                          <TableCell sx={{ borderColor: GRID, fontSize: 12.5, fontVariantNumeric: 'tabular-nums' }}>{s.terms}</TableCell>
                          <TableCell sx={{ borderColor: GRID }}>
                            <Chip size="small" label={`${s.average}% · ${s.grade}`}
                              sx={{ height: 20, fontSize: 11, fontWeight: 800,
                                    bgcolor: `${statusColor(s.average)}1A`, color: statusColor(s.average) }} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Card>
            </Grid>

            {/* Needs attention */}
            <Grid item xs={12} md={6}>
              <Card title="Needs attention" subtitle="Students averaging below the 50% pass mark">
                {data.needsAttention.length === 0 ? (
                  <Box sx={{ py: 5, textAlign: 'center' }}>
                    <Typography sx={{ fontSize: 12.5, color: tokens.textMuted }}>
                      Every graded student is at or above the pass mark.
                    </Typography>
                  </Box>
                ) : (
                  <TableContainer sx={{ overflowX: 'auto' }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          {['Student', 'Class', 'Average', 'Weakest subjects'].map(h => (
                            <TableCell key={h} sx={{ fontSize: 10.5, fontWeight: 700, color: tokens.textMuted, borderColor: GRID }}>{h}</TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {data.needsAttention.map(s => (
                          <TableRow key={s._id}>
                            <TableCell sx={{ borderColor: GRID }}>
                              <Typography variant="body2" fontWeight={600} sx={{ lineHeight: 1.2 }}>{s.name}</Typography>
                              <Typography variant="caption" sx={{ color: tokens.textMuted }}>{s.registrationNumber || '—'}</Typography>
                            </TableCell>
                            <TableCell sx={{ borderColor: GRID, fontSize: 12.5, color: tokens.textSecondary }}>{s.class || '—'}</TableCell>
                            <TableCell sx={{ borderColor: GRID }}>
                              <Chip size="small" label={`${s.average}%`}
                                sx={{ height: 20, fontSize: 11, fontWeight: 800, bgcolor: 'rgba(185,28,28,0.10)', color: '#B91C1C' }} />
                            </TableCell>
                            <TableCell sx={{ borderColor: GRID, fontSize: 11.5, color: tokens.textSecondary }}>
                              {s.weakSubjects.length ? s.weakSubjects.join(', ') : '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Card>
            </Grid>
          </Grid>
        </>
      )}

      <Snackbar open={!!snack} autoHideDuration={5000} onClose={() => setSnack('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={() => setSnack('')} severity={snack.startsWith('✓') ? 'success' : 'error'} sx={{ borderRadius: 2 }}>
          {snack}
        </Alert>
      </Snackbar>
    </Box>
  );
}
