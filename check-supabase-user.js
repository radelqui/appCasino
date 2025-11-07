require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('❌ Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function checkUser() {
  console.log('═══════════════════════════════════════════');
  console.log('VERIFICACIÓN: admin@test.com EN SUPABASE');
  console.log('═══════════════════════════════════════════');
  console.log('');

  // 1. Verificar en tabla users
  console.log('1. Verificando tabla users...');
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('*')
    .eq('email', 'admin@test.com')
    .maybeSingle();

  if (usersError) {
    console.log('  ❌ Error:', usersError.message);
  } else if (users) {
    console.log('  ✅ Usuario encontrado en tabla users:');
    console.log('    ID:', users.id);
    console.log('    Email:', users.email);
    console.log('    Full Name:', users.full_name);
    console.log('    Role:', users.role);
    console.log('    Active:', users.is_active);
  } else {
    console.log('  ❌ Usuario NO encontrado en tabla users');
  }

  console.log('');

  // 2. Listar todos los usuarios en tabla users
  console.log('2. Listando todos los usuarios en tabla users...');
  const { data: allUsers, error: allError } = await supabase
    .from('users')
    .select('email, full_name, role')
    .order('email');

  if (allError) {
    console.log('  ❌ Error:', allError.message);
  } else {
    console.log('  Total usuarios:', allUsers.length);
    allUsers.forEach(u => console.log('    -', u.email, '|', u.full_name, '|', u.role));
  }

  console.log('');

  // 3. Intentar login con Supabase Auth (usando ANON key)
  console.log('3. Probando login con Supabase Auth...');
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (anonKey) {
    const anonClient = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data: authData, error: authError } = await anonClient.auth.signInWithPassword({
      email: 'admin@test.com',
      password: 'admin1234'
    });

    if (authError) {
      console.log('  ❌ Login falló:', authError.message);
    } else {
      console.log('  ✅ Login exitoso!');
      console.log('    User ID:', authData.user.id);
      console.log('    Email:', authData.user.email);
    }
  } else {
    console.log('  ⚠️  SUPABASE_ANON_KEY no configurada');
  }
}

checkUser().catch(console.error);
