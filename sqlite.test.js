// tests/unit/sqlite.test.js
const SQLiteDB = require('../../src/main/database/sqlite');
const { TICKET_STATES, CURRENCIES } = require('../../src/shared/constants');

describe('SQLite Database', () => {
  let db;

  beforeEach(() => {
    // Usar base de datos en memoria para tests
    db = new SQLiteDB(':memory:');
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
  });

  describe('Database Initialization', () => {
    test('should create tables successfully', () => {
      expect(db.db).toBeDefined();

      // Verificar que la tabla existe
      const tables = db.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='tickets'").all();
      expect(tables).toHaveLength(1);
    });

    test('should create indexes', () => {
      const indexes = db.db.prepare("SELECT name FROM sqlite_master WHERE type='index'").all();
      const indexNames = indexes.map(idx => idx.name);

      expect(indexNames).toContain('idx_ticket_number');
      expect(indexNames).toContain('idx_estado');
      expect(indexNames).toContain('idx_synced');
    });
  });

  describe('createTicket', () => {
    test('should create ticket with valid data', async () => {
      const ticketData = {
        ticket_number: 'T001234567890',
        valor: 534.00,
        moneda: 'DOP',
        qr_data: 'T001234567890|534.00|DOP|2025-10-12T08:02:00Z|hash123',
        mesa_id: 1,
        usuario_emision: 'Mesa1',
        hash_seguridad: 'hash123'
      };

      const result = await db.createTicket(ticketData);

      expect(result).toHaveProperty('id');
      expect(result.ticket_number).toBe(ticketData.ticket_number);
      expect(result.valor).toBe(ticketData.valor);
      expect(result.moneda).toBe(ticketData.moneda);
      expect(result.estado).toBe(TICKET_STATES.EMITIDO);
      expect(result.synced).toBe(0);
    });

    test('should throw error for duplicate ticket number', async () => {
      const ticketData = {
        ticket_number: 'T001234567890',
        valor: 100.00,
        moneda: 'USD',
        qr_data: 'test-qr',
        mesa_id: 1
      };

      await db.createTicket(ticketData);

      // Intentar crear ticket con mismo número
      await expect(db.createTicket(ticketData)).rejects.toThrow();
    });

    test('should handle missing optional fields', async () => {
      const minimalData = {
        ticket_number: 'T002',
        valor: 100.00,
        moneda: 'USD',
        qr_data: 'test-qr-2'
      };

      const result = await db.createTicket(minimalData);

      expect(result.mesa_id).toBeNull();
      expect(result.usuario_emision).toBeNull();
    });
  });

  describe('findTicketByNumber', () => {
    beforeEach(async () => {
      await db.createTicket({
        ticket_number: 'T123456',
        valor: 250.00,
        moneda: 'DOP',
        qr_data: 'test-qr',
        mesa_id: 2
      });
    });

    test('should find existing ticket', () => {
      const ticket = db.findTicketByNumber('T123456');

      expect(ticket).toBeTruthy();
      expect(ticket.ticket_number).toBe('T123456');
      expect(ticket.valor).toBe(250.00);
      expect(ticket.moneda).toBe('DOP');
    });

    test('should return undefined for non-existing ticket', () => {
      const ticket = db.findTicketByNumber('T999999');

      expect(ticket).toBeUndefined();
    });
  });

  describe('updateTicketStatus', () => {
    beforeEach(async () => {
      await db.createTicket({
        ticket_number: 'T789',
        valor: 150.00,
        moneda: 'USD',
        qr_data: 'test-qr'
      });
    });

    test('should update ticket to canjeado', () => {
      const result = db.updateTicketStatus('T789', TICKET_STATES.CANJEADO, 'Cajero1');

      expect(result.changes).toBe(1);

      const ticket = db.findTicketByNumber('T789');
      expect(ticket.estado).toBe(TICKET_STATES.CANJEADO);
      expect(ticket.usuario_canje).toBe('Cajero1');
      expect(ticket.fecha_canje).toBeTruthy();
      expect(ticket.synced).toBe(0); // Marcado para sincronización
    });

    test('should return 0 changes for non-existing ticket', () => {
      const result = db.updateTicketStatus('T999', TICKET_STATES.CANJEADO);

      expect(result.changes).toBe(0);
    });
  });

  describe('getUnsyncedTickets', () => {
    beforeEach(async () => {
      // Crear tickets sincronizados y no sincronizados
      await db.createTicket({
        ticket_number: 'T001',
        valor: 100,
        moneda: 'DOP',
        qr_data: 'qr1'
      });

      await db.createTicket({
        ticket_number: 'T002', 
        valor: 200,
        moneda: 'USD',
        qr_data: 'qr2'
      });

      // Marcar uno como sincronizado
      db.markAsSynced([1]);
    });

    test('should return only unsynced tickets', () => {
      const unsynced = db.getUnsyncedTickets();

      expect(unsynced).toHaveLength(1);
      expect(unsynced[0].ticket_number).toBe('T002');
    });
  });

  describe('markAsSynced', () => {
    beforeEach(async () => {
      await db.createTicket({
        ticket_number: 'T001',
        valor: 100,
        moneda: 'DOP', 
        qr_data: 'qr1'
      });
    });

    test('should mark tickets as synced', () => {
      const ticket = db.findTicketByNumber('T001');
      expect(ticket.synced).toBe(0);

      db.markAsSynced([ticket.id]);

      const updatedTicket = db.findTicketByNumber('T001');
      expect(updatedTicket.synced).toBe(1);
    });
  });

  describe('getTicketStats', () => {
    beforeEach(async () => {
      // Crear varios tickets para estadísticas
      await db.createTicket({
        ticket_number: 'T001',
        valor: 100.00,
        moneda: 'DOP',
        qr_data: 'qr1'
      });

      await db.createTicket({
        ticket_number: 'T002',
        valor: 50.00,
        moneda: 'USD',
        qr_data: 'qr2'
      });

      // Canjear uno
      db.updateTicketStatus('T001', TICKET_STATES.CANJEADO);
    });

    test('should calculate correct statistics', () => {
      const stats = db.getTicketStats();

      expect(stats.total_emitidos).toBe(1);
      expect(stats.total_canjeados).toBe(1);
      expect(stats.valor_total_dop).toBe(100.00);
      expect(stats.valor_total_usd).toBe(50.00);
      expect(stats.valor_canjeado_dop).toBe(100.00);
      expect(stats.valor_canjeado_usd).toBe(0);
    });
  });
});
