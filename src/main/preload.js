// src/main/preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  generateTicket: (ticketData) => ipcRenderer.invoke('generate-ticket', ticketData),
  validateTicket: (qrString) => ipcRenderer.invoke('validate-ticket', qrString),
  processPayment: (paymentData) => ipcRenderer.invoke('process-payment', paymentData),
  getStats: (dateRange) => ipcRenderer.invoke('get-stats', dateRange),
  forceSync: () => ipcRenderer.invoke('force-sync'),
  testPrinter: () => ipcRenderer.invoke('test-print'),
  testCalibration: () => ipcRenderer.invoke('test-calibration'),
  setPrintProfile: (profile) => ipcRenderer.invoke('set-print-profile', profile),
  getPrintProfile: () => ipcRenderer.invoke('get-print-profile'),
  getTicketPreview: (previewData) => ipcRenderer.invoke('get-ticket-preview', previewData),
  // --- Roles ---
  getRole: () => ipcRenderer.invoke('get-role'),
  setRole: (role) => ipcRenderer.invoke('set-role', role),
  onQrScanned: (callback) => {
    const subscription = (event, ...args) => callback(...args);
    ipcRenderer.on('qr-scanned', subscription);
    return () => ipcRenderer.removeListener('qr-scanned', subscription);
  },
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});