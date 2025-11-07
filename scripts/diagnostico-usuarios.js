// ============================================
// DIAGNÓSTICO: Sistema de Usuarios
// ============================================
// Verifica sincronización entre Supabase y SQLite

const path = require('path');
const fs = require('fs');

async function diagnosticarUsuarios() {
  console.log('\n🔍 DIAGNÓSTICO DEL SISTEMA DE USUARIOS\n');
  console.log('='.repeat(60));

  // 1. Verificar conexión a Supabase
  console.log('\n📡 1. VERIFICANDO CONEXIÓN A SUPABASE...\n');

  let supabaseUsers = [];
  try {
    const { getSupabaseManager } = require('../pure/managers/SupabaseManager');
    const supabaseManager = getSupabaseManager();

    if (!supabaseManager || !supabaseManager.isAvailable()) {
      console.error('❌ Supabase no está disponible');
      console.log('   → Verifica SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env');
      return;
    }

    console.log('✅ Supabase conectado');

    // Consultar usuarios en Supabase
    const { data, error } = await supabaseManager.client
      .from('users')
      .select('id, email, full_name, role, pin_code, is_active')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error consultando usuarios en Supabase:', error.message);
    } else {
      supabaseUsers = data || [];
      console.log(`✅ ${supabaseUsers.length} usuarios encontrados en Supabase`);

      if (supabaseUsers.length > 0) {
        console.log('\n📋 Usuarios en Supabase:');
        supabaseUsers.forEach((user, idx) => {
          console.log(`   ${idx + 1}. ${user.email} (${user.role}) - ${user.is_active ? 'Activo' : 'Inactivo'}`);
        });
      }
    }
  } catch (error) {
    console.error('❌ Error verificando Supabase:', error.message);
  }

  // 2. Verificar base de datos SQLite local
  console.log('\n💾 2. VERIFICANDO BASE DE DATOS SQLITE LOCAL...\n');

  let sqliteUsers = [];
  try {
    const dbPath = path.join(process.cwd(), 'data', 'casino.db');

    if (!fs.existsSync(dbPath)) {
      console.error(`❌ Base de datos SQLite no encontrada en: ${dbPath}`);
      return;
    }

    console.log(`✅ Base de datos encontrada: ${dbPath}`);

    const CasinoDatabase = require(path.join(process.cwd(), 'SqulInstrucciones', 'database'));
    const db = new CasinoDatabase(dbPath);

    // Consultar usuarios en SQLite
    const query = 'SELECT id, email, full_name, role, pin_code, is_active FROM users ORDER BY created_at DESC';
    sqliteUsers = db.db.prepare(query).all();

    console.log(`✅ ${sqliteUsers.length} usuarios encontrados en SQLite`);

    if (sqliteUsers.length > 0) {
      console.log('\n📋 Usuarios en SQLite:');
      sqliteUsers.forEach((user, idx) => {
        console.log(`   ${idx + 1}. ${user.email} (${user.role}) - ${user.is_active ? 'Activo' : 'Inactivo'}`);
      });
    }

  } catch (error) {
    console.error('❌ Error verificando SQLite:', error.message);
  }

  // 3. Comparar ambas bases de datos
  console.log('\n🔄 3. COMPARANDO SUPABASE vs SQLITE...\n');

  const supabaseEmails = new Set(supabaseUsers.map(u => u.email));
  const sqliteEmails = new Set(sqliteUsers.map(u => u.email));

  // Usuarios solo en Supabase
  const soloEnSupabase = supabaseUsers.filter(u => !sqliteEmails.has(u.email));
  if (soloEnSupabase.length > 0) {
    console.log(`⚠️  ${soloEnSupabase.length} usuario(s) solo en Supabase (NO sincronizados a local):`);
    soloEnSupabase.forEach(u => {
      console.log(`   - ${u.email} (${u.role})`);
    });
  } else {
    console.log('✅ No hay usuarios solo en Supabase');
  }

  // Usuarios solo en SQLite
  const soloEnSQLite = sqliteUsers.filter(u => !supabaseEmails.has(u.email));
  if (soloEnSQLite.length > 0) {
    console.log(`\n⚠️  ${soloEnSQLite.length} usuario(s) solo en SQLite (NO sincronizados a Supabase):`);
    soloEnSQLite.forEach(u => {
      console.log(`   - ${u.email} (${u.role})`);
    });
  } else {
    console.log('\n✅ No hay usuarios solo en SQLite');
  }

  // Usuarios en ambas
  const enAmbas = supabaseUsers.filter(u => sqliteEmails.has(u.email));
  if (enAmbas.length > 0) {
    console.log(`\n✅ ${enAmbas.length} usuario(s) sincronizado(s) en ambas bases de datos`);
  }

  // 4. Verificar handlers IPC
  console.log('\n📝 4. VERIFICANDO HANDLERS IPC...\n');

  const mainJsPath = path.join(process.cwd(), 'pure', 'main.js');
  const mainContent = fs.readFileSync(mainJsPath, 'utf8');

  const handlers = [
    'get-all-users',
    'create-user',
    'update-user',
    'toggle-user-status'
  ];

  handlers.forEach(handler => {
    if (mainContent.includes(`safeIpcHandle('${handler}'`)) {
      console.log(`✅ Handler '${handler}' existe`);

      // Verificar si usa Supabase o SQLite
      const handlerRegex = new RegExp(`safeIpcHandle\\('${handler}'[\\s\\S]{1,2000}?\\)\\s*;`, 'g');
      const match = mainContent.match(handlerRegex);

      if (match && match[0]) {
        const usesSupabase = match[0].includes('supabaseManager');
        const usesSQLite = match[0].includes('db.db.prepare') || match[0].includes('db.prepare');

        if (usesSupabase && !usesSQLite) {
          console.log(`   ⚠️  Solo usa Supabase (NO sincroniza con SQLite local)`);
        } else if (usesSQLite && !usesSupabase) {
          console.log(`   ⚠️  Solo usa SQLite (NO sincroniza con Supabase)`);
        } else if (usesSupabase && usesSQLite) {
          console.log(`   ✅ Usa ambas bases de datos`);
        }
      }
    } else {
      console.log(`❌ Handler '${handler}' NO EXISTE`);
    }
  });

  // 5. Diagnóstico final
  console.log('\n📊 5. DIAGNÓSTICO FINAL\n');
  console.log('='.repeat(60));

  const problemas = [];

  if (soloEnSupabase.length > 0) {
    problemas.push(`❌ ${soloEnSupabase.length} usuario(s) no sincronizados de Supabase a SQLite`);
  }

  if (soloEnSQLite.length > 0) {
    problemas.push(`❌ ${soloEnSQLite.length} usuario(s) no sincronizados de SQLite a Supabase`);
  }

  if (problemas.length === 0) {
    console.log('✅ NO SE DETECTARON PROBLEMAS DE SINCRONIZACIÓN');
  } else {
    console.log('⚠️  PROBLEMAS DETECTADOS:\n');
    problemas.forEach(p => console.log(`   ${p}`));

    console.log('\n💡 SOLUCIÓN RECOMENDADA:');
    console.log('   1. Modificar handlers IPC para sincronizar ambas bases de datos');
    console.log('   2. Al crear usuario: Guardar en Supabase Y en SQLite');
    console.log('   3. Al actualizar usuario: Actualizar en Supabase Y en SQLite');
    console.log('   4. Al cargar usuarios: Cargar desde Supabase y sincronizar a SQLite');
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ DIAGNÓSTICO COMPLETADO\n');
}

// Ejecutar diagnóstico
diagnosticarUsuarios().catch(error => {
  console.error('\n❌ Error en diagnóstico:', error);
  process.exit(1);
});
