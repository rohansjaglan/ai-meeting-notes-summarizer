/**
 * WhisperService - Manages Whisper worker for speech recognition
 * Provides a clean interface for the main thread to interact with Whisper
 */

class WhisperService {
  constructor() {
    this.worker = null;
    this.isInitialized = false;
    this.isInitializing = false;
    this.messageId = 0;
    this.pendingMessages = new Map();
    this.currentModel = 'Xenova/whisper-tiny.en';
    
    // Callbacks
    this.onReady = null;
    this.onError = null;
    this.onProgress = null;
  }

  /**
   * Initialize the Whisper service
   * @param {string} modelName - Whisper model to use
   * @returns {Promise<boolean>} Success status
   */
  async initialize(modelName = 'Xenova/whisper-tiny.en') {
    if (this.isInitialized || this.isInitializing) {
      return this.isInitialized;
    }

    this.isInitializing = true;

    try {
      // Create worker from public directory (Create React App compatible)
      try {
        this.worker = new Worker('/whisperWorker.js');
      } catch (error) {
        console.error('Failed to create Whisper worker:', error);
        throw new Error('Whisper worker not available. Please ensure whisperWorker.js is in the public directory.');
      }

      // Set up worker message handling
      this.worker.onmessage = this.handleWorkerMessage.bind(this);
      this.worker.onerror = this.handleWorkerError.bind(this);

      // Wait for worker to be ready
      await this.waitForWorkerReady();

      // Initialize the model
      const result = await this.sendMessage('initialize', { modelName });
      
      if (result.success) {
        this.isInitialized = true;
        this.currentModel = modelName;
        console.log('WhisperService initialized successfully');
        
        if (this.onReady) {
          this.onReady();
        }
        
        return true;
      } else {
        throw new Error(result.error || 'Failed to initialize Whisper model');
      }

    } catch (error) {
      console.error('WhisperService initialization failed:', error);
      this.handleError('Initialization failed', error);
      return false;
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Wait for worker to send ready message
   * @returns {Promise<void>}
   */
  waitForWorkerReady() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Worker ready timeout'));
      }, 30000); // 30 second timeout

      const handleMessage = (event) => {
        if (event.data.type === 'ready') {
          clearTimeout(timeout);
          this.worker.removeEventListener('message', handleMessage);
          resolve();
        }
      };

      this.worker.addEventListener('message', handleMessage);
    });
  }

  /**
   * Transcribe audio data
   * @param {Float32Array} audioData - Audio samples
   * @param {Object} options - Transcription options
   * @returns {Promise<Object>} Transcription result
   */
  async transcribe(audioData, options = {}) {
    if (!this.isInitialized) {
      throw new Error('WhisperService not initialized');
    }

    if (!audioData || audioData.length === 0) {
      return {
        text: '',
        confidence: 0,
        segments: [],
        processingTime: 0
      };
    }

    try {
      const result = await this.sendMessage('transcribe', {
        audioData: audioData,
        options: {
          language: options.language || 'english',
          chunkLength: options.chunkLength || 30,
          strideLength: options.strideLength || 5,
          ...options
        }
      });

      return result;
    } catch (error) {
      console.error('Transcription failed:', error);
      throw error;
    }
  }

  /**
   * Change the Whisper model
   * @param {string} modelName - New model name
   * @returns {Promise<boolean>} Success status
   */
  async changeModel(modelName) {
    if (!this.worker) {
      throw new Error('Worker not available');
    }

    try {
      const result = await this.sendMessage('changeModel', { modelName });
      
      if (result.success) {
        this.currentModel = modelName;
        console.log('Model changed to:', modelName);
        return true;
      } else {
        throw new Error(result.error || 'Failed to change model');
      }
    } catch (error) {
      console.error('Model change failed:', error);
      this.handleError('Model change failed', error);
      return false;
    }
  }

  /**
   * Get available models
   * @returns {Promise<Array>} Available model names
   */
  async getAvailableModels() {
    if (!this.worker) {
      return [];
    }

    try {
      return await this.sendMessage('getAvailableModels');
    } catch (error) {
      console.error('Failed to get available models:', error);
      return [];
    }
  }

  /**
   * Get model information
   * @param {string} modelName - Model name
   * @returns {Promise<Object>} Model info
   */
  async getModelInfo(modelName) {
    if (!this.worker) {
      return {};
    }

    try {
      return await this.sendMessage('getModelInfo', { modelName });
    } catch (error) {
      console.error('Failed to get model info:', error);
      return {};
    }
  }

  /**
   * Send message to worker and wait for response
   * @param {string} type - Message type
   * @param {Object} data - Message data
   * @returns {Promise<any>} Response data
   */
  sendMessage(type, data = {}) {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Worker not available'));
        return;
      }

      const id = ++this.messageId;
      
      // Store promise resolvers
      this.pendingMessages.set(id, { resolve, reject });

      // Set timeout for message
      const timeout = setTimeout(() => {
        this.pendingMessages.delete(id);
        reject(new Error(`Message timeout: ${type}`));
      }, 60000); // 60 second timeout

      // Clear timeout when message resolves
      const originalResolve = resolve;
      const originalReject = reject;
      
      this.pendingMessages.set(id, {
        resolve: (data) => {
          clearTimeout(timeout);
          originalResolve(data);
        },
        reject: (error) => {
          clearTimeout(timeout);
          originalReject(error);
        }
      });

      // Send message to worker
      this.worker.postMessage({ id, type, data });
    });
  }

  /**
   * Handle messages from worker
   * @param {MessageEvent} event - Worker message event
   */
  handleWorkerMessage(event) {
    const { id, type, data } = event.data;

    if (type === 'ready') {
      // Already handled in waitForWorkerReady
      return;
    }

    if (type === 'progress') {
      // Handle progress updates
      console.log('Model loading progress:', data.progress);
      if (this.onProgress) {
        this.onProgress(data.progress);
      }
      return;
    }

    if (!id || !this.pendingMessages.has(id)) {
      console.warn('Received message with unknown ID:', id);
      return;
    }

    const { resolve, reject } = this.pendingMessages.get(id);
    this.pendingMessages.delete(id);

    if (type === 'success') {
      resolve(data);
    } else if (type === 'error') {
      reject(new Error(data.message));
    } else {
      reject(new Error(`Unknown response type: ${type}`));
    }
  }

  /**
   * Handle worker errors
   * @param {ErrorEvent} error - Worker error event
   */
  handleWorkerError(error) {
    console.error('Worker error:', error);
    this.handleError('Worker error', error);
  }

  /**
   * Handle service errors
   * @param {string} message - Error message
   * @param {Error} error - Error object
   */
  handleError(message, error) {
    console.error(message, error);
    
    if (this.onError) {
      this.onError({
        message,
        error,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Get current status
   * @returns {Object} Service status
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      isInitializing: this.isInitializing,
      currentModel: this.currentModel,
      workerAvailable: !!this.worker,
      pendingMessages: this.pendingMessages.size
    };
  }

  /**
   * Set ready callback
   * @param {Function} callback - Ready callback
   */
  setReadyCallback(callback) {
    this.onReady = callback;
  }

  /**
   * Set error callback
   * @param {Function} callback - Error callback
   */
  setErrorCallback(callback) {
    this.onError = callback;
  }

  /**
   * Set progress callback
   * @param {Function} callback - Progress callback
   */
  setProgressCallback(callback) {
    this.onProgress = callback;
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    try {
      // Send cleanup message to worker
      if (this.worker && this.isInitialized) {
        await this.sendMessage('cleanup');
      }
    } catch (error) {
      console.warn('Cleanup message failed:', error);
    }

    // Terminate worker
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }

    // Clear pending messages
    for (const [id, { reject }] of this.pendingMessages) {
      reject(new Error('Service cleanup'));
    }
    this.pendingMessages.clear();

    // Reset state
    this.isInitialized = false;
    this.isInitializing = false;
    this.messageId = 0;

    console.log('WhisperService cleaned up');
  }
}

export default WhisperService;