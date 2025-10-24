// src/main/ipc/syncHandlers.js
const { ipcMain } = require('electron');

function registerSyncHandlers({ performSync }) {
  ipcMain.handle('force-sync', async () => {
    try {
      await performSync();
      return { success: true, message: 'Sincronización completada' };
    } catch (error) {
      console.error('[IPC:force-sync] Error:', error.message);
      throw new Error(error.message);
    }
  });
}

module.exports = { registerSyncHandlers };
