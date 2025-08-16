import React from 'react';
import { Box, Typography, Chip, Pulse } from '@mui/material';
import { 
  Mic, 
  MicOff, 
  Pause, 
  FiberManualRecord,
  RadioButtonUnchecked 
} from '@mui/icons-material';

/**
 * RecordingStatusIndicator Component - Visual indicators for recording state
 * Provides clear visual feedback about current recording status
 */
const RecordingStatusIndicator = ({ 
  isRecording = false,
  isPaused = false,
  isInitialized = false,
  duration = 0,
  variant = 'full', // 'full', 'compact', 'minimal'
  showDuration = true
}) => {
  // Format duration as MM:SS
  const formatDuration = (seconds) => {
    // Handle invalid or negative durations
    const validSeconds = typeof seconds === 'number' && seconds >= 0 ? seconds : 0;
    const minutes = Math.floor(validSeconds / 60);
    const remainingSeconds = validSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Get status information
  const getStatusInfo = () => {
    if (!isInitialized) {
      return {
        label: 'Not Initialized',
        color: 'default',
        icon: <MicOff />,
        description: 'Audio capture not initialized'
      };
    }
    
    if (isRecording && isPaused) {
      return {
        label: 'Paused',
        color: 'warning',
        icon: <Pause />,
        description: 'Recording paused'
      };
    }
    
    if (isRecording) {
      return {
        label: 'Recording',
        color: 'error',
        icon: <FiberManualRecord />,
        description: 'Currently recording audio'
      };
    }
    
    return {
      label: 'Ready',
      color: 'success',
      icon: <Mic />,
      description: 'Ready to start recording'
    };
  };

  const statusInfo = getStatusInfo();

  // Pulsing animation for recording state
  const PulsingIcon = ({ children }) => (
    <Box
      sx={{
        display: 'inline-flex',
        animation: isRecording && !isPaused ? 'pulse 1.5s infinite' : 'none',
        '@keyframes pulse': {
          '0%': { opacity: 1 },
          '50%': { opacity: 0.5 },
          '100%': { opacity: 1 }
        }
      }}
    >
      {children}
    </Box>
  );

  // Minimal variant - just a small indicator
  if (variant === 'minimal') {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <PulsingIcon>
          <Box sx={{ color: `${statusInfo.color}.main`, display: 'flex' }}>
            {isRecording ? <FiberManualRecord fontSize="small" /> : <RadioButtonUnchecked fontSize="small" />}
          </Box>
        </PulsingIcon>
        {showDuration && isRecording && (
          <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
            {formatDuration(duration)}
          </Typography>
        )}
      </Box>
    );
  }

  // Compact variant - chip with icon
  if (variant === 'compact') {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <PulsingIcon>
          <Chip
            label={statusInfo.label}
            color={statusInfo.color}
            size="small"
            icon={statusInfo.icon}
          />
        </PulsingIcon>
        {showDuration && (
          <Typography variant="body2" sx={{ fontFamily: 'monospace', minWidth: '50px' }}>
            {formatDuration(duration)}
          </Typography>
        )}
      </Box>
    );
  }

  // Full variant - complete status display
  return (
    <Box>
      <Typography variant="subtitle2" gutterBottom>
        Recording Status
      </Typography>
      
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <PulsingIcon>
          <Chip
            label={statusInfo.label}
            color={statusInfo.color}
            icon={statusInfo.icon}
            sx={{ fontSize: '0.875rem' }}
          />
        </PulsingIcon>
        
        <Typography variant="body2" color="text.secondary">
          {statusInfo.description}
        </Typography>
      </Box>

      {/* Duration Display */}
      {showDuration && (
        <Box sx={{ textAlign: 'center', mb: 2 }}>
          <Typography variant="caption" color="text.secondary" gutterBottom>
            Duration
          </Typography>
          <Typography 
            variant="h4" 
            sx={{ 
              fontFamily: 'monospace', 
              color: isRecording ? 'error.main' : 'text.secondary',
              fontWeight: 'bold'
            }}
          >
            {formatDuration(duration)}
          </Typography>
        </Box>
      )}

      {/* Visual Recording Indicator */}
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1 }}>
        {[...Array(3)].map((_, index) => (
          <Box
            key={index}
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: isRecording && !isPaused ? 'error.main' : 'grey.300',
              animation: isRecording && !isPaused ? `blink ${1 + index * 0.2}s infinite` : 'none',
              '@keyframes blink': {
                '0%, 50%': { opacity: 1 },
                '51%, 100%': { opacity: 0.3 }
              }
            }}
          />
        ))}
      </Box>
    </Box>
  );
};

export default RecordingStatusIndicator;