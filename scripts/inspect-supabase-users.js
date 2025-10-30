const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectUsers() {
  try {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 INSPECCIONANDO TABLA USERS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Intentar obtener un usuario sin especificar columnas
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*')
      .limit(3);

    if (usersError) {
      console.error('❌ Error:', usersError.message);
      console.log('\n🔍 Posibles razones:');
      console.log('  - La tabla no existe');
      console.log('  - No hay permisos');
      console.log('  - La tabla se llama diferente (ej: profiles, accounts)');
    } else {
      console.log(`✅ Encontrados ${users.length} usuarios\n`);
      if (users.length > 0) {
        console.log('📊 COLUMNAS REALES:');
        console.log(Object.keys(users[0]));
        console.log('\n📄 PRIMER USUARIO:');
        console.log(JSON.stringify(users[0], null, 2));
      }
    }

    // Intentar con auth.users (tabla del sistema de autenticación)
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 VERIFICANDO AUTH.USERS (sistema)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
      console.error('❌ Error:', authError.message);
    } else {
      console.log(`✅ Encontrados ${authUsers.users.length} usuarios de auth\n`);
      authUsers.users.forEach(u => {
        console.log(`  - ID: ${u.id}`);
        console.log(`    Email: ${u.email || 'sin email'}`);
        console.log(`    Role: ${u.role || 'sin rol'}`);
        console.log('');
      });
    }

    // Probar con vouchers incluyendo relaciones
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 VOUCHERS CON RELACIONES');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const { data: vouchersWithRels, error: vouchersError } = await supabase
      .from('vouchers')
      .select(`
        voucher_code,
        amount,
        currency,
        status,
        issued_at,
        issued_by_user_id,
        issued_at_station_id
      `)
      .limit(3);

    if (vouchersError) {
      console.error('❌ Error:', vouchersError.message);
    } else {
      console.log(`✅ ${vouchersWithRels.length} vouchers:\n`);
      vouchersWithRels.forEach(v => {
        console.log(`  ${v.voucher_code}`);
        console.log(`    Usuario ID: ${v.issued_by_user_id}`);
        console.log(`    Station ID: ${v.issued_at_station_id}`);
        console.log('');
      });
    }

  } catch (error) {
    console.error('❌ Error general:', error.message);
  }
}

inspectUsers();
