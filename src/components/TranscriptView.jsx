import React, { useEffect, useRef, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  IconButton,
  Tooltip,
  Alert,
  LinearProgress,
  Divider
} from '@mui/material';
import {
  VolumeUp,
  VolumeOff,
  AccessTime,
  SignalCellularAlt,
  Clear,
  ContentCopy
} from '@mui/icons-material';

/**
 * TranscriptView component for displaying real-time speech-to-text transcription
 * Features:
 * - Real-time text display with continuous flow
 * - Timestamp display for each segment
 * - Confidence indicators with visual feedback
 * - Auto-scrolling for readability
 * - Text formatting and styling
 */
const TranscriptView = ({
  transcriptSegments = [],
  currentTranscript = '',
  isListening = false,
  processingMode = 'webspeech',
  onClearTranscript,
  showTimestamps = true,
  showConfidence = true,
  autoScroll = true,
  maxHeight = 400
}) => {
  const scrollContainerRef = useRef(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(autoScroll);
  const [copiedSegmentId, setCopiedSegmentId] = useState(null);

  // Auto-scroll to bottom when new content is added
  useEffect(() => {
    if (shouldAutoScroll && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
      
      if (isNearBottom || transcriptSegments.length === 0) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, [transcriptSegments, currentTranscript, shouldAutoScroll]);

  // Handle manual scrolling to disable auto-scroll
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    
    const container = scrollContainerRef.current;
    const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 10;
    
    setShouldAutoScroll(isAtBottom);
  };

  /**
   * Format timestamp for display
   * @param {number} timestamp - Timestamp in milliseconds
   * @param {number} sessionStart - Session start timestamp
   * @returns {string} Formatted time string
   */
  const formatTimestamp = (timestamp, sessionStart) => {
    if (!sessionStart) return '00:00';
    
    const elapsed = Math.floor((timestamp - sessionStart) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  /**
   * Get confidence level styling
   * @param {string} confidenceLevel - Confidence level (high, medium, low, very-low)
   * @returns {object} Style object
   */
  const getConfidenceStyle = (confidenceLevel) => {
    const styles = {
      'high': { color: '#4caf50', backgroundColor: '#e8f5e8' },
      'medium': { color: '#ff9800', backgroundColor: '#fff3e0' },
      'low': { color: '#f44336', backgroundColor: '#ffebee' },
      'very-low': { color: '#9e9e9e', backgroundColor: '#f5f5f5' }
    };
    
    return styles[confidenceLevel] || styles['medium'];
  };

  /**
   * Get confidence icon based on level
   * @param {string} confidenceLevel - Confidence level
   * @returns {JSX.Element} Icon component
   */
  const getConfidenceIcon = (confidenceLevel) => {
    const iconProps = { fontSize: 'small' };
    
    switch (confidenceLevel) {
      case 'high':
        return <SignalCellularAlt {...iconProps} />;
      case 'medium':
        return <SignalCellularAlt {...iconProps} style={{ opacity: 0.7 }} />;
      case 'low':
        return <SignalCellularAlt {...iconProps} style={{ opacity: 0.5 }} />;
      case 'very-low':
        return <SignalCellularAlt {...iconProps} style={{ opacity: 0.3 }} />;
      default:
        return <SignalCellularAlt {...iconProps} style={{ opacity: 0.5 }} />;
    }
  };

  /**
   * Copy segment text to clipboard
   * @param {object} segment - Transcript segment
   */
  const copySegmentText = async (segment) => {
    try {
      await navigator.clipboard.writeText(segment.text);
      setCopiedSegmentId(segment.id);
      setTimeout(() => setCopiedSegmentId(null), 2000);
    } catch (error) {
      console.error('Failed to copy text:', error);
    }
  };

  /**
   * Copy full transcript to clipboard
   */
  const copyFullTranscript = async () => {
    try {
      const fullText = transcriptSegments
        .filter(segment => segment.isFinal)
        .map(segment => segment.text)
        .join(' ');
      
      await navigator.clipboard.writeText(fullText);
      setCopiedSegmentId('full');
      setTimeout(() => setCopiedSegmentId(null), 2000);
    } catch (error) {
      console.error('Failed to copy full transcript:', error);
    }
  };

  const sessionStartTime = transcriptSegments.length > 0 ? 
    Math.min(...transcriptSegments.map(s => s.timestamp)) : 
    Date.now();

  const hasContent = transcriptSegments.length > 0 || currentTranscript.length > 0;

  return (
    <Paper 
      elevation={2} 
      sx={{ 
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      {/* Header */}
      <Box sx={{ 
        p: 2, 
        borderBottom: 1, 
        borderColor: 'divider',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h6" component="h2">
            Live Transcript
          </Typography>
          
          {isListening && (
            <Chip
              icon={<VolumeUp />}
              label="Listening"
              color="success"
              size="small"
              variant="outlined"
            />
          )}
          
          <Chip
            label={processingMode === 'whisper' ? 'System Audio' : 'Microphone'}
            size="small"
            variant="outlined"
            color={processingMode === 'whisper' ? 'primary' : 'secondary'}
          />
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {hasContent && (
            <>
              <Tooltip title="Copy full transcript">
                <IconButton 
                  size="small" 
                  onClick={copyFullTranscript}
                  color={copiedSegmentId === 'full' ? 'success' : 'default'}
                >
                  <ContentCopy fontSize="small" />
                </IconButton>
              </Tooltip>
              
              <Tooltip title="Clear transcript">
                <IconButton 
                  size="small" 
                  onClick={onClearTranscript}
                  color="error"
                >
                  <Clear fontSize="small" />
                </IconButton>
              </Tooltip>
            </>
          )}
        </Box>
      </Box>

      {/* Processing indicator */}
      {isListening && (
        <LinearProgress 
          variant="indeterminate" 
          sx={{ height: 2 }}
          color="primary"
        />
      )}

      {/* Transcript content */}
      <Box
        ref={scrollContainerRef}
        onScroll={handleScroll}
        data-testid="transcript-scroll-container"
        sx={{
          flex: 1,
          overflow: 'auto',
          p: 2,
          maxHeight: maxHeight,
          minHeight: 200
        }}
      >
        {!hasContent && !isListening && (
          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2">
              Start recording to see live transcription here. 
              {processingMode === 'whisper' ? 
                ' System audio will be processed using Whisper AI.' :
                ' Microphone input will be processed using Web Speech API.'
              }
            </Typography>
          </Alert>
        )}

        {!hasContent && isListening && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <VolumeOff sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
            <Typography variant="body1" color="text.secondary">
              Listening for speech...
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Start speaking to see transcription appear here
            </Typography>
          </Box>
        )}

        {/* Final transcript segments */}
        {transcriptSegments
          .filter(segment => segment.isFinal)
          .map((segment, index) => (
            <Box key={segment.id} sx={{ mb: 2 }}>
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'flex-start', 
                gap: 1,
                mb: 1
              }}>
                {showTimestamps && (
                  <Chip
                    icon={<AccessTime />}
                    label={formatTimestamp(segment.timestamp, sessionStartTime)}
                    size="small"
                    variant="outlined"
                    sx={{ minWidth: 80 }}
                  />
                )}
                
                {showConfidence && (
                  <Tooltip title={`Confidence: ${Math.round(segment.confidence * 100)}%`}>
                    <Chip
                      icon={getConfidenceIcon(segment.confidenceLevel)}
                      label={segment.confidenceLevel}
                      size="small"
                      variant="outlined"
                      sx={getConfidenceStyle(segment.confidenceLevel)}
                    />
                  </Tooltip>
                )}

                <Tooltip title="Copy text">
                  <IconButton 
                    size="small" 
                    onClick={() => copySegmentText(segment)}
                    sx={{ ml: 'auto' }}
                    color={copiedSegmentId === segment.id ? 'success' : 'default'}
                  >
                    <ContentCopy fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
              
              <Typography 
                variant="body1" 
                sx={{ 
                  lineHeight: 1.6,
                  wordBreak: 'break-word',
                  pl: showTimestamps || showConfidence ? 2 : 0
                }}
              >
                {segment.text}
              </Typography>
              
              {index < transcriptSegments.filter(s => s.isFinal).length - 1 && (
                <Divider sx={{ mt: 2 }} />
              )}
            </Box>
          ))}

        {/* Current interim transcript */}
        {currentTranscript && (
          <Box sx={{ 
            mt: transcriptSegments.filter(s => s.isFinal).length > 0 ? 2 : 0,
            p: 2,
            backgroundColor: 'action.hover',
            borderRadius: 1,
            border: '1px dashed',
            borderColor: 'primary.main'
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Chip
                label="Processing..."
                size="small"
                color="primary"
                variant="outlined"
              />
            </Box>
            
            <Typography 
              variant="body1" 
              sx={{ 
                fontStyle: 'italic',
                opacity: 0.8,
                lineHeight: 1.6,
                wordBreak: 'break-word'
              }}
            >
              {currentTranscript}
            </Typography>
          </Box>
        )}

        {/* Auto-scroll indicator */}
        {!shouldAutoScroll && hasContent && (
          <Box sx={{ 
            position: 'sticky', 
            bottom: 0, 
            textAlign: 'center', 
            py: 1 
          }}>
            <Chip
              label="Scroll to bottom for auto-scroll"
              size="small"
              variant="outlined"
              onClick={() => {
                if (scrollContainerRef.current) {
                  scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
                }
              }}
              sx={{ cursor: 'pointer' }}
            />
          </Box>
        )}
      </Box>

      {/* Footer with stats */}
      {hasContent && (
        <Box sx={{ 
          p: 1, 
          borderTop: 1, 
          borderColor: 'divider',
          backgroundColor: 'background.default'
        }}>
          <Typography variant="caption" color="text.secondary">
            {transcriptSegments.filter(s => s.isFinal).length} segments • {' '}
            {transcriptSegments
              .filter(s => s.isFinal)
              .map(s => s.text)
              .join(' ')
              .split(' ')
              .length} words
          </Typography>
        </Box>
      )}
    </Paper>
  );
};

export default TranscriptView;