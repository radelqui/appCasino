// tests/unit for CasinoDatabase adapter compatibility
const CasinoDatabase = require('./SqulInstrucciones/database');
const { TICKET_STATES, CURRENCIES } = require('./constants');

describe('CasinoDatabase Adapter (tickets compatibility)', () => {
  let db;

  beforeEach(() => {
    // Usar base en memoria para aislar
    db = new CasinoDatabase(':memory:');
  });

  afterEach(() => {
    if (db) db.close();
  });

  describe('Inicialización', () => {
    test('crea tabla vouchers y índices', () => {
      const tables = db.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='vouchers'").all();
      expect(tables).toHaveLength(1);
      const idx = db.db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_vouchers_%'").all();
      expect(idx.length).toBeGreaterThan(0);
    });
  });

  describe('createTicket', () => {
    test('crea ticket con datos válidos y mapea campos', async () => {
      const ticketData = {
        ticket_number: 'T-ADPTR-001',
        valor: 250.00,
        moneda: CURRENCIES.DOP,
        qr_data: 'qr-data-001',
        mesa_id: 1,
        usuario_emision: 'Mesa1',
        hash_seguridad: 'hash-001'
      };

      const result = await db.createTicket(ticketData);

      expect(result).toHaveProperty('id');
      expect(result.ticket_number).toBe(ticketData.ticket_number);
      expect(result.valor).toBe(ticketData.valor);
      expect(result.moneda).toBe(ticketData.moneda);
      expect(result.estado).toBe(TICKET_STATES.EMITIDO);
      expect(result.synced).toBe(0);
    });

    test('maneja campos opcionales faltantes', async () => {
      const minimal = { ticket_number: 'T-ADPTR-002', valor: 100.00, moneda: CURRENCIES.USD, qr_data: 'qr2' };
      const result = await db.createTicket(minimal);
      expect(result.mesa_id).toBeDefined(); // default stationId 1
      expect(result.usuario_emision === null || typeof result.usuario_emision === 'string').toBeTruthy();
    });
  });

  describe('findTicketByNumber', () => {
    beforeEach(async () => {
      await db.createTicket({ ticket_number: 'T-ADPTR-003', valor: 75.00, moneda: CURRENCIES.DOP, qr_data: 'qr3' });
    });

    test('encuentra ticket existente', () => {
      const t = db.findTicketByNumber('T-ADPTR-003');
      expect(t).toBeTruthy();
      expect(t.ticket_number).toBe('T-ADPTR-003');
      expect(t.valor).toBe(75.00);
      expect(t.moneda).toBe(CURRENCIES.DOP);
    });

    test('retorna undefined para ticket inexistente', () => {
      const t = db.findTicketByNumber('NO-EXISTE');
      expect(t).toBeUndefined();
    });
  });

  describe('updateTicketStatus', () => {
    beforeEach(async () => {
      await db.createTicket({ ticket_number: 'T-ADPTR-004', valor: 150.00, moneda: CURRENCIES.USD, qr_data: 'qr4' });
    });

    test('actualiza a canjeado y marca para sync', () => {
      const res = db.updateTicketStatus('T-ADPTR-004', TICKET_STATES.CANJEADO, 'Cajero1');
      expect(res.changes).toBe(1);
      const t = db.findTicketByNumber('T-ADPTR-004');
      expect(t.estado).toBe(TICKET_STATES.CANJEADO);
      expect(t.usuario_canje).toBe('Cajero1');
      expect(t.redeemed_at).toBeTruthy();
      expect(t.synced).toBe(0);
    });

    test('no cambia si ticket no existe', () => {
      const res = db.updateTicketStatus('NO-EXISTE', TICKET_STATES.CANJEADO);
      expect(res.changes).toBe(0);
    });
  });

  describe('Sincronización', () => {
    beforeEach(async () => {
      await db.createTicket({ ticket_number: 'T-ADPTR-005', valor: 100, moneda: CURRENCIES.DOP, qr_data: 'qr5' });
      await db.createTicket({ ticket_number: 'T-ADPTR-006', valor: 200, moneda: CURRENCIES.USD, qr_data: 'qr6' });
    });

    test('getUnsyncedTickets retorna no sincronizados', () => {
      const unsynced = db.getUnsyncedTickets();
      expect(unsynced.length).toBeGreaterThanOrEqual(2);
      const ids = unsynced.map(u => u.id);
      db.markAsSynced([ids[0]]);
      const after = db.getUnsyncedTickets();
      expect(after.find(t => t.id === ids[0])).toBeUndefined();
    });
  });

  describe('Estadísticas', () => {
    beforeEach(async () => {
      await db.createTicket({ ticket_number: 'T-ADPTR-007', valor: 100.00, moneda: CURRENCIES.DOP, qr_data: 'qr7' });
      await db.createTicket({ ticket_number: 'T-ADPTR-008', valor: 50.00, moneda: CURRENCIES.USD, qr_data: 'qr8' });
      db.updateTicketStatus('T-ADPTR-007', TICKET_STATES.CANJEADO);
    });

    test('getTicketStats calcula correctamente', () => {
      const stats = db.getTicketStats();
      expect(stats.total_emitidos).toBeGreaterThanOrEqual(1);
      expect(stats.total_canjeados).toBeGreaterThanOrEqual(1);
      expect(stats.valor_total_dop).toBeGreaterThanOrEqual(100.00);
      expect(stats.valor_total_usd).toBeGreaterThanOrEqual(50.00);
      expect(stats.valor_canjeado_dop).toBeGreaterThanOrEqual(100.00);
      expect(stats.valor_canjeado_usd).toBeGreaterThanOrEqual(0);
    });
  });
});

