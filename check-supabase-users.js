#!/usr/bin/env node
/**
 * Verificar usuarios en Supabase
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

async function checkUsers() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('USUARIOS EN SUPABASE');
  console.log('═══════════════════════════════════════════════════════\n');

  // Listar usuarios en auth.users
  console.log('[1/2] Usuarios en auth.users (Supabase Auth):');
  const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

  if (authError) {
    console.error('❌ Error:', authError.message);
  } else {
    console.log(`\n✅ ${authUsers.users.length} usuarios encontrados:\n`);
    authUsers.users.forEach((u, idx) => {
      console.log(`${idx + 1}. Email: ${u.email}`);
      console.log(`   ID: ${u.id}`);
      console.log(`   Created: ${new Date(u.created_at).toLocaleString()}`);
      console.log(`   Confirmed: ${u.email_confirmed_at ? 'SÍ' : 'NO'}`);
      console.log('');
    });
  }

  // Listar usuarios en tabla users
  console.log('\n[2/2] Usuarios en tabla "users" (Perfiles):');
  const { data: profiles, error: profileError } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false });

  if (profileError) {
    console.error('❌ Error:', profileError.message);
  } else {
    console.log(`\n✅ ${profiles.length} perfiles encontrados:\n`);
    console.table(profiles.map(p => ({
      email: p.email,
      full_name: p.full_name,
      role: p.role,
      is_active: p.is_active ? 'SÍ' : 'NO'
    })));
  }

  console.log('\n═══════════════════════════════════════════════════════');
}

checkUsers().then(() => {
  console.log('\n✅ Verificación completada\n');
  process.exit(0);
}).catch(err => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
