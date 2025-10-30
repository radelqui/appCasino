// src/main/ipc/printerHandlers.js
const { ipcMain, app } = require('electron');
const fs = require('fs');
const path = require('path');
const { generateTicketPDF } = require('../utils/pdf-generator');

const PROFILE_PATH = path.join(app.getPath('userData'), 'printerProfile.json');

function loadProfileFromDisk() {
  try {
    if (fs.existsSync(PROFILE_PATH)) {
      const raw = fs.readFileSync(PROFILE_PATH, 'utf8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('[IPC:profile] No se pudo leer perfil:', e.message);
  }
  return null;
}

function saveProfileToDisk(profile) {
  try {
    fs.mkdirSync(path.dirname(PROFILE_PATH), { recursive: true });
    fs.writeFileSync(PROFILE_PATH, JSON.stringify(profile || {}, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.warn('[IPC:profile] No se pudo guardar perfil:', e.message);
    return false;
  }
}

function registerPrinterHandlers({ printer }) {
  ipcMain.handle('test-print', async () => {
    try {
      if (!printer?.testPrinter) throw new Error('Servicio de impresora no disponible');
      await printer.testPrinter();
      return { success: true };
    } catch (error) {
      console.error('[IPC:test-print] Error:', error.message);
      throw new Error(error.message);
    }
  });

  ipcMain.handle('test-calibration', async () => {
    try {
      if (!printer?.testCalibration) throw new Error('Servicio de impresora no disponible');
      await printer.testCalibration();
      return { success: true };
    } catch (error) {
      console.error('[IPC:test-calibration] Error:', error.message);
      throw new Error(error.message);
    }
  });

  ipcMain.handle('set-print-profile', async (event, profile) => {
    try {
      if (!printer?.setProfile) throw new Error('Servicio de impresora no disponible');
      const normalized = profile || {};
      printer.setProfile({
        mode: normalized.mode,
        width_mm: normalized.width_mm,
        height_mm: normalized.height_mm,
      });
      saveProfileToDisk({ mode: printer.mode, width_mm: printer.paperWidthMm, height_mm: printer.ticketHeightMm });
      // Actualizar menú si está disponible
      try { if (global.updatePrintMenu) global.updatePrintMenu(); } catch {}
      return { success: true, current: { mode: printer.mode, width_mm: printer.paperWidthMm, height_mm: printer.ticketHeightMm } };
    } catch (error) {
      console.error('[IPC:set-print-profile] Error:', error.message);
      throw new Error(error.message);
    }
  });

  ipcMain.handle('get-print-profile', async () => {
    try {
      const disk = loadProfileFromDisk();
      const current = disk || { mode: printer?.mode, width_mm: printer?.paperWidthMm, height_mm: printer?.ticketHeightMm };
      return { success: true, current };
    } catch (error) {
      console.error('[IPC:get-print-profile] Error:', error.message);
      throw new Error(error.message);
    }
  });

  ipcMain.handle('get-ticket-preview', async (event, previewData) => {
    try {
      const now = new Date();
      const ticketNumber = 'PREV-' + Math.floor((now.getTime() / 1000) % 1000000).toString().padStart(6, '0');
      const ticket = {
        ticket_number: ticketNumber,
        valor: Number(previewData?.valor ?? 123.45),
        moneda: (previewData?.moneda ?? 'DOP'),
        fecha_emision: now.toISOString(),
        mesa_id: previewData?.mesa_id ?? 'P01',
        usuario_emision: previewData?.usuario_emision ?? 'VistaPrevia'
      };
      const pageWidthMm = Number(previewData?.pageWidthMm ?? printer?.paperWidthMm ?? 80);
      const pageHeightMm = Number(previewData?.pageHeightMm ?? printer?.ticketHeightMm ?? 156);
      const buf = await generateTicketPDF({ ...ticket, pageWidthMm, pageHeightMm });
      const dataUrl = `data:application/pdf;base64,${buf.toString('base64')}`;
      return { success: true, dataUrl };
    } catch (error) {
      console.error('[IPC:get-ticket-preview] Error:', error.message);
      throw new Error(error.message);
    }
  });
}

module.exports = { registerPrinterHandlers };