/**
 * AudioCaptureService - Handles real-time audio capture from system audio
 * Integrates with Web Audio API and MediaRecorder API for audio processing
 */

class AudioCaptureService {
  constructor() {
    this.audioContext = null;
    this.mediaRecorder = null;
    this.audioStream = null;
    this.analyser = null;
    this.dataArray = null;
    this.isRecording = false;
    this.isPaused = false;
    this.audioChunks = [];
    this.audioLevel = 0;
    this.onAudioLevelChange = null;
    this.onRecordingStateChange = null;
    this.onError = null;
    
    // Configuration
    this.config = {
      sampleRate: 44100,
      bufferSize: 4096,
      channels: 2,
      mimeType: 'audio/webm;codecs=opus'
    };
    
    // Bind methods to maintain context
    this.handleDataAvailable = this.handleDataAvailable.bind(this);
    this.handleRecordingStop = this.handleRecordingStop.bind(this);
    this.handleRecordingError = this.handleRecordingError.bind(this);
  }

  /**
   * Initialize audio capture system
   * @param {boolean} useMicrophone - If true, use microphone instead of system audio
   * @returns {Promise<boolean>} Success status
   */
  async initialize(useMicrophone = false) {
    try {
      // Try different audio capture methods
      this.audioStream = await this.getAudioStream(useMicrophone);

      // Create audio context for analysis
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: this.config.sampleRate
      });

      // Create analyser for audio level monitoring
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.8;
      
      const bufferLength = this.analyser.frequencyBinCount;
      this.dataArray = new Uint8Array(bufferLength);

      // Connect audio stream to analyser
      const source = this.audioContext.createMediaStreamSource(this.audioStream);
      source.connect(this.analyser);

      // Get best supported MIME type
      const mimeType = this.getBestSupportedMimeType();
      
      // Initialize MediaRecorder
      this.mediaRecorder = new MediaRecorder(this.audioStream, {
        mimeType: mimeType,
        audioBitsPerSecond: 128000
      });

      // Set up event listeners
      this.mediaRecorder.addEventListener('dataavailable', this.handleDataAvailable);
      this.mediaRecorder.addEventListener('stop', this.handleRecordingStop);
      this.mediaRecorder.addEventListener('error', this.handleRecordingError);

      // Start audio level monitoring
      this.startAudioLevelMonitoring();

      return true;
    } catch (error) {
      this.handleError('Failed to initialize audio capture', error);
      return false;
    }
  }

  /**
   * Get audio stream using different methods
   * @param {boolean} useMicrophone - Prefer microphone over system audio
   * @returns {Promise<MediaStream>} Audio stream
   */
  async getAudioStream(useMicrophone = false) {
    if (useMicrophone) {
      // Try microphone first
      try {
        return await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            sampleRate: this.config.sampleRate,
            channelCount: this.config.channels
          }
        });
      } catch (error) {
        console.warn('Microphone access failed, trying system audio:', error);
      }
    }

    // Try system audio capture
    try {
      return await navigator.mediaDevices.getDisplayMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: this.config.sampleRate,
          channelCount: this.config.channels
        },
        video: false
      });
    } catch (error) {
      console.warn('System audio capture failed, falling back to microphone:', error);
      
      // Fallback to microphone
      return await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: this.config.sampleRate,
          channelCount: this.config.channels
        }
      });
    }
  }

  /**
   * Get the best supported MIME type for recording
   * @returns {string} Best supported MIME type
   */
  getBestSupportedMimeType() {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
      'audio/ogg',
      'audio/wav'
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return 'audio/webm'; // Default fallback
  }

  /**
   * Start audio recording
   * @returns {Promise<boolean>} Success status
   */
  async startRecording() {
    try {
      if (!this.mediaRecorder) {
        throw new Error('Audio capture not initialized');
      }

      if (this.isRecording) {
        console.warn('Recording already in progress');
        return false;
      }

      // Clear previous audio chunks
      this.audioChunks = [];
      
      // Resume audio context if suspended
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // Start recording
      this.mediaRecorder.start(100); // Collect data every 100ms
      this.isRecording = true;
      this.isPaused = false;

      this.notifyRecordingStateChange('recording');
      return true;
    } catch (error) {
      this.handleError('Failed to start recording', error);
      return false;
    }
  }

  /**
   * Pause audio recording
   * @returns {boolean} Success status
   */
  pauseRecording() {
    try {
      if (!this.isRecording || this.isPaused) {
        console.warn('Cannot pause - not recording or already paused');
        return false;
      }

      this.mediaRecorder.pause();
      this.isPaused = true;
      
      this.notifyRecordingStateChange('paused');
      return true;
    } catch (error) {
      this.handleError('Failed to pause recording', error);
      return false;
    }
  }

  /**
   * Resume audio recording
   * @returns {boolean} Success status
   */
  resumeRecording() {
    try {
      if (!this.isRecording || !this.isPaused) {
        console.warn('Cannot resume - not recording or not paused');
        return false;
      }

      this.mediaRecorder.resume();
      this.isPaused = false;
      
      this.notifyRecordingStateChange('recording');
      return true;
    } catch (error) {
      this.handleError('Failed to resume recording', error);
      return false;
    }
  }

  /**
   * Stop audio recording
   * @returns {Promise<Blob>} Recorded audio blob
   */
  async stopRecording() {
    return new Promise((resolve, reject) => {
      try {
        if (!this.isRecording) {
          console.warn('No recording in progress');
          resolve(null);
          return;
        }

        // Set up one-time listener for stop event
        const handleStop = () => {
          this.mediaRecorder.removeEventListener('stop', handleStop);
          const audioBlob = new Blob(this.audioChunks, { type: this.config.mimeType });
          resolve(audioBlob);
        };

        this.mediaRecorder.addEventListener('stop', handleStop);
        this.mediaRecorder.stop();
        
        this.isRecording = false;
        this.isPaused = false;
        
        this.notifyRecordingStateChange('stopped');
      } catch (error) {
        this.handleError('Failed to stop recording', error);
        reject(error);
      }
    });
  }

  /**
   * Start monitoring audio levels for real-time indicators
   */
  startAudioLevelMonitoring() {
    const monitorLevel = () => {
      if (!this.analyser || !this.dataArray) {
        return;
      }

      this.analyser.getByteFrequencyData(this.dataArray);
      
      // Calculate RMS (Root Mean Square) for audio level
      let sum = 0;
      for (let i = 0; i < this.dataArray.length; i++) {
        sum += this.dataArray[i] * this.dataArray[i];
      }
      
      const rms = Math.sqrt(sum / this.dataArray.length);
      this.audioLevel = Math.min(100, (rms / 255) * 100);
      
      // Notify listeners of audio level change
      if (this.onAudioLevelChange) {
        this.onAudioLevelChange(this.audioLevel);
      }

      // Continue monitoring
      requestAnimationFrame(monitorLevel);
    };

    monitorLevel();
  }

  /**
   * Get current audio level (0-100)
   * @returns {number} Current audio level
   */
  getAudioLevel() {
    return this.audioLevel;
  }

  /**
   * Get current recording state
   * @returns {Object} Recording state information
   */
  getRecordingState() {
    return {
      isRecording: this.isRecording,
      isPaused: this.isPaused,
      audioLevel: this.audioLevel,
      isInitialized: !!this.mediaRecorder
    };
  }

  /**
   * Handle MediaRecorder data available event
   * @param {BlobEvent} event - Data available event
   */
  handleDataAvailable(event) {
    if (event.data && event.data.size > 0) {
      this.audioChunks.push(event.data);
    }
  }

  /**
   * Handle MediaRecorder stop event
   */
  handleRecordingStop() {
    // Recording stopped, chunks collected
  }

  /**
   * Handle MediaRecorder error event
   * @param {Event} event - Error event
   */
  handleRecordingError(event) {
    this.handleError('MediaRecorder error', event.error);
  }

  /**
   * Handle errors and notify listeners
   * @param {string} message - Error message
   * @param {Error} error - Error object
   */
  handleError(message, error) {
    console.error(message, error);
    if (this.onError) {
      this.onError({ message, error });
    }
  }

  /**
   * Notify listeners of recording state changes
   * @param {string} state - New recording state
   */
  notifyRecordingStateChange(state) {
    if (this.onRecordingStateChange) {
      this.onRecordingStateChange({
        state,
        isRecording: this.isRecording,
        isPaused: this.isPaused,
        audioLevel: this.audioLevel
      });
    }
  }

  /**
   * Set callback for audio level changes
   * @param {Function} callback - Callback function
   */
  setAudioLevelCallback(callback) {
    this.onAudioLevelChange = callback;
  }

  /**
   * Set callback for recording state changes
   * @param {Function} callback - Callback function
   */
  setRecordingStateCallback(callback) {
    this.onRecordingStateChange = callback;
  }

  /**
   * Set callback for errors
   * @param {Function} callback - Callback function
   */
  setErrorCallback(callback) {
    this.onError = callback;
  }

  /**
   * Clean up resources and stop all audio processing
   */
  async cleanup() {
    try {
      // Stop recording if active
      if (this.isRecording) {
        await this.stopRecording();
      }

      // Stop all audio tracks
      if (this.audioStream) {
        this.audioStream.getTracks().forEach(track => track.stop());
        this.audioStream = null;
      }

      // Close audio context
      if (this.audioContext && this.audioContext.state !== 'closed') {
        await this.audioContext.close();
        this.audioContext = null;
      }

      // Clean up MediaRecorder
      if (this.mediaRecorder) {
        this.mediaRecorder.removeEventListener('dataavailable', this.handleDataAvailable);
        this.mediaRecorder.removeEventListener('stop', this.handleRecordingStop);
        this.mediaRecorder.removeEventListener('error', this.handleRecordingError);
        this.mediaRecorder = null;
      }

      // Reset state
      this.analyser = null;
      this.dataArray = null;
      this.audioChunks = [];
      this.isRecording = false;
      this.isPaused = false;
      this.audioLevel = 0;

      console.log('AudioCaptureService cleanup completed');
    } catch (error) {
      this.handleError('Error during cleanup', error);
    }
  }
}

export default AudioCaptureService;