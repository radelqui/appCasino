// ============================================
// BASE DE DATOS SQLITE - ACTUALIZADA
// 100% Compatible con Supabase
// ============================================

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

class CasinoDatabase {
  constructor(dbPathArg = null) {
    const dbPath = dbPathArg || process.env.CASINO_DB_PATH || process.env.SQLITE_DB_PATH || path.join(process.cwd(), 'data', 'casino.db');
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    this.dbPath = dbPath;
    this.db = new Database(dbPath, { verbose: console.log });
    this.db.pragma('journal_mode = WAL'); // Mejor performance
    this.db.pragma('foreign_keys = ON'); // Asegurar integridad referencial
    this.initDatabase();
  }

  initDatabase() {
    console.log('🔧 Inicializando base de datos SQLite...');
    
    // ============================================
    // CREAR TABLAS (Idénticas a Supabase)
    // ============================================
    
    // 1. TABLA: stations (Estaciones/Mesas)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS stations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        station_type TEXT NOT NULL CHECK(station_type IN ('mesa', 'caja')),
        station_number INTEGER NOT NULL,
        station_name TEXT NOT NULL,
        ip_address TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        updated_at TEXT DEFAULT (datetime('now', 'localtime')),
        UNIQUE(station_type, station_number)
      );
    `);

    // 2. TABLA: users (Usuarios del sistema)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        full_name TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('mesa', 'caja', 'auditor', 'admin')),
        station_id INTEGER,
        pin_code TEXT,
        is_active INTEGER DEFAULT 1,
        last_login TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        updated_at TEXT DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (station_id) REFERENCES stations(id)
      );
    `);

    // 3. TABLA: vouchers (Tickets/Vouchers) - RENOMBRADA desde "tickets"
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS vouchers (
        id TEXT PRIMARY KEY,
        voucher_code TEXT UNIQUE NOT NULL,
        qr_data TEXT NOT NULL,
        qr_hash TEXT NOT NULL,
        
        amount REAL NOT NULL CHECK(amount > 0),
        currency TEXT NOT NULL DEFAULT 'DOP' CHECK(currency IN ('USD', 'DOP')),
        
        status TEXT NOT NULL DEFAULT 'active' 
          CHECK(status IN ('active', 'redeemed', 'expired', 'cancelled')),
        
        issued_by_user_id TEXT NOT NULL,
        issued_at_station_id INTEGER NOT NULL,
        issued_at TEXT DEFAULT (datetime('now', 'localtime')),
        
        redeemed_by_user_id TEXT,
        redeemed_at_station_id INTEGER,
        redeemed_at TEXT,
        
        expires_at TEXT NOT NULL,
        
        customer_name TEXT,
        customer_notes TEXT,
        
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        updated_at TEXT DEFAULT (datetime('now', 'localtime')),
        
        synced INTEGER DEFAULT 0,
        
        FOREIGN KEY (issued_by_user_id) REFERENCES users(id),
        FOREIGN KEY (issued_at_station_id) REFERENCES stations(id),
        FOREIGN KEY (redeemed_by_user_id) REFERENCES users(id),
        FOREIGN KEY (redeemed_at_station_id) REFERENCES stations(id)
      );
    `);

    // 4. TABLA: audit_log (Auditoría)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT NOT NULL CHECK(action IN (
          'voucher_created',
          'voucher_issued',
          'voucher_redeemed',
          'voucher_cancelled',
          'voucher_expired',
          'user_login',
          'user_logout',
          'user_created',
          'user_updated',
          'operator_created',
          'operator_updated',
          'session_closed',
          'config_changed'
        )),
        user_id TEXT,
        user_role TEXT,
        station_id INTEGER,
        voucher_id TEXT,
        details TEXT,
        ip_address TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (station_id) REFERENCES stations(id),
        FOREIGN KEY (voucher_id) REFERENCES vouchers(id)
      );
    `);

    // 5. TABLA: system_config (Configuración)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS system_config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        config_key TEXT UNIQUE NOT NULL,
        config_value TEXT NOT NULL,
        config_type TEXT NOT NULL CHECK(config_type IN ('string', 'number', 'boolean', 'json')),
        description TEXT,
        updated_by_user_id TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        updated_at TEXT DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (updated_by_user_id) REFERENCES users(id)
      );
    `);

    // 6. TABLA: daily_reports (Reportes diarios)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS daily_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        report_date TEXT NOT NULL UNIQUE,
        
        total_vouchers_usd REAL DEFAULT 0,
        total_vouchers_dop REAL DEFAULT 0,
        total_redeemed_usd REAL DEFAULT 0,
        total_redeemed_dop REAL DEFAULT 0,
        
        count_issued INTEGER DEFAULT 0,
        count_redeemed INTEGER DEFAULT 0,
        count_expired INTEGER DEFAULT 0,
        count_cancelled INTEGER DEFAULT 0,
        
        stats_by_station TEXT,
        
        generated_at TEXT DEFAULT (datetime('now', 'localtime')),
        generated_by_user_id TEXT,
        FOREIGN KEY (generated_by_user_id) REFERENCES users(id)
      );
    `);

    // 7. TABLA: sync_queue (Cola de sincronización)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id TEXT NOT NULL,
        operation_type TEXT NOT NULL CHECK(operation_type IN ('create', 'update', 'delete')),
        table_name TEXT NOT NULL,
        record_data TEXT NOT NULL,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'synced', 'failed')),
        error_message TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        synced_at TEXT
      );
    `);

    // ============================================
    // CREAR ÍNDICES
    // ============================================
    
    this.db.exec(`
      -- Índices para users
      CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
      CREATE INDEX IF NOT EXISTS idx_users_station ON users(station_id);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      
      -- Índices para vouchers
      CREATE INDEX IF NOT EXISTS idx_vouchers_code ON vouchers(voucher_code);
      CREATE INDEX IF NOT EXISTS idx_vouchers_status ON vouchers(status);
      CREATE INDEX IF NOT EXISTS idx_vouchers_issued_at ON vouchers(issued_at);
      CREATE INDEX IF NOT EXISTS idx_vouchers_currency ON vouchers(currency);
      CREATE INDEX IF NOT EXISTS idx_vouchers_synced ON vouchers(synced);
      CREATE INDEX IF NOT EXISTS idx_vouchers_issued_by ON vouchers(issued_by_user_id);
      CREATE INDEX IF NOT EXISTS idx_vouchers_station ON vouchers(issued_at_station_id);
      
      -- Índices para audit_log
      CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);
      CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_voucher ON audit_log(voucher_id);
      CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
      
      -- Índices para sync_queue
      CREATE INDEX IF NOT EXISTS idx_sync_status ON sync_queue(status);
      CREATE INDEX IF NOT EXISTS idx_sync_device ON sync_queue(device_id);
      
      -- Índices para daily_reports
      CREATE INDEX IF NOT EXISTS idx_daily_reports_date ON daily_reports(report_date);
    `);

    // ============================================
    // MIGRACIÓN AUTOMÁTICA DE TABLAS LEGACY
    // ============================================
    this.migrateFromLegacy();

    // ============================================
    // DATOS INICIALES
    // ============================================
    this.seedInitialData();

    console.log('✅ Base de datos inicializada correctamente');
  }

  /**
   * Migrar datos de tablas antiguas si existen
   */
  migrateFromLegacy() {
    try {
      // Verificar si existe tabla "tickets" (legacy)
      const hasTickets = this.db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='tickets'
      `).get();

      if (hasTickets) {
        console.log('🔄 Migrando datos de tabla "tickets" a "vouchers"...');
        
        // Copiar datos de tickets a vouchers
        this.db.exec(`
          INSERT OR IGNORE INTO vouchers 
          SELECT * FROM tickets
        `);

        console.log('✅ Migración completada');
      }

      // Verificar si existe tabla "operadores" (legacy)
      const hasOperadores = this.db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='operadores'
      `).get();

      if (hasOperadores) {
        console.log('🔄 Migrando datos de "operadores" a "users"...');
        
        // Migrar operadores a users con rol 'mesa'
        this.db.exec(`
          INSERT OR IGNORE INTO users (id, email, full_name, role, pin_code)
          SELECT 
            id,
            COALESCE(email, id || '@casino.local'),
            nombre,
            'mesa',
            pin
          FROM operadores
        `);

        console.log('✅ Migración completada');
      }

      // Verificar si existe tabla "usuarios" diferente de "users"
      const hasUsuarios = this.db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='usuarios' AND name != 'users'
      `).get();

      if (hasUsuarios) {
        console.log('🔄 Migrando datos de "usuarios" a "users"...');
        
        this.db.exec(`
          INSERT OR IGNORE INTO users 
          SELECT * FROM usuarios
        `);

        console.log('✅ Migración completada');
      }

    } catch (error) {
      console.warn('⚠️  Error en migración legacy:', error.message);
    }
  }

  /**
   * Insertar datos iniciales
   */
  seedInitialData() {
    // Verificar si ya hay estaciones
    const stationCount = this.db.prepare('SELECT COUNT(*) as count FROM stations').get();
    
    if (stationCount.count === 0) {
      console.log('📝 Insertando estaciones iniciales...');
      
      const insertStation = this.db.prepare(`
        INSERT INTO stations (station_type, station_number, station_name) 
        VALUES (?, ?, ?)
      `);
      
      insertStation.run('mesa', 1, 'Mesa 1');
      insertStation.run('mesa', 2, 'Mesa 2');
      insertStation.run('mesa', 3, 'Mesa 3');
      insertStation.run('mesa', 4, 'Mesa 4');
      insertStation.run('caja', 1, 'Caja Principal');
      
      console.log('✅ 5 estaciones creadas');
    }

    // Verificar si ya hay configuración
    const configCount = this.db.prepare('SELECT COUNT(*) as count FROM system_config').get();
    
    if (configCount.count === 0) {
      console.log('📝 Insertando configuración inicial...');
      
      const insertConfig = this.db.prepare(`
        INSERT INTO system_config (config_key, config_value, config_type, description) 
        VALUES (?, ?, ?, ?)
      `);
      
      insertConfig.run('voucher_expiry_hours', '24', 'number', 'Horas hasta que expire un voucher');
      insertConfig.run('min_voucher_amount', '10', 'number', 'Monto mínimo de voucher (DOP)');
      insertConfig.run('max_voucher_amount', '100000', 'number', 'Monto máximo de voucher (DOP)');
      insertConfig.run('usd_to_dop_rate', '58.5', 'number', 'Tasa de cambio USD a DOP');
      insertConfig.run('casino_name', 'Gran Casino Sosúa', 'string', 'Nombre del casino');
      insertConfig.run('print_logo_enabled', 'true', 'boolean', 'Imprimir logo en vouchers');
      insertConfig.run('require_customer_name', 'false', 'boolean', 'Requerir nombre de cliente');
      insertConfig.run('allow_duplicate_amounts', 'false', 'boolean', 'Permitir vouchers con mismo monto');
      
      console.log('✅ 8 configuraciones creadas');
    }
  }

  // ============================================
  // MÉTODOS PARA VOUCHERS
  // ============================================

  generateVoucherCode() {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `TKT-${timestamp}-${random}`;
  }

  generateQRHash(data) {
    const secret = process.env.QR_SECRET || 'CASINO_SECRET_KEY';
    return crypto.createHmac('sha256', secret)
      .update(data)
      .digest('hex');
  }

  createVoucher(amount, currency, userId, stationId, customerName = null) {
    const id = crypto.randomUUID();
    const voucherCode = this.generateVoucherCode();
    const qrData = `${voucherCode}|${amount}|${currency}|${Date.now()}`;
    const qrHash = this.generateQRHash(qrData);
    
    const expiryHours = this.getConfig('voucher_expiry_hours') || 24;
    const expiresAt = new Date(Date.now() + (expiryHours * 60 * 60 * 1000)).toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO vouchers (
        id, voucher_code, qr_data, qr_hash, amount, currency,
        issued_by_user_id, issued_at_station_id, expires_at, customer_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id, voucherCode, qrData, qrHash, amount, currency,
      userId, stationId, expiresAt, customerName
    );

    // Log de auditoría
    this.addAuditLog('voucher_created', userId, stationId, id, {
      amount, currency, voucher_code: voucherCode
    });

    // Agregar a cola de sincronización
    this.addToSyncQueue('create', 'vouchers', this.getVoucherById(id));

    return this.getVoucherById(id);
  }

  validateVoucher(voucherCode) {
    const stmt = this.db.prepare(`
      SELECT 
        v.*,
        u.full_name as issued_by_name,
        s.station_name as issued_at_station_name
      FROM vouchers v
      LEFT JOIN users u ON v.issued_by_user_id = u.id
      LEFT JOIN stations s ON v.issued_at_station_id = s.id
      WHERE v.voucher_code = ? AND v.status = 'active'
    `);

    const voucher = stmt.get(voucherCode);

    if (!voucher) {
      return { valid: false, message: 'Voucher no encontrado o ya utilizado' };
    }

    // Verificar expiración
    if (new Date(voucher.expires_at) < new Date()) {
      this.expireVoucher(voucher.id);
      return { valid: false, message: 'Voucher expirado' };
    }

    // Verificar hash
    const expectedHash = this.generateQRHash(voucher.qr_data);
    if (voucher.qr_hash !== expectedHash) {
      return { valid: false, message: 'Voucher inválido o alterado' };
    }

    return { valid: true, voucher };
  }

  redeemVoucher(voucherId, userId, stationId) {
    const stmt = this.db.prepare(`
      UPDATE vouchers 
      SET status = 'redeemed',
          redeemed_by_user_id = ?,
          redeemed_at_station_id = ?,
          redeemed_at = datetime('now', 'localtime'),
          updated_at = datetime('now', 'localtime'),
          synced = 0
      WHERE id = ? AND status = 'active'
    `);

    const result = stmt.run(userId, stationId, voucherId);

    if (result.changes > 0) {
      this.addAuditLog('voucher_redeemed', userId, stationId, voucherId);
      
      // Agregar a cola de sincronización
      this.addToSyncQueue('update', 'vouchers', this.getVoucherById(voucherId));
      
      return this.getVoucherById(voucherId);
    }

    return null;
  }

  expireVoucher(voucherId) {
    const stmt = this.db.prepare(`
      UPDATE vouchers 
      SET status = 'expired',
          updated_at = datetime('now', 'localtime'),
          synced = 0
      WHERE id = ? AND status = 'active'
    `);

    const result = stmt.run(voucherId);
    
    if (result.changes > 0) {
      this.addAuditLog('voucher_expired', null, null, voucherId);
      this.addToSyncQueue('update', 'vouchers', this.getVoucherById(voucherId));
    }

    return result;
  }

  getVoucherById(id) {
    const stmt = this.db.prepare(`
      SELECT 
        v.*,
        iu.full_name as issued_by_name,
        ru.full_name as redeemed_by_name,
        is_.station_name as issued_at_station_name,
        rs.station_name as redeemed_at_station_name
      FROM vouchers v
      LEFT JOIN users iu ON v.issued_by_user_id = iu.id
      LEFT JOIN users ru ON v.redeemed_by_user_id = ru.id
      LEFT JOIN stations is_ ON v.issued_at_station_id = is_.id
      LEFT JOIN stations rs ON v.redeemed_at_station_id = rs.id
      WHERE v.id = ?
    `);

    return stmt.get(id);
  }

  getVoucherByCode(code) {
    const stmt = this.db.prepare('SELECT * FROM vouchers WHERE voucher_code = ?');
    return stmt.get(String(code));
  }

  getTodayVouchers() {
    const stmt = this.db.prepare(`
      SELECT 
        v.*,
        u.full_name as issued_by_name,
        s.station_name as issued_at_station_name
      FROM vouchers v
      LEFT JOIN users u ON v.issued_by_user_id = u.id
      LEFT JOIN stations s ON v.issued_at_station_id = s.id
      WHERE DATE(v.issued_at) = DATE('now', 'localtime')
      ORDER BY v.issued_at DESC
    `);

    return stmt.all();
  }

  // ============================================
  // ESTADÍSTICAS
  // ============================================

  getStationStats(stationId = null) {
    let query = `
      SELECT 
        s.id,
        s.station_name,
        s.station_type,
        COUNT(v.id) as total_vouchers,
        SUM(CASE WHEN v.currency = 'USD' THEN v.amount ELSE 0 END) as total_usd,
        SUM(CASE WHEN v.currency = 'DOP' THEN v.amount ELSE 0 END) as total_dop,
        COUNT(CASE WHEN v.status = 'active' THEN 1 END) as active_vouchers,
        COUNT(CASE WHEN v.status = 'redeemed' THEN 1 END) as redeemed_vouchers,
        COUNT(CASE WHEN v.status = 'expired' THEN 1 END) as expired_vouchers
      FROM stations s
      LEFT JOIN vouchers v ON v.issued_at_station_id = s.id 
        AND DATE(v.issued_at) = DATE('now', 'localtime')
      ${stationId ? 'WHERE s.id = ?' : ''}
      GROUP BY s.id, s.station_name, s.station_type
    `;

    const stmt = this.db.prepare(query);
    return stationId ? stmt.all(stationId) : stmt.all();
  }

  getDailyStats() {
    const stmt = this.db.prepare(`
      SELECT 
        DATE(issued_at) as date,
        currency,
        status,
        COUNT(*) as count,
        SUM(amount) as total_amount
      FROM vouchers
      WHERE DATE(issued_at) = DATE('now', 'localtime')
      GROUP BY DATE(issued_at), currency, status
    `);

    return stmt.all();
  }

  // ============================================
  // CONFIGURACIÓN
  // ============================================

  getConfig(key) {
    const stmt = this.db.prepare('SELECT config_value, config_type FROM system_config WHERE config_key = ?');
    const config = stmt.get(key);
    
    if (!config) return null;

    switch (config.config_type) {
      case 'number': return parseFloat(config.config_value);
      case 'boolean': return config.config_value === 'true';
      case 'json': return JSON.parse(config.config_value);
      default: return config.config_value;
    }
  }

  setConfig(key, value, userId = null) {
    const stmt = this.db.prepare(`
      UPDATE system_config 
      SET config_value = ?, 
          updated_by_user_id = ?,
          updated_at = datetime('now', 'localtime')
      WHERE config_key = ?
    `);

    return stmt.run(String(value), userId, key);
  }

  // ============================================
  // AUDITORÍA
  // ============================================

  addAuditLog(action, userId, stationId, voucherId = null, details = null) {
    const stmt = this.db.prepare(`
      INSERT INTO audit_log (action, user_id, station_id, voucher_id, details)
      VALUES (?, ?, ?, ?, ?)
    `);

    return stmt.run(
      action, 
      userId, 
      stationId, 
      voucherId, 
      details ? JSON.stringify(details) : null
    );
  }

  getAuditLog(filters = {}) {
    let query = 'SELECT * FROM audit_log WHERE 1=1';
    const params = [];

    if (filters.action) {
      query += ' AND action = ?';
      params.push(filters.action);
    }

    if (filters.userId) {
      query += ' AND user_id = ?';
      params.push(filters.userId);
    }

    if (filters.startDate) {
      query += ' AND created_at >= ?';
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ' AND created_at <= ?';
      params.push(filters.endDate);
    }

    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(filters.limit || 100);

    const stmt = this.db.prepare(query);
    return stmt.all(...params);
  }

  // ============================================
  // SINCRONIZACIÓN
  // ============================================

  addToSyncQueue(operation, tableName, data) {
    const stmt = this.db.prepare(`
      INSERT INTO sync_queue (device_id, operation_type, table_name, record_data)
      VALUES (?, ?, ?, ?)
    `);

    const os = require('os');
    const deviceId = os.hostname();
    
    stmt.run(deviceId, operation, tableName, JSON.stringify(data));
  }

  getPendingSyncQueue() {
    const stmt = this.db.prepare(`
      SELECT * FROM sync_queue 
      WHERE status = 'pending' 
      ORDER BY created_at ASC
    `);

    return stmt.all();
  }

  markSynced(syncId) {
    const stmt = this.db.prepare(`
      UPDATE sync_queue 
      SET status = 'synced', 
          synced_at = datetime('now', 'localtime')
      WHERE id = ?
    `);

    stmt.run(syncId);
  }

  // ============================================
  // UTILIDADES
  // ============================================

  expireOldVouchers() {
    const stmt = this.db.prepare(`
      UPDATE vouchers 
      SET status = 'expired',
          synced = 0
      WHERE status = 'active' 
      AND datetime(expires_at) < datetime('now', 'localtime')
    `);

    return stmt.run();
  }

  // ============================================
  // COMPATIBILIDAD CON INTERFAZ SQLiteDB (tickets)
  // ============================================

  _mapEstadoToVoucherStatus(estado) {
    const map = { emitido: 'active', activo: 'active', canjeado: 'redeemed', anulado: 'cancelled', expirado: 'expired' };
    return map[String(estado || '').toLowerCase()] || 'active';
  }

  _mapVoucherStatusToEstado(status) {
    const map = { active: 'emitido', redeemed: 'canjeado', cancelled: 'anulado', expired: 'expirado' };
    return map[String(status || '').toLowerCase()] || 'emitido';
  }

  _ensureUser(userIdOrName) {
    if (!userIdOrName) return null;
    const getStmt = this.db.prepare('SELECT id FROM users WHERE id = ?');
    const existing = getStmt.get(String(userIdOrName));
    if (existing && existing.id) return existing.id;
    const insertStmt = this.db.prepare('INSERT INTO users (id, email, full_name, role) VALUES (?, ?, ?, ?)');
    try { insertStmt.run(String(userIdOrName), `${String(userIdOrName)}@local`, String(userIdOrName), 'caja'); } catch (_) {}
    return String(userIdOrName);
  }

  _toTicketShape(v) {
    if (!v) return null;
    return {
      id: v.id,
      ticket_number: v.voucher_code,
      valor: v.amount,
      moneda: v.currency,
      estado: this._mapVoucherStatusToEstado(v.status),
      qr_data: v.qr_data,
      hash_seguridad: v.qr_hash,
      mesa_id: v.issued_at_station_id,
      usuario_emision: v.issued_by_user_id || null,
      usuario_canje: v.redeemed_by_user_id || null,
      created_at: v.issued_at,
      redeemed_at: v.redeemed_at,
      synced: v.synced ?? 0,
      sincronizado: v.synced ?? 0
    };
  }

  async createTicket({ ticket_number, valor, moneda, qr_data, mesa_id = null, usuario_emision = null, hash_seguridad = null }) {
    const id = require('crypto').randomUUID();
    const voucherCode = ticket_number || this.generateVoucherCode();
    const qrData = qr_data || `${voucherCode}|${valor}|${moneda}|${Date.now()}`;
    const qrHash = hash_seguridad || this.generateQRHash(qrData);
    const expiryHours = this.getConfig('voucher_expiry_hours') || 24;
    const expiresAt = new Date(Date.now() + (expiryHours * 60 * 60 * 1000)).toISOString();
    const stationId = mesa_id || 1;
    const userId = usuario_emision ? this._ensureUser(usuario_emision) : 'system-local';
    this._ensureUser(userId);
    const stmt = this.db.prepare(`
      INSERT INTO vouchers (
        id, voucher_code, qr_data, qr_hash, amount, currency,
        issued_by_user_id, issued_at_station_id, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, voucherCode, qrData, qrHash, valor, moneda, userId, stationId, expiresAt);
    this.addAuditLog('voucher_created', userId, stationId, id, { amount: valor, currency: moneda, voucher_code: voucherCode });
    this.addToSyncQueue('create', 'vouchers', this.getVoucherById(id));
    const v = this.getVoucherById(id);
    return this._toTicketShape(v);
  }

  findTicketByNumber(ticketNumber) {
    const stmt = this.db.prepare('SELECT * FROM vouchers WHERE voucher_code = ?');
    const v = stmt.get(String(ticketNumber));
    return this._toTicketShape(v) || undefined;
  }

  getTicketByNumber(ticketNumber) { return this.findTicketByNumber(ticketNumber); }

  updateTicketStatus(ticketNumber, estado, usuario_canje = null) {
    const vStmt = this.db.prepare('SELECT id, status FROM vouchers WHERE voucher_code = ?');
    const v = vStmt.get(String(ticketNumber));
    if (!v) return { changes: 0 };
    const targetStatus = this._mapEstadoToVoucherStatus(estado);
    if (targetStatus === 'redeemed') {
      const userId = this._ensureUser(usuario_canje || 'caja');
      const stationId = 1;
      const res = this.db.prepare(`
        UPDATE vouchers SET status = 'redeemed', redeemed_by_user_id = ?, redeemed_at_station_id = ?, redeemed_at = datetime('now','localtime'), updated_at = datetime('now','localtime'), synced = 0
        WHERE id = ? AND status IN ('active','emitido')
      `).run(userId, stationId, v.id);
      if (res.changes > 0) {
        this.addAuditLog('voucher_redeemed', userId, stationId, v.id);
        this.addToSyncQueue('update', 'vouchers', this.getVoucherById(v.id));
      }
      return res;
    }
    if (targetStatus === 'cancelled') {
      const res = this.db.prepare(`
        UPDATE vouchers SET status = 'cancelled', updated_at = datetime('now','localtime'), synced = 0
        WHERE id = ? AND status IN ('active','emitido')
      `).run(v.id);
      if (res.changes > 0) {
        this.addAuditLog('voucher_cancelled', null, null, v.id);
        this.addToSyncQueue('update', 'vouchers', this.getVoucherById(v.id));
      }
      return res;
    }
    return { changes: 0 };
  }

  getUnsyncedTickets() {
    const stmt = this.db.prepare('SELECT * FROM vouchers WHERE synced = 0 ORDER BY issued_at ASC');
    const rows = stmt.all();
    return rows.map(r => this._toTicketShape(r));
  }

  markAsSynced(ids) {
    if (!Array.isArray(ids) || ids.length === 0) return { changes: 0 };
    const stmt = this.db.prepare(`UPDATE vouchers SET synced = 1 WHERE id IN (${ids.map(() => '?').join(',')})`);
    const info = stmt.run(...ids.map(id => String(id)));
    return info;
  }

  getTicketStats(dateFrom = null, dateTo = null) {
    let where = '';
    const params = [];
    if (dateFrom && dateTo) { where = 'WHERE issued_at BETWEEN ? AND ?'; params.push(dateFrom, dateTo); }
    const stmt = this.db.prepare(`SELECT status, currency, amount FROM vouchers ${where}`);
    const rows = stmt.all(...params);
    const stats = { total_emitidos: 0, total_canjeados: 0, total_anulados: 0, valor_total_dop: 0, valor_total_usd: 0, valor_canjeado_dop: 0, valor_canjeado_usd: 0 };
    for (const r of rows) {
      const estado = this._mapVoucherStatusToEstado(r.status);
      const isUSD = String(r.currency).toUpperCase() === 'USD';
      if (estado === 'emitido') stats.total_emitidos++;
      if (estado === 'canjeado') stats.total_canjeados++;
      if (estado === 'anulado') stats.total_anulados++;
      if (isUSD) stats.valor_total_usd += Number(r.amount); else stats.valor_total_dop += Number(r.amount);
      if (estado === 'canjeado') { if (isUSD) stats.valor_canjeado_usd += Number(r.amount); else stats.valor_canjeado_dop += Number(r.amount); }
    }
    return stats;
  }

  close() {
    this.db.close();
  }
}

// Ejecutable directo para actualizar/migrar la base de datos
if (require.main === module) {
  console.log('🚀 ACTUALIZANDO SQLite: asegurando esquema idéntico y migrando legacy...');
  const dbPath = process.env.CASINO_DB_PATH || process.env.SQLITE_DB_PATH || path.join(process.cwd(), 'data', 'casino.db');
  const db = new CasinoDatabase(dbPath);
  try {
    db.expireOldVouchers();
    console.log('✅ SQLite actualizado en:', db.dbPath);
  } catch (err) {
    console.error('❌ Error al actualizar SQLite:', err.message);
  } finally {
    db.close();
  }
}

module.exports = CasinoDatabase;
