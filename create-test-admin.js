const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createTestAdmin() {
  console.log('\n🔧 Creando usuario de prueba admin@test.com...\n');

  // Crear usuario en Auth
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: 'admin@test.com',
    password: 'admin123',
    email_confirm: true // Auto-confirmar
  });

  if (authError) {
    console.error('❌ Error creando usuario en Auth:', authError.message);
    return;
  }

  console.log('✅ Usuario creado en Auth');
  console.log(`   ID: ${authData.user.id}`);
  console.log('');

  // Crear perfil en tabla users
  const { data: profileData, error: profileError } = await supabase
    .from('users')
    .upsert({
      id: authData.user.id,
      email: 'admin@test.com',
      full_name: 'Administrador de Prueba',
      role: 'admin',
      pin_code: '9999',
      is_active: true
    })
    .select()
    .single();

  if (profileError) {
    console.error('❌ Error creando perfil:', profileError.message);
    return;
  }

  console.log('✅ Perfil creado en tabla users');
  console.log('');
  console.log('═══════════════════════════════════');
  console.log('  USUARIO CREADO EXITOSAMENTE');
  console.log('═══════════════════════════════════');
  console.log('');
  console.log('📋 CREDENCIALES:');
  console.log('   Email: admin@test.com');
  console.log('   Contraseña: admin123');
  console.log('   Rol: ADMIN');
  console.log('');
  console.log('✅ Este usuario SÍ puede iniciar sesión');
  console.log('');
}

createTestAdmin();
