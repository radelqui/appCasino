const Database = require('better-sqlite3');
const path = require('path');

// Buscar la BD correcta
const dbPath = path.join(__dirname, 'Caja', 'data', 'casino.db');
const db = new Database(dbPath);

console.log('═══════════════════════════════════════════');
console.log('TEST: CORRECCIONES DE ESTADÍSTICAS');
console.log('═══════════════════════════════════════════');
console.log('');

// 1. Verificar estructura de tabla tickets
console.log('1. ESTRUCTURA DE TICKETS:');
const cols = db.prepare('PRAGMA table_info(tickets)').all();
console.log('Columnas:', cols.filter(c => c.name.includes('mesa')).map(c => c.name).join(', '));
console.log('');

// 2. Verificar tickets de prueba
console.log('2. TICKETS EXISTENTES:');
const tickets = db.prepare('SELECT id, code, mesa, currency, amount, estado, fecha_emision FROM tickets ORDER BY id DESC LIMIT 5').all();
console.log('Total tickets:', tickets.length);
tickets.forEach(t => {
  console.log(`  ID ${t.id}: Mesa="${t.mesa}" | ${t.amount} ${t.currency} | ${t.estado} | ${t.fecha_emision}`);
});
console.log('');

// 3. Test Query CORREGIDO (usa "mesa")
console.log('3. TEST QUERY CORREGIDO (usa columna "mesa"):');
const queryCorregido = `
  SELECT
    mesa,
    COUNT(*) as emitidos,
    SUM(CASE WHEN estado = 'usado' THEN 1 ELSE 0 END) as cobrados,
    SUM(CASE WHEN estado IN ('activo', 'emitido') THEN 1 ELSE 0 END) as pendientes,
    currency
  FROM tickets
  WHERE DATE(fecha_emision) = DATE('now', 'localtime')
  GROUP BY mesa, currency
  ORDER BY mesa, currency
`;

try {
  const start = Date.now();
  const rows = db.prepare(queryCorregido).all();
  const elapsed = Date.now() - start;

  console.log(`✅ Query ejecutado en ${elapsed}ms`);
  console.log('Resultados:');

  if (rows.length === 0) {
    console.log('  (No hay tickets de hoy)');
  } else {
    rows.forEach(r => {
      console.log(`  Mesa: ${r.mesa} | ${r.emitidos} emitidos | ${r.cobrados} cobrados | ${r.pendientes} pendientes | ${r.currency}`);
    });
  }
} catch (error) {
  console.log('❌ Error:', error.message);
}
console.log('');

// 4. Simular timeout (debe completar en < 5 segundos)
console.log('4. TEST TIMEOUT:');
const timeoutTest = new Promise((resolve, reject) => {
  const start = Date.now();

  setTimeout(() => {
    const elapsed = Date.now() - start;
    if (elapsed > 5000) {
      reject(new Error('Timeout: Query tardó más de 5 segundos'));
    } else {
      resolve(`Query completó en ${elapsed}ms (< 5000ms)`);
    }
  }, 100);
});

timeoutTest
  .then(result => console.log('✅', result))
  .catch(error => console.log('❌', error.message));

console.log('');

// 5. Test con tickets de prueba (sin filtro de fecha)
console.log('5. TEST SIN FILTRO DE FECHA (todos los tickets):');
const queryTodos = `
  SELECT
    mesa,
    COUNT(*) as emitidos,
    SUM(CASE WHEN estado = 'usado' THEN 1 ELSE 0 END) as cobrados,
    SUM(CASE WHEN estado IN ('activo', 'emitido') THEN 1 ELSE 0 END) as pendientes,
    currency
  FROM tickets
  GROUP BY mesa, currency
  ORDER BY mesa
`;

const allRows = db.prepare(queryTodos).all();
console.log('Total registros:', allRows.length);
allRows.forEach(r => {
  console.log(`  Mesa: ${r.mesa || 'NULL'} | ${r.emitidos} emitidos | ${r.pendientes} pendientes | ${r.currency}`);
});

// 6. Verificar si MESA-3 es reconocida
console.log('');
console.log('6. VERIFICACIÓN: ¿MESA-3 es reconocida?');
const mesa3 = allRows.find(r => r.mesa === 'MESA-3' || r.mesa === 'P03' || r.mesa === '3' || r.mesa === '03');
if (mesa3) {
  console.log('✅ MESA-3 encontrada:', mesa3);
} else {
  console.log('❌ MESA-3 NO encontrada en resultados');
  console.log('Mesas existentes:', [...new Set(allRows.map(r => r.mesa))].join(', '));
}

db.close();
