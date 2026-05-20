import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Switch,
  FormControlLabel,
  Grid,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Autocomplete,
  InputAdornment,
  Tooltip
} from '@mui/material';
import { Check, X, Phone, Email, Person, Refresh, ContentCopy, Delete, Add, Edit, Visibility } from '@mui/icons-material';
import api from '../../services/api';

const MarketplaceManager = ({ exam }) => {
  const [settings, setSettings] = useState({
    isPubliclyListed: exam?.isPubliclyListed || false,
    publicPrice: exam?.publicPrice || 0,
    publicDescription: exam?.publicDescription || '',
    targetAudience: exam?.targetAudience || '',
    levelId: exam?.level?._id || null,
    subLevel: exam?.subLevel || ''
  });
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [rejectDialog, setRejectDialog] = useState({ open: false, requestId: null, notes: '' });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, requestId: null });
  const [levels, setLevels] = useState([]);
  const [loadingLevels, setLoadingLevels] = useState(false);
  const [newLevelDialog, setNewLevelDialog] = useState({ open: false, name: '', description: '', subLevels: [] });
  const [subLevelDialog, setSubLevelDialog] = useState({ open: false, levelId: null, name: '', description: '' });
  const [previewExam, setPreviewExam] = useState(null);
  const [previewDialog, setPreviewDialog] = useState(false);

  useEffect(() => {
    if (exam?._id) {
      fetchRequests();
      fetchLevels();
    }
  }, [exam]);

  // Update settings when exam prop changes
  useEffect(() => {
    setSettings({
      isPubliclyListed: exam?.isPubliclyListed || false,
      publicPrice: exam?.publicPrice || 0,
      publicDescription: exam?.publicDescription || '',
      targetAudience: exam?.targetAudience || '',
      levelId: exam?.level?._id || null,
      subLevel: exam?.subLevel || ''
    });
  }, [exam]);

  // Get available sub-levels for selected level
  const getAvailableSubLevels = () => {
    if (!settings.levelId) return [];
    const selectedLevel = levels.find(l => l._id === settings.levelId);
    return selectedLevel?.subLevels?.filter(s => s.isActive) || [];
  };

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/marketplace/exams/${exam._id}/requests`);
      setRequests(response.data);
    } catch (error) {
      console.error('Error fetching requests:', error);
      setMessage({ type: 'error', text: 'Failed to load requests' });
    } finally {
      setLoading(false);
    }
  };

  const fetchLevels = async () => {
    try {
      setLoadingLevels(true);
      const response = await api.get('/marketplace/levels');
      setLevels(response.data);
    } catch (error) {
      console.error('Error fetching levels:', error);
    } finally {
      setLoadingLevels(false);
    }
  };

  const handleCreateLevel = async () => {
    try {
      if (!newLevelDialog.name.trim()) {
        setMessage({ type: 'error', text: 'Level name is required' });
        return;
      }
      const response = await api.post('/marketplace/levels', {
        name: newLevelDialog.name.trim(),
        description: newLevelDialog.description.trim() || undefined
      });
      setLevels([...levels, response.data.level]);
      setSettings({ ...settings, levelId: response.data.level._id });
      setNewLevelDialog({ open: false, name: '', description: '', subLevels: [] });
      setMessage({ type: 'success', text: 'Level created successfully' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error creating level:', error);
      if (error.response?.data?.message === 'Level already exists') {
        // Level already exists, use the existing one
        setSettings({ ...settings, levelId: error.response.data.level._id });
        setNewLevelDialog({ open: false, name: '', description: '', subLevels: [] });
        setMessage({ type: 'success', text: 'Existing level selected' });
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to create level' });
      }
    }
  };

  const handleCreateSubLevel = async () => {
    try {
      if (!subLevelDialog.name.trim()) {
        setMessage({ type: 'error', text: 'Sub-level name is required' });
        return;
      }
      const response = await api.post(`/marketplace/levels/${subLevelDialog.levelId}/sublevels`, {
        name: subLevelDialog.name.trim(),
        description: subLevelDialog.description.trim() || undefined
      });
      // Update levels list with new sub-level
      setLevels(levels.map(level => 
        level._id === subLevelDialog.levelId 
          ? { ...level, subLevels: [...(level.subLevels || []), response.data.subLevel] }
          : level
      ));
      // Auto-select the new sub-level
      setSettings({ ...settings, subLevel: response.data.subLevel.name });
      setSubLevelDialog({ open: false, levelId: null, name: '', description: '' });
      setMessage({ type: 'success', text: 'Sub-level created successfully' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error creating sub-level:', error);
      if (error.response?.data?.message === 'Sub-level with this name already exists') {
        // Sub-level already exists, use it
        const existingLevel = levels.find(l => l._id === subLevelDialog.levelId);
        const existingSub = existingLevel?.subLevels?.find(
          s => s.name.toLowerCase() === subLevelDialog.name.trim().toLowerCase()
        );
        if (existingSub) {
          setSettings({ ...settings, subLevel: existingSub.name });
        }
        setSubLevelDialog({ open: false, levelId: null, name: '', description: '' });
        setMessage({ type: 'success', text: 'Existing sub-level selected' });
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to create sub-level' });
      }
    }
  };

  const handleSettingsChange = (field, value) => {
    setSettings({ ...settings, [field]: value });
  };

  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      // Find selected level name for creating new level if needed
      const selectedLevel = levels.find(l => l._id === settings.levelId);
      const payload = {
        ...settings,
        newLevelName: selectedLevel ? undefined : settings.targetAudience
      };
      await api.put(`/marketplace/exams/${exam._id}/settings`, payload);
      setMessage({ type: 'success', text: 'Settings saved successfully' });
      setTimeout(() => setMessage(null), 3000);
      // Refresh levels in case a new one was created
      fetchLevels();
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = () => {
    setPreviewExam({
      ...exam,
      ...settings,
      level: levels.find(l => l._id === settings.levelId)
    });
    setPreviewDialog(true);
  };

  const handleApprove = async (requestId, waivePayment = false) => {
    try {
      await api.put(`/marketplace/exam-requests/${requestId}/approve`, { waivePayment });
      setMessage({ type: 'success', text: 'Request approved successfully' });
      fetchRequests();
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error approving request:', error);
      setMessage({ type: 'error', text: 'Failed to approve request' });
    }
  };

  const handleRejectSubmit = async () => {
    try {
      await api.put(`/marketplace/exam-requests/${rejectDialog.requestId}/reject`, { 
        notes: rejectDialog.notes 
      });
      setMessage({ type: 'success', text: 'Request rejected successfully' });
      setRejectDialog({ open: false, requestId: null, notes: '' });
      fetchRequests();
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error rejecting request:', error);
      setMessage({ type: 'error', text: 'Failed to reject request' });
    }
  };

  const handleMarkPaymentReceived = async (requestId) => {
    try {
      await api.put(`/marketplace/exam-requests/${requestId}/payment`);
      setMessage({ type: 'success', text: 'Payment marked as received' });
      fetchRequests();
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error marking payment:', error);
      setMessage({ type: 'error', text: 'Failed to mark payment' });
    }
  };

  const handleResetAccess = async (requestId) => {
    try {
      await api.put(`/marketplace/exam-requests/${requestId}/reset`);
      setMessage({ type: 'success', text: 'Access link and code reset successfully' });
      fetchRequests();
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error resetting access:', error);
      setMessage({ type: 'error', text: 'Failed to reset access' });
    }
  };

  const handleDelete = async (requestId) => {
    try {
      await api.delete(`/marketplace/exam-requests/${requestId}`);
      setMessage({ type: 'success', text: 'Request deleted successfully' });
      setDeleteDialog({ open: false, requestId: null });
      fetchRequests();
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error deleting request:', error);
      setMessage({ type: 'error', text: 'Failed to delete request' });
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'warning';
      case 'approved': return 'success';
      case 'rejected': return 'error';
      default: return 'default';
    }
  };

  const getPaymentStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'warning';
      case 'paid': return 'success';
      case 'waived': return 'info';
      default: return 'default';
    }
  };

  return (
    <Box>
      <Typography variant="h6" fontWeight={700} sx={{ mb: 3 }}>
        🌐 Marketplace Settings
      </Typography>

      {message && (
        <Alert severity={message.type} sx={{ mb: 3 }}>
          {message.text}
        </Alert>
      )}

      {/* Settings Card */}
      <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid #e2e8f0', mb: 3 }}>
        <CardContent>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.isPubliclyListed}
                    onChange={(e) => handleSettingsChange('isPubliclyListed', e.target.checked)}
                    color="primary"
                  />
                }
                label="List exam publicly"
              />
              <Typography variant="body2" sx={{ color: '#64748b', ml: 4, mt: -1 }}>
                When enabled, users can request access to this exam without authentication
              </Typography>
            </Grid>

            {/* Level Selection */}
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel id="level-select-label">Level / Target Audience</InputLabel>
                <Select
                  labelId="level-select-label"
                  value={settings.levelId || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === 'create_new') {
                      setNewLevelDialog({ open: true, name: '', description: '', subLevels: [] });
                    } else {
                      handleSettingsChange('levelId', value);
                      handleSettingsChange('subLevel', ''); // Reset sub-level when level changes
                      // Update targetAudience to match level name
                      const selectedLevel = levels.find(l => l._id === value);
                      if (selectedLevel) {
                        handleSettingsChange('targetAudience', selectedLevel.name);
                      }
                    }
                  }}
                  label="Level / Target Audience"
                  sx={{ borderRadius: 2 }}
                  disabled={loadingLevels}
                  endAdornment={loadingLevels ? <CircularProgress size={20} sx={{ mr: 2 }} /> : null}
                >
                  <MenuItem value="">
                    <em>Select a level</em>
                  </MenuItem>
                  {levels.map((level) => (
                    <MenuItem key={level._id} value={level._id}>
                      {level.name}
                      {level.subLevels?.length > 0 && (
                        <Typography component="span" variant="caption" sx={{ ml: 1, color: '#0CBD73' }}>
                          ({level.subLevels.filter(s => s.isActive).length} sub-levels)
                        </Typography>
                      )}
                      {level.description && !level.subLevels?.length && (
                        <Typography component="span" variant="caption" sx={{ ml: 1, color: '#64748B' }}>
                          ({level.description})
                        </Typography>
                      )}
                    </MenuItem>
                  ))}
                  <MenuItem value="create_new" sx={{ color: '#0CBD73', fontWeight: 600 }}>
                    <Add sx={{ fontSize: 18, mr: 0.5 }} />
                    Create New Level
                  </MenuItem>
                </Select>
              </FormControl>
              <Typography variant="caption" sx={{ color: '#64748B', mt: 0.5, display: 'block' }}>
                Select an existing level or create a new one to avoid duplicates
              </Typography>
            </Grid>

            {/* Sub-Level Selection */}
            <Grid item xs={12} md={6}>
              <FormControl fullWidth disabled={!settings.levelId}>
                <InputLabel id="sublevel-select-label">Sub-Level (Optional)</InputLabel>
                <Select
                  labelId="sublevel-select-label"
                  value={settings.subLevel || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === 'create_new_sub') {
                      setSubLevelDialog({ open: true, levelId: settings.levelId, name: '', description: '' });
                    } else {
                      handleSettingsChange('subLevel', value);
                      // Update targetAudience to include sub-level
                      const selectedLevel = levels.find(l => l._id === settings.levelId);
                      if (selectedLevel && value) {
                        handleSettingsChange('targetAudience', `${selectedLevel.name} - ${value}`);
                      } else if (selectedLevel) {
                        handleSettingsChange('targetAudience', selectedLevel.name);
                      }
                    }
                  }}
                  label="Sub-Level (Optional)"
                  sx={{ borderRadius: 2 }}
                >
                  <MenuItem value="">
                    <em>{settings.levelId ? 'Select sub-level (optional)' : 'Select a level first'}</em>
                  </MenuItem>
                  {getAvailableSubLevels().map((subLevel) => (
                    <MenuItem key={subLevel._id} value={subLevel.name}>
                      {subLevel.name}
                      {subLevel.description && (
                        <Typography component="span" variant="caption" sx={{ ml: 1, color: '#64748B' }}>
                          ({subLevel.description})
                        </Typography>
                      )}
                    </MenuItem>
                  ))}
                  {settings.levelId && (
                    <MenuItem value="create_new_sub" sx={{ color: '#0CBD73', fontWeight: 600 }}>
                      <Add sx={{ fontSize: 18, mr: 0.5 }} />
                      Create New Sub-Level
                    </MenuItem>
                  )}
                </Select>
              </FormControl>
              <Typography variant="caption" sx={{ color: '#64748B', mt: 0.5, display: 'block' }}>
                Optional: Select or create a sub-level (e.g., P6 under Primary, S3 under Secondary)
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Price (optional)"
                type="number"
                value={settings.publicPrice}
                onChange={(e) => handleSettingsChange('publicPrice', parseFloat(e.target.value) || 0)}
                InputProps={{ startAdornment: 'RWF ' }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Public Description"
                multiline
                rows={3}
                value={settings.publicDescription}
                onChange={(e) => handleSettingsChange('publicDescription', e.target.value)}
                placeholder="Describe this exam for potential students..."
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />
            </Grid>
          </Grid>

          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
            <Button
              variant="outlined"
              onClick={handlePreview}
              startIcon={<Visibility />}
              sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
            >
              Preview
            </Button>
            <Button
              variant="contained"
              onClick={handleSaveSettings}
              disabled={saving}
              sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Requests Section */}
      {settings.isPubliclyListed && (
        <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid #e2e8f0' }}>
          <CardContent>
            <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
              Exam Requests ({requests.length})
            </Typography>

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : requests.length === 0 ? (
              <Typography sx={{ color: '#64748b', py: 4, textAlign: 'center' }}>
                No requests yet
              </Typography>
            ) : (
              <TableContainer component={Paper} elevation={0}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Requester</TableCell>
                      <TableCell>Phone</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Payment</TableCell>
                      <TableCell>Access Code</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {requests.map((request) => (
                      <TableRow key={request._id}>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Person fontSize="small" sx={{ color: '#64748b' }} />
                            {request.userInfo.name}
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Phone fontSize="small" sx={{ color: '#64748b' }} />
                            {request.userInfo.phone}
                          </Box>
                        </TableCell>
                        <TableCell>
                          {request.userInfo.email && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Email fontSize="small" sx={{ color: '#64748b' }} />
                              {request.userInfo.email}
                            </Box>
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={request.status}
                            size="small"
                            color={getStatusColor(request.status)}
                            sx={{ fontWeight: 600, textTransform: 'capitalize' }}
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={`${request.amount > 0 ? `RWF ${request.amount}` : 'Free'} - ${request.paymentStatus}`}
                            size="small"
                            color={getPaymentStatusColor(request.paymentStatus)}
                            sx={{ fontWeight: 600, textTransform: 'capitalize' }}
                          />
                        </TableCell>
                        <TableCell>
                          {request.status === 'approved' && request.accessCode ? (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography sx={{ fontWeight: 700, fontFamily: 'monospace', fontSize: '1.1rem', color: '#0D406C' }}>
                                {request.accessCode}
                              </Typography>
                              <IconButton
                                size="small"
                                onClick={() => {
                                  navigator.clipboard.writeText(request.accessCode);
                                  setMessage({ type: 'success', text: 'Code copied to clipboard' });
                                  setTimeout(() => setMessage(null), 2000);
                                }}
                                title="Copy Code"
                              >
                                <ContentCopy fontSize="small" />
                              </IconButton>
                            </Box>
                          ) : (
                            <Typography sx={{ color: '#94a3b8', fontSize: 14 }}>-</Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          {request.status === 'pending' && (
                            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                              {request.amount > 0 && request.paymentStatus === 'pending' && (
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={() => handleMarkPaymentReceived(request._id)}
                                  sx={{ borderRadius: 2, textTransform: 'none' }}
                                >
                                  Mark Paid
                                </Button>
                              )}
                              <IconButton
                                size="small"
                                color="success"
                                onClick={() => handleApprove(request._id, false)}
                                title="Approve"
                              >
                                <Check />
                              </IconButton>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => setRejectDialog({ open: true, requestId: request._id, notes: '' })}
                                title="Reject"
                              >
                                <X />
                              </IconButton>
                            </Box>
                          )}
                          {request.status === 'approved' && request.shareToken && (
                            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => {
                                  navigator.clipboard.writeText(
                                    `${window.location.origin}/exam/${request.shareToken}`
                                  );
                                  setMessage({ type: 'success', text: 'Link copied to clipboard' });
                                  setTimeout(() => setMessage(null), 2000);
                                }}
                                sx={{ borderRadius: 2, textTransform: 'none' }}
                              >
                                Copy Link
                              </Button>
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => handleResetAccess(request._id)}
                                title="Reset Link & Code"
                              >
                                <Refresh />
                              </IconButton>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => setDeleteDialog({ open: true, requestId: request._id })}
                                title="Delete"
                              >
                                <Delete />
                              </IconButton>
                            </Box>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>
      )}

      {/* Reject Dialog */}
      <Dialog open={rejectDialog.open} onClose={() => setRejectDialog({ open: false, requestId: null, notes: '' })}>
        <DialogTitle>Reject Request</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Reason for rejection (optional)"
            value={rejectDialog.notes}
            onChange={(e) => setRejectDialog({ ...rejectDialog, notes: e.target.value })}
            sx={{ mt: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectDialog({ open: false, requestId: null, notes: '' })}>
            Cancel
          </Button>
          <Button onClick={handleRejectSubmit} variant="contained" color="error">
            Reject
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog.open} onClose={() => setDeleteDialog({ open: false, requestId: null })}>
        <DialogTitle>Delete Request</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this request? This will also remove the associated exam access link.
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, requestId: null })}>
            Cancel
          </Button>
          <Button onClick={() => handleDelete(deleteDialog.requestId)} variant="contained" color="error">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create New Level Dialog */}
      <Dialog open={newLevelDialog.open} onClose={() => setNewLevelDialog({ open: false, name: '', description: '', subLevels: [] })} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Level</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Create a new level that will be available for all exams. This helps avoid duplicate level names.
          </Typography>
          <TextField
            fullWidth
            label="Level Name"
            value={newLevelDialog.name}
            onChange={(e) => setNewLevelDialog({ ...newLevelDialog, name: e.target.value })}
            placeholder="e.g., Primary, Secondary, University, etc."
            sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            autoFocus
          />
          <TextField
            fullWidth
            label="Description (optional)"
            value={newLevelDialog.description}
            onChange={(e) => setNewLevelDialog({ ...newLevelDialog, description: e.target.value })}
            placeholder="Brief description of this level..."
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
            Tip: You can add sub-levels (like P1-P6, S1-S6) after creating this level.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewLevelDialog({ open: false, name: '', description: '', subLevels: [] })}>
            Cancel
          </Button>
          <Button onClick={handleCreateLevel} variant="contained" sx={{ borderRadius: 2 }}>
            Create Level
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create New Sub-Level Dialog */}
      <Dialog open={subLevelDialog.open} onClose={() => setSubLevelDialog({ open: false, levelId: null, name: '', description: '' })} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Sub-Level</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Create a new sub-level under {' '}
            <strong>{levels.find(l => l._id === subLevelDialog.levelId)?.name}</strong>.
            {' '}Examples: P1, P2, P3... or S1, S2, S3...
          </Typography>
          <TextField
            fullWidth
            label="Sub-Level Name"
            value={subLevelDialog.name}
            onChange={(e) => setSubLevelDialog({ ...subLevelDialog, name: e.target.value })}
            placeholder="e.g., P6, S3, Year 1, etc."
            sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            autoFocus
          />
          <TextField
            fullWidth
            label="Description (optional)"
            value={subLevelDialog.description}
            onChange={(e) => setSubLevelDialog({ ...subLevelDialog, description: e.target.value })}
            placeholder="Brief description of this sub-level..."
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSubLevelDialog({ open: false, levelId: null, name: '', description: '' })}>
            Cancel
          </Button>
          <Button onClick={handleCreateSubLevel} variant="contained" sx={{ borderRadius: 2 }}>
            Create Sub-Level
          </Button>
        </DialogActions>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewDialog} onClose={() => setPreviewDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Exam Preview</DialogTitle>
        <DialogContent>
          <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid #e2e8f0', p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
              <Chip
                label="Public Exam"
                size="small"
                sx={{
                  background: 'linear-gradient(135deg, #0CBD73 0%, #5AD5A2 100%)',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: 11,
                  letterSpacing: '0.04em'
                }}
              />
              {(previewExam?.level || previewExam?.targetAudience || previewExam?.subLevel) && (
                <Chip
                  label={previewExam?.subLevel 
                    ? `${previewExam?.level?.name || previewExam?.targetAudience} - ${previewExam?.subLevel}`
                    : (previewExam?.level?.name || previewExam?.targetAudience)}
                  size="small"
                  sx={{
                    background: 'rgba(13,71,161,0.1)',
                    color: '#0D406C',
                    fontWeight: 600,
                    fontSize: 11
                  }}
                />
              )}
            </Box>

            <Typography variant="h5" fontWeight={700} sx={{ mb: 1.5, color: '#0F172A' }}>
              {previewExam?.title}
            </Typography>

            <Typography variant="body2" sx={{ color: '#64748B', mb: 2 }}>
              {previewExam?.publicDescription || previewExam?.description}
            </Typography>

            <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
              <Chip
                icon={<Box component="span" sx={{ fontSize: 14 }}>Q</Box>}
                label={`${previewExam?.sections?.reduce((sum, s) => sum + (s.questions?.length || 0), 0) || 0} Questions`}
                size="small"
                variant="outlined"
              />
              <Chip
                label={`${previewExam?.timeLimit} minutes`}
                size="small"
                variant="outlined"
              />
              {previewExam?.publicPrice > 0 && (
                <Chip
                  label={`RWF ${previewExam?.publicPrice?.toLocaleString()}`}
                  size="small"
                  color="warning"
                  variant="outlined"
                />
              )}
            </Box>

            {previewExam?.publicPrice > 0 && (
              <Box sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                p: 1.5,
                borderRadius: 2.5,
                background: 'rgba(245,158,11,0.08)',
                border: '1px solid rgba(245,158,11,0.2)',
                mb: 2
              }}>
                <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#64748B' }}>Price</Typography>
                <Typography sx={{ fontSize: 16, fontWeight: 700, color: '#F59E0B' }}>
                  RWF {previewExam?.publicPrice?.toLocaleString()}
                </Typography>
              </Box>
            )}

            <Button
              fullWidth
              variant="contained"
              disabled
              sx={{
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 700,
                background: 'linear-gradient(135deg, #0D406C 0%, #0CBD73 100%)'
              }}
            >
              Request Access
            </Button>
          </Card>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewDialog(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MarketplaceManager;
