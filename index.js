// src/main/ipc/index.js
const { registerTicketHandlers } = require('./ticketHandlers');
const { registerStatsHandlers } = require('./statsHandlers');
const { registerSyncHandlers } = require('./syncHandlers');

function registerIpcHandlers(services) {
  registerTicketHandlers(services);
  registerStatsHandlers(services);
  registerSyncHandlers(services);
}

module.exports = {
  registerIpcHandlers
};