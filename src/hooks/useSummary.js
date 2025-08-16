import { useState, useEffect, useRef, useCallback } from 'react';
import AIService from '../services/aiService';

/**
 * Custom React hook for managing AI summary functionality
 * Provides state management and lifecycle handling for AIService integration
 */
const useSummary = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentSummary, setCurrentSummary] = useState(null);
  const [error, setError] = useState(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState(null);
  const [rateLimitStatus, setRateLimitStatus] = useState(null);

  const aiServiceRef = useRef(null);
  const processingTimeoutRef = useRef(null);
  const lastTranscriptSegmentsRef = useRef([]);

  /**
   * Initialize AI service with API key
   * @param {string} apiKey - Google Gemini API key
   */
  const initialize = useCallback(async (apiKey) => {
    if (aiServiceRef.current || isInitializing) {
      return;
    }

    if (!apiKey || !apiKey.trim()) {
      setError({
        message: 'API key is required for AI service initialization',
        timestamp: Date.now()
      });
      return;
    }

    setIsInitializing(true);
    setError(null);

    try {
      const aiService = new AIService();
      await aiService.initialize(apiKey);
      
      aiServiceRef.current = aiService;
      setIsInitialized(true);
      
      // Update rate limit status
      const status = aiService.getRateLimitStatus();
      setRateLimitStatus(status);
      
    } catch (err) {
      setError({
        message: 'Failed to initialize AI service',
        error: err,
        timestamp: Date.now()
      });
    } finally {
      setIsInitializing(false);
    }
  }, [isInitializing]);

  /**
   * Generate summary from transcript segments
   * @param {Array} transcriptSegments - Array of transcript segments
   * @param {Object} options - Generation options
   */
  const generateSummary = useCallback(async (transcriptSegments, options = {}) => {
    if (!aiServiceRef.current) {
      setError({
        message: 'AI service not initialized. Please initialize first.',
        timestamp: Date.now()
      });
      return;
    }

    if (!transcriptSegments || transcriptSegments.length === 0) {
      setError({
        message: 'No transcript segments provided for summarization',
        timestamp: Date.now()
      });
      return;
    }

    setError(null);
    setIsGenerating(true);
    setProcessingProgress(0);
    
    // Estimate processing time based on content length
    const totalWords = transcriptSegments
      .map(segment => segment.text.split(/\s+/).length)
      .reduce((sum, count) => sum + count, 0);
    
    const estimatedTime = Math.max(3000, Math.min(15000, totalWords * 50)); // 50ms per word, 3-15s range
    setEstimatedTimeRemaining(estimatedTime);

    // Start progress simulation
    const progressInterval = setInterval(() => {
      setProcessingProgress(prev => {
        const increment = Math.random() * 15 + 5; // 5-20% increments
        return Math.min(prev + increment, 90); // Cap at 90% until completion
      });
    }, 500);

    // Start countdown timer
    const countdownInterval = setInterval(() => {
      setEstimatedTimeRemaining(prev => {
        if (prev <= 1000) {
          clearInterval(countdownInterval);
          return 0;
        }
        return prev - 1000;
      });
    }, 1000);

    try {
      const summary = await aiServiceRef.current.generateSummary(transcriptSegments, options);
      
      setCurrentSummary(summary);
      setProcessingProgress(100);
      lastTranscriptSegmentsRef.current = [...transcriptSegments];
      
      // Update rate limit status
      const status = aiServiceRef.current.getRateLimitStatus();
      setRateLimitStatus(status);
      
    } catch (err) {
      setError({
        message: 'Failed to generate summary',
        error: err,
        timestamp: Date.now()
      });
    } finally {
      clearInterval(progressInterval);
      clearInterval(countdownInterval);
      setIsGenerating(false);
      setProcessingProgress(0);
      setEstimatedTimeRemaining(null);
    }
  }, []);

  /**
   * Generate incremental summary update
   * @param {Array} newSegments - New transcript segments since last update
   * @param {Object} options - Update options
   */
  const generateIncrementalSummary = useCallback(async (newSegments, options = {}) => {
    if (!aiServiceRef.current) {
      setError({
        message: 'AI service not initialized. Please initialize first.',
        timestamp: Date.now()
      });
      return;
    }

    if (!newSegments || newSegments.length === 0) {
      return; // No new content to process
    }

    setError(null);
    setIsGenerating(true);
    setProcessingProgress(0);

    // Shorter estimated time for incremental updates
    const newWords = newSegments
      .map(segment => segment.text.split(/\s+/).length)
      .reduce((sum, count) => sum + count, 0);
    
    const estimatedTime = Math.max(2000, Math.min(8000, newWords * 30)); // 30ms per word, 2-8s range
    setEstimatedTimeRemaining(estimatedTime);

    // Progress simulation for incremental updates
    const progressInterval = setInterval(() => {
      setProcessingProgress(prev => {
        const increment = Math.random() * 20 + 10; // Faster progress for incremental
        return Math.min(prev + increment, 90);
      });
    }, 300);

    const countdownInterval = setInterval(() => {
      setEstimatedTimeRemaining(prev => {
        if (prev <= 1000) {
          clearInterval(countdownInterval);
          return 0;
        }
        return prev - 1000;
      });
    }, 1000);

    try {
      const updatedSummary = await aiServiceRef.current.generateIncrementalSummary(
        newSegments, 
        currentSummary, 
        options
      );
      
      if (updatedSummary) {
        setCurrentSummary(updatedSummary);
        setProcessingProgress(100);
        
        // Update the reference with all segments
        const allSegments = [...lastTranscriptSegmentsRef.current, ...newSegments];
        lastTranscriptSegmentsRef.current = allSegments;
      }
      
      // Update rate limit status
      const status = aiServiceRef.current.getRateLimitStatus();
      setRateLimitStatus(status);
      
    } catch (err) {
      setError({
        message: 'Failed to generate incremental summary',
        error: err,
        timestamp: Date.now()
      });
    } finally {
      clearInterval(progressInterval);
      clearInterval(countdownInterval);
      setIsGenerating(false);
      setProcessingProgress(0);
      setEstimatedTimeRemaining(null);
    }
  }, [currentSummary]);

  /**
   * Refresh current summary with latest transcript data
   */
  const refreshSummary = useCallback(async () => {
    if (lastTranscriptSegmentsRef.current.length > 0) {
      await generateSummary(lastTranscriptSegmentsRef.current);
    }
  }, [generateSummary]);

  /**
   * Clear current summary and reset state
   */
  const clearSummary = useCallback(() => {
    setCurrentSummary(null);
    setError(null);
    setProcessingProgress(0);
    setEstimatedTimeRemaining(null);
    lastTranscriptSegmentsRef.current = [];
    
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current);
      processingTimeoutRef.current = null;
    }
  }, []);

  /**
   * Clear current error
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Get current rate limiting status
   */
  const getRateLimitStatus = useCallback(() => {
    if (!aiServiceRef.current) {
      return null;
    }
    
    const status = aiServiceRef.current.getRateLimitStatus();
    setRateLimitStatus(status);
    return status;
  }, []);

  /**
   * Check if service can make requests
   */
  const canMakeRequest = useCallback(() => {
    if (!aiServiceRef.current) {
      return false;
    }
    
    const status = aiServiceRef.current.getRateLimitStatus();
    return status.canMakeRequest && status.queueLength < 5; // Limit queue size
  }, []);

  /**
   * Auto-generate summary when transcript reaches certain thresholds
   * @param {Array} transcriptSegments - Current transcript segments
   * @param {Object} options - Auto-generation options
   */
  const autoGenerateSummary = useCallback(async (transcriptSegments, options = {}) => {
    if (!aiServiceRef.current || isGenerating || !canMakeRequest()) {
      return;
    }

    const {
      minSegments = 10,
      minWords = 100,
      intervalSeconds = 30,
      enableAutoGeneration = true
    } = options;

    if (!enableAutoGeneration) {
      return;
    }

    // Check if we have enough content
    const finalSegments = transcriptSegments.filter(segment => segment.isFinal);
    const totalWords = finalSegments
      .map(segment => segment.text.split(/\s+/).length)
      .reduce((sum, count) => sum + count, 0);

    if (finalSegments.length < minSegments || totalWords < minWords) {
      return;
    }

    // Check if enough time has passed since last summary
    if (currentSummary) {
      const timeSinceLastSummary = Date.now() - currentSummary.generatedAt;
      if (timeSinceLastSummary < intervalSeconds * 1000) {
        return;
      }

      // Generate incremental update if we have new content
      const newSegments = finalSegments.slice(lastTranscriptSegmentsRef.current.length);
      if (newSegments.length > 0) {
        await generateIncrementalSummary(newSegments, options);
      }
    } else {
      // Generate initial summary
      await generateSummary(finalSegments, options);
    }
  }, [isGenerating, canMakeRequest, currentSummary, generateSummary, generateIncrementalSummary]);

  /**
   * Get summary statistics
   */
  const getSummaryStats = useCallback(() => {
    if (!currentSummary) {
      return null;
    }

    const wordCount = currentSummary.content?.split(/\s+/).length || 0;
    const sectionsCount = [
      currentSummary.keyPoints?.length || 0,
      currentSummary.decisions?.length || 0,
      currentSummary.actionItems?.length || 0,
      currentSummary.quotes?.length || 0,
      currentSummary.topics?.length || 0
    ].reduce((sum, count) => sum + count, 0);

    return {
      wordCount,
      sectionsCount,
      keyPointsCount: currentSummary.keyPoints?.length || 0,
      decisionsCount: currentSummary.decisions?.length || 0,
      actionItemsCount: currentSummary.actionItems?.length || 0,
      quotesCount: currentSummary.quotes?.length || 0,
      topicsCount: currentSummary.topics?.length || 0,
      processingTime: currentSummary.processingTime || 0,
      generatedAt: currentSummary.generatedAt,
      isIncremental: currentSummary.isIncremental || false
    };
  }, [currentSummary]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (aiServiceRef.current) {
        aiServiceRef.current.cleanup();
        aiServiceRef.current = null;
      }
      
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current);
      }
    };
  }, []);

  // Update rate limit status periodically
  useEffect(() => {
    if (!isInitialized || !aiServiceRef.current) {
      return;
    }

    const interval = setInterval(() => {
      const status = aiServiceRef.current.getRateLimitStatus();
      setRateLimitStatus(status);
    }, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, [isInitialized]);

  return {
    // State
    isInitialized,
    isInitializing,
    isGenerating,
    currentSummary,
    error,
    processingProgress,
    estimatedTimeRemaining,
    rateLimitStatus,
    
    // Actions
    initialize,
    generateSummary,
    generateIncrementalSummary,
    refreshSummary,
    clearSummary,
    clearError,
    autoGenerateSummary,
    
    // Utilities
    getRateLimitStatus,
    canMakeRequest,
    getSummaryStats,
    
    // Computed state
    canGenerate: isInitialized && !isGenerating && canMakeRequest(),
    hasSummary: currentSummary !== null,
    isReady: isInitialized && !isInitializing
  };
};

export default useSummary;