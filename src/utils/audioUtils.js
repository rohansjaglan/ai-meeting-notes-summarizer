/**
 * Audio utility functions for processing and analysis
 */

/**
 * Check if the browser supports required audio APIs
 * @returns {Object} Support status for different APIs
 */
export const checkAudioSupport = () => {
  const support = {
    mediaDevices: !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia),
    audioContext: !!(window.AudioContext || window.webkitAudioContext),
    mediaRecorder: !!window.MediaRecorder,
    webAudio: !!(window.AudioContext || window.webkitAudioContext)
  };

  support.isFullySupported = Object.values(support).every(Boolean);
  
  return support;
};

/**
 * Get supported MIME types for MediaRecorder
 * @returns {Array} Array of supported MIME types
 */
export const getSupportedMimeTypes = () => {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/wav'
  ];

  return types.filter(type => MediaRecorder.isTypeSupported(type));
};

/**
 * Get the best supported MIME type for recording
 * @returns {string} Best supported MIME type
 */
export const getBestMimeType = () => {
  const supportedTypes = getSupportedMimeTypes();
  
  // Prefer opus codec for better compression and quality
  const preferredOrder = [
    'audio/webm;codecs=opus',
    'audio/ogg;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg',
    'audio/wav'
  ];

  for (const type of preferredOrder) {
    if (supportedTypes.includes(type)) {
      return type;
    }
  }

  return supportedTypes[0] || 'audio/webm';
};

/**
 * Calculate audio level from frequency data
 * @param {Uint8Array} frequencyData - Frequency domain data from analyser
 * @returns {number} Audio level (0-100)
 */
export const calculateAudioLevel = (frequencyData) => {
  if (!frequencyData || frequencyData.length === 0) {
    return 0;
  }

  let sum = 0;
  for (let i = 0; i < frequencyData.length; i++) {
    sum += frequencyData[i] * frequencyData[i];
  }
  
  const rms = Math.sqrt(sum / frequencyData.length);
  return Math.min(100, (rms / 255) * 100);
};

/**
 * Calculate audio level from time domain data
 * @param {Uint8Array} timeData - Time domain data from analyser
 * @returns {number} Audio level (0-100)
 */
export const calculateAudioLevelFromTimeData = (timeData) => {
  if (!timeData || timeData.length === 0) {
    return 0;
  }

  let sum = 0;
  for (let i = 0; i < timeData.length; i++) {
    const sample = (timeData[i] - 128) / 128; // Convert to -1 to 1 range
    sum += sample * sample;
  }
  
  const rms = Math.sqrt(sum / timeData.length);
  return Math.min(100, rms * 100);
};

/**
 * Detect silence in audio data
 * @param {Uint8Array} audioData - Audio data array
 * @param {number} threshold - Silence threshold (0-100)
 * @returns {boolean} True if audio is considered silent
 */
export const detectSilence = (audioData, threshold = 5) => {
  const level = calculateAudioLevel(audioData);
  return level < threshold;
};

/**
 * Format audio duration in seconds to MM:SS format
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration string
 */
export const formatDuration = (seconds) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
};

/**
 * Convert audio blob to array buffer
 * @param {Blob} audioBlob - Audio blob to convert
 * @returns {Promise<ArrayBuffer>} Array buffer containing audio data
 */
export const blobToArrayBuffer = (audioBlob) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsArrayBuffer(audioBlob);
  });
};

/**
 * Create a download link for audio blob
 * @param {Blob} audioBlob - Audio blob to download
 * @param {string} filename - Filename for download
 * @returns {string} Download URL
 */
export const createAudioDownloadUrl = (audioBlob, filename = 'recording.webm') => {
  return URL.createObjectURL(audioBlob);
};

/**
 * Validate audio stream constraints
 * @param {Object} constraints - Audio constraints to validate
 * @returns {Object} Validated constraints
 */
export const validateAudioConstraints = (constraints = {}) => {
  const defaultConstraints = {
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
    sampleRate: 44100,
    channelCount: 2
  };

  return {
    ...defaultConstraints,
    ...constraints,
    // Ensure numeric values are within valid ranges
    sampleRate: Math.max(8000, Math.min(96000, constraints.sampleRate || defaultConstraints.sampleRate)),
    channelCount: Math.max(1, Math.min(2, constraints.channelCount || defaultConstraints.channelCount))
  };
};

/**
 * Get audio context sample rate
 * @returns {number} Sample rate of audio context
 */
export const getAudioContextSampleRate = () => {
  if (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const tempContext = new AudioContextClass();
    const sampleRate = tempContext.sampleRate;
    tempContext.close();
    return sampleRate;
  }
  return 44100; // Default fallback
};

/**
 * Check if audio permissions are granted
 * @returns {Promise<boolean>} True if permissions are granted
 */
export const checkAudioPermissions = async () => {
  try {
    if (!navigator.permissions) {
      return false;
    }

    const result = await navigator.permissions.query({ name: 'microphone' });
    return result.state === 'granted';
  } catch (error) {
    console.warn('Could not check audio permissions:', error);
    return false;
  }
};

/**
 * Request audio permissions
 * @returns {Promise<boolean>} True if permissions were granted
 */
export const requestAudioPermissions = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => track.stop());
    return true;
  } catch (error) {
    console.error('Audio permission denied:', error);
    return false;
  }
};

/**
 * Get available audio input devices
 * @returns {Promise<Array>} Array of audio input devices
 */
export const getAudioInputDevices = async () => {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter(device => device.kind === 'audioinput');
  } catch (error) {
    console.error('Could not enumerate audio devices:', error);
    return [];
  }
};

/**
 * Create audio visualization data from frequency data
 * @param {Uint8Array} frequencyData - Frequency data from analyser
 * @param {number} barCount - Number of bars for visualization
 * @returns {Array} Array of normalized values for visualization
 */
export const createVisualizationData = (frequencyData, barCount = 32) => {
  if (!frequencyData || frequencyData.length === 0) {
    return new Array(barCount).fill(0);
  }

  const dataPerBar = Math.floor(frequencyData.length / barCount);
  const visualData = [];

  for (let i = 0; i < barCount; i++) {
    let sum = 0;
    const start = i * dataPerBar;
    const end = start + dataPerBar;

    for (let j = start; j < end && j < frequencyData.length; j++) {
      sum += frequencyData[j];
    }

    const average = sum / dataPerBar;
    visualData.push(average / 255); // Normalize to 0-1
  }

  return visualData;
};