// src/main/ipc/index.js
const { registerTicketHandlers } = require('./ticketHandlers');
const { registerStatsHandlers } = require('./statsHandlers');
const { registerSyncHandlers } = require('./syncHandlers');
const { registerPrinterHandlers } = require('./printerHandlers');

function registerIpcHandlers(services) {
  registerTicketHandlers(services);
  registerStatsHandlers(services);
  registerSyncHandlers(services);
  registerPrinterHandlers(services);
}

module.exports = {
  registerIpcHandlers
};