#!/usr/bin/env node
/**
 * Verificar estado de sincronización en SQLite local
 */

const path = require('path');
const Database = require('better-sqlite3');

const dbPath = process.env.CASINO_DB_PATH ||
               process.env.SQLITE_DB_PATH ||
               path.join(process.cwd(), 'data', 'casino.db');

console.log('═══════════════════════════════════════════════════════════');
console.log('   📊 VERIFICACIÓN DE SINCRONIZACIÓN SQLite');
console.log('═══════════════════════════════════════════════════════════\n');

console.log(`📁 Base de datos: ${dbPath}\n`);

try {
  const db = new Database(dbPath);

  // Verificar si la tabla tickets existe
  const tableExists = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='tickets'"
  ).get();

  if (!tableExists) {
    console.log('❌ Tabla "tickets" no existe en SQLite');
    process.exit(1);
  }

  // Obtener estadísticas de sincronización
  const stats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN sincronizado = 1 THEN 1 ELSE 0 END) as sincronizados,
      SUM(CASE WHEN sincronizado = 0 OR sincronizado IS NULL THEN 1 ELSE 0 END) as pendientes
    FROM tickets
  `).get();

  console.log('📊 ESTADÍSTICAS DE TICKETS:\n');
  console.log(`   Total de tickets:        ${stats.total}`);
  console.log(`   ✅ Sincronizados:        ${stats.sincronizados}`);
  console.log(`   ⏳ Pendientes:           ${stats.pendientes}\n`);

  // Mostrar últimos 5 tickets
  console.log('📋 ÚLTIMOS 5 TICKETS:\n');
  const recent = db.prepare(`
    SELECT
      code,
      amount,
      currency,
      estado,
      sincronizado,
      fecha_emision
    FROM tickets
    ORDER BY fecha_emision DESC
    LIMIT 5
  `).all();

  if (recent.length === 0) {
    console.log('   (No hay tickets)\n');
  } else {
    recent.forEach(t => {
      const sync = t.sincronizado === 1 ? '✅' : '⏳';
      console.log(`   ${sync} ${t.code} - ${t.currency} ${t.amount} (${t.estado})`);
    });
    console.log('');
  }

  // Mostrar tickets pendientes de sincronización
  if (stats.pendientes > 0) {
    console.log('⚠️  TICKETS PENDIENTES DE SINCRONIZACIÓN:\n');
    const pending = db.prepare(`
      SELECT code, amount, currency, fecha_emision
      FROM tickets
      WHERE sincronizado = 0 OR sincronizado IS NULL
      ORDER BY fecha_emision DESC
      LIMIT 10
    `).all();

    pending.forEach(t => {
      console.log(`   ⏳ ${t.code} - ${t.currency} ${t.amount} (${t.fecha_emision})`);
    });
    console.log('');
  }

  db.close();

  console.log('═══════════════════════════════════════════════════════════\n');

  if (stats.pendientes > 0) {
    console.log(`⚠️  HAY ${stats.pendientes} TICKETS PENDIENTES DE SINCRONIZAR\n`);
    process.exit(1);
  } else {
    console.log('✅ TODOS LOS TICKETS ESTÁN SINCRONIZADOS\n');
    process.exit(0);
  }

} catch (error) {
  console.error('❌ Error:', error.message);
  console.error(error.stack);
  process.exit(1);
}
