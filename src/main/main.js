// src/main/main.js
const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Servicios
const CasinoDatabase = require('../../Caja/database');
const { registerIpcHandlers } = require('./ipc');
const SupabaseSync = require('./database/supabase');
const PrinterService = require('./hardware/printer');
const ScannerService = require('./hardware/scanner');
const Roles = require('./security/roles');

let mainWindow;
let db;
let supabaseSync;
let printer;
let scanner;
let syncInterval;

const APP_CONFIG = {
  isDev: process.env.NODE_ENV === 'development',
  syncIntervalMs: parseInt(process.env.AUTO_SYNC_INTERVAL || '', 10) || 5 * 60 * 1000,
  windowConfig: { width: 1024, height: 768, minWidth: 800, minHeight: 600 }
};

// Ventana de Caja
let cajaWindow;
function createCajaWindow() {
  try {
    const role = (Roles.getRole?.() || 'MESA').toUpperCase();
    if (!(role === 'CAJA' || role === 'ADMIN')) {
      dialog.showErrorBox('Acceso denegado', 'Tu rol no permite abrir Caja');
      return;
    }
    const preloadCaja = path.join(process.cwd(), 'Caja', 'preload-caja.js');
    const panelPath = path.join(process.cwd(), 'Caja', 'panel.html');

    cajaWindow = new BrowserWindow({
      width: 1000,
      height: 700,
      webPreferences: {
        preload: preloadCaja,
        contextIsolation: true,
        nodeIntegration: false
      },
      title: 'Caja - Validación y Cobro',
      show: true
    });

    if (fs.existsSync(panelPath)) {
      cajaWindow.loadFile(panelPath);
    } else {
      cajaWindow.loadURL('data:text/html,<h1>No se encontró Caja/panel.html</h1>');
    }

    cajaWindow.on('closed', () => { cajaWindow = null; });
  } catch (e) {
    console.error('Error creando ventana de Caja:', e.message);
    dialog.showErrorBox('Error Caja', e.message);
  }
}

// Ventana de Mesa
let mesaWindow;
function createMesaWindow() {
  try {
    const mesaPath = path.join(process.cwd(), 'pure', 'mesa.html');
    const preloadPath = path.join(__dirname, 'preload.js');

    mesaWindow = new BrowserWindow({
      width: 1000,
      height: 700,
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false
      },
      title: 'Mesa - Emisión de Vouchers',
      show: true
    });

    if (fs.existsSync(mesaPath)) {
      mesaWindow.loadFile(mesaPath);
    } else {
      mesaWindow.loadURL('data:text/html,<h1>No se encontró pure/mesa.html</h1>');
    }

    mesaWindow.on('closed', () => { mesaWindow = null; });
  } catch (e) {
    console.error('Error creando ventana de Mesa:', e.message);
    dialog.showErrorBox('Error Mesa', e.message);
  }
}

function createWindow() {
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
    title: 'Sistema TITO Casino',
    show: false
  });

  if (APP_CONFIG.isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    const indexPath = path.join(__dirname, '../../build/index.html');
    if (fs.existsSync(indexPath)) mainWindow.loadFile(indexPath);
    else mainWindow.loadURL('data:text/html,<h1>Error: Build no encontrado</h1>');
  }

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => { mainWindow = null; });

  createApplicationMenu();
}

function createApplicationMenu() {
  const role = (Roles.getRole?.() || 'MESA').toUpperCase();
  const template = [
    { label: 'Archivo', submenu: [
      { label: 'Abrir Mesa', accelerator: 'CmdOrCtrl+M', visible: (role === 'MESA' || role === 'ADMIN'), click: () => createMesaWindow() },
      { label: 'Abrir Caja', accelerator: 'CmdOrCtrl+J', visible: (role === 'CAJA' || role === 'ADMIN'), click: () => createCajaWindow() },
      { type: 'separator' },
      { label: 'Prueba de Impresora', click: async () => { try { await printer.testPrinter?.(); } catch (e) { console.error(e.message); } } },
      { label: 'Prueba de Calibración', click: async () => { try { await printer.testCalibration?.(); } catch (e) { console.error(e.message); } } },
      { label: `Impresión: ${printer?.mode || 'PDF'} (${printer?.paperWidthMm || 80}mm)`, enabled: false },
      { type: 'separator' },
      { label: 'Prueba de Scanner', click: async () => { try { await scanner.testReader?.(); } catch (e) { console.error(e.message); } } },
      { type: 'separator' },
      { label: 'Sincronizar Ahora', click: async () => { await performSync(); } },
      { type: 'separator' },
      { label: 'Salir', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() }
    ]},
    { label: 'Ver', submenu: [ { role: 'reload' }, { role: 'forceReload' }, { role: 'toggleDevTools' }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' } ]},
    { label: 'Ayuda', submenu: [ { label: 'Acerca de', click: () => dialog.showMessageBox(mainWindow, { type: 'info', title: 'Acerca de Sistema TITO', message: 'Sistema TITO Casino', detail: 'Sistema de vouchers TITO' }) } ]}
  ];
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Exponer función global para reconstruir el menú cuando cambie el perfil de impresión
global.updatePrintMenu = function updatePrintMenu() {
  try { createApplicationMenu(); } catch (e) { console.warn('No se pudo actualizar el menú:', e.message); }
};

async function initializeServices() {
  try {
    // Usar la ruta unificada para la base de datos
    const dbPath = process.env.CASINO_DB_PATH || path.join(process.cwd(), 'data', 'casino.db');
    db = new CasinoDatabase(dbPath);
    await db.initDatabase(); // Inicializar tablas si es necesario
    supabaseSync = new SupabaseSync();
    printer = new PrinterService();
    scanner = new ScannerService();

    // Aplicar perfil persistido si existe
    try {
      const profilePath = path.join(app.getPath('userData'), 'printerProfile.json');
      if (fs.existsSync(profilePath)) {
        const raw = fs.readFileSync(profilePath, 'utf8');
        const saved = JSON.parse(raw);
        printer.setProfile?.(saved);
      }
    } catch (e) {
      console.warn('No se pudo aplicar perfil persistido:', e.message);
    }

    await scanner.init?.();
    scanner.on?.('scan', (scanResult) => {
      if (mainWindow) mainWindow.webContents.send('qr-scanned', scanResult);
    });

    if (supabaseSync.isAvailable?.()) {
      const connected = await supabaseSync.testConnection?.();
      if (!connected) console.warn('Supabase no disponible - funcionando offline');
      syncInterval = setInterval(async () => { await performSync(); }, APP_CONFIG.syncIntervalMs);
    }
  } catch (error) {
    console.error('Error inicializando servicios:', error.message);
    throw error;
  }
}

async function performSync() {
  try {
    if (!supabaseSync?.isAvailable?.()) return;
    const unsyncedTickets = db.getUnsyncedTickets();
    if (unsyncedTickets.length > 0) {
      const { syncedTickets = [], errors = [] } = await supabaseSync.syncTickets(unsyncedTickets);
      if (syncedTickets.length > 0) {
        db.markAsSynced(syncedTickets.map(t => t.id));
      }
      if (errors.length > 0) console.warn('Errores durante la sincronización:', errors);
    }
  } catch (e) {
    console.error('Fallo en sincronización:', e.message);
  }
}

function cleanup() {
  try { if (syncInterval) clearInterval(syncInterval); } catch {}
  try { scanner?.close?.(); } catch {}
  try { printer?.close?.(); } catch {}
  try { db?.close?.(); } catch {}
}

app.whenReady().then(async () => {
  try {
    await initializeServices();
    registerIpcHandlers({ db, supabaseSync, printer, scanner, performSync });

    // Registrar handlers de Caja (namespace caja:*) si existen
    try {
      const { registerCajaHandlers } = require(path.join(process.cwd(), 'Caja', 'cajaHandlers'));
      if (typeof registerCajaHandlers === 'function') {
        registerCajaHandlers();
        console.log('Handlers de Caja registrados');
      }
    } catch (e) {
      console.warn('Caja no integrada: ', e.message);
    }

    createWindow();
    createMesaWindow();
    console.log('Aplicación iniciada');
  } catch (error) {
    console.error('Error fatal al iniciar aplicación:', error.message);
    dialog.showErrorBox('Error Fatal de Inicio', `No se pudo iniciar la aplicación.\n${error.message}`);
    app.exit();
  }
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') { cleanup(); app.quit(); } });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) { createWindow(); } });
app.on('before-quit', () => { cleanup(); });

process.on('unhandledRejection', (reason) => { console.error('UnhandledRejection:', reason); });
process.on('uncaughtException', (error) => { console.error('UncaughtException:', error); });

// IPC handlers para roles
ipcMain.handle('get-role', async () => {
  try { return Roles.getRole(); } catch (e) { return 'MESA'; }
});
ipcMain.handle('set-role', async (_event, role) => {
  try { return Roles.setRole(role); } catch (e) { return Roles.getRole(); }
});