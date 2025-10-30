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
                    const stationNumber = (() => { try { return parseInt(String(mesa).replace(/\D/g, '')) || 1; } catch { return 1; } })();
                    try { db.createVoucher(amount, currency, 'LEGACY', stationNumber, null); } catch (_) {}
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
    
    // Validar ticket/voucher por código humano (PREV-XXXXXX)
    ipcMain.handle('caja:validate-ticket', async (event, code) => {
        console.log('Validando ticket:', code);
        try {
            const normalized = String(code || '').toUpperCase().trim();
            // Primero intentar vía mapping de voucher
            const voucher = (typeof db.getVoucherByCode === 'function') ? db.getVoucherByCode(normalized) : null;
            if (!voucher) {
                const v = db.validateTicket(normalized);
                if (!v.valid) {
                    return { success: false, error: v.reason || 'Voucher no encontrado', message: 'Voucher no encontrado', valid: false };
                }
                return { success: true, estado: v.ticket.estado, ticket: v.ticket };
            }

            if (voucher.status !== 'active') {
                const estado = voucher.status === 'redeemed' ? 'canjeado' : (voucher.status === 'expired' ? 'expirado' : voucher.status);
                return { success: false, error: `Voucher ${estado === 'canjeado' ? 'ya fue usado' : 'no válido'}`, valid: false, estado, voucher };
            }

            if (voucher.expires_at && new Date(voucher.expires_at) < new Date()) {
                return { success: false, error: 'Voucher expirado', valid: false, estado: 'expirado', voucher };
            }

            return {
                success: true,
                valid: true,
                estado: 'emitido',
                voucher: {
                    code: voucher.voucher_code,
                    amount: voucher.amount,
                    currency: voucher.currency,
                    issued_at: voucher.issued_at,
                    status: voucher.status
                }
            };
        } catch (error) {
            console.error('Error validando ticket:', error);
            return { success: false, error: error.message };
        }
    });

    // Validación directa estilo "validate-voucher" (sin controles de rol)
    ipcMain.handle('caja:validate-voucher', async (event, voucherCode) => {
        console.log('==========================================');
        console.log('🔍 VALIDATE-VOUCHER LLAMADO');
        console.log('Código:', voucherCode);
        try {
            const senderTitle = (() => { try { return event?.sender?.getTitle?.(); } catch { return ''; } })();
            console.log('Usuario (title):', senderTitle);

            const normalized = String(voucherCode || '').toUpperCase().trim();
            let voucher = null;

            // Intentar leer directamente desde tabla vouchers si existe
            try {
                const info = db.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='vouchers'").get();
                if (info) {
                    const row = db.db.prepare('SELECT * FROM vouchers WHERE voucher_code = ?').get(normalized);
                    if (row) {
                        voucher = {
                            id: row.id || row.voucher_id || row.id,
                            voucher_code: row.voucher_code || normalized,
                            amount: Number(row.amount || row.monto || 0),
                            currency: row.currency || row.moneda || 'DOP',
                            status: (row.status || 'active').toLowerCase(),
                            issued_at: row.issued_at || row.fecha_emision || null,
                            expires_at: row.expires_at || row.fecha_expiracion || null
                        };
                    }
                }
            } catch (e) {
                // Si falla la tabla vouchers, seguimos con fallback
                console.warn('Fallback a tickets para validar voucher:', e?.message);
            }

            // Fallback: usar getVoucherByCode (mapeado a tickets)
            if (!voucher) {
                voucher = (typeof db.getVoucherByCode === 'function') ? db.getVoucherByCode(normalized) : null;
            }

            console.log('Voucher encontrado?', !!voucher);
            if (voucher) {
                console.log('  - Amount:', voucher.amount);
                console.log('  - Currency:', voucher.currency);
                console.log('  - Status:', voucher.status);
                console.log('  - Expires:', voucher.expires_at);
            }

            if (!voucher) {
                return { success: false, error: 'Voucher no encontrado', valid: false, message: 'Voucher no encontrado' };
            }
            if (voucher.status !== 'active') {
                const estado = voucher.status === 'redeemed' ? 'canjeado' : (voucher.status === 'expired' ? 'expirado' : voucher.status);
                return { success: false, error: `Voucher ${estado === 'canjeado' ? 'ya fue usado' : 'no válido'}`, valid: false, estado, message: `Voucher ${estado}` };
            }
            if (voucher.expires_at && new Date(voucher.expires_at) < new Date()) {
                return { success: false, error: 'Voucher expirado', valid: false, estado: 'expirado', message: 'Voucher expirado' };
            }
            // Enriquecer con mesa y operador desde tickets
            let mesa = 'N/A';
            let operador = 'N/A';
            try {
                const t = db.getTicket ? db.getTicket(voucher.voucher_code) : null;
                if (t) {
                    mesa = t.mesa_nombre || t.mesa || (t.mesa_id ? String(t.mesa_id) : 'N/A');
                    operador = t.created_by_username || t.operador_nombre || t.usuario_emision || t.created_by_email || t.operador_email || 'N/A';
                }
                console.log('  - Mesa:', mesa);
                console.log('  - Operador:', operador);
            } catch (e) {
                console.warn('No se pudo obtener mesa/operador:', e?.message);
            }

            return {
                success: true,
                valid: true,
                estado: 'emitido',
                voucher: {
                    code: voucher.voucher_code,
                    amount: voucher.amount,
                    currency: voucher.currency,
                    issued_at: voucher.issued_at,
                    status: voucher.status,
                    mesa: mesa,
                    operador: operador
                }
            };
        } catch (error) {
            console.error('❌ Error en validación:', error);
            console.error('Stack:', error?.stack);
            return { success: false, error: error.message, message: error.message };
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
            if (typeof db.getVoucherByCode === 'function') {
                const voucher = db.getVoucherByCode(code);
                return voucher;
            }
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

    // Listar últimos vouchers (desde tabla tickets)
    ipcMain.handle('list-vouchers', async () => {
        try {
            const rows = db.db.prepare(`
                SELECT code AS voucher_code, amount, currency, estado AS status, fecha_emision AS issued_at
                FROM tickets
                ORDER BY fecha_emision DESC
                LIMIT 20
            `).all();
            console.log('📋 Vouchers en BD:', rows.length);
            rows.forEach(v => {
                console.log(`   ${v.voucher_code}: ${v.currency} ${v.amount} (${v.status})`);
            });
            return rows;
        } catch (error) {
            console.error('Error listando vouchers:', error);
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
