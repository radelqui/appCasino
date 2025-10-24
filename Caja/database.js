// database.js - Manejo de base de datos SQLite para el sistema de vouchers
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

class CasinoDatabase {
    constructor(dbPath = null) {
        // Usar path por defecto o el proporcionado
        this.dbPath = dbPath || path.join(__dirname, 'casino.db');
        
        // Crear directorio si no existe
        const dir = path.dirname(this.dbPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        // Inicializar base de datos
        this.db = new Database(this.dbPath, { verbose: console.log });
        this.initDatabase();
    }

    initDatabase() {
        // Crear tabla de tickets
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS tickets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                code TEXT UNIQUE NOT NULL,
                amount DECIMAL(10,2) NOT NULL,
                currency TEXT CHECK(currency IN ('USD', 'DOP')) NOT NULL,
                mesa TEXT NOT NULL,
                estado TEXT CHECK(estado IN ('activo', 'usado', 'cancelado', 'expirado')) DEFAULT 'activo',
                fecha_emision DATETIME DEFAULT CURRENT_TIMESTAMP,
                fecha_cobro DATETIME,
                cajero_id TEXT,
                hash_seguridad TEXT NOT NULL,
                qr_data TEXT NOT NULL,
                sincronizado INTEGER DEFAULT 0,
                notas TEXT
            )
        `);

        // Crear tabla de operadores
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS operadores (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                codigo TEXT UNIQUE NOT NULL,
                nombre TEXT NOT NULL,
                pin TEXT NOT NULL,
                mesa_asignada TEXT,
                activo INTEGER DEFAULT 1,
                fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Crear tabla de auditoría completa
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS auditoria (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tipo_evento TEXT NOT NULL,
                ticket_code TEXT,
                usuario_id TEXT,
                descripcion TEXT,
                fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
                datos_adicionales TEXT,
                ip_address TEXT,
                user_agent TEXT,
                session_id TEXT,
                nivel_criticidad TEXT CHECK(nivel_criticidad IN ('BAJO', 'MEDIO', 'ALTO', 'CRITICO')) DEFAULT 'MEDIO',
                modulo TEXT,
                accion TEXT,
                resultado TEXT CHECK(resultado IN ('EXITO', 'FALLO', 'ADVERTENCIA')) DEFAULT 'EXITO'
            )
        `);

        // Crear tabla de configuración
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS configuracion (
                clave TEXT PRIMARY KEY,
                valor TEXT,
                actualizado DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Crear tabla de usuarios (login general)
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS usuarios (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                password_salt TEXT NOT NULL,
                role TEXT CHECK(role IN ('ADMIN','MESA','CAJA','AUDITOR')) NOT NULL,
                activo INTEGER DEFAULT 1,
                creado DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        // Asegurar columnas extra opcionales (email, last_login, metadata)
        this.ensureUserExtraColumns();

        // Asegurar esquema moderno de tickets si existe esquema legacy
        this.ensureTicketsSchema();

        // Crear índices para búsquedas rápidas
        this.db.exec(`
            CREATE INDEX IF NOT EXISTS idx_ticket_code ON tickets(code);
            CREATE INDEX IF NOT EXISTS idx_ticket_estado ON tickets(estado);
            CREATE INDEX IF NOT EXISTS idx_ticket_fecha ON tickets(fecha_emision);
            CREATE INDEX IF NOT EXISTS idx_auditoria_fecha ON auditoria(fecha);
            CREATE INDEX IF NOT EXISTS idx_usuario_username ON usuarios(username);
        `);

        // Insertar configuración inicial si no existe
        this.initConfig();

        // Asegurar usuario admin demo si no hay ninguno
        this.ensureDemoAdminUser();
    }

    initConfig() {
        const configs = {
            'casino_nombre': 'CORAL REEF CASINO',
            'casino_direccion': 'GRAN CASINO SOSÚA',
            'dias_expiracion': '365',
            'prefijo_ticket': 'PREV',
            'ultimo_numero': '1000',
            'tasa_usd_dop': '57.50'
        };

        const stmt = this.db.prepare('INSERT OR IGNORE INTO configuracion (clave, valor) VALUES (?, ?)');
        for (const [clave, valor] of Object.entries(configs)) {
            stmt.run(clave, valor);
        }
    }

    // ============= OPERACIONES DE TICKETS =============

    // Generar nuevo código de ticket
    generateTicketCode() {
        const prefijo = this.getConfig('prefijo_ticket') || 'PREV';
        const ultimoNumero = parseInt(this.getConfig('ultimo_numero') || '1000');
        const nuevoNumero = ultimoNumero + 1;
        
        // Actualizar último número
        this.setConfig('ultimo_numero', nuevoNumero.toString());
        
        return `${prefijo}-${nuevoNumero.toString().padStart(6, '0')}`;
    }

    // Crear nuevo ticket (método original)
    createTicketOriginal(data) {
        try {
            const code = data.code || this.generateTicketCode();
            const hash = this.generateHash(code, data.amount, data.currency);
            
            const stmt = this.db.prepare(`
                INSERT INTO tickets (
                    code, amount, currency, mesa, hash_seguridad, qr_data, notas
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `);
            
            const qrData = JSON.stringify({
                code,
                amount: data.amount,
                currency: data.currency,
                mesa: data.mesa,
                timestamp: Date.now(),
                hash: hash.substring(0, 8)
            });
            
            const result = stmt.run(
                code,
                data.amount,
                data.currency,
                data.mesa,
                hash,
                qrData,
                data.notas || null
            );
            
            // Registrar en auditoría
            this.addAuditLog('ticket_creado', code, data.mesa, `Ticket creado: ${data.currency} ${data.amount}`);
            
            return {
                success: true,
                ticketId: result.lastInsertRowid,
                code: code,
                hash: hash
            };
        } catch (error) {
            console.error('Error creando ticket:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Validar ticket
    validateTicket(code) {
        try {
            const stmt = this.db.prepare(`
                SELECT * FROM tickets WHERE code = ?
            `);
            
            const ticket = stmt.get(code.toUpperCase());
            
            if (!ticket) {
                return {
                    valid: false,
                    reason: 'not_found'
                };
            }
            
            if (ticket.estado === 'usado') {
                return {
                    valid: false,
                    reason: 'used',
                    ticket: ticket
                };
            }
            
            if (ticket.estado === 'cancelado') {
                return {
                    valid: false,
                    reason: 'cancelled',
                    ticket: ticket
                };
            }
            
            // Verificar expiración
            const fechaEmision = new Date(ticket.fecha_emision);
            const diasExpiracion = parseInt(this.getConfig('dias_expiracion') || '365');
            const fechaExpiracion = new Date(fechaEmision.getTime() + (diasExpiracion * 24 * 60 * 60 * 1000));
            
            if (new Date() > fechaExpiracion) {
                // Marcar como expirado
                this.updateTicketStatus(code, 'expirado');
                return {
                    valid: false,
                    reason: 'expired',
                    ticket: ticket
                };
            }
            
            return {
                valid: true,
                ticket: ticket
            };
        } catch (error) {
            console.error('Error validando ticket:', error);
            return {
                valid: false,
                reason: 'error',
                error: error.message
            };
        }
    }

    // Cobrar/Canjear ticket
    redeemTicket(code, cajeroId = 'CAJA-01') {
        try {
            // Primero validar
            const validation = this.validateTicket(code);
            
            if (!validation.valid) {
                return {
                    success: false,
                    reason: validation.reason,
                    message: 'Ticket no válido para cobro'
                };
            }
            
            // Actualizar estado a usado
            const stmt = this.db.prepare(`
                UPDATE tickets 
                SET estado = 'usado', 
                    fecha_cobro = CURRENT_TIMESTAMP,
                    cajero_id = ?
                WHERE code = ?
            `);
            
            stmt.run(cajeroId, code.toUpperCase());
            
            // Registrar en auditoría
            this.addAuditLog(
                'ticket_cobrado', 
                code, 
                cajeroId, 
                `Ticket cobrado: ${validation.ticket.currency} ${validation.ticket.amount}`
            );
            
            return {
                success: true,
                ticket: validation.ticket
            };
        } catch (error) {
            console.error('Error cobrando ticket:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Actualizar estado de ticket
    updateTicketStatus(code, estado) {
        const stmt = this.db.prepare(`
            UPDATE tickets SET estado = ? WHERE code = ?
        `);
        return stmt.run(estado, code.toUpperCase());
    }

    // ============= CONSULTAS Y REPORTES =============

    // Obtener ticket por código
    getTicket(code) {
        const stmt = this.db.prepare('SELECT * FROM tickets WHERE code = ?');
        return stmt.get(code.toUpperCase());
    }

    // Obtener tickets del día
    getTicketsToday() {
        const stmt = this.db.prepare(`
            SELECT * FROM tickets 
            WHERE DATE(fecha_emision) = DATE('now', 'localtime')
            ORDER BY fecha_emision DESC
        `);
        return stmt.all();
    }

    // Obtener estadísticas del día
    getStatsToday() {
        const tickets = this.getTicketsToday();
        
        const stats = {
            ticketsHoy: 0,
            totalDOP: 0,
            totalUSD: 0,
            pendientes: 0,
            cobrados: 0,
            cancelados: 0
        };
        
        tickets.forEach(ticket => {
            stats.ticketsHoy++;
            
            if (ticket.estado === 'usado') {
                stats.cobrados++;
                if (ticket.currency === 'USD') {
                    stats.totalUSD += parseFloat(ticket.amount);
                } else {
                    stats.totalDOP += parseFloat(ticket.amount);
                }
            } else if (ticket.estado === 'activo') {
                stats.pendientes++;
            } else if (ticket.estado === 'cancelado') {
                stats.cancelados++;
            }
        });
        
        return stats;
    }

    // Obtener tickets por rango de fecha
    getTicketsByDateRange(fechaInicio, fechaFin) {
        const stmt = this.db.prepare(`
            SELECT * FROM tickets 
            WHERE fecha_emision BETWEEN ? AND ?
            ORDER BY fecha_emision DESC
        `);
        return stmt.all(fechaInicio, fechaFin);
    }

    // Obtener reporte de mesa
    getReportByMesa(mesa, fecha = null) {
        let query = 'SELECT * FROM tickets WHERE mesa = ?';
        const params = [mesa];
        
        if (fecha) {
            query += ' AND DATE(fecha_emision) = DATE(?)';
            params.push(fecha);
        }
        
        const stmt = this.db.prepare(query);
        return stmt.all(...params);
    }

    // ============= AUDITORÍA COMPLETA =============

    addAuditLog(tipoEvento, ticketCode, usuarioId, descripcion, datosAdicionales = null, opciones = {}) {
        try {
            const stmt = this.db.prepare(`
                INSERT INTO auditoria (
                    tipo_evento, ticket_code, usuario_id, descripcion, datos_adicionales,
                    ip_address, user_agent, session_id, nivel_criticidad, modulo, accion, resultado
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            
            const result = stmt.run(
                tipoEvento,
                ticketCode,
                usuarioId,
                descripcion,
                datosAdicionales ? JSON.stringify(datosAdicionales) : null,
                opciones.ip_address || null,
                opciones.user_agent || null,
                opciones.session_id || null,
                opciones.nivel_criticidad || 'MEDIO',
                opciones.modulo || null,
                opciones.accion || tipoEvento,
                opciones.resultado || 'EXITO'
            );
            
            return { success: true, id: result.lastInsertRowid };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Auditoría específica para operaciones críticas
    addCriticalAuditLog(tipoEvento, usuarioId, descripcion, datosAdicionales = null, opciones = {}) {
        return this.addAuditLog(tipoEvento, null, usuarioId, descripcion, datosAdicionales, {
            ...opciones,
            nivel_criticidad: 'CRITICO'
        });
    }

    // Auditoría para cambios de configuración
    addConfigAuditLog(clave, valorAnterior, valorNuevo, usuarioId, opciones = {}) {
        return this.addAuditLog('config_change', null, usuarioId, 
            `Configuración ${clave} cambiada`, 
            { clave, valor_anterior: valorAnterior, valor_nuevo: valorNuevo },
            { ...opciones, nivel_criticidad: 'ALTO', modulo: 'CONFIGURACION', accion: 'UPDATE' }
        );
    }

    // Auditoría para accesos al sistema
    addLoginAuditLog(usuarioId, exito, detalles = null, opciones = {}) {
        return this.addAuditLog('login_attempt', null, usuarioId,
            exito ? 'Login exitoso' : 'Login fallido',
            detalles,
            { 
                ...opciones, 
                nivel_criticidad: exito ? 'BAJO' : 'ALTO',
                modulo: 'AUTENTICACION',
                accion: 'LOGIN',
                resultado: exito ? 'EXITO' : 'FALLO'
            }
        );
    }

    // Obtener logs de auditoría
    getAuditLogs(limit = 100, filtros = {}) {
        try {
            let query = `
                SELECT id, tipo_evento, ticket_code, usuario_id, descripcion, fecha, 
                       datos_adicionales, ip_address, user_agent, session_id, 
                       nivel_criticidad, modulo, accion, resultado
                FROM auditoria 
                WHERE 1=1
            `;
            const params = [];

            // Filtros opcionales
            if (filtros.usuario_id) {
                query += ` AND usuario_id = ?`;
                params.push(filtros.usuario_id);
            }
            
            if (filtros.tipo_evento) {
                query += ` AND tipo_evento = ?`;
                params.push(filtros.tipo_evento);
            }
            
            if (filtros.nivel_criticidad) {
                query += ` AND nivel_criticidad = ?`;
                params.push(filtros.nivel_criticidad);
            }
            
            if (filtros.modulo) {
                query += ` AND modulo = ?`;
                params.push(filtros.modulo);
            }
            
            if (filtros.fecha_desde) {
                query += ` AND fecha >= ?`;
                params.push(filtros.fecha_desde);
            }
            
            if (filtros.fecha_hasta) {
                query += ` AND fecha <= ?`;
                params.push(filtros.fecha_hasta);
            }

            query += ` ORDER BY fecha DESC LIMIT ?`;
            params.push(limit);

            const stmt = this.db.prepare(query);
            const logs = stmt.all(...params);
            
            // Parsear datos adicionales
            return logs.map(log => ({
                ...log,
                datos_adicionales: log.datos_adicionales ? JSON.parse(log.datos_adicionales) : null
            }));
        } catch (error) {
            console.error('Error obteniendo logs de auditoría:', error);
            return [];
        }
    }

    // Obtener estadísticas de auditoría
    getAuditStats(fechaDesde = null, fechaHasta = null) {
        try {
            let whereClause = '';
            const params = [];
            
            if (fechaDesde && fechaHasta) {
                whereClause = 'WHERE fecha BETWEEN ? AND ?';
                params.push(fechaDesde, fechaHasta);
            }
            
            const stats = this.db.prepare(`
                SELECT 
                    COUNT(*) as total_eventos,
                    COUNT(DISTINCT usuario_id) as usuarios_activos,
                    SUM(CASE WHEN nivel_criticidad = 'CRITICO' THEN 1 ELSE 0 END) as eventos_criticos,
                    SUM(CASE WHEN nivel_criticidad = 'ALTO' THEN 1 ELSE 0 END) as eventos_altos,
                    SUM(CASE WHEN resultado = 'FALLO' THEN 1 ELSE 0 END) as eventos_fallidos
                FROM auditoria ${whereClause}
            `).get(...params);
            
            const eventosPorTipo = this.db.prepare(`
                SELECT tipo_evento, COUNT(*) as cantidad
                FROM auditoria ${whereClause}
                GROUP BY tipo_evento
                ORDER BY cantidad DESC
            `).all(...params);
            
            const eventosPorModulo = this.db.prepare(`
                SELECT modulo, COUNT(*) as cantidad
                FROM auditoria ${whereClause}
                WHERE modulo IS NOT NULL
                GROUP BY modulo
                ORDER BY cantidad DESC
            `).all(...params);
            
            return {
                resumen: stats,
                por_tipo: eventosPorTipo,
                por_modulo: eventosPorModulo
            };
        } catch (error) {
            console.error('Error obteniendo estadísticas de auditoría:', error);
            return null;
        }
    }

    // ============= CONFIGURACIÓN =============

    // Obtener configuración
    getConfig(clave) {
        const stmt = this.db.prepare('SELECT valor FROM configuracion WHERE clave = ?');
        const row = stmt.get(clave);
        return row ? row.valor : null;
    }

    // Establecer configuración
    setConfig(clave, valor) {
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO configuracion (clave, valor, actualizado)
            VALUES (?, ?, CURRENT_TIMESTAMP)
        `);
        return stmt.run(clave, valor);
    }

    // ============= USUARIOS / OPERADORES =============
    authenticateOperator(codigo, pin) {
        try {
            const stmt = this.db.prepare(`
                SELECT id, codigo, nombre, mesa_asignada, activo
                FROM operadores
                WHERE codigo = ? AND pin = ? AND activo = 1
            `);
            const op = stmt.get(String(codigo).trim(), String(pin).trim());
            if (!op) {
                return { success: false, error: 'Credenciales inválidas o usuario inactivo' };
            }
            // Registrar auditoría de login
            try { this.addAuditLog('login_caja', null, op.codigo, 'Login de operador en Caja'); } catch {}
            return { success: true, operator: op };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // ============= USUARIOS (LOGIN GENERAL) =============
    hashPassword(password, salt = null) {
        const actualSalt = salt || crypto.randomBytes(16).toString('hex');
        const hash = crypto.pbkdf2Sync(String(password), actualSalt, 100000, 64, 'sha512').toString('hex');
        return { hash, salt: actualSalt };
    }

    createUser(username, password, role = 'MESA', activo = 1, email = null) {
        const { hash, salt } = this.hashPassword(password);
        const stmt = this.db.prepare(`
            INSERT INTO usuarios (username, password_hash, password_salt, role, activo, email)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        try {
            stmt.run(String(username).trim(), hash, salt, String(role).toUpperCase(), activo ? 1 : 0, email || null);
            return { success: true };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    getUserByUsername(username) {
        return this.db.prepare(`
            SELECT id, username, password_hash, password_salt, role, activo
            FROM usuarios WHERE username = ?
        `).get(String(username).trim());
    }

    authenticateUserLocal(username, password) {
        try {
            const user = this.getUserByUsername(username);
            if (!user || !user.activo) {
                return { success: false, error: 'Usuario inexistente o inactivo' };
            }
            const { hash } = this.hashPassword(password, user.password_salt);
            if (hash !== user.password_hash) {
                return { success: false, error: 'Contraseña incorrecta' };
            }
            try { 
                this.addAuditLog('login_app', null, user.username, 'Login general en app');
                // Registrar último acceso
                this.db.prepare('UPDATE usuarios SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);
            } catch {}
            return { success: true, user: { id: user.id, username: user.username, role: user.role } };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // --- Gestión de usuarios (CRUD básico) ---
    listUsers() {
        try {
            const stmt = this.db.prepare(`
                SELECT id, username, role, activo, creado
                FROM usuarios
                ORDER BY username ASC
            `);
            const rows = stmt.all();
            return { success: true, users: rows };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    setUserActive(id, active) {
        try {
            const stmt = this.db.prepare(`UPDATE usuarios SET activo = ? WHERE id = ?`);
            stmt.run(active ? 1 : 0, Number(id));
            return { success: true };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    setUserRole(id, role) {
        try {
            const stmt = this.db.prepare(`UPDATE usuarios SET role = ? WHERE id = ?`);
            stmt.run(String(role).toUpperCase(), Number(id));
            return { success: true };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    setUserPassword(id, newPassword) {
        try {
            const { hash, salt } = this.hashPassword(newPassword);
            const stmt = this.db.prepare(`
                UPDATE usuarios SET password_hash = ?, password_salt = ? WHERE id = ?
            `);
            stmt.run(hash, salt, Number(id));
            return { success: true };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    deleteUser(id) {
        try {
            const stmt = this.db.prepare(`
                DELETE FROM usuarios WHERE id = ?
            `);
            stmt.run(Number(id));
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    ensureUserExtraColumns() {
        try {
            const cols = this.db.prepare("PRAGMA table_info('usuarios')").all().map(c => c.name);
            const added = [];
            if (!cols.includes('email')) {
                this.db.exec("ALTER TABLE usuarios ADD COLUMN email TEXT");
                added.push('email');
            }
            if (!cols.includes('last_login')) {
                this.db.exec("ALTER TABLE usuarios ADD COLUMN last_login DATETIME");
                added.push('last_login');
            }
            if (!cols.includes('metadata')) {
                this.db.exec("ALTER TABLE usuarios ADD COLUMN metadata TEXT");
                added.push('metadata');
            }
            if (added.length) {
                try {
                    this.addConfigAuditLog('usuarios_migracion', null, `Añadidas columnas: ${added.join(', ')}`, 'system');
                } catch {}
            }
        } catch (e) {
            console.error('ensureUserExtraColumns error:', e);
        }
    }

    ensureDemoAdminUser() {
        try {
            const count = this.db.prepare('SELECT COUNT(1) as c FROM usuarios').get()?.c || 0;
            if (count === 0) {
                this.createUser('admin@local', 'admin1234', 'ADMIN', 1);
            }
        } catch (e) {}
    }

    // ============= UTILIDADES =============

    // Generar hash de seguridad
    generateHash(code, amount, currency) {
        const secret = process.env.QR_SECRET || 'CASINO_SECRET_2024';
        const data = `${code}|${amount}|${currency}|${Date.now()}|${secret}`;
        return crypto.createHash('sha256').update(data).digest('hex');
    }

    // Limpiar tickets expirados
    cleanExpiredTickets() {
        const diasExpiracion = parseInt(this.getConfig('dias_expiracion') || '365');
        
        const stmt = this.db.prepare(`
            UPDATE tickets 
            SET estado = 'expirado'
            WHERE estado = 'activo' 
            AND datetime(fecha_emision) < datetime('now', '-${diasExpiracion} days')
        `);
        
        const result = stmt.run();
        return result.changes;
    }

    // Backup de base de datos
    backup(backupPath = null) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const defaultPath = path.join(__dirname, 'backups', `casino_backup_${timestamp}.db`);
        const targetPath = backupPath || defaultPath;
        
        // Crear directorio de backup si no existe
        const dir = path.dirname(targetPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        // Realizar backup
        this.db.backup(targetPath);
        
        return targetPath;
    }

    // Cerrar conexión
    close() {
        this.db.close();
    }

    // Verificación y migración de esquema legacy de tickets
    ensureTicketsSchema() {
        try {
            const cols = this.db.prepare("PRAGMA table_info('tickets')").all().map(c => c.name);
            const isLegacy = cols.includes('ticket_number') || !cols.includes('code') || !cols.includes('amount') || !cols.includes('currency') || !cols.includes('mesa');
            if (!isLegacy) {
                return; // Esquema ya moderno
            }

            // Crear nueva tabla con el esquema moderno
            this.db.exec(`
                CREATE TABLE IF NOT EXISTS tickets_v2 (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    code TEXT UNIQUE NOT NULL,
                    amount DECIMAL(10,2) NOT NULL,
                    currency TEXT CHECK(currency IN ('USD', 'DOP')) NOT NULL,
                    mesa TEXT NOT NULL,
                    estado TEXT CHECK(estado IN ('activo', 'usado', 'cancelado', 'expirado')) DEFAULT 'activo',
                    fecha_emision DATETIME DEFAULT CURRENT_TIMESTAMP,
                    fecha_cobro DATETIME,
                    cajero_id TEXT,
                    hash_seguridad TEXT NOT NULL,
                    qr_data TEXT NOT NULL,
                    sincronizado INTEGER DEFAULT 0,
                    notas TEXT
                )
            `);

            // Copiar datos legacy a tickets_v2 con mapeo
            const legacyRows = this.db.prepare('SELECT * FROM tickets').all();
            const insertStmt = this.db.prepare(`
                INSERT INTO tickets_v2 (code, amount, currency, mesa, estado, fecha_emision, fecha_cobro, cajero_id, hash_seguridad, qr_data, sincronizado, notas)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            const insertTx = this.db.transaction(rows => {
                for (const row of rows) {
                    const code = (row.ticket_number || row.code || '').toString().toUpperCase();
                    const amount = row.valor ?? row.amount ?? 0;
                    const currency = row.moneda ?? row.currency ?? 'DOP';
                    const mesa = row.mesa_id ?? row.mesa ?? 'M01';
                    const estadoLegacy = row.estado ?? 'emitido';
                    const estado = estadoLegacy === 'emitido' ? 'activo'
                                  : estadoLegacy === 'canjeado' ? 'usado'
                                  : estadoLegacy;
                    const fecha_emision = row.created_at ?? row.fecha_emision ?? new Date().toISOString();
                    const fecha_cobro = row.redeemed_at ?? row.fecha_cobro ?? null;
                    const cajero_id = row.usuario_canje ?? row.cajero_id ?? null;
                    const hash_seguridad = row.hash_seguridad ?? '';
                    const qr_data = row.qr_data ?? '';
                    const sincronizado = row.sincronizado ?? 0;
                    const notas = row.notas ?? null;

                    insertStmt.run(code, amount, currency, mesa, estado, fecha_emision, fecha_cobro, cajero_id, hash_seguridad, qr_data, sincronizado, notas);
                }
            });
            insertTx(legacyRows);

            // Renombrar tablas: preservar backup de legacy
            this.db.exec(`ALTER TABLE tickets RENAME TO tickets_legacy`);
            this.db.exec(`ALTER TABLE tickets_v2 RENAME TO tickets`);

            // Crear índices en la tabla nueva
            this.db.exec(`
                CREATE INDEX IF NOT EXISTS idx_ticket_code ON tickets(code);
                CREATE INDEX IF NOT EXISTS idx_ticket_estado ON tickets(estado);
                CREATE INDEX IF NOT EXISTS idx_ticket_fecha ON tickets(fecha_emision);
            `);
        } catch (error) {
            console.error('Error asegurando/migrando esquema de tickets:', error);
        }
    }

    // === MÉTODOS DE COMPATIBILIDAD CON SQLiteDB ===
    
    // Método de compatibilidad para crear tickets (acepta objeto estilo SQLiteDB o argumentos posicionales)
     createTicket(dataOrCode, amountArg, currencyArg, mesaArg, fechaArg) {
         try {
             // Si se pasó un objeto (estilo SQLiteDB o moderno)
             if (typeof dataOrCode === 'object' && dataOrCode !== null && arguments.length === 1) {
                 const data = dataOrCode;
                 const ticketData = {
                     code: data.ticket_number || data.code || undefined,
                     amount: (data.amount ?? data.valor),
                     currency: (data.currency ?? data.moneda),
                     mesa: (data.mesa ?? data.mesa_id ?? 'M01'),
                     notas: data.notas || (data.usuario_emision ? `Usuario: ${data.usuario_emision}` : null)
                 };
                 const result = this.createTicketOriginal(ticketData);
                 if (result.success) {
                     return {
                         id: result.ticketId,
                         ticket_number: result.code,
                         valor: ticketData.amount,
                         moneda: ticketData.currency,
                         estado: 'emitido',
                         created_at: new Date().toISOString()
                     };
                 } else {
                     throw new Error(result.error);
                 }
             }
             
             // Si se pasó con argumentos posicionales (code, amount, currency, mesa, fecha)
             let code = (typeof dataOrCode === 'string' ? dataOrCode : undefined);
             if (!code) code = this.generateTicketCode();
             const safeAmount = (typeof amountArg === 'number' && isFinite(amountArg)) ? amountArg : 0;
             const safeCurrency = (typeof currencyArg === 'string' && currencyArg) ? currencyArg : 'DOP';
             const safeMesa = (typeof mesaArg === 'string' && mesaArg) ? mesaArg : 'M01';
             const ticketData = {
                 code,
                 amount: safeAmount,
                 currency: safeCurrency,
                 mesa: safeMesa,
                 notas: null
             };
             const result = this.createTicketOriginal(ticketData);
             if (result.success) {
                 return {
                     id: result.ticketId,
                     ticket_number: result.code,
                     valor: ticketData.amount,
                     moneda: ticketData.currency,
                     estado: 'emitido',
                     created_at: new Date().toISOString()
                 };
             } else {
                 throw new Error(result.error);
             }
         } catch (error) {
             console.error('Error creando ticket (compatibilidad):', error);
             throw error;
         }
     }


    
    // Alias para compatibilidad con ticketHandlers.js
    findTicketByNumber(ticket_number) {
        try {
            const stmt = this.db.prepare(`SELECT * FROM tickets WHERE code = ? LIMIT 1`);
            return stmt.get(ticket_number.toUpperCase()) || null;
        } catch (error) {
            console.error('Error buscando ticket:', error);
            return null;
        }
    }

    // Alias para compatibilidad con ticketHandlers.js
    getTicketByNumber(ticket_number) {
        return this.findTicketByNumber(ticket_number);
    }

    // Método de compatibilidad para actualizar estado de ticket
    updateTicketStatus(ticket_number, estado, usuario_canje = null) {
        try {
            const redeemed_at = estado === 'canjeado' ? new Date().toISOString() : null;
            const stmt = this.db.prepare(`
                UPDATE tickets 
                SET estado = ?, 
                    cajero_id = COALESCE(?, cajero_id), 
                    fecha_cobro = COALESCE(?, fecha_cobro)
                WHERE code = ? AND estado IN ('activo','emitido')
            `);
            const info = stmt.run(estado, usuario_canje, redeemed_at, ticket_number.toUpperCase());
            return info; // { changes }
        } catch (error) {
            console.error('Error actualizando estado de ticket:', error);
            return { changes: 0 };
        }
    }
}

module.exports = CasinoDatabase;

// Ejemplo de uso si se ejecuta directamente
if (require.main === module) {
    const db = new CasinoDatabase();
    
    // Crear ticket de prueba
    const result = db.createTicket({
        amount: 500.00,
        currency: 'DOP',
        mesa: 'P01',
        notas: 'Ticket de prueba'
    });
    
    console.log('Ticket creado:', result);
    
    // Validar ticket
    if (result.success) {
        const validation = db.validateTicket(result.code);
        console.log('Validación:', validation);
    }
    
    // Estadísticas
    const stats = db.getStatsToday();
    console.log('Estadísticas del día:', stats);
    
    db.close();
}