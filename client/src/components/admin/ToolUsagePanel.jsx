// Teacher tool usage report (GET /api/superadmin/tool-usage).
//
// The number this panel exists to show is "generated but never saved": the
// saved libraries elsewhere in the dashboard only count what teachers kept, so
// a teacher who generates ten AI lesson plans and saves none reads as idle
// everywhere else. Every tool row therefore shows generated and saved side by
// side rather than one usage figure.
//
// Rendered twice: `compact` on the Overview (fixed 30-day window, top tools and
// teachers only) and full inside the Teacher Tools section.
import { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Grid, CircularProgress, Button, Chip, Avatar, Tooltip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, LinearProgress
} from '@mui/material';
import {
  AutoAwesome, SaveAlt, Download, Block, ErrorOutline, Groups, DraftsOutlined,
  Article, Slideshow, Assignment, CalendarMonth, MenuBook, Quiz, HelpOutline,
  TableChart, Chat, UploadFile, TrendingUp
} from '@mui/icons-material';
import api from '../../services/api';
import { tokens } from '../../pages/dashboardTokens';
import { SectionTitle } from '../../pages/DashboardShell';

const PERIODS = [
  { id: '7d', label: '7 Days' },
  { id: '30d', label: '30 Days' },
  { id: '90d', label: '90 Days' },
  { id: '1y', label: '1 Year' },
  { id: 'all', label: 'All Time' }
];

// Keys match TOOLS in server/models/ToolUsage.js.
const TOOL_ICONS = {
  lesson_plan: <Article sx={{ fontSize: 16 }} />,
  slides: <Slideshow sx={{ fontSize: 16 }} />,
  exercises: <Assignment sx={{ fontSize: 16 }} />,
  scheme: <CalendarMonth sx={{ fontSize: 16 }} />,
  reference_extract: <MenuBook sx={{ fontSize: 16 }} />,
  exam_ai_generate: <Quiz sx={{ fontSize: 16 }} />,
  exam_ai_question: <HelpOutline sx={{ fontSize: 16 }} />,
  exam_ai_spreadsheet: <TableChart sx={{ fontSize: 16 }} />,
  exam_ai_chat: <Chat sx={{ fontSize: 16 }} />,
  exam_reference: <UploadFile sx={{ fontSize: 16 }} />
};

export const TOOL_LABELS = {
  lesson_plan: 'Lesson Plans',
  slides: 'Slide Decks',
  exercises: 'Exercise Sheets',
  scheme: 'Schemes of Work',
  reference_extract: 'Reference Upload',
  exam_ai_generate: 'AI Exam Generator',
  exam_ai_question: 'AI Question Assist',
  exam_ai_spreadsheet: 'AI Spreadsheet Fill',
  exam_ai_chat: 'AI Teaching Chat',
  exam_reference: 'Exam Reference Read'
};

export const ACTION_LABELS = {
  generate: 'Generated with AI',
  save: 'Saved',
  update: 'Edited',
  export: 'Downloaded',
  delete: 'Deleted',
  extract: 'Read reference'
};

export const STATUS_COLORS = {
  success: tokens.accentDark,
  blocked: tokens.warning,
  failed: tokens.danger
};

export const toolIcon = (tool) => TOOL_ICONS[tool] || <AutoAwesome sx={{ fontSize: 16 }} />;

export const timeAgo = (date) => {
  if (!date) return 'never';
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
};

export function ToolStatTile({ icon, value, label, sub, color }) {
  return (
    <Paper elevation={0} sx={{
      p: 2, borderRadius: 3, bgcolor: 'white', border: `1px solid ${tokens.surfaceBorder}`, height: '100%'
    }}>
      <Box sx={{
        width: 38, height: 38, borderRadius: 2, bgcolor: `${color}15`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1.25, color
      }}>{icon}</Box>
      <Typography variant="h5" fontWeight={800} sx={{ color: tokens.textPrimary, fontFamily: "'DM Sans',sans-serif", lineHeight: 1.1 }}>
        {value ?? '—'}
      </Typography>
      <Typography sx={{ fontSize: 12.5, color: tokens.textMuted, fontFamily: "'DM Sans',sans-serif", mt: 0.25 }}>{label}</Typography>
      {sub && <Typography sx={{ fontSize: 11.5, color, fontWeight: 600, mt: 0.35 }}>{sub}</Typography>}
    </Paper>
  );
}

// Generated vs saved for one tool, as a single bar: the accent portion is what
// the teacher kept, the amber remainder is what they generated and discarded.
function ToolBar({ row, max }) {
  const width = max ? Math.max(4, (row.total / max) * 100) : 0;
  const savedShare = row.generated ? Math.min(100, (row.saved / row.generated) * 100) : 0;

  return (
    <Box sx={{ mb: 1.75 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5, gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
          <Box sx={{ color: tokens.primary, display: 'flex' }}>{toolIcon(row.tool)}</Box>
          <Typography variant="body2" fontWeight={600} noWrap sx={{ fontFamily: "'DM Sans',sans-serif" }}>{row.label}</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0 }}>
          <Tooltip title="Drafts generated with AI">
            <Typography variant="caption" fontWeight={700} sx={{ color: tokens.primary }}>{row.generated} gen</Typography>
          </Tooltip>
          <Typography variant="caption" sx={{ color: tokens.textMuted }}>/</Typography>
          <Tooltip title="Saved to the teacher's library">
            <Typography variant="caption" fontWeight={700} sx={{ color: tokens.accentDark }}>{row.saved} saved</Typography>
          </Tooltip>
        </Box>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ flex: 1, height: 8, borderRadius: 4, bgcolor: '#EEF2F6', overflow: 'hidden' }}>
          <Box sx={{ width: `${width}%`, height: '100%', display: 'flex', borderRadius: 4, overflow: 'hidden' }}>
            <Box sx={{ width: `${savedShare}%`, bgcolor: tokens.accent }} />
            <Box sx={{ flex: 1, bgcolor: tokens.warning }} />
          </Box>
        </Box>
        <Typography variant="caption" sx={{ color: tokens.textMuted, minWidth: 62, textAlign: 'right' }}>
          {row.total} uses
        </Typography>
      </Box>
    </Box>
  );
}

export default function ToolUsagePanel({ compact = false, hideTiles = false, onViewAll, onSelectTeacher }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30d');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.get(`/superadmin/tool-usage?period=${period}&topLimit=${compact ? 5 : 15}&recentLimit=${compact ? 0 : 30}`)
      .then(r => { if (!cancelled) setData(r.data); })
      .catch(err => { console.error('Fetch tool usage error:', err); if (!cancelled) setData(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [period, compact]);

  if (loading) {
    return (
      <Paper elevation={0} sx={{ p: 4, borderRadius: 3, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white', textAlign: 'center' }}>
        <CircularProgress size={24} sx={{ color: tokens.accent }} />
      </Paper>
    );
  }

  if (!data) {
    return (
      <Paper elevation={0} sx={{ p: 4, borderRadius: 3, border: `1px dashed ${tokens.surfaceBorder}`, bgcolor: '#FAFBFC', textAlign: 'center' }}>
        <Typography sx={{ color: tokens.textMuted }}>Could not load teacher tool usage.</Typography>
      </Paper>
    );
  }

  const t = data.totals || {};
  const maxTotal = Math.max(...(data.byTool || []).map(r => r.total), 1);
  const usedTools = (data.byTool || []).filter(r => r.total > 0);
  const shownTools = compact ? usedTools.slice(0, 5) : (data.byTool || []);

  const tiles = [
    { icon: <AutoAwesome sx={{ fontSize: 20 }} />, value: t.events, label: 'Tool uses', sub: `${data.allTime?.events ?? 0} all time`, color: tokens.primary },
    { icon: <TrendingUp sx={{ fontSize: 20 }} />, value: t.generated, label: 'AI generations', sub: 'saved or not', color: '#6366F1' },
    { icon: <SaveAlt sx={{ fontSize: 20 }} />, value: t.saved, label: 'Saved to library', sub: `${data.saveRate}% of generations`, color: tokens.accentDark },
    { icon: <DraftsOutlined sx={{ fontSize: 20 }} />, value: t.unsaved, label: 'Generated, never saved', sub: 'work done outside the library', color: tokens.warning },
    { icon: <Download sx={{ fontSize: 20 }} />, value: t.exported, label: 'Downloads', sub: 'PDF / DOCX / PPTX', color: tokens.primary },
    { icon: <Groups sx={{ fontSize: 20 }} />, value: t.activeTeachers, label: 'Teachers using tools', sub: `${data.allTime?.activeTeachers ?? 0} all time`, color: tokens.accent },
    { icon: <Block sx={{ fontSize: 20 }} />, value: t.blocked, label: 'Blocked by plan limits', sub: 'upgrade signals', color: tokens.warning },
    { icon: <ErrorOutline sx={{ fontSize: 20 }} />, value: t.failed, label: 'Failed attempts', sub: 'AI or server errors', color: tokens.danger }
  ];

  return (
    <Box>
      {!compact && (
        <Box sx={{ display: 'flex', gap: 1, mb: 2.5, flexWrap: 'wrap' }}>
          {PERIODS.map(p => (
            <Button
              key={p.id}
              size="small"
              variant={period === p.id ? 'contained' : 'outlined'}
              onClick={() => setPeriod(p.id)}
              sx={{
                textTransform: 'none', borderRadius: 2, fontWeight: 600,
                ...(period === p.id ? { bgcolor: tokens.primary } : { color: tokens.textSecondary, borderColor: tokens.surfaceBorder })
              }}
            >{p.label}</Button>
          ))}
        </Box>
      )}

      {!hideTiles && (
        <Grid container spacing={2} sx={{ mb: 2.5 }}>
          {(compact ? tiles.slice(0, 4) : tiles).map((tile, i) => (
            <Grid item xs={6} md={3} key={i}><ToolStatTile {...tile} /></Grid>
          ))}
        </Grid>
      )}

      <Grid container spacing={2.5}>
        <Grid item xs={12} md={compact ? 12 : 7}>
          <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white', height: '100%' }}>
            <SectionTitle action={compact && onViewAll ? (
              <Button size="small" onClick={onViewAll} sx={{ color: tokens.accent, fontWeight: 700, fontSize: 12, textTransform: 'none' }}>View All</Button>
            ) : null}>Usage by Tool</SectionTitle>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: tokens.accent }} />
                <Typography variant="caption" sx={{ color: tokens.textMuted }}>Saved</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: tokens.warning }} />
                <Typography variant="caption" sx={{ color: tokens.textMuted }}>Generated but not saved</Typography>
              </Box>
            </Box>

            {shownTools.length === 0 ? (
              <Typography sx={{ color: tokens.textMuted, fontSize: 13, py: 2 }}>
                No teacher tools have been used in this period.
              </Typography>
            ) : shownTools.map(row => <ToolBar key={row.tool} row={row} max={maxTotal} />)}
          </Paper>
        </Grid>

        <Grid item xs={12} md={compact ? 12 : 5}>
          <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white', height: '100%' }}>
            <SectionTitle>Most Active Teachers</SectionTitle>
            {(data.topTeachers || []).length === 0 ? (
              <Typography sx={{ color: tokens.textMuted, fontSize: 13 }}>No tool usage recorded yet.</Typography>
            ) : (
              <Box>
                {data.topTeachers.map(teacher => (
                  <Box
                    key={teacher._id}
                    onClick={onSelectTeacher ? () => onSelectTeacher(teacher) : undefined}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 1.5, py: 1.25,
                      borderBottom: `1px solid ${tokens.surfaceBorder}`, '&:last-child': { borderBottom: 'none' },
                      cursor: onSelectTeacher ? 'pointer' : 'default',
                      '&:hover': onSelectTeacher ? { bgcolor: '#F8FAFC' } : {}
                    }}
                  >
                    <Avatar sx={{ width: 34, height: 34, fontSize: 13, fontWeight: 700, bgcolor: `${tokens.accent}18`, color: tokens.accentDark }}>
                      {teacher.firstName?.charAt(0)}
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={600} noWrap>{teacher.firstName} {teacher.lastName}</Typography>
                      <Typography variant="caption" sx={{ color: tokens.textMuted }} noWrap>
                        {teacher.organization || teacher.email}
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                      <Typography variant="body2" fontWeight={700} sx={{ color: tokens.primary }}>{teacher.total}</Typography>
                      <Typography variant="caption" sx={{ color: tokens.textMuted }}>
                        {teacher.generated} gen · {teacher.saved} saved
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            )}
          </Paper>
        </Grid>

        {!compact && (
          <>
            <Grid item xs={12}>
              <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white' }}>
                <SectionTitle>Tool Detail</SectionTitle>
                <TableContainer sx={{ overflowX: 'auto' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                        {['Tool', 'Teachers', 'Generated', 'Saved', 'Not saved', 'Edited', 'Downloads', 'Blocked', 'Failed', 'Last used'].map(h => (
                          <TableCell key={h} sx={{ fontWeight: 700, color: tokens.textSecondary, fontSize: 12, whiteSpace: 'nowrap' }}>{h}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(data.byTool || []).map(row => (
                        <TableRow key={row.tool} sx={{ '&:hover': { bgcolor: '#F8FAFC' } }}>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Box sx={{ color: tokens.primary, display: 'flex' }}>{toolIcon(row.tool)}</Box>
                              <Box>
                                <Typography variant="body2" fontWeight={600}>{row.label}</Typography>
                                <Typography variant="caption" sx={{ color: tokens.textMuted }}>
                                  {row.group === 'planner' ? 'Lesson Planner' : 'Exam tools'}
                                </Typography>
                              </Box>
                            </Box>
                          </TableCell>
                          <TableCell>{row.users}</TableCell>
                          <TableCell><Typography variant="body2" fontWeight={700} sx={{ color: tokens.primary }}>{row.generated}</Typography></TableCell>
                          <TableCell><Typography variant="body2" fontWeight={700} sx={{ color: tokens.accentDark }}>{row.saved}</Typography></TableCell>
                          <TableCell><Typography variant="body2" fontWeight={700} sx={{ color: row.unsaved ? tokens.warning : tokens.textMuted }}>{row.unsaved}</Typography></TableCell>
                          <TableCell>{row.updated}</TableCell>
                          <TableCell>{row.exported}</TableCell>
                          <TableCell>{row.blocked ? <Chip size="small" label={row.blocked} sx={{ height: 20, fontSize: 11, bgcolor: 'rgba(245,158,11,0.12)', color: tokens.warning, fontWeight: 700 }} /> : '—'}</TableCell>
                          <TableCell>{row.failed ? <Chip size="small" label={row.failed} sx={{ height: 20, fontSize: 11, bgcolor: 'rgba(239,68,68,0.1)', color: tokens.danger, fontWeight: 700 }} /> : '—'}</TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap', color: tokens.textMuted, fontSize: 12 }}>{timeAgo(row.lastUsed)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </Grid>

            <Grid item xs={12}>
              <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white' }}>
                <SectionTitle>Live Activity</SectionTitle>
                {(data.recent || []).length === 0 ? (
                  <Typography sx={{ color: tokens.textMuted, fontSize: 13 }}>Nothing recorded in this period.</Typography>
                ) : (
                  <Box sx={{ maxHeight: 420, overflowY: 'auto' }}>
                    {data.recent.map(event => (
                      <Box key={event._id} sx={{
                        display: 'flex', alignItems: 'flex-start', gap: 1.5, py: 1.25,
                        borderBottom: `1px solid ${tokens.surfaceBorder}`, '&:last-child': { borderBottom: 'none' }
                      }}>
                        <Box sx={{
                          width: 32, height: 32, borderRadius: 2, flexShrink: 0,
                          bgcolor: `${STATUS_COLORS[event.status] || tokens.primary}15`,
                          color: STATUS_COLORS[event.status] || tokens.primary,
                          display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>{toolIcon(event.tool)}</Box>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={600} noWrap>
                            {event.user ? `${event.user.firstName} ${event.user.lastName}` : 'Deleted user'}
                            <Typography component="span" variant="body2" sx={{ color: tokens.textSecondary, fontWeight: 400 }}>
                              {' '}— {ACTION_LABELS[event.action] || event.action} · {event.toolLabel}
                            </Typography>
                          </Typography>
                          <Typography variant="caption" sx={{ color: tokens.textMuted, display: 'block' }} noWrap>
                            {event.title || event.subject || '—'}
                            {event.status !== 'success' && ` · ${event.status}`}
                          </Typography>
                        </Box>
                        <Typography variant="caption" sx={{ color: tokens.textMuted, flexShrink: 0 }}>{timeAgo(event.createdAt)}</Typography>
                      </Box>
                    ))}
                  </Box>
                )}
              </Paper>
            </Grid>
          </>
        )}
      </Grid>

      {!compact && data.trend?.length > 1 && (
        <Paper elevation={0} sx={{ mt: 2.5, p: 2.5, borderRadius: 3, border: `1px solid ${tokens.surfaceBorder}`, bgcolor: 'white' }}>
          <SectionTitle>Daily Volume</SectionTitle>
          <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 0.5, height: 120, overflowX: 'auto', pb: 1 }}>
            {data.trend.map(point => {
              const max = Math.max(...data.trend.map(p => p.total), 1);
              return (
                <Tooltip key={point.date} title={`${point.date}: ${point.total} uses (${point.generated} generated, ${point.saved} saved)`}>
                  <Box sx={{ flex: '1 0 10px', minWidth: 10, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }}>
                    <Box sx={{
                      height: `${Math.max(3, (point.total / max) * 100)}%`,
                      bgcolor: tokens.primary, borderRadius: '4px 4px 0 0', opacity: 0.85
                    }} />
                  </Box>
                </Tooltip>
              );
            })}
          </Box>
          <LinearProgress variant="determinate" value={0} sx={{ height: 2, bgcolor: tokens.surfaceBorder, '& .MuiLinearProgress-bar': { bgcolor: tokens.surfaceBorder } }} />
          <Typography variant="caption" sx={{ color: tokens.textMuted, mt: 1, display: 'block' }}>
            {data.trend[0]?.date} → {data.trend[data.trend.length - 1]?.date}
          </Typography>
        </Paper>
      )}
    </Box>
  );
}
