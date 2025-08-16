import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Typography,
  Alert,
  Chip,
  IconButton,
  Tooltip,
  Card,
  CardContent,
  Divider
} from '@mui/material';
import {
  Mic,
  MicOff,
  Pause,
  PlayArrow,
  Stop,
  Settings
} from '@mui/icons-material';
import useAudioCapture from '../hooks/useAudioCapture';
import AudioLevelIndicator from './AudioLevelIndicator';
import RecordingStatusIndicator from './RecordingStatusIndicator';

/**
 * AudioControls Component - Provides UI controls and indicators for audio capture
 * Implements requirements 1.2, 1.5, and 4.6 for audio control interface
 */
const AudioControls = ({ onRecordingStateChange, onAudioData, compact = false }) => {
  const {
    isInitialized,
    isInitializing,
    isRecording,
    isPaused,
    audioLevel,
    error,
    recordingDuration,
    initialize,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    clearError,
    getFormattedDuration,
    canRecord,
    canPause,
    canResume,
    canStop,
  } = useAudioCapture();

  const [noAudioWarning, setNoAudioWarning] = useState(false);
  const [audioSource, setAudioSource] = useState(null);
  const [lastAudioTime, setLastAudioTime] = useState(Date.now());

  // Monitor audio levels for no-audio detection (Requirement 1.5)
  useEffect(() => {
    if (isRecording && !isPaused) {
      const checkAudioInterval = setInterval(() => {
        if (audioLevel > 5) {
          setLastAudioTime(Date.now());
          setNoAudioWarning(false);
        } else {
          const timeSinceAudio = Date.now() - lastAudioTime;
          if (timeSinceAudio > 30000) { // 30 seconds
            setNoAudioWarning(true);
          }
        }
      }, 1000);

      return () => clearInterval(checkAudioInterval);
    } else {
      setNoAudioWarning(false);
    }
  }, [isRecording, isPaused, audioLevel, lastAudioTime]);

  // Notify parent component of recording state changes
  useEffect(() => {
    if (onRecordingStateChange) {
      onRecordingStateChange({
        isRecording,
        isPaused,
        duration: recordingDuration,
        audioLevel,
        isInitialized
      });
    }
  }, [isRecording, isPaused, recordingDuration, audioLevel, isInitialized, onRecordingStateChange]);

  // Handle audio initialization
  const handleInitialize = async (useMicrophone = false) => {
    setAudioSource(useMicrophone ? 'microphone' : 'system');
    await initialize(useMicrophone);
  };

  // Handle start recording
  const handleStartRecording = async () => {
    const success = await startRecording();
    if (success) {
      setLastAudioTime(Date.now());
    }
  };

  // Handle stop recording
  const handleStopRecording = async () => {
    const audioBlob = await stopRecording();
    if (audioBlob && onAudioData) {
      onAudioData(audioBlob);
    }
  };

  // Get recording status display
  const getRecordingStatus = () => {
    if (!isInitialized) return 'Not Initialized';
    if (isRecording && isPaused) return 'Paused';
    if (isRecording) return 'Recording';
    return 'Ready';
  };

  // Get status color
  const getStatusColor = () => {
    if (!isInitialized) return 'default';
    if (isRecording && isPaused) return 'warning';
    if (isRecording) return 'error';
    return 'success';
  };

  // Compact view for smaller spaces
  if (compact) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {/* Recording Status Indicator */}
        <Chip
          label={getRecordingStatus()}
          color={getStatusColor()}
          size="small"
          icon={isRecording ? <Mic /> : <MicOff />}
        />

        {/* Duration Display */}
        {isRecording && (
          <Typography variant="body2" sx={{ minWidth: '50px', fontFamily: 'monospace' }}>
            {getFormattedDuration()}
          </Typography>
        )}

        {/* Audio Level Indicator */}
        {isInitialized && (
          <AudioLevelIndicator 
            audioLevel={audioLevel} 
            variant="compact" 
            height={4}
            showLabel={false}
          />
        )}

        {/* Control Buttons */}
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {!isInitialized ? (
            <Tooltip title="Initialize Audio">
              <IconButton
                size="small"
                onClick={() => handleInitialize(false)}
                disabled={isInitializing}
              >
                <Settings />
              </IconButton>
            </Tooltip>
          ) : (
            <>
              <Tooltip title={canRecord ? 'Start Recording' : 'Cannot Start'}>
                <span>
                  <IconButton
                    size="small"
                    onClick={handleStartRecording}
                    disabled={!canRecord}
                    color="success"
                  >
                    <Mic />
                  </IconButton>
                </span>
              </Tooltip>

              <Tooltip title={canPause ? 'Pause' : canResume ? 'Resume' : 'Cannot Pause/Resume'}>
                <span>
                  <IconButton
                    size="small"
                    onClick={canPause ? pauseRecording : resumeRecording}
                    disabled={!canPause && !canResume}
                    color="warning"
                  >
                    {canPause ? <Pause /> : <PlayArrow />}
                  </IconButton>
                </span>
              </Tooltip>

              <Tooltip title={canStop ? 'Stop Recording' : 'Cannot Stop'}>
                <span>
                  <IconButton
                    size="small"
                    onClick={handleStopRecording}
                    disabled={!canStop}
                    color="error"
                  >
                    <Stop />
                  </IconButton>
                </span>
              </Tooltip>
            </>
          )}
        </Box>
      </Box>
    );
  }

  // Full view
  return (
    <Card elevation={2}>
      <CardContent>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Mic />
          Audio Controls
        </Typography>

        {/* Error Display */}
        {error && (
          <Alert severity="error" onClose={clearError} sx={{ mb: 2 }}>
            {error.message}
          </Alert>
        )}

        {/* No Audio Warning */}
        {noAudioWarning && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            No audio detected for 30 seconds. Please check your audio source and ensure the meeting audio is playing.
          </Alert>
        )}

        {/* Recording Status Section */}
        <Box sx={{ mb: 3 }}>
          <RecordingStatusIndicator
            isRecording={isRecording}
            isPaused={isPaused}
            isInitialized={isInitialized}
            duration={recordingDuration}
            variant="full"
          />
          
          {audioSource && (
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
              <Chip
                label={audioSource === 'microphone' ? 'Microphone Input' : 'System Audio Input'}
                variant="outlined"
                size="small"
              />
            </Box>
          )}
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Audio Level Visualization */}
        <Box sx={{ mb: 3 }}>
          <AudioLevelIndicator 
            audioLevel={audioLevel} 
            variant="full" 
            height={12}
          />
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Control Buttons */}
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          {!isInitialized ? (
            <>
              <Button
                variant="contained"
                onClick={() => handleInitialize(false)}
                disabled={isInitializing}
                startIcon={<Mic />}
                size="large"
              >
                {isInitializing ? 'Initializing...' : 'System Audio'}
              </Button>
              <Button
                variant="outlined"
                onClick={() => handleInitialize(true)}
                disabled={isInitializing}
                startIcon={<MicOff />}
                size="large"
              >
                {isInitializing ? 'Initializing...' : 'Microphone'}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="contained"
                color="success"
                onClick={handleStartRecording}
                disabled={!canRecord}
                startIcon={<Mic />}
                size="large"
              >
                Start Recording
              </Button>

              <Button
                variant="contained"
                color="warning"
                onClick={canPause ? pauseRecording : resumeRecording}
                disabled={!canPause && !canResume}
                startIcon={canPause ? <Pause /> : <PlayArrow />}
                size="large"
              >
                {canPause ? 'Pause' : 'Resume'}
              </Button>

              <Button
                variant="contained"
                color="error"
                onClick={handleStopRecording}
                disabled={!canStop}
                startIcon={<Stop />}
                size="large"
              >
                Stop Recording
              </Button>
            </>
          )}
        </Box>

        {/* Instructions */}
        {!isInitialized && (
          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2">
              <strong>System Audio:</strong> Captures audio from your screen/applications (requires screen sharing permission).
              <br />
              <strong>Microphone:</strong> Captures audio from your microphone (requires microphone permission).
            </Typography>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default AudioControls;