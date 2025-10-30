const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkAll() {
  console.log('\n=== USUARIOS EN SUPABASE AUTH ===\n');

  try {
    const { data, error } = await supabase.auth.admin.listUsers();

    if (error) {
      console.error('❌ Error:', error.message);
      return;
    }

    if (data.users.length === 0) {
      console.log('⚠️  No hay usuarios en Auth');
    } else {
      data.users.forEach(u => {
        console.log(`📧 ${u.email}`);
        console.log(`   Confirmado: ${u.email_confirmed_at ? 'SÍ' : 'NO'}`);
        console.log(`   Creado: ${u.created_at}`);
        console.log('');
      });
    }
  } catch (e) {
    console.error('❌ Error:', e.message);
  }
}

checkAll();
