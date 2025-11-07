/**
 * Script para reparar la tabla usuarios y permitir sincronización con Supabase
 *
 * PROBLEMA: La tabla usuarios usa INTEGER AUTOINCREMENT como id
 * SOLUCION: Cambiar id a TEXT para soportar UUIDs de Supabase
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'Caja', 'casino.db');

console.log('🔧 Reparando tabla usuarios...\n');
console.log(`📂 Base de datos: ${dbPath}\n`);

try {
  const db = new Database(dbPath);

  // 1. Verificar tabla actual
  console.log('📊 Estado actual:');
  const currentUsers = db.prepare('SELECT COUNT(*) as count FROM usuarios').get();
  console.log(`   Usuarios existentes: ${currentUsers.count}\n`);

  // 2. Crear backup
  console.log('💾 Creando backup...');
  db.exec(`CREATE TABLE IF NOT EXISTS usuarios_backup AS SELECT * FROM usuarios`);
  console.log('   ✅ Backup creado\n');

  // 3. Crear tabla nueva con estructura correcta
  console.log('🔨 Creando nueva estructura...');
  db.exec(`
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
  console.log('   ✅ Nueva estructura creada\n');

  // 4. Copiar datos existentes
  console.log('📋 Copiando datos existentes...');
  const copied = db.exec(`
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
  console.log('   ✅ Datos copiados\n');

  // 5. Eliminar tabla antigua y renombrar
  console.log('🔄 Reemplazando tabla...');
  db.exec('DROP TABLE usuarios');
  db.exec('ALTER TABLE usuarios_new RENAME TO usuarios');
  console.log('   ✅ Tabla reemplazada\n');

  // 6. Crear índices
  console.log('📑 Creando índices...');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_usuario_email ON usuarios(email)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_usuario_role ON usuarios(role)');
  console.log('   ✅ Índices creados\n');

  // 7. Verificar resultado
  const finalUsers = db.prepare('SELECT COUNT(*) as count FROM usuarios').get();
  console.log('═'.repeat(60));
  console.log('✅ REPARACIÓN COMPLETADA');
  console.log('═'.repeat(60));
  console.log(`📊 Usuarios en la tabla: ${finalUsers.count}`);
  console.log(`💾 Backup disponible en: usuarios_backup`);
  console.log('\n🎯 PRÓXIMO PASO:');
  console.log('   1. Inicia la aplicación: npm start');
  console.log('   2. Abre el módulo de usuarios');
  console.log('   3. Los usuarios se sincronizarán automáticamente de Supabase\n');

  db.close();

} catch (error) {
  console.error('❌ Error reparando tabla:', error.message);
  console.error('\n🔧 Solución alternativa:');
  console.error('   Usa DB Browser for SQLite para ejecutar FIX_USUARIOS_TABLE.sql');
  process.exit(1);
}
