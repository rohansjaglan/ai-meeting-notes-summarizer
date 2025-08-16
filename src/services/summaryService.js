import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * SummaryService - AI-powered text summarization using Google Gemini
 * Handles custom prompts, text processing, and summary generation
 */
class SummaryService {
  constructor() {
    this.genAI = null;
    this.model = null;
    this.isInitialized = false;
    // Hardcoded API key - replace with your actual key
    this.apiKey = 'AIzaSyC9fdRpFRz2AeEgtHXMfCqFX9BYivD4x0U';
    
    // Auto-initialize with hardcoded key
    if (this.apiKey && this.apiKey !== 'YOUR_GEMINI_API_KEY_HERE') {
      this.initialize(this.apiKey);
    }
  }

  /**
   * Initialize the service with API key
   * @param {string} apiKey - Google Gemini API key
   */
  async initialize(apiKey) {
    if (!apiKey) {
      throw new Error('API key is required');
    }

    try {
      this.apiKey = apiKey;
      this.genAI = new GoogleGenerativeAI(apiKey);
      // Use the newer model version
      this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      this.isInitialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize AI service: ${error.message}`);
    }
  }

  /**
   * Generate summary from text with custom prompt
   * @param {string} text - Input text to summarize
   * @param {string} customPrompt - Custom instructions for summarization
   * @returns {Promise<Object>} Summary object
   */
  async generateSummary(text, customPrompt = '') {
    if (!this.isInitialized) {
      throw new Error('Service not initialized. Please provide an API key.');
    }

    if (!text || text.trim().length === 0) {
      throw new Error('No text provided for summarization');
    }

    const startTime = Date.now();

    try {
      // Build the prompt
      const prompt = this.buildPrompt(text, customPrompt);
      
      // Generate content
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const summaryText = response.text();

      const processingTime = Date.now() - startTime;

      // Parse and structure the summary
      const structuredSummary = this.parseStructuredSummary(summaryText);

      return {
        id: `summary_${Date.now()}`,
        content: structuredSummary.content || summaryText,
        keyPoints: structuredSummary.keyPoints || [],
        decisions: structuredSummary.decisions || [],
        actionItems: structuredSummary.actionItems || [],
        quotes: structuredSummary.quotes || [],
        topics: structuredSummary.topics || [],
        generatedAt: new Date().toISOString(),
        processingTime,
        wordCount: summaryText.split(/\s+/).length,
        originalWordCount: text.split(/\s+/).length,
        customPrompt: customPrompt || null,
        isEdited: false
      };
    } catch (error) {
      throw new Error(`Failed to generate summary: ${error.message}`);
    }
  }

  /**
   * Build the complete prompt for AI generation
   * @param {string} text - Input text
   * @param {string} customPrompt - Custom instructions
   * @returns {string} Complete prompt
   */
  buildPrompt(text, customPrompt) {
    let prompt = '';

    if (customPrompt && customPrompt.trim()) {
      // Use custom prompt
      prompt = `${customPrompt.trim()}\n\nText to summarize:\n${text}`;
    } else {
      // Use default structured prompt
      prompt = `Please analyze the following meeting transcript and provide a comprehensive summary with the following structure:

1. **MAIN SUMMARY**: A concise overview of the meeting (2-3 paragraphs)

2. **KEY POINTS**: List the most important points discussed (bullet points)

3. **DECISIONS MADE**: List any decisions that were made during the meeting

4. **ACTION ITEMS**: List specific tasks, assignments, or follow-up actions mentioned

5. **IMPORTANT QUOTES**: Any notable quotes or statements that should be highlighted

6. **TOPICS DISCUSSED**: Main topics or themes covered in the meeting

Please format your response clearly with these sections. If any section has no content, you can omit it.

Meeting transcript:
${text}`;
    }

    return prompt;
  }

  /**
   * Parse structured summary from AI response
   * @param {string} summaryText - Raw AI response
   * @returns {Object} Parsed summary object
   */
  parseStructuredSummary(summaryText) {
    const result = {
      content: '',
      keyPoints: [],
      decisions: [],
      actionItems: [],
      quotes: [],
      topics: []
    };

    try {
      // Split into sections
      const sections = summaryText.split(/(?=\*\*[A-Z\s]+\*\*|#{1,3}\s*[A-Z\s]+)/i);
      
      let mainContent = '';
      
      for (const section of sections) {
        const trimmedSection = section.trim();
        if (!trimmedSection) continue;

        // Check for different section types
        if (this.matchesSection(trimmedSection, ['MAIN SUMMARY', 'SUMMARY', 'OVERVIEW'])) {
          mainContent = this.extractSectionContent(trimmedSection);
        } else if (this.matchesSection(trimmedSection, ['KEY POINTS', 'MAIN POINTS', 'IMPORTANT POINTS'])) {
          result.keyPoints = this.extractListItems(trimmedSection);
        } else if (this.matchesSection(trimmedSection, ['DECISIONS', 'DECISIONS MADE'])) {
          result.decisions = this.extractListItems(trimmedSection);
        } else if (this.matchesSection(trimmedSection, ['ACTION ITEMS', 'ACTIONS', 'TASKS', 'TODO'])) {
          result.actionItems = this.extractListItems(trimmedSection);
        } else if (this.matchesSection(trimmedSection, ['QUOTES', 'IMPORTANT QUOTES', 'NOTABLE QUOTES'])) {
          result.quotes = this.extractQuotes(trimmedSection);
        } else if (this.matchesSection(trimmedSection, ['TOPICS', 'TOPICS DISCUSSED', 'THEMES'])) {
          result.topics = this.extractTopics(trimmedSection);
        } else if (!mainContent && !trimmedSection.match(/^\*\*[A-Z\s]+\*\*/)) {
          // If no main content found yet and this doesn't look like a section header
          mainContent = trimmedSection;
        }
      }

      result.content = mainContent || summaryText;

      return result;
    } catch (error) {
      // If parsing fails, return the raw content
      return {
        content: summaryText,
        keyPoints: [],
        decisions: [],
        actionItems: [],
        quotes: [],
        topics: []
      };
    }
  }

  /**
   * Check if section matches any of the given patterns
   * @param {string} section - Section text
   * @param {Array} patterns - Patterns to match
   * @returns {boolean} Whether section matches
   */
  matchesSection(section, patterns) {
    const firstLine = section.split('\n')[0].toLowerCase();
    return patterns.some(pattern => 
      firstLine.includes(pattern.toLowerCase()) ||
      firstLine.includes(`**${pattern.toLowerCase()}**`) ||
      firstLine.includes(`# ${pattern.toLowerCase()}`)
    );
  }

  /**
   * Extract content from a section (removing header)
   * @param {string} section - Section text
   * @returns {string} Cleaned content
   */
  extractSectionContent(section) {
    const lines = section.split('\n');
    // Skip the first line (header) and join the rest
    return lines.slice(1).join('\n').trim();
  }

  /**
   * Extract list items from section
   * @param {string} section - Section text
   * @returns {Array} List of items
   */
  extractListItems(section) {
    const content = this.extractSectionContent(section);
    const items = [];
    
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && (trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('*') || /^\d+\./.test(trimmed))) {
        // Remove bullet points and numbering
        const cleaned = trimmed.replace(/^[•\-*]\s*/, '').replace(/^\d+\.\s*/, '').trim();
        if (cleaned) {
          items.push(cleaned);
        }
      } else if (trimmed && items.length === 0) {
        // If no bullet points found, treat each non-empty line as an item
        items.push(trimmed);
      }
    }
    
    return items;
  }

  /**
   * Extract quotes from section
   * @param {string} section - Section text
   * @returns {Array} List of quotes
   */
  extractQuotes(section) {
    const content = this.extractSectionContent(section);
    const quotes = [];
    
    // Look for quoted text
    const quoteMatches = content.match(/"([^"]+)"/g);
    if (quoteMatches) {
      quotes.push(...quoteMatches.map(quote => quote.replace(/"/g, '')));
    }
    
    // Also look for lines that might be quotes without quotes
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !quoteMatches && (trimmed.startsWith('•') || trimmed.startsWith('-'))) {
        const cleaned = trimmed.replace(/^[•\-*]\s*/, '').trim();
        if (cleaned) {
          quotes.push(cleaned);
        }
      }
    }
    
    return quotes;
  }

  /**
   * Extract topics from section
   * @param {string} section - Section text
   * @returns {Array} List of topic objects
   */
  extractTopics(section) {
    const content = this.extractSectionContent(section);
    const topics = [];
    
    const lines = content.split('\n');
    let currentTopic = null;
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      // Check if this looks like a topic header
      if (trimmed.endsWith(':') || (!trimmed.startsWith('•') && !trimmed.startsWith('-') && !trimmed.startsWith('*'))) {
        if (currentTopic) {
          topics.push(currentTopic);
        }
        currentTopic = {
          name: trimmed.replace(':', ''),
          points: []
        };
      } else if (currentTopic && (trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('*'))) {
        // This is a point under the current topic
        const cleaned = trimmed.replace(/^[•\-*]\s*/, '').trim();
        if (cleaned) {
          currentTopic.points.push(cleaned);
        }
      } else if (!currentTopic) {
        // No topic structure found, treat as simple topic
        topics.push({
          name: trimmed,
          points: []
        });
      }
    }
    
    if (currentTopic) {
      topics.push(currentTopic);
    }
    
    return topics;
  }

  /**
   * Test the service with sample text
   * @returns {Promise<Object>} Test result
   */
  async testService() {
    const sampleText = `
    Meeting started at 2:00 PM with John, Sarah, and Mike present.
    
    John reported that the Q3 sales targets were exceeded by 15%. Sarah mentioned that the new product launch is scheduled for next month.
    
    Decision: We agreed to increase the marketing budget by $50,000 for the product launch.
    
    Action items:
    - Mike will prepare the marketing campaign by Friday
    - Sarah will coordinate with the design team
    - John will update the sales projections
    
    Meeting ended at 3:30 PM.
    `;

    const samplePrompt = "Summarize this meeting in bullet points for executives";

    try {
      const result = await this.generateSummary(sampleText, samplePrompt);
      return {
        success: true,
        result,
        message: 'Service test completed successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Service test failed'
      };
    }
  }

  /**
   * Get service status
   * @returns {Object} Service status
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      hasApiKey: !!this.apiKey,
      modelName: this.model ? 'gemini-1.5-flash' : null
    };
  }
}

// Create and export singleton instance
const summaryService = new SummaryService();
export default summaryService;
