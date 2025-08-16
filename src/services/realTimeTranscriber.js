/**
 * RealTimeTranscriber - Processes real system audio for transcription
 * Uses Web Speech API with system audio stream
 */

class RealTimeTranscriber {
  constructor() {
    this.recognition = null;
    this.audioContext = null;
    this.analyser = null;
    this.onTranscript = null;
    this.onError = null;
    this.isActive = false;
    this.audioStream = null;
  }

  /**
   * Initialize the transcriber with system audio stream
   * @param {MediaStream} audioStream - System audio stream
   */
  async initialize(audioStream) {
    try {
      console.log('Initializing RealTimeTranscriber with system audio');
      
      this.audioStream = audioStream;
      
      // Set up audio analysis
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      
      const source = this.audioContext.createMediaStreamSource(audioStream);
      source.connect(this.analyser);
      
      // Set up Web Speech API
      if (window.SpeechRecognition || window.webkitSpeechRecognition) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';
        
        this.recognition.onresult = (event) => {
          this.handleSpeechResult(event);
        };
        
        this.recognition.onerror = (event) => {
          console.error('Speech recognition error:', event.error);
          if (this.onError) {
            this.onError(event.error);
          }
        };
        
        this.recognition.onend = () => {
          // Restart recognition if still active
          if (this.isActive) {
            setTimeout(() => {
              if (this.isActive) {
                try {
                  this.recognition.start();
                } catch (error) {
                  console.warn('Failed to restart recognition:', error);
                }
              }
            }, 100);
          }
        };
      }
      
      console.log('RealTimeTranscriber initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize RealTimeTranscriber:', error);
      return false;
    }
  }

  /**
   * Start real-time transcription
   */
  async startTranscription() {
    try {
      if (!this.recognition) {
        throw new Error('Speech recognition not available');
      }
      
      this.isActive = true;
      
      // Start speech recognition
      this.recognition.start();
      
      // Start audio level monitoring for system audio
      this.startSystemAudioMonitoring();
      
      console.log('Real-time transcription started');
      return true;
    } catch (error) {
      console.error('Failed to start transcription:', error);
      return false;
    }
  }

  /**
   * Stop transcription
   */
  stopTranscription() {
    try {
      this.isActive = false;
      
      if (this.recognition) {
        this.recognition.stop();
      }
      
      console.log('Real-time transcription stopped');
    } catch (error) {
      console.error('Error stopping transcription:', error);
    }
  }

  /**
   * Handle speech recognition results from Web Speech API
   * @param {SpeechRecognitionEvent} event - Speech recognition event
   */
  handleSpeechResult(event) {
    let interimTranscript = '';
    let finalTranscript = '';
    
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      const confidence = event.results[i][0].confidence || 0.8;
      
      if (event.results[i].isFinal) {
        finalTranscript += transcript;
        
        // Send final transcript
        if (this.onTranscript) {
          this.onTranscript({
            text: finalTranscript.trim(),
            confidence: confidence,
            timestamp: Date.now(),
            source: 'speech-recognition',
            isFinal: true
          });
        }
      } else {
        interimTranscript += transcript;
        
        // Send interim transcript
        if (this.onTranscript && interimTranscript.trim()) {
          this.onTranscript({
            text: interimTranscript.trim(),
            confidence: confidence * 0.7, // Lower confidence for interim
            timestamp: Date.now(),
            source: 'speech-recognition',
            isFinal: false
          });
        }
      }
    }
  }

  /**
   * Start monitoring system audio levels
   */
  startSystemAudioMonitoring() {
    if (!this.analyser) return;
    
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    let lastAudioTime = 0;
    
    const monitor = () => {
      if (!this.isActive) return;
      
      this.analyser.getByteFrequencyData(dataArray);
      
      // Calculate RMS for audio level
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i] * dataArray[i];
      }
      const rms = Math.sqrt(sum / dataArray.length);
      const audioLevel = rms / 255;
      
      // If significant system audio is detected, send a notification
      const currentTime = Date.now();
      if (audioLevel > 0.1 && currentTime - lastAudioTime > 5000) { // Every 5 seconds
        lastAudioTime = currentTime;
        
        if (this.onTranscript) {
          this.onTranscript({
            text: `[System Audio Detected] Audio level: ${(audioLevel * 100).toFixed(1)}% - Meeting participants may be speaking`,
            confidence: audioLevel,
            timestamp: currentTime,
            source: 'system-audio-monitor',
            isFinal: true
          });
        }
      }
      
      requestAnimationFrame(monitor);
    };
    
    monitor();
  }

  /**
   * Set transcript callback
   * @param {Function} callback - Callback function for transcripts
   */
  setTranscriptCallback(callback) {
    this.onTranscript = callback;
  }

  /**
   * Set error callback
   * @param {Function} callback - Callback function for errors
   */
  setErrorCallback(callback) {
    this.onError = callback;
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.stopTranscription();
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.recognition = null;
    this.analyser = null;
    
    console.log('RealTimeTranscriber cleaned up');
  }
}

export default RealTimeTranscriber;