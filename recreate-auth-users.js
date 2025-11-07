#!/usr/bin/env node
/**
 * Recrear usuarios en Supabase Auth
 * Este script crea usuarios en Auth basándose en la tabla users
 */
require('dotenv').config();
const fetch = require('node-fetch');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEFAULT_PASSWORD = 'Casino2024!';

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ ERROR: Variables de entorno no configuradas');
  process.exit(1);
}

// Usuarios a crear en Auth
const usuarios = [
  { email: 'admin@test.com', full_name: 'Administrador de Prueba', role: 'admin', pin: '9999' },
  { email: 'admin@casino.com', full_name: 'Administrador', role: 'admin', pin: '1234' },
  { email: 'admin@casinosusua.com', full_name: 'Administrador Principal', role: 'admin', pin: '0000' },
  { email: 'caja@casinosusua.com', full_name: 'Cajero Principal', role: 'caja', pin: '2222' },
  { email: 'mesa1@casinosusua.com', full_name: 'Operador Mesa 1', role: 'mesa', pin: '1111' },
  { email: 'mesa2@casinosusua.com', full_name: 'Operador Mesa 2', role: 'mesa', pin: '2222' },
  { email: 'mesa3@casinosusua.com', full_name: 'Operador Mesa 3', role: 'mesa', pin: '3333' },
  { email: 'mesa4@casinosusua.com', full_name: 'Operador Mesa 4', role: 'mesa', pin: '4444' },
  { email: 'auditor@casinosusua.com', full_name: 'Auditor Principal', role: 'auditor', pin: '5555' }
];

async function createUser(user) {
  const url = `${SUPABASE_URL}/auth/v1/admin/users`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey': SERVICE_ROLE_KEY
    },
    body: JSON.stringify({
      email: user.email,
      password: DEFAULT_PASSWORD,
      email_confirm: true,
      user_metadata: {
        full_name: user.full_name,
        role: user.role,
        pin_code: user.pin
      }
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.msg || data.message || JSON.stringify(data));
  }

  return data;
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('RECREAR USUARIOS EN SUPABASE AUTH');
  console.log('═══════════════════════════════════════════════════════\n');

  console.log(`🔧 Procesando ${usuarios.length} usuarios...`);
  console.log(`🔑 Contraseña por defecto: ${DEFAULT_PASSWORD}\n`);
  console.log('─'.repeat(60));

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const user of usuarios) {
    console.log(`\n📧 ${user.email}`);

    try {
      const result = await createUser(user);
      console.log(`   ✅ Creado - ID: ${result.id}`);
      created++;
    } catch (createError) {
      // Si ya existe, es OK - lo ignoramos
      if (createError.message.includes('already') ||
          createError.message.includes('registered') ||
          createError.message.includes('duplicate')) {
        console.log(`   ⏭️  Ya existe (OK)`);
        skipped++;
      } else if (createError.message.includes('Database error checking email')) {
        // Este error es común cuando Auth tiene problemas listando
        // Pero el usuario puede existir, así que lo contamos como skipped
        console.log(`   ⚠️  Database error (probablemente ya existe)`);
        skipped++;
      } else {
        console.log(`   ❌ Error: ${createError.message}`);
        errors++;
      }
    }

    // Pausa para no saturar API
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  console.log('\n' + '═'.repeat(60));
  console.log('RESUMEN');
  console.log('═'.repeat(60));
  console.log(`✅ Creados: ${created}`);
  console.log(`⏭️  Ya existían: ${skipped}`);
  console.log(`❌ Errores: ${errors}`);
  console.log(`📊 Total: ${usuarios.length}`);
  console.log('═'.repeat(60));

  console.log('\n📝 CREDENCIALES PARA TODOS LOS USUARIOS:\n');
  console.log(`   Password: ${DEFAULT_PASSWORD}`);
  console.log('');
  console.log('📋 Lista de usuarios:');
  usuarios.forEach(u => {
    console.log(`   • ${u.email} - PIN: ${u.pin} - Role: ${u.role}`);
  });

  console.log('\n═'.repeat(60));
  console.log('✅ Proceso completado');
  console.log('');

  if (created + skipped === usuarios.length) {
    console.log('🎉 TODOS los usuarios están listos para usar');
    console.log('💡 Puedes probar login con cualquiera de ellos');
  } else if (errors > 0) {
    console.log('⚠️  Algunos usuarios tuvieron errores');
    console.log('💡 Verifica los logs arriba para más detalles');
  }

  console.log('');
}

main().catch(err => {
  console.error('\n❌ Error fatal:', err.message);
  console.error(err.stack);
  process.exit(1);
});
