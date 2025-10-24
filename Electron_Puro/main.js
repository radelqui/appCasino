const path = require('path');
const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');

// Desactivar aceleración por GPU para evitar fallos en entornos sin soporte
try {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('disable-software-rasterizer');
} catch (_) { /* noop */ }

// Servicios y handlers existentes
let registerIpcHandlers;
let PrinterService;
let Roles;
try {
  // Carga dinámica para reutilizar tus módulos actuales
  const { registerIpcHandlers: _registerIpcHandlers } = require(path.join(__dirname, '..', 'src', 'main', 'ipc'));
  registerIpcHandlers = _registerIpcHandlers;
} catch (e) {
  console.warn('No se encontró src/main/ipc:', e.message);
}
try {
  PrinterService = require(path.join(__dirname, '..', 'src', 'main', 'hardware', 'printer'));
} catch (e) {
  console.warn('No se encontró printer service:', e.message);
}
try {
  Roles = require(path.join(__dirname, '..', 'src', 'main', 'security', 'roles'));
} catch (e) {
  console.warn('No se encontró roles module, usaré persistencia en SQLite:', e.message);
  // Persistencia de rol en Caja/data/casino.db (tabla configuracion)
  Roles = {
    async getRole() {
      try {
        const Database = require('better-sqlite3');
        const dbPath = path.join(__dirname, '..', 'Caja', 'data', 'casino.db');
        const db = new Database(dbPath);
        db.exec(`
          CREATE TABLE IF NOT EXISTS configuracion (
            clave TEXT PRIMARY KEY,
            valor TEXT,
            actualizado DATETIME DEFAULT CURRENT_TIMESTAMP
          );
        `);
        const row = db.prepare('SELECT valor FROM configuracion WHERE clave = ?').get('rol_actual');
        db.close();
        const role = row?.valor ? String(row.valor).toUpperCase() : 'MESA';
        return role; // Por defecto MESA para evitar accesos de admin
      } catch (err) {
        console.warn('getRole fallback ADMIN:', err?.message || err);
        return 'ADMIN';
      }
    },
    async setRole(r) {
      try {
        const Database = require('better-sqlite3');
        const dbPath = path.join(__dirname, '..', 'Caja', 'data', 'casino.db');
        const db = new Database(dbPath);
        db.exec(`
          CREATE TABLE IF NOT EXISTS configuracion (
            clave TEXT PRIMARY KEY,
            valor TEXT,
            actualizado DATETIME DEFAULT CURRENT_TIMESTAMP
          );
        `);
        const val = String(r || 'MESA').toUpperCase();
        db.prepare('INSERT OR REPLACE INTO configuracion (clave, valor) VALUES (?, ?)')
          .run('rol_actual', val);
        db.close();
        return val;
      } catch (err) {
        console.warn('setRole error, fallback MESA:', err?.message || err);
        return 'MESA';
      }
    }
  };
}

let mainWindow;

function setAppMenu(){
  const template = [
    { label: 'Archivo', submenu: [
        { label: 'Cerrar sesión', accelerator: 'Ctrl+L', click: () => {
            try {
              const win = BrowserWindow.getFocusedWindow();
              win?.webContents.send('logout-request');
            } catch {}
          } },
        { type: 'separator' },
        { label: 'Reiniciar', accelerator: 'Ctrl+Shift+R', click: () => { try { app.relaunch(); app.exit(0); } catch {} } },
        { label: 'Salir', accelerator: 'Alt+F4', click: () => { try { app.quit(); } catch {} } }
      ] },
    { label: 'Ver', submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' }
      ] },
    { label: 'Ayuda', submenu: [
        { label: 'Acerca de', click: () => { try { dialog.showMessageBox({ type:'info', title:'Acerca de', message:'Sistema de Casino', detail:'Modo Puro (Electron)' }); } catch {} } }
      ] }
  ];
  try {
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  } catch (e) {
    console.warn('No se pudo establecer menú:', e?.message || e);
  }
}


function createWindow(filePath, opts = {}) {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    autoHideMenuBar: true,
    webPreferences: {
      preload: opts.preloadPath || path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  if (opts.loadURL) {
    win.loadURL(opts.loadURL);
  } else {
    win.loadFile(filePath);
  }
  return win;
}

async function can(view) {
  try {
    const r = String(await Roles.getRole()).toUpperCase();
    if (view === 'mesa') return r === 'MESA' || r === 'ADMIN';
    if (view === 'caja') return r === 'CAJA' || r === 'ADMIN';
    if (view === 'auditoria') return r === 'AUDITOR' || r === 'ADMIN';
    if (view === 'config') return r === 'ADMIN';
    return true;
  } catch (e) {
    console.warn('can(view) fallback MESA:', e.message);
    return true;
  }
}

async function createPanelWindow() {
  if (!await can('panel')) {
    return dialog.showErrorBox('Acceso denegado', 'No tiene permiso para abrir el panel');
  }
  mainWindow = createWindow(path.join(__dirname, '..', 'Caja', 'panel.html'));
}

async function createMesaWindow() {
  if (!await can('mesa')) {
    return dialog.showMessageBox({ type: 'warning', message: 'Acceso solo MESA/ADMIN' });
  }
  createWindow(path.join(__dirname, '..', 'pure', 'mesa.html'));
}

function isCajaEnabled() {
  try {
    // Validación mínima: chequear flag de configuración o que exista al menos un operador activo
    const Database = require('better-sqlite3');
    const dbPath = path.join(__dirname, '..', 'Caja', 'data', 'casino.db');
    const db = new Database(dbPath);
    // Asegura tablas (si no existen) para evitar fallos en SELECT
    db.exec(`
      CREATE TABLE IF NOT EXISTS configuracion (
        clave TEXT PRIMARY KEY,
        valor TEXT,
        actualizado DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS operadores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        codigo TEXT UNIQUE NOT NULL,
        nombre TEXT NOT NULL,
        pin TEXT NOT NULL,
        mesa_asignada TEXT,
        activo INTEGER DEFAULT 1,
        fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    const getCfg = db.prepare('SELECT valor FROM configuracion WHERE clave = ?');
    const row = getCfg.get('caja_habilitada');
    if (row && String(row.valor) === '1') { db.close(); return true; }

    const op = db.prepare('SELECT COUNT(1) as c FROM operadores WHERE activo = 1').get();
    db.close();
    return (op && op.c > 0);
  } catch (e) {
    console.warn('isCajaEnabled() error:', e.message);
    return false;
  }
}

async function createCajaWindow() {
  if (!await can('caja')) {
    return dialog.showMessageBox({ type: 'warning', message: 'Acceso solo CAJA/ADMIN' });
  }
  if (!isCajaEnabled()) {
    return dialog.showMessageBox({
      type: 'error',
      message: 'Caja no habilitada',
      detail: 'La caja no está configurada en la base de datos. Ingrese a Configuración (ADMIN) y habilite la caja o cree un operador activo.'
    });
  }
  const preloadCaja = path.join(__dirname, '..', 'Caja', 'preload-caja.js');
  createWindow(path.join(__dirname, '..', 'Caja', 'caja.html'), { preloadPath: preloadCaja });
}

async function createAuditWindow() {
  if (!await can('auditoria')) {
    return dialog.showMessageBox({ type: 'warning', message: 'Acceso solo AUDITOR/ADMIN' });
  }
  createWindow(path.join(__dirname, 'auditoria.html'));
}

async function createConfigWindow() {
  if (!await can('config')) {
    return dialog.showMessageBox({ type: 'warning', message: 'Acceso solo ADMIN' });
  }
  createWindow(path.join(__dirname, 'config.html'));
}

// IPC: roles
ipcMain.handle('get-role', async () => {
  try { return await Roles.getRole(); } catch { return 'MESA'; }
});
ipcMain.handle('set-role', async (_e, role) => {
  try { return await Roles.setRole(role); } catch { return 'MESA'; }
});

// IPC: configuración de Caja (habilitar/deshabilitar)
ipcMain.handle('get-caja-enabled', async () => {
  try {
    const Database = require('better-sqlite3');
    const dbPath = path.join(__dirname, '..', 'Caja', 'data', 'casino.db');
    const db = new Database(dbPath);
    db.exec(`
      CREATE TABLE IF NOT EXISTS configuracion (
        clave TEXT PRIMARY KEY,
        valor TEXT,
        actualizado DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    const row = db.prepare('SELECT valor FROM configuracion WHERE clave = ?').get('caja_habilitada');
    db.close();
    return !!(row && String(row.valor) === '1');
  } catch (e) {
    console.error('get-caja-enabled error:', e);
    return false;
  }
});

ipcMain.handle('set-caja-enabled', async (_e, enabled) => {
  try {
    const Database = require('better-sqlite3');
    const dbPath = path.join(__dirname, '..', 'Caja', 'data', 'casino.db');
    const db = new Database(dbPath);
    db.exec(`
      CREATE TABLE IF NOT EXISTS configuracion (
        clave TEXT PRIMARY KEY,
        valor TEXT,
        actualizado DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    const val = enabled ? '1' : '0';
    db.prepare('INSERT OR REPLACE INTO configuracion (clave, valor) VALUES (?, ?)').run('caja_habilitada', val);
    db.close();
    return { success: true, enabled: !!enabled };
  } catch (e) {
    console.error('set-caja-enabled error:', e);
    return { success: false, error: e.message };
  }
});

// Inicialización de servicios y registro de handlers
function initServicesAndHandlers() {
  try {
    if (registerIpcHandlers) {
      const printer = PrinterService ? new PrinterService() : null;
      // Inicializar DB y sincronización si están disponibles
      let db = null; let supabaseSync = null;
      try { const SQLiteDB = require(path.join(__dirname, '..', 'src', 'main', 'database', 'sqlite')); db = new SQLiteDB(); } catch (e) { console.warn('SQLiteDB no disponible:', e.message); }
      try { const SupabaseSync = require(path.join(__dirname, '..', 'src', 'main', 'database', 'supabase')); supabaseSync = new SupabaseSync(); } catch (e) { console.warn('SupabaseSync no disponible:', e.message); }

      registerIpcHandlers({ db, supabaseSync, printer });
      console.log('IPC Handlers registrados (modo puro).');
    }
  } catch (e) {
    console.error('Error registrando handlers:', e);
  }

  // Registrar handlers específicos de Caja (IPC namespace caja:*)
  try {
    const { registerCajaHandlers } = require(path.join(__dirname, '..', 'Caja', 'cajaHandlers'));
    registerCajaHandlers();
    console.log('Handlers de Caja registrados.');
  } catch (e) {
    console.warn('No se pudieron registrar handlers de Caja:', e.message);
  }

  // Registrar handlers de Autenticación (auth:*)
  try {
    const { registerAuthHandlers } = require(path.join(__dirname, 'authHandlers'));
    registerAuthHandlers();
    console.log('Handlers de Autenticación registrados.');
  } catch (e) {
    console.warn('No se pudieron registrar handlers de Autenticación:', e.message);
  }
}

app.whenReady().then(async () => {
  initServicesAndHandlers();
  setAppMenu();
  await createPanelWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createPanelWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Opcional: abre ventanas desde panel vía IPC (si lo usas)
ipcMain.handle('open-view', async (_e, view) => {
  if (view === 'mesa') return createMesaWindow();
  if (view === 'caja') return createCajaWindow();
  if (view === 'auditoria') return createAuditWindow();
  if (view === 'config') return createConfigWindow();
});

// Enfocar la ventana de Panel; si no existe, crearla
ipcMain.handle('focus-panel', async () => {
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
      return { success: true };
    }
    await createPanelWindow();
    if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
    return { success: true, created: true };
  } catch (e) {
    return { success: false, error: e?.message || String(e) };
  }
});

// Cerrar la ventana desde la que se invoca
ipcMain.handle('close-current', async (event) => {
  try {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win && !win.isDestroyed()) {
      win.close();
      return { success: true };
    }
    return { success: false, error: 'No se encontró ventana actual' };
  } catch (e) {
    return { success: false, error: e?.message || String(e) };
  }
});