/**
 * Script para verificar estructura de la base de datos
 * Se ejecuta dentro de Electron
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'Caja', 'casino.db');

console.log('='.repeat(60));
console.log('VERIFICACIÓN DE BASE DE DATOS');
console.log('='.repeat(60));
console.log('Archivo:', dbPath);
console.log('');

try {
  const db = new Database(dbPath);

  // 1. Contar tickets
  const countResult = db.prepare('SELECT COUNT(*) as count FROM tickets').get();
  console.log('📊 TOTAL DE TICKETS:', countResult.count);
  console.log('');

  // 2. Obtener esquema de la tabla tickets
  const schema = db.prepare(`
    SELECT sql FROM sqlite_master WHERE type='table' AND name='tickets'
  `).get();

  console.log('📋 ESQUEMA DE LA TABLA tickets:');
  console.log('-'.repeat(60));
  if (schema && schema.sql) {
    console.log(schema.sql);
  } else {
    console.log('⚠️  No se encontró la tabla tickets');
  }
  console.log('-'.repeat(60));
  console.log('');

  // 3. Obtener columnas de la tabla
  const columns = db.prepare("PRAGMA table_info('tickets')").all();

  console.log('📝 COLUMNAS DE LA TABLA tickets:');
  console.log('-'.repeat(60));
  columns.forEach(col => {
    console.log(`  ${col.name.padEnd(25)} ${col.type.padEnd(15)} ${col.notnull ? 'NOT NULL' : ''}`);
  });
  console.log('-'.repeat(60));
  console.log('');

  // 4. Verificar si es legacy
  const columnNames = columns.map(c => c.name);
  const hasLegacyColumns = columnNames.includes('ticket_number') ||
                          columnNames.includes('valor') ||
                          columnNames.includes('moneda');
  const hasModernColumns = columnNames.includes('code') &&
                          columnNames.includes('amount') &&
                          columnNames.includes('currency');

  console.log('🔍 ANÁLISIS DEL ESQUEMA:');
  console.log('-'.repeat(60));
  if (hasModernColumns) {
    console.log('✅ ESQUEMA MODERNO detectado');
    console.log('   - Tiene columnas: code, amount, currency');
    console.log('   - NO requiere migración');
    console.log('   - La función ensureTicketsSchema() sale inmediatamente');
  } else if (hasLegacyColumns) {
    console.log('❌ ESQUEMA LEGACY detectado');
    console.log('   - Tiene columnas legacy: ticket_number, valor, moneda');
    console.log('   - REQUIERE migración');
    console.log('   - ensureTicketsSchema() procesará TODOS los tickets');
    console.log(`   - Con ${countResult.count} tickets, puede tardar varios segundos`);
  } else {
    console.log('⚠️  ESQUEMA DESCONOCIDO');
  }
  console.log('-'.repeat(60));
  console.log('');

  // 5. Muestra de datos (primeros 5 tickets)
  const sample = db.prepare('SELECT * FROM tickets LIMIT 5').all();
  console.log('📦 MUESTRA DE DATOS (primeros 5 tickets):');
  console.log('-'.repeat(60));
  if (sample.length > 0) {
    console.log(JSON.stringify(sample, null, 2));
  } else {
    console.log('(No hay tickets en la base de datos)');
  }
  console.log('-'.repeat(60));
  console.log('');

  db.close();

  console.log('✅ Verificación completada');
  console.log('='.repeat(60));

} catch (error) {
  console.error('❌ Error:', error.message);
  console.error('');
  console.error('Stack:', error.stack);
}
