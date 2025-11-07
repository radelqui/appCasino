// Verificar estado de sincronización entre SQLite y Supabase
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const Database = require('better-sqlite3');
const path = require('path');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSyncStatus() {
  console.log('\n=== VERIFICACIÓN DE ESTADO DE SINCRONIZACIÓN ===\n');

  const report = {
    timestamp: new Date().toISOString(),
    sqlite: { main: {}, caja: {} },
    supabase: {},
    pending: { tickets: [], users: [], operadores: [] },
    issues: [],
    recommendations: []
  };

  try {
    // ============================================
    // 1. VERIFICAR SQLite PRINCIPAL
    // ============================================
    console.log('📁 1. Verificando SQLite principal (data/casino.db)...\n');

    const mainDbPath = path.join(__dirname, '..', 'data', 'casino.db');
    let mainDb;

    try {
      mainDb = new Database(mainDbPath);

      // Verificar columnas
      const ticketsInfo = mainDb.pragma('table_info(tickets)');
      const hasSincronizado = ticketsInfo.some(col => col.name === 'sincronizado');

      console.log(`Columna 'sincronizado' en tickets: ${hasSincronizado ? '✅ EXISTE' : '❌ NO EXISTE'}`);

      // Contar tickets
      const totalTickets = mainDb.prepare('SELECT COUNT(*) as count FROM tickets').get();
      console.log(`Total tickets: ${totalTickets.count}`);

      if (hasSincronizado) {
        const pendingTickets = mainDb.prepare('SELECT COUNT(*) as count FROM tickets WHERE sincronizado = 0').get();
        const syncedTickets = mainDb.prepare('SELECT COUNT(*) as count FROM tickets WHERE sincronizado = 1').get();

        console.log(`  Sincronizados: ${syncedTickets.count}`);
        console.log(`  Pendientes: ${pendingTickets.count}`);

        report.sqlite.main.tickets = {
          total: totalTickets.count,
          synced: syncedTickets.count,
          pending: pendingTickets.count
        };

        // Obtener tickets pendientes
        if (pendingTickets.count > 0) {
          const pending = mainDb.prepare('SELECT code, amount, currency, created_at FROM tickets WHERE sincronizado = 0 LIMIT 10').all();
          report.pending.tickets.push(...pending.map(t => ({ ...t, source: 'main' })));
        }
      } else {
        report.sqlite.main.tickets = {
          total: totalTickets.count,
          synced: 0,
          pending: totalTickets.count,
          issue: 'Columna sincronizado no existe'
        };
        report.issues.push('SQLite principal: columna sincronizado no existe en tickets');
      }

      // Verificar usuarios
      const usuariosInfo = mainDb.pragma('table_info(usuarios)');
      const hasUsuariosSinc = usuariosInfo.some(col => col.name === 'sincronizado');
      const hasUsuariosEmail = usuariosInfo.some(col => col.name === 'email');

      console.log(`\nColumna 'sincronizado' en usuarios: ${hasUsuariosSinc ? '✅ EXISTE' : '❌ NO EXISTE'}`);
      console.log(`Columna 'email' en usuarios: ${hasUsuariosEmail ? '✅ EXISTE' : '❌ NO EXISTE'}`);

      const totalUsuarios = mainDb.prepare('SELECT COUNT(*) as count FROM usuarios').get();
      console.log(`Total usuarios: ${totalUsuarios.count}`);

      if (hasUsuariosSinc) {
        const pendingUsuarios = mainDb.prepare('SELECT COUNT(*) as count FROM usuarios WHERE sincronizado = 0').get();
        const syncedUsuarios = mainDb.prepare('SELECT COUNT(*) as count FROM usuarios WHERE sincronizado = 1').get();

        console.log(`  Sincronizados: ${syncedUsuarios.count}`);
        console.log(`  Pendientes: ${pendingUsuarios.count}`);

        report.sqlite.main.usuarios = {
          total: totalUsuarios.count,
          synced: syncedUsuarios.count,
          pending: pendingUsuarios.count
        };

        // Obtener usuarios pendientes
        if (pendingUsuarios.count > 0) {
          const pending = mainDb.prepare('SELECT id, username, role, email FROM usuarios WHERE sincronizado = 0 LIMIT 10').all();
          report.pending.users.push(...pending.map(u => ({ ...u, source: 'main' })));
        }
      } else {
        report.sqlite.main.usuarios = {
          total: totalUsuarios.count,
          synced: 0,
          pending: totalUsuarios.count,
          issue: 'Columna sincronizado no existe'
        };
        report.issues.push('SQLite principal: columna sincronizado no existe en usuarios');
      }

      // Verificar operadores
      const operadoresInfo = mainDb.pragma('table_info(operadores)');
      const hasOperadoresSinc = operadoresInfo.some(col => col.name === 'sincronizado');

      console.log(`\nColumna 'sincronizado' en operadores: ${hasOperadoresSinc ? '✅ EXISTE' : '❌ NO EXISTE'}`);

      const totalOperadores = mainDb.prepare('SELECT COUNT(*) as count FROM operadores').get();
      console.log(`Total operadores: ${totalOperadores.count}`);

      if (hasOperadoresSinc) {
        const pendingOperadores = mainDb.prepare('SELECT COUNT(*) as count FROM operadores WHERE sincronizado = 0').get();
        const syncedOperadores = mainDb.prepare('SELECT COUNT(*) as count FROM operadores WHERE sincronizado = 1').get();

        console.log(`  Sincronizados: ${syncedOperadores.count}`);
        console.log(`  Pendientes: ${pendingOperadores.count}`);

        report.sqlite.main.operadores = {
          total: totalOperadores.count,
          synced: syncedOperadores.count,
          pending: pendingOperadores.count
        };

        // Obtener operadores pendientes
        if (pendingOperadores.count > 0) {
          const pending = mainDb.prepare('SELECT id, codigo, nombre FROM operadores WHERE sincronizado = 0 LIMIT 10').all();
          report.pending.operadores.push(...pending.map(o => ({ ...o, source: 'main' })));
        }
      } else {
        report.sqlite.main.operadores = {
          total: totalOperadores.count,
          synced: 0,
          pending: totalOperadores.count,
          issue: 'Columna sincronizado no existe'
        };
        report.issues.push('SQLite principal: columna sincronizado no existe en operadores');
      }

      mainDb.close();

    } catch (error) {
      console.error(`❌ Error SQLite principal: ${error.message}`);
      report.sqlite.main.error = error.message;
      report.issues.push(`SQLite principal: ${error.message}`);
    }

    // ============================================
    // 2. VERIFICAR SQLite CAJA
    // ============================================
    console.log('\n📁 2. Verificando SQLite Caja (Caja/data/casino.db)...\n');

    const cajaDbPath = path.join(__dirname, '..', 'Caja', 'data', 'casino.db');
    let cajaDb;

    try {
      cajaDb = new Database(cajaDbPath);

      // Tickets
      const totalTicketsCaja = cajaDb.prepare('SELECT COUNT(*) as count FROM tickets').get();
      console.log(`Total tickets: ${totalTicketsCaja.count}`);

      const ticketsInfoCaja = cajaDb.pragma('table_info(tickets)');
      const hasSincCaja = ticketsInfoCaja.some(col => col.name === 'sincronizado');

      if (hasSincCaja) {
        const pendingCaja = cajaDb.prepare('SELECT COUNT(*) as count FROM tickets WHERE sincronizado = 0').get();
        const syncedCaja = cajaDb.prepare('SELECT COUNT(*) as count FROM tickets WHERE sincronizado = 1').get();

        console.log(`  Sincronizados: ${syncedCaja.count}`);
        console.log(`  Pendientes: ${pendingCaja.count}`);

        report.sqlite.caja.tickets = {
          total: totalTicketsCaja.count,
          synced: syncedCaja.count,
          pending: pendingCaja.count
        };
      }

      // Usuarios
      const totalUsuariosCaja = cajaDb.prepare('SELECT COUNT(*) as count FROM usuarios').get();
      console.log(`\nTotal usuarios: ${totalUsuariosCaja.count}`);

      // Operadores
      const totalOperadoresCaja = cajaDb.prepare('SELECT COUNT(*) as count FROM operadores').get();
      console.log(`Total operadores: ${totalOperadoresCaja.count}`);

      report.sqlite.caja.usuarios = { total: totalUsuariosCaja.count };
      report.sqlite.caja.operadores = { total: totalOperadoresCaja.count };

      cajaDb.close();

    } catch (error) {
      console.error(`❌ Error SQLite Caja: ${error.message}`);
      report.sqlite.caja.error = error.message;
    }

    // ============================================
    // 3. VERIFICAR SUPABASE
    // ============================================
    console.log('\n☁️  3. Verificando Supabase...\n');

    // Vouchers
    const { count: totalVouchers } = await supabase
      .from('vouchers')
      .select('*', { count: 'exact', head: true });

    const { count: activeVouchers } = await supabase
      .from('vouchers')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    const { count: redeemedVouchers } = await supabase
      .from('vouchers')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'redeemed');

    console.log(`Total vouchers: ${totalVouchers}`);
    console.log(`  Activos: ${activeVouchers}`);
    console.log(`  Cobrados: ${redeemedVouchers}`);

    report.supabase.vouchers = {
      total: totalVouchers,
      active: activeVouchers,
      redeemed: redeemedVouchers
    };

    // Users
    const { count: totalUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    console.log(`\nTotal users: ${totalUsers}`);
    report.supabase.users = { total: totalUsers };

    // Operadores
    const { count: totalOperadoresSupabase } = await supabase
      .from('operadores')
      .select('*', { count: 'exact', head: true });

    console.log(`Total operadores: ${totalOperadoresSupabase}`);
    report.supabase.operadores = { total: totalOperadoresSupabase };

    // Stations
    const { count: totalStations } = await supabase
      .from('stations')
      .select('*', { count: 'exact', head: true });

    console.log(`Total stations: ${totalStations}`);
    report.supabase.stations = { total: totalStations };

    // ============================================
    // 4. ANÁLISIS Y RECOMENDACIONES
    // ============================================
    console.log('\n📊 4. Análisis y recomendaciones...\n');

    // Comparar totales
    const sqliteTotal = (report.sqlite.main.tickets?.total || 0) + (report.sqlite.caja.tickets?.total || 0);
    const supabaseTotal = report.supabase.vouchers.total;

    console.log(`SQLite total tickets: ${sqliteTotal}`);
    console.log(`Supabase total vouchers: ${supabaseTotal}`);

    if (sqliteTotal > supabaseTotal) {
      const diff = sqliteTotal - supabaseTotal;
      console.log(`⚠️  Faltan ${diff} tickets por sincronizar a Supabase`);
      report.issues.push(`${diff} tickets no sincronizados a Supabase`);
      report.recommendations.push(`Sincronizar ${diff} tickets pendientes a Supabase`);
    } else if (sqliteTotal < supabaseTotal) {
      console.log(`✅ Supabase tiene más vouchers (posiblemente creados directamente)`);
    } else {
      console.log(`✅ Cantidades coinciden`);
    }

    // Verificar columnas
    if (report.issues.some(i => i.includes('columna sincronizado'))) {
      console.log('\n⚠️  ACCIÓN REQUERIDA: Agregar columnas sincronizado y email');
      report.recommendations.push('Ejecutar migración de columnas en SQLite (ensureExtraColumns ya implementado)');
      report.recommendations.push('Reiniciar la app para que se ejecute ensureExtraColumns()');
    }

    // Usuarios pendientes
    const totalUsuariosPending = report.sqlite.main.usuarios?.pending || 0;
    if (totalUsuariosPending > 0) {
      console.log(`\n⚠️  ${totalUsuariosPending} usuarios pendientes de sincronizar`);
      report.recommendations.push(`Sincronizar ${totalUsuariosPending} usuarios a Supabase`);
    }

    // Operadores pendientes
    const totalOperadoresPending = report.sqlite.main.operadores?.pending || 0;
    if (totalOperadoresPending > 0) {
      console.log(`\n⚠️  ${totalOperadoresPending} operadores pendientes de sincronizar`);
      report.recommendations.push(`Sincronizar ${totalOperadoresPending} operadores a Supabase`);
    }

    // Worker status
    console.log('\n⚡ Worker de sincronización:');
    console.log('Estado: Debe estar corriendo cada 2 minutos');
    console.log('Ubicación: pure/main.js líneas 2610-2850');
    console.log('Sincroniza: Tickets, Usuarios, Operadores');

    // ============================================
    // GUARDAR INFORME
    // ============================================
    const fs = require('fs');

    let markdown = `# 🔄 INFORME DE ESTADO DE SINCRONIZACIÓN\n\n`;
    markdown += `**Fecha**: ${new Date().toLocaleString('es-DO')}\n\n`;
    markdown += `---\n\n`;

    markdown += `## 📊 RESUMEN EJECUTIVO\n\n`;
    markdown += `| Base de Datos | Tickets/Vouchers | Usuarios | Operadores |\n`;
    markdown += `|---------------|------------------|----------|------------|\n`;
    markdown += `| SQLite Principal | ${report.sqlite.main.tickets?.total || 0} (${report.sqlite.main.tickets?.pending || 0} pendientes) | ${report.sqlite.main.usuarios?.total || 0} (${report.sqlite.main.usuarios?.pending || 0} pendientes) | ${report.sqlite.main.operadores?.total || 0} (${report.sqlite.main.operadores?.pending || 0} pendientes) |\n`;
    markdown += `| SQLite Caja | ${report.sqlite.caja.tickets?.total || 0} | ${report.sqlite.caja.usuarios?.total || 0} | ${report.sqlite.caja.operadores?.total || 0} |\n`;
    markdown += `| Supabase | ${report.supabase.vouchers?.total || 0} | ${report.supabase.users?.total || 0} | ${report.supabase.operadores?.total || 0} |\n\n`;

    markdown += `## ⚠️  PROBLEMAS DETECTADOS\n\n`;
    if (report.issues.length > 0) {
      report.issues.forEach((issue, i) => {
        markdown += `${i + 1}. ${issue}\n`;
      });
    } else {
      markdown += `✅ No se detectaron problemas\n`;
    }
    markdown += `\n`;

    markdown += `## 💡 RECOMENDACIONES\n\n`;
    if (report.recommendations.length > 0) {
      report.recommendations.forEach((rec, i) => {
        markdown += `${i + 1}. ${rec}\n`;
      });
    } else {
      markdown += `✅ Todo está sincronizado correctamente\n`;
    }
    markdown += `\n`;

    markdown += `## 📋 DATOS PENDIENTES DE SINCRONIZAR\n\n`;

    if (report.pending.tickets.length > 0) {
      markdown += `### Tickets (${report.pending.tickets.length} mostrados)\n\n`;
      markdown += `| Código | Monto | Moneda | Fuente |\n`;
      markdown += `|--------|-------|--------|--------|\n`;
      report.pending.tickets.forEach(t => {
        markdown += `| ${t.code} | ${t.amount} | ${t.currency} | ${t.source} |\n`;
      });
      markdown += `\n`;
    }

    if (report.pending.users.length > 0) {
      markdown += `### Usuarios (${report.pending.users.length} mostrados)\n\n`;
      markdown += `| Username | Role | Email | Fuente |\n`;
      markdown += `|----------|------|-------|--------|\n`;
      report.pending.users.forEach(u => {
        markdown += `| ${u.username} | ${u.role} | ${u.email || 'N/A'} | ${u.source} |\n`;
      });
      markdown += `\n`;
    }

    if (report.pending.operadores.length > 0) {
      markdown += `### Operadores (${report.pending.operadores.length} mostrados)\n\n`;
      markdown += `| Código | Nombre | Fuente |\n`;
      markdown += `|--------|--------|--------|\n`;
      report.pending.operadores.forEach(o => {
        markdown += `| ${o.codigo} | ${o.nombre} | ${o.source} |\n`;
      });
      markdown += `\n`;
    }

    markdown += `---\n\n`;
    markdown += `**FIN DEL INFORME**\n`;

    fs.writeFileSync('ESTADO_SINCRONIZACION.md', markdown);
    console.log(`\n✅ Informe guardado en: ESTADO_SINCRONIZACION.md`);

    fs.writeFileSync('sync-status-report.json', JSON.stringify(report, null, 2));
    console.log(`✅ Datos JSON guardados en: sync-status-report.json`);

  } catch (error) {
    console.error('\n❌ Error durante verificación:', error.message);
    console.error(error);
  }

  console.log('\n=== FIN DE VERIFICACIÓN ===\n');
}

checkSyncStatus();
