const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // App info
  getAppVersion: () => ipcRenderer.invoke('app-version'),
  getPlatformInfo: () => ipcRenderer.invoke('platform-info'),
  
  // Audio capture (to be implemented in future tasks)
  startAudioCapture: () => ipcRenderer.invoke('start-audio-capture'),
  stopAudioCapture: () => ipcRenderer.invoke('stop-audio-capture'),
  pauseAudioCapture: () => ipcRenderer.invoke('pause-audio-capture'),
  
  // File operations (to be implemented in future tasks)
  saveFile: (data, filename) => ipcRenderer.invoke('save-file', data, filename),
  openFile: () => ipcRenderer.invoke('open-file'),
  
  // Event listeners
  onAudioData: (callback) => ipcRenderer.on('audio-data', callback),
  onAudioLevel: (callback) => ipcRenderer.on('audio-level', callback),
  
  // Remove listeners
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});