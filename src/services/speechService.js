/**
 * SpeechService - Handles real-time speech-to-text conversion
 * Uses Web Speech API as primary engine with Whisper.js for system audio
 */

// Import will be handled dynamically to avoid bundling issues
import SystemAudioTranscriber from './systemAudioTranscriber.js';

class SpeechService {
  constructor() {
    this.recognition = null;
    this.whisperService = null;
    this.audioProcessor = null;
    this.isListening = false;
    this.isPaused = false;
    this.currentTranscript = '';
    this.transcriptSegments = [];
    this.sessionStartTime = null;
    this.lastSegmentTime = null;
    this.audioStream = null;
    this.processingMode = 'webspeech'; // 'webspeech' or 'whisper'
    
    // Callbacks
    this.onTranscriptUpdate = null;
    this.onSegmentComplete = null;
    this.onError = null;
    this.onStatusChange = null;
    
    // Configuration
    this.config = {
      language: 'en-US',
      continuous: true,
      interimResults: true,
      maxAlternatives: 1,
      segmentTimeoutMs: 3000, // 3 seconds of silence to create new segment
      confidenceThreshold: 0.7,
      maxRetries: 3,
      retryDelayMs: 1000,
      whisperModel: 'tiny.en', // tiny.en, base.en, small.en
      chunkDurationMs: 5000 // Process audio in 5-second chunks
    };
    
    // State tracking
    this.retryCount = 0;
    this.lastError = null;
    this.isInitialized = false;
    this.audioBuffer = [];
    this.isProcessingAudio = false;
    this.processingTimeout = null;
    this.isStartingListening = false;
    
    // Bind methods to maintain context
    this.handleResult = this.handleResult.bind(this);
    this.handleError = this.handleError.bind(this);
    this.handleStart = this.handleStart.bind(this);
    this.handleEnd = this.handleEnd.bind(this);
    this.handleSpeechStart = this.handleSpeechStart.bind(this);
    this.handleSpeechEnd = this.handleSpeechEnd.bind(this);
  }

  /**
   * Initialize speech recognition service
   * @param {MediaStream} audioStream - Optional audio stream for system audio processing
   * @returns {Promise<boolean>} Success status
   */
  async initialize(audioStream = null) {
    try {
      // Determine processing mode based on audio stream availability
      if (audioStream) {
        this.audioStream = audioStream;
        this.processingMode = 'whisper';
        return await this.initializeWhisperMode();
      } else {
        this.processingMode = 'webspeech';
        return await this.initializeWebSpeechMode();
      }
    } catch (error) {
      this.handleServiceError('Failed to initialize speech recognition', error);
      return false;
    }
  }

  /**
   * Initialize Web Speech API mode (microphone input)
   * @returns {Promise<boolean>} Success status
   */
  async initializeWebSpeechMode() {
    // Check for Web Speech API support
    if (!this.isWebSpeechSupported()) {
      throw new Error('Web Speech API not supported in this browser');
    }

    // Create speech recognition instance
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    
    // Configure recognition settings
    this.recognition.continuous = this.config.continuous;
    this.recognition.interimResults = this.config.interimResults;
    this.recognition.lang = this.config.language;
    this.recognition.maxAlternatives = this.config.maxAlternatives;
    
    // Set up event listeners
    this.recognition.addEventListener('result', this.handleResult);
    this.recognition.addEventListener('error', this.handleError);
    this.recognition.addEventListener('start', this.handleStart);
    this.recognition.addEventListener('end', this.handleEnd);
    this.recognition.addEventListener('speechstart', this.handleSpeechStart);
    this.recognition.addEventListener('speechend', this.handleSpeechEnd);
    
    this.isInitialized = true;
    this.notifyStatusChange('initialized');
    
    return true;
  }

  /**
   * Initialize Whisper mode for system audio processing
   * @returns {Promise<boolean>} Success status
   */
  async initializeWhisperMode() {
    try {
      console.log('Initializing system audio transcription mode');
      
      // Initialize system audio transcriber
      this.systemAudioTranscriber = new SystemAudioTranscriber();
      
      const success = await this.systemAudioTranscriber.initialize(this.audioStream);
      
      if (!success) {
        throw new Error('Failed to initialize system audio transcriber');
      }
      
      // Set up transcript callback
      this.systemAudioTranscriber.setTranscriptCallback((transcript) => {
        const segment = this.createTranscriptSegment(
          transcript.text,
          transcript.timestamp,
          transcript.confidence,
          transcript.isFinal
        );
        
        segment.source = transcript.source;
        
        this.addTranscriptSegment(segment);
        this.notifyTranscriptUpdate(segment);
      });
      
      // Set up error callback
      this.systemAudioTranscriber.setErrorCallback((error) => {
        this.handleServiceError('System audio transcription error', error);
      });
      
      this.isInitialized = true;
      this.notifyStatusChange('initialized');
      
      console.log('System audio transcription initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize system audio transcription mode:', error);
      
      // Fallback to Web Speech API if available
      if (this.isWebSpeechSupported()) {
        console.log('Falling back to Web Speech API');
        this.processingMode = 'webspeech';
        this.audioStream = null;
        return await this.initializeWebSpeechMode();
      }
      
      throw error;
    }
  }

  /**
   * Initialize Whisper service for speech recognition
   * @returns {Promise<void>}
   */
  async initializeWhisperWorker() {
    try {
      // Dynamic import to avoid bundling issues
      const { default: WhisperService } = await import('./whisperService.js');
      this.whisperService = new WhisperService();
      
      // Set up error callback
      this.whisperService.setErrorCallback((error) => {
        console.error('Whisper service error:', error);
        this.handleServiceError('Whisper processing error', error.error);
      });

      // Initialize with configured model
      const modelName = `Xenova/whisper-${this.config.whisperModel}`;
      const success = await this.whisperService.initialize(modelName);
      
      if (!success) {
        throw new Error('Failed to initialize Whisper service');
      }
      
      console.log('Whisper service initialized successfully');
    } catch (error) {
      console.error('Whisper initialization failed:', error);
      throw error; // Don't use mock, force real implementation
    }
  }

  /**
   * Set up audio processor for real-time audio processing
   * @returns {Promise<void>}
   */
  async setupAudioProcessor() {
    if (!this.audioStream) {
      throw new Error('No audio stream available for processing');
    }

    try {
      // Create audio context for processing
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(this.audioStream);
      
      // Create script processor for audio chunks
      const bufferSize = 4096;
      this.audioProcessor = audioContext.createScriptProcessor(bufferSize, 1, 1);
      
      this.audioProcessor.onaudioprocess = (event) => {
        try {
          if (this.isListening && !this.isPaused) {
            const inputBuffer = event.inputBuffer;
            const audioData = inputBuffer.getChannelData(0);
            
            // Only process if we're not already processing and have valid data
            if (audioData && audioData.length > 0) {
              this.processAudioChunk(audioData);
            }
          }
        } catch (error) {
          console.error('Error in audio processing:', error);
          // Don't let audio processing errors crash the entire system
        }
      };
      
      // Connect audio processing pipeline
      source.connect(this.audioProcessor);
      this.audioProcessor.connect(audioContext.destination);
      
      console.log('Audio processor setup completed');
    } catch (error) {
      console.error('Failed to setup audio processor:', error);
      throw error;
    }
  }

  /**
   * Process audio chunk for speech recognition
   * @param {Float32Array} audioData - Audio data chunk
   */
  processAudioChunk(audioData) {
    if (!this.isListening || this.isPaused || this.isProcessingAudio) {
      return;
    }

    // Add audio data to buffer
    this.audioBuffer.push(new Float32Array(audioData));
    
    // Process buffer when it reaches chunk duration
    const sampleRate = 44100; // Assuming 44.1kHz sample rate
    const chunkSamples = (this.config.chunkDurationMs / 1000) * sampleRate;
    const totalSamples = this.audioBuffer.reduce((sum, chunk) => sum + chunk.length, 0);
    
    if (totalSamples >= chunkSamples && !this.processingTimeout) {
      // Use a timeout flag to prevent multiple simultaneous processing
      this.processingTimeout = setTimeout(() => {
        this.processingTimeout = null;
        if (!this.isProcessingAudio && this.audioBuffer.length > 0) {
          this.processAudioBuffer().catch(error => {
            console.error('Audio buffer processing failed:', error);
          });
        }
      }, 100); // Small delay to batch audio chunks
    }
  }

  /**
   * Process accumulated audio buffer with Whisper
   */
  async processAudioBuffer() {
    // Prevent recursive calls and multiple simultaneous processing
    if (this.isProcessingAudio || this.audioBuffer.length === 0 || !this.whisperService) {
      return;
    }

    // Set processing flag immediately
    this.isProcessingAudio = true;
    
    try {
      // Take a snapshot of current buffer and clear it immediately
      const bufferSnapshot = [...this.audioBuffer];
      this.audioBuffer = [];
      
      // Combine audio chunks from snapshot
      const totalLength = bufferSnapshot.reduce((sum, chunk) => sum + chunk.length, 0);
      
      // Skip processing if audio is too short
      if (totalLength < 1000) { // Less than ~0.02 seconds at 44.1kHz
        return;
      }

      const combinedAudio = new Float32Array(totalLength);
      let offset = 0;
      
      for (const chunk of bufferSnapshot) {
        combinedAudio.set(chunk, offset);
        offset += chunk.length;
      }

      // Check for silence (all values near zero) - use a more efficient method
      let maxAmplitude = 0;
      for (let i = 0; i < combinedAudio.length; i++) {
        const abs = Math.abs(combinedAudio[i]);
        if (abs > maxAmplitude) {
          maxAmplitude = abs;
        }
      }
      
      if (maxAmplitude < 0.01) { // Very quiet audio
        return;
      }
      
              // Processing audio buffer
      
      // Transcribe with Whisper
      const result = await this.whisperService.transcribe(combinedAudio, {
        language: this.config.language.startsWith('en') ? 'english' : 'auto',
        chunkLength: this.config.chunkDurationMs / 1000
      });
      
      // Process transcription result
      if (result && result.text && result.text.trim() && result.text.trim().length > 1) {
        const segment = this.createTranscriptSegment(
          result.text.trim(),
          Date.now(),
          result.confidence || 0.8,
          true
        );
        
        // Add processing time info
        segment.processingTime = result.processingTime || 0;
        segment.source = 'whisper';
        
        this.addTranscriptSegment(segment);
        this.notifyTranscriptUpdate(segment);
      }
      
    } catch (error) {
      console.error('Error processing audio buffer:', error);
      this.handleServiceError('Whisper processing failed', error);
    } finally {
      // Always reset processing flag
      this.isProcessingAudio = false;
    }
  }

  /**
   * Check if Web Speech API is supported
   * @returns {boolean} Support status
   */
  isWebSpeechSupported() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  /**
   * Start speech recognition
   * @returns {Promise<boolean>} Success status
   */
  async startListening() {
    try {
      // Prevent multiple rapid calls
      if (this.isStartingListening) {
        return false;
      }

      if (!this.isInitialized) {
        const initialized = await this.initialize();
        if (!initialized) {
          return false;
        }
      }

      if (this.isListening) {
        // Speech recognition already active, return success without logging
        return true;
      }

      this.isStartingListening = true;

      // Reset state for new session
      this.currentTranscript = '';
      this.transcriptSegments = [];
      this.sessionStartTime = Date.now();
      this.lastSegmentTime = this.sessionStartTime;
      this.retryCount = 0;
      this.lastError = null;
      this.audioBuffer = [];
      this.isProcessingAudio = false;

      // Start recognition based on processing mode
      if (this.processingMode === 'whisper') {
        return await this.startWhisperListening();
      } else {
        return await this.startWebSpeechListening();
      }
    } catch (error) {
      this.handleServiceError('Failed to start speech recognition', error);
      return false;
    } finally {
      this.isStartingListening = false;
    }
  }

  /**
   * Start Web Speech API listening
   * @returns {Promise<boolean>} Success status
   */
  async startWebSpeechListening() {
    // Force cleanup any existing recognition
    await this.forceCleanup();

    this.isListening = false;
    this.isPaused = false;

    // Start recognition with error handling
    return new Promise((resolve) => {
      const startTimeout = setTimeout(() => {
        console.warn('Speech recognition start timeout');
        this.isListening = false;
        resolve(false);
      }, 10000);

      const onStart = () => {
        clearTimeout(startTimeout);
        this.isListening = true;
        this.isPaused = false;
        this.notifyStatusChange('listening');
        // Web Speech recognition started successfully
        resolve(true);
      };

      const onError = (event) => {
        clearTimeout(startTimeout);
        this.isListening = false;
        this.isPaused = false;
        
        if (event.error === 'network') {
          // Network error on start - recognition may already be active
          this.handleError(event);
          resolve(false);
        } else {
          this.handleError(event);
          resolve(false);
        }
      };

      // Set up one-time listeners
      this.recognition.addEventListener('start', onStart, { once: true });
      this.recognition.addEventListener('error', onError, { once: true });

      try {
        // Starting Web Speech recognition...
        this.recognition.start();
      } catch (error) {
        clearTimeout(startTimeout);
        console.error('Exception starting speech recognition:', error);
        
        if (error.message && error.message.includes('network')) {
          // Network exception - recognition may already be running
          resolve(false);
        } else {
          this.handleServiceError('Failed to start speech recognition', error);
          resolve(false);
        }
      }
    });
  }

  /**
   * Start Whisper-based listening for system audio
   * @returns {Promise<boolean>} Success status
   */
  async startWhisperListening() {
    try {
      if (!this.systemAudioTranscriber) {
        throw new Error('System audio transcriber not initialized');
      }
      
      const success = await this.systemAudioTranscriber.startTranscription();
      
      if (success) {
        this.isListening = true;
        this.isPaused = false;
        this.notifyStatusChange('listening');
        console.log('System audio transcription started');
        return true;
      } else {
        throw new Error('Failed to start system audio transcription');
      }
    } catch (error) {
      this.handleServiceError('Failed to start system audio transcription', error);
      return false;
    }
  }

  /**
   * Stop speech recognition
   * @returns {boolean} Success status
   */
  stopListening() {
    try {
      if (!this.isListening) {
        console.warn('Speech recognition not active');
        return false;
      }

      if (this.processingMode === 'webspeech' && this.recognition) {
        this.recognition.stop();
      } else if (this.processingMode === 'whisper' && this.systemAudioTranscriber) {
        this.systemAudioTranscriber.stopTranscription();
      }
      
      this.isListening = false;
      this.isPaused = false;
      
      // Finalize any pending transcript segment
      this.finalizeCurrentSegment();
      
      this.notifyStatusChange('stopped');
      return true;
    } catch (error) {
      this.handleServiceError('Failed to stop speech recognition', error);
      return false;
    }
  }

  /**
   * Pause speech recognition (stop and prepare for resume)
   * @returns {boolean} Success status
   */
  pauseListening() {
    try {
      if (!this.isListening || this.isPaused) {
        console.warn('Cannot pause - not listening or already paused');
        return false;
      }

      if (this.processingMode === 'webspeech' && this.recognition) {
        this.recognition.stop();
      }
      
      this.isPaused = true;
      
      // Finalize current segment before pausing
      this.finalizeCurrentSegment();
      
      this.notifyStatusChange('paused');
      return true;
    } catch (error) {
      this.handleServiceError('Failed to pause speech recognition', error);
      return false;
    }
  }

  /**
   * Resume speech recognition after pause
   * @returns {Promise<boolean>} Success status
   */
  async resumeListening() {
    try {
      if (!this.isPaused) {
        console.warn('Cannot resume - not paused');
        return false;
      }

      if (this.processingMode === 'webspeech' && this.recognition) {
        this.recognition.start();
      }
      
      this.isListening = true;
      this.isPaused = false;
      this.lastSegmentTime = Date.now();
      
      this.notifyStatusChange('listening');
      return true;
    } catch (error) {
      this.handleServiceError('Failed to resume speech recognition', error);
      return false;
    }
  }

  /**
   * Handle speech recognition results
   * @param {SpeechRecognitionEvent} event - Recognition result event
   */
  handleResult(event) {
    try {
      const currentTime = Date.now();
      let interimTranscript = '';
      let finalTranscript = '';
      
      // Process all results
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        const confidence = result[0].confidence || 0;
        
        if (result.isFinal) {
          finalTranscript += transcript;
          
          // Create transcript segment for final result
          const segment = this.createTranscriptSegment(
            transcript,
            currentTime,
            confidence,
            true
          );
          
          this.addTranscriptSegment(segment);
        } else {
          interimTranscript += transcript;
        }
      }
      
      // Update current transcript with interim results
      if (interimTranscript) {
        this.currentTranscript = interimTranscript;
        
        // Create interim segment for real-time display
        const interimSegment = this.createTranscriptSegment(
          interimTranscript,
          currentTime,
          0.5, // Default confidence for interim results
          false
        );
        
        // Notify listeners of transcript update
        this.notifyTranscriptUpdate(interimSegment);
      }
      
      // Reset retry count on successful result
      this.retryCount = 0;
      
    } catch (error) {
      this.handleServiceError('Error processing speech recognition result', error);
    }
  }

  /**
   * Create a transcript segment object
   * @param {string} text - Transcript text
   * @param {number} timestamp - Timestamp in milliseconds
   * @param {number} confidence - Confidence score (0-1)
   * @param {boolean} isFinal - Whether this is a final result
   * @returns {Object} Transcript segment
   */
  createTranscriptSegment(text, timestamp, confidence, isFinal) {
    const relativeTime = this.sessionStartTime ? timestamp - this.sessionStartTime : 0;
    
    return {
      id: `segment_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
      text: text.trim(),
      timestamp: timestamp,
      relativeTime: relativeTime,
      confidence: confidence,
      isFinal: isFinal,
      duration: 0, // Will be calculated when segment is finalized
      confidenceLevel: this.getConfidenceLevel(confidence)
    };
  }

  /**
   * Add a transcript segment to the collection
   * @param {Object} segment - Transcript segment
   */
  addTranscriptSegment(segment) {
    // Calculate duration if this is a final segment
    if (segment.isFinal && this.lastSegmentTime) {
      segment.duration = segment.timestamp - this.lastSegmentTime;
      this.lastSegmentTime = segment.timestamp;
    }
    
    this.transcriptSegments.push(segment);
    
    // Notify listeners of new segment
    if (this.onSegmentComplete) {
      this.onSegmentComplete(segment);
    }
    
    // Clear current transcript after finalizing
    if (segment.isFinal) {
      this.currentTranscript = '';
    }
  }

  /**
   * Finalize the current transcript segment
   */
  finalizeCurrentSegment() {
    if (this.currentTranscript.trim()) {
      const segment = this.createTranscriptSegment(
        this.currentTranscript,
        Date.now(),
        0.8, // Default confidence for manually finalized segments
        true
      );
      
      this.addTranscriptSegment(segment);
    }
  }

  /**
   * Get confidence level description
   * @param {number} confidence - Confidence score (0-1)
   * @returns {string} Confidence level
   */
  getConfidenceLevel(confidence) {
    if (confidence >= 0.9) return 'high';
    if (confidence >= 0.7) return 'medium';
    if (confidence >= 0.5) return 'low';
    return 'very-low';
  }

  /**
   * Handle speech recognition errors
   * @param {SpeechRecognitionErrorEvent} event - Error event
   */
  handleError(event) {
    const error = {
      type: event.error,
      message: this.getErrorMessage(event.error),
      timestamp: Date.now()
    };
    
    this.lastError = error;
    
    // Handle different error types
    switch (event.error) {
      case 'no-speech':
        // No speech detected - this is normal, just restart
        this.handleNoSpeechError();
        break;
        
      case 'audio-capture':
        // Audio capture failed - critical error
        this.handleCriticalError(error);
        break;
        
      case 'not-allowed':
        // Permission denied - critical error
        this.handleCriticalError(error);
        break;
        
      case 'network':
        // Network error - often means "already started", reset and try again
        this.handleNetworkError(error);
        break;
        
      case 'aborted':
        // Recognition was aborted - normal during stop/pause
        if (this.isListening && !this.isPaused) {
          this.handleRecoveryError(error);
        }
        break;
        
      default:
        // Other errors - try to recover
        this.handleRecoveryError(error);
        break;
    }
  }

  /**
   * Handle no-speech error (restart recognition)
   */
  handleNoSpeechError() {
    if (this.isListening && !this.isPaused) {
      // Restart recognition automatically
      setTimeout(() => {
        if (this.isListening && !this.isPaused) {
          try {
            this.recognition.start();
          } catch (error) {
            this.handleServiceError('Failed to restart after no-speech', error);
          }
        }
      }, 100);
    }
  }

  /**
   * Handle critical errors that require stopping
   * @param {Object} error - Error object
   */
  handleCriticalError(error) {
    this.isListening = false;
    this.isPaused = false;
    this.notifyStatusChange('error');
    this.notifyError(error);
  }

  /**
   * Handle network errors with retry logic
   * @param {Object} error - Error object
   */
  handleNetworkError(error) {
    console.log('Network error detected:', error.type, error.message);
    
    // Network errors often mean "already started" or connection issues
    // Force reset state and try to recover
    this.isListening = false;
    this.isPaused = false;
    
    // Don't retry network errors immediately - they usually indicate
    // the service is already running or there's a connection issue
    if (this.retryCount < this.config.maxRetries) {
      this.retryCount++;
      
      setTimeout(async () => {
        try {
          // Force complete cleanup
          try {
            this.recognition.stop();
          } catch (e) { /* ignore */ }
          
          try {
            this.recognition.abort();
          } catch (e) { /* ignore */ }
          
          // Wait longer for network issues to resolve
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Only restart if we should still be listening
          if (!this.isListening && !this.isPaused) {
            // Create fresh recognition instance to avoid state issues
            await this.reinitializeRecognition();
            
            if (this.recognition) {
              this.recognition.start();
              this.isListening = true;
            }
          }
        } catch (retryError) {
          console.warn('Network error retry failed:', retryError);
          // Don't treat network retry failures as critical
          this.retryCount = this.config.maxRetries; // Stop retrying
        }
      }, this.config.retryDelayMs * this.retryCount);
    } else {
      // After max retries, just notify but don't treat as critical
      console.warn('Max network error retries reached, stopping attempts');
      this.notifyError({
        ...error,
        message: 'Network connection issues. Please check your internet connection and try again.'
      });
    }
  }

  /**
   * Handle recoverable errors with retry logic
   * @param {Object} error - Error object
   */
  handleRecoveryError(error) {
    if (this.retryCount < this.config.maxRetries && this.isListening && !this.isPaused) {
      this.retryCount++;
      
      setTimeout(() => {
        if (this.isListening && !this.isPaused) {
          try {
            this.recognition.start();
          } catch (retryError) {
            this.handleServiceError('Failed to recover from error', retryError);
          }
        }
      }, this.config.retryDelayMs);
    } else if (this.isListening) {
      this.handleCriticalError(error);
    }
  }

  /**
   * Get user-friendly error message
   * @param {string} errorType - Error type from speech recognition
   * @returns {string} User-friendly error message
   */
  getErrorMessage(errorType) {
    const errorMessages = {
      'no-speech': 'No speech detected. Make sure your microphone is working and try speaking.',
      'aborted': 'Speech recognition was interrupted.',
      'audio-capture': 'Could not capture audio. Please check your microphone permissions.',
      'network': 'Network error occurred. Please check your internet connection.',
      'not-allowed': 'Microphone access denied. Please allow microphone permissions.',
      'service-not-allowed': 'Speech recognition service not allowed.',
      'bad-grammar': 'Grammar error in speech recognition.',
      'language-not-supported': 'Language not supported for speech recognition.'
    };
    
    return errorMessages[errorType] || `Speech recognition error: ${errorType}`;
  }

  /**
   * Handle speech recognition start event
   */
  handleStart() {
    this.notifyStatusChange('started');
  }

  /**
   * Handle speech recognition end event
   */
  handleEnd() {
            // Speech recognition ended
    
    // Only restart if we're still supposed to be listening and not paused
    if (this.isListening && !this.isPaused) {
      // Small delay before restarting to avoid rapid restarts
      setTimeout(() => {
        if (this.isListening && !this.isPaused) {
          try {
            // Restarting speech recognition after end event
            this.recognition.start();
          } catch (error) {
            console.warn('Failed to restart recognition after end:', error);
            
            // If restart fails, try to reinitialize
            if (error.message && error.message.includes('network')) {
              // Network error on restart, will reinitialize
              this.reinitializeRecognition().then(() => {
                if (this.recognition && this.isListening && !this.isPaused) {
                  try {
                    this.recognition.start();
                  } catch (retryError) {
                    console.error('Failed to restart after reinitialize:', retryError);
                  }
                }
              });
            } else {
              this.handleServiceError('Failed to restart recognition', error);
            }
          }
        }
      }, 150); // Slightly longer delay
    }
  }

  /**
   * Handle speech start event
   */
  handleSpeechStart() {
    this.notifyStatusChange('speech-detected');
  }

  /**
   * Handle speech end event
   */
  handleSpeechEnd() {
    this.notifyStatusChange('speech-ended');
  }

  /**
   * Handle service-level errors
   * @param {string} message - Error message
   * @param {Error} error - Error object
   */
  handleServiceError(message, error) {
    console.error(message, error);
    
    const serviceError = {
      type: 'service-error',
      message: message,
      originalError: error,
      timestamp: Date.now()
    };
    
    this.lastError = serviceError;
    this.notifyError(serviceError);
  }

  /**
   * Get current transcript segments
   * @returns {Array} Array of transcript segments
   */
  getTranscriptSegments() {
    return [...this.transcriptSegments];
  }

  /**
   * Get current interim transcript
   * @returns {string} Current interim transcript
   */
  getCurrentTranscript() {
    return this.currentTranscript;
  }

  /**
   * Get full transcript text
   * @returns {string} Complete transcript text
   */
  getFullTranscript() {
    return this.transcriptSegments
      .filter(segment => segment.isFinal)
      .map(segment => segment.text)
      .join(' ');
  }

  /**
   * Get service status
   * @returns {Object} Service status information
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      isListening: this.isListening,
      isPaused: this.isPaused,
      segmentCount: this.transcriptSegments.length,
      sessionDuration: this.sessionStartTime ? Date.now() - this.sessionStartTime : 0,
      lastError: this.lastError,
      retryCount: this.retryCount,
      isSupported: this.isWebSpeechSupported()
    };
  }

  /**
   * Update configuration
   * @param {Object} newConfig - New configuration options
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    
    // Update recognition settings if initialized
    if (this.recognition) {
      this.recognition.lang = this.config.language;
      this.recognition.continuous = this.config.continuous;
      this.recognition.interimResults = this.config.interimResults;
      this.recognition.maxAlternatives = this.config.maxAlternatives;
    }
  }

  /**
   * Notify listeners of transcript updates
   * @param {Object} segment - Transcript segment
   */
  notifyTranscriptUpdate(segment) {
    if (this.onTranscriptUpdate) {
      this.onTranscriptUpdate(segment);
    }
  }

  /**
   * Notify listeners of status changes
   * @param {string} status - New status
   */
  notifyStatusChange(status) {
    if (this.onStatusChange) {
      this.onStatusChange({
        status,
        timestamp: Date.now(),
        serviceStatus: this.getStatus()
      });
    }
  }

  /**
   * Notify listeners of errors
   * @param {Object} error - Error object
   */
  notifyError(error) {
    if (this.onError) {
      this.onError(error);
    }
  }

  /**
   * Set callback for transcript updates
   * @param {Function} callback - Callback function
   */
  setTranscriptUpdateCallback(callback) {
    this.onTranscriptUpdate = callback;
  }

  /**
   * Set callback for segment completion
   * @param {Function} callback - Callback function
   */
  setSegmentCompleteCallback(callback) {
    this.onSegmentComplete = callback;
  }

  /**
   * Set callback for errors
   * @param {Function} callback - Callback function
   */
  setErrorCallback(callback) {
    this.onError = callback;
  }

  /**
   * Set callback for status changes
   * @param {Function} callback - Callback function
   */
  setStatusChangeCallback(callback) {
    this.onStatusChange = callback;
  }

  /**
   * Force cleanup of recognition instance
   */
  async forceCleanup() {
    try {
      if (this.recognition) {
        // Try to stop gracefully first
        try {
          this.recognition.stop();
        } catch (e) {
          console.log('Stop failed during cleanup:', e.message);
        }
        
        // Then abort to force stop
        try {
          this.recognition.abort();
        } catch (e) {
          console.log('Abort failed during cleanup:', e.message);
        }
      }
      
      // Wait for cleanup to complete
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error) {
      console.warn('Error during force cleanup:', error);
    }
  }

  /**
   * Reinitialize recognition instance to avoid state issues
   */
  async reinitializeRecognition() {
    try {
      // Remove old event listeners
      if (this.recognition) {
        this.recognition.removeEventListener('result', this.handleResult);
        this.recognition.removeEventListener('error', this.handleError);
        this.recognition.removeEventListener('start', this.handleStart);
        this.recognition.removeEventListener('end', this.handleEnd);
        this.recognition.removeEventListener('speechstart', this.handleSpeechStart);
        this.recognition.removeEventListener('speechend', this.handleSpeechEnd);
      }

      // Create new recognition instance
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.recognition = new SpeechRecognition();
      
      // Configure recognition settings
      this.recognition.continuous = this.config.continuous;
      this.recognition.interimResults = this.config.interimResults;
      this.recognition.lang = this.config.language;
      this.recognition.maxAlternatives = this.config.maxAlternatives;
      
      // Set up event listeners
      this.recognition.addEventListener('result', this.handleResult);
      this.recognition.addEventListener('error', this.handleError);
      this.recognition.addEventListener('start', this.handleStart);
      this.recognition.addEventListener('end', this.handleEnd);
      this.recognition.addEventListener('speechstart', this.handleSpeechStart);
      this.recognition.addEventListener('speechend', this.handleSpeechEnd);
      
      console.log('Speech recognition reinitialized');
      
    } catch (error) {
      console.error('Failed to reinitialize recognition:', error);
      this.recognition = null;
    }
  }

  /**
   * Reset recognition state
   */
  resetRecognitionState() {
    try {
      if (this.recognition) {
        this.recognition.stop();
        this.recognition.abort();
      }
    } catch (error) {
      // Ignore errors during reset
    }
    
    this.isListening = false;
    this.isPaused = false;
    this.retryCount = 0;
  }

  /**
   * Clean up resources and stop speech recognition
   */
  async cleanup() {
    try {
      // Stop listening if active
      if (this.isListening) {
        this.stopListening();
      }

      // Cleanup Web Speech API
      if (this.recognition) {
        this.resetRecognitionState();
        this.recognition.removeEventListener('result', this.handleResult);
        this.recognition.removeEventListener('error', this.handleError);
        this.recognition.removeEventListener('start', this.handleStart);
        this.recognition.removeEventListener('end', this.handleEnd);
        this.recognition.removeEventListener('speechstart', this.handleSpeechStart);
        this.recognition.removeEventListener('speechend', this.handleSpeechEnd);
        this.recognition = null;
      }

      // Cleanup Whisper service
      if (this.whisperService) {
        await this.whisperService.cleanup();
        this.whisperService = null;
      }

      // Cleanup system audio transcriber
      if (this.systemAudioTranscriber) {
        this.systemAudioTranscriber.cleanup();
        this.systemAudioTranscriber = null;
      }

      // Cleanup audio processor
      if (this.audioProcessor) {
        this.audioProcessor.disconnect();
        this.audioProcessor = null;
      }

      // Clear any pending processing timeout
      if (this.processingTimeout) {
        clearTimeout(this.processingTimeout);
        this.processingTimeout = null;
      }

      // Reset state
      this.isListening = false;
      this.isPaused = false;
      this.isInitialized = false;
      this.currentTranscript = '';
      this.transcriptSegments = [];
      this.sessionStartTime = null;
      this.lastSegmentTime = null;
      this.retryCount = 0;
      this.lastError = null;
      this.audioStream = null;
      this.audioBuffer = [];
      this.isProcessingAudio = false;
      this.processingMode = 'webspeech';

      
    } catch (error) {
      this.handleServiceError('Error during cleanup', error);
    }
  }
}

export default SpeechService;