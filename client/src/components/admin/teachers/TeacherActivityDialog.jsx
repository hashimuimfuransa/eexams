// What one teacher actually did (GET /api/superadmin/teachers/:id/activity).
//
// Two timelines, two tabs, because they answer different questions and are
// recorded by different systems:
//   • Teacher Tools — every AI draft, save, download and refusal from
//     ToolUsage, including the drafts that were never saved.
//   • Audit Log — the ActivityLog trail (signed in, created an exam, added a
//     student).
// Tools open first: "did this teacher use what they are paying for?" is the
// question this dialog is opened to answer.
import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Dialog, DialogTitle, DialogContent, DialogActions, Button,
  IconButton, CircularProgress, Grid, Paper, Chip, Tabs, Tab, Tooltip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Avatar
} from '@mui/material';
import {
  Close, AutoAwesome, SaveAlt, Download, Block, ErrorOutline, DraftsOutlined,
  School, Edit
} from '@mui/icons-material';
import api from '../../../services/api';
import { tokens } from '../../../pages/dashboardTokens';
import { ToolStatTile, toolIcon, timeAgo, ACTION_LABELS, STATUS_COLORS } from '../ToolUsagePanel';

const PERIODS = [
  { id: '7d', label: '7 Days' },
  { id: '30d', label: '30 Days' },
  { id: '90d', label: '90 Days' },
  { id: '1y', label: '1 Year' },
  { id: 'all', label: 'All Time' }
];

const fmtDuration = (ms) => (!ms ? '' : ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`);

export default function TeacherActivityDialog({ open, teacher, onClose }) {
  const [tab, setTab] = useState(0);
  const [period, setPeriod] = useState('30d');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!teacher?._id) return;
    setLoading(true);
    try {
      const res = await api.get(`/superadmin/teachers/${teacher._id}/activity?period=${period}&limit=100`);
      setData(res.data);
    } catch (err) {
      console.error('Fetch activity error:', err);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [teacher?._id, period]);

  useEffect(() => { if (open) load(); }, [open, load]);

  // Fresh dialog every time: a stale period or tab from the last teacher is
  // confusing when the numbers change underneath it.
  useEffect(() => { if (open) { setTab(0); setPeriod('30d'); } }, [open, teacher?._id]);

  const usage = data?.toolUsage;
  const totals = usage?.totals || {};

  const tiles = [
    { icon: <AutoAwesome sx={{ fontSize: 20 }} />, value: totals.total ?? 0, label: 'Tool uses', color: tokens.primary },
    { icon: <DraftsOutlined sx={{ fontSize: 20 }} />, value: totals.generated ?? 0, label: 'AI generations', sub: 'saved or not', color: '#6366F1' },
    { icon: <SaveAlt sx={{ fontSize: 20 }} />, value: totals.saved ?? 0, label: 'Saved', sub: `${totals.saveRate ?? 0}% of generations`, color: tokens.accentDark },
    { icon: <DraftsOutlined sx={{ fontSize: 20 }} />, value: totals.unsaved ?? 0, label: 'Never saved', color: tokens.warning },
    { icon: <Download sx={{ fontSize: 20 }} />, value: totals.exported ?? 0, label: 'Downloads', color: tokens.primary },
    { icon: <Edit sx={{ fontSize: 20 }} />, value: totals.updated ?? 0, label: 'Edits', color: '#6366F1' },
    { icon: <School sx={{ fontSize: 20 }} />, value: data?.examsCreated ?? 0, label: 'Exams created', color: tokens.accent },
    { icon: <Block sx={{ fontSize: 20 }} />, value: totals.blocked ?? 0, label: 'Blocked by limits', color: tokens.warning }
  ];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar sx={{ width: 40, height: 40, bgcolor: `${tokens.accent}18`, color: tokens.accentDark, fontWeight: 700 }}>
            {teacher?.firstName?.charAt(0)}
          </Avatar>
          <Box>
            <Typography variant="h6" sx={{ fontFamily: "'DM Sans',sans-serif" }}>
              {teacher ? `${teacher.firstName} ${teacher.lastName}` : 'Teacher activity'}
            </Typography>
            <Typography variant="caption" sx={{ color: tokens.textMuted }}>
              {teacher?.email}{teacher?.organization ? ` · ${teacher.organization}` : ''}
            </Typography>
          </Box>
        </Box>
        <IconButton onClick={onClose}><Close /></IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
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

        <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ mb: 2, borderBottom: `1px solid ${tokens.surfaceBorder}` }}>
          <Tab label={`Teacher Tools${usage ? ` (${totals.total ?? 0})` : ''}`} sx={{ textTransform: 'none', fontWeight: 700 }} />
          <Tab label={`Audit Log${data ? ` (${data.totalActivities ?? 0})` : ''}`} sx={{ textTransform: 'none', fontWeight: 700 }} />
        </Tabs>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress sx={{ color: tokens.accent }} />
          </Box>
        ) : !data ? (
          <Paper elevation={0} sx={{ p: 4, borderRadius: 2, border: `1px dashed ${tokens.surfaceBorder}`, bgcolor: '#FAFBFC', textAlign: 'center' }}>
            <Typography sx={{ color: tokens.textMuted }}>Failed to load activity data.</Typography>
          </Paper>
        ) : tab === 0 ? (
          <Box>
            <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
              {tiles.map((tile, i) => (
                <Grid item xs={6} sm={3} key={i}><ToolStatTile {...tile} /></Grid>
              ))}
            </Grid>

            {usage?.byTool?.length > 0 && (
              <Paper elevation={0} sx={{ mb: 2.5, borderRadius: 2, border: `1px solid ${tokens.surfaceBorder}`, overflow: 'hidden' }}>
                <TableContainer sx={{ overflowX: 'auto' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                        {['Tool', 'Uses', 'Generated', 'Saved', 'Not saved', 'Downloads', 'Blocked', 'Failed', 'Last used'].map(h => (
                          <TableCell key={h} sx={{ fontWeight: 700, color: tokens.textSecondary, fontSize: 12, whiteSpace: 'nowrap' }}>{h}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {usage.byTool.map(row => (
                        <TableRow key={row.tool}>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Box sx={{ color: tokens.primary, display: 'flex' }}>{toolIcon(row.tool)}</Box>
                              <Typography variant="body2" fontWeight={600}>{row.label}</Typography>
                            </Box>
                          </TableCell>
                          <TableCell>{row.total}</TableCell>
                          <TableCell><Typography variant="body2" fontWeight={700} sx={{ color: tokens.primary }}>{row.generated}</Typography></TableCell>
                          <TableCell><Typography variant="body2" fontWeight={700} sx={{ color: tokens.accentDark }}>{row.saved}</Typography></TableCell>
                          <TableCell><Typography variant="body2" fontWeight={700} sx={{ color: row.unsaved ? tokens.warning : tokens.textMuted }}>{row.unsaved}</Typography></TableCell>
                          <TableCell>{row.exported}</TableCell>
                          <TableCell>{row.blocked || '—'}</TableCell>
                          <TableCell>{row.failed || '—'}</TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap', color: tokens.textMuted, fontSize: 12 }}>{timeAgo(row.lastUsed)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            )}

            <Typography variant="body2" fontWeight={700} sx={{ mb: 1.5, color: tokens.textSecondary }}>Tool Timeline</Typography>
            {!usage?.events?.length ? (
              <Paper elevation={0} sx={{ p: 4, borderRadius: 2, border: `1px dashed ${tokens.surfaceBorder}`, bgcolor: '#FAFBFC', textAlign: 'center' }}>
                <Typography sx={{ color: tokens.textMuted }}>
                  This teacher has not used any teacher tools in this period.
                </Typography>
              </Paper>
            ) : (
              <Box sx={{ maxHeight: 380, overflowY: 'auto', border: `1px solid ${tokens.surfaceBorder}`, borderRadius: 2 }}>
                {usage.events.map(event => (
                  <Box key={event._id} sx={{
                    display: 'flex', alignItems: 'flex-start', gap: 1.5, p: 1.5,
                    borderBottom: `1px solid ${tokens.surfaceBorder}`, '&:last-child': { borderBottom: 'none' }
                  }}>
                    <Box sx={{
                      width: 34, height: 34, borderRadius: 2, flexShrink: 0,
                      bgcolor: `${STATUS_COLORS[event.status] || tokens.primary}15`,
                      color: STATUS_COLORS[event.status] || tokens.primary,
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>{toolIcon(event.tool)}</Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Typography variant="body2" fontWeight={600}>
                          {ACTION_LABELS[event.action] || event.action} · {event.toolLabel}
                        </Typography>
                        {event.format && (
                          <Chip size="small" label={event.format.toUpperCase()} sx={{ height: 18, fontSize: 10, fontWeight: 700, bgcolor: '#EEF2F6', color: tokens.textSecondary }} />
                        )}
                        {event.status !== 'success' && (
                          <Chip
                            size="small"
                            label={event.status === 'blocked' ? 'Blocked by plan limit' : 'Failed'}
                            sx={{
                              height: 18, fontSize: 10, fontWeight: 700,
                              bgcolor: `${STATUS_COLORS[event.status]}15`, color: STATUS_COLORS[event.status]
                            }}
                          />
                        )}
                        {/* A save event carries a resource id; a generation that
                            never became one is the unsaved work this view is for. */}
                        {event.action === 'generate' && !event.resource && (
                          <Chip size="small" label="Draft only" sx={{ height: 18, fontSize: 10, fontWeight: 700, bgcolor: 'rgba(245,158,11,0.12)', color: tokens.warning }} />
                        )}
                      </Box>
                      <Typography variant="caption" sx={{ color: tokens.textMuted, display: 'block' }}>
                        {event.title || '—'}
                        {event.subject ? ` · ${event.subject}` : ''}
                        {event.className ? ` · ${event.className}` : ''}
                        {event.meta?.error ? ` · ${event.meta.error}` : ''}
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                      <Tooltip title={new Date(event.createdAt).toLocaleString()}>
                        <Typography variant="caption" sx={{ color: tokens.textMuted, display: 'block' }}>{timeAgo(event.createdAt)}</Typography>
                      </Tooltip>
                      {event.durationMs > 0 && (
                        <Typography variant="caption" sx={{ color: tokens.textMuted, fontSize: 10 }}>{fmtDuration(event.durationMs)}</Typography>
                      )}
                    </Box>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        ) : (
          <Box>
            <Paper elevation={0} sx={{ p: 2, mb: 2.5, borderRadius: 2, bgcolor: '#F8FAFC' }}>
              <Typography variant="body2" fontWeight={600} sx={{ mb: 1.5, color: tokens.textMuted }}>
                Activity Summary ({data.totalActivities} activities)
              </Typography>
              {Object.keys(data.summary || {}).length === 0 ? (
                <Typography variant="caption" sx={{ color: tokens.textMuted }}>No logged actions in this period.</Typography>
              ) : (
                <Grid container spacing={1}>
                  {Object.entries(data.summary).map(([action, count]) => (
                    <Grid item xs={6} md={4} key={action}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, p: 1, bgcolor: 'white', borderRadius: 1.5, border: `1px solid ${tokens.surfaceBorder}` }}>
                        <Typography variant="caption" fontWeight={700} sx={{ color: tokens.primary }}>{count}</Typography>
                        <Typography variant="caption" sx={{ color: tokens.textMuted, textTransform: 'capitalize' }}>{action.replace(/_/g, ' ')}</Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              )}
            </Paper>

            {!data.activities?.length ? (
              <Paper elevation={0} sx={{ p: 4, borderRadius: 2, border: `1px dashed ${tokens.surfaceBorder}`, bgcolor: '#FAFBFC', textAlign: 'center' }}>
                <Typography sx={{ color: tokens.textMuted }}>No activities found in this period.</Typography>
              </Paper>
            ) : (
              <Box sx={{ maxHeight: 420, overflowY: 'auto', border: `1px solid ${tokens.surfaceBorder}`, borderRadius: 2 }}>
                {data.activities.map((activity, index) => (
                  <Box key={activity._id || index} sx={{
                    display: 'flex', alignItems: 'center', gap: 2, p: 1.5,
                    borderBottom: `1px solid ${tokens.surfaceBorder}`, '&:last-child': { borderBottom: 'none' }
                  }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2" fontWeight={600} sx={{ textTransform: 'capitalize' }}>
                        {activity.action.replace(/_/g, ' ')}
                      </Typography>
                      {activity.details?.examTitle && (
                        <Typography variant="caption" sx={{ color: tokens.textMuted, display: 'block' }}>{activity.details.examTitle}</Typography>
                      )}
                      {activity.details?.studentName && (
                        <Typography variant="caption" sx={{ color: tokens.textMuted, display: 'block' }}>{activity.details.studentName}</Typography>
                      )}
                    </Box>
                    <Tooltip title={new Date(activity.timestamp).toLocaleString()}>
                      <Typography variant="caption" sx={{ color: tokens.textMuted }}>{timeAgo(activity.timestamp)}</Typography>
                    </Tooltip>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} sx={{ textTransform: 'none' }}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
