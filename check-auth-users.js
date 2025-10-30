const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkUsers() {
  const { data, error } = await supabase.auth.admin.listUsers();

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  console.log('\n📋 Usuarios en Supabase Auth:\n');
  data.users.forEach(u => {
    console.log(`📧 Email: ${u.email}`);
    console.log(`   ✅ Confirmado: ${u.email_confirmed_at ? 'SÍ' : 'NO'}`);
    console.log(`   📅 Creado: ${u.created_at}`);
    console.log(`   🆔 ID: ${u.id}`);
    console.log('');
  });
}

checkUsers();
