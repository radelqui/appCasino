// src/main/preload.js
const { contextBridge, ipcRenderer } = require('electron');

// Exponer un objeto 'api' seguro al window del renderer
contextBridge.exposeInMainWorld('api', {
  // Funciones que invocan los handlers de ipcMain
  generateTicket: (ticketData) => ipcRenderer.invoke('generate-ticket', ticketData),
  validateTicket: (qrString) => ipcRenderer.invoke('validate-ticket', qrString),
  processPayment: (paymentData) => ipcRenderer.invoke('process-payment', paymentData),
  getStats: (dateRange) => ipcRenderer.invoke('get-stats', dateRange),
  forceSync: () => ipcRenderer.invoke('force-sync'),

  // Funciones para escuchar eventos desde el main process
  onQrScanned: (callback) => {
    const subscription = (event, ...args) => callback(...args);
    ipcRenderer.on('qr-scanned', subscription);
    return () => ipcRenderer.removeListener('qr-scanned', subscription);
  },

  // Función para limpiar todos los listeners de un canal
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});