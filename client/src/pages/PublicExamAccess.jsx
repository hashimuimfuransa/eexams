import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Box, Paper, Typography, TextField, Button, CircularProgress, Alert } from '@mui/material';
import api from '../services/api';
import { AuthContext } from '../context/AuthContext';

const PublicExamAccess = () => {
  const { shareToken } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, login, logout } = useContext(AuthContext);
  const [loading, setLoading] = useState(true);
  const [exam, setExam] = useState(null);
  const [error, setError] = useState(null);
  const [password, setPassword] = useState('');
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [joining, setJoining] = useState(false);
  const [showLogoutPrompt, setShowLogoutPrompt] = useState(false);
  const [accessCode, setAccessCode] = useState('');
  const [usingAccessCode, setUsingAccessCode] = useState(false);

  useEffect(() => {
    console.log('PublicExamAccess useEffect triggered');
    console.log('  shareToken:', shareToken);
    console.log('  user:', user ? `${user.email} (${user._id})` : 'null');
    console.log('  current error:', error);
    
    if (!shareToken) {
      console.error('No shareToken provided');
      // Check if user might be trying to use access code instead
      setUsingAccessCode(true);
      setLoading(false);
      return;
    }

    // Clear error when we're about to fetch exam
    if (error) {
      console.log('Clearing previous error before fetching exam');
      setError(null);
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
  }, [shareToken, user]);

  const handleAccessCodeSubmit = async () => {
    if (!accessCode.trim()) {
      setError('Please enter an access code');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const response = await api.get(`/marketplace/access/${accessCode.trim()}`);
      console.log('Exam data fetched via access code:', response.data);
      
      setExam(response.data);
      if (response.data.shareData?.settings?.requirePassword) {
        setPasswordRequired(true);
      }
      
      // Update the URL with the shareToken for consistency
      navigate(`/exam/${response.data.shareToken}`, { replace: true });
    } catch (err) {
      console.error('Error loading exam with access code:', err);
      setError(err.response?.data?.message || 'Invalid access code. Please check and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (pwd = null) => {
    setJoining(true);
    try {
      let joinData;

      if (user) {
        // Check if user is a guest (has temporary email)
        const isGuestUser = user.email && user.email.includes('@exam.local');
        
        // Authenticated user - use their info
        const userName = user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : (user.firstName || user.lastName || user.name || user.fullName || '');
        joinData = {
          email: user.email,
          name: userName,
          password: pwd,
          isPrivate: !isGuestUser // Don't treat guest users as private
        };
      } else {
        // Unauthenticated user - let backend create guest account
        joinData = {
          email: undefined,
          name: undefined,
          password: pwd,
          isPrivate: false
        };
      }
      
      const res = await api.post(`/share/${shareToken}/join`, joinData);

      console.log('Join response:', res.data);
      console.log('Has token:', !!res.data.token);
      console.log('Has user:', !!res.data.user);
      console.log('Current user:', user);

      // If backend returned auth token (for guest users or marketplace users), set it directly
      if (res.data.token) {
        console.log('Setting token and redirecting...');
        localStorage.setItem('token', res.data.token);
        // Also store minimal user data for AuthContext
        if (res.data.user) {
          localStorage.setItem('user', JSON.stringify({
            ...res.data.user,
            token: res.data.token,
            role: 'student',
            userType: 'individual'
          }));
        }
        // Store shareToken for submission
        localStorage.setItem('currentShareToken', shareToken);
        // Force page reload to update auth context with new token
        // Always use examId since ExamInterface expects exam ID
        // Pass shareToken in URL as fallback
        window.location.href = `/student/exam/${res.data.exam._id}?shareToken=${shareToken}`;
        return;
      }

      // Redirect all students to main exam interface
      // Always use examId since ExamInterface expects exam ID
      // Store shareToken if available for submission
      if (shareToken) {
        localStorage.setItem('currentShareToken', shareToken);
        navigate(`/student/exam/${res.data.exam._id}?shareToken=${shareToken}`);
      } else {
        navigate(`/student/exam/${res.data.exam._id}`);
      }
    } catch (err) {
      console.error('Error joining exam:', err);
      console.error('Error status:', err.response?.status);
      console.error('Error message:', err.response?.data?.message);
      console.error('Error data:', err.response?.data);
      
      // If 403 error and user is logged in, show logout prompt
      if (err.response?.status === 403 && user) {
        setShowLogoutPrompt(true);
        setError('You are logged in as a different user. Please logout and login with the correct account to access this exam.');
      } else {
        setError(err.response?.data?.message || 'Failed to join exam');
      }
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

  // Show access code input form if using access code
  if (usingAccessCode && !exam) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', bgcolor: '#F1F5F9', p: 2 }}>
        <Paper elevation={0} sx={{ p: 4, borderRadius: 3, maxWidth: 450, border: '1px solid #e2e8f0' }}>
          <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
            🔑 Enter Access Code
          </Typography>
          <Typography sx={{ color: '#64748b', mb: 3, fontSize: 14 }}>
            Enter the 6-digit code provided by your teacher to access this exam.
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <TextField
            fullWidth
            label="Access Code"
            value={accessCode}
            onChange={(e) => setAccessCode(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAccessCodeSubmit()}
            disabled={loading}
            placeholder="Enter 6-digit code"
            inputProps={{ maxLength: 6, style: { letterSpacing: '0.5em', textAlign: 'center', fontSize: '1.5rem', fontWeight: 700 } }}
            sx={{ mb: 3, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />

          <Button
            fullWidth
            variant="contained"
            onClick={handleAccessCodeSubmit}
            disabled={loading || !accessCode.trim()}
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, py: 1.5 }}
          >
            {loading ? 'Verifying…' : 'Access Exam'}
          </Button>

          <Typography sx={{ mt: 3, textAlign: 'center', fontSize: 13, color: '#94a3b8' }}>
            Don't have an access code? Contact your teacher.
          </Typography>
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
        {showLogoutPrompt && (
          <>
            <Alert severity="warning" sx={{ mb: 3 }}>
              <Typography variant="body2" fontWeight={600}>
                Account Conflict Detected
              </Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                You are logged in as <strong>{user?.email}</strong>. This exam requires you to login with a different account. Please logout first and then access this link again.
              </Typography>
            </Alert>
            <Button
              variant="contained"
              color="error"
              fullWidth
              onClick={() => {
                logout();
                navigate('/login');
              }}
              sx={{ mb: 3, borderRadius: 2, textTransform: 'none', fontWeight: 700, py: 1.5 }}
            >
              Logout and Login Again
            </Button>
          </>
        )}

        {!user && (
          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body2" fontWeight={600}>
              Guest Access
            </Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              You can join this exam as a guest. A temporary account will be created automatically.
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

        {user && (
          <Box sx={{ bgcolor: '#EFF6FF', p: 2, borderRadius: 2, mb: 3 }}>
            <Typography sx={{ fontSize: 13, color: '#1E40AF' }}>
              <strong>Logged in as:</strong> {user.email}
            </Typography>
          </Box>
        )}

        <Button
          fullWidth
          variant="contained"
          onClick={() => handleJoin()}
          disabled={joining}
          sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, py: 1.5 }}
        >
          {joining ? 'Starting…' : user ? 'Start Exam' : 'Join as Guest'}
        </Button>
      </Paper>
    </Box>
  );
};

export default PublicExamAccess;
