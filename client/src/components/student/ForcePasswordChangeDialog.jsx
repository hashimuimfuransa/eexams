import { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
  Typography, Alert, IconButton, InputAdornment, CircularProgress
} from '@mui/material';
import { Visibility, VisibilityOff, LockReset } from '@mui/icons-material';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

// Shown in the student area to anyone still signed in with the password their
// teacher gave them. It can't be dismissed — only completed, or logged out of.
// StudentRoutes keeps it off the exam screens, so a student who opens an exam
// link goes straight into the exam and sets their own password afterwards.
const ForcePasswordChangeDialog = () => {
  const { user, logout, markPasswordChanged } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 6) { setError('Your new password must be at least 6 characters long.'); return; }
    if (password !== confirm) { setError('The two passwords do not match.'); return; }
    setSaving(true);
    setError('');
    try {
      await api.put('/auth/change-password', { newPassword: password });
      markPasswordChanged();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not change your password. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open maxWidth="xs" fullWidth PaperProps={{ component: 'form', onSubmit: handleSubmit, sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
        <LockReset color="primary" /> Choose your own password
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Hi {user?.firstName || 'there'}, you signed in with the password your teacher gave you.
          Pick a new one that only you know — you will use it the next time you log in.
        </Typography>
        {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}
        <TextField
          fullWidth
          autoFocus
          label="New password"
          type={show ? 'text' : 'password'}
          value={password}
          onChange={e => setPassword(e.target.value)}
          autoComplete="new-password"
          helperText="At least 6 characters"
          sx={{ mb: 2 }}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton onClick={() => setShow(s => !s)} edge="end" aria-label={show ? 'Hide password' : 'Show password'}>
                  {show ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            )
          }}
        />
        <TextField
          fullWidth
          label="Confirm new password"
          type={show ? 'text' : 'password'}
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          autoComplete="new-password"
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, justifyContent: 'space-between' }}>
        <Button onClick={logout} disabled={saving} sx={{ textTransform: 'none' }}>Log out</Button>
        <Button
          type="submit"
          variant="contained"
          disabled={saving || !password || !confirm}
          sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
        >
          {saving ? <CircularProgress size={18} color="inherit" /> : 'Save password'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ForcePasswordChangeDialog;
