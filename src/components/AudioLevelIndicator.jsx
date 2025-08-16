import React from 'react';
import { Box, Typography, LinearProgress } from '@mui/material';
import { VolumeUp, VolumeOff, VolumeMute } from '@mui/icons-material';

/**
 * AudioLevelIndicator Component - Real-time audio level visualization
 * Provides visual feedback for audio input levels with color coding
 */
const AudioLevelIndicator = ({ 
  audioLevel = 0, 
  showLabel = true, 
  showIcon = true, 
  height = 12, 
  variant = 'full' // 'full', 'compact', 'minimal'
}) => {
  // Ensure audioLevel is a valid number
  const validAudioLevel = typeof audioLevel === 'number' && !isNaN(audioLevel) ? audioLevel : 0;
  // Get appropriate icon based on audio level
  const getVolumeIcon = () => {
    if (validAudioLevel === 0) return <VolumeMute />;
    if (validAudioLevel < 30) return <VolumeOff />;
    return <VolumeUp />;
  };

  // Get color based on audio level
  const getAudioLevelColor = () => {
    if (validAudioLevel > 80) return 'error.main';
    if (validAudioLevel > 50) return 'warning.main';
    if (validAudioLevel > 10) return 'success.main';
    return 'grey.400';
  };

  // Minimal variant - just the progress bar
  if (variant === 'minimal') {
    return (
      <LinearProgress
        variant="determinate"
        value={audioLevel}
        sx={{ 
          height, 
          borderRadius: height / 2,
          backgroundColor: 'grey.200',
          '& .MuiLinearProgress-bar': {
            backgroundColor: getAudioLevelColor()
          }
        }}
      />
    );
  }

  // Compact variant - icon and bar only
  if (variant === 'compact') {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 120 }}>
        {showIcon && (
          <Box sx={{ color: getAudioLevelColor(), display: 'flex' }}>
            {getVolumeIcon()}
          </Box>
        )}
        <LinearProgress
          variant="determinate"
          value={validAudioLevel}
          sx={{ 
            flexGrow: 1,
            height, 
            borderRadius: height / 2,
            backgroundColor: 'grey.200',
            '& .MuiLinearProgress-bar': {
              backgroundColor: getAudioLevelColor()
            }
          }}
        />
        {showLabel && (
          <Typography variant="caption" sx={{ minWidth: '30px', textAlign: 'right' }}>
            {Math.round(validAudioLevel)}%
          </Typography>
        )}
      </Box>
    );
  }

  // Full variant - complete with title and percentage
  return (
    <Box>
      {showLabel && (
        <Typography 
          variant="subtitle2" 
          gutterBottom 
          sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
        >
          {showIcon && (
            <Box sx={{ color: getAudioLevelColor(), display: 'flex' }}>
              {getVolumeIcon()}
            </Box>
          )}
          Audio Level
        </Typography>
      )}
      
      <LinearProgress
        variant="determinate"
        value={validAudioLevel}
        sx={{ 
          height, 
          borderRadius: height / 2,
          backgroundColor: 'grey.200',
          '& .MuiLinearProgress-bar': {
            backgroundColor: getAudioLevelColor()
          }
        }}
      />
      
      {showLabel && (
        <Typography variant="body2" sx={{ mt: 1, textAlign: 'center' }}>
          {Math.round(validAudioLevel)}%
        </Typography>
      )}
      
      {/* Audio level status indicators */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
        <Typography variant="caption" color="text.secondary">
          Quiet
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {validAudioLevel > 80 ? 'Too Loud' : validAudioLevel > 50 ? 'Good' : validAudioLevel > 10 ? 'Low' : 'Silent'}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Loud
        </Typography>
      </Box>
    </Box>
  );
};

export default AudioLevelIndicator;