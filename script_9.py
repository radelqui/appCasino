# Paso 10: Crear servicio para lector QR
import os

qr_reader_service_js = '''// src/main/hardware/qr-reader.js
const HID = require('node-hid');
const EventEmitter = require('events');

/**
 * Servicio para manejar el lector de códigos QR
 */
class QRReaderService extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.vendorId = options.vendorId || null; // Se detectará automáticamente
    this.productId = options.productId || null;
    this.device = null;
    this.isConnected = false;
    this.buffer = '';
    this.lastScanTime = 0;
    this.scanCooldown = 1000; // 1 segundo entre escaneos
    
    // Configuración del lector
    this.config = {
      timeout: options.timeout || 5000,
      encoding: options.encoding || 'ascii',
      minLength: options.minLength || 10,
      maxLength: options.maxLength || 500
    };
  }

  /**
   * Inicializa el lector QR
   * @returns {Promise<boolean>} True si la inicialización fue exitosa
   */
  async init() {
    try {
      console.log('Inicializando lector QR...');
      
      // Si no se especificaron IDs, buscar dispositivos HID comunes
      if (!this.vendorId || !this.productId) {
        const device = this.findQRReader();
        if (device) {
          this.vendorId = device.vendorId;
          this.productId = device.productId;
          console.log(`Lector QR detectado: ${device.manufacturer} ${device.product}`);
        }
      }
      
      if (this.vendorId && this.productId) {
        await this.connect();
        return true;
      } else {
        console.warn('No se encontró lector QR. Usando modo teclado (keyboard wedge)');
        this.initKeyboardMode();
        return true;
      }
      
    } catch (error) {
      console.error('Error inicializando lector QR:', error.message);
      this.emit('error', error);
      return false;
    }
  }

  /**
   * Busca dispositivos HID que podrían ser lectores QR
   * @returns {Object|null} Dispositivo encontrado
   */
  findQRReader() {
    try {
      const devices = HID.devices();
      
      // Buscar por fabricantes conocidos de lectores QR
      const knownVendors = [
        'Honeywell',
        'Zebra', 
        'Datalogic',
        'Code',
        'Symbol',
        'Motorola'
      ];
      
      for (const device of devices) {
        const manufacturer = (device.manufacturer || '').toLowerCase();
        const product = (device.product || '').toLowerCase();
        
        // Buscar por fabricante conocido
        for (const vendor of knownVendors) {
          if (manufacturer.includes(vendor.toLowerCase())) {
            return device;
          }
        }
        
        // Buscar por palabras clave en el producto
        const keywords = ['scanner', 'barcode', 'qr', 'reader', 'imager'];
        for (const keyword of keywords) {
          if (product.includes(keyword)) {
            return device;
          }
        }
      }
      
      return null;
      
    } catch (error) {
      console.error('Error buscando lector QR:', error.message);
      return null;
    }
  }

  /**
   * Conecta al dispositivo HID
   * @returns {Promise<void>}
   */
  async connect() {
    try {
      this.device = new HID.HID(this.vendorId, this.productId);
      this.isConnected = true;
      
      console.log(`Conectado al lector QR (${this.vendorId}:${this.productId})`);
      
      // Configurar listener para datos
      this.device.on('data', (data) => {
        this.handleHIDData(data);
      });
      
      this.device.on('error', (error) => {
        console.error('Error del dispositivo HID:', error);
        this.isConnected = false;
        this.emit('error', error);
      });
      
      this.emit('connected');
      
    } catch (error) {
      this.isConnected = false;
      throw new Error(`No se pudo conectar al lector QR: ${error.message}`);
    }
  }

  /**
   * Maneja datos recibidos del dispositivo HID
   * @param {Buffer} data - Datos recibidos
   */
  handleHIDData(data) {
    try {
      const text = data.toString(this.config.encoding).trim();
      
      if (text) {
        this.buffer += text;
        
        // Verificar si tenemos un escaneo completo
        if (this.isCompleteScan(this.buffer)) {
          this.processScan(this.buffer);
          this.buffer = '';
        }
      }
      
    } catch (error) {
      console.error('Error procesando datos HID:', error.message);
    }
  }

  /**
   * Verifica si un escaneo está completo
   * @param {string} data - Datos del buffer
   * @returns {boolean} True si está completo
   */
  isCompleteScan(data) {
    // Para códigos QR TITO, buscar el patrón: T[...]|[...]|[...]|[...]|[...]
    const titoPattern = /^T[A-Z0-9]+\\|[0-9.]+\\|[A-Z]{3}\\|[0-9T:-]+\\|[a-f0-9]+$/;
    
    return titoPattern.test(data) && 
           data.length >= this.config.minLength && 
           data.length <= this.config.maxLength;
  }

  /**
   * Procesa un escaneo completo
   * @param {string} scanData - Datos escaneados
   */
  processScan(scanData) {
    const now = Date.now();
    
    // Verificar cooldown para evitar escaneos duplicados
    if (now - this.lastScanTime < this.scanCooldown) {
      return;
    }
    
    this.lastScanTime = now;
    
    // Emitir evento de escaneo
    this.emit('scan', {
      data: scanData,
      timestamp: now,
      source: 'hid'
    });
    
    console.log('QR escaneado:', scanData);
  }

  /**
   * Inicializa modo teclado (keyboard wedge)
   * El lector QR simula entradas de teclado
   */
  initKeyboardMode() {
    console.log('Modo teclado inicializado para lector QR');
    this.isConnected = true;
    this.emit('connected');
    
    // En modo teclado, la aplicación React recibirá los datos directamente
    // a través de eventos de input del DOM
  }

  /**
   * Simula un escaneo (para testing)
   * @param {string} qrData - Datos del QR a simular
   */
  simulateScan(qrData) {
    if (!qrData) return;
    
    this.emit('scan', {
      data: qrData,
      timestamp: Date.now(),
      source: 'simulated'
    });
    
    console.log('Escaneo simulado:', qrData);
  }

  /**
   * Lista todos los dispositivos HID disponibles
   * @returns {Array} Lista de dispositivos
   */
  listHIDDevices() {
    try {
      const devices = HID.devices();
      return devices.map(device => ({
        vendorId: device.vendorId,
        productId: device.productId,
        manufacturer: device.manufacturer || 'Unknown',
        product: device.product || 'Unknown',
        path: device.path
      }));
    } catch (error) {
      console.error('Error listando dispositivos HID:', error.message);
      return [];
    }
  }

  /**
   * Obtiene información del lector actual
   * @returns {Object} Información del lector
   */
  getReaderInfo() {
    return {
      vendorId: this.vendorId,
      productId: this.productId,
      isConnected: this.isConnected,
      mode: this.device ? 'hid' : 'keyboard',
      config: this.config
    };
  }

  /**
   * Prueba el lector QR
   * @returns {Promise<boolean>} True si la prueba fue exitosa
   */
  async testReader() {
    return new Promise((resolve) => {
      console.log('Probando lector QR... Escanee un código o espere timeout.');
      
      const timeout = setTimeout(() => {
        this.removeListener('scan', onScan);
        console.log('⚠️  Timeout en prueba de lector QR - No se recibió escaneo');
        resolve(false);
      }, this.config.timeout);
      
      const onScan = (scanResult) => {
        clearTimeout(timeout);
        console.log('✅ Prueba de lector QR exitosa:', scanResult.data);
        resolve(true);
      };
      
      this.once('scan', onScan);
      
      // Simular escaneo si estamos en modo test
      if (process.env.NODE_ENV === 'test') {
        setTimeout(() => {
          this.simulateScan('T123456789|100.00|DOP|2025-10-12T08:02:00Z|abc123');
        }, 100);
      }
    });
  }

  /**
   * Configura el lector QR
   * @param {Object} newConfig - Nueva configuración
   */
  configure(newConfig) {
    this.config = { ...this.config, ...newConfig };
    console.log('Configuración del lector QR actualizada:', this.config);
  }

  /**
   * Desconecta el lector QR
   */
  disconnect() {
    try {
      if (this.device) {
        this.device.close();
        this.device = null;
      }
      
      this.isConnected = false;
      this.emit('disconnected');
      console.log('Lector QR desconectado');
      
    } catch (error) {
      console.error('Error desconectando lector QR:', error.message);
    }
  }

  /**
   * Cierra el servicio del lector QR
   */
  close() {
    this.disconnect();
    this.removeAllListeners();
    console.log('QRReaderService cerrado');
  }
}

module.exports = QRReaderService;
'''

with open('tito-casino-system/src/main/hardware/qr-reader.js', 'w') as f:
    f.write(qr_reader_service_js)

print("✅ Servicio de lector QR creado")