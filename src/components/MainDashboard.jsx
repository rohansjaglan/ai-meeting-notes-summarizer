import React, { useState, useEffect, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Container,
  Tabs,
  Tab,
  Paper,
  IconButton,
  Tooltip,
  Snackbar,
  Alert,
  Switch,
  FormControlLabel,
  Badge,
  Chip,
  useTheme,
  useMediaQuery,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider
} from '@mui/material';
import {
  Mic as MicIcon,
  Psychology as PsychologyIcon,
  Description as TranscriptIcon,
  Close as CloseIcon,
  LightMode as LightModeIcon,
  DarkMode as DarkModeIcon,
  Menu as MenuIcon,
  Notifications as NotificationsIcon
} from '@mui/icons-material';

// Import components
import TranscriptView from './TranscriptView';
import SummaryPanel from './SummaryPanel';

import AudioControls from './AudioControls';

import AIConfigDialog from './AIConfigDialog';

// Import hooks
import useAudioCapture from '../hooks/useAudioCapture';
import useTranscription from '../hooks/useTranscription';
import useSummary from '../hooks/useSummary';

// Import services
import SearchService from '../services/searchService';
import storageService from '../services/storageService';

/**
 * MainDashboard - Integrated dashboard interface for the Real-Time Interview Summarizer
 * Features:
 * - Tabbed interface for transcription, summary, and search views
 * - Responsive layout with proper component organization
 * - Dark/light theme support with user preferences
 * - Notification system for user feedback and status updates
 * - Real-time integration of all major features
 */
const MainDashboard = ({ 
  onThemeChange, 
  isDarkMode = false,
  initialTab = 0 
}) => {
  // State management
  const [activeTab, setActiveTab] = useState(initialTab);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  
  const [aiConfigDialogOpen, setAiConfigDialogOpen] = useState(false);
  const [isRecordingSession, setIsRecordingSession] = useState(false);
  const [sessionStats, setSessionStats] = useState({
    duration: 0,
    transcriptWords: 0,
    summaryGenerated: false
  });

  // Services
  const [searchService] = useState(() => new SearchService(storageService));
  // Use the singleton storageService instance

  // Hooks for feature management
  const audioCapture = useAudioCapture();
  const transcription = useTranscription();
  const summary = useSummary();

  // Theme and responsive
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isTablet = useMediaQuery(theme.breakpoints.down('lg'));

  // Refs
  const sessionStartTimeRef = useRef(null);
  const notificationIdRef = useRef(0);
  const servicesInitializedRef = useRef(false);

  /**
   * Add notification to the queue
   */
  const addNotification = useCallback((message, severity = 'info', duration = 6000) => {
    const id = ++notificationIdRef.current;
    const notification = {
      id,
      message,
      severity,
      timestamp: Date.now(),
      duration
    };

    setNotifications(prev => [...prev, notification]);

    // Auto-remove notification after duration
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, duration);
  }, []);

  /**
   * Remove notification by ID
   */
  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  // Tab configuration
  const tabs = [
    {
      label: 'Live Session',
      icon: <TranscriptIcon />,
      value: 0,
      badge: isRecordingSession ? 'LIVE' : null,
      badgeColor: 'error'
    },
    {
      label: 'AI Summary',
      icon: <PsychologyIcon />,
      value: 1,
      badge: summary.isGenerating ? 'PROCESSING' : (summary.hasSummary ? 'READY' : null),
      badgeColor: summary.isGenerating ? 'warning' : 'success'
    }
  ];

  // Initialize services on mount
  useEffect(() => {
    // Prevent multiple initializations
    if (servicesInitializedRef.current) {
      return;
    }

    const initializeServices = async () => {
      try {
        // Initialize storage service
        await storageService.initialize();
        
        // Initialize search service with storage
        await searchService.initialize(storageService);
        
        // Small delay to ensure services are ready
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Initialize audio capture
        await audioCapture.initialize();
        
        // Initialize transcription
        await transcription.initialize();
        
        // Initialize AI service (will need API key from user)
        // This will be handled when user starts a session
        
        servicesInitializedRef.current = true;
        addNotification('Services initialized successfully', 'success');
      } catch (error) {
        // Failed to initialize services
        addNotification('Failed to initialize some services', 'error');
      }
    };

    initializeServices();
  }, [addNotification, audioCapture, searchService, transcription]);

  // Session duration tracking
  useEffect(() => {
    let interval = null;
    
    if (isRecordingSession && sessionStartTimeRef.current) {
      interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - sessionStartTimeRef.current) / 1000);
        setSessionStats(prev => ({ ...prev, duration: elapsed }));
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecordingSession]);

  // Update session stats based on transcript (debounced to prevent performance issues)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (transcription && transcription.transcriptSegments && Array.isArray(transcription.transcriptSegments)) {
        const fullTranscript = transcription.getFullTranscript();
        const wordCount = fullTranscript ? fullTranscript.split(/\s+/).length : 0;
        setSessionStats(prev => ({ 
          ...prev, 
          transcriptWords: wordCount,
          summaryGenerated: summary.hasSummary
        }));
      }
    }, 500); // Debounce for 500ms

    return () => clearTimeout(timeoutId);
  }, [transcription, summary.hasSummary]);

  // Auto-generate summary when transcript reaches thresholds (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (isRecordingSession && transcription.transcriptSegments.length > 0) {
        summary.autoGenerateSummary(transcription.transcriptSegments, {
          minSegments: 5,
          minWords: 50,
          intervalSeconds: 30,
          enableAutoGeneration: true
        });
      }
    }, 1000); // Debounce for 1 second to prevent excessive calls

    return () => clearTimeout(timeoutId);
  }, [transcription.transcriptSegments, isRecordingSession, summary]);

  /**
   * Handle recording state changes
   */
  const handleRecordingStateChange = useCallback(async (state) => {
    if (state.isRecording && !isRecordingSession) {
      // Start new session
      setIsRecordingSession(true);
      sessionStartTimeRef.current = Date.now();
      setSessionStats({ duration: 0, transcriptWords: 0, summaryGenerated: false });
      
      // Start transcription
      await transcription.startListening();
      
      addNotification('Recording session started', 'success');
      
      // Switch to live session tab
      setActiveTab(0);
    } else if (!state.isRecording && isRecordingSession) {
      // End session
      setIsRecordingSession(false);
      sessionStartTimeRef.current = null;
      
      // Stop transcription
      transcription.stopListening();
      
      // Generate final summary if we have content
      if (transcription.transcriptSegments.length > 0) {
        await summary.generateSummary(transcription.transcriptSegments);
      }
      
      // Save session to storage
      try {
        // Ensure storage service is initialized
        if (!storageService.isInitialized) {
          await storageService.initialize();
        }
        
        const sessionData = {
          id: `session_${Date.now()}`,
          date: new Date().toISOString(),
          duration: sessionStats.duration,
          transcript: transcription.getAllSegments(),
          summary: summary.currentSummary,
          metadata: {
            platform: 'unknown',
            audioQuality: 1.0,
            processingTime: summary.currentSummary?.processingTime || 0
          }
        };
        
        await storageService.saveMeetingSession(sessionData);
        addNotification('Session saved successfully', 'success');
      } catch (error) {
        // Failed to save session
        addNotification('Failed to save session: ' + (error.message || 'Unknown error'), 'error');
      }
    }
  }, [isRecordingSession, transcription, summary, sessionStats.duration, addNotification]);

  /**
   * Handle tab change
   */
  const handleTabChange = useCallback((event, newValue) => {
    setActiveTab(newValue);
    
    // Close mobile drawer when tab changes
    if (isMobile) {
      setMobileDrawerOpen(false);
    }
  }, [isMobile]);

  /**
   * Handle theme toggle
   */
  const handleThemeToggle = useCallback(() => {
    if (onThemeChange) {
      onThemeChange(!isDarkMode);
    }
  }, [isDarkMode, onThemeChange]);

  /**
   * Handle AI service configuration
   */
  const handleAIConfiguration = useCallback(async (apiKey) => {
    try {
      await summary.initialize(apiKey);
      addNotification('AI service configured successfully', 'success');
      if (transcription.transcriptSegments.length > 0) {
        await summary.generateSummary(transcription.transcriptSegments);
      }
    } catch (error) {
      addNotification(`Failed to configure AI service: ${error.message}`, 'error');
      throw error;
    }
  }, [summary, addNotification, transcription.transcriptSegments]);

 
  /**
   * Format session duration
   */
  const formatDuration = useCallback((seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }, []);

  /**
   * Render mobile drawer
   */
  const renderMobileDrawer = () => (
    <Drawer
      anchor="left"
      open={mobileDrawerOpen}
      onClose={() => setMobileDrawerOpen(false)}
      sx={{
        '& .MuiDrawer-paper': {
          width: 280,
          boxSizing: 'border-box'
        }
      }}
    >
      <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">
          Interview Summarizer
        </Typography>
        <IconButton 
          onClick={() => setMobileDrawerOpen(false)}
          aria-label="Close navigation drawer"
        >
          <CloseIcon />
        </IconButton>
      </Box>
      
      <Divider />
      
      <List>
        {tabs.map((tab) => (
          <ListItem key={tab.value} disablePadding>
            <ListItemButton
              selected={activeTab === tab.value}
              onClick={() => handleTabChange(null, tab.value)}
            >
              <ListItemIcon>
                {tab.badge ? (
                  <Badge badgeContent={tab.badge} color={tab.badgeColor}>
                    {tab.icon}
                  </Badge>
                ) : (
                  tab.icon
                )}
              </ListItemIcon>
              <ListItemText primary={tab.label} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      
      <Divider />
      
      <Box sx={{ p: 2 }}>
        <FormControlLabel
          control={
            <Switch
              checked={isDarkMode}
              onChange={handleThemeToggle}
              icon={<LightModeIcon />}
              checkedIcon={<DarkModeIcon />}
            />
          }
          label={isDarkMode ? 'Light Mode' : 'Dark Mode'}
        />
      </Box>
    </Drawer>
  );

  /**
   * Render session stats
   */
  const renderSessionStats = () => (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
      {isRecordingSession && (
        <Chip
          label="LIVE"
          color="error"
          size="small"
          sx={{ 
            '@keyframes pulse': {
              '0%': { opacity: 1 },
              '50%': { opacity: 0.5 },
              '100%': { opacity: 1 }
            },
            animation: 'pulse 2s infinite'
          }}
        />
      )}
      
      <Chip
        label={formatDuration(sessionStats.duration)}
        size="small"
        variant="outlined"
      />
      
      {sessionStats.transcriptWords > 0 && (
        <Chip
          label={`${sessionStats.transcriptWords} words`}
          size="small"
          variant="outlined"
        />
      )}
    </Box>
  );

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* App Bar */}
      <AppBar position="static" elevation={1}>
        <Toolbar>
          {isMobile && (
            <IconButton
              edge="start"
              color="inherit"
              onClick={() => setMobileDrawerOpen(true)}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
          )}
          
          <MicIcon sx={{ mr: 2 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Real-Time Interview Summarizer
          </Typography>
          
          {!isMobile && renderSessionStats()}
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 2 }}>
            {notifications.length > 0 && (
              <Badge badgeContent={notifications.length} color="error">
                <NotificationsIcon />
              </Badge>
            )}
            
           
            {!isMobile && (
              <Tooltip title={isDarkMode ? 'Light Mode' : 'Dark Mode'}>
                <IconButton color="inherit" onClick={handleThemeToggle}>
                  {isDarkMode ? <LightModeIcon /> : <DarkModeIcon />}
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Toolbar>
        
        {/* Mobile session stats */}
        {isMobile && (
          <Box sx={{ px: 2, pb: 1 }}>
            {renderSessionStats()}
          </Box>
        )}
      </AppBar>

      {/* Mobile Drawer */}
      {isMobile && renderMobileDrawer()}

      {/* Main Content */}
      <Container 
        maxWidth={false} 
        sx={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column',
          p: { xs: 1, sm: 2, md: 3 },
          overflow: 'hidden'
        }}
      >
        {/* Navigation Tabs - Desktop */}
        {!isMobile && (
          <Paper elevation={1} sx={{ mb: 2 }}>
            <Tabs 
              value={activeTab} 
              onChange={handleTabChange}
              variant={isTablet ? 'fullWidth' : 'standard'}
              centered={!isTablet}
            >
              {tabs.map((tab) => (
                <Tab
                  key={tab.value}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {tab.badge ? (
                        <Badge badgeContent={tab.badge} color={tab.badgeColor}>
                          {tab.icon}
                        </Badge>
                      ) : (
                        tab.icon
                      )}
                      <span>{tab.label}</span>
                    </Box>
                  }
                />
              ))}
            </Tabs>
          </Paper>
        )}

        {/* Tab Content */}
        <Box sx={{ flex: 1, overflow: 'hidden' }}>
          {/* Live Session Tab */}
          {activeTab === 0 && (
            <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* Audio Controls */}
              <Paper elevation={2} sx={{ p: 2 }}>
                <AudioControls
                  onRecordingStateChange={handleRecordingStateChange}
                  onAudioData={(audioBlob) => {
                    // Handle audio data if needed
                    // Audio data received
                  }}
                />
              </Paper>

              {/* Live Transcript */}
              <Box sx={{ flex: 1, minHeight: 0 }}>
                <TranscriptView
                  transcriptSegments={transcription.transcriptSegments}
                  currentTranscript={transcription.currentTranscript}
                  isListening={transcription.isListening}
                  processingMode={transcription.processingMode}
                  onClearTranscript={transcription.clearTranscript}
                  showTimestamps={true}
                  showConfidence={true}
                  autoScroll={true}
                />
              </Box>
            </Box>
          )}

          {/* AI Summary Tab */}
          {activeTab === 1 && (
            <Box sx={{ height: '100%' }}>
              <SummaryPanel
                summary={summary.currentSummary}
                isGenerating={summary.isGenerating}
                processingProgress={summary.processingProgress}
                estimatedTimeRemaining={summary.estimatedTimeRemaining}
                onRefreshSummary={summary.refreshSummary}
                onCopySummary={(section, content) => {
                  addNotification(`${section} copied to clipboard`, 'success', 3000);
                }}
                showTopicSegmentation={true}
                showProcessingDetails={true}
                autoUpdate={true}
                onConfigureAI={() => {
                  setAiConfigDialogOpen(true);
                }}
              />
            </Box>
          )}
        </Box>
      </Container>

     

      {/* AI Configuration Dialog */}
      <AIConfigDialog
        open={aiConfigDialogOpen}
        onClose={() => setAiConfigDialogOpen(false)}
        onConfigure={handleAIConfiguration}
      />

      {/* Notifications */}
      {notifications.map((notification) => (
        <Snackbar
          key={notification.id}
          open={true}
          autoHideDuration={notification.duration}
          onClose={() => removeNotification(notification.id)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          sx={{ 
            position: 'fixed',
            bottom: 16 + (notifications.indexOf(notification) * 70),
            right: 16,
            zIndex: theme.zIndex.snackbar + notification.id
          }}
        >
          <Alert 
            onClose={() => removeNotification(notification.id)} 
            severity={notification.severity}
            variant="filled"
          >
            {notification.message}
          </Alert>
        </Snackbar>
      ))}
    </Box>
  );
};

// PropTypes definition outside the component
MainDashboard.propTypes = {
  onThemeChange: PropTypes.func.isRequired,
  isDarkMode: PropTypes.bool,
  initialTab: PropTypes.number
};

export default MainDashboard;