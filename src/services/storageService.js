/**
 * StorageService - Manages local data storage using IndexedDB for transcript persistence
 * Handles session data models, automatic cleanup, data compression, and validation
 */

class StorageService {
  constructor() {
    this.dbName = 'InterviewSummarizerDB';
    this.dbVersion = 1;
    this.db = null;
    this.isInitialized = false;
    
    // Default retention policy (30 days)
    this.defaultRetentionDays = 30;
    
    // Store names
    this.stores = {
      sessions: 'sessions',
      transcripts: 'transcripts', 
      summaries: 'summaries',
      settings: 'settings'
    };
  }

  /**
   * Initialize the IndexedDB database
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        reject(new Error(`Failed to open database: ${request.error}`));
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.isInitialized = true;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Create sessions store
        if (!db.objectStoreNames.contains(this.stores.sessions)) {
          const sessionStore = db.createObjectStore(this.stores.sessions, { 
            keyPath: 'id' 
          });
          sessionStore.createIndex('date', 'date', { unique: false });
          sessionStore.createIndex('platform', 'platform', { unique: false });
        }

        // Create transcripts store
        if (!db.objectStoreNames.contains(this.stores.transcripts)) {
          const transcriptStore = db.createObjectStore(this.stores.transcripts, { 
            keyPath: 'id' 
          });
          transcriptStore.createIndex('sessionId', 'sessionId', { unique: false });
          transcriptStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Create summaries store
        if (!db.objectStoreNames.contains(this.stores.summaries)) {
          const summaryStore = db.createObjectStore(this.stores.summaries, { 
            keyPath: 'id' 
          });
          summaryStore.createIndex('sessionId', 'sessionId', { unique: false });
          summaryStore.createIndex('generatedAt', 'generatedAt', { unique: false });
        }

        // Create settings store
        if (!db.objectStoreNames.contains(this.stores.settings)) {
          db.createObjectStore(this.stores.settings, { keyPath: 'key' });
        }
      };
    });
  }

  /**
   * Create a new meeting session
   * @param {Object} sessionData - Session data
   * @returns {Promise<string>} Session ID
   */
  async createSession(sessionData) {
    await this.ensureInitialized();
    
    const session = this.validateSessionData({
      id: this.generateId(),
      date: new Date().toISOString(),
      duration: 0,
      platform: sessionData.platform || 'unknown',
      status: 'active',
      metadata: {
        audioQuality: sessionData.audioQuality || 0,
        processingTime: 0,
        ...sessionData.metadata
      },
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.stores.sessions], 'readwrite');
      const store = transaction.objectStore(this.stores.sessions);
      
      const request = store.add(session);
      
      request.onsuccess = () => resolve(session.id);
      request.onerror = () => reject(new Error(`Failed to create session: ${request.error}`));
    });
  }

  /**
   * Save meeting session (alias for createSession for backward compatibility)
   * @param {Object} sessionData - Session data
   * @returns {Promise<string>} Session ID
   */
  async saveMeetingSession(sessionData) {
    return this.createSession(sessionData);
  }

  /**
   * Update an existing session
   * @param {string} sessionId - Session ID
   * @param {Object} updates - Updates to apply
   * @returns {Promise<void>}
   */
  async updateSession(sessionId, updates) {
    await this.ensureInitialized();
    
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const updatedSession = {
      ...session,
      ...updates,
      updatedAt: Date.now()
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.stores.sessions], 'readwrite');
      const store = transaction.objectStore(this.stores.sessions);
      
      const request = store.put(updatedSession);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to update session: ${request.error}`));
    });
  }

  /**
   * Get a session by ID
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object|null>} Session data or null if not found
   */
  async getSession(sessionId) {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.stores.sessions], 'readonly');
      const store = transaction.objectStore(this.stores.sessions);
      
      const request = store.get(sessionId);
      
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(new Error(`Failed to get session: ${request.error}`));
    });
  }

  /**
   * Get all sessions with optional filtering
   * @param {Object} options - Filter options
   * @returns {Promise<Array>} Array of sessions
   */
  async getSessions(options = {}) {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.stores.sessions], 'readonly');
      const store = transaction.objectStore(this.stores.sessions);
      
      let request;
      
      if (options.platform) {
        const index = store.index('platform');
        request = index.getAll(options.platform);
      } else {
        request = store.getAll();
      }
      
      request.onsuccess = () => {
        let sessions = request.result;
        
        // Apply date filtering if specified
        if (options.startDate || options.endDate) {
          sessions = sessions.filter(session => {
            const sessionDate = new Date(session.date);
            if (options.startDate && sessionDate < new Date(options.startDate)) {
              return false;
            }
            if (options.endDate && sessionDate > new Date(options.endDate)) {
              return false;
            }
            return true;
          });
        }
        
        // Sort by date (newest first)
        sessions.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        resolve(sessions);
      };
      
      request.onerror = () => reject(new Error(`Failed to get sessions: ${request.error}`));
    });
  }

  /**
   * Save transcript segments for a session
   * @param {string} sessionId - Session ID
   * @param {Array} segments - Transcript segments
   * @returns {Promise<void>}
   */
  async saveTranscriptSegments(sessionId, segments) {
    await this.ensureInitialized();
    
    if (!Array.isArray(segments)) {
      throw new Error('Segments must be an array');
    }

    const compressedSegments = segments.map(segment => 
      this.compressTranscriptSegment(this.validateTranscriptSegment(segment, sessionId))
    );

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.stores.transcripts], 'readwrite');
      const store = transaction.objectStore(this.stores.transcripts);
      
      let completed = 0;
      const total = compressedSegments.length;
      
      if (total === 0) {
        resolve();
        return;
      }

      compressedSegments.forEach(segment => {
        const request = store.put(segment);
        
        request.onsuccess = () => {
          completed++;
          if (completed === total) {
            resolve();
          }
        };
        
        request.onerror = () => {
          reject(new Error(`Failed to save transcript segment: ${request.error}`));
        };
      });
    });
  }

  /**
   * Get transcript segments for a session
   * @param {string} sessionId - Session ID
   * @returns {Promise<Array>} Array of transcript segments
   */
  async getTranscriptSegments(sessionId) {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.stores.transcripts], 'readonly');
      const store = transaction.objectStore(this.stores.transcripts);
      const index = store.index('sessionId');
      
      const request = index.getAll(sessionId);
      
      request.onsuccess = () => {
        const segments = request.result.map(segment => 
          this.decompressTranscriptSegment(segment)
        );
        
        // Sort by timestamp
        segments.sort((a, b) => a.timestamp - b.timestamp);
        
        resolve(segments);
      };
      
      request.onerror = () => reject(new Error(`Failed to get transcript segments: ${request.error}`));
    });
  }

  /**
   * Save a summary for a session
   * @param {string} sessionId - Session ID
   * @param {Object} summaryData - Summary data
   * @returns {Promise<string>} Summary ID
   */
  async saveSummary(sessionId, summaryData) {
    await this.ensureInitialized();
    
    const summary = this.validateSummaryData({
      id: this.generateId(),
      sessionId,
      content: summaryData.content || '',
      keyPoints: summaryData.keyPoints || [],
      decisions: summaryData.decisions || [],
      actionItems: summaryData.actionItems || [],
      quotes: summaryData.quotes || [],
      generatedAt: Date.now(),
      processingTime: summaryData.processingTime || 0,
      metadata: summaryData.metadata || {}
    });

    // Compress the summary content
    const compressedSummary = this.compressSummary(summary);

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.stores.summaries], 'readwrite');
      const store = transaction.objectStore(this.stores.summaries);
      
      const request = store.put(compressedSummary);
      
      request.onsuccess = () => resolve(summary.id);
      request.onerror = () => reject(new Error(`Failed to save summary: ${request.error}`));
    });
  }

  /**
   * Get summary for a session
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object|null>} Summary data or null if not found
   */
  async getSummary(sessionId) {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.stores.summaries], 'readonly');
      const store = transaction.objectStore(this.stores.summaries);
      const index = store.index('sessionId');
      
      const request = index.get(sessionId);
      
      request.onsuccess = () => {
        const result = request.result;
        if (result) {
          resolve(this.decompressSummary(result));
        } else {
          resolve(null);
        }
      };
      
      request.onerror = () => reject(new Error(`Failed to get summary: ${request.error}`));
    });
  }

  /**
   * Search through transcripts and summaries
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Object>} Search results
   */
  async search(query, options = {}) {
    await this.ensureInitialized();
    
    if (!query || query.trim().length === 0) {
      return { transcripts: [], summaries: [] };
    }

    const searchTerm = query.toLowerCase().trim();
    const results = { transcripts: [], summaries: [] };

    // Search transcripts
    const transcriptResults = await this.searchTranscripts(searchTerm, options);
    results.transcripts = transcriptResults;

    // Search summaries
    const summaryResults = await this.searchSummaries(searchTerm, options);
    results.summaries = summaryResults;

    return results;
  }

  /**
   * Search transcripts
   * @param {string} searchTerm - Search term
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Search results
   */
  async searchTranscripts(searchTerm, options = {}) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.stores.transcripts, this.stores.sessions], 'readonly');
      const transcriptStore = transaction.objectStore(this.stores.transcripts);
      const sessionStore = transaction.objectStore(this.stores.sessions);
      
      const request = transcriptStore.getAll();
      
      request.onsuccess = async () => {
        const allTranscripts = request.result;
        const matchingTranscripts = [];

        for (const transcript of allTranscripts) {
          const decompressed = this.decompressTranscriptSegment(transcript);
          
          if (decompressed.text.toLowerCase().includes(searchTerm)) {
            // Get session info
            const sessionRequest = sessionStore.get(decompressed.sessionId);
            
            await new Promise((sessionResolve) => {
              sessionRequest.onsuccess = () => {
                const session = sessionRequest.result;
                
                // Apply date filter if specified
                if (options.startDate || options.endDate) {
                  const sessionDate = new Date(session.date);
                  if (options.startDate && sessionDate < new Date(options.startDate)) {
                    sessionResolve();
                    return;
                  }
                  if (options.endDate && sessionDate > new Date(options.endDate)) {
                    sessionResolve();
                    return;
                  }
                }

                matchingTranscripts.push({
                  ...decompressed,
                  sessionDate: session.date,
                  sessionPlatform: session.platform,
                  highlightedText: this.highlightSearchTerm(decompressed.text, searchTerm)
                });
                
                sessionResolve();
              };
            });
          }
        }

        // Sort by relevance (number of matches) and then by timestamp
        matchingTranscripts.sort((a, b) => {
          const aMatches = (a.text.toLowerCase().match(new RegExp(searchTerm, 'g')) || []).length;
          const bMatches = (b.text.toLowerCase().match(new RegExp(searchTerm, 'g')) || []).length;
          
          if (aMatches !== bMatches) {
            return bMatches - aMatches;
          }
          
          return b.timestamp - a.timestamp;
        });

        resolve(matchingTranscripts);
      };
      
      request.onerror = () => reject(new Error(`Failed to search transcripts: ${request.error}`));
    });
  }

  /**
   * Search summaries
   * @param {string} searchTerm - Search term
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Search results
   */
  async searchSummaries(searchTerm, options = {}) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.stores.summaries, this.stores.sessions], 'readonly');
      const summaryStore = transaction.objectStore(this.stores.summaries);
      const sessionStore = transaction.objectStore(this.stores.sessions);
      
      const request = summaryStore.getAll();
      
      request.onsuccess = async () => {
        const allSummaries = request.result;
        const matchingSummaries = [];

        for (const summary of allSummaries) {
          const decompressed = this.decompressSummary(summary);
          
          // Search in content, key points, decisions, action items, and quotes
          const searchableText = [
            decompressed.content,
            ...decompressed.keyPoints,
            ...decompressed.decisions,
            ...decompressed.actionItems,
            ...decompressed.quotes
          ].join(' ').toLowerCase();

          if (searchableText.includes(searchTerm)) {
            // Get session info
            const sessionRequest = sessionStore.get(decompressed.sessionId);
            
            await new Promise((sessionResolve) => {
              sessionRequest.onsuccess = () => {
                const session = sessionRequest.result;
                
                // Apply date filter if specified
                if (options.startDate || options.endDate) {
                  const sessionDate = new Date(session.date);
                  if (options.startDate && sessionDate < new Date(options.startDate)) {
                    sessionResolve();
                    return;
                  }
                  if (options.endDate && sessionDate > new Date(options.endDate)) {
                    sessionResolve();
                    return;
                  }
                }

                matchingSummaries.push({
                  ...decompressed,
                  sessionDate: session.date,
                  sessionPlatform: session.platform,
                  highlightedContent: this.highlightSearchTerm(decompressed.content, searchTerm)
                });
                
                sessionResolve();
              };
            });
          }
        }

        // Sort by relevance and then by generation date
        matchingSummaries.sort((a, b) => {
          const aContent = [a.content, ...a.keyPoints, ...a.decisions, ...a.actionItems, ...a.quotes].join(' ').toLowerCase();
          const bContent = [b.content, ...b.keyPoints, ...b.decisions, ...b.actionItems, ...b.quotes].join(' ').toLowerCase();
          
          const aMatches = (aContent.match(new RegExp(searchTerm, 'g')) || []).length;
          const bMatches = (bContent.match(new RegExp(searchTerm, 'g')) || []).length;
          
          if (aMatches !== bMatches) {
            return bMatches - aMatches;
          }
          
          return b.generatedAt - a.generatedAt;
        });

        resolve(matchingSummaries);
      };
      
      request.onerror = () => reject(new Error(`Failed to search summaries: ${request.error}`));
    });
  }  /**

   * Clean up old data based on retention policy
   * @param {number} retentionDays - Number of days to retain data
   * @returns {Promise<Object>} Cleanup results
   */
  async cleanupOldData(retentionDays = null) {
    await this.ensureInitialized();
    
    const retention = retentionDays || await this.getRetentionPolicy();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retention);
    
    const results = {
      sessionsDeleted: 0,
      transcriptsDeleted: 0,
      summariesDeleted: 0
    };

    // Get old sessions
    const oldSessions = await this.getSessions({
      endDate: cutoffDate.toISOString()
    });

    // Delete old data
    for (const session of oldSessions) {
      await this.deleteSession(session.id);
      results.sessionsDeleted++;
    }

    return results;
  }

  /**
   * Delete a session and all associated data
   * @param {string} sessionId - Session ID
   * @returns {Promise<void>}
   */
  async deleteSession(sessionId) {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([
        this.stores.sessions,
        this.stores.transcripts,
        this.stores.summaries
      ], 'readwrite');

      let completed = 0;
      const total = 3;

      const checkComplete = () => {
        completed++;
        if (completed === total) {
          resolve();
        }
      };

      // Delete session
      const sessionStore = transaction.objectStore(this.stores.sessions);
      const sessionRequest = sessionStore.delete(sessionId);
      sessionRequest.onsuccess = checkComplete;
      sessionRequest.onerror = () => reject(new Error(`Failed to delete session: ${sessionRequest.error}`));

      // Delete transcripts
      const transcriptStore = transaction.objectStore(this.stores.transcripts);
      const transcriptIndex = transcriptStore.index('sessionId');
      const transcriptRequest = transcriptIndex.openCursor(sessionId);
      
      transcriptRequest.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          checkComplete();
        }
      };
      transcriptRequest.onerror = () => reject(new Error(`Failed to delete transcripts: ${transcriptRequest.error}`));

      // Delete summaries
      const summaryStore = transaction.objectStore(this.stores.summaries);
      const summaryIndex = summaryStore.index('sessionId');
      const summaryRequest = summaryIndex.openCursor(sessionId);
      
      summaryRequest.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          checkComplete();
        }
      };
      summaryRequest.onerror = () => reject(new Error(`Failed to delete summaries: ${summaryRequest.error}`));
    });
  }

  /**
   * Get storage statistics
   * @returns {Promise<Object>} Storage statistics
   */
  async getStorageStats() {
    await this.ensureInitialized();
    
    const stats = {
      sessions: 0,
      transcripts: 0,
      summaries: 0,
      totalSize: 0
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([
        this.stores.sessions,
        this.stores.transcripts,
        this.stores.summaries
      ], 'readonly');

      let completed = 0;
      const total = 3;

      const checkComplete = () => {
        completed++;
        if (completed === total) {
          resolve(stats);
        }
      };

      // Count sessions
      const sessionStore = transaction.objectStore(this.stores.sessions);
      const sessionRequest = sessionStore.count();
      sessionRequest.onsuccess = () => {
        stats.sessions = sessionRequest.result;
        checkComplete();
      };
      sessionRequest.onerror = () => reject(new Error(`Failed to count sessions: ${sessionRequest.error}`));

      // Count transcripts
      const transcriptStore = transaction.objectStore(this.stores.transcripts);
      const transcriptRequest = transcriptStore.count();
      transcriptRequest.onsuccess = () => {
        stats.transcripts = transcriptRequest.result;
        checkComplete();
      };
      transcriptRequest.onerror = () => reject(new Error(`Failed to count transcripts: ${transcriptRequest.error}`));

      // Count summaries
      const summaryStore = transaction.objectStore(this.stores.summaries);
      const summaryRequest = summaryStore.count();
      summaryRequest.onsuccess = () => {
        stats.summaries = summaryRequest.result;
        checkComplete();
      };
      summaryRequest.onerror = () => reject(new Error(`Failed to count summaries: ${summaryRequest.error}`));
    });
  }

  /**
   * Get retention policy setting
   * @returns {Promise<number>} Retention days
   */
  async getRetentionPolicy() {
    const setting = await this.getSetting('retentionDays');
    return setting ? setting.value : this.defaultRetentionDays;
  }

  /**
   * Set retention policy
   * @param {number} days - Number of days to retain data
   * @returns {Promise<void>}
   */
  async setRetentionPolicy(days) {
    if (typeof days !== 'number' || days < 1) {
      throw new Error('Retention days must be a positive number');
    }
    
    await this.setSetting('retentionDays', days);
  }

  /**
   * Get a setting value
   * @param {string} key - Setting key
   * @returns {Promise<Object|null>} Setting object or null
   */
  async getSetting(key) {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.stores.settings], 'readonly');
      const store = transaction.objectStore(this.stores.settings);
      
      const request = store.get(key);
      
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(new Error(`Failed to get setting: ${request.error}`));
    });
  }

  /**
   * Set a setting value
   * @param {string} key - Setting key
   * @param {*} value - Setting value
   * @returns {Promise<void>}
   */
  async setSetting(key, value) {
    await this.ensureInitialized();
    
    const setting = {
      key,
      value,
      updatedAt: Date.now()
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.stores.settings], 'readwrite');
      const store = transaction.objectStore(this.stores.settings);
      
      const request = store.put(setting);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to set setting: ${request.error}`));
    });
  }

  /**
   * Export all data for backup
   * @returns {Promise<Object>} Exported data
   */
  async exportData() {
    await this.ensureInitialized();
    
    const data = {
      version: this.dbVersion,
      exportedAt: new Date().toISOString(),
      sessions: await this.getSessions(),
      settings: await this.getAllSettings()
    };

    // Get all transcripts and summaries
    data.transcripts = {};
    data.summaries = {};

    for (const session of data.sessions) {
      data.transcripts[session.id] = await this.getTranscriptSegments(session.id);
      data.summaries[session.id] = await this.getSummary(session.id);
    }

    return data;
  }

  /**
   * Import data from backup
   * @param {Object} data - Data to import
   * @returns {Promise<void>}
   */
  async importData(data) {
    await this.ensureInitialized();
    
    if (!data.version || !data.sessions) {
      throw new Error('Invalid backup data format');
    }

    // Import sessions
    for (const session of data.sessions) {
      await this.createSession(session);
    }

    // Import transcripts
    if (data.transcripts) {
      for (const [sessionId, segments] of Object.entries(data.transcripts)) {
        if (segments && segments.length > 0) {
          await this.saveTranscriptSegments(sessionId, segments);
        }
      }
    }

    // Import summaries
    if (data.summaries) {
      for (const [sessionId, summary] of Object.entries(data.summaries)) {
        if (summary) {
          await this.saveSummary(sessionId, summary);
        }
      }
    }

    // Import settings
    if (data.settings) {
      for (const setting of data.settings) {
        await this.setSetting(setting.key, setting.value);
      }
    }
  }

  /**
   * Get all settings
   * @returns {Promise<Array>} Array of settings
   */
  async getAllSettings() {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.stores.settings], 'readonly');
      const store = transaction.objectStore(this.stores.settings);
      
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error(`Failed to get settings: ${request.error}`));
    });
  }

  // ===== VALIDATION METHODS =====

  /**
   * Validate session data
   * @param {Object} sessionData - Session data to validate
   * @returns {Object} Validated session data
   */
  validateSessionData(sessionData) {
    if (!sessionData || typeof sessionData !== 'object') {
      throw new Error('Session data must be an object');
    }

    if (!sessionData.id || typeof sessionData.id !== 'string') {
      throw new Error('Session ID is required and must be a string');
    }

    if (!sessionData.date || !this.isValidDate(sessionData.date)) {
      throw new Error('Session date is required and must be a valid ISO date string');
    }

    if (sessionData.duration !== undefined && (typeof sessionData.duration !== 'number' || sessionData.duration < 0)) {
      throw new Error('Session duration must be a non-negative number');
    }

    if (sessionData.platform && typeof sessionData.platform !== 'string') {
      throw new Error('Session platform must be a string');
    }

    return {
      ...sessionData,
      metadata: sessionData.metadata || {}
    };
  }

  /**
   * Validate transcript segment data
   * @param {Object} segment - Transcript segment to validate
   * @param {string} sessionId - Session ID
   * @returns {Object} Validated segment data
   */
  validateTranscriptSegment(segment, sessionId) {
    if (!segment || typeof segment !== 'object') {
      throw new Error('Transcript segment must be an object');
    }

    if (!segment.text || typeof segment.text !== 'string') {
      throw new Error('Transcript segment text is required and must be a string');
    }

    if (segment.timestamp === undefined || typeof segment.timestamp !== 'number') {
      throw new Error('Transcript segment timestamp is required and must be a number');
    }

    if (segment.confidence !== undefined && (typeof segment.confidence !== 'number' || segment.confidence < 0 || segment.confidence > 1)) {
      throw new Error('Transcript segment confidence must be a number between 0 and 1');
    }

    return {
      id: segment.id || this.generateId(),
      sessionId,
      text: segment.text.trim(),
      timestamp: segment.timestamp,
      confidence: segment.confidence || 0,
      isFinal: Boolean(segment.isFinal),
      duration: segment.duration || 0
    };
  }

  /**
   * Validate summary data
   * @param {Object} summaryData - Summary data to validate
   * @returns {Object} Validated summary data
   */
  validateSummaryData(summaryData) {
    if (!summaryData || typeof summaryData !== 'object') {
      throw new Error('Summary data must be an object');
    }

    if (!summaryData.sessionId || typeof summaryData.sessionId !== 'string') {
      throw new Error('Summary session ID is required and must be a string');
    }

    if (summaryData.content !== undefined && typeof summaryData.content !== 'string') {
      throw new Error('Summary content must be a string');
    }

    if (summaryData.keyPoints && !Array.isArray(summaryData.keyPoints)) {
      throw new Error('Summary key points must be an array');
    }

    if (summaryData.decisions && !Array.isArray(summaryData.decisions)) {
      throw new Error('Summary decisions must be an array');
    }

    if (summaryData.actionItems && !Array.isArray(summaryData.actionItems)) {
      throw new Error('Summary action items must be an array');
    }

    if (summaryData.quotes && !Array.isArray(summaryData.quotes)) {
      throw new Error('Summary quotes must be an array');
    }

    return {
      ...summaryData,
      keyPoints: summaryData.keyPoints || [],
      decisions: summaryData.decisions || [],
      actionItems: summaryData.actionItems || [],
      quotes: summaryData.quotes || [],
      metadata: summaryData.metadata || {}
    };
  }

  // ===== COMPRESSION METHODS =====

  /**
   * Compress transcript segment for storage
   * @param {Object} segment - Transcript segment
   * @returns {Object} Compressed segment
   */
  compressTranscriptSegment(segment) {
    return {
      ...segment,
      // Simple text compression - remove extra whitespace
      text: segment.text.replace(/\s+/g, ' ').trim()
    };
  }

  /**
   * Decompress transcript segment from storage
   * @param {Object} segment - Compressed segment
   * @returns {Object} Decompressed segment
   */
  decompressTranscriptSegment(segment) {
    return { ...segment };
  }

  /**
   * Compress summary for storage
   * @param {Object} summary - Summary data
   * @returns {Object} Compressed summary
   */
  compressSummary(summary) {
    return {
      ...summary,
      // Compress text content
      content: summary.content.replace(/\s+/g, ' ').trim(),
      keyPoints: summary.keyPoints.map(point => point.replace(/\s+/g, ' ').trim()),
      decisions: summary.decisions.map(decision => decision.replace(/\s+/g, ' ').trim()),
      actionItems: summary.actionItems.map(item => item.replace(/\s+/g, ' ').trim()),
      quotes: summary.quotes.map(quote => quote.replace(/\s+/g, ' ').trim())
    };
  }

  /**
   * Decompress summary from storage
   * @param {Object} summary - Compressed summary
   * @returns {Object} Decompressed summary
   */
  decompressSummary(summary) {
    return { ...summary };
  }

  // ===== UTILITY METHODS =====

  /**
   * Generate a unique ID
   * @returns {string} Unique ID
   */
  generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check if a date string is valid
   * @param {string} dateString - Date string to validate
   * @returns {boolean} True if valid
   */
  isValidDate(dateString) {
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime());
  }

  /**
   * Highlight search term in text
   * @param {string} text - Text to highlight
   * @param {string} searchTerm - Term to highlight
   * @returns {string} Text with highlighted terms
   */
  highlightSearchTerm(text, searchTerm) {
    if (!searchTerm || !text) {
      return text;
    }

    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }

  /**
   * Ensure the database is initialized
   * @returns {Promise<void>}
   */
  async ensureInitialized() {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  /**
   * Close the database connection
   * @returns {void}
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.isInitialized = false;
    }
  }

  /**
   * Clear all data (for testing purposes)
   * @returns {Promise<void>}
   */
  async clearAllData() {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([
        this.stores.sessions,
        this.stores.transcripts,
        this.stores.summaries,
        this.stores.settings
      ], 'readwrite');

      let completed = 0;
      const total = 4;

      const checkComplete = () => {
        completed++;
        if (completed === total) {
          resolve();
        }
      };

      // Clear all stores
      Object.values(this.stores).forEach(storeName => {
        const store = transaction.objectStore(storeName);
        const request = store.clear();
        
        request.onsuccess = checkComplete;
        request.onerror = () => reject(new Error(`Failed to clear ${storeName}: ${request.error}`));
      });
    });
  }
}

// Create and export a singleton instance
const storageService = new StorageService();

export default storageService;
export { StorageService };