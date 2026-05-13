import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Divider,
  useTheme,
  alpha,
  Chip,
  Button,
  LinearProgress
} from '@mui/material';
import {
  EmojiEvents as TrophyIcon,
  ArrowForward as ArrowForwardIcon,
  Star,
  LocalFireDepartment,
  Bolt
} from '@mui/icons-material';

// Gamified leaderboard component
const Leaderboard = ({
  title = 'Leaderboard',
  subtitle = '',
  data = [],
  maxItems = 5,
  showViewAll = true,
  onViewAll,
  highlightCurrentUser = true,
  currentUserId = null,
  type = 'score', // 'score' or 'progress'
  emptyMessage = 'No data available'
}) => {
  const theme = useTheme();

  // Get medal color based on position
  const getMedalColor = (position) => {
    switch (position) {
      case 0: // 1st place
        return theme.palette.gamification.gold;
      case 1: // 2nd place
        return theme.palette.gamification.silver;
      case 2: // 3rd place
        return theme.palette.gamification.bronze;
      default:
        return theme.palette.text.disabled;
    }
  };

  // Get rank label
  const getRankLabel = (position) => {
    const rank = position + 1;
    switch (rank) {
      case 1:
        return '1st';
      case 2:
        return '2nd';
      case 3:
        return '3rd';
      default:
        return `${rank}th`;
    }
  };

  // Limit the number of items to display
  const displayData = data.slice(0, maxItems);

  return (
    <Card
      elevation={0}
      sx={{
        height: '100%',
        borderRadius: 0,
        overflow: 'hidden',
        background: 'transparent',
        position: 'relative'
      }}
    >
      {/* Enhanced Header - Already handled by parent component */}

      <Box sx={{ p: 0 }}>
        {displayData.length > 0 ? displayData.map((item, index) => {
          const isCurrentUser = highlightCurrentUser && item.id === currentUserId;
          const medalColor = getMedalColor(index);

          return (
            <React.Fragment key={item.id}>
              <Box
                sx={{
                  position: 'relative',
                  mb: 2,
                  mx: 1,
                  borderRadius: 3,
                  overflow: 'hidden',
                  background: isCurrentUser
                    ? `linear-gradient(135deg,
                        ${alpha(theme.palette.primary.main, 0.15)} 0%,
                        ${alpha(theme.palette.primary.light, 0.1)} 100%)`
                    : `linear-gradient(135deg,
                        ${alpha(theme.palette.background.paper, 0.8)} 0%,
                        ${alpha(theme.palette.background.paper, 0.95)} 100%)`,
                  border: isCurrentUser
                    ? `2px solid ${alpha(theme.palette.primary.main, 0.3)}`
                    : `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                  transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  boxShadow: isCurrentUser
                    ? `0 8px 20px ${alpha(theme.palette.primary.main, 0.2)}`
                    : `0 4px 12px ${alpha(theme.palette.grey[500], 0.1)}`,
                  '&:hover': {
                    transform: 'translateY(-4px) scale(1.02)',
                    boxShadow: isCurrentUser
                      ? `0 12px 30px ${alpha(theme.palette.primary.main, 0.3)}`
                      : `0 8px 20px ${alpha(theme.palette.grey[500], 0.15)}`,
                  },
                }}
              >
                {/* Rank indicator with enhanced styling */}
                <Box
                  sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: 4,
                    background: index < 3
                      ? `linear-gradient(90deg, ${medalColor}, ${alpha(medalColor, 0.7)})`
                      : `linear-gradient(90deg, ${theme.palette.grey[400]}, ${alpha(theme.palette.grey[400], 0.7)})`,
                    boxShadow: index < 3 ? `0 2px 8px ${alpha(medalColor, 0.4)}` : 'none'
                  }}
                />

                {/* Glow effect for top 3 */}
                {index < 3 && (
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      background: `radial-gradient(circle at top left, ${alpha(medalColor, 0.1)} 0%, transparent 50%)`,
                      animation: 'leaderboardGlow 3s ease-in-out infinite alternate',
                      '@keyframes leaderboardGlow': {
                        '0%': { opacity: 0.3 },
                        '100%': { opacity: 0.6 }
                      }
                    }}
                  />
                )}

                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    p: 2,
                    position: 'relative',
                    zIndex: 1
                  }}
                >
                  {/* Enhanced Rank Badge */}
                  <Box
                    sx={{
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      background: index < 3
                        ? `linear-gradient(135deg, ${medalColor}, ${alpha(medalColor, 0.8)})`
                        : `linear-gradient(135deg, ${theme.palette.grey[400]}, ${alpha(theme.palette.grey[500], 0.8)})`,
                      color: 'white',
                      fontWeight: 'bold',
                      fontSize: '0.9rem',
                      mr: 2,
                      boxShadow: index < 3
                        ? `0 4px 12px ${alpha(medalColor, 0.4)}`
                        : `0 2px 8px ${alpha(theme.palette.grey[400], 0.3)}`,
                      animation: index < 3 ? 'rankPulse 2s ease-in-out infinite' : 'none',
                      '@keyframes rankPulse': {
                        '0%, 100%': { transform: 'scale(1)' },
                        '50%': { transform: 'scale(1.1)' }
                      }
                    }}
                  >
                    {index < 3 ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {index === 0 && <TrophyIcon sx={{ fontSize: '1.2rem' }} />}
                        {index === 1 && <Star sx={{ fontSize: '1.2rem' }} />}
                        {index === 2 && <LocalFireDepartment sx={{ fontSize: '1.2rem' }} />}
                      </Box>
                    ) : (
                      index + 1
                    )}

                    {/* Crown for first place */}
                    {index === 0 && (
                      <Box
                        sx={{
                          position: 'absolute',
                          top: -8,
                          right: -2,
                          fontSize: '1rem',
                          animation: 'crownFloat 2s ease-in-out infinite alternate',
                          '@keyframes crownFloat': {
                            '0%': { transform: 'translateY(0px) rotate(-5deg)' },
                            '100%': { transform: 'translateY(-3px) rotate(5deg)' }
                          }
                        }}
                      >
                        👑
                      </Box>
                    )}
                  </Box>

                  {/* Enhanced Avatar */}
                  <Box sx={{ position: 'relative', mr: 2 }}>
                    <Avatar
                      src={item.avatar}
                      alt={item.name}
                      sx={{
                        width: 48,
                        height: 48,
                        border: isCurrentUser
                          ? `3px solid ${theme.palette.primary.main}`
                          : index < 3
                            ? `3px solid ${medalColor}`
                            : `2px solid ${alpha(theme.palette.grey[400], 0.3)}`,
                        boxShadow: isCurrentUser
                          ? `0 0 0 3px ${alpha(theme.palette.primary.main, 0.2)}`
                          : index < 3
                            ? `0 4px 12px ${alpha(medalColor, 0.3)}`
                            : `0 2px 8px ${alpha(theme.palette.grey[400], 0.2)}`,
                        background: `linear-gradient(135deg, ${theme.palette.background.paper}, ${alpha(theme.palette.background.paper, 0.9)})`,
                        fontSize: '1.2rem',
                        fontWeight: 'bold'
                      }}
                    >
                      {item.name.charAt(0)}
                    </Avatar>

                    {/* Status indicator */}
                    <Box
                      sx={{
                        position: 'absolute',
                        bottom: -2,
                        right: -2,
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        bgcolor: isCurrentUser
                          ? theme.palette.primary.main
                          : index < 3
                            ? theme.palette.success.main
                            : theme.palette.grey[400],
                        border: '2px solid white',
                        boxShadow: `0 2px 4px ${alpha(theme.palette.grey[500], 0.3)}`,
                        animation: isCurrentUser ? 'statusPulse 2s ease-in-out infinite' : 'none',
                        '@keyframes statusPulse': {
                          '0%, 100%': { transform: 'scale(1)' },
                          '50%': { transform: 'scale(1.2)' }
                        }
                      }}
                    />
                  </Box>

                  {/* Enhanced Name and Info Section */}
                  <Box sx={{ flex: 1, mr: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                      <Typography
                        variant="body1"
                        fontWeight={isCurrentUser ? 'bold' : 'semibold'}
                        color={isCurrentUser ? 'primary.main' : 'text.primary'}
                        sx={{
                          fontSize: '1rem',
                          maxWidth: 140,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {item.name}
                      </Typography>

                      {isCurrentUser && (
                        <Chip
                          label="You"
                          size="small"
                          sx={{
                            ml: 1,
                            height: 22,
                            fontSize: '0.7rem',
                            bgcolor: theme.palette.primary.main,
                            color: 'white',
                            fontWeight: 'bold',
                            borderRadius: 3,
                            animation: 'youPulse 2s ease-in-out infinite',
                            '@keyframes youPulse': {
                              '0%, 100%': { transform: 'scale(1)' },
                              '50%': { transform: 'scale(1.05)' }
                            }
                          }}
                        />
                      )}
                    </Box>

                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{
                        fontSize: '0.75rem',
                        opacity: 0.8
                      }}
                    >
                      {item.title || item.email}
                    </Typography>

                    {/* Progress bar for visual appeal */}
                    <LinearProgress
                      variant="determinate"
                      value={type === 'score' ? Math.min((item.score / 100) * 100, 100) : item.progress}
                      sx={{
                        mt: 1,
                        height: 4,
                        borderRadius: 2,
                        bgcolor: alpha(theme.palette.grey[300], 0.3),
                        '& .MuiLinearProgress-bar': {
                          borderRadius: 2,
                          background: isCurrentUser
                            ? `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.primary.light})`
                            : index < 3
                              ? `linear-gradient(90deg, ${medalColor}, ${alpha(medalColor, 0.8)})`
                              : `linear-gradient(90deg, ${theme.palette.grey[400]}, ${theme.palette.grey[500]})`
                        }
                      }}
                    />
                  </Box>

                  {/* Enhanced Score Display */}
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: 60,
                      height: 50,
                      borderRadius: 3,
                      background: isCurrentUser
                        ? `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`
                        : index < 3
                          ? `linear-gradient(135deg, ${medalColor}, ${alpha(medalColor, 0.8)})`
                          : `linear-gradient(135deg, ${theme.palette.grey[400]}, ${theme.palette.grey[500]})`,
                      color: 'white',
                      fontWeight: 'bold',
                      boxShadow: isCurrentUser
                        ? `0 4px 12px ${alpha(theme.palette.primary.main, 0.4)}`
                        : index < 3
                          ? `0 4px 12px ${alpha(medalColor, 0.4)}`
                          : `0 2px 8px ${alpha(theme.palette.grey[400], 0.3)}`,
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                  >
                    {/* Shine effect */}
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 0,
                        left: '-100%',
                        width: '100%',
                        height: '100%',
                        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
                        animation: 'scoreShine 3s ease-in-out infinite',
                        '@keyframes scoreShine': {
                          '0%': { left: '-100%' },
                          '50%': { left: '100%' },
                          '100%': { left: '100%' }
                        }
                      }}
                    />

                    <Typography variant="h6" fontWeight="bold" sx={{ fontSize: '1.1rem', zIndex: 1 }}>
                      {type === 'score' ? item.score : `${item.progress}%`}
                    </Typography>
                    <Typography variant="caption" sx={{ fontSize: '0.65rem', opacity: 0.9, zIndex: 1 }}>
                      {type === 'score' ? 'pts' : 'done'}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </React.Fragment>
          );
        }) : (
          <Box sx={{ py: 6, px: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            <Box
              sx={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                background: `linear-gradient(135deg, ${alpha(theme.palette.grey[400], 0.2)}, ${alpha(theme.palette.grey[500], 0.3)})`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 3,
                animation: 'emptyFloat 3s ease-in-out infinite',
                '@keyframes emptyFloat': {
                  '0%, 100%': { transform: 'translateY(0px)' },
                  '50%': { transform: 'translateY(-10px)' }
                }
              }}
            >
              <TrophyIcon sx={{ fontSize: '2rem', color: theme.palette.grey[400] }} />
            </Box>
            <Typography variant="h6" color="text.secondary" fontWeight="medium" sx={{ mb: 1 }}>
              No Rankings Yet
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ opacity: 0.8 }}>
              {emptyMessage}
            </Typography>
          </Box>
        )}
      </Box>

      {showViewAll && data.length > maxItems && (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Button
            variant="contained"
            color="primary"
            size="medium"
            endIcon={<ArrowForwardIcon />}
            onClick={onViewAll}
            sx={{
              borderRadius: 3,
              textTransform: 'none',
              fontWeight: 'bold',
              px: 4,
              py: 1.5,
              background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
              boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.3)}`,
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: `0 6px 16px ${alpha(theme.palette.primary.main, 0.4)}`
              }
            }}
          >
            View All Rankings
          </Button>
        </Box>
      )}
    </Card>
  );
};

export default Leaderboard;
