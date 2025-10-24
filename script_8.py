# Paso 9: Crear servicio de impresión
import os

printer_service_js = '''// src/main/hardware/printer.js
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { PRINTER_CONFIG } = require('../../shared/constants');

/**
 * Servicio para manejar la impresión de tickets
 */
class PrinterService {
  constructor(printerName = null) {
    this.printerName = printerName || process.env.PRINTER_NAME || PRINTER_CONFIG.NAME;
    this.tempDir = path.join(os.tmpdir(), 'tito-tickets');
    this.isInitialized = false;
    
    this.init();
  }

  /**
   * Inicializa el servicio de impresión
   */
  init() {
    try {
      // Crear directorio temporal si no existe
      if (!fs.existsSync(this.tempDir)) {
        fs.mkdirSync(this.tempDir, { recursive: true });
      }

      this.isInitialized = true;
      console.log(`PrinterService inicializado para impresora: ${this.printerName}`);
      
    } catch (error) {
      console.error('Error inicializando PrinterService:', error.message);
      this.isInitialized = false;
    }
  }

  /**
   * Imprime un ticket desde un buffer PDF
   * @param {Buffer} pdfBuffer - Buffer del PDF a imprimir
   * @param {Object} options - Opciones de impresión
   * @returns {Promise<boolean>} True si la impresión fue exitosa
   */
  async printTicket(pdfBuffer, options = {}) {
    if (!this.isInitialized) {
      throw new Error('PrinterService no inicializado');
    }

    if (!Buffer.isBuffer(pdfBuffer)) {
      throw new Error('Se requiere un buffer PDF válido');
    }

    try {
      // Generar nombre de archivo temporal único
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substr(2, 6);
      const tempFileName = `ticket_${timestamp}_${randomSuffix}.pdf`;
      const tempFilePath = path.join(this.tempDir, tempFileName);
      
      // Guardar PDF en archivo temporal
      fs.writeFileSync(tempFilePath, pdfBuffer);
      
      // Imprimir según el sistema operativo
      const success = await this.printFile(tempFilePath, options);
      
      // Programar limpieza del archivo temporal
      this.scheduleFileCleanup(tempFilePath, 10000); // 10 segundos
      
      return success;
      
    } catch (error) {
      throw new Error(`Error imprimiendo ticket: ${error.message}`);
    }
  }

  /**
   * Imprime un archivo PDF
   * @param {string} filePath - Ruta del archivo PDF
   * @param {Object} options - Opciones de impresión
   * @returns {Promise<boolean>} True si fue exitoso
   */
  async printFile(filePath, options = {}) {
    const platform = process.platform;
    let command;

    try {
      switch (platform) {
        case 'win32':
          command = this.getWindowsPrintCommand(filePath, options);
          break;
        case 'darwin':
          command = this.getMacPrintCommand(filePath, options);
          break;
        case 'linux':
          command = this.getLinuxPrintCommand(filePath, options);
          break;
        default:
          throw new Error(`Sistema operativo no soportado: ${platform}`);
      }

      await this.executeCommand(command);
      console.log(`Ticket impreso exitosamente: ${path.basename(filePath)}`);
      return true;
      
    } catch (error) {
      console.error('Error en impresión:', error.message);
      throw error;
    }
  }

  /**
   * Comando de impresión para Windows
   * @param {string} filePath - Ruta del archivo
   * @param {Object} options - Opciones
   * @returns {string} Comando a ejecutar
   */
  getWindowsPrintCommand(filePath, options) {
    // Intentar usar SumatraPDF para impresión silenciosa
    const sumatraPath = options.sumatraPath || 'SumatraPDF.exe';
    
    // Comando con SumatraPDF (recomendado)
    return `"${sumatraPath}" -print-to "${this.printerName}" -silent "${filePath}"`;
    
    // Comando alternativo usando Adobe Reader (si está disponible)
    // return `"C:\\Program Files\\Adobe\\Acrobat DC\\Acrobat\\Acrobat.exe" /t "${filePath}" "${this.printerName}"`;
    
    // Comando básico de Windows (puede mostrar diálogo)
     // return `powershell -command "Start-Process -FilePath '${filePath}' -Verb Print"`;
  }

  /**
   * Comando de impresión para macOS
   * @param {string} filePath - Ruta del archivo
   * @param {Object} options - Opciones
   * @returns {string} Comando a ejecutar
   */
  getMacPrintCommand(filePath, options) {
    return `lpr -P "${this.printerName}" "${filePath}"`;
  }

  /**
   * Comando de impresión para Linux
   * @param {string} filePath - Ruta del archivo
   * @param {Object} options - Opciones
   * @returns {string} Comando a ejecutar
   */
  getLinuxPrintCommand(filePath, options) {
    return `lpr -P "${this.printerName}" "${filePath}"`;
  }

  /**
   * Ejecuta un comando del sistema
   * @param {string} command - Comando a ejecutar
   * @returns {Promise<string>} Salida del comando
   */
  executeCommand(command) {
    return new Promise((resolve, reject) => {
      const timeout = PRINTER_CONFIG.TIMEOUT || 30000;
      
      exec(command, { timeout }, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`Command failed: ${error.message}`));
        } else if (stderr && stderr.trim()) {
          console.warn('Print command warning:', stderr);
          resolve(stdout);
        } else {
          resolve(stdout);
        }
      });
    });
  }

  /**
   * Programa la limpieza de un archivo temporal
   * @param {string} filePath - Ruta del archivo
   * @param {number} delay - Delay en milisegundos
   */
  scheduleFileCleanup(filePath, delay = 5000) {
    setTimeout(() => {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`Archivo temporal eliminado: ${path.basename(filePath)}`);
        }
      } catch (error) {
        console.warn(`No se pudo eliminar archivo temporal: ${error.message}`);
      }
    }, delay);
  }

  /**
   * Prueba la impresora con una página de test
   * @returns {Promise<boolean>} True si la prueba fue exitosa
   */
  async testPrinter() {
    try {
      const { generateTestPDF } = require('../utils/pdf-generator');
      const testPdfBuffer = await generateTestPDF();
      
      console.log('Ejecutando prueba de impresora...');
      const result = await this.printTicket(testPdfBuffer);
      
      if (result) {
        console.log('✅ Prueba de impresora exitosa');
      }
      
      return result;
      
    } catch (error) {
      console.error('❌ Prueba de impresora falló:', error.message);
      throw error;
    }
  }

  /**
   * Lista las impresoras disponibles en el sistema
   * @returns {Promise<Array>} Lista de impresoras
   */
  async listPrinters() {
    const platform = process.platform;
    let command;

    try {
      switch (platform) {
        case 'win32':
          command = 'wmic printer list brief';
          break;
        case 'darwin':
          command = 'lpstat -p';
          break;
        case 'linux':
          command = 'lpstat -p';
          break;
        default:
          throw new Error(`Sistema operativo no soportado: ${platform}`);
      }

      const output = await this.executeCommand(command);
      return this.parsePrinterList(output, platform);
      
    } catch (error) {
      console.error('Error listando impresoras:', error.message);
      return [];
    }
  }

  /**
   * Parsea la lista de impresoras según el sistema operativo
   * @param {string} output - Salida del comando
   * @param {string} platform - Plataforma del sistema
   * @returns {Array} Lista de impresoras parseada
   */
  parsePrinterList(output, platform) {
    const printers = [];
    const lines = output.split('\\n').filter(line => line.trim());

    switch (platform) {
      case 'win32':
        lines.forEach(line => {
          if (line.includes('Name') && !line.includes('Name=')) return;
          const match = line.match(/Name\\s*=\\s*(.*?)\\s+/);
          if (match) {
            printers.push({ name: match[1].trim(), status: 'unknown' });
          }
        });
        break;
        
      case 'darwin':
      case 'linux':
        lines.forEach(line => {
          const match = line.match(/printer\\s+(\\S+)\\s+is\\s+(\\w+)/);
          if (match) {
            printers.push({ 
              name: match[1], 
              status: match[2] 
            });
          }
        });
        break;
    }

    return printers;
  }

  /**
   * Verifica si la impresora configurada está disponible
   * @returns {Promise<boolean>} True si está disponible
   */
  async isPrinterAvailable() {
    try {
      const printers = await this.listPrinters();
      return printers.some(printer => 
        printer.name.toLowerCase().includes(this.printerName.toLowerCase())
      );
    } catch (error) {
      console.error('Error verificando disponibilidad de impresora:', error.message);
      return false;
    }
  }

  /**
   * Limpia todos los archivos temporales
   */
  cleanupTempFiles() {
    try {
      if (fs.existsSync(this.tempDir)) {
        const files = fs.readdirSync(this.tempDir);
        files.forEach(file => {
          const filePath = path.join(this.tempDir, file);
          try {
            fs.unlinkSync(filePath);
          } catch (error) {
            console.warn(`No se pudo eliminar ${file}:`, error.message);
          }
        });
        console.log(`Limpieza de archivos temporales completada: ${files.length} archivos`);
      }
    } catch (error) {
      console.error('Error limpiando archivos temporales:', error.message);
    }
  }

  /**
   * Cierra el servicio de impresión
   */
  close() {
    this.cleanupTempFiles();
    this.isInitialized = false;
    console.log('PrinterService cerrado');
  }
}

module.exports = PrinterService;
'''

with open('tito-casino-system/src/main/hardware/printer.js', 'w') as f:
    f.write(printer_service_js)

print("✅ Servicio de impresión creado")