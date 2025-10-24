// src/shared/constants.js
module.exports = {
  // Dimensiones del ticket TITO estándar
  TICKET_DIMENSIONS: {
    WIDTH_MM: 156,
    HEIGHT_MM: 65,
    WIDTH_POINTS: 156 * 2.83465, // Conversión mm a puntos
    HEIGHT_POINTS: 65 * 2.83465
  },

  // Estados de tickets
  TICKET_STATES: {
    EMITIDO: 'emitido',
    CANJEADO: 'canjeado',
    ANULADO: 'anulado'
  },

  // Monedas soportadas
  CURRENCIES: {
    DOP: 'DOP',
    USD: 'USD'
  },

  // Configuración de QR
  QR_CONFIG: {
    WIDTH: 200,
    MARGIN: 2,
    ERROR_CORRECTION: 'M'
  },

  // Configuración de impresión
  PRINTER_CONFIG: {
    NAME: 'TM-T20II',
    TIMEOUT: 30000
  },

  // Configuración de sincronización
  SYNC_CONFIG: {
    INTERVAL_MS: 5 * 60 * 1000, // 5 minutos
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY_MS: 5000
  }
};
