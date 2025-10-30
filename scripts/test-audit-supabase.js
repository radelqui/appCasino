const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🧪 PROBANDO QUERY DE AUDITORÍA CORREGIDO\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

async function testAuditQuery() {
  try {
    // Simular el query corregido (SIN joins)
    console.log('📋 Query: SELECT * FROM vouchers (sin joins)');

    let query = supabase
      .from('vouchers')
      .select('*', { count: 'exact' });

    // Aplicar filtros de fecha (últimos 7 días)
    const hoy = new Date();
    const hace7dias = new Date(hoy);
    hace7dias.setDate(hoy.getDate() - 7);

    query = query
      .gte('issued_at', hace7dias.toISOString())
      .lte('issued_at', hoy.toISOString());

    query = query.order('issued_at', { ascending: false }).limit(20);

    console.log('📋 Filtros aplicados:');
    console.log(`  - Desde: ${hace7dias.toISOString()}`);
    console.log(`  - Hasta: ${hoy.toISOString()}`);
    console.log('  - Límite: 20\n');

    const { data, error, count } = await query;

    if (error) {
      console.error('❌ ERROR EN QUERY:');
      console.error('  Mensaje:', error.message);
      console.error('  Detalles:', error.details);
      console.error('  Hint:', error.hint);
      return;
    }

    console.log(`✅ QUERY EXITOSO: ${data.length} vouchers obtenidos de ${count} totales\n`);

    if (data.length > 0) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📊 VOUCHERS ENCONTRADOS:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      data.forEach((v, index) => {
        console.log(`${index + 1}. ${v.voucher_code}`);
        console.log(`   Monto: ${v.currency} ${v.amount}`);
        console.log(`   Estado: ${v.status}`);
        console.log(`   Emitido: ${new Date(v.issued_at).toLocaleString('es-DO')}`);
        console.log(`   Station ID: ${v.issued_at_station_id || 'N/A'}`);
        console.log(`   Usuario ID: ${v.issued_by_user_id || 'N/A'}`);
        console.log(`   Customer: ${v.customer_name || 'N/A'}`);
        if (v.redeemed_at) {
          console.log(`   Canjeado: ${new Date(v.redeemed_at).toLocaleString('es-DO')}`);
        }
        console.log('');
      });

      // Probar función de mapeo
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🔄 PROBANDO FUNCIÓN DE MAPEO:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      function mapearVouchersSupabase(vouchers) {
        return vouchers.map(v => ({
          code: v.voucher_code,
          amount: v.amount,
          currency: v.currency,
          estado: v.status === 'active' ? 'emitido' :
                  v.status === 'redeemed' ? 'canjeado' :
                  v.status === 'cancelled' ? 'cancelado' : v.status,
          created_at: v.issued_at,
          used_at: v.redeemed_at,
          mesa: v.issued_at_station_id ? `Mesa ${v.issued_at_station_id}` : 'N/A',
          operador: v.customer_name || (v.issued_by_user_id ? `Usuario ${v.issued_by_user_id.substring(0, 8)}` : 'N/A')
        }));
      }

      const mapped = mapearVouchersSupabase(data);

      console.log('✅ Tickets mapeados para frontend:\n');
      mapped.slice(0, 3).forEach((t, index) => {
        console.log(`${index + 1}. Código: ${t.code}`);
        console.log(`   Monto: ${t.currency} ${t.amount}`);
        console.log(`   Estado: ${t.estado}`);
        console.log(`   Mesa: ${t.mesa}`);
        console.log(`   Operador: ${t.operador}`);
        console.log(`   Creado: ${new Date(t.created_at).toLocaleString('es-DO')}`);
        console.log('');
      });

      // Estadísticas
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📊 ESTADÍSTICAS:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      const stats = {
        total: mapped.length,
        emitidos: mapped.filter(t => t.estado === 'emitido').length,
        canjeados: mapped.filter(t => t.estado === 'canjeado').length,
        cancelados: mapped.filter(t => t.estado === 'cancelado').length,
        totalDOP: mapped.filter(t => t.currency === 'DOP').reduce((sum, t) => sum + t.amount, 0),
        totalUSD: mapped.filter(t => t.currency === 'USD').reduce((sum, t) => sum + t.amount, 0)
      };

      console.log(`  Total tickets: ${stats.total}`);
      console.log(`  Emitidos: ${stats.emitidos}`);
      console.log(`  Canjeados: ${stats.canjeados}`);
      console.log(`  Cancelados: ${stats.cancelados}`);
      console.log(`  Total DOP: ${stats.totalDOP.toFixed(2)}`);
      console.log(`  Total USD: ${stats.totalUSD.toFixed(2)}`);
    } else {
      console.log('⚠️ No se encontraron vouchers en el rango de fechas');
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ PRUEBA COMPLETADA EXITOSAMENTE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('❌ ERROR EN PRUEBA:');
    console.error(error);
  }
}

testAuditQuery();
