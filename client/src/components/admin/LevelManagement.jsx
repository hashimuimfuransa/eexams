import { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Chip,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
  CircularProgress,
  Switch,
  FormControlLabel
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  School,
  Save,
  Cancel
} from '@mui/icons-material';
import api from '../../services/api';

const LevelManagement = () => {
  const [levels, setLevels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLevel, setEditingLevel] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    displayOrder: 0,
    isActive: true,
    subLevels: []
  });
  const [newSubLevelName, setNewSubLevelName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchLevels();
  }, []);

  const fetchLevels = async () => {
    try {
      setLoading(true);
      const response = await api.get('/levels');
      setLevels(response.data || []);
    } catch (err) {
      console.error('Error fetching levels:', err);
      setError('Failed to load levels');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (level = null) => {
    if (level) {
      setEditingLevel(level);
      setFormData({
        name: level.name,
        description: level.description || '',
        displayOrder: level.displayOrder || 0,
        isActive: level.isActive !== false,
        subLevels: level.subLevels || []
      });
    } else {
      setEditingLevel(null);
      setFormData({
        name: '',
        description: '',
        displayOrder: 0,
        isActive: true,
        subLevels: []
      });
    }
    setNewSubLevelName('');
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingLevel(null);
    setNewSubLevelName('');
  };

  const handleAddSubLevel = () => {
    const name = newSubLevelName.trim();
    if (!name) return;
    if (formData.subLevels.some(s => s.name.toLowerCase() === name.toLowerCase())) {
      setError('A sub-level with this name already exists');
      return;
    }
    setFormData(prev => ({
      ...prev,
      subLevels: [...prev.subLevels, { name, isActive: true, displayOrder: prev.subLevels.length }]
    }));
    setNewSubLevelName('');
  };

  const handleRemoveSubLevel = (index) => {
    setFormData(prev => ({
      ...prev,
      subLevels: prev.subLevels.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      setError(null);

      if (editingLevel) {
        await api.put(`/levels/${editingLevel._id}`, formData);
      } else {
        await api.post('/levels', formData);
      }

      await fetchLevels();
      handleCloseDialog();
    } catch (err) {
      console.error('Error saving level:', err);
      setError(err.response?.data?.message || 'Failed to save level');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (levelId) => {
    if (!window.confirm('Are you sure you want to delete this level?')) return;

    try {
      await api.delete(`/levels/${levelId}`);
      await fetchLevels();
    } catch (err) {
      console.error('Error deleting level:', err);
      setError(err.response?.data?.message || 'Failed to delete level');
    }
  };

  const handleToggleStatus = async (level) => {
    try {
      await api.patch(`/levels/${level._id}/status`, { isActive: !level.isActive });
      await fetchLevels();
    } catch (err) {
      console.error('Error updating level status:', err);
      setError('Failed to update level status');
    }
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, textAlign: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 8 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <School color="primary" />
          Level Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => handleOpenDialog()}
        >
          Add Level
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <TableContainer component={Paper} elevation={3}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Sub-Levels</TableCell>
              <TableCell>Order</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Usage Count</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {levels.map((level) => (
              <TableRow key={level._id}>
                <TableCell>
                  <Typography fontWeight="bold">{level.name}</Typography>
                </TableCell>
                <TableCell>{level.description || '-'}</TableCell>
                <TableCell>
                  {level.subLevels?.length > 0
                    ? <Chip label={`${level.subLevels.length} sub-level${level.subLevels.length === 1 ? '' : 's'}`} size="small" variant="outlined" />
                    : '-'}
                </TableCell>
                <TableCell>{level.displayOrder || 0}</TableCell>
                <TableCell>
                  <Chip
                    label={level.isActive ? 'Active' : 'Inactive'}
                    color={level.isActive ? 'success' : 'default'}
                    size="small"
                  />
                </TableCell>
                <TableCell>{level.usageCount || 0}</TableCell>
                <TableCell align="right">
                  <IconButton onClick={() => handleOpenDialog(level)} size="small">
                    <Edit />
                  </IconButton>
                  <IconButton onClick={() => handleToggleStatus(level)} size="small">
                    <Switch checked={level.isActive !== false} />
                  </IconButton>
                  <IconButton onClick={() => handleDelete(level._id)} size="small" color="error">
                    <Delete />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingLevel ? 'Edit Level' : 'Add New Level'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              label="Level Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              sx={{ mb: 2 }}
              required
            />
            <TextField
              fullWidth
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              sx={{ mb: 2 }}
              multiline
              rows={3}
            />
            <TextField
              fullWidth
              label="Display Order"
              type="number"
              value={formData.displayOrder}
              onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value) || 0 })}
              sx={{ mb: 2 }}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                />
              }
              label="Active"
            />

            <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                Sub-Levels (optional)
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                e.g. P1–P6 under Primary, S1–S6 under Secondary. Leave empty if this level has no sub-divisions.
              </Typography>

              {formData.subLevels.length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
                  {formData.subLevels.map((sub, idx) => (
                    <Chip
                      key={sub._id || idx}
                      label={sub.name}
                      onDelete={() => handleRemoveSubLevel(idx)}
                      size="small"
                    />
                  ))}
                </Box>
              )}

              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Sub-level name (e.g. P6)"
                  value={newSubLevelName}
                  onChange={(e) => setNewSubLevelName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddSubLevel();
                    }
                  }}
                />
                <Button variant="outlined" onClick={handleAddSubLevel} startIcon={<Add />}>
                  Add
                </Button>
              </Box>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} startIcon={<Cancel />}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            startIcon={<Save />}
            disabled={submitting || !formData.name}
          >
            {submitting ? <CircularProgress size={20} /> : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default LevelManagement;
