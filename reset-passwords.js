#!/usr/bin/env node
/**
 * Resetear contraseñas de todos los usuarios
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ ERROR: Variables de entorno Supabase no configuradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Contraseña nueva para TODOS los usuarios
const NEW_PASSWORD = 'Casino2024!';

async function resetPasswords() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('RESETEAR CONTRASEÑAS DE USUARIOS');
  console.log('═══════════════════════════════════════════════════════\n');

  console.log('⚠️  Nueva contraseña para TODOS:', NEW_PASSWORD);
  console.log('⚠️  Los usuarios podrán cambiarla después del login\n');
  console.log('─'.repeat(60));

  // Obtener TODOS los usuarios de Auth
  const { data: authData, error: listError } = await supabase.auth.admin.listUsers();

  if (listError) {
    console.error('❌ Error listando usuarios:', listError.message);
    // Intentar con los usuarios conocidos de la tabla users
    console.log('\n⚠️  Intentando con usuarios de la tabla "users"...\n');

    const { data: profiles, error: profileError } = await supabase
      .from('users')
      .select('email, full_name, role')
      .eq('is_active', true);

    if (profileError) {
      console.error('❌ Error obteniendo perfiles:', profileError.message);
      process.exit(1);
    }

    await resetFromProfiles(profiles);
    return;
  }

  if (!authData.users || authData.users.length === 0) {
    console.log('⚠️  No se encontraron usuarios en Auth\n');
    // Intentar con tabla users
    const { data: profiles } = await supabase
      .from('users')
      .select('email, full_name, role')
      .eq('is_active', true);

    if (profiles && profiles.length > 0) {
      await resetFromProfiles(profiles);
    }
    return;
  }

  console.log(`✅ ${authData.users.length} usuarios encontrados en Auth\n`);

  let success = 0;
  let errors = 0;

  for (const user of authData.users) {
    console.log(`📧 ${user.email}`);

    try {
      const { data, error } = await supabase.auth.admin.updateUserById(
        user.id,
        { password: NEW_PASSWORD }
      );

      if (error) {
        console.log(`   ❌ Error: ${error.message}`);
        errors++;
      } else {
        console.log(`   ✅ Contraseña actualizada`);
        success++;
      }
    } catch (err) {
      console.log(`   ❌ Excepción: ${err.message}`);
      errors++;
    }
  }

  printSummary(success, errors, authData.users);
}

async function resetFromProfiles(profiles) {
  console.log(`✅ ${profiles.length} perfiles encontrados\n`);

  let success = 0;
  let errors = 0;

  for (const profile of profiles) {
    console.log(`📧 ${profile.email}`);

    try {
      // Buscar usuario por email en Auth
      const { data: authUsers } = await supabase.auth.admin.listUsers();
      const authUser = authUsers?.users?.find(u => u.email === profile.email);

      if (!authUser) {
        console.log(`   ⚠️  No encontrado en Auth, skipping`);
        continue;
      }

      const { error } = await supabase.auth.admin.updateUserById(
        authUser.id,
        { password: NEW_PASSWORD }
      );

      if (error) {
        console.log(`   ❌ Error: ${error.message}`);
        errors++;
      } else {
        console.log(`   ✅ Contraseña actualizada`);
        success++;
      }
    } catch (err) {
      console.log(`   ❌ Excepción: ${err.message}`);
      errors++;
    }
  }

  printSummary(success, errors, profiles);
}

function printSummary(success, errors, users) {
  console.log('\n' + '═'.repeat(60));
  console.log('RESUMEN');
  console.log('═'.repeat(60));
  console.log(`✅ Actualizados: ${success}`);
  console.log(`❌ Errores: ${errors}`);
  console.log(`📊 Total: ${users.length}`);
  console.log('\n' + '═'.repeat(60));

  if (success > 0) {
    console.log('\n📝 CREDENCIALES ACTUALIZADAS:\n');
    users.forEach(u => {
      const email = u.email || u;
      console.log(`   Email: ${email}`);
      console.log(`   Password: ${NEW_PASSWORD}`);
      console.log('');
    });
  }

  console.log('═'.repeat(60));
}

resetPasswords().then(() => {
  console.log('\n✅ Proceso completado\n');
  process.exit(0);
}).catch(err => {
  console.error('\n❌ Error fatal:', err.message);
  console.error(err.stack);
  process.exit(1);
});
