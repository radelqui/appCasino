const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function resetAdminPassword() {
  console.log('\n🔧 Buscando usuario admin@casino.com...\n');

  // Primero, obtener el ID del usuario
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('id, email, full_name')
    .eq('email', 'admin@casino.com')
    .single();

  if (userError || !userData) {
    console.error('❌ Usuario admin@casino.com NO existe en tabla users');
    return;
  }

  console.log('✅ Usuario encontrado:');
  console.log(`   ID: ${userData.id}`);
  console.log(`   Email: ${userData.email}`);
  console.log(`   Nombre: ${userData.full_name}`);
  console.log('');

  // Resetear contraseña
  console.log('🔑 Reseteando contraseña a: admin123\n');

  const { data, error } = await supabase.auth.admin.updateUserById(
    userData.id,
    { password: 'admin123' }
  );

  if (error) {
    console.error('❌ Error reseteando contraseña:', error.message);
    return;
  }

  console.log('✅ Contraseña reseteada exitosamente!');
  console.log('');
  console.log('📋 CREDENCIALES PARA INICIAR SESIÓN:');
  console.log('   Email: admin@casino.com');
  console.log('   Contraseña: admin123');
  console.log('');
}

resetAdminPassword();
