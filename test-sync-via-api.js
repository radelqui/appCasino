// Script de sincronización que usa IPC handler en vez de importar better-sqlite3 directamente
// Este script debe ejecutarse MIENTRAS la app Electron está corriendo

const { app: electronApp } = require('electron');

console.log('⚠️  NOTA: Este script debe ejecutarse usando un handler IPC dentro de la app Electron.');
console.log('⚠️  Por favor, usa el handler "sync-all-pending" desde la interfaz de la aplicación.');
console.log('⚠️  O ejecuta desde Developer Tools: await window.api.invoke("sync-all-pending")');
console.log('\n');
console.log('📝 Agregando handler a pure/main.js...');
console.log('\n');
console.log('Código a agregar en pure/main.js:');
console.log(`
// ============================================
// HANDLER: Sincronización masiva de tickets pendientes
// ============================================
safeIpcHandle('sync-all-pending', async () => {
  console.log('🚀 Iniciando sincronización masiva...');

  try {
    if (!db) {
      throw new Error('Base de datos SQLite no disponible');
    }

    if (!supabaseManager || !supabaseManager.isAvailable()) {
      throw new Error('Supabase no está disponible');
    }

    // Obtener tickets pendientes
    const pending = db.prepare('SELECT * FROM tickets WHERE sincronizado = 0 OR sincronizado IS NULL').all();

    console.log(\`📊 Tickets pendientes: \${pending.length}\`);

    if (pending.length === 0) {
      return {
        success: true,
        message: 'No hay tickets pendientes',
        synced: 0,
        failed: 0
      };
    }

    let synced = 0;
    let failed = 0;
    const errors = [];

    for (const ticket of pending) {
      try {
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

        const { data, error } = await supabaseManager.client
          .from('vouchers')
          .insert(voucherData)
          .select();

        if (error) {
          if (error.code === '23505') { // Duplicate key
            const { error: updateError } = await supabaseManager.client
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
              errors.push({ code: ticket.code, error: updateError.message });
            }
          } else {
            failed++;
            errors.push({ code: ticket.code, error: error.message });
          }
        } else {
          db.prepare('UPDATE tickets SET sincronizado = 1 WHERE id = ?').run(ticket.id);
          synced++;
        }

        if ((synced + failed) % 100 === 0) {
          console.log(\`📈 Progreso: \${synced + failed}/\${pending.length} (✅ \${synced} | ❌ \${failed})\`);
        }

        // Pausa para no saturar
        if (synced % 50 === 0) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }

      } catch (error) {
        failed++;
        errors.push({ code: ticket.code, error: error.message });
      }
    }

    console.log('\\n' + '='.repeat(60));
    console.log('📊 RESUMEN DE SINCRONIZACIÓN');
    console.log('='.repeat(60));
    console.log(\`Total: \${pending.length}\`);
    console.log(\`✅ Exitosos: \${synced}\`);
    console.log(\`❌ Fallidos: \${failed}\`);
    console.log(\`📈 Tasa de éxito: \${((synced / pending.length) * 100).toFixed(1)}%\`);

    return {
      success: true,
      synced,
      failed,
      total: pending.length,
      errors: errors.slice(0, 10) // Primeros 10 errores
    };

  } catch (error) {
    console.error('❌ Error en sincronización masiva:', error);
    return {
      success: false,
      error: error.message
    };
  }
});
`);

process.exit(0);
