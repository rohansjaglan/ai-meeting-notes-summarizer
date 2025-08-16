import { useState, useEffect, useRef, useCallback } from 'react';
import AudioCaptureService from '../services/audioCaptureService';

/**
 * Custom React hook for managing audio capture functionality
 * Provides state management and lifecycle handling for AudioCaptureService
 */
const useAudioCapture = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState(null);
  const [isInitializing, setIsInitializing] = useState(false);

  const audioServiceRef = useRef(null);
  const recordingStartTimeRef = useRef(null);
  const [recordingDuration, setRecordingDuration] = useState(0);

  // Update recording duration every second
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
   * Initialize audio capture service
   * @param {boolean} useMicrophone - If true, prefer microphone over system audio
   */
  const initialize = useCallback(async (useMicrophone = false) => {
    if (audioServiceRef.current || isInitializing) {
      return;
    }

    setIsInitializing(true);
    setError(null);

    try {
      const audioService = new AudioCaptureService();
      
      // Set up callbacks
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

      // Initialize the service with fallback options
      const success = await audioService.initialize(useMicrophone);
      
      if (success) {
        audioServiceRef.current = audioService;
        setIsInitialized(true);
      } else {
        throw new Error('Failed to initialize audio capture service');
      }
    } catch (err) {
      setError({
        message: 'Failed to initialize audio capture',
        error: err
      });
    } finally {
      setIsInitializing(false);
    }
  }, [isInitializing]);

  /**
   * Start audio recording
   */
  const startRecording = useCallback(async () => {
    if (!audioServiceRef.current || isRecording) {
      return false;
    }

    setError(null);
    
    try {
      const success = await audioServiceRef.current.startRecording();
      if (success) {
        recordingStartTimeRef.current = Date.now();
        setRecordingDuration(0);
      }
      return success;
    } catch (err) {
      setError({
        message: 'Failed to start recording',
        error: err
      });
      return false;
    }
  }, [isRecording]);

  /**
   * Pause audio recording
   */
  const pauseRecording = useCallback(() => {
    if (!audioServiceRef.current || !isRecording || isPaused) {
      return false;
    }

    setError(null);
    
    try {
      return audioServiceRef.current.pauseRecording();
    } catch (err) {
      setError({
        message: 'Failed to pause recording',
        error: err
      });
      return false;
    }
  }, [isRecording, isPaused]);

  /**
   * Resume audio recording
   */
  const resumeRecording = useCallback(() => {
    if (!audioServiceRef.current || !isRecording || !isPaused) {
      return false;
    }

    setError(null);
    
    try {
      return audioServiceRef.current.resumeRecording();
    } catch (err) {
      setError({
        message: 'Failed to resume recording',
        error: err
      });
      return false;
    }
  }, [isRecording, isPaused]);

  /**
   * Stop audio recording
   */
  const stopRecording = useCallback(async () => {
    if (!audioServiceRef.current || !isRecording) {
      return null;
    }

    setError(null);
    
    try {
      const audioBlob = await audioServiceRef.current.stopRecording();
      recordingStartTimeRef.current = null;
      setRecordingDuration(0);
      return audioBlob;
    } catch (err) {
      setError({
        message: 'Failed to stop recording',
        error: err
      });
      return null;
    }
  }, [isRecording]);

  /**
   * Get current recording state
   */
  const getRecordingState = useCallback(() => {
    if (!audioServiceRef.current) {
      return {
        isRecording: false,
        isPaused: false,
        audioLevel: 0,
        isInitialized: false
      };
    }

    return audioServiceRef.current.getRecordingState();
  }, []);

  /**
   * Clear current error
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Format recording duration as MM:SS
   */
  const getFormattedDuration = useCallback(() => {
    const minutes = Math.floor(recordingDuration / 60);
    const seconds = recordingDuration % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, [recordingDuration]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioServiceRef.current) {
        audioServiceRef.current.cleanup();
        audioServiceRef.current = null;
      }
    };
  }, []);

  return {
    // State
    isInitialized,
    isInitializing,
    isRecording,
    isPaused,
    audioLevel,
    error,
    recordingDuration,
    
    // Actions
    initialize,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    clearError,
    
    // Utilities
    getRecordingState,
    getFormattedDuration,
    
    // Computed state
    canRecord: isInitialized && !isRecording,
    canPause: isInitialized && isRecording && !isPaused,
    canResume: isInitialized && isRecording && isPaused,
    canStop: isInitialized && isRecording
  };
};

export default useAudioCapture;