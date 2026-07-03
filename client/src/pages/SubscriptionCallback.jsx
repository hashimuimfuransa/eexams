import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Button
} from '@mui/material';
import { CheckCircle, Error, Home, Download } from '@mui/icons-material';
import api from '../services/api';

const SubscriptionCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');
  const [subscriptionId, setSubscriptionId] = useState(null);
  const [downloadingInvoice, setDownloadingInvoice] = useState(false);

  const handleDownloadInvoice = async () => {
    if (!subscriptionId) return;
    try {
      setDownloadingInvoice(true);
      const response = await api.get(`/subscriptions/${subscriptionId}/invoice`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `invoice-${subscriptionId.slice(-8)}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading invoice:', err);
      alert('Failed to download invoice. Please try again.');
    } finally {
      setDownloadingInvoice(false);
    }
  };

  useEffect(() => {
    const processCallback = async () => {
      try {
        const paymentId = searchParams.get('paymentId');
        const transactionId = searchParams.get('transactionId');
        const statusParam = searchParams.get('status');
        const signature = searchParams.get('signature');
        const reference = searchParams.get('reference');

        if (!paymentId || !transactionId || !statusParam || !signature) {
          setStatus('error');
          setMessage('Invalid payment callback parameters');
          return;
        }

        // Send callback data to backend
        const response = await api.post('/subscriptions/callback', {
          paymentId,
          transactionId,
          status: statusParam,
          signature,
          reference
        });

        if (response.data.success) {
          setStatus('success');
          setMessage('Subscription activated successfully!');
          setSubscriptionId(response.data.subscription?._id || null);
        } else {
          setStatus('error');
          setMessage(response.data.message || 'Payment verification failed');
        }
      } catch (err) {
        console.error('Callback processing error:', err);
        setStatus('error');
        setMessage(err.response?.data?.message || 'Failed to process payment callback');
      }
    };

    processCallback();
  }, [searchParams, navigate]);

  return (
    <Container maxWidth="sm" sx={{ mt: 8, mb: 8 }}>
      <Card elevation={3} sx={{ borderRadius: 3 }}>
        <CardContent sx={{ p: 6, textAlign: 'center' }}>
          {status === 'loading' && (
            <Box>
              <CircularProgress size={60} sx={{ mb: 3 }} />
              <Typography variant="h6" gutterBottom>
                Processing Payment...
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Please wait while we verify your payment
              </Typography>
            </Box>
          )}

          {status === 'success' && (
            <Box>
              <CheckCircle 
                color="success" 
                sx={{ fontSize: 80, mb: 3 }}
              />
              <Typography variant="h5" fontWeight="bold" gutterBottom color="success.main">
                Payment Successful!
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
                {message}
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5, justifyContent: 'center' }}>
                <Button
                  variant="outlined"
                  color="success"
                  startIcon={downloadingInvoice ? <CircularProgress size={18} /> : <Download />}
                  onClick={handleDownloadInvoice}
                  disabled={!subscriptionId || downloadingInvoice}
                  size="large"
                >
                  {downloadingInvoice ? 'Preparing…' : 'Download Invoice'}
                </Button>
                <Button
                  variant="contained"
                  startIcon={<Home />}
                  onClick={() => navigate('/student/dashboard')}
                  size="large"
                >
                  Go to Dashboard
                </Button>
              </Box>
            </Box>
          )}

          {status === 'error' && (
            <Box>
              <Error 
                color="error" 
                sx={{ fontSize: 80, mb: 3 }}
              />
              <Typography variant="h5" fontWeight="bold" gutterBottom color="error.main">
                Payment Failed
              </Typography>
              <Alert severity="error" sx={{ mb: 4 }}>
                {message}
              </Alert>
              <Button
                variant="outlined"
                startIcon={<Home />}
                onClick={() => navigate('/student/subscriptions')}
                size="large"
              >
                Try Again
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>
    </Container>
  );
};

export default SubscriptionCallback;
