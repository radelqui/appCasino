const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function confirmUser(userId) {
  const { data, error } = await supabase.auth.admin.updateUserById(
    userId,
    { email_confirm: true }
  );

  if (error) {
    console.error('❌ Error confirmando usuario:', error.message);
    return;
  }

  console.log('✅ Usuario confirmado exitosamente');
  console.log('📧 Email:', data.user.email);
  console.log('✅ Confirmado:', data.user.email_confirmed_at ? 'SÍ' : 'NO');
}

// ID del usuario central@coral.com
confirmUser('1d26dbfc-e77e-4ed0-bd5a-346c24e141f2');
