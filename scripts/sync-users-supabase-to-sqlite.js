/**
 * Script de Sincronización de Usuarios: Supabase → SQLite
 *
 * Sincroniza todos los usuarios existentes en Supabase a SQLite local
 * para funcionamiento offline y multi-dispositivo.
 */

const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const Database = require('better-sqlite3');

// Configuración de Supabase
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://elagvnnamabqjptovzyq.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVsYWd2bm5hbWFicmpwdG92enlxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTI5NDk1MiwiZXhwIjoyMDc2ODcwOTUyfQ.3EZrcFg-o6RCl_LRmhRpYn0mUYsHW4Ovg2zm1phYRrw';

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY no está configurada');
  console.error('💡 Configúrala con: set SUPABASE_SERVICE_ROLE_KEY=tu_key');
  process.exit(1);
}

// Conectar a Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Conectar a SQLite
const dbPath = path.join(process.cwd(), 'Caja', 'casino.db');
const db = new Database(dbPath);

async function syncUsers() {
  console.log('🔄 Iniciando sincronización de usuarios Supabase → SQLite...\n');

  try {
    // 1. Obtener todos los usuarios de Supabase
    console.log('📥 Obteniendo usuarios de Supabase...');
    const { data: users, error } = await supabase
      .from('users')
      .select('id, email, full_name, role, is_active, created_at');

    if (error) {
      throw new Error(`Error obteniendo usuarios: ${error.message}`);
    }

    console.log(`✅ ${users.length} usuarios encontrados en Supabase\n`);

    if (users.length === 0) {
      console.log('ℹ️ No hay usuarios para sincronizar');
      return;
    }

    // 2. Verificar usuarios actuales en SQLite
    const existingUsers = db.prepare('SELECT id FROM usuarios').all();
    console.log(`📂 ${existingUsers.length} usuarios actuales en SQLite\n`);

    // 3. Sincronizar cada usuario
    // Nota: Como id en SQLite es INTEGER AUTOINCREMENT, insertamos sin id
    // y usamos el email como identificador único
    const stmt = db.prepare(`
      INSERT INTO usuarios (username, email, role, activo, sincronizado, password_hash, password_salt)
      VALUES (?, ?, ?, ?, 1, ?, ?)
      ON CONFLICT(email) DO UPDATE SET
        username = excluded.username,
        role = excluded.role,
        activo = excluded.activo,
        sincronizado = 1
    `);

    let synced = 0;
    let updated = 0;
    let errors = 0;

    for (const user of users) {
      try {
        const existingUser = existingUsers.find(u => u.email === user.email);
        const isUpdate = !!existingUser;

        // Generar hash de password dummy (usuarios de Supabase usan Supabase Auth)
        const dummyHash = 'SUPABASE_AUTH_USER';
        const dummySalt = 'SUPABASE';

        stmt.run(
          user.full_name || user.email.split('@')[0],
          user.email,
          user.role.toUpperCase(),
          user.is_active ? 1 : 0,
          dummyHash,
          dummySalt
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

    // 4. Resumen
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMEN DE SINCRONIZACIÓN');
    console.log('='.repeat(60));
    console.log(`✅ Usuarios nuevos:      ${synced}`);
    console.log(`✏️  Usuarios actualizados: ${updated}`);
    console.log(`❌ Errores:              ${errors}`);
    console.log(`📊 Total procesados:     ${users.length}`);
    console.log('='.repeat(60));

    // 5. Verificación final
    const finalCount = db.prepare('SELECT COUNT(*) as count FROM usuarios').get();
    console.log(`\n📂 Total usuarios en SQLite: ${finalCount.count}`);

    console.log('\n✅ Sincronización completada exitosamente!');

  } catch (error) {
    console.error('\n❌ Error durante sincronización:', error.message);
    process.exit(1);
  } finally {
    db.close();
  }
}

// Ejecutar
syncUsers().catch(error => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});
