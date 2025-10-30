const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Simular exactamente lo que hace el handler auth:login
async function simulateHandler(username, password) {
  console.log('\n🔍 SIMULANDO HANDLER auth:login\n');
  console.log(`📧 Username: ${username}`);
  console.log(`🔑 Password: ${password ? '***' : '(vacío)'}`);
  console.log('');

  // Crear cliente con SERVICE_ROLE (como lo hace supabaseManager)
  const supabaseManager = {
    client: createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
  };

  try {
    console.log('1️⃣ Llamando signInWithPassword...');

    // Login con Supabase Auth (línea 84-87)
    const { data, error } = await supabaseManager.client.auth.signInWithPassword({
      email: username,
      password: password
    });

    if (error) {
      console.log(`   ❌ Error: ${error.message}`);
      console.log('   🔙 RETORNARÍA: { success: false, error: "Email o contraseña incorrectos" }');
      return { success: false, error: 'Email o contraseña incorrectos' };
    }

    console.log(`   ✅ Auth exitoso, User ID: ${data.user.id}`);
    console.log('');

    console.log('2️⃣ Obteniendo perfil de tabla users...');

    // Obtener perfil del usuario (usando maybeSingle)
    const { data: profile, error: profileError } = await supabaseManager.client
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .maybeSingle();

    console.log(`   profileError: ${profileError ? profileError.message : 'null'}`);
    console.log(`   profile: ${profile ? JSON.stringify(profile, null, 2) : 'null'}`);
    console.log('');

    console.log('3️⃣ Verificando condición (línea 101)...');
    console.log(`   profileError existe: ${!!profileError}`);
    console.log(`   profile.is_active: ${profile?.is_active}`);
    console.log(`   !profile.is_active: ${!profile?.is_active}`);
    console.log(`   Condición (profileError || !profile.is_active): ${profileError || !profile?.is_active}`);
    console.log('');

    // Validar (línea 101-104)
    if (profileError || !profile.is_active) {
      console.log('   ❌ ENTRA EN EL IF');
      console.log('   🔙 RETORNARÍA: { success: false, error: "Usuario inactivo" }');
      return { success: false, error: 'Usuario inactivo' };
    }

    console.log('   ✅ NO ENTRA EN EL IF, continúa...');
    console.log('');

    // Guardar sesión (línea 107-114)
    const currentSession = {
      user: {
        id: profile.id,
        email: profile.email,
        username: profile.full_name,
        role: profile.role.toUpperCase()
      }
    };

    console.log('4️⃣ Login exitoso!');
    console.log(`   Session: ${JSON.stringify(currentSession, null, 2)}`);
    console.log('');
    console.log('   🔙 RETORNARÍA: { success: true, user: ... }');

    return {
      success: true,
      user: currentSession.user
    };

  } catch (error) {
    console.error('   ❌ Error en try-catch:', error);
    return { success: false, error: error.message };
  }
}

// Probar con admin@test.com
simulateHandler('admin@test.com', 'admin123');
