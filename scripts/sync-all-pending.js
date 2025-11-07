const path = require('path');
const fs = require('fs');

// Importar base de datos SQLite
const Database = require('better-sqlite3');

// Importar Supabase
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function syncAllPending() {
  console.log('🚀 Iniciando sincronización masiva...\n');

  // Conectar a SQLite principal
  const dbPath = path.join(__dirname, '..', 'data', 'casino.db');
  const db = new Database(dbPath);

  // Obtener tickets pendientes
  const pending = db.prepare('SELECT * FROM tickets WHERE sincronizado = 0 OR sincronizado IS NULL').all();

  console.log(`📊 Tickets pendientes de sincronizar: ${pending.length}\n`);

  if (pending.length === 0) {
    console.log('✅ No hay tickets pendientes');
    db.close();
    return;
  }

  let synced = 0;
  let failed = 0;
  let errors = [];

  for (const ticket of pending) {
    try {
      // Preparar datos para Supabase
      const voucherData = {
        voucher_code: ticket.code || ticket.ticket_number,
        amount: parseFloat(ticket.amount),
        currency: ticket.currency || 'DOP',
        status: ticket.estado === 'cobrado' || ticket.estado === 'usado' ? 'redeemed' : 'active',
        issued_at: ticket.fecha_emision || ticket.created_at || new Date().toISOString(),
        created_at: ticket.created_at || new Date().toISOString(),
        redeemed_at: ticket.redeemed_at || null,
        mesa_nombre: ticket.mesa || null,
        operador_nombre: ticket.usuario_emision || ticket.operador || null
      };

      // Insertar en Supabase
      const { data, error } = await supabase
        .from('vouchers')
        .insert(voucherData)
        .select();

      if (error) {
        // Si ya existe, intentar actualizar
        if (error.code === '23505') { // Duplicate key
          const { error: updateError } = await supabase
            .from('vouchers')
            .update({
              status: voucherData.status,
              redeemed_at: voucherData.redeemed_at
            })
            .eq('voucher_code', voucherData.voucher_code);

          if (!updateError) {
            db.prepare('UPDATE tickets SET sincronizado = 1 WHERE id = ?').run(ticket.id);
            synced++;
          } else {
            failed++;
            errors.push({ code: ticket.code || ticket.ticket_number, error: updateError.message });
          }
        } else {
          failed++;
          errors.push({ code: ticket.code || ticket.ticket_number, error: error.message });
        }
      } else {
        // Marcar como sincronizado en SQLite
        db.prepare('UPDATE tickets SET sincronizado = 1 WHERE id = ?').run(ticket.id);
        synced++;
      }

      // Mostrar progreso cada 100 tickets
      if ((synced + failed) % 100 === 0) {
        console.log(`📈 Progreso: ${synced + failed}/${pending.length} (✅ ${synced} | ❌ ${failed})`);
      }

      // Pequeña pausa para no saturar Supabase
      if (synced % 50 === 0) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }

    } catch (error) {
      failed++;
      errors.push({ code: ticket.code || ticket.ticket_number, error: error.message });
    }
  }

  db.close();

  console.log('\n' + '='.repeat(60));
  console.log('📊 RESUMEN DE SINCRONIZACIÓN');
  console.log('='.repeat(60));
  console.log(`Total procesados: ${pending.length}`);
  console.log(`✅ Exitosos: ${synced}`);
  console.log(`❌ Fallidos: ${failed}`);
  console.log(`📈 Tasa de éxito: ${((synced / pending.length) * 100).toFixed(1)}%`);

  if (errors.length > 0 && errors.length <= 10) {
    console.log('\n❌ ERRORES:');
    errors.forEach(e => {
      console.log(`  - ${e.code}: ${e.error}`);
    });
  } else if (errors.length > 10) {
    console.log(`\n❌ ${errors.length} errores (mostrando primeros 10):`);
    errors.slice(0, 10).forEach(e => {
      console.log(`  - ${e.code}: ${e.error}`);
    });
  }

  console.log('\n✅ Sincronización completada');
}

// Ejecutar
syncAllPending()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Error fatal:', err);
    process.exit(1);
  });
