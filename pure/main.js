console.log('🔍 [DEBUG] Cargando pure/main.js...');
const electron = require('electron');
console.log('🔍 [DEBUG] Electron importado:', typeof electron);
console.log('🔍 [DEBUG] Electron value:', electron);
console.log('🔍 [DEBUG] Electron string value:', String(electron));
const { app, BrowserWindow, ipcMain, dialog } = electron;
console.log('🔍 [DEBUG] app:', typeof app);
console.log('🔍 [DEBUG] BrowserWindow:', typeof BrowserWindow);
console.log('🔍 [DEBUG] ipcMain:', typeof ipcMain);
const path = require('path');
const fs = require('fs');
require('dotenv').config();
const crypto = require('crypto');

// Deshabilitar logs excesivos que congelan DevTools
if (process.env.NODE_ENV === 'production') {
    console.log = () => {};
}
// Reutilizamos el preload existente para exponer window.api (definir temprano)
const preloadPath = path.join(__dirname, '..', 'src', 'main', 'preload.js');
// Servicio centralizado de tickets (reemplaza llamadas directas a generateTicketPDF)
const { TicketService } = require(path.join(__dirname, '..', 'shared', 'ticket-service.js'));
// Flags de logging
const VERBOSE = process.env.CASINO_VERBOSE === '1';
const LOG_SCHEMA = process.env.CASINO_LOG_SCHEMA === '1';
// Supabase Manager para sincronización cloud
const { getSupabaseManager } = require(path.join(__dirname, 'supabaseManager'));
let supabaseManager = null; // Se inicializa después de app.whenReady()
// Health Monitor para detectar cuelgues
const { getHealthMonitor } = require(path.join(__dirname, 'healthMonitor'));
const { SafeDatabaseOperations, SafeSupabaseOperations } = require(path.join(__dirname, 'safeOperations'));
let healthMonitor = null;
let safeDb = null;
let safeSupabase = null;

// Mitigar problemas de GPU en algunos equipos/VMs
if (app) {
  try {
    app.disableHardwareAcceleration();
    app.commandLine.appendSwitch('disable-gpu');
    app.commandLine.appendSwitch('disable-gpu-compositing');
  } catch (e) {
    console.warn('No se pudieron aplicar configuraciones de GPU:', e?.message);
  }
}

// ============================================
// Base de datos unificada (misma ruta que Caja)
// ============================================
let db; // instancia de CasinoDatabase
try {
  const CasinoDatabase = require(path.join(__dirname, '..', 'Caja', 'database'));
  const dbPath = process.env.CASINO_DB_PATH || process.env.SQLITE_DB_PATH || path.join(process.cwd(), 'data', 'casino.db');
  db = new CasinoDatabase(dbPath);
  // Asegurar columnas adicionales para Mesa/Operador en tickets
  try {
    const cols = db.db.prepare("PRAGMA table_info('tickets')").all().map(c => c.name);
    const toAdd = [];
    if (!cols.includes('mesa_nombre')) toAdd.push("ALTER TABLE tickets ADD COLUMN mesa_nombre TEXT");
    if (!cols.includes('mesa_id')) toAdd.push("ALTER TABLE tickets ADD COLUMN mesa_id INTEGER");
    if (!cols.includes('created_by_user_id')) toAdd.push("ALTER TABLE tickets ADD COLUMN created_by_user_id INTEGER");
    if (!cols.includes('created_by_username')) toAdd.push("ALTER TABLE tickets ADD COLUMN created_by_username TEXT");
    for (const sql of toAdd) { try { db.db.exec(sql); } catch {} }
  } catch (e) {
    if (VERBOSE) console.warn('No se pudieron asegurar columnas extra en tickets:', e?.message);
  }
  // Diagnóstico silenciable: esquema de BD
  if (LOG_SCHEMA) {
    try {
      const tables = db.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
      console.log('📦 Tablas en SQLite:', tables.map(t => t.name).join(', '));
      for (const t of tables) {
        if (!t?.name) continue;
        const info = db.db.prepare(`PRAGMA table_info(${t.name})`).all();
        console.log(`🧩 PRAGMA table_info(${t.name}):`, info.map(c => `${c.name}:${c.type}`).join(', '));
      }
    } catch (e) {
      if (VERBOSE) console.warn('No se pudo imprimir esquema de BD:', e?.message);
    }
  }
} catch (e) {
  console.warn('No se pudo inicializar la base de datos para auth/stats:', e.message);
}

// ============================================
// SESIÓN GLOBAL
// ============================================
let currentSession = null;
let mainWindow = null;
// Modo de una sola ventana: no se mantiene registro de ventanas hijas

// ============================================
// SISTEMA DE SEGURIDAD
// ============================================
// Sesiones activas: sessionId → { userId, username, station, loginAt, lastActivity }
let activeSessions = new Map();

// IPs bloqueadas: ip → { blockedAt, attempts, reason }
let blockedIPs = new Map();

// Intentos de login por IP: ip → attempts
let loginAttempts = new Map();

// Interval de backup automático
let backupInterval = null;

// Estadísticas de seguridad
let securityStats = {
  totalLogins: 0,
  failedLogins: 0,
  totalBackups: 0,
  lastBackup: null
};

// ============================================
// FUNCIONES DE SEGURIDAD
// ============================================

// Cargar configuración de seguridad
function getSecurityConfig() {
  try {
    const configPath = path.join(app.getPath('userData'), 'security-config.json');
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  } catch (error) {
    console.error('Error cargando security config:', error.message);
  }

  // Configuración por defecto
  return {
    password: { minLength: 8, requireUppercase: true, requireNumbers: true, requireSpecial: false, expirationDays: 90 },
    session: { inactivityTimeout: 30, allowMultipleSessions: false, logging: true },
    login: { maxAttempts: 3, lockoutMinutes: 15, notifyOnBlock: true },
    backup: { enabled: true, frequencyHours: 24, keepCount: 30, encrypt: true },
    audit: { level: 'normal', retentionDays: 365, criticalAlerts: true }
  };
}

// Cargar IPs bloqueadas desde archivo
function loadBlockedIPs() {
  try {
    const configPath = path.join(app.getPath('userData'), 'blocked-ips.json');
    if (fs.existsSync(configPath)) {
      const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      blockedIPs = new Map(Object.entries(data));
      console.log(`🔒 Cargadas ${blockedIPs.size} IPs bloqueadas`);
    }
  } catch (error) {
    console.error('Error cargando blocked IPs:', error.message);
  }
}

// Guardar IPs bloqueadas
function saveBlockedIPs() {
  try {
    const configPath = path.join(app.getPath('userData'), 'blocked-ips.json');
    const data = Object.fromEntries(blockedIPs);
    fs.writeFileSync(configPath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error guardando blocked IPs:', error.message);
  }
}

// Verificar si IP está bloqueada
function isIPBlocked(ip) {
  if (!blockedIPs.has(ip)) return false;

  const blockData = blockedIPs.get(ip);
  const config = getSecurityConfig();
  const blockedAt = new Date(blockData.blockedAt);
  const now = new Date();
  const minutesSinceBlock = (now - blockedAt) / 1000 / 60;

  // Si ha pasado el tiempo de lockout, desbloquear automáticamente
  if (minutesSinceBlock > config.login.lockoutMinutes) {
    blockedIPs.delete(ip);
    saveBlockedIPs();
    console.log(`🔓 IP ${ip} desbloqueada automáticamente (timeout)`);
    return false;
  }

  return true;
}

// Bloquear IP
function blockIP(ip, reason = 'Múltiples intentos fallidos') {
  blockedIPs.set(ip, {
    blockedAt: new Date().toISOString(),
    attempts: (blockedIPs.get(ip)?.attempts || 0) + 1,
    reason
  });
  saveBlockedIPs();
  console.log(`🔒 IP bloqueada: ${ip} - ${reason}`);
}

// Limpiar backups antiguos
function cleanOldBackups(backupDir, keepCount) {
  try {
    const files = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('auto_backup_') && f.endsWith('.db'))
      .map(f => ({
        name: f,
        path: path.join(backupDir, f),
        mtime: fs.statSync(path.join(backupDir, f)).mtime
      }))
      .sort((a, b) => b.mtime - a.mtime);

    // Eliminar backups que excedan keepCount
    files.slice(keepCount).forEach(file => {
      fs.unlinkSync(file.path);
      console.log(`🗑️  Backup antiguo eliminado: ${file.name}`);
    });
  } catch (error) {
    console.error('Error limpiando backups:', error.message);
  }
}

// Backup automático
async function performAutomaticBackup() {
  try {
    const config = getSecurityConfig();

    if (!config.backup.enabled) {
      console.log('⚠️  Backup automático deshabilitado en configuración');
      return;
    }

    console.log('💾 Ejecutando backup automático...');

    const dbPath = process.env.CASINO_DB_PATH || process.env.SQLITE_DB_PATH || path.join(process.cwd(), 'data', 'casino.db');

    if (!fs.existsSync(dbPath)) {
      console.warn('⚠️  Base de datos no encontrada:', dbPath);
      return;
    }

    const backupDir = path.join(process.cwd(), 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' + new Date().toISOString().replace(/[:.]/g, '-').split('T')[1].substring(0, 8);
    const backupPath = path.join(backupDir, `auto_backup_${timestamp}.db`);

    fs.copyFileSync(dbPath, backupPath);

    securityStats.totalBackups++;
    securityStats.lastBackup = new Date().toISOString();

    console.log('✅ Backup automático completado:', backupPath);

    // Limpiar backups antiguos
    cleanOldBackups(backupDir, config.backup.keepCount);

  } catch (error) {
    console.error('❌ Error en backup automático:', error.message);
  }
}

// Iniciar backup automático
function startAutomaticBackup() {
  const config = getSecurityConfig();

  if (backupInterval) {
    clearInterval(backupInterval);
  }

  if (config.backup.enabled) {
    const intervalMs = config.backup.frequencyHours * 60 * 60 * 1000;
    backupInterval = setInterval(performAutomaticBackup, intervalMs);

    console.log(`✅ Backup automático configurado: cada ${config.backup.frequencyHours} horas`);

    // Realizar primer backup después de 1 minuto
    setTimeout(performAutomaticBackup, 60000);
  }
}

// Obtener tiempo del último backup
function getLastBackupTime() {
  try {
    const backupDir = path.join(process.cwd(), 'backups');
    if (!fs.existsSync(backupDir)) return null;

    const files = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('auto_backup_') && f.endsWith('.db'))
      .map(f => ({
        name: f,
        path: path.join(backupDir, f),
        mtime: fs.statSync(path.join(backupDir, f)).mtime
      }))
      .sort((a, b) => b.mtime - a.mtime);

    if (files.length > 0) {
      return files[0].mtime.toISOString();
    }

    return null;
  } catch (error) {
    console.error('Error obteniendo último backup:', error.message);
    return null;
  }
}

// Obtener tiempo del próximo backup
function getNextBackupTime() {
  const config = getSecurityConfig();
  if (!config.backup.enabled) return null;

  const lastBackup = getLastBackupTime();
  if (!lastBackup) return 'Próximo: en 1 minuto';

  const nextBackup = new Date(lastBackup);
  nextBackup.setHours(nextBackup.getHours() + config.backup.frequencyHours);

  return nextBackup.toISOString();
}

// ============================================
// HELPER: Registrar IPC handler de manera segura
// ============================================
function safeIpcHandle(channel, handler) {
  if (!ipcMain || typeof ipcMain.handle !== 'function') {
    console.warn(`⚠️  No se pudo registrar handler '${channel}' - ipcMain no disponible`);
    return false;
  }
  try {
    ipcMain.handle(channel, handler);
    return true;
  } catch (error) {
    console.error(`❌ Error registrando handler '${channel}':`, error.message);
    return false;
  }
}

// ============================================
// HELPER: Registrar eventos en audit_log
// ============================================
async function registrarAuditLog(eventType, userId, stationId, voucherId, details) {
  try {
    if (!supabaseManager || !supabaseManager.isAvailable()) {
      if (VERBOSE) console.warn('⚠️  [AuditLog] Supabase no disponible, no se registrará el evento');
      return;
    }

    const { data, error } = await supabaseManager.client
      .from('audit_log')
      .insert({
        action: eventType,
        user_id: userId || null,
        user_role: null,  // Se llenará por trigger en Supabase
        station_id: stationId || null,
        voucher_id: voucherId || null,
        details: details || {},
        ip_address: null  // TODO: Obtener IP si es necesario
      })
      .select()
      .single();

    if (error) {
      console.error('❌ [AuditLog] Error registrando evento:', error.message);
    } else {
      if (VERBOSE) console.log(`📝 [AuditLog] Evento registrado: ${eventType}`, data?.id);
    }
  } catch (error) {
    console.error('❌ [AuditLog] Error crítico:', error?.message);
  }
}

// ============================================
// FUNCIÓN: Registrar todos los handlers IPC
// ============================================
function registerAllHandlers() {
  // ============================================
  // HANDLER: auth:login (Supabase Auth)
  // ============================================
  console.log('📝 Registrando handlers de autenticación...');
  try {
    safeIpcHandle('auth:login', async (_event, { username, password }) => {
    try {
      console.log('🔐 Intentando login:', username);

      // 🔒 SEGURIDAD: Verificar si IP está bloqueada
      const clientIP = _event?.sender?.getOwnerBrowserWindow()?.webContents?.getURL() || 'localhost';
      if (isIPBlocked(clientIP)) {
        console.log(`🚫 Login bloqueado desde IP: ${clientIP}`);
        securityStats.failedLogins++;
        return { success: false, error: 'IP bloqueada temporalmente por múltiples intentos fallidos' };
      }

      if (!supabaseManager || !supabaseManager.isAvailable()) {
        console.log('❌ Supabase no disponible');
        return { success: false, error: 'Sistema de autenticación no disponible' };
      }

      // Login con Supabase Auth usando cliente ANON
      const authClient = supabaseManager.anonClient || supabaseManager.client;
      const { data, error } = await authClient.auth.signInWithPassword({
        email: username,
        password: password
      });

      if (error) {
        console.log('❌ Error de login:', error.message);

        // 🔒 SEGURIDAD: Registrar intento fallido
        const attempts = (loginAttempts.get(clientIP) || 0) + 1;
        loginAttempts.set(clientIP, attempts);
        securityStats.failedLogins++;

        const config = getSecurityConfig();
        if (attempts >= config.login.maxAttempts) {
          blockIP(clientIP, `${attempts} intentos fallidos`);
          console.log(`🔒 IP bloqueada después de ${attempts} intentos: ${clientIP}`);
        }

        return { success: false, error: 'Email o contraseña incorrectos' };
      }

      console.log('✅ Auth exitoso, obteniendo perfil...');

      // Obtener perfil del usuario (usando SERVICE_ROLE que ya tiene supabaseManager)
      const { data: profile, error: profileError } = await supabaseManager.client
        .from('users')
        .select('*')
        .eq('id', data.user.id)
        .maybeSingle(); // ✅ Cambiado de .single() a .maybeSingle() para evitar error si no existe

      console.log('Perfil obtenido:', { profile, profileError: profileError?.message });

      if (profileError) {
        console.log('❌ Error obteniendo perfil:', profileError.message);
        return { success: false, error: 'Error obteniendo perfil de usuario' };
      }

      if (!profile) {
        console.log('❌ Perfil no encontrado');
        return { success: false, error: 'Usuario sin perfil configurado' };
      }

      if (!profile.is_active) {
        console.log('❌ Usuario inactivo');
        return { success: false, error: 'Usuario inactivo' };
      }

      // 🔒 SEGURIDAD: Limpiar intentos fallidos en login exitoso
      loginAttempts.delete(clientIP);

      // 🔒 SEGURIDAD: Crear sesión con UUID
      const sessionId = crypto.randomUUID();
      const now = new Date().toISOString();

      // Guardar sesión (estructura antigua para compatibilidad)
      currentSession = {
        user: {
          id: profile.id,
          email: profile.email,
          username: profile.full_name,
          role: profile.role.toUpperCase()
        }
      };

      // 🔒 SEGURIDAD: Registrar en activeSessions Map
      activeSessions.set(sessionId, {
        sessionId,
        userId: profile.id,
        username: profile.full_name,
        email: profile.email,
        role: profile.role.toUpperCase(),
        station: clientIP,
        loginAt: now,
        lastActivity: now
      });

      securityStats.totalLogins++;

      console.log(`✅ Login exitoso: ${profile.full_name} (Session: ${sessionId})`);

      // Registrar evento de login en audit_log
      await registrarAuditLog(
        'user_login',
        profile.id,
        null,
        null,
        { email: profile.email, role: profile.role, full_name: profile.full_name, sessionId }
      );

      return {
        success: true,
        user: currentSession.user,
        sessionId
      };

    } catch (error) {
      console.error('❌ Error en login:', error);
      return { success: false, error: error.message };
    }
  });
  // (Eliminado handler admin:reset-pins temporal)

  // ============================================
  // HANDLER: auth:get-session
  // ============================================
  safeIpcHandle('auth:get-session', async () => {
    console.log('[Handler] auth:get-session llamado, session:', !!currentSession);
    return currentSession;
  });

  // ============================================
  // HANDLER: get-role / set-role
  // ============================================
  safeIpcHandle('get-role', async () => {
    const role = currentSession?.user?.role || null;
    console.log('[Handler] get-role llamado, role:', role);
    return role;
  });
  safeIpcHandle('set-role', async (_event, role) => {
    if (currentSession?.user) currentSession.user.role = String(role).toUpperCase();
    console.log('[Handler] set-role llamado, new role:', currentSession?.user?.role);
    return currentSession?.user?.role || null;
  });

  // ============================================
  // HANDLER: auth:logout
  // ============================================
safeIpcHandle('auth:logout', async () => {
  currentSession = null;
  return { success: true };
});

console.log('✅ Handlers de autenticación registrados (auth:login, auth:get-session, get-role, set-role, auth:logout)');

// Abre una nueva ventana para una vista específica (mesa/caja/auditoria)
// Eliminado: creación de nuevas ventanas por vista. Se carga el contenido en la ventana actual.

// Handler para abrir vistas desde el panel (abre ventanas como antes)
safeIpcHandle('open-view', async (event, viewName) => {
  try {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return { success: false, error: 'Window not found' };

    let normalized = String(viewName || '').toLowerCase();
    if (!normalized) return { success: false, error: 'Parámetro viewName inválido' };
    if (normalized === 'auditoria') normalized = 'auditor';

    let filePath;
    switch (normalized) {
      case 'panel':
        filePath = path.join(__dirname, '..', 'Caja', 'panel.html');
        break;
      case 'mesa':
        // Usar archivo existente en pure
        filePath = path.join(__dirname, 'mesa.html');
        break;
      case 'caja':
        // Usar vista de Caja original
        filePath = path.join(__dirname, '..', 'Caja', 'caja.html');
        break;
      case 'auditor':
      case 'auditoria':
        // Vista auditor/auditoría existente en pure
        filePath = path.join(__dirname, 'auditor.html');
        break;
      case 'config':
        // Vista de configuración
        filePath = path.join(__dirname, 'config.html');
        break;
      case 'operadores':
        // Vista de gestión de operadores
        filePath = path.join(__dirname, 'operadores.html');
        break;
      case 'usuarios':
        // Vista de gestión de usuarios
        filePath = path.join(__dirname, 'usuarios.html');
        break;
      case 'logs':
        // Vista de logs del sistema
        filePath = path.join(__dirname, 'logs.html');
        break;
      case 'database':
        // Vista de gestión de base de datos
        filePath = path.join(__dirname, 'database.html');
        break;
      case 'impresoras':
        // Vista de configuración de impresoras
        filePath = path.join(__dirname, 'impresoras.html');
        break;
      case 'monedas':
        // Vista de configuración de monedas y valores
        filePath = path.join(__dirname, 'monedas.html');
        break;
      case 'sync-utility':
        // Utilidad de sincronización masiva
        filePath = path.join(__dirname, 'sync-utility.html');
        break;
      case 'reportes':
        // Vista de reportes y análisis avanzados
        filePath = path.join(__dirname, 'reportes.html');
        break;
      case 'seguridad':
        // Vista de configuración de seguridad
        filePath = path.join(__dirname, 'seguridad.html');
        break;
      default:
        return { success: false, error: 'Vista desconocida' };
    }

    await win.loadFile(filePath);
    if (VERBOSE) console.log(`✅ Vista ${normalized} cargada en ventana actual: ${filePath}`);
    return { success: true, view: normalized };
  } catch (error) {
    console.error('❌ Error en open-view:', error);
    return { success: false, error: error.message };
  }
});

safeIpcHandle('back-to-panel', async (event) => {
  try {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return { success: false };
    const panelPath = path.join(__dirname, '..', 'Caja', 'panel.html');
    await win.loadFile(panelPath);
    if (VERBOSE) console.log('↩️  Volver al panel en la misma ventana');
    return { success: true };
  } catch (e) {
    console.error('❌ Error en back-to-panel:', e);
    return { success: false, error: e?.message };
  }
});

// Compat: enfoque del panel (no-ops seguros en modelo de ventana única)
safeIpcHandle('focus-panel', async (event) => {
  try {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) { try { win.show(); win.focus(); } catch {} }
    return { success: true };
  } catch (e) {
    return { success: false, error: e?.message };
  }
});

// Compat: cerrar ventana actual (no cerrar en modo de una sola ventana)
safeIpcHandle('close-current', async () => {
  // No hacemos nada para evitar cerrar la única ventana
  return { success: true };
});

// Salir de la app
safeIpcHandle('exit-app', async () => {
  try {
    console.log('🚪 Cerrando aplicación');
    app.quit();
    return { success: true };
  } catch (e) {
    return { success: false, error: e?.message };
  }
});

// ============================================
// HANDLERS: Configuración de Impresoras
// ============================================

// Detectar impresoras del sistema
safeIpcHandle('printer:detect', async () => {
  try {
    const { getPrinters } = require('pdf-to-printer');
    const printers = await getPrinters();

    return {
      success: true,
      printers: printers.map(p => ({
        name: p.name,
        description: p.description || '',
        isDefault: p.isDefault || false
      }))
    };
  } catch (error) {
    console.error('❌ Error detectando impresoras:', error);
    return { success: false, error: error.message };
  }
});

// Guardar configuración de impresora
safeIpcHandle('printer:save-config', async (event, config) => {
  try {
    const configPath = path.join(app.getPath('userData'), 'printer-config.json');

    let allConfigs = {};
    if (fs.existsSync(configPath)) {
      allConfigs = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }

    allConfigs[config.name] = {
      type: config.type,
      width: config.width,
      isDefault: config.isDefault
    };

    // Si es predeterminada, desmarcar las demás
    if (config.isDefault) {
      Object.keys(allConfigs).forEach(key => {
        if (key !== config.name) {
          allConfigs[key].isDefault = false;
        }
      });
    }

    fs.writeFileSync(configPath, JSON.stringify(allConfigs, null, 2));

    console.log('✅ Configuración de impresora guardada:', config.name);
    return { success: true };
  } catch (error) {
    console.error('❌ Error guardando config de impresora:', error);
    return { success: false, error: error.message };
  }
});

// Obtener configuración de impresora
safeIpcHandle('printer:get-config', async (event, printerName) => {
  try {
    const configPath = path.join(app.getPath('userData'), 'printer-config.json');

    if (!fs.existsSync(configPath)) {
      return { success: true, type: 'thermal', width: 80, isDefault: false };
    }

    const allConfigs = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const config = allConfigs[printerName] || { type: 'thermal', width: 80, isDefault: false };

    return { success: true, ...config };
  } catch (error) {
    console.error('❌ Error obteniendo config de impresora:', error);
    return { success: false, error: error.message };
  }
});

// Establecer impresora predeterminada
safeIpcHandle('printer:set-default', async (event, printerName) => {
  try {
    const configPath = path.join(app.getPath('userData'), 'printer-config.json');

    let allConfigs = {};
    if (fs.existsSync(configPath)) {
      allConfigs = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }

    // Desmarcar todas
    Object.keys(allConfigs).forEach(key => {
      allConfigs[key].isDefault = (key === printerName);
    });

    // Si no existe, crear con defaults
    if (!allConfigs[printerName]) {
      allConfigs[printerName] = { type: 'thermal', width: 80, isDefault: true };
    } else {
      allConfigs[printerName].isDefault = true;
    }

    fs.writeFileSync(configPath, JSON.stringify(allConfigs, null, 2));

    console.log('✅ Impresora predeterminada:', printerName);
    return { success: true };
  } catch (error) {
    console.error('❌ Error estableciendo impresora predeterminada:', error);
    return { success: false, error: error.message };
  }
});

// Prueba de impresión
safeIpcHandle('printer:test-print', async () => {
  try {
    const configPath = path.join(app.getPath('userData'), 'printer-config.json');
    let printerName = null;

    // Obtener impresora predeterminada
    if (fs.existsSync(configPath)) {
      const allConfigs = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      const defaultPrinter = Object.entries(allConfigs).find(([name, config]) => config.isDefault);
      if (defaultPrinter) {
        printerName = defaultPrinter[0];
      }
    }

    // Generar ticket de prueba
    const testTicket = {
      ticket_number: 'TEST-' + Date.now(),
      valor: 100,
      moneda: 'USD',
      fecha_emision: new Date().toISOString(),
      qr_code: JSON.stringify({
        code: 'TEST-' + Date.now(),
        amount: 100,
        currency: 'USD',
        mesa: 'PRUEBA',
        timestamp: Date.now(),
        hash: '00000000'
      }),
      mesa_id: 'PRUEBA',
      usuario_emision: 'PRUEBA',
      operador_nombre: 'SISTEMA'
    };

    const pdfBuffer = await TicketService.generateTicket(testTicket);

    // Imprimir
    const { print } = require('pdf-to-printer');
    const tempPath = path.join(app.getPath('temp'), 'test-ticket.pdf');
    fs.writeFileSync(tempPath, pdfBuffer);

    await print(tempPath, printerName ? { printer: printerName } : undefined);

    // Limpiar archivo temporal
    try { fs.unlinkSync(tempPath); } catch {}

    console.log('✅ Ticket de prueba impreso:', printerName || 'impresora predeterminada del sistema');
    return { success: true };
  } catch (error) {
    console.error('❌ Error en prueba de impresión:', error);
    return { success: false, error: error.message };
  }
});

// ============================================
// HANDLERS: Configuración de Monedas y Valores
// ============================================

// Obtener configuración de monedas
safeIpcHandle('currency:get-config', async () => {
  try {
    const configPath = path.join(app.getPath('userData'), 'currency-config.json');

    if (!fs.existsSync(configPath)) {
      // Configuración por defecto
      return {
        success: true,
        config: {
          USD: {
            enabled: true,
            min: 5,
            max: 10000,
            decimals: 2,
            presets: [20, 50, 100, 200, 500, 1000]
          },
          DOP: {
            enabled: true,
            min: 50,
            max: 500000,
            decimals: 2,
            presets: [100, 500, 1000, 2000, 5000, 10000]
          },
          exchangeRate: 58.50,
          lastUpdated: new Date().toISOString()
        }
      };
    }

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return { success: true, config };
  } catch (error) {
    console.error('❌ Error obteniendo configuración de monedas:', error);
    return { success: false, error: error.message };
  }
});

// Guardar configuración de monedas
safeIpcHandle('currency:save-config', async (event, config) => {
  try {
    const configPath = path.join(app.getPath('userData'), 'currency-config.json');

    // Validación básica
    if (!config || typeof config !== 'object') {
      throw new Error('Configuración inválida');
    }

    // Validar que al menos una moneda esté habilitada
    if (!config.USD?.enabled && !config.DOP?.enabled) {
      throw new Error('Debe haber al menos una moneda activa');
    }

    // Guardar con timestamp
    config.lastUpdated = new Date().toISOString();

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log('✅ Configuración de monedas guardada correctamente');

    return { success: true };
  } catch (error) {
    console.error('❌ Error guardando configuración de monedas:', error);
    return { success: false, error: error.message };
  }
});

// ============================================
// HANDLER: Sincronización masiva de tickets pendientes
// ============================================
safeIpcHandle('sync-all-pending', async () => {
  console.log('🚀 Iniciando sincronización masiva...');

  try {
    if (!db) {
      throw new Error('Base de datos SQLite no disponible');
    }

    if (!supabaseManager || !supabaseManager.isAvailable()) {
      throw new Error('Supabase no está disponible');
    }

    // Obtener tickets pendientes
    const pending = db.prepare('SELECT * FROM tickets WHERE sincronizado = 0 OR sincronizado IS NULL').all();

    console.log(`📊 Tickets pendientes: ${pending.length}`);

    if (pending.length === 0) {
      return {
        success: true,
        message: 'No hay tickets pendientes',
        synced: 0,
        failed: 0
      };
    }

    let synced = 0;
    let failed = 0;
    const errors = [];

    for (const ticket of pending) {
      try {
        const voucherData = {
          voucher_code: ticket.code || ticket.ticket_number,
          amount: parseFloat(ticket.amount),
          currency: ticket.currency || 'DOP',
          status: ticket.estado === 'cobrado' || ticket.estado === 'usado' ? 'redeemed' : 'active',
          issued_at: ticket.fecha_emision || ticket.created_at || new Date().toISOString(),
          created_at: ticket.created_at || new Date().toISOString(),
          redeemed_at: ticket.fecha_cobro || null,
          mesa_nombre: ticket.mesa || null,
          operador_nombre: ticket.usuario_emision || ticket.operador || null
        };

        const { data, error } = await supabaseManager.client
          .from('vouchers')
          .insert(voucherData)
          .select();

        if (error) {
          if (error.code === '23505') { // Duplicate key
            const { error: updateError } = await supabaseManager.client
              .from('vouchers')
              .update({
                status: voucherData.status,
                redeemed_at: voucherData.redeemed_at
              })
              .eq('voucher_code', voucherData.voucher_code);

            if (!updateError) {
              db.prepare('UPDATE tickets SET sincronizado = 1 WHERE id = ?').run(ticket.id);
              synced++;
            } else {
              failed++;
              errors.push({ code: ticket.code || ticket.ticket_number, error: updateError.message });
            }
          } else {
            failed++;
            errors.push({ code: ticket.code || ticket.ticket_number, error: error.message });
          }
        } else {
          db.prepare('UPDATE tickets SET sincronizado = 1 WHERE id = ?').run(ticket.id);
          synced++;
        }

        if ((synced + failed) % 100 === 0) {
          console.log(`📈 Progreso: ${synced + failed}/${pending.length} (✅ ${synced} | ❌ ${failed})`);
        }

        // Pausa para no saturar
        if (synced % 50 === 0) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }

      } catch (error) {
        failed++;
        errors.push({ code: ticket.code || ticket.ticket_number, error: error.message });
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMEN DE SINCRONIZACIÓN');
    console.log('='.repeat(60));
    console.log(`Total: ${pending.length}`);
    console.log(`✅ Exitosos: ${synced}`);
    console.log(`❌ Fallidos: ${failed}`);
    console.log(`📈 Tasa de éxito: ${((synced / pending.length) * 100).toFixed(1)}%`);

    return {
      success: true,
      synced,
      failed,
      total: pending.length,
      errors: errors.slice(0, 10) // Primeros 10 errores
    };

  } catch (error) {
    console.error('❌ Error en sincronización masiva:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

  // ============================================
  // HANDLER: get-stats-today (usando tickets)
  // ============================================
  safeIpcHandle('get-stats-today', async () => {
    try {
      if (!db) throw new Error('DB no disponible');
      const s = db.getStatsToday() || { ticketsHoy: 0, totalDOP: 0, totalUSD: 0, pendientes: 0 };

      // Obtener desglose por mesas
      let byMesa = [];
      try {
        const today = new Date().toISOString().split('T')[0];
        const mesaRows = db.db.prepare(`
          SELECT
            mesa_nombre,
            COUNT(*) as cantidad,
            SUM(CASE WHEN currency = 'DOP' THEN amount ELSE 0 END) as total_dop,
            SUM(CASE WHEN currency = 'USD' THEN amount ELSE 0 END) as total_usd,
            SUM(CASE WHEN estado = 'activo' THEN 1 ELSE 0 END) as pendientes
          FROM tickets
          WHERE DATE(fecha_emision) = ?
          GROUP BY mesa_nombre
          ORDER BY cantidad DESC
          LIMIT 10
        `).all(today);
        byMesa = mesaRows;
      } catch (err) {
        console.warn('Error obteniendo stats por mesa:', err.message);
      }

      // Obtener top operadores
      let byOperador = [];
      try {
        const today = new Date().toISOString().split('T')[0];
        const opRows = db.db.prepare(`
          SELECT
            created_by_username as operador,
            COUNT(*) as cantidad,
            SUM(amount) as total
          FROM tickets
          WHERE DATE(fecha_emision) = ? AND created_by_username IS NOT NULL
          GROUP BY created_by_username
          ORDER BY total DESC
          LIMIT 5
        `).all(today);
        byOperador = opRows;
      } catch (err) {
        console.warn('Error obteniendo stats por operador:', err.message);
      }

      // Contar canjeados
      let canjeados = 0;
      try {
        const today = new Date().toISOString().split('T')[0];
        const result = db.db.prepare(`
          SELECT COUNT(*) as count
          FROM tickets
          WHERE DATE(fecha_emision) = ? AND estado = 'usado'
        `).get(today);
        canjeados = result?.count || 0;
      } catch (err) {
        console.warn('Error contando canjeados:', err.message);
      }

      // Devolver alias para compatibilidad con distintas vistas (panel/caja)
      return {
        ...s,
        ticketsToday: s.ticketsHoy ?? 0,
        pending: s.pendientes ?? 0,
        redeemed: canjeados,
        byMesa,
        byOperador
      };
    } catch (error) {
      console.error('Error get-stats-today:', error?.message);
      return {
        ticketsHoy: 0, totalDOP: 0, totalUSD: 0, pendientes: 0,
        ticketsToday: 0, pending: 0, redeemed: 0, byMesa: [], byOperador: []
      };
    }
  });

  // ============================================
  // HANDLER: get-stats-by-mesa
  // ============================================
  safeIpcHandle('get-stats-by-mesa', async () => {
    try {
      if (!db) throw new Error('DB no disponible');

      // Query para obtener estadísticas por mesa del día de hoy
      const query = `
        SELECT
          mesa_id,
          mesa_nombre,
          COUNT(*) as emitidos,
          SUM(CASE WHEN estado = 'usado' THEN 1 ELSE 0 END) as cobrados,
          SUM(CASE WHEN estado IN ('activo', 'emitido') THEN 1 ELSE 0 END) as pendientes,
          SUM(CASE WHEN estado = 'usado' THEN amount ELSE 0 END) as total_amount,
          currency
        FROM tickets
        WHERE DATE(fecha_emision) = DATE('now', 'localtime')
        GROUP BY mesa_id, currency
        ORDER BY mesa_id, currency
      `;

      const rows = db.db.prepare(query).all();
      console.log('📊 Resultados por mesa:', rows);

      // Agrupar por mesa (combinando DOP y USD)
      const mesasMap = new Map();

      rows.forEach(row => {
        const mesaId = row.mesa_id || 'DESCONOCIDA';

        if (!mesasMap.has(mesaId)) {
          mesasMap.set(mesaId, {
            mesa_id: mesaId,
            nombre: row.mesa_nombre || mesaId,
            emitidos: 0,
            cobrados: 0,
            pendientes: 0,
            totalDOP: 0,
            totalUSD: 0
          });
        }

        const mesa = mesasMap.get(mesaId);
        mesa.emitidos += row.emitidos || 0;
        mesa.cobrados += row.cobrados || 0;
        mesa.pendientes += row.pendientes || 0;

        if (row.currency === 'DOP') {
          mesa.totalDOP += row.total_amount || 0;
        } else if (row.currency === 'USD') {
          mesa.totalUSD += row.total_amount || 0;
        }
      });

      // Convertir Map a Array y formatear totales
      const mesas = Array.from(mesasMap.values()).map(mesa => ({
        ...mesa,
        total: `DOP ${mesa.totalDOP.toFixed(2)} / USD ${mesa.totalUSD.toFixed(2)}`
      }));

      console.log('✅ Estadísticas por mesa procesadas:', mesas);

      return {
        success: true,
        mesas: mesas
      };
    } catch (error) {
      console.error('Error get-stats-by-mesa:', error?.message);
      return { success: false, mesas: [], error: error.message };
    }
  });

  // ============================================
  // HANDLER: Obtener últimos tickets emitidos (para panel de Mesa)
  // ============================================
  safeIpcHandle('get-recent-tickets', async (_event, limit = 20) => {
    try {
      if (!db) throw new Error('DB no disponible');

      // Query para obtener últimos tickets emitidos del día
      const query = `
        SELECT
          code,
          mesa_nombre,
          mesa_id,
          created_by_username as operador,
          amount,
          currency,
          estado,
          datetime(fecha_emision) as fecha_emision,
          CASE
            WHEN estado = 'usado' THEN 'Cobrado'
            WHEN estado = 'activo' THEN 'Pendiente'
            WHEN estado = 'cancelado' THEN 'Cancelado'
            WHEN estado = 'expirado' THEN 'Expirado'
            ELSE estado
          END as estado_texto
        FROM tickets
        WHERE DATE(fecha_emision) = DATE('now', 'localtime')
        ORDER BY fecha_emision DESC
        LIMIT ?
      `;

      const tickets = db.db.prepare(query).all(limit);

      console.log(`📋 Últimos ${tickets.length} tickets del día obtenidos`);

      return {
        success: true,
        tickets: tickets.map(t => ({
          code: t.code,
          mesa: t.mesa_nombre || `Mesa ${t.mesa_id || '?'}`,
          operador: t.operador || 'Desconocido',
          amount: t.amount,
          currency: t.currency,
          estado: t.estado_texto,
          fecha: t.fecha_emision,
          // Formato legible para UI
          descripcion: `${t.mesa_nombre || 'Mesa ' + (t.mesa_id || '?')} - ${t.operador || 'N/A'} - ${t.currency} ${Number(t.amount).toFixed(2)}`
        }))
      };
    } catch (error) {
      console.error('Error get-recent-tickets:', error?.message);
      return { success: false, tickets: [], error: error.message };
    }
  });

  // ============================================
  // HANDLERS BÁSICOS: generación/validación/canje/estadísticas
  // (Compatibilidad inmediata con el Panel)
  // ============================================
  safeIpcHandle('generate-ticket', async (_event, ticketData = {}) => {
    let ticketCode = null;
    try {
      console.log('📥 [generate-ticket] Datos recibidos:', ticketData);

      // Validar datos
      const amount = Number(ticketData.valor ?? ticketData.amount);
      const currency = String(ticketData.moneda ?? ticketData.currency ?? 'DOP').toUpperCase();
      const mesa = ticketData.mesa_id ?? ticketData.mesa ?? (ticketData.mesa_nombre || 'M01');

      console.log('🔍 [DEBUG] amount:', amount, 'currency:', currency, 'mesa:', mesa);

      if (!amount || amount <= 0) throw new Error('El valor debe ser mayor que cero');
      if (!['DOP','USD'].includes(currency)) throw new Error('Moneda inválida');

      // ✅ VALIDACIÓN: Límites configurados por moneda
      const configPath = path.join(app.getPath('userData'), 'currency-config.json');
      if (fs.existsSync(configPath)) {
        try {
          const currencyConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          const limits = currencyConfig[currency];

          if (limits) {
            if (!limits.enabled) {
              throw new Error(`La moneda ${currency} no está habilitada`);
            }

            if (amount < limits.min) {
              throw new Error(`Monto mínimo para ${currency}: ${limits.min}`);
            }

            if (amount > limits.max) {
              throw new Error(`Monto máximo para ${currency}: ${limits.max}`);
            }

            console.log(`✅ Validación de límites OK: ${amount} ${currency} (${limits.min}-${limits.max})`);
          }
        } catch (validationError) {
          // Si el error es de validación, propagarlo
          if (validationError.message.includes('mínimo') ||
              validationError.message.includes('máximo') ||
              validationError.message.includes('habilitada')) {
            throw validationError;
          }
          // Si es error de lectura del archivo, solo log warning
          console.warn('⚠️ No se pudo validar límites de moneda:', validationError.message);
        }
      }

      // Generar código único del ticket usando el generador de la DB (formato corto: PREV-001234)
      if (db && typeof db.generateTicketCode === 'function') {
        try {
          ticketCode = db.generateTicketCode();
          console.log('🎫 Código generado desde DB:', ticketCode);
        } catch (error) {
          console.error('❌ Error en generateTicketCode:', error.message);
          throw new Error('No se pudo generar código de ticket');
        }
      } else {
        console.error('❌ CRÍTICO: db.generateTicketCode no disponible. db:', !!db, 'función:', typeof db?.generateTicketCode);
        throw new Error('Sistema de tickets no inicializado correctamente');
      }
      console.log('🔍 [DEBUG] typeof ticketCode:', typeof ticketCode, 'length:', ticketCode.length);

      // Obtener datos de usuario y estación
      const userId = currentSession?.user?.id || process.env.DEFAULT_USER_ID || '85397c30-3856-4d82-a4bb-06791b8cacd0';
      // Convertir mesa_id a número si es posible, sino null
      const stationId = (() => {
        const id = ticketData.mesa_id || mesa;
        if (typeof id === 'number') return id;
        const parsed = parseInt(String(id).replace(/\D/g, ''));
        return isNaN(parsed) ? null : parsed;
      })();
      const userName = ticketData.operador_nombre || currentSession?.user?.username || currentSession?.user?.email || null;

      // Generar QR data
      const secret = process.env.QR_SECRET || 'CASINO_SECRET_2024';
      const qrHash = require('crypto').createHash('sha256').update(`${ticketCode}|${amount}|${currency}|${Date.now()}|${secret}`).digest('hex');
      const qrData = JSON.stringify({
        code: ticketCode,
        amount: amount,
        currency: currency,
        mesa: mesa,
        timestamp: Date.now(),
        hash: qrHash.slice(0, 8)
      });

      let savedInSupabase = false;
      let supabaseError = null;

      // ============================================
      // PASO 1: GUARDAR EN SUPABASE PRIMERO (fuente de verdad)
      // ============================================
      if (supabaseManager && supabaseManager.isAvailable()) {
        try {
          console.log('☁️  [1/2] Guardando en Supabase (fuente de verdad)...');

          // ⚠️ FIX: Agregar timeout de 5 segundos para evitar cuelgues
          const supabasePromise = supabaseManager.client
            .from('vouchers')
            .insert({
              voucher_code: ticketCode,
              qr_data: qrData,
              qr_hash: qrHash,
              amount: amount,
              currency: currency,
              status: 'active',
              issued_by_user_id: userId,
              issued_at_station_id: stationId,
              mesa_nombre: mesa,
              operador_nombre: userName,
              customer_name: userName
            })
            .select()
            .single();

          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout guardando en Supabase (5s)')), 5000)
          );

          const { data, error } = await Promise.race([supabasePromise, timeoutPromise]);

          if (!error && data) {
            savedInSupabase = true;
            console.log('✅ Ticket guardado en Supabase:', ticketCode);
          } else {
            supabaseError = error?.message || 'Error desconocido en Supabase';
            console.warn('⚠️  Error guardando en Supabase:', supabaseError);
          }
        } catch (err) {
          supabaseError = err.message;
          console.warn('⚠️  Excepción guardando en Supabase:', supabaseError);
        }
      } else {
        supabaseError = 'Supabase no disponible';
        console.warn('⚠️  Supabase no disponible, modo offline');
      }

      // ============================================
      // PASO 2: GUARDAR EN SQLITE (caché local - SIEMPRE)
      // ============================================
      if (!db) {
        // Si no hay SQLite y tampoco se guardó en Supabase, es un error crítico
        if (!savedInSupabase) {
          throw new Error('No se pudo guardar: SQLite no disponible y Supabase falló');
        }
        console.warn('⚠️  SQLite no disponible, pero ticket guardado en Supabase');
      } else {
        try {
          console.log('💾 [2/2] Guardando en SQLite (caché local)...');

          // Insertar directamente con el código generado
          // NOTA: SQLite usa 'activo' (no 'emitido') según constraint
          db.db.prepare(`
            INSERT INTO tickets (code, amount, currency, mesa, estado, sincronizado, mesa_id, created_by_user_id, created_by_username, mesa_nombre, hash_seguridad, qr_data)
            VALUES (?, ?, ?, ?, 'activo', ?, ?, ?, ?, ?, ?, ?)
          `).run(
            ticketCode,
            amount,
            currency,
            mesa,
            savedInSupabase ? 1 : 0,  // Marcar si está sincronizado
            stationId,
            userId,
            userName,
            ticketData.mesa_nombre || null,
            qrHash || '',  // hash_seguridad (requerido)
            qrData || ''   // qr_data (requerido)
          );

          console.log('✅ Ticket guardado en SQLite:', ticketCode, 'sincronizado:', savedInSupabase ? 'SI' : 'NO');
        } catch (sqlError) {
          console.error('❌ Error guardando en SQLite:', sqlError.message);

          // Si Supabase también falló, es un error crítico
          if (!savedInSupabase) {
            throw new Error('No se pudo guardar en ninguna base de datos');
          }
          // Si Supabase funcionó, solo advertir
          console.warn('⚠️  Error en SQLite pero ticket guardado en Supabase');
        }
      }

      // ============================================
      // PASO 3: RETORNAR RESULTADO
      // ============================================
      const result = {
        success: true,
        ticketCode: ticketCode,
        ticket_number: ticketCode,
        ticket: {
          code: ticketCode,
          amount: amount,
          currency: currency,
          mesa: ticketData.mesa_nombre || mesa,
          operador: userName
        },
        syncedToCloud: savedInSupabase,
        synced: savedInSupabase,
        warning: supabaseError && !savedInSupabase ? `Guardado en modo offline: ${supabaseError}` : null
      };

      console.log('✅ [generate-ticket] Completado:', result);

      // Guardar código en variable global para vista previa
      global.__lastTicketNumber = ticketCode;

      // Registrar evento en audit_log (NO BLOQUEAR si falla)
      registrarAuditLog(
        'voucher_issued',
        userId,
        stationId,
        null,  // voucher_id (UUID de Supabase si existe)
        {
          voucher_code: ticketCode,
          amount: amount,
          currency: currency,
          mesa: ticketData.mesa_nombre || mesa,
          operador: userName,
          synced: savedInSupabase
        }
      ).catch(auditErr => {
        console.warn('⚠️  Error en audit log (no crítico):', auditErr.message);
      });

      // ============================================
      // PASO 4: GENERAR PDF E IMPRIMIR
      // ============================================
      try {
        console.log('📄 Generando PDF del ticket...');
        const pdfBuffer = await TicketService.generateTicket({
          ticket_number: ticketCode,
          qr_code: qrData,  // El JSON con todos los datos
          valor: amount,
          moneda: currency,
          fecha_emision: new Date().toISOString(),
          mesa_id: mesa,
          usuario_emision: userName,
          operador_nombre: userName
          // pageHeightMm: 156 ← Ya no es necesario, TicketService lo aplica automáticamente
        });

        console.log('✅ PDF generado, tamaño:', pdfBuffer.length, 'bytes');

        // Intentar imprimir si hay impresora disponible
        if (printer && typeof printer.printTicket === 'function') {
          try {
            console.log('🖨️  Enviando a impresora...');
            await printer.printTicket(pdfBuffer);
            console.log('✅ Ticket impreso correctamente');
          } catch (printError) {
            console.warn('⚠️  Error imprimiendo ticket:', printError.message);
            // No fallar la operación si solo falla la impresión
          }
        } else {
          console.log('ℹ️  Impresora no disponible, ticket guardado en BD solamente');
        }
      } catch (pdfError) {
        console.error('❌ Error generando PDF:', pdfError.message);
        // No fallar la operación completa si solo falla el PDF
        // El ticket ya está guardado en las bases de datos
      }

      return result;

    } catch (e) {
      console.error('❌ [generate-ticket] Error crítico:', e?.message);
      console.error('❌ [generate-ticket] Stack:', e?.stack);

      // Si se generó el código antes del error, retornarlo de todos modos
      if (ticketCode) {
        console.warn('⚠️  [generate-ticket] Retornando código a pesar del error:', ticketCode);
        return {
          success: false,
          error: e?.message || String(e),
          ticketCode: ticketCode,  // Incluir el código generado
          ticket_number: ticketCode,
          ticket: {
            code: ticketCode
          }
        };
      }

      return { success: false, error: e?.message || String(e) };
    }
  });

  safeIpcHandle('validate-voucher', async (_event, voucherCode) => {
    try {
      console.log('📥 [validate-voucher] Validando código:', voucherCode);

      const code = String(voucherCode || '').toUpperCase().trim();
      if (!code) throw new Error('Código requerido');

      let rowData = null;
      let mesaNombre = 'N/A';
      let operadorNombre = null;
      let source = 'unknown';

      // ============================================
      // PASO 1: BUSCAR EN SUPABASE PRIMERO (fuente de verdad)
      // ============================================
      if (supabaseManager && supabaseManager.isAvailable()) {
        try {
          console.log('☁️  [1/2] Buscando voucher en Supabase (fuente de verdad)...');
          console.log('🔍 [DEBUG] Código a buscar:', code);
          const supabaseResult = await supabaseManager.getVoucher(code);
          console.log('🔍 [DEBUG] Resultado Supabase:', supabaseResult);

          if (supabaseResult.success && supabaseResult.data) {
            const supa = supabaseResult.data;
            source = 'cloud';

            // Mapear estructura de Supabase a formato esperado
            rowData = {
              code: supa.voucher_code,
              amount: supa.amount,
              currency: supa.currency,
              estado: supa.status === 'active' ? 'emitido' : (supa.status === 'redeemed' ? 'usado' : supa.status),
              created_at: supa.issued_at,
              fecha_emision: supa.issued_at,
              mesa_nombre: supa.issued_at_station_id ? `MESA-${supa.issued_at_station_id}` : 'N/A',
              created_by_username: supa.customer_name || 'N/A'
            };

            mesaNombre = rowData.mesa_nombre;
            operadorNombre = rowData.created_by_username;

            // Guardar en SQLite local como caché
            try {
              const existsLocal = db.getTicket(code);
              if (!existsLocal) {
                db.createTicket({
                  code: rowData.code,
                  amount: rowData.amount,
                  currency: rowData.currency,
                  mesa: mesaNombre,
                  usuario_emision: operadorNombre
                });
                db.db.prepare('UPDATE tickets SET estado = ?, sincronizado = 1 WHERE code = ?')
                  .run(rowData.estado, code);
                console.log('💾 Voucher guardado en caché local desde Supabase');
              }
            } catch (e) {
              if (VERBOSE) console.warn('No se pudo guardar en caché local:', e?.message);
            }

            console.log('✅ Voucher encontrado en Supabase:', code);
          } else {
            console.log('⚠️  Voucher NO encontrado en Supabase');
          }
        } catch (supaError) {
          console.warn('⚠️  Error buscando en Supabase, intentando SQLite local:', supaError.message);
        }
      } else {
        console.warn('⚠️  Supabase no disponible, buscando en SQLite');
      }

      // ============================================
      // PASO 2: FALLBACK - Buscar en SQLite (caché local)
      // ============================================
      if (!rowData) {
        console.log('💾 [2/2] Buscando voucher en SQLite (caché local)...');

        if (!db) {
          console.error('❌ SQLite no disponible y voucher no encontrado en Supabase');
          return { success: false, valid: false, error: 'Voucher no encontrado en ninguna base de datos' };
        }
        try {
          const info = db.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='tickets'").get();
          if (info) {
            const row = db.db.prepare(`SELECT * FROM tickets WHERE code = ?`).get(code);
            if (row) {
              mesaNombre = row.mesa_nombre || row.mesa || (row.mesa_id ? String(row.mesa_id) : 'N/A');
              operadorNombre = row.created_by_username
                                || row.operador_nombre
                                || row.usuario_emision
                                || row.created_by_email
                                || row.operador_email
                                || null;
              rowData = row;
              source = 'local';
              console.log('✅ Voucher encontrado en SQLite local:', code);
            }
          }
        } catch (e) {
          console.warn('Error buscando en SQLite local:', e?.message);
        }
      }

      // ============================================
      // PASO 3: VALIDAR RESULTADO
      // ============================================
      if (!rowData) {
        console.error('❌ [validate-voucher] Voucher no encontrado en ninguna base de datos');
        return { success: false, valid: false, error: 'Voucher no encontrado en ninguna base de datos' };
      }

      // Validaciones básicas de estado
      const estado = String(rowData.estado || 'emitido').toLowerCase();
      if (estado === 'usado') return { success: false, valid: false, estado: 'usado', error: 'Voucher canjeado' };
      if (estado === 'cancelado') return { success: false, valid: false, estado: 'cancelado', error: 'Voucher cancelado' };
      if (estado === 'expirado') return { success: false, valid: false, estado: 'expirado', error: 'Voucher expirado' };

      const result = {
        success: true,
        valid: true,
        ticket: {
          code: rowData.code,
          amount: Number(rowData.amount || 0),
          currency: rowData.currency || 'DOP',
          estado: rowData.estado || 'emitido',
          created_at: rowData.created_at || rowData.fecha_emision || null,
          mesa: mesaNombre || 'N/A',
          operador: operadorNombre || 'N/A'
        },
        source
      };

      console.log('✅ [validate-voucher] Ticket validado correctamente:', {
        code: rowData.code,
        amount: rowData.amount,
        currency: rowData.currency,
        mesa: mesaNombre,
        operador: operadorNombre,
        source
      });

      return result;

    } catch (e) {
      console.error('❌ [validate-voucher] Error crítico:', e?.message);
      console.error('❌ [validate-voucher] Stack:', e?.stack);
      return { success: false, error: e?.message || String(e) };
    }
  });

  safeIpcHandle('redeem-voucher', async (_event, code, cajeroId = 'CAJA-01') => {
    try {
      console.log('📥 [redeem-voucher] Canjeando código:', code);

      const normalized = String(code || '').toUpperCase().trim();
      if (!normalized) throw new Error('Código requerido');

      let updatedInSupabase = false;
      let supabaseError = null;
      let voucherAmount = null;
      let voucherCurrency = null;

      // Obtener ID del usuario actual
      const userId = currentSession?.user?.id || cajeroId;

      // ============================================
      // PASO 1: ACTUALIZAR EN SUPABASE PRIMERO (fuente de verdad)
      // ============================================
      if (supabaseManager && supabaseManager.isAvailable()) {
        try {
          console.log('☁️  [1/2] Actualizando en Supabase (fuente de verdad)...');

          const { data, error } = await supabaseManager.client
            .from('vouchers')
            .update({
              status: 'redeemed',
              redeemed_at: new Date().toISOString(),
              redeemed_by_user_id: userId
            })
            .eq('voucher_code', normalized)
            .select()
            .single();

          if (!error && data) {
            updatedInSupabase = true;
            voucherAmount = data.amount;
            voucherCurrency = data.currency;
            console.log('✅ Voucher canjeado en Supabase:', normalized);
          } else {
            supabaseError = error?.message || 'Error desconocido en Supabase';
            console.warn('⚠️  Error canjeando en Supabase:', supabaseError);
          }
        } catch (err) {
          supabaseError = err.message;
          console.warn('⚠️  Excepción canjeando en Supabase:', supabaseError);
        }
      } else {
        supabaseError = 'Supabase no disponible';
        console.warn('⚠️  Supabase no disponible, modo offline');
      }

      // ============================================
      // PASO 2: ACTUALIZAR EN SQLITE (caché local - SIEMPRE)
      // ============================================
      if (!db) {
        // Si no hay SQLite y tampoco se actualizó en Supabase, es un error
        if (!updatedInSupabase) {
          throw new Error('No se pudo canjear: SQLite no disponible y Supabase falló');
        }
        console.warn('⚠️  SQLite no disponible, pero voucher canjeado en Supabase');
      } else {
        try {
          console.log('💾 [2/2] Actualizando en SQLite (caché local)...');

          // Primero obtener los detalles del ticket si no los tenemos
          if (!voucherAmount || !voucherCurrency) {
            const ticketInfo = db.db.prepare(`
              SELECT amount, currency FROM tickets WHERE code = ?
            `).get(normalized);
            if (ticketInfo) {
              voucherAmount = ticketInfo.amount;
              voucherCurrency = ticketInfo.currency;
            }
          }

          const result = db.db.prepare(`
            UPDATE tickets
            SET estado = 'usado',
                fecha_cobro = ?,
                cajero_id = ?,
                sincronizado = ?
            WHERE code = ?
          `).run(
            new Date().toISOString(),  // fecha_cobro
            cajeroId,                   // cajero_id
            updatedInSupabase ? 1 : 0,  // sincronizado
            normalized                  // code (WHERE)
          );

          if (result.changes === 0) {
            // Si no se encontró el ticket en SQLite pero se canjeó en Supabase, advertir
            if (updatedInSupabase) {
              console.warn('⚠️  Ticket no encontrado en SQLite pero canjeado en Supabase');
            } else {
              throw new Error('Voucher no encontrado');
            }
          } else {
            console.log('✅ Voucher canjeado en SQLite:', normalized, 'sincronizado:', updatedInSupabase ? 'SI' : 'NO');
          }
        } catch (sqlError) {
          console.error('❌ Error canjeando en SQLite:', sqlError.message);

          // Si Supabase también falló, es un error crítico
          if (!updatedInSupabase) {
            return { success: false, error: sqlError.message };
          }
          // Si Supabase funcionó, solo advertir
          console.warn('⚠️  Error en SQLite pero voucher canjeado en Supabase');
        }
      }

      // ============================================
      // PASO 3: REGISTRAR EN AUDIT LOG
      // ============================================
      await registrarAuditLog(
        'voucher_redeemed',
        userId,
        null,  // station_id (no aplica para canje)
        null,  // voucher_id (no tenemos el ID, solo el código)
        {
          voucher_code: normalized,
          amount: voucherAmount,
          currency: voucherCurrency,
          redeemed_by: cajeroId,
          synced: updatedInSupabase
        }
      );

      // ============================================
      // PASO 4: RETORNAR RESULTADO
      // ============================================
      const result = {
        success: true,
        message: 'Voucher canjeado correctamente',
        syncedToCloud: updatedInSupabase,
        warning: supabaseError && !updatedInSupabase ? `Canjeado en modo offline: ${supabaseError}` : null
      };

      console.log('✅ [redeem-voucher] Completado:', result);
      return result;

    } catch (e) {
      console.error('❌ [redeem-voucher] Error crítico:', e?.message);
      return { success: false, error: e?.message || String(e) };
    }
  });

  safeIpcHandle('get-statistics', async () => {
    try {
      if (!db?.db) throw new Error('DB no disponible');
      // Filtrar por fecha de HOY usando fecha_emision
      const totalTickets = db.db.prepare(`
        SELECT COUNT(*) AS total
        FROM tickets
        WHERE DATE(fecha_emision) = DATE('now','localtime')
      `).get().total || 0;

      const totalDOP = db.db.prepare(`
        SELECT COALESCE(SUM(amount),0) AS total
        FROM tickets
        WHERE currency = 'DOP' AND DATE(fecha_emision) = DATE('now','localtime')
      `).get().total || 0;

      const totalUSD = db.db.prepare(`
        SELECT COALESCE(SUM(amount),0) AS total
        FROM tickets
        WHERE currency = 'USD' AND DATE(fecha_emision) = DATE('now','localtime')
      `).get().total || 0;

      const pendientes = db.db.prepare(`
        SELECT COUNT(*) AS total
        FROM tickets
        WHERE estado != 'usado' AND DATE(fecha_emision) = DATE('now','localtime')
      `).get().total || 0;

      const stats = { ticketsHoy: totalTickets, totalDOP, totalUSD, pendientes };
      return { success: true, stats };
    } catch (e) {
      console.error('[get-statistics] Error:', e?.message);
      return { success: false, error: e?.message || String(e) };
    }
  });

  // Handler temporal: limpiar la base de datos (solo tickets)
  safeIpcHandle('reset-database', async () => {
    try {
      if (!db?.db) throw new Error('DB no disponible');
      db.db.prepare('DELETE FROM tickets').run();
      try { db.db.prepare('DELETE FROM sqlite_sequence WHERE name = "tickets"').run(); } catch {}
      if (VERBOSE) console.log('✅ Base de datos limpiada (tabla tickets)');
      return { success: true, message: 'BD limpiada correctamente' };
    } catch (error) {
      console.error('❌ Error limpiando BD:', error?.message);
      return { success: false, error: error?.message };
    }
  });

  // ============================================
  // HANDLER: sync-pending-vouchers (Sincronización manual)
  // ============================================
  safeIpcHandle('sync-pending-vouchers', async () => {
    try {
      if (!db?.db) throw new Error('DB no disponible');
      if (!supabaseManager || !supabaseManager.isAvailable()) {
        return { success: false, error: 'Supabase no disponible' };
      }

      console.log('🔄 Iniciando sincronización de vouchers pendientes...');

      // Obtener tickets no sincronizados
      const pendingTickets = db.db.prepare(`
        SELECT * FROM tickets
        WHERE sincronizado = 0 OR sincronizado IS NULL
        ORDER BY fecha_emision DESC
      `).all();

      if (pendingTickets.length === 0) {
        console.log('✅ No hay vouchers pendientes de sincronizar');
        return { success: true, synced: 0, failed: 0, message: 'No hay vouchers pendientes' };
      }

      console.log(`📊 Encontrados ${pendingTickets.length} vouchers pendientes`);

      // Sincronizar con Supabase
      const result = await supabaseManager.syncPendingVouchers(pendingTickets);

      // Marcar como sincronizados los exitosos
      if (result.synced > 0) {
        for (const ticket of pendingTickets) {
          try {
            db.db.prepare('UPDATE tickets SET sincronizado = 1 WHERE code = ?').run(ticket.code);
          } catch (e) {
            console.warn(`⚠️  No se pudo marcar como sincronizado: ${ticket.code}`);
          }
        }
      }

      console.log(`✅ Sincronización completada: ${result.synced} exitosos, ${result.failed} fallidos`);

      return {
        success: true,
        synced: result.synced,
        failed: result.failed,
        message: `Sincronizados ${result.synced} de ${pendingTickets.length} vouchers`
      };
    } catch (error) {
      console.error('❌ Error sincronizando vouchers:', error?.message);
      return { success: false, error: error?.message };
    }
  });

  // ============================================
  // HANDLERS: Gestión de Operadores
  // ============================================

  // Obtener operadores activos (para dropdown en Mesa)
  safeIpcHandle('get-operadores-activos', async (event) => {
    try {
      console.log('📋 [Operadores] Obteniendo operadores activos...');

      if (!supabaseManager || !supabaseManager.isAvailable()) {
        console.warn('⚠️ Supabase no disponible - retornando lista vacía');
        return { success: true, operadores: [] };
      }

      const { data, error } = await supabaseManager.client
        .from('operadores')
        .select('*')
        .eq('activo', true)
        .order('nombre');

      if (error) {
        console.error('❌ Error obteniendo operadores:', error);
        return { success: false, error: error.message };
      }

      console.log(`✅ Operadores activos obtenidos: ${data?.length || 0}`);
      return { success: true, operadores: data || [] };
    } catch (error) {
      console.error('❌ Error en get-operadores-activos:', error?.message);
      return { success: false, error: error?.message };
    }
  });

  // Obtener todos los operadores (activos e inactivos) - Solo Admin
  safeIpcHandle('get-all-operadores', async (event) => {
    try {
      console.log('📋 [Operadores] Obteniendo todos los operadores...');

      // TODO: Verificar que el usuario actual es admin
      // if (currentSession?.user?.role !== 'ADMIN') {
      //   return { success: false, error: 'No autorizado' };
      // }

      if (!supabaseManager || !supabaseManager.isAvailable()) {
        console.warn('⚠️ Supabase no disponible');
        return { success: false, error: 'Supabase no disponible' };
      }

      const { data, error } = await supabaseManager.client
        .from('operadores')
        .select('*')
        .order('activo', { ascending: false })
        .order('nombre');

      if (error) {
        console.error('❌ Error obteniendo todos los operadores:', error);
        return { success: false, error: error.message };
      }

      console.log(`✅ Total operadores obtenidos: ${data?.length || 0}`);
      return { success: true, operadores: data || [] };
    } catch (error) {
      console.error('❌ Error en get-all-operadores:', error?.message);
      return { success: false, error: error?.message };
    }
  });

  // Crear nuevo operador - Solo Admin
  safeIpcHandle('create-operador', async (event, operadorData) => {
    try {
      console.log('➕ [Operadores] Creando operador:', operadorData);

      // TODO: Verificar rol de admin
      // if (currentSession?.user?.role !== 'ADMIN') {
      //   return { success: false, error: 'No autorizado - Solo admin puede crear operadores' };
      // }

      if (!operadorData?.nombre) {
        return { success: false, error: 'Nombre del operador es requerido' };
      }

      if (!supabaseManager || !supabaseManager.isAvailable()) {
        return { success: false, error: 'Supabase no disponible' };
      }

      const { data, error } = await supabaseManager.client
        .from('operadores')
        .insert({
          nombre: operadorData.nombre,
          activo: true,
          mesas_asignadas: operadorData.mesas || []
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Error creando operador:', error);
        return { success: false, error: error.message };
      }

      // Registrar en audit log
      await registrarAuditLog(
        'operator_created',
        currentSession?.user?.id || null,
        null,  // station_id
        null,  // voucher_id
        {
          operator_id: data.id,
          nombre: operadorData.nombre,
          mesas: operadorData.mesas || []
        }
      );

      console.log('✅ Operador creado exitosamente:', data);
      return { success: true, operador: data };
    } catch (error) {
      console.error('❌ Error en create-operador:', error?.message);
      return { success: false, error: error?.message };
    }
  });

  // Actualizar operador - Solo Admin
  safeIpcHandle('update-operador', async (event, operadorId, updates) => {
    try {
      console.log('✏️ [Operadores] Actualizando operador:', operadorId, updates);

      // TODO: Verificar rol de admin
      // if (currentSession?.user?.role !== 'ADMIN') {
      //   return { success: false, error: 'No autorizado' };
      // }

      if (!supabaseManager || !supabaseManager.isAvailable()) {
        return { success: false, error: 'Supabase no disponible' };
      }

      const { data, error } = await supabaseManager.client
        .from('operadores')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', operadorId)
        .select()
        .single();

      if (error) {
        console.error('❌ Error actualizando operador:', error);
        return { success: false, error: error.message };
      }

      // Registrar en audit log
      await registrarAuditLog(
        'operator_updated',
        currentSession?.user?.id || null,
        null,  // station_id
        null,  // voucher_id
        {
          operator_id: operadorId,
          changes: updates
        }
      );

      console.log('✅ Operador actualizado exitosamente:', data);
      return { success: true, operador: data };
    } catch (error) {
      console.error('❌ Error en update-operador:', error?.message);
      return { success: false, error: error?.message };
    }
  });

  // Activar/Desactivar operador - Solo Admin
  safeIpcHandle('toggle-operador', async (event, operadorId, activo) => {
    try {
      console.log(`🔄 [Operadores] ${activo ? 'Activando' : 'Desactivando'} operador:`, operadorId);

      // TODO: Verificar rol de admin
      // if (currentSession?.user?.role !== 'ADMIN') {
      //   return { success: false, error: 'No autorizado' };
      // }

      if (!supabaseManager || !supabaseManager.isAvailable()) {
        return { success: false, error: 'Supabase no disponible' };
      }

      const { data, error } = await supabaseManager.client
        .from('operadores')
        .update({
          activo: activo,
          updated_at: new Date().toISOString()
        })
        .eq('id', operadorId)
        .select()
        .single();

      if (error) {
        console.error('❌ Error cambiando estado de operador:', error);
        return { success: false, error: error.message };
      }

      // Registrar en audit log
      await registrarAuditLog(
        'operator_updated',
        currentSession?.user?.id || null,
        null,  // station_id
        null,  // voucher_id
        {
          operator_id: operadorId,
          action: activo ? 'activated' : 'deactivated',
          activo: activo
        }
      );

      console.log(`✅ Operador ${activo ? 'activado' : 'desactivado'} exitosamente:`, data);
      return { success: true, operador: data };
    } catch (error) {
      console.error('❌ Error en toggle-operador:', error?.message);
      return { success: false, error: error?.message };
    }
  });

  // Eliminar operador - Solo Admin
  safeIpcHandle('delete-operador', async (event, operadorId) => {
    try {
      console.log('🗑️ [Operadores] Eliminando operador:', operadorId);

      // TODO: Verificar rol de admin
      // if (currentSession?.user?.role !== 'ADMIN') {
      //   return { success: false, error: 'No autorizado' };
      // }

      if (!supabaseManager || !supabaseManager.isAvailable()) {
        return { success: false, error: 'Supabase no disponible' };
      }

      const { data, error } = await supabaseManager.client
        .from('operadores')
        .delete()
        .eq('id', operadorId)
        .select()
        .single();

      if (error) {
        console.error('❌ Error eliminando operador:', error);
        return { success: false, error: error.message };
      }

      // Registrar en audit log
      await registrarAuditLog(
        'operator_updated',
        currentSession?.user?.id || null,
        null,  // station_id
        null,  // voucher_id
        {
          operator_id: operadorId,
          action: 'deleted'
        }
      );

      console.log('✅ Operador eliminado exitosamente:', data);
      return { success: true, operador: data };
    } catch (error) {
      console.error('❌ Error en delete-operador:', error?.message);
      return { success: false, error: error?.message };
    }
  });

  // ============================================
  // HANDLERS: Gestión de Usuarios
  // ============================================

  // Obtener todos los usuarios del sistema - Solo Admin
  safeIpcHandle('get-all-users', async (event) => {
    try {
      console.log('👨‍💼 [Usuarios] Obteniendo todos los usuarios...');

      // TODO: Verificar que el usuario actual es admin
      // if (currentSession?.user?.role !== 'ADMIN') {
      //   return { success: false, error: 'No autorizado' };
      // }

      // ✅ SINCRONIZACIÓN DUAL: Primero intentar Supabase, luego fallback a SQLite
      if (supabaseManager && supabaseManager.isAvailable()) {
        try {
          const { data, error } = await supabaseManager.client
            .from('users')
            .select('id, email, full_name, role, pin_code, is_active, station_id, created_at')
            .order('created_at', { ascending: false });

          if (!error && data) {
            console.log(`✅ Total usuarios obtenidos de Supabase: ${data.length}`);

            // ✅ SINCRONIZAR a SQLite en segundo plano
            setImmediate(() => {
              try {
                if (!db || !db.db) return;

                const stmt = db.db.prepare(`
                  INSERT OR REPLACE INTO users (
                    id, email, full_name, role, pin_code, is_active,
                    station_id, created_at, updated_at
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
                `);

                for (const user of data) {
                  stmt.run(
                    user.id,
                    user.email,
                    user.full_name,
                    user.role,
                    user.pin_code || null,
                    user.is_active ? 1 : 0,
                    user.station_id || null,
                    user.created_at || new Date().toISOString()
                  );
                }

                console.log(`✅ ${data.length} usuarios sincronizados a SQLite (tabla users)`);
              } catch (syncError) {
                console.error('⚠️ Error sincronizando usuarios a SQLite:', syncError.message);
              }
            });

            return { success: true, users: data };
          }
        } catch (supaError) {
          console.warn('⚠️ Error con Supabase, usando SQLite:', supaError.message);
        }
      }

      // ✅ FALLBACK: Leer desde SQLite local
      console.log('📂 Usando SQLite local para obtener usuarios');

      if (!db || !db.db) {
        return { success: false, error: 'Base de datos no disponible' };
      }

      const usuariosSQLite = db.db.prepare(`
        SELECT
          id,
          email,
          full_name,
          role,
          pin_code,
          is_active,
          station_id,
          created_at
        FROM users
        ORDER BY created_at DESC
      `).all();

      console.log(`✅ Total usuarios obtenidos de SQLite (tabla users): ${usuariosSQLite.length}`);
      return { success: true, users: usuariosSQLite || [], source: 'local' };
    } catch (error) {
      console.error('❌ Error en get-all-users:', error?.message);
      return { success: false, error: error?.message };
    }
  });

  // Crear nuevo usuario - Solo Admin
  safeIpcHandle('create-user', async (event, userData) => {
    try {
      console.log('➕ [Usuarios] Creando usuario:', userData.email);

      // TODO: Verificar rol de admin
      // if (currentSession?.user?.role !== 'ADMIN') {
      //   return { success: false, error: 'No autorizado - Solo admin puede crear usuarios' };
      // }

      // Validaciones
      if (!userData?.email) {
        return { success: false, error: 'Email es requerido' };
      }
      if (!userData?.full_name) {
        return { success: false, error: 'Nombre completo es requerido' };
      }
      if (!userData?.role) {
        return { success: false, error: 'Rol es requerido' };
      }
      if (!userData?.password) {
        return { success: false, error: 'Contraseña es requerida' };
      }
      if (userData.password.length < 6) {
        return { success: false, error: 'Contraseña debe tener mínimo 6 caracteres' };
      }

      if (!supabaseManager || !supabaseManager.isAvailable()) {
        return { success: false, error: 'Supabase no disponible' };
      }

      // Crear usuario en Supabase Auth (usando Admin API para auto-confirmar)
      const { data: authData, error: authError } = await supabaseManager.client.auth.admin.createUser({
        email: userData.email,
        password: userData.password,
        email_confirm: true // ✅ Auto-confirmar email (aplicación interna)
      });

      if (authError) {
        console.error('❌ Error creando usuario en Auth:', authError);
        return { success: false, error: authError.message };
      }

      // Actualizar el perfil del usuario en la tabla users
      const { data: profileData, error: profileError } = await supabaseManager.client
        .from('users')
        .upsert({
          id: authData.user.id,
          email: userData.email,
          full_name: userData.full_name,
          role: userData.role.toLowerCase(), // ✅ Convertir a minúsculas
          pin_code: userData.pin_code || null,
          is_active: true
        })
        .select()
        .single();

      if (profileError) {
        console.error('❌ Error actualizando perfil:', profileError);
        return { success: false, error: profileError.message };
      }

      // ✅ SINCRONIZAR a SQLite local
      try {
        if (db && db.db) {
          db.db.prepare(`
            INSERT OR REPLACE INTO users (
              id, email, full_name, role, pin_code, is_active,
              station_id, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
          `).run(
            authData.user.id,
            userData.email,
            userData.full_name,
            userData.role.toLowerCase(),
            userData.pin_code || null,
            1, // is_active
            userData.station_id || null,
            new Date().toISOString()
          );

          console.log('✅ Usuario sincronizado a SQLite (tabla users)');
        }
      } catch (sqliteError) {
        console.error('⚠️ Error sincronizando usuario a SQLite:', sqliteError.message);
        // No fallar si SQLite falla, ya está en Supabase
      }

      // Registrar en audit log
      await registrarAuditLog(
        'user_created',
        currentSession?.user?.id || null,  // admin que creó el usuario
        null,  // station_id
        null,  // voucher_id
        {
          created_user_id: authData.user.id,
          email: userData.email,
          full_name: userData.full_name,
          role: userData.role
        }
      );

      console.log('✅ Usuario creado exitosamente:', profileData);
      return { success: true, user: profileData };
    } catch (error) {
      console.error('❌ Error en create-user:', error?.message);
      return { success: false, error: error?.message };
    }
  });

  // Actualizar usuario existente - Solo Admin
  safeIpcHandle('update-user', async (event, userId, updates) => {
    try {
      console.log('✏️ [Usuarios] Actualizando usuario:', userId);

      // TODO: Verificar rol de admin
      // if (currentSession?.user?.role !== 'ADMIN') {
      //   return { success: false, error: 'No autorizado' };
      // }

      if (!supabaseManager || !supabaseManager.isAvailable()) {
        return { success: false, error: 'Supabase no disponible' };
      }

      // No permitir actualizar ciertos campos
      delete updates.id;
      delete updates.email; // Email no se puede cambiar fácilmente en Supabase Auth

      // ✅ Convertir role a minúsculas si existe
      if (updates.role) {
        updates.role = updates.role.toLowerCase();
      }

      const { data, error } = await supabaseManager.client
        .from('users')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        console.error('❌ Error actualizando usuario:', error);
        return { success: false, error: error.message };
      }

      // ✅ SINCRONIZAR a SQLite local
      try {
        if (db && db.db) {
          const sqliteUpdates = {};

          if (updates.full_name) sqliteUpdates.full_name = updates.full_name;
          if (updates.role) sqliteUpdates.role = updates.role;
          if (updates.pin_code !== undefined) sqliteUpdates.pin_code = updates.pin_code;
          if (updates.is_active !== undefined) sqliteUpdates.is_active = updates.is_active ? 1 : 0;
          if (updates.station_id !== undefined) sqliteUpdates.station_id = updates.station_id;

          if (Object.keys(sqliteUpdates).length > 0) {
            sqliteUpdates.updated_at = 'datetime(\'now\', \'localtime\')';

            const setPairs = Object.keys(sqliteUpdates).map(key =>
              key === 'updated_at' ? `${key} = ${sqliteUpdates[key]}` : `${key} = ?`
            ).join(', ');

            const values = Object.entries(sqliteUpdates)
              .filter(([key]) => key !== 'updated_at')
              .map(([_, val]) => val);
            values.push(userId); // Para WHERE clause

            db.db.prepare(`
              UPDATE users
              SET ${setPairs}
              WHERE id = ?
            `).run(...values);

            console.log('✅ Usuario actualizado en SQLite (tabla users)');
          }
        }
      } catch (sqliteError) {
        console.error('⚠️ Error actualizando usuario en SQLite:', sqliteError.message);
        // No fallar si SQLite falla, ya está en Supabase
      }

      // Registrar en audit log
      await registrarAuditLog(
        'user_updated',
        currentSession?.user?.id || null,  // admin que actualizó
        null,  // station_id
        null,  // voucher_id
        {
          updated_user_id: userId,
          changes: updates
        }
      );

      console.log('✅ Usuario actualizado exitosamente:', data);
      return { success: true, user: data };
    } catch (error) {
      console.error('❌ Error en update-user:', error?.message);
      return { success: false, error: error?.message };
    }
  });

  // Activar/Desactivar usuario - Solo Admin
  safeIpcHandle('toggle-user', async (event, userId, isActive) => {
    try {
      console.log(`🔄 [Usuarios] ${isActive ? 'Activando' : 'Desactivando'} usuario:`, userId);

      // TODO: Verificar rol de admin
      // if (currentSession?.user?.role !== 'ADMIN') {
      //   return { success: false, error: 'No autorizado' };
      // }

      if (!supabaseManager || !supabaseManager.isAvailable()) {
        return { success: false, error: 'Supabase no disponible' };
      }

      const { data, error } = await supabaseManager.client
        .from('users')
        .update({ is_active: isActive })
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        console.error('❌ Error cambiando estado de usuario:', error);
        return { success: false, error: error.message };
      }

      // ✅ SINCRONIZAR a SQLite local
      try {
        if (db && db.db) {
          db.db.prepare(`
            UPDATE users
            SET is_active = ?, updated_at = datetime('now', 'localtime')
            WHERE id = ?
          `).run(isActive ? 1 : 0, userId);

          console.log(`✅ Estado de usuario actualizado en SQLite (tabla users)`);
        }
      } catch (sqliteError) {
        console.error('⚠️ Error actualizando estado en SQLite:', sqliteError.message);
        // No fallar si SQLite falla, ya está en Supabase
      }

      // Registrar en audit log
      await registrarAuditLog(
        'user_updated',
        currentSession?.user?.id || null,  // admin que hizo el cambio
        null,  // station_id
        null,  // voucher_id
        {
          updated_user_id: userId,
          action: isActive ? 'activated' : 'deactivated',
          is_active: isActive
        }
      );

      console.log(`✅ Usuario ${isActive ? 'activado' : 'desactivado'} exitosamente:`, data);
      return { success: true, user: data };
    } catch (error) {
      console.error('❌ Error en toggle-user:', error?.message);
      return { success: false, error: error?.message };
    }
  });

  // Cambiar contraseña de usuario - Solo Admin
  safeIpcHandle('change-user-password', async (event, userId, newPassword) => {
    try {
      console.log('🔑 [Usuarios] Cambiando contraseña de usuario:', userId);

      // TODO: Verificar rol de admin
      // if (currentSession?.user?.role !== 'ADMIN') {
      //   return { success: false, error: 'No autorizado' };
      // }

      if (!newPassword || newPassword.length < 6) {
        return { success: false, error: 'Contraseña debe tener mínimo 6 caracteres' };
      }

      if (!supabaseManager || !supabaseManager.isAvailable()) {
        return { success: false, error: 'Supabase no disponible' };
      }

      // Actualizar contraseña en Supabase Auth (requiere permisos de admin)
      const { data, error } = await supabaseManager.client.auth.admin.updateUserById(
        userId,
        { password: newPassword }
      );

      if (error) {
        console.error('❌ Error cambiando contraseña:', error);
        return { success: false, error: error.message };
      }

      // Registrar en audit log
      await registrarAuditLog(
        'user_updated',
        currentSession?.user?.id || null,  // admin que cambió la contraseña
        null,  // station_id
        null,  // voucher_id
        {
          updated_user_id: userId,
          action: 'password_changed'
        }
      );

      console.log('✅ Contraseña actualizada exitosamente');
      return { success: true };
    } catch (error) {
      console.error('❌ Error en change-user-password:', error?.message);
      return { success: false, error: error?.message };
    }
  });

  // Handler especial: Sincronización forzada de usuarios Supabase → SQLite
  safeIpcHandle('force-sync-users', async (event) => {
    try {
      console.log('🔄 [Sync] Iniciando sincronización forzada de usuarios...');

      if (!supabaseManager || !supabaseManager.isAvailable()) {
        return { success: false, error: 'Supabase no disponible' };
      }

      if (!db || !db.db) {
        return { success: false, error: 'Base de datos SQLite no disponible' };
      }

      // 1. Verificar y arreglar estructura de tabla si es necesario
      console.log('🔧 Verificando estructura de tabla usuarios...');

      try {
        // Verificar si la tabla tiene la estructura correcta (id como TEXT)
        const tableInfo = db.db.prepare("PRAGMA table_info(usuarios)").all();
        const idColumn = tableInfo.find(col => col.name === 'id');

        if (idColumn && idColumn.type === 'INTEGER') {
          console.log('⚠️ Tabla usuarios usa INTEGER para id, debe ser TEXT para UUIDs');
          console.log('🔧 Recreando tabla con estructura correcta...');

          // Crear tabla temporal con estructura correcta
          db.db.exec(`
            CREATE TABLE IF NOT EXISTS usuarios_new (
              id TEXT PRIMARY KEY,
              username TEXT NOT NULL,
              password_hash TEXT,
              password_salt TEXT,
              email TEXT UNIQUE NOT NULL,
              role TEXT NOT NULL CHECK(role IN ('ADMIN', 'MESA', 'CAJA', 'AUDITOR')),
              activo INTEGER DEFAULT 1,
              sincronizado INTEGER DEFAULT 0,
              creado DATETIME DEFAULT CURRENT_TIMESTAMP,
              modificado DATETIME DEFAULT CURRENT_TIMESTAMP
            )
          `);

          // Copiar datos existentes
          db.db.exec(`
            INSERT OR IGNORE INTO usuarios_new (id, username, password_hash, password_salt, email, role, activo, sincronizado, creado, modificado)
            SELECT
              CAST(id AS TEXT) as id,
              username,
              password_hash,
              password_salt,
              COALESCE(email, username || '@local.com') as email,
              role,
              activo,
              sincronizado,
              creado,
              modificado
            FROM usuarios
          `);

          // Reemplazar tabla
          db.db.exec('DROP TABLE usuarios');
          db.db.exec('ALTER TABLE usuarios_new RENAME TO usuarios');

          // Crear índices
          db.db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_usuario_email ON usuarios(email)');
          db.db.exec('CREATE INDEX IF NOT EXISTS idx_usuario_role ON usuarios(role)');

          console.log('✅ Tabla usuarios recreada con estructura correcta');
        } else {
          console.log('✅ Tabla usuarios tiene estructura correcta');
        }
      } catch (structError) {
        console.error('⚠️ Error verificando estructura:', structError.message);
        // Continuar de todos modos
      }

      // 2. Obtener todos los usuarios de Supabase
      console.log('📥 Obteniendo usuarios de Supabase...');
      const { data: users, error } = await supabaseManager.client
        .from('users')
        .select('id, email, full_name, role, pin_code, is_active, station_id, created_at')
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Error obteniendo usuarios: ${error.message}`);
      }

      if (!users || users.length === 0) {
        return {
          success: true,
          message: 'No hay usuarios en Supabase para sincronizar',
          synced: 0,
          updated: 0
        };
      }

      console.log(`✅ ${users.length} usuarios encontrados en Supabase`);

      // 3. Sincronizar cada usuario a SQLite
      const crypto = require('crypto');
      let synced = 0;
      let updated = 0;
      let errors = 0;

      for (const user of users) {
        try {
          // Verificar si el usuario ya existe
          const existing = db.db.prepare('SELECT id FROM usuarios WHERE id = ?').get(user.id);
          const isUpdate = !!existing;

          // Generar hash de password dummy (usuarios de Supabase usan Supabase Auth)
          const dummyHash = 'SUPABASE_AUTH_USER';
          const dummySalt = 'SUPABASE';

          // UPSERT usuario
          db.db.prepare(`
            INSERT INTO usuarios (id, username, password_hash, password_salt, email, role, activo, sincronizado)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1)
            ON CONFLICT(id) DO UPDATE SET
              username = excluded.username,
              email = excluded.email,
              role = excluded.role,
              activo = excluded.activo,
              sincronizado = 1,
              modificado = CURRENT_TIMESTAMP
          `).run(
            user.id,
            user.full_name || user.email.split('@')[0],
            dummyHash,
            dummySalt,
            user.email,
            user.role.toUpperCase(),
            user.is_active ? 1 : 0
          );

          if (isUpdate) {
            updated++;
            console.log(`  ✏️  Actualizado: ${user.email} (${user.role})`);
          } else {
            synced++;
            console.log(`  ➕ Nuevo: ${user.email} (${user.role})`);
          }
        } catch (userError) {
          errors++;
          console.error(`  ❌ Error con ${user.email}:`, userError.message);
        }
      }

      // 4. Verificación final
      const finalCount = db.db.prepare('SELECT COUNT(*) as count FROM usuarios').get();

      console.log('\n' + '='.repeat(60));
      console.log('📊 RESUMEN DE SINCRONIZACIÓN');
      console.log('='.repeat(60));
      console.log(`✅ Usuarios nuevos:      ${synced}`);
      console.log(`✏️  Usuarios actualizados: ${updated}`);
      console.log(`❌ Errores:              ${errors}`);
      console.log(`📊 Total en SQLite:      ${finalCount.count}`);
      console.log('='.repeat(60));

      return {
        success: true,
        message: 'Sincronización completada',
        synced,
        updated,
        errors,
        total: finalCount.count
      };

    } catch (error) {
      console.error('❌ Error en force-sync-users:', error.message);
      return { success: false, error: error.message };
    }
  });

  // ============================================
  // HANDLERS: Auditoría (Solo Lectura)
  // ============================================

  // Obtener logs de auditoría con filtros
  safeIpcHandle('get-audit-logs', async (event, filtros = {}) => {
    try {
      console.log('📋 [Logs] Obteniendo logs con filtros:', filtros);

      if (!supabaseManager || !supabaseManager.isAvailable()) {
        return { success: false, error: 'Supabase no disponible' };
      }

      let query = supabaseManager.client
        .from('audit_log')
        .select('*')
        .order('created_at', { ascending: false });

      // Aplicar filtros
      if (filtros.desde) {
        query = query.gte('created_at', filtros.desde + 'T00:00:00Z');
        console.log('  Filtro desde:', filtros.desde);
      }

      if (filtros.hasta) {
        query = query.lte('created_at', filtros.hasta + 'T23:59:59Z');
        console.log('  Filtro hasta:', filtros.hasta);
      }

      if (filtros.tipo) {
        query = query.eq('action', filtros.tipo);
        console.log('  Filtro tipo:', filtros.tipo);
      }

      if (filtros.usuario) {
        query = query.eq('user_id', filtros.usuario);
        console.log('  Filtro usuario:', filtros.usuario);
      }

      if (filtros.estacion) {
        query = query.eq('station_id', parseInt(filtros.estacion));
        console.log('  Filtro estación:', filtros.estacion);
      }

      // Limitar a 1000 registros para no sobrecargar
      query = query.limit(1000);

      const { data, error } = await query;

      if (error) {
        console.error('❌ Error obteniendo logs:', error);
        return { success: false, error: error.message };
      }

      console.log('✅ Logs obtenidos:', data?.length || 0);
      return { success: true, logs: data || [] };
    } catch (error) {
      console.error('❌ Error en get-audit-logs:', error?.message);
      return { success: false, error: error?.message };
    }
  });

  // Obtener estadísticas del día para dashboard
  safeIpcHandle('get-audit-stats', async (event, fecha = null) => {
    try {
      console.log('📊 [Auditoría] Obteniendo estadísticas...');
      console.log('📊 [Auditoría] Fecha solicitada:', fecha || 'HOY');

      // Fecha por defecto: hoy
      const targetDate = fecha ? new Date(fecha) : new Date();
      const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0)).toISOString();
      const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999)).toISOString();

      console.log('📊 [Auditoría] Rango de fechas:', { startOfDay, endOfDay });

      // Intentar obtener de Supabase primero
      if (supabaseManager && supabaseManager.isAvailable()) {
        console.log('📊 [Auditoría] Consultando Supabase...');
        try {
          const { data, error } = await supabaseManager.client
            .from('vouchers')
            .select('*')
            .gte('issued_at', startOfDay)
            .lte('issued_at', endOfDay);

          if (error) {
            console.warn('⚠️ [Auditoría] Error en Supabase:', error);
          } else {
            console.log(`📊 [Auditoría] Supabase retornó ${data?.length || 0} vouchers`);
            if (data && data.length > 0) {
              const stats = calcularEstadisticas(data);
              console.log('✅ Estadísticas obtenidas de Supabase:', stats);
              return { success: true, stats, source: 'supabase' };
            } else {
              console.log('⚠️ [Auditoría] Supabase retornó 0 vouchers, intentando SQLite...');
            }
          }
        } catch (supaError) {
          console.warn('⚠️ [Auditoría] Excepción en Supabase:', supaError);
        }
      } else {
        console.log('⚠️ [Auditoría] Supabase no disponible');
      }

      // Fallback: SQLite local
      console.log('📊 [Auditoría] Consultando SQLite local...');
      if (!db || !db.db) {
        console.error('❌ [Auditoría] Base de datos SQLite no disponible');
        return { success: false, error: 'Base de datos no disponible' };
      }

      const tickets = db.db.prepare(`
        SELECT * FROM tickets
        WHERE fecha_emision >= ? AND fecha_emision <= ?
      `).all(startOfDay, endOfDay);

      console.log(`📊 [Auditoría] SQLite retornó ${tickets.length} tickets`);
      console.log('📊 [Auditoría] Primeros 2 tickets:', tickets.slice(0, 2));

      const stats = calcularEstadisticas(tickets);
      console.log('✅ Estadísticas obtenidas de SQLite:', stats);
      return { success: true, stats, source: 'sqlite' };

    } catch (error) {
      console.error('❌ [Auditoría] Error obteniendo estadísticas:', error);
      console.error('❌ [Auditoría] Stack:', error?.stack);
      return { success: false, error: error?.message || String(error) };
    }
  });

  // Función helper para calcular estadísticas
  function calcularEstadisticas(tickets) {
    const emitidos = tickets.filter(t =>
      ['emitido', 'active', 'activo'].includes(String(t.estado || t.status || '').toLowerCase())
    );
    const canjeados = tickets.filter(t =>
      ['canjeado', 'redeemed', 'usado'].includes(String(t.estado || t.status || '').toLowerCase())
    );
    const cancelados = tickets.filter(t =>
      ['cancelado', 'cancelled'].includes(String(t.estado || t.status || '').toLowerCase())
    );

    const totalDOP = tickets
      .filter(t => (t.currency || t.moneda) === 'DOP')
      .reduce((sum, t) => sum + (Number(t.amount || t.valor) || 0), 0);

    const totalUSD = tickets
      .filter(t => (t.currency || t.moneda) === 'USD')
      .reduce((sum, t) => sum + (Number(t.amount || t.valor) || 0), 0);

    const canjeadosDOP = canjeados
      .filter(t => (t.currency || t.moneda) === 'DOP')
      .reduce((sum, t) => sum + (Number(t.amount || t.valor) || 0), 0);

    const canjeadosUSD = canjeados
      .filter(t => (t.currency || t.moneda) === 'USD')
      .reduce((sum, t) => sum + (Number(t.amount || t.valor) || 0), 0);

    return {
      total: tickets.length,
      emitidos: emitidos.length,
      canjeados: canjeados.length,
      cancelados: cancelados.length,
      pendientes: emitidos.length,
      totalDOP: totalDOP.toFixed(2),
      totalUSD: totalUSD.toFixed(2),
      canjeadosDOP: canjeadosDOP.toFixed(2),
      canjeadosUSD: canjeadosUSD.toFixed(2),
      pendientesDOP: (totalDOP - canjeadosDOP).toFixed(2),
      pendientesUSD: (totalUSD - canjeadosUSD).toFixed(2)
    };
  }

  // Obtener tickets con filtros para auditoría
  safeIpcHandle('get-audit-tickets', async (event, filtros = {}) => {
    try {
      console.log('📋 [Auditoría] Obteniendo tickets con filtros:', JSON.stringify(filtros, null, 2));

      const {
        fechaDesde,
        fechaHasta,
        estado,
        moneda,
        mesa,
        operador,
        page = 1,
        limit = 20
      } = filtros;

      console.log('📋 [Auditoría] Parámetros extraídos:', { fechaDesde, fechaHasta, estado, moneda, mesa, operador, page, limit });

      // Intentar Supabase primero
      if (supabaseManager && supabaseManager.isAvailable()) {
        console.log('📋 [Auditoría] Consultando Supabase...');
        try {
          // Query simplificado SIN joins para evitar errores
          let query = supabaseManager.client
            .from('vouchers')
            .select('*', { count: 'exact' });

          // Aplicar filtros
          if (fechaDesde) {
            const isoFechaDesde = new Date(fechaDesde).toISOString();
            console.log('📋 [Auditoría] Filtro fechaDesde:', isoFechaDesde);
            query = query.gte('issued_at', isoFechaDesde);
          }
          if (fechaHasta) {
            // Crear fecha al final del día en UTC (sin cambio de timezone)
            const fechaFin = new Date(fechaHasta);
            fechaFin.setUTCHours(23, 59, 59, 999);
            const isoFechaHasta = fechaFin.toISOString();
            console.log('📋 [Auditoría] Filtro fechaHasta:', isoFechaHasta);
            query = query.lte('issued_at', isoFechaHasta);
          }
          if (estado) {
            console.log('📋 [Auditoría] Filtro estado (frontend):', estado);
            // Mapear estados frontend → Supabase
            const estadoMap = {
              'emitido': 'active',
              'activo': 'active',
              'canjeado': 'redeemed',
              'usado': 'redeemed',
              'cancelado': 'cancelled'
            };
            const estadoSupabase = estadoMap[estado.toLowerCase()] || estado;
            console.log('📋 [Auditoría] Filtro estado (Supabase):', estadoSupabase);
            query = query.eq('status', estadoSupabase);
          }
          if (moneda) {
            console.log('📋 [Auditoría] Filtro moneda:', moneda);
            query = query.eq('currency', moneda);
          }
          if (mesa) {
            console.log('📋 [Auditoría] Filtro mesa (station_id):', mesa);
            // Intentar convertir "P01" a número 1, "P02" a 2, etc.
            const stationNum = mesa.match(/\d+/);
            if (stationNum) {
              query = query.eq('issued_at_station_id', parseInt(stationNum[0]));
            }
          }

          // Paginación
          const offset = (page - 1) * limit;
          console.log('📋 [Auditoría] Paginación - offset:', offset, 'limit:', limit);
          query = query.order('issued_at', { ascending: false }).range(offset, offset + limit - 1);

          const { data, error, count } = await query;

          if (error) {
            console.warn('⚠️ [Auditoría] Error en Supabase:', error);
            console.warn('⚠️ [Auditoría] Error details:', error.message, error.details);
          } else {
            console.log(`📋 [Auditoría] Supabase retornó ${data?.length || 0} vouchers de ${count} totales`);
            console.log('📋 [Auditoría] Primeros 2 vouchers:', data?.slice(0, 2));
            if (data && data.length > 0) {
              const tickets = mapearVouchersSupabase(data);
              console.log('✅ [Auditoría] Tickets mapeados:', tickets.slice(0, 2));
              return {
                success: true,
                tickets,
                total: count,
                page,
                totalPages: Math.ceil(count / limit),
                source: 'supabase'
              };
            } else if (count === 0) {
              console.log('⚠️ [Auditoría] Supabase retornó 0 vouchers, intentando SQLite...');
            }
          }
        } catch (supaError) {
          console.warn('⚠️ [Auditoría] Excepción en Supabase:', supaError);
        }
      } else {
        console.log('⚠️ [Auditoría] Supabase no disponible');
      }

      // Fallback: SQLite local
      console.log('📋 [Auditoría] Consultando SQLite local...');
      if (!db || !db.db) {
        console.error('❌ [Auditoría] Base de datos SQLite no disponible');
        return { success: false, error: 'Base de datos no disponible', tickets: [], total: 0, page: 1, totalPages: 0 };
      }

      let whereClauses = [];
      let params = [];

      if (fechaDesde) {
        whereClauses.push('fecha_emision >= ?');
        params.push(new Date(fechaDesde).toISOString());
      }
      if (fechaHasta) {
        whereClauses.push('fecha_emision <= ?');
        const fechaFin = new Date(fechaHasta);
        fechaFin.setUTCHours(23, 59, 59, 999);
        params.push(fechaFin.toISOString());
      }
      if (estado) {
        whereClauses.push('estado = ?');
        params.push(estado);
      }
      if (moneda) {
        whereClauses.push('currency = ?');
        params.push(moneda);
      }
      if (mesa) {
        whereClauses.push('mesa = ?');
        params.push(mesa);
      }
      if (operador) {
        whereClauses.push('notas LIKE ?');
        params.push(`%${operador}%`);
      }

      const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

      // Contar total
      const countQuery = `SELECT COUNT(*) as total FROM tickets ${whereSQL}`;
      console.log('📋 [Auditoría] Query SQLite COUNT:', countQuery);
      console.log('📋 [Auditoría] Parámetros COUNT:', params);
      const { total } = db.db.prepare(countQuery).get(...params);

      // Obtener tickets paginados
      const offset = (page - 1) * limit;
      const ticketsQuery = `
        SELECT
          code,
          amount,
          currency,
          mesa,
          estado,
          fecha_emision as created_at,
          fecha_cobro as used_at,
          notas as operador
        FROM tickets ${whereSQL}
        ORDER BY fecha_emision DESC
        LIMIT ? OFFSET ?
      `;
      console.log('📋 [Auditoría] Query SQLite SELECT:', ticketsQuery);
      console.log('📋 [Auditoría] Parámetros SELECT:', [...params, limit, offset]);
      const tickets = db.db.prepare(ticketsQuery).all(...params, limit, offset);

      console.log(`✅ ${tickets.length} tickets obtenidos de SQLite (total: ${total})`);
      return {
        success: true,
        tickets,
        total,
        page,
        totalPages: Math.ceil(total / limit),
        source: 'sqlite'
      };

    } catch (error) {
      console.error('❌ Error obteniendo tickets:', error?.message);
      return { success: false, error: error?.message };
    }
  });

  // Función helper para mapear vouchers de Supabase a formato esperado
  function mapearVouchersSupabase(vouchers) {
    return vouchers.map(v => ({
      code: v.voucher_code,
      amount: v.amount,
      currency: v.currency,
      estado: v.status === 'active' ? 'emitido' :
              v.status === 'redeemed' ? 'canjeado' :
              v.status === 'cancelled' ? 'cancelado' : v.status,
      created_at: v.issued_at,
      used_at: v.redeemed_at,
      // Mesa: formatear station_id como "Mesa X"
      mesa: v.issued_at_station_id ? `Mesa ${v.issued_at_station_id}` : 'N/A',
      // Operador: usar customer_name si existe, sino mostrar ID
      operador: v.customer_name || (v.issued_by_user_id ? `Usuario ${v.issued_by_user_id.substring(0, 8)}` : 'N/A')
    }));
  }

  // Exportar reporte de auditoría a CSV
  safeIpcHandle('export-audit-report', async (event, filtros = {}) => {
    try {
      console.log('📥 [Auditoría] Exportando reporte...');
      console.log('📥 [Auditoría] Filtros recibidos:', filtros);

      let tickets = [];

      // ==========================================
      // PASO 1: INTENTAR SUPABASE PRIMERO
      // ==========================================
      if (supabaseManager && supabaseManager.isAvailable()) {
        console.log('📥 [Auditoría] Consultando Supabase para exportar...');
        try {
          let query = supabaseManager.client
            .from('vouchers')
            .select('*');

          // Aplicar filtros
          if (filtros.fechaDesde) {
            const isoFechaDesde = new Date(filtros.fechaDesde).toISOString();
            query = query.gte('issued_at', isoFechaDesde);
          }
          if (filtros.fechaHasta) {
            const fechaFin = new Date(filtros.fechaHasta);
            fechaFin.setUTCHours(23, 59, 59, 999);
            query = query.lte('issued_at', fechaFin.toISOString());
          }
          if (filtros.estado) {
            const estadoMap = {
              'emitido': 'active',
              'activo': 'active',
              'canjeado': 'redeemed',
              'usado': 'redeemed',
              'cancelado': 'cancelled'
            };
            const estadoSupabase = estadoMap[filtros.estado.toLowerCase()] || filtros.estado;
            query = query.eq('status', estadoSupabase);
          }
          if (filtros.moneda) {
            query = query.eq('currency', filtros.moneda);
          }
          if (filtros.mesa) {
            const stationNum = filtros.mesa.match(/\d+/);
            if (stationNum) {
              query = query.eq('issued_at_station_id', parseInt(stationNum[0]));
            }
          }

          query = query.order('issued_at', { ascending: false }).limit(10000);

          const { data, error } = await query;

          if (error) {
            console.warn('⚠️ [Auditoría] Error en Supabase:', error);
          } else if (data && data.length > 0) {
            console.log(`✅ [Auditoría] Supabase retornó ${data.length} vouchers para exportar`);
            tickets = mapearVouchersSupabase(data);
          } else {
            console.log('⚠️ [Auditoría] Supabase retornó 0 vouchers, intentando SQLite...');
          }
        } catch (supaError) {
          console.warn('⚠️ [Auditoría] Excepción en Supabase:', supaError);
        }
      } else {
        console.log('⚠️ [Auditoría] Supabase no disponible');
      }

      // ==========================================
      // PASO 2: FALLBACK A SQLITE SI ES NECESARIO
      // ==========================================
      if (tickets.length === 0) {
        console.log('📥 [Auditoría] Consultando SQLite para exportar...');
        try {
          if (!db || !db.db) {
            return { success: false, error: 'No hay tickets disponibles para exportar' };
          }

          let whereClauses = [];
          let params = [];

          if (filtros.fechaDesde) {
            whereClauses.push('fecha_emision >= ?');
            params.push(new Date(filtros.fechaDesde).toISOString());
          }
          if (filtros.fechaHasta) {
            whereClauses.push('fecha_emision <= ?');
            const fechaFin = new Date(filtros.fechaHasta);
            fechaFin.setUTCHours(23, 59, 59, 999);
            params.push(fechaFin.toISOString());
          }
          if (filtros.estado) {
            whereClauses.push('estado = ?');
            params.push(filtros.estado);
          }
          if (filtros.moneda) {
            whereClauses.push('currency = ?');
            params.push(filtros.moneda);
          }
          if (filtros.mesa) {
            whereClauses.push('mesa = ?');
            params.push(filtros.mesa);
          }

          const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

          const ticketsQuery = `
            SELECT
              code,
              amount,
              currency,
              mesa,
              estado,
              fecha_emision as created_at,
              fecha_cobro as used_at,
              notas as operador
            FROM tickets ${whereSQL}
            ORDER BY fecha_emision DESC
          `;

          tickets = db.db.prepare(ticketsQuery).all(...params);
          console.log(`📥 [Auditoría] SQLite retornó ${tickets.length} tickets para exportar`);

        } catch (dbError) {
          console.error('❌ Error consultando SQLite:', dbError);
          return { success: false, error: dbError.message };
        }
      }

      if (tickets.length === 0) {
        console.log('⚠️ No hay tickets para exportar');
        return { success: false, error: 'No hay tickets para exportar con los filtros especificados' };
      }

      // Generar CSV
      const csv = generarCSV(tickets);

      // Guardar archivo
      const fs = require('fs');
      const os = require('os');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filename = `auditoria-${timestamp}.csv`;
      const filepath = path.join(os.tmpdir(), filename);

      fs.writeFileSync(filepath, csv, 'utf8');

      console.log('✅ Reporte exportado:', filepath);
      return { success: true, filepath, filename, totalRecords: tickets.length };

    } catch (error) {
      console.error('❌ Error exportando reporte:', error?.message);
      console.error('❌ Stack:', error?.stack);
      return { success: false, error: error?.message };
    }
  });

  // Función helper para generar CSV
  function generarCSV(tickets) {
    const headers = ['Código', 'Monto', 'Moneda', 'Estado', 'Mesa', 'Operador', 'Fecha Emisión', 'Fecha Canje'];
    const rows = tickets.map(t => [
      t.code || t.voucher_code,
      t.amount || t.valor,
      t.currency || t.moneda,
      t.estado || t.status,
      t.mesa || t.mesa_nombre || 'N/A',
      t.operador || t.operador_nombre || t.created_by_username || 'N/A',
      t.fecha_emision || t.created_at || t.issued_at,
      t.fecha_cobro || t.used_at || t.redeemed_at || '-'
    ]);

    // Convertir a CSV
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    return '\uFEFF' + csvContent; // BOM para UTF-8
  }

  // Abrir ubicación de archivo exportado
  safeIpcHandle('open-file-location', async (event, filepath) => {
    try {
      console.log('📂 [Auditoría] Abriendo ubicación:', filepath);
      const { shell } = require('electron');
      await shell.showItemInFolder(filepath);
      return { success: true };
    } catch (error) {
      console.error('❌ Error abriendo ubicación:', error?.message);
      return { success: false, error: error?.message };
    }
  });

  // Abrir archivo con aplicación predeterminada
  safeIpcHandle('open-file', async (event, filepath) => {
    try {
      console.log('📄 Abriendo archivo:', filepath);
      const { shell } = require('electron');
      await shell.openPath(filepath);
      return { success: true };
    } catch (error) {
      console.error('❌ Error abriendo archivo:', error?.message);
      return { success: false, error: error?.message };
    }
  });

  // ============================================
  // HANDLER: health-check (Monitoreo de salud)
  // ============================================
  safeIpcHandle('health-check', async () => {
    try {
      if (!healthMonitor) {
        return { success: false, error: 'Health monitor no inicializado' };
      }

      const stats = healthMonitor.getHealthStats();

      return {
        success: true,
        health: {
          status: stats.isHealthy ? 'healthy' : 'unhealthy',
          uptime: stats.uptime,
          uptimeHuman: formatUptime(stats.uptime),
          runningOperations: stats.runningOperations,
          runningDetails: stats.runningDetails,
          timedoutOperations: stats.timedoutOperations,
          averages: stats.averages,
          counts: stats.counts,
          lastHeartbeat: stats.lastHeartbeat,
          timeSinceHeartbeat: Date.now() - stats.lastHeartbeat
        }
      };
    } catch (error) {
      console.error('❌ Error en health-check:', error?.message);
      return { success: false, error: error?.message };
    }
  });

  // Función helper para formatear uptime
  function formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  // ============================================
  // HANDLER: sync:get-pending-count
  // Obtener cantidad de tickets pendientes de sincronización
  // ============================================
  safeIpcHandle('sync:get-pending-count', async () => {
    try {
      if (!db || !db.db) {
        return { success: false, error: 'Base de datos no disponible' };
      }

      const result = db.db.prepare(
        'SELECT COUNT(*) as count FROM tickets WHERE sincronizado = 0'
      ).get();

      return {
        success: true,
        count: result.count || 0
      };
    } catch (error) {
      console.error('❌ Error obteniendo tickets pendientes:', error?.message);
      return { success: false, error: error?.message };
    }
  });

  // ============================================
  // HANDLER: sync:force-sync
  // Forzar sincronización manual inmediata
  // ============================================
  safeIpcHandle('sync:force-sync', async () => {
    try {
      console.log('🔄 [Sync Manual] Iniciando sincronización manual...');

      if (!supabaseManager || !supabaseManager.isAvailable() || !supabaseManager.isConnected) {
        return {
          success: false,
          error: 'No hay conexión a Supabase'
        };
      }

      if (!db || !db.db) {
        return {
          success: false,
          error: 'Base de datos no disponible'
        };
      }

      // Buscar tickets no sincronizados
      const pendingTickets = db.db.prepare(
        'SELECT * FROM tickets WHERE sincronizado = 0 ORDER BY fecha_emision ASC'
      ).all();

      if (pendingTickets.length === 0) {
        return {
          success: true,
          message: 'No hay tickets pendientes de sincronización',
          synced: 0,
          failed: 0
        };
      }

      console.log(`🔄 [Sync Manual] Encontrados ${pendingTickets.length} tickets pendientes`);

      let successCount = 0;
      let errorCount = 0;

      for (const ticket of pendingTickets) {
        try {
          const userId = currentSession?.user?.id || null;

          // Convertir mesa de TEXT a INTEGER para Supabase
          const mesaStr = ticket.mesa || ticket.mesa_nombre || '';
          const mesaNum = parseInt(String(mesaStr).replace(/\D/g, ''));

          const result = await supabaseManager.createVoucher({
            voucher_code: ticket.code,
            amount: ticket.amount,
            currency: ticket.currency || 'USD',
            issued_by_user_id: userId,
            issued_at_station_id: mesaNum || null,
            status: ticket.estado === 'active' ? 'active' : 'redeemed',
            created_at: ticket.fecha_emision,
            redeemed_at: ticket.fecha_cobro || null,
            redeemed_by_user_id: ticket.cajero_id || null
          });

          if (result.success) {
            db.db.prepare(
              'UPDATE tickets SET sincronizado = 1 WHERE id = ?'
            ).run(ticket.id);

            successCount++;
            console.log(`✅ [Sync Manual] Ticket ${ticket.code} sincronizado`);
          } else {
            errorCount++;
            console.warn(`⚠️  [Sync Manual] No se pudo sincronizar ticket ${ticket.code}:`, result.error);
          }
        } catch (error) {
          errorCount++;
          console.error(`❌ [Sync Manual] Error sincronizando ticket ${ticket.code}:`, error.message);
        }
      }

      console.log(`✅ [Sync Manual] Completado: ${successCount} exitosos, ${errorCount} fallidos`);

      return {
        success: true,
        message: `Sincronización completada: ${successCount} exitosos, ${errorCount} fallidos`,
        synced: successCount,
        failed: errorCount
      };

    } catch (error) {
      console.error('❌ [Sync Manual] Error:', error?.message);
      return {
        success: false,
        error: error?.message
      };
    }
  });

  // ============================================
  // HANDLERS DE GESTIÓN DE BASE DE DATOS
  // ============================================

  // Estado de Supabase
  safeIpcHandle('check-supabase-status', async () => {
    try {
      const start = Date.now();
      const connected = supabaseManager && supabaseManager.isAvailable();
      let latency = null;

      if (connected) {
        try {
          // Hacer un query simple para medir latencia
          await supabaseManager.client.from('users').select('count', { count: 'exact', head: true });
          latency = Date.now() - start;
        } catch (e) {
          console.warn('Error midiendo latencia:', e.message);
        }
      }

      return {
        connected,
        url: process.env.SUPABASE_URL ? process.env.SUPABASE_URL.replace(/^https?:\/\//, '').split('.')[0] + '.supabase.co' : '-',
        latency,
        lastSync: new Date().toLocaleString('es-DO', { dateStyle: 'short', timeStyle: 'medium' })
      };
    } catch (error) {
      console.error('Error en check-supabase-status:', error.message);
      return { connected: false, url: '-', latency: null, lastSync: '-' };
    }
  });

  // Estado de SQLite
  safeIpcHandle('check-sqlite-status', async () => {
    try {
      const dbPath = process.env.CASINO_DB_PATH || process.env.SQLITE_DB_PATH || path.join(process.cwd(), 'data', 'casino.db');
      let size = '-';
      let tickets = 0;
      let pending = 0;

      try {
        const stats = fs.statSync(dbPath);
        size = (stats.size / 1024 / 1024).toFixed(2) + ' MB';

        if (db && db.db) {
          const ticketsResult = db.db.prepare('SELECT COUNT(*) as count FROM tickets').get();
          tickets = ticketsResult.count || 0;

          const pendingResult = db.db.prepare('SELECT COUNT(*) as count FROM tickets WHERE sincronizado = 0').get();
          pending = pendingResult.count || 0;
        }
      } catch (e) {
        console.warn('Error obteniendo info de SQLite:', e.message);
      }

      return { path: dbPath, size, tickets, pending };
    } catch (error) {
      console.error('Error en check-sqlite-status:', error.message);
      return { path: '-', size: '-', tickets: 0, pending: 0 };
    }
  });

  // Estadísticas generales de la base de datos
  safeIpcHandle('get-database-stats', async () => {
    try {
      if (!supabaseManager || !supabaseManager.isAvailable()) {
        return { success: false, error: 'Supabase no disponible' };
      }

      const [vouchers, users, operators, logs] = await Promise.all([
        supabaseManager.client.from('vouchers').select('*', { count: 'exact', head: true }),
        supabaseManager.client.from('users').select('*', { count: 'exact', head: true }),
        supabaseManager.client.from('operadores').select('*', { count: 'exact', head: true }),
        supabaseManager.client.from('audit_log').select('*', { count: 'exact', head: true })
      ]);

      return {
        success: true,
        vouchers: vouchers.count || 0,
        users: users.count || 0,
        operators: operators.count || 0,
        logs: logs.count || 0
      };
    } catch (error) {
      console.error('Error en get-database-stats:', error.message);
      return { success: false, error: error.message };
    }
  });

  // Probar conexión a Supabase
  safeIpcHandle('test-supabase-connection', async () => {
    try {
      if (!supabaseManager || !supabaseManager.isAvailable()) {
        return { success: false, error: 'Supabase manager no disponible' };
      }

      const start = Date.now();
      const { data, error } = await supabaseManager.client
        .from('users')
        .select('count', { count: 'exact', head: true })
        .limit(1);

      if (error) {
        return { success: false, error: error.message };
      }

      const latency = Date.now() - start;
      return { success: true, latency };
    } catch (error) {
      console.error('Error probando conexión:', error.message);
      return { success: false, error: error.message };
    }
  });

  // Crear backup de SQLite
  safeIpcHandle('create-backup', async () => {
    try {
      const backupDir = path.join(process.cwd(), 'backups');
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('.')[0];
      const backupPath = path.join(backupDir, `backup_${timestamp}.db`);

      const dbPath = process.env.CASINO_DB_PATH || process.env.SQLITE_DB_PATH || path.join(process.cwd(), 'data', 'casino.db');

      // Copiar archivo
      fs.copyFileSync(dbPath, backupPath);

      // Obtener tamaño
      const stats = fs.statSync(backupPath);
      const size = (stats.size / 1024 / 1024).toFixed(2) + ' MB';

      console.log('✅ Backup creado:', backupPath);
      return { success: true, path: backupPath, size };
    } catch (error) {
      console.error('❌ Error creando backup:', error.message);
      return { success: false, error: error.message };
    }
  });

  // Listar backups disponibles
  safeIpcHandle('list-backups', async () => {
    try {
      const backupDir = path.join(process.cwd(), 'backups');
      if (!fs.existsSync(backupDir)) {
        return { success: true, backups: [] };
      }

      const files = fs.readdirSync(backupDir)
        .filter(f => f.endsWith('.db'))
        .map(f => {
          const fullPath = path.join(backupDir, f);
          const stats = fs.statSync(fullPath);
          return {
            name: f,
            path: fullPath,
            date: stats.mtime.toLocaleString('es-DO', { dateStyle: 'short', timeStyle: 'medium' }),
            size: (stats.size / 1024 / 1024).toFixed(2) + ' MB'
          };
        })
        .sort((a, b) => {
          // Ordenar por fecha (más reciente primero)
          return fs.statSync(b.path).mtime - fs.statSync(a.path).mtime;
        });

      return { success: true, backups: files };
    } catch (error) {
      console.error('❌ Error listando backups:', error.message);
      return { success: false, error: error.message, backups: [] };
    }
  });

  // Seleccionar archivo de backup para restaurar
  safeIpcHandle('select-backup-file', async () => {
    try {
      const { dialog } = require('electron');
      const result = await dialog.showOpenDialog({
        title: 'Seleccionar Backup',
        filters: [
          { name: 'Base de Datos', extensions: ['db', 'sqlite', 'sqlite3'] }
        ],
        properties: ['openFile']
      });

      if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        return { success: false, path: null };
      }

      return { success: true, path: result.filePaths[0] };
    } catch (error) {
      console.error('❌ Error seleccionando archivo:', error.message);
      return { success: false, error: error.message };
    }
  });

  // Restaurar backup
  safeIpcHandle('restore-backup', async (event, backupPath) => {
    try {
      if (!fs.existsSync(backupPath)) {
        return { success: false, error: 'Archivo de backup no existe' };
      }

      const dbPath = process.env.CASINO_DB_PATH || process.env.SQLITE_DB_PATH || path.join(process.cwd(), 'data', 'casino.db');

      // Crear backup de seguridad antes de restaurar
      const safetyBackup = dbPath + '.before-restore.' + Date.now() + '.bak';
      if (fs.existsSync(dbPath)) {
        fs.copyFileSync(dbPath, safetyBackup);
        console.log('📦 Backup de seguridad creado:', safetyBackup);
      }

      // Cerrar conexión actual si existe
      if (db && db.db) {
        try {
          db.db.close();
        } catch (e) {
          console.warn('Error cerrando DB:', e.message);
        }
      }

      // Restaurar backup
      fs.copyFileSync(backupPath, dbPath);
      console.log('✅ Backup restaurado desde:', backupPath);

      // Reinicializar base de datos
      const CasinoDatabase = require(path.join(__dirname, '..', 'Caja', 'database'));
      db = new CasinoDatabase(dbPath);

      return { success: true };
    } catch (error) {
      console.error('❌ Error restaurando backup:', error.message);
      return { success: false, error: error.message };
    }
  });

  // Eliminar backup
  safeIpcHandle('delete-backup', async (event, backupPath) => {
    try {
      if (!fs.existsSync(backupPath)) {
        return { success: false, error: 'Archivo no existe' };
      }

      // Verificar que está en la carpeta de backups (seguridad)
      const backupDir = path.join(process.cwd(), 'backups');
      if (!backupPath.startsWith(backupDir)) {
        return { success: false, error: 'Solo se pueden eliminar archivos de la carpeta backups' };
      }

      fs.unlinkSync(backupPath);
      console.log('🗑️  Backup eliminado:', backupPath);
      return { success: true };
    } catch (error) {
      console.error('❌ Error eliminando backup:', error.message);
      return { success: false, error: error.message };
    }
  });

  // Abrir carpeta de base de datos
  safeIpcHandle('open-database-folder', async () => {
    try {
      const { shell } = require('electron');
      const dbPath = process.env.CASINO_DB_PATH || process.env.SQLITE_DB_PATH || path.join(process.cwd(), 'data', 'casino.db');
      shell.showItemInFolder(dbPath);
      return { success: true };
    } catch (error) {
      console.error('❌ Error abriendo carpeta:', error.message);
      return { success: false, error: error.message };
    }
  });

  // Limpiar caché local (SQLite)
  safeIpcHandle('clear-local-cache', async () => {
    try {
      if (!db || !db.db) {
        return { success: false, error: 'Base de datos no disponible' };
      }

      // Eliminar todos los tickets
      const result = db.db.prepare('DELETE FROM tickets').run();
      console.log(`🧹 Caché limpiado: ${result.changes} tickets eliminados`);

      return { success: true, deleted: result.changes };
    } catch (error) {
      console.error('❌ Error limpiando caché:', error.message);
      return { success: false, error: error.message };
    }
  });

  // Vaciar logs antiguos
  safeIpcHandle('purge-old-logs', async (event, days = 90) => {
    try {
      if (!supabaseManager || !supabaseManager.isAvailable()) {
        return { success: false, error: 'Supabase no disponible' };
      }

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      const cutoffISO = cutoffDate.toISOString();

      console.log(`🗑️  Eliminando logs anteriores a: ${cutoffISO}`);

      // Primero contar cuántos se van a eliminar
      const { count: countBefore } = await supabaseManager.client
        .from('audit_log')
        .select('*', { count: 'exact', head: true })
        .lt('created_at', cutoffISO);

      // Eliminar
      const { error } = await supabaseManager.client
        .from('audit_log')
        .delete()
        .lt('created_at', cutoffISO);

      if (error) {
        throw new Error(error.message);
      }

      console.log(`✅ Eliminados ${countBefore || 0} logs antiguos`);
      return { success: true, deleted: countBefore || 0 };
    } catch (error) {
      console.error('❌ Error purgando logs:', error.message);
      return { success: false, error: error.message };
    }
  });

  // ============================================
  // HANDLERS DE SEGURIDAD
  // ============================================

  // Obtener configuración de seguridad
  safeIpcHandle('security:get-config', async () => {
    try {
      const configPath = path.join(app.getPath('userData'), 'security-config.json');

      if (!fs.existsSync(configPath)) {
        // Retornar configuración por defecto
        return {
          success: true,
          config: {
            password: {
              minLength: 8,
              requireUppercase: true,
              requireNumbers: true,
              requireSpecial: false,
              expirationDays: 90
            },
            session: {
              inactivityTimeout: 30,
              allowMultipleSessions: false,
              logging: true
            },
            login: {
              maxAttempts: 3,
              lockoutMinutes: 15,
              notifyOnBlock: true
            },
            backup: {
              enabled: true,
              frequencyHours: 24,
              keepCount: 30,
              encrypt: true
            },
            audit: {
              level: 'normal',
              retentionDays: 365,
              criticalAlerts: true
            }
          }
        };
      }

      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return { success: true, config };
    } catch (error) {
      console.error('Error cargando security config:', error.message);
      return { success: false, error: error.message };
    }
  });

  // Guardar configuración de seguridad
  safeIpcHandle('security:save-config', async (event, config) => {
    try {
      const configPath = path.join(app.getPath('userData'), 'security-config.json');
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      console.log('✅ Configuración de seguridad guardada');
      return { success: true };
    } catch (error) {
      console.error('Error guardando security config:', error.message);
      return { success: false, error: error.message };
    }
  });

  // Obtener estadísticas de seguridad
  safeIpcHandle('security:get-stats', async () => {
    try {
      return {
        success: true,
        stats: {
          sessions: activeSessions.size,
          blocked: blockedIPs.size,
          failed: securityStats.failedLogins,
          backups: securityStats.totalBackups
        }
      };
    } catch (error) {
      console.error('Error obteniendo stats de seguridad:', error.message);
      return { success: false, error: error.message };
    }
  });

  // Obtener sesiones activas
  safeIpcHandle('security:get-active-sessions', async () => {
    try {
      const sessions = Array.from(activeSessions.values()).map(session => ({
        id: session.sessionId,
        username: session.username,
        email: session.email,
        role: session.role,
        station: session.station,
        loginAt: session.loginAt,
        lastActivity: session.lastActivity
      }));

      return { success: true, sessions };
    } catch (error) {
      console.error('Error obteniendo sesiones activas:', error.message);
      return { success: false, error: error.message };
    }
  });

  // Cerrar sesión
  safeIpcHandle('security:close-session', async (event, sessionId) => {
    try {
      if (!activeSessions.has(sessionId)) {
        return { success: false, error: 'Sesión no encontrada' };
      }

      const session = activeSessions.get(sessionId);
      activeSessions.delete(sessionId);

      // Registrar en audit log
      await registrarAuditLog(
        'session_closed',
        session.userId,
        null,
        null,
        { sessionId, username: session.username, closedBy: 'admin' }
      );

      console.log(`🔓 Sesión cerrada: ${session.username} (${sessionId})`);
      return { success: true };
    } catch (error) {
      console.error('Error cerrando sesión:', error.message);
      return { success: false, error: error.message };
    }
  });

  // Obtener IPs bloqueadas
  safeIpcHandle('security:get-blocked-ips', async () => {
    try {
      const ips = Array.from(blockedIPs.entries()).map(([ip, data]) => ({
        ip,
        blockedAt: data.blockedAt,
        attempts: data.attempts,
        reason: data.reason
      }));

      return { success: true, ips };
    } catch (error) {
      console.error('Error obteniendo IPs bloqueadas:', error.message);
      return { success: false, error: error.message };
    }
  });

  // Desbloquear IP
  safeIpcHandle('security:unblock-ip', async (event, ip) => {
    try {
      if (!blockedIPs.has(ip)) {
        return { success: false, error: 'IP no encontrada en lista de bloqueo' };
      }

      blockedIPs.delete(ip);
      saveBlockedIPs();
      loginAttempts.delete(ip); // También limpiar intentos

      console.log(`🔓 IP desbloqueada: ${ip}`);
      return { success: true };
    } catch (error) {
      console.error('Error desbloqueando IP:', error.message);
      return { success: false, error: error.message };
    }
  });

  // Crear backup manual
  safeIpcHandle('security:create-backup', async () => {
    try {
      const dbPath = process.env.CASINO_DB_PATH || process.env.SQLITE_DB_PATH || path.join(process.cwd(), 'data', 'casino.db');

      if (!fs.existsSync(dbPath)) {
        return { success: false, error: 'Base de datos no encontrada' };
      }

      const backupDir = path.join(process.cwd(), 'backups');
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      const timestamp = Date.now();
      const filename = `manual_backup_${timestamp}.db`;
      const backupPath = path.join(backupDir, filename);

      fs.copyFileSync(dbPath, backupPath);

      // Actualizar estadísticas
      securityStats.totalBackups++;
      securityStats.lastBackup = new Date().toISOString();

      console.log('✅ Backup manual creado:', backupPath);
      return { success: true, filename, path: backupPath };
    } catch (error) {
      console.error('Error creando backup:', error.message);
      return { success: false, error: error.message };
    }
  });

  // Restaurar desde backup
  safeIpcHandle('security:restore-backup', async () => {
    try {
      const { dialog } = require('electron');

      const result = await dialog.showOpenDialog({
        title: 'Seleccionar Backup para Restaurar',
        filters: [
          { name: 'Base de Datos', extensions: ['db', 'sqlite', 'sqlite3'] }
        ],
        properties: ['openFile']
      });

      if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        return { success: false, error: 'Operación cancelada' };
      }

      const backupPath = result.filePaths[0];
      const dbPath = process.env.CASINO_DB_PATH || process.env.SQLITE_DB_PATH || path.join(process.cwd(), 'data', 'casino.db');

      // Crear backup de seguridad antes de restaurar
      const safetyBackup = dbPath + '.before-restore.' + Date.now() + '.bak';
      if (fs.existsSync(dbPath)) {
        fs.copyFileSync(dbPath, safetyBackup);
      }

      // Cerrar conexión actual
      if (db && db.db) {
        try {
          db.db.close();
        } catch (e) {
          console.warn('Error cerrando DB:', e.message);
        }
      }

      // Restaurar
      fs.copyFileSync(backupPath, dbPath);

      // Reinicializar
      const CasinoDatabase = require(path.join(__dirname, '..', 'Caja', 'database'));
      db = new CasinoDatabase(dbPath);

      console.log('✅ Backup restaurado desde:', backupPath);
      return { success: true };
    } catch (error) {
      console.error('Error restaurando backup:', error.message);
      return { success: false, error: error.message };
    }
  });

  // ============================================
  // HANDLERS: Reportes
  // ============================================

  safeIpcHandle('reportes:generate', async (_event, { type, filters }) => {
    try {
      console.log('📊 Generando reporte:', type, filters);

      if (!supabaseManager || !supabaseManager.isAvailable()) {
        return {
          success: false,
          error: 'Sistema de base de datos no disponible'
        };
      }

      const { fechaInicio, fechaFin, moneda, estado } = filters;
      let data = [];
      let summary = null;

      switch (type) {
        case 'stats_by_currency':
          // Usar vista: voucher_stats_by_currency
          const statsQuery = supabaseManager.client.from('voucher_stats_by_currency').select('*');

          if (moneda) {
            statsQuery.eq('currency', moneda);
          }

          const { data: statsData, error: statsError } = await statsQuery;

          if (statsError) throw statsError;
          data = statsData || [];

          // Calcular resumen
          if (data.length > 0) {
            summary = {
              total_vouchers: data.reduce((sum, row) => sum + (row.total_vouchers || 0), 0),
              total_amount: data.reduce((sum, row) => sum + (row.total_amount || 0), 0),
              redeemed_count: data.reduce((sum, row) => sum + (row.redeemed_vouchers || 0), 0),
              active_count: data.reduce((sum, row) => sum + (row.active_vouchers || 0), 0)
            };
          }
          break;

        case 'popular_amounts':
          // Usar vista: popular_voucher_amounts
          const popularQuery = supabaseManager.client.from('popular_voucher_amounts').select('*');

          if (moneda) {
            popularQuery.eq('currency', moneda);
          }

          const { data: popularData, error: popularError } = await popularQuery.limit(50);

          if (popularError) throw popularError;
          data = popularData || [];
          break;

        case 'out_of_range':
          // Usar vista: vouchers_out_of_range
          const outOfRangeQuery = supabaseManager.client.from('vouchers_out_of_range').select('*');

          if (moneda) {
            outOfRangeQuery.eq('currency', moneda);
          }

          if (fechaInicio && fechaFin) {
            outOfRangeQuery.gte('created_at', fechaInicio).lte('created_at', fechaFin);
          }

          const { data: outOfRangeData, error: outOfRangeError } = await outOfRangeQuery;

          if (outOfRangeError) throw outOfRangeError;
          data = outOfRangeData || [];
          break;

        case 'vouchers_detail':
          // Consulta detallada de vouchers
          const vouchersQuery = supabaseManager.client.from('vouchers').select('*');

          if (moneda) {
            vouchersQuery.eq('currency', moneda);
          }

          if (estado) {
            vouchersQuery.eq('status', estado);
          }

          if (fechaInicio && fechaFin) {
            vouchersQuery.gte('created_at', fechaInicio).lte('created_at', fechaFin + 'T23:59:59');
          }

          const { data: vouchersData, error: vouchersError } = await vouchersQuery.order('created_at', { ascending: false }).limit(1000);

          if (vouchersError) throw vouchersError;
          data = vouchersData || [];

          // Calcular resumen
          if (data.length > 0) {
            summary = {
              total_vouchers: data.length,
              total_amount: data.reduce((sum, v) => sum + (parseFloat(v.amount) || 0), 0),
              avg_amount: data.reduce((sum, v) => sum + (parseFloat(v.amount) || 0), 0) / data.length
            };
          }
          break;

        case 'audit_log':
          // Consulta de audit_log
          const auditQuery = supabaseManager.client.from('audit_log').select('*');

          if (fechaInicio && fechaFin) {
            auditQuery.gte('timestamp', fechaInicio).lte('timestamp', fechaFin + 'T23:59:59');
          }

          const { data: auditData, error: auditError } = await auditQuery.order('timestamp', { ascending: false }).limit(1000);

          if (auditError) throw auditError;
          data = auditData || [];
          break;

        case 'daily_summary':
          // Resumen diario - consulta personalizada
          const summaryQuery = supabaseManager.client
            .from('vouchers')
            .select('created_at, status, amount, currency');

          if (fechaInicio && fechaFin) {
            summaryQuery.gte('created_at', fechaInicio).lte('created_at', fechaFin + 'T23:59:59');
          }

          if (moneda) {
            summaryQuery.eq('currency', moneda);
          }

          const { data: summaryData, error: summaryError } = await summaryQuery;

          if (summaryError) throw summaryError;

          // Agrupar por día
          const groupedByDay = {};
          (summaryData || []).forEach(v => {
            const day = v.created_at.split('T')[0];
            if (!groupedByDay[day]) {
              groupedByDay[day] = {
                date: day,
                total: 0,
                active: 0,
                redeemed: 0,
                cancelled: 0,
                expired: 0,
                total_amount: 0
              };
            }
            groupedByDay[day].total++;
            groupedByDay[day][v.status]++;
            groupedByDay[day].total_amount += parseFloat(v.amount) || 0;
          });

          data = Object.values(groupedByDay).sort((a, b) => b.date.localeCompare(a.date));
          break;

        // ============================================
        // NUEVOS REPORTES AVANZADOS (Vistas SQL)
        // ============================================

        case 'daily_summary_advanced':
          // Vista: daily_summary
          const dailySummaryQuery = supabaseManager.client.from('daily_summary').select('*');

          if (fechaInicio && fechaFin) {
            dailySummaryQuery.gte('fecha', fechaInicio).lte('fecha', fechaFin);
          }

          const { data: dailySummaryData, error: dailySummaryError } = await dailySummaryQuery.order('fecha', { ascending: false });

          if (dailySummaryError) throw dailySummaryError;
          data = dailySummaryData || [];
          break;

        case 'reports_by_shift':
          // Vista: voucher_reports_by_shift
          const shiftQuery = supabaseManager.client.from('voucher_reports_by_shift').select('*');

          if (fechaInicio && fechaFin) {
            shiftQuery.gte('fecha', fechaInicio).lte('fecha', fechaFin);
          }

          if (moneda) {
            shiftQuery.eq('currency', moneda);
          }

          const { data: shiftData, error: shiftError } = await shiftQuery.order('fecha', { ascending: false }).order('turno');

          if (shiftError) throw shiftError;
          data = shiftData || [];
          break;

        case 'reports_by_operator':
          // Vista: voucher_reports_by_operator
          const operatorQuery = supabaseManager.client.from('voucher_reports_by_operator').select('*');

          if (fechaInicio && fechaFin) {
            operatorQuery.gte('fecha', fechaInicio).lte('fecha', fechaFin);
          }

          if (moneda) {
            operatorQuery.eq('currency', moneda);
          }

          const { data: operatorData, error: operatorError } = await operatorQuery.order('fecha', { ascending: false }).order('monto_total', { ascending: false });

          if (operatorError) throw operatorError;
          data = operatorData || [];
          break;

        case 'reports_by_station':
          // Vista: voucher_reports_by_station
          const stationQuery = supabaseManager.client.from('voucher_reports_by_station').select('*');

          if (fechaInicio && fechaFin) {
            stationQuery.gte('fecha', fechaInicio).lte('fecha', fechaFin);
          }

          const { data: stationData, error: stationError } = await stationQuery.order('fecha', { ascending: false }).order('total_vouchers', { ascending: false });

          if (stationError) throw stationError;
          data = stationData || [];
          break;

        case 'top_operators':
          // Vista: top_operators_performance
          const topOperatorsQuery = supabaseManager.client.from('top_operators_performance').select('*');

          const { data: topOperatorsData, error: topOperatorsError } = await topOperatorsQuery.limit(50);

          if (topOperatorsError) throw topOperatorsError;
          data = topOperatorsData || [];
          break;

        case 'mesa_ranking':
          // Vista: mesa_productivity_ranking
          const mesaRankingQuery = supabaseManager.client.from('mesa_productivity_ranking').select('*');

          const { data: mesaRankingData, error: mesaRankingError } = await mesaRankingQuery;

          if (mesaRankingError) throw mesaRankingError;
          data = mesaRankingData || [];
          break;

        case 'anomalies':
          // Vista: voucher_anomalies
          const anomaliesQuery = supabaseManager.client.from('voucher_anomalies').select('*');

          if (fechaInicio && fechaFin) {
            anomaliesQuery.gte('issued_at', fechaInicio).lte('issued_at', fechaFin + 'T23:59:59');
          }

          const { data: anomaliesData, error: anomaliesError } = await anomaliesQuery.order('severidad', { ascending: false }).order('issued_at', { ascending: false });

          if (anomaliesError) throw anomaliesError;
          data = anomaliesData || [];
          break;

        default:
          throw new Error('Tipo de reporte no soportado: ' + type);
      }

      console.log(`✅ Reporte generado: ${data.length} registros`);

      return {
        success: true,
        data,
        summary
      };

    } catch (error) {
      console.error('❌ Error generando reporte:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  safeIpcHandle('reportes:export', async (event, { type, format, data }) => {
    try {
      console.log(`📤 Exportando reporte a ${format}:`, type);

      if (!data || data.length === 0) {
        return {
          success: false,
          error: 'No hay datos para exportar'
        };
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const defaultFilename = `reporte_${type}_${timestamp}`;
      const extension = format === 'excel' ? 'xlsx' : 'pdf';

      // Mostrar diálogo para elegir ubicación
      const win = BrowserWindow.fromWebContents(event.sender);
      const { filePath: selectedPath } = await dialog.showSaveDialog(win, {
        title: `Guardar reporte como ${format.toUpperCase()}`,
        defaultPath: path.join(app.getPath('downloads'), `${defaultFilename}.${extension}`),
        filters: [
          { name: format === 'excel' ? 'Excel Files' : 'PDF Files', extensions: [extension] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      if (!selectedPath) {
        return {
          success: false,
          error: 'Exportación cancelada por el usuario'
        };
      }

      if (format === 'excel') {
        // Exportar a Excel usando exceljs
        const ExcelJS = require('exceljs');
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Reporte');

        // Metadata
        workbook.creator = 'Sistema TITO Casino';
        workbook.created = new Date();
        workbook.modified = new Date();

        // Headers
        const headers = Object.keys(data[0]);
        worksheet.columns = headers.map(key => ({
          header: formatHeaderForExport(key),
          key: key,
          width: 15
        }));

        // Estilo de headers
        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        worksheet.getRow(1).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF667eea' }
        };

        // Datos
        data.forEach(row => {
          worksheet.addRow(row);
        });

        // Auto-filtro
        worksheet.autoFilter = {
          from: 'A1',
          to: String.fromCharCode(64 + headers.length) + '1'
        };

        // Guardar en la ruta seleccionada
        await workbook.xlsx.writeFile(selectedPath);

        console.log('✅ Excel exportado:', selectedPath);
        return { success: true, path: selectedPath };

      } else if (format === 'pdf') {
        // Exportar a PDF usando PDFKit
        const PDFDocument = require('pdfkit');

        const doc = new PDFDocument({ margin: 50, size: 'A4', layout: 'landscape' });
        const stream = fs.createWriteStream(selectedPath);
        doc.pipe(stream);

        // Header
        doc.fontSize(18).text('Sistema TITO Casino', { align: 'center' });
        doc.fontSize(14).text(`Reporte: ${formatReportType(type)}`, { align: 'center' });
        doc.fontSize(10).text(`Generado: ${new Date().toLocaleString('es-DO')}`, { align: 'center' });
        doc.moveDown(2);

        // Tabla
        const headers = Object.keys(data[0]);
        const tableTop = doc.y;
        const columnWidth = (doc.page.width - 100) / headers.length;

        // Headers
        doc.fontSize(9).font('Helvetica-Bold');
        headers.forEach((header, i) => {
          doc.text(
            formatHeaderForExport(header),
            50 + (i * columnWidth),
            tableTop,
            { width: columnWidth, align: 'left' }
          );
        });

        doc.moveDown(0.5);
        doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();
        doc.moveDown(0.5);

        // Datos (limitar a 50 registros para PDF)
        doc.font('Helvetica');
        const maxRows = Math.min(data.length, 50);
        for (let i = 0; i < maxRows; i++) {
          const row = data[i];
          const rowY = doc.y;

          // Verificar si necesitamos nueva página
          if (rowY > doc.page.height - 100) {
            doc.addPage();
            doc.y = 50;
          }

          headers.forEach((header, j) => {
            let value = row[header];
            if (value === null || value === undefined) value = '-';
            if (typeof value === 'number') value = value.toFixed(2);
            if (typeof value === 'object') value = JSON.stringify(value);

            doc.text(
              String(value).substring(0, 30),
              50 + (j * columnWidth),
              doc.y,
              { width: columnWidth, align: 'left' }
            );
          });

          doc.moveDown(0.8);
        }

        if (data.length > maxRows) {
          doc.moveDown();
          doc.fontSize(8).text(
            `Nota: Se muestran solo los primeros ${maxRows} registros de ${data.length} totales.`,
            { align: 'center', oblique: true }
          );
        }

        doc.end();

        // Esperar a que termine de escribir
        await new Promise((resolve, reject) => {
          stream.on('finish', resolve);
          stream.on('error', reject);
        });

        console.log('✅ PDF exportado:', selectedPath);
        return { success: true, path: selectedPath };

      } else {
        throw new Error('Formato no soportado: ' + format);
      }

    } catch (error) {
      console.error('❌ Error exportando reporte:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // Helper: Formatear headers para exportación
  function formatHeaderForExport(key) {
    const translations = {
      currency: 'Moneda',
      total_vouchers: 'Total Vouchers',
      active_vouchers: 'Activos',
      redeemed_vouchers: 'Canjeados',
      cancelled_vouchers: 'Cancelados',
      expired_vouchers: 'Expirados',
      min_amount: 'Mínimo',
      max_amount: 'Máximo',
      avg_amount: 'Promedio',
      total_amount: 'Monto Total',
      active_amount: 'Monto Activo',
      redeemed_amount: 'Monto Canjeado',
      redemption_rate_pct: 'Tasa Canje %',
      amount_redeemed_pct: 'Monto Canjeado %',
      amount: 'Monto',
      usage_count: 'Cantidad Usada',
      active_count: 'Activos',
      redeemed_count: 'Canjeados',
      voucher_code: 'Código',
      status: 'Estado',
      created_at: 'Creado',
      issue: 'Problema',
      action: 'Acción',
      details: 'Detalles',
      timestamp: 'Fecha/Hora',
      date: 'Fecha'
    };
    return translations[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  // Helper: Formatear tipo de reporte
  function formatReportType(type) {
    const types = {
      stats_by_currency: 'Estadísticas por Moneda',
      popular_amounts: 'Montos Más Populares',
      out_of_range: 'Vouchers Fuera de Rango',
      vouchers_detail: 'Detalle de Vouchers',
      audit_log: 'Registro de Auditoría',
      daily_summary: 'Resumen Diario'
    };
    return types[type] || type;
  }

  if (VERBOSE) console.log('✅ Handlers de reportes registrados');
  if (VERBOSE) console.log('✅ Handlers de seguridad registrados');
  if (VERBOSE) console.log('✅ Handlers de gestión de base de datos registrados');
  if (VERBOSE) console.log('✅ Handlers auth/rol/stats registrados');
  if (VERBOSE) console.log('✅ Handlers vouchers básicos registrados (generate/validate/redeem/stats + sync)');
  if (VERBOSE) console.log('✅ Handler health-check registrado');
  if (VERBOSE) console.log('✅ Handlers sync registrados (get-pending-count, force-sync)');

  // ============================================
  // HANDLERS: PDF Viewer
  // ============================================
  console.log('📝 Registrando handlers de PDF Viewer...');

  // Handler: Guardar PDF temporal
  safeIpcHandle('save-temp-pdf', async (_event, pdfBytes) => {
    try {
      const tempDir = app.getPath('temp');
      const tempPath = path.join(tempDir, );

      // Convertir ArrayBuffer a Buffer
      const buffer = Buffer.from(pdfBytes);
      fs.writeFileSync(tempPath, buffer);

      console.log('✅ PDF temporal guardado:', tempPath);
      return { success: true, path: tempPath };
    } catch (error) {
      console.error('❌ Error guardando PDF temporal:', error);
      return { success: false, error: error.message };
    }
  });

  // Handler: Abrir PDF en ventana dedicada
  safeIpcHandle('open-pdf-viewer', async (_event, pdfPath) => {
    try {
      console.log('📄 Abriendo PDF en ventana dedicada:', pdfPath);

      const pdfWindow = new BrowserWindow({
        width: 1000,
        height: 800,
        title: 'Visor PDF - Sistema TITO',
        webPreferences: {
          plugins: true,
          nodeIntegration: false,
          contextIsolation: true
        },
        backgroundColor: '#1f2937'
      });

      // Cargar PDF directamente
      pdfWindow.loadURL('file:///' + pdfPath.replace(/\\/g, '/'));

      // Quitar menú
      pdfWindow.setMenu(null);

      console.log('✅ Ventana PDF abierta');
      return { success: true };
    } catch (error) {
      console.error('❌ Error abriendo ventana PDF:', error);
      return { success: false, error: error.message };
    }
  });

  if (VERBOSE) console.log('✅ Handlers de PDF Viewer registrados');

} catch (e) {
  console.warn('No se pudieron registrar handlers de auth/rol/stats:', e.message);
}
} // FIN de registerAllHandlers()

// (preloadPath definido al inicio del archivo)

// Servicios opcionales existentes (impresora, DB, IPC)
let registerIpcHandlers;
try {
  registerIpcHandlers = require(path.join(__dirname, '..', 'src', 'main', 'ipc'));
} catch (e) {
  console.warn('No se pudo cargar registerIpcHandlers, los handlers por IPC nativos no estarán disponibles:', e.message);
}

// Instanciar servicio de impresora para los handlers mínimos (sin usar app.getPath todavía)
let printer;
let PrinterService;
try {
  PrinterService = require(path.join(__dirname, '..', 'src', 'main', 'hardware', 'printer'));
  // NO instanciar printer aquí porque requiere app.getPath
  // Se inicializará dentro de app.whenReady()
} catch (e) {
  console.warn('No se pudo cargar PrinterService:', e.message);
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

// ============================================
// WORKER DE SINCRONIZACIÓN AUTOMÁTICA
// ============================================
let syncWorkerInterval = null;
let syncWorkerRunning = false; // ⚠️ FIX: Flag para evitar ejecuciones simultáneas

function startSyncWorker() {
  console.log('🔄 Iniciando worker de sincronización...');

  // Ejecutar cada 2 minutos
  syncWorkerInterval = setInterval(async () => {
    // ⚠️ FIX: Skip si ya hay una sincronización en progreso
    if (syncWorkerRunning) {
      console.log('⏭️  [Sync Worker] Skip: sincronización anterior aún en progreso');
      return;
    }

    // Skip si no hay conexión
    if (!supabaseManager || !supabaseManager.isAvailable() || !supabaseManager.isConnected) {
      return;
    }

    // Skip si no hay base de datos local
    if (!db || !db.db) {
      return;
    }

    // ⚠️ FIX: Marcar como en progreso al inicio
    syncWorkerRunning = true;

    try {
      let totalSynced = 0;
      let totalErrors = 0;

      // ============================================
      // 1. SINCRONIZAR TICKETS (EN LOTES)
      // ============================================
      const BATCH_SIZE = 100; // Procesar 100 tickets por ciclo

      const pendingTickets = db.db.prepare(
        'SELECT * FROM tickets WHERE sincronizado = 0 ORDER BY fecha_emision ASC LIMIT ?'
      ).all(BATCH_SIZE);

      if (pendingTickets.length > 0) {
        // Contar total pendientes para mostrar progreso
        const totalPending = db.db.prepare('SELECT COUNT(*) as count FROM tickets WHERE sincronizado = 0').get();
        console.log(`🔄 [Sync Worker] Sincronizando ${pendingTickets.length} de ${totalPending.count} tickets pendientes (lote de ${BATCH_SIZE})...`);

        let successCount = 0;
        let errorCount = 0;

      for (const ticket of pendingTickets) {
        try {
          // Obtener datos del usuario actual si existe
          const userId = currentSession?.user?.id || null;

          // Convertir mesa de TEXT a INTEGER para Supabase
          const mesaStr = ticket.mesa || ticket.mesa_nombre || '';
          const mesaNum = parseInt(String(mesaStr).replace(/\D/g, ''));

          // ⚠️ FIX: Timeout de 10 segundos por ticket para evitar bloqueos
          const createVoucherPromise = supabaseManager.createVoucher({
            voucher_code: ticket.code,
            amount: ticket.amount,
            currency: ticket.currency || 'USD',
            issued_by_user_id: userId,
            issued_at_station_id: mesaNum || null,
            status: ticket.estado === 'active' ? 'active' : 'redeemed',
            created_at: ticket.fecha_emision,
            redeemed_at: ticket.fecha_cobro || null,
            redeemed_by_user_id: ticket.cajero_id || null
          });

          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout sincronizando ticket (10s)')), 10000)
          );

          // Subir a Supabase con timeout
          const result = await Promise.race([createVoucherPromise, timeoutPromise]);

          if (result.success) {
            // Marcar como sincronizado
            db.db.prepare(
              'UPDATE tickets SET sincronizado = 1 WHERE id = ?'
            ).run(ticket.id);

            successCount++;
            console.log(`✅ [Sync Worker] Ticket ${ticket.code} sincronizado`);
          } else {
            errorCount++;
            console.warn(`⚠️  [Sync Worker] No se pudo sincronizar ticket ${ticket.code}:`, result.error);
          }
        } catch (error) {
          errorCount++;
          console.error(`❌ [Sync Worker] Error sincronizando ticket ${ticket.code}:`, error.message);
        }
      }

        // Calcular cuántos quedan después de este lote
        const remainingAfterBatch = totalPending.count - successCount;
        const progress = totalPending.count > 0 ? ((successCount / totalPending.count) * 100).toFixed(1) : 0;

        console.log(`✅ [Sync Worker - Tickets] ${successCount} exitosos, ${errorCount} fallidos`);
        console.log(`📊 [Sync Worker - Tickets] Progreso: ${successCount}/${totalPending.count} (${progress}%) - Quedan ${remainingAfterBatch} pendientes`);

        totalSynced += successCount;
        totalErrors += errorCount;

        // Notificar a ventanas abiertas si hubo sincronizaciones
        if (successCount > 0 && mainWindow) {
          mainWindow.webContents.send('tickets-synced', { count: successCount });
        }
      }

      // ============================================
      // 2. SINCRONIZAR USUARIOS
      // ============================================
      try {
        const pendingUsuarios = db.db.prepare(
          'SELECT * FROM usuarios WHERE sincronizado = 0'
        ).all();

        if (pendingUsuarios.length > 0) {
          console.log(`🔄 [Sync Worker] Sincronizando ${pendingUsuarios.length} usuarios pendientes...`);

          let userSuccessCount = 0;
          let userErrorCount = 0;

          for (const usuario of pendingUsuarios) {
            try {
              // ⚠️ FIX: Validar email antes de intentar sincronizar
              const emailToUse = usuario.email || `${usuario.username}@local.casino`;

              // Skip usuarios con emails inválidos (ej: admin@local)
              const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
              if (!emailRegex.test(emailToUse)) {
                console.warn(`⚠️ [Sync Worker] Usuario ${usuario.username} tiene email inválido (${emailToUse}), marcando como sincronizado para evitar reintentos`);
                db.db.prepare('UPDATE usuarios SET sincronizado = 1 WHERE id = ?').run(usuario.id);
                userSuccessCount++;
                continue;
              }

              // Crear usuario en Supabase Auth
              const { data: authData, error: authError } = await supabaseManager.client.auth.admin.createUser({
                email: emailToUse,
                password: Math.random().toString(36).slice(-12), // Password temporal
                email_confirm: true,
                user_metadata: {
                  username: usuario.username,
                  synced_from_sqlite: true
                }
              });

              if (authError) {
                // Si ya existe, intentar obtenerlo
                if (authError.message.includes('already registered')) {
                  const { data: existingUsers } = await supabaseManager.client.auth.admin.listUsers();
                  const existing = existingUsers.users.find(u => u.email === emailToUse);

                  if (existing) {
                    // Usuario ya existe, crear/actualizar perfil
                    await supabaseManager.client
                      .from('users')
                      .upsert({
                        id: existing.id,
                        email: existing.email,
                        full_name: usuario.username,
                        role: usuario.role.toLowerCase(),
                        is_active: usuario.activo === 1
                      });

                    db.db.prepare('UPDATE usuarios SET sincronizado = 1 WHERE id = ?').run(usuario.id);
                    userSuccessCount++;
                    console.log(`✅ [Sync Worker] Usuario ${usuario.username} actualizado (ya existía)`);
                  } else {
                    throw authError;
                  }
                } else {
                  throw authError;
                }
              } else {
                // Crear perfil en tabla users
                await supabaseManager.client
                  .from('users')
                  .upsert({
                    id: authData.user.id,
                    email: authData.user.email,
                    full_name: usuario.username,
                    role: usuario.role.toLowerCase(),
                    is_active: usuario.activo === 1
                  });

                // Marcar como sincronizado
                db.db.prepare('UPDATE usuarios SET sincronizado = 1 WHERE id = ?').run(usuario.id);
                userSuccessCount++;
                console.log(`✅ [Sync Worker] Usuario ${usuario.username} sincronizado`);
              }
            } catch (error) {
              userErrorCount++;
              console.error(`❌ [Sync Worker] Error sincronizando usuario ${usuario.username}:`, error.message);
            }
          }

          console.log(`✅ [Sync Worker - Usuarios] ${userSuccessCount} exitosos, ${userErrorCount} fallidos`);
          totalSynced += userSuccessCount;
          totalErrors += userErrorCount;
        }
      } catch (error) {
        console.error('❌ [Sync Worker] Error en sincronización de usuarios:', error.message);
      }

      // ============================================
      // 3. SINCRONIZAR OPERADORES
      // ============================================
      try {
        const pendingOperadores = db.db.prepare(
          'SELECT * FROM operadores WHERE sincronizado = 0'
        ).all();

        if (pendingOperadores.length > 0) {
          console.log(`🔄 [Sync Worker] Sincronizando ${pendingOperadores.length} operadores pendientes...`);

          let opSuccessCount = 0;
          let opErrorCount = 0;

          for (const operador of pendingOperadores) {
            try {
              // Verificar si ya existe en Supabase
              const { data: existing } = await supabaseManager.client
                .from('operadores')
                .select('id')
                .eq('codigo', operador.codigo)
                .single();

              if (existing) {
                // Ya existe, actualizar
                await supabaseManager.client
                  .from('operadores')
                  .update({
                    nombre: operador.nombre,
                    activo: operador.activo === 1,
                    pin: operador.pin
                  })
                  .eq('codigo', operador.codigo);
              } else {
                // No existe, crear
                await supabaseManager.client
                  .from('operadores')
                  .insert({
                    codigo: operador.codigo,
                    nombre: operador.nombre,
                    activo: operador.activo === 1,
                    pin: operador.pin,
                    mesa_asignada: operador.mesa_asignada
                  });
              }

              // Marcar como sincronizado
              db.db.prepare('UPDATE operadores SET sincronizado = 1 WHERE id = ?').run(operador.id);
              opSuccessCount++;
              console.log(`✅ [Sync Worker] Operador ${operador.codigo} sincronizado`);
            } catch (error) {
              opErrorCount++;
              console.error(`❌ [Sync Worker] Error sincronizando operador ${operador.codigo}:`, error.message);
            }
          }

          console.log(`✅ [Sync Worker - Operadores] ${opSuccessCount} exitosos, ${opErrorCount} fallidos`);
          totalSynced += opSuccessCount;
          totalErrors += opErrorCount;
        }
      } catch (error) {
        console.error('❌ [Sync Worker] Error en sincronización de operadores:', error.message);
      }

      // ============================================
      // 4. DESCARGA PERIÓDICA (Supabase → SQLite)
      // ============================================
      // CRÍTICO: Permite sincronización entre PCs
      // - PC1 crea ticket → Supabase
      // - PC2 descarga ticket desde Supabase → SQLite local
      // - Ahora PC2 puede cobrar ese ticket
      try {
        console.log('🔄 [Sync Worker] Descargando tickets nuevos desde Supabase...');

        // Obtener último ID descargado (evitar duplicados)
        const lastDownloaded = db.db.prepare(
          'SELECT MAX(id) as max_id FROM tickets WHERE sincronizado = 1'
        ).get();

        const lastId = lastDownloaded?.max_id || 0;

        // Descargar tickets nuevos desde Supabase
        const { data: newTickets, error: downloadError } = await supabaseManager.client
          .from('tickets')
          .select('*')
          .gt('id', lastId)
          .order('id', { ascending: true })
          .limit(50); // Máximo 50 por iteración para evitar sobrecarga

        if (downloadError) {
          console.warn('⚠️  [Sync Worker] Error descargando tickets:', downloadError.message);
        } else if (newTickets && newTickets.length > 0) {
          console.log(`📥 [Sync Worker] Descargando ${newTickets.length} tickets nuevos...`);

          let downloadSuccessCount = 0;
          let downloadErrorCount = 0;

          for (const ticket of newTickets) {
            try {
              // Verificar si ya existe en SQLite (por código único)
              const existing = db.db.prepare(
                'SELECT id FROM tickets WHERE code = ?'
              ).get(ticket.code);

              if (existing) {
                // Ya existe, actualizar estado si cambió
                if (ticket.redeemed && ticket.redeemed_at) {
                  db.db.prepare(`
                    UPDATE tickets
                    SET redeemed = 1,
                        fecha_cobro = ?,
                        cajero_id = ?,
                        sincronizado = 1
                    WHERE code = ?
                  `).run(ticket.redeemed_at, ticket.redeemed_by_user_id, ticket.code);

                  console.log(`✅ [Sync Worker] Ticket ${ticket.code} actualizado (cobrado)`);
                }
              } else {
                // No existe, insertar en SQLite
                db.db.prepare(`
                  INSERT INTO tickets (
                    code, hash_seguridad, table_number, amount, currency,
                    fecha_emision, operador_codigo, operador_nombre,
                    redeemed, fecha_cobro, cajero_id, sincronizado
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
                `).run(
                  ticket.code,
                  ticket.hash_seguridad || '',
                  ticket.table_number,
                  ticket.amount,
                  ticket.currency,
                  ticket.created_at,
                  ticket.operador_codigo || '',
                  ticket.operador_nombre || '',
                  ticket.redeemed ? 1 : 0,
                  ticket.redeemed_at || null,
                  ticket.redeemed_by_user_id || null
                );

                downloadSuccessCount++;
                console.log(`✅ [Sync Worker] Ticket ${ticket.code} descargado a SQLite`);
              }
            } catch (error) {
              downloadErrorCount++;
              console.error(`❌ [Sync Worker] Error descargando ticket ${ticket.code}:`, error.message);
            }
          }

          console.log(`📥 [Sync Worker - Descarga] ${downloadSuccessCount} nuevos, ${downloadErrorCount} fallidos`);
          totalSynced += downloadSuccessCount;
          totalErrors += downloadErrorCount;

          // Notificar a ventanas si hubo descargas
          if (downloadSuccessCount > 0 && mainWindow) {
            mainWindow.webContents.send('tickets-downloaded', { count: downloadSuccessCount });
          }
        }
      } catch (error) {
        console.error('❌ [Sync Worker] Error en descarga periódica:', error.message);
      }

      // ============================================
      // RESUMEN GENERAL
      // ============================================
      if (totalSynced > 0 || totalErrors > 0) {
        console.log(`✅ [Sync Worker] RESUMEN TOTAL: ${totalSynced} sincronizados, ${totalErrors} fallidos`);
      }

    } catch (error) {
      console.error('❌ [Sync Worker] Error crítico en worker de sincronización:', error.message);
    } finally {
      // ⚠️ FIX: Siempre liberar el flag, incluso si hubo error
      syncWorkerRunning = false;
    }
  }, 2 * 60 * 1000); // 2 minutos

  console.log('✅ Worker de sincronización iniciado (intervalo: 2 minutos)');
}

function stopSyncWorker() {
  if (syncWorkerInterval) {
    clearInterval(syncWorkerInterval);
    syncWorkerInterval = null;
    console.log('🛑 Worker de sincronización detenido');
  }
}

async function createWindow() {
  console.log('  → Creando BrowserWindow...');
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: true,
  });
  mainWindow = win;

  // Iniciar directamente en el Panel principal como antes
  console.log('  → Cargando panel.html...');
  try {
    const panelPath = path.join(__dirname, '..', 'Caja', 'panel.html');
    await win.loadFile(panelPath);
    console.log('  → Panel cargado exitosamente');
  } catch (error) {
    console.error('  ❌ Error cargando panel:', error.message);
  }
}

app.whenReady().then(async () => {
  // Inicializar Health Monitor (primero, para monitorear todo)
  try {
    healthMonitor = getHealthMonitor();
    console.log('✅ Health Monitor inicializado');

    // Escuchar eventos de timeout y hangs
    healthMonitor.on('timeout', (info) => {
      console.error('🚨 [Health] TIMEOUT DETECTADO:', info);
    });

    healthMonitor.on('hang-detected', (hangs) => {
      console.error('🚨 [Health] CUELGUES DETECTADOS:', hangs);
    });
  } catch (e) {
    console.error('❌ No se pudo inicializar Health Monitor:', e.message);
  }

  // Inicializar Safe Operations wrappers
  if (db && healthMonitor) {
    safeDb = new SafeDatabaseOperations(db, healthMonitor);
    console.log('✅ Safe Database Operations inicializado');
  }

  // Inicializar Supabase Manager (después de app.whenReady() para evitar errores)
  try {
    supabaseManager = getSupabaseManager();
    console.log('⚡ Supabase Manager inicializado (verificando conexión en segundo plano...)');

    // Inicializar Safe Supabase Operations
    if (supabaseManager && healthMonitor) {
      safeSupabase = new SafeSupabaseOperations(supabaseManager, healthMonitor);
      console.log('✅ Safe Supabase Operations inicializado');
    }

    // ⚡ LAZY: Verificar conexión DESPUÉS de abrir ventana (ahorra ~890ms)
    setImmediate(async () => {
      try {
        const connected = await supabaseManager.testConnection();
        if (connected) {
          console.log('✅ Supabase conectado');
        } else {
          console.warn('⚠️  Supabase sin conexión (modo offline)');
        }
      } catch (e) {
        console.error('❌ Error conectando Supabase:', e.message);
      }
    });
  } catch (e) {
    console.warn('⚠️  No se pudo inicializar Supabase Manager:', e.message);
  }

  // Inicializar Printer Service (ahora que app.getPath está disponible)
  try {
    if (PrinterService) {
      printer = new PrinterService();
      // Aplicar perfil persistido si existe
      const profilePath = path.join(app.getPath('userData'), 'printerProfile.json');
      if (fs.existsSync(profilePath)) {
        const raw = fs.readFileSync(profilePath, 'utf8');
        const saved = JSON.parse(raw);
        printer.setProfile?.(saved);
      }
      console.log('✅ Printer Service inicializado');
    }
  } catch (e) {
    console.warn('⚠️  No se pudo inicializar Printer Service:', e.message);
  }

  // 🔒 Inicializar Sistema de Seguridad
  try {
    console.log('🔒 Inicializando sistema de seguridad...');

    // Cargar IPs bloqueadas desde archivo persistido
    loadBlockedIPs();

    // Iniciar sistema de backup automático
    startAutomaticBackup();

    console.log('✅ Sistema de seguridad inicializado');
  } catch (e) {
    console.warn('⚠️  Error inicializando sistema de seguridad:', e.message);
  }

  // ⚡ FIX DEADLOCK: Registrar TODOS los handlers ANTES de crear ventana
  // (panel.html necesita estos handlers para cargar correctamente)
  console.log('📝 Registrando todos los handlers IPC...');
  try {
    registerAllHandlers();
    console.log('✅ Todos los handlers IPC registrados');
  } catch (e) {
    console.error('❌ Error registrando handlers IPC:', e.message);
  }

  console.log('📝 Registrando handlers de Caja...');
  try {
    const { registerCajaHandlers } = require('../Caja/cajaHandlers');
    registerCajaHandlers();
    console.log('✅ Handlers de Caja registrados');
  } catch (e) {
    console.warn('⚠️  Error registrando handlers de Caja:', e.message);
  }

  // HANDLERS DUPLICADOS COMENTADOS - Los handlers generate-ticket, validate-voucher, redeem-voucher
  // están definidos arriba con integración de Supabase. No registramos los handlers de src/main/ipc/
  // para evitar sobrescribir los handlers que ya tienen Supabase integrado.

  // Registrar handlers de impresora (con timeout)
  console.log('📝 Registrando handlers de impresora...');
  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout registrando handlers de impresora')), 3000)
    );

    await Promise.race([
      tryRegisterPrinterOnly(),
      timeoutPromise
    ]);
    console.log('✅ Handlers de impresora registrados');
  } catch (e) {
    console.warn('⚠️  Fallo al registrar handlers IPC (continuando):', e.message);
  }

  // Iniciar worker de sincronización automática
  console.log('🔄 Iniciando worker de sincronización...');
  startSyncWorker();
  console.log('✅ Worker de sincronización iniciado');

  // (Autorun reset de PINs eliminado tras validación del login)

  console.log('🪟 Creando ventana principal...');
  await createWindow();
  console.log('✅ Aplicación lista');

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  // Detener worker de sincronización al cerrar
  stopSyncWorker();

  // 🔒 Limpiar sistema de seguridad
  if (backupInterval) {
    clearInterval(backupInterval);
    console.log('🔒 Backup automático detenido');
  }

  // Persistir IPs bloqueadas antes de salir
  saveBlockedIPs();
});
