# Paso 12: Crear el proceso principal de Electron
import os

main_js = '''// src/main/main.js
const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

// Importar servicios
const SQLiteDB = require('./database/sqlite');
const SupabaseSync = require('./database/supabase');
const PrinterService = require('./hardware/printer');
const QRReaderService = require('./hardware/qr-reader');
const { generateTicketQR, generateTicketNumber, validateTicketQR, parseTicketQR } = require('./utils/qr-generator');
const { generateTicketPDF } = require('./utils/pdf-generator');

// Variables globales
let mainWindow;
let db;
let supabaseSync;
let printer;
let qrReader;
let syncInterval;

// Configuración de la aplicación
const APP_CONFIG = {
  isDev: process.env.NODE_ENV === 'development',
  syncIntervalMs: 5 * 60 * 1000, // 5 minutos
  windowConfig: {
    width: 1024,
    height: 768,
    minWidth: 800,
    minHeight: 600
  }
};

/**
 * Crea la ventana principal de la aplicación
 */
function createWindow() {
  console.log('Creando ventana principal...');
  
  mainWindow = new BrowserWindow({
    width: APP_CONFIG.windowConfig.width,
    height: APP_CONFIG.windowConfig.height,
    minWidth: APP_CONFIG.windowConfig.minWidth,
    minHeight: APP_CONFIG.windowConfig.minHeight,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    icon: path.join(__dirname, '../../assets/icon.png'), // Si existe
    title: 'Sistema TITO Casino',
    show: false // No mostrar hasta que esté listo
  });

  // Cargar la aplicación
  if (APP_CONFIG.isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    const indexPath = path.join(__dirname, '../../build/index.html');
    if (fs.existsSync(indexPath)) {
      mainWindow.loadFile(indexPath);
    } else {
      console.error('Archivo index.html de build no encontrado');
      mainWindow.loadURL('data:text/html,<h1>Error: Build no encontrado</h1>');
    }
  }

  // Mostrar ventana cuando esté lista
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    console.log('Ventana principal lista');
  });

  // Manejar cierre de ventana
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Crear menú de aplicación
  createApplicationMenu();
}

/**
 * Crea el menú de la aplicación
 */
function createApplicationMenu() {
  const template = [
    {
      label: 'Archivo',
      submenu: [
        {
          label: 'Prueba de Impresora',
          click: async () => {
            try {
              await printer.testPrinter();
            } catch (error) {
              console.error('Error en prueba de impresora:', error.message);
            }
          }
        },
        {
          label: 'Prueba de Lector QR',
          click: async () => {
            try {
              await qrReader.testReader();
            } catch (error) {
              console.error('Error en prueba de lector QR:', error.message);
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Sincronizar Ahora',
          click: async () => {
            await performSync();
          }
        },
        { type: 'separator' },
        {
          label: 'Salir',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Ver',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Ayuda',
      submenu: [
        {
          label: 'Acerca de',
          click: () => {
            const { dialog } = require('electron');
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Acerca de Sistema TITO',
              message: 'Sistema TITO Casino v1.0.0',
              detail: 'Sistema de tickets con valor monetario para casino pequeño'
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

/**
 * Inicializa todos los servicios de la aplicación
 */
async function initializeServices() {
  console.log('Inicializando servicios...');
  
  try {
    // 1. Inicializar base de datos SQLite
    db = new SQLiteDB();
    console.log('✅ SQLite inicializado');

    // 2. Inicializar Supabase
    supabaseSync = new SupabaseSync();
    if (supabaseSync.isAvailable()) {
      const connected = await supabaseSync.testConnection();
      if (connected) {
        console.log('✅ Supabase conectado');
      } else {
        console.warn('⚠️  Supabase no disponible - funcionando offline');
      }
    }

    // 3. Inicializar impresora
    printer = new PrinterService();
    console.log('✅ Servicio de impresión inicializado');

    // 4. Inicializar lector QR
    qrReader = new QRReaderService();
    await qrReader.init();
    
    // Configurar listener para escaneos QR
    qrReader.on('scan', (scanResult) => {
      console.log('QR escaneado:', scanResult.data);
      // Enviar a la ventana principal
      if (mainWindow) {
        mainWindow.webContents.send('qr-scanned', scanResult);
      }
    });
    
    console.log('✅ Lector QR inicializado');

    // 5. Configurar sincronización periódica
    if (supabaseSync.isAvailable()) {
      syncInterval = setInterval(async () => {
        await performSync();
      }, APP_CONFIG.syncIntervalMs);
      console.log('✅ Sincronización periódica configurada');
    }

    console.log('🚀 Todos los servicios inicializados correctamente');

  } catch (error) {
    console.error('❌ Error inicializando servicios:', error.message);
    throw error;
  }
}

/**
 * Realiza sincronización con Supabase
 */
async function performSync() {
  if (!supabaseSync.isAvailable()) {
    return;
  }

  try {
    console.log('Iniciando sincronización...');
    const unsyncedTickets = db.getUnsyncedTickets();
    
    if (unsyncedTickets.length > 0) {
      const result = await supabaseSync.syncTickets(unsyncedTickets);
      
      if (result.synced > 0) {
        // Marcar tickets como sincronizados
        const syncedIds = unsyncedTickets
          .slice(0, result.synced)
          .map(ticket => ticket.id);
        db.markAsSynced(syncedIds);
        
        console.log(`✅ Sincronización completada: ${result.synced} tickets`);
      }
      
      if (result.errors.length > 0) {
        console.warn(`⚠️  Errores en sincronización: ${result.errors.length}`);
      }
    } else {
      console.log('No hay tickets para sincronizar');
    }

  } catch (error) {
    console.error('Error en sincronización:', error.message);
  }
}

// === MANEJADORES IPC ===

/**
 * Maneja la generación de tickets
 */
ipcMain.handle('generate-ticket', async (event, ticketData) => {
  try {
    console.log('Generando ticket:', ticketData);

    // Validar datos de entrada
    if (!ticketData.valor || !ticketData.moneda) {
      throw new Error('Datos de ticket incompletos');
    }

    if (ticketData.valor <= 0) {
      throw new Error('El valor debe ser mayor que cero');
    }

    if (!['DOP', 'USD'].includes(ticketData.moneda)) {
      throw new Error('Moneda inválida');
    }

    // Generar número único de ticket
    const ticketNumber = generateTicketNumber(ticketData.mesa_id);
    const fechaEmision = new Date().toISOString();

    // Generar código QR
    const qrResult = await generateTicketQR({
      id: ticketNumber,
      valor: ticketData.valor,
      moneda: ticketData.moneda,
      fecha: fechaEmision
    });

    // Guardar en base de datos local
    const ticket = await db.createTicket({
      ticket_number: ticketNumber,
      valor: ticketData.valor,
      moneda: ticketData.moneda,
      qr_data: qrResult.qrString,
      mesa_id: ticketData.mesa_id || null,
      usuario_emision: ticketData.usuario_emision || null,
      hash_seguridad: qrResult.hash
    });

    // Generar PDF del ticket
    const pdfBuffer = await generateTicketPDF({
      ticket_number: ticketNumber,
      valor: ticketData.valor,
      moneda: ticketData.moneda,
      fecha_emision: fechaEmision,
      qr_code: qrResult.qrCode,
      mesa_id: ticketData.mesa_id,
      usuario_emision: ticketData.usuario_emision
    });

    // Imprimir ticket
    await printer.printTicket(pdfBuffer);

    console.log(`✅ Ticket ${ticketNumber} generado e impreso exitosamente`);

    return {
      success: true,
      ticket_number: ticketNumber,
      ticket_id: ticket.id,
      valor: ticketData.valor,
      moneda: ticketData.moneda
    };

  } catch (error) {
    console.error('Error generando ticket:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
});

/**
 * Maneja la validación de tickets escaneados
 */
ipcMain.handle('validate-ticket', async (event, qrString) => {
  try {
    console.log('Validando ticket:', qrString);

    // Validar formato y hash del QR
    if (!validateTicketQR(qrString)) {
      return {
        success: false,
        error: 'Código QR inválido o alterado'
      };
    }

    // Parsear datos del QR
    const qrData = parseTicketQR(qrString);

    // Buscar ticket en base de datos local
    const ticket = db.findTicketByNumber(qrData.id);

    if (!ticket) {
      // Intentar buscar en Supabase si está disponible
      if (supabaseSync.isAvailable()) {
        try {
          const remoteTicket = await supabaseSync.getTicketByNumber(qrData.id);
          if (remoteTicket) {
            // Agregar ticket a base local para futura referencia
            await db.createTicket({
              ticket_number: remoteTicket.ticket_number,
              valor: remoteTicket.valor,
              moneda: remoteTicket.moneda,
              qr_data: remoteTicket.qr_data,
              mesa_id: remoteTicket.mesa_id,
              usuario_emision: remoteTicket.usuario_emision,
              hash_seguridad: remoteTicket.hash_seguridad
            });

            return {
              success: true,
              ticket: remoteTicket,
              source: 'remote'
            };
          }
        } catch (remoteError) {
          console.warn('Error buscando ticket remoto:', remoteError.message);
        }
      }

      return {
        success: false,
        error: 'Ticket no encontrado en el sistema'
      };
    }

    if (ticket.estado !== 'emitido') {
      return {
        success: false,
        error: `Ticket ya ${ticket.estado}`
      };
    }

    return {
      success: true,
      ticket: ticket,
      source: 'local'
    };

  } catch (error) {
    console.error('Error validando ticket:', error.message);
    return {
      success: false,
      error: `Error de validación: ${error.message}`
    };
  }
});

/**
 * Maneja el procesamiento de pagos
 */
ipcMain.handle('process-payment', async (event, paymentData) => {
  try {
    console.log('Procesando pago:', paymentData);

    const { ticket_number, usuario_canje } = paymentData;

    if (!ticket_number) {
      throw new Error('Número de ticket requerido');
    }

    // Actualizar estado del ticket
    const result = db.updateTicketStatus(ticket_number, 'canjeado', usuario_canje);

    if (result.changes > 0) {
      console.log(`✅ Ticket ${ticket_number} canjeado exitosamente`);
      
      return {
        success: true,
        message: 'Pago procesado exitosamente',
        ticket_number: ticket_number
      };
    } else {
      return {
        success: false,
        error: 'No se pudo actualizar el ticket'
      };
    }

  } catch (error) {
    console.error('Error procesando pago:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
});

/**
 * Obtiene estadísticas de tickets
 */
ipcMain.handle('get-stats', async (event, dateRange) => {
  try {
    const { dateFrom, dateTo } = dateRange || {};
    const stats = db.getTicketStats(dateFrom, dateTo);
    
    return {
      success: true,
      stats: stats
    };

  } catch (error) {
    console.error('Error obteniendo estadísticas:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
});

/**
 * Fuerza sincronización manual
 */
ipcMain.handle('force-sync', async (event) => {
  try {
    await performSync();
    return {
      success: true,
      message: 'Sincronización completada'
    };

  } catch (error) {
    console.error('Error en sincronización forzada:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
});

// === EVENTOS DE LA APLICACIÓN ===

app.whenReady().then(async () => {
  try {
    await initializeServices();
    createWindow();
    
    console.log('🎉 Aplicación iniciada correctamente');
    
  } catch (error) {
    console.error('💥 Error fatal al iniciar aplicación:', error.message);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    cleanup();
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  cleanup();
});

/**
 * Limpia recursos antes de cerrar la aplicación
 */
function cleanup() {
  console.log('Limpiando recursos...');
  
  try {
    if (syncInterval) {
      clearInterval(syncInterval);
    }
    
    if (qrReader) {
      qrReader.close();
    }
    
    if (printer) {
      printer.close();
    }
    
    if (supabaseSync) {
      supabaseSync.close();
    }
    
    if (db) {
      db.close();
    }
    
    console.log('✅ Limpieza completada');
    
  } catch (error) {
    console.error('Error durante limpieza:', error.message);
  }
}

// Manejo de errores no capturados
process.on('unhandledRejection', (reason, promise) => {
  console.error('Promesa rechazada no manejada:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Excepción no capturada:', error);
  cleanup();
  process.exit(1);
});
'''

with open('tito-casino-system/src/main/main.js', 'w') as f:
    f.write(main_js)

print("✅ Proceso principal de Electron creado")