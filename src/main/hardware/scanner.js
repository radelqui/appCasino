// src/main/hardware/scanner.js
const { EventEmitter } = require('events');

class ScannerService extends EventEmitter {
  constructor() { super(); }
  async init() { /* En producción, inicializar HID/Serial si aplica */ return true; }
  async testReader() { setTimeout(() => this.emit('scan', 'TEST|1|DOP|2025-01-01T00:00:00.000Z|HASH'), 500); }
  close() { /* noop */ }
}

module.exports = ScannerService;
