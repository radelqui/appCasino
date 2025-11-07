// test-ui-responsiveness.js
// Script para medir tiempo de respuesta de handlers críticos

const { performance } = require('perf_hooks');
const path = require('path');

console.log('======================================');
console.log('TEST: UI RESPONSIVENESS');
console.log('======================================\n');

// Simular entorno Electron
process.env.NODE_ENV = 'development';

// Medir tiempo de carga de database.js
console.log('1. Probando carga de database.js...');
const startDb = performance.now();
const Database = require('./Caja/database.js');
const endDb = performance.now();
console.log(`   ✅ Tiempo de carga: ${(endDb - startDb).toFixed(2)}ms\n`);

// Crear instancia de DB
const dbPath = path.join(__dirname, 'test-casino.db');
const db = new Database(dbPath);

// Test 1: getStatsToday (debe ser < 100ms)
console.log('2. Probando db.getStatsToday()...');
const startStats = performance.now();
const stats = db.getStatsToday();
const endStats = performance.now();
const statsTime = (endStats - startStats).toFixed(2);

console.log(`   Tiempo: ${statsTime}ms`);
console.log(`   Resultado:`, stats);

if (statsTime < 100) {
  console.log(`   ✅ ÉXITO: Respuesta en < 100ms\n`);
} else {
  console.log(`   ❌ FALLO: Tardó > 100ms (puede congelar UI)\n`);
}

// Test 2: Query por mesa (debe ser < 100ms)
console.log('3. Probando query por mesa...');
const query = `
  SELECT
    mesa,
    COUNT(*) as emitidos,
    SUM(CASE WHEN estado = 'usado' THEN 1 ELSE 0 END) as cobrados,
    SUM(CASE WHEN estado IN ('activo', 'emitido') THEN 1 ELSE 0 END) as pendientes,
    SUM(CASE WHEN estado = 'usado' THEN amount ELSE 0 END) as total_amount,
    currency
  FROM tickets
  WHERE DATE(fecha_emision) = DATE('now', 'localtime')
  GROUP BY mesa, currency
  ORDER BY mesa, currency
`;

const startMesa = performance.now();
const mesaRows = db.db.prepare(query).all();
const endMesa = performance.now();
const mesaTime = (endMesa - startMesa).toFixed(2);

console.log(`   Tiempo: ${mesaTime}ms`);
console.log(`   Resultado: ${mesaRows.length} filas`);

if (mesaTime < 100) {
  console.log(`   ✅ ÉXITO: Respuesta en < 100ms\n`);
} else {
  console.log(`   ❌ FALLO: Tardó > 100ms (puede congelar UI)\n`);
}

// Test 3: Generar código de ticket (debe ser < 10ms)
console.log('4. Probando generateTicketCode()...');
const startCode = performance.now();
const ticketCode = db.generateTicketCode();
const endCode = performance.now();
const codeTime = (endCode - startCode).toFixed(2);

console.log(`   Tiempo: ${codeTime}ms`);
console.log(`   Código generado: ${ticketCode}`);

if (codeTime < 10) {
  console.log(`   ✅ ÉXITO: Respuesta en < 10ms\n`);
} else {
  console.log(`   ⚠️  ADVERTENCIA: Tardó > 10ms\n`);
}

// Test 4: Crear ticket (debe ser < 50ms)
console.log('5. Probando createTicket()...');
const startCreate = performance.now();
try {
  db.createTicket({
    code: ticketCode,
    amount: 1000,
    currency: 'DOP',
    mesa: 'TEST',
    usuario_emision: 'test-script'
  });
  const endCreate = performance.now();
  const createTime = (endCreate - startCreate).toFixed(2);

  console.log(`   Tiempo: ${createTime}ms`);
  console.log(`   ✅ Ticket creado exitosamente`);

  if (createTime < 50) {
    console.log(`   ✅ ÉXITO: Respuesta en < 50ms\n`);
  } else {
    console.log(`   ⚠️  ADVERTENCIA: Tardó > 50ms\n`);
  }
} catch (error) {
  console.log(`   ❌ ERROR: ${error.message}\n`);
}

// Test 5: getTicket (debe ser < 10ms)
console.log('6. Probando getTicket()...');
const startGet = performance.now();
const ticket = db.getTicket(ticketCode);
const endGet = performance.now();
const getTime = (endGet - startGet).toFixed(2);

console.log(`   Tiempo: ${getTime}ms`);
console.log(`   Resultado:`, ticket ? `✅ Encontrado: ${ticket.code}` : '❌ No encontrado');

if (getTime < 10) {
  console.log(`   ✅ ÉXITO: Respuesta en < 10ms\n`);
} else {
  console.log(`   ⚠️  ADVERTENCIA: Tardó > 10ms\n`);
}

// Cerrar DB
db.close();

console.log('======================================');
console.log('RESUMEN FINAL');
console.log('======================================');
console.log(`
CRITERIOS DE ÉXITO:
- getStatsToday(): < 100ms .......... ${statsTime}ms ${statsTime < 100 ? '✅' : '❌'}
- Query por mesa: < 100ms ........... ${mesaTime}ms ${mesaTime < 100 ? '✅' : '❌'}
- generateTicketCode(): < 10ms ...... ${codeTime}ms ${codeTime < 10 ? '✅' : '⚠️'}
- createTicket(): < 50ms ............ ${createTime}ms ${createTime < 50 ? '✅' : '⚠️'}
- getTicket(): < 10ms ............... ${getTime}ms ${getTime < 10 ? '✅' : '⚠️'}

CONCLUSIÓN:
${statsTime < 100 && mesaTime < 100 ?
  '✅ HANDLERS NO DEBERÍAN CONGELAR LA UI' :
  '❌ HANDLERS PUEDEN CONGELAR LA UI - REVISAR'}
`);

// Limpiar DB de prueba
try {
  const fs = require('fs');
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
    console.log('🧹 Base de datos de prueba eliminada\n');
  }
} catch (err) {
  console.warn('⚠️  No se pudo eliminar DB de prueba:', err.message);
}
