import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Alert,
  Typography,
  Box,
  Link
} from '@mui/material';
import { Psychology, Visibility, VisibilityOff } from '@mui/icons-material';

/**
 * AIConfigDialog - Dialog for configuring AI service with API key
 */
const AIConfigDialog = ({ open, onClose, onConfigure }) => {
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleConfigure = async () => {
    if (!apiKey.trim()) {
      setError('Please enter a valid API key');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await onConfigure(apiKey);
      setApiKey('');
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to configure AI service');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setApiKey('');
    setError('');
    setShowApiKey(false);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Psychology color="primary" />
          Configure AI Service
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          To generate AI summaries, you need a Google Gemini API key. This allows the application to use Google's AI models for intelligent meeting summarization.
        </Typography>

        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            Get your free API key from{' '}
            <Link 
              href="https://makersuite.google.com/app/apikey" 
              target="_blank" 
              rel="noopener noreferrer"
              underline="hover"
            >
              Google AI Studio
            </Link>
          </Typography>
        </Alert>

        <TextField
          fullWidth
          label="Google Gemini API Key"
          type={showApiKey ? 'text' : 'password'}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Enter your API key"
          error={!!error}
          helperText={error}
          sx={{ mb: 2 }}
          InputProps={{
            endAdornment: (
              <Button
                onClick={() => setShowApiKey(!showApiKey)}
                size="small"
                sx={{ minWidth: 'auto' }}
              >
                {showApiKey ? <VisibilityOff /> : <Visibility />}
              </Button>
            )
          }}
        />

        <Alert severity="warning">
          <Typography variant="body2">
            <strong>Security Note:</strong> Your API key will be stored locally and only used for AI summary generation. 
            Never share your API key publicly.
          </Typography>
        </Alert>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button 
          onClick={handleConfigure} 
          variant="contained" 
          disabled={!apiKey.trim() || loading}
          startIcon={<Psychology />}
        >
          {loading ? 'Configuring...' : 'Configure AI Service'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AIConfigDialog; 