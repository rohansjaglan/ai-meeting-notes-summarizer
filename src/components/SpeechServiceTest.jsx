import React, { useState, useEffect, useRef } from 'react';
import { Box, Button, Typography, Alert, Paper, List, ListItem, ListItemText } from '@mui/material';
import { Mic, MicOff, Stop } from '@mui/icons-material';
import SpeechService from '../services/speechService';

const SpeechServiceTest = () => {
  const [speechService] = useState(() => new SpeechService());
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [transcript, setTranscript] = useState('');
  const [segments, setSegments] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [serviceStatus, setServiceStatus] = useState({});

  useEffect(() => {
    // Set up speech service callbacks
    speechService.setStatusChangeCallback((statusUpdate) => {
      console.log('Status change:', statusUpdate);
      setStatus(statusUpdate.status);
      setServiceStatus(statusUpdate.serviceStatus);
      setIsListening(statusUpdate.serviceStatus.isListening);
    });

    speechService.setTranscriptUpdateCallback((segment) => {
      console.log('Transcript update:', segment);
      setTranscript(segment.text);
    });

    speechService.setSegmentCompleteCallback((segment) => {
      console.log('Segment complete:', segment);
      setSegments(prev => [...prev, segment]);
      setTranscript(''); // Clear interim transcript
    });

    speechService.setErrorCallback((error) => {
      console.error('Speech service error:', error);
      setError(error);
      setStatus('error');
    });

    return () => {
      speechService.cleanup();
    };
  }, [speechService]);

  const handleStart = async () => {
    setError(null);
    setSegments([]);
    setTranscript('');
    
    console.log('Starting speech recognition...');
    const success = await speechService.startListening();
    console.log('Start result:', success);
    
    if (!success) {
      setError({ message: 'Failed to start speech recognition' });
    }
  };

  const handleStop = () => {
    console.log('Stopping speech recognition...');
    speechService.stopListening();
  };

  const handleClearError = () => {
    setError(null);
  };

  const handleTestMicrophone = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('Microphone access granted');
      stream.getTracks().forEach(track => track.stop());
      setError(null);
    } catch (err) {
      console.error('Microphone access denied:', err);
      setError({ message: `Microphone access denied: ${err.message}` });
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>
        Speech Service Test
      </Typography>

      {error && (
        <Alert severity="error" onClose={handleClearError} sx={{ mb: 2 }}>
          <Typography variant="body2">
            <strong>Error Type:</strong> {error.type || 'Unknown'}
          </Typography>
          <Typography variant="body2">
            <strong>Message:</strong> {error.message}
          </Typography>
        </Alert>
      )}

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          Service Status
        </Typography>
        <Typography variant="body2">Status: {status}</Typography>
        <Typography variant="body2">Listening: {isListening ? '🔴 Yes' : '⚫ No'}</Typography>
        <Typography variant="body2">Initialized: {serviceStatus.isInitialized ? '✅' : '❌'}</Typography>
        <Typography variant="body2">Supported: {serviceStatus.isSupported ? '✅' : '❌'}</Typography>
        <Typography variant="body2">Segments: {serviceStatus.segmentCount || 0}</Typography>
        <Typography variant="body2">Retry Count: {serviceStatus.retryCount || 0}</Typography>
      </Paper>

      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <Button
          variant="contained"
          color="success"
          onClick={handleStart}
          disabled={isListening}
          startIcon={<Mic />}
        >
          Start Listening
        </Button>
        
        <Button
          variant="contained"
          color="error"
          onClick={handleStop}
          disabled={!isListening}
          startIcon={<Stop />}
        >
          Stop Listening
        </Button>

        <Button
          variant="outlined"
          onClick={handleTestMicrophone}
          startIcon={<MicOff />}
        >
          Test Microphone
        </Button>
      </Box>

      {transcript && (
        <Paper sx={{ p: 2, mb: 2, bgcolor: 'grey.100' }}>
          <Typography variant="h6" gutterBottom>
            Current Transcript (Interim)
          </Typography>
          <Typography variant="body1" sx={{ fontStyle: 'italic' }}>
            {transcript}
          </Typography>
        </Paper>
      )}

      {segments.length > 0 && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Transcript Segments ({segments.length})
          </Typography>
          <List dense>
            {segments.map((segment, index) => (
              <ListItem key={segment.id || index} divider>
                <ListItemText
                  primary={segment.text}
                  secondary={
                    <span>
                      Confidence: {Math.round((segment.confidence || 0) * 100)}% | 
                      Time: {new Date(segment.timestamp).toLocaleTimeString()} |
                      Final: {segment.isFinal ? '✅' : '❌'}
                    </span>
                  }
                />
              </ListItem>
            ))}
          </List>
        </Paper>
      )}

      <Paper sx={{ p: 2, mt: 2, bgcolor: 'info.light' }}>
        <Typography variant="h6" gutterBottom>
          Troubleshooting Tips
        </Typography>
        <Typography variant="body2" component="div">
          <ul>
            <li>Make sure you're using HTTPS (required for Web Speech API)</li>
            <li>Grant microphone permissions when prompted</li>
            <li>Check browser console for detailed error messages</li>
            <li>Try refreshing the page if you get network errors</li>
            <li>Network errors often mean recognition is already running - stop and restart</li>
          </ul>
        </Typography>
      </Paper>
    </Box>
  );
};

export default SpeechServiceTest;