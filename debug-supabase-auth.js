#!/usr/bin/env node
/**
 * Debug Supabase Auth - Verificar qué está pasando con Auth
 */
require('dotenv').config();
const fetch = require('node-fetch');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('═══════════════════════════════════════════════════════');
console.log('DEBUG SUPABASE AUTH');
console.log('═══════════════════════════════════════════════════════\n');

console.log('📋 Variables de entorno:');
console.log(`   SUPABASE_URL: ${SUPABASE_URL ? '✅ Configurada' : '❌ FALTA'}`);
console.log(`   SERVICE_ROLE_KEY: ${SERVICE_ROLE_KEY ? '✅ Configurada' : '❌ FALTA'}`);
console.log('');

async function testAuthEndpoint() {
  console.log('[1/3] Probando endpoint GET /auth/v1/admin/users\n');

  try {
    const url = `${SUPABASE_URL}/auth/v1/admin/users`;
    console.log(`🔗 URL: ${url}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'apikey': SERVICE_ROLE_KEY
      }
    });

    console.log(`📡 Status: ${response.status} ${response.statusText}`);

    const text = await response.text();
    console.log(`📦 Response raw: ${text.substring(0, 500)}\n`);

    try {
      const data = JSON.parse(text);
      console.log('✅ JSON válido');
      console.log(`📊 Usuarios encontrados: ${data.users?.length ?? 0}`);

      if (data.users && data.users.length > 0) {
        console.log('\n👥 Primeros 3 usuarios:');
        data.users.slice(0, 3).forEach((u, idx) => {
          console.log(`   ${idx + 1}. ${u.email} (${u.id})`);
        });
      } else {
        console.log('⚠️  No hay usuarios en Auth');
      }

      if (data.error) {
        console.log(`❌ Error en respuesta: ${data.error.message || JSON.stringify(data.error)}`);
      }
    } catch (parseErr) {
      console.log(`❌ Error parseando JSON: ${parseErr.message}`);
    }
  } catch (err) {
    console.log(`❌ Error en request: ${err.message}`);
  }

  console.log('\n' + '─'.repeat(60) + '\n');
}

async function testCreateUser() {
  console.log('[2/3] Probando crear usuario de prueba\n');

  const testEmail = `test-${Date.now()}@test.com`;

  try {
    const url = `${SUPABASE_URL}/auth/v1/admin/users`;
    console.log(`🔗 URL: ${url}`);
    console.log(`📧 Email: ${testEmail}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'apikey': SERVICE_ROLE_KEY
      },
      body: JSON.stringify({
        email: testEmail,
        password: 'Test1234!',
        email_confirm: true
      })
    });

    console.log(`📡 Status: ${response.status} ${response.statusText}`);

    const text = await response.text();
    console.log(`📦 Response: ${text.substring(0, 500)}\n`);

    try {
      const data = JSON.parse(text);

      if (response.ok) {
        console.log(`✅ Usuario creado exitosamente`);
        console.log(`   ID: ${data.id || data.user?.id}`);
        return data.id || data.user?.id;
      } else {
        console.log(`❌ Error: ${data.msg || data.message || JSON.stringify(data)}`);
        return null;
      }
    } catch (parseErr) {
      console.log(`❌ Error parseando: ${parseErr.message}`);
      return null;
    }
  } catch (err) {
    console.log(`❌ Error en request: ${err.message}`);
    return null;
  }

  console.log('\n' + '─'.repeat(60) + '\n');
}

async function checkUsersTable() {
  console.log('[3/3] Verificando tabla users (perfiles)\n');

  try {
    const url = `${SUPABASE_URL}/rest/v1/users?select=*`;
    console.log(`🔗 URL: ${url}`);

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'apikey': SERVICE_ROLE_KEY
      }
    });

    console.log(`📡 Status: ${response.status} ${response.statusText}`);

    const text = await response.text();

    try {
      const data = JSON.parse(text);
      console.log(`📊 Perfiles en tabla users: ${data.length ?? 0}`);

      if (data.length > 0) {
        console.log('\n👥 Usuarios en tabla:');
        data.forEach((u, idx) => {
          console.log(`   ${idx + 1}. ${u.email} - ${u.full_name} (${u.role})`);
        });
      }
    } catch (parseErr) {
      console.log(`❌ Error parseando: ${parseErr.message}`);
    }
  } catch (err) {
    console.log(`❌ Error: ${err.message}`);
  }
}

async function main() {
  await testAuthEndpoint();
  const newUserId = await testCreateUser();
  await checkUsersTable();

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('DIAGNÓSTICO COMPLETO');
  console.log('═══════════════════════════════════════════════════════\n');

  if (newUserId) {
    console.log('✅ Auth REST API funciona - Se pueden crear usuarios');
    console.log('⚠️  El problema es que los usuarios antiguos no están en Auth');
    console.log('💡 SOLUCIÓN: Crear todos los usuarios de nuevo usando el script');
  } else {
    console.log('❌ Auth REST API NO funciona correctamente');
    console.log('⚠️  Verificar:');
    console.log('   1. SERVICE_ROLE_KEY es válida');
    console.log('   2. Auth está habilitado en Supabase');
    console.log('   3. URL de Supabase es correcta');
  }
}

main().catch(err => {
  console.error('\n❌ Error fatal:', err.message);
  process.exit(1);
});
