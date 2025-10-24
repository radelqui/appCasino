// src/main/utils/qr-generator.js
const QRCode = require('qrcode');
const CryptoJS = require('crypto-js');

const SECRET = process.env.QR_SECRET || 'DEV_SECRET_CHANGE_ME';

function shortHashHex(str) {
  const hash = CryptoJS.HmacMD5(str, SECRET); // 16-hex length when truncated
  const hex = CryptoJS.enc.Hex.stringify(hash);
  return hex.slice(0, 16);
}

async function generateTicketQR({ id, valor, moneda, fecha }) {
  if (!id || typeof valor !== 'number' || !moneda || !fecha) {
    throw new Error('Invalid ticket data for QR generation');
  }
  const payload = `${id}|${Number(valor).toFixed(2)}|${moneda}|${fecha}`;
  const hash = shortHashHex(payload);
  const qrString = `${payload}|${hash}`;
  const qrCode = await QRCode.toDataURL(qrString, { margin: 0, errorCorrectionLevel: 'M' });
  return { qrCode, hash, qrString };
}

function parseTicketQR(qrString) {
  if (!qrString || typeof qrString !== 'string') throw new Error('Invalid QR format');
  const parts = qrString.split('|');
  if (parts.length !== 5) throw new Error('Invalid QR format');
  const [id, valorStr, moneda, fecha, hash] = parts;
  const valor = parseFloat(valorStr);
  return { id, valor, moneda, fecha, hash };
}

function validateTicketQR(qrString) {
  try {
    const { id, valor, moneda, fecha, hash } = parseTicketQR(qrString);
    const payload = `${id}|${Number(valor).toFixed(2)}|${moneda}|${fecha}`;
    const expected = shortHashHex(payload);
    return hash === expected;
  } catch {
    return false;
  }
}

module.exports = { generateTicketQR, parseTicketQR, validateTicketQR };
