const Database = require('better-sqlite3');
const db = new Database('Caja/data/casino.db');

console.log('═══════════════════════════════════════════');
console.log('TEST QUERY CORREGIDO');
console.log('═══════════════════════════════════════════');

const now = db.prepare("SELECT date('now', 'localtime') as hoy").get();
console.log('Fecha actual:', now.hoy);
console.log('');

console.log('QUERY ANTERIOR (fecha_emision >= DATE(now)):');
const oldQuery = `
  SELECT
    COUNT(*) as ticketsHoy,
    SUM(CASE WHEN currency = 'DOP' AND estado IN ('usado', 'canjeado', 'redeemed') THEN amount ELSE 0 END) as totalDOP,
    SUM(CASE WHEN currency = 'USD' AND estado IN ('usado', 'canjeado', 'redeemed') THEN amount ELSE 0 END) as totalUSD,
    SUM(CASE WHEN estado IN ('activo', 'emitido', 'active') THEN 1 ELSE 0 END) as pendientes,
    SUM(CASE WHEN estado IN ('usado', 'canjeado', 'redeemed') THEN 1 ELSE 0 END) as cobrados,
    SUM(CASE WHEN estado = 'cancelado' THEN 1 ELSE 0 END) as cancelados
  FROM tickets
  WHERE fecha_emision >= DATE('now', 'localtime')
`;
const oldStats = db.prepare(oldQuery).get();
console.log('Resultado:', JSON.stringify(oldStats, null, 2));
console.log('');

console.log('QUERY NUEVO (DATE(fecha_emision) = DATE(now)):');
const newQuery = `
  SELECT
    COUNT(*) as ticketsHoy,
    SUM(CASE WHEN currency = 'DOP' AND estado IN ('usado', 'canjeado', 'redeemed') THEN amount ELSE 0 END) as totalDOP,
    SUM(CASE WHEN currency = 'USD' AND estado IN ('usado', 'canjeado', 'redeemed') THEN amount ELSE 0 END) as totalUSD,
    SUM(CASE WHEN estado IN ('activo', 'emitido', 'active') THEN 1 ELSE 0 END) as pendientes,
    SUM(CASE WHEN estado IN ('usado', 'canjeado', 'redeemed') THEN 1 ELSE 0 END) as cobrados,
    SUM(CASE WHEN estado = 'cancelado' THEN 1 ELSE 0 END) as cancelados
  FROM tickets
  WHERE DATE(fecha_emision) = DATE('now', 'localtime')
`;
const newStats = db.prepare(newQuery).get();
console.log('Resultado:', JSON.stringify(newStats, null, 2));
console.log('');

console.log('ESTADÍSTICAS POR MESA:');
const byStation = `
  SELECT
    mesa,
    COUNT(*) as tickets,
    SUM(amount) as total,
    currency
  FROM tickets
  WHERE DATE(fecha_emision) = DATE('now', 'localtime')
  GROUP BY mesa, currency
  ORDER BY mesa, currency
`;
const stationStats = db.prepare(byStation).all();
if (stationStats.length === 0) {
  console.log('  (No hay tickets de hoy)');
} else {
  stationStats.forEach(s => {
    console.log(`  Mesa ${s.mesa}: ${s.tickets} tickets | Total: ${s.total} ${s.currency}`);
  });
}

db.close();
