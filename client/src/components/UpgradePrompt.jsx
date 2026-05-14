import { Box, Button, Paper, Typography, Chip } from '@mui/material';
import { Lock, Star, ArrowForward } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { getPlanConfig, getUpgradeMessage, getRecommendedPlan, formatPriceRWF } from '../utils/planUtils';

export default function UpgradePrompt({ 
  feature, 
  currentPlan = 'free', 
  variant = 'card',
  compact = false 
}) {
  const navigate = useNavigate();
  const planConfig = getPlanConfig(currentPlan);
  const recommendedPlan = getRecommendedPlan(currentPlan, feature);
  const recommendedConfig = recommendedPlan ? getPlanConfig(recommendedPlan) : null;

  const handleUpgrade = () => {
    // Navigate to subscription page or open upgrade modal
    navigate('/dashboard?tab=subscriptions');
  };

  if (compact) {
    return (
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 1, 
        p: 1.5, 
        bgcolor: '#FEF3C7', 
        borderRadius: 2,
        border: '1px solid #FCD34D'
      }}>
        <Lock sx={{ fontSize: 18, color: '#F59E0B' }} />
        <Typography variant="caption" sx={{ color: '#92400E', flex: 1 }}>
          {getUpgradeMessage(feature)}
        </Typography>
        <Button 
          size="small" 
          onClick={handleUpgrade}
          sx={{ 
            minWidth: 'auto', 
            px: 1.5, 
            py: 0.5, 
            fontSize: '11px',
            fontWeight: 700,
            bgcolor: '#F59E0B',
            color: 'white',
            '&:hover': { bgcolor: '#D97706' }
          }}
        >
          Upgrade
        </Button>
      </Box>
    );
  }

  if (variant === 'inline') {
    return (
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 1.5, 
        py: 2,
        borderTop: '1px dashed #E2E8F0'
      }}>
        <Box sx={{ 
          width: 40, 
          height: 40, 
          borderRadius: '50%', 
          bgcolor: '#F3E8FF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Lock sx={{ fontSize: 20, color: '#9333EA' }} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="body2" fontWeight={600} sx={{ color: '#1E293B' }}>
            {getUpgradeMessage(feature)}
          </Typography>
          {recommendedConfig && (
            <Typography variant="caption" sx={{ color: '#64748B' }}>
              Upgrade to {recommendedConfig.name} for {formatPriceRWF(recommendedConfig.priceRWF)}/mo
            </Typography>
          )}
        </Box>
        <Button 
          variant="contained"
          endIcon={<ArrowForward />}
          onClick={handleUpgrade}
          sx={{ 
            borderRadius: 2,
            textTransform: 'none',
            fontWeight: 700,
            bgcolor: '#9333EA',
            '&:hover': { bgcolor: '#7C3AED' }
          }}
        >
          Upgrade Now
        </Button>
      </Box>
    );
  }

  // Card variant (default)
  return (
    <Paper elevation={0} sx={{ 
      p: 3, 
      borderRadius: 3,
      bgcolor: 'linear-gradient(135deg, #F3E8FF 0%, #E0E7FF 100%)',
      border: '1px solid #C4B5FD',
      textAlign: 'center'
    }}>
      <Box sx={{ 
        width: 56, 
        height: 56, 
        borderRadius: '50%', 
        bgcolor: '#9333EA',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        mx: 'auto',
        mb: 2
      }}>
        <Star sx={{ fontSize: 28, color: 'white' }} />
      </Box>
      
      <Chip 
        label={`Current: ${planConfig.name} Plan`} 
        size="small"
        sx={{ 
          mb: 2, 
          bgcolor: `${planConfig.color}15`,
          color: planConfig.color,
          fontWeight: 600 
        }} 
      />
      
      <Typography variant="h6" fontWeight={700} sx={{ mb: 1, color: '#1E293B' }}>
        Unlock This Feature
      </Typography>
      
      <Typography variant="body2" sx={{ mb: 3, color: '#64748B', maxWidth: 300, mx: 'auto' }}>
        {getUpgradeMessage(feature)}
      </Typography>
      
      {recommendedConfig && (
        <Box sx={{ mb: 3, p: 2, bgcolor: 'white', borderRadius: 2, textAlign: 'left' }}>
          <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#9333EA', mb: 1 }}>
            Recommended: {recommendedConfig.name} Plan
          </Typography>
          <Typography variant="h5" fontWeight={800} sx={{ color: '#1E293B', mb: 1 }}>
            {formatPriceRWF(recommendedConfig.priceRWF)}<Typography component="span" variant="caption" sx={{ color: '#64748B' }}>/mo</Typography>
          </Typography>
          <Box component="ul" sx={{ m: 0, pl: 2, color: '#64748B', fontSize: '13px' }}>
            {recommendedConfig.features.slice(0, 3).map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </Box>
        </Box>
      )}
      
      <Button 
        variant="contained"
        fullWidth
        size="large"
        endIcon={<ArrowForward />}
        onClick={handleUpgrade}
        sx={{ 
          borderRadius: 2,
          textTransform: 'none',
          fontWeight: 700,
          py: 1.5,
          bgcolor: '#9333EA',
          '&:hover': { bgcolor: '#7C3AED' }
        }}
      >
        Upgrade Now
      </Button>
      
      <Typography variant="caption" sx={{ display: 'block', mt: 2, color: '#64748B' }}>
        No credit card required for trial
      </Typography>
    </Paper>
  );
}
