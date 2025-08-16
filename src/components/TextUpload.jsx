import React, { useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  Alert,
  LinearProgress,
  Chip,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  CloudUpload,
  Description,
  Clear,
  ContentPaste
} from '@mui/icons-material';

/**
 * TextUpload component for uploading meeting transcripts
 * Supports file upload and direct text input
 */
const TextUpload = ({
  onTextUpload,
  maxFileSize = 5 * 1024 * 1024, // 5MB
  acceptedFileTypes = ['.txt', '.md', '.doc', '.docx'],
  placeholder = "Paste your meeting transcript here...",
  disabled = false
}) => {
  const [uploadedText, setUploadedText] = useState('');
  const [fileName, setFileName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);

  /**
   * Handle file upload
   */
  const handleFileUpload = useCallback(async (file) => {
    if (!file) return;

    // Validate file size
    if (file.size > maxFileSize) {
      setError(`File size exceeds ${Math.round(maxFileSize / 1024 / 1024)}MB limit`);
      return;
    }

    // Validate file type
    const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
    if (!acceptedFileTypes.includes(fileExtension)) {
      setError(`File type not supported. Please use: ${acceptedFileTypes.join(', ')}`);
      return;
    }

    setIsUploading(true);
    setError('');

    try {
      const text = await readFileAsText(file);
      setUploadedText(text);
      setFileName(file.name);
      
      if (onTextUpload) {
        onTextUpload(text, file.name);
      }
    } catch (err) {
      setError('Failed to read file. Please try again.');
    } finally {
      setIsUploading(false);
    }
  }, [maxFileSize, acceptedFileTypes, onTextUpload]);

  /**
   * Read file as text
   */
  const readFileAsText = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  };

  /**
   * Handle drag and drop
   */
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  }, [handleFileUpload]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  /**
   * Handle file input change
   */
  const handleFileInputChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  /**
   * Handle text area change
   */
  const handleTextChange = (e) => {
    const text = e.target.value;
    setUploadedText(text);
    setFileName('');
    
    if (onTextUpload) {
      onTextUpload(text, '');
    }
  };

  /**
   * Clear uploaded content
   */
  const handleClear = () => {
    setUploadedText('');
    setFileName('');
    setError('');
    
    if (onTextUpload) {
      onTextUpload('', '');
    }
  };

  /**
   * Paste from clipboard
   */
  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setUploadedText(text);
      setFileName('');
      
      if (onTextUpload) {
        onTextUpload(text, '');
      }
    } catch (err) {
      setError('Failed to read from clipboard. Please paste manually.');
    }
  };

  const wordCount = uploadedText.trim().split(/\s+/).filter(word => word.length > 0).length;
  const charCount = uploadedText.length;

  return (
    <Paper elevation={2} sx={{ p: 3 }}>
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Description color="primary" />
          <Typography variant="h6">
            Upload Transcript
          </Typography>
        </Box>
        
        {uploadedText && (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Chip
              label={`${wordCount} words`}
              size="small"
              variant="outlined"
              color={wordCount > 50 ? 'success' : 'warning'}
            />
            <Tooltip title="Clear content">
              <IconButton size="small" onClick={handleClear}>
                <Clear />
              </IconButton>
            </Tooltip>
          </Box>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {isUploading && (
        <Box sx={{ mb: 2 }}>
          <LinearProgress />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
            Processing file...
          </Typography>
        </Box>
      )}

      {/* File Upload Area */}
      <Box
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        sx={{
          border: '2px dashed',
          borderColor: dragOver ? 'primary.main' : 'divider',
          borderRadius: 2,
          p: 3,
          mb: 2,
          textAlign: 'center',
          backgroundColor: dragOver ? 'primary.50' : 'background.default',
          transition: 'all 0.2s ease',
          cursor: 'pointer'
        }}
      >
        <input
          type="file"
          accept={acceptedFileTypes.join(',')}
          onChange={handleFileInputChange}
          style={{ display: 'none' }}
          id="file-upload-input"
          disabled={disabled}
        />
        
        <label htmlFor="file-upload-input" style={{ cursor: 'pointer', width: '100%', display: 'block' }}>
          <CloudUpload sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            Drop your transcript file here
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            or click to browse files
          </Typography>
          <Button
            variant="outlined"
            component="span"
            disabled={disabled}
            startIcon={<CloudUpload />}
          >
            Choose File
          </Button>
        </label>
        
        <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 2 }}>
          Supported formats: {acceptedFileTypes.join(', ')} • Max size: {Math.round(maxFileSize / 1024 / 1024)}MB
        </Typography>
      </Box>

      {/* Text Input Area */}
      <Box sx={{ position: 'relative' }}>
        <TextField
          fullWidth
          multiline
          rows={12}
          variant="outlined"
          placeholder={placeholder}
          value={uploadedText}
          onChange={handleTextChange}
          disabled={disabled}
          sx={{
            '& .MuiOutlinedInput-root': {
              fontSize: '0.9rem',
              lineHeight: 1.6
            }
          }}
        />
        
        <Tooltip title="Paste from clipboard">
          <IconButton
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              backgroundColor: 'background.paper',
              boxShadow: 1,
              '&:hover': {
                backgroundColor: 'background.default'
              }
            }}
            size="small"
            onClick={handlePasteFromClipboard}
            disabled={disabled}
          >
            <ContentPaste fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* File Info */}
      {fileName && (
        <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Description fontSize="small" color="primary" />
          <Typography variant="body2" color="text.secondary">
            Loaded from: {fileName}
          </Typography>
          <Chip
            label={`${charCount} characters`}
            size="small"
            variant="outlined"
          />
        </Box>
      )}

      {/* Content Stats */}
      {uploadedText && !fileName && (
        <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
          <Chip
            label={`${charCount} characters`}
            size="small"
            variant="outlined"
          />
          <Chip
            label="Direct input"
            size="small"
            variant="outlined"
            color="info"
          />
        </Box>
      )}
    </Paper>
  );
};

export default TextUpload;
