#!/usr/bin/env node
/**
 * Sincronizar todos los tickets pendientes de SQLite a Supabase
 */

const path = require('path');
const Database = require('better-sqlite3');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: Variables de entorno no configuradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const dbPath = process.env.CASINO_DB_PATH ||
               process.env.SQLITE_DB_PATH ||
               path.join(process.cwd(), 'data', 'casino.db');

console.log('═══════════════════════════════════════════════════════════');
console.log('   🔄 SINCRONIZACIÓN MANUAL DE TICKETS');
console.log('   SQLite → Supabase');
console.log('═══════════════════════════════════════════════════════════\n');

async function syncAllTickets() {
  const db = new Database(dbPath);

  // Obtener tickets pendientes
  const pendingTickets = db.prepare(`
    SELECT * FROM tickets
    WHERE sincronizado = 0 OR sincronizado IS NULL
    ORDER BY fecha_emision ASC
  `).all();

  console.log(`📊 Tickets pendientes: ${pendingTickets.length}\n`);

  if (pendingTickets.length === 0) {
    console.log('✅ No hay tickets pendientes de sincronización\n');
    db.close();
    return;
  }

  let syncedCount = 0;
  let failedCount = 0;
  const failed = [];

  for (const ticket of pendingTickets) {
    process.stdout.write(`Sincronizando ${ticket.code}...`.padEnd(40));

    try {
      // Mapear estado SQLite → Supabase
      const statusMap = {
        'emitido': 'active',
        'activo': 'active',
        'usado': 'redeemed',
        'canjeado': 'redeemed',
        'cancelado': 'cancelled',
        'expirado': 'expired'
      };

      const voucherData = {
        voucher_code: ticket.code,
        amount: parseFloat(ticket.amount),
        currency: ticket.currency,
        status: statusMap[ticket.estado] || 'active',
        issued_at: ticket.fecha_emision,
        redeemed_at: ticket.fecha_cobro || null,
        mesa_nombre: ticket.mesa,
        qr_data: ticket.qr_data,
        qr_hash: ticket.hash_seguridad,
        customer_notes: ticket.notas
      };

      // Insertar en Supabase
      const { data, error } = await supabase
        .from('vouchers')
        .insert(voucherData)
        .select()
        .single();

      if (error) {
        // Si ya existe, intentar actualizar
        if (error.code === '23505') {
          const { error: updateError } = await supabase
            .from('vouchers')
            .update(voucherData)
            .eq('voucher_code', ticket.code);

          if (updateError) {
            throw updateError;
          }
          console.log('✅ Actualizado');
        } else {
          throw error;
        }
      } else {
        console.log('✅ Creado');
      }

      // Marcar como sincronizado en SQLite
      db.prepare('UPDATE tickets SET sincronizado = 1 WHERE code = ?')
        .run(ticket.code);

      syncedCount++;

    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
      failedCount++;
      failed.push({ code: ticket.code, error: error.message });
    }

    // Pequeña pausa para no saturar
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  db.close();

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('   📊 RESULTADO DE LA SINCRONIZACIÓN');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log(`✅ Sincronizados:  ${syncedCount}`);
  console.log(`❌ Fallidos:       ${failedCount}`);

  if (failed.length > 0) {
    console.log('\n⚠️  TICKETS QUE FALLARON:\n');
    failed.forEach(f => {
      console.log(`   ${f.code}: ${f.error}`);
    });
  }

  console.log('\n═══════════════════════════════════════════════════════════\n');
}

syncAllTickets()
  .then(() => {
    console.log('✅ Sincronización completada\n');
  })
  .catch(error => {
    console.error('\n❌ Error fatal:', error.message);
    process.exit(1);
  });
