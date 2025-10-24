// src/main/ipc/statsHandlers.js
const { ipcMain } = require('electron');

function registerStatsHandlers({ db }) {
  ipcMain.handle('get-stats', async (event, dateRange) => {
    try {
      const { dateFrom, dateTo } = dateRange || {};
      const stats = db.getTicketStats(dateFrom, dateTo);
      return { success: true, stats };
    } catch (error) {
      console.error('[IPC:get-stats] Error:', error.message);
      throw new Error(error.message);
    }
  });
}

module.exports = { registerStatsHandlers };
