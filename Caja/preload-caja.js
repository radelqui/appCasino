// preload-caja.js - Preload script para la vista de caja
const { contextBridge, ipcRenderer } = require('electron');

// Exponer APIs seguras al renderer
contextBridge.exposeInMainWorld('api', {
    // Validación y cobro
        validateTicket: (code) => ipcRenderer.invoke('caja:validate-ticket', code),
        validateVoucher: (code) => ipcRenderer.invoke('caja:validate-voucher', code),
        listVouchers: () => ipcRenderer.invoke('list-vouchers'),
    // Canje genérico de voucher (handler global)
    redeemVoucher: (code) => ipcRenderer.invoke('redeem-voucher', code),
    redeemTicket: (code, cajeroId) => ipcRenderer.invoke('caja:redeem-ticket', code, cajeroId),
    cancelTicket: (code, razon) => ipcRenderer.invoke('caja:cancel-ticket', code, razon),
    
    // Consultas
    getTicket: (code) => ipcRenderer.invoke('caja:get-ticket', code),
    getStatsToday: () => ipcRenderer.invoke('caja:get-stats-today'),
    getTicketsToday: () => ipcRenderer.invoke('caja:get-tickets-today'),
    getTicketsByDate: (fechaInicio, fechaFin) => 
        ipcRenderer.invoke('caja:get-tickets-by-date', fechaInicio, fechaFin),
    
    // Reportes
    generateCashierReport: (cajeroId, fecha) => 
        ipcRenderer.invoke('caja:generate-cashier-report', cajeroId, fecha),
    getAuditLogs: (limit) => ipcRenderer.invoke('caja:get-audit-logs', limit),
    
    // Utilidades
    backupDatabase: () => ipcRenderer.invoke('caja:backup-database'),

    // --- Roles ---
    getRole: () => ipcRenderer.invoke('get-role'),

    // --- Autenticación global de la app ---
    getSession: () => ipcRenderer.invoke('auth:get-session'),
    login: (credentials) => ipcRenderer.invoke('auth:login', credentials),
    // Compat: panel.html usa loginApp(username, password)
    loginApp: (username, password) => ipcRenderer.invoke('auth:login', { username, password }),
    logout: () => ipcRenderer.invoke('auth:logout'),
    
    // Eventos en tiempo real
    onTicketUpdate: (callback) => {
        ipcRenderer.on('caja:ticket-updated', callback);
        return () => ipcRenderer.removeListener('caja:ticket-updated', callback);
    },

    // --- Navegación y control de ventana usados por Caja ---
    navigateTo: (view) => ipcRenderer.invoke('open-view', view),
    focusPanel: () => ipcRenderer.invoke('focus-panel'),
    closeCurrent: () => ipcRenderer.invoke('close-current'),
    exitApp: () => ipcRenderer.invoke('close-current')
});
