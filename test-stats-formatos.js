const Database = require('better-sqlite3');
const db = new Database('Caja/data/casino.db');

console.log('═══════════════════════════════════════════');
console.log('TEST: QUERY CON MÚLTIPLES FORMATOS DE MESA');
console.log('═══════════════════════════════════════════');

// Query con soporte multi-formato
const query = `
  SELECT
    COUNT(*) as ticketsHoy,

    -- Totales por estado
    SUM(CASE WHEN estado IN ('usado', 'canjeado', 'redeemed') THEN 1 ELSE 0 END) as cobrados,
    SUM(CASE WHEN estado IN ('activo', 'emitido', 'active') THEN 1 ELSE 0 END) as pendientes,
    SUM(CASE WHEN estado = 'cancelado' THEN 1 ELSE 0 END) as cancelados,

    -- Totales por moneda (solo cobrados)
    SUM(CASE WHEN currency = 'DOP' AND estado IN ('usado', 'canjeado', 'redeemed') THEN amount ELSE 0 END) as totalDOP,
    SUM(CASE WHEN currency = 'USD' AND estado IN ('usado', 'canjeado', 'redeemed') THEN amount ELSE 0 END) as totalUSD,

    -- MESA-1 (incluye: MESA-1, P01, M01, m01, 01, 1)
    SUM(CASE WHEN mesa IN ('MESA-1', 'P01', 'M01', 'm01', '01', '1') THEN 1 ELSE 0 END) as mesa1_emitidos,
    SUM(CASE WHEN mesa IN ('MESA-1', 'P01', 'M01', 'm01', '01', '1') AND estado IN ('usado', 'canjeado', 'redeemed') THEN 1 ELSE 0 END) as mesa1_cobrados,
    SUM(CASE WHEN mesa IN ('MESA-1', 'P01', 'M01', 'm01', '01', '1') AND estado IN ('activo', 'emitido', 'active') THEN 1 ELSE 0 END) as mesa1_pendientes,

    -- MESA-2 (incluye: MESA-2, P02, M02, m02, 02, 2)
    SUM(CASE WHEN mesa IN ('MESA-2', 'P02', 'M02', 'm02', '02', '2') THEN 1 ELSE 0 END) as mesa2_emitidos,
    SUM(CASE WHEN mesa IN ('MESA-2', 'P02', 'M02', 'm02', '02', '2') AND estado IN ('usado', 'canjeado', 'redeemed') THEN 1 ELSE 0 END) as mesa2_cobrados,
    SUM(CASE WHEN mesa IN ('MESA-2', 'P02', 'M02', 'm02', '02', '2') AND estado IN ('activo', 'emitido', 'active') THEN 1 ELSE 0 END) as mesa2_pendientes,

    -- MESA-3 (incluye: MESA-3, P03, M03, m03, 03, 3)
    SUM(CASE WHEN mesa IN ('MESA-3', 'P03', 'M03', 'm03', '03', '3') THEN 1 ELSE 0 END) as mesa3_emitidos,
    SUM(CASE WHEN mesa IN ('MESA-3', 'P03', 'M03', 'm03', '03', '3') AND estado IN ('usado', 'canjeado', 'redeemed') THEN 1 ELSE 0 END) as mesa3_cobrados,
    SUM(CASE WHEN mesa IN ('MESA-3', 'P03', 'M03', 'm03', '03', '3') AND estado IN ('activo', 'emitido', 'active') THEN 1 ELSE 0 END) as mesa3_pendientes

  FROM tickets
`;

const stats = db.prepare(query).get();

console.log('TOTALES GENERALES:');
console.log(`  Tickets: ${stats.ticketsHoy}`);
console.log(`  Cobrados: ${stats.cobrados || 0}`);
console.log(`  Pendientes: ${stats.pendientes || 0}`);
console.log(`  Cancelados: ${stats.cancelados || 0}`);
console.log(`  Total DOP: ${stats.totalDOP || 0}`);
console.log(`  Total USD: ${stats.totalUSD || 0}`);
console.log('');

console.log('DESGLOSE POR MESA:');
console.log('-'.repeat(60));
console.log('MESA-1 (P01, M01, m01, 01, 1):');
console.log(`  Emitidos: ${stats.mesa1_emitidos || 0}`);
console.log(`  Cobrados: ${stats.mesa1_cobrados || 0}`);
console.log(`  Pendientes: ${stats.mesa1_pendientes || 0}`);
console.log('');

console.log('MESA-2 (P02, M02, m02, 02, 2):');
console.log(`  Emitidos: ${stats.mesa2_emitidos || 0}`);
console.log(`  Cobrados: ${stats.mesa2_cobrados || 0}`);
console.log(`  Pendientes: ${stats.mesa2_pendientes || 0}`);
console.log('');

console.log('MESA-3 (P03, M03, m03, 03, 3):');
console.log(`  Emitidos: ${stats.mesa3_emitidos || 0}`);
console.log(`  Cobrados: ${stats.mesa3_cobrados || 0}`);
console.log(`  Pendientes: ${stats.mesa3_pendientes || 0}`);
console.log('-'.repeat(60));

// Verificar
const total_por_mesa = (stats.mesa1_emitidos || 0) + (stats.mesa2_emitidos || 0) + (stats.mesa3_emitidos || 0);
console.log('');
console.log('VERIFICACIÓN:');
console.log(`  Total tickets: ${stats.ticketsHoy}`);
console.log(`  Suma por mesa: ${total_por_mesa}`);
if (total_por_mesa === stats.ticketsHoy) {
  console.log('  ✅ CORRECTO: Todos los tickets están asignados a una mesa');
} else {
  console.log(`  ⚠️  ATENCIÓN: ${stats.ticketsHoy - total_por_mesa} tickets NO están en MESA-1, MESA-2 o MESA-3`);

  // Mostrar qué mesas no están cubiertas
  const uncovered = db.prepare(`
    SELECT DISTINCT mesa, COUNT(*) as count
    FROM tickets
    WHERE mesa NOT IN ('MESA-1', 'P01', 'M01', 'm01', '01', '1',
                       'MESA-2', 'P02', 'M02', 'm02', '02', '2',
                       'MESA-3', 'P03', 'M03', 'm03', '03', '3')
    GROUP BY mesa
  `).all();

  if (uncovered.length > 0) {
    console.log('  Mesas no cubiertas:');
    uncovered.forEach(m => console.log(`    - "${m.mesa}": ${m.count} tickets`));
  }
}

db.close();
