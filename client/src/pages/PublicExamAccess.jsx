import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Box, Paper, Typography, TextField, Button, CircularProgress, Alert } from '@mui/material';
import api from '../services/api';
import { AuthContext } from '../context/AuthContext';

const PublicExamAccess = () => {
  const { shareToken } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, login } = useContext(AuthContext);
  const [loading, setLoading] = useState(true);
  const [exam, setExam] = useState(null);
  const [error, setError] = useState(null);
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [joining, setJoining] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [postLoginLoading, setPostLoginLoading] = useState(false);
  const isPrivateMode = searchParams.get('mode') === 'private';

  useEffect(() => {
    console.log('PublicExamAccess useEffect triggered');
    console.log('  shareToken:', shareToken);
    console.log('  mode:', isPrivateMode ? 'private' : 'public');
    console.log('  user:', user ? `${user.email} (${user._id})` : 'null');
    console.log('  current error:', error);
    
    if (!shareToken) {
      console.error('No shareToken provided');
      setError('Invalid share link');
      setLoading(false);
      return;
    }

    // For private mode, wait for user to log in before fetching exam
    if (isPrivateMode && !user) {
      console.log('Private mode: waiting for user to log in');
      setLoading(false);
      return;
    }

    // Clear error when we're about to fetch exam
    if (error) {
      console.log('Clearing previous error before fetching exam');
      setError(null);
    }

    // Pre-fill form with user data if authenticated
    if (user) {
      setEmail(user.email || '');
      const fullName = user.firstName && user.lastName 
        ? `${user.firstName} ${user.lastName}` 
        : (user.firstName || user.lastName || user.name || user.fullName || '');
      setName(fullName);
    }

    console.log('Fetching exam data from /share/' + shareToken);
    setLoading(true);
    api.get(`/share/${shareToken}`)
      .then(r => {
        console.log('Exam data fetched successfully');
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
  }, [shareToken, isPrivateMode, user]);

  const handleJoin = async (pwd = null) => {
    setJoining(true);
    try {
      // For private mode, use authenticated user's info
      const userName = user && isPrivateMode
        ? (user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : (user.firstName || user.lastName || user.name || user.fullName || ''))
        : (name.trim() || undefined);
      
      const joinData = {
        email: isPrivateMode && user ? user.email : (email.trim() || undefined),
        name: userName,
        password: pwd,
        isPrivate: isPrivateMode
      };
      
      const res = await api.post(`/share/${shareToken}/join`, joinData);
      
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
        // For authenticated students, redirect to student exam interface
        navigate(`/student/exam/${res.data.resultId}`);
      } else if (user && user.role === 'student') {
        // Authenticated student should use student exam interface even without resultId
        // Create a student exam session and redirect
        navigate(`/student/exam/${res.data.exam._id}`);
      } else {
        // Navigate to public exam page for unauthenticated users
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

  const handleLogin = async () => {
    if (!loginEmail.trim() || !loginPassword.trim()) {
      setLoginError('Please enter both email and password');
      return;
    }

    setIsLoggingIn(true);
    setLoginError('');
    setError(null); // Clear any previous errors

    try {
      await login({ email: loginEmail.trim(), password: loginPassword });
      console.log('Login successful, user should now be authenticated');
      
      // Give AuthContext time to update user state
      setPostLoginLoading(true);
      setTimeout(() => {
        setPostLoginLoading(false);
        console.log('Post-login loading complete, user state should be updated');
      }, 500);
    } catch (err) {
      setLoginError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  if (loading || postLoginLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', bgcolor: '#F1F5F9' }}>
        <CircularProgress />
      </Box>
    );
  }

  // Show login form for private mode when not authenticated
  if (isPrivateMode && !user) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', bgcolor: '#F1F5F9', p: 2 }}>
        <Paper elevation={0} sx={{ p: 4, borderRadius: 3, maxWidth: 400, border: '1px solid #e2e8f0' }}>
          <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
            🔒 Private Exam Login
          </Typography>
          <Typography sx={{ color: '#64748b', mb: 3, fontSize: 14 }}>
            Please enter your credentials to access this private exam.
          </Typography>

          {loginError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {loginError}
            </Alert>
          )}

          <TextField
            fullWidth
            label="Email Address"
            type="email"
            value={loginEmail}
            onChange={e => setLoginEmail(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && handleLogin()}
            disabled={isLoggingIn}
            sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />

          <TextField
            fullWidth
            label="Password"
            type="password"
            value={loginPassword}
            onChange={e => setLoginPassword(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && handleLogin()}
            disabled={isLoggingIn}
            sx={{ mb: 3, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />

          <Button
            fullWidth
            variant="contained"
            onClick={handleLogin}
            disabled={isLoggingIn || !loginEmail.trim() || !loginPassword.trim()}
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
          >
            {isLoggingIn ? 'Logging in…' : 'Login'}
          </Button>
        </Paper>
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
        {isPrivateMode && (
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              🔒 Private Exam Access - You are joining as an authenticated student
            </Typography>
          </Alert>
        )}
        
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
          label="Full Name"
          value={name}
          onChange={e => setName(e.target.value)}
          disabled={isPrivateMode && user}
          sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          helperText={isPrivateMode && user ? 'Using your account name' : ''}
        />
        
        <TextField
          fullWidth
          label="Email Address"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          disabled={isPrivateMode && user}
          sx={{ mb: 3, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          helperText={isPrivateMode && user ? 'Using your account email' : ''}
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
