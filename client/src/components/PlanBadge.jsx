import { Chip, Tooltip, Box, Typography } from '@mui/material';
import { getPlanConfig, formatLimit } from '../utils/planUtils';
import { Warning } from '@mui/icons-material';

export default function PlanBadge({ 
  plan, 
  showLimits = false,
  examCount = 0,
  studentCount = 0,
  teacherCount = 0,
  compact = false
}) {
  const config = getPlanConfig(plan);
  
  // Check if near limits
  const examCheck = examCount >= config.maxExams * 0.9 && config.maxExams !== Infinity;
  const studentCheck = studentCount >= config.maxStudents * 0.9 && config.maxStudents !== Infinity;
  const teacherCheck = teacherCount >= config.maxTeachers * 0.9 && config.maxTeachers !== Infinity;
  const nearLimit = examCheck || studentCheck || teacherCheck;

  if (compact) {
    return (
      <Tooltip 
        title={
          <Box>
            <Typography variant="caption" fontWeight={700}>{config.name} Plan</Typography>
            {showLimits && (
              <Box sx={{ mt: 0.5 }}>
                <Typography variant="caption" display="block">
                  Exams: {examCount}/{formatLimit(config.maxExams)}
                </Typography>
                <Typography variant="caption" display="block">
                  Students: {studentCount}/{formatLimit(config.maxStudents)}
                </Typography>
              </Box>
            )}
          </Box>
        }
        arrow
      >
        <Chip 
          label={config.name}
          size="small"
          icon={nearLimit ? <Warning fontSize="small" /> : undefined}
          sx={{ 
            bgcolor: `${config.color}15`,
            color: config.color,
            fontWeight: 700,
            border: nearLimit ? `1px solid ${config.color}` : 'none',
            '& .MuiChip-icon': { color: config.color }
          }}
        />
      </Tooltip>
    );
  }

  return (
    <Chip 
      label={`${config.name} Plan`}
      icon={nearLimit ? <Warning fontSize="small" /> : undefined}
      sx={{ 
        bgcolor: `${config.color}15`,
        color: config.color,
        fontWeight: 700,
        px: 1,
        '& .MuiChip-icon': { color: config.color }
      }}
    />
  );
}
