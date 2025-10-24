# Paso 8: Implementar generador PDF (después del test)
import os

pdf_generator_js = '''// src/main/utils/pdf-generator.js
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const { TICKET_DIMENSIONS } = require('../../shared/constants');

/**
 * Genera un PDF para un ticket TITO
 * @param {Object} ticketData - Datos del ticket
 * @returns {Promise<Buffer>} Buffer del PDF generado
 */
async function generateTicketPDF(ticketData) {
  try {
    // Validar datos requeridos
    if (!ticketData.ticket_number || !ticketData.valor || !ticketData.moneda) {
      throw new Error('Datos requeridos faltantes para generar PDF');
    }

    // Crear documento PDF
    const pdfDoc = await PDFDocument.create();
    
    // Agregar página con dimensiones TITO estándar
    const page = pdfDoc.addPage([
      TICKET_DIMENSIONS.WIDTH_POINTS,
      TICKET_DIMENSIONS.HEIGHT_POINTS
    ]);
    
    const { width: pageWidth, height: pageHeight } = page.getSize();
    
    // Cargar fuentes
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const smallFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    
    // Colores
    const blackColor = rgb(0, 0, 0);
    const grayColor = rgb(0.5, 0.5, 0.5);
    
    // ENCABEZADO DEL CASINO
    const casinoName = process.env.CASINO_NAME || 'CASINO EL PARAÍSO';
    page.drawText(casinoName, {
      x: pageWidth / 2 - (casinoName.length * 4), // Centrado aproximado
      y: pageHeight - 25,
      size: 14,
      font: boldFont,
      color: blackColor
    });
    
    // Subtítulo
    page.drawText('CASH OUT TICKET', {
      x: pageWidth / 2 - 50, // Centrado aproximado
      y: pageHeight - 45,
      size: 12,
      font: boldFont,
      color: blackColor
    });
    
    // Línea separadora
    page.drawLine({
      start: { x: 10, y: pageHeight - 55 },
      end: { x: pageWidth - 10, y: pageHeight - 55 },
      thickness: 1,
      color: grayColor
    });
    
    // INFORMACIÓN DEL TICKET
    let yPosition = pageHeight - 75;
    const lineHeight = 15;
    const leftMargin = 15;
    
    // Número de ticket
    page.drawText(`Ticket No: ${ticketData.ticket_number}`, {
      x: leftMargin,
      y: yPosition,
      size: 10,
      font: regularFont,
      color: blackColor
    });
    yPosition -= lineHeight;
    
    // Fecha y hora
    const fechaFormateada = new Date(ticketData.fecha_emision).toLocaleString('es-DO', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    
    page.drawText(`Fecha: ${fechaFormateada}`, {
      x: leftMargin,
      y: yPosition,
      size: 10,
      font: regularFont,
      color: blackColor
    });
    yPosition -= lineHeight;
    
    // Mesa (si está disponible)
    if (ticketData.mesa_id) {
      page.drawText(`Mesa: ${ticketData.mesa_id}`, {
        x: leftMargin,
        y: yPosition,
        size: 10,
        font: regularFont,
        color: blackColor
      });
      yPosition -= lineHeight;
    }
    
    // VALOR DEL TICKET (destacado)
    const valorTexto = `${ticketData.moneda} $${ticketData.valor.toFixed(2)}`;
    page.drawText('Valor:', {
      x: leftMargin,
      y: yPosition,
      size: 12,
      font: boldFont,
      color: blackColor
    });
    
    page.drawText(valorTexto, {
      x: leftMargin + 50,
      y: yPosition,
      size: 16,
      font: boldFont,
      color: blackColor
    });
    yPosition -= 25;
    
    // CÓDIGO QR
    if (ticketData.qr_code) {
      try {
        // Extraer datos base64 del data URL
        const base64Data = ticketData.qr_code.split(',')[1];
        if (base64Data) {
          const qrImageBytes = Buffer.from(base64Data, 'base64');
          
          // Intentar incrustar como PNG
          let qrImage;
          try {
            qrImage = await pdfDoc.embedPng(qrImageBytes);
          } catch (pngError) {
            // Si falla PNG, intentar como JPEG
            try {
              qrImage = await pdfDoc.embedJpg(qrImageBytes);
            } catch (jpgError) {
              console.warn('No se pudo incrustar código QR:', jpgError.message);
            }
          }
          
          if (qrImage) {
            // Posicionar QR en la parte derecha
            const qrSize = 75;
            const qrX = pageWidth - qrSize - 15;
            const qrY = pageHeight - 130;
            
            page.drawImage(qrImage, {
              x: qrX,
              y: qrY,
              width: qrSize,
              height: qrSize
            });
            
            // Etiqueta para el QR
            page.drawText('Código QR', {
              x: qrX + 10,
              y: qrY - 15,
              size: 8,
              font: regularFont,
              color: grayColor
            });
          }
        }
      } catch (error) {
        console.error('Error incrustando código QR:', error.message);
        // Continuar sin QR si hay error
      }
    }
    
    // TEXTO LEGAL Y TÉRMINOS
    yPosition = 50; // Posición fija cerca del final
    
    page.drawText('TÉRMINOS Y CONDICIONES:', {
      x: leftMargin,
      y: yPosition,
      size: 8,
      font: boldFont,
      color: blackColor
    });
    yPosition -= 12;
    
    const terminos = [
      '• Este ticket representa valor monetario real.',
      '• Válido únicamente en cajas autorizadas.',
      '• No transferible. Conserve hasta el canje.',
      '• Sujeto a verificación y términos del casino.'
    ];
    
    terminos.forEach(termino => {
      page.drawText(termino, {
        x: leftMargin,
        y: yPosition,
        size: 7,
        font: regularFont,
        color: blackColor
      });
      yPosition -= 10;
    });
    
    // INFORMACIÓN ADICIONAL
    if (ticketData.usuario_emision) {
      page.drawText(`Emisor: ${ticketData.usuario_emision}`, {
        x: leftMargin,
        y: 15,
        size: 7,
        font: regularFont,
        color: grayColor
      });
    }
    
    // Número de ticket en pequeño al final (para referencia)
    page.drawText(`#${ticketData.ticket_number}`, {
      x: pageWidth - 80,
      y: 5,
      size: 6,
      font: regularFont,
      color: grayColor
    });
    
    // Generar y retornar PDF
    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
    
  } catch (error) {
    throw new Error(`Error generando PDF del ticket: ${error.message}`);
  }
}

/**
 * Genera un PDF de prueba para verificar la impresora
 * @returns {Promise<Buffer>} Buffer del PDF de prueba
 */
async function generateTestPDF() {
  try {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([
      TICKET_DIMENSIONS.WIDTH_POINTS,
      TICKET_DIMENSIONS.HEIGHT_POINTS
    ]);
    
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    
    page.drawText('PRUEBA DE IMPRESIÓN', {
      x: width / 2 - 80,
      y: height / 2,
      size: 14,
      font: font
    });
    
    page.drawText('Sistema TITO - Test Print', {
      x: width / 2 - 70,
      y: height / 2 - 20,
      size: 10,
      font: font
    });
    
    page.drawText(new Date().toLocaleString(), {
      x: width / 2 - 60,
      y: height / 2 - 40,
      size: 8,
      font: font
    });
    
    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
    
  } catch (error) {
    throw new Error(`Error generando PDF de prueba: ${error.message}`);
  }
}

/**
 * Valida los datos del ticket antes de generar PDF
 * @param {Object} ticketData - Datos del ticket
 * @throws {Error} Si los datos son inválidos
 */
function validateTicketData(ticketData) {
  const required = ['ticket_number', 'valor', 'moneda', 'fecha_emision'];
  
  for (const field of required) {
    if (!ticketData[field]) {
      throw new Error(`Campo requerido faltante: ${field}`);
    }
  }
  
  if (typeof ticketData.valor !== 'number' || ticketData.valor <= 0) {
    throw new Error('El valor debe ser un número mayor que cero');
  }
  
  if (!['DOP', 'USD'].includes(ticketData.moneda)) {
    throw new Error(`Moneda inválida: ${ticketData.moneda}`);
  }
  
  // Validar formato de fecha
  const fecha = new Date(ticketData.fecha_emision);
  if (isNaN(fecha.getTime())) {
    throw new Error('Formato de fecha inválido');
  }
}

module.exports = {
  generateTicketPDF,
  generateTestPDF,
  validateTicketData
};
'''

with open('tito-casino-system/src/main/utils/pdf-generator.js', 'w') as f:
    f.write(pdf_generator_js)

print("✅ Generador PDF implementado (TDD - Implementation after test)")