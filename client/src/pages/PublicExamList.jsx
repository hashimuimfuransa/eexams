import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  Grid,
  Chip,
  CircularProgress,
  Alert,
  TextField,
  InputAdornment
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import axios from 'axios';

const PublicExamList = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchPublicExams();
  }, []);

  const fetchPublicExams = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/public/exams');
      setExams(response.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching public exams:', err);
      setError('Failed to load exams. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleExamClick = (exam) => {
    // Check if user is authenticated as a student
    const isStudent = isAuthenticated && user?.role === 'student';
    
    if (!isStudent) {
      // Redirect to student registration with the exam as redirect target
      const redirectUrl = `/marketplace/exams/${exam._id}/request`;
      navigate(`/student-register?redirect=${encodeURIComponent(redirectUrl)}`);
      return;
    }

    // If authenticated as student, redirect to exam request page
    navigate(`/marketplace/exams/${exam._id}/request`);
  };

  const filteredExams = exams.filter(exam =>
    exam.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (exam.description && exam.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', bgcolor: '#F1F5F9' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ bgcolor: '#F1F5F9', minHeight: '100vh', py: 4 }}>
      <Container maxWidth="lg">
        <Box sx={{ mb: 4, textAlign: 'center' }}>
          <Typography variant="h4" fontWeight={700} sx={{ mb: 2 }}>
            📚 Available Exams
          </Typography>
          <Typography sx={{ color: '#64748b', mb: 3 }}>
            Browse and request access to publicly available exams
          </Typography>
          
          <TextField
            fullWidth
            maxWidth={600}
            placeholder="Search exams..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            sx={{ 
              maxWidth: 600, 
              mx: 'auto',
              '& .MuiOutlinedInput-root': { 
                borderRadius: 2,
                bgcolor: 'white'
              } 
            }}
          />
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {filteredExams.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="h6" sx={{ color: '#64748b' }}>
              {searchTerm ? 'No exams match your search' : 'No public exams available at this time'}
            </Typography>
          </Box>
        ) : (
          <Grid container spacing={3}>
            {filteredExams.map((exam) => (
              <Grid item xs={12} sm={6} md={4} key={exam._id}>
                <Card 
                  elevation={0}
                  sx={{ 
                    height: '100%', 
                    display: 'flex', 
                    flexDirection: 'column',
                    borderRadius: 3,
                    border: '1px solid #e2e8f0',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.1)'
                    }
                  }}
                >
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>
                      {exam.title}
                    </Typography>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        color: '#64748b', 
                        mb: 2,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}
                    >
                      {exam.publicDescription || exam.description}
                    </Typography>
                    
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                      <Chip 
                        label={`${exam.timeLimit} min`}
                        size="small"
                        sx={{ bgcolor: '#E0F2FE', color: '#0369A1', fontWeight: 600 }}
                      />
                      {exam.publicPrice > 0 && (
                        <Chip 
                          label={`RWF ${exam.publicPrice}`}
                          size="small"
                          sx={{ bgcolor: '#FEF3C7', color: '#B45309', fontWeight: 600 }}
                        />
                      )}
                      {exam.publicPrice === 0 && (
                        <Chip 
                          label="FREE"
                          size="small"
                          sx={{ bgcolor: '#DCFCE7', color: '#15803D', fontWeight: 600 }}
                        />
                      )}
                    </Box>

                    <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                      By {exam.createdBy?.fullName || 'Unknown'}
                    </Typography>
                  </CardContent>
                  <CardActions sx={{ p: 2, pt: 0 }}>
                    <Button
                      fullWidth
                      variant="contained"
                      onClick={() => handleExamClick(exam)}
                      sx={{ 
                        borderRadius: 2, 
                        textTransform: 'none', 
                        fontWeight: 700,
                        py: 1.5
                      }}
                    >
                      Request Access
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Container>
    </Box>
  );
};

export default PublicExamList;
