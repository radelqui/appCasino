#!/usr/bin/env node
/**
 * FIX CRÍTICO: Actualizar constraint de audit_log
 *
 * Problema: La tabla audit_log tiene un CHECK constraint que solo permite
 * 7 acciones, pero el código intenta usar 13 acciones diferentes.
 *
 * Solución: Recrear la tabla con el constraint actualizado.
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Buscar la base de datos en el directorio de usuario de Electron
const possiblePaths = [
  path.join(process.env.APPDATA || '', 'appCasino', 'database.db'),
  path.join(__dirname, 'database.db'),
  path.join(__dirname, 'data', 'database.db')
];

let dbPath = null;
for (const p of possiblePaths) {
  if (fs.existsSync(p)) {
    dbPath = p;
    break;
  }
}

if (!dbPath) {
  console.error('❌ No se encontró database.db en las rutas esperadas:');
  possiblePaths.forEach(p => console.error(`   - ${p}`));
  console.log('\n💡 Ejecuta la app primero para crear la base de datos, luego ejecuta este script.');
  process.exit(1);
}

console.log(`🔍 Base de datos encontrada: ${dbPath}\n`);

// Backup antes de modificar
const backupPath = dbPath + '.backup-' + Date.now();
fs.copyFileSync(dbPath, backupPath);
console.log(`✅ Backup creado: ${backupPath}\n`);

const db = new Database(dbPath);

try {
  console.log('🔧 Iniciando migración de audit_log...\n');

  // PASO 1: Verificar estructura actual
  const currentSchema = db.prepare(`
    SELECT sql FROM sqlite_master
    WHERE type='table' AND name='audit_log'
  `).get();

  console.log('📋 Esquema actual:');
  console.log(currentSchema?.sql || 'TABLA NO EXISTE');
  console.log();

  // PASO 2: Contar registros actuales
  const count = db.prepare('SELECT COUNT(*) as count FROM audit_log').get();
  console.log(`📊 Registros actuales en audit_log: ${count.count}\n`);

  // PASO 3: Crear tabla temporal con nuevo constraint
  db.exec(`
    BEGIN TRANSACTION;

    -- Crear tabla temporal con constraint correcto
    CREATE TABLE audit_log_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL CHECK(action IN (
        'voucher_created',
        'voucher_issued',
        'voucher_redeemed',
        'voucher_cancelled',
        'voucher_expired',
        'user_login',
        'user_logout',
        'user_created',
        'user_updated',
        'operator_created',
        'operator_updated',
        'session_closed',
        'config_changed'
      )),
      user_id TEXT,
      user_role TEXT,
      station_id INTEGER,
      voucher_id TEXT,
      details TEXT,
      ip_address TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (station_id) REFERENCES stations(id)
    );

    -- Copiar datos existentes
    INSERT INTO audit_log_new
    SELECT * FROM audit_log;

    -- Eliminar tabla antigua
    DROP TABLE audit_log;

    -- Renombrar tabla nueva
    ALTER TABLE audit_log_new RENAME TO audit_log;

    -- Recrear índices
    CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);
    CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_voucher ON audit_log(voucher_id);
    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);

    COMMIT;
  `);

  console.log('✅ Migración completada exitosamente!\n');

  // PASO 4: Verificar nuevo esquema
  const newSchema = db.prepare(`
    SELECT sql FROM sqlite_master
    WHERE type='table' AND name='audit_log'
  `).get();

  console.log('📋 Nuevo esquema:');
  console.log(newSchema.sql);
  console.log();

  // PASO 5: Verificar que los datos se copiaron
  const newCount = db.prepare('SELECT COUNT(*) as count FROM audit_log').get();
  console.log(`📊 Registros después de migración: ${newCount.count}\n`);

  if (count.count === newCount.count) {
    console.log('✅ Todos los registros se conservaron correctamente\n');
  } else {
    console.error(`⚠️  ADVERTENCIA: Diferencia de registros (antes: ${count.count}, después: ${newCount.count})\n`);
  }

  // PASO 6: Verificar acciones permitidas
  console.log('🎯 Acciones permitidas ahora:');
  const allowedActions = [
    'voucher_created', 'voucher_issued', 'voucher_redeemed',
    'voucher_cancelled', 'voucher_expired', 'user_login',
    'user_logout', 'user_created', 'user_updated',
    'operator_created', 'operator_updated', 'session_closed',
    'config_changed'
  ];
  allowedActions.forEach(action => console.log(`   ✅ ${action}`));
  console.log();

  console.log('═══════════════════════════════════════════════════════════');
  console.log('✅ FIX COMPLETADO - audit_log actualizado correctamente');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('\n🚀 Ahora puedes ejecutar la app sin errores de constraint\n');

} catch (error) {
  console.error('❌ ERROR durante la migración:');
  console.error(error);
  console.log('\n🔄 Restaurando backup...');
  db.close();
  fs.copyFileSync(backupPath, dbPath);
  console.log('✅ Backup restaurado\n');
  process.exit(1);
} finally {
  db.close();
}
