#!/usr/bin/env node
/**
 * Reset de contraseñas - Eliminar y recrear usuarios en Auth
 */
require('dotenv').config();
const fetch = require('node-fetch');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEFAULT_PASSWORD = 'Casino2024!';

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

async function deleteUserByEmail(email) {
  try {
    // Primero intentar obtener el ID vía signInWithPassword (fallback)
    // Como no podemos listar, intentamos con cada usuario individual
    const signInUrl = `${SUPABASE_URL}/auth/v1/token?grant_type=password`;

    const signInResponse = await fetch(signInUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_ROLE_KEY
      },
      body: JSON.stringify({
        email: email,
        password: DEFAULT_PASSWORD
      })
    });

    if (signInResponse.ok) {
      const signInData = await signInResponse.json();
      const userId = signInData.user.id;

      // Eliminar usuario
      const deleteUrl = `${SUPABASE_URL}/auth/v1/admin/users/${userId}`;
      const deleteResponse = await fetch(deleteUrl, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
          'apikey': SERVICE_ROLE_KEY
        }
      });

      return { success: true, userId };
    } else {
      return { success: false, reason: 'no_login' };
    }
  } catch (err) {
    return { success: false, reason: err.message };
  }
}

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
  console.log('RESET DE CONTRASEÑAS - MÉTODO DELETE + CREATE');
  console.log('═══════════════════════════════════════════════════════\n');

  console.log('⚠️  ADVERTENCIA: Este script intentará eliminar y recrear usuarios');
  console.log(`🔑 Nueva contraseña para todos: ${DEFAULT_PASSWORD}\n`);
  console.log('─'.repeat(60));

  let deleted = 0;
  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const user of usuarios) {
    console.log(`\n📧 ${user.email}`);

    // Paso 1: Intentar eliminar
    console.log('   🗑️  Intentando eliminar...');
    const deleteResult = await deleteUserByEmail(user.email);

    if (deleteResult.success) {
      console.log(`   ✅ Eliminado (ID: ${deleteResult.userId})`);
      deleted++;
      await new Promise(resolve => setTimeout(resolve, 500));
    } else {
      console.log(`   ⏭️  No se pudo eliminar: ${deleteResult.reason}`);
    }

    // Paso 2: Crear usuario
    console.log('   ➕ Creando usuario...');
    try {
      const result = await createUser(user);
      console.log(`   ✅ Creado - ID: ${result.id}`);
      created++;
    } catch (createError) {
      if (createError.message.includes('already') ||
          createError.message.includes('registered') ||
          createError.message.includes('Database error checking email')) {
        console.log(`   ⚠️  Ya existe (no se pudo eliminar antes)`);
        skipped++;
      } else {
        console.log(`   ❌ Error creando: ${createError.message}`);
        errors++;
      }
    }

    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n' + '═'.repeat(60));
  console.log('RESUMEN');
  console.log('═'.repeat(60));
  console.log(`🗑️  Eliminados: ${deleted}`);
  console.log(`✅ Creados: ${created}`);
  console.log(`⏭️  Ya existían: ${skipped}`);
  console.log(`❌ Errores: ${errors}`);
  console.log(`📊 Total: ${usuarios.length}`);
  console.log('═'.repeat(60));

  console.log('\n📝 CREDENCIALES:');
  console.log(`   Password para TODOS: ${DEFAULT_PASSWORD}`);
  console.log('');
  console.log('📋 Usuarios procesados:');
  usuarios.forEach(u => {
    console.log(`   • ${u.email} - PIN: ${u.pin}`);
  });

  console.log('\n═'.repeat(60));

  if (created > 0) {
    console.log(`✅ ${created} usuarios recreados con nueva contraseña`);
  }

  if (skipped > 0) {
    console.log(`⚠️  ${skipped} usuarios ya existían y no se pudieron recrear`);
    console.log('💡 Para estos usuarios, prueba la contraseña actual o usa el Dashboard de Supabase');
  }

  console.log('');
}

main().catch(err => {
  console.error('\n❌ Error fatal:', err.message);
  process.exit(1);
});
