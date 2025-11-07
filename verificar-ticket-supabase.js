/**
 * Verificar si ticket PREV-3683507 está en Supabase
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ ERROR: Variables de entorno Supabase no configuradas');
  console.log('   SUPABASE_URL:', supabaseUrl ? 'OK' : 'FALTA');
  console.log('   SUPABASE_KEY:', supabaseKey ? 'OK' : 'FALTA');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verificarTicket(code) {
  console.log('═══════════════════════════════════════════════════════');
  console.log('VERIFICAR TICKET EN SUPABASE');
  console.log('═══════════════════════════════════════════════════════\n');

  console.log('🔍 Buscando ticket:', code);
  console.log('');

  // Buscar en tabla tickets
  console.log('[1/2] Buscando en tabla tickets...');
  const { data: ticketsData, error: ticketsError } = await supabase
    .from('tickets')
    .select('*')
    .eq('code', code);

  if (ticketsError) {
    console.error('❌ Error:', ticketsError.message);
  } else if (ticketsData && ticketsData.length > 0) {
    console.log('✅ ENCONTRADO en tickets:');
    console.table(ticketsData);
  } else {
    console.log('⚠️  NO encontrado en tabla tickets');
  }

  console.log('');

  // Buscar en tabla vouchers
  console.log('[2/2] Buscando en tabla vouchers...');
  const { data: vouchersData, error: vouchersError } = await supabase
    .from('vouchers')
    .select('*')
    .eq('voucher_code', code);

  if (vouchersError) {
    console.error('❌ Error:', vouchersError.message);
  } else if (vouchersData && vouchersData.length > 0) {
    console.log('✅ ENCONTRADO en vouchers:');
    console.table(vouchersData);
  } else {
    console.log('⚠️  NO encontrado en tabla vouchers');
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════');

  // Listar últimos 5 tickets para referencia
  console.log('');
  console.log('📋 ÚLTIMOS 5 TICKETS CREADOS EN SUPABASE:');
  console.log('─────────────────────────────────────────────────────');

  const { data: recentTickets } = await supabase
    .from('tickets')
    .select('code, amount, currency, created_at, table_number')
    .order('created_at', { ascending: false })
    .limit(5);

  if (recentTickets && recentTickets.length > 0) {
    console.table(recentTickets);
  } else {
    console.log('⚠️  No hay tickets en Supabase');
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════');
}

// Ticket a buscar
const ticketCode = process.argv[2] || 'PREV-3683507';
verificarTicket(ticketCode).then(() => {
  console.log('\n✅ Verificación completada\n');
  process.exit(0);
}).catch(err => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
