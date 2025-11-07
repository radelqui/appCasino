const Database = require('better-sqlite3');
const db = new Database('Caja/data/casino.db');

console.log('═══════════════════════════════════════════');
console.log('BASE DE DATOS REAL DE CAJA (Caja/data/casino.db)');
console.log('═══════════════════════════════════════════');

const all = db.prepare('SELECT COUNT(*) as total FROM tickets').get();
console.log('Total tickets:', all.total);
console.log('');

console.log('Últimos 20 tickets:');
const tickets = db.prepare('SELECT id, code, amount, currency, estado, fecha_emision FROM tickets ORDER BY id DESC LIMIT 20').all();
tickets.forEach(t => {
  console.log(`  ID ${t.id}: ${t.code} | ${t.amount} ${t.currency} | ${t.estado} | ${t.fecha_emision}`);
});
console.log('');

const today = db.prepare("SELECT date('now', 'localtime') as hoy").get();
console.log('Fecha actual:', today.hoy);
console.log('');

console.log('Tickets de HOY (DATE = date(now)):');
const todayTickets = db.prepare("SELECT * FROM tickets WHERE date(fecha_emision) = date('now', 'localtime')").all();
console.log('Total:', todayTickets.length);
todayTickets.forEach(t => {
  console.log(`  ID ${t.id}: ${t.code} | ${t.amount} ${t.currency} | ${t.estado} | ${t.fecha_emision}`);
});
console.log('');

console.log('AGREGACIONES POR ESTADO:');
const byStatus = db.prepare('SELECT estado, COUNT(*) as count, SUM(amount) as total FROM tickets GROUP BY estado').all();
byStatus.forEach(s => console.log(`  ${s.estado}: ${s.count} tickets | Total: ${s.total}`));
console.log('');

console.log('AGREGACIONES POR MONEDA:');
const byCurrency = db.prepare('SELECT currency, COUNT(*) as count, SUM(amount) as total FROM tickets GROUP BY currency').all();
byCurrency.forEach(c => console.log(`  ${c.currency}: ${c.count} tickets | Total: ${c.total}`));
console.log('');

console.log('QUERY getStatsToday() (con filtro >= DATE(now)):');
const query = `
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
const stats = db.prepare(query).get();
console.log('Resultado:', JSON.stringify(stats, null, 2));

db.close();
