// preload-caja.js - Preload script para la vista de caja
const { contextBridge, ipcRenderer } = require('electron');

// Exponer APIs seguras al renderer
contextBridge.exposeInMainWorld('api', {
    // Validación y cobro
    validateTicket: (code) => ipcRenderer.invoke('caja:validate-ticket', code),
    validateTicketByCode: (code) => ipcRenderer.invoke('caja:validate-ticket', code),
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
    
    // Eventos en tiempo real
    onTicketUpdate: (callback) => {
        ipcRenderer.on('caja:ticket-updated', callback);
        return () => ipcRenderer.removeListener('caja:ticket-updated', callback);
    }
});