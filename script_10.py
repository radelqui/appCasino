# Paso 11: Crear servicio de Supabase para sincronización
import os

supabase_service_js = '''// src/main/database/supabase.js
const { createClient } = require('@supabase/supabase-js');

/**
 * Servicio para sincronización con Supabase
 */
class SupabaseSync {
  constructor() {
    // Configuración de Supabase
    this.supabaseUrl = process.env.SUPABASE_URL;
    this.supabaseKey = process.env.SUPABASE_ANON_KEY;
    
    if (!this.supabaseUrl || !this.supabaseKey) {
      console.warn('Configuración de Supabase faltante. Funcionalidad de sincronización deshabilitada.');
      this.supabase = null;
      return;
    }
    
    try {
      this.supabase = createClient(this.supabaseUrl, this.supabaseKey);
      console.log('Cliente Supabase inicializado correctamente');
    } catch (error) {
      console.error('Error inicializando Supabase:', error.message);
      this.supabase = null;
    }
    
    // Configuración de reintentos
    this.retryConfig = {
      maxRetries: 3,
      retryDelay: 2000,
      backoffMultiplier: 2
    };
  }

  /**
   * Verifica si Supabase está disponible
   * @returns {boolean} True si está disponible
   */
  isAvailable() {
    return this.supabase !== null;
  }

  /**
   * Prueba la conexión con Supabase
   * @returns {Promise<boolean>} True si la conexión es exitosa
   */
  async testConnection() {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      // Hacer una consulta simple para probar la conexión
      const { data, error } = await this.supabase
        .from('tickets')
        .select('count')
        .limit(1);

      if (error) {
        console.error('Error probando conexión Supabase:', error.message);
        return false;
      }

      console.log('✅ Conexión con Supabase exitosa');
      return true;

    } catch (error) {
      console.error('Error de red con Supabase:', error.message);
      return false;
    }
  }

  /**
   * Sincroniza tickets locales con Supabase
   * @param {Array} tickets - Lista de tickets a sincronizar
   * @returns {Promise<Object>} Resultado de la sincronización
   */
  async syncTickets(tickets) {
    if (!this.isAvailable()) {
      throw new Error('Supabase no está disponible');
    }

    if (!Array.isArray(tickets) || tickets.length === 0) {
      return { synced: 0, errors: [] };
    }

    console.log(`Iniciando sincronización de ${tickets.length} tickets...`);
    
    const results = {
      synced: 0,
      errors: [],
      total: tickets.length
    };

    // Procesar tickets en lotes para evitar timeouts
    const batchSize = 10;
    for (let i = 0; i < tickets.length; i += batchSize) {
      const batch = tickets.slice(i, i + batchSize);
      
      try {
        await this.syncTicketBatch(batch);
        results.synced += batch.length;
        
      } catch (error) {
        console.error(`Error sincronizando lote ${i / batchSize + 1}:`, error.message);
        results.errors.push({
          batch: i / batchSize + 1,
          error: error.message,
          tickets: batch.map(t => t.ticket_number)
        });
      }
    }

    console.log(`Sincronización completada: ${results.synced}/${results.total} tickets`);
    return results;
  }

  /**
   * Sincroniza un lote de tickets
   * @param {Array} ticketBatch - Lote de tickets
   * @returns {Promise<void>}
   */
  async syncTicketBatch(ticketBatch) {
    const ticketsToSync = ticketBatch.map(ticket => ({
      ticket_number: ticket.ticket_number,
      valor: ticket.valor,
      moneda: ticket.moneda,
      fecha_emision: ticket.fecha_emision,
      fecha_canje: ticket.fecha_canje,
      estado: ticket.estado,
      qr_data: ticket.qr_data,
      mesa_id: ticket.mesa_id,
      usuario_emision: ticket.usuario_emision,
      usuario_canje: ticket.usuario_canje,
      hash_seguridad: ticket.hash_seguridad
    }));

    const { data, error } = await this.supabase
      .from('tickets')
      .upsert(ticketsToSync, { 
        onConflict: 'ticket_number',
        ignoreDuplicates: false 
      });

    if (error) {
      throw new Error(`Error en upsert: ${error.message}`);
    }

    return data;
  }

  /**
   * Obtiene un ticket por número desde Supabase
   * @param {string} ticketNumber - Número del ticket
   * @returns {Promise<Object|null>} Ticket encontrado o null
   */
  async getTicketByNumber(ticketNumber) {
    if (!this.isAvailable()) {
      throw new Error('Supabase no está disponible');
    }

    try {
      const { data, error } = await this.supabase
        .from('tickets')
        .select('*')
        .eq('ticket_number', ticketNumber)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        throw error;
      }

      return data;

    } catch (error) {
      console.error('Error obteniendo ticket desde Supabase:', error.message);
      throw error;
    }
  }

  /**
   * Obtiene estadísticas de tickets desde Supabase
   * @param {string} dateFrom - Fecha desde
   * @param {string} dateTo - Fecha hasta
   * @returns {Promise<Object>} Estadísticas calculadas
   */
  async getTicketStats(dateFrom, dateTo) {
    if (!this.isAvailable()) {
      throw new Error('Supabase no está disponible');
    }

    try {
      let query = this.supabase
        .from('tickets')
        .select('valor, moneda, estado, fecha_emision');

      if (dateFrom && dateTo) {
        query = query
          .gte('fecha_emision', dateFrom)
          .lte('fecha_emision', dateTo);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      return this.calculateStats(data);

    } catch (error) {
      console.error('Error obteniendo estadísticas desde Supabase:', error.message);
      throw error;
    }
  }

  /**
   * Calcula estadísticas de tickets
   * @param {Array} tickets - Lista de tickets
   * @returns {Object} Estadísticas calculadas
   */
  calculateStats(tickets) {
    const stats = {
      total_tickets: tickets.length,
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

    tickets.forEach(ticket => {
      const { estado, moneda, valor } = ticket;

      // Contadores por estado
      switch (estado) {
        case 'emitido':
          stats.total_emitidos++;
          if (moneda === 'DOP') {
            stats.valor_pendiente_dop += valor;
          } else {
            stats.valor_pendiente_usd += valor;
          }
          break;
        case 'canjeado':
          stats.total_canjeados++;
          if (moneda === 'DOP') {
            stats.valor_canjeado_dop += valor;
          } else {
            stats.valor_canjeado_usd += valor;
          }
          break;
        case 'anulado':
          stats.total_anulados++;
          break;
      }

      // Valor total por moneda
      if (moneda === 'DOP') {
        stats.valor_total_dop += valor;
      } else {
        stats.valor_total_usd += valor;
      }
    });

    return stats;
  }

  /**
   * Obtiene tickets por rango de fechas desde Supabase
   * @param {string} dateFrom - Fecha desde
   * @param {string} dateTo - Fecha hasta
   * @param {string} estado - Estado específico (opcional)
   * @returns {Promise<Array>} Lista de tickets
   */
  async getTicketsByDateRange(dateFrom, dateTo, estado = null) {
    if (!this.isAvailable()) {
      throw new Error('Supabase no está disponible');
    }

    try {
      let query = this.supabase
        .from('tickets')
        .select('*')
        .gte('fecha_emision', dateFrom)
        .lte('fecha_emision', dateTo);

      if (estado) {
        query = query.eq('estado', estado);
      }

      query = query.order('fecha_emision', { ascending: false });

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      return data || [];

    } catch (error) {
      console.error('Error obteniendo tickets por rango de fechas:', error.message);
      throw error;
    }
  }

  /**
   * Ejecuta sincronización con reintentos
   * @param {Function} operation - Operación a ejecutar
   * @param {number} attempt - Intento actual
   * @returns {Promise<*>} Resultado de la operación
   */
  async executeWithRetry(operation, attempt = 1) {
    try {
      return await operation();
      
    } catch (error) {
      if (attempt >= this.retryConfig.maxRetries) {
        throw error;
      }

      const delay = this.retryConfig.retryDelay * 
                   Math.pow(this.retryConfig.backoffMultiplier, attempt - 1);
      
      console.warn(`Intento ${attempt} falló, reintentando en ${delay}ms:`, error.message);
      
      await this.sleep(delay);
      return this.executeWithRetry(operation, attempt + 1);
    }
  }

  /**
   * Utilidad para sleep
   * @param {number} ms - Milisegundos a esperar
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Obtiene el estado de la conexión
   * @returns {Object} Estado de la conexión
   */
  getConnectionStatus() {
    return {
      isAvailable: this.isAvailable(),
      url: this.supabaseUrl,
      hasApiKey: !!this.supabaseKey,
      lastError: this.lastError || null
    };
  }

  /**
   * Cierra la conexión con Supabase
   */
  close() {
    // Supabase no requiere cerrar conexiones explícitamente
    console.log('SupabaseSync cerrado');
  }
}

module.exports = SupabaseSync;
'''

with open('tito-casino-system/src/main/database/supabase.js', 'w') as f:
    f.write(supabase_service_js)

print("✅ Servicio de Supabase creado")