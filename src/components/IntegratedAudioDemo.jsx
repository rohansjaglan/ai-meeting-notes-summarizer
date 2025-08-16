import React, { useState, useEffect, useRef } from 'react';
import { 
  Box, 
  Button, 
  Typography, 
  LinearProgress, 
  Alert, 
  Card, 
  CardContent,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemText,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  CircularProgress
} from '@mui/material';
import { 
  Mic, 
  MicOff, 
  Pause, 
  PlayArrow, 
  Stop, 
  DesktopWindows,
  VolumeUp,
  Settings
} from '@mui/icons-material';
import AudioCaptureService from '../services/audioCaptureService';
import SpeechService from '../services/speechService';

/**
 * Integrated demo showing system audio capture with speech recognition
 */
const IntegratedAudioDemo = () => {
  // Audio capture state
  const [isAudioInitialized, setIsAudioInitialized] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [recordingDuration, setRecordingDuration] = useState(0);
  
  // Speech recognition state
  const [isSpeechInitialized, setIsSpeechInitialized] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [transcriptSegments, setTranscriptSegments] = useState([]);
  
  // General state
  const [error, setError] = useState(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [audioSource, setAudioSource] = useState(''); // 'system' or 'microphone'
  const [whisperModel, setWhisperModel] = useState('tiny.en');
  const [availableModels, setAvailableModels] = useState([]);
  const [modelInfo, setModelInfo] = useState({});
  
  // Service refs
  const audioServiceRef = useRef(null);
  const speechServiceRef = useRef(null);
  const recordingStartTimeRef = useRef(null);

  // Update recording duration
  useEffect(() => {
    let interval = null;
    
    if (isRecording && !isPaused && recordingStartTimeRef.current) {
      interval = setInterval(() => {
        const elapsed = Date.now() - recordingStartTimeRef.current;
        setRecordingDuration(Math.floor(elapsed / 1000));
      }, 1000);
    } else if (!isRecording) {
      setRecordingDuration(0);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isRecording, isPaused]);

  /**
   * Initialize system audio capture and speech recognition
   */
  const initializeSystemAudio = async () => {
    if (isInitializing) return;
    
    setIsInitializing(true);
    setError(null);
    
    try {
      // Initialize audio capture service
      const audioService = new AudioCaptureService();
      
      // Set up audio callbacks
      audioService.setAudioLevelCallback((level) => {
        setAudioLevel(level);
      });

      audioService.setRecordingStateCallback((state) => {
        setIsRecording(state.isRecording);
        setIsPaused(state.isPaused);
      });

      audioService.setErrorCallback((errorInfo) => {
        setError(errorInfo);
      });

      // Initialize with system audio preference
      const audioSuccess = await audioService.initialize(false);
      
      if (!audioSuccess) {
        throw new Error('Failed to initialize audio capture');
      }

      audioServiceRef.current = audioService;
      setIsAudioInitialized(true);
      setAudioSource('system');

      // Get the audio stream for speech recognition
      const audioStream = audioService.audioStream;
      
      // Initialize speech recognition with system audio
      const speechService = new SpeechService();
      
      // Set up speech callbacks
      speechService.setTranscriptUpdateCallback((segment) => {
        setCurrentTranscript(segment.text);
      });

      speechService.setSegmentCompleteCallback((segment) => {
        setTranscriptSegments(prev => [...prev, segment]);
        setCurrentTranscript('');
      });

      speechService.setErrorCallback((errorInfo) => {
        console.warn('Speech recognition error:', errorInfo);
        // Don't show speech errors as main errors since it's expected
        // that system audio transcription might have issues
      });

      speechService.setStatusChangeCallback((status) => {
        setIsTranscribing(status.status === 'listening');
      });

      // Configure Whisper model before initialization
      speechService.config.whisperModel = whisperModel;

      // Initialize speech service with audio stream
      const speechSuccess = await speechService.initialize(audioStream);
      
      if (speechSuccess) {
        speechServiceRef.current = speechService;
        setIsSpeechInitialized(true);
        
        // Load available models for future use
        if (speechService.whisperService) {
          try {
            const models = await speechService.whisperService.getAvailableModels();
            setAvailableModels(models);
            
            // Get info for current model
            const info = await speechService.whisperService.getModelInfo(`Xenova/whisper-${whisperModel}`);
            setModelInfo(prev => ({ ...prev, [`Xenova/whisper-${whisperModel}`]: info }));
          } catch (err) {
            console.warn('Failed to load model info:', err);
          }
        }
      } else {
        console.warn('Speech recognition initialization failed, audio capture still available');
      }

    } catch (err) {
      setError({
        message: 'Failed to initialize system audio capture',
        error: err
      });
    } finally {
      setIsInitializing(false);
    }
  };

  /**
   * Initialize microphone capture and speech recognition
   */
  const initializeMicrophone = async () => {
    if (isInitializing) return;
    
    setIsInitializing(true);
    setError(null);
    
    try {
      // Initialize audio capture service with microphone
      const audioService = new AudioCaptureService();
      
      audioService.setAudioLevelCallback((level) => {
        setAudioLevel(level);
      });

      audioService.setRecordingStateCallback((state) => {
        setIsRecording(state.isRecording);
        setIsPaused(state.isPaused);
      });

      audioService.setErrorCallback((errorInfo) => {
        setError(errorInfo);
      });

      const audioSuccess = await audioService.initialize(true);
      
      if (!audioSuccess) {
        throw new Error('Failed to initialize microphone');
      }

      audioServiceRef.current = audioService;
      setIsAudioInitialized(true);
      setAudioSource('microphone');

      // Initialize speech recognition without audio stream (uses Web Speech API)
      const speechService = new SpeechService();
      
      speechService.setTranscriptUpdateCallback((segment) => {
        setCurrentTranscript(segment.text);
      });

      speechService.setSegmentCompleteCallback((segment) => {
        setTranscriptSegments(prev => [...prev, segment]);
        setCurrentTranscript('');
      });

      speechService.setErrorCallback((errorInfo) => {
        setError(errorInfo);
      });

      speechService.setStatusChangeCallback((status) => {
        setIsTranscribing(status.status === 'listening');
      });

      const speechSuccess = await speechService.initialize();
      
      if (speechSuccess) {
        speechServiceRef.current = speechService;
        setIsSpeechInitialized(true);
      }

    } catch (err) {
      setError({
        message: 'Failed to initialize microphone',
        error: err
      });
    } finally {
      setIsInitializing(false);
    }
  };

  /**
   * Start recording and transcription
   */
  const startRecording = async () => {
    if (!audioServiceRef.current) return;
    
    setError(null);
    
    try {
      // Start audio recording
      const audioStarted = await audioServiceRef.current.startRecording();
      
      if (audioStarted) {
        recordingStartTimeRef.current = Date.now();
        setRecordingDuration(0);
        
        // Start speech recognition if available
        if (speechServiceRef.current) {
          await speechServiceRef.current.startListening();
        }
      }
    } catch (err) {
      setError({
        message: 'Failed to start recording',
        error: err
      });
    }
  };

  /**
   * Pause recording and transcription
   */
  const pauseRecording = () => {
    if (!audioServiceRef.current) return;
    
    try {
      audioServiceRef.current.pauseRecording();
      
      if (speechServiceRef.current) {
        speechServiceRef.current.pauseListening();
      }
    } catch (err) {
      setError({
        message: 'Failed to pause recording',
        error: err
      });
    }
  };

  /**
   * Resume recording and transcription
   */
  const resumeRecording = () => {
    if (!audioServiceRef.current) return;
    
    try {
      audioServiceRef.current.resumeRecording();
      
      if (speechServiceRef.current) {
        speechServiceRef.current.resumeListening();
      }
    } catch (err) {
      setError({
        message: 'Failed to resume recording',
        error: err
      });
    }
  };

  /**
   * Stop recording and transcription
   */
  const stopRecording = async () => {
    if (!audioServiceRef.current) return;
    
    try {
      // Stop speech recognition first
      if (speechServiceRef.current) {
        speechServiceRef.current.stopListening();
      }
      
      // Stop audio recording
      const audioBlob = await audioServiceRef.current.stopRecording();
      recordingStartTimeRef.current = null;
      setRecordingDuration(0);
      
      if (audioBlob) {
        console.log('Recording completed, audio blob size:', audioBlob.size);
      }
    } catch (err) {
      setError({
        message: 'Failed to stop recording',
        error: err
      });
    }
  };

  /**
   * Change Whisper model
   */
  const changeWhisperModel = async (newModel) => {
    if (!speechServiceRef.current?.whisperService || isRecording) {
      return;
    }

    setIsInitializing(true);
    setError(null);

    try {
      const success = await speechServiceRef.current.whisperService.changeModel(`Xenova/whisper-${newModel}`);
      
      if (success) {
        setWhisperModel(newModel);
        
        // Update model info
        const info = await speechServiceRef.current.whisperService.getModelInfo(`Xenova/whisper-${newModel}`);
        setModelInfo(prev => ({ ...prev, [`Xenova/whisper-${newModel}`]: info }));
      } else {
        throw new Error('Failed to change model');
      }
    } catch (err) {
      setError({
        message: 'Failed to change Whisper model',
        error: err
      });
    } finally {
      setIsInitializing(false);
    }
  };

  /**
   * Clear current error
   */
  const clearError = () => {
    setError(null);
  };

  /**
   * Format duration as MM:SS
   */
  const getFormattedDuration = () => {
    const minutes = Math.floor(recordingDuration / 60);
    const seconds = recordingDuration % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioServiceRef.current) {
        audioServiceRef.current.cleanup();
      }
      if (speechServiceRef.current) {
        speechServiceRef.current.cleanup();
      }
    };
  }, []);

  return (
    <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>
        Integrated Audio Capture & Transcription
      </Typography>

      {error && (
        <Alert severity="error" onClose={clearError} sx={{ mb: 2 }}>
          {error.message}
        </Alert>
      )}

      {/* Status Cards */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <Card sx={{ flex: 1, minWidth: 200 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Audio Status
            </Typography>
            <Typography>Source: {audioSource || 'None'}</Typography>
            <Typography>Recording: {isRecording ? '🔴' : '⚫'}</Typography>
            <Typography>Paused: {isPaused ? '⏸️' : '▶️'}</Typography>
            <Typography>Duration: {getFormattedDuration()}</Typography>
          </CardContent>
        </Card>

        <Card sx={{ flex: 1, minWidth: 200 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Speech Recognition
            </Typography>
            <Typography>Initialized: {isSpeechInitialized ? '✅' : '❌'}</Typography>
            <Typography>Transcribing: {isTranscribing ? '🎤' : '⚫'}</Typography>
            <Typography>Segments: {transcriptSegments.length}</Typography>
            <Typography>Mode: {speechServiceRef.current?.processingMode || 'None'}</Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Audio Level Indicator */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Audio Level
        </Typography>
        <LinearProgress
          variant="determinate"
          value={audioLevel}
          sx={{ height: 10, borderRadius: 5 }}
        />
        <Typography variant="body2" sx={{ mt: 1 }}>
          {Math.round(audioLevel)}%
        </Typography>
      </Box>

      {/* Model Selection */}
      {audioSource === 'system' && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Whisper Model Settings
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
              <FormControl sx={{ minWidth: 200 }}>
                <InputLabel>Whisper Model</InputLabel>
                <Select
                  value={whisperModel}
                  label="Whisper Model"
                  onChange={(e) => changeWhisperModel(e.target.value)}
                  disabled={isRecording || isInitializing}
                >
                  <MenuItem value="tiny.en">
                    <Box>
                      <Typography variant="body2">Tiny (39MB)</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Fastest, Good accuracy
                      </Typography>
                    </Box>
                  </MenuItem>
                  <MenuItem value="base.en">
                    <Box>
                      <Typography variant="body2">Base (74MB)</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Fast, Better accuracy
                      </Typography>
                    </Box>
                  </MenuItem>
                  <MenuItem value="small.en">
                    <Box>
                      <Typography variant="body2">Small (244MB)</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Medium speed, High accuracy
                      </Typography>
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>
              
              {isInitializing && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CircularProgress size={20} />
                  <Typography variant="body2">Loading model...</Typography>
                </Box>
              )}
              
              {modelInfo[`Xenova/whisper-${whisperModel}`] && (
                <Tooltip title={`Size: ${modelInfo[`Xenova/whisper-${whisperModel}`].size}, Speed: ${modelInfo[`Xenova/whisper-${whisperModel}`].speed}`}>
                  <Chip 
                    icon={<Settings />}
                    label={`Current: ${whisperModel}`}
                    variant="outlined"
                    size="small"
                  />
                </Tooltip>
              )}
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Control Buttons */}
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 3 }}>
        {!isAudioInitialized && (
          <>
            <Button
              variant="contained"
              onClick={initializeSystemAudio}
              disabled={isInitializing}
              startIcon={<DesktopWindows />}
            >
              {isInitializing ? 'Initializing...' : 'System Audio + Transcription'}
            </Button>
            <Button
              variant="outlined"
              onClick={initializeMicrophone}
              disabled={isInitializing}
              startIcon={<Mic />}
            >
              {isInitializing ? 'Initializing...' : 'Microphone + Transcription'}
            </Button>
          </>
        )}

        <Button
          variant="contained"
          color="success"
          onClick={startRecording}
          disabled={!isAudioInitialized || isRecording}
          startIcon={<VolumeUp />}
        >
          Start Recording
        </Button>

        <Button
          variant="contained"
          color="warning"
          onClick={pauseRecording}
          disabled={!isRecording || isPaused}
          startIcon={<Pause />}
        >
          Pause
        </Button>

        <Button
          variant="contained"
          color="info"
          onClick={resumeRecording}
          disabled={!isRecording || !isPaused}
          startIcon={<PlayArrow />}
        >
          Resume
        </Button>

        <Button
          variant="contained"
          color="error"
          onClick={stopRecording}
          disabled={!isRecording}
          startIcon={<Stop />}
        >
          Stop Recording
        </Button>
      </Box>

      {/* Live Transcript */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Live Transcript
          </Typography>
          {currentTranscript && (
            <Box sx={{ mb: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
              <Chip label="Live" color="primary" size="small" sx={{ mb: 1 }} />
              <Typography variant="body1" sx={{ fontStyle: 'italic' }}>
                {currentTranscript}
              </Typography>
            </Box>
          )}
          {transcriptSegments.length === 0 && !currentTranscript && (
            <Typography variant="body2" color="text.secondary">
              Start recording to see live transcription...
            </Typography>
          )}
        </CardContent>
      </Card>

      {/* Transcript History */}
      {transcriptSegments.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Transcript History ({transcriptSegments.length} segments)
            </Typography>
            <List sx={{ maxHeight: 300, overflow: 'auto' }}>
              {transcriptSegments.map((segment, index) => (
                <React.Fragment key={segment.id}>
                  <ListItem alignItems="flex-start">
                    <ListItemText
                      primary={segment.text}
                      secondary={
                        `${Math.round(segment.confidence * 100)}% confidence - ${new Date(segment.timestamp).toLocaleTimeString()}`
                      }
                    />
                  </ListItem>
                  {index < transcriptSegments.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      <Box sx={{ mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          Instructions
        </Typography>
        <Alert severity="info">
          <Typography variant="body2" component="div">
            <strong>System Audio + Transcription:</strong> Captures audio from your screen/applications 
            (like video meetings) and transcribes it using Whisper-based processing. This captures 
            ALL participants in a meeting.
            <br /><br />
            <strong>Microphone + Transcription:</strong> Captures audio from your microphone and 
            transcribes it using Web Speech API. This only captures your voice.
            <br /><br />
            <strong>Note:</strong> System audio transcription now uses real Whisper models 
            via Transformers.js. You can select different models for speed vs accuracy tradeoffs. 
            All processing happens locally in your browser for privacy.
          </Typography>
        </Alert>
      </Box>
    </Box>
  );
};

export default IntegratedAudioDemo;