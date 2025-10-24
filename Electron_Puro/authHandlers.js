// authHandlers.js - Autenticación global (usuario/contraseña)
require('dotenv').config();
const path = require('path');
const { ipcMain } = require('electron');
const CasinoDatabase = require(path.join(__dirname, '..', 'Caja', 'database.js'));
const { loginUserSupabase, createUserSupabase } = require(path.join(__dirname, '..', 'supabaseClient.js'));
const Roles = (() => { try { return require(path.join(__dirname, '..', 'src', 'main', 'security', 'roles')); } catch (e) { return null; } })();

// Base de datos local
const dbPath = process.env.CASINO_DB_PATH || path.join(__dirname, '..', 'Caja', 'data', 'casino.db');
const db = new CasinoDatabase(dbPath);

let currentSession = null; // { user: { id, username, role }, createdAt }

function setRolePersisted(role){
  try {
    // Persistir rol en configuracion para integrarse con fallback
    db.setConfig('rol_actual', String(role || 'MESA').toUpperCase());
  } catch (e) { console.warn('No se pudo persistir rol_actual:', e?.message || e); }
  try {
    if (Roles?.setRole) Roles.setRole(role);
  } catch (e) { console.warn('No se pudo actualizar Roles.setRole:', e?.message || e); }
}

function registerAuthHandlers(){
  ipcMain.handle('auth:get-session', async () => {
    return currentSession ? { ...currentSession } : null;
  });

  ipcMain.handle('auth:logout', async () => {
    currentSession = null;
    setRolePersisted('MESA');
    return { success: true };
  });

  ipcMain.handle('auth:login', async (_e, payload) => {
    try {
      const { username, password } = payload || {};
      if (!username || !password){
        return { success: false, error: 'Usuario y contraseña requeridos' };
      }
      const useSupabase = String(process.env.USE_SUPABASE || '').toLowerCase() === 'true';
      let result;
      if (useSupabase){
        try {
          result = await loginUserSupabase(username, password);
        } catch (err) {
          console.warn('Supabase login falló, usando modo local:', err?.message || err);
          result = db.authenticateUserLocal(username, password);
          if (!result?.success) {
            return { success:false, error: 'Modo local activo. Verifique usuario/contraseña.' };
          }
        }
      } else {
        result = db.authenticateUserLocal(username, password);
      }
      if (!result?.success){
        return result || { success:false, error: 'Credenciales inválidas' };
      }
      const { user } = result;
      currentSession = { user, createdAt: new Date().toISOString() };
      setRolePersisted(user.role);
      return { success: true, user };
    } catch (e) {
      return { success:false, error: e?.message || String(e) };
    }
  });

  // --- Gestión de usuarios ---
  ipcMain.handle('users:list', async () => {
    try { return db.listUsers(); } catch (e) { return { success:false, error: e.message }; }
  });

  ipcMain.handle('users:create', async (_e, payload) => {
    try {
      const { username, password, role = 'MESA', activo = 1, email = null } = payload || {};
      if (!username || !password) return { success:false, error:'Usuario y contraseña requeridos' };
      // Primero crear en SQLite (local)
      const localRes = db.createUser(username, password, role, activo, email);
      // Luego intentar replicar en Supabase si está habilitado
      const useSupabase = String(process.env.USE_SUPABASE || '').toLowerCase() === 'true';
      if (useSupabase) {
        try { await createUserSupabase(username, password, role, !!activo); }
        catch (err) { console.warn('Replica a Supabase falló:', err?.message || err); }
      }
      return localRes;
    } catch (e) { return { success:false, error: e.message }; }
  });

  ipcMain.handle('users:set-active', async (_e, id, active) => {
    try { return db.setUserActive(id, !!active); } catch (e) { return { success:false, error: e.message }; }
  });

  ipcMain.handle('users:set-role', async (_e, id, role) => {
    try { return db.setUserRole(id, role); } catch (e) { return { success:false, error: e.message }; }
  });

  ipcMain.handle('users:set-password', async (_e, id, newPassword) => {
    try {
      if (!newPassword || String(newPassword).length < 6) return { success:false, error:'Contraseña muy corta' };
      return db.setUserPassword(id, newPassword);
    } catch (e) { return { success:false, error: e.message }; }
  });

  ipcMain.handle('users:delete', async (_e, id) => {
    try { return db.deleteUser(id); } catch (e) { return { success:false, error: e.message }; }
  });

  console.log('✅ Handlers de autenticación registrados (namespace auth:*)');
}

module.exports = { registerAuthHandlers };

process.on('exit', () => { try { db?.close(); } catch{} });