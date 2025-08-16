import React, { useState, useEffect } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Container,
  Paper,
  Box,
  Chip,
  Alert,
  Tabs,
  Tab
} from '@mui/material';
import {
  Mic as MicIcon,
  Computer as ComputerIcon
} from '@mui/icons-material';
import AudioCaptureDemo from './AudioCaptureDemo';
import AudioControls from './AudioControls';
import SpeechServiceDemo from './SpeechServiceDemo';
import IntegratedAudioDemo from './IntegratedAudioDemo';
import TranscriptViewDemo from './TranscriptViewDemo';
import StorageServiceDemo from './StorageServiceDemo';
import AISummaryDemo from './AISummaryDemo';
import SummaryPanelDemo from './SummaryPanelDemo';
import ExportDemo from './ExportDemo';

const Dashboard = () => {
  const [appInfo, setAppInfo] = useState({
    version: 'Loading...',
    platform: 'Loading...'
  });
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    // Get app information from Electron
    const getAppInfo = async () => {
      try {
        if (window.electronAPI) {
          const version = await window.electronAPI.getAppVersion();
          const platformInfo = await window.electronAPI.getPlatformInfo();
          
          setAppInfo({
            version,
            platform: platformInfo.platform
          });
        } else {
          // Running in browser (development)
          setAppInfo({
            version: '1.0.0-dev',
            platform: 'web'
          });
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to get app info:', error);
        setAppInfo({
          version: 'Unknown',
          platform: 'Unknown'
        });
      }
    };

    getAppInfo();
  }, []);

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* App Bar */}
      <AppBar position="static" className="electron-drag">
        <Toolbar className="electron-no-drag">
          <MicIcon sx={{ mr: 2 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Real-Time Interview Summarizer
          </Typography>
          <Chip 
            label={`v${appInfo.version}`} 
            size="small" 
            variant="outlined" 
            sx={{ color: 'white', borderColor: 'white' }}
          />
        </Toolbar>
      </AppBar>

      {/* Main Content */}
      <Container maxWidth="lg" sx={{ flex: 1, py: 3 }}>
        <Box sx={{ height: '100%' }}>
          {/* Welcome Section */}
          <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
            <Box sx={{ textAlign: 'center' }}>
              <ComputerIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
              <Typography variant="h4" component="h1" gutterBottom>
                Welcome to Real-Time Interview Summarizer
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ maxWidth: '600px', mx: 'auto' }}>
                Capture audio from online meetings, convert speech to text in real-time, 
                and generate AI-powered summaries with document export capabilities.
              </Typography>
            </Box>
          </Paper>

          {/* System Information */}
          <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              System Information
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Application Version
                </Typography>
                <Typography variant="body1">
                  {appInfo.version}
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Platform
                </Typography>
                <Typography variant="body1" sx={{ textTransform: 'capitalize' }}>
                  {appInfo.platform}
                </Typography>
              </Box>
            </Box>
          </Paper>

          {/* Status Alert */}
          <Alert severity="success" sx={{ mb: 2 }}>
            <Typography variant="body2">
              ✅ Live Summary Display Interface is now complete! Features include: real-time summary display with smooth updates, topic segmentation visualization, processing indicators with confidence levels, loading states with estimated completion times, expandable sections, and copy functionality. Test the enhanced interface in the "Live Summary Panel" tab.
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', mt: 1, opacity: 0.7 }}>
              Task 9 completed: {new Date().toLocaleTimeString()}
            </Typography>
          </Alert>

          {/* Navigation Tabs */}
          <Paper elevation={1} sx={{ mb: 2 }}>
            <Tabs 
              value={activeTab} 
              onChange={(e, newValue) => setActiveTab(newValue)}
              variant="fullWidth"
            >
              <Tab label="Overview" />
              <Tab label="Audio Controls" />
              <Tab label="Audio Capture Demo" />
              <Tab label="Speech Service Demo" />
              <Tab label="Integrated Demo" />
              <Tab label="Transcript View Demo" />
              <Tab label="Storage Demo" />
              <Tab label="AI Summary Demo" />
              <Tab label="Live Summary Panel" />
              <Tab label="Export Demo" />
            </Tabs>
          </Paper>

          {/* Tab Content */}
          {activeTab === 0 && (
            <Paper elevation={1} sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Feature Status
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="body2">Project Foundation</Typography>
                  <Chip label="Complete" color="success" size="small" />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="body2">Audio Capture</Typography>
                  <Chip label="Complete" color="success" size="small" />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="body2">Audio Controls UI</Typography>
                  <Chip label="Complete" color="success" size="small" />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="body2">Speech-to-Text</Typography>
                  <Chip label="Complete" color="success" size="small" />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="body2">Live Transcription Display</Typography>
                  <Chip label="Complete" color="success" size="small" />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="body2">Local Data Storage</Typography>
                  <Chip label="Complete" color="success" size="small" />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="body2">AI Summarization (Enhanced)</Typography>
                  <Chip label="Complete" color="success" size="small" />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="body2">Live Summary Display Interface</Typography>
                  <Chip label="Complete" color="success" size="small" />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="body2">Document Export</Typography>
                  <Chip label="Complete" color="success" size="small" />
                </Box>
              </Box>
            </Paper>
          )}

          {activeTab === 1 && (
            <Paper elevation={1} sx={{ p: 2 }}>
              <AudioControls 
                onRecordingStateChange={(state) => {
                  console.log('Recording state changed:', state);
                }}
                onAudioData={(audioBlob) => {
                  console.log('Audio data received:', audioBlob);
                }}
              />
            </Paper>
          )}

          {activeTab === 2 && (
            <Paper elevation={1} sx={{ p: 2 }}>
              <AudioCaptureDemo />
            </Paper>
          )}

          {activeTab === 3 && (
            <Paper elevation={1} sx={{ p: 2 }}>
              <SpeechServiceDemo />
            </Paper>
          )}

          {activeTab === 4 && (
            <Paper elevation={1} sx={{ p: 2 }}>
              <IntegratedAudioDemo />
            </Paper>
          )}

          {activeTab === 5 && (
            <TranscriptViewDemo />
          )}

          {activeTab === 6 && (
            <Paper elevation={1} sx={{ p: 2 }}>
              <StorageServiceDemo />
            </Paper>
          )}

          {activeTab === 7 && (
            <AISummaryDemo />
          )}

          {activeTab === 8 && (
            <SummaryPanelDemo />
          )}

          {activeTab === 9 && (
            <Paper elevation={1} sx={{ p: 2 }}>
              <ExportDemo />
            </Paper>
          )}
        </Box>
      </Container>
    </Box>
  );
};

export default Dashboard;