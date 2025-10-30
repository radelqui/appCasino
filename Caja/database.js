// database.js - Base de datos local (SQLite) para vouchers/usuarios/caja
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');

class CasinoDatabase {
  constructor(dbPath = null) {
    this.dbPath = dbPath || path.join(__dirname, 'data', 'casino.db');
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    this.db = new Database(this.dbPath);
    this.initDatabase();
  }

  initDatabase() {
    // Tickets (esquema moderno)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        currency TEXT CHECK(currency IN ('USD', 'DOP')) NOT NULL,
        mesa TEXT,
        estado TEXT CHECK(estado IN ('activo', 'emitido', 'usado', 'cancelado', 'expirado')) DEFAULT 'emitido',
        fecha_emision DATETIME DEFAULT CURRENT_TIMESTAMP,
        fecha_cobro DATETIME,
        cajero_id TEXT,
        hash_seguridad TEXT,
        qr_data TEXT,
        sincronizado INTEGER DEFAULT 0,
        notas TEXT,
        -- Campos de compatibilidad con otras variantes
        issued_by_user_id TEXT,
        issued_at_station_id TEXT,
        redeemed_by_user_id TEXT,
        redeemed_at_station_id TEXT,
        redeemed_at TEXT
      );
    `);

    // Operadores de Caja
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS operadores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        codigo TEXT UNIQUE NOT NULL,
        nombre TEXT NOT NULL,
        pin TEXT NOT NULL,
        mesa_asignada TEXT,
        activo INTEGER DEFAULT 1,
        fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Auditoría
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
        nivel_criticidad TEXT CHECK(nivel_criticidad IN ('BAJO','MEDIO','ALTO','CRITICO')) DEFAULT 'MEDIO',
        modulo TEXT,
        accion TEXT,
        resultado TEXT CHECK(resultado IN ('EXITO','FALLO','ADVERTENCIA')) DEFAULT 'EXITO'
      );
    `);

    // Configuración
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS configuracion (
        clave TEXT PRIMARY KEY,
        valor TEXT,
        actualizado DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Usuarios (login general)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        role TEXT CHECK(role IN ('ADMIN','MESA','CAJA','AUDITOR')) NOT NULL,
        activo INTEGER DEFAULT 1,
        creado DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Índices
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_ticket_code ON tickets(code);
      CREATE INDEX IF NOT EXISTS idx_ticket_estado ON tickets(estado);
      CREATE INDEX IF NOT EXISTS idx_ticket_fecha ON tickets(fecha_emision);
      CREATE INDEX IF NOT EXISTS idx_auditoria_fecha ON auditoria(fecha);
      CREATE INDEX IF NOT EXISTS idx_usuario_username ON usuarios(username);
    `);

    this.ensureUserExtraColumns();
    this.ensureTicketsSchema();
    this.initConfig();
    this.ensureDemoAdminUser();
  }

  // Config inicial
  initConfig() {
    const defaults = {
      casino_nombre: 'CORAL REEF CASINO',
      casino_direccion: 'GRAN CASINO SOSÚA',
      dias_expiracion: '365',
      prefijo_ticket: 'PREV',
      ultimo_numero: '1000',
      tasa_usd_dop: '57.50'
    };
    const stmt = this.db.prepare('INSERT OR IGNORE INTO configuracion (clave, valor) VALUES (?, ?)');
    for (const [k, v] of Object.entries(defaults)) stmt.run(k, v);
  }

  // ===== Utilidades de configuración =====
  getConfig(clave) {
    const row = this.db.prepare('SELECT valor FROM configuracion WHERE clave = ?').get(clave);
    return row ? row.valor : null;
  }
  setConfig(clave, valor) {
    return this.db.prepare('INSERT OR REPLACE INTO configuracion (clave, valor, actualizado) VALUES (?, ?, CURRENT_TIMESTAMP)').run(clave, valor);
  }

  // ===== Tickets =====
  generateTicketCode() {
    const prefijo = this.getConfig('prefijo_ticket') || 'PREV';
    const ultimoNumero = parseInt(this.getConfig('ultimo_numero') || '1000');
    const nuevoNumero = ultimoNumero + 1;
    this.setConfig('ultimo_numero', String(nuevoNumero));
    return `${prefijo}-${String(nuevoNumero).padStart(6, '0')}`;
  }

  generateHash(code, amount, currency) {
    const secret = process.env.QR_SECRET || 'CASINO_SECRET_2024';
    return crypto.createHash('sha256').update(`${code}|${amount}|${currency}|${Date.now()}|${secret}`).digest('hex');
  }

  createTicketOriginal(data) {
    const code = data.code || this.generateTicketCode();
    const hash = this.generateHash(code, data.amount, data.currency);
    const qrData = JSON.stringify({ code, amount: data.amount, currency: data.currency, mesa: data.mesa, timestamp: Date.now(), hash: hash.slice(0, 8) });
    const stmt = this.db.prepare('INSERT INTO tickets (code, amount, currency, mesa, hash_seguridad, qr_data, notas) VALUES (?, ?, ?, ?, ?, ?, ?)');
    const res = stmt.run(code, data.amount, data.currency, data.mesa || null, hash, qrData, data.notas || null);
    try { this.addAuditLog('ticket_creado', code, data.mesa || null, `Ticket creado: ${data.currency} ${data.amount}`); } catch {}
    return { success: true, ticketId: res.lastInsertRowid, code, hash };
  }

  // ===== Vouchers (compatibilidad sobre la tabla tickets) =====
  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  generateVoucherCode() {
    // Reutiliza el generador de tickets para mantener formato consistente
    return this.generateTicketCode();
  }

  hashQRData(data) {
    const secret = process.env.QR_SECRET || 'CASINO_SECRET_2024';
    return crypto.createHmac('sha256', secret).update(String(data)).digest('hex');
  }

  /**
   * Crea un voucher sobre el mismo esquema de tickets.
   * Mantiene compatibilidad con handlers que esperan createVoucher.
   * @param {number} amount
   * @param {string} currency
   * @param {string} userId
   * @param {number|string} stationId
   * @param {string|null} customerName
   * @param {string|null} codeOpcional - Código del voucher (para alinear con QR)
   */
  createVoucher(amount, currency, userId, stationId, customerName = null, codeOpcional = null) {
    const mesaLabel = (() => {
      try {
        if (stationId == null) return null;
        const n = parseInt(String(stationId).replace(/\D/g, ''));
        return isNaN(n) ? String(stationId) : `P${String(n).padStart(2, '0')}`;
      } catch { return null; }
    })();

    const code = codeOpcional || this.generateVoucherCode();
    const notas = customerName ? String(customerName) : (userId ? `Emitido por ${userId}` : null);
    const r = this.createTicketOriginal({ code, amount, currency, mesa: mesaLabel, notas });
    if (!r.success) throw new Error('No se pudo crear el voucher');
    return {
      id: r.ticketId,
      voucher_code: code,
      amount,
      currency,
      status: 'active',
      issued_at: new Date().toISOString()
    };
  }

  /**
   * Obtiene un voucher mapeado desde la tabla tickets.
   * @param {string} code
   * @returns {object|null}
   */
  getVoucherByCode(code) {
    const t = this.getTicket(code);
    if (!t) return null;
    const dias = parseInt(this.getConfig('dias_expiracion') || '365');
    const fechaEmision = new Date(t.fecha_emision);
    const exp = new Date(fechaEmision.getTime() + dias * 24 * 60 * 60 * 1000).toISOString();
    const mapEstado = (s) => {
      switch (String(s)) {
        case 'usado': return 'redeemed';
        case 'cancelado': return 'cancelled';
        case 'expirado': return 'expired';
        case 'emitido': return 'active';
        default: return 'active';
      }
    };
    return {
      id: t.id,
      voucher_code: t.code,
      amount: parseFloat(t.amount),
      currency: t.currency,
      status: mapEstado(t.estado),
      issued_by_user_id: t.cajero_id || null,
      issued_at_station_id: t.mesa || null,
      issued_at: t.fecha_emision,
      expires_at: exp,
      customer_name: t.notas || null,
      synced: t.sincronizado || 0
    };
  }

  // Firma compatible: objeto o posicional
  createTicket(dataOrCode, amountArg, currencyArg, mesaArg, fechaArg) {
    if (typeof dataOrCode === 'object' && dataOrCode !== null && arguments.length === 1) {
      const d = dataOrCode;
      const ticketData = {
        code: d.ticket_number || d.code || undefined,
        amount: (d.amount ?? d.valor),
        currency: (d.currency ?? d.moneda),
        mesa: (d.mesa ?? d.mesa_id ?? 'M01'),
        notas: d.notas || (d.usuario_emision ? `Usuario: ${d.usuario_emision}` : null)
      };
      const r = this.createTicketOriginal(ticketData);
      if (!r.success) throw new Error(r.error);
      return { id: r.ticketId, ticket_number: r.code, valor: ticketData.amount, moneda: ticketData.currency, estado: 'emitido', created_at: new Date().toISOString() };
    }
    let code = (typeof dataOrCode === 'string' ? dataOrCode : undefined) || this.generateTicketCode();
    const safeAmount = (typeof amountArg === 'number' && isFinite(amountArg)) ? amountArg : 0;
    const safeCurrency = (typeof currencyArg === 'string' && currencyArg) ? currencyArg : 'DOP';
    const safeMesa = (typeof mesaArg === 'string' && mesaArg) ? mesaArg : 'M01';
    const r = this.createTicketOriginal({ code, amount: safeAmount, currency: safeCurrency, mesa: safeMesa });
    if (!r.success) throw new Error(r.error);
    return { id: r.ticketId, ticket_number: r.code, valor: safeAmount, moneda: safeCurrency, estado: 'emitido', created_at: new Date().toISOString() };
  }

  getTicket(code) {
    return this.db.prepare('SELECT * FROM tickets WHERE code = ?').get(String(code).toUpperCase()) || null;
  }

  getTicketsToday() {
    return this.db.prepare("SELECT * FROM tickets WHERE DATE(fecha_emision) = DATE('now', 'localtime') ORDER BY fecha_emision DESC").all();
  }

  getTicketsByDateRange(fechaInicio, fechaFin) {
    return this.db.prepare('SELECT * FROM tickets WHERE fecha_emision BETWEEN ? AND ? ORDER BY fecha_emision DESC').all(fechaInicio, fechaFin);
  }

  getStatsToday() {
    const tickets = this.getTicketsToday();
    const stats = { ticketsHoy: 0, totalDOP: 0, totalUSD: 0, pendientes: 0, cobrados: 0, cancelados: 0 };
    for (const t of tickets) {
      stats.ticketsHoy++;
      if (t.estado === 'usado') {
        stats.cobrados++;
        (t.currency === 'USD' ? (stats.totalUSD += parseFloat(t.amount)) : (stats.totalDOP += parseFloat(t.amount)));
      } else if (t.estado === 'activo' || t.estado === 'emitido') {
        stats.pendientes++;
      } else if (t.estado === 'cancelado') {
        stats.cancelados++;
      }
    }
    return stats;
  }

  validateTicket(code) {
    const ticket = this.getTicket(code);
    if (!ticket) return { valid: false, reason: 'not_found' };
    if (ticket.estado === 'usado') return { valid: false, reason: 'used', ticket };
    if (ticket.estado === 'cancelado') return { valid: false, reason: 'cancelled', ticket };
    const dias = parseInt(this.getConfig('dias_expiracion') || '365');
    const fechaEmision = new Date(ticket.fecha_emision);
    const exp = new Date(fechaEmision.getTime() + dias * 24 * 60 * 60 * 1000);
    if (new Date() > exp) {
      this.updateTicketStatus(code, 'expirado');
      return { valid: false, reason: 'expired', ticket };
    }
    return { valid: true, ticket };
  }

  redeemTicket(code, cajeroId = 'CAJA-01') {
    const v = this.validateTicket(code);
    if (!v.valid) return { success: false, reason: v.reason, message: 'Ticket no válido para cobro' };
    this.db.prepare("UPDATE tickets SET estado = 'usado', fecha_cobro = CURRENT_TIMESTAMP, cajero_id = ? WHERE code = ?").run(cajeroId, String(code).toUpperCase());
    try { this.addAuditLog('ticket_cobrado', String(code).toUpperCase(), cajeroId, `Ticket cobrado: ${v.ticket.currency} ${v.ticket.amount}`); } catch {}
    return { success: true, ticket: v.ticket };
  }

  updateTicketStatus(code, estado, usuario_canje = null) {
    const redeemed_at = estado === 'usado' ? new Date().toISOString() : null;
    return this.db.prepare('UPDATE tickets SET estado = ?, cajero_id = COALESCE(?, cajero_id), fecha_cobro = COALESCE(?, fecha_cobro) WHERE code = ?').run(String(estado), usuario_canje, redeemed_at, String(code).toUpperCase());
  }

  getReportByMesa(mesa, fecha = null) {
    let q = 'SELECT * FROM tickets WHERE mesa = ?';
    const params = [mesa];
    if (fecha) { q += ' AND DATE(fecha_emision) = DATE(?)'; params.push(fecha); }
    return this.db.prepare(q).all(...params);
  }

  // ===== Auditoría =====
  addAuditLog(tipo_evento, ticket_code, usuario_id, descripcion, datosAdicionales = null, opciones = {}) {
    const stmt = this.db.prepare(`
      INSERT INTO auditoria (tipo_evento, ticket_code, usuario_id, descripcion, datos_adicionales, ip_address, user_agent, session_id, nivel_criticidad, modulo, accion, resultado)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const res = stmt.run(
      tipo_evento,
      ticket_code || null,
      usuario_id || null,
      descripcion || null,
      datosAdicionales ? JSON.stringify(datosAdicionales) : null,
      opciones.ip_address || null,
      opciones.user_agent || null,
      opciones.session_id || null,
      opciones.nivel_criticidad || 'MEDIO',
      opciones.modulo || null,
      opciones.accion || tipo_evento,
      opciones.resultado || 'EXITO'
    );
    return { success: true, id: res.lastInsertRowid };
  }

  addCriticalAuditLog(tipo_evento, usuario_id, descripcion, datosAdicionales = null, opciones = {}) {
    return this.addAuditLog(tipo_evento, null, usuario_id, descripcion, datosAdicionales, { ...opciones, nivel_criticidad: 'CRITICO' });
  }

  addConfigAuditLog(clave, valorAnterior, valorNuevo, usuarioId, opciones = {}) {
    return this.addAuditLog('config_change', null, usuarioId, `Configuración ${clave} cambiada`, { clave, valor_anterior: valorAnterior, valor_nuevo: valorNuevo }, { ...opciones, nivel_criticidad: 'ALTO', modulo: 'CONFIGURACION', accion: 'UPDATE' });
  }

  addLoginAuditLog(usuarioId, exito, detalles = null, opciones = {}) {
    return this.addAuditLog('login_attempt', null, usuarioId, exito ? 'Login exitoso' : 'Login fallido', detalles, { ...opciones, nivel_criticidad: exito ? 'BAJO' : 'ALTO', modulo: 'AUTENTICACION', accion: 'LOGIN', resultado: exito ? 'EXITO' : 'FALLO' });
  }

  getAuditLogs(limit = 100, filtros = {}) {
    let q = 'SELECT id, tipo_evento, ticket_code, usuario_id, descripcion, fecha, datos_adicionales, ip_address, user_agent, session_id, nivel_criticidad, modulo, accion, resultado FROM auditoria WHERE 1=1';
    const params = [];
    if (filtros.usuario_id) { q += ' AND usuario_id = ?'; params.push(filtros.usuario_id); }
    if (filtros.tipo_evento) { q += ' AND tipo_evento = ?'; params.push(filtros.tipo_evento); }
    if (filtros.nivel_criticidad) { q += ' AND nivel_criticidad = ?'; params.push(filtros.nivel_criticidad); }
    if (filtros.modulo) { q += ' AND modulo = ?'; params.push(filtros.modulo); }
    if (filtros.fecha_desde) { q += ' AND fecha >= ?'; params.push(filtros.fecha_desde); }
    if (filtros.fecha_hasta) { q += ' AND fecha <= ?'; params.push(filtros.fecha_hasta); }
    q += ' ORDER BY fecha DESC LIMIT ?'; params.push(limit);
    const rows = this.db.prepare(q).all(...params);
    return rows.map(r => ({ ...r, datos_adicionales: r.datos_adicionales ? JSON.parse(r.datos_adicionales) : null }));
  }

  getAuditStats(fechaDesde = null, fechaHasta = null) {
    const where = (fechaDesde && fechaHasta) ? 'WHERE fecha BETWEEN ? AND ?' : '';
    const params = (where ? [fechaDesde, fechaHasta] : []);
    const resumen = this.db.prepare(`
      SELECT COUNT(*) AS total_eventos,
             COUNT(DISTINCT usuario_id) AS usuarios_activos,
             SUM(CASE WHEN nivel_criticidad = 'CRITICO' THEN 1 ELSE 0 END) AS eventos_criticos,
             SUM(CASE WHEN nivel_criticidad = 'ALTO' THEN 1 ELSE 0 END) AS eventos_altos,
             SUM(CASE WHEN resultado = 'FALLO' THEN 1 ELSE 0 END) AS eventos_fallidos
      FROM auditoria ${where}
    `).get(...params);
    const por_tipo = this.db.prepare(`SELECT tipo_evento, COUNT(*) AS cantidad FROM auditoria ${where} GROUP BY tipo_evento ORDER BY cantidad DESC`).all(...params);
    const por_modulo = this.db.prepare(`SELECT modulo, COUNT(*) AS cantidad FROM auditoria ${where} WHERE modulo IS NOT NULL GROUP BY modulo ORDER BY cantidad DESC`).all(...params);
    return { resumen, por_tipo, por_modulo };
  }

  // ===== Operadores / Usuarios =====
  authenticateOperator(codigo, pin) {
    const op = this.db.prepare('SELECT id, codigo, nombre, mesa_asignada, activo FROM operadores WHERE codigo = ? AND pin = ? AND activo = 1').get(String(codigo).trim(), String(pin).trim());
    if (!op) return { success: false, error: 'Credenciales inválidas o usuario inactivo' };
    try { this.addAuditLog('login_caja', null, op.codigo, 'Login de operador en Caja'); } catch {}
    return { success: true, operator: op };
  }

  hashPassword(password, salt = null) {
    const s = salt || crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(String(password), s, 100000, 64, 'sha512').toString('hex');
    return { hash, salt: s };
  }

  createUser(username, password, role = 'MESA', activo = 1, email = null) {
    const { hash, salt } = this.hashPassword(password);
    try {
      this.db.prepare('INSERT INTO usuarios (username, password_hash, password_salt, role, activo, email) VALUES (?, ?, ?, ?, ?, ?)').run(String(username).trim(), hash, salt, String(role).toUpperCase(), activo ? 1 : 0, email || null);
      return { success: true };
    } catch (e) { return { success: false, error: e.message }; }
  }

  getUserByUsername(username) {
    return this.db.prepare('SELECT id, username, password_hash, password_salt, role, activo FROM usuarios WHERE username = ?').get(String(username).trim());
  }

  authenticateUserLocal(username, password) {
    const user = this.getUserByUsername(username);
    if (!user || !user.activo) return { success: false, error: 'Usuario inexistente o inactivo' };
    const { hash } = this.hashPassword(password, user.password_salt);
    if (hash !== user.password_hash) return { success: false, error: 'Contraseña incorrecta' };
    try { this.addAuditLog('login_app', null, user.username, 'Login general en app'); this.db.prepare('UPDATE usuarios SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id); } catch {}
    return { success: true, user: { id: user.id, username: user.username, role: user.role } };
  }

  listUsers() {
    try { const rows = this.db.prepare('SELECT id, username, role, activo, creado FROM usuarios ORDER BY username ASC').all(); return { success: true, users: rows }; }
    catch (e) { return { success: false, error: e.message }; }
  }

  setUserActive(id, active) {
    try { this.db.prepare('UPDATE usuarios SET activo = ? WHERE id = ?').run(active ? 1 : 0, Number(id)); return { success: true }; }
    catch (e) { return { success: false, error: e.message }; }
  }

  setUserRole(id, role) {
    try { this.db.prepare('UPDATE usuarios SET role = ? WHERE id = ?').run(String(role).toUpperCase(), Number(id)); return { success: true }; }
    catch (e) { return { success: false, error: e.message }; }
  }

  setUserPassword(id, newPassword) {
    try { const { hash, salt } = this.hashPassword(newPassword); this.db.prepare('UPDATE usuarios SET password_hash = ?, password_salt = ? WHERE id = ?').run(hash, salt, Number(id)); return { success: true }; }
    catch (e) { return { success: false, error: e.message }; }
  }

  deleteUser(id) {
    try { this.db.prepare('DELETE FROM usuarios WHERE id = ?').run(Number(id)); return { success: true }; }
    catch (e) { return { success: false, error: e.message }; }
  }

  ensureUserExtraColumns() {
    try {
      const cols = this.db.prepare("PRAGMA table_info('usuarios')").all().map(c => c.name);
      const added = [];
      if (!cols.includes('email')) { this.db.exec('ALTER TABLE usuarios ADD COLUMN email TEXT'); added.push('email'); }
      if (!cols.includes('last_login')) { this.db.exec('ALTER TABLE usuarios ADD COLUMN last_login DATETIME'); added.push('last_login'); }
      if (!cols.includes('metadata')) { this.db.exec('ALTER TABLE usuarios ADD COLUMN metadata TEXT'); added.push('metadata'); }
      if (added.length) { try { this.addConfigAuditLog('usuarios_migracion', null, `Añadidas columnas: ${added.join(', ')}`, 'system'); } catch {} }
    } catch (e) { /* noop */ }
  }

  ensureDemoAdminUser() {
    try { const c = this.db.prepare('SELECT COUNT(1) AS c FROM usuarios').get()?.c || 0; if (c === 0) this.createUser('admin@local', 'admin1234', 'ADMIN', 1); } catch {}
  }

  cleanExpiredTickets() {
    const dias = parseInt(this.getConfig('dias_expiracion') || '365');
    const res = this.db.prepare(`UPDATE tickets SET estado = 'expirado' WHERE estado IN ('activo','emitido') AND datetime(fecha_emision) < datetime('now', '-${dias} days')`).run();
    return res.changes;
  }

  backup(targetPath = null) {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const defaultPath = path.join(__dirname, 'backups', `casino_backup_${ts}.db`);
    const dest = targetPath || defaultPath;
    const dir = path.dirname(dest);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    this.db.backup(dest);
    return dest;
  }

  close() { try { this.db.close(); } catch {} }

  // Migración/compatibilidad de esquemas legacy
  ensureTicketsSchema() {
    try {
      const cols = this.db.prepare("PRAGMA table_info('tickets')").all().map(c => c.name);
      const isLegacy = cols.includes('ticket_number') || !cols.includes('code') || !cols.includes('amount') || !cols.includes('currency');
      if (!isLegacy) return;
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS tickets_v2 (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          code TEXT UNIQUE NOT NULL,
          amount DECIMAL(10,2) NOT NULL,
          currency TEXT CHECK(currency IN ('USD','DOP')) NOT NULL,
          mesa TEXT,
          estado TEXT CHECK(estado IN ('activo','emitido','usado','cancelado','expirado')) DEFAULT 'emitido',
          fecha_emision DATETIME DEFAULT CURRENT_TIMESTAMP,
          fecha_cobro DATETIME,
          cajero_id TEXT,
          hash_seguridad TEXT,
          qr_data TEXT,
          sincronizado INTEGER DEFAULT 0,
          notas TEXT
        );
      `);
      const rows = this.db.prepare('SELECT * FROM tickets').all();
      const insert = this.db.prepare('INSERT INTO tickets_v2 (code, amount, currency, mesa, estado, fecha_emision, fecha_cobro, cajero_id, hash_seguridad, qr_data, sincronizado, notas) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      const tx = this.db.transaction(rs => {
        for (const r of rs) {
          const code = (r.ticket_number || r.code || '').toString().toUpperCase();
          const amount = r.valor ?? r.amount ?? 0;
          const currency = r.moneda ?? r.currency ?? 'DOP';
          const mesa = r.mesa_id ?? r.mesa ?? 'M01';
          const estadoLegacy = r.estado ?? 'emitido';
          const estado = estadoLegacy === 'emitido' ? 'emitido' : (estadoLegacy === 'canjeado' ? 'usado' : estadoLegacy);
          const fecha_emision = r.created_at ?? r.fecha_emision ?? new Date().toISOString();
          const fecha_cobro = r.redeemed_at ?? r.fecha_cobro ?? null;
          insert.run(code, amount, currency, mesa, estado, fecha_emision, fecha_cobro, r.cajero_id ?? null, r.hash_seguridad ?? '', r.qr_data ?? '', r.sincronizado ?? 0, r.notas ?? null);
        }
      });
      tx(rows);
      this.db.exec('ALTER TABLE tickets RENAME TO tickets_legacy');
      this.db.exec('ALTER TABLE tickets_v2 RENAME TO tickets');
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_ticket_code ON tickets(code);');
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_ticket_estado ON tickets(estado);');
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_ticket_fecha ON tickets(fecha_emision);');
    } catch (e) { /* noop */ }
  }

  // Compatibilidad
  findTicketByNumber(ticket_number) { return this.getTicket(ticket_number); }
  getTicketByNumber(ticket_number) { return this.getTicket(ticket_number); }
}

module.exports = CasinoDatabase;

// Ejecutable directo para pruebas rápidas
if (require.main === module) {
  const db = new CasinoDatabase();
  const res = db.createTicket({ amount: 500.00, currency: 'DOP', mesa: 'P01', notas: 'Ticket de prueba' });
  console.log('Ticket creado:', res);
  const validation = db.validateTicket(res.ticket_number);
  console.log('Validación:', validation);
  console.log('Stats Hoy:', db.getStatsToday());
  db.close();
}
