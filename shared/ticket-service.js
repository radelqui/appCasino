// shared/ticket-service.js
// Servicio centralizado para generación de tickets TITO
// Garantiza consistencia en parámetros y configuración en toda la aplicación

const path = require('path');
const { generateTicketPDF } = require(path.join(__dirname, '..', 'src', 'main', 'utils', 'pdf-generator.js'));

/**
 * Servicio centralizado para gestión de tickets TITO
 *
 * IMPORTANTE: Todos los módulos del sistema deben usar este servicio
 * en lugar de llamar directamente a generateTicketPDF.
 *
 * Garantiza:
 * - Altura consistente de 156mm en todos los tickets
 * - Parámetros estandarizados
 * - Un solo punto de configuración
 * - Facilita mantenimiento y debugging
 */
class TicketService {
  /**
   * Configuración estándar para tickets TITO
   */
  static CONFIG = {
    WIDTH_MM: 80,   // Ancho estándar TITO
    HEIGHT_MM: 156, // Altura estándar TITO (SIEMPRE 156mm)
  };

  /**
   * Genera un PDF de ticket TITO con configuración estandarizada
   *
   * @param {Object} data - Datos del ticket
   * @param {string} data.ticket_number - Código del ticket (requerido)
   * @param {number} data.valor - Monto del ticket
   * @param {string} data.moneda - Moneda (USD/DOP)
   * @param {string} data.fecha_emision - Fecha ISO
   * @param {string} data.qr_code - Datos del QR (JSON string)
   * @param {string} data.mesa_id - ID de la mesa
   * @param {string} data.usuario_emision - Usuario que emitió
   * @param {string} data.operador_nombre - Nombre del operador
   * @param {number} [data.pageWidthMm] - Ancho personalizado (opcional)
   * @param {number} [data.pageHeightMm] - Altura personalizada (opcional)
   *
   * @returns {Promise<Buffer>} Buffer del PDF generado
   *
   * @example
   * const pdfBuffer = await TicketService.generateTicket({
   *   ticket_number: 'PREV-001234',
   *   valor: 100.50,
   *   moneda: 'DOP',
   *   fecha_emision: new Date().toISOString(),
   *   qr_code: JSON.stringify({...}),
   *   mesa_id: 'P01',
   *   usuario_emision: 'admin@casino.com',
   *   operador_nombre: 'Admin'
   * });
   */
  static async generateTicket(data) {
    // Validación básica
    if (!data || typeof data !== 'object') {
      throw new Error('TicketService.generateTicket: data es requerido');
    }

    if (!data.ticket_number) {
      throw new Error('TicketService.generateTicket: ticket_number es requerido');
    }

    // Generar PDF con configuración estandarizada
    return await generateTicketPDF({
      ...data,
      // SIEMPRE usar altura estándar, a menos que se especifique explícitamente
      pageWidthMm: data.pageWidthMm || TicketService.CONFIG.WIDTH_MM,
      pageHeightMm: data.pageHeightMm || TicketService.CONFIG.HEIGHT_MM
    });
  }

  /**
   * Genera un ticket de vista previa (simulación antes de emisión)
   *
   * @param {Object} data - Datos de simulación
   * @returns {Promise<Buffer>} Buffer del PDF
   */
  static async generatePreviewTicket(data) {
    return await TicketService.generateTicket({
      ...data,
      ticket_number: data.ticket_number || '[VISTA PREVIA]'
    });
  }

  /**
   * Obtiene la configuración actual del servicio
   *
   * @returns {Object} Configuración actual
   */
  static getConfig() {
    return { ...TicketService.CONFIG };
  }

  /**
   * Actualiza la configuración del servicio
   * NOTA: Solo usar para casos especiales (testing, configuración dinámica)
   *
   * @param {Object} config - Nueva configuración
   * @param {number} [config.WIDTH_MM] - Nuevo ancho
   * @param {number} [config.HEIGHT_MM] - Nueva altura
   */
  static setConfig(config) {
    if (config.WIDTH_MM !== undefined) {
      TicketService.CONFIG.WIDTH_MM = Number(config.WIDTH_MM);
    }
    if (config.HEIGHT_MM !== undefined) {
      TicketService.CONFIG.HEIGHT_MM = Number(config.HEIGHT_MM);
    }
  }
}

module.exports = {
  TicketService
};
