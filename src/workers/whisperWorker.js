/**
 * Whisper Worker - Handles speech recognition using Transformers.js
 * Runs in a Web Worker to avoid blocking the main thread
 */

import { pipeline, env } from '@xenova/transformers';

// Configure transformers environment
env.allowRemoteModels = true;
env.allowLocalModels = true;

class WhisperWorker {
  constructor() {
    this.transcriber = null;
    this.isInitialized = false;
    this.modelName = 'Xenova/whisper-tiny.en'; // Start with tiny model for speed
  }

  /**
   * Initialize the Whisper model
   * @param {string} modelName - Model to use (tiny.en, base.en, small.en)
   */
  async initialize(modelName = 'Xenova/whisper-tiny.en') {
    try {
      console.log('Initializing Whisper model:', modelName);
      
      this.transcriber = await pipeline(
        'automatic-speech-recognition',
        modelName,
        {
          chunk_length_s: 30,
          stride_length_s: 5,
        }
      );
      
      this.isInitialized = true;
      console.log('Whisper model initialized successfully');
      
      return { success: true };
    } catch (error) {
      console.error('Failed to initialize Whisper model:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Transcribe audio data
   * @param {Float32Array} audioData - Audio samples
   * @param {Object} options - Transcription options
   */
  async transcribe(audioData, options = {}) {
    if (!this.isInitialized || !this.transcriber) {
      throw new Error('Whisper model not initialized');
    }

    try {
      const startTime = Date.now();
      
      // Transcribe the audio
      const result = await this.transcriber(audioData, {
        language: options.language || 'english',
        task: 'transcribe',
        return_timestamps: true,
        chunk_length_s: options.chunkLength || 30,
        stride_length_s: options.strideLength || 5,
      });

      const processingTime = Date.now() - startTime;
      
      // Format the result
      const formattedResult = {
        text: result.text || '',
        confidence: this.calculateConfidence(result),
        processingTime,
        segments: this.formatSegments(result.chunks || []),
        language: options.language || 'english'
      };

      console.log(`Whisper transcription completed in ${processingTime}ms:`, formattedResult.text);
      
      return formattedResult;
    } catch (error) {
      console.error('Whisper transcription failed:', error);
      throw error;
    }
  }

  /**
   * Calculate confidence score from Whisper result
   * @param {Object} result - Whisper result
   * @returns {number} Confidence score (0-1)
   */
  calculateConfidence(result) {
    // Whisper doesn't provide direct confidence scores
    // We estimate based on text length and processing success
    if (!result.text || result.text.trim().length === 0) {
      return 0;
    }
    
    // Basic heuristic: longer, more coherent text = higher confidence
    const textLength = result.text.trim().length;
    const hasWords = /\w+/.test(result.text);
    const hasPunctuation = /[.!?]/.test(result.text);
    
    let confidence = 0.7; // Base confidence
    
    if (textLength > 10) confidence += 0.1;
    if (textLength > 50) confidence += 0.1;
    if (hasWords) confidence += 0.05;
    if (hasPunctuation) confidence += 0.05;
    
    return Math.min(confidence, 0.95); // Cap at 95%
  }

  /**
   * Format segments from Whisper chunks
   * @param {Array} chunks - Whisper chunks
   * @returns {Array} Formatted segments
   */
  formatSegments(chunks) {
    return chunks.map((chunk, index) => ({
      id: `whisper_segment_${Date.now()}_${index}`,
      text: chunk.text || '',
      start: chunk.timestamp?.[0] || 0,
      end: chunk.timestamp?.[1] || 0,
      confidence: this.calculateConfidence({ text: chunk.text })
    }));
  }

  /**
   * Change the model being used
   * @param {string} modelName - New model name
   */
  async changeModel(modelName) {
    console.log('Changing Whisper model to:', modelName);
    this.isInitialized = false;
    this.transcriber = null;
    return await this.initialize(modelName);
  }

  /**
   * Get available models
   * @returns {Array} Available model names
   */
  getAvailableModels() {
    return [
      'Xenova/whisper-tiny.en',    // ~39MB, fastest
      'Xenova/whisper-base.en',    // ~74MB, balanced
      'Xenova/whisper-small.en',   // ~244MB, better accuracy
      'Xenova/whisper-medium.en',  // ~769MB, high accuracy
      'Xenova/whisper-large-v2',   // ~1550MB, best accuracy, multilingual
    ];
  }

  /**
   * Get model info
   * @param {string} modelName - Model name
   * @returns {Object} Model information
   */
  getModelInfo(modelName) {
    const modelInfo = {
      'Xenova/whisper-tiny.en': {
        size: '39MB',
        speed: 'Fastest',
        accuracy: 'Good',
        languages: ['English']
      },
      'Xenova/whisper-base.en': {
        size: '74MB',
        speed: 'Fast',
        accuracy: 'Better',
        languages: ['English']
      },
      'Xenova/whisper-small.en': {
        size: '244MB',
        speed: 'Medium',
        accuracy: 'High',
        languages: ['English']
      },
      'Xenova/whisper-medium.en': {
        size: '769MB',
        speed: 'Slow',
        accuracy: 'Very High',
        languages: ['English']
      },
      'Xenova/whisper-large-v2': {
        size: '1550MB',
        speed: 'Slowest',
        accuracy: 'Best',
        languages: ['99+ languages']
      }
    };

    return modelInfo[modelName] || { size: 'Unknown', speed: 'Unknown', accuracy: 'Unknown' };
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.transcriber = null;
    this.isInitialized = false;
    console.log('Whisper worker cleaned up');
  }
}

// Create worker instance
const whisperWorker = new WhisperWorker();

// Handle messages from main thread
self.onmessage = async function(e) {
  const { id, type, data } = e.data;

  try {
    let result;

    switch (type) {
      case 'initialize':
        result = await whisperWorker.initialize(data.modelName);
        break;

      case 'transcribe':
        result = await whisperWorker.transcribe(data.audioData, data.options);
        break;

      case 'changeModel':
        result = await whisperWorker.changeModel(data.modelName);
        break;

      case 'getAvailableModels':
        result = whisperWorker.getAvailableModels();
        break;

      case 'getModelInfo':
        result = whisperWorker.getModelInfo(data.modelName);
        break;

      case 'cleanup':
        whisperWorker.cleanup();
        result = { success: true };
        break;

      default:
        throw new Error(`Unknown message type: ${type}`);
    }

    // Send success response
    self.postMessage({
      id,
      type: 'success',
      data: result
    });

  } catch (error) {
    // Send error response
    self.postMessage({
      id,
      type: 'error',
      data: {
        message: error.message,
        stack: error.stack
      }
    });
  }
};

// Send ready message
self.postMessage({
  type: 'ready',
  data: { message: 'Whisper worker is ready' }
});