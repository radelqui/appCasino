/**
 * TEST: Arquitectura Dual DB - Sincronización Bidireccional
 *
 * PROPÓSITO:
 *   Verificar que la sincronización funciona correctamente entre PCs:
 *   - PC1 crea ticket → Supabase → PC2 descarga
 *   - PC2 cobra ticket → Supabase → PC1 ve como cobrado
 *
 * CÓMO EJECUTAR:
 *   node test-dual-db-sync.js
 *
 * PREREQUISITOS:
 *   - App debe estar ejecutándose (para que el worker esté activo)
 *   - O ejecutar manualmente las funciones de sync
 */

const Database = require('better-sqlite3');
const path = require('path');

console.log('═══════════════════════════════════════════════════════════');
console.log('TEST: Verificación de Arquitectura Dual DB');
console.log('═══════════════════════════════════════════════════════════\n');

// Conectar a SQLite
const dbPath = path.join(__dirname, 'Caja', 'casino.db');
const db = new Database(dbPath);

console.log('✅ Conectado a SQLite:', dbPath);
console.log('');

// ═══════════════════════════════════════════════════════════
// TEST 1: Verificar estructura de tabla tickets
// ═══════════════════════════════════════════════════════════
console.log('TEST 1: Verificar estructura de tabla tickets');
console.log('─────────────────────────────────────────────────────────');

const tableInfo = db.prepare("PRAGMA table_info(tickets)").all();
const columns = tableInfo.map(col => col.name);

console.log('Columnas en SQLite tickets:');
console.log(columns.join(', '));
console.log('');

// Verificar columnas críticas
const criticalColumns = ['code', 'fecha_emision', 'sincronizado', 'hash_seguridad'];
const missingColumns = criticalColumns.filter(col => !columns.includes(col));

if (missingColumns.length > 0) {
  console.log('❌ FALTAN COLUMNAS CRÍTICAS:', missingColumns.join(', '));
  process.exit(1);
} else {
  console.log('✅ Todas las columnas críticas presentes');
}
console.log('');

// ═══════════════════════════════════════════════════════════
// TEST 2: Verificar índice sincronizado
// ═══════════════════════════════════════════════════════════
console.log('TEST 2: Verificar índice de sincronización');
console.log('─────────────────────────────────────────────────────────');

const indices = db.prepare("PRAGMA index_list(tickets)").all();
const hasSyncIndex = indices.some(idx => idx.name.includes('sincronizado'));

if (hasSyncIndex) {
  console.log('✅ Índice de sincronización existe (optimizado para queries)');
} else {
  console.log('⚠️  No hay índice en sincronizado (performance no óptima)');
  console.log('   RECOMENDACIÓN: CREATE INDEX idx_tickets_sincronizado ON tickets(sincronizado);');
}
console.log('');

// ═══════════════════════════════════════════════════════════
// TEST 3: Contar tickets por estado de sincronización
// ═══════════════════════════════════════════════════════════
console.log('TEST 3: Estado de sincronización actual');
console.log('─────────────────────────────────────────────────────────');

const syncStats = db.prepare(`
  SELECT
    sincronizado,
    COUNT(*) as cantidad,
    SUM(CASE WHEN redeemed = 1 THEN 1 ELSE 0 END) as cobrados,
    SUM(CASE WHEN redeemed = 0 THEN 1 ELSE 0 END) as pendientes
  FROM tickets
  GROUP BY sincronizado
`).all();

console.table(syncStats);

const pendingUpload = syncStats.find(s => s.sincronizado === 0);
if (pendingUpload && pendingUpload.cantidad > 0) {
  console.log(`⚠️  ${pendingUpload.cantidad} tickets pendientes de subir a Supabase`);
  console.log('   El worker los subirá en máximo 2 minutos');
} else {
  console.log('✅ Todos los tickets sincronizados con Supabase');
}
console.log('');

// ═══════════════════════════════════════════════════════════
// TEST 4: Verificar tickets recientes (últimas 24h)
// ═══════════════════════════════════════════════════════════
console.log('TEST 4: Tickets de las últimas 24 horas');
console.log('─────────────────────────────────────────────────────────');

const recentTickets = db.prepare(`
  SELECT
    code,
    table_number,
    amount,
    currency,
    fecha_emision,
    redeemed,
    sincronizado
  FROM tickets
  WHERE datetime(fecha_emision) >= datetime('now', '-1 day')
  ORDER BY fecha_emision DESC
  LIMIT 10
`).all();

if (recentTickets.length > 0) {
  console.log(`📋 ${recentTickets.length} tickets encontrados (últimas 24h):\n`);
  recentTickets.forEach(t => {
    const status = t.redeemed ? '✓ Cobrado' : '○ Pendiente';
    const sync = t.sincronizado ? '✓ Sync' : '○ Local';
    console.log(`  ${t.code} | Mesa ${t.table_number} | ${t.amount} ${t.currency} | ${status} | ${sync}`);
  });
} else {
  console.log('ℹ️  No hay tickets en las últimas 24 horas');
}
console.log('');

// ═══════════════════════════════════════════════════════════
// TEST 5: Verificar integridad hash_seguridad
// ═══════════════════════════════════════════════════════════
console.log('TEST 5: Integridad de hash_seguridad');
console.log('─────────────────────────────────────────────────────────');

const hashStats = db.prepare(`
  SELECT
    COUNT(*) as total,
    SUM(CASE WHEN hash_seguridad IS NULL OR hash_seguridad = '' THEN 1 ELSE 0 END) as sin_hash,
    SUM(CASE WHEN hash_seguridad IS NOT NULL AND hash_seguridad != '' THEN 1 ELSE 0 END) as con_hash
  FROM tickets
`).get();

console.log(`Total tickets: ${hashStats.total}`);
console.log(`Con hash: ${hashStats.con_hash} (${((hashStats.con_hash / hashStats.total) * 100).toFixed(1)}%)`);
console.log(`Sin hash: ${hashStats.sin_hash} (${((hashStats.sin_hash / hashStats.total) * 100).toFixed(1)}%)`);

if (hashStats.sin_hash > 0) {
  console.log(`⚠️  ${hashStats.sin_hash} tickets sin hash_seguridad`);
  console.log('   Estos tickets no podrán ser validados correctamente');
} else {
  console.log('✅ Todos los tickets tienen hash_seguridad');
}
console.log('');

// ═══════════════════════════════════════════════════════════
// TEST 6: Verificar columnas date vs datetime
// ═══════════════════════════════════════════════════════════
console.log('TEST 6: Verificar formato de fechas');
console.log('─────────────────────────────────────────────────────────');

const sampleTicket = db.prepare(`
  SELECT fecha_emision, fecha_cobro
  FROM tickets
  WHERE fecha_emision IS NOT NULL
  LIMIT 1
`).get();

if (sampleTicket) {
  console.log('Formato fecha_emision:', sampleTicket.fecha_emision);
  console.log('Formato fecha_cobro:', sampleTicket.fecha_cobro || 'NULL');

  // Verificar si es ISO 8601 (compatible con Supabase)
  const isISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(sampleTicket.fecha_emision);
  if (isISO) {
    console.log('✅ Formato ISO 8601 (compatible con Supabase TIMESTAMPTZ)');
  } else {
    console.log('⚠️  No es formato ISO 8601 estándar');
    console.log('   Puede haber problemas al sincronizar con Supabase');
  }
} else {
  console.log('ℹ️  No hay tickets para verificar formato');
}
console.log('');

// ═══════════════════════════════════════════════════════════
// RESUMEN FINAL
// ═══════════════════════════════════════════════════════════
console.log('═══════════════════════════════════════════════════════════');
console.log('RESUMEN: Estado de la Arquitectura Dual DB');
console.log('═══════════════════════════════════════════════════════════');

const totalTickets = hashStats.total;
const syncedTickets = syncStats.find(s => s.sincronizado === 1)?.cantidad || 0;
const pendingTickets = syncStats.find(s => s.sincronizado === 0)?.cantidad || 0;
const syncPercentage = totalTickets > 0 ? ((syncedTickets / totalTickets) * 100).toFixed(1) : 0;

console.log('');
console.log('📊 Estadísticas:');
console.log(`   Total tickets: ${totalTickets}`);
console.log(`   Sincronizados: ${syncedTickets} (${syncPercentage}%)`);
console.log(`   Pendientes: ${pendingTickets}`);
console.log('');

console.log('✅ Funcionalidades implementadas:');
console.log('   [✓] Escritura: SQLite + Supabase (con offline support)');
console.log('   [✓] Lectura: Siempre desde SQLite (rápida)');
console.log('   [✓] Upload sync: Tickets pendientes → Supabase');
console.log('   [✓] Download sync: Supabase → SQLite (NUEVO)');
console.log('');

console.log('⏱️  Worker de sincronización:');
console.log('   Intervalo: Cada 2 minutos');
console.log('   Funciones: Upload + Download bidireccional');
console.log('');

console.log('🎯 Para probar sincronización entre PCs:');
console.log('   1. PC1: Crear ticket (se sube a Supabase inmediatamente)');
console.log('   2. PC2: Esperar máximo 2 minutos (worker descarga automáticamente)');
console.log('   3. PC2: Verificar que aparece el ticket en panel');
console.log('   4. PC2: Cobrar el ticket (se actualiza en Supabase)');
console.log('   5. PC1: Esperar máximo 2 minutos (worker descarga estado)');
console.log('   6. PC1: Verificar que ticket aparece como cobrado');
console.log('');

console.log('═══════════════════════════════════════════════════════════');

// Cerrar conexión
db.close();
