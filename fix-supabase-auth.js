#!/usr/bin/env node
/**
 * Fix Supabase Auth - Crear/Actualizar usuarios usando API REST
 */
require('dotenv').config();
const fetch = require('node-fetch');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEFAULT_PASSWORD = 'Casino2024!';

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ ERROR: Variables de entorno no configuradas');
  console.log('   SUPABASE_URL:', SUPABASE_URL ? 'OK' : 'FALTA');
  console.log('   SERVICE_ROLE_KEY:', SERVICE_ROLE_KEY ? 'OK' : 'FALTA');
  process.exit(1);
}

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

async function updateUserPassword(email, password = DEFAULT_PASSWORD) {
  // Primero obtener el usuario por email
  const listUrl = `${SUPABASE_URL}/auth/v1/admin/users`;

  const listResponse = await fetch(listUrl, {
    headers: {
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey': SERVICE_ROLE_KEY
    }
  });

  const listData = await listResponse.json();
  const authUser = listData.users?.find(u => u.email === email);

  if (!authUser) {
    throw new Error('Usuario no encontrado en Auth');
  }

  // Actualizar password
  const updateUrl = `${SUPABASE_URL}/auth/v1/admin/users/${authUser.id}`;

  const response = await fetch(updateUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey': SERVICE_ROLE_KEY
    },
    body: JSON.stringify({
      password: password
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
  console.log('FIX SUPABASE AUTH - API REST');
  console.log('═══════════════════════════════════════════════════════\n');

  console.log(`🔧 Procesando ${usuarios.length} usuarios...`);
  console.log(`🔑 Contraseña por defecto: ${DEFAULT_PASSWORD}\n`);
  console.log('─'.repeat(60));

  let created = 0;
  let updated = 0;
  let errors = 0;

  for (const user of usuarios) {
    console.log(`\n📧 ${user.email}`);

    try {
      // Intentar crear
      const result = await createUser(user);
      console.log(`   ✅ Creado - ID: ${result.id}`);
      created++;
    } catch (createError) {
      if (createError.message.includes('already') || createError.message.includes('registered')) {
        // Ya existe, intentar actualizar password
        console.log(`   ⚠️  Ya existe, actualizando password...`);
        try {
          await updateUserPassword(user.email);
          console.log(`   ✅ Password actualizado`);
          updated++;
        } catch (updateError) {
          console.log(`   ❌ Error actualizando: ${updateError.message}`);
          errors++;
        }
      } else {
        console.log(`   ❌ Error: ${createError.message}`);
        errors++;
      }
    }

    // Pequeña pausa para no saturar la API
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n' + '═'.repeat(60));
  console.log('RESUMEN');
  console.log('═'.repeat(60));
  console.log(`✅ Creados: ${created}`);
  console.log(`🔄 Actualizados: ${updated}`);
  console.log(`❌ Errores: ${errors}`);
  console.log(`📊 Total: ${usuarios.length}`);
  console.log('\n' + '═'.repeat(60));

  if (created + updated > 0) {
    console.log('\n📝 CREDENCIALES PARA LOGIN:\n');
    usuarios.forEach(u => {
      console.log(`   Email: ${u.email}`);
      console.log(`   Password: ${DEFAULT_PASSWORD}`);
      console.log(`   PIN: ${u.pin}`);
      console.log('');
    });
  }

  console.log('═'.repeat(60));
  console.log('\n✅ Proceso completado');
  console.log('\nAhora puedes hacer login con cualquiera de estos usuarios.');
  console.log('Los PINs están configurados para acceso rápido.\n');
}

main().catch(err => {
  console.error('\n❌ Error fatal:', err.message);
  console.error(err.stack);
  process.exit(1);
});
