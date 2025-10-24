const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Reutilizamos el preload existente para exponer window.api
const preloadPath = path.join(__dirname, '..', 'src', 'main', 'preload.js');

// Servicios opcionales existentes (impresora, DB, IPC)
let registerIpcHandlers;
try {
  registerIpcHandlers = require(path.join(__dirname, '..', 'src', 'main', 'ipc'));
} catch (e) {
  console.warn('No se pudo cargar registerIpcHandlers, los handlers por IPC nativos no estarán disponibles:', e.message);
}

// Instanciar servicio de impresora para los handlers mínimos
let printer;
try {
  const PrinterService = require(path.join(__dirname, '..', 'src', 'main', 'hardware', 'printer'));
  printer = new PrinterService();
  // Aplicar perfil persistido si existe
  const profilePath = path.join(app.getPath('userData'), 'printerProfile.json');
  if (fs.existsSync(profilePath)) {
    const raw = fs.readFileSync(profilePath, 'utf8');
    const saved = JSON.parse(raw);
    printer.setProfile?.(saved);
  }
} catch (e) {
  console.warn('No se pudo instanciar PrinterService, funciones de impresión pueden no estar disponibles:', e.message);
}

async function tryRegisterPrinterOnly() {
  try {
    const printerHandlersPath = path.join(__dirname, '..', 'src', 'main', 'ipc', 'printerHandlers.js');
    const mod = require(printerHandlersPath);
    if (mod && typeof mod.registerPrinterHandlers === 'function') {
      await mod.registerPrinterHandlers({ printer });
      return true;
    }
    if (typeof mod === 'function') {
      await mod({ printer });
      return true;
    }
    if (mod && typeof mod.default === 'function') {
      await mod.default({ printer });
      return true;
    }
  } catch (e) {
    console.warn('No se pudieron registrar handlers de impresora de forma directa:', e.message);
  }
  return false;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    show: true,
  });

  win.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(async () => {
  try {
    if (typeof registerIpcHandlers === 'function') {
      // Si el proyecto espera argumentos, intenta con objetos mínimos.
      await registerIpcHandlers({ printer });
    } else {
      // Registrar handlers mínimos de impresora para preview/print
      await tryRegisterPrinterOnly();
    }
  } catch (e) {
    console.warn('Fallo al registrar handlers IPC:', e.message);
    await tryRegisterPrinterOnly();
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
