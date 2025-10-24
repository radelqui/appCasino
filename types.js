// src/shared/types.js
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
