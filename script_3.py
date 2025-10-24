# Paso 4: Implementar el generador QR (después del test)
import os

qr_generator_js = '''// src/main/utils/qr-generator.js
const QRCode = require('qrcode');
const crypto = require('crypto');

const SECRET_KEY = process.env.QR_SECRET || 'casino-secret-key-2025';

/**
 * Genera un hash HMAC para los datos del ticket
 * @param {Object} data - Datos del ticket
 * @returns {string} Hash de 16 caracteres
 */
function generateHash(data) {
  const dataString = JSON.stringify({
    id: data.id,
    valor: data.valor,
    moneda: data.moneda,
    fecha: data.fecha
  });
  
  return crypto.createHmac('sha256', SECRET_KEY)
    .update(dataString)
    .digest('hex')
    .substring(0, 16);
}

/**
 * Genera un código QR para un ticket
 * @param {Object} ticketData - Datos del ticket
 * @param {string} ticketData.id - ID único del ticket
 * @param {number} ticketData.valor - Valor monetario
 * @param {string} ticketData.moneda - Moneda (DOP/USD)
 * @param {string} ticketData.fecha - Fecha de emisión
 * @returns {Promise<Object>} Objeto con qrCode, hash y qrString
 */
async function generateTicketQR(ticketData) {
  try {
    // Validar datos de entrada
    if (!ticketData.id || !ticketData.valor || !ticketData.moneda || !ticketData.fecha) {
      throw new Error('Datos de ticket incompletos');
    }

    if (!['DOP', 'USD'].includes(ticketData.moneda)) {
      throw new Error('Moneda no válida');
    }

    if (ticketData.valor <= 0) {
      throw new Error('Valor debe ser mayor que cero');
    }

    // Generar hash de seguridad
    const hash = generateHash(ticketData);
    
    // Crear string para QR: id|valor|moneda|fecha|hash
    const qrString = `${ticketData.id}|${ticketData.valor}|${ticketData.moneda}|${ticketData.fecha}|${hash}`;
    
    // Generar imagen QR
    const qrCode = await QRCode.toDataURL(qrString, {
      width: 200,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      errorCorrectionLevel: 'M'
    });
    
    return {
      qrCode,
      hash,
      qrString
    };
    
  } catch (error) {
    throw new Error(`Error generando QR: ${error.message}`);
  }
}

/**
 * Parsea un string de código QR
 * @param {string} qrString - String del código QR
 * @returns {Object} Datos parseados del ticket
 */
function parseTicketQR(qrString) {
  try {
    const parts = qrString.split('|');
    
    if (parts.length !== 5) {
      throw new Error('Invalid QR format');
    }
    
    const valor = parseFloat(parts[1]);
    if (isNaN(valor)) {
      throw new Error('Valor inválido en QR');
    }
    
    return {
      id: parts[0],
      valor: valor,
      moneda: parts[2],
      fecha: parts[3],
      hash: parts[4]
    };
    
  } catch (error) {
    throw new Error(`Error parseando QR: ${error.message}`);
  }
}

/**
 * Valida la autenticidad de un código QR
 * @param {string} qrString - String del código QR
 * @returns {boolean} True si es válido
 */
function validateTicketQR(qrString) {
  try {
    const parsed = parseTicketQR(qrString);
    
    // Recalcular hash esperado
    const expectedHash = generateHash({
      id: parsed.id,
      valor: parsed.valor,
      moneda: parsed.moneda,
      fecha: parsed.fecha
    });
    
    // Comparar hashes
    return parsed.hash === expectedHash;
    
  } catch (error) {
    console.error('Error validando QR:', error.message);
    return false;
  }
}

/**
 * Genera un número único de ticket
 * @param {number} mesaId - ID de la mesa
 * @returns {string} Número único de ticket
 */
function generateTicketNumber(mesaId = 1) {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 6).toUpperCase();
  return `T${mesaId}${timestamp}${random}`;
}

module.exports = {
  generateTicketQR,
  parseTicketQR,
  validateTicketQR,
  generateTicketNumber
};
'''

with open('tito-casino-system/src/main/utils/qr-generator.js', 'w') as f:
    f.write(qr_generator_js)

print("✅ Generador QR implementado (TDD - Implementation after test)")