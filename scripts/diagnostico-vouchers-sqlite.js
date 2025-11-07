/**
 * DIAGNÓSTICO: Por qué los vouchers PREV- no se guardan en SQLite
 *
 * Verifica:
 * 1. Estructura de tabla tickets
 * 2. Tickets PREV- existentes
 * 3. Intenta INSERT manual para detectar errores
 * 4. Revisa constraints y validaciones
 */

const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

const DB_PATH = path.join(__dirname, '../Caja/data/casino.db');

console.log('='.repeat(60));
console.log('DIAGNÓSTICO: Vouchers no se guardan en SQLite');
console.log('='.repeat(60));

try {
  // Abrir base de datos
  const db = new Database(DB_PATH);
  console.log('\n✅ Base de datos abierta:', DB_PATH);

  // ============================================
  // 1. VERIFICAR ESTRUCTURA DE TABLA
  // ============================================
  console.log('\n' + '='.repeat(60));
  console.log('1. ESTRUCTURA DE TABLA tickets');
  console.log('='.repeat(60));

  const tableInfo = db.prepare("PRAGMA table_info(tickets)").all();
  console.log('\nColumnas:');
  tableInfo.forEach(col => {
    console.log(`  - ${col.name} (${col.type}) ${col.notnull ? 'NOT NULL' : ''} ${col.dflt_value ? `DEFAULT ${col.dflt_value}` : ''}`);
  });

  // Verificar si existe hash_seguridad
  const hasHashSeguridad = tableInfo.some(col => col.name === 'hash_seguridad');
  console.log(`\n${hasHashSeguridad ? '✅' : '❌'} Campo hash_seguridad: ${hasHashSeguridad ? 'EXISTE' : 'NO EXISTE'}`);

  // ============================================
  // 2. CONTAR TICKETS PREV-
  // ============================================
  console.log('\n' + '='.repeat(60));
  console.log('2. TICKETS PREV- EN SQLite');
  console.log('='.repeat(60));

  const prevCount = db.prepare("SELECT COUNT(*) as total FROM tickets WHERE code LIKE 'PREV-%'").get();
  console.log(`\n📊 Total tickets PREV-: ${prevCount.total}`);

  if (prevCount.total > 0) {
    const recentPrev = db.prepare("SELECT code, amount, currency, estado, fecha_emision, sincronizado FROM tickets WHERE code LIKE 'PREV-%' ORDER BY id DESC LIMIT 5").all();
    console.log('\nÚltimos 5 tickets PREV-:');
    recentPrev.forEach(t => {
      console.log(`  - ${t.code} | ${t.amount} ${t.currency} | ${t.estado} | ${t.fecha_emision} | sync=${t.sincronizado}`);
    });
  } else {
    console.log('⚠️  NO HAY TICKETS PREV- en SQLite');
  }

  // ============================================
  // 3. VERIFICAR CONSTRAINTS
  // ============================================
  console.log('\n' + '='.repeat(60));
  console.log('3. CONSTRAINTS Y ÍNDICES');
  console.log('='.repeat(60));

  const indexes = db.prepare("SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='tickets'").all();
  console.log('\nÍndices:');
  indexes.forEach(idx => {
    console.log(`  - ${idx.name}`);
    if (idx.sql) console.log(`    ${idx.sql}`);
  });

  // ============================================
  // 4. INTENTAR INSERT MANUAL DE PRUEBA
  // ============================================
  console.log('\n' + '='.repeat(60));
  console.log('4. PRUEBA DE INSERT MANUAL');
  console.log('='.repeat(60));

  const testCode = 'PREV-TEST-' + Date.now();
  const testAmount = 100;
  const testCurrency = 'DOP';
  const testMesa = 'MESA-1';
  const testHash = crypto.createHash('sha256').update(testCode).digest('hex');

  console.log(`\nIntentando INSERT con:`);
  console.log(`  - code: ${testCode}`);
  console.log(`  - amount: ${testAmount}`);
  console.log(`  - currency: ${testCurrency}`);
  console.log(`  - mesa: ${testMesa}`);
  console.log(`  - hash_seguridad: ${testHash.slice(0, 16)}...`);

  try {
    const insertSQL = `
      INSERT INTO tickets (code, amount, currency, mesa, estado, sincronizado, mesa_id, created_by_user_id, created_by_username, mesa_nombre, hash_seguridad)
      VALUES (?, ?, ?, ?, 'emitido', 0, ?, ?, ?, ?, ?)
    `;

    const stmt = db.prepare(insertSQL);
    const result = stmt.run(
      testCode,
      testAmount,
      testCurrency,
      testMesa,
      1, // mesa_id
      '85397c30-3856-4d82-a4bb-06791b8cacd0', // user_id
      'test_user',
      'Mesa 1',
      testHash
    );

    console.log(`\n✅ INSERT EXITOSO`);
    console.log(`  - lastInsertRowid: ${result.lastInsertRowid}`);
    console.log(`  - changes: ${result.changes}`);

    // Verificar que se insertó
    const verify = db.prepare("SELECT * FROM tickets WHERE code = ?").get(testCode);
    if (verify) {
      console.log(`\n✅ Verificación: Ticket encontrado en DB`);
      console.log(`  - id: ${verify.id}`);
      console.log(`  - code: ${verify.code}`);
      console.log(`  - amount: ${verify.amount}`);
      console.log(`  - estado: ${verify.estado}`);
    } else {
      console.log(`\n❌ Verificación: Ticket NO encontrado después del INSERT`);
    }

    // Limpiar ticket de prueba
    db.prepare("DELETE FROM tickets WHERE code = ?").run(testCode);
    console.log(`\n🗑️  Ticket de prueba eliminado`);

  } catch (insertError) {
    console.log(`\n❌ ERROR EN INSERT:`);
    console.log(`  - Mensaje: ${insertError.message}`);
    console.log(`  - Código: ${insertError.code}`);

    // Analizar error específico
    if (insertError.message.includes('UNIQUE')) {
      console.log(`\n⚠️  DIAGNÓSTICO: Violación de constraint UNIQUE`);
      console.log(`  - Es probable que el código ya existe en la DB`);
    } else if (insertError.message.includes('NOT NULL')) {
      console.log(`\n⚠️  DIAGNÓSTICO: Campo obligatorio faltante`);
    } else if (insertError.message.includes('FOREIGN KEY')) {
      console.log(`\n⚠️  DIAGNÓSTICO: Violación de foreign key`);
    } else if (insertError.message.includes('no such column')) {
      console.log(`\n⚠️  DIAGNÓSTICO: Columna no existe en la tabla`);
    }
  }

  // ============================================
  // 5. VERIFICAR LOGS DE ERRORES SILENCIOSOS
  // ============================================
  console.log('\n' + '='.repeat(60));
  console.log('5. ANÁLISIS DE POSIBLES ERRORES SILENCIOSOS');
  console.log('='.repeat(60));

  // Verificar tickets sin sincronizar
  const unsyncedCount = db.prepare("SELECT COUNT(*) as total FROM tickets WHERE sincronizado = 0").get();
  console.log(`\n📊 Tickets sin sincronizar: ${unsyncedCount.total}`);

  if (unsyncedCount.total > 0) {
    const unsynced = db.prepare("SELECT code, amount, currency, estado, fecha_emision FROM tickets WHERE sincronizado = 0 ORDER BY id DESC LIMIT 5").all();
    console.log('\nÚltimos 5 tickets sin sincronizar:');
    unsynced.forEach(t => {
      console.log(`  - ${t.code} | ${t.amount} ${t.currency} | ${t.estado} | ${t.fecha_emision}`);
    });
  }

  // Verificar tickets de hoy
  const todayCount = db.prepare("SELECT COUNT(*) as total FROM tickets WHERE DATE(fecha_emision) = DATE('now', 'localtime')").get();
  console.log(`\n📊 Tickets de hoy: ${todayCount.total}`);

  // ============================================
  // 6. RESUMEN Y RECOMENDACIONES
  // ============================================
  console.log('\n' + '='.repeat(60));
  console.log('RESUMEN Y RECOMENDACIONES');
  console.log('='.repeat(60));

  if (prevCount.total === 0) {
    console.log('\n❌ PROBLEMA CONFIRMADO: No hay tickets PREV- en SQLite');
    console.log('\nPosibles causas:');
    console.log('  1. El INSERT está fallando silenciosamente');
    console.log('  2. El try-catch está capturando el error sin loggear');
    console.log('  3. La condición if (!db) está evitando el INSERT');
    console.log('  4. Hay un error de sintaxis SQL no detectado');
    console.log('\nRecomendación:');
    console.log('  - Agregar console.error ANTES de cada throw en el catch block');
    console.log('  - Verificar que db existe y tiene método prepare()');
    console.log('  - Agregar logging del error.message en el catch de SQLite');
  } else {
    console.log('\n✅ Tickets PREV- encontrados en SQLite');
    console.log('  El problema puede ser intermitente o ya fue corregido');
  }

  db.close();
  console.log('\n✅ Base de datos cerrada correctamente');

} catch (error) {
  console.error('\n❌ ERROR CRÍTICO:', error.message);
  console.error(error.stack);
  process.exit(1);
}

console.log('\n' + '='.repeat(60));
console.log('Diagnóstico completado');
console.log('='.repeat(60) + '\n');
