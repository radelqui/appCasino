const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function debugUser() {
  console.log('\n🔍 DIAGNÓSTICO COMPLETO\n');

  // 1. Verificar conexión a Supabase
  console.log('1️⃣ VERIFICANDO CONEXIÓN A SUPABASE:');
  console.log(`   URL: ${process.env.SUPABASE_URL}`);
  console.log(`   ANON_KEY: ${process.env.SUPABASE_ANON_KEY?.substring(0, 20)}...`);
  console.log('');

  const supabaseAuth = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );

  const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // 2. Intentar login
  console.log('2️⃣ INTENTANDO LOGIN CON admin@test.com:');
  const { data: authData, error: authError } = await supabaseAuth.auth.signInWithPassword({
    email: 'admin@test.com',
    password: 'admin123'
  });

  if (authError) {
    console.log(`   ❌ Error de Auth: ${authError.message}`);
    return;
  }

  console.log(`   ✅ Login exitoso en Auth`);
  console.log(`   User ID: ${authData.user.id}`);
  console.log(`   Email: ${authData.user.email}`);
  console.log(`   Email confirmado: ${authData.user.email_confirmed_at ? 'SÍ' : 'NO'}`);
  console.log('');

  // 3. Obtener perfil del usuario
  console.log('3️⃣ OBTENIENDO PERFIL DE TABLA users:');
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('id', authData.user.id)
    .single();

  if (profileError) {
    console.log(`   ❌ Error obteniendo perfil: ${profileError.message}`);
    console.log(`   Código: ${profileError.code}`);
    console.log(`   Detalles: ${profileError.details}`);
    return;
  }

  console.log(`   ✅ Perfil encontrado`);
  console.log(`   ID: ${profile.id}`);
  console.log(`   Email: ${profile.email}`);
  console.log(`   Nombre: ${profile.full_name}`);
  console.log(`   Rol: ${profile.role}`);
  console.log(`   is_active: ${profile.is_active}`);
  console.log(`   PIN: ${profile.pin_code}`);
  console.log('');

  // 4. Verificar por qué fallaría
  console.log('4️⃣ ANÁLISIS:');
  if (!profile.is_active) {
    console.log('   ❌ EL PROBLEMA: is_active es FALSE');
  } else {
    console.log('   ✅ is_active es TRUE - debería funcionar');
  }
}

debugUser();
