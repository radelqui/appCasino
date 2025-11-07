const Database = require('better-sqlite3');
const db = new Database('Caja/casino.db');

console.log('═══════════════════════════════════════════════════════════');
console.log('AUDITORÍA COMPLETA: ESQUEMA DE TABLA tickets');
console.log('═══════════════════════════════════════════════════════════\n');

// 1. Schema completo
const schema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='tickets'").get();
console.log('DEFINICIÓN SQL:');
console.log('-'.repeat(60));
console.log(schema.sql);
console.log('-'.repeat(60));
console.log('');

// 2. Columnas detalladas
const cols = db.prepare('PRAGMA table_info(tickets)').all();
console.log('COLUMNAS DETALLADAS:');
console.log('-'.repeat(60));
console.log('ID | Nombre                  | Tipo              | Not Null | Default');
console.log('-'.repeat(60));
cols.forEach(c => {
  const id = c.cid.toString().padStart(2);
  const name = c.name.padEnd(24);
  const type = c.type.padEnd(18);
  const notnull = c.notnull ? 'YES' : 'NO ';
  const dflt = c.dflt_value || '(none)';
  console.log(`${id} | ${name} | ${type} | ${notnull}      | ${dflt}`);
});
console.log('-'.repeat(60));
console.log('');

// 3. Índices
const indexes = db.prepare('PRAGMA index_list(tickets)').all();
console.log('ÍNDICES:');
console.log('-'.repeat(60));
if (indexes.length === 0) {
  console.log('(No hay índices)');
} else {
  indexes.forEach(idx => {
    console.log(`- ${idx.name}: ${idx.unique ? 'UNIQUE' : 'INDEX'}`);
  });
}
console.log('-'.repeat(60));
console.log('');

// 4. Muestra de datos para verificar tipos reales
const sample = db.prepare('SELECT * FROM tickets LIMIT 1').get();
console.log('MUESTRA DE DATOS (primer registro):');
console.log('-'.repeat(60));
if (sample) {
  Object.keys(sample).forEach(key => {
    const value = sample[key];
    const type = typeof value;
    console.log(`${key.padEnd(24)}: ${String(value).substring(0, 40).padEnd(42)} (${type})`);
  });
} else {
  console.log('(No hay datos)');
}
console.log('-'.repeat(60));

db.close();
