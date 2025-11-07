// Script para verificar estructura de SQLite (sin usar better-sqlite3 directamente)
const path = require('path');

try {
  const CasinoDatabase = require('./Caja/database');
  const dbPath = process.env.CASINO_DB_PATH || process.env.SQLITE_DB_PATH || path.join(process.cwd(), 'data', 'casino.db');

  console.log('📂 Ruta de la BD:', dbPath);
  console.log('');

  const db = new CasinoDatabase(dbPath);

  // Listar tablas
  const tables = db.db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
  console.log('📋 TABLAS EN SQLITE:');
  tables.forEach(t => console.log('  -', t.name));
  console.log('');

  // Ver usuarios
  try {
    const users = db.db.prepare('SELECT id, username, role, activo FROM usuarios LIMIT 10').all();
    console.log('👥 USUARIOS EN SQLITE (tabla usuarios):');
    console.log(JSON.stringify(users, null, 2));
  } catch (e) {
    console.log('❌ No hay tabla usuarios o está vacía:', e.message);
  }
  console.log('');

  // Ver operadores
  try {
    const ops = db.db.prepare('SELECT id, codigo, nombre, pin, activo FROM operadores LIMIT 10').all();
    console.log('👷 OPERADORES EN SQLITE:');
    console.log(JSON.stringify(ops, null, 2));
  } catch (e) {
    console.log('❌ No hay tabla operadores o está vacía:', e.message);
  }
  console.log('');

  // Ver tickets
  try {
    const tickets = db.db.prepare('SELECT code, amount, estado, sincronizado FROM tickets ORDER BY id DESC LIMIT 5').all();
    console.log('🎫 ÚLTIMOS 5 TICKETS EN SQLITE:');
    console.log(JSON.stringify(tickets, null, 2));
  } catch (e) {
    console.log('❌ No hay tabla tickets o está vacía:', e.message);
  }

  db.close();

} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
