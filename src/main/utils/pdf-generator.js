// src/main/utils/pdf-generator.js
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const CONSTANTS = require(path.join(__dirname, '../../../constants.js'));

// Optional deps: sharp (WEBP->PNG) and bwip-js (CODE128)
let sharp = null;
let bwipjs = null;
try { sharp = require('sharp'); } catch (_) {}
try { bwipjs = require('bwip-js'); } catch (_) {}

const mmToPt = (mm) => mm * 2.83465;

function getPalette(moneda) {
  // DOP azul (#0052CC), USD verde (#00A86B)
  if (moneda === 'USD') return { primary: rgb(0, 0.6588, 0.4196) };
  return { primary: rgb(0, 0.3216, 0.8) };
}

function currencyPrefix(moneda) {
  return moneda === 'USD' ? 'US$' : 'RD$';
}

async function loadLogoBuffer() {
  // Busca logo en carpeta de diseño o assets (incluye pure/assets)
  const candidates = [
    path.join('c:/appCasino/Diseño Ticket', 'logo casino.webp'),
    path.join('c:/appCasino/Diseño Ticket', 'diseño con logo.webp'),
    path.join('c:/appCasino/pure/assets', 'logo-coral-reef.png'),
    path.join('c:/appCasino/assets', 'logo-coral-reef.png'),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const buf = fs.readFileSync(p);
        if (p.toLowerCase().endsWith('.webp')) {
          if (!sharp) return null;
          const png = await sharp(buf).png().toBuffer();
          return { buffer: png, type: 'png' };
        }
        return { buffer: buf, type: p.toLowerCase().endsWith('.png') ? 'png' : 'jpg' };
      }
    } catch {}
  }
  return null;
}

async function makeBarcodePng(text) {
  if (!bwipjs || !text) return null;
  try {
    const png = await bwipjs.toBuffer({
      bcid: 'code128',
      text: String(text),
      scale: 2,
      height: 18,
      includetext: false,
      backgroundcolor: 'FFFFFF'
    });
    return png;
  } catch {
    return null;
  }
}

function centerText(text, font, size, pageWidth) {
  const textWidth = font.widthOfTextAtSize(text, size);
  return Math.max(0, (pageWidth - textWidth) / 2);
}

async function embedPngFromDataUrl(pdfDoc, dataUrl) {
  const base64 = dataUrl.split(',')[1];
  const bytes = Buffer.from(base64, 'base64');
  return await pdfDoc.embedPng(bytes);
}

async function generateTicketPDF({ ticket_number, valor, moneda, fecha_emision, qr_code, mesa_id, usuario_emision, operador_nombre, pageWidthMm, pageHeightMm }) {
  if (!ticket_number) throw new Error('Invalid ticket data');

  const pdfDoc = await PDFDocument.create();
  const WIDTH_MM = Number(pageWidthMm || process.env.TICKET_WIDTH_MM || CONSTANTS.TICKET_DIMENSIONS.WIDTH_MM || 80);

  // Cálculo de altura automática si no se provee (objetivo ~100-120mm)
  const logoProbe = await loadLogoBuffer();
  const wordsAll = amountToWordsUpper(Number(valor), moneda);
  const labelCurrencyWord = (moneda || 'DOP').toUpperCase() === 'USD' ? 'DÓLARES' : 'PESOS';
  const idx = wordsAll.indexOf(labelCurrencyWord);
  const hasSecondLine = idx > 0;
  const TOP_PAD_PT = mmToPt(5);
  let estimatedPt = TOP_PAD_PT + 12; // arranque y ligera separación inicial
  if (logoProbe) estimatedPt += 26 + 6; // logo + gap
  estimatedPt += 14 + 22; // separaciones de encabezado
  estimatedPt += 12 + 80; // gap previo al QR + altura QR (aprox en pt)
  estimatedPt += mmToPt(3); // espacio entre QR y número de ticket
  estimatedPt += 15; // separación entre número y bloque de información
  estimatedPt += 5 * 12; // FECHA/HORA/TICKET/MESA/OPERADOR con 12pt entre líneas
  estimatedPt += 15; // antes de monto en letras
  estimatedPt += mmToPt(5); // espacio tras línea 1 letras
  if (hasSecondLine) estimatedPt += mmToPt(5); // espacio tras línea 2 letras
  estimatedPt += mmToPt(3); // antes del monto numérico
  estimatedPt += 26; // altura del monto numérico (24pt aprox) + pequeño margen
  estimatedPt += mmToPt(5); // hasta el footer
  const computedHeightMm = Math.max(90, Math.min(120, Math.round(estimatedPt / 2.83465)));
  const HEIGHT_MM = Number(pageHeightMm ?? computedHeightMm);

  const page = pdfDoc.addPage([mmToPt(WIDTH_MM), mmToPt(HEIGHT_MM)]);
  const { width, height } = page.getSize();

  const fontReg = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontMono = await pdfDoc.embedFont(StandardFonts.Courier);

  const margin = 0; // sin márgenes: la Epson los maneja

  // ⚡ FRANJAS HORIZONTALES arriba y abajo con color MUY transparente (DOP azul, USD verde)
  const palette = getPalette(moneda);
  const stripeHeight = mmToPt(8); // 8mm de alto
  const currencyLabel = (moneda || 'DOP').toUpperCase(); // "DOP" o "USD"

  // Franja SUPERIOR con color muy transparente
  page.drawRectangle({
    x: 0,
    y: height - stripeHeight,
    width: width,
    height: stripeHeight,
    color: palette.primary,
    opacity: 0.15, // 15% transparencia (MUY suave)
  });

  // Franja INFERIOR con color muy transparente
  page.drawRectangle({
    x: 0,
    y: 0,
    width: width,
    height: stripeHeight,
    color: palette.primary,
    opacity: 0.15, // 15% transparencia (MUY suave)
  });

  // Texto en franja SUPERIOR (centrado)
  page.drawText(currencyLabel, {
    x: width - mmToPt(15), // A la derecha
    y: height - stripeHeight / 2 - 3,
    size: 10,
    font: fontBold,
    color: rgb(1, 1, 1), // Blanco
  });

  // Texto en franja INFERIOR (centrado)
  page.drawText(currencyLabel, {
    x: mmToPt(5), // A la izquierda
    y: stripeHeight / 2 - 3,
    size: 10,
    font: fontBold,
    color: rgb(1, 1, 1), // Blanco
  });

  // Texto en negro sobre blanco
  const casinoTitle = (process.env.CASINO_NAME || 'CORAL REEF CASINO');
  const casinoSubtitle = (process.env.CASINO_SUBTITLE || 'GRAN CASINO SOSÚA');

  let y = height - stripeHeight - mmToPt(3); // inicio después de franja superior

  // Logo centrado si existe
  try {
    const logo = logoProbe;
    if (logo) {
      const img = logo.type === 'png' ? await pdfDoc.embedPng(logo.buffer) : await pdfDoc.embedJpg(logo.buffer);
      const lh = 26; // altura del logo en pt
      const lw = (img.width / img.height) * lh;
      const lx = (width - lw) / 2;
      page.drawImage(img, { x: lx, y: y - lh, width: lw, height: lh });
      y -= lh + 6;
    }
  } catch {}

  // Encabezado
  page.drawText(casinoTitle, { x: centerText(casinoTitle, fontReg, 10, width), y, size: 10, font: fontReg });
  y -= 14;
  page.drawText(casinoSubtitle, { x: centerText(casinoSubtitle, fontReg, 9, width), y, size: 9, font: fontReg });

  const titulo = 'CASHOUT VOUCHER';
  y -= 22;
  page.drawText(titulo, { x: centerText(titulo, fontBold, 14, width), y, size: 14, font: fontBold });

  // QR centrado (solo QR, sin código de barras)
  const effectiveQr = qr_code || await QRCode.toDataURL(`${ticket_number}|${valor}|${moneda}|${fecha_emision}`, { margin: 0 });
  const qrImage = await embedPngFromDataUrl(pdfDoc, effectiveQr);
  const qrSize = 80;
  const qrX = (width - qrSize) / 2;
  const qrY = y - qrSize - 12;
  page.drawImage(qrImage, { x: qrX, y: qrY, width: qrSize, height: qrSize });

  // Número de ticket bajo el QR
  y = qrY - mmToPt(3); // entre QR y número de ticket
  const ticketStr = String(ticket_number);
  page.drawText(ticketStr, { x: centerText(ticketStr, fontMono, 9, width), y, size: 9, font: fontMono });
  
  // Información: FECHA, HORA, TICKET, MESA, OPERADOR (cada una en su propia línea)
  y -= 15; // separación entre número y bloque de información
  const d = new Date(fecha_emision);
  const fechaStr = `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`;
  const horaStr = `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
  const operadorStr = String(operador_nombre || usuario_emision || '---');
  const infoLines = [
    `FECHA: ${fechaStr}`,
    `HORA: ${horaStr}`,
    `TICKET #: ${ticket_number}`,
    `MESA: ${mesa_id || '---'}`,
    `OPERADOR: ${operadorStr}`,
  ];
  const lineSpacingPt = 12;
  for (const line of infoLines) {
    page.drawText(line, { x: centerText(line, fontMono, 9, width), y, size: 9, font: fontMono });
    y -= lineSpacingPt; // 12pt entre cada línea
  }

  // Monto: letras en dos líneas y valor numérico grande
  const numeric = `${currencyPrefix(moneda)} ${Number(valor).toFixed(2)}`;
  const labelWord = (moneda || 'DOP').toUpperCase() === 'USD' ? 'DÓLARES' : 'PESOS';
  const idx2 = wordsAll.indexOf(labelWord);
  const line1 = idx2 > 0 ? wordsAll.slice(0, idx2).trim() : wordsAll;
  const line2 = idx2 > 0 ? wordsAll.slice(idx2).trim() : '';

  y -= 15; // antes de monto en letras (15-20pt sugerido)
  if (line1) { page.drawText(line1, { x: centerText(line1, fontReg, 10, width), y, size: 10, font: fontReg }); y -= mmToPt(5); }
  if (line2) { page.drawText(line2, { x: centerText(line2, fontReg, 10, width), y, size: 10, font: fontReg }); y -= mmToPt(5); }

  // Antes del monto numérico: 3mm
  y -= mmToPt(3);
  page.drawText(numeric, { x: centerText(numeric, fontBold, 24, width), y, size: 24, font: fontBold });
  y -= 26; // bajar tras el monto grande para evitar solapamiento

  // Footer: usar Y actual con separación de 5mm
  y -= mmToPt(5);
  const footer = 'VÁLIDO POR 365 DÍAS';
  page.drawText(footer, { x: centerText(footer, fontReg, 8, width), y, size: 8, font: fontReg });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

// Conversión simple de números a letras (ES)
function amountToWordsUpper(n, currency) {
  function toWords(num) {
    const unidades = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
    const especiales = ['diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve'];
    const decenas = ['', 'diez', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
    const centenas = ['', 'cien', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];
    const entero = Math.floor(num);
    if (entero === 0) return 'cero';
    const parts = [];
    const c = Math.floor(entero / 100);
    const d = Math.floor((entero % 100) / 10);
    const u = entero % 10;
    if (c > 0) {
      if (c === 1 && d === 0 && u === 0) parts.push('cien'); else parts.push(centenas[c]);
    }
    if (d === 1) {
      parts.push(especiales[u]);
    } else {
      if (d > 1) parts.push(decenas[d] + (u ? (d === 2 ? 'i' : ' y ') : ''));
      if (u && d !== 2) parts.push(unidades[u]);
      if (d === 2 && u) parts.push(unidades[u]); // veintiuno...
    }
    return parts.join(' ').replace('uno', 'un');
  }
  const label = (currency || 'DOP').toUpperCase() === 'USD' ? 'DÓLARES' : 'PESOS';
  const dec = Math.round((n - Math.floor(n)) * 100);
  const decStr = dec.toString().padStart(2, '0');
  return `${toWords(Math.floor(n))} ${label} CON ${decStr}/100`.toUpperCase();
}

function drawAmount(doc, amountText, currency, isNarrow, pageWidth, pageHeight) {
  const prefix = currency === 'USD' ? 'US$' : 'RD$';
  const label = 'MONTO';
  const value = `${prefix} ${amountText}`;
  const margin = 14;

  if (isNarrow) {
    // En 58 mm: centrar grande cerca del borde inferior
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(label, pageWidth / 2, pageHeight - 50, { align: 'center' });

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(value, pageWidth / 2, pageHeight - 32, { align: 'center' });

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7);
    doc.text('Válido por 365 días', pageWidth / 2, pageHeight - 22, { align: 'center' });
  } else {
    // En 80 mm+: alineación derecha con énfasis tipográfico
    const rightX = pageWidth - margin;
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(label, rightX, pageHeight - 52, { align: 'right' });

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(22);
    doc.text(value, rightX, pageHeight - 30, { align: 'right' });

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('Válido por 365 días', rightX, pageHeight - 18, { align: 'right' });
  }
}

function drawQrAndBarcode(doc, qrCanvas, ticketNumber, isNarrow, pageWidth, pageHeight) {
  const margin = 14;
  const qrSize = isNarrow ? 90 : 105; // más proporcionado
  const qrX = margin;
  const qrY = pageHeight - (qrSize + 70);
  doc.addImage(qrCanvas, 'PNG', qrX, qrY, qrSize, qrSize);

  // Código de barras a la derecha del QR en 80mm y debajo en 58mm
  doc.setFont('Courier', 'normal');
  doc.setFontSize(9);
  if (isNarrow) {
    doc.text(ticketNumber, pageWidth / 2, qrY + qrSize + 10, { align: 'center' });
  } else {
    doc.text(ticketNumber, pageWidth - margin, qrY + 12, { align: 'right' });
  }
}

// sustituir llamado anterior por nuevas funciones
// llamadas integradas en generateTicketPDF; líneas removidas

module.exports = { generateTicketPDF };
