// src/main/preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  generateTicket: (ticketData) => ipcRenderer.invoke('generate-ticket', ticketData),
  createVoucher: (data) => ipcRenderer.invoke('generate-ticket', data),
  getVoucher: (code) => ipcRenderer.invoke('caja:get-ticket', code),
  validateTicket: (qrString) => ipcRenderer.invoke('validate-ticket', qrString),
  processPayment: (paymentData) => ipcRenderer.invoke('process-payment', paymentData),
  getStats: (dateRange) => ipcRenderer.invoke('get-stats', dateRange),
  forceSync: () => ipcRenderer.invoke('force-sync'),
  testPrinter: () => ipcRenderer.invoke('test-print'),
  testCalibration: () => ipcRenderer.invoke('test-calibration'),
  setPrintProfile: (profile) => ipcRenderer.invoke('set-print-profile', profile),
  getPrintProfile: () => ipcRenderer.invoke('get-print-profile'),
  getTicketPreview: (previewData) => ipcRenderer.invoke('get-ticket-preview', previewData),
  printVoucher: (voucher) => ipcRenderer.invoke('print-voucher', voucher),
  listVouchers: () => ipcRenderer.invoke('list-vouchers'),
  // --- Vouchers (expuestos para Panel y vistas con este preload) ---
  validateVoucher: (code) => ipcRenderer.invoke('validate-voucher', code),
  redeemVoucher: (code) => ipcRenderer.invoke('redeem-voucher', code),
  // --- Roles ---
  getRole: () => ipcRenderer.invoke('get-role'),
  setRole: (role) => ipcRenderer.invoke('set-role', role),
  // --- Autenticación global ---
  getSession: () => ipcRenderer.invoke('auth:get-session'),
  loginApp: (username, password) => ipcRenderer.invoke('auth:login', { username, password }),
  logout: () => ipcRenderer.invoke('auth:logout'),
  // --- Navegación y control de ventanas ---
  openView: (view) => ipcRenderer.invoke('open-view', view),
  navigateTo: (view) => ipcRenderer.invoke('open-view', view),
  focusPanel: () => ipcRenderer.invoke('focus-panel'),
  closeCurrent: () => ipcRenderer.invoke('close-current'),
  exitApp: () => ipcRenderer.invoke('close-current'),
  onQrScanned: (callback) => {
    const subscription = (event, ...args) => callback(...args);
    ipcRenderer.on('qr-scanned', subscription);
    return () => ipcRenderer.removeListener('qr-scanned', subscription);
  },
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  },
  onStationFound: (callback) => ipcRenderer.on('station-found', (_event, station) => callback(station)),
  onStationLost: (callback) => ipcRenderer.on('station-lost', (_event, station) => callback(station))
});
