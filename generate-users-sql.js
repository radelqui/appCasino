// ============================================
// SCRIPT: Generar SQL para insertar usuarios
// NO usa better-sqlite3, solo genera el SQL
// ============================================

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
require('dotenv').config();

console.log('🔧 Generando SQL para usuarios de Supabase...\n');

// ============================================
// HASH PASSWORD CON PBKDF2
// ============================================
function hashPassword(password) {
  const salt = crypto.randomBytes(32);
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512');
  
  return {
    hash: hash.toString('hex'),
    salt: salt.toString('hex')
  };
}

// ============================================
// OBTENER USUARIOS Y GENERAR SQL
// ============================================
async function main() {
  try {
    console.log('🔗 Conectando a Supabase...');
    
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
    
    // Obtener usuarios
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .eq('is_active', true);
    
    if (error) throw error;
    
    console.log(`✅ ${users.length} usuarios encontrados\n`);
    
    // Generar SQL
    console.log('-- ============================================');
    console.log('-- SQL PARA SINCRONIZAR USUARIOS DE SUPABASE');
    console.log('-- Copiar y ejecutar en SQLite');
    console.log('-- ============================================\n');
    
    console.log('-- Limpiar usuarios anteriores (excepto admin@local)');
    console.log("DELETE FROM usuarios WHERE username != 'admin@local';\n");
    
    console.log('-- Insertar usuarios de Supabase');
    
    for (const user of users) {
      const { hash, salt } = hashPassword(user.pin_code);
      const metadata = JSON.stringify({
        supabase_id: user.id,
        full_name: user.full_name,
        station_id: user.station_id
      }).replace(/'/g, "''");
      
      console.log(`INSERT INTO usuarios (username, password_hash, password_salt, email, role, activo, metadata) VALUES (
  '${user.email}',
  '${hash}',
  '${salt}',
  '${user.email}',
  '${user.role.toUpperCase()}',
  1,
  '${metadata}'
);`);
    }
    
    console.log('\n-- Verificar');
    console.log('SELECT username, role FROM usuarios ORDER BY role;\n');
    
    console.log('-- ============================================');
    console.log('-- CREDENCIALES DE LOGIN:');
    console.log('-- ============================================');
    users.forEach(u => {
      console.log(`-- ${u.email} / ${u.pin_code}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
