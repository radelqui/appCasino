#!/usr/bin/env node
/**
 * Crear usuarios en Supabase Auth basados en la tabla users
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

// Contraseña por defecto para usuarios nuevos
const DEFAULT_PASSWORD = 'Casino2024!';

async function createAuthUsers() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('CREAR USUARIOS EN SUPABASE AUTH');
  console.log('═══════════════════════════════════════════════════════\n');

  // Obtener usuarios de la tabla users
  const { data: profiles, error: profileError } = await supabase
    .from('users')
    .select('*')
    .eq('is_active', true);

  if (profileError) {
    console.error('❌ Error obteniendo perfiles:', profileError.message);
    process.exit(1);
  }

  console.log(`✅ ${profiles.length} perfiles activos encontrados\n`);
  console.log('⚠️  Contraseña por defecto:', DEFAULT_PASSWORD);
  console.log('⚠️  Los usuarios deberán cambiarla al primer login\n');
  console.log('─'.repeat(60));

  let created = 0;
  let existing = 0;
  let errors = 0;

  for (const profile of profiles) {
    console.log(`\n📧 Procesando: ${profile.email}`);

    try {
      // Intentar crear usuario en Auth
      const { data, error } = await supabase.auth.admin.createUser({
        email: profile.email,
        password: DEFAULT_PASSWORD,
        email_confirm: true, // Auto-confirmar email
        user_metadata: {
          full_name: profile.full_name,
          role: profile.role,
          created_by: 'migration_script'
        }
      });

      if (error) {
        if (error.message.includes('already registered')) {
          console.log(`   ⚠️  Ya existe en Auth`);
          existing++;
        } else {
          console.log(`   ❌ Error: ${error.message}`);
          errors++;
        }
      } else {
        console.log(`   ✅ Creado con ID: ${data.user.id}`);

        // Actualizar el perfil con el ID de auth
        await supabase
          .from('users')
          .update({ id: data.user.id })
          .eq('email', profile.email);

        created++;
      }
    } catch (err) {
      console.log(`   ❌ Excepción: ${err.message}`);
      errors++;
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log('RESUMEN');
  console.log('═'.repeat(60));
  console.log(`✅ Creados: ${created}`);
  console.log(`⚠️  Ya existían: ${existing}`);
  console.log(`❌ Errores: ${errors}`);
  console.log(`📊 Total procesados: ${profiles.length}`);
  console.log('\n' + '═'.repeat(60));

  if (created > 0) {
    console.log('\n📝 CREDENCIALES PARA LOGIN:\n');
    profiles.forEach(p => {
      console.log(`   Email: ${p.email}`);
      console.log(`   Password: ${DEFAULT_PASSWORD}`);
      console.log(`   Role: ${p.role}`);
      console.log('');
    });
    console.log('⚠️  IMPORTANTE: Cambiar las contraseñas en producción\n');
  }

  console.log('═'.repeat(60));
}

createAuthUsers().then(() => {
  console.log('\n✅ Proceso completado\n');
  process.exit(0);
}).catch(err => {
  console.error('\n❌ Error fatal:', err.message);
  process.exit(1);
});
