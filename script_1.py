# Paso 2: Crear archivos de configuración y constantes
import os

# Crear archivo de constantes compartidas
constants_js = '''// src/shared/constants.js
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
'''

with open('tito-casino-system/src/shared/constants.js', 'w') as f:
    f.write(constants_js)

# Crear tipos compartidos
types_js = '''// src/shared/types.js
/**
 * @typedef {Object} Ticket
 * @property {string} id - ID único del ticket
 * @property {string} ticket_number - Número del ticket
 * @property {number} valor - Valor monetario
 * @property {string} moneda - Moneda (DOP/USD)
 * @property {string} fecha_emision - Fecha de emisión
 * @property {string|null} fecha_canje - Fecha de canje
 * @property {string} estado - Estado del ticket
 * @property {string} qr_data - Datos del código QR
 * @property {number|null} mesa_id - ID de la mesa
 * @property {string|null} usuario_emision - Usuario que emitió
 * @property {string|null} usuario_canje - Usuario que canjeó
 * @property {string} hash_seguridad - Hash de seguridad
 */

/**
 * @typedef {Object} QRData
 * @property {string} id - ID del ticket
 * @property {number} valor - Valor
 * @property {string} moneda - Moneda
 * @property {string} fecha - Fecha
 * @property {string} hash - Hash de seguridad
 */

/**
 * @typedef {Object} TicketGeneration
 * @property {number} valor - Valor del ticket
 * @property {string} moneda - Moneda
 * @property {number} mesa_id - ID de la mesa
 * @property {string} usuario_emision - Usuario que emite
 */

module.exports = {};
'''

with open('tito-casino-system/src/shared/types.js', 'w') as f:
    f.write(types_js)

# Crear archivo de configuración de entorno
env_example = '''# .env.example
# Configuración de Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# Clave secreta para hash de QR
QR_SECRET=your-secret-key-for-qr-hashing

# Entorno
NODE_ENV=development

# Configuración de impresora
PRINTER_NAME=TM-T20II

# Configuración de base de datos local
SQLITE_DB_PATH=./data/tito.db
'''

with open('tito-casino-system/.env.example', 'w') as f:
    f.write(env_example)

print("✅ Archivos de configuración creados")