import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  CircularProgress,
  useTheme,
  alpha,
  Tooltip,
  Button
} from '@mui/material';
import { ArrowForward as ArrowForwardIcon } from '@mui/icons-material';

// Gamified progress card component
const ProgressCard = ({
  title,
  subtitle,
  progress = 0,
  maxProgress = 100,
  color,
  type = 'linear', // 'linear' or 'circular'
  showButton = false,
  buttonText = 'View Details',
  onClick,
  size = 'medium', // 'small', 'medium', 'large'
  animation = true
}) => {
  const theme = useTheme();

  // Determine the color based on the prop or default to primary
  const cardColor = color || theme.palette.primary.main;

  // Calculate progress percentage
  const progressPercentage = (progress / maxProgress) * 100;

  // Determine size values
  const getSize = () => {
    switch (size) {
      case 'small':
        return {
          padding: 2,
          circularSize: 60,
          thickness: 4,
          titleVariant: 'subtitle2',
          valueVariant: 'h6',
          buttonSize: 'small'
        };
      case 'large':
        return {
          padding: 3.5,
          circularSize: 120,
          thickness: 6,
          titleVariant: 'h6',
          valueVariant: 'h3',
          buttonSize: 'medium'
        };
      case 'medium':
      default:
        return {
          padding: 3,
          circularSize: 80,
          thickness: 5,
          titleVariant: 'subtitle1',
          valueVariant: 'h5',
          buttonSize: 'small'
        };
    }
  };

  const sizeValues = getSize();

  return (
    <Card
      sx={{
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 0, // Remove rounded corners
        transition: 'all 0.3s ease',
        background: `linear-gradient(135deg, ${alpha(cardColor, 0.03)} 0%, ${alpha(cardColor, 0.06)} 100%)`,
        border: `1px solid ${alpha(cardColor, 0.1)}`,
        '&:hover': {
          transform: 'translateY(-5px)',
          boxShadow: `0 12px 20px ${alpha(cardColor, 0.1)}`,
        },
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '4px',
          background: `linear-gradient(90deg, ${cardColor}, ${alpha(cardColor, 0.4)})`,
        }
      }}
    >
      <CardContent sx={{ p: sizeValues.padding }}>
        <Box sx={{
          display: 'flex',
          flexDirection: type === 'circular' ? 'column' : 'row',
          alignItems: type === 'circular' ? 'center' : 'flex-start',
          justifyContent: type === 'circular' ? 'center' : 'space-between',
          textAlign: type === 'circular' ? 'center' : 'left',
        }}>
          <Box sx={{
            flex: type === 'circular' ? 'none' : 1,
            mb: type === 'circular' ? 2 : 0
          }}>
            <Typography
              variant={sizeValues.titleVariant}
              color="text.primary"
              fontWeight="medium"
              gutterBottom
            >
              {title}
            </Typography>

            {subtitle && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mb: 2 }}
              >
                {subtitle}
              </Typography>
            )}

            {type === 'linear' && (
              <Box sx={{ mt: 2 }}>
                <Box sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  mb: 0.5
                }}>
                  <Typography variant="caption" color="text.secondary">
                    Progress
                  </Typography>
                  <Typography variant="caption" fontWeight="medium">
                    {progress}/{maxProgress}
                  </Typography>
                </Box>

                <LinearProgress
                  variant="determinate"
                  value={progressPercentage}
                  sx={{
                    height: 8,
                    borderRadius: 0, // Remove rounded corners
                    bgcolor: alpha(cardColor, 0.1),
                    '& .MuiLinearProgress-bar': {
                      bgcolor: cardColor,
                      borderRadius: 0, // Remove rounded corners
                      animation: animation ? 'growWidth 1.5s ease-out' : 'none',
                      '@keyframes growWidth': {
                        '0%': {
                          width: '0%',
                        },
                        '100%': {
                          width: `${progressPercentage}%`,
                        },
                      },
                    }
                  }}
                />
              </Box>
            )}
          </Box>

          {type === 'circular' && (
            <Box sx={{
              position: 'relative',
              display: 'inline-flex',
              mb: 2
            }}>
              <CircularProgress
                variant="determinate"
                value={progressPercentage}
                size={sizeValues.circularSize}
                thickness={sizeValues.thickness}
                sx={{
                  color: cardColor,
                  animation: animation ? 'growCircle 1.5s ease-out' : 'none',
                  '@keyframes growCircle': {
                    '0%': {
                      transform: 'rotate(-90deg)',
                    },
                    '100%': {
                      transform: `rotate(${(progressPercentage * 3.6) - 90}deg)`,
                    },
                  },
                }}
              />
              <Box
                sx={{
                  top: 0,
                  left: 0,
                  bottom: 0,
                  right: 0,
                  position: 'absolute',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Tooltip title={`${progress} out of ${maxProgress}`}>
                  <Typography
                    variant={sizeValues.valueVariant}
                    component="div"
                    color="text.primary"
                    fontWeight="bold"
                  >
                    {Math.round(progressPercentage)}%
                  </Typography>
                </Tooltip>
              </Box>
            </Box>
          )}
        </Box>

        {showButton && (
          <Box sx={{
            mt: 2,
            display: 'flex',
            justifyContent: type === 'circular' ? 'center' : 'flex-start'
          }}>
            <Button
              variant="text"
              color="primary"
              size={sizeValues.buttonSize}
              endIcon={<ArrowForwardIcon />}
              onClick={onClick}
              sx={{
                color: cardColor,
                borderRadius: 0, // Remove rounded corners
                '&:hover': {
                  bgcolor: alpha(cardColor, 0.1),
                }
              }}
            >
              {buttonText}
            </Button>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default ProgressCard;
