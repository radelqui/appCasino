// src/main/ipc/authHandlers.js
const { ipcMain } = require('electron');
const Roles = require('../security/roles');

let currentSession = null; // { user: { id, username, role }, createdAt }

function registerAuthHandlers({ db }) {
  console.log('🚀 Registrando handlers de autenticación (src/main/ipc/authHandlers.js)');

  ipcMain.handle('auth:get-session', async () => {
    return currentSession ? { ...currentSession } : null;
  });

  ipcMain.handle('auth:logout', async () => {
    currentSession = null;
    try { Roles.setRole('MESA'); } catch (e) { console.warn('No se pudo persistir rol a MESA:', e?.message || e); }
    return { success: true };
  });

  ipcMain.handle('auth:login', async (_e, payload) => {
    try {
      const { username, password } = payload || {};
      console.log('=================================');
      console.log('🔐 AUTH:LOGIN REAL LLAMADO');
      console.log('Usuario:', username);
      console.log('=================================');
      if (!username || !password){
        return { success: false, error: 'Usuario y contraseña requeridos' };
      }

      // Validación directa contra SQLite (usuarios)
      const result = (typeof db.authenticateUserLocal === 'function')
        ? db.authenticateUserLocal(String(username).trim(), String(password))
        : { success: false, error: 'Autenticación no disponible' };

      if (!result?.success){
        console.warn('✖️ Autenticación fallida:', result);
        return result || { success:false, error: 'Credenciales inválidas' };
      }

      const { user } = result;
      console.log('✅ Login exitoso:', user?.username || username);
      currentSession = { user, createdAt: new Date().toISOString() };
      try { Roles.setRole(user?.role || 'MESA'); } catch (e) { console.warn('No se pudo actualizar rol:', e?.message || e); }
      return { success: true, user };
    } catch (e) {
      console.error('❌❌❌ ERROR EN AUTH:LOGIN:', e);
      return { success:false, error: e?.message || String(e) };
    }
  });

  console.log('✅ Handlers de autenticación registrados (namespace auth:*)');
}

module.exports = { registerAuthHandlers };
