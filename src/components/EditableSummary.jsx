import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  IconButton,
  Tooltip,
  Chip,
  Alert,
  Divider,
  Card,
  CardContent,
  Fade
} from '@mui/material';
import {
  Edit,
  Save,
  Cancel,
  ContentCopy,
  Share,
  Download,
  Undo,
  Redo,
  AutoFixHigh
} from '@mui/icons-material';

/**
 * EditableSummary component for displaying and editing AI-generated summaries
 * Features inline editing, version history, and export capabilities
 */
const EditableSummary = ({
  summary,
  onSummaryUpdate,
  onShare,
  onExport,
  disabled = false,
  showEditControls = true,
  autoSave = true,
  autoSaveDelay = 2000
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [editHistory, setEditHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  
  const autoSaveTimeoutRef = useRef(null);
  const textareaRef = useRef(null);

  // Initialize content when summary changes
  useEffect(() => {
    if (summary?.content && !isEditing) {
      setEditedContent(summary.content);
      // Initialize history with original content
      if (editHistory.length === 0) {
        setEditHistory([summary.content]);
        setHistoryIndex(0);
      }
    }
  }, [summary?.content, isEditing, editHistory.length]);

  /**
   * Start editing mode
   */
  const startEditing = useCallback(() => {
    if (disabled) return;
    setIsEditing(true);
    setEditedContent(summary?.content || '');
    // Focus textarea after render
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }, 100);
  }, [summary?.content, disabled]);

  /**
   * Save changes
   */
  const saveChanges = useCallback(async () => {
    if (!editedContent.trim()) return;

    setIsSaving(true);
    
    try {
      // Add to history if content changed
      if (editedContent !== summary?.content) {
        const newHistory = editHistory.slice(0, historyIndex + 1);
        newHistory.push(editedContent);
        setEditHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
      }

      // Update summary
      if (onSummaryUpdate) {
        await onSummaryUpdate({
          ...summary,
          content: editedContent,
          lastModified: new Date().toISOString(),
          isEdited: true
        });
      }

      setIsEditing(false);
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Failed to save changes:', error);
    } finally {
      setIsSaving(false);
    }
  }, [editedContent, summary, onSummaryUpdate, editHistory, historyIndex]);

  /**
   * Cancel editing
   */
  const cancelEditing = useCallback(() => {
    setEditedContent(summary?.content || '');
    setIsEditing(false);
    setHasUnsavedChanges(false);
    
    // Clear auto-save timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
  }, [summary?.content]);

  /**
   * Handle content change
   */
  const handleContentChange = useCallback((e) => {
    const newContent = e.target.value;
    setEditedContent(newContent);
    setHasUnsavedChanges(newContent !== summary?.content);

    // Auto-save functionality
    if (autoSave && newContent.trim()) {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      
      autoSaveTimeoutRef.current = setTimeout(() => {
        if (newContent !== summary?.content) {
          saveChanges();
        }
      }, autoSaveDelay);
    }
  }, [summary?.content, autoSave, autoSaveDelay, saveChanges]);

  /**
   * Undo last change
   */
  const undoChange = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setEditedContent(editHistory[newIndex]);
      setHasUnsavedChanges(true);
    }
  }, [historyIndex, editHistory]);

  /**
   * Redo last undone change
   */
  const redoChange = useCallback(() => {
    if (historyIndex < editHistory.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setEditedContent(editHistory[newIndex]);
      setHasUnsavedChanges(true);
    }
  }, [historyIndex, editHistory]);

  /**
   * Copy content to clipboard
   */
  const copyToClipboard = useCallback(async () => {
    try {
      const contentToCopy = isEditing ? editedContent : summary?.content || '';
      await navigator.clipboard.writeText(contentToCopy);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  }, [isEditing, editedContent, summary?.content]);

  /**
   * Handle keyboard shortcuts
   */
  const handleKeyDown = useCallback((e) => {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case 's':
          e.preventDefault();
          if (isEditing) saveChanges();
          break;
        case 'z':
          e.preventDefault();
          if (e.shiftKey) {
            redoChange();
          } else {
            undoChange();
          }
          break;
        case 'Escape':
          if (isEditing) cancelEditing();
          break;
      }
    }
  }, [isEditing, saveChanges, undoChange, redoChange, cancelEditing]);

  // Add keyboard event listener
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Cleanup auto-save timeout
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

  const displayContent = isEditing ? editedContent : summary?.content || '';
  const wordCount = displayContent.trim().split(/\s+/).filter(word => word.length > 0).length;
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < editHistory.length - 1;

  if (!summary) {
    return (
      <Paper elevation={2} sx={{ p: 3 }}>
        <Alert severity="info">
          Upload a transcript and generate a summary to see editable content here.
        </Alert>
      </Paper>
    );
  }

  return (
    <Paper elevation={2} sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AutoFixHigh color="primary" />
          <Typography variant="h6">
            Generated Summary
          </Typography>
          
          {summary.isEdited && (
            <Chip
              label="Edited"
              size="small"
              color="info"
              variant="outlined"
            />
          )}
          
          {hasUnsavedChanges && (
            <Chip
              label="Unsaved"
              size="small"
              color="warning"
              variant="outlined"
            />
          )}
        </Box>

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Chip
            label={`${wordCount} words`}
            size="small"
            variant="outlined"
            color={wordCount > 100 ? 'success' : 'warning'}
          />
          
          <Tooltip title="Copy summary">
            <IconButton 
              size="small" 
              onClick={copyToClipboard}
              color={copySuccess ? 'success' : 'default'}
            >
              <ContentCopy fontSize="small" />
            </IconButton>
          </Tooltip>

          {showEditControls && !isEditing && (
            <Tooltip title="Edit summary">
              <IconButton 
                size="small" 
                onClick={startEditing}
                disabled={disabled}
                color="primary"
              >
                <Edit fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>

      {/* Edit Controls */}
      {isEditing && (
        <Box sx={{ mb: 2, display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          <Button
            size="small"
            variant="contained"
            onClick={saveChanges}
            disabled={isSaving || !editedContent.trim()}
            startIcon={<Save />}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
          
          <Button
            size="small"
            variant="outlined"
            onClick={cancelEditing}
            startIcon={<Cancel />}
          >
            Cancel
          </Button>

          <Divider orientation="vertical" flexItem />

          <Tooltip title="Undo (Ctrl+Z)">
            <IconButton 
              size="small" 
              onClick={undoChange}
              disabled={!canUndo}
            >
              <Undo fontSize="small" />
            </IconButton>
          </Tooltip>

          <Tooltip title="Redo (Ctrl+Shift+Z)">
            <IconButton 
              size="small" 
              onClick={redoChange}
              disabled={!canRedo}
            >
              <Redo fontSize="small" />
            </IconButton>
          </Tooltip>

          {autoSave && (
            <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
              Auto-save enabled
            </Typography>
          )}
        </Box>
      )}

      {/* Content Area */}
      <Card variant="outlined">
        <CardContent>
          {isEditing ? (
            <TextField
              ref={textareaRef}
              fullWidth
              multiline
              minRows={12}
              maxRows={20}
              variant="outlined"
              value={editedContent}
              onChange={handleContentChange}
              placeholder="Edit your summary here..."
              sx={{
                '& .MuiOutlinedInput-root': {
                  fontSize: '1rem',
                  lineHeight: 1.7,
                  '& fieldset': {
                    border: 'none'
                  }
                }
              }}
            />
          ) : (
            <Fade in={true}>
              <Typography 
                variant="body1" 
                sx={{ 
                  lineHeight: 1.7,
                  whiteSpace: 'pre-wrap',
                  minHeight: '200px',
                  cursor: showEditControls ? 'text' : 'default'
                }}
                onClick={showEditControls ? startEditing : undefined}
              >
                {displayContent || 'No summary content available.'}
              </Typography>
            </Fade>
          )}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      {!isEditing && (
        <Box sx={{ mt: 2, display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
          {onShare && (
            <Button
              variant="outlined"
              startIcon={<Share />}
              onClick={() => onShare(summary)}
              disabled={disabled}
            >
              Share
            </Button>
          )}
          
          {onExport && (
            <Button
              variant="outlined"
              startIcon={<Download />}
              onClick={() => onExport(summary)}
              disabled={disabled}
            >
              Export
            </Button>
          )}
        </Box>
      )}

      {/* Metadata */}
      {summary.generatedAt && (
        <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            <Chip
              label={`Generated: ${new Date(summary.generatedAt).toLocaleString()}`}
              size="small"
              variant="outlined"
            />
            
            {summary.lastModified && summary.isEdited && (
              <Chip
                label={`Modified: ${new Date(summary.lastModified).toLocaleString()}`}
                size="small"
                variant="outlined"
                color="info"
              />
            )}
            
            {summary.processingTime && (
              <Chip
                label={`Processing: ${summary.processingTime}ms`}
                size="small"
                variant="outlined"
              />
            )}
          </Box>
        </Box>
      )}

      {/* Keyboard Shortcuts Help */}
      {isEditing && (
        <Box sx={{ mt: 2, p: 1.5, backgroundColor: 'background.default', borderRadius: 1 }}>
          <Typography variant="caption" color="text.secondary">
            <strong>Keyboard shortcuts:</strong> Ctrl+S (Save) • Ctrl+Z (Undo) • Ctrl+Shift+Z (Redo) • Esc (Cancel)
          </Typography>
        </Box>
      )}
    </Paper>
  );
};

export default EditableSummary;
