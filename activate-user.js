const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function activateUser(email) {
  console.log(`\n🔧 Activando usuario: ${email}\n`);

  // Activar usuario
  const { data, error } = await supabase
    .from('users')
    .update({ is_active: true })
    .eq('email', email)
    .select()
    .single();

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  console.log('✅ Usuario activado exitosamente');
  console.log(`   Email: ${data.email}`);
  console.log(`   Nombre: ${data.full_name}`);
  console.log(`   Activo: ${data.is_active}`);
  console.log('');
}

// Activar admin@test.com
activateUser('admin@test.com');
