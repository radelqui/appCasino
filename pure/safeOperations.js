// pure/safeOperations.js - Wrappers seguros con timeouts para operaciones críticas

/**
 * Ejecuta una operación con timeout
 * @param {Function} operation - Función asíncrona a ejecutar
 * @param {number} timeoutMs - Timeout en milisegundos
 * @param {string} operationName - Nombre de la operación (para logs)
 * @returns {Promise<any>}
 */
async function withTimeout(operation, timeoutMs, operationName = 'Operación') {
  return Promise.race([
    operation(),
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`${operationName} excedió timeout de ${timeoutMs}ms`)),
        timeoutMs
      )
    )
  ]);
}

/**
 * Wrapper seguro para operaciones de base de datos SQLite
 */
class SafeDatabaseOperations {
  constructor(db, healthMonitor) {
    this.db = db;
    this.health = healthMonitor;
  }

  /**
   * Ejecuta una consulta SELECT con timeout
   */
  async safeQuery(query, params = [], timeout = 5000) {
    const endOperation = this.health.startOperation('db_query', timeout);
    try {
      const result = await withTimeout(
        () => {
          return new Promise((resolve, reject) => {
            try {
              const stmt = this.db.db.prepare(query);
              const data = params.length > 0 ? stmt.all(...params) : stmt.all();
              resolve(data);
            } catch (e) {
              reject(e);
            }
          });
        },
        timeout,
        'DB Query'
      );
      endOperation();
      return { success: true, data: result };
    } catch (error) {
      endOperation();
      console.error('❌ [SafeDB] Error en query:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Ejecuta un INSERT/UPDATE con timeout
   */
  async safeWrite(query, params = [], timeout = 5000) {
    const endOperation = this.health.startOperation('db_write', timeout);
    try {
      const result = await withTimeout(
        () => {
          return new Promise((resolve, reject) => {
            try {
              const stmt = this.db.db.prepare(query);
              const info = params.length > 0 ? stmt.run(...params) : stmt.run();
              resolve(info);
            } catch (e) {
              reject(e);
            }
          });
        },
        timeout,
        'DB Write'
      );
      endOperation();
      return { success: true, changes: result.changes, lastInsertRowid: result.lastInsertRowid };
    } catch (error) {
      endOperation();
      console.error('❌ [SafeDB] Error en write:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Crea un ticket de forma segura
   */
  async safeCreateTicket(ticketData, timeout = 10000) {
    const endOperation = this.health.startOperation('db_create_ticket', timeout);
    try {
      const result = await withTimeout(
        () => {
          return new Promise((resolve, reject) => {
            try {
              const ticket = this.db.createTicket(ticketData);
              resolve(ticket);
            } catch (e) {
              reject(e);
            }
          });
        },
        timeout,
        'Create Ticket'
      );
      endOperation();
      return { success: true, ticket: result };
    } catch (error) {
      endOperation();
      console.error('❌ [SafeDB] Error creando ticket:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Obtiene un ticket de forma segura
   */
  async safeGetTicket(code, timeout = 3000) {
    const endOperation = this.health.startOperation('db_get_ticket', timeout);
    try {
      const result = await withTimeout(
        () => {
          return new Promise((resolve, reject) => {
            try {
              const ticket = this.db.getTicket(code);
              resolve(ticket);
            } catch (e) {
              reject(e);
            }
          });
        },
        timeout,
        'Get Ticket'
      );
      endOperation();
      return { success: true, ticket: result };
    } catch (error) {
      endOperation();
      console.error('❌ [SafeDB] Error obteniendo ticket:', error.message);
      return { success: false, error: error.message };
    }
  }
}

/**
 * Wrapper seguro para operaciones de Supabase
 */
class SafeSupabaseOperations {
  constructor(supabaseManager, healthMonitor) {
    this.supabase = supabaseManager;
    this.health = healthMonitor;
  }

  /**
   * Crea un voucher con timeout
   */
  async safeCreateVoucher(voucherData, timeout = 15000) {
    if (!this.supabase || !this.supabase.isAvailable()) {
      return { success: false, error: 'Supabase no disponible' };
    }

    const endOperation = this.health.startOperation('supabase_create_voucher', timeout);
    try {
      const result = await withTimeout(
        () => this.supabase.createVoucher(voucherData),
        timeout,
        'Supabase Create Voucher'
      );
      endOperation();
      return result;
    } catch (error) {
      endOperation();
      console.error('❌ [SafeSupabase] Error creando voucher:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Obtiene un voucher con timeout
   */
  async safeGetVoucher(code, timeout = 10000) {
    if (!this.supabase || !this.supabase.isAvailable()) {
      return { success: false, error: 'Supabase no disponible' };
    }

    const endOperation = this.health.startOperation('supabase_get_voucher', timeout);
    try {
      const result = await withTimeout(
        () => this.supabase.getVoucher(code),
        timeout,
        'Supabase Get Voucher'
      );
      endOperation();
      return result;
    } catch (error) {
      endOperation();
      console.error('❌ [SafeSupabase] Error obteniendo voucher:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Actualiza estado de voucher con timeout
   */
  async safeUpdateVoucherStatus(code, status, userId, stationId, timeout = 10000) {
    if (!this.supabase || !this.supabase.isAvailable()) {
      return { success: false, error: 'Supabase no disponible' };
    }

    const endOperation = this.health.startOperation('supabase_update_voucher', timeout);
    try {
      const result = await withTimeout(
        () => this.supabase.updateVoucherStatus(code, status, userId, stationId),
        timeout,
        'Supabase Update Voucher'
      );
      endOperation();
      return result;
    } catch (error) {
      endOperation();
      console.error('❌ [SafeSupabase] Error actualizando voucher:', error.message);
      return { success: false, error: error.message };
    }
  }
}

/**
 * Wrapper seguro para operaciones de impresora
 */
class SafePrinterOperations {
  constructor(printer, healthMonitor) {
    this.printer = printer;
    this.health = healthMonitor;
  }

  /**
   * Imprime con timeout
   */
  async safePrint(data, timeout = 30000) {
    if (!this.printer) {
      return { success: false, error: 'Impresora no disponible' };
    }

    const endOperation = this.health.startOperation('printer_print', timeout);
    try {
      const result = await withTimeout(
        () => {
          return new Promise((resolve, reject) => {
            try {
              if (typeof this.printer.printTicket === 'function') {
                this.printer.printTicket(data);
                resolve({ success: true });
              } else {
                reject(new Error('Método printTicket no disponible'));
              }
            } catch (e) {
              reject(e);
            }
          });
        },
        timeout,
        'Printer Print'
      );
      endOperation();
      return result;
    } catch (error) {
      endOperation();
      console.error('❌ [SafePrinter] Error imprimiendo:', error.message);
      return { success: false, error: error.message };
    }
  }
}

module.exports = {
  withTimeout,
  SafeDatabaseOperations,
  SafeSupabaseOperations,
  SafePrinterOperations
};
