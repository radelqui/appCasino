// src/main/main.js
const { app, BrowserWindow, ipcMain, Menu, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// Importar servicios
const SQLiteDB = require('./database/sqlite');
const { registerIpcHandlers } = require('./ipc');
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
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
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
      const { syncedTickets, errors } = await supabaseSync.syncTickets(unsyncedTickets);

      if (syncedTickets.length > 0) {
        // Marcar tickets como sincronizados por su ID
        const syncedIds = syncedTickets.map(ticket => ticket.id);
        db.markAsSynced(syncedIds);

        console.log(`✅ Sincronización completada: ${syncedTickets.length} tickets`);
      }

      if (errors.length > 0) {
        console.warn(`⚠️  Errores durante la sincronización: ${errors.length}`, errors);
      }
    } else {
      console.log('No hay tickets para sincronizar');
    }

  } catch (error) {
    console.error('Error en sincronización:', error.message);
  }
}

// === EVENTOS DE LA APLICACIÓN ===

app.whenReady().then(async () => {
  try {
    await initializeServices();
    registerIpcHandlers({ db, supabaseSync, printer, qrReader, performSync });
    createWindow();

    console.log('🎉 Aplicación iniciada correctamente');

  } catch (error) {
    console.error('💥 Error fatal al iniciar aplicación:', error.message);
    dialog.showErrorBox(
      'Error Fatal de Inicio',
      `No se pudo iniciar la aplicación debido a un error crítico:\n\n${error.message}\n\nLa aplicación se cerrará.`
    );
    app.exit();
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
