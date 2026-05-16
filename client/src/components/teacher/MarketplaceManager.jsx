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
  IconButton
} from '@mui/material';
import { Check, X, Phone, Email, Person, Refresh, ContentCopy } from '@mui/icons-material';
import api from '../../services/api';

const MarketplaceManager = ({ exam }) => {
  const [settings, setSettings] = useState({
    isPubliclyListed: exam?.isPubliclyListed || false,
    publicPrice: exam?.publicPrice || 0,
    publicDescription: exam?.publicDescription || ''
  });
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [rejectDialog, setRejectDialog] = useState({ open: false, requestId: null, notes: '' });

  useEffect(() => {
    if (exam?._id) {
      fetchRequests();
    }
  }, [exam]);

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

  const handleSettingsChange = (field, value) => {
    setSettings({ ...settings, [field]: value });
  };

  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      await api.put(`/marketplace/exams/${exam._id}/settings`, settings);
      setMessage({ type: 'success', text: 'Settings saved successfully' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
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

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Target Audience / Level"
                value={settings.targetAudience || ''}
                onChange={(e) => handleSettingsChange('targetAudience', e.target.value)}
                placeholder="e.g., P6, S3, University, etc."
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />
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

          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
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
    </Box>
  );
};

export default MarketplaceManager;
