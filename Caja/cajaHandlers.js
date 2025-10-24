// cajaHandlers.js - Manejadores IPC para la vista de caja
require('dotenv').config();
const { ipcMain } = require('electron');
const CasinoDatabase = require('./database');
const path = require('path');
const { loginOperatorSupabase } = require('../supabaseClient');
const Database = require('better-sqlite3');

// Inicializar base de datos unificada
// Unificar a la ruta global por defecto: ./data/casino.db
const dbPath = process.env.CASINO_DB_PATH || process.env.SQLITE_DB_PATH || path.join(process.cwd(), 'data', 'casino.db');
const db = new CasinoDatabase(dbPath);

// Migración desde posibles bases legadas (tito.db / casino.db antiguos)
function migrateLegacyTicketsOnce() {
    try {
        const legacyPaths = [
            path.join(process.cwd(), 'data', 'tito.db'),
            path.join(process.cwd(), 'data', 'casino.db'),
            path.join(__dirname, 'data', 'casino.db'),
        ].filter(p => {
            try { return require('fs').existsSync(p); } catch { return false; }
        });
        legacyPaths.forEach(lp => {
            try {
                const legacy = new Database(lp, { readonly: true });
                // Intentar leer tabla tickets con columnas conocidas
                const info = legacy.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='tickets'").get();
                if (!info) { legacy.close(); return; }
                const rows = legacy.prepare('SELECT * FROM tickets').all();
                legacy.close();
                rows.forEach(r => {
                    // Mapear campos conocidos
                    const code = r.code || r.ticket_number || r.numero || r.id || String(r.ticket_id || '').padStart(8, '0');
                    const amount = Number(r.amount || r.monto || r.valor || 0);
                    const currency = r.currency || r.moneda || 'DOP';
                    const estado = (r.estado || r.status || 'activo').toLowerCase();
                    const mesa = r.mesa || r.table || r.pos || 'P01';
                    const fecha = r.fecha || r.created_at || r.createdAt || new Date().toISOString();
                    try { db.createTicket(code, amount, currency, mesa, fecha); } catch (_) {}
                    if (estado === 'usado' || estado === 'redeemed' || estado === 'pagado') {
                        try { db.updateTicketStatus(code, 'usado'); } catch (_) {}
                    }
                });
                console.log(`✅ Migración de tickets desde ${lp} completa: ${rows.length} registros`);
            } catch (err) {
                console.warn('Migración legacy saltada para', lp, err?.message);
            }
        });
    } catch (e) {
        console.warn('Migración legacy no ejecutada:', e?.message);
    }
}

migrateLegacyTicketsOnce();

// Registrar manejadores IPC
function registerCajaHandlers() {
    
    // Validar ticket
    ipcMain.handle('caja:validate-ticket', async (event, code) => {
        console.log('Validando ticket:', code);
        try {
            const result = db.validateTicket(code);
            return result;
        } catch (error) {
            console.error('Error validando ticket:', error);
            return {
                valid: false,
                reason: 'error',
                error: error.message
            };
        }
    });
    
    // Cobrar ticket
    ipcMain.handle('caja:redeem-ticket', async (event, code, cajeroId = 'CAJA-01') => {
        console.log('Cobrando ticket:', code);
        try {
            const result = db.redeemTicket(code, cajeroId);
            return result;
        } catch (error) {
            console.error('Error cobrando ticket:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });
    
    // Obtener estadísticas del día
    ipcMain.handle('caja:get-stats-today', async (event) => {
        try {
            const stats = db.getStatsToday();
            return stats;
        } catch (error) {
            console.error('Error obteniendo estadísticas:', error);
            return {
                ticketsHoy: 0,
                totalDOP: 0,
                totalUSD: 0,
                pendientes: 0
            };
        }
    });
    
    // Obtener tickets del día
    ipcMain.handle('caja:get-tickets-today', async (event) => {
        try {
            const tickets = db.getTicketsToday();
            return tickets;
        } catch (error) {
            console.error('Error obteniendo tickets:', error);
            return [];
        }
    });
    
    // Buscar ticket por código
    ipcMain.handle('caja:get-ticket', async (event, code) => {
        try {
            const ticket = db.getTicket(code);
            return ticket;
        } catch (error) {
            console.error('Error buscando ticket:', error);
            return null;
        }
    });
    
    // Obtener tickets por rango de fecha
    ipcMain.handle('caja:get-tickets-by-date', async (event, fechaInicio, fechaFin) => {
        try {
            const tickets = db.getTicketsByDateRange(fechaInicio, fechaFin);
            return tickets;
        } catch (error) {
            console.error('Error obteniendo tickets por fecha:', error);
            return [];
        }
    });
    
    // Cancelar ticket
    ipcMain.handle('caja:cancel-ticket', async (event, code, razon) => {
        console.log('Cancelando ticket:', code, razon);
        try {
            db.updateTicketStatus(code, 'cancelado');
            db.addAuditLog('ticket_cancelado', code, 'CAJA-01', `Ticket cancelado: ${razon}`);
            return { success: true };
        } catch (error) {
            console.error('Error cancelando ticket:', error);
            return { success: false, error: error.message };
        }
    });
    
    // Obtener logs de auditoría
    ipcMain.handle('caja:get-audit-logs', async (event, limit = 100) => {
        try {
            const logs = db.getAuditLogs(limit);
            return logs;
        } catch (error) {
            console.error('Error obteniendo logs:', error);
            return [];
        }
    });
    
    // Generar reporte de caja
    ipcMain.handle('caja:generate-cashier-report', async (event, cajeroId, fecha = null) => {
        try {
            const tickets = fecha ? 
                db.getTicketsByDateRange(fecha, fecha) :
                db.getTicketsToday();
            
            // Filtrar por cajero si se especifica
            const ticketsCajero = cajeroId ? 
                tickets.filter(t => t.cajero_id === cajeroId) :
                tickets;
            
            // Calcular totales
            const report = {
                cajero: cajeroId || 'TODOS',
                fecha: fecha || new Date().toISOString().split('T')[0],
                totalTickets: ticketsCajero.length,
                ticketsCobrados: 0,
                totalDOP: 0,
                totalUSD: 0,
                tickets: []
            };
            
            ticketsCajero.forEach(ticket => {
                if (ticket.estado === 'usado') {
                    report.ticketsCobrados++;
                    if (ticket.currency === 'USD') {
                        report.totalUSD += parseFloat(ticket.amount);
                    } else {
                        report.totalDOP += parseFloat(ticket.amount);
                    }
                }
                report.tickets.push({
                    code: ticket.code,
                    amount: ticket.amount,
                    currency: ticket.currency,
                    estado: ticket.estado,
                    fecha_cobro: ticket.fecha_cobro
                });
            });
            
            return report;
        } catch (error) {
            console.error('Error generando reporte:', error);
            return null;
        }
    });
    
    // Backup de base de datos
    ipcMain.handle('caja:backup-database', async (event) => {
        try {
            const backupPath = db.backup();
            return { success: true, path: backupPath };
        } catch (error) {
            console.error('Error haciendo backup:', error);
            return { success: false, error: error.message };
        }
    });

    // Login de operador de Caja
    ipcMain.handle('caja:login', async (event, payload) => {
        try {
            const { codigo, pin } = (payload || {});
            const useSupabase = String(process.env.USE_SUPABASE || '').toLowerCase() === 'true';
            if (useSupabase) {
                const result = await loginOperatorSupabase(codigo, pin);
                return result;
            } else {
                const result = db.authenticateOperator(codigo, pin);
                return result;
            }
        } catch (error) {
            console.error('Error en login de caja:', error);
            return { success: false, error: error.message };
        }
    });
    
    console.log('✅ Handlers de caja registrados (namespace caja:*)');
}

// Exportar función de registro
module.exports = { registerCajaHandlers };

// Limpiar al cerrar
process.on('exit', () => {
    if (db) {
        db.close();
    }
});