#!/usr/bin/env node
/**
 * Test de login para todos los usuarios
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

const usuarios = [
  { email: 'admin@test.com', passwords: ['Casino2024!', 'test123', 'admin123'] },
  { email: 'admin@casino.com', passwords: ['Casino2024!', 'admin123', '1234'] },
  { email: 'admin@casinosusua.com', passwords: ['Casino2024!', 'admin123', '0000'] },
  { email: 'caja@casinosusua.com', passwords: ['Casino2024!', 'caja123', '2222'] },
  { email: 'mesa1@casinosusua.com', passwords: ['Casino2024!', 'mesa123', '1111'] },
  { email: 'mesa2@casinosusua.com', passwords: ['Casino2024!', 'mesa123', '2222'] },
  { email: 'mesa3@casinosusua.com', passwords: ['Casino2024!', 'mesa123', '3333'] },
  { email: 'mesa4@casinosusua.com', passwords: ['Casino2024!', 'mesa123', '4444'] },
  { email: 'auditor@casinosusua.com', passwords: ['Casino2024!', 'auditor123', '5555'] }
];

async function testLogin(email, password) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, userId: data.user.id };
  } catch (err) {
    return { success: false, error: err.message };
  } finally {
    // Siempre hacer signOut después de probar
    await supabase.auth.signOut();
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('TEST DE LOGIN - TODOS LOS USUARIOS');
  console.log('═══════════════════════════════════════════════════════\n');

  let successful = 0;
  let failed = 0;

  for (const usuario of usuarios) {
    console.log(`\n📧 ${usuario.email}`);

    let loginSuccess = false;
    let workingPassword = null;

    for (const password of usuario.passwords) {
      console.log(`   🔑 Probando: ${password}`);

      const result = await testLogin(usuario.email, password);

      if (result.success) {
        console.log(`   ✅ LOGIN EXITOSO - ID: ${result.userId}`);
        loginSuccess = true;
        workingPassword = password;
        successful++;
        break;
      } else {
        console.log(`   ❌ Falló: ${result.error}`);
      }

      await new Promise(resolve => setTimeout(resolve, 300));
    }

    if (!loginSuccess) {
      console.log(`   🚫 NINGUNA CONTRASEÑA FUNCIONÓ`);
      failed++;
    } else {
      console.log(`   ✨ Contraseña correcta: ${workingPassword}`);
    }

    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n' + '═'.repeat(60));
  console.log('RESUMEN');
  console.log('═'.repeat(60));
  console.log(`✅ Usuarios con login exitoso: ${successful}`);
  console.log(`❌ Usuarios sin login: ${failed}`);
  console.log(`📊 Total probados: ${usuarios.length}`);
  console.log('═'.repeat(60));

  if (failed > 0) {
    console.log('\n⚠️  USUARIOS CON PROBLEMAS:');
    console.log('💡 Estos usuarios necesitan reset de contraseña');
    console.log('💡 Opciones:');
    console.log('   1. Usar Supabase Dashboard para resetear contraseñas manualmente');
    console.log('   2. Eliminar y recrear usuarios vía SQL');
    console.log('   3. Usar Auth API para forzar cambio de contraseña');
  } else {
    console.log('\n🎉 TODOS los usuarios pueden hacer login!');
  }

  console.log('');
}

main().catch(err => {
  console.error('\n❌ Error fatal:', err.message);
  process.exit(1);
});
