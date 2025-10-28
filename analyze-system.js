// analyze-system.js - Script para analizar el sistema completo
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

console.log('==========================================');
console.log('📊 ANÁLISIS COMPLETO DEL SISTEMA');
console.log('==========================================\n');

// 1. Analizar bases de datos
const dbPaths = [
  './data/casino.db',
  './Caja/data/casino.db',
  './Caja/casino.db'
];

dbPaths.forEach((dbPath, index) => {
  try {
    if (!fs.existsSync(dbPath)) {
      console.log(`${index + 1}. ❌ ${dbPath} - NO EXISTE\n`);
      return;
    }

    const db = new Database(dbPath, { readonly: true });

    console.log(`${index + 1}. ✅ ${dbPath}`);
    console.log('─'.repeat(60));

    // Tablas
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log(`   Tablas: ${tables.map(t => t.name).join(', ')}`);

    // Últimos 3 tickets
    try {
      const tickets = db.prepare('SELECT * FROM tickets ORDER BY fecha_emision DESC LIMIT 3').all();
      console.log(`\n   📋 Últimos 3 tickets:`);
      tickets.forEach((t, i) => {
        console.log(`   ${i + 1}. ${t.code} - ${t.currency} ${t.amount} - Estado: ${t.estado}`);
        console.log(`      Fecha: ${t.fecha_emision}`);
      });
    } catch (e) {
      console.log(`   ⚠️  Error leyendo tickets: ${e.message}`);
    }

    // Contar registros
    try {
      const count = db.prepare('SELECT COUNT(*) as total FROM tickets').get();
      console.log(`\n   📊 Total tickets: ${count.total}`);
    } catch (e) {
      console.log(`   ⚠️  Error contando tickets: ${e.message}`);
    }

    db.close();
    console.log('\n');
  } catch (error) {
    console.log(`${index + 1}. ❌ Error con ${dbPath}: ${error.message}\n`);
  }
});

// 2. Analizar estructura de archivos
console.log('==========================================');
console.log('📁 ESTRUCTURA DEL PROYECTO');
console.log('==========================================\n');

const dirs = ['pure', 'src/main', 'src/main/ipc', 'Caja'];
dirs.forEach(dir => {
  try {
    const files = fs.readdirSync(dir);
    console.log(`📂 ${dir}/`);
    files.forEach(file => {
      const stat = fs.statSync(path.join(dir, file));
      if (stat.isFile() && file.endsWith('.js')) {
        console.log(`   - ${file}`);
      }
    });
    console.log('');
  } catch (e) {
    console.log(`❌ Error leyendo ${dir}: ${e.message}\n`);
  }
});

// 3. Analizar package.json
console.log('==========================================');
console.log('⚙️  CONFIGURACIÓN');
console.log('==========================================\n');

try {
  const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
  console.log(`Nombre: ${pkg.name}`);
  console.log(`Versión: ${pkg.version}`);
  console.log(`Main: ${pkg.main}`);
  console.log('\nScripts disponibles:');
  Object.keys(pkg.scripts).forEach(script => {
    console.log(`  - npm run ${script}`);
  });
} catch (e) {
  console.log(`❌ Error leyendo package.json: ${e.message}`);
}

console.log('\n==========================================');
console.log('✅ ANÁLISIS COMPLETADO');
console.log('==========================================');
