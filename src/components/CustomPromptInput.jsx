import React, { useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Chip,
  IconButton,
  Tooltip,
  Collapse,
  Alert,
  Divider
} from '@mui/material';
import {
  Psychology,
  ExpandMore,
  ExpandLess,
  Add,
  Clear,
  Lightbulb
} from '@mui/icons-material';

/**
 * CustomPromptInput component for entering custom AI instructions
 * Includes preset templates and custom prompt functionality
 */
const CustomPromptInput = ({
  onPromptChange,
  initialPrompt = '',
  disabled = false,
  showTemplates = true
}) => {
  const [customPrompt, setCustomPrompt] = useState(initialPrompt);
  const [showPresets, setShowPresets] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('');

  // Predefined prompt templates
  const promptTemplates = [
    {
      id: 'executive',
      name: 'Executive Summary',
      description: 'Concise bullet points for leadership',
      prompt: 'Summarize this meeting transcript in executive bullet points. Focus on key decisions, strategic outcomes, and high-level action items. Keep it concise and business-focused for senior leadership review.'
    },
    {
      id: 'action-items',
      name: 'Action Items Focus',
      description: 'Highlight tasks and responsibilities',
      prompt: 'Extract and highlight all action items, tasks, and responsibilities from this meeting transcript. Organize by person responsible (if mentioned) and include deadlines or timeframes. Focus on what needs to be done next.'
    },
    {
      id: 'decisions',
      name: 'Decisions Made',
      description: 'Focus on decisions and outcomes',
      prompt: 'Identify and summarize all decisions made during this meeting. Include the context for each decision, who was involved in making it, and any alternatives that were considered. Highlight the reasoning behind key decisions.'
    },
    {
      id: 'technical',
      name: 'Technical Discussion',
      description: 'Technical details and specifications',
      prompt: 'Summarize the technical aspects discussed in this meeting. Include technical decisions, architecture discussions, implementation details, and any technical challenges or solutions mentioned.'
    },
    {
      id: 'project-status',
      name: 'Project Status',
      description: 'Project progress and updates',
      prompt: 'Create a project status summary from this meeting transcript. Include progress updates, milestones achieved, upcoming deadlines, blockers or risks, and resource needs discussed.'
    },
    {
      id: 'client-meeting',
      name: 'Client Meeting',
      description: 'Client-focused summary',
      prompt: 'Summarize this client meeting focusing on client requirements, feedback, concerns raised, agreements made, and next steps. Include any commitments made to the client and follow-up actions.'
    },
    {
      id: 'brainstorming',
      name: 'Brainstorming Session',
      description: 'Ideas and creative discussions',
      prompt: 'Summarize this brainstorming session by organizing ideas discussed, creative solutions proposed, and concepts explored. Group related ideas together and highlight the most promising or frequently mentioned concepts.'
    },
    {
      id: 'retrospective',
      name: 'Retrospective',
      description: 'Team reflection and improvements',
      prompt: 'Summarize this retrospective meeting focusing on what went well, what could be improved, specific issues raised, and improvement actions agreed upon. Include team feedback and process changes discussed.'
    }
  ];

  /**
   * Handle prompt change
   */
  const handlePromptChange = useCallback((newPrompt) => {
    setCustomPrompt(newPrompt);
    if (onPromptChange) {
      onPromptChange(newPrompt);
    }
  }, [onPromptChange]);

  /**
   * Apply template prompt
   */
  const applyTemplate = (template) => {
    setSelectedTemplate(template.id);
    handlePromptChange(template.prompt);
  };

  /**
   * Clear prompt
   */
  const clearPrompt = () => {
    setSelectedTemplate('');
    handlePromptChange('');
  };

  /**
   * Handle custom text change
   */
  const handleTextChange = (e) => {
    setSelectedTemplate(''); // Clear selected template when typing custom
    handlePromptChange(e.target.value);
  };

  const wordCount = customPrompt.trim().split(/\s+/).filter(word => word.length > 0).length;

  return (
    <Paper elevation={2} sx={{ p: 3 }}>
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Psychology color="primary" />
          <Typography variant="h6">
            Custom Instructions
          </Typography>
        </Box>
        
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          {customPrompt && (
            <Chip
              label={`${wordCount} words`}
              size="small"
              variant="outlined"
              color={wordCount > 10 ? 'success' : 'warning'}
            />
          )}
          
          {showTemplates && (
            <Button
              size="small"
              variant="outlined"
              onClick={() => setShowPresets(!showPresets)}
              endIcon={showPresets ? <ExpandLess /> : <ExpandMore />}
              startIcon={<Lightbulb />}
            >
              Templates
            </Button>
          )}
          
          {customPrompt && (
            <Tooltip title="Clear prompt">
              <IconButton size="small" onClick={clearPrompt}>
                <Clear />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>

      {/* Template Selection */}
      {showTemplates && (
        <Collapse in={showPresets}>
          <Box sx={{ mb: 3 }}>
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2">
                Choose a template below or write your own custom instructions for how the AI should summarize your transcript.
              </Typography>
            </Alert>
            
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
              {promptTemplates.map((template) => (
                <Chip
                  key={template.id}
                  label={template.name}
                  onClick={() => applyTemplate(template)}
                  color={selectedTemplate === template.id ? 'primary' : 'default'}
                  variant={selectedTemplate === template.id ? 'filled' : 'outlined'}
                  clickable
                  disabled={disabled}
                  sx={{ mb: 1 }}
                />
              ))}
            </Box>
            
            {selectedTemplate && (
              <Box sx={{ p: 2, backgroundColor: 'background.default', borderRadius: 1, mb: 2 }}>
                <Typography variant="subtitle2" color="primary" gutterBottom>
                  {promptTemplates.find(t => t.id === selectedTemplate)?.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {promptTemplates.find(t => t.id === selectedTemplate)?.description}
                </Typography>
              </Box>
            )}
            
            <Divider sx={{ my: 2 }} />
          </Box>
        </Collapse>
      )}

      {/* Custom Prompt Input */}
      <TextField
        fullWidth
        multiline
        rows={6}
        variant="outlined"
        placeholder="Enter custom instructions for how you want the AI to summarize your transcript...

Examples:
• 'Summarize in bullet points for executives'
• 'Focus only on action items and deadlines'
• 'Highlight technical decisions and architecture discussions'
• 'Create a client-ready summary with key outcomes'"
        value={customPrompt}
        onChange={handleTextChange}
        disabled={disabled}
        sx={{
          '& .MuiOutlinedInput-root': {
            fontSize: '0.9rem',
            lineHeight: 1.6
          }
        }}
      />

      {/* Helpful Tips */}
      {!customPrompt && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
            💡 <strong>Tips for better summaries:</strong>
          </Typography>
          <Typography variant="caption" color="text.secondary" component="div">
            • Be specific about the format you want (bullets, paragraphs, sections)
            <br />
            • Mention your audience (executives, team members, clients)
            <br />
            • Specify what to focus on (decisions, action items, technical details)
            <br />
            • Include any special requirements (length, tone, level of detail)
          </Typography>
        </Box>
      )}

      {/* Current Selection Info */}
      {selectedTemplate && (
        <Box sx={{ mt: 2, p: 1.5, backgroundColor: 'success.50', borderRadius: 1, border: '1px solid', borderColor: 'success.200' }}>
          <Typography variant="caption" color="success.dark">
            <strong>Using template:</strong> {promptTemplates.find(t => t.id === selectedTemplate)?.name}
          </Typography>
        </Box>
      )}
    </Paper>
  );
};

export default CustomPromptInput;
