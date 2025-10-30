const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function resetPassword() {
  console.log('\n🔧 RESETEANDO contraseña para central@coral.com\n');

  // Resetear contraseña a una conocida: "admin123"
  const { data, error } = await supabase.auth.admin.updateUserById(
    '1d26dbfc-e77e-4ed0-bd5a-346c24e141f2',
    { password: 'admin123' }
  );

  if (error) {
    console.error('❌ Error reseteando contraseña:', error.message);
    return;
  }

  console.log('✅ Contraseña reseteada exitosamente');
  console.log('📧 Email: central@coral.com');
  console.log('🔑 Nueva contraseña: admin123');
  console.log('');

  // Probar login con la nueva contraseña
  console.log('🧪 Probando login con nueva contraseña...\n');

  const supabaseClient = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );

  const result = await supabaseClient.auth.signInWithPassword({
    email: 'central@coral.com',
    password: 'admin123'
  });

  if (result.error) {
    console.error('❌ Login falló:', result.error.message);
  } else {
    console.log('✅ LOGIN EXITOSO con la nueva contraseña!');
    console.log('📧 Email:', result.data.user.email);
    console.log('🆔 ID:', result.data.user.id);
  }
}

resetPassword();
