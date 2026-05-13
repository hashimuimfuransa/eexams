import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Paper, Typography, TextField, Button, CircularProgress } from '@mui/material';
import api from '../services/api';

const PublicExamAccess = () => {
  const { shareToken } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [exam, setExam] = useState(null);
  const [error, setError] = useState(null);
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    console.log('PublicExamAccess component mounted with shareToken:', shareToken);
    
    if (!shareToken) {
      console.error('No shareToken provided');
      setError('Invalid share link');
      setLoading(false);
      return;
    }

    console.log('Fetching exam data from /share/' + shareToken);
    api.get(`/share/${shareToken}`)
      .then(r => {
        setExam(r.data);
        if (r.data.shareData?.settings?.requirePassword) {
          setPasswordRequired(true);
        }
        // Don't automatically join - let user click the button
      })
      .catch(err => {
        console.error('Error loading exam:', err);
        console.error('Error status:', err.response?.status);
        console.error('Error data:', err.response?.data);
        setError(err.response?.data?.message || 'Could not load exam. The link may have expired or been removed.');
      })
      .finally(() => {
        console.log('Finished loading exam data');
        setLoading(false);
      });
  }, [shareToken]);

  const handleJoin = async (pwd = null) => {
    setJoining(true);
    try {
      const res = await api.post(`/share/${shareToken}/join`, { 
        email: email.trim() || undefined,
        name: name.trim() || undefined,
        password: pwd 
      });
      
      // Store the exam session in localStorage for public access
      if (res.data) {
        localStorage.setItem('publicExamSession', JSON.stringify({
          shareToken,
          studentId: res.data.studentId,
          exam: res.data.exam,
          settings: res.data.settings,
          joinedAt: new Date().toISOString()
        }));
      }
      
      // Redirect to exam taking page
      if (res.data?.resultId) {
        navigate(`/student/exam/${res.data.resultId}`);
      } else {
        // Navigate to public exam page (will be created)
        navigate(`/exam/${shareToken}`);
      }
    } catch (err) {
      console.error('Error joining exam:', err);
      setError(err.response?.data?.message || 'Failed to join exam');
    } finally {
      setJoining(false);
    }
  };

  const handlePasswordSubmit = async () => {
    if (!password.trim()) {
      setError('Please enter the password');
      return;
    }
    await handleJoin(password);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', bgcolor: '#F1F5F9' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', bgcolor: '#F1F5F9', p: 2 }}>
        <Paper elevation={0} sx={{ p: 4, borderRadius: 3, maxWidth: 500, textAlign: 'center', border: '1px solid #e2e8f0' }}>
          <Typography variant="h5" fontWeight={700} sx={{ mb: 1, color: '#EF4444' }}>
            ⚠️ Unable to Access Exam
          </Typography>
          <Typography sx={{ color: '#64748b', mb: 3 }}>
            {error}
          </Typography>
          <Button variant="contained" onClick={() => navigate('/')} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}>
            Go to Home
          </Button>
        </Paper>
      </Box>
    );
  }

  if (passwordRequired) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', bgcolor: '#F1F5F9', p: 2 }}>
        <Paper elevation={0} sx={{ p: 4, borderRadius: 3, maxWidth: 400, border: '1px solid #e2e8f0' }}>
          <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
            🔒 Password Protected
          </Typography>
          <Typography sx={{ color: '#64748b', mb: 3, fontSize: 14 }}>
            This exam requires a password to access. Please enter it below.
          </Typography>
          <TextField
            fullWidth
            type="password"
            label="Exam Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && handlePasswordSubmit()}
            disabled={joining}
            sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />
          <Button
            fullWidth
            variant="contained"
            onClick={handlePasswordSubmit}
            disabled={joining || !password.trim()}
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
          >
            {joining ? 'Verifying…' : 'Access Exam'}
          </Button>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', bgcolor: '#F1F5F9', p: 2 }}>
      <Paper elevation={0} sx={{ p: 4, borderRadius: 3, maxWidth: 500, border: '1px solid #e2e8f0' }}>
        <Typography variant="h5" fontWeight={700} sx={{ mb: 1 }}>
          {exam?.exam?.title || 'Exam'}
        </Typography>
        <Typography sx={{ color: '#64748b', mb: 3, fontSize: 14 }}>
          {exam?.exam?.description || 'You are about to take an exam'}
        </Typography>
        
        <Box sx={{ bgcolor: '#F8FAFC', p: 2, borderRadius: 2, mb: 3 }}>
          <Typography sx={{ fontSize: 13, color: '#475569' }}>
            <strong>Questions:</strong> {exam?.exam?.sections?.reduce((sum, s) => sum + (s.questions?.length || 0), 0) || 0}
          </Typography>
          <Typography sx={{ fontSize: 13, color: '#475569' }}>
            <strong>Time Limit:</strong> {exam?.exam?.timeLimit || 0} minutes
          </Typography>
        </Box>

        <TextField
          fullWidth
          label="Full Name (Optional)"
          value={name}
          onChange={e => setName(e.target.value)}
          sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
        />
        
        <TextField
          fullWidth
          label="Email Address (Optional)"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          sx={{ mb: 3, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
        />

        <Button
          fullWidth
          variant="contained"
          onClick={() => handleJoin()}
          disabled={joining}
          sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, py: 1.5 }}
        >
          {joining ? 'Starting…' : 'Start Exam'}
        </Button>
      </Paper>
    </Box>
  );
};

export default PublicExamAccess;
