const { contextBridge, ipcRenderer } = require('electron');

// Bridge seguro: expone solo lo necesario al renderer
contextBridge.exposeInMainWorld('api', {
  // Tickets
  generateTicket: (data) => ipcRenderer.invoke('generate-ticket', data),
  // Valida QR (cadena completa) o por código vía handler de Caja
  validateTicket: (qr) => ipcRenderer.invoke('validate-ticket', qr),
  validateTicketByCode: (code) => ipcRenderer.invoke('caja:validate-ticket', code),
  processPayment: (payload) => ipcRenderer.invoke('process-payment', payload),

  // Impresora
  getPrintProfile: () => ipcRenderer.invoke('get-print-profile'),
  setPrintProfile: (profile) => ipcRenderer.invoke('set-print-profile', profile),
  getTicketPreview: (payload) => ipcRenderer.invoke('get-ticket-preview', payload),
  testPrinter: () => ipcRenderer.invoke('test-print'),
  testCalibration: () => ipcRenderer.invoke('test-calibration'),

  // Roles
  getRole: () => ipcRenderer.invoke('get-role'),
  setRole: (role) => ipcRenderer.invoke('set-role', role),

  // Navegación controlada por main
  openView: (view) => ipcRenderer.invoke('open-view', view),
  focusPanel: () => ipcRenderer.invoke('focus-panel'),
  closeCurrent: () => ipcRenderer.invoke('close-current'),

  // Configuración Caja (habilitar)
  getCajaEnabled: () => ipcRenderer.invoke('get-caja-enabled'),
  setCajaEnabled: (enabled) => ipcRenderer.invoke('set-caja-enabled', !!enabled),

  // Estadísticas del día (Panel)
  getStatsToday: () => ipcRenderer.invoke('caja:get-stats-today'),

  // Login Caja
  loginCaja: (codigo, pin) => ipcRenderer.invoke('caja:login', { codigo, pin }),

  // Login general
  loginApp: (username, password) => ipcRenderer.invoke('auth:login', { username, password }),
  getSession: () => ipcRenderer.invoke('auth:get-session'),
  logout: () => ipcRenderer.invoke('auth:logout'),

  // Gestión de usuarios
  listUsers: () => ipcRenderer.invoke('users:list'),
  createUser: (u) => ipcRenderer.invoke('users:create', u),
  setUserActive: (id, active) => ipcRenderer.invoke('users:set-active', id, active),
  setUserRole: (id, role) => ipcRenderer.invoke('users:set-role', id, role),
  setUserPassword: (id, pwd) => ipcRenderer.invoke('users:set-password', id, pwd),
  deleteUser: (id) => ipcRenderer.invoke('users:delete', id),

  // Scanner QR (si está disponible)
  onQrScanned: (callback) => {
    try {
      ipcRenderer.on('qr-scanned', (_event, ...args) => callback(...args));
    } catch (e) {
      console.warn('onQrScanned not available:', e);
    }
  },

  // Evento de menú: solicitud de logout
  onLogoutRequest: (callback) => {
    try {
      ipcRenderer.on('logout-request', () => callback());
    } catch (e) {
      console.warn('onLogoutRequest not available:', e);
    }
  }
});