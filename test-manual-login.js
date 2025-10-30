const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function testManualLogin() {
  console.log('\n🔧 VERIFICACIÓN 1: Probar login manualmente\n');

  // Crear cliente con ANON key (como lo hace la app)
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );

  console.log('📋 Datos de conexión:');
  console.log('   URL:', process.env.SUPABASE_URL);
  console.log('   ANON_KEY:', process.env.SUPABASE_ANON_KEY?.substring(0, 20) + '...');
  console.log('');

  // Probar con la contraseña que mencionaste (PIN 4444)
  console.log('🔐 Intentando login con: central@coral.com / 4444');

  const result = await supabase.auth.signInWithPassword({
    email: 'central@coral.com',
    password: '4444'
  });

  console.log('\n📦 Resultado completo:');
  console.log(JSON.stringify(result, null, 2));

  if (result.error) {
    console.log('\n❌ ERROR:', result.error.message);
    console.log('   Código:', result.error.status);
  } else {
    console.log('\n✅ LOGIN EXITOSO');
    console.log('   Email:', result.data.user.email);
    console.log('   ID:', result.data.user.id);
    console.log('   Confirmado:', result.data.user.email_confirmed_at ? 'SÍ' : 'NO');
  }
}

testManualLogin().catch(e => console.error('Error fatal:', e));
