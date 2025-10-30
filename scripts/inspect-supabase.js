const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔍 INSPECCIONANDO SUPABASE');
console.log('URL:', supabaseUrl);
console.log('');

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectSupabase() {
  try {
    // 1. Verificar tabla vouchers
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 TABLA: vouchers');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const { data: vouchers, error: vouchersError } = await supabase
      .from('vouchers')
      .select('*')
      .limit(3);

    if (vouchersError) {
      console.error('❌ Error consultando vouchers:', vouchersError.message);
    } else {
      console.log(`✅ Encontrados ${vouchers.length} vouchers`);
      if (vouchers.length > 0) {
        console.log('\n📊 ESTRUCTURA (columnas encontradas):');
        console.log(Object.keys(vouchers[0]));
        console.log('\n📄 EJEMPLO DE REGISTRO:');
        console.log(JSON.stringify(vouchers[0], null, 2));
      } else {
        console.log('⚠️ No hay vouchers en la tabla');
      }
    }

    // 2. Verificar tabla tickets (si existe)
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 TABLA: tickets');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const { data: tickets, error: ticketsError } = await supabase
      .from('tickets')
      .select('*')
      .limit(3);

    if (ticketsError) {
      console.log('❌ Tabla tickets no existe o error:', ticketsError.message);
    } else {
      console.log(`✅ Encontrados ${tickets.length} tickets`);
      if (tickets.length > 0) {
        console.log('\n📊 ESTRUCTURA (columnas encontradas):');
        console.log(Object.keys(tickets[0]));
        console.log('\n📄 EJEMPLO DE REGISTRO:');
        console.log(JSON.stringify(tickets[0], null, 2));
      } else {
        console.log('⚠️ No hay tickets en la tabla');
      }
    }

    // 3. Verificar tabla users
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 TABLA: users');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, username, role')
      .limit(3);

    if (usersError) {
      console.log('❌ Tabla users no existe o error:', usersError.message);
    } else {
      console.log(`✅ Encontrados ${users.length} usuarios`);
      if (users.length > 0) {
        console.log('\n📊 ESTRUCTURA (columnas encontradas):');
        console.log(Object.keys(users[0]));
        console.log('\n📄 EJEMPLOS:');
        users.forEach(u => {
          console.log(`  - ${u.username || u.email} (${u.role || 'sin rol'})`);
        });
      }
    }

    // 4. Verificar tabla stations
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 TABLA: stations');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const { data: stations, error: stationsError } = await supabase
      .from('stations')
      .select('*')
      .limit(5);

    if (stationsError) {
      console.log('❌ Tabla stations no existe o error:', stationsError.message);
    } else {
      console.log(`✅ Encontrados ${stations.length} stations`);
      if (stations.length > 0) {
        console.log('\n📊 ESTRUCTURA (columnas encontradas):');
        console.log(Object.keys(stations[0]));
        console.log('\n📄 EJEMPLOS:');
        stations.forEach(s => {
          console.log(`  - ID: ${s.id}, Nombre: ${s.name || 'sin nombre'}`);
        });
      }
    }

    // 5. Contar registros por estado en vouchers
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 ESTADÍSTICAS DE VOUCHERS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const { count: totalVouchers } = await supabase
      .from('vouchers')
      .select('*', { count: 'exact', head: true });

    console.log(`Total vouchers: ${totalVouchers || 0}`);

    const { count: activeCount } = await supabase
      .from('vouchers')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    const { count: redeemedCount } = await supabase
      .from('vouchers')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'redeemed');

    const { count: cancelledCount } = await supabase
      .from('vouchers')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'cancelled');

    console.log(`  - Active: ${activeCount || 0}`);
    console.log(`  - Redeemed: ${redeemedCount || 0}`);
    console.log(`  - Cancelled: ${cancelledCount || 0}`);

    // 6. Últimos 5 vouchers creados
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📅 ÚLTIMOS 5 VOUCHERS CREADOS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const { data: recentVouchers } = await supabase
      .from('vouchers')
      .select('voucher_code, amount, currency, status, issued_at')
      .order('issued_at', { ascending: false })
      .limit(5);

    if (recentVouchers && recentVouchers.length > 0) {
      recentVouchers.forEach(v => {
        const fecha = new Date(v.issued_at).toLocaleString('es-DO');
        console.log(`  ${v.voucher_code} - ${v.currency} ${v.amount} - ${v.status} - ${fecha}`);
      });
    } else {
      console.log('  ⚠️ No hay vouchers recientes');
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ INSPECCIÓN COMPLETADA');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('❌ Error general:', error.message);
    console.error(error);
  }
}

inspectSupabase();
