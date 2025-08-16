import React, { useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  IconButton,
  Tooltip,
  Alert,
  Divider,
  FormControlLabel,
  Switch,
  CircularProgress
} from '@mui/material';
import {
  Email,
  Send,
  Add,
  Close,
  ContentCopy,
  Preview
} from '@mui/icons-material';

/**
 * EmailShare component for sharing summaries via email
 * Features recipient management, email preview, and send functionality
 */
const EmailShare = ({
  summary,
  open,
  onClose,
  onSend,
  disabled = false
}) => {
  const [recipients, setRecipients] = useState([]);
  const [newRecipient, setNewRecipient] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');

  // Initialize default values when dialog opens
  React.useEffect(() => {
    if (open && summary) {
      setSubject(`Meeting Summary - ${new Date().toLocaleDateString()}`);
      setMessage('Please find the meeting summary below.\n\nBest regards');
    }
  }, [open, summary]);

  /**
   * Validate email address
   */
  const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  /**
   * Add recipient
   */
  const addRecipient = useCallback(() => {
    const email = newRecipient.trim().toLowerCase();
    
    if (!email) return;
    
    if (!isValidEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }
    
    if (recipients.includes(email)) {
      setError('Email address already added');
      return;
    }
    
    setRecipients(prev => [...prev, email]);
    setNewRecipient('');
    setError('');
  }, [newRecipient, recipients]);

  /**
   * Remove recipient
   */
  const removeRecipient = useCallback((email) => {
    setRecipients(prev => prev.filter(r => r !== email));
  }, []);

  /**
   * Handle key press in recipient input
   */
  const handleRecipientKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addRecipient();
    }
  };

  /**
   * Generate email content
   */
  const generateEmailContent = useCallback(() => {
    if (!summary) return '';

    let content = message + '\n\n';
    content += '--- MEETING SUMMARY ---\n\n';
    content += summary.content + '\n\n';

    if (summary.keyPoints && summary.keyPoints.length > 0) {
      content += 'KEY POINTS:\n';
      content += summary.keyPoints.map(point => `• ${point}`).join('\n') + '\n\n';
    }

    if (summary.decisions && summary.decisions.length > 0) {
      content += 'DECISIONS MADE:\n';
      content += summary.decisions.map(decision => `• ${decision}`).join('\n') + '\n\n';
    }

    if (summary.actionItems && summary.actionItems.length > 0) {
      content += 'ACTION ITEMS:\n';
      content += summary.actionItems.map(item => `• ${item}`).join('\n') + '\n\n';
    }

    if (includeMetadata) {
      content += '--- METADATA ---\n';
      content += `Generated: ${new Date(summary.generatedAt).toLocaleString()}\n`;
      if (summary.processingTime) {
        content += `Processing Time: ${summary.processingTime}ms\n`;
      }
      if (summary.isEdited) {
        content += `Last Modified: ${new Date(summary.lastModified).toLocaleString()}\n`;
      }
    }

    return content;
  }, [summary, message, includeMetadata]);

  /**
   * Copy email content to clipboard
   */
  const copyEmailContent = async () => {
    try {
      const content = generateEmailContent();
      await navigator.clipboard.writeText(content);
    } catch (error) {
      console.error('Failed to copy email content:', error);
    }
  };

  /**
   * Handle send email
   */
  const handleSend = async () => {
    if (recipients.length === 0) {
      setError('Please add at least one recipient');
      return;
    }

    if (!subject.trim()) {
      setError('Please enter a subject');
      return;
    }

    setIsSending(true);
    setError('');

    try {
      const emailData = {
        recipients,
        subject: subject.trim(),
        content: generateEmailContent(),
        summary,
        timestamp: new Date().toISOString()
      };

      if (onSend) {
        await onSend(emailData);
      }

      // Reset form
      setRecipients([]);
      setNewRecipient('');
      setSubject('');
      setMessage('');
      setShowPreview(false);
      
      onClose();
    } catch (error) {
      setError(error.message || 'Failed to send email');
    } finally {
      setIsSending(false);
    }
  };

  /**
   * Handle dialog close
   */
  const handleClose = () => {
    if (!isSending) {
      setError('');
      onClose();
    }
  };

  const emailContent = generateEmailContent();

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { minHeight: '600px' }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Email color="primary" />
            <Typography variant="h6">
              Share Summary via Email
            </Typography>
          </Box>
          
          <IconButton onClick={handleClose} disabled={isSending}>
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {/* Recipients */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" gutterBottom>
            Recipients
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Enter email address"
              value={newRecipient}
              onChange={(e) => setNewRecipient(e.target.value)}
              onKeyPress={handleRecipientKeyPress}
              disabled={disabled || isSending}
            />
            <Button
              variant="outlined"
              onClick={addRecipient}
              disabled={disabled || isSending || !newRecipient.trim()}
              startIcon={<Add />}
            >
              Add
            </Button>
          </Box>
          
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {recipients.map((email) => (
              <Chip
                key={email}
                label={email}
                onDelete={() => removeRecipient(email)}
                disabled={disabled || isSending}
                color="primary"
                variant="outlined"
              />
            ))}
          </Box>
          
          {recipients.length === 0 && (
            <Typography variant="caption" color="text.secondary">
              No recipients added yet
            </Typography>
          )}
        </Box>

        {/* Subject */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" gutterBottom>
            Subject
          </Typography>
          <TextField
            fullWidth
            size="small"
            placeholder="Enter email subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={disabled || isSending}
          />
        </Box>

        {/* Message */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" gutterBottom>
            Personal Message
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={3}
            placeholder="Add a personal message (optional)"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={disabled || isSending}
          />
        </Box>

        {/* Options */}
        <Box sx={{ mb: 3 }}>
          <FormControlLabel
            control={
              <Switch
                checked={includeMetadata}
                onChange={(e) => setIncludeMetadata(e.target.checked)}
                disabled={disabled || isSending}
              />
            }
            label="Include metadata (generation time, processing info)"
          />
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Preview */}
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="subtitle1">
              Email Preview
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Tooltip title="Copy email content">
                <IconButton size="small" onClick={copyEmailContent}>
                  <ContentCopy fontSize="small" />
                </IconButton>
              </Tooltip>
              
              <Button
                size="small"
                variant="outlined"
                onClick={() => setShowPreview(!showPreview)}
                startIcon={<Preview />}
              >
                {showPreview ? 'Hide' : 'Show'} Preview
              </Button>
            </Box>
          </Box>
          
          {showPreview && (
            <Paper 
              variant="outlined" 
              sx={{ 
                p: 2, 
                maxHeight: '300px', 
                overflow: 'auto',
                backgroundColor: 'background.default'
              }}
            >
              <Typography variant="body2" component="pre" sx={{ whiteSpace: 'pre-wrap' }}>
                {emailContent}
              </Typography>
            </Paper>
          )}
        </Box>

        {/* Summary Stats */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Chip
            label={`${recipients.length} recipients`}
            size="small"
            variant="outlined"
            color={recipients.length > 0 ? 'success' : 'default'}
          />
          <Chip
            label={`${emailContent.split(/\s+/).length} words`}
            size="small"
            variant="outlined"
          />
          <Chip
            label={`${emailContent.length} characters`}
            size="small"
            variant="outlined"
          />
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button
          onClick={handleClose}
          disabled={isSending}
        >
          Cancel
        </Button>
        
        <Button
          variant="contained"
          onClick={handleSend}
          disabled={disabled || isSending || recipients.length === 0 || !subject.trim()}
          startIcon={isSending ? <CircularProgress size={16} /> : <Send />}
        >
          {isSending ? 'Sending...' : 'Send Email'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EmailShare;
