/**
 * AIService - Google Gemini AI integration for meeting summarization
 * Handles rate limiting, request queuing, and chunked processing
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

class AIService {
  constructor() {
    this.genAI = null;
    this.model = null;
    this.apiKey = null;
    this.isInitialized = false;

    // Rate limiting configuration (15 RPM, 1M tokens/month)
    this.rateLimiter = {
      requestsPerMinute: 15,
      tokensPerMonth: 1000000,
      requestQueue: [],
      requestHistory: [],
      tokenUsage: 0,
      isProcessing: false,
    };

    // Chunk processing configuration
    this.chunkConfig = {
      segmentDuration: 30, // 30-second segments
      maxChunkSize: 8000, // Max tokens per chunk
      overlapWords: 50, // Word overlap between chunks
    };

    // Retry configuration
    this.retryConfig = {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 10000,
    };
  }

  /**
   * Initialize the AI service with API key
   * @param {string} apiKey - Google Gemini API key
   */
  async initialize(apiKey) {
    if (!apiKey) {
      throw new Error("API key is required for AI service initialization");
    }

    try {
      this.apiKey = apiKey;
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      this.isInitialized = true;

      console.log("AI Service initialized successfully");
      return true;
    } catch (error) {
      console.error("Failed to initialize AI service:", error);
      throw new Error(`AI service initialization failed: ${error.message}`);
    }
  }

  /**
   * Check if the service is properly initialized
   */
  isReady() {
    return this.isInitialized && this.model !== null;
  }

  /**
   * Generate summary for transcript segments
   * @param {Array} transcriptSegments - Array of transcript segments
   * @param {Object} options - Summarization options
   * @returns {Promise<Object>} Generated summary
   */
  async generateSummary(transcriptSegments, options = {}) {
    if (!this.isReady()) {
      throw new Error('AI service not initialized. Call initialize() first.');
    }

    if (!transcriptSegments || transcriptSegments.length === 0) {
      throw new Error('No transcript segments provided for summarization');
    }

    try {
      // Process transcript into chunks
      const chunks = this.createTranscriptChunks(transcriptSegments);

      // Generate summaries for each chunk
      const chunkSummaries = [];
      for (const chunk of chunks) {
        const summary = await this.processChunk(chunk, options);
        chunkSummaries.push(summary);
      }

      // Combine chunk summaries into final summary
      const finalSummary = await this.combineSummaries(chunkSummaries, options);

      return {
        id: this.generateId(),
        content: finalSummary.content,
        keyPoints: finalSummary.keyPoints || [],
        decisions: finalSummary.decisions || [],
        actionItems: finalSummary.actionItems || [],
        quotes: finalSummary.quotes || [],
        topics: finalSummary.topics || [],
        generatedAt: Date.now(),
        processingTime: finalSummary.processingTime,
        tokenUsage: finalSummary.tokenUsage,
      };
    } catch (error) {
      console.error('Summary generation failed:', error);
      throw new Error(`Summary generation failed: ${error.message}`);
    }
  }

  /**
   * Generate real-time incremental summary updates
   * @param {Array} newSegments - New transcript segments since last update
   * @param {Object} previousSummary - Previous summary to update
   * @param {Object} options - Update options
   * @returns {Promise<Object>} Updated summary
   */
  async generateIncrementalSummary(newSegments, previousSummary = null, options = {}) {
    if (!this.isReady()) {
      throw new Error('AI service not initialized. Call initialize() first.');
    }

    if (!newSegments || newSegments.length === 0) {
      return previousSummary;
    }

    try {
      const startTime = Date.now();

      // If no previous summary, generate fresh summary
      if (!previousSummary) {
        return await this.generateSummary(newSegments, options);
      }

      // Process new segments
      const newContent = newSegments.map(seg => seg.text).join(' ');
      
      // Create incremental update prompt
      const updatePrompt = this.buildIncrementalUpdatePrompt(
        newContent, 
        previousSummary, 
        options
      );

      const result = await this.queueRequest(async () => {
        const response = await this.model.generateContent(updatePrompt);
        return this.parseSummaryResponse(response.response.text());
      });

      const processingTime = Date.now() - startTime;

      return {
        id: this.generateId(),
        content: result.content,
        keyPoints: result.keyPoints || [],
        decisions: result.decisions || [],
        actionItems: result.actionItems || [],
        quotes: result.quotes || [],
        topics: result.topics || [],
        generatedAt: Date.now(),
        processingTime,
        isIncremental: true,
        previousSummaryId: previousSummary.id
      };

    } catch (error) {
      console.error('Incremental summary generation failed:', error);
      // Fallback to previous summary if update fails
      return previousSummary;
    }
  }

  /**
   * Build prompt for incremental summary updates
   * @param {string} newContent - New transcript content
   * @param {Object} previousSummary - Previous summary
   * @param {Object} options - Prompt options
   * @returns {string} Update prompt
   */
  buildIncrementalUpdatePrompt(newContent, previousSummary, options = {}) {
    return `
Role: You are an expert meeting summarizer updating a real-time summary.
Task: Update the existing summary with new transcript content while maintaining coherence.
Context: This is an incremental update to an ongoing meeting summary.

PREVIOUS SUMMARY:
Content: "${previousSummary.content}"
Key Points: ${JSON.stringify(previousSummary.keyPoints || [])}
Decisions: ${JSON.stringify(previousSummary.decisions || [])}
Action Items: ${JSON.stringify(previousSummary.actionItems || [])}
Quotes: ${JSON.stringify(previousSummary.quotes || [])}
Topics: ${JSON.stringify(previousSummary.topics || [])}

NEW TRANSCRIPT CONTENT:
"${newContent.trim()}"

REQUIREMENTS:
1. Update the summary to incorporate new information (maintain 150-200 words)
2. Merge new key points with existing ones, avoiding duplicates
3. Add any new decisions or action items identified
4. Include new important quotes (without speaker attribution)
5. Update topic segmentation if new topics emerge
6. Maintain coherent narrative flow

Respond with updated JSON in this exact structure:
{
  "content": "Updated summary text (150-200 words)",
  "keyPoints": ["Updated list of key points"],
  "decisions": ["Updated list of decisions"],
  "actionItems": ["Updated list of action items"],
  "quotes": ["Updated list of important quotes"],
  "topics": [
    {
      "name": "Topic Name",
      "points": ["Points for this topic"]
    }
  ]
}

Provide only the JSON response without additional commentary.`;
  }

  /**
   * Create transcript chunks for processing
   * @param {Array} segments - Transcript segments
   * @returns {Array} Chunked transcript data
   */
  createTranscriptChunks(segments) {
    const chunks = [];
    let currentChunk = {
      text: "",
      startTime: null,
      endTime: null,
      segments: [],
    };

    let currentDuration = 0;
    const targetDuration = this.chunkConfig.segmentDuration * 1000; // Convert to ms

    for (const segment of segments) {
      if (currentChunk.startTime === null) {
        currentChunk.startTime = segment.timestamp;
      }

      currentChunk.text += segment.text + " ";
      currentChunk.segments.push(segment);
      currentChunk.endTime = segment.timestamp + (segment.duration || 0);

      currentDuration = currentChunk.endTime - currentChunk.startTime;

      // Check if chunk is ready (duration or size limit reached)
      if (
        currentDuration >= targetDuration ||
        currentChunk.text.length > this.chunkConfig.maxChunkSize
      ) {
        chunks.push({ ...currentChunk });

        // Start new chunk with overlap
        const overlapText = this.getOverlapText(currentChunk.text);
        currentChunk = {
          text: overlapText,
          startTime: segment.timestamp,
          endTime: null,
          segments: [],
        };
        currentDuration = 0;
      }
    }

    // Add final chunk if it has content
    if (currentChunk.text.trim().length > 0) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  /**
   * Get overlap text for chunk continuity
   * @param {string} text - Full chunk text
   * @returns {string} Overlap text
   */
  getOverlapText(text) {
    const words = text.trim().split(" ");
    const overlapWords = Math.min(this.chunkConfig.overlapWords, words.length);
    return words.slice(-overlapWords).join(" ") + " ";
  }

  /**
   * Process a single chunk through AI
   * @param {Object} chunk - Transcript chunk
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} Chunk summary
   */
  async processChunk(chunk, options = {}) {
    const prompt = this.buildSummarizationPrompt(chunk.text, options);

    return await this.queueRequest(async () => {
      const startTime = Date.now();

      try {
        const result = await this.model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        const processingTime = Date.now() - startTime;
        const parsedSummary = this.parseSummaryResponse(text);

        return {
          ...parsedSummary,
          processingTime,
          chunkInfo: {
            startTime: chunk.startTime,
            endTime: chunk.endTime,
            segmentCount: chunk.segments.length,
          },
        };
      } catch (error) {
        console.error("Chunk processing failed:", error);
        throw error;
      }
    });
  }

  /**
   * Build summarization prompt for Gemini
   * @param {string} transcript - Transcript text
   * @param {Object} options - Prompt options
   * @returns {string} Formatted prompt
   */
  buildSummarizationPrompt(transcript, options = {}) {
    const basePrompt = `
Role: You are an expert meeting summarizer and note-taker specializing in real-time meeting analysis.
Task: Analyze this meeting transcript segment and create a structured, intelligent summary.
Context: This is a real-time transcript from an online meeting without speaker attribution.

CRITICAL REQUIREMENTS:
1. Create a concise summary (150-200 words maximum) - this is strictly enforced
2. Identify key discussion points, decisions made, and action items with high accuracy
3. Automatically segment discussions into topic-based sections for better organization
4. Extract important quotes and insights WITHOUT any speaker attribution or names
5. Focus on content substance rather than conversational flow
6. Use clear, professional language suitable for business documentation

TOPIC SEGMENTATION INSTRUCTIONS:
- Analyze the conversation flow to identify distinct discussion topics
- Group related points under logical topic headings
- Identify transitions between different subjects or themes
- Create coherent topic-based organization of the content

QUOTE EXTRACTION GUIDELINES:
- Extract verbatim important statements, decisions, or insights
- Remove any speaker names or identifiers from quotes
- Focus on substantive content rather than casual conversation
- Prioritize quotes that contain key decisions, insights, or important information

FORMAT REQUIREMENTS:
Respond with valid JSON in this exact structure:
{
  "content": "Main summary text (exactly 150-200 words)",
  "keyPoints": ["Specific discussion point 1", "Specific discussion point 2", "Specific discussion point 3"],
  "decisions": ["Concrete decision 1", "Concrete decision 2"],
  "actionItems": ["Specific action with context", "Another actionable item"],
  "quotes": ["Important statement without speaker attribution", "Key insight or decision quote"],
  "topics": [
    {
      "name": "Topic Name 1",
      "points": ["Point related to this topic", "Another point for this topic"]
    },
    {
      "name": "Topic Name 2", 
      "points": ["Point for topic 2", "Another point for topic 2"]
    }
  ]
}

Transcript segment to analyze:
"${transcript.trim()}"

Provide only the JSON response without markdown formatting or additional commentary.`;

    return basePrompt;
  }

  /**
   * Parse AI response into structured summary
   * @param {string} responseText - Raw AI response
   * @returns {Object} Parsed summary object
   */
  parseSummaryResponse(responseText) {
    try {
      // Clean the response text
      let cleanedResponse = responseText.trim();

      // Remove markdown code blocks if present
      cleanedResponse = cleanedResponse
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .replace(/^```/g, '')
        .replace(/```$/g, '');

      // Extract JSON from the response
      const jsonMatch = cleanedResponse.match(/\{.*\}/s);
      if (jsonMatch) {
        cleanedResponse = jsonMatch[0];
      }

      // Parse JSON response
      const parsed = JSON.parse(cleanedResponse);

      // Validate and structure the response
      const result = {
        content: this.validateAndTrimContent(parsed.content || ''),
        keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
        decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
        actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
        quotes: this.sanitizeQuotes(Array.isArray(parsed.quotes) ? parsed.quotes : []),
        topics: this.parseTopicSegmentation(parsed.topics || []),
      };

      return result;
    } catch (error) {
      console.warn(
        'Failed to parse AI response as JSON, using fallback:',
        error
      );

      // Enhanced fallback: try to extract some structure from plain text
      return this.createFallbackSummary(responseText);
    }
  }

  /**
   * Validate and ensure content is within 150-200 word limit
   * @param {string} content - Summary content
   * @returns {string} Validated content
   */
  validateAndTrimContent(content) {
    if (!content || typeof content !== 'string') {
      return '';
    }

    const words = content.trim().split(/\s+/);
    
    // Ensure content is within 150-200 word range
    if (words.length < 150) {
      // Content too short - this might indicate poor AI response
      console.warn('Summary content below 150 words, may need prompt adjustment');
    } else if (words.length > 200) {
      // Trim to 200 words and add ellipsis
      const trimmed = words.slice(0, 200).join(' ');
      return trimmed + '...';
    }

    return content.trim();
  }

  /**
   * Sanitize quotes to remove speaker attribution
   * @param {Array} quotes - Array of quotes
   * @returns {Array} Sanitized quotes
   */
  sanitizeQuotes(quotes) {
    return quotes.map(quote => {
      if (typeof quote !== 'string') return '';
      
      // Remove common speaker patterns
      let sanitized = quote
        .replace(/^[A-Za-z]+:\s*/, '') // Remove "Name: " at start
        .replace(/^"([^"]*)"$/, '$1') // Remove surrounding quotes if present
        .replace(/\s*-\s*[A-Za-z\s]+\s*$/, '') // Remove "- Name" or "- Speaker Name" at end
        .trim();

      return sanitized;
    }).filter(quote => quote.length > 0);
  }

  /**
   * Parse topic segmentation from AI response
   * @param {Array} topics - Topics array from AI
   * @returns {Array} Structured topics
   */
  parseTopicSegmentation(topics) {
    if (!Array.isArray(topics)) {
      return [];
    }

    return topics.map(topic => {
      if (typeof topic === 'string') {
        // Simple topic name only
        return {
          name: topic,
          points: []
        };
      } else if (topic && typeof topic === 'object') {
        // Structured topic with points
        return {
          name: topic.name || 'Unnamed Topic',
          points: Array.isArray(topic.points) ? topic.points : []
        };
      }
      return null;
    }).filter(topic => topic !== null);
  }

  /**
   * Create fallback summary when JSON parsing fails
   * @param {string} responseText - Raw response text
   * @returns {Object} Fallback summary structure
   */
  createFallbackSummary(responseText) {
    const content = this.validateAndTrimContent(responseText);
    
    // Try to extract some basic structure from plain text
    const lines = responseText.split('\n').filter(line => line.trim());
    const keyPoints = [];
    const decisions = [];
    const actionItems = [];
    const quotes = [];

    // Simple pattern matching for common structures
    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
        keyPoints.push(trimmed.substring(2));
      } else if (trimmed.toLowerCase().includes('decision') || trimmed.toLowerCase().includes('decided')) {
        decisions.push(trimmed);
      } else if (trimmed.toLowerCase().includes('action') || trimmed.toLowerCase().includes('will ')) {
        actionItems.push(trimmed);
      } else if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
        quotes.push(this.sanitizeQuotes([trimmed])[0]);
      }
    });

    return {
      content,
      keyPoints: keyPoints.slice(0, 10), // Limit to prevent overflow
      decisions: decisions.slice(0, 5),
      actionItems: actionItems.slice(0, 5),
      quotes: quotes.slice(0, 3),
      topics: []
    };
  }

  /**
   * Combine multiple chunk summaries into final summary
   * @param {Array} chunkSummaries - Array of chunk summaries
   * @param {Object} options - Combination options
   * @returns {Promise<Object>} Combined summary
   */
  async combineSummaries(chunkSummaries, options = {}) {
    if (chunkSummaries.length === 1) {
      return chunkSummaries[0];
    }

    // Combine all content and extract unique items
    const combined = {
      content: "",
      keyPoints: [],
      decisions: [],
      actionItems: [],
      quotes: [],
      topics: [],
      processingTime: 0,
      tokenUsage: 0,
    };

    // Aggregate processing metrics
    chunkSummaries.forEach((summary) => {
      combined.processingTime += summary.processingTime || 0;
      combined.tokenUsage += summary.tokenUsage || 0;
    });

    // Combine and deduplicate content
    const allContent = chunkSummaries.map((s) => s.content).join(' ');
    const allKeyPoints = [
      ...new Set(chunkSummaries.flatMap((s) => s.keyPoints || [])),
    ];
    const allDecisions = [
      ...new Set(chunkSummaries.flatMap((s) => s.decisions || [])),
    ];
    const allActionItems = [
      ...new Set(chunkSummaries.flatMap((s) => s.actionItems || [])),
    ];
    const allQuotes = [
      ...new Set(chunkSummaries.flatMap((s) => s.quotes || [])),
    ];
    const allTopics = this.mergeTopics(chunkSummaries.flatMap((s) => s.topics || []));

    // If we have multiple chunks, create a final consolidation prompt
    if (chunkSummaries.length > 1) {
      const consolidationPrompt = `
Role: You are an expert meeting summarizer.
Task: Consolidate these meeting summary segments into one cohesive final summary.

Requirements:
1. Create a unified summary (150-200 words maximum)
2. Merge and deduplicate key points, decisions, and action items
3. Maintain the most important quotes
4. Ensure logical flow and coherence

Format as JSON:
{
  "content": "Consolidated summary text",
  "keyPoints": ["Merged key points"],
  "decisions": ["Consolidated decisions"],
  "actionItems": ["Combined action items"],
  "quotes": ["Most important quotes"]
}

Summary segments to consolidate:
${chunkSummaries.map((s, i) => `Segment ${i + 1}: ${s.content}`).join("\n\n")}

Key Points: ${allKeyPoints.join(', ')}
Decisions: ${allDecisions.join(', ')}
Action Items: ${allActionItems.join(', ')}
Quotes: ${allQuotes.join(', ')}
Topics: ${JSON.stringify(allTopics)}`;

      try {
        const consolidatedResult = await this.queueRequest(async () => {
          const result = await this.model.generateContent(consolidationPrompt);
          const response = await result.response;
          return this.parseSummaryResponse(response.text());
        });

        return {
          ...consolidatedResult,
          processingTime: combined.processingTime,
          tokenUsage: combined.tokenUsage,
        };
      } catch (error) {
        console.warn('Consolidation failed, using merged content:', error);
      }
    }

    // Fallback: simple merge
    combined.content = this.validateAndTrimContent(allContent);
    combined.keyPoints = allKeyPoints.slice(0, 10); // Limit to top 10
    combined.decisions = allDecisions.slice(0, 10);
    combined.actionItems = allActionItems.slice(0, 10);
    combined.quotes = allQuotes.slice(0, 5);
    combined.topics = allTopics.slice(0, 8);

    return combined;
  }

  /**
   * Queue request with rate limiting
   * @param {Function} requestFn - Function that makes the API request
   * @returns {Promise} Request result
   */
  async queueRequest(requestFn) {
    return new Promise((resolve, reject) => {
      this.rateLimiter.requestQueue.push({
        requestFn,
        resolve,
        reject,
        timestamp: Date.now(),
      });

      this.processQueue();
    });
  }

  /**
   * Process the request queue with rate limiting
   */
  async processQueue() {
    if (
      this.rateLimiter.isProcessing ||
      this.rateLimiter.requestQueue.length === 0
    ) {
      return;
    }

    this.rateLimiter.isProcessing = true;

    while (this.rateLimiter.requestQueue.length > 0) {
      // Check rate limits
      if (!this.canMakeRequest()) {
        const waitTime = this.getWaitTime();
        console.log(`Rate limit reached, waiting ${waitTime}ms`);
        await this.sleep(waitTime);
        continue;
      }

      const request = this.rateLimiter.requestQueue.shift();

      try {
        const result = await this.executeWithRetry(request.requestFn);
        this.recordRequest();
        request.resolve(result);
      } catch (error) {
        request.reject(error);
      }
    }

    this.rateLimiter.isProcessing = false;
  }

  /**
   * Check if we can make a request within rate limits
   * @returns {boolean} Whether request can be made
   */
  canMakeRequest() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Clean old requests from history
    this.rateLimiter.requestHistory = this.rateLimiter.requestHistory.filter(
      (timestamp) => timestamp > oneMinuteAgo
    );

    // Check requests per minute limit
    return (
      this.rateLimiter.requestHistory.length <
      this.rateLimiter.requestsPerMinute
    );
  }

  /**
   * Get wait time until next request can be made
   * @returns {number} Wait time in milliseconds
   */
  getWaitTime() {
    if (this.rateLimiter.requestHistory.length === 0) {
      return 0;
    }

    const oldestRequest = Math.min(...this.rateLimiter.requestHistory);
    const waitTime = 60000 - (Date.now() - oldestRequest);
    return Math.max(0, waitTime);
  }

  /**
   * Record a successful request
   */
  recordRequest() {
    this.rateLimiter.requestHistory.push(Date.now());
  }

  /**
   * Execute request with retry logic
   * @param {Function} requestFn - Request function
   * @returns {Promise} Request result
   */
  async executeWithRetry(requestFn) {
    let lastError;

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        return await requestFn();
      } catch (error) {
        lastError = error;

        if (attempt === this.retryConfig.maxRetries) {
          break;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          this.retryConfig.baseDelay * Math.pow(2, attempt),
          this.retryConfig.maxDelay
        );

        
        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  /**
   * Sleep for specified milliseconds
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise} Sleep promise
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Merge topics from multiple summaries, combining related topics
   * @param {Array} topics - Array of topic objects
   * @returns {Array} Merged and deduplicated topics
   */
  mergeTopics(topics) {
    if (!Array.isArray(topics) || topics.length === 0) {
      return [];
    }

    const topicMap = new Map();

    topics.forEach(topic => {
      if (!topic || !topic.name) return;

      const topicName = topic.name.toLowerCase().trim();
      const points = Array.isArray(topic.points) ? topic.points : [];

      if (topicMap.has(topicName)) {
        // Merge points with existing topic
        const existing = topicMap.get(topicName);
        const combinedPoints = [...existing.points, ...points];
        // Deduplicate points
        existing.points = [...new Set(combinedPoints)];
      } else {
        // Add new topic
        topicMap.set(topicName, {
          name: topic.name, // Keep original casing
          points: [...new Set(points)]
        });
      }
    });

    return Array.from(topicMap.values());
  }

  /**
   * Generate unique ID
   * @returns {string} Unique identifier
   */
  generateId() {
    return `summary_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Get current rate limiting status
   * @returns {Object} Rate limiting information
   */
  getRateLimitStatus() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const recentRequests = this.rateLimiter.requestHistory.filter(
      (timestamp) => timestamp > oneMinuteAgo
    ).length;

    return {
      requestsInLastMinute: recentRequests,
      requestsPerMinuteLimit: this.rateLimiter.requestsPerMinute,
      queueLength: this.rateLimiter.requestQueue.length,
      canMakeRequest: this.canMakeRequest(),
      waitTime: this.getWaitTime(),
    };
  }

  /**
   * Clear request queue and reset rate limiting
   */
  reset() {
    this.rateLimiter.requestQueue = [];
    this.rateLimiter.requestHistory = [];
    this.rateLimiter.isProcessing = false;
    this.rateLimiter.tokenUsage = 0;
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.reset();
    this.genAI = null;
    this.model = null;
    this.isInitialized = false;
  }
}

export default AIService;
