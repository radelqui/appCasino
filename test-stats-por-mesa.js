const Database = require('better-sqlite3');
const db = new Database('Caja/data/casino.db');

console.log('═══════════════════════════════════════════');
console.log('TEST: QUERY AMPLIADO CON DESGLOSE POR MESA');
console.log('═══════════════════════════════════════════');

const now = db.prepare("SELECT date('now', 'localtime') as hoy").get();
console.log('Fecha actual:', now.hoy);
console.log('');

// Verificar qué mesas existen en los datos
console.log('MESAS EXISTENTES EN BD:');
const mesas = db.prepare('SELECT DISTINCT mesa, COUNT(*) as count FROM tickets GROUP BY mesa ORDER BY mesa').all();
mesas.forEach(m => console.log(`  ${m.mesa}: ${m.count} tickets`));
console.log('');

// Query completo con desglose por mesa
console.log('QUERY COMPLETO CON DESGLOSE:');
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

    -- MESA-1
    SUM(CASE WHEN mesa = 'MESA-1' THEN 1 ELSE 0 END) as mesa1_emitidos,
    SUM(CASE WHEN mesa = 'MESA-1' AND estado IN ('usado', 'canjeado', 'redeemed') THEN 1 ELSE 0 END) as mesa1_cobrados,
    SUM(CASE WHEN mesa = 'MESA-1' AND estado IN ('activo', 'emitido', 'active') THEN 1 ELSE 0 END) as mesa1_pendientes,

    -- MESA-2
    SUM(CASE WHEN mesa = 'MESA-2' THEN 1 ELSE 0 END) as mesa2_emitidos,
    SUM(CASE WHEN mesa = 'MESA-2' AND estado IN ('usado', 'canjeado', 'redeemed') THEN 1 ELSE 0 END) as mesa2_cobrados,
    SUM(CASE WHEN mesa = 'MESA-2' AND estado IN ('activo', 'emitido', 'active') THEN 1 ELSE 0 END) as mesa2_pendientes,

    -- MESA-3
    SUM(CASE WHEN mesa = 'MESA-3' THEN 1 ELSE 0 END) as mesa3_emitidos,
    SUM(CASE WHEN mesa = 'MESA-3' AND estado IN ('usado', 'canjeado', 'redeemed') THEN 1 ELSE 0 END) as mesa3_cobrados,
    SUM(CASE WHEN mesa = 'MESA-3' AND estado IN ('activo', 'emitido', 'active') THEN 1 ELSE 0 END) as mesa3_pendientes

  FROM tickets
  WHERE DATE(fecha_emision) = DATE('now', 'localtime')
`;

const stats = db.prepare(query).get();

console.log('Resultado:');
console.log('-'.repeat(60));
console.log('TOTALES GENERALES:');
console.log(`  Tickets Hoy: ${stats.ticketsHoy}`);
console.log(`  Cobrados: ${stats.cobrados}`);
console.log(`  Pendientes: ${stats.pendientes}`);
console.log(`  Cancelados: ${stats.cancelados}`);
console.log(`  Total DOP: ${stats.totalDOP || 0}`);
console.log(`  Total USD: ${stats.totalUSD || 0}`);
console.log('');

console.log('MESA-1:');
console.log(`  Emitidos: ${stats.mesa1_emitidos || 0}`);
console.log(`  Cobrados: ${stats.mesa1_cobrados || 0}`);
console.log(`  Pendientes: ${stats.mesa1_pendientes || 0}`);
console.log('');

console.log('MESA-2:');
console.log(`  Emitidos: ${stats.mesa2_emitidos || 0}`);
console.log(`  Cobrados: ${stats.mesa2_cobrados || 0}`);
console.log(`  Pendientes: ${stats.mesa2_pendientes || 0}`);
console.log('');

console.log('MESA-3:');
console.log(`  Emitidos: ${stats.mesa3_emitidos || 0}`);
console.log(`  Cobrados: ${stats.mesa3_cobrados || 0}`);
console.log(`  Pendientes: ${stats.mesa3_pendientes || 0}`);
console.log('-'.repeat(60));

// Probar con todos los tickets (sin filtro de fecha) para ver si funciona
console.log('');
console.log('PRUEBA CON TODOS LOS TICKETS (sin filtro de fecha):');
const queryAll = query.replace("WHERE DATE(fecha_emision) = DATE('now', 'localtime')", "");
const statsAll = db.prepare(queryAll).get();

console.log('TOTALES:');
console.log(`  Tickets: ${statsAll.ticketsHoy}`);
console.log(`  Cobrados: ${statsAll.cobrados}`);
console.log(`  Pendientes: ${statsAll.pendientes}`);
console.log('');
console.log('POR MESA:');
console.log(`  MESA-1: ${statsAll.mesa1_emitidos || 0} emitidos | ${statsAll.mesa1_cobrados || 0} cobrados | ${statsAll.mesa1_pendientes || 0} pendientes`);
console.log(`  MESA-2: ${statsAll.mesa2_emitidos || 0} emitidos | ${statsAll.mesa2_cobrados || 0} cobrados | ${statsAll.mesa2_pendientes || 0} pendientes`);
console.log(`  MESA-3: ${statsAll.mesa3_emitidos || 0} emitidos | ${statsAll.mesa3_cobrados || 0} cobrados | ${statsAll.mesa3_pendientes || 0} pendientes`);

db.close();
