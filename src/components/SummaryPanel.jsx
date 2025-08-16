import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  IconButton,
  Tooltip,
  Alert,
  LinearProgress,
  Divider,
  Collapse,
  Card,
  CardContent,
  Skeleton,
  Fade,
  CircularProgress,
  Button
} from '@mui/material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Psychology, ExpandMore, ExpandLess, ContentCopy, Refresh, Schedule, TrendingUp, Assignment, FormatQuote, Topic, CheckCircle, Warning, Error as ErrorIcon } from '@mui/icons-material';

/**
 * SummaryPanel component for displaying real-time AI-generated meeting summaries
 * Features:
 * - Real-time summary display with smooth updates
 * - Topic segmentation visualization
 * - Processing indicators and confidence levels
 * - Loading states with estimated completion times
 * - Expandable sections for better organization
 * - Copy functionality for summary content
 */
const SummaryPanel = ({
  summary = null,
  isGenerating = false,
  processingProgress = 0,
  estimatedTimeRemaining = null,
  onRefreshSummary,
  onCopySummary,
  showTopicSegmentation = true,
  showProcessingDetails = true,
  maxHeight = 600,
  autoUpdate = true,
  onConfigureAI = null
}) => {
  const [expandedSections, setExpandedSections] = useState({
    keyPoints: true,
    decisions: true,
    actionItems: true,
    quotes: false,
    topics: false
  });
  const [copiedSection, setCopiedSection] = useState(null);
  const [lastUpdateTime, setLastUpdateTime] = useState(null);
  const [processingStage, setProcessingStage] = useState('');
  const previousSummaryRef = useRef(null);

  // Update last update time when summary changes
  useEffect(() => {
    if (summary && summary !== previousSummaryRef.current) {
      setLastUpdateTime(Date.now());
      previousSummaryRef.current = summary;
    }
  }, [summary]);

  // Simulate processing stages for better UX
  useEffect(() => {
    if (isGenerating) {
      const stages = [
        'Analyzing transcript...',
        'Identifying key points...',
        'Extracting decisions...',
        'Processing action items...',
        'Generating summary...',
        'Finalizing content...'
      ];
      
      let currentStage = 0;
      setProcessingStage(stages[0]);
      
      const interval = setInterval(() => {
        currentStage = (currentStage + 1) % stages.length;
        setProcessingStage(stages[currentStage]);
      }, 2000);

      return () => clearInterval(interval);
    } else {
      setProcessingStage('');
    }
  }, [isGenerating]);

  /**
   * Toggle section expansion
   * @param {string} section - Section name to toggle
   */
  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  /**
   * Copy section content to clipboard
   * @param {string} section - Section name
   * @param {string|Array} content - Content to copy
   */
  const copySection = async (section, content) => {
    try {
      let textToCopy = '';
      
      if (Array.isArray(content)) {
        textToCopy = content.join('\n');
      } else {
        textToCopy = content;
      }

      await navigator.clipboard.writeText(textToCopy);
      setCopiedSection(section);
      setTimeout(() => setCopiedSection(null), 2000);
      
      if (onCopySummary) {
        onCopySummary(section, textToCopy);
      }
    } catch (error) {
      console.error('Failed to copy content:', error);
    }
  };

  /**
   * Copy full summary to clipboard
   */
  const copyFullSummary = async () => {
    if (!summary) return;

    try {
      const fullSummary = `
MEETING SUMMARY
Generated: ${new Date(summary.generatedAt).toLocaleString()}

${summary.content}

KEY POINTS:
${summary.keyPoints?.map(point => `• ${point}`).join('\n') || 'None'}

DECISIONS MADE:
${summary.decisions?.map(decision => `• ${decision}`).join('\n') || 'None'}

ACTION ITEMS:
${summary.actionItems?.map(item => `• ${item}`).join('\n') || 'None'}

IMPORTANT QUOTES:
${summary.quotes?.map(quote => `"${quote}"`).join('\n') || 'None'}

${summary.topics?.length > 0 ? `
TOPICS DISCUSSED:
${summary.topics.map(topic => `
${topic.name}:
${topic.points?.map(point => `  • ${point}`).join('\n') || '  No specific points'}`).join('\n')}
` : ''}
      `.trim();

      await navigator.clipboard.writeText(fullSummary);
      setCopiedSection('full');
      setTimeout(() => setCopiedSection(null), 2000);
      
      if (onCopySummary) {
        onCopySummary('full', fullSummary);
      }
    } catch (error) {
      console.error('Failed to copy full summary:', error);
    }
  };

  /**
   * Get confidence level styling based on processing metrics
   * @param {Object} summary - Summary object
   * @returns {Object} Style configuration
   */
  const getConfidenceStyle = (summary) => {
    if (!summary || !summary.processingTime) {
      return { color: 'text.secondary', level: 'unknown' };
    }

    const processingTime = summary.processingTime;
    const wordCount = summary.content?.split(/\s+/).length || 0;
    
    // Determine confidence based on processing time and content quality
    if (processingTime < 2000 && wordCount >= 150) {
      return { color: 'success.main', level: 'high' };
    } else if (processingTime < 5000 && wordCount >= 100) {
      return { color: 'warning.main', level: 'medium' };
    } else {
      return { color: 'error.main', level: 'low' };
    }
  };

  /**
   * Format time remaining for display
   * @param {number} timeMs - Time in milliseconds
   * @returns {string} Formatted time string
   */
  const formatTimeRemaining = (timeMs) => {
    if (!timeMs || timeMs <= 0) return '';
    
    const seconds = Math.ceil(timeMs / 1000);
    if (seconds < 60) {
      return `${seconds}s remaining`;
    }
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s remaining`;
  };

  const confidenceStyle = summary ? getConfidenceStyle(summary) : { color: 'text.secondary', level: 'unknown' };
  const hasContent = summary && (
    summary.content || 
    (summary.keyPoints && summary.keyPoints.length > 0) ||
    (summary.decisions && summary.decisions.length > 0) ||
    (summary.actionItems && summary.actionItems.length > 0)
  );

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
          <Psychology color="primary" />
          <Typography variant="h6" component="h2">
            AI Summary
          </Typography>
          
          {isGenerating && (
            <Chip
              icon={<CircularProgress size={16} />}
              label="Generating"
              color="primary"
              size="small"
              variant="outlined"
            />
          )}
          
          {summary && !isGenerating && (
            <Chip
              icon={<CheckCircle />}
              label={`Confidence: ${confidenceStyle.level}`}
              size="small"
              variant="outlined"
              sx={{ color: confidenceStyle.color }}
            />
          )}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {summary && (
            <>
              <Tooltip title="Copy full summary">
                <IconButton 
                  size="small" 
                  onClick={copyFullSummary}
                  color={copiedSection === 'full' ? 'success' : 'default'}
                >
                  <ContentCopy fontSize="small" />
                </IconButton>
              </Tooltip>
              
              {onRefreshSummary && (
                <Tooltip title="Refresh summary">
                  <IconButton 
                    size="small" 
                    onClick={onRefreshSummary}
                    disabled={isGenerating}
                  >
                    <Refresh fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </>
          )}
        </Box>
      </Box>

      {/* Processing indicator */}
      {isGenerating && (
        <Box sx={{ px: 2, pb: 1 }}>
          <LinearProgress 
            variant={processingProgress > 0 ? 'determinate' : 'indeterminate'}
            value={processingProgress}
            sx={{ height: 4, borderRadius: 2 }}
          />
          {showProcessingDetails && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
              <Typography variant="caption" color="text.secondary">
                {processingStage}
              </Typography>
              {estimatedTimeRemaining && (
                <Typography variant="caption" color="text.secondary">
                  {formatTimeRemaining(estimatedTimeRemaining)}
                </Typography>
              )}
            </Box>
          )}
        </Box>
      )}

      {/* Content area */}
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          p: 2,
          maxHeight: maxHeight
        }}
      >
        {!hasContent && !isGenerating && (
          <Box sx={{ mt: 2 }}>
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2">
                Start recording and speaking to generate an AI-powered meeting summary. 
                The summary will include key points, decisions, action items, and important quotes.
              </Typography>
            </Alert>
            
            {/* API Key Configuration */}
            <Card sx={{ maxWidth: 600, mx: 'auto' }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  AI Service Ready
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  The AI service is ready to generate intelligent summaries. Click the button below to configure your API key and start generating AI-powered meeting summaries.
                </Typography>
                <Alert severity="warning" sx={{ mb: 2 }}>
                  <Typography variant="body2">
                    <strong>Setup Required:</strong> Get your free API key from{' '}
                    <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>
                      Google AI Studio
                    </a>
                  </Typography>
                </Alert>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Once you have an API key, you can test the AI functionality using the demo components or configure it in the application settings.
                </Typography>
                {onConfigureAI && (
                  <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                    <Button
                      variant="outlined"
                      color="primary"
                      onClick={onConfigureAI}
                      startIcon={<Psychology />}
                    >
                      Configure AI Service
                    </Button>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Box>
        )}

        {isGenerating && !hasContent && (
          <Box sx={{ py: 4 }}>
            {/* Loading skeletons */}
            <Skeleton variant="text" width="60%" height={32} sx={{ mb: 2 }} />
            <Skeleton variant="rectangular" width="100%" height={120} sx={{ mb: 3, borderRadius: 1 }} />
            
            <Skeleton variant="text" width="40%" height={24} sx={{ mb: 1 }} />
            <Skeleton variant="text" width="90%" height={20} sx={{ mb: 1 }} />
            <Skeleton variant="text" width="85%" height={20} sx={{ mb: 1 }} />
            <Skeleton variant="text" width="80%" height={20} sx={{ mb: 3 }} />
            
            <Skeleton variant="text" width="35%" height={24} sx={{ mb: 1 }} />
            <Skeleton variant="text" width="75%" height={20} sx={{ mb: 1 }} />
            <Skeleton variant="text" width="70%" height={20} />
          </Box>
        )}

        {hasContent && (
          <Fade in={true} timeout={500}>
            <Box>
              {/* Main summary content */}
              {summary.content && (
                <Card sx={{ mb: 3 }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                      <Typography variant="h6" color="primary">
                        Summary
                      </Typography>
                      <Tooltip title="Copy summary">
                        <IconButton 
                          size="small" 
                          onClick={() => copySection('content', summary.content)}
                          color={copiedSection === 'content' ? 'success' : 'default'}
                        >
                          <ContentCopy fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                    <Typography variant="body1" sx={{ lineHeight: 1.7 }}>
                      {summary.content}
                    </Typography>
                  </CardContent>
                </Card>
              )}

              {/* Key Points Section */}
              {summary.keyPoints && summary.keyPoints.length > 0 && (
                <Card sx={{ mb: 2 }}>
                  <CardContent sx={{ pb: expandedSections.keyPoints ? 2 : 1 }}>
                    <Box 
                      sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        cursor: 'pointer'
                      }}
                      onClick={() => toggleSection('keyPoints')}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <TrendingUp color="primary" fontSize="small" />
                        <Typography variant="subtitle1" color="primary">
                          Key Points ({summary.keyPoints.length})
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Tooltip title="Copy key points">
                          <IconButton 
                            size="small" 
                            onClick={(e) => {
                              e.stopPropagation();
                              copySection('keyPoints', summary.keyPoints);
                            }}
                            color={copiedSection === 'keyPoints' ? 'success' : 'default'}
                          >
                            <ContentCopy fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {expandedSections.keyPoints ? <ExpandLess /> : <ExpandMore />}
                      </Box>
                    </Box>
                    
                    <Collapse in={expandedSections.keyPoints}>
                      <Box sx={{ mt: 2 }}>
                        {summary.keyPoints.map((point, index) => (
                          <Typography 
                            key={index} 
                            variant="body2" 
                            sx={{ 
                              mb: 1,
                              pl: 2,
                              borderLeft: '3px solid',
                              borderColor: 'primary.main',
                              backgroundColor: 'primary.50'
                            }}
                          >
                            • {point}
                          </Typography>
                        ))}
                      </Box>
                    </Collapse>
                  </CardContent>
                </Card>
              )}

              {/* Decisions Section */}
              {summary.decisions && summary.decisions.length > 0 && (
                <Card sx={{ mb: 2 }}>
                  <CardContent sx={{ pb: expandedSections.decisions ? 2 : 1 }}>
                    <Box 
                      sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        cursor: 'pointer'
                      }}
                      onClick={() => toggleSection('decisions')}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CheckCircle color="success" fontSize="small" />
                        <Typography variant="subtitle1" color="success.main">
                          Decisions Made ({summary.decisions.length})
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Tooltip title="Copy decisions">
                          <IconButton 
                            size="small" 
                            onClick={(e) => {
                              e.stopPropagation();
                              copySection('decisions', summary.decisions);
                            }}
                            color={copiedSection === 'decisions' ? 'success' : 'default'}
                          >
                            <ContentCopy fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {expandedSections.decisions ? <ExpandLess /> : <ExpandMore />}
                      </Box>
                    </Box>
                    
                    <Collapse in={expandedSections.decisions}>
                      <Box sx={{ mt: 2 }}>
                        {summary.decisions.map((decision, index) => (
                          <Typography 
                            key={index} 
                            variant="body2" 
                            sx={{ 
                              mb: 1,
                              pl: 2,
                              borderLeft: '3px solid',
                              borderColor: 'success.main',
                              backgroundColor: 'success.50'
                            }}
                          >
                            ✓ {decision}
                          </Typography>
                        ))}
                      </Box>
                    </Collapse>
                  </CardContent>
                </Card>
              )}

              {/* Action Items Section */}
              {summary.actionItems && summary.actionItems.length > 0 && (
                <Card sx={{ mb: 2 }}>
                  <CardContent sx={{ pb: expandedSections.actionItems ? 2 : 1 }}>
                    <Box 
                      sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        cursor: 'pointer'
                      }}
                      onClick={() => toggleSection('actionItems')}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Assignment color="warning" fontSize="small" />
                        <Typography variant="subtitle1" color="warning.main">
                          Action Items ({summary.actionItems.length})
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Tooltip title="Copy action items">
                          <IconButton 
                            size="small" 
                            onClick={(e) => {
                              e.stopPropagation();
                              copySection('actionItems', summary.actionItems);
                            }}
                            color={copiedSection === 'actionItems' ? 'success' : 'default'}
                          >
                            <ContentCopy fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {expandedSections.actionItems ? <ExpandLess /> : <ExpandMore />}
                      </Box>
                    </Box>
                    
                    <Collapse in={expandedSections.actionItems}>
                      <Box sx={{ mt: 2 }}>
                        {summary.actionItems.map((item, index) => (
                          <Typography 
                            key={index} 
                            variant="body2" 
                            sx={{ 
                              mb: 1,
                              pl: 2,
                              borderLeft: '3px solid',
                              borderColor: 'warning.main',
                              backgroundColor: 'warning.50'
                            }}
                          >
                            → {item}
                          </Typography>
                        ))}
                      </Box>
                    </Collapse>
                  </CardContent>
                </Card>
              )}

              {/* Quotes Section */}
              {summary.quotes && summary.quotes.length > 0 && (
                <Card sx={{ mb: 2 }}>
                  <CardContent sx={{ pb: expandedSections.quotes ? 2 : 1 }}>
                    <Box 
                      sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        cursor: 'pointer'
                      }}
                      onClick={() => toggleSection('quotes')}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <FormatQuote color="info" fontSize="small" />
                        <Typography variant="subtitle1" color="info.main">
                          Important Quotes ({summary.quotes.length})
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Tooltip title="Copy quotes">
                          <IconButton 
                            size="small" 
                            onClick={(e) => {
                              e.stopPropagation();
                              copySection('quotes', summary.quotes);
                            }}
                            color={copiedSection === 'quotes' ? 'success' : 'default'}
                          >
                            <ContentCopy fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {expandedSections.quotes ? <ExpandLess /> : <ExpandMore />}
                      </Box>
                    </Box>
                    
                    <Collapse in={expandedSections.quotes}>
                      <Box sx={{ mt: 2 }}>
                        {summary.quotes.map((quote, index) => (
                          <Typography 
                            key={index} 
                            variant="body2" 
                            sx={{ 
                              mb: 2,
                              pl: 2,
                              pr: 2,
                              py: 1,
                              fontStyle: 'italic',
                              borderLeft: '4px solid',
                              borderColor: 'info.main',
                              backgroundColor: 'info.50',
                              borderRadius: '0 4px 4px 0'
                            }}
                          >
                            "{quote}"
                          </Typography>
                        ))}
                      </Box>
                    </Collapse>
                  </CardContent>
                </Card>
              )}

              {/* Topic Segmentation Section */}
              {showTopicSegmentation && summary.topics && summary.topics.length > 0 && (
                <Card sx={{ mb: 2 }}>
                  <CardContent sx={{ pb: expandedSections.topics ? 2 : 1 }}>
                    <Box 
                      sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        cursor: 'pointer'
                      }}
                      onClick={() => toggleSection('topics')}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Topic color="secondary" fontSize="small" />
                        <Typography variant="subtitle1" color="secondary.main">
                          Topics Discussed ({summary.topics.length})
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Tooltip title="Copy topics">
                          <IconButton 
                            size="small" 
                            onClick={(e) => {
                              e.stopPropagation();
                              const topicsText = summary.topics.map(topic => 
                                `${topic.name}:\n${topic.points?.map(p => `  • ${p}`).join('\n') || '  No specific points'}`
                              ).join('\n\n');
                              copySection('topics', topicsText);
                            }}
                            color={copiedSection === 'topics' ? 'success' : 'default'}
                          >
                            <ContentCopy fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {expandedSections.topics ? <ExpandLess /> : <ExpandMore />}
                      </Box>
                    </Box>
                    
                    <Collapse in={expandedSections.topics}>
                      <Box sx={{ mt: 2 }}>
                        {summary.topics.map((topic, index) => (
                          <Box key={index} sx={{ mb: 3 }}>
                            <Typography 
                              variant="subtitle2" 
                              color="secondary.main"
                              sx={{ 
                                mb: 1,
                                fontWeight: 'bold',
                                borderBottom: '2px solid',
                                borderColor: 'secondary.main',
                                pb: 0.5
                              }}
                            >
                              {topic.name}
                            </Typography>
                            {topic.points && topic.points.length > 0 ? (
                              topic.points.map((point, pointIndex) => (
                                <Typography 
                                  key={pointIndex} 
                                  variant="body2" 
                                  sx={{ 
                                    mb: 0.5,
                                    pl: 2,
                                    color: 'text.secondary'
                                  }}
                                >
                                  • {point}
                                </Typography>
                              ))
                            ) : (
                              <Typography 
                                variant="body2" 
                                sx={{ 
                                  pl: 2,
                                  color: 'text.disabled',
                                  fontStyle: 'italic'
                                }}
                              >
                                No specific points identified
                              </Typography>
                            )}
                          </Box>
                        ))}
                      </Box>
                    </Collapse>
                  </CardContent>
                </Card>
              )}
            </Box>
          </Fade>
        )}
      </Box>

      {/* Footer with metadata */}
      {summary && (
        <Box sx={{ 
          p: 1.5, 
          borderTop: 1, 
          borderColor: 'divider',
          backgroundColor: 'background.default'
        }}>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            <Chip
              icon={<Schedule />}
              label={`Generated: ${new Date(summary.generatedAt).toLocaleTimeString()}`}
              size="small"
              variant="outlined"
            />
            
            {summary.processingTime && (
              <Chip
                label={`Processing: ${summary.processingTime}ms`}
                size="small"
                variant="outlined"
              />
            )}
            
            <Chip
              label={`${summary.content?.split(/\s+/).length || 0} words`}
              size="small"
              variant="outlined"
              color={
                summary.content?.split(/\s+/).length >= 150 && 
                summary.content?.split(/\s+/).length <= 200 ? 'success' : 'warning'
              }
            />
            
            {summary.isIncremental && (
              <Chip
                label="Incremental Update"
                size="small"
                variant="outlined"
                color="info"
              />
            )}
            
            {lastUpdateTime && autoUpdate && (
              <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                Last updated: {Math.floor((Date.now() - lastUpdateTime) / 1000)}s ago
              </Typography>
            )}
          </Box>
        </Box>
      )}
    </Paper>
  );
};

export default SummaryPanel;