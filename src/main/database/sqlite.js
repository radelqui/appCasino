// src/main/database/sqlite.js
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

class SQLiteDB {
  constructor(dbPathArg) {
    const dbPath = dbPathArg || process.env.SQLITE_DB_PATH || path.join(process.cwd(), 'data', 'casino.db');
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    this.db = new Database(dbPath);
    this._init();
  }

  _init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_number TEXT UNIQUE,
        valor REAL NOT NULL,
        moneda TEXT NOT NULL,
        estado TEXT NOT NULL DEFAULT 'emitido',
        qr_data TEXT,
        hash_seguridad TEXT,
        mesa_id TEXT,
        usuario_emision TEXT,
        usuario_canje TEXT,
        created_at TEXT NOT NULL,
        redeemed_at TEXT,
        sincronizado INTEGER NOT NULL DEFAULT 0
      );
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT,
        message TEXT,
        created_at TEXT NOT NULL
      );
    `);
  }

  createTicket({ ticket_number, valor, moneda, qr_data, mesa_id, usuario_emision, hash_seguridad }) {
    const created_at = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO tickets (ticket_number, valor, moneda, estado, qr_data, hash_seguridad, mesa_id, usuario_emision, created_at)
      VALUES (?, ?, ?, 'emitido', ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(ticket_number, valor, moneda, qr_data || null, hash_seguridad || null, mesa_id || null, usuario_emision || null, created_at);
    return { id: info.lastInsertRowid, ticket_number, valor, moneda, estado: 'emitido', created_at };
  }

  findTicketByNumber(ticket_number) {
    const stmt = this.db.prepare(`SELECT * FROM tickets WHERE ticket_number = ? LIMIT 1`);
    return stmt.get(ticket_number) || null;
  }

  getTicketByNumber(ticket_number) { return this.findTicketByNumber(ticket_number); }

  updateTicketStatus(ticket_number, estado, usuario_canje = null) {
    const redeemed_at = estado === 'canjeado' ? new Date().toISOString() : null;
    const stmt = this.db.prepare(`
      UPDATE tickets SET estado = ?, usuario_canje = COALESCE(?, usuario_canje), redeemed_at = COALESCE(?, redeemed_at)
      WHERE ticket_number = ? AND estado IN ('emitido','activo')
    `);
    const info = stmt.run(estado, usuario_canje, redeemed_at, ticket_number);
    return info; // { changes }
  }

  getUnsyncedTickets() {
    const stmt = this.db.prepare(`SELECT * FROM tickets WHERE sincronizado = 0`);
    return stmt.all();
  }

  markAsSynced(ids) {
    if (!ids || ids.length === 0) return { changes: 0 };
    const stmt = this.db.prepare(`UPDATE tickets SET sincronizado = 1 WHERE id IN (${ids.map(() => '?').join(',')})`);
    const info = stmt.run(...ids);
    return info;
  }

  getTicketStats(dateFrom, dateTo) {
    const clauses = [];
    const params = [];
    if (dateFrom) { clauses.push('created_at >= ?'); params.push(dateFrom); }
    if (dateTo) { clauses.push('created_at <= ?'); params.push(dateTo); }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const resumen = this.db.prepare(`
      SELECT estado, COUNT(*) as cantidad, SUM(valor) as suma
      FROM tickets ${where}
      GROUP BY estado
    `).all(...params);

    const total = this.db.prepare(`
      SELECT COUNT(*) as totalTickets, SUM(valor) as totalValor FROM tickets ${where}
    `).get(...params);

    return { resumen, total };
  }

  logEvent(type, message) {
    const stmt = this.db.prepare(`INSERT INTO logs (type, message, created_at) VALUES (?, ?, ?)`);
    return stmt.run(type, message, new Date().toISOString());
  }

  close() { try { this.db.close(); } catch {} }
}

module.exports = SQLiteDB;
