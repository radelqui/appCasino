const { ipcMain } = require('electron');
const path = require('path');
const SQLiteDB = require('../../src/main/database/sqlite');
const { registerIpcHandlers } = require('../../src/main/ipc');

// Mock de servicios externos
const mockPrinter = {
  printTicket: jest.fn().mockResolvedValue({ success: true }),
};

const mockSupabaseSync = {
  isAvailable: jest.fn().mockReturnValue(true),
  syncTickets: jest.fn().mockImplementation(async (tickets) => {
    // Simula una sincronización exitosa para todos los tickets enviados
    return { syncedTickets: tickets, errors: [] };
  }),
  getTicketByNumber: jest.fn().mockResolvedValue(null), // Simula que el ticket no existe remotamente al inicio
};

describe('Integración del Flujo Principal de Tickets', () => {
  let db;
  let performSync;

  // 1. CONFIGURACIÓN: Se ejecuta antes de todas las pruebas del archivo
  beforeAll(() => {
    // Usar una base de datos en memoria para aislamiento y velocidad
    db = new SQLiteDB(path.join(__dirname, 'test-main-flow.sqlite'));

    // La función performSync necesita acceso a la DB y a Supabase
    performSync = async () => {
      const unsyncedTickets = db.getUnsyncedTickets();
      if (unsyncedTickets.length > 0) {
        const { syncedTickets } = await mockSupabaseSync.syncTickets(unsyncedTickets);
        if (syncedTickets.length > 0) {
          const syncedIds = syncedTickets.map(t => t.id);
          db.markAsSynced(syncedIds);
        }
      }
    };

    // Registrar todos los manejadores IPC con los servicios reales y mocks
    registerIpcHandlers({
      db,
      printer: mockPrinter,
      supabaseSync: mockSupabaseSync,
      performSync,
    });
  });

  // 2. LIMPIEZA: Se ejecuta después de cada prueba para mantener el estado limpio
  afterEach(() => {
    // Limpiar la tabla de tickets para que cada test sea independiente
    db.prepare('DELETE FROM tickets').run();
    // Resetear los mocks
    jest.clearAllMocks();
  });

  // 3. CIERRE: Se ejecuta al final de todas las pruebas
  afterAll(() => {
    db.close();
  });

  // 4. TEST PRINCIPAL: Simula el ciclo de vida completo de un ticket
  it('debe manejar el ciclo de vida completo: generación, validación, canje y sincronización', async () => {
    // --- PASO 1: Generación de Ticket (Mesa) ---
    console.log('🧪 Paso 1: Generando ticket...');
    const generateHandler = ipcMain.getHandler('generate-ticket');
    const ticketData = {
      valor: 100,
      moneda: 'USD',
      mesa_id: 'MESA-01',
      usuario_emision: 'user-mesa',
    };

    const generationResult = await generateHandler({}, ticketData);

    // VALIDACIÓN: Generación
    expect(generationResult.success).toBe(true);
    expect(generationResult.ticket_number).toBeDefined();
    expect(mockPrinter.printTicket).toHaveBeenCalledTimes(1); // Verificar impresión simulada

    // Verificar en la base de datos local
    const ticketInDb = db.findTicketByNumber(generationResult.ticket_number);
    expect(ticketInDb).toBeDefined();
    expect(ticketInDb.estado).toBe('emitido');
    expect(ticketInDb.sincronizado).toBe(0);
    console.log('✅ Ticket generado y guardado localmente.');

    // --- PASO 2: Validación de Ticket (Caja) ---
    console.log('🧪 Paso 2: Validando ticket...');
    const validateHandler = ipcMain.getHandler('validate-ticket');
    const qrString = ticketInDb.qr_data; // Usar el QR real guardado en la DB

    const validationResult = await validateHandler({}, qrString);

    // VALIDACIÓN: Validación
    expect(validationResult.success).toBe(true);
    expect(validationResult.source).toBe('local');
    expect(validationResult.ticket.ticket_number).toBe(generationResult.ticket_number);
    expect(validationResult.ticket.estado).toBe('emitido');
    console.log('✅ Ticket validado correctamente desde la base de datos local.');

    // --- PASO 3: Canje de Ticket (Caja) ---
    console.log('🧪 Paso 3: Canjeando ticket...');
    const paymentHandler = ipcMain.getHandler('process-payment');
    const paymentData = {
      ticket_number: generationResult.ticket_number,
      usuario_canje: 'user-caja',
    };

    const paymentResult = await paymentHandler({}, paymentData);

    // VALIDACIÓN: Canje
    expect(paymentResult.success).toBe(true);
    expect(paymentResult.message).toContain('procesado exitosamente');

    // Verificar actualización de estado en la base de datos
    const ticketAfterPayment = db.findTicketByNumber(generationResult.ticket_number);
    expect(ticketAfterPayment.estado).toBe('canjeado');
    expect(ticketAfterPayment.usuario_canje).toBe('user-caja');
    console.log('✅ Ticket canjeado y estado actualizado en la base de datos.');

    // --- PASO 4: Intento de Doble Canje (Error Esperado) ---
    console.log('🧪 Paso 4: Intentando canjear el mismo ticket de nuevo...');
    const validateAgainResult = await validateHandler({}, qrString);

    // VALIDACIÓN: Doble Canje
    // El manejador de validación ahora debe lanzar un error
    await expect(validateHandler({}, qrString)).rejects.toThrow('Ticket ya canjeado');
    console.log('✅ Se impidió correctamente un doble canje.');

    // --- PASO 5: Sincronización con Supabase ---
    console.log('🧪 Paso 5: Forzando sincronización...');
    const syncHandler = ipcMain.getHandler('force-sync');
    const syncResult = await syncHandler({});

    // VALIDACIÓN: Sincronización
    expect(syncResult.success).toBe(true);
    expect(mockSupabaseSync.syncTickets).toHaveBeenCalledTimes(1);

    // Verificar que el ticket enviado a Supabase tiene el estado 'canjeado'
    const syncedTicketPayload = mockSupabaseSync.syncTickets.mock.calls[0][0][0];
    expect(syncedTicketPayload.ticket_number).toBe(generationResult.ticket_number);
    expect(syncedTicketPayload.estado).toBe('canjeado');

    // Verificar que el ticket se marcó como sincronizado en la base de datos local
    const ticketAfterSync = db.findTicketByNumber(generationResult.ticket_number);
    expect(ticketAfterSync.sincronizado).toBe(1);
    console.log('✅ Ticket sincronizado con el sistema remoto.');

    // --- PASO 6: Verificar que no hay más tickets para sincronizar ---
    console.log('🧪 Paso 6: Verificando que no quedan tickets pendientes...');
    await performSync(); // Llamar a la lógica de sincronización de nuevo
    
    // VALIDACIÓN: No más sincronizaciones
    // syncTickets no debería ser llamado de nuevo porque no hay tickets pendientes
    expect(mockSupabaseSync.syncTickets).toHaveBeenCalledTimes(1); 
    console.log('✅ El sistema no intenta resincronizar tickets ya sincronizados.');
  });
});