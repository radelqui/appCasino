const { ThermalPrinter, PrinterTypes } = require('node-thermal-printer');
const QRCode = require('qrcode');

class PrinterManager {
  constructor(options = {}) {
    const name = process.env.PRINTER_NAME || options.name || 'TM-T20II';
    const interfaceStr = `printer:${name}`;
    this.printer = new ThermalPrinter({
      type: PrinterTypes.EPSON,
      interface: interfaceStr,
      width: options.width || 48,
      options: {
        timeout: options.timeout || 2000
      }
    });
  }

  async printVoucher(voucher) {
    if (!voucher) throw new Error('Voucher is required');
    const {
      voucher_code,
      amount,
      currency = 'USD',
      qr_data,
      issued_at,
      station_name,
      issued_by_name
    } = voucher;

    const qrText = qr_data || `${voucher_code}|${amount}|${currency}|${Date.now()}`;
    const qrBuffer = await QRCode.toBuffer(qrText, { type: 'png', scale: 6 });

    this.printer.alignCenter();
    this.printer.setTextQuadArea();
    this.printer.println('CASINO');
    this.printer.setTextNormal();
    this.printer.newLine();
    this.printer.println('Voucher');
    this.printer.println(`${currency} ${amount.toFixed ? amount.toFixed(2) : amount}`);
    this.printer.newLine();
    this.printer.println(`Código: ${voucher_code}`);
    if (issued_at) this.printer.println(`Fecha: ${new Date(issued_at).toLocaleString()}`);
    if (station_name) this.printer.println(`Estación: ${station_name}`);
    if (issued_by_name) this.printer.println(`Emitido por: ${issued_by_name}`);
    this.printer.newLine();
    this.printer.printImageBuffer(qrBuffer);
    this.printer.newLine();
    this.printer.cut();

    const ok = await this.printer.execute();
    return ok;
  }

  async test() {
    this.printer.alignCenter();
    this.printer.println('TEST DE IMPRESIÓN');
    this.printer.newLine();
    this.printer.println(`Impresora: ${process.env.PRINTER_NAME || 'TM-T20II'}`);
    this.printer.cut();
    return this.printer.execute();
  }
}

module.exports = PrinterManager;

