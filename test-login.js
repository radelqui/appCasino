const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY // Usar ANON key, no SERVICE_ROLE
);

async function testLogin(email, password) {
  console.log(`\n🔐 Intentando login: ${email}`);

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email,
    password: password
  });

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  console.log('✅ Login exitoso!');
  console.log('📧 Email:', data.user.email);
  console.log('🆔 ID:', data.user.id);

  // Obtener perfil
  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', data.user.id)
    .single();

  if (profile) {
    console.log('👤 Nombre:', profile.full_name);
    console.log('🎭 Rol:', profile.role);
    console.log('✅ Activo:', profile.is_active);
  }
}

// Probar con el usuario que acabamos de confirmar
testLogin('central@coral.com', 'la_contraseña_que_usaste');
