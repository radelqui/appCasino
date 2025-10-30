// src/main/ipc/ticketHandlers.js
const { ipcMain } = require('electron');
const { generateTicketQR, generateTicketNumber, validateTicketQR, parseTicketQR } = require('../security/qr-crypto');
const { generateTicketPDF } = require('../utils/pdf-generator');

function registerTicketHandlers({ db, supabaseSync, printer }) {
  ipcMain.handle('generate-ticket', async (event, ticketData) => {
    try {
      if (!ticketData.valor || !ticketData.moneda) throw new Error('Datos de ticket incompletos');
      if (ticketData.valor <= 0) throw new Error('El valor debe ser mayor que cero');
      if (!['DOP', 'USD'].includes(ticketData.moneda)) throw new Error('Moneda inválida');

      const ticketNumber = generateTicketNumber(ticketData.mesa_id);
      const fechaEmision = new Date().toISOString();

      const qrResult = await generateTicketQR({
        id: ticketNumber,
        valor: ticketData.valor,
        moneda: ticketData.moneda,
        fecha: fechaEmision
      });

      const ticket = await db.createTicket({
        ticket_number: ticketNumber,
        valor: ticketData.valor,
        moneda: ticketData.moneda,
        qr_data: qrResult.qrString,
        mesa_id: ticketData.mesa_id || null,
        usuario_emision: ticketData.usuario_emision || null,
        hash_seguridad: qrResult.hash
      });

      const pdfBuffer = await generateTicketPDF({
        ticket_number: ticketNumber,
        valor: ticketData.valor,
        moneda: ticketData.moneda,
        fecha_emision: fechaEmision,
        qr_code: qrResult.qrCode,
        mesa_id: ticketData.mesa_id,
        usuario_emision: ticketData.usuario_emision,
        operador_nombre: ticketData.operador_nombre || ticketData.usuario_emision
      });

      if (printer && typeof printer.printTicket === 'function') {
        await printer.printTicket(pdfBuffer);
      }

      return {
        success: true,
        ticket_number: ticketNumber,
        ticket_id: ticket.id,
        valor: ticketData.valor,
        moneda: ticketData.moneda
      };
    } catch (error) {
      console.error('[IPC:generate-ticket] Error:', error.message);
      throw new Error(error.message);
    }
  });

  ipcMain.handle('validate-ticket', async (event, qrString) => {
    try {
      if (!validateTicketQR(qrString)) throw new Error('Código QR inválido o alterado');

      const qrData = parseTicketQR(qrString);
      const ticket = db.findTicketByNumber(qrData.id);

      if (!ticket) {
        if (supabaseSync && supabaseSync.isAvailable()) {
          try {
            const remoteTicket = await supabaseSync.getTicketByNumber(qrData.id);
            if (remoteTicket) {
              await db.createTicket({ ...remoteTicket });
              return { success: true, ticket: remoteTicket, source: 'remote' };
            }
          } catch (remoteError) {
            console.warn('Error buscando ticket remoto:', remoteError.message);
          }
        }
        throw new Error('Ticket no encontrado en el sistema');
      }

      if (ticket.estado !== 'emitido' && ticket.estado !== 'activo') {
        throw new Error(`Ticket ya ${ticket.estado}`);
      }

      return { success: true, ticket: ticket, source: 'local' };
    } catch (error) {
      console.error('[IPC:validate-ticket] Error:', error.message);
      throw new Error(error.message);
    }
  });

  ipcMain.handle('process-payment', async (event, paymentData) => {
    try {
      const { ticket_number, usuario_canje } = paymentData || {};
      if (!ticket_number) throw new Error('Número de ticket requerido');

      const result = db.updateTicketStatus(ticket_number, 'canjeado', usuario_canje);

      if (result && result.changes > 0) {
        return { success: true, message: 'Pago procesado exitosamente', ticket_number };
      } else {
        throw new Error('No se pudo actualizar el ticket. Es posible que no exista o ya esté canjeado.');
      }
    } catch (error) {
      console.error('[IPC:process-payment] Error:', error.message);
      throw new Error(error.message);
    }
  });
}

module.exports = { registerTicketHandlers };
