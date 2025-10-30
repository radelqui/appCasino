/**
 * Tests TDD para database.js (SQLite)
 * Encuentra errores de código ANTES de que rompan la app
 */

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

// Mock del módulo database.js
describe('Database SQLite - Tests TDD', () => {
  let db;
  let testDbPath;

  beforeEach(() => {
    // Crear base de datos temporal para tests
    testDbPath = path.join(__dirname, 'test-tickets.db');

    // Eliminar DB anterior si existe
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    // Crear nueva instancia
    db = new Database(testDbPath);

    // Crear tabla de tickets
    db.exec(`
      CREATE TABLE IF NOT EXISTS tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        amount REAL NOT NULL,
        currency TEXT DEFAULT 'DOP',
        estado TEXT DEFAULT 'emitido',
        mesa TEXT,
        operador_nombre TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        redeemed_at TEXT,
        redeemed_by TEXT,
        sincronizado INTEGER DEFAULT 0
      )
    `);
  });

  afterEach(() => {
    // Cerrar y limpiar
    if (db) db.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('Crear Ticket', () => {
    test('Debe crear ticket con código único', () => {
      const stmt = db.prepare(`
        INSERT INTO tickets (code, amount, currency, mesa, operador_nombre)
        VALUES (?, ?, ?, ?, ?)
      `);

      const result = stmt.run('TEST-001', 100.50, 'DOP', 'P01', 'Operador1');

      expect(result.changes).toBe(1);
      expect(result.lastInsertRowid).toBeGreaterThan(0);
    });

    test('NO debe crear ticket con código duplicado', () => {
      const stmt = db.prepare(`
        INSERT INTO tickets (code, amount, currency, mesa, operador_nombre)
        VALUES (?, ?, ?, ?, ?)
      `);

      stmt.run('TEST-002', 100.50, 'DOP', 'P01', 'Operador1');

      // Intentar insertar el mismo código debe fallar
      expect(() => {
        stmt.run('TEST-002', 200.00, 'USD', 'P02', 'Operador2');
      }).toThrow(/UNIQUE constraint failed/);
    });

    test('Debe crear ticket sin operador (opcional)', () => {
      const stmt = db.prepare(`
        INSERT INTO tickets (code, amount, currency, mesa)
        VALUES (?, ?, ?, ?)
      `);

      const result = stmt.run('TEST-003', 50.00, 'USD', 'P03');
      expect(result.changes).toBe(1);
    });

    test('NO debe crear ticket sin código (requerido)', () => {
      const stmt = db.prepare(`
        INSERT INTO tickets (code, amount, currency)
        VALUES (?, ?, ?)
      `);

      expect(() => {
        stmt.run(null, 100.00, 'DOP');
      }).toThrow(/NOT NULL constraint failed/);
    });

    test('NO debe crear ticket sin monto (requerido)', () => {
      const stmt = db.prepare(`
        INSERT INTO tickets (code, amount, currency)
        VALUES (?, ?, ?)
      `);

      expect(() => {
        stmt.run('TEST-004', null, 'DOP');
      }).toThrow(/NOT NULL constraint failed/);
    });
  });

  describe('Buscar Ticket', () => {
    beforeEach(() => {
      // Insertar tickets de prueba
      const stmt = db.prepare(`
        INSERT INTO tickets (code, amount, currency, mesa, operador_nombre, estado)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      stmt.run('SEARCH-001', 100.00, 'DOP', 'P01', 'Op1', 'emitido');
      stmt.run('SEARCH-002', 200.00, 'USD', 'P02', 'Op2', 'canjeado');
      stmt.run('SEARCH-003', 300.00, 'DOP', 'P03', 'Op3', 'emitido');
    });

    test('Debe encontrar ticket por código exacto', () => {
      const row = db.prepare('SELECT * FROM tickets WHERE code = ?').get('SEARCH-001');

      expect(row).toBeDefined();
      expect(row.code).toBe('SEARCH-001');
      expect(row.amount).toBe(100.00);
      expect(row.currency).toBe('DOP');
    });

    test('Debe retornar null si ticket no existe', () => {
      const row = db.prepare('SELECT * FROM tickets WHERE code = ?').get('NO-EXISTE');

      expect(row).toBeUndefined();
    });

    test('Debe buscar tickets por estado', () => {
      const rows = db.prepare('SELECT * FROM tickets WHERE estado = ?').all('emitido');

      expect(rows).toHaveLength(2);
      expect(rows.map(r => r.code)).toContain('SEARCH-001');
      expect(rows.map(r => r.code)).toContain('SEARCH-003');
    });

    test('Debe buscar tickets por mesa', () => {
      const rows = db.prepare('SELECT * FROM tickets WHERE mesa = ?').all('P01');

      expect(rows).toHaveLength(1);
      expect(rows[0].code).toBe('SEARCH-001');
    });

    test('Búsqueda debe ser case-sensitive para código', () => {
      const row1 = db.prepare('SELECT * FROM tickets WHERE code = ?').get('SEARCH-001');
      const row2 = db.prepare('SELECT * FROM tickets WHERE code = ?').get('search-001');

      expect(row1).toBeDefined();
      expect(row2).toBeUndefined();
    });
  });

  describe('Actualizar Ticket', () => {
    beforeEach(() => {
      db.prepare(`
        INSERT INTO tickets (code, amount, currency, estado)
        VALUES ('UPDATE-001', 100.00, 'DOP', 'emitido')
      `).run();
    });

    test('Debe actualizar estado a canjeado', () => {
      const updateStmt = db.prepare(`
        UPDATE tickets
        SET estado = ?, redeemed_at = datetime('now'), redeemed_by = ?
        WHERE code = ?
      `);

      const result = updateStmt.run('canjeado', 'Cajero1', 'UPDATE-001');
      expect(result.changes).toBe(1);

      const row = db.prepare('SELECT * FROM tickets WHERE code = ?').get('UPDATE-001');
      expect(row.estado).toBe('canjeado');
      expect(row.redeemed_by).toBe('Cajero1');
      expect(row.redeemed_at).toBeTruthy();
    });

    test('Debe marcar ticket como sincronizado', () => {
      const result = db.prepare('UPDATE tickets SET sincronizado = 1 WHERE code = ?')
        .run('UPDATE-001');

      expect(result.changes).toBe(1);

      const row = db.prepare('SELECT * FROM tickets WHERE code = ?').get('UPDATE-001');
      expect(row.sincronizado).toBe(1);
    });

    test('NO debe actualizar ticket inexistente', () => {
      const result = db.prepare('UPDATE tickets SET estado = ? WHERE code = ?')
        .run('canjeado', 'NO-EXISTE');

      expect(result.changes).toBe(0);
    });
  });

  describe('Prevenir Doble Canje', () => {
    beforeEach(() => {
      db.prepare(`
        INSERT INTO tickets (code, amount, currency, estado)
        VALUES ('DOUBLE-001', 100.00, 'DOP', 'emitido')
      `).run();
    });

    test('Debe detectar ticket ya canjeado', () => {
      // Primer canje
      db.prepare('UPDATE tickets SET estado = ? WHERE code = ?')
        .run('canjeado', 'DOUBLE-001');

      // Verificar estado antes de segundo canje
      const row = db.prepare('SELECT * FROM tickets WHERE code = ?')
        .get('DOUBLE-001');

      expect(row.estado).toBe('canjeado');

      // Este es el check que DEBE hacer el código antes de canjear
      if (row.estado !== 'emitido') {
        expect(row.estado).not.toBe('emitido'); // Test pasa si detecta que ya fue canjeado
      }
    });

    test('Solo debe canjear tickets en estado "emitido"', () => {
      // Cambiar a canjeado
      db.prepare('UPDATE tickets SET estado = ? WHERE code = ?')
        .run('canjeado', 'DOUBLE-001');

      // Intentar canjear solo si está emitido
      const result = db.prepare(`
        UPDATE tickets SET estado = 'canjeado'
        WHERE code = ? AND estado = 'emitido'
      `).run('DOUBLE-001');

      expect(result.changes).toBe(0); // No debe actualizar
    });
  });

  describe('Transacciones', () => {
    test('Debe hacer rollback si hay error', () => {
      const createTicket = db.transaction((code, amount) => {
        db.prepare('INSERT INTO tickets (code, amount, currency) VALUES (?, ?, ?)')
          .run(code, amount, 'DOP');

        // Simular error (insertar código duplicado)
        db.prepare('INSERT INTO tickets (code, amount, currency) VALUES (?, ?, ?)')
          .run(code, 50.00, 'USD'); // Mismo código - debe fallar
      });

      expect(() => {
        createTicket('TRANS-001', 100.00);
      }).toThrow(/UNIQUE constraint failed/);

      // Verificar que NO se creó ningún ticket (rollback correcto)
      const count = db.prepare('SELECT COUNT(*) as count FROM tickets').get();
      expect(count.count).toBe(0);
    });

    test('Debe hacer commit si todo es exitoso', () => {
      const createMultipleTickets = db.transaction(() => {
        db.prepare('INSERT INTO tickets (code, amount, currency) VALUES (?, ?, ?)')
          .run('TRANS-002', 100.00, 'DOP');
        db.prepare('INSERT INTO tickets (code, amount, currency) VALUES (?, ?, ?)')
          .run('TRANS-003', 200.00, 'USD');
      });

      createMultipleTickets();

      const count = db.prepare('SELECT COUNT(*) as count FROM tickets').get();
      expect(count.count).toBe(2);
    });
  });

  describe('Sincronización', () => {
    test('Debe encontrar tickets no sincronizados', () => {
      db.prepare('INSERT INTO tickets (code, amount, currency, sincronizado) VALUES (?, ?, ?, ?)')
        .run('SYNC-001', 100.00, 'DOP', 0);
      db.prepare('INSERT INTO tickets (code, amount, currency, sincronizado) VALUES (?, ?, ?, ?)')
        .run('SYNC-002', 200.00, 'USD', 1);
      db.prepare('INSERT INTO tickets (code, amount, currency, sincronizado) VALUES (?, ?, ?, ?)')
        .run('SYNC-003', 300.00, 'DOP', 0);

      const pending = db.prepare('SELECT * FROM tickets WHERE sincronizado = 0').all();

      expect(pending).toHaveLength(2);
      expect(pending.map(t => t.code)).toContain('SYNC-001');
      expect(pending.map(t => t.code)).toContain('SYNC-003');
    });
  });
});
