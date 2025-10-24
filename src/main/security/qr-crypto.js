// src/main/security/qr-crypto.js
const QRCode = require('qrcode');
const CryptoJS = require('crypto-js');

const SECRET = process.env.QR_SECRET || 'DEV_SECRET_CHANGE_ME';

function generateTicketNumber(mesa_id = '000') {
  const now = new Date();
  const y = String(now.getFullYear()).slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const H = String(now.getHours()).padStart(2, '0');
  const M = String(now.getMinutes()).padStart(2, '0');
  const S = String(now.getSeconds()).padStart(2, '0');
  const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${y}${m}${d}-${mesa_id}-${H}${M}${S}-${rand}`;
}

function computeHash(payload) {
  const str = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const hash = CryptoJS.HmacSHA256(str, SECRET);
  return CryptoJS.enc.Hex.stringify(hash);
}

async function generateTicketQR({ id, valor, moneda, fecha }) {
  const payload = { id, valor, moneda, fecha };
  const hash = computeHash(payload);
  const qrString = `${id}|${valor}|${moneda}|${fecha}|${hash}`;
  const qrCode = await QRCode.toDataURL(qrString, { margin: 0, errorCorrectionLevel: 'M' });
  return { qrString, qrCode, hash };
}

function parseTicketQR(qrString) {
  if (!qrString || typeof qrString !== 'string') throw new Error('QR inválido');
  const parts = qrString.split('|');
  if (parts.length !== 5) throw new Error('Formato QR inválido');
  const [id, valorStr, moneda, fecha, hash] = parts;
  const valor = parseFloat(valorStr);
  return { id, valor, moneda, fecha, hash };
}

function validateTicketQR(qrString) {
  try {
    const { id, valor, moneda, fecha, hash } = parseTicketQR(qrString);
    const payload = { id, valor, moneda, fecha };
    const expected = computeHash(payload);
    return expected === hash;
  } catch {
    return false;
  }
}

module.exports = { generateTicketQR, generateTicketNumber, validateTicketQR, parseTicketQR };
