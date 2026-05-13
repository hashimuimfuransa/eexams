import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Avatar,
  LinearProgress,
  Tooltip,
  useTheme,
  alpha
} from '@mui/material';
import {
  EmojiEvents as TrophyIcon,
  Star as StarIcon,
  Whatshot as FireIcon,
  Bolt as BoltIcon,
  School as SchoolIcon
} from '@mui/icons-material';

// Achievement card component with gamification elements
const AchievementCard = ({
  title,
  description,
  progress = 0,
  maxProgress = 100,
  level = 1,
  type = 'bronze',
  icon = 'trophy',
  unlocked = false
}) => {
  const theme = useTheme();

  // Get the appropriate icon based on the type
  const getIcon = () => {
    switch (icon) {
      case 'trophy':
        return <TrophyIcon />;
      case 'star':
        return <StarIcon />;
      case 'fire':
        return <FireIcon />;
      case 'bolt':
        return <BoltIcon />;
      case 'school':
        return <SchoolIcon />;
      default:
        return <TrophyIcon />;
    }
  };

  // Get the appropriate color based on the type
  const getColor = () => {
    switch (type) {
      case 'bronze':
        return theme.palette.gamification.bronze;
      case 'silver':
        return theme.palette.gamification.silver;
      case 'gold':
        return theme.palette.gamification.gold;
      case 'platinum':
        return theme.palette.gamification.platinum;
      case 'diamond':
        return theme.palette.gamification.diamond;
      default:
        return theme.palette.gamification.bronze;
    }
  };

  const color = getColor();
  const progressPercentage = (progress / maxProgress) * 100;

  return (
    <Card
      sx={{
        position: 'relative',
        overflow: 'visible',
        height: '100%',
        borderRadius: 0, // Remove rounded corners
        transition: 'all 0.3s ease',
        border: unlocked ? `2px solid ${color}` : 'none',
        boxShadow: unlocked
          ? `0 8px 16px ${alpha(color, 0.2)}`
          : '0 4px 12px rgba(0, 0, 0, 0.05)',
        opacity: unlocked ? 1 : 0.8,
        filter: unlocked ? 'none' : 'grayscale(0.5)',
        '&:hover': {
          transform: 'translateY(-8px)',
          boxShadow: unlocked
            ? `0 12px 24px ${alpha(color, 0.3)}`
            : '0 8px 20px rgba(0, 0, 0, 0.1)',
        }
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          top: -20,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1,
        }}
      >
        <Tooltip title={`${type.charAt(0).toUpperCase() + type.slice(1)} Achievement`}>
          <Avatar
            sx={{
              width: 48,
              height: 48,
              bgcolor: unlocked ? color : alpha(color, 0.5),
              color: '#fff',
              border: '4px solid #fff',
              boxShadow: `0 4px 12px ${alpha(color, 0.3)}`,
              transition: 'all 0.3s ease',
              '&:hover': {
                transform: 'scale(1.1) rotate(5deg)',
              }
            }}
          >
            {getIcon()}
          </Avatar>
        </Tooltip>
      </Box>

      <CardContent sx={{ pt: 4, pb: 2, px: 2, textAlign: 'center' }}>
        <Typography
          variant="h6"
          fontWeight="bold"
          gutterBottom
          sx={{
            color: unlocked ? color : 'text.secondary',
            transition: 'color 0.3s ease',
          }}
        >
          {title}
        </Typography>

        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mb: 2, height: 40, overflow: 'hidden' }}
        >
          {description}
        </Typography>

        <Box sx={{ mb: 1 }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              mb: 0.5
            }}
          >
            <span>Progress</span>
            <span>{progress}/{maxProgress}</span>
          </Typography>
          <LinearProgress
            variant="determinate"
            value={progressPercentage}
            sx={{
              height: 8,
              borderRadius: 0, // Remove rounded corners
              bgcolor: alpha(color, 0.1),
              '& .MuiLinearProgress-bar': {
                bgcolor: color,
                borderRadius: 0, // Remove rounded corners
              }
            }}
          />
        </Box>

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mt: 2
          }}
        >
          <Tooltip title="Achievement Level">
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 24,
                height: 24,
                borderRadius: '50%',
                bgcolor: alpha(color, 0.1),
                color: color,
                fontWeight: 'bold',
                fontSize: '0.75rem',
              }}
            >
              {level}
            </Box>
          </Tooltip>

          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ ml: 1 }}
          >
            Level {level}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};

export default AchievementCard;
