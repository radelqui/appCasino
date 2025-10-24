# Paso 6: Implementar SQLite Database (después del test)
import os

sqlite_js = '''// src/main/database/sqlite.js
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { TICKET_STATES, CURRENCIES } = require('../../shared/constants');

/**
 * Clase para manejar la base de datos SQLite local
 */
class SQLiteDB {
  constructor(dbPath = null) {
    // Configurar ruta de la base de datos
    if (dbPath === ':memory:') {
      this.dbPath = dbPath;
    } else {
      const defaultPath = dbPath || process.env.SQLITE_DB_PATH || path.join(__dirname, '../../../data/tito.db');
      
      // Crear directorio si no existe
      const dbDir = path.dirname(defaultPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }
      
      this.dbPath = defaultPath;
    }
    
    // Inicializar base de datos
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL'); // Mejor rendimiento
    this.db.pragma('foreign_keys = ON');   // Habilitar foreign keys
    
    this.initTables();
  }

  /**
   * Inicializa las tablas de la base de datos
   */
  initTables() {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_number TEXT UNIQUE NOT NULL,
        valor REAL NOT NULL CHECK (valor > 0),
        moneda TEXT NOT NULL CHECK (moneda IN ('DOP', 'USD')),
        fecha_emision DATETIME DEFAULT CURRENT_TIMESTAMP,
        fecha_canje DATETIME NULL,
        estado TEXT NOT NULL DEFAULT 'emitido' CHECK (estado IN ('emitido', 'canjeado', 'anulado')),
        qr_data TEXT NOT NULL,
        mesa_id INTEGER NULL,
        usuario_emision TEXT NULL,
        usuario_canje TEXT NULL,
        hash_seguridad TEXT NULL,
        synced INTEGER DEFAULT 0 CHECK (synced IN (0, 1)),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    this.db.exec(createTableSQL);
    
    // Crear índices para mejorar rendimiento
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_ticket_number ON tickets(ticket_number)',
      'CREATE INDEX IF NOT EXISTS idx_estado ON tickets(estado)',
      'CREATE INDEX IF NOT EXISTS idx_synced ON tickets(synced)',
      'CREATE INDEX IF NOT EXISTS idx_fecha_emision ON tickets(fecha_emision)',
      'CREATE INDEX IF NOT EXISTS idx_mesa_id ON tickets(mesa_id)'
    ];
    
    indexes.forEach(indexSQL => {
      this.db.exec(indexSQL);
    });
    
    // Crear trigger para actualizar updated_at
    const triggerSQL = `
      CREATE TRIGGER IF NOT EXISTS update_tickets_updated_at 
      AFTER UPDATE ON tickets
      BEGIN
        UPDATE tickets SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END
    `;
    
    this.db.exec(triggerSQL);
  }

  /**
   * Crea un nuevo ticket
   * @param {Object} ticketData - Datos del ticket
   * @returns {Promise<Object>} Ticket creado
   */
  async createTicket(ticketData) {
    const {
      ticket_number,
      valor,
      moneda,
      qr_data,
      mesa_id = null,
      usuario_emision = null,
      hash_seguridad = null
    } = ticketData;

    // Validaciones
    if (!ticket_number || !valor || !moneda || !qr_data) {
      throw new Error('Datos requeridos faltantes para crear ticket');
    }

    if (!Object.values(CURRENCIES).includes(moneda)) {
      throw new Error(`Moneda inválida: ${moneda}`);
    }

    if (valor <= 0) {
      throw new Error('El valor debe ser mayor que cero');
    }

    try {
      const stmt = this.db.prepare(`
        INSERT INTO tickets (
          ticket_number, 
          valor, 
          moneda, 
          qr_data, 
          mesa_id, 
          usuario_emision, 
          hash_seguridad
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      
      const result = stmt.run(
        ticket_number,
        valor,
        moneda,
        qr_data,
        mesa_id,
        usuario_emision,
        hash_seguridad
      );
      
      return this.findTicketById(result.lastInsertRowid);
      
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        throw new Error(`Ticket con número ${ticket_number} ya existe`);
      }
      throw new Error(`Error creando ticket: ${error.message}`);
    }
  }

  /**
   * Busca un ticket por ID
   * @param {number} id - ID del ticket
   * @returns {Object|undefined} Ticket encontrado
   */
  findTicketById(id) {
    const stmt = this.db.prepare('SELECT * FROM tickets WHERE id = ?');
    return stmt.get(id);
  }

  /**
   * Busca un ticket por número
   * @param {string} ticketNumber - Número del ticket
   * @returns {Object|undefined} Ticket encontrado
   */
  findTicketByNumber(ticketNumber) {
    const stmt = this.db.prepare('SELECT * FROM tickets WHERE ticket_number = ?');
    return stmt.get(ticketNumber);
  }

  /**
   * Actualiza el estado de un ticket
   * @param {string} ticketNumber - Número del ticket
   * @param {string} estado - Nuevo estado
   * @param {string} usuarioCanje - Usuario que canjea (opcional)
   * @returns {Object} Resultado de la actualización
   */
  updateTicketStatus(ticketNumber, estado, usuarioCanje = null) {
    if (!Object.values(TICKET_STATES).includes(estado)) {
      throw new Error(`Estado inválido: ${estado}`);
    }

    const stmt = this.db.prepare(`
      UPDATE tickets 
      SET 
        estado = ?, 
        fecha_canje = CASE WHEN ? = 'canjeado' THEN CURRENT_TIMESTAMP ELSE fecha_canje END,
        usuario_canje = ?, 
        synced = 0
      WHERE ticket_number = ?
    `);
    
    return stmt.run(estado, estado, usuarioCanje, ticketNumber);
  }

  /**
   * Obtiene tickets no sincronizados
   * @returns {Array} Lista de tickets no sincronizados
   */
  getUnsyncedTickets() {
    const stmt = this.db.prepare('SELECT * FROM tickets WHERE synced = 0 ORDER BY created_at ASC');
    return stmt.all();
  }

  /**
   * Marca tickets como sincronizados
   * @param {Array<number>} ticketIds - IDs de tickets a marcar
   */
  markAsSynced(ticketIds) {
    if (!Array.isArray(ticketIds) || ticketIds.length === 0) {
      return;
    }

    const stmt = this.db.prepare('UPDATE tickets SET synced = 1 WHERE id = ?');
    const transaction = this.db.transaction((ids) => {
      for (const id of ids) {
        stmt.run(id);
      }
    });
    
    transaction(ticketIds);
  }

  /**
   * Obtiene estadísticas de tickets
   * @param {string} dateFrom - Fecha desde (opcional)
   * @param {string} dateTo - Fecha hasta (opcional)
   * @returns {Object} Estadísticas calculadas
   */
  getTicketStats(dateFrom = null, dateTo = null) {
    let whereClause = '';
    const params = [];
    
    if (dateFrom && dateTo) {
      whereClause = 'WHERE fecha_emision BETWEEN ? AND ?';
      params.push(dateFrom, dateTo);
    }
    
    const stmt = this.db.prepare(`
      SELECT 
        estado,
        moneda,
        valor,
        COUNT(*) as count,
        SUM(valor) as total_valor
      FROM tickets 
      ${whereClause}
      GROUP BY estado, moneda
    `);
    
    const results = stmt.all(...params);
    
    // Calcular estadísticas
    const stats = {
      total_emitidos: 0,
      total_canjeados: 0,
      total_anulados: 0,
      valor_total_dop: 0,
      valor_total_usd: 0,
      valor_canjeado_dop: 0,
      valor_canjeado_usd: 0,
      valor_pendiente_dop: 0,
      valor_pendiente_usd: 0
    };
    
    results.forEach(row => {
      const { estado, moneda, count, total_valor } = row;
      
      if (estado === TICKET_STATES.EMITIDO) {
        stats.total_emitidos += count;
        if (moneda === CURRENCIES.DOP) {
          stats.valor_pendiente_dop += total_valor;
        } else {
          stats.valor_pendiente_usd += total_valor;
        }
      } else if (estado === TICKET_STATES.CANJEADO) {
        stats.total_canjeados += count;
        if (moneda === CURRENCIES.DOP) {
          stats.valor_canjeado_dop += total_valor;
        } else {
          stats.valor_canjeado_usd += total_valor;
        }
      } else if (estado === TICKET_STATES.ANULADO) {
        stats.total_anulados += count;
      }
      
      // Valor total incluye todos los estados
      if (moneda === CURRENCIES.DOP) {
        stats.valor_total_dop += total_valor;
      } else {
        stats.valor_total_usd += total_valor;
      }
    });
    
    return stats;
  }

  /**
   * Obtiene tickets por rango de fechas
   * @param {string} dateFrom - Fecha desde
   * @param {string} dateTo - Fecha hasta
   * @param {string} estado - Estado específico (opcional)
   * @returns {Array} Lista de tickets
   */
  getTicketsByDateRange(dateFrom, dateTo, estado = null) {
    let sql = 'SELECT * FROM tickets WHERE fecha_emision BETWEEN ? AND ?';
    const params = [dateFrom, dateTo];
    
    if (estado && Object.values(TICKET_STATES).includes(estado)) {
      sql += ' AND estado = ?';
      params.push(estado);
    }
    
    sql += ' ORDER BY fecha_emision DESC';
    
    const stmt = this.db.prepare(sql);
    return stmt.all(...params);
  }

  /**
   * Cierra la conexión a la base de datos
   */
  close() {
    if (this.db) {
      this.db.close();
    }
  }

  /**
   * Ejecuta una transacción
   * @param {Function} callback - Función que contiene las operaciones
   * @returns {*} Resultado de la transacción
   */
  transaction(callback) {
    return this.db.transaction(callback)();
  }
}

module.exports = SQLiteDB;
'''

with open('tito-casino-system/src/main/database/sqlite.js', 'w') as f:
    f.write(sqlite_js)

print("✅ SQLite Database implementado (TDD - Implementation after test)")