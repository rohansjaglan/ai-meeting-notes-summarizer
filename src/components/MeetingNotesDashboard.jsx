import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Button,
  Alert,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Chip,
  CircularProgress,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField
} from '@mui/material';
import {
  CloudUpload,
  Psychology,
  Edit,
  Share,
  CheckCircle,
  Settings
} from '@mui/icons-material';

// Import components
import TextUpload from './TextUpload';
import CustomPromptInput from './CustomPromptInput';
import EditableSummary from './EditableSummary';
import EmailShare from './EmailShare';

// Import services
import summaryService from '../services/summaryService';

/**
 * MeetingNotesDashboard - Main dashboard for the AI meeting notes summarizer
 * Workflow: Upload → Customize → Generate → Edit → Share
 */
const MeetingNotesDashboard = () => {
  // State management
  const [activeStep, setActiveStep] = useState(0);
  const [uploadedText, setUploadedText] = useState('');
  const [fileName, setFileName] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [summary, setSummary] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'info' });
  
  // API Key management
  const [apiKeyDialog, setApiKeyDialog] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [isServiceInitialized, setIsServiceInitialized] = useState(false);
  
  // Email sharing
  const [emailShareOpen, setEmailShareOpen] = useState(false);

  // Check if service is initialized on mount
  useEffect(() => {
    const status = summaryService.getStatus();
    setIsServiceInitialized(status.isInitialized);
    
    // Check for stored API key
    const storedKey = localStorage.getItem('gemini_api_key');
    if (storedKey && !status.isInitialized) {
      initializeService(storedKey);
    }
  }, []);

  /**
   * Initialize the AI service
   */
  const initializeService = async (key) => {
    try {
      await summaryService.initialize(key);
      setIsServiceInitialized(true);
      setApiKey(key);
      localStorage.setItem('gemini_api_key', key);
      showNotification('AI service initialized successfully', 'success');
    } catch (error) {
      showNotification(`Failed to initialize AI service: ${error.message}`, 'error');
    }
  };

  /**
   * Show notification
   */
  const showNotification = (message, severity = 'info') => {
    setNotification({ open: true, message, severity });
  };

  /**
   * Handle text upload
   */
  const handleTextUpload = useCallback((text, filename) => {
    setUploadedText(text);
    setFileName(filename);
    setError('');
    
    if (text.trim()) {
      setActiveStep(1);
      showNotification('Transcript uploaded successfully', 'success');
    }
  }, []);

  /**
   * Handle prompt change
   */
  const handlePromptChange = useCallback((prompt) => {
    setCustomPrompt(prompt);
  }, []);

  /**
   * Generate summary
   */
  const handleGenerateSummary = async () => {
    if (!uploadedText.trim()) {
      setError('Please upload a transcript first');
      return;
    }

    if (!isServiceInitialized) {
      setApiKeyDialog(true);
      return;
    }

    setIsGenerating(true);
    setError('');

    try {
      const result = await summaryService.generateSummary(uploadedText, customPrompt);
      setSummary(result);
      setActiveStep(2);
      showNotification('Summary generated successfully', 'success');
    } catch (error) {
      setError(error.message);
      showNotification(`Failed to generate summary: ${error.message}`, 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  /**
   * Handle summary update
   */
  const handleSummaryUpdate = useCallback(async (updatedSummary) => {
    setSummary(updatedSummary);
    showNotification('Summary updated successfully', 'success');
  }, []);

  /**
   * Handle email share
   */
  const handleEmailShare = async (emailData) => {
    try {
      // Option 1: Open default email client (works immediately)
      const subject = encodeURIComponent(emailData.subject);
      const body = encodeURIComponent(emailData.content);
      const recipients = emailData.recipients.join(',');
      
      const mailtoLink = `mailto:${recipients}?subject=${subject}&body=${body}`;
      
      // Open email client
      window.open(mailtoLink);
      
      showNotification(`Email client opened with ${emailData.recipients.length} recipient(s)`, 'success');
    } catch (error) {
      throw new Error('Failed to open email client. Please try again.');
    }
  };

  /**
   * Handle export
   */
  const handleExport = (summary) => {
    try {
      const content = `MEETING SUMMARY
Generated: ${new Date(summary.generatedAt).toLocaleString()}
${summary.fileName ? `Source: ${summary.fileName}` : ''}

${summary.content}

${summary.keyPoints?.length > 0 ? `
KEY POINTS:
${summary.keyPoints.map(point => `• ${point}`).join('\n')}
` : ''}

${summary.decisions?.length > 0 ? `
DECISIONS MADE:
${summary.decisions.map(decision => `• ${decision}`).join('\n')}
` : ''}

${summary.actionItems?.length > 0 ? `
ACTION ITEMS:
${summary.actionItems.map(item => `• ${item}`).join('\n')}
` : ''}`;

      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `meeting-summary-${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      showNotification('Summary exported successfully', 'success');
    } catch (error) {
      showNotification('Failed to export summary', 'error');
    }
  };

  /**
   * Handle API key setup
   */
  const handleApiKeySetup = async () => {
    if (!apiKey.trim()) {
      showNotification('Please enter a valid API key', 'error');
      return;
    }

    try {
      await initializeService(apiKey.trim());
      setApiKeyDialog(false);
      // Continue with summary generation if we were in that flow
      if (uploadedText.trim()) {
        handleGenerateSummary();
      }
    } catch (error) {
      showNotification(`Invalid API key: ${error.message}`, 'error');
    }
  };

  /**
   * Reset workflow
   */
  const handleReset = () => {
    setActiveStep(0);
    setUploadedText('');
    setFileName('');
    setCustomPrompt('');
    setSummary(null);
    setError('');
  };

  const steps = [
    {
      label: 'Upload Transcript',
      description: 'Upload or paste your meeting transcript',
      icon: <CloudUpload />
    },
    {
      label: 'Customize Instructions',
      description: 'Add custom instructions for AI summarization',
      icon: <Psychology />
    },
    {
      label: 'Edit Summary',
      description: 'Review and edit the generated summary',
      icon: <Edit />
    },
    {
      label: 'Share',
      description: 'Share your summary via email',
      icon: <Share />
    }
  ];

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4, textAlign: 'center' }}>
        <Typography variant="h3" component="h1" gutterBottom color="primary">
          AI Meeting Notes Summarizer
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
          Transform your meeting transcripts into structured, actionable summaries
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Chip
            icon={<Settings />}
            label={isServiceInitialized ? 'AI Service Ready' : 'Setup Required'}
            color={isServiceInitialized ? 'success' : 'warning'}
            onClick={() => setApiKeyDialog(true)}
            clickable
          />
          {uploadedText && (
            <Chip
              label={`${uploadedText.split(/\s+/).length} words uploaded`}
              color="info"
              variant="outlined"
            />
          )}
        </Box>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Main Content */}
      <Box sx={{ display: 'flex', gap: 4 }}>
        {/* Stepper */}
        <Box sx={{ minWidth: 300 }}>
          <Paper elevation={2} sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Workflow
            </Typography>
            <Stepper activeStep={activeStep} orientation="vertical">
              {steps.map((step, index) => (
                <Step key={step.label}>
                  <StepLabel
                    icon={activeStep > index ? <CheckCircle color="success" /> : step.icon}
                  >
                    <Typography variant="subtitle2">
                      {step.label}
                    </Typography>
                  </StepLabel>
                  <StepContent>
                    <Typography variant="body2" color="text.secondary">
                      {step.description}
                    </Typography>
                  </StepContent>
                </Step>
              ))}
            </Stepper>
            
            {summary && (
              <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                <Button
                  fullWidth
                  variant="outlined"
                  onClick={handleReset}
                  size="small"
                >
                  Start New Summary
                </Button>
              </Box>
            )}
          </Paper>
        </Box>

        {/* Content Area */}
        <Box sx={{ flex: 1 }}>
          {/* Step 0: Upload Transcript */}
          {activeStep === 0 && (
            <TextUpload
              onTextUpload={handleTextUpload}
              placeholder="Paste your meeting transcript, call notes, or any text you'd like to summarize..."
            />
          )}

          {/* Step 1: Custom Instructions */}
          {activeStep === 1 && (
            <Box>
              <CustomPromptInput
                onPromptChange={handlePromptChange}
                initialPrompt={customPrompt}
              />
              
              <Box sx={{ mt: 3, display: 'flex', gap: 2, justifyContent: 'center' }}>
                <Button
                  variant="outlined"
                  onClick={() => setActiveStep(0)}
                >
                  Back to Upload
                </Button>
                <Button
                  variant="contained"
                  onClick={handleGenerateSummary}
                  disabled={isGenerating || !uploadedText.trim()}
                  startIcon={isGenerating ? <CircularProgress size={16} /> : <Psychology />}
                  size="large"
                >
                  {isGenerating ? 'Generating Summary...' : 'Generate Summary'}
                </Button>
              </Box>
            </Box>
          )}

          {/* Step 2: Edit Summary */}
          {activeStep === 2 && summary && (
            <Box>
              <EditableSummary
                summary={summary}
                onSummaryUpdate={handleSummaryUpdate}
                onShare={() => setEmailShareOpen(true)}
                onExport={handleExport}
              />
              
              <Box sx={{ mt: 3, display: 'flex', gap: 2, justifyContent: 'center' }}>
                <Button
                  variant="outlined"
                  onClick={() => setActiveStep(1)}
                >
                  Regenerate
                </Button>
                <Button
                  variant="contained"
                  onClick={() => setEmailShareOpen(true)}
                  startIcon={<Share />}
                >
                  Share via Email
                </Button>
              </Box>
            </Box>
          )}
        </Box>
      </Box>

      {/* API Key Setup Dialog */}
      <Dialog open={apiKeyDialog} onClose={() => setApiKeyDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Configure AI Service
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Get your free API key from{' '}
            <a 
              href="https://makersuite.google.com/app/apikey" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ color: 'inherit' }}
            >
              Google AI Studio
            </a>
          </Alert>
          
          <TextField
            fullWidth
            label="Google Gemini API Key"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Enter your API key here..."
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApiKeyDialog(false)}>
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={handleApiKeySetup}
            disabled={!apiKey.trim()}
          >
            Save & Initialize
          </Button>
        </DialogActions>
      </Dialog>

      {/* Email Share Dialog */}
      <EmailShare
        summary={summary}
        open={emailShareOpen}
        onClose={() => setEmailShareOpen(false)}
        onSend={handleEmailShare}
      />

      {/* Notification Snackbar */}
      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={() => setNotification({ ...notification, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={() => setNotification({ ...notification, open: false })} 
          severity={notification.severity}
          variant="filled"
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default MeetingNotesDashboard;
