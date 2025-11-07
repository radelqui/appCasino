const Database = require('better-sqlite3');
const db = new Database('Caja/casino.db');

console.log('═══════════════════════════════════════════');
console.log('ANÁLISIS COMPLETO DE TICKETS');
console.log('═══════════════════════════════════════════');

const all = db.prepare('SELECT COUNT(*) as total FROM tickets').get();
console.log('Total tickets en BD:', all.total);
console.log('');

console.log('TODOS LOS TICKETS:');
const tickets = db.prepare('SELECT id, code, amount, currency, estado, fecha_emision FROM tickets ORDER BY id').all();
tickets.forEach(t => {
  console.log(`  ID ${t.id}: ${t.code} | ${t.amount} ${t.currency} | ${t.estado} | ${t.fecha_emision}`);
});
console.log('');

console.log('TICKETS POR ESTADO:');
const byStatus = db.prepare('SELECT estado, COUNT(*) as count, SUM(amount) as total FROM tickets GROUP BY estado').all();
byStatus.forEach(s => console.log('  ', s.estado, ':', s.count, 'tickets | Total:', s.total));
console.log('');

console.log('TICKETS POR MONEDA:');
const byCurrency = db.prepare('SELECT currency, COUNT(*) as count, SUM(amount) as total FROM tickets GROUP BY currency').all();
byCurrency.forEach(c => console.log('  ', c.currency, ':', c.count, 'tickets | Total:', c.total));
console.log('');

console.log('FECHA ACTUAL:');
const now = db.prepare("SELECT date('now', 'localtime') as hoy").get();
console.log('  Hoy:', now.hoy);
console.log('');

console.log('QUERY getStatsToday() ACTUAL:');
console.log('WHERE fecha_emision >= DATE(now, localtime)');
const query1 = `
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
const stats1 = db.prepare(query1).get();
console.log('Resultado:', JSON.stringify(stats1, null, 2));
console.log('');

console.log('QUERY SIN FILTRO DE FECHA (TODOS):');
const query2 = `
  SELECT
    COUNT(*) as ticketsHoy,
    SUM(CASE WHEN currency = 'DOP' AND estado IN ('usado', 'canjeado', 'redeemed') THEN amount ELSE 0 END) as totalDOP,
    SUM(CASE WHEN currency = 'USD' AND estado IN ('usado', 'canjeado', 'redeemed') THEN amount ELSE 0 END) as totalUSD,
    SUM(CASE WHEN estado IN ('activo', 'emitido', 'active') THEN 1 ELSE 0 END) as pendientes,
    SUM(CASE WHEN estado IN ('usado', 'canjeado', 'redeemed') THEN 1 ELSE 0 END) as cobrados,
    SUM(CASE WHEN estado = 'cancelado' THEN 1 ELSE 0 END) as cancelados
  FROM tickets
`;
const stats2 = db.prepare(query2).get();
console.log('Resultado:', JSON.stringify(stats2, null, 2));

db.close();
