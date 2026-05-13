import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Avatar,
  useTheme,
  alpha,
  Tooltip,
  IconButton
} from '@mui/material';
import { Info as InfoIcon } from '@mui/icons-material';

// Gamified stats card component
const StatsCard = ({
  title,
  value,
  icon,
  color,
  trend = null,
  trendLabel = '',
  tooltip = '',
  animation = true,
  titleFontSize,
  valueFontSize,
  iconSize,
  height,
  padding
}) => {
  const theme = useTheme();

  // Determine the color based on the prop or default to primary
  const cardColor = color || theme.palette.primary.main;

  // Determine the trend color
  const getTrendColor = () => {
    if (!trend) return theme.palette.text.secondary;
    return trend > 0
      ? theme.palette.success.main
      : trend < 0
        ? theme.palette.error.main
        : theme.palette.text.secondary;
  };

  // Determine the trend icon
  const getTrendIcon = () => {
    if (!trend) return null;
    return trend > 0
      ? '↑'
      : trend < 0
        ? '↓'
        : '→';
  };

  return (
    <Card
      sx={{
        height: height || '100%',
        position: 'relative',
        overflow: 'hidden',
        borderRadius: { xs: 3, md: 4 },
        transition: 'all 0.3s ease',
        background: `linear-gradient(135deg, ${alpha(cardColor, 0.05)} 0%, ${alpha(cardColor, 0.1)} 100%)`,
        border: `1px solid ${alpha(cardColor, 0.15)}`,
        boxShadow: `0 8px 16px ${alpha(cardColor, 0.1)}`,
        '&:hover': {
          transform: 'translateY(-8px)',
          boxShadow: `0 16px 30px ${alpha(cardColor, 0.2)}`,
          '& .stats-icon': {
            transform: 'scale(1.15) rotate(10deg)',
          },
          '& .stats-value': {
            color: cardColor,
          }
        },
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '6px',
          background: `linear-gradient(90deg, ${cardColor}, ${alpha(cardColor, 0.6)})`,
          boxShadow: `0 2px 10px ${alpha(cardColor, 0.3)}`,
        },
        '&::after': {
          content: '""',
          position: 'absolute',
          bottom: 0,
          right: 0,
          width: '150px',
          height: '150px',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${alpha(cardColor, 0.1)} 0%, transparent 70%)`,
          zIndex: 0,
        }
      }}
    >
      <CardContent sx={{ p: padding || { xs: 2, sm: 2.5, md: 3 }, position: 'relative', zIndex: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box sx={{ width: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Typography
                variant="subtitle1"
                color="text.primary"
                fontWeight="bold"
                sx={{
                  mr: 1,
                  fontSize: titleFontSize || { xs: '0.85rem', sm: '0.95rem', md: '1.1rem' },
                  position: 'relative',
                  display: 'inline-block',
                  '&::after': {
                    content: '""',
                    position: 'absolute',
                    bottom: -4,
                    left: 0,
                    width: '40%',
                    height: 2,
                    backgroundColor: cardColor,
                    borderRadius: 1
                  }
                }}
              >
                {title}
              </Typography>

              {tooltip && (
                <Tooltip title={tooltip} arrow placement="top">
                  <IconButton
                    size="small"
                    sx={{
                      p: 0.25,
                      color: alpha(theme.palette.text.secondary, 0.7),
                      '&:hover': {
                        color: cardColor,
                        bgcolor: alpha(cardColor, 0.1),
                        transform: 'rotate(15deg)'
                      },
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <InfoIcon fontSize="small" sx={{ fontSize: { xs: '0.8rem', sm: '0.85rem', md: '0.9rem' } }} />
                  </IconButton>
                </Tooltip>
              )}
            </Box>

            <Typography
              className="stats-value"
              variant="h3"
              fontWeight="bold"
              sx={{
                color: theme.palette.text.primary,
                fontSize: valueFontSize || { xs: '1.8rem', sm: '2rem', md: '2.5rem' },
                animation: animation ? 'countUp 2s ease-out' : 'none',
                '@keyframes countUp': {
                  '0%': {
                    opacity: 0,
                    transform: 'translateY(15px)',
                  },
                  '100%': {
                    opacity: 1,
                    transform: 'translateY(0)',
                  },
                },
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                transition: 'color 0.3s ease',
                mt: 1,
                mb: 1,
                textShadow: `0 2px 4px ${alpha(cardColor, 0.2)}`
              }}
            >
              {value}
            </Typography>

            {trend !== null && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  mt: 1.5,
                  color: getTrendColor(),
                  fontWeight: 'medium',
                  flexWrap: 'wrap',
                  gap: 0.5,
                  bgcolor: trend ? alpha(getTrendColor(), 0.1) : alpha(theme.palette.text.secondary, 0.05),
                  py: 0.5,
                  px: 1,
                  borderRadius: 10,
                  width: 'fit-content'
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    fontWeight: 'bold',
                    fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.8rem' }
                  }}
                >
                  {getTrendIcon()} {Math.abs(trend)}%
                </Typography>

                {trendLabel && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{
                      ml: { xs: 0.5, sm: 0.75, md: 1 },
                      fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.8rem' }
                    }}
                  >
                    {trendLabel}
                  </Typography>
                )}
              </Box>
            )}
          </Box>

          <Avatar
            className="stats-icon"
            sx={{
              width: iconSize?.width || iconSize || { xs: 48, sm: 54, md: 60 },
              height: iconSize?.height || iconSize || { xs: 48, sm: 54, md: 60 },
              bgcolor: alpha(cardColor, 0.15),
              color: cardColor,
              transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
              boxShadow: `0 8px 16px ${alpha(cardColor, 0.25)}`,
              border: `2px solid ${alpha(cardColor, 0.2)}`,
              '&:hover': {
                bgcolor: alpha(cardColor, 0.2),
              }
            }}
          >
            {icon}
          </Avatar>
        </Box>
      </CardContent>
    </Card>
  );
};

export default StatsCard;
