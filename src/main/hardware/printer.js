// src/main/hardware/printer.js
// Soporta dos modos: PDF (spooler Windows) y ESC/POS (térmica directa)
const fs = require('fs');
const os = require('os');
const path = require('path');
const { print } = require('pdf-to-printer');
const { generateTicketPDF } = require('../utils/pdf-generator');
const { generateTicketQR } = require('../utils/qr-generator');

let ThermalPrinter = null;
let PrinterTypes = null;
try {
  const ntp = require('node-thermal-printer');
  ThermalPrinter = ntp.ThermalPrinter;
  PrinterTypes = ntp.types;
} catch (_) {
  // opcional, solo requerido si PRINT_MODE=ESCPOS
}

class PrinterService {
  constructor() {
    this.name = process.env.PRINTER_NAME || 'EPSON_TM_T20';
    this.mode = (process.env.PRINT_MODE || 'PDF').toUpperCase(); // 'PDF' | 'ESCPOS'
    this.timeout = parseInt(process.env.PRINTER_TIMEOUT || '30000', 10);
    this.paperWidthMm = Number(process.env.TICKET_WIDTH_MM || process.env.TITO_WIDTH_MM || 80);
    this.ticketHeightMm = Number(process.env.TICKET_HEIGHT_MM || process.env.TITO_HEIGHT_MM || 156);
  }

  async printTicket(input) {
    if (this.mode === 'ESCPOS') {
      return this.printEscPosTicket(input);
    }
    return this.printPdfTicket(input);
  }

  async printPdfTicket(input) {
    try {
      let pdfBuffer = null;
      if (input instanceof Buffer) {
        pdfBuffer = input;
      } else if (input && typeof input === 'object') {
        const { ticket_number, valor, moneda, fecha_emision, qr_code, mesa_id, usuario_emision } = input;
        pdfBuffer = await generateTicketPDF({ ticket_number, valor, moneda, fecha_emision, qr_code, mesa_id, usuario_emision, pageWidthMm: this.paperWidthMm, pageHeightMm: this.ticketHeightMm });
      } else {
        console.warn('[Printer:PDF] Entrada inválida, se omite impresión');
        return false;
      }

      const tmpFile = path.join(os.tmpdir(), `tito_${Date.now()}.pdf`);
      fs.writeFileSync(tmpFile, pdfBuffer);
      const WIDTH_MM = this.paperWidthMm;
      const HEIGHT_MM = this.ticketHeightMm;
      const printSettings = `noscale,paper=${WIDTH_MM}x${HEIGHT_MM}mm`;
      await print(tmpFile, { printer: this.name, win32: [ '-print-settings', printSettings ] });
      try { fs.unlinkSync(tmpFile); } catch {}
      console.log(`[Printer:PDF] Impreso en "${this.name}"`);
      return true;
    } catch (e) {
      console.error('[Printer:PDF] Error imprimiendo:', e.message);
      return false;
    }
  }

  async printEscPosTicket(input) {
    if (!ThermalPrinter || !PrinterTypes) {
      console.error('[Printer:ESCPOS] node-thermal-printer no disponible. Instalar dependencia o usar PRINT_MODE=PDF');
      return false;
    }

    try {
      const printer = new ThermalPrinter({
        type: PrinterTypes.EPSON,
        interface: `printer:${this.name}`,
        options: { timeout: this.timeout, width: (this.paperWidthMm <= 62) ? 32 : 48 },
        characterSet: 'CP850',
        removeSpecialCharacters: false,
        lineCharacter: '='
      });

      const ensure = async () => {
        const isConnected = await printer.isPrinterConnected();
        if (!isConnected) console.warn('[Printer:ESCPOS] La impresora no reporta conexión, intentando igualmente...');
      };
      await ensure();

      let data = null;
      if (input && typeof input === 'object' && !(input instanceof Buffer)) {
        data = input;
      } else {
        console.warn('[Printer:ESCPOS] Se esperaba objeto de ticket');
        return false;
      }

      const { ticket_number, valor, moneda, fecha_emision, mesa_id, usuario_emision } = data;
      const { qrString } = await generateTicketQR({ id: ticket_number, valor: Number(valor), moneda, fecha: fecha_emision });

      // Header
      printer.alignCenter();
      printer.bold(true);
      printer.println((process.env.CASINO_NAME || 'CORAL REEF CASINO').toUpperCase());
      printer.bold(false);
      printer.println((process.env.CASINO_SUBTITLE || 'GRAN CASINO SOSÚA').toUpperCase());
      printer.drawLine();
      printer.println(`CASHOUT VOUCHER [${(moneda || 'DOP').toUpperCase()}]`);
      printer.newLine();

      // QR + Barcode
      try { 
        const cellSize = (this.paperWidthMm <= 62) ? 4 : 6;
        printer.printQR(qrString, { cellSize, correction: 'M', model: 2 }); 
      } catch { printer.println('[QR no soportado]'); }
      printer.newLine();
      try { printer.printBarcode(String(ticket_number).replace(/[^A-Za-z0-9]/g, ''), PrinterTypes.BARCODE_CODE128); } catch { printer.println('[BARCODE no soportado]'); }
      printer.newLine();

      // Info
      printer.alignLeft();
      printer.println(`FECHA: ${new Date(fecha_emision).toLocaleString()}`);
      printer.println(`TICKET #: ${ticket_number}`);
      printer.println(`MESA: ${mesa_id || '---'}`);
      printer.newLine();

      // Amount (en letras + numérico)
      const words = this.amountToWordsUpper(Number(valor), moneda);
      printer.println(words);
      printer.bold(true);
      try { printer.setTextSize(2, 2); } catch {}
      printer.println(`${(moneda || 'DOP').toUpperCase() === 'USD' ? 'US$' : 'RD$'} ${Number(valor).toFixed(2)}`);
      try { printer.setTextSize(1, 1); } catch {}
      printer.bold(false);
      printer.newLine();

      // Footer
      printer.println('VÁLIDO POR 365 DÍAS');
      printer.drawLine();
      try { printer.cut(); } catch {}

      const ok = await printer.execute();
      if (!ok) throw new Error('Falló execute()');
      console.log(`[Printer:ESCPOS] Impreso en "${this.name}"`);
      return true;
    } catch (e) {
      console.error('[Printer:ESCPOS] Error imprimiendo:', e.message);
      return false;
    }
  }

  // Conversión simple a letras (ES)
  amountToWordsUpper(n, currency) {
    function toWords(num) {
      const unidades = ['','uno','dos','tres','cuatro','cinco','seis','siete','ocho','nueve'];
      const especiales = ['diez','once','doce','trece','catorce','quince','dieciséis','diecisiete','dieciocho','diecinueve'];
      const decenas = ['','diez','veinte','treinta','cuarenta','cincuenta','sesenta','setenta','ochenta','noventa'];
      const centenas = ['','cien','doscientos','trescientos','cuatrocientos','quinientos','seiscientos','setecientos','ochocientos','novecientos'];
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
    const label = (currency || 'DOP').toUpperCase() === 'USD' ? 'DÓLARES' : 'PESOS DOM.';
    return `${toWords(n)} ${label}`.toUpperCase();
  }

  async testPrinter() {
    const sample = {
      ticket_number: 'TEST-PRINT',
      valor: 123.45,
      moneda: 'DOP',
      fecha_emision: new Date().toISOString(),
      qr_code: null,
      mesa_id: 'TEST',
      usuario_emision: 'SISTEMA'
    };
    return this.printTicket(sample);
  }

  async testCalibration() {
    if (this.mode === 'ESCPOS') {
      if (!ThermalPrinter || !PrinterTypes) return false;
      const printer = new ThermalPrinter({ type: PrinterTypes.EPSON, interface: `printer:${this.name}`, options: { timeout: this.timeout } });
      printer.alignCenter();
      printer.println('=== CALIBRACION ===');
      printer.drawLine();
      printer.println('1234567890'.repeat(4));
      for (let i = 1; i <= 8; i++) { try { printer.setTextSize(i, 1); } catch {} printer.println(`Size ${i}x1`);}        
      try { printer.setTextSize(1, 1); } catch {}
      printer.drawLine();
      printer.println('Bordes y margenes');
      printer.leftRight('LEFT', 'RIGHT');
      try { printer.cut(); } catch {}
      return await printer.execute();
    }
    // PDF: reutiliza ticket de prueba
    return this.testPrinter();
  }

  setProfile(profile = {}) {
    if (profile.width_mm) this.paperWidthMm = Number(profile.width_mm);
    if (profile.height_mm) this.ticketHeightMm = Number(profile.height_mm);
    if (profile.mode) this.mode = String(profile.mode).toUpperCase();
  }

  close() { /* noop */ }
}

module.exports = PrinterService;